const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getRapportClasse,
  getRapportFinancier,
  getRapportAssiduite,
  getRapportNotes
} = require('../controllers/rapport.controller');
const { generateBulletinPdf } = require('../controllers/bulletin.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

/**
 * @swagger
 * /rapports/bulletin-pdf:
 *   get:
 *     summary: Génère un bulletin de notes en PDF côté serveur
 *     tags: [Rapports]
 *     parameters:
 *       - in: query
 *         name: eleveId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: anneeScolaire
 *         required: true
 *         schema: { type: string, example: '2025-2026' }
 *       - in: query
 *         name: periode
 *         schema: { type: string, example: 'PREMIER_TRIMESTRE' }
 *     responses:
 *       200:
 *         description: Fichier PDF bulletin
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/bulletin-pdf', authorize('admin', 'directeur', 'secretaire', 'enseignant'), generateBulletinPdf);

router.get('/dashboard', authorize('admin', 'directeur', 'secretaire', 'enseignant'), getDashboard);
router.get('/classe/:classeId', authorize('admin', 'directeur', 'secretaire', 'enseignant'), getRapportClasse);
router.get('/financier', authorize('admin', 'directeur'), getRapportFinancier);
router.get('/assiduite', authorize('admin', 'directeur', 'secretaire'), getRapportAssiduite);
router.get('/notes', authorize('admin', 'directeur', 'secretaire'), getRapportNotes);

module.exports = router;
