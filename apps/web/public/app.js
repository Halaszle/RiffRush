const state = {
  backendUrl: "http://127.0.0.1:3001",
  engineUrl: "ws://127.0.0.1:3210/ws",
  auth: {
    token: null,
    userId: null,
    email: null
  },
  gameplay: {
    active: false,
    startedAt: null,
    trainingName: null,
    tempoBpm: null,
    leadInMs: null,
    targets: [],
    totalScore: 0,
    hitCount: 0,
    missCount: 0,
    comboMultiplier: 1,
    feedbackTimer: null,
    rafId: null
  },
  onboarding: {
    step: 1,
    enginePollTimer: null
  },
  trainings: [],
  selectedTrainingId: null,
  activeSessionId: null,
  activeInputMode: null,
  engineSocket: null,
  engineConnected: false,
  calibrationInProgress: false,
  liveCapture: null,
  lastArtifactPath: "",
  lastNativePreflight: null,
  nativeDevices: [],
  diagnosticsReport: null,
  deviceDiagnosticsReport: null,
  sessionRecommendation: {
    key: null,
    report: null,
    pendingKey: null
  },
  sessionDiagnostics: {
    sessionId: null,
    inputMode: null,
    currentCapture: null,
    notices: [],
    lastSummary: null
  },
  eventLog: [],
  dashboard: null,
  lastUnlockTransition: null,
    lastSessionRecap: null,
    progressionCheckpointSnapshots: [],
  progressionCheckpointFilter: "all",
  selectedCheckpointSnapshotSessionId: null,
  checkpointPathActionFeedback: null,
  progressionNextActionFeedback: null,
  checkpointPathHandoff: null,
  checkpointPathAutoFocus: null,
  checkpointPathCollapse: {
    active: false,
    focusPathType: null
  }
  };

const engineRequestState = {
  nextId: 0,
  pending: new Map()
};

const elements = {
  backendUrl: document.querySelector("#backend-url"),
  engineUrl: document.querySelector("#engine-url"),
  healthStatus: document.querySelector("#health-status"),
  engineStatus: document.querySelector("#engine-status"),
  trainingList: document.querySelector("#training-list"),
  trainingCount: document.querySelector("#training-count"),
  sessionStatus: document.querySelector("#session-status"),
  summaryStatus: document.querySelector("#summary-status"),
  unlockCelebrationStatus: document.querySelector("#unlock-celebration-status"),
  unlockOnboardingStatus: document.querySelector("#unlock-onboarding-status"),
  sessionCompletionRecap: document.querySelector("#session-completion-recap"),
  dominantConfidenceRecapStatus: document.querySelector("#dominant-confidence-recap-status"),
  progressionCheckpointRecaps: document.querySelector("#progression-checkpoint-recaps"),
  checkpointPathSummaryCards: document.querySelector("#checkpoint-path-summary-cards"),
  checkpointPathHandoffStatus: document.querySelector("#checkpoint-path-handoff-status"),
  checkpointPathCollapseToggle: document.querySelector("#checkpoint-path-collapse-toggle"),
  progressionCheckpointFilter: document.querySelector("#progression-checkpoint-filter"),
  progressionCheckpointHistory: document.querySelector("#progression-checkpoint-history"),
  progressionCheckpointDetailBadges: document.querySelector("#progression-checkpoint-detail-badges"),
  progressionCheckpointDetail: document.querySelector("#progression-checkpoint-detail"),
  dominantConfidenceNextActionStatus: document.querySelector("#dominant-confidence-next-action-status"),
  progressionNextActionStatus: document.querySelector("#progression-next-action-status"),
  progressionNextActionHint: document.querySelector("#progression-next-action-hint"),
  progressionNextActionResult: document.querySelector("#progression-next-action-result"),
  progressionNextActionFocus: document.querySelector("#progression-next-action-focus"),
  progressionNextActionFeedbackBadgeRow: document.querySelector("#progression-next-action-feedback-badge-row"),
  progressionNextActionFocusBadgeRow: document.querySelector("#progression-next-action-focus-badge-row"),
  progressionNextActionState: document.querySelector("#progression-next-action-state"),
  progressionNextStepDecision: document.querySelector("#progression-next-step-decision"),
  progressionTimeline: document.querySelector("#progression-timeline"),
  captureRecommendationStatus: document.querySelector("#capture-recommendation-status"),
  nativePreflightStatus: document.querySelector("#native-preflight-status"),
  diagnosticsExportStatus: document.querySelector("#diagnostics-export-status"),
  diagnosticsSummaryCards: document.querySelector("#diagnostics-summary-cards"),
  diagnosticsRecommendation: document.querySelector("#diagnostics-recommendation"),
  diagnosticsRanking: document.querySelector("#diagnostics-ranking"),
  diagnosticsRuntimeIssues: document.querySelector("#diagnostics-runtime-issues"),
  diagnosticsDeviceRecommendations: document.querySelector("#diagnostics-device-recommendations"),
  diagnosticsDeviceDetailSelect: document.querySelector("#diagnostics-device-detail-select"),
  diagnosticsDeviceDetail: document.querySelector("#diagnostics-device-detail"),
  sessionDiagnosticsCurrent: document.querySelector("#session-diagnostics-current"),
  sessionDiagnosticsHistory: document.querySelector("#session-diagnostics-history"),
  calibrationStatus: document.querySelector("#calibration-status"),
  eventLog: document.querySelector("#event-log"),
  dashboardSummary: document.querySelector("#dashboard-summary"),
  dashboardResults: document.querySelector("#dashboard-results"),
  dashboardTargetedPractice: document.querySelector("#dashboard-targeted-practice"),
  dashboardCapturePreferences: document.querySelector("#dashboard-capture-preferences"),
  dashboardCaptureOverrides: document.querySelector("#dashboard-capture-overrides"),
  dashboardSetupRecommendations: document.querySelector("#dashboard-setup-recommendations"),
  setupRecommendationFeedbackStatus: document.querySelector("#setup-recommendation-feedback-status"),
  diagnosticsGroups: document.querySelector("#diagnostics-groups"),
  diagnosticsSessions: document.querySelector("#diagnostics-sessions"),
  diagnosticsDeviceFilter: document.querySelector("#diagnostics-device-filter"),
  diagnosticsBackendFilter: document.querySelector("#diagnostics-backend-filter"),
  diagnosticsProfileFilter: document.querySelector("#diagnostics-profile-filter"),
  diagnosticsSortBy: document.querySelector("#diagnostics-sort-by"),
  diagnosticsSortDirection: document.querySelector("#diagnostics-sort-direction"),
  userId: document.querySelector("#user-id"),
  calibrationOffset: document.querySelector("#calibration-offset"),
  inputMode: document.querySelector("#input-mode"),
  inputFilePath: document.querySelector("#input-file-path"),
  captureDurationMs: document.querySelector("#capture-duration-ms"),
  sessionTempoBpm: document.querySelector("#session-tempo-bpm"),
  practiceScope: document.querySelector("#practice-scope"),
  loopSectionId: document.querySelector("#loop-section-id"),
  loopRepetitionCount: document.querySelector("#loop-repetition-count"),
  loopTempoStepBpm: document.querySelector("#loop-tempo-step-bpm"),
  captureProfile: document.querySelector("#capture-profile"),
  nativeBackend: document.querySelector("#native-backend"),
  inputDeviceNumber: document.querySelector("#input-device-number"),
  autoApplyCaptureRecommendation: document.querySelector("#auto-apply-capture-recommendation"),
  createSessionButton: document.querySelector("#create-session"),
  selectUnlockedTrainingButton: document.querySelector("#select-unlocked-training"),
  startUnlockedTrainingButton: document.querySelector("#start-unlocked-training"),
  progressionNextActionButton: document.querySelector("#progression-next-action"),
  applyPracticePresetButton: document.querySelector("#apply-practice-preset"),
  applyCaptureRecommendationButton: document.querySelector("#apply-capture-recommendation"),
  runNativePreflightButton: document.querySelector("#run-native-preflight"),
  stopLiveSessionButton: document.querySelector("#stop-live-session"),
  checkHealthButton: document.querySelector("#check-health"),
  loadTrainingsButton: document.querySelector("#load-trainings"),
  loadDashboardButton: document.querySelector("#load-dashboard"),
  connectEngineButton: document.querySelector("#connect-engine"),
  loadNativeDevicesButton: document.querySelector("#load-native-devices"),
  applyDiagnosticsFiltersButton: document.querySelector("#apply-diagnostics-filters"),
  clearDiagnosticsFiltersButton: document.querySelector("#clear-diagnostics-filters"),
  exportDiagnosticsJsonButton: document.querySelector("#export-diagnostics-json"),
  exportDiagnosticsCsvButton: document.querySelector("#export-diagnostics-csv"),
  loadDeviceDiagnosticsButton: document.querySelector("#load-device-diagnostics"),
  disconnectEngineButton: document.querySelector("#disconnect-engine"),
  startCalibrationButton: document.querySelector("#start-calibration"),
  authPanel: document.querySelector("#auth-panel"),
  appContent: document.querySelector("#app-content"),
  authTabLogin: document.querySelector("#auth-tab-login"),
  authTabRegister: document.querySelector("#auth-tab-register"),
  authFormLogin: document.querySelector("#auth-form-login"),
  authFormRegister: document.querySelector("#auth-form-register"),
  authLoginEmail: document.querySelector("#auth-login-email"),
  authLoginPassword: document.querySelector("#auth-login-password"),
  authLoginError: document.querySelector("#auth-login-error"),
  authRegisterEmail: document.querySelector("#auth-register-email"),
  authRegisterPassword: document.querySelector("#auth-register-password"),
  authRegisterError: document.querySelector("#auth-register-error"),
  userBar: document.querySelector("#user-bar"),
  userBarEmail: document.querySelector("#user-bar-email"),
  logoutButton: document.querySelector("#logout-button"),
  gameplayOverlay: document.querySelector("#gameplay-overlay"),
  gameplayTrainingName: document.querySelector("#gameplay-training-name"),
  gameplayTempoLabel: document.querySelector("#gameplay-tempo-label"),
  gameplayScore: document.querySelector("#gameplay-score"),
  gameplayCombo: document.querySelector("#gameplay-combo"),
  gameplayAccuracy: document.querySelector("#gameplay-accuracy"),
  gameplayStop: document.querySelector("#gameplay-stop"),
  gameplayHighway: document.querySelector("#gameplay-highway"),
  gameplayNotes: document.querySelector("#gameplay-notes"),
  gameplayCountdown: document.querySelector("#gameplay-countdown"),
  gameplayFeedback: document.querySelector("#gameplay-feedback"),
  gameplayResults: document.querySelector("#gameplay-results"),
  gameplayResultsGrade: document.querySelector("#gameplay-results-grade"),
  gameplayResultsScore: document.querySelector("#gameplay-results-score"),
  gameplayResultsAccuracy: document.querySelector("#gameplay-results-accuracy"),
  gameplayResultsFeedback: document.querySelector("#gameplay-results-feedback"),
  gameplayResultsContinue: document.querySelector("#gameplay-results-continue"),
  onboardingOverlay: document.querySelector("#onboarding-overlay"),
  onboardingStep1: document.querySelector("#onboarding-step-1"),
  onboardingStep2: document.querySelector("#onboarding-step-2"),
  onboardingStep3: document.querySelector("#onboarding-step-3"),
  onboardingDot1: document.querySelector("#onboarding-dot-1"),
  onboardingDot2: document.querySelector("#onboarding-dot-2"),
  onboardingDot3: document.querySelector("#onboarding-dot-3"),
  onboardingStatusDot: document.querySelector("#onboarding-status-dot"),
  onboardingEngineStatusText: document.querySelector("#onboarding-engine-status-text"),
  onboardingNext1: document.querySelector("#onboarding-next-1"),
  onboardingNext2: document.querySelector("#onboarding-next-2"),
  onboardingSkipEngine: document.querySelector("#onboarding-skip-engine"),
  onboardingFinish: document.querySelector("#onboarding-finish")
};

function createEngineRequestId() {
  engineRequestState.nextId += 1;
  return `engine-request-${Date.now()}-${engineRequestState.nextId}`;
}

function clearPendingEngineRequests(error) {
  for (const pendingRequest of engineRequestState.pending.values()) {
    clearTimeout(pendingRequest.timeoutId);
    pendingRequest.reject(error);
  }

  engineRequestState.pending.clear();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resetStatusCardClasses(target) {
  target.classList.remove(
    "is-success",
    "is-error",
    "is-warning",
    "status-card-structured",
    "status-card-flow-summary",
    "status-card-flow-guidance",
    "status-card-flow-detail",
    "status-card-flow-handoff",
    "is-active",
    "is-spotlight",
    "has-note",
    "no-note"
  );
}

function setStatus(target, variant, message) {
  resetStatusCardClasses(target);

  if (variant) {
    target.classList.add(`is-${variant}`);
  }

  target.textContent = message;
}

function getCheckpointFlowStatusMeta(kind) {
  const checkpointFlowStatusMeta = {
    "session-recap": {
      title: "Session recap",
      role: "summary"
    },
    "confidence-recap": {
      title: "Dominant confidence signal",
      role: "summary"
    },
    "path-handoff": {
      title: "Checkpoint handoff",
      role: "handoff"
    },
    "checkpoint-detail": {
      title: "Checkpoint detail",
      role: "detail"
    },
    "confidence-next-action": {
      title: "Confidence guidance",
      role: "guidance"
    },
    "guided-next-action": {
      title: "Next guided action",
      role: "guidance"
    }
  };

  return checkpointFlowStatusMeta[kind] ?? checkpointFlowStatusMeta["guided-next-action"];
}

function getCheckpointFlowStatusInteractionState(kind) {
  if (kind === "session-recap") {
    return {
      isActive: Boolean(state.lastSessionRecap),
      isSpotlight: false
    };
  }

  if (kind === "confidence-recap") {
    return {
      isActive: Boolean(buildDominantCheckpointConfidenceSignalStatus()),
      isSpotlight: false
    };
  }

  if (kind === "path-handoff") {
    return {
      isActive: Boolean(state.checkpointPathHandoff?.message),
      isSpotlight: Boolean(state.checkpointPathHandoff?.message)
    };
  }

  if (kind === "checkpoint-detail") {
    const isSpotlight =
      state.checkpointPathHandoff?.focusTarget === "checkpoint-detail" ||
      state.checkpointPathAutoFocus?.focusTarget === "checkpoint-detail";
    return {
      isActive: Boolean(state.selectedCheckpointSnapshotSessionId),
      isSpotlight
    };
  }

  if (kind === "confidence-next-action") {
    return {
      isActive: Boolean(buildDominantCheckpointConfidenceSignalStatus()),
      isSpotlight: false
    };
  }

  if (kind === "guided-next-action") {
    const nextAction = getProgressionNextAction();
    return {
      isActive: Boolean(nextAction),
      isSpotlight: Boolean(nextAction) && !state.checkpointPathHandoff?.message
    };
  }

  return {
    isActive: false,
    isSpotlight: false
  };
}

function buildCheckpointFlowStatusContent(message) {
  const normalizedMessage = String(message ?? "").trim();

  if (!normalizedMessage) {
    return {
      lead: "",
      note: null
    };
  }

  const sentenceMatch = normalizedMessage.match(/^(.+?[.!?])\s+(.+)$/);

  if (sentenceMatch) {
    return {
      lead: sentenceMatch[1].trim(),
      note: sentenceMatch[2].trim()
    };
  }

  const delimiterIndex = normalizedMessage.indexOf(": ");
  if (delimiterIndex > 0) {
    return {
      lead: normalizedMessage.slice(0, delimiterIndex + 1).trim(),
      note: normalizedMessage.slice(delimiterIndex + 2).trim()
    };
  }

  return {
    lead: normalizedMessage,
    note: null
  };
}

function truncateCheckpointFlowStatusText(text, maxLength) {
  const normalizedText = String(text ?? "").trim();

  if (!normalizedText || normalizedText.length <= maxLength) {
    return normalizedText;
  }

  const truncatedText = normalizedText.slice(0, maxLength).trim();
  const sentenceBoundaryIndex = Math.max(
    truncatedText.lastIndexOf(". "),
    truncatedText.lastIndexOf("; "),
    truncatedText.lastIndexOf(", ")
  );

  if (sentenceBoundaryIndex > 48) {
    return `${truncatedText.slice(0, sentenceBoundaryIndex + 1).trim()}...`;
  }

  return `${truncatedText.replace(/[.,;:\s]+$/u, "")}...`;
}

function compactCheckpointFlowStatusMessage(kind, message) {
  const normalizedMessage = String(message ?? "").trim();

  if (!normalizedMessage) {
    return normalizedMessage;
  }

  const maxLengthByKind = {
    "session-recap": 220,
    "confidence-recap": 180,
    "path-handoff": 170,
    "checkpoint-detail": 220,
    "confidence-next-action": 200,
    "guided-next-action": 220
  };

  return truncateCheckpointFlowStatusText(
    normalizedMessage,
    maxLengthByKind[kind] ?? 200
  );
}

function buildCheckpointFlowStatusStateLabel({ variant = null, interactionState = null } = {}) {
  if (interactionState?.isSpotlight) {
    return "Spotlight";
  }

  if (interactionState?.isActive) {
    if (variant === "warning") {
      return "Active caution";
    }

    if (variant === "error") {
      return "Blocked";
    }

    return "Active";
  }

  return "Waiting";
}

function buildCheckpointFlowStatusSourceMeta(kind, interactionState = null) {
  const hasActiveSessionRecap = Boolean(state.lastSessionRecap);
  const hasDominantSignal = Boolean(buildDominantCheckpointConfidenceSignalStatus());
  const hasPathHandoff = Boolean(state.checkpointPathHandoff?.message);
  const hasCheckpointDetail = Boolean(state.selectedCheckpointSnapshotSessionId);
  const hasNextAction = Boolean(getProgressionNextAction());

  const sourceMetaByKind = {
    "session-recap": hasActiveSessionRecap
      ? { label: "From latest session", phase: "active" }
      : { label: "Waiting for latest session", phase: "waiting" },
    "confidence-recap": hasDominantSignal
      ? { label: "From confidence signal", phase: "active" }
      : { label: "Waiting for confidence signal", phase: "waiting" },
    "path-handoff": hasPathHandoff
      ? { label: "From path handoff", phase: "active" }
      : { label: "Waiting for path action", phase: "waiting" },
    "checkpoint-detail": hasCheckpointDetail
      ? { label: "From selected snapshot", phase: "active" }
      : { label: "Waiting for snapshot", phase: "waiting" },
    "confidence-next-action": hasDominantSignal
      ? { label: "From confidence guidance", phase: "active" }
      : { label: "Waiting for confidence guidance", phase: "waiting" },
    "guided-next-action": hasNextAction
      ? { label: "From guided next step", phase: "active" }
      : { label: "Waiting for guided step", phase: "waiting" }
  };

  const sourceMeta = sourceMetaByKind[kind] ?? {
    label: "From checkpoint guidance",
    phase: "active"
  };

  if (interactionState?.isSpotlight) {
    return {
      label: sourceMeta.label,
      phase: "spotlight"
    };
  }

  return sourceMeta;
}

function getCheckpointFlowStatusSourceTone(kind, interactionState = null) {
  if (kind === "path-handoff") {
    return interactionState?.isSpotlight ? "handoff" : "active";
  }

  if (kind === "checkpoint-detail") {
    return interactionState?.isSpotlight ? "detail" : "active";
  }

  if (kind === "session-recap" || kind === "confidence-recap") {
    return "summary";
  }

  if (kind === "confidence-next-action" || kind === "guided-next-action") {
    return interactionState?.isSpotlight ? "guidance" : "active";
  }

  return "neutral";
}

function getCheckpointFlowStatusStateTone({ variant = null, interactionState = null } = {}) {
  if (interactionState?.isSpotlight) {
    return variant === "warning" ? "warning" : "success";
  }

  if (interactionState?.isActive) {
    if (variant === "warning") {
      return "warning";
    }

    if (variant === "error") {
      return "error";
    }

    return "success";
  }

  return "neutral";
}

function setCheckpointFlowStatus(target, kind, variant, message) {
  const meta = getCheckpointFlowStatusMeta(kind);
  const interactionState = getCheckpointFlowStatusInteractionState(kind);
  const content = buildCheckpointFlowStatusContent(compactCheckpointFlowStatusMessage(kind, message));
  const stateLabel = buildCheckpointFlowStatusStateLabel({
    variant,
    interactionState
  });
  const sourceMeta = buildCheckpointFlowStatusSourceMeta(kind, interactionState);
  const sourceTone = getCheckpointFlowStatusSourceTone(kind, interactionState);
  const stateTone = getCheckpointFlowStatusStateTone({
    variant,
    interactionState
  });
  resetStatusCardClasses(target);
  target.classList.add("status-card-structured", `status-card-flow-${meta.role}`);

  if (variant) {
    target.classList.add(`is-${variant}`);
  }

  if (interactionState.isActive) {
    target.classList.add("is-active");
  }

  if (interactionState.isSpotlight) {
    target.classList.add("is-spotlight");
  }

  target.classList.add(content.note ? "has-note" : "no-note");

  target.innerHTML = `
    <div class="status-card-meta">
      <span class="status-card-state status-card-state-${escapeHtml(stateTone)}">${escapeHtml(stateLabel)}</span>
      <span class="status-card-source status-card-source-${escapeHtml(sourceTone)} status-card-source-phase-${escapeHtml(
        sourceMeta.phase
      )}" title="${escapeHtml(sourceMeta.label)}" aria-label="${escapeHtml(sourceMeta.label)}">${escapeHtml(
        sourceMeta.label
      )}</span>
    </div>
    <strong class="status-card-title">${escapeHtml(meta.title)}</strong>
    <span class="status-card-lead">${escapeHtml(content.lead)}</span>
    ${
      content.note
        ? `<span class="status-card-note" title="${escapeHtml(content.note)}" aria-label="${escapeHtml(content.note)}">${escapeHtml(
            content.note
          )}</span>`
        : ""
    }
  `;
}

function getCheckpointFlowStatusElement(kind) {
  const checkpointFlowStatusElements = {
    "session-recap": elements.sessionCompletionRecap,
    "confidence-recap": elements.dominantConfidenceRecapStatus,
    "path-handoff": elements.checkpointPathHandoffStatus,
    "checkpoint-detail": elements.progressionCheckpointDetail,
    "confidence-next-action": elements.dominantConfidenceNextActionStatus,
    "guided-next-action": elements.progressionNextActionStatus
  };

  return checkpointFlowStatusElements[kind] ?? null;
}

function focusCheckpointFlowStatusCard(kind) {
  const target = getCheckpointFlowStatusElement(kind);

  if (!target || typeof target.focus !== "function") {
    return;
  }

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }

  target.focus({ preventScroll: true });
}

function pushEventLog(title, details) {
  state.eventLog = [{ title, details }, ...state.eventLog].slice(0, 8);

  elements.eventLog.innerHTML = state.eventLog
    .map(
      (entry) => `
        <article class="event-log-entry">
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.details)}</p>
        </article>
      `
    )
    .join("");
}

function resetEventLog() {
  state.eventLog = [];
  elements.eventLog.innerHTML = '<article class="event-log-empty">No score events yet.</article>';
}

function mergeDefinedFields(baseValue, patchValue) {
  const nextValue = { ...(baseValue ?? {}) };

  for (const [key, value] of Object.entries(patchValue ?? {})) {
    if (value !== undefined && value !== null) {
      nextValue[key] = value;
    }
  }

  return nextValue;
}

function syncTrainingAccessFromDashboard() {
  const accessMap = new Map(
    (state.dashboard?.contentUnlockGraph?.nodes ?? []).map((node) => [node.trainingId, node])
  );

  if (accessMap.size === 0 || state.trainings.length === 0) {
    return;
  }

  state.trainings = state.trainings.map((training) => ({
    ...training,
    access: accessMap.get(training.id) ?? training.access ?? null
  }));
}

function getLatestUnlockedTraining() {
  const unlockedTrainingId = state.lastUnlockTransition?.unlockedTrainingIds?.[0] ?? null;

  if (!unlockedTrainingId) {
    return null;
  }

  return state.trainings.find((training) => training.id === unlockedTrainingId) ?? null;
}

function getLatestUnlockedTrainingTransitionEntry() {
  const unlockedTrainingId = state.lastUnlockTransition?.unlockedTrainingIds?.[0] ?? null;

  if (!unlockedTrainingId) {
    return null;
  }

  return (
    state.lastUnlockTransition?.trainings?.find((training) => training.trainingId === unlockedTrainingId) ?? null
  );
}

function canStartLatestUnlockedTraining() {
  const latestUnlockedTraining = getLatestUnlockedTraining();

  if (!state.lastUnlockTransition?.hasNewUnlocks || !latestUnlockedTraining) {
    return false;
  }

  if (!state.engineConnected || state.activeSessionId) {
    return false;
  }

  return state.selectedTrainingId === latestUnlockedTraining.id;
}

function renderUnlockOnboardingHandoff() {
  const latestUnlockedTraining = getLatestUnlockedTraining();
  const unlockTransitionEntry = getLatestUnlockedTrainingTransitionEntry();
  const targetedPractice = state.dashboard?.targetedPractice ?? null;

  if (!state.lastUnlockTransition?.hasNewUnlocks || !latestUnlockedTraining) {
    setStatus(
      elements.unlockOnboardingStatus,
      null,
      "Unlock onboarding will appear after the next newly unlocked training."
    );
    return;
  }

  const isTargetedTraining = targetedPractice?.recommendedTrainingId === latestUnlockedTraining.id;
  const focusSectionLabel =
    isTargetedTraining
      ? targetedPractice.practiceSectionLabel ?? targetedPractice.recommendedSectionLabel ?? null
      : null;
  const focusSummary = focusSectionLabel
    ? `Focus section: ${focusSectionLabel}.`
    : `Focus: ${latestUnlockedTraining.objective}.`;
  const presetSummary =
    state.selectedTrainingId === latestUnlockedTraining.id
      ? `Session form ready: ${elements.practiceScope.value === "section-loop" ? "section loop" : "full chart"} at ${elements.sessionTempoBpm.value} BPM${
          elements.practiceScope.value === "section-loop"
            ? `, ${elements.loopRepetitionCount.value} rep(s), +${elements.loopTempoStepBpm.value} BPM`
            : ""
        }.`
      : `Recommended start: full chart at ${latestUnlockedTraining.tempoBpm} BPM.`;
  const launchSummary = canStartLatestUnlockedTraining()
    ? "Launch is ready: use Start unlocked training now."
    : state.engineConnected
      ? "Launch is not ready yet: select and prefill the unlocked training first."
      : "Launch is not ready yet: connect the local engine first.";

  setStatus(
    elements.unlockOnboardingStatus,
    "success",
    `${latestUnlockedTraining.title}: ${latestUnlockedTraining.description} ${
      unlockTransitionEntry?.unlockSource ? `Unlocked because: ${unlockTransitionEntry.unlockSource}. ` : ""
    }${focusSummary} ${presetSummary} ${launchSummary}`.trim()
  );
}

function createTargetedPracticeSnapshot(targetedPractice) {
  if (!targetedPractice) {
    return null;
  }

  return {
    recommendedTrainingId: targetedPractice.recommendedTrainingId ?? null,
    recommendedTrainingTitle: targetedPractice.recommendedTrainingTitle ?? null,
    recommendedSectionLabel:
      targetedPractice.practiceSectionLabel ??
      targetedPractice.recommendedSectionLabel ??
      null,
    suggestedTempoBpm: targetedPractice.suggestedTempoBpm ?? null,
    nextStep: targetedPractice.nextStep ?? null
  };
}

function buildSessionCompletionRecap({
  sessionId,
  sessionSummary,
  unlockTransition,
  previousTargetedPractice,
  nextTargetedPractice
}) {
  const previousSnapshot = createTargetedPracticeSnapshot(previousTargetedPractice);
  const nextSnapshot = createTargetedPracticeSnapshot(nextTargetedPractice);
  const ratingSummary = sessionSummary.rating
    ? `grade ${sessionSummary.rating.grade} (${sessionSummary.rating.label}), clear ${sessionSummary.rating.clearType}`
    : "no grade yet";
  const unlockSummary = unlockTransition?.hasNewUnlocks
    ? `Unlocked ${unlockTransition.unlockedTrainingTitles.join(", ")}.`
    : "No new training unlocks this run.";
  const progressionSummary = nextSnapshot
    ? previousSnapshot?.recommendedTrainingId !== nextSnapshot.recommendedTrainingId ||
      previousSnapshot?.suggestedTempoBpm !== nextSnapshot.suggestedTempoBpm ||
      previousSnapshot?.recommendedSectionLabel !== nextSnapshot.recommendedSectionLabel
        ? `Next guided step updated to ${nextSnapshot.recommendedTrainingTitle}${
            nextSnapshot.recommendedSectionLabel ? ` / ${nextSnapshot.recommendedSectionLabel}` : ""
          } at ${nextSnapshot.suggestedTempoBpm} BPM.`
        : `Guided next step remains ${nextSnapshot.recommendedTrainingTitle}${
            nextSnapshot.recommendedSectionLabel ? ` / ${nextSnapshot.recommendedSectionLabel}` : ""
          } at ${nextSnapshot.suggestedTempoBpm} BPM.`
    : "No targeted practice step is available yet.";
  const pathContext = buildCheckpointPathContextText();
  const confidenceRecap = buildCheckpointPathConfidenceRecap(sessionId);

  return {
    sessionId,
    totalScore: sessionSummary.totalScore,
    accuracy: sessionSummary.accuracy,
    grade: sessionSummary.rating?.grade ?? null,
    pathContext,
    confidenceRecap,
    unlockSummary,
    progressionSummary,
    nextStep: nextSnapshot?.nextStep ?? null,
    message: `${pathContext ? `${pathContext} ` : ""}Session ${sessionId}: score ${sessionSummary.totalScore}, accuracy ${sessionSummary.accuracy}, ${ratingSummary}. ${unlockSummary} ${progressionSummary}${
      nextSnapshot?.nextStep ? ` ${nextSnapshot.nextStep}` : ""
    }${confidenceRecap?.summary ? ` ${confidenceRecap.summary}` : ""}`
  };
}

function renderSessionCompletionRecap() {
  if (!state.lastSessionRecap) {
    setCheckpointFlowStatus(
      elements.sessionCompletionRecap,
      "session-recap",
      null,
      buildCheckpointWaitingMessage("Session completion recap")
    );
    renderDominantCheckpointConfidenceSignalStatuses();
    return;
  }

  setCheckpointFlowStatus(elements.sessionCompletionRecap, "session-recap", "success", state.lastSessionRecap.message);
  renderDominantCheckpointConfidenceSignalStatuses();
}

function renderDominantCheckpointConfidenceSignalStatuses() {
  const dominantSignalStatus = buildDominantCheckpointConfidenceSignalStatus();

  if (!dominantSignalStatus) {
    setCheckpointFlowStatus(
      elements.dominantConfidenceRecapStatus,
      "confidence-recap",
      null,
      buildCheckpointWaitingMessage("Dominant confidence signal")
    );
    setCheckpointFlowStatus(
      elements.dominantConfidenceNextActionStatus,
      "confidence-next-action",
      null,
      buildCheckpointWaitingMessage("Dominant confidence signal will guide the next action")
    );
    return;
  }

  setCheckpointFlowStatus(
    elements.dominantConfidenceRecapStatus,
    "confidence-recap",
    dominantSignalStatus.tone === "neutral" ? null : dominantSignalStatus.tone,
    `${dominantSignalStatus.recapShortMessage} ${dominantSignalStatus.recapMessage}`
  );
  setCheckpointFlowStatus(
    elements.dominantConfidenceNextActionStatus,
    "confidence-next-action",
    dominantSignalStatus.tone === "neutral" ? null : dominantSignalStatus.tone,
    `${dominantSignalStatus.nextActionShortMessage} ${dominantSignalStatus.nextActionMessage}`
  );
}

function buildCheckpointWaitingMessage(subject, trigger = "next finished session") {
  return `${subject} will appear after the ${trigger}.`;
}

function buildCheckpointHistoryEmptyMessage(activeFilter = "all") {
  if (activeFilter === "all") {
    return buildCheckpointWaitingMessage("Checkpoint history snapshots");
  }

  return `No ${formatCheckpointHistoryFilterLabel(activeFilter)} snapshots recorded yet.`;
}

function buildCheckpointDetailEmptyMessage(stickyPrefix = "") {
  return `${stickyPrefix ? `${stickyPrefix} ` : ""}Checkpoint detail will appear after you select a history snapshot.`;
}

function getCheckpointConfidenceTrendMeta(trend = "stable") {
  if (trend === "improved") {
    return {
      trend,
      emphasisTone: "confidence-rising",
      emphasisLabel: "Confidence rising",
      tone: "success",
      biasLabel: "Building",
      biasSummary: "Recent confidence improved, so this path is ready to push forward.",
      actionSuffix: "Confidence is improving on this route.",
      recapSummary: "This recap is reinforced by an improving confidence signal.",
      autoFocusMessage:
        "Checkpoint auto-focus: confidence improved, so focus moved to the active path summary."
    };
  }

  if (trend === "dropped") {
    return {
      trend,
      emphasisTone: "confidence-dropped",
      emphasisLabel: "Confidence dropped",
      tone: "warning",
      biasLabel: "Cautious",
      biasSummary: "Recent confidence dropped, so review the preset before launching.",
      actionSuffix: "Confidence dropped on the latest session, so review the preset carefully.",
      recapSummary: "This recap is being handled more cautiously because confidence dropped.",
      autoFocusMessage: "Checkpoint auto-focus: confidence dropped, so focus moved to checkpoint detail."
    };
  }

  return {
    trend: "stable",
    emphasisTone: "confidence-steady",
    emphasisLabel: "Confidence steady",
    tone: "neutral",
    biasLabel: "Steady",
    biasSummary: "Recent confidence held steady, so continue with the guided step.",
    actionSuffix: null,
    recapSummary: "This recap is supported by a steady confidence signal.",
    autoFocusMessage: null
  };
}

function buildCheckpointRecapCardEmphasis(pathType = "session") {
  const confidenceRecap = state.lastSessionRecap?.confidenceRecap ?? null;

  if (!confidenceRecap) {
    return null;
  }

  if (pathType !== "session" && confidenceRecap.pathType !== pathType) {
    return null;
  }

  const trendMeta = getCheckpointConfidenceTrendMeta(confidenceRecap.trend);

  return {
    tone: trendMeta.emphasisTone,
    label: trendMeta.emphasisLabel,
    summary: trendMeta.recapSummary
  };
}

function normalizeBadgeTone(tone = "neutral") {
  if (tone === "success") {
    return "success";
  }

  if (tone === "warning") {
    return "warning";
  }

  return "neutral";
}

function getConfidenceEmphasisBadgeTone(emphasisTone = "confidence-steady") {
  if (emphasisTone === "confidence-rising") {
    return "success";
  }

  if (emphasisTone === "confidence-dropped") {
    return "warning";
  }

  return "neutral";
}

