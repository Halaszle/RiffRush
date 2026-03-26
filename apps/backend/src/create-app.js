import { createServer } from "node:http";
import { sendError, sendJson, sendText, readJsonBody, isOptionsRequest, normalizeNumber } from "./lib/http.js";
import { TrainingRepository } from "./repositories/training-repository.js";
import { SessionRepository } from "./repositories/session-repository.js";
import { UserRepository } from "./repositories/user-repository.js";
import { AuthService } from "./services/auth-service.js";
import { SessionService } from "./services/session-service.js";
import { UserService } from "./services/user-service.js";

// Allowed values for the telemetry event_type field.
const TELEMETRY_EVENT_TYPES = ["js-error", "unhandled-rejection", "manual-report"];

function validateSessionCreateBody(body) {
  if (!body.trainingId || typeof body.trainingId !== "string") {
    return "Field trainingId is required and must be a string.";
  }

  if (
    body.inputMode !== undefined &&
    body.inputMode !== "synthetic" &&
    body.inputMode !== "wav-file" &&
    body.inputMode !== "live-stream" &&
    body.inputMode !== "native-capture"
  ) {
    return "Field inputMode must be synthetic, wav-file, live-stream or native-capture when provided.";
  }

  if (
    body.inputMode === "wav-file" &&
    (!body.inputFilePath || typeof body.inputFilePath !== "string")
  ) {
    return "Field inputFilePath is required when inputMode is wav-file.";
  }

  if (body.captureDurationMs !== undefined && Number.isNaN(normalizeNumber(body.captureDurationMs))) {
    return "Field captureDurationMs must be numeric when provided.";
  }

  if (body.tempoBpm !== undefined && Number.isNaN(normalizeNumber(body.tempoBpm))) {
    return "Field tempoBpm must be numeric when provided.";
  }

  if (
    body.practiceScope !== undefined &&
    body.practiceScope !== "full-chart" &&
    body.practiceScope !== "section-loop"
  ) {
    return "Field practiceScope must be full-chart or section-loop when provided.";
  }

  if (
    body.practiceScope === "section-loop" &&
    (!body.loopSectionId || typeof body.loopSectionId !== "string")
  ) {
    return "Field loopSectionId is required when practiceScope is section-loop.";
  }

  if (body.loopRepetitionCount !== undefined && Number.isNaN(normalizeNumber(body.loopRepetitionCount))) {
    return "Field loopRepetitionCount must be numeric when provided.";
  }

  if (body.loopTempoStepBpm !== undefined && Number.isNaN(normalizeNumber(body.loopTempoStepBpm))) {
    return "Field loopTempoStepBpm must be numeric when provided.";
  }

  if (
    body.captureProfile !== undefined &&
    body.captureProfile !== "safe" &&
    body.captureProfile !== "balanced" &&
    body.captureProfile !== "low-latency"
  ) {
    return "Field captureProfile must be safe, balanced or low-latency when provided.";
  }

  if (
    body.inputDeviceBackend !== undefined &&
    body.inputDeviceBackend !== "wavein" &&
    body.inputDeviceBackend !== "wasapi"
  ) {
    return "Field inputDeviceBackend must be wavein or wasapi when provided.";
  }

  if (body.inputDeviceId !== undefined && typeof body.inputDeviceId !== "string") {
    return "Field inputDeviceId must be a string when provided.";
  }

  if (body.inputDeviceNumber !== undefined && Number.isNaN(normalizeNumber(body.inputDeviceNumber))) {
    return "Field inputDeviceNumber must be numeric when provided.";
  }

  if (
    body.recoveryGoalTrainingId !== undefined &&
    typeof body.recoveryGoalTrainingId !== "string"
  ) {
    return "Field recoveryGoalTrainingId must be a string when provided.";
  }

  if (
    body.recoveryGoalSectionId !== undefined &&
    typeof body.recoveryGoalSectionId !== "string"
  ) {
    return "Field recoveryGoalSectionId must be a string when provided.";
  }

  if (
    body.returnRecoveryTrainingId !== undefined &&
    typeof body.returnRecoveryTrainingId !== "string"
  ) {
    return "Field returnRecoveryTrainingId must be a string when provided.";
  }

  if (
    body.returnGoalSectionId !== undefined &&
    typeof body.returnGoalSectionId !== "string"
  ) {
    return "Field returnGoalSectionId must be a string when provided.";
  }

  if (
    body.promotionSourceTrainingId !== undefined &&
    typeof body.promotionSourceTrainingId !== "string"
  ) {
    return "Field promotionSourceTrainingId must be a string when provided.";
  }

  if (
    body.recoveryReason !== undefined &&
    typeof body.recoveryReason !== "string"
  ) {
    return "Field recoveryReason must be a string when provided.";
  }

  if (
    body.returnReason !== undefined &&
    typeof body.returnReason !== "string"
  ) {
    return "Field returnReason must be a string when provided.";
  }

  if (
    body.promotionReason !== undefined &&
    typeof body.promotionReason !== "string"
  ) {
    return "Field promotionReason must be a string when provided.";
  }

  if (
    body.promotionPhase !== undefined &&
    body.promotionPhase !== "landing" &&
    body.promotionPhase !== "ramp" &&
    body.promotionPhase !== "reentry" &&
    body.promotionPhase !== "chain" &&
    body.promotionPhase !== "chain-validation" &&
    body.promotionPhase !== "chain-graduation"
  ) {
    return "Field promotionPhase must be landing, ramp, reentry, chain, chain-validation or chain-graduation when provided.";
  }

  if (
    body.recoveryStrategy !== undefined &&
    typeof body.recoveryStrategy !== "string"
  ) {
    return "Field recoveryStrategy must be a string when provided.";
  }

  for (const numericField of [
    "recoveryReturnTempoBpm",
    "recoveryReturnLoopRepetitionCount",
    "recoveryReturnLoopTempoStepBpm",
    "promotionSourceTempoBpm",
    "promotionRampBaseTempoBpm",
    "promotionRampTargetTempoBpm",
    "promotionChainBaseTempoBpm",
    "promotionChainTargetTempoBpm"
  ]) {
    if (body[numericField] !== undefined && Number.isNaN(normalizeNumber(body[numericField]))) {
      return `Field ${numericField} must be numeric when provided.`;
    }
  }

  const calibrationOffsetMs = normalizeNumber(body.calibrationOffsetMs, 0);

  if (Number.isNaN(calibrationOffsetMs)) {
    return "Field calibrationOffsetMs must be numeric when provided.";
  }

  return null;
}

function validateCaptureMetadata(capture, { fieldPrefix = "capture", requireSource = true } = {}) {
  if (typeof capture !== "object" || capture === null) {
    return `Field ${fieldPrefix} must be an object when provided.`;
  }

  if (
    requireSource &&
    capture.source !== "synthetic" &&
    capture.source !== "wav-file" &&
    capture.source !== "live-stream" &&
    capture.source !== "native-capture"
  ) {
    return `Field ${fieldPrefix}.source must be synthetic, wav-file, live-stream or native-capture when provided.`;
  }

  for (const profileField of ["profile", "requestedProfile"]) {
    if (
      capture[profileField] !== undefined &&
      capture[profileField] !== "safe" &&
      capture[profileField] !== "balanced" &&
      capture[profileField] !== "low-latency"
    ) {
      return `Field ${fieldPrefix}.${profileField} must be safe, balanced or low-latency when provided.`;
    }
  }

  for (const backendField of ["backend", "requestedBackend"]) {
    if (
      capture[backendField] !== undefined &&
      capture[backendField] !== "wavein" &&
      capture[backendField] !== "wasapi"
    ) {
      return `Field ${fieldPrefix}.${backendField} must be wavein or wasapi when provided.`;
    }
  }

  for (const numericField of [
    "deviceNumber",
    "sampleRate",
    "chunkCount",
    "durationMs",
    "bufferMs",
    "numberOfBuffers",
    "startAttemptCount",
    "maxChunkGapMs",
    "lowSignalEventCount",
    "lowSignalChunkCount"
  ]) {
    if (
      capture[numericField] !== undefined &&
      Number.isNaN(normalizeNumber(capture[numericField]))
    ) {
      return `Field ${fieldPrefix}.${numericField} must be numeric when provided.`;
    }
  }

  for (const stringField of ["deviceId", "deviceName", "fallbackReason"]) {
    if (
      capture[stringField] !== undefined &&
      typeof capture[stringField] !== "string"
    ) {
      return `Field ${fieldPrefix}.${stringField} must be a string when provided.`;
    }
  }

  for (const booleanField of ["useEventSync", "fallbackApplied"]) {
    if (
      capture[booleanField] !== undefined &&
      typeof capture[booleanField] !== "boolean"
    ) {
      return `Field ${fieldPrefix}.${booleanField} must be a boolean when provided.`;
    }
  }

  return null;
}

