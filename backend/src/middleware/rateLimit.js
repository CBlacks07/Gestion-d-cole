const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const createRateLimiter = ({
  windowMs,
  max,
  name = 'rate-limit',
  keyGenerator
}) => {
  const buckets = new Map();
  let requestCount = 0;

  return (req, res, next) => {
    const now = Date.now();
    requestCount += 1;

    if (requestCount % 200 === 0) {
      for (const [key, state] of buckets.entries()) {
        if (state.resetAt <= now) {
          buckets.delete(key);
        }
      }
    }

    const key = keyGenerator ? keyGenerator(req) : getClientIp(req);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
      return next();
    }

    current.count += 1;

    const remaining = Math.max(0, max - current.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetAt / 1000));

    if (current.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        message: `Trop de requetes (${name}), reessayez plus tard`,
        retryAfter: retryAfterSec
      });
    }

    return next();
  };
};

module.exports = {
  createRateLimiter,
  getClientIp
};
