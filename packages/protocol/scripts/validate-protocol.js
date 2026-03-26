import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), "packages/protocol/src/messages.ts");
const source = readFileSync(file, "utf8");

const requiredTokens = [
  "PROTOCOL_VERSION",
  "engine.init",
  "engine.ready",
  "engine.heartbeat",
  "calibration.start",
  "calibration.started",
  "calibration.progress",
  "calibration.result",
  "native.devices.request",
  "native.preflight.request",
  "native.devices.response",
  "native.preflight.response",
  "session.start",
  "session.started",
  "session.notice",
  "audio.stream.chunk",
  "session.stop",
  "score.event",
  "session.summary",
  "engine.error"
];

const missing = requiredTokens.filter((token) => !source.includes(token));

if (missing.length > 0) {
  console.error("Missing protocol tokens:", missing.join(", "));
  process.exit(1);
}

console.log("Protocol file contains all required message tokens.");
