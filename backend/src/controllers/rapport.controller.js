const { query } = require('../lib/db');

// Tableau de bord général
exports.getDashboard = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;

    let whereEleve = "WHERE statut = 'ACTIF'";
    let whereClasse = 'WHERE 1=1';
    let wherePaiements = "WHERE statut = 'VALIDE'";
    const params = [];

    if (anneeScolaire) {
      whereEleve += ' AND annee_scolaire = $1';
      whereClasse += ' AND annee_scolaire = $1';
      wherePaiements += ' AND annee_scolaire = $1';
      params.push(anneeScolaire);
    }

    // Total d'élèves actifs
    const totalElevesResult = await query(
      `SELECT COUNT(*) as count FROM eleves ${whereEleve}`,
      anneeScolaire ? [anneeScolaire] : []
    );

    // Total de classes
    const totalClassesResult = await query(
      `SELECT COUNT(*) as count FROM classes ${whereClasse}`,
      anneeScolaire ? [anneeScolaire] : []
    );

    // Élèves par cycle
    const elevesParCycleResult = await query(
      `SELECT c.cycle, COUNT(e.id) as count
       FROM eleves e
       JOIN classes c ON e.classe_id = c.id
       WHERE e.statut = 'ACTIF'
       ${anneeScolaire ? 'AND e.annee_scolaire = $1' : ''}
       GROUP BY c.cycle`,
      anneeScolaire ? [anneeScolaire] : []
    );

    const elevesParCycle = elevesParCycleResult.rows.map(row => ({
      _id: row.cycle,
      count: parseInt(row.count)
    }));

    // Recettes totales
    const recettesResult = await query(
      `SELECT SUM(montant) as total FROM paiements ${wherePaiements}`,
      anneeScolaire ? [anneeScolaire] : []
    );

    res.json({
      totalEleves: parseInt(totalElevesResult.rows[0].count),
      totalClasses: parseInt(totalClassesResult.rows[0].count),
      elevesParCycle,
      recettesTotal: parseFloat(recettesResult.rows[0].total || 0),
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

    // Récupérer la classe avec l'enseignant principal
    const classeResult = await query(
      `SELECT c.*,
              e.id as enseignant_id, e.nom as enseignant_nom, e.prenom as enseignant_prenom
       FROM classes c
       LEFT JOIN enseignants e ON c.enseignant_principal_id = e.id
       WHERE c.id = $1`,
      [classeId]
    );

    if (classeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    const classeRow = classeResult.rows[0];
    const classe = {
      id: classeRow.id,
      nom: classeRow.nom,
      niveau: classeRow.niveau,
      cycle: classeRow.cycle,
      enseignantPrincipal: classeRow.enseignant_id ? {
        id: classeRow.enseignant_id,
        nom: classeRow.enseignant_nom,
        prenom: classeRow.enseignant_prenom
      } : null
    };

    // Récupérer les élèves de la classe
    const elevesResult = await query(
      "SELECT * FROM eleves WHERE classe_id = $1 AND statut = 'ACTIF' ORDER BY nom, prenom",
      [classeId]
    );

    const eleves = elevesResult.rows;

    if (eleves.length === 0) {
      return res.json({
        classe,
        effectif: 0,
        moyenneClasse: 0,
        eleves: []
      });
    }

    // Récupérer les notes pour tous les élèves
    const elevesIds = eleves.map(e => e.id);

    let notesQuery = `
      SELECT n.*, m.coefficient
      FROM notes n
      JOIN matieres m ON n.matiere_id = m.id
      WHERE n.eleve_id = ANY($1) AND n.classe_id = $2
    `;
    const notesParams = [elevesIds, classeId];
    let paramIndex = 3;

    if (periode) {
      notesQuery += ` AND n.periode = $${paramIndex}`;
      notesParams.push(periode.toUpperCase());
      paramIndex++;
    }

    if (anneeScolaire) {
      notesQuery += ` AND n.annee_scolaire = $${paramIndex}`;
      notesParams.push(anneeScolaire);
      paramIndex++;
    }

    const notesResult = await query(notesQuery, notesParams);

    // Calculer les moyennes par élève
    const moyennesParEleve = {};
    notesResult.rows.forEach(note => {
      const eleveId = note.eleve_id;
      if (!moyennesParEleve[eleveId]) {
        moyennesParEleve[eleveId] = {
          totalPoints: 0,
          totalCoef: 0,
          nombreNotes: 0
        };
      }
      const coef = parseFloat(note.coefficient);
      moyennesParEleve[eleveId].totalPoints += parseFloat(note.note) * coef;
      moyennesParEleve[eleveId].totalCoef += coef;
      moyennesParEleve[eleveId].nombreNotes++;
    });

    // Calculer la moyenne pour chaque élève
    const elevesAvecMoyennes = eleves.map(eleve => {
      const stats = moyennesParEleve[eleve.id];
      const moyenne = stats && stats.totalCoef > 0
        ? (stats.totalPoints / stats.totalCoef)
        : 0;

      return {
        ...eleve,
        moyenne: moyenne.toFixed(2),
        nombreNotes: stats?.nombreNotes || 0
      };
    }).sort((a, b) => parseFloat(b.moyenne) - parseFloat(a.moyenne));

    // Calculer la moyenne de la classe
    const moyenneClasse = elevesAvecMoyennes.length > 0
      ? (elevesAvecMoyennes.reduce((sum, e) => sum + parseFloat(e.moyenne), 0) / elevesAvecMoyennes.length)
      : 0;

    res.json({
      classe,
      effectif: eleves.length,
      moyenneClasse: moyenneClasse.toFixed(2),
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

    let whereClause = "WHERE p.statut = 'VALIDE'";
    const params = [];
    let paramIndex = 1;

    if (anneeScolaire) {
      whereClause += ` AND p.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    if (mois) {
      whereClause += ` AND p.mois_concerne = $${paramIndex}`;
      params.push(mois);
      paramIndex++;
    }

    // Récupérer tous les paiements avec les élèves
    const paiementsResult = await query(
      `SELECT p.*,
              e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule
       FROM paiements p
       LEFT JOIN eleves e ON p.eleve_id = e.id
       ${whereClause}
       ORDER BY p.date_paiement DESC`,
      params
    );

    const paiements = paiementsResult.rows.map(row => ({
      id: row.id,
      eleve_id: row.eleve_id,
      type_paiement: row.type_paiement,
      montant: row.montant,
      devise: row.devise,
      date_paiement: row.date_paiement,
      mois_concerne: row.mois_concerne,
      annee_scolaire: row.annee_scolaire,
      mode_paiement: row.mode_paiement,
      eleve: row.eleve_id ? {
        id: row.eleve_id,
        nom: row.eleve_nom,
        prenom: row.eleve_prenom,
        matricule: row.eleve_matricule
      } : null
    }));

    // Calculer le total
    const totalRecettes = paiements.reduce((sum, p) => sum + parseFloat(p.montant), 0);

    // Par type de paiement
    const parTypeResult = await query(
      `SELECT type_paiement, SUM(montant) as total, COUNT(*) as count
       FROM paiements p
       ${whereClause}
       GROUP BY type_paiement`,
      params
    );

    const parType = parTypeResult.rows.map(row => ({
      _id: row.type_paiement,
      total: parseFloat(row.total || 0),
      count: parseInt(row.count)
    }));

    // Par mode de paiement
    const parModePaiementResult = await query(
      `SELECT mode_paiement, SUM(montant) as total, COUNT(*) as count
       FROM paiements p
       ${whereClause}
       GROUP BY mode_paiement`,
      params
    );

    const parModePaiement = parModePaiementResult.rows.map(row => ({
      _id: row.mode_paiement,
      total: parseFloat(row.total || 0),
      count: parseInt(row.count)
    }));

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

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (classeId) {
      whereClause += ` AND a.classe_id = $${paramIndex}`;
      params.push(classeId);
      paramIndex++;
    }

    if (anneeScolaire) {
      whereClause += ` AND a.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    // Récupérer toutes les absences avec les élèves
    const absencesResult = await query(
      `SELECT a.*,
              e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule
       FROM absences a
       JOIN eleves e ON a.eleve_id = e.id
       ${whereClause}
       ORDER BY a.date DESC`,
      params
    );

    // Grouper les absences par élève
    const absencesParEleve = {};
    absencesResult.rows.forEach(absence => {
      const eleveId = absence.eleve_id;
      if (!absencesParEleve[eleveId]) {
        absencesParEleve[eleveId] = {
          eleve: {
            id: absence.eleve_id,
            nom: absence.eleve_nom,
            prenom: absence.eleve_prenom,
            matricule: absence.eleve_matricule
          },
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

    // Convertir en tableau et trier par nombre total d'absences
    const stats = Object.values(absencesParEleve)
      .sort((a, b) => b.total - a.total);

    res.json({
      totalAbsences: absencesResult.rows.length,
      absencesParEleve: stats,
      tauxAbsenteisme: 0 // À calculer selon le nombre de jours d'école
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
