/**
 * Tasks API Server
 *
 * A simple Express REST API that mirrors the data model in models/task.ts.
 * Used as the target for k6 load testing demos.
 *
 * Usage:
 *   Normal mode:  node server.js
 *   Slow mode:    SLOW_MODE=true node server.js    (Mac/Linux)
 *                 set SLOW_MODE=true && node server.js  (Windows cmd)
 *   Or via npm:   npm run server
 *                 npm run server:slow
 */

const express = require('express');
const cors = require('cors');

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT           = parseInt(process.env.PORT           || '3000', 10);
const LATENCY_MS     = parseInt(process.env.LATENCY_MS     || '10',   10);
const SLOW_MODE      = process.env.SLOW_MODE === 'true';
const SLOW_LATENCY_MS= parseInt(process.env.SLOW_LATENCY_MS|| '70',   10);
const SLOW_ERROR_RATE= parseFloat(process.env.SLOW_ERROR_RATE || '0.05');

// ─── In-Memory Store ──────────────────────────────────────────────────────────
// Mirrors InMemoryTaskRepository from repositories/task-repository.ts

/** @type {Map<string, object>} */
const tasks = new Map();
let nextId = 1;

function generateId() {
  return String(nextId++);
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
// Pre-load 5 tasks so GET /tasks returns real data from the very first k6 iteration.

const SEED_TASKS = [
  { title: 'Set up CI pipeline',         description: 'Configure GitHub Actions',        priority: 'high'   },
  { title: 'Write unit tests',            description: 'Cover core service methods',      priority: 'high'   },
  { title: 'Update API documentation',    description: 'Document all endpoints',          priority: 'medium' },
  { title: 'Review open pull requests',   description: 'Team code review session',        priority: 'medium' },
  { title: 'Refactor task repository',    description: 'Extract interface for DB layer',  priority: 'low'    },
];

for (const seed of SEED_TASKS) {
  const id = generateId();
  tasks.set(id, {
    id,
    title:       seed.title,
    description: seed.description,
    priority:    seed.priority,
    status:      'active',
    createdAt:   new Date().toISOString(),
    completedAt: null,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simulates network/processing latency — and in slow mode, randomly injects
 * 503 errors to simulate a degraded backend (e.g. database overload).
 *
 * Returns true if the request should continue, false if a 503 was sent.
 *
 * @param {import('express').Response} res
 * @returns {Promise<boolean>}
 */
async function simulateLatency(res) {
  if (SLOW_MODE && Math.random() < SLOW_ERROR_RATE) {
    res.status(503).json({ error: 'Service temporarily unavailable' });
    return false;
  }
  const ms = SLOW_MODE ? SLOW_LATENCY_MS : LATENCY_MS;
  await new Promise(r => setTimeout(r, ms));
  return true;
}

const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.json());

// Request logger: prints METHOD /path STATUS Xms to stdout.
// Students can watch requests arrive during k6 runs.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /health
// Quick liveness check — shows uptime, task count, and current server mode.
app.get('/health', async (req, res) => {
  const ok = await simulateLatency(res);
  if (!ok) return;

  res.json({
    status:    'ok',
    uptime:    Math.floor(process.uptime()),
    taskCount: tasks.size,
    mode:      SLOW_MODE ? 'SLOW' : 'NORMAL',
  });
});

// GET /tasks
// Returns all tasks as an array. Mirrors repository.getAll().
app.get('/tasks', async (req, res) => {
  const ok = await simulateLatency(res);
  if (!ok) return;

  res.json(Array.from(tasks.values()));
});

// POST /tasks
// Creates a new task. Body: { title, description?, priority }
// Mirrors taskService.createTask() / repository.create().
app.post('/tasks', async (req, res) => {
  const ok = await simulateLatency(res);
  if (!ok) return;

  const { title, description = '', priority } = req.body || {};

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!VALID_PRIORITIES.has(priority)) {
    return res.status(400).json({ error: 'priority must be one of: low, medium, high' });
  }

  const id = generateId();
  const task = {
    id,
    title:       title.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    priority,
    status:      'active',
    createdAt:   new Date().toISOString(),
    completedAt: null,
  };

  tasks.set(id, task);
  res.status(201).json(task);
});

// PATCH /tasks/:id/complete
// Marks a task as completed. Mirrors taskService.completeTask().
// Always sets to completed (idempotent — completing a completed task is fine).
app.patch('/tasks/:id/complete', async (req, res) => {
  const ok = await simulateLatency(res);
  if (!ok) return;

  const task = tasks.get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const updated = { ...task, status: 'completed', completedAt: new Date().toISOString() };
  tasks.set(req.params.id, updated);
  res.json(updated);
});

// DELETE /tasks/:id
// Removes a task. Returns 204 on success, 404 if not found.
// Mirrors taskService.deleteTask() / repository.delete().
app.delete('/tasks/:id', async (req, res) => {
  const ok = await simulateLatency(res);
  if (!ok) return;

  if (!tasks.has(req.params.id)) {
    return res.status(404).json({ error: 'Task not found' });
  }

  tasks.delete(req.params.id);
  res.status(204).send();
});

// 404 for unrecognised routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const modeLabel   = SLOW_MODE ? `SLOW  (latency: ${SLOW_LATENCY_MS}ms, error rate: ${(SLOW_ERROR_RATE * 100).toFixed(0)}%)` : `NORMAL (latency: ${LATENCY_MS}ms)`;
  const base        = `http://localhost:${8081}`;

  console.log('');
  console.log('==============================================');
  console.log('  Tasks API Server');
  console.log('==============================================');
  console.log(`  Port:     ${PORT}`);
  console.log(`  Mode:     ${modeLabel}`);
  console.log(`  Seeded:   ${SEED_TASKS.length} tasks`);
  console.log('==============================================');
  console.log('  Endpoints:');
  console.log(`    GET    ${base}/health`);
  console.log(`    GET    ${base}/tasks`);
  console.log(`    POST   ${base}/tasks`);
  console.log(`    PATCH  ${base}/tasks/:id/complete`);
  console.log(`    DELETE ${base}/tasks/:id`);
  console.log('==============================================');
  console.log('');
});
