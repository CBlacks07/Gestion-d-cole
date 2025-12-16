const mongoose = require('mongoose');

const enseignantSchema = new mongoose.Schema({
  matricule: {
    type: String,
    required: true,
    unique: true
  },
  nom: {
    type: String,
    required: true,
    trim: true
  },
  prenom: {
    type: String,
    required: true,
    trim: true
  },
  dateNaissance: {
    type: Date,
    required: true
  },
  sexe: {
    type: String,
    enum: ['M', 'F'],
    required: true
  },
  telephone: {
    type: String,
    required: true
  },
  email: String,
  adresse: String,
  photo: String,

  // Informations professionnelles
  diplomes: [{
    intitule: String,
    etablissement: String,
    anneeObtention: Number
  }],

  specialites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Matiere'
  }],

  classesAssignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classe'
  }],

  dateRecrutement: {
    type: Date,
    required: true
  },

  statut: {
    type: String,
    enum: ['actif', 'conge', 'suspendu', 'demissionne'],
    default: 'actif'
  },

  typeContrat: {
    type: String,
    enum: ['permanent', 'vacataire', 'contractuel'],
    default: 'permanent'
  },

  salaire: Number
}, {
  timestamps: true
});

enseignantSchema.index({ nom: 'text', prenom: 'text', matricule: 'text' });

module.exports = mongoose.model('Enseignant', enseignantSchema);
