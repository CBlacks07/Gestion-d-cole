/**
 * Middleware d'erreur centralisé
 * Format uniforme: { success: false, error: string, code?: string }
 */

const logger = require('../lib/logger');
const isDev = process.env.NODE_ENV !== 'production';

// Codes d'erreur PostgreSQL fréquents → message lisible
const PG_ERROR_MESSAGES = {
  '23505': 'Une entrée avec ces données existe déjà (doublon)',
  '23503': 'Référence invalide : entité liée introuvable',
  '23502': 'Un champ obligatoire est manquant',
  '22P02': 'Format de données invalide',
  '42703': 'Colonne inconnue dans la requête',
};

const AppError = class extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
};

const errorHandler = (err, req, res, next) => {
  // Log en production
  if (!isDev && !err.isOperational) {
    logger.error(`${req.method} ${req.originalUrl}`, { message: err.message, stack: err.stack });
  } else if (isDev) {
    logger.error('[DEV ERROR]', err);
  }

  // Erreur CORS
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'Requête bloquée par la politique CORS',
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Token invalide' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Token expiré' });
  }

  // Erreur PostgreSQL
  if (err.code && PG_ERROR_MESSAGES[err.code]) {
    return res.status(400).json({
      success: false,
      error: PG_ERROR_MESSAGES[err.code],
      code: err.code,
    });
  }

  // Erreur opérationnelle (lancée volontairement)
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  // Erreur de validation (express-validator via next(err))
  if (err.type === 'validation') {
    return res.status(422).json({
      success: false,
      error: 'Données invalides',
      details: err.errors,
    });
  }

  // Erreur générique
  res.status(err.statusCode || 500).json({
    success: false,
    error: isDev ? err.message : 'Une erreur interne est survenue',
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = { errorHandler, AppError };
