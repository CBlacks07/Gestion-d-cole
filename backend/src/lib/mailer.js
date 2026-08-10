// Envoi d'email transactionnel (Resend). Fail-closed : sans RESEND_API_KEY
// configurée, on journalise et on retourne un échec propre plutôt que de
// planter — cohérent avec SIGNUP_INVITE_CODE / CRON_SECRET ailleurs dans
// ce projet.
const logger = require('./logger');

let resendClient = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  if (!resendClient) {
    // Chargement paresseux : évite de charger la lib au démarrage du
    // serveur si l'envoi d'email n'est jamais utilisé (routes internes
    // uniquement, déclenchées par cron).
    const { Resend } = require('resend');
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

/**
 * @param {Object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 * @param {{ filename: string, content: Buffer|string }[]} [opts.attachments]
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
async function sendEmail({ to, subject, html, text, attachments }) {
  const client = getResendClient();
  if (!client) {
    logger.warn('[Mailer] RESEND_API_KEY non configurée — email non envoyé', { to, subject });
    return { sent: false, error: 'RESEND_API_KEY non configurée' };
  }

  const from = process.env.BACKUP_EMAIL_FROM || 'SchoolTogo <onboarding@resend.dev>';

  try {
    const result = await client.emails.send({
      from,
      to,
      subject,
      html,
      text,
      attachments,
    });

    if (result.error) {
      logger.error('[Mailer] échec envoi email:', result.error);
      return { sent: false, error: result.error.message || String(result.error) };
    }

    return { sent: true };
  } catch (error) {
    logger.error('[Mailer] erreur envoi email:', error.message);
    return { sent: false, error: error.message };
  }
}

module.exports = { sendEmail };
