const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  normalizeUserListOptions,
  updateAdminUserRole,
  updateAdminUserSuspension,
} = require("../src/services/adminService");

test("normalizeUserListOptions clamps pagination and cleans search input", () => {
  assert.deepEqual(
    normalizeUserListOptions({
      page: "0",
      pageSize: "999",
      q: `  ${"a".repeat(120)}  `,
    }),
    {
      page: 1,
      pageSize: 100,
      query: "a".repeat(100),
    }
  );
});

test("updateAdminUserRole rejects invalid roles before contacting Supabase", async () => {
  await assert.rejects(
    updateAdminUserRole(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "owner"
    ),
    { code: "INVALID_USER_ROLE", status: 400 }
  );
});

test("updateAdminUserRole prevents administrators from demoting themselves", async () => {
  const adminId = "11111111-1111-4111-8111-111111111111";

  await assert.rejects(updateAdminUserRole(adminId, adminId, "user"), {
    code: "CANNOT_CHANGE_OWN_ROLE",
    status: 400,
  });
});

test("updateAdminUserSuspension prevents administrators from suspending themselves", async () => {
  const adminId = "11111111-1111-4111-8111-111111111111";

  await assert.rejects(
    updateAdminUserSuspension(adminId, adminId, true, "Testing"),
    {
      code: "CANNOT_SUSPEND_SELF",
      status: 400,
    }
  );
});
