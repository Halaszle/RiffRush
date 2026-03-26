import { createSyntheticFrameSource } from "./synthetic-frame-source.js";
import { createWavFileFrameSource } from "./wav-file-source.js";

export async function createFrameSource({
  exerciseId,
  tempoBpm,
  loopSectionId,
  loopRepetitionCount,
  loopTempoStepBpm,
  inputMode = "synthetic",
  inputFilePath
}) {
  if (inputMode === "synthetic") {
    return createSyntheticFrameSource({
      exerciseId,
      tempoBpm,
      loopSectionId,
      loopRepetitionCount,
      loopTempoStepBpm
    });
  }

  if (inputMode === "wav-file") {
    if (!inputFilePath || typeof inputFilePath !== "string") {
      throw new Error("inputFilePath is required when inputMode is wav-file.");
    }

    return createWavFileFrameSource(inputFilePath);
  }

  throw new Error(`Unsupported input mode: ${inputMode}`);
}
