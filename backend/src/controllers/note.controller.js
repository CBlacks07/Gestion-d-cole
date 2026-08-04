const { query } = require('../lib/db');
const { logAuditEvent } = require('../lib/audit');

const normalizeValue = (value) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

const PERIODE_NOTE_VALUES = new Set([
  'PREMIER_TRIMESTRE',
  'DEUXIEME_TRIMESTRE',
  'TROISIEME_TRIMESTRE',
  'PREMIER_SEMESTRE',
  'DEUXIEME_SEMESTRE'
]);

const PERIODES_TRIMESTRIELLES = new Set([
  'PREMIER_TRIMESTRE',
  'DEUXIEME_TRIMESTRE',
  'TROISIEME_TRIMESTRE'
]);

const PERIODES_SEMESTRIELLES = new Set(['PREMIER_SEMESTRE', 'DEUXIEME_SEMESTRE']);

const PERIODE_ALIASES = {
  '1ER TRIMESTRE': 'PREMIER_TRIMESTRE',
  '1ERE TRIMESTRE': 'PREMIER_TRIMESTRE',
  'PREMIER TRIMESTRE': 'PREMIER_TRIMESTRE',
  'TRIMESTRE 1': 'PREMIER_TRIMESTRE',
  T1: 'PREMIER_TRIMESTRE',
  '2EME TRIMESTRE': 'DEUXIEME_TRIMESTRE',
  '2E TRIMESTRE': 'DEUXIEME_TRIMESTRE',
  'DEUXIEME TRIMESTRE': 'DEUXIEME_TRIMESTRE',
  'TRIMESTRE 2': 'DEUXIEME_TRIMESTRE',
  T2: 'DEUXIEME_TRIMESTRE',
  '3EME TRIMESTRE': 'TROISIEME_TRIMESTRE',
  '3E TRIMESTRE': 'TROISIEME_TRIMESTRE',
  'TROISIEME TRIMESTRE': 'TROISIEME_TRIMESTRE',
  'TRIMESTRE 3': 'TROISIEME_TRIMESTRE',
  T3: 'TROISIEME_TRIMESTRE',
  '1ER SEMESTRE': 'PREMIER_SEMESTRE',
  '1ERE SEMESTRE': 'PREMIER_SEMESTRE',
  'PREMIER SEMESTRE': 'PREMIER_SEMESTRE',
  'SEMESTRE 1': 'PREMIER_SEMESTRE',
  S1: 'PREMIER_SEMESTRE',
  '2EME SEMESTRE': 'DEUXIEME_SEMESTRE',
  '2E SEMESTRE': 'DEUXIEME_SEMESTRE',
  'DEUXIEME SEMESTRE': 'DEUXIEME_SEMESTRE',
  'SEMESTRE 2': 'DEUXIEME_SEMESTRE',
  S2: 'DEUXIEME_SEMESTRE'
};

