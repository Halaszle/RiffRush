function createContentUnlockEvidence({
  type,
  sourceTrainingId = null,
  sourceTrainingTitle = null,
  sessionId = null
}) {
  return {
    type,
    sourceTrainingId,
    sourceTrainingTitle,
    sessionId
  };
}

function rankContentUnlockEvidence(evidence) {
  if (evidence.type === "completed-session") {
    return 5;
  }

  if (evidence.type === "graph-edge") {
    return 4;
  }

  if (evidence.type === "promotion-route") {
    return 3;
  }

  if (evidence.type === "recovery-route" || evidence.type === "return-route") {
    return 2;
  }

  if (evidence.type === "recommended-route") {
    return 1;
  }

  return 0;
}

function selectBestContentUnlockEvidence(evidences = []) {
  if (evidences.length === 0) {
    return null;
  }

  return [...evidences].sort((left, right) => rankContentUnlockEvidence(right) - rankContentUnlockEvidence(left))[0];
}

function formatContentUnlockSource(evidence) {
  if (!evidence) {
    return "Locked";
  }

  if (evidence.type === "root") {
    return "Root node";
  }

  if (evidence.type === "completed-session") {
    return "Completed session";
  }

  if (evidence.type === "graph-edge") {
    return evidence.sourceTrainingTitle
      ? `Unlocked after completing "${evidence.sourceTrainingTitle}"`
      : "Unlocked by content graph";
  }

  if (evidence.type === "promotion-route") {
    return evidence.sourceTrainingTitle
      ? `Unlocked via promotion from "${evidence.sourceTrainingTitle}"`
      : "Unlocked via promotion route";
  }

  if (evidence.type === "recovery-route") {
    return evidence.sourceTrainingTitle
      ? `Unlocked via recovery route from "${evidence.sourceTrainingTitle}"`
      : "Unlocked via recovery route";
  }

  if (evidence.type === "return-route") {
    return evidence.sourceTrainingTitle
      ? `Unlocked via return route from "${evidence.sourceTrainingTitle}"`
      : "Unlocked via return route";
  }

  if (evidence.type === "recommended-route") {
    return "Unlocked by current recommendation";
  }

  return "Unlocked";
}

function formatTrainingTitleList(trainingTitles = []) {
  if (trainingTitles.length === 0) {
    return "";
  }

  if (trainingTitles.length === 1) {
    return `"${trainingTitles[0]}"`;
  }

  return trainingTitles.map((title) => `"${title}"`).join(", ");
}

function buildPrerequisiteTrainingMap(trainings) {
  const prerequisiteTrainingMap = new Map();

  for (const training of trainings) {
    for (const unlockedTrainingId of training.contentGraph?.unlocks ?? []) {
      const currentPrerequisites = prerequisiteTrainingMap.get(unlockedTrainingId) ?? [];
      currentPrerequisites.push({
        trainingId: training.id,
        title: training.title,
        difficulty: training.difficulty
      });
      prerequisiteTrainingMap.set(unlockedTrainingId, currentPrerequisites);
    }
  }

  return prerequisiteTrainingMap;
}

function buildUnlockRequirements(training, prerequisiteTrainings = [], completedTrainingIds = new Set()) {
  if (training.contentGraph?.isRoot) {
    return [];
  }

  return prerequisiteTrainings.map((prerequisiteTraining) => ({
    type: "complete-training",
    trainingId: prerequisiteTraining.trainingId,
    trainingTitle: prerequisiteTraining.title,
    trainingDifficulty: prerequisiteTraining.difficulty,
    isSatisfied: completedTrainingIds.has(prerequisiteTraining.trainingId),
    summary: `Complete "${prerequisiteTraining.title}" to unlock this training.`
  }));
}

function buildUnlockProgress(training, unlockRequirements = []) {
  if (training.contentGraph?.isRoot) {
    return {
      mode: "root",
      completedRequirementCount: 0,
      totalRequirementCount: 0,
      isComplete: true,
      summary: "Available from the start."
    };
  }

  if (unlockRequirements.length === 0) {
    return {
      mode: "unconfigured",
      completedRequirementCount: 0,
      totalRequirementCount: 0,
      isComplete: false,
      summary: "No unlock requirement has been configured yet."
    };
  }

  const completedRequirementCount = unlockRequirements.filter((requirement) => requirement.isSatisfied).length;
  const totalRequirementCount = unlockRequirements.length;
  const isComplete = completedRequirementCount > 0;

  return {
    mode: "any-of",
    completedRequirementCount,
    totalRequirementCount,
    isComplete,
    summary:
      totalRequirementCount === 1
        ? completedRequirementCount === 1
          ? "Unlock requirement completed."
          : "0/1 prerequisite training completed."
        : `${completedRequirementCount}/${totalRequirementCount} prerequisite trainings completed.`
  };
}

