import crypto from 'node:crypto';
import { createCache, StandardTTL } from '@piece/cache';
import { getGlobalSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';
import { config } from '../../config.js';
import { teamService } from '../teams/service.js';

const componentLogger = createComponentLogger('MagicLinkService');

const MAGIC_LINK_TTL = StandardTTL.verification;
const CACHE_PREFIX = 'magic-link';

const cache = createCache({ prefix: CACHE_PREFIX, defaultTTL: MAGIC_LINK_TTL });

function getUsersCollection() {
  return getGlobalSystemCollection('users');
}

function getFrontendUrl() {
  return config.get('FRONTEND_URL');
}

export async function generateMagicLink(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const token = crypto.randomBytes(32).toString('hex');

  await cache.set(token, { email: normalizedEmail }, MAGIC_LINK_TTL);

  const magicUrl = `${getFrontendUrl()}/auth/verify?token=${token}`;

  componentLogger.info('Magic link generated', { email: normalizedEmail });

  if (config.get('NODE_ENV') === 'development' || config.get('DISABLE_EMAIL_SENDING') === 'true') {
    componentLogger.info('DEV magic link URL', { url: magicUrl, email: normalizedEmail });
  }

  return { token, url: magicUrl, email: normalizedEmail };
}

export async function sendMagicLinkEmail(email, magicUrl) {
  try {
    const { sendEmail } = await import('@piece/email');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #fff; margin-bottom: 8px;">Sign in to Piece</h2>
        <p style="color: #999; margin-bottom: 32px;">Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${magicUrl}" style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Sign In
        </a>
        <p style="color: #666; font-size: 13px; margin-top: 32px;">If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #444; font-size: 12px; margin-top: 24px;">Or paste this link in your browser:<br/><span style="color: #7c3aed; word-break: break-all;">${magicUrl}</span></p>
      </div>
    `;

    await sendEmail(email, 'Sign in to Piece', html);
    componentLogger.info('Magic link email sent', { email });
  } catch (err) {
    componentLogger.error('Failed to send magic link email', { email, error: err.message });
    throw err;
  }
}

export async function verifyMagicLink(token) {
  const data = await cache.get(token);
  if (!data) return null;

  await cache.del(token);

  const { email } = data;
  const users = getUsersCollection();

  let user = await users.findOne({ email });

  if (!user) {
    const now = new Date();
    const result = await users.insertOne({
      email,
      name: email.split('@')[0],
      avatarUrl: null,
      language: 'en',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    user = await users.findOne({ _id: result.insertedId });
    const userId = mongoIdUtils.toApiString(user._id);
    componentLogger.info('User auto-created via magic link', { email, userId });

    try {
      const teamName = `${email.split('@')[0]}'s Team`;
      await teamService.create({ name: teamName, ownerId: userId });
      componentLogger.info('Personal team created for magic link user', { userId });
    } catch (teamErr) {
      componentLogger.warn('Failed to create team for magic link user', { userId, error: teamErr.message });
    }
  } else if (!user.emailVerified) {
    await users.updateOne({ _id: user._id }, { $set: { emailVerified: true, updatedAt: new Date() } });
    user.emailVerified = true;
  }

  return user;
}
