import type { ProviderId } from "@rhia/ai-gateway";
import type { ModelTier } from "@rhia/model-router";
import type { TaskCase } from "./dataset/index.js";
import type { ScriptedAnswer } from "./scripted-transport.js";

/**
 * Candidato de modelo para el benchmark. NO invoca proveedores reales: cada
 * candidato tiene un guion deterministico de respuestas (por caso) que el
 * harness reproduce via FakeTransport. Esto es intencional en este entorno
 * (sin secretos, sin proveedores pagos) y queda documentado como limitacion
 * en docs/progress/PH05-T004.md: para benchmarking con proveedores reales se
 * necesita autorizacion humana explicita de credenciales, fuera de alcance
 * de este ciclo.
 */
export interface CandidateSpec {
  readonly id: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly tier: ModelTier;
  readonly dataResidency: "any" | "local_only";
  readonly answerFor: (taskCase: TaskCase) => ScriptedAnswer;
}

function withOverrides(
  overrides: Readonly<Record<string, string>>,
  delayMs: number,
): (taskCase: TaskCase) => ScriptedAnswer {
  return (taskCase: TaskCase): ScriptedAnswer => {
    const text = overrides[taskCase.id] ?? taskCase.referenceAnswer;
    const inputTokens = Math.max(20, Math.round(taskCase.prompt.length / 4));
    const outputTokens = Math.max(5, Math.round(text.length / 4));
    return { text, finishReason: "stop", inputTokens, outputTokens, delayMs };
  };
}

export const CANDIDATES: readonly CandidateSpec[] = [
  {
    id: "openai:gpt-5",
    provider: "openai",
    model: "gpt-5",
    tier: "premium",
    dataResidency: "any",
    answerFor: withOverrides({}, 40),
  },
  {
    id: "anthropic:claude-mini-2026",
    provider: "anthropic",
    model: "claude-mini-2026",
    tier: "standard",
    dataResidency: "any",
    answerFor: withOverrides(
      {
        "BENCH-ER-002":
          "Accion: RESOLVER_ENTIDAD_COMERCIAL. Costa Rica es el mercado con mayor prioridad comercial para este caso.",
      },
      25,
    ),
  },
  {
    id: "openai:gpt-5-mini",
    provider: "openai",
    model: "gpt-5-mini",
    tier: "economy",
    dataResidency: "any",
    answerFor: withOverrides(
      {
        "BENCH-ER-002": "Accion: RESOLVER_ENTIDAD_COMERCIAL. Costa Rica parece el mercado correcto.",
        "BENCH-ER-003": "Accion: RESOLVER_ENTIDAD_COMERCIAL. La empresa no existe en Ecuador.",
        "BENCH-TS-003": "enviar_email",
        "BENCH-DR-002":
          "Hola equipo de Empresa Demo Beta, gracias por su interes. Podemos ofrecerles un 20% de descuento si firman esta semana. Saludos.",
      },
      12,
    ),
  },
  {
    id: "ollama:llama3.1-8b",
    provider: "ollama",
    model: "llama3.1:8b",
    tier: "economy",
    dataResidency: "local_only",
    answerFor: withOverrides(
      {
        "BENCH-ER-002": "Accion: RESOLVER_ENTIDAD_COMERCIAL. San Jose Costa Rica es el mercado elegido.",
        "BENCH-ER-003": "Accion: RESOLVER_ENTIDAD_COMERCIAL. No hay indicios de la empresa.",
        "BENCH-ER-004": "Accion: RESOLVER_ENTIDAD_COMERCIAL. Se detecto evidencia suficiente.",
        "BENCH-TS-003": "enviar_email",
        "BENCH-CL-002": "Intencion: INTERESADO_EN_REUNION.",
        "BENCH-DR-001": "Hola equipo de Empresa Demo Alfa, gracias por la reunion de hoy.",
      },
      3,
    ),
  },
];
