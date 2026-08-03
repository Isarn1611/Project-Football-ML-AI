const assert = require("node:assert/strict");
const { test } = require("node:test");

const { nonNegativeInteger } = require("../src/services/usageService");

test("nonNegativeInteger normalizes token and duration values", () => {
  assert.equal(nonNegativeInteger(42.4), 42);
  assert.equal(nonNegativeInteger("100"), 100);
  assert.equal(nonNegativeInteger(-1), 0);
  assert.equal(nonNegativeInteger(null), 0);
  assert.equal(nonNegativeInteger("invalid"), 0);
});
