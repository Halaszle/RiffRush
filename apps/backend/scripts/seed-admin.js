/**
 * seed-admin.js
 *
 * Creates a local admin/developer test account in the backend database.
 * Designed to be run once before first use; safe to re-run (idempotent).
 *
 * Usage:
 *   node ./apps/backend/scripts/seed-admin.js
 *   BACKEND_DATA_DIR=./custom/path node ./apps/backend/scripts/seed-admin.js
 *
 * The script reads BACKEND_DATA_DIR and JWT_SECRET from the environment
 * using the same config as the production server, so the seeded account
 * is immediately usable without restarting the backend.
 *
 * WARNING: This creates a well-known account. Never run against a
 * production database — use only in local development environments.
 */

import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getConfig } from "../src/config.js";
import { createSqliteDatabase } from "../src/persistence/sqlite-database.js";
import { applySqliteMigrations } from "../src/persistence/sqlite-migrations.js";
import { SqliteUserRepository } from "../src/repositories/sqlite-user-repository.js";
import { hashPassword } from "../src/lib/crypto.js";
import { join } from "node:path";

const ADMIN_EMAIL = "admin@riffrush.local";
const ADMIN_PASSWORD = "admin";

const config = getConfig();

mkdirSync(config.dataDirectory, { recursive: true });

const database = createSqliteDatabase({
  filePath: join(config.dataDirectory, "riffrush-backend.sqlite")
});

applySqliteMigrations(database);

const userRepository = new SqliteUserRepository({ database });

const existing = userRepository.findCredentialsByEmail(ADMIN_EMAIL);

if (existing) {
  console.log(`Admin account already exists (id: ${existing.id}). No changes made.`);
  database.close();
  process.exit(0);
}

const passwordHash = await hashPassword(ADMIN_PASSWORD);
const userId = `user-admin-${randomUUID()}`;

userRepository.createWithCredentials({
  id: userId,
  email: ADMIN_EMAIL,
  passwordHash
});

database.close();

console.log("Admin account created successfully.");
console.log(`  Email:    ${ADMIN_EMAIL}`);
console.log(`  Password: ${ADMIN_PASSWORD}`);
console.log(`  User ID:  ${userId}`);
console.log(`  Database: ${join(config.dataDirectory, "riffrush-backend.sqlite")}`);