function normalizeCaptureMetadata(capture, { includeSource = true } = {}) {
  return {
    ...(includeSource && capture.source ? { source: capture.source } : {}),
    ...(capture.profile ? { profile: capture.profile } : {}),
    ...(capture.requestedProfile ? { requestedProfile: capture.requestedProfile } : {}),
    ...(capture.backend ? { backend: capture.backend } : {}),
    ...(capture.requestedBackend ? { requestedBackend: capture.requestedBackend } : {}),
    ...(capture.deviceId ? { deviceId: capture.deviceId } : {}),
    ...(capture.deviceName ? { deviceName: capture.deviceName } : {}),
    ...(capture.deviceNumber !== undefined ? { deviceNumber: normalizeNumber(capture.deviceNumber) } : {}),
    ...(capture.sampleRate !== undefined ? { sampleRate: normalizeNumber(capture.sampleRate) } : {}),
    ...(capture.chunkCount !== undefined ? { chunkCount: normalizeNumber(capture.chunkCount) } : {}),
    ...(capture.durationMs !== undefined ? { durationMs: normalizeNumber(capture.durationMs) } : {}),
    ...(capture.bufferMs !== undefined ? { bufferMs: normalizeNumber(capture.bufferMs) } : {}),
    ...(capture.numberOfBuffers !== undefined ? { numberOfBuffers: normalizeNumber(capture.numberOfBuffers) } : {}),
    ...(capture.startAttemptCount !== undefined ? { startAttemptCount: normalizeNumber(capture.startAttemptCount) } : {}),
    ...(capture.maxChunkGapMs !== undefined ? { maxChunkGapMs: normalizeNumber(capture.maxChunkGapMs) } : {}),
    ...(capture.lowSignalEventCount !== undefined ? { lowSignalEventCount: normalizeNumber(capture.lowSignalEventCount) } : {}),
    ...(capture.lowSignalChunkCount !== undefined ? { lowSignalChunkCount: normalizeNumber(capture.lowSignalChunkCount) } : {}),
    ...(capture.useEventSync !== undefined ? { useEventSync: capture.useEventSync } : {}),
    ...(capture.fallbackApplied !== undefined ? { fallbackApplied: capture.fallbackApplied } : {}),
    ...(capture.fallbackReason ? { fallbackReason: capture.fallbackReason } : {})
  };
}

function calculateVerificationShare(part, total) {
  const normalizedTotal = normalizeNumber(total, 0);

  if (!normalizedTotal) {
    return 0;
  }

  return Number((normalizeNumber(part, 0) / normalizedTotal).toFixed(2));
}

