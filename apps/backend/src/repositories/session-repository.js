export class SessionRepository {
  #sessions = new Map();

  static #cloneSummary(summary) {
    return summary ? structuredClone(summary) : null;
  }

  create(session) {
    this.#sessions.set(session.id, session);
    return { ...session };
  }

  findById(sessionId) {
    const session = this.#sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  updateSummary(sessionId, summary) {
    const current = this.#sessions.get(sessionId);

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
      summary: SessionRepository.#cloneSummary({
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

    this.#sessions.set(sessionId, updated);
    return { ...updated };
  }

  listCompletedByUser(userId) {
    return [...this.#sessions.values()]
      .filter((session) => session.userId === userId && session.status === "completed")
      .map((session) => ({
        ...session,
        summary: SessionRepository.#cloneSummary(session.summary)
      }));
  }
}
