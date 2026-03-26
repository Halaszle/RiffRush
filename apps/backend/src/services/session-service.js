import { randomUUID } from "node:crypto";
import { buildContentUnlockGraph, findContentUnlockNode, findUnlockTransitions } from "./content-unlock-graph.js";

function countNativeCaptureWarningNotices(notices = []) {
  return notices.filter(
    (notice) =>
      typeof notice?.code === "string" &&
      notice.code.startsWith("NATIVE_CAPTURE_") &&
      (notice.level ?? "warning") === "warning"
  ).length;
}

function matchesRecommendedCapturePath(capture, recommendationEntry) {
  if (!capture) {
    return false;
  }

  const backendMatches = capture.backend === recommendationEntry.backend;
  const profileMatches = capture.profile === recommendationEntry.profile;
  const deviceMatches =
    !recommendationEntry.deviceName ||
    !capture.deviceName ||
    capture.deviceName === recommendationEntry.deviceName;

  return backendMatches && profileMatches && deviceMatches;
}

function buildSetupRecommendationFollowupEvaluation(session, recommendationEntry) {
  const capture = session.summary?.capture ?? null;

  if (!capture || capture.source !== "native-capture") {
    return {
      outcome: "no-improvement",
      note: "Auto-evaluated follow-up session did not include a native-capture summary."
    };
  }

  if (!matchesRecommendedCapturePath(capture, recommendationEntry)) {
    return {
      outcome: "no-improvement",
      note: `Auto-evaluated follow-up used ${capture.backend?.toUpperCase() ?? "unknown backend"} ${capture.profile ?? "unknown profile"} instead of the recommended capture path.`
    };
  }

  if (capture.fallbackApplied) {
    return {
      outcome: "no-improvement",
      note: "Auto-evaluated follow-up still required a native-capture fallback."
    };
  }

  if ((capture.startAttemptCount ?? 1) > 1) {
    return {
      outcome: "no-improvement",
      note: "Auto-evaluated follow-up still needed multiple native-capture start attempts."
    };
  }

  const nativeWarningNoticeCount = countNativeCaptureWarningNotices(session.summary?.diagnostics?.notices ?? []);

  if (nativeWarningNoticeCount > 0) {
    return {
      outcome: "no-improvement",
      note: "Auto-evaluated follow-up still emitted native-capture warning notices."
    };
  }

  return {
    outcome: "improved",
    note: "Auto-evaluated follow-up stayed on the recommended native-capture path without fallback or native warnings."
  };
}

export class SessionService {
  #sessionRepository;
  #trainingRepository;
  #userRepository;

  constructor({ sessionRepository, trainingRepository, userRepository = null }) {
    this.#sessionRepository = sessionRepository;
    this.#trainingRepository = trainingRepository;
    this.#userRepository = userRepository;
  }

  #evaluatePlannedSetupRecommendation(userId, session) {
    if (!this.#userRepository) {
      return null;
    }

    const user = this.#userRepository.findById(userId);
    const pendingRecommendation = (user?.setupRecommendationHistory ?? []).find(
      (entry) => entry.status === "applied" && entry.plannedSessionId === session.id
    );

    if (!pendingRecommendation) {
      return null;
    }

