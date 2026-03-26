import { JsonFileStore } from "../lib/json-file-store.js";

function cloneUser(user) {
  return structuredClone(user);
}

export class FileUserRepository {
  #store;
  #maxOverrideHistory = 12;

  constructor({ filePath }) {
    this.#store = new JsonFileStore({
      filePath,
      defaultValue: {
        users: []
      }
    });
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
      createdAt: new Date().toISOString()
    };
  }

  ensure(userId) {
    const data = this.#store.read();
    const existing = data.users.find((user) => user.id === userId);

    if (existing) {
      return cloneUser(existing);
    }

    const created = this.#createDefaultUser(userId);
    data.users.push(created);
    this.#store.write(data);
    return cloneUser(created);
  }

  findById(userId) {
    const data = this.#store.read();
    const user = data.users.find((item) => item.id === userId);
    return user ? cloneUser(user) : null;
  }

  saveCalibration(userId, calibrationProfile) {
    const data = this.#store.read();
    const userIndex = data.users.findIndex((user) => user.id === userId);
    const current = userIndex === -1 ? this.#createDefaultUser(userId) : data.users[userIndex];
    const updated = {
      ...current,
      calibrationProfile: { ...calibrationProfile }
    };

    if (userIndex === -1) {
      data.users.push(updated);
    } else {
      data.users[userIndex] = updated;
    }

    this.#store.write(data);
    return cloneUser(updated);
  }

  saveCapturePreferences(userId, capturePreferences) {
    const data = this.#store.read();
    const userIndex = data.users.findIndex((user) => user.id === userId);
    const current = userIndex === -1 ? this.#createDefaultUser(userId) : data.users[userIndex];
    const updated = {
      ...current,
      capturePreferences: {
        ...current.capturePreferences,
        ...capturePreferences
      }
    };

    if (userIndex === -1) {
      data.users.push(updated);
    } else {
      data.users[userIndex] = updated;
    }

    this.#store.write(data);
    return cloneUser(updated);
  }

  appendCaptureOverride(userId, overrideEntry) {
    const data = this.#store.read();
    const userIndex = data.users.findIndex((user) => user.id === userId);
    const current = userIndex === -1 ? this.#createDefaultUser(userId) : data.users[userIndex];
    const updated = {
      ...current,
      captureOverrideHistory: [overrideEntry, ...(current.captureOverrideHistory ?? [])].slice(
        0,
        this.#maxOverrideHistory
      )
    };

    if (userIndex === -1) {
      data.users.push(updated);
    } else {
      data.users[userIndex] = updated;
    }

    this.#store.write(data);
    return cloneUser(updated);
  }
}
