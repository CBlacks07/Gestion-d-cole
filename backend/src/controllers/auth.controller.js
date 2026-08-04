const { query } = require('../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logAuditEvent } = require('../lib/audit');
const logger = require('../lib/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || '7', 10);

const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const isStrongPassword = (pwd) => {
  if (!pwd || pwd.length < 8) return false;
  return /[A-Z]/.test(pwd) || /[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd);
};

const safeError = (error) =>
  process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : error.message;

const getAuthSecuritySettings = () => ({
  maxFailedAttempts: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS || '5', 10),
  lockDurationMinutes: parseInt(process.env.LOGIN_LOCK_DURATION_MINUTES || '15', 10),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/auth/refresh',
};

// ── Login attempts ─────────────────────────────────────────────────────────────

const getLoginAttempt = async (email) => {
  const result = await query(
    `SELECT failed_attempts, locked_until FROM login_attempts WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

const registerFailedAttempt = async (email, settings) => {
  const result = await query(
    `INSERT INTO login_attempts (email, failed_attempts, last_failed_at, locked_until, updated_at)
     VALUES ($1, 1, NOW(), CASE WHEN 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE NULL END, NOW())
     ON CONFLICT (email) DO UPDATE
     SET failed_attempts = login_attempts.failed_attempts + 1,
         last_failed_at = NOW(),
         locked_until = CASE
           WHEN login_attempts.failed_attempts + 1 >= $2 THEN NOW() + make_interval(mins => $3)
           ELSE login_attempts.locked_until
         END,
         updated_at = NOW()
     RETURNING failed_attempts, locked_until`,
    [email, settings.maxFailedAttempts, settings.lockDurationMinutes]
  );
  return result.rows[0];
};

const clearFailedAttempts = async (email) => {
  await query('DELETE FROM login_attempts WHERE email = $1', [email]);
};

// ── Sauvegarder un refresh token en DB ────────────────────────────────────────

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

// ── Register ───────────────────────────────────────────────────────────────────

exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse, role, telephone, enseignantId } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const requestedRole = role ? role.toUpperCase() : 'SECRETAIRE';

    if (!normalizedEmail || !motDePasse) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    if (!isStrongPassword(motDePasse)) {
      return res.status(400).json({
        message: 'Le mot de passe doit contenir au moins 8 caractères avec au moins une majuscule, un chiffre ou un caractère spécial',
      });
    }

    if (requestedRole === 'ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Seul un ADMIN peut créer un autre ADMIN' });
    }

    const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Cet utilisateur existe déjà' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(motDePasse, salt);

    const result = await query(
      `INSERT INTO users (nom, prenom, email, mot_de_passe, role, telephone, enseignant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nom, prenom, email, role, telephone, actif, enseignant_id, created_at`,
      [nom, prenom, normalizedEmail, hashedPassword, requestedRole, telephone, enseignantId || null]
    );

    const user = result.rows[0];

    await logAuditEvent({
      req, userId: req.user?.id || null, action: 'USER_REGISTER',
      entity: 'USER', entityId: user.id, status: 'SUCCESS',
      details: { email: user.email, role: user.role },
    });

    res.status(201).json({
      id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role,
      token: generateAccessToken(user.id),
    });
  } catch (error) {
    logger.error('Erreur register:', error);
    res.status(500).json({ message: safeError(error) });
  }
};

// ── Login ──────────────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const settings = getAuthSecuritySettings();

    if (!normalizedEmail || !motDePasse) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const attemptState = await getLoginAttempt(normalizedEmail);
    const now = new Date();
    if (attemptState?.locked_until && new Date(attemptState.locked_until) > now) {
      await logAuditEvent({
        req, action: 'LOGIN_BLOCKED', entity: 'AUTH', status: 'FAILED',
        details: { email: normalizedEmail, lockedUntil: attemptState.locked_until },
      });
      return res.status(423).json({
        message: 'Compte temporairement verrouillé. Réessayez plus tard.',
        lockedUntil: attemptState.locked_until,
      });
    }

    const result = await query(
      'SELECT id, nom, prenom, email, mot_de_passe, role, actif, enseignant_id FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      const updatedAttempt = await registerFailedAttempt(normalizedEmail, settings);
      await logAuditEvent({
        req, action: 'LOGIN_FAILED', entity: 'AUTH', status: 'FAILED',
        details: { email: normalizedEmail, reason: 'USER_NOT_FOUND', failedAttempts: updatedAttempt.failed_attempts },
      });
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(motDePasse, user.mot_de_passe);

    if (!isMatch) {
      const updatedAttempt = await registerFailedAttempt(normalizedEmail, settings);
      await logAuditEvent({
        req, userId: user.id, action: 'LOGIN_FAILED', entity: 'AUTH', status: 'FAILED',
        details: { email: normalizedEmail, reason: 'INVALID_PASSWORD', failedAttempts: updatedAttempt.failed_attempts },
      });

      if (updatedAttempt.locked_until && new Date(updatedAttempt.locked_until) > now) {
        return res.status(423).json({
          message: 'Compte temporairement verrouillé. Réessayez plus tard.',
          lockedUntil: updatedAttempt.locked_until,
        });
      }

      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    if (!user.actif) {
      await logAuditEvent({
        req, userId: user.id, action: 'LOGIN_FAILED', entity: 'AUTH', status: 'FAILED',
        details: { email: normalizedEmail, reason: 'ACCOUNT_DISABLED' },
      });
      return res.status(401).json({ message: 'Compte désactivé' });
    }

    await clearFailedAttempts(normalizedEmail);

    // Générer les deux tokens
    const accessToken = generateAccessToken(user.id);
    const refreshTokenRaw = generateRefreshToken();
    await storeRefreshToken(user.id, refreshTokenRaw, req);

    await logAuditEvent({
      req, userId: user.id, action: 'LOGIN_SUCCESS', entity: 'AUTH', status: 'SUCCESS',
      details: { email: normalizedEmail },
    });

    // Refresh token en cookie httpOnly
    res.cookie('refreshToken', refreshTokenRaw, COOKIE_OPTS);

    res.json({
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      enseignantId: user.enseignant_id || null,
      token: accessToken,
    });
  } catch (error) {
    logger.error('Erreur login:', error);
    res.status(500).json({ message: safeError(error) });
  }
};

// ── Refresh token ──────────────────────────────────────────────────────────────

exports.refresh = async (req, res) => {
  try {
    const tokenRaw = req.cookies?.refreshToken;
    if (!tokenRaw) {
      return res.status(401).json({ message: 'Refresh token manquant' });
    }

    const tokenHash = hashToken(tokenRaw);
    const result = await query(
      `SELECT rt.*, u.id as uid, u.nom, u.prenom, u.email, u.role, u.actif, u.enseignant_id
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1
         AND rt.revoked_at IS NULL
         AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return res.status(401).json({ message: 'Refresh token invalide ou expiré' });
    }

    const row = result.rows[0];
    if (!row.actif) {
      return res.status(401).json({ message: 'Compte désactivé' });
    }

    // Rotation : révoquer l'ancien token, en créer un nouveau
    await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);

    const newAccessToken = generateAccessToken(row.uid);
    const newRefreshTokenRaw = generateRefreshToken();
    await storeRefreshToken(row.uid, newRefreshTokenRaw, req);

    res.cookie('refreshToken', newRefreshTokenRaw, COOKIE_OPTS);

    res.json({
      token: newAccessToken,
      user: {
        id: row.uid,
        nom: row.nom,
        prenom: row.prenom,
        email: row.email,
        role: row.role,
        enseignantId: row.enseignant_id || null,
      },
    });
  } catch (error) {
    logger.error('Erreur refresh:', error);
    res.status(500).json({ message: safeError(error) });
  }
};

// ── Logout ─────────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  try {
    const tokenRaw = req.cookies?.refreshToken;
    if (tokenRaw) {
      const tokenHash = hashToken(tokenRaw);
      await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    }
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ message: safeError(error) });
  }
};

