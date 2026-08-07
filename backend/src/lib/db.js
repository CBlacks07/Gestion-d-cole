const { Pool } = require('pg');
require('dotenv').config();
const logger = require('./logger');

// Configuration de la connexion PostgreSQL
// Utilise soit DATABASE_URL soit les variables individuelles
if (!process.env.DATABASE_URL) {
  const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingVars = requiredVars.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    throw new Error(
      `Variables d'environnement PostgreSQL manquantes: ${missingVars.join(', ')}`
    );
  }
}

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'Ecole',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

// En serverless (Vercel...), chaque instance de fonction porte son propre
// pool (réutilisé entre invocations "chaudes" de la même instance grâce au
// cache de modules Node, mais recréé à chaque cold start) — avec N
// instances concurrentes, un `max` élevé par pool peut vite épuiser les
// connexions disponibles côté Postgres. Neon recommande `max: 1` sur
// l'endpoint "pooled" (PgBouncer côté Neon fait déjà le multiplexage).
// Hors serverless (Docker/VM, un seul process long-vivant), la valeur
// classique reste adaptée. Toujours réglable via DB_POOL_MAX.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultPoolMax = isServerless ? 1 : 20;

// Neon (et les Postgres serverless en général) suspend le compute après
// inactivité : la première connexion après une pause peut prendre
// plusieurs secondes le temps qu'il redémarre. 2s (défaut historique)
// suffit pour un Postgres déjà chaud (Docker/VM) mais provoque des échecs
// intermittents contre un compute Neon suspendu — d'où un défaut plus
// généreux en serverless, réglable via DB_CONNECTION_TIMEOUT_MS.
const defaultConnectionTimeoutMs = isServerless ? 10000 : 2000;

const pool = new Pool({
  ...poolConfig,
  // Options supplémentaires
  max: parseInt(process.env.DB_POOL_MAX || String(defaultPoolMax), 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || String(defaultConnectionTimeoutMs), 10),
});

// Gestion des erreurs de connexion
pool.on('error', (err) => {
  logger.error('Erreur inattendue sur le client PostgreSQL', { message: err.message });
  process.exit(-1);
});

// Helper pour exécuter des requêtes
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      logger.debug('Requête exécutée', { text, duration, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    logger.error('Erreur lors de la requete:', { message: error.message, code: error.code });
    throw error;
  }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper multi-école : exécute une requête à l'intérieur d'une transaction
// avec `SET LOCAL app.ecole_id`, pour activer les policies RLS par école.
// À utiliser pour TOUTE requête touchant une table métier (eleves,
// enseignants, classes, notes, absences, paiements, matieres, annees...).
// Refuse d'exécuter si ecoleId est absent ou mal formé : on préfère une
// erreur explicite à une requête non isolée qui passerait silencieusement.
const queryScoped = async (ecoleId, text, params) => {
  if (!ecoleId || !UUID_RE.test(ecoleId)) {
    throw new Error('queryScoped: ecoleId manquant ou invalide — requête refusée');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // SET LOCAL n'accepte pas les paramètres liés ($1) : ecoleId est
    // validé ci-dessus comme un UUID strict avant interpolation.
    await client.query(`SET LOCAL app.ecole_id = '${ecoleId}'`);
    const res = await client.query(text, params);
    await client.query('COMMIT');
    return res;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Erreur lors de la requete scopée:', { message: error.message, code: error.code });
    throw error;
  } finally {
    client.release();
  }
};

// Échappatoire délibérée à la RLS multi-école : à utiliser UNIQUEMENT pour
// les opérations plateforme légitimement multi-écoles (sauvegarde planifiée
// SUPER_ADMIN). Contrairement à un rôle BYPASSRLS, l'échappatoire est
// explicite et limitée à la transaction courante — le reste de
// l'application reste protégé par la RLS même si ce helper est mal utilisé
// ailleurs par erreur (il faut l'appeler explicitement, pas une propriété
// globale du rôle DB).
const queryBypassRls = async (text, params) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.bypass_rls = 'true'`);
    const res = await client.query(text, params);
    await client.query('COMMIT');
    return res;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Erreur lors de la requete bypass RLS:', { message: error.message, code: error.code });
    throw error;
  } finally {
    client.release();
  }
};

// Helper pour obtenir un client du pool (pour les transactions)
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Timeout pour les transactions
  const timeout = setTimeout(() => {
    logger.warn('Un client PostgreSQL n\'a pas été libéré dans les 5 secondes');
  }, 5000);

  // Wrapper pour libérer automatiquement le client
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release();
  };

  return client;
};

// Test de connexion
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW()');
    logger.info('Connexion PostgreSQL réussie', { time: result.rows[0].now });
    return true;
  } catch (error) {
    logger.error('Erreur de connexion PostgreSQL', { message: error.message });
    return false;
  }
};

// Fermer proprement le pool
const closePool = async () => {
  await pool.end();
  logger.info('Pool PostgreSQL fermé');
};

module.exports = {
  query,
  queryScoped,
  queryBypassRls,
  getClient,
  pool,
  testConnection,
  closePool
};
