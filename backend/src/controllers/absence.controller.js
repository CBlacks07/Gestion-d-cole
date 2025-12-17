const prisma = require('../lib/prisma');

exports.getAbsences = async (req, res) => {
  try {
    const { eleve, classe, date, anneeScolaire, justifiee } = req.query;
    let where = {};

    if (eleve) where.eleveId = eleve;
    if (classe) where.classeId = classe;
    if (date) where.date = new Date(date);
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;
    if (justifiee !== undefined) where.justifiee = justifiee === 'true';

    const absences = await prisma.absence.findMany({
      where,
      include: {
        eleve: true,
        classe: true,
        matiere: true
      },
      orderBy: { date: 'desc' }
    });

    res.json(absences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAbsenceById = async (req, res) => {
  try {
    const absence = await prisma.absence.findUnique({
      where: { id: req.params.id },
      include: {
        eleve: true,
        classe: true,
        matiere: true
      }
    });

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
    const data = {
      ...req.body,
      enregistreParId: req.user.id
    };

    // Convertir l'enum periode si présent
    if (data.periode) data.periode = data.periode.toUpperCase();

    const absence = await prisma.absence.create({ data });
    res.status(201).json(absence);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateAbsence = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir l'enum periode si présent
    if (data.periode) data.periode = data.periode.toUpperCase();

    const absence = await prisma.absence.update({
      where: { id: req.params.id },
      data
    });

    res.json(absence);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Absence non trouvée' });
    }
    res.status(400).json({ message: error.message });
  }
};

exports.deleteAbsence = async (req, res) => {
  try {
    await prisma.absence.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Absence supprimée avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Absence non trouvée' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Obtenir les statistiques d'absences pour un élève
exports.getAbsenceStats = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { anneeScolaire } = req.query;

    const where = { eleveId: eleveId };
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;

    const total = await prisma.absence.count({ where });
    const justifiees = await prisma.absence.count({
      where: { ...where, justifiee: true }
    });
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
