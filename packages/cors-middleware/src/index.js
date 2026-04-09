import cors from 'cors';

const ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Correlation-Id',
  'X-Internal-Token',
  'x-selected-team',
];

const EXPOSED_HEADERS = [
  'X-Correlation-Id',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
];

function parseOriginsFromEnv(envVar) {
  const raw = process.env[envVar];
  if (!raw) return [];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

const ORIGINS_BY_ENV = {
  development: [
    'http://localhost:4030',
    'http://localhost:5200',
    'http://localhost:5201',
    /^http:\/\/localhost:\d+$/,
  ],
};

function resolveOrigins() {
  const env = process.env.NODE_ENV || 'development';
  const envOrigins = parseOriginsFromEnv('CORS_ORIGINS');

  if (envOrigins.length > 0) {
    return envOrigins;
  }

  if (env === 'production' || env === 'staging') {
    return [];
  }

  return ORIGINS_BY_ENV.development;
}

export const CORS_CONFIG = {
  origin: resolveOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ALLOWED_HEADERS,
  exposedHeaders: EXPOSED_HEADERS,
  maxAge: 86400,
};

export const corsMiddleware = cors(CORS_CONFIG);

export function createCorsMiddleware(options = {}) {
  return cors({
    ...CORS_CONFIG,
    ...options,
  });
}
