const express = require('express');
const router = express.Router();
const matiereController = require('../controllers/matiere.controller');
const { protect } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes CRUD pour les matières
router.get('/', matiereController.getMatieres);
router.get('/:id', matiereController.getMatiereById);
router.post('/', matiereController.createMatiere);
router.put('/:id', matiereController.updateMatiere);
router.delete('/:id', matiereController.deleteMatiere);

module.exports = router;
