# Testing Guide

## Framework

**Vitest** 3.x with workspace projects. All tests use ES modules natively.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all tests (via Nx) |
| `pnpm exec vitest run` | Run all tests directly |
| `pnpm exec vitest run --project '{name}'` | Run tests for a specific project |
| `pnpm exec vitest --watch` | Run tests in watch mode |

Run tests for a specific service:

```bash
pnpm exec vitest run apps/backend/{service-name}/
pnpm exec vitest run --project '{service-name}'
```

## Architecture

Vitest workspace config in root `vitest.config.js`:

```javascript
export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.js',
      'apps/backend/*/vitest.config.js',
      'apps/frontend/*/vitest.config.js',
      'tools/*/vitest.config.js',
    ],
  },
});
```

Each project has its own `vitest.config.js`. Shared utilities in `packages/test-utils/`.

## Test File Locations

Tests live in `__tests__/` directories:

```
apps/backend/{service}/src/
  services/__tests__/           # Service layer unit tests
  models/__tests__/             # Model/data layer tests
  utils/__tests__/              # Utility tests
apps/frontend/platform/src/
  shared/utils/__tests__/       # Shared utility tests
  features/**/components/__tests__/  # Component tests
packages/{package}/src/__tests__/   # Package unit tests
```

Pattern: `*.test.js` files.

## Backend Test Pattern

Standard mock setup:

```javascript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock packages BEFORE imports
vi.mock('piece/multitenancy', () => ({
  getSystemCollection: vi.fn(() => mockCollection),
  getGlobalSystemCollection: vi.fn(() => mockCollection),
}));

vi.mock('piece/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    createComponentLogger: vi.fn(() => ({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    })),
  })),
}));

vi.mock('piece/validation/mongo', () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() || id),
    isValid: vi.fn(() => true),
  },
}));

// Import service AFTER mocks
const { default: myService } = await import('../myService.js');
```

### MongoDB Mock Pattern

```javascript
const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockInsertOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockToArray = vi.fn();
const mockSort = vi.fn(() => ({ limit: vi.fn(() => ({ toArray: mockToArray })), toArray: mockToArray }));

const mockCollection = {
  findOne: mockFindOne,
  find: mockFind.mockReturnValue({ sort: mockSort }),
  insertOne: mockInsertOne,
  updateOne: mockUpdateOne,
  countDocuments: vi.fn(),
};
```

### NATS/PubSub Mock

```javascript
vi.mock('piece/pubsub', () => ({
  publishEvent: vi.fn().mockResolvedValue(1),
  subscribe: vi.fn().mockResolvedValue({ stop: vi.fn() }),
  initializePubSub: vi.fn().mockResolvedValue({}),
  subjects: {
    messageInbound: (id) => `{prefix}.msg.inbound.${id}`,
    messageOutbound: (id) => `{prefix}.msg.outbound.${id}`,
  },
}));
```

## Frontend Test Pattern

Frontend tests use jsdom environment with `@testing-library/react`:

```javascript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent.jsx';

describe('MyComponent', () => {
  it('should render title', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Vitest Config per Service

```javascript
import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

export default mergeConfig(shared, defineConfig({
  test: {
    name: '{service-name}',
    include: ['src/**/__tests__/**/*.test.js'],
    testTimeout: 10000,
  },
}));
```

## E2E Testing (Playwright)

```
tests/e2e/
  helpers/
    auth-utils.js     # Login helpers
    api.js            # API client for test data
  tests/
    01-auth.spec.js   # Auth flows
    02-team.spec.js   # Team management
  playwright.config.js
```

### E2E Listener Leak Prevention

Playwright `page.on()` listeners MUST be cleaned up:

```javascript
const onConsole = (msg) => { /* ... */ };
page.on('console', onConsole);

try {
  // test logic
} finally {
  page.removeListener('console', onConsole);
}
```

## Anti-patterns

- **NEVER** skip tests with `.skip` without a documented reason
- **NEVER** leave `.only` in committed code
- **NEVER** use Jest -- all tests use Vitest
- **NEVER** import modules before `vi.mock()` calls -- mocks must be set up first
- **NEVER** use real API keys or secrets in tests
- **NEVER** mock entire services -- mock only external boundaries (DB, PubSub, HTTP)
- **NEVER** depend on test execution order -- each test must be independent
