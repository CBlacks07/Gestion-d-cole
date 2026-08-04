const express = require('express');
const router = express.Router();
const {
  getAbsences,
  getAbsenceById,
  createAbsence,
  updateAbsence,
  deleteAbsence,
  getAbsenceStats
} = require('../controllers/absence.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'directeur', 'secretaire'));

router.route('/')
  .get(getAbsences)
  .post(authorize('admin', 'directeur', 'secretaire'), createAbsence);

router.get('/stats/:eleveId', getAbsenceStats);

router.route('/:id')
  .get(getAbsenceById)
  .put(authorize('admin', 'directeur', 'secretaire'), updateAbsence)
  .delete(authorize('admin', 'directeur'), deleteAbsence);

module.exports = router;
