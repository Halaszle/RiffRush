import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { noteToFrequency } from "../src/audio/note-library.js";
import { getExerciseSchedule } from "../src/audio/training-catalog.js";

const sampleRate = 48000;
const NOTE_HOLD_RATIO = 0.78;

function buildSegment({ frequency, durationMs, amplitude }) {
  const sampleCount = Math.round((sampleRate * durationMs) / 1000);
  const samples = new Int16Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const value = amplitude * Math.sin(2 * Math.PI * frequency * time);
    samples[index] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
  }

  return samples;
}

function buildSilence(durationMs) {
  return new Int16Array(Math.round((sampleRate * durationMs) / 1000));
}

function concatInt16Arrays(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Int16Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function buildWavBuffer(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(samples[index], 44 + index * 2);
  }

  return buffer;
}

export async function writeDemoWav(outputPath, exerciseId = "exercise-001", options = {}) {
  const schedule = getExerciseSchedule(exerciseId, options);
  const renderedChunks = [];
  let cursorMs = 0;

  for (const event of schedule.events) {
    const silenceMs = Math.max(0, event.expectedTimeMs - cursorMs);

    if (silenceMs > 0) {
      renderedChunks.push(buildSilence(silenceMs));
      cursorMs += silenceMs;
    }

    if (event.type !== "target") {
      continue;
    }

    const noteDurationMs = Math.max(160, Math.round(event.durationMs * NOTE_HOLD_RATIO));
    renderedChunks.push(
      buildSegment({
        frequency: noteToFrequency(event.note),
        durationMs: noteDurationMs,
        amplitude: 0.68
      })
    );
    cursorMs += noteDurationMs;
  }

  const rendered = concatInt16Arrays(renderedChunks);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildWavBuffer(rendered));

  return outputPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputPath = resolve(process.argv[2] ?? "./tmp/riffrush-demo-session.wav");
  const exerciseId = process.argv[3] ?? "exercise-001";
  const loopSectionId = process.argv[4] ?? undefined;
  await writeDemoWav(outputPath, exerciseId, {
    ...(loopSectionId ? { loopSectionId } : {}),
    ...(process.argv[5] ? { loopRepetitionCount: Number(process.argv[5]) } : {}),
    ...(process.argv[6] ? { loopTempoStepBpm: Number(process.argv[6]) } : {})
  });
  console.log(`Demo WAV written to ${outputPath}`);
}
