-- Migration: data reliability hardening
-- Safe to run multiple times

-- ============================================
-- 1) Supporting indexes for validation-heavy flows
-- ============================================
CREATE INDEX IF NOT EXISTS idx_eleves_classe_annee ON eleves(classe_id, annee_scolaire);
CREATE INDEX IF NOT EXISTS idx_notes_classe_eleve_annee ON notes(classe_id, eleve_id, annee_scolaire);
CREATE INDEX IF NOT EXISTS idx_absences_classe_eleve_annee ON absences(classe_id, eleve_id, annee_scolaire);
CREATE INDEX IF NOT EXISTS idx_paiements_eleve_annee_statut ON paiements(eleve_id, annee_scolaire, statut);

-- ============================================
-- 2) Soft email quality constraints (NOT VALID)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_users_email_format'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_email_format
      CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_enseignants_email_format'
      AND conrelid = 'enseignants'::regclass
  ) THEN
    ALTER TABLE enseignants
      ADD CONSTRAINT chk_enseignants_email_format
      CHECK (
        email IS NULL OR email = '' OR
        email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_eleves_tuteur_email_format'
      AND conrelid = 'eleves'::regclass
  ) THEN
    ALTER TABLE eleves
      ADD CONSTRAINT chk_eleves_tuteur_email_format
      CHECK (
        tuteur_email IS NULL OR tuteur_email = '' OR
        tuteur_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      ) NOT VALID;
  END IF;
END $$;

-- ============================================
-- 3) Contact normalization triggers
-- ============================================
CREATE OR REPLACE FUNCTION normalize_users_contact()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := LOWER(BTRIM(NEW.email));
  NEW.telephone := NULLIF(BTRIM(COALESCE(NEW.telephone, '')), '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_enseignants_contact()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := NULLIF(LOWER(BTRIM(COALESCE(NEW.email, ''))), '');
  NEW.telephone := BTRIM(COALESCE(NEW.telephone, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_eleves_tuteur_contact()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tuteur_email := NULLIF(LOWER(BTRIM(COALESCE(NEW.tuteur_email, ''))), '');
  NEW.tuteur_telephone := BTRIM(COALESCE(NEW.tuteur_telephone, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_normalize_users_contact'
      AND tgrelid = 'users'::regclass
  ) THEN
    CREATE TRIGGER trg_normalize_users_contact
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION normalize_users_contact();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_normalize_enseignants_contact'
      AND tgrelid = 'enseignants'::regclass
  ) THEN
    CREATE TRIGGER trg_normalize_enseignants_contact
      BEFORE INSERT OR UPDATE ON enseignants
      FOR EACH ROW
      EXECUTE FUNCTION normalize_enseignants_contact();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_normalize_eleves_tuteur_contact'
      AND tgrelid = 'eleves'::regclass
  ) THEN
    CREATE TRIGGER trg_normalize_eleves_tuteur_contact
      BEFORE INSERT OR UPDATE ON eleves
      FOR EACH ROW
      EXECUTE FUNCTION normalize_eleves_tuteur_contact();
  END IF;
END $$;

-- ============================================
-- 4) School-year reference existence checks
-- ============================================
CREATE OR REPLACE FUNCTION ensure_school_year_exists()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.annee_scolaire IS NULL OR BTRIM(NEW.annee_scolaire) = '' THEN
    RAISE EXCEPTION 'annee_scolaire est obligatoire';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM annees_scolaires a WHERE a.annee = NEW.annee_scolaire
  ) THEN
    RAISE EXCEPTION 'Annee scolaire inconnue: %', NEW.annee_scolaire;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_classes_school_year_exists'
      AND tgrelid = 'classes'::regclass
  ) THEN
    CREATE TRIGGER trg_classes_school_year_exists
      BEFORE INSERT OR UPDATE ON classes
      FOR EACH ROW
      EXECUTE FUNCTION ensure_school_year_exists();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_eleves_school_year_exists'
      AND tgrelid = 'eleves'::regclass
  ) THEN
    CREATE TRIGGER trg_eleves_school_year_exists
      BEFORE INSERT OR UPDATE ON eleves
      FOR EACH ROW
      EXECUTE FUNCTION ensure_school_year_exists();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_notes_school_year_exists'
      AND tgrelid = 'notes'::regclass
  ) THEN
    CREATE TRIGGER trg_notes_school_year_exists
      BEFORE INSERT OR UPDATE ON notes
      FOR EACH ROW
      EXECUTE FUNCTION ensure_school_year_exists();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_absences_school_year_exists'
      AND tgrelid = 'absences'::regclass
  ) THEN
    CREATE TRIGGER trg_absences_school_year_exists
      BEFORE INSERT OR UPDATE ON absences
      FOR EACH ROW
      EXECUTE FUNCTION ensure_school_year_exists();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_paiements_school_year_exists'
      AND tgrelid = 'paiements'::regclass
  ) THEN
    CREATE TRIGGER trg_paiements_school_year_exists
      BEFORE INSERT OR UPDATE ON paiements
      FOR EACH ROW
      EXECUTE FUNCTION ensure_school_year_exists();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_classe_matieres_school_year_exists'
      AND tgrelid = 'classe_matieres'::regclass
  ) THEN
    CREATE TRIGGER trg_classe_matieres_school_year_exists
      BEFORE INSERT OR UPDATE ON classe_matieres
      FOR EACH ROW
      EXECUTE FUNCTION ensure_school_year_exists();
  END IF;
