const fs = require("fs");
const path = require("path");

const srcPath = "supabase/migrations/20241201000000_baseline.sql";
const outDir = "supabase/migrations/.split_baseline";
fs.mkdirSync(outDir, { recursive: true });

const text = fs.readFileSync(srcPath, "utf8");
const lines = text.split("\n");
const limit = 12000;
let chunks = [];
let current = [];
let size = 0;
let inDollar = false;

const flush = () => {
  if (!current.length) return;
  chunks.push(current.join("\n"));
  current = [];
  size = 0;
};

for (const line of lines) {
  current.push(line);
  size += line.length + 1;

  const matches = line.match(/\$\$/g);
  if (matches) {
    if (matches.length % 2 === 1) {
      inDollar = !inDollar;
    }
  }

  const trimmed = line.trim();
  const stmtEnds = !inDollar && trimmed.endsWith(";");
  if (stmtEnds && size >= limit) {
    flush();
  }
}

flush();

chunks.forEach((chunk, idx) => {
  const file = path.join(outDir, `baseline_part_${String(idx + 1).padStart(2, "0")}.sql`);
  fs.writeFileSync(file, chunk, "utf8");
  console.log("wrote", file, chunk.length);
});

console.log("total chunks", chunks.length);
