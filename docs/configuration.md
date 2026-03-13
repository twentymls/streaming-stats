# Configuration Files

## Tauri Configuration (`src-tauri/tauri.conf.json`)

Core app configuration for window, security, and build settings.

```json
{
  "productName": "Streaming Stats",
  "version": "0.1.0",
  "identifier": "com.streamingstats.app"
}
```

### Window settings

- Size: 900 x 650 pixels
- Resizable: yes
- Centered on screen on launch
- Title: "Streaming Stats"

### Security (CSP)

```
default-src 'self';
connect-src 'self' https://songstats.p.rapidapi.com;
style-src 'self' 'unsafe-inline';
img-src 'self' https: data:
```

- Only `songstats.p.rapidapi.com` is allowed for API calls.
- Images from any HTTPS source (for track artwork).
- Inline styles allowed (CSS-in-JS needs this).
- No `eval()` or external scripts.

### Build commands

- **Dev**: `npm run dev` (starts Vite dev server on port 5173)
- **Build**: `npm run build` (runs `tsc && vite build`, outputs to `dist/`)
- Frontend dist: `../dist` (relative to src-tauri)
- Dev URL: `http://localhost:5173`

### Bundle: macOS

- Minimum system version: 10.15

### Bundle: Windows

- NSIS installer with `installMode: "both"` (supports per-user or machine-wide installation)
- WebView2 is bundled automatically (included in Windows 11, auto-installed on Windows 10)

### Tray icon

- Path: `icons/icon.png`
- `iconAsTemplate: true` (macOS menu bar style)

### Capabilities (`src-tauri/capabilities/default.json`)

Defines what Tauri APIs the frontend can access:
- Core IPC (invoke commands)
- Plugin: store (read/write)
- Plugin: http (fetch)
- Plugin: shell (open URLs)

---

## Vite Configuration (`vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,  // Fail if port is taken
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2021",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
```

- Fixed port 5173 (Tauri expects this for dev).
- `host: true` enables network access so physical mobile devices can connect during development.
- ES2021 target for modern JS features.
- Minification disabled in debug mode.
- Source maps enabled in debug mode.
- `TAURI_` env prefix allows Tauri build variables.

---

## TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "moduleResolution": "bundler",
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- Strict mode enabled (all strict checks).
- `noEmit: true` -- TypeScript only type-checks, Vite handles compilation.
- `moduleResolution: "bundler"` -- compatible with Vite's module resolution.
- `vitest/globals` types for test functions without imports.

---

## Vitest Configuration (`vitest.config.ts`)

```typescript
export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    pool: "threads",
  },
}));
```

- Merges with Vite config (shares plugins and aliases).
- jsdom environment for DOM testing.
- Global test functions (no imports needed for `describe`, `it`, `expect`, `vi`).
- CSS disabled in tests (not needed for component logic).
- Thread pool for parallel test execution.

---

## ESLint Configuration (`eslint.config.mjs`)

Configured with:
- TypeScript parser (`@typescript-eslint/parser`)
- React Hooks plugin (enforces rules of hooks)
- React Refresh plugin (warns on non-exportable components)

Run with: `npm run lint` or `npm run lint:fix`

---

## Prettier Configuration (`.prettierrc`)

Controls all code formatting. Prettier has final say on style -- don't fight it with manual choices.

Run with: `npm run format` or `npm run format:check`

---

## Package Scripts (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Vite dev server only (no Tauri backend) |
| `ios:dev` | `tauri ios dev` | Run on iOS Simulator |
| `ios:build` | `tauri ios build` | Production iOS build |
| `android:dev` | `tauri android dev` | Run on Android Emulator |
| `android:build` | `tauri android build` | Production Android build |
| `build` | `tsc && vite build` | Type-check + production bundle |
| `test` | `vitest run` | Single test run |
| `test:watch` | `vitest` | Watch mode |
| `lint` | `eslint src/` | Check for lint errors |
| `lint:fix` | `eslint src/ --fix` | Auto-fix lint errors |
| `format` | `prettier --write "src/**/*.{ts,tsx}"` | Format all frontend code |
| `format:check` | `prettier --check "src/**/*.{ts,tsx}"` | Check formatting without writing |

### Full app commands (require Cargo)

```bash
export PATH="$HOME/.cargo/bin:$PATH"

# Development (frontend + backend)
npx tauri dev

# Production build
npx tauri build --bundles app,dmg

# Rust lint
cd src-tauri && cargo clippy

# Rust format
cd src-tauri && cargo fmt

# Rust tests
cd src-tauri && cargo test
```

---

## Environment & Secrets

- `.env` files are gitignored. Never commit API keys.
- API keys are stored encrypted via `@tauri-apps/plugin-store`, not in environment variables.
- `import.meta.env` for Vite environment variables (not `process.env`).
- The only env prefixes allowed are `VITE_` and `TAURI_`.
