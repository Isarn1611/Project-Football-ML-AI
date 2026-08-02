/* Diagnostic: check source image directories + Supabase key availability. */
const fs = require("fs");
const path = require("path");
require("../backend/node_modules/dotenv").config({ path: "backend/.env" });

const sourceDirs = [
  { key: "player", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/player" },
  { key: "jLeague", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/J.League" },
  { key: "wonderkids", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/Wonderkids" },
  { key: "staff", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/staff" },
];

console.log("=== SOURCE DIRS ===");
for (const source of sourceDirs) {
  const exists = fs.existsSync(source.dir);
  let count = 0;
  if (exists) {
    count = fs
      .readdirSync(source.dir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          [".png", ".jpg", ".jpeg", ".webp"].includes(
            path.extname(entry.name).toLowerCase()
          )
      ).length;
  }
  console.log(`${source.key}: ${exists ? `EXISTS (${count} images)` : "MISSING"}`);
}

console.log("\n=== KEYS (backend/.env) ===");
console.log("SUPABASE_URL set:", Boolean(process.env.SUPABASE_URL));
console.log(
  "SUPABASE_SERVICE_ROLE_KEY set:",
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
);
console.log(
  "SUPABASE_PUBLISHABLE_KEY set:",
  Boolean(process.env.SUPABASE_PUBLISHABLE_KEY)
);
console.log(
  "SUPABASE_ANON_KEY set:",
  Boolean(process.env.SUPABASE_ANON_KEY)
);

