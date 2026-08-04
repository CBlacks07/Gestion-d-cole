const express = require('express');
const router = express.Router();
const matiereController = require('../controllers/matiere.controller');
const { protect, authorize } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes CRUD pour les matières
router.get('/', matiereController.getMatieres);
router.get('/:id', matiereController.getMatiereById);
router.post('/', authorize('admin', 'directeur'), matiereController.createMatiere);
router.put('/:id', authorize('admin', 'directeur'), matiereController.updateMatiere);
router.delete('/:id', authorize('admin', 'directeur'), matiereController.deleteMatiere);

module.exports = router;
