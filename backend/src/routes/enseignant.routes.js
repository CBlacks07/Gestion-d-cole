const express = require('express');
const router = express.Router();
const {
  getEnseignants,
  getEnseignantById,
  createEnseignant,
  updateEnseignant,
  deleteEnseignant
} = require('../controllers/enseignant.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'directeur', 'secretaire'));

router.route('/')
  .get(getEnseignants)
  .post(authorize('admin', 'directeur'), createEnseignant);

router.route('/:id')
  .get(getEnseignantById)
  .put(authorize('admin', 'directeur'), updateEnseignant)
  .delete(authorize('admin', 'directeur'), deleteEnseignant);

module.exports = router;
