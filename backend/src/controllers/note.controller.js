const prisma = require('../lib/prisma');

exports.getNotes = async (req, res) => {
  try {
    const { eleve, classe, matiere, periode, anneeScolaire } = req.query;
    let where = {};

    if (eleve) where.eleveId = eleve;
    if (classe) where.classeId = classe;
    if (matiere) where.matiereId = matiere;
    if (periode) where.periode = periode.toUpperCase();
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;

    const notes = await prisma.note.findMany({
      where,
      include: {
        eleve: true,
        matiere: true,
        enseignant: true
      },
      orderBy: { dateEvaluation: 'desc' }
    });

    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNoteById = async (req, res) => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: req.params.id },
      include: {
        eleve: true,
        matiere: true,
        enseignant: true
      }
    });

    if (!note) {
      return res.status(404).json({ message: 'Note non trouvée' });
    }

    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createNote = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.typeEvaluation) data.typeEvaluation = data.typeEvaluation.toUpperCase();
    if (data.periode) data.periode = data.periode.toUpperCase();

    const note = await prisma.note.create({ data });
    res.status(201).json(note);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.typeEvaluation) data.typeEvaluation = data.typeEvaluation.toUpperCase();
    if (data.periode) data.periode = data.periode.toUpperCase();

    const note = await prisma.note.update({
      where: { id: req.params.id },
      data
    });

    res.json(note);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Note non trouvée' });
    }
    res.status(400).json({ message: error.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    await prisma.note.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Note supprimée avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Note non trouvée' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Obtenir le bulletin d'un élève
exports.getBulletin = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { periode, anneeScolaire } = req.query;

    if (!periode || !anneeScolaire) {
      return res.status(400).json({
        message: 'Période et année scolaire sont requis'
      });
    }

    const eleve = await prisma.eleve.findUnique({
      where: { id: eleveId },
      include: { classe: true }
    });

    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    const notes = await prisma.note.findMany({
      where: {
        eleveId: eleveId,
        periode: periode.toUpperCase(),
        anneeScolaire
      },
      include: { matiere: true }
    });

    // Calculer les moyennes
    const notesParMatiere = {};
    notes.forEach(note => {
      const matiereId = note.matiere.id;
      if (!notesParMatiere[matiereId]) {
        notesParMatiere[matiereId] = {
          matiere: note.matiere,
          notes: [],
          moyenne: 0
        };
      }
      notesParMatiere[matiereId].notes.push(note);
    });

    let totalPoints = 0;
    let totalCoefficients = 0;

    Object.values(notesParMatiere).forEach(item => {
      const sommeNotes = item.notes.reduce((sum, n) => sum + Number(n.note), 0);
      item.moyenne = sommeNotes / item.notes.length;
      const coef = item.matiere.coefficient;
      totalPoints += item.moyenne * coef;
      totalCoefficients += coef;
    });

    const moyenneGenerale = totalCoefficients > 0 ? totalPoints / totalCoefficients : 0;

    res.json({
      eleve,
      periode,
      anneeScolaire,
      notesParMatiere: Object.values(notesParMatiere),
      moyenneGenerale: moyenneGenerale.toFixed(2),
      totalCoefficients
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
