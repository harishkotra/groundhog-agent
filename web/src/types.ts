export type Tokens = {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  steps: number;
};

export type Run = {
  task: string;
  run: number;
  model: string;
  startedAt: string;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  tokens: Tokens;
  toolCalls: string[];
  finalText: string;
  stderrTail: string;
  patch: string;
  patchHash: string;
  files: string[];
  added: number;
  removed: number;
  tests: { passed: boolean; passCount: number; failCount: number; summary: string };
};

export type TaskSummary = {
  runs: number;
  uniquePatches: number;
  identicalRuns: number;
  passRate: number;
  meanSimilarity: number;
  families: { hash: string; count: number }[];
};

export type TaskMeta = { label: string; blurb: string; prompt: string };

export type Sampling = {
  capturedAt: string;
  temperaturePresent: boolean;
  seedPresent: boolean;
  maxTokens: number;
  stream: boolean;
  toolChoice: string;
  toolCount: number;
  promptChars: number;
};

export type Dataset = {
  generatedAt: string;
  startedAt?: string;
  opencode: string;
  model: string;
  endpoint?: string;
  runsPerTask: number;
  tasks: Record<string, TaskMeta>;
  summary: Record<string, TaskSummary>;
  runs: Run[];
  similarity: Record<string, number[][]>;
  sampling?: Sampling;
};
