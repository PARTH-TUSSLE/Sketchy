import axios from "axios";
import { BACKEND_URL } from "../config";

const TOKEN_KEY = "sketchy_token";
const REFRESH_KEY = "sketchy_refresh";
// Matches the server's access-token lifetime ("2h"). Renew ahead of expiry so
// an idle tab never hard-stops with a dead token.
const ACCESS_LIFETIME_MS = 2 * 60 * 60 * 1000;
const REFRESH_WINDOW_MS = 60_000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export interface Session {
  token: string;
  refreshToken: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function getUserIdFromToken(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(TOKEN_KEY, session.token);
    window.localStorage.setItem(REFRESH_KEY, session.refreshToken);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  }
}

export function clearSession() {
  setSession(null);
}

// Milliseconds until the access token expires (0 if dead, Infinity if unknown).
export function tokenLifetimeMs(token: string | null): number {
  if (!token) return Infinity;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    const ms = (Number(payload?.exp) || 0) * 1000 - Date.now();
    return ms > 0 ? ms : 0;
  } catch {
    return ACCESS_LIFETIME_MS;
  }
}

// Swap the current tokens for a fresh pair via /auth/refresh. Returns true when
// a new session was stored.
export async function renewSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await axios.post(`${BACKEND_URL}/auth/refresh`, { refreshToken });
    setSession({ token: res.data.token, refreshToken: res.data.refreshToken });
    return true;
  } catch {
    return false;
  }
}

// A usable access token, refreshed transparently when missing or nearly dead.
export async function ensureFreshToken(): Promise<string | null> {
  const token = getToken();
  if (token && tokenLifetimeMs(token) > REFRESH_WINDOW_MS) return token;
  const ok = await renewSession();
  return ok ? getToken() : null;
}

// Keep the session alive in the background, renewing shortly before each
// access token lapses and chaining onto the next one after every renewal.
export function scheduleTokenRefresh() {
  if (typeof window === "undefined") return;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const token = getToken();
  if (!token) return;

  const lifetime = tokenLifetimeMs(token);
  if (lifetime <= 0) {
    // Already dead — try to resurrect the session once, then reschedule.
    renewSession().then((ok) => {
      if (ok) scheduleTokenRefresh();
    });
    return;
  }

  const delay = Math.max(0, lifetime - REFRESH_WINDOW_MS);
  refreshTimer = setTimeout(() => {
    renewSession().then((ok) => {
      if (ok) scheduleTokenRefresh();
      else refreshTimer = null;
    });
  }, Math.min(delay, Number.MAX_SAFE_INTEGER));
}

export function withAuth(path: string): string {
  const token = getToken();
  if (!token) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}token=${encodeURIComponent(token)}`;
}