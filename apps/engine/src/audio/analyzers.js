import { frequencyToNote } from "./note-library.js";

export function calculateRms(samples) {
  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;

  for (const sample of samples) {
    sum += sample * sample;
  }

  return Math.sqrt(sum / samples.length);
}

export function detectOnset(previousRms, currentRms, options = {}) {
  const energyThreshold = options.energyThreshold ?? 0.08;
  const deltaThreshold = options.deltaThreshold ?? 0.04;
  const delta = currentRms - previousRms;

  return currentRms >= energyThreshold && delta >= deltaThreshold;
}

/**
 * Estimates the fundamental frequency of a pitched signal using the YIN
 * algorithm (de Cheveigné & Kawahara, 2002).
 *
 * YIN is significantly more accurate than zero-crossing rate for real
 * instrument audio because it operates on the autocorrelation of the signal
 * and is robust to harmonics, transient noise, and pick attack. The algorithm
 * runs in O(N²) time on the first half of the buffer, which is well within
 * budget for typical DSP frame sizes (2048 samples at 48 kHz ≈ 23 frames/s).
 *
 * Frequency range: 50 Hz – 1 200 Hz (covers the full guitar range E2–E5 plus
 * harmonics that may be mistaken for the fundamental by simpler detectors).
 *
 * @param {Float32Array} samples - PCM samples in the range [-1, 1]
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {number} Fundamental frequency in Hz, or 0 if no clear pitch found
 */
export function estimateFrequency(samples, sampleRate) {
  const n = samples.length;
  const halfN = Math.floor(n / 2);

  // Bounds for the lag search — derived from the detectable frequency range.
  const lagMin = Math.max(1, Math.floor(sampleRate / 1200)); // ≈ 40 at 48 kHz
  const lagMax = Math.min(halfN - 1, Math.floor(sampleRate / 50)); // ≈ 960 at 48 kHz

  if (halfN < 2 || lagMax <= lagMin) {
    return 0;
  }

  // Guard against silent or near-silent frames — YIN would otherwise return a
  // spurious pitch because the difference function is uniformly zero.
  let signalEnergy = 0;
  for (let j = 0; j < halfN; j++) {
    signalEnergy += samples[j] * samples[j];
  }
  if (signalEnergy < 1e-8) {
    return 0;
  }

  // ── Step 1: difference function ─────────────────────────────────────────
  // d[τ] = Σ_{j=0}^{W/2−1} (x[j] − x[j+τ])²
  const diff = new Float32Array(lagMax + 1);

  for (let tau = 1; tau <= lagMax; tau++) {
    let sum = 0;
    for (let j = 0; j < halfN; j++) {
      const delta = samples[j] - samples[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // ── Step 2: cumulative mean normalised difference (CMND) ─────────────────
  // d'[0] = 1
  // d'[τ] = d[τ] · τ / Σ_{j=1}^{τ} d[j]
  const cmnd = new Float32Array(lagMax + 1);
  cmnd[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau <= lagMax; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 0;
  }

  // ── Step 3: absolute threshold ───────────────────────────────────────────
  // Return the lag at the first local minimum where cmnd[τ] < YIN_THRESHOLD.
  // A threshold of 0.12 is slightly more permissive than the original paper's
  // recommended 0.10 to handle real-world instrument recordings.
  const YIN_THRESHOLD = 0.12;
  let bestTau = -1;

  for (let tau = lagMin; tau < lagMax; tau++) {
    if (cmnd[tau] < YIN_THRESHOLD) {
      // Slide down to the bottom of this dip before committing.
      while (tau + 1 < lagMax && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  // Fallback: if nothing crossed the threshold, use the global minimum.
  // A high minimum (> 0.5) indicates the frame is not strongly pitched.
  if (bestTau === -1) {
    let minVal = Infinity;
    for (let tau = lagMin; tau <= lagMax; tau++) {
      if (cmnd[tau] < minVal) {
        minVal = cmnd[tau];
        bestTau = tau;
      }
    }
    if (minVal > 0.5) {
      return 0;
    }
  }

  if (bestTau <= 0) {
    return 0;
  }

  // ── Step 4: parabolic interpolation ─────────────────────────────────────
  // Refines the integer lag estimate to sub-sample precision using a parabola
  // fitted through the three points surrounding the minimum.
  let refinedTau = bestTau;

  if (bestTau > 0 && bestTau < lagMax) {
    const denominator = cmnd[bestTau - 1] - 2 * cmnd[bestTau] + cmnd[bestTau + 1];
    if (Math.abs(denominator) > 1e-10) {
      refinedTau =
        bestTau + 0.5 * (cmnd[bestTau + 1] - cmnd[bestTau - 1]) / denominator;
    }
  }

  return refinedTau > 0 ? sampleRate / refinedTau : 0;
}

export function analyzeFrame(samples, sampleRate, previousRms) {
  const rms = calculateRms(samples);
  const onset = detectOnset(previousRms, rms);
  const frequency = estimateFrequency(samples, sampleRate);
  const note = frequencyToNote(frequency);

  return {
    rms,
    onset,
    frequency,
    note
  };
}
