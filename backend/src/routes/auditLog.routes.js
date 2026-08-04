const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditActions } = require('../controllers/auditLog.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin'), getAuditLogs);
router.get('/actions', protect, authorize('admin'), getAuditActions);

module.exports = router;
