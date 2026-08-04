const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/backup.controller');

const adminOnly = [protect, authorize('ADMIN')];
const admDir = [protect, authorize('ADMIN', 'DIRECTEUR')];

// Instant download
router.get('/', admDir, ctrl.exportBackup);

// Restore from uploaded JSON
router.post('/restore', adminOnly, ctrl.restoreBackup);

// Auto-backup settings + file list
router.get('/auto/settings', admDir, ctrl.getAutoSettings);
router.put('/auto/settings', adminOnly, ctrl.updateAutoSettings);

// Trigger immediate backup now
router.post('/auto/now', admDir, ctrl.triggerAutoBackup);

// Restore test (safe validation on latest or selected backup)
router.get('/auto/restore-test/status', admDir, ctrl.getRestoreTestStatus);
router.post('/auto/restore-test', adminOnly, ctrl.triggerRestoreTest);

// Download / delete a saved backup file
router.get('/auto/files/:filename', admDir, ctrl.downloadAutoBackup);
router.delete('/auto/files/:filename', adminOnly, ctrl.deleteAutoBackup);

module.exports = router;
