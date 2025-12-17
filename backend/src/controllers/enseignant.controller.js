const { query } = require('../lib/db');

exports.getEnseignants = async (req, res) => {
  try {
    const { statut, search } = req.query;

    let sql = `
      SELECT e.*
      FROM enseignants e
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (statut) {
      sql += ` AND e.statut = $${paramIndex}`;
      params.push(statut.toUpperCase());
      paramIndex++;
    }

    if (search) {
      sql += ` AND (e.nom ILIKE $${paramIndex} OR e.prenom ILIKE $${paramIndex} OR e.matricule ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY e.nom ASC, e.prenom ASC`;

    const result = await query(sql, params);

    // Pour chaque enseignant, récupérer ses spécialités et classes responsables
    const enseignants = await Promise.all(result.rows.map(async (enseignant) => {
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

      return {
        ...enseignant,
        specialites,
        classesCommeResponsable: classesResult.rows
      };
    }));

    res.json(enseignants);
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

    const result = await query(
      `INSERT INTO enseignants (
        matricule, nom, prenom, date_naissance, sexe, telephone, email, adresse,
        diplomes, date_recrutement, statut, type_contrat, salaire
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.matricule,
        data.nom,
        data.prenom,
        data.dateNaissance || data.date_naissance,
        data.sexe,
        data.telephone,
        data.email,
        data.adresse,
        JSON.stringify(data.diplomes || []),
        data.dateRecrutement || data.date_recrutement || new Date(),
        data.statut || 'ACTIF',
        data.typeContrat || data.type_contrat || 'CDI',
        data.salaire
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
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

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteEnseignant = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM enseignants WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    res.json({ message: 'Enseignant supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
