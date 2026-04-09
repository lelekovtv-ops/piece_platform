import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';

export function createAuthMiddleware({ config, tokenBlacklist } = {}) {
  const publicKeyBase64 = config.get('JWT_PUBLIC_KEY_BASE64');
  const publicKey = Buffer.from(publicKeyBase64, 'base64').toString('utf8');

  let _blacklist = tokenBlacklist || null;

  function setTokenBlacklist(bl) {
    _blacklist = bl;
  }

  async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.slice(7);

    try {
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

      if (_blacklist && decoded.jti) {
        const blacklisted = await _blacklist.isBlacklisted(decoded.jti);
        if (blacklisted) {
          return res.status(401).json({
            error: 'TOKEN_REVOKED',
            message: 'Access token has been revoked',
          });
        }
      }

      req.user = {
        id: decoded.sub || decoded.id,
        email: decoded.email,
        role: decoded.role,
        ...decoded,
      };

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        });
      }

      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid access token',
      });
    }
  }

  function authenticateInternalToken(req, res, next) {
    const internalToken = req.headers['x-internal-token'];
    const expectedToken = config.get('INTERNAL_TOKEN');

    if (!internalToken) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing x-internal-token header',
      });
    }

    const tokenBuffer = Buffer.from(internalToken, 'utf8');
    const expectedBuffer = Buffer.from(expectedToken, 'utf8');

    if (tokenBuffer.length !== expectedBuffer.length || !timingSafeEqual(tokenBuffer, expectedBuffer)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Invalid internal token',
      });
    }

    req.isInternal = true;
    next();
  }

  function optionalAuth(req, _res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.slice(7);

    try {
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
      req.user = {
        id: decoded.sub || decoded.id,
        email: decoded.email,
        role: decoded.role,
        ...decoded,
      };
    } catch {
      req.user = null;
    }

    next();
  }

  function verifyToken(token) {
    try {
      const rawToken = token?.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(rawToken, publicKey, { algorithms: ['RS256'] });
      return {
        id: decoded.sub || decoded.id,
        email: decoded.email,
        role: decoded.role,
        ...decoded,
      };
    } catch {
      return null;
    }
  }

  return { authenticateToken, authenticateInternalToken, optionalAuth, verifyToken, setTokenBlacklist };
}
