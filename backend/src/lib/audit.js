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
    const ecoleId = req?.ecoleId || null;

    await query(
      `INSERT INTO audit_logs
       (user_id, action, entity, entity_id, status, details, ip_address, user_agent, ecole_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        action,
        entity,
        entityId,
        status,
        details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent,
        ecoleId
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
