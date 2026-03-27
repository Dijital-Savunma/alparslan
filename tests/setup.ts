// Vitest setup - mock Chrome APIs
const chromeMock = {
  runtime: {
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: () => {} },
    sendMessage: (_msg: unknown, _cb?: unknown) => {},
  },
  tabs: {
    onUpdated: { addListener: () => {} },
    query: (_query: unknown, cb: (tabs: { url?: string }[]) => void) => {
      cb([{ url: "https://example.com" }]);
    },
    sendMessage: () => Promise.resolve(),
  },
  storage: {
    sync: {
      get: (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb({}),
      set: (_items: unknown, cb?: () => void) => cb?.(),
      clear: (cb?: () => void) => cb?.(),
    },
  },
  alarms: {
    create: () => {},
    onAlarm: { addListener: () => {} },
  },
};

Object.defineProperty(globalThis, "chrome", {
  value: chromeMock,
  writable: true,
});