function buildCheckpointRecapCards() {
  if (!state.lastSessionRecap) {
    return [];
  }

  const cards = [];
  const targetedPractice = state.dashboard?.targetedPractice ?? null;
  const recoveryStatus = targetedPractice?.recoveryProgressStatus ?? null;
  const sessionConfidenceReason = buildCheckpointConfidenceReason("session");
  const dominantConfidenceReasonGroup = buildDominantCheckpointConfidenceReasonGroup();
  const sessionConfidenceReasonGroup = buildAnnotatedCheckpointConfidenceReasonGroup(
    "session",
    dominantConfidenceReasonGroup
  );

  cards.push({
    title: "Session recap",
    emphasis: buildCheckpointRecapCardEmphasis("session"),
    confidenceReason: sessionConfidenceReason,
    confidenceReasonGroup: sessionConfidenceReasonGroup,
    badges: createCheckpointBadges({
      targetedPractice,
      unlockTransition: state.lastUnlockTransition,
      sessionRecap: state.lastSessionRecap
    }),
    detail: `${state.lastSessionRecap.pathContext ? `${state.lastSessionRecap.pathContext} ` : ""}Score ${state.lastSessionRecap.totalScore}, accuracy ${state.lastSessionRecap.accuracy}${
      state.lastSessionRecap.grade ? `, grade ${state.lastSessionRecap.grade}` : ""
    }. ${state.lastSessionRecap.progressionSummary}${state.lastSessionRecap.confidenceRecap?.summary ? ` ${state.lastSessionRecap.confidenceRecap.summary}` : ""}`
  });

  if (state.lastSessionRecap.confidenceRecap?.summary) {
    const confidenceReason = buildCheckpointConfidenceReason(
      state.lastSessionRecap.confidenceRecap.pathType ?? "session"
    );
    const confidenceReasonGroup = buildAnnotatedCheckpointConfidenceReasonGroup(
      state.lastSessionRecap.confidenceRecap.pathType ?? "session",
      dominantConfidenceReasonGroup
    );
    cards.push({
      title: "Confidence recap",
      emphasis: buildCheckpointRecapCardEmphasis(state.lastSessionRecap.confidenceRecap.pathType ?? "session"),
      confidenceReason,
      confidenceReasonGroup,
      badges: [
        {
          label: state.lastSessionRecap.confidenceRecap.label,
          tone: normalizeBadgeTone(state.lastSessionRecap.confidenceRecap.tone)
        }
      ],
      detail: state.lastSessionRecap.confidenceRecap.summary
    });
  }

  if (state.lastUnlockTransition?.hasNewUnlocks) {
    cards.push({
      title: "Unlock recap",
      emphasis: buildCheckpointRecapCardEmphasis("unlock"),
      confidenceReason: buildCheckpointConfidenceReason("unlock"),
      confidenceReasonGroup: buildAnnotatedCheckpointConfidenceReasonGroup("unlock", dominantConfidenceReasonGroup),
      badges: [{ label: "Unlock", tone: "success" }],
      detail: `Unlocked ${state.lastUnlockTransition.unlockedTrainingTitles.join(", ")}. Pick the new training or launch it directly from the action below.`
    });
  }

  if (
    recoveryStatus === "route-to-recovery" ||
    recoveryStatus === "keep-recovery"
  ) {
    cards.push({
      title: "Recovery recap",
      emphasis: buildCheckpointRecapCardEmphasis("recovery"),
      confidenceReason: buildCheckpointConfidenceReason("recovery"),
      confidenceReasonGroup: buildAnnotatedCheckpointConfidenceReasonGroup("recovery", dominantConfidenceReasonGroup),
      badges: createCheckpointBadges({ targetedPractice }),
      detail:
        targetedPractice?.recoveryTrainingTitle
          ? `Recovery route points to ${targetedPractice.recoveryTrainingTitle}${targetedPractice.practiceSectionLabel ? ` / ${targetedPractice.practiceSectionLabel}` : ""} at ${targetedPractice.suggestedTempoBpm} BPM. ${targetedPractice.recoveryReason ?? ""}`
          : targetedPractice?.nextStep ?? "Stay on the recovery path for the next guided session."
    });
  }

  if (
    recoveryStatus === "goal-ready" ||
    recoveryStatus === "return-monitoring" ||
    recoveryStatus === "return-confirmed" ||
    recoveryStatus === "full-chart-reintegration" ||
    recoveryStatus === "full-chart-reintegrated"
  ) {
    cards.push({
      title: recoveryStatus?.startsWith("full-chart") ? "Reintegration recap" : "Return recap",
      emphasis: buildCheckpointRecapCardEmphasis("return"),
      confidenceReason: buildCheckpointConfidenceReason("return"),
      confidenceReasonGroup: buildAnnotatedCheckpointConfidenceReasonGroup("return", dominantConfidenceReasonGroup),
      badges: createCheckpointBadges({ targetedPractice }),
      detail:
        recoveryStatus?.startsWith("full-chart")
          ? `Full-chart route is back on ${targetedPractice?.recommendedTrainingTitle} at ${targetedPractice?.suggestedTempoBpm} BPM. ${targetedPractice?.fullChartReintegrationRamp?.reason ?? targetedPractice?.nextStep ?? ""}`
          : `Return route targets ${targetedPractice?.recoveryGoalTrainingTitle ?? targetedPractice?.recommendedTrainingTitle}${targetedPractice?.recoveryGoalSectionLabel ? ` / ${targetedPractice.recoveryGoalSectionLabel}` : targetedPractice?.recommendedSectionLabel ? ` / ${targetedPractice.recommendedSectionLabel}` : ""}. ${targetedPractice?.nextStep ?? ""}`
    });
  }

  if (
    recoveryStatus?.startsWith("promotion-") ||
    recoveryStatus === "promotion-graduated"
  ) {
    cards.push({
      title: "Promotion recap",
      emphasis: buildCheckpointRecapCardEmphasis("promotion"),
      confidenceReason: buildCheckpointConfidenceReason("promotion"),
      confidenceReasonGroup: buildAnnotatedCheckpointConfidenceReasonGroup("promotion", dominantConfidenceReasonGroup),
      badges: createCheckpointBadges({ targetedPractice }),
      detail:
        targetedPractice?.promotionTargetTrainingTitle
          ? `Promotion flow points to ${targetedPractice.promotionTargetTrainingTitle} at ${targetedPractice.suggestedTempoBpm} BPM. ${targetedPractice.promotionTargetReason ?? targetedPractice.nextStep ?? ""}`
          : targetedPractice?.promotionChainGraduation?.reason ??
            targetedPractice?.promotionChain?.reason ??
            targetedPractice?.promotionRamp?.reason ??
            targetedPractice?.nextStep ??
            "Promotion flow is active for the next guided step."
    });
  }

  if (
    recoveryStatus === "terminal-training-mastery" ||
    recoveryStatus === "terminal-training-mastered" ||
    recoveryStatus === "terminal-mastery-graduated"
  ) {
    cards.push({
      title: "Mastery recap",
      emphasis: buildCheckpointRecapCardEmphasis("mastery"),
      confidenceReason: buildCheckpointConfidenceReason("mastery"),
      confidenceReasonGroup: buildAnnotatedCheckpointConfidenceReasonGroup("mastery", dominantConfidenceReasonGroup),
      badges: createCheckpointBadges({ targetedPractice }),
      detail:
        targetedPractice?.terminalMasteryGraduation
          ? `Terminal mastery route is ${targetedPractice.terminalMasteryGraduation.mode} on ${targetedPractice.terminalMasteryGraduation.targetTrainingTitle} at ${targetedPractice.terminalMasteryGraduation.targetTempoBpm} BPM. ${targetedPractice.terminalMasteryGraduation.reason}`
          : targetedPractice?.nextStep ??
            "Terminal mastery is active. Keep reinforcing the final training track."
    });
  }

  return cards.slice(0, 4);
}

function renderCheckpointRecapCards() {
  const cards = buildCheckpointRecapCards();

  if (cards.length === 0) {
    elements.progressionCheckpointRecaps.innerHTML = `
      <article class="checkpoint-recap-card checkpoint-recap-empty">
        <strong>Checkpoint recap</strong>
        <p>Checkpoint recap cards will appear after the next finished session.</p>
      </article>
    `;
    return;
  }

  elements.progressionCheckpointRecaps.innerHTML = cards
    .map(
      (card) => `
        <article class="checkpoint-recap-card${
          card.emphasis?.tone ? ` checkpoint-recap-card-${card.emphasis.tone}` : ""
        }">
          ${
            card.emphasis?.label
              ? `<div class="badge-row"><span class="badge badge-small badge-${getConfidenceEmphasisBadgeTone(
                  card.emphasis.tone
                )} checkpoint-recap-emphasis-badge checkpoint-recap-emphasis-badge-${escapeHtml(
                  card.emphasis.tone
                )}">${escapeHtml(card.emphasis.label)}</span></div>`
              : ""
          }
          ${renderCheckpointBadgeRow(card.badges)}
          <strong>${escapeHtml(card.title)}</strong>
          <p>${escapeHtml(card.detail)}</p>
          ${
            card.confidenceReason
              ? `<p class="checkpoint-recap-confidence-reason checkpoint-recap-confidence-reason-${escapeHtml(
                  card.confidenceReason.tone === "warning" ? "warning" : card.confidenceReason.tone ?? "neutral"
                )}">${escapeHtml(card.confidenceReason.label)}: ${escapeHtml(card.confidenceReason.detail)}</p>`
              : ""
          }
          ${
            card.confidenceReasonGroup
              ? `<p class="checkpoint-recap-confidence-group">${escapeHtml(
                  buildCheckpointConfidenceGroupMessage(card.confidenceReasonGroup, { surface: "recap" })
                )}</p>`
              : ""
          }
          ${
            card.emphasis?.summary
              ? `<p class="checkpoint-recap-emphasis-copy checkpoint-recap-emphasis-copy-${escapeHtml(card.emphasis.tone)}">${escapeHtml(
                  card.emphasis.summary
                )}</p>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function createCheckpointSnapshotRecord() {
  if (!state.lastSessionRecap) {
    return null;
  }

  const targetedPractice = state.dashboard?.targetedPractice ?? null;
  const recoveryStatus = targetedPractice?.recoveryProgressStatus ?? null;
  const summaryParts = [
    `Score ${state.lastSessionRecap.totalScore}`,
    `accuracy ${state.lastSessionRecap.accuracy}`
  ];

  if (state.lastSessionRecap.grade) {
    summaryParts.push(`grade ${state.lastSessionRecap.grade}`);
  }

  const highlights = [summaryParts.join(", ")];

  if (state.lastUnlockTransition?.hasNewUnlocks) {
    highlights.push(`Unlocked ${state.lastUnlockTransition.unlockedTrainingTitles.join(", ")}`);
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
    highlights.push(`Reintegration -> ${targetedPractice?.recommendedTrainingTitle ?? "goal chart"}`);
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

  if (state.lastSessionRecap.nextStep) {
    highlights.push(state.lastSessionRecap.nextStep);
  }

  return {
    sessionId: state.lastSessionRecap.sessionId,
    title: `Session ${state.lastSessionRecap.sessionId}`,
    badges: createCheckpointBadges({
      targetedPractice,
      unlockTransition: state.lastUnlockTransition,
      sessionRecap: state.lastSessionRecap
    }),
    highlights: highlights.slice(0, 3)
  };
}

function recordCheckpointSnapshot() {
  const snapshot = createCheckpointSnapshotRecord();

  if (!snapshot) {
    return;
  }

  state.progressionCheckpointSnapshots = [
    snapshot,
    ...state.progressionCheckpointSnapshots.filter((entry) => entry.sessionId !== snapshot.sessionId)
  ].slice(0, 3);
}

function formatCheckpointHistoryFilterLabel(filterValue) {
  if (filterValue === "unlock") {
    return "unlock";
  }

  if (filterValue === "recovery") {
    return "recovery";
  }

  if (filterValue === "return") {
    return "return";
  }

  if (filterValue === "promotion") {
    return "promotion";
  }

  if (filterValue === "mastery") {
    return "mastery";
  }

  return "checkpoint";
}

function formatCheckpointHistoryGroupLabel(type) {
  if (type === "unlock") {
    return "Unlock path";
  }

  if (type === "recovery") {
    return "Recovery path";
  }

  if (type === "return") {
    return "Return path";
  }

  if (type === "promotion") {
    return "Promotion path";
  }

  if (type === "mastery") {
    return "Mastery path";
  }

  return "General path";
}

function resolvePrimaryCheckpointPathType() {
  if (state.lastUnlockTransition?.hasNewUnlocks) {
    return "unlock";
  }

  const status = state.dashboard?.targetedPractice?.recoveryProgressStatus ?? null;

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

  if (status?.startsWith("promotion-") || status === "promotion-graduated") {
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

function getFilteredCheckpointSnapshots() {
  const activeFilter = state.progressionCheckpointFilter ?? "all";

  return activeFilter === "all"
    ? state.progressionCheckpointSnapshots
    : state.progressionCheckpointSnapshots.filter((snapshot) => snapshot.type === activeFilter);
}

function groupCheckpointSnapshotsByType(snapshots) {
  const orderedTypes = ["unlock", "recovery", "return", "promotion", "mastery", "general"];
  const grouped = new Map();

  for (const snapshot of snapshots) {
    const groupType = snapshot.type ?? "general";
    const currentGroup = grouped.get(groupType) ?? [];
    currentGroup.push(snapshot);
    grouped.set(groupType, currentGroup);
  }

  return orderedTypes
    .filter((type) => grouped.has(type))
    .map((type) => ({
      type,
      label: formatCheckpointHistoryGroupLabel(type),
      snapshots: grouped.get(type)
    }));
}

function buildCheckpointPathSummaryCards() {
  const groupedSnapshots = groupCheckpointSnapshotsByType(state.progressionCheckpointSnapshots);
  const primaryType = resolvePrimaryCheckpointPathType();
  const primaryNextAction = getProgressionNextAction();
  const primaryPresetPreview = buildCheckpointPathSessionPresetPreview(primaryNextAction);
  const primaryConfidenceBias = getCheckpointConfidenceActionBias(primaryType);

  return groupedSnapshots
    .map((group) => {
      const latestSnapshot = group.snapshots[0];
      const latestDetail = latestSnapshot?.detail ?? {};
      const isPrimary = group.type === primaryType;
      const confidenceBias = isPrimary ? primaryConfidenceBias : null;
      const confidenceTrendMeta = isPrimary
        ? getCheckpointConfidenceTrendMeta(confidenceBias?.trend)
        : null;

      return {
        type: group.type,
        label: group.label,
        isPrimary,
        emphasisTone: isPrimary ? confidenceTrendMeta.emphasisTone : "default",
        emphasisLabel: isPrimary ? confidenceTrendMeta.emphasisLabel : null,
        isCollapsed:
          state.checkpointPathCollapse.active &&
          state.checkpointPathCollapse.focusPathType === primaryType &&
          !isPrimary,
        snapshotCount: group.snapshots.length,
        latestTitle: latestSnapshot?.title ?? "No checkpoint yet",
        latestStatus:
          latestDetail.reason ??
          latestDetail.nextStep ??
          latestSnapshot?.highlights?.[0] ??
          "No checkpoint status recorded yet.",
        actionHint: formatCheckpointPathActionHint({
          type: group.type,
          isPrimary,
          confidenceBias
        }),
        actionLabel: isPrimary && primaryNextAction ? primaryNextAction.label : null,
        actionDisabled: isPrimary ? Boolean(primaryNextAction?.disabled) : true,
        presetPreview: isPrimary ? primaryPresetPreview : null,
        feedback:
          isPrimary && state.checkpointPathActionFeedback?.pathType === group.type
            ? state.checkpointPathActionFeedback
            : null
      };
    })
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
}

function getCheckpointPathActionBaseHint(type, isPrimary) {
  const routeHints = {
    unlock: isPrimary
      ? canStartLatestUnlockedTraining()
        ? "Suggested action: start the unlocked training now."
        : "Suggested action: select the unlocked training and prefill the session."
      : "Suggested action: review the latest unlock path checkpoint.",
    recovery: isPrimary
      ? "Suggested action: resume the recovery route now."
      : "Suggested action: review the recovery path and its latest checkpoint.",
    return: isPrimary
      ? "Suggested action: return to the goal chart now."
      : "Suggested action: inspect the return path before resuming it.",
    promotion: isPrimary
      ? "Suggested action: continue the promotion route now."
      : "Suggested action: review the promotion path before the next tempo step.",
    mastery: isPrimary
      ? "Suggested action: maintain the mastery route now."
      : "Suggested action: inspect the mastery path and latest checkpoint."
  };

  return routeHints[type] ?? "Suggested action: review the latest checkpoint on this path.";
}

function formatCheckpointPathActionHint({ type, isPrimary, confidenceBias = null }) {
  const confidenceTrendMeta = getCheckpointConfidenceTrendMeta(confidenceBias?.trend);
  const confidenceSuffix = confidenceTrendMeta.actionSuffix
    ? ` ${confidenceTrendMeta.actionSuffix}`
    : "";
  const baseHint = getCheckpointPathActionBaseHint(type, isPrimary);
  return `${baseHint}${confidenceSuffix}`;
}

function renderCheckpointPathAction(card) {
  if (!card.isPrimary || !card.actionLabel) {
    return "";
  }

  return `
    <button
      type="button"
      class="button button-primary checkpoint-path-action-button"
      data-checkpoint-path-action="run"
      data-checkpoint-path-type="${escapeHtml(card.type)}"
      ${card.actionDisabled ? "disabled" : ""}
    >
      ${escapeHtml(card.actionLabel)}
    </button>
  `;
}

function renderCheckpointPathActionFeedback(card) {
  if (!card.feedback?.message) {
    return "";
  }

  return `
    <p class="checkpoint-path-feedback checkpoint-path-feedback-${escapeHtml(card.feedback.variant ?? "info")}">
      ${escapeHtml(card.feedback.message)}
    </p>
  `;
}

function renderCheckpointPathPresetPreview(card) {
  if (!card.presetPreview?.summary || card.isCollapsed) {
    return "";
  }

  const presetDiff = buildSessionPresetDiff(card.presetPreview);
  const confidence = buildCheckpointPathPresetConfidence(
    card.actionLabel ? getProgressionNextAction() : null,
    card.presetPreview
  );
  const confidenceHistory = buildCheckpointPathConfidenceHistory(card.type);
  const confidenceReason = buildCheckpointConfidenceReason(card.type);
  const confidenceReasonGroup = buildCheckpointConfidenceReasonGroup(card.type);
  const dominantConfidenceReasonGroup = buildDominantCheckpointConfidenceReasonGroup();
  const isDominantConfidenceGroup =
    confidenceReasonGroup &&
    dominantConfidenceReasonGroup &&
    confidenceReasonGroup.key === dominantConfidenceReasonGroup.key &&
    confidenceReasonGroup.pathType === dominantConfidenceReasonGroup.pathType;

  return `
    <div class="checkpoint-path-preset-preview">
      <strong>Preset preview</strong>
      <p>${escapeHtml(card.presetPreview.summary)}</p>
      ${
        confidence
          ? `<p class="checkpoint-path-preset-confidence checkpoint-path-preset-confidence-${escapeHtml(
              confidence.tone ?? "neutral"
            )}">Preset confidence: ${escapeHtml(confidence.label)}. ${escapeHtml(confidence.reason)}</p>`
          : ""
      }
      ${
        confidenceHistory
          ? `<p class="checkpoint-path-confidence-history checkpoint-path-confidence-history-${escapeHtml(
              confidenceHistory.trend
            )}">Confidence history: ${escapeHtml(confidenceHistory.summary)}</p>
             <ul class="checkpoint-path-confidence-history-list">${confidenceHistory.entries
               .map(
                 (entry) =>
                   `<li class="checkpoint-path-confidence-history-entry${
                     entry.sessionId === state.selectedCheckpointSnapshotSessionId ? " is-active" : ""
                   }" data-checkpoint-confidence-session-id="${escapeHtml(entry.sessionId)}" data-checkpoint-confidence-path-type="${escapeHtml(
                     confidenceHistory.pathType
                   )}"><strong>${escapeHtml(entry.label)}</strong> ${escapeHtml(entry.title)}. ${escapeHtml(entry.reason)}</li>`
               )
               .join("")}</ul>`
          : ""
      }
      ${
        confidenceReason
          ? `<p class="checkpoint-path-confidence-reason checkpoint-path-confidence-reason-${escapeHtml(
              confidenceReason.tone === "warning" ? "warning" : confidenceReason.tone ?? "neutral"
            )}">${escapeHtml(confidenceReason.label)}: ${escapeHtml(confidenceReason.detail)}</p>`
          : ""
      }
      ${
        confidenceReasonGroup
          ? `<p class="checkpoint-path-confidence-group">${escapeHtml(
              buildCheckpointConfidenceGroupMessage(
                {
                  ...confidenceReasonGroup,
                  isDominant: isDominantConfidenceGroup
                },
                { surface: "route" }
              )
            )}</p>`
          : ""
      }
      ${
        presetDiff.length > 0
          ? `<p class="checkpoint-path-preset-diff-label">Preset diff</p>
             <ul class="checkpoint-path-preset-diff-list">${presetDiff
               .map((change) => `<li>${escapeHtml(change)}</li>`)
               .join("")}</ul>`
          : '<p class="checkpoint-path-preset-diff-label">Preset diff: session form already matches this path.</p>'
      }
    </div>
  `;
}

function buildCheckpointPathActionFeedback({ pathType, actionResult }) {
  if (!actionResult?.ok) {
    return {
      pathType,
      variant: "error",
      message: "Path action did not complete. Check the session status above."
    };
  }

  if (actionResult.key === "select-unlocked-training") {
    return {
      pathType,
      variant: "success",
      message: "Path action applied: unlocked training selected and the session form is ready."
    };
  }

  if (actionResult.key === "apply-guided-practice") {
    return {
      pathType,
      variant: "success",
      message: "Path action applied: guided preset loaded into the session form."
    };
  }

  if (actionResult.key === "start-unlocked-training" || actionResult.key === "start-guided-practice") {
    return actionResult.sessionStarted
      ? {
          pathType,
          variant: "success",
          message: "Path action applied: session started from this checkpoint path."
        }
      : {
          pathType,
          variant: "error",
          message: "Path action attempted to start a session, but it did not launch. Check the session status above."
        };
  }

  return {
    pathType,
    variant: "success",
    message: "Path action applied."
  };
}

function buildCheckpointPathHandoff({ pathType, actionResult }) {
  const handoff = buildProgressionActionHandoff(actionResult);

  if (!actionResult?.ok) {
    return {
      pathType,
      variant: "error",
      focusTarget: handoff.focusTarget,
      message: buildProgressionActionHandoffMessage(handoff, { surface: "path" })
    };
  }

  if (actionResult.sessionStarted) {
    return {
      pathType,
      variant: "success",
      focusTarget: handoff.focusTarget,
      message: buildProgressionActionHandoffMessage(handoff, { surface: "path" })
    };
  }

  return {
    pathType,
    variant: "success",
    focusTarget: handoff.focusTarget,
    message: buildProgressionActionHandoffMessage(handoff, { surface: "path" })
  };
}

function renderCheckpointPathHandoffStatus() {
  if (!state.checkpointPathHandoff?.message) {
    setCheckpointFlowStatus(
      elements.checkpointPathHandoffStatus,
      "path-handoff",
      null,
      buildCheckpointWaitingMessage("Checkpoint path handoff", "next successful path action")
    );
    return;
  }

  setCheckpointFlowStatus(
    elements.checkpointPathHandoffStatus,
    "path-handoff",
    state.checkpointPathHandoff.variant ?? "success",
    state.checkpointPathHandoff.message
  );
}

function renderCheckpointPathCollapseToggle() {
  const hasCollapsedPaths =
    state.checkpointPathCollapse.active &&
    buildCheckpointPathSummaryCards().some((card) => card.isCollapsed);

  elements.checkpointPathCollapseToggle.disabled = !hasCollapsedPaths;
  elements.checkpointPathCollapseToggle.textContent = hasCollapsedPaths
    ? "Show all checkpoint paths"
    : "All checkpoint paths visible";
}

function buildCheckpointPathAutoFocus(sessionId) {
  const confidenceRecap = state.lastSessionRecap?.confidenceRecap ?? null;

  if (!confidenceRecap?.pathType) {
    return null;
  }

  const trendMeta = getCheckpointConfidenceTrendMeta(confidenceRecap.trend);

  if (confidenceRecap.trend === "improved" || confidenceRecap.trend === "dropped") {
    return {
      sessionId,
      pathType: confidenceRecap.pathType,
      trend: confidenceRecap.trend,
      focusTarget: confidenceRecap.trend === "improved" ? "checkpoint-summary" : "checkpoint-detail",
      pending: true,
      message: trendMeta.autoFocusMessage
    };
  }

  return null;
}

function applyCheckpointPathAutoFocusState() {
  const autoFocus = state.checkpointPathAutoFocus;

  if (!autoFocus?.pending || !autoFocus.pathType) {
    return;
  }

  state.progressionCheckpointFilter = autoFocus.pathType;
  state.checkpointPathCollapse = {
    active: true,
    focusPathType: autoFocus.pathType
  };
  elements.progressionCheckpointFilter.value = autoFocus.pathType;

  const nextSnapshots = state.progressionCheckpointSnapshots.filter(
    (snapshot) => snapshot.type === autoFocus.pathType
  );
  state.selectedCheckpointSnapshotSessionId =
    nextSnapshots.find((snapshot) => snapshot.sessionId === autoFocus.sessionId)?.sessionId ??
    nextSnapshots[0]?.sessionId ??
    null;
}

function focusCheckpointPathHandoff(actionResult) {
  focusCheckpointFlowStatusCard("path-handoff");

  const focusTarget =
    state.checkpointPathHandoff?.focusTarget === "session-status"
      ? elements.sessionStatus
      : elements.progressionCheckpointDetail;

  if (!focusTarget || typeof focusTarget.scrollIntoView !== "function") {
    return;
  }

  focusTarget.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function focusCheckpointPathAutoFocus() {
  const autoFocus = state.checkpointPathAutoFocus;

  if (!autoFocus?.pending) {
    return;
  }

  const focusTarget =
    autoFocus.focusTarget === "checkpoint-summary"
      ? elements.checkpointPathSummaryCards
      : elements.progressionCheckpointDetail;

  focusCheckpointFlowStatusCard(
    autoFocus.focusTarget === "checkpoint-summary" ? "session-recap" : "checkpoint-detail"
  );

  if (focusTarget && typeof focusTarget.scrollIntoView === "function") {
    focusTarget.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  if (autoFocus.message) {
    pushEventLog("Checkpoint auto-focus", autoFocus.message);
  }

  state.checkpointPathAutoFocus = {
    ...autoFocus,
    pending: false
  };
}

function syncSelectedCheckpointSnapshot() {
  const filteredSnapshots = getFilteredCheckpointSnapshots();

  if (filteredSnapshots.length === 0) {
    state.selectedCheckpointSnapshotSessionId = null;
    return;
  }

  if (
    filteredSnapshots.some((snapshot) => snapshot.sessionId === state.selectedCheckpointSnapshotSessionId)
  ) {
    return;
  }

  state.selectedCheckpointSnapshotSessionId = filteredSnapshots[0].sessionId;
}

function getStickyCheckpointPathType() {
  if (state.checkpointPathCollapse.active && state.checkpointPathCollapse.focusPathType) {
    return state.checkpointPathCollapse.focusPathType;
  }

  if (state.progressionCheckpointFilter && state.progressionCheckpointFilter !== "all") {
    return state.progressionCheckpointFilter;
  }

  return resolvePrimaryCheckpointPathType();
}

function getStickyCheckpointPathLabel() {
  const stickyPathType = getStickyCheckpointPathType();
  return stickyPathType ? formatCheckpointHistoryGroupLabel(stickyPathType) : null;
}

function buildCheckpointPathContextText(prefix = "Path focus") {
  const stickyPathLabel = getStickyCheckpointPathLabel();
  return stickyPathLabel ? `${prefix}: ${stickyPathLabel}.` : null;
}

function buildStickyCheckpointDetailPrefix() {
  return buildCheckpointPathContextText("Sticky focus");
}

function findTrainingSectionLabel(training, sectionId) {
  if (!training?.chart?.sections?.length || !sectionId) {
    return null;
  }

  return training.chart.sections.find((section) => section.id === sectionId)?.label ?? null;
}

function buildTrainingSessionPresetPreview(training, { targetedPractice = null, actionLabel = null, source = null } = {}) {
  if (!training) {
    return null;
  }

  const usesTargetedPractice =
    targetedPractice &&
    targetedPractice.recommendedTrainingId === training.id;
  const practiceScope = usesTargetedPractice
    ? targetedPractice.practiceScopeOverride ??
      (targetedPractice.sectionAction === "loop-section" && targetedPractice.recommendedSectionId
        ? "section-loop"
        : "full-chart")
    : "full-chart";
  const loopSectionId = usesTargetedPractice
    ? targetedPractice.practiceSectionId ?? targetedPractice.recommendedSectionId ?? null
    : null;
  const loopSectionLabel = usesTargetedPractice
    ? targetedPractice.practiceSectionLabel ??
      targetedPractice.recommendedSectionLabel ??
      findTrainingSectionLabel(training, loopSectionId)
    : null;
  const tempoBpm = usesTargetedPractice ? targetedPractice.suggestedTempoBpm ?? training.tempoBpm : training.tempoBpm;
  const loopRepetitionCount = practiceScope === "section-loop" ? targetedPractice?.loopRepetitionCount ?? 1 : null;
  const loopTempoStepBpm = practiceScope === "section-loop" ? targetedPractice?.loopTempoStepBpm ?? 0 : null;

  return {
    trainingId: training.id,
    trainingTitle: training.title,
    practiceScope,
    loopSectionId,
    loopSectionLabel,
    tempoBpm,
    loopRepetitionCount,
    loopTempoStepBpm,
    actionLabel,
    source,
    summary: `${training.title}: ${
      practiceScope === "section-loop"
        ? `section loop ${loopSectionLabel ?? loopSectionId ?? "selected section"}`
        : "full chart"
    } at ${tempoBpm} BPM${
      practiceScope === "section-loop"
        ? `, ${loopRepetitionCount} rep(s)${loopTempoStepBpm ? `, +${loopTempoStepBpm} BPM per rep` : ""}`
        : ""
    }.`
  };
}

function buildCheckpointPathSessionPresetPreview(nextAction = null) {
  const resolvedNextAction = nextAction ?? getProgressionNextAction();

  if (!resolvedNextAction || resolvedNextAction.disabled) {
    return null;
  }

  if (
    resolvedNextAction.key === "select-unlocked-training" ||
    resolvedNextAction.key === "start-unlocked-training"
  ) {
    const latestUnlockedTraining = getLatestUnlockedTraining();
    const targetedPractice =
      state.dashboard?.targetedPractice?.recommendedTrainingId === latestUnlockedTraining?.id
        ? state.dashboard?.targetedPractice
        : null;

    return buildTrainingSessionPresetPreview(latestUnlockedTraining, {
      targetedPractice,
      actionLabel: resolvedNextAction.label,
      source: targetedPractice ? "unlock-targeted" : "unlock-default"
    });
  }

  if (
    resolvedNextAction.key === "apply-guided-practice" ||
    resolvedNextAction.key === "start-guided-practice"
  ) {
    const targetedPractice = state.dashboard?.targetedPractice ?? null;
    const training =
      state.trainings.find((candidate) => candidate.id === targetedPractice?.recommendedTrainingId) ?? null;

    return buildTrainingSessionPresetPreview(training, {
      targetedPractice,
      actionLabel: resolvedNextAction.label,
      source: "guided"
    });
  }

  return null;
}

function buildCurrentSessionPresetPreview() {
  const selectedTraining = getSelectedTraining();

  if (!selectedTraining) {
    return null;
  }

  return {
    trainingId: selectedTraining.id,
    trainingTitle: selectedTraining.title,
    practiceScope: elements.practiceScope.value,
    loopSectionId: elements.practiceScope.value === "section-loop" ? elements.loopSectionId.value || null : null,
    loopSectionLabel:
      elements.practiceScope.value === "section-loop"
        ? findTrainingSectionLabel(selectedTraining, elements.loopSectionId.value) ?? elements.loopSectionId.value
        : null,
    tempoBpm: Number(elements.sessionTempoBpm.value),
    loopRepetitionCount:
      elements.practiceScope.value === "section-loop" ? Number(elements.loopRepetitionCount.value) : null,
    loopTempoStepBpm:
      elements.practiceScope.value === "section-loop" ? Number(elements.loopTempoStepBpm.value) : null
  };
}

function buildSessionPresetDiff(preview, currentPreview = buildCurrentSessionPresetPreview()) {
  if (!preview || !currentPreview) {
    return [];
  }

  const changes = [];

  if (preview.trainingId !== currentPreview.trainingId) {
    changes.push(`Training: ${currentPreview.trainingTitle} -> ${preview.trainingTitle}`);
  }

  if (preview.practiceScope !== currentPreview.practiceScope) {
    changes.push(`Scope: ${currentPreview.practiceScope} -> ${preview.practiceScope}`);
  }

  if ((preview.loopSectionLabel ?? preview.loopSectionId ?? null) !== (currentPreview.loopSectionLabel ?? currentPreview.loopSectionId ?? null)) {
    if (preview.practiceScope === "section-loop" || currentPreview.practiceScope === "section-loop") {
      changes.push(
        `Section: ${currentPreview.loopSectionLabel ?? currentPreview.loopSectionId ?? "none"} -> ${preview.loopSectionLabel ?? preview.loopSectionId ?? "none"}`
      );
    }
  }

  if (preview.tempoBpm !== currentPreview.tempoBpm) {
    changes.push(`Tempo: ${currentPreview.tempoBpm} BPM -> ${preview.tempoBpm} BPM`);
  }

  if ((preview.loopRepetitionCount ?? null) !== (currentPreview.loopRepetitionCount ?? null)) {
    if (preview.practiceScope === "section-loop" || currentPreview.practiceScope === "section-loop") {
      changes.push(`Repetitions: ${currentPreview.loopRepetitionCount ?? 1} -> ${preview.loopRepetitionCount ?? 1}`);
    }
  }

  if ((preview.loopTempoStepBpm ?? null) !== (currentPreview.loopTempoStepBpm ?? null)) {
    if (preview.practiceScope === "section-loop" || currentPreview.practiceScope === "section-loop") {
      changes.push(`Tempo step: ${currentPreview.loopTempoStepBpm ?? 0} BPM -> ${preview.loopTempoStepBpm ?? 0} BPM`);
    }
  }

  return changes;
}

function buildCheckpointPathPresetConfidence(nextAction, preview) {
  if (!nextAction || nextAction.disabled || !preview) {
    return null;
  }

  const targetedPractice = state.dashboard?.targetedPractice ?? null;
  const pathType = getStickyCheckpointPathType();
  const recoveryStatus = targetedPractice?.recoveryProgressStatus ?? null;

  if (pathType === "unlock" && state.lastUnlockTransition?.hasNewUnlocks) {
    return {
      label: "High",
      tone: "success",
      reason: "Preset points directly to a freshly unlocked training and uses the current unlock route."
    };
  }

  if (pathType === "recovery") {
    const stableCount = targetedPractice?.recoveryMilestone?.stableSessionCount ?? 0;
    const requiredCount = targetedPractice?.recoveryMilestone?.requiredStableSessions ?? 0;

    return stableCount > 0
      ? {
          label: "High",
          tone: "success",
          reason: `Recovery route is backed by ${stableCount}/${requiredCount} stable recovery session(s).`
        }
      : {
          label: "Medium",
          tone: "neutral",
          reason: "Recovery route is active, but it is still building stable evidence."
        };
  }

  if (pathType === "return") {
    if (recoveryStatus === "return-confirmed" || recoveryStatus === "full-chart-reintegrated") {
      return {
        label: "High",
        tone: "success",
        reason: "Return path is already confirmed by the current progression milestone."
      };
    }

    if (targetedPractice?.returnMilestone || targetedPractice?.fullChartReintegrationMilestone) {
      return {
        label: "Medium",
        tone: "neutral",
        reason: "Return path is in validation and already has milestone tracking behind it."
      };
    }
  }

  if (pathType === "promotion") {
    if (
      recoveryStatus === "promotion-ramp-confirmed" ||
      recoveryStatus === "promotion-chain-confirmed" ||
      recoveryStatus === "promotion-chain-graduation-confirmed" ||
      recoveryStatus === "promotion-reentry-confirmed"
    ) {
      return {
        label: "High",
        tone: "success",
        reason: "Promotion path is backed by confirmed promotion milestones on this route."
      };
    }

    if (
      targetedPractice?.promotionLandingMilestone ||
      targetedPractice?.promotionRampMilestone ||
      targetedPractice?.promotionTrackMilestone ||
      targetedPractice?.promotionChainMilestone
    ) {
      return {
        label: "Medium",
        tone: "neutral",
        reason: "Promotion path is guided by active milestone tracking, but it is not fully confirmed yet."
      };
    }
  }

  if (pathType === "mastery") {
    if (
      recoveryStatus === "terminal-training-mastered" ||
      recoveryStatus === "terminal-mastery-graduated" ||
      targetedPractice?.terminalMasteryGraduation
    ) {
      return {
        label: "High",
        tone: "success",
        reason: "Mastery path is driven by the terminal mastery track and an already validated terminal route."
      };
    }

    if (targetedPractice?.terminalTrainingMasteryTrack) {
      return {
        label: "Medium",
        tone: "neutral",
        reason: "Mastery path is grounded in the terminal mastery track, but the final tier is still in progress."
      };
    }
  }

  return {
    label: "Medium",
    tone: "neutral",
    reason: "Preset is aligned with the current guided path, but it still behaves like a heuristic recommendation."
  };
}

function assessCheckpointSnapshotConfidence(snapshot) {
  const labels = (snapshot?.badges ?? []).map((badge) => badge.label);
  const type = snapshot?.type ?? "general";

  const hasAnyLabel = (...expectedLabels) => expectedLabels.some((label) => labels.includes(label));

  if (
    hasAnyLabel(
      "Unlock",
      "Return Confirmed",
      "Full Chart Back",
      "Promotion Landed",
      "Ramp Confirmed",
      "Chain Confirmed",
      "Chain Graduated",
      "Terminal Mastery"
    )
  ) {
    return {
      label: "High",
      tone: "success",
      score: 3
    };
  }

  if (hasAnyLabel("Return Ready")) {
    return {
      label: "Medium",
      tone: "neutral",
      score: 2
    };
  }

  if (type === "unlock" || type === "recovery" || type === "return" || type === "promotion" || type === "mastery") {
    return {
      label: "Medium",
      tone: "neutral",
      score: 2
    };
  }

  return {
    label: "Low",
    tone: "neutral",
    score: 1
  };
}

function buildCheckpointPathConfidenceHistory(pathType = getStickyCheckpointPathType()) {
  if (!pathType) {
    return null;
  }

  const historyEntries = state.progressionCheckpointSnapshots
    .filter((snapshot) => snapshot.type === pathType)
    .slice(0, 3)
    .map((snapshot) => {
      const confidence = assessCheckpointSnapshotConfidence(snapshot);
      return {
        sessionId: snapshot.sessionId,
        title: snapshot.title,
        label: confidence.label,
        tone: confidence.tone,
        score: confidence.score,
        reason: snapshot.detail?.reason ?? snapshot.highlights?.[1] ?? snapshot.highlights?.[0] ?? "Checkpoint updated."
      };
    });

  if (historyEntries.length === 0) {
    return null;
  }

  const firstScore = historyEntries[0].score;
  const lastScore = historyEntries[historyEntries.length - 1].score;
  const trend =
    historyEntries.length === 1
      ? "single-snapshot"
      : firstScore > lastScore
        ? "rising"
        : firstScore < lastScore
          ? "falling"
          : "stable";

  return {
    pathType,
    trend,
    entries: historyEntries,
    summary: buildCheckpointConfidenceHistorySummary(trend, historyEntries.length)
  };
}

function buildCheckpointPathConfidenceRecap(sessionId, pathType = getStickyCheckpointPathType()) {
  const history = buildCheckpointPathConfidenceHistory(pathType);

  if (!history?.entries?.length) {
    return null;
  }

  const latestEntry = history.entries[0];
  const previousEntry = history.entries[1] ?? null;
  const pathLabel = formatCheckpointHistoryGroupLabel(pathType);

  if (latestEntry.sessionId !== sessionId) {
    return {
      pathType,
      label: latestEntry.label,
      tone: latestEntry.tone,
      trend: history.trend,
      summary: buildCheckpointConfidenceRecapSummary({
        pathLabel,
        trend: history.trend,
        latestLabel: latestEntry.label,
        historySummary: history.summary
      })
    };
  }

  if (!previousEntry) {
    return {
      pathType,
      label: latestEntry.label,
      tone: latestEntry.tone,
      trend: "opened",
      summary: buildCheckpointConfidenceRecapSummary({
        pathLabel,
        trend: "opened",
        latestLabel: latestEntry.label,
        reason: latestEntry.reason
      })
    };
  }

  if (latestEntry.score > previousEntry.score) {
    return {
      pathType,
      label: latestEntry.label,
      tone: "success",
      trend: "improved",
      summary: buildCheckpointConfidenceRecapSummary({
        pathLabel,
        trend: "improved",
        latestLabel: latestEntry.label,
        previousLabel: previousEntry.label,
        reason: latestEntry.reason
      })
    };
  }

  if (latestEntry.score < previousEntry.score) {
    return {
      pathType,
      label: latestEntry.label,
      tone: "warning",
      trend: "dropped",
      summary: buildCheckpointConfidenceRecapSummary({
        pathLabel,
        trend: "dropped",
        latestLabel: latestEntry.label,
        previousLabel: previousEntry.label,
        reason: latestEntry.reason
      })
    };
  }

  return {
    pathType,
    label: latestEntry.label,
    tone: latestEntry.tone,
    trend: "stable",
    summary: buildCheckpointConfidenceRecapSummary({
      pathLabel,
      trend: "stable",
      latestLabel: latestEntry.label,
      previousLabel: previousEntry.label,
      reason: latestEntry.reason
    })
  };
}

function buildCheckpointConfidenceReason(pathType = getStickyCheckpointPathType()) {
  const confidenceRecap =
    state.lastSessionRecap?.confidenceRecap?.pathType === pathType
      ? state.lastSessionRecap.confidenceRecap
      : null;
  const confidenceHistory = buildCheckpointPathConfidenceHistory(pathType);
  const latestEntry = confidenceHistory?.entries?.[0] ?? null;
  const reasonDetail = latestEntry?.reason ?? null;

  if (!confidenceRecap || !reasonDetail) {
    return null;
  }

  if (confidenceRecap.trend === "improved") {
    return {
      pathType,
      tone: "success",
      label: getCheckpointConfidenceReasonLabel(confidenceRecap.trend),
      detail: reasonDetail
    };
  }

  if (confidenceRecap.trend === "dropped") {
    return {
      pathType,
      tone: "warning",
      label: getCheckpointConfidenceReasonLabel(confidenceRecap.trend),
      detail: reasonDetail
    };
  }

  if (confidenceRecap.trend === "opened") {
    return {
      pathType,
      tone: confidenceRecap.tone ?? "neutral",
      label: getCheckpointConfidenceReasonLabel(confidenceRecap.trend),
      detail: reasonDetail
    };
  }

  return {
    pathType,
    tone: confidenceRecap.tone ?? "neutral",
    label: getCheckpointConfidenceReasonLabel(confidenceRecap.trend),
    detail: reasonDetail
  };
}

function buildCheckpointConfidenceReasonGroup(pathType = getStickyCheckpointPathType()) {
  const confidenceRecap =
    state.lastSessionRecap?.confidenceRecap?.pathType === pathType
      ? state.lastSessionRecap.confidenceRecap
      : null;
  const targetedPractice = state.dashboard?.targetedPractice ?? null;
  const effectivePathType = confidenceRecap?.pathType ?? pathType;

  if (!confidenceRecap || !effectivePathType) {
    return null;
  }

  if (effectivePathType === "unlock") {
    return {
      pathType: effectivePathType,
      key: "unlock-signal",
      label: "Unlock signal",
      summary: "Fresh unlock progression is driving this confidence update.",
      priority: 50
    };
  }

  if (effectivePathType === "recovery") {
    return {
      pathType: effectivePathType,
      key: "recovery-stability",
      label: "Recovery stability",
      summary: targetedPractice?.recoveryMilestone
        ? `Recovery stability is being judged from ${targetedPractice.recoveryMilestone.stableSessionCount}/${targetedPractice.recoveryMilestone.requiredStableSessions} stable recovery session(s).`
        : "Recovery route stability is driving this confidence update."
      ,
      priority: 60
    };
  }

  if (effectivePathType === "return") {
    return {
      pathType: effectivePathType,
      key: "return-validation",
      label: "Return validation",
      summary: targetedPractice?.returnMilestone
        ? `Return validation is based on ${targetedPractice.returnMilestone.stableReturnSessionCount}/${targetedPractice.returnMilestone.requiredStableReturnSessions} stable return session(s).`
        : targetedPractice?.fullChartReintegrationMilestone
          ? `Full-chart reintegration validation is tracking ${targetedPractice.fullChartReintegrationMilestone.stableFullChartSessionCount}/${targetedPractice.fullChartReintegrationMilestone.requiredStableFullChartSessions} stable full-chart session(s).`
          : "Return route validation is driving this confidence update.",
      priority: 70
    };
  }

  if (effectivePathType === "promotion") {
    return {
      pathType: effectivePathType,
      key: "promotion-proof",
      label: "Promotion proof",
      summary:
        targetedPractice?.promotionRampMilestone || targetedPractice?.promotionChainMilestone || targetedPractice?.promotionTrackMilestone
          ? "Confirmed promotion milestones are driving this confidence update."
          : "Promotion route evidence is driving this confidence update.",
      priority: 80
    };
  }

  if (effectivePathType === "mastery") {
    return {
      pathType: effectivePathType,
      key: "mastery-proof",
      label: "Mastery proof",
      summary:
        targetedPractice?.terminalTrainingMasteryTrack || targetedPractice?.terminalMasteryGraduation
          ? "Terminal mastery proof is driving this confidence update."
          : "Mastery route evidence is driving this confidence update.",
      priority: 90
    };
  }

  return {
    pathType: effectivePathType,
    key: "checkpoint-proof",
    label: "Checkpoint proof",
    summary: "Recent checkpoint evidence is driving this confidence update.",
    priority: 10
  };
}

function buildDominantCheckpointConfidenceReasonGroup() {
  const candidatePathTypes = ["session", "unlock", "recovery", "return", "promotion", "mastery"];
  const stickyPathType = getStickyCheckpointPathType();
  const groups = candidatePathTypes
    .map((pathType) => buildCheckpointConfidenceReasonGroup(pathType))
    .filter(Boolean);

  if (groups.length === 0) {
    return null;
  }

  return groups.sort((left, right) => {
    const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    if (left.pathType === stickyPathType && right.pathType !== stickyPathType) {
      return -1;
    }

    if (right.pathType === stickyPathType && left.pathType !== stickyPathType) {
      return 1;
    }

    return left.label.localeCompare(right.label);
  })[0];
}

function buildAnnotatedCheckpointConfidenceReasonGroup(
  pathType,
  dominantConfidenceReasonGroup = buildDominantCheckpointConfidenceReasonGroup()
) {
  const confidenceReasonGroup = buildCheckpointConfidenceReasonGroup(pathType);

  if (!confidenceReasonGroup) {
    return null;
  }

  return {
    ...confidenceReasonGroup,
    isDominant:
      dominantConfidenceReasonGroup?.key === confidenceReasonGroup.key &&
      dominantConfidenceReasonGroup?.pathType === confidenceReasonGroup.pathType
  };
}

function buildCheckpointConfidenceGroupRoleText({ isDominant = false, surface = "route" } = {}) {
  if (isDominant) {
    return "Dominant signal for this session.";
  }

  if (surface === "recap") {
    return "Supporting signal in this recap.";
  }

  return "Supporting signal on this route.";
}

function buildCheckpointConfidenceGroupMessage(
  confidenceReasonGroup,
  { surface = "route" } = {}
) {
  if (!confidenceReasonGroup) {
    return null;
  }

  return `Confidence group: ${confidenceReasonGroup.label}. ${confidenceReasonGroup.summary} ${buildCheckpointConfidenceGroupRoleText({
    isDominant: confidenceReasonGroup.isDominant,
    surface
  })}`.trim();
}

function buildDominantCheckpointConfidenceSignalMessage(
  dominantGroup,
  { surface = "recap", compact = false } = {}
) {
  if (!dominantGroup) {
    return null;
  }

  if (compact) {
    if (surface === "next-action") {
      return `Next action follows ${dominantGroup.label} on ${dominantGroup.pathLabel}.`;
    }

    if (surface === "timeline") {
      return `${dominantGroup.label} on ${dominantGroup.pathLabel}.`;
    }

    return `Dominant confidence: ${dominantGroup.label} on ${dominantGroup.pathLabel}.`;
  }

  if (surface === "next-action") {
    return `Next action follows the dominant confidence signal: ${dominantGroup.label} on ${dominantGroup.pathLabel}. ${dominantGroup.summary}`;
  }

  return `Dominant confidence signal: ${dominantGroup.label} on ${dominantGroup.pathLabel}. ${dominantGroup.summary}`;
}

function buildDominantCheckpointConfidenceSignalStatus() {
  const dominantGroup = buildDominantCheckpointConfidenceReasonGroup();

  if (!dominantGroup) {
    return null;
  }

  const confidenceBias = getCheckpointConfidenceActionBias(dominantGroup.pathType);
  const pathLabel = formatCheckpointHistoryGroupLabel(dominantGroup.pathType);

  return {
    pathType: dominantGroup.pathType,
    label: dominantGroup.label,
    pathLabel,
    tone:
      confidenceBias.trend === "improved"
        ? "success"
        : confidenceBias.trend === "dropped"
          ? "warning"
          : "neutral",
    recapShortMessage: buildDominantCheckpointConfidenceSignalMessage(
      { ...dominantGroup, pathLabel },
      { surface: "recap", compact: true }
    ),
    recapMessage: buildDominantCheckpointConfidenceSignalMessage(
      { ...dominantGroup, pathLabel },
      { surface: "recap" }
    ),
    nextActionShortMessage: buildDominantCheckpointConfidenceSignalMessage(
      { ...dominantGroup, pathLabel },
      { surface: "next-action", compact: true }
    ),
    nextActionMessage: buildDominantCheckpointConfidenceSignalMessage(
      { ...dominantGroup, pathLabel },
      { surface: "next-action" }
    )
  };
}

function getCheckpointConfidenceActionBias(pathType = getStickyCheckpointPathType()) {
  const confidenceRecap =
    state.lastSessionRecap?.confidenceRecap?.pathType === pathType
      ? state.lastSessionRecap.confidenceRecap
      : null;

  if (!confidenceRecap) {
    const trendMeta = getCheckpointConfidenceTrendMeta();
    return {
      pathType,
      trend: trendMeta.trend,
      tone: trendMeta.tone,
      label: trendMeta.biasLabel,
      summary: "Confidence is steady on this path."
    };
  }

  const trendMeta = getCheckpointConfidenceTrendMeta(confidenceRecap.trend);

  return {
    pathType,
    trend: trendMeta.trend,
    tone: trendMeta.tone,
    label: trendMeta.biasLabel,
    summary: trendMeta.biasSummary
  };
}

function buildCheckpointConfidenceHistorySummary(trend, historyEntryCount) {
  if (trend === "rising") {
    return `Confidence trend is rising across ${historyEntryCount} recent snapshot(s).`;
  }

  if (trend === "falling") {
    return `Confidence trend is falling across ${historyEntryCount} recent snapshot(s).`;
  }

  if (trend === "stable") {
    return `Confidence trend is stable across ${historyEntryCount} recent snapshot(s).`;
  }

  return "Only one snapshot is available for this path so far.";
}

function buildCheckpointConfidenceRecapSummary({
  pathLabel,
  trend,
  latestLabel,
  previousLabel = null,
  reason,
  historySummary
}) {
  if (trend === "opened") {
    return `Confidence recap: ${pathLabel} opens at ${latestLabel} after this session. ${reason}`;
  }

  if (trend === "improved") {
    return `Confidence recap: ${pathLabel} improved from ${previousLabel} to ${latestLabel}. ${reason}`;
  }

  if (trend === "dropped") {
    return `Confidence recap: ${pathLabel} dropped from ${previousLabel} to ${latestLabel}. ${reason}`;
  }

  if (trend === "stable" && previousLabel) {
    return `Confidence recap: ${pathLabel} stayed at ${latestLabel}. ${reason}`;
  }

  return `Confidence recap: ${pathLabel} remains at ${latestLabel}. ${historySummary}`;
}

function getCheckpointConfidenceReasonLabel(trend = "stable") {
  if (trend === "improved") {
    return "Why confidence improved";
  }

  if (trend === "dropped") {
    return "Why confidence dropped";
  }

  if (trend === "opened") {
    return "Why confidence opened";
  }

  return "Why confidence stayed steady";
}

function activateCheckpointConfidenceEntry(pathType, sessionId) {
  if (!pathType || !sessionId) {
    return;
  }

  state.progressionCheckpointFilter = pathType;
  state.checkpointPathCollapse.focusPathType = pathType;
  elements.progressionCheckpointFilter.value = pathType;
  state.selectedCheckpointSnapshotSessionId = sessionId;
  renderCheckpointPathSummaryCards();
  renderCheckpointHistorySnapshots();
  renderCheckpointHistoryDetail();
}

function renderCheckpointPathSummaryCards() {
  const cards = buildCheckpointPathSummaryCards();

  if (cards.length === 0) {
    elements.checkpointPathSummaryCards.innerHTML = `
      <article class="checkpoint-recap-card checkpoint-recap-empty">
        <strong>Checkpoint path summary</strong>
        <p>${escapeHtml(buildCheckpointWaitingMessage("Checkpoint path summary cards"))}</p>
      </article>
    `;
    renderCheckpointPathCollapseToggle();
    return;
  }

  elements.checkpointPathSummaryCards.innerHTML = cards
    .map(
      (card) => `
        <article class="checkpoint-recap-card checkpoint-path-summary-card${
          card.isPrimary ? " is-primary" : ""
        }${card.isCollapsed ? " is-collapsed" : ""}${
          card.emphasisTone ? ` checkpoint-path-summary-card-${card.emphasisTone}` : ""
        }" data-checkpoint-path-type="${escapeHtml(card.type)}">
          ${
            card.isPrimary
              ? `<div class="badge-row"><span class="badge badge-small badge-success">Primary now</span>${
                  card.emphasisLabel
                    ? `<span class="badge badge-small badge-${getConfidenceEmphasisBadgeTone(
                        card.emphasisTone
                      )} checkpoint-path-emphasis-badge checkpoint-path-emphasis-badge-${escapeHtml(
                        card.emphasisTone
                      )}">${escapeHtml(card.emphasisLabel)}</span>`
                    : ""
                }</div>`
              : card.isCollapsed
                ? '<div class="badge-row"><span class="badge badge-small">Background path</span></div>'
                : ""
          }
          <strong>${escapeHtml(card.label)}</strong>
          <p>${escapeHtml(`${card.snapshotCount} snapshot(s)`)}.</p>
          <p>${escapeHtml(`Latest checkpoint: ${card.latestTitle}`)}</p>
          ${
            card.isCollapsed
              ? `<p>${escapeHtml(`Background status: ${card.latestStatus}`)}</p>
                 <p>Click this card to inspect the path in full.</p>`
              : `<p>${escapeHtml(`Current status: ${card.latestStatus}`)}</p>
                 ${
                   card.isPrimary && card.emphasisLabel
                     ? `<p class="checkpoint-path-emphasis-copy checkpoint-path-emphasis-copy-${escapeHtml(
                         card.emphasisTone
                       )}">${escapeHtml(`${card.emphasisLabel}. ${card.actionHint}`)}</p>`
                     : `<p>${escapeHtml(card.actionHint)}</p>`
                 }
                 ${renderCheckpointPathPresetPreview(card)}
                 ${renderCheckpointPathAction(card)}
                 ${renderCheckpointPathActionFeedback(card)}`
          }
        </article>
      `
    )
    .join("");
  renderCheckpointPathCollapseToggle();
}

