# Streaming Stats Documentation

Comprehensive documentation for the Streaming Stats desktop app -- a Tauri 2 + React 19 + Rust application for tracking music streaming statistics across platforms.

## Documents

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | High-level stack, frontend/backend structure, communication protocol, external dependencies |
| [Components](components.md) | Every React component: purpose, props, state, rendering logic |
| [Data Flow](data-flow.md) | How data moves from Songstats API to SQLite to screen, including auto-fetch decision tree |
| [Database](database.md) | Full SQLite schema (5 tables), query patterns, data lifecycle |
| [API](api.md) | Songstats API endpoints, parameters, field mapping, rate limiting, call budget |
| [Rust Backend](rust-backend.md) | Tauri commands, models, error handling, database pool, migrations, dependencies |
| [Utilities](utilities.md) | All utility functions and types: formatting, stat selection, delta computation algorithms |
| [Styling](styling.md) | CSS variables, platform colors, layout patterns, responsive breakpoints, class reference |
| [Testing](testing.md) | Test stack, mock setup, all test files with coverage, patterns for writing new tests |
| [Configuration](configuration.md) | All config files: tauri.conf.json, vite, tsconfig, vitest, eslint, prettier, cargo, package.json |

## Quick Reference

### Supported Platforms

| Key | Name | Primary Stat |
|-----|------|-------------|
| `spotify` | Spotify | streams |
| `apple_music` | Apple Music | streams |
| `youtube` | YouTube | views |
| `tiktok` | TikTok | views |
| `deezer` | Deezer | streams |
| `amazon` | Amazon Music | streams |
| `shazam` | Shazam | shazams |
| `soundcloud` | SoundCloud | plays |

### Key Commands

```bash
# Development
export PATH="$HOME/.cargo/bin:$PATH" && npx tauri dev

# Production build
export PATH="$HOME/.cargo/bin:$PATH" && npx tauri build --bundles app,dmg

# Tests
npm test                              # Frontend
cd src-tauri && cargo test            # Backend

# Lint & format
npm run lint:fix && npm run format    # Frontend
cd src-tauri && cargo clippy && cargo fmt  # Backend
```

### File Structure

```
src/                    React 19 frontend (TypeScript)
  components/           UI components (Dashboard, PlatformCard, etc.)
  lib/                  Business logic (API client, database, utils)
  styles/               CSS (dark theme, custom properties)
  test/                 Test setup and Tauri plugin mocks

src-tauri/src/          Rust backend (Tauri 2)
  lib.rs                App setup and plugin registration
  commands.rs           16 IPC command handlers
  db.rs                 SQLite pool and migrations
  models.rs             Serialization models
  error.rs              Error types
```
