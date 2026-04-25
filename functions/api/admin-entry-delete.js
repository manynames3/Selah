import { requireAdmin, jsonResponse } from "./_auth.js";
import { extractR2ObjectKeyFromPublicUrl } from "./_media.js";
import {
  deleteDevotional,
  deletePublicObjects,
  extractPublicObjectKey,
  fetchDevotional,
  getArtBucketName,
  getAudioBucketName
} from "./_supabase.js";

async function cleanupMedia(env, entry) {
  const cleanup = [];
  const artBucket = getArtBucketName(env);
  const audioBucket = getAudioBucketName(env);
  const audioBase = String(env.AUDIO_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

  if (entry && entry.audio_url) {
    const r2Key = extractR2ObjectKeyFromPublicUrl(audioBase, entry.audio_url);
    if (r2Key && env.AUDIO_BUCKET) {
      cleanup.push(env.AUDIO_BUCKET.delete(r2Key));
    } else {
      const audioKey = extractPublicObjectKey(env, audioBucket, entry.audio_url);
      if (audioKey) cleanup.push(deletePublicObjects(env, audioBucket, [audioKey]));
    }
  }

  if (entry && entry.art_url) {
    const artKey = extractPublicObjectKey(env, artBucket, entry.art_url);
    if (artKey) cleanup.push(deletePublicObjects(env, artBucket, [artKey]));
  }

  return Promise.allSettled(cleanup);
}

export async function onRequestPost(context) {
  const denied = await requireAdmin(context);
  if (denied) return denied;

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ error: "invalid-json" }, { status: 400 });
  }

  const id = String(payload && payload.id || "").trim();
  if (!id) return jsonResponse({ error: "missing-id" }, { status: 400 });

  try {
    const existing = await fetchDevotional(context.env, id);
    if (!existing) {
      return jsonResponse({ error: "not-found" }, { status: 404 });
    }

    await deleteDevotional(context.env, id);
    await cleanupMedia(context.env, existing);
    return jsonResponse({ deleted: true, entry: existing });
  } catch (error) {
    return jsonResponse(
      { error: "entry-delete-failed", message: String(error && error.message || error) },
      { status: 500 }
    );
  }
}
