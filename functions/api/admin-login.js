import { createAdminSessionCookie, jsonResponse } from "./_auth.js";

export async function onRequestPost(context) {
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ error: "invalid-json" }, { status: 400 });
  }

  const expected = String(context.env.ADMIN_PASSWORD || "");
  const provided = String(payload && payload.password || "");
  if (!expected) {
    return jsonResponse({ error: "missing-admin-password" }, { status: 500 });
  }
  if (!provided || provided !== expected) {
    return jsonResponse({ error: "invalid-password" }, { status: 401 });
  }

  const cookie = await createAdminSessionCookie(context.env);
  return jsonResponse(
    { authenticated: true },
    {
      headers: {
        "set-cookie": cookie
      }
    }
  );
}
