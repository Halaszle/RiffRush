import { randomUUID } from "node:crypto";

/** Maximum number of telemetry events retained in the database. */
const MAX_RETAINED_EVENTS = 500;

export class SqliteTelemetryRepository {
  #database;

  constructor({ database }) {
    this.#database = database;
  }

  /**
   * Inserts a telemetry event and prunes the oldest records when the table
   * exceeds MAX_RETAINED_EVENTS rows, keeping storage bounded.
   */
  insert({ eventType, userId, message, stack, url, userAgent, appContext }) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    this.#database
      .prepare(
        `INSERT INTO telemetry_events
           (id, event_type, user_id, message, stack, url, user_agent, app_context, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        eventType,
        userId ?? null,
        message,
        stack ?? null,
        url ?? null,
        userAgent ?? null,
        appContext !== undefined ? JSON.stringify(appContext) : null,
        createdAt
      );

    // Keep only the most recent MAX_RETAINED_EVENTS rows.
    this.#database
      .prepare(
        `DELETE FROM telemetry_events
         WHERE id NOT IN (
           SELECT id FROM telemetry_events ORDER BY created_at DESC LIMIT ?
         )`
      )
      .run(MAX_RETAINED_EVENTS);

    return { id, eventType, userId: userId ?? null, message, createdAt };
  }

  /**
   * Returns a page of telemetry events ordered newest-first.
   */
  list({ limit = 50, offset = 0 } = {}) {
    return this.#database
      .prepare(
        `SELECT * FROM telemetry_events ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset)
      .map((row) => this.#mapRow(row));
  }

  /** Returns the total number of stored telemetry events. */
  count() {
    const row = this.#database
      .prepare(`SELECT COUNT(*) AS count FROM telemetry_events`)
      .get();
    return row.count;
  }

  #mapRow(row) {
    return {
      id: row.id,
      eventType: row.event_type,
      userId: row.user_id ?? null,
      message: row.message,
      stack: row.stack ?? null,
      url: row.url ?? null,
      userAgent: row.user_agent ?? null,
      appContext: row.app_context ? JSON.parse(row.app_context) : null,
      createdAt: row.created_at
    };
  }
}