function deriveSessionVerification(body) {
  const scoreBreakdown = body.scoreBreakdown ?? null;
  const sectionBreakdown = Array.isArray(body.sectionBreakdown) ? body.sectionBreakdown : [];
  const repetitions = Array.isArray(body.practicePreset?.repetitions) ? body.practicePreset.repetitions : [];
  const issues = [];
  const hasScoreBreakdown = Boolean(scoreBreakdown);
  const hasSectionBreakdown = sectionBreakdown.length > 0;
  const hasPracticeRepetitions = repetitions.length > 0;

  const targetAccountingMatches =
    hasScoreBreakdown &&
    normalizeNumber(scoreBreakdown.matchedTargetCount, 0) + normalizeNumber(scoreBreakdown.unmatchedTargetCount, 0) ===
      normalizeNumber(scoreBreakdown.targetCount, 0);
  const hitAccountingMatches =
    hasScoreBreakdown &&
    normalizeNumber(body.notesHit, 0) <= normalizeNumber(body.notesDetected, 0) &&
    normalizeNumber(scoreBreakdown.fullComboHits, 0) <= normalizeNumber(scoreBreakdown.fullHits, 0) &&
    normalizeNumber(scoreBreakdown.fullHits, 0) <= normalizeNumber(scoreBreakdown.matchedTargetCount, 0);

  const sectionTotals = hasSectionBreakdown
    ? sectionBreakdown.reduce(
        (totals, section) => ({
          targetCount: totals.targetCount + normalizeNumber(section.targetCount, 0),
          matchedTargetCount: totals.matchedTargetCount + normalizeNumber(section.matchedTargetCount, 0),
          fullComboHits: totals.fullComboHits + normalizeNumber(section.fullComboHits, 0),
          missedTargetCount: totals.missedTargetCount + normalizeNumber(section.missedTargetCount, 0),
          ghostNoteCount: totals.ghostNoteCount + normalizeNumber(section.ghostNoteCount, 0)
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
      sectionTotals.targetCount === normalizeNumber(scoreBreakdown.targetCount, 0) &&
      sectionTotals.matchedTargetCount === normalizeNumber(scoreBreakdown.matchedTargetCount, 0) &&
      sectionTotals.fullComboHits === normalizeNumber(scoreBreakdown.fullComboHits, 0) &&
      sectionTotals.missedTargetCount === normalizeNumber(scoreBreakdown.missedTargetCount, 0) &&
      sectionTotals.ghostNoteCount === normalizeNumber(scoreBreakdown.ghostNoteCount, 0)
    );

  const repetitionTotals = hasPracticeRepetitions
    ? repetitions.reduce(
        (totals, repetition) => ({
          targetCount: totals.targetCount + normalizeNumber(repetition.targetCount, 0),
          fullComboHits: totals.fullComboHits + normalizeNumber(repetition.fullComboHits, 0),
          missedTargetCount: totals.missedTargetCount + normalizeNumber(repetition.missedTargetCount, 0),
          ghostNoteCount: totals.ghostNoteCount + normalizeNumber(repetition.ghostNoteCount, 0)
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
      repetitionTotals.targetCount === normalizeNumber(scoreBreakdown.targetCount, 0) &&
      repetitionTotals.fullComboHits === normalizeNumber(scoreBreakdown.fullComboHits, 0) &&
      repetitionTotals.missedTargetCount === normalizeNumber(scoreBreakdown.missedTargetCount, 0) &&
      repetitionTotals.ghostNoteCount === normalizeNumber(scoreBreakdown.ghostNoteCount, 0)
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

  return {
    status: issues.length === 0 ? "verified" : "warning",
    mechanicallyComplete: issues.length === 0,
    targetCoverage: calculateVerificationShare(scoreBreakdown?.matchedTargetCount, scoreBreakdown?.targetCount),
    checks: {
      hasScoreBreakdown,
      hasSectionBreakdown,
      hasPracticeRepetitions,
      targetAccountingMatches,
      hitAccountingMatches,
      sectionAccountingMatches,
      repetitionAccountingMatches,
      hasCapture: Boolean(body.capture),
      hasDiagnostics: Boolean(body.diagnostics?.currentCapture) || Boolean(body.diagnostics?.notices?.length),
      hasArtifact: Boolean(body.artifact?.filePath)
    },
    issues
  };
}

function validateSessionSummaryBody(body) {
  const fields = ["totalScore", "accuracy", "notesDetected", "notesHit"];

  for (const field of fields) {
    if (body[field] === undefined) {
      return `Field ${field} is required.`;
    }

    if (Number.isNaN(normalizeNumber(body[field]))) {
      return `Field ${field} must be numeric.`;
    }
  }

  if (body.artifact !== undefined) {
    if (typeof body.artifact !== "object" || body.artifact === null) {
      return "Field artifact must be an object when provided.";
    }

    if (body.artifact.type !== "wav-file") {
      return "Field artifact.type must be wav-file when provided.";
    }

    if (!body.artifact.filePath || typeof body.artifact.filePath !== "string") {
      return "Field artifact.filePath must be a string when artifact is provided.";
    }
  }

  if (body.capture !== undefined) {
    const validationError = validateCaptureMetadata(body.capture, {
      fieldPrefix: "capture",
      requireSource: true
    });

    if (validationError) {
      return validationError;
    }
  }

  if (body.scoreBreakdown !== undefined) {
    if (typeof body.scoreBreakdown !== "object" || body.scoreBreakdown === null) {
      return "Field scoreBreakdown must be an object when provided.";
    }

    for (const numericField of [
      "tempoBpm",
      "targetCount",
      "matchedTargetCount",
      "unmatchedTargetCount",
      "noteHits",
      "stringHits",
      "timingHits",
      "fullHits",
      "sustainHits",
      "releaseHits",
      "fullComboHits",
      "earlyHitCount",
      "lateHitCount",
      "earlyReleaseCount",
      "overholdCount",
      "ghostNoteCount",
      "missedTargetCount",
      "maxCombo",
      "comboBreakCount",
      "multiplierPeak",
      "misses",
      "averageTimingOffsetMs",
      "maxTimingOffsetMs",
      "averageHoldCoverage",
      "averageReleaseOvershootMs",
      "maxReleaseOvershootMs"
    ]) {
      if (
        body.scoreBreakdown[numericField] !== undefined &&
        Number.isNaN(normalizeNumber(body.scoreBreakdown[numericField]))
      ) {
        return `Field scoreBreakdown.${numericField} must be numeric when provided.`;
      }
    }
  }

  if (body.sectionBreakdown !== undefined) {
    if (!Array.isArray(body.sectionBreakdown)) {
      return "Field sectionBreakdown must be an array when provided.";
    }

    for (let index = 0; index < body.sectionBreakdown.length; index += 1) {
      const section = body.sectionBreakdown[index];
      const fieldPrefix = `sectionBreakdown[${index}]`;

      if (typeof section !== "object" || section === null) {
        return `Field ${fieldPrefix} must be an object.`;
      }

      for (const stringField of ["sectionId", "sectionLabel"]) {
        if (typeof section[stringField] !== "string" || section[stringField].length === 0) {
          return `Field ${fieldPrefix}.${stringField} must be a non-empty string.`;
        }
      }

      for (const numericField of [
        "targetCount",
        "matchedTargetCount",
        "fullComboHits",
        "missedTargetCount",
        "ghostNoteCount",
        "earlyHitCount",
        "lateHitCount",
        "earlyReleaseCount",
        "overholdCount",
        "accuracy",
        "averageTimingOffsetMs",
        "averageHoldCoverage",
        "averageReleaseOvershootMs",
        "performanceScore"
      ]) {
        if (Number.isNaN(normalizeNumber(section[numericField]))) {
          return `Field ${fieldPrefix}.${numericField} must be numeric.`;
        }
      }
    }
  }

  if (body.practicePreset !== undefined) {
    if (typeof body.practicePreset !== "object" || body.practicePreset === null) {
      return "Field practicePreset must be an object when provided.";
    }

    if (
      body.practicePreset.scope !== "full-chart" &&
      body.practicePreset.scope !== "section-loop"
    ) {
      return "Field practicePreset.scope must be full-chart or section-loop when provided.";
    }

    if (Number.isNaN(normalizeNumber(body.practicePreset.tempoBpm))) {
      return "Field practicePreset.tempoBpm must be numeric when provided.";
    }

    if (
      body.practicePreset.loopSectionId !== undefined &&
      typeof body.practicePreset.loopSectionId !== "string"
    ) {
      return "Field practicePreset.loopSectionId must be a string when provided.";
    }

    if (
      body.practicePreset.loopSectionLabel !== undefined &&
      typeof body.practicePreset.loopSectionLabel !== "string"
    ) {
      return "Field practicePreset.loopSectionLabel must be a string when provided.";
    }

    if (
      body.practicePreset.loopRepetitionCount !== undefined &&
      Number.isNaN(normalizeNumber(body.practicePreset.loopRepetitionCount))
    ) {
      return "Field practicePreset.loopRepetitionCount must be numeric when provided.";
    }

    if (
      body.practicePreset.loopTempoStepBpm !== undefined &&
      Number.isNaN(normalizeNumber(body.practicePreset.loopTempoStepBpm))
    ) {
      return "Field practicePreset.loopTempoStepBpm must be numeric when provided.";
    }

    if (body.practicePreset.repetitions !== undefined) {
      if (!Array.isArray(body.practicePreset.repetitions)) {
        return "Field practicePreset.repetitions must be an array when provided.";
      }

      for (let index = 0; index < body.practicePreset.repetitions.length; index += 1) {
        const repetition = body.practicePreset.repetitions[index];
        const fieldPrefix = `practicePreset.repetitions[${index}]`;

        if (typeof repetition !== "object" || repetition === null) {
          return `Field ${fieldPrefix} must be an object.`;
        }

        for (const numericField of [
          "repetitionIndex",
          "tempoBpm",
          "startTimeMs",
          "durationMs",
          "targetCount",
          "fullComboHits",
          "missedTargetCount",
          "ghostNoteCount",
          "accuracy",
          "performanceScore"
        ]) {
          if (Number.isNaN(normalizeNumber(repetition[numericField]))) {
            return `Field ${fieldPrefix}.${numericField} must be numeric.`;
          }
        }

        if (
          repetition.passed !== undefined &&
          typeof repetition.passed !== "boolean"
        ) {
          return `Field ${fieldPrefix}.passed must be a boolean when provided.`;
        }

        if (
          repetition.skipped !== undefined &&
          typeof repetition.skipped !== "boolean"
        ) {
          return `Field ${fieldPrefix}.skipped must be a boolean when provided.`;
        }
      }
    }

    if (body.practicePreset.masteryGate !== undefined) {
      if (typeof body.practicePreset.masteryGate !== "object" || body.practicePreset.masteryGate === null) {
        return "Field practicePreset.masteryGate must be an object when provided.";
      }

      if (
        body.practicePreset.masteryGate.status !== "ready-to-advance" &&
        body.practicePreset.masteryGate.status !== "keep-building" &&
        body.practicePreset.masteryGate.status !== "stabilize-base-tempo"
      ) {
        return "Field practicePreset.masteryGate.status must be ready-to-advance, keep-building or stabilize-base-tempo when provided.";
      }

      for (const numericField of [
        "passedRepetitionCount",
        "totalRepetitionCount",
        "highestPassedTempoBpm",
        "recommendedNextTempoBpm"
      ]) {
        if (Number.isNaN(normalizeNumber(body.practicePreset.masteryGate[numericField]))) {
          return `Field practicePreset.masteryGate.${numericField} must be numeric.`;
        }
      }

      if (
        typeof body.practicePreset.masteryGate.message !== "string" ||
        body.practicePreset.masteryGate.message.length === 0
      ) {
        return "Field practicePreset.masteryGate.message must be a non-empty string when provided.";
      }
    }

    if (body.practicePreset.adaptiveExecution !== undefined) {
      if (
        typeof body.practicePreset.adaptiveExecution !== "object" ||
        body.practicePreset.adaptiveExecution === null
      ) {
        return "Field practicePreset.adaptiveExecution must be an object when provided.";
      }

      if (
        body.practicePreset.adaptiveExecution.mode !== "static" &&
        body.practicePreset.adaptiveExecution.mode !== "early-stop"
      ) {
        return "Field practicePreset.adaptiveExecution.mode must be static or early-stop when provided.";
      }

      if (typeof body.practicePreset.adaptiveExecution.triggered !== "boolean") {
        return "Field practicePreset.adaptiveExecution.triggered must be a boolean when provided.";
      }

      for (const numericField of ["completedRepetitionCount", "plannedRepetitionCount", "stoppedAfterRepetitionIndex"]) {
        if (
          body.practicePreset.adaptiveExecution[numericField] !== undefined &&
          Number.isNaN(normalizeNumber(body.practicePreset.adaptiveExecution[numericField]))
        ) {
          return `Field practicePreset.adaptiveExecution.${numericField} must be numeric when provided.`;
        }
      }

      if (
        body.practicePreset.adaptiveExecution.stopReason !== undefined &&
        typeof body.practicePreset.adaptiveExecution.stopReason !== "string"
      ) {
        return "Field practicePreset.adaptiveExecution.stopReason must be a string when provided.";
      }

      if (body.practicePreset.adaptiveExecution.retryPlan !== undefined) {
        if (
          typeof body.practicePreset.adaptiveExecution.retryPlan !== "object" ||
          body.practicePreset.adaptiveExecution.retryPlan === null
        ) {
          return "Field practicePreset.adaptiveExecution.retryPlan must be an object when provided.";
        }

        if (
          body.practicePreset.adaptiveExecution.retryPlan.strategy !== "repeat-current-tempo" &&
          body.practicePreset.adaptiveExecution.retryPlan.strategy !== "drop-tempo-step" &&
          body.practicePreset.adaptiveExecution.retryPlan.strategy !== "rebuild-base-tempo"
        ) {
          return "Field practicePreset.adaptiveExecution.retryPlan.strategy must be repeat-current-tempo, drop-tempo-step or rebuild-base-tempo when provided.";
        }

        for (const numericField of ["tempoBpm", "loopRepetitionCount", "loopTempoStepBpm"]) {
          if (Number.isNaN(normalizeNumber(body.practicePreset.adaptiveExecution.retryPlan[numericField]))) {
            return `Field practicePreset.adaptiveExecution.retryPlan.${numericField} must be numeric.`;
          }
        }

        if (
          typeof body.practicePreset.adaptiveExecution.retryPlan.reason !== "string" ||
          body.practicePreset.adaptiveExecution.retryPlan.reason.length === 0
        ) {
          return "Field practicePreset.adaptiveExecution.retryPlan.reason must be a non-empty string when provided.";
        }
      }
    }
  }

  if (body.rating !== undefined) {
    if (typeof body.rating !== "object" || body.rating === null) {
      return "Field rating must be an object when provided.";
    }

    if (!["S", "A", "B", "C", "D", "F"].includes(body.rating.grade)) {
      return "Field rating.grade must be one of S, A, B, C, D or F when provided.";
    }

    if (typeof body.rating.label !== "string" || body.rating.label.length === 0) {
      return "Field rating.label must be a non-empty string when provided.";
    }

    if (!["full-combo", "clean-clear", "clear", "practice"].includes(body.rating.clearType)) {
      return "Field rating.clearType must be full-combo, clean-clear, clear or practice when provided.";
    }

    if (Number.isNaN(normalizeNumber(body.rating.performanceScore))) {
      return "Field rating.performanceScore must be numeric when provided.";
    }
  }

  if (body.feedback !== undefined) {
    if (typeof body.feedback !== "object" || body.feedback === null) {
      return "Field feedback must be an object when provided.";
    }

    if (typeof body.feedback.summary !== "string" || body.feedback.summary.length === 0) {
      return "Field feedback.summary must be a non-empty string when provided.";
    }

    if (!Array.isArray(body.feedback.focusAreas)) {
      return "Field feedback.focusAreas must be an array when provided.";
    }

    if (!body.feedback.focusAreas.every((item) => typeof item === "string" && item.length > 0)) {
      return "Field feedback.focusAreas must contain only non-empty strings.";
    }

    if (!Array.isArray(body.feedback.coachHints)) {
      return "Field feedback.coachHints must be an array when provided.";
    }

    for (let index = 0; index < body.feedback.coachHints.length; index += 1) {
      const hint = body.feedback.coachHints[index];
      const fieldPrefix = `feedback.coachHints[${index}]`;

      if (typeof hint !== "object" || hint === null) {
        return `Field ${fieldPrefix} must be an object.`;
      }

      for (const stringField of ["id", "title", "detail"]) {
        if (typeof hint[stringField] !== "string" || hint[stringField].length === 0) {
          return `Field ${fieldPrefix}.${stringField} must be a non-empty string.`;
        }
      }

      if (!["high", "medium", "low"].includes(hint.severity)) {
        return `Field ${fieldPrefix}.severity must be high, medium or low.`;
      }
    }
  }

  if (body.verification !== undefined) {
    if (typeof body.verification !== "object" || body.verification === null) {
      return "Field verification must be an object when provided.";
    }

    if (body.verification.status !== "verified" && body.verification.status !== "warning") {
      return "Field verification.status must be verified or warning when provided.";
    }

    if (typeof body.verification.mechanicallyComplete !== "boolean") {
      return "Field verification.mechanicallyComplete must be a boolean when provided.";
    }

    if (Number.isNaN(normalizeNumber(body.verification.targetCoverage))) {
      return "Field verification.targetCoverage must be numeric when provided.";
    }

    if (typeof body.verification.checks !== "object" || body.verification.checks === null) {
      return "Field verification.checks must be an object when provided.";
    }

    for (const booleanField of [
      "hasScoreBreakdown",
      "hasSectionBreakdown",
      "hasPracticeRepetitions",
      "targetAccountingMatches",
      "hitAccountingMatches",
      "sectionAccountingMatches",
      "repetitionAccountingMatches",
      "hasCapture",
      "hasDiagnostics",
      "hasArtifact"
    ]) {
      if (typeof body.verification.checks[booleanField] !== "boolean") {
        return `Field verification.checks.${booleanField} must be a boolean when provided.`;
      }
    }

    if (!Array.isArray(body.verification.issues)) {
      return "Field verification.issues must be an array when provided.";
    }

    if (!body.verification.issues.every((issue) => typeof issue === "string" && issue.length > 0)) {
      return "Field verification.issues must contain only non-empty strings.";
    }

    const derivedVerification = deriveSessionVerification(body);
    const providedVerification = {
      status: body.verification.status,
      mechanicallyComplete: body.verification.mechanicallyComplete,
      targetCoverage: normalizeNumber(body.verification.targetCoverage),
      checks: {
        hasScoreBreakdown: body.verification.checks.hasScoreBreakdown,
        hasSectionBreakdown: body.verification.checks.hasSectionBreakdown,
        hasPracticeRepetitions: body.verification.checks.hasPracticeRepetitions,
        targetAccountingMatches: body.verification.checks.targetAccountingMatches,
        hitAccountingMatches: body.verification.checks.hitAccountingMatches,
        sectionAccountingMatches: body.verification.checks.sectionAccountingMatches,
        repetitionAccountingMatches: body.verification.checks.repetitionAccountingMatches,
        hasCapture: body.verification.checks.hasCapture,
        hasDiagnostics: body.verification.checks.hasDiagnostics,
        hasArtifact: body.verification.checks.hasArtifact
      },
      issues: body.verification.issues.map((issue) => issue)
    };

    if (JSON.stringify(providedVerification) !== JSON.stringify(derivedVerification)) {
      return "Field verification does not match the session summary accounting.";
    }
  }

  if (body.diagnostics !== undefined) {
    if (typeof body.diagnostics !== "object" || body.diagnostics === null) {
      return "Field diagnostics must be an object when provided.";
    }

    if (body.diagnostics.currentCapture !== undefined) {
      const validationError = validateCaptureMetadata(body.diagnostics.currentCapture, {
        fieldPrefix: "diagnostics.currentCapture",
        requireSource: false
      });

      if (validationError) {
        return validationError;
      }
    }

    if (body.diagnostics.notices !== undefined) {
      if (!Array.isArray(body.diagnostics.notices)) {
        return "Field diagnostics.notices must be an array when provided.";
      }

      for (let index = 0; index < body.diagnostics.notices.length; index += 1) {
        const notice = body.diagnostics.notices[index];
        const fieldPrefix = `diagnostics.notices[${index}]`;

        if (typeof notice !== "object" || notice === null) {
          return `Field ${fieldPrefix} must be an object.`;
        }

        if (typeof notice.code !== "string" || notice.code.length === 0) {
          return `Field ${fieldPrefix}.code must be a non-empty string.`;
        }

        if (notice.level !== "info" && notice.level !== "warning") {
          return `Field ${fieldPrefix}.level must be info or warning.`;
        }

        if (typeof notice.message !== "string" || notice.message.length === 0) {
          return `Field ${fieldPrefix}.message must be a non-empty string.`;
        }

        if (typeof notice.timestamp !== "string" || notice.timestamp.length === 0) {
          return `Field ${fieldPrefix}.timestamp must be a non-empty string.`;
        }

        if (notice.capture !== undefined) {
          const validationError = validateCaptureMetadata(notice.capture, {
            fieldPrefix: `${fieldPrefix}.capture`,
            requireSource: false
          });

          if (validationError) {
            return validationError;
          }
        }
      }
    }
  }

  return null;
}

function matchSummaryRoute(pathname) {
  const match = pathname.match(/^\/sessions\/([^/]+)\/summary$/);
  return match ? { sessionId: match[1] } : null;
}

function matchUserDashboardRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/dashboard$/);
  return match ? { userId: decodeURIComponent(match[1]) } : null;
}

function matchUserTrainingsRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/trainings$/);
  return match ? { userId: decodeURIComponent(match[1]) } : null;
}

function matchUserDiagnosticsRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/diagnostics$/);
  return match ? { userId: decodeURIComponent(match[1]) } : null;
}

function matchUserDeviceDiagnosticsRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/diagnostics\/devices\/([^/]+)$/);
  return match
    ? {
        userId: decodeURIComponent(match[1]),
        deviceName: decodeURIComponent(match[2])
      }
    : null;
}

function matchUserDiagnosticsExportRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/diagnostics\/export$/);
  return match ? { userId: decodeURIComponent(match[1]) } : null;
}

function matchUserCalibrationRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/calibration$/);
  return match ? { userId: decodeURIComponent(match[1]) } : null;
}

function matchUserCapturePreferencesRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/capture-preferences$/);
  return match ? { userId: decodeURIComponent(match[1]) } : null;
}

function matchUserCaptureOverridesRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/capture-overrides$/);
  return match ? { userId: decodeURIComponent(match[1]) } : null;
}

function matchUserSetupRecommendationsRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/setup-recommendations$/);
  return match ? { userId: decodeURIComponent(match[1]) } : null;
}

function matchUserSetupRecommendationEvaluationRoute(pathname) {
  const match = pathname.match(/^\/users\/([^/]+)\/setup-recommendations\/([^/]+)\/evaluation$/);
  return match
    ? {
        userId: decodeURIComponent(match[1]),
        recommendationId: decodeURIComponent(match[2])
      }
    : null;
}

function validateCalibrationBody(body) {
  const fields = ["offsetMs", "measuredLatencyMs", "noiseFloorDb"];

  for (const field of fields) {
    if (body[field] === undefined) {
      return `Field ${field} is required.`;
    }

    if (Number.isNaN(normalizeNumber(body[field]))) {
      return `Field ${field} must be numeric.`;
    }
  }

  return null;
}

function validateCapturePreferencesBody(body) {
  if (typeof body !== "object" || body === null) {
    return "Request body must be an object.";
  }

  if (typeof body.autoApplyRecommendation !== "boolean") {
    return "Field autoApplyRecommendation is required and must be a boolean.";
  }

  return null;
}

function validateCaptureOverrideBody(body) {
  if (typeof body !== "object" || body === null) {
    return "Request body must be an object.";
  }

  for (const field of ["deviceName", "recommendedBackend", "recommendedProfile", "selectedBackend", "selectedProfile"]) {
    if (typeof body[field] !== "string" || body[field].length === 0) {
      return `Field ${field} is required and must be a non-empty string.`;
    }
  }

  if (body.recommendedBackend !== "wavein" && body.recommendedBackend !== "wasapi") {
    return "Field recommendedBackend must be wavein or wasapi.";
  }

  if (body.selectedBackend !== "wavein" && body.selectedBackend !== "wasapi") {
    return "Field selectedBackend must be wavein or wasapi.";
  }

  if (
    body.recommendedProfile !== "safe" &&
    body.recommendedProfile !== "balanced" &&
    body.recommendedProfile !== "low-latency"
  ) {
    return "Field recommendedProfile must be safe, balanced or low-latency.";
  }

  if (
    body.selectedProfile !== "safe" &&
    body.selectedProfile !== "balanced" &&
    body.selectedProfile !== "low-latency"
  ) {
    return "Field selectedProfile must be safe, balanced or low-latency.";
  }

  if (
    body.source !== undefined &&
    (typeof body.source !== "string" || body.source.length === 0)
  ) {
    return "Field source must be a non-empty string when provided.";
  }

  return null;
}

