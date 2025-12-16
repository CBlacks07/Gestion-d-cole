const Matiere = require('../models/Matiere');

exports.getMatieres = async (req, res) => {
  try {
    const { cycle, niveau } = req.query;
    let query = {};

    if (cycle) query.cycles = cycle;
    if (niveau) query.niveaux = niveau;

    const matieres = await Matiere.find(query).sort({ nom: 1 });
    res.json(matieres);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMatiereById = async (req, res) => {
  try {
    const matiere = await Matiere.findById(req.params.id);

    if (!matiere) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json(matiere);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createMatiere = async (req, res) => {
  try {
    const matiere = await Matiere.create(req.body);
    res.status(201).json(matiere);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateMatiere = async (req, res) => {
  try {
    const matiere = await Matiere.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!matiere) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json(matiere);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteMatiere = async (req, res) => {
  try {
    const matiere = await Matiere.findByIdAndDelete(req.params.id);

    if (!matiere) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json({ message: 'Matière supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
