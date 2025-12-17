const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

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
    version: '2.0.0',
    database: 'PostgreSQL',
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

// Connexion à la base de données et démarrage du serveur
async function main() {
  try {
    // Test de la connexion à la base de données
    await prisma.$connect();
    console.log('✅ Connecté à PostgreSQL');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Erreur de connexion à PostgreSQL:', error);
    process.exit(1);
  }
}

// Gestion de la fermeture propre
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main();

module.exports = { app, prisma };
