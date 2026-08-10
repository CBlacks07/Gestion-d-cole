const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { query, queryScoped, queryBypassRls, getClient } = require('../lib/db');
const logger = require('../lib/logger');

const BACKUPS_DIR = process.env.BACKUPS_DIR || path.join(__dirname, '../../../backups');
const SETTINGS_FILE = path.join(BACKUPS_DIR, '.settings.json');

// Sur Vercel (et serverless en général), le disque est en lecture seule et
// aucun scheduler en mémoire (node-cron) ne survit entre les invocations :
// ce sous-système de sauvegarde planifiée sur fichier local ne peut pas
// fonctionner tel quel. `exportBackup`/`restoreBackup` (par école, sans
// aucune écriture disque) restent disponibles partout — seules les routes
// `/auto/*` (déjà réservées à SUPER_ADMIN) sont désactivées ici.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Ordre pensé pour respecter les clés étrangères à l'insertion (chaque
// table n'apparaît qu'après toutes celles qu'elle référence) : ni Neon ni
// un rôle applicatif non-superuser ne permettent de désactiver les
// contraintes via `session_replication_role`, donc l'ordre doit être
// correct par construction plutôt que contourné.
const EXPORT_ORDER = [
  'annees_scolaires',
  'matieres',
  'enseignants',
  'users',
  'classes',
  'eleves',
  'classe_matieres',
  'notes',
  'absences',
  'paiements'
];

const TRUNCATE_ORDER = [...EXPORT_ORDER].reverse();

const DEFAULT_SETTINGS = {
  enabled: false,
  frequency: 'daily',
  hour: 2,
  keepCount: 7,
  lastBackup: null,
  lastBackupFile: null,
  restoreTestEnabled: true,
  restoreTestFrequency: 'monthly',
  restoreTestHour: 4,
  restoreTestSampleRows: 25,
  lastRestoreTest: null,
  lastRestoreTestStatus: null,
  lastRestoreTestError: null,
  lastRestoreTestBackup: null
};

let backupCronTask = null;
let restoreCronTask = null;

const clampInt = (value, fallback, min, max) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

