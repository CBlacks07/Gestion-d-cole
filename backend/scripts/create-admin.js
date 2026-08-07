require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, closePool } = require('../src/lib/db');

async function createAdmin() {
  try {
    if (!process.env.ADMIN_PASSWORD) {
      throw new Error('ADMIN_PASSWORD est requis pour creer le compte administrateur');
    }

    console.log('Creation de l utilisateur administrateur...\n');

    const role = (process.env.ADMIN_ROLE || 'ADMIN').toUpperCase();

    const admin = {
      nom: process.env.ADMIN_NOM || 'Admin',
      prenom: process.env.ADMIN_PRENOM || 'Systeme',
      email: process.env.ADMIN_EMAIL || 'admin@ecole.tg',
      motDePasse: process.env.ADMIN_PASSWORD,
      role,
      telephone: process.env.ADMIN_TELEPHONE || '+228 00 00 00 00'
    };

    const existing = await query('SELECT id FROM users WHERE email = $1', [admin.email]);

    if (existing.rows.length > 0) {
      console.log('L utilisateur admin existe deja.');
      console.log(`Email: ${admin.email}\n`);
      await closePool();
      return;
    }

    // SUPER_ADMIN est un compte plateforme, sans ecole_id. Tout autre role
    // doit etre rattache a une ecole (obligatoire cote application, voir
    // middleware/auth.js) : par defaut, on utilise/cree l'ecole indiquee
    // par ADMIN_ECOLE_SLUG, ou la premiere ecole existante (typiquement
    // "ecole-par-defaut" creee par migration_multi_ecole.sql).
    let ecoleId = null;
    if (role !== 'SUPER_ADMIN') {
      const ecoleSlug = process.env.ADMIN_ECOLE_SLUG || null;
      const ecoleNom = process.env.ADMIN_ECOLE_NOM || 'École par défaut';

      let ecole;
      if (ecoleSlug) {
        const existingEcole = await query('SELECT id FROM ecoles WHERE slug = $1', [ecoleSlug]);
        ecole = existingEcole.rows[0];
        if (!ecole) {
          const created = await query(
            'INSERT INTO ecoles (nom, slug) VALUES ($1, $2) RETURNING id',
            [ecoleNom, ecoleSlug]
          );
          ecole = created.rows[0];
        }
      } else {
        const anyEcole = await query('SELECT id FROM ecoles ORDER BY created_at ASC LIMIT 1');
        ecole = anyEcole.rows[0];
        if (!ecole) {
          throw new Error(
            "Aucune ecole trouvee. Executez d'abord migration_multi_ecole.sql, ou fournissez ADMIN_ECOLE_SLUG pour en creer une."
          );
        }
      }
      ecoleId = ecole.id;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(admin.motDePasse, salt);

    const result = await query(
      `INSERT INTO users (nom, prenom, email, mot_de_passe, role, telephone, actif, ecole_id)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       RETURNING id, nom, prenom, email, role, telephone`,
      [admin.nom, admin.prenom, admin.email, hashedPassword, admin.role, admin.telephone, ecoleId]
    );

    const user = result.rows[0];

    console.log('Utilisateur administrateur cree avec succes.\n');
    console.log('Informations de connexion:');
    console.log('-----------------------------');
    console.log(`ID:        ${user.id}`);
    console.log(`Nom:       ${user.prenom} ${user.nom}`);
    console.log(`Email:     ${user.email}`);
    console.log(`Mot de passe: ${admin.motDePasse}`);
    console.log(`Role:      ${user.role}`);
    console.log(`Telephone: ${user.telephone}`);
    console.log('-----------------------------\n');
    console.log('Connectez-vous sur: http://localhost:3000');
    console.log(`Email: ${user.email}`);
    console.log(`Mot de passe: ${admin.motDePasse}\n`);

    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error.message);
    await closePool();
    process.exit(1);
  }
}

createAdmin();
