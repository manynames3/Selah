const DEFAULT_AUDIO_BUCKET = "devotional-audio";
const DEFAULT_ART_BUCKET = "devotional-art";

function getProjectUrl(env) {
  return String(env.SUPABASE_URL || "").replace(/\/+$/, "");
}

function getServiceRole(env) {
  return env.SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function requireConfig(env) {
  const baseUrl = getProjectUrl(env);
  const serviceRole = getServiceRole(env);
  if (!baseUrl || !serviceRole) throw new Error("missing-supabase-service-role");
  return { baseUrl, serviceRole };
}

function authHeaders(serviceRole, extra) {
  return Object.assign(
    {
      apikey: serviceRole,
      Authorization: "Bearer " + serviceRole
    },
    extra || {}
  );
}

function encodePathSegments(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

async function readJsonOrThrow(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const message = data && (data.error || data.message || data.msg);
    throw new Error(message || ("supabase-" + response.status));
  }
  return data;
}

export function getAudioBucketName(env) {
  return env.SUPABASE_AUDIO_BUCKET || DEFAULT_AUDIO_BUCKET;
}

export function getArtBucketName(env) {
  return env.SUPABASE_ART_BUCKET || DEFAULT_ART_BUCKET;
}

export function buildPublicObjectUrl(env, bucket, objectKey) {
  return getProjectUrl(env) + "/storage/v1/object/public/" + bucket + "/" + encodePathSegments(objectKey);
}

export function extractPublicObjectKey(env, bucket, publicUrl) {
  const prefix = getProjectUrl(env) + "/storage/v1/object/public/" + bucket + "/";
  if (!publicUrl || String(publicUrl).indexOf(prefix) !== 0) return null;
  return decodeURIComponent(String(publicUrl).slice(prefix.length).split("?")[0]);
}

export async function uploadPublicObject(env, bucket, objectKey, body, options) {
  const { baseUrl, serviceRole } = requireConfig(env);
  const headers = authHeaders(serviceRole, {
    "content-type": options && options.contentType ? options.contentType : "application/octet-stream",
    "cache-control": options && options.cacheControl ? options.cacheControl : "3600",
    "x-upsert": options && options.upsert === false ? "false" : "true"
  });
  const res = await fetch(
    baseUrl + "/storage/v1/object/" + bucket + "/" + encodePathSegments(objectKey),
    {
      method: "POST",
      headers,
      body
    }
  );
  await readJsonOrThrow(res);
  return {
    objectKey,
    publicUrl: buildPublicObjectUrl(env, bucket, objectKey)
  };
}

export async function deletePublicObjects(env, bucket, objectKeys) {
  const { baseUrl, serviceRole } = requireConfig(env);
  const keys = (objectKeys || []).filter(Boolean);
  if (!keys.length) return [];
  const res = await fetch(baseUrl + "/storage/v1/object/" + bucket, {
    method: "DELETE",
    headers: authHeaders(serviceRole, { "content-type": "application/json" }),
    body: JSON.stringify({ prefixes: keys })
  });
  await readJsonOrThrow(res);
  return keys;
}

export async function createDevotional(env, payload) {
  const { baseUrl, serviceRole } = requireConfig(env);
  const res = await fetch(baseUrl + "/rest/v1/devotionals", {
    method: "POST",
    headers: authHeaders(serviceRole, {
      "content-type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify(payload)
  });
  const data = await readJsonOrThrow(res);
  return Array.isArray(data) ? data[0] || null : data;
}

export async function fetchDevotional(env, id) {
  const { baseUrl, serviceRole } = requireConfig(env);
  const res = await fetch(
    baseUrl + "/rest/v1/devotionals?select=*&id=eq." + encodeURIComponent(id),
    {
      headers: authHeaders(serviceRole)
    }
  );
  const data = await readJsonOrThrow(res);
  return Array.isArray(data) ? data[0] || null : null;
}

export async function deleteDevotional(env, id) {
  const { baseUrl, serviceRole } = requireConfig(env);
  const res = await fetch(
    baseUrl + "/rest/v1/devotionals?id=eq." + encodeURIComponent(id),
    {
      method: "DELETE",
      headers: authHeaders(serviceRole, { Prefer: "return=representation" })
    }
  );
  const data = await readJsonOrThrow(res);
  return Array.isArray(data) ? data[0] || null : data;
}
