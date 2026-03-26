import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 3001;
const DEFAULT_DATA_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "storage"
);

export function getConfig() {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  const jwtSecret = process.env.JWT_SECRET ?? "riffrush-dev-secret-change-in-production";

  return {
    port,
    dataDirectory: process.env.BACKEND_DATA_DIR ?? DEFAULT_DATA_DIRECTORY,
    jwtSecret
  };
}
