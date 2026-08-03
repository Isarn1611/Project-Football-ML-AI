const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  formatAdminUser,
  normalizeUserListOptions,
  updateAdminUserRole,
  updateAdminUserSuspension,
} = require("../src/services/adminService");

test("formatAdminUser uses the provider recorded by the login flow", () => {
  const user = formatAdminUser({
    id: "11111111-1111-4111-8111-111111111111",
    email: "member@example.com",
    app_metadata: { provider: "email" },
    user_metadata: { last_sign_in_provider: "google" },
    identities: [
      {
        provider: "github",
        last_sign_in_at: "2026-08-01T00:00:00.000Z",
        identity_data: {
          avatar_url: "https://avatars.example.com/github.png",
          user_name: "member-github",
        },
      },
      {
        provider: "google",
        last_sign_in_at: "2026-07-30T00:00:00.000Z",
        identity_data: {
          avatar_url: "https://avatars.example.com/google.png",
          full_name: "Google Member",
        },
      },
    ],
  });

  assert.equal(user.provider, "google");
  assert.equal(user.displayName, "Google Member");
  assert.equal(user.avatarUrl, "https://avatars.example.com/google.png");
});

test("formatAdminUser does not reuse an OAuth avatar for an email login", () => {
  const user = formatAdminUser({
    id: "11111111-1111-4111-8111-111111111111",
    email: "member@example.com",
    app_metadata: { provider: "github" },
    user_metadata: {
      avatar_url: "https://avatars.example.com/github.png",
      last_sign_in_provider: "email",
    },
    identities: [
      {
        provider: "github",
        identity_data: {
          avatar_url: "https://avatars.example.com/github.png",
        },
      },
    ],
  });

  assert.equal(user.provider, "email");
  assert.equal(user.avatarUrl, null);
});

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
