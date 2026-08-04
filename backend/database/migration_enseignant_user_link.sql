-- Active: 1771950419956@@127.0.0.1@5432@ECOLE
-- Migration: lier un compte utilisateur (role ENSEIGNANT) à son profil enseignant
-- À exécuter une seule fois sur la base de données

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS enseignant_id UUID REFERENCES enseignants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_enseignant ON users(enseignant_id);
