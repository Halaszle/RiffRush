import { createSessionAnalyzer } from "./session-analyzer.js";
import { createFrameSource } from "./frame-source-factory.js";

export async function runAnalyzedTrainingSession({
  send,
  sessionId,
  exerciseId,
  tempoBpm,
  practiceScope,
  loopSectionId,
  loopRepetitionCount,
  loopTempoStepBpm,
  inputMode,
  inputFilePath,
  artifactFilePath,
  signal
}) {
  const frameSource = await createFrameSource({
    exerciseId,
    tempoBpm,
    loopSectionId,
    loopRepetitionCount,
    loopTempoStepBpm,
    inputMode,
    inputFilePath
  });
  const analyzer = createSessionAnalyzer({
    send,
    sessionId,
    exerciseId,
    sampleRate: frameSource.sampleRate,
    tempoBpm,
    practiceScope,
    loopSectionId,
    loopRepetitionCount,
    loopTempoStepBpm,
    adaptiveLoopExecution: true
  });
  let chunkCount = 0;

  for await (const frame of frameSource.stream(signal)) {
    if (signal.aborted) {
      return;
    }

    analyzer.processSamples(frame.samples, {
      timestampMs: frame.timestampMs
    });
    chunkCount += 1;

    if (analyzer.shouldStopEarly?.()) {
      break;
    }
  }

  analyzer.finalize(
    {
      capture: {
        source: inputMode,
        sampleRate: frameSource.sampleRate,
        chunkCount,
        durationMs: Math.round((chunkCount * frameSource.frameSize / frameSource.sampleRate) * 1000)
      },
      practicePreset: {
        scope: practiceScope ?? (loopSectionId ? "section-loop" : "full-chart"),
        tempoBpm: tempoBpm ?? 0,
        ...(analyzer.getPracticePlan?.()
          ? {
              ...(analyzer.getPracticePlan().loopSectionId
                ? {
                    loopSectionId: analyzer.getPracticePlan().loopSectionId,
                    loopSectionLabel:
                      analyzer.getPracticePlan().loopSectionLabel ?? analyzer.getLoopSectionLabel?.()
                  }
                : {}),
              ...(analyzer.getPracticePlan().loopRepetitionCount > 1
                ? { loopRepetitionCount: analyzer.getPracticePlan().loopRepetitionCount }
                : {}),
              ...(analyzer.getPracticePlan().loopTempoStepBpm > 0
                ? { loopTempoStepBpm: analyzer.getPracticePlan().loopTempoStepBpm }
                : {}),
              repetitions: analyzer.getPracticePlan().repetitions
            }
          : {})
      },
      ...(artifactFilePath
        ? {
            artifact: {
              type: "wav-file",
              filePath: artifactFilePath
            }
          }
        : {})
    }
  );
}
