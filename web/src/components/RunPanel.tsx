import { useState } from "react";

type Job = { id: string; status: string; lines: string[]; error?: string };

type Props = { onFinished: (id: string) => void; defaultEndpoint: string };

export function RunPanel({ onFinished, defaultEndpoint }: Props) {
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [model, setModel] = useState("particle/deepseek-v41-flash-1017");
  const [apiKey, setApiKey] = useState("");
  const [runs, setRuns] = useState(3);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint, model, apiKey, runs, tasks: ["tight", "loose"] }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "harness refused the job");
      const { id } = (await res.json()) as { id: string };
      await poll(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function poll(id: string) {
    for (;;) {
      const res = await fetch(`/api/run/${id}`);
      const data = (await res.json()) as Job;
      setJob(data);
      if (data.status === "done" || data.status === "failed") {
        if (data.status === "done") onFinished(id);
        else setError(data.error ?? "run failed");
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return (
    <section className="runner">
      <header className="section-head">
        <div>
          <div className="task-kicker">RUN IT YOURSELF</div>
          <h2>Point it at any OpenAI compatible endpoint</h2>
          <p className="task-blurb">
            The harness shells out to your local opencode binary. Keys never leave this machine
            and are only passed to the child process.
          </p>
        </div>
      </header>

      <div className="runner-grid">
        <label>
          <span>Base URL</span>
          <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} spellCheck={false} />
        </label>
        <label>
          <span>Model (provider/model)</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
        </label>
        <label>
          <span>API key (optional if the server has one)</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            spellCheck={false}
          />
        </label>
        <label>
          <span>Runs per task</span>
          <input
            type="number"
            min={2}
            max={10}
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
          />
        </label>
        <button className="run-btn" onClick={start} disabled={busy}>
          {busy ? "running…" : "run 2 × N"}
        </button>
      </div>

      {error ? <p className="run-error">{error}</p> : null}

      {job ? (
        <div className="run-log">
          <div className="run-log-head mono">
            job {job.id.slice(0, 8)} · {job.status}
          </div>
          <pre>{job.lines.slice(-14).join("\n")}</pre>
        </div>
      ) : null}
    </section>
  );
}
