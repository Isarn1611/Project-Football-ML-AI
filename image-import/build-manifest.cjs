const fs = require("fs");
const path = require("path");
require("../backend/node_modules/dotenv").config({ path: "backend/.env" });
const { createClient } = require("../backend/node_modules/@supabase/supabase-js");

const table = process.env.SUPABASE_PLAYERS_TABLE || "fm_players";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);
const sourceDirs = [
  { key: "player", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/player", matchPriority: ["uid"], preferBasename: true },
  { key: "jLeague", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/J.League", matchPriority: ["name"] },
  { key: "wonderkids", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/Wonderkids", matchPriority: ["uid", "name"] },
  { key: "staff", dir: "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/staff", matchPriority: ["uid"] },
];

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Detect image type by magic bytes. */
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return "unknown";
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  // RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
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

async function fetchRows() {
  let from = 0;
  const pageSize = 1000;
  const rows = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id,UID,Name,Club,Position")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

(async () => {
  const rows = await fetchRows();
  const byUid = new Map();
  const nameBuckets = new Map();
  for (const row of rows) {
    const uid = String(row.UID || "").trim();
    if (uid) byUid.set(uid, row);
    const normalized = normalizeName(row.Name);
    if (normalized) {
      const bucket = nameBuckets.get(normalized) || [];
      bucket.push(row);
      nameBuckets.set(normalized, bucket);
    }
  }

  const matchedByRowId = new Map();
  const unmatchedFiles = [];
  const duplicateNameFiles = [];
  const skippedNonImages = [];
  const ignoredResultVariants = [];

  for (const source of sourceDirs) {
    const files = fs
      .readdirSync(source.dir, { withFileTypes: true })
      .filter((entry) => entry.isFile());
    for (const entry of files) {
      const ext = path.extname(entry.name).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
        skippedNonImages.push({ source: source.key, file: entry.name });
        continue;
      }

      const base = path.basename(entry.name, ext);

      // Skip "{uid}_result.png" variant when the clean "{uid}.png" is present.
      // They are duplicate renders and should not override the main image.
      if (source.preferBasename && /\_result$/i.test(base)) {
        ignoredResultVariants.push({ source: source.key, file: entry.name });
        continue;
      }

      let row = null;
      let matchType = "";
      for (const matcher of source.matchPriority) {
        if (matcher === "uid" && byUid.has(base)) {
          row = byUid.get(base);
          matchType = "uid";
          break;
        }
        if (matcher === "name") {
          const candidates = nameBuckets.get(normalizeName(base)) || [];
          if (candidates.length === 1) {
            row = candidates[0];
            matchType = "name";
            break;
          }
          if (candidates.length > 1) {
            duplicateNameFiles.push({
              source: source.key,
              file: entry.name,
              candidateCount: candidates.length,
            });
            break;
          }
        }
      }
      if (!row) {
        unmatchedFiles.push({ source: source.key, file: entry.name });
        continue;
      }

      const rowId = String(row.id);
      if (matchedByRowId.has(rowId) && matchedByRowId.get(rowId).matchType === "uid") {
        continue;
      }

      const sourceFile = path.join(source.dir, entry.name);
      const fd = fs.openSync(sourceFile, "r");
      const head = Buffer.alloc(16);
      fs.readSync(fd, head, 0, 16, 0);
      fs.closeSync(fd);
      const imageType = sniffImageType(head);

      // Keep the canonical ".webp" path that the frontend already builds URLs
      // with, but store the real content-type so browsers decode the bytes
      // correctly regardless of the extension.
      const storagePath = `players/${String(row.UID || row.id).trim()}.webp`;
      const contentType = contentTypeFor(imageType);

      matchedByRowId.set(rowId, {
        id: row.id,
        uid: row.UID,
        name: row.Name,
        club: row.Club,
        position: row.Position,
        source: source.key,
        sourceFile,
        matchType,
        storagePath,
        imageType,
        contentType,
        imageAlt: `${row.Name} player profile image`,
      });
    }
  }

  async function uploadImages(items) {
    console.log(`Start uploading ${items.length} images`);

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (index % 200 === 0) {
        console.log(`Progress: ${index}/${items.length}`);
      }

      const fileBuffer = fs.readFileSync(item.sourceFile);

      const { error } = await supabase.storage
        .from("player-images")
        .upload(item.storagePath, fileBuffer, {
          contentType: item.contentType,
          upsert: true,
        });

      if (error) {
        console.log("Upload failed:", item.storagePath, error.message);
      } else {
        if (index % 200 === 0) {
          console.log("Uploaded:", item.storagePath);
        }
      }
    }

    console.log("Upload finished");
  }

  const matched = [...matchedByRowId.values()].sort((a, b) =>
    String(a.uid || "").localeCompare(String(b.uid || ""))
  );
  const matchedIds = new Set(matched.map((item) => String(item.id)));
  const rowsWithoutImages = rows
    .filter((row) => !matchedIds.has(String(row.id)))
    .map((row) => ({
      id: row.id,
      uid: row.UID,
      name: row.Name,
      imageAlt: `No player image available for ${row.Name}`,
    }));
  const manifest = {
    generatedAt: new Date().toISOString(),
    table,
    bucket: "player-images",
    rows: rows.length,
    matched: matched.length,
    rowsWithoutImages: rowsWithoutImages.length,
    unmatchedFiles: unmatchedFiles.length,
    duplicateNameFiles: duplicateNameFiles.length,
    ignoredResultVariants: ignoredResultVariants.length,
    skippedNonImages: skippedNonImages.length,
    items: matched,
    altOnlyRows: rowsWithoutImages,
  };
  fs.writeFileSync("image-import/manifest.json", JSON.stringify(manifest, null, 2));
  fs.writeFileSync(
    "image-import/matched.csv",
    [
      "id,uid,name,source,matchType,sourceFile,storagePath,contentType,imageAlt",
      ...matched.map((item) =>
        [
          item.id,
          item.uid,
          item.name,
          item.source,
          item.matchType,
          item.sourceFile,
          item.storagePath,
          item.contentType,
          item.imageAlt,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n")
  );
  fs.writeFileSync(
    "image-import/alt-only.csv",
    [
      "id,uid,name,imageAlt",
      ...rowsWithoutImages.map((item) =>
        [item.id, item.uid, item.name, item.imageAlt].map(csvEscape).join(",")
      ),
    ].join("\n")
  );
  fs.writeFileSync(
    "image-import/unmatched-files.csv",
    ["source,file", ...unmatchedFiles.map((item) => [item.source, item.file].map(csvEscape).join(","))].join("\n")
  );
  fs.writeFileSync(
    "image-import/duplicate-name-files.csv",
    [
      "source,file,candidateCount",
      ...duplicateNameFiles.map((item) =>
        [item.source, item.file, item.candidateCount].map(csvEscape).join(",")
      ),
    ].join("\n")
  );
  fs.writeFileSync(
    "image-import/skipped-non-images.csv",
    ["source,file", ...skippedNonImages.map((item) => [item.source, item.file].map(csvEscape).join(","))].join("\n")
  );

  await uploadImages(matched);

  console.log(
    JSON.stringify(
      {
        matched: matched.length,
        rowsWithoutImages: rowsWithoutImages.length,
        unmatchedFiles: unmatchedFiles.length,
        duplicateNameFiles: duplicateNameFiles.length,
        ignoredResultVariants: ignoredResultVariants.length,
        skippedNonImages: skippedNonImages.length,
      },
      null,
      2
    )
  );
})();

