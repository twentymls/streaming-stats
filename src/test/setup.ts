import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock @tauri-apps/plugin-store
vi.mock("@tauri-apps/plugin-store", () => {
  const store = new Map<string, unknown>();
  return {
    load: vi.fn(async () => ({
      get: vi.fn(async (key: string) => store.get(key)),
      set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      save: vi.fn(async () => {}),
    })),
  };
});

// Mock @tauri-apps/plugin-sql
vi.mock("@tauri-apps/plugin-sql", () => {
  const mockDb = {
    execute: vi.fn(async () => ({ rowsAffected: 0 })),
    select: vi.fn(async () => []),
  };
  return {
    default: {
      load: vi.fn(async () => mockDb),
    },
  };
});

// Mock @tauri-apps/plugin-http
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  })),
}));

// Mock @tauri-apps/plugin-shell
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(async () => {}),
}));
