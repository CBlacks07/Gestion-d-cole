-- School management database schema (Togo)
-- PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. DROP EXISTING OBJECTS
-- ============================================
DROP TABLE IF EXISTS classe_matieres CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS paiements CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS enseignant_matieres CASCADE;
DROP TABLE IF EXISTS matieres CASCADE;
DROP TABLE IF EXISTS eleves CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS enseignants CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS annees_scolaires CASCADE;

DROP TYPE IF EXISTS role_enum CASCADE;
DROP TYPE IF EXISTS sexe_enum CASCADE;
DROP TYPE IF EXISTS statut_eleve_enum CASCADE;
DROP TYPE IF EXISTS statut_enseignant_enum CASCADE;
DROP TYPE IF EXISTS type_contrat_enum CASCADE;
DROP TYPE IF EXISTS cycle_enum CASCADE;
DROP TYPE IF EXISTS niveau_enum CASCADE;
DROP TYPE IF EXISTS type_evaluation_enum CASCADE;
DROP TYPE IF EXISTS periode_enum CASCADE;
DROP TYPE IF EXISTS periode_jour_enum CASCADE;
DROP TYPE IF EXISTS type_paiement_enum CASCADE;
DROP TYPE IF EXISTS mode_paiement_enum CASCADE;
DROP TYPE IF EXISTS statut_paiement_enum CASCADE;

-- ============================================
-- 2. ENUM TYPES
-- ============================================
CREATE TYPE role_enum AS ENUM ('ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'SECRETAIRE');
CREATE TYPE sexe_enum AS ENUM ('M', 'F');
CREATE TYPE statut_eleve_enum AS ENUM ('ACTIF', 'INACTIF', 'TRANSFERE', 'DIPLOME');
CREATE TYPE statut_enseignant_enum AS ENUM ('ACTIF', 'CONGE', 'SUSPENDU', 'DEMISSIONNE');
CREATE TYPE type_contrat_enum AS ENUM ('PERMANENT', 'VACATAIRE', 'CONTRACTUEL');
CREATE TYPE cycle_enum AS ENUM ('PRIMAIRE', 'COLLEGE', 'LYCEE');
CREATE TYPE niveau_enum AS ENUM (
  'CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2',
  'SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME',
  'SECONDE', 'PREMIERE', 'TERMINALE'
);
CREATE TYPE type_evaluation_enum AS ENUM ('DEVOIR', 'COMPOSITION', 'INTERROGATION', 'TP', 'EXAMEN');
CREATE TYPE periode_enum AS ENUM (
  'PREMIER_TRIMESTRE',
  'DEUXIEME_TRIMESTRE',
  'TROISIEME_TRIMESTRE',
  'PREMIER_SEMESTRE',
  'DEUXIEME_SEMESTRE'
);
CREATE TYPE periode_jour_enum AS ENUM ('MATIN', 'APRES_MIDI', 'TOUTE_JOURNEE');
CREATE TYPE type_paiement_enum AS ENUM ('INSCRIPTION', 'SCOLARITE', 'CANTINE', 'TRANSPORT', 'UNIFORME', 'AUTRES');
CREATE TYPE mode_paiement_enum AS ENUM ('ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY');
CREATE TYPE statut_paiement_enum AS ENUM ('VALIDE', 'EN_ATTENTE', 'ANNULE');

-- ============================================
-- 3. SCHOOL YEARS
-- ============================================
CREATE TABLE annees_scolaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee VARCHAR(20) NOT NULL UNIQUE,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_annee_format CHECK (annee ~ '^[0-9]{4}-[0-9]{4}$'),
  CONSTRAINT chk_annee_dates CHECK (date_fin > date_debut)
);

CREATE INDEX idx_annees_active ON annees_scolaires(active);
CREATE UNIQUE INDEX uq_annee_active_unique ON annees_scolaires(active) WHERE active = true;

-- ============================================
-- 4. USERS (AUTH)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(255) NOT NULL,
  prenom VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  role role_enum DEFAULT 'SECRETAIRE',
  telephone VARCHAR(50),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_users_email_lower ON users(LOWER(email));
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 5. LOGIN SECURITY
-- ============================================
CREATE TABLE login_attempts (
  email VARCHAR(255) PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  last_failed_at TIMESTAMP,
  locked_until TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_attempts_locked_until ON login_attempts(locked_until);

-- ============================================
-- 6. AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
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
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- 7. TEACHERS
-- ============================================
CREATE TABLE enseignants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule VARCHAR(50) UNIQUE NOT NULL,
  nom VARCHAR(255) NOT NULL,
  prenom VARCHAR(255) NOT NULL,
  date_naissance DATE NOT NULL,
  sexe sexe_enum NOT NULL,
  telephone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  adresse TEXT,
  photo VARCHAR(500),
  diplomes JSONB,
  date_recrutement DATE NOT NULL,
  statut statut_enseignant_enum DEFAULT 'ACTIF',
  type_contrat type_contrat_enum DEFAULT 'PERMANENT',
  salaire DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_salaire_positive CHECK (salaire IS NULL OR salaire >= 0)
);