function activateCheckpointPath(pathType) {
  const normalizedPathType = pathType ?? "all";
  const nextFilter = normalizedPathType === "general" ? "all" : normalizedPathType;
  const nextSnapshots =
    normalizedPathType === "general"
      ? state.progressionCheckpointSnapshots
      : state.progressionCheckpointSnapshots.filter((snapshot) => snapshot.type === normalizedPathType);

  state.progressionCheckpointFilter = nextFilter;
  if (state.checkpointPathCollapse.active && nextFilter !== "all") {
    state.checkpointPathCollapse.focusPathType = nextFilter;
  }
  elements.progressionCheckpointFilter.value = nextFilter;
  state.selectedCheckpointSnapshotSessionId = nextSnapshots[0]?.sessionId ?? null;
  renderCheckpointPathSummaryCards();
  renderCheckpointHistorySnapshots();
  renderCheckpointHistoryDetail();
}

function renderCheckpointHistorySnapshots() {
  const activeFilter = state.progressionCheckpointFilter ?? "all";
  const snapshots = getFilteredCheckpointSnapshots();
  syncSelectedCheckpointSnapshot();

  if (snapshots.length === 0) {
    elements.progressionCheckpointHistory.innerHTML =
      `<article class="event-log-empty">${escapeHtml(buildCheckpointHistoryEmptyMessage(activeFilter))}</article>`;
    return;
  }

  const groupedSnapshots = groupCheckpointSnapshotsByType(snapshots);

  elements.progressionCheckpointHistory.innerHTML = groupedSnapshots
    .map(
      (group) => `
        <section class="checkpoint-history-group">
          <div class="checkpoint-history-group-head">
            <strong>${escapeHtml(group.label)}</strong>
            <span>${escapeHtml(`${group.snapshots.length} snapshot(s)`)}</span>
          </div>
          <div class="event-log diagnostics-log">
            ${group.snapshots
              .map(
                (snapshot) => `
                  <article class="event-log-entry checkpoint-history-entry${
                    snapshot.sessionId === state.selectedCheckpointSnapshotSessionId ? " is-active" : ""
                  }" data-checkpoint-session-id="${escapeHtml(snapshot.sessionId)}">
                    ${renderCheckpointBadgeRow(snapshot.badges)}
                    <strong>${escapeHtml(snapshot.title)}</strong>
                    <p>${escapeHtml(snapshot.highlights.join(". "))}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderCheckpointHistoryDetail() {
  const snapshots = getFilteredCheckpointSnapshots();
  const selectedSnapshot =
    snapshots.find((snapshot) => snapshot.sessionId === state.selectedCheckpointSnapshotSessionId) ?? null;
  const stickyPrefix = buildStickyCheckpointDetailPrefix();
  const dominantConfidenceSignal = buildDominantCheckpointConfidenceSignalStatus();

  if (!selectedSnapshot) {
    elements.progressionCheckpointDetailBadges.innerHTML = "";
    setCheckpointFlowStatus(
      elements.progressionCheckpointDetail,
      "checkpoint-detail",
      null,
      buildCheckpointDetailEmptyMessage(stickyPrefix)
    );
    return;
  }

  const detail = selectedSnapshot.detail ?? {};
  const detailBadges = mergeCheckpointBadges(
    selectedSnapshot.badges,
    selectedSnapshot.type === dominantConfidenceSignal?.pathType
      ? createDominantConfidenceSignalBadges(dominantConfidenceSignal)
      : []
  );
  const dominantConfidenceDetail =
    dominantConfidenceSignal &&
    selectedSnapshot.type === dominantConfidenceSignal.pathType
      ? buildDominantCheckpointConfidenceSignalMessage(dominantConfidenceSignal, {
          surface: "detail"
        })
      : null;
  const detailParts = [
    `Training: ${detail.trainingTitle ?? selectedSnapshot.trainingTitle ?? selectedSnapshot.trainingId}`,
    detail.tempoBpm ? `Tempo: ${detail.tempoBpm} BPM` : null,
    detail.practiceScope ? `Scope: ${detail.practiceScope}` : null,
    detail.sectionLabel ? `Section: ${detail.sectionLabel}` : null,
    detail.unlockTitles?.length ? `Unlocks: ${detail.unlockTitles.join(", ")}` : null,
    detail.nextStep ? `Next step: ${detail.nextStep}` : null,
    detail.reason ? `Reason: ${detail.reason}` : null,
    dominantConfidenceDetail,
    detail.completedAt ? `Completed: ${detail.completedAt}` : null
  ].filter(Boolean);

  elements.progressionCheckpointDetailBadges.innerHTML = renderCheckpointBadgeRow(detailBadges);

  setCheckpointFlowStatus(
    elements.progressionCheckpointDetail,
    "checkpoint-detail",
    "success",
    `${stickyPrefix ? `${stickyPrefix} ` : ""}${selectedSnapshot.title}: ${detailParts.join(". ")}`
  );
}

function buildProgressionTimelineEntries() {
  const entries = [];
  const pathContext = buildCheckpointPathContextText();
  const dominantConfidenceSignal = buildDominantCheckpointConfidenceSignalStatus();

  if (pathContext) {
    entries.push({
      title: "Path focus",
      detail: `${pathContext} This route is currently carried across recap and next action.`
    });
  }

  if (state.lastSessionRecap) {
    entries.push({
      title: "Latest session",
      detail: `Score ${state.lastSessionRecap.totalScore}, accuracy ${state.lastSessionRecap.accuracy}${
        state.lastSessionRecap.grade ? `, grade ${state.lastSessionRecap.grade}` : ""
      }. ${state.lastSessionRecap.unlockSummary}`
    });
  }

  if (dominantConfidenceSignal) {
    entries.push({
      title: "Dominant confidence signal",
      detail: `${buildDominantCheckpointConfidenceSignalMessage(dominantConfidenceSignal, {
        surface: "timeline",
        compact: true
      })} ${dominantConfidenceSignal.recapMessage}`,
      badges: createDominantConfidenceSignalBadges(dominantConfidenceSignal)
    });
  }

  if (state.lastUnlockTransition?.hasNewUnlocks) {
    entries.push({
      title: "Unlock transition",
      detail: `Unlocked ${state.lastUnlockTransition.unlockedTrainingTitles.join(", ")}.`
    });
  }

  if (state.dashboard?.targetedPractice?.nextStep) {
    entries.push({
      title: "Next guided step",
      detail: state.dashboard.targetedPractice.nextStep
    });
  }

  for (const result of state.dashboard?.recentResults?.slice(0, 2) ?? []) {
    entries.push({
      title: result.trainingTitle,
      detail: `Completed ${result.completedAt}, score ${result.totalScore}, accuracy ${result.accuracy}${
        result.rating?.grade ? `, grade ${result.rating.grade}` : ""
      }.`
    });
  }

  return entries.slice(0, 4);
}

function createDominantConfidenceSignalBadges(dominantConfidenceSignal) {
  if (!dominantConfidenceSignal) {
    return [];
  }

  const tone =
    dominantConfidenceSignal.tone === "success"
      ? "success"
      : dominantConfidenceSignal.tone === "warning"
        ? "warning"
        : "neutral";

  return [
    { label: "Dominant signal", tone },
    { label: dominantConfidenceSignal.label, tone }
  ];
}

function mergeCheckpointBadges(...badgeGroups) {
  const mergedBadges = [];
  const seen = new Set();

  for (const group of badgeGroups) {
    for (const badge of group ?? []) {
      const key = `${badge.label}:${badge.tone ?? "neutral"}`;

      if (!badge?.label || seen.has(key)) {
        continue;
      }

      seen.add(key);
      mergedBadges.push(badge);
    }
  }

  return mergedBadges;
}

function createCheckpointBadges({ targetedPractice = null, unlockTransition = null, sessionRecap = null, result = null } = {}) {
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

  if (sessionRecap?.grade) {
    pushBadge(`Grade ${sessionRecap.grade}`, "neutral");
  }

  if (result?.rating?.grade) {
    pushBadge(`Grade ${result.rating.grade}`, "neutral");
  }

  if (!targetedPractice?.recoveryProgressStatus) {
    return badges;
  }

  const status = targetedPractice.recoveryProgressStatus;

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
  } else if (status === "promotion-chain-graduation-confirmed") {
    pushBadge("Chain Graduated", "success");
  } else if (status === "terminal-training-mastered" || status === "terminal-mastery-graduated") {
    pushBadge("Terminal Mastery", "success");
  }

  if (targetedPractice.promotionTargetTrainingTitle) {
    pushBadge("Promotion", "neutral");
  }

  return badges;
}

function renderCheckpointBadgeRow(badges) {
  if (!Array.isArray(badges) || badges.length === 0) {
    return "";
  }

  return `
    <div class="badge-row">
      ${badges
        .map(
          (badge) =>
            `<span class="badge badge-small badge-${normalizeBadgeTone(badge.tone)}">${escapeHtml(
              badge.label
            )}</span>`
        )
        .join("")}
    </div>
  `;
}

function getProgressionNextAction() {
  const targetedPractice = state.dashboard?.targetedPractice ?? null;
  const pathContext = buildCheckpointPathContextText();
  const confidenceBias = getCheckpointConfidenceActionBias();
  const checkpointBadges = createCheckpointBadges({
    targetedPractice,
    unlockTransition: state.lastUnlockTransition,
    sessionRecap: state.lastSessionRecap
  });
  const checkpointLabel = checkpointBadges[0]?.label ?? "Guided Step";

  if (state.lastUnlockTransition?.hasNewUnlocks) {
    const latestUnlockedTraining = getLatestUnlockedTraining();

    if (!latestUnlockedTraining) {
        return {
          key: "unlock-await-catalog",
          label: "Load unlocked training",
          disabled: true,
          message: `${pathContext ? `${pathContext} ` : ""}A new unlock exists, but the training catalog is not ready to map it yet. ${confidenceBias.summary}`
        };
      }

    if (canStartLatestUnlockedTraining()) {
      return {
        key: "start-unlocked-training",
        label:
          confidenceBias.trend === "dropped"
            ? "Review unlocked training first"
            : "Start unlocked training now",
        disabled: false,
        message: `${pathContext ? `${pathContext} ` : ""}Checkpoint ${checkpointLabel}: launch ${latestUnlockedTraining.title} with the prepared session preset. ${confidenceBias.summary}`
      };
    }

    return {
      key: "select-unlocked-training",
      label:
        confidenceBias.trend === "dropped"
          ? "Review unlocked preset"
          : "Select unlocked training",
      disabled: false,
      message: `${pathContext ? `${pathContext} ` : ""}Checkpoint ${checkpointLabel}: select ${latestUnlockedTraining.title} and prepare the session form first. ${confidenceBias.summary}`
    };
  }

  if (!targetedPractice?.recommendedTrainingId) {
    return null;
  }

  const checkpointActionCopy = getCheckpointActionCopy(targetedPractice, checkpointLabel, confidenceBias);
  const selectedRecommendedTraining = state.selectedTrainingId === targetedPractice.recommendedTrainingId;
  const canStartGuidedStep = selectedRecommendedTraining && state.engineConnected && !state.activeSessionId;

  if (canStartGuidedStep) {
    return {
      key: "start-guided-practice",
      label: checkpointActionCopy.startLabel,
      disabled: false,
      message: `${pathContext ? `${pathContext} ` : ""}${checkpointActionCopy.prefix}: start ${targetedPractice.recommendedTrainingTitle}${checkpointActionCopy.sectionLabel ? ` / ${checkpointActionCopy.sectionLabel}` : ""} at ${targetedPractice.suggestedTempoBpm} BPM. ${checkpointActionCopy.detail}`
    };
  }

  return {
    key: "apply-guided-practice",
    label: checkpointActionCopy.applyLabel,
    disabled: false,
    message: `${pathContext ? `${pathContext} ` : ""}${checkpointActionCopy.prefix}: apply the preset for ${targetedPractice.recommendedTrainingTitle}${checkpointActionCopy.sectionLabel ? ` / ${checkpointActionCopy.sectionLabel}` : ""} and prepare the next step. ${checkpointActionCopy.detail}`
  };
}

function getCheckpointActionCopy(targetedPractice, checkpointLabel, confidenceBias = getCheckpointConfidenceActionBias()) {
  const status = targetedPractice?.recoveryProgressStatus ?? null;
  const sectionLabel =
    targetedPractice?.practiceSectionLabel ??
    targetedPractice?.recommendedSectionLabel ??
    null;
  const nextStepDetail = targetedPractice?.nextStep ?? "Follow the guided next step from the dashboard.";
  const detailWithConfidence = `${nextStepDetail} ${confidenceBias.summary}`.trim();
  const buildLabels = (applyLabel, startLabel) => {
    if (confidenceBias.trend !== "dropped") {
      return { applyLabel, startLabel };
    }

    return {
      applyLabel: `Review ${applyLabel.replace(/^Apply /, "").toLowerCase()}`,
      startLabel: `Review ${startLabel.replace(/^Start /, "").toLowerCase()}`
    };
  };

  if (status === "route-to-recovery" || status === "keep-recovery") {
    const labels = buildLabels("Apply recovery preset", "Start recovery step");
    return {
      applyLabel: labels.applyLabel,
      startLabel: labels.startLabel,
      prefix: `Checkpoint ${checkpointLabel}`,
      detail: `${targetedPractice?.recoveryReason ?? nextStepDetail} ${confidenceBias.summary}`.trim(),
      sectionLabel
    };
  }

  if (status === "goal-ready" || status === "return-monitoring" || status === "return-confirmed") {
    const labels = buildLabels("Apply return preset", "Start return step");
    return {
      applyLabel: labels.applyLabel,
      startLabel: labels.startLabel,
      prefix: `Checkpoint ${checkpointLabel}`,
      detail:
        targetedPractice?.recoveryGoalTrainingTitle
          ? `Rebuild the goal route back to ${targetedPractice.recoveryGoalTrainingTitle}.${targetedPractice.recoveryGoalSectionLabel ? ` Focus on ${targetedPractice.recoveryGoalSectionLabel}.` : ""} ${confidenceBias.summary}`.trim()
          : detailWithConfidence,
      sectionLabel
    };
  }

  if (
    status === "full-chart-reintegration" ||
    status === "full-chart-reintegrated" ||
    status === "full-chart-reintegration-failed"
  ) {
    const labels = buildLabels("Apply reintegration preset", "Start reintegration step");
    return {
      applyLabel: labels.applyLabel,
      startLabel: labels.startLabel,
      prefix: `Checkpoint ${checkpointLabel}`,
      detail: `${targetedPractice?.fullChartReintegrationRamp?.reason ?? nextStepDetail} ${confidenceBias.summary}`.trim(),
      sectionLabel
    };
  }

  if (
    status?.startsWith("promotion-") ||
    status === "promotion-graduated"
  ) {
    const labels = buildLabels("Apply promotion preset", "Start promotion step");
    return {
      applyLabel: labels.applyLabel,
      startLabel: labels.startLabel,
      prefix: `Checkpoint ${checkpointLabel}`,
      detail: `${
        targetedPractice?.promotionTargetReason ??
        targetedPractice?.promotionRamp?.reason ??
        targetedPractice?.promotionChain?.reason ??
        nextStepDetail
      } ${confidenceBias.summary}`.trim(),
      sectionLabel
    };
  }

  if (
    status === "terminal-training-mastery" ||
    status === "terminal-training-mastered" ||
    status === "terminal-mastery-graduated"
  ) {
    const labels = buildLabels("Apply mastery preset", "Start mastery step");
    return {
      applyLabel: labels.applyLabel,
      startLabel: labels.startLabel,
      prefix: `Checkpoint ${checkpointLabel}`,
      detail: `${
        targetedPractice?.terminalMasteryGraduation?.reason ??
        "Keep reinforcing the terminal training block before opening the next branch."
      } ${confidenceBias.summary}`.trim(),
      sectionLabel
    };
  }

  const labels = buildLabels("Apply checkpoint preset", "Start checkpoint step");
  return {
    applyLabel: labels.applyLabel,
    startLabel: labels.startLabel,
    prefix: `Checkpoint ${checkpointLabel}`,
    detail: detailWithConfidence,
    sectionLabel
  };
}

function buildGuidedNextActionStatusMessage({
  nextAction,
  presetPreview = null,
  presetConfidence = null,
  confidenceHistory = null,
  confidenceReason = null,
  confidenceReasonGroup = null,
  isDominantConfidenceGroup = false,
  presetDiff = []
} = {}) {
  const headline = truncateCheckpointFlowStatusText(nextAction?.message ?? "", 132);
  const support = [];

  if (presetPreview?.summary) {
    support.push(`Preset ${truncateCheckpointFlowStatusText(presetPreview.summary, 58)}`);
  }

  if (presetConfidence?.label) {
    const confidenceReasonText = presetConfidence.reason
      ? ` ${truncateCheckpointFlowStatusText(presetConfidence.reason, 42)}`
      : "";
    support.push(`Confidence ${presetConfidence.label.toLowerCase()}${confidenceReasonText}`.trim());
  }

  if (confidenceReason?.label) {
    support.push(`Reason ${truncateCheckpointFlowStatusText(confidenceReason.label, 44)}`);
  } else if (confidenceReasonGroup) {
    support.push(
      `Signal ${truncateCheckpointFlowStatusText(
        buildCheckpointConfidenceGroupMessage(
          {
            ...confidenceReasonGroup,
            isDominant: isDominantConfidenceGroup
          },
          { surface: "route" }
        ),
        52
      )}`
    );
  } else if (confidenceHistory?.summary) {
    support.push(`History ${truncateCheckpointFlowStatusText(confidenceHistory.summary, 48)}`);
  }

  if (presetDiff.length > 0) {
    support.push(`Diff ${truncateCheckpointFlowStatusText(presetDiff.join("; "), 56)}`);
  } else if (presetPreview?.summary) {
    support.push("Diff aligned");
  }

  return `${headline}${support.length > 0 ? ` Support: ${support.join(" | ")}.` : ""}`.trim();
}

function buildProgressionNextActionExecutionHint(nextAction, presetPreview = null) {
  if (!nextAction) {
    return buildCheckpointWaitingMessage("Action execution hint");
  }

  const presetSummary = presetPreview?.summary
    ? ` Preset: ${truncateCheckpointFlowStatusText(presetPreview.summary, 72)}`
    : "";

  if (nextAction.key === "start-unlocked-training" || nextAction.key === "start-guided-practice") {
    return `Runs immediately from the current desktop session form.${presetSummary}`;
  }

  if (nextAction.key === "select-unlocked-training") {
    return `Selects the unlocked training and prefills the desktop session form before start.${presetSummary}`;
  }

  if (nextAction.key === "apply-guided-practice") {
    return `Updates the desktop session form with the guided preset before start.${presetSummary}`;
  }

  if (nextAction.key === "unlock-await-catalog") {
    return "Waits for the training catalog before this action can be mapped to a launchable step.";
  }

  return `Follows the current desktop checkpoint flow.${presetSummary}`.trim();
}

