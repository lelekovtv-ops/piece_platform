import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const values = {
        ANTHROPIC_API_KEY: 'test-key',
        OPENAI_API_KEY: 'test-key',
        GOOGLE_API_KEY: '',
      };
      return values[key] ?? '';
    }),
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

const { getConfiguredProviders, DEFAULT_MODELS } = await import('../services/providers.js');

describe('getConfiguredProviders', () => {
  it('should return configured status for each provider', () => {
    const providers = getConfiguredProviders();
    expect(providers.anthropic).toBe(true);
    expect(providers.openai).toBe(true);
    expect(providers.google).toBe(false);
  });
});

describe('DEFAULT_MODELS', () => {
  it('should have model for each provider', () => {
    expect(DEFAULT_MODELS.anthropic).toContain('claude');
    expect(DEFAULT_MODELS.openai).toContain('gpt');
    expect(DEFAULT_MODELS.google).toContain('gemini');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(DEFAULT_MODELS)).toBe(true);
  });
});
