import assert from "node:assert/strict";
import { access, rm } from "node:fs/promises";
import { createEngineServer } from "../src/engine-server.js";
import { noteToFrequency } from "../src/audio/note-library.js";
import { PROTOCOL_VERSION, createEnvelope } from "../../../packages/protocol/src/runtime.js";

function encodePcm16Base64(samples) {
  const buffer = Buffer.alloc(samples.length * 2);

  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(value * 32767), index * 2);
  }

  return buffer.toString("base64");
}

function buildSineChunk(note, sampleRate = 48000, frameSize = 2048, amplitude = 0.7) {
  const frequency = noteToFrequency(note);
  const samples = new Float32Array(frameSize * 3);

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequency * index) / sampleRate);
  }

  return samples;
}

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

const completionPromise = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error("Timed out waiting for live-stream engine summary."));
  }, 4000);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    incomingMessages.push(message);

    if (message.type === "engine.ready") {
      socket.send(
        JSON.stringify(
          createEnvelope(
            "session.start",
            {
              trainingId: "training-001",
              exerciseId: "exercise-001",
              tuning: "standard",
              calibrationOffsetMs: 12,
              inputMode: "live-stream"
            },
            { sessionId: "live-session-001" }
          )
        )
      );

      for (const note of ["E4", "F4", "G4", "A4"]) {
        socket.send(
          JSON.stringify(
            createEnvelope(
              "audio.stream.chunk",
              {
                sampleRate: 48000,
                channelCount: 1,
                encoding: "pcm16-base64",
                chunkBase64: encodePcm16Base64(buildSineChunk(note))
              },
              { sessionId: "live-session-001" }
            )
          )
        );
      }

      socket.send(
        JSON.stringify(
          createEnvelope(
            "session.stop",
            {
              reason: "stream-ended"
            },
            { sessionId: "live-session-001" }
          )
        )
      );
      return;
    }

    if (message.type === "session.summary") {
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

await completionPromise;

assert.ok(incomingMessages.some((message) => message.type === "session.started"));
assert.ok(incomingMessages.some((message) => message.type === "score.event"));
assert.ok(incomingMessages.some((message) => message.type === "session.summary"));

const summaryMessage = incomingMessages.find((message) => message.type === "session.summary");
assert.ok(summaryMessage.payload.artifact?.filePath);
assert.ok(summaryMessage.payload.verification);
assert.equal(summaryMessage.payload.verification.status, "verified");
assert.equal(summaryMessage.payload.verification.checks.hasArtifact, true);
await access(summaryMessage.payload.artifact.filePath);

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

await rm(summaryMessage.payload.artifact.filePath, { force: true });

console.log("Engine live-stream smoke test passed.");
