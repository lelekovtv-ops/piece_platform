import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginFailures = new Counter('login_failures');
const wsConnections = new Counter('ws_connections');
const wsErrors = new Counter('ws_errors');
const apiErrors = new Rate('api_errors');
const projectLoadTime = new Trend('project_load_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4030';
const WS_URL = __ENV.WS_URL || 'ws://localhost:4031';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@example.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest123!';

// Load test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Ramp up to 1000 concurrent users
    sustained_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // Warm up
        { duration: '3m', target: 500 },   // Ramp to 500
        { duration: '5m', target: 1000 },  // Ramp to 1000
        { duration: '10m', target: 1000 }, // Sustain 1000
        { duration: '3m', target: 500 },   // Scale down
        { duration: '2m', target: 0 },     // Cool down
      ],
      exec: 'authenticatedUserFlow',
    },

    // Scenario 2: Auth endpoint stress test
    auth_stress: {
      executor: 'constant-arrival-rate',
      rate: 50,            // 50 requests per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      exec: 'authFlow',
    },

    // Scenario 3: WebSocket connections
    websocket_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '5m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 },
      ],
      exec: 'websocketFlow',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],  // 95th < 500ms, 99th < 2s
    http_req_failed: ['rate<0.05'],                    // < 5% error rate
    api_errors: ['rate<0.05'],
    login_failures: ['count<50'],
    ws_errors: ['count<100'],
    iteration_duration: ['p(95)<10000'],               // Full iteration < 10s
  },
};

// Helper: Login and get token
function login() {
  const vuId = __VU;
  const email = `loadtest+vu${vuId}@example.com`;

  const res = http.post(`${BASE_URL}/v1/auth/login`, JSON.stringify({
    email,
    password: TEST_PASSWORD,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' },
  });

  if (res.status !== 200) {
    loginFailures.add(1);
    return null;
  }

  const body = res.json();
  return {
    token: body.accessToken,
    teamId: body.user?.teams?.[0]?.id || 'default-team',
  };
}

// Scenario 1: Full authenticated user flow
export function authenticatedUserFlow() {
  const session = login();
  if (!session) {
    sleep(1);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.token}`,
    'x-selected-team': session.teamId,
  };

  group('Profile', () => {
    const me = http.get(`${BASE_URL}/v1/auth/me`, { headers, tags: { name: 'get_me' } });
    check(me, { 'profile loaded': (r) => r.status === 200 });
    apiErrors.add(me.status >= 400 ? 1 : 0);
  });

  group('Teams', () => {
    const teams = http.get(`${BASE_URL}/v1/teams`, { headers, tags: { name: 'list_teams' } });
    check(teams, { 'teams listed': (r) => r.status === 200 });
    apiErrors.add(teams.status >= 400 ? 1 : 0);
  });

  group('Projects', () => {
    const start = Date.now();
    const projects = http.get(`${BASE_URL}/v1/projects`, { headers, tags: { name: 'list_projects' } });
    projectLoadTime.add(Date.now() - start);
    check(projects, { 'projects listed': (r) => r.status === 200 });
    apiErrors.add(projects.status >= 400 ? 1 : 0);

    // If projects exist, load the first one
    if (projects.status === 200) {
      const body = projects.json();
      const projectList = body.data || body;
      if (Array.isArray(projectList) && projectList.length > 0) {
        const projectId = projectList[0].id;

        // Load project details
        const detail = http.get(`${BASE_URL}/v1/projects/${projectId}`, {
          headers,
          tags: { name: 'get_project' },
        });
        check(detail, { 'project loaded': (r) => r.status === 200 });

        // Load screenplay blocks
        const blocks = http.get(`${BASE_URL}/v1/projects/${projectId}/blocks`, {
          headers,
          tags: { name: 'get_blocks' },
        });
        check(blocks, { 'blocks loaded': (r) => r.status === 200 });

        // Load rundown
        const rundown = http.get(`${BASE_URL}/v1/projects/${projectId}/rundown`, {
          headers,
          tags: { name: 'get_rundown' },
        });
        check(rundown, { 'rundown loaded': (r) => r.status === 200 });

        // Load bible characters
        const characters = http.get(`${BASE_URL}/v1/projects/${projectId}/bible/characters`, {
          headers,
          tags: { name: 'get_characters' },
        });
        check(characters, { 'characters loaded': (r) => r.status === 200 });
      }
    }
  });

  sleep(Math.random() * 3 + 1); // Think time 1-4s
}

// Scenario 2: Auth flow stress test
export function authFlow() {
  const vuId = __VU;
  const iterationId = __ITER;

  group('Register or Login', () => {
    const res = http.post(`${BASE_URL}/v1/auth/login`, JSON.stringify({
      email: `stresstest+${vuId}_${iterationId}@example.com`,
      password: TEST_PASSWORD,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_stress_login' },
    });

    check(res, {
      'auth response received': (r) => r.status === 200 || r.status === 401 || r.status === 429,
      'not rate limited': (r) => r.status !== 429,
    });

    if (res.status === 429) {
      sleep(5); // Back off on rate limit
    }
  });

  sleep(0.5);
}

// Scenario 3: WebSocket connections
export function websocketFlow() {
  const session = login();
  if (!session) {
    sleep(2);
    return;
  }

  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket&token=${session.token}`;

  const res = ws.connect(url, {}, function (socket) {
    wsConnections.add(1);

    socket.on('open', () => {
      // Send Socket.IO handshake
      socket.send('40');
    });

    socket.on('message', (data) => {
      // Handle Socket.IO ping
      if (data === '2') {
        socket.send('3'); // Pong
      }
    });

    socket.on('error', () => {
      wsErrors.add(1);
    });

    // Keep connection alive for 30-60 seconds
    sleep(Math.random() * 30 + 30);
    socket.close();
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 });
}

// Health check (run before main test)
export function setup() {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'service is healthy': (r) => r.status === 200,
  });

  if (health.status !== 200) {
    throw new Error(`Service unhealthy: ${health.status} ${health.body}`);
  }

  console.log(`Target: ${BASE_URL}`);
  console.log(`Health: ${health.json().status}`);
}
