import { describe, it, expect } from 'vitest';
import { buildPrometheusMetrics } from '../prometheus-metrics.js';

describe('Prometheus metrics', () => {
  it('should return string with process_memory_rss_bytes', () => {
    const output = buildPrometheusMetrics();
    expect(typeof output).toBe('string');
    expect(output).toContain('# TYPE process_memory_rss_bytes gauge');
    expect(output).toMatch(/process_memory_rss_bytes \d+/);
  });

  it('should include process_uptime_seconds', () => {
    const output = buildPrometheusMetrics();
    expect(output).toContain('# TYPE process_uptime_seconds gauge');
    expect(output).toMatch(/process_uptime_seconds [\d.]+/);
  });

  it('should include CPU metrics', () => {
    const output = buildPrometheusMetrics();
    expect(output).toContain('process_cpu_user_seconds_total');
    expect(output).toContain('process_cpu_system_seconds_total');
  });

  it('should include heap metrics', () => {
    const output = buildPrometheusMetrics();
    expect(output).toContain('process_memory_heap_used_bytes');
    expect(output).toContain('process_memory_heap_total_bytes');
  });
});
