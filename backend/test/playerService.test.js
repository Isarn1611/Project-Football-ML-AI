const assert = require("node:assert/strict");
const { test } = require("node:test");

const { normalizePlayerNames } = require("../src/services/playerService");

test("normalizePlayerNames cleans, deduplicates, and limits lookup names", () => {
  const names = [" Kevin De Bruyne ", "Kevin De Bruyne", "A", "Erling Haaland"];

  assert.deepEqual(normalizePlayerNames(names), [
    "Kevin De Bruyne",
    "Erling Haaland",
  ]);
});

test("normalizePlayerNames rejects a non-array payload", () => {
  assert.throws(() => normalizePlayerNames("Kevin De Bruyne"), {
    status: 400,
  });
});
