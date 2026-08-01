const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, test } = require("node:test");

const app = require("../src/app");

const AUTH_HEADER = {
  Authorization: "Bearer valid-test-token",
};
const ADMIN_AUTH_HEADER = {
  Authorization: "Bearer admin-test-token",
};

let backendServer;
let backendUrl;
let mlServer;
let geminiServer;
let originalMlApiUrl;
let originalGeminiApiUrl;
let originalGeminiApiKey;
let originalGeminiModel;
let lastGeminiRequest;

const mockAnalysis = {
  title: "Kevin De Bruyne scouting analysis",
  executiveSummary: "The target player profiles as a creative midfielder.",
  targetProfile: {
    playStyle: "A central playmaker who creates chances from midfield.",
    strengths: ["High passing and vision evidence."],
    weaknesses: ["Defensive evidence needs further review."],
    risks: ["The analysis is limited to the supplied dataset."],
  },
  recommendations: [
    {
      playerName: "Candidate One",
      fitSummary: "A close passing-profile match.",
      reasons: ["Ranked by K-NN evidence."],
      concerns: ["Lower PA than the target."],
    },
  ],
  bestChoices: {
    overall: "Candidate One",
    styleMatch: "Candidate One",
    value: "Candidate One",
    potential: "Candidate One",
  },
  confidenceNote: "ML similarity is evidence, not a performance guarantee.",
};

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

before(async () => {
  originalMlApiUrl = process.env.ML_API_URL;
  originalGeminiApiUrl = process.env.GEMINI_API_URL;
  originalGeminiApiKey = process.env.GEMINI_API_KEY;
  originalGeminiModel = process.env.GEMINI_MODEL;
  app.locals.verifySupabaseUser = async (token) => {
    if (token === "valid-test-token") {
      return { id: "test-user-id", email: "scout@example.com" };
    }

    if (token === "admin-test-token") {
      return { id: "admin-user-id", email: "admin@example.com" };
    }

    return null;
  };
  app.locals.getUserRole = async (userId) =>
    userId === "admin-user-id" ? "admin" : "user";
  app.locals.getAdminDashboard = async () => ({
    counts: {
      users: 4,
      players: 8452,
      shortlistItems: 12,
      searchHistoryItems: 27,
    },
    generatedAt: "2026-08-01T00:00:00.000Z",
  });

  mlServer = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        status: "ok",
        engine: "ready",
        datasetRows: 8452,
        featureCount: 89,
        bestKnnK: 7,
        bestKMeansK: 10,
      });
      return;
    }

    if (request.method === "POST" && request.url === "/v1/recommend") {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const payload = JSON.parse(body);
        if (payload.playerName === "Mohamed") {
          sendJson(response, 409, {
            detail: {
              code: "AMBIGUOUS_PLAYER_NAME",
              message: "Found multiple matching players.",
              matches: [
                {
                  Name: "Mohamed Salah",
                  Club: "Liverpool",
                },
                {
                  Name: "Mohamed Elneny",
                  Club: "Arsenal",
                },
              ],
            },
          });
          return;
        }

        sendJson(response, 200, {
          target: {
            Name: payload.playerName,
          },
          results: {
            "K-NN (The Clone)": [
              {
                Name: "Candidate One",
                UID: "candidate-1",
                Score: 87.5,
                Age: 24,
                CA: 170,
                PA: 180,
                MarketValue: 50000000,
                Position: "M/AM C",
                Attributes: {
                  Technical: {
                    Passing: 17,
                  },
                },
              },
            ],
          },
          model: {
            bestKnnK: 7,
            bestKMeansK: 10,
          },
        });
      });
      return;
    }

    sendJson(response, 404, {
      message: "Not found",
    });
  });
  await listen(mlServer);

  const mlAddress = mlServer.address();
  process.env.ML_API_URL = `http://127.0.0.1:${mlAddress.port}`;

  geminiServer = http.createServer((request, response) => {
    if (
      request.method === "POST" &&
      request.url === "/v1beta/models/gemini-3.6-flash:generateContent"
    ) {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        lastGeminiRequest = {
          apiKey: request.headers["x-goog-api-key"],
          body: JSON.parse(body),
        };
        sendJson(response, 200, {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(mockAnalysis),
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 200,
            totalTokenCount: 300,
          },
        });
      });
      return;
    }

    sendJson(response, 404, {
      error: {
        message: "Not found",
      },
    });
  });
  await listen(geminiServer);

  const geminiAddress = geminiServer.address();
  process.env.GEMINI_API_URL =
    `http://127.0.0.1:${geminiAddress.port}/v1beta`;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GEMINI_MODEL = "gemini-3.6-flash";

  backendServer = http.createServer(app);
  await listen(backendServer);
  const backendAddress = backendServer.address();
  backendUrl = `http://127.0.0.1:${backendAddress.port}`;
});

after(async () => {
  await close(backendServer);
  await close(mlServer);
  await close(geminiServer);
  delete app.locals.verifySupabaseUser;
  delete app.locals.getUserRole;
  delete app.locals.getAdminDashboard;

  if (originalMlApiUrl === undefined) {
    delete process.env.ML_API_URL;
  } else {
    process.env.ML_API_URL = originalMlApiUrl;
  }

  if (originalGeminiApiUrl === undefined) {
    delete process.env.GEMINI_API_URL;
  } else {
    process.env.GEMINI_API_URL = originalGeminiApiUrl;
  }

  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }

  if (originalGeminiModel === undefined) {
    delete process.env.GEMINI_MODEL;
  } else {
    process.env.GEMINI_MODEL = originalGeminiModel;
  }
});

