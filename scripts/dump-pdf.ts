import { dumpPdf } from "../src/lib/pdf/dumpPdf.ts";
import fs from "fs";
import path from "path";

const file = process.argv[2];
if (!file) {
  console.log("Usage: npx tsx scripts/dump-pdf.ts <path-to-pdf>");
  process.exit(1);
}

const abs = path.isAbsolute(file) ? file : path.resolve(file);
const bytes = new Uint8Array(fs.readFileSync(abs));
const dump = await dumpPdf(bytes);

// Strip imageBytes for readable output
const clean = JSON.stringify(dump, (k, v) => {
  if (k === "imageBytes") return `<${(v as Uint8Array).length} bytes>`;
  return v;
}, 2);

console.log(clean);
