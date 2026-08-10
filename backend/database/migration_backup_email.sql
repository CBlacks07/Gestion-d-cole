-- Migration: sauvegarde automatique par email, par école
-- Remplace le besoin d'un disque persistant (node-cron + fichiers locaux,
-- incompatible Vercel) par un paramétrage en base + envoi par email,
-- déclenché par un Vercel Cron. Chaque école ADMIN/DIRECTEUR peut activer
-- et configurer sa propre sauvegarde, sans dépendre de SUPER_ADMIN.
-- Idempotent : peut être exécutée plusieurs fois sans erreur.

CREATE TABLE IF NOT EXISTS ecole_backup_settings (
  ecole_id      UUID PRIMARY KEY REFERENCES ecoles(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT false,
  frequency     VARCHAR(20) NOT NULL DEFAULT 'weekly',
  custom_email  TEXT,
  last_sent_at  TIMESTAMPTZ,
  last_status   VARCHAR(20),
  last_error    TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_backup_settings_frequency CHECK (frequency IN ('daily', 'weekly', 'monthly'))
);

-- Idempotent même si la table existait déjà sans cette colonne (première
-- version de cette migration).
ALTER TABLE ecole_backup_settings ADD COLUMN IF NOT EXISTS custom_email TEXT;

DROP TRIGGER IF EXISTS update_ecole_backup_settings_updated_at ON ecole_backup_settings;
CREATE TRIGGER update_ecole_backup_settings_updated_at BEFORE UPDATE ON ecole_backup_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Même politique d'isolation que les autres tables métier (voir
-- migration_multi_ecole.sql) : une école ne peut voir/modifier que sa
-- propre ligne de paramètres.
ALTER TABLE ecole_backup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecole_backup_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ecole_backup_settings;
CREATE POLICY tenant_isolation ON ecole_backup_settings USING (
  ecole_id = current_setting('app.ecole_id', true)::uuid
  OR current_setting('app.bypass_rls', true) = 'true'
);

COMMENT ON TABLE ecole_backup_settings IS 'Paramètres de sauvegarde automatique par email, un enregistrement par école. Le job planifié (Vercel Cron -> /internal/scheduled-backup-emails) lit cette table pour savoir qui est "dû" pour un envoi.';
COMMENT ON COLUMN ecole_backup_settings.custom_email IS 'Si renseigné, remplace entièrement les destinataires par défaut (ADMIN/DIRECTEUR actifs de l''école) — la sauvegarde part uniquement vers cette adresse.';
