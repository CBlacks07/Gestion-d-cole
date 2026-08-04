const { query } = require('../lib/db');

const normalizeValue = (value) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

const PERIODE_ALIASES = {
  '1ER TRIMESTRE': 'PREMIER_TRIMESTRE',
  '1ERE TRIMESTRE': 'PREMIER_TRIMESTRE',
  'PREMIER TRIMESTRE': 'PREMIER_TRIMESTRE',
  'TRIMESTRE 1': 'PREMIER_TRIMESTRE',
  T1: 'PREMIER_TRIMESTRE',
  '2EME TRIMESTRE': 'DEUXIEME_TRIMESTRE',
  '2E TRIMESTRE': 'DEUXIEME_TRIMESTRE',
  'DEUXIEME TRIMESTRE': 'DEUXIEME_TRIMESTRE',
  'TRIMESTRE 2': 'DEUXIEME_TRIMESTRE',
  T2: 'DEUXIEME_TRIMESTRE',
  '3EME TRIMESTRE': 'TROISIEME_TRIMESTRE',
  '3E TRIMESTRE': 'TROISIEME_TRIMESTRE',
  'TROISIEME TRIMESTRE': 'TROISIEME_TRIMESTRE',
  'TRIMESTRE 3': 'TROISIEME_TRIMESTRE',
  T3: 'TROISIEME_TRIMESTRE',
  '1ER SEMESTRE': 'PREMIER_SEMESTRE',
  '1ERE SEMESTRE': 'PREMIER_SEMESTRE',
  'PREMIER SEMESTRE': 'PREMIER_SEMESTRE',
  'SEMESTRE 1': 'PREMIER_SEMESTRE',
  S1: 'PREMIER_SEMESTRE',
  '2EME SEMESTRE': 'DEUXIEME_SEMESTRE',
  '2E SEMESTRE': 'DEUXIEME_SEMESTRE',
  'DEUXIEME SEMESTRE': 'DEUXIEME_SEMESTRE',
  'SEMESTRE 2': 'DEUXIEME_SEMESTRE',
  S2: 'DEUXIEME_SEMESTRE'
};

