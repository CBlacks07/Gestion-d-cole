const { query } = require('../lib/db');

exports.getClasses = async (req, res) => {
  try {
    const { cycle, anneeScolaire } = req.query;

    let sql = `
      SELECT c.*,
             e.id as enseignant_id, e.nom as enseignant_nom, e.prenom as enseignant_prenom,
             e.matricule as enseignant_matricule
      FROM classes c
      LEFT JOIN enseignants e ON c.enseignant_principal_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (cycle) {
      sql += ` AND c.cycle = $${paramIndex}`;
      params.push(cycle.toUpperCase());
      paramIndex++;
    }

    if (anneeScolaire) {
      sql += ` AND c.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    sql += ` ORDER BY c.cycle ASC, c.niveau ASC`;

    const result = await query(sql, params);

    // Pour chaque classe, calculer l'effectif actuel
    const classesWithEffectif = await Promise.all(result.rows.map(async (row) => {
      const effectifResult = await query(
        'SELECT COUNT(*) as count FROM eleves WHERE classe_id = $1 AND statut = $2',
        [row.id, 'ACTIF']
      );

      const classe = {
        id: row.id,
        nom: row.nom,
        niveau: row.niveau,
        cycle: row.cycle,
        section: row.section,
        annee_scolaire: row.annee_scolaire,
        enseignant_principal_id: row.enseignant_principal_id,
        effectif_max: row.effectif_max,
        salle: row.salle,
        montant_inscription: row.montant_inscription,
        montant_mensuel: row.montant_mensuel,
        devise: row.devise,
        created_at: row.created_at,
        updated_at: row.updated_at,
        effectifActuel: parseInt(effectifResult.rows[0].count)
      };

      if (row.enseignant_principal_id) {
        classe.enseignantPrincipal = {
          id: row.enseignant_id,
          nom: row.enseignant_nom,
          prenom: row.enseignant_prenom,
          matricule: row.enseignant_matricule
        };
      }

      return classe;
    }));

    res.json(classesWithEffectif);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getClasseById = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*,
              e.id as enseignant_id, e.nom as enseignant_nom, e.prenom as enseignant_prenom,
              e.matricule as enseignant_matricule
       FROM classes c
       LEFT JOIN enseignants e ON c.enseignant_principal_id = e.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    const row = result.rows[0];

    // Récupérer les élèves de la classe
    const elevesResult = await query(
      'SELECT * FROM eleves WHERE classe_id = $1 AND statut = $2 ORDER BY nom, prenom',
      [row.id, 'ACTIF']
    );

    const classe = {
      id: row.id,
      nom: row.nom,
      niveau: row.niveau,
      cycle: row.cycle,
      section: row.section,
      annee_scolaire: row.annee_scolaire,
      enseignant_principal_id: row.enseignant_principal_id,
      effectif_max: row.effectif_max,
      salle: row.salle,
      montant_inscription: row.montant_inscription,
      montant_mensuel: row.montant_mensuel,
      devise: row.devise,
      created_at: row.created_at,
      updated_at: row.updated_at,
      eleves: elevesResult.rows,
      effectifActuel: elevesResult.rows.length
    };

    if (row.enseignant_principal_id) {
      classe.enseignantPrincipal = {
        id: row.enseignant_id,
        nom: row.enseignant_nom,
        prenom: row.enseignant_prenom,
        matricule: row.enseignant_matricule
      };
    }

    res.json(classe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createClasse = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.cycle) data.cycle = data.cycle.toUpperCase();
    if (data.niveau) data.niveau = data.niveau.toUpperCase();

    const result = await query(
      `INSERT INTO classes (
        nom, niveau, cycle, section, annee_scolaire, enseignant_principal_id,
        effectif_max, salle, montant_inscription, montant_mensuel, devise
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.nom,
        data.niveau,
        data.cycle,
        data.section,
        data.anneeScolaire || data.annee_scolaire,
        data.enseignantPrincipalId || data.enseignant_principal_id || null,
        data.effectifMax || data.effectif_max,
        data.salle,
        data.montantInscription || data.montant_inscription,
        data.montantMensuel || data.montant_mensuel,
        data.devise || 'XOF'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateClasse = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.cycle) data.cycle = data.cycle.toUpperCase();
    if (data.niveau) data.niveau = data.niveau.toUpperCase();

    // Construire la requête dynamiquement
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      nom: 'nom',
      niveau: 'niveau',
      cycle: 'cycle',
      section: 'section',
      anneeScolaire: 'annee_scolaire',
      annee_scolaire: 'annee_scolaire',
      enseignantPrincipalId: 'enseignant_principal_id',
      enseignant_principal_id: 'enseignant_principal_id',
      effectifMax: 'effectif_max',
      effectif_max: 'effectif_max',
      salle: 'salle',
      montantInscription: 'montant_inscription',
      montant_inscription: 'montant_inscription',
      montantMensuel: 'montant_mensuel',
      montant_mensuel: 'montant_mensuel',
      devise: 'devise'
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

    const sql = `UPDATE classes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteClasse = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM classes WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    res.json({ message: 'Classe supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