END $$;

-- ============================================
-- 5) Cross-table consistency checks
-- ============================================
CREATE OR REPLACE FUNCTION enforce_eleves_classe_annee_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_classe_annee VARCHAR(20);
BEGIN
  IF NEW.classe_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.annee_scolaire INTO v_classe_annee
  FROM classes c
  WHERE c.id = NEW.classe_id;

  IF v_classe_annee IS NULL THEN
    RAISE EXCEPTION 'Classe introuvable pour eleve %', NEW.id;
  END IF;

  IF NEW.annee_scolaire <> v_classe_annee THEN
    RAISE EXCEPTION
      'Incoherence annee_scolaire eleve/classe (% vs %)',
      NEW.annee_scolaire, v_classe_annee;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_classe_matieres_annee_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_classe_annee VARCHAR(20);
BEGIN
  SELECT c.annee_scolaire INTO v_classe_annee
  FROM classes c
  WHERE c.id = NEW.classe_id;

  IF v_classe_annee IS NULL THEN
    RAISE EXCEPTION 'Classe introuvable pour classe_matiere';
  END IF;

  IF NEW.annee_scolaire <> v_classe_annee THEN
    RAISE EXCEPTION
      'Incoherence annee_scolaire classe_matiere/classe (% vs %)',
      NEW.annee_scolaire, v_classe_annee;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_notes_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_eleve_classe_id UUID;
  v_eleve_annee VARCHAR(20);
  v_classe_annee VARCHAR(20);
BEGIN
  SELECT e.classe_id, e.annee_scolaire INTO v_eleve_classe_id, v_eleve_annee
  FROM eleves e
  WHERE e.id = NEW.eleve_id;

  IF v_eleve_annee IS NULL THEN
    RAISE EXCEPTION 'Eleve introuvable pour note';
  END IF;

  SELECT c.annee_scolaire INTO v_classe_annee
  FROM classes c
  WHERE c.id = NEW.classe_id;

  IF NEW.classe_id IS NOT NULL
     AND v_eleve_classe_id IS NOT NULL
     AND NEW.classe_id <> v_eleve_classe_id THEN
    RAISE EXCEPTION
      'Incoherence classe note/eleve (% vs %)',
      NEW.classe_id, v_eleve_classe_id;
  END IF;

  IF NEW.annee_scolaire <> v_eleve_annee THEN
    RAISE EXCEPTION
      'Incoherence annee note/eleve (% vs %)',
      NEW.annee_scolaire, v_eleve_annee;
  END IF;

  IF v_classe_annee IS NOT NULL AND NEW.annee_scolaire <> v_classe_annee THEN
    RAISE EXCEPTION
      'Incoherence annee note/classe (% vs %)',
      NEW.annee_scolaire, v_classe_annee;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_absences_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_eleve_classe_id UUID;
  v_eleve_annee VARCHAR(20);
  v_classe_annee VARCHAR(20);
BEGIN
  SELECT e.classe_id, e.annee_scolaire INTO v_eleve_classe_id, v_eleve_annee
  FROM eleves e
  WHERE e.id = NEW.eleve_id;

  IF v_eleve_annee IS NULL THEN
    RAISE EXCEPTION 'Eleve introuvable pour absence';
  END IF;

  SELECT c.annee_scolaire INTO v_classe_annee
  FROM classes c
  WHERE c.id = NEW.classe_id;

  IF NEW.classe_id IS NOT NULL
     AND v_eleve_classe_id IS NOT NULL
     AND NEW.classe_id <> v_eleve_classe_id THEN
    RAISE EXCEPTION
      'Incoherence classe absence/eleve (% vs %)',
      NEW.classe_id, v_eleve_classe_id;
  END IF;

  IF NEW.annee_scolaire <> v_eleve_annee THEN
    RAISE EXCEPTION
      'Incoherence annee absence/eleve (% vs %)',
      NEW.annee_scolaire, v_eleve_annee;
  END IF;

  IF v_classe_annee IS NOT NULL AND NEW.annee_scolaire <> v_classe_annee THEN
    RAISE EXCEPTION
      'Incoherence annee absence/classe (% vs %)',
      NEW.annee_scolaire, v_classe_annee;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_eleves_classe_annee_consistency'
      AND tgrelid = 'eleves'::regclass
  ) THEN
    CREATE TRIGGER trg_eleves_classe_annee_consistency
      BEFORE INSERT OR UPDATE ON eleves
      FOR EACH ROW
      EXECUTE FUNCTION enforce_eleves_classe_annee_consistency();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_classe_matieres_annee_consistency'
      AND tgrelid = 'classe_matieres'::regclass
  ) THEN
    CREATE TRIGGER trg_classe_matieres_annee_consistency
      BEFORE INSERT OR UPDATE ON classe_matieres
      FOR EACH ROW
      EXECUTE FUNCTION enforce_classe_matieres_annee_consistency();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_notes_consistency'
      AND tgrelid = 'notes'::regclass
  ) THEN
    CREATE TRIGGER trg_notes_consistency
      BEFORE INSERT OR UPDATE ON notes
      FOR EACH ROW
      EXECUTE FUNCTION enforce_notes_consistency();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_absences_consistency'
      AND tgrelid = 'absences'::regclass
  ) THEN
    CREATE TRIGGER trg_absences_consistency
      BEFORE INSERT OR UPDATE ON absences
      FOR EACH ROW
      EXECUTE FUNCTION enforce_absences_consistency();
  END IF;
END $$;
