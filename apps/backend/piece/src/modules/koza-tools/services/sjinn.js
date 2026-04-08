import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('SJinn');

const SJINN_BASE = 'https://sjinn.ai/api/un-api';

function getApiKey() {
  const key = config.get('SJINN_API_KEY');
  if (!key) throw new Error('SJINN_API_KEY not configured');
  return key;
}

export async function createTask({ toolType, input }) {
  const apiKey = getApiKey();

  componentLogger.info('Creating task', { toolType });

  const res = await fetch(`${SJINN_BASE}/create_tool_task`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tool_type: toolType, input }),
  });

  if (!res.ok) {
    const err = await res.text();
    componentLogger.error('Create task failed', { status: res.status, error: err });
    throw new Error(`SJinn create failed: ${res.statusText} ${err}`);
  }

  const data = await res.json();

  if (!data.success || !data.data?.task_id) {
    throw new Error(data.errorMsg || 'SJinn returned no task_id');
  }

  componentLogger.info('Task created', { taskId: data.data.task_id });
  return { taskId: data.data.task_id };
}

export async function pollTask(taskId) {
  const apiKey = getApiKey();

  const res = await fetch(`${SJINN_BASE}/query_tool_task_status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ task_id: taskId }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SJinn poll failed: ${err}`);
  }

  const data = await res.json();

  if (!data.success || !data.data) {
    throw new Error(data.errorMsg || 'Poll error');
  }

  return {
    taskId: data.data.task_id,
    status: data.data.status,
    outputUrls: data.data.output_urls || [],
    error: data.data.status === -1 ? (data.errorMsg || 'Task failed') : undefined,
  };
}
