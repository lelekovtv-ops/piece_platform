/**
 * Test user fixtures.
 *
 * Placeholder tokens:
 *   koza-studio  — project slug
 */

export const testUser = Object.freeze({
  id: 'user-test-001',
  email: 'user@example.com',
  displayName: 'Test User',
  role: 'manager',
  teamRole: 'manager',
  selectedTeamId: 'team-test-001',
  isEmailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

export const testAdmin = Object.freeze({
  id: 'user-test-002',
  email: 'admin@example.com',
  displayName: 'Test Admin',
  role: 'admin',
  teamRole: 'admin',
  selectedTeamId: 'team-test-001',
  isEmailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

export const testOwner = Object.freeze({
  id: 'user-test-003',
  email: 'owner@example.com',
  displayName: 'Test Owner',
  role: 'owner',
  teamRole: 'owner',
  selectedTeamId: 'team-test-001',
  isEmailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

/**
 * Create a user fixture with custom overrides.
 *
 * @param {Partial<typeof testUser>} overrides
 * @returns {typeof testUser}
 */
export function createTestUser(overrides = {}) {
  return { ...testUser, ...overrides };
}
