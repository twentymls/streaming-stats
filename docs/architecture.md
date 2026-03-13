# Architecture Overview

Streaming Stats is a cross-platform application (desktop + mobile) for tracking music streaming statistics across platforms. It is built with a **Tauri 2** shell (Rust backend + WebView frontend) targeting macOS, iOS, and Android.

## High-Level Stack

```
+--------------------------+
|     React 19 Frontend    |  TypeScript 5.9, Vite 6, Chart.js
|  (src/)                  |
+-----------+--------------+
            | Tauri IPC (invoke)
+-----------+--------------+
|     Rust Backend         |  Tauri 2, sqlx, tokio
|  (src-tauri/src/)        |
+-----------+--------------+
            |
+-----------+--------------+
|     SQLite Database      |  Local file in app-data dir
+--------------------------+
```

## Frontend (src/)

The frontend is a single-page React 19 application bundled by Vite. It communicates with the backend exclusively through Tauri's IPC mechanism (`invoke()`). All HTTP requests go through `@tauri-apps/plugin-http` (backed by reqwest), not browser `fetch`, to avoid CORS.

### Key directories

| Path | Purpose |
|------|---------|
| `src/components/` | React function components (Dashboard, PlatformCard, etc.) |
| `src/lib/` | Business logic, API client, database wrappers, utilities |
| `src/styles/` | Global CSS with CSS custom properties for theming |
| `src/test/` | Vitest setup and Tauri plugin mocks |

### Component tree

```
App
 +-- Setup           (3-step onboarding wizard)
 +-- Dashboard        (main view)
      +-- PlatformCard[]  (grid of platform stat cards)
      +-- KpiRow          (6 KPI summary cards)
      +-- DailyGrowthChart (stacked bar chart)
      +-- GrowthShare     (horizontal share bars)
      +-- PlatformDetail  (full platform drilldown)
      |    +-- TrendChart  (line chart)
      |    +-- DailyDeltasChart (rolling avg line chart)
      +-- Settings        (config page)
```

### State management

All state lives in React hooks (`useState`, `useMemo`, `useCallback`). There is no external state library. Derived state (chart data, filtered stats) is computed via `useMemo` during render rather than synced with `useEffect`.

### Data flow

1. `Dashboard.loadData()` calls database wrappers (via `invoke()`) to load cached stats.
2. Auto-fetch logic determines if new data should be pulled from Songstats API.
3. `songstats-api.ts` fetches live data via `@tauri-apps/plugin-http`.
4. Results are saved to SQLite through Rust IPC commands.
5. `loadData()` re-runs to refresh the UI.

## Backend (src-tauri/src/)

The Rust backend handles database operations, system tray, and window management.

### Module structure

| File | Purpose |
|------|---------|
| `lib.rs` | Tauri app setup: plugin registration, tray menu (`#[cfg(desktop)]`), DB pool init, command registration |
| `main.rs` | Entry point (calls `app_lib::run()`, hides Windows console) |
| `commands.rs` | 16 `#[tauri::command]` handlers for all database operations |
| `db.rs` | SQLite pool creation (`SqlitePool` via sqlx) and schema migrations |
| `models.rs` | Serde-serializable structs for IPC boundary (DailyStat, TopTrack, etc.) |
| `error.rs` | Error type definitions with `thiserror` |

### Database pool

The SQLite pool is created on startup, wrapped in `tokio::sync::Mutex<SqlitePool>`, and stored as Tauri managed state. Every command handler locks the pool, runs a query, and returns the result.

### Migrations

Migrations run automatically on app startup in `db.rs`. They are idempotent (safe to re-run). Tables are created with `CREATE TABLE IF NOT EXISTS`, and columns are added conditionally via `PRAGMA table_info()` checks.

## Communication Protocol

Frontend and backend communicate via Tauri's IPC:

- **Frontend** calls `invoke("command_name", { args })` from `@tauri-apps/api/core`.
- **Backend** exposes `#[tauri::command] async fn command_name(...)` handlers.
- Rust structs use `#[serde(rename_all = "camelCase")]` to match JS naming.
- Commands that can fail return `Result<T, String>` -- Tauri serializes errors as rejected promises.

## External dependencies

### API

All API calls go to the **Songstats RapidAPI** (`https://songstats.p.rapidapi.com`). The API key is stored encrypted via `@tauri-apps/plugin-store`. Rate limiting: 500 requests/month on the BASIC plan. The app retries on HTTP 429 (3 attempts, 1.5s delay).

### Settings storage

User settings (API key, artist ID, enabled platforms, fetch state) are persisted in an encrypted store file via `@tauri-apps/plugin-store`. This is separate from the SQLite database.

### Content Security Policy

The CSP in `tauri.conf.json` restricts network access:
```
default-src 'self';
connect-src 'self' https://songstats.p.rapidapi.com;
style-src 'self' 'unsafe-inline';
img-src 'self' https: data:
```

Only `songstats.p.rapidapi.com` is allowed for API calls. Images from any HTTPS source are permitted (for track artwork).
