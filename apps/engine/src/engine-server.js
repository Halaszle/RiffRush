import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createWavArtifactWriter } from "./audio/wav-artifact-writer.js";
import {
  listNativeCaptureDevices as defaultListNativeCaptureDevices,
  runNativeCapturePreflight as defaultRunNativeCapturePreflight,
  runNativeCapture as defaultRunNativeCapture
} from "./audio/native-capture-runner.js";
import { createEnvelope, createErrorEnvelope, PROTOCOL_VERSION, parseProtocolMessage } from "../../../packages/protocol/src/runtime.js";
import { createSessionAnalyzer } from "./audio/session-analyzer.js";
import { decodePcm16Base64, decodePcm16Buffer } from "./audio/pcm16.js";
import { resolveNativeCaptureStrategy as buildNativeCaptureStrategy } from "./audio/native-capture-fallback.js";
import { createNativeCaptureRuntimeMonitor } from "./audio/native-capture-runtime-monitor.js";
import { runAnalyzedTrainingSession } from "./audio/session-pipeline.js";
import { decodeFrames, encodeCloseFrame, encodePongFrame, encodeTextFrame, WebSocketOpcode } from "./lib/websocket-frames.js";
import { runMockCalibration } from "./mock-calibration.js";

const ENGINE_VERSION = "0.1.0-mvp";
const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function buildWebSocketAcceptHeader(clientKey) {
  return createHash("sha1").update(`${clientKey}${WS_MAGIC_GUID}`).digest("base64");
}

function createConnectionContext(socket, heartbeatIntervalMs) {
  return {
    socket,
    heartbeatTimer: null,
    heartbeatIntervalMs,
    messageBuffer: Buffer.alloc(0),
    sessionAbortController: null,
    calibrationAbortController: null,
    nativePreflightInFlight: new Map(),
    nativePreflightCache: new Map(),
    liveSession: null,
    nativeCaptureSession: null
  };
}

function sendMessage(context, message) {
  context.socket.write(encodeTextFrame(JSON.stringify(message)));
}

function sendSessionNotice(context, sessionId, payload) {
  sendMessage(
    context,
    createEnvelope("session.notice", payload, {
      sessionId
    })
  );
}

function cleanupConnection(context) {
  if (context.heartbeatTimer) {
    clearInterval(context.heartbeatTimer);
    context.heartbeatTimer = null;
  }

  if (context.sessionAbortController) {
    context.sessionAbortController.abort();
    context.sessionAbortController = null;
  }

  if (context.calibrationAbortController) {
    context.calibrationAbortController.abort();
    context.calibrationAbortController = null;
  }

  context.liveSession = null;
  context.nativeCaptureSession = null;
}

function sliceFrames(samples, frameSize = 2048, sampleRate = null, baseTimestampMs = null) {
  const frames = [];
  const frameDurationMs =
    sampleRate && frameSize
      ? (frameSize / sampleRate) * 1000
      : null;

  for (let offset = 0; offset < samples.length; offset += frameSize) {
    const frame = new Float32Array(frameSize);
    frame.set(samples.subarray(offset, offset + frameSize));
    frames.push({
      samples: frame,
      ...(frameDurationMs !== null && baseTimestampMs !== null
        ? {
            timestampMs: Number((baseTimestampMs + (offset / frameSize) * frameDurationMs).toFixed(2))
          }
        : {})
    });
  }

  return frames;
}

function createNativePreflightKey({
  captureDurationMs = 4000,
  captureProfile = "balanced",
  inputDeviceBackend = "wavein",
  inputDeviceId = null,
  inputDeviceNumber = 0
}) {
  return JSON.stringify({
    captureDurationMs,
    captureProfile,
    inputDeviceBackend,
    inputDeviceId,
    inputDeviceNumber
  });
}

function createRequestedNativeCaptureSettings(payload) {
  return {
    captureProfile: payload.captureProfile ?? "balanced",
    backend: payload.inputDeviceBackend ?? "wavein"
  };
}

function createNativeCapturePayloadFromCandidate(candidate) {
  return {
    captureDurationMs: candidate.captureDurationMs,
    captureProfile: candidate.captureProfile,
    inputDeviceBackend: candidate.inputDeviceBackend,
    inputDeviceId: candidate.inputDeviceId,
    inputDeviceNumber: candidate.inputDeviceNumber
  };
}

