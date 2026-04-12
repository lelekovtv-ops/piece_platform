/** @import { Provider, ProviderKind } from './types.js' */

/** @type {Map<string, Provider>} */
const providers = new Map();

/**
 * Register a provider instance.
 * @param {Provider} provider
 */
export function registerProvider(provider) {
  if (!provider?.id) {
    throw new Error("Provider must have an id");
  }
  if (typeof provider.generate !== "function") {
    throw new Error("Provider must have a generate function");
  }
  if (providers.has(provider.id)) {
    throw new Error(`Provider "${provider.id}" is already registered`);
  }
  providers.set(provider.id, provider);
}

/**
 * Get a provider by id.
 * @param {string} id
 * @returns {Provider | undefined}
 */
export function getProvider(id) {
  return providers.get(id);
}

/**
 * List registered providers, optionally filtered by kind.
 * @param {ProviderKind} [kind]
 * @returns {Provider[]}
 */
export function listProviders(kind) {
  const all = [...providers.values()];
  if (!kind) return all;
  return all.filter((p) => p.kind === kind);
}

/**
 * Remove all registered providers.
 */
export function clearRegistry() {
  providers.clear();
}
