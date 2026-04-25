function extractObjectKeyFromPublicUrl(publicBaseUrl, objectUrl) {
  const base = String(publicBaseUrl || "").replace(/\/+$/, "");
  const url = String(objectUrl || "");
  if (!base || !url || !url.startsWith(base + "/")) return null;
  return url
    .slice(base.length + 1)
    .split("?")[0]
    .split("/")
    .map(decodeURIComponent)
    .join("/");
}

export async function onRequestPost(context) {
  const bucket = context.env.AUDIO_BUCKET;
  const publicBaseUrl = context.env.AUDIO_PUBLIC_BASE_URL;

  if (!bucket || !publicBaseUrl) {
    return Response.json({ error: "missing-r2-binding" }, { status: 500 });
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const objectKey = extractObjectKeyFromPublicUrl(publicBaseUrl, payload && payload.url);
  if (!objectKey) {
    return Response.json({ error: "invalid-public-url" }, { status: 400 });
  }

  try {
    await bucket.delete(objectKey);
    return Response.json({ deleted: true, objectKey });
  } catch (error) {
    return Response.json(
      { error: "audio-delete-failed", message: String(error && error.message || error) },
      { status: 500 }
    );
  }
}
