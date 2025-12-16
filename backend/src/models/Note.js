const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  eleve: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Eleve',
    required: true
  },
  matiere: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Matiere',
    required: true
  },
  classe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classe',
    required: true
  },
  enseignant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enseignant'
  },

  // Types d'évaluations
  typeEvaluation: {
    type: String,
    enum: ['Devoir', 'Composition', 'Interrogation', 'TP', 'Examen'],
    required: true
  },

  periode: {
    type: String,
    enum: ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'],
    required: true
  },

  anneeScolaire: {
    type: String,
    required: true
  },

  note: {
    type: Number,
    required: true,
    min: 0,
    max: 20
  },

  noteMax: {
    type: Number,
    default: 20
  },

  coefficient: {
    type: Number,
    default: 1
  },

  commentaire: String,

  dateEvaluation: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index composé pour éviter les doublons
noteSchema.index({ eleve: 1, matiere: 1, typeEvaluation: 1, periode: 1, anneeScolaire: 1 });

module.exports = mongoose.model('Note', noteSchema);
