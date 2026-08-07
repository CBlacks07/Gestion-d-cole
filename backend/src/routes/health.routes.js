const express = require('express');
const { query } = require('../lib/db');

const router = express.Router();
const startedAt = Date.now();

router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    service: 'gestion-ecole-backend',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString()
  });
});

router.get('/ready', async (req, res) => {
  try {
    // Sonde d'infra, sans contexte école (pas de req.ecoleId) : se limite à
    // la connectivité DB. "1 année active" était un invariant mono-école,
    // qui n'a plus de sens en multi-école (chaque école a sa propre année
    // active) et ne peut de toute façon plus être vérifié ici, la table
    // annees_scolaires étant sous RLS forcée par école.
    await query('SELECT 1 AS ok');

    res.status(200).json({
      status: 'ready',
      checks: {
        database: 'ok'
      },
      warnings: [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      checks: {
        database: 'error'
      },
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
