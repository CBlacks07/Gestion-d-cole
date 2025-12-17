const { query } = require('../lib/db');

// Récupérer les matières d'une classe
exports.getMatieresClasse = async (req, res) => {
  try {
    const { classeId } = req.params;
    const { annee_scolaire } = req.query;

    const result = await query(
      `SELECT cm.*, m.nom, m.code, m.couleur, m.description,
              e.nom as enseignant_nom, e.prenom as enseignant_prenom
       FROM classe_matieres cm
       INNER JOIN matieres m ON cm.matiere_id = m.id
       LEFT JOIN enseignants e ON cm.enseignant_id = e.id
       WHERE cm.classe_id = $1 AND cm.annee_scolaire = $2
       ORDER BY m.nom`,
      [classeId, annee_scolaire]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des matières de la classe:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Ajouter une matière à une classe
exports.addMatiereToClasse = async (req, res) => {
  try {
    const { classe_id, matiere_id, coefficient, enseignant_id, annee_scolaire } = req.body;

    const result = await query(
      `INSERT INTO classe_matieres (classe_id, matiere_id, coefficient, enseignant_id, annee_scolaire)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [classe_id, matiere_id, coefficient || 1, enseignant_id || null, annee_scolaire]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la matière:', error);
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

    const result = await query(
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
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer une matière d'une classe
exports.removeMatiereFromClasse = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM classe_matieres WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json({ message: 'Matière supprimée de la classe' });
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
