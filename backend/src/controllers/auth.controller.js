const { query } = require('../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Générer un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Inscription d'un nouvel utilisateur
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse, role, telephone } = req.body;

    // Vérifier si l'utilisateur existe
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Cet utilisateur existe déjà' });
    }

    // Hash du mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(motDePasse, salt);

    // Créer l'utilisateur
    const result = await query(
      `INSERT INTO users (nom, prenom, email, mot_de_passe, role, telephone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nom, prenom, email, role, telephone, actif, created_at`,
      [
        nom,
        prenom,
        email,
        hashedPassword,
        role ? role.toUpperCase() : 'SECRETAIRE',
        telephone
      ]
    );

    const user = result.rows[0];

    res.status(201).json({
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      token: generateToken(user.id)
    });
  } catch (error) {
    console.error('Erreur register:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Connexion utilisateur
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    // Rechercher l'utilisateur
    const result = await query(
      'SELECT id, nom, prenom, email, mot_de_passe, role, actif FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(motDePasse, user.mot_de_passe);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérifier si le compte est actif
    if (!user.actif) {
      return res.status(401).json({ message: 'Compte désactivé' });
    }

    res.json({
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      token: generateToken(user.id)
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir le profil utilisateur
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nom, prenom, email, role, telephone, actif, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur getMe:', error);
    res.status(500).json({ message: error.message });
  }
};
