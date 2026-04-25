import { requireAdmin, jsonResponse } from "./_auth.js";
import { buildObjectKey } from "./_media.js";
import { getArtBucketName, uploadPublicObject } from "./_supabase.js";

export async function onRequestPost(context) {
  const denied = await requireAdmin(context);
  if (denied) return denied;

  const url = new URL(context.request.url);
  const filename = context.request.headers.get("x-file-name") || url.searchParams.get("filename") || "art.jpg";
  const entryDate = context.request.headers.get("x-entry-date") || url.searchParams.get("entryDate") || "";
  const contentType = context.request.headers.get("content-type") || "image/jpeg";
  if (!context.request.body) {
    return jsonResponse({ error: "missing-upload-body" }, { status: 400 });
  }

  try {
    const result = await uploadPublicObject(
      context.env,
      getArtBucketName(context.env),
      buildObjectKey(context.env.SUPABASE_ART_KEY_PREFIX || "art", entryDate, filename),
      context.request.body,
      { contentType, upsert: true }
    );
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse(
      { error: "art-upload-failed", message: String(error && error.message || error) },
      { status: 500 }
    );
  }
}
