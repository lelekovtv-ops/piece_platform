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

// TODO: Update production/staging origins when domain is configured
const ORIGINS_BY_ENV = {
  production: [
    'https://app.localhost',
    'https://localhost',
  ],
  staging: [
    'https://staging-app.localhost',
    'https://staging.localhost',
  ],
  development: [
    'http://localhost:4030',
    'http://localhost:5200',
    /^http:\/\/localhost:\d+$/,
  ],
};

function resolveOrigins() {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return ORIGINS_BY_ENV.production;
  }

  if (env === 'staging') {
    return [...ORIGINS_BY_ENV.staging, ...ORIGINS_BY_ENV.development];
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
