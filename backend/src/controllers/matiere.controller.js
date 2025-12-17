const { query } = require('../lib/db');

exports.getMatieres = async (req, res) => {
  try {
    const { cycle, niveau } = req.query;

    let sql = 'SELECT * FROM matieres WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Pour les arrays PostgreSQL, utiliser l'opérateur @> (contains)
    if (cycle) {
      sql += ` AND $${paramIndex} = ANY(cycles)`;
      params.push(cycle.toUpperCase());
      paramIndex++;
    }

    if (niveau) {
      sql += ` AND $${paramIndex} = ANY(niveaux)`;
      params.push(niveau.toUpperCase());
      paramIndex++;
    }

    sql += ' ORDER BY nom ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMatiereById = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM matieres WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createMatiere = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules pour les arrays
    let cycles = [];
    if (data.cycles && Array.isArray(data.cycles)) {
      cycles = data.cycles.map(c => c.toUpperCase());
    }

    let niveaux = [];
    if (data.niveaux && Array.isArray(data.niveaux)) {
      niveaux = data.niveaux.map(n => n.toUpperCase());
    }

    const result = await query(
      `INSERT INTO matieres (nom, code, description, coefficient, niveaux, cycles, couleur)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.nom,
        data.code,
        data.description,
        data.coefficient,
        niveaux,
        cycles,
        data.couleur
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateMatiere = async (req, res) => {
  try {
    const data = { ...req.body };

    // Construire la requête dynamiquement
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.nom !== undefined) {
      fields.push(`nom = $${paramIndex}`);
      values.push(data.nom);
      paramIndex++;
    }

    if (data.code !== undefined) {
      fields.push(`code = $${paramIndex}`);
      values.push(data.code);
      paramIndex++;
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }

    if (data.coefficient !== undefined) {
      fields.push(`coefficient = $${paramIndex}`);
      values.push(data.coefficient);
      paramIndex++;
    }

    if (data.niveaux !== undefined && Array.isArray(data.niveaux)) {
      fields.push(`niveaux = $${paramIndex}`);
      values.push(data.niveaux.map(n => n.toUpperCase()));
      paramIndex++;
    }

    if (data.cycles !== undefined && Array.isArray(data.cycles)) {
      fields.push(`cycles = $${paramIndex}`);
      values.push(data.cycles.map(c => c.toUpperCase()));
      paramIndex++;
    }

    if (data.couleur !== undefined) {
      fields.push(`couleur = $${paramIndex}`);
      values.push(data.couleur);
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const sql = `UPDATE matieres SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteMatiere = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM matieres WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json({ message: 'Matière supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
