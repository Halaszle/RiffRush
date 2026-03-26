import { createApp } from "./create-app.js";
import { getConfig } from "./config.js";
import { createPersistentDependencies } from "./persistence/create-persistent-dependencies.js";

const config = getConfig();
const server = createApp(createPersistentDependencies({ dataDirectory: config.dataDirectory, jwtSecret: config.jwtSecret }));

server.listen(config.port, () => {
  console.log(
    `RiffRush backend listening on http://127.0.0.1:${config.port} using data directory ${config.dataDirectory}`
  );
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down backend.`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
