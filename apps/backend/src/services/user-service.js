import { buildContentUnlockGraph, findUnlockTransitions } from "./content-unlock-graph.js";

function toDayStamp(isoString) {
  return isoString.slice(0, 10);
}

function clampNumber(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function calculateVerificationShare(part, total) {
  if (!total) {
    return 0;
  }

  return Number((part / total).toFixed(2));
}

function computeStreakDays(completedSessions) {
  if (completedSessions.length === 0) {
    return 0;
  }

  const sortedDays = [...new Set(completedSessions.map((session) => toDayStamp(session.completedAt)))]
    .sort()
    .reverse();

  let streak = 1;

  for (let index = 0; index < sortedDays.length - 1; index += 1) {
    const currentDay = new Date(`${sortedDays[index]}T00:00:00Z`);
    const nextDay = new Date(`${sortedDays[index + 1]}T00:00:00Z`);
    const differenceInDays = Math.round((currentDay - nextDay) / 86400000);

    if (differenceInDays !== 1) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function inferTrainingPracticeProfile(training) {
  const targetSequence = training.targetSequence ?? [];
  const chartSummary = training.chartSummary ?? {};
  const title = `${training.title ?? ""} ${training.description ?? ""} ${training.objective ?? ""}`.toLowerCase();
  const maxDurationBeats = targetSequence.reduce(
    (longest, target) => Math.max(longest, target.durationBeats ?? 0),
    0
  );

  return {
    timingFocus:
      title.includes("timing") ||
      title.includes("pulse") ||
      title.includes("rytm") ||
      title.includes("precyzje"),
    pickingFocus:
      title.includes("picking") ||
      title.includes("kostk") ||
      title.includes("powtarzalnosc"),
    sustainFocus: maxDurationBeats >= 1,
    releaseFocus: (chartSummary.restCount ?? 0) > 0 || maxDurationBeats >= 1,
    streakFocus: targetSequence.length >= 4,
    beginnerFriendly: training.difficulty === "beginner",
    tempoBpm: training.tempoBpm ?? 90,
    chartLengthBeats: chartSummary.chartLengthBeats ?? 0
  };
}

function buildTrainingSectionProfiles(training) {
  const sectionMap = new Map(
    (training.chart?.sections ?? []).map((section) => [
      section.id,
      {
        sectionId: section.id,
        sectionLabel: section.label,
        targetCount: 0,
        totalDurationBeats: 0,
        startBeat: section.startBeat ?? 0,
        lengthBeats: section.lengthBeats ?? 0
      }
    ])
  );

  for (const target of training.targetSequence ?? []) {
    const sectionId = target.sectionId ?? "main";
    const currentSection = sectionMap.get(sectionId) ?? {
      sectionId,
      sectionLabel: sectionId,
      targetCount: 0,
      totalDurationBeats: 0,
      startBeat: target.beatOffset ?? 0,
      lengthBeats: 0
    };

    currentSection.targetCount += 1;
    currentSection.totalDurationBeats += target.durationBeats ?? 0;
    sectionMap.set(sectionId, currentSection);
  }

  return [...sectionMap.values()].sort((left, right) => left.startBeat - right.startBeat);
}

function calculateSectionWeakness(sectionBreakdownEntry) {
  const accuracyPenalty = (1 - (sectionBreakdownEntry.accuracy ?? 0)) * 70;
  const missPenalty = (sectionBreakdownEntry.missedTargetCount ?? 0) * 12;
  const ghostPenalty = (sectionBreakdownEntry.ghostNoteCount ?? 0) * 8;
  const earlyReleasePenalty = (sectionBreakdownEntry.earlyReleaseCount ?? 0) * 6;
  const overholdPenalty = (sectionBreakdownEntry.overholdCount ?? 0) * 5;
  const timingPenalty = clampNumber((sectionBreakdownEntry.averageTimingOffsetMs ?? 0) / 3, 0, 14);
  const holdPenalty = clampNumber((1 - (sectionBreakdownEntry.averageHoldCoverage ?? 0)) * 18, 0, 18);
  const releasePenalty = clampNumber((sectionBreakdownEntry.averageReleaseOvershootMs ?? 0) / 5, 0, 12);

  return Number(
    (
      accuracyPenalty +
      missPenalty +
      ghostPenalty +
      earlyReleasePenalty +
      overholdPenalty +
      timingPenalty +
      holdPenalty +
      releasePenalty
    ).toFixed(2)
  );
}

function buildSectionPracticeRationale(sectionBreakdownEntry) {
  if ((sectionBreakdownEntry.missedTargetCount ?? 0) > 0) {
    return `Ta sekcja oddaje najwiecej missow (${sectionBreakdownEntry.missedTargetCount}), wiec warto petlowac ja osobno.`;
  }

  if ((sectionBreakdownEntry.ghostNoteCount ?? 0) > 0) {
    return `W tej sekcji pojawiaja sie dodatkowe uderzenia poza chartem (${sectionBreakdownEntry.ghostNoteCount}).`;
  }

  if ((sectionBreakdownEntry.earlyReleaseCount ?? 0) > (sectionBreakdownEntry.overholdCount ?? 0)) {
    return "Ta sekcja najbardziej traci na zbyt wczesnym puszczaniu nut.";
  }

  if ((sectionBreakdownEntry.overholdCount ?? 0) > 0) {
    return "Ta sekcja wymaga czystszego release miedzy targetami.";
  }

  if ((sectionBreakdownEntry.averageTimingOffsetMs ?? 0) >= 18) {
    return "To nadal najslabszy timingowo fragment ostatniego przebiegu.";
  }

  return "To najlepszy kandydat do krotkiej petli przed podniesieniem tempa calego chartu.";
}

function selectRecommendedPracticeSection({
  selectedTraining,
  latestTraining,
  latestSectionBreakdown
}) {
  if (
    !selectedTraining ||
    !latestTraining ||
    selectedTraining.id !== latestTraining.id ||
    !Array.isArray(latestSectionBreakdown) ||
    latestSectionBreakdown.length === 0
  ) {
    return null;
  }

  const sectionProfiles = buildTrainingSectionProfiles(selectedTraining);
  const scoredSections = latestSectionBreakdown
    .map((section) => ({
      ...section,
      weaknessScore: calculateSectionWeakness(section),
      trainingProfile: sectionProfiles.find((profile) => profile.sectionId === section.sectionId) ?? null
    }))
    .sort((left, right) => {
      if (right.weaknessScore !== left.weaknessScore) {
        return right.weaknessScore - left.weaknessScore;
      }

      if (left.performanceScore !== right.performanceScore) {
        return left.performanceScore - right.performanceScore;
      }

      return (right.trainingProfile?.totalDurationBeats ?? 0) - (left.trainingProfile?.totalDurationBeats ?? 0);
    });

  const recommendedSection = scoredSections[0];

  if (!recommendedSection) {
    return null;
  }

  return {
    recommendedSectionId: recommendedSection.sectionId,
    recommendedSectionLabel: recommendedSection.sectionLabel,
    recommendedSectionTargetCount: recommendedSection.targetCount,
    recommendedSectionPerformanceScore: recommendedSection.performanceScore,
    sectionAction: "loop-section",
    sectionRationale: buildSectionPracticeRationale(recommendedSection)
  };
}

function buildSectionRepetitionPlan({ latestRating, recommendedSection }) {
  if (!recommendedSection) {
    return {
      loopRepetitionCount: 1,
      loopTempoStepBpm: 0
    };
  }

  const grade = latestRating?.grade ?? "C";

  if (grade === "S") {
    return {
      loopRepetitionCount: 4,
      loopTempoStepBpm: 4
    };
  }

  if (grade === "A") {
    return {
      loopRepetitionCount: 4,
      loopTempoStepBpm: 3
    };
  }

  if (grade === "B") {
    return {
      loopRepetitionCount: 3,
      loopTempoStepBpm: 3
    };
  }

  if (grade === "C") {
    return {
      loopRepetitionCount: 3,
      loopTempoStepBpm: 2
    };
  }

  return {
    loopRepetitionCount: 2,
    loopTempoStepBpm: 0
  };
}

function deriveSessionVerificationFromSummary(summary = {}) {
  const scoreBreakdown = summary.scoreBreakdown ?? null;
  const sectionBreakdown = Array.isArray(summary.sectionBreakdown) ? summary.sectionBreakdown : [];
  const repetitions = Array.isArray(summary.practicePreset?.repetitions)
    ? summary.practicePreset.repetitions
    : [];
  const issues = [];
  const hasScoreBreakdown = Boolean(scoreBreakdown);
  const hasSectionBreakdown = sectionBreakdown.length > 0;
  const hasPracticeRepetitions = repetitions.length > 0;

  const targetAccountingMatches =
    hasScoreBreakdown &&
    (scoreBreakdown.matchedTargetCount ?? 0) + (scoreBreakdown.unmatchedTargetCount ?? 0) ===
      (scoreBreakdown.targetCount ?? 0);
  const hitAccountingMatches =
    hasScoreBreakdown &&
    (summary.notesHit ?? 0) <= (summary.notesDetected ?? 0) &&
    (scoreBreakdown.fullComboHits ?? 0) <= (scoreBreakdown.fullHits ?? 0) &&
    (scoreBreakdown.fullHits ?? 0) <= (scoreBreakdown.matchedTargetCount ?? 0);

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
      sectionTotals.targetCount === (scoreBreakdown?.targetCount ?? 0) &&
      sectionTotals.matchedTargetCount === (scoreBreakdown?.matchedTargetCount ?? 0) &&
      sectionTotals.fullComboHits === (scoreBreakdown?.fullComboHits ?? 0) &&
      sectionTotals.missedTargetCount === (scoreBreakdown?.missedTargetCount ?? 0) &&
      sectionTotals.ghostNoteCount === (scoreBreakdown?.ghostNoteCount ?? 0)
    );

  const repetitionTotals = hasPracticeRepetitions
    ? repetitions.reduce(
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
      repetitionTotals.targetCount === (scoreBreakdown?.targetCount ?? 0) &&
      repetitionTotals.fullComboHits === (scoreBreakdown?.fullComboHits ?? 0) &&
      repetitionTotals.missedTargetCount === (scoreBreakdown?.missedTargetCount ?? 0) &&
      repetitionTotals.ghostNoteCount === (scoreBreakdown?.ghostNoteCount ?? 0)
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
    targetCoverage: calculateVerificationShare(
      scoreBreakdown?.matchedTargetCount ?? 0,
      scoreBreakdown?.targetCount ?? 0
    ),
    checks: {
      hasScoreBreakdown,
      hasSectionBreakdown,
      hasPracticeRepetitions,
      targetAccountingMatches,
      hitAccountingMatches,
      sectionAccountingMatches,
      repetitionAccountingMatches,
      hasCapture: Boolean(summary.capture),
      hasDiagnostics: Boolean(summary.diagnostics?.currentCapture) || Boolean(summary.diagnostics?.notices?.length),
      hasArtifact: Boolean(summary.artifact?.filePath)
    },
    issues
  };
}

function resolveSessionVerification(summary = {}) {
  return summary.verification ?? deriveSessionVerificationFromSummary(summary);
}

function buildVerificationTrend(sessions = [], { sampleSize = 5 } = {}) {
  const sampledSessions = [...sessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, sampleSize);
  const sampledVerifications = sampledSessions.map((session) => ({
    completedAt: session.completedAt,
    verification: resolveSessionVerification(session.summary ?? {})
  }));
  const verifiedSessionCount = sampledVerifications.filter(
    (entry) => entry.verification.status === "verified"
  ).length;
  const warningSessionCount = sampledVerifications.filter(
    (entry) => entry.verification.status === "warning"
  ).length;
  const mechanicallyCompleteCount = sampledVerifications.filter(
    (entry) => entry.verification.mechanicallyComplete
  ).length;
  const issueCounts = new Map();
  let totalTargetCoverage = 0;

  for (const entry of sampledVerifications) {
    totalTargetCoverage += entry.verification.targetCoverage ?? 0;

    for (const issue of entry.verification.issues ?? []) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }

  const dominantIssueEntry = [...issueCounts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })[0] ?? null;
  const sampleCount = sampledVerifications.length;
  const latestVerification = sampledVerifications[0]?.verification ?? null;
  let trend = "stable";

  if (warningSessionCount > 0 && warningSessionCount >= verifiedSessionCount) {
    trend = "needs-attention";
  } else if (warningSessionCount > 0) {
    trend = "mixed";
  }

  return {
    sampleSize,
    analyzedSessionCount: sampleCount,
    verifiedSessionCount,
    warningSessionCount,
    mechanicallyCompleteRate:
      sampleCount === 0 ? 0 : Number((mechanicallyCompleteCount / sampleCount).toFixed(2)),
    averageTargetCoverage:
      sampleCount === 0 ? 0 : Number((totalTargetCoverage / sampleCount).toFixed(2)),
    latestStatus: latestVerification?.status ?? "unknown",
    latestCompletedAt: sampledSessions[0]?.completedAt ?? null,
    trend,
    dominantIssue: dominantIssueEntry
      ? {
          code: dominantIssueEntry[0],
          affectedSessions: dominantIssueEntry[1]
        }
      : null
  };
}

function buildProgressionSafety({ latestSession, trainings = [], targetedPractice = null }) {
  if (!latestSession) {
    return {
      status: "unknown",
      canAdvance: false,
      reason: "Brak zakonczonej sesji do oceny bezpieczenstwa progresji."
    };
  }

  const verification = resolveSessionVerification(latestSession.summary ?? {});
  const latestTraining =
    trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const suspectedOrigin = resolveVerificationHoldOrigin(latestSession);
  const technicalFallbackRouting = buildVerificationTechnicalFallbackRouting(latestSession);

  if (verification.status === "verified") {
    return {
      status: "clear",
      canAdvance: true,
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnTrainingTitle: latestTraining?.title ?? latestSession.trainingId,
      targetCoverage: verification.targetCoverage,
      reason: "Ostatnia sesja jest integralna mechanicznie i moze bezpiecznie napedzac kolejny krok progresji."
    };
  }

  return {
    status: "hold",
    canAdvance: false,
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnTrainingTitle: latestTraining?.title ?? latestSession.trainingId,
    targetCoverage: verification.targetCoverage,
    issues: verification.issues,
    dominantIssue: verification.issues[0] ?? null,
    ...(targetedPractice?.verificationGate
      ? {
          gateMode: targetedPractice.verificationGate.mode,
          heldRecoveryProgressStatus: targetedPractice.verificationGate.heldRecoveryProgressStatus,
          heldAction: targetedPractice.verificationGate.originalAction,
          heldRecommendedTrainingId: targetedPractice.verificationGate.originalRecommendedTrainingId,
          currentRecommendedTrainingId: targetedPractice.recommendedTrainingId,
          suspectedOrigin,
          ...(technicalFallbackRouting
            ? {
                technicalFallbackRouting
              }
            : {})
        }
      : {}),
    reason: "Ostatnia sesja ma warning w verification, wiec progresja powinna zostac chwilowo zatrzymana do czasu czystszego przebiegu."
  };
}

function resolveVerificationHoldOrigin(session) {
  if (!session) {
    return "clear";
  }

  return session.summary?.capture?.fallbackApplied ||
    (session.summary?.diagnostics?.notices ?? []).some((notice) => notice.level === "warning")
    ? "capture-path"
    : "progression-path";
}

function buildWarningClassBreakdownFromNotices(notices = []) {
  const warningClassCounts = new Map();

  for (const notice of notices.filter((entry) => entry.level === "warning")) {
    const issueClass = classifyNoticeIssueClass(notice);
    warningClassCounts.set(
      issueClass,
      (warningClassCounts.get(issueClass) ?? 0) + 1
    );
  }

  const totalWarningNotices = [...warningClassCounts.values()].reduce(
    (sum, eventCount) => sum + eventCount,
    0
  );
  const warningClassBreakdown = [...warningClassCounts.entries()]
    .map(([issueClass, eventCount]) => ({
      issueClass,
      eventCount,
      eventRate:
        totalWarningNotices === 0
          ? 0
          : Number((eventCount / totalWarningNotices).toFixed(2))
    }))
    .sort((left, right) => right.eventCount - left.eventCount);

  return {
    dominantWarningClass: warningClassBreakdown[0]?.issueClass ?? null,
    warningClassBreakdown
  };
}

function buildSingleSessionCaptureDiagnosticPath(session) {
  const capture = session?.summary?.capture ?? session?.summary?.diagnostics?.currentCapture ?? null;
  const notices = session?.summary?.diagnostics?.notices ?? [];

  if (!capture?.backend || !capture?.profile) {
    return null;
  }

  const warningNotices = notices.filter((notice) => notice.level === "warning");
  const runtimeRetryNotices = warningNotices.filter(
    (notice) => notice.code === "NATIVE_CAPTURE_RUNTIME_RETRY"
  );
  const warningClassSummary = buildWarningClassBreakdownFromNotices(notices);

  return {
    deviceName: capture.deviceName ?? "Unknown device",
    backend: capture.backend,
    profile: capture.profile,
    sessionCount: 1,
    fallbackCount: capture.fallbackApplied ? 1 : 0,
    fallbackRate: capture.fallbackApplied ? 1 : 0,
    sessionsWithWarnings: warningNotices.length > 0 ? 1 : 0,
    warningSessionRate: warningNotices.length > 0 ? 1 : 0,
    sessionsWithRuntimeRetry: runtimeRetryNotices.length > 0 ? 1 : 0,
    runtimeRetryRate: runtimeRetryNotices.length > 0 ? 1 : 0,
    warningNoticeCount: warningNotices.length,
    averageWarningNotices: warningNotices.length,
    runtimeRetryCount: runtimeRetryNotices.length,
    totalStartAttempts: capture.startAttemptCount ?? 1,
    averageStartAttempts: capture.startAttemptCount ?? 1,
    totalSampleRate: capture.sampleRate ?? 0,
    sampleRateCount: capture.sampleRate ? 1 : 0,
    averageSampleRate: capture.sampleRate ?? 0,
    totalBufferMs: capture.bufferMs ?? 0,
    bufferCount: capture.bufferMs !== undefined ? 1 : 0,
    averageBufferMs: capture.bufferMs ?? 0,
    totalNumberOfBuffers: capture.numberOfBuffers ?? 0,
    numberOfBuffersCount: capture.numberOfBuffers !== undefined ? 1 : 0,
    averageNumberOfBuffers: capture.numberOfBuffers ?? 0,
    totalMaxChunkGapMs: capture.maxChunkGapMs ?? 0,
    maxChunkGapCount: capture.maxChunkGapMs !== undefined ? 1 : 0,
    averageMaxChunkGapMs: capture.maxChunkGapMs ?? 0,
    totalLowSignalEventCount: capture.lowSignalEventCount ?? 0,
    totalLowSignalChunkCount: capture.lowSignalChunkCount ?? 0,
    latestCompletedAt: session?.completedAt ?? "",
    ...warningClassSummary
  };
}

function buildCapturePrimarySetupRecommendation(session) {
  const capturePath = buildSingleSessionCaptureDiagnosticPath(session);

  if (!capturePath) {
    return null;
  }

  const scores = calculatePathScores(capturePath, 0, null);
  const setupRecommendations = buildSetupRecommendations(capturePath, scores);
  return setupRecommendations[0] ?? null;
}

function buildVerificationTechnicalFallbackRouting(session) {
  if (!session || resolveVerificationHoldOrigin(session) !== "capture-path") {
    return null;
  }

  const currentCapture = session.summary?.capture ?? session.summary?.diagnostics?.currentCapture ?? null;
  const warningNotices = (session.summary?.diagnostics?.notices ?? []).filter(
    (notice) => notice.level === "warning" && notice.capture?.backend
  );
  const primarySetupRecommendation = buildCapturePrimarySetupRecommendation(session);
  const recommendedNotice =
    warningNotices.find((notice) => notice.code === "NATIVE_CAPTURE_PREFLIGHT_FALLBACK") ??
    warningNotices.find((notice) => notice.code === "NATIVE_CAPTURE_RUNTIME_RETRY") ??
    warningNotices[0] ??
    null;

  if (recommendedNotice?.capture?.backend) {
    return {
      mode: "use-recommended-capture-path",
      backend: recommendedNotice.capture.backend,
      profile: recommendedNotice.capture.profile ?? currentCapture?.profile ?? null,
      deviceName: recommendedNotice.capture.deviceName ?? currentCapture?.deviceName ?? null,
      sourceNoticeCode: recommendedNotice.code,
      requestedBackend: currentCapture?.requestedBackend ?? null,
      requestedProfile: currentCapture?.requestedProfile ?? null,
      ...(primarySetupRecommendation
        ? {
            primarySetupRecommendation
          }
        : {}),
      reason: recommendedNotice.message
    };
  }

  if (currentCapture?.fallbackApplied && currentCapture.backend) {
    return {
      mode: "reuse-last-fallback-path",
      backend: currentCapture.backend,
      profile: currentCapture.profile ?? null,
      deviceName: currentCapture.deviceName ?? null,
      sourceNoticeCode: null,
      requestedBackend: currentCapture.requestedBackend ?? null,
      requestedProfile: currentCapture.requestedProfile ?? null,
      ...(primarySetupRecommendation
        ? {
            primarySetupRecommendation
          }
        : {}),
      reason:
        currentCapture.fallbackReason ??
        "Ostatnia sesja korzystala z fallback capture. Warto zostac przy tym pathie do czasu czystszego przebiegu."
    };
  }

  return null;
}

function buildVerificationIssueDrilldown(
  sessions = [],
  { sampleSize = 10, resolveTrainingTitle = null } = {}
) {
  const sampledSessions = [...sessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, sampleSize);
  const warningSessions = sampledSessions
    .map((session) => ({
      session,
      verification: resolveSessionVerification(session.summary ?? {})
    }))
    .filter((entry) => entry.verification.status === "warning");
  const issueGroups = new Map();

  function updateDrilldownGroup(groups, key, seed) {
    const current = groups.get(key) ?? {
      ...seed,
      sessionCount: 0,
      warningSessionCount: 0,
      issueCounts: new Map(),
      latestCompletedAt: null
    };

    return current;
  }

  function buildDimensionBreakdown(resolveKey, buildSeed) {
    const groups = new Map();

    for (const session of sampledSessions) {
      const verification = resolveSessionVerification(session.summary ?? {});
      const key = resolveKey(session);
      const current = updateDrilldownGroup(groups, key, buildSeed(session));

      current.sessionCount += 1;
      current.latestCompletedAt =
        current.latestCompletedAt && current.latestCompletedAt > session.completedAt
          ? current.latestCompletedAt
          : session.completedAt;

      if (verification.status === "warning") {
        current.warningSessionCount += 1;

        for (const issue of verification.issues) {
          current.issueCounts.set(issue, (current.issueCounts.get(issue) ?? 0) + 1);
        }
      }

      groups.set(key, current);
    }

    return [...groups.values()]
      .map((group) => {
        const dominantIssueEntry = [...group.issueCounts.entries()]
          .sort((left, right) => {
            if (right[1] !== left[1]) {
              return right[1] - left[1];
            }

            return left[0].localeCompare(right[0]);
          })[0] ?? null;

        return {
          ...Object.fromEntries(
            Object.entries(group).filter(([key]) => key !== "issueCounts")
          ),
          warningRate:
            group.sessionCount === 0
              ? 0
              : Number((group.warningSessionCount / group.sessionCount).toFixed(2)),
          dominantIssue: dominantIssueEntry
            ? {
                code: dominantIssueEntry[0],
                affectedSessions: dominantIssueEntry[1]
              }
            : null
        };
      })
      .sort((left, right) => {
        if (right.warningSessionCount !== left.warningSessionCount) {
          return right.warningSessionCount - left.warningSessionCount;
        }

        if (right.sessionCount !== left.sessionCount) {
          return right.sessionCount - left.sessionCount;
        }

        return String(left.latestCompletedAt ?? "").localeCompare(String(right.latestCompletedAt ?? "")) * -1;
      });
  }

  for (const { session, verification } of warningSessions) {
    const captureSource = session.summary?.capture?.source ?? session.inputMode ?? "unknown";
    const practiceScope = session.practiceScope ?? session.summary?.practicePreset?.scope ?? "full-chart";
    const trainingId = session.trainingId;
    const trainingTitle =
      typeof resolveTrainingTitle === "function"
        ? resolveTrainingTitle(trainingId) ?? trainingId
        : trainingId;

    for (const issue of verification.issues) {
      const currentIssue = issueGroups.get(issue) ?? {
        code: issue,
        affectedSessions: 0,
        latestCompletedAt: null,
        captureSources: new Set(),
        practiceScopes: new Set(),
        trainingIds: new Set(),
        trainingTitles: new Set()
      };

      currentIssue.affectedSessions += 1;
      currentIssue.latestCompletedAt =
        currentIssue.latestCompletedAt && currentIssue.latestCompletedAt > session.completedAt
          ? currentIssue.latestCompletedAt
          : session.completedAt;
      currentIssue.captureSources.add(captureSource);
      currentIssue.practiceScopes.add(practiceScope);
      currentIssue.trainingIds.add(trainingId);
      currentIssue.trainingTitles.add(trainingTitle);
      issueGroups.set(issue, currentIssue);
    }
  }

  return {
    sampleSize,
    analyzedSessionCount: sampledSessions.length,
    warningSessionCount: warningSessions.length,
    issueGroups: [...issueGroups.values()]
      .map((group) => ({
        code: group.code,
        affectedSessions: group.affectedSessions,
        latestCompletedAt: group.latestCompletedAt,
        captureSources: [...group.captureSources].sort(),
        practiceScopes: [...group.practiceScopes].sort(),
        trainingIds: [...group.trainingIds].sort(),
        trainingTitles: [...group.trainingTitles].sort()
      }))
      .sort((left, right) => {
        if (right.affectedSessions !== left.affectedSessions) {
          return right.affectedSessions - left.affectedSessions;
        }

        return String(right.latestCompletedAt).localeCompare(String(left.latestCompletedAt));
      }),
    byCaptureSource: buildDimensionBreakdown(
      (session) => session.summary?.capture?.source ?? session.inputMode ?? "unknown",
      (session) => ({
        captureSource: session.summary?.capture?.source ?? session.inputMode ?? "unknown"
      })
    ),
    byPracticeScope: buildDimensionBreakdown(
      (session) => session.practiceScope ?? session.summary?.practicePreset?.scope ?? "full-chart",
      (session) => ({
        practiceScope: session.practiceScope ?? session.summary?.practicePreset?.scope ?? "full-chart"
      })
    ),
    byTraining: buildDimensionBreakdown(
      (session) => session.trainingId,
      (session) => ({
        trainingId: session.trainingId,
        trainingTitle:
          typeof resolveTrainingTitle === "function"
            ? resolveTrainingTitle(session.trainingId) ?? session.trainingId
            : session.trainingId
      })
    )
  };
}

function buildVerificationHoldDrilldown(
  sessions = [],
  trainings = [],
  { sampleSize = 10 } = {}
) {
  const sortedSessions = [...sessions].sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  const sampledSessions = sortedSessions.slice(-sampleSize);
  const holdGroups = new Map();
  const trainingGroups = new Map();
  const captureSourceGroups = new Map();
  const captureBackendGroups = new Map();
  const captureProfileGroups = new Map();
  const recommendedCapturePathGroups = new Map();
  let holdSessionCount = 0;
  let latestHoldEntry = null;
  let technicalHoldSessionCount = 0;
  let progressionHoldSessionCount = 0;

  function updateHoldGroup(groups, key, seed, gate, session) {
    const current = groups.get(key) ?? {
      ...seed,
      holdSessionCount: 0,
      latestCompletedAt: null,
      issueCounts: new Map()
    };

    current.holdSessionCount += 1;
    current.latestCompletedAt =
      current.latestCompletedAt && current.latestCompletedAt > session.completedAt
        ? current.latestCompletedAt
        : session.completedAt;

    for (const issue of gate.issueCodes ?? []) {
      current.issueCounts.set(issue, (current.issueCounts.get(issue) ?? 0) + 1);
    }

    groups.set(key, current);
  }

  function finalizeHoldGroups(groups) {
    return [...groups.values()]
      .map((group) => {
        const dominantIssueEntry = [...group.issueCounts.entries()]
          .sort((left, right) => {
            if (right[1] !== left[1]) {
              return right[1] - left[1];
            }

            return left[0].localeCompare(right[0]);
          })[0] ?? null;

        return {
          ...Object.fromEntries(
            Object.entries(group).filter(([key]) => key !== "issueCounts")
          ),
          dominantIssue: dominantIssueEntry
            ? {
                code: dominantIssueEntry[0],
                affectedSessions: dominantIssueEntry[1]
              }
            : null
        };
      })
      .sort((left, right) => {
        if (right.holdSessionCount !== left.holdSessionCount) {
          return right.holdSessionCount - left.holdSessionCount;
        }

        return String(right.latestCompletedAt).localeCompare(String(left.latestCompletedAt));
      });
  }

  for (const sampledSession of sampledSessions) {
    const sessionIndex = sortedSessions.findIndex((session) => session.id === sampledSession.id);

    if (sessionIndex === -1) {
      continue;
    }

    const scopedSessions = sortedSessions.slice(0, sessionIndex + 1);
    const targetedPractice = buildTargetedPracticeRecommendation({
      completedSessions: scopedSessions,
      trainings
    });
    const verificationGate = targetedPractice?.verificationGate ?? null;

    if (verificationGate?.mode !== "hold-current-stage") {
      continue;
    }

    holdSessionCount += 1;
    latestHoldEntry = {
      session: sampledSession,
      verificationGate
    };

    const heldRecoveryProgressStatus = verificationGate.heldRecoveryProgressStatus ?? "general";
    const heldTraining = trainings.find(
      (training) => training.id === (verificationGate.originalRecommendedTrainingId ?? sampledSession.trainingId)
    ) ?? null;
    const captureSource = sampledSession.summary?.capture?.source ?? sampledSession.inputMode ?? "unknown";
    const captureBackend = sampledSession.summary?.capture?.backend ?? "unknown";
    const captureProfile = sampledSession.summary?.capture?.profile ?? "unknown";
    const holdOrigin = resolveVerificationHoldOrigin(sampledSession);
    const technicalFallbackRouting = buildVerificationTechnicalFallbackRouting(sampledSession);

    if (holdOrigin === "capture-path") {
      technicalHoldSessionCount += 1;
    } else {
      progressionHoldSessionCount += 1;
    }

    updateHoldGroup(
      holdGroups,
      heldRecoveryProgressStatus,
      {
        recoveryProgressStatus: heldRecoveryProgressStatus,
        trainingIds: new Set(),
        trainingTitles: new Set()
      },
      verificationGate,
      sampledSession
    );

    const holdGroup = holdGroups.get(heldRecoveryProgressStatus);
    holdGroup.trainingIds.add(heldTraining?.id ?? sampledSession.trainingId);
    holdGroup.trainingTitles.add(heldTraining?.title ?? verificationGate.originalRecommendedTrainingId ?? sampledSession.trainingId);

    updateHoldGroup(
      trainingGroups,
      heldTraining?.id ?? sampledSession.trainingId,
      {
        trainingId: heldTraining?.id ?? sampledSession.trainingId,
        trainingTitle: heldTraining?.title ?? verificationGate.originalRecommendedTrainingId ?? sampledSession.trainingId,
        heldRecoveryProgressStatuses: new Set()
      },
      verificationGate,
      sampledSession
    );

    trainingGroups
      .get(heldTraining?.id ?? sampledSession.trainingId)
      ?.heldRecoveryProgressStatuses.add(heldRecoveryProgressStatus);

    updateHoldGroup(
      captureSourceGroups,
      captureSource,
      {
        captureSource
      },
      verificationGate,
      sampledSession
    );
    updateHoldGroup(
      captureBackendGroups,
      captureBackend,
      {
        captureBackend
      },
      verificationGate,
      sampledSession
    );
    updateHoldGroup(
      captureProfileGroups,
      captureProfile,
      {
        captureProfile
      },
      verificationGate,
      sampledSession
    );

    if (technicalFallbackRouting?.backend) {
      const recommendedCapturePathKey = JSON.stringify({
        backend: technicalFallbackRouting.backend,
        profile: technicalFallbackRouting.profile ?? "unknown"
      });

      updateHoldGroup(
        recommendedCapturePathGroups,
        recommendedCapturePathKey,
        {
          backend: technicalFallbackRouting.backend,
          profile: technicalFallbackRouting.profile ?? "unknown",
          deviceName: technicalFallbackRouting.deviceName ?? null,
          sourceNoticeCodes: new Set()
        },
        verificationGate,
        sampledSession
      );

      const recommendedCapturePathGroup = recommendedCapturePathGroups.get(recommendedCapturePathKey);
      if (technicalFallbackRouting.sourceNoticeCode) {
        recommendedCapturePathGroup.sourceNoticeCodes.add(technicalFallbackRouting.sourceNoticeCode);
      }
    }
  }

  const byRecoveryProgressStatus = finalizeHoldGroups(holdGroups).map((group) => ({
    ...group,
    trainingIds: [...group.trainingIds].sort(),
    trainingTitles: [...group.trainingTitles].sort()
  }));
  const byTraining = finalizeHoldGroups(trainingGroups).map((group) => ({
    ...group,
    heldRecoveryProgressStatuses: [...group.heldRecoveryProgressStatuses].sort()
  }));
  const byCaptureSource = finalizeHoldGroups(captureSourceGroups);
  const byCaptureBackend = finalizeHoldGroups(captureBackendGroups);
  const byCaptureProfile = finalizeHoldGroups(captureProfileGroups);
  const byRecommendedCapturePath = finalizeHoldGroups(recommendedCapturePathGroups).map((group) => ({
    ...group,
    sourceNoticeCodes: [...group.sourceNoticeCodes].sort()
  }));
  let suspectedOrigin = "clear";

  if (holdSessionCount > 0) {
    if (technicalHoldSessionCount === holdSessionCount) {
      suspectedOrigin = "capture-path";
    } else if (progressionHoldSessionCount === holdSessionCount) {
      suspectedOrigin = "progression-path";
    } else {
      suspectedOrigin = "mixed";
    }
  }

  return {
    sampleSize,
    analyzedSessionCount: sampledSessions.length,
    holdSessionCount,
    latestStatus: latestHoldEntry ? "hold" : "clear",
    latestCompletedAt: latestHoldEntry?.session.completedAt ?? null,
    dominantHoldStatus: byRecoveryProgressStatus[0] ?? null,
    suspectedOrigin,
    technicalHoldSessionCount,
    progressionHoldSessionCount,
    byRecoveryProgressStatus,
    byTraining,
    byCaptureSource,
    byCaptureBackend,
    byCaptureProfile,
    byRecommendedCapturePath
  };
}

function applyVerificationGateToRecommendation({
  recommendation,
  latestSession,
  latestTraining,
  latestPracticePreset,
  latestFeedback
}) {
  if (!recommendation || !latestSession) {
    return recommendation;
  }

  const verification = resolveSessionVerification(latestSession.summary ?? {});

  if (verification.status !== "warning") {
    return recommendation;
  }

  const suspectedOrigin = resolveVerificationHoldOrigin(latestSession);
  const technicalFallbackRouting = buildVerificationTechnicalFallbackRouting(latestSession);

  const verificationGate = {
    mode: "observe-only",
    status: "hold-progression",
    issueCodes: verification.issues,
    dominantIssue: verification.issues[0] ?? null,
    targetCoverage: verification.targetCoverage,
    suspectedOrigin,
    heldRecoveryProgressStatus: recommendation.recoveryProgressStatus ?? null,
    originalAction: recommendation.action ?? null,
    originalRecommendedTrainingId: recommendation.recommendedTrainingId ?? null,
    ...(technicalFallbackRouting
      ? {
          technicalFallbackRouting
        }
      : {}),
    reason:
      "Ostatnia sesja ma warning w verification, wiec system wstrzymuje agresywniejsza progresje do czasu czystszego przebiegu."
  };

  const recoveryProgressStatus = recommendation.recoveryProgressStatus ?? null;
  const shouldHoldProgression =
    !recoveryProgressStatus ||
    recoveryProgressStatus === "goal-ready" ||
    recoveryProgressStatus === "return-confirmed" ||
    recoveryProgressStatus === "full-chart-reintegrated" ||
    recoveryProgressStatus === "promotion-graduated" ||
    recoveryProgressStatus === "terminal-training-mastery" ||
    recoveryProgressStatus.endsWith("-confirmed") ||
    recoveryProgressStatus.endsWith("-graduated");

  if (!shouldHoldProgression) {
    return {
      ...recommendation,
      verificationGate
    };
  }

  verificationGate.mode = "hold-current-stage";

  const focusSummary = latestFeedback?.focusAreas?.join(", ") ?? "powtarzalnym, czystym przebiegu";
  const technicalFallbackStep = technicalFallbackRouting
    ? ` Technicznie: wroc do backendu ${technicalFallbackRouting.backend}${technicalFallbackRouting.profile ? ` / profilu ${technicalFallbackRouting.profile}` : ""}${technicalFallbackRouting.deviceName ? ` na "${technicalFallbackRouting.deviceName}"` : ""}.`
    : "";
  const heldTempoBpm = clampNumber(
    latestPracticePreset?.tempoBpm ?? latestTraining?.tempoBpm ?? recommendation.suggestedTempoBpm ?? 90,
    60,
    160
  );
  const heldPracticeScope = latestPracticePreset?.scope ?? recommendation.practiceScopeOverride ?? "full-chart";
  const heldSectionId =
    heldPracticeScope === "section-loop"
      ? latestPracticePreset?.loopSectionId ??
        recommendation.practiceSectionId ??
        recommendation.recommendedSectionId ??
        null
      : null;
  const heldSectionLabel =
    heldSectionId
      ? latestPracticePreset?.loopSectionLabel ??
        recommendation.practiceSectionLabel ??
        recommendation.recommendedSectionLabel ??
        heldSectionId
      : null;
  const heldLoopRepetitionCount =
    heldSectionId
      ? latestPracticePreset?.loopRepetitionCount ??
        recommendation.loopRepetitionCount ??
        2
      : undefined;
  const {
    recommendedSectionId: _recommendedSectionId,
    recommendedSectionLabel: _recommendedSectionLabel,
    recommendedSectionTargetCount: _recommendedSectionTargetCount,
    recommendedSectionPerformanceScore: _recommendedSectionPerformanceScore,
    sectionAction: _sectionAction,
    sectionRationale: _sectionRationale,
    practiceSectionId: _practiceSectionId,
    practiceSectionLabel: _practiceSectionLabel,
    practiceSectionMode: _practiceSectionMode,
    practiceSectionReason: _practiceSectionReason,
    loopRepetitionCount: _loopRepetitionCount,
    loopTempoStepBpm: _loopTempoStepBpm,
    ...baseRecommendation
  } = recommendation;

  return {
    ...baseRecommendation,
    recommendedTrainingId: latestTraining?.id ?? baseRecommendation.recommendedTrainingId,
    recommendedTrainingTitle: latestTraining?.title ?? baseRecommendation.recommendedTrainingTitle,
    recommendedDifficulty: latestTraining?.difficulty ?? baseRecommendation.recommendedDifficulty,
    suggestedTempoBpm: heldTempoBpm,
    action: "repeat-current",
    practiceScopeOverride: heldPracticeScope,
    ...(heldSectionId
      ? {
          recommendedSectionId: heldSectionId,
          recommendedSectionLabel: heldSectionLabel,
          sectionAction: "loop-section",
          practiceSectionId: heldSectionId,
          practiceSectionLabel: heldSectionLabel,
          practiceSectionMode: baseRecommendation.practiceSectionMode ?? "verification-hold-section",
          practiceSectionReason:
            "Ostatnia sesja wymaga jeszcze czystszego przebiegu verification, zanim system pozwoli na kolejny skok progresji.",
          loopRepetitionCount: heldLoopRepetitionCount,
          loopTempoStepBpm: 0
        }
      : {}),
    verificationGate,
    rationale: `${recommendation.rationale} ${verificationGate.reason}`.trim(),
    nextStep: heldSectionId
      ? `Powtorz "${latestTraining?.title ?? recommendation.recommendedTrainingTitle}" / "${heldSectionLabel}" na ${heldTempoBpm} BPM bez dalszego podbijania tempa i skup sie na ${focusSummary}.${technicalFallbackStep}`.trim()
      : `Powtorz "${latestTraining?.title ?? recommendation.recommendedTrainingTitle}" na ${heldTempoBpm} BPM bez dalszej progresji i skup sie na ${focusSummary}.${technicalFallbackStep}`.trim(),
    matchedReasons: [...new Set([...(baseRecommendation.matchedReasons ?? []), "verification-hold"])]
  };
}

function getDifficultyRank(difficulty) {
  if (difficulty === "beginner") {
    return 1;
  }

  if (difficulty === "intermediate") {
    return 2;
  }

  if (difficulty === "advanced") {
    return 3;
  }

  return 99;
}

function getGradeRank(grade) {
  if (grade === "S") {
    return 5;
  }

  if (grade === "A") {
    return 4;
  }

  if (grade === "B") {
    return 3;
  }

  if (grade === "C") {
    return 2;
  }

  if (grade === "D") {
    return 1;
  }

  return 0;
}

function isGradeAtLeast(grade, minimumGrade) {
  return getGradeRank(grade) >= getGradeRank(minimumGrade);
}

function findTrainingSection(training, sectionId) {
  if (!training || !sectionId) {
    return null;
  }

  return training.chart?.sections?.find((section) => section.id === sectionId) ?? null;
}

function buildSectionMasteryPlan({ latestPracticePreset, recommendedSection, fallbackPlan, fallbackTempoBpm }) {
  const masteryGate = latestPracticePreset?.masteryGate;
  const adaptiveExecution = latestPracticePreset?.adaptiveExecution;
  const adaptiveRetryPlan = adaptiveExecution?.retryPlan ?? null;

  if (
    !recommendedSection ||
    latestPracticePreset?.scope !== "section-loop" ||
    latestPracticePreset.loopSectionId !== recommendedSection.recommendedSectionId ||
    !masteryGate
  ) {
    return {
      masteryGate: null,
      adaptiveExecution: adaptiveExecution ?? null,
      suggestedTempoBpm: fallbackTempoBpm,
      loopRepetitionCount: fallbackPlan.loopRepetitionCount,
      loopTempoStepBpm: fallbackPlan.loopTempoStepBpm,
      rationale: null,
      nextStep: null
    };
  }

  const baseLoopRepetitionCount =
    latestPracticePreset.loopRepetitionCount ?? fallbackPlan.loopRepetitionCount;
  const baseLoopTempoStepBpm =
    latestPracticePreset.loopTempoStepBpm ?? fallbackPlan.loopTempoStepBpm;
  const recommendedNextTempoBpm = clampNumber(
    masteryGate.recommendedNextTempoBpm ?? fallbackTempoBpm,
    40,
    240
  );

  if (adaptiveRetryPlan) {
    return {
      masteryGate,
      adaptiveExecution: adaptiveExecution ?? null,
      suggestedTempoBpm: clampNumber(adaptiveRetryPlan.tempoBpm, 40, 240),
      loopRepetitionCount: adaptiveRetryPlan.loopRepetitionCount,
      loopTempoStepBpm: adaptiveRetryPlan.loopTempoStepBpm,
      rationale: `Engine ulozyl plan ratunkowy (${adaptiveRetryPlan.strategy}) po zatrzymaniu progresji sekcji.`,
      nextStep: `Powtorz sekcje "${recommendedSection.recommendedSectionLabel}" na ${adaptiveRetryPlan.tempoBpm} BPM przez ${adaptiveRetryPlan.loopRepetitionCount} petle${adaptiveRetryPlan.loopTempoStepBpm > 0 ? ` z krokiem +${adaptiveRetryPlan.loopTempoStepBpm} BPM` : " bez dalszej progresji BPM"}. ${adaptiveRetryPlan.reason}`
    };
  }

  if (masteryGate.status === "ready-to-advance") {
    return {
      masteryGate,
      adaptiveExecution: adaptiveExecution ?? null,
      suggestedTempoBpm: recommendedNextTempoBpm,
      loopRepetitionCount: Math.max(baseLoopRepetitionCount, 3),
      loopTempoStepBpm: Math.max(baseLoopTempoStepBpm, 2),
      rationale: `Sekcyjny gate zostal zaliczony (${masteryGate.passedRepetitionCount}/${masteryGate.totalRepetitionCount} powtorek).`,
      nextStep: `Wroc do sekcji "${recommendedSection.recommendedSectionLabel}" od ${recommendedNextTempoBpm} BPM i utrzymaj progresje ${Math.max(baseLoopRepetitionCount, 3)} powtorek z krokiem +${Math.max(baseLoopTempoStepBpm, 2)} BPM.`
    };
  }

  if (masteryGate.status === "keep-building") {
    return {
      masteryGate,
      adaptiveExecution: adaptiveExecution ?? null,
      suggestedTempoBpm: recommendedNextTempoBpm,
      loopRepetitionCount: Math.max(baseLoopRepetitionCount, 3),
      loopTempoStepBpm: 0,
      rationale: `Sekcja trzyma sie tylko czesciowo (${masteryGate.passedRepetitionCount}/${masteryGate.totalRepetitionCount} zaliczonych powtorek).`,
      nextStep: `Zostan na ${recommendedNextTempoBpm} BPM i dopnij cala sekcje "${recommendedSection.recommendedSectionLabel}" bez dalszego podbijania tempa, az wszystkie powtorki przejda gate.`
    };
  }

  return {
    masteryGate,
    adaptiveExecution: adaptiveExecution ?? null,
    suggestedTempoBpm: recommendedNextTempoBpm,
    loopRepetitionCount: Math.max(baseLoopRepetitionCount, 3),
    loopTempoStepBpm: 0,
    rationale: "Sekcja nie trzyma jeszcze bazowego poziomu w planie powtorek.",
    nextStep: `Wroc do ${recommendedNextTempoBpm} BPM i ustabilizuj sekcje "${recommendedSection.recommendedSectionLabel}" w rownym loopie bez progresji BPM.`
  };
}

function selectRecoveryPracticeSection({ training, recommendedSection, masteryPlan }) {
  if (!training || !recommendedSection) {
    return null;
  }

  const adaptiveRetryPlan = masteryPlan?.adaptiveExecution?.retryPlan;

  if (!adaptiveRetryPlan) {
    return null;
  }

  const sectionProfiles = buildTrainingSectionProfiles(training);
  const recommendedIndex = sectionProfiles.findIndex(
    (section) => section.sectionId === recommendedSection.recommendedSectionId
  );

  if (recommendedIndex === -1) {
    return null;
  }

  if (
    adaptiveRetryPlan.strategy === "rebuild-base-tempo" ||
    adaptiveRetryPlan.strategy === "drop-tempo-step"
  ) {
    const previousSection = sectionProfiles[recommendedIndex - 1] ?? null;

    if (previousSection) {
      return {
        sectionId: previousSection.sectionId,
        sectionLabel: previousSection.sectionLabel,
        mode: "recovery-section",
        reason: `Zanim wrocisz do "${recommendedSection.recommendedSectionLabel}", odbuduj kontrolę na poprzedniej sekcji "${previousSection.sectionLabel}".`
      };
    }
  }

  return {
    sectionId: recommendedSection.recommendedSectionId,
    sectionLabel: recommendedSection.recommendedSectionLabel,
    mode: "focus-section",
    reason: adaptiveRetryPlan.reason
  };
}

function selectRecoveryTraining({
  scoredTrainings,
  latestTraining,
  latestRating,
  masteryPlan
}) {
  const adaptiveRetryPlan = masteryPlan?.adaptiveExecution?.retryPlan;

  if (!adaptiveRetryPlan || !latestTraining) {
    return null;
  }

  const latestTrainingDifficultyRank = getDifficultyRank(latestTraining.difficulty);
  const shouldRouteToSimplerTraining =
    adaptiveRetryPlan.strategy === "rebuild-base-tempo" ||
    (
      adaptiveRetryPlan.strategy === "drop-tempo-step" &&
      ["D", "F"].includes(latestRating?.grade ?? "F")
    );

  if (!shouldRouteToSimplerTraining || latestTrainingDifficultyRank <= 1) {
    return null;
  }

  const fallbackTrainingEntry = scoredTrainings.find(({ training }) => {
    if (training.id === latestTraining.id) {
      return false;
    }

    return getDifficultyRank(training.difficulty) < latestTrainingDifficultyRank;
  });

  if (!fallbackTrainingEntry) {
    return null;
  }

  return {
    trainingId: fallbackTrainingEntry.training.id,
    trainingTitle: fallbackTrainingEntry.training.title,
    difficulty: fallbackTrainingEntry.training.difficulty,
    reason: `Obecny chart jest jeszcze zbyt niestabilny. Wejdz chwilowo w prostszy trening "${fallbackTrainingEntry.training.title}", zanim wrocisz do trudniejszego materialu.`,
    sourceStrategy: adaptiveRetryPlan.strategy
  };
}

function hasRecoveryGoalUnlocked(latestSession) {
  const accuracy = latestSession.summary?.accuracy ?? 0;
  const rating = latestSession.summary?.rating ?? null;
  const masteryGate = latestSession.summary?.practicePreset?.masteryGate ?? null;

  if (masteryGate?.status === "ready-to-advance") {
    return true;
  }

  if (
    masteryGate?.status === "keep-building" &&
    isGradeAtLeast(rating?.grade ?? "F", "B") &&
    accuracy >= 0.82
  ) {
    return true;
  }

  return isGradeAtLeast(rating?.grade ?? "F", "B") && accuracy >= 0.85;
}

function buildRecoveryMilestone({
  latestSession,
  completedSessions
}) {
  const recoveryContext = latestSession.summary?.practiceRecoveryContext ?? null;

  if (!recoveryContext?.goalTrainingId) {
    return null;
  }

  const matchingRecoverySessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionRecoveryContext = session.summary?.practiceRecoveryContext ?? null;

      if (!sessionRecoveryContext?.goalTrainingId) {
        return false;
      }

      return (
        sessionRecoveryContext.goalTrainingId === recoveryContext.goalTrainingId &&
        (sessionRecoveryContext.goalSectionId ?? null) === (recoveryContext.goalSectionId ?? null)
      );
    })
    .slice(0, 3);

  const requiredStableSessions = 2;
  let stableSessionCount = 0;

  for (const session of matchingRecoverySessions) {
    if (!hasRecoveryGoalUnlocked(session)) {
      break;
    }

    stableSessionCount += 1;
  }

  return {
    requiredStableSessions,
    stableSessionCount,
    consideredSessionCount: matchingRecoverySessions.length,
    latestUnlocked: hasRecoveryGoalUnlocked(latestSession),
    isReadyToReturn: stableSessionCount >= requiredStableSessions
  };
}

