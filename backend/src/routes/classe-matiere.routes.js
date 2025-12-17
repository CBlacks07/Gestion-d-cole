const express = require('express');
const router = express.Router();
const classeMatiereController = require('../controllers/classe-matiere.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/classe/:classeId', classeMatiereController.getMatieresClasse);
router.post('/', classeMatiereController.addMatiereToClasse);
router.put('/:id', classeMatiereController.updateMatiereClasse);
router.delete('/:id', classeMatiereController.removeMatiereFromClasse);

module.exports = router;
