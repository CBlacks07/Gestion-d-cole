const { query } = require('../lib/db');
const logger = require('../lib/logger');

const safeError = (error) =>
  process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : error.message;

// @desc    Lister les logs d'audit (paginés, filtrables)
// @route   GET /api/audit-logs
exports.getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = (page - 1) * limit;
    const { action, userId, dateFrom, dateTo } = req.query;

    // audit_logs n'est pas sous RLS forcée (ecole_id nullable pour les
    // actions plateforme) : filtre explicite requis ici, voir
    // migration_multi_ecole.sql.
    const conditions = ['(al.ecole_id = $1)'];
    const values = [req.ecoleId];
    let idx = 2;

    if (action) { conditions.push(`al.action = $${idx++}`); values.push(action.toUpperCase()); }
    if (userId) { conditions.push(`al.user_id = $${idx++}`); values.push(userId); }
    if (dateFrom) { conditions.push(`al.created_at >= $${idx++}`); values.push(dateFrom); }
    if (dateTo) { conditions.push(`al.created_at <= $${idx++}`); values.push(dateTo + ' 23:59:59'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM audit_logs al ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataValues = [...values, limit, offset];
    const result = await query(
      `SELECT al.id, al.action, al.entity, al.entity_id, al.status,
              al.details, al.ip_address, al.created_at,
              u.nom, u.prenom, u.email, u.role
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      dataValues
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Erreur getAuditLogs:', error);
    res.status(500).json({ message: safeError(error) });
  }
};

// @desc    Lister les actions distinctes (pour filtre)
// @route   GET /api/audit-logs/actions
exports.getAuditActions = async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT action FROM audit_logs WHERE ecole_id = $1 ORDER BY action`,
      [req.ecoleId]
    );
    res.json(result.rows.map(r => r.action));
  } catch (error) {
    logger.error('Erreur getAuditActions:', error);
    res.status(500).json({ message: safeError(error) });
  }
};
