import { createLogger, createRequestLoggingMiddleware } from '@piece/logger';

export const logger = createLogger({ serviceName: 'piece' });
export const createComponentLogger = (component) => logger.createComponentLogger(component);
export { createRequestLoggingMiddleware };
