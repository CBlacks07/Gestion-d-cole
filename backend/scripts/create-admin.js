require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, closePool } = require('../src/lib/db');

async function createAdmin() {
  try {
    console.log('🔐 Création de l\'utilisateur administrateur...\n');

    const admin = {
      nom: 'Admin',
      prenom: 'Système',
      email: 'admin@ecole.tg',
      motDePasse: 'Admin123!',
      role: 'ADMIN',
      telephone: '+228 00 00 00 00'
    };

    // Vérifier si l'admin existe déjà
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [admin.email]
    );

    if (existing.rows.length > 0) {
      console.log('✅ L\'utilisateur admin existe déjà!');
      console.log(`📧 Email: ${admin.email}`);
      console.log(`🔑 Mot de passe: ${admin.motDePasse}\n`);
      await closePool();
      return;
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(admin.motDePasse, salt);

    // Créer l'admin
    const result = await query(
      `INSERT INTO users (nom, prenom, email, mot_de_passe, role, telephone, actif)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, nom, prenom, email, role, telephone`,
      [
        admin.nom,
        admin.prenom,
        admin.email,
        hashedPassword,
        admin.role,
        admin.telephone
      ]
    );

    const user = result.rows[0];

    console.log('✅ Utilisateur administrateur créé avec succès!\n');
    console.log('📋 Informations de connexion:');
    console.log('─────────────────────────────');
    console.log(`ID:        ${user.id}`);
    console.log(`Nom:       ${user.prenom} ${user.nom}`);
    console.log(`Email:     ${user.email}`);
    console.log(`Mot de passe: ${admin.motDePasse}`);
    console.log(`Rôle:      ${user.role}`);
    console.log(`Téléphone: ${user.telephone}`);
    console.log('─────────────────────────────\n');
    console.log('🌐 Connectez-vous sur: http://localhost:3000');
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Mot de passe: ${admin.motDePasse}\n`);

    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await closePool();
    process.exit(1);
  }
}

createAdmin();