const normalizePeriodeKey = (value) =>
  normalizeValue(value)
    .replace(/[+/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const convertPeriode = (periode) => {
  if (periode === undefined || periode === null) return null;
  const normalized = normalizePeriodeKey(periode);
  if (!normalized) return null;
  return PERIODE_ALIASES[normalized] || null;
};

// Tableau de bord général
exports.getDashboard = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const role = normalizeValue(req.user?.role);

    if (role === 'ENSEIGNANT') {
      const enseignantId = req.user?.enseignant_id || null;
      if (!enseignantId) {
        return res.status(403).json({ message: 'Compte enseignant non lie a un profil enseignant' });
      }

      const params = anneeScolaire ? [enseignantId, anneeScolaire] : [enseignantId];
      const classesCte = `
        WITH my_classes AS (
          SELECT DISTINCT c.id, c.cycle
          FROM classes c
          LEFT JOIN classe_matieres cm
            ON cm.classe_id = c.id
           AND cm.enseignant_id = $1
           ${anneeScolaire ? 'AND cm.annee_scolaire = $2' : ''}
          WHERE (c.enseignant_principal_id = $1 OR cm.enseignant_id = $1)
            ${anneeScolaire ? 'AND c.annee_scolaire = $2' : ''}
        )
      `;

      const [
        totalElevesResult,
        totalClassesResult,
        elevesParCycleResult,
        absencesMoisResult,
        notesSaisiesMoisResult,
        matieresAttribueesResult
      ] = await Promise.all([
        query(
          `${classesCte}
           SELECT COUNT(*) as count
           FROM eleves e
           WHERE e.statut = 'ACTIF'
             AND e.classe_id IN (SELECT id FROM my_classes)
             ${anneeScolaire ? 'AND e.annee_scolaire = $2' : ''}`,
          params
        ),
        query(
          `${classesCte}
           SELECT COUNT(*) as count
           FROM my_classes`,
          params
        ),
        query(
          `${classesCte}
           SELECT mc.cycle, COUNT(e.id) as count
           FROM my_classes mc
           LEFT JOIN eleves e
             ON e.classe_id = mc.id
            AND e.statut = 'ACTIF'
            ${anneeScolaire ? 'AND e.annee_scolaire = $2' : ''}
           GROUP BY mc.cycle
           ORDER BY mc.cycle`,
          params
        ),
        query(
          `${classesCte}
           SELECT COUNT(*) as count
           FROM absences a
           WHERE a.date >= date_trunc('month', CURRENT_DATE)
             AND a.classe_id IN (SELECT id FROM my_classes)
             ${anneeScolaire ? 'AND a.annee_scolaire = $2' : ''}`,
          params
        ),
        query(
          `SELECT COUNT(*) as count
           FROM notes n
           WHERE n.enseignant_id = $1
             AND n.date_evaluation >= date_trunc('month', CURRENT_DATE)
             ${anneeScolaire ? 'AND n.annee_scolaire = $2' : ''}`,
          params
        ),
        query(
          `SELECT COUNT(DISTINCT x.matiere_id) as count
           FROM (
             SELECT cm.matiere_id
             FROM classe_matieres cm
             WHERE cm.enseignant_id = $1
               ${anneeScolaire ? 'AND cm.annee_scolaire = $2' : ''}
             UNION
             SELECT em.matiere_id
             FROM enseignant_matieres em
             WHERE em.enseignant_id = $1
           ) x`,
          params
        )
      ]);

      return res.json({
        totalEleves: parseInt(totalElevesResult.rows[0].count),
        totalClasses: parseInt(totalClassesResult.rows[0].count),
        totalEnseignants: 0,
        elevesParCycle: elevesParCycleResult.rows.map(row => ({ _id: row.cycle, count: parseInt(row.count) })),
        recettesTotal: 0,
        devise: 'XOF',
        alertes: {
          paiementsEnAttente: {
            count: 0,
            total: 0
          },
          absencesMois: parseInt(absencesMoisResult.rows[0].count),
          elevesAbsentsSouvent: []
        },
        activiteRecente: {
          derniersEleves: [],
          derniersP: []
        },
        meta: {
          isTeacherView: true,
          notesSaisiesMois: parseInt(notesSaisiesMoisResult.rows[0].count),
          matieresAttribuees: parseInt(matieresAttribueesResult.rows[0].count)
        }
      });
    }

    const p = anneeScolaire ? [anneeScolaire] : [];
    const anneeFilter = anneeScolaire ? ' AND annee_scolaire = $1' : '';
    const anneeFilterC = anneeScolaire ? ' AND c.annee_scolaire = $1' : '';

    const anneeFilterP = anneeScolaire ? ' AND p.annee_scolaire = $1' : '';

    const [
      totalElevesResult,
      totalClassesResult,
      elevesParCycleResult,
      recettesResult,
      paiementsAttenteResult,
      totalEnseignantsResult,
      absencesMoisResult,
      elevesAbsentsResult,
      derniersElevesResult,
      paiementsRecentResult,
      totalAttenduResult,
      impayesResult,
      recettesScolariteResult
    ] = await Promise.all([
      // Élèves actifs
      query(`SELECT COUNT(*) as count FROM eleves WHERE statut = 'ACTIF'${anneeFilter}`, p),
      // Classes
      query(`SELECT COUNT(*) as count FROM classes WHERE 1=1${anneeFilter}`, p),
      // Élèves par cycle
      query(
        `SELECT c.cycle, COUNT(e.id) as count
         FROM eleves e
         JOIN classes c ON e.classe_id = c.id
         WHERE e.statut = 'ACTIF'${anneeFilterC}
         GROUP BY c.cycle`,
        p
      ),
      // Recettes validées (tous types)
      query(`SELECT COALESCE(SUM(montant),0) as total FROM paiements WHERE statut = 'VALIDE'${anneeFilter}`, p),
      // Paiements en attente
      query(
        `SELECT COUNT(*) as count, COALESCE(SUM(montant),0) as total
         FROM paiements WHERE statut = 'EN_ATTENTE'${anneeFilter}`,
        p
      ),
      // Enseignants actifs
      query(`SELECT COUNT(*) as count FROM enseignants WHERE statut = 'ACTIF'`, []),
      // Absences ce mois
      query(
        `SELECT COUNT(*) as count FROM absences
         WHERE date >= date_trunc('month', CURRENT_DATE)${anneeFilter}`,
        p
      ),
      // Élèves avec 3+ absences non justifiées ce mois
      query(
        `SELECT e.id, e.nom, e.prenom, COUNT(a.id) as nb_absences
         FROM absences a
         JOIN eleves e ON a.eleve_id = e.id
         WHERE a.justifiee = false
           AND a.date >= date_trunc('month', CURRENT_DATE)${anneeFilter.replace('annee_scolaire', 'a.annee_scolaire')}
         GROUP BY e.id, e.nom, e.prenom
         HAVING COUNT(a.id) >= 3
         ORDER BY nb_absences DESC
         LIMIT 5`,
        p
      ),
      // Derniers élèves inscrits
      query(
        `SELECT id, nom, prenom, matricule, created_at
         FROM eleves
         WHERE statut = 'ACTIF'${anneeFilter}
         ORDER BY created_at DESC
         LIMIT 5`,
        p
      ),
      // Paiements récents
      query(
        `SELECT p.id, p.montant, p.type_paiement, p.date_paiement, p.statut,
                e.nom as eleve_nom, e.prenom as eleve_prenom
         FROM paiements p
         JOIN eleves e ON p.eleve_id = e.id
         WHERE 1=1${anneeFilterP}
         ORDER BY p.date_paiement DESC, p.created_at DESC
         LIMIT 5`,
        p
      ),
      // Total scolarité attendu (montant_scolarite * nb élèves actifs avec classe)
      query(
        `SELECT COALESCE(SUM(c.montant_scolarite), 0) as total
         FROM eleves e
         JOIN classes c ON e.classe_id = c.id
         WHERE e.statut = 'ACTIF'${anneeFilterC}
           AND c.montant_scolarite > 0`,
        p
      ),
      // Élèves impayés (ont payé moins que montant_scolarite)
      query(
        `SELECT
           COUNT(DISTINCT e.id) as count,
           COALESCE(SUM(c.montant_scolarite - COALESCE(pv.total_paye, 0)), 0) as reste
         FROM eleves e
         JOIN classes c ON e.classe_id = c.id
         LEFT JOIN (
           SELECT eleve_id, SUM(montant) as total_paye
           FROM paiements
           WHERE statut = 'VALIDE' AND type_paiement = 'SCOLARITE'${anneeFilter}
           GROUP BY eleve_id
         ) pv ON pv.eleve_id = e.id
         WHERE e.statut = 'ACTIF'${anneeFilterC}
           AND c.montant_scolarite > 0
           AND COALESCE(pv.total_paye, 0) < c.montant_scolarite`,
        p
      ),
      // Recettes scolarité uniquement (validées)
      query(
        `SELECT COALESCE(SUM(montant), 0) as total
         FROM paiements
         WHERE statut = 'VALIDE' AND type_paiement = 'SCOLARITE'${anneeFilter}`,
        p
      )
    ]);

    const totalAttendu = parseFloat(totalAttenduResult.rows[0].total || 0);
    const elevesImpayes = parseInt(impayesResult.rows[0].count || 0);
    const resteRecouvrer = parseFloat(impayesResult.rows[0].reste || 0);
    const recettesScolarite = parseFloat(recettesScolariteResult.rows[0].total || 0);
    const tauxRecouvrement = totalAttendu > 0 ? Math.round((recettesScolarite / totalAttendu) * 100) : 0;

    res.json({
      totalEleves: parseInt(totalElevesResult.rows[0].count),
      totalClasses: parseInt(totalClassesResult.rows[0].count),
      totalEnseignants: parseInt(totalEnseignantsResult.rows[0].count),
      elevesParCycle: elevesParCycleResult.rows.map(row => ({ _id: row.cycle, count: parseInt(row.count) })),
      recettesTotal: parseFloat(recettesResult.rows[0].total),
      devise: 'XOF',
      paiements: {
        totalAttendu,
        recettesScolarite,
        resteRecouvrer,
        elevesImpayes,
        tauxRecouvrement
      },
      alertes: {
        paiementsEnAttente: {
          count: parseInt(paiementsAttenteResult.rows[0].count),
          total: parseFloat(paiementsAttenteResult.rows[0].total)
        },
        absencesMois: parseInt(absencesMoisResult.rows[0].count),
        elevesAbsentsSouvent: elevesAbsentsResult.rows.map(r => ({
          id: r.id,
          nom: r.nom,
          prenom: r.prenom,
          nbAbsences: parseInt(r.nb_absences)
        }))
      },
      activiteRecente: {
        derniersEleves: derniersElevesResult.rows,
        derniersP: paiementsRecentResult.rows.map(r => ({
          id: r.id,
          montant: parseFloat(r.montant),
          typePaiement: r.type_paiement,
          datePaiement: r.date_paiement,
          statut: r.statut,
          elevenom: `${r.eleve_prenom} ${r.eleve_nom}`
        }))
      }
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
    const role = normalizeValue(req.user?.role);
    const enseignantId = req.user?.enseignant_id || null;

    if (role === 'ENSEIGNANT') {
      if (!enseignantId) {
        return res.status(403).json({ message: 'Compte enseignant non lie a un profil enseignant' });
      }
      const accessResult = await query(
        `SELECT
           EXISTS (
             SELECT 1
             FROM classes c
             WHERE c.id = $1
               AND c.enseignant_principal_id = $2
           ) AS is_principal,
           EXISTS (
             SELECT 1
             FROM classe_matieres cm
             WHERE cm.classe_id = $1
               AND cm.enseignant_id = $2
           ) AS has_subject`,
        [classeId, enseignantId]
      );
      if (!accessResult.rows[0]?.is_principal && !accessResult.rows[0]?.has_subject) {
        return res.status(403).json({ message: 'Acces refuse a ce rapport de classe' });
      }
    }

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
      const periodeCode = convertPeriode(periode);
      if (!periodeCode) {
        return res.status(400).json({ message: 'Periode invalide' });
      }
      notesQuery += ` AND n.periode = $${paramIndex}`;
      notesParams.push(periodeCode);
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

// Rapport de notes (moyennes par classe)
exports.getRapportNotes = async (req, res) => {
  try {
    const { anneeScolaire, periode } = req.query;

    const params = [];
    let paramIndex = 1;
    const classeWhere = [];
    const noteWhere = [];

    if (anneeScolaire) {
      classeWhere.push(`c.annee_scolaire = $${paramIndex}`);
      noteWhere.push(`n.annee_scolaire = $${paramIndex}`);
      params.push(anneeScolaire);
      paramIndex++;
    }

    if (periode) {
      noteWhere.push(`n.periode = $${paramIndex}`);
      params.push(periode);
      paramIndex++;
    }

    const whereClause = classeWhere.length ? `WHERE ${classeWhere.join(' AND ')}` : '';
    const noteJoin = noteWhere.length ? `AND ${noteWhere.join(' AND ')}` : '';

    const sql = `
      SELECT
        c.id,
        c.nom,
        c.cycle,
        c.niveau,
        c.annee_scolaire,
        COUNT(DISTINCT CASE WHEN e.statut = 'ACTIF' THEN e.id END) as effectif,
        COUNT(n.id) as nombre_notes,
        CASE
          WHEN SUM(n.coefficient::numeric) > 0
          THEN ROUND(
            SUM((n.note::numeric / NULLIF(n.note_max::numeric, 0)) * 20 * n.coefficient::numeric) /
            NULLIF(SUM(n.coefficient::numeric), 0),
            2
          )
          ELSE NULL
        END as moyenne_classe
      FROM classes c
      LEFT JOIN eleves e ON e.classe_id = c.id
      LEFT JOIN notes n ON n.classe_id = c.id ${noteJoin}
      ${whereClause}
      GROUP BY c.id, c.nom, c.cycle, c.niveau, c.annee_scolaire
      ORDER BY c.cycle, c.nom
    `;

    const result = await query(sql, params);

    const classes = result.rows.map(row => ({
      id: row.id,
      nom: row.nom,
      cycle: row.cycle,
      niveau: row.niveau,
      anneeScolaire: row.annee_scolaire,
      effectif: parseInt(row.effectif || 0),
      nombreNotes: parseInt(row.nombre_notes || 0),
      moyenneClasse: row.moyenne_classe !== null ? parseFloat(row.moyenne_classe) : null
    }));

    const classesAvecNotes = classes.filter(c => c.moyenneClasse !== null);
    const moyenneGenerale = classesAvecNotes.length > 0
      ? parseFloat((classesAvecNotes.reduce((sum, c) => sum + c.moyenneClasse, 0) / classesAvecNotes.length).toFixed(2))
      : null;

    res.json({
      anneeScolaire: anneeScolaire || null,
      periode: periode || null,
      nombreClasses: classes.length,
      classesAvecNotes: classesAvecNotes.length,
      moyenneGenerale,
      classes
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
