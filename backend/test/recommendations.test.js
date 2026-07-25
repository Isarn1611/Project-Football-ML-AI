const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, test } = require("node:test");

const app = require("../src/app");

let backendServer;
let backendUrl;
let mlServer;
let originalMlApiUrl;

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
            "K-NN (The Clone)": [],
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

  backendServer = http.createServer(app);
  await listen(backendServer);
  const backendAddress = backendServer.address();
  backendUrl = `http://127.0.0.1:${backendAddress.port}`;
});

after(async () => {
  await close(backendServer);
  await close(mlServer);

  if (originalMlApiUrl === undefined) {
    delete process.env.ML_API_URL;
  } else {
    process.env.ML_API_URL = originalMlApiUrl;
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
