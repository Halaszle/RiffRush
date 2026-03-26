function calculateRms(samples) {
  if (!samples || samples.length === 0) {
    return 0;
  }

  let sumSquares = 0;

  for (const sample of samples) {
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / samples.length);
}

function formatNumber(value, digits = 2) {
  return Number(value.toFixed(digits));
}

export function createNativeCaptureRuntimeMonitor({
  onNotice,
  captureDescriptorFactory,
  configuredBufferMs = 0,
  lowSignalRmsThreshold = 0.012,
  lowSignalChunkThreshold = 3,
  chunkGapThresholdMs = null
}) {
  let lastChunkAtMs = null;
  let consecutiveLowSignalChunks = 0;
  let lowSignalNoticeActive = false;
  let chunkGapNoticeActive = false;
  let maxChunkGapMs = 0;
  let lowSignalEventCount = 0;
  let lowSignalChunkCount = 0;

  return {
    observeChunk({ samples, sampleRate, capturedAtMs = Date.now() }) {
      const rms = calculateRms(samples);
      const expectedChunkMs =
        sampleRate && samples?.length
          ? (samples.length / sampleRate) * 1000
          : 0;
      const effectiveChunkGapThresholdMs =
        chunkGapThresholdMs ??
        Math.max(
          configuredBufferMs > 0 ? configuredBufferMs * 3 : 0,
          expectedChunkMs > 0 ? expectedChunkMs * 2.5 : 0,
          120
        );

      if (lastChunkAtMs !== null) {
        const gapMs = capturedAtMs - lastChunkAtMs;
        maxChunkGapMs = Math.max(maxChunkGapMs, gapMs);

        if (gapMs > effectiveChunkGapThresholdMs) {
          if (!chunkGapNoticeActive) {
            onNotice({
              code: "NATIVE_CAPTURE_CHUNK_GAP",
              level: "warning",
              message:
                `Detected delayed native capture chunk (${Math.round(gapMs)} ms gap, ` +
                `threshold ${Math.round(effectiveChunkGapThresholdMs)} ms).`,
              capture: captureDescriptorFactory()
            });
            chunkGapNoticeActive = true;
          }
        } else {
          chunkGapNoticeActive = false;
        }
      }

      lastChunkAtMs = capturedAtMs;

      if (rms < lowSignalRmsThreshold) {
        consecutiveLowSignalChunks += 1;
        lowSignalChunkCount += 1;

        if (!lowSignalNoticeActive && consecutiveLowSignalChunks >= lowSignalChunkThreshold) {
          lowSignalEventCount += 1;
          onNotice({
            code: "NATIVE_CAPTURE_LOW_SIGNAL",
            level: "warning",
            message:
              `Native capture input level is very low (RMS ${formatNumber(rms, 4)}) ` +
              `across ${consecutiveLowSignalChunks} consecutive chunk(s).`,
            capture: captureDescriptorFactory()
          });
          lowSignalNoticeActive = true;
        }
      } else {
        consecutiveLowSignalChunks = 0;
        lowSignalNoticeActive = false;
      }
    },

    snapshot() {
      return {
        ...(maxChunkGapMs > 0 ? { maxChunkGapMs: Math.round(maxChunkGapMs) } : {}),
        ...(lowSignalEventCount > 0 ? { lowSignalEventCount } : {}),
        ...(lowSignalChunkCount > 0 ? { lowSignalChunkCount } : {})
      };
    }
  };
}
