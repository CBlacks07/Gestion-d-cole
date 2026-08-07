const { queryScoped } = require('../lib/db');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const logger = require('../lib/logger');

function formatEleves(rows) {
  return rows.map(row => {
    const eleve = {
      id: row.id,
      matricule: row.matricule,
      nom: row.nom,
      prenom: row.prenom,
      date_naissance: row.date_naissance,
      lieu_naissance: row.lieu_naissance,
      sexe: row.sexe,
      classe_id: row.classe_id,
      tuteur_nom: row.tuteur_nom,
      tuteur_prenom: row.tuteur_prenom,
      tuteur_telephone: row.tuteur_telephone,
      tuteur_email: row.tuteur_email,
      tuteur_adresse: row.tuteur_adresse,
      groupe_sanguin: row.groupe_sanguin,
      allergies: row.allergies,
      maladies_chroniques: row.maladies_chroniques,
      statut: row.statut,
      annee_scolaire: row.annee_scolaire,
      date_inscription: row.date_inscription,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    if (row.classe_id) {
      eleve.classe = {
        id: row.classe_id,
        nom: row.classe_nom,
        niveau: row.classe_niveau,
        cycle: row.classe_cycle,
        section: row.classe_section
      };
    }
    return eleve;
  });
}

// @desc    Obtenir tous les élèves
// @route   GET /api/eleves
exports.getEleves = async (req, res) => {
  try {
    const { classe, statut, anneeScolaire, search, all } = req.query;
    const noPagination = all === 'true';

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (classe) {
      where += ` AND e.classe_id = $${paramIndex}`;
      params.push(classe);
      paramIndex++;
    }

    if (statut) {
      where += ` AND e.statut = $${paramIndex}`;
      params.push(statut.toUpperCase());
      paramIndex++;
    }

    if (anneeScolaire) {
      where += ` AND e.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    if (search) {
      where += ` AND (e.nom ILIKE $${paramIndex} OR e.prenom ILIKE $${paramIndex} OR e.matricule ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    let sql = `
      SELECT e.*,
             c.id as classe_id, c.nom as classe_nom, c.niveau as classe_niveau,
             c.cycle as classe_cycle, c.section as classe_section
      FROM eleves e
      LEFT JOIN classes c ON e.classe_id = c.id
      ${where}
      ORDER BY e.nom ASC, e.prenom ASC
    `;

    let total;
    if (!noPagination) {
      const { page, limit, offset } = parsePagination(req.query);
      const countResult = await queryScoped(
        req.ecoleId,
        `SELECT COUNT(*) as total FROM eleves e ${where}`,
        params
      );
      total = parseInt(countResult.rows[0].total, 10);

      sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      const result = await queryScoped(req.ecoleId, sql, [...params, limit, offset]);
      const eleves = formatEleves(result.rows);
      return res.json(paginatedResponse(eleves, total, page, limit));
    }

    const result = await queryScoped(req.ecoleId, sql, params);
    const eleves = formatEleves(result.rows);
    res.json(eleves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir un élève par ID
// @route   GET /api/eleves/:id
exports.getEleveById = async (req, res) => {
  try {
    const result = await queryScoped(
      req.ecoleId,
      `SELECT e.*,
              c.id as classe_id, c.nom as classe_nom, c.niveau as classe_niveau,
              c.cycle as classe_cycle, c.section as classe_section
       FROM eleves e
       LEFT JOIN classes c ON e.classe_id = c.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    const row = result.rows[0];
    const eleve = {
      id: row.id,
      matricule: row.matricule,
      nom: row.nom,
      prenom: row.prenom,
      date_naissance: row.date_naissance,
      lieu_naissance: row.lieu_naissance,
      sexe: row.sexe,
      classe_id: row.classe_id,
      tuteur_nom: row.tuteur_nom,
      tuteur_prenom: row.tuteur_prenom,
      tuteur_telephone: row.tuteur_telephone,
      tuteur_email: row.tuteur_email,
      tuteur_adresse: row.tuteur_adresse,
      groupe_sanguin: row.groupe_sanguin,
      allergies: row.allergies,
      maladies_chroniques: row.maladies_chroniques,
      statut: row.statut,
      annee_scolaire: row.annee_scolaire,
      date_inscription: row.date_inscription,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    if (row.classe_id) {
      eleve.classe = {
        id: row.classe_id,
        nom: row.classe_nom,
        niveau: row.classe_niveau,
        cycle: row.classe_cycle,
        section: row.classe_section
      };
    }

    res.json(eleve);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer un nouvel élève
// @route   POST /api/eleves
exports.createEleve = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.statut) data.statut = data.statut.toUpperCase();
    if (data.sexe) data.sexe = data.sexe.toUpperCase();

    // Extraire les données du tuteur si elles sont dans un objet imbriqué
    let tuteurNom = data.tuteurNom || data.tuteur_nom || (data.tuteur && data.tuteur.nom);
    let tuteurPrenom = data.tuteurPrenom || data.tuteur_prenom || (data.tuteur && data.tuteur.prenom);
    let tuteurTelephone = data.tuteurTelephone || data.tuteur_telephone || (data.tuteur && data.tuteur.telephone);
    let tuteurEmail = data.tuteurEmail || data.tuteur_email || (data.tuteur && data.tuteur.email);
    let tuteurAdresse = data.tuteurAdresse || data.tuteur_adresse || (data.tuteur && data.tuteur.adresse);

    // Générer automatiquement le matricule si non fourni
    let matricule = data.matricule;
    if (!matricule) {
      const currentYear = new Date().getFullYear();
      // Trouver le dernier matricule de l'année en cours
      const lastMatriculeResult = await queryScoped(
        req.ecoleId,
        `SELECT matricule FROM eleves
         WHERE matricule LIKE $1
         ORDER BY matricule DESC
         LIMIT 1`,
        [`EL${currentYear}%`]
      );

      let nextNumber = 1;
      if (lastMatriculeResult.rows.length > 0) {
        const lastMatricule = lastMatriculeResult.rows[0].matricule;
        const lastNumber = parseInt(lastMatricule.substring(6)); // Extraire le numéro après "EL2024"
        nextNumber = lastNumber + 1;
      }

      // Formater le matricule: EL2024001, EL2024002, etc.
      matricule = `EL${currentYear}${nextNumber.toString().padStart(3, '0')}`;
    }

    const result = await queryScoped(
      req.ecoleId,
      `INSERT INTO eleves (
        matricule, nom, prenom, date_naissance, lieu_naissance, sexe,
        classe_id, tuteur_nom, tuteur_prenom, tuteur_telephone, tuteur_email,
        tuteur_adresse, groupe_sanguin, allergies, maladies_chroniques,
        statut, annee_scolaire, date_inscription, ecole_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        matricule,
        data.nom,
        data.prenom,
        data.dateNaissance || data.date_naissance,
        data.lieuNaissance || data.lieu_naissance,
        data.sexe,
        data.classeId || data.classe_id || data.classe || null,
        tuteurNom,
        tuteurPrenom,
        tuteurTelephone,
        tuteurEmail || null,
        tuteurAdresse,
        data.groupeSanguin || data.groupe_sanguin || null,
        data.allergies || [],
        data.maladiesChroniques || data.maladies_chroniques || [],
        data.statut || 'ACTIF',
        data.anneeScolaire || data.annee_scolaire,
        data.dateInscription || data.date_inscription || new Date(),
        req.ecoleId
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur lors de la création de l\'élève:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Mettre à jour un élève
// @route   PUT /api/eleves/:id
exports.updateEleve = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.statut) data.statut = data.statut.toUpperCase();
    if (data.sexe) data.sexe = data.sexe.toUpperCase();

    // Extraire les données du tuteur si elles sont dans un objet imbriqué
    if (data.tuteur && typeof data.tuteur === 'object') {
      data.tuteurNom = data.tuteur.nom;
      data.tuteurPrenom = data.tuteur.prenom;
      data.tuteurTelephone = data.tuteur.telephone;
      data.tuteurEmail = data.tuteur.email;
      data.tuteurAdresse = data.tuteur.adresse;
    }

    // Construire la requête dynamiquement en fonction des champs fournis
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      matricule: 'matricule',
      nom: 'nom',
      prenom: 'prenom',
      dateNaissance: 'date_naissance',
      date_naissance: 'date_naissance',
      lieuNaissance: 'lieu_naissance',
      lieu_naissance: 'lieu_naissance',
      sexe: 'sexe',
      classeId: 'classe_id',
      classe_id: 'classe_id',
      classe: 'classe_id',
      tuteurNom: 'tuteur_nom',
      tuteur_nom: 'tuteur_nom',
      tuteurPrenom: 'tuteur_prenom',
      tuteur_prenom: 'tuteur_prenom',
      tuteurTelephone: 'tuteur_telephone',
      tuteur_telephone: 'tuteur_telephone',
      tuteurEmail: 'tuteur_email',
      tuteur_email: 'tuteur_email',
      tuteurAdresse: 'tuteur_adresse',
      tuteur_adresse: 'tuteur_adresse',
      groupeSanguin: 'groupe_sanguin',
      groupe_sanguin: 'groupe_sanguin',
      allergies: 'allergies',
      maladiesChroniques: 'maladies_chroniques',
      maladies_chroniques: 'maladies_chroniques',
      statut: 'statut',
      anneeScolaire: 'annee_scolaire',
      annee_scolaire: 'annee_scolaire',
      dateInscription: 'date_inscription',
      date_inscription: 'date_inscription'
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

    const sql = `UPDATE eleves SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await queryScoped(req.ecoleId, sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Supprimer un élève
// @route   DELETE /api/eleves/:id
exports.deleteEleve = async (req, res) => {
  try {
    const result = await queryScoped(
      req.ecoleId,
      'DELETE FROM eleves WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    res.json({ message: 'Élève supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Importer des élèves en masse (CSV)
// @route   POST /api/eleves/batch
exports.importEleves = async (req, res) => {
  let { eleves, anneeScolaire } = req.body;
  if (!Array.isArray(eleves) || eleves.length === 0) {
    return res.status(400).json({ message: 'Aucun élève à importer' });
  }

  // Si anneeScolaire non fournie, utiliser l'année active
  if (!anneeScolaire) {
    const anneeRes = await queryScoped(req.ecoleId, `SELECT annee FROM annees_scolaires WHERE active = true LIMIT 1`);
    anneeScolaire = anneeRes.rows[0]?.annee || null;
  }

  if (!anneeScolaire) {
    return res.status(400).json({ message: 'Aucune année scolaire active. Veuillez en activer une dans la configuration.' });
  }

  // Pré-charger toutes les classes pour la résolution par nom
  const classesResult = await queryScoped(req.ecoleId, 'SELECT id, nom FROM classes');
  const classeMap = {};
  for (const c of classesResult.rows) {
    classeMap[c.nom.toLowerCase().trim()] = c.id;
  }

  // Récupérer le dernier matricule de l'année en cours
  const currentYear = new Date().getFullYear();
  const lastMatriculeResult = await queryScoped(
    req.ecoleId,
    `SELECT matricule FROM eleves WHERE matricule LIKE $1 ORDER BY matricule DESC LIMIT 1`,
    [`EL${currentYear}%`]
  );
  let nextNumber = 1;
  if (lastMatriculeResult.rows.length > 0) {
    const last = lastMatriculeResult.rows[0].matricule;
    nextNumber = parseInt(last.substring(6)) + 1;
  }

  const imported = [];
  const errors = [];

  for (let i = 0; i < eleves.length; i++) {
    const e = eleves[i];
    try {
      if (!e.nom || !e.prenom) {
        errors.push({ ligne: i + 1, message: 'Nom et prénom obligatoires', data: e });
        continue;
      }

      const sexe = (e.sexe || '').toUpperCase();
      if (sexe && !['M', 'F'].includes(sexe)) {
        errors.push({ ligne: i + 1, message: `Sexe invalide: "${e.sexe}" (attendu M ou F)`, data: e });
        continue;
      }

      let classeId = null;
      if (e.classe) {
        const key = e.classe.toLowerCase().trim();
        classeId = classeMap[key] || null;
        if (!classeId) {
          errors.push({ ligne: i + 1, message: `Classe introuvable: "${e.classe}"`, data: e });
          continue;
        }
      }

      const matricule = `EL${currentYear}${nextNumber.toString().padStart(3, '0')}`;
      nextNumber++;

      const result = await queryScoped(
        req.ecoleId,
        `INSERT INTO eleves (
          matricule, nom, prenom, date_naissance, lieu_naissance, sexe,
          classe_id, tuteur_nom, tuteur_prenom, tuteur_telephone, statut, annee_scolaire, date_inscription, ecole_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id, matricule, nom, prenom`,
        [
          matricule,
          e.nom.trim(),
          e.prenom.trim(),
          e.dateNaissance || e.date_naissance || null,
          e.lieuNaissance || e.lieu_naissance || null,
          sexe || null,
          classeId,
          e.tuteurNom || e.tuteur_nom || null,
          e.tuteurPrenom || e.tuteur_prenom || '',
          e.tuteurTelephone || e.tuteur_telephone || null,
          'ACTIF',
          anneeScolaire || null,
          new Date(),
          req.ecoleId
        ]
      );
      imported.push(result.rows[0]);
    } catch (err) {
      errors.push({ ligne: i + 1, message: err.message, data: e });
    }
  }

  res.status(201).json({ imported: imported.length, errors, eleves: imported });
};

// @desc    Obtenir les statistiques des élèves
// @route   GET /api/eleves/stats
exports.getElevesStats = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;

    let whereClause = '';
    const params = [];

    if (anneeScolaire) {
      whereClause = 'WHERE annee_scolaire = $1';
      params.push(anneeScolaire);
    }

    // Total d'élèves
    const totalResult = await queryScoped(
      req.ecoleId,
      `SELECT COUNT(*) as count FROM eleves ${whereClause}`,
      params
    );

    // Élèves actifs
    let actifsQuery = 'SELECT COUNT(*) as count FROM eleves ';
    let actifsParams = [];
    if (anneeScolaire) {
      actifsQuery += 'WHERE annee_scolaire = $1 AND statut = $2';
      actifsParams = [anneeScolaire, 'ACTIF'];
    } else {
      actifsQuery += 'WHERE statut = $1';
      actifsParams = ['ACTIF'];
    }
    const actifsResult = await queryScoped(req.ecoleId, actifsQuery, actifsParams);

    // Par sexe
    const parSexeResult = await queryScoped(
      req.ecoleId,
      `SELECT sexe, COUNT(*) as count FROM eleves ${whereClause} GROUP BY sexe`,
      params
    );

    const parSexe = {
      masculin: 0,
      feminin: 0
    };

    parSexeResult.rows.forEach(row => {
      if (row.sexe === 'M') {
        parSexe.masculin = parseInt(row.count);
      } else if (row.sexe === 'F') {
        parSexe.feminin = parseInt(row.count);
      }
    });

    res.json({
      total: parseInt(totalResult.rows[0].count),
      actifs: parseInt(actifsResult.rows[0].count),
      parSexe
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
