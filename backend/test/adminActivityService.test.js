const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  aggregateSearchRows,
  aggregateShortlistRows,
  normalizeActivityListOptions,
} = require("../src/services/adminActivityService");

test("normalizeActivityListOptions clamps pagination and keeps player names", () => {
  assert.deepEqual(
    normalizeActivityListOptions({ page: "0", pageSize: "500", q: "  O'Reilly  " }),
    { page: 1, pageSize: 100, query: "O'Reilly" }
  );
});

test("aggregateShortlistRows ranks players without exposing account ids", () => {
  const items = aggregateShortlistRows([
    {
      user_id: "private-user-1",
      player_uid: "18004457",
      player_name: "Kevin De Bruyne",
      club: "Manchester City",
      position: "M/AM C",
      source: "manual",
      updated_at: "2026-08-20T08:00:00.000Z",
    },
    {
      user_id: "private-user-2",
      player_uid: "18004457",
      player_name: "Kevin De Bruyne",
      club: "Manchester City",
      position: "M/AM C",
      source: "ai shortlist",
      updated_at: "2026-08-21T08:00:00.000Z",
    },
  ]);

  assert.equal(items[0].playerName, "Kevin De Bruyne");
  assert.equal(items[0].savedCount, 2);
  assert.deepEqual(items[0].sourceCounts, { manual: 1, "ai shortlist": 1 });
  assert.equal(Object.hasOwn(items[0], "user_id"), false);
  assert.equal(Object.hasOwn(items[0], "user"), false);
});

test("aggregateSearchRows sums real search counts by player name", () => {
  const items = aggregateSearchRows([
    {
      user_id: "private-user-1",
      query: "Erling Haaland",
      metadata: { playerUid: "19004567" },
      search_count: 4,
      last_searched_at: "2026-08-20T09:00:00.000Z",
    },
    {
      user_id: "private-user-2",
      query: "erling haaland",
      metadata: { playerUid: "19004567" },
      search_count: 3,
      last_searched_at: "2026-08-21T09:00:00.000Z",
    },
  ]);

  assert.equal(items[0].playerName, "erling haaland");
  assert.equal(items[0].searchCount, 7);
  assert.equal(items[0].uniqueAccounts, 2);
  assert.equal(Object.hasOwn(items[0], "user_id"), false);
  assert.equal(Object.hasOwn(items[0], "user"), false);
});
