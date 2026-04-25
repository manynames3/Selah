const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  buildObjectKey,
  buildPublicUrl,
  createR2Client,
  readAudioConfig
} = require("./_r2");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "method-not-allowed" })
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const config = readAudioConfig();
    const contentType = payload.contentType || "application/octet-stream";
    const objectKey = buildObjectKey(config, payload.entryDate, payload.filename);
    const client = createR2Client(config);
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: contentType
    });
    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        uploadUrl,
        publicUrl: buildPublicUrl(config.publicBaseUrl, objectKey),
        objectKey,
        contentType,
        expiresIn
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "r2-presign-failed", message: String(err && err.message || err) })
    };
  }
};
