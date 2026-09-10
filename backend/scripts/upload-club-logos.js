const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "club-logos";
const LOCAL_DIR = path.resolve(__dirname, "../../frontend/public/club-logos");
const CONCURRENCY = 15;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getAllExistingRemoteFiles() {
  console.log("Fetching existing files in bucket...");
  const existing = new Set();
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      console.warn("Warning listing bucket files:", error.message);
      break;
    }

    if (!data || data.length === 0) break;

    for (const item of data) {
      if (item.name) existing.add(item.name);
    }

    if (data.length < limit) break;
    offset += limit;
  }

  console.log(`Found ${existing.size} already uploaded files in bucket.`);
  return existing;
}

async function uploadSingleFile(filename, retryCount = 0) {
  const filePath = path.join(LOCAL_DIR, filename);
  const fileBuffer = fs.readFileSync(filePath);

  const { error } = await supabase.storage.from(BUCKET).upload(filename, fileBuffer, {
    contentType: "image/png",
    cacheControl: "public, max-age=31536000, immutable",
    upsert: true,
  });

  if (error) {
    if (retryCount < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return uploadSingleFile(filename, retryCount + 1);
    }
    throw error;
  }
}

async function main() {
  console.log("=== STARTING CLUB LOGOS UPLOAD TO SUPABASE ===");
  console.log(`Source directory: ${LOCAL_DIR}`);

  if (!fs.existsSync(LOCAL_DIR)) {
    console.error(`Directory not found: ${LOCAL_DIR}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(LOCAL_DIR).filter((f) => f.endsWith(".png"));
  console.log(`Total local PNG images: ${allFiles.length}`);

  const existingFiles = await getAllExistingRemoteFiles();
  const filesToUpload = allFiles.filter((f) => !existingFiles.has(f));

  console.log(`Files remaining to upload: ${filesToUpload.length}`);

  if (filesToUpload.length === 0) {
    console.log("All files are already uploaded!");
    return;
  }

  let completed = 0;
  let failed = 0;
  const total = filesToUpload.length;
  const startTime = Date.now();

  async function worker(queue) {
    while (queue.length > 0) {
      const file = queue.pop();
      if (!file) break;

      try {
        await uploadSingleFile(file);
        completed++;
        if (completed % 100 === 0 || completed === total) {
          const percent = ((completed / total) * 100).toFixed(1);
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
          const remainingEst = completed > 0
            ? (((Date.now() - startTime) / completed) * (total - completed) / 1000).toFixed(0)
            : 0;
          console.log(
            `[${completed}/${total}] (${percent}%) uploaded | Elapsed: ${elapsedSec}s | ETA: ${remainingEst}s`
          );
        }
      } catch (err) {
        failed++;
        console.error(`Failed to upload ${file}: ${err.message}`);
      }
    }
  }

  const queue = [...filesToUpload];
  const workers = [];

  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(queue));
  }

  await Promise.all(workers);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n=== UPLOAD SUMMARY ===");
  console.log(`Total target: ${total}`);
  console.log(`Successfully uploaded: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time taken: ${durationSec}s`);
  console.log("========================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
