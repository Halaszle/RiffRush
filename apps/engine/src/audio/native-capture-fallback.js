import { buildNativeCapturePreflight } from "./native-capture-preflight.js";

function normalizeDeviceName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
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

function findEquivalentDevice(devices, referenceDevice, backend) {
  if (!referenceDevice) {
    return null;
  }

  const normalizedReferenceName = normalizeDeviceName(referenceDevice.name);
  const siblingDevices = devices.filter(
    (device) =>
      device.backend === backend &&
      normalizeDeviceName(device.name) === normalizedReferenceName
  );

  return (
    siblingDevices.find((device) => device.isRecommendedPath) ??
    siblingDevices.find((device) => device.isDefault) ??
    siblingDevices[0] ??
    null
  );
}

function buildRequestedSettings(payload) {
  return {
    captureDurationMs: payload.captureDurationMs ?? 4000,
    captureProfile: payload.captureProfile ?? "balanced",
    inputDeviceBackend: payload.inputDeviceBackend ?? "wavein",
    inputDeviceId: payload.inputDeviceId ?? null,
    inputDeviceNumber: payload.inputDeviceNumber ?? 0
  };
}

function buildAttemptDescriptor(candidate, ok, failureReason = null) {
  return {
    backend: candidate.inputDeviceBackend,
    captureProfile: candidate.captureProfile,
    ...(candidate.device?.name ? { deviceName: candidate.device.name } : {}),
    ok,
    ...(failureReason ? { failureReason } : {})
  };
}

function createCandidateAdder(candidates) {
  const seen = new Set();

  return (candidate) => {
    if (!candidate?.device) {
      return;
    }

    const key = JSON.stringify({
      captureProfile: candidate.captureProfile,
      inputDeviceBackend: candidate.inputDeviceBackend,
      inputDeviceId: candidate.inputDeviceId,
      inputDeviceNumber: candidate.inputDeviceNumber
    });

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push(candidate);
  };
}

function buildFallbackReason({
  requestedBackend,
  requestedProfile,
  nextBackend,
  nextProfile,
  recommendedBackend,
  recommendedProfile
}) {
  if (nextBackend === recommendedBackend && nextProfile === recommendedProfile) {
    return `Requested native capture path did not validate. Falling back to the recommended ${nextBackend.toUpperCase()} ${nextProfile} profile.`;
  }

  if (nextBackend !== requestedBackend && nextProfile !== requestedProfile) {
    return `Requested native capture path did not validate. Falling back from ${requestedBackend.toUpperCase()} ${requestedProfile} to ${nextBackend.toUpperCase()} ${nextProfile}.`;
  }

  if (nextBackend !== requestedBackend) {
    return `Requested native capture backend ${requestedBackend.toUpperCase()} did not validate. Falling back to ${nextBackend.toUpperCase()}.`;
  }

  if (nextProfile !== requestedProfile) {
    return `Requested native capture profile ${requestedProfile} did not validate. Falling back to ${nextProfile}.`;
  }

  return "Requested native capture path did not validate. Falling back to a safer device configuration.";
}

export function buildNativeCaptureFallbackCandidates({ devices, payload }) {
  const requestedSettings = buildRequestedSettings(payload);
  const requestedDevice = findSelectedDevice(devices, requestedSettings);

  if (!requestedDevice) {
    return [
      {
        ...requestedSettings,
        device: null,
        reason: null
      }
    ];
  }

  const candidates = [];
  const addCandidate = createCandidateAdder(candidates);
  const recommendedBackend = requestedDevice.recommendedBackend ?? requestedDevice.backend;
  const recommendedProfile = requestedDevice.recommendedProfile ?? requestedSettings.captureProfile;
  const requestedProfile = requestedSettings.captureProfile;
  const requestedBackend = requestedSettings.inputDeviceBackend;
  const equivalentRecommendedDevice = findEquivalentDevice(devices, requestedDevice, recommendedBackend);
  const equivalentRequestedDevice = findEquivalentDevice(devices, requestedDevice, requestedBackend) ?? requestedDevice;

  const createCandidate = ({ backend, captureProfile }) => {
    const device =
      backend === requestedBackend
        ? equivalentRequestedDevice
        : findEquivalentDevice(devices, requestedDevice, backend);

    if (!device) {
      return null;
    }

    return {
      captureDurationMs: requestedSettings.captureDurationMs,
      captureProfile,
      inputDeviceBackend: backend,
      inputDeviceId: device.deviceId ?? null,
      inputDeviceNumber: device.deviceNumber,
      device,
      reason:
        backend === requestedBackend && captureProfile === requestedProfile
          ? null
          : buildFallbackReason({
              requestedBackend,
              requestedProfile,
              nextBackend: backend,
              nextProfile: captureProfile,
              recommendedBackend,
              recommendedProfile
            })
    };
  };

  addCandidate(
    createCandidate({
      backend: requestedBackend,
      captureProfile: requestedProfile
    })
  );

  if (equivalentRecommendedDevice) {
    addCandidate(
      createCandidate({
        backend: recommendedBackend,
        captureProfile: requestedProfile
      })
    );
    addCandidate(
      createCandidate({
        backend: recommendedBackend,
        captureProfile: recommendedProfile
      })
    );
  }

  if (requestedProfile === "low-latency") {
    addCandidate(
      createCandidate({
        backend: requestedBackend,
        captureProfile: "balanced"
      })
    );

    if (equivalentRecommendedDevice) {
      addCandidate(
        createCandidate({
          backend: recommendedBackend,
          captureProfile: "balanced"
        })
      );
    }
  }

  if (requestedProfile !== "safe") {
    addCandidate(
      createCandidate({
        backend: requestedBackend,
        captureProfile: "safe"
      })
    );

    if (equivalentRecommendedDevice) {
      addCandidate(
        createCandidate({
          backend: recommendedBackend,
          captureProfile: "safe"
        })
      );
    }
  }

  return candidates;
}

