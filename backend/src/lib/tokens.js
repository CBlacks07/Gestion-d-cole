const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('./db');

const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || '7', 10);

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/auth/refresh',
};

const storeRefreshToken = async (userId, tokenRaw, req) => {
  const tokenHash = hashToken(tokenRaw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const ipAddress = req.ip || null;
  const userAgent = req.headers['user-agent'] || null;

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, ipAddress, userAgent]
  );
};

module.exports = {
  REFRESH_TOKEN_DAYS,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  COOKIE_OPTS,
  storeRefreshToken,
};
