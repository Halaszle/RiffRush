import { createEnvelope } from "../../../packages/protocol/src/runtime.js";

const DEFAULT_STEP_DELAY_MS = 350;

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

const calibrationSteps = [
  "Checking noise floor",
  "Measuring latency baseline",
  "Calculating recommended compensation"
];

export async function runMockCalibration({ send, signal }) {
  send(
    createEnvelope("calibration.started", {
      mode: "latency-check"
    })
  );

  for (let index = 0; index < calibrationSteps.length; index += 1) {
    if (signal.aborted) {
      return;
    }

    await wait(DEFAULT_STEP_DELAY_MS);

    if (signal.aborted) {
      return;
    }

    send(
      createEnvelope("calibration.progress", {
        step: index + 1,
        totalSteps: calibrationSteps.length,
        message: calibrationSteps[index]
      })
    );
  }

  await wait(DEFAULT_STEP_DELAY_MS);

  if (signal.aborted) {
    return;
  }

  send(
    createEnvelope("calibration.result", {
      recommendedOffsetMs: 14,
      measuredLatencyMs: 28,
      noiseFloorDb: -53
    })
  );
}
