const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  normalizeAdminPlayerInput,
  normalizePlayerListOptions,
  validatePlayerUid,
} = require("../src/services/adminPlayerService");

test("normalizePlayerListOptions clamps pagination and sanitizes search", () => {
  assert.deepEqual(
    normalizePlayerListOptions({
      page: "0",
      pageSize: "500",
      q: "  Kevin,De%Bruyne*  ",
    }),
    {
      page: 1,
      pageSize: 100,
      query: "KevinDeBruyne",
    }
  );
});

test("normalizeAdminPlayerInput returns only approved database fields", () => {
  assert.deepEqual(
    normalizeAdminPlayerInput({
      name: " Kevin De Bruyne ",
      club: " Manchester City ",
      age: "32",
      nationality: " Belgium ",
      position: " M/AM RLC ",
      currentAbility: "188",
      potentialAbility: 189,
      marketValue: "300000000",
      salary: 394372,
      raw: { Tackling: 1 },
    }),
    {
      Club: "Manchester City",
      Age: 32,
      Nationality: "Belgium",
      Position: "M/AM RLC",
      ca: 188,
      pa: 189,
      Values: 300000000,
      Salary: 394372,
    }
  );
});

test("normalizeAdminPlayerInput rejects invalid ability values", () => {
  assert.throws(
    () =>
      normalizeAdminPlayerInput({
        name: "Player",
        club: "Club",
        age: 22,
        nationality: "Thailand",
        position: "ST",
        currentAbility: 201,
        potentialAbility: 180,
        marketValue: 1000000,
        salary: 10000,
      }),
    { code: "INVALID_PLAYER_DATA", status: 400 }
  );
});

test("validatePlayerUid accepts numeric Football Manager UIDs only", () => {
  assert.equal(validatePlayerUid(" 18004457 "), "18004457");
  assert.throws(() => validatePlayerUid("player-1"), {
    code: "INVALID_PLAYER_UID",
    status: 400,
  });
});