function buildNativeCaptureRuntimeFallbackReason({ failedPreflight, nextPreflight, error }) {
  const failedPath = `${failedPreflight.resolved.backend.toUpperCase()} ${failedPreflight.resolved.captureProfile}`;
  const nextPath = `${nextPreflight.resolved.backend.toUpperCase()} ${nextPreflight.resolved.captureProfile}`;
  return `Capture start failed on ${failedPath}: ${error.message}. Falling back to ${nextPath}.`;
}

function buildNativeCapturePathDescriptor(preflight, startAttemptCount = null) {
  return {
    ...(preflight.requested?.captureProfile
      ? { requestedProfile: preflight.requested.captureProfile }
      : {}),
    ...(preflight.requested?.backend
      ? { requestedBackend: preflight.requested.backend }
      : {}),
    ...(preflight.resolved.captureProfile
      ? { profile: preflight.resolved.captureProfile }
      : {}),
    ...(preflight.resolved.backend
      ? { backend: preflight.resolved.backend }
      : {}),
    ...(preflight.selectedDevice?.name
      ? { deviceName: preflight.selectedDevice.name }
      : {}),
    ...(preflight.resolved.sampleRate
      ? { sampleRate: preflight.resolved.sampleRate }
      : {}),
    ...(preflight.resolved.bufferMs
      ? { bufferMs: preflight.resolved.bufferMs }
      : {}),
    ...(preflight.resolved.numberOfBuffers
      ? { numberOfBuffers: preflight.resolved.numberOfBuffers }
      : {}),
    ...(preflight.resolved.useEventSync !== undefined
      ? { useEventSync: preflight.resolved.useEventSync }
      : {}),
    ...(startAttemptCount ? { startAttemptCount } : {})
  };
}

function buildNativeCaptureSummaryCapture(activeSession, capture) {
  const fallbackApplied =
    Boolean(activeSession.runtimeFallbackReason) || Boolean(activeSession.preflight.fallbackApplied);
  const fallbackReason =
    activeSession.runtimeFallbackReason ?? activeSession.preflight.fallbackReason ?? null;

  return {
    ...(activeSession.preflight.resolved.captureProfile
      ? { profile: activeSession.preflight.resolved.captureProfile }
      : {}),
    ...(activeSession.requestedCapture.captureProfile
      ? { requestedProfile: activeSession.requestedCapture.captureProfile }
      : {}),
    ...(activeSession.preflight.resolved.backend
      ? { backend: activeSession.preflight.resolved.backend }
      : {}),
    ...(activeSession.requestedCapture.backend
      ? { requestedBackend: activeSession.requestedCapture.backend }
      : {}),
    ...(activeSession.preflight.selectedDevice?.deviceId
      ? { deviceId: activeSession.preflight.selectedDevice.deviceId }
      : {}),
    ...(activeSession.preflight.selectedDevice?.name
      ? { deviceName: activeSession.preflight.selectedDevice.name }
      : {}),
    ...(activeSession.preflight.selectedDevice?.deviceNumber !== undefined
      ? { deviceNumber: activeSession.preflight.selectedDevice.deviceNumber }
      : {}),
    ...(activeSession.preflight.resolved.sampleRate
      ? { sampleRate: activeSession.preflight.resolved.sampleRate }
      : {}),
    ...(activeSession.preflight.resolved.captureDurationMs
      ? { durationMs: activeSession.preflight.resolved.captureDurationMs }
      : {}),
    ...(activeSession.preflight.resolved.bufferMs
      ? { bufferMs: activeSession.preflight.resolved.bufferMs }
      : {}),
    ...(activeSession.preflight.resolved.numberOfBuffers
      ? { numberOfBuffers: activeSession.preflight.resolved.numberOfBuffers }
      : {}),
    ...(activeSession.preflight.resolved.useEventSync !== undefined
      ? { useEventSync: activeSession.preflight.resolved.useEventSync }
      : {}),
    ...(fallbackApplied ? { fallbackApplied: true } : {}),
    ...(fallbackReason ? { fallbackReason } : {}),
    ...(activeSession.startAttemptCount ? { startAttemptCount: activeSession.startAttemptCount } : {}),
    ...(activeSession.runtimeMonitor?.snapshot?.() ?? {}),
    ...(capture ?? {})
  };
}

