// PH07-T003 (Contact Validation v1) -- cifrado real de
// `contact_point.value_encrypted` (bytea, `packages/db/src/schema.ts`,
// PH03-T001). AES-256-GCM con `node:crypto` (stdlib, sin dependencia nueva):
// autenticado (detecta manipulacion del ciphertext, no solo lo oculta) y ya
// disponible en el runtime de Node del repo -- no se agrega ninguna libreria
// de cifrado externa para esto.
//
// La clave NUNCA se hardcodea en el repo (regla fija del proyecto: "secretos
// nuevos solo con autorizacion explicita y siempre fuera del repositorio")
// -- `EnvEncryptionKeyProvider` la lee de una variable de entorno y falla
// ruidosamente (nunca genera una clave silenciosa ni cifra con un valor por
// defecto) si falta o tiene el formato incorrecto. Ver "Fuera de alcance" en
// docs/progress/PH07-T003.md: aprovisionar esa variable en produccion es
// trabajo de operaciones humanas, fuera de este ciclo.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ErrorCode } from '@rhia/domain';
import type { EncryptionKeyProvider } from './ports.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

export class ContactPointCryptoError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContactPointCryptoError';
  }
}

/** Cifra `plaintext` (el valor YA normalizado, ver contact-point-service.ts)
 * con una clave de 32 bytes. El resultado empaqueta IV + authTag + ciphertext
 * en un unico Buffer (mismo formato que `decryptContactPointValue` espera),
 * listo para `contact_point.value_encrypted` (bytea). */
export const encryptContactPointValue = (plaintext: string, key: Buffer): Buffer => {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new ContactPointCryptoError('RHIA_CORE_UNEXPECTED_FAILURE', `La clave de cifrado debe tener ${KEY_LENGTH_BYTES} bytes.`);
  }
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
};

/** Descifra un Buffer producido por `encryptContactPointValue`. Lanza si la
 * clave no coincide o el ciphertext fue manipulado (GCM autenticado --
 * nunca devuelve un valor "posiblemente corrupto" en silencio). */
export const decryptContactPointValue = (payload: Buffer, key: Buffer): string => {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new ContactPointCryptoError('RHIA_CORE_UNEXPECTED_FAILURE', `La clave de cifrado debe tener ${KEY_LENGTH_BYTES} bytes.`);
  }
  const iv = payload.subarray(0, IV_LENGTH_BYTES);
  const authTag = payload.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = payload.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

const DEFAULT_ENV_VAR_NAME = 'RHIA_CONTACT_POINT_ENCRYPTION_KEY';

/** Lee la clave de `process.env[envVarName]` como 64 caracteres hex (32
 * bytes). Nunca cachea un fallback ni genera una clave aleatoria por sí
 * misma -- sin la variable configurada, cualquier intento de cifrar/
 * descifrar falla explícitamente (mejor un error claro en desarrollo que
 * una clave efímera que invalidaría datos ya cifrados en un reinicio). */
export class EnvEncryptionKeyProvider implements EncryptionKeyProvider {
  constructor(private readonly envVarName: string = DEFAULT_ENV_VAR_NAME) {}

  getKey(): Buffer {
    const raw = process.env[this.envVarName];
    if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) {
      throw new ContactPointCryptoError(
        'RHIA_CORE_UNEXPECTED_FAILURE',
        `La variable de entorno ${this.envVarName} debe contener 64 caracteres hexadecimales (32 bytes) -- no configurada o con formato invalido.`,
      );
    }
    return Buffer.from(raw, 'hex');
  }
}

/** Adapter para tests/desarrollo local: clave fija generada UNA VEZ por
 * instancia (nunca un literal en el codigo fuente) -- nunca usar en
 * produccion real, solo para no depender de la variable de entorno en
 * corridas de `node --test`. */
export class StaticEncryptionKeyProvider implements EncryptionKeyProvider {
  private readonly key: Buffer;

  constructor(key: Buffer = randomBytes(KEY_LENGTH_BYTES)) {
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new ContactPointCryptoError('RHIA_CORE_UNEXPECTED_FAILURE', `La clave de cifrado debe tener ${KEY_LENGTH_BYTES} bytes.`);
    }
    this.key = key;
  }

  getKey(): Buffer {
    return this.key;
  }
}
