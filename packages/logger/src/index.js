import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import pino from 'pino';

const asyncLocalStorage = new AsyncLocalStorage();

export { asyncLocalStorage };

export function getCorrelationId() {
  const store = asyncLocalStorage.getStore();
  return store?.correlationId ?? null;
}

export function runWithContext(context, fn) {
  return asyncLocalStorage.run(context, fn);
}

export function createLogger({ serviceName }) {
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';

  const transport = isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined;

  const baseLogger = pino({
    level: (process.env.LOG_LEVEL || 'INFO').toLowerCase(),
    transport,
    base: { service: serviceName },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
      const store = asyncLocalStorage.getStore();
      return store?.correlationId ? { correlationId: store.correlationId } : {};
    },
  });

  baseLogger.createComponentLogger = function createComponentLogger(componentName) {
    return baseLogger.child({ component: componentName });
  };

  return baseLogger;
}

export function createRequestLoggingMiddleware(logger) {
  return function requestLoggingMiddleware(req, res, next) {
    const correlationId =
      req.headers['x-correlation-id'] || randomUUID();

    req.correlationId = correlationId;

    res.setHeader('X-Correlation-Id', correlationId);

    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;

      const logData = {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        contentLength: res.getHeader('content-length'),
      };

      if (res.statusCode >= 500) {
        logger.error(logData, 'Request failed');
      } else if (res.statusCode >= 400) {
        logger.warn(logData, 'Request error');
      } else {
        logger.info(logData, 'Request completed');
      }
    });

    asyncLocalStorage.run({ correlationId }, () => {
      next();
    });
  };
}
