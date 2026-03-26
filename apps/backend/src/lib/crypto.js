import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const SCRYPT_KEY_LENGTH = 64;
const JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

/**
 * Hashes a plaintext password using scrypt with a random salt.
 * Returns a `salt:hash` string safe to store in the database.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored `salt:hash` string.
 * Uses a timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH);
  const storedBuffer = Buffer.from(hash, "hex");

  if (derivedKey.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedBuffer);
}

// ---------------------------------------------------------------------------
// JWT (HS256)
// ---------------------------------------------------------------------------

function base64urlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64urlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

/**
 * Signs a JWT payload using HMAC-SHA256.
 * Returns a compact token string.
 */
export function signJwt(payload, secret, expiresInSeconds = JWT_EXPIRY_SECONDS) {
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const issuedAt = Math.floor(Date.now() / 1000);

  const claims = base64urlEncode(
    JSON.stringify({
      ...payload,
      iat: issuedAt,
      exp: issuedAt + expiresInSeconds
    })
  );

  const signature = createHmac("sha256", secret)
    .update(`${header}.${claims}`)
    .digest("base64url");

  return `${header}.${claims}.${signature}`;
}

/**
 * Verifies a JWT token.
 * Throws with `code` property set to INVALID_TOKEN or TOKEN_EXPIRED on failure.
 * Returns the decoded payload on success.
 */
export function verifyJwt(token, secret) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    const error = new Error("Token has invalid structure.");
    error.code = "INVALID_TOKEN";
    throw error;
  }

  const [header, claims, signature] = parts;

  const expectedSignature = createHmac("sha256", secret)
    .update(`${header}.${claims}`)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    const error = new Error("Token signature is invalid.");
    error.code = "INVALID_TOKEN";
    throw error;
  }

  let payload;

  try {
    payload = JSON.parse(base64urlDecode(claims));
  } catch {
    const error = new Error("Token claims could not be parsed.");
    error.code = "INVALID_TOKEN";
    throw error;
  }

  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    const error = new Error("Token has expired.");
    error.code = "TOKEN_EXPIRED";
    throw error;
  }

  return payload;
}
