/** HttpOnly session cookie (raw token; DB stores SHA-256 hex). */
export const SESSION_COOKIE = "snd_session";

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export const ROLE_ADMIN = "admin";
export const ROLE_ANALYST = "analyst";
export const ROLE_VIEWER = "viewer";
export const ROLE_OPERATOR = "operator";
