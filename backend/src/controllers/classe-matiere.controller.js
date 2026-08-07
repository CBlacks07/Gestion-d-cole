const { queryScoped } = require('../lib/db');
const logger = require('../lib/logger');

// Récupérer les matières d'une classe
exports.getMatieresClasse = async (req, res) => {
  try {
    const { classeId } = req.params;
    const { annee_scolaire } = req.query;

    const result = await queryScoped(
      req.ecoleId,
      `SELECT cm.*, m.nom, m.code, m.couleur, m.description,
              e.nom as enseignant_nom, e.prenom as enseignant_prenom
       FROM classe_matieres cm
       INNER JOIN classes c ON cm.classe_id = c.id
       INNER JOIN matieres m ON cm.matiere_id = m.id
       LEFT JOIN enseignants e ON cm.enseignant_id = e.id
       WHERE cm.classe_id = $1 AND cm.annee_scolaire = $2
         AND (
           COALESCE(array_length(m.cycles, 1), 0) = 0
           OR c.cycle = ANY(m.cycles)
         )
         AND (
           COALESCE(array_length(m.niveaux, 1), 0) = 0
           OR c.niveau = ANY(m.niveaux)
         )
       ORDER BY m.nom`,
      [classeId, annee_scolaire]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Erreur lors de la récupération des matières de la classe:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Ajouter une matière à une classe
exports.addMatiereToClasse = async (req, res) => {
  try {
    const { classe_id, matiere_id, coefficient, enseignant_id, annee_scolaire } = req.body;
    if (!classe_id || !matiere_id || !annee_scolaire) {
      return res.status(400).json({ message: 'classe_id, matiere_id et annee_scolaire sont obligatoires' });
    }

    const compatibilityResult = await queryScoped(
      req.ecoleId,
      `SELECT
         c.cycle::text AS classe_cycle,
         c.niveau::text AS classe_niveau,
         m.cycles::text[] AS cycles,
         m.niveaux::text[] AS niveaux,
         m.coefficient AS matiere_coefficient
       FROM classes c
       INNER JOIN matieres m ON m.id = $2
       WHERE c.id = $1`,
      [classe_id, matiere_id]
    );

    if (compatibilityResult.rows.length === 0) {
      return res.status(404).json({ message: 'Classe ou matiere introuvable' });
    }

    const {
      classe_cycle,
      classe_niveau,
      cycles,
      niveaux,
      matiere_coefficient
    } = compatibilityResult.rows[0];
    const cycleList = Array.isArray(cycles) ? cycles : [];
    const niveauList = Array.isArray(niveaux) ? niveaux : [];
    const isCycleCompatible = cycleList.length === 0 || cycleList.includes(classe_cycle);
    const isNiveauCompatible = niveauList.length === 0 || niveauList.includes(classe_niveau);
    const parsedCoefficient = parseInt(coefficient, 10);
    const resolvedCoefficient =
      Number.isFinite(parsedCoefficient) && parsedCoefficient > 0
        ? parsedCoefficient
        : parseInt(matiere_coefficient, 10) || 1;

    if (!isCycleCompatible || !isNiveauCompatible) {
      return res.status(400).json({
        message: 'La matiere selectionnee n est pas compatible avec le cycle ou le niveau de cette classe'
      });
    }

    const result = await queryScoped(
      req.ecoleId,
      `INSERT INTO classe_matieres (classe_id, matiere_id, coefficient, enseignant_id, annee_scolaire, ecole_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [classe_id, matiere_id, resolvedCoefficient, enseignant_id || null, annee_scolaire, req.ecoleId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de l\'ajout de la matière:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ message: 'Cette matière est déjà assignée à cette classe pour cette année' });
    }
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Modifier l'enseignant d'une matière dans une classe
exports.updateMatiereClasse = async (req, res) => {
  try {
    const { id } = req.params;
    const { enseignant_id, coefficient } = req.body;

    const result = await queryScoped(
      req.ecoleId,
      `UPDATE classe_matieres
       SET enseignant_id = $1, coefficient = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [enseignant_id || null, coefficient, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer une matière d'une classe
exports.removeMatiereFromClasse = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await queryScoped(
      req.ecoleId,
      `DELETE FROM classe_matieres WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json({ message: 'Matière supprimée de la classe' });
  } catch (error) {
    logger.error('Erreur lors de la suppression:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
