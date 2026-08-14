import { PDFDocument } from "pdf-lib";

export interface SplitRange {
  start: number;
  end: number;
  name?: string;
}

export interface SplitResultItem {
  name: string;
  startPage: number;
  endPage: number;
  pageCount: number;
  bytes: Uint8Array;
}

export interface SplitResult {
  originalPages: number;
  items: SplitResultItem[];
}

export function parseRangeString(input: string, totalPages: number): SplitRange[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const ranges: SplitRange[] = [];
  const parts = trimmed.split(/[,，\s]+/);

  for (const part of parts) {
    if (!part) continue;
    const dashIdx = part.indexOf("-");
    let start: number, end: number;

    if (dashIdx >= 0) {
      start = parseInt(part.substring(0, dashIdx), 10);
      end = parseInt(part.substring(dashIdx + 1), 10);
    } else {
      start = parseInt(part, 10);
      end = start;
    }

    if (isNaN(start) || isNaN(end)) {
      throw new Error(`无效的页码范围: "${part}"`);
    }
    if (start < 1 || end > totalPages) {
      throw new Error(`页码超出范围 (1-${totalPages}): "${part}"`);
    }
    if (start > end) {
      [start, end] = [end, start];
    }

    ranges.push({ start, end });
  }

  if (ranges.length === 0) {
    throw new Error("请输入至少一个页码范围");
  }

  return ranges;
}

export async function splitPdf(
  bytes: Uint8Array,
  ranges: SplitRange[]
): Promise<SplitResult> {
  const src = await PDFDocument.load(bytes);
  const totalPages = src.getPageCount();

  if (totalPages === 0) throw new Error("PDF 没有页面");

  const items: SplitResultItem[] = [];

  for (const range of ranges) {
    const start = Math.max(1, range.start);
    const end = Math.min(totalPages, range.end);
    if (start > end) continue;

    const dst = await PDFDocument.create();
    const indices: number[] = [];
    for (let i = start - 1; i <= end - 1; i++) indices.push(i);

    const copied = await dst.copyPages(src, indices);
    for (const p of copied) dst.addPage(p);

    const outBytes = await dst.save({ useObjectStreams: false });

    const customName = range.name?.trim();
    const displayName = customName || (start === end ? `page_${start}.pdf` : `pages_${start}-${end}.pdf`);

    items.push({
      name: displayName,
      startPage: start,
      endPage: end,
      pageCount: end - start + 1,
      bytes: outBytes,
    });
  }

  return { originalPages: totalPages, items };
}

export function splitEveryN(totalPages: number, n: number): SplitRange[] {
  if (n < 1) throw new Error("N 必须 >= 1");
  const ranges: SplitRange[] = [];
  for (let i = 1; i <= totalPages; i += n) {
    ranges.push({ start: i, end: Math.min(i + n - 1, totalPages) });
  }
  return ranges;
}

export function splitEachPage(totalPages: number): SplitRange[] {
  const ranges: SplitRange[] = [];
  for (let i = 1; i <= totalPages; i++) {
    ranges.push({ start: i, end: i });
  }
  return ranges;
}
