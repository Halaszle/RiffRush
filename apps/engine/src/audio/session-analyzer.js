import { createEnvelope } from "../../../../packages/protocol/src/runtime.js";
import { analyzeFrame } from "./analyzers.js";
import { noteToMidi } from "./note-library.js";
import { getExerciseSchedule } from "./training-catalog.js";

const SUSTAIN_COVERAGE_THRESHOLD = 0.65;
const GHOST_NOTE_SCORE_DELTA = -20;
const MISSED_TARGET_SCORE_DELTA = -30;
const COMBO_MULTIPLIER_TIERS = [
  { minCombo: 10, multiplier: 4 },
  { minCombo: 6, multiplier: 3 },
  { minCombo: 3, multiplier: 2 }
];
const REPETITION_PASS_ACCURACY_THRESHOLD = 0.85;
const REPETITION_PASS_PERFORMANCE_THRESHOLD = 78;
const ADAPTIVE_STOP_ACCURACY_THRESHOLD = 0.55;
const ADAPTIVE_STOP_PERFORMANCE_THRESHOLD = 55;
const ADAPTIVE_STOP_MISS_THRESHOLD = 2;
const ADAPTIVE_RETRY_NEAR_PASS_ACCURACY_THRESHOLD = 0.68;
const ADAPTIVE_RETRY_NEAR_PASS_PERFORMANCE_THRESHOLD = 62;
const GRADE_LABELS = {
  S: "Stage-ready",
  A: "Strong clear",
  B: "Solid pass",
  C: "Developing",
  D: "Unstable",
  F: "Retry needed"
};
const FEEDBACK_SEVERITY_ORDER = {
  high: 3,
  medium: 2,
  low: 1
};

const STANDARD_TUNING_STRINGS = [
  { stringNumber: 6, openNote: "E2" },
  { stringNumber: 5, openNote: "A2" },
  { stringNumber: 4, openNote: "D3" },
  { stringNumber: 3, openNote: "G3" },
  { stringNumber: 2, openNote: "B3" },
  { stringNumber: 1, openNote: "E4" }
];

function getPlayableStringNumbers(note) {
  if (!note || note === "unknown") {
    return [];
  }

  const noteMidi = noteToMidi(note);

  return STANDARD_TUNING_STRINGS
    .filter((stringDefinition) => {
      const openMidi = noteToMidi(stringDefinition.openNote);
      const fret = noteMidi - openMidi;
      return fret >= 0 && fret <= 24;
    })
    .map((stringDefinition) => stringDefinition.stringNumber)
    .sort((left, right) => left - right);
}

function resolveDetectedStringNumber(detectedNote, expectedStringNumber) {
  const playableStrings = getPlayableStringNumbers(detectedNote);

  if (playableStrings.length === 0) {
    return null;
  }

  if (expectedStringNumber && playableStrings.includes(expectedStringNumber)) {
    return expectedStringNumber;
  }

  return playableStrings[0];
}

function calculateScoreDelta({ noteHit, stringHit, timingHit, sustainHit, releaseHit }) {
  let attackScore = 10;

  if (noteHit && stringHit && timingHit) {
    attackScore = 150;
  } else if (noteHit && stringHit) {
    attackScore = 90;
  } else if (noteHit || stringHit) {
    attackScore = 45;
  }

  return attackScore + (sustainHit ? 35 : 0) + (releaseHit ? 15 : 0);
}

function getComboMultiplier(comboCount) {
  for (const tier of COMBO_MULTIPLIER_TIERS) {
    if (comboCount >= tier.minCombo) {
      return tier.multiplier;
    }
  }

  return 1;
}

