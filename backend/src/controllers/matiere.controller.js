const { query } = require('../lib/db');

// @desc    Obtenir toutes les matières
// @route   GET /api/matieres
exports.getMatieres = async (req, res) => {
  try {
    const { cycle, niveau } = req.query;
    
    let sql = 'SELECT * FROM matieres WHERE 1=1';
    const params = [];
    let paramIndex = 1;

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
    console.error('Erreur lors de la récupération des matières:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir une matière par ID
// @route   GET /api/matieres/:id
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
    console.error('Erreur lors de la récupération de la matière:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer une nouvelle matière
// @route   POST /api/matieres
exports.createMatiere = async (req, res) => {
  try {
    const { nom, code, description, coefficient, niveaux, cycles, couleur } = req.body;

    // Validation
    if (!nom || !code) {
      return res.status(400).json({ message: 'Le nom et le code sont obligatoires' });
    }

    const result = await query(
      `INSERT INTO matieres (nom, code, description, coefficient, niveaux, cycles, couleur)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        nom,
        code,
        description || null,
        coefficient || 1,
        niveaux || [],
        cycles || [],
        couleur || '#3B82F6'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la création de la matière:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Ce code de matière existe déjà' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mettre à jour une matière
// @route   PUT /api/matieres/:id
exports.updateMatiere = async (req, res) => {
  try {
    const { nom, code, description, coefficient, niveaux, cycles, couleur } = req.body;

    const result = await query(
      `UPDATE matieres 
       SET nom = $1, code = $2, description = $3, coefficient = $4, 
           niveaux = $5, cycles = $6, couleur = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [nom, code, description, coefficient, niveaux, cycles, couleur, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la matière:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Ce code de matière existe déjà' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer une matière
// @route   DELETE /api/matieres/:id
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
    console.error('Erreur lors de la suppression de la matière:', error);
    res.status(500).json({ message: error.message });
  }
};
