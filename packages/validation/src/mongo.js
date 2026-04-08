/**
 * MongoDB ObjectId utilities.
 *
 * Centralises all ObjectId conversions so services never import ObjectId directly.
 *
 * Placeholder tokens:
 *   piece     — npm scope
 *   piece  — project slug
 */

import { ObjectId } from 'mongodb';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const mongoIdUtils = Object.freeze({
  /**
   * Convert a string ID to a MongoDB ObjectId.
   * If the input is already an ObjectId, returns it unchanged.
   *
   * @param {string | ObjectId} id
   * @returns {ObjectId}
   * @throws {Error} if id is not a valid 24-char hex string
   */
  toObjectId(id) {
    if (id instanceof ObjectId) {
      return id;
    }
    if (typeof id === 'string' && OBJECT_ID_REGEX.test(id)) {
      return new ObjectId(id);
    }
    throw new Error(`Invalid ObjectId: ${id}`);
  },

  /**
   * Convert an ObjectId (or string) to its string representation.
   * Safe to call with null/undefined — returns the input unchanged.
   *
   * @param {ObjectId | string | null | undefined} id
   * @returns {string | null | undefined}
   */
  toApiString(id) {
    if (id == null) return id;
    if (id instanceof ObjectId) return id.toHexString();
    if (typeof id === 'string') return id;
    if (typeof id?.toString === 'function') return id.toString();
    return id;
  },

  /**
   * Check whether a value is a valid 24-char hex ObjectId string.
   *
   * @param {unknown} id
   * @returns {boolean}
   */
  isValid(id) {
    if (id instanceof ObjectId) return true;
    if (typeof id === 'string') return OBJECT_ID_REGEX.test(id);
    return false;
  },

  /**
   * Generate a brand-new ObjectId.
   *
   * @returns {ObjectId}
   */
  generate() {
    return new ObjectId();
  },
});
