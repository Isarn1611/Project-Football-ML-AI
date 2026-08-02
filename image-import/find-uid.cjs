/* Find the source image files (by basename) for a given UID in all source dirs. */
const fs = require("fs");
const path = require("path");

const targetUid = process.argv[2] || "18004457";

const sourceDirs = [
  { key: "player", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/player" },
  { key: "jLeague", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/J.League" },
  { key: "wonderkids", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/Wonderkids" },
  { key: "staff", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/staff" },
];

for (const source of sourceDirs) {
  if (!fs.existsSync(source.dir)) continue;
  const files = fs.readdirSync(source.dir, { withFileTypes: true });
  const matches = files
    .filter((e) => {
      if (!e.isFile()) return false;
      const ext = path.extname(e.name).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return false;
      return path.basename(e.name, ext) === targetUid;
    })
    .map((e) => path.join(source.dir, e.name));

  if (matches.length) {
    console.log(`[${source.key}]`);
    for (const m of matches) {
      console.log("  ", m);
    }
  }
}