function buildPracticePresetSummary({
  practiceScope,
  loopSectionId,
  tempoBpm,
  loopSectionLabel = null,
  loopRepetitionCount = null,
  loopTempoStepBpm = null,
  repetitions = null
}) {
  return {
    scope: practiceScope ?? (loopSectionId ? "section-loop" : "full-chart"),
    tempoBpm: tempoBpm ?? 0,
    ...(loopSectionId
      ? {
          loopSectionId,
          ...(loopSectionLabel ? { loopSectionLabel } : {})
        }
      : {}),
    ...(loopRepetitionCount && loopRepetitionCount > 1 ? { loopRepetitionCount } : {}),
    ...(loopTempoStepBpm && loopTempoStepBpm > 0 ? { loopTempoStepBpm } : {}),
    ...(Array.isArray(repetitions) && repetitions.length > 0 ? { repetitions } : {})
  };
}

function createNativeCaptureSessionRuntimeMonitor({ activeSession, context, sessionId }) {
  return createNativeCaptureRuntimeMonitor({
    configuredBufferMs: activeSession.preflight?.resolved?.bufferMs ?? 0,
    onNotice: (payload) => sendSessionNotice(context, sessionId, payload),
    captureDescriptorFactory: () =>
      buildNativeCapturePathDescriptor(
        activeSession.preflight,
        activeSession.startAttemptCount ?? 1
      )
  });
}

