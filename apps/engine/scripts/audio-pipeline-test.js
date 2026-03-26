import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeFrame, calculateRms, detectOnset, estimateFrequency } from "../src/audio/analyzers.js";
import { createFrameSource } from "../src/audio/frame-source-factory.js";
import { noteToFrequency } from "../src/audio/note-library.js";
import { createSessionAnalyzer } from "../src/audio/session-analyzer.js";
import { createSyntheticFrameSource } from "../src/audio/synthetic-frame-source.js";
import { getExerciseChart, getExerciseSchedule } from "../src/audio/training-catalog.js";
import { writeDemoWav } from "./generate-demo-wav.js";

function buildSineSamples(frequency, sampleRate, frameSize, amplitude = 0.7) {
  const samples = new Float32Array(frameSize);

  for (let index = 0; index < frameSize; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequency * index) / sampleRate);
  }

  return samples;
}

const sampleRate = 48000;
const frameSize = 2048;
const sineSamples = buildSineSamples(noteToFrequency("A4"), sampleRate, frameSize);

const rms = calculateRms(sineSamples);
assert.ok(rms > 0.45 && rms < 0.55);

const onsetDetected = detectOnset(0.01, rms);
assert.equal(onsetDetected, true);

const estimatedFrequency = estimateFrequency(sineSamples, sampleRate);
assert.ok(Math.abs(estimatedFrequency - 440) < 20);

const analysis = analyzeFrame(sineSamples, sampleRate, 0.01);
assert.equal(analysis.onset, true);
assert.equal(analysis.note, "A4");

const exerciseChart = getExerciseChart("exercise-001");
const exerciseSchedule = getExerciseSchedule("exercise-001");
assert.equal(exerciseChart.sections.length, 2);
assert.equal(exerciseChart.restCount, 3);
assert.equal(exerciseSchedule.events.length, 7);
assert.equal(exerciseSchedule.targets.length, 4);
assert.equal(exerciseSchedule.sections[0].label, "Intro pulse");
assert.ok(exerciseSchedule.targets[0].releaseToleranceMs > 0);
assert.ok(exerciseSchedule.targets[0].releaseObservationEndMs >= exerciseSchedule.targets[0].expectedReleaseTimeMs);

const source = createSyntheticFrameSource("exercise-001");
const frames = [];
const controller = new AbortController();

for await (const frame of source.stream(controller.signal)) {
  frames.push(frame);

  if (frames.length >= 14) {
    controller.abort();
  }
}

assert.ok(frames.some((frame) => frame.samples.every((sample) => sample === 0)));
assert.ok(frames.some((frame) => frame.samples.some((sample) => sample !== 0)));

const tempDirectory = await mkdtemp(join(tmpdir(), "riffrush-audio-"));
const wavPath = join(tempDirectory, "demo.wav");

await writeDemoWav(wavPath, "exercise-001");

const wavSource = await createFrameSource({
  exerciseId: "exercise-001",
  inputMode: "wav-file",
  inputFilePath: wavPath
});

const wavFrames = [];
const wavController = new AbortController();

for await (const frame of wavSource.stream(wavController.signal)) {
  wavFrames.push(frame);

  if (wavFrames.length >= 4) {
    wavController.abort();
  }
}

assert.ok(wavFrames.length > 0);
assert.ok(wavFrames.every((frame) => frame.samples instanceof Float32Array));

const analyzerMessages = [];
const analyzer = createSessionAnalyzer({
  send: (message) => analyzerMessages.push(message),
  sessionId: "session-audio-pipeline-test",
  exerciseId: "exercise-001",
  sampleRate
});
const targetSamples = buildSineSamples(
  noteToFrequency(exerciseSchedule.targets[0].note),
  sampleRate,
  frameSize
);

analyzer.processSamples(new Float32Array(frameSize), {
  timestampMs: 0
});
analyzer.processSamples(sineSamples, {
  timestampMs: 150
});
analyzer.processSamples(new Float32Array(frameSize), {
  timestampMs: 300
});
analyzer.processSamples(targetSamples, {
  timestampMs: exerciseSchedule.targets[0].expectedTimeMs
});
const analyzerSummary = analyzer.finalize();
const ghostEvent = analyzerMessages.find(
  (message) => message.type === "score.event" && message.payload.eventKind === "ghost-note"
);
const scoreEvent = analyzerMessages.find(
  (message) => message.type === "score.event" && message.payload.eventKind === "target-hit"
);
const missedEvent = analyzerMessages.find(
  (message) => message.type === "score.event" && message.payload.eventKind === "missed-target"
);

