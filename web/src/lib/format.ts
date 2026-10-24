export const FAMILY_COLORS = [
  "#ffb224",
  "#4cc2ff",
  "#a78bfa",
  "#3ddc97",
  "#ff7ab6",
  "#f97316",
  "#22d3ee",
  "#c0c8d2",
];

export function familyColor(index: number): string {
  return FAMILY_COLORS[index % FAMILY_COLORS.length];
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function tok(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}

export function stamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** The one sentence the whole page exists to support. */
export function verdict(runs: number, identical: number, unique: number): string {
  if (unique === 1) {
    return `All ${runs} runs landed on byte-identical patches.`;
  }
  if (identical === 1) {
    return `${unique} different patches from ${runs} runs. Every run passed.`;
  }
  return `${unique} different patches from ${runs} runs, the largest family covering ${identical} of them.`;
}

export function meanTokenText(tokens: { input: number; output: number }[]): string {
  if (!tokens.length) return "0";
  const total = tokens.reduce((a, t) => a + t.input + t.output, 0);
  return tok(Math.round(total / tokens.length));
}
