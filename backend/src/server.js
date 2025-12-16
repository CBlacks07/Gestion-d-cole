const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
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
    version: '1.0.0',
    status: 'actif'
  });
});

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connecté à MongoDB');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Erreur de connexion à MongoDB:', err);
    process.exit(1);
  });

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Une erreur est survenue',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

module.exports = app;
