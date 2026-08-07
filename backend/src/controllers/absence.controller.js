const { queryScoped } = require('../lib/db');
const { logAuditEvent } = require('../lib/audit');

exports.getAbsences = async (req, res) => {
  try {
    const { eleve, classe, date, anneeScolaire, justifiee } = req.query;

    let sql = `
      SELECT a.*,
             e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
             c.id as classe_id, c.nom as classe_nom,
             m.id as matiere_id, m.nom as matiere_nom
      FROM absences a
      LEFT JOIN eleves e ON a.eleve_id = e.id
      LEFT JOIN classes c ON a.classe_id = c.id
      LEFT JOIN matieres m ON a.matiere_id = m.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (eleve) {
      sql += ` AND a.eleve_id = $${paramIndex}`;
      params.push(eleve);
      paramIndex++;
    }

    if (classe) {
      sql += ` AND a.classe_id = $${paramIndex}`;
      params.push(classe);
      paramIndex++;
    }

    if (date) {
      sql += ` AND DATE(a.date) = DATE($${paramIndex})`;
      params.push(date);
      paramIndex++;
    }

    if (anneeScolaire) {
      sql += ` AND a.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    if (justifiee !== undefined) {
      sql += ` AND a.justifiee = $${paramIndex}`;
      params.push(justifiee === true || justifiee === 'true');
      paramIndex++;
    }

    sql += ` ORDER BY a.date DESC`;

    const result = await queryScoped(req.ecoleId, sql, params);

    // Reformater les résultats
    const absences = result.rows.map(row => ({
      id: row.id,
      eleve_id: row.eleve_id,
      classe_id: row.classe_id,
      date: row.date,
      matiere_id: row.matiere_id,
      periode: row.periode,
      justifiee: row.justifiee,
      motif: row.motif,
      justificatif: row.justificatif,
      annee_scolaire: row.annee_scolaire,
      enregistre_par_id: row.enregistre_par_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      eleve: row.eleve_id ? {
        id: row.eleve_id,
        nom: row.eleve_nom,
        prenom: row.eleve_prenom,
        matricule: row.eleve_matricule
      } : null,
      classe: row.classe_id ? {
        id: row.classe_id,
        nom: row.classe_nom
      } : null,
      matiere: row.matiere_id ? {
        id: row.matiere_id,
        nom: row.matiere_nom
      } : null
    }));

    res.json(absences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAbsenceById = async (req, res) => {
  try {
    const result = await queryScoped(
      req.ecoleId,
      `SELECT a.*,
              e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
              c.id as classe_id, c.nom as classe_nom,
              m.id as matiere_id, m.nom as matiere_nom
       FROM absences a
       LEFT JOIN eleves e ON a.eleve_id = e.id
       LEFT JOIN classes c ON a.classe_id = c.id
       LEFT JOIN matieres m ON a.matiere_id = m.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Absence non trouvée' });
    }

    const row = result.rows[0];
    const absence = {
      id: row.id,
      eleve_id: row.eleve_id,
      classe_id: row.classe_id,
      date: row.date,
      matiere_id: row.matiere_id,
      periode: row.periode,
      justifiee: row.justifiee,
      motif: row.motif,
      justificatif: row.justificatif,
      annee_scolaire: row.annee_scolaire,
      enregistre_par_id: row.enregistre_par_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      eleve: row.eleve_id ? {
        id: row.eleve_id,
        nom: row.eleve_nom,
        prenom: row.eleve_prenom,
        matricule: row.eleve_matricule
      } : null,
      classe: row.classe_id ? {
        id: row.classe_id,
        nom: row.classe_nom
      } : null,
      matiere: row.matiere_id ? {
        id: row.matiere_id,
        nom: row.matiere_nom
      } : null
    };

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

    if (data.periode) {
      data.periode = data.periode.toUpperCase().replace(/[\s-]+/g, '_');
    }

    const result = await queryScoped(
      req.ecoleId,
      `INSERT INTO absences (
        eleve_id, classe_id, date, matiere_id, periode, justifiee,
        motif, justificatif, annee_scolaire, enregistre_par_id, ecole_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.eleveId || data.eleve_id,
        data.classeId || data.classe_id,
        data.date || new Date(),
        data.matiereId || data.matiere_id || null,
        data.periode || null,
        data.justifiee !== undefined ? data.justifiee : false,
        data.motif || null,
        data.justificatif || null,
        data.anneeScolaire || data.annee_scolaire,
        data.enregistreParId || data.enregistre_par_id,
        req.ecoleId
      ]
    );

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'ABSENCE_CREATE',
      entity: 'ABSENCE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        eleveId: result.rows[0].eleve_id,
        classeId: result.rows[0].classe_id,
        anneeScolaire: result.rows[0].annee_scolaire
      }
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateAbsence = async (req, res) => {
  try {
    const data = { ...req.body };

    if (data.periode) {
      data.periode = data.periode.toUpperCase().replace(/[\s-]+/g, '_');
    }

    // Construire la requête dynamiquement
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      eleveId: 'eleve_id',
      eleve_id: 'eleve_id',
      classeId: 'classe_id',
      classe_id: 'classe_id',
      date: 'date',
      matiereId: 'matiere_id',
      matiere_id: 'matiere_id',
      periode: 'periode',
      justifiee: 'justifiee',
      motif: 'motif',
      justificatif: 'justificatif',
      anneeScolaire: 'annee_scolaire',
      annee_scolaire: 'annee_scolaire'
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

    const sql = `UPDATE absences SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await queryScoped(req.ecoleId, sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Absence non trouvée' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'ABSENCE_UPDATE',
      entity: 'ABSENCE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        fields: Object.keys(data)
      }
    });

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteAbsence = async (req, res) => {
  try {
    const result = await queryScoped(
      req.ecoleId,
      'DELETE FROM absences WHERE id = $1 RETURNING id, eleve_id, classe_id, annee_scolaire',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Absence non trouvée' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'ABSENCE_DELETE',
      entity: 'ABSENCE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        eleveId: result.rows[0].eleve_id,
        classeId: result.rows[0].classe_id,
        anneeScolaire: result.rows[0].annee_scolaire
      }
    });

    res.json({ message: 'Absence supprimee avec succes' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtenir les statistiques d'absences pour un élève
exports.getAbsenceStats = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { anneeScolaire } = req.query;

    let whereClause = 'WHERE eleve_id = $1';
    const params = [eleveId];

    if (anneeScolaire) {
      whereClause += ' AND annee_scolaire = $2';
      params.push(anneeScolaire);
    }

    // Total d'absences
    const totalResult = await queryScoped(
      req.ecoleId,
      `SELECT COUNT(*) as count FROM absences ${whereClause}`,
      params
    );

    // Absences justifiées
    const justifieesResult = await queryScoped(
      req.ecoleId,
      `SELECT COUNT(*) as count FROM absences ${whereClause} AND justifiee = true`,
      params
    );

    const total = parseInt(totalResult.rows[0].count);
    const justifiees = parseInt(justifieesResult.rows[0].count);
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