function isReturnAttemptSuccessful(session) {
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  return (
    isGradeAtLeast(rating?.grade ?? "F", "C") &&
    accuracy >= 0.75 &&
    (scoreBreakdown.missedTargetCount ?? 0) <= 2 &&
    (scoreBreakdown.ghostNoteCount ?? 0) <= 1
  );
}

function isReturnAttemptFailed(session) {
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  return (
    !isGradeAtLeast(rating?.grade ?? "F", "C") ||
    accuracy < 0.68 ||
    (scoreBreakdown.missedTargetCount ?? 0) >= 3 ||
    (scoreBreakdown.ghostNoteCount ?? 0) >= 3
  );
}

function buildReturnAttemptMilestone({
  latestSession,
  completedSessions
}) {
  const returnContext = latestSession.summary?.practiceReturnContext ?? null;

  if (!returnContext?.recoveryTrainingId) {
    return null;
  }

  const matchingReturnSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionReturnContext = session.summary?.practiceReturnContext ?? null;

      if (!sessionReturnContext?.recoveryTrainingId) {
        return false;
      }

      return (
        sessionReturnContext.recoveryTrainingId === returnContext.recoveryTrainingId &&
        (sessionReturnContext.goalSectionId ?? null) === (returnContext.goalSectionId ?? null)
      );
    })
    .slice(0, 3);

  const requiredStableReturnSessions = 2;
  let stableReturnSessionCount = 0;

  for (const session of matchingReturnSessions) {
    if (!isReturnAttemptSuccessful(session)) {
      break;
    }

    stableReturnSessionCount += 1;
  }

  return {
    requiredStableReturnSessions,
    stableReturnSessionCount,
    consideredSessionCount: matchingReturnSessions.length,
    latestSuccessful: isReturnAttemptSuccessful(latestSession),
    latestFailed: isReturnAttemptFailed(latestSession),
    isConfirmed: stableReturnSessionCount >= requiredStableReturnSessions
  };
}

function isFullChartReintegrationSuccessful(session) {
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};
  const practicePreset = session.summary?.practicePreset ?? null;

  return (
    practicePreset?.scope === "full-chart" &&
    isGradeAtLeast(rating?.grade ?? "F", "B") &&
    accuracy >= 0.82 &&
    (scoreBreakdown.missedTargetCount ?? 0) <= 1 &&
    (scoreBreakdown.ghostNoteCount ?? 0) === 0
  );
}

function isFullChartReintegrationFailed(session) {
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};
  const practicePreset = session.summary?.practicePreset ?? null;

  return (
    practicePreset?.scope === "full-chart" &&
    (
      !isGradeAtLeast(rating?.grade ?? "F", "C") ||
      accuracy < 0.72 ||
      (scoreBreakdown.missedTargetCount ?? 0) >= 3 ||
      (scoreBreakdown.ghostNoteCount ?? 0) >= 2
    )
  );
}

function buildFullChartReintegrationMilestone({
  latestSession,
  completedSessions
}) {
  const returnContext = latestSession.summary?.practiceReturnContext ?? null;
  const latestPracticePreset = latestSession.summary?.practicePreset ?? null;

  if (!returnContext?.recoveryTrainingId || latestPracticePreset?.scope !== "full-chart") {
    return null;
  }

  const matchingFullChartSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      const sessionReturnContext = session.summary?.practiceReturnContext ?? null;
      const sessionPracticePreset = session.summary?.practicePreset ?? null;

      if (
        session.trainingId !== latestSession.trainingId ||
        sessionPracticePreset?.scope !== "full-chart" ||
        !sessionReturnContext?.recoveryTrainingId
      ) {
        return false;
      }

      return (
        sessionReturnContext.recoveryTrainingId === returnContext.recoveryTrainingId &&
        (sessionReturnContext.goalSectionId ?? null) === (returnContext.goalSectionId ?? null)
      );
    })
    .slice(0, 3);

  const requiredStableFullChartSessions = 2;
  let stableFullChartSessionCount = 0;

  for (const session of matchingFullChartSessions) {
    if (!isFullChartReintegrationSuccessful(session)) {
      break;
    }

    stableFullChartSessionCount += 1;
  }

  return {
    requiredStableFullChartSessions,
    stableFullChartSessionCount,
    consideredSessionCount: matchingFullChartSessions.length,
    latestSuccessful: isFullChartReintegrationSuccessful(latestSession),
    latestFailed: isFullChartReintegrationFailed(latestSession),
    isConfirmed: stableFullChartSessionCount >= requiredStableFullChartSessions
  };
}

function isPromotionLandingSuccessful(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (!promotionContext?.sourceTrainingId) {
    return false;
  }

  return (
    isGradeAtLeast(rating?.grade ?? "F", "C") &&
    accuracy >= 0.78 &&
    (scoreBreakdown.missedTargetCount ?? 0) <= 2 &&
    (scoreBreakdown.ghostNoteCount ?? 0) <= 1
  );
}

function isPromotionLandingFailed(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (!promotionContext?.sourceTrainingId) {
    return false;
  }

  return (
    !isGradeAtLeast(rating?.grade ?? "F", "C") ||
    accuracy < 0.68 ||
    (scoreBreakdown.missedTargetCount ?? 0) >= 3 ||
    (scoreBreakdown.ghostNoteCount ?? 0) >= 2
  );
}

function buildPromotionLandingMilestone({
  latestSession,
  completedSessions
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (!promotionContext?.sourceTrainingId) {
    return null;
  }

  const matchingPromotionSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;

      if (!sessionPromotionContext?.sourceTrainingId) {
        return false;
      }

      return sessionPromotionContext.sourceTrainingId === promotionContext.sourceTrainingId;
    })
    .slice(0, 3);

  const requiredStablePromotionLandingSessions = 2;
  let stablePromotionLandingSessionCount = 0;

  for (const session of matchingPromotionSessions) {
    if (!isPromotionLandingSuccessful(session)) {
      break;
    }

    stablePromotionLandingSessionCount += 1;
  }

  return {
    requiredStablePromotionLandingSessions,
    stablePromotionLandingSessionCount,
    consideredSessionCount: matchingPromotionSessions.length,
    latestSuccessful: isPromotionLandingSuccessful(latestSession),
    latestFailed: isPromotionLandingFailed(latestSession),
    isConfirmed: stablePromotionLandingSessionCount >= requiredStablePromotionLandingSessions
  };
}

function isPromotionRampSuccessful(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (promotionContext?.phase !== "ramp") {
    return false;
  }

  return (
    isGradeAtLeast(rating?.grade ?? "F", "B") &&
    accuracy >= 0.82 &&
    (scoreBreakdown.missedTargetCount ?? 0) <= 1 &&
    (scoreBreakdown.ghostNoteCount ?? 0) === 0
  );
}

function isPromotionRampFailed(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (promotionContext?.phase !== "ramp") {
    return false;
  }

  return (
    !isGradeAtLeast(rating?.grade ?? "F", "C") ||
    accuracy < 0.74 ||
    (scoreBreakdown.missedTargetCount ?? 0) >= 3 ||
    (scoreBreakdown.ghostNoteCount ?? 0) >= 2
  );
}

