export const PROTOCOL_VERSION = 1;

const REQUIRED_ENVELOPE_FIELDS = [
  "type",
  "protocolVersion",
  "sessionId",
  "timestamp",
  "payload"
];

export function createEnvelope(type, payload, options = {}) {
  return {
    type,
    protocolVersion: PROTOCOL_VERSION,
    sessionId: options.sessionId ?? null,
    timestamp: options.timestamp ?? new Date().toISOString(),
    ...(options.requestId ? { requestId: options.requestId } : {}),
    payload
  };
}

export function createErrorEnvelope(code, message, options = {}) {
  return createEnvelope(
    "engine.error",
    {
      code,
      message,
      retryable: options.retryable ?? false
    },
    options
  );
}

export function parseProtocolMessage(rawValue) {
  const message = JSON.parse(rawValue);

  for (const field of REQUIRED_ENVELOPE_FIELDS) {
    if (!(field in message)) {
      throw new Error(`Missing required field ${field}.`);
    }
  }

  if (message.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported protocol version ${message.protocolVersion}.`);
  }

  if (typeof message.type !== "string" || message.type.length === 0) {
    throw new Error("Field type must be a non-empty string.");
  }

  if (typeof message.timestamp !== "string" || message.timestamp.length === 0) {
    throw new Error("Field timestamp must be a non-empty string.");
  }

  return message;
}
