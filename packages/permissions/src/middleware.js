/**
 * Permission middleware for Express.
 *
 * Placeholder tokens:
 *   piece     — npm scope
 *   koza-studio  — project slug
 *   koza-studio        — subject prefix
 */

import {
  SystemRoles,
  ScopeTypes,
  AccessLevels,
  AccessLevelPriority,
  ResourceInheritance,
} from './types.js';

// ---------------------------------------------------------------------------
// Module state — populated by initializePermissions()
// ---------------------------------------------------------------------------

let _systemDb = null;
let _rolesCache = new Map();
let _options = {};

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialise the permission system.
 *
 * @param {import('mongodb').Db} systemDb — system MongoDB database instance
 * @param {object}  [options]
 * @param {object}  [options.config]            — ServiceConfig instance (for Redis settings)
 * @param {object}  [options.sharedRedisClient] — reuse an existing Redis connection
 * @param {boolean} [options.enableCaching]     — enable Redis-based permission cache (default true)
 */
export async function initializePermissions(systemDb, options = {}) {
  _systemDb = systemDb;
  _options = { enableCaching: true, ...options };

  // Load custom roles from DB and merge with system defaults
  const rolesCollection = systemDb.collection('roles');
  const dbRoles = await rolesCollection.find({}).toArray();

  _rolesCache.clear();

  // Register built-in system roles
  for (const role of Object.values(SystemRoles)) {
    _rolesCache.set(role.name, role);
  }

  // Register custom roles from DB
  for (const role of dbRoles) {
    _rolesCache.set(role.name, {
      name: role.name,
      level: role.level ?? 0,
      defaultScope: role.defaultScope ?? ScopeTypes.MY,
      permissions: role.permissions ?? {},
      scopeOverrides: role.scopeOverrides ?? {},
    });
  }
}

// ---------------------------------------------------------------------------
// RBAC middleware — requirePermission(entity, action)
// ---------------------------------------------------------------------------

/**
 * Express middleware that checks whether the authenticated user's role grants
 * the requested entity:action permission.
 *
 * System roles use a hierarchical model — higher-level roles implicitly have
 * all permissions of lower-level roles. Custom roles use an explicit allow-list.
 */
export function requirePermission(entity, action) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const roleName = user.role ?? user.teamRole;
    const role = _rolesCache.get(roleName);

    if (!role) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Unknown role: ${roleName}`,
      });
    }

    // System roles with level >= 2 (admin, owner) have all permissions
    if (role.level >= 2) {
      return next();
    }

    // System role level 1 (manager) — has read/write on most entities
    if (role.level === 1) {
      const managerDenied = [
        { entity: 'teams', actions: ['delete', 'manage'] },
        { entity: 'roles', actions: ['write', 'delete', 'manage'] },
        { entity: 'permissions', actions: ['write', 'delete', 'manage'] },
        { entity: 'billing', actions: ['manage'] },
      ];

      const denied = managerDenied.some(
        (rule) => rule.entity === entity && rule.actions.includes(action),
      );

      if (denied) {
        return res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission denied: ${entity}:${action}`,
        });
      }

      return next();
    }

    // Custom roles — explicit permission check
    if (role.permissions) {
      const entityPermissions = role.permissions[entity];
      if (entityPermissions && entityPermissions.includes(action)) {
        return next();
      }
    }

    // API token scope intersection
    if (user.isApiToken && user.apiTokenScopes) {
      const tokenScope = user.apiTokenScopes.find((s) => s.entity === entity);
      if (tokenScope && tokenScope.actions.includes(action)) {
        return next();
      }
    }

    return res.status(403).json({
      error: 'INSUFFICIENT_PERMISSIONS',
      message: `Permission denied: ${entity}:${action}`,
    });
  };
}

// ---------------------------------------------------------------------------
// Team selection & access middleware
// ---------------------------------------------------------------------------

/**
 * Ensures req.user has a selected team (selectedTeamId).
 */
export function requireTeamSelection() {
  return (req, res, next) => {
    const teamId =
      req.user?.selectedTeamId ?? req.headers['x-selected-team'];

    if (!teamId) {
      return res.status(400).json({
        error: 'TEAM_NOT_SELECTED',
        message: 'A team must be selected to access this resource',
      });
    }

    // Normalise onto req for downstream use
    req.teamId = teamId;
    if (req.user) {
      req.user.selectedTeamId = teamId;
    }

    next();
  };
}

