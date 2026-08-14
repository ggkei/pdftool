// Polyfill ES2026 Map/WeakMap upsert methods for Chrome < 145
// Used by pdfjs-dist v6 "modern" build
function applyUpsertPolyfill() {
  const Mp = Map.prototype as any;
  if (typeof Mp.getOrInsertComputed !== "function") {
    Mp.getOrInsertComputed = function (key: any, cb: any) {
      if (!this.has(key)) this.set(key, cb());
      return this.get(key);
    };
  }
  const Wp = WeakMap.prototype as any;
  if (typeof Wp.getOrInsertComputed !== "function") {
    Wp.getOrInsertComputed = function (key: any, cb: any) {
      if (!this.has(key)) this.set(key, cb());
      return this.get(key);
    };
  }
}
applyUpsertPolyfill();

export {};
