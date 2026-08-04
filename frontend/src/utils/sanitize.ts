import DOMPurify from 'dompurify'

/**
 * Sanitise une chaîne HTML pour éviter les injections XSS.
 * À utiliser avant d'insérer du contenu HTML dynamique dans le DOM.
 *
 * @example
 * // Mauvais — vulnérable XSS :
 * <div dangerouslySetInnerHTML={{ __html: userContent }} />
 *
 * // Bon — sécurisé :
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  })
}

/**
 * Sanitise et supprime toutes les balises HTML.
 * Retourne du texte pur, sans aucun HTML.
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

/**
 * Sanitise une URL pour s'assurer qu'elle n'est pas un javascript: ou data: URI.
 */
export function sanitizeUrl(url: string): string {
  const clean = DOMPurify.sanitize(url, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
  if (/^(javascript:|data:)/i.test(clean)) return '#'
  return clean
}
