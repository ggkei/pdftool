const fs = require("fs");
const path = require("path");

const base = path.join(__dirname, "..", "src", "app");

const dirs = fs.readdirSync(base).filter(
  (d) => d.startsWith("util-") || d.startsWith("pdf-")
);

let count = 0;
for (const dir of dirs) {
  const file = path.join(base, dir, "page.tsx");
  if (!fs.existsSync(file)) continue;

  const toolId = dir.replace(/^(util-|pdf-)/, "");
  let content = fs.readFileSync(file, "utf-8");

  if (content.includes("ToolUsage")) {
    console.log("SKIP (already has): " + dir);
    continue;
  }

  // 1. Add ToolUsage import after last import line
  const lastImportIdx = content.lastIndexOf("import ");
  if (lastImportIdx === -1) {
    console.log("WARN no import: " + dir);
    continue;
  }
  const importEnd = content.indexOf("\n", lastImportIdx) + 1;
  const toolUsageImport = 'import { ToolUsage } from "@/components/ToolUsage";\n';
  const getToolByIdImport = 'import { getToolById } from "@/lib/tools";\n';

  content =
    content.slice(0, importEnd) +
    toolUsageImport +
    getToolByIdImport +
    content.slice(importEnd);

  // 2. Insert ToolUsage before </main>
  const mainEnd = content.indexOf("</main>");
  if (mainEnd === -1) {
    console.log("WARN no </main>: " + dir);
    continue;
  }

  // Find the indentation of </main>
  let lineStart = content.lastIndexOf("\n", mainEnd) + 1;
  const indent = content.slice(lineStart, mainEnd);

  const toolUsageLine = `${indent}    <ToolUsage tool={getToolById("${toolId}")!} />\n`;
  content = content.slice(0, mainEnd) + toolUsageLine + content.slice(mainEnd);

  fs.writeFileSync(file, content, "utf-8");
  count++;
  console.log("OK: " + dir + " -> toolId=" + toolId);
}
console.log("\nTotal updated: " + count);
