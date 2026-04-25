function sanitizeSegment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

function buildObjectKey(prefix, entryDate, filename) {
  const original = String(filename || "track.mp3");
  const dot = original.lastIndexOf(".");
  const ext = dot > -1 ? original.slice(dot + 1).toLowerCase() : "bin";
  const stem = dot > -1 ? original.slice(0, dot) : original;
  const safeDate = sanitizeSegment(entryDate || "undated");
  const safeStem = sanitizeSegment(stem);
  const safePrefix = sanitizeSegment(prefix || "audio");
  return safePrefix + "/" + safeDate + "/" + Date.now() + "-" + safeStem + "." + sanitizeSegment(ext);
}

function buildPublicUrl(baseUrl, key) {
  return String(baseUrl || "").replace(/\/+$/, "") + "/" + key.split("/").map(encodeURIComponent).join("/");
}

export async function onRequestPost(context) {
  const bucket = context.env.AUDIO_BUCKET;
  const publicBaseUrl = context.env.AUDIO_PUBLIC_BASE_URL;
  const keyPrefix = context.env.AUDIO_KEY_PREFIX || "audio";

  if (!bucket || !publicBaseUrl) {
    return Response.json({ error: "missing-r2-binding" }, { status: 500 });
  }

  const url = new URL(context.request.url);
  const filename = context.request.headers.get("x-file-name") || url.searchParams.get("filename") || "track.mp3";
  const entryDate = context.request.headers.get("x-entry-date") || url.searchParams.get("entryDate") || "";
  const contentType = context.request.headers.get("content-type") || "application/octet-stream";

  if (!context.request.body) {
    return Response.json({ error: "missing-upload-body" }, { status: 400 });
  }

  const objectKey = buildObjectKey(keyPrefix, entryDate, filename);

  try {
    await bucket.put(objectKey, context.request.body, {
      httpMetadata: { contentType }
    });

    return Response.json({
      objectKey,
      publicUrl: buildPublicUrl(publicBaseUrl, objectKey)
    });
  } catch (error) {
    return Response.json(
      { error: "audio-upload-failed", message: String(error && error.message || error) },
      { status: 500 }
    );
  }
}
