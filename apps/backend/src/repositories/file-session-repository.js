import { JsonFileStore } from "../lib/json-file-store.js";

function cloneSummary(summary) {
  return summary ? structuredClone(summary) : null;
}

function cloneSession(session) {
  return {
    ...session,
    summary: cloneSummary(session.summary)
  };
}

export class FileSessionRepository {
  #store;

  constructor({ filePath }) {
    this.#store = new JsonFileStore({
      filePath,
      defaultValue: {
        sessions: []
      }
    });
  }

  create(session) {
    const data = this.#store.read();
    const storedSession = cloneSession(session);

    data.sessions.push(storedSession);
    this.#store.write(data);
    return cloneSession(storedSession);
  }

  findById(sessionId) {
    const data = this.#store.read();
    const session = data.sessions.find((item) => item.id === sessionId);
    return session ? cloneSession(session) : null;
  }

  updateSummary(sessionId, summary) {
    const data = this.#store.read();
    const sessionIndex = data.sessions.findIndex((item) => item.id === sessionId);

    if (sessionIndex === -1) {
      return null;
    }

    const updated = {
      ...data.sessions[sessionIndex],
      status: "completed",
      completedAt: new Date().toISOString(),
      summary: cloneSummary(summary)
    };

    data.sessions[sessionIndex] = updated;
    this.#store.write(data);
    return cloneSession(updated);
  }

  listCompletedByUser(userId) {
    const data = this.#store.read();

    return data.sessions
      .filter((session) => session.userId === userId && session.status === "completed")
      .map((session) => cloneSession(session));
  }
}
