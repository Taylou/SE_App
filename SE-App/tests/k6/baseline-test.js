/**
 * k6 Baseline Load Test
 * ─────────────────────
 * Simulates 10 concurrent users hitting the Tasks API for 30 seconds.
 *
 * Run:   k6 run tests/k6/baseline-test.js
 *
 * What to observe:
 *   - p(95) response time   → should stay below 200ms
 *   - http_req_failed rate  → should stay below 1%
 *   - Throughput (req/s)    → steady if the server is healthy
 *
 * Discussion questions after running:
 *   1. Does this look healthy? Why or why not?
 *   2. What does p(95) mean for the users NOT in that 95%?
 *   3. Is 350 req/s good? What would the right number be for your app?
 *   4. How realistic is this user session? What's missing?
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

// ─── Configuration ────────────────────────────────────────────────────────────

// BASE_URL can be overridden with:  k6 run -e BASE_URL=http://myserver baseline-test.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ─── Test Options ─────────────────────────────────────────────────────────────

export const options = {
  // 10 virtual users run simultaneously for 30 seconds.
  // Each VU loops through the `default` function below as fast as it can
  // (respecting the sleep() calls we add to simulate realistic think time).
  vus: 10,
  duration: '30s',

  thresholds: {
    // p(95) < 200  means: "95% of all requests must complete in under 200ms."
    // The slowest 5% are allowed to be slower — but if p95 itself exceeds 200ms,
    // something is wrong and k6 will mark this threshold as FAILED.
    // 200ms is our Service Level Objective (SLO) for this API.
    http_req_duration: ['p(95)<200'],

    // rate < 0.01 means: fewer than 1% of HTTP requests can return an error.
    // k6 counts 4xx and 5xx responses as failures.
    http_req_failed: ['rate<0.01'],
  },
};

// ─── Payload Variety ──────────────────────────────────────────────────────────
// Using random titles/priorities prevents all 10 VUs from sending the exact same
// request at the same time — more realistic, and avoids artificial cache hits.

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
// k6 calls this function in a tight loop for each virtual user.
// One call = one "iteration" = one simulated user session.

export default function () {

  // ── Step 1: Browse the task list ──────────────────────────────────────────
  // Simulates a user opening the app and loading their tasks.
  const listRes = http.get(`${BASE_URL}/tasks`);

  // check() verifies the response and records pass/fail counts.
  // Failed checks count toward the http_req_failed metric.
  check(listRes, {
    'GET /tasks → status 200': (r) => r.status === 200,
    'GET /tasks → returns array': (r) => Array.isArray(r.json()),
  });

  // sleep() simulates "think time" — the time a real user spends reading the
  // list before doing anything. Without sleep, k6 would hammer at wire speed,
  // which doesn't model real user behaviour.
  sleep(0.5);

  // ── Step 2: Create a task ──────────────────────────────────────────────────
  // Simulates a user adding a new task to their list.
  const payload = JSON.stringify({
    title:       randomItem(TASK_TITLES),
    description: 'Created by k6 load test',
    priority:    randomItem(PRIORITIES),
  });

  const createRes = http.post(`${BASE_URL}/tasks`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const createPassed = check(createRes, {
    'POST /tasks → status 201': (r) => r.status === 201,
    'POST /tasks → has id':     (r) => r.json('id') !== undefined,
  });

  // Extract the new task's ID so we can complete it in the next step.
  // If the create failed, taskId will be null and we'll skip step 3.
  const taskId = createPassed ? createRes.json('id') : null;

  sleep(0.3);

  // ── Step 3: Complete the task ──────────────────────────────────────────────
  // Simulates the user ticking off the task they just created.
  // This creates a realistic read → write → mutate lifecycle per iteration.
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
