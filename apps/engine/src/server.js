import { getConfig } from "./config.js";
import { createEngineServer } from "./engine-server.js";

const config = getConfig();
const server = createEngineServer(config);

server.listen(config.port, config.host, () => {
  console.log(`RiffRush engine listening on http://${config.host}:${config.port}`);
  console.log(`WebSocket endpoint available at ws://${config.host}:${config.port}/ws`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down engine.`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
