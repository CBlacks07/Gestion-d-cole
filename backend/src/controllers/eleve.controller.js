const Eleve = require('../models/Eleve');

// @desc    Obtenir tous les élèves
// @route   GET /api/eleves
exports.getEleves = async (req, res) => {
  try {
    const { classe, statut, anneeScolaire, search } = req.query;
    let query = {};

    if (classe) query.classe = classe;
    if (statut) query.statut = statut;
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;
    if (search) {
      query.$text = { $search: search };
    }

    const eleves = await Eleve.find(query)
      .populate('classe')
      .sort({ nom: 1, prenom: 1 });

    res.json(eleves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir un élève par ID
// @route   GET /api/eleves/:id
exports.getEleveById = async (req, res) => {
  try {
    const eleve = await Eleve.findById(req.params.id).populate('classe');

    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    res.json(eleve);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer un nouvel élève
// @route   POST /api/eleves
exports.createEleve = async (req, res) => {
  try {
    const eleve = await Eleve.create(req.body);
    res.status(201).json(eleve);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Mettre à jour un élève
// @route   PUT /api/eleves/:id
exports.updateEleve = async (req, res) => {
  try {
    const eleve = await Eleve.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    res.json(eleve);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Supprimer un élève
// @route   DELETE /api/eleves/:id
exports.deleteEleve = async (req, res) => {
  try {
    const eleve = await Eleve.findByIdAndDelete(req.params.id);

    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    res.json({ message: 'Élève supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir les statistiques des élèves
// @route   GET /api/eleves/stats
exports.getElevesStats = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const query = anneeScolaire ? { anneeScolaire } : {};

    const total = await Eleve.countDocuments(query);
    const actifs = await Eleve.countDocuments({ ...query, statut: 'actif' });
    const parSexe = await Eleve.aggregate([
      { $match: query },
      { $group: { _id: '$sexe', count: { $sum: 1 } } }
    ]);

    res.json({
      total,
      actifs,
      parSexe: {
        masculin: parSexe.find(s => s._id === 'M')?.count || 0,
        feminin: parSexe.find(s => s._id === 'F')?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
