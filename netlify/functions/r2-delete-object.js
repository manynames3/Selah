const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const {
  createR2Client,
  extractObjectKeyFromPublicUrl,
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
    const objectKey = extractObjectKeyFromPublicUrl(config.publicBaseUrl, payload.url);

    if (!objectKey) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "invalid-public-url" })
      };
    }

    const client = createR2Client(config);
    await client.send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: objectKey
    }));

    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ deleted: true, objectKey })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "r2-delete-failed", message: String(err && err.message || err) })
    };
  }
};
