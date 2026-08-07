const { queryScoped } = require('../lib/db');
const { logAuditEvent } = require('../lib/audit');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const logger = require('../lib/logger');

const parseSchoolYearBounds = (anneeScolaire) => {
  const match = String(anneeScolaire || '').match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;

  const startYear = parseInt(match[1], 10);
  const endYear = parseInt(match[2], 10);
  return {
    start: new Date(Date.UTC(startYear, 8, 1, 0, 0, 0)), // 1 Sep
    end: new Date(Date.UTC(endYear, 5, 30, 23, 59, 59)) // 30 Jun
  };
};

const getMonthsDue = (dateInscription, bounds, asOfDate = new Date()) => {
  if (!bounds) return 0;

  const asOf = new Date(Math.min(asOfDate.getTime(), bounds.end.getTime()));
  let billingStart = new Date(bounds.start);

  if (dateInscription) {
    const insc = new Date(dateInscription);
    if (!Number.isNaN(insc.getTime())) {
      const inscMonthStart = new Date(Date.UTC(insc.getUTCFullYear(), insc.getUTCMonth(), 1));
      if (inscMonthStart > billingStart) {
        billingStart = inscMonthStart;
      }
    }
  }

  if (asOf < billingStart) return 0;

  const months =
    (asOf.getUTCFullYear() - billingStart.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - billingStart.getUTCMonth()) +
    1;

  return Math.max(0, months);
};

const getFinanceTotals = ({ montantInscription, montantMensuel, monthsDue, totalPaye }) => {
  const inscription = parseFloat(montantInscription || 0);
  const mensuel = parseFloat(montantMensuel || 0);
  const paye = parseFloat(totalPaye || 0);

  const totalDu = inscription + mensuel * monthsDue;
  const resteAPayer = Math.max(0, totalDu - paye);

  return {
    montantInscription: inscription,
    montantMensuel: mensuel,
    moisDus: monthsDue,
    totalDu,
    totalPaye: paye,
    resteAPayer
  };
};

// Utilise montant_scolarite (annuel) en priorité sur l'ancienne logique mensuelle
const getFinanceTotalsV2 = ({ montantScolarite, montantInscription, montantMensuel, monthsDue, totalPaye }) => {
  const scolarite = parseFloat(montantScolarite || 0);
  const paye = parseFloat(totalPaye || 0);

  if (scolarite > 0) {
    return {
      montantScolarite: scolarite,
      montantInscription: 0,
      montantMensuel: 0,
      moisDus: 0,
      totalDu: scolarite,
      totalPaye: paye,
      resteAPayer: Math.max(0, scolarite - paye)
    };
  }

  // Fallback ancienne logique mensuelle
  return getFinanceTotals({ montantInscription, montantMensuel, monthsDue, totalPaye });
};

const getEffectiveAnnee = async (ecoleId, preferredAnnee) => {
  if (preferredAnnee) return preferredAnnee;
  const anneeActiveResult = await queryScoped(ecoleId, 'SELECT annee FROM annees_scolaires WHERE active = true LIMIT 1');
  if (anneeActiveResult.rows.length > 0) return anneeActiveResult.rows[0].annee;
  return null;
};