CREATE INDEX idx_enseignants_matricule ON enseignants(matricule);
CREATE INDEX idx_enseignants_statut ON enseignants(statut);

-- ============================================
-- 8. CLASSES
-- ============================================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  niveau niveau_enum NOT NULL,
  cycle cycle_enum NOT NULL,
  section VARCHAR(50),
  annee_scolaire VARCHAR(20) NOT NULL,
  enseignant_principal_id UUID REFERENCES enseignants(id) ON DELETE SET NULL,
  effectif_max INTEGER DEFAULT 50,
  salle VARCHAR(50),
  montant_inscription DECIMAL(10, 2) DEFAULT 0,
  montant_mensuel DECIMAL(10, 2) DEFAULT 0,
  devise VARCHAR(10) DEFAULT 'XOF',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_classes_annee_format CHECK (annee_scolaire ~ '^[0-9]{4}-[0-9]{4}$'),
  CONSTRAINT chk_effectif_max_positive CHECK (effectif_max > 0),
  CONSTRAINT chk_montant_inscription_positive CHECK (montant_inscription >= 0),
  CONSTRAINT chk_montant_mensuel_positive CHECK (montant_mensuel >= 0)
);

CREATE INDEX idx_classes_cycle ON classes(cycle);
CREATE INDEX idx_classes_annee ON classes(annee_scolaire);
CREATE INDEX idx_classes_enseignant ON classes(enseignant_principal_id);

-- ============================================
-- 9. STUDENTS
-- ============================================
CREATE TABLE eleves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule VARCHAR(50) UNIQUE NOT NULL,
  nom VARCHAR(255) NOT NULL,
  prenom VARCHAR(255) NOT NULL,
  date_naissance DATE NOT NULL,
  lieu_naissance VARCHAR(255) NOT NULL,
  sexe sexe_enum NOT NULL,
  classe_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  photo VARCHAR(500),
  tuteur_nom VARCHAR(255) NOT NULL,
  tuteur_prenom VARCHAR(255) NOT NULL,
  tuteur_telephone VARCHAR(50) NOT NULL,
  tuteur_email VARCHAR(255),
  tuteur_profession VARCHAR(255),
  tuteur_adresse TEXT,
  groupe_sanguin VARCHAR(10),
  allergies TEXT[],
  maladies_chroniques TEXT[],
  statut statut_eleve_enum DEFAULT 'ACTIF',
  annee_scolaire VARCHAR(20) NOT NULL,
  date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_eleves_annee_format CHECK (annee_scolaire ~ '^[0-9]{4}-[0-9]{4}$')
);

CREATE INDEX idx_eleves_matricule ON eleves(matricule);
CREATE INDEX idx_eleves_classe ON eleves(classe_id);
CREATE INDEX idx_eleves_statut ON eleves(statut);
CREATE INDEX idx_eleves_annee ON eleves(annee_scolaire);

-- ============================================
-- 10. SUBJECTS
-- ============================================
CREATE TABLE matieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  coefficient INTEGER DEFAULT 1,
  niveaux niveau_enum[],
  cycles cycle_enum[],
  couleur VARCHAR(20) DEFAULT '#3B82F6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_matiere_coef_positive CHECK (coefficient > 0)
);

CREATE INDEX idx_matieres_code ON matieres(code);

-- ============================================
-- 11. TEACHER-SUBJECT LINK
-- ============================================
CREATE TABLE enseignant_matieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enseignant_id UUID REFERENCES enseignants(id) ON DELETE CASCADE,
  matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(enseignant_id, matiere_id)
);

CREATE INDEX idx_ens_mat_enseignant ON enseignant_matieres(enseignant_id);
CREATE INDEX idx_ens_mat_matiere ON enseignant_matieres(matiere_id);

-- ============================================
-- 12. CLASS-SUBJECT LINK
-- ============================================
CREATE TABLE classe_matieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
  coefficient INTEGER DEFAULT 1,
  enseignant_id UUID REFERENCES enseignants(id) ON DELETE SET NULL,
  annee_scolaire VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(classe_id, matiere_id, annee_scolaire),
  CONSTRAINT chk_classe_matieres_coef_positive CHECK (coefficient > 0),
  CONSTRAINT chk_classe_matieres_annee_format CHECK (annee_scolaire ~ '^[0-9]{4}-[0-9]{4}$')
);

