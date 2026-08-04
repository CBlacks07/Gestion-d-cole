require('dotenv').config();
const { Client } = require('pg');

const addSemesterValues = async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD || '')
  });
  await client.connect();

  try {
    await client.query(`
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
    `);

    await client.query(`
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
    `);

    const labels = await client.query(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'periode_enum'
      ORDER BY e.enumsortorder
    `);

    console.log('periode_enum:', labels.rows.map((r) => r.enumlabel).join(', '));
  } finally {
    await client.end();
  }
};

addSemesterValues().catch((error) => {
  console.error('Erreur migration periode_enum:', error.message);
  process.exit(1);
});
