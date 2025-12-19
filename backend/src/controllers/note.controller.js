const { query } = require('../lib/db');

exports.getNotes = async (req, res) => {
  try {
    const { eleve, classe, matiere, periode, anneeScolaire } = req.query;

    let sql = `
      SELECT n.*,
             e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
             m.id as matiere_id, m.nom as matiere_nom, m.code as matiere_code, m.coefficient as matiere_coefficient,
             ens.id as enseignant_id, ens.nom as enseignant_nom, ens.prenom as enseignant_prenom
      FROM notes n
      LEFT JOIN eleves e ON n.eleve_id = e.id
      LEFT JOIN matieres m ON n.matiere_id = m.id
      LEFT JOIN enseignants ens ON n.enseignant_id = ens.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (eleve) {
      sql += ` AND n.eleve_id = $${paramIndex}`;
      params.push(eleve);
      paramIndex++;
    }

    if (classe) {
      sql += ` AND n.classe_id = $${paramIndex}`;
      params.push(classe);
      paramIndex++;
    }

    if (matiere) {
      sql += ` AND n.matiere_id = $${paramIndex}`;
      params.push(matiere);
      paramIndex++;
    }

    if (periode) {
      sql += ` AND n.periode = $${paramIndex}`;
      params.push(periode.toUpperCase());
      paramIndex++;
    }

    if (anneeScolaire) {
      sql += ` AND n.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    sql += ` ORDER BY n.date_evaluation DESC`;

    const result = await query(sql, params);

    // Reformater les résultats
    const notes = result.rows.map(row => ({
      id: row.id,
      eleve_id: row.eleve_id,
      matiere_id: row.matiere_id,
      classe_id: row.classe_id,
      enseignant_id: row.enseignant_id,
      type_evaluation: row.type_evaluation,
      periode: row.periode,
      annee_scolaire: row.annee_scolaire,
      note: row.note,
      note_max: row.note_max,
      coefficient: row.coefficient,
      commentaire: row.commentaire,
      date_evaluation: row.date_evaluation,
      created_at: row.created_at,
      updated_at: row.updated_at,
      eleve: row.eleve_id ? {
        id: row.eleve_id,
        nom: row.eleve_nom,
        prenom: row.eleve_prenom,
        matricule: row.eleve_matricule
      } : null,
      matiere: row.matiere_id ? {
        id: row.matiere_id,
        nom: row.matiere_nom,
        code: row.matiere_code,
        coefficient: row.matiere_coefficient
      } : null,
      enseignant: row.enseignant_id ? {
        id: row.enseignant_id,
        nom: row.enseignant_nom,
        prenom: row.enseignant_prenom
      } : null
    }));

    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNoteById = async (req, res) => {
  try {
    const result = await query(
      `SELECT n.*,
              e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
              m.id as matiere_id, m.nom as matiere_nom, m.code as matiere_code, m.coefficient as matiere_coefficient,
              ens.id as enseignant_id, ens.nom as enseignant_nom, ens.prenom as enseignant_prenom
       FROM notes n
       LEFT JOIN eleves e ON n.eleve_id = e.id
       LEFT JOIN matieres m ON n.matiere_id = m.id
       LEFT JOIN enseignants ens ON n.enseignant_id = ens.id
       WHERE n.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Note non trouvée' });
    }

    const row = result.rows[0];
    const note = {
      id: row.id,
      eleve_id: row.eleve_id,
      matiere_id: row.matiere_id,
      classe_id: row.classe_id,
      enseignant_id: row.enseignant_id,
      type_evaluation: row.type_evaluation,
      periode: row.periode,
      annee_scolaire: row.annee_scolaire,
      note: row.note,
      note_max: row.note_max,
      coefficient: row.coefficient,
      commentaire: row.commentaire,
      date_evaluation: row.date_evaluation,
      created_at: row.created_at,
      updated_at: row.updated_at,
      eleve: row.eleve_id ? {
        id: row.eleve_id,
        nom: row.eleve_nom,
        prenom: row.eleve_prenom,
        matricule: row.eleve_matricule
      } : null,
      matiere: row.matiere_id ? {
        id: row.matiere_id,
        nom: row.matiere_nom,
        code: row.matiere_code,
        coefficient: row.matiere_coefficient
      } : null,
      enseignant: row.enseignant_id ? {
        id: row.enseignant_id,
        nom: row.enseignant_nom,
        prenom: row.enseignant_prenom
      } : null
    };

    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fonction utilitaire pour convertir les périodes
const convertPeriode = (periode) => {
  if (!periode) return null;

  const periodeMap = {
    '1ER TRIMESTRE': 'PREMIER_TRIMESTRE',
    '2ÈME TRIMESTRE': 'DEUXIEME_TRIMESTRE',
    '2EME TRIMESTRE': 'DEUXIEME_TRIMESTRE',
    '3ÈME TRIMESTRE': 'TROISIEME_TRIMESTRE',
    '3EME TRIMESTRE': 'TROISIEME_TRIMESTRE',
    'PREMIER TRIMESTRE': 'PREMIER_TRIMESTRE',
    'DEUXIEME TRIMESTRE': 'DEUXIEME_TRIMESTRE',
    'TROISIEME TRIMESTRE': 'TROISIEME_TRIMESTRE'
  };

  const normalized = periode.toUpperCase();
  return periodeMap[normalized] || normalized.replace(/ /g, '_');
};

exports.createNote = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.typeEvaluation) data.typeEvaluation = data.typeEvaluation.toUpperCase();
    if (data.type_evaluation) data.type_evaluation = data.type_evaluation.toUpperCase();
    if (data.periode) data.periode = convertPeriode(data.periode);

    const result = await query(
      `INSERT INTO notes (
        eleve_id, matiere_id, classe_id, enseignant_id, type_evaluation,
        periode, annee_scolaire, note, note_max, coefficient, commentaire, date_evaluation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.eleveId || data.eleve_id,
        data.matiereId || data.matiere_id,
        data.classeId || data.classe_id,
        data.enseignantId || data.enseignant_id,
        data.typeEvaluation || data.type_evaluation,
        data.periode,
        data.anneeScolaire || data.annee_scolaire,
        data.note,
        data.noteMax || data.note_max || 20,
        data.coefficient,
        data.commentaire,
        data.dateEvaluation || data.date_evaluation || new Date()
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.typeEvaluation) data.typeEvaluation = data.typeEvaluation.toUpperCase();
    if (data.type_evaluation) data.type_evaluation = data.type_evaluation.toUpperCase();
    if (data.periode) data.periode = convertPeriode(data.periode);

    // Construire la requête dynamiquement
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      eleveId: 'eleve_id',
      eleve_id: 'eleve_id',
      matiereId: 'matiere_id',
      matiere_id: 'matiere_id',
      classeId: 'classe_id',
      classe_id: 'classe_id',
      enseignantId: 'enseignant_id',
      enseignant_id: 'enseignant_id',
      typeEvaluation: 'type_evaluation',
      type_evaluation: 'type_evaluation',
      periode: 'periode',
      anneeScolaire: 'annee_scolaire',
      annee_scolaire: 'annee_scolaire',
      note: 'note',
      noteMax: 'note_max',
      note_max: 'note_max',
      coefficient: 'coefficient',
      commentaire: 'commentaire',
      dateEvaluation: 'date_evaluation',
      date_evaluation: 'date_evaluation'
    };

    for (const [key, dbField] of Object.entries(fieldMapping)) {
      if (data[key] !== undefined) {
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(data[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const sql = `UPDATE notes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Note non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM notes WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
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

    // Récupérer l'élève avec sa classe
    const eleveResult = await query(
      `SELECT e.*,
              c.id as classe_id, c.nom as classe_nom, c.niveau as classe_niveau, c.cycle as classe_cycle
       FROM eleves e
       LEFT JOIN classes c ON e.classe_id = c.id
       WHERE e.id = $1`,
      [eleveId]
    );

    if (eleveResult.rows.length === 0) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    const eleveRow = eleveResult.rows[0];
    const eleve = {
      id: eleveRow.id,
      matricule: eleveRow.matricule,
      nom: eleveRow.nom,
      prenom: eleveRow.prenom,
      date_naissance: eleveRow.date_naissance,
      sexe: eleveRow.sexe,
      classe: eleveRow.classe_id ? {
        id: eleveRow.classe_id,
        nom: eleveRow.classe_nom,
        niveau: eleveRow.classe_niveau,
        cycle: eleveRow.classe_cycle
      } : null
    };

    // Récupérer les notes avec les matières
    const notesResult = await query(
      `SELECT n.*, m.nom as matiere_nom, m.code as matiere_code, m.coefficient as matiere_coefficient
       FROM notes n
       JOIN matieres m ON n.matiere_id = m.id
       WHERE n.eleve_id = $1 AND n.periode = $2 AND n.annee_scolaire = $3`,
      [eleveId, convertPeriode(periode), anneeScolaire]
    );

    // Calculer les moyennes par matière
    const notesParMatiere = {};
    notesResult.rows.forEach(note => {
      const matiereId = note.matiere_id;
      if (!notesParMatiere[matiereId]) {
        notesParMatiere[matiereId] = {
          matiere: {
            id: note.matiere_id,
            nom: note.matiere_nom,
            code: note.matiere_code,
            coefficient: note.matiere_coefficient
          },
          notes: [],
          moyenne: 0
        };
      }
      notesParMatiere[matiereId].notes.push({
        id: note.id,
        note: parseFloat(note.note),
        note_max: parseFloat(note.note_max),
        type_evaluation: note.type_evaluation,
        date_evaluation: note.date_evaluation
      });
    });

    // Calculer la moyenne par matière et la moyenne générale
    let totalPoints = 0;
    let totalCoefficients = 0;

    Object.values(notesParMatiere).forEach(item => {
      const sommeNotes = item.notes.reduce((sum, n) => sum + parseFloat(n.note), 0);
      item.moyenne = sommeNotes / item.notes.length;
      const coef = parseFloat(item.matiere.coefficient);
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