function formatUnlockRequirementSummary(training, prerequisiteTrainings = []) {
  if (training.contentGraph?.isRoot) {
    return "Available from the start.";
  }

  if (prerequisiteTrainings.length === 0) {
    return "No unlock requirement has been configured yet.";
  }

  if (prerequisiteTrainings.length === 1) {
    return `Complete "${prerequisiteTrainings[0].title}" to unlock this training.`;
  }

  return `Complete one of: ${formatTrainingTitleList(prerequisiteTrainings.map((trainingNode) => trainingNode.title))}.`;
}

function formatLockedReason(training, prerequisiteTrainings = []) {
  if (training.contentGraph?.isRoot) {
    return null;
  }

  if (prerequisiteTrainings.length === 0) {
    return "This training is locked because it does not have an available unlock path yet.";
  }

  if (prerequisiteTrainings.length === 1) {
    return `This training is locked until you complete "${prerequisiteTrainings[0].title}".`;
  }

  return `This training is locked until you complete one of: ${formatTrainingTitleList(prerequisiteTrainings.map((trainingNode) => trainingNode.title))}.`;
}

function getSessionPracticeContexts(session) {
  return {
    recoveryContext: session.summary?.practiceRecoveryContext ?? session.recoveryContext ?? null,
    returnContext: session.summary?.practiceReturnContext ?? session.returnContext ?? null,
    promotionContext: session.summary?.practicePromotionContext ?? session.promotionContext ?? null
  };
}

