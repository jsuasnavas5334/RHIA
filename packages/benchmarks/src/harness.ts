import {
  AiGateway,
  createAnthropicAdapter,
  createOllamaAdapter,
  createOpenAiAdapter,
} from "@rhia/ai-gateway";
import type { GatewayContentPart, GatewayResult, ProviderAdapter, ProviderId } from "@rhia/ai-gateway";
import type { CandidateSpec } from "./candidates.js";
import type { TaskCase } from "./dataset/index.js";
import { buildFakeTransportFor } from "./scripted-transport.js";

function adapterFor(provider: ProviderId): ProviderAdapter {
  switch (provider) {
    case "openai":
      return createOpenAiAdapter();
    case "anthropic":
      return createAnthropicAdapter();
    case "ollama":
      return createOllamaAdapter();
    default:
      throw new Error(
        `El harness de benchmark no tiene un adapter configurado para el proveedor '${provider}'. ` +
          "Agrega el caso en adapterFor() antes de usar este proveedor en un CandidateSpec.",
      );
  }
}

export interface BenchmarkRunResult {
  readonly candidateId: string;
  readonly taskCase: TaskCase;
  readonly score: number;
  readonly scoreReason: string;
  readonly costUsd: number;
  readonly latencyMs: number;
  readonly gatewayResult: GatewayResult;
}

function extractText(result: Extract<GatewayResult, { status: "SUCCEEDED" }>): string {
  return result.message.content
    .filter((part): part is Extract<GatewayContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/**
 * Ejecuta un candidato contra un caso. Cada corrida construye un
 * AiGateway + FakeTransport de un solo uso: nunca hay red real ni estado
 * compartido entre corridas, lo que hace la corrida reproducible.
 */
export async function runOne(candidate: CandidateSpec, taskCase: TaskCase): Promise<BenchmarkRunResult> {
  const answer = candidate.answerFor(taskCase);
  const transport = buildFakeTransportFor(candidate.provider, answer);
  const gateway = new AiGateway([adapterFor(candidate.provider)], transport);

  const result = await gateway.invoke(
    {
      requestId: `bench-${candidate.id}-${taskCase.id}`,
      provider: candidate.provider,
      model: candidate.model,
      messages: [{ role: "user", content: [{ type: "text", text: taskCase.prompt }] }],
      tools: [],
      responseFormat: { kind: "text" },
      maxOutputTokens: 512,
      temperature: 0,
    },
    { timeoutMs: 5000 },
  );

  if (result.status !== "SUCCEEDED") {
    return {
      candidateId: candidate.id,
      taskCase,
      score: 0,
      scoreReason: `Gateway devolvio FAILED: ${result.error.code} (${result.error.message})`,
      costUsd: 0,
      latencyMs: result.latencyMs,
      gatewayResult: result,
    };
  }

  const responseText = extractText(result);
  const { score, reason } = taskCase.scorer(responseText);

  return {
    candidateId: candidate.id,
    taskCase,
    score,
    scoreReason: reason,
    costUsd: result.cost.amount,
    latencyMs: result.latencyMs,
    gatewayResult: result,
  };
}

export async function runBenchmark(
  candidates: readonly CandidateSpec[],
  cases: readonly TaskCase[],
): Promise<readonly BenchmarkRunResult[]> {
  const results: BenchmarkRunResult[] = [];
  for (const candidate of candidates) {
    for (const taskCase of cases) {
      results.push(await runOne(candidate, taskCase));
    }
  }
  return results;
}
