# Contributing to Streaming Stats

Thanks for your interest in contributing! Here's how to get started.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Rust](https://rustup.rs/) (stable)
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

```bash
git clone https://github.com/your-username/streaming-stats.git
cd streaming-stats
npm install
```

## Development

```bash
# Frontend only (Vite dev server)
npm run dev

# Full app (Rust backend + frontend)
npx tauri dev
```

## Before Submitting a PR

Run all checks and make sure they pass:

```bash
# Frontend
npm test
npm run lint:fix
npm run format

# Backend
cd src-tauri
cargo test
cargo clippy
cargo fmt
```

## Pull Requests

1. Fork the repo and create a branch from `main`.
2. Make your changes and add/update tests.
3. Ensure all checks pass (see above).
4. Open a PR with a clear description of the change.

## Reporting Bugs

Open a GitHub issue with steps to reproduce, expected behavior, and actual behavior.

## Security

If you find a security vulnerability, please follow the process in [SECURITY.md](SECURITY.md) instead of opening a public issue.
