/**
 * Normalize an email address for duplicate detection.
 *
 * Does NOT modify the stored email — only used for uniqueness checks.
 *
 * Rules:
 * - Lowercase + trim
 * - Gmail/Googlemail: remove dots from local part, strip +alias
 * - googlemail.com → gmail.com
 * - All domains: strip +alias (plus addressing)
 *
 * @param {string} email
 * @returns {string} Normalized email for comparison
 */
export function normalizeEmail(email) {
  if (!email || !email.includes('@')) {
    return email || '';
  }

  let [local, domain] = email.trim().toLowerCase().split('@');

  // Normalize googlemail.com to gmail.com
  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  // Strip plus addressing (user+tag → user)
  const plusIndex = local.indexOf('+');
  if (plusIndex > 0) {
    local = local.slice(0, plusIndex);
  }

  // Gmail-specific: remove dots from local part
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

/**
 * Check if two emails are duplicates after normalization.
 *
 * @param {string} email1
 * @param {string} email2
 * @returns {boolean}
 */
export function areEmailsDuplicate(email1, email2) {
  return normalizeEmail(email1) === normalizeEmail(email2);
}