assert.ok(ghostEvent);
assert.ok(scoreEvent);
assert.ok(missedEvent);
assert.equal(ghostEvent.payload.targetIndex, -1);
assert.equal(scoreEvent.payload.targetIndex, 0);
assert.equal(scoreEvent.payload.expectedNote, "E4");
assert.equal(scoreEvent.payload.expectedStringNumber, 1);
assert.equal(scoreEvent.payload.measureNumber, 1);
assert.equal(scoreEvent.payload.beatNumber, 1);
assert.equal(scoreEvent.payload.scheduledBeat, 1);
assert.equal(typeof scoreEvent.payload.noteHit, "boolean");
assert.equal(typeof scoreEvent.payload.stringHit, "boolean");
assert.equal(typeof scoreEvent.payload.timingHit, "boolean");
assert.equal(typeof scoreEvent.payload.sustainHit, "boolean");
assert.equal(typeof scoreEvent.payload.releaseHit, "boolean");
assert.equal(typeof scoreEvent.payload.overheld, "boolean");
assert.equal(typeof scoreEvent.payload.fullComboHit, "boolean");
assert.equal(typeof scoreEvent.payload.comboCount, "number");
assert.equal(typeof scoreEvent.payload.comboMultiplier, "number");
assert.equal(typeof scoreEvent.payload.comboBroken, "boolean");
assert.equal(typeof scoreEvent.payload.holdCoverage, "number");
assert.equal(typeof scoreEvent.payload.releaseOvershootMs, "number");
assert.equal(scoreEvent.payload.timingWindowMs, 110);
assert.ok(analyzerSummary.scoreBreakdown);
assert.equal(analyzerSummary.scoreBreakdown.tempoBpm, 80);
assert.equal(analyzerSummary.scoreBreakdown.targetCount, 4);
assert.equal(typeof analyzerSummary.scoreBreakdown.matchedTargetCount, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.fullHits, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.sustainHits, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.releaseHits, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.overholdCount, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.ghostNoteCount, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.missedTargetCount, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.maxCombo, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.comboBreakCount, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.multiplierPeak, "number");
assert.ok(analyzerSummary.rating);
assert.ok(["S", "A", "B", "C", "D", "F"].includes(analyzerSummary.rating.grade));
assert.ok(typeof analyzerSummary.rating.performanceScore === "number");
assert.ok(analyzerSummary.feedback);
assert.ok(typeof analyzerSummary.feedback.summary === "string");
assert.ok(Array.isArray(analyzerSummary.feedback.focusAreas));
assert.ok(Array.isArray(analyzerSummary.feedback.coachHints));
assert.ok(analyzerSummary.verification);
assert.equal(analyzerSummary.verification.status, "verified");
assert.equal(analyzerSummary.verification.mechanicallyComplete, true);
assert.equal(analyzerSummary.verification.checks.targetAccountingMatches, true);
assert.equal(analyzerSummary.verification.checks.sectionAccountingMatches, true);
assert.equal(typeof analyzerSummary.scoreBreakdown.averageHoldCoverage, "number");
assert.equal(typeof analyzerSummary.scoreBreakdown.averageReleaseOvershootMs, "number");

const adaptiveMessages = [];
const adaptiveSchedule = getExerciseSchedule("exercise-001", {
  tempoBpm: 72,
  loopSectionId: "intro",
  loopRepetitionCount: 3,
  loopTempoStepBpm: 2
});
const adaptiveAnalyzer = createSessionAnalyzer({
  send: (message) => adaptiveMessages.push(message),
  sessionId: "session-audio-adaptive-test",
  exerciseId: "exercise-001",
  sampleRate,
  tempoBpm: 72,
  practiceScope: "section-loop",
  loopSectionId: "intro",
  loopRepetitionCount: 3,
  loopTempoStepBpm: 2,
  adaptiveLoopExecution: true
});

adaptiveAnalyzer.processSamples(new Float32Array(frameSize), {
  timestampMs: adaptiveSchedule.practicePlan.repetitions[0].startTimeMs + adaptiveSchedule.practicePlan.repetitions[0].durationMs + 20
});

assert.equal(adaptiveAnalyzer.shouldStopEarly(), true);

const adaptiveSummary = adaptiveAnalyzer.finalize({
  practicePreset: {
    scope: "section-loop",
    tempoBpm: 72,
    loopSectionId: "intro",
    loopSectionLabel: "Intro pulse",
    loopRepetitionCount: 3,
    loopTempoStepBpm: 2,
    repetitions: adaptiveSchedule.practicePlan.repetitions
  }
});
const adaptiveStopNotice = adaptiveMessages.find(
  (message) => message.type === "session.notice" && message.payload.code === "SECTION_LOOP_ADAPTIVE_STOP"
);

assert.ok(adaptiveStopNotice);
assert.ok(adaptiveSummary.practicePreset);
assert.equal(adaptiveSummary.practicePreset.adaptiveExecution.mode, "early-stop");
assert.equal(adaptiveSummary.practicePreset.adaptiveExecution.triggered, true);
assert.equal(adaptiveSummary.practicePreset.adaptiveExecution.completedRepetitionCount, 1);
assert.equal(adaptiveSummary.practicePreset.adaptiveExecution.retryPlan.strategy, "rebuild-base-tempo");
assert.equal(adaptiveSummary.practicePreset.repetitions[1].skipped, true);
assert.equal(adaptiveSummary.scoreBreakdown.targetCount, 2);
assert.ok(adaptiveSummary.verification);
assert.equal(adaptiveSummary.verification.status, "verified");
assert.equal(adaptiveSummary.verification.checks.repetitionAccountingMatches, true);

await rm(tempDirectory, { recursive: true, force: true });

console.log("Engine audio pipeline test passed.");
