import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEngineServer } from "../src/engine-server.js";
import { writeDemoWav } from "./generate-demo-wav.js";
import { PROTOCOL_VERSION, createEnvelope } from "../../../packages/protocol/src/runtime.js";

function extractPcmChunk(wavBuffer) {
  const dataMarkerOffset = wavBuffer.indexOf(Buffer.from("data", "ascii"));

  if (dataMarkerOffset < 0) {
    throw new Error("Could not locate WAV data chunk.");
  }

  const dataSize = wavBuffer.readUInt32LE(dataMarkerOffset + 4);
  return wavBuffer.subarray(dataMarkerOffset + 8, dataMarkerOffset + 8 + dataSize);
}

const tempDirectory = await mkdtemp(join(tmpdir(), "riffrush-native-capture-"));
const demoWavPath = join(tempDirectory, "native-capture.wav");
await writeDemoWav(demoWavPath, "exercise-001");
const pcmBuffer = extractPcmChunk(await readFile(demoWavPath));
const captureInvocations = [];
const preflightInvocations = [];

const server = createEngineServer(
  {
    host: "127.0.0.1",
    port: 0,
    heartbeatIntervalMs: 50
  },
  {
    nativeCaptureRunner: async (input) => {
      captureInvocations.push(input);
      if (captureInvocations.length === 1) {
        throw new Error("WASAPI low-latency capture could not be started for this device.");
      }

      const chunkSize = 4096;
      const silentChunk = Buffer.alloc(chunkSize);
      const capturedAtBaseMs = 1000;

      input.onChunkCaptured?.({
        sampleRate: 48000,
        pcmBuffer: silentChunk,
        capturedAtMs: capturedAtBaseMs
      });
      input.onChunkCaptured?.({
        sampleRate: 48000,
        pcmBuffer: silentChunk,
        capturedAtMs: capturedAtBaseMs + 30
      });
      input.onChunkCaptured?.({
        sampleRate: 48000,
        pcmBuffer: silentChunk,
        capturedAtMs: capturedAtBaseMs + 60
      });

      for (let offset = 0; offset < pcmBuffer.length; offset += chunkSize) {
        input.onChunkCaptured?.({
          sampleRate: 48000,
          pcmBuffer: pcmBuffer.subarray(offset, offset + chunkSize),
          capturedAtMs: capturedAtBaseMs + 400 + (offset / chunkSize) * 90
        });
      }

      return {
        artifactPath: demoWavPath,
        capture: {
          source: "native-capture",
          profile: input.captureProfile,
          backend: input.deviceBackend,
          deviceId: input.deviceId,
          deviceName: "Focusrite USB Input",
          deviceNumber: input.deviceNumber,
          sampleRate: 48000,
          chunkCount: Math.ceil(pcmBuffer.length / chunkSize),
          durationMs: input.captureDurationMs,
          bufferMs: input.bufferMs,
          numberOfBuffers: input.numberOfBuffers,
          startAttemptCount: 2,
          useEventSync: input.useEventSync
        }
      };
    },
    nativeCapturePreflightRunner: async (input) => {
      preflightInvocations.push(input);

      if (input.deviceBackend === "wavein" && input.captureProfile === "low-latency") {
        throw new Error("WaveIn low-latency path did not validate for this device.");
      }

      const resolvedProfile =
        input.captureProfile === "balanced" || input.captureProfile === "safe"
          ? input.captureProfile
          : "low-latency";
      const bufferMs = resolvedProfile === "balanced" ? 60 : resolvedProfile === "safe" ? 120 : 25;
      const numberOfBuffers = resolvedProfile === "balanced" ? 3 : resolvedProfile === "safe" ? 4 : 2;
      const useEventSync = resolvedProfile !== "safe";

      return {
        ok: true,
        selectedDevice: {
          backend: "wasapi",
          deviceId: "wasapi-focusrite-001",
          deviceNumber: 0,
          name: "Focusrite USB Input"
        },
        resolved: {
          captureProfile: resolvedProfile,
          backend: "wasapi",
          bufferMs,
          numberOfBuffers,
          useEventSync,
          sampleRate: 48000,
          captureDurationMs: 1000
        }
      };
    },
    nativeDeviceLister: async () => [
      {
        backend: "wavein",
        deviceId: "wavein-focusrite-001",
        deviceNumber: 1,
        name: "Focusrite USB Input",
        isDefault: false,
        inputKind: "audio-interface",
        recommendedBackend: "wasapi",
        recommendedProfile: "low-latency",
        isRecommendedPath: false
      },
      {
        backend: "wasapi",
        deviceId: "wasapi-focusrite-001",
        deviceNumber: 0,
        name: "Focusrite USB Input",
        isDefault: true,
        inputKind: "audio-interface",
        recommendedBackend: "wasapi",
        recommendedProfile: "low-latency",
        isRecommendedPath: true
      },
      {
        backend: "wavein",
        deviceId: "wavein:1",
        deviceNumber: 1,
        name: "HyperX QuadCast",
        isDefault: false,
        inputKind: "microphone",
        recommendedBackend: "wavein",
        recommendedProfile: "balanced",
        isRecommendedPath: false
      }
    ]
  }
);

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
const incomingMessages = [];

