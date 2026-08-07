// Point d'entrée pour un déploiement classique (Docker/VM) : process
// long-vivant, app.listen(), nettoyage périodique via setInterval.
// Pour Vercel, voir api/index.js à la racine du dossier backend (pas
// d'app.listen() ni de setInterval là-bas — un process serverless n'est
// pas long-vivant).
const app = require('./app');
const { testConnection, closePool } = require('./lib/db');
const { ensureSecuritySchema } = require('./lib/securitySchema');
const { cleanupExpiredTokens } = require('./lib/tokenCleanup');
const logger = require('./lib/logger');

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      const message = 'JWT_SECRET absent ou trop court (minimum recommande: 32 caracteres)';
      if (isProduction) throw new Error(message);
      logger.warn(message);
    }

    const connected = await testConnection();
    if (!connected) {
      logger.error('Impossible de se connecter a PostgreSQL');
      process.exit(1);
    }

    await ensureSecuritySchema();

    // Nettoyage initial + cron toutes les heures
    await cleanupExpiredTokens();
    setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
      logger.info(`Serveur démarré sur le port ${PORT}`);
      logger.info(`API v1: http://localhost:${PORT}/api/v1`);
      logger.info(`Docs Swagger: http://localhost:${PORT}/api/v1/docs`);
    });
  } catch (error) {
    logger.error('Erreur au démarrage:', { message: error.message });
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Arrêt du serveur (SIGINT)...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Arrêt du serveur (SIGTERM)...');
  await closePool();
  process.exit(0);
});

startServer();

module.exports = app;
