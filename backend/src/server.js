const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { testConnection, closePool } = require('./lib/db');
const { securityHeaders } = require('./middleware/securityHeaders');
const { createRateLimiter } = require('./middleware/rateLimit');
const { ensureSecuritySchema } = require('./lib/securitySchema');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./lib/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./lib/swagger');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://localhost:3002')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const apiLimiter = createRateLimiter({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '300', 10),
  name: 'api'
});

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin non autorisee par CORS: ${origin}`));
  },
  credentials: true
};

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('combined', { stream: logger.stream }));
app.use('/api', apiLimiter);

// ── Routes v1 ─────────────────────────────────────────────────────────────────
const v1 = express.Router();

v1.use('/auth',          require('./routes/auth.routes'));
v1.use('/eleves',        require('./routes/eleve.routes'));
v1.use('/enseignants',   require('./routes/enseignant.routes'));
v1.use('/classes',       require('./routes/classe.routes'));
v1.use('/matieres',      require('./routes/matiere.routes'));
v1.use('/notes',         require('./routes/note.routes'));
v1.use('/absences',      require('./routes/absence.routes'));
v1.use('/paiements',     require('./routes/paiement.routes'));
v1.use('/rapports',      require('./routes/rapport.routes'));
v1.use('/annees',        require('./routes/annee.routes'));
v1.use('/classe-matieres', require('./routes/classe-matiere.routes'));
v1.use('/search',        require('./routes/search.routes'));
v1.use('/users',         require('./routes/users.routes'));
v1.use('/backup',        require('./routes/backup.routes'));
v1.use('/audit-logs',    require('./routes/auditLog.routes'));
v1.use('/docs',          swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
v1.get('/docs.json',     (req, res) => res.json(swaggerSpec));

app.use('/api/v1', v1);

// Rétro-compatibilité : /api/* → /api/v1/*  (sans redirect, simple alias)
app.use('/api', v1);

app.use('/health', require('./routes/health.routes'));

app.get('/', (req, res) => {
  res.json({
    message: 'API de Gestion d Etablissement Scolaire - Togo',
    version: '3.0.0',
    api: '/api/v1',
    docs: '/api/v1/docs',
    status: 'actif'
  });
});

// ── Gestionnaire d'erreurs centralisé ────────────────────────────────────────
app.use(errorHandler);

// ── Nettoyage refresh tokens ──────────────────────────────────────────────────
async function cleanupExpiredTokens() {
  const { query: dbQuery } = require('./lib/db');
  try {
    const result = await dbQuery(
      `DELETE FROM refresh_tokens WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`
    );
    if (result.rowCount > 0) {
      logger.debug(`Nettoyage refresh_tokens : ${result.rowCount} entrées supprimées`);
    }
  } catch (err) {
    logger.warn('Nettoyage refresh_tokens échoué', { error: err.message });
  }
}

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
