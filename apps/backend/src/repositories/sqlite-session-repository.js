function cloneSummary(summary) {
  return summary ? structuredClone(summary) : null;
}

function cloneSession(session) {
  return {
    ...session,
    summary: cloneSummary(session.summary)
  };
}

function stringifyJson(value) {
  return value ? JSON.stringify(value) : null;
}

function parseJson(value) {
  return value ? JSON.parse(value) : null;
}

export class SqliteSessionRepository {
  #database;

  constructor({ database }) {
    this.#database = database;
  }

  #createDiagnosticsWhereClause(filters = {}, options = {}) {
    const alias = options.alias ?? "diagnostic_sessions";
    const conditions = [`${alias}.user_id = ?`, `${alias}.status = 'completed'`];
    const parameters = [options.userId];

    if (filters.deviceNameExact) {
      conditions.push(`LOWER(${alias}.device_name) = ?`);
      parameters.push(filters.deviceNameExact);
    } else if (filters.deviceName) {
      conditions.push(`LOWER(${alias}.device_name) LIKE ?`);
      parameters.push(`%${filters.deviceName}%`);
    }

    if (filters.backend) {
      conditions.push(`LOWER(${alias}.backend) = ?`);
      parameters.push(filters.backend);
    }

    if (filters.profile) {
      conditions.push(`LOWER(${alias}.profile) = ?`);
      parameters.push(filters.profile);
    }

