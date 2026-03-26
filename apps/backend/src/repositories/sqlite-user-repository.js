function cloneUser(user) {
  return structuredClone(user);
}

function stringifyJson(value) {
  return JSON.stringify(value);
}

function parseJson(value, fallback) {
  return value ? JSON.parse(value) : fallback;
}

export class SqliteUserRepository {
  #database;
  #maxOverrideHistory = 12;
  #maxSetupRecommendationHistory = 20;

  constructor({ database }) {
    this.#database = database;
  }

  #createDefaultUser(userId) {
    return {
      id: userId,
      calibrationProfile: null,
      capturePreferences: {
        autoApplyRecommendation: true,
        updatedAt: new Date().toISOString()
      },
      captureOverrideHistory: [],
      setupRecommendationHistory: [],
      createdAt: new Date().toISOString()
    };
  }

  #mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      calibrationProfile: parseJson(row.calibration_profile_json, null),
      capturePreferences: parseJson(row.capture_preferences_json, null),
      captureOverrideHistory: parseJson(row.capture_override_history_json, []),
      setupRecommendationHistory: parseJson(row.setup_recommendation_history_json, []),
      createdAt: row.created_at
    };
  }

  #insertUser(user) {
    this.#database.prepare(`
      INSERT INTO users (
        id,
        email,
        password_hash,
        calibration_profile_json,
        capture_preferences_json,
        capture_override_history_json,
        setup_recommendation_history_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.email ?? null,
      user.passwordHash ?? null,
      user.calibrationProfile ? stringifyJson(user.calibrationProfile) : null,
      stringifyJson(user.capturePreferences),
      stringifyJson(user.captureOverrideHistory),
      stringifyJson(user.setupRecommendationHistory),
      user.createdAt
    );
  }

  ensure(userId) {
    const existing = this.findById(userId);

    if (existing) {
      return existing;
    }

    const created = this.#createDefaultUser(userId);
    this.#insertUser(created);
    return cloneUser(created);
  }

  findById(userId) {
    const row = this.#database.prepare(`
      SELECT
        id,
        calibration_profile_json,
        capture_preferences_json,
        capture_override_history_json,
        setup_recommendation_history_json,
        created_at
      FROM users
      WHERE id = ?
    `).get(userId);

    const user = this.#mapRow(row);
    return user ? cloneUser(user) : null;
  }

  saveCalibration(userId, calibrationProfile) {
    const current = this.ensure(userId);
    const updated = {
      ...current,
      calibrationProfile: { ...calibrationProfile }
    };

    this.#database.prepare(`
      UPDATE users
      SET calibration_profile_json = ?
      WHERE id = ?
    `).run(stringifyJson(updated.calibrationProfile), userId);

    return cloneUser(updated);
  }

  saveCapturePreferences(userId, capturePreferences) {
    const current = this.ensure(userId);
    const updated = {
      ...current,
      capturePreferences: {
        ...current.capturePreferences,
        ...capturePreferences
      }
    };

    this.#database.prepare(`
      UPDATE users
      SET capture_preferences_json = ?
      WHERE id = ?
    `).run(stringifyJson(updated.capturePreferences), userId);

    return cloneUser(updated);
  }

  appendCaptureOverride(userId, overrideEntry) {
    const current = this.ensure(userId);
    const updated = {
      ...current,
      captureOverrideHistory: [overrideEntry, ...(current.captureOverrideHistory ?? [])].slice(
        0,
        this.#maxOverrideHistory
      )
    };

    this.#database.prepare(`
      UPDATE users
      SET capture_override_history_json = ?
      WHERE id = ?
    `).run(stringifyJson(updated.captureOverrideHistory), userId);

    return cloneUser(updated);
  }

  appendSetupRecommendation(userId, recommendationEntry) {
    const current = this.ensure(userId);
    const updated = {
      ...current,
      setupRecommendationHistory: [
        recommendationEntry,
        ...(current.setupRecommendationHistory ?? [])
      ].slice(0, this.#maxSetupRecommendationHistory)
    };

    this.#database.prepare(`
      UPDATE users
      SET setup_recommendation_history_json = ?
      WHERE id = ?
    `).run(stringifyJson(updated.setupRecommendationHistory), userId);

    return cloneUser(updated);
  }

  /**
   * Returns only the credential fields needed for authentication.
   * Returns null when no user with the given email exists.
   */
  findCredentialsByEmail(email) {
    const row = this.#database.prepare(`
      SELECT id, email, password_hash
      FROM users
      WHERE email = ?
    `).get(email);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash
    };
  }

  /**
   * Creates a new user with email and password credentials.
   * The user record is initialised with default preferences.
   */
  createWithCredentials({ id, email, passwordHash }) {
    const user = {
      ...this.#createDefaultUser(id),
      email,
      passwordHash
    };

    this.#insertUser(user);
    return this.findById(id);
  }

  updateSetupRecommendation(userId, recommendationId, patch) {
    const current = this.ensure(userId);
    const currentHistory = current.setupRecommendationHistory ?? [];
    const targetIndex = currentHistory.findIndex((entry) => entry.id === recommendationId);

    if (targetIndex < 0) {
      return null;
    }

    const updatedEntry = {
      ...currentHistory[targetIndex],
      ...patch
    };
    const updatedHistory = [...currentHistory];
    updatedHistory[targetIndex] = updatedEntry;
    const updated = {
      ...current,
      setupRecommendationHistory: updatedHistory
    };

    this.#database.prepare(`
      UPDATE users
      SET setup_recommendation_history_json = ?
      WHERE id = ?
    `).run(stringifyJson(updatedHistory), userId);

    return cloneUser(updated);
  }
}
