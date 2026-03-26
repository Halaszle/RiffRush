import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/backend/src/create-app.js";
import { createEngineServer } from "../apps/engine/src/engine-server.js";
import { writeDemoWav } from "../apps/engine/scripts/generate-demo-wav.js";
import { PROTOCOL_VERSION, createEnvelope } from "../packages/protocol/src/runtime.js";

async function listen(server, host = "127.0.0.1") {
  await new Promise((resolve) => {
    server.listen(0, host, resolve);
  });

  return server.address();
}

const backendServer = createApp();
const engineServer = createEngineServer({
  host: "127.0.0.1",
  port: 0,
  heartbeatIntervalMs: 50
});

const backendAddress = await listen(backendServer);
const engineAddress = await listen(engineServer);

const backendUrl = `http://127.0.0.1:${backendAddress.port}`;
const engineUrl = `ws://127.0.0.1:${engineAddress.port}/ws`;
const tempDirectory = await mkdtemp(join(tmpdir(), "riffrush-vertical-"));
const wavPath = join(tempDirectory, "vertical-session.wav");

const trainingsResponse = await fetch(`${backendUrl}/trainings`);
const trainingsPayload = await trainingsResponse.json();
const selectedTraining = trainingsPayload.data[0];

assert.equal(trainingsResponse.status, 200);
assert.ok(selectedTraining);

await writeDemoWav(wavPath, selectedTraining.exerciseId);

const createSessionResponse = await fetch(`${backendUrl}/sessions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    userId: "user-vertical-001",
    trainingId: selectedTraining.id,
    calibrationOffsetMs: 9,
    inputMode: "wav-file",
    inputFilePath: wavPath
  })
});

const createSessionPayload = await createSessionResponse.json();
const session = createSessionPayload.data.session;

assert.equal(createSessionResponse.status, 201);
assert.equal(session.status, "active");

const socket = new WebSocket(engineUrl);

const engineSummaryPromise = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error("Timed out waiting for engine calibration and summary."));
  }, 6000);

  let calibrationSaved = false;
  let summaryReceived = false;
  let summaryMessage = null;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "engine.ready") {
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
              trainingId: selectedTraining.id,
              exerciseId: session.exerciseId,
              tuning: selectedTraining.tuning,
              tempoBpm: selectedTraining.tempoBpm,
              calibrationOffsetMs: session.calibrationOffsetMs,
              inputMode: session.inputMode,
              inputFilePath: session.inputFilePath
            },
            { sessionId: session.id }
          )
        )
      );
      return;
    }

    if (message.type === "calibration.result") {
      fetch(`${backendUrl}/users/user-vertical-001/calibration`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          offsetMs: message.payload.recommendedOffsetMs,
          measuredLatencyMs: message.payload.measuredLatencyMs,
          noiseFloorDb: message.payload.noiseFloorDb
        })
      })
        .then(async (response) => {
          assert.equal(response.status, 200);
          calibrationSaved = true;

          if (summaryReceived) {
            clearTimeout(timeout);
            resolve(summaryMessage);
          }
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
      return;
    }

    if (message.type === "session.summary") {
      summaryReceived = true;
      summaryMessage = message;

      if (calibrationSaved) {
        clearTimeout(timeout);
        resolve(message);
      }
    }
  });

  socket.addEventListener("error", (event) => {
    clearTimeout(timeout);
    reject(new Error(`Engine socket error: ${event.type}`));
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

const summaryMessage = await engineSummaryPromise;

const summaryResponse = await fetch(`${backendUrl}/sessions/${session.id}/summary`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(summaryMessage.payload)
});

const summaryPayload = await summaryResponse.json();

assert.equal(summaryResponse.status, 200);
assert.equal(summaryPayload.data.session.status, "completed");
assert.equal(summaryPayload.data.session.summary.totalScore, summaryMessage.payload.totalScore);
assert.ok(summaryPayload.data.session.summary.scoreBreakdown);
assert.ok(summaryPayload.data.session.summary.verification);
assert.equal(summaryPayload.data.session.summary.verification.status, "verified");
assert.equal(summaryPayload.data.session.summary.verification.mechanicallyComplete, true);
assert.equal(summaryPayload.data.session.summary.verification.checks.targetAccountingMatches, true);
assert.equal(summaryPayload.data.session.summary.verification.checks.sectionAccountingMatches, true);
assert.equal(
  summaryPayload.data.session.summary.scoreBreakdown.targetCount,
  selectedTraining.targetSequence.length
);

const dashboardResponse = await fetch(`${backendUrl}/users/user-vertical-001/dashboard`);
const dashboardPayload = await dashboardResponse.json();

assert.equal(dashboardResponse.status, 200);
assert.equal(dashboardPayload.data.stats.completedSessions, 1);
assert.equal(dashboardPayload.data.calibrationProfile.offsetMs, 14);
assert.ok(dashboardPayload.data.recentResults[0].scoreBreakdown);
assert.ok(dashboardPayload.data.recentResults[0].verification);
assert.equal(dashboardPayload.data.recentResults[0].verification.status, "verified");

socket.close();

await Promise.all([
  new Promise((resolve, reject) => {
    backendServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  }),
  new Promise((resolve, reject) => {
    engineServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  })
]);

await rm(tempDirectory, { recursive: true, force: true });

console.log("Vertical slice smoke test passed.");
