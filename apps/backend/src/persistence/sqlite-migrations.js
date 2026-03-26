export const SQLITE_SCHEMA_VERSION = 7;

const migrations = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        calibration_profile_json TEXT,
        capture_preferences_json TEXT NOT NULL,
        capture_override_history_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        training_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        calibration_offset_ms INTEGER NOT NULL,
        input_mode TEXT NOT NULL,
        input_file_path TEXT,
        capture_duration_ms INTEGER NOT NULL,
        capture_profile TEXT NOT NULL,
        input_device_backend TEXT NOT NULL,
        input_device_id TEXT,
        input_device_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        summary_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_status_completed
        ON sessions (user_id, status, completed_at DESC);
    `
  },
  {
    version: 2,
    name: "diagnostics_tables",
    sql: `
      CREATE TABLE IF NOT EXISTS session_capture_snapshots (
        session_id TEXT PRIMARY KEY,
        source TEXT,
        profile TEXT,
        requested_profile TEXT,
        backend TEXT,
        requested_backend TEXT,
        device_id TEXT,
        device_name TEXT,
        device_number INTEGER,
        sample_rate INTEGER,
        chunk_count INTEGER,
        duration_ms INTEGER,
        buffer_ms REAL,
        number_of_buffers REAL,
        start_attempt_count INTEGER,
        use_event_sync INTEGER,
        fallback_applied INTEGER,
        fallback_reason TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS session_notice_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        code TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        capture_json TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_notice_events_session_id
        ON session_notice_events (session_id, timestamp ASC);
    `
  },
  {
    version: 3,
    name: "capture_runtime_metrics",
    sql: `
      ALTER TABLE session_capture_snapshots ADD COLUMN max_chunk_gap_ms REAL;
      ALTER TABLE session_capture_snapshots ADD COLUMN low_signal_event_count INTEGER;
      ALTER TABLE session_capture_snapshots ADD COLUMN low_signal_chunk_count INTEGER;
    `
  },
  {
    version: 4,
    name: "setup_recommendation_history",
    sql: `
      ALTER TABLE users ADD COLUMN setup_recommendation_history_json TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 5,
    name: "session_practice_presets",
    sql: `
      ALTER TABLE sessions ADD COLUMN tempo_bpm INTEGER;
      ALTER TABLE sessions ADD COLUMN practice_scope TEXT;
      ALTER TABLE sessions ADD COLUMN loop_section_id TEXT;
      ALTER TABLE sessions ADD COLUMN loop_repetition_count INTEGER;
      ALTER TABLE sessions ADD COLUMN loop_tempo_step_bpm INTEGER;
    `
  },
  {
    version: 6,
    name: "user_credentials",
    sql: `
      ALTER TABLE users ADD COLUMN email TEXT;
      ALTER TABLE users ADD COLUMN password_hash TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
        ON users (email)
        WHERE email IS NOT NULL;
    `
  },
  {
    version: 7,
    name: "telemetry_events",
    sql: `
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        message TEXT NOT NULL,
        stack TEXT,
        url TEXT,
        user_agent TEXT,
        app_context TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at
        ON telemetry_events (created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_id
        ON telemetry_events (user_id, created_at DESC);
    `
  }
];

function ensureMigrationTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export function applySqliteMigrations(database) {
  ensureMigrationTable(database);

  const appliedVersions = new Set(
    database
      .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
      .all()
      .map((row) => row.version)
  );

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    database.exec("BEGIN");

    try {
      database.exec(migration.sql);
      database
        .prepare(`
          INSERT INTO schema_migrations (version, name, applied_at)
          VALUES (?, ?, ?)
        `)
        .run(migration.version, migration.name, new Date().toISOString());
      database.exec(`PRAGMA user_version = ${migration.version}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
