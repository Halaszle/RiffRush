function resolveCaptureProfileSettings(captureProfile = "balanced") {
  switch (captureProfile) {
    case "safe":
      return {
        captureProfile: "safe",
        bufferMs: 120,
        numberOfBuffers: 4,
        useEventSync: false
      };
    case "low-latency":
      return {
        captureProfile: "low-latency",
        bufferMs: 25,
        numberOfBuffers: 2,
        useEventSync: true
      };
    default:
      return {
        captureProfile: "balanced",
        bufferMs: 60,
        numberOfBuffers: 3,
        useEventSync: true
      };
  }
}

function findSelectedDevice(devices, { inputDeviceBackend, inputDeviceId, inputDeviceNumber }) {
  if (inputDeviceId) {
    return (
      devices.find(
        (device) =>
          device.backend === inputDeviceBackend &&
          device.deviceId === inputDeviceId
      ) ?? null
    );
  }

  return (
    devices.find(
      (device) =>
        device.backend === inputDeviceBackend &&
        device.deviceNumber === inputDeviceNumber
    ) ?? null
  );
}

function buildWarnings(selectedDevice, resolved) {
  if (!selectedDevice) {
    return ["Selected native input device could not be resolved on this machine."];
  }

  const warnings = [];

  if (selectedDevice.inputKind === "audio-interface" && resolved.backend !== "wasapi") {
    warnings.push("Audio interfaces usually work better through WASAPI than WaveIn.");
  }

  if (
    selectedDevice.inputKind === "audio-interface" &&
    resolved.captureProfile !== "low-latency"
  ) {
    warnings.push("Audio interfaces are typically best tested first with the low-latency capture profile.");
  }

  if (
    selectedDevice.inputKind === "microphone" &&
    resolved.captureProfile === "low-latency"
  ) {
    warnings.push("Low-latency mode on consumer microphones may be less stable than balanced mode.");
  }

  if (
    selectedDevice.recommendedBackend &&
    selectedDevice.recommendedBackend !== resolved.backend
  ) {
    warnings.push(
      `This device is currently on ${resolved.backend.toUpperCase()}, but the recommended backend is ${selectedDevice.recommendedBackend.toUpperCase()}.`
    );
  }

  if (
    selectedDevice.recommendedProfile &&
    selectedDevice.recommendedProfile !== resolved.captureProfile
  ) {
    warnings.push(
      `This device is currently on profile ${resolved.captureProfile}, but the recommended profile is ${selectedDevice.recommendedProfile}.`
    );
  }

  return warnings;
}

export function buildNativeCapturePreflight({
  devices,
  captureDurationMs = 4000,
  captureProfile = "balanced",
  inputDeviceBackend = "wavein",
  inputDeviceId = null,
  inputDeviceNumber = 0,
  sampleRate = 48000,
  resolvedOverride = null
}) {
  const resolved = {
    ...resolveCaptureProfileSettings(captureProfile),
    backend: inputDeviceBackend,
    sampleRate,
    captureDurationMs,
    ...(resolvedOverride ?? {})
  };
  const selectedDevice = findSelectedDevice(devices, {
    inputDeviceBackend,
    inputDeviceId,
    inputDeviceNumber
  });
  const warnings = buildWarnings(selectedDevice, resolved);

  return {
    ok: Boolean(selectedDevice),
    hasWarnings: warnings.length > 0,
    selectedDevice,
    resolved,
    warnings
  };
}