async function runNativeCaptureSessionWithFallback({
  context,
  message,
  strategy,
  nativeCaptureRunner,
  nativeDeviceLister,
  nativeCapturePreflightRunner
}) {
  const activeSession = context.nativeCaptureSession;

  if (!activeSession) {
    return;
  }

  for (
    let candidateIndex = strategy.selectedCandidateIndex;
    candidateIndex < strategy.candidates.length;
    candidateIndex += 1
  ) {
    const candidate = strategy.candidates[candidateIndex];
    let currentStrategy = strategy;

    if (candidateIndex !== strategy.selectedCandidateIndex) {
      currentStrategy = await resolveNativeCaptureStrategy({
        context,
        nativeDeviceLister,
        nativeCapturePreflightRunner,
        payload: createNativeCapturePayloadFromCandidate(candidate)
      });

      if (!currentStrategy.preflight.ok || !currentStrategy.preflight.selectedDevice) {
        continue;
      }
    }

    activeSession.preflight = currentStrategy.preflight;
    activeSession.chunkCount = 0;
    activeSession.startAttemptCount += 1;
    activeSession.runtimeMonitor = createNativeCaptureSessionRuntimeMonitor({
      activeSession,
      context,
      sessionId: message.sessionId
    });

    try {
      const { artifactPath, capture } = await nativeCaptureRunner({
        sessionId: message.sessionId,
        captureDurationMs: currentStrategy.preflight.resolved.captureDurationMs,
        sampleRate: currentStrategy.preflight.resolved.sampleRate,
        captureProfile: currentStrategy.preflight.resolved.captureProfile,
        bufferMs: currentStrategy.preflight.resolved.bufferMs,
        numberOfBuffers: currentStrategy.preflight.resolved.numberOfBuffers,
        useEventSync: currentStrategy.preflight.resolved.useEventSync,
        deviceBackend: currentStrategy.preflight.resolved.backend,
        deviceId: currentStrategy.preflight.selectedDevice.deviceId ?? null,
        deviceNumber: currentStrategy.preflight.selectedDevice.deviceNumber,
        signal: context.sessionAbortController.signal,
        onChunkCaptured: ({ pcmBuffer, sampleRate, capturedAtMs }) => {
          if (!context.nativeCaptureSession) {
            return;
          }

          context.nativeCaptureSession.chunkCount += 1;

          if (!context.nativeCaptureSession.analyzer) {
            context.nativeCaptureSession.analyzer = createSessionAnalyzer({
              send: (outgoingMessage) => sendMessage(context, outgoingMessage),
              sessionId: message.sessionId,
              exerciseId: context.nativeCaptureSession.exerciseId,
              sampleRate,
              tempoBpm: context.nativeCaptureSession.tempoBpm,
              practiceScope: context.nativeCaptureSession.practiceScope,
              loopSectionId: context.nativeCaptureSession.loopSectionId,
              loopRepetitionCount: context.nativeCaptureSession.loopRepetitionCount,
              loopTempoStepBpm: context.nativeCaptureSession.loopTempoStepBpm
            });
          }

          const samples = decodePcm16Buffer(pcmBuffer);
          context.nativeCaptureSession.runtimeMonitor?.observeChunk({
            samples,
            sampleRate,
            capturedAtMs
          });
          const frames = sliceFrames(samples, 2048, sampleRate, capturedAtMs ?? null);

          for (const frame of frames) {
            context.nativeCaptureSession.analyzer.processSamples(frame.samples, {
              timestampMs: frame.timestampMs
            });
          }
        }
      });

      const finalizedSession = context.nativeCaptureSession;

      if (!finalizedSession) {
        return;
      }

      const analyzer =
        finalizedSession.analyzer ??
        createSessionAnalyzer({
          send: (outgoingMessage) => sendMessage(context, outgoingMessage),
          sessionId: message.sessionId,
          exerciseId: finalizedSession.exerciseId,
          sampleRate: finalizedSession.preflight?.resolved?.sampleRate ?? 48000,
          tempoBpm: finalizedSession.tempoBpm,
          practiceScope: finalizedSession.practiceScope,
          loopSectionId: finalizedSession.loopSectionId,
          loopRepetitionCount: finalizedSession.loopRepetitionCount,
          loopTempoStepBpm: finalizedSession.loopTempoStepBpm
        });

      const practicePlan = analyzer.getPracticePlan?.();
      analyzer.finalize({
        capture: buildNativeCaptureSummaryCapture(finalizedSession, capture),
        practicePreset: buildPracticePresetSummary({
          practiceScope: finalizedSession.practiceScope,
          loopSectionId: finalizedSession.loopSectionId,
          tempoBpm: finalizedSession.tempoBpm,
          loopSectionLabel: analyzer.getLoopSectionLabel?.(),
          loopRepetitionCount: practicePlan?.loopRepetitionCount,
          loopTempoStepBpm: practicePlan?.loopTempoStepBpm,
          repetitions: practicePlan?.repetitions
        }),
        artifact: {
          type: "wav-file",
          filePath: artifactPath
        }
      });
      context.nativeCaptureSession = null;
      return;
    } catch (error) {
      if (context.sessionAbortController.signal.aborted) {
        context.nativeCaptureSession = null;
        throw error;
      }

      const canRetry =
        activeSession.chunkCount === 0 && candidateIndex + 1 < strategy.candidates.length;

      if (!canRetry) {
        context.nativeCaptureSession = null;
        throw error;
      }

      const nextCandidate = strategy.candidates[candidateIndex + 1];
      const nextStrategy = await resolveNativeCaptureStrategy({
        context,
        nativeDeviceLister,
        nativeCapturePreflightRunner,
        payload: createNativeCapturePayloadFromCandidate(nextCandidate)
      });

      if (!nextStrategy.preflight.ok || !nextStrategy.preflight.selectedDevice) {
        continue;
      }

      activeSession.runtimeFallbackReason = buildNativeCaptureRuntimeFallbackReason({
        failedPreflight: currentStrategy.preflight,
        nextPreflight: nextStrategy.preflight,
        error
      });
      sendSessionNotice(context, message.sessionId, {
        code: "NATIVE_CAPTURE_RUNTIME_RETRY",
        level: "warning",
        message: activeSession.runtimeFallbackReason,
        capture: buildNativeCapturePathDescriptor(nextStrategy.preflight, activeSession.startAttemptCount + 1)
      });
    }
  }

  context.nativeCaptureSession = null;
  throw new Error("Engine could not start native capture on any validated fallback path.");
}

