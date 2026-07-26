const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, test } = require("node:test");

const app = require("../src/app");

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
  title: "รายงานวิเคราะห์ Kevin De Bruyne",
  executiveSummary: "นักเตะเป้าหมายมีจุดเด่นด้านการสร้างสรรค์เกม",
  targetProfile: {
    playStyle: "เพลย์เมกเกอร์ที่สร้างโอกาสจากแดนกลาง",
    strengths: ["Passing และ Vision สูง"],
    weaknesses: ["ต้องประเมินข้อมูลเกมรับเพิ่มเติม"],
    risks: ["ผลวิเคราะห์อ้างอิงจากชุดข้อมูลที่ให้มา"],
  },
  recommendations: [
    {
      playerName: "Candidate One",
      fitSummary: "มีรูปแบบการจ่ายบอลใกล้เคียง",
      reasons: ["ติดอันดับจาก K-NN"],
      concerns: ["PA ต่ำกว่าเป้าหมาย"],
    },
  ],
  bestChoices: {
    overall: "Candidate One",
    styleMatch: "Candidate One",
    value: "Candidate One",
    potential: "Candidate One",
  },
  confidenceNote: "ML similarity ไม่ได้รับประกันผลงานในอนาคต",
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
  assert.equal(payload.analysis.title, mockAnalysis.title);
  assert.equal(payload.usage.totalTokens, 300);
  assert.equal(lastGeminiRequest.apiKey, "test-gemini-key");
  assert.equal(
    lastGeminiRequest.body.generationConfig.responseMimeType,
    "application/json"
  );

  const scoutContext = JSON.parse(
    lastGeminiRequest.body.contents[0].parts[0].text
  );
  assert.equal(scoutContext.target.name, "Kevin De Bruyne");
  assert.equal(scoutContext.candidates[0].name, "Candidate One");
  assert.equal(scoutContext.candidates[0].evidence[0].score, 87.5);
});

test("POST /api/ai/analyze validates playerName before calling Gemini", async () => {
  const response = await fetch(`${backendUrl}/api/ai/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: " ",
    }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_PLAYER_NAME");
});
