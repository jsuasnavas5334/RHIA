// Secrets & Redaction (PH10-T001) -- "Encrypt contact points sensibles"
// (accion 3). Decision de alcance importante encontrada leyendo
// `packages/db/src/schema.ts` ANTES de escribir codigo (guardrail del
// proyecto: no crecer el esquema de Postgres sin revisar si ya existe una
// tabla/columna reutilizable): `contact_point` YA TIENE `value_encrypted`
// (`bytea`) y `value_hash` (`char(64)`) desde `0005_core_api_persistence.sql`
// -- ninguna migration nueva hace falta. Lo que faltaba (y es lo que este
// archivo agrega) es la funcion real que produce esos 2 valores a partir de
// un contact point en claro (un email o telefono real), y su inverso.
//
// - `value_hash` reusa el MISMO patron ya real de `outreach_suppression
//   .subject_key_hash` y `evidence.excerpt_hash` (SHA-256 hex de 64
//   caracteres, exactamente lo que `char(64)` espera): permite buscar/dedupe
//   un contact point por su valor en claro SIN desencriptar nada.
// - `value_encrypted` usa AES-256-GCM (autenticado -- un valor alterado o
//   una clave incorrecta SIEMPRE falla explicito en vez de devolver texto
//   corrupto en silencio) vía `node:crypto`, sin dependencias externas.
// - Este paquete NUNCA genera ni guarda la clave real: `EncryptionKeyProvider`
//   es una interfaz inyectable resuelta por el host EN RUNTIME -- mismo
//   principio exacto que `SecretResolver` de `@rhia/playwright-worker`
//   (PH09-T002) para `TypeInput.SECRET_REF`. Ningun `.env`/archivo del
//   repositorio contiene una clave real (criterio "No secret en repo/log").
// - Todas las funciones devuelven un resultado tipado (`ok: true/false`) en
//   vez de lanzar excepciones -- mismo estilo que `ManifestValidationResult`
//   de `@rhia/tool-registry` y `AuthorizationDecision` de `@rhia/policy`.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { type SecretsError, createSecretsError } from './errors.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // recomendado para GCM
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Resuelve una referencia de clave (ej. `"vault:contact-points:key-v1"`) a
 * la clave real EN RUNTIME. Nunca implementado por este paquete puro --
 * mismo principio que `SecretResolver` de `@rhia/playwright-worker`.
 */
export interface EncryptionKeyProvider {
  resolveKey(keyRef: string): Promise<Buffer> | Buffer;
}

export type EncryptedContactPoint = Readonly<{
  /** Listo para `contact_point.value_encrypted` (`bytea`): iv (12 bytes) + authTag (16 bytes) + ciphertext, concatenados. */
  valueEncrypted: Uint8Array;
  /** Listo para `contact_point.value_hash` (`char(64)`). */
  valueHash: string;
}>;

export type ContactPointEncryptionResult =
  | Readonly<{ ok: true; encrypted: EncryptedContactPoint }>
  | Readonly<{ ok: false; error: SecretsError }>;

export type ContactPointDecryptionResult =
  | Readonly<{ ok: true; value: string }>
  | Readonly<{ ok: false; error: SecretsError }>;

// Normaliza antes de hashear para que el mismo email/telefono en distinto
// casing/espaciado produzca el mismo `value_hash` -- necesario para que la
// columna sirva de verdad para dedupe real (mismo objetivo que
// `subject_key_hash`). La normalizacion NUNCA se aplica al valor que se
// cifra (`valueEncrypted` preserva el valor original exacto).
const normalizeForHash = (rawValue: string): string => rawValue.trim().toLowerCase();

export const hashContactPointValue = (rawValue: string): string =>
  createHash('sha256').update(normalizeForHash(rawValue), 'utf8').digest('hex');

/** Compara un valor en claro contra un `value_hash` ya persistido, sin desencriptar nada. */
export const contactPointValueMatchesHash = (rawValue: string, valueHash: string): boolean =>
  hashContactPointValue(rawValue) === valueHash;

const validateKeyLength = (key: Buffer): SecretsError | null =>
  key.length === KEY_LENGTH_BYTES
    ? null
    : createSecretsError(
        'RHIA_SECRETS_INVALID_KEY_LENGTH',
        `La clave de cifrado debe tener ${KEY_LENGTH_BYTES} bytes (AES-256).`,
        `longitud recibida: ${key.length} bytes`,
      );

export const encryptContactPointValue = (rawValue: string, key: Buffer): ContactPointEncryptionResult => {
  if (rawValue.trim().length === 0) {
    return { ok: false, error: createSecretsError('RHIA_SECRETS_EMPTY_VALUE', 'No se puede cifrar un contact point vacio.') };
  }
  const keyError = validateKeyLength(key);
  if (keyError) return { ok: false, error: keyError };

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(rawValue, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ok: true,
    encrypted: {
      valueEncrypted: new Uint8Array(Buffer.concat([iv, authTag, ciphertext])),
      valueHash: hashContactPointValue(rawValue),
    },
  };
};

export const decryptContactPointValue = (valueEncrypted: Uint8Array, key: Buffer): ContactPointDecryptionResult => {
  const keyError = validateKeyLength(key);
  if (keyError) return { ok: false, error: keyError };

  const buffer = Buffer.from(valueEncrypted);
  if (buffer.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    return {
      ok: false,
      error: createSecretsError('RHIA_SECRETS_DECRYPTION_FAILED', 'El valor cifrado es demasiado corto para contener iv+authTag+ciphertext.'),
    };
  }

  const iv = buffer.subarray(0, IV_LENGTH_BYTES);
  const authTag = buffer.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = buffer.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { ok: true, value: plaintext.toString('utf8') };
  } catch {
    return {
      ok: false,
      error: createSecretsError('RHIA_SECRETS_DECRYPTION_FAILED', 'El authTag no es valido -- el valor cifrado fue alterado o la clave es incorrecta.'),
    };
  }
};
