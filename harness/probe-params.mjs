#!/usr/bin/env node
// Transparent logging proxy for an OpenAI compatible endpoint.
// Used once, to record exactly which sampling parameters opencode puts on the wire.
//   node harness/probe-params.mjs --port 8790 --target https://api.particle.ai
// Then point opencode at http://127.0.0.1:8790/v1 and read harness/params.json.

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const PORT = Number(argOf("port", 8790));
const TARGET = argOf("target", "https://api.particle.ai");
const OUT = path.resolve(import.meta.dirname, "params.json");

const KEEP = ["model", "temperature", "top_p", "top_k", "seed", "stream", "max_tokens", "max_completion_tokens", "n", "stop", "response_format", "tool_choice"];

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(404).end("proxy: only POST");
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");

  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* pass through untouched */
  }

  if (body) {
    const picked = {};
    for (const k of KEEP) if (body[k] !== undefined) picked[k] = body[k];
    const tools = Array.isArray(body.tools) ? body.tools.length : 0;
    const record = {
      capturedAt: new Date().toISOString(),
      request: picked,
      hasSeed: Object.prototype.hasOwnProperty.call(body, "seed"),
      temperaturePresent: Object.prototype.hasOwnProperty.call(body, "temperature"),
      toolCount: tools,
      messageRoles: Array.isArray(body.messages) ? body.messages.map((m) => m.role) : [],
      promptChars: raw.length,
    };
    await fs.writeFile(OUT, JSON.stringify(record, null, 2));
    console.log(`captured: temperature=${record.temperaturePresent ? picked.temperature : "absent"} seed=${record.hasSeed ? picked.seed : "absent"}`);
  }

  const upstream = await fetch(`${TARGET}${req.url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: req.headers.authorization || "",
    },
    body: raw,
  });
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") || "application/json",
  });
  const reader = upstream.body;
  if (!reader) {
    res.end(await upstream.text());
    return;
  }
  for await (const chunk of reader) res.write(chunk);
  res.end();
});

server.listen(PORT, "127.0.0.1", () => console.log(`proxy on http://127.0.0.1:${PORT} -> ${TARGET}`));
