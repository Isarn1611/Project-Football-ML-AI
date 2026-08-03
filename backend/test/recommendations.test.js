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
const SUSPENDED_AUTH_HEADER = {
  Authorization: "Bearer suspended-test-token",
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
let lastAdminUserQuery;
let lastRoleUpdate;
let lastAdminPlayerQuery;
let lastPlayerUpdate;
let lastPlayerLookupNames;
let lastSuspensionUpdate;
let lastUsageQuery;
const usageEvents = [];

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

    if (token === "suspended-test-token") {
      return { id: "suspended-user-id", email: "blocked@example.com" };
    }

    return null;
  };
  app.locals.getUserRole = async (userId) =>
    userId === "admin-user-id" ? "admin" : "user";
  app.locals.getUserAccess = async (userId) => ({
    role: userId === "admin-user-id" ? "admin" : "user",
    suspendedAt:
      userId === "suspended-user-id" ? "2026-08-01T00:00:00.000Z" : null,
    suspensionReason:
      userId === "suspended-user-id" ? "Policy review" : null,
  });
  app.locals.recordApiUsage = async (event) => {
    usageEvents.push(event);
  };
  app.locals.getAdminDashboard = async () => ({
    counts: {
      users: 4,
      players: 8452,
      shortlistItems: 12,
      searchHistoryItems: 27,
    },
    generatedAt: "2026-08-01T00:00:00.000Z",
  });
  app.locals.listAdminUsers = async (query) => {
    lastAdminUserQuery = query;
    return {
      users: [
        {
          id: "target-user-id",
          email: "member@example.com",
          displayName: "Team Member",
          provider: "email",
          role: "user",
          createdAt: "2026-07-01T00:00:00.000Z",
          lastSignInAt: null,
          emailConfirmedAt: "2026-07-01T00:00:00.000Z",
          bannedUntil: null,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
      query: String(query.q || ""),
    };
  };
  app.locals.updateAdminUserRole = async (actorUserId, targetUserId, role) => {
    lastRoleUpdate = { actorUserId, targetUserId, role };
    return {
      id: targetUserId,
      email: "member@example.com",
      role,
    };
  };
  app.locals.listAdminPlayers = async (query) => {
    lastAdminPlayerQuery = query;
    return {
      players: [
        {
          uid: "18004457",
          name: "Kevin De Bruyne",
          club: "Manchester City",
          age: 31,
          nationality: "Belgium",
          position: "M/AM RLC",
          currentAbility: 189,
          potentialAbility: 189,
          marketValue: 347975206,
          salary: 394372,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
      query: String(query.q || ""),
    };
  };
  app.locals.lookupPlayersByNames = async (names) => {
    lastPlayerLookupNames = names;
    return {
      players: names.map((name, index) => ({
        name,
        uid: String(18004457 + index),
      })),
    };
  };
  app.locals.updateAdminPlayer = async (actorUserId, playerUid, input) => {
    lastPlayerUpdate = { actorUserId, playerUid, input };
    return { uid: playerUid, ...input };
  };
  app.locals.updateAdminUserSuspension = async (
    actorUserId,
    targetUserId,
    suspended,
    reason
  ) => {
    lastSuspensionUpdate = {
      actorUserId,
      targetUserId,
      suspended,
      reason,
    };
    return {
      id: targetUserId,
      email: "member@example.com",
      role: "user",
      suspendedAt: suspended ? "2026-08-01T00:00:00.000Z" : null,
      suspensionReason: suspended ? reason : null,
    };
  };
  app.locals.getAdminUserUsage = async (actorUserId, targetUserId, days) => {
    lastUsageQuery = { actorUserId, targetUserId, days };
    return {
      userId: targetUserId,
      periodDays: Number(days || 30),
      lifetime: {
        requests: 42,
        searches: 9,
        aiRequests: 3,
        promptTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        lastActiveAt: "2026-08-01T00:00:00.000Z",
      },
      period: { requests: 12, totalTokens: 700 },
      endpoints: [],
      daily: [],
      recent: [],
    };
  };

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
  delete app.locals.getUserAccess;
  delete app.locals.recordApiUsage;
  delete app.locals.getAdminDashboard;
  delete app.locals.listAdminUsers;
  delete app.locals.updateAdminUserRole;
  delete app.locals.listAdminPlayers;
  delete app.locals.lookupPlayersByNames;
  delete app.locals.updateAdminPlayer;
  delete app.locals.updateAdminUserSuspension;
  delete app.locals.getAdminUserUsage;

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
    suspended: false,
  });
});