function buildPromotionRampMilestone({
  latestSession,
  completedSessions
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "ramp") {
    return null;
  }

  const matchingRampSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;

      if (sessionPromotionContext?.phase !== "ramp") {
        return false;
      }

      return (
        sessionPromotionContext.sourceTrainingId === promotionContext.sourceTrainingId &&
        (sessionPromotionContext.rampTargetTempoBpm ?? null) ===
          (promotionContext.rampTargetTempoBpm ?? null)
      );
    })
    .slice(0, 3);

  const requiredStablePromotionRampSessions = 2;
  let stablePromotionRampSessionCount = 0;

  for (const session of matchingRampSessions) {
    if (!isPromotionRampSuccessful(session)) {
      break;
    }

    stablePromotionRampSessionCount += 1;
  }

  return {
    requiredStablePromotionRampSessions,
    stablePromotionRampSessionCount,
    consideredSessionCount: matchingRampSessions.length,
    latestSuccessful: isPromotionRampSuccessful(latestSession),
    latestFailed: isPromotionRampFailed(latestSession),
    isConfirmed: stablePromotionRampSessionCount >= requiredStablePromotionRampSessions,
    rampTargetTempoBpm: promotionContext.rampTargetTempoBpm ?? null,
    rampBaseTempoBpm: promotionContext.rampBaseTempoBpm ?? null
  };
}

function selectPromotionGraduationTarget({ promotedTraining, sourceTraining, trainings }) {
  if (sourceTraining && getDifficultyRank(sourceTraining.difficulty) > getDifficultyRank(promotedTraining.difficulty)) {
    return {
      training: sourceTraining,
      reason: `Promowany trening "${promotedTraining.title}" zrobil juz swoje jako pomost. Warto wrocic do trudniejszego materialu "${sourceTraining.title}".`
    };
  }

  // Only graduate to STRICTLY harder content; same-difficulty trainings (e.g.
  // other intermediate exercises) are not a graduation target — they are
  // lateral moves that should be surfaced through a different recommendation.
  const nextHarderTraining = trainings
    .filter((training) => training.id !== promotedTraining.id)
    .sort((left, right) => {
      const difficultyDelta =
        getDifficultyRank(left.difficulty) - getDifficultyRank(right.difficulty);

      if (difficultyDelta !== 0) {
        return difficultyDelta;
      }

      return left.tempoBpm - right.tempoBpm;
    })
    .find((training) => getDifficultyRank(training.difficulty) > getDifficultyRank(promotedTraining.difficulty));

  if (!nextHarderTraining) {
    return null;
  }

  return {
    training: nextHarderTraining,
    reason: `Promowany trening "${promotedTraining.title}" jest juz ustabilizowany, wiec mozna przejsc do kolejnego materialu "${nextHarderTraining.title}".`
  };
}

function isPromotionReentrySuccessful(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (promotionContext?.phase !== "reentry") {
    return false;
  }

  return (
    isGradeAtLeast(rating?.grade ?? "F", "B") &&
    accuracy >= 0.8 &&
    (scoreBreakdown.missedTargetCount ?? 0) <= 1 &&
    (scoreBreakdown.ghostNoteCount ?? 0) <= 1
  );
}

function isPromotionReentryFailed(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (promotionContext?.phase !== "reentry") {
    return false;
  }

  return (
    !isGradeAtLeast(rating?.grade ?? "F", "C") ||
    accuracy < 0.72 ||
    (scoreBreakdown.missedTargetCount ?? 0) >= 3 ||
    (scoreBreakdown.ghostNoteCount ?? 0) >= 2
  );
}

function buildPromotionReentryMilestone({
  latestSession,
  completedSessions
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "reentry") {
    return null;
  }

  const matchingReentrySessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;

      return (
        sessionPromotionContext?.phase === "reentry" &&
        sessionPromotionContext.sourceTrainingId === promotionContext.sourceTrainingId
      );
    })
    .slice(0, 3);

  const requiredStablePromotionReentrySessions = 2;
  let stablePromotionReentrySessionCount = 0;

  for (const session of matchingReentrySessions) {
    if (!isPromotionReentrySuccessful(session)) {
      break;
    }

    stablePromotionReentrySessionCount += 1;
  }

  return {
    requiredStablePromotionReentrySessions,
    stablePromotionReentrySessionCount,
    consideredSessionCount: matchingReentrySessions.length,
    latestSuccessful: isPromotionReentrySuccessful(latestSession),
    latestFailed: isPromotionReentryFailed(latestSession),
    isConfirmed: stablePromotionReentrySessionCount >= requiredStablePromotionReentrySessions
  };
}

function buildPromotionReentryRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "reentry") {
    return null;
  }

  const reentryTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const fallbackTraining = trainings.find((training) => training.id === promotionContext.sourceTrainingId) ?? null;

  if (!reentryTraining || !fallbackTraining) {
    return null;
  }

  const latestRating = latestSession.summary?.rating ?? null;
  const latestPracticePreset = latestSession.summary?.practicePreset ?? null;
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const focusSummary = latestFeedback?.focusAreas?.join(", ") ?? "stabilnym utrzymaniu wejscia w nowy material";
  const promotionReentryMilestone = buildPromotionReentryMilestone({
    latestSession,
    completedSessions
  });
  const currentTempoBpm = clampNumber(
    latestPracticePreset?.tempoBpm ?? reentryTraining.tempoBpm ?? 90,
    60,
    220
  );
  const fallbackTempoBpm = clampNumber(
    promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm ?? 90,
    60,
    220
  );

  if (!promotionReentryMilestone) {
    return null;
  }

  if (promotionReentryMilestone.latestFailed) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: fallbackTraining.id,
      recommendedTrainingTitle: fallbackTraining.title,
      recommendedDifficulty: fallbackTraining.difficulty,
      suggestedTempoBpm: fallbackTempoBpm,
      action: "switch-training",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: fallbackTraining.id,
      promotionSourceTrainingTitle: fallbackTraining.title,
      promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
      promotionSourceTempoBpm: fallbackTempoBpm,
      promotionTargetTrainingId: reentryTraining.id,
      promotionTargetTrainingTitle: reentryTraining.title,
      promotionTargetDifficulty: reentryTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Wejscie z "${fallbackTraining.title}" do "${reentryTraining.title}" okazalo sie jeszcze zbyt wczesne.`,
      recoveryProgressStatus: "promotion-reentry-failed",
      promotionReentryMilestone: {
        ...promotionReentryMilestone
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Pierwsze sesje po przejsciu do "${reentryTraining.title}" nie utrzymaly jeszcze transferu progresu. Cofamy uzytkownika do stabilnego treningu pomostowego.`,
      nextStep: `Wroc do "${fallbackTraining.title}" przy ${fallbackTempoBpm} BPM, domknij jeszcze jeden pewny przebieg i dopiero potem ponow wejscie w "${reentryTraining.title}". Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-reentry", "fallback"]
    };
  }

  if (promotionReentryMilestone.isConfirmed) {
    const promotionChain = {
      mode: "raise-target-training-tempo",
      baseTempoBpm: currentTempoBpm,
      targetTempoBpm: clampNumber(currentTempoBpm + 4, 60, 220),
      reason: `Re-entry do "${reentryTraining.title}" jest juz stabilny, wiec mozna zaczac kolejny blok progresji tempa na docelowym treningu.`
    };

    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: reentryTraining.id,
      recommendedTrainingTitle: reentryTraining.title,
      recommendedDifficulty: reentryTraining.difficulty,
      suggestedTempoBpm: promotionChain.targetTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: fallbackTraining.id,
      promotionSourceTrainingTitle: fallbackTraining.title,
      promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
      promotionSourceTempoBpm: fallbackTempoBpm,
      promotionTargetTrainingId: reentryTraining.id,
      promotionTargetTrainingTitle: reentryTraining.title,
      promotionTargetDifficulty: reentryTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Wejscie w "${reentryTraining.title}" zostalo juz potwierdzone po wyjsciu z treningu pomostowego.`,
      recoveryProgressStatus: "promotion-reentry-confirmed",
      promotionReentryMilestone: {
        ...promotionReentryMilestone
      },
      promotionChain,
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Transfer z "${fallbackTraining.title}" do "${reentryTraining.title}" zostal potwierdzony. Uzytkownik utrzymuje juz stabilnosc na docelowym materiale.`,
      nextStep: `Zostan na "${reentryTraining.title}" i wejdz na ${promotionChain.targetTempoBpm} BPM jako pierwszy krok nowego bloku progresji. Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-reentry", "confirmed"]
    };
  }

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: reentryTraining.id,
    recommendedTrainingTitle: reentryTraining.title,
    recommendedDifficulty: reentryTraining.difficulty,
    suggestedTempoBpm: currentTempoBpm,
    action: "repeat-current",
    practiceScopeOverride: "full-chart",
    promotionSourceTrainingId: fallbackTraining.id,
    promotionSourceTrainingTitle: fallbackTraining.title,
    promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
    promotionSourceTempoBpm: fallbackTempoBpm,
    promotionTargetTrainingId: reentryTraining.id,
    promotionTargetTrainingTitle: reentryTraining.title,
    promotionTargetDifficulty: reentryTraining.difficulty,
    promotionTargetReason:
      promotionContext.reason ??
      `Transfer z treningu pomostowego do "${reentryTraining.title}" jest jeszcze w trakcie walidacji.`,
    recoveryProgressStatus: "promotion-reentry",
    promotionReentryMilestone: {
      ...promotionReentryMilestone
    },
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Pierwsze sesje po przejsciu do "${reentryTraining.title}" sa jeszcze monitorowane. Stabilne sesje: ${promotionReentryMilestone.stablePromotionReentrySessionCount}/${promotionReentryMilestone.requiredStablePromotionReentrySessions}.`,
    nextStep: `Zagraj jeszcze "${reentryTraining.title}" przy ${currentTempoBpm} BPM i potwierdz, ze transfer z "${fallbackTraining.title}" naprawde sie utrzymuje. Priorytet: ${focusSummary}.`,
    matchedReasons: ["promotion-reentry", "monitor"]
  };
}

function buildPromotionTrackMilestone({
  latestSession,
  completedSessions
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "ramp") {
    return null;
  }

  const matchingRampSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;

      return (
        sessionPromotionContext?.phase === "ramp" &&
        sessionPromotionContext.sourceTrainingId === promotionContext.sourceTrainingId
      );
    });

  const tierMap = new Map();

  for (const session of matchingRampSessions) {
    const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;
    const targetTempoBpm = sessionPromotionContext?.rampTargetTempoBpm ?? null;

    if (!targetTempoBpm) {
      continue;
    }

    const currentTier = tierMap.get(targetTempoBpm) ?? {
      targetTempoBpm,
      stableSessionCount: 0,
      latestCompletedAt: session.completedAt
    };

    if (isPromotionRampSuccessful(session)) {
      currentTier.stableSessionCount += 1;
    }

    if (session.completedAt > currentTier.latestCompletedAt) {
      currentTier.latestCompletedAt = session.completedAt;
    }

    tierMap.set(targetTempoBpm, currentTier);
  }

  const confirmedTiers = [...tierMap.values()]
    .filter((tier) => tier.stableSessionCount >= 2)
    .sort((left, right) => left.targetTempoBpm - right.targetTempoBpm);

  const requiredConfirmedRampTiers = 2;

  return {
    requiredConfirmedRampTiers,
    confirmedRampTierCount: confirmedTiers.length,
    latestRampTargetTempoBpm: promotionContext.rampTargetTempoBpm ?? null,
    confirmedTiers,
    isGraduated: confirmedTiers.length >= requiredConfirmedRampTiers
  };
}

function isPromotionChainSuccessful(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (
    promotionContext?.phase !== "chain" &&
    promotionContext?.phase !== "chain-validation"
  ) {
    return false;
  }

  return (
    isGradeAtLeast(rating?.grade ?? "F", "B") &&
    accuracy >= 0.82 &&
    (scoreBreakdown.missedTargetCount ?? 0) <= 1 &&
    (scoreBreakdown.ghostNoteCount ?? 0) === 0
  );
}

function isPromotionChainFailed(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (
    promotionContext?.phase !== "chain" &&
    promotionContext?.phase !== "chain-validation"
  ) {
    return false;
  }

  return (
    !isGradeAtLeast(rating?.grade ?? "F", "C") ||
    accuracy < 0.74 ||
    (scoreBreakdown.missedTargetCount ?? 0) >= 3 ||
    (scoreBreakdown.ghostNoteCount ?? 0) >= 2
  );
}

function buildPromotionChainMilestone({
  latestSession,
  completedSessions
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (
    promotionContext?.phase !== "chain" &&
    promotionContext?.phase !== "chain-validation"
  ) {
    return null;
  }

  const matchingChainSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;

      if (
        sessionPromotionContext?.phase !== "chain" &&
        sessionPromotionContext?.phase !== "chain-validation"
      ) {
        return false;
      }

      return (
        sessionPromotionContext.sourceTrainingId === promotionContext.sourceTrainingId &&
        (sessionPromotionContext.chainTargetTempoBpm ?? null) ===
          (promotionContext.chainTargetTempoBpm ?? null)
      );
    })
    .slice(0, 3);

  const requiredStablePromotionChainSessions = 2;
  let stablePromotionChainSessionCount = 0;

  for (const session of matchingChainSessions) {
    if (!isPromotionChainSuccessful(session)) {
      break;
    }

    stablePromotionChainSessionCount += 1;
  }

  return {
    requiredStablePromotionChainSessions,
    stablePromotionChainSessionCount,
    consideredSessionCount: matchingChainSessions.length,
    latestSuccessful: isPromotionChainSuccessful(latestSession),
    latestFailed: isPromotionChainFailed(latestSession),
    isConfirmed: stablePromotionChainSessionCount >= requiredStablePromotionChainSessions,
    chainBaseTempoBpm: promotionContext.chainBaseTempoBpm ?? null,
    chainTargetTempoBpm: promotionContext.chainTargetTempoBpm ?? null
  };
}

function buildPromotionChainTrackMilestone({
  latestSession,
  completedSessions
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (
    promotionContext?.phase !== "chain" &&
    promotionContext?.phase !== "chain-validation"
  ) {
    return null;
  }

  const matchingChainSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;

      if (
        sessionPromotionContext?.phase !== "chain" &&
        sessionPromotionContext?.phase !== "chain-validation"
      ) {
        return false;
      }

      return sessionPromotionContext.sourceTrainingId === promotionContext.sourceTrainingId;
    });

  const tierMap = new Map();

  for (const session of matchingChainSessions) {
    const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;
    const targetTempoBpm = sessionPromotionContext?.chainTargetTempoBpm ?? null;

    if (!targetTempoBpm) {
      continue;
    }

    const currentTier = tierMap.get(targetTempoBpm) ?? {
      targetTempoBpm,
      stableSessionCount: 0,
      latestCompletedAt: session.completedAt
    };

    if (isPromotionChainSuccessful(session)) {
      currentTier.stableSessionCount += 1;
    }

    if (session.completedAt > currentTier.latestCompletedAt) {
      currentTier.latestCompletedAt = session.completedAt;
    }

    tierMap.set(targetTempoBpm, currentTier);
  }

  const confirmedTiers = [...tierMap.values()]
    .filter((tier) => tier.stableSessionCount >= 2)
    .sort((left, right) => left.targetTempoBpm - right.targetTempoBpm);

  const requiredConfirmedPromotionChainTiers = 2;

  return {
    requiredConfirmedPromotionChainTiers,
    confirmedPromotionChainTierCount: confirmedTiers.length,
    latestChainTargetTempoBpm: promotionContext.chainTargetTempoBpm ?? null,
    confirmedTiers,
    isGraduated: confirmedTiers.length >= requiredConfirmedPromotionChainTiers
  };
}

function selectPromotionChainGraduationTarget({
  chainTraining,
  fallbackTraining,
  trainings,
  promotionContext,
  promotionChainTrackMilestone
}) {
  const harderTrainingTarget = selectPromotionGraduationTarget({
    promotedTraining: chainTraining,
    sourceTraining: fallbackTraining,
    trainings
  });

  if (harderTrainingTarget) {
    return {
      mode: "switch-training",
      training: harderTrainingTarget.training,
      targetTempoBpm: clampNumber(
        Math.max(
          harderTrainingTarget.training.tempoBpm - 4,
          promotionContext.chainTargetTempoBpm ?? chainTraining.tempoBpm
        ),
        60,
        220
      ),
      reason: harderTrainingTarget.reason
    };
  }

  const latestConfirmedTier =
    promotionChainTrackMilestone.confirmedTiers[promotionChainTrackMilestone.confirmedTiers.length - 1] ?? null;
  const baseTempoBpm = clampNumber(
    latestConfirmedTier?.targetTempoBpm ??
      promotionContext.chainTargetTempoBpm ??
      chainTraining.tempoBpm,
    60,
    220
  );

  return {
    mode: "raise-terminal-training-ceiling",
    training: chainTraining,
    baseTempoBpm,
    targetTempoBpm: clampNumber(baseTempoBpm + 4, 60, 220),
    reason: `Nie ma jeszcze kolejnego trudniejszego materialu po "${chainTraining.title}", wiec warto domknac blok chain przez podniesienie sufitu tempa na tym samym treningu.`
  };
}

function buildPromotionChainGraduationRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (
    promotionContext?.phase !== "chain" &&
    promotionContext?.phase !== "chain-validation"
  ) {
    return null;
  }

  const chainTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const fallbackTraining = trainings.find((training) => training.id === promotionContext.sourceTrainingId) ?? null;

  if (!chainTraining || !fallbackTraining) {
    return null;
  }

  const promotionChainTrackMilestone = buildPromotionChainTrackMilestone({
    latestSession,
    completedSessions
  });

  if (!promotionChainTrackMilestone?.isGraduated) {
    return null;
  }

  const graduationTarget = selectPromotionChainGraduationTarget({
    chainTraining,
    fallbackTraining,
    trainings,
    promotionContext,
    promotionChainTrackMilestone
  });
  const latestRating = latestSession.summary?.rating ?? null;
  const focusSummary =
    latestFeedback?.focusAreas?.join(", ") ?? "domknieciu kolejnego bloku progresji po chainie";
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: graduationTarget.training.id,
    recommendedTrainingTitle: graduationTarget.training.title,
    recommendedDifficulty: graduationTarget.training.difficulty,
    suggestedTempoBpm: graduationTarget.targetTempoBpm,
    action: graduationTarget.mode === "switch-training" ? "switch-training" : "repeat-current",
    practiceScopeOverride: "full-chart",
    promotionSourceTrainingId: fallbackTraining.id,
    promotionSourceTrainingTitle: fallbackTraining.title,
    promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
    promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
    promotionTargetTrainingId: chainTraining.id,
    promotionTargetTrainingTitle: chainTraining.title,
    promotionTargetDifficulty: chainTraining.difficulty,
    promotionTargetReason:
      promotionContext.reason ??
      `Blok chain na "${chainTraining.title}" zostal ustabilizowany i mozna go domknac.`,
    recoveryProgressStatus: "promotion-chain-graduated",
    promotionChainTrackMilestone,
    promotionChainGraduation: {
      mode: graduationTarget.mode,
      baseTempoBpm: graduationTarget.baseTempoBpm ?? null,
      targetTrainingId: graduationTarget.training.id,
      targetTrainingTitle: graduationTarget.training.title,
      targetTrainingDifficulty: graduationTarget.training.difficulty,
      targetTempoBpm: graduationTarget.targetTempoBpm,
      reason: graduationTarget.reason
    },
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale:
      graduationTarget.mode === "switch-training"
        ? `Kilka kolejnych chain tierow na "${chainTraining.title}" zostalo potwierdzonych. To dobry moment, zeby przeniesc progres na kolejny trening.`
        : `Kilka kolejnych chain tierow na "${chainTraining.title}" zostalo potwierdzonych, a katalog nie ma jeszcze trudniejszego materialu. Domykamy ten blok przez podniesienie sufitu na tym samym treningu.`,
    nextStep:
      graduationTarget.mode === "switch-training"
        ? `Przejdz do "${graduationTarget.training.title}" na ${graduationTarget.targetTempoBpm} BPM. Zamknales juz chain na "${chainTraining.title}" i pora przeniesc progres dalej. Priorytet: ${focusSummary}.`
        : `Zostan na "${chainTraining.title}" i wejdz na ${graduationTarget.targetTempoBpm} BPM jako kolejny sufit po zamknieciu chainu. Priorytet: ${focusSummary}.`,
    matchedReasons: ["promotion-chain-track", "graduated"]
  };
}

function isPromotionChainGraduationSuccessful(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (promotionContext?.phase !== "chain-graduation") {
    return false;
  }

  return (
    isGradeAtLeast(rating?.grade ?? "F", "A") &&
    accuracy >= 0.85 &&
    (scoreBreakdown.missedTargetCount ?? 0) <= 1 &&
    (scoreBreakdown.ghostNoteCount ?? 0) === 0
  );
}

function isPromotionChainGraduationFailed(session) {
  const promotionContext = session.summary?.practicePromotionContext ?? null;
  const accuracy = session.summary?.accuracy ?? 0;
  const rating = session.summary?.rating ?? null;
  const scoreBreakdown = session.summary?.scoreBreakdown ?? {};

  if (promotionContext?.phase !== "chain-graduation") {
    return false;
  }

  return (
    !isGradeAtLeast(rating?.grade ?? "F", "C") ||
    accuracy < 0.76 ||
    (scoreBreakdown.missedTargetCount ?? 0) >= 3 ||
    (scoreBreakdown.ghostNoteCount ?? 0) >= 2
  );
}

function buildPromotionChainGraduationMilestone({
  latestSession,
  completedSessions
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "chain-graduation") {
    return null;
  }

  const matchingSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;

      return (
        sessionPromotionContext?.phase === "chain-graduation" &&
        sessionPromotionContext.sourceTrainingId === promotionContext.sourceTrainingId &&
        (sessionPromotionContext.chainTargetTempoBpm ?? null) ===
          (promotionContext.chainTargetTempoBpm ?? null)
      );
    })
    .slice(0, 3);

  const requiredStablePromotionChainGraduationSessions = 2;
  let stablePromotionChainGraduationSessionCount = 0;

  for (const session of matchingSessions) {
    if (!isPromotionChainGraduationSuccessful(session)) {
      break;
    }

    stablePromotionChainGraduationSessionCount += 1;
  }

  return {
    requiredStablePromotionChainGraduationSessions,
    stablePromotionChainGraduationSessionCount,
    consideredSessionCount: matchingSessions.length,
    latestSuccessful: isPromotionChainGraduationSuccessful(latestSession),
    latestFailed: isPromotionChainGraduationFailed(latestSession),
    isConfirmed:
      stablePromotionChainGraduationSessionCount >=
      requiredStablePromotionChainGraduationSessions,
    chainBaseTempoBpm: promotionContext.chainBaseTempoBpm ?? null,
    chainTargetTempoBpm: promotionContext.chainTargetTempoBpm ?? null
  };
}

function buildTerminalTrainingMasteryTrack({
  latestSession,
  completedSessions
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "chain-graduation") {
    return null;
  }

  const matchingSessions = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((session) => {
      if (session.trainingId !== latestSession.trainingId) {
        return false;
      }

      const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;

      return (
        sessionPromotionContext?.phase === "chain-graduation" &&
        sessionPromotionContext.sourceTrainingId === promotionContext.sourceTrainingId
      );
    });

  const tierMap = new Map();

  for (const session of matchingSessions) {
    const sessionPromotionContext = session.summary?.practicePromotionContext ?? null;
    const targetTempoBpm = sessionPromotionContext?.chainTargetTempoBpm ?? null;

    if (!targetTempoBpm) {
      continue;
    }

    const currentTier = tierMap.get(targetTempoBpm) ?? {
      targetTempoBpm,
      stableSessionCount: 0,
      latestCompletedAt: session.completedAt
    };

    if (isPromotionChainGraduationSuccessful(session)) {
      currentTier.stableSessionCount += 1;
    }

    if (session.completedAt > currentTier.latestCompletedAt) {
      currentTier.latestCompletedAt = session.completedAt;
    }

    tierMap.set(targetTempoBpm, currentTier);
  }

  const confirmedTiers = [...tierMap.values()]
    .filter((tier) => tier.stableSessionCount >= 2)
    .sort((left, right) => left.targetTempoBpm - right.targetTempoBpm);

  const requiredConfirmedTerminalTiers = 3;

  return {
    requiredConfirmedTerminalTiers,
    confirmedTerminalTierCount: confirmedTiers.length,
    latestConfirmedTempoBpm: confirmedTiers[confirmedTiers.length - 1]?.targetTempoBpm ?? null,
    confirmedTiers,
    isMastered: confirmedTiers.length >= requiredConfirmedTerminalTiers
  };
}

function selectTerminalMasteryGraduationTarget({
  chainTraining,
  fallbackTraining,
  trainings
}) {
  const nextHarderTraining = trainings
    .filter((training) => training.id !== chainTraining.id && training.id !== fallbackTraining.id)
    .sort((left, right) => {
      const difficultyDelta = getDifficultyRank(left.difficulty) - getDifficultyRank(right.difficulty);

      if (difficultyDelta !== 0) {
        return difficultyDelta;
      }

      return left.tempoBpm - right.tempoBpm;
    })
    .find((training) => getDifficultyRank(training.difficulty) > getDifficultyRank(chainTraining.difficulty));

  if (!nextHarderTraining) {
    return null;
  }

  return {
    training: nextHarderTraining,
    targetTempoBpm: clampNumber(Math.max(nextHarderTraining.tempoBpm - 6, 60), 60, 220),
    reason: `Koncowy blok mastery na "${chainTraining.title}" jest juz domkniety, wiec mozna odblokowac kolejny material "${nextHarderTraining.title}".`
  };
}

function buildTerminalTrainingMasteryRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "chain-graduation") {
    return null;
  }

  const chainTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const fallbackTraining = trainings.find((training) => training.id === promotionContext.sourceTrainingId) ?? null;

  if (!chainTraining || !fallbackTraining) {
    return null;
  }

  const promotionChainGraduationMilestone = buildPromotionChainGraduationMilestone({
    latestSession,
    completedSessions
  });

  if (!promotionChainGraduationMilestone?.isConfirmed) {
    return null;
  }

  const terminalTrainingMasteryTrack = buildTerminalTrainingMasteryTrack({
    latestSession,
    completedSessions
  });

  if (!terminalTrainingMasteryTrack) {
    return null;
  }

  const latestRating = latestSession.summary?.rating ?? null;
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const focusSummary =
    latestFeedback?.focusAreas?.join(", ") ?? "utrzymaniu stabilnosci na koncowym treningu";
  const currentTempoBpm = clampNumber(
    promotionContext.chainTargetTempoBpm ?? chainTraining.tempoBpm,
    60,
    220
  );
  const nextTempoBpm = clampNumber(currentTempoBpm + 4, 60, 220);

  if (terminalTrainingMasteryTrack.isMastered) {
    const graduationTarget = selectTerminalMasteryGraduationTarget({
      chainTraining,
      fallbackTraining,
      trainings
    });

    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: graduationTarget?.training.id ?? chainTraining.id,
      recommendedTrainingTitle: graduationTarget?.training.title ?? chainTraining.title,
      recommendedDifficulty: graduationTarget?.training.difficulty ?? chainTraining.difficulty,
      suggestedTempoBpm: graduationTarget?.targetTempoBpm ?? currentTempoBpm,
      action: graduationTarget ? "switch-training" : "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: fallbackTraining.id,
      promotionSourceTrainingTitle: fallbackTraining.title,
      promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
      promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
      promotionTargetTrainingId: chainTraining.id,
      promotionTargetTrainingTitle: chainTraining.title,
      promotionTargetDifficulty: chainTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Koncowy trening "${chainTraining.title}" zostal juz ustabilizowany na kilku kolejnych tierach BPM.`,
      recoveryProgressStatus: "terminal-mastery-graduated",
      promotionChainGraduationMilestone,
      terminalTrainingMasteryTrack,
      terminalMasteryGraduation: graduationTarget
        ? {
            mode: "switch-training",
            targetTrainingId: graduationTarget.training.id,
            targetTrainingTitle: graduationTarget.training.title,
            targetTrainingDifficulty: graduationTarget.training.difficulty,
            targetTempoBpm: graduationTarget.targetTempoBpm,
            reason: graduationTarget.reason
          }
        : {
            mode: "maintain-terminal-mastery",
            targetTrainingId: chainTraining.id,
            targetTrainingTitle: chainTraining.title,
            targetTrainingDifficulty: chainTraining.difficulty,
            targetTempoBpm: currentTempoBpm,
            reason: `Katalog nie ma jeszcze kolejnego trudniejszego treningu po "${chainTraining.title}", wiec najlepszym krokiem jest utrzymanie zamknietego poziomu i dalszy polish wykonania.`
          },
      promotionChainGraduation: {
        mode: "maintain-terminal-training",
        baseTempoBpm: currentTempoBpm,
        targetTrainingId: chainTraining.id,
        targetTrainingTitle: chainTraining.title,
        targetTrainingDifficulty: chainTraining.difficulty,
        targetTempoBpm: currentTempoBpm,
        reason: `Trening "${chainTraining.title}" ma juz zamkniete ${terminalTrainingMasteryTrack.confirmedTerminalTierCount} terminalne tiery i mozna przejsc w tryb utrzymania lub dalszego content expansion.`
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: graduationTarget
        ? `Koncowy trening ma juz potwierdzone kilka kolejnych sufitow BPM. Mastery track jest domkniety i mozna przejsc do nowego materialu.`
        : `Koncowy trening ma juz potwierdzone kilka kolejnych sufitow BPM. Mastery track jest domkniety i mozna wejsc w tryb utrzymania poziomu na tym materiale.`,
      nextStep: graduationTarget
        ? `Przejdz do "${graduationTarget.training.title}" na ${graduationTarget.targetTempoBpm} BPM. Mastery track na "${chainTraining.title}" jest juz zamkniety. Priorytet: ${focusSummary}.`
        : `Utrzymaj "${chainTraining.title}" przy ${currentTempoBpm} BPM i wykorzystaj ten poziom jako nowy punkt odniesienia pod przyszly content. Priorytet: ${focusSummary}.`,
      matchedReasons: ["terminal-training-mastery", "graduated"]
    };
  }

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: chainTraining.id,
    recommendedTrainingTitle: chainTraining.title,
    recommendedDifficulty: chainTraining.difficulty,
    suggestedTempoBpm: nextTempoBpm,
    action: "repeat-current",
    practiceScopeOverride: "full-chart",
    promotionSourceTrainingId: fallbackTraining.id,
    promotionSourceTrainingTitle: fallbackTraining.title,
    promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
    promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
    promotionTargetTrainingId: chainTraining.id,
    promotionTargetTrainingTitle: chainTraining.title,
    promotionTargetDifficulty: chainTraining.difficulty,
    promotionTargetReason:
      promotionContext.reason ??
      `Koncowy trening "${chainTraining.title}" buduje teraz dluzszy blok mastery, a nie tylko pojedynczy skok BPM.`,
    recoveryProgressStatus: "terminal-training-mastery",
    promotionChainGraduationMilestone,
    terminalTrainingMasteryTrack,
    promotionChainGraduation: {
      mode: "raise-terminal-training-ceiling",
      baseTempoBpm: currentTempoBpm,
      targetTrainingId: chainTraining.id,
      targetTrainingTitle: chainTraining.title,
      targetTrainingDifficulty: chainTraining.difficulty,
      targetTempoBpm: nextTempoBpm,
      reason: `Terminal mastery track ma juz ${terminalTrainingMasteryTrack.confirmedTerminalTierCount}/${terminalTrainingMasteryTrack.requiredConfirmedTerminalTiers} potwierdzonych tierow. Kolejny krok to ${nextTempoBpm} BPM.`
    },
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Potwierdzony sufit po chain graduation zostal juz wlaczony do dluzszej sciezki mastery dla "${chainTraining.title}".`,
    nextStep: `Zostan na "${chainTraining.title}" i wejdz na ${nextTempoBpm} BPM jako kolejny terminal tier. Priorytet: ${focusSummary}.`,
    matchedReasons: ["terminal-training-mastery", "monitor"]
  };
}

function buildPromotionChainGraduationValidationRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "chain-graduation") {
    return null;
  }

  const chainTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const fallbackTraining = trainings.find((training) => training.id === promotionContext.sourceTrainingId) ?? null;

  if (!chainTraining || !fallbackTraining) {
    return null;
  }

  const latestRating = latestSession.summary?.rating ?? null;
  const focusSummary =
    latestFeedback?.focusAreas?.join(", ") ?? "utrzymaniu podniesionego sufitu tempa";
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const promotionChainGraduationMilestone = buildPromotionChainGraduationMilestone({
    latestSession,
    completedSessions
  });
  const currentTempoBpm = clampNumber(
    promotionContext.chainTargetTempoBpm ?? chainTraining.tempoBpm,
    60,
    220
  );
  const fallbackTempoBpm = clampNumber(
    promotionContext.chainBaseTempoBpm ?? chainTraining.tempoBpm,
    60,
    220
  );

  if (!promotionChainGraduationMilestone) {
    return null;
  }

  if (promotionChainGraduationMilestone.latestFailed) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: chainTraining.id,
      recommendedTrainingTitle: chainTraining.title,
      recommendedDifficulty: chainTraining.difficulty,
      suggestedTempoBpm: fallbackTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: fallbackTraining.id,
      promotionSourceTrainingTitle: fallbackTraining.title,
      promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
      promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
      promotionTargetTrainingId: chainTraining.id,
      promotionTargetTrainingTitle: chainTraining.title,
      promotionTargetDifficulty: chainTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Podniesiony sufit tempa na "${chainTraining.title}" okazal sie jeszcze zbyt agresywny.`,
      recoveryProgressStatus: "promotion-chain-graduation-failed",
      promotionChainGraduationMilestone,
      promotionChainGraduation: {
        mode: "rebuild-terminal-training-ceiling",
        baseTempoBpm: fallbackTempoBpm,
        targetTrainingId: chainTraining.id,
        targetTrainingTitle: chainTraining.title,
        targetTrainingDifficulty: chainTraining.difficulty,
        targetTempoBpm: fallbackTempoBpm,
        reason: `Sufit ${currentTempoBpm} BPM nie utrzymal jeszcze stabilnosci, wiec trzeba odbudowac forme na ${fallbackTempoBpm} BPM.`
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Podniesiony sufit po chain graduation jeszcze sie nie utrzymal. Cofamy tempo wewnatrz tego samego treningu zamiast rozbijac cala progresje.`,
      nextStep: `Wroc do ${fallbackTempoBpm} BPM na "${chainTraining.title}", odbuduj czyste przebiegi i dopiero potem ponownie wejdz na ${currentTempoBpm} BPM. Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-chain-graduation", "fallback"]
    };
  }

  if (promotionChainGraduationMilestone.isConfirmed) {
    const nextTempoBpm = clampNumber(currentTempoBpm + 4, 60, 220);

    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: chainTraining.id,
      recommendedTrainingTitle: chainTraining.title,
      recommendedDifficulty: chainTraining.difficulty,
      suggestedTempoBpm: nextTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: fallbackTraining.id,
      promotionSourceTrainingTitle: fallbackTraining.title,
      promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
      promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
      promotionTargetTrainingId: chainTraining.id,
      promotionTargetTrainingTitle: chainTraining.title,
      promotionTargetDifficulty: chainTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Podniesiony sufit po chain graduation zostal juz potwierdzony na "${chainTraining.title}".`,
      recoveryProgressStatus: "promotion-chain-graduation-confirmed",
      promotionChainGraduationMilestone,
      promotionChainGraduation: {
        mode: "raise-terminal-training-ceiling",
        baseTempoBpm: currentTempoBpm,
        targetTrainingId: chainTraining.id,
        targetTrainingTitle: chainTraining.title,
        targetTrainingDifficulty: chainTraining.difficulty,
        targetTempoBpm: nextTempoBpm,
        reason: `Sufit ${currentTempoBpm} BPM zostal juz potwierdzony, wiec mozna kontrolowanie podniesc kolejny prog do ${nextTempoBpm} BPM.`
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Podniesiony sufit po chain graduation zostal ustabilizowany. Uzytkownik utrzymuje juz wyzszy prog na tym samym treningu.`,
      nextStep: `Zostan na "${chainTraining.title}" i wejdz na ${nextTempoBpm} BPM jako kolejny potwierdzony sufit. Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-chain-graduation", "confirmed"]
    };
  }

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: chainTraining.id,
    recommendedTrainingTitle: chainTraining.title,
    recommendedDifficulty: chainTraining.difficulty,
    suggestedTempoBpm: currentTempoBpm,
    action: "repeat-current",
    practiceScopeOverride: "full-chart",
    promotionSourceTrainingId: fallbackTraining.id,
    promotionSourceTrainingTitle: fallbackTraining.title,
    promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
    promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
    promotionTargetTrainingId: chainTraining.id,
    promotionTargetTrainingTitle: chainTraining.title,
    promotionTargetDifficulty: chainTraining.difficulty,
    promotionTargetReason:
      promotionContext.reason ??
      `Podniesiony sufit po chain graduation jest jeszcze w trakcie walidacji.`,
    recoveryProgressStatus: "promotion-chain-graduation",
    promotionChainGraduationMilestone,
    promotionChainGraduation: {
      mode: "validate-terminal-training-ceiling",
      baseTempoBpm: fallbackTempoBpm,
      targetTrainingId: chainTraining.id,
      targetTrainingTitle: chainTraining.title,
      targetTrainingDifficulty: chainTraining.difficulty,
      targetTempoBpm: currentTempoBpm,
      reason: `Sprawdzamy, czy nowy sufit ${currentTempoBpm} BPM utrzyma sie stabilnie na "${chainTraining.title}".`
    },
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Podniesiony sufit po chain graduation jest jeszcze monitorowany. Stabilne sesje: ${promotionChainGraduationMilestone.stablePromotionChainGraduationSessionCount}/${promotionChainGraduationMilestone.requiredStablePromotionChainGraduationSessions}.`,
    nextStep: `Zagraj jeszcze "${chainTraining.title}" przy ${currentTempoBpm} BPM i potwierdz, ze nowy sufit po chain graduation naprawde sie utrzymuje. Priorytet: ${focusSummary}.`,
    matchedReasons: ["promotion-chain-graduation", "monitor"]
  };
}

function buildPromotionChainRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (
    promotionContext?.phase !== "chain" &&
    promotionContext?.phase !== "chain-validation"
  ) {
    return null;
  }

  const chainTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const fallbackTraining = trainings.find((training) => training.id === promotionContext.sourceTrainingId) ?? null;

  if (!chainTraining || !fallbackTraining) {
    return null;
  }

  const latestRating = latestSession.summary?.rating ?? null;
  const latestPracticePreset = latestSession.summary?.practicePreset ?? null;
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const focusSummary = latestFeedback?.focusAreas?.join(", ") ?? "ustabilizowaniu kolejnego kroku progresji";
  const promotionChainMilestone = buildPromotionChainMilestone({
    latestSession,
    completedSessions
  });
  const currentTempoBpm = clampNumber(
    latestPracticePreset?.tempoBpm ??
      promotionContext.chainTargetTempoBpm ??
      chainTraining.tempoBpm ??
      90,
    60,
    220
  );
  const fallbackTempoBpm = clampNumber(
    promotionContext.chainBaseTempoBpm ?? chainTraining.tempoBpm ?? currentTempoBpm,
    60,
    220
  );

  if (!promotionChainMilestone) {
    return null;
  }

  if (promotionChainMilestone.latestFailed) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: chainTraining.id,
      recommendedTrainingTitle: chainTraining.title,
      recommendedDifficulty: chainTraining.difficulty,
      suggestedTempoBpm: fallbackTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: fallbackTraining.id,
      promotionSourceTrainingTitle: fallbackTraining.title,
      promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
      promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
      promotionTargetTrainingId: chainTraining.id,
      promotionTargetTrainingTitle: chainTraining.title,
      promotionTargetDifficulty: chainTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Nowy chain step na "${chainTraining.title}" okazal sie jeszcze zbyt agresywny.`,
      recoveryProgressStatus: "promotion-chain-failed",
      promotionChainMilestone: {
        ...promotionChainMilestone
      },
      promotionChain: {
        mode: "rebuild-target-training-tempo",
        baseTempoBpm: fallbackTempoBpm,
        targetTempoBpm: fallbackTempoBpm,
        reason: `Chain step do ${currentTempoBpm} BPM nie utrzymal stabilnosci, wiec cofamy sie do ${fallbackTempoBpm} BPM i odbudowujemy ten sam trening bez wychodzenia z chainu.`
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Kolejny blok progresji na "${chainTraining.title}" jeszcze sie nie utrzymal. Cofamy tempo wewnatrz tego samego treningu zamiast wracac od razu do poprzedniego materialu.`,
      nextStep: `Wroc do ${fallbackTempoBpm} BPM na "${chainTraining.title}", zamknij czyste przebiegi i dopiero potem ponow wejscie na ${currentTempoBpm} BPM. Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-chain", "fallback"]
    };
  }

  if (promotionChainMilestone.isConfirmed) {
    const nextChainTempoBpm = clampNumber(currentTempoBpm + 4, 60, 220);

    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: chainTraining.id,
      recommendedTrainingTitle: chainTraining.title,
      recommendedDifficulty: chainTraining.difficulty,
      suggestedTempoBpm: nextChainTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: fallbackTraining.id,
      promotionSourceTrainingTitle: fallbackTraining.title,
      promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
      promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
      promotionTargetTrainingId: chainTraining.id,
      promotionTargetTrainingTitle: chainTraining.title,
      promotionTargetDifficulty: chainTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Chain step na "${chainTraining.title}" zostal potwierdzony i mozna wejsc w kolejny skok BPM.`,
      recoveryProgressStatus: "promotion-chain-confirmed",
      promotionChainMilestone: {
        ...promotionChainMilestone
      },
      promotionChain: {
        mode: "raise-target-training-tempo",
        baseTempoBpm: currentTempoBpm,
        targetTempoBpm: nextChainTempoBpm,
        reason: `Chain step do ${currentTempoBpm} BPM jest juz zamkniety, wiec mozna zbudowac kolejny krok do ${nextChainTempoBpm} BPM.`
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Kolejny blok progresji na "${chainTraining.title}" zostal potwierdzony. Mozna kontynuowac wzrost bez wracania do wczesniejszych etapow.`,
      nextStep: `Zostan na "${chainTraining.title}" i wejdz na ${nextChainTempoBpm} BPM jako nastepny chain step. Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-chain", "confirmed"]
    };
  }

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: chainTraining.id,
    recommendedTrainingTitle: chainTraining.title,
    recommendedDifficulty: chainTraining.difficulty,
    suggestedTempoBpm: currentTempoBpm,
    action: "repeat-current",
    practiceScopeOverride: "full-chart",
    promotionSourceTrainingId: fallbackTraining.id,
    promotionSourceTrainingTitle: fallbackTraining.title,
    promotionSourceTrainingDifficulty: fallbackTraining.difficulty,
    promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? fallbackTraining.tempoBpm,
    promotionTargetTrainingId: chainTraining.id,
    promotionTargetTrainingTitle: chainTraining.title,
    promotionTargetDifficulty: chainTraining.difficulty,
    promotionTargetReason:
      promotionContext.reason ??
      `Chain step na "${chainTraining.title}" jest jeszcze w trakcie walidacji.`,
    recoveryProgressStatus: "promotion-chain",
    promotionChainMilestone: {
      ...promotionChainMilestone
    },
    promotionChain: {
      mode: "validate-target-training-tempo",
      baseTempoBpm: fallbackTempoBpm,
      targetTempoBpm: currentTempoBpm,
      reason: `Sprawdzamy, czy chain step ${currentTempoBpm} BPM utrzyma sie stabilnie na "${chainTraining.title}".`
    },
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Nowy blok progresji na "${chainTraining.title}" jest jeszcze monitorowany. Stabilne sesje: ${promotionChainMilestone.stablePromotionChainSessionCount}/${promotionChainMilestone.requiredStablePromotionChainSessions}.`,
    nextStep: `Zagraj jeszcze "${chainTraining.title}" przy ${currentTempoBpm} BPM i domknij wymagany prog stabilnych sesji dla tego chain stepu. Priorytet: ${focusSummary}.`,
    matchedReasons: ["promotion-chain", "monitor"]
  };
}

function buildPromotionGraduationRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "ramp") {
    return null;
  }

  const promotedTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const sourceTraining = trainings.find((training) => training.id === promotionContext.sourceTrainingId) ?? null;

  if (!promotedTraining || !sourceTraining) {
    return null;
  }

  const promotionTrackMilestone = buildPromotionTrackMilestone({
    latestSession,
    completedSessions
  });

  if (!promotionTrackMilestone?.isGraduated) {
    return null;
  }

  const graduationTarget = selectPromotionGraduationTarget({
    promotedTraining,
    sourceTraining,
    trainings
  });

  if (!graduationTarget) {
    return null;
  }

  const latestRating = latestSession.summary?.rating ?? null;
  const latestFeedbackSummary =
    latestFeedback?.focusAreas?.join(", ") ?? "kontrolowanym przejsciu do kolejnego materialu";
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const targetTempoBpm = clampNumber(
    Math.max(
      graduationTarget.training.tempoBpm - 4,
      promotionContext.rampTargetTempoBpm ?? graduationTarget.training.tempoBpm
    ),
    60,
    220
  );

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: graduationTarget.training.id,
    recommendedTrainingTitle: graduationTarget.training.title,
    recommendedDifficulty: graduationTarget.training.difficulty,
    suggestedTempoBpm: targetTempoBpm,
    action: "switch-training",
    practiceScopeOverride: "full-chart",
    promotionSourceTrainingId: promotedTraining.id,
    promotionSourceTrainingTitle: promotedTraining.title,
    promotionSourceTrainingDifficulty: promotedTraining.difficulty,
    promotionSourceTempoBpm: promotionContext.rampTargetTempoBpm ?? promotedTraining.tempoBpm,
    promotionTargetTrainingId: promotedTraining.id,
    promotionTargetTrainingTitle: promotedTraining.title,
    promotionTargetDifficulty: promotedTraining.difficulty,
    promotionTargetReason:
      promotionContext.reason ??
      `Promowany trening "${promotedTraining.title}" jest juz ustabilizowany i mozna go domknac.`,
    recoveryProgressStatus: "promotion-graduated",
    promotionTrackMilestone,
    promotionGraduation: {
      targetTrainingId: graduationTarget.training.id,
      targetTrainingTitle: graduationTarget.training.title,
      targetTrainingDifficulty: graduationTarget.training.difficulty,
      targetTempoBpm,
      reason: graduationTarget.reason
    },
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Promowany trening "${promotedTraining.title}" przeszedl juz kilka potwierdzonych progow BPM i nie trzeba dalej zamykac kolejnych ramp w tej samej petli.`,
    nextStep: `Przejdz do "${graduationTarget.training.title}" na ${targetTempoBpm} BPM. Zamknales juz blok progresji na "${promotedTraining.title}" i pora przeniesc transfer na kolejny material. Priorytet: ${latestFeedbackSummary}.`,
    matchedReasons: ["promotion-track", "graduated"]
  };
}

function buildPromotionRampRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (promotionContext?.phase !== "ramp") {
    return null;
  }

  const promotedTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const sourceTraining = trainings.find((training) => training.id === promotionContext.sourceTrainingId) ?? null;

  if (!promotedTraining || !sourceTraining) {
    return null;
  }

  const latestRating = latestSession.summary?.rating ?? null;
  const latestPracticePreset = latestSession.summary?.practicePreset ?? null;
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const focusSummary = latestFeedback?.focusAreas?.join(", ") ?? "stabilnym utrzymaniu nowego tempa";
  const promotionRampMilestone = buildPromotionRampMilestone({
    latestSession,
    completedSessions
  });
  const currentTempoBpm = clampNumber(
    latestPracticePreset?.tempoBpm ??
      promotionContext.rampTargetTempoBpm ??
      promotedTraining.tempoBpm ??
      90,
    60,
    220
  );
  const fallbackTempoBpm = clampNumber(
    promotionContext.rampBaseTempoBpm ?? promotedTraining.tempoBpm ?? currentTempoBpm,
    60,
    220
  );

  if (!promotionRampMilestone) {
    return null;
  }

  if (promotionRampMilestone.latestFailed) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: promotedTraining.id,
      recommendedTrainingTitle: promotedTraining.title,
      recommendedDifficulty: promotedTraining.difficulty,
      suggestedTempoBpm: fallbackTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: sourceTraining.id,
      promotionSourceTrainingTitle: sourceTraining.title,
      promotionSourceTrainingDifficulty: sourceTraining.difficulty,
      promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? sourceTraining.tempoBpm,
      promotionTargetTrainingId: promotedTraining.id,
      promotionTargetTrainingTitle: promotedTraining.title,
      promotionTargetDifficulty: promotedTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Tempo po awansie okazalo sie jeszcze zbyt agresywne dla "${promotedTraining.title}".`,
      recoveryProgressStatus: "promotion-ramp-failed",
      promotionLandingMilestone: {
        requiredStablePromotionLandingSessions: 2,
        stablePromotionLandingSessionCount: 2,
        consideredSessionCount: 2,
        latestSuccessful: true,
        latestFailed: false,
        isConfirmed: true
      },
      promotionRampMilestone: {
        ...promotionRampMilestone
      },
      promotionRamp: {
        mode: "rebuild-promoted-tempo",
        targetTempoBpm: fallbackTempoBpm,
        reason: `Ramp do ${currentTempoBpm} BPM nie utrzymal stabilnosci, wiec cofamy sie do ${fallbackTempoBpm} BPM i odbudowujemy nowy trening krok po kroku.`
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Nowe tempo po promocji rozpadlo sie. Zostajemy na "${promotedTraining.title}", ale wracamy na bezpieczniejsze BPM przed kolejnym podejsciem do rampy.`,
      nextStep: `Wroc do "${promotedTraining.title}" przy ${fallbackTempoBpm} BPM, zamknij czyste przebiegi i dopiero potem ponow wejscie na ${currentTempoBpm} BPM. Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-ramp", "fallback"]
    };
  }

  if (promotionRampMilestone.isConfirmed) {
    const nextRampTempoBpm = clampNumber(currentTempoBpm + 4, 60, 220);

    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: promotedTraining.id,
      recommendedTrainingTitle: promotedTraining.title,
      recommendedDifficulty: promotedTraining.difficulty,
      suggestedTempoBpm: nextRampTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: sourceTraining.id,
      promotionSourceTrainingTitle: sourceTraining.title,
      promotionSourceTrainingDifficulty: sourceTraining.difficulty,
      promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? sourceTraining.tempoBpm,
      promotionTargetTrainingId: promotedTraining.id,
      promotionTargetTrainingTitle: promotedTraining.title,
      promotionTargetDifficulty: promotedTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Ramp po awansie zostal potwierdzony i mozna wejsc w kolejne BPM na "${promotedTraining.title}".`,
      recoveryProgressStatus: "promotion-ramp-confirmed",
      promotionLandingMilestone: {
        requiredStablePromotionLandingSessions: 2,
        stablePromotionLandingSessionCount: 2,
        consideredSessionCount: 2,
        latestSuccessful: true,
        latestFailed: false,
        isConfirmed: true
      },
      promotionRampMilestone: {
        ...promotionRampMilestone
      },
      promotionRamp: {
        mode: "raise-promoted-tempo",
        baseTempoBpm: currentTempoBpm,
        targetTempoBpm: nextRampTempoBpm,
        reason: `Ramp do ${currentTempoBpm} BPM zostal potwierdzony, wiec mozna zrobic kolejny kontrolowany skok do ${nextRampTempoBpm} BPM.`
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Awans i pierwszy ramp na "${promotedTraining.title}" sa stabilne. System moze dalej prowadzic tempo w gore bez cofania do poprzedniego treningu.`,
      nextStep: `Wejdz w "${promotedTraining.title}" na ${nextRampTempoBpm} BPM i sprawdz, czy utrzymasz jakosc po kolejnym skoku. Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-ramp", "confirmed"]
    };
  }

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: promotedTraining.id,
    recommendedTrainingTitle: promotedTraining.title,
    recommendedDifficulty: promotedTraining.difficulty,
    suggestedTempoBpm: currentTempoBpm,
    action: "repeat-current",
    practiceScopeOverride: "full-chart",
    promotionSourceTrainingId: sourceTraining.id,
    promotionSourceTrainingTitle: sourceTraining.title,
    promotionSourceTrainingDifficulty: sourceTraining.difficulty,
    promotionSourceTempoBpm: promotionContext.sourceTempoBpm ?? sourceTraining.tempoBpm,
    promotionTargetTrainingId: promotedTraining.id,
    promotionTargetTrainingTitle: promotedTraining.title,
    promotionTargetDifficulty: promotedTraining.difficulty,
    promotionTargetReason:
      promotionContext.reason ??
      `Ramp po awansie jest w trakcie walidacji dla "${promotedTraining.title}".`,
    recoveryProgressStatus: "promotion-ramp",
    promotionLandingMilestone: {
      requiredStablePromotionLandingSessions: 2,
      stablePromotionLandingSessionCount: 2,
      consideredSessionCount: 2,
      latestSuccessful: true,
      latestFailed: false,
      isConfirmed: true
    },
    promotionRampMilestone: {
      ...promotionRampMilestone
    },
    promotionRamp: {
      mode: "validate-promoted-tempo",
      baseTempoBpm: fallbackTempoBpm,
      targetTempoBpm: currentTempoBpm,
      reason: `Sprawdzamy, czy nowe BPM ${currentTempoBpm} utrzyma sie stabilnie na "${promotedTraining.title}".`
    },
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Ramp po awansie jest jeszcze w trakcie walidacji. Stabilne sesje: ${promotionRampMilestone.stablePromotionRampSessionCount}/${promotionRampMilestone.requiredStablePromotionRampSessions}.`,
    nextStep: `Zagraj jeszcze "${promotedTraining.title}" przy ${currentTempoBpm} BPM i zamknij wymagany prog stabilnych sesji dla tego rampu. Priorytet: ${focusSummary}.`,
    matchedReasons: ["promotion-ramp", "monitor"]
  };
}

function selectPromotionTarget({ goalTraining, recoveryTraining, trainings, latestSession }) {
  const goalDifficultyRank = getDifficultyRank(goalTraining.difficulty);
  const latestRating = latestSession.summary?.rating ?? null;
  const latestAccuracy = latestSession.summary?.accuracy ?? 0;
  const latestScoreBreakdown = latestSession.summary?.scoreBreakdown ?? {};

  if (
    !isGradeAtLeast(latestRating?.grade ?? "F", "A") ||
    latestAccuracy < 0.88 ||
    (latestScoreBreakdown.missedTargetCount ?? 0) > 1 ||
    (latestScoreBreakdown.ghostNoteCount ?? 0) > 0
  ) {
    return null;
  }

  const harderTraining = trainings.find((training) => {
    if (training.id === goalTraining.id) {
      return false;
    }

    return getDifficultyRank(training.difficulty) > goalDifficultyRank;
  });

  if (harderTraining) {
    return harderTraining;
  }

  const adjacentPromotionCandidates = trainings
    .filter((training) => {
      if (training.id === goalTraining.id) {
        return false;
      }

      if (recoveryTraining && training.id === recoveryTraining.id) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      if (right.tempoBpm !== left.tempoBpm) {
        return right.tempoBpm - left.tempoBpm;
      }

      return left.title.localeCompare(right.title);
    });

  return adjacentPromotionCandidates[0] ?? null;
}

function buildPromotionLandingRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const promotionContext = latestSession.summary?.practicePromotionContext ?? null;

  if (!promotionContext?.sourceTrainingId) {
    return null;
  }

  const promotedTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const sourceTraining = trainings.find((training) => training.id === promotionContext.sourceTrainingId) ?? null;

  if (!promotedTraining || !sourceTraining) {
    return null;
  }

  const latestRating = latestSession.summary?.rating ?? null;
  const latestPracticePreset = latestSession.summary?.practicePreset ?? null;
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const focusSummary = latestFeedback?.focusAreas?.join(", ") ?? "stabilnym wykonaniu nowego treningu";
  const promotionLandingMilestone = buildPromotionLandingMilestone({
    latestSession,
    completedSessions
  });
  const currentTempoBpm = clampNumber(
    latestPracticePreset?.tempoBpm ?? promotedTraining.tempoBpm ?? 90,
    60,
    200
  );
  const sourceTempoBpm = clampNumber(
    promotionContext.sourceTempoBpm ?? sourceTraining.tempoBpm ?? 90,
    60,
    200
  );

  if (!promotionLandingMilestone) {
    return null;
  }

  if (promotionLandingMilestone.latestFailed) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: sourceTraining.id,
      recommendedTrainingTitle: sourceTraining.title,
      recommendedDifficulty: sourceTraining.difficulty,
      suggestedTempoBpm: sourceTempoBpm,
      action: "switch-training",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: sourceTraining.id,
      promotionSourceTrainingTitle: sourceTraining.title,
      promotionSourceTrainingDifficulty: sourceTraining.difficulty,
      promotionSourceTempoBpm: sourceTempoBpm,
      promotionTargetTrainingId: promotedTraining.id,
      promotionTargetTrainingTitle: promotedTraining.title,
      promotionTargetDifficulty: promotedTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Promocja do "${promotedTraining.title}" okazala sie jeszcze zbyt wczesna, wiec warto odbudowac stabilnosc na "${sourceTraining.title}".`,
      recoveryProgressStatus: "promotion-landing-failed",
      promotionLandingMilestone: {
        ...promotionLandingMilestone
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Pierwsze wejscie w "${promotedTraining.title}" nie utrzymalo jeszcze stabilnosci. Cofamy uzytkownika na poprzedni trening, zanim ponowimy promocje.`,
      nextStep: `Wroc do "${sourceTraining.title}" przy ${sourceTempoBpm} BPM i odbuduj pewnosc. Dopiero po ustabilizowaniu calosci ponow ladowanie na "${promotedTraining.title}". Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-landing", "fallback"]
    };
  }

  if (promotionLandingMilestone.isConfirmed) {
    const promotionRamp = {
      mode: "raise-promoted-tempo",
      baseTempoBpm: currentTempoBpm,
      targetTempoBpm: clampNumber(currentTempoBpm + 4, 60, 220),
      reason: `Awans do "${promotedTraining.title}" jest juz stabilny, wiec mozna zaczac kontrolowany wzrost tempa na nowym treningu.`
    };

    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: promotedTraining.id,
      recommendedTrainingTitle: promotedTraining.title,
      recommendedDifficulty: promotedTraining.difficulty,
      suggestedTempoBpm: promotionRamp.targetTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      promotionSourceTrainingId: sourceTraining.id,
      promotionSourceTrainingTitle: sourceTraining.title,
      promotionSourceTrainingDifficulty: sourceTraining.difficulty,
      promotionSourceTempoBpm: sourceTempoBpm,
      promotionTargetTrainingId: promotedTraining.id,
      promotionTargetTrainingTitle: promotedTraining.title,
      promotionTargetDifficulty: promotedTraining.difficulty,
      promotionTargetReason:
        promotionContext.reason ??
        `Promocja do "${promotedTraining.title}" zostala juz potwierdzona stabilnymi sesjami.`,
      recoveryProgressStatus: "promotion-landing-confirmed",
      promotionLandingMilestone: {
        ...promotionLandingMilestone
      },
      promotionRamp,
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Promocja do "${promotedTraining.title}" zostala potwierdzona. Uzytkownik utrzymal wymagany poziom na nowym materiale i moze wejsc w pierwszy kontrolowany ramp tempa.`,
      nextStep: `Wejdz w "${promotedTraining.title}" na ${promotionRamp.targetTempoBpm} BPM i sprawdz, czy utrzymasz jakosc po pierwszym skoku nad bazowe ${currentTempoBpm} BPM. Priorytet: ${focusSummary}.`,
      matchedReasons: ["promotion-landing", "confirmed"]
    };
  }

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: promotedTraining.id,
    recommendedTrainingTitle: promotedTraining.title,
    recommendedDifficulty: promotedTraining.difficulty,
    suggestedTempoBpm: currentTempoBpm,
    action: "repeat-current",
    practiceScopeOverride: "full-chart",
    promotionSourceTrainingId: sourceTraining.id,
    promotionSourceTrainingTitle: sourceTraining.title,
    promotionSourceTrainingDifficulty: sourceTraining.difficulty,
    promotionSourceTempoBpm: sourceTempoBpm,
    promotionTargetTrainingId: promotedTraining.id,
    promotionTargetTrainingTitle: promotedTraining.title,
    promotionTargetDifficulty: promotedTraining.difficulty,
    promotionTargetReason:
      promotionContext.reason ??
      `Promocja do "${promotedTraining.title}" jest jeszcze w trakcie walidacji.`,
    recoveryProgressStatus: "promotion-landing",
    promotionLandingMilestone: {
      ...promotionLandingMilestone
    },
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Promocja do "${promotedTraining.title}" jest w trakcie walidacji. Stabilne sesje: ${promotionLandingMilestone.stablePromotionLandingSessionCount}/${promotionLandingMilestone.requiredStablePromotionLandingSessions}.`,
    nextStep: `Zagraj jeszcze "${promotedTraining.title}" przy ${currentTempoBpm} BPM i zbierz ${promotionLandingMilestone.requiredStablePromotionLandingSessions} stabilne sesje, zanim uznamy promocje za domknieta. Priorytet: ${focusSummary}.`,
    matchedReasons: ["promotion-landing", "monitor"]
  };
}

function buildReturnAttemptRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const returnContext = latestSession.summary?.practiceReturnContext ?? null;

  if (!returnContext?.recoveryTrainingId) {
    return null;
  }

  const goalTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const recoveryTraining = trainings.find((training) => training.id === returnContext.recoveryTrainingId) ?? null;

  if (!goalTraining || !recoveryTraining) {
    return null;
  }

  const goalSection = findTrainingSection(goalTraining, returnContext.goalSectionId);
  const latestRating = latestSession.summary?.rating ?? null;
  const latestPracticePreset = latestSession.summary?.practicePreset ?? null;
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const focusSummary = latestFeedback?.focusAreas?.join(", ") ?? "stabilnym wykonaniu";
  const returnMilestone = buildReturnAttemptMilestone({
    latestSession,
    completedSessions
  });
  const fullChartReintegrationMilestone = buildFullChartReintegrationMilestone({
    latestSession,
    completedSessions
  });
  const currentTempoBpm = clampNumber(
    latestPracticePreset?.tempoBpm ?? goalTraining.tempoBpm ?? 90,
    60,
    180
  );
  const confirmedReturnRamp = returnMilestone?.isConfirmed
    ? {
        mode: goalSection ? "raise-section-tempo" : "raise-full-chart-tempo",
        targetScope: goalSection ? "section-loop" : "full-chart",
        targetTempoBpm: clampNumber(currentTempoBpm + 4, 60, 180),
        ...(goalSection
          ? {
              loopRepetitionCount: 3,
              loopTempoStepBpm: 2
            }
          : {}),
        reason: goalSection
          ? `Powrot do "${goalSection.label}" zostal potwierdzony, wiec mozna zrobic kontrolowany skok +4 BPM.`
          : `Powrot do calego chartu "${goalTraining.title}" zostal potwierdzony, wiec mozna zrobic kontrolowany skok +4 BPM.`
      }
    : null;
  const fullChartReintegrationRamp = fullChartReintegrationMilestone?.isConfirmed
    ? {
        mode: "raise-full-chart-tempo",
        targetScope: "full-chart",
        targetTempoBpm: clampNumber(currentTempoBpm + 4, 60, 180),
        reason: `Pelny chart "${goalTraining.title}" utrzymal stabilnosc po reintegracji, wiec mozna podniesc tempo o kolejne 4 BPM.`
      }
    : null;
  const promotionTarget = fullChartReintegrationMilestone?.isConfirmed
    ? selectPromotionTarget({
        goalTraining,
        recoveryTraining,
        trainings,
        latestSession
      })
    : null;
  const chartExpansionPlan =
    returnMilestone?.isConfirmed &&
    goalSection &&
    latestPracticePreset?.scope === "section-loop" &&
    isGradeAtLeast(latestRating?.grade ?? "F", "A") &&
    (latestSession.summary?.accuracy ?? 0) >= 0.88 &&
    (latestSession.summary?.scoreBreakdown?.missedTargetCount ?? 0) <= 1 &&
    (latestSession.summary?.scoreBreakdown?.ghostNoteCount ?? 0) === 0
      ? {
          mode: "expand-to-full-chart",
          targetScope: "full-chart",
          sourceSectionId: goalSection.id,
          sourceSectionLabel: goalSection.label,
          targetTempoBpm: clampNumber(Math.max(currentTempoBpm - 2, goalTraining.tempoBpm - 18), 60, 180),
          reason: `Sekcja "${goalSection.label}" utrzymala stabilnosc po rampie, wiec mozna rozszerzyc trening z powrotem na caly chart.`
        }
      : null;

  if (fullChartReintegrationMilestone?.latestFailed) {
    const fallbackTempoBpm = clampNumber(Math.max(currentTempoBpm - 4, goalTraining.tempoBpm - 20), 60, 180);

    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: goalTraining.id,
      recommendedTrainingTitle: goalTraining.title,
      recommendedDifficulty: goalTraining.difficulty,
      suggestedTempoBpm: fallbackTempoBpm,
      action: "repeat-current",
      ...(goalSection
        ? {
            recommendedSectionId: goalSection.id,
            recommendedSectionLabel: goalSection.label,
            sectionAction: "loop-section",
            practiceSectionId: goalSection.id,
            practiceSectionLabel: goalSection.label,
            practiceSectionMode: "full-chart-recovery-section",
            practiceSectionReason: `Pelny chart jeszcze sie rozsypuje, wiec trzeba wrocic na chwile do sekcji "${goalSection.label}".`
          }
        : {}),
      recoveryTrainingId: recoveryTraining.id,
      recoveryTrainingTitle: recoveryTraining.title,
      recoveryTrainingDifficulty: recoveryTraining.difficulty,
      recoveryGoalTrainingId: goalTraining.id,
      recoveryGoalTrainingTitle: goalTraining.title,
      ...(goalSection
        ? {
            recoveryGoalSectionId: goalSection.id,
            recoveryGoalSectionLabel: goalSection.label
          }
        : {}),
      recoveryProgressStatus: "full-chart-reintegration-failed",
      ...(returnMilestone
        ? {
            returnMilestone: {
              ...returnMilestone
            }
          }
        : {}),
      fullChartReintegrationMilestone: {
        ...fullChartReintegrationMilestone
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Pelny chart "${goalTraining.title}" nie trzyma jeszcze stabilnosci po reintegracji. Cofamy zakres do bezpieczniejszego etapu.`,
      nextStep: goalSection
        ? `Wroc na chwile do sekcji "${goalSection.label}" przy ${fallbackTempoBpm} BPM i odbuduj pelny chart krok po kroku. Priorytet: ${focusSummary}.`
        : `Powtorz caly chart "${goalTraining.title}" przy nizszym tempie ${fallbackTempoBpm} BPM, zanim znowu zaczniesz rosnac. Priorytet: ${focusSummary}.`,
      matchedReasons: ["full-chart-reintegration", "rebuild"]
    };
  }

  if (fullChartReintegrationMilestone?.isConfirmed) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: promotionTarget?.id ?? goalTraining.id,
      recommendedTrainingTitle: promotionTarget?.title ?? goalTraining.title,
      recommendedDifficulty: promotionTarget?.difficulty ?? goalTraining.difficulty,
      suggestedTempoBpm: promotionTarget?.tempoBpm ?? fullChartReintegrationRamp?.targetTempoBpm ?? currentTempoBpm,
      action: promotionTarget ? "switch-training" : "repeat-current",
      practiceScopeOverride: "full-chart",
      recoveryTrainingId: recoveryTraining.id,
      recoveryTrainingTitle: recoveryTraining.title,
      recoveryTrainingDifficulty: recoveryTraining.difficulty,
      recoveryGoalTrainingId: goalTraining.id,
      recoveryGoalTrainingTitle: goalTraining.title,
      ...(promotionTarget
        ? {
            promotionSourceTrainingId: goalTraining.id,
            promotionSourceTrainingTitle: goalTraining.title,
            promotionSourceTrainingDifficulty: goalTraining.difficulty,
            promotionSourceTempoBpm: currentTempoBpm,
            promotionTargetTrainingId: promotionTarget.id,
            promotionTargetTrainingTitle: promotionTarget.title,
            promotionTargetDifficulty: promotionTarget.difficulty,
            promotionTargetReason: `Pelny chart "${goalTraining.title}" jest juz stabilny, wiec mozna przeniesc uzytkownika do kolejnego treningu "${promotionTarget.title}".`
          }
        : {}),
      ...(goalSection
        ? {
            recoveryGoalSectionId: goalSection.id,
            recoveryGoalSectionLabel: goalSection.label
          }
        : {}),
      recoveryProgressStatus: "full-chart-reintegrated",
      ...(returnMilestone
        ? {
            returnMilestone: {
              ...returnMilestone
            }
          }
        : {}),
      fullChartReintegrationMilestone: {
        ...fullChartReintegrationMilestone
      },
      ...(fullChartReintegrationRamp
        ? {
            fullChartReintegrationRamp: {
              ...fullChartReintegrationRamp
            }
          }
        : {}),
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Pelny chart "${goalTraining.title}" zostal zreintegrowany stabilnie przez ${fullChartReintegrationMilestone.stableFullChartSessionCount}/${fullChartReintegrationMilestone.requiredStableFullChartSessions} sesje. ${promotionTarget ? `System promuje teraz do "${promotionTarget.title}".` : fullChartReintegrationRamp?.reason ?? ""}`.trim(),
      nextStep: promotionTarget
        ? `Przejdz do treningu "${promotionTarget.title}" na ${promotionTarget.tempoBpm} BPM. Biezacy chart jest juz domkniety i mozna wejsc poziom wyzej. Priorytet: ${focusSummary}.`
        : `Kontynuuj caly chart "${goalTraining.title}" na ${fullChartReintegrationRamp?.targetTempoBpm ?? currentTempoBpm} BPM. Reintegration milestone jest juz zamkniety i mozna znowu rosnac. Priorytet: ${focusSummary}.`,
      matchedReasons: promotionTarget ? ["promotion-routing", "promoted"] : ["full-chart-reintegration", "confirmed"]
    };
  }

  if (fullChartReintegrationMilestone) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: goalTraining.id,
      recommendedTrainingTitle: goalTraining.title,
      recommendedDifficulty: goalTraining.difficulty,
      suggestedTempoBpm: currentTempoBpm,
      action: "repeat-current",
      practiceScopeOverride: "full-chart",
      recoveryTrainingId: recoveryTraining.id,
      recoveryTrainingTitle: recoveryTraining.title,
      recoveryTrainingDifficulty: recoveryTraining.difficulty,
      recoveryGoalTrainingId: goalTraining.id,
      recoveryGoalTrainingTitle: goalTraining.title,
      ...(goalSection
        ? {
            recoveryGoalSectionId: goalSection.id,
            recoveryGoalSectionLabel: goalSection.label
          }
        : {}),
      recoveryProgressStatus: "full-chart-reintegration",
      ...(returnMilestone
        ? {
            returnMilestone: {
              ...returnMilestone
            }
          }
        : {}),
      fullChartReintegrationMilestone: {
        ...fullChartReintegrationMilestone
      },
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Pelny chart "${goalTraining.title}" jest w trakcie reintegracji. Stabilne full-chart sesje: ${fullChartReintegrationMilestone.stableFullChartSessionCount}/${fullChartReintegrationMilestone.requiredStableFullChartSessions}.`,
      nextStep: `Powtorz caly chart "${goalTraining.title}" na ${currentTempoBpm} BPM, az zamkniesz ${fullChartReintegrationMilestone.requiredStableFullChartSessions} stabilne sesje full-chart. Priorytet: ${focusSummary}.`,
      matchedReasons: ["full-chart-reintegration", "monitoring"]
    };
  }

  if (returnMilestone?.latestFailed) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: recoveryTraining.id,
      recommendedTrainingTitle: recoveryTraining.title,
      recommendedDifficulty: recoveryTraining.difficulty,
      suggestedTempoBpm: recoveryTraining.tempoBpm ?? 80,
      action: "switch-training",
      recoveryTrainingId: recoveryTraining.id,
      recoveryTrainingTitle: recoveryTraining.title,
      recoveryTrainingDifficulty: recoveryTraining.difficulty,
      recoveryGoalTrainingId: goalTraining.id,
      recoveryGoalTrainingTitle: goalTraining.title,
      ...(goalSection
        ? {
            recoveryGoalSectionId: goalSection.id,
            recoveryGoalSectionLabel: goalSection.label
          }
        : {}),
      recoveryProgressStatus: "return-failed",
      recoveryReason:
        returnContext.reason ??
        `Powrot do "${goalTraining.title}" nie utrzymal jeszcze poziomu, wiec trzeba odbudowac stabilnosc na treningu recovery.`,
      ...(returnMilestone
        ? {
            returnMilestone: {
              ...returnMilestone
            }
          }
        : {}),
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Ostatnia proba powrotu do "${goalTraining.title}" nie utrzymala jeszcze poziomu. System kieruje z powrotem do recovery.`,
      nextStep: `Wroc do treningu recovery "${recoveryTraining.title}" na ${recoveryTraining.tempoBpm ?? 80} BPM, odbuduj stabilnosc i dopiero potem ponownie sprobuj "${goalTraining.title}"${goalSection ? ` / "${goalSection.label}"` : ""}. Priorytet: ${focusSummary}.`,
      matchedReasons: ["return-attempt", "return-failed"]
    };
  }

  if (returnMilestone?.isConfirmed) {
    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: goalTraining.id,
      recommendedTrainingTitle: goalTraining.title,
      recommendedDifficulty: goalTraining.difficulty,
      suggestedTempoBpm: chartExpansionPlan?.targetTempoBpm ?? confirmedReturnRamp?.targetTempoBpm ?? currentTempoBpm,
      action: "repeat-current",
      ...(goalSection
        ? chartExpansionPlan
          ? {
              recommendedSectionId: goalSection.id,
              recommendedSectionLabel: goalSection.label,
              sectionAction: "expand-to-full-chart",
              practiceSectionMode: "return-expand-full-chart",
              practiceSectionReason: `Po ustabilizowaniu sekcji "${goalSection.label}" pora rozszerzyc zakres z powrotem na caly chart.`
            }
          : {
            recommendedSectionId: goalSection.id,
            recommendedSectionLabel: goalSection.label,
            sectionAction: "loop-section",
            practiceSectionId: goalSection.id,
            practiceSectionLabel: goalSection.label,
            practiceSectionMode: "return-confirmed-section",
            practiceSectionReason: `Powrot do sekcji "${goalSection.label}" zostal juz potwierdzony stabilnymi probami.`
          }
        : {}),
      ...(confirmedReturnRamp && !chartExpansionPlan
        ? {
            loopRepetitionCount: confirmedReturnRamp.loopRepetitionCount,
            loopTempoStepBpm: confirmedReturnRamp.loopTempoStepBpm,
            returnRamp: {
              ...confirmedReturnRamp
            }
          }
        : {}),
      ...(chartExpansionPlan
        ? {
            practiceScopeOverride: "full-chart",
            chartExpansion: {
              ...chartExpansionPlan
            }
          }
        : {}),
      recoveryTrainingId: recoveryTraining.id,
      recoveryTrainingTitle: recoveryTraining.title,
      recoveryTrainingDifficulty: recoveryTraining.difficulty,
      recoveryGoalTrainingId: goalTraining.id,
      recoveryGoalTrainingTitle: goalTraining.title,
      ...(goalSection
        ? {
            recoveryGoalSectionId: goalSection.id,
            recoveryGoalSectionLabel: goalSection.label
          }
        : {}),
      recoveryProgressStatus: "return-confirmed",
      ...(returnMilestone
        ? {
            returnMilestone: {
              ...returnMilestone
            }
          }
        : {}),
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Powrot do "${goalTraining.title}" zostal potwierdzony przez ${returnMilestone.stableReturnSessionCount}/${returnMilestone.requiredStableReturnSessions} stabilne sesje. ${chartExpansionPlan?.reason ?? confirmedReturnRamp?.reason ?? ""}`.trim(),
      nextStep: goalSection
        ? chartExpansionPlan
          ? `Rozszerz "${goalTraining.title}" z sekcji "${goalSection.label}" na caly chart i zagraj go na ${chartExpansionPlan.targetTempoBpm} BPM. Return path jest juz potwierdzony, wiec mozna odbudowac pelny przebieg. Priorytet: ${focusSummary}.`
          : `Kontynuuj "${goalTraining.title}" / "${goalSection.label}" na ${confirmedReturnRamp?.targetTempoBpm ?? currentTempoBpm} BPM przez ${confirmedReturnRamp?.loopRepetitionCount ?? 1} petle${confirmedReturnRamp?.loopTempoStepBpm ? ` z krokiem +${confirmedReturnRamp.loopTempoStepBpm} BPM` : ""}. Return path jest juz potwierdzony. Priorytet: ${focusSummary}.`
        : `Kontynuuj "${goalTraining.title}" na ${confirmedReturnRamp?.targetTempoBpm ?? currentTempoBpm} BPM. Return path jest juz potwierdzony. Priorytet: ${focusSummary}.`,
      matchedReasons: ["return-attempt", "return-confirmed"]
    };
  }

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: goalTraining.id,
    recommendedTrainingTitle: goalTraining.title,
    recommendedDifficulty: goalTraining.difficulty,
    suggestedTempoBpm: currentTempoBpm,
    action: "repeat-current",
    ...(goalSection
      ? {
          recommendedSectionId: goalSection.id,
          recommendedSectionLabel: goalSection.label,
          sectionAction: "loop-section",
          practiceSectionId: goalSection.id,
          practiceSectionLabel: goalSection.label,
          practiceSectionMode: "return-monitoring-section",
          practiceSectionReason: `System nadal monitoruje stabilnosc powrotu do sekcji "${goalSection.label}".`
        }
      : {}),
    recoveryTrainingId: recoveryTraining.id,
    recoveryTrainingTitle: recoveryTraining.title,
    recoveryTrainingDifficulty: recoveryTraining.difficulty,
    recoveryGoalTrainingId: goalTraining.id,
    recoveryGoalTrainingTitle: goalTraining.title,
    ...(goalSection
      ? {
          recoveryGoalSectionId: goalSection.id,
          recoveryGoalSectionLabel: goalSection.label
        }
      : {}),
    recoveryProgressStatus: "return-monitoring",
    ...(returnMilestone
      ? {
          returnMilestone: {
            ...returnMilestone
          }
        }
      : {}),
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Powrot do "${goalTraining.title}" jest w trakcie walidacji. Stabilne proby: ${returnMilestone?.stableReturnSessionCount ?? 0}/${returnMilestone?.requiredStableReturnSessions ?? 2}.`,
    nextStep: goalSection
      ? `Zagraj jeszcze jedna stabilna probe "${goalTraining.title}" / "${goalSection.label}" na ${currentTempoBpm} BPM, zanim uznamy powrot za potwierdzony. Priorytet: ${focusSummary}.`
      : `Zagraj jeszcze jedna stabilna probe "${goalTraining.title}" na ${currentTempoBpm} BPM, zanim uznamy powrot za potwierdzony. Priorytet: ${focusSummary}.`,
    matchedReasons: ["return-attempt", "return-monitoring"]
  };
}

function buildRecoveryProgressRecommendation({
  latestSession,
  completedSessions,
  trainings,
  latestFeedback
}) {
  const recoveryContext = latestSession.summary?.practiceRecoveryContext ?? null;

  if (!recoveryContext?.goalTrainingId) {
    return null;
  }

  const currentTraining = trainings.find((training) => training.id === latestSession.trainingId) ?? null;
  const goalTraining = trainings.find((training) => training.id === recoveryContext.goalTrainingId) ?? null;

  if (!currentTraining || !goalTraining) {
    return null;
  }

  const goalSection = findTrainingSection(goalTraining, recoveryContext.goalSectionId);
  const latestRating = latestSession.summary?.rating ?? null;
  const latestPracticePreset = latestSession.summary?.practicePreset ?? null;
  const primaryHint = latestFeedback?.coachHints?.[0] ?? null;
  const focusSummary = latestFeedback?.focusAreas?.join(", ") ?? "stabilnym wykonaniu";
  const recoveryMilestone = buildRecoveryMilestone({
    latestSession,
    completedSessions
  });
  const goalUnlocked = recoveryMilestone?.isReadyToReturn ?? hasRecoveryGoalUnlocked(latestSession);
  const returnTempoBpm = clampNumber(
    recoveryContext.returnTempoBpm ?? goalTraining.tempoBpm ?? 90,
    60,
    160
  );

  if (goalUnlocked) {
    const loopRepetitionCount = goalSection
      ? Math.max(1, recoveryContext.returnLoopRepetitionCount ?? 2)
      : undefined;
    const loopTempoStepBpm = goalSection
      ? Math.max(0, recoveryContext.returnLoopTempoStepBpm ?? 0)
      : undefined;

    return {
      basedOnSessionId: latestSession.id,
      basedOnTrainingId: latestSession.trainingId,
      basedOnGrade: latestRating?.grade ?? null,
      recommendedTrainingId: goalTraining.id,
      recommendedTrainingTitle: goalTraining.title,
      recommendedDifficulty: goalTraining.difficulty,
      suggestedTempoBpm: returnTempoBpm,
      action: goalTraining.id === latestSession.trainingId ? "repeat-current" : "switch-training",
      ...(goalSection
        ? {
            recommendedSectionId: goalSection.id,
            recommendedSectionLabel: goalSection.label,
            sectionAction: "loop-section",
            sectionRationale: `Trening recovery "${currentTraining.title}" zostal ustabilizowany, wiec mozna wrocic do docelowej sekcji "${goalSection.label}".`,
            loopRepetitionCount,
            loopTempoStepBpm,
            practiceSectionId: goalSection.id,
            practiceSectionLabel: goalSection.label,
            practiceSectionMode: "return-goal-section",
            practiceSectionReason: `Wynik recovery odblokowal powrot do docelowego fragmentu "${goalSection.label}".`
          }
        : {}),
      recoveryTrainingId: currentTraining.id,
      recoveryTrainingTitle: currentTraining.title,
      recoveryTrainingDifficulty: currentTraining.difficulty,
      recoveryGoalTrainingId: goalTraining.id,
      recoveryGoalTrainingTitle: goalTraining.title,
      ...(goalSection
        ? {
            recoveryGoalSectionId: goalSection.id,
            recoveryGoalSectionLabel: goalSection.label
          }
        : {}),
      recoveryProgressStatus: "goal-ready",
      recoveryReason:
        recoveryContext.reason ??
        `Recovery training "${currentTraining.title}" dal juz stabilny wynik i odblokowal powrot do docelowego chartu.`,
      recoveryStrategy: recoveryContext.strategy ?? null,
      ...(recoveryMilestone
        ? {
            recoveryMilestone: {
              ...recoveryMilestone
            }
          }
        : {}),
      ...(latestPracticePreset?.masteryGate
        ? {
            masteryGate: {
              ...latestPracticePreset.masteryGate
            }
          }
        : {}),
      ...(latestPracticePreset?.adaptiveExecution
        ? {
            adaptiveExecution: {
              ...latestPracticePreset.adaptiveExecution
            }
          }
        : {}),
      primaryFocus: primaryHint
        ? {
            id: primaryHint.id,
            title: primaryHint.title,
            severity: primaryHint.severity
          }
        : null,
      rationale: `Trening recovery "${currentTraining.title}" zostal domkniety stabilnie przez ${recoveryMilestone?.stableSessionCount ?? 1}/${recoveryMilestone?.requiredStableSessions ?? 1} wymaganych sesji, wiec mozna wrocic do docelowego materialu.`,
      nextStep: goalSection
        ? `Wroc do treningu "${goalTraining.title}" i sekcji "${goalSection.label}" na ${returnTempoBpm} BPM${loopRepetitionCount ? ` przez ${loopRepetitionCount} petle` : ""}${loopTempoStepBpm ? ` z krokiem +${loopTempoStepBpm} BPM` : ""}. Priorytet: ${focusSummary}.`
        : `Wroc do treningu "${goalTraining.title}" na ${returnTempoBpm} BPM. Priorytet: ${focusSummary}.`,
      matchedReasons: ["recovery-progress", "goal-unlocked"]
    };
  }

  const currentTempoBpm = clampNumber(
    latestPracticePreset?.tempoBpm ?? currentTraining.tempoBpm ?? 90,
    60,
    160
  );

  return {
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestSession.trainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: currentTraining.id,
    recommendedTrainingTitle: currentTraining.title,
    recommendedDifficulty: currentTraining.difficulty,
    suggestedTempoBpm: currentTempoBpm,
    action: "repeat-current",
    recoveryTrainingId: currentTraining.id,
    recoveryTrainingTitle: currentTraining.title,
    recoveryTrainingDifficulty: currentTraining.difficulty,
    recoveryGoalTrainingId: goalTraining.id,
    recoveryGoalTrainingTitle: goalTraining.title,
    ...(goalSection
      ? {
          recoveryGoalSectionId: goalSection.id,
          recoveryGoalSectionLabel: goalSection.label
        }
      : {}),
    recoveryProgressStatus: "keep-recovery",
    recoveryReason:
      recoveryContext.reason ??
      `To nadal trening recovery przed powrotem do "${goalTraining.title}".`,
    recoveryStrategy: recoveryContext.strategy ?? null,
    ...(recoveryMilestone
      ? {
          recoveryMilestone: {
            ...recoveryMilestone
          }
        }
      : {}),
    ...(latestPracticePreset?.masteryGate
      ? {
          masteryGate: {
            ...latestPracticePreset.masteryGate
          }
        }
      : {}),
    ...(latestPracticePreset?.adaptiveExecution
      ? {
          adaptiveExecution: {
            ...latestPracticePreset.adaptiveExecution
          }
        }
      : {}),
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: `Sesja recovery nadal buduje baze pod powrot do "${goalTraining.title}". Stabilne sesje: ${recoveryMilestone?.stableSessionCount ?? 0}/${recoveryMilestone?.requiredStableSessions ?? 2}.`,
    nextStep: goalSection
      ? `Powtorz trening recovery "${currentTraining.title}" na ${currentTempoBpm} BPM, az zamkniesz ${recoveryMilestone?.requiredStableSessions ?? 2} stabilne sesje recovery. Potem wroc do "${goalTraining.title}" / "${goalSection.label}". Priorytet: ${focusSummary}.`
      : `Powtorz trening recovery "${currentTraining.title}" na ${currentTempoBpm} BPM, az zamkniesz ${recoveryMilestone?.requiredStableSessions ?? 2} stabilne sesje recovery. Potem wroc do "${goalTraining.title}". Priorytet: ${focusSummary}.`,
    matchedReasons: ["recovery-progress", "goal-locked"]
  };
}

