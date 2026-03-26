import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/create-app.js";
import { createPersistentDependencies } from "../src/persistence/create-persistent-dependencies.js";
import { SQLITE_SCHEMA_VERSION } from "../src/persistence/sqlite-migrations.js";

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

async function startServer(dataDirectory) {
  const dependencies = createPersistentDependencies({ dataDirectory });
  const server = createApp(dependencies);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  return {
    server,
    dependencies,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stopServer(server, dependencies) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  dependencies.close?.();
}

async function removeDirectoryWithRetry(targetPath, { attempts = 30, delayMs = 200 } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;

      if (error?.code !== "EBUSY") {
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }

  if (lastError?.code === "EBUSY") {
    console.warn(`Skipping temp directory cleanup because SQLite file is still locked: ${targetPath}`);
    return;
  }

  if (lastError) {
    throw lastError;
  }
}

const dataDirectory = mkdtempSync(join(tmpdir(), "riffrush-backend-"));
const databasePath = join(dataDirectory, "riffrush-backend.sqlite");

try {
  const firstRun = await startServer(dataDirectory);
  const trainings = await requestJson(firstRun.baseUrl, "/trainings");
  const trainingId = trainings.payload.data[2].id;
  const rootTrainingId = trainings.payload.data[0].id;

  await requestJson(firstRun.baseUrl, "/users/user-001/capture-preferences", {
    method: "PUT",
    body: JSON.stringify({
      autoApplyRecommendation: false
    })
  });

  const setupRecommendation = await requestJson(firstRun.baseUrl, "/users/user-001/setup-recommendations", {
    method: "POST",
    body: JSON.stringify({
      deviceName: "Focusrite USB Input",
      backend: "wasapi",
      profile: "balanced",
      recommendationId: "keep-current-setup",
      recommendationTitle: "Keep current setup",
      recommendationDetail: "Current capture settings look healthy. No immediate input-chain change is suggested from recorded sessions.",
      source: "device-detail",
      plannedSessionId: "planned-session-001",
      baselineStabilityScore: 96,
      baselineSignalQualityScore: 100,
      baselineRuntimeStabilityScore: 100,
      baselineLatencyFitnessScore: 92
    })
  });

  await requestJson(
    firstRun.baseUrl,
    `/users/user-001/setup-recommendations/${setupRecommendation.payload.data.setupRecommendation.id}/evaluation`,
    {
      method: "POST",
      body: JSON.stringify({
        outcome: "improved"
      })
    }
  );

  const unlockBootstrapSession = await requestJson(firstRun.baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-001",
      trainingId: rootTrainingId,
      tempoBpm: 80,
      practiceScope: "full-chart",
      inputMode: "synthetic"
    })
  });

  assert.equal(unlockBootstrapSession.status, 201);

  await requestJson(firstRun.baseUrl, `/sessions/${unlockBootstrapSession.payload.data.session.id}/summary`, {
    method: "POST",
    body: JSON.stringify({
      totalScore: 620,
      accuracy: 0.84,
      notesDetected: 12,
      notesHit: 10,
      scoreBreakdown: {
        tempoBpm: 80,
        targetCount: 12,
        matchedTargetCount: 10,
        unmatchedTargetCount: 2,
        noteHits: 10,
        stringHits: 10,
        timingHits: 9,
        fullHits: 8,
        sustainHits: 7,
        releaseHits: 7,
        fullComboHits: 6,
        earlyHitCount: 1,
        lateHitCount: 1,
        earlyReleaseCount: 1,
        overholdCount: 0,
        ghostNoteCount: 0,
        missedTargetCount: 2,
        maxCombo: 5,
        comboBreakCount: 1,
        multiplierPeak: 2,
        misses: 2,
        averageTimingOffsetMs: 19,
        maxTimingOffsetMs: 58,
        averageHoldCoverage: 0.82,
        averageReleaseOvershootMs: 6,
        maxReleaseOvershootMs: 12
      },
      practicePreset: {
        scope: "full-chart",
        tempoBpm: 80
      },
      rating: {
        grade: "B",
        label: "Bootstrap unlock stable",
        clearType: "clear",
        performanceScore: 78
      },
      feedback: {
        summary: "Root training zostal domkniety jako bootstrap odblokowania.",
        focusAreas: ["Przejdz do treningu odblokowanego przez root"],
        coachHints: [
          {
            id: "keep-current-approach",
            title: "Utrzymaj obecne ustawienie",
            detail: "Root training jest wystarczajaco stabilny, zeby przejsc dalej.",
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

  const session = await requestJson(firstRun.baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-001",
      trainingId,
      tempoBpm: 90,
      practiceScope: "section-loop",
      loopSectionId: "ladder-b",
      loopRepetitionCount: 3,
      loopTempoStepBpm: 2,
      inputMode: "synthetic"
    })
  });

  await requestJson(firstRun.baseUrl, `/sessions/${session.payload.data.session.id}/summary`, {
    method: "POST",
    body: JSON.stringify({
      totalScore: 500,
      accuracy: 0.8,
      notesDetected: 20,
      notesHit: 16,
      scoreBreakdown: {
        tempoBpm: 95,
        targetCount: 20,
        matchedTargetCount: 18,
        unmatchedTargetCount: 2,
        noteHits: 16,
        stringHits: 15,
        timingHits: 14,
        fullHits: 13,
        sustainHits: 11,
        releaseHits: 9,
        fullComboHits: 10,
        earlyHitCount: 2,
        lateHitCount: 3,
        earlyReleaseCount: 3,
        overholdCount: 2,
        ghostNoteCount: 1,
        missedTargetCount: 2,
        maxCombo: 4,
        comboBreakCount: 3,
        multiplierPeak: 2,
        misses: 7,
        averageTimingOffsetMs: 31,
        maxTimingOffsetMs: 120,
        averageHoldCoverage: 0.68,
        averageReleaseOvershootMs: 11,
        maxReleaseOvershootMs: 27
      },
      sectionBreakdown: [
        {
          sectionId: "ladder-a",
          sectionLabel: "Ladder A",
          targetCount: 10,
          matchedTargetCount: 9,
          fullComboHits: 6,
          missedTargetCount: 1,
          ghostNoteCount: 1,
          earlyHitCount: 1,
          lateHitCount: 1,
          earlyReleaseCount: 1,
          overholdCount: 0,
          accuracy: 0.6,
          averageTimingOffsetMs: 28,
          averageHoldCoverage: 0.72,
          averageReleaseOvershootMs: 8,
          performanceScore: 57
        },
        {
          sectionId: "ladder-b",
          sectionLabel: "Ladder B",
          targetCount: 10,
          matchedTargetCount: 9,
          fullComboHits: 4,
          missedTargetCount: 1,
          ghostNoteCount: 0,
          earlyHitCount: 1,
          lateHitCount: 2,
          earlyReleaseCount: 2,
          overholdCount: 2,
          accuracy: 0.4,
          averageTimingOffsetMs: 34,
          averageHoldCoverage: 0.64,
          averageReleaseOvershootMs: 14,
          performanceScore: 36
        }
      ],
      practicePreset: {
        scope: "section-loop",
        tempoBpm: 90,
        loopSectionId: "ladder-b",
        loopSectionLabel: "Ladder B",
        loopRepetitionCount: 3,
        loopTempoStepBpm: 2,
        repetitions: [
          { repetitionIndex: 0, tempoBpm: 90, startTimeMs: 667, durationMs: 1333, targetCount: 7, fullComboHits: 4, missedTargetCount: 1, ghostNoteCount: 0, accuracy: 0.57, performanceScore: 52, passed: false },
          { repetitionIndex: 1, tempoBpm: 92, startTimeMs: 2000, durationMs: 1304, targetCount: 7, fullComboHits: 3, missedTargetCount: 1, ghostNoteCount: 0, accuracy: 0.43, performanceScore: 41, passed: false },
          { repetitionIndex: 2, tempoBpm: 94, startTimeMs: 3304, durationMs: 1277, targetCount: 6, fullComboHits: 3, missedTargetCount: 0, ghostNoteCount: 1, accuracy: 0.5, performanceScore: 44, passed: false }
        ],
        masteryGate: {
          status: "stabilize-base-tempo",
          passedRepetitionCount: 0,
          totalRepetitionCount: 3,
          highestPassedTempoBpm: 0,
          recommendedNextTempoBpm: 90,
          message: "Gate nie zostal jeszcze zaliczony. Powtorz sekcje na bazowym tempie przed dalszym podbijaniem BPM."
        },
        adaptiveExecution: {
          mode: "early-stop",
          triggered: true,
          completedRepetitionCount: 1,
          plannedRepetitionCount: 3,
          stoppedAfterRepetitionIndex: 0,
          stopReason: "Repetition 1 fell below the adaptive threshold at 90 BPM.",
          retryPlan: {
            strategy: "rebuild-base-tempo",
            tempoBpm: 90,
            loopRepetitionCount: 3,
            loopTempoStepBpm: 0,
            reason: "The base repetition failed too early. Rebuild the section from the starting tempo before attempting another ramp."
          }
        }
      },
      rating: {
        grade: "C",
        label: "Developing",
        clearType: "practice",
        performanceScore: 66
      },
      feedback: {
        summary: "Jest progres, ale potrzeba więcej stabilności w kluczowych miejscach patternu.",
        focusAreas: ["Dociągaj długości nut"],
        coachHints: [
          {
            id: "hold-notes-longer",
            title: "Dociągaj długości nut",
            detail: "Za wcześnie puszczasz nuty. Utrzymuj dźwięk stabilnie do końca targetu.",
            severity: "medium"
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
        sampleRate: 48000,
        chunkCount: 20,
        durationMs: 3000,
        bufferMs: 18,
        numberOfBuffers: 2,
        startAttemptCount: 1,
        useEventSync: true,
        fallbackApplied: false
      },
      diagnostics: {
        currentCapture: {
          profile: "balanced",
          backend: "wasapi",
          deviceName: "Focusrite USB Input"
        },
        notices: []
      }
    })
  });

  const recoverySession = await requestJson(firstRun.baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-001",
      trainingId: "training-001",
      tempoBpm: 80,
      practiceScope: "full-chart",
      inputMode: "synthetic",
      recoveryGoalTrainingId: "training-003",
      recoveryGoalSectionId: "ladder-b",
      recoveryReturnTempoBpm: 90,
      recoveryReturnLoopRepetitionCount: 3,
      recoveryReturnLoopTempoStepBpm: 0,
      recoveryReason: "Wroc do prostszego materialu, ustabilizuj timing i dopiero potem wracaj do Ladder B.",
      recoveryStrategy: "rebuild-base-tempo"
    })
  });

  await requestJson(firstRun.baseUrl, `/sessions/${recoverySession.payload.data.session.id}/summary`, {
    method: "POST",
    body: JSON.stringify({
      totalScore: 880,
      accuracy: 0.91,
      notesDetected: 16,
      notesHit: 15,
      scoreBreakdown: {
        tempoBpm: 80,
        targetCount: 16,
        matchedTargetCount: 15,
        unmatchedTargetCount: 1,
        noteHits: 15,
        stringHits: 15,
        timingHits: 14,
        fullHits: 13,
        sustainHits: 13,
        releaseHits: 12,
        fullComboHits: 11,
        earlyHitCount: 0,
        lateHitCount: 1,
        earlyReleaseCount: 0,
        overholdCount: 0,
        ghostNoteCount: 0,
        missedTargetCount: 1,
        maxCombo: 9,
        comboBreakCount: 1,
        multiplierPeak: 3,
        misses: 1,
        averageTimingOffsetMs: 12,
        maxTimingOffsetMs: 38,
        averageHoldCoverage: 0.94,
        averageReleaseOvershootMs: 4,
        maxReleaseOvershootMs: 8
      },
      sectionBreakdown: [
        {
          sectionId: "intro",
          sectionLabel: "Intro pulse",
          targetCount: 8,
          matchedTargetCount: 8,
          fullComboHits: 6,
          missedTargetCount: 0,
          ghostNoteCount: 0,
          earlyHitCount: 0,
          lateHitCount: 0,
          earlyReleaseCount: 0,
          overholdCount: 0,
          accuracy: 0.94,
          averageTimingOffsetMs: 10,
          averageHoldCoverage: 0.96,
          averageReleaseOvershootMs: 3,
          performanceScore: 91
        },
        {
          sectionId: "climb",
          sectionLabel: "Ascending phrase",
          targetCount: 8,
          matchedTargetCount: 7,
          fullComboHits: 5,
          missedTargetCount: 1,
          ghostNoteCount: 0,
          earlyHitCount: 0,
          lateHitCount: 1,
          earlyReleaseCount: 0,
          overholdCount: 0,
          accuracy: 0.88,
          averageTimingOffsetMs: 14,
          averageHoldCoverage: 0.92,
          averageReleaseOvershootMs: 5,
          performanceScore: 84
        }
      ],
      practicePreset: {
        scope: "full-chart",
        tempoBpm: 80
      },
      rating: {
        grade: "A",
        label: "Recovery cleared",
        clearType: "clean-clear",
        performanceScore: 89
      },
      feedback: {
        summary: "Recovery session jest juz stabilna i mozna wracac do trudniejszego chartu.",
        focusAreas: ["Utrzymaj pewny timing przed powrotem do Ladder B"],
        coachHints: [
          {
            id: "keep-current-approach",
            title: "Utrzymaj obecne ustawienie",
            detail: "Podstawy sa ustabilizowane. Wroc do docelowego materialu i pilnuj tego samego feelu.",
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

  const recoverySessionFollowup = await requestJson(firstRun.baseUrl, "/sessions", {
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
      recoveryReturnLoopTempoStepBpm: 0,
      recoveryReason: "Potwierdz stabilnosc na prostszym materiale przed powrotem do Ladder B.",
      recoveryStrategy: "rebuild-base-tempo"
    })
  });

  await requestJson(firstRun.baseUrl, `/sessions/${recoverySessionFollowup.payload.data.session.id}/summary`, {
    method: "POST",
    body: JSON.stringify({
      totalScore: 910,
      accuracy: 0.93,
      notesDetected: 16,
      notesHit: 15,
      scoreBreakdown: {
        tempoBpm: 82,
        targetCount: 16,
        matchedTargetCount: 15,
        unmatchedTargetCount: 1,
        noteHits: 15,
        stringHits: 15,
        timingHits: 15,
        fullHits: 14,
        sustainHits: 13,
        releaseHits: 13,
        fullComboHits: 12,
        earlyHitCount: 0,
        lateHitCount: 1,
        earlyReleaseCount: 0,
        overholdCount: 0,
        ghostNoteCount: 0,
        missedTargetCount: 1,
        maxCombo: 10,
        comboBreakCount: 1,
        multiplierPeak: 3,
        misses: 1,
        averageTimingOffsetMs: 11,
        maxTimingOffsetMs: 34,
        averageHoldCoverage: 0.95,
        averageReleaseOvershootMs: 3,
        maxReleaseOvershootMs: 7
      },
      sectionBreakdown: [
        {
          sectionId: "intro",
          sectionLabel: "Intro pulse",
          targetCount: 8,
          matchedTargetCount: 8,
          fullComboHits: 6,
          missedTargetCount: 0,
          ghostNoteCount: 0,
          earlyHitCount: 0,
          lateHitCount: 0,
          earlyReleaseCount: 0,
          overholdCount: 0,
          accuracy: 0.96,
          averageTimingOffsetMs: 9,
          averageHoldCoverage: 0.97,
          averageReleaseOvershootMs: 2,
          performanceScore: 93
        },
        {
          sectionId: "climb",
          sectionLabel: "Ascending phrase",
          targetCount: 8,
          matchedTargetCount: 7,
          fullComboHits: 6,
          missedTargetCount: 1,
          ghostNoteCount: 0,
          earlyHitCount: 0,
          lateHitCount: 1,
          earlyReleaseCount: 0,
          overholdCount: 0,
          accuracy: 0.9,
          averageTimingOffsetMs: 13,
          averageHoldCoverage: 0.93,
          averageReleaseOvershootMs: 4,
          performanceScore: 87
        }
      ],
      practicePreset: {
        scope: "full-chart",
        tempoBpm: 82
      },
      rating: {
        grade: "A",
        label: "Recovery confirmed",
        clearType: "clean-clear",
        performanceScore: 91
      },
      feedback: {
        summary: "Druga stabilna sesja recovery potwierdza gotowosc do powrotu na trudniejszy chart.",
        focusAreas: ["Wroc do Ladder B z tym samym timingiem"],
        coachHints: [
          {
            id: "keep-current-approach",
            title: "Utrzymaj obecne ustawienie",
            detail: "Recovery jest juz stabilne. Wroc do celu i pilnuj tego samego pulsu.",
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

  const returnAttemptSession = await requestJson(firstRun.baseUrl, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: "user-001",
      trainingId: "training-003",
      tempoBpm: 90,
      practiceScope: "section-loop",
      loopSectionId: "ladder-b",
      loopRepetitionCount: 2,
      loopTempoStepBpm: 0,
      inputMode: "synthetic",
      returnRecoveryTrainingId: "training-001",
      returnGoalSectionId: "ladder-b",
      returnReason: "To pierwsza proba powrotu do Ladder B po recovery."
    })
  });

  await requestJson(firstRun.baseUrl, `/sessions/${returnAttemptSession.payload.data.session.id}/summary`, {
    method: "POST",
    body: JSON.stringify({
      totalScore: 430,
      accuracy: 0.58,
      notesDetected: 12,
      notesHit: 7,
      scoreBreakdown: {
        tempoBpm: 90,
        targetCount: 12,
        matchedTargetCount: 8,
        unmatchedTargetCount: 4,
        noteHits: 7,
        stringHits: 7,
        timingHits: 6,
        fullHits: 5,
        sustainHits: 4,
        releaseHits: 4,
        fullComboHits: 3,
        earlyHitCount: 2,
        lateHitCount: 2,
        earlyReleaseCount: 2,
        overholdCount: 1,
        ghostNoteCount: 3,
        missedTargetCount: 4,
        maxCombo: 2,
        comboBreakCount: 4,
        multiplierPeak: 1,
        misses: 7,
        averageTimingOffsetMs: 42,
        maxTimingOffsetMs: 135,
        averageHoldCoverage: 0.61,
        averageReleaseOvershootMs: 16,
        maxReleaseOvershootMs: 32
      },
      sectionBreakdown: [
        {
          sectionId: "ladder-b",
          sectionLabel: "Ladder B",
          targetCount: 12,
          matchedTargetCount: 8,
          fullComboHits: 3,
          missedTargetCount: 4,
          ghostNoteCount: 3,
          earlyHitCount: 2,
          lateHitCount: 2,
          earlyReleaseCount: 2,
          overholdCount: 1,
          accuracy: 0.58,
          averageTimingOffsetMs: 42,
          averageHoldCoverage: 0.61,
          averageReleaseOvershootMs: 16,
          performanceScore: 38
        }
      ],
      practicePreset: {
        scope: "section-loop",
        tempoBpm: 90,
        loopSectionId: "ladder-b",
        loopSectionLabel: "Ladder B",
        loopRepetitionCount: 2,
        loopTempoStepBpm: 0
      },
      rating: {
        grade: "D",
        label: "Return unstable",
        clearType: "practice",
        performanceScore: 49
      },
      feedback: {
        summary: "Powrot do docelowego chartu jest jeszcze za niestabilny.",
        focusAreas: ["Wroc do recovery i odbuduj timing"],
        coachHints: [
          {
            id: "timing-consistency",
            title: "Domknij timing wejsc",
            detail: "Return attempt jest jeszcze za niestabilny. Wroc do prostszego patternu i odzyskaj puls.",
            severity: "high"
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

  await stopServer(firstRun.server, firstRun.dependencies);
  const schemaInspection = new DatabaseSync(databasePath);
  const migrationRows = schemaInspection
    .prepare("SELECT version, name FROM schema_migrations ORDER BY version ASC")
    .all();
  const userVersion = schemaInspection.prepare("PRAGMA user_version").get().user_version;
  const captureSnapshots = schemaInspection
    .prepare("SELECT session_id, backend, profile FROM session_capture_snapshots")
    .all();
  const noticeEvents = schemaInspection
    .prepare("SELECT session_id, code, level FROM session_notice_events")
    .all();
  schemaInspection.close();

  assert.equal(migrationRows.length, SQLITE_SCHEMA_VERSION);
  assert.equal(migrationRows.at(-1).version, SQLITE_SCHEMA_VERSION);
  assert.equal(userVersion, SQLITE_SCHEMA_VERSION);
  assert.equal(captureSnapshots.length, 5);
  assert.ok(captureSnapshots.some((snapshot) => snapshot.backend === "wasapi" && snapshot.profile === "balanced"));
  assert.ok(captureSnapshots.some((snapshot) => snapshot.backend === null && snapshot.profile === "balanced"));
  assert.equal(noticeEvents.length, 0);

  const secondRun = await startServer(dataDirectory);
  const dashboard = await requestJson(secondRun.baseUrl, "/users/user-001/dashboard");
  const diagnostics = await requestJson(secondRun.baseUrl, "/users/user-001/diagnostics");

  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.payload.data.capturePreferences.autoApplyRecommendation, false);
  assert.equal(dashboard.payload.data.setupRecommendationHistory.length, 1);
  assert.equal(dashboard.payload.data.setupRecommendationHistory[0].status, "improved");
  assert.equal(dashboard.payload.data.setupRecommendationHistory[0].plannedSessionId, "planned-session-001");
  assert.equal(dashboard.payload.data.verificationHoldSetupFollowupSummary.trackedCount, 0);
  assert.equal(dashboard.payload.data.stats.completedSessions, 5);
  assert.equal(dashboard.payload.data.targetedPractice.recommendedTrainingId, "training-001");
  assert.equal(dashboard.payload.data.targetedPractice.action, "switch-training");
  assert.equal(dashboard.payload.data.targetedPractice.suggestedTempoBpm, 80);
  assert.equal(dashboard.payload.data.targetedPractice.recoveryProgressStatus, "return-failed");
  assert.equal(dashboard.payload.data.targetedPractice.returnMilestone.stableReturnSessionCount, 0);
  assert.equal(dashboard.payload.data.targetedPractice.returnMilestone.requiredStableReturnSessions, 2);
  assert.equal(dashboard.payload.data.targetedPractice.returnMilestone.latestFailed, true);
  assert.equal(dashboard.payload.data.targetedPractice.recoveryTrainingId, "training-001");
  assert.equal(dashboard.payload.data.targetedPractice.recoveryTrainingTitle, "Single String Timing Foundations");
  assert.equal(dashboard.payload.data.targetedPractice.recoveryGoalTrainingTitle, "Timing Control Ladder");
  assert.equal(dashboard.payload.data.targetedPractice.recoveryGoalSectionLabel, "Ladder B");
  assert.equal(dashboard.payload.data.progressionSafety.status, "clear");
  assert.equal(dashboard.payload.data.progressionSafety.canAdvance, true);
  assert.equal(dashboard.payload.data.recentResults.length, 5);
  assert.equal(dashboard.payload.data.verificationTrend.analyzedSessionCount, 5);
  assert.equal(dashboard.payload.data.verificationTrend.verifiedSessionCount, 5);
  assert.equal(dashboard.payload.data.verificationTrend.warningSessionCount, 0);
  assert.equal(dashboard.payload.data.verificationTrend.trend, "stable");
  assert.equal(dashboard.payload.data.verificationHoldSummary.analyzedSessionCount, 5);
  assert.equal(dashboard.payload.data.verificationHoldSummary.holdSessionCount, 0);
  assert.equal(dashboard.payload.data.verificationHoldSummary.latestStatus, "clear");
  assert.equal(dashboard.payload.data.verificationHoldSummary.suspectedOrigin, "clear");
  assert.equal(dashboard.payload.data.verificationHoldSummary.byRecommendedCapturePath.length, 0);
  assert.equal(dashboard.payload.data.recentResults[0].trainingId, "training-003");
  assert.equal(dashboard.payload.data.recentResults[0].rating.grade, "D");
  assert.equal(dashboard.payload.data.recentResults[0].verification.status, "verified");
  assert.equal(dashboard.payload.data.recentResults[0].scoreBreakdown.tempoBpm, 90);
  assert.equal(dashboard.payload.data.recentResults[1].trainingId, "training-001");
  assert.equal(dashboard.payload.data.recentResults[1].rating.grade, "A");
  assert.equal(dashboard.payload.data.recentResults[1].scoreBreakdown.tempoBpm, 82);
  assert.equal(dashboard.payload.data.recentResults[2].trainingId, "training-001");
  assert.equal(dashboard.payload.data.recentResults[2].rating.grade, "A");
  assert.equal(dashboard.payload.data.recentResults[2].scoreBreakdown.tempoBpm, 80);
  assert.equal(dashboard.payload.data.recentResults[3].trainingId, "training-003");
  assert.equal(dashboard.payload.data.recentResults[3].practicePreset.loopSectionLabel, "Ladder B");
  assert.equal(dashboard.payload.data.recentResults[3].practicePreset.repetitions.length, 3);
  assert.equal(dashboard.payload.data.recentResults[3].practicePreset.masteryGate.status, "stabilize-base-tempo");
  assert.equal(dashboard.payload.data.recentResults[3].practicePreset.adaptiveExecution.triggered, true);
  assert.equal(dashboard.payload.data.recentResults[3].practicePreset.adaptiveExecution.retryPlan.loopRepetitionCount, 3);
  assert.equal(dashboard.payload.data.recentResults[3].sectionBreakdown[1].sectionLabel, "Ladder B");
  assert.equal(dashboard.payload.data.recentResults[3].scoreBreakdown.fullHits, 13);
  assert.equal(dashboard.payload.data.recentResults[3].scoreBreakdown.fullComboHits, 10);
  assert.equal(dashboard.payload.data.recentResults[3].scoreBreakdown.releaseHits, 9);
  assert.equal(dashboard.payload.data.recentResults[3].scoreBreakdown.ghostNoteCount, 1);
  assert.equal(dashboard.payload.data.recentResults[3].scoreBreakdown.maxCombo, 4);
  assert.equal(dashboard.payload.data.recentResults[3].rating.grade, "C");
  assert.equal(dashboard.payload.data.recentResults[3].feedback.coachHints[0].id, "hold-notes-longer");
  assert.equal(dashboard.payload.data.recentResults[3].scoreBreakdown.tempoBpm, 95);
  assert.equal(dashboard.payload.data.recentResults[3].capture.backend, "wasapi");
  assert.equal(dashboard.payload.data.recentResults[4].trainingId, "training-001");
  assert.equal(dashboard.payload.data.recentResults[4].rating.grade, "B");
  assert.equal(dashboard.payload.data.recentResults[4].scoreBreakdown.tempoBpm, 80);
  assert.equal(diagnostics.status, 200);
  assert.equal(diagnostics.payload.data.summary.sessionCount, 5);
  assert.equal(diagnostics.payload.data.verificationTrend.analyzedSessionCount, 5);
  assert.equal(diagnostics.payload.data.verificationTrend.verifiedSessionCount, 5);
  assert.equal(diagnostics.payload.data.verificationTrend.warningSessionCount, 0);
  assert.equal(diagnostics.payload.data.verificationTrend.trend, "stable");
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.analyzedSessionCount, 5);
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.warningSessionCount, 0);
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.issueGroups.length, 0);
  assert.equal(diagnostics.payload.data.verificationIssueDrilldown.byTraining[0].warningSessionCount, 0);
assert.equal(diagnostics.payload.data.verificationHoldDrilldown.analyzedSessionCount, 5);
assert.equal(diagnostics.payload.data.verificationHoldDrilldown.holdSessionCount, 0);
assert.equal(diagnostics.payload.data.verificationHoldDrilldown.latestStatus, "clear");
assert.equal(diagnostics.payload.data.verificationHoldDrilldown.suspectedOrigin, "clear");
assert.equal(diagnostics.payload.data.verificationHoldDrilldown.byRecommendedCapturePath.length, 0);
assert.equal(diagnostics.payload.data.runtimeIssues.classBreakdown.length, 0);
  assert.equal(diagnostics.payload.data.groupedPaths.length, 2);
  assert.ok(diagnostics.payload.data.groupedPaths.some((path) => path.backend === "wasapi"));
  assert.equal(diagnostics.payload.data.recentSessions[3].capture.deviceName, "Focusrite USB Input");

  await stopServer(secondRun.server, secondRun.dependencies);

  console.log("Backend persistence smoke test passed.");
} finally {
  await removeDirectoryWithRetry(dataDirectory);
}
