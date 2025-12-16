const Enseignant = require('../models/Enseignant');

exports.getEnseignants = async (req, res) => {
  try {
    const { statut, search } = req.query;
    let query = {};

    if (statut) query.statut = statut;
    if (search) {
      query.$text = { $search: search };
    }

    const enseignants = await Enseignant.find(query)
      .populate('specialites')
      .populate('classesAssignees')
      .sort({ nom: 1, prenom: 1 });

    res.json(enseignants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEnseignantById = async (req, res) => {
  try {
    const enseignant = await Enseignant.findById(req.params.id)
      .populate('specialites')
      .populate('classesAssignees');

    if (!enseignant) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    res.json(enseignant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createEnseignant = async (req, res) => {
  try {
    const enseignant = await Enseignant.create(req.body);
    res.status(201).json(enseignant);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateEnseignant = async (req, res) => {
  try {
    const enseignant = await Enseignant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!enseignant) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    res.json(enseignant);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteEnseignant = async (req, res) => {
  try {
    const enseignant = await Enseignant.findByIdAndDelete(req.params.id);

    if (!enseignant) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    res.json({ message: 'Enseignant supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
