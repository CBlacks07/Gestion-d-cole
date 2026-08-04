const { query } = require('../lib/db');
const { logAuditEvent } = require('../lib/audit');
const logger = require('../lib/logger');

// @desc    Obtenir toutes les matieres
// @route   GET /api/matieres
exports.getMatieres = async (req, res) => {
  try {
    const { cycle, niveau } = req.query;

    let sql = `
      SELECT
        id,
        nom,
        code,
        description,
        coefficient,
        niveaux::text[] AS niveaux,
        cycles::text[] AS cycles,
        couleur,
        created_at,
        updated_at
      FROM matieres
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (cycle) {
      sql += ` AND ($${paramIndex} = ANY(cycles) OR COALESCE(array_length(cycles, 1), 0) = 0)`;
      params.push(cycle.toUpperCase());
      paramIndex++;
    }

    if (niveau) {
      sql += ` AND ($${paramIndex} = ANY(niveaux) OR COALESCE(array_length(niveaux, 1), 0) = 0)`;
      params.push(niveau.toUpperCase());
      paramIndex++;
    }

    sql += ' ORDER BY nom ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Erreur lors de la recuperation des matieres:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir une matiere par ID
// @route   GET /api/matieres/:id
exports.getMatiereById = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         id,
         nom,
         code,
         description,
         coefficient,
         niveaux::text[] AS niveaux,
         cycles::text[] AS cycles,
         couleur,
         created_at,
         updated_at
       FROM matieres
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matiere non trouvee' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la recuperation de la matiere:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Creer une nouvelle matiere
// @route   POST /api/matieres
exports.createMatiere = async (req, res) => {
  try {
    const { nom, code, description, coefficient, niveaux, cycles, couleur } = req.body;

    if (!nom || !code) {
      return res.status(400).json({ message: 'Le nom et le code sont obligatoires' });
    }

    const result = await query(
      `INSERT INTO matieres (nom, code, description, coefficient, niveaux, cycles, couleur)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id,
         nom,
         code,
         description,
         coefficient,
         niveaux::text[] AS niveaux,
         cycles::text[] AS cycles,
         couleur,
         created_at,
         updated_at`,
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

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'MATIERE_CREATE',
      entity: 'MATIERE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        nom: result.rows[0].nom,
        code: result.rows[0].code,
        coefficient: result.rows[0].coefficient
      }
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la creation de la matiere:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Ce code de matiere existe deja' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mettre a jour une matiere
// @route   PUT /api/matieres/:id
exports.updateMatiere = async (req, res) => {
  try {
    const { nom, code, description, coefficient, niveaux, cycles, couleur } = req.body;

    const result = await query(
      `UPDATE matieres
       SET nom = $1, code = $2, description = $3, coefficient = $4,
           niveaux = $5, cycles = $6, couleur = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING
         id,
         nom,
         code,
         description,
         coefficient,
         niveaux::text[] AS niveaux,
         cycles::text[] AS cycles,
         couleur,
         created_at,
         updated_at`,
      [nom, code, description, coefficient, niveaux, cycles, couleur, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matiere non trouvee' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'MATIERE_UPDATE',
      entity: 'MATIERE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        nom: result.rows[0].nom,
        code: result.rows[0].code,
        coefficient: result.rows[0].coefficient
      }
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la mise a jour de la matiere:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Ce code de matiere existe deja' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer une matiere
// @route   DELETE /api/matieres/:id
exports.deleteMatiere = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM matieres WHERE id = $1 RETURNING id, nom, code',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matiere non trouvee' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'MATIERE_DELETE',
      entity: 'MATIERE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        nom: result.rows[0].nom,
        code: result.rows[0].code
      }
    });

    res.json({ message: 'Matiere supprimee avec succes' });
  } catch (error) {
    logger.error('Erreur lors de la suppression de la matiere:', error);
    res.status(500).json({ message: error.message });
  }
};
