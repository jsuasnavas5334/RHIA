import { BENCHMARK_DATASET_VERSION } from "./dataset/index.js";
import type { CandidateAggregate } from "./metrics.js";

export function toModelProfilesJson(aggregates: readonly CandidateAggregate[]): string {
  const payload = {
    version: BENCHMARK_DATASET_VERSION,
    generatedBy: "@rhia/benchmarks",
    note:
      "Perfiles derivados de respuestas guionadas (FakeTransport), no de proveedores reales -- ver docs/progress/PH05-T004.md, seccion Riesgos, antes de usar en produccion.",
    profiles: aggregates.map((a) => a.profile),
  };
  return JSON.stringify(payload, null, 2);
}

export function toMarkdownReport(aggregates: readonly CandidateAggregate[]): string {
  const lines: string[] = [];
  lines.push(`# Benchmark RHIA de modelos (${BENCHMARK_DATASET_VERSION})`);
  lines.push("");
  lines.push(
    "Corrida con respuestas guionadas via FakeTransport (sin proveedores reales ni secretos). Ver docs/progress/PH05-T004.md.",
  );
  lines.push("");
  lines.push("| Candidato | Tier | Quality | Costo prom. USD | Latencia p95 ms |");
  lines.push("|---|---|---|---|---|");
  for (const a of aggregates) {
    lines.push(
      `| ${a.candidateId} | ${a.profile.tier} | ${a.overallQualityScore.toFixed(3)} | ${a.profile.estCostPerTaskUsd.toFixed(6)} | ${a.profile.maxLatencyMsP95} |`,
    );
  }
  lines.push("");
  lines.push("## Detalle por task class");
  lines.push("");
  for (const a of aggregates) {
    lines.push(`### ${a.candidateId}`);
    lines.push("");
    lines.push("| Task class | n | Quality | Costo prom. USD | Latencia prom. ms |");
    lines.push("|---|---|---|---|---|");
    for (const b of a.byTaskClass) {
      lines.push(
        `| ${b.taskClassId} | ${b.n} | ${b.qualityScore.toFixed(3)} | ${b.avgCostUsd.toFixed(6)} | ${b.avgLatencyMs.toFixed(1)} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
