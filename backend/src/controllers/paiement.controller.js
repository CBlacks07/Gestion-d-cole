const Paiement = require('../models/Paiement');
const Eleve = require('../models/Eleve');

exports.getPaiements = async (req, res) => {
  try {
    const { eleve, typePaiement, anneeScolaire, statut } = req.query;
    let query = {};

    if (eleve) query.eleve = eleve;
    if (typePaiement) query.typePaiement = typePaiement;
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;
    if (statut) query.statut = statut;

    const paiements = await Paiement.find(query)
      .populate('eleve')
      .populate('enregistrePar', 'nom prenom')
      .sort({ datePaiement: -1 });

    res.json(paiements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPaiementById = async (req, res) => {
  try {
    const paiement = await Paiement.findById(req.params.id)
      .populate('eleve')
      .populate('enregistrePar');

    if (!paiement) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    res.json(paiement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPaiement = async (req, res) => {
  try {
    const paiement = await Paiement.create({
      ...req.body,
      enregistrePar: req.user._id
    });

    await paiement.populate('eleve');
    res.status(201).json(paiement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePaiement = async (req, res) => {
  try {
    const paiement = await Paiement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!paiement) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    res.json(paiement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deletePaiement = async (req, res) => {
  try {
    const paiement = await Paiement.findByIdAndDelete(req.params.id);

    if (!paiement) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    res.json({ message: 'Paiement supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtenir l'historique des paiements d'un élève
exports.getHistoriquePaiements = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { anneeScolaire } = req.query;

    const query = { eleve: eleveId };
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;

    const paiements = await Paiement.find(query)
      .sort({ datePaiement: -1 });

    const totalPaye = paiements
      .filter(p => p.statut === 'Validé')
      .reduce((sum, p) => sum + p.montant, 0);

    res.json({
      paiements,
      totalPaye,
      devise: 'XOF'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Statistiques des paiements
exports.getPaiementStats = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const query = anneeScolaire ? { anneeScolaire, statut: 'Validé' } : { statut: 'Validé' };

    const totalPaiements = await Paiement.countDocuments(query);
    const montantTotal = await Paiement.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$montant' } } }
    ]);

    const parType = await Paiement.aggregate([
      { $match: query },
      { $group: { _id: '$typePaiement', total: { $sum: '$montant' }, count: { $sum: 1 } } }
    ]);

    res.json({
      totalPaiements,
      montantTotal: montantTotal[0]?.total || 0,
      devise: 'XOF',
      parType
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
