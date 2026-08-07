const jwt = require('jsonwebtoken');
const { query } = require('../lib/db');

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Non autorisé, token manquant' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, nom, prenom, email, role, telephone, actif, enseignant_id, ecole_id, password_changed_at FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];

    // Invalider les tokens émis avant le dernier changement de mot de passe
    if (user.password_changed_at) {
      const changedAt = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
      if (decoded.iat < changedAt) {
        return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
      }
    }

    // SUPER_ADMIN n'est rattaché à aucune école (ecole_id NULL) ; tous les
    // autres rôles doivent appartenir à une école pour accéder aux données.
    if (!user.ecole_id && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Utilisateur non rattaché à une école' });
    }

    req.user = user;
    req.ecoleId = user.ecole_id;

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Convertir les rôles en majuscules pour correspondre aux enums Prisma
    const upperRoles = roles.map(r => r.toUpperCase());

    if (!upperRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Le rôle ${req.user.role} n'est pas autorisé à accéder à cette ressource`
      });
    }
    next();
  };
};
