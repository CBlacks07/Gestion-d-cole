// Données de départ créées automatiquement pour toute nouvelle école (self-
// service signup, voir ecole.controller.js#createEcole) : sans ça, une
// école qui vient de s'inscrire n'a ni année scolaire active ni matières,
// et /annees/active renvoie 404 en cascade dès le premier login (Notes,
// Rapports, Dashboard dépendent tous d'une année active).
// Reprend les mêmes valeurs par défaut que l'ancien seed global
// (schema.sql §17, migration_classe_matieres.sql §5), mais appliquées par
// école plutôt qu'une seule fois pour toute la base.
const { queryScoped } = require('./db');
const logger = require('./logger');

const DEFAULT_MATIERES = [
  ['Francais', 'FRA', 'Langue francaise', 3, ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], ['PRIMAIRE'], '#3B82F6'],
  ['Mathematiques', 'MATH', 'Mathematiques', 3, ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], ['PRIMAIRE'], '#10B981'],
  ['Sciences', 'SCI', 'Sciences et Technologie', 2, ['CE1', 'CE2', 'CM1', 'CM2'], ['PRIMAIRE'], '#8B5CF6'],
  ['Histoire-Geographie', 'HG', 'Histoire et Geographie', 2, ['CE1', 'CE2', 'CM1', 'CM2'], ['PRIMAIRE'], '#F59E0B'],
  ['Education Civique', 'EC', 'Education civique et morale', 1, ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], ['PRIMAIRE'], '#EF4444'],
  ['Dessin', 'DESSIN', 'Arts plastiques', 1, ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], ['PRIMAIRE'], '#EC4899'],
  ['EPS', 'EPS', 'Education physique et sportive', 1, ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'], ['PRIMAIRE'], '#06B6D4'],
  ['Francais', 'FRA_COL', 'Langue francaise', 4, ['SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME'], ['COLLEGE'], '#3B82F6'],
  ['Mathematiques', 'MATH_COL', 'Mathematiques', 4, ['SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME'], ['COLLEGE'], '#10B981'],
  ['Anglais', 'ANG_COL', 'Langue anglaise', 3, ['SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME'], ['COLLEGE'], '#F59E0B'],
  ['Physique-Chimie', 'PC_COL', 'Physique et Chimie', 3, ['QUATRIEME', 'TROISIEME'], ['COLLEGE'], '#8B5CF6'],
  ['SVT', 'SVT_COL', 'Sciences de la Vie et de la Terre', 3, ['SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME'], ['COLLEGE'], '#14B8A6'],
  ['Histoire-Geographie', 'HG_COL', 'Histoire et Geographie', 3, ['SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME'], ['COLLEGE'], '#F59E0B'],
  ['Francais', 'FRA_LYC', 'Langue francaise', 5, ['SECONDE', 'PREMIERE', 'TERMINALE'], ['LYCEE'], '#3B82F6'],
  ['Mathematiques', 'MATH_LYC', 'Mathematiques', 5, ['SECONDE', 'PREMIERE', 'TERMINALE'], ['LYCEE'], '#10B981'],
  ['Anglais', 'ANG_LYC', 'Langue anglaise', 3, ['SECONDE', 'PREMIERE', 'TERMINALE'], ['LYCEE'], '#F59E0B'],
  ['Physique-Chimie', 'PC_LYC', 'Physique et Chimie', 4, ['SECONDE', 'PREMIERE', 'TERMINALE'], ['LYCEE'], '#8B5CF6'],
  ['SVT', 'SVT_LYC', 'Sciences de la Vie et de la Terre', 4, ['SECONDE', 'PREMIERE', 'TERMINALE'], ['LYCEE'], '#14B8A6'],
  ['Philosophie', 'PHILO', 'Philosophie', 4, ['TERMINALE'], ['LYCEE'], '#6366F1'],
];

function computeDefaultAnnee() {
  const now = new Date();
  // Année scolaire togolaise : septembre -> juin. Avant septembre, on est
  // encore dans l'année scolaire qui a démarré l'année civile précédente.
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    annee: `${startYear}-${startYear + 1}`,
    dateDebut: `${startYear}-09-01`,
    dateFin: `${startYear + 1}-06-30`,
  };
}

// Best-effort : une école déjà créée (avec son admin) ne doit pas échouer
// entièrement si ce bootstrap accroche — l'admin peut toujours créer une
// année scolaire et des matières à la main depuis Configuration.
async function bootstrapEcoleDefaults(ecoleId) {
  try {
    const { annee, dateDebut, dateFin } = computeDefaultAnnee();
    await queryScoped(
      ecoleId,
      `INSERT INTO annees_scolaires (annee, date_debut, date_fin, active, ecole_id)
       VALUES ($1, $2, $3, true, $4)
       ON CONFLICT DO NOTHING`,
      [annee, dateDebut, dateFin, ecoleId]
    );
  } catch (error) {
    logger.error(`[EcoleBootstrap] échec création année scolaire par défaut (école ${ecoleId}):`, error.message);
  }

  for (const [nom, code, description, coefficient, niveaux, cycles, couleur] of DEFAULT_MATIERES) {
    try {
      await queryScoped(
        ecoleId,
        `INSERT INTO matieres (nom, code, description, coefficient, niveaux, cycles, couleur, ecole_id)
         VALUES ($1, $2, $3, $4, $5::niveau_enum[], $6::cycle_enum[], $7, $8)
         ON CONFLICT DO NOTHING`,
        [nom, code, description, coefficient, niveaux, cycles, couleur, ecoleId]
      );
    } catch (error) {
      logger.error(`[EcoleBootstrap] échec création matière ${code} (école ${ecoleId}):`, error.message);
    }
  }
}

module.exports = { bootstrapEcoleDefaults };