const normalizePeriodeKey = (value) =>
  normalizeValue(value)
    .replace(/[+/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCycle = (value) => normalizeValue(value);

const convertPeriode = (periode) => {
  if (periode === undefined || periode === null) return null;
  const normalized = normalizePeriodeKey(periode);
  if (!normalized) return null;
  return PERIODE_ALIASES[normalized] || null;
};

const isPeriodeCompatibleWithCycle = (periodeCode, cycle) => {
  const normalizedCycle = normalizeCycle(cycle);
  if (!periodeCode) return false;

  if (normalizedCycle === 'LYCEE') {
    return PERIODES_SEMESTRIELLES.has(periodeCode);
  }

  if (normalizedCycle === 'COLLEGE' || normalizedCycle === 'PRIMAIRE') {
    return PERIODES_TRIMESTRIELLES.has(periodeCode);
  }

  return true;
};

const isPeriodeCompatibleWithClasse = async (classeId, periodeCode) => {
  if (!classeId || !periodeCode) return true;

  const classeResult = await query('SELECT cycle FROM classes WHERE id = $1', [classeId]);
  if (classeResult.rows.length === 0) {
    return false;
  }

  return isPeriodeCompatibleWithCycle(periodeCode, classeResult.rows[0].cycle);
};

const isEnseignantRole = (req) => normalizeValue(req?.user?.role) === 'ENSEIGNANT';

const getEnseignantIdFromUser = (req) => req?.user?.enseignant_id || null;

const canEnseignantManageMatiere = async ({ enseignantId, classeId, matiereId, anneeScolaire }) => {
  if (!enseignantId || !classeId || !matiereId) return false;

  const permissionResult = await query(
    `SELECT
       EXISTS (
         SELECT 1
         FROM classe_matieres cm
         WHERE cm.classe_id = $1
           AND cm.matiere_id = $2
           AND cm.enseignant_id = $3
           AND ($4::varchar IS NULL OR cm.annee_scolaire = $4)
       ) AS classe_matiere_match,
       EXISTS (
         SELECT 1
         FROM classes c
         WHERE c.id = $1
           AND c.enseignant_principal_id = $3
       ) AS classe_principale_match,
       EXISTS (
         SELECT 1
         FROM enseignant_matieres em
         WHERE em.enseignant_id = $3
           AND em.matiere_id = $2
       ) AS matiere_match`,
    [classeId, matiereId, enseignantId, anneeScolaire || null]
  );

  if (permissionResult.rows.length === 0) return false;
  const row = permissionResult.rows[0];
  return Boolean(row.classe_matiere_match || (row.classe_principale_match && row.matiere_match));
};

const ensureEnseignantAttached = (req, res) => {
  if (!isEnseignantRole(req)) return true;

  if (!getEnseignantIdFromUser(req)) {
    res.status(403).json({ message: 'Compte enseignant non lie a un profil enseignant' });
    return false;
  }

  return true;
};

const periodeLabel = (periodeCode) => {
  const labels = {
    PREMIER_TRIMESTRE: '1er Trimestre',
    DEUXIEME_TRIMESTRE: '2eme Trimestre',
    TROISIEME_TRIMESTRE: '3eme Trimestre',
    PREMIER_SEMESTRE: '1er Semestre',
    DEUXIEME_SEMESTRE: '2eme Semestre'
  };
  return labels[periodeCode] || periodeCode;
};

const parseScore = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeNoteOn20 = (noteValue, noteMaxValue) => {
  const note = parseScore(noteValue, 0);
  const noteMax = parseScore(noteMaxValue, 0);
  if (noteMax <= 0) return null;
  return (note / noteMax) * 20;
};

const average = (values) => {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
};

const round2 = (value) => {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
};

const buildRanks = (items, key = 'score') => {
  const sorted = [...items].sort((a, b) => {
    const diff = parseScore(b[key], -Infinity) - parseScore(a[key], -Infinity);
    if (Math.abs(diff) > 1e-9) return diff;
    return String(a.studentId || '').localeCompare(String(b.studentId || ''));
  });

  const rankMap = {};
  let currentRank = 0;
  let lastScore = null;

  sorted.forEach((item, index) => {
    const score = parseScore(item[key], -Infinity);
    if (lastScore === null || Math.abs(score - lastScore) > 1e-9) {
      currentRank = index + 1;
      lastScore = score;
    }
    rankMap[item.studentId] = currentRank;
  });

  return rankMap;
};

const appreciate = (value) => {
  if (!Number.isFinite(value)) return '';
  if (value >= 16) return 'Tres bien';
  if (value >= 14) return 'Bien';
  if (value >= 12) return 'Assez bien';
  if (value >= 10) return 'Passable';
  return 'Insuffisant';
};

const mentionFromAverage = (value) => {
  if (!Number.isFinite(value)) return '';
  if (value >= 16) return 'Tres bien';
  if (value >= 14) return 'Bien';
  if (value >= 12) return 'Assez bien';
  if (value >= 10) return 'Passable';
  return 'Avertissement';
};

const computeMatiereLine = (notesForMatiere, coefficient) => {
  const normalizedByType = notesForMatiere.map((note) => ({
    type: note.type_evaluation,
    value20: normalizeNoteOn20(note.note, note.note_max)
  }));

  const inter = average(normalizedByType.filter((n) => n.type === 'INTERROGATION').map((n) => n.value20));
  const devoir = average(normalizedByType.filter((n) => n.type === 'DEVOIR').map((n) => n.value20));
  const hasInter = Number.isFinite(inter);
  const hasDevoir = Number.isFinite(devoir);
  const moyenneClasse = hasInter && hasDevoir ? (inter + devoir) / 2 : null;
  const composition = average(
    normalizedByType
      .filter((n) => ['COMPOSITION', 'EXAMEN', 'TP'].includes(n.type))
      .map((n) => n.value20)
  );

  let noteSur20 = null;
  if (Number.isFinite(moyenneClasse) && Number.isFinite(composition)) {
    noteSur20 = (moyenneClasse + composition) / 2;
  } else if (Number.isFinite(moyenneClasse)) {
    noteSur20 = moyenneClasse;
  } else if (Number.isFinite(composition)) {
    noteSur20 = composition;
  } else {
    noteSur20 = average(normalizedByType.map((n) => n.value20));
  }

  const coef = parseScore(coefficient, 1);
  const noteCoefficient = Number.isFinite(noteSur20) ? noteSur20 * coef : null;
  const noteCoefficientMax = Number.isFinite(noteSur20) ? 20 * coef : null;

  return {
    inter: round2(inter),
    devoir: round2(devoir),
    moyenneClasse: round2(moyenneClasse),
    composition: round2(composition),
    noteSur20: round2(noteSur20),
    coefficient: coef,
    noteCoefficient: round2(noteCoefficient),
    noteCoefficientMax: round2(noteCoefficientMax),
    appreciation: appreciate(noteSur20)
  };
};

const getPeriodeRange = (anneeScolaire, periodeCode) => {
  const match = String(anneeScolaire || '').match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;

  const startYear = parseInt(match[1], 10);
  const endYear = parseInt(match[2], 10);

  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;

  if (periodeCode === 'PREMIER_TRIMESTRE') {
    return { from: `${startYear}-09-01`, to: `${startYear}-12-31` };
  }
  if (periodeCode === 'DEUXIEME_TRIMESTRE') {
    return { from: `${endYear}-01-01`, to: `${endYear}-03-31` };
  }
  if (periodeCode === 'TROISIEME_TRIMESTRE') {
    return { from: `${endYear}-04-01`, to: `${endYear}-06-30` };
  }
  if (periodeCode === 'PREMIER_SEMESTRE') {
    return { from: `${startYear}-09-01`, to: `${endYear}-01-31` };
  }
  if (periodeCode === 'DEUXIEME_SEMESTRE') {
    return { from: `${endYear}-02-01`, to: `${endYear}-06-30` };
  }

  return null;
};

const BULLETIN_NIVEAUX_AUTORISES = new Set([
  'SIXIEME',
  'CINQUIEME',
  'QUATRIEME',
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE'
]);

const mapNoteRow = (row) => ({
  id: row.id,
  eleve_id: row.eleve_id,
  matiere_id: row.matiere_id,
  classe_id: row.classe_id,
  enseignant_id: row.enseignant_id,
  type_evaluation: row.type_evaluation,
  periode: row.periode,
  annee_scolaire: row.annee_scolaire,
  note: row.note,
  note_max: row.note_max,
  coefficient: row.coefficient,
  commentaire: row.commentaire,
  date_evaluation: row.date_evaluation,
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
  classe: row.classe_ref_id
    ? {
        id: row.classe_ref_id,
        nom: row.classe_nom,
        niveau: row.classe_niveau,
        cycle: row.classe_cycle
      }
    : null,
  matiere: row.matiere_id
    ? {
        id: row.matiere_id,
        nom: row.matiere_nom,
        code: row.matiere_code,
        coefficient: row.matiere_coefficient
      }
    : null,
  enseignant: row.enseignant_id
    ? {
        id: row.enseignant_id,
        nom: row.enseignant_nom,
        prenom: row.enseignant_prenom
      }
    : null
});

exports.createNotesBatch = async (req, res) => {
  try {
    if (!ensureEnseignantAttached(req, res)) return;

    const { notes } = req.body;
    if (!Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({ message: 'Tableau de notes requis' });
    }

    const isEnseignant = isEnseignantRole(req);
    const enseignantId = getEnseignantIdFromUser(req);
    const results = [];
    const errors = [];

    for (const data of notes) {
      try {
        if (data.typeEvaluation) data.typeEvaluation = data.typeEvaluation.toUpperCase();
        if (data.type_evaluation) data.type_evaluation = data.type_evaluation.toUpperCase();
        if (data.periode !== undefined) {
          const periodeCode = convertPeriode(data.periode);
          if (!periodeCode) { errors.push({ eleveId: data.eleveId, error: 'Periode invalide' }); continue; }
          data.periode = periodeCode;
        }

        const classeId = data.classeId || data.classe_id;
        const matiereId = data.matiereId || data.matiere_id;
        const anneeScolaire = data.anneeScolaire || data.annee_scolaire;
        if (isEnseignant) {
          const canManage = await canEnseignantManageMatiere({
            enseignantId,
            classeId,
            matiereId,
            anneeScolaire
          });
          if (!canManage) {
            errors.push({ eleveId: data.eleveId || data.eleve_id, error: 'Matiere/classe non autorisee pour cet enseignant' });
            continue;
          }
          data.enseignantId = enseignantId;
          data.enseignant_id = enseignantId;
        }

        let coefficientToSave = parseFloat(data.coefficient);

        if (!Number.isFinite(coefficientToSave) || coefficientToSave <= 0) {
          const coefResult = await query(
            `SELECT cm.coefficient AS cc, m.coefficient AS mc
             FROM matieres m
             LEFT JOIN classe_matieres cm ON cm.matiere_id = m.id AND cm.classe_id = $1 AND cm.annee_scolaire = $2
             WHERE m.id = $3 LIMIT 1`,
            [classeId || null, anneeScolaire || null, matiereId]
          );
          coefficientToSave = coefResult.rows.length > 0
            ? parseFloat(coefResult.rows[0].cc || coefResult.rows[0].mc || 1)
            : 1;
        }

        const result = await query(
          `INSERT INTO notes (eleve_id, matiere_id, classe_id, enseignant_id, type_evaluation,
            periode, annee_scolaire, note, note_max, coefficient, commentaire, date_evaluation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [
            data.eleveId || data.eleve_id, matiereId, classeId,
            data.enseignantId || data.enseignant_id,
            data.typeEvaluation || data.type_evaluation,
            data.periode, anneeScolaire, data.note,
            data.noteMax || data.note_max || 20,
            coefficientToSave, data.commentaire || null,
            data.dateEvaluation || data.date_evaluation || new Date()
          ]
        );
        results.push(result.rows[0]);
      } catch (err) {
        errors.push({ eleveId: data.eleveId, error: err.message });
      }
    }

    res.status(201).json({ saved: results.length, errors });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getNotes = async (req, res) => {
  try {
    if (!ensureEnseignantAttached(req, res)) return;

    const { eleve, classe, matiere, periode, anneeScolaire } = req.query;

    let sql = `
      SELECT n.*,
             e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
             c.id as classe_ref_id, c.nom as classe_nom, c.niveau as classe_niveau, c.cycle as classe_cycle,
             m.id as matiere_id, m.nom as matiere_nom, m.code as matiere_code, m.coefficient as matiere_coefficient,
             ens.id as enseignant_id, ens.nom as enseignant_nom, ens.prenom as enseignant_prenom
      FROM notes n
      LEFT JOIN eleves e ON n.eleve_id = e.id
      LEFT JOIN classes c ON n.classe_id = c.id
      LEFT JOIN matieres m ON n.matiere_id = m.id
      LEFT JOIN enseignants ens ON n.enseignant_id = ens.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    const isEnseignant = isEnseignantRole(req);
    const enseignantId = getEnseignantIdFromUser(req);

    if (isEnseignant) {
      sql += ` AND (
        EXISTS (
          SELECT 1
          FROM classe_matieres cm
          WHERE cm.classe_id = n.classe_id
            AND cm.matiere_id = n.matiere_id
            AND cm.enseignant_id = $${paramIndex}
            AND cm.annee_scolaire = n.annee_scolaire
        )
        OR (
          EXISTS (
            SELECT 1
            FROM classes c2
            WHERE c2.id = n.classe_id
              AND c2.enseignant_principal_id = $${paramIndex}
          )
          AND EXISTS (
            SELECT 1
            FROM enseignant_matieres em
            WHERE em.enseignant_id = $${paramIndex}
              AND em.matiere_id = n.matiere_id
          )
        )
      )`;
      params.push(enseignantId);
      paramIndex++;
    }

    if (eleve) {
      sql += ` AND n.eleve_id = $${paramIndex}`;
      params.push(eleve);
      paramIndex++;
    }

    if (classe) {
      sql += ` AND n.classe_id = $${paramIndex}`;
      params.push(classe);
      paramIndex++;
    }

    if (matiere) {
      sql += ` AND n.matiere_id = $${paramIndex}`;
      params.push(matiere);
      paramIndex++;
    }

    if (periode) {
      const periodeCode = convertPeriode(periode);
      if (!periodeCode) {
        return res.status(400).json({ message: 'Periode invalide' });
      }
      sql += ` AND n.periode = $${paramIndex}`;
      params.push(periodeCode);
      paramIndex++;
    }

    if (anneeScolaire) {
      sql += ` AND n.annee_scolaire = $${paramIndex}`;
      params.push(anneeScolaire);
      paramIndex++;
    }

    sql += ` ORDER BY n.date_evaluation DESC`;

    const result = await query(sql, params);
    res.json(result.rows.map(mapNoteRow));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNoteById = async (req, res) => {
  try {
    if (!ensureEnseignantAttached(req, res)) return;

    const result = await query(
      `SELECT n.*,
              e.id as eleve_id, e.nom as eleve_nom, e.prenom as eleve_prenom, e.matricule as eleve_matricule,
              c.id as classe_ref_id, c.nom as classe_nom, c.niveau as classe_niveau, c.cycle as classe_cycle,
              m.id as matiere_id, m.nom as matiere_nom, m.code as matiere_code, m.coefficient as matiere_coefficient,
              ens.id as enseignant_id, ens.nom as enseignant_nom, ens.prenom as enseignant_prenom
       FROM notes n
       LEFT JOIN eleves e ON n.eleve_id = e.id
       LEFT JOIN classes c ON n.classe_id = c.id
       LEFT JOIN matieres m ON n.matiere_id = m.id
       LEFT JOIN enseignants ens ON n.enseignant_id = ens.id
       WHERE n.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Note non trouvee' });
    }

    if (isEnseignantRole(req)) {
      const row = result.rows[0];
      const canManage = await canEnseignantManageMatiere({
        enseignantId: getEnseignantIdFromUser(req),
        classeId: row.classe_id,
        matiereId: row.matiere_id,
        anneeScolaire: row.annee_scolaire
      });
      if (!canManage) {
        return res.status(403).json({ message: 'Acces refuse a cette note' });
      }
    }

    res.json(mapNoteRow(result.rows[0]));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createNote = async (req, res) => {
  try {
    if (!ensureEnseignantAttached(req, res)) return;

    const data = { ...req.body };

    if (data.typeEvaluation) data.typeEvaluation = data.typeEvaluation.toUpperCase();
    if (data.type_evaluation) data.type_evaluation = data.type_evaluation.toUpperCase();
    if (data.periode !== undefined) {
      const periodeCode = convertPeriode(data.periode);
      if (!periodeCode) {
        return res.status(400).json({ message: 'Periode invalide' });
      }
      data.periode = periodeCode;
    }

    const classeId = data.classeId || data.classe_id;
    const matiereId = data.matiereId || data.matiere_id;
    const anneeScolaire = data.anneeScolaire || data.annee_scolaire;
    const isEnseignant = isEnseignantRole(req);
    const enseignantId = getEnseignantIdFromUser(req);

    if (isEnseignant) {
      const canManage = await canEnseignantManageMatiere({
        enseignantId,
        classeId,
        matiereId,
        anneeScolaire
      });
      if (!canManage) {
        return res.status(403).json({ message: 'Matiere/classe non autorisee pour cet enseignant' });
      }
      data.enseignantId = enseignantId;
      data.enseignant_id = enseignantId;
    }

    let coefficientToSave = parseFloat(data.coefficient);

    if (!(await isPeriodeCompatibleWithClasse(classeId, data.periode))) {
      return res.status(400).json({
        message: 'Periode incompatible avec le cycle de la classe'
      });
    }

    if (!Number.isFinite(coefficientToSave) || coefficientToSave <= 0) {
      const coefResult = await query(
        `SELECT cm.coefficient AS classe_coefficient, m.coefficient AS matiere_coefficient
         FROM matieres m
         LEFT JOIN classe_matieres cm
           ON cm.matiere_id = m.id
          AND cm.classe_id = $1
          AND cm.annee_scolaire = $2
         WHERE m.id = $3
         ORDER BY cm.updated_at DESC NULLS LAST
         LIMIT 1`,
        [classeId || null, anneeScolaire || null, matiereId]
      );

      if (coefResult.rows.length > 0) {
        const row = coefResult.rows[0];
        coefficientToSave = parseFloat(row.classe_coefficient || row.matiere_coefficient || 1);
      } else {
        coefficientToSave = 1;
      }
    }

    const result = await query(
      `INSERT INTO notes (
        eleve_id, matiere_id, classe_id, enseignant_id, type_evaluation,
        periode, annee_scolaire, note, note_max, coefficient, commentaire, date_evaluation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.eleveId || data.eleve_id,
        matiereId,
        classeId,
        data.enseignantId || data.enseignant_id,
        data.typeEvaluation || data.type_evaluation,
        data.periode,
        anneeScolaire,
        data.note,
        data.noteMax || data.note_max || 20,
        coefficientToSave,
        data.commentaire,
        data.dateEvaluation || data.date_evaluation || new Date()
      ]
    );

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'NOTE_CREATE',
      entity: 'NOTE',
      entityId: result.rows[0].id,
      status: 'SUCCESS',
      details: {
        eleveId: result.rows[0].eleve_id,
        matiereId: result.rows[0].matiere_id,
        classeId: result.rows[0].classe_id,
        anneeScolaire: result.rows[0].annee_scolaire
      }
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateNote = async (req, res) => {
  try {
    if (!ensureEnseignantAttached(req, res)) return;

    const data = { ...req.body };
    const isEnseignant = isEnseignantRole(req);
    const enseignantId = getEnseignantIdFromUser(req);

    if (data.typeEvaluation) data.typeEvaluation = data.typeEvaluation.toUpperCase();
    if (data.type_evaluation) data.type_evaluation = data.type_evaluation.toUpperCase();
    if (data.periode !== undefined) {
      const periodeCode = convertPeriode(data.periode);
      if (!periodeCode) {
        return res.status(400).json({ message: 'Periode invalide' });
      }
      data.periode = periodeCode;
    }

    const existingResult = await query(
      'SELECT id, classe_id, matiere_id, annee_scolaire, periode FROM notes WHERE id = $1',
      [req.params.id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: 'Note non trouvee' });
    }

    const existing = existingResult.rows[0];
    const targetClasseId = data.classeId || data.classe_id || existing.classe_id;
    const targetMatiereId = data.matiereId || data.matiere_id || existing.matiere_id;
    const targetAnneeScolaire = data.anneeScolaire || data.annee_scolaire || existing.annee_scolaire;
    const targetPeriode = data.periode || existing.periode;

    if (isEnseignant) {
      const canManage = await canEnseignantManageMatiere({
        enseignantId,
        classeId: targetClasseId,
        matiereId: targetMatiereId,
        anneeScolaire: targetAnneeScolaire
      });
      if (!canManage) {
        return res.status(403).json({ message: 'Matiere/classe non autorisee pour cet enseignant' });
      }
    }

    if (!(await isPeriodeCompatibleWithClasse(targetClasseId, targetPeriode))) {
      return res.status(400).json({
        message: 'Periode incompatible avec le cycle de la classe'
      });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      eleveId: 'eleve_id',
      eleve_id: 'eleve_id',
      matiereId: 'matiere_id',
      matiere_id: 'matiere_id',
      classeId: 'classe_id',
      classe_id: 'classe_id',
      enseignantId: 'enseignant_id',
      enseignant_id: 'enseignant_id',
      typeEvaluation: 'type_evaluation',
      type_evaluation: 'type_evaluation',
      periode: 'periode',
      anneeScolaire: 'annee_scolaire',
      annee_scolaire: 'annee_scolaire',
      note: 'note',
      noteMax: 'note_max',
      note_max: 'note_max',
      coefficient: 'coefficient',
      commentaire: 'commentaire',
      dateEvaluation: 'date_evaluation',
      date_evaluation: 'date_evaluation'
    };

    for (const [key, dbField] of Object.entries(fieldMapping)) {
      if (data[key] !== undefined) {
        if (isEnseignant && dbField === 'enseignant_id') {
          continue;
        }
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(data[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Aucune donnee a mettre a jour' });
    }

    if (isEnseignant) {
      fields.push(`enseignant_id = $${paramIndex}`);
      values.push(enseignantId);
      paramIndex++;
    }

    fields.push('updated_at = NOW()');
    values.push(req.params.id);

    const sql = `UPDATE notes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'NOTE_UPDATE',
      entity: 'NOTE',
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

exports.deleteNote = async (req, res) => {
  try {
    if (!ensureEnseignantAttached(req, res)) return;

    if (isEnseignantRole(req)) {
      const noteCtx = await query(
        'SELECT classe_id, matiere_id, annee_scolaire FROM notes WHERE id = $1',
        [req.params.id]
      );
      if (noteCtx.rows.length === 0) {
        return res.status(404).json({ message: 'Note non trouvee' });
      }
      const canManage = await canEnseignantManageMatiere({
        enseignantId: getEnseignantIdFromUser(req),
        classeId: noteCtx.rows[0].classe_id,
        matiereId: noteCtx.rows[0].matiere_id,
        anneeScolaire: noteCtx.rows[0].annee_scolaire
      });
      if (!canManage) {
        return res.status(403).json({ message: 'Acces refuse a cette note' });
      }
    }

    const result = await query('DELETE FROM notes WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Note non trouvee' });
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'NOTE_DELETE',
      entity: 'NOTE',
      entityId: result.rows[0].id,
      status: 'SUCCESS'
    });

    res.json({ message: 'Note supprimee avec succes' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBulletin = async (req, res) => {
  try {
    if (isEnseignantRole(req)) {
      return res.status(403).json({
        message: 'Acces refuse: bulletin reserve a la direction et a l administration'
      });
    }

    const { eleveId } = req.params;
    const { periode, anneeScolaire } = req.query;
    const periodeCode = convertPeriode(periode);

    if (!periodeCode || !PERIODE_NOTE_VALUES.has(periodeCode)) {
      return res.status(400).json({ message: 'Periode invalide' });
    }

    if (!anneeScolaire) {
      return res.status(400).json({ message: 'Annee scolaire requise' });
    }

    const eleveResult = await query(
      `SELECT e.*,
              c.id as classe_id, c.nom as classe_nom, c.niveau as classe_niveau, c.cycle as classe_cycle
       FROM eleves e
       LEFT JOIN classes c ON e.classe_id = c.id
       WHERE e.id = $1`,
      [eleveId]
    );

    if (eleveResult.rows.length === 0) {
      return res.status(404).json({ message: 'Eleve non trouve' });
    }

    const eleveRow = eleveResult.rows[0];
    if (!eleveRow.classe_id) {
      return res.status(400).json({ message: 'Eleve sans classe, bulletin indisponible' });
    }

    if (!BULLETIN_NIVEAUX_AUTORISES.has(String(eleveRow.classe_niveau || '').toUpperCase())) {
      return res.status(403).json({
        message: 'Le bulletin est disponible uniquement pour les classes de la 6e a la Terminale'
      });
    }

    if (!isPeriodeCompatibleWithCycle(periodeCode, eleveRow.classe_cycle)) {
      const cycleLabel = normalizeCycle(eleveRow.classe_cycle) === 'LYCEE' ? 'semestre' : 'trimestre';
      return res.status(400).json({
        message: `Periode incompatible avec le cycle de la classe. Utilisez une periode de type ${cycleLabel}.`
      });
    }

    const classeId = eleveRow.classe_id;

    const [elevesClasseResult, classeMatieresResult, notesClasseResult] = await Promise.all([
      query(
        `SELECT id, nom, prenom
         FROM eleves
         WHERE classe_id = $1 AND statut = 'ACTIF'
         ORDER BY nom, prenom`,
        [classeId]
      ),
      query(
        `SELECT
           cm.matiere_id,
           cm.coefficient AS classe_coefficient,
           m.nom AS matiere_nom,
           m.code AS matiere_code,
           m.coefficient AS matiere_default_coefficient,
           ens.nom AS enseignant_nom,
           ens.prenom AS enseignant_prenom
         FROM classe_matieres cm
         INNER JOIN matieres m ON m.id = cm.matiere_id
         LEFT JOIN enseignants ens ON ens.id = cm.enseignant_id
         WHERE cm.classe_id = $1 AND cm.annee_scolaire = $2
         ORDER BY m.nom`,
        [classeId, anneeScolaire]
      ),
      query(
        `SELECT n.id, n.eleve_id, n.matiere_id, n.type_evaluation, n.note, n.note_max, n.coefficient, n.date_evaluation
         FROM notes n
         WHERE n.classe_id = $1 AND n.annee_scolaire = $2 AND n.periode = $3
         ORDER BY n.date_evaluation ASC`,
        [classeId, anneeScolaire, periodeCode]
      )
    ]);

    let matieresClasse = classeMatieresResult.rows;
    if (matieresClasse.length === 0) {
      const matieresFallbackResult = await query(
        `SELECT DISTINCT
           n.matiere_id,
           NULL::numeric AS classe_coefficient,
           m.nom AS matiere_nom,
           m.code AS matiere_code,
           m.coefficient AS matiere_default_coefficient,
           NULL::varchar AS enseignant_nom,
           NULL::varchar AS enseignant_prenom
         FROM notes n
         INNER JOIN matieres m ON m.id = n.matiere_id
         WHERE n.classe_id = $1 AND n.annee_scolaire = $2 AND n.periode = $3
         ORDER BY m.nom`,
        [classeId, anneeScolaire, periodeCode]
      );
      matieresClasse = matieresFallbackResult.rows;
    }

    const elevesClasse = elevesClasseResult.rows;
    const notesClasse = notesClasseResult.rows;
    const notesByEleveMatiere = new Map();

    notesClasse.forEach((note) => {
      const key = `${note.eleve_id}:${note.matiere_id}`;
      if (!notesByEleveMatiere.has(key)) {
        notesByEleveMatiere.set(key, []);
      }
      notesByEleveMatiere.get(key).push(note);
    });

    const lineCache = new Map();
    const getLineForStudent = (studentId, matiereRow) => {
      const cacheKey = `${studentId}:${matiereRow.matiere_id}`;
      if (lineCache.has(cacheKey)) {
        return lineCache.get(cacheKey);
      }

      const coefficient = parseScore(
        matiereRow.classe_coefficient || matiereRow.matiere_default_coefficient || 1,
        1
      );
      const notesForMatiere = notesByEleveMatiere.get(cacheKey) || [];
      const line = computeMatiereLine(notesForMatiere, coefficient);
      lineCache.set(cacheKey, line);
      return line;
    };

    const rangByMatiere = {};
    matieresClasse.forEach((matiereRow) => {
      const scores = elevesClasse
        .map((student) => {
          const line = getLineForStudent(student.id, matiereRow);
          return Number.isFinite(line.noteSur20)
            ? { studentId: student.id, score: line.noteSur20 }
            : null;
        })
        .filter(Boolean);

      rangByMatiere[matiereRow.matiere_id] = buildRanks(scores, 'score');
    });

    const overallScores = elevesClasse
      .map((student) => {
        let totalPoints = 0;
        let totalCoef = 0;

        matieresClasse.forEach((matiereRow) => {
          const line = getLineForStudent(student.id, matiereRow);
          if (Number.isFinite(line.noteSur20)) {
            totalPoints += line.noteSur20 * line.coefficient;
            totalCoef += line.coefficient;
          }
        });

        const moyenne = totalCoef > 0 ? totalPoints / totalCoef : null;
        if (!Number.isFinite(moyenne)) return null;

        return { studentId: student.id, score: moyenne };
      })
      .filter(Boolean);

    const overallRankMap = buildRanks(overallScores, 'score');
    const moyenneClasseGenerale = average(overallScores.map((s) => s.score));
    const meilleureMoyenne = overallScores.length > 0 ? Math.max(...overallScores.map((s) => s.score)) : null;
    const plusFaibleMoyenne = overallScores.length > 0 ? Math.min(...overallScores.map((s) => s.score)) : null;

    const lignes = matieresClasse.map((matiereRow) => {
      const line = getLineForStudent(eleveId, matiereRow);
      const professeur = matiereRow.enseignant_nom
        ? `${matiereRow.enseignant_prenom || ''} ${matiereRow.enseignant_nom}`.trim()
        : null;

      return {
        matiereId: matiereRow.matiere_id,
        matiereNom: matiereRow.matiere_nom,
        matiereCode: matiereRow.matiere_code,
        inter: line.inter,
        devoir: line.devoir,
        moyenneClasse: line.moyenneClasse,
        composition: line.composition,
        noteSur20: line.noteSur20,
        coefficient: line.coefficient,
        noteCoefficient: line.noteCoefficient,
        noteCoefficientMax: line.noteCoefficientMax,
        rang: rangByMatiere[matiereRow.matiere_id]?.[eleveId] || null,
        professeur,
        appreciation: line.appreciation
      };
    });

    const lignesAvecNote = lignes.filter((line) => Number.isFinite(line.noteSur20));
    const totalCoefficients = lignesAvecNote.reduce((sum, line) => sum + parseScore(line.coefficient, 0), 0);
    const totalPoints = lignesAvecNote.reduce((sum, line) => sum + parseScore(line.noteCoefficient, 0), 0);
    const totalPointsMax = lignesAvecNote.reduce((sum, line) => sum + parseScore(line.noteCoefficientMax, 0), 0);
    const moyenneGenerale = totalCoefficients > 0 ? totalPoints / totalCoefficients : null;

    const periodeRange = getPeriodeRange(anneeScolaire, periodeCode);
    let absencesResult;
    if (periodeRange) {
      absencesResult = await query(
        `SELECT
           COUNT(*)::int AS total,
           SUM(CASE WHEN justifiee THEN 1 ELSE 0 END)::int AS justifiees
         FROM absences
         WHERE eleve_id = $1
           AND annee_scolaire = $2
           AND date BETWEEN $3 AND $4`,
        [eleveId, anneeScolaire, periodeRange.from, periodeRange.to]
      );
    } else {
      absencesResult = await query(
        `SELECT
           COUNT(*)::int AS total,
           SUM(CASE WHEN justifiee THEN 1 ELSE 0 END)::int AS justifiees
         FROM absences
         WHERE eleve_id = $1
           AND annee_scolaire = $2`,
        [eleveId, anneeScolaire]
      );
    }

    const absencesTotal = parseScore(absencesResult.rows[0]?.total, 0);
    const absencesJustifiees = parseScore(absencesResult.rows[0]?.justifiees, 0);
    const absencesNonJustifiees = Math.max(0, absencesTotal - absencesJustifiees);

    const eleve = {
      id: eleveRow.id,
      matricule: eleveRow.matricule,
      nom: eleveRow.nom,
      prenom: eleveRow.prenom,
      date_naissance: eleveRow.date_naissance,
      sexe: eleveRow.sexe,
      classe: eleveRow.classe_id
        ? {
            id: eleveRow.classe_id,
            nom: eleveRow.classe_nom,
            niveau: eleveRow.classe_niveau,
            cycle: eleveRow.classe_cycle
          }
        : null
    };

    res.json({
      eleve,
      classe: eleve.classe,
      effectif: elevesClasse.length,
      periode: periodeCode,
      periodeLabel: periodeLabel(periodeCode),
      anneeScolaire,
      lignes,
      resume: {
        totalCoefficients: round2(totalCoefficients) || 0,
        totalPoints: round2(totalPoints) || 0,
        totalPointsMax: round2(totalPointsMax) || 0,
        moyenneGenerale: round2(moyenneGenerale),
        rangClasse: overallRankMap[eleveId] || null,
        mention: mentionFromAverage(moyenneGenerale),
        appreciation: appreciate(moyenneGenerale),
        moyenneClasseGenerale: round2(moyenneClasseGenerale),
        meilleureMoyenne: round2(meilleureMoyenne),
        plusFaibleMoyenne: round2(plusFaibleMoyenne),
        absences: absencesTotal,
        absencesJustifiees,
        absencesNonJustifiees,
        retards: 0
      },
      moyenneGenerale: round2(moyenneGenerale),
      totalCoefficients: round2(totalCoefficients) || 0,
      notesParMatiere: lignes
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
