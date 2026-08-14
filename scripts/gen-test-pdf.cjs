// Generate a 2-page test PDF
const { PDFDocument, rgb, TextAlignment } = require("pdf-lib");
const fs = require("fs");

async function main() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont("Helvetica");

  for (let i = 0; i < 2; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Test PDF - Page ${i + 1}`, {
      x: 50, y: 720, size: 24, font, color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText("This is a test document for watermark and compression.", {
      x: 50, y: 680, size: 12, font, color: rgb(0.3, 0.3, 0.3),
    });
    for (let j = 0; j < 10; j++) {
      page.drawText(`Line ${j + 1}: The quick brown fox jumps over the lazy dog.`, {
        x: 50, y: 620 - j * 30, size: 11, font, color: rgb(0.2, 0.2, 0.2),
      });
    }
  }

  const bytes = await doc.save();
  fs.writeFileSync("public/test.pdf", Buffer.from(bytes));
  console.log("Created public/test.pdf, size:", bytes.length);
}

main().catch(console.error);
