import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applySqliteMigrations } from "./sqlite-migrations.js";

export function createSqliteDatabase({ filePath }) {
  mkdirSync(dirname(filePath), { recursive: true });

  const database = new DatabaseSync(filePath);
  database.exec("PRAGMA journal_mode = WAL;");
  applySqliteMigrations(database);

  return database;
}