function buildTargetedPracticeRecommendation({ completedSessions, trainings }) {
  if (completedSessions.length === 0 || trainings.length === 0) {
    return null;
  }

  // Restrict recommendations to trainings the user has actually unlocked, so
  // the engine never suggests content that is still gated behind a prerequisite.
  const unlockGraph = buildContentUnlockGraph({ completedSessions, trainings });
  const unlockedTrainingIds = new Set(
    unlockGraph.nodes.filter((node) => node.isUnlocked).map((node) => node.trainingId)
  );
  const accessibleTrainings = trainings.filter((training) => unlockedTrainingIds.has(training.id));

  // Use accessible trainings for all sub-recommendations so that promotion
  // targets and chain candidates are never locked for the current user.
  trainings = accessibleTrainings; // eslint-disable-line no-param-reassign

  const latestSession = [...completedSessions]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  const latestFeedback = latestSession.summary?.feedback;
  const latestRating = latestSession.summary?.rating;
  const latestTrainingId = latestSession.trainingId;
  const latestSectionBreakdown = latestSession.summary?.sectionBreakdown ?? [];
  const latestPracticePreset = latestSession.summary?.practicePreset ?? null;
  const focusHints = latestFeedback?.coachHints ?? [];
  const primaryHint = focusHints[0] ?? null;
  const focusHintIds = new Set(focusHints.map((hint) => hint.id));
  const latestTraining = trainings.find((training) => training.id === latestTrainingId) ?? null;
  const finalizeRecommendation = (recommendation) =>
    applyVerificationGateToRecommendation({
      recommendation,
      latestSession,
      latestTraining,
      latestPracticePreset,
      latestFeedback
    });
  const terminalTrainingMasteryRecommendation = buildTerminalTrainingMasteryRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (terminalTrainingMasteryRecommendation) {
    return finalizeRecommendation(terminalTrainingMasteryRecommendation);
  }
  const promotionChainGraduationValidationRecommendation = buildPromotionChainGraduationValidationRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (promotionChainGraduationValidationRecommendation) {
    return finalizeRecommendation(promotionChainGraduationValidationRecommendation);
  }
  const promotionChainGraduationRecommendation = buildPromotionChainGraduationRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (promotionChainGraduationRecommendation) {
    return finalizeRecommendation(promotionChainGraduationRecommendation);
  }
  const promotionChainRecommendation = buildPromotionChainRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (promotionChainRecommendation) {
    return finalizeRecommendation(promotionChainRecommendation);
  }
  const promotionReentryRecommendation = buildPromotionReentryRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (promotionReentryRecommendation) {
    return finalizeRecommendation(promotionReentryRecommendation);
  }
  const promotionGraduationRecommendation = buildPromotionGraduationRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (promotionGraduationRecommendation) {
    return finalizeRecommendation(promotionGraduationRecommendation);
  }
  const promotionRampRecommendation = buildPromotionRampRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (promotionRampRecommendation) {
    return finalizeRecommendation(promotionRampRecommendation);
  }
  const promotionLandingRecommendation = buildPromotionLandingRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (promotionLandingRecommendation) {
    return finalizeRecommendation(promotionLandingRecommendation);
  }
  const returnAttemptRecommendation = buildReturnAttemptRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (returnAttemptRecommendation) {
    return finalizeRecommendation(returnAttemptRecommendation);
  }
  const recoveryProgressRecommendation = buildRecoveryProgressRecommendation({
    latestSession,
    completedSessions,
    trainings,
    latestFeedback
  });

  if (recoveryProgressRecommendation) {
    return finalizeRecommendation(recoveryProgressRecommendation);
  }

  const scoredTrainings = trainings.map((training) => {
    const profile = inferTrainingPracticeProfile(training);
    let score = 0;
    const matchedReasons = [];

    if (focusHintIds.has("timing-consistency") || focusHintIds.has("play-less-ahead") || focusHintIds.has("play-more-forward")) {
      if (profile.timingFocus) {
        score += 5;
        matchedReasons.push("timing");
      }
    }

    if (focusHintIds.has("ghost-note-control") || focusHintIds.has("build-streaks")) {
      if (profile.pickingFocus || profile.streakFocus) {
        score += 5;
        matchedReasons.push("control");
      }
    }

    if (focusHintIds.has("hold-notes-longer") || focusHintIds.has("stabilize-sustain")) {
      if (profile.sustainFocus) {
        score += 5;
        matchedReasons.push("sustain");
      }
    }

    if (focusHintIds.has("release-cleaner")) {
      if (profile.releaseFocus) {
        score += 5;
        matchedReasons.push("release");
      }
    }

    if (primaryHint === null) {
      score += profile.beginnerFriendly ? 2 : 1;
      matchedReasons.push("foundation");
    }

    if (training.id === latestTrainingId) {
      score += 2;
      matchedReasons.push("continuity");
    }

    if (latestRating?.grade === "D" || latestRating?.grade === "F") {
      if (profile.beginnerFriendly) {
        score += 3;
        matchedReasons.push("stability");
      }
    }

    score += Math.max(0, 4 - Math.abs((profile.tempoBpm ?? 90) - (trainings.find((item) => item.id === latestTrainingId)?.tempoBpm ?? profile.tempoBpm)) / 15);

    return {
      training,
      score,
      matchedReasons
    };
  });

  scoredTrainings.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.training.title.localeCompare(right.training.title);
  });

  const selected = scoredTrainings[0];

  if (!selected) {
    return null;
  }

  const recommendedSection = selectRecommendedPracticeSection({
    selectedTraining: selected.training,
    latestTraining,
    latestSectionBreakdown
  });
  const repetitionPlan = buildSectionRepetitionPlan({
    latestRating,
    recommendedSection
  });
  const baselineTempo = selected.training.id === latestTrainingId
    ? latestTraining?.tempoBpm ?? selected.training.tempoBpm
    : selected.training.tempoBpm;
  const tempoAdjustment =
    latestRating?.grade === "S" || latestRating?.grade === "A"
      ? 0
      : latestRating?.grade === "B"
        ? -5
        : latestRating?.grade === "C"
          ? -8
          : -12;
  const suggestedTempoBpm = Math.round(clampNumber((baselineTempo ?? 90) + tempoAdjustment, 60, 160));
  const masteryPlan = buildSectionMasteryPlan({
    latestPracticePreset,
    recommendedSection,
    fallbackPlan: repetitionPlan,
    fallbackTempoBpm: suggestedTempoBpm
  });
  const recoveryTraining = selectRecoveryTraining({
    scoredTrainings,
    latestTraining,
    latestRating,
    masteryPlan
  });
  const recoveryPracticeSection = selectRecoveryPracticeSection({
    training: selected.training,
    recommendedSection,
    masteryPlan
  });
  const immediateTraining = recoveryTraining
    ? trainings.find((training) => training.id === recoveryTraining.trainingId) ?? selected.training
    : selected.training;
  const resolvedTempoBpm = recoveryTraining
    ? clampNumber(
        Math.min(
          immediateTraining.tempoBpm ?? masteryPlan.suggestedTempoBpm,
          masteryPlan.suggestedTempoBpm
        ),
        60,
        160
      )
    : masteryPlan.suggestedTempoBpm;
  const resolvedLoopRepetitionCount = recommendedSection && !recoveryTraining
    ? masteryPlan.loopRepetitionCount
    : undefined;
  const resolvedLoopTempoStepBpm = recommendedSection && !recoveryTraining
    ? masteryPlan.loopTempoStepBpm
    : undefined;
  const resolvedPracticeSectionId = recoveryTraining
    ? undefined
    : recoveryPracticeSection?.sectionId ?? recommendedSection?.recommendedSectionId;
  const resolvedPracticeSectionLabel = recoveryTraining
    ? undefined
    : recoveryPracticeSection?.sectionLabel ?? recommendedSection?.recommendedSectionLabel;
  const resolvedPracticeSectionMode = recoveryTraining
    ? undefined
    : recoveryPracticeSection?.mode ?? "focus-section";
  const resolvedPracticeSectionReason = recoveryTraining
    ? undefined
    : recoveryPracticeSection?.reason ?? recommendedSection?.sectionRationale;
  const focusSummary = latestFeedback?.focusAreas?.join(", ") ?? "stabilnym wykonaniu";
  const defaultRationale = primaryHint
    ? `Nastepny krok bazuje na hintcie "${primaryHint.title}" z ostatniej sesji.`
    : "Brak wyraznego bledu dominujacego, wiec rekomendacja wzmacnia fundamenty gry.";
  const rationale = masteryPlan.rationale
    ? `${defaultRationale} ${masteryPlan.rationale}`
    : defaultRationale;
  const adaptiveRationale =
    masteryPlan.adaptiveExecution?.triggered && masteryPlan.adaptiveExecution.stopReason
      ? `${rationale} Engine zatrzymal dalsza progresje sekcji: ${masteryPlan.adaptiveExecution.stopReason}`
      : rationale;
  const nextStep =
    recoveryTraining
      ? `Przejdz tymczasowo do treningu "${immediateTraining.title}" na ${resolvedTempoBpm} BPM, ustabilizuj podstawy, a potem wroc do "${selected.training.title}"${recommendedSection?.recommendedSectionLabel ? ` i sekcji "${recommendedSection.recommendedSectionLabel}"` : ""}. Priorytet: ${focusSummary}.`
      : selected.training.id === latestTrainingId
      ? recommendedSection
        ? masteryPlan.nextStep
          ? `${masteryPlan.nextStep}${resolvedPracticeSectionLabel && resolvedPracticeSectionLabel !== recommendedSection.recommendedSectionLabel ? ` Zacznij od sekcji recovery "${resolvedPracticeSectionLabel}".` : ""} Priorytet: ${focusSummary}.`
          : `Zapetl sekcje "${resolvedPracticeSectionLabel}" ${resolvedLoopRepetitionCount}x od ${resolvedTempoBpm} BPM${resolvedLoopTempoStepBpm > 0 ? `, zwiekszajac tempo o ${resolvedLoopTempoStepBpm} BPM na kazda petle` : ""}, i skup sie na: ${focusSummary}.`
        : `Powtorz obecny trening na ${resolvedTempoBpm} BPM i skup sie na: ${focusSummary}.`
      : `Przejdz do treningu "${selected.training.title}" na ${resolvedTempoBpm} BPM, z naciskiem na: ${focusSummary}.`;

  return finalizeRecommendation({
    basedOnSessionId: latestSession.id,
    basedOnTrainingId: latestTrainingId,
    basedOnGrade: latestRating?.grade ?? null,
    recommendedTrainingId: immediateTraining.id,
    recommendedTrainingTitle: immediateTraining.title,
    recommendedDifficulty: immediateTraining.difficulty,
    suggestedTempoBpm: resolvedTempoBpm,
    action: immediateTraining.id === latestTrainingId ? "repeat-current" : "switch-training",
    ...(recommendedSection ?? {}),
    ...(recommendedSection
      ? {
          loopRepetitionCount: resolvedLoopRepetitionCount,
          loopTempoStepBpm: resolvedLoopTempoStepBpm,
          practiceSectionId: resolvedPracticeSectionId,
          practiceSectionLabel: resolvedPracticeSectionLabel,
          practiceSectionMode: resolvedPracticeSectionMode,
          practiceSectionReason: resolvedPracticeSectionReason
        }
      : {}),
    ...(recoveryTraining
      ? {
          recoveryTrainingId: recoveryTraining.trainingId,
          recoveryTrainingTitle: recoveryTraining.trainingTitle,
          recoveryTrainingDifficulty: recoveryTraining.difficulty,
          recoveryReason: recoveryTraining.reason,
          recoveryStrategy: recoveryTraining.sourceStrategy,
          recoveryProgressStatus: "route-to-recovery",
          recoveryGoalTrainingId: selected.training.id,
          recoveryGoalTrainingTitle: selected.training.title,
          recoveryReturnTempoBpm: masteryPlan.suggestedTempoBpm,
          ...(recommendedSection
            ? {
                recoveryReturnLoopRepetitionCount: masteryPlan.loopRepetitionCount,
                recoveryReturnLoopTempoStepBpm: masteryPlan.loopTempoStepBpm
              }
            : {}),
          ...(recommendedSection
            ? {
                recoveryGoalSectionId: recommendedSection.recommendedSectionId,
                recoveryGoalSectionLabel: recommendedSection.recommendedSectionLabel
              }
            : {})
        }
      : {}),
    ...(masteryPlan.masteryGate
      ? {
          masteryGate: {
            ...masteryPlan.masteryGate
          }
        }
      : {}),
    ...(masteryPlan.adaptiveExecution
      ? {
          adaptiveExecution: {
            ...masteryPlan.adaptiveExecution
          }
        }
      : {}),
    primaryFocus: primaryHint
      ? {
          id: primaryHint.id,
          title: primaryHint.title,
          severity: primaryHint.severity
        }
      : null,
    rationale: adaptiveRationale,
    nextStep,
    matchedReasons: selected.matchedReasons
  });
}

function createCheckpointHistoryBadges({ targetedPractice = null, unlockTransition = null, session = null }) {
  const badges = [];
  const pushBadge = (label, tone = "neutral") => {
    if (!label || badges.some((badge) => badge.label === label)) {
      return;
    }

    badges.push({ label, tone });
  };

  if (unlockTransition?.hasNewUnlocks) {
    pushBadge("Unlock", "success");
  }

  if (session?.summary?.rating?.grade) {
    pushBadge(`Grade ${session.summary.rating.grade}`, "neutral");
  }

  const status = targetedPractice?.recoveryProgressStatus ?? null;

  if (status === "goal-ready") {
    pushBadge("Return Ready", "success");
  } else if (status === "return-confirmed") {
    pushBadge("Return Confirmed", "success");
  } else if (status === "full-chart-reintegrated") {
    pushBadge("Full Chart Back", "success");
  } else if (status === "promotion-landing-confirmed") {
    pushBadge("Promotion Landed", "success");
  } else if (status === "promotion-ramp-confirmed") {
    pushBadge("Ramp Confirmed", "success");
  } else if (status === "promotion-chain-confirmed") {
    pushBadge("Chain Confirmed", "success");
  } else if (status === "promotion-chain-graduated") {
    pushBadge("Chain Graduated", "success");
  } else if (status === "terminal-training-mastery" || status === "terminal-mastery-graduated") {
    pushBadge("Terminal Mastery", "success");
  }

  return badges;
}

function resolveCheckpointHistoryType({ targetedPractice = null, unlockTransition = null }) {
  if (unlockTransition?.hasNewUnlocks) {
    return "unlock";
  }

  const status = targetedPractice?.recoveryProgressStatus ?? null;

  if (status === "route-to-recovery" || status === "keep-recovery") {
    return "recovery";
  }

  if (
    status === "goal-ready" ||
    status === "return-monitoring" ||
    status === "return-confirmed" ||
    status === "full-chart-reintegration" ||
    status === "full-chart-reintegrated"
  ) {
    return "return";
  }

  if (
    status?.startsWith("promotion-") ||
    status === "promotion-graduated"
  ) {
    return "promotion";
  }

  if (
    status === "terminal-training-mastery" ||
    status === "terminal-training-mastered" ||
    status === "terminal-mastery-graduated"
  ) {
    return "mastery";
  }

  return "general";
}

function buildCheckpointHistoryReason({ targetedPractice, unlockTransition, session }) {
  const status = targetedPractice?.recoveryProgressStatus ?? null;

  if (unlockTransition?.hasNewUnlocks) {
    return `Unlocked ${unlockTransition.unlockedTrainingTitles.join(", ")} after this session.`;
  }

  if (status === "route-to-recovery" || status === "keep-recovery") {
    return targetedPractice?.recoveryReason ?? targetedPractice?.nextStep ?? "Recovery route is active.";
  }

  if (
    status === "goal-ready" ||
    status === "return-monitoring" ||
    status === "return-confirmed"
  ) {
    return targetedPractice?.nextStep ?? "Return route is active.";
  }

  if (
    status === "full-chart-reintegration" ||
    status === "full-chart-reintegrated"
  ) {
    return targetedPractice?.fullChartReintegrationRamp?.reason ?? targetedPractice?.nextStep ?? "Full-chart reintegration is active.";
  }

  if (status?.startsWith("promotion-") || status === "promotion-graduated") {
    return (
      targetedPractice?.promotionTargetReason ??
      targetedPractice?.promotionRamp?.reason ??
      targetedPractice?.promotionChain?.reason ??
      targetedPractice?.promotionChainGraduation?.reason ??
      targetedPractice?.nextStep ??
      "Promotion route is active."
    );
  }

  if (
    status === "terminal-training-mastery" ||
    status === "terminal-training-mastered" ||
    status === "terminal-mastery-graduated"
  ) {
    return (
      targetedPractice?.terminalMasteryGraduation?.reason ??
      targetedPractice?.nextStep ??
      "Terminal mastery is active."
    );
  }

  return session.summary?.feedback?.summary ?? targetedPractice?.nextStep ?? "Checkpoint progression updated after this session.";
}

function createCheckpointHistorySnapshot({ session, training, targetedPractice, unlockTransition }) {
  const summary = session.summary ?? {};
  const highlights = [
    `Score ${summary.totalScore ?? 0}, accuracy ${summary.accuracy ?? 0}${summary.rating?.grade ? `, grade ${summary.rating.grade}` : ""}`
  ];
  const recoveryStatus = targetedPractice?.recoveryProgressStatus ?? null;
  const practicePreset = summary.practicePreset ?? null;
  const trainingTitle = training?.title ?? session.trainingId;
  const sectionLabel =
    practicePreset?.loopSectionLabel ??
    practicePreset?.sectionLabel ??
    targetedPractice?.practiceSectionLabel ??
    targetedPractice?.recommendedSectionLabel ??
    null;

  if (unlockTransition?.hasNewUnlocks) {
    highlights.push(`Unlocked ${unlockTransition.unlockedTrainingTitles.join(", ")}`);
  }

  if (recoveryStatus === "route-to-recovery" || recoveryStatus === "keep-recovery") {
    highlights.push(
      targetedPractice?.recoveryTrainingTitle
        ? `Recovery route -> ${targetedPractice.recoveryTrainingTitle}`
        : "Recovery route active"
    );
  } else if (
    recoveryStatus === "goal-ready" ||
    recoveryStatus === "return-monitoring" ||
    recoveryStatus === "return-confirmed"
  ) {
    highlights.push(
      targetedPractice?.recoveryGoalTrainingTitle
        ? `Return route -> ${targetedPractice.recoveryGoalTrainingTitle}`
        : "Return route active"
    );
  } else if (
    recoveryStatus === "full-chart-reintegration" ||
    recoveryStatus === "full-chart-reintegrated"
  ) {
    highlights.push(`Reintegration -> ${targetedPractice?.recommendedTrainingTitle ?? session.trainingId}`);
  } else if (recoveryStatus?.startsWith("promotion-") || recoveryStatus === "promotion-graduated") {
    highlights.push(
      targetedPractice?.promotionTargetTrainingTitle
        ? `Promotion -> ${targetedPractice.promotionTargetTrainingTitle}`
        : "Promotion route active"
    );
  } else if (
    recoveryStatus === "terminal-training-mastery" ||
    recoveryStatus === "terminal-training-mastered" ||
    recoveryStatus === "terminal-mastery-graduated"
  ) {
    highlights.push("Terminal mastery active");
  }

  if (targetedPractice?.nextStep) {
    highlights.push(targetedPractice.nextStep);
  }

  return {
    sessionId: session.id,
    trainingId: session.trainingId,
    trainingTitle,
    completedAt: session.completedAt,
    type: resolveCheckpointHistoryType({
      targetedPractice,
      unlockTransition
    }),
    title: `Session ${session.id}`,
    badges: createCheckpointHistoryBadges({
      targetedPractice,
      unlockTransition,
      session
    }),
    highlights: highlights.slice(0, 3),
    detail: {
      trainingTitle,
      completedAt: session.completedAt,
      totalScore: summary.totalScore ?? 0,
      accuracy: summary.accuracy ?? 0,
      grade: summary.rating?.grade ?? null,
      clearType: summary.rating?.clearType ?? null,
      tempoBpm: practicePreset?.tempoBpm ?? summary.scoreBreakdown?.tempoBpm ?? null,
      practiceScope: practicePreset?.scope ?? "full-chart",
      sectionLabel,
      unlockTitles: unlockTransition?.unlockedTrainingTitles ?? [],
      nextStep: targetedPractice?.nextStep ?? null,
      reason: buildCheckpointHistoryReason({
        targetedPractice,
        unlockTransition,
        session
      })
    }
  };
}

function buildCheckpointHistorySnapshots({ completedSessions, trainings }) {
  if (completedSessions.length === 0 || trainings.length === 0) {
    return [];
  }

  const sortedSessions = [...completedSessions].sort((left, right) =>
    left.completedAt.localeCompare(right.completedAt)
  );
  let previousGraph = buildContentUnlockGraph({
    completedSessions: [],
    trainings,
    targetedPractice: null
  });
  const snapshots = [];

  for (let index = 0; index < sortedSessions.length; index += 1) {
    const session = sortedSessions[index];
    const training = trainings.find((item) => item.id === session.trainingId) ?? null;
    const scopedSessions = sortedSessions.slice(0, index + 1);
    const targetedPractice = buildTargetedPracticeRecommendation({
      completedSessions: scopedSessions,
      trainings
    });
    const nextGraph = buildContentUnlockGraph({
      completedSessions: scopedSessions,
      trainings,
      targetedPractice
    });
    const unlockTransition = findUnlockTransitions({
      previousGraph,
      nextGraph
    });

    snapshots.push(
      createCheckpointHistorySnapshot({
        session,
        training,
        targetedPractice,
        unlockTransition
      })
    );
    previousGraph = nextGraph;
  }

  return snapshots.slice(-3).reverse();
}

function groupDiagnosticsByPath(completedSessions) {
  const grouped = new Map();

  for (const session of completedSessions) {
    const capture = session.summary?.capture;
    const notices = session.summary?.diagnostics?.notices ?? [];

    if (!capture) {
      continue;
    }

    const key = JSON.stringify({
      deviceName: capture.deviceName ?? "Unknown device",
      backend: capture.backend ?? "unknown",
      profile: capture.profile ?? "unknown"
    });
    const currentGroup = grouped.get(key) ?? {
      deviceName: capture.deviceName ?? "Unknown device",
      backend: capture.backend ?? "unknown",
      profile: capture.profile ?? "unknown",
      sessionCount: 0,
      fallbackCount: 0,
      sessionsWithWarnings: 0,
      sessionsWithRuntimeRetry: 0,
      warningNoticeCount: 0,
      runtimeRetryCount: 0,
      totalStartAttempts: 0,
      totalSampleRate: 0,
      sampleRateCount: 0,
      totalBufferMs: 0,
      bufferCount: 0,
      totalNumberOfBuffers: 0,
      numberOfBuffersCount: 0,
      totalMaxChunkGapMs: 0,
      maxChunkGapCount: 0,
      totalLowSignalEventCount: 0,
      totalLowSignalChunkCount: 0,
      warningClassCounts: new Map(),
      averageStartAttempts: 0,
      latestCompletedAt: session.completedAt
    };
    const warningNotices = notices.filter((notice) => notice.level === "warning");
    const runtimeRetryNotices = notices.filter(
      (notice) => notice.code === "NATIVE_CAPTURE_RUNTIME_RETRY"
    );

    currentGroup.sessionCount += 1;
    currentGroup.fallbackCount += capture.fallbackApplied ? 1 : 0;
    currentGroup.sessionsWithWarnings += warningNotices.length > 0 ? 1 : 0;
    currentGroup.sessionsWithRuntimeRetry += runtimeRetryNotices.length > 0 ? 1 : 0;
    currentGroup.warningNoticeCount += warningNotices.length;
    currentGroup.runtimeRetryCount += runtimeRetryNotices.length;
    currentGroup.totalStartAttempts += capture.startAttemptCount ?? 1;
    currentGroup.totalSampleRate += capture.sampleRate ?? 0;
    currentGroup.sampleRateCount += capture.sampleRate ? 1 : 0;
    currentGroup.totalBufferMs += capture.bufferMs ?? 0;
    currentGroup.bufferCount += capture.bufferMs !== undefined ? 1 : 0;
    currentGroup.totalNumberOfBuffers += capture.numberOfBuffers ?? 0;
    currentGroup.numberOfBuffersCount += capture.numberOfBuffers !== undefined ? 1 : 0;
    currentGroup.totalMaxChunkGapMs += capture.maxChunkGapMs ?? 0;
    currentGroup.maxChunkGapCount += capture.maxChunkGapMs !== undefined ? 1 : 0;
    currentGroup.totalLowSignalEventCount += capture.lowSignalEventCount ?? 0;
    currentGroup.totalLowSignalChunkCount += capture.lowSignalChunkCount ?? 0;

    for (const notice of warningNotices) {
      const issueClass = classifyNoticeIssueClass(notice);
      currentGroup.warningClassCounts.set(
        issueClass,
        (currentGroup.warningClassCounts.get(issueClass) ?? 0) + 1
      );
    }

    currentGroup.averageStartAttempts = Number(
      (currentGroup.totalStartAttempts / currentGroup.sessionCount).toFixed(2)
    );
    currentGroup.averageSampleRate = currentGroup.sampleRateCount === 0
      ? 0
      : Math.round(currentGroup.totalSampleRate / currentGroup.sampleRateCount);
    currentGroup.averageBufferMs = currentGroup.bufferCount === 0
      ? 0
      : Number((currentGroup.totalBufferMs / currentGroup.bufferCount).toFixed(2));
    currentGroup.averageNumberOfBuffers = currentGroup.numberOfBuffersCount === 0
      ? 0
      : Number((currentGroup.totalNumberOfBuffers / currentGroup.numberOfBuffersCount).toFixed(2));
    currentGroup.averageMaxChunkGapMs = currentGroup.maxChunkGapCount === 0
      ? 0
      : Number((currentGroup.totalMaxChunkGapMs / currentGroup.maxChunkGapCount).toFixed(2));
    currentGroup.fallbackRate = Number(
      (currentGroup.fallbackCount / currentGroup.sessionCount).toFixed(2)
    );
    currentGroup.warningSessionRate = Number(
      (currentGroup.sessionsWithWarnings / currentGroup.sessionCount).toFixed(2)
    );
    currentGroup.runtimeRetryRate = Number(
      (currentGroup.sessionsWithRuntimeRetry / currentGroup.sessionCount).toFixed(2)
    );
    currentGroup.averageWarningNotices = Number(
      (currentGroup.warningNoticeCount / currentGroup.sessionCount).toFixed(2)
    );

    if (session.completedAt > currentGroup.latestCompletedAt) {
      currentGroup.latestCompletedAt = session.completedAt;
    }

    grouped.set(key, currentGroup);
  }

  return [...grouped.values()]
    .map((group) => {
      const warningClassBreakdown = [...group.warningClassCounts.entries()]
        .map(([issueClass, eventCount]) => ({
          issueClass,
          eventCount,
          eventRate:
            group.warningNoticeCount === 0
              ? 0
              : Number((eventCount / group.warningNoticeCount).toFixed(2))
        }))
        .sort((left, right) => right.eventCount - left.eventCount);

      return Object.fromEntries(
        Object.entries({
          ...group,
          dominantWarningClass: warningClassBreakdown[0]?.issueClass ?? null,
          warningClassBreakdown
        }).filter(([key]) => key !== "warningClassCounts")
      );
    })
    .sort((left, right) => right.latestCompletedAt.localeCompare(left.latestCompletedAt));
}

function buildDiagnosticsSummaryFromMetrics(summaryMetrics, groupedPaths) {
  const sessionCount = summaryMetrics.sessionCount;
  const sessionsWithFallback = summaryMetrics.sessionsWithFallback;
  const averageStartAttempts =
    sessionCount === 0
      ? 0
      : Number((summaryMetrics.totalStartAttempts / sessionCount).toFixed(2));
  const mostProblematicPath = groupedPaths.length > 0
    ? [...groupedPaths]
        .sort((left, right) => {
          if (right.fallbackRate !== left.fallbackRate) {
            return right.fallbackRate - left.fallbackRate;
          }

          if (right.averageStartAttempts !== left.averageStartAttempts) {
            return right.averageStartAttempts - left.averageStartAttempts;
          }

          return right.latestCompletedAt.localeCompare(left.latestCompletedAt);
        })[0]
    : null;

  return {
    sessionCount,
    pathCount: groupedPaths.length,
    sessionsWithFallback,
    fallbackRate: sessionCount === 0 ? 0 : Number((sessionsWithFallback / sessionCount).toFixed(2)),
    averageStartAttempts,
    mostProblematicPath: mostProblematicPath
      ? {
          deviceName: mostProblematicPath.deviceName,
          backend: mostProblematicPath.backend,
          profile: mostProblematicPath.profile,
          fallbackRate: mostProblematicPath.fallbackRate,
          averageStartAttempts: mostProblematicPath.averageStartAttempts
        }
      : null
  };
}

