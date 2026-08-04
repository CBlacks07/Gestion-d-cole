-- Migration: add semester periods for notes bulletins
-- Safe to run multiple times

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'periode_enum'
      AND e.enumlabel = 'PREMIER_SEMESTRE'
  ) THEN
    ALTER TYPE periode_enum ADD VALUE 'PREMIER_SEMESTRE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'periode_enum'
      AND e.enumlabel = 'DEUXIEME_SEMESTRE'
  ) THEN
    ALTER TYPE periode_enum ADD VALUE 'DEUXIEME_SEMESTRE';
  END IF;
END $$;
