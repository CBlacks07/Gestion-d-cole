const mongoose = require('mongoose');

const paiementSchema = new mongoose.Schema({
  eleve: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Eleve',
    required: true
  },
  typePaiement: {
    type: String,
    enum: ['Inscription', 'Scolarité', 'Cantine', 'Transport', 'Uniforme', 'Autres'],
    required: true
  },
  montant: {
    type: Number,
    required: true,
    min: 0
  },
  devise: {
    type: String,
    default: 'XOF'
  },
  datePaiement: {
    type: Date,
    default: Date.now
  },
  moisConcerne: String, // Pour les paiements mensuels
  anneeScolaire: {
    type: String,
    required: true
  },
  modePaiement: {
    type: String,
    enum: ['Espèces', 'Chèque', 'Virement', 'Mobile Money'],
    default: 'Espèces'
  },
  numeroPiece: String, // Numéro de chèque, reçu, etc.
  statut: {
    type: String,
    enum: ['Validé', 'En attente', 'Annulé'],
    default: 'Validé'
  },
  remarques: String,
  enregistrePar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

paiementSchema.index({ eleve: 1, anneeScolaire: 1, typePaiement: 1 });

module.exports = mongoose.model('Paiement', paiementSchema);
