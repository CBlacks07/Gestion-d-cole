const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/backup.controller');

const adminOnly = [protect, authorize('ADMIN')];
const admDir = [protect, authorize('ADMIN', 'DIRECTEUR')];
// Les sauvegardes planifiées (cron) couvrent TOUTES les écoles dans un
// même fichier (pas de scoping par ecole_id) : réservées à SUPER_ADMIN pour
// ne jamais exposer les données d'une école à l'ADMIN d'une autre.
const superAdminOnly = [protect, authorize('SUPER_ADMIN')];

// Sur Vercel/serverless, ce sous-système (fichiers locaux + node-cron) ne
// peut pas fonctionner (disque en lecture seule, pas de process
// long-vivant) : on répond clairement plutôt que de laisser une erreur
// disque brute remonter. `exportBackup`/`restoreBackup` (par école, sans
// écriture disque) restent disponibles partout, donc en dehors de ce garde.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const blockOnServerless = (req, res, next) => {
  if (isServerless) {
    return res.status(501).json({
      message: "Sauvegarde planifiée indisponible sur ce déploiement (nécessite un disque persistant). Utilisez /backup pour un export/import manuel par école, ou les sauvegardes automatiques de Neon.",
    });
  }
  next();
};

// Instant download — scopé à l'école de l'utilisateur (voir backup.controller.js)
router.get('/', admDir, ctrl.exportBackup);

// Restore from uploaded JSON — scopé à l'école de l'utilisateur (ne touche jamais les autres écoles)
router.post('/restore', adminOnly, ctrl.restoreBackup);

// Auto-backup settings + file list (dump multi-écoles)
router.get('/auto/settings', superAdminOnly, blockOnServerless, ctrl.getAutoSettings);
router.put('/auto/settings', superAdminOnly, blockOnServerless, ctrl.updateAutoSettings);

// Trigger immediate backup now (dump multi-écoles)
router.post('/auto/now', superAdminOnly, blockOnServerless, ctrl.triggerAutoBackup);

// Restore test (safe validation on latest or selected backup, dump multi-écoles)
router.get('/auto/restore-test/status', superAdminOnly, blockOnServerless, ctrl.getRestoreTestStatus);
router.post('/auto/restore-test', superAdminOnly, blockOnServerless, ctrl.triggerRestoreTest);

// Download / delete a saved backup file (dump multi-écoles)
router.get('/auto/files/:filename', superAdminOnly, blockOnServerless, ctrl.downloadAutoBackup);
router.delete('/auto/files/:filename', superAdminOnly, blockOnServerless, ctrl.deleteAutoBackup);

module.exports = router;
