/**
 * Test team fixtures.
 *
 * Placeholder tokens:
 *   piece  — project slug
 */

export const testTeamId = 'team-test-001';

export const testTeam = Object.freeze({
  id: testTeamId,
  name: 'Test Team',
  slug: 'test-team',
  ownerId: 'user-test-003',
  plan: 'free',
  membersCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/**
 * Create a team fixture with custom overrides.
 *
 * @param {Partial<typeof testTeam>} overrides
 * @returns {typeof testTeam}
 */
export function createTestTeam(overrides = {}) {
  return { ...testTeam, ...overrides };
}
