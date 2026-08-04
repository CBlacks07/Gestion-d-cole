const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /eleves:
 *   get:
 *     summary: Lister les élèves (paginé)
 *     tags: [Élèves]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Recherche par nom, prénom ou matricule
 *       - in: query
 *         name: classe
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [ACTIF, INACTIF, DIPLOME, TRANSFERE] }
 *       - in: query
 *         name: anneeScolaire
 *         schema: { type: string, example: '2025-2026' }
 *     responses:
 *       200:
 *         description: Liste paginée des élèves
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Eleve'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *   post:
 *     summary: Créer un élève
 *     tags: [Élèves]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Eleve'
 *     responses:
 *       201:
 *         description: Élève créé
 *
 * /eleves/{id}:
 *   get:
 *     summary: Obtenir un élève par ID
 *     tags: [Élèves]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détail de l'élève
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Eleve'
 *       404:
 *         description: Élève non trouvé
 *   put:
 *     summary: Modifier un élève
 *     tags: [Élèves]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Élève modifié
 *   delete:
 *     summary: Supprimer un élève
 *     tags: [Élèves]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Supprimé avec succès
 */
const {
  getEleves,
  getEleveById,
  createEleve,
  updateEleve,
  deleteEleve,
  getElevesStats,
  importEleves
} = require('../controllers/eleve.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getEleves)
  .post(authorize('admin', 'directeur', 'secretaire'), createEleve);

router.get('/stats', authorize('admin', 'directeur', 'secretaire'), getElevesStats);
router.post('/batch', authorize('admin', 'directeur', 'secretaire'), importEleves);

router.route('/:id')
  .get(getEleveById)
  .put(authorize('admin', 'directeur', 'secretaire'), updateEleve)
  .delete(authorize('admin', 'directeur'), deleteEleve);

module.exports = router;
