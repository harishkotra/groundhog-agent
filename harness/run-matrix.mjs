#!/usr/bin/env node
// Groundhog Agent harness.
// Runs the same task through opencode N times in isolated copies of the
// challenge repo, then fingerprints every patch so convergence is measurable.
//
//   node harness/run-matrix.mjs --runs 5 --tasks tight,loose
//
// Every number written to data/runs.json comes from a real run: real opencode
// process, real model calls, real git diff, real `node --test` execution.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");
const WORK = path.join(ROOT, ".work");
const CHALLENGE = path.join(ROOT, "challenge");
const OPENCODE = process.env.OPENCODE_BIN || path.join(os.homedir(), ".opencode/bin/opencode");

const TASKS = {
  tight: {
    label: "Tight prompt",
    blurb: "One failing test, one obvious fix. No room for taste.",
    prompt:
      "The test suite fails. Fix the bug in src/invoice.js so all tests pass. Do not modify any test file.",
  },
  loose: {
    label: "Loose prompt",
    blurb: "Same failing test, but refactoring is invited. Room for taste.",
    prompt:
      "The test suite fails. Fix it so every test passes. You may also restructure src/invoice.js however you think best: move the pricing rules into one place, rename helpers, add comments. Do not modify any test file.",
  },
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function sh(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      ...opts,
      // stdin must be closed: opencode waits for EOF on an open pipe and hangs
      stdio: ["ignore", "pipe", "pipe"],
      // PWD matters: opencode resolves its project config from the environment's
      // PWD, not process.cwd(), so it must be set to the run directory or the
      // provider config in that directory is ignored ("Model not found").
      env: { ...process.env, ...(opts.cwd ? { PWD: opts.cwd } : {}), ...(opts.env || {}) },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = opts.timeoutMs
      ? setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs)
      : null;
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function readApiKey() {
  if (process.env.PARTICLE_API_KEY) return process.env.PARTICLE_API_KEY;
  const cfg = await fs.readFile(path.join(os.homedir(), ".hermes/config.yaml"), "utf8");
  const m = cfg.match(/api_key:\s*(ds-[A-Za-z0-9_\-]+)/);
  if (!m) throw new Error("No PARTICLE_API_KEY in env and none found in ~/.hermes/config.yaml");
  return m[1];
}

async function prepareRun(dir, cfg, apiKey) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dir), { recursive: true });
  await fs.cp(CHALLENGE, dir, { recursive: true });
  const config = {
    $schema: "https://opencode.ai/config.json",
    provider: {
      [cfg.providerId]: {
        npm: "@ai-sdk/openai-compatible",
        name: cfg.providerName,
        options: { baseURL: cfg.baseUrl, apiKey: `{env:${cfg.envName}}` },
        models: {
          [cfg.modelId]: { name: cfg.modelId },
        },
      },
    },
  };
  await fs.writeFile(path.join(dir, "opencode.json"), JSON.stringify(config, null, 2));
  await sh("git", ["init", "-q", "."], { cwd: dir });
  // opencode.json is harness scaffolding, never part of the measured patch
  await fs.writeFile(path.join(dir, ".git/info/exclude"), "opencode.json\n.work\n");
  await sh("git", ["add", "-A"], { cwd: dir });
  await sh("git", ["-c", "user.email=harness@local", "-c", "user.name=harness", "commit", "-qm", "seed"], {
    cwd: dir,
  });
  return apiKey;
}

function parseEvents(stdout) {
  const events = [];
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      /* partial line, ignore */
    }
  }
  const tokens = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, steps: 0 };
  const tools = [];
  const errors = [];
  let finalText = "";
  for (const ev of events) {
    if (ev.type === "step_finish" && ev.part?.tokens) {
      const t = ev.part.tokens;
      tokens.input += t.input || 0;
      tokens.output += t.output || 0;
      tokens.reasoning += t.reasoning || 0;
      tokens.cacheRead += t.cache?.read || 0;
      tokens.cacheWrite += t.cache?.write || 0;
      tokens.steps += 1;
    }
    if (ev.type === "tool_use" && ev.part?.tool) {
      tools.push(ev.part.tool);
    }
    if (ev.type === "text" && ev.part?.text) finalText = ev.part.text;
    if (ev.type === "error") errors.push(ev.error?.data?.message || ev.error?.name || "unknown error");
  }
  return { tokens, tools, finalText, errors, eventCount: events.length };
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

// Line-level similarity between two patches: how much of each patch's changed
// content the other one also contains. 1.0 means the same lines changed.
function patchSimilarity(a, b) {
  const lines = (p) =>
    new Set(
      p
        .split("\n")
        .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"))
    );
  const A = lines(a);
  const B = lines(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const l of A) if (B.has(l)) inter += 1;
  return (2 * inter) / (A.size + B.size);
}

