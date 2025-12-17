const prisma = require('../lib/prisma');

// Tableau de bord général
exports.getDashboard = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const whereEleve = anneeScolaire ? { anneeScolaire, statut: 'ACTIF' } : { statut: 'ACTIF' };
    const whereClasse = anneeScolaire ? { anneeScolaire } : {};

    const totalEleves = await prisma.eleve.count({ where: whereEleve });
    const totalClasses = await prisma.classe.count({ where: whereClasse });

    // Récupérer tous les élèves actifs avec leur classe
    const elevesAvecClasse = await prisma.eleve.findMany({
      where: { statut: 'ACTIF' },
      include: {
        classe: {
          select: {
            cycle: true
          }
        }
      }
    });

    // Grouper par cycle
    const elevesParCycle = elevesAvecClasse.reduce((acc, eleve) => {
      if (eleve.classe) {
        const cycle = eleve.classe.cycle;
        const existing = acc.find(item => item._id === cycle);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ _id: cycle, count: 1 });
        }
      }
      return acc;
    }, []);

    const paiementsWhere = { statut: 'VALIDE' };
    if (anneeScolaire) paiementsWhere.anneeScolaire = anneeScolaire;

    const recettesTotalResult = await prisma.paiement.aggregate({
      where: paiementsWhere,
      _sum: {
        montant: true
      }
    });

    res.json({
      totalEleves,
      totalClasses,
      elevesParCycle,
      recettesTotal: Number(recettesTotalResult._sum.montant || 0),
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

    const classe = await prisma.classe.findUnique({
      where: { id: classeId },
      include: {
        enseignantPrincipal: true
      }
    });

    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    const eleves = await prisma.eleve.findMany({
      where: {
        classeId: classeId,
        statut: 'ACTIF'
      }
    });

    const elevesIds = eleves.map(e => e.id);

    // Notes moyennes par élève
    const notesWhere = {
      eleveId: { in: elevesIds },
      classeId: classeId
    };

    if (periode) notesWhere.periode = periode.toUpperCase();
    if (anneeScolaire) notesWhere.anneeScolaire = anneeScolaire;

    const notes = await prisma.note.findMany({
      where: notesWhere,
      include: {
        matiere: true
      }
    });

    // Calculer les moyennes
    const moyennesParEleve = {};
    notes.forEach(note => {
      const eleveId = note.eleveId;
      if (!moyennesParEleve[eleveId]) {
        moyennesParEleve[eleveId] = {
          totalPoints: 0,
          totalCoef: 0,
          notes: []
        };
      }
      const coef = note.matiere.coefficient;
      moyennesParEleve[eleveId].totalPoints += Number(note.note) * coef;
      moyennesParEleve[eleveId].totalCoef += coef;
      moyennesParEleve[eleveId].notes.push(note);
    });

    const elevesAvecMoyennes = eleves.map(eleve => {
      const stats = moyennesParEleve[eleve.id];
      const moyenne = stats && stats.totalCoef > 0
        ? (stats.totalPoints / stats.totalCoef).toFixed(2)
        : 0;

      return {
        ...eleve,
        moyenne,
        nombreNotes: stats?.notes.length || 0
      };
    }).sort((a, b) => parseFloat(b.moyenne) - parseFloat(a.moyenne));

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

    let where = { statut: 'VALIDE' };
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;
    if (mois) where.moisConcerne = mois;

    const paiements = await prisma.paiement.findMany({
      where,
      include: {
        eleve: true
      }
    });

    const totalRecettes = paiements.reduce((sum, p) => sum + Number(p.montant), 0);

    const parType = await prisma.paiement.groupBy({
      by: ['typePaiement'],
      where,
      _sum: {
        montant: true
      },
      _count: {
        typePaiement: true
      }
    });

    const parModePaiement = await prisma.paiement.groupBy({
      by: ['modePaiement'],
      where,
      _sum: {
        montant: true
      },
      _count: {
        modePaiement: true
      }
    });

    res.json({
      totalRecettes,
      nombrePaiements: paiements.length,
      devise: 'XOF',
      parType: parType.map(item => ({
        _id: item.typePaiement,
        total: Number(item._sum.montant || 0),
        count: item._count.typePaiement
      })),
      parModePaiement: parModePaiement.map(item => ({
        _id: item.modePaiement,
        total: Number(item._sum.montant || 0),
        count: item._count.modePaiement
      })),
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

    let where = {};
    if (classeId) where.classeId = classeId;
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;

    const absences = await prisma.absence.findMany({
      where,
      include: {
        eleve: true
      }
    });

    const absencesParEleve = {};
    absences.forEach(absence => {
      const eleveId = absence.eleve.id;
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
