// Point d'entrée serverless Vercel. Contrairement à src/server.js, PAS
// d'app.listen() (Vercel gère l'écoute HTTP lui-même) ni de setInterval
// (aucun process long-vivant entre deux invocations — voir
// routes/internal.routes.js + Vercel Cron pour le nettoyage périodique).
const app = require('../src/app');
const { ensureSecuritySchema } = require('../src/lib/securitySchema');
const logger = require('../src/lib/logger');

// Le module Node reste en cache tant que l'instance de fonction est
// "chaude" (invocations suivantes réutilisent ce même process) : on ne
// veut lancer les CREATE TABLE IF NOT EXISTS qu'une fois par instance,
// pas à chaque requête. Une promesse mémoïsée au niveau module fait
// exactement ça.
let schemaReadyPromise = null;
const ensureReady = () => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSecuritySchema().catch((error) => {
      logger.error('Erreur ensureSecuritySchema (cold start Vercel):', { message: error.message });
      schemaReadyPromise = null; // retente au prochain appel plutôt que de rester bloqué en échec
      throw error;
    });
  }
  return schemaReadyPromise;
};

module.exports = async (req, res) => {
  try {
    await ensureReady();
  } catch (error) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Service indisponible (initialisation DB)', detail: error.message }));
    return;
  }
  app(req, res);
};
