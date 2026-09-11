// PH07-T003 -- Contact Validation v1. Cubre las 5 acciones del packet:
//   1. Normalizar            -> normalizeContactPointValue
//   2. Dedup hash             -> hashContactPointValue + ContactPointRepository.findByHash
//   3. Validar formato        -> validateContactPointFormat
//   4. Usar validators/provider cuando se configure -> ver "Fuera de alcance" en docs/progress/PH07-T003.md
//   5. Marcar confidence/freshness -> lastValidatedAt (freshness) + confidenceForStatus (derivado, no persistido -- ver mas abajo)
//
// Y los 3 criterios de aceptacion:
//   - "No envia a INVALID"              -> isSendableContactPoint
//   - "Unknown no se presenta como verified" -> effectiveValidationStatus (degrada VERIFIED->UNVERIFIED si quedo stale)
//   - "PII protegida"                    -> el valor real NUNCA sale de este archivo sin pasar por maskContactPointValue;
//                                            se persiste cifrado (contact-point-crypto.ts) + solo un hash sha256 para dedupe;
//                                            el audit trail (accion "CONTACT_POINT_CREATED") nunca incluye el valor ni su hash en claro
//                                            en un campo logueable fuera de afterHash (que ya es, el mismo, un hash -- ver create()).

import { createHash } from 'node:crypto';
import { authorize, type Principal } from '@rhia/policy';
import { ContactPointSchema, CreateContactPointSchema, type ContactPoint } from './contracts.js';
import { CoreServiceError } from './company-service.js';
import { decryptContactPointValue, encryptContactPointValue } from './contact-point-crypto.js';
import type { ContactPointRecord, CoreDependencies, IdempotentResource } from './ports.js';

const hash = (value: object): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const requireRecords = (principal: Principal, mode: 'read' | 'write'): void => {
  const decision = authorize(principal, mode === 'read' ? 'READ_OPERATIONS' : 'WRITE_OPERATIONS');
  if (decision.outcome !== 'ALLOW') {
    throw new CoreServiceError(decision.code ?? 'RHIA_POLICY_DENIED', 403, decision.reason);
  }
};

const replay = (
  stored: Readonly<{ fingerprint: string; resource: IdempotentResource }> | undefined,
  expectedFingerprint: string,
): ContactPointRecord | undefined => {
  if (!stored) return undefined;
  if (stored.fingerprint !== expectedFingerprint) {
    throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 409, 'La idempotency key ya fue usada con otro payload.');
  }
  if (stored.resource.resourceType !== 'CONTACT_POINT') {
    throw new CoreServiceError('RHIA_CORE_UNEXPECTED_FAILURE', 409, 'El ledger idempotente contiene otro tipo de recurso.');
  }
  return stored.resource.value;
};

export type ContactPointType = ContactPointRecord['pointType'];
export type ContactPointValidationStatus = ContactPointRecord['validationStatus'];

// Heuristica v1 deliberadamente simple (misma filosofia que
// evidence-pipeline/claim-extraction.ts): regex explicito, documentado, sin
// pretender ser un validador RFC completo. "Usar validators/provider cuando
// se configure" (accion 4) es la capa que SI verificaria de verdad que el
// buzon/numero existe -- fuera de alcance sin credenciales.
export const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164: '+' seguido de 8 a 15 digitos, el primero distinto de 0.
export const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

/** Accion 1, "Normalizar". EMAIL: trim + minusculas (el dominio es case-
 * insensitive en la practica, aunque el local-part tecnicamente no lo sea
 * segun RFC -- heuristica v1 documentada, igual que el resto del packet).
 * PHONE/WHATSAPP: conserva un '+' inicial si vino, descarta cualquier
 * caracter que no sea digito (espacios, guiones, parentesis) -- NUNCA
 * inventa un codigo de pais si no vino con '+' (forzar uno seria "inventar
 * datos sin marcarlos inferidos", el mismo error a evitar del packet
 * aplicado aqui a numeros en vez de emails). */
export const normalizeContactPointValue = (pointType: ContactPointType, rawValue: string): string => {
  const trimmed = rawValue.trim();
  if (pointType === 'EMAIL') return trimmed.toLowerCase();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
};

/** Accion 3, "Validar formato". */
export const validateContactPointFormat = (pointType: ContactPointType, normalizedValue: string): boolean =>
  pointType === 'EMAIL' ? EMAIL_FORMAT_REGEX.test(normalizedValue) : E164_PHONE_REGEX.test(normalizedValue);

/** Accion 2, "Dedup hash". sha256 del valor YA normalizado -- nunca se
 * persiste ni se loguea el valor en claro, solo esta huella (igual
 * principio que `hashExcerpt` en evidence-pipeline, aplicado aqui a PII en
 * vez de texto de evidencia). */
export const hashContactPointValue = (normalizedValue: string): string => createHash('sha256').update(normalizedValue).digest('hex');

