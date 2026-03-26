export const PROTOCOL_VERSION = 1;

export type CaptureMetadata = {
  source: "synthetic" | "wav-file" | "live-stream" | "native-capture";
  profile?: "safe" | "balanced" | "low-latency";
  requestedProfile?: "safe" | "balanced" | "low-latency";
  backend?: "wavein" | "wasapi";
  requestedBackend?: "wavein" | "wasapi";
  deviceId?: string;
  deviceName?: string;
  deviceNumber?: number;
  sampleRate?: number;
  chunkCount?: number;
  durationMs?: number;
  bufferMs?: number;
  numberOfBuffers?: number;
  useEventSync?: boolean;
  fallbackApplied?: boolean;
  fallbackReason?: string;
  startAttemptCount?: number;
  maxChunkGapMs?: number;
  lowSignalEventCount?: number;
  lowSignalChunkCount?: number;
};

export type Envelope<Type extends string, Payload> = {
  type: Type;
  protocolVersion: number;
  sessionId: string | null;
  timestamp: string;
  requestId?: string;
  payload: Payload;
};

export type EngineInitMessage = Envelope<
  "engine.init",
  {
    minVersion: number;
    maxVersion: number;
    clientName: "web";
  }
>;

export type EngineReadyMessage = Envelope<
  "engine.ready",
  {
    engineVersion: string;
    capabilities: {
      audio: boolean;
      scoring: boolean;
      calibration: boolean;
    };
  }
>;

export type HeartbeatMessage = Envelope<
  "engine.heartbeat",
  {
    uptimeMs: number;
    audioDeviceConnected: boolean;
  }
>;

export type CalibrationStartMessage = Envelope<
  "calibration.start",
  {
    mode: "latency-check";
    expectedBeats: number;
  }
>;

export type CalibrationStartedMessage = Envelope<
  "calibration.started",
  {
    mode: "latency-check";
  }
>;

export type CalibrationProgressMessage = Envelope<
  "calibration.progress",
  {
    step: number;
    totalSteps: number;
    message: string;
  }
>;

export type CalibrationResultMessage = Envelope<
  "calibration.result",
  {
    recommendedOffsetMs: number;
    measuredLatencyMs: number;
    noiseFloorDb: number;
  }
>;

export type NativeDevicesRequestMessage = Envelope<
  "native.devices.request",
  {
    source: "capture";
  }
>;

export type NativePreflightRequestMessage = Envelope<
  "native.preflight.request",
  {
    captureDurationMs?: number;
    captureProfile?: "safe" | "balanced" | "low-latency";
    inputDeviceBackend?: "wavein" | "wasapi";
    inputDeviceId?: string;
    inputDeviceNumber?: number;
  }
>;

export type NativeDevicesResponseMessage = Envelope<
  "native.devices.response",
  {
    devices: Array<{
      backend: "wavein" | "wasapi";
      deviceId?: string;
      deviceNumber: number;
      name: string;
      isDefault?: boolean;
      inputKind?: "microphone" | "audio-interface";
      recommendedBackend?: "wavein" | "wasapi";
      recommendedProfile?: "safe" | "balanced" | "low-latency";
      isRecommendedPath?: boolean;
    }>;
  }
>;

export type NativePreflightResponseMessage = Envelope<
  "native.preflight.response",
  {
    ok: boolean;
    hasWarnings: boolean;
    requested: {
      captureProfile: "safe" | "balanced" | "low-latency";
      backend: "wavein" | "wasapi";
    };
    selectedDevice: {
      backend: "wavein" | "wasapi";
      deviceId?: string;
      deviceNumber: number;
      name: string;
      inputKind?: "microphone" | "audio-interface";
      recommendedBackend?: "wavein" | "wasapi";
      recommendedProfile?: "safe" | "balanced" | "low-latency";
      isRecommendedPath?: boolean;
    } | null;
    resolved: {
      captureProfile: "safe" | "balanced" | "low-latency";
      backend: "wavein" | "wasapi";
      bufferMs: number;
      numberOfBuffers: number;
      useEventSync: boolean;
      sampleRate: number;
      captureDurationMs: number;
    };
    fallbackApplied: boolean;
    fallbackReason?: string | null;
    attempts: Array<{
      backend: "wavein" | "wasapi";
      captureProfile: "safe" | "balanced" | "low-latency";
      deviceName?: string;
      ok: boolean;
      failureReason?: string;
    }>;
    warnings: string[];
  }
