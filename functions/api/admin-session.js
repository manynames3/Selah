import { isAdminAuthenticated, jsonResponse } from "./_auth.js";

export async function onRequestGet(context) {
  return jsonResponse({ authenticated: await isAdminAuthenticated(context) });
}
