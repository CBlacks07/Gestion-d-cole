const { query } = require('../lib/db');

exports.getPaiements = async (req, res) => {
  try {
    const { eleve, typePaiement, anneeScolaire, statut } = req.query;

    let sql = `
      SELECT p.*,
             e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
             u.id as user_id, u.nom as user_nom, u.prenom as user_prenom
      FROM paiements p
      LEFT JOIN eleves e ON p.eleve_id = e.id
      LEFT JOIN users u ON p.enregistre_par_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (eleve) {
      sql += ` AND p.eleve_id = $${paramIndex}`;
      params.push(eleve);
      paramIndex++;
    }

    if (typePaiement) {
      sql += ` AND p.type_paiement = $${paramIndex}`;
      params.push(typePaiement.toUpperCase());
      paramIndex++;
    }

    if (anneeScolaire) {
      sql += ` AND p.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    if (statut) {
      sql += ` AND p.statut = $${paramIndex}`;
      params.push(statut.toUpperCase());
      paramIndex++;
    }

    sql += ` ORDER BY p.date_paiement DESC`;

    const result = await query(sql, params);

    // Reformater les résultats
    const paiements = result.rows.map(row => ({
      id: row.id,
      eleve_id: row.eleve_id,
      type_paiement: row.type_paiement,
      montant: row.montant,
      devise: row.devise,
      date_paiement: row.date_paiement,
      mois_concerne: row.mois_concerne,
      annee_scolaire: row.annee_scolaire,
      mode_paiement: row.mode_paiement,
      numero_piece: row.numero_piece,
      statut: row.statut,
      remarques: row.remarques,
      enregistre_par_id: row.enregistre_par_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      eleve: row.eleve_id ? {
        id: row.eleve_id,
        nom: row.eleve_nom,
        prenom: row.eleve_prenom,
        matricule: row.eleve_matricule
      } : null,
      enregistrePar: row.user_id ? {
        nom: row.user_nom,
        prenom: row.user_prenom
      } : null
    }));

    res.json(paiements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPaiementById = async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*,
              e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
              u.id as user_id, u.nom as user_nom, u.prenom as user_prenom
       FROM paiements p
       LEFT JOIN eleves e ON p.eleve_id = e.id
       LEFT JOIN users u ON p.enregistre_par_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    const row = result.rows[0];
    const paiement = {
      id: row.id,
      eleve_id: row.eleve_id,
      type_paiement: row.type_paiement,
      montant: row.montant,
      devise: row.devise,
      date_paiement: row.date_paiement,
      mois_concerne: row.mois_concerne,
      annee_scolaire: row.annee_scolaire,
      mode_paiement: row.mode_paiement,
      numero_piece: row.numero_piece,
      statut: row.statut,
      remarques: row.remarques,
      enregistre_par_id: row.enregistre_par_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      eleve: row.eleve_id ? {
        id: row.eleve_id,
        nom: row.eleve_nom,
        prenom: row.eleve_prenom,
        matricule: row.eleve_matricule
      } : null,
      enregistrePar: row.user_id ? {
        id: row.user_id,
        nom: row.user_nom,
        prenom: row.user_prenom
      } : null
    };

    res.json(paiement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPaiement = async (req, res) => {
  try {
    const data = {
      ...req.body,
      enregistreParId: req.user.id
    };

    // Convertir les enums en majuscules
    if (data.typePaiement) data.typePaiement = data.typePaiement.toUpperCase();
    if (data.type_paiement) data.type_paiement = data.type_paiement.toUpperCase();
    if (data.modePaiement) data.modePaiement = data.modePaiement.toUpperCase();
    if (data.mode_paiement) data.mode_paiement = data.mode_paiement.toUpperCase();
    if (data.statut) data.statut = data.statut.toUpperCase();

    const result = await query(
      `INSERT INTO paiements (
        eleve_id, type_paiement, montant, devise, date_paiement, mois_concerne,
        annee_scolaire, mode_paiement, numero_piece, statut, remarques, enregistre_par_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.eleveId || data.eleve_id,
        data.typePaiement || data.type_paiement,
        data.montant,
        data.devise || 'XOF',
        data.datePaiement || data.date_paiement || new Date(),
        data.moisConcerne || data.mois_concerne || null,
        data.anneeScolaire || data.annee_scolaire,
        data.modePaiement || data.mode_paiement,
        data.numeroPiece || data.numero_piece || null,
        data.statut || 'VALIDE',
        data.remarques || null,
        data.enregistreParId || data.enregistre_par_id
      ]
    );

    // Récupérer l'élève pour la réponse
    const paiementWithEleve = await query(
      `SELECT p.*,
              e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom
       FROM paiements p
       LEFT JOIN eleves e ON p.eleve_id = e.id
       WHERE p.id = $1`,
      [result.rows[0].id]
    );

    const row = paiementWithEleve.rows[0];
    const paiement = {
      ...row,
      eleve: row.eleve_id ? {
        id: row.eleve_id,
        nom: row.eleve_nom,
        prenom: row.eleve_prenom
      } : null
    };

    res.status(201).json(paiement);
  } catch (error) {
    console.error('❌ Erreur création paiement:', error.message);
    console.error('Détails:', error.detail || error.hint || error);
    res.status(400).json({ message: error.message });
  }
};

exports.updatePaiement = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.typePaiement) data.typePaiement = data.typePaiement.toUpperCase();
    if (data.type_paiement) data.type_paiement = data.type_paiement.toUpperCase();
    if (data.modePaiement) data.modePaiement = data.modePaiement.toUpperCase();
    if (data.mode_paiement) data.mode_paiement = data.mode_paiement.toUpperCase();
    if (data.statut) data.statut = data.statut.toUpperCase();

    // Construire la requête dynamiquement
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      eleveId: 'eleve_id',
      eleve_id: 'eleve_id',
      typePaiement: 'type_paiement',
      type_paiement: 'type_paiement',
      montant: 'montant',
      devise: 'devise',
      datePaiement: 'date_paiement',
      date_paiement: 'date_paiement',
      moisConcerne: 'mois_concerne',
      mois_concerne: 'mois_concerne',
      anneeScolaire: 'annee_scolaire',
      annee_scolaire: 'annee_scolaire',
      modePaiement: 'mode_paiement',
      mode_paiement: 'mode_paiement',
      numeroPiece: 'numero_piece',
      numero_piece: 'numero_piece',
      statut: 'statut',
      remarques: 'remarques'
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

    const sql = `UPDATE paiements SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deletePaiement = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM paiements WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    res.json({ message: 'Paiement supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtenir l'historique des paiements d'un élève
exports.getHistoriquePaiements = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { anneeScolaire } = req.query;

    let sql = 'SELECT * FROM paiements WHERE eleve_id = $1';
    const params = [eleveId];

    if (anneeScolaire) {
      sql += ' AND annee_scolaire = $2';
      params.push(anneeScolaire);
    }

    sql += ' ORDER BY date_paiement DESC';

    const result = await query(sql, params);

    // Calculer le total payé (seulement les paiements validés)
    const totalPaye = result.rows
      .filter(p => p.statut === 'VALIDE')
      .reduce((sum, p) => sum + parseFloat(p.montant), 0);

    res.json({
      paiements: result.rows,
      totalPaye,
      devise: 'XOF'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Statistiques des paiements
exports.getPaiementStats = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;

    let whereClause = "WHERE statut = 'VALIDE'";
    const params = [];

    if (anneeScolaire) {
      whereClause += ' AND annee_scolaire = $1';
      params.push(anneeScolaire);
    }

    // Total des paiements
    const totalResult = await query(
      `SELECT COUNT(*) as count FROM paiements ${whereClause}`,
      params
    );

    // Montant total
    const montantResult = await query(
      `SELECT SUM(montant) as total FROM paiements ${whereClause}`,
      params
    );

    // Par type de paiement
    const parTypeResult = await query(
      `SELECT type_paiement, SUM(montant) as total, COUNT(*) as count
       FROM paiements ${whereClause}
       GROUP BY type_paiement`,
      params
    );

    const parType = parTypeResult.rows.map(row => ({
      _id: row.type_paiement,
      total: parseFloat(row.total || 0),
      count: parseInt(row.count)
    }));

    res.json({
      totalPaiements: parseInt(totalResult.rows[0].count),
      montantTotal: parseFloat(montantResult.rows[0].total || 0),
      devise: 'XOF',
      parType
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
