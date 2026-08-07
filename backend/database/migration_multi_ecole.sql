-- Migration: passage multi-école (SaaS)
-- Ajoute la table `ecoles` et une colonne `ecole_id` sur toutes les tables
-- métier, avec isolation renforcée par Row-Level Security (RLS).
-- Idempotent : peut être exécutée plusieurs fois sans erreur.
--
-- Décision retenue : l'email des utilisateurs (`users.email`) reste UNIQUE
-- GLOBALEMENT (pas par école). Raison : le MVP n'a pas de sélecteur d'école
-- ni de sous-domaine au login (formulaire email + mot de passe uniquement) ;
-- un email non-unique par école rendrait le login ambigu (impossible de
-- savoir à quelle école se connecter). Cette contrainte est réévaluable si
-- un sélecteur d'école / sous-domaine est ajouté plus tard.

-- ============================================
-- 1. TABLE ECOLES
-- ============================================
CREATE TABLE IF NOT EXISTS ecoles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  logo_url    TEXT,
  statut      VARCHAR(20) NOT NULL DEFAULT 'ACTIF',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ecoles_statut CHECK (statut IN ('ACTIF', 'SUSPENDU'))
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ecoles_updated_at ON ecoles;
CREATE TRIGGER update_ecoles_updated_at BEFORE UPDATE ON ecoles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. RÔLE SUPER_ADMIN (plateforme, hors école)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'SUPER_ADMIN'
      AND enumtypid = 'role_enum'::regtype
  ) THEN
    ALTER TYPE role_enum ADD VALUE 'SUPER_ADMIN';
  END IF;
END $$;

-- ============================================
-- 3. ECOLE DE MIGRATION (accueille les données existantes)
-- ============================================
INSERT INTO ecoles (id, nom, slug, statut)
SELECT '00000000-0000-0000-0000-000000000001', 'École par défaut', 'ecole-par-defaut', 'ACTIF'
WHERE NOT EXISTS (SELECT 1 FROM ecoles WHERE slug = 'ecole-par-defaut');

