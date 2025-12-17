const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { testConnection, closePool } = require('./lib/db');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/eleves', require('./routes/eleve.routes'));
app.use('/api/enseignants', require('./routes/enseignant.routes'));
app.use('/api/classes', require('./routes/classe.routes'));
app.use('/api/matieres', require('./routes/matiere.routes'));
app.use('/api/notes', require('./routes/note.routes'));
app.use('/api/absences', require('./routes/absence.routes'));
app.use('/api/paiements', require('./routes/paiement.routes'));
app.use('/api/rapports', require('./routes/rapport.routes'));

// Route de test
app.get('/', (req, res) => {
  res.json({
    message: 'API de Gestion d\'Établissement Scolaire - Togo',
    version: '3.0.0',
    database: 'PostgreSQL (SQL pur)',
    status: 'actif'
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Une erreur est survenue',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Démarrage du serveur
async function startServer() {
  try {
    // Test de connexion à PostgreSQL
    const connected = await testConnection();

    if (!connected) {
      console.error('❌ Impossible de se connecter à PostgreSQL');
      process.exit(1);
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`📖 Documentation: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
}

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
  console.log('\n⏹️  Arrêt du serveur...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Arrêt du serveur...');
  await closePool();
  process.exit(0);
});

startServer();

module.exports = app;
