-- Migration: Ajout du champ frais_scolarite (montant annuel total) dans la table classes
-- Ce montant représente le total des frais de scolarité pour l'année scolaire complète.
-- Distinct de montant_mensuel (mensualité optionnelle) et montant_inscription (droits d'entrée).

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS montant_scolarite DECIMAL(10, 2) DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_montant_scolarite_positive'
      AND table_name = 'classes'
  ) THEN
    ALTER TABLE classes
      ADD CONSTRAINT chk_montant_scolarite_positive CHECK (montant_scolarite >= 0);
  END IF;
END $$;