export async function resolveNativeCaptureStrategy({
  devices,
  payload,
  nativeCapturePreflightRunner
}) {
  const requestedSettings = buildRequestedSettings(payload);
  const candidates = buildNativeCaptureFallbackCandidates({
    devices,
    payload: requestedSettings
  });
  const attempts = [];
  let lastPreflight = buildNativeCapturePreflight({
    devices,
    ...requestedSettings
  });

  for (const [candidateIndex, candidate] of candidates.entries()) {
    if (!candidate.device) {
      attempts.push(
        buildAttemptDescriptor(candidate, false, "Selected native input device could not be resolved on this machine.")
      );
      continue;
    }

    let diagnostics;

    try {
      diagnostics = await nativeCapturePreflightRunner({
        captureDurationMs: candidate.captureDurationMs,
        captureProfile: candidate.captureProfile,
        deviceBackend: candidate.inputDeviceBackend,
        deviceId: candidate.inputDeviceId,
        deviceNumber: candidate.inputDeviceNumber,
        sampleRate: 48000
      });
    } catch (error) {
      attempts.push(buildAttemptDescriptor(candidate, false, error.message));
      continue;
    }

    const preflight = buildNativeCapturePreflight({
      devices,
      captureDurationMs: diagnostics?.resolved?.captureDurationMs ?? candidate.captureDurationMs,
      captureProfile: diagnostics?.resolved?.captureProfile ?? candidate.captureProfile,
      inputDeviceBackend: diagnostics?.resolved?.backend ?? candidate.inputDeviceBackend,
      inputDeviceId: diagnostics?.selectedDevice?.deviceId ?? candidate.inputDeviceId,
      inputDeviceNumber: diagnostics?.selectedDevice?.deviceNumber ?? candidate.inputDeviceNumber,
      sampleRate: diagnostics?.resolved?.sampleRate ?? 48000,
      resolvedOverride: diagnostics?.resolved
    });

    attempts.push(buildAttemptDescriptor(candidate, preflight.ok, preflight.warnings[0] ?? null));
    lastPreflight = preflight;

    if (!preflight.ok || !preflight.selectedDevice) {
      continue;
    }

    const fallbackApplied = candidateIndex > 0;
    const warnings = fallbackApplied && candidate.reason
      ? [candidate.reason, ...preflight.warnings]
      : preflight.warnings;

    return {
      preflight: {
        ...preflight,
        hasWarnings: warnings.length > 0,
        warnings,
        requested: {
          captureProfile: requestedSettings.captureProfile,
          backend: requestedSettings.inputDeviceBackend
        },
        fallbackApplied,
        fallbackReason: fallbackApplied ? candidate.reason : null,
        attempts
      },
      candidates,
      selectedCandidate: candidate,
      selectedCandidateIndex: candidateIndex
    };
  }

  const warnings = [
    ...lastPreflight.warnings,
    "Engine could not validate the requested native capture settings or any safer fallback for this device."
  ];

  return {
    preflight: {
      ...lastPreflight,
      hasWarnings: warnings.length > 0,
      warnings,
      requested: {
        captureProfile: requestedSettings.captureProfile,
        backend: requestedSettings.inputDeviceBackend
      },
      fallbackApplied: false,
      fallbackReason: null,
      attempts
    },
    candidates,
    selectedCandidate: null,
    selectedCandidateIndex: -1
  };
}
