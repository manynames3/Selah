export function sanitizeSegment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

export function buildObjectKey(prefix, entryDate, filename) {
  const original = String(filename || "file.bin");
  const dot = original.lastIndexOf(".");
  const ext = dot > -1 ? original.slice(dot + 1).toLowerCase() : "bin";
  const stem = dot > -1 ? original.slice(0, dot) : original;
  const safePrefix = sanitizeSegment(prefix || "files");
  const safeDate = sanitizeSegment(entryDate || "undated");
  const safeStem = sanitizeSegment(stem);
  const safeExt = sanitizeSegment(ext);
  return safePrefix + "/" + safeDate + "/" + Date.now() + "-" + safeStem + "." + safeExt;
}

export function buildPublicUrl(baseUrl, key) {
  return String(baseUrl || "").replace(/\/+$/, "") + "/" + String(key || "").split("/").map(encodeURIComponent).join("/");
}

export function extractR2ObjectKeyFromPublicUrl(publicBaseUrl, objectUrl) {
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
