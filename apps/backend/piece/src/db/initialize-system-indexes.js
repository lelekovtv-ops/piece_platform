import { getGlobalSystemCollection } from '@piece/multitenancy';

export async function initializeSystemIndexes() {
  const users = getGlobalSystemCollection('users');
  await users.createIndex({ email: 1 }, { unique: true, sparse: true });
  await users.createIndex({ createdAt: -1 });

  const teams = getGlobalSystemCollection('teams');
  await teams.createIndex({ ownerId: 1 });
  await teams.createIndex({ createdAt: -1 });

  const teamMembers = getGlobalSystemCollection('team_members');
  await teamMembers.createIndex({ teamId: 1, userId: 1 }, { unique: true });
  await teamMembers.createIndex({ userId: 1 });

  const userSettings = getGlobalSystemCollection('user_settings');
  await userSettings.createIndex({ userId: 1, storeKey: 1 }, { unique: true });
}
