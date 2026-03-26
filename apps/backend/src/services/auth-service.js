import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword, signJwt, verifyJwt } from "../lib/crypto.js";

const MIN_PASSWORD_LENGTH = 8;
const MAX_EMAIL_LENGTH = 254;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validateEmail(email) {
  if (typeof email !== "string" || email.trim().length === 0) {
    return "Field email is required.";
  }

  if (email.trim().length > MAX_EMAIL_LENGTH) {
    return "Field email is too long.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Field email must be a valid email address.";
  }

  return null;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    return "Field password is required.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Field password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return null;
}

export class AuthService {
  #userRepository;
  #jwtSecret;

  constructor({ userRepository, jwtSecret }) {
    this.#userRepository = userRepository;
    this.#jwtSecret = jwtSecret;
  }

  /**
   * Registers a new user with email and password.
   * Returns a JWT token and the new user's id.
   * Throws with `code` property on validation or conflict errors.
   */
  async register(email, password) {
    const emailError = validateEmail(email);

    if (emailError) {
      const error = new Error(emailError);
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      const error = new Error(passwordError);
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const normalized = normalizeEmail(email);
    const existing = this.#userRepository.findCredentialsByEmail(normalized);

    if (existing) {
      const error = new Error("An account with this email already exists.");
      error.code = "EMAIL_ALREADY_EXISTS";
      throw error;
    }

    const passwordHash = await hashPassword(password);
    const userId = `user-${randomUUID()}`;

    this.#userRepository.createWithCredentials({
      id: userId,
      email: normalized,
      passwordHash
    });

    const token = signJwt({ sub: userId, email: normalized }, this.#jwtSecret);
    return { token, userId };
  }

  /**
   * Authenticates an existing user by email and password.
   * Returns a JWT token and the user's id.
   * Throws with `code` property on validation or credential errors.
   */
  async login(email, password) {
    const emailError = validateEmail(email);

    if (emailError) {
      const error = new Error(emailError);
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    if (typeof password !== "string" || password.length === 0) {
      const error = new Error("Field password is required.");
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const normalized = normalizeEmail(email);
    const credentials = this.#userRepository.findCredentialsByEmail(normalized);

    // Use a dummy verify to avoid timing-based user enumeration.
    const isValid =
      credentials !== null &&
      (await verifyPassword(password, credentials.passwordHash));

    if (!isValid) {
      const error = new Error("Invalid email or password.");
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    const token = signJwt(
      { sub: credentials.id, email: normalized },
      this.#jwtSecret
    );

    return { token, userId: credentials.id };
  }

  /**
   * Verifies a JWT token extracted from an Authorization header.
   * Returns `{ userId, email }` on success.
   * Throws with `code` property on failure.
   */
  verifyToken(token) {
    const payload = verifyJwt(token, this.#jwtSecret);
    return { userId: payload.sub, email: payload.email };
  }
}
