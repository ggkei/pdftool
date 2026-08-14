"use client";

import { useCallback, useRef, useState } from "react";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
}

export function FileDropZone({
  onFileSelect,
  disabled,
  accept = ".pdf",
  multiple = false,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect, disabled]
  );

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
        isDragging
          ? "border-brand-400 bg-brand-50/60 scale-[1.01]"
          : "border-slate-300 bg-white hover:border-brand-300 hover:bg-brand-50/30"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{
          backgroundImage: "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.05), transparent 70%)",
        }}
      />
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const f = multiple ? e.target.files : e.target.files?.[0];
          if (f) onFileSelect(f as any);
        }}
        className="hidden"
      />

      <div className={`relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
        isDragging
          ? "bg-brand-600 text-white shadow-glow scale-110"
          : "bg-brand-50 text-brand-600 group-hover:bg-brand-100"
      }`}>
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3m0 0l-4 4m4-4l4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
      </div>

      <p className={`relative mb-1 text-base font-semibold transition-colors ${
        isDragging ? "text-brand-700" : "text-zinc-800"
      }`}>
        {isDragging ? "松开鼠标以上传" : "点击或拖拽 PDF 文件到此处"}
      </p>
      <p className="relative text-xs text-zinc-400">
        支持 .pdf 格式 · 文件从不上传服务器
      </p>
    </div>
  );
}
