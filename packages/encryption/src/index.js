import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export class Encryption {
  #key;

  constructor(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Encryption key is required and must be a string');
    }

    const keyBuffer = Buffer.from(key, 'hex');

    if (keyBuffer.length !== 32) {
      throw new Error(
        `Encryption key must be 32 bytes (64 hex characters), got ${keyBuffer.length} bytes`,
      );
    }

    this.#key = keyBuffer;
  }

  encrypt(text) {
    if (typeof text !== 'string') {
      throw new Error('encrypt() expects a string argument');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.#key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv(32hex) + authTag(32hex) + ciphertext
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
  }

  decrypt(encryptedHex) {
    if (typeof encryptedHex !== 'string') {
      throw new Error('decrypt() expects a hex string argument');
    }

    const ivHexLength = IV_LENGTH * 2;
    const authTagHexLength = AUTH_TAG_LENGTH * 2;
    const minLength = ivHexLength + authTagHexLength + 2;

    if (encryptedHex.length < minLength) {
      throw new Error('Encrypted data is too short or corrupted');
    }

    const iv = Buffer.from(encryptedHex.slice(0, ivHexLength), 'hex');
    const authTag = Buffer.from(
      encryptedHex.slice(ivHexLength, ivHexLength + authTagHexLength),
      'hex',
    );
    const ciphertext = encryptedHex.slice(ivHexLength + authTagHexLength);

    const decipher = createDecipheriv(ALGORITHM, this.#key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export function createEncryption(config) {
  const key = typeof config === 'string'
    ? config
    : config.get('ENCRYPTION_KEY');

  return new Encryption(key);
}
