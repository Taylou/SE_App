# Load Testing with k6

> **Goal**: Run two load tests against a real HTTP API, compare the results, and understand what the numbers mean.

---

## What is Load Testing?

Load testing sends many simulated users to your API at the same time to answer questions like:
- How fast does it respond when 10 people use it simultaneously?
- At what point does it start slowing down or returning errors?
- Where is the bottleneck — CPU, memory, database, network?

**k6** is an open-source load testing tool. You write test scripts in JavaScript, run them from the terminal, and get back metrics like response time percentiles and error rates.

---

## Prerequisites

### 1 — Install k6

| Platform | Command |
|----------|---------|
| **macOS** | `brew install k6` |
| **Windows** | `winget install k6 --source winget` |
| **Linux (snap)** | `sudo snap install k6` |
| **Linux (apt)** | See [k6.io/docs/get-started/installation](https://grafana.com/docs/k6/latest/set-up/install-k6/) |

Verify: `k6 version`

### 2 — Install server dependencies

The demo server uses Express. Install it once from the project root:

```bash
npm install
```

---

## Part 1: Setup

### Start the API server

Open a terminal in the project root and run:

```bash
node server.js
```

You should see:

```
==============================================
  Tasks API Server
==============================================
  Port:     3000
  Mode:     NORMAL (latency: 10ms)
  Seeded:   5 tasks
==============================================
  Endpoints:
    GET    http://localhost:3000/health
    GET    http://localhost:3000/tasks
    POST   http://localhost:3000/tasks
    PATCH  http://localhost:3000/tasks/:id/complete
    DELETE http://localhost:3000/tasks/:id
==============================================
```

### Verify it's working

Open a **second terminal** and run:

```bash
# Check the server is alive
curl http://localhost:3000/health

# List the pre-loaded tasks
curl http://localhost:3000/tasks
```

Expected health response:
```json
{
  "status": "ok",
  "uptime": 3,
  "taskCount": 5,
  "mode": "NORMAL"
}
```

You should see 5 seed tasks in the tasks response. If that works, you're ready.

> **No curl?** Use your browser — just visit `http://localhost:3000/tasks`.

---

## Part 2: Understanding the Metrics

Before running k6, know what you're looking at.

### p95 — 95th percentile latency

If p95 = 45ms, it means **95% of requests completed in 45ms or less**. The other 5% took longer.

Think of it as a promise: *"Almost every user gets a response in under 45ms."*

Why not use the average? Because averages hide outliers. If 9 requests take 10ms and 1 takes 500ms, the average is 59ms — which sounds fine. But 10% of your users just waited 500ms. The p95 (and p99) catch those outliers.

### Throughput — requests per second

How many requests the server handled per second. Higher is generally better, but the number that matters is whether throughput stays **stable** under load. If throughput drops as VUs increase, the server is struggling.

### Error rate — % of failed requests

k6 counts any HTTP 4xx or 5xx response as a failure. Our threshold is < 1%. If the error rate climbs, users are seeing errors — that's a broken service.

### Metric Reference Table

| Metric | What it means | Healthy baseline | Warning sign |
|--------|--------------|-----------------|--------------|
| `http_req_duration p(95)` | 95% of requests faster than X | < 200ms | > 500ms |
| `http_req_failed` | % of requests with errors | < 1% | > 5% |
| `http_reqs` | Total requests / second | Stable | Drops under load |
| `iterations` | Full user sessions completed | High | Drops when slow |
| `vus` | Active virtual users | Matches scenario | — |

---

## Part 3: Baseline Test (10 VUs, 30 seconds)

### Run it

Make sure the server is running normally (`node server.js`), then in your second terminal:

```bash
k6 run tests/k6/baseline-test.js
```

Each of the 10 virtual users loops through this session:
1. `GET /tasks` — browse the list
2. `POST /tasks` — create a task
3. `PATCH /tasks/:id/complete` — complete it

### Reading the output

k6 prints a live progress bar while running, then a full summary. Here is what the summary looks like and how to read each line:

```
     ✓ GET /tasks → status 200
     ✓ POST /tasks → status 201
     ✓ PATCH /tasks/:id/complete → status 200

     checks.........................: 100.00% ✓ 840   ✗ 0
     data_received..................: 312 kB  10 kB/s
     data_sent......................: 98 kB   3.3 kB/s
     http_req_blocked...............: avg=12µs  min=0s med=0s   max=1.2ms
     http_req_duration..............: avg=18ms  min=10ms med=14ms max=68ms p(90)=24ms p(95)=31ms
       { expected_response:true }...: avg=18ms  min=10ms med=14ms max=68ms p(90)=24ms p(95)=31ms
     http_req_failed................: 0.00%  ✓ 0     ✗ 840
     http_reqs......................: 840     28/s
     iterations.....................: 280     9.3/s
     vus............................: 10      min=10 max=10
     vus_max........................: 10      min=10 max=10
```

**Key lines to focus on:**

- `http_req_duration p(95)=31ms` → 95% of requests finished in 31ms. Our threshold was 200ms. ✓ PASS
- `http_req_failed 0.00%` → Zero errors. ✓ PASS
- `http_reqs 28/s` → The server handled 28 requests per second steadily
- `iterations 9.3/s` → ~9 full user sessions per second across all 10 VUs

### Expected baseline results

| Metric | Expected range |
|--------|---------------|
| p95 response time | 15ms – 50ms |
| Error rate | 0% |
| Throughput | ~20–50 req/s |
| Threshold status | **PASS** (green checkmarks) |

### Discussion: Does this look healthy?

Take a few minutes to discuss these questions with your group:

1. **"The p95 is 31ms and everything passed. Does that mean this API is production-ready?"**
   - Think about: what load are real users? Are 10 VUs realistic?

2. **"p95 = 31ms — what happened to the 5% of requests that took longer? How would you find out why they were slow?"**
   - Hint: look at the `max` value. What caused those slower requests?

3. **"Throughput is 28 req/s. Is that good or bad?"**
   - Good and bad compared to *what*? What would you need to know to answer this?

4. **"Each 'iteration' simulates one user session. How realistic is it? What's our test missing?"**
   - Think about: authentication, reading/writing large payloads, concurrent competing writes...

---

## Part 4: Stress Test (ramp to 100 VUs)

Now we turn up the pressure. The stress test ramps from 0 → 50 → 100 VUs, holds at 100 VUs for 60 seconds, then ramps back down.

### Step 1 — Enable slow mode

Stop the server with `Ctrl+C`, then restart it in **slow mode**:

```bash
# Mac / Linux
SLOW_MODE=true node server.js

# Windows Command Prompt
set SLOW_MODE=true && node server.js

# Windows PowerShell
$env:SLOW_MODE="true"; node server.js

# Or use the npm script (works on all platforms)
npm run server:slow
```

The banner now shows:
```
  Mode:     SLOW  (latency: 70ms, error rate: 5%)
```

This simulates a degraded backend — like a database under heavy load:
- Every request takes at least **70ms** (instead of 10ms)
- **5% of requests** randomly return `503 Service Unavailable`

### Step 2 — Run the stress test

```bash
k6 run tests/k6/stress-test.js
```

Watch the terminal as it runs. You'll see VUs climb: 50 → 100. During the 60-second hold at 100 VUs is when things get interesting.

### Step 3 — What to watch live

k6 prints a progress line every few seconds:
```
default ↑ [======>-------] 100 VUs  1m30s/2m30s
```

You'll see the live p(95) value update. Watch for the moment it crosses 200ms — that's your threshold breaking.

### Expected stress test results (slow mode)

| Metric | Expected range |
|--------|---------------|
| p95 response time | 150ms – 300ms+ |
| Error rate | ~4–7% |
| Throughput | Drops 40–60% vs baseline |
| Threshold status | **FAIL** (red ✗) |

The k6 summary will show:

```
FAIL http_req_duration............: p(95)=218ms — threshold 'p(95)<200' exceeded
FAIL http_req_failed..............: rate=5.2% — threshold 'rate<0.01' exceeded
FAIL task_creation_errors.........: rate=5.8% — threshold 'rate<0.01' exceeded
```

k6 exits with a non-zero exit code. In CI, this would **fail the build pipeline**.

### What changed? Where did it break?

Compare the two summaries side by side:

| Metric | Baseline (10 VUs) | Stress (100 VUs) | Change |
|--------|------------------|-----------------|--------|
| p95 latency | ~31ms | ~218ms | **+600%** |
| Error rate | 0% | ~5% | **Threshold broken** |
| Throughput | ~28 req/s | ~18 req/s | **Down 35%** |
| Iterations | ~9.3/s | ~6.1/s | **Down 34%** |

**Why did it break?**

1. **Latency rose**: At 100 VUs × 70ms per request, Node.js is processing many concurrent async operations. The event loop queues start backing up, adding queuing delay on top of the 70ms artificial delay.

2. **Error rate spiked**: The 5% random 503 injection simulates a backend that can't keep up (database connection pool exhausted, out of memory, CPU throttled). In real systems this comes from hitting resource limits.

3. **Throughput dropped** even though we had 10× more VUs: more users ≠ more throughput when the server is bottlenecked. The bottleneck absorbs the extra concurrency as latency instead.

**The key insight**: The bottleneck wasn't the Node.js server itself — it was the artificial latency we injected. In a real application, the bottleneck is usually:
- The **database** (most common) — slow queries, connection pool limits
- **External API calls** — third-party services with rate limits
- **CPU-bound work** — image processing, cryptography, report generation
- **Memory pressure** — garbage collection pauses, swap

### Discussion: Going deeper

1. **"task_creation_errors is higher than http_req_failed — what does that tell us?"**
   - Write operations (POST) failed more than reads (GET). Why might writes be more expensive?

2. **"We could handle 10 VUs fine. What would let us handle 100 VUs without degradation?"**
   - Ideas: caching, load balancing, database connection pooling, horizontal scaling, async queues...

3. **"The threshold failed because p95 > 200ms. Who decided 200ms was the limit?"**
   - That was us — in `options.thresholds`. In a real project this comes from a **Service Level Agreement (SLA)** or user research. Where does your organisation's SLO come from?

4. **"In CI, a failed k6 threshold blocks deployment. Is that a good idea?"**
   - When yes? When might it create false alarms?

---

## Part 5: Going Further

### Things to try

- **Change the threshold**: Edit `http_req_duration: ['p(95)<200']` in `baseline-test.js` to `p(95)<500` and re-run. How does the result change? What does it tell you about SLOs?

- **Run without slow mode at 100 VUs**: Run the stress test with the server in normal mode. Does it pass? What does that tell you about where the bottleneck actually is?

- **Add a DELETE step**: Extend the VU iteration to also delete the task after completing it. How does this change the throughput?

- **Increase VUs further**: Edit the stress test stages to go to 200 VUs. At what point does the normal-mode server start struggling?

- **Watch server logs**: While k6 runs, watch the server terminal. You'll see every request logged with its status and timing. Can you spot the 503 errors appearing?

### Real-world connections

| This demo | Real production system |
|-----------|----------------------|
| 70ms artificial delay | Slow database query, external API call |
| 5% random 503s | Connection pool exhausted, memory limit hit |
| In-memory Map | PostgreSQL, MongoDB, Redis |
| 10 VUs | Depends — could be 10 or 10,000 real users |
| p95 < 200ms threshold | Company SLA, user-facing SLO |
| k6 exit code in CI | GitHub Actions / Jenkins build gate |

---

## Metric Glossary

| Term | Definition |
|------|-----------|
| **VU (Virtual User)** | A simulated user running the test script in a loop |
| **Iteration** | One complete run of the `default` function (one user session) |
| **p95 / p99** | The 95th / 99th percentile of a distribution — e.g., p95 latency means 95% of requests were faster than this value |
| **Throughput** | Requests per second the server successfully handled |
| **Error rate** | Fraction of HTTP requests that returned a 4xx or 5xx response |
| **Threshold** | A pass/fail rule defined in `options.thresholds` — if violated, k6 exits with a non-zero code |
| **SLO (Service Level Objective)** | An internal target — "our p95 must be under 200ms" |
| **SLA (Service Level Agreement)** | An external commitment to customers — often backed by an SLO |
| **Ramp-up** | Gradually increasing VUs instead of starting at maximum — mirrors realistic traffic growth |
| **503 Service Unavailable** | HTTP status meaning the server couldn't handle the request — usually a resource limit |
