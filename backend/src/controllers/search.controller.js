const { query } = require('../lib/db');
const logger = require('../lib/logger');

const normalizeRole = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

exports.globalSearch = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ eleves: [], classes: [], enseignants: [] });
  }

  const role = normalizeRole(req.user?.role);
  const enseignantId = req.user?.enseignant_id || null;
  const term = `%${q.trim()}%`;

  try {
    if (role === 'ENSEIGNANT') {
      if (!enseignantId) {
        return res.status(403).json({ message: 'Compte enseignant non lie a un profil enseignant' });
      }

      const classesResult = await query(
        `SELECT DISTINCT c.id, c.nom, c.cycle::text AS cycle, c.niveau::text AS niveau, c.annee_scolaire
         FROM classes c
         LEFT JOIN classe_matieres cm
           ON cm.classe_id = c.id
          AND cm.enseignant_id = $1
         WHERE (c.enseignant_principal_id = $1 OR cm.enseignant_id = $1)
           AND (LOWER(c.nom) LIKE LOWER($2) OR LOWER(c.cycle::text) LIKE LOWER($2) OR LOWER(c.niveau::text) LIKE LOWER($2))
         ORDER BY c.nom
         LIMIT 8`,
        [enseignantId, term]
      );

      return res.json({
        eleves: [],
        classes: classesResult.rows,
        enseignants: []
      });
    }

    const [elevesResult, classesResult, enseignantsResult] = await Promise.all([
      query(
        `SELECT e.id, e.nom, e.prenom, e.matricule, c.nom as classe_nom
         FROM eleves e
         LEFT JOIN classes c ON c.id = e.classe_id
         WHERE e.statut::text = 'ACTIF'
           AND (LOWER(e.nom) LIKE LOWER($1) OR LOWER(e.prenom) LIKE LOWER($1) OR LOWER(e.matricule) LIKE LOWER($1))
         ORDER BY e.nom, e.prenom
         LIMIT 5`,
        [term]
      ),
      query(
        `SELECT id, nom, cycle::text AS cycle, niveau::text AS niveau, annee_scolaire
         FROM classes
         WHERE LOWER(nom) LIKE LOWER($1) OR LOWER(cycle::text) LIKE LOWER($1) OR LOWER(niveau::text) LIKE LOWER($1)
         ORDER BY nom
         LIMIT 5`,
        [term]
      ),
      query(
        `SELECT id, nom, prenom, telephone, type_contrat::text AS type_contrat
         FROM enseignants
         WHERE statut::text = 'ACTIF'
           AND (LOWER(nom) LIKE LOWER($1) OR LOWER(prenom) LIKE LOWER($1))
         ORDER BY nom, prenom
         LIMIT 5`,
        [term]
      )
    ]);

    res.json({
      eleves: elevesResult.rows,
      classes: classesResult.rows,
      enseignants: enseignantsResult.rows
    });
  } catch (error) {
    logger.error('Erreur recherche globale:', error);
    res.status(500).json({ message: 'Erreur lors de la recherche' });
  }
};
