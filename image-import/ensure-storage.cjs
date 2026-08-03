/* 
 * ensure-storage.cjs
 *
 * Creates the `player-images` storage bucket (public) so the ScoutAI frontend
 * can load player photos from Supabase Storage public URLs.
 *
 * Re-running this script is safe (idempotent).
 */
require("../backend/node_modules/dotenv").config({ path: "backend/.env" });
const { createClient } = require("../backend/node_modules/@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

const bucket = "player-images";

if (!url || !serviceKey) {
  console.error(
    "ERROR: Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function ensureBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`listBuckets failed: ${listError.message}`);
  }

  const existing = buckets.find((b) => b.id === bucket);

  if (existing) {
    console.log(
      `Bucket "${bucket}" already exists (public=${existing.public}). Updating to public...`
    );

    const { error: updateError } = await supabase.storage.updateBucket(bucket, {
      public: true,
    });

    if (updateError) {
      throw new Error(`updateBucket failed: ${updateError.message}`);
    }

    console.log(`Bucket "${bucket}" updated to public.`);
  } else {
    const { data, error: createError } = await supabase.storage.createBucket(
      bucket,
      {
        public: true,
      }
    );

    if (createError) {
      throw new Error(`createBucket failed: ${createError.message}`);
    }

    console.log(`Bucket "${bucket}" created (public).`, data || "");
  }
}

async function main() {
  console.log("=== ENSURING STORAGE ===");
  await ensureBucket();
  console.log("\n=== STORAGE READY ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

