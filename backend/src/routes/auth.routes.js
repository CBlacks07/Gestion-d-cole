const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLogin'
 *     responses:
 *       200:
 *         description: Retourne access token + refresh token cookie httpOnly
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Identifiants invalides
 *       423:
 *         description: Compte verrouillé
 *
 * /auth/refresh:
 *   post:
 *     summary: Renouveler l'access token (cookie refreshToken)
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Nouveau access token + rotation du refresh token
 *       401:
 *         description: Refresh token invalide ou expiré
 *
 * /auth/logout:
 *   post:
 *     summary: Déconnexion — révoque le refresh token
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *
 * /auth/me:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Profil utilisateur
 *
 * /auth/change-password:
 *   put:
 *     summary: Changer son mot de passe (révoque tous les refresh tokens)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Mot de passe changé
 */
const { body, validationResult } = require('express-validator');
const { register, login, refresh, logout, getMe, changePassword } = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

const loginLimiter = createRateLimiter({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
  name: 'login',
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return email ? `${getClientIp(req)}:${email}` : getClientIp(req);
  }
});

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const loginRules = [
  body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
  body('motDePasse').notEmpty().withMessage('Mot de passe requis'),
];

const registerRules = [
  body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
  body('motDePasse').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('nom').notEmpty().withMessage('Nom requis').trim().escape(),
  body('prenom').notEmpty().withMessage('Prénom requis').trim().escape(),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis'),
  body('newPassword').isLength({ min: 8 }).withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères'),
];

router.post('/register', protect, authorize('admin', 'directeur'), registerRules, handleValidation, register);
router.post('/login', loginLimiter, loginRules, handleValidation, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePasswordRules, handleValidation, changePassword);

module.exports = router;
