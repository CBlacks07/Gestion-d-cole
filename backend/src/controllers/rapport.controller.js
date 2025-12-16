const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');
const Note = require('../models/Note');
const Absence = require('../models/Absence');
const Paiement = require('../models/Paiement');

// Tableau de bord général
exports.getDashboard = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const query = anneeScolaire ? { anneeScolaire } : {};

    const totalEleves = await Eleve.countDocuments({ ...query, statut: 'actif' });
    const totalClasses = await Classe.countDocuments(query);

    const elevesParCycle = await Eleve.aggregate([
      { $match: { statut: 'actif' } },
      {
        $lookup: {
          from: 'classes',
          localField: 'classe',
          foreignField: '_id',
          as: 'classeInfo'
        }
      },
      { $unwind: '$classeInfo' },
      {
        $group: {
          _id: '$classeInfo.cycle',
          count: { $sum: 1 }
        }
      }
    ]);

    const paiementsQuery = { statut: 'Validé' };
    if (anneeScolaire) paiementsQuery.anneeScolaire = anneeScolaire;

    const recettesTotal = await Paiement.aggregate([
      { $match: paiementsQuery },
      { $group: { _id: null, total: { $sum: '$montant' } } }
    ]);

    res.json({
      totalEleves,
      totalClasses,
      elevesParCycle,
      recettesTotal: recettesTotal[0]?.total || 0,
      devise: 'XOF'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Rapport de classe
exports.getRapportClasse = async (req, res) => {
  try {
    const { classeId } = req.params;
    const { periode, anneeScolaire } = req.query;

    const classe = await Classe.findById(classeId)
      .populate('enseignantPrincipal');

    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    const eleves = await Eleve.find({
      classe: classeId,
      statut: 'actif'
    });

    const elevesIds = eleves.map(e => e._id);

    // Notes moyennes par élève
    const notesQuery = {
      eleve: { $in: elevesIds },
      classe: classeId
    };

    if (periode) notesQuery.periode = periode;
    if (anneeScolaire) notesQuery.anneeScolaire = anneeScolaire;

    const notes = await Note.find(notesQuery).populate('matiere');

    // Calculer les moyennes
    const moyennesParEleve = {};
    notes.forEach(note => {
      const eleveId = note.eleve.toString();
      if (!moyennesParEleve[eleveId]) {
        moyennesParEleve[eleveId] = {
          totalPoints: 0,
          totalCoef: 0,
          notes: []
        };
      }
      const coef = note.matiere.coefficient;
      moyennesParEleve[eleveId].totalPoints += note.note * coef;
      moyennesParEleve[eleveId].totalCoef += coef;
      moyennesParEleve[eleveId].notes.push(note);
    });

    const elevesAvecMoyennes = eleves.map(eleve => {
      const stats = moyennesParEleve[eleve._id.toString()];
      const moyenne = stats && stats.totalCoef > 0
        ? (stats.totalPoints / stats.totalCoef).toFixed(2)
        : 0;

      return {
        ...eleve.toObject(),
        moyenne,
        nombreNotes: stats?.notes.length || 0
      };
    }).sort((a, b) => b.moyenne - a.moyenne);

    const moyenneClasse = elevesAvecMoyennes.length > 0
      ? (elevesAvecMoyennes.reduce((sum, e) => sum + parseFloat(e.moyenne), 0) / elevesAvecMoyennes.length).toFixed(2)
      : 0;

    res.json({
      classe,
      effectif: eleves.length,
      moyenneClasse,
      eleves: elevesAvecMoyennes
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Rapport financier
exports.getRapportFinancier = async (req, res) => {
  try {
    const { anneeScolaire, mois } = req.query;

    let query = { statut: 'Validé' };
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;
    if (mois) query.moisConcerne = mois;

    const paiements = await Paiement.find(query).populate('eleve');

    const totalRecettes = paiements.reduce((sum, p) => sum + p.montant, 0);

    const parType = await Paiement.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$typePaiement',
          total: { $sum: '$montant' },
          count: { $sum: 1 }
        }
      }
    ]);

    const parModePaiement = await Paiement.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$modePaiement',
          total: { $sum: '$montant' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalRecettes,
      nombrePaiements: paiements.length,
      devise: 'XOF',
      parType,
      parModePaiement,
      paiements
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Rapport d'assiduité
exports.getRapportAssiduite = async (req, res) => {
  try {
    const { classeId, anneeScolaire } = req.query;

    let query = {};
    if (classeId) query.classe = classeId;
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;

    const absences = await Absence.find(query)
      .populate('eleve');

    const absencesParEleve = {};
    absences.forEach(absence => {
      const eleveId = absence.eleve._id.toString();
      if (!absencesParEleve[eleveId]) {
        absencesParEleve[eleveId] = {
          eleve: absence.eleve,
          total: 0,
          justifiees: 0,
          nonJustifiees: 0
        };
      }
      absencesParEleve[eleveId].total++;
      if (absence.justifiee) {
        absencesParEleve[eleveId].justifiees++;
      } else {
        absencesParEleve[eleveId].nonJustifiees++;
      }
    });

    const stats = Object.values(absencesParEleve)
      .sort((a, b) => b.total - a.total);

    res.json({
      totalAbsences: absences.length,
      absencesParEleve: stats,
      tauxAbsenteisme: 0 // À calculer selon le nombre de jours d'école
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