test("protected APIs reject suspended accounts immediately", async () => {
  const response = await fetch(`${backendUrl}/api/auth/me`, {
    headers: SUSPENDED_AUTH_HEADER,
  });
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.code, "ACCOUNT_SUSPENDED");
  assert.equal(payload.details.reason, "Policy review");
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

test("GET /api/admin/users returns a filtered user page to administrators", async () => {
  const response = await fetch(
    `${backendUrl}/api/admin/users?q=member&page=1&pageSize=20`,
    { headers: ADMIN_AUTH_HEADER }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.users[0].email, "member@example.com");
  assert.equal(payload.pagination.total, 1);
  assert.deepEqual({ ...lastAdminUserQuery }, {
    q: "member",
    page: "1",
    pageSize: "20",
  });
});

test("GET /api/admin/users rejects non-admin users", async () => {
  const response = await fetch(`${backendUrl}/api/admin/users`, {
    headers: AUTH_HEADER,
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "FORBIDDEN");
});

test("PATCH /api/admin/users/:id/role changes roles through the admin service", async () => {
  const response = await fetch(
    `${backendUrl}/api/admin/users/target-user-id/role`,
    {
      method: "PATCH",
      headers: {
        ...ADMIN_AUTH_HEADER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "admin" }),
    }
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.role, "admin");
  assert.deepEqual(lastRoleUpdate, {
    actorUserId: "admin-user-id",
    targetUserId: "target-user-id",
    role: "admin",
  });
});

test("PATCH /api/admin/users/:id/role rejects non-admin users", async () => {
  const response = await fetch(
    `${backendUrl}/api/admin/users/target-user-id/role`,
    {
      method: "PATCH",
      headers: {
        ...AUTH_HEADER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "admin" }),
    }
  );

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "FORBIDDEN");
});

test("PATCH /api/admin/users/:id/suspension suspends users through the admin service", async () => {
  const response = await fetch(
    `${backendUrl}/api/admin/users/target-user-id/suspension`,
    {
      method: "PATCH",
      headers: {
        ...ADMIN_AUTH_HEADER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        suspended: true,
        reason: "Policy review",
      }),
    }
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.suspensionReason, "Policy review");
  assert.deepEqual(lastSuspensionUpdate, {
    actorUserId: "admin-user-id",
    targetUserId: "target-user-id",
    suspended: true,
    reason: "Policy review",
  });
});

test("GET /api/admin/users/:id/usage returns accumulated usage", async () => {
  const response = await fetch(
    `${backendUrl}/api/admin/users/target-user-id/usage?days=90`,
    { headers: ADMIN_AUTH_HEADER }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.usage.lifetime.requests, 42);
  assert.equal(payload.usage.lifetime.searches, 9);
  assert.equal(payload.usage.lifetime.totalTokens, 1500);
  assert.deepEqual(lastUsageQuery, {
    actorUserId: "admin-user-id",
    targetUserId: "target-user-id",
    days: "90",
  });
});

test("POST /api/players/lookup resolves player UIDs for search history", async () => {
  const names = ["Kevin De Bruyne", "Erling Haaland"];
  const response = await fetch(`${backendUrl}/api/players/lookup`, {
    method: "POST",
    headers: {
      ...AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ names }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.players[0].uid, "18004457");
  assert.deepEqual(lastPlayerLookupNames, names);
});

test("GET /api/admin/players returns a filtered player page to administrators", async () => {
  const response = await fetch(
    `${backendUrl}/api/admin/players?q=Kevin&page=1&pageSize=20`,
    { headers: ADMIN_AUTH_HEADER }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.players[0].uid, "18004457");
  assert.equal(payload.players[0].name, "Kevin De Bruyne");
  assert.deepEqual({ ...lastAdminPlayerQuery }, {
    q: "Kevin",
    page: "1",
    pageSize: "20",
  });
});

test("GET /api/admin/players rejects non-admin users", async () => {
  const response = await fetch(`${backendUrl}/api/admin/players`, {
    headers: AUTH_HEADER,
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "FORBIDDEN");
});

test("PATCH /api/admin/players/:uid updates players through the admin service", async () => {
  const player = {
    name: "Kevin De Bruyne",
    club: "Manchester City",
    age: 32,
    nationality: "Belgium",
    position: "M/AM RLC",
    currentAbility: 188,
    potentialAbility: 189,
    marketValue: 300000000,
    salary: 394372,
  };
  const response = await fetch(`${backendUrl}/api/admin/players/18004457`, {
    method: "PATCH",
    headers: {
      ...ADMIN_AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(player),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).player.age, 32);
  assert.deepEqual(lastPlayerUpdate, {
    actorUserId: "admin-user-id",
    playerUid: "18004457",
    input: player,
  });
});

test("PATCH /api/admin/players/:uid rejects non-admin users", async () => {
  const response = await fetch(`${backendUrl}/api/admin/players/18004457`, {
    method: "PATCH",
    headers: {
      ...AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Changed" }),
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
  usageEvents.length = 0;
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
  await new Promise((resolve) => setImmediate(resolve));
  const usageEvent = usageEvents.find(
    (event) => event.endpoint === "/api/ai/analyze"
  );
  assert.equal(usageEvent.provider, "gemini");
  assert.equal(usageEvent.promptTokens, 100);
  assert.equal(usageEvent.outputTokens, 200);
  assert.equal(usageEvent.totalTokens, 300);
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
