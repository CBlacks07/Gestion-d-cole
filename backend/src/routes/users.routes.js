const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { getUsers, updateUser, deleteUser } = require('../controllers/users.controller');
const { protect, authorize } = require('../middleware/auth');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const updateUserRules = [
  param('id').isUUID().withMessage('Identifiant invalide'),
  body('nom').optional().trim().escape().isLength({ min: 1 }).withMessage('Nom invalide'),
  body('prenom').optional().trim().escape().isLength({ min: 1 }).withMessage('Prénom invalide'),
  body('telephone').optional().trim(),
  body('role').optional().isIn(['ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'SECRETAIRE']).withMessage('Rôle invalide'),
  body('actif').optional().isBoolean().withMessage('Statut actif invalide'),
];

router.get('/', protect, authorize('admin', 'directeur'), getUsers);
router.put('/:id', protect, authorize('admin', 'directeur'), updateUserRules, handleValidation, updateUser);
router.delete('/:id', protect, authorize('admin'), [param('id').isUUID().withMessage('Identifiant invalide')], handleValidation, deleteUser);

module.exports = router;
