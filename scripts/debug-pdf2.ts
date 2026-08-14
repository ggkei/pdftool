import { PDFDocument, PDFName } from "pdf-lib";
import fs from "fs";
import path from "path";

async function debug() {
  const pdfBytes = fs.readFileSync(
    path.resolve(__dirname, "../test-output/test-watermarked.pdf")
  );
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const context = pdfDoc.context;

  const page = pdfDoc.getPage(0);
  const node: any = page.node;

  const resourcesVal = node.get(PDFName.of("Resources"));
  const resources = context.lookup(resourcesVal);

  const xObjVal = (resources as any).get(PDFName.of("XObject"));
  const xObj = context.lookup(xObjVal);

  const keys = (xObj as any).keys();
  console.log("keys type:", typeof keys, Array.isArray(keys));
  console.log("keys[0]:", keys[0]);
  console.log("keys[0] constructor:", keys[0]?.constructor?.name);
  console.log("keys[0] props:", Object.getOwnPropertyNames(keys[0] || {}));
  console.log("keys[0] encodedName:", keys[0]?.encodedName);
  console.log("keys[0] name:", keys[0]?.name);

  for (const key of keys) {
    console.log(`\nKey: encodedName=${key.encodedName}, name=${key.name}`);
    const val = (xObj as any).get(key);
    console.log(`  val:`, val?.constructor?.name);
  }

  console.log("\n\nChecking PDFName.of API:");
  const testName = PDFName.of("Subtype");
  console.log("PDFName.of('Subtype'):", testName);
  console.log("  encodedName:", testName.encodedName);
  console.log("  name:", testName.name);

  console.log("\n\nDirect dict access via context:");
  const subtypeVal = (keys[0] as any).dict?.get?.(PDFName.of("Subtype"));
  console.log("  from stream.dict:", subtypeVal);
}

debug().catch(console.error);
