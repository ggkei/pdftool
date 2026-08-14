import pako from "pako";
import { PDFDocument, PDFName, PDFRawStream, PDFArray, decodePDFRawStream } from "pdf-lib";
import { parseContentStream, filterOutImageOps, serializeOps } from "../src/lib/pdf/contentStreamOps";
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
  const contentsVal = node.get(PDFName.of("Contents"));
  const contentsObj = context.lookup(contentsVal);

  if (contentsObj instanceof PDFArray) {
    const stream = context.lookup(contentsObj.get(0));
    if (stream instanceof PDFRawStream) {
      let raw: Uint8Array;
      try {
        const decoded = decodePDFRawStream(stream);
        raw = decoded.data;
        console.log("decodePDFRawStream OK, length:", raw.length);
      } catch (e) {
        raw = stream.contents;
        console.log("decodePDFRawStream failed:", (e as Error).message);
        console.log("Using stream.contents, length:", raw?.length);
      }
      let decompressed: Uint8Array;
      try {
        decompressed = pako.inflate(raw);
        console.log("pako.inflate OK, length:", decompressed.length);
      } catch (e) {
        decompressed = raw;
        console.log("pako.inflate failed:", (e as Error).message, "using raw");
      }

      console.log("=== Raw decompressed content ===");
      const text = new TextDecoder("latin1" as any).decode(decompressed);
      console.log(text.substring(text.length - 400));

      console.log("\n=== Parsing with parseContentStream ===");
      const ops = parseContentStream(decompressed);
      console.log(`Total ops: ${ops.length}`);
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        if (op.operator === "Do") {
          console.log(`  [${i}] Do operands=[${op.operands.join(",")}]`);
        }
      }

      console.log("\n=== Filtering with target Image-5824662338 ===");
      const targetNames = new Set(["Image-5824662338"]);
      const filtered = filterOutImageOps(ops, targetNames);
      console.log(`Original: ${ops.length}, Filtered: ${filtered.length}, Removed: ${ops.length - filtered.length}`);

      console.log("\n=== Serialize filtered ops ===");
      const serialized = serializeOps(filtered, false);
      const text2 = new TextDecoder("latin1" as any).decode(serialized);
      console.log(text2.substring(text2.length - 400));
    }
  }
}

debug().catch(console.error);
