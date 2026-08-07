const logger = require('../lib/logger');

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

// ── Backend mémoire (par défaut) ─────────────────────────────────────────────
// Suffisant pour un déploiement classique (Docker/VM, un seul process
// long-vivant). NE FONCTIONNE PAS correctement en serverless : chaque
// invocation peut démarrer une instance fraîche sans mémoire partagée, donc
// le compteur ne persiste pas entre requêtes. Voir le backend Redis
// ci-dessous, activé automatiquement si UPSTASH_REDIS_REST_URL est défini.
const createMemoryRateLimiter = ({ windowMs, max, name, keyGenerator }) => {
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

// ── Backend Redis (Upstash) — serverless-safe ────────────────────────────────
// Activé automatiquement si UPSTASH_REDIS_REST_URL / _TOKEN sont définis
// (typiquement en prod Vercel). Le compteur vit dans Redis, partagé par
// toutes les invocations quelle que soit l'instance qui les traite.
let upstashClients = null;
const getUpstashClients = () => {
  if (upstashClients) return upstashClients;
  const { Redis } = require('@upstash/redis');
  const { Ratelimit } = require('@upstash/ratelimit');
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  upstashClients = { redis, Ratelimit };
  return upstashClients;
};

const createRedisRateLimiter = ({ windowMs, max, name, keyGenerator }) => {
  const { redis, Ratelimit } = getUpstashClients();
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
    prefix: `ratelimit:${name}`,
  });

  return async (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : getClientIp(req);
    try {
      const { success, limit, remaining, reset } = await limiter.limit(key);
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(reset / 1000));

      if (!success) {
        const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({
          message: `Trop de requetes (${name}), reessayez plus tard`,
          retryAfter: retryAfterSec
        });
      }

      return next();
    } catch (error) {
      // Ne jamais bloquer l'API si Redis est indisponible : on laisse
      // passer la requête (fail-open) plutôt que de renvoyer une 500.
      logger.error('Erreur rate limiter Redis, requete autorisee par defaut', { message: error.message, name });
      return next();
    }
  };
};

const hasUpstashConfig = () =>
  Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const createRateLimiter = (options) =>
  hasUpstashConfig() ? createRedisRateLimiter(options) : createMemoryRateLimiter(options);

module.exports = {
  createRateLimiter,
  getClientIp
};
