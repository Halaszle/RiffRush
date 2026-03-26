export function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });

  response.end(JSON.stringify(payload, null, 2));
}

export function sendText(response, statusCode, body, { contentType = "text/plain; charset=utf-8", headers = {} } = {}) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...headers
  });

  response.end(body);
}

export function sendError(response, statusCode, code, message, details) {
  sendJson(response, statusCode, {
    error: {
      code,
      message,
      details: details ?? null
    }
  });
}

export async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export function isOptionsRequest(request) {
  return request.method === "OPTIONS";
}

export function normalizeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