export function buildContentUnlockGraph({
  completedSessions,
  trainings,
  targetedPractice = null
}) {
  const trainingMap = new Map(trainings.map((training) => [training.id, training]));
  const prerequisiteTrainingMap = buildPrerequisiteTrainingMap(trainings);
  const evidenceMap = new Map();
  const completedTrainingIds = new Set();

  function pushEvidence(trainingId, evidence) {
    if (!trainingId || !trainingMap.has(trainingId)) {
      return;
    }

    const currentEvidence = evidenceMap.get(trainingId) ?? [];
    currentEvidence.push(evidence);
    evidenceMap.set(trainingId, currentEvidence);
  }

  for (const training of trainings) {
    if (training.contentGraph?.isRoot) {
      pushEvidence(
        training.id,
        createContentUnlockEvidence({
          type: "root"
        })
      );
    }
  }

  for (const session of completedSessions) {
    const currentTraining = trainingMap.get(session.trainingId) ?? null;
    const { recoveryContext, returnContext, promotionContext } = getSessionPracticeContexts(session);

    completedTrainingIds.add(session.trainingId);

    pushEvidence(
      session.trainingId,
      createContentUnlockEvidence({
        type: "completed-session",
        sourceTrainingId: session.trainingId,
        sourceTrainingTitle: currentTraining?.title ?? session.trainingId,
        sessionId: session.id
      })
    );

    if (recoveryContext?.goalTrainingId) {
      pushEvidence(
        recoveryContext.goalTrainingId,
        createContentUnlockEvidence({
          type: "recovery-route",
          sourceTrainingId: session.trainingId,
          sourceTrainingTitle: currentTraining?.title ?? session.trainingId,
          sessionId: session.id
        })
      );
    }

    if (returnContext?.goalTrainingId) {
      const returnSourceTraining =
        trainingMap.get(returnContext.recoveryTrainingId) ?? currentTraining;

      pushEvidence(
        returnContext.goalTrainingId,
        createContentUnlockEvidence({
          type: "return-route",
          sourceTrainingId: returnSourceTraining?.id ?? null,
          sourceTrainingTitle: returnSourceTraining?.title ?? null,
          sessionId: session.id
        })
      );
    }

    if (promotionContext?.promotedTrainingId) {
      const promotionSourceTraining = trainingMap.get(promotionContext.sourceTrainingId) ?? null;

      pushEvidence(
        promotionContext.promotedTrainingId,
        createContentUnlockEvidence({
          type: "promotion-route",
          sourceTrainingId: promotionSourceTraining?.id ?? null,
          sourceTrainingTitle: promotionSourceTraining?.title ?? null,
          sessionId: session.id
        })
      );
    }
  }

  for (const completedTrainingId of completedTrainingIds) {
    const completedTraining = trainingMap.get(completedTrainingId) ?? null;

    for (const unlockedTrainingId of completedTraining?.contentGraph?.unlocks ?? []) {
      pushEvidence(
        unlockedTrainingId,
        createContentUnlockEvidence({
          type: "graph-edge",
          sourceTrainingId: completedTraining?.id ?? completedTrainingId,
          sourceTrainingTitle: completedTraining?.title ?? completedTrainingId
        })
      );
    }
  }

  if (targetedPractice?.recommendedTrainingId) {
    pushEvidence(
      targetedPractice.recommendedTrainingId,
      createContentUnlockEvidence({
        type: "recommended-route",
        sourceTrainingId: targetedPractice.basedOnTrainingId ?? null,
        sourceTrainingTitle: targetedPractice.basedOnTrainingId
          ? trainingMap.get(targetedPractice.basedOnTrainingId)?.title ?? targetedPractice.basedOnTrainingId
          : null
      })
    );
  }

  const nodes = trainings.map((training) => {
    const evidences = evidenceMap.get(training.id) ?? [];
    const bestEvidence = selectBestContentUnlockEvidence(evidences);
    const completedSessionCount = completedSessions.filter((session) => session.trainingId === training.id).length;
    const isUnlocked = Boolean(bestEvidence);
    const isCompleted = completedSessionCount > 0;
    const prerequisiteTrainings = prerequisiteTrainingMap.get(training.id) ?? [];
    const unlockRequirements = buildUnlockRequirements(training, prerequisiteTrainings, completedTrainingIds);
    const unlockProgress = buildUnlockProgress(training, unlockRequirements);
    const unlockRequirementSummary = formatUnlockRequirementSummary(training, prerequisiteTrainings);
    const lockedReason = isUnlocked ? null : formatLockedReason(training, prerequisiteTrainings);

    return {
      trainingId: training.id,
      trainingTitle: training.title,
      difficulty: training.difficulty,
      isRoot: Boolean(training.contentGraph?.isRoot),
      isUnlocked,
      isCompleted,
      isSuggested: targetedPractice?.recommendedTrainingId === training.id,
      unlockState: isCompleted ? "completed" : isUnlocked ? "unlocked" : "locked",
      completedSessionCount,
      unlockSource: formatContentUnlockSource(bestEvidence),
      lockedReason,
      unlockRequirementSummary,
      unlockRequirements,
      unlockProgress,
      prerequisiteTrainingIds: prerequisiteTrainings.map((prerequisiteTraining) => prerequisiteTraining.trainingId),
      prerequisiteTrainingTitles: prerequisiteTrainings.map((prerequisiteTraining) => prerequisiteTraining.title),
      unlockedFromTrainingId: bestEvidence?.sourceTrainingId ?? null,
      unlockedFromTrainingTitle: bestEvidence?.sourceTrainingTitle ?? null,
      nextTrainingIds: [...(training.contentGraph?.unlocks ?? [])],
      nextTrainingTitles: (training.contentGraph?.unlocks ?? []).map(
        (trainingId) => trainingMap.get(trainingId)?.title ?? trainingId
      )
    };
  });

  return {
    nodes,
    unlockedTrainingCount: nodes.filter((node) => node.isUnlocked).length,
    completedTrainingCount: nodes.filter((node) => node.isCompleted).length,
    lockedTrainingCount: nodes.filter((node) => !node.isUnlocked).length
  };
}

export function findContentUnlockNode({
  completedSessions,
  trainings,
  trainingId,
  targetedPractice = null
}) {
  return (
    buildContentUnlockGraph({
      completedSessions,
      trainings,
      targetedPractice
    }).nodes.find((node) => node.trainingId === trainingId) ?? null
  );
}

export function findUnlockTransitions({
  previousGraph,
  nextGraph
}) {
  const previousNodeMap = new Map((previousGraph?.nodes ?? []).map((node) => [node.trainingId, node]));
  const newlyUnlockedTrainings = (nextGraph?.nodes ?? []).filter((node) => {
    const previousNode = previousNodeMap.get(node.trainingId);

    return node.isUnlocked && !previousNode?.isUnlocked;
  });

  return {
    unlockedTrainingCount: newlyUnlockedTrainings.length,
    unlockedTrainingIds: newlyUnlockedTrainings.map((node) => node.trainingId),
    unlockedTrainingTitles: newlyUnlockedTrainings.map((node) => node.trainingTitle),
    trainings: newlyUnlockedTrainings.map((node) => ({
      trainingId: node.trainingId,
      trainingTitle: node.trainingTitle,
      difficulty: node.difficulty,
      unlockSource: node.unlockSource,
      nextTrainingTitles: node.nextTrainingTitles,
      unlockState: node.unlockState
    })),
    hasNewUnlocks: newlyUnlockedTrainings.length > 0
  };
}
