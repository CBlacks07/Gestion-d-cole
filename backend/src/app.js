// Création et configuration de l'app Express — SANS app.listen().
// Point d'entrée unique partagé par :
//   - server.js (déploiement classique Docker/VM, appelle app.listen())
//   - api/index.js (déploiement Vercel serverless, exporte l'app telle quelle)
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { securityHeaders } = require('./middleware/securityHeaders');
const { createRateLimiter } = require('./middleware/rateLimit');
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
v1.use('/ecoles',        require('./routes/ecole.routes'));
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
v1.use('/internal',      require('./routes/internal.routes'));
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

module.exports = app;
