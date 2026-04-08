/**
 * Permission system type definitions.
 *
 * Placeholder tokens:
 *   piece     — npm scope, e.g. @acme
 *   koza-studio  — project slug, e.g. acme-app
 *   koza-studio        — subject prefix used in NATS / cache keys
 */

// ---------------------------------------------------------------------------
// RBAC — entities & actions
// ---------------------------------------------------------------------------

export const SystemEntities = Object.freeze({
  USERS: 'users',
  TEAMS: 'teams',
  FLOWS: 'flows',
  FLOW_GROUPS: 'flow_groups',
  FLOW_VERSIONS: 'flow_versions',
  DATABASES: 'databases',
  TABLES: 'tables',
  CHANNELS: 'channels',
  INTEGRATIONS: 'integrations',
  CHATS: 'chats',
  CHAT_GROUPS: 'chat_groups',
  AI_AGENTS: 'ai_agents',
  AI_KNOWLEDGE: 'ai_knowledge',
  KNOWLEDGE_BASES: 'knowledge_bases',
  MARKETPLACE: 'marketplace',
  BILLING: 'billing',
  SECRETS: 'secrets',
  EVENTS: 'events',
  MEDIA: 'media',
  DRIVES: 'drives',
  REPOSITORIES: 'repositories',
  SESSIONS: 'sessions',
  NOTIFICATIONS: 'notifications',
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  INTERNAL_CHATS: 'internal_chats',
  TAGS: 'tags',
  MCP: 'mcp',
  API_TOKENS: 'api_tokens',
  TASKS: 'tasks',
  TASK_TEMPLATES: 'task_templates',
});

export const Actions = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  MANAGE: 'manage',
  EXPORT: 'export',
});

// ---------------------------------------------------------------------------
// Scope-based access (ABAC)
// ---------------------------------------------------------------------------

export const ScopeTypes = Object.freeze({
  ALL: 'all',
  MY: 'my',
});

// ---------------------------------------------------------------------------
// System roles — hierarchical (higher level ⊃ lower level permissions)
// ---------------------------------------------------------------------------

export const SystemRoles = Object.freeze({
  OWNER: {
    name: 'owner',
    level: 3,
    defaultScope: ScopeTypes.ALL,
    description: 'Full access including billing and team deletion',
  },
  ADMIN: {
    name: 'admin',
    level: 2,
    defaultScope: ScopeTypes.ALL,
    description: 'Manage users, settings, and all content',
  },
  MANAGER: {
    name: 'manager',
    level: 1,
    defaultScope: ScopeTypes.MY,
    description: 'Manage own content, limited team management',
    scopeOverrides: {
      [SystemEntities.SESSIONS]: ScopeTypes.MY,
    },
  },
});

// ---------------------------------------------------------------------------
// Resource-based access control (ReBAC)
// ---------------------------------------------------------------------------

export const SubjectTypes = Object.freeze({
  USER: 'user',
  ROLE: 'role',
  AGENT: 'agent',
});

export const ResourceTypes = Object.freeze({
  KNOWLEDGE_BASE: 'knowledge_base',
  KNOWLEDGE_CATEGORY: 'knowledge_category',
  DRIVE: 'drive',
  FOLDER: 'folder',
  DATABASE: 'database',
  TABLE: 'table',
  REPOSITORY: 'repository',
  SECRET: 'secret',
});

export const AccessLevels = Object.freeze({
  FULL: 'full',
  WRITE: 'write',
  READ: 'read',
  DENIED: 'denied',
});

/**
 * Inheritance map — child resource type → parent resource type.
 * When evaluating effective access, if no rule exists for the child,
 * the parent's rule is inherited.
 */
export const ResourceInheritance = Object.freeze({
  [ResourceTypes.KNOWLEDGE_CATEGORY]: ResourceTypes.KNOWLEDGE_BASE,
  [ResourceTypes.FOLDER]: ResourceTypes.DRIVE,
  [ResourceTypes.TABLE]: ResourceTypes.DATABASE,
});

/**
 * Access level priority (higher number wins in same-subject resolution,
 * but DENIED always wins across all subjects).
 */
export const AccessLevelPriority = Object.freeze({
  [AccessLevels.DENIED]: 100,
  [AccessLevels.READ]: 1,
  [AccessLevels.WRITE]: 2,
  [AccessLevels.FULL]: 3,
});
