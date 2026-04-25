const SESSION_COOKIE_NAME = "selah_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const textEncoder = new TextEncoder();

function noStoreHeaders(extra) {
  return Object.assign({ "cache-control": "no-store" }, extra || {});
}

function getSecret(env) {
  return env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || "";
}

function parseCookies(header) {
  return String(header || "")
    .split(/;\s*/)
    .filter(Boolean)
    .reduce((acc, part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return acc;
      const key = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function toBase64Url(input) {
  const bytes = input instanceof Uint8Array ? input : textEncoder.encode(String(input || ""));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function signValue(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function buildCookie(value, maxAge) {
  return [
    SESSION_COOKIE_NAME + "=" + value,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=" + maxAge
  ].join("; ");
}

export function jsonResponse(body, init) {
  const responseInit = Object.assign({}, init || {});
  responseInit.headers = noStoreHeaders(responseInit.headers);
  return Response.json(body, responseInit);
}

export function clearAdminSessionCookie() {
  return buildCookie("", 0);
}

export async function createAdminSessionCookie(env) {
  const secret = getSecret(env);
  if (!secret) throw new Error("missing-admin-session-secret");
  const payload = {
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = await signValue(encoded, secret);
  return buildCookie(encoded + "." + signature, SESSION_TTL_SECONDS);
}

export async function isAdminAuthenticated(context) {
  const secret = getSecret(context.env || {});
  if (!secret) return false;
  const cookies = parseCookies(context.request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token || token.indexOf(".") < 0) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const payloadPart = parts[0];
  const signaturePart = parts[1];
  const expected = await signValue(payloadPart, secret);
  if (!constantTimeEqual(signaturePart, expected)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart)));
    return !!(payload && payload.exp && payload.exp > Date.now());
  } catch {
    return false;
  }
}

export async function requireAdmin(context) {
  if (await isAdminAuthenticated(context)) return null;
  return jsonResponse({ error: "unauthorized" }, { status: 401 });
}
