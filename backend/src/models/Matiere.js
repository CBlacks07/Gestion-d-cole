const mongoose = require('mongoose');

const matiereSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: String,
  coefficient: {
    type: Number,
    default: 1,
    min: 1
  },
  niveaux: [{
    type: String,
    enum: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale']
  }],
  cycles: [{
    type: String,
    enum: ['Primaire', 'Collège', 'Lycée']
  }],
  couleur: {
    type: String,
    default: '#3B82F6'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Matiere', matiereSchema);