async function measure(dir) {
  await sh("git", ["add", "-A"], { cwd: dir });
  const diff = await sh("git", ["diff", "--cached", "--no-color"], { cwd: dir });
  const patch = diff.stdout;
  const tests = await sh("npm", ["test", "--silent"], { cwd: dir });
  const passLine = /(?:#|ℹ) pass (\d+)/.exec(tests.stdout);
  const failLine = /(?:#|ℹ) fail (\d+)/.exec(tests.stdout);
  const passCount = passLine ? Number(passLine[1]) : 0;
  const failCount = failLine ? Number(failLine[1]) : 0;
  const exitOk = tests.code === 0;
  const files = [...patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);
  const added = patch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const removed = patch.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
  return {
    patch,
    patchHash: sha(patch),
    files,
    added,
    removed,
    tests: { passed: exitOk, passCount, failCount, summary: (tests.stdout.match(/ℹ (pass|fail) \d+/g) || []).join(" ") },
  };
}

async function runOnce({ task, index, cfg, apiKey, timeoutMs }) {
  const dir = path.join(WORK, `${task}-${index}`);
  await prepareRun(dir, cfg, apiKey);
  const model = `${cfg.providerId}/${cfg.modelId}`;
  const started = Date.now();
  const res = await sh(
    OPENCODE,
    [
      "run",
      "--model",
      model,
      "--dangerously-skip-permissions",
      "--format",
      "json",
      "--title",
      `groundhog-${task}-${index}`,
      TASKS[task].prompt,
    ],
    { cwd: dir, timeoutMs, env: { [cfg.envName]: apiKey } }
  );
  const durationMs = Date.now() - started;
  const parsed = parseEvents(res.stdout);
  const m = await measure(dir);
  return {
    task,
    run: index,
    model,
    startedAt: new Date(started).toISOString(),
    durationMs,
    exitCode: res.code,
    timedOut: res.signal === "SIGKILL",
    tokens: parsed.tokens,
    toolCalls: parsed.tools,
    finalText: parsed.finalText,
    errors: parsed.errors,
    stderrTail: res.stderr.slice(-600),
    ...m,
  };
}

async function main() {
  const taskNames = (arg("tasks", "tight,loose")).split(",");
  const runs = Number(arg("runs", 5));
  const modelArg = arg("model", "particle/deepseek-v41-flash-1017");
  const out = path.resolve(ROOT, arg("out", "data/runs.json"));
  const timeoutMs = Number(arg("timeout", 420000));
  const parallel = Number(arg("parallel", 2));
  const apiKey = process.env.GROUNDHOG_API_KEY || (await readApiKey());
  const slash = modelArg.indexOf("/");
  const cfg = {
    providerId: slash === -1 ? "custom" : modelArg.slice(0, slash),
    modelId: slash === -1 ? modelArg : modelArg.slice(slash + 1),
    providerName: arg("provider-name", "OpenAI-compatible"),
    baseUrl: arg("base-url", "https://api.particle.ai/v1"),
    envName: "GROUNDHOG_API_KEY",
  };
  const model = `${cfg.providerId}/${cfg.modelId}`;

  const version = await sh(OPENCODE, ["--version"]);
  const startedAt = new Date().toISOString();
  console.log(`harness: opencode ${version.stdout.trim()} | model ${model} | ${taskNames.join("+")} x ${runs}`);

  const queue = [];
  for (const t of taskNames) for (let i = 1; i <= runs; i += 1) queue.push({ task: t, index: i });

  const results = [];
  const workers = Array.from({ length: Math.max(1, parallel) }, async () => {
    while (queue.length) {
      const job = queue.shift();
      const r = await runOnce({ ...job, cfg, apiKey, timeoutMs });
      if (results.length === 0 && !r.patch && r.errors?.length) {
        console.error(`first run produced no patch: ${r.errors.join(" | ")}`);
        process.exit(1);
      }
      console.log(
        `  ${job.task} run ${job.index}: ${r.tests.passed ? "PASS" : "FAIL"} ` +
          `${(r.durationMs / 1000).toFixed(1)}s ${r.tokens.input + r.tokens.output} tok ` +
          `patch ${r.patchHash.slice(0, 10)} (+${r.added}/-${r.removed})`
      );
      results.push(r);
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => a.task.localeCompare(b.task) || a.run - b.run);

  // fingerprints per task
  const summary = {};
  for (const t of taskNames) {
    const rows = results.filter((r) => r.task === t);
    const hashes = new Map();
    for (const r of rows) hashes.set(r.patchHash, (hashes.get(r.patchHash) || 0) + 1);
    const families = [...hashes.entries()].sort((a, b) => b[1] - a[1]).map(([hash, count]) => ({ hash, count }));
    const pairs = [];
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        pairs.push(patchSimilarity(rows[i].patch, rows[j].patch));
      }
    }
    summary[t] = {
      runs: rows.length,
      uniquePatches: families.length,
      identicalRuns: families[0]?.count || 0,
      passRate: rows.filter((r) => r.tests.passed).length / rows.length,
      meanSimilarity: pairs.length ? pairs.reduce((a, b) => a + b, 0) / pairs.length : 1,
      families,
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    startedAt,
    opencode: version.stdout.trim(),
    model,
    endpoint: cfg.baseUrl,
    runsPerTask: runs,
    tasks: Object.fromEntries(taskNames.map((t) => [t, { ...TASKS[t], prompt: TASKS[t].prompt }])),
    summary,
    runs: results.map(({ patch, ...r }) => ({ ...r, patch })),
    // pairwise similarity matrix per task, for the UI heatmap
    similarity: Object.fromEntries(
      taskNames.map((t) => {
        const rows = results.filter((r) => r.task === t);
        return [
          t,
          rows.map((a) => rows.map((b) => (a.patchHash === b.patchHash ? 1 : patchSimilarity(a.patch, b.patch)))),
        ];
      })
    ),
  };
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(payload, null, 2));
  console.log(`wrote ${out}`);
  for (const t of taskNames) {
    const s = summary[t];
    console.log(`${t}: ${s.identicalRuns}/${s.runs} identical, ${s.uniquePatches} distinct patches, mean similarity ${s.meanSimilarity.toFixed(2)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