function clampNumber(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function calculateShare(part, total) {
  if (!total) {
    return 0;
  }

  return Number((part / total).toFixed(2));
}

function buildSessionRating({ accuracy, scoreBreakdown }) {
  const targetCount = scoreBreakdown.targetCount || 1;
  const comboShare = scoreBreakdown.maxCombo / targetCount;
  const performanceScore = Math.round(
    clampNumber(
      accuracy * 100 +
        comboShare * 10 +
        Math.max(0, scoreBreakdown.multiplierPeak - 1) * 4 -
        scoreBreakdown.ghostNoteCount * 3 -
        scoreBreakdown.missedTargetCount * 4 -
        scoreBreakdown.earlyReleaseCount * 2 -
        scoreBreakdown.overholdCount * 2,
      0,
      100
    )
  );

  let grade = "F";

  if (
    performanceScore >= 95 &&
    scoreBreakdown.ghostNoteCount === 0 &&
    scoreBreakdown.missedTargetCount === 0
  ) {
    grade = "S";
  } else if (performanceScore >= 88) {
    grade = "A";
  } else if (performanceScore >= 75) {
    grade = "B";
  } else if (performanceScore >= 60) {
    grade = "C";
  } else if (performanceScore >= 45) {
    grade = "D";
  }

  let clearType = "practice";

  if (scoreBreakdown.fullComboHits === scoreBreakdown.targetCount && scoreBreakdown.targetCount > 0) {
    clearType = "full-combo";
  } else if (scoreBreakdown.ghostNoteCount === 0 && scoreBreakdown.missedTargetCount === 0) {
    clearType = "clean-clear";
  } else if (grade !== "F") {
    clearType = "clear";
  }

  return {
    grade,
    label: GRADE_LABELS[grade],
    clearType,
    performanceScore
  };
}

function buildSessionFeedback({ scoreBreakdown, rating }) {
  const targetCount = Math.max(scoreBreakdown.targetCount || 1, 1);
  const hints = [];

  if (scoreBreakdown.missedTargetCount >= Math.max(2, Math.ceil(targetCount * 0.12))) {
    hints.push({
      id: "timing-consistency",
      title: "Domknij timing wejść",
      detail: "Masz zbyt dużo pominiętych targetów. Zwolnij minimalnie i pilnuj wejścia dokładnie na beat.",
      severity: "high"
    });
  }

  if (scoreBreakdown.ghostNoteCount >= Math.max(2, Math.ceil(targetCount * 0.08))) {
    hints.push({
      id: "ghost-note-control",
      title: "Ogranicz dodatkowe uderzenia",
      detail: "Pojawiają się ghost notes poza chartem. Skróć ruch prawej ręki i czyść artykulację między targetami.",
      severity: "high"
    });
  }

  if (scoreBreakdown.earlyHitCount > scoreBreakdown.lateHitCount + 1) {
    hints.push({
      id: "play-less-ahead",
      title: "Nie wychodź przed beat",
      detail: "Częściej wpadasz za wcześnie niż za późno. Zostaw więcej miejsca przed wejściem w target.",
      severity: "medium"
    });
  } else if (scoreBreakdown.lateHitCount > scoreBreakdown.earlyHitCount + 1) {
    hints.push({
      id: "play-more-forward",
      title: "Pchnij groove do przodu",
      detail: "Częściej spóźniasz wejścia. Przygotuj lewą rękę wcześniej i atakuj pewniej na beat.",
      severity: "medium"
    });
  }

  if (scoreBreakdown.earlyReleaseCount >= Math.max(2, Math.ceil(targetCount * 0.1))) {
    hints.push({
      id: "hold-notes-longer",
      title: "Dociągaj długości nut",
      detail: "Za wcześnie puszczasz nuty. Utrzymuj dźwięk stabilnie do końca targetu.",
      severity: "medium"
    });
  }

  if (scoreBreakdown.overholdCount >= Math.max(2, Math.ceil(targetCount * 0.1))) {
    hints.push({
      id: "release-cleaner",
      title: "Czyść release między targetami",
      detail: "Za długo trzymasz nuty po targetach. Ćwicz krótsze, bardziej kontrolowane odpuszczanie struny.",
      severity: "medium"
    });
  }

  if ((scoreBreakdown.averageHoldCoverage ?? 1) < 0.75) {
    hints.push({
      id: "stabilize-sustain",
      title: "Ustabilizuj sustain",
      detail: "Pokrycie długości nut jest za niskie. Skup się na równym docisku i spokojniejszym trzymaniu dźwięku.",
      severity: "medium"
    });
  }

  if ((scoreBreakdown.maxCombo ?? 0) < Math.max(3, Math.floor(targetCount * 0.35))) {
    hints.push({
      id: "build-streaks",
      title: "Buduj dłuższe serie",
      detail: "Combo szybko się urywa. Ćwicz krótsze fragmenty aż wejścia będą powtarzalne kilka razy z rzędu.",
      severity: "low"
    });
  }

  if (hints.length === 0) {
    hints.push({
      id: "keep-current-approach",
      title: "Utrzymaj obecny tor gry",
      detail: "Sesja jest stabilna. Teraz warto podnosić tempo albo precyzję bez zmiany techniki bazowej.",
      severity: "low"
    });
  }

  hints.sort((left, right) => {
    const severityDifference = FEEDBACK_SEVERITY_ORDER[right.severity] - FEEDBACK_SEVERITY_ORDER[left.severity];

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return left.title.localeCompare(right.title);
  });

  const topHints = hints.slice(0, 3);
  const focusAreas = topHints.map((hint) => hint.title);
  const summary =
    rating.grade === "S"
      ? "Bardzo czysta sesja. Utrzymuj kontrolę i podnoś trudność bez utraty precyzji."
      : rating.grade === "A"
        ? "Mocne wykonanie. Największy zysk da teraz dopracowanie pojedynczych niedokładności."
        : rating.grade === "B"
          ? "Solidna baza. Sesja jest grywalna, ale nadal tracisz punkty na powtarzalnych błędach."
          : rating.grade === "C"
            ? "Jest progres, ale potrzeba więcej stabilności w kluczowych miejscach patternu."
            : rating.grade === "D"
              ? "Sesja jest niestabilna. Najpierw uprość wykonanie i domknij podstawowy timing."
              : "Ten przebieg wymaga powtórki. Skup się na jednym głównym problemie zamiast całym patternie naraz.";

  return {
    summary,
    focusAreas,
    coachHints: topHints
  };
}

function classifyTiming(timingOffsetMs, timingWindowMs) {
  if (timingOffsetMs < -timingWindowMs) {
    return "early";
  }

  if (timingOffsetMs > timingWindowMs) {
    return "late";
  }

  return "on-time";
}

function resolveTargetForTimestamp(targetStates, timestampMs) {
  const pendingTargets = targetStates.filter((target) => !target.matched && !target.skipped);

  if (pendingTargets.length === 0) {
    return null;
  }

  const inWindowTargets = pendingTargets
    .filter((target) => Math.abs(timestampMs - target.expectedTimeMs) <= target.timingWindowMs * 1.5)
    .sort((left, right) => {
      const leftDistance = Math.abs(timestampMs - left.expectedTimeMs);
      const rightDistance = Math.abs(timestampMs - right.expectedTimeMs);

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return left.expectedTimeMs - right.expectedTimeMs;
    });

  return inWindowTargets[0] ?? null;
}

function createTargetEvaluation({
  target,
  detectedNote,
  detectedStringNumber,
  noteHit,
  stringHit,
  timingHit,
  timingClass,
  timingOffsetMs,
  confidence
}) {
  return {
    target,
    detectedNote,
    detectedStringNumber,
    noteHit,
    stringHit,
    timingHit,
    timingClass,
    timingOffsetMs,
    confidence,
    detectedDurationMs: 0,
    postTargetMatchedDurationMs: 0
  };
}

function createSectionStats(sectionTarget) {
  return {
    sectionId: sectionTarget.sectionId ?? "main",
    sectionLabel: sectionTarget.sectionLabel ?? sectionTarget.sectionId ?? "Main",
    firstTargetIndex: sectionTarget.index ?? Number.MAX_SAFE_INTEGER,
    targetCount: 0,
    matchedTargetCount: 0,
    fullComboHits: 0,
    missedTargetCount: 0,
    ghostNoteCount: 0,
    earlyHitCount: 0,
    lateHitCount: 0,
    earlyReleaseCount: 0,
    overholdCount: 0,
    timingOffsetTotalMs: 0,
    timingSampleCount: 0,
    holdCoverageTotal: 0,
    holdCoverageCount: 0,
    releaseOvershootTotalMs: 0,
    releaseOvershootCount: 0
  };
}

function buildSectionBreakdown(sectionStatsMap) {
  return [...sectionStatsMap.values()]
    .sort((left, right) => left.firstTargetIndex - right.firstTargetIndex)
    .map((sectionStats) => {
      const accuracy =
        sectionStats.targetCount === 0
          ? 0
          : Number((sectionStats.fullComboHits / sectionStats.targetCount).toFixed(2));
      const averageTimingOffsetMs =
        sectionStats.timingSampleCount === 0
          ? 0
          : Number((sectionStats.timingOffsetTotalMs / sectionStats.timingSampleCount).toFixed(2));
      const averageHoldCoverage =
        sectionStats.holdCoverageCount === 0
          ? 0
          : Number((sectionStats.holdCoverageTotal / sectionStats.holdCoverageCount).toFixed(2));
      const averageReleaseOvershootMs =
        sectionStats.releaseOvershootCount === 0
          ? 0
          : Number((sectionStats.releaseOvershootTotalMs / sectionStats.releaseOvershootCount).toFixed(2));

      return {
        sectionId: sectionStats.sectionId,
        sectionLabel: sectionStats.sectionLabel,
        targetCount: sectionStats.targetCount,
        matchedTargetCount: sectionStats.matchedTargetCount,
        fullComboHits: sectionStats.fullComboHits,
        missedTargetCount: sectionStats.missedTargetCount,
        ghostNoteCount: sectionStats.ghostNoteCount,
        earlyHitCount: sectionStats.earlyHitCount,
        lateHitCount: sectionStats.lateHitCount,
        earlyReleaseCount: sectionStats.earlyReleaseCount,
        overholdCount: sectionStats.overholdCount,
        accuracy,
        averageTimingOffsetMs,
        averageHoldCoverage,
        averageReleaseOvershootMs,
        performanceScore: Math.round(
          clampNumber(
            accuracy * 100 -
              sectionStats.missedTargetCount * 10 -
              sectionStats.ghostNoteCount * 6 -
              sectionStats.earlyReleaseCount * 4 -
              sectionStats.overholdCount * 4 -
              averageTimingOffsetMs * 0.2,
            0,
            100
          )
        )
      };
    });
}

function createRepetitionStats(target) {
  return {
    repetitionIndex: target.repetitionIndex ?? 0,
    tempoBpm: target.repetitionTempoBpm ?? 0,
    firstTargetIndex: target.index ?? Number.MAX_SAFE_INTEGER,
    targetCount: 0,
    fullComboHits: 0,
    missedTargetCount: 0,
    ghostNoteCount: 0,
    performancePenalty: 0
  };
}

function buildRepetitionResult(plannedRepetition, stats, { skipped = false } = {}) {
  const accuracy =
    stats.targetCount === 0 ? 0 : Number((stats.fullComboHits / stats.targetCount).toFixed(2));
  const performanceScore = Math.round(
    clampNumber(
      accuracy * 100 - stats.missedTargetCount * 12 - stats.ghostNoteCount * 8 - stats.performancePenalty,
      0,
      100
    )
  );
  const passed =
    !skipped &&
    stats.targetCount > 0 &&
    accuracy >= REPETITION_PASS_ACCURACY_THRESHOLD &&
    performanceScore >= REPETITION_PASS_PERFORMANCE_THRESHOLD &&
    stats.missedTargetCount === 0 &&
    stats.ghostNoteCount <= 1;

  return {
    repetitionIndex: plannedRepetition.repetitionIndex,
    tempoBpm: plannedRepetition.tempoBpm,
    startTimeMs: plannedRepetition.startTimeMs,
    durationMs: plannedRepetition.durationMs,
    targetCount: stats.targetCount,
    fullComboHits: stats.fullComboHits,
    missedTargetCount: stats.missedTargetCount,
    ghostNoteCount: stats.ghostNoteCount,
    accuracy,
    performanceScore,
    passed,
    ...(skipped ? { skipped: true } : {})
  };
}

function buildRepetitionBreakdown(repetitionStatsMap, practicePlan, skippedRepetitionIndices = new Set()) {
  const repetitions = practicePlan?.repetitions ?? [];

  return repetitions.map((plannedRepetition) => {
    const stats = repetitionStatsMap.get(plannedRepetition.repetitionIndex) ?? {
      repetitionIndex: plannedRepetition.repetitionIndex,
      tempoBpm: plannedRepetition.tempoBpm,
      targetCount: 0,
      fullComboHits: 0,
      missedTargetCount: 0,
      ghostNoteCount: 0,
      performancePenalty: 0
    };

    return buildRepetitionResult(plannedRepetition, stats, {
      skipped: skippedRepetitionIndices.has(plannedRepetition.repetitionIndex)
    });
  });
}

function shouldTriggerAdaptiveStop(repetitionResult) {
  return (
    !repetitionResult.skipped &&
    !repetitionResult.passed &&
    (
      repetitionResult.performanceScore < ADAPTIVE_STOP_PERFORMANCE_THRESHOLD ||
      repetitionResult.accuracy < ADAPTIVE_STOP_ACCURACY_THRESHOLD ||
      repetitionResult.missedTargetCount >= ADAPTIVE_STOP_MISS_THRESHOLD
    )
  );
}

function buildAdaptiveRetryPlan(practicePreset, repetitionBreakdown, adaptiveState) {
  if (
    practicePreset?.scope !== "section-loop" ||
    !adaptiveState.triggered ||
    adaptiveState.stoppedAfterRepetitionIndex === null
  ) {
    return null;
  }

  const failedRepetition = repetitionBreakdown.find(
    (repetition) => repetition.repetitionIndex === adaptiveState.stoppedAfterRepetitionIndex
  );

  if (!failedRepetition || failedRepetition.skipped) {
    return null;
  }

  const baseTempoBpm = practicePreset.tempoBpm ?? failedRepetition.tempoBpm ?? 0;
  const baseLoopRepetitionCount = practicePreset.loopRepetitionCount ?? 3;
  const baseLoopTempoStepBpm = practicePreset.loopTempoStepBpm ?? 0;

  if (
    failedRepetition.accuracy >= ADAPTIVE_RETRY_NEAR_PASS_ACCURACY_THRESHOLD &&
    failedRepetition.performanceScore >= ADAPTIVE_RETRY_NEAR_PASS_PERFORMANCE_THRESHOLD &&
    failedRepetition.missedTargetCount <= 1
  ) {
    return {
      strategy: "repeat-current-tempo",
      tempoBpm: failedRepetition.tempoBpm,
      loopRepetitionCount: 2,
      loopTempoStepBpm: 0,
      reason: "The failed repetition was close to passing. Repeat the same tempo and stabilize the section before reintroducing progression."
    };
  }

  if (failedRepetition.repetitionIndex > 0) {
    return {
      strategy: "drop-tempo-step",
      tempoBpm: Math.max(baseTempoBpm, failedRepetition.tempoBpm - Math.max(baseLoopTempoStepBpm, 2)),
      loopRepetitionCount: Math.max(2, Math.min(4, baseLoopRepetitionCount)),
      loopTempoStepBpm: 0,
      reason: "The section broke after the tempo ramp. Drop back one step and rebuild stability before climbing again."
    };
  }

  return {
    strategy: "rebuild-base-tempo",
    tempoBpm: baseTempoBpm,
    loopRepetitionCount: Math.max(3, baseLoopRepetitionCount),
    loopTempoStepBpm: 0,
    reason: "The base repetition failed too early. Rebuild the section from the starting tempo before attempting another ramp."
  };
}

function buildAdaptiveExecution(practicePreset, repetitionBreakdown, adaptiveState) {
  if (practicePreset?.scope !== "section-loop" || !Array.isArray(repetitionBreakdown)) {
    return null;
  }

  const retryPlan = buildAdaptiveRetryPlan(practicePreset, repetitionBreakdown, adaptiveState);

  return {
    mode: adaptiveState.triggered ? "early-stop" : "static",
    triggered: adaptiveState.triggered,
    completedRepetitionCount: repetitionBreakdown.filter((repetition) => !repetition.skipped).length,
    plannedRepetitionCount: repetitionBreakdown.length,
    ...(adaptiveState.stoppedAfterRepetitionIndex !== null
      ? { stoppedAfterRepetitionIndex: adaptiveState.stoppedAfterRepetitionIndex }
      : {}),
    ...(adaptiveState.stopReason ? { stopReason: adaptiveState.stopReason } : {}),
    ...(retryPlan ? { retryPlan } : {})
  };
}

function buildMasteryGate(practicePreset) {
  if (practicePreset?.scope !== "section-loop" || !Array.isArray(practicePreset.repetitions)) {
    return null;
  }

  const totalRepetitionCount = practicePreset.repetitions.length;
  const passedRepetitions = practicePreset.repetitions.filter((repetition) => repetition.passed);
  const passedRepetitionCount = passedRepetitions.length;
  const highestPassedTempoBpm = passedRepetitions.reduce(
    (highestTempo, repetition) => Math.max(highestTempo, repetition.tempoBpm),
    0
  );
  const baseTempoBpm = practicePreset.tempoBpm ?? 0;
  const loopTempoStepBpm = practicePreset.loopTempoStepBpm ?? 0;

  if (passedRepetitionCount === totalRepetitionCount && totalRepetitionCount > 0) {
    return {
      status: "ready-to-advance",
      passedRepetitionCount,
      totalRepetitionCount,
      highestPassedTempoBpm,
      recommendedNextTempoBpm: highestPassedTempoBpm + Math.max(loopTempoStepBpm, 2),
      message: "Wszystkie zaplanowane petle przeszly gate. Mozesz podniesc tempo albo przejsc dalej."
    };
  }

  if (passedRepetitionCount > 0) {
    const nextUnpassed = practicePreset.repetitions.find((repetition) => !repetition.passed);
    return {
      status: "keep-building",
      passedRepetitionCount,
      totalRepetitionCount,
      highestPassedTempoBpm,
      recommendedNextTempoBpm: nextUnpassed?.tempoBpm ?? highestPassedTempoBpm,
      message: "Czesc petli jest juz stabilna. Utrzymaj ostatnie zaliczone tempo i domknij kolejne powtorki."
    };
  }

  return {
    status: "stabilize-base-tempo",
    passedRepetitionCount,
    totalRepetitionCount,
    highestPassedTempoBpm,
    recommendedNextTempoBpm: baseTempoBpm,
    message: "Gate nie zostal jeszcze zaliczony. Powtorz sekcje na bazowym tempie przed dalszym podbijaniem BPM."
  };
}

function buildSessionVerification({
  notesDetected,
  notesHit,
  scoreBreakdown,
  sectionBreakdown,
  practicePreset,
  capture,
  diagnostics,
  artifact
}) {
  const issues = [];
  const hasScoreBreakdown = Boolean(scoreBreakdown);
  const hasSectionBreakdown = Array.isArray(sectionBreakdown) && sectionBreakdown.length > 0;
  const hasPracticeRepetitions = Array.isArray(practicePreset?.repetitions) && practicePreset.repetitions.length > 0;

  const targetAccountingMatches =
    hasScoreBreakdown &&
    scoreBreakdown.matchedTargetCount + scoreBreakdown.unmatchedTargetCount === scoreBreakdown.targetCount;
  const hitAccountingMatches =
    hasScoreBreakdown &&
    notesHit <= notesDetected &&
    scoreBreakdown.fullComboHits <= scoreBreakdown.fullHits &&
    scoreBreakdown.fullHits <= scoreBreakdown.matchedTargetCount;

  const sectionTotals = hasSectionBreakdown
    ? sectionBreakdown.reduce(
        (totals, section) => ({
          targetCount: totals.targetCount + (section.targetCount ?? 0),
          matchedTargetCount: totals.matchedTargetCount + (section.matchedTargetCount ?? 0),
          fullComboHits: totals.fullComboHits + (section.fullComboHits ?? 0),
          missedTargetCount: totals.missedTargetCount + (section.missedTargetCount ?? 0),
          ghostNoteCount: totals.ghostNoteCount + (section.ghostNoteCount ?? 0)
        }),
        {
          targetCount: 0,
          matchedTargetCount: 0,
          fullComboHits: 0,
          missedTargetCount: 0,
          ghostNoteCount: 0
        }
      )
    : null;
  const sectionAccountingMatches =
    !hasSectionBreakdown ||
    (
      sectionTotals.targetCount === scoreBreakdown.targetCount &&
      sectionTotals.matchedTargetCount === scoreBreakdown.matchedTargetCount &&
      sectionTotals.fullComboHits === scoreBreakdown.fullComboHits &&
      sectionTotals.missedTargetCount === scoreBreakdown.missedTargetCount &&
      sectionTotals.ghostNoteCount === scoreBreakdown.ghostNoteCount
    );

  const repetitionTotals = hasPracticeRepetitions
    ? practicePreset.repetitions.reduce(
        (totals, repetition) => ({
          targetCount: totals.targetCount + (repetition.targetCount ?? 0),
          fullComboHits: totals.fullComboHits + (repetition.fullComboHits ?? 0),
          missedTargetCount: totals.missedTargetCount + (repetition.missedTargetCount ?? 0),
          ghostNoteCount: totals.ghostNoteCount + (repetition.ghostNoteCount ?? 0)
        }),
        {
          targetCount: 0,
          fullComboHits: 0,
          missedTargetCount: 0,
          ghostNoteCount: 0
        }
      )
    : null;
  const repetitionAccountingMatches =
    !hasPracticeRepetitions ||
    (
      repetitionTotals.targetCount === scoreBreakdown.targetCount &&
      repetitionTotals.fullComboHits === scoreBreakdown.fullComboHits &&
      repetitionTotals.missedTargetCount === scoreBreakdown.missedTargetCount &&
      repetitionTotals.ghostNoteCount === scoreBreakdown.ghostNoteCount
    );

  if (!hasScoreBreakdown) {
    issues.push("score-breakdown-missing");
  }

  if (!targetAccountingMatches) {
    issues.push("target-accounting-mismatch");
  }

  if (!hitAccountingMatches) {
    issues.push("hit-accounting-mismatch");
  }

  if (!sectionAccountingMatches) {
    issues.push("section-accounting-mismatch");
  }

  if (!repetitionAccountingMatches) {
    issues.push("repetition-accounting-mismatch");
  }

  const hasCapture = Boolean(capture);
  const hasDiagnostics =
    Boolean(diagnostics?.currentCapture) ||
    Boolean(diagnostics?.notices?.length);
  const hasArtifact = Boolean(artifact?.filePath);

  return {
    status: issues.length === 0 ? "verified" : "warning",
    mechanicallyComplete: issues.length === 0,
    targetCoverage: calculateShare(scoreBreakdown?.matchedTargetCount ?? 0, scoreBreakdown?.targetCount ?? 0),
    checks: {
      hasScoreBreakdown,
      hasSectionBreakdown,
      hasPracticeRepetitions,
      targetAccountingMatches,
      hitAccountingMatches,
      sectionAccountingMatches,
      repetitionAccountingMatches,
      hasCapture,
      hasDiagnostics,
      hasArtifact
    },
    issues
  };
}

function buildSessionSummary({
  totalScore,
  accuracy,
  notesDetected,
  notesHit,
  scoreBreakdown,
  sectionBreakdown,
  practicePreset,
  rating,
  feedback,
  extraSummary
}) {
  const summary = {
    totalScore,
    accuracy,
    notesDetected,
    notesHit,
    scoreBreakdown,
    sectionBreakdown,
    ...(practicePreset ? { practicePreset } : {}),
    rating,
    feedback,
    ...Object.fromEntries(
      Object.entries(extraSummary).filter(([key]) => key !== "practicePreset")
    )
  };

  return {
    ...summary,
    verification: buildSessionVerification(summary)
  };
}

function observeTargetSustain(targetEvaluation, analysis, frameStartMs, frameDurationMs) {
  if (!targetEvaluation.noteHit || !targetEvaluation.stringHit) {
    return;
  }

  const targetStartMs = targetEvaluation.target.expectedTimeMs;
  const targetEndMs = targetStartMs + targetEvaluation.target.durationMs;
  const frameEndMs = frameStartMs + frameDurationMs;
  const sustainedStringNumber = resolveDetectedStringNumber(
    analysis.note,
    targetEvaluation.target.stringNumber
  );
  const sustainMatches =
    analysis.note === targetEvaluation.target.note &&
    sustainedStringNumber === targetEvaluation.target.stringNumber;

  if (!sustainMatches) {
    return;
  }

  const overlapStartMs = Math.max(frameStartMs, targetStartMs);
  const overlapEndMs = Math.min(frameEndMs, targetEndMs);

  if (overlapEndMs > overlapStartMs) {
    targetEvaluation.detectedDurationMs += overlapEndMs - overlapStartMs;
  }

  const releaseObservationEndMs =
    targetEvaluation.target.releaseObservationEndMs ??
    (targetEndMs + (targetEvaluation.target.releaseToleranceMs ?? 0));
  const releaseOverlapStartMs = Math.max(frameStartMs, targetEndMs);
  const releaseOverlapEndMs = Math.min(frameEndMs, releaseObservationEndMs);

  if (releaseOverlapEndMs > releaseOverlapStartMs) {
    targetEvaluation.postTargetMatchedDurationMs += releaseOverlapEndMs - releaseOverlapStartMs;
  }
}

function buildScoreEvent({
  eventKind = "target-hit",
  sessionId,
  targetIndex,
  detectedNote,
  detectedStringNumber,
  expectedNote,
  expectedStringNumber,
  hit,
  noteHit,
  stringHit,
  timingHit,
  timingClass,
  expectedTimeMs,
  timingWindowMs,
  expectedDurationMs,
  detectedDurationMs,
  holdCoverage,
  sustainHit,
  releasedEarly,
  releaseHit,
  overheld,
  releaseOvershootMs,
  fullComboHit,
  comboCount,
  comboMultiplier,
  comboBroken,
  scheduledBeat,
  measureNumber,
  beatNumber,
  subdivision,
  repetitionIndex,
  repetitionTempoBpm,
  timingOffsetMs,
  confidence,
  scoreDelta
}) {
  return createEnvelope(
    "score.event",
    {
      eventKind,
      targetIndex,
      note: detectedNote ?? "unknown",
      stringNumber: detectedStringNumber ?? undefined,
      expectedNote,
      expectedStringNumber,
      hit,
      noteHit,
      stringHit,
      timingHit,
      timingClass,
      confidence,
      expectedTimeMs,
      timingWindowMs,
      expectedDurationMs,
      detectedDurationMs,
      holdCoverage,
      sustainHit,
      releasedEarly,
      releaseHit,
      overheld,
      releaseOvershootMs,
      fullComboHit,
      comboCount,
      comboMultiplier,
      comboBroken,
      scheduledBeat,
      measureNumber,
      beatNumber,
      subdivision,
      repetitionIndex,
      repetitionTempoBpm,
      timingOffsetMs,
      scoreDelta
    },
    { sessionId }
  );
}

export function createSessionAnalyzer({
  send,
  sessionId,
  exerciseId,
  sampleRate,
  tempoBpm,
  practiceScope,
  loopSectionId,
  loopRepetitionCount,
  loopTempoStepBpm,
  adaptiveLoopExecution = false
}) {
  const schedule = getExerciseSchedule(exerciseId, {
    tempoBpm,
    loopSectionId,
    loopRepetitionCount,
    loopTempoStepBpm
  });
  const targets = schedule.targets;
  const targetStates = targets.map((target) => ({
    ...target,
    matched: false,
    missed: false,
    skipped: false
  }));
  let previousRms = 0;
  let tickFrameCount = 0;
  let totalScore = 0;
  let notesDetected = 0;
  let notesHit = 0;
  let stringHits = 0;
  let timingHits = 0;
  let fullHits = 0;
  let sustainHits = 0;
  let releaseHits = 0;
  let fullComboHits = 0;
  let accumulatedFrameMs = 0;
  let timingOffsetTotalMs = 0;
  let maxTimingOffsetMs = 0;
  let holdCoverageTotal = 0;
  let matchedTargetCount = 0;
  let unmatchedTargetCount = 0;
  let earlyHitCount = 0;
  let lateHitCount = 0;
  let earlyReleaseCount = 0;
  let overholdCount = 0;
  let ghostNoteCount = 0;
  let missedTargetCount = 0;
  let releaseOvershootTotalMs = 0;
  let maxReleaseOvershootMs = 0;
  let currentCombo = 0;
  let maxCombo = 0;
  let comboBreakCount = 0;
  let multiplierPeak = 1;
  let finalized = false;
  const pendingTargetEvaluations = [];
  const sectionStatsMap = new Map();
  const repetitionStatsMap = new Map();
  const reportedRepetitionIndices = new Set();
  const skippedRepetitionIndices = new Set();
  let adaptiveStopRequested = false;
  let adaptiveStopReason = null;
  let adaptiveStopAfterRepetitionIndex = null;

  function getSectionStats(sectionTarget) {
    const sectionId = sectionTarget.sectionId ?? "main";
    const currentSectionStats =
      sectionStatsMap.get(sectionId) ?? createSectionStats(sectionTarget);

    if (!sectionStatsMap.has(sectionId)) {
      sectionStatsMap.set(sectionId, currentSectionStats);
    }

    if (sectionTarget.index !== undefined) {
      currentSectionStats.firstTargetIndex = Math.min(
        currentSectionStats.firstTargetIndex,
        sectionTarget.index
      );
    }

    return currentSectionStats;
  }

  function getRepetitionStats(target) {
    const repetitionIndex = target.repetitionIndex ?? 0;
    const currentRepetitionStats =
      repetitionStatsMap.get(repetitionIndex) ?? createRepetitionStats(target);

    if (!repetitionStatsMap.has(repetitionIndex)) {
      repetitionStatsMap.set(repetitionIndex, currentRepetitionStats);
    }

    if (target.index !== undefined) {
      currentRepetitionStats.firstTargetIndex = Math.min(
        currentRepetitionStats.firstTargetIndex,
        target.index
      );
    }

    return currentRepetitionStats;
  }

  function resolveGhostSectionStats(timestampMs) {
    const closestTarget = [...targetStates].sort((left, right) => {
      const leftDistance = Math.abs(left.expectedTimeMs - timestampMs);
      const rightDistance = Math.abs(right.expectedTimeMs - timestampMs);

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return left.index - right.index;
    })[0];

    return closestTarget ? getSectionStats(closestTarget) : null;
  }

  function buildRepetitionNoticePayload(repetitionResult) {
    return {
      code: repetitionResult.passed
        ? "SECTION_LOOP_REPETITION_PASSED"
        : "SECTION_LOOP_REPETITION_FAILED",
      level: repetitionResult.passed ? "info" : "warning",
      message: repetitionResult.passed
        ? `Section loop repetition ${repetitionResult.repetitionIndex + 1} cleared at ${repetitionResult.tempoBpm} BPM with score ${repetitionResult.performanceScore}.`
        : `Section loop repetition ${repetitionResult.repetitionIndex + 1} needs retry at ${repetitionResult.tempoBpm} BPM. Score ${repetitionResult.performanceScore}, misses ${repetitionResult.missedTargetCount}, ghosts ${repetitionResult.ghostNoteCount}.`
    };
  }

  function markFutureRepetitionsSkipped(afterRepetitionIndex) {
    for (const targetState of targetStates) {
      if (
        (targetState.repetitionIndex ?? 0) <= afterRepetitionIndex ||
        targetState.matched ||
        targetState.missed ||
        targetState.skipped
      ) {
        continue;
      }

      targetState.skipped = true;
      skippedRepetitionIndices.add(targetState.repetitionIndex ?? 0);
      const sectionStats = getSectionStats(targetState);
      const repetitionStats = getRepetitionStats(targetState);
      sectionStats.targetCount = Math.max(0, sectionStats.targetCount - 1);
      repetitionStats.targetCount = Math.max(0, repetitionStats.targetCount - 1);
    }
  }

  function finalizeCompletedRepetitions(referenceTimestampMs) {
    const practiceRepetitions = schedule.practicePlan?.repetitions ?? [];

    for (const plannedRepetition of practiceRepetitions) {
      if (reportedRepetitionIndices.has(plannedRepetition.repetitionIndex)) {
        continue;
      }

      if (referenceTimestampMs < plannedRepetition.startTimeMs + plannedRepetition.durationMs) {
        continue;
      }

      if (
        pendingTargetEvaluations.some(
          (targetEvaluation) => targetEvaluation.target.repetitionIndex === plannedRepetition.repetitionIndex
        )
      ) {
        continue;
      }

      const unresolvedTargets = targetStates.some(
        (targetState) =>
          targetState.repetitionIndex === plannedRepetition.repetitionIndex &&
          !targetState.matched &&
          !targetState.missed &&
          !targetState.skipped
      );

      if (unresolvedTargets) {
        continue;
      }

      const repetitionStats = repetitionStatsMap.get(plannedRepetition.repetitionIndex) ?? {
        repetitionIndex: plannedRepetition.repetitionIndex,
        tempoBpm: plannedRepetition.tempoBpm,
        targetCount: 0,
        fullComboHits: 0,
        missedTargetCount: 0,
        ghostNoteCount: 0,
        performancePenalty: 0
      };
      const repetitionResult = buildRepetitionResult(plannedRepetition, repetitionStats, {
        skipped: skippedRepetitionIndices.has(plannedRepetition.repetitionIndex)
      });

      reportedRepetitionIndices.add(plannedRepetition.repetitionIndex);

      if (!repetitionResult.skipped) {
        send(
          createEnvelope("session.notice", buildRepetitionNoticePayload(repetitionResult), {
            sessionId
          })
        );
      }

      if (
        adaptiveLoopExecution &&
        practiceScope === "section-loop" &&
        !adaptiveStopRequested &&
        shouldTriggerAdaptiveStop(repetitionResult) &&
        plannedRepetition.repetitionIndex < practiceRepetitions.length - 1
      ) {
        adaptiveStopRequested = true;
        adaptiveStopAfterRepetitionIndex = plannedRepetition.repetitionIndex;
        adaptiveStopReason = `Repetition ${plannedRepetition.repetitionIndex + 1} fell below the adaptive threshold at ${plannedRepetition.tempoBpm} BPM.`;
        markFutureRepetitionsSkipped(plannedRepetition.repetitionIndex);
        send(
          createEnvelope(
            "session.notice",
            {
              code: "SECTION_LOOP_ADAPTIVE_STOP",
              level: "warning",
              message: `${adaptiveStopReason} Remaining section-loop repetitions were skipped to stabilize the base pattern.`
            },
            { sessionId }
          )
        );
      }
    }
  }

  for (const target of targets) {
    const sectionStats = getSectionStats(target);
    sectionStats.targetCount += 1;
    const repetitionStats = getRepetitionStats(target);
    repetitionStats.targetCount += 1;
  }

  function resetCombo() {
    if (currentCombo > 0) {
      comboBreakCount += 1;
    }

    currentCombo = 0;
  }

  function finalizeTargetEvaluation(targetEvaluation) {
    const sectionStats = getSectionStats(targetEvaluation.target);
    const repetitionStats = getRepetitionStats(targetEvaluation.target);
    const holdCoverage = Number(
      Math.min(
        1,
        targetEvaluation.target.durationMs === 0
          ? 1
          : targetEvaluation.detectedDurationMs / targetEvaluation.target.durationMs
      ).toFixed(2)
    );
    const sustainHit =
      targetEvaluation.noteHit &&
      targetEvaluation.stringHit &&
      holdCoverage >= SUSTAIN_COVERAGE_THRESHOLD;
    const releasedEarly =
      targetEvaluation.noteHit &&
      targetEvaluation.stringHit &&
      !sustainHit;
    const releaseOvershootMs = Math.max(
      0,
      Math.round(targetEvaluation.postTargetMatchedDurationMs - targetEvaluation.target.releaseToleranceMs)
    );
    const releaseHit = sustainHit && releaseOvershootMs === 0;
    const overheld = sustainHit && releaseOvershootMs > 0;
    const fullComboHit = targetEvaluation.noteHit &&
      targetEvaluation.stringHit &&
      targetEvaluation.timingHit &&
      sustainHit &&
      releaseHit;
    const baseScoreDelta = calculateScoreDelta({
      noteHit: targetEvaluation.noteHit,
      stringHit: targetEvaluation.stringHit,
      timingHit: targetEvaluation.timingHit,
      sustainHit,
      releaseHit
    });
    const comboBroken = !fullComboHit && currentCombo > 0;

    if (fullComboHit) {
      currentCombo += 1;
      maxCombo = Math.max(maxCombo, currentCombo);
    } else {
      resetCombo();
    }

    const comboMultiplier = fullComboHit ? getComboMultiplier(currentCombo) : 1;
    const scoreDelta = baseScoreDelta * comboMultiplier;
    multiplierPeak = Math.max(multiplierPeak, comboMultiplier);

    totalScore += scoreDelta;
    notesHit += targetEvaluation.noteHit ? 1 : 0;
    stringHits += targetEvaluation.stringHit ? 1 : 0;
    timingHits += targetEvaluation.timingHit ? 1 : 0;
    fullHits += targetEvaluation.noteHit && targetEvaluation.stringHit && targetEvaluation.timingHit ? 1 : 0;
    sustainHits += sustainHit ? 1 : 0;
    releaseHits += releaseHit ? 1 : 0;
    fullComboHits += fullComboHit ? 1 : 0;
    earlyHitCount += targetEvaluation.timingClass === "early" ? 1 : 0;
    lateHitCount += targetEvaluation.timingClass === "late" ? 1 : 0;
    earlyReleaseCount += releasedEarly ? 1 : 0;
    overholdCount += overheld ? 1 : 0;
    timingOffsetTotalMs += Math.abs(targetEvaluation.timingOffsetMs);
    maxTimingOffsetMs = Math.max(maxTimingOffsetMs, Math.abs(targetEvaluation.timingOffsetMs));
    holdCoverageTotal += holdCoverage;
    releaseOvershootTotalMs += releaseOvershootMs;
    maxReleaseOvershootMs = Math.max(maxReleaseOvershootMs, releaseOvershootMs);
    sectionStats.matchedTargetCount += 1;
    sectionStats.fullComboHits += fullComboHit ? 1 : 0;
    sectionStats.earlyHitCount += targetEvaluation.timingClass === "early" ? 1 : 0;
    sectionStats.lateHitCount += targetEvaluation.timingClass === "late" ? 1 : 0;
    sectionStats.earlyReleaseCount += releasedEarly ? 1 : 0;
    sectionStats.overholdCount += overheld ? 1 : 0;
    sectionStats.timingOffsetTotalMs += Math.abs(targetEvaluation.timingOffsetMs);
    sectionStats.timingSampleCount += 1;
    sectionStats.holdCoverageTotal += holdCoverage;
    sectionStats.holdCoverageCount += 1;
    sectionStats.releaseOvershootTotalMs += releaseOvershootMs;
    sectionStats.releaseOvershootCount += 1;
    repetitionStats.fullComboHits += fullComboHit ? 1 : 0;
    repetitionStats.performancePenalty +=
      (releasedEarly ? 3 : 0) +
      (overheld ? 3 : 0) +
      Math.min(8, Math.abs(targetEvaluation.timingOffsetMs) / 12);

    send(
      buildScoreEvent({
        eventKind: "target-hit",
        sessionId,
        targetIndex: targetEvaluation.target.index,
        detectedNote: targetEvaluation.detectedNote,
        detectedStringNumber: targetEvaluation.detectedStringNumber,
        expectedNote: targetEvaluation.target.note,
        expectedStringNumber: targetEvaluation.target.stringNumber,
        hit: targetEvaluation.noteHit && targetEvaluation.stringHit && targetEvaluation.timingHit,
        noteHit: targetEvaluation.noteHit,
        stringHit: targetEvaluation.stringHit,
        timingHit: targetEvaluation.timingHit,
        timingClass: targetEvaluation.timingClass,
        expectedTimeMs: targetEvaluation.target.expectedTimeMs,
        timingWindowMs: targetEvaluation.target.timingWindowMs,
        expectedDurationMs: targetEvaluation.target.durationMs,
        detectedDurationMs: Math.round(targetEvaluation.detectedDurationMs),
        holdCoverage,
        sustainHit,
        releasedEarly,
        releaseHit,
        overheld,
        releaseOvershootMs,
        fullComboHit,
        comboCount: currentCombo,
        comboMultiplier,
        comboBroken,
        scheduledBeat: targetEvaluation.target.scheduledBeat,
        measureNumber: targetEvaluation.target.measureNumber,
        beatNumber: targetEvaluation.target.beatNumber,
        subdivision: targetEvaluation.target.subdivision,
        repetitionIndex: targetEvaluation.target.repetitionIndex,
        repetitionTempoBpm: targetEvaluation.target.repetitionTempoBpm,
        timingOffsetMs: targetEvaluation.timingOffsetMs,
        confidence: targetEvaluation.confidence,
        scoreDelta
      })
    );
  }

  function emitGhostNoteEvent({
    detectedNote,
    detectedStringNumber,
    currentFrameTimestampMs
  }) {
    const sectionStats = resolveGhostSectionStats(currentFrameTimestampMs);
    const comboBroken = currentCombo > 0;
    resetCombo();
    totalScore += GHOST_NOTE_SCORE_DELTA;
    ghostNoteCount += 1;
    if (sectionStats) {
      sectionStats.ghostNoteCount += 1;
    }
    const repetitionTarget = [...targetStates]
      .filter((target) => !target.skipped)
      .sort(
        (left, right) => Math.abs(left.expectedTimeMs - currentFrameTimestampMs) - Math.abs(right.expectedTimeMs - currentFrameTimestampMs)
      )[0];
    if (repetitionTarget) {
      getRepetitionStats(repetitionTarget).ghostNoteCount += 1;
    }

    send(
      buildScoreEvent({
        eventKind: "ghost-note",
        sessionId,
        targetIndex: -1,
        detectedNote,
        detectedStringNumber,
        expectedNote: "outside-chart",
        expectedStringNumber: 0,
        hit: false,
        noteHit: false,
        stringHit: false,
        timingHit: false,
        timingClass: "out-of-window",
        expectedTimeMs: currentFrameTimestampMs,
        timingWindowMs: 0,
        expectedDurationMs: 0,
        detectedDurationMs: 0,
        holdCoverage: 0,
        sustainHit: false,
        releasedEarly: false,
        releaseHit: false,
        overheld: false,
        releaseOvershootMs: 0,
        fullComboHit: false,
        comboCount: currentCombo,
        comboMultiplier: 1,
        comboBroken,
        scheduledBeat: 0,
        measureNumber: 0,
        beatNumber: 0,
        subdivision: 0,
        timingOffsetMs: 0,
        confidence: 0.22,
        scoreDelta: GHOST_NOTE_SCORE_DELTA
      })
    );
  }

  function emitMissedTargetEvent(targetState) {
    const sectionStats = getSectionStats(targetState);
    const repetitionStats = getRepetitionStats(targetState);
    const comboBroken = currentCombo > 0;
    resetCombo();
    totalScore += MISSED_TARGET_SCORE_DELTA;
    missedTargetCount += 1;
    targetState.missed = true;
    sectionStats.missedTargetCount += 1;
    repetitionStats.missedTargetCount += 1;

    send(
      buildScoreEvent({
        eventKind: "missed-target",
        sessionId,
        targetIndex: targetState.index,
        detectedNote: "missed",
        detectedStringNumber: null,
        expectedNote: targetState.note,
        expectedStringNumber: targetState.stringNumber,
        hit: false,
        noteHit: false,
        stringHit: false,
        timingHit: false,
        timingClass: "missed",
        expectedTimeMs: targetState.expectedTimeMs,
        timingWindowMs: targetState.timingWindowMs,
        expectedDurationMs: targetState.durationMs,
        detectedDurationMs: 0,
        holdCoverage: 0,
        sustainHit: false,
        releasedEarly: false,
        releaseHit: false,
        overheld: false,
        releaseOvershootMs: 0,
        fullComboHit: false,
        comboCount: currentCombo,
        comboMultiplier: 1,
        comboBroken,
        scheduledBeat: targetState.scheduledBeat,
        measureNumber: targetState.measureNumber,
        beatNumber: targetState.beatNumber,
        subdivision: targetState.subdivision,
        repetitionIndex: targetState.repetitionIndex,
        repetitionTempoBpm: targetState.repetitionTempoBpm,
        timingOffsetMs: 0,
        confidence: 0,
        scoreDelta: MISSED_TARGET_SCORE_DELTA
      })
    );
  }

  function flushPendingTargetEvaluations(frameEndMs, { flushAll = false } = {}) {
    const remainingEvaluations = [];

    for (const targetEvaluation of pendingTargetEvaluations) {
      const evaluationEndMs =
        targetEvaluation.target.releaseObservationEndMs ??
        (targetEvaluation.target.expectedTimeMs + targetEvaluation.target.durationMs);

      if (!flushAll && frameEndMs < evaluationEndMs) {
        remainingEvaluations.push(targetEvaluation);
        continue;
      }

      finalizeTargetEvaluation(targetEvaluation);
    }

    pendingTargetEvaluations.length = 0;
    pendingTargetEvaluations.push(...remainingEvaluations);
  }

  function flushMissedTargets(referenceTimestampMs, { flushAll = false } = {}) {
    for (const targetState of targetStates) {
      if (targetState.skipped || targetState.matched || targetState.missed) {
        continue;
      }

      const missDeadlineMs = targetState.expectedTimeMs + targetState.timingWindowMs * 1.5;

      if (!flushAll && referenceTimestampMs < missDeadlineMs) {
        continue;
      }

      emitMissedTargetEvent(targetState);
    }
  }

  return {
    getLoopSectionLabel() {
      return schedule.sections[0]?.label ?? null;
    },

    getPracticePlan() {
      return schedule.practicePlan;
    },

    shouldStopEarly() {
      return adaptiveStopRequested;
    },

    processSamples(samples, frameMetadata = {}) {
      if (finalized) {
        return;
      }

      const analysis = analyzeFrame(samples, sampleRate, previousRms);
      previousRms = analysis.rms;
      const frameDurationMs = Number(((samples.length / sampleRate) * 1000).toFixed(2));
      const currentFrameTimestampMs = frameMetadata.timestampMs ?? accumulatedFrameMs;
      const currentFrameEndMs = currentFrameTimestampMs + frameDurationMs;
      accumulatedFrameMs = currentFrameEndMs;

      for (const targetEvaluation of pendingTargetEvaluations) {
        observeTargetSustain(
          targetEvaluation,
          analysis,
          currentFrameTimestampMs,
          frameDurationMs
        );
      }

      flushPendingTargetEvaluations(currentFrameEndMs);
      flushMissedTargets(currentFrameTimestampMs);
      finalizeCompletedRepetitions(currentFrameEndMs);

      // Emit a lightweight audio.tick every 4 frames (~200 ms at 48 kHz / 2048)
      // so the web UI can show a live note indicator without flooding the socket.
      tickFrameCount += 1;
      if (tickFrameCount % 4 === 0) {
        send(
          createEnvelope("audio.tick", {
            sessionId,
            note: analysis.note ?? null,
            frequency: analysis.frequency > 0 ? Math.round(analysis.frequency) : 0,
            rms: Number(analysis.rms.toFixed(4))
          })
        );
      }

      if (adaptiveStopRequested) {
        return;
      }

      if (!analysis.onset) {
        return;
      }

      const target =
        resolveTargetForTimestamp(targetStates, currentFrameTimestampMs);
      notesDetected += 1;

      if (!target) {
        emitGhostNoteEvent({
          detectedNote: analysis.note,
          detectedStringNumber: resolveDetectedStringNumber(analysis.note, null),
          currentFrameTimestampMs
        });
        return;
      }

      const targetState = targetStates.find((candidate) => candidate.index === target.index);

      if (targetState && !targetState.matched) {
        targetState.matched = true;
        matchedTargetCount += 1;
      }

      const detectedNote = analysis.note;
      const detectedStringNumber = resolveDetectedStringNumber(detectedNote, target.stringNumber);
      const noteHit = detectedNote === target.note;
      const stringHit = detectedStringNumber === target.stringNumber;
      const timingOffsetMs = Math.round(currentFrameTimestampMs - target.expectedTimeMs);
      const timingHit = Math.abs(timingOffsetMs) <= target.timingWindowMs;
      const timingClass = classifyTiming(timingOffsetMs, target.timingWindowMs);
      const hit = noteHit && stringHit && timingHit;
      const confidence = hit ? 0.94 : noteHit && stringHit ? 0.81 : noteHit ? 0.7 : 0.56;

      const targetEvaluation = createTargetEvaluation({
        target,
        detectedNote,
        detectedStringNumber,
        noteHit,
        stringHit,
        timingHit,
        timingClass,
        timingOffsetMs,
        confidence
      });

      observeTargetSustain(
        targetEvaluation,
        analysis,
        currentFrameTimestampMs,
        frameDurationMs
      );

      pendingTargetEvaluations.push(targetEvaluation);
      flushPendingTargetEvaluations(currentFrameEndMs);
    },

    finalize(extraSummary = {}) {
      flushPendingTargetEvaluations(accumulatedFrameMs, { flushAll: true });
      flushMissedTargets(accumulatedFrameMs, { flushAll: true });
      finalizeCompletedRepetitions(accumulatedFrameMs);
      unmatchedTargetCount = targetStates.filter((target) => !target.matched && !target.skipped).length;
      const executedTargetCount = targetStates.filter((target) => !target.skipped).length;
      const scoreBreakdown = {
        tempoBpm: schedule.tempoBpm,
        targetCount: executedTargetCount,
        matchedTargetCount,
        unmatchedTargetCount,
        noteHits: notesHit,
        stringHits,
        timingHits,
        fullHits,
        sustainHits,
        releaseHits,
        fullComboHits,
        earlyHitCount,
        lateHitCount,
        earlyReleaseCount,
        overholdCount,
        ghostNoteCount,
        missedTargetCount,
        maxCombo,
        comboBreakCount,
        multiplierPeak,
        misses: Math.max(0, executedTargetCount - fullHits),
        averageTimingOffsetMs:
          notesDetected === 0 ? 0 : Number((timingOffsetTotalMs / notesDetected).toFixed(2)),
        maxTimingOffsetMs,
        averageHoldCoverage:
          notesDetected === 0 ? 0 : Number((holdCoverageTotal / notesDetected).toFixed(2)),
        averageReleaseOvershootMs:
          notesDetected === 0 ? 0 : Number((releaseOvershootTotalMs / notesDetected).toFixed(2)),
        maxReleaseOvershootMs
      };

      if (finalized) {
        const accuracy = executedTargetCount === 0 ? 0 : Number((fullComboHits / executedTargetCount).toFixed(2));
        const rating = buildSessionRating({
          accuracy,
          scoreBreakdown
        });
        const repetitionBreakdown = buildRepetitionBreakdown(
          repetitionStatsMap,
          schedule.practicePlan,
          skippedRepetitionIndices
        );
        const adaptiveExecution = buildAdaptiveExecution(extraSummary.practicePreset, repetitionBreakdown, {
          triggered: adaptiveStopRequested,
          stoppedAfterRepetitionIndex: adaptiveStopAfterRepetitionIndex,
          stopReason: adaptiveStopReason
        });
        const enrichedPracticePreset = extraSummary.practicePreset
          ? {
              ...extraSummary.practicePreset,
              repetitions: repetitionBreakdown,
              ...(buildMasteryGate({
                ...extraSummary.practicePreset,
                repetitions: repetitionBreakdown
              })
                ? {
                    masteryGate: buildMasteryGate({
                      ...extraSummary.practicePreset,
                      repetitions: repetitionBreakdown
                    })
                  }
                : {})
              ,
              ...(adaptiveExecution ? { adaptiveExecution } : {})
            }
          : undefined;
        return buildSessionSummary({
          totalScore,
          accuracy,
          notesDetected,
          notesHit,
          scoreBreakdown,
          sectionBreakdown: buildSectionBreakdown(sectionStatsMap),
          practicePreset: enrichedPracticePreset,
          rating,
          feedback: buildSessionFeedback({
            scoreBreakdown,
            rating
          }),
          extraSummary
        });
      }

      const accuracy = executedTargetCount === 0 ? 0 : Number((fullComboHits / executedTargetCount).toFixed(2));
      const rating = buildSessionRating({
        accuracy,
        scoreBreakdown
      });
      finalized = true;
      const repetitionBreakdown = buildRepetitionBreakdown(
        repetitionStatsMap,
        schedule.practicePlan,
        skippedRepetitionIndices
      );
      const adaptiveExecution = buildAdaptiveExecution(extraSummary.practicePreset, repetitionBreakdown, {
        triggered: adaptiveStopRequested,
        stoppedAfterRepetitionIndex: adaptiveStopAfterRepetitionIndex,
        stopReason: adaptiveStopReason
      });
      const enrichedPracticePreset = extraSummary.practicePreset
        ? {
            ...extraSummary.practicePreset,
            repetitions: repetitionBreakdown,
            ...(buildMasteryGate({
              ...extraSummary.practicePreset,
              repetitions: repetitionBreakdown
            })
              ? {
                  masteryGate: buildMasteryGate({
                    ...extraSummary.practicePreset,
                    repetitions: repetitionBreakdown
                  })
                }
              : {})
            ,
            ...(adaptiveExecution ? { adaptiveExecution } : {})
          }
        : undefined;

      const summary = buildSessionSummary({
        totalScore,
        accuracy,
        notesDetected,
        notesHit,
        scoreBreakdown,
        sectionBreakdown: buildSectionBreakdown(sectionStatsMap),
        practicePreset: enrichedPracticePreset,
        rating,
        feedback: buildSessionFeedback({
          scoreBreakdown,
          rating
        }),
        extraSummary
      });

      send(
        createEnvelope(
          "session.summary",
          summary,
          { sessionId }
        )
      );

      return summary;
    }
  };
}
