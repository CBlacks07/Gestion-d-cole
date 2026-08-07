const { query } = require('./db');
const logger = require('./logger');

// Partagé par :
//  - server.js (déploiement classique) : appelé une fois au démarrage puis
//    toutes les heures via setInterval.
//  - routes/internal.routes.js (Vercel) : pas de process long-vivant donc
//    pas de setInterval fiable — déclenché par un Vercel Cron Job qui
//    appelle GET /api/v1/internal/cleanup-tokens sur un planning.
const cleanupExpiredTokens = async () => {
  try {
    const result = await query(
      `DELETE FROM refresh_tokens WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`
    );
    if (result.rowCount > 0) {
      logger.debug(`Nettoyage refresh_tokens : ${result.rowCount} entrées supprimées`);
    }
    return result.rowCount;
  } catch (err) {
    logger.warn('Nettoyage refresh_tokens échoué', { error: err.message });
    throw err;
  }
};

module.exports = { cleanupExpiredTokens };