function buildProgressionNextActionExecutionState(nextAction) {
  if (!nextAction) {
    return {
      tone: "waiting",
      label: "Waiting",
      summary: buildCheckpointWaitingMessage("Execution state")
    };
  }

  if (nextAction.disabled || nextAction.key === "unlock-await-catalog") {
    return {
      tone: "blocked",
      label: "Blocked",
      summary: "This step cannot run yet and needs more setup before launch."
    };
  }

  if (nextAction.key === "start-unlocked-training" || nextAction.key === "start-guided-practice") {
    return {
      tone: "ready",
      label: "Ready to run",
      summary: "This step can launch immediately from the current desktop session setup."
    };
  }

  return {
    tone: "prepare",
    label: "Prepare first",
    summary: "This step updates the session setup first and then leads into launch."
  };
}

function buildProgressionActionHandoff(actionResult) {
  if (!actionResult?.ok) {
    return {
      tone: "warning",
      focusTarget: "session-status",
      focusLabel: "Session status",
      summary: "Review Session status for the current setup blocker."
    };
  }

  if (actionResult.sessionStarted) {
    return {
      tone: "success",
      focusTarget: "session-status",
      focusLabel: "Session status",
      summary: "Session status is now the active focus."
    };
  }

  return {
    tone: "success",
    focusTarget: "checkpoint-detail",
    focusLabel: "Current checkpoint",
    summary: "Current checkpoint is now the active focus."
  };
}

function buildProgressionActionHandoffMessage(handoff, { surface = "rail" } = {}) {
  if (!handoff) {
    return "";
  }

  if (surface === "path") {
    if (handoff.tone === "warning") {
      return "Handoff blocked: the path action did not complete. Review the session status.";
    }

    if (handoff.focusTarget === "session-status") {
      return "Handoff complete: session started from this path. Session status is now the active focus.";
    }

    return "Handoff complete: session form updated for this path. Current checkpoint is now the active focus.";
  }

  if (handoff.tone === "warning") {
    return "Review the current setup blocker.";
  }

  if (handoff.focusTarget === "session-status") {
    return "Now active for the launched session.";
  }

  return "Now active for the prepared checkpoint.";
}

function buildProgressionNextActionFeedbackMessage(actionResult) {
  if (!actionResult?.key) {
    return "";
  }

  if (!actionResult.ok) {
    return "Review the current setup.";
  }

  if (actionResult.key === "select-unlocked-training" || actionResult.key === "apply-guided-practice") {
    return "Session form is ready.";
  }

  if (actionResult.key === "start-unlocked-training" || actionResult.key === "start-guided-practice") {
    return actionResult.sessionStarted ? "Session is running." : "Start did not complete.";
  }

  return "Action completed.";
}

function buildProgressionNextActionFeedbackBadge(feedback) {
  if (!feedback?.label) {
    return null;
  }

  const toneByLabel = {
    "Blocked by setup": "warning",
    "Preset applied": "success",
    "Launch started": "success",
    "Launch blocked": "warning",
    "Action applied": "neutral"
  };

  const compactLabelByLabel = {
    "Blocked by setup": "Blocked",
    "Preset applied": "Applied",
    "Launch started": "Launched",
    "Launch blocked": "Launch blocked",
    "Action applied": "Applied"
  };

  return {
    tone: toneByLabel[feedback.label] ?? "neutral",
    label: compactLabelByLabel[feedback.label] ?? feedback.label
  };
}

function buildProgressionActionFocusBadge(feedback) {
  if (!feedback?.focusTarget) {
    return null;
  }

  const toneByFocusTarget = {
    "session-status": feedback.tone === "warning" ? "warning" : "success",
    "checkpoint-detail": "neutral"
  };

  const compactLabelByFocusTarget = {
    "session-status": "Session status",
    "checkpoint-detail": "Current checkpoint"
  };

  return {
    tone: toneByFocusTarget[feedback.focusTarget] ?? "neutral",
    label: compactLabelByFocusTarget[feedback.focusTarget] ?? feedback.focusLabel ?? "Next focus"
  };
}

function buildProgressionNextActionFeedback(actionResult) {
  if (!actionResult?.key) {
    return null;
  }

  const handoff = buildProgressionActionHandoff(actionResult);

  if (!actionResult.ok) {
    return {
      key: actionResult.key,
      tone: handoff.tone,
      label: "Blocked by setup",
      message: buildProgressionNextActionFeedbackMessage(actionResult),
      focusTarget: handoff.focusTarget,
      focusLabel: handoff.focusLabel,
      focusSummary: handoff.summary
    };
  }

  if (actionResult.key === "select-unlocked-training") {
    return {
      key: actionResult.key,
      tone: handoff.tone,
      label: "Preset applied",
      message: buildProgressionNextActionFeedbackMessage(actionResult),
      focusTarget: handoff.focusTarget,
      focusLabel: handoff.focusLabel,
      focusSummary: handoff.summary
    };
  }

  if (actionResult.key === "apply-guided-practice") {
    return {
      key: actionResult.key,
      tone: handoff.tone,
      label: "Preset applied",
      message: buildProgressionNextActionFeedbackMessage(actionResult),
      focusTarget: handoff.focusTarget,
      focusLabel: handoff.focusLabel,
      focusSummary: handoff.summary
    };
  }

  if (actionResult.key === "start-unlocked-training" || actionResult.key === "start-guided-practice") {
    return actionResult.sessionStarted
      ? {
          key: actionResult.key,
          tone: handoff.tone,
          label: "Launch started",
          message: buildProgressionNextActionFeedbackMessage(actionResult),
          focusTarget: handoff.focusTarget,
          focusLabel: handoff.focusLabel,
          focusSummary: handoff.summary
        }
      : {
          key: actionResult.key,
          tone: handoff.tone,
          label: "Launch blocked",
          message: buildProgressionNextActionFeedbackMessage(actionResult),
          focusTarget: handoff.focusTarget,
          focusLabel: handoff.focusLabel,
          focusSummary: handoff.summary
        };
  }

  return {
    key: actionResult.key,
    tone: handoff.tone,
    label: "Action applied",
    message: buildProgressionNextActionFeedbackMessage(actionResult),
    focusTarget: handoff.focusTarget,
    focusLabel: handoff.focusLabel,
    focusSummary: handoff.summary
  };
}

function syncProgressionNextActionFeedback(nextAction) {
  const feedback = state.progressionNextActionFeedback;

  if (!feedback?.key) {
    return;
  }

  const compatibleNextActionKeys = {
    "select-unlocked-training": ["select-unlocked-training", "start-unlocked-training"],
    "apply-guided-practice": ["apply-guided-practice", "start-guided-practice"],
    "start-unlocked-training": ["start-unlocked-training"],
    "start-guided-practice": ["start-guided-practice"]
  };

  if (
    (feedback.key === "start-unlocked-training" || feedback.key === "start-guided-practice") &&
    !state.activeSessionId &&
    state.lastSessionRecap
  ) {
    state.progressionNextActionFeedback = null;
    return;
  }

  if (!nextAction?.key) {
    return;
  }

  if (!(compatibleNextActionKeys[feedback.key] ?? [feedback.key]).includes(nextAction.key)) {
    state.progressionNextActionFeedback = null;
  }
}

function applyProgressionNextActionHandoffState(feedback) {
  const decisionElement = elements.progressionNextStepDecision;

  if (!decisionElement) {
    return;
  }

  decisionElement.classList.remove(
    "is-handoff-session-status",
    "is-handoff-checkpoint-detail",
    "is-handoff-blocked"
  );

  if (!feedback?.focusTarget) {
    return;
  }

  if (feedback.tone === "warning") {
    decisionElement.classList.add("is-handoff-blocked");
  }

  if (feedback.focusTarget === "session-status") {
    decisionElement.classList.add("is-handoff-session-status");
  }

  if (feedback.focusTarget === "checkpoint-detail") {
    decisionElement.classList.add("is-handoff-checkpoint-detail");
  }
}

function renderProgressionNextActionFeedback() {
  const feedback = state.progressionNextActionFeedback;

  if (
    !elements.progressionNextActionResult ||
    !elements.progressionNextActionFocus ||
    !elements.progressionNextActionFeedbackBadgeRow ||
    !elements.progressionNextActionFocusBadgeRow
  ) {
    return;
  }

  elements.progressionNextActionResult.classList.remove(
    "is-feedback-success",
    "is-feedback-warning"
  );
  elements.progressionNextActionFocus.classList.remove(
    "is-focus-success",
    "is-focus-warning",
    "is-target-session-status",
    "is-target-checkpoint-detail"
  );

  if (!feedback) {
    applyProgressionNextActionHandoffState(null);
    elements.progressionNextActionFeedbackBadgeRow.innerHTML = "";
    elements.progressionNextActionFocusBadgeRow.innerHTML = "";
    elements.progressionNextActionResult.textContent =
      "Waiting for guided action result.";
    elements.progressionNextActionFocus.textContent =
      "Waiting for next focus.";
    return;
  }

  applyProgressionNextActionHandoffState(feedback);
  const feedbackBadge = buildProgressionNextActionFeedbackBadge(feedback);
  const focusBadge = buildProgressionActionFocusBadge(feedback);
  elements.progressionNextActionFeedbackBadgeRow.innerHTML = feedbackBadge
    ? `<span class="badge badge-small badge-${escapeHtml(feedbackBadge.tone)}">${escapeHtml(
        feedbackBadge.label
      )}</span>`
    : "";
  elements.progressionNextActionFocusBadgeRow.innerHTML = focusBadge
    ? `<span class="badge badge-small badge-${escapeHtml(focusBadge.tone)}">${escapeHtml(
        focusBadge.label
      )}</span>`
    : "";
  elements.progressionNextActionResult.classList.add(`is-feedback-${feedback.tone}`);
  elements.progressionNextActionResult.textContent = `${feedback.label}. ${feedback.message}`;
  elements.progressionNextActionFocus.classList.add(`is-focus-${feedback.tone}`);
  elements.progressionNextActionFocus.classList.add(`is-target-${feedback.focusTarget}`);
  elements.progressionNextActionFocus.textContent = buildProgressionActionHandoffMessage(
    {
      tone: feedback.tone,
      focusTarget: feedback.focusTarget,
      focusLabel: feedback.focusLabel,
      summary: feedback.focusSummary
    },
    { surface: "rail" }
  );
}

function renderProgressionNextActionExecutionState(nextAction) {
  const executionState = buildProgressionNextActionExecutionState(nextAction);
  const decisionElement = elements.progressionNextStepDecision;

  if (decisionElement) {
    decisionElement.classList.remove(
      "is-execution-waiting",
      "is-execution-blocked",
      "is-execution-prepare",
      "is-execution-ready"
    );
    decisionElement.classList.add(`is-execution-${executionState.tone}`);
  }

  if (elements.progressionNextActionState) {
    elements.progressionNextActionState.textContent = `${executionState.label}: ${executionState.summary}`;
  }

  return executionState;
}

function getProgressionNextActionStatusVariant(nextAction, executionState) {
  if (!nextAction || !executionState) {
    return null;
  }

  if (executionState.tone === "blocked") {
    return "error";
  }

  if (executionState.tone === "prepare") {
    return "warning";
  }

  if (executionState.tone === "ready") {
    return "success";
  }

  return null;
}

function renderProgressionNextAction() {
  const nextAction = getProgressionNextAction();
  syncProgressionNextActionFeedback(nextAction);
  const presetPreview = buildCheckpointPathSessionPresetPreview(nextAction);
  const presetDiff = buildSessionPresetDiff(presetPreview);
  const presetConfidence = buildCheckpointPathPresetConfidence(nextAction, presetPreview);
  const confidenceHistory = buildCheckpointPathConfidenceHistory();
  const confidenceReason = buildCheckpointConfidenceReason();
  const confidenceReasonGroup = buildCheckpointConfidenceReasonGroup();
  const dominantConfidenceReasonGroup = buildDominantCheckpointConfidenceReasonGroup();
  const isDominantConfidenceGroup =
    confidenceReasonGroup &&
    dominantConfidenceReasonGroup &&
    confidenceReasonGroup.key === dominantConfidenceReasonGroup.key &&
    confidenceReasonGroup.pathType === dominantConfidenceReasonGroup.pathType;

  if (!nextAction) {
    renderDominantCheckpointConfidenceSignalStatuses();
    elements.progressionNextActionButton.disabled = true;
    elements.progressionNextActionButton.textContent = "Follow checkpoint action";
    renderProgressionNextActionExecutionState(null);
    elements.progressionNextActionHint.textContent = buildCheckpointWaitingMessage("Action execution hint");
    renderProgressionNextActionFeedback();
    setCheckpointFlowStatus(
      elements.progressionNextActionStatus,
      "guided-next-action",
      null,
      buildCheckpointWaitingMessage("Checkpoint-driven next action")
    );
    return;
  }

  renderDominantCheckpointConfidenceSignalStatuses();
  elements.progressionNextActionButton.disabled = nextAction.disabled;
  elements.progressionNextActionButton.textContent = nextAction.label;
  const executionState = renderProgressionNextActionExecutionState(nextAction);
  elements.progressionNextActionHint.textContent = buildProgressionNextActionExecutionHint(
    nextAction,
    presetPreview
  );
  renderProgressionNextActionFeedback();
  setCheckpointFlowStatus(
    elements.progressionNextActionStatus,
    "guided-next-action",
    getProgressionNextActionStatusVariant(nextAction, executionState),
    buildGuidedNextActionStatusMessage({
      nextAction,
      presetPreview,
      presetConfidence,
      confidenceHistory,
      confidenceReason,
      confidenceReasonGroup,
      isDominantConfidenceGroup,
      presetDiff
    })
  );
}

async function runProgressionNextAction() {
  const nextAction = getProgressionNextAction();

  if (!nextAction || nextAction.disabled) {
    const actionResult = {
      ok: false,
      key: nextAction?.key ?? null,
      sessionStarted: false
    };
    state.progressionNextActionFeedback = buildProgressionNextActionFeedback(actionResult);
    renderProgressionNextAction();
    return actionResult;
  }

  if (nextAction.key === "select-unlocked-training") {
    selectLatestUnlockedTraining();
    const actionResult = {
      ok: true,
      key: nextAction.key,
      sessionStarted: false
    };
    state.progressionNextActionFeedback = buildProgressionNextActionFeedback(actionResult);
    renderProgressionNextAction();
    return actionResult;
  }

  if (nextAction.key === "start-unlocked-training") {
    const hadSessionBefore = Boolean(state.activeSessionId);
    await startLatestUnlockedTraining();
    const actionResult = {
      ok: true,
      key: nextAction.key,
      sessionStarted: !hadSessionBefore && Boolean(state.activeSessionId)
    };
    state.progressionNextActionFeedback = buildProgressionNextActionFeedback(actionResult);
    renderProgressionNextAction();
    return actionResult;
  }

  if (nextAction.key === "apply-guided-practice") {
    applyDashboardPracticePreset();
    const actionResult = {
      ok: true,
      key: nextAction.key,
      sessionStarted: false
    };
    state.progressionNextActionFeedback = buildProgressionNextActionFeedback(actionResult);
    renderProgressionNextAction();
    return actionResult;
  }

  if (nextAction.key === "start-guided-practice") {
    const hadSessionBefore = Boolean(state.activeSessionId);
    applyDashboardPracticePreset();
    await createSession();
    const actionResult = {
      ok: true,
      key: nextAction.key,
      sessionStarted: !hadSessionBefore && Boolean(state.activeSessionId)
    };
    state.progressionNextActionFeedback = buildProgressionNextActionFeedback(actionResult);
    renderProgressionNextAction();
    return actionResult;
  }

  const actionResult = {
    ok: false,
    key: nextAction.key,
    sessionStarted: false
  };
  state.progressionNextActionFeedback = buildProgressionNextActionFeedback(actionResult);
  return actionResult;
}

function renderProgressionTimeline() {
  const entries = buildProgressionTimelineEntries();

  if (entries.length === 0) {
    elements.progressionTimeline.innerHTML =
      `<article class="event-log-empty">${escapeHtml(buildCheckpointWaitingMessage("Progression timeline"))}</article>`;
    return;
  }

  elements.progressionTimeline.innerHTML = entries
    .map(
      (entry) => {
        const timelineBadges = mergeCheckpointBadges(
          createCheckpointBadges({
            targetedPractice: state.dashboard?.targetedPractice ?? null,
            unlockTransition: entry.title === "Unlock transition" ? state.lastUnlockTransition : null,
            sessionRecap: entry.title === "Latest session" ? state.lastSessionRecap : null
          }),
          entry.badges ?? []
        );

        return `
        <article class="event-log-entry">
          ${renderCheckpointBadgeRow(timelineBadges)}
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.detail)}</p>
        </article>
      `;
      }
    )
    .join("");
}

function renderUnlockCelebration() {
  const unlockTransition = state.lastUnlockTransition;

  if (!unlockTransition?.hasNewUnlocks) {
    elements.selectUnlockedTrainingButton.disabled = true;
    setStatus(elements.unlockCelebrationStatus, null, "No newly unlocked training yet.");
    renderUnlockOnboardingHandoff();
    updateActionButtons();
    return;
  }

  const latestUnlockedTraining = getLatestUnlockedTraining();
  elements.selectUnlockedTrainingButton.disabled = !latestUnlockedTraining;
  setStatus(
    elements.unlockCelebrationStatus,
    "success",
    `Unlocked ${unlockTransition.unlockedTrainingTitles.join(", ")}. ${
      latestUnlockedTraining
        ? `Use the action below to jump to ${latestUnlockedTraining.title}.`
        : "Load trainings to select it from the catalog."
    }`
  );
  renderUnlockOnboardingHandoff();
  updateActionButtons();
}

function selectLatestUnlockedTraining() {
  const latestUnlockedTraining = getLatestUnlockedTraining();

  if (!latestUnlockedTraining) {
    setStatus(
      elements.unlockCelebrationStatus,
      "error",
      "No unlocked training is ready to select. Load the training catalog first."
    );
    return;
  }

  applyTrainingSessionPreset(latestUnlockedTraining, {
    targetedPractice: state.dashboard?.targetedPractice ?? null
  });
  setStatus(
    elements.unlockCelebrationStatus,
    "success",
    `Unlocked ${state.lastUnlockTransition.unlockedTrainingTitles.join(", ")}. ${latestUnlockedTraining.title} is selected and the session form is prefilled.`
  );
  setStatus(
    elements.sessionStatus,
    "success",
    state.dashboard?.targetedPractice?.recommendedTrainingId === latestUnlockedTraining.id
      ? `Selected unlocked training and applied the targeted preset for ${latestUnlockedTraining.title}.`
      : `Selected unlocked training and applied the default session preset for ${latestUnlockedTraining.title}.`
  );
  renderUnlockOnboardingHandoff();
  updateActionButtons();
}

async function startLatestUnlockedTraining() {
  const latestUnlockedTraining = getLatestUnlockedTraining();

  if (!latestUnlockedTraining || !state.lastUnlockTransition?.hasNewUnlocks) {
    setStatus(
      elements.unlockCelebrationStatus,
      "error",
      "No newly unlocked training is ready to launch."
    );
    return;
  }

  if (!state.engineConnected) {
    setStatus(
      elements.unlockOnboardingStatus,
      "error",
      "Connect the local engine before launching the unlocked training."
    );
    return;
  }

  if (state.selectedTrainingId !== latestUnlockedTraining.id) {
    selectLatestUnlockedTraining();
  }

  setStatus(
    elements.unlockCelebrationStatus,
    "success",
    `Launching unlocked training: ${latestUnlockedTraining.title}.`
  );
  await createSession();
}

function createCapturePathLabel(backend, profile) {
  if (!backend && !profile) {
    return "Not resolved yet";
  }

  if (backend && profile) {
    return `${backend.toUpperCase()} ${profile}`;
  }

  return backend ? backend.toUpperCase() : profile;
}

function formatMasteryGateSummary(masteryGate) {
  if (!masteryGate) {
    return "";
  }

  return `Mastery gate: ${masteryGate.status}, passed ${masteryGate.passedRepetitionCount}/${masteryGate.totalRepetitionCount}, highest passed ${masteryGate.highestPassedTempoBpm} BPM, next ${masteryGate.recommendedNextTempoBpm} BPM. ${masteryGate.message}`;
}

function formatAdaptiveExecutionSummary(adaptiveExecution) {
  if (!adaptiveExecution) {
    return "";
  }

  return `Adaptive execution: ${adaptiveExecution.mode}, completed ${adaptiveExecution.completedRepetitionCount}/${adaptiveExecution.plannedRepetitionCount} rep(s)${adaptiveExecution.stoppedAfterRepetitionIndex !== undefined ? `, stopped after rep ${adaptiveExecution.stoppedAfterRepetitionIndex + 1}` : ""}${adaptiveExecution.stopReason ? `. ${adaptiveExecution.stopReason}` : ""}${adaptiveExecution.retryPlan ? ` Retry plan: ${adaptiveExecution.retryPlan.strategy} @ ${adaptiveExecution.retryPlan.tempoBpm} BPM, ${adaptiveExecution.retryPlan.loopRepetitionCount} rep(s)${adaptiveExecution.retryPlan.loopTempoStepBpm ? `, +${adaptiveExecution.retryPlan.loopTempoStepBpm} BPM` : ""}. ${adaptiveExecution.retryPlan.reason}` : ""}`;
}

function formatPracticeRepetitionSummary(repetitions) {
  if (!Array.isArray(repetitions) || repetitions.length === 0) {
    return "";
  }

  return repetitions
    .map((repetition) => `rep ${repetition.repetitionIndex + 1} ${repetition.tempoBpm} BPM ${repetition.skipped ? "skipped" : repetition.passed ? "pass" : "retry"}${repetition.performanceScore !== undefined ? ` score ${repetition.performanceScore}` : ""}`)
    .join(" | ");
}

function resetSessionDiagnostics({ sessionId = null, inputMode = null, capture = null } = {}) {
  state.sessionDiagnostics = {
    sessionId,
    inputMode,
    currentCapture: capture,
    notices: [],
    lastSummary: null
  };
  renderSessionDiagnostics();
}

function pushSessionDiagnosticNotice({ code, level = "info", message, capture = null, timestamp = new Date().toISOString() }) {
  state.sessionDiagnostics.notices = [
    {
      code,
      level,
      message,
      capture,
      timestamp
    },
    ...state.sessionDiagnostics.notices
  ].slice(0, 6);
}

function renderSessionDiagnostics() {
  const diagnostics = state.sessionDiagnostics;
  const currentCapture = diagnostics.currentCapture;

  if (!diagnostics.sessionId && !currentCapture && diagnostics.notices.length === 0 && !diagnostics.lastSummary) {
    elements.sessionDiagnosticsCurrent.textContent = "Session diagnostics will appear here after the next session starts.";
    elements.sessionDiagnosticsHistory.innerHTML =
      '<article class="event-log-empty">No capture notices yet.</article>';
    return;
  }

  const requestedPath = currentCapture
    ? createCapturePathLabel(currentCapture.requestedBackend, currentCapture.requestedProfile)
    : "Not requested yet";
  const resolvedPath = currentCapture
    ? createCapturePathLabel(currentCapture.backend, currentCapture.profile)
    : "Waiting for engine";
  const sampleRateText = currentCapture?.sampleRate ? `${currentCapture.sampleRate} Hz` : "Pending";
  const bufferText =
    currentCapture?.bufferMs || currentCapture?.numberOfBuffers
      ? `${currentCapture.bufferMs ?? "?"} ms / ${currentCapture.numberOfBuffers ?? "?"} buffers`
      : "Pending";
  const eventSyncText =
    currentCapture?.useEventSync !== undefined ? String(currentCapture.useEventSync) : "Pending";
  const attemptsText = currentCapture?.startAttemptCount ? String(currentCapture.startAttemptCount) : "1";
  const maxChunkGapText =
    currentCapture?.maxChunkGapMs !== undefined ? `${currentCapture.maxChunkGapMs} ms` : "Pending";
  const lowSignalText =
    currentCapture?.lowSignalEventCount !== undefined || currentCapture?.lowSignalChunkCount !== undefined
      ? `${currentCapture?.lowSignalEventCount ?? 0} event(s) / ${currentCapture?.lowSignalChunkCount ?? 0} chunk(s)`
      : "Pending";
  const summaryText = diagnostics.lastSummary
    ? `Score ${diagnostics.lastSummary.totalScore}, accuracy ${diagnostics.lastSummary.accuracy}, notes ${diagnostics.lastSummary.notesHit}/${diagnostics.lastSummary.notesDetected}.`
    : "Session is still running or waiting for summary.";

  elements.sessionDiagnosticsCurrent.innerHTML = `
    <div class="diagnostics-grid">
      <div class="diagnostics-metric">
        <strong>Session</strong>
        <span>${escapeHtml(diagnostics.sessionId ?? "Not started")}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Input mode</strong>
        <span>${escapeHtml(diagnostics.inputMode ?? "Unknown")}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Requested path</strong>
        <span>${escapeHtml(requestedPath)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Resolved path</strong>
        <span>${escapeHtml(resolvedPath)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Device</strong>
        <span>${escapeHtml(currentCapture?.deviceName ?? "Waiting for engine")}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Start attempts</strong>
        <span>${escapeHtml(attemptsText)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Sample rate</strong>
        <span>${escapeHtml(sampleRateText)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Buffer</strong>
        <span>${escapeHtml(bufferText)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Event sync</strong>
        <span>${escapeHtml(eventSyncText)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Fallback</strong>
        <span>${escapeHtml(currentCapture?.fallbackApplied ? "Applied" : "No")}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Max chunk gap</strong>
        <span>${escapeHtml(maxChunkGapText)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Low signal</strong>
        <span>${escapeHtml(lowSignalText)}</span>
      </div>
    </div>
    <div class="diagnostics-summary">
      <p>${escapeHtml(currentCapture?.fallbackReason ?? summaryText)}</p>
    </div>
  `;

  if (diagnostics.notices.length === 0) {
    elements.sessionDiagnosticsHistory.innerHTML =
      '<article class="event-log-empty">No capture notices yet.</article>';
    return;
  }

  elements.sessionDiagnosticsHistory.innerHTML = diagnostics.notices
    .map((notice) => {
      const noticePath = notice.capture
        ? [
            notice.capture.requestedBackend && notice.capture.requestedProfile
              ? `requested ${notice.capture.requestedBackend.toUpperCase()} ${notice.capture.requestedProfile}`
              : null,
            notice.capture.backend && notice.capture.profile
              ? `resolved ${notice.capture.backend.toUpperCase()} ${notice.capture.profile}`
              : null,
            notice.capture.startAttemptCount
              ? `attempt ${notice.capture.startAttemptCount}`
              : null
          ]
            .filter(Boolean)
            .join(", ")
        : "";

      return `
        <article class="event-log-entry">
          <strong>${escapeHtml(notice.code)}</strong>
          <p>${escapeHtml(`${notice.message}${noticePath ? ` (${noticePath})` : ""}`)}</p>
        </article>
      `;
    })
    .join("");
}

function createSessionDiagnosticsPayload() {
  return {
    ...(state.sessionDiagnostics.currentCapture
      ? {
          currentCapture: mergeDefinedFields({}, state.sessionDiagnostics.currentCapture)
        }
      : {}),
    ...(state.sessionDiagnostics.notices.length > 0
      ? {
          notices: state.sessionDiagnostics.notices
            .slice()
            .reverse()
            .map((notice) => ({
              code: notice.code,
              level: notice.level,
              message: notice.message,
              timestamp: notice.timestamp,
              ...(notice.capture
                ? {
                    capture: mergeDefinedFields({}, notice.capture)
                  }
                : {})
            }))
        }
      : {})
  };
}

function renderNativeBackends() {
  const availableBackends = state.nativeDevices.length > 0
    ? [...new Set(state.nativeDevices.map((device) => device.backend))]
    : ["wavein", "wasapi"];
  const currentBackend = availableBackends.includes(elements.nativeBackend.value)
    ? elements.nativeBackend.value
    : availableBackends[0];

  elements.nativeBackend.innerHTML = availableBackends
    .map((backend) => `<option value="${backend}">${escapeHtml(backend.toUpperCase())}</option>`)
    .join("");
  elements.nativeBackend.value = currentBackend;
}

function renderNativeDevices() {
  const currentBackend = elements.nativeBackend.value;
  const devices = state.nativeDevices.filter((device) => device.backend === currentBackend);
  const renderedDevices = devices.length > 0
    ? devices
    : [{ backend: currentBackend, deviceId: null, deviceNumber: 0, name: "Device 0", isDefault: false }];
  const previousValue = elements.inputDeviceNumber.value;

  elements.inputDeviceNumber.innerHTML = renderedDevices
    .map(
      (device) =>
        `<option value="${escapeHtml(device.deviceId ?? `${device.backend}:${device.deviceNumber}`)}" data-device-number="${device.deviceNumber}">
          ${escapeHtml(
            `${device.name} (${device.backend.toUpperCase()} ${device.deviceNumber})${
              device.inputKind ? ` [${device.inputKind}]` : ""
            }${device.isRecommendedPath ? " [recommended]" : ""}${device.isDefault ? " [default]" : ""}`
          )}
        </option>`
    )
    .join("");

  if ([...elements.inputDeviceNumber.options].some((option) => option.value === previousValue)) {
    elements.inputDeviceNumber.value = previousValue;
    renderSessionCaptureRecommendation();
    return;
  }

  const defaultDevice = renderedDevices.find((device) => device.isDefault) ?? renderedDevices[0];
  elements.inputDeviceNumber.value = defaultDevice.deviceId ?? `${defaultDevice.backend}:${defaultDevice.deviceNumber}`;
  renderSessionCaptureRecommendation();
}

function getSelectedNativeDevice() {
  const selectedValue = elements.inputDeviceNumber.value;
  const backend = elements.nativeBackend.value;
  const selectedDevice =
    state.nativeDevices.find((device) => {
      const deviceValue = device.deviceId ?? `${device.backend}:${device.deviceNumber}`;
      return deviceValue === selectedValue;
    }) ??
    state.nativeDevices.find((device) => device.backend === backend) ?? {
      backend,
      deviceId: null,
      deviceNumber: 0,
      name: "Device 0",
      isDefault: false
    };

  return selectedDevice;
}

function getRecommendedNativeDevice() {
  return (
    state.nativeDevices.find(
      (device) => device.isRecommendedPath && device.inputKind === "audio-interface"
    ) ??
    state.nativeDevices.find(
      (device) => device.isRecommendedPath && device.isDefault
    ) ??
    state.nativeDevices.find((device) => device.isRecommendedPath) ??
    state.nativeDevices.find((device) => device.isDefault) ??
    state.nativeDevices[0] ??
    null
  );
}

function applyRecommendedNativeSetup() {
  const recommendedDevice = getRecommendedNativeDevice();

  if (!recommendedDevice) {
    return;
  }

  if (recommendedDevice.recommendedProfile) {
    elements.captureProfile.value = recommendedDevice.recommendedProfile;
  }

  elements.nativeBackend.value = recommendedDevice.recommendedBackend ?? recommendedDevice.backend;
  renderNativeBackends();
  renderNativeDevices();
  elements.inputDeviceNumber.value =
    recommendedDevice.deviceId ?? `${recommendedDevice.backend}:${recommendedDevice.deviceNumber}`;
  renderSessionCaptureRecommendation();
}

function getNativePreflightSnapshot() {
  const selectedNativeDevice = getSelectedNativeDevice();

  return {
    captureDurationMs: Number(elements.captureDurationMs.value),
    captureProfile: elements.captureProfile.value,
    inputDeviceBackend: selectedNativeDevice.backend,
    inputDeviceId: selectedNativeDevice.deviceId,
    inputDeviceNumber: selectedNativeDevice.deviceNumber
  };
}

function createNativePreflightCacheKey(snapshot) {
  return JSON.stringify(snapshot);
}

function invalidateNativePreflight(message = "Native preflight has not run yet.") {
  state.lastNativePreflight = null;
  setStatus(elements.nativePreflightStatus, null, message);
}

async function requestNativePreflight() {
  const snapshot = getNativePreflightSnapshot();
  const response = await requestEngineMessage("native.preflight.request", snapshot, {
    responseType: "native.preflight.response"
  });

  state.lastNativePreflight = {
    key: createNativePreflightCacheKey(snapshot),
    response: response.payload
  };

  return response.payload;
}

async function ensureNativePreflight() {
  const snapshot = getNativePreflightSnapshot();
  const cacheKey = createNativePreflightCacheKey(snapshot);

  if (state.lastNativePreflight?.key === cacheKey && state.lastNativePreflight.response?.ok) {
    pushEventLog("Native preflight", "Using cached preflight result for the current native capture settings.");
    return state.lastNativePreflight.response;
  }

  const response = await requestNativePreflight();

  if (!response.ok) {
    throw new Error("Native preflight failed. Check the selected device and backend before starting the session.");
  }

  return response;
}

