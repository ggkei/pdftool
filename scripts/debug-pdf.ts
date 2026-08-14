import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFRawStream } from "pdf-lib";
import fs from "fs";
import path from "path";

async function debug() {
  const pdfBytes = fs.readFileSync(
    path.resolve(__dirname, "../test-output/test-watermarked.pdf")
  );
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const context = pdfDoc.context;

  console.log("Page count:", pdfDoc.getPageCount());

  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPage(i);
    const node: any = page.node;
    console.log(`\n=== Page ${i + 1} ===`);

    const resourcesVal = node.get(PDFName.of("Resources"));
    console.log("Resources raw:", resourcesVal?.constructor?.name, resourcesVal);

    const resources = context.lookup(resourcesVal);
    console.log("Resources lookup:", resources?.constructor?.name);

    if (resources instanceof PDFDict) {
      console.log("Resources keys:", resources.keys().map((k: any) => k.name));

      const xObjVal = resources.get(PDFName.of("XObject"));
      console.log("XObject raw:", xObjVal?.constructor?.name);

      const xObj = context.lookup(xObjVal);
      console.log("XObject lookup:", xObj?.constructor?.name);

      if (xObj instanceof PDFDict) {
        const keys = xObj.keys();
        console.log("XObject keys:", keys.map((k: any) => k.name));
        for (const key of keys) {
          const val = xObj.get(key);
          const actual = context.lookup(val);
          console.log(
            `  ${key.name}: ref=${val instanceof PDFRef ? `${val.objectNumber} ${val.generationNumber} R` : "inline"}, actual=${actual?.constructor?.name}`
          );
          if (actual instanceof PDFDict) {
            console.log(`    Dict keys: ${actual.keys().map((k: any) => k.name)}`);
            const subtype = actual.get(PDFName.of("Subtype"));
            console.log(`    Subtype: ${subtype?.constructor?.name} = ${subtype instanceof PDFName ? subtype.name : subtype}`);
          }
          if (actual instanceof PDFRawStream) {
            console.log(`    Stream dict keys: ${actual.dict.keys().map((k: any) => k.name)}`);
            const subtype = actual.dict.get(PDFName.of("Subtype"));
            console.log(`    Subtype: ${subtype instanceof PDFName ? subtype.name : subtype}`);
          }
        }
      }
    }

    const contentsVal = node.get(PDFName.of("Contents"));
    const contents = context.lookup(contentsVal);
    console.log("Contents:", contents?.constructor?.name);
    if (contents instanceof PDFRawStream) {
      const decoded = contents.decodeContentStream();
      console.log("Content stream (first 500 chars):", decoded.substring(0, 500));
    }
    if (contents instanceof PDFArray) {
      for (let j = 0; j < contents.size(); j++) {
        const item = contents.get(j);
        if (item instanceof PDFRef) {
          const stream = context.lookup(item);
          if (stream instanceof PDFRawStream) {
            const decoded = stream.decodeContentStream();
            console.log(`  Content stream ${j} (first 300):`, decoded.substring(0, 300));
          }
        }
      }
    }
  }
}

debug().catch(console.error);
