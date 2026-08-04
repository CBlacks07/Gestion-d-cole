const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV !== 'production';

// Créer le répertoire de logs si nécessaire
const logDir = process.env.LOG_DIR || path.join(__dirname, '../../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors, json } = format;

// Format console (dev)
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    let out = `${timestamp} [${level}] ${message}`;
    if (stack) out += `\n${stack}`;
    const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return out + extras;
  })
);

// Format fichier (prod)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: isDev ? devFormat : prodFormat,
  transports: [
    new transports.Console(),
    // Fichier erreurs uniquement
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    }),
    // Fichier toutes les logs (hors dev)
    ...(!isDev
      ? [
          new transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 20 * 1024 * 1024, // 20 MB
            maxFiles: 10,
            tailable: true,
          }),
        ]
      : []),
  ],
});

// Flux Morgan compatible (stream.write)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;
