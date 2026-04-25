const { S3Client } = require("@aws-sdk/client-s3");

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error("missing-env-" + name);
  return value;
}

function readAudioConfig() {
  return {
    accountId: readRequiredEnv("CF_R2_ACCOUNT_ID"),
    accessKeyId: readRequiredEnv("CF_R2_ACCESS_KEY_ID"),
    secretAccessKey: readRequiredEnv("CF_R2_SECRET_ACCESS_KEY"),
    bucket: readRequiredEnv("CF_R2_AUDIO_BUCKET"),
    publicBaseUrl: readRequiredEnv("CF_R2_AUDIO_PUBLIC_BASE_URL").replace(/\/+$/, ""),
    keyPrefix: (process.env.CF_R2_AUDIO_KEY_PREFIX || "audio").replace(/^\/+|\/+$/g, "")
  };
}

function createR2Client(config) {
  return new S3Client({
    region: "auto",
    endpoint: "https://" + config.accountId + ".r2.cloudflarestorage.com",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

function sanitizeSegment(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

function buildObjectKey(config, entryDate, filename) {
  const original = String(filename || "track.mp3");
  const dot = original.lastIndexOf(".");
  const ext = dot > -1 ? original.slice(dot + 1).toLowerCase() : "bin";
  const stem = dot > -1 ? original.slice(0, dot) : original;
  const safeDate = sanitizeSegment(entryDate || "undated");
  const safeStem = sanitizeSegment(stem);
  return config.keyPrefix + "/" + safeDate + "/" + Date.now() + "-" + safeStem + "." + sanitizeSegment(ext);
}

function buildPublicUrl(publicBaseUrl, objectKey) {
  return publicBaseUrl + "/" + objectKey.split("/").map(encodeURIComponent).join("/");
}

function extractObjectKeyFromPublicUrl(publicBaseUrl, objectUrl) {
  const base = String(publicBaseUrl || "").replace(/\/+$/, "");
  const url = String(objectUrl || "");
  if (!base || !url || url.indexOf(base + "/") !== 0) return null;
  const rawKey = url.slice(base.length + 1).split("?")[0];
  return rawKey.split("/").map(decodeURIComponent).join("/");
}

module.exports = {
  buildObjectKey,
  buildPublicUrl,
  createR2Client,
  extractObjectKeyFromPublicUrl,
  readAudioConfig
};
