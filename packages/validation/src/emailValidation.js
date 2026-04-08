import { createRequire } from 'node:module';
import { promises as dns } from 'node:dns';
import { createLogger } from '@piece/logger';

const require = createRequire(import.meta.url);
const disposableDomains = require('disposable-email-domains');

const logger = createLogger({ serviceName: 'validation' });
const componentLogger = logger.createComponentLogger('EmailValidation');

const disposableDomainSet = new Set(disposableDomains);

/**
 * Add custom blocked domains from a comma-separated string.
 * Call once at startup with config value.
 *
 * @param {string} domainsRaw - Comma-separated domain list (e.g. "evil.com,spam.net")
 */
export function loadCustomBlockedDomains(domainsRaw) {
  if (!domainsRaw) return;
  const customDomains = domainsRaw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  for (const domain of customDomains) {
    disposableDomainSet.add(domain);
  }
  componentLogger.info('Custom blocked domains loaded', { count: customDomains.length });
}

componentLogger.info('Disposable email domain set initialized', { totalDomains: disposableDomainSet.size });

/**
 * Check if an email address uses a disposable/temporary domain.
 *
 * @param {string} email
 * @returns {boolean}
 */
export function isDisposableEmail(email) {
  if (!email || !email.includes('@')) {
    return false;
  }
  const domain = email.split('@').pop().toLowerCase();
  return disposableDomainSet.has(domain);
}

/**
 * Validate that an email does not use a disposable domain.
 * Throws with code DISPOSABLE_EMAIL_NOT_ALLOWED if disposable.
 *
 * @param {string} email
 * @throws {Error}
 */
export function validateEmailDomain(email) {
  if (isDisposableEmail(email)) {
    const domain = email.split('@').pop().toLowerCase();
    componentLogger.warn('Disposable email blocked', { domain });
    const error = new Error('Disposable email addresses are not allowed');
    error.code = 'DISPOSABLE_EMAIL_NOT_ALLOWED';
    throw error;
  }
}

/**
 * Validate that the email domain has MX records (can receive email).
 * Graceful: returns true on DNS timeout or error (don't block registration on DNS issues).
 *
 * @param {string} email
 * @returns {Promise<boolean>} true if MX records exist or DNS is unreachable
 */
export async function validateMxRecord(email) {
  if (!email || !email.includes('@')) {
    return false;
  }
  const domain = email.split('@').pop().toLowerCase();
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('MX lookup timeout')), 3000),
    );
    const mxRecords = await Promise.race([dns.resolveMx(domain), timeout]);
    if (!mxRecords || mxRecords.length === 0) {
      componentLogger.warn('No MX records found', { domain });
      return false;
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      componentLogger.warn('Domain has no MX records', { domain, code: error.code });
      return false;
    }
    // DNS timeout or other network error — fail open
    componentLogger.debug('MX lookup failed, allowing', { domain, error: error.message });
    return true;
  }
}
