// PH07-T005 -- ver catalog.ts para el porque de la ubicacion.
import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '@rhia/contracts';
import { OpportunityScoreResultSchema } from '@rhia/opportunity-scoring';
import { NBAActionSchema } from './catalog.js';

/** De donde vino la decision -- nunca un campo cosmetico: `MODEL` obliga a
 * haber pasado por la validacion de catalogo (model-fallback.ts);
 * `FALLBACK` documenta que ni la policy ni el modelo alcanzaron (Errores a
 * evitar: "Oportunidad sin siguiente accion" -- FALLBACK es la ultima red,
 * nunca null). */
export const NBADecisionSourceSchema = z.enum(['RULE', 'MODEL', 'FALLBACK']);
export type NBADecisionSource = z.infer<typeof NBADecisionSourceSchema>;

/**
 * "Opportunity state" (Contexto necesario del packet) tal como lo recibe el
 * motor -- todas las senales YA calculadas por el llamador, mismo principio
 * que @rhia/opportunity-scoring/@rhia/entity-resolver: este paquete no
 * inventa senales, solo decide con las que se le entregan.
 *
 * - `scoreResult`: salida completa de @rhia/opportunity-scoring (PH07-T004,
 *   DONE) cuando ya existe -- `null` si todavia no se calculo para esta
 *   oportunidad. Se recibe el resultado completo (no solo el numero) para
 *   que la rationale pueda citar el breakdown real, nunca un score opaco
 *   (Errores a evitar: "Score opaco de IA" -- ese error es del packet de
 *   scoring, pero el mismo principio aplica aqui: la decision debe poder
 *   explicar CUAL senal del score la motivo).
 * - `sendableContactPointCount`: cuantos ContactPoint de la oportunidad
 *   pasan `isSendableContactPoint` (PH07-T003, contact-point-service.ts) --
 *   0 significa "sin forma de contactar todavia".
 * - `hasPendingReply`: true si el ultimo mensaje en el hilo de conversacion
 *   es del contacto (esperando respuesta nuestra). Ningun canal real
 *   (PH08, Channel Gateway) existe todavia -- el llamador de PRODUCCION de
 *   este motor no puede producir `true` hoy con datos reales; el campo
 *   existe para cuando PH08 lo aporte, y esta cubierto con "Reply pending"
 *   (Pruebas requeridas del packet).
 */
export const NBAInputSchema = z
  .object({
    opportunityId: UuidSchema,
    /** Reloj inyectado (nunca `new Date()` dentro del motor) -- pruebas deterministas. */
    now: TimestampSchema,
    createdAt: TimestampSchema,
    scoreResult: OpportunityScoreResultSchema.nullable(),
    sendableContactPointCount: z.number().int().min(0),
    hasPendingReply: z.boolean(),
    lastContactedAt: TimestampSchema.nullable(),
  })
  .strict();
export type NBAInput = z.infer<typeof NBAInputSchema>;

/**
 * Accion 2, "Configurar pesos" (aqui: "Aplicar policy") -- todos los
 * umbrales y ventanas son configurables por el llamador, nunca constantes
 * dentro del motor (DEFAULT_NBA_POLICY_CONFIG en policy.ts es solo el valor
 * por defecto).
 */
export const NBAPolicyConfigSchema = z
  .object({
    policyVersion: z.string().min(1).max(80),
    /** score < este umbral -> candidato a REVALIDATE (o DISCARD si ademas esta stale). */
    lowScoreThreshold: z.number().min(0).max(1),
    /** score < este umbral (mas estricto que lowScoreThreshold) Y stale -> DISCARD. */
    discardScoreThreshold: z.number().min(0).max(1),
    /** score >= este umbral -> CONTACT proactivo. */
    highScoreThreshold: z.number().min(0).max(1),
    /** Dias desde `createdAt` sin resolver para considerar la oportunidad "stale". */
    staleAfterDays: z.number().int().min(1),
    /** Ventana de `nextActionAt` cuando hay respuesta pendiente (urgente). */
    urgentReplyWindowHours: z.number().min(0),
    /** Ventana de `nextActionAt` para investigar contactabilidad faltante. */
    researchWindowHours: z.number().min(0),
    /** Ventana de `nextActionAt` para revalidar un score bajo. */
    revalidateWindowDays: z.number().min(0),
    /** Ventana de `nextActionAt` por defecto quando no hay senal urgente. */
    waitWindowDays: z.number().min(0),
    /** Ventana de `nextActionAt` para contacto proactivo (score alto, o decidido por el modelo). */
    proactiveContactWindowHours: z.number().min(0),
  })
  .strict();
export type NBAPolicyConfig = z.infer<typeof NBAPolicyConfigSchema>;

/**
 * Accion 6 implicita (misma disciplina de "Score explicable" de T004) +
 * accion 4 "Persist rationale": nunca una accion sin `rationale` no vacia.
 * Accion 5 "Programar next_action_at": `nextActionAt` viaja siempre en la
 * decision (nullable solo para DISCARD -- una oportunidad descartada no
 * necesita una proxima accion programada mientras espera aprobacion).
 */
export const NBADecisionSchema = z
  .object({
    opportunityId: UuidSchema,
    action: NBAActionSchema,
    rationale: z.string().min(1).max(600),
    source: NBADecisionSourceSchema,
    requiresApproval: z.boolean(),
    nextActionAt: TimestampSchema.nullable(),
    policyVersion: z.string().min(1).max(80),
    decidedAt: TimestampSchema,
  })
  .strict();
export type NBADecision = z.infer<typeof NBADecisionSchema>;