async function resolveNativeCaptureStrategy({
  context,
  nativeDeviceLister,
  nativeCapturePreflightRunner,
  payload
}) {
  const preflightKey = createNativePreflightKey(payload);
  const cached = context.nativePreflightCache.get(preflightKey);

  if (cached) {
    return cached;
  }

  const inFlight = context.nativePreflightInFlight.get(preflightKey);

  if (inFlight) {
    return inFlight;
  }

  const preflightPromise = Promise.all([
    nativeDeviceLister()
  ])
    .then(async ([devices]) => {
      const strategy = await buildNativeCaptureStrategy({
        devices,
        payload,
        nativeCapturePreflightRunner
      });

      context.nativePreflightCache.set(preflightKey, strategy);
      return strategy;
    })
    .finally(() => {
      context.nativePreflightInFlight.delete(preflightKey);
    });

  context.nativePreflightInFlight.set(preflightKey, preflightPromise);
  return preflightPromise;
}

async function resolveNativeCapturePreflight(input) {
  const strategy = await resolveNativeCaptureStrategy(input);
  return strategy.preflight;
}

export function createEngineServer(
  { host, port, heartbeatIntervalMs },
  {
    nativeCaptureRunner = defaultRunNativeCapture,
    nativeCapturePreflightRunner = defaultRunNativeCapturePreflight,
    nativeDeviceLister = defaultListNativeCaptureDevices
  } = {}
) {
  const startedAt = Date.now();

  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      });
      response.end(
        JSON.stringify(
          {
            data: {
              status: "ok",
              service: "riffrush-engine",
              engineVersion: ENGINE_VERSION,
              uptimeMs: Date.now() - startedAt,
              websocketUrl: `ws://${host}:${port}`
            }
          },
          null,
          2
        )
      );
      return;
    }

    response.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8"
    });
    response.end(
      JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: `Route ${request.method} ${request.url} is not implemented.`
        }
      })
    );
  });

  server.on("upgrade", (request, socket) => {
    if (request.url !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const clientKey = request.headers["sec-websocket-key"];

    if (!clientKey || Array.isArray(clientKey)) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    const acceptKey = buildWebSocketAcceptHeader(clientKey);

    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "\r\n"
      ].join("\r\n")
    );

    const context = createConnectionContext(socket, heartbeatIntervalMs);

    context.heartbeatTimer = setInterval(() => {
      sendMessage(
        context,
        createEnvelope("engine.heartbeat", {
          uptimeMs: Date.now() - startedAt,
          audioDeviceConnected: true
        })
      );
    }, heartbeatIntervalMs);

    socket.on("data", async (chunk) => {
      context.messageBuffer = Buffer.concat([context.messageBuffer, chunk]);
      const { frames, remainingBuffer } = decodeFrames(context.messageBuffer);
      context.messageBuffer = remainingBuffer;

      for (const frame of frames) {
        if (frame.opcode === WebSocketOpcode.PING) {
          socket.write(encodePongFrame(frame.payload));
          continue;
        }

        if (frame.opcode === WebSocketOpcode.CLOSE) {
          cleanupConnection(context);
          socket.write(encodeCloseFrame());
          socket.end();
          return;
        }

        if (frame.opcode !== WebSocketOpcode.TEXT) {
          sendMessage(
            context,
            createErrorEnvelope("INTERNAL_ERROR", "Unsupported frame opcode received.")
          );
          continue;
        }

        let message;

        try {
          message = parseProtocolMessage(frame.payload.toString("utf8"));
        } catch (error) {
          sendMessage(
            context,
            createErrorEnvelope("UNSUPPORTED_PROTOCOL", error.message, {
              retryable: false
            })
          );
          continue;
        }

        if (message.type === "engine.init") {
          const minVersion = message.payload?.minVersion;
          const maxVersion = message.payload?.maxVersion;
          const versionIsSupported =
            Number.isInteger(minVersion) &&
            Number.isInteger(maxVersion) &&
            minVersion <= PROTOCOL_VERSION &&
            maxVersion >= PROTOCOL_VERSION;

          if (!versionIsSupported) {
            sendMessage(
              context,
              createErrorEnvelope(
                "UNSUPPORTED_PROTOCOL",
                `Protocol version ${PROTOCOL_VERSION} is outside the supported range.`
              )
            );
            continue;
          }

          sendMessage(
            context,
            createEnvelope(
              "engine.ready",
              {
                engineVersion: ENGINE_VERSION,
                capabilities: {
                  audio: true,
                  scoring: true,
                  calibration: true
                }
              },
              {
                sessionId: message.sessionId,
                requestId: message.requestId
              }
            )
          );
          continue;
        }

        if (message.type === "calibration.start") {
          if (context.calibrationAbortController) {
            context.calibrationAbortController.abort();
          }

          context.calibrationAbortController = new AbortController();

          runMockCalibration({
            send: (outgoingMessage) => sendMessage(context, outgoingMessage),
            signal: context.calibrationAbortController.signal
          }).catch((error) => {
            sendMessage(
              context,
              createErrorEnvelope("INTERNAL_ERROR", error.message, {
                retryable: true
              })
            );
          });
          continue;
        }

        if (message.type === "native.devices.request") {
          nativeDeviceLister()
            .then((devices) => {
              sendMessage(
                context,
                createEnvelope(
                  "native.devices.response",
                  {
                    devices
                  },
                  {
                    sessionId: message.sessionId,
                    requestId: message.requestId
                  }
                )
              );
            })
            .catch((error) => {
              sendMessage(
                context,
                createErrorEnvelope("INTERNAL_ERROR", error.message, {
                  sessionId: message.sessionId,
                  requestId: message.requestId,
                  retryable: true
                })
              );
            });
          continue;
        }

        if (message.type === "native.preflight.request") {
          resolveNativeCapturePreflight({
            context,
            nativeDeviceLister,
            nativeCapturePreflightRunner,
            payload: message.payload
          })
            .then((preflight) => {
              sendMessage(
                context,
                createEnvelope(
                  "native.preflight.response",
                  preflight,
                  {
                    sessionId: message.sessionId,
                    requestId: message.requestId
                  }
                )
              );
            })
            .catch((error) => {
              sendMessage(
                context,
                createErrorEnvelope("INTERNAL_ERROR", error.message, {
                  sessionId: message.sessionId,
                  requestId: message.requestId,
                  retryable: true
                })
              );
            });
          continue;
        }

        if (message.type === "session.start") {
          if (context.sessionAbortController) {
            context.sessionAbortController.abort();
          }

          context.liveSession = null;
          context.nativeCaptureSession = null;

          context.sessionAbortController = new AbortController();
          const inputMode = message.payload.inputMode ?? "synthetic";

          if (inputMode === "native-capture") {
            let strategy;

            try {
              strategy = await resolveNativeCaptureStrategy({
                context,
                nativeDeviceLister,
                nativeCapturePreflightRunner,
                payload: message.payload
              });
            } catch (error) {
              sendMessage(
                context,
                createErrorEnvelope("INTERNAL_ERROR", error.message, {
                  sessionId: message.sessionId,
                  requestId: message.requestId,
                  retryable: true
                })
              );
              continue;
            }

            const preflight = strategy.preflight;

            if (!preflight.ok || !preflight.selectedDevice) {
              sendMessage(
                context,
                createErrorEnvelope(
                  "AUDIO_DEVICE_NOT_FOUND",
                  preflight.warnings.join(" ") || "Native capture preflight could not resolve the selected device.",
                  {
                    sessionId: message.sessionId,
                    requestId: message.requestId,
                    retryable: false
                  }
                )
              );
              continue;
            }

            context.nativeCaptureSession = {
              sessionId: message.sessionId,
              exerciseId: message.payload.exerciseId,
              tempoBpm: message.payload.tempoBpm,
              practiceScope: message.payload.practiceScope ?? "full-chart",
              loopSectionId: message.payload.loopSectionId ?? null,
              loopRepetitionCount: message.payload.loopRepetitionCount ?? 1,
              loopTempoStepBpm: message.payload.loopTempoStepBpm ?? 0,
              analyzer: null,
              runtimeMonitor: null,
              preflight,
              requestedCapture: createRequestedNativeCaptureSettings(message.payload),
              runtimeFallbackReason: null,
              startAttemptCount: 0,
              chunkCount: 0
            };

            sendMessage(
              context,
              createEnvelope(
                "session.started",
                {
                  trainingId: message.payload.trainingId,
                  exerciseId: message.payload.exerciseId,
                  practiceScope: message.payload.practiceScope ?? "full-chart",
                  ...(message.payload.loopSectionId ? { loopSectionId: message.payload.loopSectionId } : {}),
                  ...(message.payload.loopRepetitionCount ? { loopRepetitionCount: message.payload.loopRepetitionCount } : {}),
                  ...(message.payload.loopTempoStepBpm ? { loopTempoStepBpm: message.payload.loopTempoStepBpm } : {}),
                  tempoBpm: message.payload.tempoBpm,
                  calibrationOffsetMs: message.payload.calibrationOffsetMs,
                  inputMode
                },
                {
                  sessionId: message.sessionId,
                  requestId: message.requestId
                }
              )
            );

            if (preflight.fallbackApplied && preflight.fallbackReason) {
              sendSessionNotice(context, message.sessionId, {
                code: "NATIVE_CAPTURE_PREFLIGHT_FALLBACK",
                level: "warning",
                message: preflight.fallbackReason,
                capture: buildNativeCapturePathDescriptor(preflight, 1)
              });
            }

            runNativeCaptureSessionWithFallback({
              context,
              message,
              strategy,
              nativeCaptureRunner,
              nativeDeviceLister,
              nativeCapturePreflightRunner
            })
              .catch((error) => {
                context.nativeCaptureSession = null;
                sendMessage(
                  context,
                  createErrorEnvelope("INTERNAL_ERROR", error.message, {
                    sessionId: message.sessionId,
                    retryable: true
                  })
                );
              });

            continue;
          }

          sendMessage(
            context,
            createEnvelope(
              "session.started",
              {
                trainingId: message.payload.trainingId,
                exerciseId: message.payload.exerciseId,
                practiceScope: message.payload.practiceScope ?? "full-chart",
                ...(message.payload.loopSectionId ? { loopSectionId: message.payload.loopSectionId } : {}),
                ...(message.payload.loopRepetitionCount ? { loopRepetitionCount: message.payload.loopRepetitionCount } : {}),
                ...(message.payload.loopTempoStepBpm ? { loopTempoStepBpm: message.payload.loopTempoStepBpm } : {}),
                tempoBpm: message.payload.tempoBpm,
                calibrationOffsetMs: message.payload.calibrationOffsetMs,
                inputMode
              },
              {
                sessionId: message.sessionId,
                requestId: message.requestId
              }
            )
          );

          if (inputMode === "live-stream") {
            context.liveSession = {
              sessionId: message.sessionId,
              exerciseId: message.payload.exerciseId,
              tempoBpm: message.payload.tempoBpm,
              practiceScope: message.payload.practiceScope ?? "full-chart",
              loopSectionId: message.payload.loopSectionId ?? null,
              loopRepetitionCount: message.payload.loopRepetitionCount ?? 1,
              loopTempoStepBpm: message.payload.loopTempoStepBpm ?? 0,
              chunkCount: 0,
              sampleRate: null,
              artifactWriter: null,
              analyzer: null
            };
            continue;
          }

          runAnalyzedTrainingSession({
            send: (outgoingMessage) => sendMessage(context, outgoingMessage),
            sessionId: message.sessionId,
            exerciseId: message.payload.exerciseId,
            tempoBpm: message.payload.tempoBpm,
            practiceScope: message.payload.practiceScope ?? "full-chart",
            loopSectionId: message.payload.loopSectionId ?? null,
            loopRepetitionCount: message.payload.loopRepetitionCount ?? 1,
            loopTempoStepBpm: message.payload.loopTempoStepBpm ?? 0,
            inputMode,
            inputFilePath: message.payload.inputFilePath,
            artifactFilePath:
              inputMode === "wav-file" ? message.payload.inputFilePath : undefined,
            signal: context.sessionAbortController.signal
          }).catch((error) => {
            sendMessage(
              context,
              createErrorEnvelope("INTERNAL_ERROR", error.message, {
                sessionId: message.sessionId,
                retryable: true
              })
            );
          });

          continue;
        }

        if (message.type === "audio.stream.chunk") {
          if (!context.liveSession || context.liveSession.sessionId !== message.sessionId) {
            sendMessage(
              context,
              createErrorEnvelope("SESSION_NOT_ACTIVE", "No matching live-stream session is active.", {
                sessionId: message.sessionId,
                retryable: false
              })
            );
            continue;
          }

          try {
            const pcmBuffer = Buffer.from(message.payload.chunkBase64, "base64");
            const samples = decodePcm16Base64(message.payload.chunkBase64);
            const sampleRate = message.payload.sampleRate;
            const frames = sliceFrames(
              samples,
              2048,
              sampleRate,
              context.liveSession.chunkCount * ((2048 / sampleRate) * 1000)
            );

            if (!context.liveSession.analyzer) {
              context.liveSession.artifactWriter = createWavArtifactWriter({
                sessionId: message.sessionId,
                sampleRate
              });
              context.liveSession.analyzer = createSessionAnalyzer({
                send: (outgoingMessage) => sendMessage(context, outgoingMessage),
                sessionId: message.sessionId,
                exerciseId: context.liveSession.exerciseId,
                sampleRate,
                tempoBpm: context.liveSession.tempoBpm,
                practiceScope: context.liveSession.practiceScope,
                loopSectionId: context.liveSession.loopSectionId,
                loopRepetitionCount: context.liveSession.loopRepetitionCount,
                loopTempoStepBpm: context.liveSession.loopTempoStepBpm
              });
            }

            context.liveSession.sampleRate = sampleRate;
            context.liveSession.chunkCount += 1;
            context.liveSession.artifactWriter.appendPcmChunk(pcmBuffer);

            for (const frame of frames) {
              context.liveSession.analyzer.processSamples(frame.samples, {
                timestampMs: frame.timestampMs
              });
            }
          } catch (error) {
            sendMessage(
              context,
              createErrorEnvelope("INTERNAL_ERROR", error.message, {
                sessionId: message.sessionId,
                retryable: false
              })
            );
          }
          continue;
        }

        if (message.type === "session.stop") {
          if (!context.liveSession || context.liveSession.sessionId !== message.sessionId) {
            sendMessage(
              context,
              createErrorEnvelope("SESSION_NOT_ACTIVE", "Cannot stop a session that is not active.", {
                sessionId: message.sessionId,
                retryable: false
              })
            );
            continue;
          }

          try {
            const artifactPath = context.liveSession.artifactWriter
              ? await context.liveSession.artifactWriter.finalize()
              : null;
            const practicePlan = context.liveSession.analyzer?.getPracticePlan?.();

            context.liveSession.analyzer?.finalize(
              {
                capture: {
                  source: "live-stream",
                  sampleRate: context.liveSession.sampleRate ?? undefined,
                  chunkCount: context.liveSession.chunkCount,
                  durationMs:
                    context.liveSession.sampleRate && context.liveSession.chunkCount
                      ? Math.round((context.liveSession.chunkCount * 2048 / context.liveSession.sampleRate) * 1000)
                      : undefined
                },
                ...(artifactPath
                  ? {
                      artifact: {
                        type: "wav-file",
                        filePath: artifactPath
                      }
                    }
                  : {}),
                practicePreset: buildPracticePresetSummary({
                  practiceScope: context.liveSession.practiceScope,
                  loopSectionId: context.liveSession.loopSectionId,
                  tempoBpm: context.liveSession.tempoBpm,
                  loopSectionLabel: context.liveSession.analyzer?.getLoopSectionLabel?.(),
                  loopRepetitionCount: practicePlan?.loopRepetitionCount,
                  loopTempoStepBpm: practicePlan?.loopTempoStepBpm,
                  repetitions: practicePlan?.repetitions
                })
              }
            );
          } catch (error) {
            sendMessage(
              context,
              createErrorEnvelope("INTERNAL_ERROR", error.message, {
                sessionId: message.sessionId,
                retryable: false
              })
            );
          }
          context.liveSession = null;
          continue;
        }

        sendMessage(
          context,
          createErrorEnvelope("INTERNAL_ERROR", `Unsupported message type ${message.type}.`, {
            sessionId: message.sessionId
          })
        );
      }
    });

    socket.on("close", () => {
      cleanupConnection(context);
    });

    socket.on("end", () => {
      cleanupConnection(context);
    });

    socket.on("error", () => {
      cleanupConnection(context);
    });
  });

  return server;
}
