const express = require('express');
const router = express.Router();
const {
  getClasses,
  getClasseById,
  createClasse,
  updateClasse,
  deleteClasse
} = require('../controllers/classe.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getClasses)
  .post(authorize('admin', 'directeur'), createClasse);

router.route('/:id')
  .get(getClasseById)
  .put(authorize('admin', 'directeur'), updateClasse)
  .delete(authorize('admin', 'directeur'), deleteClasse);

module.exports = router;
