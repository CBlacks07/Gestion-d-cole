const Absence = require('../models/Absence');

exports.getAbsences = async (req, res) => {
  try {
    const { eleve, classe, date, anneeScolaire, justifiee } = req.query;
    let query = {};

    if (eleve) query.eleve = eleve;
    if (classe) query.classe = classe;
    if (date) query.date = new Date(date);
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;
    if (justifiee !== undefined) query.justifiee = justifiee === 'true';

    const absences = await Absence.find(query)
      .populate('eleve')
      .populate('classe')
      .populate('matiere')
      .sort({ date: -1 });

    res.json(absences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAbsenceById = async (req, res) => {
  try {
    const absence = await Absence.findById(req.params.id)
      .populate('eleve')
      .populate('classe')
      .populate('matiere');

    if (!absence) {
      return res.status(404).json({ message: 'Absence non trouvée' });
    }

    res.json(absence);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAbsence = async (req, res) => {
  try {
    const absence = await Absence.create({
      ...req.body,
      enregistrePar: req.user._id
    });
    res.status(201).json(absence);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateAbsence = async (req, res) => {
  try {
    const absence = await Absence.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!absence) {
      return res.status(404).json({ message: 'Absence non trouvée' });
    }

    res.json(absence);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteAbsence = async (req, res) => {
  try {
    const absence = await Absence.findByIdAndDelete(req.params.id);

    if (!absence) {
      return res.status(404).json({ message: 'Absence non trouvée' });
    }

    res.json({ message: 'Absence supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtenir les statistiques d'absences pour un élève
exports.getAbsenceStats = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { anneeScolaire } = req.query;

    const query = { eleve: eleveId };
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;

    const total = await Absence.countDocuments(query);
    const justifiees = await Absence.countDocuments({ ...query, justifiee: true });
    const nonJustifiees = total - justifiees;

    res.json({
      total,
      justifiees,
      nonJustifiees
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
