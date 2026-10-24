#!/usr/bin/env node
// Zero dependency server: static build + dataset API + live harness jobs.
//   node server.mjs            (PORT=8787 by default)

import http from "node:http";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, "web/dist");
const DATA = path.join(ROOT, "data");
const LIVE = path.join(DATA, "live");
const PORT = Number(process.env.PORT || 8787);
// 127.0.0.1 by default. Set HOST=0.0.0.0 to reach it from another machine on
// your tailnet or LAN.
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const jobs = new Map();

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function serveStatic(res, urlPath) {
  const rel = decodeURIComponent(urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, ""));
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST)) return json(res, 403, { error: "no" });
  try {
    const stat = await fs.stat(file);
    if (stat.isDirectory()) file = path.join(file, "index.html");
  } catch {
    // single page app: unknown routes fall back to index.html, but a missing
    // asset (anything with an extension) is a real 404, never HTML
    if (rel.includes(".")) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("not found");
    }
    file = path.join(DIST, "index.html");
  }
  const stream = createReadStream(file);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("read error");
  });
  const ext = path.extname(file);
  res.writeHead(200, { "content-type": TYPES[ext] || "application/octet-stream" });
  stream.pipe(res);
}

async function startJob(body) {
  const id = randomUUID();
  const runs = Math.min(10, Math.max(2, Number(body.runs) || 3));
  const endpoint = String(body.endpoint || "https://api.particle.ai/v1");
  let model = String(body.model || "particle/deepseek-v41-flash-1017");
  if (!model.includes("/")) model = `custom/${model}`;
  const tasks = Array.isArray(body.tasks) && body.tasks.length ? body.tasks.join(",") : "tight,loose";

  await fs.mkdir(LIVE, { recursive: true });
  const out = path.join(LIVE, `${id}.json`);
  const args = [
    path.join(ROOT, "harness/run-matrix.mjs"),
    "--runs",
    String(runs),
    "--tasks",
    tasks,
    "--model",
    model,
    "--base-url",
    endpoint,
    "--out",
    out,
    "--parallel",
    "2",
  ];
  const env = { ...process.env };
  if (body.apiKey) env.GROUNDHOG_API_KEY = String(body.apiKey);

  const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  const job = { id, status: "running", lines: [], error: null, out };
  jobs.set(id, job);

  const push = (line) => {
    for (const l of String(line).split("\n")) if (l.trim()) job.lines.push(l.trimEnd());
    if (job.lines.length > 400) job.lines.splice(0, job.lines.length - 400);
  };
  child.stdout.on("data", push);
  child.stderr.on("data", push);
  child.on("close", (code) => {
    job.status = code === 0 ? "done" : "failed";
    if (code !== 0) job.error = job.lines.slice(-3).join(" | ") || `harness exited ${code}`;
  });
  return job;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  try {
    if (url.pathname === "/api/dataset") {
      const id = url.searchParams.get("id");
      const file = id ? path.join(LIVE, `${id}.json`) : path.join(DATA, "runs.json");
      const text = await fs.readFile(file, "utf8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      return res.end(text);
    }

    if (url.pathname === "/api/run" && req.method === "POST") {
      const body = await readBody(req);
      const job = await startJob(body);
      return json(res, 202, { id: job.id });
    }

    if (url.pathname.startsWith("/api/run/")) {
      const id = url.pathname.split("/").pop();
      const job = jobs.get(id);
      if (!job) return json(res, 404, { error: "unknown job" });
      return json(res, 200, { id: job.id, status: job.status, lines: job.lines, error: job.error });
    }

    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "no route" });
    return serveStatic(res, url.pathname);
  } catch (e) {
    return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`groundhog agent: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  if (HOST === "0.0.0.0") console.log("bound to all interfaces: reachable from your tailnet/LAN");
});
