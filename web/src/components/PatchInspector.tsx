import { useMemo } from "react";
import type { Run, TaskMeta } from "../types";
import { parsePatch } from "../lib/diff";
import { seconds, shortHash, tok } from "../lib/format";

type Props = {
  runs: Run[];
  tasks: Record<string, TaskMeta>;
  selected: string | null;
  onSelect: (key: string) => void;
};

export function PatchInspector({ runs, tasks, selected, onSelect }: Props) {
  const current = runs.find((r) => `${r.task}:${r.run}` === selected) ?? runs[0];
  const parsed = useMemo(() => (current ? parsePatch(current.patch) : []), [current]);

  if (!current) return null;

  return (
    <section className="inspector">
      <header className="section-head">
        <div>
          <div className="task-kicker">THE BYTES</div>
          <h2>Patch inspector</h2>
          <p className="task-blurb">
            Every patch below was produced by a real opencode process against a real model, then
            diffed with git. Nothing here is simulated.
          </p>
        </div>
      </header>

      <div className="inspector-body">
        <aside className="run-list">
          {Object.entries(tasks).map(([taskKey, meta]) => (
            <div key={taskKey} className="run-group">
              <div className="run-group-label">{meta.label}</div>
              <div className="run-group-cols">
                <span>run</span>
                <span>patch</span>
              </div>
              {runs
                .filter((r) => r.task === taskKey)
                .map((r) => {
                  const key = `${r.task}:${r.run}`;
                  return (
                    <button
                      key={key}
                      className={`run-chip${key === selected ? " is-selected" : ""}`}
                      onClick={() => onSelect(key)}
                    >
                      <span className="run-chip-name">
                        run {String(r.run).padStart(2, "0")}
                      </span>
                      <span className="run-chip-hash">{shortHash(r.patchHash)}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </aside>

        <div className="patch-pane">
          <div className="patch-title">
            <span>
              {tasks[current.task].label.toLowerCase()} · run {String(current.run).padStart(2, "0")} ·{" "}
              {current.files.join(", ") || "no files changed"}
            </span>
            <span>{current.patchHash.slice(0, 16)}</span>
          </div>
          <div className="patch-meta">
            <div>
              <div className="meta-key">patch</div>
              <div className="meta-val mono">{current.patchHash.slice(0, 16)}</div>
            </div>
            <div>
              <div className="meta-key">shape</div>
              <div className="meta-val mono">
                +{current.added} / -{current.removed} in {current.files.length || 0} file
                {current.files.length === 1 ? "" : "s"}
              </div>
            </div>
            <div>
              <div className="meta-key">wall clock</div>
              <div className="meta-val mono">{seconds(current.durationMs)}</div>
            </div>
            <div>
              <div className="meta-key">tokens</div>
              <div className="meta-val mono">
                {tok(current.tokens.input)} in · {tok(current.tokens.output)} out ·{" "}
                {current.tokens.steps} steps
              </div>
            </div>
            <div>
              <div className="meta-key">tools</div>
              <div
                className="meta-val mono"
                title={current.toolCalls.join(" → ")}
              >
                {current.toolCalls.length
                  ? `${current.toolCalls.slice(0, 5).join(" → ")}${current.toolCalls.length > 5 ? ` +${current.toolCalls.length - 5}` : ""}`
                  : "none"}
              </div>
            </div>
            <div>
              <div className="meta-key">tests</div>
              <div className={`meta-val mono ${current.tests.passed ? "ok" : "bad"}`}>
                {current.tests.passed ? "pass" : "fail"} · {current.tests.passCount} passed /{" "}
                {current.tests.failCount} failed
              </div>
            </div>
          </div>

          {parsed.length === 0 ? (
            <p className="empty">This run produced no diff.</p>
          ) : (
            <div className="diff">
              {parsed.map((file) => (
                <div key={file.file} className="diff-file">
                  <div className="diff-file-head mono">{file.file}</div>
                  {file.blocks.map((block, bi) => (
                    <div key={bi} className="diff-block">
                      <div className="diff-hunk mono">{block.header}</div>
                      {block.lines.map((line, li) => (
                        <div key={li} className={`diff-line ${line.kind}`}>
                          <span className="gutter mono">{line.oldNo ?? ""}</span>
                          <span className="gutter mono">{line.newNo ?? ""}</span>
                          <span className="diff-sign mono">
                            {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
                          </span>
                          <span className="diff-text mono">{line.text || " "}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {current.finalText ? (
            <div className="agent-says">
              <div className="meta-key">what the agent said</div>
              <p>“{current.finalText}”</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
