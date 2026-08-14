const fs = require("fs");
const path = require("path");

function createFile(targetMB) {
  // Minimal valid PDF header + padding. pdf-lib may fail to parse but guard.check
  // runs BEFORE parsing, so fixture validity doesn't affect guard tests.
  const header = Buffer.from(
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
    "4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 100 700 Td (Test PDF) Tj ET\nendstream endobj\n" +
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "xref\n0 6\n0000000000 65535 f \n0000000015 00000 n \n0000000062 00000 n \n0000000111 00000 n \n0000000262 00000 n \n0000000357 00000 n \n" +
    "trailer<</Size 6/Root 1 0 R>>\nstartxref\n457\n%%EOF\n"
  );

  const targetBytes = targetMB * 1024 * 1024;
  if (header.length >= targetBytes) return header;

  const pad = Buffer.alloc(targetBytes - header.length);
  for (let i = 0; i < pad.length; i++) pad[i] = i & 0xff;

  return Buffer.concat([header, pad]);
}

function main() {
  const dir = path.join(__dirname, "fixtures");
  fs.mkdirSync(dir, { recursive: true });

  for (const [name, mb] of [
    ["small.pdf", 5],
    ["medium.pdf", 10],
    ["large.pdf", 25],
  ]) {
    console.log(`Creating ${name} (${mb}MB)...`);
    const buf = createFile(mb);
    fs.writeFileSync(path.join(dir, name), buf);
    console.log(`  Created: ${(buf.length / 1024 / 1024).toFixed(2)}MB`);
  }
  console.log("Done!");
}

main();
