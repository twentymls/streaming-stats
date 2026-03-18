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

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => []),
}));

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

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: null })),
      signUp: vi.fn(async () => ({ data: { user: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({ data: [], error: null })),
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
      upsert: vi.fn(async () => ({ error: null })),
    })),
  })),
}));

// Mock sync module
vi.mock("../lib/sync", () => ({
  syncToSupabase: vi.fn(async () => {}),
  syncAllHistory: vi.fn(async () => {}),
  syncSettings: vi.fn(async () => {}),
}));
