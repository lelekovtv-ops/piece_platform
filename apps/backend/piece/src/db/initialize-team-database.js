import { getSystemCollection } from '@piece/multitenancy';

export async function initializeTeamDatabase(teamId) {
  const projects = getSystemCollection(teamId, 'projects');
  await projects.createIndex({ ownerId: 1 });
  await projects.createIndex({ createdAt: -1 });

  const blocks = getSystemCollection(teamId, 'blocks');
  await blocks.createIndex({ projectId: 1, order: 1 });
  await blocks.createIndex({ projectId: 1, type: 1 });

  const rundownEntries = getSystemCollection(teamId, 'rundown_entries');
  await rundownEntries.createIndex({ projectId: 1, parentBlockId: 1 });
  await rundownEntries.createIndex({ projectId: 1, parentEntryId: 1 });
  await rundownEntries.createIndex({ projectId: 1, order: 1 });

  const bibleCharacters = getSystemCollection(teamId, 'bible_characters');
  await bibleCharacters.createIndex({ projectId: 1 });
  await bibleCharacters.createIndex({ projectId: 1, name: 1 }, { unique: true });

  const bibleLocations = getSystemCollection(teamId, 'bible_locations');
  await bibleLocations.createIndex({ projectId: 1 });
  await bibleLocations.createIndex({ projectId: 1, name: 1 }, { unique: true });

  const bibleProps = getSystemCollection(teamId, 'bible_props');
  await bibleProps.createIndex({ projectId: 1 });
  await bibleProps.createIndex({ projectId: 1, name: 1 }, { unique: true });

  const projectSettings = getSystemCollection(teamId, 'project_settings');
  await projectSettings.createIndex({ projectId: 1, storeKey: 1 }, { unique: true });

  const operations = getSystemCollection(teamId, 'operations');
  await operations.createIndex({ projectId: 1, createdAt: -1 });
  await operations.createIndex({ projectId: 1, type: 1 });

  const sceneLocks = getSystemCollection(teamId, 'scene_locks');
  await sceneLocks.createIndex({ projectId: 1, sceneId: 1 }, { unique: true });
  await sceneLocks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
