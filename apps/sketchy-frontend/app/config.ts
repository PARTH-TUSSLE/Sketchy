const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
const currentHost = typeof window !== "undefined" ? window.location.host : "";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_HTTP_URL ||
  (typeof window !== "undefined"
    ? `${isHttps ? "https" : "http"}://${currentHost}/api`
    : "http://localhost:8380");

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== "undefined"
    ? `${isHttps ? "wss" : "ws"}://${currentHost}/ws`
    : "ws://localhost:8381");