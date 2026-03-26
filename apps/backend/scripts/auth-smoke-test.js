import assert from "node:assert/strict";
import { createApp } from "../src/create-app.js";
import { AuthService } from "../src/services/auth-service.js";
import { UserRepository } from "../src/repositories/user-repository.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function post(baseUrl, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });

  return { status: response.status, payload: await response.json() };
}

async function get(baseUrl, path, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return { status: response.status, payload: await response.json() };
}

// ---------------------------------------------------------------------------
// Setup — in-memory server with real AuthService wired to an in-memory user repo
// ---------------------------------------------------------------------------

const userRepository = new UserRepository();
const authService = new AuthService({
  userRepository,
  jwtSecret: "test-secret-for-smoke-test"
});

const server = createApp({ userRepository, authService });

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

let errors = 0;

function fail(message) {
  console.error(`  FAIL  ${message}`);
  errors += 1;
}

function pass(message) {
  console.log(`  pass  ${message}`);
}

function check(label, condition) {
  if (condition) {
    pass(label);
  } else {
    fail(label);
  }
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------

console.log("\nPOST /auth/register");

const reg1 = await post(baseUrl, "/auth/register", {
  email: "guitarist@example.com",
  password: "correcthorsebattery"
});
check("201 on valid registration", reg1.status === 201);
check("returns token", typeof reg1.payload.data?.token === "string");
check("returns userId", typeof reg1.payload.data?.userId === "string");

const reg2 = await post(baseUrl, "/auth/register", {
  email: "guitarist@example.com",
  password: "correcthorsebattery"
});
check("409 on duplicate email", reg2.status === 409);
check("error code EMAIL_ALREADY_EXISTS", reg2.payload.error?.code === "EMAIL_ALREADY_EXISTS");

const reg3 = await post(baseUrl, "/auth/register", {
  email: "not-an-email",
  password: "correcthorsebattery"
});
check("400 on invalid email", reg3.status === 400);
check("error code VALIDATION_ERROR", reg3.payload.error?.code === "VALIDATION_ERROR");

const reg4 = await post(baseUrl, "/auth/register", {
  email: "short@example.com",
  password: "short"
});
check("400 on password too short", reg4.status === 400);

const reg5 = await post(baseUrl, "/auth/register", {});
check("400 on missing fields", reg5.status === 400);

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

console.log("\nPOST /auth/login");

const login1 = await post(baseUrl, "/auth/login", {
  email: "guitarist@example.com",
  password: "correcthorsebattery"
});
check("200 on valid credentials", login1.status === 200);
check("returns token", typeof login1.payload.data?.token === "string");
check("returns userId", typeof login1.payload.data?.userId === "string");
check("userId matches registration", login1.payload.data?.userId === reg1.payload.data?.userId);

const login2 = await post(baseUrl, "/auth/login", {
  email: "guitarist@example.com",
  password: "wrongpassword"
});
check("401 on wrong password", login2.status === 401);
check("error code INVALID_CREDENTIALS", login2.payload.error?.code === "INVALID_CREDENTIALS");

const login3 = await post(baseUrl, "/auth/login", {
  email: "unknown@example.com",
  password: "correcthorsebattery"
});
check("401 on unknown email", login3.status === 401);
check("same error code for unknown email (no user enumeration)", login3.payload.error?.code === "INVALID_CREDENTIALS");

const login4 = await post(baseUrl, "/auth/login", {
  email: "GUITARIST@EXAMPLE.COM",
  password: "correcthorsebattery"
});
check("200 on login with uppercase email (case-insensitive)", login4.status === 200);

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

console.log("\nGET /auth/me");

const token = login1.payload.data.token;

const me1 = await get(baseUrl, "/auth/me", { Authorization: `Bearer ${token}` });
check("200 with valid token", me1.status === 200);
check("returns userId", me1.payload.data?.userId === reg1.payload.data?.userId);
check("returns email", me1.payload.data?.email === "guitarist@example.com");

const me2 = await get(baseUrl, "/auth/me");
check("401 without token", me2.status === 401);
check("error code MISSING_TOKEN", me2.payload.error?.code === "MISSING_TOKEN");

const me3 = await get(baseUrl, "/auth/me", { Authorization: "Bearer not.a.valid.token" });
check("401 with invalid token", me3.status === 401);

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

await new Promise((resolve, reject) =>
  server.close((error) => (error ? reject(error) : resolve()))
);

if (errors > 0) {
  console.error(`\nAuth smoke test FAILED — ${errors} assertion(s) failed.\n`);
  process.exit(1);
}

console.log("\nAuth smoke test passed.\n");
