import { createComponentLogger } from '../utils/logger.js';

const componentLogger = createComponentLogger('Collaboration');

const activeLocks = new Map();
const LOCK_TTL_MS = 5 * 60 * 1000;

export function initializeCollaboration(namespace) {
  namespace.on('connection', (socket) => {
    const { projectId: _projectId } = socket.handshake.query;

    socket.on('join-project', ({ projectId: pid }) => {
      const room = `project:${pid}`;
      socket.join(room);
      socket.data.projectId = pid;

      const presence = getPresenceForRoom(namespace, room);
      socket.emit('presence:update', { users: presence });
      socket.to(room).emit('user:joined', {
        userId: socket.data.userId || socket.id,
        name: socket.data.userName || 'Anonymous',
      });

      componentLogger.info('User joined project', { socketId: socket.id, projectId: pid });
    });

    socket.on('leave-project', () => {
      if (socket.data.projectId) {
        const room = `project:${socket.data.projectId}`;
        socket.to(room).emit('user:left', {
          userId: socket.data.userId || socket.id,
        });
        socket.leave(room);
        releaseUserLocks(socket);
        socket.data.projectId = null;
      }
    });

    socket.on('op', (operation) => {
      if (!socket.data.projectId) return;

      const room = `project:${socket.data.projectId}`;
      socket.to(room).emit('op', {
        op: operation,
        userId: socket.data.userId || socket.id,
        timestamp: Date.now(),
      });

      socket.emit('op:ack', { opId: operation.opId || Date.now() });
    });

    socket.on('lock', ({ sceneId }) => {
      if (!socket.data.projectId || !sceneId) return;

      const lockKey = `${socket.data.projectId}:${sceneId}`;
      const existing = activeLocks.get(lockKey);

      if (existing && existing.socketId !== socket.id && Date.now() < existing.expiresAt) {
        socket.emit('lock:denied', { sceneId, userName: existing.userName });
        return;
      }

      activeLocks.set(lockKey, {
        socketId: socket.id,
        userId: socket.data.userId || socket.id,
        userName: socket.data.userName || 'Anonymous',
        expiresAt: Date.now() + LOCK_TTL_MS,
      });

      const room = `project:${socket.data.projectId}`;
      socket.emit('lock:ok', { sceneId });
      socket.to(room).emit('lock:acquired', {
        sceneId,
        userId: socket.data.userId || socket.id,
        userName: socket.data.userName || 'Anonymous',
      });
    });

    socket.on('unlock', ({ sceneId }) => {
      if (!socket.data.projectId || !sceneId) return;

      const lockKey = `${socket.data.projectId}:${sceneId}`;
      const lock = activeLocks.get(lockKey);

      if (lock && lock.socketId === socket.id) {
        activeLocks.delete(lockKey);
        const room = `project:${socket.data.projectId}`;
        namespace.to(room).emit('lock:released', { sceneId });
      }
    });

    socket.on('presence', ({ cursor }) => {
      if (!socket.data.projectId) return;

      socket.data.cursor = cursor;
      const room = `project:${socket.data.projectId}`;
      socket.to(room).emit('presence:update', {
        users: getPresenceForRoom(namespace, room),
      });
    });

    socket.on('disconnect', () => {
      releaseUserLocks(socket);
      if (socket.data.projectId) {
        const room = `project:${socket.data.projectId}`;
        socket.to(room).emit('user:left', {
          userId: socket.data.userId || socket.id,
        });
      }
    });
  });

  setInterval(() => cleanExpiredLocks(), 60_000);

  componentLogger.info('Collaboration handlers initialized');
}

function releaseUserLocks(socket) {
  for (const [key, lock] of activeLocks) {
    if (lock.socketId === socket.id) {
      activeLocks.delete(key);
      if (socket.data.projectId) {
        const room = `project:${socket.data.projectId}`;
        const sceneId = key.split(':').pop();
        socket.to(room).emit('lock:released', { sceneId });
      }
    }
  }
}

function cleanExpiredLocks() {
  const now = Date.now();
  for (const [key, lock] of activeLocks) {
    if (now >= lock.expiresAt) {
      activeLocks.delete(key);
    }
  }
}

function getPresenceForRoom(namespace, room) {
  const sockets = namespace.adapter?.rooms?.get(room);
  if (!sockets) return [];

  const users = [];
  for (const sid of sockets) {
    const sock = namespace.sockets.get(sid);
    if (sock) {
      users.push({
        userId: sock.data.userId || sock.id,
        name: sock.data.userName || 'Anonymous',
        cursor: sock.data.cursor || null,
      });
    }
  }
  return users;
}
