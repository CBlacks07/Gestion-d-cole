-- Migration: school years + class-subject mapping hardening
-- Safe to run multiple times

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. SCHOOL YEARS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS annees_scolaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee VARCHAR(20) NOT NULL UNIQUE,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_annees_scolaires_dates'
      AND conrelid = 'annees_scolaires'::regclass
  ) THEN
    ALTER TABLE annees_scolaires
      ADD CONSTRAINT chk_annees_scolaires_dates
      CHECK (date_fin > date_debut) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_annees_active ON annees_scolaires(active);

-- Keep only one active year before enforcing the unique partial index.
WITH ranked_active AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY date_debut DESC, created_at DESC, id DESC) AS rn
  FROM annees_scolaires
  WHERE active = true
)
UPDATE annees_scolaires a
SET active = false, updated_at = NOW()
WHERE a.id IN (SELECT id FROM ranked_active WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_annee_active_unique
  ON annees_scolaires(active)
  WHERE active = true;

-- ============================================
-- 2. CLASSE_MATIERES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS classe_matieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
  coefficient INTEGER DEFAULT 1,
  enseignant_id UUID REFERENCES enseignants(id) ON DELETE SET NULL,
  annee_scolaire VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(classe_id, matiere_id, annee_scolaire)
);

ALTER TABLE classe_matieres
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_classe_matieres_coef_positive'
      AND conrelid = 'classe_matieres'::regclass
  ) THEN
    ALTER TABLE classe_matieres
      ADD CONSTRAINT chk_classe_matieres_coef_positive
      CHECK (coefficient > 0) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_classe_mat_classe ON classe_matieres(classe_id);
CREATE INDEX IF NOT EXISTS idx_classe_mat_matiere ON classe_matieres(matiere_id);
CREATE INDEX IF NOT EXISTS idx_classe_mat_annee ON classe_matieres(annee_scolaire);

-- ============================================
-- 3. UPDATED_AT TRIGGERS (idempotent)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_annees_scolaires_updated_at'
  ) THEN
    CREATE TRIGGER update_annees_scolaires_updated_at
      BEFORE UPDATE ON annees_scolaires
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_classe_matieres_updated_at'
  ) THEN
    CREATE TRIGGER update_classe_matieres_updated_at
      BEFORE UPDATE ON classe_matieres
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 4. DEFAULT ACTIVE SCHOOL YEAR IF NONE
-- ============================================
WITH school_year AS (
  SELECT
    CASE
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 9 THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT
      ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INT - 1
    END AS start_year
)
INSERT INTO annees_scolaires (annee, date_debut, date_fin, active)
SELECT
  start_year::TEXT || '-' || (start_year + 1)::TEXT,
  make_date(start_year, 9, 1),
  make_date(start_year + 1, 6, 30),
  true
FROM school_year
WHERE NOT EXISTS (SELECT 1 FROM annees_scolaires WHERE active = true);

-- ============================================
-- 5. DEFAULT SUBJECTS
-- ============================================
INSERT INTO matieres (nom, code, description, coefficient, niveaux, cycles, couleur)
VALUES
  ('Francais', 'FRA', 'Langue francaise', 3, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#3B82F6'),
  ('Mathematiques', 'MATH', 'Mathematiques', 3, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#10B981'),
  ('Sciences', 'SCI', 'Sciences et Technologie', 2, ARRAY['CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#8B5CF6'),
  ('Histoire-Geographie', 'HG', 'Histoire et Geographie', 2, ARRAY['CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#F59E0B'),
  ('Education Civique', 'EC', 'Education civique et morale', 1, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#EF4444'),
  ('Dessin', 'DESSIN', 'Arts plastiques', 1, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#EC4899'),
  ('EPS', 'EPS', 'Education physique et sportive', 1, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#06B6D4'),
  ('Francais', 'FRA_COL', 'Langue francaise', 4, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#3B82F6'),
  ('Mathematiques', 'MATH_COL', 'Mathematiques', 4, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#10B981'),
  ('Anglais', 'ANG_COL', 'Langue anglaise', 3, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#F59E0B'),
  ('Physique-Chimie', 'PC_COL', 'Physique et Chimie', 3, ARRAY['QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#8B5CF6'),
  ('SVT', 'SVT_COL', 'Sciences de la Vie et de la Terre', 3, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#14B8A6'),
  ('Histoire-Geographie', 'HG_COL', 'Histoire et Geographie', 3, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#F59E0B'),
  ('Francais', 'FRA_LYC', 'Langue francaise', 5, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#3B82F6'),
  ('Mathematiques', 'MATH_LYC', 'Mathematiques', 5, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#10B981'),
  ('Anglais', 'ANG_LYC', 'Langue anglaise', 3, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#F59E0B'),
  ('Physique-Chimie', 'PC_LYC', 'Physique et Chimie', 4, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#8B5CF6'),
  ('SVT', 'SVT_LYC', 'Sciences de la Vie et de la Terre', 4, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#14B8A6'),
  ('Philosophie', 'PHILO', 'Philosophie', 4, ARRAY['TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#6366F1')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE classe_matieres IS 'Liaison classes et matieres avec coefficient et enseignant';
COMMENT ON TABLE annees_scolaires IS 'Gestion des annees scolaires';