>;

export type SessionStartMessage = Envelope<
  "session.start",
  {
    trainingId: string;
    exerciseId: string;
    tuning: "standard";
    tempoBpm?: number;
    practiceScope?: "full-chart" | "section-loop";
    loopSectionId?: string;
    loopRepetitionCount?: number;
    loopTempoStepBpm?: number;
    calibrationOffsetMs: number;
    inputMode?: "synthetic" | "wav-file" | "live-stream" | "native-capture";
    inputFilePath?: string;
    captureDurationMs?: number;
    captureProfile?: "safe" | "balanced" | "low-latency";
    inputDeviceBackend?: "wavein" | "wasapi";
    inputDeviceId?: string;
    inputDeviceNumber?: number;
  }
>;

export type SessionStartedMessage = Envelope<
  "session.started",
  {
    trainingId: string;
    exerciseId: string;
    practiceScope: "full-chart" | "section-loop";
    loopSectionId?: string;
    loopRepetitionCount?: number;
    loopTempoStepBpm?: number;
    tempoBpm?: number;
    calibrationOffsetMs: number;
    inputMode: "synthetic" | "wav-file" | "live-stream" | "native-capture";
  }
>;

export type SessionNoticeMessage = Envelope<
  "session.notice",
  {
    code:
      | "NATIVE_CAPTURE_PREFLIGHT_FALLBACK"
      | "NATIVE_CAPTURE_RUNTIME_RETRY"
      | "NATIVE_CAPTURE_CHUNK_GAP"
      | "NATIVE_CAPTURE_LOW_SIGNAL"
      | "SECTION_LOOP_REPETITION_PASSED"
      | "SECTION_LOOP_REPETITION_FAILED"
      | "SECTION_LOOP_ADAPTIVE_STOP";
    level: "info" | "warning";
    message: string;
    capture?: {
      requestedProfile?: "safe" | "balanced" | "low-latency";
      requestedBackend?: "wavein" | "wasapi";
      profile?: "safe" | "balanced" | "low-latency";
      backend?: "wavein" | "wasapi";
      deviceName?: string;
      sampleRate?: number;
      bufferMs?: number;
      numberOfBuffers?: number;
      useEventSync?: boolean;
      startAttemptCount?: number;
    };
  }
>;

export type AudioStreamChunkMessage = Envelope<
  "audio.stream.chunk",
  {
    sampleRate: number;
    channelCount: 1;
    encoding: "pcm16-base64";
    chunkBase64: string;
  }
>;

export type SessionStopMessage = Envelope<
  "session.stop",
  {
    reason: "user-stop" | "stream-ended";
  }
>;

export type ScoreEventMessage = Envelope<
  "score.event",
  {
    eventKind: "target-hit" | "ghost-note" | "missed-target";
    targetIndex: number;
    note: string;
    stringNumber?: number;
    expectedNote: string;
    expectedStringNumber: number;
    hit: boolean;
    noteHit: boolean;
    stringHit: boolean;
    timingHit: boolean;
    confidence: number;
    expectedTimeMs: number;
    timingWindowMs: number;
    expectedDurationMs: number;
    detectedDurationMs: number;
    holdCoverage: number;
    sustainHit: boolean;
    releasedEarly: boolean;
    releaseHit: boolean;
    overheld: boolean;
    releaseOvershootMs: number;
    fullComboHit: boolean;
    comboCount: number;
    comboMultiplier: number;
    comboBroken: boolean;
    timingClass: "early" | "on-time" | "late" | "out-of-window" | "missed";
    scheduledBeat: number;
    measureNumber: number;
    beatNumber: number;
    subdivision: number;
    repetitionIndex?: number;
    repetitionTempoBpm?: number;
    timingOffsetMs: number;
    scoreDelta: number;
  }
>;

