const User = require('../models/User');
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

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Cet utilisateur existe déjà' });
    }

    const user = await User.create({
      nom,
      prenom,
      email,
      motDePasse,
      role,
      telephone
    });

    res.status(201).json({
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Connexion utilisateur
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const isMatch = await user.comparePassword(motDePasse);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    if (!user.actif) {
      return res.status(401).json({ message: 'Compte désactivé' });
    }

    res.json({
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir le profil utilisateur
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-motDePasse');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
