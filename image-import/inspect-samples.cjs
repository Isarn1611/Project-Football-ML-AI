/* Inspect sample files to determine real image types (magic bytes). */
const fs = require("fs");
const path = require("path");

const dir = "C:/Users/rifz7/Downloads/01. ASF 23/01. ASF 23/player";

function sniff(buf) {
  if (!buf || buf.length < 12) return "unknown/small";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
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
  return "other";
}

const entries = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isFile());
const counts = { png: 0, jpeg: 0, webp: 0, other: 0, unknown: 0 };
const extCounts = {};
const cap = Math.min(entries.length, 200);
const samples = [];

for (let i = 0; i < cap; i++) {
  const name = entries[i].name;
  const ext = path.extname(name).toLowerCase();
  extCounts[ext] = (extCounts[ext] || 0) + 1;
  const full = path.join(dir, name);
  const fd = fs.openSync(full, "r");
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  const type = sniff(buf);
  counts[type] = (counts[type] || 0) + 1;
  if (samples.length < 8) {
    samples.push({ name, ext, type });
  }
}

console.log("Total files:", entries.length);
console.log("Sample cap:", cap);
console.log("Detected types (first", cap, "files):", counts);
console.log("Extensions (first", cap, "files):", extCounts);
console.log("Samples:");
for (const s of samples) {
  console.log(`  ${s.name} -> ext=${s.ext} magic=${s.type}`);
}