-- ============================================
-- 4. AJOUT DE ecole_id SUR LES TABLES MÉTIER
--    (nullable d'abord, backfill, puis NOT NULL)
-- ============================================
DO $$
DECLARE
  t TEXT;
  default_ecole UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'enseignants', 'classes', 'eleves', 'matieres',
    'enseignant_matieres', 'classe_matieres', 'notes', 'absences',
    'paiements', 'annees_scolaires', 'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS ecole_id UUID REFERENCES ecoles(id)', t);
    EXECUTE format('UPDATE %I SET ecole_id = %L WHERE ecole_id IS NULL', t, default_ecole);
  END LOOP;

  -- SUPER_ADMIN garde ecole_id nullable (utilisateur plateforme, pas rattaché
  -- à une école) ; toutes les autres tables métier passent en NOT NULL.
  FOREACH t IN ARRAY ARRAY[
    'enseignants', 'classes', 'eleves', 'matieres',
    'enseignant_matieres', 'classe_matieres', 'notes', 'absences',
    'paiements', 'annees_scolaires'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN ecole_id SET NOT NULL', t);
  END LOOP;
  -- audit_logs reste nullable (actions plateforme sans école, ex: création
  -- d'une école par un SUPER_ADMIN).
END $$;

CREATE INDEX IF NOT EXISTS idx_users_ecole            ON users(ecole_id);
CREATE INDEX IF NOT EXISTS idx_enseignants_ecole       ON enseignants(ecole_id);
CREATE INDEX IF NOT EXISTS idx_classes_ecole           ON classes(ecole_id);
CREATE INDEX IF NOT EXISTS idx_eleves_ecole            ON eleves(ecole_id);
CREATE INDEX IF NOT EXISTS idx_matieres_ecole          ON matieres(ecole_id);
CREATE INDEX IF NOT EXISTS idx_ens_mat_ecole           ON enseignant_matieres(ecole_id);
CREATE INDEX IF NOT EXISTS idx_classe_mat_ecole        ON classe_matieres(ecole_id);
CREATE INDEX IF NOT EXISTS idx_notes_ecole             ON notes(ecole_id);
CREATE INDEX IF NOT EXISTS idx_absences_ecole          ON absences(ecole_id);
CREATE INDEX IF NOT EXISTS idx_paiements_ecole         ON paiements(ecole_id);
CREATE INDEX IF NOT EXISTS idx_annees_ecole            ON annees_scolaires(ecole_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ecole        ON audit_logs(ecole_id);

-- ============================================
-- 5. CONTRAINTES D'UNICITÉ : globales → par école
--    (matricules, codes, années scolaires ne sont uniques QUE dans une école)
-- ============================================
ALTER TABLE enseignants DROP CONSTRAINT IF EXISTS enseignants_matricule_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_enseignants_ecole_matricule ON enseignants(ecole_id, matricule);

ALTER TABLE eleves DROP CONSTRAINT IF EXISTS eleves_matricule_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_eleves_ecole_matricule ON eleves(ecole_id, matricule);

ALTER TABLE matieres DROP CONSTRAINT IF EXISTS matieres_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_matieres_ecole_code ON matieres(ecole_id, code);

ALTER TABLE annees_scolaires DROP CONSTRAINT IF EXISTS annees_scolaires_annee_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_annees_ecole_annee ON annees_scolaires(ecole_id, annee);

-- Une seule année active PAR ÉCOLE (remplace l'ancien index global)
DROP INDEX IF EXISTS uq_annee_active_unique;
CREATE UNIQUE INDEX IF NOT EXISTS uq_annee_active_par_ecole ON annees_scolaires(ecole_id) WHERE active = true;

-- users.email reste unique GLOBALEMENT (voir note en tête de fichier) —
-- aucun changement sur uq_users_email_lower.

-- ============================================
-- 6. ROW-LEVEL SECURITY
--    Filet de sécurité indépendant du code applicatif : même si un
--    controller oublie le filtre ecole_id, la base refuse de renvoyer les
--    lignes d'une autre école.
--    L'application doit exécuter `SET LOCAL app.ecole_id = '<uuid>'` au
--    début de chaque transaction (voir queryScoped() dans backend/src/lib/db.js).
-- ============================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'enseignants', 'classes', 'eleves', 'matieres',
    'enseignant_matieres', 'classe_matieres', 'notes', 'absences',
    'paiements', 'annees_scolaires'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t); -- s'applique aussi au propriétaire de la table (le rôle applicatif)
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    -- Le "OR app.bypass_rls" est un échappatoire délibérée et auditable pour
    -- la sauvegarde planifiée multi-écoles (SUPER_ADMIN uniquement, voir
    -- backup.controller.js / queryBypassRls dans lib/db.js). Elle exige un
    -- SET LOCAL explicite par transaction — jamais un attribut de rôle
    -- (BYPASSRLS), qui désactiverait la RLS partout et pas seulement pour
    -- ce chemin de code précis.
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (
         ecole_id = current_setting(''app.ecole_id'', true)::uuid
         OR current_setting(''app.bypass_rls'', true) = ''true''
       )',
      t
    );
  END LOOP;
END $$;

-- `users` est délibérément EXCLU de la RLS forcée : le login doit pouvoir
-- chercher un utilisateur par email/id AVANT de connaître son ecole_id
-- (poule et l'œuf — on ne peut pas SET LOCAL app.ecole_id avant de savoir
-- à quelle école l'utilisateur appartient). Ces requêtes restent sûres par
-- construction : recherche par id (UUID, non énumérable) ou par email
-- (unique globalement, voir note en tête de fichier). Toute requête qui
-- liste plusieurs utilisateurs (ex: page Utilisateurs) doit filtrer
-- explicitement `WHERE ecole_id = $1` côté controller.
-- (idempotent même si une version antérieure de cette migration avait
-- activé la RLS forcée sur `users`)
ALTER TABLE users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;

-- audit_logs : RLS permissive (ecole_id nullable, on veut voir aussi les
-- actions plateforme sans ecole_id quand app.ecole_id n'est pas défini par
-- un SUPER_ADMIN) — pas de FORCE RLS ici pour l'instant, à revoir quand le
-- panel SUPER_ADMIN sera construit.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
  USING (ecole_id = current_setting('app.ecole_id', true)::uuid OR ecole_id IS NULL);

COMMENT ON COLUMN ecoles.slug IS 'Identifiant court de l''école, réservé pour un futur sous-domaine (non utilisé au MVP)';
