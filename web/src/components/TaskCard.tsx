import type { Run, TaskMeta, TaskSummary } from "../types";
import { familyColor, pct, seconds, shortHash, tok, verdict } from "../lib/format";

type Props = {
  index: number;
  maxPatchSize: number;
  taskKey: string;
  meta: TaskMeta;
  summary: TaskSummary;
  runs: Run[];
  matrix: number[][];
  selected: string | null;
  onSelect: (key: string) => void;
};

function familyIndex(summary: TaskSummary, hash: string): number {
  return summary.families.findIndex((f) => f.hash === hash);
}

export function TaskCard({
  index,
  maxPatchSize,
  taskKey,
  meta,
  summary,
  runs,
  matrix,
  selected,
  onSelect,
}: Props) {
  const identicalShare = summary.runs ? summary.identicalRuns / summary.runs : 0;

  return (
    <section className="task-card">
      <header className="task-head">
        <div>
          <div className="task-kicker">
            TASK {String.fromCharCode(65 + index)} · {taskKey.toUpperCase()}
          </div>
          <h2>{meta.label}</h2>
          <p className="task-blurb">{meta.blurb}</p>
        </div>
        <div className="task-score">
          <div className="score-number">{summary.uniquePatches}</div>
          <div className="score-label">
            distinct patch{summary.uniquePatches === 1 ? "" : "es"} from {summary.runs} runs
          </div>
        </div>
      </header>

      <div className="task-body">
        <div className="fingerprints">
          <div className="sub-label">
            <span>Patch fingerprint</span>
            <span className="sub-note">bar length = lines changed</span>
          </div>
          <div className="fp-headrow">
            <span>run</span>
            <span>patch · size</span>
            <span>time · tokens · tests</span>
          </div>
          {runs.map((run) => {
            const idx = familyIndex(summary, run.patchHash);
            const key = `${run.task}:${run.run}`;
            const isSelected = selected === key;
            const size = run.added + run.removed;
            const width = 12 + (88 * size) / maxPatchSize;
            return (
              <button
                key={key}
                className={`fp-row${isSelected ? " is-selected" : ""}`}
                onClick={() => onSelect(key)}
                title={`Run ${run.run} · ${run.patchHash}`}
              >
                <span className="fp-run">{String(run.run).padStart(2, "0")}</span>
                <span className="fp-track">
                  <span
                    className="fp-bar"
                    style={{ background: familyColor(Math.max(0, idx)), width: `${width}%` }}
                  >
                    <span className="fp-hash">{shortHash(run.patchHash)}</span>
                    <span className="fp-delta">
                      +{run.added}/−{run.removed}
                    </span>
                  </span>
                </span>
                <span className="fp-meta">
                  <span>{seconds(run.durationMs)}</span>
                  <span>{tok(run.tokens.input + run.tokens.output)}</span>
                  <span className={run.tests.passed ? "ok" : "bad"}>
                    {run.tests.passed ? "pass" : "fail"}
                  </span>
                </span>
              </button>
            );
          })}
          <div className="conviction">
            <div className="conviction-bar">
              <span style={{ width: pct(identicalShare) }} />
            </div>
            <span>
              {summary.identicalRuns} of {summary.runs} runs share the most common patch · mean
              pairwise similarity {summary.meanSimilarity.toFixed(2)} ·{" "}
              {Math.round(summary.passRate * summary.runs)}/{summary.runs} passed the suite
            </span>
          </div>
        </div>

        <div className="matrix-wrap">
          <div className="sub-label">
            <span>Patch similarity</span>
            <span className="sub-note">run × run</span>
          </div>
          <div
            className="matrix"
            style={{ gridTemplateColumns: `16px repeat(${runs.length}, 1fr)` }}
          >
            <span />
            {runs.map((r) => (
              <span key={`h${r.run}`} className="matrix-tick">
                {r.run}
              </span>
            ))}
            {matrix.map((row, i) => (
              <FragmentRow key={`r${i}`} row={row} label={runs[i]?.run ?? i + 1} />
            ))}
          </div>
          <div className="matrix-legend">
            <span className="matrix-scale" />
            <span className="matrix-legend-text mono">0.0 different · 1.0 identical</span>
          </div>
          <p className="matrix-note">
            The number is the share of changed lines two runs have in common. Same tests, different
            code, low number.
          </p>
        </div>
      </div>

      <p className="verdict">{verdict(summary.runs, summary.identicalRuns, summary.uniquePatches)}</p>
    </section>
  );
}

function FragmentRow({ row, label }: { row: number[]; label: number }) {
  return (
    <>
      <span className="matrix-tick">{label}</span>
      {row.map((v, j) => (
        <span
          key={j}
          className="matrix-cell"
          style={{ background: cellColor(v) }}
          title={`${v.toFixed(2)} similar`}
        >
          {v >= 0.999 ? "1.0" : v >= 0.05 ? v.toFixed(1) : "·"}
        </span>
      ))}
    </>
  );
}

function cellColor(v: number): string {
  if (v >= 0.999) return "#ffb224";
  if (v < 0.05) return "#14171b";
  const alpha = 0.22 + v * 0.6;
  return `rgba(76, 194, 255, ${alpha.toFixed(3)})`;
}