    return {
      whereClause: conditions.join(" AND "),
      parameters
    };
  }

  #getDiagnosticsBaseCte() {
    return `
      WITH notice_aggregates AS (
        SELECT
          session_id,
          SUM(CASE WHEN level = 'warning' THEN 1 ELSE 0 END) AS warning_notice_count,
          MAX(CASE WHEN level = 'warning' THEN 1 ELSE 0 END) AS has_warning,
          SUM(CASE WHEN code = 'NATIVE_CAPTURE_RUNTIME_RETRY' THEN 1 ELSE 0 END) AS runtime_retry_count,
          MAX(CASE WHEN code = 'NATIVE_CAPTURE_RUNTIME_RETRY' THEN 1 ELSE 0 END) AS has_runtime_retry
        FROM session_notice_events
        GROUP BY session_id
      ),
      diagnostic_sessions AS (
        SELECT
          s.id,
          s.user_id,
          s.training_id,
          s.status,
          s.completed_at,
          s.summary_json,
          COALESCE(cs.source, json_extract(s.summary_json, '$.capture.source')) AS source,
          COALESCE(cs.profile, json_extract(s.summary_json, '$.capture.profile')) AS profile,
          COALESCE(cs.requested_profile, json_extract(s.summary_json, '$.capture.requestedProfile')) AS requested_profile,
          COALESCE(cs.backend, json_extract(s.summary_json, '$.capture.backend')) AS backend,
          COALESCE(cs.requested_backend, json_extract(s.summary_json, '$.capture.requestedBackend')) AS requested_backend,
          COALESCE(cs.device_id, json_extract(s.summary_json, '$.capture.deviceId')) AS device_id,
          COALESCE(cs.device_name, json_extract(s.summary_json, '$.capture.deviceName')) AS device_name,
          COALESCE(cs.device_number, json_extract(s.summary_json, '$.capture.deviceNumber')) AS device_number,
          COALESCE(cs.sample_rate, json_extract(s.summary_json, '$.capture.sampleRate')) AS sample_rate,
          COALESCE(cs.chunk_count, json_extract(s.summary_json, '$.capture.chunkCount')) AS chunk_count,
          COALESCE(cs.duration_ms, json_extract(s.summary_json, '$.capture.durationMs')) AS duration_ms,
          COALESCE(cs.buffer_ms, json_extract(s.summary_json, '$.capture.bufferMs')) AS buffer_ms,
          COALESCE(cs.number_of_buffers, json_extract(s.summary_json, '$.capture.numberOfBuffers')) AS number_of_buffers,
          COALESCE(cs.start_attempt_count, json_extract(s.summary_json, '$.capture.startAttemptCount'), 1) AS start_attempt_count,
          COALESCE(cs.max_chunk_gap_ms, json_extract(s.summary_json, '$.capture.maxChunkGapMs')) AS max_chunk_gap_ms,
          COALESCE(cs.low_signal_event_count, json_extract(s.summary_json, '$.capture.lowSignalEventCount')) AS low_signal_event_count,
          COALESCE(cs.low_signal_chunk_count, json_extract(s.summary_json, '$.capture.lowSignalChunkCount')) AS low_signal_chunk_count,
          COALESCE(cs.use_event_sync, json_extract(s.summary_json, '$.capture.useEventSync')) AS use_event_sync,
          COALESCE(cs.fallback_applied, json_extract(s.summary_json, '$.capture.fallbackApplied'), 0) AS fallback_applied,
          COALESCE(cs.fallback_reason, json_extract(s.summary_json, '$.capture.fallbackReason')) AS fallback_reason,
          COALESCE(na.warning_notice_count, 0) AS warning_notice_count,
          COALESCE(na.has_warning, 0) AS has_warning,
          COALESCE(na.runtime_retry_count, 0) AS runtime_retry_count,
          COALESCE(na.has_runtime_retry, 0) AS has_runtime_retry
        FROM sessions s
        LEFT JOIN session_capture_snapshots cs
          ON cs.session_id = s.id
        LEFT JOIN notice_aggregates na
          ON na.session_id = s.id
      )
    `;
  }

  #mapDiagnosticsCapture(row) {
    if (!row.backend && !row.profile && !row.device_name && !row.device_id) {
      return null;
    }

    return {
      ...(row.source ? { source: row.source } : {}),
      ...(row.profile ? { profile: row.profile } : {}),
      ...(row.requested_profile ? { requestedProfile: row.requested_profile } : {}),
      ...(row.backend ? { backend: row.backend } : {}),
      ...(row.requested_backend ? { requestedBackend: row.requested_backend } : {}),
      ...(row.device_id ? { deviceId: row.device_id } : {}),
      ...(row.device_name ? { deviceName: row.device_name } : {}),
      ...(row.device_number !== null && row.device_number !== undefined ? { deviceNumber: row.device_number } : {}),
      ...(row.sample_rate !== null && row.sample_rate !== undefined ? { sampleRate: row.sample_rate } : {}),
      ...(row.chunk_count !== null && row.chunk_count !== undefined ? { chunkCount: row.chunk_count } : {}),
      ...(row.duration_ms !== null && row.duration_ms !== undefined ? { durationMs: row.duration_ms } : {}),
      ...(row.buffer_ms !== null && row.buffer_ms !== undefined ? { bufferMs: row.buffer_ms } : {}),
      ...(row.number_of_buffers !== null && row.number_of_buffers !== undefined
        ? { numberOfBuffers: row.number_of_buffers }
        : {}),
      ...(row.start_attempt_count !== null && row.start_attempt_count !== undefined
        ? { startAttemptCount: row.start_attempt_count }
        : {}),
      ...(row.max_chunk_gap_ms !== null && row.max_chunk_gap_ms !== undefined
        ? { maxChunkGapMs: row.max_chunk_gap_ms }
        : {}),
      ...(row.low_signal_event_count !== null && row.low_signal_event_count !== undefined
        ? { lowSignalEventCount: row.low_signal_event_count }
        : {}),
      ...(row.low_signal_chunk_count !== null && row.low_signal_chunk_count !== undefined
        ? { lowSignalChunkCount: row.low_signal_chunk_count }
        : {}),
      ...(row.use_event_sync !== null && row.use_event_sync !== undefined
        ? { useEventSync: Boolean(row.use_event_sync) }
        : {}),
      ...(row.fallback_applied !== null && row.fallback_applied !== undefined
        ? { fallbackApplied: Boolean(row.fallback_applied) }
        : {}),
      ...(row.fallback_reason ? { fallbackReason: row.fallback_reason } : {})
    };
  }

  #loadNoticeEventsBySessionIds(sessionIds) {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const placeholders = sessionIds.map(() => "?").join(", ");
    const rows = this.#database.prepare(`
      SELECT session_id, code, level, message, timestamp, capture_json
      FROM session_notice_events
      WHERE session_id IN (${placeholders})
      ORDER BY timestamp ASC, id ASC
    `).all(...sessionIds);
    const noticesBySessionId = new Map();

    for (const row of rows) {
      const currentNotices = noticesBySessionId.get(row.session_id) ?? [];
      currentNotices.push({
        code: row.code,
        level: row.level,
        message: row.message,
        timestamp: row.timestamp,
        ...(row.capture_json ? { capture: JSON.parse(row.capture_json) } : {})
      });
      noticesBySessionId.set(row.session_id, currentNotices);
    }

    return noticesBySessionId;
  }

  #loadCaptureSnapshot(sessionId) {
    const row = this.#database.prepare(`
      SELECT
        source,
        profile,
        requested_profile,
        backend,
        requested_backend,
        device_id,
        device_name,
        device_number,
        sample_rate,
        chunk_count,
        duration_ms,
        buffer_ms,
        number_of_buffers,
        start_attempt_count,
        max_chunk_gap_ms,
        low_signal_event_count,
        low_signal_chunk_count,
        use_event_sync,
        fallback_applied,
        fallback_reason
      FROM session_capture_snapshots
      WHERE session_id = ?
    `).get(sessionId);

    if (!row) {
      return null;
    }

    return {
      ...(row.source ? { source: row.source } : {}),
      ...(row.profile ? { profile: row.profile } : {}),
      ...(row.requested_profile ? { requestedProfile: row.requested_profile } : {}),
      ...(row.backend ? { backend: row.backend } : {}),
      ...(row.requested_backend ? { requestedBackend: row.requested_backend } : {}),
      ...(row.device_id ? { deviceId: row.device_id } : {}),
      ...(row.device_name ? { deviceName: row.device_name } : {}),
      ...(row.device_number !== null ? { deviceNumber: row.device_number } : {}),
      ...(row.sample_rate !== null ? { sampleRate: row.sample_rate } : {}),
      ...(row.chunk_count !== null ? { chunkCount: row.chunk_count } : {}),
      ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
      ...(row.buffer_ms !== null ? { bufferMs: row.buffer_ms } : {}),
      ...(row.number_of_buffers !== null ? { numberOfBuffers: row.number_of_buffers } : {}),
      ...(row.start_attempt_count !== null ? { startAttemptCount: row.start_attempt_count } : {}),
      ...(row.max_chunk_gap_ms !== null ? { maxChunkGapMs: row.max_chunk_gap_ms } : {}),
      ...(row.low_signal_event_count !== null ? { lowSignalEventCount: row.low_signal_event_count } : {}),
      ...(row.low_signal_chunk_count !== null ? { lowSignalChunkCount: row.low_signal_chunk_count } : {}),
      ...(row.use_event_sync !== null ? { useEventSync: Boolean(row.use_event_sync) } : {}),
      ...(row.fallback_applied !== null ? { fallbackApplied: Boolean(row.fallback_applied) } : {}),
      ...(row.fallback_reason ? { fallbackReason: row.fallback_reason } : {})
    };
  }

  #loadNoticeEvents(sessionId) {
    const rows = this.#database.prepare(`
      SELECT code, level, message, timestamp, capture_json
      FROM session_notice_events
      WHERE session_id = ?
      ORDER BY timestamp ASC, id ASC
    `).all(sessionId);

    return rows.map((row) => ({
      code: row.code,
      level: row.level,
      message: row.message,
      timestamp: row.timestamp,
      ...(row.capture_json ? { capture: JSON.parse(row.capture_json) } : {})
    }));
  }

  #buildDiagnosticsSummary(row, { captureSnapshot = null, noticeEvents = [] } = {}) {
    const parsedSummary = parseJson(row.summary_json);
    const fallbackCapture = parsedSummary?.capture ?? null;
    const fallbackNotices = parsedSummary?.diagnostics?.notices ?? [];
    const capture = captureSnapshot ?? fallbackCapture;
    const notices = noticeEvents.length > 0 ? noticeEvents : fallbackNotices;

    return {
      id: row.id,
      userId: row.user_id,
      trainingId: row.training_id,
      completedAt: row.completed_at,
      summary: {
        ...(capture ? { capture } : {}),
        diagnostics: {
          ...(capture ? { currentCapture: capture } : {}),
          notices
        }
      }
    };
  }

  #hydrateSummary(session) {
    if (!session?.summary) {
      return session;
    }

    const captureSnapshot = this.#loadCaptureSnapshot(session.id);
    const noticeEvents = this.#loadNoticeEvents(session.id);
    const nextSummary = {
      ...session.summary
    };

    if (captureSnapshot) {
      nextSummary.capture = captureSnapshot;
    }

    if (captureSnapshot || noticeEvents.length > 0) {
      nextSummary.diagnostics = {
        ...(session.summary.diagnostics ?? {}),
        ...(captureSnapshot ? { currentCapture: captureSnapshot } : {}),
        ...(noticeEvents.length > 0 ? { notices: noticeEvents } : {})
      };
    }

    return {
      ...session,
      summary: nextSummary
    };
  }

  #replaceCaptureSnapshot(sessionId, capture) {
    this.#database.prepare(`
      DELETE FROM session_capture_snapshots
      WHERE session_id = ?
    `).run(sessionId);

    if (!capture) {
      return;
    }

    this.#database.prepare(`
      INSERT INTO session_capture_snapshots (
        session_id,
        source,
        profile,
        requested_profile,
        backend,
        requested_backend,
        device_id,
        device_name,
        device_number,
        sample_rate,
        chunk_count,
        duration_ms,
        buffer_ms,
        number_of_buffers,
        start_attempt_count,
        max_chunk_gap_ms,
        low_signal_event_count,
        low_signal_chunk_count,
        use_event_sync,
        fallback_applied,
        fallback_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      capture.source ?? null,
      capture.profile ?? null,
      capture.requestedProfile ?? null,
      capture.backend ?? null,
      capture.requestedBackend ?? null,
      capture.deviceId ?? null,
      capture.deviceName ?? null,
      capture.deviceNumber ?? null,
      capture.sampleRate ?? null,
      capture.chunkCount ?? null,
      capture.durationMs ?? null,
      capture.bufferMs ?? null,
      capture.numberOfBuffers ?? null,
      capture.startAttemptCount ?? null,
      capture.maxChunkGapMs ?? null,
      capture.lowSignalEventCount ?? null,
      capture.lowSignalChunkCount ?? null,
      capture.useEventSync === undefined ? null : Number(capture.useEventSync),
      capture.fallbackApplied === undefined ? null : Number(capture.fallbackApplied),
      capture.fallbackReason ?? null
    );
  }

  #replaceNoticeEvents(sessionId, notices = []) {
    this.#database.prepare(`
      DELETE FROM session_notice_events
      WHERE session_id = ?
    `).run(sessionId);

    if (notices.length === 0) {
      return;
    }

    const insertStatement = this.#database.prepare(`
      INSERT INTO session_notice_events (
        session_id,
        code,
        level,
        message,
        timestamp,
        capture_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const notice of notices) {
      insertStatement.run(
        sessionId,
        notice.code,
        notice.level,
        notice.message,
        notice.timestamp,
        notice.capture ? stringifyJson(notice.capture) : null
      );
    }
  }

  #mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      trainingId: row.training_id,
      exerciseId: row.exercise_id,
      calibrationOffsetMs: row.calibration_offset_ms,
      tempoBpm: row.tempo_bpm,
      practiceScope: row.practice_scope,
      loopSectionId: row.loop_section_id,
      loopRepetitionCount: row.loop_repetition_count,
      loopTempoStepBpm: row.loop_tempo_step_bpm,
      inputMode: row.input_mode,
      inputFilePath: row.input_file_path,
      captureDurationMs: row.capture_duration_ms,
      captureProfile: row.capture_profile,
      inputDeviceBackend: row.input_device_backend,
      inputDeviceId: row.input_device_id,
      inputDeviceNumber: row.input_device_number,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      summary: parseJson(row.summary_json)
    };
  }

  create(session) {
    this.#database.prepare(`
      INSERT INTO sessions (
        id,
        user_id,
        training_id,
        exercise_id,
        calibration_offset_ms,
        tempo_bpm,
        practice_scope,
        loop_section_id,
        loop_repetition_count,
        loop_tempo_step_bpm,
        input_mode,
        input_file_path,
        capture_duration_ms,
        capture_profile,
        input_device_backend,
        input_device_id,
        input_device_number,
        status,
        created_at,
        completed_at,
        summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.userId,
      session.trainingId,
      session.exerciseId,
      session.calibrationOffsetMs,
      session.tempoBpm ?? null,
      session.practiceScope ?? null,
      session.loopSectionId ?? null,
      session.loopRepetitionCount ?? null,
      session.loopTempoStepBpm ?? null,
      session.inputMode,
      session.inputFilePath,
      session.captureDurationMs,
      session.captureProfile,
      session.inputDeviceBackend,
      session.inputDeviceId,
      session.inputDeviceNumber,
      session.status,
      session.createdAt,
      session.completedAt ?? null,
      stringifyJson(session.summary)
    );

    return cloneSession(session);
  }

  findById(sessionId) {
    const row = this.#database.prepare(`
      SELECT
        id,
        user_id,
        training_id,
        exercise_id,
        calibration_offset_ms,
        tempo_bpm,
        practice_scope,
        loop_section_id,
        loop_repetition_count,
        loop_tempo_step_bpm,
        input_mode,
        input_file_path,
        capture_duration_ms,
        capture_profile,
        input_device_backend,
        input_device_id,
        input_device_number,
        status,
        created_at,
        completed_at,
        summary_json
      FROM sessions
      WHERE id = ?
    `).get(sessionId);

    const session = this.#mapRow(row);
    return session ? cloneSession(this.#hydrateSummary(session)) : null;
  }

  updateSummary(sessionId, summary) {
    const current = this.findById(sessionId);

    if (!current) {
      return null;
    }

    const preservedPracticeRecoveryContext =
      current.summary?.practiceRecoveryContext
        ? structuredClone(current.summary.practiceRecoveryContext)
        : null;
    const preservedPracticeReturnContext =
      current.summary?.practiceReturnContext
        ? structuredClone(current.summary.practiceReturnContext)
        : null;
    const preservedPracticePromotionContext =
      current.summary?.practicePromotionContext
        ? structuredClone(current.summary.practicePromotionContext)
        : null;

    const updated = {
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      summary: cloneSummary({
        ...(summary ?? {}),
        ...(preservedPracticeRecoveryContext
          ? {
              practiceRecoveryContext: preservedPracticeRecoveryContext
            }
          : {}),
        ...(preservedPracticeReturnContext
          ? {
              practiceReturnContext: preservedPracticeReturnContext
            }
          : {}),
        ...(preservedPracticePromotionContext
          ? {
              practicePromotionContext: preservedPracticePromotionContext
            }
          : {})
      })
    };

    this.#database.exec("BEGIN");

    try {
      this.#database.prepare(`
        UPDATE sessions
        SET status = ?, completed_at = ?, summary_json = ?
        WHERE id = ?
      `).run(
        updated.status,
        updated.completedAt,
        stringifyJson(updated.summary),
        sessionId
      );
      this.#replaceCaptureSnapshot(sessionId, updated.summary?.capture ?? null);
      this.#replaceNoticeEvents(sessionId, updated.summary?.diagnostics?.notices ?? []);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }

    return cloneSession(this.#hydrateSummary(updated));
  }

  listCompletedByUser(userId) {
    const rows = this.#database.prepare(`
      SELECT
        id,
        user_id,
        training_id,
        exercise_id,
        calibration_offset_ms,
        tempo_bpm,
        practice_scope,
        loop_section_id,
        loop_repetition_count,
        loop_tempo_step_bpm,
        input_mode,
        input_file_path,
        capture_duration_ms,
        capture_profile,
        input_device_backend,
        input_device_id,
        input_device_number,
        status,
        created_at,
        completed_at,
        summary_json
      FROM sessions
      WHERE user_id = ? AND status = 'completed'
      ORDER BY completed_at DESC
    `).all(userId);

    return rows.map((row) => cloneSession(this.#hydrateSummary(this.#mapRow(row))));
  }

  listCompletedDiagnosticsByUser(userId) {
    const rows = this.#database.prepare(`
      SELECT
        s.id,
        s.user_id,
        s.training_id,
        s.completed_at,
        s.summary_json,
        cs.source,
        cs.profile,
        cs.requested_profile,
        cs.backend,
        cs.requested_backend,
        cs.device_id,
        cs.device_name,
        cs.device_number,
        cs.sample_rate,
        cs.chunk_count,
        cs.duration_ms,
        cs.buffer_ms,
        cs.number_of_buffers,
        cs.start_attempt_count,
        cs.max_chunk_gap_ms,
        cs.low_signal_event_count,
        cs.low_signal_chunk_count,
        cs.use_event_sync,
        cs.fallback_applied,
        cs.fallback_reason
      FROM sessions s
      LEFT JOIN session_capture_snapshots cs
        ON cs.session_id = s.id
      WHERE s.user_id = ? AND s.status = 'completed'
      ORDER BY s.completed_at DESC
    `).all(userId);

    if (rows.length === 0) {
      return [];
    }

    const noticeRows = this.#database.prepare(`
      SELECT
        session_id,
        code,
        level,
        message,
        timestamp,
        capture_json
      FROM session_notice_events
      WHERE session_id IN (
        SELECT id
        FROM sessions
        WHERE user_id = ? AND status = 'completed'
      )
      ORDER BY timestamp ASC, id ASC
    `).all(userId);

    const noticesBySessionId = new Map();

    for (const noticeRow of noticeRows) {
      const currentNotices = noticesBySessionId.get(noticeRow.session_id) ?? [];
      currentNotices.push({
        code: noticeRow.code,
        level: noticeRow.level,
        message: noticeRow.message,
        timestamp: noticeRow.timestamp,
        ...(noticeRow.capture_json ? { capture: JSON.parse(noticeRow.capture_json) } : {})
      });
      noticesBySessionId.set(noticeRow.session_id, currentNotices);
    }

    return rows.map((row) => {
      const captureSnapshot = row.backend
        ? {
            ...(row.source ? { source: row.source } : {}),
            ...(row.profile ? { profile: row.profile } : {}),
            ...(row.requested_profile ? { requestedProfile: row.requested_profile } : {}),
            ...(row.backend ? { backend: row.backend } : {}),
            ...(row.requested_backend ? { requestedBackend: row.requested_backend } : {}),
            ...(row.device_id ? { deviceId: row.device_id } : {}),
            ...(row.device_name ? { deviceName: row.device_name } : {}),
            ...(row.device_number !== null ? { deviceNumber: row.device_number } : {}),
            ...(row.sample_rate !== null ? { sampleRate: row.sample_rate } : {}),
            ...(row.chunk_count !== null ? { chunkCount: row.chunk_count } : {}),
            ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
            ...(row.buffer_ms !== null ? { bufferMs: row.buffer_ms } : {}),
            ...(row.number_of_buffers !== null ? { numberOfBuffers: row.number_of_buffers } : {}),
            ...(row.start_attempt_count !== null ? { startAttemptCount: row.start_attempt_count } : {}),
            ...(row.max_chunk_gap_ms !== null ? { maxChunkGapMs: row.max_chunk_gap_ms } : {}),
            ...(row.low_signal_event_count !== null ? { lowSignalEventCount: row.low_signal_event_count } : {}),
            ...(row.low_signal_chunk_count !== null ? { lowSignalChunkCount: row.low_signal_chunk_count } : {}),
            ...(row.use_event_sync !== null ? { useEventSync: Boolean(row.use_event_sync) } : {}),
            ...(row.fallback_applied !== null ? { fallbackApplied: Boolean(row.fallback_applied) } : {}),
            ...(row.fallback_reason ? { fallbackReason: row.fallback_reason } : {})
          }
        : null;

      return this.#buildDiagnosticsSummary(row, {
        captureSnapshot,
        noticeEvents: noticesBySessionId.get(row.id) ?? []
      });
    });
  }

  getDiagnosticsReportData(userId, filters = {}, options = {}) {
    const recentLimit = Number.isInteger(options.recentLimit) ? options.recentLimit : 10;
    const baseCte = this.#getDiagnosticsBaseCte();
    const { whereClause, parameters } = this.#createDiagnosticsWhereClause(filters, {
      alias: "diagnostic_sessions",
      userId
    });
    const groupedRows = this.#database.prepare(`
      ${baseCte}
      SELECT
        diagnostic_sessions.device_name,
        diagnostic_sessions.backend,
        diagnostic_sessions.profile,
        COUNT(*) AS session_count,
        SUM(CASE WHEN diagnostic_sessions.fallback_applied = 1 THEN 1 ELSE 0 END) AS fallback_count,
        SUM(CASE WHEN diagnostic_sessions.has_warning = 1 THEN 1 ELSE 0 END) AS sessions_with_warnings,
        SUM(CASE WHEN diagnostic_sessions.has_runtime_retry = 1 THEN 1 ELSE 0 END) AS sessions_with_runtime_retry,
        SUM(diagnostic_sessions.warning_notice_count) AS warning_notice_count,
        SUM(diagnostic_sessions.runtime_retry_count) AS runtime_retry_count,
        SUM(COALESCE(diagnostic_sessions.start_attempt_count, 1)) AS total_start_attempts,
        SUM(CASE WHEN diagnostic_sessions.sample_rate IS NOT NULL THEN diagnostic_sessions.sample_rate ELSE 0 END) AS total_sample_rate,
        SUM(CASE WHEN diagnostic_sessions.sample_rate IS NOT NULL THEN 1 ELSE 0 END) AS sample_rate_count,
        SUM(CASE WHEN diagnostic_sessions.buffer_ms IS NOT NULL THEN diagnostic_sessions.buffer_ms ELSE 0 END) AS total_buffer_ms,
        SUM(CASE WHEN diagnostic_sessions.buffer_ms IS NOT NULL THEN 1 ELSE 0 END) AS buffer_count,
        SUM(CASE WHEN diagnostic_sessions.number_of_buffers IS NOT NULL THEN diagnostic_sessions.number_of_buffers ELSE 0 END) AS total_number_of_buffers,
        SUM(CASE WHEN diagnostic_sessions.number_of_buffers IS NOT NULL THEN 1 ELSE 0 END) AS number_of_buffers_count,
        SUM(CASE WHEN diagnostic_sessions.max_chunk_gap_ms IS NOT NULL THEN diagnostic_sessions.max_chunk_gap_ms ELSE 0 END) AS total_max_chunk_gap_ms,
        SUM(CASE WHEN diagnostic_sessions.max_chunk_gap_ms IS NOT NULL THEN 1 ELSE 0 END) AS max_chunk_gap_count,
        SUM(COALESCE(diagnostic_sessions.low_signal_event_count, 0)) AS total_low_signal_event_count,
        SUM(COALESCE(diagnostic_sessions.low_signal_chunk_count, 0)) AS total_low_signal_chunk_count,
        MAX(diagnostic_sessions.completed_at) AS latest_completed_at
      FROM diagnostic_sessions
      WHERE ${whereClause}
      GROUP BY diagnostic_sessions.device_name, diagnostic_sessions.backend, diagnostic_sessions.profile
    `).all(...parameters);
    const summaryRow = this.#database.prepare(`
      ${baseCte}
      SELECT
        COUNT(*) AS session_count,
        SUM(CASE WHEN diagnostic_sessions.fallback_applied = 1 THEN 1 ELSE 0 END) AS sessions_with_fallback,
        SUM(COALESCE(diagnostic_sessions.start_attempt_count, 1)) AS total_start_attempts
      FROM diagnostic_sessions
      WHERE ${whereClause}
    `).get(...parameters);
    const recentRows = this.#database.prepare(`
      ${baseCte}
      SELECT
        diagnostic_sessions.id,
        diagnostic_sessions.training_id,
        diagnostic_sessions.completed_at,
        diagnostic_sessions.source,
        diagnostic_sessions.profile,
        diagnostic_sessions.requested_profile,
        diagnostic_sessions.backend,
        diagnostic_sessions.requested_backend,
        diagnostic_sessions.device_id,
        diagnostic_sessions.device_name,
        diagnostic_sessions.device_number,
        diagnostic_sessions.sample_rate,
        diagnostic_sessions.chunk_count,
        diagnostic_sessions.duration_ms,
        diagnostic_sessions.buffer_ms,
        diagnostic_sessions.number_of_buffers,
        diagnostic_sessions.start_attempt_count,
        diagnostic_sessions.use_event_sync,
        diagnostic_sessions.fallback_applied,
        diagnostic_sessions.fallback_reason
      FROM diagnostic_sessions
      WHERE ${whereClause}
      ORDER BY diagnostic_sessions.completed_at DESC
      LIMIT ?
    `).all(...parameters, recentLimit);
    const issueRows = this.#database.prepare(`
      ${baseCte}
      SELECT
        sne.code,
        sne.level,
        COUNT(*) AS event_count,
        COUNT(DISTINCT sne.session_id) AS affected_sessions,
        MAX(sne.timestamp) AS latest_timestamp
      FROM session_notice_events sne
      INNER JOIN diagnostic_sessions
        ON diagnostic_sessions.id = sne.session_id
      WHERE ${whereClause}
      GROUP BY sne.code, sne.level
      ORDER BY event_count DESC, affected_sessions DESC, latest_timestamp DESC
    `).all(...parameters);
    const noticesBySessionId = this.#loadNoticeEventsBySessionIds(recentRows.map((row) => row.id));

    return {
      summary: {
        sessionCount: summaryRow?.session_count ?? 0,
        sessionsWithFallback: summaryRow?.sessions_with_fallback ?? 0,
        totalStartAttempts: summaryRow?.total_start_attempts ?? 0
      },
      groupedPaths: groupedRows.map((row) => {
        const sessionCount = row.session_count;
        const fallbackCount = row.fallback_count;
        const sessionsWithWarnings = row.sessions_with_warnings;
        const sessionsWithRuntimeRetry = row.sessions_with_runtime_retry;
        const warningNoticeCount = row.warning_notice_count;
        const runtimeRetryCount = row.runtime_retry_count;
        const totalStartAttempts = row.total_start_attempts;
        const sampleRateCount = row.sample_rate_count;
        const bufferCount = row.buffer_count;
        const numberOfBuffersCount = row.number_of_buffers_count;
        const maxChunkGapCount = row.max_chunk_gap_count;

        return {
          deviceName: row.device_name ?? "Unknown device",
          backend: row.backend ?? "unknown",
          profile: row.profile ?? "unknown",
          sessionCount,
          fallbackCount,
          sessionsWithWarnings,
          sessionsWithRuntimeRetry,
          warningNoticeCount,
          runtimeRetryCount,
          totalStartAttempts,
          totalSampleRate: row.total_sample_rate,
          sampleRateCount,
          totalBufferMs: row.total_buffer_ms,
          bufferCount,
          totalNumberOfBuffers: row.total_number_of_buffers,
          numberOfBuffersCount,
          totalMaxChunkGapMs: row.total_max_chunk_gap_ms,
          maxChunkGapCount,
          totalLowSignalEventCount: row.total_low_signal_event_count,
          totalLowSignalChunkCount: row.total_low_signal_chunk_count,
          averageStartAttempts: Number((totalStartAttempts / sessionCount).toFixed(2)),
          averageSampleRate: sampleRateCount === 0 ? 0 : Math.round(row.total_sample_rate / sampleRateCount),
          averageBufferMs: bufferCount === 0 ? 0 : Number((row.total_buffer_ms / bufferCount).toFixed(2)),
          averageNumberOfBuffers: numberOfBuffersCount === 0
            ? 0
            : Number((row.total_number_of_buffers / numberOfBuffersCount).toFixed(2)),
          averageMaxChunkGapMs: maxChunkGapCount === 0
            ? 0
            : Number((row.total_max_chunk_gap_ms / maxChunkGapCount).toFixed(2)),
          fallbackRate: Number((fallbackCount / sessionCount).toFixed(2)),
          warningSessionRate: Number((sessionsWithWarnings / sessionCount).toFixed(2)),
          runtimeRetryRate: Number((sessionsWithRuntimeRetry / sessionCount).toFixed(2)),
          averageWarningNotices: Number((warningNoticeCount / sessionCount).toFixed(2)),
          latestCompletedAt: row.latest_completed_at
        };
      }),
      recentSessions: recentRows.map((row) => {
        const capture = this.#mapDiagnosticsCapture(row);
        const notices = noticesBySessionId.get(row.id) ?? [];

        return {
          sessionId: row.id,
          trainingId: row.training_id,
          completedAt: row.completed_at,
          capture,
          diagnostics: {
            noticeCount: notices.length,
            noticeCodes: notices.map((notice) => notice.code)
          }
        };
      }),
      issueCounts: issueRows.map((row) => ({
        code: row.code,
        level: row.level,
        eventCount: row.event_count,
        affectedSessions: row.affected_sessions,
        latestTimestamp: row.latest_timestamp
      }))
    };
  }
}
