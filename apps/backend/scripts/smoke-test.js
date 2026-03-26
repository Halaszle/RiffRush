import assert from "node:assert/strict";
import { createApp } from "../src/create-app.js";

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const payload = await response.json();

  return {
    status: response.status,
    payload
  };
}

async function requestText(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.text();

  return {
    status: response.status,
    body,
    headers: response.headers
  };
}

const server = createApp();

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const health = await requestJson(baseUrl, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.payload.data.status, "ok");

  const trainings = await requestJson(baseUrl, "/trainings");
  assert.equal(trainings.status, 200);
  assert.ok(Array.isArray(trainings.payload.data));
  assert.ok(trainings.payload.data.length > 0);
  assert.ok(Array.isArray(trainings.payload.data[0].targetSequence));
  assert.equal(typeof trainings.payload.data[0].targetSequence[0].stringNumber, "number");
  assert.equal(typeof trainings.payload.data[0].targetSequence[0].beatOffset, "number");
  assert.equal(trainings.payload.data[0].chartSummary.sectionCount, 2);
  assert.equal(trainings.payload.data[0].chartSummary.restCount, 3);
  assert.equal(trainings.payload.data[0].chart.sections[0].label, "Intro pulse");
  assert.equal(trainings.payload.data[0].chart.events[1].type, "rest");

  const lockedTrainingAttempt = await requestJson(baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-locked",
      trainingId: "training-003",
      inputMode: "synthetic"
    })
  });

  assert.equal(lockedTrainingAttempt.status, 403);
  assert.equal(lockedTrainingAttempt.payload.error.code, "TRAINING_LOCKED");
  assert.equal(
    lockedTrainingAttempt.payload.error.details.lockedReason,
    'This training is locked until you complete "Single String Timing Foundations".'
  );
  assert.equal(
    lockedTrainingAttempt.payload.error.details.unlockRequirementSummary,
    'Complete "Single String Timing Foundations" to unlock this training.'
  );
  assert.deepEqual(lockedTrainingAttempt.payload.error.details.prerequisiteTrainingIds, ["training-001"]);
  assert.equal(lockedTrainingAttempt.payload.error.details.unlockProgress.completedRequirementCount, 0);
  assert.equal(lockedTrainingAttempt.payload.error.details.unlockProgress.totalRequirementCount, 1);
  assert.equal(
    lockedTrainingAttempt.payload.error.details.unlockProgress.summary,
    "0/1 prerequisite training completed."
  );
  assert.equal(lockedTrainingAttempt.payload.error.details.unlockRequirements[0].isSatisfied, false);

  const lockedUserCatalog = await requestJson(baseUrl, "/users/user-locked/trainings");
  assert.equal(lockedUserCatalog.status, 200);
  assert.equal(lockedUserCatalog.payload.data.summary.unlockedTrainingCount, 1);
  assert.equal(lockedUserCatalog.payload.data.summary.lockedTrainingCount, 8);
  assert.equal(lockedUserCatalog.payload.data.trainings.find((training) => training.id === "training-001").access.unlockState, "unlocked");
  assert.equal(lockedUserCatalog.payload.data.trainings.find((training) => training.id === "training-003").access.unlockState, "locked");
  assert.equal(
    lockedUserCatalog.payload.data.trainings.find((training) => training.id === "training-003").access.lockedReason,
    'This training is locked until you complete "Single String Timing Foundations".'
  );
  assert.equal(
    lockedUserCatalog.payload.data.trainings.find((training) => training.id === "training-003").access.unlockRequirementSummary,
    'Complete "Single String Timing Foundations" to unlock this training.'
  );
  assert.equal(
    lockedUserCatalog.payload.data.trainings.find((training) => training.id === "training-003").access.unlockProgress.summary,
    "0/1 prerequisite training completed."
  );
  assert.equal(
    lockedUserCatalog.payload.data.trainings.find((training) => training.id === "training-003").access.unlockRequirements[0].isSatisfied,
    false
  );

  const calibration = await requestJson(baseUrl, "/users/user-001/calibration", {
    method: "PUT",
    body: JSON.stringify({
      offsetMs: 14,
      measuredLatencyMs: 29,
      noiseFloorDb: -54
    })
  });

  assert.equal(calibration.status, 200);
  assert.equal(calibration.payload.data.user.calibrationProfile.offsetMs, 14);

  const capturePreferences = await requestJson(baseUrl, "/users/user-001/capture-preferences", {
    method: "PUT",
    body: JSON.stringify({
      autoApplyRecommendation: false
    })
  });

  assert.equal(capturePreferences.status, 200);
  assert.equal(capturePreferences.payload.data.user.capturePreferences.autoApplyRecommendation, false);

  const captureOverride = await requestJson(baseUrl, "/users/user-001/capture-overrides", {
    method: "POST",
    body: JSON.stringify({
      deviceName: "Focusrite USB Input",
      recommendedBackend: "wasapi",
      recommendedProfile: "balanced",
      selectedBackend: "wavein",
      selectedProfile: "low-latency",
      source: "manual-session-start"
    })
  });

  assert.equal(captureOverride.status, 201);
  assert.equal(captureOverride.payload.data.user.captureOverrideHistory.length, 1);
  assert.equal(captureOverride.payload.data.user.captureOverrideHistory[0].recommendedBackend, "wasapi");

  const captureOverrideConfirmation = await requestJson(baseUrl, "/users/user-001/capture-overrides", {
    method: "POST",
    body: JSON.stringify({
      deviceName: "Focusrite USB Input",
      recommendedBackend: "wavein",
      recommendedProfile: "low-latency",
      selectedBackend: "wasapi",
      selectedProfile: "balanced",
      source: "manual-session-start"
    })
  });

  assert.equal(captureOverrideConfirmation.status, 201);
  assert.equal(captureOverrideConfirmation.payload.data.user.captureOverrideHistory.length, 2);
  assert.equal(captureOverrideConfirmation.payload.data.user.captureOverrideHistory[0].selectedBackend, "wasapi");

  const createSession = await requestJson(baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-001",
      trainingId: trainings.payload.data[0].id,
      calibrationOffsetMs: 12,
      tempoBpm: 72,
      practiceScope: "section-loop",
      loopSectionId: "intro",
      loopRepetitionCount: 3,
      loopTempoStepBpm: 2,
      inputMode: "synthetic",
      captureDurationMs: 4000,
      captureProfile: "low-latency",
      inputDeviceBackend: "wavein",
      inputDeviceId: "wavein:0",
      inputDeviceNumber: 0
    })
  });

  assert.equal(createSession.status, 201);
  assert.equal(createSession.payload.data.session.status, "active");
  assert.equal(createSession.payload.data.session.inputMode, "synthetic");
  assert.equal(createSession.payload.data.session.captureDurationMs, 4000);
  assert.equal(createSession.payload.data.session.captureProfile, "low-latency");
  assert.equal(createSession.payload.data.session.tempoBpm, 72);
  assert.equal(createSession.payload.data.session.practiceScope, "section-loop");
  assert.equal(createSession.payload.data.session.loopSectionId, "intro");
  assert.equal(createSession.payload.data.session.loopRepetitionCount, 3);
  assert.equal(createSession.payload.data.session.loopTempoStepBpm, 2);
  assert.equal(createSession.payload.data.session.inputDeviceBackend, "wavein");
  assert.equal(createSession.payload.data.session.inputDeviceId, "wavein:0");
  assert.equal(createSession.payload.data.session.inputDeviceNumber, 0);

  const sessionId = createSession.payload.data.session.id;

  const summary = await requestJson(baseUrl, `/sessions/${sessionId}/summary`, {
    method: "POST",
    body: JSON.stringify({
      totalScore: 920,
      accuracy: 0.91,
      notesDetected: 42,
      notesHit: 38,
      scoreBreakdown: {
        tempoBpm: 80,
        targetCount: 42,
        matchedTargetCount: 40,
        unmatchedTargetCount: 2,
        noteHits: 38,
        stringHits: 37,
        timingHits: 35,
        fullHits: 34,
        sustainHits: 30,
        releaseHits: 26,
        fullComboHits: 28,
        earlyHitCount: 3,
        lateHitCount: 5,
        earlyReleaseCount: 8,
        overholdCount: 4,
        ghostNoteCount: 3,
        missedTargetCount: 2,
        maxCombo: 7,
        comboBreakCount: 5,
        multiplierPeak: 3,
        misses: 8,
        averageTimingOffsetMs: 28,
        maxTimingOffsetMs: 112,
        averageHoldCoverage: 0.74,
        averageReleaseOvershootMs: 12,
        maxReleaseOvershootMs: 48
      },
      sectionBreakdown: [
        {
          sectionId: "intro",
          sectionLabel: "Intro pulse",
          targetCount: 21,
          matchedTargetCount: 19,
          fullComboHits: 13,
          missedTargetCount: 2,
          ghostNoteCount: 2,
          earlyHitCount: 2,
          lateHitCount: 3,
          earlyReleaseCount: 5,
          overholdCount: 2,
          accuracy: 0.62,
          averageTimingOffsetMs: 34,
          averageHoldCoverage: 0.69,
          averageReleaseOvershootMs: 15,
          performanceScore: 49
        },
        {
          sectionId: "climb",
          sectionLabel: "Ascending phrase",
          targetCount: 21,
          matchedTargetCount: 21,
          fullComboHits: 15,
          missedTargetCount: 0,
          ghostNoteCount: 1,
          earlyHitCount: 1,
          lateHitCount: 2,
          earlyReleaseCount: 3,
          overholdCount: 2,
          accuracy: 0.71,
          averageTimingOffsetMs: 22,
          averageHoldCoverage: 0.78,
          averageReleaseOvershootMs: 9,
          performanceScore: 65
        }
      ],
      practicePreset: {
        scope: "section-loop",
        tempoBpm: 72,
        loopSectionId: "intro",
        loopSectionLabel: "Intro pulse",
        loopRepetitionCount: 3,
        loopTempoStepBpm: 2,
        repetitions: [
          { repetitionIndex: 0, tempoBpm: 72, startTimeMs: 833, durationMs: 1667, targetCount: 14, fullComboHits: 14, missedTargetCount: 0, ghostNoteCount: 0, accuracy: 1, performanceScore: 96, passed: true },
          { repetitionIndex: 1, tempoBpm: 74, startTimeMs: 2500, durationMs: 1622, targetCount: 14, fullComboHits: 11, missedTargetCount: 1, ghostNoteCount: 1, accuracy: 0.79, performanceScore: 71, passed: false },
          { repetitionIndex: 2, tempoBpm: 76, startTimeMs: 4122, durationMs: 1579, targetCount: 14, fullComboHits: 10, missedTargetCount: 1, ghostNoteCount: 2, accuracy: 0.71, performanceScore: 63, passed: false }
        ],
        masteryGate: {
          status: "keep-building",
          passedRepetitionCount: 1,
          totalRepetitionCount: 3,
          highestPassedTempoBpm: 72,
          recommendedNextTempoBpm: 74,
          message: "Czesc petli jest juz stabilna. Utrzymaj ostatnie zaliczone tempo i domknij kolejne powtorki."
        },
        adaptiveExecution: {
          mode: "early-stop",
          triggered: true,
          completedRepetitionCount: 2,
          plannedRepetitionCount: 3,
          stoppedAfterRepetitionIndex: 1,
          stopReason: "Repetition 2 fell below the adaptive threshold at 74 BPM.",
          retryPlan: {
            strategy: "repeat-current-tempo",
            tempoBpm: 74,
            loopRepetitionCount: 2,
            loopTempoStepBpm: 0,
            reason: "The failed repetition was close to passing. Repeat the same tempo and stabilize the section before reintroducing progression."
          }
        }
      },
      rating: {
        grade: "B",
        label: "Solid pass",
        clearType: "clear",
        performanceScore: 83
      },
      feedback: {
        summary: "Solidna baza. Sesja jest grywalna, ale nadal tracisz punkty na powtarzalnych błędach.",
        focusAreas: ["Domknij timing wejść", "Ogranicz dodatkowe uderzenia"],
        coachHints: [
          {
            id: "timing-consistency",
            title: "Domknij timing wejść",
            detail: "Masz zbyt dużo pominiętych targetów. Zwolnij minimalnie i pilnuj wejścia dokładnie na beat.",
            severity: "high"
          },
          {
            id: "ghost-note-control",
            title: "Ogranicz dodatkowe uderzenia",
            detail: "Pojawiają się ghost notes poza chartem. Skróć ruch prawej ręki i czyść artykulację między targetami.",
            severity: "high"
          }
        ]
      },
      capture: {
        source: "native-capture",
        profile: "low-latency",
        requestedProfile: "low-latency",
        backend: "wavein",
        requestedBackend: "wavein",
        deviceId: "wavein:0",
        deviceName: "Focusrite USB Input",
        deviceNumber: 0,
        sampleRate: 48000,
        chunkCount: 40,
        durationMs: 4000,
        bufferMs: 20,
        numberOfBuffers: 2,
        startAttemptCount: 2,
        maxChunkGapMs: 340,
        lowSignalEventCount: 1,
        lowSignalChunkCount: 3,
        useEventSync: true,
        fallbackApplied: true,
        fallbackReason: "Requested native capture path did not validate. Falling back to the recommended WASAPI low-latency profile."
      },
      artifact: {
        type: "wav-file",
        filePath: "D:\\tmp\\session.wav"
      },
      diagnostics: {
        currentCapture: {
          requestedProfile: "low-latency",
          requestedBackend: "wavein",
          profile: "low-latency",
          backend: "wavein",
          deviceName: "Focusrite USB Input",
          sampleRate: 48000,
          bufferMs: 20,
          numberOfBuffers: 2,
          useEventSync: true,
          startAttemptCount: 2,
          maxChunkGapMs: 340,
          lowSignalEventCount: 1,
          lowSignalChunkCount: 3,
          fallbackApplied: true,
          fallbackReason: "Requested native capture path did not validate. Falling back to the recommended WASAPI low-latency profile."
        },
        notices: [
          {
            code: "NATIVE_CAPTURE_PREFLIGHT_FALLBACK",
            level: "warning",
            message: "Requested native capture path did not validate. Falling back to the recommended WASAPI low-latency profile.",
            timestamp: "2026-03-22T10:00:00.000Z",
            capture: {
              requestedProfile: "low-latency",
              requestedBackend: "wavein",
              profile: "low-latency",
              backend: "wasapi",
              deviceName: "Focusrite USB Input",
              sampleRate: 48000,
              bufferMs: 25,
              numberOfBuffers: 2,
              useEventSync: true,
              startAttemptCount: 1
            }
          },
          {
            code: "NATIVE_CAPTURE_LOW_SIGNAL",
            level: "warning",
            message: "Native capture input level is very low (RMS 0.0031) across 3 consecutive chunk(s).",
            timestamp: "2026-03-22T10:00:01.000Z",
            capture: {
              requestedProfile: "low-latency",
              requestedBackend: "wavein",
              profile: "low-latency",
              backend: "wavein",
              deviceName: "Focusrite USB Input",
              sampleRate: 48000,
              bufferMs: 20,
              numberOfBuffers: 2,
              useEventSync: true,
              startAttemptCount: 2
            }
          }
        ]
      }
    })
  });

  assert.equal(summary.status, 200);
  assert.equal(summary.payload.data.session.status, "completed");
  assert.equal(summary.payload.data.unlockTransition.hasNewUnlocks, true);
  assert.equal(summary.payload.data.unlockTransition.unlockedTrainingCount, 2);
  assert.ok(summary.payload.data.unlockTransition.unlockedTrainingIds.includes("training-003"));
  assert.ok(summary.payload.data.unlockTransition.unlockedTrainingIds.includes("training-004"));
  assert.ok(summary.payload.data.unlockTransition.unlockedTrainingTitles.includes("Timing Control Ladder"));
  assert.ok(summary.payload.data.unlockTransition.unlockedTrainingTitles.includes("First Pentatonic Steps"));
  assert.equal(summary.payload.data.session.summary.capture.profile, "low-latency");
  assert.equal(summary.payload.data.session.summary.capture.requestedProfile, "low-latency");
  assert.equal(summary.payload.data.session.summary.capture.backend, "wavein");
  assert.equal(summary.payload.data.session.summary.capture.requestedBackend, "wavein");
  assert.equal(summary.payload.data.session.summary.capture.deviceName, "Focusrite USB Input");
  assert.equal(summary.payload.data.session.summary.capture.bufferMs, 20);
  assert.equal(summary.payload.data.session.summary.capture.numberOfBuffers, 2);
  assert.equal(summary.payload.data.session.summary.capture.startAttemptCount, 2);
  assert.equal(summary.payload.data.session.summary.capture.maxChunkGapMs, 340);
  assert.equal(summary.payload.data.session.summary.capture.lowSignalEventCount, 1);
  assert.equal(summary.payload.data.session.summary.capture.lowSignalChunkCount, 3);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.targetCount, 42);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.tempoBpm, 80);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.stringHits, 37);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.sustainHits, 30);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.releaseHits, 26);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.fullComboHits, 28);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.overholdCount, 4);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.ghostNoteCount, 3);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.missedTargetCount, 2);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.maxCombo, 7);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.comboBreakCount, 5);
  assert.equal(summary.payload.data.session.summary.scoreBreakdown.multiplierPeak, 3);
  assert.equal(summary.payload.data.session.summary.sectionBreakdown.length, 2);
  assert.equal(summary.payload.data.session.summary.sectionBreakdown[0].sectionLabel, "Intro pulse");
  assert.equal(summary.payload.data.session.summary.sectionBreakdown[0].performanceScore, 49);
  assert.equal(summary.payload.data.session.summary.practicePreset.scope, "section-loop");
  assert.equal(summary.payload.data.session.summary.practicePreset.loopSectionLabel, "Intro pulse");
  assert.equal(summary.payload.data.session.summary.practicePreset.loopRepetitionCount, 3);
  assert.equal(summary.payload.data.session.summary.practicePreset.loopTempoStepBpm, 2);
  assert.equal(summary.payload.data.session.summary.practicePreset.repetitions.length, 3);
  assert.equal(summary.payload.data.session.summary.practicePreset.repetitions[0].passed, true);
  assert.equal(summary.payload.data.session.summary.practicePreset.repetitions[1].performanceScore, 71);
  assert.equal(summary.payload.data.session.summary.practicePreset.masteryGate.status, "keep-building");
  assert.equal(summary.payload.data.session.summary.practicePreset.masteryGate.recommendedNextTempoBpm, 74);
  assert.equal(summary.payload.data.session.summary.practicePreset.adaptiveExecution.mode, "early-stop");
  assert.equal(summary.payload.data.session.summary.practicePreset.adaptiveExecution.triggered, true);
  assert.equal(summary.payload.data.session.summary.practicePreset.adaptiveExecution.completedRepetitionCount, 2);
  assert.equal(summary.payload.data.session.summary.practicePreset.adaptiveExecution.retryPlan.strategy, "repeat-current-tempo");
  assert.equal(summary.payload.data.session.summary.rating.grade, "B");
  assert.equal(summary.payload.data.session.summary.rating.clearType, "clear");
  assert.equal(summary.payload.data.session.summary.feedback.focusAreas[0], "Domknij timing wejść");
  assert.equal(summary.payload.data.session.summary.feedback.coachHints[0].severity, "high");
  assert.equal(summary.payload.data.session.summary.capture.useEventSync, true);
  assert.equal(summary.payload.data.session.summary.capture.fallbackApplied, true);
  assert.equal(summary.payload.data.session.summary.diagnostics.currentCapture.deviceName, "Focusrite USB Input");
  assert.equal(summary.payload.data.session.summary.diagnostics.notices.length, 2);
  assert.equal(summary.payload.data.session.summary.diagnostics.notices[0].code, "NATIVE_CAPTURE_PREFLIGHT_FALLBACK");
  assert.equal(summary.payload.data.session.summary.artifact.filePath, "D:\\tmp\\session.wav");

  const dashboardAfterWarningSummary = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterWarningSummary.status, 200);
  assert.equal(dashboardAfterWarningSummary.payload.data.progressionSafety.status, "hold");
  assert.equal(dashboardAfterWarningSummary.payload.data.progressionSafety.canAdvance, false);
  assert.equal(
    dashboardAfterWarningSummary.payload.data.progressionSafety.dominantIssue,
    "repetition-accounting-mismatch"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.progressionSafety.technicalFallbackRouting.backend,
    "wasapi"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.progressionSafety.technicalFallbackRouting.profile,
    "low-latency"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.progressionSafety.technicalFallbackRouting.primarySetupRecommendation.id,
    "prefer-wasapi"
  );
  assert.equal(dashboardAfterWarningSummary.payload.data.verificationHoldSummary.holdSessionCount, 1);
  assert.equal(dashboardAfterWarningSummary.payload.data.verificationHoldSummary.latestStatus, "hold");
  assert.equal(dashboardAfterWarningSummary.payload.data.verificationHoldSummary.suspectedOrigin, "capture-path");
  assert.equal(dashboardAfterWarningSummary.payload.data.verificationHoldSummary.technicalHoldSessionCount, 1);
  assert.equal(dashboardAfterWarningSummary.payload.data.verificationHoldSummary.progressionHoldSessionCount, 0);
  assert.equal(
    dashboardAfterWarningSummary.payload.data.verificationHoldSummary.dominantHoldStatus.recoveryProgressStatus,
    "general"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.verificationHoldSummary.byCaptureSource[0].captureSource,
    "native-capture"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.targetedPractice.verificationGate.status,
    "hold-progression"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.targetedPractice.verificationGate.dominantIssue,
    "repetition-accounting-mismatch"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.targetedPractice.verificationGate.suspectedOrigin,
    "capture-path"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.targetedPractice.verificationGate.technicalFallbackRouting.backend,
    "wasapi"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.targetedPractice.verificationGate.technicalFallbackRouting.profile,
    "low-latency"
  );
  assert.equal(
    dashboardAfterWarningSummary.payload.data.targetedPractice.verificationGate.technicalFallbackRouting.primarySetupRecommendation.id,
    "prefer-wasapi"
  );
  assert.equal(dashboardAfterWarningSummary.payload.data.targetedPractice.action, "repeat-current");
  assert.equal(dashboardAfterWarningSummary.payload.data.targetedPractice.suggestedTempoBpm, 72);
  assert.equal(dashboardAfterWarningSummary.payload.data.targetedPractice.loopTempoStepBpm, 0);
  assert.match(dashboardAfterWarningSummary.payload.data.targetedPractice.nextStep, /backendu wasapi/i);

  const createSecondSession = await requestJson(baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-001",
      trainingId: trainings.payload.data[0].id,
      calibrationOffsetMs: 12,
      tempoBpm: 88,
      practiceScope: "full-chart",
      inputMode: "synthetic",
      captureDurationMs: 4000,
      captureProfile: "balanced",
      inputDeviceBackend: "wasapi",
      inputDeviceId: "wasapi:0",
      inputDeviceNumber: 0
    })
  });

  assert.equal(createSecondSession.status, 201);

  const trackedVerificationHoldFollowup = await requestJson(baseUrl, "/users/user-001/setup-recommendations", {
    method: "POST",
    body: JSON.stringify({
      deviceName: "Focusrite USB Input",
      backend: "wasapi",
      profile: "balanced",
      recommendationId: "prefer-wasapi",
      recommendationTitle: "Prefer WASAPI",
      recommendationDetail: "WASAPI should be more stable for this capture path.",
      source: "verification-hold-session-start",
      plannedSessionId: createSecondSession.payload.data.session.id
    })
  });

  assert.equal(trackedVerificationHoldFollowup.status, 201);
  assert.equal(trackedVerificationHoldFollowup.payload.data.setupRecommendation.status, "applied");
  assert.equal(
    trackedVerificationHoldFollowup.payload.data.setupRecommendation.plannedSessionId,
    createSecondSession.payload.data.session.id
  );

  const invalidVerificationSummary = await requestJson(
    baseUrl,
    `/sessions/${createSecondSession.payload.data.session.id}/summary`,
    {
      method: "POST",
      body: JSON.stringify({
        totalScore: 150,
        accuracy: 1,
        notesDetected: 1,
        notesHit: 1,
        scoreBreakdown: {
          tempoBpm: 88,
          targetCount: 1,
          matchedTargetCount: 1,
          unmatchedTargetCount: 0,
          noteHits: 1,
          stringHits: 1,
          timingHits: 1,
          fullHits: 1,
          sustainHits: 1,
          releaseHits: 1,
          fullComboHits: 1,
          earlyHitCount: 0,
          lateHitCount: 0,
          earlyReleaseCount: 0,
          overholdCount: 0,
          ghostNoteCount: 0,
          missedTargetCount: 0,
          maxCombo: 1,
          comboBreakCount: 0,
          multiplierPeak: 1,
          misses: 0,
          averageTimingOffsetMs: 0,
          maxTimingOffsetMs: 0,
          averageHoldCoverage: 1,
          averageReleaseOvershootMs: 0,
          maxReleaseOvershootMs: 0
        },
        verification: {
          status: "verified",
          mechanicallyComplete: true,
          targetCoverage: 0,
          checks: {
            hasScoreBreakdown: false,
            hasSectionBreakdown: false,
            hasPracticeRepetitions: false,
            targetAccountingMatches: false,
            hitAccountingMatches: false,
            sectionAccountingMatches: false,
            repetitionAccountingMatches: false,
            hasCapture: false,
            hasDiagnostics: false,
            hasArtifact: false
          },
          issues: []
        }
      })
    }
  );

  assert.equal(invalidVerificationSummary.status, 400);
  assert.equal(
    invalidVerificationSummary.payload.error.code,
    "INVALID_SUMMARY_INPUT"
  );
  assert.match(
    invalidVerificationSummary.payload.error.message,
    /verification does not match the session summary accounting/i
  );

  const secondSummary = await requestJson(baseUrl, `/sessions/${createSecondSession.payload.data.session.id}/summary`, {
    method: "POST",
    body: JSON.stringify({
      totalScore: 970,
      accuracy: 0.96,
      notesDetected: 40,
      notesHit: 39,
      scoreBreakdown: {
        tempoBpm: 80,
        targetCount: 40,
        matchedTargetCount: 40,
        unmatchedTargetCount: 0,
        noteHits: 39,
        stringHits: 39,
        timingHits: 38,
        fullHits: 38,
        sustainHits: 37,
        releaseHits: 35,
        fullComboHits: 36,
        earlyHitCount: 1,
        lateHitCount: 1,
        earlyReleaseCount: 2,
        overholdCount: 1,
        ghostNoteCount: 0,
        missedTargetCount: 0,
        maxCombo: 12,
        comboBreakCount: 1,
        multiplierPeak: 4,
        misses: 2,
        averageTimingOffsetMs: 14,
        maxTimingOffsetMs: 42,
        averageHoldCoverage: 0.91,
        averageReleaseOvershootMs: 3,
        maxReleaseOvershootMs: 12
      },
      sectionBreakdown: [
        {
          sectionId: "intro",
          sectionLabel: "Intro pulse",
          targetCount: 20,
          matchedTargetCount: 20,
          fullComboHits: 19,
          missedTargetCount: 0,
          ghostNoteCount: 0,
          earlyHitCount: 0,
          lateHitCount: 1,
          earlyReleaseCount: 1,
          overholdCount: 0,
          accuracy: 0.95,
          averageTimingOffsetMs: 10,
          averageHoldCoverage: 0.95,
          averageReleaseOvershootMs: 2,
          performanceScore: 93
        },
        {
          sectionId: "climb",
          sectionLabel: "Ascending phrase",
          targetCount: 20,
          matchedTargetCount: 20,
          fullComboHits: 17,
          missedTargetCount: 0,
          ghostNoteCount: 0,
          earlyHitCount: 1,
          lateHitCount: 0,
          earlyReleaseCount: 1,
          overholdCount: 1,
          accuracy: 0.85,
          averageTimingOffsetMs: 18,
          averageHoldCoverage: 0.87,
          averageReleaseOvershootMs: 4,
          performanceScore: 81
        }
      ],
      practicePreset: {
        scope: "full-chart",
        tempoBpm: 88
      },
      rating: {
        grade: "S",
        label: "Stage-ready",
        clearType: "clean-clear",
        performanceScore: 97
      },
      feedback: {
        summary: "Bardzo czysta sesja. Utrzymuj kontrolę i podnoś trudność bez utraty precyzji.",
        focusAreas: ["Utrzymaj obecny tor gry"],
        coachHints: [
          {
            id: "keep-current-approach",
            title: "Utrzymaj obecny tor gry",
            detail: "Sesja jest stabilna. Teraz warto podnosić tempo albo precyzję bez zmiany techniki bazowej.",
            severity: "low"
          }
        ]
      },
      capture: {
        source: "native-capture",
        profile: "balanced",
        requestedProfile: "balanced",
        backend: "wasapi",
        requestedBackend: "wasapi",
        deviceId: "wasapi:0",
        deviceName: "Focusrite USB Input",
        deviceNumber: 0,
        sampleRate: 96000,
        chunkCount: 48,
        durationMs: 4000,
        bufferMs: 18,
        numberOfBuffers: 2,
        startAttemptCount: 1,
        useEventSync: true,
        fallbackApplied: false
      },
      diagnostics: {
        currentCapture: {
          requestedProfile: "balanced",
          requestedBackend: "wasapi",
          profile: "balanced",
          backend: "wasapi",
          deviceName: "Focusrite USB Input",
          sampleRate: 96000,
          bufferMs: 18,
          numberOfBuffers: 2,
          useEventSync: true,
          startAttemptCount: 1,
          fallbackApplied: false
        },
        notices: []
      }
    })
  });

  assert.equal(secondSummary.status, 200);
  assert.equal(secondSummary.payload.data.unlockTransition.hasNewUnlocks, false);
  assert.equal(secondSummary.payload.data.unlockTransition.unlockedTrainingCount, 0);
  assert.equal(secondSummary.payload.data.user.setupRecommendationHistory.length, 1);
  assert.equal(secondSummary.payload.data.setupRecommendationFollowup.status, "improved");
  assert.equal(secondSummary.payload.data.setupRecommendationFollowup.recommendationId, "prefer-wasapi");
  assert.equal(
    secondSummary.payload.data.setupRecommendationFollowup.observedSessionId,
    createSecondSession.payload.data.session.id
  );
  assert.equal(
    secondSummary.payload.data.setupRecommendationFollowup.evaluationMode,
    "auto-followup"
  );
  assert.equal(secondSummary.payload.data.session.summary.capture.backend, "wasapi");
  assert.equal(secondSummary.payload.data.session.summary.capture.profile, "balanced");
  assert.equal(secondSummary.payload.data.session.summary.capture.startAttemptCount, 1);
  assert.equal(secondSummary.payload.data.session.summary.capture.fallbackApplied, false);

  const dashboard = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.payload.data.capturePreferences.autoApplyRecommendation, false);
  assert.equal(dashboard.payload.data.captureOverrideHistory.length, 2);
  assert.equal(dashboard.payload.data.captureOverrideHistory[0].selectedBackend, "wasapi");
  assert.equal(dashboard.payload.data.stats.completedSessions, 2);
  assert.equal(dashboard.payload.data.verificationHoldSetupFollowupSummary.trackedCount, 1);
  assert.equal(dashboard.payload.data.verificationHoldSetupFollowupSummary.improvedCount, 1);
  assert.equal(dashboard.payload.data.verificationHoldSetupFollowupSummary.pendingCount, 0);
  assert.equal(dashboard.payload.data.verificationHoldSetupFollowupSummary.latestStatus, "improved");
  assert.equal(dashboard.payload.data.progressionSafety.status, "clear");
  assert.equal(dashboard.payload.data.progressionSafety.canAdvance, true);
  assert.equal(dashboard.payload.data.targetedPractice.verificationGate, undefined);
  assert.equal(dashboard.payload.data.targetedPractice.recommendedTrainingId, "training-001");
  assert.equal(dashboard.payload.data.targetedPractice.action, "repeat-current");
  assert.equal(dashboard.payload.data.targetedPractice.recommendedSectionId, "climb");
  assert.equal(dashboard.payload.data.targetedPractice.recommendedSectionLabel, "Ascending phrase");
  assert.equal(dashboard.payload.data.targetedPractice.sectionAction, "loop-section");
  assert.equal(dashboard.payload.data.targetedPractice.loopRepetitionCount, 4);
  assert.equal(dashboard.payload.data.targetedPractice.loopTempoStepBpm, 4);
  assert.equal(dashboard.payload.data.targetedPractice.primaryFocus.id, "keep-current-approach");
  assert.equal(dashboard.payload.data.verificationTrend.sampleSize, 5);
  assert.equal(dashboard.payload.data.verificationTrend.analyzedSessionCount, 2);
  assert.equal(dashboard.payload.data.verificationTrend.verifiedSessionCount, 1);
  assert.equal(dashboard.payload.data.verificationTrend.warningSessionCount, 1);
  assert.equal(dashboard.payload.data.verificationTrend.trend, "needs-attention");
  assert.equal(dashboard.payload.data.recentResults.length, 2);
  assert.equal(dashboard.payload.data.recentResults[0].capture.deviceName, "Focusrite USB Input");
  assert.equal(dashboard.payload.data.recentResults[0].verification.status, "verified");
  assert.equal(dashboard.payload.data.recentResults[0].practicePreset.scope, "full-chart");
  assert.equal(dashboard.payload.data.recentResults[0].sectionBreakdown[1].sectionLabel, "Ascending phrase");
  assert.equal(dashboard.payload.data.recentResults[0].scoreBreakdown.fullHits, 38);
  assert.equal(dashboard.payload.data.recentResults[0].scoreBreakdown.fullComboHits, 36);
  assert.equal(dashboard.payload.data.recentResults[0].scoreBreakdown.releaseHits, 35);
  assert.equal(dashboard.payload.data.recentResults[0].scoreBreakdown.ghostNoteCount, 0);
  assert.equal(dashboard.payload.data.recentResults[0].scoreBreakdown.maxCombo, 12);
  assert.equal(dashboard.payload.data.recentResults[0].rating.grade, "S");
  assert.equal(dashboard.payload.data.recentResults[0].feedback.coachHints[0].id, "keep-current-approach");
  assert.equal(dashboard.payload.data.recentResults[0].scoreBreakdown.tempoBpm, 80);
  assert.equal(dashboard.payload.data.recentResults[1].diagnostics.notices.length, 2);
  assert.equal(dashboard.payload.data.recentResults[1].scoreBreakdown.stringHits, 37);
  assert.equal(dashboard.payload.data.recentResults[1].scoreBreakdown.averageHoldCoverage, 0.74);
  assert.equal(dashboard.payload.data.recentResults[1].scoreBreakdown.averageReleaseOvershootMs, 12);
  assert.equal(dashboard.payload.data.recentResults[1].scoreBreakdown.missedTargetCount, 2);
  assert.equal(dashboard.payload.data.recentResults[1].scoreBreakdown.comboBreakCount, 5);
  assert.equal(dashboard.payload.data.recentResults[1].rating.grade, "B");
  assert.equal(dashboard.payload.data.recentResults[1].feedback.focusAreas.length, 2);
  assert.equal(dashboard.payload.data.recentResults[1].capture.maxChunkGapMs, 340);
  assert.equal(dashboard.payload.data.recentResults[1].practicePreset.loopSectionId, "intro");
  assert.equal(dashboard.payload.data.recentResults[1].practicePreset.repetitions.length, 3);
  assert.equal(dashboard.payload.data.recentResults[1].practicePreset.repetitions[0].passed, true);
  assert.equal(dashboard.payload.data.recentResults[1].practicePreset.masteryGate.status, "keep-building");
  assert.equal(dashboard.payload.data.recentResults[1].practicePreset.adaptiveExecution.triggered, true);
  assert.equal(dashboard.payload.data.recentResults[1].practicePreset.adaptiveExecution.retryPlan.tempoBpm, 74);
  assert.equal(dashboard.payload.data.recentResults[1].artifact.filePath, "D:\\tmp\\session.wav");
  assert.equal(dashboard.payload.data.checkpointHistorySnapshots.length, 2);
  assert.equal(
    dashboard.payload.data.checkpointHistorySnapshots[0].sessionId,
    dashboard.payload.data.recentResults[0].sessionId
  );
  assert.ok(typeof dashboard.payload.data.checkpointHistorySnapshots[0].type === "string");
  assert.ok(typeof dashboard.payload.data.checkpointHistorySnapshots[0].detail.trainingTitle === "string");
  assert.ok(typeof dashboard.payload.data.checkpointHistorySnapshots[0].detail.reason === "string");
  assert.ok(
    dashboard.payload.data.checkpointHistorySnapshots[0].badges.some((badge) => badge.label.startsWith("Grade "))
  );
  assert.match(
    dashboard.payload.data.checkpointHistorySnapshots[0].highlights[0],
    /Score \d+, accuracy 0\.\d+, grade [A-Z]/
  );

  const diagnostics = await requestJson(baseUrl, "/users/user-001/diagnostics");
  assert.equal(diagnostics.status, 200);
  assert.equal(diagnostics.payload.data.sorting.sortBy, "latest");
  assert.equal(diagnostics.payload.data.sorting.sortDirection, "desc");
  assert.equal(diagnostics.payload.data.summary.sessionCount, 2);
  assert.equal(diagnostics.payload.data.verificationTrend.analyzedSessionCount, 2);
  assert.equal(diagnostics.payload.data.verificationTrend.verifiedSessionCount, 1);
  assert.equal(diagnostics.payload.data.verificationTrend.warningSessionCount, 1);
  assert.equal(diagnostics.payload.data.verificationTrend.trend, "needs-attention");
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.analyzedSessionCount, 2);
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.warningSessionCount, 1);
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.issueGroups[0].code, "repetition-accounting-mismatch");
  assert.deepEqual(diagnostics.payload.data.verificationIssueDrilldown.issueGroups[0].practiceScopes, ["section-loop"]);
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.byCaptureSource[0].captureSource, "native-capture");
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.byCaptureSource[0].warningSessionCount, 1);
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.byPracticeScope[0].practiceScope, "section-loop");
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.byPracticeScope[0].dominantIssue.code, "repetition-accounting-mismatch");
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.byTraining[0].trainingId, "training-001");
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.analyzedSessionCount, 2);
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.holdSessionCount, 1);
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.latestStatus, "hold");
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.suspectedOrigin, "capture-path");
  assert.equal(
    diagnostics.payload.data.verificationHoldDrilldown.dominantHoldStatus.recoveryProgressStatus,
    "general"
  );
  assert.equal(
    diagnostics.payload.data.verificationHoldDrilldown.dominantHoldStatus.dominantIssue.code,
    "repetition-accounting-mismatch"
  );
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.byCaptureSource[0].captureSource, "native-capture");
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.byCaptureBackend[0].captureBackend, "wavein");
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.byCaptureProfile[0].captureProfile, "low-latency");
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.byRecommendedCapturePath[0].backend, "wasapi");
  assert.equal(diagnostics.payload.data.verificationHoldDrilldown.byRecommendedCapturePath[0].profile, "low-latency");
  assert.deepEqual(
    diagnostics.payload.data.verificationHoldDrilldown.byRecommendedCapturePath[0].sourceNoticeCodes,
    ["NATIVE_CAPTURE_PREFLIGHT_FALLBACK"]
  );
  assert.equal(diagnostics.payload.data.summary.pathCount, 2);
  assert.equal(diagnostics.payload.data.summary.sessionsWithFallback, 1);
  assert.equal(diagnostics.payload.data.summary.fallbackRate, 0.5);
  assert.equal(diagnostics.payload.data.summary.averageStartAttempts, 1.5);
  assert.equal(diagnostics.payload.data.summary.mostProblematicPath.deviceName, "Focusrite USB Input");
  assert.equal(diagnostics.payload.data.runtimeIssues.totalWarningNotices, 2);
  assert.equal(diagnostics.payload.data.runtimeIssues.topIssue.code, "NATIVE_CAPTURE_LOW_SIGNAL");
  assert.equal(diagnostics.payload.data.runtimeIssues.topIssue.issueClass, "signal-quality");
  assert.deepEqual(
    diagnostics.payload.data.runtimeIssues.stageBreakdown.map((entry) => entry.stage).sort(),
    ["preflight", "runtime"]
  );
  assert.deepEqual(
    diagnostics.payload.data.runtimeIssues.classBreakdown.map((entry) => entry.issueClass).sort(),
    ["backend-routing", "signal-quality"]
  );
  assert.equal(diagnostics.payload.data.insights.recommendedPath.backend, "wasapi");
  assert.equal(diagnostics.payload.data.insights.recommendedPath.profile, "balanced");
  assert.equal(diagnostics.payload.data.insights.recommendedPath.selectionSource, "technical-with-setup-feedback");
  assert.equal(diagnostics.payload.data.insights.recommendedPath.overrideSupportCount, 1);
  assert.equal(diagnostics.payload.data.insights.recommendedPath.stabilityScore, 97);
  assert.equal(diagnostics.payload.data.insights.recommendedPath.startReliabilityScore, 100);
  assert.equal(diagnostics.payload.data.insights.recommendedPath.runtimeStabilityScore, 100);
  assert.equal(diagnostics.payload.data.insights.recommendedPath.recommendationConfidenceScore, 83);
  assert.equal(diagnostics.payload.data.insights.recommendedPath.latencyFitnessScore, 92);
  assert.equal(diagnostics.payload.data.insights.recommendedPath.signalQualityScore, 100);
  assert.equal(diagnostics.payload.data.insights.recommendedPath.setupRecommendations[0].id, "keep-current-setup");
  assert.equal(diagnostics.payload.data.insights.recommendedPath.primarySetupRecommendation.id, "keep-current-setup");
  assert.equal(diagnostics.payload.data.insights.overridePreferences.length, 2);
  assert.equal(diagnostics.payload.data.insights.overridePreferences[0].backend, "wasapi");
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations.length, 1);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].deviceName, "Focusrite USB Input");
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].recommendedPath.backend, "wasapi");
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].recommendedPath.stabilityScore, 97);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths.length, 2);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].backend, "wasapi");
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].stabilityScore, 97);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].startReliabilityScore, 100);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].runtimeStabilityScore, 100);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].recommendationConfidenceScore, 83);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].latencyFitnessScore, 92);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].signalQualityScore, 100);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].setupRecommendations[0].id, "keep-current-setup");
  assert.equal(
    diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[0].primarySetupRecommendation.id,
    "keep-current-setup"
  );
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].backend, "wavein");
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].stabilityScore, 37);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].startReliabilityScore, 35);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].runtimeStabilityScore, 17);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].recommendationConfidenceScore, 79);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].latencyFitnessScore, 79);
  assert.equal(diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].signalQualityScore, 85);
  assert.equal(
    diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].primarySetupRecommendation.id,
    "prefer-wasapi"
  );
  assert.deepEqual(
    diagnostics.payload.data.insights.deviceRecommendations[0].scoredPaths[1].setupRecommendations.map((entry) => entry.id),
    ["prefer-wasapi", "increase-input-level", "verify-input-chain"]
  );
  assert.equal(diagnostics.payload.data.insights.problematicPaths[0].backend, "wavein");
  assert.ok(diagnostics.payload.data.insights.problematicPaths[0].dominantWarningClass);
  assert.equal(diagnostics.payload.data.recentSessions.length, 2);
  assert.equal(diagnostics.payload.data.recentSessions[0].capture.deviceName, "Focusrite USB Input");
  assert.equal(diagnostics.payload.data.recentSessions[1].diagnostics.noticeCount, 2);
  assert.equal(diagnostics.payload.data.groupedPaths[1].averageMaxChunkGapMs, 340);
  assert.equal(diagnostics.payload.data.groupedPaths[1].totalLowSignalEventCount, 1);
  assert.equal(diagnostics.payload.data.groupedPaths.length, 2);
  assert.equal(diagnostics.payload.data.groupedPaths[0].deviceName, "Focusrite USB Input");
  assert.equal(diagnostics.payload.data.groupedPaths[0].sessionCount, 1);
  assert.equal(diagnostics.payload.data.groupedPaths[1].fallbackRate, 1);
  assert.ok(diagnostics.payload.data.groupedPaths[1].dominantWarningClass);
  assert.ok(diagnostics.payload.data.groupedPaths[1].warningClassBreakdown.length > 0);

  const diagnosticsFiltered = await requestJson(baseUrl, "/users/user-001/diagnostics?backend=wasapi");
  assert.equal(diagnosticsFiltered.status, 200);
  assert.equal(diagnosticsFiltered.payload.data.recentSessions.length, 1);
  assert.equal(diagnosticsFiltered.payload.data.groupedPaths.length, 1);
  assert.equal(diagnosticsFiltered.payload.data.filters.backend, "wasapi");
  assert.equal(diagnosticsFiltered.payload.data.insights.recommendedPath.backend, "wasapi");
  assert.equal(diagnosticsFiltered.payload.data.insights.recommendedPath.stabilityScore, 97);
  assert.equal(diagnosticsFiltered.payload.data.insights.recommendedPath.latencyFitnessScore, 92);
  assert.equal(diagnosticsFiltered.payload.data.insights.recommendedPath.signalQualityScore, 100);
  assert.equal(diagnosticsFiltered.payload.data.insights.deviceRecommendations.length, 1);

  const diagnosticsSorted = await requestJson(
    baseUrl,
    "/users/user-001/diagnostics?sortBy=attempts&sortDirection=asc"
  );
  assert.equal(diagnosticsSorted.status, 200);
  assert.equal(diagnosticsSorted.payload.data.sorting.sortBy, "attempts");
  assert.equal(diagnosticsSorted.payload.data.sorting.sortDirection, "asc");
  assert.equal(diagnosticsSorted.payload.data.groupedPaths[0].averageStartAttempts, 1);
  assert.equal(diagnosticsSorted.payload.data.groupedPaths[1].averageStartAttempts, 2);

  const deviceDiagnostics = await requestJson(
    baseUrl,
    "/users/user-001/diagnostics/devices/Focusrite%20USB%20Input"
  );
  assert.equal(deviceDiagnostics.status, 200);
  assert.equal(deviceDiagnostics.payload.data.deviceName, "Focusrite USB Input");
  assert.equal(deviceDiagnostics.payload.data.summary.sessionCount, 2);
  assert.equal(deviceDiagnostics.payload.data.summary.pathCount, 2);
  assert.equal(deviceDiagnostics.payload.data.summary.latestCompletedAt, secondSummary.payload.data.session.completedAt);
  assert.equal(deviceDiagnostics.payload.data.verificationIssueDrilldown.warningSessionCount, 1);
  assert.equal(deviceDiagnostics.payload.data.verificationIssueDrilldown.issueGroups[0].code, "repetition-accounting-mismatch");
  assert.equal(deviceDiagnostics.payload.data.verificationHoldDrilldown.holdSessionCount, 1);
  assert.equal(deviceDiagnostics.payload.data.verificationHoldDrilldown.suspectedOrigin, "capture-path");
  assert.equal(
    deviceDiagnostics.payload.data.verificationHoldDrilldown.dominantHoldStatus.recoveryProgressStatus,
    "general"
  );
  assert.equal(deviceDiagnostics.payload.data.verificationHoldDrilldown.byCaptureSource[0].captureSource, "native-capture");
  assert.equal(deviceDiagnostics.payload.data.verificationHoldDrilldown.byRecommendedCapturePath[0].backend, "wasapi");
  assert.equal(deviceDiagnostics.payload.data.verificationHoldDrilldown.byRecommendedCapturePath[0].profile, "low-latency");
  assert.equal(deviceDiagnostics.payload.data.runtimeIssues.totalWarningNotices, 2);
  assert.equal(deviceDiagnostics.payload.data.runtimeIssues.topIssue.code, "NATIVE_CAPTURE_LOW_SIGNAL");
  assert.equal(deviceDiagnostics.payload.data.runtimeIssues.topIssue.issueClass, "signal-quality");
  assert.deepEqual(
    deviceDiagnostics.payload.data.runtimeIssues.classBreakdown.map((entry) => entry.issueClass).sort(),
    ["backend-routing", "signal-quality"]
  );
  assert.equal(deviceDiagnostics.payload.data.recommendedPath.backend, "wasapi");
  assert.equal(deviceDiagnostics.payload.data.recommendedPath.profile, "balanced");
  assert.equal(deviceDiagnostics.payload.data.scoredPaths[1].dominantWarningClass, "backend-routing");
  assert.equal(deviceDiagnostics.payload.data.recommendedPath.setupRecommendations[0].id, "keep-current-setup");
  assert.equal(deviceDiagnostics.payload.data.recommendedPath.primarySetupRecommendation.id, "keep-current-setup");
  assert.equal(deviceDiagnostics.payload.data.scoredPaths.length, 2);
  assert.equal(deviceDiagnostics.payload.data.scoredPaths[0].backend, "wasapi");
  assert.equal(deviceDiagnostics.payload.data.scoredPaths[1].primarySetupRecommendation.id, "prefer-wasapi");
  assert.equal(deviceDiagnostics.payload.data.recentSessions.length, 2);
  assert.equal(deviceDiagnostics.payload.data.recentSessions[0].trainingTitle, trainings.payload.data[0].title);
  assert.equal(deviceDiagnostics.payload.data.overrideHistory.length, 2);
  assert.equal(deviceDiagnostics.payload.data.overridePreferences.length, 2);

  const setupRecommendation = await requestJson(baseUrl, "/users/user-001/setup-recommendations", {
    method: "POST",
    body: JSON.stringify({
      deviceName: "Focusrite USB Input",
      backend: "wasapi",
      profile: "balanced",
      recommendationId: "keep-current-setup",
      recommendationTitle: "Keep current setup",
      recommendationDetail: "Current capture settings look healthy. No immediate input-chain change is suggested from recorded sessions.",
      source: "device-detail",
      baselineStabilityScore: 96,
      baselineSignalQualityScore: 100,
      baselineRuntimeStabilityScore: 100,
      baselineLatencyFitnessScore: 92
    })
  });

  assert.equal(setupRecommendation.status, 201);
  assert.equal(setupRecommendation.payload.data.setupRecommendation.status, "applied");
  assert.equal(setupRecommendation.payload.data.user.setupRecommendationHistory.length, 2);
  assert.equal(setupRecommendation.payload.data.user.setupRecommendationHistory[0].recommendationId, "keep-current-setup");

  const setupRecommendationEvaluation = await requestJson(
    baseUrl,
    `/users/user-001/setup-recommendations/${setupRecommendation.payload.data.setupRecommendation.id}/evaluation`,
    {
      method: "POST",
      body: JSON.stringify({
        outcome: "improved"
      })
    }
  );

  assert.equal(setupRecommendationEvaluation.status, 200);
  assert.equal(setupRecommendationEvaluation.payload.data.setupRecommendation.status, "improved");
  assert.ok(setupRecommendationEvaluation.payload.data.setupRecommendation.evaluatedAt);

  const diagnosticsJsonExport = await requestText(baseUrl, "/users/user-001/diagnostics/export?format=json");
  assert.equal(diagnosticsJsonExport.status, 200);
  assert.match(diagnosticsJsonExport.headers.get("content-type"), /application\/json/);
  assert.match(diagnosticsJsonExport.headers.get("content-disposition"), /riffrush-diagnostics-user-001\.json/);
  assert.equal(JSON.parse(diagnosticsJsonExport.body).insights.recommendedPath.backend, "wasapi");

  const updatedDashboard = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(updatedDashboard.status, 200);
  assert.equal(updatedDashboard.payload.data.setupRecommendationHistory.length, 2);
  assert.equal(updatedDashboard.payload.data.setupRecommendationHistory[0].status, "improved");
  assert.equal(updatedDashboard.payload.data.setupRecommendationHistory[0].recommendationTitle, "Keep current setup");
  assert.equal(updatedDashboard.payload.data.setupRecommendationHistory[0].baselineStabilityScore, 96);

  const diagnosticsAfterSetupFeedback = await requestJson(baseUrl, "/users/user-001/diagnostics");
  assert.equal(diagnosticsAfterSetupFeedback.status, 200);
  assert.equal(diagnosticsAfterSetupFeedback.payload.data.verificationHoldSetupFollowupSummary.trackedCount, 1);
  assert.equal(diagnosticsAfterSetupFeedback.payload.data.verificationHoldSetupFollowupSummary.improvedCount, 1);
  assert.equal(
    diagnosticsAfterSetupFeedback.payload.data.insights.recommendedPath.selectionSource,
    "technical-with-setup-feedback"
  );
  assert.equal(
    diagnosticsAfterSetupFeedback.payload.data.insights.recommendedPath.recommendationConfidenceScore,
    87
  );
  assert.equal(
    diagnosticsAfterSetupFeedback.payload.data.insights.recommendedPath.stabilityScore,
    97
  );
  assert.equal(
    diagnosticsAfterSetupFeedback.payload.data.insights.recommendedPath.setupFeedback.improvedCount,
    2
  );
  assert.equal(
    diagnosticsAfterSetupFeedback.payload.data.insights.deviceRecommendations[0].recommendedPath.selectionSource,
    "technical-with-setup-feedback"
  );
  assert.equal(
    diagnosticsAfterSetupFeedback.payload.data.insights.deviceRecommendations[0].recommendedPath.setupFeedback.appliedCount,
    2
  );

  const dashboardAfterSetupFeedback = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterSetupFeedback.status, 200);
  assert.equal(dashboardAfterSetupFeedback.payload.data.targetedPractice.recommendedTrainingTitle, "Single String Timing Foundations");
  assert.equal(dashboardAfterSetupFeedback.payload.data.targetedPractice.recommendedSectionLabel, "Ascending phrase");
  assert.match(dashboardAfterSetupFeedback.payload.data.targetedPractice.nextStep, /BPM/);

  for (const recoveryTempoBpm of [80, 82]) {
    const recoveryReturnSession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-001",
        tempoBpm: recoveryTempoBpm,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        recoveryGoalTrainingId: "training-003",
        recoveryGoalSectionId: "ladder-b",
        recoveryReturnTempoBpm: 90,
        recoveryReturnLoopRepetitionCount: 3,
        recoveryReturnLoopTempoStepBpm: 2,
        recoveryReason: "Zbierz stabilne recovery i dopiero potem wroc do Ladder B.",
        recoveryStrategy: "rebuild-base-tempo"
      })
    });

    assert.equal(recoveryReturnSession.status, 201);

    const recoveryReturnSummary = await requestJson(baseUrl, `/sessions/${recoveryReturnSession.payload.data.session.id}/summary`, {
      method: "POST",
      body: JSON.stringify({
        totalScore: 860,
        accuracy: 0.9,
        notesDetected: 16,
        notesHit: 15,
        scoreBreakdown: {
          tempoBpm: recoveryTempoBpm,
          targetCount: 16,
          matchedTargetCount: 15,
          unmatchedTargetCount: 1,
          noteHits: 15,
          stringHits: 15,
          timingHits: 14,
          fullHits: 13,
          sustainHits: 12,
          releaseHits: 12,
          fullComboHits: 10,
          earlyHitCount: 0,
          lateHitCount: 1,
          earlyReleaseCount: 0,
          overholdCount: 0,
          ghostNoteCount: 0,
          missedTargetCount: 1,
          maxCombo: 8,
          comboBreakCount: 1,
          multiplierPeak: 3,
          misses: 1,
          averageTimingOffsetMs: 12,
          maxTimingOffsetMs: 36,
          averageHoldCoverage: 0.92,
          averageReleaseOvershootMs: 4,
          maxReleaseOvershootMs: 8
        },
        practicePreset: {
          scope: "full-chart",
          tempoBpm: recoveryTempoBpm
        },
        rating: {
          grade: "A",
          label: "Recovery ready",
          clearType: "clean-clear",
          performanceScore: 88
        },
        feedback: {
          summary: "Recovery jest stabilne i gotowe na powrot do Ladder B.",
          focusAreas: ["Wroc do Ladder B z tym samym timingiem"],
          coachHints: [
            {
              id: "keep-current-approach",
              title: "Utrzymaj obecne ustawienie",
              detail: "Recovery jest ustabilizowane. Wroc do celu i utrzymaj ten sam puls.",
              severity: "low"
            }
          ]
        },
        capture: {
          source: "synthetic",
          profile: "balanced"
        },
        diagnostics: {
          notices: []
        }
      })
    });

    assert.equal(recoveryReturnSummary.status, 200);
  }

  const dashboardAfterRecoveryGoalReady = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterRecoveryGoalReady.status, 200);
  assert.equal(dashboardAfterRecoveryGoalReady.payload.data.targetedPractice.recoveryProgressStatus, "goal-ready");
  assert.equal(dashboardAfterRecoveryGoalReady.payload.data.targetedPractice.recommendedTrainingId, "training-003");
  assert.equal(dashboardAfterRecoveryGoalReady.payload.data.targetedPractice.action, "switch-training");
  assert.equal(dashboardAfterRecoveryGoalReady.payload.data.targetedPractice.suggestedTempoBpm, 90);

  const verificationHoldRecoverySession = await requestJson(baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-001",
      trainingId: "training-001",
      tempoBpm: 82,
      practiceScope: "full-chart",
      inputMode: "synthetic",
      recoveryGoalTrainingId: "training-003",
      recoveryGoalSectionId: "ladder-b",
      recoveryReturnTempoBpm: 90,
      recoveryReturnLoopRepetitionCount: 3,
      recoveryReturnLoopTempoStepBpm: 2,
      recoveryReason: "Zbierz stabilne recovery i dopiero potem wroc do Ladder B.",
      recoveryStrategy: "rebuild-base-tempo"
    })
  });

  assert.equal(verificationHoldRecoverySession.status, 201);

  const verificationHoldRecoverySummary = await requestJson(
    baseUrl,
    `/sessions/${verificationHoldRecoverySession.payload.data.session.id}/summary`,
    {
      method: "POST",
      body: JSON.stringify({
        totalScore: 840,
        accuracy: 0.89,
        notesDetected: 16,
        notesHit: 15,
        scoreBreakdown: {
          tempoBpm: 82,
          targetCount: 16,
          matchedTargetCount: 15,
          unmatchedTargetCount: 0,
          noteHits: 15,
          stringHits: 15,
          timingHits: 14,
          fullHits: 13,
          sustainHits: 12,
          releaseHits: 12,
          fullComboHits: 10,
          earlyHitCount: 0,
          lateHitCount: 1,
          earlyReleaseCount: 0,
          overholdCount: 0,
          ghostNoteCount: 0,
          missedTargetCount: 1,
          maxCombo: 8,
          comboBreakCount: 1,
          multiplierPeak: 3,
          misses: 1,
          averageTimingOffsetMs: 14,
          maxTimingOffsetMs: 38,
          averageHoldCoverage: 0.91,
          averageReleaseOvershootMs: 4,
          maxReleaseOvershootMs: 8
        },
        practicePreset: {
          scope: "full-chart",
          tempoBpm: 82
        },
        rating: {
          grade: "A",
          label: "Recovery mechanically warning",
          clearType: "clean-clear",
          performanceScore: 86
        },
        feedback: {
          summary: "Recovery nadal brzmi dobrze, ale verification ma warning i nie warto jeszcze wracac do Ladder B.",
          focusAreas: ["Powtorz jeszcze recovery bez warningu verification"],
          coachHints: [
            {
              id: "verification-clean-pass",
              title: "Zamknij clean verification",
              detail: "Ten przebieg ma jeszcze warning verification. Zagraj kolejny czysty recovery pass przed powrotem.",
              severity: "medium"
            }
          ]
        },
        capture: {
          source: "synthetic",
          profile: "balanced"
        },
        diagnostics: {
          notices: []
        }
      })
    }
  );

  assert.equal(verificationHoldRecoverySummary.status, 200);

  const dashboardAfterRecoveryVerificationHold = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterRecoveryVerificationHold.status, 200);
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.targetedPractice.recoveryProgressStatus,
    "goal-ready"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.targetedPractice.verificationGate.mode,
    "hold-current-stage"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.targetedPractice.verificationGate.heldRecoveryProgressStatus,
    "goal-ready"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.targetedPractice.verificationGate.suspectedOrigin,
    "progression-path"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.targetedPractice.verificationGate.technicalFallbackRouting,
    undefined
  );
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.targetedPractice.recommendedTrainingId, "training-001");
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.targetedPractice.action, "repeat-current");
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.targetedPractice.suggestedTempoBpm, 82);
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.progressionSafety.status, "hold");
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.progressionSafety.gateMode, "hold-current-stage");
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.progressionSafety.suspectedOrigin,
    "progression-path"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.progressionSafety.technicalFallbackRouting,
    undefined
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.progressionSafety.heldRecoveryProgressStatus,
    "goal-ready"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.progressionSafety.heldRecommendedTrainingId,
    "training-003"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.progressionSafety.currentRecommendedTrainingId,
    "training-001"
  );
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.verificationHoldSummary.holdSessionCount, 2);
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.verificationHoldSummary.suspectedOrigin, "mixed");
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.verificationHoldSummary.technicalHoldSessionCount, 1);
  assert.equal(dashboardAfterRecoveryVerificationHold.payload.data.verificationHoldSummary.progressionHoldSessionCount, 1);
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.verificationHoldSummary.byRecoveryProgressStatus[0].recoveryProgressStatus,
    "goal-ready"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.verificationHoldSummary.byRecoveryProgressStatus[1].recoveryProgressStatus,
    "general"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.verificationHoldSummary.byCaptureSource[0].captureSource,
    "synthetic"
  );
  assert.equal(
    dashboardAfterRecoveryVerificationHold.payload.data.verificationHoldSummary.byCaptureSource[1].captureSource,
    "native-capture"
  );

  for (const returnTempoBpm of [90, 90]) {
    const returnAttempt = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-003",
        tempoBpm: returnTempoBpm,
        practiceScope: "section-loop",
        loopSectionId: "ladder-b",
        loopRepetitionCount: 2,
        loopTempoStepBpm: 0,
        inputMode: "synthetic",
        returnRecoveryTrainingId: "training-001",
        returnGoalSectionId: "ladder-b",
        returnReason: "To kontrolowana proba powrotu do Ladder B po recovery."
      })
    });

    assert.equal(returnAttempt.status, 201);

    const returnAttemptSummary = await requestJson(baseUrl, `/sessions/${returnAttempt.payload.data.session.id}/summary`, {
      method: "POST",
      body: JSON.stringify({
        totalScore: 720,
        accuracy: 0.83,
        notesDetected: 12,
        notesHit: 10,
        scoreBreakdown: {
          tempoBpm: returnTempoBpm,
          targetCount: 12,
          matchedTargetCount: 10,
          unmatchedTargetCount: 2,
          noteHits: 10,
          stringHits: 10,
          timingHits: 9,
          fullHits: 8,
          sustainHits: 8,
          releaseHits: 7,
          fullComboHits: 6,
          earlyHitCount: 1,
          lateHitCount: 1,
          earlyReleaseCount: 1,
          overholdCount: 0,
          ghostNoteCount: 0,
          missedTargetCount: 1,
          maxCombo: 5,
          comboBreakCount: 2,
          multiplierPeak: 2,
          misses: 2,
          averageTimingOffsetMs: 18,
          maxTimingOffsetMs: 52,
          averageHoldCoverage: 0.86,
          averageReleaseOvershootMs: 6,
          maxReleaseOvershootMs: 10
        },
        practicePreset: {
          scope: "section-loop",
          tempoBpm: returnTempoBpm,
          loopSectionId: "ladder-b",
          loopSectionLabel: "Ladder B",
          loopRepetitionCount: 2,
          loopTempoStepBpm: 0
        },
        rating: {
          grade: "B",
          label: "Return stable",
          clearType: "clear",
          performanceScore: 78
        },
        feedback: {
          summary: "Powrot do Ladder B trzyma stabilnosc i mozna zaczac znowu podnosic trudnosc.",
          focusAreas: ["Podnies tempo w kontrolowany sposob"],
          coachHints: [
            {
              id: "keep-current-approach",
              title: "Utrzymaj obecne ustawienie",
              detail: "Return jest stabilny. Wejdz w kontrolowany ramp tempa.",
              severity: "low"
            }
          ]
        },
        capture: {
          source: "synthetic",
          profile: "balanced"
        },
        diagnostics: {
          notices: []
        }
      })
    });

    assert.equal(returnAttemptSummary.status, 200);
  }

  const dashboardAfterReturnConfirmation = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterReturnConfirmation.status, 200);
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.recommendedTrainingId, "training-003");
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.recoveryProgressStatus, "return-confirmed");
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.returnMilestone.stableReturnSessionCount, 2);
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.returnRamp.mode, "raise-section-tempo");
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.returnRamp.targetTempoBpm, 94);
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.suggestedTempoBpm, 94);
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.loopRepetitionCount, 3);
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.loopTempoStepBpm, 2);
  assert.equal(dashboardAfterReturnConfirmation.payload.data.targetedPractice.practiceSectionMode, "return-confirmed-section");
  assert.match(dashboardAfterReturnConfirmation.payload.data.targetedPractice.nextStep, /94 BPM/);

  const chartExpansionSession = await requestJson(baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-001",
      trainingId: "training-003",
      tempoBpm: 94,
      practiceScope: "section-loop",
      loopSectionId: "ladder-b",
      loopRepetitionCount: 3,
      loopTempoStepBpm: 2,
      inputMode: "synthetic",
      returnRecoveryTrainingId: "training-001",
      returnGoalSectionId: "ladder-b",
      returnReason: "Kontrolowany ramp po potwierdzonym powrocie do Ladder B."
    })
  });

  assert.equal(chartExpansionSession.status, 201);

  const chartExpansionSummary = await requestJson(baseUrl, `/sessions/${chartExpansionSession.payload.data.session.id}/summary`, {
    method: "POST",
    body: JSON.stringify({
      totalScore: 810,
      accuracy: 0.9,
      notesDetected: 12,
      notesHit: 11,
      scoreBreakdown: {
        tempoBpm: 94,
        targetCount: 12,
        matchedTargetCount: 11,
        unmatchedTargetCount: 1,
        noteHits: 11,
        stringHits: 11,
        timingHits: 10,
        fullHits: 9,
        sustainHits: 9,
        releaseHits: 8,
        fullComboHits: 7,
        earlyHitCount: 1,
        lateHitCount: 1,
        earlyReleaseCount: 0,
        overholdCount: 0,
        ghostNoteCount: 0,
        missedTargetCount: 1,
        maxCombo: 6,
        comboBreakCount: 1,
        multiplierPeak: 2,
        misses: 1,
        averageTimingOffsetMs: 16,
        maxTimingOffsetMs: 44,
        averageHoldCoverage: 0.88,
        averageReleaseOvershootMs: 5,
        maxReleaseOvershootMs: 9
      },
      practicePreset: {
        scope: "section-loop",
        tempoBpm: 94,
        loopSectionId: "ladder-b",
        loopSectionLabel: "Ladder B",
        loopRepetitionCount: 3,
        loopTempoStepBpm: 2
      },
      rating: {
        grade: "A",
        label: "Ramp stable",
        clearType: "clean-clear",
        performanceScore: 86
      },
      feedback: {
        summary: "Sekcja trzyma sie juz stabilnie po rampie i jest gotowa na rozszerzenie chartu.",
        focusAreas: ["Rozszerz zakres na caly chart"],
        coachHints: [
          {
            id: "keep-current-approach",
            title: "Utrzymaj obecne ustawienie",
            detail: "Sekcja jest stabilna po rampie. Rozszerz trening na caly chart.",
            severity: "low"
          }
        ]
      },
      capture: {
        source: "synthetic",
        profile: "balanced"
      },
      diagnostics: {
        notices: []
      }
    })
  });

  assert.equal(chartExpansionSummary.status, 200);

  const dashboardAfterChartExpansion = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterChartExpansion.status, 200);
  assert.equal(dashboardAfterChartExpansion.payload.data.targetedPractice.recoveryProgressStatus, "return-confirmed");
  assert.equal(dashboardAfterChartExpansion.payload.data.targetedPractice.chartExpansion.mode, "expand-to-full-chart");
  assert.equal(dashboardAfterChartExpansion.payload.data.targetedPractice.chartExpansion.targetScope, "full-chart");
  assert.equal(dashboardAfterChartExpansion.payload.data.targetedPractice.chartExpansion.targetTempoBpm, 92);
  assert.equal(dashboardAfterChartExpansion.payload.data.targetedPractice.practiceScopeOverride, "full-chart");
  assert.equal(dashboardAfterChartExpansion.payload.data.targetedPractice.suggestedTempoBpm, 92);
  assert.equal(dashboardAfterChartExpansion.payload.data.targetedPractice.sectionAction, "expand-to-full-chart");
  assert.match(dashboardAfterChartExpansion.payload.data.targetedPractice.nextStep, /caly chart/);

  for (const fullChartTempoBpm of [92, 92]) {
    const fullChartReintegrationSession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-003",
        tempoBpm: fullChartTempoBpm,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        returnRecoveryTrainingId: "training-001",
        returnGoalSectionId: "ladder-b",
        returnReason: "Pelny chart po chart expansion jest teraz w trakcie reintegracji."
      })
    });

    assert.equal(fullChartReintegrationSession.status, 201);

    const fullChartReintegrationSummary = await requestJson(
      baseUrl,
      `/sessions/${fullChartReintegrationSession.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 960,
          accuracy: 0.91,
          notesDetected: 24,
          notesHit: 22,
          scoreBreakdown: {
            tempoBpm: fullChartTempoBpm,
            targetCount: 24,
            matchedTargetCount: 22,
            unmatchedTargetCount: 2,
            noteHits: 22,
            stringHits: 22,
            timingHits: 20,
            fullHits: 18,
            sustainHits: 17,
            releaseHits: 16,
            fullComboHits: 14,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 1,
            overholdCount: 0,
            ghostNoteCount: 0,
            missedTargetCount: 0,
            maxCombo: 9,
            comboBreakCount: 2,
            multiplierPeak: 3,
            misses: 2,
            averageTimingOffsetMs: 15,
            maxTimingOffsetMs: 46,
            averageHoldCoverage: 0.9,
            averageReleaseOvershootMs: 5,
            maxReleaseOvershootMs: 9
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: fullChartTempoBpm
          },
          rating: {
            grade: "A",
            label: "Full chart stable",
            clearType: "clean-clear",
            performanceScore: 88
          },
          feedback: {
            summary: "Pelny chart trzyma sie stabilnie po rozszerzeniu sekcji.",
            focusAreas: ["Mozesz dalej podnosic tempo calego chartu"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Pelny chart jest stabilny. Zacznij znowu kontrolowany wzrost tempa.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(fullChartReintegrationSummary.status, 200);
  }

  const dashboardAfterFullChartReintegration = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterFullChartReintegration.status, 200);
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.recoveryProgressStatus, "full-chart-reintegrated");
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.action, "switch-training");
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.recommendedTrainingId, "training-002");
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.promotionTargetTrainingId, "training-002");
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.promotionTargetTrainingTitle, "Alternate Picking Basics");
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.promotionTargetDifficulty, "beginner");
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.practiceScopeOverride, "full-chart");
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.fullChartReintegrationMilestone.stableFullChartSessionCount, 2);
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.fullChartReintegrationRamp.mode, "raise-full-chart-tempo");
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.fullChartReintegrationRamp.targetTempoBpm, 96);
  assert.equal(dashboardAfterFullChartReintegration.payload.data.targetedPractice.suggestedTempoBpm, 95);
  assert.match(dashboardAfterFullChartReintegration.payload.data.targetedPractice.nextStep, /Alternate Picking Basics/);

  const promotionLandingContext = dashboardAfterFullChartReintegration.payload.data.targetedPractice;

  for (let landingIndex = 0; landingIndex < 2; landingIndex += 1) {
    const promotionLandingSession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-002",
        tempoBpm: 95,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: promotionLandingContext.promotionSourceTrainingId,
        promotionSourceTempoBpm: promotionLandingContext.promotionSourceTempoBpm,
        promotionReason: promotionLandingContext.promotionTargetReason
      })
    });

    assert.equal(promotionLandingSession.status, 201);

    const promotionLandingSummary = await requestJson(
      baseUrl,
      `/sessions/${promotionLandingSession.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 875 + (landingIndex * 15),
          accuracy: 0.84 + (landingIndex * 0.01),
          notesDetected: 20,
          notesHit: 17 + landingIndex,
          scoreBreakdown: {
            tempoBpm: 95,
            targetCount: 20,
            matchedTargetCount: 18 + landingIndex,
            unmatchedTargetCount: 2 - landingIndex,
            noteHits: 17 + landingIndex,
            stringHits: 17 + landingIndex,
            timingHits: 16 + landingIndex,
            fullHits: 15 + landingIndex,
            sustainHits: 15 + landingIndex,
            releaseHits: 14 + landingIndex,
            fullComboHits: 11 + landingIndex,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 1,
            overholdCount: 0,
            ghostNoteCount: 1,
            missedTargetCount: 1,
            maxCombo: 7 + landingIndex,
            comboBreakCount: 1,
            multiplierPeak: 3,
            misses: 2,
            averageTimingOffsetMs: 17,
            maxTimingOffsetMs: 48,
            averageHoldCoverage: 0.87,
            averageReleaseOvershootMs: 5,
            maxReleaseOvershootMs: 9
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 95
          },
          rating: {
            grade: "B",
            label: "Promotion landing stable",
            clearType: "clear",
            performanceScore: 81 + (landingIndex * 2)
          },
          feedback: {
            summary: "Nowy trening trzyma stabilnosc i wyglada na sensowny po promocji.",
            focusAreas: ["Utrzymaj rowny timing na nowym materiale"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Landing na nowym treningu jest stabilny. Utrzymaj ten sam puls przez kolejne przebiegi.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(promotionLandingSummary.status, 200);
  }

  const dashboardAfterPromotionLanding = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterPromotionLanding.status, 200);
  assert.equal(dashboardAfterPromotionLanding.payload.data.targetedPractice.recoveryProgressStatus, "promotion-landing-confirmed");
  assert.equal(dashboardAfterPromotionLanding.payload.data.targetedPractice.recommendedTrainingId, "training-002");
  assert.equal(dashboardAfterPromotionLanding.payload.data.targetedPractice.action, "repeat-current");
  assert.equal(
    dashboardAfterPromotionLanding.payload.data.targetedPractice.promotionLandingMilestone.stablePromotionLandingSessionCount,
    2
  );
  assert.equal(
    dashboardAfterPromotionLanding.payload.data.targetedPractice.promotionLandingMilestone.requiredStablePromotionLandingSessions,
    2
  );
  assert.equal(dashboardAfterPromotionLanding.payload.data.targetedPractice.promotionRamp.mode, "raise-promoted-tempo");
  assert.equal(dashboardAfterPromotionLanding.payload.data.targetedPractice.promotionRamp.baseTempoBpm, 95);
  assert.equal(dashboardAfterPromotionLanding.payload.data.targetedPractice.promotionRamp.targetTempoBpm, 99);
  assert.equal(dashboardAfterPromotionLanding.payload.data.targetedPractice.suggestedTempoBpm, 99);
  assert.match(dashboardAfterPromotionLanding.payload.data.targetedPractice.nextStep, /Alternate Picking Basics/);

  const promotionRampContext = dashboardAfterPromotionLanding.payload.data.targetedPractice;

  for (let rampIndex = 0; rampIndex < 2; rampIndex += 1) {
    const promotionRampSession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-002",
        tempoBpm: 99,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: promotionRampContext.promotionSourceTrainingId,
        promotionSourceTempoBpm: promotionRampContext.promotionSourceTempoBpm,
        promotionPhase: "ramp",
        promotionRampBaseTempoBpm: promotionRampContext.promotionRamp.baseTempoBpm,
        promotionRampTargetTempoBpm: promotionRampContext.promotionRamp.targetTempoBpm,
        promotionReason: promotionRampContext.promotionTargetReason
      })
    });

    assert.equal(promotionRampSession.status, 201);

    const promotionRampSummary = await requestJson(
      baseUrl,
      `/sessions/${promotionRampSession.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 910 + (rampIndex * 10),
          accuracy: 0.86 + (rampIndex * 0.01),
          notesDetected: 20,
          notesHit: 18 + rampIndex,
          scoreBreakdown: {
            tempoBpm: 99,
            targetCount: 20,
            matchedTargetCount: 19,
            unmatchedTargetCount: 1,
            noteHits: 18 + rampIndex,
            stringHits: 18 + rampIndex,
            timingHits: 17 + rampIndex,
            fullHits: 16 + rampIndex,
            sustainHits: 16 + rampIndex,
            releaseHits: 15 + rampIndex,
            fullComboHits: 13 + rampIndex,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 1,
            overholdCount: 0,
            ghostNoteCount: 0,
            missedTargetCount: 1,
            maxCombo: 8 + rampIndex,
            comboBreakCount: 1,
            multiplierPeak: 3,
            misses: 1,
            averageTimingOffsetMs: 15,
            maxTimingOffsetMs: 44,
            averageHoldCoverage: 0.89,
            averageReleaseOvershootMs: 4,
            maxReleaseOvershootMs: 8
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 99
          },
          rating: {
            grade: "A",
            label: "Promotion ramp stable",
            clearType: "clean-clear",
            performanceScore: 86 + (rampIndex * 2)
          },
          feedback: {
            summary: "Ramp po awansie trzyma sie stabilnie i mozna dalej podnosic tempo.",
            focusAreas: ["Utrzymaj jakosc na wyzszym BPM"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Nowe BPM trzyma sie stabilnie. Mozna wejsc w kolejny kontrolowany skok.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(promotionRampSummary.status, 200);
  }

  const dashboardAfterPromotionRamp = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterPromotionRamp.status, 200);
  assert.equal(dashboardAfterPromotionRamp.payload.data.targetedPractice.recoveryProgressStatus, "promotion-ramp-confirmed");
  assert.equal(dashboardAfterPromotionRamp.payload.data.targetedPractice.recommendedTrainingId, "training-002");
  assert.equal(dashboardAfterPromotionRamp.payload.data.targetedPractice.promotionRampMilestone.stablePromotionRampSessionCount, 2);
  assert.equal(dashboardAfterPromotionRamp.payload.data.targetedPractice.promotionRampMilestone.requiredStablePromotionRampSessions, 2);
  assert.equal(dashboardAfterPromotionRamp.payload.data.targetedPractice.promotionRamp.mode, "raise-promoted-tempo");
  assert.equal(dashboardAfterPromotionRamp.payload.data.targetedPractice.promotionRamp.baseTempoBpm, 99);
  assert.equal(dashboardAfterPromotionRamp.payload.data.targetedPractice.promotionRamp.targetTempoBpm, 103);
  assert.equal(dashboardAfterPromotionRamp.payload.data.targetedPractice.suggestedTempoBpm, 103);
  assert.match(dashboardAfterPromotionRamp.payload.data.targetedPractice.nextStep, /103 BPM/);

  const promotionGraduationContext = dashboardAfterPromotionRamp.payload.data.targetedPractice;

  for (let graduationRampIndex = 0; graduationRampIndex < 2; graduationRampIndex += 1) {
    const promotionGraduationRampSession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-002",
        tempoBpm: 103,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: promotionGraduationContext.promotionSourceTrainingId,
        promotionSourceTempoBpm: promotionGraduationContext.promotionSourceTempoBpm,
        promotionPhase: "ramp",
        promotionRampBaseTempoBpm: promotionGraduationContext.promotionRamp.baseTempoBpm,
        promotionRampTargetTempoBpm: promotionGraduationContext.promotionRamp.targetTempoBpm,
        promotionReason: promotionGraduationContext.promotionTargetReason
      })
    });

    assert.equal(promotionGraduationRampSession.status, 201);

    const promotionGraduationRampSummary = await requestJson(
      baseUrl,
      `/sessions/${promotionGraduationRampSession.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 930 + (graduationRampIndex * 10),
          accuracy: 0.88 + (graduationRampIndex * 0.01),
          notesDetected: 20,
          notesHit: 19,
          scoreBreakdown: {
            tempoBpm: 103,
            targetCount: 20,
            matchedTargetCount: 19,
            unmatchedTargetCount: 1,
            noteHits: 19,
            stringHits: 19,
            timingHits: 18,
            fullHits: 17,
            sustainHits: 17,
            releaseHits: 16,
            fullComboHits: 14,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 0,
            overholdCount: 0,
            ghostNoteCount: 0,
            missedTargetCount: 1,
            maxCombo: 9,
            comboBreakCount: 1,
            multiplierPeak: 3,
            misses: 1,
            averageTimingOffsetMs: 14,
            maxTimingOffsetMs: 41,
            averageHoldCoverage: 0.9,
            averageReleaseOvershootMs: 4,
            maxReleaseOvershootMs: 7
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 103
          },
          rating: {
            grade: "A",
            label: "Promotion tier confirmed",
            clearType: "clean-clear",
            performanceScore: 89 + graduationRampIndex
          },
          feedback: {
            summary: "Kolejny prog BPM na promowanym treningu jest juz zamkniety.",
            focusAreas: ["Przenies stabilnosc na kolejny material"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Ten poziom BPM jest ustabilizowany. Mozesz przejsc dalej.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(promotionGraduationRampSummary.status, 200);
  }

  const dashboardAfterPromotionGraduation = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterPromotionGraduation.status, 200);
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.recoveryProgressStatus, "promotion-graduated");
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.action, "switch-training");
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.recommendedTrainingId, "training-003");
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.promotionTrackMilestone.confirmedRampTierCount, 2);
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.promotionTrackMilestone.requiredConfirmedRampTiers, 2);
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.promotionGraduation.targetTrainingId, "training-003");
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.promotionGraduation.targetTrainingTitle, "Timing Control Ladder");
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.promotionGraduation.targetTempoBpm, 106);
  assert.equal(dashboardAfterPromotionGraduation.payload.data.targetedPractice.suggestedTempoBpm, 106);
  assert.match(dashboardAfterPromotionGraduation.payload.data.targetedPractice.nextStep, /Timing Control Ladder/);

  const promotionReentryContext = dashboardAfterPromotionGraduation.payload.data.targetedPractice;

  for (let reentryIndex = 0; reentryIndex < 2; reentryIndex += 1) {
    const promotionReentrySession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-003",
        tempoBpm: 106,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: promotionReentryContext.promotionSourceTrainingId,
        promotionSourceTempoBpm: promotionReentryContext.promotionSourceTempoBpm,
        promotionPhase: "reentry",
        promotionReason: promotionReentryContext.promotionGraduation.reason
      })
    });

    assert.equal(promotionReentrySession.status, 201);

    const promotionReentrySummary = await requestJson(
      baseUrl,
      `/sessions/${promotionReentrySession.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 970 + (reentryIndex * 10),
          accuracy: 0.84 + (reentryIndex * 0.01),
          notesDetected: 24,
          notesHit: 21 + reentryIndex,
          scoreBreakdown: {
            tempoBpm: 106,
            targetCount: 24,
            matchedTargetCount: 22,
            unmatchedTargetCount: 2,
            noteHits: 21 + reentryIndex,
            stringHits: 21 + reentryIndex,
            timingHits: 20 + reentryIndex,
            fullHits: 18 + reentryIndex,
            sustainHits: 18 + reentryIndex,
            releaseHits: 17 + reentryIndex,
            fullComboHits: 15 + reentryIndex,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 1,
            overholdCount: 0,
            ghostNoteCount: 1,
            missedTargetCount: 1,
            maxCombo: 10 + reentryIndex,
            comboBreakCount: 1,
            multiplierPeak: 3,
            misses: 2,
            averageTimingOffsetMs: 15,
            maxTimingOffsetMs: 43,
            averageHoldCoverage: 0.9,
            averageReleaseOvershootMs: 4,
            maxReleaseOvershootMs: 8
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 106
          },
          rating: {
            grade: "B",
            label: "Promotion re-entry stable",
            clearType: "clear",
            performanceScore: 84 + reentryIndex
          },
          feedback: {
            summary: "Wejscie z treningu pomostowego z powrotem na docelowy material jest stabilne.",
            focusAreas: ["Utrzymaj transfer progresu na docelowym materiale"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Transfer na docelowy material sie utrzymuje. Mozesz zostac na tym treningu.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(promotionReentrySummary.status, 200);
  }

  const dashboardAfterPromotionReentry = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterPromotionReentry.status, 200);
  assert.equal(dashboardAfterPromotionReentry.payload.data.targetedPractice.recoveryProgressStatus, "promotion-reentry-confirmed");
  assert.equal(dashboardAfterPromotionReentry.payload.data.targetedPractice.recommendedTrainingId, "training-003");
  assert.equal(dashboardAfterPromotionReentry.payload.data.targetedPractice.action, "repeat-current");
  assert.equal(
    dashboardAfterPromotionReentry.payload.data.targetedPractice.promotionReentryMilestone.stablePromotionReentrySessionCount,
    2
  );
  assert.equal(
    dashboardAfterPromotionReentry.payload.data.targetedPractice.promotionReentryMilestone.requiredStablePromotionReentrySessions,
    2
  );
  assert.equal(dashboardAfterPromotionReentry.payload.data.targetedPractice.recoveryProgressStatus, "promotion-reentry-confirmed");
  assert.equal(dashboardAfterPromotionReentry.payload.data.targetedPractice.promotionChain.mode, "raise-target-training-tempo");
  assert.equal(dashboardAfterPromotionReentry.payload.data.targetedPractice.promotionChain.baseTempoBpm, 106);
  assert.equal(dashboardAfterPromotionReentry.payload.data.targetedPractice.promotionChain.targetTempoBpm, 110);
  assert.equal(dashboardAfterPromotionReentry.payload.data.targetedPractice.suggestedTempoBpm, 110);
  assert.match(dashboardAfterPromotionReentry.payload.data.targetedPractice.nextStep, /110 BPM/);

  const promotionChainContext = dashboardAfterPromotionReentry.payload.data.targetedPractice;

  for (let chainIndex = 0; chainIndex < 2; chainIndex += 1) {
    const promotionChainSession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-003",
        tempoBpm: 110,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: promotionChainContext.promotionSourceTrainingId,
        promotionSourceTempoBpm: promotionChainContext.promotionSourceTempoBpm,
        promotionPhase: "chain-validation",
        promotionChainBaseTempoBpm: promotionChainContext.promotionChain.baseTempoBpm,
        promotionChainTargetTempoBpm: promotionChainContext.promotionChain.targetTempoBpm,
        promotionReason: promotionChainContext.promotionTargetReason
      })
    });

    assert.equal(promotionChainSession.status, 201);

    const promotionChainSummary = await requestJson(
      baseUrl,
      `/sessions/${promotionChainSession.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 990 + (chainIndex * 10),
          accuracy: 0.86 + (chainIndex * 0.01),
          notesDetected: 24,
          notesHit: 22 + chainIndex,
          scoreBreakdown: {
            tempoBpm: 110,
            targetCount: 24,
            matchedTargetCount: 23,
            unmatchedTargetCount: 1,
            noteHits: 22 + chainIndex,
            stringHits: 22 + chainIndex,
            timingHits: 21 + chainIndex,
            fullHits: 19 + chainIndex,
            sustainHits: 19 + chainIndex,
            releaseHits: 18 + chainIndex,
            fullComboHits: 16 + chainIndex,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 0,
            overholdCount: 0,
            ghostNoteCount: 0,
            missedTargetCount: 1,
            maxCombo: 11 + chainIndex,
            comboBreakCount: 1,
            multiplierPeak: 4,
            misses: 1,
            averageTimingOffsetMs: 13,
            maxTimingOffsetMs: 39,
            averageHoldCoverage: 0.92,
            averageReleaseOvershootMs: 4,
            maxReleaseOvershootMs: 7
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 110
          },
          rating: {
            grade: "A",
            label: "Promotion chain stable",
            clearType: "clean-clear",
            performanceScore: 87 + chainIndex
          },
          feedback: {
            summary: "Kolejny chain step na docelowym treningu jest stabilny.",
            focusAreas: ["Buduj kolejny krok progresji na tym samym materiale"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Chain step jest stabilny. Mozesz wejsc w kolejny kontrolowany skok BPM.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(promotionChainSummary.status, 200);
  }

  const dashboardAfterPromotionChain = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterPromotionChain.status, 200);
  assert.equal(dashboardAfterPromotionChain.payload.data.targetedPractice.recoveryProgressStatus, "promotion-chain-confirmed");
  assert.equal(dashboardAfterPromotionChain.payload.data.targetedPractice.recommendedTrainingId, "training-003");
  assert.equal(dashboardAfterPromotionChain.payload.data.targetedPractice.promotionChainMilestone.stablePromotionChainSessionCount, 2);
  assert.equal(dashboardAfterPromotionChain.payload.data.targetedPractice.promotionChainMilestone.requiredStablePromotionChainSessions, 2);
  assert.equal(dashboardAfterPromotionChain.payload.data.targetedPractice.promotionChain.mode, "raise-target-training-tempo");
  assert.equal(dashboardAfterPromotionChain.payload.data.targetedPractice.promotionChain.baseTempoBpm, 110);
  assert.equal(dashboardAfterPromotionChain.payload.data.targetedPractice.promotionChain.targetTempoBpm, 114);
  assert.equal(dashboardAfterPromotionChain.payload.data.targetedPractice.suggestedTempoBpm, 114);
  assert.match(dashboardAfterPromotionChain.payload.data.targetedPractice.nextStep, /114 BPM/);

  const promotionChainGraduationContext = dashboardAfterPromotionChain.payload.data.targetedPractice;

  for (let chainGraduationIndex = 0; chainGraduationIndex < 2; chainGraduationIndex += 1) {
    const promotionChainGraduationSession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-003",
        tempoBpm: 114,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: promotionChainGraduationContext.promotionSourceTrainingId,
        promotionSourceTempoBpm: promotionChainGraduationContext.promotionSourceTempoBpm,
        promotionPhase: "chain-validation",
        promotionChainBaseTempoBpm: promotionChainGraduationContext.promotionChain.baseTempoBpm,
        promotionChainTargetTempoBpm: promotionChainGraduationContext.promotionChain.targetTempoBpm,
        promotionReason: promotionChainGraduationContext.promotionTargetReason
      })
    });

    assert.equal(promotionChainGraduationSession.status, 201);

    const promotionChainGraduationSummary = await requestJson(
      baseUrl,
      `/sessions/${promotionChainGraduationSession.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 1010 + (chainGraduationIndex * 10),
          accuracy: 0.87 + (chainGraduationIndex * 0.01),
          notesDetected: 24,
          notesHit: 22 + chainGraduationIndex,
          scoreBreakdown: {
            tempoBpm: 114,
            targetCount: 24,
            matchedTargetCount: 23,
            unmatchedTargetCount: 1,
            noteHits: 22 + chainGraduationIndex,
            stringHits: 22 + chainGraduationIndex,
            timingHits: 21 + chainGraduationIndex,
            fullHits: 20 + chainGraduationIndex,
            sustainHits: 20 + chainGraduationIndex,
            releaseHits: 19 + chainGraduationIndex,
            fullComboHits: 17 + chainGraduationIndex,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 0,
            overholdCount: 0,
            ghostNoteCount: 0,
            missedTargetCount: 1,
            maxCombo: 12 + chainGraduationIndex,
            comboBreakCount: 1,
            multiplierPeak: 4,
            misses: 1,
            averageTimingOffsetMs: 12,
            maxTimingOffsetMs: 35,
            averageHoldCoverage: 0.93,
            averageReleaseOvershootMs: 4,
            maxReleaseOvershootMs: 7
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 114
          },
          rating: {
            grade: "A",
            label: "Promotion chain graduation stable",
            clearType: "clean-clear",
            performanceScore: 89 + chainGraduationIndex
          },
          feedback: {
            summary: "Chain na docelowym treningu zostal ustabilizowany na kolejnym progu BPM.",
            focusAreas: ["Domknij blok chain i podnies sufit tempa"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Kolejny tier chain jest juz stabilny. Mozesz zamknac ten blok progresji.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(promotionChainGraduationSummary.status, 200);
  }

  const dashboardAfterPromotionChainGraduation = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterPromotionChainGraduation.status, 200);
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.recoveryProgressStatus, "promotion-chain-graduated");
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.recommendedTrainingId, "training-003");
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.action, "repeat-current");
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.promotionChainTrackMilestone.confirmedPromotionChainTierCount, 2);
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.promotionChainTrackMilestone.requiredConfirmedPromotionChainTiers, 2);
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.promotionChainGraduation.mode, "raise-terminal-training-ceiling");
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.promotionChainGraduation.targetTrainingId, "training-003");
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.promotionChainGraduation.targetTempoBpm, 118);
  assert.equal(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.suggestedTempoBpm, 118);
  assert.match(dashboardAfterPromotionChainGraduation.payload.data.targetedPractice.nextStep, /118 BPM/);

  const promotionChainCeilingContext = dashboardAfterPromotionChainGraduation.payload.data.targetedPractice;

  for (let chainCeilingIndex = 0; chainCeilingIndex < 2; chainCeilingIndex += 1) {
    const promotionChainCeilingSession = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-003",
        tempoBpm: 118,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: promotionChainCeilingContext.promotionSourceTrainingId,
        promotionSourceTempoBpm: promotionChainCeilingContext.promotionSourceTempoBpm,
        promotionPhase: "chain-graduation",
        promotionChainBaseTempoBpm: promotionChainCeilingContext.promotionChainGraduation.baseTempoBpm,
        promotionChainTargetTempoBpm: promotionChainCeilingContext.promotionChainGraduation.targetTempoBpm,
        promotionReason: promotionChainCeilingContext.promotionTargetReason
      })
    });

    assert.equal(promotionChainCeilingSession.status, 201);

    const promotionChainCeilingSummary = await requestJson(
      baseUrl,
      `/sessions/${promotionChainCeilingSession.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 1030 + (chainCeilingIndex * 10),
          accuracy: 0.88 + (chainCeilingIndex * 0.01),
          notesDetected: 24,
          notesHit: 23 + chainCeilingIndex,
          scoreBreakdown: {
            tempoBpm: 118,
            targetCount: 24,
            matchedTargetCount: 23,
            unmatchedTargetCount: 1,
            noteHits: 23 + chainCeilingIndex,
            stringHits: 23 + chainCeilingIndex,
            timingHits: 22 + chainCeilingIndex,
            fullHits: 20 + chainCeilingIndex,
            sustainHits: 20 + chainCeilingIndex,
            releaseHits: 19 + chainCeilingIndex,
            fullComboHits: 18 + chainCeilingIndex,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 0,
            overholdCount: 0,
            ghostNoteCount: 0,
            missedTargetCount: 1,
            maxCombo: 13 + chainCeilingIndex,
            comboBreakCount: 1,
            multiplierPeak: 4,
            misses: 1,
            averageTimingOffsetMs: 11,
            maxTimingOffsetMs: 34,
            averageHoldCoverage: 0.94,
            averageReleaseOvershootMs: 4,
            maxReleaseOvershootMs: 6
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 118
          },
          rating: {
            grade: "A",
            label: "Promotion chain ceiling stable",
            clearType: "clean-clear",
            performanceScore: 91 + chainCeilingIndex
          },
          feedback: {
            summary: "Podniesiony sufit po chain graduation utrzymuje sie stabilnie.",
            focusAreas: ["Utrzymaj nowy sufit tempa"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Nowy sufit BPM sie utrzymuje. Mozesz przygotowac kolejny skok.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(promotionChainCeilingSummary.status, 200);
  }

  const dashboardAfterPromotionChainCeiling = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterPromotionChainCeiling.status, 200);
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.recoveryProgressStatus, "terminal-training-mastery");
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.recommendedTrainingId, "training-003");
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.action, "repeat-current");
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.promotionChainGraduationMilestone.stablePromotionChainGraduationSessionCount, 2);
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.promotionChainGraduationMilestone.requiredStablePromotionChainGraduationSessions, 2);
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.terminalTrainingMasteryTrack.confirmedTerminalTierCount, 1);
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.terminalTrainingMasteryTrack.requiredConfirmedTerminalTiers, 3);
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.promotionChainGraduation.mode, "raise-terminal-training-ceiling");
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.promotionChainGraduation.baseTempoBpm, 118);
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.promotionChainGraduation.targetTempoBpm, 122);
  assert.equal(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.suggestedTempoBpm, 122);
  assert.match(dashboardAfterPromotionChainCeiling.payload.data.targetedPractice.nextStep, /122 BPM/);

  const terminalMastery122Context = dashboardAfterPromotionChainCeiling.payload.data.targetedPractice;

  for (let terminalTier122Index = 0; terminalTier122Index < 2; terminalTier122Index += 1) {
    const terminalTier122Session = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-003",
        tempoBpm: 122,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: terminalMastery122Context.promotionSourceTrainingId,
        promotionSourceTempoBpm: terminalMastery122Context.promotionSourceTempoBpm,
        promotionPhase: "chain-graduation",
        promotionChainBaseTempoBpm: terminalMastery122Context.promotionChainGraduation.baseTempoBpm,
        promotionChainTargetTempoBpm: terminalMastery122Context.promotionChainGraduation.targetTempoBpm,
        promotionReason: terminalMastery122Context.promotionTargetReason
      })
    });

    assert.equal(terminalTier122Session.status, 201);

    const terminalTier122Summary = await requestJson(
      baseUrl,
      `/sessions/${terminalTier122Session.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 1050 + (terminalTier122Index * 10),
          accuracy: 0.89 + (terminalTier122Index * 0.005),
          notesDetected: 24,
          notesHit: 23 + terminalTier122Index,
          scoreBreakdown: {
            tempoBpm: 122,
            targetCount: 24,
            matchedTargetCount: 23,
            unmatchedTargetCount: 1,
            noteHits: 23 + terminalTier122Index,
            stringHits: 23 + terminalTier122Index,
            timingHits: 22 + terminalTier122Index,
            fullHits: 21 + terminalTier122Index,
            sustainHits: 21 + terminalTier122Index,
            releaseHits: 20 + terminalTier122Index,
            fullComboHits: 18 + terminalTier122Index,
            earlyHitCount: 1,
            lateHitCount: 1,
            earlyReleaseCount: 0,
            overholdCount: 0,
            ghostNoteCount: 0,
            missedTargetCount: 1,
            maxCombo: 14 + terminalTier122Index,
            comboBreakCount: 1,
            multiplierPeak: 4,
            misses: 1,
            averageTimingOffsetMs: 11,
            maxTimingOffsetMs: 33,
            averageHoldCoverage: 0.95,
            averageReleaseOvershootMs: 3,
            maxReleaseOvershootMs: 6
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 122
          },
          rating: {
            grade: "A",
            label: "Terminal mastery tier 122 stable",
            clearType: "clean-clear",
            performanceScore: 92 + terminalTier122Index
          },
          feedback: {
            summary: "Kolejny terminal tier utrzymuje sie stabilnie.",
            focusAreas: ["Utrzymaj progresje na koncowym treningu"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Ten terminal tier jest stabilny. Mozesz domykac kolejny prog.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(terminalTier122Summary.status, 200);
  }

  const dashboardAfterTerminalTier122 = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterTerminalTier122.status, 200);
  assert.equal(dashboardAfterTerminalTier122.payload.data.targetedPractice.recoveryProgressStatus, "terminal-training-mastery");
  assert.equal(dashboardAfterTerminalTier122.payload.data.targetedPractice.terminalTrainingMasteryTrack.confirmedTerminalTierCount, 2);
  assert.equal(dashboardAfterTerminalTier122.payload.data.targetedPractice.promotionChainGraduation.targetTempoBpm, 126);

  const terminalMastery126Context = dashboardAfterTerminalTier122.payload.data.targetedPractice;

  for (let terminalTier126Index = 0; terminalTier126Index < 2; terminalTier126Index += 1) {
    const terminalTier126Session = await requestJson(baseUrl, "/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-001",
        trainingId: "training-003",
        tempoBpm: 126,
        practiceScope: "full-chart",
        inputMode: "synthetic",
        promotionSourceTrainingId: terminalMastery126Context.promotionSourceTrainingId,
        promotionSourceTempoBpm: terminalMastery126Context.promotionSourceTempoBpm,
        promotionPhase: "chain-graduation",
        promotionChainBaseTempoBpm: terminalMastery126Context.promotionChainGraduation.baseTempoBpm,
        promotionChainTargetTempoBpm: terminalMastery126Context.promotionChainGraduation.targetTempoBpm,
        promotionReason: terminalMastery126Context.promotionTargetReason
      })
    });

    assert.equal(terminalTier126Session.status, 201);

    const terminalTier126Summary = await requestJson(
      baseUrl,
      `/sessions/${terminalTier126Session.payload.data.session.id}/summary`,
      {
        method: "POST",
        body: JSON.stringify({
          totalScore: 1070 + (terminalTier126Index * 10),
          accuracy: 0.9 + (terminalTier126Index * 0.005),
          notesDetected: 24,
          notesHit: 24,
          scoreBreakdown: {
            tempoBpm: 126,
            targetCount: 24,
            matchedTargetCount: 24,
            unmatchedTargetCount: 0,
            noteHits: 24,
            stringHits: 24,
            timingHits: 23 + terminalTier126Index,
            fullHits: 22 + terminalTier126Index,
            sustainHits: 22 + terminalTier126Index,
            releaseHits: 21 + terminalTier126Index,
            fullComboHits: 19 + terminalTier126Index,
            earlyHitCount: 1,
            lateHitCount: 0,
            earlyReleaseCount: 0,
            overholdCount: 0,
            ghostNoteCount: 0,
            missedTargetCount: 0,
            maxCombo: 15 + terminalTier126Index,
            comboBreakCount: 1,
            multiplierPeak: 4,
            misses: 0,
            averageTimingOffsetMs: 10,
            maxTimingOffsetMs: 31,
            averageHoldCoverage: 0.95,
            averageReleaseOvershootMs: 3,
            maxReleaseOvershootMs: 5
          },
          practicePreset: {
            scope: "full-chart",
            tempoBpm: 126
          },
          rating: {
            grade: "S",
            label: "Terminal mastery tier 126 stable",
            clearType: "full-combo",
            performanceScore: 95 + terminalTier126Index
          },
          feedback: {
            summary: "Koncowy mastery tier zostal domkniety.",
            focusAreas: ["Utrzymaj najwyzszy poziom na koncowym treningu"],
            coachHints: [
              {
                id: "keep-current-approach",
                title: "Utrzymaj obecne ustawienie",
                detail: "Mastery track jest juz domkniety na tym materiale.",
                severity: "low"
              }
            ]
          },
          capture: {
            source: "synthetic",
            profile: "balanced"
          },
          diagnostics: {
            notices: []
          }
        })
      }
    );

    assert.equal(terminalTier126Summary.status, 200);
  }

  const dashboardAfterTerminalMasteryGraduation = await requestJson(baseUrl, "/users/user-001/dashboard");
  assert.equal(dashboardAfterTerminalMasteryGraduation.status, 200);
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.recoveryProgressStatus, "terminal-mastery-graduated");
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.recommendedTrainingId, "training-003");
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.action, "repeat-current");
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.terminalTrainingMasteryTrack.confirmedTerminalTierCount, 3);
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.terminalTrainingMasteryTrack.requiredConfirmedTerminalTiers, 3);
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.terminalMasteryGraduation.mode, "maintain-terminal-mastery");
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.terminalMasteryGraduation.targetTrainingId, "training-003");
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.terminalMasteryGraduation.targetTempoBpm, 126);
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.suggestedTempoBpm, 126);
  assert.match(dashboardAfterTerminalMasteryGraduation.payload.data.targetedPractice.nextStep, /126 BPM/);
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.contentUnlockGraph.unlockedTrainingCount, 7);
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.contentUnlockGraph.completedTrainingCount, 3);
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.contentUnlockGraph.lockedTrainingCount, 2);
  assert.equal(dashboardAfterTerminalMasteryGraduation.payload.data.checkpointHistorySnapshots.length, 3);
  assert.equal(
    dashboardAfterTerminalMasteryGraduation.payload.data.checkpointHistorySnapshots[0].sessionId,
    dashboardAfterTerminalMasteryGraduation.payload.data.recentResults[0].sessionId
  );
  assert.equal(
    dashboardAfterTerminalMasteryGraduation.payload.data.checkpointHistorySnapshots[0].type,
    "mastery"
  );
  assert.equal(
    dashboardAfterTerminalMasteryGraduation.payload.data.checkpointHistorySnapshots[0].detail.practiceScope,
    "full-chart"
  );
  assert.ok(
    dashboardAfterTerminalMasteryGraduation.payload.data.checkpointHistorySnapshots[0].badges.some(
      (badge) => badge.label === "Terminal Mastery"
    )
  );
  assert.ok(
    dashboardAfterTerminalMasteryGraduation.payload.data.checkpointHistorySnapshots[0].highlights.some(
      (highlight) => highlight.includes("Terminal mastery active")
    )
  );
  assert.equal(
    dashboardAfterTerminalMasteryGraduation.payload.data.contentUnlockGraph.nodes.find((node) => node.trainingId === "training-001").unlockState,
    "completed"
  );
  assert.equal(
    dashboardAfterTerminalMasteryGraduation.payload.data.contentUnlockGraph.nodes.find((node) => node.trainingId === "training-003").unlockState,
    "completed"
  );
  assert.equal(
    dashboardAfterTerminalMasteryGraduation.payload.data.contentUnlockGraph.nodes.find((node) => node.trainingId === "training-002").unlockSource,
    "Completed session"
  );

  const unlockedUserCatalog = await requestJson(baseUrl, "/users/user-001/trainings");
  assert.equal(unlockedUserCatalog.status, 200);
  assert.equal(unlockedUserCatalog.payload.data.summary.unlockedTrainingCount, 7);
  assert.equal(unlockedUserCatalog.payload.data.summary.completedTrainingCount, 3);
  assert.equal(unlockedUserCatalog.payload.data.trainings.find((training) => training.id === "training-002").access.unlockState, "completed");

  const diagnosticsCsvExport = await requestText(baseUrl, "/users/user-001/diagnostics/export?format=csv&deviceName=Focusrite");
  assert.equal(diagnosticsCsvExport.status, 200);
  assert.match(diagnosticsCsvExport.headers.get("content-type"), /text\/csv/);
  assert.match(diagnosticsCsvExport.headers.get("content-disposition"), /riffrush-diagnostics-user-001\.csv/);
  assert.match(diagnosticsCsvExport.body, /recent-session/);
  assert.match(diagnosticsCsvExport.body, /recommended-path/);
  assert.match(diagnosticsCsvExport.body, /problematic-path/);
  assert.match(diagnosticsCsvExport.body, /grouped-path/);

  // -------------------------------------------------------------------------
  // Telemetry endpoint tests
  // -------------------------------------------------------------------------

  // Without telemetryRepository the endpoints respond 501.
  const telemetryNotConfigured = await requestJson(baseUrl, "/telemetry/events", {
    method: "POST",
    body: JSON.stringify({ eventType: "js-error", message: "test" })
  });
  assert.equal(telemetryNotConfigured.status, 501);
  assert.equal(telemetryNotConfigured.payload.error.code, "TELEMETRY_NOT_CONFIGURED");

  const telemetryGetNotConfigured = await requestJson(baseUrl, "/telemetry/events");
  assert.equal(telemetryGetNotConfigured.status, 501);

  // Spin up a second server that has an in-memory telemetry repository wired in.
  class InMemoryTelemetryRepository {
    #events = [];

    insert({ eventType, userId, message, stack, url, userAgent, appContext }) {
      const event = {
        id: `tel-${this.#events.length + 1}`,
        eventType,
        userId: userId ?? null,
        message,
        stack: stack ?? null,
        url: url ?? null,
        userAgent: userAgent ?? null,
        appContext: appContext ?? null,
        createdAt: new Date().toISOString()
      };
      this.#events.unshift(event);
      return { id: event.id, eventType: event.eventType, userId: event.userId, message: event.message, createdAt: event.createdAt };
    }

    list({ limit = 50, offset = 0 } = {}) {
      return this.#events.slice(offset, offset + limit);
    }

    count() {
      return this.#events.length;
    }
  }

  const telemetryServer = createApp({ telemetryRepository: new InMemoryTelemetryRepository() });

  await new Promise((resolve) => {
    telemetryServer.listen(0, "127.0.0.1", resolve);
  });

  const telemetryBaseUrl = `http://127.0.0.1:${telemetryServer.address().port}`;

  try {
    // Validation: missing eventType
    const missingEventType = await requestJson(telemetryBaseUrl, "/telemetry/events", {
      method: "POST",
      body: JSON.stringify({ message: "boom" })
    });
    assert.equal(missingEventType.status, 400);
    assert.equal(missingEventType.payload.error.code, "INVALID_TELEMETRY_EVENT");

    // Validation: unknown eventType
    const unknownEventType = await requestJson(telemetryBaseUrl, "/telemetry/events", {
      method: "POST",
      body: JSON.stringify({ eventType: "unknown-type", message: "boom" })
    });
    assert.equal(unknownEventType.status, 400);
    assert.equal(unknownEventType.payload.error.code, "INVALID_TELEMETRY_EVENT");

    // Validation: missing message
    const missingMessage = await requestJson(telemetryBaseUrl, "/telemetry/events", {
      method: "POST",
      body: JSON.stringify({ eventType: "js-error" })
    });
    assert.equal(missingMessage.status, 400);
    assert.equal(missingMessage.payload.error.code, "INVALID_TELEMETRY_EVENT");

    // Successful event insertion
    const insertEvent = await requestJson(telemetryBaseUrl, "/telemetry/events", {
      method: "POST",
      body: JSON.stringify({
        eventType: "js-error",
        message: "Uncaught TypeError: cannot read property 'x' of undefined",
        stack: "TypeError: ...\n  at app.js:42",
        url: "http://127.0.0.1:5173/app.js",
        userId: "user-tel-001",
        appContext: { pathname: "/" }
      })
    });
    assert.equal(insertEvent.status, 201);
    assert.equal(insertEvent.payload.data.event.eventType, "js-error");
    assert.equal(insertEvent.payload.data.event.message, "Uncaught TypeError: cannot read property 'x' of undefined");
    assert.equal(insertEvent.payload.data.event.userId, "user-tel-001");
    assert.ok(typeof insertEvent.payload.data.event.id === "string");
    assert.ok(typeof insertEvent.payload.data.event.createdAt === "string");

    // Insert a second event
    await requestJson(telemetryBaseUrl, "/telemetry/events", {
      method: "POST",
      body: JSON.stringify({
        eventType: "unhandled-rejection",
        message: "Promise rejected: fetch failed"
      })
    });

    // Listing returns both events newest-first
    const listEvents = await requestJson(telemetryBaseUrl, "/telemetry/events");
    assert.equal(listEvents.status, 200);
    assert.equal(listEvents.payload.data.total, 2);
    assert.equal(listEvents.payload.data.events.length, 2);
    assert.equal(listEvents.payload.data.events[0].eventType, "unhandled-rejection");
    assert.equal(listEvents.payload.data.events[1].eventType, "js-error");

    // Pagination: limit=1 offset=1 returns the older event
    const listPage = await requestJson(telemetryBaseUrl, "/telemetry/events?limit=1&offset=1");
    assert.equal(listPage.status, 200);
    assert.equal(listPage.payload.data.events.length, 1);
    assert.equal(listPage.payload.data.events[0].eventType, "js-error");
    assert.equal(listPage.payload.data.total, 2);
  } finally {
    await new Promise((resolve, reject) => {
      telemetryServer.close((error) => {
        if (error) { reject(error); return; }
        resolve();
      });
    });
  }

  console.log("Backend smoke test passed.");
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
