const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV !== 'production';

// Sur Vercel (et toute plateforme serverless équivalente), le système de
// fichiers est en lecture seule hors /tmp (éphémère, effacé entre chaque
// invocation) : écrire des logs sur disque n'a aucun sens et
// `fs.mkdirSync` y échouerait au démarrage (EROFS), plantant la fonction.
// Vercel capture déjà stdout/stderr dans ses propres logs — on se limite
// donc à la console dans ce contexte.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Créer le répertoire de logs si nécessaire (hors serverless uniquement)
const logDir = process.env.LOG_DIR || path.join(__dirname, '../../../logs');
if (!isServerless && !fs.existsSync(logDir)) {
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
    // Fichiers locaux (error.log / combined.log) : uniquement hors
    // serverless, où le disque est persistant (Docker/VM classique).
    ...(!isServerless
      ? [
          new transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
            tailable: true,
          }),
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
