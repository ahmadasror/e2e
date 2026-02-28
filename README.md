# E2E Dashboard

A lightweight dashboard for monitoring end-to-end test results across multiple projects. Built with Express and PostgreSQL — no build step required.

## Features

- Multi-project support with per-project test history
- 3-level navigation: Projects → Event History → Suite Detail
- Per-suite test case breakdown with pass/fail/skip status
- Event-based grouping (one push = one event with multiple suites)
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
    "project_name": "my-app",
    "suite_name": "auth",
    "total": 12,
    "passed": 11,
    "failed": 1,
    "cases": [
      { "case_name": "login with valid credentials", "status": "pass" },
      { "case_name": "login with invalid password", "status": "fail", "error_message": "Expected 401, got 200" }
    ]
  }'
```

### Multiple suites in one event

```sh
curl -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "my-app",
    "event_name": "CI - main branch",
    "trigger": "push",
    "suites": [
      { "suite_name": "auth", "total": 10, "passed": 10, "failed": 0 },
      { "suite_name": "checkout", "total": 8, "passed": 7, "failed": 1 }
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
| `POST` | `/api/results` | Submit test results |
| `GET` | `/api/events?project_id=` | Event history for a project (max 5) |
| `GET` | `/api/events/:id` | Event detail with suites and cases |
| `GET` | `/api/results/:id/cases` | Test cases for a suite run |
| `GET` | `/api/summary` | Aggregated stats |

Full interactive docs at `/api-docs`.

## Project Structure

```
server.js            Express server, DB init, all API routes
public/index.html    Frontend (vanilla JS, all inline, no build)
swagger.json         OpenAPI spec for Swagger UI
e2e/post-results.js  Script to post sample test results
.env.example         Environment variable template
```
