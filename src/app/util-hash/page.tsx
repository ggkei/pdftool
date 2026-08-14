"use client";

import Link from "next/link";
import { useState } from "react";
import { ToolUsage } from "@/components/ToolUsage";
import { getToolById } from "@/lib/tools";

function md5(input: Uint8Array): string {
  function rotateLeft(lValue: number, iShiftBits: number) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX: number, lY: number) {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  }
  function f(x: number, y: number, z: number) { return (x & y) | (~x & z); }
  function g(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
  function h(x: number, y: number, z: number) { return x ^ y ^ z; }
  function i(x: number, y: number, z: number) { return y ^ (x | ~z); }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(bytes: Uint8Array): number[] {
    const totalLen = bytes.length;
    const lTotalWordCount = (((totalLen + 8) - ((totalLen + 8) % 64)) / 64) + 1;
    const lMessageLength = lTotalWordCount * 16;
    const lWordArray: number[] = new Array(lMessageLength - 2);
    let lWordCount = 0;
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < totalLen) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (bytes[lByteCount] << lBytePosition);
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lMessageLength - 2] = totalLen << 3;
    lWordArray[lMessageLength - 1] = totalLen >>> 29;
    return lWordArray;
  }
  function wordToHex(lValue: number): string {
    let wordToHexValue = "";
    let wordToHexValueTemp = "";
    let lByte: number;
    let lCount: number;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValueTemp = "0" + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValueTemp.slice(-2);
    }
    return wordToHexValue;
  }

  const lWordArray = convertToWordArray(input);
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;
  let x: number;
  for (let k = 0; k < lWordArray.length; k += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d;
    a = ff(a, b, c, d, lWordArray[k + 0], 7, 0xD76AA478);
    d = ff(d, a, b, c, lWordArray[k + 1], 12, 0xE8C7B756);
    c = ff(c, d, a, b, lWordArray[k + 2], 17, 0x242070DB);
    b = ff(b, c, d, a, lWordArray[k + 3], 22, 0xC1BDCEEE);
    a = ff(a, b, c, d, lWordArray[k + 4], 7, 0xF57C0FAF);
    d = ff(d, a, b, c, lWordArray[k + 5], 12, 0x4787C62A);
    c = ff(c, d, a, b, lWordArray[k + 6], 17, 0xA8304613);
    b = ff(b, c, d, a, lWordArray[k + 7], 22, 0xFD469501);
    a = ff(a, b, c, d, lWordArray[k + 8], 7, 0x698098D8);
    d = ff(d, a, b, c, lWordArray[k + 9], 12, 0x8B44F7AF);
    c = ff(c, d, a, b, lWordArray[k + 10], 17, 0xFFFF5BB1);
    b = ff(b, c, d, a, lWordArray[k + 11], 22, 0x895CD7BE);
    a = ff(a, b, c, d, lWordArray[k + 12], 7, 0x6B901122);
    d = ff(d, a, b, c, lWordArray[k + 13], 12, 0xFD987193);
    c = ff(c, d, a, b, lWordArray[k + 14], 17, 0xA679438E);
    b = ff(b, c, d, a, lWordArray[k + 15], 22, 0x49B40821);
    a = gg(a, b, c, d, lWordArray[k + 1], 5, 0xF61E2562);
    d = gg(d, a, b, c, lWordArray[k + 6], 9, 0xC040B340);
    c = gg(c, d, a, b, lWordArray[k + 11], 14, 0x265E5A51);
    b = gg(b, c, d, a, lWordArray[k + 0], 20, 0xE9B6C7AA);
    a = gg(a, b, c, d, lWordArray[k + 5], 5, 0xD62F105D);
    d = gg(d, a, b, c, lWordArray[k + 10], 9, 0x02441453);
    c = gg(c, d, a, b, lWordArray[k + 15], 14, 0xD8A1E681);
    b = gg(b, c, d, a, lWordArray[k + 4], 20, 0xE7D3FBC8);
    a = gg(a, b, c, d, lWordArray[k + 9], 5, 0x21E1CDE6);
    d = gg(d, a, b, c, lWordArray[k + 14], 9, 0xC33707D6);
    c = gg(c, d, a, b, lWordArray[k + 3], 14, 0xF4D50D87);
    b = gg(b, c, d, a, lWordArray[k + 8], 20, 0x455A14ED);
    a = gg(a, b, c, d, lWordArray[k + 13], 5, 0xA9E3E905);
    d = gg(d, a, b, c, lWordArray[k + 2], 9, 0xFCEFA3F8);
    c = gg(c, d, a, b, lWordArray[k + 7], 14, 0x676F02D9);
    b = gg(b, c, d, a, lWordArray[k + 12], 20, 0x8D2A4C8A);
    a = hh(a, b, c, d, lWordArray[k + 5], 4, 0xFFFA3942);
    d = hh(d, a, b, c, lWordArray[k + 8], 11, 0x8771F681);
    c = hh(c, d, a, b, lWordArray[k + 11], 16, 0x6D9D6122);
    b = hh(b, c, d, a, lWordArray[k + 14], 23, 0xFDE5380C);
    a = hh(a, b, c, d, lWordArray[k + 1], 4, 0xA4BEEA44);
    d = hh(d, a, b, c, lWordArray[k + 4], 11, 0x4BDECFA9);
    c = hh(c, d, a, b, lWordArray[k + 7], 16, 0xF6BB4B60);
    b = hh(b, c, d, a, lWordArray[k + 10], 23, 0xBEBFBC70);
    a = hh(a, b, c, d, lWordArray[k + 13], 4, 0x289B7EC6);
    d = hh(d, a, b, c, lWordArray[k + 0], 11, 0xEAA127FA);
    c = hh(c, d, a, b, lWordArray[k + 3], 16, 0xD4EF3085);
    b = hh(b, c, d, a, lWordArray[k + 6], 23, 0x04881D05);
    a = hh(a, b, c, d, lWordArray[k + 9], 4, 0xD9D4D039);
    d = hh(d, a, b, c, lWordArray[k + 12], 11, 0xE6DB99E5);
    c = hh(c, d, a, b, lWordArray[k + 15], 16, 0x1FA27CF8);
    b = hh(b, c, d, a, lWordArray[k + 2], 23, 0xC4AC5665);
    a = ii(a, b, c, d, lWordArray[k + 0], 6, 0xF4292244);
    d = ii(d, a, b, c, lWordArray[k + 7], 10, 0x432AFF97);
    c = ii(c, d, a, b, lWordArray[k + 14], 15, 0xAB9423A7);
    b = ii(b, c, d, a, lWordArray[k + 5], 21, 0xFC93A039);
    a = ii(a, b, c, d, lWordArray[k + 12], 6, 0x655B59C3);
    d = ii(d, a, b, c, lWordArray[k + 3], 10, 0x8F0CCC92);
    c = ii(c, d, a, b, lWordArray[k + 10], 15, 0xFFEFF47D);
    b = ii(b, c, d, a, lWordArray[k + 1], 21, 0x85845DD1);
    a = ii(a, b, c, d, lWordArray[k + 8], 6, 0x6FA87E4F);
    d = ii(d, a, b, c, lWordArray[k + 15], 10, 0xFE2CE6E0);
    c = ii(c, d, a, b, lWordArray[k + 6], 15, 0xA3014314);
    b = ii(b, c, d, a, lWordArray[k + 13], 21, 0x4E0811A1);
    a = ii(a, b, c, d, lWordArray[k + 4], 6, 0xF7537E82);
    d = ii(d, a, b, c, lWordArray[k + 11], 10, 0xBD3AF235);
    c = ii(c, d, a, b, lWordArray[k + 2], 15, 0x2AD7D2BB);
    b = ii(b, c, d, a, lWordArray[k + 9], 21, 0xEB86D391);
    a = addUnsigned(a, olda);
    b = addUnsigned(b, oldb);
    c = addUnsigned(c, oldc);
    d = addUnsigned(d, oldd);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

async function cryptoHash(algo: string, bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest(algo, bytes as unknown as BufferSource);
  const arr = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < arr.length; i++) hex += ("0" + arr[i].toString(16)).slice(-2);
  return hex;
}

