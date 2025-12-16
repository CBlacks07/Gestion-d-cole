const mongoose = require('mongoose');

const classeSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true
  },
  niveau: {
    type: String,
    required: true,
    enum: [
      // Primaire
      'CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2',
      // Collège
      '6ème', '5ème', '4ème', '3ème',
      // Lycée
      '2nde', '1ère', 'Terminale'
    ]
  },
  cycle: {
    type: String,
    required: true,
    enum: ['Primaire', 'Collège', 'Lycée']
  },
  section: {
    type: String,
    // Pour le lycée: A, C, D, etc.
    trim: true
  },
  anneeScolaire: {
    type: String,
    required: true
  },
  enseignantPrincipal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enseignant'
  },
  effectifMax: {
    type: Number,
    default: 50
  },
  salle: String,
  fraisScolarite: {
    montantInscription: {
      type: Number,
      default: 0
    },
    montantMensuel: {
      type: Number,
      default: 0
    },
    devise: {
      type: String,
      default: 'XOF' // Franc CFA
    }
  }
}, {
  timestamps: true
});

// Virtuel pour obtenir les élèves de la classe
classeSchema.virtual('eleves', {
  ref: 'Eleve',
  localField: '_id',
  foreignField: 'classe'
});

// Virtuel pour obtenir l'effectif actuel
classeSchema.virtual('effectifActuel', {
  ref: 'Eleve',
  localField: '_id',
  foreignField: 'classe',
  count: true
});

classeSchema.set('toJSON', { virtuals: true });
classeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Classe', classeSchema);
