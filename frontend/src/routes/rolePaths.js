export const ADMIN_HOME_PATH = "/admin";
export const USER_HOME_PATH = "/app";

export function getRoleHomePath(role) {
  return role === "admin" ? ADMIN_HOME_PATH : USER_HOME_PATH;
}

export function getPostAuthPath(role, requestedPath = USER_HOME_PATH) {
  if (
    role === "admin" &&
    (requestedPath === USER_HOME_PATH || requestedPath.startsWith("/result"))
  ) {
    return ADMIN_HOME_PATH;
  }

  return requestedPath;
}
