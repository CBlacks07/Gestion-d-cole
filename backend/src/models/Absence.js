const mongoose = require('mongoose');

const absenceSchema = new mongoose.Schema({
  eleve: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Eleve',
    required: true
  },
  classe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classe',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  matiere: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Matiere'
  },
  periode: {
    type: String,
    enum: ['Matin', 'Après-midi', 'Toute la journée'],
    default: 'Toute la journée'
  },
  justifiee: {
    type: Boolean,
    default: false
  },
  motif: String,
  justificatif: String, // URL du document justificatif
  anneeScolaire: {
    type: String,
    required: true
  },
  enregistrePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

absenceSchema.index({ eleve: 1, date: 1 });

module.exports = mongoose.model('Absence', absenceSchema);
