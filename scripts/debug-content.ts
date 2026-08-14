import { PDFDocument, PDFName, PDFRawStream, PDFArray, PDFRef, decodePDFRawStream } from "pdf-lib";
import pako from "pako";
import fs from "fs";
import path from "path";

async function debug() {
  const pdfBytes = fs.readFileSync(
    path.resolve(__dirname, "../test-output/test-watermarked.pdf")
  );
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const context = pdfDoc.context;

  const NAME_CONTENTS = PDFName.of("Contents");
  const NAME_FILTER = PDFName.of("Filter");

  for (let i = 0; i < 1; i++) {
    const page = pdfDoc.getPage(i);
    const node: any = page.node;

    console.log(`\n=== Page ${i + 1} ===`);
    const contentsVal = node.get(NAME_CONTENTS);
    console.log("Contents value type:", contentsVal?.constructor?.name);
    console.log("Contents value:", contentsVal);

    const contentsObj = context.lookup(contentsVal);
    console.log("Contents lookup type:", contentsObj?.constructor?.name);

    if (contentsObj instanceof PDFArray) {
      console.log("Contents is array, size:", contentsObj.size());
      for (let j = 0; j < contentsObj.size(); j++) {
        const item = contentsObj.get(j);
        console.log(`  [${j}] type:`, item?.constructor?.name, item instanceof PDFRef ? `ref=${item.objectNumber} ${item.generationNumber}` : "");
        if (item instanceof PDFRef) {
          const stream = context.lookup(item);
          if (stream instanceof PDFRawStream) {
            const filterVal = stream.dict.get(NAME_FILTER);
            const getName = (n: any) => n?.encodedName?.replace(/^\//, "");
            const filterName = filterVal instanceof PDFName ? getName(filterVal) : "none";
            console.log(`    Filter: ${filterName}`);

            let raw: Uint8Array;
            try {
              const decoded = decodePDFRawStream(stream);
              raw = decoded.data;
              console.log(`    decodePDFRawStream OK, length=${raw.length}`);
            } catch (e) {
              raw = stream.contents;
              console.log(`    decodePDFRawStream failed: ${(e as Error).message}, using raw contents, length=${raw.length}`);
            }

            let decompressed: Uint8Array;
            try {
              decompressed = pako.inflate(raw);
              console.log(`    pako.inflate OK, length=${decompressed.length}`);
            } catch (e) {
              decompressed = raw;
              console.log(`    pako.inflate failed: ${(e as Error).message}, using raw, length=${raw.length}`);
            }

            const text = new TextDecoder("latin1" as any).decode(decompressed);
            console.log(`    Content (first 800 chars):\n${text.substring(0, 800)}`);
            console.log(`    Content (last 300 chars):\n${text.substring(text.length - 300)}`);

            const doMatches = [...text.matchAll(/\/(\w+)\s+Do/g)];
            console.log(`    /Do operators found: ${doMatches.length}`);
            for (const m of doMatches) {
              console.log(`      /${m[1]} Do`);
            }
          }
        }
      }
    }
  }
}

debug().catch(console.error);
