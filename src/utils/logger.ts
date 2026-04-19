// Minimal debug-gated logger.
//
// `debug` / `info` no-op in production builds (Vite's DCE strips the
// `if (false)` branch), so domain names, URLs and timing data don't
// leak into DevTools for end users. `warn` and `error` always fire.

const DEBUG = Boolean(
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV,
);

const PREFIX = "[Alparslan]";

export const logger = {
  debug: (...args: unknown[]): void => {
    if (DEBUG) console.log(PREFIX, ...args);
  },
  info: (...args: unknown[]): void => {
    if (DEBUG) console.info(PREFIX, ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(PREFIX, ...args);
  },
  error: (...args: unknown[]): void => {
    console.error(PREFIX, ...args);
  },
};

export { DEBUG };
