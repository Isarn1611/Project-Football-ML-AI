function identityTimestamp(identity) {
  const timestamp = new Date(
    identity?.last_sign_in_at ||
      identity?.updated_at ||
      identity?.created_at ||
      0,
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

const ACTIVE_AUTH_PROVIDER_KEY = "scoutai.activeAuthProvider";
const PENDING_AUTH_PROVIDER_KEY = "scoutai.pendingAuthProvider";

function readSessionValue(key) {
  try {
    return window.sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSessionValue(key, value) {
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Authentication must continue when session storage is unavailable.
  }
}

export function setPendingAuthProvider(provider) {
  writeSessionValue(PENDING_AUTH_PROVIDER_KEY, provider);
}

export function clearPendingAuthProvider() {
  writeSessionValue(PENDING_AUTH_PROVIDER_KEY, "");
}

export function getPendingAuthProvider() {
  return readSessionValue(PENDING_AUTH_PROVIDER_KEY);
}

export function activateAuthProvider(provider) {
  writeSessionValue(ACTIVE_AUTH_PROVIDER_KEY, provider);
  clearPendingAuthProvider();
}

export function getActiveAuthProvider() {
  return readSessionValue(ACTIVE_AUTH_PROVIDER_KEY);
}

export function clearActiveAuthProvider() {
  writeSessionValue(ACTIVE_AUTH_PROVIDER_KEY, "");
  clearPendingAuthProvider();
}

export function getUserAvatarUrl(user, requestedProvider) {
  if (!user) return "";
  if (Object.hasOwn(user, "avatarUrl") && !user.identities) {
    return user.provider === "email" ? "" : user.avatarUrl || "";
  }

  const userMetadata = user.user_metadata || {};
  const provider =
    requestedProvider ||
    getActiveAuthProvider() ||
    userMetadata.last_sign_in_provider ||
    user.provider ||
    user.app_metadata?.provider ||
    "";
  const identities = [...(user.identities || [])];
  const providerIdentity = identities.find(
    (identity) => identity.provider === provider,
  );
  const latestIdentity = identities.sort(
    (left, right) => identityTimestamp(right) - identityTimestamp(left),
  )[0];
  const identityData = providerIdentity?.identity_data || {};

  if (provider === "email") return "";

  return (
    identityData.avatar_url ||
    identityData.picture ||
    user.avatarUrl ||
    userMetadata.avatar_url ||
    userMetadata.picture ||
    latestIdentity?.identity_data?.avatar_url ||
    latestIdentity?.identity_data?.picture ||
    ""
  );
}
