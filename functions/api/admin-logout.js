import { clearAdminSessionCookie, jsonResponse } from "./_auth.js";

export async function onRequestPost() {
  return jsonResponse(
    { authenticated: false },
    {
      headers: {
        "set-cookie": clearAdminSessionCookie()
      }
    }
  );
}
