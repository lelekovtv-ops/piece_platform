import { createLogger, createRequestLoggingMiddleware } from '@piece/logger';

export const logger = createLogger({ serviceName: 'koza-studio' });
export const createComponentLogger = (component) => logger.createComponentLogger(component);
export { createRequestLoggingMiddleware };
