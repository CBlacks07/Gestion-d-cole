const express = require('express');
const router = express.Router();
const {
  getPaiements,
  getPaiementById,
  createPaiement,
  updatePaiement,
  deletePaiement,
  getHistoriquePaiements,
  getPaiementStats,
  getSoldeEleve,
  getElevesImpayes
} = require('../controllers/paiement.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'directeur', 'secretaire'));

router.route('/')
  .get(getPaiements)
  .post(authorize('admin', 'directeur', 'secretaire'), createPaiement);

router.get('/stats', getPaiementStats);
router.get('/historique/:eleveId', getHistoriquePaiements);
router.get('/solde/:eleveId', getSoldeEleve);
router.get('/impayes', authorize('admin', 'directeur', 'secretaire'), getElevesImpayes);

router.route('/:id')
  .get(getPaiementById)
  .put(authorize('admin', 'directeur', 'secretaire'), updatePaiement)
  .delete(authorize('admin', 'directeur'), deletePaiement);

module.exports = router;
