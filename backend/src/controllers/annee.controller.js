const { query } = require('../lib/db');
const logger = require('../lib/logger');

// Récupérer toutes les années scolaires
exports.getAnnees = async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM annees_scolaires ORDER BY annee DESC`
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Erreur lors de la récupération des années:', error);
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
    logger.error('Erreur lors de la récupération de l\'année active:', error);
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
    logger.error('Erreur lors de la création de l\'année:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Modifier une année scolaire (date_fin, date_debut)
exports.updateAnnee = async (req, res) => {
  try {
    const { id } = req.params;
    const { date_debut, date_fin } = req.body;

    if (!date_fin) {
      return res.status(400).json({ message: 'La date de fin est requise' });
    }

    // Vérifier que l'année existe
    const existing = await query('SELECT * FROM annees_scolaires WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Année scolaire non trouvée' });
    }

    const annee = existing.rows[0];
    const newDateDebut = date_debut || annee.date_debut;
    const newDateFin = date_fin;

    // Vérifier que date_fin > date_debut
    if (new Date(newDateFin) <= new Date(newDateDebut)) {
      return res.status(400).json({ message: 'La date de fin doit être postérieure à la date de début' });
    }

    const result = await query(
      `UPDATE annees_scolaires
       SET date_debut = $1, date_fin = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newDateDebut, newDateFin, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la modification de l\'année:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Clôturer une année scolaire
exports.cloturerAnnee = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM annees_scolaires WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Année scolaire non trouvée' });
    }

    const annee = existing.rows[0];

    if (!annee.active) {
      return res.status(400).json({ message: 'Seule l\'année active peut être clôturée' });
    }

    // Désactiver l'année (clôturer = désactiver sans en activer une autre)
    const result = await query(
      `UPDATE annees_scolaires
       SET active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la clôture de l\'année:', error);
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
    logger.error('Erreur lors de l\'activation de l\'année:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
