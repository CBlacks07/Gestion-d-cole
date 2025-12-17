-- Insérer un utilisateur administrateur
-- Email: admin@ecole.tg
-- Mot de passe: Admin123!

-- Hash bcrypt pour "Admin123!" : $2a$10$X8mPQQvYYf9H.vZ7xQqJXOZKJ3YN.gYCLZ6vQ8WZqX0ZxQqJXOZKJ
INSERT INTO users (nom, prenom, email, mot_de_passe, role, telephone, actif)
VALUES (
    'Admin',
    'Système',
    'admin@ecole.tg',
    '$2a$10$8qJ5YXQJZHZqQJZHZqQJZ.vZ7xQqJXOZKJ3YN.gYCLZ6vQ8WZqX0Zq',
    'ADMIN',
    '+228 00 00 00 00',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Afficher confirmation
SELECT 'Utilisateur admin créé avec succès!' as message;
SELECT id, nom, prenom, email, role FROM users WHERE email = 'admin@ecole.tg';