exports.getPaiements = async (req, res) => {
  try {
    const { eleve, typePaiement, anneeScolaire, statut } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (eleve) {
      where += ` AND p.eleve_id = $${paramIndex}`;
      params.push(eleve);
      paramIndex++;
    }

    if (typePaiement) {
      where += ` AND p.type_paiement = $${paramIndex}`;
      params.push(typePaiement.toUpperCase());
      paramIndex++;
    }

    if (anneeScolaire) {
      where += ` AND p.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    if (statut) {
      where += ` AND p.statut = $${paramIndex}`;
      params.push(statut.toUpperCase());
      paramIndex++;
    }

    const countResult = await queryScoped(
      req.ecoleId,
      `SELECT COUNT(*) as total FROM paiements p ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const sql = `
      SELECT p.*,
             e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
             u.id as user_id, u.nom as user_nom, u.prenom as user_prenom
      FROM paiements p
      LEFT JOIN eleves e ON p.eleve_id = e.id
      LEFT JOIN users u ON p.enregistre_par_id = u.id
      ${where}
      ORDER BY p.date_paiement DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await queryScoped(req.ecoleId, sql, [...params, limit, offset]);
    const paiements = result.rows.map((row) => ({
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
      eleve: row.eleve_id
        ? {
            id: row.eleve_id,
            nom: row.eleve_nom,
            prenom: row.eleve_prenom,
            matricule: row.eleve_matricule
          }
        : null,
      enregistrePar: row.user_id
        ? {
            nom: row.user_nom,
            prenom: row.user_prenom
          }
        : null
    }));

    res.json(paginatedResponse(paiements, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPaiementById = async (req, res) => {
  try {
    const result = await queryScoped(
      req.ecoleId,
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
      return res.status(404).json({ message: 'Paiement non trouve' });
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
      eleve: row.eleve_id
        ? {
            id: row.eleve_id,
            nom: row.eleve_nom,
            prenom: row.eleve_prenom,
            matricule: row.eleve_matricule
          }
        : null,
      enregistrePar: row.user_id
        ? {
            id: row.user_id,
            nom: row.user_nom,
            prenom: row.user_prenom
          }
        : null
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

    if (data.typePaiement) data.typePaiement = data.typePaiement.toUpperCase();
    if (data.type_paiement) data.type_paiement = data.type_paiement.toUpperCase();
    if (data.modePaiement) data.modePaiement = data.modePaiement.toUpperCase();
    if (data.mode_paiement) data.mode_paiement = data.mode_paiement.toUpperCase();
    if (data.statut) data.statut = data.statut.toUpperCase();

    let anneeScolaire = data.anneeScolaire || data.annee_scolaire;
    if (!anneeScolaire) {
      anneeScolaire = await getEffectiveAnnee(req.ecoleId, null);
      if (!anneeScolaire) {
        const year = new Date().getFullYear();
        anneeScolaire = `${year}-${year + 1}`;
      }
    }

    const result = await queryScoped(
      req.ecoleId,
      `INSERT INTO paiements (
        eleve_id, type_paiement, montant, devise, date_paiement, mois_concerne,
        annee_scolaire, mode_paiement, numero_piece, statut, remarques, enregistre_par_id, ecole_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.eleveId || data.eleve_id,
        data.typePaiement || data.type_paiement,
        data.montant,
        data.devise || 'XOF',
        data.datePaiement || data.date_paiement || new Date(),
        data.moisConcerne || data.mois_concerne || null,
        anneeScolaire,
        data.modePaiement || data.mode_paiement,
        data.numeroPiece || data.numero_piece || null,
        data.statut || 'VALIDE',
        data.remarques || null,
        data.enregistreParId || data.enregistre_par_id,
        req.ecoleId
      ]
    );

    const paiementWithEleve = await queryScoped(
      req.ecoleId,
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
      eleve: row.eleve_id
        ? {
            id: row.eleve_id,
            nom: row.eleve_nom,
            prenom: row.eleve_prenom
          }
        : null
    };

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'PAIEMENT_CREATE',
      entity: 'PAIEMENT',
      entityId: paiement.id,
      status: 'SUCCESS',
      details: {
        eleveId: paiement.eleve_id,
        montant: paiement.montant,
        typePaiement: paiement.type_paiement,
        anneeScolaire: paiement.annee_scolaire
      }
    });

    res.status(201).json(paiement);
  } catch (error) {
    logger.error('Erreur creation paiement:', error.message);
    logger.error('Details:', error.detail || error.hint || error);
    res.status(400).json({ message: error.message });
  }
};

