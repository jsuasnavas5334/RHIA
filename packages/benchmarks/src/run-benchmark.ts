import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_CASES } from "./dataset/index.js";
import { CANDIDATES } from "./candidates.js";
import { runBenchmark } from "./harness.js";
import { aggregateAll } from "./metrics.js";
import { toMarkdownReport, toModelProfilesJson } from "./report.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const results = await runBenchmark(CANDIDATES, ALL_CASES);
  const aggregates = aggregateAll(CANDIDATES, results);

  const outDir = join(currentDir, "..", "output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "model-profiles.v1.json"), toModelProfilesJson(aggregates), "utf8");
  writeFileSync(join(outDir, "benchmark-report.v1.md"), toMarkdownReport(aggregates), "utf8");

  console.log(
    `Benchmark completo: ${results.length} corridas, ${CANDIDATES.length} candidatos, ${ALL_CASES.length} casos.`,
  );
  for (const a of aggregates) {
    console.log(
      `${a.candidateId}: quality=${a.overallQualityScore.toFixed(3)} costUsd=${a.profile.estCostPerTaskUsd} p95Ms=${a.profile.maxLatencyMsP95}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
