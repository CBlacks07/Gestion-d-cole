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
    await query('SELECT 1 AS ok');

    const activeYear = await query(
      'SELECT COUNT(*)::INT AS count FROM annees_scolaires WHERE active = true'
    );

    const activeYearCount = activeYear.rows[0]?.count || 0;
    const warnings = [];

    if (activeYearCount !== 1) {
      warnings.push(`Nombre d annees actives inattendu: ${activeYearCount}`);
    }

    res.status(200).json({
      status: warnings.length > 0 ? 'degraded' : 'ready',
      checks: {
        database: 'ok',
        activeSchoolYearCount: activeYearCount
      },
      warnings,
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
