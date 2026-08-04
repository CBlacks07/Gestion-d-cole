const { query } = require('./db');
const { getClientIp } = require('../middleware/rateLimit');
const logger = require('./logger');

const logAuditEvent = async ({
  req,
  userId = null,
  action,
  entity = null,
  entityId = null,
  status = 'SUCCESS',
  details = null
}) => {
  if (!action) return;

  try {
    const ipAddress = req ? getClientIp(req) : null;
    const userAgent = req?.headers?.['user-agent'] || null;

    await query(
      `INSERT INTO audit_logs
       (user_id, action, entity, entity_id, status, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        action,
        entity,
        entityId,
        status,
        details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    // Never break the main flow because of audit logging.
    logger.error('Audit log error:', { message: error.message });
  }
};

module.exports = {
  logAuditEvent
};
