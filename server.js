require("dotenv").config();
const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/test_dashboard",
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      repo_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      event_name TEXT NOT NULL DEFAULT 'Test Run',
      trigger TEXT NOT NULL DEFAULT 'manual',
      total INTEGER NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      suite_name TEXT NOT NULL,
      total INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      failed INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
      case_id TEXT,
      case_name TEXT NOT NULL,
      description TEXT,
      module TEXT,
      type TEXT CHECK (type IN ('positive', 'negative')),
      status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'skip')),
      error_message TEXT,
      duration_ms INTEGER
    )
  `);

  // Migrations for existing databases
  await pool.query(`
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE
  `);
}

async function pruneEvents(projectId) {
  const result = await pool.query(
    "SELECT id FROM events WHERE project_id = $1 ORDER BY created_at ASC",
    [projectId]
  );
  if (result.rows.length > 5) {
    const idsToDelete = result.rows.slice(0, result.rows.length - 5).map(r => r.id);
    await pool.query("DELETE FROM events WHERE id = ANY($1::int[])", [idsToDelete]);
  }
}

const swaggerUi = require("swagger-ui-express");
const swaggerDoc = require("./swagger.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// POST /api/projects — register a new project
app.post("/api/projects", async (req, res) => {
  const { name, description, repo_url } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Missing required field: name" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO projects (name, description, repo_url) VALUES ($1, $2, $3) RETURNING *",
      [name, description || null, repo_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Project already exists" });
    }
    throw err;
  }
});

// GET /api/projects — list all projects
app.get("/api/projects", async (req, res) => {
  const result = await pool.query("SELECT * FROM projects ORDER BY name");
  res.json(result.rows);
});

// GET /api/projects/overview — projects with latest event stats
app.get("/api/projects/overview", async (req, res) => {
  const result = await pool.query(`
    SELECT p.*,
      e.id AS latest_event_id,
      e.event_name AS latest_event_name,
      e.trigger AS latest_trigger,
      e.total AS latest_total,
      e.passed AS latest_passed,
      e.failed AS latest_failed,
      e.skipped AS latest_skipped,
      e.created_at AS latest_event_at
    FROM projects p
    LEFT JOIN LATERAL (
      SELECT * FROM events WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1
    ) e ON true
    ORDER BY p.name
  `);
  res.json(result.rows);
});

// POST /api/results — receive test results as an event
// Supports two formats:
//   Single suite (backward compat): { suite_name, total, passed, failed, cases, project_id|project_name, event_name?, trigger? }
//   Multi-suite (new):              { suites: [{suite_name, total, passed, failed, cases}], project_id|project_name, event_name?, trigger? }
app.post("/api/results", async (req, res) => {
  const { suite_name, total, passed, failed, project_id, project_name, cases, event_name, trigger, suites } = req.body;

  // Determine which format was used
  let suitesArray;
  if (Array.isArray(suites) && suites.length > 0) {
    suitesArray = suites;
  } else if (suite_name && total != null && passed != null && failed != null) {
    suitesArray = [{ suite_name, total, passed, failed, cases }];
  } else {
    return res.status(400).json({ error: "Missing required fields: provide 'suites' array or 'suite_name, total, passed, failed'" });
  }

  for (const suite of suitesArray) {
    if (!suite.suite_name || suite.total == null || suite.passed == null || suite.failed == null) {
      return res.status(400).json({ error: "Each suite requires: suite_name, total, passed, failed" });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Resolve project (upsert to avoid race conditions)
    let resolvedProjectId = project_id || null;
    if (!resolvedProjectId && project_name) {
      const result = await client.query(
        "INSERT INTO projects (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        [project_name]
      );
      resolvedProjectId = result.rows[0].id;
    }

    // Aggregate stats across all suites for the event record
    const eventTotal = suitesArray.reduce((s, r) => s + Number(r.total), 0);
    const eventPassed = suitesArray.reduce((s, r) => s + Number(r.passed), 0);
    const eventFailed = suitesArray.reduce((s, r) => s + Number(r.failed), 0);
    const eventSkipped = Math.max(0, eventTotal - eventPassed - eventFailed);

    // Create event record
    const eventResult = await client.query(
      `INSERT INTO events (project_id, event_name, trigger, total, passed, failed, skipped)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [resolvedProjectId, event_name || "Test Run", trigger || "manual", eventTotal, eventPassed, eventFailed, eventSkipped]
    );
    const eventId = eventResult.rows[0].id;

    // Insert each suite as a test_run linked to the event
    const runIds = [];
    for (const suite of suitesArray) {
      const runResult = await client.query(
        "INSERT INTO test_runs (suite_name, total, passed, failed, project_id, event_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [suite.suite_name, suite.total, suite.passed, suite.failed, resolvedProjectId, eventId]
      );
      const runId = runResult.rows[0].id;
      runIds.push(runId);

      const suiteCases = Array.isArray(suite.cases) ? suite.cases : [];
      if (suiteCases.length > 0) {
        const values = [];
        const params = [];
        let idx = 1;
        for (const c of suiteCases) {
          values.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8})`);
          params.push(runId, c.case_id || null, c.case_name, c.description || null, c.module || null, c.type || null, c.status, c.error_message || null, c.duration_ms || null);
          idx += 9;
        }
        await client.query(
          `INSERT INTO test_cases (run_id, case_id, case_name, description, module, type, status, error_message, duration_ms) VALUES ${values.join(", ")}`,
          params
        );
      }
    }

    await client.query("COMMIT");

    // Prune oldest events if project now has more than 5
    if (resolvedProjectId) {
      await pruneEvents(resolvedProjectId);
    }

    res.status(201).json({ id: runIds[0], event_id: eventId, run_ids: runIds });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/results error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/results — recent test runs (optionally filtered by project)
app.get("/api/results", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const projectId = req.query.project_id;

  let query, params;
  if (projectId) {
    query = `SELECT tr.*, p.name AS project_name
             FROM test_runs tr
             LEFT JOIN projects p ON p.id = tr.project_id
             WHERE tr.project_id = $1
             ORDER BY tr.created_at DESC LIMIT $2`;
    params = [projectId, limit];
  } else {
    query = `SELECT tr.*, p.name AS project_name
             FROM test_runs tr
             LEFT JOIN projects p ON p.id = tr.project_id
             ORDER BY tr.created_at DESC LIMIT $1`;
    params = [limit];
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// GET /api/results/:id/cases — detail cases per run
app.get("/api/results/:id/cases", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM test_cases WHERE run_id = $1 ORDER BY case_id, id",
    [req.params.id]
  );
  res.json(result.rows);
});

// GET /api/events — list events for a project (newest first, max 5)
app.get("/api/events", async (req, res) => {
  const projectId = req.query.project_id;
  if (!projectId) {
    return res.status(400).json({ error: "project_id is required" });
  }
  const result = await pool.query(
    `SELECT e.*, p.name AS project_name
     FROM events e
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE e.project_id = $1
     ORDER BY e.created_at DESC
     LIMIT 5`,
    [projectId]
  );
  res.json(result.rows);
});

// GET /api/events/:id — event detail with test_runs and cases
app.get("/api/events/:id", async (req, res) => {
  const eventId = req.params.id;

  const eventResult = await pool.query(
    `SELECT e.*, p.name AS project_name
     FROM events e
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1`,
    [eventId]
  );
  if (eventResult.rows.length === 0) {
    return res.status(404).json({ error: "Event not found" });
  }

  const runsResult = await pool.query(
    `SELECT tr.*, p.name AS project_name
     FROM test_runs tr
     LEFT JOIN projects p ON p.id = tr.project_id
     WHERE tr.event_id = $1
     ORDER BY tr.id`,
    [eventId]
  );

  const runIds = runsResult.rows.map(r => r.id);
  let cases = [];
  if (runIds.length > 0) {
    const casesResult = await pool.query(
      `SELECT tc.*, tr.suite_name
       FROM test_cases tc
       JOIN test_runs tr ON tr.id = tc.run_id
       WHERE tc.run_id = ANY($1::int[])
       ORDER BY tc.run_id, tc.case_id, tc.id`,
      [runIds]
    );
    cases = casesResult.rows;
  }

  res.json({
    ...eventResult.rows[0],
    runs: runsResult.rows,
    cases,
  });
});

// GET /api/summary — aggregated stats (optionally per project)
app.get("/api/summary", async (req, res) => {
  const projectId = req.query.project_id;

  let query, params;
  if (projectId) {
    query = `SELECT
               COUNT(*) AS run_count,
               COALESCE(SUM(total), 0) AS total_tests,
               COALESCE(SUM(passed), 0) AS total_passed,
               COALESCE(SUM(failed), 0) AS total_failed
             FROM test_runs WHERE project_id = $1`;
    params = [projectId];
  } else {
    query = `SELECT
               COUNT(*) AS run_count,
               COALESCE(SUM(total), 0) AS total_tests,
               COALESCE(SUM(passed), 0) AS total_passed,
               COALESCE(SUM(failed), 0) AS total_failed
             FROM test_runs`;
    params = [];
  }

  const result = await pool.query(query, params);
  res.json(result.rows[0]);
});

// GET /api/cases — filter cases globally by status
app.get("/api/cases", async (req, res) => {
  const status = req.query.status;
  const projectId = req.query.project_id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  let conditions = [];
  let params = [];
  let idx = 1;

  if (status) {
    conditions.push(`tc.status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (projectId) {
    conditions.push(`tr.project_id = $${idx}`);
    params.push(projectId);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT tc.*, tr.suite_name, tr.project_id, p.name AS project_name
     FROM test_cases tc
     JOIN test_runs tr ON tr.id = tc.run_id
     LEFT JOIN projects p ON p.id = tr.project_id
     ${where}
     ORDER BY tc.id DESC LIMIT $${idx}`,
    [...params, limit]
  );

  res.json(result.rows);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down...");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down...");
  await pool.end();
  process.exit(0);
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
