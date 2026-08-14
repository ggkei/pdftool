import pako from "pako";

export interface ContentOp {
  operands: string[];
  operator: string;
}

export function parseContentStream(data: Uint8Array): ContentOp[] {
  let bytes: Uint8Array;
  try {
    bytes = pako.inflate(data);
  } catch {
    bytes = data;
  }

  const text = new TextDecoder("latin1" as any).decode(bytes);
  return tokenizeOps(text);
}

function tokenizeOps(text: string): ContentOp[] {
  const ops: ContentOp[] = [];
  const tokens = text.split(/(\s+|[()\[\]{}\/<>=])/).filter((t) => t.length > 0);

  const operands: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === " " || token === "\n" || token === "\r" || token === "\t") {
      i++;
      continue;
    }

    if (token === "<" && i + 1 < tokens.length && tokens[i + 1] === "<") {
      let hexStr = "";
      i += 2;
      while (i < tokens.length && !(tokens[i] === ">" && i + 1 < tokens.length && tokens[i + 1] === ">")) {
        hexStr += tokens[i];
        i++;
      }
      i += 2;
      operands.push("<" + hexStr + ">");
      continue;
    }

    if (token === "(") {
      let parenDepth = 1;
      let str = "(";
      i++;
      while (i < tokens.length && parenDepth > 0) {
        if (tokens[i] === "(" && (tokens[i - 1] || "") !== "\\") {
          parenDepth++;
        } else if (tokens[i] === ")" && (tokens[i - 1] || "") !== "\\") {
          parenDepth--;
        }
        str += tokens[i];
        i++;
      }
      operands.push(str);
      continue;
    }

    if (token === "[") {
      let arr = "[";
      i++;
      while (i < tokens.length && tokens[i] !== "]") {
        arr += tokens[i];
        i++;
      }
      arr += "]";
      i++;
      operands.push(arr);
      continue;
    }

    if (token === "/") {
      let name = "/";
      i++;
      while (
        i < tokens.length &&
        tokens[i] !== " " && tokens[i] !== "\n" && tokens[i] !== "\r" && tokens[i] !== "\t" &&
        tokens[i] !== "(" && tokens[i] !== ")" && tokens[i] !== "[" && tokens[i] !== "]" &&
        tokens[i] !== "{" && tokens[i] !== "}" && tokens[i] !== "<" && tokens[i] !== ">" &&
        tokens[i] !== "/" && tokens[i] !== "="
      ) {
        name += tokens[i];
        i++;
      }
      operands.push(name);
      continue;
    }

    if (token.startsWith("/")) {
      operands.push(token);
      i++;
      continue;
    }

    if (isOperator(token)) {
      ops.push({
        operands: [...operands],
        operator: token,
      });
      operands.length = 0;
      i++;
      continue;
    }

    if (/^-?\d/.test(token) || token === "+" || token === "-") {
      let numStr = token;
      i++;
      if (
        i < tokens.length &&
        /^-?\d/.test(tokens[i]) &&
        (token === "+" || token === "-")
      ) {
        numStr += tokens[i];
        i++;
      }
      operands.push(numStr);
      continue;
    }

    i++;
  }

  return ops;
}

function isOperator(token: string): boolean {
  const operators = new Set([
    "BT", "ET", "Tj", "TJ", "Tm", "Td", "TL", "Tf", "Tr", "Ts", "Tz", "Tc", "Ty",
    "q", "Q", "cm", "m", "l", "c", "v", "y", "h", "re", "f", "F", "f*", "B", "B*",
    "b", "b*", "n", "W", "W*", "S", "s", "Do", "MP", "DP", "BMC", "EMC",
    "G", "g", "RG", "rg", "K", "k", "CS", "cs", "SC", "sc", "SCN", "scn",
    "w", "J", "j", "M", "d", "ri", "i", "gs", "sh",
    "BI", "ID", "EI",
    "T*", "'", '"',
  ]);
  return operators.has(token);
}

export function serializeOps(ops: ContentOp[], compress = true): Uint8Array {
  const parts: string[] = [];

  for (const op of ops) {
    if (op.operands.length > 0) {
      parts.push(op.operands.join(" "));
    }
    parts.push(op.operator);
  }

  const text = parts.join("\n") + "\n";
  const bytes = new TextEncoder().encode(text);

  if (compress) {
    return pako.deflate(bytes);
  }
  return bytes;
}

export function filterOutImageOps(
  ops: ContentOp[],
  imageNames: Set<string>
): ContentOp[] {
  const result: ContentOp[] = [];
  let i = 0;

  while (i < ops.length) {
    const op = ops[i];

    if (op.operator === "q") {
      const qStart = i;
      let j = i + 1;
      let foundTargetDo = false;

      while (j < ops.length && ops[j].operator !== "Q") {
        if (ops[j].operator === "Do") {
          const targetName = ops[j].operands[0]?.replace(/^\//, "");
          if (targetName && imageNames.has(targetName)) {
            foundTargetDo = true;
          }
        }
        j++;
      }

      if (foundTargetDo && j < ops.length) {
        i = j + 1;
        continue;
      }

      if (!foundTargetDo) {
        result.push(op);
        i++;
        continue;
      }
    }

    if (op.operator === "Do") {
      const targetName = op.operands[0]?.replace(/^\//, "");
      if (targetName && imageNames.has(targetName)) {
        i++;
        continue;
      }
    }

    result.push(op);
    i++;
  }

  return result;
}