/** Enmascara el valor para cualquier salida (API, logs, UI) -- criterio de
 * aceptacion "PII protegida". EMAIL conserva el primer caracter del
 * local-part + el dominio completo (suficiente para que un humano reconozca
 * DE QUE cuenta se trata sin exponerla entera). PHONE/WHATSAPP conserva
 * solo los ultimos 4 digitos (convencion estandar de la industria, misma
 * que usan tarjetas de credito enmascaradas). */
export const maskContactPointValue = (pointType: ContactPointType, normalizedValue: string): string => {
  if (pointType === 'EMAIL') {
    const atIndex = normalizedValue.indexOf('@');
    if (atIndex <= 0) return '***';
    const localPart = normalizedValue.slice(0, atIndex);
    const domain = normalizedValue.slice(atIndex + 1);
    const visible = localPart.slice(0, 1);
    return `${visible}${'*'.repeat(Math.max(1, localPart.length - 1))}@${domain}`;
  }
  const digits = normalizedValue.replace(/\D/g, '');
  const lastFour = digits.slice(-4);
  const maskedPrefix = '*'.repeat(Math.max(0, digits.length - lastFour.length));
  return `${maskedPrefix}${lastFour}`;
};

// Los formatos/canales cambian con mas frecuencia que la vigencia de un
// email/telefono en si -- 180 dias (6 meses) es una heuristica v1 explicita
// (mas corta que los 270 dias de titulos en @rhia/contact-discovery, que a
// su vez es mas corta que los 365 dias de hechos de compania en
// evidence-pipeline: cada capa documenta su propio umbral, ninguna reutiliza
// el numero de otra sin justificarlo).
export const DEFAULT_VALIDATION_STALE_AFTER_DAYS = 180;

/** `lastValidatedAt === null` (nunca validado) cuenta como stale -- nunca
 * "fresco por defecto" ante ausencia de dato. */
export const isValidationStale = (
  lastValidatedAt: string | null,
  now: Date,
  staleAfterDays: number = DEFAULT_VALIDATION_STALE_AFTER_DAYS,
): boolean => {
  if (!lastValidatedAt) return true;
  const ageMs = now.getTime() - new Date(lastValidatedAt).getTime();
  return ageMs > staleAfterDays * 24 * 60 * 60 * 1000;
};

/** Criterio de aceptacion "Unknown no se presenta como verified": el status
 * EFECTIVO (el que se muestra/usa, nunca el guardado en la fila) degrada
 * VERIFIED -> UNVERIFIED cuando la validacion quedo vieja -- una
 * verificacion vieja vuelve a ser, honestamente, una incognita ("unknown"),
 * no algo que se siga presentando como confirmado. INVALID nunca se degrada
 * por antiguedad (es un problema de formato, no de vigencia -- seguiria
 * siendo INVALID hoy sin importar cuando se detecto). */
export const effectiveValidationStatus = (
  point: Readonly<{ validationStatus: ContactPointValidationStatus; lastValidatedAt: string | null }>,
  now: Date,
  staleAfterDays: number = DEFAULT_VALIDATION_STALE_AFTER_DAYS,
): ContactPointValidationStatus =>
  point.validationStatus === 'VERIFIED' && isValidationStale(point.lastValidatedAt, now, staleAfterDays)
    ? 'UNVERIFIED'
    : point.validationStatus;

/** Criterio de aceptacion "No envia a INVALID": excluye explicitamente los
 * puntos INVALID de cualquier seleccion para outreach -- staleness no
 * cambia este resultado (un INVALID stale sigue siendo INVALID, nunca se
 * "recupera" solo por pasar el tiempo). */
export const isSendableContactPoint = (point: Readonly<{ validationStatus: ContactPointValidationStatus }>): boolean =>
  point.validationStatus !== 'INVALID';

/** Confianza derivada (accion 5, "marcar confidence") -- NUNCA se persiste
 * como columna nueva (contact_point no tiene una, y no habia justificacion
 * real para crecer el esquema solo para esto, ver regla fija del proyecto)
 * -- se calcula en lectura a partir del status efectivo. INVALID=0,
 * UNVERIFIED=0.5 (formato ok, sin confirmar), VERIFIED=1.0 (solo alcanzable
 * cuando haya un provider real conectado). */
export const confidenceForStatus = (status: ContactPointValidationStatus): number => {
  if (status === 'INVALID') return 0;
  if (status === 'VERIFIED') return 1;
  return 0.5;
};

export class ContactPointService {
  constructor(private readonly dependencies: CoreDependencies) {}

  async listByContact(principal: Principal, contactId: string): Promise<readonly ContactPoint[]> {
    requireRecords(principal, 'read');
    const records = await this.dependencies.contactPoints.listByContact(principal.organizationId, contactId);
    return records.map((record) => this.toContract(record));
  }

