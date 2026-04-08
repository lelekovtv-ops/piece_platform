/**
 * Backend i18n utility.
 * Simple translation function for email templates, notifications, and server-side messages.
 *
 * Usage:
 *   import { t, getSupportedLanguages } from '@piece/i18n';
 *   const subject = t('email.verification.subject', 'ru');
 *   const message = t('email.invitation.message', 'en', { teamName: 'Acme' });
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeCache = {};

function loadLocale(lang) {
  if (!localeCache[lang]) {
    const filePath = path.join(__dirname, 'locales', `${lang}.json`);
    try {
      localeCache[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return localeCache[lang];
}

/**
 * Translate a key with optional interpolation.
 *
 * @param {string} key - Dot-separated key path (e.g., 'email.verification.subject')
 * @param {string} [lang='en'] - Target language
 * @param {Object} [params={}] - Interpolation parameters (e.g., { teamName: 'Acme' })
 * @returns {string} Translated string, or the key itself if not found
 */
export function t(key, lang = 'en', params = {}) {
  // Try requested language
  let locale = loadLocale(lang);
  let value = resolveKey(locale, key);

  // Fallback to English
  if (value === undefined && lang !== 'en') {
    locale = loadLocale('en');
    value = resolveKey(locale, key);
  }

  // Key not found in any language
  if (typeof value !== 'string') {
    return key;
  }

  // Interpolate {{params}}
  return value.replace(/\{\{(\w+)\}\}/g, (_, p) => (params[p] !== undefined ? String(params[p]) : `{{${p}}}`));
}

function resolveKey(locale, key) {
  if (!locale) return undefined;
  const keys = key.split('.');
  let value = locale;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) return undefined;
  }
  return value;
}

/**
 * Get list of supported languages.
 */
export function getSupportedLanguages() {
  return ['en', 'ru'];
}

/**
 * Check if a language is supported.
 */
export function isLanguageSupported(lang) {
  return getSupportedLanguages().includes(lang);
}
