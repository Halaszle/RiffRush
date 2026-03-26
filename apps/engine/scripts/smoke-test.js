import assert from "node:assert/strict";
import { createEngineServer } from "../src/engine-server.js";
import { PROTOCOL_VERSION, createEnvelope } from "../../../packages/protocol/src/runtime.js";

const server = createEngineServer({
  host: "127.0.0.1",
  port: 0,
  heartbeatIntervalMs: 50
});

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);

const incomingMessages = [];

const readyPromise = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error("Timed out waiting for engine messages."));
  }, 7000);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    incomingMessages.push(message);

    const hasReady = incomingMessages.some((item) => item.type === "engine.ready");
    const hasCalibrationResult = incomingMessages.some((item) => item.type === "calibration.result");
    const heartbeatCount = incomingMessages.filter((item) => item.type === "engine.heartbeat").length;
    const summary = incomingMessages.find((item) => item.type === "session.summary");

    if (hasReady && hasCalibrationResult && heartbeatCount >= 1 && summary) {
      clearTimeout(timeout);
      resolve();
    }
  });

  socket.addEventListener("error", (event) => {
    clearTimeout(timeout);
    reject(new Error(`WebSocket error: ${event.type}`));
  });
});

await new Promise((resolve) => {
  socket.addEventListener("open", resolve, { once: true });
});

socket.send(
  JSON.stringify(
    createEnvelope("engine.init", {
      minVersion: PROTOCOL_VERSION,
      maxVersion: PROTOCOL_VERSION,
      clientName: "web"
    })
  )
);

socket.send(
  JSON.stringify(
    createEnvelope("calibration.start", {
      mode: "latency-check",
      expectedBeats: 4
    })
  )
);

socket.send(
  JSON.stringify(
    createEnvelope(
      "session.start",
      {
        trainingId: "training-001",
        exerciseId: "exercise-001",
        tuning: "standard",
        calibrationOffsetMs: 12
      },
      {
        sessionId: "session-smoke-test"
      }
    )
  )
);

await readyPromise;

assert.ok(incomingMessages.some((message) => message.type === "engine.ready"));
assert.ok(incomingMessages.some((message) => message.type === "calibration.started"));
assert.ok(incomingMessages.some((message) => message.type === "calibration.progress"));
assert.ok(incomingMessages.some((message) => message.type === "calibration.result"));
assert.ok(incomingMessages.some((message) => message.type === "engine.heartbeat"));
assert.ok(incomingMessages.some((message) => message.type === "score.event"));
assert.ok(incomingMessages.some((message) => message.type === "session.summary"));

const scoreEvent = incomingMessages.find((message) => message.type === "score.event");
const sessionSummary = incomingMessages.find((message) => message.type === "session.summary");

assert.ok(scoreEvent.payload.expectedStringNumber >= 1);
assert.ok(typeof scoreEvent.payload.noteHit === "boolean");
assert.ok(typeof scoreEvent.payload.eventKind === "string");
assert.ok(typeof scoreEvent.payload.stringHit === "boolean");
assert.ok(typeof scoreEvent.payload.timingHit === "boolean");
assert.ok(typeof scoreEvent.payload.sustainHit === "boolean");
assert.ok(typeof scoreEvent.payload.releaseHit === "boolean");
assert.ok(typeof scoreEvent.payload.overheld === "boolean");
assert.ok(typeof scoreEvent.payload.fullComboHit === "boolean");
assert.ok(typeof scoreEvent.payload.comboCount === "number");
assert.ok(typeof scoreEvent.payload.comboMultiplier === "number");
assert.ok(typeof scoreEvent.payload.comboBroken === "boolean");
assert.ok(typeof scoreEvent.payload.expectedDurationMs === "number");
assert.ok(typeof scoreEvent.payload.releaseOvershootMs === "number");
assert.ok(typeof scoreEvent.payload.measureNumber === "number");
assert.ok(typeof scoreEvent.payload.beatNumber === "number");
assert.ok(typeof scoreEvent.payload.scheduledBeat === "number");
assert.ok(["early", "on-time", "late"].includes(scoreEvent.payload.timingClass));
assert.ok(scoreEvent.payload.timingWindowMs > 0);
assert.ok(sessionSummary.payload.scoreBreakdown);
assert.ok(sessionSummary.payload.scoreBreakdown.tempoBpm > 0);
assert.ok(sessionSummary.payload.scoreBreakdown.targetCount >= sessionSummary.payload.notesDetected);
assert.ok(typeof sessionSummary.payload.scoreBreakdown.sustainHits === "number");
assert.ok(typeof sessionSummary.payload.scoreBreakdown.releaseHits === "number");
assert.ok(typeof sessionSummary.payload.scoreBreakdown.overholdCount === "number");
assert.ok(typeof sessionSummary.payload.scoreBreakdown.ghostNoteCount === "number");
assert.ok(typeof sessionSummary.payload.scoreBreakdown.missedTargetCount === "number");
assert.ok(typeof sessionSummary.payload.scoreBreakdown.fullComboHits === "number");
assert.ok(typeof sessionSummary.payload.scoreBreakdown.maxCombo === "number");
assert.ok(typeof sessionSummary.payload.scoreBreakdown.comboBreakCount === "number");
assert.ok(typeof sessionSummary.payload.scoreBreakdown.multiplierPeak === "number");
assert.ok(sessionSummary.payload.rating);
assert.ok(["S", "A", "B", "C", "D", "F"].includes(sessionSummary.payload.rating.grade));
assert.ok(typeof sessionSummary.payload.rating.performanceScore === "number");
assert.ok(sessionSummary.payload.feedback);
assert.ok(typeof sessionSummary.payload.feedback.summary === "string");
assert.ok(Array.isArray(sessionSummary.payload.feedback.coachHints));
assert.ok(sessionSummary.payload.verification);
assert.equal(sessionSummary.payload.verification.status, "verified");
assert.equal(sessionSummary.payload.verification.mechanicallyComplete, true);
assert.equal(sessionSummary.payload.verification.checks.targetAccountingMatches, true);
assert.equal(sessionSummary.payload.verification.checks.hitAccountingMatches, true);
assert.equal(sessionSummary.payload.verification.checks.sectionAccountingMatches, true);

socket.close();

await new Promise((resolve, reject) => {
  server.close((error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
  });
});

console.log("Engine smoke test passed.");
