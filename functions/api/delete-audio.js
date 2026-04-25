import { requireAdmin, jsonResponse } from "./_auth.js";
import { extractR2ObjectKeyFromPublicUrl } from "./_media.js";
import { deletePublicObjects, extractPublicObjectKey, getAudioBucketName } from "./_supabase.js";

export async function onRequestPost(context) {
  const denied = await requireAdmin(context);
  if (denied) return denied;

  const bucket = context.env.AUDIO_BUCKET;
  const publicBaseUrl = context.env.AUDIO_PUBLIC_BASE_URL;
  const audioBucket = getAudioBucketName(context.env);

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ error: "invalid-json" }, { status: 400 });
  }

  try {
    const audioUrl = payload && payload.url;
    const r2Key = extractR2ObjectKeyFromPublicUrl(publicBaseUrl, audioUrl);
    if (bucket && r2Key) {
      await bucket.delete(r2Key);
      return jsonResponse({ deleted: true, objectKey: r2Key });
    }

    const supabaseKey = extractPublicObjectKey(context.env, audioBucket, audioUrl);
    if (supabaseKey) {
      await deletePublicObjects(context.env, audioBucket, [supabaseKey]);
      return jsonResponse({ deleted: true, objectKey: supabaseKey });
    }

    return jsonResponse({ error: "invalid-public-url" }, { status: 400 });
  } catch (error) {
    return jsonResponse(
      { error: "audio-delete-failed", message: String(error && error.message || error) },
      { status: 500 }
    );
  }
}