// ── Change password ────────────────────────────────────────────────────────────

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Mot de passe actuel et nouveau mot de passe requis' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: 'Le nouveau mot de passe doit contenir au moins 8 caractères avec au moins une majuscule, un chiffre ou un caractère spécial',
      });
    }

    const result = await query('SELECT mot_de_passe FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].mot_de_passe);
    if (!isMatch) {
      await logAuditEvent({
        req, userId: req.user.id, action: 'PASSWORD_CHANGE_FAILED',
        entity: 'AUTH', status: 'FAILED', details: { reason: 'INVALID_CURRENT_PASSWORD' },
      });
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await query(
      'UPDATE users SET mot_de_passe = $1, password_changed_at = NOW() WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    // Révoquer tous les refresh tokens de cet utilisateur
    await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [req.user.id]);
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    await logAuditEvent({
      req, userId: req.user.id, action: 'PASSWORD_CHANGED', entity: 'AUTH', status: 'SUCCESS',
    });

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    logger.error('Erreur changePassword:', error);
    res.status(500).json({ message: safeError(error) });
  }
};

// ── Me ─────────────────────────────────────────────────────────────────────────

exports.getMe = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nom, prenom, email, role, telephone, actif, enseignant_id, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur getMe:', error);
    res.status(500).json({ message: safeError(error) });
  }
};