/**
 * Verifies the authenticated user is a member of the selected team.
 */
export function requireTeamAccess() {
  return async (req, res, next) => {
    const teamId = req.teamId ?? req.user?.selectedTeamId;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Team access check failed — missing team or user',
      });
    }

    try {
      if (!_systemDb) {
        return next(); // Graceful degradation if permissions not yet initialised
      }

      const members = _systemDb.collection('team_members');
      const membership = await members.findOne({
        teamId,
        userId,
        status: { $in: ['active', 'invited'] },
      });

      if (!membership) {
        return res.status(403).json({
          error: 'TEAM_ACCESS_DENIED',
          message: 'You are not a member of this team',
        });
      }

      // Attach role from membership for downstream permission checks
      if (req.user && membership.role) {
        req.user.teamRole = membership.role;
        req.user.role = membership.role;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Scope filter middleware (ABAC)
// ---------------------------------------------------------------------------

/**
 * Sets `req.scopeFilter` to either `'all'` or `'my'` based on the user's
 * role scope for the given entity. Services use this to filter queries:
 *
 *   const filter = req.scopeFilter === 'my' ? { createdBy: req.user.id } : {};
 */
export function requireScopeFilter(entity) {
  return (req, _res, next) => {
    const roleName = req.user?.role ?? req.user?.teamRole;
    const role = _rolesCache.get(roleName);

    if (!role) {
      req.scopeFilter = ScopeTypes.MY; // Safe default
      return next();
    }

    // Check entity-specific scope override first
    if (role.scopeOverrides && role.scopeOverrides[entity]) {
      req.scopeFilter = role.scopeOverrides[entity];
    } else {
      req.scopeFilter = role.defaultScope ?? ScopeTypes.MY;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Resource Access Resolver (ReBAC)
// ---------------------------------------------------------------------------

/**
 * Service-layer class for evaluating per-resource effective access.
 *
 * Usage:
 *   const resolver = new ResourceAccessResolver(teamId);
 *   const access = await resolver.resolveEffectiveAccess({ subjectType, subjectId, resourceType, resourceId });
 */
export class ResourceAccessResolver {
  #teamId;

  constructor(teamId) {
    this.#teamId = teamId;
  }

  /**
   * Resolve the effective access level for a subject on a resource.
   *
   * Resolution order:
   *   1. Direct rule on the resource
   *   2. Inherited rule from parent resource (via ResourceInheritance)
   *   3. Default: AccessLevels.DENIED
   *
   * Conflict resolution: DENIED wins over all other levels.
   */
  async resolveEffectiveAccess({ subjectType, subjectId, resourceType, resourceId }) {
    if (!_systemDb) {
      return AccessLevels.DENIED;
    }

    const rulesCollection = _systemDb.collection('resource_access_rules');

    // Fetch all applicable rules for this subject + resource
    const rules = await rulesCollection
      .find({
        $or: [
          { subjectType, subjectId, resourceType, resourceId },
          // Include parent resource rules for inheritance
          ...(ResourceInheritance[resourceType]
            ? [
                {
                  subjectType,
                  subjectId,
                  resourceType: ResourceInheritance[resourceType],
                  resourceId,
                },
              ]
            : []),
        ],
      })
      .toArray();

    if (rules.length === 0) {
      return AccessLevels.DENIED;
    }

    // DENIED always wins
    if (rules.some((r) => r.accessLevel === AccessLevels.DENIED)) {
      return AccessLevels.DENIED;
    }

    // Return highest priority non-denied level
    let best = AccessLevels.READ;
    let bestPriority = AccessLevelPriority[best];

    for (const rule of rules) {
      const priority = AccessLevelPriority[rule.accessLevel] ?? 0;
      if (priority > bestPriority) {
        best = rule.accessLevel;
        bestPriority = priority;
      }
    }

    return best;
  }

  /**
   * List all resource IDs the subject has access to (above DENIED).
   */
  async listAccessible({ subjectType, subjectId, resourceType }) {
    if (!_systemDb) {
      return [];
    }

    const rulesCollection = _systemDb.collection('resource_access_rules');

    const rules = await rulesCollection
      .find({
        subjectType,
        subjectId,
        resourceType,
        accessLevel: { $ne: AccessLevels.DENIED },
      })
      .toArray();

    return rules.map((r) => r.resourceId);
  }
}