function normalizeDiagnosticsQuery(input = {}) {
  return {
    ...(input.deviceName ? { deviceName: String(input.deviceName).trim().toLowerCase() } : {}),
    ...(input.deviceNameExact ? { deviceNameExact: String(input.deviceNameExact).trim().toLowerCase() } : {}),
    ...(input.backend ? { backend: String(input.backend).trim().toLowerCase() } : {}),
    ...(input.profile ? { profile: String(input.profile).trim().toLowerCase() } : {}),
    sortBy: ["latest", "fallbacks", "fallbackRate", "attempts", "sessions"].includes(input.sortBy)
      ? input.sortBy
      : "latest",
    sortDirection: input.sortDirection === "asc" ? "asc" : "desc"
  };
}

function sortGroupedPaths(groupedPaths, { sortBy = "latest", sortDirection = "desc" } = {}) {
  const direction = sortDirection === "asc" ? 1 : -1;
  const sortedPaths = [...groupedPaths];

  sortedPaths.sort((left, right) => {
    let comparison = 0;

    switch (sortBy) {
      case "fallbacks":
        comparison = left.fallbackCount - right.fallbackCount;
        break;
      case "fallbackRate":
        comparison = left.fallbackRate - right.fallbackRate;
        break;
      case "attempts":
        comparison = left.averageStartAttempts - right.averageStartAttempts;
        break;
      case "sessions":
        comparison = left.sessionCount - right.sessionCount;
        break;
      default:
        comparison = left.latestCompletedAt.localeCompare(right.latestCompletedAt);
        break;
    }

    if (comparison === 0) {
      comparison = left.deviceName.localeCompare(right.deviceName);
    }

    return comparison * direction;
  });

  return sortedPaths;
}

function buildDiagnosticsSummary(completedSessions, groupedPaths) {
  const sessionCount = completedSessions.length;
  const sessionsWithFallback = completedSessions.filter((session) => session.summary?.capture?.fallbackApplied).length;
  const averageStartAttempts =
    sessionCount === 0
      ? 0
      : Number(
          (
            completedSessions.reduce(
              (sum, session) => sum + (session.summary?.capture?.startAttemptCount ?? 1),
              0
            ) / sessionCount
          ).toFixed(2)
        );
  const mostProblematicPath = groupedPaths.length > 0
    ? [...groupedPaths]
        .sort((left, right) => {
          if (right.fallbackRate !== left.fallbackRate) {
            return right.fallbackRate - left.fallbackRate;
          }

          if (right.averageStartAttempts !== left.averageStartAttempts) {
            return right.averageStartAttempts - left.averageStartAttempts;
          }

          return right.latestCompletedAt.localeCompare(left.latestCompletedAt);
        })[0]
    : null;

  return {
    sessionCount,
    pathCount: groupedPaths.length,
    sessionsWithFallback,
    fallbackRate: sessionCount === 0 ? 0 : Number((sessionsWithFallback / sessionCount).toFixed(2)),
    averageStartAttempts,
    mostProblematicPath: mostProblematicPath
      ? {
          deviceName: mostProblematicPath.deviceName,
          backend: mostProblematicPath.backend,
          profile: mostProblematicPath.profile,
          fallbackRate: mostProblematicPath.fallbackRate,
          averageStartAttempts: mostProblematicPath.averageStartAttempts
        }
      : null
  };
}

function createPathIdentity(path) {
  return `${path.deviceName} via ${String(path.backend).toUpperCase()} [${path.profile}]`;
}

function createRecommendationReason(path) {
  if (path.fallbackRate === 0 && path.averageStartAttempts <= 1) {
    return "This path has no recorded fallbacks and starts cleanly.";
  }

  if (path.fallbackRate <= 0.25 && path.averageStartAttempts <= 1.5) {
    return "This path is currently the most stable option in the recorded sessions.";
  }

  return "This path is the least risky option among the recorded sessions, but still needs more validation.";
}

function addSetupRecommendation(recommendations, recommendation) {
  if (!recommendation || recommendations.some((entry) => entry.id === recommendation.id)) {
    return;
  }

  recommendations.push(recommendation);
}

