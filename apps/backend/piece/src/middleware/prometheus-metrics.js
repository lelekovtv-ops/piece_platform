export function buildPrometheusMetrics() {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const uptime = process.uptime();

  const lines = [
    '# HELP process_memory_rss_bytes Resident set size in bytes',
    '# TYPE process_memory_rss_bytes gauge',
    `process_memory_rss_bytes ${mem.rss}`,
    '',
    '# HELP process_memory_heap_used_bytes Heap used in bytes',
    '# TYPE process_memory_heap_used_bytes gauge',
    `process_memory_heap_used_bytes ${mem.heapUsed}`,
    '',
    '# HELP process_memory_heap_total_bytes Heap total in bytes',
    '# TYPE process_memory_heap_total_bytes gauge',
    `process_memory_heap_total_bytes ${mem.heapTotal}`,
    '',
    '# HELP process_cpu_user_seconds_total CPU user time in seconds',
    '# TYPE process_cpu_user_seconds_total counter',
    `process_cpu_user_seconds_total ${cpu.user / 1e6}`,
    '',
    '# HELP process_cpu_system_seconds_total CPU system time in seconds',
    '# TYPE process_cpu_system_seconds_total counter',
    `process_cpu_system_seconds_total ${cpu.system / 1e6}`,
    '',
    '# HELP process_uptime_seconds Process uptime in seconds',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${uptime}`,
    '',
  ];

  return lines.join('\n');
}
