-- Script SQL pour créer la base de données de gestion scolaire
-- Base de données : Ecole
-- PostgreSQL 14+

-- ============================================
-- 1. SUPPRESSION DES TABLES EXISTANTES (si besoin)
-- ============================================
DROP TABLE IF EXISTS paiements CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS enseignant_matieres CASCADE;
DROP TABLE IF EXISTS matieres CASCADE;
DROP TABLE IF EXISTS eleves CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS enseignants CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 2. CRÉATION DES TYPES ENUM
-- ============================================
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

CREATE TYPE role_enum AS ENUM ('ADMIN', 'DIRECTEUR', 'ENSEIGNANT', 'SECRETAIRE');
CREATE TYPE sexe_enum AS ENUM ('M', 'F');
CREATE TYPE statut_eleve_enum AS ENUM ('ACTIF', 'INACTIF', 'TRANSFERE', 'DIPLOME');
CREATE TYPE statut_enseignant_enum AS ENUM ('ACTIF', 'CONGE', 'SUSPENDU', 'DEMISSIONNE');
CREATE TYPE type_contrat_enum AS ENUM ('PERMANENT', 'VACATAIRE', 'CONTRACTUEL');
CREATE TYPE cycle_enum AS ENUM ('PRIMAIRE', 'COLLEGE', 'LYCEE');
CREATE TYPE niveau_enum AS ENUM ('CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', 'SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE');
CREATE TYPE type_evaluation_enum AS ENUM ('DEVOIR', 'COMPOSITION', 'INTERROGATION', 'TP', 'EXAMEN');
CREATE TYPE periode_enum AS ENUM ('PREMIER_TRIMESTRE', 'DEUXIEME_TRIMESTRE', 'TROISIEME_TRIMESTRE');
CREATE TYPE periode_jour_enum AS ENUM ('MATIN', 'APRES_MIDI', 'TOUTE_JOURNEE');
CREATE TYPE type_paiement_enum AS ENUM ('INSCRIPTION', 'SCOLARITE', 'CANTINE', 'TRANSPORT', 'UNIFORME', 'AUTRES');
CREATE TYPE mode_paiement_enum AS ENUM ('ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY');
CREATE TYPE statut_paiement_enum AS ENUM ('VALIDE', 'EN_ATTENTE', 'ANNULE');

-- ============================================
-- 3. TABLE USERS (Authentification)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    role role_enum DEFAULT 'SECRETAIRE',
    telephone VARCHAR(50),
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- 4. TABLE ENSEIGNANTS
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_enseignants_matricule ON enseignants(matricule);
CREATE INDEX idx_enseignants_statut ON enseignants(statut);

-- ============================================
-- 5. TABLE CLASSES
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_classes_cycle ON classes(cycle);
CREATE INDEX idx_classes_annee ON classes(annee_scolaire);
CREATE INDEX idx_classes_enseignant ON classes(enseignant_principal_id);

-- ============================================
-- 6. TABLE ELEVES
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

    -- Informations tuteur
    tuteur_nom VARCHAR(255) NOT NULL,
    tuteur_prenom VARCHAR(255) NOT NULL,
    tuteur_telephone VARCHAR(50) NOT NULL,
    tuteur_email VARCHAR(255),
    tuteur_profession VARCHAR(255),
    tuteur_adresse TEXT,

    -- Informations médicales
    groupe_sanguin VARCHAR(10),
    allergies TEXT[],
    maladies_chroniques TEXT[],

    statut statut_eleve_enum DEFAULT 'ACTIF',
    annee_scolaire VARCHAR(20) NOT NULL,
    date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eleves_matricule ON eleves(matricule);
CREATE INDEX idx_eleves_classe ON eleves(classe_id);
CREATE INDEX idx_eleves_statut ON eleves(statut);
CREATE INDEX idx_eleves_annee ON eleves(annee_scolaire);

-- ============================================
-- 7. TABLE MATIERES
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matieres_code ON matieres(code);

-- ============================================
-- 8. TABLE ENSEIGNANT_MATIERES (Liaison)
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
-- 9. TABLE NOTES
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notes_eleve ON notes(eleve_id);
CREATE INDEX idx_notes_classe ON notes(classe_id);
CREATE INDEX idx_notes_matiere ON notes(matiere_id);
CREATE INDEX idx_notes_periode ON notes(periode);
CREATE INDEX idx_notes_annee ON notes(annee_scolaire);

-- ============================================
-- 10. TABLE ABSENCES
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_absences_eleve ON absences(eleve_id);
CREATE INDEX idx_absences_classe ON absences(classe_id);
CREATE INDEX idx_absences_date ON absences(date);
CREATE INDEX idx_absences_annee ON absences(annee_scolaire);

-- ============================================
-- 11. TABLE PAIEMENTS
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_paiements_eleve ON paiements(eleve_id);
CREATE INDEX idx_paiements_type ON paiements(type_paiement);
CREATE INDEX idx_paiements_annee ON paiements(annee_scolaire);
CREATE INDEX idx_paiements_statut ON paiements(statut);

-- ============================================
-- 12. FONCTION POUR MISE À JOUR AUTOMATIQUE
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ajouter les triggers pour updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_enseignants_updated_at BEFORE UPDATE ON enseignants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_eleves_updated_at BEFORE UPDATE ON eleves FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matieres_updated_at BEFORE UPDATE ON matieres FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_absences_updated_at BEFORE UPDATE ON absences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_paiements_updated_at BEFORE UPDATE ON paiements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 13. DONNÉES DE TEST (Optionnel)
-- ============================================
-- Vous pouvez insérer des données de test ici

COMMENT ON DATABASE "Ecole" IS 'Base de données de gestion d''établissement scolaire pour le Togo';
