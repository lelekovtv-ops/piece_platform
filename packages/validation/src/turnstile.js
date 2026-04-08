import { createLogger } from '@piece/logger';

const logger = createLogger({ serviceName: 'validation' });
const componentLogger = logger.createComponentLogger('Turnstile');

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * @param {string} token - The cf-turnstile-response token from the client
 * @param {string} secretKey - Turnstile secret key from config
 * @param {Object} [options]
 * @param {string} [options.remoteIp] - Client IP address (optional, improves accuracy)
 * @returns {Promise<{ success: boolean, errorCodes: string[] }>}
 */
export async function verifyTurnstile(token, secretKey, options = {}) {
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  if (!secretKey) {
    componentLogger.warn('Turnstile secret key not configured, skipping verification');
    return { success: true, errorCodes: [] };
  }

  try {
    const body = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    if (options.remoteIp) {
      body.append('remoteip', options.remoteIp);
    }

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();

    if (!data.success) {
      componentLogger.warn('Turnstile verification failed', {
        errorCodes: data['error-codes'],
        remoteIp: options.remoteIp,
      });
    }

    return {
      success: data.success === true,
      errorCodes: data['error-codes'] || [],
    };
  } catch (error) {
    componentLogger.error('Turnstile verification error', { error: error.message });
    // Fail open — don't block registration if Cloudflare is unreachable
    return { success: true, errorCodes: ['verification-unavailable'] };
  }
}