export type SessionSummaryMessage = Envelope<
  "session.summary",
  {
    totalScore: number;
    accuracy: number;
    notesDetected: number;
    notesHit: number;
    scoreBreakdown?: {
      tempoBpm: number;
      targetCount: number;
      matchedTargetCount: number;
      unmatchedTargetCount: number;
      noteHits: number;
      stringHits: number;
      timingHits: number;
      fullHits: number;
      sustainHits: number;
      releaseHits: number;
      fullComboHits: number;
      earlyHitCount: number;
      lateHitCount: number;
      earlyReleaseCount: number;
      overholdCount: number;
      ghostNoteCount: number;
      missedTargetCount: number;
      maxCombo: number;
      comboBreakCount: number;
      multiplierPeak: number;
      misses: number;
      averageTimingOffsetMs: number;
      maxTimingOffsetMs: number;
      averageHoldCoverage: number;
      averageReleaseOvershootMs: number;
      maxReleaseOvershootMs: number;
    };
    sectionBreakdown?: Array<{
      sectionId: string;
      sectionLabel: string;
      targetCount: number;
      matchedTargetCount: number;
      fullComboHits: number;
      missedTargetCount: number;
      ghostNoteCount: number;
      earlyHitCount: number;
      lateHitCount: number;
      earlyReleaseCount: number;
      overholdCount: number;
      accuracy: number;
      averageTimingOffsetMs: number;
      averageHoldCoverage: number;
      averageReleaseOvershootMs: number;
      performanceScore: number;
    }>;
    practicePreset?: {
      scope: "full-chart" | "section-loop";
      tempoBpm: number;
      loopSectionId?: string;
      loopSectionLabel?: string;
      loopRepetitionCount?: number;
      loopTempoStepBpm?: number;
      repetitions?: Array<{
        repetitionIndex: number;
        tempoBpm: number;
        startTimeMs: number;
        durationMs: number;
        targetCount?: number;
        fullComboHits?: number;
        missedTargetCount?: number;
        ghostNoteCount?: number;
        accuracy?: number;
        performanceScore?: number;
        passed?: boolean;
        skipped?: boolean;
      }>;
      masteryGate?: {
        status: "ready-to-advance" | "keep-building" | "stabilize-base-tempo";
        passedRepetitionCount: number;
        totalRepetitionCount: number;
        highestPassedTempoBpm: number;
        recommendedNextTempoBpm: number;
        message: string;
      };
      adaptiveExecution?: {
        mode: "static" | "early-stop";
        triggered: boolean;
        completedRepetitionCount: number;
        plannedRepetitionCount: number;
        stoppedAfterRepetitionIndex?: number;
        stopReason?: string;
        retryPlan?: {
          strategy: "repeat-current-tempo" | "drop-tempo-step" | "rebuild-base-tempo";
          tempoBpm: number;
          loopRepetitionCount: number;
          loopTempoStepBpm: number;
          reason: string;
        };
      };
    };
    rating?: {
      grade: "S" | "A" | "B" | "C" | "D" | "F";
      label: string;
      clearType: "full-combo" | "clean-clear" | "clear" | "practice";
      performanceScore: number;
    };
    feedback?: {
      summary: string;
      focusAreas: string[];
      coachHints: Array<{
        id: string;
        title: string;
        detail: string;
        severity: "high" | "medium" | "low";
      }>;
    };
    verification?: {
      status: "verified" | "warning";
      mechanicallyComplete: boolean;
      targetCoverage: number;
      checks: {
        hasScoreBreakdown: boolean;
        hasSectionBreakdown: boolean;
        hasPracticeRepetitions: boolean;
        targetAccountingMatches: boolean;
        hitAccountingMatches: boolean;
        sectionAccountingMatches: boolean;
        repetitionAccountingMatches: boolean;
        hasCapture: boolean;
        hasDiagnostics: boolean;
        hasArtifact: boolean;
      };
      issues: string[];
    };
    capture?: CaptureMetadata;
    artifact?: {
      type: "wav-file";
      filePath: string;
    };
  }
>;

export type ErrorMessage = Envelope<
  "engine.error",
  {
    code:
      | "UNSUPPORTED_PROTOCOL"
      | "AUDIO_DEVICE_NOT_FOUND"
      | "AUDIO_PERMISSION_DENIED"
      | "SESSION_NOT_ACTIVE"
      | "INTERNAL_ERROR";
    message: string;
    retryable: boolean;
  }
>;

export type ProtocolMessage =
  | EngineInitMessage
  | EngineReadyMessage
  | HeartbeatMessage
  | CalibrationStartMessage
  | CalibrationStartedMessage
  | CalibrationProgressMessage
  | CalibrationResultMessage
  | NativeDevicesRequestMessage
  | NativePreflightRequestMessage
  | NativeDevicesResponseMessage
  | NativePreflightResponseMessage
  | SessionStartMessage
  | SessionStartedMessage
  | SessionNoticeMessage
  | AudioStreamChunkMessage
  | SessionStopMessage
  | ScoreEventMessage
  | SessionSummaryMessage
  | ErrorMessage;
