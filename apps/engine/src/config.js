const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3210;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;

export function getConfig() {
  const port = Number(process.env.ENGINE_PORT ?? DEFAULT_PORT);
  const heartbeatIntervalMs = Number(
    process.env.ENGINE_HEARTBEAT_INTERVAL_MS ?? DEFAULT_HEARTBEAT_INTERVAL_MS
  );

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ENGINE_PORT value: ${process.env.ENGINE_PORT}`);
  }

  if (!Number.isInteger(heartbeatIntervalMs) || heartbeatIntervalMs <= 0) {
    throw new Error(
      `Invalid ENGINE_HEARTBEAT_INTERVAL_MS value: ${process.env.ENGINE_HEARTBEAT_INTERVAL_MS}`
    );
  }

  return {
    host: process.env.ENGINE_HOST ?? DEFAULT_HOST,
    port,
    heartbeatIntervalMs
  };
}
