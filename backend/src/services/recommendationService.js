const DEFAULT_ML_API_URL = "http://127.0.0.1:8000";
const DEFAULT_ML_API_TIMEOUT_MS = 120000;

function createServiceError(message, status, code, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function getMlApiUrl() {
  const configuredUrl = String(
    process.env.ML_API_URL || DEFAULT_ML_API_URL
  ).trim();

  try {
    return new URL(configuredUrl);
  } catch {
    throw createServiceError(
      "ML_API_URL is not a valid URL",
      500,
      "ML_API_CONFIG_ERROR"
    );
  }
}

function getTimeoutMs() {
  const configuredTimeout = Number(process.env.ML_API_TIMEOUT_MS);
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout;
  }
  return DEFAULT_ML_API_TIMEOUT_MS;
}

async function parseJsonResponse(response) {
  const responseText = await response.text();
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    throw createServiceError(
      "ML API returned an invalid JSON response",
      502,
      "ML_API_INVALID_RESPONSE"
    );
  }
}

function mapUpstreamError(response, payload) {
  const upstreamDetail = payload?.detail;
  const upstreamMessage =
    upstreamDetail?.message ||
    payload?.message ||
    `ML API request failed with status ${response.status}`;
  const upstreamCode = upstreamDetail?.code || "ML_API_ERROR";

  const passThroughStatuses = new Set([400, 404, 409, 422]);
  let responseStatus = 502;
  if (passThroughStatuses.has(response.status)) {
    responseStatus = response.status;
  } else if (response.status === 503) {
    responseStatus = 503;
  }

  return createServiceError(
    upstreamMessage,
    responseStatus,
    upstreamCode,
    upstreamDetail || payload
  );
}

async function mlApiRequest(path, options = {}) {
  const baseUrl = getMlApiUrl();
  const requestUrl = new URL(path, `${baseUrl.toString().replace(/\/$/, "")}/`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());

  let response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw createServiceError(
        "ML API request timed out",
        504,
        "ML_API_TIMEOUT"
      );
    }

    throw createServiceError(
      "ML API is unavailable",
      503,
      "ML_API_UNAVAILABLE",
      error.message
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw mapUpstreamError(response, payload);
  }
  if (!payload || typeof payload !== "object") {
    throw createServiceError(
      "ML API returned an empty response",
      502,
      "ML_API_INVALID_RESPONSE"
    );
  }

  return payload;
}

async function getMlHealth() {
  return mlApiRequest("/health");
}

async function getPlayerRecommendations(playerName) {
  const cleanedName = String(playerName || "").trim();
  if (!cleanedName) {
    throw createServiceError(
      "playerName is required",
      400,
      "INVALID_PLAYER_NAME"
    );
  }
  if (cleanedName.length > 200) {
    throw createServiceError(
      "playerName must contain at most 200 characters",
      400,
      "INVALID_PLAYER_NAME"
    );
  }

  return mlApiRequest("/v1/recommend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: cleanedName,
    }),
  });
}

module.exports = {
  getMlHealth,
  getPlayerRecommendations,
};
