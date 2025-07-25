// project/lib/upload.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const axios = require("axios");
const { fileTypeFromStream } = require("file-type");

// 🔐 Cloudflare R2 credentials
const R2_ENDPOINT = "https://79e032ce11db553736bf04e6acde8d21.r2.cloudflarestorage.com";
const BUCKET = "senaldb";
const ACCESS_KEY = "c7c891d949318478f60201ee24ea49c9";
const SECRET_KEY = "bb8c10e792b77c734aaa9984684ee7aa41349f1640b40da4688876ef092b9350";

// 🌐 Create S3 v3 client
const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: false,
});

// 📤 Upload stream or URL to Cloudflare R2
async function uploadToR2(input, filename = "file") {
  try {
    let stream;

    if (typeof input === "string") {
      const response = await axios.get(input, { responseType: "stream" });
      stream = response.data;
    } else {
      stream = input; // Already a stream
    }

    const fileType = await fileTypeFromStream(stream);
    const ext = fileType ? `.${fileType.ext}` : ".bin";
    const contentType = fileType?.mime || "application/octet-stream";
    const key = `${filename}${ext}`;

    const uploadParams = {
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ACL: "public-read",
    };

    const command = new PutObjectCommand(uploadParams);
    await s3.send(command);

    const publicUrl = `${R2_ENDPOINT}/${BUCKET}/${key}`;
    console.log("✅ Uploaded to:", publicUrl);
    return publicUrl;
  } catch (err) {
    console.error("❌ Upload to R2 failed:", err.message);
    return null;
  }
}

module.exports = { uploadToR2 };
