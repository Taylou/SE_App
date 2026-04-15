/**
 * k6 Stress Test
 * ──────────────
 * Ramps virtual users from 0 → 100 to find where the API breaks.
 * Uses the SAME operations and thresholds as the baseline test —
 * so the two results are directly comparable.
 *
 * BEFORE running this test:
 *   Stop the server and restart it in slow mode:
 *     Mac/Linux:   SLOW_MODE=true node server.js
 *     Windows cmd: set SLOW_MODE=true && node server.js
 *     npm script:  npm run server:slow
 *
 * Run:   k6 run tests/k6/stress-test.js
 *
 * What to observe:
 *   - Watch p(95) creep up as VUs increase
 *   - Note when the first threshold turns RED
 *   - Compare throughput (req/s) with the baseline — does it scale?
 *   - Check task_creation_errors: do write ops fail before reads?
 *
 * Discussion questions after running:
 *   1. At what VU count did p(95) cross 200ms?
 *   2. The 503 errors were simulated — what causes real 503s?
 *   3. Our bottleneck here is artificial delay. In a real app with a database,
 *      what would the bottleneck be instead?
 *   4. What would you change architecturally to handle 100 VUs cleanly?
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// ─── Custom Metric ────────────────────────────────────────────────────────────
// Track POST /tasks failures separately from GET failures.
// This lets us ask: "did write operations degrade before reads?"
// (Writes are usually more expensive — they touch more code paths.)
const taskCreationErrors = new Rate('task_creation_errors');

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ─── Test Options ─────────────────────────────────────────────────────────────

export const options = {
  // Staged ramp-up: gradually increase load instead of hitting 100 VUs instantly.
  // This mirrors how real traffic grows and lets us pinpoint when degradation starts.
  stages: [
    { duration: '30s', target: 50  }, // Ramp up to 50 VUs over 30 seconds
    { duration: '30s', target: 100 }, // Ramp up to 100 VUs over the next 30 seconds
    { duration: '60s', target: 100 }, // HOLD at 100 VUs for 60 seconds ← teaching moment
    { duration: '30s', target: 0   }, // Ramp back down (lets in-flight requests complete)
  ],
  // Total test duration: ~2.5 minutes

  // SAME thresholds as the baseline test.
  // Under slow-mode load, these WILL fail — that failure is the lesson.
  // In a CI pipeline you'd add --exit-on-threshold-exceeded to fail the build.
  thresholds: {
    http_req_duration: ['p(95)<200'],   // p95 must stay under 200ms
    http_req_failed:   ['rate<0.01'],   // fewer than 1% errors

    // Our custom metric: POST /tasks error rate must also stay under 1%.
    // Watch this vs http_req_failed — if task_creation_errors is higher,
    // writes are failing faster than reads.
    task_creation_errors: ['rate<0.01'],
  },
};

// ─── Payload Variety ──────────────────────────────────────────────────────────

const TASK_TITLES = [
  'Review pull request',
  'Write unit tests',
  'Update documentation',
  'Fix critical bug',
  'Deploy to staging',
  'Team sync meeting',
  'Code refactoring session',
  'Performance profiling',
  'Database migration plan',
  'Security audit',
];

const PRIORITIES = ['low', 'medium', 'high'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Default Function (VU Iteration) ─────────────────────────────────────────
// Identical session to the baseline: browse → create → complete.
// Keeping the same operations means any difference in results is due to load,
// not a change in what we're measuring.

export default function () {

  // ── Step 1: Browse the task list ──────────────────────────────────────────
  const listRes = http.get(`${BASE_URL}/tasks`);

  check(listRes, {
    'GET /tasks → status 200': (r) => r.status === 200,
    'GET /tasks → returns array': (r) => Array.isArray(r.json()),
  });

  sleep(0.5);

  // ── Step 2: Create a task ──────────────────────────────────────────────────
  const payload = JSON.stringify({
    title:       randomItem(TASK_TITLES),
    description: 'Created by k6 stress test',
    priority:    randomItem(PRIORITIES),
  });

  const createRes = http.post(`${BASE_URL}/tasks`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const createOk = createRes.status === 201;

  // Record whether the POST succeeded in our custom metric.
  // true = error (inverted: Rate tracks the "failure" fraction)
  taskCreationErrors.add(!createOk);

  const createPassed = check(createRes, {
    'POST /tasks → status 201': (r) => r.status === 201,
    'POST /tasks → has id':     (r) => r.json('id') !== undefined,
  });

  const taskId = createPassed ? createRes.json('id') : null;

  sleep(0.3);

  // ── Step 3: Complete the task ──────────────────────────────────────────────
  if (taskId) {
    const completeRes = http.patch(`${BASE_URL}/tasks/${taskId}/complete`, null, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(completeRes, {
      'PATCH /tasks/:id/complete → status 200':          (r) => r.status === 200,
      'PATCH /tasks/:id/complete → status is completed': (r) => r.json('status') === 'completed',
    });
  }

  sleep(0.2);
}