function ensureBackupsDir() {
  if (isServerless) return;
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Ignore malformed settings and fallback to defaults.
  }

  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  ensureBackupsDir();
  const next = { ...DEFAULT_SETTINGS, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function listBackupFiles() {
  ensureBackupsDir();

  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((filename) => filename.endsWith('.json') && filename.startsWith('backup_'))
    .sort()
    .reverse()
    .map((filename) => {
      const stats = fs.statSync(path.join(BACKUPS_DIR, filename));
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });
}

function isValidBackupFilename(filename) {
  return (
    typeof filename === 'string' &&
    filename.endsWith('.json') &&
    filename.startsWith('backup_') &&
    !filename.includes('..')
  );
}

function getBackupFilePath(filename) {
  if (!isValidBackupFilename(filename)) {
    throw new Error('Nom de fichier invalide');
  }

  return path.join(BACKUPS_DIR, path.basename(filename));
}

function createBackupFilename(prefix = 'backup_ecole') {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}_${date}.json`;
}

function pruneOldBackups(keepCount) {
  const files = listBackupFiles();
  if (files.length <= keepCount) return;

  files.slice(keepCount).forEach((file) => {
    try {
      fs.unlinkSync(path.join(BACKUPS_DIR, file.filename));
    } catch {
      // Ignore deletion failures here.
    }
  });
}

// `ecoleId` null = dump complet (toutes les écoles) : réservé aux
// sauvegardes planifiées (cron, hors requête HTTP) et à SUPER_ADMIN.
// Toute route accessible à un ADMIN/DIRECTEUR d'école DOIT passer un
// ecoleId pour ne jamais exposer les données d'une autre école.
async function generateBackupData(label, ecoleId = null) {
  const backup = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy: label || 'auto',
    database: process.env.DB_NAME || process.env.PGDATABASE || 'ECOLE',
    ecoleId,
    tables: {}
  };

  for (const table of EXPORT_ORDER) {
    const filterSql = ecoleId ? ' WHERE ecole_id = $1' : '';
    const params = ecoleId ? [ecoleId] : [];
    // `users` n'est pas sous RLS forcée (voir migration_multi_ecole.sql) :
    // le filtre explicite ci-dessus suffit, `query` brut fonctionne.
    // Toutes les autres tables SONT sous FORCE ROW LEVEL SECURITY : sans
    // `app.ecole_id` (ou l'échappatoire bypass) actif dans la transaction,
    // un `query()` brut renverrait silencieusement 0 ligne, peu importe le
    // filtre WHERE — d'où l'usage de queryScoped/queryBypassRls ici.
    const runQuery = table === 'users'
      ? (sql, p) => query(sql, p)
      : ecoleId
        ? (sql, p) => queryScoped(ecoleId, sql, p)
        : (sql, p) => queryBypassRls(sql, p);

    try {
      const result = await runQuery(`SELECT * FROM ${table}${filterSql} ORDER BY created_at ASC NULLS LAST`, params);
      backup.tables[table] = result.rows;
    } catch {
      try {
        const result = await runQuery(`SELECT * FROM ${table}${filterSql}`, params);
        backup.tables[table] = result.rows;
      } catch (error) {
        backup.tables[table] = { error: error.message };
      }
    }
  }

  return backup;
}

async function createAndStoreBackup(exportedBy, ecoleId = null) {
  ensureBackupsDir();
  const data = await generateBackupData(exportedBy, ecoleId);
  const filename = createBackupFilename('backup_ecole');
  fs.writeFileSync(path.join(BACKUPS_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
  return filename;
}

function buildCronExpr(frequency, hour, fallbackFrequency = 'daily') {
  const normalizedFrequency = ['daily', 'weekly', 'monthly'].includes(frequency)
    ? frequency
    : fallbackFrequency;
  const h = clampInt(hour, 2, 0, 23);

  if (normalizedFrequency === 'weekly') return `0 ${h} * * 0`;
  if (normalizedFrequency === 'monthly') return `0 ${h} 1 * *`;
  return `0 ${h} * * *`;
}

function getLatestBackupFile() {
  const files = listBackupFiles();
  return files.length > 0 ? files[0].filename : null;
}

function readBackupFile(filename) {
  const filepath = getBackupFilePath(filename);
  if (!fs.existsSync(filepath)) {
    throw new Error('Fichier de sauvegarde introuvable');
  }

  const raw = fs.readFileSync(filepath, 'utf8');
  const parsed = JSON.parse(raw);

  if (parsed.version !== '1.0') {
    throw new Error(`Version de sauvegarde non supportee: ${parsed.version}`);
  }

  if (!parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error('Format de sauvegarde invalide: section tables manquante');
  }

  return parsed;
}

async function runRestoreValidation({ filename = null, sampleRows = 25 } = {}) {
  const selectedFilename = filename || getLatestBackupFile();
  if (!selectedFilename) {
    throw new Error('Aucune sauvegarde disponible pour test de restauration');
  }

  const backup = readBackupFile(selectedFilename);
  const tables = backup.tables;
  const maxRows = clampInt(sampleRows, 25, 1, 500);

  const client = await getClient();

  const summary = {
    filename: selectedFilename,
    checkedTables: 0,
    sampledRows: 0,
    warnings: []
  };

  try {
    await client.query('BEGIN');

    for (let index = 0; index < EXPORT_ORDER.length; index++) {
      const table = EXPORT_ORDER[index];
      const rows = tables[table];

      if (!Array.isArray(rows)) {
        summary.warnings.push(`Table ${table} absente ou invalide dans la sauvegarde`);
        continue;
      }

      const columnsResult = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );

      const tableColumns = columnsResult.rows.map((row) => row.column_name);
      if (tableColumns.length === 0) {
        summary.warnings.push(`Table ${table} introuvable dans la base courante`);
        continue;
      }

      const tmpTable = `restore_test_${table}_${Date.now()}_${index}`.replace(/[^a-zA-Z0-9_]/g, '_');
      await client.query(
        `CREATE TEMP TABLE "${tmpTable}" (LIKE "${table}" INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY) ON COMMIT DROP`
      );

      const sample = rows.slice(0, maxRows);
      for (const row of sample) {
        if (!row || typeof row !== 'object') continue;

        const insertColumns = tableColumns.filter((col) => Object.prototype.hasOwnProperty.call(row, col));
        if (insertColumns.length === 0) continue;

        const quotedCols = insertColumns.map((col) => `"${col}"`).join(', ');
        const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ');
        const values = insertColumns.map((col) => row[col]);

        await client.query(
          `INSERT INTO "${tmpTable}" (${quotedCols}) VALUES (${placeholders})`,
          values
        );

        summary.sampledRows += 1;
      }

      summary.checkedTables += 1;
    }

    await client.query('ROLLBACK');
    return summary;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function runAutoBackup() {
  const settings = loadSettings();
  if (!settings.enabled) return;

  try {
    const filename = await createAndStoreBackup('auto');
    const updated = {
      ...settings,
      lastBackup: new Date().toISOString(),
      lastBackupFile: filename
    };

    saveSettings(updated);
    pruneOldBackups(updated.keepCount || 7);

    logger.info(`[Backup] sauvegarde automatique creee: ${filename}`);
  } catch (error) {
    logger.error('[Backup] erreur sauvegarde automatique:', error.message);
  }
}

async function runScheduledRestoreTest() {
  const settings = loadSettings();
  if (!settings.restoreTestEnabled) return;

  try {
    const result = await runRestoreValidation({
      sampleRows: settings.restoreTestSampleRows
    });

    saveSettings({
      ...settings,
      lastRestoreTest: new Date().toISOString(),
      lastRestoreTestStatus: 'SUCCESS',
      lastRestoreTestError: null,
      lastRestoreTestBackup: result.filename
    });

    logger.info(`[Backup] test de restauration valide sur ${result.filename}`);
  } catch (error) {
    saveSettings({
      ...settings,
      lastRestoreTest: new Date().toISOString(),
      lastRestoreTestStatus: 'FAILED',
      lastRestoreTestError: error.message,
      lastRestoreTestBackup: null
    });

    logger.error('[Backup] echec du test de restauration:', error.message);
  }
}

function startScheduler() {
  // Rien à planifier en serverless : pas de process long-vivant pour
  // porter un timer node-cron, et pas de disque pour loadSettings().
  if (isServerless) return;

  const settings = loadSettings();

  if (backupCronTask) {
    backupCronTask.stop();
    backupCronTask = null;
  }

  if (restoreCronTask) {
    restoreCronTask.stop();
    restoreCronTask = null;
  }

  if (settings.enabled) {
    const backupExpr = buildCronExpr(settings.frequency, settings.hour, 'daily');
    backupCronTask = cron.schedule(backupExpr, runAutoBackup);
    logger.info(`[Backup] planification sauvegarde: ${backupExpr}`);
  }

  if (settings.restoreTestEnabled) {
    const restoreExpr = buildCronExpr(settings.restoreTestFrequency, settings.restoreTestHour, 'monthly');
    restoreCronTask = cron.schedule(restoreExpr, runScheduledRestoreTest);
    logger.info(`[Backup] planification test restauration: ${restoreExpr}`);
  }
}

ensureBackupsDir();
startScheduler();

// Réutilisé par lib/scheduledBackupEmail.js (sauvegarde auto par email,
// par école) pour ne pas dupliquer la logique d'export scopée par école.
exports.generateBackupData = generateBackupData;

exports.exportBackup = async (req, res) => {
  try {
    const userLabel = `${req.user?.prenom || ''} ${req.user?.nom || ''}`.trim() || 'manual';
    const data = await generateBackupData(userLabel, req.ecoleId);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `backup_ecole_${date}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error('Erreur backup:', error.message);
    res.status(500).json({ message: 'Erreur lors de la generation de la sauvegarde' });
  }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

