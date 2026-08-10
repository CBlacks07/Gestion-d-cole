// Sauvegarde automatique par email, scopée à l'école de l'utilisateur —
// contrairement à /backup/auto/* (dump multi-écoles, SUPER_ADMIN
// uniquement, disque local), ceci est accessible à un ADMIN/DIRECTEUR de
// son établissement et fonctionne sur Vercel (aucune écriture disque, tout
// est en base + email).
const { queryScoped } = require('../lib/db');
const logger = require('../lib/logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_SETTINGS = {
  enabled: false,
  frequency: 'weekly',
  customEmail: null,
  lastSentAt: null,
  lastStatus: null,
  lastError: null,
};

const toApi = (row) => ({
  enabled: row?.enabled ?? DEFAULT_SETTINGS.enabled,
  frequency: row?.frequency ?? DEFAULT_SETTINGS.frequency,
  customEmail: row?.custom_email ?? null,
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

    // Chaîne vide ou absente = pas de champ personnalisé (retombe sur les
    // ADMIN/DIRECTEUR de l'école, voir lib/scheduledBackupEmail.js).
    const rawEmail = typeof req.body?.customEmail === 'string' ? req.body.customEmail.trim() : '';
    if (rawEmail && !EMAIL_RE.test(rawEmail)) {
      return res.status(400).json({ message: 'Adresse email invalide' });
    }
    const customEmail = rawEmail || null;

    const result = await queryScoped(
      req.ecoleId,
      `INSERT INTO ecole_backup_settings (ecole_id, enabled, frequency, custom_email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ecole_id) DO UPDATE SET enabled = $2, frequency = $3, custom_email = $4
       RETURNING *`,
      [req.ecoleId, enabled, frequency, customEmail]
    );

    res.json({ message: 'Paramètres mis à jour', settings: toApi(result.rows[0]) });
  } catch (error) {
    logger.error('Erreur updateBackupEmailSettings:', error.message);
    res.status(500).json({ message: 'Erreur lors de la mise à jour des paramètres' });
  }
};
