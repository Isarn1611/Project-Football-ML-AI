/* 
 * Diagnostic: check whether player images exist in Supabase Storage.
 * Loads backend/.env exactly like build-manifest.cjs and queries:
 *   1) storage buckets (does player-images exist? is it public?)
 *   2) object count in player-images/players
 *   3) sample player rows + their UIDs from the players table
 */
const fs = require("fs");
const path = require("path");
require("../backend/node_modules/dotenv").config({ path: "backend/.env" });
const { createClient } = require("../backend/node_modules/@supabase/supabase-js");

const table = process.env.SUPABASE_PLAYERS_TABLE || "fm_players";
const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;
const keyLabel = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? "service_role"
  : process.env.SUPABASE_PUBLISHABLE_KEY
    ? "publishable"
    : "anon";
const bucket = "player-images";
const folder = "players";

console.log("=== ENV CHECK ===");
console.log("SUPABASE_URL set:", Boolean(url));
console.log("key used:", keyLabel);
console.log("SUPABASE_PLAYERS_TABLE:", table);
console.log("PLAYER_NAME_COLUMN env:", process.env.SUPABASE_PLAYER_NAME_COLUMN || "(empty)");

if (!url || !serviceKey) {
  console.error("ERROR: Missing SUPABASE_URL / SERVICE_ROLE / PUBLISHABLE / ANON key in backend/.env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function checkBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.log("listBuckets error:", error.message);
    return;
  }
  const target = data.find((b) => b.id === bucket);
  console.log("\n=== BUCKETS ===");
  console.log("Total buckets:", data.length);
  console.log(
    "player-images exists:",
    Boolean(target),
    target ? `| public=${target.public}` : ""
  );
}

async function countObjects() {
  let count = 0;
  let from = 0;
  let firstError = null;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: pageSize, offset: from });
    if (error) {
      firstError = error.message;
      break;
    }
    count += data.length;
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  console.log("\n=== STORAGE OBJECTS ===");
  if (firstError) {
    console.log("list('players') error:", firstError);
  } else {
    console.log(`Objects in ${bucket}/${folder}:`, count);
  }
}

async function checkPlayerRows() {
  console.log("\n=== SAMPLE PLAYER ROWS ===");
  const { data, error } = await supabase
    .from(table)
    .select("id,UID,Name,Club")
    .limit(5);
  if (error) {
    console.log("table query error:", error.message);
    return;
  }
  console.log("Sample rows:", data.length);
  for (const row of data) {
    console.log(
      `uid=${String(row.UID || "").trim() || "(none)"} | id=${row.id} | ${row.Name} | ${row.Club}`
    );
  }

  // Try one public URL + HEAD check for the first row that has a UID
  const withUid = data.find((r) => String(r.UID || "").trim());
  if (withUid) {
    const uid = String(withUid.UID).trim();
    const storagePath = `${folder}/${uid}.webp`;
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);
    const publicUrl = publicUrlData?.publicUrl;
    console.log("\n=== SAMPLE PUBLIC URL CHECK ===");
    console.log("Path:", storagePath);
    console.log("Public URL:", publicUrl);

    try {
      const response = await fetch(publicUrl, { method: "GET" });
      console.log("HTTP status:", response.status, response.statusText);
      const contentType = response.headers.get("content-type");
      console.log("Content-Type:", contentType);
      const bodyText = await response.text();
      console.log("Body:", bodyText.slice(0, 300));
    } catch (err) {
      console.log("HTTP fetch error:", err.message);
    }
  }
}

(async () => {
  await checkBuckets();
  await countObjects();
  await checkPlayerRows();
})();

