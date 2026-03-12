# CLAUDE.md — Streaming Stats

## Project Overview

Desktop app for tracking music streaming statistics across platforms (Spotify, Apple Music, YouTube, TikTok, etc.). Built with **Tauri 2 + React 19 + TypeScript 5.9 + Rust**.

## Commands

- `npm run dev` — Vite dev server only (no Tauri backend)
- `npx tauri dev` — Full development mode (Rust backend + Vite frontend)
- `npx tauri build --bundles app` — Production build
- `npm run build` — Frontend-only build (TypeScript + Vite)
- `npm test` — Run frontend tests once
- `npm run test:watch` — Run frontend tests in watch mode
- `cd src-tauri && cargo test` — Run Rust backend tests
- `npm run lint` — Run ESLint on frontend code
- `npm run lint:fix` — Run ESLint with auto-fix
- `npm run format` — Format frontend code with Prettier
- `npm run format:check` — Check frontend formatting without writing
- `cd src-tauri && cargo clippy` — Run Rust linter
- `cd src-tauri && cargo fmt` — Format Rust code
- `cd src-tauri && cargo fmt --check` — Check Rust formatting without writing

## Architecture

```
src/              → React frontend (TypeScript)
src-tauri/src/    → Rust backend (Tauri commands)
```

Frontend communicates with backend via Tauri's IPC (`invoke`). API calls go through `@tauri-apps/plugin-http`, not browser fetch (CORS). Settings are stored encrypted via `@tauri-apps/plugin-store`. Data persists in a local SQLite database via `@tauri-apps/plugin-sql`.

## Best Practices

### TypeScript & React 19

- Use `function` components exclusively — no class components.
- Prefer `useCallback` and `useMemo` only when passing callbacks/values to child components or expensive computations. React 19's compiler handles most re-render optimization automatically — don't over-memoize.
- Use the `use()` hook for reading promises and context inside render when appropriate (React 19 feature). Prefer it over `useEffect` + `useState` for data fetching patterns.
- Type props with inline `{ prop: Type }` for simple components; extract an interface only when it's reused or has 4+ props.
- Use `satisfies` over `as` for type assertions — it preserves the narrowed type.
- Avoid `any`. Use `unknown` and narrow with type guards.
- Use `import type { ... }` for type-only imports to ensure they're erased at build time.
- State that is derived from other state should be computed during render, not synced with `useEffect`.
- Avoid `useEffect` for data transformations or event handling. Use event handlers directly and compute derived state inline.
- Use React 19's `useActionState` and `useOptimistic` for form handling and optimistic UI updates instead of manual state management.
- Use `ref` callbacks (or the new `ref` as a prop in React 19) instead of `useEffect` for DOM measurements.

### Vite 6

- Use `import.meta.env` for environment variables, not `process.env`.
- Keep `vite.config.ts` minimal — avoid over-configuring. Vite's defaults are sensible.
- Use dynamic `import()` for code splitting when components are heavy (e.g., charts).
- Static assets in `public/` are served as-is. Assets in `src/` are processed by Vite's pipeline (hashing, optimization).

### Tauri 2

- All external HTTP requests **must** go through `@tauri-apps/plugin-http` (built on reqwest). Browser `fetch` is blocked by CSP.
- Expose Rust functions to the frontend via `#[tauri::command]` and call them with `invoke()` from `@tauri-apps/api/core`.
- Commands that can fail should return `Result<T, String>` — Tauri serializes the error string to the frontend.
- Register commands in `tauri::Builder` with `.invoke_handler(tauri::generate_handler![...])`.
- Sensitive data (API keys, tokens) must be stored in `@tauri-apps/plugin-store`, never in localStorage, files, or code.
- Update `tauri.conf.json` CSP when adding new external API domains.
- Use `tauri::async_runtime` or `tokio` for async operations in Rust commands. Always mark I/O-bound commands as `async`.
- Tauri plugins are registered in `lib.rs` via `.plugin()`. When adding a new plugin, add it to both `Cargo.toml` and `tauri.conf.json` capabilities.
- Window management (size, title, decorations) is configured in `tauri.conf.json`, not in Rust code, unless dynamic.

### Rust (Edition 2021)