function validateSetupRecommendationBody(body) {
  if (typeof body !== "object" || body === null) {
    return "Request body must be an object.";
  }

  for (const field of ["deviceName", "backend", "profile", "recommendationId", "recommendationTitle"]) {
    if (typeof body[field] !== "string" || body[field].trim().length === 0) {
      return `Field ${field} is required and must be a non-empty string.`;
    }
  }

  if (body.backend !== "wavein" && body.backend !== "wasapi") {
    return "Field backend must be wavein or wasapi.";
  }

  if (
    body.profile !== "safe" &&
    body.profile !== "balanced" &&
    body.profile !== "low-latency"
  ) {
    return "Field profile must be safe, balanced or low-latency.";
  }

  if (
    body.source !== undefined &&
    (typeof body.source !== "string" || body.source.trim().length === 0)
  ) {
    return "Field source must be a non-empty string when provided.";
  }

  for (const numericField of [
    "baselineStabilityScore",
    "baselineSignalQualityScore",
    "baselineRuntimeStabilityScore",
    "baselineLatencyFitnessScore"
  ]) {
    if (
      body[numericField] !== undefined &&
      Number.isNaN(normalizeNumber(body[numericField]))
    ) {
      return `Field ${numericField} must be numeric when provided.`;
    }
  }

  if (
    body.recommendationDetail !== undefined &&
    (typeof body.recommendationDetail !== "string" || body.recommendationDetail.trim().length === 0)
  ) {
    return "Field recommendationDetail must be a non-empty string when provided.";
  }

  if (
    body.plannedSessionId !== undefined &&
    (typeof body.plannedSessionId !== "string" || body.plannedSessionId.trim().length === 0)
  ) {
    return "Field plannedSessionId must be a non-empty string when provided.";
  }

  return null;
}

function validateSetupRecommendationEvaluationBody(body) {
  if (typeof body !== "object" || body === null) {
    return "Request body must be an object.";
  }

  if (
    body.outcome !== "improved" &&
    body.outcome !== "no-improvement"
  ) {
    return "Field outcome must be improved or no-improvement.";
  }

  if (
    body.notes !== undefined &&
    (typeof body.notes !== "string" || body.notes.trim().length === 0)
  ) {
    return "Field notes must be a non-empty string when provided.";
  }

  if (
    body.observedSessionId !== undefined &&
    (typeof body.observedSessionId !== "string" || body.observedSessionId.trim().length === 0)
  ) {
    return "Field observedSessionId must be a non-empty string when provided.";
  }

  return null;
}

function readDiagnosticsFilters(url) {
  const deviceName = url.searchParams.get("deviceName");
  const backend = url.searchParams.get("backend");
  const profile = url.searchParams.get("profile");
  const sortBy = url.searchParams.get("sortBy");
  const sortDirection = url.searchParams.get("sortDirection");

  return {
    ...(deviceName ? { deviceName } : {}),
    ...(backend ? { backend } : {}),
    ...(profile ? { profile } : {}),
    ...(sortBy ? { sortBy } : {}),
    ...(sortDirection ? { sortDirection } : {})
  };
}

