/**
 * Utilitaire de pagination pour les endpoints liste.
 *
 * Usage dans un controller :
 *   const { limit, offset, page } = parsePagination(req.query);
 *   sql += ` LIMIT $${p++} OFFSET $${p++}`;
 *   params.push(limit, offset);
 *   const total = await countQuery(...);
 *   res.json(paginatedResponse(rows, total, page, limit));
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

/**
 * Extrait et valide les paramètres de pagination depuis req.query.
 * @param {{ page?: string, limit?: string }} query
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Formate la réponse paginée.
 * @param {any[]} data
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 */
function paginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

module.exports = { parsePagination, paginatedResponse, DEFAULT_LIMIT, MAX_LIMIT };
