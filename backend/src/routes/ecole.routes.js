const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { createEcole } = require('../controllers/ecole.controller');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

/**
 * @swagger
 * /ecoles:
 *   post:
 *     summary: Créer un nouvel établissement (self-service) + son premier compte ADMIN
 *     tags: [Ecoles]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ecoleNom, nom, prenom, email, motDePasse, codeInvitation]
 *             properties:
 *               ecoleNom: { type: string }
 *               ecoleSlug: { type: string, description: "Auto-généré depuis ecoleNom si absent" }
 *               nom: { type: string }
 *               prenom: { type: string }
 *               email: { type: string }
 *               motDePasse: { type: string, minLength: 8 }
 *               telephone: { type: string }
 *               codeInvitation: { type: string, description: "Doit correspondre à SIGNUP_INVITE_CODE côté serveur" }
 *     responses:
 *       201:
 *         description: École + compte ADMIN créés, retourne un access token
 *       400:
 *         description: Données invalides ou email/identifiant déjà pris
 *       403:
 *         description: Code d'invitation invalide ou manquant
 */
const createEcoleLimiter = createRateLimiter({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: 10,
  name: 'creation-ecole',
  keyGenerator: (req) => getClientIp(req),
});

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const createEcoleRules = [
  body('ecoleNom').notEmpty().withMessage("Le nom de l'établissement est requis").trim().escape(),
  body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
  body('motDePasse').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('nom').notEmpty().withMessage('Nom requis').trim().escape(),
  body('prenom').notEmpty().withMessage('Prénom requis').trim().escape(),
  body('codeInvitation').notEmpty().withMessage("Code d'invitation requis"),
];

router.post('/', createEcoleLimiter, createEcoleRules, handleValidation, createEcole);

module.exports = router;
