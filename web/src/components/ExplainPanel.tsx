import type { Sampling } from "../types";

type Props = {
  opencode: string;
  endpoint: string;
  model: string;
  generatedAt: string;
  sampling?: Sampling;
};

export function ExplainPanel({ opencode, endpoint, model, generatedAt, sampling }: Props) {
  return (
    <section className="explain">
      <header className="section-head">
        <div>
          <div className="task-kicker">WHY THE BYTES MOVE</div>
          <h2>Three layers, one fingerprint</h2>
          <p className="task-blurb">
            A patch is decided by three things: the prompt you write, the request the agent puts on
            the wire, and what the inference server does with it. Only the first one is yours.
          </p>
        </div>
      </header>

      <div className="explain-grid">
        <article className="explain-card">
          <div className="explain-num">01</div>
          <h3>What you set</h3>
          <p>
            Task A asks for the bug fix and nothing else. Task B invites a restructure. Same failing
            test, same repo, same agent, same model, same endpoint. Five runs each, nothing else
            changed. One sentence of difference is the whole experiment.
          </p>
          <p className="explain-foot mono">
            A: 5 of 5 identical · B: 5 distinct patches
          </p>
        </article>

        <article className="explain-card">
          <div className="explain-num">02</div>
          <h3>What the wire carried</h3>
          <p>
            A logging proxy sat between {opencode} and the endpoint for one request. The agent never
            asked for randomness, and never asked for a seed either. Whatever the server's default
            sampler is, that is what decided every token in every patch below.
          </p>
          <pre className="wire mono">{`{
  "model": "${model.split("/").slice(1).join("/")}",
  "stream": true,
  "max_tokens": ${sampling?.maxTokens ?? 32000},
  "tool_choice": "auto"
}
// temperature: absent
// seed: absent
// ${sampling?.toolCount ?? 10} tools, ${Math.round((sampling?.promptChars ?? 197439) / 1000)}k chars of system prompt`}</pre>
          <p className="explain-foot mono">captured {sampling ? new Date(sampling.capturedAt).toISOString().slice(0, 16).replace("T", " ") : "n/a"} UTC</p>
        </article>

        <article className="explain-card hot">
          <div className="explain-num">03</div>
          <h3>What the server decides</h3>
          <p>
            Your request shares a batch with strangers, and batch composition changes the order
            floating point additions happen in. A logit lands a hair differently, a token flips, and
            a flipped token becomes a different patch. DeepInfer ships{" "}
            <span className="mono">DEEPINFER_BATCH_INVARIANT=1</span> and deterministic sampling with
            a fixed <span className="mono">seq_seed</span> for exactly this. Your fingerprint would be
            one colour at any load.
          </p>
          <p className="explain-foot mono">SM100 or Ascend 950 only · not run here</p>
        </article>
      </div>

      <div className="caveat">
        <strong>What this page does not claim.</strong> DeepInfer needs SM100 or Ascend 950 hardware
        and a 64 + 64 GPU minimum deployment, so it could not run on this laptop, and its guarantee
        is quoted from the DeepSeek docs rather than reproduced. What is reproduced here is the
        absence of that guarantee: {opencode} against {endpoint}, measured {generatedAt}.
      </div>
    </section>
  );
}
