// Sauvegarde automatique par email, scopée à l'école de l'utilisateur —
// contrairement à /backup/auto/* (dump multi-écoles, SUPER_ADMIN
// uniquement, disque local), ceci est accessible à un ADMIN/DIRECTEUR de
// son établissement et fonctionne sur Vercel (aucune écriture disque, tout
// est en base + email).
const { queryScoped } = require('../lib/db');
const logger = require('../lib/logger');

const DEFAULT_SETTINGS = {
  enabled: false,
  frequency: 'weekly',
  lastSentAt: null,
  lastStatus: null,
  lastError: null,
};

const toApi = (row) => ({
  enabled: row?.enabled ?? DEFAULT_SETTINGS.enabled,
  frequency: row?.frequency ?? DEFAULT_SETTINGS.frequency,
  lastSentAt: row?.last_sent_at ?? null,
  lastStatus: row?.last_status ?? null,
  lastError: row?.last_error ?? null,
});

exports.getBackupEmailSettings = async (req, res) => {
  try {
    const result = await queryScoped(
      req.ecoleId,
      'SELECT * FROM ecole_backup_settings WHERE ecole_id = $1',
      [req.ecoleId]
    );
    res.json(toApi(result.rows[0]));
  } catch (error) {
    logger.error('Erreur getBackupEmailSettings:', error.message);
    res.status(500).json({ message: 'Erreur lors du chargement des paramètres' });
  }
};

exports.updateBackupEmailSettings = async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const frequency = ['daily', 'weekly', 'monthly'].includes(req.body?.frequency)
      ? req.body.frequency
      : 'weekly';

    const result = await queryScoped(
      req.ecoleId,
      `INSERT INTO ecole_backup_settings (ecole_id, enabled, frequency)
       VALUES ($1, $2, $3)
       ON CONFLICT (ecole_id) DO UPDATE SET enabled = $2, frequency = $3
       RETURNING *`,
      [req.ecoleId, enabled, frequency]
    );

    res.json({ message: 'Paramètres mis à jour', settings: toApi(result.rows[0]) });
  } catch (error) {
    logger.error('Erreur updateBackupEmailSettings:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour des paramètres' });
  }
};
