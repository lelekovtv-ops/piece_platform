/**
 * piece/permissions — RBAC + Scope (ABAC) + ReBAC permission system.
 *
 * Placeholder tokens:
 *   piece     — npm scope, e.g. @acme
 *   piece  — project slug
 *   piece        — subject prefix
 */

export {
  initializePermissions,
  requirePermission,
  requireTeamSelection,
  requireTeamAccess,
  requireScopeFilter,
  ResourceAccessResolver,
} from './middleware.js';

export {
  SystemEntities,
  Actions,
  ScopeTypes,
  SystemRoles,
  SubjectTypes,
  ResourceTypes,
  AccessLevels,
  ResourceInheritance,
  AccessLevelPriority,
} from './types.js';
