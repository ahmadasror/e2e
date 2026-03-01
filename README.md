# E2E Dashboard

A lightweight dashboard for monitoring end-to-end test results across multiple projects. Built with Express and PostgreSQL — no build step required.

## Features

- Multi-project support with per-project test history
- 3-level navigation: Projects → Event History → Suite Detail
- Per-suite test case breakdown with pass/fail/skip status
- Event-based grouping (one submission = one event with multiple suites)
- Optional `description` field to annotate the purpose of each test run
- Retains up to **15 events** per project (oldest auto-deleted)
- Auto-refresh every 10 seconds
- Interactive API docs via Swagger UI

## Prerequisites

- Node.js >= 18
- PostgreSQL

## Setup

1. Create the database:

   ```sh
   createdb test_dashboard
   ```

2. Copy the environment template and adjust if needed:

   ```sh
   cp .env.example .env
   ```

3. Install dependencies:

   ```sh
   npm install
   ```

4. Start the server:

   ```sh
   npm start
   ```

   Dashboard: `http://localhost:3000`
   API docs: `http://localhost:3000/api-docs`

## Environment Variables

| Variable       | Default                                      | Description               |
| -------------- | -------------------------------------------- | ------------------------- |
| `DATABASE_URL` | `postgresql://localhost:5432/test_dashboard` | PostgreSQL connection URL |
| `PORT`         | `3000`                                       | Server port               |

## Sending Test Results

### Single suite

```sh
curl -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "manajemen-distrik",
    "event_name": "Sanity Check",
    "description": "Quick smoke test after deployment",
    "trigger": "manual",
    "suite_name": "01-login",
    "total": 10,
    "passed": 10,
    "failed": 0,
    "cases": [
      { "case_id": "1.1", "case_name": "Login with valid credentials", "module": "auth", "type": "positive", "status": "pass", "duration_ms": 120 }
    ]
  }'
```

### Multiple suites in one event

```sh
curl -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "manajemen-distrik",
    "event_name": "E2E Run 2026-03-01",
    "description": "E2E testing case untuk improvement management wilayah",
    "trigger": "ci",
    "suites": [
      { "suite_name": "01-login", "total": 10, "passed": 10, "failed": 0 },
      { "suite_name": "04-audit-trail", "total": 7, "passed": 7, "failed": 0 },
      { "suite_name": "06-access-control", "total": 8, "passed": 7, "failed": 1 }
    ]
  }'
```

### Using `npm run post-results`

Post sample data to a running server:

```sh
npm run post-results
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects/overview` | All projects with latest event stats |
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Register a new project |
| `POST` | `/api/results` | Submit test results (single or multi-suite) |
| `GET` | `/api/events?project_id=` | Event history for a project (max 15) |
| `GET` | `/api/events/:id` | Event detail with suites and cases |
| `GET` | `/api/results/:id/cases` | Test cases for a suite run |
| `GET` | `/api/summary` | Aggregated stats |
| `GET` | `/api/cases` | Filter test cases globally |

Full interactive docs at `/api-docs`.

## POST /api/results — Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_name` | string | yes* | Auto-creates project if not exists |
| `project_id` | integer | yes* | Use instead of `project_name` |
| `event_name` | string | no | Label for this run. Default: `"Test Run"` |
| `description` | string | no | Short annotation, e.g. `"E2E testing case untuk improvement management wilayah"` |
| `trigger` | string | no | `manual` / `ci` / `scheduled`. Default: `manual` |
| `suites` | array | yes† | Array of suite objects (multi-suite format) |
| `suite_name` | string | yes† | Suite name (single-suite format) |
| `total` | integer | yes† | Total test cases (single-suite format) |
| `passed` | integer | yes† | Passed count (single-suite format) |
| `failed` | integer | yes† | Failed count (single-suite format) |

*one of `project_name` or `project_id` is required
†use either `suites` array **or** `suite_name + total + passed + failed`

## Project Structure

```
server.js            Express server, DB init, all API routes
public/index.html    Frontend (vanilla JS, all inline, no build)
swagger.json         OpenAPI spec for Swagger UI
e2e/post-results.js  Script to post sample test results
.env.example         Environment variable template
```