- Use `serde::Serialize` / `serde::Deserialize` derive macros for all types that cross the IPC boundary.
- Prefer `thiserror` for defining error types over manual `impl`. Convert errors to `String` at the command boundary for Tauri.
- Use `#[serde(rename_all = "camelCase")]` on structs passed to the frontend to match JS naming conventions.
- Avoid `unwrap()` and `expect()` in command handlers — propagate errors with `?`. Panics crash the app.
- Use `tokio::time::sleep` instead of `std::thread::sleep` in async contexts.
- Keep `lib.rs` focused on Tauri setup. Business logic and commands belong in separate modules.
- Use `log::info!`, `log::warn!`, `log::error!` (from the `log` crate) for backend logging — it integrates with `tauri-plugin-log`.

### SQLite (via tauri-plugin-sql)

- Run migrations on app startup in `database.ts` using `execute()`.
- Always use parameterized queries (`?` placeholders) — never interpolate values into SQL strings.
- Use `INSERT OR REPLACE` (or `ON CONFLICT`) for upserts rather than check-then-insert patterns.
- Add indices on columns used in `WHERE` and `ORDER BY` clauses. The existing schema indexes `date`, `source`, and composite keys.
- Use `UNIQUE` constraints to enforce data integrity at the DB level, not just in app code.
- Keep the schema in `database.ts` migrations — there is no separate migration tool.
- Use transactions (`BEGIN`/`COMMIT`) when inserting multiple related rows to ensure atomicity and improve performance.

### Chart.js + react-chartjs-2

- Register Chart.js components explicitly with `Chart.register(...)` — don't use `import 'chart.js/auto'` (it bundles everything).
- Memoize chart `data` and `options` objects to prevent unnecessary re-renders.
- Use `responsive: true` and `maintainAspectRatio: false` with a sized container div for proper chart scaling.
- Destroy chart instances when components unmount — `react-chartjs-2` handles this automatically, but verify in custom hooks.
- Use Chart.js's built-in date adapter (`chartjs-adapter-date-fns`) when plotting time-series data.

### date-fns 4

- Import individual functions (`import { format } from 'date-fns'`) — date-fns is tree-shakeable.
- Use `format`, `parseISO`, `subDays`, `startOfMonth`, etc. — avoid raw `Date` arithmetic.
- Store dates as ISO strings (`YYYY-MM-DD`) in SQLite and parse with `parseISO` when needed.
- Use `formatDistanceToNow` for relative timestamps in the UI.

### API & Networking

- All Songstats API calls go through `src/lib/songstats-api.ts`. Don't scatter API calls across components.
- Handle 429 (rate limit) responses with retry logic — the existing implementation uses 3 attempts with 1.5s delays.
- Log API calls to `api_calls_log` table for usage tracking.
- Cache expensive API responses (top tracks, top curators) in SQLite to minimize API calls.

### CSS & Styling

- Use CSS custom properties (variables) defined in `globals.css` for theming — don't hardcode colors.
- The app uses a dark theme by default. All color values should reference `var(--color-*)`.
- Use flexbox for layouts. No CSS framework is installed.

### Testing

- Every code change (new feature, bug fix, refactor) must include corresponding test creation or updates. Never merge code without tests.
- Frontend tests use **Vitest** with `jsdom` environment and `@testing-library/react`. Run with `npm test`.
- Rust tests use `cargo test`. Run with `cd src-tauri && cargo test`.
- Mock Tauri plugins (store, sql, http, shell) in `src/test/setup.ts` — they don't work outside the Tauri runtime.
- Pure logic belongs in `src/lib/utils.ts` so it can be tested without component rendering.
- Mock `./StatsChart` in component tests — Chart.js doesn't work in jsdom.

### Linting & Formatting

- Every code change (new feature, bug fix, refactor) **must** pass all linters and formatters before committing. Run and fix any issues:
  - **Frontend**: `npm run lint:fix` (ESLint) and `npm run format` (Prettier).
  - **Backend**: `cd src-tauri && cargo clippy` and `cd src-tauri && cargo fmt`.
- ESLint is configured in `eslint.config.js` with TypeScript, React Hooks, and React Refresh plugins.
- Prettier is configured in `.prettierrc`. It controls all formatting — do not fight it with manual style choices.
- Clippy warnings should be treated as errors. Fix them, don't suppress with `#[allow(...)]` unless there's a documented reason.

### Building

- After every code change, rebuild the app with `npx tauri build --bundles app` to verify the production build succeeds.

### General
- The app identifier is `com.streamingstats.app`. Don't change it without updating all platform configs.
- `.env` files are gitignored. Never commit API keys or secrets.
