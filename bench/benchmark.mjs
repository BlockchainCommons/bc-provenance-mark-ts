/**
 * Baseline vs working tree micro-benchmarks.
 *
 *   bun run build && bun bench/benchmark.mjs
 */
import * as baseline from "../tests/baseline/provenance-mark-baseline.mjs";
import * as current from "../dist/index.mjs";

const SEED = Uint8Array.from({ length: 32 }, (_, i) => i * 7 + 1);
const N = 1000;
const api = (m) => {
  // The frozen bundle predates the options-object API.
  const current = typeof m.ProvenanceMarkGenerator?.fromPassphrase === "function";
  const res = current ? "medium" : m.ProvenanceMarkResolution.Medium;
  return {
    generator: () =>
      current
        ? m.ProvenanceMarkGenerator.from({ res, seed: m.ProvenanceSeed.from(SEED) })
        : m.ProvenanceMarkGenerator.newWithSeed(res, m.ProvenanceSeed.fromBytes(SEED)),
    next: (g, i) => g.next(new Date(Date.UTC(2024, 0, 1 + (i % 28))), current ? {} : undefined),
    message: (mark) => (current ? mark.message : mark.message()),
    fromMessage: (bytes) => m.ProvenanceMark.fromMessage(res, bytes),
    validate: (marks) => m.validate(marks),
    ur: (mark) => (current ? mark.toUR().toString() : mark.urString()),
    identifier: (mark) =>
      current ? mark.identifier({ style: "bytewords", prefix: true }) : mark.bytewordsIdentifier(true),
  };
};
const time = (fn, n) => {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t0) / n;
};
const run = (m) => {
  const a = api(m);
  const g = a.generator();
  const marks = [];
  for (let i = 0; i < N; i++) marks.push(a.next(g, i));
  const messages = marks.map(a.message);
  return [
    [`generate ${N} marks`, time(() => { const g2 = a.generator(); for (let i = 0; i < N; i++) a.next(g2, i); }, 3)],
    [`decode ${N} messages`, time(() => messages.map(a.fromMessage), 3)],
    [`validate the ${N}-mark chain`, time(() => a.validate(marks), 3)],
    [`UR strings for ${N} marks`, time(() => marks.map(a.ur), 3)],
    [`identifiers for ${N} marks`, time(() => marks.map(a.identifier), 3)],
  ];
};
const before = run(baseline);
const after = run(current);
console.log(`${"operation".padEnd(32)} ${"baseline".padStart(10)} ${"current".padStart(10)} ${"ratio".padStart(7)}`);
for (let i = 0; i < before.length; i++) {
  const [label, b] = before[i];
  const c = after[i][1];
  console.log(`${label.padEnd(32)} ${b.toFixed(3).padStart(8)}ms ${c.toFixed(3).padStart(8)}ms ${(c / b).toFixed(2).padStart(6)}×`);
}
