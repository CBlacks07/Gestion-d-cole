// Job déclenché par un Vercel Cron (voir routes/internal.routes.js) :
// parcourt les écoles ayant activé la sauvegarde automatique par email
// (ecole_backup_settings), génère l'export JSON scopé de chacune (réutilise
// generateBackupData de backup.controller.js) et l'envoie par email aux
// ADMIN/DIRECTEUR actifs de l'école concernée.
const { query, queryBypassRls } = require('../lib/db');
const { generateBackupData } = require('../controllers/backup.controller');
const { sendEmail } = require('./mailer');
const logger = require('./logger');

const FREQUENCY_INTERVALS = {
  daily: '1 day',
  weekly: '7 days',
  monthly: '1 month',
};

// Écoles dues : activées, et jamais envoyées OU dernier envoi plus vieux
// que leur fréquence choisie. `queryBypassRls` est nécessaire ici : ce job
// n'a pas de req.ecoleId (il tourne pour toutes les écoles), c'est le seul
// contexte légitime pour l'échappatoire bypass_rls (voir migration_multi_ecole.sql).
async function findDueEcoles() {
  const result = await queryBypassRls(
    `SELECT s.ecole_id, s.frequency, e.nom AS ecole_nom
     FROM ecole_backup_settings s
     JOIN ecoles e ON e.id = s.ecole_id
     WHERE s.enabled = true
       AND e.statut = 'ACTIF'
       AND (
         s.last_sent_at IS NULL
         OR (s.frequency = 'daily'   AND s.last_sent_at < now() - INTERVAL '1 day')
         OR (s.frequency = 'weekly'  AND s.last_sent_at < now() - INTERVAL '7 days')
         OR (s.frequency = 'monthly' AND s.last_sent_at < now() - INTERVAL '1 month')
       )`
  );
  return result.rows;
}

async function getRecipients(ecoleId) {
  // `users` n'est pas sous RLS forcée (voir migration_multi_ecole.sql) —
  // un filtre explicite ecole_id suffit avec `query` brut.
  const result = await query(
    `SELECT email, prenom, nom FROM users
     WHERE ecole_id = $1 AND role IN ('ADMIN', 'DIRECTEUR') AND actif = true`,
    [ecoleId]
  );
  return result.rows;
}

async function markResult(ecoleId, status, error) {
  await queryBypassRls(
    `UPDATE ecole_backup_settings
     SET last_sent_at = now(), last_status = $2, last_error = $3
     WHERE ecole_id = $1`,
    [ecoleId, status, error || null]
  );
}

async function sendBackupForEcole(ecole) {
  const recipients = await getRecipients(ecole.ecole_id);
  if (recipients.length === 0) {
    await markResult(ecole.ecole_id, 'FAILED', 'Aucun destinataire (ADMIN/DIRECTEUR actif) trouvé');
    return { ecoleId: ecole.ecole_id, ecoleNom: ecole.ecole_nom, sent: false, error: 'Aucun destinataire' };
  }

  const data = await generateBackupData('auto-email', ecole.ecole_id);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `sauvegarde_${date}.json`;
  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8');

  const totalRows = Object.values(data.tables).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0
  );

  const result = await sendEmail({
    to: recipients.map((r) => r.email),
    subject: `SchoolTogo — Sauvegarde automatique du ${date}`,
    html: `
      <p>Bonjour,</p>
      <p>Voici la sauvegarde automatique des données de <strong>${ecole.ecole_nom}</strong>,
      générée le ${date} (${totalRows} enregistrements au total).</p>
      <p>Conservez ce fichier en lieu sûr — il permet de restaurer l'intégralité
      des données de votre école depuis SchoolTogo (Configuration &gt; Sauvegarde
      &gt; Restaurer depuis un fichier).</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">Email automatique — SchoolTogo</p>
    `,
    attachments: [{ filename, content }],
  });

  await markResult(ecole.ecole_id, result.sent ? 'SUCCESS' : 'FAILED', result.error);

  return {
    ecoleId: ecole.ecole_id,
    ecoleNom: ecole.ecole_nom,
    sent: result.sent,
    error: result.error,
    recipients: recipients.length,
  };
}

async function runScheduledBackupEmails() {
  const due = await findDueEcoles();
  const results = [];

  for (const ecole of due) {
    try {
      results.push(await sendBackupForEcole(ecole));
    } catch (error) {
      logger.error(`[BackupEmail] échec pour l'école ${ecole.ecole_id}:`, error.message);
      await markResult(ecole.ecole_id, 'FAILED', error.message).catch(() => {});
      results.push({ ecoleId: ecole.ecole_id, ecoleNom: ecole.ecole_nom, sent: false, error: error.message });
    }
  }

  const sent = results.filter((r) => r.sent).length;
  logger.info(`[BackupEmail] job terminé: ${sent}/${results.length} envois réussis`);

  return { checked: due.length, sent, results };
}

module.exports = { runScheduledBackupEmails };
