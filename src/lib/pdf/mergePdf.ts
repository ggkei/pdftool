import { PDFDocument } from "pdf-lib";

export interface MergeInput {
  name: string;
  bytes: Uint8Array;
}

export interface MergeResult {
  totalPages: number;
  fileCount: number;
  outputBytes: Uint8Array;
  pageCounts: { name: string; pages: number }[];
}

export async function mergePdfs(inputs: MergeInput[]): Promise<MergeResult> {
  if (inputs.length === 0) {
    throw new Error("请至少上传一个 PDF 文件");
  }

  const result = await PDFDocument.create();
  const pageCounts: { name: string; pages: number }[] = [];
  let totalPages = 0;

  for (const input of inputs) {
    const src = await PDFDocument.load(input.bytes);
    const pageIndices = src.getPageIndices();
    const copied = await result.copyPages(src, pageIndices);
    for (const page of copied) {
      result.addPage(page);
    }
    pageCounts.push({ name: input.name, pages: src.getPageCount() });
    totalPages += src.getPageCount();
  }

  const outputBytes = await result.save({ useObjectStreams: false });

  return {
    totalPages,
    fileCount: inputs.length,
    outputBytes,
    pageCounts,
  };
}
