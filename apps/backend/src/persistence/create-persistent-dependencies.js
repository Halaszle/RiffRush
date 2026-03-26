import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SqliteSessionRepository } from "../repositories/sqlite-session-repository.js";
import { SqliteTelemetryRepository } from "../repositories/sqlite-telemetry-repository.js";
import { TrainingRepository } from "../repositories/training-repository.js";
import { SqliteUserRepository } from "../repositories/sqlite-user-repository.js";
import { AuthService } from "../services/auth-service.js";
import { createSqliteDatabase } from "./sqlite-database.js";

export function createPersistentDependencies({ dataDirectory, jwtSecret }) {
  mkdirSync(dataDirectory, { recursive: true });
  const database = createSqliteDatabase({
    filePath: join(dataDirectory, "riffrush-backend.sqlite")
  });

  const userRepository = new SqliteUserRepository({ database });

  return {
    trainingRepository: new TrainingRepository(),
    sessionRepository: new SqliteSessionRepository({ database }),
    userRepository,
    telemetryRepository: new SqliteTelemetryRepository({ database }),
    authService: new AuthService({ userRepository, jwtSecret }),
    close() {
      database.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      database.exec("PRAGMA journal_mode = DELETE;");
      database.close();
    }
  };
}
