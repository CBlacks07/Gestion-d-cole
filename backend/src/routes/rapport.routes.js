const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getRapportClasse,
  getRapportFinancier,
  getRapportAssiduite
} = require('../controllers/rapport.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', getDashboard);
router.get('/classe/:classeId', getRapportClasse);
router.get('/financier', authorize('admin', 'directeur'), getRapportFinancier);
router.get('/assiduite', getRapportAssiduite);

module.exports = router;
