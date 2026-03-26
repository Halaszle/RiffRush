export class UserRepository {
  #users = new Map();
  #emailIndex = new Map();
  #maxOverrideHistory = 12;
  #maxSetupRecommendationHistory = 20;

  ensure(userId) {
    const existing = this.#users.get(userId);

    if (existing) {
      return { ...existing };
    }

    const created = {
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

    this.#users.set(userId, created);
    return { ...created };
  }

  findById(userId) {
    const user = this.#users.get(userId);
    return user ? { ...user } : null;
  }

  findCredentialsByEmail(email) {
    const userId = this.#emailIndex.get(email);

    if (!userId) {
      return null;
    }

    const user = this.#users.get(userId);

    if (!user || !user.passwordHash) {
      return null;
    }

    return { id: user.id, email: user.email, passwordHash: user.passwordHash };
  }

  createWithCredentials({ id, email, passwordHash }) {
    const user = {
      id,
      email,
      passwordHash,
      calibrationProfile: null,
      capturePreferences: {
        autoApplyRecommendation: true,
        updatedAt: new Date().toISOString()
      },
      captureOverrideHistory: [],
      setupRecommendationHistory: [],
      createdAt: new Date().toISOString()
    };

    this.#users.set(id, user);
    this.#emailIndex.set(email, id);
    return { ...user };
  }

  saveCalibration(userId, calibrationProfile) {
    const current = this.ensure(userId);
    const updated = {
      ...current,
      calibrationProfile: { ...calibrationProfile }
    };

    this.#users.set(userId, updated);
    return { ...updated };
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

    this.#users.set(userId, updated);
    return { ...updated };
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

    this.#users.set(userId, updated);
    return { ...updated };
  }

  appendSetupRecommendation(userId, recommendationEntry) {
    const current = this.ensure(userId);
    const updated = {
      ...current,
      setupRecommendationHistory: [recommendationEntry, ...(current.setupRecommendationHistory ?? [])].slice(
        0,
        this.#maxSetupRecommendationHistory
      )
    };

    this.#users.set(userId, updated);
    return { ...updated };
  }

  updateSetupRecommendation(userId, recommendationId, patch) {
    const current = this.ensure(userId);
    const currentHistory = current.setupRecommendationHistory ?? [];
    const targetIndex = currentHistory.findIndex((entry) => entry.id === recommendationId);

    if (targetIndex < 0) {
      return null;
    }

    const updatedHistory = [...currentHistory];
    updatedHistory[targetIndex] = {
      ...updatedHistory[targetIndex],
      ...patch
    };
    const updated = {
      ...current,
      setupRecommendationHistory: updatedHistory
    };

    this.#users.set(userId, updated);
    return { ...updated };
  }
}
