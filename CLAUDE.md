# E2E Test Dashboard — Project Knowledge

## Overview
Lightweight dashboard untuk monitoring hasil test suite. Stack: **Express + PostgreSQL**, single-file frontend (`public/index.html`), no build step.

## Running the Server
```sh
npm start          # node server.js
npm run post-results  # kirim dummy test data ke server
```
Server jalan di `http://localhost:3000`. Swagger UI di `http://localhost:3000/api-docs`.

**Setelah edit `server.js`, server harus di-restart manual** — tidak ada hot reload.

```sh
# Cara restart:
lsof -i :3000 | grep LISTEN   # cari PID
kill <PID>
node server.js &
```

## Stack & Dependencies
- **Runtime**: Node.js >= 18
- **Framework**: Express 4
- **Database**: PostgreSQL (via `pg`)
- **Env**: `dotenv` (file `.env`, template di `.env.example`)
- **API Docs**: Swagger UI Express + `swagger.json`
- **Frontend**: Vanilla JS, no framework, no build step

## Database Schema
Tabel utama (auto-created saat `initDb()`):

| Tabel | Keterangan |
|-------|-----------|
| `projects` | Daftar project (name UNIQUE) |
| `events` | Satu event = satu test run, berisi agregat stats. Max 5 event per project (auto-prune oldest). |
| `test_runs` | Satu suite per event, linked ke `events.id` via `event_id` |
| `test_cases` | Test case individual, linked ke `test_runs.id` |

## Key API Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| `GET` | `/api/projects/overview` | Projects + stats event terakhir (LATERAL JOIN) |
| `GET` | `/api/projects` | List semua project |
| `POST` | `/api/projects` | Register project baru |
| `POST` | `/api/results` | Submit test results (single suite atau multi-suite) |
| `GET` | `/api/events?project_id=` | Event history satu project (max 5) |
| `GET` | `/api/events/:id` | Detail event: runs + cases |
| `GET` | `/api/results/:id/cases` | Test cases satu run |
| `GET` | `/api/summary` | Aggregated stats |

## Frontend Navigation (3-level)
1. **Landing** (`view-projects`) — Grid card tiap project + status last run (PASS/FAIL, stats)
2. **Event History** (`view-events`) — List events untuk project yang dipilih
3. **Event Detail** (`view-detail`) — Summary cards + tabel suites, expandable test cases per suite

Auto-refresh setiap **10 detik**, hanya refresh view yang aktif.

## File Structure
```
server.js              Express server + DB init + semua API routes
public/index.html      Full frontend (CSS + HTML + JS, semua inline)
swagger.json           OpenAPI spec untuk Swagger UI
e2e/post-results.js    Script kirim dummy test data
.env.example           Template environment variable
```

## Conventions
- Frontend: dark theme (`#0f172a` background), warna: green `#4ade80`, red `#f87171`, blue `#60a5fa`, yellow `#fbbf24`
- Favicon: SVG inline di `<head>`, tidak ada file favicon terpisah
- Title: "E2E Test Dashboard"
- Module badge di test cases menggunakan warna dari array `MODULE_COLORS` (round-robin)
- Error di frontend di-catch dan di-console.error — **pastikan UI update ke error state** jika fetch gagal