const completionPromise = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error("Timed out waiting for native-capture engine summary."));
  }, 5000);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    incomingMessages.push(message);

    if (message.type === "engine.ready") {
      socket.send(
        JSON.stringify(
          createEnvelope("native.devices.request", {
            source: "capture"
          })
        )
      );
      socket.send(
        JSON.stringify(
          createEnvelope("native.preflight.request", {
            captureDurationMs: 1000,
            captureProfile: "low-latency",
            inputDeviceBackend: "wavein",
            inputDeviceId: "wavein-focusrite-001",
            inputDeviceNumber: 1
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
              calibrationOffsetMs: 12,
              inputMode: "native-capture",
              captureDurationMs: 1000,
              captureProfile: "low-latency",
              inputDeviceBackend: "wavein",
              inputDeviceId: "wavein-focusrite-001",
              inputDeviceNumber: 1
            },
            { sessionId: "native-session-001" }
          )
        )
      );
      return;
    }

    if (message.type === "session.summary") {
      clearTimeout(timeout);
      resolve(message);
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

const summaryMessage = await completionPromise;

assert.ok(incomingMessages.some((message) => message.type === "session.started"));
assert.ok(incomingMessages.some((message) => message.type === "session.notice"));
assert.ok(incomingMessages.some((message) => message.type === "score.event"));
assert.ok(incomingMessages.some((message) => message.type === "native.devices.response"));
assert.ok(incomingMessages.some((message) => message.type === "native.preflight.response"));
const nativeDevicesResponse = incomingMessages.find((message) => message.type === "native.devices.response");
const nativePreflightResponse = incomingMessages.find((message) => message.type === "native.preflight.response");
const sessionNotices = incomingMessages.filter((message) => message.type === "session.notice");
const preflightFallbackNotice = sessionNotices.find(
  (message) => message.payload.code === "NATIVE_CAPTURE_PREFLIGHT_FALLBACK"
);
const runtimeRetryNotice = sessionNotices.find(
  (message) => message.payload.code === "NATIVE_CAPTURE_RUNTIME_RETRY"
);
const lowSignalNotice = sessionNotices.find(
  (message) => message.payload.code === "NATIVE_CAPTURE_LOW_SIGNAL"
);
const chunkGapNotice = sessionNotices.find(
  (message) => message.payload.code === "NATIVE_CAPTURE_CHUNK_GAP"
);

assert.equal(nativeDevicesResponse.payload.devices[0].backend, "wavein");
assert.equal(nativeDevicesResponse.payload.devices[0].recommendedProfile, "low-latency");
assert.equal(nativeDevicesResponse.payload.devices[0].inputKind, "audio-interface");
assert.equal(nativePreflightResponse.payload.ok, true);
assert.equal(nativePreflightResponse.payload.requested.backend, "wavein");
assert.equal(nativePreflightResponse.payload.resolved.backend, "wasapi");
assert.equal(nativePreflightResponse.payload.resolved.bufferMs, 25);
assert.equal(nativePreflightResponse.payload.resolved.useEventSync, true);
assert.equal(nativePreflightResponse.payload.fallbackApplied, true);
assert.match(nativePreflightResponse.payload.fallbackReason, /falling back/i);
assert.ok(sessionNotices.length >= 4);
assert.ok(preflightFallbackNotice);
assert.ok(runtimeRetryNotice);
assert.ok(lowSignalNotice);
assert.ok(chunkGapNotice);
assert.equal(preflightFallbackNotice.payload.capture.backend, "wasapi");
assert.equal(preflightFallbackNotice.payload.capture.profile, "low-latency");
assert.equal(preflightFallbackNotice.payload.capture.deviceName, "Focusrite USB Input");
assert.equal(preflightFallbackNotice.payload.capture.sampleRate, 48000);
assert.equal(preflightFallbackNotice.payload.capture.bufferMs, 25);
assert.equal(runtimeRetryNotice.payload.capture.backend, "wasapi");
assert.equal(runtimeRetryNotice.payload.capture.profile, "balanced");
assert.equal(runtimeRetryNotice.payload.capture.deviceName, "Focusrite USB Input");
assert.equal(runtimeRetryNotice.payload.capture.sampleRate, 48000);
assert.equal(runtimeRetryNotice.payload.capture.bufferMs, 60);
assert.equal(runtimeRetryNotice.payload.capture.startAttemptCount, 2);
assert.equal(lowSignalNotice.payload.capture.backend, "wasapi");
assert.equal(lowSignalNotice.payload.capture.profile, "balanced");
assert.equal(chunkGapNotice.payload.capture.backend, "wasapi");
assert.equal(chunkGapNotice.payload.capture.profile, "balanced");
assert.equal(preflightInvocations.length, 3);
assert.equal(captureInvocations.length, 2);
assert.equal(captureInvocations[0].captureProfile, "low-latency");
assert.equal(captureInvocations[0].deviceBackend, "wasapi");
assert.equal(captureInvocations[0].bufferMs, 25);
assert.equal(captureInvocations[1].captureProfile, "balanced");
assert.equal(captureInvocations[1].deviceBackend, "wasapi");
assert.equal(captureInvocations[1].deviceId, "wasapi-focusrite-001");
assert.equal(captureInvocations[1].deviceNumber, 0);
assert.equal(captureInvocations[1].bufferMs, 60);
assert.equal(captureInvocations[1].numberOfBuffers, 3);
assert.equal(captureInvocations[1].useEventSync, true);
assert.equal(captureInvocations[1].sampleRate, 48000);
assert.equal(summaryMessage.payload.capture.profile, "balanced");
assert.equal(summaryMessage.payload.capture.requestedProfile, "low-latency");
assert.equal(summaryMessage.payload.capture.backend, "wasapi");
assert.equal(summaryMessage.payload.capture.requestedBackend, "wavein");
assert.equal(summaryMessage.payload.capture.deviceName, "Focusrite USB Input");
assert.equal(summaryMessage.payload.capture.bufferMs, 60);
assert.equal(summaryMessage.payload.capture.numberOfBuffers, 3);
assert.equal(summaryMessage.payload.capture.startAttemptCount, 2);
assert.equal(summaryMessage.payload.capture.maxChunkGapMs, 340);
assert.ok(summaryMessage.payload.capture.lowSignalEventCount >= 1);
assert.ok(summaryMessage.payload.capture.lowSignalChunkCount >= 3);
assert.equal(summaryMessage.payload.capture.useEventSync, true);
assert.equal(summaryMessage.payload.capture.fallbackApplied, true);
assert.match(summaryMessage.payload.capture.fallbackReason, /capture start failed/i);
assert.ok(summaryMessage.payload.artifact?.filePath);
assert.equal(summaryMessage.payload.artifact.filePath, demoWavPath);
assert.ok(summaryMessage.payload.verification);
assert.equal(summaryMessage.payload.verification.status, "verified");
assert.equal(summaryMessage.payload.verification.checks.hasCapture, true);
assert.equal(summaryMessage.payload.verification.checks.hasArtifact, true);

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

await rm(tempDirectory, { recursive: true, force: true });

console.log("Engine native-capture smoke test passed.");
