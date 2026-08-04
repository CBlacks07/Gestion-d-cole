module.exports = {
  apps: [
    {
      name: 'gestion-ecole',
      script: 'src/server.js',
      cwd: '/var/www/ecole/backend',

      // Redémarrage automatique si crash
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      // Logs
      out_file: '/var/log/ecole/app-out.log',
      error_file: '/var/log/ecole/app-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // Variables d'environnement
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
  ],
};
