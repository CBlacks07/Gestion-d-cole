const express = require('express');
const router = express.Router();
const {
  getEleves,
  getEleveById,
  createEleve,
  updateEleve,
  deleteEleve,
  getElevesStats
} = require('../controllers/eleve.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getEleves)
  .post(authorize('admin', 'directeur', 'secretaire'), createEleve);

router.get('/stats', getElevesStats);

router.route('/:id')
  .get(getEleveById)
  .put(authorize('admin', 'directeur', 'secretaire'), updateEleve)
  .delete(authorize('admin', 'directeur'), deleteEleve);

module.exports = router;
