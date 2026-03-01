/**
 * E2E test script — posts dummy test results as execution events.
 * Each project posts all its suites in a single request (one event per run).
 * Usage: node e2e/post-results.js
 */

const BASE_URL = process.env.API_URL || "http://localhost:3000";

// Each entry is one execution event for a project.
// All suites in the event are aggregated into a single event record.
const events = [
  {
    project_name: "my-api",
    event_name: "Sanity Check",
    trigger: "ci",
    suites: [
      {
        suite_name: "auth",
        total: 4,
        passed: 3,
        failed: 1,
        cases: [
          { case_id: "1.1", case_name: "Login with valid credentials", description: "User logs in with correct email/password", module: "authentication", type: "positive", status: "pass", duration_ms: 120 },
          { case_id: "1.2", case_name: "Login with invalid password", description: "User gets error with wrong password", module: "authentication", type: "negative", status: "pass", duration_ms: 85 },
          { case_id: "1.3", case_name: "Token refresh", description: "Expired token gets refreshed", module: "authentication", type: "positive", status: "pass", duration_ms: 200 },
          { case_id: "1.4", case_name: "Register duplicate email", description: "Duplicate registration is rejected", module: "registration", type: "negative", status: "fail", error_message: "Expected 409 but got 500: Internal Server Error", duration_ms: 340 },
        ],
      },
      {
        suite_name: "users",
        total: 3,
        passed: 3,
        failed: 0,
        cases: [
          { case_id: "2.1", case_name: "Get user profile", module: "profile", type: "positive", status: "pass", duration_ms: 55 },
          { case_id: "2.2", case_name: "Update user avatar", module: "profile", type: "positive", status: "pass", duration_ms: 310 },
          { case_id: "2.3", case_name: "Delete user account", module: "account", type: "positive", status: "pass", duration_ms: 150 },
        ],
      },
    ],
  },
  {
    project_name: "manajemen-distrik",
    event_name: "E2E Run 2026-03-01 14:30",
    description: "E2E testing case untuk improvement management wilayah",
    trigger: "manual",
    suites: [
      { suite_name: "01-login", total: 10, passed: 10, failed: 0, cases: [] },
      { suite_name: "04-audit-trail", total: 7, passed: 7, failed: 0, cases: [] },
      { suite_name: "05-dashboard", total: 3, passed: 3, failed: 0, cases: [] },
      { suite_name: "06-access-control", total: 8, passed: 7, failed: 1, cases: [] },
      { suite_name: "07-role-matrix", total: 25, passed: 25, failed: 0, cases: [] },
    ],
  },
  {
    project_name: "web-app",
    event_name: "Sanity Check",
    trigger: "ci",
    suites: [
      {
        suite_name: "dashboard",
        total: 3,
        passed: 2,
        failed: 1,
        cases: [
          { case_id: "1.1", case_name: "Load dashboard page", module: "ui", type: "positive", status: "pass", duration_ms: 400 },
          { case_id: "1.2", case_name: "Filter by date range", module: "ui", type: "positive", status: "pass", duration_ms: 220 },
          { case_id: "1.3", case_name: "Export CSV with no data", module: "export", type: "negative", status: "fail", error_message: "Timeout: export took longer than 5000ms", duration_ms: 5001 },
        ],
      },
      {
        suite_name: "payments",
        total: 4,
        passed: 4,
        failed: 0,
        cases: [
          { case_id: "3.1", case_name: "Process valid payment", module: "billing", type: "positive", status: "pass", duration_ms: 800 },
          { case_id: "3.2", case_name: "Reject expired card", module: "billing", type: "negative", status: "pass", duration_ms: 150 },
          { case_id: "3.3", case_name: "Apply discount code", module: "billing", type: "positive", status: "pass", duration_ms: 180 },
          { case_id: "3.4", case_name: "Refund processed payment", module: "billing", type: "positive", status: "pass", duration_ms: 600 },
        ],
      },
    ],
  },
];

async function postEvent(eventData) {
  const res = await fetch(`${BASE_URL}/api/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventData),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const suiteNames = eventData.suites.map(s => s.suite_name).join(", ");
  console.log(`  Event #${json.event_id} — "${eventData.event_name}" [${eventData.trigger}] — suites: ${suiteNames}`);
}

async function main() {
  console.log(`Posting test events to ${BASE_URL}...\n`);

  for (const event of events) {
    console.log(`Project: ${event.project_name}`);
    await postEvent(event);
    console.log();
  }

  console.log("Done. Open the dashboard and select a project to browse event history.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
