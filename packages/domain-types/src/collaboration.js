export const OPERATION_TYPES = Object.freeze({
  BLOCK_CREATE: 'block.create',
  BLOCK_UPDATE: 'block.update',
  BLOCK_DELETE: 'block.delete',
  BLOCK_CHANGE_TYPE: 'block.changeType',
  BLOCK_REORDER: 'block.reorder',
  BLOCK_UPDATE_META: 'block.updateMeta',
  SHOT_CREATE: 'shot.create',
  SHOT_UPDATE: 'shot.update',
  SHOT_DELETE: 'shot.delete',
  SHOT_REORDER: 'shot.reorder',
  SETTINGS_SET: 'settings.set',
});

export const CLIENT_MESSAGE_TYPES = Object.freeze({
  AUTH: 'auth',
  JOIN: 'join',
  LEAVE: 'leave',
  OP: 'op',
  LOCK: 'lock',
  UNLOCK: 'unlock',
  PRESENCE: 'presence',
});

export const SERVER_MESSAGE_TYPES = Object.freeze({
  AUTH_OK: 'auth:ok',
  AUTH_ERROR: 'auth:error',
  SNAPSHOT: 'snapshot',
  OP: 'op',
  OP_ACK: 'op:ack',
  OP_REJECT: 'op:reject',
  LOCK_OK: 'lock:ok',
  LOCK_DENIED: 'lock:denied',
  LOCK_ACQUIRED: 'lock:acquired',
  LOCK_RELEASED: 'lock:released',
  PRESENCE_UPDATE: 'presence:update',
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  ERROR: 'error',
});
