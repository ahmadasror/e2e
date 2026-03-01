# E2E Dashboard — Project Knowledge

## Stack
Express 4 + PostgreSQL (`pg`) + Vanilla JS frontend. No build step. Node >= 18.

## Run & Restart
```sh
npm start                          # jalankan server (port 3000)
npm run post-results               # kirim sample data
kill $(lsof -ti :3000) && node server.js &  # restart setelah edit server.js
```
- Dashboard: `http://localhost:3000` — Swagger: `http://localhost:3000/api-docs`
- **Server harus di-restart manual** setelah edit `server.js` (tidak ada hot reload)

## Database Schema
Auto-created via `initDb()` + migrations on startup.

| Tabel | Keterangan |
|-------|-----------|
| `projects` | `name UNIQUE` |
| `events` | 1 event = 1 test run. Fields: `event_name`, `description`, `trigger`, `total/passed/failed/skipped`. Max **15** per project (auto-prune). |
| `test_runs` | 1 suite per row, linked ke `events.id` via `event_id` |
| `test_cases` | Test case individual, linked ke `test_runs.id` |

## API Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| `GET` | `/api/projects/overview` | Projects + stats event terakhir (LATERAL JOIN) |
| `GET/POST` | `/api/projects` | List / register project |
| `POST` | `/api/results` | Submit hasil test. Fields: `project_name`, `event_name`, `description`, `trigger`, `suites[]` atau single-suite |
| `GET` | `/api/events?project_id=` | Event history (max 15) |
| `GET` | `/api/events/:id` | Detail event: runs + cases |
| `GET` | `/api/results/:id/cases` | Test cases satu run |
| `GET` | `/api/summary` | Aggregated stats |
| `GET` | `/api/cases` | Filter test cases global |

## Frontend (3-level Navigation)
1. `view-projects` — Grid project cards + status last run
2. `view-events` — Event history project. Tampilkan `description` (italic) di bawah nama event
3. `view-detail` — Summary cards + tabel suites + expandable test cases. Breadcrumb pakai `description` jika ada.

Auto-refresh **10 detik**, hanya view aktif. `projectsData[]` disimpan global — `onclick` card cukup kirim `id`.

## Conventions
- Dark theme: bg `#0f172a`, green `#4ade80`, red `#f87171`, blue `#60a5fa`, yellow `#fbbf24`
- Favicon SVG inline di `<head>`, title: **"E2E Test Dashboard"**
- Module badge warna dari `MODULE_COLORS[]` (round-robin)
- Git: `user.email = ahmad.asror@gmail.com`
- Remote: `https://github.com/ahmadasror/e2e`
