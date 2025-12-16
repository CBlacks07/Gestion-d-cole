const mongoose = require('mongoose');

const eleveSchema = new mongoose.Schema({
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
  lieuNaissance: {
    type: String,
    required: true
  },
  sexe: {
    type: String,
    enum: ['M', 'F'],
    required: true
  },
  classe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classe'
  },
  photo: String,

  // Informations des parents/tuteurs
  tuteur: {
    nom: String,
    prenom: String,
    telephone: String,
    email: String,
    profession: String,
    adresse: String
  },

  // Informations médicales
  groupeSanguin: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']
  },
  allergies: [String],
  maladiesChroniques: [String],

  // Statut
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'transfere', 'diplome'],
    default: 'actif'
  },

  anneeScolaire: {
    type: String,
    required: true
  },

  dateInscription: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour la recherche
eleveSchema.index({ nom: 'text', prenom: 'text', matricule: 'text' });

module.exports = mongoose.model('Eleve', eleveSchema);