    const evaluation = buildSetupRecommendationFollowupEvaluation(session, pendingRecommendation);
    const updatedUser = this.#userRepository.updateSetupRecommendation(userId, pendingRecommendation.id, {
      status: evaluation.outcome,
      evaluationNotes: evaluation.note,
      observedSessionId: session.id,
      observedCaptureBackend: session.summary?.capture?.backend ?? null,
      observedCaptureProfile: session.summary?.capture?.profile ?? null,
      observedDeviceName: session.summary?.capture?.deviceName ?? null,
      observedVerificationStatus: session.summary?.verification?.status ?? null,
      evaluationMode: "auto-followup",
      evaluatedAt: new Date().toISOString()
    });

    if (!updatedUser) {
      return null;
    }

    return {
      user: updatedUser,
      setupRecommendation: updatedUser.setupRecommendationHistory.find(
        (entry) => entry.id === pendingRecommendation.id
      )
    };
  }

  createSession(input) {
    const normalizedUserId = input.userId ?? "anonymous";
    const training = this.#trainingRepository.findById(input.trainingId);

    if (!training) {
      return {
        ok: false,
        statusCode: 404,
        code: "TRAINING_NOT_FOUND",
        message: `Training ${input.trainingId} does not exist.`
      };
    }

    if (
      input.practiceScope !== undefined &&
      input.practiceScope !== "full-chart" &&
      input.practiceScope !== "section-loop"
    ) {
      return {
        ok: false,
        statusCode: 400,
        code: "INVALID_PRACTICE_SCOPE",
        message: "Practice scope must be full-chart or section-loop when provided."
      };
    }

    const recoveryGoalTraining =
      typeof input.recoveryGoalTrainingId === "string" && input.recoveryGoalTrainingId.length > 0
        ? this.#trainingRepository.findById(input.recoveryGoalTrainingId)
        : null;
    const returnRecoveryTraining =
      typeof input.returnRecoveryTrainingId === "string" && input.returnRecoveryTrainingId.length > 0
        ? this.#trainingRepository.findById(input.returnRecoveryTrainingId)
        : null;
    const promotionSourceTraining =
      typeof input.promotionSourceTrainingId === "string" && input.promotionSourceTrainingId.length > 0
        ? this.#trainingRepository.findById(input.promotionSourceTrainingId)
        : null;

    if (input.recoveryGoalTrainingId && !recoveryGoalTraining) {
      return {
        ok: false,
        statusCode: 404,
        code: "RECOVERY_GOAL_TRAINING_NOT_FOUND",
        message: `Recovery goal training ${input.recoveryGoalTrainingId} does not exist.`
      };
    }

    if (input.returnRecoveryTrainingId && !returnRecoveryTraining) {
      return {
        ok: false,
        statusCode: 404,
        code: "RETURN_RECOVERY_TRAINING_NOT_FOUND",
        message: `Return recovery training ${input.returnRecoveryTrainingId} does not exist.`
      };
    }

    if (input.promotionSourceTrainingId && !promotionSourceTraining) {
      return {
        ok: false,
        statusCode: 404,
        code: "PROMOTION_SOURCE_TRAINING_NOT_FOUND",
        message: `Promotion source training ${input.promotionSourceTrainingId} does not exist.`
      };
    }

    const completedSessions = this.#sessionRepository.listCompletedByUser(normalizedUserId);
    const trainings = this.#trainingRepository.list();
    const contentUnlockNode = findContentUnlockNode({
      completedSessions,
      trainings,
      trainingId: training.id
    });

    if (!contentUnlockNode?.isUnlocked) {
      return {
        ok: false,
        statusCode: 403,
        code: "TRAINING_LOCKED",
        message: `Training ${training.title} is still locked for user ${normalizedUserId}.`,
        details: {
          trainingId: training.id,
          trainingTitle: training.title,
          unlockState: contentUnlockNode?.unlockState ?? "locked",
          lockedReason: contentUnlockNode?.lockedReason ?? null,
          unlockRequirementSummary: contentUnlockNode?.unlockRequirementSummary ?? null,
          unlockRequirements: contentUnlockNode?.unlockRequirements ?? [],
          unlockProgress: contentUnlockNode?.unlockProgress ?? null,
          prerequisiteTrainingIds: contentUnlockNode?.prerequisiteTrainingIds ?? [],
          prerequisiteTrainingTitles: contentUnlockNode?.prerequisiteTrainingTitles ?? []
        }
      };
    }

    const recoveryGoalSection =
      recoveryGoalTraining && typeof input.recoveryGoalSectionId === "string" && input.recoveryGoalSectionId.length > 0
        ? recoveryGoalTraining.chart?.sections?.find((section) => section.id === input.recoveryGoalSectionId) ?? null
        : null;

    if (input.recoveryGoalSectionId && !recoveryGoalSection) {
      return {
        ok: false,
        statusCode: 400,
        code: "INVALID_RECOVERY_GOAL_SECTION",
        message: "Recovery goal section must reference a valid section on the recovery goal training."
      };
    }

    const practiceScope = input.practiceScope ?? "full-chart";
    const requestedTempoBpm = input.tempoBpm ?? training.tempoBpm;
    const loopRepetitionCount =
      practiceScope === "section-loop"
        ? Math.max(1, Math.min(6, Math.round(input.loopRepetitionCount ?? 1)))
        : 1;
    const loopTempoStepBpm =
      practiceScope === "section-loop"
        ? Math.max(0, Math.min(16, Math.round(input.loopTempoStepBpm ?? 0)))
        : 0;

    if (!Number.isFinite(requestedTempoBpm) || requestedTempoBpm < 40 || requestedTempoBpm > 240) {
      return {
        ok: false,
        statusCode: 400,
        code: "INVALID_SESSION_TEMPO",
        message: "Session tempo must be between 40 and 240 BPM."
      };
    }

    if (practiceScope === "section-loop") {
      const hasLoopSection = typeof input.loopSectionId === "string" && input.loopSectionId.length > 0;
      const selectedSection = training.chart?.sections?.find((section) => section.id === input.loopSectionId);

      if (!hasLoopSection || !selectedSection) {
        return {
          ok: false,
          statusCode: 400,
          code: "INVALID_LOOP_SECTION",
          message: "A valid chart section is required for section-loop practice scope."
        };
        }
    }

    const returnGoalSectionId =
      typeof input.returnGoalSectionId === "string" && input.returnGoalSectionId.length > 0
        ? input.returnGoalSectionId
        : practiceScope === "section-loop"
          ? input.loopSectionId
          : null;
    const returnGoalSection =
      returnGoalSectionId
        ? training.chart?.sections?.find((section) => section.id === returnGoalSectionId) ?? null
        : null;

    if (returnGoalSectionId && !returnGoalSection) {
      return {
        ok: false,
        statusCode: 400,
        code: "INVALID_RETURN_GOAL_SECTION",
        message: "Return goal section must reference a valid section on the selected training."
      };
    }

    const recoveryContext = recoveryGoalTraining
      ? {
          goalTrainingId: recoveryGoalTraining.id,
          goalTrainingTitle: recoveryGoalTraining.title,
          goalTrainingDifficulty: recoveryGoalTraining.difficulty,
          ...(recoveryGoalSection
            ? {
                goalSectionId: recoveryGoalSection.id,
                goalSectionLabel: recoveryGoalSection.label
              }
            : {}),
          ...(input.recoveryReturnTempoBpm !== undefined
            ? {
                returnTempoBpm: Math.max(40, Math.min(240, Math.round(input.recoveryReturnTempoBpm)))
              }
            : {}),
          ...(input.recoveryReturnLoopRepetitionCount !== undefined
            ? {
                returnLoopRepetitionCount: Math.max(
                  1,
                  Math.min(6, Math.round(input.recoveryReturnLoopRepetitionCount))
                )
              }
            : {}),
          ...(input.recoveryReturnLoopTempoStepBpm !== undefined
            ? {
                returnLoopTempoStepBpm: Math.max(
                  0,
                  Math.min(16, Math.round(input.recoveryReturnLoopTempoStepBpm))
                )
              }
            : {}),
          ...(typeof input.recoveryReason === "string" && input.recoveryReason.length > 0
            ? { reason: input.recoveryReason }
            : {}),
          ...(typeof input.recoveryStrategy === "string" && input.recoveryStrategy.length > 0
            ? { strategy: input.recoveryStrategy }
            : {})
        }
      : null;
    const returnContext = returnRecoveryTraining
      ? {
          recoveryTrainingId: returnRecoveryTraining.id,
          recoveryTrainingTitle: returnRecoveryTraining.title,
          recoveryTrainingDifficulty: returnRecoveryTraining.difficulty,
          goalTrainingId: training.id,
          goalTrainingTitle: training.title,
          ...(returnGoalSection
            ? {
                goalSectionId: returnGoalSection.id,
                goalSectionLabel: returnGoalSection.label
              }
            : {}),
          ...(typeof input.returnReason === "string" && input.returnReason.length > 0
            ? { reason: input.returnReason }
            : {})
        }
      : null;
    const promotionContext = promotionSourceTraining
      ? {
          sourceTrainingId: promotionSourceTraining.id,
          sourceTrainingTitle: promotionSourceTraining.title,
          sourceTrainingDifficulty: promotionSourceTraining.difficulty,
          promotedTrainingId: training.id,
          promotedTrainingTitle: training.title,
          promotedTrainingDifficulty: training.difficulty,
          phase:
            input.promotionPhase === "ramp"
              ? "ramp"
              : input.promotionPhase === "reentry"
                ? "reentry"
                : input.promotionPhase === "chain"
                  ? "chain"
                  : input.promotionPhase === "chain-validation"
                    ? "chain-validation"
                    : input.promotionPhase === "chain-graduation"
                      ? "chain-graduation"
                      : "landing",
          ...(input.promotionSourceTempoBpm !== undefined
            ? {
                sourceTempoBpm: Math.max(40, Math.min(240, Math.round(input.promotionSourceTempoBpm)))
              }
            : {}),
          ...(input.promotionRampBaseTempoBpm !== undefined
            ? {
                rampBaseTempoBpm: Math.max(40, Math.min(240, Math.round(input.promotionRampBaseTempoBpm)))
              }
            : {}),
          ...(input.promotionRampTargetTempoBpm !== undefined
            ? {
                rampTargetTempoBpm: Math.max(40, Math.min(240, Math.round(input.promotionRampTargetTempoBpm)))
              }
            : {}),
          ...(input.promotionChainBaseTempoBpm !== undefined
            ? {
                chainBaseTempoBpm: Math.max(40, Math.min(240, Math.round(input.promotionChainBaseTempoBpm)))
              }
            : {}),
          ...(input.promotionChainTargetTempoBpm !== undefined
            ? {
                chainTargetTempoBpm: Math.max(40, Math.min(240, Math.round(input.promotionChainTargetTempoBpm)))
              }
            : {}),
          ...(typeof input.promotionReason === "string" && input.promotionReason.length > 0
            ? { reason: input.promotionReason }
            : {})
        }
      : null;

    const session = {
      id: randomUUID(),
      userId: normalizedUserId,
      trainingId: training.id,
      exerciseId: input.exerciseId ?? training.exerciseId,
      calibrationOffsetMs: input.calibrationOffsetMs ?? 0,
      inputMode: input.inputMode ?? "synthetic",
      inputFilePath: input.inputFilePath ?? null,
      captureDurationMs: input.captureDurationMs ?? 4000,
      captureProfile: input.captureProfile ?? "balanced",
      inputDeviceBackend: input.inputDeviceBackend ?? "wavein",
      inputDeviceId: input.inputDeviceId ?? null,
      inputDeviceNumber: input.inputDeviceNumber ?? 0,
      tempoBpm: requestedTempoBpm,
      practiceScope,
      loopSectionId: practiceScope === "section-loop" ? input.loopSectionId : null,
      loopRepetitionCount,
      loopTempoStepBpm,
      summary:
        recoveryContext || returnContext || promotionContext
          ? {
              ...(recoveryContext
                ? {
                    practiceRecoveryContext: recoveryContext
                  }
                : {}),
              ...(returnContext
                ? {
                    practiceReturnContext: returnContext
                  }
                : {}),
              ...(promotionContext
                ? {
                    practicePromotionContext: promotionContext
                  }
                : {})
            }
          : null,
      status: "active",
      createdAt: new Date().toISOString()
    };

    const createdSession = this.#sessionRepository.create(session);

    return {
      ok: true,
      session: {
        ...createdSession,
        practiceScope,
        tempoBpm: requestedTempoBpm,
        ...(practiceScope === "section-loop" && input.loopSectionId
          ? {
              loopSectionId: input.loopSectionId,
              loopRepetitionCount,
              loopTempoStepBpm
            }
          : {})
      },
      training
    };
  }

  completeSession(sessionId, summary) {
    const existing = this.#sessionRepository.findById(sessionId);

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: "SESSION_NOT_FOUND",
        message: `Session ${sessionId} does not exist.`
      };
    }

    if (existing.status === "completed") {
      return {
        ok: false,
        statusCode: 409,
        code: "SESSION_ALREADY_COMPLETED",
        message: `Session ${sessionId} has already been completed.`
      };
    }

    const trainings = this.#trainingRepository.list();
    const completedSessionsBeforeUpdate = this.#sessionRepository.listCompletedByUser(existing.userId);
    const previousUnlockGraph = buildContentUnlockGraph({
      completedSessions: completedSessionsBeforeUpdate,
      trainings
    });
    const updated = this.#sessionRepository.updateSummary(sessionId, summary);
    const setupRecommendationFollowup = this.#evaluatePlannedSetupRecommendation(existing.userId, updated);
    const completedSessionsAfterUpdate = this.#sessionRepository.listCompletedByUser(existing.userId);
    const nextUnlockGraph = buildContentUnlockGraph({
      completedSessions: completedSessionsAfterUpdate,
      trainings
    });
    const unlockTransition = findUnlockTransitions({
      previousGraph: previousUnlockGraph,
      nextGraph: nextUnlockGraph
    });

    return {
      ok: true,
      session: updated,
      unlockTransition,
      user: setupRecommendationFollowup?.user ?? null,
      setupRecommendationFollowup: setupRecommendationFollowup?.setupRecommendation ?? null
    };
  }
}
