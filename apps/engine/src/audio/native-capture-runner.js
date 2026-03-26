import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { isSea } from "node:sea";

function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout.trim());
        return;
      }

      rejectPromise(new Error(stderr.trim() || `Process exited with code ${code}.`));
    });
  });
}

function trimProcessOutput(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function isJsonLikeValue(value) {
  const trimmed = trimProcessOutput(value);
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function createOutputExcerpt(value, maxLength = 220) {
  const trimmed = trimProcessOutput(value).replace(/\s+/g, " ");

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

export function parseJsonOutputLine(value, description = "Native capture bridge") {
  const trimmed = trimProcessOutput(value);

  if (!trimmed || !isJsonLikeValue(trimmed)) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `${description} returned malformed JSON output line: ${createOutputExcerpt(trimmed)}`
    );
  }
}

export function extractJsonPayloadFromOutput(value, description = "Native capture bridge") {
  const trimmed = trimProcessOutput(value);

  if (!trimmed) {
    throw new Error(`${description} returned empty output.`);
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => trimProcessOutput(line))
    .filter(Boolean);
  const candidates = [];
  const seenCandidates = new Set();

  function addCandidate(candidate) {
    const normalizedCandidate = trimProcessOutput(candidate);

    if (!normalizedCandidate || seenCandidates.has(normalizedCandidate)) {
      return;
    }

    seenCandidates.add(normalizedCandidate);
    candidates.push(normalizedCandidate);
  }

  addCandidate(trimmed);

  for (const line of lines) {
    if (isJsonLikeValue(line)) {
      addCandidate(line);
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (isJsonLikeValue(lines[index])) {
      addCandidate(lines.slice(index).join("\n"));
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate built from a later JSON-looking line.
    }
  }

  throw new Error(
    `${description} returned non-JSON output. Output started with: ${createOutputExcerpt(lines[0] ?? trimmed)}`
  );
}

function normalizeDeviceName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferInputKind(name) {
  const normalizedName = normalizeDeviceName(name);

  if (
    /focusrite|scarlett|usb audio|line|instrument|analogue|behringer|presonus|audient|apollo|komplete|helix|axe fx|irig|steinberg/.test(
      normalizedName
    )
  ) {
    return "audio-interface";
  }

  return "microphone";
}

function enrichNativeDevices(devices) {
  const devicesByName = new Map();

  for (const device of devices) {
    const normalizedName = normalizeDeviceName(device.name);
    const entry = devicesByName.get(normalizedName) ?? [];
    entry.push(device);
    devicesByName.set(normalizedName, entry);
  }

  return devices.map((device) => {
    const inputKind = inferInputKind(device.name);
    const siblingDevices = devicesByName.get(normalizeDeviceName(device.name)) ?? [device];
    const recommendedBackend =
      inputKind === "audio-interface" && siblingDevices.some((candidate) => candidate.backend === "wasapi")
        ? "wasapi"
        : device.backend;
    const recommendedProfile = inputKind === "audio-interface" ? "low-latency" : "balanced";

    return {
      ...device,
      inputKind,
      recommendedBackend,
      recommendedProfile,
      isRecommendedPath: device.backend === recommendedBackend
    };
  });
}

/**
 * Returns the command, capture-specific argument prefix, and working directory
 * for invoking the native capture bridge, adapting to two runtime contexts:
 *
 * - Development: `dotnet run --project apps/native-capture-bridge` (source tree)
 * - Packaged SEA exe: `native-capture-bridge.exe` placed next to the engine exe
 */
function getNativeBridgeContext() {
  if (isSea()) {
    const engineDir = dirname(process.execPath);
    return {
      command: join(engineDir, "native-capture-bridge.exe"),
      prefixArgs: [],
      cwd: engineDir
    };
  }

  return {
    command: "dotnet",
    prefixArgs: ["run", "--project", "apps/native-capture-bridge", "-p:NuGetAudit=false", "--"],
    cwd: process.cwd()
  };
}

/**
 * Builds the capture-specific arguments passed to the native bridge binary.
 * These are the same in both development and packaged contexts.
 */
function buildCaptureBridgeArgs({
  outputPath = null,
  streamJson = false,
  preflightJson = false,
  captureDurationMs = 4000,
  sampleRate = 48000,
  captureProfile = "balanced",
  bufferMs = null,
  numberOfBuffers = null,
  useEventSync = null,
  deviceBackend = "wavein",
  deviceId = null,
  deviceNumber = 0
}) {
  return [
    ...(streamJson ? ["--stream-json"] : []),
    ...(preflightJson ? ["--preflight-json"] : []),
    ...(outputPath ? ["--output", outputPath] : []),
    "--duration-ms",
    String(captureDurationMs),
    "--capture-profile",
    String(captureProfile),
    ...(bufferMs !== null ? ["--buffer-ms", String(bufferMs)] : []),
    ...(numberOfBuffers !== null ? ["--number-of-buffers", String(numberOfBuffers)] : []),
    ...(useEventSync !== null ? ["--use-event-sync", String(useEventSync)] : []),
    "--backend",
    String(deviceBackend),
    "--device-number",
    String(deviceNumber),
    ...(deviceBackend === "wavein" ? ["--sample-rate", String(sampleRate)] : []),
    ...(deviceId ? ["--device-id", String(deviceId)] : [])
  ];
}

export async function runNativeCapture({
  sessionId,
  captureDurationMs = 4000,
  sampleRate = 48000,
  captureProfile = "balanced",
  bufferMs = null,
  numberOfBuffers = null,
  useEventSync = null,
  deviceBackend = "wavein",
  deviceId = null,
  deviceNumber = 0,
  onChunkCaptured,
  signal
}) {
  const { command, prefixArgs, cwd } = getNativeBridgeContext();
  const outputPath = resolve(cwd, `tmp/native-capture/${sessionId}.wav`);
  await mkdir(dirname(outputPath), { recursive: true });

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      command,
      [
        ...prefixArgs,
        ...buildCaptureBridgeArgs({
          outputPath,
          streamJson: true,
          captureDurationMs,
          sampleRate,
          captureProfile,
          bufferMs,
          numberOfBuffers,
          useEventSync,
          deviceBackend,
          deviceId,
          deviceNumber
        })
      ],
      {
        cwd,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stdoutBuffer = "";
    let stderr = "";
    let completedPath = null;
    let completedCapture = null;

    const handleStdoutLine = (line) => {
      if (!line.trim()) {
        return;
      }

      const message = parseJsonOutputLine(line, "Native capture stream");

      if (!message) {
        return;
      }

      if (message.type === "chunk") {
        onChunkCaptured?.({
          sampleRate: message.sampleRate,
          pcmBuffer: Buffer.from(message.chunkBase64, "base64")
        });
        return;
      }

      if (message.type === "completed") {
        completedPath = message.outputPath;
        completedCapture = message.capture ?? null;
      }
    };

    const onAbort = () => {
      child.kill();
    };

    if (signal) {
      if (signal.aborted) {
        child.kill();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        handleStdoutLine(line);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      signal?.removeEventListener("abort", onAbort);
      rejectPromise(error);
    });

    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);

      if (stdoutBuffer.trim()) {
        handleStdoutLine(stdoutBuffer.trim());
      }

      if (signal?.aborted) {
        rejectPromise(new Error("Native capture was aborted."));
        return;
      }

      if (code === 0) {
        resolvePromise({
          artifactPath: completedPath ?? outputPath,
          capture: completedCapture
        });
        return;
      }

      rejectPromise(new Error(stderr.trim() || `Process exited with code ${code}.`));
    });
  });
}

