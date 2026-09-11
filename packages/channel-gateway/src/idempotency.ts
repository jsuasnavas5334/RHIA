// Idempotencia para envios y webhooks de canal (PH08-T001, accion 3
// "Idempotency key" + criterios "Retry no duplica" / "Delivery callbacks").
//
// Reutiliza el diseño de la tabla generica `core_idempotency` que ya existe
// en @rhia/db (packages/db/src/schema.ts): organizationId + operation +
// idempotencyKey como llave primaria compuesta, mas un `fingerprint` sha256
// del contenido y un `resourceSnapshot` con el resultado ya calculado. Este
// paquete NO crea una tabla nueva -- define la interfaz que un adapter de
// persistencia (en la app/worker, fuera de este paquete puro) implementa
// contra esa tabla ya existente. Ver disciplina "reutilizar antes de crecer
// el esquema" del proyecto.
//
// El `fingerprint` existe para distinguir dos casos que de otro modo se
// confundirian bajo la misma idempotencyKey:
//   - Reintento legitimo: misma key, mismo contenido -> DUPLICATE, se
//     devuelve el resultado ya guardado sin volver a llamar al proveedor.
//   - Reuso indebido de la key con contenido distinto (bug del caller) ->
//     CONFLICT, se rechaza en vez de devolver un resultado que no
//     corresponde a lo que se esta pidiendo enviar/procesar ahora.
//
// Solo se registran resultados definitivos (envios SUCCEEDED, eventos de
// webhook ya parseados con exito). Un FAILED de envio no se registra a
// proposito: si el intento nunca llego a confirmarse con el proveedor
// (timeout, rate limit, error de auth, etc.), un retry real debe poder
// intentarlo de nuevo -- bloquear ese retry seria mas peligroso que
// permitirlo, porque un mensaje que sabemos que no se envio no tiene riesgo
// de duplicado.

import { createHash } from "node:crypto";

export interface IdempotencyKeyInput {
  readonly organizationId: string;
  readonly operation: string;
  readonly idempotencyKey: string;
}

/** Fingerprint deterministico sha256 hex de cualquier valor serializable. */
export function stableFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function computeSendFingerprint(input: {
  readonly channel: string;
  readonly provider: string;
  readonly to: string;
  readonly subject: string | null;
  readonly body: string;
}): string {
  return stableFingerprint({
    channel: input.channel,
    provider: input.provider,
    to: input.to,
    subject: input.subject,
    body: input.body,
  });
}

export type IdempotencyLookup<TSnapshot> =
  | { readonly found: false }
  | {
      readonly found: true;
      readonly fingerprint: string;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly resourceSnapshot: TSnapshot;
    };

export interface IdempotencyRecordInput<TSnapshot> {
  readonly key: IdempotencyKeyInput;
  readonly fingerprint: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceSnapshot: TSnapshot;
}

/**
 * Store inyectable para idempotencia. La implementacion real (fuera de este
 * paquete puro) es una capa fina sobre `core_idempotency` via Drizzle: `get`
 * es un SELECT por PK compuesta, `record` es un INSERT (nunca UPDATE -- la
 * tabla es append-only por diseño, un registro nunca se reescribe).
 */
export interface IdempotencyStore {
  get<TSnapshot = unknown>(key: IdempotencyKeyInput): Promise<IdempotencyLookup<TSnapshot>>;
  record<TSnapshot = unknown>(input: IdempotencyRecordInput<TSnapshot>): Promise<void>;
}

/**
 * Implementacion en memoria para pruebas y para desarrollo local sin DB.
 * Nunca debe usarse en produccion (se pierde al reiniciar el proceso, y no
 * es segura entre replicas) -- la produccion usa la implementacion real
 * sobre `core_idempotency`.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, IdempotencyLookup<unknown> & { found: true }>();

  private keyOf(key: IdempotencyKeyInput): string {
    return `${key.organizationId}::${key.operation}::${key.idempotencyKey}`;
  }

  async get<TSnapshot = unknown>(key: IdempotencyKeyInput): Promise<IdempotencyLookup<TSnapshot>> {
    const existing = this.entries.get(this.keyOf(key));
    if (existing === undefined) {
      return { found: false };
    }
    return existing as IdempotencyLookup<TSnapshot> & { found: true };
  }

  async record<TSnapshot = unknown>(input: IdempotencyRecordInput<TSnapshot>): Promise<void> {
    this.entries.set(this.keyOf(input.key), {
      found: true,
      fingerprint: input.fingerprint,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceSnapshot: input.resourceSnapshot,
    });
  }
}
