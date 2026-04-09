import { MongoClient } from 'mongodb';

const DEFAULT_SYSTEM_DB_NAME = 'piece_system';
const TABLE_PREFIX = 'table_';
const TEAM_DB_PREFIX = 'team_';

let client = null;
let systemDb = null;

export async function initializeMultiTenancy(mongoUri, options = {}) {
  if (client) {
    return;
  }

  const {
    systemDbName = DEFAULT_SYSTEM_DB_NAME,
    maxPoolSize = 200,
    minPoolSize = 20,
    connectTimeoutMS = 10000,
    serverSelectionTimeoutMS = 10000,
    waitQueueTimeoutMS = 30000,
    socketTimeoutMS = 30000,
    retryWrites = true,
    retryReads = true,
  } = options;

  client = new MongoClient(mongoUri, {
    maxPoolSize,
    minPoolSize,
    connectTimeoutMS,
    serverSelectionTimeoutMS,
    waitQueueTimeoutMS,
    socketTimeoutMS,
    retryWrites,
    retryReads,
  });

  await client.connect();
  systemDb = client.db(systemDbName);
}

export function getMongoClient() {
  if (!client) {
    throw new Error('MultiTenancy not initialized. Call initializeMultiTenancy() first.');
  }
  return client;
}

export function getSystemDb() {
  if (!systemDb) {
    throw new Error('MultiTenancy not initialized. Call initializeMultiTenancy() first.');
  }
  return systemDb;
}

export function getGlobalSystemCollection(name) {
  if (!systemDb) {
    throw new Error('MultiTenancy not initialized. Call initializeMultiTenancy() first.');
  }
  return systemDb.collection(name);
}

export function getSystemCollection(teamId, name) {
  if (!client) {
    throw new Error('MultiTenancy not initialized. Call initializeMultiTenancy() first.');
  }

  if (!teamId) {
    throw new Error('teamId is required for per-team collection access');
  }

  const db = client.db(`${TEAM_DB_PREFIX}${teamId}`);
  return db.collection(name);
}

export function getTableCollection(teamId, name) {
  if (!client) {
    throw new Error('MultiTenancy not initialized. Call initializeMultiTenancy() first.');
  }

  if (!teamId) {
    throw new Error('teamId is required for table collection access');
  }

  const db = client.db(`${TEAM_DB_PREFIX}${teamId}`);
  return db.collection(`${TABLE_PREFIX}${name}`);
}

export function getTeamDatabase(teamId) {
  if (!client) {
    throw new Error('MultiTenancy not initialized. Call initializeMultiTenancy() first.');
  }

  if (!teamId) {
    throw new Error('teamId is required for team database access');
  }

  return client.db(`${TEAM_DB_PREFIX}${teamId}`);
}

export async function initializeSystemIndexes() {
  if (!systemDb) {
    throw new Error('MultiTenancy not initialized. Call initializeMultiTenancy() first.');
  }

  const users = systemDb.collection('users');
  await users.createIndex({ email: 1 }, { unique: true, sparse: true });
  await users.createIndex({ createdAt: -1 });

  const teams = systemDb.collection('teams');
  await teams.createIndex({ createdAt: -1 });
}

export async function initializeTeamDatabase(teamId) {
  if (!client) {
    throw new Error('MultiTenancy not initialized. Call initializeMultiTenancy() first.');
  }

  // Placeholder: add per-team collection indexes here
  // const db = client.db(`${TEAM_DB_PREFIX}${teamId}`);
  // const subscribers = db.collection('subscribers');
  // await subscribers.createIndex({ createdAt: -1 });
}

export async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    systemDb = null;
  }
}