const ALGOS = [
  { value: "MD5", label: "MD5", length: 32 },
  { value: "SHA-1", label: "SHA-1", length: 40 },
  { value: "SHA-256", label: "SHA-256", length: 64 },
  { value: "SHA-384", label: "SHA-384", length: 96 },
  { value: "SHA-512", label: "SHA-512", length: 128 },
];

export default function Page() {
  const [input, setInput] = useState("");
  const [algo, setAlgo] = useState("SHA-256");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);

  async function doHash() {
    if (!input) { setStatus("idle"); setOutput(""); return; }
    setRunning(true);
    setStatus("ok"); setOutput("");
    try {
      const bytes = new TextEncoder().encode(input);
      let result: string;
      if (algo === "MD5") {
        result = md5(bytes);
      } else {
        result = await cryptoHash(algo, bytes);
      }
      setOutput(result);
      setStatus("ok");
    } catch (e: any) {
      setStatus("error"); setOutput(e.message || "计算失败");
    } finally {
      setRunning(false);
    }
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function clearAll() {
    setInput(""); setOutput(""); setStatus("idle");
  }

  function sampleText() {
    setInput("Hello, World! 你好世界 🌍");
  }

  const currentAlgo = ALGOS.find(a => a.value === algo);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-10 animate-fade-in">
        <Link href="/" className="group mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-brand-600">
          <svg className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
          返回工具箱
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">哈希生成器</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">生成 MD5、SHA-1、SHA-256、SHA-384、SHA-512 哈希值，支持 Unicode 字符</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600 text-xs font-semibold">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </span>
              <h2 className="text-sm font-semibold text-zinc-800">输入文本</h2>
              <span className="text-[11px] text-zinc-400">{input.length} 字符</span>
            </div>
            <button onClick={sampleText} className="text-xs text-brand-600 hover:text-brand-700 font-medium">填充示例</button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入需要计算哈希的文本..."
            spellCheck={false}
            className="h-[340px] w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none scrollbar-thin"
          />
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-semibold ${
                status === "ok" ? "bg-green-50 text-green-600" :
                status === "error" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
              }`}>
                {status === "ok" ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : status === "error" ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </span>
              <h2 className="text-sm font-semibold text-zinc-800">输出 ({currentAlgo?.label})</h2>
              {currentAlgo && <span className="text-[11px] text-zinc-400">{currentAlgo.length} 字符</span>}
            </div>
            <button onClick={copyOutput} disabled={!output}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-slate-50 disabled:opacity-40">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="哈希值将显示在这里"
            spellCheck={false}
            className="h-[340px] w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none scrollbar-thin"
          />
        </section>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white shadow-soft p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-zinc-600">算法</span>
          <div className="flex flex-wrap rounded-lg bg-slate-100 p-1 text-xs gap-0.5">
            {ALGOS.map(a => (
              <button key={a.value} onClick={() => setAlgo(a.value)}
                className={`rounded-md px-3 py-1 transition-all ${
                  algo === a.value ? "bg-white text-brand-600 shadow-sm font-medium" : "text-slate-500 hover:text-slate-700"
                }`}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={doHash} disabled={running || !input}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-700 hover:shadow-glow active:scale-[0.98] transition-all disabled:opacity-50">
              {running ? "计算中..." : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  计算哈希
                </>
              )}
            </button>
            <button onClick={clearAll} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-soft hover:border-slate-300 hover:bg-slate-50 transition-all">
              清空
            </button>
          </div>
        </div>
      </div>
            <ToolUsage tool={getToolById("hash")!} />
</main>
  );
}
