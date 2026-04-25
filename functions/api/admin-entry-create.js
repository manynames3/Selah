import { requireAdmin, jsonResponse } from "./_auth.js";
import { createDevotional } from "./_supabase.js";

export async function onRequestPost(context) {
  const denied = await requireAdmin(context);
  if (denied) return denied;

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ error: "invalid-json" }, { status: 400 });
  }

  const title = String(payload && payload.title || "").trim();
  const entryDate = String(payload && payload.entry_date || "").trim();
  if (!title || !entryDate) {
    return jsonResponse({ error: "missing-required-fields" }, { status: 400 });
  }

  try {
    const row = await createDevotional(context.env, {
      title,
      entry_date: entryDate,
      scripture: payload && payload.scripture ? String(payload.scripture).trim() : null,
      lyrics: payload && payload.lyrics ? String(payload.lyrics) : null,
      audio_url: payload && payload.audio_url ? String(payload.audio_url) : null,
      art_url: payload && payload.art_url ? String(payload.art_url) : null
    });
    return jsonResponse({ entry: row });
  } catch (error) {
    return jsonResponse(
      { error: "entry-create-failed", message: String(error && error.message || error) },
      { status: 500 }
    );
  }
}
