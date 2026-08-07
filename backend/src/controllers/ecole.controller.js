const bcrypt = require('bcryptjs');
const { query } = require('../lib/db');
const { logAuditEvent } = require('../lib/audit');
const logger = require('../lib/logger');
const {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  COOKIE_OPTS,
} = require('../lib/tokens');

const safeError = (error) =>
  process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : error.message;

const isStrongPassword = (pwd) => {
  if (!pwd || pwd.length < 8) return false;
  return /[A-Z]/.test(pwd) || /[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd);
};

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// @desc    Créer un nouvel établissement (self-service SaaS) + son premier
//          compte ADMIN. Route publique (pas de protect) : c'est le point
//          d'entrée pour qu'une nouvelle école rejoigne la plateforme.
// @route   POST /api/ecoles
exports.createEcole = async (req, res) => {
  try {
    const { ecoleNom, nom, prenom, email, motDePasse, telephone, codeInvitation } = req.body;
    let { ecoleSlug } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();

    // Signup fermé par défaut : SIGNUP_INVITE_CODE doit être configuré ET
    // correspondre exactement. Si la variable n'est pas définie, le signup
    // reste indisponible plutôt que de s'ouvrir par erreur de configuration
    // (fail closed, cohérent avec le reste des routes internes du projet).
    const expectedCode = process.env.SIGNUP_INVITE_CODE;
    if (!expectedCode || codeInvitation !== expectedCode) {
      return res.status(403).json({ message: "Code d'invitation invalide" });
    }

    if (!ecoleNom || !nom || !prenom || !normalizedEmail || !motDePasse) {
      return res.status(400).json({
        message: "Nom de l'établissement, nom, prénom, email et mot de passe sont requis",
      });
    }

    if (!isStrongPassword(motDePasse)) {
      return res.status(400).json({
        message: 'Le mot de passe doit contenir au moins 8 caractères avec au moins une majuscule, un chiffre ou un caractère spécial',
      });
    }

    ecoleSlug = slugify(ecoleSlug || ecoleNom);
    if (!ecoleSlug) {
      return res.status(400).json({ message: "Nom d'établissement invalide" });
    }

    const existingEmail = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const existingSlug = await query('SELECT id FROM ecoles WHERE slug = $1', [ecoleSlug]);
    if (existingSlug.rows.length > 0) {
      return res.status(400).json({
        message: `L'identifiant "${ecoleSlug}" est déjà pris, choisissez un autre nom d'établissement`,
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(motDePasse, salt);

    const ecoleResult = await query(
      `INSERT INTO ecoles (nom, slug) VALUES ($1, $2) RETURNING id, nom, slug`,
      [ecoleNom, ecoleSlug]
    );
    const ecole = ecoleResult.rows[0];

    const userResult = await query(
      `INSERT INTO users (nom, prenom, email, mot_de_passe, role, telephone, ecole_id)
       VALUES ($1, $2, $3, $4, 'ADMIN', $5, $6)
       RETURNING id, nom, prenom, email, role, telephone, ecole_id`,
      [nom, prenom, normalizedEmail, hashedPassword, telephone || null, ecole.id]
    );
    const user = userResult.rows[0];

    // Route publique (pas de `protect`) : req.ecoleId n'est pas encore
    // renseigné à ce stade. On le fixe explicitement pour que ce premier
    // événement d'audit soit rattaché à l'école qui vient d'être créée
    // (sinon logAuditEvent le tague ecole_id=NULL et il devient invisible
    // dans le journal d'audit de cette école).
    req.ecoleId = ecole.id;

    await logAuditEvent({
      req,
      userId: user.id,
      action: 'ECOLE_CREATE',
      entity: 'ECOLE',
      entityId: ecole.id,
      status: 'SUCCESS',
      details: { nom: ecole.nom, slug: ecole.slug, adminEmail: user.email },
    });

    const accessToken = generateAccessToken(user.id);
    const refreshTokenRaw = generateRefreshToken();
    await storeRefreshToken(user.id, refreshTokenRaw, req);
    res.cookie('refreshToken', refreshTokenRaw, COOKIE_OPTS);

    res.status(201).json({
      ecole,
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      token: accessToken,
    });
  } catch (error) {
    logger.error('Erreur création école:', error);
    res.status(500).json({ message: safeError(error) });
  }
};
