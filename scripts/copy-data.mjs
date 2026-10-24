// Copy the measured dataset into the static build so the UI still has data
// when it is served without the API (GitHub Pages, a plain file server).
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "data/runs.json");
const destDir = path.join(root, "web/dist");
const dest = path.join(destDir, "runs.json");

await fs.mkdir(destDir, { recursive: true });
await fs.copyFile(src, dest);
console.log(`copied ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
