# Test Suite Dashboard

A lightweight dashboard for monitoring test suite results. Built with Express and PostgreSQL.

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

   The dashboard will be available at `http://localhost:3000`.

   Interactive API documentation (Swagger UI) is available at `http://localhost:3000/api-docs`.

## Environment Variables

| Variable       | Default                                       | Description              |
| -------------- | --------------------------------------------- | ------------------------ |
| `DATABASE_URL` | `postgresql://localhost:5432/test_dashboard`   | PostgreSQL connection URL |
| `PORT`         | `3000`                                        | Server port              |

## API

### `POST /api/results`

Submit a test run.

```json
{
  "suite_name": "auth",
  "total": 12,
  "passed": 12,
  "failed": 0
}
```

Returns `201` with `{ "id": <number> }`.

### `GET /api/results?limit=20`

Returns recent test runs (max 100), ordered by most recent first.

### `GET /api/summary`

Returns aggregated stats across all runs:

```json
{
  "run_count": 5,
  "total_tests": 61,
  "total_passed": 56,
  "total_failed": 5
}
```

## E2E Test Script

Post sample data to a running server:

```sh
npm run post-results
```

## Project Structure

```
server.js            Express server + PostgreSQL setup
public/index.html    Dashboard frontend (auto-refreshes every 5s)
e2e/post-results.js  Script to post dummy test results
.env.example         Environment variable template
```
