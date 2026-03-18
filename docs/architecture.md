# Architecture Overview

Streaming Stats is a cross-platform application (desktop + mobile) for tracking music streaming statistics across platforms. It is built with a **Tauri 2** shell (Rust backend + WebView frontend) targeting macOS, Windows, iOS, and Android.

## High-Level Stack

```
+--------------------------+          +--------------------------+
|     React 19 Frontend    |          |     PWA (read-only)      |
|  (src/)                  |          |  Same React components   |
+-----------+--------------+          +-----------+--------------+
            | Tauri IPC (invoke)                  | Supabase JS client
+-----------+--------------+          +-----------+--------------+
|     Rust Backend         |          |     Supabase (Postgres)  |
|  (src-tauri/src/)        |          |  Auth + RLS + Edge Fns   |
+-----------+--------------+          +--------------------------+
            |                                     ^
+-----------+--------------+                      |
|     SQLite Database      |-------- sync --------+
|  Local file in app-data  |
+--------------------------+
```

The desktop app stores data locally in SQLite and optionally syncs to Supabase. The PWA reads directly from Supabase. A Supabase Edge Function acts as a fallback fetcher when the desktop hasn't synced in 24 hours.

## Frontend (src/)

The frontend is a single-page React 19 application bundled by Vite. It communicates with the backend exclusively through Tauri's IPC mechanism (`invoke()`). All HTTP requests go through `@tauri-apps/plugin-http` (backed by reqwest), not browser `fetch`, to avoid CORS.

### Key directories

| Path | Purpose |
|------|---------|
| `src/components/` | React function components (Dashboard, PlatformCard, etc.) |
| `src/lib/` | Business logic, API client, database wrappers, utilities |
| `src/styles/` | Global CSS with CSS custom properties for theming |
| `src/test/` | Vitest setup and Tauri plugin mocks |

### Component tree (Desktop)

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
      +-- Settings        (config page, cloud sync)
```

### Component tree (PWA)

```
PwaApp
 +-- LoginPage        (email/password auth)
 +-- Dashboard        (readOnly mode — no fetch, no settings)
      +-- PlatformCard[]
      +-- KpiRow
      +-- DailyGrowthChart
      +-- GrowthShare
      +-- PlatformDetail
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

## Cloud Sync & PWA

### Sync module (`src/lib/sync.ts`)

After each daily fetch, the desktop app pushes data to Supabase (fire-and-forget). `syncAllHistory()` performs a one-time bulk sync of all local data. `syncSettings()` pushes config (artist ID, API key, enabled sources) to `user_settings`.

### PWA build strategy

The PWA reuses the same React components as the desktop app. A separate Vite config (`vite.config.pwa.ts`) swaps Tauri-specific modules for web implementations via `resolve.alias`:

| Import | Desktop (default) | PWA (aliased) |
|--------|-------------------|---------------|
| `../lib/database` | `database.ts` (Tauri IPC) | `database-web.ts` (Supabase queries) |
| `../lib/settings` | `settings.ts` (plugin-store) | `settings-web.ts` (Supabase auth) |
| `@tauri-apps/*` | Real Tauri plugins | `tauri-stubs.ts` (no-ops) |

The Dashboard accepts a `readOnly` prop that disables auto-fetch and hides settings/API UI.

### Supabase Edge Function

`supabase/functions/daily-fetch/index.ts` runs as a cron-triggered fallback. If a user's `last_sync_at` is older than 24 hours, the function fetches from Songstats server-side and writes directly to Supabase using the service role key.

## External dependencies

### API

All API calls go to the **Songstats RapidAPI** (`https://songstats.p.rapidapi.com`). The API key is stored encrypted via `@tauri-apps/plugin-store`. Rate limiting: 500 requests/month on the BASIC plan. The app retries on HTTP 429 (3 attempts, 1.5s delay).

### Supabase (optional)

Cloud sync uses `@supabase/supabase-js` to connect to a Supabase project. Configured via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables. The anon key is safe to embed — Row Level Security ensures users can only access their own data.

### Settings storage

User settings (API key, artist ID, enabled platforms, fetch state) are persisted in an encrypted store file via `@tauri-apps/plugin-store`. This is separate from the SQLite database.

### Content Security Policy

The CSP in `tauri.conf.json` restricts network access:
```
default-src 'self';
connect-src 'self' https://songstats.p.rapidapi.com https://*.supabase.co wss://*.supabase.co;
style-src 'self' 'unsafe-inline';
img-src 'self' https: data:
```

`songstats.p.rapidapi.com` is allowed for API calls. `*.supabase.co` is allowed for cloud sync. Images from any HTTPS source are permitted (for track artwork).
