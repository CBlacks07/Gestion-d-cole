const { queryScoped } = require('../lib/db');
const { logAuditEvent } = require('../lib/audit');

exports.getClasses = async (req, res) => {
  try {
    const { cycle, anneeScolaire } = req.query;

    let sql = `
      SELECT c.*,
             e.id as enseignant_id, e.nom as enseignant_nom, e.prenom as enseignant_prenom,
             e.matricule as enseignant_matricule,
             (SELECT COUNT(*) FROM eleves el WHERE el.classe_id = c.id AND el.statut = 'ACTIF') AS effectif_actuel
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

    // Si l'utilisateur est un enseignant, limiter aux classes qui lui sont attribuées
    // (comme titulaire de classe OU comme enseignant d'une matière dans cette classe)
    if (req.user.role === 'ENSEIGNANT' && req.user.enseignant_id) {
      sql += ` AND (
        c.enseignant_principal_id = $${paramIndex}
        OR c.id IN (
          SELECT DISTINCT cm.classe_id FROM classe_matieres cm WHERE cm.enseignant_id = $${paramIndex}
        )
      )`;
      params.push(req.user.enseignant_id);
      paramIndex++;
    }

    sql += ` ORDER BY c.cycle ASC, c.niveau ASC`;

    const result = await queryScoped(req.ecoleId, sql, params);

    const classesWithEffectif = result.rows.map((row) => {
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
        montant_scolarite: row.montant_scolarite,
        devise: row.devise,
        created_at: row.created_at,
        updated_at: row.updated_at,
        effectifActuel: parseInt(row.effectif_actuel || '0')
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
    });

    res.json(classesWithEffectif);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getClasseById = async (req, res) => {
  try {
    const isEnseignant = String(req.user?.role || '').toUpperCase() === 'ENSEIGNANT';
    const enseignantId = req.user?.enseignant_id || null;

    if (isEnseignant && !enseignantId) {
      return res.status(403).json({ message: 'Compte enseignant non lie a un profil enseignant' });
    }

    const result = await queryScoped(
      req.ecoleId,
      `SELECT c.*,
              e.id as enseignant_id, e.nom as enseignant_nom, e.prenom as enseignant_prenom,
              e.matricule as enseignant_matricule
       FROM classes c
       LEFT JOIN enseignants e ON c.enseignant_principal_id = e.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Classe non trouvee' });
    }

    const row = result.rows[0];

    if (isEnseignant) {
      const accessResult = await queryScoped(
        req.ecoleId,
        `SELECT
           EXISTS (
             SELECT 1
             FROM classes c
             WHERE c.id = $1
               AND c.enseignant_principal_id = $2
           ) AS is_principal,
           EXISTS (
             SELECT 1
             FROM classe_matieres cm
             WHERE cm.classe_id = $1
               AND cm.enseignant_id = $2
           ) AS has_subject`,
        [row.id, enseignantId]
      );

      if (!accessResult.rows[0]?.is_principal && !accessResult.rows[0]?.has_subject) {
        return res.status(403).json({ message: 'Acces refuse a cette classe' });
      }
    }

    const elevesResult = await queryScoped(
      req.ecoleId,
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
      montant_scolarite: row.montant_scolarite,
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

    const result = await queryScoped(
      req.ecoleId,
      `INSERT INTO classes (
        nom, niveau, cycle, section, annee_scolaire, enseignant_principal_id,
        effectif_max, salle, montant_inscription, montant_mensuel, montant_scolarite, devise, ecole_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        data.montantInscription || data.montant_inscription || 0,
        data.montantMensuel || data.montant_mensuel || 0,
        data.montantScolarite || data.montant_scolarite || 0,
        data.devise || 'XOF',
        req.ecoleId
      ]
    );

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'CLASSE_CREATE',
      entity: 'CLASSE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        nom: result.rows[0].nom,
        niveau: result.rows[0].niveau,
        cycle: result.rows[0].cycle,
        anneeScolaire: result.rows[0].annee_scolaire
      }
    });

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
      montantScolarite: 'montant_scolarite',
      montant_scolarite: 'montant_scolarite',
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
    const result = await queryScoped(req.ecoleId, sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'CLASSE_UPDATE',
      entity: 'CLASSE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        fields: Object.keys(data)
      }
    });

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteClasse = async (req, res) => {
  try {
    const result = await queryScoped(
      req.ecoleId,
      'DELETE FROM classes WHERE id = $1 RETURNING id, nom',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'CLASSE_DELETE',
      entity: 'CLASSE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        nom: result.rows[0].nom
      }
    });

    res.json({ message: 'Classe supprimee avec succes' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


