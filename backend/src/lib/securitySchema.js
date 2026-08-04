const { query } = require('./db');

const ensureSecuritySchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      email VARCHAR(255) PRIMARY KEY,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      last_failed_at TIMESTAMP,
      locked_until TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      entity VARCHAR(100),
      entity_id VARCHAR(100),
      status VARCHAR(20) DEFAULT 'SUCCESS',
      details JSONB,
      ip_address VARCHAR(64),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Permet d'invalider les tokens émis avant un changement de mot de passe
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP`);

  await query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON login_attempts(locked_until)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
};

module.exports = {
  ensureSecuritySchema
};
