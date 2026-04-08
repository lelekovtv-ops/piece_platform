import { vi, describe, it, expect } from 'vitest';

vi.mock('../../ai/services/providers.js', () => ({
  chatCompletion: vi.fn().mockResolvedValue({
    content: '{"characters": ["JOHN"], "mood": "tense"}',
  }),
}));

vi.mock('../../../utils/logger.js', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

const { executePipeline } = await import('../services/executor.js');

describe('executePipeline', () => {
  it('should execute a single node pipeline', async () => {
    const nodes = [{ id: 'n1', type: 'scene_analyst', data: {} }];
    const edges = [];
    const context = { sceneText: 'INT. OFFICE - DAY\nJohn enters.' };

    const results = await executePipeline({ nodes, edges, context });

    expect(results.n1).toBeDefined();
    expect(results.n1.characters).toContain('JOHN');
  });

  it('should execute nodes in topological order', async () => {
    const nodes = [
      { id: 'n1', type: 'scene_analyst', data: {} },
      { id: 'n2', type: 'code', data: {} },
    ];
    const edges = [{ source: 'n1', target: 'n2' }];

    const results = await executePipeline({ nodes, edges, context: { sceneText: 'Test' } });

    expect(results.n1).toBeDefined();
    expect(results.n2).toBeDefined();
  });

  it('should handle empty pipeline', async () => {
    const results = await executePipeline({ nodes: [], edges: [], context: {} });
    expect(Object.keys(results)).toHaveLength(0);
  });

  it('should pass outputs between connected nodes', async () => {
    const nodes = [
      { id: 'source', type: 'foreach', data: {} },
      { id: 'target', type: 'code', data: {} },
    ];
    const edges = [{ source: 'source', target: 'target' }];

    const results = await executePipeline({ nodes, edges, context: {} });

    expect(results.source).toBeDefined();
    expect(results.target).toBeDefined();
  });
});