exports.updatePaiement = async (req, res) => {
  try {
    const data = { ...req.body };

    if (data.typePaiement) data.typePaiement = data.typePaiement.toUpperCase();
    if (data.type_paiement) data.type_paiement = data.type_paiement.toUpperCase();
    if (data.modePaiement) data.modePaiement = data.modePaiement.toUpperCase();
    if (data.mode_paiement) data.mode_paiement = data.mode_paiement.toUpperCase();
    if (data.statut) data.statut = data.statut.toUpperCase();

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
      return res.status(400).json({ message: 'Aucune donnee a mettre a jour' });
    }

    fields.push('updated_at = NOW()');
    values.push(req.params.id);

    const sql = `UPDATE paiements SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await queryScoped(req.ecoleId, sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Paiement non trouve' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'PAIEMENT_UPDATE',
      entity: 'PAIEMENT',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        fields: Object.keys(data),
        anneeScolaire: result.rows[0].annee_scolaire
      }
    });

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deletePaiement = async (req, res) => {
  try {
    const result = await queryScoped(req.ecoleId, 'DELETE FROM paiements WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Paiement non trouve' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'PAIEMENT_DELETE',
      entity: 'PAIEMENT',
      entityId: result.rows[0].id,
      status: 'SUCCESS'
    });

    res.json({ message: 'Paiement supprime avec succes' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHistoriquePaiements = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { anneeScolaire } = req.query;

    let effectiveAnnee = await getEffectiveAnnee(req.ecoleId, anneeScolaire);

    const eleveResult = await queryScoped(
      req.ecoleId,
      `SELECT e.id, e.date_inscription, e.annee_scolaire,
              c.id as classe_id, c.nom as classe_nom,
              c.montant_scolarite, c.montant_inscription, c.montant_mensuel, c.devise
       FROM eleves e
       LEFT JOIN classes c ON e.classe_id = c.id
       WHERE e.id = $1`,
      [eleveId]
    );

    if (eleveResult.rows.length === 0) {
      return res.status(404).json({ message: 'Eleve non trouve' });
    }

    const eleveInfo = eleveResult.rows[0];
    if (!effectiveAnnee) effectiveAnnee = eleveInfo.annee_scolaire;

    let sql = 'SELECT * FROM paiements WHERE eleve_id = $1';
    const params = [eleveId];

    if (effectiveAnnee) {
      sql += ' AND annee_scolaire = $2';
      params.push(effectiveAnnee);
    }

    sql += ' ORDER BY date_paiement DESC';
    const result = await queryScoped(req.ecoleId, sql, params);

    const totalPaye = result.rows
      .filter(p => p.statut === 'VALIDE' && p.type_paiement === 'SCOLARITE')
      .reduce((sum, p) => sum + parseFloat(p.montant), 0);

    const bounds = parseSchoolYearBounds(effectiveAnnee);
    const monthsDue = getMonthsDue(eleveInfo.date_inscription, bounds, new Date());
    const totals = getFinanceTotalsV2({
      montantScolarite: eleveInfo.montant_scolarite,
      montantInscription: eleveInfo.montant_inscription,
      montantMensuel: eleveInfo.montant_mensuel,
      monthsDue,
      totalPaye
    });

    res.json({
      paiements: result.rows,
      anneeScolaire: effectiveAnnee,
      devise: eleveInfo.devise || 'XOF',
      montantScolarite: totals.montantScolarite || 0,
      montantInscription: totals.montantInscription,
      montantMensuel: totals.montantMensuel,
      moisDus: totals.moisDus,
      totalDu: totals.totalDu,
      totalPaye: totals.totalPaye,
      resteAPayer: totals.resteAPayer
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSoldeEleve = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { anneeScolaire } = req.query;
    let effectiveAnnee = await getEffectiveAnnee(req.ecoleId, anneeScolaire);

    const eleveResult = await queryScoped(
      req.ecoleId,
      `SELECT e.id, e.date_inscription, e.annee_scolaire,
              c.montant_scolarite, c.montant_inscription, c.montant_mensuel, c.devise
       FROM eleves e
       LEFT JOIN classes c ON e.classe_id = c.id
       WHERE e.id = $1`,
      [eleveId]
    );

    if (eleveResult.rows.length === 0) {
      return res.status(404).json({ message: 'Eleve non trouve' });
    }

    const eleveInfo = eleveResult.rows[0];
    if (!effectiveAnnee) effectiveAnnee = eleveInfo.annee_scolaire;

    const totalResult = await queryScoped(
      req.ecoleId,
      `SELECT COALESCE(SUM(montant), 0) as total
       FROM paiements
       WHERE eleve_id = $1
         AND annee_scolaire = $2
         AND statut = 'VALIDE'
         AND type_paiement = 'SCOLARITE'`,
      [eleveId, effectiveAnnee]
    );

    const bounds = parseSchoolYearBounds(effectiveAnnee);
    const monthsDue = getMonthsDue(eleveInfo.date_inscription, bounds, new Date());
    const totals = getFinanceTotalsV2({
      montantScolarite: eleveInfo.montant_scolarite,
      montantInscription: eleveInfo.montant_inscription,
      montantMensuel: eleveInfo.montant_mensuel,
      monthsDue,
      totalPaye: totalResult.rows[0].total
    });

    res.json({
      eleveId,
      anneeScolaire: effectiveAnnee,
      devise: eleveInfo.devise || 'XOF',
      montantInscription: totals.montantInscription,
      montantMensuel: totals.montantMensuel,
      moisDus: totals.moisDus,
      totalDu: totals.totalDu,
      totalPaye: totals.totalPaye,
      resteAPayer: totals.resteAPayer,
      statut: totals.resteAPayer > 0 ? 'IMPAYE' : 'SOLDE'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getElevesImpayes = async (req, res) => {
  try {
    const { anneeScolaire, classeId } = req.query;
    const effectiveAnnee = await getEffectiveAnnee(req.ecoleId, anneeScolaire);

    if (!effectiveAnnee) {
      return res.status(400).json({ message: 'Annee scolaire requise' });
    }

    // Un élève est impayé si total SCOLARITE (VALIDE) < montant_scolarite de sa classe
    // Seules les classes avec montant_scolarite > 0 sont concernées
    let whereClause = "WHERE e.statut = 'ACTIF' AND e.annee_scolaire = $1 AND COALESCE(c.montant_scolarite, 0) > 0";
    const params = [effectiveAnnee];
    if (classeId) {
      whereClause += ' AND e.classe_id = $2';
      params.push(classeId);
    }

    const studentsResult = await queryScoped(
      req.ecoleId,
      `SELECT e.id, e.matricule, e.nom, e.prenom,
              c.id as classe_id, c.nom as classe_nom,
              c.montant_scolarite, c.devise,
              COALESCE(p.total_paye, 0) as total_paye
       FROM eleves e
       LEFT JOIN classes c ON e.classe_id = c.id
       LEFT JOIN (
         SELECT eleve_id, SUM(montant) AS total_paye
         FROM paiements
         WHERE statut = 'VALIDE'
           AND annee_scolaire = $1
           AND type_paiement = 'SCOLARITE'
         GROUP BY eleve_id
       ) p ON p.eleve_id = e.id
       ${whereClause}
       ORDER BY c.nom, e.nom, e.prenom`,
      params
    );

    const impayes = studentsResult.rows
      .map(row => {
        const montantScolarite = parseFloat(row.montant_scolarite || 0);
        const totalPaye = parseFloat(row.total_paye || 0);
        const resteAPayer = Math.max(0, montantScolarite - totalPaye);
        return {
          eleve_id: row.id,
          matricule: row.matricule,
          nom: row.nom,
          prenom: row.prenom,
          classe: row.classe_id ? { id: row.classe_id, nom: row.classe_nom } : null,
          devise: row.devise || 'XOF',
          totalDu: montantScolarite,
          totalPaye,
          resteAPayer
        };
      })
      .filter(item => item.resteAPayer > 0)
      .sort((a, b) => b.resteAPayer - a.resteAPayer);

    const totalReste = impayes.reduce((sum, row) => sum + row.resteAPayer, 0);

    res.json({
      anneeScolaire: effectiveAnnee,
      totalElevesImpayes: impayes.length,
      totalResteAPayer: totalReste,
      devise: impayes[0]?.devise || 'XOF',
      impayes
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPaiementStats = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;

    let whereClause = "WHERE statut = 'VALIDE'";
    const params = [];

    if (anneeScolaire) {
      whereClause += ' AND annee_scolaire = $1';
      params.push(anneeScolaire);
    }

    const totalResult = await queryScoped(
      req.ecoleId,
      `SELECT COUNT(*) as count FROM paiements ${whereClause}`,
      params
    );

    const montantResult = await queryScoped(
      req.ecoleId,
      `SELECT SUM(montant) as total FROM paiements ${whereClause}`,
      params
    );

    const parTypeResult = await queryScoped(
      req.ecoleId,
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
      totalPaiements: parseInt(totalResult.rows[0].count, 10),
      montantTotal: parseFloat(montantResult.rows[0].total || 0),
      devise: 'XOF',
      parType
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
