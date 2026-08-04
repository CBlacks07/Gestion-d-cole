const express = require('express');
const router = express.Router();
const classeMatiereController = require('../controllers/classe-matiere.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/classe/:classeId', classeMatiereController.getMatieresClasse);
router.post('/', authorize('admin', 'directeur'), classeMatiereController.addMatiereToClasse);
router.put('/:id', authorize('admin', 'directeur'), classeMatiereController.updateMatiereClasse);
router.delete('/:id', authorize('admin', 'directeur'), classeMatiereController.removeMatiereFromClasse);

module.exports = router;
