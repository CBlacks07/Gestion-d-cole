-- Migration: Ajout de la table classe_matieres et années scolaires
-- Date: 2025-12-17

-- ============================================
-- 1. TABLE ANNEES SCOLAIRES
-- ============================================
CREATE TABLE IF NOT EXISTS annees_scolaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annee VARCHAR(20) NOT NULL UNIQUE, -- Ex: 2024-2025
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_annees_active ON annees_scolaires(active);

-- ============================================
-- 2. TABLE CLASSE_MATIERES (Liaison classe-matière)
-- ============================================
CREATE TABLE IF NOT EXISTS classe_matieres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
    coefficient INTEGER DEFAULT 1,
    enseignant_id UUID REFERENCES enseignants(id) ON DELETE SET NULL,
    annee_scolaire VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(classe_id, matiere_id, annee_scolaire)
);

CREATE INDEX idx_classe_mat_classe ON classe_matieres(classe_id);
CREATE INDEX idx_classe_mat_matiere ON classe_matieres(matiere_id);
CREATE INDEX idx_classe_mat_annee ON classe_matieres(annee_scolaire);

-- ============================================
-- 3. INSERTION DE L'ANNÉE SCOLAIRE ACTIVE
-- ============================================
INSERT INTO annees_scolaires (annee, date_debut, date_fin, active)
VALUES
    ('2024-2025', '2024-09-01', '2025-06-30', true),
    ('2025-2026', '2025-09-01', '2026-06-30', false)
ON CONFLICT (annee) DO NOTHING;

-- ============================================
-- 4. INSERTION DE MATIÈRES PAR DÉFAUT
-- ============================================
INSERT INTO matieres (nom, code, description, coefficient, niveaux, cycles, couleur)
VALUES
    -- Matières Primaire
    ('Français', 'FRA', 'Langue française', 3, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#3B82F6'),
    ('Mathématiques', 'MATH', 'Mathématiques', 3, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#10B981'),
    ('Sciences', 'SCI', 'Sciences et Technologie', 2, ARRAY['CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#8B5CF6'),
    ('Histoire-Géographie', 'HG', 'Histoire et Géographie', 2, ARRAY['CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#F59E0B'),
    ('Éducation Civique', 'EC', 'Éducation civique et morale', 1, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#EF4444'),
    ('Dessin', 'DESSIN', 'Arts plastiques', 1, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#EC4899'),
    ('EPS', 'EPS', 'Éducation physique et sportive', 1, ARRAY['CP1','CP2','CE1','CE2','CM1','CM2']::niveau_enum[], ARRAY['PRIMAIRE']::cycle_enum[], '#06B6D4'),

    -- Matières Collège
    ('Français', 'FRA_COL', 'Langue française', 4, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#3B82F6'),
    ('Mathématiques', 'MATH_COL', 'Mathématiques', 4, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#10B981'),
    ('Anglais', 'ANG_COL', 'Langue anglaise', 3, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#F59E0B'),
    ('Physique-Chimie', 'PC_COL', 'Physique et Chimie', 3, ARRAY['QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#8B5CF6'),
    ('SVT', 'SVT_COL', 'Sciences de la Vie et de la Terre', 3, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#14B8A6'),
    ('Histoire-Géographie', 'HG_COL', 'Histoire et Géographie', 3, ARRAY['SIXIEME','CINQUIEME','QUATRIEME','TROISIEME']::niveau_enum[], ARRAY['COLLEGE']::cycle_enum[], '#F59E0B'),

    -- Matières Lycée
    ('Français', 'FRA_LYC', 'Langue française', 5, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#3B82F6'),
    ('Mathématiques', 'MATH_LYC', 'Mathématiques', 5, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#10B981'),
    ('Anglais', 'ANG_LYC', 'Langue anglaise', 3, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#F59E0B'),
    ('Physique-Chimie', 'PC_LYC', 'Physique et Chimie', 4, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#8B5CF6'),
    ('SVT', 'SVT_LYC', 'Sciences de la Vie et de la Terre', 4, ARRAY['SECONDE','PREMIERE','TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#14B8A6'),
    ('Philosophie', 'PHILO', 'Philosophie', 4, ARRAY['TERMINALE']::niveau_enum[], ARRAY['LYCEE']::cycle_enum[], '#6366F1')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE classe_matieres IS 'Table de liaison entre classes et matières avec coefficient spécifique';
COMMENT ON TABLE annees_scolaires IS 'Gestion des années scolaires';
