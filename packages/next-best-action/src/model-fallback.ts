// PH07-T005 -- accion 3, "Usar model solo cuando rule engine no baste".
// Integra @rhia/model-router (PH05-T003, DONE) de verdad: arma un
// RouteRequest real, llama ModelRouter.route() (que a su vez respeta
// budget/calidad/privacidad/escalacion -- nada de eso se reimplementa
// aqui), y NUNCA confia en la accion que el modelo devuelve sin pasarla por
// `isCatalogAction` (Errores a evitar: "Modelo inventando acciones fuera de
// catalogo"). Si el modelo no esta disponible, no responde, o responde algo
// invalido, esta funcion devuelve `null` -- decision.ts es quien decide el
// fallback seguro (nunca se inventa aqui una decision "aceptable a medias").
import type { GatewayMessage } from '@rhia/ai-gateway';
import type { ModelRouter, RouteOptions } from '@rhia/model-router';
import type { TaskClassPolicy } from '@rhia/model-router';
import { isCatalogAction, type NBAAction } from './catalog.js';
import type { NBAInput } from './schema.js';

export interface ModelDecisionDeps {
  readonly router: ModelRouter;
  readonly taskClassPolicy: TaskClassPolicy;
  readonly routeOptions: RouteOptions;
  /** Genera un requestId unico por invocacion (nunca un literal fijo -- trazabilidad real). */
  readonly newRequestId: () => string;
}

export interface ModelDecisionOutcome {
  readonly action: NBAAction;
  readonly rationale: string;
  /** Confidence evaluada por el Router para el intento exitoso (ver ConfidenceEvaluator en @rhia/model-router), `null` si no se pudo determinar. */
  readonly confidence: number | null;
  readonly provider: string;
  readonly model: string;
}

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'rationale'],
  properties: {
    action: { type: 'string', enum: ['RESEARCH', 'CONTACT', 'WAIT', 'REVALIDATE', 'DISCARD'] },
    rationale: { type: 'string', minLength: 1, maxLength: 400 },
  },
} as const;

function buildPrompt(input: NBAInput): readonly GatewayMessage[] {
  const facts = {
    opportunityId: input.opportunityId,
    now: input.now,
    createdAt: input.createdAt,
    score: input.scoreResult?.score ?? null,
    scoreBreakdown: input.scoreResult?.breakdown ?? null,
    sendableContactPointCount: input.sendableContactPointCount,
    hasPendingReply: input.hasPendingReply,
    lastContactedAt: input.lastContactedAt,
  };
  return [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text:
            'Eres el motor de Next Best Action de RHIA. Debes elegir EXACTAMENTE una accion del catalogo ' +
            '["RESEARCH","CONTACT","WAIT","REVALIDATE","DISCARD"] para la oportunidad descrita, y explicar por que ' +
            'en una frase. Nunca inventes una accion fuera de esa lista. Responde solo el JSON pedido.',
        },
      ],
    },
    {
      role: 'user',
      content: [{ type: 'text', text: JSON.stringify(facts) }],
    },
  ];
}

function extractText(message: GatewayMessage): string | null {
  const part = message.content.find((entry) => entry.type === 'text');
  return part && part.type === 'text' ? part.text : null;
}

/**
 * Devuelve la decision del modelo YA validada contra el catalogo, o `null`
 * si el Router no eligio candidato, la llamada fallo, o la respuesta no es
 * JSON valido con una accion del catalogo.
 */
export async function decideWithModel(input: NBAInput, deps: ModelDecisionDeps): Promise<ModelDecisionOutcome | null> {
  const decision = await deps.router.route(
    {
      requestId: deps.newRequestId(),
      taskClassId: deps.taskClassPolicy.taskClassId,
      messages: buildPrompt(input),
      tools: [],
      responseFormat: { kind: 'json', jsonSchema: RESPONSE_JSON_SCHEMA },
      maxOutputTokens: 300,
      temperature: 0,
    },
    deps.taskClassPolicy,
    deps.routeOptions,
  );

  if (decision.chosen === null || decision.result === null || decision.result.status !== 'SUCCEEDED') return null;

  const text = extractText(decision.result.message);
  if (text === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (!isCatalogAction(record['action'])) return null;
  const rationale = typeof record['rationale'] === 'string' && record['rationale'].trim().length > 0
    ? record['rationale'].trim().slice(0, 400)
    : null;
  if (rationale === null) return null;

  const succeededAttempt = decision.attempts.find(
    (attempt) =>
      attempt.outcome === 'SUCCEEDED' && attempt.provider === decision.chosen?.provider && attempt.model === decision.chosen?.model,
  );

  return {
    action: record['action'],
    rationale,
    confidence: succeededAttempt?.confidence ?? null,
    provider: decision.chosen.provider,
    model: decision.chosen.model,
  };
}
