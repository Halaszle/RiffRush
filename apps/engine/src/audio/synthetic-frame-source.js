import { noteToFrequency } from "./note-library.js";
import { getExerciseSchedule } from "./training-catalog.js";

const SAMPLE_RATE = 48000;
const FRAME_SIZE = 2048;
const FRAME_DELAY_MS = 85;
const NOTE_HOLD_RATIO = 0.78;

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function buildSilentFrame(frameSize) {
  return new Float32Array(frameSize);
}

function buildSineFrame({ frequency, sampleRate, frameSize, amplitude, phaseOffset }) {
  const samples = new Float32Array(frameSize);

  for (let index = 0; index < frameSize; index += 1) {
    const t = (index + phaseOffset) / sampleRate;
    samples[index] = amplitude * Math.sin(2 * Math.PI * frequency * t);
  }

  return samples;
}

function buildRenderedNotes(targets) {
  return targets.map((target, index) => {
    const hit = index % 4 !== 2;
    const renderedNote = hit
      ? target.note
      : index % 2 === 0
        ? "F#4"
        : "G#3";

    return {
      expectedNote: target.note,
      expectedStringNumber: target.stringNumber,
      expectedTimeMs: target.expectedTimeMs,
      renderedNote,
      hit
    };
  });
}

export function createSyntheticFrameSource({
  exerciseId,
  tempoBpm,
  loopSectionId,
  loopRepetitionCount,
  loopTempoStepBpm
}) {
  const schedule = getExerciseSchedule(exerciseId, {
    tempoBpm,
    loopSectionId,
    loopRepetitionCount,
    loopTempoStepBpm
  });
  const renderedNotes = buildRenderedNotes(schedule.targets);
  const renderedEventMap = new Map(
    renderedNotes.map((noteStep) => [`${noteStep.expectedTimeMs}:${noteStep.expectedNote}`, noteStep])
  );

  return {
    sampleRate: SAMPLE_RATE,
    frameSize: FRAME_SIZE,
    async *stream(signal) {
      let frameIndex = 0;

      for (const event of schedule.events) {
        const targetFrameIndex = Math.max(0, Math.round(event.expectedTimeMs / FRAME_DELAY_MS));

        while (frameIndex < targetFrameIndex) {
          if (signal.aborted) {
            return;
          }

          await wait(FRAME_DELAY_MS);

          yield {
            timestampMs: frameIndex * FRAME_DELAY_MS,
            samples: buildSilentFrame(FRAME_SIZE)
          };

          frameIndex += 1;
        }

        if (event.type !== "target") {
          continue;
        }

        const noteStep =
          renderedEventMap.get(`${event.expectedTimeMs}:${event.note}`) ?? {
            renderedNote: event.note,
            hit: true
          };
        const frequency = noteToFrequency(noteStep.renderedNote);
        const renderedNoteFrames = Math.max(
          2,
          Math.round(Math.max(160, event.durationMs * NOTE_HOLD_RATIO) / FRAME_DELAY_MS)
        );

        for (let index = 0; index < renderedNoteFrames; index += 1) {
          if (signal.aborted) {
            return;
          }

          await wait(FRAME_DELAY_MS);

          yield {
            timestampMs: frameIndex * FRAME_DELAY_MS,
            samples: buildSineFrame({
              frequency,
              sampleRate: SAMPLE_RATE,
              frameSize: FRAME_SIZE,
              amplitude: noteStep.hit ? 0.7 : 0.55,
              phaseOffset: frameIndex * FRAME_SIZE
            })
          };

          frameIndex += 1;
        }
      }
    }
  };
}
