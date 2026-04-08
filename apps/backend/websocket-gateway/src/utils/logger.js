import { createLogger } from '@piece/logger';

export const logger = createLogger({ serviceName: 'websocket-gateway' });

/**
 * Create a component-scoped logger.
 * @param {string} component
 */
export function createComponentLogger(component) {
  return logger.createComponentLogger(component);
}
