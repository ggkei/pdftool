/**
 * 测试脚本：
 * 1. 生成带图片水印的测试 PDF（使用 Canvas 创建 PNG）
 * 2. 调用 analyzePdf 解析并识别水印
 * 3. 调用 removeWatermark 去除水印
 * 4. 验证输出 PDF 的完整性
 *
 * 运行方式: npx tsx scripts/test-remove-watermark.ts
 */
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fs from "fs";
import path from "path";
import { createCanvas } from "canvas";
import { analyzePdf, removeWatermark } from "../src/lib/pdf";

const OUTPUT_DIR = path.resolve(__dirname, "../test-output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function createWatermarkPng(width: number, height: number): Uint8Array {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(200, 80, 80, 0.6)";
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = `bold ${Math.floor(Math.min(width, height) * 0.25)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WM", width / 2, height / 2);

  return canvas.toBuffer("image/png");
}

function createPhotoPng(width: number, height: number): Uint8Array {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#4facfe");
  gradient.addColorStop(1, "#00f2fe");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Photo Image", width / 2, height / 2);

  return canvas.toBuffer("image/png");
}

async function createTestPdf(): Promise<{ bytes: Uint8Array; watermarkNames: string[] }> {
  const pdfDoc = await PDFDocument.create();
  const pageCount = 3;
  const watermarkNames: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText(`This is page ${i + 1} with normal document content`, {
      x: 72,
      y: height - 100,
      size: 18,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(`Test page with text content and image watermark`, {
      x: 72,
      y: height - 140,
      size: 12,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    for (let j = 0; j < 5; j++) {
      page.drawText(`Body text line ${j + 1}: Document content should not be covered by watermark.`, {
        x: 72,
        y: height - 200 - j * 20,
        size: 10,
        font: helvetica,
        color: rgb(0.15, 0.15, 0.15),
      });
    }

    const watermarkPng = createWatermarkPng(120, 120);
    const watermarkImage = await pdfDoc.embedPng(watermarkPng);

    page.drawImage(watermarkImage, {
      x: width - 160,
      y: 40,
      width: 120,
      height: 120,
      rotate: degrees(-30),
      opacity: 0.4,
    });

    const photoPng = createPhotoPng(400, 300);
    const photoImage = await pdfDoc.embedPng(photoPng);
    page.drawImage(photoImage, {
      x: 72,
      y: 200,
      width: 400,
      height: 300,
    });
  }

  const bytes = await pdfDoc.save();
  return { bytes, watermarkNames };
}

async function main() {
  console.log("=== PDF 去水印功能测试 ===\n");

  console.log("Step 1: Generating test PDF with watermarks...");
  const { bytes: originalBytes } = await createTestPdf();
  const originalPath = path.join(OUTPUT_DIR, "test-watermarked.pdf");
  fs.writeFileSync(originalPath, Buffer.from(originalBytes));
  console.log(`  Output: ${originalPath} (${(originalBytes.length / 1024).toFixed(1)} KB)`);
  console.log();

  console.log("Step 2: Analyzing PDF - enumerating images and detecting watermarks...");
  const analyzedPages = await analyzePdf(originalBytes);
  console.log(`  Parsed ${analyzedPages.length} pages\n`);

  for (const page of analyzedPages) {
    console.log(`  [${page.pageRef}] Size: ${page.mediaBox.width}x${page.mediaBox.height}`);
    console.log(`    Found ${page.images.length} images:`);
    for (const img of page.images) {
      const watermark = page.watermarkCandidates.find((c) => c.image.ref === img.ref);
      const tag = watermark ? ` [WATERMARK, score=${(watermark.score * 100).toFixed(0)}%]` : "";
      const alphaTag = img.hasAlpha ? " [Alpha]" : "";
      console.log(`      - ${img.name}: ${img.width}x${img.height}, ${(img.size / 1024).toFixed(1)}KB, cs=${img.colorSpace}${alphaTag}${tag}`);
      if (watermark) console.log(`        Reason: ${watermark.reason}`);
    }
  }
  console.log();

  console.log("Step 3: Removing watermarks (auto-select)...");
  const result = await removeWatermark(originalBytes, { autoSelect: true });
  console.log(`  Processed ${result.pageCount} pages, removed ${result.removedCount} image draw ops`);
  const outputPath = path.join(OUTPUT_DIR, "test-cleaned.pdf");
  fs.writeFileSync(outputPath, Buffer.from(result.outputBytes));
  console.log(`  Output: ${outputPath} (${(result.outputBytes.length / 1024).toFixed(1)} KB)`);
  console.log();

  console.log("Step 4: Verifying output PDF...");
  try {
    const verifyPages = await analyzePdf(result.outputBytes);
    console.log(`  Verified: PDF parses correctly`);
    console.log(`  Pages: ${verifyPages.length}`);
    let watermarkClean = true;
    for (const page of verifyPages) {
      console.log(`  ${page.pageRef}: ${page.images.length} images remaining`);
      const stillSuspicious = page.watermarkCandidates.filter((c) => c.score >= 0.5);
      if (stillSuspicious.length > 0) {
        console.log(`    Remaining suspicious images: ${stillSuspicious.map(i => i.image.name).join(", ")}`);
        watermarkClean = false;
      }
    }
    if (watermarkClean) {
      console.log(`  ✅ PASS - No suspicious watermark images remain`);
    } else {
      console.log(`  ⚠️ WARN - Some watermark images still exist as objects`);
    }
  } catch (err) {
    console.error(`  ❌ FAILED: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  console.log();

  console.log("=== Test Complete ===");
  console.log(`Original: ${originalPath}`);
  console.log(`Cleaned:  ${outputPath}`);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
