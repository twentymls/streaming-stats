// Stubs for @tauri-apps/* packages in the PWA build.
// These prevent import errors for any transitive Tauri imports.

export async function invoke(): Promise<unknown> {
  return [];
}

export async function fetch(): Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}> {
  return { ok: false, status: 0, json: async () => ({}), text: async () => "" };
}

export async function open(): Promise<void> {}

export async function load(): Promise<{
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  save: () => Promise<void>;
}> {
  return {
    get: async () => undefined,
    set: async () => {},
    save: async () => {},
  };
}
