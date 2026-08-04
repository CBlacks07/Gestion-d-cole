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

const pool = new Pool({
  ...poolConfig,
  // Options supplémentaires
  max: 20, // Nombre maximum de clients dans le pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
  getClient,
  pool,
  testConnection,
  closePool
};