function readBearerToken(request) {
  const header = request.headers["authorization"] ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function createApp(dependencies = {}) {
  const trainingRepository = dependencies.trainingRepository ?? new TrainingRepository();
  const sessionRepository = dependencies.sessionRepository ?? new SessionRepository();
  const userRepository = dependencies.userRepository ?? new UserRepository();
  const authService = dependencies.authService ?? null;
  const telemetryRepository = dependencies.telemetryRepository ?? null;
  const userService =
    dependencies.userService ??
    new UserService({
      userRepository,
      sessionRepository,
      trainingRepository
    });
  const sessionService =
    dependencies.sessionService ??
    new SessionService({
      sessionRepository,
      trainingRepository,
      userRepository
    });

  return createServer(async (request, response) => {
    if (isOptionsRequest(request)) {
      sendJson(response, 204, {});
      return;
    }

    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        data: {
          status: "ok",
          service: "riffrush-backend",
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/trainings") {
      sendJson(response, 200, {
        data: trainingRepository.list()
      });
      return;
    }

    // ------------------------------------------------------------------
    // Auth routes
    // ------------------------------------------------------------------

    if (request.method === "POST" && url.pathname === "/auth/register") {
      if (!authService) {
        sendError(response, 501, "AUTH_NOT_CONFIGURED", "Auth service is not configured.");
        return;
      }

      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
        return;
      }

      try {
        const result = await authService.register(body.email, body.password);
        sendJson(response, 201, { data: { token: result.token, userId: result.userId } });
      } catch (error) {
        if (error.code === "VALIDATION_ERROR") {
          sendError(response, 400, "VALIDATION_ERROR", error.message);
        } else if (error.code === "EMAIL_ALREADY_EXISTS") {
          sendError(response, 409, "EMAIL_ALREADY_EXISTS", error.message);
        } else {
          sendError(response, 500, "INTERNAL_ERROR", "Registration failed.");
        }
      }

      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/login") {
      if (!authService) {
        sendError(response, 501, "AUTH_NOT_CONFIGURED", "Auth service is not configured.");
        return;
      }

      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
        return;
      }

      try {
        const result = await authService.login(body.email, body.password);
        sendJson(response, 200, { data: { token: result.token, userId: result.userId } });
      } catch (error) {
        if (error.code === "VALIDATION_ERROR") {
          sendError(response, 400, "VALIDATION_ERROR", error.message);
        } else if (error.code === "INVALID_CREDENTIALS") {
          sendError(response, 401, "INVALID_CREDENTIALS", error.message);
        } else {
          sendError(response, 500, "INTERNAL_ERROR", "Login failed.");
        }
      }

      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/me") {
      if (!authService) {
        sendError(response, 501, "AUTH_NOT_CONFIGURED", "Auth service is not configured.");
        return;
      }

      const token = readBearerToken(request);

      if (!token) {
        sendError(response, 401, "MISSING_TOKEN", "Authorization header with Bearer token is required.");
        return;
      }

      try {
        const { userId, email } = authService.verifyToken(token);
        sendJson(response, 200, { data: { userId, email } });
      } catch (error) {
        if (error.code === "TOKEN_EXPIRED") {
          sendError(response, 401, "TOKEN_EXPIRED", "Token has expired.");
        } else {
          sendError(response, 401, "INVALID_TOKEN", "Token is invalid.");
        }
      }

      return;
    }

    const userTrainingsRoute = matchUserTrainingsRoute(url.pathname);

    if (request.method === "GET" && userTrainingsRoute) {
      const result = userService.getTrainingCatalog(userTrainingsRoute.userId);
      sendJson(response, 200, {
        data: result.catalog
      });
      return;
    }

    const dashboardRoute = matchUserDashboardRoute(url.pathname);

    if (request.method === "GET" && dashboardRoute) {
      const result = userService.getDashboard(dashboardRoute.userId);
      sendJson(response, 200, {
        data: result.dashboard
      });
      return;
    }

    const diagnosticsRoute = matchUserDiagnosticsRoute(url.pathname);

    if (request.method === "GET" && diagnosticsRoute) {
      const result = userService.getDiagnosticsReport(
        diagnosticsRoute.userId,
        readDiagnosticsFilters(url)
      );
      sendJson(response, 200, {
        data: result.report
      });
      return;
    }

    const deviceDiagnosticsRoute = matchUserDeviceDiagnosticsRoute(url.pathname);

    if (request.method === "GET" && deviceDiagnosticsRoute) {
      const result = userService.getDeviceDiagnostics(
        deviceDiagnosticsRoute.userId,
        deviceDiagnosticsRoute.deviceName
      );
      sendJson(response, 200, {
        data: result.report
      });
      return;
    }

    const diagnosticsExportRoute = matchUserDiagnosticsExportRoute(url.pathname);

    if (request.method === "GET" && diagnosticsExportRoute) {
      const format = url.searchParams.get("format") ?? "json";

      if (format !== "json" && format !== "csv") {
        sendError(response, 400, "INVALID_EXPORT_FORMAT", "Field format must be json or csv.");
        return;
      }

      const result = userService.exportDiagnosticsReport(
        diagnosticsExportRoute.userId,
        format,
        readDiagnosticsFilters(url)
      );
      sendText(response, 200, result.body, {
        contentType: result.contentType,
        headers: {
          "Content-Disposition": `attachment; filename="${result.filename}"`
        }
      });
      return;
    }

    const calibrationRoute = matchUserCalibrationRoute(url.pathname);

    if (request.method === "PUT" && calibrationRoute) {
      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must contain valid JSON.");
        return;
      }

      const validationError = validateCalibrationBody(body);

      if (validationError) {
        sendError(response, 400, "INVALID_CALIBRATION_INPUT", validationError);
        return;
      }

      const result = userService.saveCalibration(calibrationRoute.userId, {
        offsetMs: normalizeNumber(body.offsetMs),
        measuredLatencyMs: normalizeNumber(body.measuredLatencyMs),
        noiseFloorDb: normalizeNumber(body.noiseFloorDb)
      });

      sendJson(response, 200, {
        data: {
          user: result.user
        }
      });
      return;
    }

    const capturePreferencesRoute = matchUserCapturePreferencesRoute(url.pathname);

    if (request.method === "PUT" && capturePreferencesRoute) {
      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must contain valid JSON.");
        return;
      }

      const validationError = validateCapturePreferencesBody(body);

      if (validationError) {
        sendError(response, 400, "INVALID_CAPTURE_PREFERENCES", validationError);
        return;
      }

      const result = userService.saveCapturePreferences(capturePreferencesRoute.userId, {
        autoApplyRecommendation: body.autoApplyRecommendation
      });

      sendJson(response, 200, {
        data: {
          user: result.user
        }
      });
      return;
    }

    const captureOverridesRoute = matchUserCaptureOverridesRoute(url.pathname);

    if (request.method === "POST" && captureOverridesRoute) {
      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must contain valid JSON.");
        return;
      }

      const validationError = validateCaptureOverrideBody(body);

      if (validationError) {
        sendError(response, 400, "INVALID_CAPTURE_OVERRIDE", validationError);
        return;
      }

      const result = userService.recordCaptureOverride(captureOverridesRoute.userId, {
        deviceName: body.deviceName,
        recommendedBackend: body.recommendedBackend,
        recommendedProfile: body.recommendedProfile,
        selectedBackend: body.selectedBackend,
        selectedProfile: body.selectedProfile,
        source: body.source
      });

      sendJson(response, 201, {
        data: {
          user: result.user
        }
      });
      return;
    }

    const setupRecommendationsRoute = matchUserSetupRecommendationsRoute(url.pathname);

    if (request.method === "POST" && setupRecommendationsRoute) {
      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must contain valid JSON.");
        return;
      }

      const validationError = validateSetupRecommendationBody(body);

      if (validationError) {
        sendError(response, 400, "INVALID_SETUP_RECOMMENDATION", validationError);
        return;
      }

      const result = userService.recordSetupRecommendation(setupRecommendationsRoute.userId, {
        deviceName: body.deviceName.trim(),
        backend: body.backend,
        profile: body.profile,
        recommendationId: body.recommendationId.trim(),
        recommendationTitle: body.recommendationTitle.trim(),
        recommendationDetail: typeof body.recommendationDetail === "string"
          ? body.recommendationDetail.trim()
          : undefined,
        source: typeof body.source === "string" ? body.source.trim() : undefined,
        baselineStabilityScore:
          body.baselineStabilityScore === undefined ? undefined : normalizeNumber(body.baselineStabilityScore),
        baselineSignalQualityScore:
          body.baselineSignalQualityScore === undefined ? undefined : normalizeNumber(body.baselineSignalQualityScore),
        baselineRuntimeStabilityScore:
          body.baselineRuntimeStabilityScore === undefined
            ? undefined
            : normalizeNumber(body.baselineRuntimeStabilityScore),
        baselineLatencyFitnessScore:
          body.baselineLatencyFitnessScore === undefined
            ? undefined
            : normalizeNumber(body.baselineLatencyFitnessScore),
        plannedSessionId:
          typeof body.plannedSessionId === "string" ? body.plannedSessionId.trim() : undefined
      });

      sendJson(response, 201, {
        data: {
          user: result.user,
          setupRecommendation: result.setupRecommendation
        }
      });
      return;
    }

    const setupRecommendationEvaluationRoute = matchUserSetupRecommendationEvaluationRoute(url.pathname);

    if (request.method === "POST" && setupRecommendationEvaluationRoute) {
      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must contain valid JSON.");
        return;
      }

      const validationError = validateSetupRecommendationEvaluationBody(body);

      if (validationError) {
        sendError(response, 400, "INVALID_SETUP_RECOMMENDATION_EVALUATION", validationError);
        return;
      }

      const result = userService.evaluateSetupRecommendation(
        setupRecommendationEvaluationRoute.userId,
        setupRecommendationEvaluationRoute.recommendationId,
        {
          outcome: body.outcome,
          notes: typeof body.notes === "string" ? body.notes.trim() : undefined,
          observedSessionId:
            typeof body.observedSessionId === "string" ? body.observedSessionId.trim() : undefined
        }
      );

        if (!result.ok) {
          sendError(response, result.statusCode, result.code, result.message, result.details);
          return;
        }

      sendJson(response, 200, {
        data: {
          user: result.user,
          setupRecommendation: result.setupRecommendation
        }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/sessions") {
      let body;

      try {
        body = await readJsonBody(request);
      } catch (error) {
        sendError(response, 400, "INVALID_JSON", "Request body must contain valid JSON.");
        return;
      }

      const validationError = validateSessionCreateBody(body);

      if (validationError) {
        sendError(response, 400, "INVALID_SESSION_INPUT", validationError);
        return;
      }

      const result = sessionService.createSession({
        userId: typeof body.userId === "string" ? body.userId : undefined,
        trainingId: body.trainingId,
        exerciseId: typeof body.exerciseId === "string" ? body.exerciseId : undefined,
        calibrationOffsetMs: normalizeNumber(body.calibrationOffsetMs, 0),
        tempoBpm:
          body.tempoBpm === undefined
            ? undefined
            : normalizeNumber(body.tempoBpm),
        practiceScope:
          typeof body.practiceScope === "string" ? body.practiceScope : undefined,
        loopSectionId:
          typeof body.loopSectionId === "string" ? body.loopSectionId.trim() : undefined,
        loopRepetitionCount:
          body.loopRepetitionCount === undefined
            ? undefined
            : normalizeNumber(body.loopRepetitionCount),
        loopTempoStepBpm:
          body.loopTempoStepBpm === undefined
            ? undefined
            : normalizeNumber(body.loopTempoStepBpm),
        inputMode: typeof body.inputMode === "string" ? body.inputMode : undefined,
        inputFilePath: typeof body.inputFilePath === "string" ? body.inputFilePath : undefined,
        captureDurationMs:
          body.captureDurationMs === undefined
            ? undefined
            : normalizeNumber(body.captureDurationMs),
        captureProfile:
          typeof body.captureProfile === "string" ? body.captureProfile : undefined,
        inputDeviceBackend:
          typeof body.inputDeviceBackend === "string" ? body.inputDeviceBackend : undefined,
        inputDeviceId: typeof body.inputDeviceId === "string" ? body.inputDeviceId : undefined,
        inputDeviceNumber:
          body.inputDeviceNumber === undefined
            ? undefined
            : normalizeNumber(body.inputDeviceNumber),
        recoveryGoalTrainingId:
          typeof body.recoveryGoalTrainingId === "string"
            ? body.recoveryGoalTrainingId.trim()
            : undefined,
        recoveryGoalSectionId:
          typeof body.recoveryGoalSectionId === "string"
            ? body.recoveryGoalSectionId.trim()
            : undefined,
        returnRecoveryTrainingId:
          typeof body.returnRecoveryTrainingId === "string"
            ? body.returnRecoveryTrainingId.trim()
            : undefined,
        returnGoalSectionId:
          typeof body.returnGoalSectionId === "string"
            ? body.returnGoalSectionId.trim()
            : undefined,
        promotionSourceTrainingId:
          typeof body.promotionSourceTrainingId === "string"
            ? body.promotionSourceTrainingId.trim()
            : undefined,
        promotionPhase:
          typeof body.promotionPhase === "string" ? body.promotionPhase.trim() : undefined,
        recoveryReturnTempoBpm:
          body.recoveryReturnTempoBpm === undefined
            ? undefined
            : normalizeNumber(body.recoveryReturnTempoBpm),
        recoveryReturnLoopRepetitionCount:
          body.recoveryReturnLoopRepetitionCount === undefined
            ? undefined
            : normalizeNumber(body.recoveryReturnLoopRepetitionCount),
        recoveryReturnLoopTempoStepBpm:
          body.recoveryReturnLoopTempoStepBpm === undefined
            ? undefined
            : normalizeNumber(body.recoveryReturnLoopTempoStepBpm),
        promotionSourceTempoBpm:
          body.promotionSourceTempoBpm === undefined
            ? undefined
            : normalizeNumber(body.promotionSourceTempoBpm),
        promotionRampBaseTempoBpm:
          body.promotionRampBaseTempoBpm === undefined
            ? undefined
            : normalizeNumber(body.promotionRampBaseTempoBpm),
        promotionRampTargetTempoBpm:
          body.promotionRampTargetTempoBpm === undefined
            ? undefined
            : normalizeNumber(body.promotionRampTargetTempoBpm),
        promotionChainBaseTempoBpm:
          body.promotionChainBaseTempoBpm === undefined
            ? undefined
            : normalizeNumber(body.promotionChainBaseTempoBpm),
        promotionChainTargetTempoBpm:
          body.promotionChainTargetTempoBpm === undefined
            ? undefined
            : normalizeNumber(body.promotionChainTargetTempoBpm),
        recoveryReason:
          typeof body.recoveryReason === "string" ? body.recoveryReason.trim() : undefined,
        returnReason:
          typeof body.returnReason === "string" ? body.returnReason.trim() : undefined,
        promotionReason:
          typeof body.promotionReason === "string" ? body.promotionReason.trim() : undefined,
        recoveryStrategy:
          typeof body.recoveryStrategy === "string" ? body.recoveryStrategy.trim() : undefined
      });

        if (!result.ok) {
          sendError(response, result.statusCode, result.code, result.message, result.details);
          return;
        }

      sendJson(response, 201, {
        data: {
          session: result.session,
          training: result.training
        }
      });
      return;
    }

    const summaryRoute = matchSummaryRoute(url.pathname);

    if (request.method === "POST" && summaryRoute) {
      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must contain valid JSON.");
        return;
      }

      const validationError = validateSessionSummaryBody(body);

      if (validationError) {
        sendError(response, 400, "INVALID_SUMMARY_INPUT", validationError);
        return;
      }

      const result = sessionService.completeSession(summaryRoute.sessionId, {
        totalScore: normalizeNumber(body.totalScore),
        accuracy: normalizeNumber(body.accuracy),
        notesDetected: normalizeNumber(body.notesDetected),
        notesHit: normalizeNumber(body.notesHit),
        ...(body.scoreBreakdown
          ? {
              scoreBreakdown: {
                ...(body.scoreBreakdown.targetCount !== undefined
                  ? { targetCount: normalizeNumber(body.scoreBreakdown.targetCount) }
                  : {}),
                ...(body.scoreBreakdown.tempoBpm !== undefined
                  ? { tempoBpm: normalizeNumber(body.scoreBreakdown.tempoBpm) }
                  : {}),
                ...(body.scoreBreakdown.matchedTargetCount !== undefined
                  ? { matchedTargetCount: normalizeNumber(body.scoreBreakdown.matchedTargetCount) }
                  : {}),
                ...(body.scoreBreakdown.unmatchedTargetCount !== undefined
                  ? { unmatchedTargetCount: normalizeNumber(body.scoreBreakdown.unmatchedTargetCount) }
                  : {}),
                ...(body.scoreBreakdown.noteHits !== undefined
                  ? { noteHits: normalizeNumber(body.scoreBreakdown.noteHits) }
                  : {}),
                ...(body.scoreBreakdown.stringHits !== undefined
                  ? { stringHits: normalizeNumber(body.scoreBreakdown.stringHits) }
                  : {}),
                ...(body.scoreBreakdown.timingHits !== undefined
                  ? { timingHits: normalizeNumber(body.scoreBreakdown.timingHits) }
                  : {}),
                ...(body.scoreBreakdown.fullHits !== undefined
                  ? { fullHits: normalizeNumber(body.scoreBreakdown.fullHits) }
                  : {}),
                ...(body.scoreBreakdown.sustainHits !== undefined
                  ? { sustainHits: normalizeNumber(body.scoreBreakdown.sustainHits) }
                  : {}),
                ...(body.scoreBreakdown.releaseHits !== undefined
                  ? { releaseHits: normalizeNumber(body.scoreBreakdown.releaseHits) }
                  : {}),
                ...(body.scoreBreakdown.fullComboHits !== undefined
                  ? { fullComboHits: normalizeNumber(body.scoreBreakdown.fullComboHits) }
                  : {}),
                ...(body.scoreBreakdown.earlyHitCount !== undefined
                  ? { earlyHitCount: normalizeNumber(body.scoreBreakdown.earlyHitCount) }
                  : {}),
                ...(body.scoreBreakdown.lateHitCount !== undefined
                  ? { lateHitCount: normalizeNumber(body.scoreBreakdown.lateHitCount) }
                  : {}),
                ...(body.scoreBreakdown.earlyReleaseCount !== undefined
                  ? { earlyReleaseCount: normalizeNumber(body.scoreBreakdown.earlyReleaseCount) }
                  : {}),
                ...(body.scoreBreakdown.overholdCount !== undefined
                  ? { overholdCount: normalizeNumber(body.scoreBreakdown.overholdCount) }
                  : {}),
                ...(body.scoreBreakdown.ghostNoteCount !== undefined
                  ? { ghostNoteCount: normalizeNumber(body.scoreBreakdown.ghostNoteCount) }
                  : {}),
                ...(body.scoreBreakdown.missedTargetCount !== undefined
                  ? { missedTargetCount: normalizeNumber(body.scoreBreakdown.missedTargetCount) }
                  : {}),
                ...(body.scoreBreakdown.maxCombo !== undefined
                  ? { maxCombo: normalizeNumber(body.scoreBreakdown.maxCombo) }
                  : {}),
                ...(body.scoreBreakdown.comboBreakCount !== undefined
                  ? { comboBreakCount: normalizeNumber(body.scoreBreakdown.comboBreakCount) }
                  : {}),
                ...(body.scoreBreakdown.multiplierPeak !== undefined
                  ? { multiplierPeak: normalizeNumber(body.scoreBreakdown.multiplierPeak) }
                  : {}),
                ...(body.scoreBreakdown.misses !== undefined
                  ? { misses: normalizeNumber(body.scoreBreakdown.misses) }
                  : {}),
                ...(body.scoreBreakdown.averageTimingOffsetMs !== undefined
                  ? { averageTimingOffsetMs: normalizeNumber(body.scoreBreakdown.averageTimingOffsetMs) }
                  : {}),
                ...(body.scoreBreakdown.maxTimingOffsetMs !== undefined
                  ? { maxTimingOffsetMs: normalizeNumber(body.scoreBreakdown.maxTimingOffsetMs) }
                  : {}),
                ...(body.scoreBreakdown.averageHoldCoverage !== undefined
                  ? { averageHoldCoverage: normalizeNumber(body.scoreBreakdown.averageHoldCoverage) }
                  : {}),
                ...(body.scoreBreakdown.averageReleaseOvershootMs !== undefined
                  ? { averageReleaseOvershootMs: normalizeNumber(body.scoreBreakdown.averageReleaseOvershootMs) }
                  : {}),
                ...(body.scoreBreakdown.maxReleaseOvershootMs !== undefined
                  ? { maxReleaseOvershootMs: normalizeNumber(body.scoreBreakdown.maxReleaseOvershootMs) }
                  : {})
              }
            }
          : {}),
        ...(body.sectionBreakdown
          ? {
              sectionBreakdown: body.sectionBreakdown.map((section) => ({
                sectionId: section.sectionId,
                sectionLabel: section.sectionLabel,
                targetCount: normalizeNumber(section.targetCount),
                matchedTargetCount: normalizeNumber(section.matchedTargetCount),
                fullComboHits: normalizeNumber(section.fullComboHits),
                missedTargetCount: normalizeNumber(section.missedTargetCount),
                ghostNoteCount: normalizeNumber(section.ghostNoteCount),
                earlyHitCount: normalizeNumber(section.earlyHitCount),
                lateHitCount: normalizeNumber(section.lateHitCount),
                earlyReleaseCount: normalizeNumber(section.earlyReleaseCount),
                overholdCount: normalizeNumber(section.overholdCount),
                accuracy: normalizeNumber(section.accuracy),
                averageTimingOffsetMs: normalizeNumber(section.averageTimingOffsetMs),
                averageHoldCoverage: normalizeNumber(section.averageHoldCoverage),
                averageReleaseOvershootMs: normalizeNumber(section.averageReleaseOvershootMs),
                performanceScore: normalizeNumber(section.performanceScore)
              }))
            }
          : {}),
        ...(body.practicePreset
          ? {
              practicePreset: {
                scope: body.practicePreset.scope,
                tempoBpm: normalizeNumber(body.practicePreset.tempoBpm),
                ...(body.practicePreset.loopSectionId
                  ? { loopSectionId: body.practicePreset.loopSectionId }
                  : {}),
                ...(body.practicePreset.loopSectionLabel
                  ? { loopSectionLabel: body.practicePreset.loopSectionLabel }
                  : {})
                ,
                ...(body.practicePreset.loopRepetitionCount !== undefined
                  ? { loopRepetitionCount: normalizeNumber(body.practicePreset.loopRepetitionCount) }
                  : {}),
                ...(body.practicePreset.loopTempoStepBpm !== undefined
                  ? { loopTempoStepBpm: normalizeNumber(body.practicePreset.loopTempoStepBpm) }
                  : {}),
                ...(body.practicePreset.repetitions
                  ? {
                      repetitions: body.practicePreset.repetitions.map((repetition) => ({
                        repetitionIndex: normalizeNumber(repetition.repetitionIndex),
                        tempoBpm: normalizeNumber(repetition.tempoBpm),
                        startTimeMs: normalizeNumber(repetition.startTimeMs),
                        durationMs: normalizeNumber(repetition.durationMs),
                        ...(repetition.targetCount !== undefined
                          ? { targetCount: normalizeNumber(repetition.targetCount) }
                          : {}),
                        ...(repetition.fullComboHits !== undefined
                          ? { fullComboHits: normalizeNumber(repetition.fullComboHits) }
                          : {}),
                        ...(repetition.missedTargetCount !== undefined
                          ? { missedTargetCount: normalizeNumber(repetition.missedTargetCount) }
                          : {}),
                        ...(repetition.ghostNoteCount !== undefined
                          ? { ghostNoteCount: normalizeNumber(repetition.ghostNoteCount) }
                          : {}),
                        ...(repetition.accuracy !== undefined
                          ? { accuracy: normalizeNumber(repetition.accuracy) }
                          : {}),
                        ...(repetition.performanceScore !== undefined
                          ? { performanceScore: normalizeNumber(repetition.performanceScore) }
                          : {}),
                        ...(repetition.passed !== undefined
                          ? { passed: repetition.passed }
                          : {}),
                        ...(repetition.skipped !== undefined
                          ? { skipped: repetition.skipped }
                          : {})
                      }))
                    }
                  : {}),
                ...(body.practicePreset.masteryGate
                  ? {
                      masteryGate: {
                        status: body.practicePreset.masteryGate.status,
                        passedRepetitionCount: normalizeNumber(body.practicePreset.masteryGate.passedRepetitionCount),
                        totalRepetitionCount: normalizeNumber(body.practicePreset.masteryGate.totalRepetitionCount),
                        highestPassedTempoBpm: normalizeNumber(body.practicePreset.masteryGate.highestPassedTempoBpm),
                        recommendedNextTempoBpm: normalizeNumber(body.practicePreset.masteryGate.recommendedNextTempoBpm),
                        message: body.practicePreset.masteryGate.message
                      }
                    }
                  : {}),
                ...(body.practicePreset.adaptiveExecution
                  ? {
                      adaptiveExecution: {
                        mode: body.practicePreset.adaptiveExecution.mode,
                        triggered: body.practicePreset.adaptiveExecution.triggered,
                        completedRepetitionCount: normalizeNumber(body.practicePreset.adaptiveExecution.completedRepetitionCount),
                        plannedRepetitionCount: normalizeNumber(body.practicePreset.adaptiveExecution.plannedRepetitionCount),
                        ...(body.practicePreset.adaptiveExecution.stoppedAfterRepetitionIndex !== undefined
                          ? {
                              stoppedAfterRepetitionIndex: normalizeNumber(
                                body.practicePreset.adaptiveExecution.stoppedAfterRepetitionIndex
                              )
                            }
                          : {}),
                        ...(body.practicePreset.adaptiveExecution.stopReason
                          ? { stopReason: body.practicePreset.adaptiveExecution.stopReason }
                          : {}),
                        ...(body.practicePreset.adaptiveExecution.retryPlan
                          ? {
                              retryPlan: {
                                strategy: body.practicePreset.adaptiveExecution.retryPlan.strategy,
                                tempoBpm: normalizeNumber(body.practicePreset.adaptiveExecution.retryPlan.tempoBpm),
                                loopRepetitionCount: normalizeNumber(body.practicePreset.adaptiveExecution.retryPlan.loopRepetitionCount),
                                loopTempoStepBpm: normalizeNumber(body.practicePreset.adaptiveExecution.retryPlan.loopTempoStepBpm),
                                reason: body.practicePreset.adaptiveExecution.retryPlan.reason
                              }
                            }
                          : {})
                      }
                    }
                  : {})
              }
            }
          : {}),
        ...(body.capture
          ? {
              capture: normalizeCaptureMetadata(body.capture, {
                includeSource: true
              })
            }
          : {}),
        ...(body.rating
          ? {
              rating: {
                grade: body.rating.grade,
                label: body.rating.label,
                clearType: body.rating.clearType,
                performanceScore: normalizeNumber(body.rating.performanceScore)
              }
            }
          : {}),
        ...(body.feedback
          ? {
              feedback: {
                summary: body.feedback.summary,
                focusAreas: body.feedback.focusAreas.map((item) => item),
                coachHints: body.feedback.coachHints.map((hint) => ({
                  id: hint.id,
                  title: hint.title,
                  detail: hint.detail,
                  severity: hint.severity
                }))
              }
            }
          : {}),
        ...(body.verification
          ? {
              verification: {
                status: body.verification.status,
                mechanicallyComplete: body.verification.mechanicallyComplete,
                targetCoverage: normalizeNumber(body.verification.targetCoverage),
                checks: {
                  hasScoreBreakdown: body.verification.checks.hasScoreBreakdown,
                  hasSectionBreakdown: body.verification.checks.hasSectionBreakdown,
                  hasPracticeRepetitions: body.verification.checks.hasPracticeRepetitions,
                  targetAccountingMatches: body.verification.checks.targetAccountingMatches,
                  hitAccountingMatches: body.verification.checks.hitAccountingMatches,
                  sectionAccountingMatches: body.verification.checks.sectionAccountingMatches,
                  repetitionAccountingMatches: body.verification.checks.repetitionAccountingMatches,
                  hasCapture: body.verification.checks.hasCapture,
                  hasDiagnostics: body.verification.checks.hasDiagnostics,
                  hasArtifact: body.verification.checks.hasArtifact
                },
                issues: body.verification.issues.map((issue) => issue)
              }
            }
          : {}),
        ...(body.diagnostics
          ? {
              diagnostics: {
                ...(body.diagnostics.currentCapture
                  ? {
                      currentCapture: normalizeCaptureMetadata(body.diagnostics.currentCapture, {
                        includeSource: false
                      })
                    }
                  : {}),
                ...(body.diagnostics.notices
                  ? {
                      notices: body.diagnostics.notices.map((notice) => ({
                        code: notice.code,
                        level: notice.level,
                        message: notice.message,
                        timestamp: notice.timestamp,
                        ...(notice.capture
                          ? {
                              capture: normalizeCaptureMetadata(notice.capture, {
                                includeSource: false
                              })
                            }
                          : {})
                      }))
                    }
                  : {})
              }
            }
          : {}),
        ...(body.artifact
          ? {
              artifact: {
                type: body.artifact.type,
                filePath: body.artifact.filePath
              }
            }
          : {})
      });

        if (!result.ok) {
          sendError(response, result.statusCode, result.code, result.message, result.details);
          return;
        }

      sendJson(response, 200, {
        data: {
          session: result.session,
          unlockTransition: result.unlockTransition,
          ...(result.user
            ? {
                user: result.user
              }
            : {}),
          ...(result.setupRecommendationFollowup
            ? {
                setupRecommendationFollowup: result.setupRecommendationFollowup
              }
            : {})
        }
      });
      return;
    }

    // ------------------------------------------------------------------
    // Telemetry routes
    // ------------------------------------------------------------------

    if (request.method === "POST" && url.pathname === "/telemetry/events") {
      if (!telemetryRepository) {
        sendError(response, 501, "TELEMETRY_NOT_CONFIGURED", "Telemetry storage is not configured.");
        return;
      }

      let body;

      try {
        body = await readJsonBody(request);
      } catch {
        sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
        return;
      }

      if (typeof body !== "object" || body === null) {
        sendError(response, 400, "INVALID_TELEMETRY_EVENT", "Request body must be an object.");
        return;
      }

      if (!body.eventType || typeof body.eventType !== "string") {
        sendError(response, 400, "INVALID_TELEMETRY_EVENT", "Field eventType is required and must be a string.");
        return;
      }

      if (!TELEMETRY_EVENT_TYPES.includes(body.eventType)) {
        sendError(
          response,
          400,
          "INVALID_TELEMETRY_EVENT",
          `Field eventType must be one of: ${TELEMETRY_EVENT_TYPES.join(", ")}.`
        );
        return;
      }

      if (!body.message || typeof body.message !== "string") {
        sendError(response, 400, "INVALID_TELEMETRY_EVENT", "Field message is required and must be a non-empty string.");
        return;
      }

      if (body.userId !== undefined && typeof body.userId !== "string") {
        sendError(response, 400, "INVALID_TELEMETRY_EVENT", "Field userId must be a string when provided.");
        return;
      }

      if (body.stack !== undefined && typeof body.stack !== "string") {
        sendError(response, 400, "INVALID_TELEMETRY_EVENT", "Field stack must be a string when provided.");
        return;
      }

      if (body.url !== undefined && typeof body.url !== "string") {
        sendError(response, 400, "INVALID_TELEMETRY_EVENT", "Field url must be a string when provided.");
        return;
      }

      const event = telemetryRepository.insert({
        eventType: body.eventType,
        userId: typeof body.userId === "string" ? body.userId : undefined,
        message: body.message.slice(0, 2000),
        stack: typeof body.stack === "string" ? body.stack.slice(0, 8000) : undefined,
        url: typeof body.url === "string" ? body.url.slice(0, 2000) : undefined,
        userAgent: request.headers["user-agent"] ?? undefined,
        appContext: typeof body.appContext === "object" && body.appContext !== null ? body.appContext : undefined
      });

      sendJson(response, 201, { data: { event } });
      return;
    }

    if (request.method === "GET" && url.pathname === "/telemetry/events") {
      if (!telemetryRepository) {
        sendError(response, 501, "TELEMETRY_NOT_CONFIGURED", "Telemetry storage is not configured.");
        return;
      }

      const limit = Math.min(normalizeNumber(url.searchParams.get("limit") ?? 50, 50), 200);
      const offset = normalizeNumber(url.searchParams.get("offset") ?? 0, 0);

      const events = telemetryRepository.list({ limit, offset });
      const total = telemetryRepository.count();

      sendJson(response, 200, { data: { events, total, limit, offset } });
      return;
    }

    sendError(response, 404, "NOT_FOUND", `Route ${request.method} ${url.pathname} is not implemented.`);
  });
}
