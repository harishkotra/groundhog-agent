import { useEffect, useState } from "react";
import type { Dataset } from "./types";
import { TaskCard } from "./components/TaskCard";
import { PatchInspector } from "./components/PatchInspector";
import { ExplainPanel } from "./components/ExplainPanel";
import { RunPanel } from "./components/RunPanel";
import { meanTokenText, stamp } from "./lib/format";

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);

  useEffect(() => {
    load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(liveId: string | null) {
    try {
      const url = liveId ? `/api/dataset?id=${liveId}` : "/api/dataset";
      const res = await fetch(url);
      if (!res.ok) throw new Error("no api");
      setData((await res.json()) as Dataset);
      setSelected(null);
    } catch {
      try {
        const res = await fetch("runs.json");
        setData((await res.json()) as Dataset);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  if (error) {
    return (
      <main className="shell">
        <p className="load-error">Could not load the run dataset: {error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell">
        <p className="load-error">Loading measured runs…</p>
      </main>
    );
  }

  const taskKeys = Object.keys(data.tasks);
  const totalRuns = data.runs.length;
  const summaries = taskKeys.map((k) => data.summary[k]);
  // one scale for the whole dataset, so a one-line fix looks like a nub and a
  // refactor looks like a slab
  const maxPatchSize = Math.max(1, ...data.runs.map((r) => r.added + r.removed));

  return (
    <main className="shell">
      <div className="topstrip">
        <div className="brand">
          <span className="brand-mark" />
          GROUNDHOG AGENT
        </div>
        <div className="strip-meta mono">
          {data.opencode} · {data.model} · {totalRuns} runs · {stamp(data.generatedAt)}
          {live ? " · live run" : " · shipped dataset"}
        </div>
      </div>

      <header className="hero">
        <div className="hero-copy">
          <div className="eyebrow">REPRODUCIBILITY TEST · CODING AGENTS</div>
          <h1>
            Your coding agent isn&rsquo;t flaky.
            <br />
            <span>Its inference server is.</span>
          </h1>
          <p className="lede">
            One failing test. One agent, one model, one endpoint. {data.runsPerTask} runs per task,
            with nothing changed between them. The tests always passed. The patches did not always
            agree, and the two tasks disagree by very different amounts.
          </p>
        </div>

        <div className="verdict-card">
          {summaries.map((s, i) => (
            <div className="verdict-row" key={i}>
              <div className="verdict-label">
                TASK {String.fromCharCode(65 + i)} · {data.tasks[taskKeys[i]].label.toUpperCase()}
              </div>
              <div className="verdict-big">
                {s.uniquePatches}{" "}
                <span>{s.uniquePatches === 1 ? "patch" : "patches"}</span>
              </div>
              <div className="verdict-cap">
                across {s.runs} runs ·{" "}
                {s.identicalRuns === s.runs
                  ? `all ${s.runs} byte-identical`
                  : `largest identical group ${s.identicalRuns} of ${s.runs}`}
              </div>
            </div>
          ))}
          <div className="verdict-foot">
            Every one of the {totalRuns} runs passed the suite. Mean{" "}
            {meanTokenText(data.runs.map((r) => r.tokens))} tokens per run.
          </div>
        </div>
      </header>

      <div className="how-to-read">
        <span className="mono">how to read it</span> Each bar is one run. Same colour means
        byte-identical patches. A wall of one colour is convergence. Noise is the server talking.
      </div>

      <div className="tasks">
        {taskKeys.map((key) => (
          <TaskCard
            key={key}
            index={taskKeys.indexOf(key)}
            maxPatchSize={maxPatchSize}
            taskKey={key}
            meta={data.tasks[key]}
            summary={data.summary[key]}
            runs={data.runs.filter((r) => r.task === key)}
            matrix={data.similarity[key]}
            selected={selected}
            onSelect={setSelected}
          />
        ))}
      </div>

      <PatchInspector
        runs={data.runs}
        tasks={data.tasks}
        selected={selected ?? `${data.runs[0].task}:${data.runs[0].run}`}
        onSelect={setSelected}
      />

      <ExplainPanel
        opencode={data.opencode}
        endpoint={data.endpoint ?? "hosted endpoint"}
        model={data.model}
        generatedAt={stamp(data.generatedAt)}
        sampling={data.sampling}
      />

      <RunPanel
        defaultEndpoint={data.endpoint ?? "https://api.particle.ai/v1"}
        onFinished={(id) => {
          setLive(id);
          load(id);
        }}
      />

      <footer className="foot">
        <div>
          Built By <a href="https://harishkotra.me">Harish Kotra</a> ·{" "}
          <a href="https://dailybuild.xyz">Checkout my other builds</a>
        </div>
        <div className="mono">
          opencode {data.opencode} · {data.runsPerTask * taskKeys.length} measured runs · every
          patch executed against node --test
        </div>
      </footer>
    </main>
  );
}