async function request(path, options = {}) {
  const authHeaders = state.auth.token
    ? { Authorization: `Bearer ${state.auth.token}` }
    : {};

  const response = await fetch(`${state.backendUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(options.headers ?? {})
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Telemetry / crash reporting
// ---------------------------------------------------------------------------

/**
 * Minimum milliseconds between two reports of the same error message.
 * Prevents flooding the backend when a recurring error fires on every frame.
 */
const TELEMETRY_DEBOUNCE_MS = 5000;

const _telemetryLastReported = new Map();

/**
 * Silently sends an error report to the backend telemetry endpoint.
 * Never throws — failure is intentionally swallowed so the reporter itself
 * cannot cause additional errors.
 *
 * @param {"js-error"|"unhandled-rejection"|"manual-report"} eventType
 * @param {string} message
 * @param {{ stack?: string, url?: string }} [extra]
 */
function reportTelemetryEvent(eventType, message, extra = {}) {
  const now = Date.now();
  const dedupeKey = `${eventType}:${message}`;
  const lastSent = _telemetryLastReported.get(dedupeKey) ?? 0;

  if (now - lastSent < TELEMETRY_DEBOUNCE_MS) {
    return;
  }

  _telemetryLastReported.set(dedupeKey, now);

  const payload = {
    eventType,
    message: String(message).slice(0, 2000),
    ...(extra.stack ? { stack: String(extra.stack).slice(0, 8000) } : {}),
    ...(extra.url ? { url: String(extra.url).slice(0, 2000) } : {}),
    ...(state.auth.userId ? { userId: state.auth.userId } : {}),
    appContext: {
      backendUrl: state.backendUrl,
      engineUrl: state.engineUrl,
      pathname: window.location.pathname
    }
  };

  // Use sendBeacon when available so the request survives page unloads;
  // fall back to a best-effort fetch otherwise.
  const endpoint = `${state.backendUrl}/telemetry/events`;

  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, JSON.stringify(payload));
  } else {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    }).catch(() => { /* intentionally silent */ });
  }
}

window.onerror = (message, source, lineno, colno, error) => {
  reportTelemetryEvent("js-error", message, {
    stack: error?.stack,
    url: source
  });
  // Return false to let the default handler still log to the console.
  return false;
};

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  reportTelemetryEvent("unhandled-rejection", message, {
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

const ONBOARDING_STORAGE_KEY = "riffrush_onboarding_v1";

function hasCompletedOnboarding(userId) {
  try {
    return localStorage.getItem(`${ONBOARDING_STORAGE_KEY}_${userId}`) === "done";
  } catch {
    return false;
  }
}

function markOnboardingComplete(userId) {
  try {
    localStorage.setItem(`${ONBOARDING_STORAGE_KEY}_${userId}`, "done");
  } catch { /* storage unavailable — proceed silently */ }
}

function showOnboardingOverlay() {
  elements.onboardingOverlay.hidden = false;
  elements.appContent.hidden = true;
}

function hideOnboardingOverlay() {
  stopOnboardingEnginePoll();
  elements.onboardingOverlay.hidden = true;
  elements.appContent.hidden = false;
}

function setOnboardingStep(step) {
  state.onboarding.step = step;

  elements.onboardingStep1.hidden = step !== 1;
  elements.onboardingStep2.hidden = step !== 2;
  elements.onboardingStep3.hidden = step !== 3;

  // Dot states: done (past) → active (current) → idle (future)
  const dots = [elements.onboardingDot1, elements.onboardingDot2, elements.onboardingDot3];
  dots.forEach((dot, index) => {
    const dotStep = index + 1;
    dot.classList.toggle("onboarding-dot-done",   dotStep < step);
    dot.classList.toggle("onboarding-dot-active",  dotStep === step);
  });

  if (step === 2) {
    startOnboardingEnginePoll();
  } else {
    stopOnboardingEnginePoll();
  }
}

function startOnboardingEnginePoll() {
  stopOnboardingEnginePoll();
  void checkOnboardingEngineHealth();
  state.onboarding.enginePollTimer = setInterval(() => void checkOnboardingEngineHealth(), 2000);
}

function stopOnboardingEnginePoll() {
  if (state.onboarding.enginePollTimer !== null) {
    clearInterval(state.onboarding.enginePollTimer);
    state.onboarding.enginePollTimer = null;
  }
}

async function checkOnboardingEngineHealth() {
  // Derive HTTP base URL from the WebSocket URL (ws://host/ws → http://host)
  const engineBaseUrl = state.engineUrl.replace(/^ws/, "http").replace(/\/ws$/, "");
  try {
    const response = await fetch(`${engineBaseUrl}/health`, {
      signal: AbortSignal.timeout(1500)
    });
    if (response.ok) {
      setOnboardingEngineStatus("connected");
      return;
    }
  } catch { /* engine not yet reachable */ }
  setOnboardingEngineStatus("checking");
}

function setOnboardingEngineStatus(status) {
  elements.onboardingStatusDot.className = `onboarding-status-dot onboarding-status-${status}`;

  if (status === "connected") {
    elements.onboardingEngineStatusText.textContent = "Engine connected — ready to continue.";
    elements.onboardingNext2.disabled = false;
    stopOnboardingEnginePoll();
  } else {
    elements.onboardingEngineStatusText.textContent = "Checking for engine…";
    elements.onboardingNext2.disabled = true;
  }
}

function initOnboarding() {
  const userId = state.auth.userId;
  if (!userId || hasCompletedOnboarding(userId)) return;
  showOnboardingOverlay();
  setOnboardingStep(1);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const AUTH_STORAGE_KEY = "riffrush_auth";

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAuthToStorage(token, userId, email) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, userId, email }));
}

function clearAuthFromStorage() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function applyAuthState(token, userId, email) {
  state.auth.token = token;
  state.auth.userId = userId;
  state.auth.email = email;
  elements.userBar.hidden = false;
  elements.userBarEmail.textContent = email;
  elements.userId.value = userId;
}

function clearAuthState() {
  state.auth.token = null;
  state.auth.userId = null;
  state.auth.email = null;
  elements.userBar.hidden = true;
  elements.userBarEmail.textContent = "";
}

function showAuthPanel() {
  elements.authPanel.hidden = false;
  elements.appContent.hidden = true;
}

function hideAuthPanel() {
  elements.authPanel.hidden = true;
  elements.appContent.hidden = false;
}

function getActiveUserId() {
  return state.auth.userId || elements.userId.value.trim();
}

function setAuthError(errorEl, message) {
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function clearAuthError(errorEl) {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

async function handleLogin(event) {
  event.preventDefault();
  clearAuthError(elements.authLoginError);

  const email = elements.authLoginEmail.value.trim();
  const password = elements.authLoginPassword.value;

  try {
    const payload = await fetch(`${state.backendUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw Object.assign(new Error(body?.error?.message ?? "Login failed"), { code: body?.error?.code });
      return body;
    });

    const { token, userId } = payload.data;
    applyAuthState(token, userId, email.toLowerCase());
    saveAuthToStorage(token, userId, email.toLowerCase());
    elements.authLoginPassword.value = "";
    hideAuthPanel();
    initOnboarding();
  } catch (error) {
    setAuthError(elements.authLoginError, error.message || "Login failed. Check your credentials.");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  clearAuthError(elements.authRegisterError);

  const email = elements.authRegisterEmail.value.trim();
  const password = elements.authRegisterPassword.value;

  try {
    const payload = await fetch(`${state.backendUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw Object.assign(new Error(body?.error?.message ?? "Registration failed"), { code: body?.error?.code });
      return body;
    });

    const { token, userId } = payload.data;
    applyAuthState(token, userId, email.toLowerCase());
    saveAuthToStorage(token, userId, email.toLowerCase());
    elements.authRegisterPassword.value = "";
    hideAuthPanel();
    initOnboarding();
  } catch (error) {
    setAuthError(elements.authRegisterError, error.message || "Registration failed. Please try again.");
  }
}

function handleLogout() {
  clearAuthState();
  clearAuthFromStorage();
  showAuthPanel();
}

async function initAuth() {
  const stored = loadAuthFromStorage();
  if (!stored) {
    showAuthPanel();
    return;
  }

  // Verify token is still valid
  try {
    const response = await fetch(`${state.backendUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${stored.token}` }
    });
    if (!response.ok) throw new Error("Token invalid");
    applyAuthState(stored.token, stored.userId, stored.email);
    hideAuthPanel();
    initOnboarding();
  } catch {
    clearAuthFromStorage();
    showAuthPanel();
  }
}

function switchAuthTab(tab) {
  if (tab === "login") {
    elements.authTabLogin.classList.add("auth-tab-active");
    elements.authTabRegister.classList.remove("auth-tab-active");
    elements.authFormLogin.hidden = false;
    elements.authFormRegister.hidden = true;
    clearAuthError(elements.authLoginError);
  } else {
    elements.authTabRegister.classList.add("auth-tab-active");
    elements.authTabLogin.classList.remove("auth-tab-active");
    elements.authFormRegister.hidden = false;
    elements.authFormLogin.hidden = true;
    clearAuthError(elements.authRegisterError);
  }
}

// ---------------------------------------------------------------------------
// Gameplay
// ---------------------------------------------------------------------------

const HIGHWAY_VISIBLE_MS = 4000;  // how many ms of notes are visible at once
const HIGHWAY_PLAYHEAD_RATIO = 0.25; // playhead at 25% from left
const NOTE_MIN_WIDTH_PX = 56;
const NOTE_PADDING_PX = 4;

/**
 * Builds an array of timed targets from training data.
 * Mirrors the timing calculation the engine uses (leadIn = 1 beat).
 */
function buildGameplayTargets(training, tempoBpm, practiceScope, loopSectionId, loopRepetitionCount, loopTempoStepBpm) {
  const beatDurationMs = 60000 / tempoBpm;
  const leadInMs = Math.round(beatDurationMs); // 1 lead-in beat

  const sections = training.chart?.sections ?? [];
  const allTargets = training.targetSequence ?? [];

  let baseTargets;
  let sectionStartBeat = 0;
  let sectionLengthBeats;
  let repetitions = 1;
  let tempoStep = 0;

  if (practiceScope === "section-loop" && loopSectionId) {
    const section = sections.find((s) => s.id === loopSectionId) ?? null;
    sectionStartBeat = section?.startBeat ?? 0;
    sectionLengthBeats = section?.lengthBeats ?? 0;
    repetitions = Math.max(1, Math.min(6, loopRepetitionCount ?? 1));
    tempoStep = Math.max(0, Math.min(16, loopTempoStepBpm ?? 0));
    baseTargets = allTargets
      .filter((t) => t.sectionId === loopSectionId)
      .map((t) => ({ ...t, beatOffset: Number((t.beatOffset - sectionStartBeat).toFixed(4)) }));
  } else {
    sectionLengthBeats = allTargets.reduce(
      (max, t) => Math.max(max, t.beatOffset + t.durationBeats),
      0
    );
    baseTargets = allTargets;
  }

  const targets = [];
  let currentStartMs = leadInMs;
  let targetIndex = 0;

  for (let rep = 0; rep < repetitions; rep++) {
    const repBpm = tempoBpm + rep * tempoStep;
    const repBeatMs = 60000 / repBpm;
    const repDurationMs = Math.round(sectionLengthBeats * repBeatMs);

    for (const t of baseTargets) {
      targets.push({
        index: targetIndex++,
        note: t.note,
        stringNumber: t.stringNumber,
        sectionId: t.sectionId,
        expectedTimeMs: Math.round(currentStartMs + t.beatOffset * repBeatMs),
        durationMs: Math.round(t.durationBeats * repBeatMs),
        repetitionIndex: rep,
        state: "pending",
        el: null
      });
    }

    currentStartMs += repDurationMs;
  }

  return { targets, leadInMs, beatDurationMs };
}

/** Creates a DOM element for one highway note. */
function createNoteElement(target, highwayWidth, pxPerMs) {
  const el = document.createElement("div");
  el.className = "gameplay-note";

  const noteWidth = Math.max(NOTE_MIN_WIDTH_PX, Math.round(target.durationMs * pxPerMs) - NOTE_PADDING_PX);
  el.style.width = `${noteWidth}px`;

  // Initial left position (will be overridden by container translate each frame)
  const noteLeft = Math.round(target.expectedTimeMs * pxPerMs);
  el.style.left = `${noteLeft}px`;

  const pitch = document.createElement("span");
  pitch.className = "gameplay-note-pitch";
  pitch.textContent = target.note;

  const string = document.createElement("span");
  string.className = "gameplay-note-string";
  string.textContent = `str ${target.stringNumber}`;

  el.appendChild(pitch);
  el.appendChild(string);
  return el;
}

/** Opens the gameplay overlay and initialises the highway. */
function openGameplayOverlay(training, sessionStartedPayload) {
  const tempoBpm = sessionStartedPayload.tempoBpm ?? training.tempoBpm ?? 80;
  const practiceScope = sessionStartedPayload.practiceScope ?? "full-chart";
  const loopSectionId = sessionStartedPayload.loopSectionId ?? null;
  const loopRepetitionCount = sessionStartedPayload.loopRepetitionCount ?? 1;
  const loopTempoStepBpm = sessionStartedPayload.loopTempoStepBpm ?? 0;

  const { targets, leadInMs, beatDurationMs } = buildGameplayTargets(
    training,
    tempoBpm,
    practiceScope,
    loopSectionId,
    loopRepetitionCount,
    loopTempoStepBpm
  );

  // Measure highway width now (overlay is about to become visible)
  elements.gameplayOverlay.hidden = false;
  const highwayWidth = elements.gameplayHighway.clientWidth || window.innerWidth;
  const pxPerMs = highwayWidth / HIGHWAY_VISIBLE_MS;

  // Reset gameplay state
  state.gameplay.active = true;
  state.gameplay.startedAt = Date.now();
  state.gameplay.trainingName = training.title;
  state.gameplay.tempoBpm = tempoBpm;
  state.gameplay.leadInMs = leadInMs;
  state.gameplay.totalScore = 0;
  state.gameplay.hitCount = 0;
  state.gameplay.missCount = 0;
  state.gameplay.comboMultiplier = 1;
  state.gameplay.targets = targets;
  state.gameplay.pxPerMs = pxPerMs;

  // Populate header
  elements.gameplayTrainingName.textContent = training.title;
  elements.gameplayTempoLabel.textContent = `${tempoBpm} BPM${
    practiceScope === "section-loop" && loopSectionId ? ` · section loop` : ""
  }`;
  elements.gameplayScore.textContent = "0";
  elements.gameplayCombo.textContent = "×1";
  elements.gameplayAccuracy.textContent = "—";

  // Build note DOM elements
  elements.gameplayNotes.innerHTML = "";
  const playheadOffsetPx = Math.round(highwayWidth * HIGHWAY_PLAYHEAD_RATIO);

  for (const target of targets) {
    const el = createNoteElement(target, highwayWidth, pxPerMs);
    target.el = el;
    elements.gameplayNotes.appendChild(el);
  }

  // Hide results, show countdown
  elements.gameplayResults.hidden = true;
  elements.gameplayFeedback.hidden = true;
  elements.gameplayCountdown.hidden = false;
  elements.gameplayCountdown.textContent = "Get Ready";

  // Start animation loop
  state.gameplay.rafId = requestAnimationFrame(gameplayRenderFrame);

  // Hide countdown after lead-in
  setTimeout(() => {
    elements.gameplayCountdown.hidden = true;
  }, Math.max(200, leadInMs - beatDurationMs * 0.1));
}

/** requestAnimationFrame loop — scrolls the note highway. */
function gameplayRenderFrame() {
  if (!state.gameplay.active) return;

  const elapsed = Date.now() - state.gameplay.startedAt;
  const playheadOffsetPx = Math.round(
    (elements.gameplayHighway.clientWidth || window.innerWidth) * HIGHWAY_PLAYHEAD_RATIO
  );
  const pxPerMs = state.gameplay.pxPerMs;

  // Translate the notes container so notes scroll right-to-left
  const containerX = playheadOffsetPx - elapsed * pxPerMs;
  elements.gameplayNotes.style.transform = `translateX(${containerX}px)`;

  state.gameplay.rafId = requestAnimationFrame(gameplayRenderFrame);
}

/** Called when a score.event arrives during an active gameplay session. */
function onGameplayScoreEvent(payload) {
  if (!state.gameplay.active) return;

  const { targetIndex, eventKind, hit, timingClass, scoreDelta, comboCount, comboMultiplier } = payload;

  // Update running totals
  state.gameplay.totalScore += scoreDelta ?? 0;
  state.gameplay.comboMultiplier = comboMultiplier ?? 1;

  if (eventKind === "target-hit") {
    state.gameplay.hitCount++;
  } else if (eventKind === "missed-target") {
    state.gameplay.missCount++;
  }

  // Update accuracy display
  const evaluated = state.gameplay.hitCount + state.gameplay.missCount;
  if (evaluated > 0) {
    const acc = Math.round((state.gameplay.hitCount / evaluated) * 100);
    elements.gameplayAccuracy.textContent = `${acc}%`;
  }

  elements.gameplayScore.textContent = String(state.gameplay.totalScore);
  elements.gameplayCombo.textContent = `×${comboMultiplier ?? 1}`;

  // Mark note on the highway
  const target = state.gameplay.targets.find((t) => t.index === targetIndex);
  if (target?.el) {
    if (eventKind === "target-hit") {
      target.state = "hit";
      target.el.classList.add("is-hit");
    } else if (eventKind === "missed-target") {
      target.state = "miss";
      target.el.classList.add("is-miss");
    }
  }

  // Show feedback flash
  showGameplayFeedback(eventKind, timingClass, hit);
}

/** Brief feedback label near the playhead. */
function showGameplayFeedback(eventKind, timingClass, hit) {
  if (state.gameplay.feedbackTimer) {
    clearTimeout(state.gameplay.feedbackTimer);
  }

  elements.gameplayFeedback.className = "gameplay-feedback";

  if (eventKind === "ghost-note") {
    elements.gameplayFeedback.textContent = "Ghost";
    elements.gameplayFeedback.classList.add("is-miss");
  } else if (eventKind === "missed-target") {
    elements.gameplayFeedback.textContent = "Miss";
    elements.gameplayFeedback.classList.add("is-miss");
  } else if (timingClass === "on-time") {
    elements.gameplayFeedback.textContent = hit ? "Perfect!" : "Near";
    elements.gameplayFeedback.classList.add("is-hit");
  } else if (timingClass === "early" || timingClass === "late") {
    elements.gameplayFeedback.textContent = timingClass === "early" ? "Early" : "Late";
    elements.gameplayFeedback.classList.add("is-late");
  } else {
    elements.gameplayFeedback.textContent = hit ? "Hit" : "Miss";
    elements.gameplayFeedback.classList.add(hit ? "is-hit" : "is-miss");
  }

  elements.gameplayFeedback.hidden = false;

  state.gameplay.feedbackTimer = setTimeout(() => {
    elements.gameplayFeedback.hidden = true;
  }, 600);
}

/** Shows the results panel when session.summary arrives. */
function onGameplaySessionSummary(summaryPayload) {
  if (!state.gameplay.active) return;

  const grade = summaryPayload.rating?.grade ?? "—";
  const totalScore = summaryPayload.totalScore ?? state.gameplay.totalScore;
  const accuracy = summaryPayload.accuracy != null
    ? `${Math.round(summaryPayload.accuracy * 100)}% accuracy`
    : `${state.gameplay.hitCount} hit / ${state.gameplay.missCount} missed`;
  const feedbackSummary = summaryPayload.feedback?.summary ?? "";

  elements.gameplayResultsGrade.textContent = grade;
  elements.gameplayResultsScore.textContent = String(totalScore);
  elements.gameplayResultsAccuracy.textContent = accuracy;
  elements.gameplayResultsFeedback.textContent = feedbackSummary;

  elements.gameplayResults.hidden = false;
}

/** Tears down the gameplay overlay and stops the animation loop. */
function closeGameplayOverlay() {
  state.gameplay.active = false;

  if (state.gameplay.rafId != null) {
    cancelAnimationFrame(state.gameplay.rafId);
    state.gameplay.rafId = null;
  }

  if (state.gameplay.feedbackTimer) {
    clearTimeout(state.gameplay.feedbackTimer);
    state.gameplay.feedbackTimer = null;
  }

  elements.gameplayOverlay.hidden = true;
  elements.gameplayNotes.innerHTML = "";
  elements.gameplayResults.hidden = true;
  elements.gameplayCountdown.hidden = true;
  elements.gameplayFeedback.hidden = true;
}

function createDiagnosticsFilterQuery() {
  const searchParams = new URLSearchParams();
  const deviceName = elements.diagnosticsDeviceFilter.value.trim();
  const backend = elements.diagnosticsBackendFilter.value;
  const profile = elements.diagnosticsProfileFilter.value;
  const sortBy = elements.diagnosticsSortBy.value;
  const sortDirection = elements.diagnosticsSortDirection.value;

  if (deviceName) {
    searchParams.set("deviceName", deviceName);
  }

  if (backend) {
    searchParams.set("backend", backend);
  }

  if (profile) {
    searchParams.set("profile", profile);
  }

  if (sortBy) {
    searchParams.set("sortBy", sortBy);
  }

  if (sortDirection) {
    searchParams.set("sortDirection", sortDirection);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function formatRatioAsPercent(value) {
  return `${Math.round((Number(value ?? 0) + Number.EPSILON) * 100)}%`;
}

function formatSortingLabel(sortBy, sortDirection) {
  const sortByLabels = {
    latest: "latest activity",
    fallbacks: "fallback count",
    fallbackRate: "fallback rate",
    attempts: "average start attempts",
    sessions: "session count"
  };
  const directionLabel = sortDirection === "asc" ? "ascending" : "descending";
  return `${sortByLabels[sortBy] ?? "latest activity"}, ${directionLabel}`;
}

function createCapturePathSummary(path) {
  return `${path.deviceName} via ${String(path.backend).toUpperCase()} [${path.profile}]`;
}

function getDiagnosticsDeviceNames(report) {
  const deviceNames = new Set();

  for (const entry of report?.insights?.deviceRecommendations ?? []) {
    if (entry.deviceName) {
      deviceNames.add(entry.deviceName);
    }
  }

  for (const path of report?.groupedPaths ?? []) {
    if (path.deviceName) {
      deviceNames.add(path.deviceName);
    }
  }

  return [...deviceNames].sort((left, right) => left.localeCompare(right));
}

function formatIssueStageLabel(stage) {
  if (stage === "preflight") {
    return "Preflight";
  }

  if (stage === "runtime") {
    return "Runtime";
  }

  return "Session";
}

function formatSetupRecommendations(setupRecommendations = []) {
  if (!setupRecommendations.length) {
    return "No setup actions suggested yet.";
  }

  return setupRecommendations
    .map((recommendation) => `${recommendation.title}: ${recommendation.detail}`)
    .join(" | ");
}

function formatPrimarySetupRecommendation(recommendation) {
  if (!recommendation?.title) {
    return "";
  }

  return `${recommendation.title}: ${recommendation.detail}`;
}

function formatSetupRecommendationStatus(status) {
  switch (status) {
    case "applied":
      return "Applied, waiting for outcome";
    case "improved":
      return "Improved the setup";
    case "no-improvement":
      return "No improvement recorded";
    default:
      return "Unknown";
  }
}

function formatSelectionSource(selectionSource) {
  if (selectionSource === "user-override-history") {
    return "User override history";
  }

  if (selectionSource === "technical-with-user-confirmation") {
    return "Technical + user confirmation";
  }

  if (selectionSource === "technical-with-setup-feedback") {
    return "Technical + setup feedback";
  }

  return "Technical score";
}

function formatSetupFeedbackSummary(setupFeedback) {
  if (!setupFeedback?.appliedCount) {
    return "No setup feedback recorded yet.";
  }

  const evaluatedCount = setupFeedback.evaluatedCount ?? 0;

  return `${setupFeedback.improvedCount}/${setupFeedback.appliedCount} improved, ${setupFeedback.noImprovementCount} no improvement${
    evaluatedCount ? `, success ${formatRatioAsPercent(setupFeedback.improvementRate ?? 0)}` : ", no evaluated outcomes yet"
  }.`;
}

function findSetupRecommendationHistoryEntry(path, recommendationId) {
  return (
    state.dashboard?.setupRecommendationHistory?.find(
      (entry) =>
        entry.recommendationId === recommendationId &&
        entry.backend === path.backend &&
        entry.profile === path.profile &&
        matchesDeviceName(entry.deviceName, path.deviceName)
    ) ?? null
  );
}

function applyDashboardUserUpdate(user) {
  const currentDashboard = state.dashboard ?? {
    stats: {
      completedSessions: 0,
      totalScore: 0,
      averageAccuracy: 0,
      streakDays: 0
    },
    targetedPractice: null,
    recentResults: []
  };

  state.dashboard = {
    ...currentDashboard,
    userId: user.id ?? currentDashboard.userId,
    calibrationProfile: user.calibrationProfile ?? currentDashboard.calibrationProfile ?? null,
    capturePreferences: user.capturePreferences ?? currentDashboard.capturePreferences,
    captureOverrideHistory: user.captureOverrideHistory ?? currentDashboard.captureOverrideHistory ?? [],
    setupRecommendationHistory: user.setupRecommendationHistory ?? currentDashboard.setupRecommendationHistory ?? [],
    stats: currentDashboard.stats,
    recentResults: currentDashboard.recentResults
  };
  elements.autoApplyCaptureRecommendation.checked =
    state.dashboard.capturePreferences?.autoApplyRecommendation ?? true;
  renderDashboard();
  renderDeviceDiagnosticsDetail();
  renderSessionCaptureRecommendation();
}

function normalizeDeviceName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function matchesDeviceName(left, right) {
  const normalizedLeft = normalizeDeviceName(left);
  const normalizedRight = normalizeDeviceName(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function findRecommendedCaptureDevice({ backend = "", deviceName = "" } = {}) {
  const backendMatchedDevices = backend
    ? state.nativeDevices.filter((device) => device.backend === backend)
    : state.nativeDevices;

  if (deviceName) {
    return (
      backendMatchedDevices.find((device) => matchesDeviceName(device.name, deviceName)) ??
      state.nativeDevices.find((device) => matchesDeviceName(device.name, deviceName)) ??
      backendMatchedDevices[0] ??
      null
    );
  }

  return backendMatchedDevices[0] ?? null;
}

function resolveCapturePathRecommendation(recommendedPath) {
  if (!recommendedPath?.backend || !recommendedPath?.profile) {
    return null;
  }

  const mappedDevice = findRecommendedCaptureDevice(recommendedPath);
  const appliedDeviceValue = mappedDevice
    ? mappedDevice.deviceId ?? `${mappedDevice.backend}:${mappedDevice.deviceNumber}`
    : null;
  const resolvedBackend = mappedDevice?.backend ?? recommendedPath.backend;
  const alreadyApplied =
    elements.inputMode.value === "native-capture" &&
    elements.captureProfile.value === recommendedPath.profile &&
    elements.nativeBackend.value === resolvedBackend &&
    (!appliedDeviceValue || elements.inputDeviceNumber.value === appliedDeviceValue);

  return {
    recommendedPath,
    mappedDevice,
    appliedDeviceValue,
    resolvedBackend,
    canApply: Boolean(mappedDevice),
    alreadyApplied
  };
}

function getSessionRecommendationSourceReport() {
  return state.sessionRecommendation.report ?? state.diagnosticsReport ?? null;
}

function getVerificationHoldTechnicalFallbackRouting() {
  return (
    state.dashboard?.targetedPractice?.verificationGate?.technicalFallbackRouting ??
    state.dashboard?.progressionSafety?.technicalFallbackRouting ??
    null
  );
}

function getVerificationHoldTechnicalFallbackRecommendation() {
  const routing = getVerificationHoldTechnicalFallbackRouting();

  if (!routing?.backend) {
    return null;
  }

  const recommendedPath = {
    backend: routing.backend,
    profile: routing.profile ?? elements.captureProfile.value,
    deviceName: routing.deviceName ?? ""
  };
  const resolvedRecommendation = resolveCapturePathRecommendation(recommendedPath);

  if (!resolvedRecommendation) {
    return null;
  }

  return {
    kind: "verification-hold",
    ...resolvedRecommendation,
    suspectedOrigin:
      state.dashboard?.targetedPractice?.verificationGate?.suspectedOrigin ??
      state.dashboard?.progressionSafety?.suspectedOrigin ??
      null,
    primarySetupRecommendation: routing.primarySetupRecommendation ?? null,
    reason: routing.reason ?? null,
    sourceNoticeCode: routing.sourceNoticeCode ?? null
  };
}

function getHistoricalCaptureRecommendation() {
  const recommendedPath = getSessionRecommendationSourceReport()?.insights?.recommendedPath ?? null;

  if (!recommendedPath) {
    return null;
  }

  return {
    kind: "historical",
    ...resolveCapturePathRecommendation(recommendedPath)
  };
}

function getActiveCaptureRecommendation() {
  return getVerificationHoldTechnicalFallbackRecommendation() ?? getHistoricalCaptureRecommendation();
}

function createRecommendedCapturePathSummary(recommendation) {
  if (!recommendation?.recommendedPath) {
    return "Not resolved yet";
  }

  return createCapturePathSummary({
    deviceName:
      recommendation.mappedDevice?.name ??
      recommendation.recommendedPath.deviceName ??
      "recommended device",
    backend: recommendation.resolvedBackend ?? recommendation.recommendedPath.backend,
    profile: recommendation.recommendedPath.profile
  });
}

function createSessionRecommendationKey(userId, deviceName) {
  return JSON.stringify({
    userId,
    deviceName: normalizeDeviceName(deviceName)
  });
}

async function refreshSessionCaptureRecommendation({ force = false } = {}) {
  state.backendUrl = elements.backendUrl.value.trim();
  const userId = getActiveUserId();

  if (state.nativeDevices.length === 0) {
    state.sessionRecommendation = {
      key: null,
      report: null,
      pendingKey: null
    };
    renderSessionCaptureRecommendation();
    return;
  }

  const selectedNativeDevice = getSelectedNativeDevice();
  const selectedDeviceName = selectedNativeDevice?.name ?? "";

  if (!userId || !selectedDeviceName) {
    state.sessionRecommendation = {
      key: null,
      report: null,
      pendingKey: null
    };
    renderSessionCaptureRecommendation();
    return;
  }

  const recommendationKey = createSessionRecommendationKey(userId, selectedDeviceName);

  if (!force && state.sessionRecommendation.key === recommendationKey && state.sessionRecommendation.report) {
    renderSessionCaptureRecommendation();
    return;
  }

  state.sessionRecommendation = {
    ...state.sessionRecommendation,
    pendingKey: recommendationKey
  };
  setStatus(
    elements.captureRecommendationStatus,
    null,
    `Loading historical recommendation for ${selectedDeviceName}...`
  );
  elements.applyCaptureRecommendationButton.disabled = true;

  try {
    const response = await request(
      `/users/${encodeURIComponent(userId)}/diagnostics?deviceName=${encodeURIComponent(selectedDeviceName)}&sortBy=fallbackRate&sortDirection=asc`
    );

    if (state.sessionRecommendation.pendingKey !== recommendationKey) {
      return;
    }

    state.sessionRecommendation = {
      key: recommendationKey,
      report: response.data,
      pendingKey: null
    };
    renderSessionCaptureRecommendation();
  } catch (error) {
    if (state.sessionRecommendation.pendingKey !== recommendationKey) {
      return;
    }

    state.sessionRecommendation = {
      key: recommendationKey,
      report: null,
      pendingKey: null
    };
    setStatus(
      elements.captureRecommendationStatus,
      "error",
      `Could not load historical recommendation: ${error.message}`
    );
  }
}

function renderSessionCaptureRecommendation() {
  const technicalFallbackRecommendation = getVerificationHoldTechnicalFallbackRecommendation();
  const recommendationReport = getSessionRecommendationSourceReport();
  const recommendation = technicalFallbackRecommendation ?? getHistoricalCaptureRecommendation();

  if (!technicalFallbackRecommendation && state.sessionRecommendation.pendingKey) {
    elements.applyCaptureRecommendationButton.disabled = true;
    return;
  }

  if (technicalFallbackRecommendation) {
    const recommendationSummary = createRecommendedCapturePathSummary(technicalFallbackRecommendation);
    const setupFollowup = technicalFallbackRecommendation.primarySetupRecommendation
      ? ` Next technical step: ${formatPrimarySetupRecommendation(
          technicalFallbackRecommendation.primarySetupRecommendation
        )}`
      : "";

    if (state.nativeDevices.length === 0) {
      elements.applyCaptureRecommendationButton.disabled = true;
      setStatus(
        elements.captureRecommendationStatus,
        "warning",
        `Verification hold suggests a safer native path: ${recommendationSummary}. Load input devices to map it to this machine.${setupFollowup}`
      );
      return;
    }

    if (!technicalFallbackRecommendation.canApply) {
      elements.applyCaptureRecommendationButton.disabled = true;
      setStatus(
        elements.captureRecommendationStatus,
        "warning",
        `Verification hold suggests a safer native path: ${recommendationSummary}. No matching local device is currently loaded.${setupFollowup}`
      );
      return;
    }

    if (technicalFallbackRecommendation.alreadyApplied) {
      elements.applyCaptureRecommendationButton.disabled = true;
      setStatus(
        elements.captureRecommendationStatus,
        "success",
        `Current session form already matches the verification-hold fallback: ${recommendationSummary}.${setupFollowup}`
      );
      return;
    }

    elements.applyCaptureRecommendationButton.disabled = false;
    setStatus(
      elements.captureRecommendationStatus,
      "warning",
      `Verification hold suggests a safer native path: ${recommendationSummary}. ${
        elements.autoApplyCaptureRecommendation.checked
          ? "It will be auto-applied on session start unless you disable it."
          : "Click Apply recommendation to use these settings."
      }${setupFollowup}`
    );
    return;
  }

  if (!recommendationReport) {
    elements.applyCaptureRecommendationButton.disabled = true;
    setStatus(
      elements.captureRecommendationStatus,
      null,
      "Load dashboard data to unlock recommended capture paths for the current session form."
    );
    return;
  }

  if (!recommendation) {
    elements.applyCaptureRecommendationButton.disabled = true;
    setStatus(
      elements.captureRecommendationStatus,
      null,
      "No historical recommendation is available yet for the selected device."
    );
    return;
  }

  if (state.nativeDevices.length === 0) {
    elements.applyCaptureRecommendationButton.disabled = true;
    setStatus(
      elements.captureRecommendationStatus,
      null,
      `Historical best path: ${createRecommendedCapturePathSummary(recommendation)}. Load input devices to map it to this machine.`
    );
    return;
  }

  if (!recommendation.canApply) {
    elements.applyCaptureRecommendationButton.disabled = true;
    setStatus(
      elements.captureRecommendationStatus,
      null,
      `Historical best path: ${createRecommendedCapturePathSummary(recommendation)}. No matching local device is currently loaded.`
    );
    return;
  }

  if (recommendation.alreadyApplied) {
    elements.applyCaptureRecommendationButton.disabled = true;
    setStatus(
      elements.captureRecommendationStatus,
      "success",
      `Current session form already matches the historical recommendation: ${createRecommendedCapturePathSummary(recommendation)}.`
    );
    return;
  }

  elements.applyCaptureRecommendationButton.disabled = false;
  setStatus(
    elements.captureRecommendationStatus,
    "success",
    `Suggested native path: ${createRecommendedCapturePathSummary(recommendation)}. ${
      elements.autoApplyCaptureRecommendation.checked
        ? "It will be auto-applied on session start unless you disable it."
        : "Click Apply recommendation to use these settings."
    }`
  );
}

function applyVerificationHoldTechnicalFallbackRecommendation({ source = "manual" } = {}) {
  const recommendation = getVerificationHoldTechnicalFallbackRecommendation();

  if (!recommendation?.canApply) {
    setStatus(
      elements.captureRecommendationStatus,
      "error",
      "No applicable verification-hold fallback is available for the currently loaded devices."
    );
    return;
  }

  elements.inputMode.value = "native-capture";
  elements.captureProfile.value = recommendation.recommendedPath.profile;
  elements.nativeBackend.value = recommendation.resolvedBackend;
  renderNativeBackends();
  elements.nativeBackend.value = recommendation.resolvedBackend;
  renderNativeDevices();

  if (
    recommendation.appliedDeviceValue &&
    [...elements.inputDeviceNumber.options].some((option) => option.value === recommendation.appliedDeviceValue)
  ) {
    elements.inputDeviceNumber.value = recommendation.appliedDeviceValue;
  }

  invalidateNativePreflight("Native preflight needs rerun after applying the verification-hold fallback.");
  renderSessionCaptureRecommendation();
  pushEventLog(
    "Capture recommendation",
    `${
      source === "auto" ? "Auto-applied" : "Applied"
    } verification-hold fallback: ${createRecommendedCapturePathSummary(recommendation)}.${
      recommendation.primarySetupRecommendation
        ? ` Technical focus: ${formatPrimarySetupRecommendation(recommendation.primarySetupRecommendation)}.`
        : ""
    }`
  );
  setStatus(
    elements.captureRecommendationStatus,
    "success",
    `${
      source === "auto" ? "Auto-applied" : "Applied"
    } verification-hold fallback: ${createRecommendedCapturePathSummary(recommendation)}.${
      recommendation.primarySetupRecommendation
        ? ` Technical focus: ${formatPrimarySetupRecommendation(recommendation.primarySetupRecommendation)}.`
        : ""
    }`
  );
}

function applyHistoricalCaptureRecommendation({ source = "manual" } = {}) {
  const recommendation = getHistoricalCaptureRecommendation();

  if (!recommendation?.canApply) {
    setStatus(
      elements.captureRecommendationStatus,
      "error",
      "No applicable historical recommendation is available for the currently loaded devices."
    );
    return;
  }

  elements.inputMode.value = "native-capture";
  elements.captureProfile.value = recommendation.recommendedPath.profile;
  elements.nativeBackend.value = recommendation.resolvedBackend;
  renderNativeBackends();
  elements.nativeBackend.value = recommendation.resolvedBackend;
  renderNativeDevices();

  if (
    recommendation.appliedDeviceValue &&
    [...elements.inputDeviceNumber.options].some((option) => option.value === recommendation.appliedDeviceValue)
  ) {
    elements.inputDeviceNumber.value = recommendation.appliedDeviceValue;
  }

  invalidateNativePreflight("Native preflight needs rerun after applying the historical recommendation.");
  renderSessionCaptureRecommendation();
  pushEventLog(
    "Capture recommendation",
    `${
      source === "auto" ? "Auto-applied" : "Applied"
    } ${createRecommendedCapturePathSummary(recommendation)} to the session form.`
  );
  setStatus(
    elements.captureRecommendationStatus,
    "success",
    `${
      source === "auto" ? "Auto-applied" : "Applied"
    } ${createRecommendedCapturePathSummary(recommendation)} to the session form.`
  );
}

function applyCaptureRecommendation() {
  const recommendation = getActiveCaptureRecommendation();

  if (!recommendation) {
    setStatus(
      elements.captureRecommendationStatus,
      "error",
      "No recommended capture path is available yet."
    );
    return;
  }

  if (recommendation.kind === "verification-hold") {
    applyVerificationHoldTechnicalFallbackRecommendation();
    return;
  }

  applyHistoricalCaptureRecommendation();
}

async function maybeAutoApplyHistoricalCaptureRecommendation() {
  if (elements.inputMode.value !== "native-capture" || !elements.autoApplyCaptureRecommendation.checked) {
    return false;
  }

  await refreshSessionCaptureRecommendation({ force: true });
  const recommendation = getHistoricalCaptureRecommendation();

  if (!recommendation?.canApply || recommendation.alreadyApplied) {
    return false;
  }

  applyHistoricalCaptureRecommendation({ source: "auto" });
  return true;
}

async function maybeAutoApplyCaptureRecommendation() {
  if (elements.inputMode.value !== "native-capture" || !elements.autoApplyCaptureRecommendation.checked) {
    return false;
  }

  const technicalFallbackRecommendation = getVerificationHoldTechnicalFallbackRecommendation();

  if (technicalFallbackRecommendation) {
    if (!technicalFallbackRecommendation.canApply || technicalFallbackRecommendation.alreadyApplied) {
      return false;
    }

    applyVerificationHoldTechnicalFallbackRecommendation({ source: "auto" });
    return true;
  }

  return maybeAutoApplyHistoricalCaptureRecommendation();
}

async function saveCapturePreferences() {
  state.backendUrl = elements.backendUrl.value.trim();
  const userId = getActiveUserId();

  if (!userId) {
    return;
  }

  await request(`/users/${encodeURIComponent(userId)}/capture-preferences`, {
    method: "PUT",
    body: JSON.stringify({
      autoApplyRecommendation: elements.autoApplyCaptureRecommendation.checked
    })
  });
}

async function recordCaptureOverrideIfNeeded() {
  const recommendation = getHistoricalCaptureRecommendation();

  if (
    elements.inputMode.value !== "native-capture" ||
    elements.autoApplyCaptureRecommendation.checked ||
    !recommendation?.canApply
  ) {
    return false;
  }

  const selectedNativeDevice = getSelectedNativeDevice();
  const selectedBackend = selectedNativeDevice.backend;
  const selectedProfile = elements.captureProfile.value;
  const technicalFallbackRecommendation = getVerificationHoldTechnicalFallbackRecommendation();

  if (
    technicalFallbackRecommendation?.canApply &&
    selectedBackend === technicalFallbackRecommendation.resolvedBackend &&
    selectedProfile === technicalFallbackRecommendation.recommendedPath.profile
  ) {
    return false;
  }

  const matchesRecommendation =
    selectedBackend === recommendation.resolvedBackend &&
    selectedProfile === recommendation.recommendedPath.profile;

  if (matchesRecommendation) {
    return false;
  }

  const userId = getActiveUserId();

  if (!userId) {
    return false;
  }

  await request(`/users/${encodeURIComponent(userId)}/capture-overrides`, {
    method: "POST",
    body: JSON.stringify({
      deviceName: recommendation.recommendedPath.deviceName,
      recommendedBackend: recommendation.resolvedBackend,
      recommendedProfile: recommendation.recommendedPath.profile,
      selectedBackend,
      selectedProfile,
      source: "manual-session-start"
    })
  });

  pushEventLog(
    "Capture override",
    `Recorded manual override for ${recommendation.recommendedPath.deviceName}: recommended ${recommendation.resolvedBackend.toUpperCase()} ${recommendation.recommendedPath.profile}, selected ${selectedBackend.toUpperCase()} ${selectedProfile}.`
  );
  return true;
}

async function recordSetupRecommendationUsage(
  path,
  recommendation,
  { source = "device-detail", plannedSessionId = null, silent = false } = {}
) {
  state.backendUrl = elements.backendUrl.value.trim();
  const userId = getActiveUserId();

  if (!userId) {
    throw new Error("User id is required before recording setup recommendation feedback.");
  }

  const response = await request(`/users/${encodeURIComponent(userId)}/setup-recommendations`, {
    method: "POST",
    body: JSON.stringify({
      deviceName: path.deviceName,
      backend: path.backend,
      profile: path.profile,
      recommendationId: recommendation.id,
      recommendationTitle: recommendation.title,
      recommendationDetail: recommendation.detail,
      source,
      ...(plannedSessionId ? { plannedSessionId } : {}),
      baselineStabilityScore: path.stabilityScore,
      baselineSignalQualityScore: path.signalQualityScore,
      baselineRuntimeStabilityScore: path.runtimeStabilityScore,
      baselineLatencyFitnessScore: path.latencyFitnessScore
    })
  });

  applyDashboardUserUpdate(response.data.user);

  if (!silent) {
    setStatus(
      elements.setupRecommendationFeedbackStatus,
      "success",
      `Tracked setup action "${recommendation.title}" for ${path.deviceName} on ${path.backend.toUpperCase()} ${path.profile}.`
    );
    pushEventLog(
      "Setup recommendation",
      `Tracked "${recommendation.title}" for ${path.deviceName} on ${path.backend.toUpperCase()} ${path.profile}.`
    );
  }
}

async function maybeTrackVerificationHoldSetupRecommendationUsage({
  recommendation,
  session,
  selectedNativeDevice
} = {}) {
  if (
    !recommendation?.primarySetupRecommendation ||
    session?.inputMode !== "native-capture" ||
    session.captureProfile !== recommendation.recommendedPath.profile ||
    session.inputDeviceBackend !== recommendation.resolvedBackend
  ) {
    return false;
  }

  await recordSetupRecommendationUsage(
    {
      deviceName:
        selectedNativeDevice?.name ??
        recommendation.recommendedPath.deviceName ??
        "Selected input device",
      backend: recommendation.resolvedBackend,
      profile: recommendation.recommendedPath.profile
    },
    recommendation.primarySetupRecommendation,
    {
      source: "verification-hold-session-start",
      plannedSessionId: session.id,
      silent: true
    }
  );

  pushEventLog(
    "Technical follow-up",
    `Tracking "${recommendation.primarySetupRecommendation.title}" for session ${session.id}.`
  );
  return true;
}

async function evaluateSetupRecommendationHistoryEntry(recommendationEntryId, outcome) {
  state.backendUrl = elements.backendUrl.value.trim();
  const userId = getActiveUserId();

  if (!userId) {
    throw new Error("User id is required before saving setup recommendation feedback.");
  }

  const response = await request(
    `/users/${encodeURIComponent(userId)}/setup-recommendations/${encodeURIComponent(recommendationEntryId)}/evaluation`,
    {
      method: "POST",
      body: JSON.stringify({
        outcome
      })
    }
  );

  applyDashboardUserUpdate(response.data.user);
  setStatus(
    elements.setupRecommendationFeedbackStatus,
    "success",
    `Marked setup recommendation as ${outcome === "improved" ? "improved" : "not improved"}.`
  );
  pushEventLog(
    "Setup feedback",
    `Recommendation ${recommendationEntryId} marked as ${outcome === "improved" ? "improved" : "no improvement"}.`
  );
}

async function exportDiagnosticsReport(format) {
  state.backendUrl = elements.backendUrl.value.trim();
  const userId = getActiveUserId() || "anonymous";
  setStatus(elements.diagnosticsExportStatus, null, `Exporting diagnostics report as ${format.toUpperCase()}...`);
  const filterQuery = createDiagnosticsFilterQuery();

  const response = await fetch(
    `${state.backendUrl}/users/${encodeURIComponent(userId)}/diagnostics/export?format=${encodeURIComponent(format)}${filterQuery ? `&${filterQuery.slice(1)}` : ""}`
  );

  if (!response.ok) {
    let message = `Export failed with status ${response.status}`;

    try {
      const payload = await response.json();
      message = payload?.error?.message ?? message;
    } catch {
      // Ignore non-JSON error payloads.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(/filename=\"([^\"]+)\"/i);
  const filename = filenameMatch?.[1] ?? `riffrush-diagnostics.${format}`;
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  setStatus(
    elements.diagnosticsExportStatus,
    "success",
    `Diagnostics export ready: ${filename}`
  );
  pushEventLog("Diagnostics export", `Downloaded ${filename}.`);
}

function sendEngineMessage(type, payload, options = {}) {
  if (!state.engineSocket || state.engineSocket.readyState !== WebSocket.OPEN) {
    throw new Error("Engine socket is not connected.");
  }

  state.engineSocket.send(
    JSON.stringify({
      type,
      protocolVersion: 1,
      sessionId: options.sessionId ?? null,
      timestamp: new Date().toISOString(),
      ...(options.requestId ? { requestId: options.requestId } : {}),
      payload
    })
  );
}

function requestEngineMessage(type, payload, options = {}) {
  const requestId = createEngineRequestId();
  const responseType = options.responseType;
  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      engineRequestState.pending.delete(requestId);
      reject(new Error(`Timed out waiting for ${responseType ?? type} response from engine.`));
    }, timeoutMs);

    engineRequestState.pending.set(requestId, {
      responseType,
      resolve,
      reject,
      timeoutId
    });

    try {
      sendEngineMessage(type, payload, {
        sessionId: options.sessionId,
        requestId
      });
    } catch (error) {
      clearTimeout(timeoutId);
      engineRequestState.pending.delete(requestId);
      reject(error);
    }
  });
}

function encodePcm16Base64(floatSamples) {
  const pcmBytes = new Uint8Array(floatSamples.length * 2);
  const view = new DataView(pcmBytes.buffer);

  for (let index = 0; index < floatSamples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, floatSamples[index]));
    view.setInt16(index * 2, Math.round(value * 32767), true);
  }

  let binary = "";

  for (const byte of pcmBytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function startLiveCapture() {
  if (!state.activeSessionId) {
    throw new Error("No active session for live capture.");
  }

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });

  const audioContext = new AudioContext({ sampleRate: 48000 });
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);
  const processorNode = audioContext.createScriptProcessor(2048, 1, 1);

  processorNode.onaudioprocess = (event) => {
    if (!state.activeSessionId || state.activeInputMode !== "live-stream") {
      return;
    }

    const channelData = event.inputBuffer.getChannelData(0);
    const frame = new Float32Array(channelData.length);
    frame.set(channelData);

    sendEngineMessage(
      "audio.stream.chunk",
      {
        sampleRate: audioContext.sampleRate,
        channelCount: 1,
        encoding: "pcm16-base64",
        chunkBase64: encodePcm16Base64(frame)
      },
      {
        sessionId: state.activeSessionId
      }
    );
  };

  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);

  state.liveCapture = {
    mediaStream,
    audioContext,
    sourceNode,
    processorNode
  };
}

async function stopLiveCapture(sendStopMessage = true) {
  if (sendStopMessage && state.activeSessionId && state.activeInputMode === "live-stream") {
    try {
      sendEngineMessage(
        "session.stop",
        {
          reason: "user-stop"
        },
        {
          sessionId: state.activeSessionId
        }
      );
    } catch {
      // Ignore send failures during teardown.
    }
  }

  if (!state.liveCapture) {
    return;
  }

  state.liveCapture.processorNode.disconnect();
  state.liveCapture.sourceNode.disconnect();
  state.liveCapture.mediaStream.getTracks().forEach((track) => track.stop());
  await state.liveCapture.audioContext.close();
  state.liveCapture = null;
}

function renderDashboard() {
  const dashboard = state.dashboard ?? {
    capturePreferences: {
      autoApplyRecommendation: true
    },
    captureOverrideHistory: [],
    setupRecommendationHistory: [],
    stats: {
      completedSessions: 0,
      totalScore: 0,
      averageAccuracy: 0,
      streakDays: 0
    },
    recentResults: []
  };

  elements.dashboardSummary.innerHTML = `
    <article class="dashboard-card">
      <strong>Completed sessions</strong>
      <span>${dashboard.stats.completedSessions}</span>
    </article>
    <article class="dashboard-card">
      <strong>Total score</strong>
      <span>${dashboard.stats.totalScore}</span>
    </article>
    <article class="dashboard-card">
      <strong>Average accuracy</strong>
      <span>${dashboard.stats.averageAccuracy}</span>
    </article>
    <article class="dashboard-card">
      <strong>Streak days</strong>
      <span>${dashboard.stats.streakDays}</span>
    </article>
    <article class="dashboard-card">
      <strong>Latest unlocks</strong>
      <span>${escapeHtml(
        state.lastUnlockTransition?.hasNewUnlocks
          ? state.lastUnlockTransition.unlockedTrainingTitles.join(", ")
          : "No new unlocks"
      )}</span>
    </article>
  `;

  elements.dashboardCapturePreferences.innerHTML = `
    <div class="diagnostics-grid">
      <div class="diagnostics-metric">
        <strong>Auto-apply</strong>
        <span>${escapeHtml(dashboard.capturePreferences?.autoApplyRecommendation ? "Enabled" : "Disabled")}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Override count</strong>
        <span>${escapeHtml(String(dashboard.captureOverrideHistory?.length ?? 0))}</span>
      </div>
    </div>
  `;

  if (!dashboard.targetedPractice) {
    elements.dashboardTargetedPractice.textContent = "No targeted practice recommendation yet.";
  } else {
    const targetedPracticeBadges = createCheckpointBadges({
      targetedPractice: dashboard.targetedPractice,
      unlockTransition: state.lastUnlockTransition,
      sessionRecap: state.lastSessionRecap
    });
    elements.dashboardTargetedPractice.innerHTML = `
      ${renderCheckpointBadgeRow(targetedPracticeBadges)}
      <strong>${escapeHtml(dashboard.targetedPractice.recommendedTrainingTitle)}</strong>
      <p>${escapeHtml(
        `${dashboard.targetedPractice.action === "repeat-current" ? "Repeat current training" : "Switch training"} at ${dashboard.targetedPractice.suggestedTempoBpm} BPM. ${dashboard.targetedPractice.rationale}`
      )}</p>
      <p>${escapeHtml(dashboard.targetedPractice.nextStep)}</p>
      ${
        dashboard.targetedPractice.recoveryProgressStatus === "goal-ready"
          ? `<p>${escapeHtml(
              `Recovery unlocked: return to ${dashboard.targetedPractice.recoveryGoalTrainingTitle}${dashboard.targetedPractice.recoveryGoalSectionLabel ? ` / ${dashboard.targetedPractice.recoveryGoalSectionLabel}` : ""}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.recoveryTrainingTitle
          ? `<p>${escapeHtml(
              `${dashboard.targetedPractice.recoveryProgressStatus === "goal-ready" ? "Recovery result" : "Recovery route"}: switch to ${dashboard.targetedPractice.recoveryTrainingTitle} [${dashboard.targetedPractice.recoveryTrainingDifficulty}]${dashboard.targetedPractice.recoveryProgressStatus === "goal-ready" ? `, then return to ${dashboard.targetedPractice.recoveryGoalTrainingTitle}${dashboard.targetedPractice.recoveryGoalSectionLabel ? ` / ${dashboard.targetedPractice.recoveryGoalSectionLabel}` : ""}` : ` before returning to ${dashboard.targetedPractice.recoveryGoalTrainingTitle}${dashboard.targetedPractice.recoveryGoalSectionLabel ? ` / ${dashboard.targetedPractice.recoveryGoalSectionLabel}` : ""}`}. ${dashboard.targetedPractice.recoveryReason ?? ""}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.recoveryMilestone
          ? `<p>${escapeHtml(
              `Recovery milestone: ${dashboard.targetedPractice.recoveryMilestone.stableSessionCount}/${dashboard.targetedPractice.recoveryMilestone.requiredStableSessions} stable session(s) collected for the return path.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.returnMilestone
          ? `<p>${escapeHtml(
              `Return milestone: ${dashboard.targetedPractice.returnMilestone.stableReturnSessionCount}/${dashboard.targetedPractice.returnMilestone.requiredStableReturnSessions} stable return session(s) collected for the goal chart.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.returnRamp
          ? `<p>${escapeHtml(
              `Return ramp: ${dashboard.targetedPractice.returnRamp.mode} -> ${dashboard.targetedPractice.returnRamp.targetTempoBpm} BPM${dashboard.targetedPractice.returnRamp.loopRepetitionCount ? `, ${dashboard.targetedPractice.returnRamp.loopRepetitionCount} rep(s)` : ""}${dashboard.targetedPractice.returnRamp.loopTempoStepBpm ? `, +${dashboard.targetedPractice.returnRamp.loopTempoStepBpm} BPM per rep` : ""}. ${dashboard.targetedPractice.returnRamp.reason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.chartExpansion
          ? `<p>${escapeHtml(
              `Chart expansion: ${dashboard.targetedPractice.chartExpansion.mode} from ${dashboard.targetedPractice.chartExpansion.sourceSectionLabel} -> ${dashboard.targetedPractice.chartExpansion.targetScope} at ${dashboard.targetedPractice.chartExpansion.targetTempoBpm} BPM. ${dashboard.targetedPractice.chartExpansion.reason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.fullChartReintegrationMilestone
          ? `<p>${escapeHtml(
              `Full-chart reintegration: ${dashboard.targetedPractice.fullChartReintegrationMilestone.stableFullChartSessionCount}/${dashboard.targetedPractice.fullChartReintegrationMilestone.requiredStableFullChartSessions} stable full-chart session(s) collected after expansion.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.fullChartReintegrationRamp
          ? `<p>${escapeHtml(
              `Full-chart reintegration ramp: ${dashboard.targetedPractice.fullChartReintegrationRamp.mode} -> ${dashboard.targetedPractice.fullChartReintegrationRamp.targetTempoBpm} BPM. ${dashboard.targetedPractice.fullChartReintegrationRamp.reason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionTargetTrainingTitle
          ? `<p>${escapeHtml(
              `Promotion route: switch to ${dashboard.targetedPractice.promotionTargetTrainingTitle} [${dashboard.targetedPractice.promotionTargetDifficulty}] at ${dashboard.targetedPractice.suggestedTempoBpm} BPM. ${dashboard.targetedPractice.promotionTargetReason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionLandingMilestone
          ? `<p>${escapeHtml(
              `Promotion landing: ${dashboard.targetedPractice.promotionLandingMilestone.stablePromotionLandingSessionCount}/${dashboard.targetedPractice.promotionLandingMilestone.requiredStablePromotionLandingSessions} stable promoted session(s) collected on ${dashboard.targetedPractice.recommendedTrainingTitle}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionRamp
          ? `<p>${escapeHtml(
              `Promotion ramp: ${dashboard.targetedPractice.promotionRamp.mode} -> ${dashboard.targetedPractice.promotionRamp.targetTempoBpm} BPM${dashboard.targetedPractice.promotionRamp.baseTempoBpm ? ` from ${dashboard.targetedPractice.promotionRamp.baseTempoBpm} BPM` : ""}. ${dashboard.targetedPractice.promotionRamp.reason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionRampMilestone
          ? `<p>${escapeHtml(
              `Promotion ramp milestone: ${dashboard.targetedPractice.promotionRampMilestone.stablePromotionRampSessionCount}/${dashboard.targetedPractice.promotionRampMilestone.requiredStablePromotionRampSessions} stable ramp session(s) collected on ${dashboard.targetedPractice.recommendedTrainingTitle}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionTrackMilestone
          ? `<p>${escapeHtml(
              `Promotion track: ${dashboard.targetedPractice.promotionTrackMilestone.confirmedRampTierCount}/${dashboard.targetedPractice.promotionTrackMilestone.requiredConfirmedRampTiers} confirmed ramp tier(s) completed on ${dashboard.targetedPractice.promotionTargetTrainingTitle ?? dashboard.targetedPractice.recommendedTrainingTitle}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionGraduation
          ? `<p>${escapeHtml(
              `Promotion graduation: switch to ${dashboard.targetedPractice.promotionGraduation.targetTrainingTitle} [${dashboard.targetedPractice.promotionGraduation.targetTrainingDifficulty}] at ${dashboard.targetedPractice.promotionGraduation.targetTempoBpm} BPM. ${dashboard.targetedPractice.promotionGraduation.reason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionReentryMilestone
          ? `<p>${escapeHtml(
              `Promotion re-entry: ${dashboard.targetedPractice.promotionReentryMilestone.stablePromotionReentrySessionCount}/${dashboard.targetedPractice.promotionReentryMilestone.requiredStablePromotionReentrySessions} stable re-entry session(s) collected on ${dashboard.targetedPractice.recommendedTrainingTitle}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.terminalTrainingMasteryTrack
          ? `<p>${escapeHtml(
              `Terminal training mastery: ${dashboard.targetedPractice.terminalTrainingMasteryTrack.confirmedTerminalTierCount}/${dashboard.targetedPractice.terminalTrainingMasteryTrack.requiredConfirmedTerminalTiers} confirmed terminal tier(s) collected on ${dashboard.targetedPractice.recommendedTrainingTitle}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.terminalMasteryGraduation
          ? `<p>${escapeHtml(
              `Terminal mastery graduation: ${dashboard.targetedPractice.terminalMasteryGraduation.mode} -> ${dashboard.targetedPractice.terminalMasteryGraduation.targetTrainingTitle} [${dashboard.targetedPractice.terminalMasteryGraduation.targetTrainingDifficulty}] at ${dashboard.targetedPractice.terminalMasteryGraduation.targetTempoBpm} BPM. ${dashboard.targetedPractice.terminalMasteryGraduation.reason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionChainGraduationMilestone
          ? `<p>${escapeHtml(
              `Promotion chain graduation milestone: ${dashboard.targetedPractice.promotionChainGraduationMilestone.stablePromotionChainGraduationSessionCount}/${dashboard.targetedPractice.promotionChainGraduationMilestone.requiredStablePromotionChainGraduationSessions} stable ceiling session(s) collected on ${dashboard.targetedPractice.recommendedTrainingTitle}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionChainTrackMilestone
          ? `<p>${escapeHtml(
              `Promotion chain track: ${dashboard.targetedPractice.promotionChainTrackMilestone.confirmedPromotionChainTierCount}/${dashboard.targetedPractice.promotionChainTrackMilestone.requiredConfirmedPromotionChainTiers} confirmed chain tier(s) completed on ${dashboard.targetedPractice.promotionTargetTrainingTitle ?? dashboard.targetedPractice.recommendedTrainingTitle}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionChainGraduation
          ? `<p>${escapeHtml(
              `Promotion chain graduation: ${dashboard.targetedPractice.promotionChainGraduation.mode} -> ${dashboard.targetedPractice.promotionChainGraduation.targetTrainingTitle} [${dashboard.targetedPractice.promotionChainGraduation.targetTrainingDifficulty}] at ${dashboard.targetedPractice.promotionChainGraduation.targetTempoBpm} BPM. ${dashboard.targetedPractice.promotionChainGraduation.reason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionChainMilestone
          ? `<p>${escapeHtml(
              `Promotion chain milestone: ${dashboard.targetedPractice.promotionChainMilestone.stablePromotionChainSessionCount}/${dashboard.targetedPractice.promotionChainMilestone.requiredStablePromotionChainSessions} stable chain session(s) collected on ${dashboard.targetedPractice.recommendedTrainingTitle}.`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.promotionChain
          ? `<p>${escapeHtml(
              `Promotion chain: ${dashboard.targetedPractice.promotionChain.mode} -> ${dashboard.targetedPractice.promotionChain.targetTempoBpm} BPM from ${dashboard.targetedPractice.promotionChain.baseTempoBpm} BPM. ${dashboard.targetedPractice.promotionChain.reason}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.recommendedSectionLabel
          ? `<p>${escapeHtml(
              `Section focus: ${dashboard.targetedPractice.recommendedSectionLabel} (${dashboard.targetedPractice.sectionAction ?? "loop-section"}). ${dashboard.targetedPractice.sectionRationale ?? ""}${
                dashboard.targetedPractice.loopRepetitionCount
                  ? ` Plan: ${dashboard.targetedPractice.loopRepetitionCount} rep(s)${dashboard.targetedPractice.loopTempoStepBpm ? `, +${dashboard.targetedPractice.loopTempoStepBpm} BPM per rep` : ""}.`
                  : ""
              }`.trim()
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.practiceSectionLabel &&
        dashboard.targetedPractice.practiceSectionLabel !== dashboard.targetedPractice.recommendedSectionLabel
          ? `<p>${escapeHtml(
              `Recovery path: start from ${dashboard.targetedPractice.practiceSectionLabel} [${dashboard.targetedPractice.practiceSectionMode ?? "recovery-section"}]. ${dashboard.targetedPractice.practiceSectionReason ?? ""}`
            )}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.masteryGate
          ? `<p>${escapeHtml(formatMasteryGateSummary(dashboard.targetedPractice.masteryGate))}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.adaptiveExecution
          ? `<p>${escapeHtml(formatAdaptiveExecutionSummary(dashboard.targetedPractice.adaptiveExecution))}</p>`
          : ""
      }
      ${
        dashboard.targetedPractice.primaryFocus
          ? `<p>${escapeHtml(
              `Primary focus: ${dashboard.targetedPractice.primaryFocus.title} [${dashboard.targetedPractice.primaryFocus.severity}]`
            )}</p>`
          : ""
      }
    `;
  }

  if (!dashboard.captureOverrideHistory?.length) {
    elements.dashboardCaptureOverrides.innerHTML =
      '<article class="event-log-empty">No capture overrides recorded yet.</article>';
  } else {
    elements.dashboardCaptureOverrides.innerHTML = dashboard.captureOverrideHistory
      .slice(0, 5)
      .map(
        (entry) => `
          <article class="event-log-entry">
            <strong>${escapeHtml(entry.deviceName)}</strong>
            <p>${escapeHtml(
              `${entry.timestamp}: recommended ${entry.recommendedBackend.toUpperCase()} ${entry.recommendedProfile}, selected ${entry.selectedBackend.toUpperCase()} ${entry.selectedProfile}.`
            )}</p>
          </article>
        `
      )
      .join("");
  }

  if (!dashboard.setupRecommendationHistory?.length) {
    elements.dashboardSetupRecommendations.innerHTML =
      '<article class="event-log-empty">No setup recommendation feedback recorded yet.</article>';
    setStatus(
      elements.setupRecommendationFeedbackStatus,
      null,
      "Setup recommendation feedback has not been recorded yet."
    );
  } else {
    elements.dashboardSetupRecommendations.innerHTML = dashboard.setupRecommendationHistory
      .slice(0, 6)
      .map((entry) => {
        const actionSummary = `${entry.recommendationTitle} on ${entry.deviceName} via ${entry.backend.toUpperCase()} ${entry.profile}`;
        const scoreSummary = [
          entry.baselineStabilityScore !== undefined ? `overall ${entry.baselineStabilityScore}/100` : null,
          entry.baselineRuntimeStabilityScore !== undefined ? `runtime ${entry.baselineRuntimeStabilityScore}/100` : null,
          entry.baselineLatencyFitnessScore !== undefined ? `latency ${entry.baselineLatencyFitnessScore}/100` : null,
          entry.baselineSignalQualityScore !== undefined ? `signal ${entry.baselineSignalQualityScore}/100` : null
        ]
          .filter(Boolean)
          .join(", ");

        return `
          <article class="event-log-entry">
            <strong>${escapeHtml(actionSummary)}</strong>
            <p>${escapeHtml(
              `${entry.timestamp}: ${formatSetupRecommendationStatus(entry.status)}.${scoreSummary ? ` Baseline ${scoreSummary}.` : ""}`
            )}</p>
            ${entry.recommendationDetail ? `<p>${escapeHtml(entry.recommendationDetail)}</p>` : ""}
            ${
              entry.status === "applied"
                ? `
                  <div class="button-row inline-actions">
                    <button
                      class="button button-secondary button-small"
                      data-setup-history-id="${escapeHtml(entry.id)}"
                      data-setup-outcome="improved"
                    >
                      Mark improved
                    </button>
                    <button
                      class="button button-secondary button-small"
                      data-setup-history-id="${escapeHtml(entry.id)}"
                      data-setup-outcome="no-improvement"
                    >
                      No improvement
                    </button>
                  </div>
                `
                : entry.evaluatedAt
                  ? `<p>${escapeHtml(`Evaluated at ${entry.evaluatedAt}.`)}</p>`
                  : ""
            }
          </article>
        `;
      })
      .join("");

    elements.dashboardSetupRecommendations
      .querySelectorAll("[data-setup-history-id]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          button.disabled = true;

          try {
            await evaluateSetupRecommendationHistoryEntry(
              button.dataset.setupHistoryId,
              button.dataset.setupOutcome
            );
          } catch (error) {
            button.disabled = false;
            setStatus(elements.setupRecommendationFeedbackStatus, "error", error.message);
          }
        });
      });
  }

  if (!dashboard.recentResults || dashboard.recentResults.length === 0) {
    elements.dashboardResults.innerHTML =
      '<article class="event-log-empty">No completed sessions yet.</article>';
    return;
  }

  elements.dashboardResults.innerHTML = dashboard.recentResults
    .map(
        (result) => `
          <article class="event-log-entry">
            ${renderCheckpointBadgeRow(
              createCheckpointBadges({
                targetedPractice: dashboard.targetedPractice,
                result
              })
            )}
            <strong>${escapeHtml(result.trainingTitle)}</strong>
            <p>Score ${result.totalScore}, accuracy ${result.accuracy}, completed ${escapeHtml(result.completedAt)}${
              result.rating
                ? `, grade ${result.rating.grade} (${result.rating.label}), clear ${result.rating.clearType}, performance ${result.rating.performanceScore}`
                : ""
          }</p>
          ${
            result.feedback
              ? `<p>${escapeHtml(
                  `Coach summary: ${result.feedback.summary}${result.feedback.focusAreas?.length ? ` Focus: ${result.feedback.focusAreas.join(", ")}.` : ""}`
                )}</p>`
              : ""
          }
          ${
            result.feedback?.coachHints?.length
              ? `<p>${escapeHtml(
                  `Hints: ${result.feedback.coachHints.map((hint) => `${hint.title} [${hint.severity}]`).join(" | ")}`
                )}</p>`
              : ""
          }
          ${
            result.scoreBreakdown
              ? `<p>${escapeHtml(
                  `Tempo ${result.scoreBreakdown.tempoBpm} BPM, combo hits ${result.scoreBreakdown.fullComboHits ?? result.scoreBreakdown.fullHits}/${result.scoreBreakdown.targetCount}, max combo ${result.scoreBreakdown.maxCombo ?? 0}, combo breaks ${result.scoreBreakdown.comboBreakCount ?? 0}, multiplier peak x${result.scoreBreakdown.multiplierPeak ?? 1}, attack hits ${result.scoreBreakdown.fullHits}, sustain hits ${result.scoreBreakdown.sustainHits ?? 0}, release hits ${result.scoreBreakdown.releaseHits ?? 0}, missed targets ${result.scoreBreakdown.missedTargetCount ?? 0}, ghost notes ${result.scoreBreakdown.ghostNoteCount ?? 0}, matched ${result.scoreBreakdown.matchedTargetCount}, unmatched ${result.scoreBreakdown.unmatchedTargetCount}, note hits ${result.scoreBreakdown.noteHits}, string hits ${result.scoreBreakdown.stringHits}, timing hits ${result.scoreBreakdown.timingHits}, early ${result.scoreBreakdown.earlyHitCount}, late ${result.scoreBreakdown.lateHitCount}, early release ${result.scoreBreakdown.earlyReleaseCount ?? 0}, overhold ${result.scoreBreakdown.overholdCount ?? 0}, avg timing offset ${result.scoreBreakdown.averageTimingOffsetMs} ms, avg hold coverage ${result.scoreBreakdown.averageHoldCoverage ?? 0}, avg release overshoot ${result.scoreBreakdown.averageReleaseOvershootMs ?? 0} ms.`
                )}</p>`
              : ""
          }
          ${
            result.practicePreset
              ? `<p>${escapeHtml(
                  `Practice preset: ${result.practicePreset.scope === "section-loop" ? `section loop ${result.practicePreset.loopSectionLabel ?? result.practicePreset.loopSectionId}` : "whole chart"} @ ${result.practicePreset.tempoBpm} BPM${
                    result.practicePreset.loopRepetitionCount ? `, ${result.practicePreset.loopRepetitionCount} rep(s)` : ""
                  }${
                    result.practicePreset.loopTempoStepBpm ? `, +${result.practicePreset.loopTempoStepBpm} BPM per rep` : ""
                  }.`
                )}</p>`
              : ""
          }
          ${
            result.practicePreset?.masteryGate
              ? `<p>${escapeHtml(formatMasteryGateSummary(result.practicePreset.masteryGate))}</p>`
              : ""
          }
          ${
            result.practicePreset?.adaptiveExecution
              ? `<p>${escapeHtml(formatAdaptiveExecutionSummary(result.practicePreset.adaptiveExecution))}</p>`
              : ""
          }
          ${
            result.practicePreset?.repetitions?.length
              ? `<p>${escapeHtml(`Repetition results: ${formatPracticeRepetitionSummary(result.practicePreset.repetitions)}`)}</p>`
              : ""
          }
          ${
            result.sectionBreakdown?.length
              ? `<p>${escapeHtml(
                  `Sections: ${result.sectionBreakdown.map((section) => `${section.sectionLabel} ${Math.round((section.accuracy ?? 0) * 100)}% / score ${section.performanceScore} / misses ${section.missedTargetCount ?? 0} / ghosts ${section.ghostNoteCount ?? 0}`).join(" | ")}`
                )}</p>`
              : ""
          }
          ${
            result.capture
              ? `<p>Capture: ${escapeHtml(
                  `${result.capture.source}${result.capture.profile ? ` [${result.capture.profile}]` : ""}${result.capture.backend ? ` via ${result.capture.backend.toUpperCase()}` : ""}${
                    result.capture.deviceName ? ` on ${result.capture.deviceName}` : ""
                  }${result.capture.sampleRate ? ` @ ${result.capture.sampleRate} Hz` : ""}${
                    result.capture.bufferMs ? ` / buffer ${result.capture.bufferMs} ms` : ""
                  }${result.capture.numberOfBuffers ? ` / ${result.capture.numberOfBuffers} buffers` : ""}${
                    result.capture.useEventSync !== undefined ? ` / event sync ${result.capture.useEventSync}` : ""
                  }${result.capture.startAttemptCount ? ` / start attempts ${result.capture.startAttemptCount}` : ""
                  }${result.capture.fallbackApplied ? ` / fallback from ${result.capture.requestedBackend?.toUpperCase() ?? "requested backend"} ${result.capture.requestedProfile ?? "requested profile"}` : ""
                  }`
                )}</p>`
              : ""
          }
          ${
            result.diagnostics?.notices?.length
              ? `<p>Diagnostics: ${escapeHtml(
                  `${result.diagnostics.notices.length} notice(s) captured${result.diagnostics.currentCapture?.backend && result.diagnostics.currentCapture?.profile ? `, final path ${result.diagnostics.currentCapture.backend.toUpperCase()} ${result.diagnostics.currentCapture.profile}` : ""}.`
                )}</p>`
              : ""
          }
          ${result.artifact?.filePath ? `<p>Artifact: ${escapeHtml(result.artifact.filePath)}</p>` : ""}
        </article>
      `
    )
    .join("");
}

function renderDiagnosticsReport() {
  const report = state.diagnosticsReport ?? {
    filters: {},
    sorting: {
      sortBy: "latest",
      sortDirection: "desc"
    },
    summary: {
      sessionCount: 0,
      pathCount: 0,
      sessionsWithFallback: 0,
      fallbackRate: 0,
      averageStartAttempts: 0,
      mostProblematicPath: null
    },
    insights: {
      recommendedPath: null,
      deviceRecommendations: [],
      problematicPaths: []
    },
    groupedPaths: [],
    recentSessions: []
  };
  const filterParts = [
    report.filters?.deviceName ? `device contains "${report.filters.deviceName}"` : null,
    report.filters?.backend ? `backend ${String(report.filters.backend).toUpperCase()}` : null,
    report.filters?.profile ? `profile ${report.filters.profile}` : null
  ].filter(Boolean);
  const filterSummary = filterParts.length > 0 ? `Filtered by ${filterParts.join(", ")}.` : "No diagnostics filters applied.";
  const sortingSummary = `Sorted by ${formatSortingLabel(
    report.sorting?.sortBy,
    report.sorting?.sortDirection
  )}.`;
  const mostProblematicPath = report.summary?.mostProblematicPath
    ? `${report.summary.mostProblematicPath.deviceName} via ${String(
        report.summary.mostProblematicPath.backend
      ).toUpperCase()} [${report.summary.mostProblematicPath.profile}]`
    : "No capture issues recorded yet.";
  const recommendedPath = report.insights?.recommendedPath;
  const runtimeIssues = report.runtimeIssues ?? {
    totalWarningNotices: 0,
    affectedSessions: 0,
    stageBreakdown: [],
    topIssues: []
  };

  elements.diagnosticsSummaryCards.innerHTML = `
    <article class="diagnostics-metric">
      <strong>Sessions</strong>
      <span>${escapeHtml(
        `${report.summary?.sessionCount ?? 0} across ${report.summary?.pathCount ?? 0} path(s)`
      )}</span>
    </article>
    <article class="diagnostics-metric">
      <strong>Fallback rate</strong>
      <span>${escapeHtml(
        `${formatRatioAsPercent(report.summary?.fallbackRate)} (${report.summary?.sessionsWithFallback ?? 0} session(s))`
      )}</span>
    </article>
    <article class="diagnostics-metric">
      <strong>Average attempts</strong>
      <span>${escapeHtml(String(report.summary?.averageStartAttempts ?? 0))}</span>
    </article>
    <article class="diagnostics-metric">
      <strong>Most problematic path</strong>
      <span>${escapeHtml(mostProblematicPath)}</span>
    </article>
  `;

  if (!recommendedPath) {
    elements.diagnosticsRecommendation.textContent =
      "Recommended capture path will appear after loading enough diagnostics data.";
  } else {
    elements.diagnosticsRecommendation.innerHTML = `
      <div class="diagnostics-metric">
        <strong>Recommended path</strong>
        <span>${escapeHtml(recommendedPath.label ?? createCapturePathSummary(recommendedPath))}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Selection source</strong>
        <span>${escapeHtml(formatSelectionSource(recommendedPath.selectionSource))}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Stability score</strong>
        <span>${escapeHtml(`${recommendedPath.stabilityScore ?? 0}/100`)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Start reliability</strong>
        <span>${escapeHtml(`${recommendedPath.startReliabilityScore ?? 0}/100`)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Runtime stability</strong>
        <span>${escapeHtml(`${recommendedPath.runtimeStabilityScore ?? 0}/100`)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Recommendation confidence</strong>
        <span>${escapeHtml(`${recommendedPath.recommendationConfidenceScore ?? 0}/100`)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Latency fitness</strong>
        <span>${escapeHtml(`${recommendedPath.latencyFitnessScore ?? 0}/100`)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Signal quality</strong>
        <span>${escapeHtml(`${recommendedPath.signalQualityScore ?? 0}/100`)}</span>
      </div>
      <div class="diagnostics-metric">
        <strong>Setup feedback</strong>
        <span>${escapeHtml(formatSetupFeedbackSummary(recommendedPath.setupFeedback))}</span>
      </div>
      <div class="diagnostics-summary">
        <p>${escapeHtml(
          `${recommendedPath.reason} ${recommendedPath.stabilitySummary ?? `Recorded sessions ${recommendedPath.sessionCount}, fallback rate ${formatRatioAsPercent(recommendedPath.fallbackRate)}, average attempts ${recommendedPath.averageStartAttempts}`}${
            recommendedPath.overrideSupportCount ? `, override support ${recommendedPath.overrideSupportCount}` : ""
          }.`
        )}</p>
        <p>${escapeHtml(`Setup actions: ${formatSetupRecommendations(recommendedPath.setupRecommendations)}`)}</p>
      </div>
    `;
  }

  if (!report.insights?.problematicPaths?.length) {
    elements.diagnosticsRanking.innerHTML =
      '<article class="event-log-empty">No problematic paths ranked yet.</article>';
  } else {
    elements.diagnosticsRanking.innerHTML = report.insights.problematicPaths
      .map(
        (path) => `
          <article class="event-log-entry">
            <strong>${escapeHtml(`#${path.rank} ${createCapturePathSummary(path)}`)}</strong>
            <p>${escapeHtml(
              `${path.sessionCount} session(s), fallback ${path.fallbackCount} time(s) (${formatRatioAsPercent(path.fallbackRate)}), average start attempts ${path.averageStartAttempts}.`
            )}</p>
          </article>
        `
      )
      .join("");
  }

  if (!report.insights?.deviceRecommendations?.length) {
    elements.diagnosticsDeviceRecommendations.innerHTML =
      '<article class="event-log-empty">No per-device recommendations yet.</article>';
  } else {
    elements.diagnosticsDeviceRecommendations.innerHTML = report.insights.deviceRecommendations
      .map((entry) => {
        const path = entry.recommendedPath;
        const selectionSource = formatSelectionSource(path?.selectionSource);

        return `
          <article class="event-log-entry">
            <strong>${escapeHtml(entry.deviceName)}</strong>
            <p>${escapeHtml(
              path
                ? `${path.backend.toUpperCase()} ${path.profile}, ${selectionSource}, overall ${path.stabilityScore}/100, start ${path.startReliabilityScore}/100, runtime ${path.runtimeStabilityScore}/100, confidence ${path.recommendationConfidenceScore}/100, latency ${path.latencyFitnessScore}/100, signal ${path.signalQualityScore ?? 0}/100.`
                : "No recommendation available."
            )}</p>
            ${
              path?.setupRecommendations?.length
                ? `<p>${escapeHtml(`Setup actions: ${formatSetupRecommendations(path.setupRecommendations)}`)}</p>`
                : ""
            }
            ${
              path?.setupFeedback?.appliedCount
                ? `<p>${escapeHtml(`Setup feedback: ${formatSetupFeedbackSummary(path.setupFeedback)}`)}</p>`
                : ""
            }
            ${
              entry.scoredPaths?.length
                ? `<p>${escapeHtml(
                    `Scored paths: ${entry.scoredPaths
                      .map(
                        (scoredPath) =>
                          `${scoredPath.backend.toUpperCase()} ${scoredPath.profile} overall ${scoredPath.stabilityScore}/100, start ${scoredPath.startReliabilityScore}/100, runtime ${scoredPath.runtimeStabilityScore}/100, confidence ${scoredPath.recommendationConfidenceScore}/100, latency ${scoredPath.latencyFitnessScore}/100, signal ${scoredPath.signalQualityScore ?? 0}/100`
                      )
                      .join(" | ")}`
                  )}</p>`
                : ""
            }
          </article>
        `;
      })
      .join("");
  }

  if (!runtimeIssues.topIssues?.length) {
    elements.diagnosticsRuntimeIssues.innerHTML =
      '<article class="event-log-empty">No runtime issue breakdown available yet.</article>';
  } else {
    elements.diagnosticsRuntimeIssues.innerHTML = [
      `<article class="event-log-entry"><strong>Warning overview</strong><p>${escapeHtml(
        `${runtimeIssues.totalWarningNotices} warning notice(s) across ${runtimeIssues.affectedSessions} session(s).`
      )}</p></article>`,
      ...runtimeIssues.stageBreakdown.map(
        (issueGroup) => `
          <article class="event-log-entry">
            <strong>${escapeHtml(`${formatIssueStageLabel(issueGroup.stage)} issues`)}</strong>
            <p>${escapeHtml(
              `${issueGroup.eventCount} event(s), ${issueGroup.affectedSessions} affected session(s), share ${formatRatioAsPercent(issueGroup.eventRate)}.`
            )}</p>
          </article>
        `
      ),
      ...runtimeIssues.topIssues.map(
        (issue) => `
          <article class="event-log-entry">
            <strong>${escapeHtml(issue.code)}</strong>
            <p>${escapeHtml(
              `${formatIssueStageLabel(issue.stage)} issue, ${issue.eventCount} event(s), ${issue.affectedSessions} affected session(s), share ${formatRatioAsPercent(issue.eventRate)}.`
            )}</p>
          </article>
        `
      )
    ].join("");
  }

  renderDeviceDiagnosticsSelector();
  renderSessionCaptureRecommendation();

  if (report.groupedPaths.length === 0) {
    elements.diagnosticsGroups.innerHTML =
      `<article class="event-log-empty">${escapeHtml(`No matching grouped paths. ${filterSummary} ${sortingSummary}`)}</article>`;
  } else {
    elements.diagnosticsGroups.innerHTML =
      [
        `<article class="event-log-entry"><strong>Filter summary</strong><p>${escapeHtml(`${filterSummary} ${sortingSummary}`)}</p></article>`,
        ...report.groupedPaths.map(
        (group) => `
          <article class="event-log-entry">
            <strong>${escapeHtml(`${group.deviceName} via ${String(group.backend).toUpperCase()} [${group.profile}]`)}</strong>
            <p>${escapeHtml(
              `${group.sessionCount} session(s), fallback ${group.fallbackCount} time(s) (${formatRatioAsPercent(group.fallbackRate)}), average start attempts ${group.averageStartAttempts}, avg max gap ${group.averageMaxChunkGapMs ?? 0} ms, low-signal events ${group.totalLowSignalEventCount ?? 0}, latest ${group.latestCompletedAt}.`
            )}</p>
          </article>
        `
      )
      ].join("");
  }

  if (report.recentSessions.length === 0) {
    elements.diagnosticsSessions.innerHTML =
      `<article class="event-log-empty">${escapeHtml(`No diagnostics sessions recorded for the current filters. ${filterSummary}`)}</article>`;
    return;
  }

  elements.diagnosticsSessions.innerHTML = report.recentSessions
    .map(
      (session) => `
        <article class="event-log-entry">
          <strong>${escapeHtml(session.trainingTitle)}</strong>
          <p>${escapeHtml(
            `${session.completedAt}${session.capture?.deviceName ? ` / ${session.capture.deviceName}` : ""}${
              session.capture?.backend ? ` / ${String(session.capture.backend).toUpperCase()}` : ""
            }${session.capture?.profile ? ` / ${session.capture.profile}` : ""}${
              session.capture?.startAttemptCount ? ` / attempts ${session.capture.startAttemptCount}` : ""
            }${session.capture?.fallbackApplied ? " / fallback applied" : ""}`
          )}</p>
          ${
            session.diagnostics?.noticeCount
              ? `<p>${escapeHtml(
                  `${session.diagnostics.noticeCount} notice(s): ${session.diagnostics.noticeCodes.join(", ")}`
                )}</p>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function renderDeviceDiagnosticsDetail() {
  const report = state.deviceDiagnosticsReport;

  if (!report) {
    elements.diagnosticsDeviceDetail.innerHTML =
      '<article class="event-log-empty">No device diagnostics loaded yet.</article>';
    return;
  }

  const recommendedPathSummary = report.recommendedPath
    ? `${report.recommendedPath.backend.toUpperCase()} ${report.recommendedPath.profile}, ${formatSelectionSource(report.recommendedPath.selectionSource)}, overall ${report.recommendedPath.stabilityScore ?? 0}/100, start ${report.recommendedPath.startReliabilityScore ?? 0}/100, runtime ${report.recommendedPath.runtimeStabilityScore ?? 0}/100, confidence ${report.recommendedPath.recommendationConfidenceScore ?? 0}/100, latency ${report.recommendedPath.latencyFitnessScore ?? 0}/100, signal ${report.recommendedPath.signalQualityScore ?? 0}/100.`
    : "No recommendation available yet for this device.";
  const latestCompletedAt = report.summary?.latestCompletedAt ?? "No completed sessions yet.";
  const runtimeIssueSummary = report.runtimeIssues?.topIssue
    ? `${report.runtimeIssues.totalWarningNotices} warning notice(s), top issue ${report.runtimeIssues.topIssue.code}, stage ${formatIssueStageLabel(report.runtimeIssues.topIssue.stage).toLowerCase()}.`
    : "No warning notices recorded for this device yet.";
  const setupActions = report.recommendedPath?.setupRecommendations ?? [];

  elements.diagnosticsDeviceDetail.innerHTML = `
    <article class="event-log-entry">
      <strong>${escapeHtml(report.deviceName)}</strong>
      <p>${escapeHtml(
        `${report.summary?.sessionCount ?? 0} session(s), ${report.summary?.pathCount ?? 0} path(s), fallback rate ${formatRatioAsPercent(report.summary?.fallbackRate)}, average attempts ${report.summary?.averageStartAttempts ?? 0}, latest ${latestCompletedAt}.`
      )}</p>
    </article>
    <article class="event-log-entry">
      <strong>Recommended path</strong>
      <p>${escapeHtml(recommendedPathSummary)}</p>
    </article>
    <article class="event-log-entry">
      <strong>Setup actions</strong>
      <p>${escapeHtml(formatSetupRecommendations(report.recommendedPath?.setupRecommendations ?? []))}</p>
    </article>
    <article class="event-log-entry">
      <strong>Setup feedback</strong>
      <p>${escapeHtml(formatSetupFeedbackSummary(report.recommendedPath?.setupFeedback))}</p>
    </article>
    ${
      setupActions.length
        ? setupActions
            .map((recommendation, index) => {
              const historyEntry = findSetupRecommendationHistoryEntry(report.recommendedPath, recommendation.id);

              return `
                <article class="event-log-entry">
                  <strong>${escapeHtml(recommendation.title)}</strong>
                  <p>${escapeHtml(recommendation.detail)}</p>
                  <p>${escapeHtml(`Priority: ${recommendation.priority}.`)}</p>
                  ${
                    historyEntry
                      ? `<p>${escapeHtml(
                          `Latest feedback: ${formatSetupRecommendationStatus(historyEntry.status)}${
                            historyEntry.evaluatedAt ? ` at ${historyEntry.evaluatedAt}` : ""
                          }.`
                        )}</p>`
                      : ""
                  }
                  ${
                    historyEntry?.status === "applied"
                      ? `
                        <div class="button-row inline-actions">
                          <button
                            class="button button-secondary button-small"
                            data-setup-history-id="${escapeHtml(historyEntry.id)}"
                            data-setup-outcome="improved"
                          >
                            Mark improved
                          </button>
                          <button
                            class="button button-secondary button-small"
                            data-setup-history-id="${escapeHtml(historyEntry.id)}"
                            data-setup-outcome="no-improvement"
                          >
                            No improvement
                          </button>
                        </div>
                      `
                      : !historyEntry
                        ? `
                          <div class="button-row inline-actions">
                            <button
                              class="button button-secondary button-small"
                              data-track-setup-action="${index}"
                            >
                              Track action
                            </button>
                          </div>
                        `
                        : ""
                  }
                </article>
              `;
            })
            .join("")
        : ""
    }
    <article class="event-log-entry">
      <strong>Runtime issue breakdown</strong>
      <p>${escapeHtml(runtimeIssueSummary)}</p>
    </article>
    ${
      report.scoredPaths?.length
        ? report.scoredPaths
            .map(
              (path) => `
                <article class="event-log-entry">
                  <strong>${escapeHtml(`${path.backend.toUpperCase()} ${path.profile}`)}</strong>
                  <p>${escapeHtml(
                    `${path.sessionCount} session(s), fallback ${formatRatioAsPercent(path.fallbackRate)}, attempts ${path.averageStartAttempts}, avg max gap ${path.averageMaxChunkGapMs ?? 0} ms, low-signal events ${path.totalLowSignalEventCount ?? 0}, overall ${path.stabilityScore}/100, start ${path.startReliabilityScore}/100, runtime ${path.runtimeStabilityScore}/100, confidence ${path.recommendationConfidenceScore}/100, latency ${path.latencyFitnessScore}/100, signal ${path.signalQualityScore ?? 0}/100.`
                  )}</p>
                </article>
              `
            )
            .join("")
        : '<article class="event-log-empty">No scored paths recorded for this device.</article>'
    }
    ${
      report.overrideHistory?.length
        ? `
          <article class="event-log-entry">
            <strong>Recent overrides</strong>
            <p>${escapeHtml(
              report.overrideHistory
                .map(
                  (entry) =>
                    `${entry.selectedBackend.toUpperCase()} ${entry.selectedProfile} over ${entry.recommendedBackend.toUpperCase()} ${entry.recommendedProfile} at ${entry.timestamp}`
                )
                .join(" | ")
            )}</p>
          </article>
        `
        : ""
    }
  `;

  elements.diagnosticsDeviceDetail
    .querySelectorAll("[data-track-setup-action]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const recommendationIndex = Number(button.dataset.trackSetupAction);
        const recommendation = setupActions[recommendationIndex];

        if (!recommendation || !report.recommendedPath) {
          return;
        }

        button.disabled = true;

        try {
          await recordSetupRecommendationUsage(report.recommendedPath, recommendation);
        } catch (error) {
          button.disabled = false;
          setStatus(elements.setupRecommendationFeedbackStatus, "error", error.message);
        }
      });
    });

  elements.diagnosticsDeviceDetail
    .querySelectorAll("[data-setup-history-id]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;

        try {
          await evaluateSetupRecommendationHistoryEntry(
            button.dataset.setupHistoryId,
            button.dataset.setupOutcome
          );
        } catch (error) {
          button.disabled = false;
          setStatus(elements.setupRecommendationFeedbackStatus, "error", error.message);
        }
      });
    });
}

function renderDeviceDiagnosticsSelector() {
  const deviceNames = getDiagnosticsDeviceNames(state.diagnosticsReport);
  const previousValue = elements.diagnosticsDeviceDetailSelect.value;

  if (deviceNames.length === 0) {
    elements.diagnosticsDeviceDetailSelect.innerHTML = '<option value="">No device selected</option>';
    elements.loadDeviceDiagnosticsButton.disabled = true;
    state.deviceDiagnosticsReport = null;
    renderDeviceDiagnosticsDetail();
    return;
  }

  elements.diagnosticsDeviceDetailSelect.innerHTML = deviceNames
    .map((deviceName) => `<option value="${escapeHtml(deviceName)}">${escapeHtml(deviceName)}</option>`)
    .join("");
  elements.diagnosticsDeviceDetailSelect.value =
    deviceNames.includes(previousValue) ? previousValue : deviceNames[0];
  elements.loadDeviceDiagnosticsButton.disabled = false;
}

async function loadSelectedDeviceDiagnostics({ silent = false } = {}) {
  const selectedDeviceName = elements.diagnosticsDeviceDetailSelect.value;
  const userId = getActiveUserId() || "anonymous";

  if (!selectedDeviceName) {
    state.deviceDiagnosticsReport = null;
    renderDeviceDiagnosticsDetail();
    return;
  }

  if (!silent) {
    elements.diagnosticsDeviceDetail.innerHTML =
      `<article class="event-log-entry"><strong>Loading</strong><p>${escapeHtml(`Loading diagnostics for ${selectedDeviceName}...`)}</p></article>`;
  }

  try {
    const response = await request(
      `/users/${encodeURIComponent(userId)}/diagnostics/devices/${encodeURIComponent(selectedDeviceName)}`
    );
    state.deviceDiagnosticsReport = response.data;
    renderDeviceDiagnosticsDetail();
  } catch (error) {
    state.deviceDiagnosticsReport = null;
    elements.diagnosticsDeviceDetail.innerHTML =
      `<article class="event-log-entry"><strong>Error</strong><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function clearDiagnosticsFilters() {
  elements.diagnosticsDeviceFilter.value = "";
  elements.diagnosticsBackendFilter.value = "";
  elements.diagnosticsProfileFilter.value = "";
  elements.diagnosticsSortBy.value = "latest";
  elements.diagnosticsSortDirection.value = "desc";
}

function updateActionButtons() {
  elements.createSessionButton.disabled = !state.selectedTrainingId || !state.engineConnected;
  elements.selectUnlockedTrainingButton.disabled = !getLatestUnlockedTraining();
  elements.startUnlockedTrainingButton.disabled = !canStartLatestUnlockedTraining();
  elements.runNativePreflightButton.disabled = !state.engineConnected;
  elements.disconnectEngineButton.disabled = !state.engineConnected;
  elements.startCalibrationButton.disabled = !state.engineConnected || state.calibrationInProgress;
  elements.stopLiveSessionButton.disabled = !(state.activeSessionId && state.activeInputMode === "live-stream");
  elements.loadNativeDevicesButton.disabled = !state.engineConnected;
  renderProgressionNextAction();
}

function getSelectedTraining() {
  return state.trainings.find((training) => training.id === state.selectedTrainingId) ?? null;
}

function applyTrainingSessionPreset(training, { targetedPractice = null } = {}) {
  if (!training) {
    return;
  }

  state.selectedTrainingId = training.id;
  renderTrainings();

  const shouldUseTargetedPractice =
    targetedPractice &&
    targetedPractice.recommendedTrainingId === training.id;

  if (shouldUseTargetedPractice) {
    syncPracticePresetControls();
    elements.sessionTempoBpm.value = targetedPractice.suggestedTempoBpm ?? training.tempoBpm;
    elements.practiceScope.value =
      targetedPractice.practiceScopeOverride ??
      (targetedPractice.sectionAction === "loop-section" && targetedPractice.recommendedSectionId
        ? "section-loop"
        : "full-chart");
    syncPracticePresetControls({ preserveTempo: true });

    if (
      elements.practiceScope.value === "section-loop" &&
      (targetedPractice.practiceSectionId ?? targetedPractice.recommendedSectionId)
    ) {
      elements.loopSectionId.value = targetedPractice.practiceSectionId ?? targetedPractice.recommendedSectionId;
    }

    if (elements.practiceScope.value === "section-loop" && targetedPractice.loopRepetitionCount) {
      elements.loopRepetitionCount.value = targetedPractice.loopRepetitionCount;
    }

    if (elements.practiceScope.value === "section-loop" && targetedPractice.loopTempoStepBpm !== undefined) {
      elements.loopTempoStepBpm.value = targetedPractice.loopTempoStepBpm;
    }

    return;
  }

  elements.practiceScope.value = "full-chart";
  syncPracticePresetControls();
  elements.sessionTempoBpm.value = training.tempoBpm;
  syncPracticePresetControls({ preserveTempo: true });
  elements.loopRepetitionCount.value = 1;
  elements.loopTempoStepBpm.value = 0;
}

function renderLoopSectionOptions() {
  const selectedTraining = getSelectedTraining();
  const sections = selectedTraining?.chart?.sections ?? [];
  const previousValue = elements.loopSectionId.value;

  elements.loopSectionId.innerHTML = sections.length > 0
    ? sections
        .map(
          (section) =>
            `<option value="${escapeHtml(section.id)}">${escapeHtml(`${section.label} (${section.lengthBeats} beats)`)}</option>`
        )
        .join("")
    : '<option value="">No chart sections available</option>';

  if (sections.some((section) => section.id === previousValue)) {
    elements.loopSectionId.value = previousValue;
  } else if (sections[0]) {
    elements.loopSectionId.value = sections[0].id;
  }
}

function syncPracticePresetControls({ preserveTempo = false } = {}) {
  const selectedTraining = getSelectedTraining();
  const isSectionLoop = elements.practiceScope.value === "section-loop";

  if (!preserveTempo && selectedTraining?.tempoBpm) {
    elements.sessionTempoBpm.value = selectedTraining.tempoBpm;
  }

  renderLoopSectionOptions();
  elements.loopSectionId.disabled = !isSectionLoop || !selectedTraining?.chart?.sections?.length;
  elements.loopRepetitionCount.disabled = !isSectionLoop;
  elements.loopTempoStepBpm.disabled = !isSectionLoop;

  if (!isSectionLoop) {
    elements.loopRepetitionCount.value = 1;
    elements.loopTempoStepBpm.value = 0;
  }
}

function applyDashboardPracticePreset() {
  const targetedPractice = state.dashboard?.targetedPractice;

  if (!targetedPractice) {
    setStatus(elements.sessionStatus, "error", "Load dashboard with a targeted practice recommendation first.");
    return;
  }

  if (targetedPractice.recommendedTrainingId) {
    state.selectedTrainingId = targetedPractice.recommendedTrainingId;
    renderTrainings();
  }
  applyTrainingSessionPreset(getSelectedTraining(), {
    targetedPractice
  });

  setStatus(
    elements.sessionStatus,
    "success",
    (targetedPractice.practiceSectionLabel ?? targetedPractice.recommendedSectionLabel)
      ? `Practice preset applied: ${targetedPractice.recommendedTrainingTitle}, section ${targetedPractice.practiceSectionLabel ?? targetedPractice.recommendedSectionLabel}, ${targetedPractice.suggestedTempoBpm} BPM, ${targetedPractice.loopRepetitionCount ?? 1} rep(s)${targetedPractice.masteryGate ? `, gate ${targetedPractice.masteryGate.status}` : ""}${targetedPractice.practiceSectionLabel && targetedPractice.practiceSectionLabel !== targetedPractice.recommendedSectionLabel ? `, recovery for ${targetedPractice.recommendedSectionLabel}` : ""}${targetedPractice.recoveryGoalTrainingTitle ? targetedPractice.recoveryProgressStatus === "goal-ready" ? `, return unlocked to ${targetedPractice.recoveryGoalTrainingTitle}` : `, temporary route to ${targetedPractice.recoveryGoalTrainingTitle}` : ""}.`
      : `Practice preset applied: ${targetedPractice.recommendedTrainingTitle}, ${targetedPractice.suggestedTempoBpm} BPM.`
  );
  renderProgressionNextAction();
}

function getPendingRecoveryRouteContext() {
  const targetedPractice = state.dashboard?.targetedPractice;

  if (
    !targetedPractice ||
    targetedPractice.recoveryProgressStatus === "goal-ready" ||
    !targetedPractice.recoveryGoalTrainingId ||
    !targetedPractice.recoveryTrainingId ||
    targetedPractice.recommendedTrainingId !== targetedPractice.recoveryTrainingId ||
    state.selectedTrainingId !== targetedPractice.recommendedTrainingId
  ) {
    return null;
  }

  return {
    recoveryGoalTrainingId: targetedPractice.recoveryGoalTrainingId,
    ...(targetedPractice.recoveryGoalSectionId
      ? {
          recoveryGoalSectionId: targetedPractice.recoveryGoalSectionId
        }
      : {}),
    ...(targetedPractice.recoveryReturnTempoBpm !== undefined
      ? {
          recoveryReturnTempoBpm: targetedPractice.recoveryReturnTempoBpm
        }
      : {}),
    ...(targetedPractice.recoveryReturnLoopRepetitionCount !== undefined
      ? {
          recoveryReturnLoopRepetitionCount: targetedPractice.recoveryReturnLoopRepetitionCount
        }
      : {}),
    ...(targetedPractice.recoveryReturnLoopTempoStepBpm !== undefined
      ? {
          recoveryReturnLoopTempoStepBpm: targetedPractice.recoveryReturnLoopTempoStepBpm
        }
      : {}),
    ...(targetedPractice.recoveryReason
      ? {
          recoveryReason: targetedPractice.recoveryReason
        }
      : {}),
    ...(targetedPractice.recoveryStrategy
      ? {
          recoveryStrategy: targetedPractice.recoveryStrategy
        }
      : {})
  };
}

function getPendingReturnAttemptContext() {
  const targetedPractice = state.dashboard?.targetedPractice;

  if (
    !targetedPractice ||
    (
      targetedPractice.recoveryProgressStatus !== "goal-ready" &&
      targetedPractice.recoveryProgressStatus !== "return-confirmed" &&
      targetedPractice.recoveryProgressStatus !== "full-chart-reintegration" &&
      targetedPractice.recoveryProgressStatus !== "full-chart-reintegrated"
    ) ||
    !targetedPractice.recoveryTrainingId ||
    (
      targetedPractice.recoveryProgressStatus === "full-chart-reintegrated" &&
      targetedPractice.promotionTargetTrainingId &&
      targetedPractice.recommendedTrainingId !== targetedPractice.recoveryGoalTrainingId
    ) ||
    state.selectedTrainingId !== targetedPractice.recommendedTrainingId
  ) {
    return null;
  }

  return {
    returnRecoveryTrainingId: targetedPractice.recoveryTrainingId,
    ...(targetedPractice.recommendedSectionId
      ? {
          returnGoalSectionId: targetedPractice.recommendedSectionId
        }
      : {}),
    ...(targetedPractice.recoveryReason
      ? {
          returnReason: targetedPractice.recoveryReason
        }
      : {})
  };
}

function getPendingPromotionLandingContext() {
  const targetedPractice = state.dashboard?.targetedPractice;

  if (
    !targetedPractice ||
    (
      targetedPractice.recoveryProgressStatus !== "full-chart-reintegrated" &&
      targetedPractice.recoveryProgressStatus !== "promotion-landing" &&
      targetedPractice.recoveryProgressStatus !== "promotion-landing-confirmed" &&
      targetedPractice.recoveryProgressStatus !== "promotion-ramp" &&
      targetedPractice.recoveryProgressStatus !== "promotion-ramp-confirmed" &&
      targetedPractice.recoveryProgressStatus !== "promotion-ramp-failed" &&
      targetedPractice.recoveryProgressStatus !== "promotion-graduated" &&
      targetedPractice.recoveryProgressStatus !== "promotion-reentry" &&
      targetedPractice.recoveryProgressStatus !== "promotion-reentry-confirmed" &&
      targetedPractice.recoveryProgressStatus !== "promotion-reentry-failed" &&
      targetedPractice.recoveryProgressStatus !== "promotion-chain-graduated" &&
      targetedPractice.recoveryProgressStatus !== "promotion-chain-graduation" &&
      targetedPractice.recoveryProgressStatus !== "promotion-chain-graduation-confirmed" &&
      targetedPractice.recoveryProgressStatus !== "promotion-chain-graduation-failed" &&
      targetedPractice.recoveryProgressStatus !== "terminal-training-mastery" &&
      targetedPractice.recoveryProgressStatus !== "terminal-training-mastered" &&
      targetedPractice.recoveryProgressStatus !== "terminal-mastery-graduated" &&
      targetedPractice.recoveryProgressStatus !== "promotion-chain" &&
      targetedPractice.recoveryProgressStatus !== "promotion-chain-confirmed" &&
      targetedPractice.recoveryProgressStatus !== "promotion-chain-failed"
    ) ||
    !targetedPractice.promotionTargetTrainingId ||
    !targetedPractice.promotionSourceTrainingId ||
    state.selectedTrainingId !== targetedPractice.recommendedTrainingId
  ) {
    return null;
  }

  return {
    promotionSourceTrainingId: targetedPractice.promotionSourceTrainingId,
    promotionPhase:
      targetedPractice.recoveryProgressStatus === "promotion-graduated" ||
      targetedPractice.recoveryProgressStatus === "promotion-reentry" ||
      targetedPractice.recoveryProgressStatus === "promotion-reentry-confirmed" ||
      targetedPractice.recoveryProgressStatus === "promotion-reentry-failed"
        ? "reentry"
        : targetedPractice.recoveryProgressStatus === "promotion-chain-graduated" ||
          targetedPractice.recoveryProgressStatus === "promotion-chain-graduation" ||
          targetedPractice.recoveryProgressStatus === "promotion-chain-graduation-confirmed" ||
          targetedPractice.recoveryProgressStatus === "promotion-chain-graduation-failed" ||
          targetedPractice.recoveryProgressStatus === "terminal-training-mastery" ||
          targetedPractice.recoveryProgressStatus === "terminal-training-mastered" ||
          targetedPractice.recoveryProgressStatus === "terminal-mastery-graduated"
          ? "chain-graduation"
        : targetedPractice.recoveryProgressStatus === "promotion-chain" ||
          targetedPractice.recoveryProgressStatus === "promotion-chain-confirmed" ||
          targetedPractice.recoveryProgressStatus === "promotion-chain-failed"
          ? "chain-validation"
        : targetedPractice.promotionRamp
          ? "ramp"
          : "landing",
    ...(targetedPractice.promotionSourceTempoBpm !== undefined
      ? {
          promotionSourceTempoBpm: targetedPractice.promotionSourceTempoBpm
        }
      : {}),
    ...(targetedPractice.promotionRamp?.baseTempoBpm !== undefined
      ? {
          promotionRampBaseTempoBpm: targetedPractice.promotionRamp.baseTempoBpm
        }
      : {}),
    ...(targetedPractice.promotionRamp?.targetTempoBpm !== undefined
      ? {
          promotionRampTargetTempoBpm: targetedPractice.promotionRamp.targetTempoBpm
        }
      : {}),
    ...(targetedPractice.promotionChain?.baseTempoBpm !== undefined
      ? {
          promotionChainBaseTempoBpm: targetedPractice.promotionChain.baseTempoBpm
        }
      : targetedPractice.promotionChainGraduation?.baseTempoBpm !== undefined
        ? {
            promotionChainBaseTempoBpm: targetedPractice.promotionChainGraduation.baseTempoBpm
          }
      : {}),
    ...(targetedPractice.promotionChain?.targetTempoBpm !== undefined
      ? {
          promotionChainTargetTempoBpm: targetedPractice.promotionChain.targetTempoBpm
        }
      : targetedPractice.promotionChainGraduation?.targetTempoBpm !== undefined
        ? {
            promotionChainTargetTempoBpm: targetedPractice.promotionChainGraduation.targetTempoBpm
          }
      : {}),
    ...(targetedPractice.promotionTargetReason
      ? {
          promotionReason: targetedPractice.promotionTargetReason
        }
      : {})
  };
}

function renderTrainings() {
  elements.trainingCount.textContent = `${state.trainings.length} items`;

  if (state.trainings.length === 0) {
    elements.trainingList.innerHTML = `
      <article class="training-card training-card-empty">
        <p>No trainings loaded yet.</p>
      </article>
    `;
    updateActionButtons();
    return;
  }

  elements.trainingList.innerHTML = state.trainings
    .map((training) => {
      const isSelected = training.id === state.selectedTrainingId;
      const contentUnlockNode =
        training.access ??
        state.dashboard?.contentUnlockGraph?.nodes?.find((node) => node.trainingId === training.id) ??
        null;
      const isLocked = contentUnlockNode ? !contentUnlockNode.isUnlocked : false;
      const normalizedCardLabel = contentUnlockNode?.unlockState
        ? `${training.difficulty} - ${contentUnlockNode.unlockState}`
        : training.difficulty;
      const lockedReason = contentUnlockNode?.lockedReason ?? null;
      const unlockRequirementSummary =
        contentUnlockNode?.unlockRequirementSummary ??
        "Load dashboard to see unlock requirements.";
      const unlockSteps =
        contentUnlockNode?.unlockRequirements?.map((requirement) => requirement.summary).join(" ") ??
        unlockRequirementSummary;
      const unlockProgressSummary =
        contentUnlockNode?.unlockProgress?.summary ??
        "Progress unavailable until trainings are loaded.";
      const unlockRequirementProgress =
        contentUnlockNode?.unlockRequirements?.length > 0
          ? contentUnlockNode.unlockRequirements
              .map((requirement) => `${requirement.isSatisfied ? "[done]" : "[todo]"} ${requirement.trainingTitle}`)
              .join(" | ")
          : "No prerequisite trainings.";
      const cardLabel = contentUnlockNode?.unlockState
        ? `${training.difficulty} · ${contentUnlockNode.unlockState}`
        : training.difficulty;

      return `
        <article class="training-card ${isSelected ? "training-card-selected" : ""}">
          <p class="panel-label">${normalizedCardLabel}</p>
          <h3>${training.title}</h3>
          <p>${training.description}</p>
          <ul>
            <li>Tempo: ${training.tempoBpm} BPM</li>
            <li>Tuning: ${training.tuning}</li>
            <li>Exercise: ${training.exerciseId}</li>
            <li>Unlock: ${contentUnlockNode ? contentUnlockNode.unlockSource : "Load dashboard to see unlock state"}</li>
            <li>${isLocked ? "Locked because" : "Access rationale"}: ${lockedReason ?? unlockRequirementSummary}</li>
            <li>How to unlock: ${isLocked ? unlockSteps : "Already available for this user."}</li>
            <li>Unlock progress: ${unlockProgressSummary}</li>
            <li>Prerequisite status: ${unlockRequirementProgress}</li>
            <li>Completed sessions: ${contentUnlockNode?.completedSessionCount ?? 0}</li>
            <li>Next unlocks: ${contentUnlockNode?.nextTrainingTitles?.join(", ") || "n/a"}</li>
            <li>Targets: ${training.targetSequence?.map((target) => `S${target.stringNumber}:${target.note}@${target.beatOffset}`).join(", ") ?? "n/a"}</li>
            <li>Chart: ${training.chartSummary ? `${training.chartSummary.sectionCount} section(s), ${training.chartSummary.restCount} rest(s), ${training.chartSummary.chartLengthBeats} beats` : "n/a"}</li>
            <li>Sections: ${training.chart?.sections?.map((section) => `${section.label} (${section.lengthBeats} beats)`).join(", ") ?? "n/a"}</li>
          </ul>
          <button class="button ${isSelected ? "button-primary" : "button-secondary"}" data-training-id="${training.id}" ${isLocked ? "disabled" : ""}>
            ${isLocked ? "Locked training" : isSelected ? "Selected training" : "Select training"}
          </button>
        </article>
      `;
    })
    .join("");

  elements.trainingList.querySelectorAll("[data-training-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTrainingId = button.dataset.trainingId;
      renderTrainings();
      syncPracticePresetControls();
      setStatus(elements.sessionStatus, null, `Training ${state.selectedTrainingId} selected. Ready to create a session.`);
      updateActionButtons();
    });
  });

  updateActionButtons();
}

async function checkHealth() {
  state.backendUrl = elements.backendUrl.value.trim();
  setStatus(elements.healthStatus, null, "Checking backend health...");

  try {
    const payload = await request("/health");
    setStatus(
      elements.healthStatus,
      "success",
      `Backend is healthy. Service: ${payload.data.service}. Timestamp: ${payload.data.timestamp}`
    );
  } catch (error) {
    setStatus(elements.healthStatus, "error", error.message);
  }
}

async function loadTrainings() {
  state.backendUrl = elements.backendUrl.value.trim();
  const userId = getActiveUserId() || "anonymous";
  setStatus(elements.sessionStatus, null, "Loading training catalog...");

  try {
    const payload = await request(`/users/${encodeURIComponent(userId)}/trainings`);
    state.trainings = payload.data.trainings;
    state.selectedTrainingId =
      state.trainings.find((training) => training.access?.isUnlocked)?.id ??
      state.trainings[0]?.id ??
      null;
    renderTrainings();
    syncPracticePresetControls();
    renderProgressionNextAction();
    setStatus(
      elements.sessionStatus,
      "success",
      `Training catalog loaded. Unlocked: ${payload.data.summary.unlockedTrainingCount}, locked: ${payload.data.summary.lockedTrainingCount}.`
    );
  } catch (error) {
    setStatus(elements.sessionStatus, "error", error.message);
  }
}

async function loadDashboard() {
  state.backendUrl = elements.backendUrl.value.trim();
  const userId = getActiveUserId() || "anonymous";
  const filterQuery = createDiagnosticsFilterQuery();

  setStatus(elements.calibrationStatus, null, "Loading dashboard...");

  try {
    const [dashboardPayload, diagnosticsPayload] = await Promise.all([
      request(`/users/${encodeURIComponent(userId)}/dashboard`),
      request(`/users/${encodeURIComponent(userId)}/diagnostics${filterQuery}`)
    ]);
    state.dashboard = dashboardPayload.data;
    state.diagnosticsReport = diagnosticsPayload.data;
    state.progressionCheckpointSnapshots = dashboardPayload.data.checkpointHistorySnapshots ?? [];
    syncTrainingAccessFromDashboard();
    renderTrainings();
    elements.autoApplyCaptureRecommendation.checked =
      dashboardPayload.data.capturePreferences?.autoApplyRecommendation ?? true;
    renderDashboard();
      renderSessionCompletionRecap();
      renderCheckpointRecapCards();
      renderCheckpointPathSummaryCards();
      renderCheckpointPathHandoffStatus();
      renderCheckpointHistorySnapshots();
      renderCheckpointHistoryDetail();
      renderProgressionTimeline();
    renderUnlockCelebration();
    renderProgressionNextAction();
    renderDiagnosticsReport();
    await loadSelectedDeviceDiagnostics({ silent: true });
    void refreshSessionCaptureRecommendation({ force: true });

    if (dashboardPayload.data.calibrationProfile) {
      elements.calibrationOffset.value = dashboardPayload.data.calibrationProfile.offsetMs;
      setStatus(
        elements.calibrationStatus,
        "success",
        `Dashboard loaded. Saved calibration offset: ${dashboardPayload.data.calibrationProfile.offsetMs} ms.`
      );
    } else {
      setStatus(elements.calibrationStatus, null, "Dashboard loaded. No calibration profile saved yet.");
    }
  } catch (error) {
    setStatus(elements.calibrationStatus, "error", error.message);
  }
}

async function connectEngine() {
  if (state.engineSocket && state.engineSocket.readyState === WebSocket.OPEN) {
    setStatus(elements.engineStatus, "success", "Engine is already connected.");
    return;
  }

  state.engineUrl = elements.engineUrl.value.trim();
  setStatus(elements.engineStatus, null, "Connecting to local engine...");

  const socket = new WebSocket(state.engineUrl);

  socket.addEventListener("open", () => {
    state.engineSocket = socket;
    state.engineConnected = true;
    updateActionButtons();

    sendEngineMessage("engine.init", {
      minVersion: 1,
      maxVersion: 1,
      clientName: "web"
    });
  });

  socket.addEventListener("message", async (event) => {
    const message = JSON.parse(event.data);
    const pendingRequest = message.requestId ? engineRequestState.pending.get(message.requestId) : null;

    if (pendingRequest) {
      clearTimeout(pendingRequest.timeoutId);
      engineRequestState.pending.delete(message.requestId);

      if (message.type === "engine.error") {
        pendingRequest.reject(new Error(`${message.payload.code}: ${message.payload.message}`));
      } else if (!pendingRequest.responseType || pendingRequest.responseType === message.type) {
        pendingRequest.resolve(message);
      } else {
        pendingRequest.reject(
          new Error(`Received ${message.type} while waiting for ${pendingRequest.responseType}.`)
        );
      }
    }

    if (message.type === "engine.ready") {
      setStatus(
        elements.engineStatus,
        "success",
        `Engine ready. Version ${message.payload.engineVersion}. Capabilities: audio=${message.payload.capabilities.audio}, scoring=${message.payload.capabilities.scoring}.`
      );
      pushEventLog("Engine ready", `Connected to ${state.engineUrl}`);
      return;
    }

    if (message.type === "native.devices.response") {
      state.nativeDevices = message.payload.devices;
      applyRecommendedNativeSetup();
      invalidateNativePreflight("Native preflight needs rerun after loading or changing native devices.");
      void refreshSessionCaptureRecommendation({ force: true });
      const recommendedDevice = getRecommendedNativeDevice();
      setStatus(
        elements.engineStatus,
        "success",
        `Loaded ${message.payload.devices.length} native input device(s) from engine.${
          recommendedDevice
            ? ` Recommended: ${recommendedDevice.name} via ${(recommendedDevice.recommendedBackend ?? recommendedDevice.backend).toUpperCase()} with profile ${recommendedDevice.recommendedProfile ?? "balanced"}.`
            : ""
        }`
      );
      pushEventLog(
        "Native devices",
        recommendedDevice
          ? `${message.payload.devices.length} input device(s) available. Recommended path: ${recommendedDevice.name} via ${(recommendedDevice.recommendedBackend ?? recommendedDevice.backend).toUpperCase()} using profile ${recommendedDevice.recommendedProfile ?? "balanced"}.`
          : `${message.payload.devices.length} input device(s) available.`
      );
      return;
    }

    if (message.type === "native.preflight.response") {
      const requestedText = `${message.payload.requested.backend.toUpperCase()} ${message.payload.requested.captureProfile}`;
      const warningText =
        message.payload.warnings.length > 0
          ? ` Warnings: ${message.payload.warnings.join(" ")}`
          : "";
      const selectedDeviceText = message.payload.selectedDevice
        ? `${message.payload.selectedDevice.name} via ${message.payload.resolved.backend.toUpperCase()}`
        : `${message.payload.resolved.backend.toUpperCase()} device`;
      const baseMessage =
        `Preflight ${message.payload.ok ? "ready" : "completed with warnings"}. ` +
        `${selectedDeviceText}, requested ${requestedText}, resolved ${message.payload.resolved.backend.toUpperCase()} ${message.payload.resolved.captureProfile}, ` +
        `buffer ${message.payload.resolved.bufferMs} ms, ${message.payload.resolved.numberOfBuffers} buffers, ` +
        `event sync ${message.payload.resolved.useEventSync}, ${message.payload.resolved.sampleRate} Hz.`;
      const fallbackText = message.payload.fallbackApplied && message.payload.fallbackReason
        ? ` Fallback applied: ${message.payload.fallbackReason}`
        : "";

      setStatus(
        elements.nativePreflightStatus,
        !message.payload.ok ? "error" : message.payload.hasWarnings ? null : "success",
        `${baseMessage}${fallbackText}${warningText}`
      );
      pushEventLog("Native preflight", `${baseMessage}${fallbackText}${warningText}`);
      return;
    }

    if (message.type === "engine.heartbeat") {
      setStatus(
        elements.engineStatus,
        "success",
        `Engine heartbeat OK. Uptime ${message.payload.uptimeMs} ms, audio device connected: ${message.payload.audioDeviceConnected}.`
      );
      return;
    }

    if (message.type === "calibration.started") {
      state.calibrationInProgress = true;
      updateActionButtons();
      setStatus(elements.calibrationStatus, null, "Calibration started.");
      pushEventLog("Calibration started", "Engine entered calibration mode.");
      return;
    }

    if (message.type === "calibration.progress") {
      setStatus(
        elements.calibrationStatus,
        null,
        `Calibration step ${message.payload.step}/${message.payload.totalSteps}: ${message.payload.message}`
      );
      return;
    }

    if (message.type === "calibration.result") {
      state.calibrationInProgress = false;
      updateActionButtons();
      elements.calibrationOffset.value = String(message.payload.recommendedOffsetMs);

      try {
        const userId = getActiveUserId() || "anonymous";
        await request(`/users/${encodeURIComponent(userId)}/calibration`, {
          method: "PUT",
          body: JSON.stringify({
            offsetMs: message.payload.recommendedOffsetMs,
            measuredLatencyMs: message.payload.measuredLatencyMs,
            noiseFloorDb: message.payload.noiseFloorDb
          })
        });

        setStatus(
          elements.calibrationStatus,
          "success",
          `Calibration saved. Recommended offset ${message.payload.recommendedOffsetMs} ms, measured latency ${message.payload.measuredLatencyMs} ms.`
        );
        pushEventLog(
          "Calibration result",
          `Offset ${message.payload.recommendedOffsetMs} ms, latency ${message.payload.measuredLatencyMs} ms, noise floor ${message.payload.noiseFloorDb} dB.`
        );
        await loadDashboard();
      } catch (error) {
        setStatus(elements.calibrationStatus, "error", `Calibration finished but could not be saved: ${error.message}`);
      }
      return;
    }

    if (message.type === "session.started") {
      // Open gameplay UI
      const activeTraining = state.trainings.find((t) => t.id === message.payload.trainingId) ?? null;
      if (activeTraining) {
        openGameplayOverlay(activeTraining, message.payload);
      }

      state.sessionDiagnostics = {
        ...state.sessionDiagnostics,
        sessionId: message.sessionId,
        inputMode: message.payload.inputMode
      };
      renderSessionDiagnostics();
      setStatus(
        elements.summaryStatus,
        null,
        `Engine accepted session ${message.sessionId} for exercise ${message.payload.exerciseId}${
          message.payload.practiceScope === "section-loop" && message.payload.loopSectionId
            ? ` (section ${message.payload.loopSectionId} @ ${message.payload.tempoBpm} BPM${
                message.payload.loopRepetitionCount ? `, ${message.payload.loopRepetitionCount} rep(s)` : ""
              }${
                message.payload.loopTempoStepBpm ? `, +${message.payload.loopTempoStepBpm} BPM` : ""
              })`
            : message.payload.tempoBpm
              ? ` (@ ${message.payload.tempoBpm} BPM)`
              : ""
        }.`
      );
      pushEventLog(
        "Session started",
        `Training ${message.payload.trainingId}, exercise ${message.payload.exerciseId}${
          message.payload.practiceScope === "section-loop" && message.payload.loopSectionId
            ? `, section ${message.payload.loopSectionId}${
                message.payload.loopRepetitionCount ? `, ${message.payload.loopRepetitionCount} rep(s)` : ""
              }${
                message.payload.loopTempoStepBpm ? `, +${message.payload.loopTempoStepBpm} BPM` : ""
              }`
            : ""
        }${message.payload.tempoBpm ? `, ${message.payload.tempoBpm} BPM` : ""}`
      );
      return;
    }

    if (message.type === "session.notice") {
      state.sessionDiagnostics.currentCapture = mergeDefinedFields(
        state.sessionDiagnostics.currentCapture,
        message.payload.capture
      );
      pushSessionDiagnosticNotice({
        code: message.payload.code,
        level: message.payload.level,
        message: message.payload.message,
        capture: message.payload.capture,
        timestamp: message.timestamp
      });
      renderSessionDiagnostics();

      const captureText = message.payload.capture
        ? [
            message.payload.capture.requestedBackend && message.payload.capture.requestedProfile
              ? `requested ${message.payload.capture.requestedBackend.toUpperCase()} ${message.payload.capture.requestedProfile}`
              : null,
            message.payload.capture.backend && message.payload.capture.profile
              ? `resolved ${message.payload.capture.backend.toUpperCase()} ${message.payload.capture.profile}`
              : null,
            message.payload.capture.startAttemptCount
              ? `attempt ${message.payload.capture.startAttemptCount}`
              : null
          ]
            .filter(Boolean)
            .join(", ")
        : "";

      setStatus(
        elements.sessionStatus,
        message.payload.level === "warning" ? null : "success",
        `${message.payload.message}${captureText ? ` (${captureText})` : ""}`
      );
      pushEventLog(
        "Session notice",
        `${message.payload.code}: ${message.payload.message}${captureText ? ` (${captureText})` : ""}`
      );
      return;
    }

    if (message.type === "score.event") {
      // Update gameplay overlay
      onGameplayScoreEvent(message.payload);

      if (message.payload.eventKind === "ghost-note") {
        pushEventLog(
          "Ghost note",
          `Outside chart: received string ${message.payload.stringNumber ?? "?"}, note ${message.payload.note}; combo ${message.payload.comboCount}, multiplier x${message.payload.comboMultiplier}, delta ${message.payload.scoreDelta}.`
        );
        return;
      }

      if (message.payload.eventKind === "missed-target") {
        pushEventLog(
          "Missed target",
          `Target ${message.payload.targetIndex + 1}: bar ${message.payload.measureNumber}, beat ${message.payload.beatNumber}${message.payload.subdivision ? `+${message.payload.subdivision}` : ""}, string ${message.payload.expectedStringNumber}, note ${message.payload.expectedNote}; no valid hit detected, combo ${message.payload.comboCount}, multiplier x${message.payload.comboMultiplier}, delta ${message.payload.scoreDelta}.`
        );
        return;
      }

      pushEventLog(
        message.payload.hit ? "Hit" : "Near miss",
        `Target ${message.payload.targetIndex + 1}: bar ${message.payload.measureNumber}, beat ${message.payload.beatNumber}${message.payload.subdivision ? `+${message.payload.subdivision}` : ""}, string ${message.payload.expectedStringNumber}, note ${message.payload.expectedNote}; received string ${message.payload.stringNumber ?? "?"}, note ${message.payload.note}; note ${message.payload.noteHit ? "ok" : "miss"}, string ${message.payload.stringHit ? "ok" : "miss"}, timing ${message.payload.timingClass} (${message.payload.timingOffsetMs} ms / window ${message.payload.timingWindowMs} ms), hold ${message.payload.sustainHit ? "ok" : message.payload.releasedEarly ? "early-release" : "miss"} (${message.payload.detectedDurationMs}/${message.payload.expectedDurationMs} ms, coverage ${message.payload.holdCoverage}), release ${message.payload.releaseHit ? "ok" : message.payload.overheld ? `overheld by ${message.payload.releaseOvershootMs} ms` : message.payload.releasedEarly ? "not-reached" : "miss"}, combo ${message.payload.fullComboHit ? "ok" : "miss"} [count ${message.payload.comboCount}, x${message.payload.comboMultiplier}${message.payload.comboBroken ? ", break" : ""}], delta ${message.payload.scoreDelta}.`
      );
      return;
    }

    if (message.type === "session.summary") {
      // Show results in gameplay overlay
      onGameplaySessionSummary(message.payload);

      try {
        const previousTargetedPractice = state.dashboard?.targetedPractice ?? null;
        const payload = await request(`/sessions/${message.sessionId}/summary`, {
          method: "POST",
          body: JSON.stringify({
            ...message.payload,
            diagnostics: createSessionDiagnosticsPayload()
          })
        });
        if (payload.data.user) {
          applyDashboardUserUpdate(payload.data.user);
        }
        const captureSummary = payload.data.session.summary.capture;
        const unlockTransition = payload.data.unlockTransition ?? null;
        const setupRecommendationFollowup = payload.data.setupRecommendationFollowup ?? null;
        state.lastUnlockTransition = unlockTransition;
        state.sessionDiagnostics.currentCapture = mergeDefinedFields(
          state.sessionDiagnostics.currentCapture,
          captureSummary
        );
        state.sessionDiagnostics.lastSummary = {
          totalScore: payload.data.session.summary.totalScore,
          accuracy: payload.data.session.summary.accuracy,
          notesHit: message.payload.notesHit,
          notesDetected: message.payload.notesDetected
        };
        renderSessionDiagnostics();

        setStatus(
          elements.summaryStatus,
          "success",
          `Session ${message.sessionId} completed. Score ${payload.data.session.summary.totalScore}, accuracy ${payload.data.session.summary.accuracy}${
            captureSummary?.profile ? `, profile ${captureSummary.profile}` : ""
          }${
            captureSummary?.backend ? `, backend ${captureSummary.backend.toUpperCase()}` : ""
          }${
            captureSummary?.fallbackApplied ? ", fallback applied" : ""
          }${captureSummary?.sampleRate ? `, ${captureSummary.sampleRate} Hz` : ""}${
            unlockTransition?.hasNewUnlocks
              ? `. New unlocks: ${unlockTransition.unlockedTrainingTitles.join(", ")}.`
              : "."
          }`
        );
        if (payload.data.session.summary.artifact?.filePath) {
          state.lastArtifactPath = payload.data.session.summary.artifact.filePath;
          elements.inputMode.value = "wav-file";
          elements.inputFilePath.value = state.lastArtifactPath;
        }
        pushEventLog(
          "Session summary",
          [
            `Saved to backend. Notes hit ${message.payload.notesHit}/${message.payload.notesDetected}.`,
            captureSummary?.deviceName
              ? `Capture used ${captureSummary.deviceName}${captureSummary.backend ? ` via ${captureSummary.backend.toUpperCase()}` : ""}.`
              : null,
            captureSummary?.profile
              ? `Profile ${captureSummary.profile}${captureSummary.bufferMs ? ` with buffer ${captureSummary.bufferMs} ms` : ""}${captureSummary.numberOfBuffers ? ` and ${captureSummary.numberOfBuffers} buffers` : ""}${captureSummary.useEventSync !== undefined ? `, event sync ${captureSummary.useEventSync}` : ""}.`
              : null,
            captureSummary?.fallbackApplied
              ? `Fallback applied from ${captureSummary.requestedBackend?.toUpperCase() ?? "requested backend"} ${captureSummary.requestedProfile ?? "requested profile"}${captureSummary.fallbackReason ? ` because ${captureSummary.fallbackReason}` : ""}.`
              : null,
            captureSummary?.startAttemptCount
              ? `Capture started after ${captureSummary.startAttemptCount} attempt(s).`
              : null,
            captureSummary?.sampleRate
              ? `Sample rate ${captureSummary.sampleRate} Hz, chunks ${captureSummary.chunkCount ?? "n/a"}.`
              : null,
            payload.data.session.summary.artifact?.filePath
              ? `Artifact ready at ${payload.data.session.summary.artifact.filePath}.`
              : null
          ]
            .filter(Boolean)
            .join(" ")
        );
        if (setupRecommendationFollowup) {
          pushEventLog(
            "Technical follow-up",
            `${setupRecommendationFollowup.recommendationTitle}: ${
              setupRecommendationFollowup.status === "improved" ? "improved" : "no improvement"
            }. ${setupRecommendationFollowup.evaluationNotes ?? ""}`.trim()
          );
        }
        if (unlockTransition?.hasNewUnlocks) {
          pushEventLog(
            "Content unlocked",
            `Unlocked ${unlockTransition.unlockedTrainingTitles.join(", ")} after this session.`
          );
        }
        await stopLiveCapture(false);
        state.activeSessionId = null;
        state.activeInputMode = null;
        updateActionButtons();
        await loadDashboard();
        state.lastSessionRecap = buildSessionCompletionRecap({
          sessionId: message.sessionId,
          sessionSummary: payload.data.session.summary,
          unlockTransition,
          previousTargetedPractice,
          nextTargetedPractice: state.dashboard?.targetedPractice ?? null
        });
        state.checkpointPathAutoFocus = buildCheckpointPathAutoFocus(message.sessionId);
        applyCheckpointPathAutoFocusState();
        renderSessionCompletionRecap();
        renderCheckpointRecapCards();
        renderCheckpointPathSummaryCards();
        renderCheckpointPathHandoffStatus();
        renderCheckpointHistorySnapshots();
        renderCheckpointHistoryDetail();
        renderProgressionTimeline();
        renderUnlockCelebration();
        renderProgressionNextAction();
        focusCheckpointPathAutoFocus();
      } catch (error) {
        await stopLiveCapture(false);
        state.activeSessionId = null;
        state.activeInputMode = null;
        updateActionButtons();
        setStatus(elements.summaryStatus, "error", `Engine finished session, but backend save failed: ${error.message}`);
      }
      return;
    }

    if (message.type === "engine.error") {
      setStatus(elements.engineStatus, "error", `${message.payload.code}: ${message.payload.message}`);
    }
  });

  socket.addEventListener("close", () => {
    state.engineConnected = false;
    state.calibrationInProgress = false;
    clearPendingEngineRequests(new Error("Engine connection closed."));
    void stopLiveCapture(false);
    state.activeSessionId = null;
    state.activeInputMode = null;
    state.engineSocket = null;
    resetSessionDiagnostics();
    updateActionButtons();
    setStatus(elements.engineStatus, null, "Engine is not connected.");
  });

  socket.addEventListener("error", () => {
    state.engineConnected = false;
    state.calibrationInProgress = false;
    clearPendingEngineRequests(new Error("Engine connection failed."));
    void stopLiveCapture(false);
    state.activeSessionId = null;
    state.activeInputMode = null;
    state.engineSocket = null;
    resetSessionDiagnostics();
    updateActionButtons();
    setStatus(elements.engineStatus, "error", "Could not connect to the local engine.");
  });
}

function disconnectEngine() {
  if (state.engineSocket) {
    state.engineSocket.close();
  }
}

function handleNativeBackendChange() {
  renderNativeDevices();
  invalidateNativePreflight("Native preflight needs rerun after changing the native backend.");
  void refreshSessionCaptureRecommendation({ force: true });
}

function loadNativeDevices() {
  try {
    sendEngineMessage("native.devices.request", {
      source: "capture"
    });
    setStatus(elements.engineStatus, null, "Loading native input devices...");
  } catch (error) {
    setStatus(elements.engineStatus, "error", error.message);
  }
}

async function runNativePreflight() {
  try {
    setStatus(elements.nativePreflightStatus, null, "Running native capture preflight...");
    await requestNativePreflight();
  } catch (error) {
    setStatus(elements.nativePreflightStatus, "error", error.message);
  }
}

function startCalibration() {
  if (!state.engineConnected) {
    setStatus(elements.calibrationStatus, "error", "Connect the local engine before starting calibration.");
    return;
  }

  state.calibrationInProgress = true;
  updateActionButtons();
  setStatus(elements.calibrationStatus, null, "Starting calibration...");

  try {
    sendEngineMessage("calibration.start", {
      mode: "latency-check",
      expectedBeats: 4
    });
  } catch (error) {
    state.calibrationInProgress = false;
    updateActionButtons();
    setStatus(elements.calibrationStatus, "error", error.message);
  }
}

async function createSession() {
  if (!state.selectedTrainingId) {
    setStatus(elements.sessionStatus, "error", "Select a training first.");
    return;
  }

  if (!state.engineConnected) {
    setStatus(elements.sessionStatus, "error", "Connect the local engine before starting a session.");
    return;
  }

  setStatus(elements.sessionStatus, null, "Creating session...");

  try {
    const selectedTraining = state.trainings.find((training) => training.id === state.selectedTrainingId);
    const inputMode = elements.inputMode.value;
    const inputFilePath = elements.inputFilePath.value.trim();
    const captureDurationMs = Number(elements.captureDurationMs.value);
    const sessionTempoBpm = Number(elements.sessionTempoBpm.value);
    const practiceScope = elements.practiceScope.value;
    const loopSectionId =
      practiceScope === "section-loop" ? elements.loopSectionId.value : "";
    const loopRepetitionCount =
      practiceScope === "section-loop" ? Number(elements.loopRepetitionCount.value) : 1;
    const loopTempoStepBpm =
      practiceScope === "section-loop" ? Number(elements.loopTempoStepBpm.value) : 0;

    if (Number.isNaN(sessionTempoBpm) || sessionTempoBpm < 40 || sessionTempoBpm > 240) {
      throw new Error("Session tempo must be between 40 and 240 BPM.");
    }

    if (practiceScope === "section-loop" && !loopSectionId) {
      throw new Error("Select a chart section before starting section-loop practice.");
    }

    if (practiceScope === "section-loop" && (Number.isNaN(loopRepetitionCount) || loopRepetitionCount < 1 || loopRepetitionCount > 6)) {
      throw new Error("Loop repetitions must be between 1 and 6.");
    }

    if (practiceScope === "section-loop" && (Number.isNaN(loopTempoStepBpm) || loopTempoStepBpm < 0 || loopTempoStepBpm > 16)) {
      throw new Error("Tempo step BPM must be between 0 and 16.");
    }

    if (inputMode === "native-capture") {
      await maybeAutoApplyCaptureRecommendation();
      await recordCaptureOverrideIfNeeded();
    }

    const effectiveInputMode = elements.inputMode.value;
    const captureProfile = elements.captureProfile.value;
    const selectedNativeDevice = getSelectedNativeDevice();
    const recoveryRouteContext = getPendingRecoveryRouteContext();
    const returnAttemptContext = getPendingReturnAttemptContext();
    const promotionLandingContext = getPendingPromotionLandingContext();
    const technicalFallbackRecommendation =
      effectiveInputMode === "native-capture"
        ? getVerificationHoldTechnicalFallbackRecommendation()
        : null;

    if (effectiveInputMode === "native-capture") {
      await ensureNativePreflight();
    }

    const payload = await request("/sessions", {
      method: "POST",
      body: JSON.stringify({
        userId: getActiveUserId(),
        trainingId: state.selectedTrainingId,
        calibrationOffsetMs: Number(elements.calibrationOffset.value),
        tempoBpm: sessionTempoBpm,
        practiceScope,
        ...(practiceScope === "section-loop"
          ? {
              loopSectionId,
              loopRepetitionCount,
              loopTempoStepBpm
            }
          : {}),
        inputMode: effectiveInputMode,
        captureDurationMs,
        captureProfile,
        inputDeviceBackend: selectedNativeDevice.backend,
        inputDeviceId: selectedNativeDevice.deviceId,
        inputDeviceNumber: selectedNativeDevice.deviceNumber,
        ...(recoveryRouteContext ?? {}),
        ...(returnAttemptContext ?? {}),
        ...(promotionLandingContext ?? {}),
        ...(effectiveInputMode === "wav-file" ? { inputFilePath } : {})
      })
    });

    state.activeSessionId = payload.data.session.id;
    state.activeInputMode = payload.data.session.inputMode;
    updateActionButtons();
    resetEventLog();
    if (payload.data.session.inputMode === "native-capture") {
      try {
        await maybeTrackVerificationHoldSetupRecommendationUsage({
          recommendation: technicalFallbackRecommendation,
          session: payload.data.session,
          selectedNativeDevice
        });
      } catch (error) {
        pushEventLog(
          "Technical follow-up",
          `Could not track verification-hold follow-up for session ${payload.data.session.id}: ${error.message}`
        );
      }
    }
    resetSessionDiagnostics({
      sessionId: payload.data.session.id,
      inputMode: payload.data.session.inputMode,
      capture: payload.data.session.inputMode === "native-capture"
        ? {
            source: "native-capture",
            requestedProfile: payload.data.session.captureProfile,
            requestedBackend: payload.data.session.inputDeviceBackend,
            startAttemptCount: 1
          }
        : {
            source: payload.data.session.inputMode
          }
    });

    sendEngineMessage(
      "session.start",
      {
        trainingId: payload.data.training.id,
        exerciseId: payload.data.session.exerciseId,
        tuning: selectedTraining?.tuning ?? "standard",
        tempoBpm: sessionTempoBpm,
        practiceScope,
        ...(practiceScope === "section-loop"
          ? {
              loopSectionId,
              loopRepetitionCount,
              loopTempoStepBpm
            }
          : {}),
        calibrationOffsetMs: payload.data.session.calibrationOffsetMs,
        inputMode: payload.data.session.inputMode,
        captureDurationMs: payload.data.session.captureDurationMs,
        captureProfile: payload.data.session.captureProfile,
        inputDeviceBackend: payload.data.session.inputDeviceBackend,
        inputDeviceId: payload.data.session.inputDeviceId,
        inputDeviceNumber: payload.data.session.inputDeviceNumber,
        ...(payload.data.session.inputFilePath ? { inputFilePath: payload.data.session.inputFilePath } : {})
      },
      {
        sessionId: payload.data.session.id
      }
    );

    if (payload.data.session.inputMode === "live-stream") {
      await startLiveCapture();
      pushEventLog("Live input", "Microphone stream started and forwarded to engine.");
    }

    setStatus(
      elements.sessionStatus,
      "success",
      `Session ${state.activeSessionId} created for ${payload.data.training.title} and sent to engine.`
        + (practiceScope === "section-loop"
          ? ` Looping section ${loopSectionId} at ${sessionTempoBpm} BPM for ${loopRepetitionCount} rep(s)${loopTempoStepBpm > 0 ? ` with +${loopTempoStepBpm} BPM per rep` : ""}.`
          : ` Whole chart at ${sessionTempoBpm} BPM.`)
    );
    setStatus(elements.summaryStatus, null, "Engine is running the session. Waiting for score events.");
  } catch (error) {
    await stopLiveCapture(false);
    state.activeSessionId = null;
    state.activeInputMode = null;
    updateActionButtons();
    setStatus(elements.sessionStatus, "error", error.message);
  }
}

async function stopLiveSession() {
  if (!state.activeSessionId || state.activeInputMode !== "live-stream") {
    setStatus(elements.sessionStatus, "error", "No live-stream session is active.");
    return;
  }

  setStatus(elements.sessionStatus, null, "Stopping live-stream session...");
  await stopLiveCapture(true);
}

elements.checkHealthButton.addEventListener("click", checkHealth);
elements.loadTrainingsButton.addEventListener("click", loadTrainings);
elements.loadDashboardButton.addEventListener("click", loadDashboard);
elements.applyDiagnosticsFiltersButton.addEventListener("click", () => {
  void loadDashboard();
});
elements.clearDiagnosticsFiltersButton.addEventListener("click", () => {
  clearDiagnosticsFilters();
  void loadDashboard();
});
elements.exportDiagnosticsJsonButton.addEventListener("click", () => {
  void exportDiagnosticsReport("json").catch((error) => {
    setStatus(elements.diagnosticsExportStatus, "error", error.message);
  });
});
elements.exportDiagnosticsCsvButton.addEventListener("click", () => {
  void exportDiagnosticsReport("csv").catch((error) => {
    setStatus(elements.diagnosticsExportStatus, "error", error.message);
  });
});
elements.loadDeviceDiagnosticsButton.addEventListener("click", () => {
  void loadSelectedDeviceDiagnostics();
});
elements.connectEngineButton.addEventListener("click", connectEngine);
elements.loadNativeDevicesButton.addEventListener("click", loadNativeDevices);
elements.disconnectEngineButton.addEventListener("click", disconnectEngine);
elements.startCalibrationButton.addEventListener("click", startCalibration);
elements.applyPracticePresetButton.addEventListener("click", applyDashboardPracticePreset);
elements.applyCaptureRecommendationButton.addEventListener("click", applyCaptureRecommendation);
elements.runNativePreflightButton.addEventListener("click", runNativePreflight);
elements.createSessionButton.addEventListener("click", createSession);
elements.selectUnlockedTrainingButton.addEventListener("click", selectLatestUnlockedTraining);
elements.startUnlockedTrainingButton.addEventListener("click", () => {
  void startLatestUnlockedTraining();
});
elements.progressionNextActionButton.addEventListener("click", () => {
  void runProgressionNextAction();
});
elements.progressionCheckpointFilter.addEventListener("change", () => {
  state.progressionCheckpointFilter = elements.progressionCheckpointFilter.value;
  renderCheckpointHistorySnapshots();
  renderCheckpointHistoryDetail();
});
elements.checkpointPathSummaryCards.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-checkpoint-path-action='run']");

  if (actionButton) {
    const pathType = actionButton.dataset.checkpointPathType ?? "all";
    activateCheckpointPath(pathType);
      void (async () => {
        const actionResult = await runProgressionNextAction();
        state.checkpointPathActionFeedback = buildCheckpointPathActionFeedback({
          pathType,
          actionResult
        });
        state.checkpointPathHandoff = buildCheckpointPathHandoff({
          pathType,
          actionResult
        });
        state.checkpointPathCollapse = {
          active: Boolean(actionResult?.ok),
          focusPathType: actionResult?.ok ? pathType : state.checkpointPathCollapse.focusPathType
        };
        renderCheckpointPathSummaryCards();
        renderCheckpointPathHandoffStatus();
        focusCheckpointPathHandoff(actionResult);
      })();
      return;
    }

  const confidenceEntry = event.target.closest("[data-checkpoint-confidence-session-id]");

  if (confidenceEntry) {
    activateCheckpointConfidenceEntry(
      confidenceEntry.dataset.checkpointConfidencePathType ?? "all",
      confidenceEntry.dataset.checkpointConfidenceSessionId ?? null
    );
    return;
  }

  const summaryCard = event.target.closest("[data-checkpoint-path-type]");

  if (!summaryCard) {
    return;
  }

  activateCheckpointPath(summaryCard.dataset.checkpointPathType ?? "all");
});
elements.checkpointPathCollapseToggle.addEventListener("click", () => {
  state.checkpointPathCollapse = {
    active: false,
    focusPathType: null
  };
  renderCheckpointPathSummaryCards();
});
elements.progressionCheckpointHistory.addEventListener("click", (event) => {
  const checkpointEntry = event.target.closest("[data-checkpoint-session-id]");

  if (!checkpointEntry) {
    return;
  }

  state.selectedCheckpointSnapshotSessionId = checkpointEntry.dataset.checkpointSessionId ?? null;
  renderCheckpointHistorySnapshots();
  renderCheckpointHistoryDetail();
});
elements.autoApplyCaptureRecommendation.addEventListener("change", () => {
  renderSessionCaptureRecommendation();
  void saveCapturePreferences().catch((error) => {
    setStatus(elements.captureRecommendationStatus, "error", `Could not save capture preference: ${error.message}`);
  });
});
elements.inputMode.addEventListener("change", () => {
  renderSessionCaptureRecommendation();
  if (elements.inputMode.value === "native-capture" && state.nativeDevices.length > 0) {
    void refreshSessionCaptureRecommendation({ force: true });
  }
});
elements.practiceScope.addEventListener("change", () => {
  syncPracticePresetControls({ preserveTempo: true });
});
elements.loopRepetitionCount.addEventListener("input", () => {
  const currentValue = Number(elements.loopRepetitionCount.value);
  if (!Number.isNaN(currentValue)) {
    elements.loopRepetitionCount.value = String(Math.max(1, Math.min(6, currentValue)));
  }
});
elements.loopTempoStepBpm.addEventListener("input", () => {
  const currentValue = Number(elements.loopTempoStepBpm.value);
  if (!Number.isNaN(currentValue)) {
    elements.loopTempoStepBpm.value = String(Math.max(0, Math.min(16, currentValue)));
  }
});
elements.nativeBackend.addEventListener("change", handleNativeBackendChange);
elements.captureProfile.addEventListener("change", () => {
  invalidateNativePreflight("Native preflight needs rerun after changing the capture profile.");
  renderSessionCaptureRecommendation();
});
elements.captureDurationMs.addEventListener("input", () => {
  invalidateNativePreflight("Native preflight needs rerun after changing capture duration.");
});
elements.inputDeviceNumber.addEventListener("change", () => {
  invalidateNativePreflight("Native preflight needs rerun after selecting another native device.");
  renderSessionCaptureRecommendation();
  void refreshSessionCaptureRecommendation({ force: true });
});
elements.userId.addEventListener("change", () => {
  void refreshSessionCaptureRecommendation({ force: true });
});
elements.stopLiveSessionButton.addEventListener("click", () => {
  void stopLiveSession();
});

elements.gameplayStop.addEventListener("click", () => {
  closeGameplayOverlay();
  void stopLiveSession();
});
elements.gameplayResultsContinue.addEventListener("click", () => {
  closeGameplayOverlay();
});

elements.authFormLogin.addEventListener("submit", (e) => void handleLogin(e));
elements.authFormRegister.addEventListener("submit", (e) => void handleRegister(e));
elements.authTabLogin.addEventListener("click", () => switchAuthTab("login"));
elements.authTabRegister.addEventListener("click", () => switchAuthTab("register"));
elements.logoutButton.addEventListener("click", handleLogout);

elements.onboardingNext1.addEventListener("click", () => setOnboardingStep(2));
elements.onboardingNext2.addEventListener("click", () => setOnboardingStep(3));
elements.onboardingSkipEngine.addEventListener("click", () => setOnboardingStep(3));
elements.onboardingFinish.addEventListener("click", () => {
  markOnboardingComplete(state.auth.userId);
  hideOnboardingOverlay();
});

resetEventLog();
renderNativeBackends();
renderNativeDevices();
renderDashboard();
renderDiagnosticsReport();
renderDeviceDiagnosticsDetail();
renderTrainings();
renderSessionDiagnostics();
renderSessionCompletionRecap();
renderCheckpointRecapCards();
renderCheckpointPathSummaryCards();
renderCheckpointPathHandoffStatus();
renderCheckpointHistorySnapshots();
renderCheckpointHistoryDetail();
renderProgressionTimeline();
renderUnlockCelebration();
renderSessionCaptureRecommendation();
syncPracticePresetControls();

void initAuth();
