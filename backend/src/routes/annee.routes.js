const express = require('express');
const router = express.Router();
const anneeController = require('../controllers/annee.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', anneeController.getAnnees);
router.get('/active', anneeController.getAnneeActive);
router.post('/', authorize('admin', 'directeur'), anneeController.createAnnee);
router.put('/:id', authorize('admin', 'directeur'), anneeController.updateAnnee);
router.put('/:id/activer', authorize('admin', 'directeur'), anneeController.activerAnnee);
router.put('/:id/cloturer', authorize('admin', 'directeur'), anneeController.cloturerAnnee);

module.exports = router;
