const Note = require('../models/Note');
const Eleve = require('../models/Eleve');
const Matiere = require('../models/Matiere');

exports.getNotes = async (req, res) => {
  try {
    const { eleve, classe, matiere, periode, anneeScolaire } = req.query;
    let query = {};

    if (eleve) query.eleve = eleve;
    if (classe) query.classe = classe;
    if (matiere) query.matiere = matiere;
    if (periode) query.periode = periode;
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;

    const notes = await Note.find(query)
      .populate('eleve')
      .populate('matiere')
      .populate('enseignant')
      .sort({ dateEvaluation: -1 });

    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNoteById = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('eleve')
      .populate('matiere')
      .populate('enseignant');

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
    const note = await Note.create(req.body);
    res.status(201).json(note);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!note) {
      return res.status(404).json({ message: 'Note non trouvée' });
    }

    res.json(note);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);

    if (!note) {
      return res.status(404).json({ message: 'Note non trouvée' });
    }

    res.json({ message: 'Note supprimée avec succès' });
  } catch (error) {
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

    const eleve = await Eleve.findById(eleveId).populate('classe');
    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    const notes = await Note.find({
      eleve: eleveId,
      periode,
      anneeScolaire
    }).populate('matiere');

    // Calculer les moyennes
    const notesParMatiere = {};
    notes.forEach(note => {
      const matiereId = note.matiere._id.toString();
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
      const sommeNotes = item.notes.reduce((sum, n) => sum + n.note, 0);
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
