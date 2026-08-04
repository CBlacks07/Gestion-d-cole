const { query } = require('../lib/db');
const { logAuditEvent } = require('../lib/audit');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const logger = require('../lib/logger');

exports.getEnseignants = async (req, res) => {
  try {
    const { statut, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (statut) {
      where += ` AND e.statut = $${paramIndex}`;
      params.push(statut.toUpperCase());
      paramIndex++;
    }

    if (search) {
      where += ` AND (e.nom ILIKE $${paramIndex} OR e.prenom ILIKE $${paramIndex} OR e.matricule ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Compter le total (avant pagination)
    const countResult = await query(
      `SELECT COUNT(*) as total FROM enseignants e ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Requête principale avec specialites et classes agrégées (évite le N+1)
    const sql = `
      SELECT e.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', em.id,
            'matiere_id', em.matiere_id,
            'matiere', jsonb_build_object('id', m.id, 'nom', m.nom, 'code', m.code, 'coefficient', m.coefficient)
          )) FILTER (WHERE em.id IS NOT NULL),
          '[]'
        ) AS specialites,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', c.id, 'nom', c.nom, 'niveau', c.niveau, 'cycle', c.cycle))
          FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS classes_comme_responsable
      FROM enseignants e
      LEFT JOIN enseignant_matieres em ON em.enseignant_id = e.id
      LEFT JOIN matieres m ON em.matiere_id = m.id
      LEFT JOIN classes c ON c.enseignant_principal_id = e.id
      ${where}
      GROUP BY e.id
      ORDER BY e.nom ASC, e.prenom ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(sql, [...params, limit, offset]);

    const enseignants = result.rows.map(row => ({
      ...row,
      classesCommeResponsable: row.classes_comme_responsable,
      classes_comme_responsable: undefined,
    }));

    res.json(paginatedResponse(enseignants, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEnseignantById = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM enseignants WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    const enseignant = result.rows[0];

    // Récupérer les spécialités (matières)
    const specialitesResult = await query(
      `SELECT em.id, em.matiere_id, m.nom, m.code, m.coefficient
       FROM enseignant_matieres em
       JOIN matieres m ON em.matiere_id = m.id
       WHERE em.enseignant_id = $1`,
      [enseignant.id]
    );

    const specialites = specialitesResult.rows.map(row => ({
      id: row.id,
      matiere_id: row.matiere_id,
      matiere: {
        id: row.matiere_id,
        nom: row.nom,
        code: row.code,
        coefficient: row.coefficient
      }
    }));

    // Récupérer les classes dont il est responsable
    const classesResult = await query(
      'SELECT id, nom, niveau, cycle FROM classes WHERE enseignant_principal_id = $1',
      [enseignant.id]
    );

    res.json({
      ...enseignant,
      specialites,
      classesCommeResponsable: classesResult.rows
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createEnseignant = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.statut) data.statut = data.statut.toUpperCase();
    if (data.sexe) data.sexe = data.sexe.toUpperCase();
    if (data.typeContrat) data.typeContrat = data.typeContrat.toUpperCase();

    // Générer le matricule automatiquement si non fourni
    let matricule = data.matricule;
    if (!matricule) {
      const year = new Date().getFullYear();
      const countResult = await query('SELECT COUNT(*) as count FROM enseignants');
      const count = parseInt(countResult.rows[0].count) + 1;
      matricule = `EN${year}${count.toString().padStart(3, '0')}`;
    }

    const result = await query(
      `INSERT INTO enseignants (
        matricule, nom, prenom, date_naissance, sexe, telephone, email, adresse,
        diplomes, date_recrutement, statut, type_contrat, salaire
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        matricule,
        data.nom,
        data.prenom,
        data.dateNaissance || data.date_naissance,
        data.sexe,
        data.telephone,
        data.email || null,
        data.adresse || null,
        JSON.stringify(data.diplomes || []),
        data.dateRecrutement || data.date_recrutement || new Date(),
        data.statut || 'ACTIF',
        data.typeContrat || data.type_contrat || 'PERMANENT',
        data.salaire || null
      ]
    );

    const enseignantId = result.rows[0].id;

    if (Array.isArray(data.specialiteIds) && data.specialiteIds.length > 0) {
      const insertValues = data.specialiteIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO enseignant_matieres (enseignant_id, matiere_id) VALUES ${insertValues} ON CONFLICT DO NOTHING`,
        [enseignantId, ...data.specialiteIds]
      );
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'ENSEIGNANT_CREATE',
      entity: 'ENSEIGNANT',
      entityId: enseignantId,
      status: 'SUCCESS',
      details: {
        matricule: result.rows[0].matricule,
        nom: result.rows[0].nom,
        prenom: result.rows[0].prenom
      }
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('❌ Erreur création enseignant:', error.message);
    logger.error('Détails:', error.detail || error.hint || error);
    res.status(400).json({ message: error.message });
  }
};

exports.updateEnseignant = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.statut) data.statut = data.statut.toUpperCase();
    if (data.sexe) data.sexe = data.sexe.toUpperCase();
    if (data.typeContrat) data.typeContrat = data.typeContrat.toUpperCase();

    // Construire la requête dynamiquement
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      matricule: 'matricule',
      nom: 'nom',
      prenom: 'prenom',
      dateNaissance: 'date_naissance',
      date_naissance: 'date_naissance',
      sexe: 'sexe',
      telephone: 'telephone',
      email: 'email',
      adresse: 'adresse',
      diplomes: 'diplomes',
      dateRecrutement: 'date_recrutement',
      date_recrutement: 'date_recrutement',
      statut: 'statut',
      typeContrat: 'type_contrat',
      type_contrat: 'type_contrat',
      salaire: 'salaire'
    };

    for (const [key, dbField] of Object.entries(fieldMapping)) {
      if (data[key] !== undefined) {
        if (dbField === 'diplomes') {
          fields.push(`${dbField} = $${paramIndex}`);
          values.push(JSON.stringify(data[key]));
        } else {
          fields.push(`${dbField} = $${paramIndex}`);
          values.push(data[key]);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const sql = `UPDATE enseignants SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    if (Array.isArray(data.specialiteIds)) {
      await query('DELETE FROM enseignant_matieres WHERE enseignant_id = $1', [req.params.id]);
      if (data.specialiteIds.length > 0) {
        const insertValues = data.specialiteIds.map((_, i) => `($1, $${i + 2})`).join(', ');
        await query(
          `INSERT INTO enseignant_matieres (enseignant_id, matiere_id) VALUES ${insertValues} ON CONFLICT DO NOTHING`,
          [req.params.id, ...data.specialiteIds]
        );
      }
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'ENSEIGNANT_UPDATE',
      entity: 'ENSEIGNANT',
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

exports.deleteEnseignant = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM enseignants WHERE id = $1 RETURNING id, nom, prenom',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'ENSEIGNANT_DELETE',
      entity: 'ENSEIGNANT',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        nom: result.rows[0].nom,
        prenom: result.rows[0].prenom
      }
    });

    res.json({ message: 'Enseignant supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
