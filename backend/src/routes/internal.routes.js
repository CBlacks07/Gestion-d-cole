// Routes internes déclenchées par un planificateur (Vercel Cron), pas par un
// utilisateur. Protégées par un secret partagé plutôt que par `protect`
// (pas de session utilisateur dans ce contexte) — voir CRON_SECRET.
const express = require('express');
const router = express.Router();
const { cleanupExpiredTokens } = require('../lib/tokenCleanup');
const { runScheduledBackupEmails } = require('../lib/scheduledBackupEmail');
const logger = require('../lib/logger');

const requireCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Pas de secret configuré = route désactivée (fail closed), pour ne
    // jamais exposer un endpoint interne non protégé par oubli.
    return res.status(404).end();
  }

  const auth = req.headers.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (provided !== secret) {
    return res.status(401).json({ message: 'Non autorisé' });
  }

  next();
};

/**
 * @swagger
 * /internal/cleanup-tokens:
 *   get:
 *     summary: Purge les refresh tokens expirés/révoqués (usage Vercel Cron uniquement)
 *     tags: [Internal]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         description: "Bearer <CRON_SECRET>"
 *     responses:
 *       200: { description: Nettoyage effectué }
 *       401: { description: Secret invalide }
 *       404: { description: CRON_SECRET non configuré, route désactivée }
 */
router.get('/cleanup-tokens', requireCronSecret, async (req, res) => {
  try {
    const deleted = await cleanupExpiredTokens();
    res.json({ message: 'Nettoyage effectué', deleted });
  } catch (error) {
    logger.error('Erreur cleanup-tokens (cron):', { message: error.message });
    res.status(500).json({ message: 'Erreur lors du nettoyage' });
  }
});

/**
 * @swagger
 * /internal/scheduled-backup-emails:
 *   get:
 *     summary: Envoie la sauvegarde par email aux écoles dues (usage Vercel Cron uniquement)
 *     tags: [Internal]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         description: "Bearer <CRON_SECRET>"
 *     responses:
 *       200: { description: Job exécuté }
 *       401: { description: Secret invalide }
 *       404: { description: CRON_SECRET non configuré, route désactivée }
 */
router.get('/scheduled-backup-emails', requireCronSecret, async (req, res) => {
  try {
    const summary = await runScheduledBackupEmails();
    res.json({ message: 'Job de sauvegarde par email exécuté', ...summary });
  } catch (error) {
    logger.error('Erreur scheduled-backup-emails (cron):', { message: error.message });
    res.status(500).json({ message: 'Erreur lors du job de sauvegarde par email' });
  }
});

module.exports = router;
