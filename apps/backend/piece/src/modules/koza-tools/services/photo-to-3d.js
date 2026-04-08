import { config } from '../../../config.js';
import { createComponentLogger } from '../../../utils/logger.js';

const componentLogger = createComponentLogger('PhotoTo3D');

const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi';

function getApiKey() {
  const key = config.get('TRIPO_API_KEY');
  if (!key) throw new Error('TRIPO_API_KEY not configured');
  return key;
}

export async function createTask({ image }) {
  const apiKey = getApiKey();

  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'image/png' }), 'photo.png');

  const uploadRes = await fetch(`${TRIPO_BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    componentLogger.error('Upload failed', { error: err });
    throw new Error(`Upload failed: ${err}`);
  }

  const uploadData = await uploadRes.json();
  const imageToken = uploadData.data.image_token;

  const taskRes = await fetch(`${TRIPO_BASE}/task`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'image_to_model',
      file: { type: 'image', file_token: imageToken },
    }),
  });

  if (!taskRes.ok) {
    const err = await taskRes.text();
    componentLogger.error('Task creation failed', { error: err });
    throw new Error(`Task creation failed: ${err}`);
  }

  const taskData = await taskRes.json();

  componentLogger.info('Task created', { taskId: taskData.data.task_id });
  return { taskId: taskData.data.task_id, status: 'queued' };
}

export async function pollTask(taskId) {
  const apiKey = getApiKey();

  const res = await fetch(`${TRIPO_BASE}/task/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Poll failed: ${err}`);
  }

  const data = await res.json();
  const task = data.data;

  const result = {
    taskId: task.task_id,
    status: task.status,
    progress: task.progress,
  };

  if (task.status === 'success' && task.output?.model) {
    result.modelUrl = task.output.model;
  }

  return result;
}
