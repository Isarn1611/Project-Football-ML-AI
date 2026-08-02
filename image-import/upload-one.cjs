const fs = require("fs");
const path = require("path");
require("../backend/node_modules/dotenv").config({ path: "backend/.env" });
const { createClient } = require("../backend/node_modules/@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.error("ERROR: Missing SUPABASE_URL and SERVICE_ROLE/PUBLISHABLE/ANON key");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const targetUid = (process.argv[2] || "").trim();
if (!targetUid) {
  console.error("Usage: node image-import/upload-one.cjs <UID>");
  process.exit(1);
}

const sourceDirs = [
  { key: "player", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/player", matchPriority: ["uid"] },
  { key: "jLeague", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/J.League", matchPriority: ["name"] },
  { key: "wonderkids", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/Wonderkids", matchPriority: ["uid", "name"] },
  { key: "staff", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/staff", matchPriority: ["uid"] },
];

function sniffImageType(buf) {
  if (!buf || buf.length < 12) return "unknown";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "webp";
  }
  return "unknown";
}

function contentTypeFor(type) {
  if (type === "png") return "image/png";
  if (type === "jpeg") return "image/jpeg";
  if (type === "webp") return "image/webp";
  return "application/octet-stream";
}

(async () => {
  // Find source file by UID basename.
  let sourceFile = null;
  for (const source of sourceDirs) {
    if (!fs.existsSync(source.dir)) continue;
    const candidates = fs
      .readdirSync(source.dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .filter((e) => {
        const ext = path.extname(e.name).toLowerCase();
        if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return false;
        return path.basename(e.name, ext) === targetUid;
      })
      .map((e) => path.join(source.dir, e.name));
    if (candidates.length > 0) {
      sourceFile = candidates[0];
      break;
    }
  }

  if (!sourceFile) {
    console.error(`No source image found for UID ${targetUid}`);
    process.exit(1);
  }

  const buf = fs.readFileSync(sourceFile);
  const head = Buffer.alloc(16);
  buf.copy(head, 0, 0, 16);
  const type = sniffImageType(head);
  const contentType = contentTypeFor(type);
  const storagePath = `players/${targetUid}.webp`;

  console.log("Source:", sourceFile);
  console.log("Detected type:", type);
  console.log("Content-Type:", contentType);
  console.log("Storage path:", storagePath);

  const { data, error } = await supabase.storage
    .from("player-images")
    .upload(storagePath, buf, { contentType, upsert: true });

  if (error) {
    console.error("Upload failed:", error.message);
    process.exit(1);
  }

  console.log("Upload success:", data?.path || storagePath);

  const { data: publicData } = supabase.storage
    .from("player-images")
    .getPublicUrl(storagePath);
  const publicUrl = publicData?.publicUrl;
  console.log("Public URL:", publicUrl);

  try {
    const response = await fetch(publicUrl, { method: "GET" });
    const responseContentType = response.headers.get("content-type");
    console.log("HTTP status:", response.status, response.statusText);
    console.log("Response Content-Type:", responseContentType);
    if (response.status === 200) {
      console.log("Image is publicly accessible ✅");
    } else {
      const bodyText = await response.text();
      console.log("Body:", bodyText.slice(0, 300));
    }
  } catch (err) {
    console.error("HTTP fetch error:", err.message);
  }
})();

