const express = require('express');
const router = express.Router();
const anneeController = require('../controllers/annee.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', anneeController.getAnnees);
router.get('/active', anneeController.getAnneeActive);
router.post('/', anneeController.createAnnee);
router.put('/:id/activer', anneeController.activerAnnee);

module.exports = router;