test("GET /api/ml/health proxies ML readiness", async () => {
  const response = await fetch(`${backendUrl}/api/ml/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    engine: "ready",
    datasetRows: 8452,
    featureCount: 89,
    bestKnnK: 7,
    bestKMeansK: 10,
  });
});

test("POST /api/recommendations proxies the ML result", async () => {
  const response = await fetch(`${backendUrl}/api/recommendations`, {
    method: "POST",
    headers: {
      ...AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: "  Kevin De Bruyne  ",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).target.Name,
    "Kevin De Bruyne"
  );
});

test("POST /api/recommendations validates playerName", async () => {
  const response = await fetch(`${backendUrl}/api/recommendations`, {
    method: "POST",
    headers: {
      ...AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: "   ",
    }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_PLAYER_NAME");
});

test("POST /api/recommendations preserves ambiguous-name details", async () => {
  const response = await fetch(`${backendUrl}/api/recommendations`, {
    method: "POST",
    headers: {
      ...AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: "Mohamed",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, "AMBIGUOUS_PLAYER_NAME");
  assert.equal(payload.details.matches.length, 2);
});

test("POST /api/recommendations rejects missing sessions", async () => {
  const response = await fetch(`${backendUrl}/api/recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: "Kevin De Bruyne",
    }),
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "UNAUTHENTICATED");
});

test("GET /api/admin/health allows administrators", async () => {
  const response = await fetch(`${backendUrl}/api/admin/health`, {
    headers: ADMIN_AUTH_HEADER,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    role: "admin",
    userId: "admin-user-id",
  });
});

test("GET /api/admin/health rejects non-admin users", async () => {
  const response = await fetch(`${backendUrl}/api/admin/health`, {
    headers: AUTH_HEADER,
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "FORBIDDEN");
});

test("GET /api/admin/health rejects missing sessions", async () => {
  const response = await fetch(`${backendUrl}/api/admin/health`);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "UNAUTHENTICATED");
});

test("GET /api/auth/me returns the authenticated user's role", async () => {
  const response = await fetch(`${backendUrl}/api/auth/me`, {
    headers: AUTH_HEADER,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    user: {
      id: "test-user-id",
      email: "scout@example.com",
    },
    role: "user",
    isAdmin: false,
  });
});

test("GET /api/admin/dashboard returns aggregate counts to administrators", async () => {
  const response = await fetch(`${backendUrl}/api/admin/dashboard`, {
    headers: ADMIN_AUTH_HEADER,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    counts: {
      users: 4,
      players: 8452,
      shortlistItems: 12,
      searchHistoryItems: 27,
    },
    generatedAt: "2026-08-01T00:00:00.000Z",
  });
});

test("GET /api/admin/dashboard rejects non-admin users", async () => {
  const response = await fetch(`${backendUrl}/api/admin/dashboard`, {
    headers: AUTH_HEADER,
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "FORBIDDEN");
});

test("GET /api/ai/health reports Gemini configuration", async () => {
  const response = await fetch(`${backendUrl}/api/ai/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "configured",
    provider: "gemini",
    model: "gemini-3.6-flash",
  });
});

test("POST /api/ai/analyze sends trusted ML context to Gemini", async () => {
  const response = await fetch(`${backendUrl}/api/ai/analyze`, {
    method: "POST",
    headers: {
      ...AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: "Kevin De Bruyne",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.provider, "gemini");
  assert.equal(payload.model, "gemini-3.6-flash");
  assert.equal(payload.language, "en");
  assert.equal(payload.analysis.title, mockAnalysis.title);
  assert.equal(payload.usage.totalTokens, 300);
  assert.equal(lastGeminiRequest.apiKey, "test-gemini-key");
  assert.equal(
    lastGeminiRequest.body.generationConfig.responseMimeType,
    "application/json"
  );
  assert.match(
    lastGeminiRequest.body.systemInstruction.parts[0].text,
    /clear English/
  );
  assert.doesNotMatch(
    lastGeminiRequest.body.systemInstruction.parts[0].text,
    /Thai/
  );

  const scoutContext = JSON.parse(
    lastGeminiRequest.body.contents[0].parts[0].text
  );
  assert.equal(scoutContext.target.name, "Kevin De Bruyne");
  assert.equal(scoutContext.candidates[0].name, "Candidate One");
  assert.equal(scoutContext.candidates[0].evidence[0].score, 87.5);
  assert.deepEqual(scoutContext.responseLanguage, {
    code: "en",
    name: "English",
  });
});

test("POST /api/ai/analyze instructs Gemini to answer in Thai", async () => {
  const response = await fetch(`${backendUrl}/api/ai/analyze`, {
    method: "POST",
    headers: {
      ...AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "th",
      playerName: "Kevin De Bruyne",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.language, "th");
  assert.match(
    lastGeminiRequest.body.systemInstruction.parts[0].text,
    /natural Thai/
  );
  assert.doesNotMatch(
    lastGeminiRequest.body.systemInstruction.parts[0].text,
    /clear English/
  );

  const scoutContext = JSON.parse(
    lastGeminiRequest.body.contents[0].parts[0].text
  );
  assert.deepEqual(scoutContext.responseLanguage, {
    code: "th",
    name: "Thai",
  });
});

test("POST /api/ai/analyze validates playerName before calling Gemini", async () => {
  const response = await fetch(`${backendUrl}/api/ai/analyze`, {
    method: "POST",
    headers: {
      ...AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: " ",
    }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_PLAYER_NAME");
});

test("POST /api/ai/analyze rejects missing sessions", async () => {
  const response = await fetch(`${backendUrl}/api/ai/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: "Kevin De Bruyne",
    }),
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "UNAUTHENTICATED");
});
