const { query } = require('../lib/db');
const bcrypt = require('bcryptjs');
const { logAuditEvent } = require('../lib/audit');
const logger = require('../lib/logger');

const safeError = (error) =>
  process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : error.message;

// @desc    Lister tous les utilisateurs
// @route   GET /api/users
exports.getUsers = async (req, res) => {
  try {
    // `users` n'est pas sous RLS (le login doit pouvoir chercher un
    // utilisateur avant de connaître son ecole_id) : le filtre par école
    // doit donc être explicite ici, voir migration_multi_ecole.sql.
    const result = await query(
      `SELECT id, nom, prenom, email, role, telephone, actif, enseignant_id, created_at
       FROM users
       WHERE ecole_id = $1
       ORDER BY created_at DESC`,
      [req.ecoleId]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Erreur getUsers:', error);
    res.status(500).json({ message: safeError(error) });
  }
};

// @desc    Mettre à jour un utilisateur
// @route   PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, telephone, role, actif, motDePasse, enseignantId } = req.body;

    // Seul un ADMIN peut changer le rôle
    if (role !== undefined && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Seul un ADMIN peut modifier les rôles' });
    }

    // Seul un ADMIN peut attribuer le rôle ADMIN
    if (role === 'ADMIN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Seul un ADMIN peut attribuer le rôle ADMIN' });
    }

    // Seul un ADMIN peut réinitialiser le mot de passe d'un autre utilisateur
    if (motDePasse !== undefined && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Seul un ADMIN peut réinitialiser le mot de passe d\'un utilisateur' });
    }

    const existing = await query('SELECT id, role, email FROM users WHERE id = $1 AND ecole_id = $2', [id, req.ecoleId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    const oldUser = existing.rows[0];

    // Construire la mise à jour dynamiquement
    const updates = [];
    const values = [];
    let idx = 1;
    const changes = {};

    if (nom !== undefined) { updates.push(`nom = $${idx++}`); values.push(nom); changes.nom = nom; }
    if (prenom !== undefined) { updates.push(`prenom = $${idx++}`); values.push(prenom); changes.prenom = prenom; }
    if (telephone !== undefined) { updates.push(`telephone = $${idx++}`); values.push(telephone); }
    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(role.toUpperCase());
      changes.roleChange = { from: oldUser.role, to: role.toUpperCase() };
    }
    if (actif !== undefined) {
      updates.push(`actif = $${idx++}`);
      values.push(actif);
      changes.actifChange = actif;
    }
    if (enseignantId !== undefined) { updates.push(`enseignant_id = $${idx++}`); values.push(enseignantId || null); }
    if (motDePasse) {
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(motDePasse, salt);
      updates.push(`mot_de_passe = $${idx++}`);
      updates.push(`password_changed_at = NOW()`);
      values.push(hash);
      changes.passwordReset = true;
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    }

    values.push(id, req.ecoleId);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${idx} AND ecole_id = $${idx + 1}
       RETURNING id, nom, prenom, email, role, telephone, actif, enseignant_id, created_at`,
      values
    );

    await logAuditEvent({
      req,
      userId: req.user.id,
      action: 'USER_UPDATED',
      entity: 'USER',
      entityId: id,
      status: 'SUCCESS',
      details: { targetEmail: oldUser.email, changes }
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Erreur updateUser:', error);
    res.status(500).json({ message: safeError(error) });
  }
};

// @desc    Supprimer un utilisateur
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const existing = await query('SELECT id, email, role FROM users WHERE id = $1 AND ecole_id = $2', [id, req.ecoleId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    await query('DELETE FROM users WHERE id = $1 AND ecole_id = $2', [id, req.ecoleId]);

    await logAuditEvent({
      req,
      userId: req.user.id,
      action: 'USER_DELETED',
      entity: 'USER',
      entityId: id,
      status: 'SUCCESS',
      details: { deletedEmail: existing.rows[0].email, deletedRole: existing.rows[0].role }
    });

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur deleteUser:', error);
    res.status(500).json({ message: safeError(error) });
  }
};
