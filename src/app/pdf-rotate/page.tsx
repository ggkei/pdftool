"use client";

import dynamic from "next/dynamic";
const PdfRotateEditor = dynamic(() => import("./RotateEditorInner"), { ssr: false });

export default function PdfRotatePage() {
  return <PdfRotateEditor />;
}