exports.restoreBackup = async (req, res) => {
  const { tables, version } = req.body;

  if (!tables || typeof tables !== 'object') {
    return res.status(400).json({ message: 'Fichier de sauvegarde invalide' });
  }

  if (version !== '1.0') {
    return res.status(400).json({ message: `Version de sauvegarde non supportee: ${version}` });
  }

  const ecoleId = req.ecoleId;
  if (!ecoleId || !UUID_RE.test(ecoleId)) {
    return res.status(403).json({ message: 'École non identifiée pour cet utilisateur' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');
    // Active la policy RLS pour cette transaction (tables sous FORCE ROW
    // LEVEL SECURITY) : sans ça les INSERT ci-dessous échoueraient.
    await client.query(`SET LOCAL app.ecole_id = '${ecoleId}'`);

    // Ne supprime QUE les données de l'école de l'utilisateur qui restaure
    // — jamais un TRUNCATE global, qui effacerait les autres écoles.
    for (const table of TRUNCATE_ORDER) {
      try {
        await client.query(`DELETE FROM "${table}" WHERE ecole_id = $1`, [ecoleId]);
      } catch {
        // Ignore missing tables / tables sans colonne ecole_id.
      }
    }

    const stats = {};

    for (const table of EXPORT_ORDER) {
      const rows = tables[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        stats[table] = 0;
        continue;
      }

      // On ignore l'ecole_id éventuellement présent dans le fichier importé
      // et on force celui de l'utilisateur courant : un fichier de
      // sauvegarde ne doit jamais pouvoir injecter des données dans une
      // autre école que celle de la personne qui restaure.
      const columns = Array.from(new Set([...Object.keys(rows[0]), 'ecole_id']));
      let inserted = 0;

      for (const row of rows) {
        const rowWithEcole = { ...row, ecole_id: ecoleId };
        const cols = columns.map((col) => `"${col}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map((col) => rowWithEcole[col]);

        await client.query(
          `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );

        inserted += 1;
      }

      stats[table] = inserted;
    }

    await client.query('COMMIT');

    res.json({ message: 'Restauration effectuee avec succes', stats });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    logger.error('Erreur restauration:', error.message);
    res.status(500).json({ message: 'Erreur lors de la restauration', detail: error.message });
  } finally {
    client.release();
  }
};

exports.getAutoSettings = (req, res) => {
  const settings = loadSettings();
  const files = listBackupFiles();

  res.json({
    settings,
    files,
    scheduler: {
      backupEnabled: Boolean(backupCronTask),
      restoreTestEnabled: Boolean(restoreCronTask)
    }
  });
};

exports.updateAutoSettings = (req, res) => {
  const current = loadSettings();
  const body = req.body || {};

  const next = {
    ...current,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled,
    frequency: ['daily', 'weekly', 'monthly'].includes(body.frequency) ? body.frequency : current.frequency,
    hour: body.hour !== undefined ? clampInt(body.hour, current.hour, 0, 23) : current.hour,
    keepCount: body.keepCount !== undefined ? clampInt(body.keepCount, current.keepCount, 1, 365) : current.keepCount,
    restoreTestEnabled:
      body.restoreTestEnabled !== undefined
        ? Boolean(body.restoreTestEnabled)
        : current.restoreTestEnabled,
    restoreTestFrequency: ['daily', 'weekly', 'monthly'].includes(body.restoreTestFrequency)
      ? body.restoreTestFrequency
      : current.restoreTestFrequency,
    restoreTestHour:
      body.restoreTestHour !== undefined
        ? clampInt(body.restoreTestHour, current.restoreTestHour, 0, 23)
        : current.restoreTestHour,
    restoreTestSampleRows:
      body.restoreTestSampleRows !== undefined
        ? clampInt(body.restoreTestSampleRows, current.restoreTestSampleRows, 1, 500)
        : current.restoreTestSampleRows
  };

  saveSettings(next);
  startScheduler();

  res.json({ message: 'Parametres mis a jour', settings: next });
};

exports.downloadAutoBackup = (req, res) => {
  try {
    const filename = path.basename(req.params.filename || '');
    const filepath = getBackupFilePath(filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Fichier introuvable' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filepath).pipe(res);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.deleteAutoBackup = (req, res) => {
  try {
    const filename = path.basename(req.params.filename || '');
    const filepath = getBackupFilePath(filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Fichier introuvable' });
    }

    fs.unlinkSync(filepath);
    return res.json({ message: 'Fichier supprime' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.triggerAutoBackup = async (req, res) => {
  try {
    const userLabel = `${req.user?.prenom || ''} ${req.user?.nom || ''}`.trim() || 'manual';
    const filename = await createAndStoreBackup(userLabel);

    const settings = loadSettings();
    const updated = saveSettings({
      ...settings,
      lastBackup: new Date().toISOString(),
      lastBackupFile: filename
    });

    pruneOldBackups(updated.keepCount || 7);

    res.json({ message: 'Sauvegarde creee avec succes', filename });
  } catch (error) {
    logger.error('Erreur backup manuel:', error.message);
    res.status(500).json({ message: 'Erreur lors de la sauvegarde' });
  }
};

exports.getRestoreTestStatus = (req, res) => {
  const settings = loadSettings();
  const latestBackup = getLatestBackupFile();

  res.json({
    restoreTest: {
      enabled: settings.restoreTestEnabled,
      frequency: settings.restoreTestFrequency,
      hour: settings.restoreTestHour,
      sampleRows: settings.restoreTestSampleRows,
      lastRunAt: settings.lastRestoreTest,
      lastStatus: settings.lastRestoreTestStatus,
      lastError: settings.lastRestoreTestError,
      lastBackup: settings.lastRestoreTestBackup
    },
    latestBackup
  });
};

exports.triggerRestoreTest = async (req, res) => {
  try {
    const filename = req.body?.filename || null;
    const sampleRows = req.body?.sampleRows;

    const result = await runRestoreValidation({
      filename,
      sampleRows
    });

    const settings = loadSettings();
    saveSettings({
      ...settings,
      lastRestoreTest: new Date().toISOString(),
      lastRestoreTestStatus: 'SUCCESS',
      lastRestoreTestError: null,
      lastRestoreTestBackup: result.filename
    });

    res.json({
      message: 'Test de restauration termine avec succes',
      result
    });
  } catch (error) {
    const settings = loadSettings();
    saveSettings({
      ...settings,
      lastRestoreTest: new Date().toISOString(),
      lastRestoreTestStatus: 'FAILED',
      lastRestoreTestError: error.message,
      lastRestoreTestBackup: null
    });

    res.status(500).json({
      message: 'Echec du test de restauration',
      detail: error.message
    });
  }
};