export async function listNativeCaptureDevices() {
  const { command, prefixArgs, cwd } = getNativeBridgeContext();
  const stdout = await runProcess(
    command,
    [...prefixArgs, "--list-devices-json"],
    { cwd }
  );

  const devices = extractJsonPayloadFromOutput(stdout, "Native device list");

  if (!Array.isArray(devices)) {
    throw new Error("Native capture bridge returned invalid device payload.");
  }

  return enrichNativeDevices(devices.map((device) => ({
    backend: device.backend,
    deviceId: device.deviceId ?? null,
    deviceNumber: Number(device.deviceNumber ?? 0),
    name: device.name,
    isDefault: Boolean(device.isDefault)
  })));
}

export async function runNativeCapturePreflight({
  captureDurationMs = 4000,
  sampleRate = 48000,
  captureProfile = "balanced",
  bufferMs = null,
  numberOfBuffers = null,
  useEventSync = null,
  deviceBackend = "wavein",
  deviceId = null,
  deviceNumber = 0
}) {
  const { command, prefixArgs, cwd } = getNativeBridgeContext();
  const stdout = await runProcess(
    command,
    [
      ...prefixArgs,
      ...buildCaptureBridgeArgs({
        preflightJson: true,
        captureDurationMs,
        sampleRate,
        captureProfile,
        bufferMs,
        numberOfBuffers,
        useEventSync,
        deviceBackend,
        deviceId,
        deviceNumber
      })
    ],
    { cwd }
  );

  const payload = extractJsonPayloadFromOutput(stdout, "Native capture preflight");

  if (!payload || typeof payload !== "object") {
    throw new Error("Native capture bridge returned invalid preflight payload.");
  }

  return payload;
}
