export type DiffLine = {
  kind: "add" | "del" | "ctx";
  text: string;
  oldNo: number | null;
  newNo: number | null;
};

export type DiffBlock = { header: string; lines: DiffLine[] };
export type FileDiff = { file: string; blocks: DiffBlock[] };

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Turn a unified git diff into files, hunks and numbered lines for display. */
export function parsePatch(patch: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;
  let block: DiffBlock | null = null;
  let oldNo = 0;
  let newNo = 0;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("diff --git")) {
      const m = /b\/(.+)$/.exec(raw);
      current = { file: m ? m[1] : raw, blocks: [] };
      files.push(current);
      block = null;
      continue;
    }
    if (!current) continue;
    if (raw.startsWith("+++") || raw.startsWith("---") || raw.startsWith("index ")) continue;

    const hunk = HUNK.exec(raw);
    if (hunk) {
      oldNo = Number(hunk[1]);
      newNo = Number(hunk[2]);
      block = { header: raw, lines: [] };
      current.blocks.push(block);
      continue;
    }
    if (!block) continue;
    if (raw.startsWith("+")) {
      block.lines.push({ kind: "add", text: raw.slice(1), oldNo: null, newNo: newNo++ });
    } else if (raw.startsWith("-")) {
      block.lines.push({ kind: "del", text: raw.slice(1), oldNo: oldNo++, newNo: null });
    } else if (raw.startsWith(" ") || raw === "") {
      block.lines.push({ kind: "ctx", text: raw.slice(1), oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return files;
}

/** Small helper for the "what changed" summary line. */
export function patchShape(patch: string): { files: string[]; added: number; removed: number } {
  const files = [...patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);
  const added = patch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const removed = patch.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
  return { files, added, removed };
}