  /** Accion 1+2+3+5 combinadas + los 3 criterios de aceptacion. Nunca
   * recibe ni retorna el valor en claro fuera de este metodo (se descifra
   * solo dentro de `toContract`, para enmascarar antes de salir). */
  async create(
    principal: Principal,
    rawInput: unknown,
    correlationId: string,
  ): Promise<Readonly<{ contactPoint: ContactPoint; replayed: boolean }>> {
    requireRecords(principal, 'write');
    const parsed = CreateContactPointSchema.safeParse(rawInput);
    if (!parsed.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'El payload de contact point no cumple el contrato v1.');
    const input = parsed.data;

    const normalizedValue = normalizeContactPointValue(input.pointType, input.rawValue);
    const valueHash = hashContactPointValue(normalizedValue);
    const formatValid = validateContactPointFormat(input.pointType, normalizedValue);
    const validationStatus: ContactPointValidationStatus = formatValid ? 'UNVERIFIED' : 'INVALID';

    // El fingerprint de idempotencia usa el HASH, nunca el valor normalizado
    // -- ni siquiera transitoriamente termina en el ledger de idempotencia
    // (que persiste el fingerprint) ni en ningun log de esta funcion.
    const fingerprint = hash({ contactId: input.contactId, pointType: input.pointType, valueHash, sourceId: input.sourceId ?? null });

    return this.dependencies.unitOfWork.execute(async () => {
      const stored = await this.dependencies.idempotency.get(principal.organizationId, 'CONTACT_POINT_CREATE', input.idempotencyKey);
      const priorByKey = replay(stored, fingerprint);
      if (priorByKey) return { contactPoint: this.toContract(priorByKey), replayed: true };

      // Dedup hash (accion 2): el mismo valor normalizado para el mismo
      // contacto+tipo nunca produce una segunda fila, aunque haya llegado
      // con una idempotencyKey nueva (ej. "Duplicate phone": dos hits
      // distintos de Contact Discovery encontrando el mismo telefono).
      const existing = await this.dependencies.contactPoints.findByHash(principal.organizationId, input.contactId, input.pointType, valueHash);
      if (existing) {
        await this.dependencies.idempotency.put(principal.organizationId, 'CONTACT_POINT_CREATE', input.idempotencyKey, {
          fingerprint, resource: { resourceType: 'CONTACT_POINT', value: existing },
        });
        return { contactPoint: this.toContract(existing), replayed: true };
      }

      const occurredAt = this.dependencies.now().toISOString();
      const key = this.dependencies.encryptionKeys.getKey();
      const valueEncrypted = encryptContactPointValue(normalizedValue, key);

      const record: ContactPointRecord = {
        id: this.dependencies.newId(),
        organizationId: principal.organizationId,
        contactId: input.contactId,
        pointType: input.pointType,
        valueEncrypted,
        valueHash,
        validationStatus,
        sourceId: input.sourceId ?? null,
        // Accion 5, "marcar freshness": se marca AL MOMENTO de la validacion
        // de formato, aunque no haya provider real todavia -- es la unica
        // verificacion real que este ciclo puede hacer, y se documenta como
        // tal (nunca se marca como si fuera una verificacion de provider).
        lastValidatedAt: occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      await this.dependencies.contactPoints.create(record);
      await this.dependencies.audit.append({
        id: this.dependencies.newId(),
        organizationId: principal.organizationId,
        actorId: principal.id,
        actorType: principal.kind,
        action: 'CONTACT_POINT_CREATED',
        resourceType: 'CONTACT_POINT',
        resourceId: record.id,
        // NUNCA el valor ni el valueHash en claro en un campo que un
        // operador pudiera leer directo del audit trail como si fuera el
        // dato real -- se re-hashea junto con metadata no sensible, mismo
        // principio que "guardar secretos en logs" (error a evitar del
        // packet) aplicado tambien al audit trail, no solo a logs de texto.
        afterHash: hash({ id: record.id, pointType: record.pointType, validationStatus: record.validationStatus }),
        occurredAt,
        correlationId,
      });
      await this.dependencies.idempotency.put(principal.organizationId, 'CONTACT_POINT_CREATE', input.idempotencyKey, {
        fingerprint, resource: { resourceType: 'CONTACT_POINT', value: record },
      });
      return { contactPoint: this.toContract(record), replayed: false };
    });
  }

  private toContract(record: ContactPointRecord): ContactPoint {
    const key = this.dependencies.encryptionKeys.getKey();
    const normalizedValue = decryptContactPointValue(record.valueEncrypted, key);
    const now = this.dependencies.now();
    return ContactPointSchema.parse({
      id: record.id,
      organizationId: record.organizationId,
      contactId: record.contactId,
      pointType: record.pointType,
      valueMasked: maskContactPointValue(record.pointType, normalizedValue),
      valueHash: record.valueHash,
      validationStatus: effectiveValidationStatus(record, now),
      sourceId: record.sourceId,
      lastValidatedAt: record.lastValidatedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
