const { query } = require('../lib/db');

// Récupérer toutes les années scolaires
exports.getAnnees = async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM annees_scolaires ORDER BY annee DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des années:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer l'année active
exports.getAnneeActive = async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM annees_scolaires WHERE active = true LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Aucune année scolaire active' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'année active:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Créer une nouvelle année scolaire
exports.createAnnee = async (req, res) => {
  try {
    const { annee, date_debut, date_fin, active } = req.body;

    // Si active = true, désactiver les autres années
    if (active) {
      await query(`UPDATE annees_scolaires SET active = false`);
    }

    const result = await query(
      `INSERT INTO annees_scolaires (annee, date_debut, date_fin, active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [annee, date_debut, date_fin, active || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la création de l\'année:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Activer une année scolaire
exports.activerAnnee = async (req, res) => {
  try {
    const { id } = req.params;

    // Désactiver toutes les années
    await query(`UPDATE annees_scolaires SET active = false`);

    // Activer l'année sélectionnée
    const result = await query(
      `UPDATE annees_scolaires
       SET active = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Année scolaire non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de l\'activation de l\'année:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
