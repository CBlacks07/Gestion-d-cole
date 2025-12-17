const { Pool } = require('pg');

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Options supplémentaires pour la production
  max: 20, // Nombre maximum de clients dans le pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Gestion des erreurs de connexion
pool.on('error', (err) => {
  console.error('Erreur inattendue sur le client PostgreSQL', err);
  process.exit(-1);
});

// Helper pour exécuter des requêtes
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('Requête exécutée', { text, duration, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    console.error('Erreur lors de l'exécution de la requête:', error);
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
    console.error('Un client n\'a pas été libéré dans les 5 secondes!');
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
    console.log('✅ Connexion PostgreSQL réussie:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion PostgreSQL:', error.message);
    return false;
  }
};

// Fermer proprement le pool
const closePool = async () => {
  await pool.end();
  console.log('Pool PostgreSQL fermé');
};

module.exports = {
  query,
  getClient,
  pool,
  testConnection,
  closePool
};