function buildSetupRecommendations(path, scores) {
  const recommendations = [];
  const averageLowSignalEvents = path.sessionCount === 0
    ? 0
    : path.totalLowSignalEventCount / path.sessionCount;
  const averageLowSignalChunks = path.sessionCount === 0
    ? 0
    : path.totalLowSignalChunkCount / path.sessionCount;

  if (path.dominantWarningClass === "backend-routing" && path.backend === "wavein") {
    addSetupRecommendation(recommendations, {
      id: "prefer-wasapi",
      priority: "high",
      title: "Prefer WASAPI",
      detail: "This path is mostly failing because capture gets rerouted away from WaveIn. Move this device to WASAPI first."
    });
  }

  if (path.dominantWarningClass === "profile-routing") {
    addSetupRecommendation(recommendations, {
      id: path.profile === "low-latency" ? "try-balanced-profile" : "try-recommended-profile",
      priority: "high",
      title: path.profile === "low-latency" ? "Try balanced profile" : "Try recommended profile",
      detail:
        path.profile === "low-latency"
          ? "This path is mostly falling away from low-latency. Re-test it on balanced first."
          : "This path is mostly rerouted by profile selection. Re-test it on the device's recommended capture profile."
    });
  }

  if (path.dominantWarningClass === "startup-retry" || path.dominantWarningClass === "stream-stability") {
    addSetupRecommendation(recommendations, {
      id: "reduce-runtime-pressure",
      priority: "high",
      title: "Reduce runtime pressure",
      detail: "This path is mostly unstable during startup/runtime. Reduce background CPU load or re-test with a safer capture path."
    });
  }

  if (path.dominantWarningClass === "signal-quality") {
    addSetupRecommendation(recommendations, {
      id: "increase-input-level",
      priority: "high",
      title: "Increase input level",
      detail: "This path is mostly failing on signal quality. Raise gain on the interface or verify the guitar signal path first."
    });
  }

  if (scores.signalQualityScore < 90 && averageLowSignalEvents >= 0.5) {
    addSetupRecommendation(recommendations, {
      id: "increase-input-level",
      priority: "high",
      title: "Increase input level",
      detail: "Raise gain on the interface or verify the guitar signal path, because repeated low-signal events were detected."
    });
  }

  if (scores.signalQualityScore < 92 && averageLowSignalChunks >= 2) {
    addSetupRecommendation(recommendations, {
      id: "verify-input-chain",
      priority: "medium",
      title: "Verify input chain",
      detail: "Check the cable, instrument input selection and pad settings. The session contained multiple low-signal chunks."
    });
  }

  if (path.averageMaxChunkGapMs >= 180) {
    addSetupRecommendation(recommendations, {
      id: "reduce-runtime-pressure",
      priority: "high",
      title: "Reduce runtime pressure",
      detail: "Large chunk gaps were recorded. Try a less aggressive capture profile or reduce background CPU load."
    });
  }

  if (path.averageMaxChunkGapMs >= 120 && path.profile === "low-latency") {
    addSetupRecommendation(recommendations, {
      id: "try-balanced-profile",
      priority: "medium",
      title: "Try balanced profile",
      detail: "This low-latency path shows timing gaps. Test the balanced profile for better runtime consistency."
    });
  }

  if (path.backend === "wavein" && path.deviceName && scores.signalQualityScore < 95) {
    addSetupRecommendation(recommendations, {
      id: "prefer-wasapi",
      priority: "medium",
      title: "Prefer WASAPI",
      detail: "This device is performing below target on WaveIn. Re-test it through WASAPI if that backend is available."
    });
  }

  if (recommendations.length === 0 && scores.signalQualityScore >= 95 && scores.runtimeStabilityScore >= 95) {
    addSetupRecommendation(recommendations, {
      id: "keep-current-setup",
      priority: "info",
      title: "Keep current setup",
      detail: "Current capture settings look healthy. No immediate input-chain change is suggested from recorded sessions."
    });
  }

  return recommendations.slice(0, 3);
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function calculateLatencyFitness(path) {
  const sampleRateScore =
    path.averageSampleRate >= 96000
      ? 100
      : path.averageSampleRate >= 48000
        ? 88
        : path.averageSampleRate >= 44100
          ? 80
          : 68;
  const bufferScore = clampScore(
    100 - Math.max(0, path.averageBufferMs - 8) * 2.5,
    45,
    100
  );
  const bufferCountScore = clampScore(
    100 - Math.max(0, path.averageNumberOfBuffers - 2) * 18,
    50,
    100
  );
  const retryAdjustedScore = clampScore(100 - path.runtimeRetryRate * 20);
  const chunkGapScore = clampScore(
    100 - Math.max(0, path.averageMaxChunkGapMs - 40) * 0.18,
    35,
    100
  );

  return {
    latencyFitnessScore: Math.round(
      sampleRateScore * 0.26 +
      bufferScore * 0.34 +
      bufferCountScore * 0.14 +
      retryAdjustedScore * 0.11 +
      chunkGapScore * 0.15
    ),
    latencyFactors: {
      sampleRateScore,
      bufferScore: Number(bufferScore.toFixed(2)),
      bufferCountScore: Number(bufferCountScore.toFixed(2)),
      retryAdjustedScore: Number(retryAdjustedScore.toFixed(2)),
      chunkGapScore: Number(chunkGapScore.toFixed(2))
    }
  };
}

function calculateSignalQuality(path) {
  const averageLowSignalEvents = path.sessionCount === 0
    ? 0
    : path.totalLowSignalEventCount / path.sessionCount;
  const averageLowSignalChunks = path.sessionCount === 0
    ? 0
    : path.totalLowSignalChunkCount / path.sessionCount;
  const lowSignalEventScore = clampScore(
    100 - averageLowSignalEvents * 18,
    35,
    100
  );
  const lowSignalChunkScore = clampScore(
    100 - averageLowSignalChunks * 4,
    40,
    100
  );
  const warningAdjustmentScore = clampScore(
    100 - path.warningSessionRate * 12,
    45,
    100
  );

  return {
    signalQualityScore: Math.round(
      lowSignalEventScore * 0.5 +
      lowSignalChunkScore * 0.3 +
      warningAdjustmentScore * 0.2
    ),
    signalFactors: {
      lowSignalEventScore: Number(lowSignalEventScore.toFixed(2)),
      lowSignalChunkScore: Number(lowSignalChunkScore.toFixed(2)),
      warningAdjustmentScore: Number(warningAdjustmentScore.toFixed(2))
    }
  };
}

function buildSetupRecommendationPreferences(groupedPaths, setupRecommendationHistory = []) {
  if (setupRecommendationHistory.length === 0 || groupedPaths.length === 0) {
    return [];
  }

  const groupedFeedback = new Map();

  for (const entry of setupRecommendationHistory) {
    const key = JSON.stringify({
      deviceName: entry.deviceName,
      backend: entry.backend,
      profile: entry.profile
    });
    const currentGroup = groupedFeedback.get(key) ?? {
      deviceName: entry.deviceName,
      backend: entry.backend,
      profile: entry.profile,
      appliedCount: 0,
      improvedCount: 0,
      noImprovementCount: 0,
      latestFeedbackAt: entry.evaluatedAt ?? entry.timestamp
    };

    currentGroup.appliedCount += 1;

    if (entry.status === "improved") {
      currentGroup.improvedCount += 1;
    }

    if (entry.status === "no-improvement") {
      currentGroup.noImprovementCount += 1;
    }

    const latestTimestamp = entry.evaluatedAt ?? entry.timestamp;

    if (latestTimestamp > currentGroup.latestFeedbackAt) {
      currentGroup.latestFeedbackAt = latestTimestamp;
    }

    groupedFeedback.set(key, currentGroup);
  }

  return [...groupedFeedback.values()]
    .map((feedbackGroup) => {
      const matchingPath = groupedPaths.find(
        (path) =>
          path.deviceName === feedbackGroup.deviceName &&
          path.backend === feedbackGroup.backend &&
          path.profile === feedbackGroup.profile
      );
      const evaluatedCount = feedbackGroup.improvedCount + feedbackGroup.noImprovementCount;

      return {
        ...feedbackGroup,
        evaluatedCount,
        improvementRate:
          evaluatedCount === 0
            ? null
            : Number((feedbackGroup.improvedCount / evaluatedCount).toFixed(2)),
        pathAvailable: Boolean(matchingPath),
        sessionCount: matchingPath?.sessionCount ?? 0,
        fallbackRate: matchingPath?.fallbackRate ?? null,
        averageStartAttempts: matchingPath?.averageStartAttempts ?? null
      };
    })
    .sort((left, right) => {
      if (right.improvedCount !== left.improvedCount) {
        return right.improvedCount - left.improvedCount;
      }

      if (right.appliedCount !== left.appliedCount) {
        return right.appliedCount - left.appliedCount;
      }

      return right.latestFeedbackAt.localeCompare(left.latestFeedbackAt);
    });
}

function buildSetupRecommendationExecutionSummary(
  setupRecommendationHistory = [],
  { source = null, sampleSize = 6 } = {}
) {
  const filteredHistory = source
    ? setupRecommendationHistory.filter((entry) => entry.source === source)
    : setupRecommendationHistory.slice();
  const sampledEntries = filteredHistory
    .slice()
    .sort((left, right) => {
      const leftTimestamp = left.evaluatedAt ?? left.appliedAt ?? left.timestamp;
      const rightTimestamp = right.evaluatedAt ?? right.appliedAt ?? right.timestamp;
      return rightTimestamp.localeCompare(leftTimestamp);
    })
    .slice(0, sampleSize);
  const latestEntry = sampledEntries[0] ?? null;

  return {
    sampleSize,
    trackedCount: filteredHistory.length,
    analyzedEntryCount: sampledEntries.length,
    pendingCount: sampledEntries.filter((entry) => entry.status === "applied").length,
    improvedCount: sampledEntries.filter((entry) => entry.status === "improved").length,
    noImprovementCount: sampledEntries.filter((entry) => entry.status === "no-improvement").length,
    latestStatus: latestEntry?.status ?? "none",
    latestRecommendationId: latestEntry?.recommendationId ?? null,
    latestRecommendationTitle: latestEntry?.recommendationTitle ?? null,
    latestPlannedSessionId: latestEntry?.plannedSessionId ?? null,
    latestObservedSessionId: latestEntry?.observedSessionId ?? null,
    latestEvaluatedAt: latestEntry?.evaluatedAt ?? null
  };
}

function calculatePathScores(path, overrideSupportCount = 0, setupFeedback = null) {
  const averageLowSignalEvents = path.sessionCount === 0
    ? 0
    : path.totalLowSignalEventCount / path.sessionCount;
  const averageLowSignalChunks = path.sessionCount === 0
    ? 0
    : path.totalLowSignalChunkCount / path.sessionCount;
  const fallbackPenalty = path.fallbackRate * 45;
  const attemptPenalty = Math.max(0, path.averageStartAttempts - 1) * 20;
  const warningPenalty = path.warningSessionRate * 20;
  const runtimeRetryPenalty = path.runtimeRetryRate * 35;
  const noticeDensityPenalty = path.averageWarningNotices * 8;
  const chunkGapPenalty = Math.max(0, path.averageMaxChunkGapMs - 90) * 0.12;
  const lowSignalPenalty = averageLowSignalEvents * 10 + averageLowSignalChunks * 2.5;
  const lowSamplePenalty = path.sessionCount >= 3 ? 0 : (3 - path.sessionCount) * 12;
  const overrideBonus = Math.min(overrideSupportCount * 3, 9);
  const setupImprovementBonus = Math.min((setupFeedback?.improvedCount ?? 0) * 4, 12);
  const setupNoImprovementPenalty = Math.min((setupFeedback?.noImprovementCount ?? 0) * 5, 15);
  const setupFeedbackBonus = Math.min((setupFeedback?.evaluatedCount ?? 0) * 4, 12);
  const latencyFitness = calculateLatencyFitness(path);
  const signalQuality = calculateSignalQuality(path);
  const startReliabilityScore = clampScore(100 - fallbackPenalty - attemptPenalty);
  const runtimeStabilityScore = clampScore(
    100 -
      warningPenalty -
      runtimeRetryPenalty -
      noticeDensityPenalty -
      chunkGapPenalty -
      lowSignalPenalty +
      setupImprovementBonus -
      setupNoImprovementPenalty
  );
  const recommendationConfidenceScore = clampScore(
    100 - lowSamplePenalty + overrideBonus + setupFeedbackBonus - setupNoImprovementPenalty
  );
  const stabilityScore = Math.round(
    clampScore(
      startReliabilityScore * 0.45 +
      runtimeStabilityScore * 0.35 +
      recommendationConfidenceScore * 0.2
    )
  );

  return {
    stabilityScore,
    startReliabilityScore: Math.round(startReliabilityScore),
    runtimeStabilityScore: Math.round(runtimeStabilityScore),
    recommendationConfidenceScore: Math.round(recommendationConfidenceScore),
    latencyFitnessScore: latencyFitness.latencyFitnessScore,
    signalQualityScore: signalQuality.signalQualityScore,
    factors: {
      fallbackPenalty: Number(fallbackPenalty.toFixed(2)),
      attemptPenalty: Number(attemptPenalty.toFixed(2)),
      warningPenalty: Number(warningPenalty.toFixed(2)),
      runtimeRetryPenalty: Number(runtimeRetryPenalty.toFixed(2)),
      noticeDensityPenalty: Number(noticeDensityPenalty.toFixed(2)),
      chunkGapPenalty: Number(chunkGapPenalty.toFixed(2)),
      lowSignalPenalty: Number(lowSignalPenalty.toFixed(2)),
      lowSamplePenalty,
      overrideBonus,
      setupImprovementBonus,
      setupNoImprovementPenalty,
      setupFeedbackBonus,
      ...latencyFitness.latencyFactors,
      ...signalQuality.signalFactors
    }
  };
}

function createStabilitySummary(path, scores, overrideSupportCount = 0, setupFeedback = null) {
  const parts = [
    `${path.sessionCount} session(s)`,
    `fallback rate ${Math.round(path.fallbackRate * 100)}%`,
    `average attempts ${path.averageStartAttempts}`,
    `warning rate ${Math.round(path.warningSessionRate * 100)}%`
  ];

  if (path.averageMaxChunkGapMs) {
    parts.push(`avg max gap ${path.averageMaxChunkGapMs} ms`);
  }

  if (path.totalLowSignalEventCount) {
    parts.push(`low-signal events ${path.totalLowSignalEventCount}`);
  }

  if (overrideSupportCount > 0) {
    parts.push(`override support ${overrideSupportCount}`);
  }

  if (setupFeedback?.appliedCount) {
    parts.push(`setup feedback ${setupFeedback.improvedCount}/${setupFeedback.appliedCount} improved`);
  }

  parts.push(
    `start ${scores.startReliabilityScore}/100`,
    `runtime ${scores.runtimeStabilityScore}/100`,
    `confidence ${scores.recommendationConfidenceScore}/100`,
    `latency ${scores.latencyFitnessScore}/100`,
    `signal ${scores.signalQualityScore}/100`,
    `overall ${scores.stabilityScore}/100`
  );
  return parts.join(", ");
}

function decorateRecommendedPath(path, selectionSource, overrideSupportCount = 0, setupFeedback = null) {
  const scores = calculatePathScores(path, overrideSupportCount, setupFeedback);
  const setupRecommendations = buildSetupRecommendations(path, scores);

  return {
    deviceName: path.deviceName,
    backend: path.backend,
    profile: path.profile,
    sessionCount: path.sessionCount,
    fallbackRate: path.fallbackRate,
    averageStartAttempts: path.averageStartAttempts,
    latestCompletedAt: path.latestCompletedAt,
    dominantWarningClass: path.dominantWarningClass ?? null,
    warningClassBreakdown: path.warningClassBreakdown ?? [],
    label: createPathIdentity(path),
    reason: selectionSource === "user-override-history"
      ? `User override history currently supports this path. ${createRecommendationReason(path)}`
      : selectionSource === "technical-with-user-confirmation"
        ? `User override history aligns with this technically recommended path. ${createRecommendationReason(path)}`
        : createRecommendationReason(path),
    selectionSource,
    overrideSupportCount,
    setupFeedback,
    stabilityScore: scores.stabilityScore,
    startReliabilityScore: scores.startReliabilityScore,
    runtimeStabilityScore: scores.runtimeStabilityScore,
    recommendationConfidenceScore: scores.recommendationConfidenceScore,
    latencyFitnessScore: scores.latencyFitnessScore,
    signalQualityScore: scores.signalQualityScore,
    setupRecommendations,
    primarySetupRecommendation: setupRecommendations[0] ?? null,
    stabilityFactors: scores.factors,
    stabilitySummary: createStabilitySummary(path, scores, overrideSupportCount, setupFeedback)
  };
}

function buildScoredPaths(paths, overridePreferences = [], setupRecommendationPreferences = []) {
  return [...paths]
    .map((path) => {
      const matchingOverride = overridePreferences.find(
        (candidate) =>
          candidate.deviceName === path.deviceName &&
          candidate.backend === path.backend &&
          candidate.profile === path.profile
      );
      const matchingSetupFeedback = setupRecommendationPreferences.find(
        (candidate) =>
          candidate.deviceName === path.deviceName &&
          candidate.backend === path.backend &&
          candidate.profile === path.profile
      );
      const overrideSupportCount = matchingOverride?.overrideCount ?? 0;
      const scores = calculatePathScores(path, overrideSupportCount, matchingSetupFeedback);
      const setupRecommendations = buildSetupRecommendations(path, scores);

      return {
        deviceName: path.deviceName,
        backend: path.backend,
        profile: path.profile,
        sessionCount: path.sessionCount,
        fallbackCount: path.fallbackCount,
        fallbackRate: path.fallbackRate,
        averageStartAttempts: path.averageStartAttempts,
        latestCompletedAt: path.latestCompletedAt,
        dominantWarningClass: path.dominantWarningClass ?? null,
        warningClassBreakdown: path.warningClassBreakdown ?? [],
        overrideSupportCount,
        setupFeedback: matchingSetupFeedback ?? null,
        stabilityScore: scores.stabilityScore,
        startReliabilityScore: scores.startReliabilityScore,
        runtimeStabilityScore: scores.runtimeStabilityScore,
        recommendationConfidenceScore: scores.recommendationConfidenceScore,
        latencyFitnessScore: scores.latencyFitnessScore,
        signalQualityScore: scores.signalQualityScore,
        setupRecommendations,
        primarySetupRecommendation: setupRecommendations[0] ?? null,
        stabilityFactors: scores.factors,
        stabilitySummary: createStabilitySummary(path, scores, overrideSupportCount, matchingSetupFeedback),
        label: createPathIdentity(path)
      };
    })
    .sort((left, right) => {
      if (right.stabilityScore !== left.stabilityScore) {
        return right.stabilityScore - left.stabilityScore;
      }

      if (right.latencyFitnessScore !== left.latencyFitnessScore) {
        return right.latencyFitnessScore - left.latencyFitnessScore;
      }

      if (right.sessionCount !== left.sessionCount) {
        return right.sessionCount - left.sessionCount;
      }

      return right.latestCompletedAt.localeCompare(left.latestCompletedAt);
    });
}

function buildOverridePreferences(groupedPaths, overrideHistory = []) {
  if (overrideHistory.length === 0 || groupedPaths.length === 0) {
    return [];
  }

  const groupedOverrides = new Map();

  for (const overrideEntry of overrideHistory) {
    const key = JSON.stringify({
      deviceName: overrideEntry.deviceName,
      backend: overrideEntry.selectedBackend,
      profile: overrideEntry.selectedProfile
    });
    const currentGroup = groupedOverrides.get(key) ?? {
      deviceName: overrideEntry.deviceName,
      backend: overrideEntry.selectedBackend,
      profile: overrideEntry.selectedProfile,
      overrideCount: 0,
      latestOverrideAt: overrideEntry.timestamp
    };

    currentGroup.overrideCount += 1;

    if (overrideEntry.timestamp > currentGroup.latestOverrideAt) {
      currentGroup.latestOverrideAt = overrideEntry.timestamp;
    }

    groupedOverrides.set(key, currentGroup);
  }

  return [...groupedOverrides.values()]
    .map((overrideGroup) => {
      const matchingPath = groupedPaths.find(
        (path) =>
          path.backend === overrideGroup.backend &&
          path.profile === overrideGroup.profile &&
          path.deviceName === overrideGroup.deviceName
      );

      return {
        ...overrideGroup,
        technicalPathAvailable: Boolean(matchingPath),
        fallbackRate: matchingPath?.fallbackRate ?? null,
        averageStartAttempts: matchingPath?.averageStartAttempts ?? null,
        sessionCount: matchingPath?.sessionCount ?? 0
      };
    })
    .sort((left, right) => {
      if (right.overrideCount !== left.overrideCount) {
        return right.overrideCount - left.overrideCount;
      }

      return right.latestOverrideAt.localeCompare(left.latestOverrideAt);
    });
}

function selectRecommendedPath(groupedPaths, overrideHistory = [], setupRecommendationHistory = []) {
  if (groupedPaths.length === 0) {
    return {
      recommendedPath: null,
      overridePreferences: [],
      setupRecommendationPreferences: []
    };
  }

  const overridePreferences = buildOverridePreferences(groupedPaths, overrideHistory);
  const setupRecommendationPreferences = buildSetupRecommendationPreferences(
    groupedPaths,
    setupRecommendationHistory
  );
  const scoredPaths = buildScoredPaths(
    groupedPaths,
    overridePreferences,
    setupRecommendationPreferences
  );
  const technicalRecommendedPath = groupedPaths.find(
    (path) =>
      path.deviceName === scoredPaths[0].deviceName &&
      path.backend === scoredPaths[0].backend &&
      path.profile === scoredPaths[0].profile
  ) ?? groupedPaths[0];
  const overrideLedCandidate = overridePreferences.find(
    (candidate) =>
      candidate.technicalPathAvailable &&
      candidate.overrideCount >= 2 &&
      candidate.fallbackRate !== null &&
      candidate.averageStartAttempts !== null &&
      candidate.fallbackRate <= technicalRecommendedPath.fallbackRate + 0.15 &&
      candidate.averageStartAttempts <= technicalRecommendedPath.averageStartAttempts + 0.5
  );
  const matchingOverrideForTechnicalPath = overridePreferences.find(
    (candidate) =>
      candidate.deviceName === technicalRecommendedPath.deviceName &&
      candidate.backend === technicalRecommendedPath.backend &&
      candidate.profile === technicalRecommendedPath.profile
  );
  const matchingSetupFeedbackForTechnicalPath = setupRecommendationPreferences.find(
    (candidate) =>
      candidate.deviceName === technicalRecommendedPath.deviceName &&
      candidate.backend === technicalRecommendedPath.backend &&
      candidate.profile === technicalRecommendedPath.profile
  );
  const recommendedPath = overrideLedCandidate
    ? groupedPaths.find(
        (path) =>
          path.deviceName === overrideLedCandidate.deviceName &&
          path.backend === overrideLedCandidate.backend &&
          path.profile === overrideLedCandidate.profile
      ) ?? technicalRecommendedPath
    : technicalRecommendedPath;
  const selectionSource = overrideLedCandidate
    ? "user-override-history"
    : matchingSetupFeedbackForTechnicalPath?.improvedCount
      ? "technical-with-setup-feedback"
    : matchingOverrideForTechnicalPath
      ? "technical-with-user-confirmation"
      : "technical";
  const overrideSupportCount = overrideLedCandidate?.overrideCount ?? matchingOverrideForTechnicalPath?.overrideCount ?? 0;
  const setupFeedback = matchingSetupFeedbackForTechnicalPath ?? null;

  return {
    recommendedPath: decorateRecommendedPath(
      recommendedPath,
      selectionSource,
      overrideSupportCount,
      setupFeedback
    ),
    overridePreferences,
    setupRecommendationPreferences,
    scoredPaths
  };
}

function buildDeviceRecommendations(groupedPaths, overrideHistory = [], setupRecommendationHistory = []) {
  const groupedByDevice = new Map();

  for (const path of groupedPaths) {
    const currentGroup = groupedByDevice.get(path.deviceName) ?? [];
    currentGroup.push(path);
    groupedByDevice.set(path.deviceName, currentGroup);
  }

  return [...groupedByDevice.entries()]
    .map(([deviceName, devicePaths]) => {
      const deviceOverrideHistory = overrideHistory.filter((entry) => entry.deviceName === deviceName);
      const deviceSetupRecommendationHistory = setupRecommendationHistory.filter(
        (entry) => entry.deviceName === deviceName
      );
      const recommendation = selectRecommendedPath(
        devicePaths,
        deviceOverrideHistory,
        deviceSetupRecommendationHistory
      );

      return {
        deviceName,
        recommendedPath: recommendation.recommendedPath,
        overridePreferences: recommendation.overridePreferences.slice(0, 3),
        setupRecommendationPreferences: recommendation.setupRecommendationPreferences.slice(0, 3),
        scoredPaths: recommendation.scoredPaths,
        pathCount: devicePaths.length
      };
    })
    .sort((left, right) => left.deviceName.localeCompare(right.deviceName));
}

function buildDiagnosticsInsights(groupedPaths, overrideHistory = [], setupRecommendationHistory = []) {
  if (groupedPaths.length === 0) {
    return {
      recommendedPath: null,
      overridePreferences: [],
      setupRecommendationPreferences: [],
      deviceRecommendations: [],
      scoredPaths: [],
      problematicPaths: []
    };
  }

  const recommendation = selectRecommendedPath(
    groupedPaths,
    overrideHistory,
    setupRecommendationHistory
  );

  const problematicPaths = [...groupedPaths]
    .sort((left, right) => {
      if (right.fallbackRate !== left.fallbackRate) {
        return right.fallbackRate - left.fallbackRate;
      }

      if (right.averageStartAttempts !== left.averageStartAttempts) {
        return right.averageStartAttempts - left.averageStartAttempts;
      }

      if (right.fallbackCount !== left.fallbackCount) {
        return right.fallbackCount - left.fallbackCount;
      }

      return right.latestCompletedAt.localeCompare(left.latestCompletedAt);
    })
    .slice(0, 3)
    .map((path, index) => ({
      rank: index + 1,
      deviceName: path.deviceName,
      backend: path.backend,
      profile: path.profile,
      dominantWarningClass: path.dominantWarningClass ?? null,
      fallbackRate: path.fallbackRate,
      fallbackCount: path.fallbackCount,
      averageStartAttempts: path.averageStartAttempts,
      sessionCount: path.sessionCount,
      latestCompletedAt: path.latestCompletedAt
    }));

  return {
    recommendedPath: recommendation.recommendedPath,
    overridePreferences: recommendation.overridePreferences.slice(0, 3),
    setupRecommendationPreferences: recommendation.setupRecommendationPreferences.slice(0, 3),
    deviceRecommendations: buildDeviceRecommendations(
      groupedPaths,
      overrideHistory,
      setupRecommendationHistory
    ),
    scoredPaths: recommendation.scoredPaths,
    problematicPaths
  };
}

function escapeCsvValue(value) {
  const normalized = String(value ?? "");
  return /[",\n]/.test(normalized)
    ? `"${normalized.replaceAll('"', '""')}"`
    : normalized;
}

function filterCompletedSessions(completedSessions, filters = {}) {
  const normalizedFilters = normalizeDiagnosticsQuery(filters);

  return completedSessions.filter((session) => {
    const capture = session.summary?.capture ?? {};
    const normalizedDeviceName = String(capture.deviceName ?? "").trim().toLowerCase().replace(/\s+/g, " ");

    if (
      normalizedFilters.deviceNameExact &&
      normalizedDeviceName !== normalizedFilters.deviceNameExact.replace(/\s+/g, " ")
    ) {
      return false;
    }

    if (
      normalizedFilters.deviceName &&
      !normalizedDeviceName.includes(normalizedFilters.deviceName)
    ) {
      return false;
    }

    if (
      normalizedFilters.backend &&
      String(capture.backend ?? "").toLowerCase() !== normalizedFilters.backend
    ) {
      return false;
    }

    if (
      normalizedFilters.profile &&
      String(capture.profile ?? "").toLowerCase() !== normalizedFilters.profile
    ) {
      return false;
    }

    return true;
  });
}

function createDeviceDiagnosticsSummary(summaryMetrics, groupedPaths, recentSessions) {
  const sessionCount = summaryMetrics.sessionCount;
  const sessionsWithFallback = summaryMetrics.sessionsWithFallback;
  const averageStartAttempts =
    sessionCount === 0
      ? 0
      : Number((summaryMetrics.totalStartAttempts / sessionCount).toFixed(2));

  return {
    sessionCount,
    pathCount: groupedPaths.length,
    sessionsWithFallback,
    fallbackRate: sessionCount === 0 ? 0 : Number((sessionsWithFallback / sessionCount).toFixed(2)),
    averageStartAttempts,
    latestCompletedAt: recentSessions[0]?.completedAt ?? null
  };
}

function classifyNoticeStage(code) {
  const normalizedCode = String(code);

  if (normalizedCode.includes("PREFLIGHT")) {
    return "preflight";
  }

  if (
    normalizedCode.includes("RUNTIME") ||
    normalizedCode === "NATIVE_CAPTURE_CHUNK_GAP" ||
    normalizedCode === "NATIVE_CAPTURE_LOW_SIGNAL"
  ) {
    return "runtime";
  }

  return "session";
}

function classifyNoticeIssueClass(notice = {}) {
  const code = String(notice.code ?? "");
  const message = String(notice.message ?? "").toLowerCase();
  const capture = notice.capture ?? {};

  if (
    message.includes("selected native input device could not be resolved") ||
    message.includes("device could not be resolved")
  ) {
    return "device-resolution";
  }

  if (code === "NATIVE_CAPTURE_LOW_SIGNAL") {
    return "signal-quality";
  }

  if (code === "NATIVE_CAPTURE_CHUNK_GAP") {
    return "stream-stability";
  }

  if (code === "NATIVE_CAPTURE_RUNTIME_RETRY") {
    return "startup-retry";
  }

  if (code === "NATIVE_CAPTURE_PREFLIGHT_FALLBACK") {
    if (
      capture.requestedBackend &&
      capture.backend &&
      capture.requestedBackend !== capture.backend
    ) {
      return "backend-routing";
    }

    if (
      capture.requestedProfile &&
      capture.profile &&
      capture.requestedProfile !== capture.profile
    ) {
      return "profile-routing";
    }

    return "preflight-validation";
  }

  if (code.includes("PREFLIGHT")) {
    return "preflight-validation";
  }

  if (code.includes("RUNTIME")) {
    return "runtime-stability";
  }

  return "general";
}

function buildRuntimeIssues(issueCounts = [], sessionCount = 0) {
  const warningIssues = issueCounts.filter((issue) => issue.level === "warning");
  const totalWarningNotices = warningIssues.reduce((sum, issue) => sum + issue.eventCount, 0);
  const affectedSessions = warningIssues.reduce(
    (highest, issue) => Math.max(highest, issue.affectedSessions),
    0
  );
  const stageGroups = new Map();
  const classGroups = new Map();

  for (const issue of warningIssues) {
    const stage = classifyNoticeStage(issue.code);
    const currentStage = stageGroups.get(stage) ?? {
      stage,
      eventCount: 0,
      affectedSessions: 0
    };

    currentStage.eventCount += issue.eventCount;
    currentStage.affectedSessions = Math.max(currentStage.affectedSessions, issue.affectedSessions);
    stageGroups.set(stage, currentStage);

    const issueClass = issue.issueClass ?? classifyNoticeIssueClass(issue);
    const currentClass = classGroups.get(issueClass) ?? {
      issueClass,
      eventCount: 0,
      affectedSessions: 0
    };

    currentClass.eventCount += issue.eventCount;
    currentClass.affectedSessions = Math.max(currentClass.affectedSessions, issue.affectedSessions);
    classGroups.set(issueClass, currentClass);
  }

  const stageBreakdown = [...stageGroups.values()]
    .map((stageGroup) => ({
      ...stageGroup,
      eventRate: totalWarningNotices === 0
        ? 0
        : Number((stageGroup.eventCount / totalWarningNotices).toFixed(2)),
      affectedSessionRate: sessionCount === 0
        ? 0
        : Number((stageGroup.affectedSessions / sessionCount).toFixed(2))
    }))
    .sort((left, right) => right.eventCount - left.eventCount);
  const classBreakdown = [...classGroups.values()]
    .map((issueClassGroup) => ({
      ...issueClassGroup,
      eventRate: totalWarningNotices === 0
        ? 0
        : Number((issueClassGroup.eventCount / totalWarningNotices).toFixed(2)),
      affectedSessionRate: sessionCount === 0
        ? 0
        : Number((issueClassGroup.affectedSessions / sessionCount).toFixed(2))
    }))
    .sort((left, right) => right.eventCount - left.eventCount);
  const topIssues = warningIssues
    .map((issue) => ({
      ...issue,
      stage: classifyNoticeStage(issue.code),
      issueClass: issue.issueClass ?? classifyNoticeIssueClass(issue),
      eventRate: totalWarningNotices === 0
        ? 0
        : Number((issue.eventCount / totalWarningNotices).toFixed(2)),
      affectedSessionRate: sessionCount === 0
        ? 0
        : Number((issue.affectedSessions / sessionCount).toFixed(2))
    }))
    .sort((left, right) => {
      if (right.eventCount !== left.eventCount) {
        return right.eventCount - left.eventCount;
      }

      if (right.affectedSessions !== left.affectedSessions) {
        return right.affectedSessions - left.affectedSessions;
      }

      return String(right.latestTimestamp).localeCompare(String(left.latestTimestamp));
    });

  return {
    totalWarningNotices,
    affectedSessions,
    affectedSessionRate: sessionCount === 0 ? 0 : Number((affectedSessions / sessionCount).toFixed(2)),
    stageBreakdown,
    classBreakdown,
    topIssue: topIssues[0] ?? null,
    topIssues: topIssues.slice(0, 5)
  };
}

function buildIssueCountsFromSessions(completedSessions = []) {
  const groupedIssues = new Map();

  for (const session of completedSessions) {
    for (const notice of session.summary?.diagnostics?.notices ?? []) {
      const key = `${notice.code}:${notice.level}`;
      const currentIssue = groupedIssues.get(key) ?? {
        code: notice.code,
        level: notice.level,
        issueClass: classifyNoticeIssueClass(notice),
        eventCount: 0,
        affectedSessionIds: new Set(),
        latestTimestamp: notice.timestamp
      };

      currentIssue.eventCount += 1;
      currentIssue.affectedSessionIds.add(session.id);

      if (notice.timestamp > currentIssue.latestTimestamp) {
        currentIssue.latestTimestamp = notice.timestamp;
      }

      groupedIssues.set(key, currentIssue);
    }
  }

  return [...groupedIssues.values()]
    .map((issue) => ({
      code: issue.code,
      level: issue.level,
      issueClass: issue.issueClass,
      eventCount: issue.eventCount,
      affectedSessions: issue.affectedSessionIds.size,
      latestTimestamp: issue.latestTimestamp
    }))
    .sort((left, right) => {
      if (right.eventCount !== left.eventCount) {
        return right.eventCount - left.eventCount;
      }

      if (right.affectedSessions !== left.affectedSessions) {
        return right.affectedSessions - left.affectedSessions;
      }

      return String(right.latestTimestamp).localeCompare(String(left.latestTimestamp));
    });
}

export class UserService {
  #userRepository;
  #sessionRepository;
  #trainingRepository;

  constructor({ userRepository, sessionRepository, trainingRepository }) {
    this.#userRepository = userRepository;
    this.#sessionRepository = sessionRepository;
    this.#trainingRepository = trainingRepository;
  }

  #listCompletedDiagnosticsSessions(userId) {
    const diagnosticsSessions =
      typeof this.#sessionRepository.listCompletedDiagnosticsByUser === "function"
        ? this.#sessionRepository.listCompletedDiagnosticsByUser(userId)
        : this.#sessionRepository.listCompletedByUser(userId);

    return diagnosticsSessions.sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  }

  #getDiagnosticsReportData(userId, diagnosticsQuery) {
    if (typeof this.#sessionRepository.getDiagnosticsReportData === "function") {
      return this.#sessionRepository.getDiagnosticsReportData(userId, diagnosticsQuery, {
        recentLimit: 10
      });
    }

    const completedSessions = filterCompletedSessions(
      this.#listCompletedDiagnosticsSessions(userId),
      diagnosticsQuery
    );
    const groupedPaths = sortGroupedPaths(
      groupDiagnosticsByPath(completedSessions),
      diagnosticsQuery
    );
    const recentSessions = completedSessions.slice(0, 10).map((session) => ({
      sessionId: session.id,
      trainingId: session.trainingId,
      completedAt: session.completedAt,
      capture: session.summary?.capture ?? null,
      diagnostics: {
        noticeCount: session.summary?.diagnostics?.notices?.length ?? 0,
        noticeCodes: session.summary?.diagnostics?.notices?.map((notice) => notice.code) ?? []
      }
    }));

    return {
      summary: {
        sessionCount: completedSessions.length,
        sessionsWithFallback: completedSessions.filter((session) => session.summary?.capture?.fallbackApplied).length,
        totalStartAttempts: completedSessions.reduce(
          (sum, session) => sum + (session.summary?.capture?.startAttemptCount ?? 1),
          0
        )
      },
      groupedPaths,
      issueCounts: buildIssueCountsFromSessions(completedSessions),
      recentSessions
    };
  }

  saveCalibration(userId, calibrationInput) {
    const user = this.#userRepository.saveCalibration(userId, {
      offsetMs: calibrationInput.offsetMs,
      measuredLatencyMs: calibrationInput.measuredLatencyMs,
      noiseFloorDb: calibrationInput.noiseFloorDb,
      recordedAt: new Date().toISOString()
    });

    return {
      ok: true,
      user
    };
  }

  recordSetupRecommendation(userId, setupRecommendationInput) {
    const recommendationEntry = {
      id: `setup-rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deviceName: setupRecommendationInput.deviceName,
      backend: setupRecommendationInput.backend,
      profile: setupRecommendationInput.profile,
      recommendationId: setupRecommendationInput.recommendationId,
      recommendationTitle: setupRecommendationInput.recommendationTitle,
      recommendationDetail: setupRecommendationInput.recommendationDetail ?? null,
      source: setupRecommendationInput.source ?? "device-detail",
      baselineStabilityScore: setupRecommendationInput.baselineStabilityScore,
      baselineSignalQualityScore: setupRecommendationInput.baselineSignalQualityScore,
      baselineRuntimeStabilityScore: setupRecommendationInput.baselineRuntimeStabilityScore,
      baselineLatencyFitnessScore: setupRecommendationInput.baselineLatencyFitnessScore,
      plannedSessionId: setupRecommendationInput.plannedSessionId ?? null,
      status: "applied",
      timestamp: new Date().toISOString(),
      appliedAt: new Date().toISOString()
    };
    const user = this.#userRepository.appendSetupRecommendation(userId, recommendationEntry);

    return {
      ok: true,
      user,
      setupRecommendation: recommendationEntry
    };
  }

  evaluateSetupRecommendation(userId, recommendationId, evaluationInput) {
    this.#userRepository.ensure(userId);
    const updatedUser = this.#userRepository.updateSetupRecommendation(userId, recommendationId, {
      status: evaluationInput.outcome,
      evaluationNotes: evaluationInput.notes ?? null,
      observedSessionId: evaluationInput.observedSessionId ?? null,
      evaluatedAt: new Date().toISOString()
    });

    if (!updatedUser) {
      return {
        ok: false,
        statusCode: 404,
        code: "SETUP_RECOMMENDATION_NOT_FOUND",
        message: "Setup recommendation history entry was not found."
      };
    }

    return {
      ok: true,
      user: updatedUser,
      setupRecommendation: updatedUser.setupRecommendationHistory.find((entry) => entry.id === recommendationId)
    };
  }

  saveCapturePreferences(userId, capturePreferencesInput) {
    const user = this.#userRepository.saveCapturePreferences(userId, {
      autoApplyRecommendation: capturePreferencesInput.autoApplyRecommendation,
      updatedAt: new Date().toISOString()
    });

    return {
      ok: true,
      user
    };
  }

  recordCaptureOverride(userId, overrideInput) {
    const user = this.#userRepository.appendCaptureOverride(userId, {
      deviceName: overrideInput.deviceName,
      recommendedBackend: overrideInput.recommendedBackend,
      recommendedProfile: overrideInput.recommendedProfile,
      selectedBackend: overrideInput.selectedBackend,
      selectedProfile: overrideInput.selectedProfile,
      timestamp: new Date().toISOString(),
      source: overrideInput.source ?? "manual-session-start"
    });

    return {
      ok: true,
      user
    };
  }

  getDashboard(userId) {
    const user = this.#userRepository.ensure(userId);
    const completedSessions = this.#sessionRepository.listCompletedByUser(userId);
    const trainings = this.#trainingRepository.list();
    const totalScore = completedSessions.reduce(
      (sum, session) => sum + (session.summary?.totalScore ?? 0),
      0
    );
    const averageAccuracy =
      completedSessions.length === 0
        ? 0
        : Number(
            (
              completedSessions.reduce(
                (sum, session) => sum + (session.summary?.accuracy ?? 0),
                0
              ) / completedSessions.length
            ).toFixed(2)
          );

    const recentResults = completedSessions
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .slice(0, 5)
      .map((session) => {
        const training = this.#trainingRepository.findById(session.trainingId);

        return {
          sessionId: session.id,
          trainingId: session.trainingId,
          trainingTitle: training?.title ?? session.trainingId,
          completedAt: session.completedAt,
          totalScore: session.summary.totalScore,
          accuracy: session.summary.accuracy,
          scoreBreakdown: session.summary.scoreBreakdown ?? null,
          sectionBreakdown: session.summary.sectionBreakdown ?? null,
          practicePreset: session.summary.practicePreset ?? null,
          rating: session.summary.rating ?? null,
          feedback: session.summary.feedback ?? null,
          verification: resolveSessionVerification(session.summary ?? {}),
          capture: session.summary.capture ?? null,
          diagnostics: session.summary.diagnostics ?? null,
          artifact: session.summary.artifact ?? null
        };
      });
    const targetedPractice = buildTargetedPracticeRecommendation({
      completedSessions,
      trainings
    });
    const checkpointHistorySnapshots = buildCheckpointHistorySnapshots({
      completedSessions,
      trainings
    });
    const contentUnlockGraph = buildContentUnlockGraph({
      completedSessions,
      trainings,
      targetedPractice
    });

    return {
      ok: true,
      dashboard: {
        userId: user.id,
        calibrationProfile: user.calibrationProfile,
        capturePreferences: user.capturePreferences,
        captureOverrideHistory: user.captureOverrideHistory ?? [],
        setupRecommendationHistory: user.setupRecommendationHistory ?? [],
        verificationHoldSetupFollowupSummary: buildSetupRecommendationExecutionSummary(
          user.setupRecommendationHistory ?? [],
          {
            source: "verification-hold-session-start",
            sampleSize: 6
          }
        ),
        stats: {
          completedSessions: completedSessions.length,
          totalScore,
          averageAccuracy,
          streakDays: computeStreakDays(completedSessions)
        },
        progressionSafety: buildProgressionSafety({
          latestSession: completedSessions
            .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0] ?? null,
          trainings,
          targetedPractice
        }),
        verificationTrend: buildVerificationTrend(completedSessions),
        verificationHoldSummary: buildVerificationHoldDrilldown(completedSessions, trainings, {
          sampleSize: 5
        }),
        targetedPractice,
        checkpointHistorySnapshots,
        contentUnlockGraph,
        recentResults
      }
    };
  }

  getTrainingCatalog(userId) {
    const user = this.#userRepository.ensure(userId);
    const completedSessions = this.#sessionRepository.listCompletedByUser(userId);
    const trainings = this.#trainingRepository.list();
    const targetedPractice = buildTargetedPracticeRecommendation({
      completedSessions,
      trainings
    });
    const contentUnlockGraph = buildContentUnlockGraph({
      completedSessions,
      trainings,
      targetedPractice
    });
    const unlockMap = new Map(contentUnlockGraph.nodes.map((node) => [node.trainingId, node]));

    return {
      ok: true,
      catalog: {
        userId: user.id,
        generatedAt: new Date().toISOString(),
        summary: {
          unlockedTrainingCount: contentUnlockGraph.unlockedTrainingCount,
          completedTrainingCount: contentUnlockGraph.completedTrainingCount,
          lockedTrainingCount: contentUnlockGraph.lockedTrainingCount
        },
        trainings: trainings.map((training) => ({
          ...training,
          access: unlockMap.get(training.id) ?? null
        }))
      }
    };
  }

  getDiagnosticsReport(userId, filters = {}) {
    const user = this.#userRepository.ensure(userId);
    const trainings = this.#trainingRepository.list();
    const diagnosticsQuery = normalizeDiagnosticsQuery(filters);
    const diagnosticsData = this.#getDiagnosticsReportData(userId, diagnosticsQuery);
    const filteredDiagnosticsSessions = filterCompletedSessions(
      this.#sessionRepository.listCompletedByUser(userId),
      diagnosticsQuery
    );
    const groupedPaths = sortGroupedPaths(diagnosticsData.groupedPaths, diagnosticsQuery);
    const insights = buildDiagnosticsInsights(
      groupedPaths,
      user.captureOverrideHistory ?? [],
      user.setupRecommendationHistory ?? []
    );
    const recentSessions = diagnosticsData.recentSessions.map((session) => {
      const training = this.#trainingRepository.findById(session.trainingId);

      return {
        ...session,
        trainingTitle: training?.title ?? session.trainingId
      };
    });

    return {
      ok: true,
      report: {
        userId,
        generatedAt: new Date().toISOString(),
        filters: {
          ...(diagnosticsQuery.deviceName ? { deviceName: diagnosticsQuery.deviceName } : {}),
          ...(diagnosticsQuery.backend ? { backend: diagnosticsQuery.backend } : {}),
          ...(diagnosticsQuery.profile ? { profile: diagnosticsQuery.profile } : {})
        },
        sorting: {
          sortBy: diagnosticsQuery.sortBy,
          sortDirection: diagnosticsQuery.sortDirection
        },
        summary: buildDiagnosticsSummaryFromMetrics(diagnosticsData.summary, groupedPaths),
        verificationTrend: buildVerificationTrend(filteredDiagnosticsSessions, { sampleSize: 10 }),
        verificationIssueDrilldown: buildVerificationIssueDrilldown(filteredDiagnosticsSessions, {
          sampleSize: 10,
          resolveTrainingTitle: (trainingId) => this.#trainingRepository.findById(trainingId)?.title ?? trainingId
        }),
        verificationHoldDrilldown: buildVerificationHoldDrilldown(filteredDiagnosticsSessions, trainings, {
          sampleSize: 10
        }),
        verificationHoldSetupFollowupSummary: buildSetupRecommendationExecutionSummary(
          user.setupRecommendationHistory ?? [],
          {
            source: "verification-hold-session-start",
            sampleSize: 10
          }
        ),
        runtimeIssues: buildRuntimeIssues(
          diagnosticsData.issueCounts,
          diagnosticsData.summary.sessionCount
        ),
        insights,
        recentSessions,
        groupedPaths
      }
    };
  }

  getDeviceDiagnostics(userId, deviceName) {
    const user = this.#userRepository.ensure(userId);
    const trainings = this.#trainingRepository.list();
    const normalizedDeviceName = String(deviceName ?? "").trim();
    const diagnosticsQuery = normalizeDiagnosticsQuery({
      deviceNameExact: normalizedDeviceName,
      sortBy: "latest",
      sortDirection: "desc"
    });
    const diagnosticsData = this.#getDiagnosticsReportData(userId, diagnosticsQuery);
    const filteredDiagnosticsSessions = filterCompletedSessions(
      this.#sessionRepository.listCompletedByUser(userId),
      diagnosticsQuery
    );
    const groupedPaths = sortGroupedPaths(diagnosticsData.groupedPaths, diagnosticsQuery);
    const deviceOverrideHistory = (user.captureOverrideHistory ?? [])
      .filter(
        (entry) =>
          normalizeDiagnosticsQuery({ deviceNameExact: entry.deviceName }).deviceNameExact ===
          diagnosticsQuery.deviceNameExact
      )
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const deviceSetupRecommendationHistory = (user.setupRecommendationHistory ?? [])
      .filter(
        (entry) =>
          normalizeDiagnosticsQuery({ deviceNameExact: entry.deviceName }).deviceNameExact ===
          diagnosticsQuery.deviceNameExact
      )
      .sort((left, right) => {
        const leftTimestamp = left.evaluatedAt ?? left.timestamp;
        const rightTimestamp = right.evaluatedAt ?? right.timestamp;
        return rightTimestamp.localeCompare(leftTimestamp);
      });
    const recommendation = selectRecommendedPath(
      groupedPaths,
      deviceOverrideHistory,
      deviceSetupRecommendationHistory
    );
    const recentSessions = diagnosticsData.recentSessions.map((session) => {
      const training = this.#trainingRepository.findById(session.trainingId);

      return {
        ...session,
        trainingTitle: training?.title ?? session.trainingId
      };
    });

    return {
      ok: true,
      report: {
        userId,
        deviceName: groupedPaths[0]?.deviceName ?? normalizedDeviceName,
        generatedAt: new Date().toISOString(),
        summary: createDeviceDiagnosticsSummary(diagnosticsData.summary, groupedPaths, recentSessions),
        verificationTrend: buildVerificationTrend(filteredDiagnosticsSessions, { sampleSize: 10 }),
        verificationIssueDrilldown: buildVerificationIssueDrilldown(filteredDiagnosticsSessions, {
          sampleSize: 10,
          resolveTrainingTitle: (trainingId) => this.#trainingRepository.findById(trainingId)?.title ?? trainingId
        }),
        verificationHoldDrilldown: buildVerificationHoldDrilldown(filteredDiagnosticsSessions, trainings, {
          sampleSize: 10
        }),
        runtimeIssues: buildRuntimeIssues(
          diagnosticsData.issueCounts,
          diagnosticsData.summary.sessionCount
        ),
        recommendedPath: recommendation.recommendedPath,
        overridePreferences: recommendation.overridePreferences.slice(0, 5),
        setupRecommendationPreferences: recommendation.setupRecommendationPreferences.slice(0, 5),
        overrideHistory: deviceOverrideHistory.slice(0, 10),
        setupRecommendationHistory: deviceSetupRecommendationHistory.slice(0, 10),
        scoredPaths: recommendation.scoredPaths,
        groupedPaths,
        recentSessions
      }
    };
  }

  exportDiagnosticsReport(userId, format = "json", filters = {}) {
    const report = this.getDiagnosticsReport(userId, filters).report;

    if (format === "csv") {
      const lines = [
        [
          "scope",
          "rank",
          "sessionId",
          "trainingTitle",
          "completedAt",
          "deviceName",
          "backend",
          "profile",
          "label",
          "reason",
          "fallbackApplied",
          "startAttemptCount",
          "noticeCount",
          "noticeCodes",
          "sessionCount",
          "fallbackCount",
          "fallbackRate",
          "averageStartAttempts",
          "stabilityScore",
          "startReliabilityScore",
          "runtimeStabilityScore",
          "recommendationConfidenceScore",
          "latencyFitnessScore",
          "signalQualityScore",
          "latestCompletedAt"
        ].join(",")
      ];

      for (const session of report.recentSessions) {
        lines.push(
          [
            "recent-session",
            "",
            session.sessionId,
            session.trainingTitle,
            session.completedAt,
            session.capture?.deviceName ?? "",
            session.capture?.backend ?? "",
            session.capture?.profile ?? "",
            "",
            "",
            session.capture?.fallbackApplied ?? "",
            session.capture?.startAttemptCount ?? "",
            session.diagnostics?.noticeCount ?? 0,
            (session.diagnostics?.noticeCodes ?? []).join("|"),
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
          ]
            .map(escapeCsvValue)
            .join(",")
        );
      }

      if (report.insights.recommendedPath) {
        lines.push(
          [
            "recommended-path",
            "",
            "",
            "",
            report.insights.recommendedPath.deviceName,
            report.insights.recommendedPath.backend,
            report.insights.recommendedPath.profile,
            report.insights.recommendedPath.label,
            report.insights.recommendedPath.reason,
            "",
            "",
            "",
            "",
            report.insights.recommendedPath.sessionCount,
            "",
            report.insights.recommendedPath.fallbackRate,
            report.insights.recommendedPath.averageStartAttempts,
            report.insights.recommendedPath.stabilityScore,
            report.insights.recommendedPath.startReliabilityScore,
            report.insights.recommendedPath.runtimeStabilityScore,
            report.insights.recommendedPath.recommendationConfidenceScore,
            report.insights.recommendedPath.latencyFitnessScore,
            report.insights.recommendedPath.signalQualityScore,
            report.insights.recommendedPath.latestCompletedAt
          ]
            .map(escapeCsvValue)
            .join(",")
        );
      }

      for (const path of report.insights.problematicPaths) {
        lines.push(
          [
            "problematic-path",
            path.rank,
            "",
            "",
            path.deviceName,
            path.backend,
            path.profile,
            createPathIdentity(path),
            "",
            "",
            "",
            "",
            "",
            path.sessionCount,
            path.fallbackCount,
            path.fallbackRate,
            path.averageStartAttempts,
            "",
            "",
            "",
            "",
            "",
            "",
            path.latestCompletedAt
          ]
            .map(escapeCsvValue)
            .join(",")
        );
      }

      for (const group of report.groupedPaths) {
        lines.push(
          [
            "grouped-path",
            "",
            "",
            "",
            "",
            group.deviceName,
            group.backend,
            group.profile,
            "",
            "",
            "",
            "",
            "",
            "",
            group.sessionCount,
            group.fallbackCount,
            group.fallbackRate,
            group.averageStartAttempts,
            "",
            "",
            "",
            "",
            "",
            "",
            group.latestCompletedAt
          ]
            .map(escapeCsvValue)
            .join(",")
        );
      }

      return {
        ok: true,
        filename: `riffrush-diagnostics-${userId}.csv`,
        contentType: "text/csv; charset=utf-8",
        body: lines.join("\n")
      };
    }

    return {
      ok: true,
      filename: `riffrush-diagnostics-${userId}.json`,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(report, null, 2)
    };
  }
}