CREATE INDEX idx_classe_mat_classe ON classe_matieres(classe_id);
CREATE INDEX idx_classe_mat_matiere ON classe_matieres(matiere_id);
CREATE INDEX idx_classe_mat_annee ON classe_matieres(annee_scolaire);

-- ============================================
-- 13. GRADES
-- ============================================
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID REFERENCES eleves(id) ON DELETE CASCADE,
  matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  enseignant_id UUID REFERENCES enseignants(id) ON DELETE SET NULL,
  type_evaluation type_evaluation_enum NOT NULL,
  periode periode_enum NOT NULL,
  annee_scolaire VARCHAR(20) NOT NULL,
  note DECIMAL(5, 2) NOT NULL,
  note_max DECIMAL(5, 2) DEFAULT 20,
  coefficient INTEGER DEFAULT 1,
  commentaire TEXT,
  date_evaluation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_notes_annee_format CHECK (annee_scolaire ~ '^[0-9]{4}-[0-9]{4}$'),
  CONSTRAINT chk_notes_value CHECK (note >= 0 AND note_max > 0 AND note <= note_max),
  CONSTRAINT chk_notes_coef_positive CHECK (coefficient > 0)
);

CREATE INDEX idx_notes_eleve ON notes(eleve_id);
CREATE INDEX idx_notes_classe ON notes(classe_id);
CREATE INDEX idx_notes_matiere ON notes(matiere_id);
CREATE INDEX idx_notes_periode ON notes(periode);
CREATE INDEX idx_notes_annee ON notes(annee_scolaire);
CREATE INDEX idx_notes_eleve_periode_annee ON notes(eleve_id, periode, annee_scolaire);

-- ============================================
-- 14. ABSENCES
-- ============================================
CREATE TABLE absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID REFERENCES eleves(id) ON DELETE CASCADE,
  classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  matiere_id UUID REFERENCES matieres(id) ON DELETE SET NULL,
  periode periode_jour_enum DEFAULT 'TOUTE_JOURNEE',
  justifiee BOOLEAN DEFAULT false,
  motif TEXT,
  justificatif VARCHAR(500),
  annee_scolaire VARCHAR(20) NOT NULL,
  enregistre_par_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_absences_annee_format CHECK (annee_scolaire ~ '^[0-9]{4}-[0-9]{4}$')
);

CREATE INDEX idx_absences_eleve ON absences(eleve_id);
CREATE INDEX idx_absences_classe ON absences(classe_id);
CREATE INDEX idx_absences_date ON absences(date);
CREATE INDEX idx_absences_annee ON absences(annee_scolaire);
CREATE INDEX idx_absences_eleve_annee ON absences(eleve_id, annee_scolaire);

-- ============================================
-- 15. PAYMENTS
-- ============================================
CREATE TABLE paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID REFERENCES eleves(id) ON DELETE CASCADE,
  type_paiement type_paiement_enum NOT NULL,
  montant DECIMAL(10, 2) NOT NULL,
  devise VARCHAR(10) DEFAULT 'XOF',
  date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  mois_concerne VARCHAR(50),
  annee_scolaire VARCHAR(20) NOT NULL,
  mode_paiement mode_paiement_enum DEFAULT 'ESPECES',
  numero_piece VARCHAR(100),
  statut statut_paiement_enum DEFAULT 'VALIDE',
  remarques TEXT,
  enregistre_par_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_paiements_annee_format CHECK (annee_scolaire ~ '^[0-9]{4}-[0-9]{4}$'),
  CONSTRAINT chk_paiements_montant_positive CHECK (montant > 0)
);

CREATE INDEX idx_paiements_eleve ON paiements(eleve_id);
CREATE INDEX idx_paiements_type ON paiements(type_paiement);
CREATE INDEX idx_paiements_annee ON paiements(annee_scolaire);
CREATE INDEX idx_paiements_statut ON paiements(statut);
CREATE INDEX idx_paiements_annee_statut ON paiements(annee_scolaire, statut);

-- ============================================
-- 16. UPDATED_AT AUTOMATION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_annees_scolaires_updated_at BEFORE UPDATE ON annees_scolaires FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_enseignants_updated_at BEFORE UPDATE ON enseignants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_eleves_updated_at BEFORE UPDATE ON eleves FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matieres_updated_at BEFORE UPDATE ON matieres FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_classe_matieres_updated_at BEFORE UPDATE ON classe_matieres FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_absences_updated_at BEFORE UPDATE ON absences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paiements_updated_at BEFORE UPDATE ON paiements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 17. SAFE DEFAULT SCHOOL YEAR (ONLY IF NONE ACTIVE)
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
WHERE NOT EXISTS (
  SELECT 1 FROM annees_scolaires WHERE active = true
);

COMMENT ON DATABASE "ECOLE" IS 'Base de donnees de gestion scolaire pour le Togo';
