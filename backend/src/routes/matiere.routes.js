const express = require('express');
const router = express.Router();
const {
  getMatieres,
  getMatiereById,
  createMatiere,
  updateMatiere,
  deleteMatiere
} = require('../controllers/matiere.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getMatieres)
  .post(authorize('admin', 'directeur'), createMatiere);

router.route('/:id')
  .get(getMatiereById)
  .put(authorize('admin', 'directeur'), updateMatiere)
  .delete(authorize('admin', 'directeur'), deleteMatiere);

module.exports = router;
