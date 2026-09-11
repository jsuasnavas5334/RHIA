// Tool Registry (PH09-T001) -- contratos del manifest. "Contexto
// necesario" del packet: "Capability model". `requiredCapability` reusa
// literalmente `CapabilityKey`/`capabilityKeys` REALES de `@rhia/policy`
// (PH03-T002, ya cerrada) -- este ciclo no crea un modelo de capabilities
// paralelo; una herramienta nueva solo puede requerir una capability que
// YA exista en el modelo real (`records.read`, `jobs.execute`,
// `outreach.send`, etc.). Si una herramienta futura necesita una
// capability que hoy no existe, eso es una decision de `@rhia/policy`
// (reabrir esa tarea con evidencia real), no algo que este paquete deba
// inventar por su cuenta.
//
// Ninguna tabla real existe todavia para `tool`/`tool_registry` en
// `packages/db/src/schema.ts` -- "Archivos o areas afectadas" del packet
// dice "tools registry" sin senalar una tabla ya existente, asi que esta
// es la primera vez que el proyecto modela esto. Este ciclo NO propone una
// migration nueva (paquete puro, sin persistencia real, mismo patron que
// todos los hermanos de PH08) -- ver docs/progress/PH09-T001.md "Fuera de
// alcance" para la decision explicita de dejar esa migration a un ciclo
// futuro con `device_bash`/Postgres real disponible.

import { capabilityKeys, type CapabilityKey } from '@rhia/policy';

export const toolRiskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ToolRiskLevel = (typeof toolRiskLevels)[number];

export type ToolManifest = Readonly<{
  id: string;
  name: string;
  /** Responsable humano/equipo -- NUNCA una credencial. Criterio de aceptacion "Cada tool tiene owner y risk". */
  ownerRef: string;
  riskLevel: ToolRiskLevel;
  /** Reusa el modelo real de `@rhia/policy` -- ver comentario de cabecera. */
  requiredCapability: CapabilityKey;
  /**
   * Referencia/nombre de un secreto guardado en otro lugar (p. ej. un
   * vault real) -- NUNCA el valor real de la credencial. `null` para
   * herramientas que no necesitan credencial (p. ej. un adapter puro sin
   * red). Error a evitar del packet: "Pasar credenciales en prompt" --
   * este campo se valida en `validateToolManifest` para rechazar cualquier
   * valor que "parezca" un secreto real (heuristica, ver
   * `looksLikeRawSecret`), nunca solo confiar en el nombre del campo.
   */
  credentialRef: string | null;
  /** Dominios permitidos para herramientas con superficie de red (p. ej. `['api.ejemplo.com']`). Vacio para herramientas sin red. */
  allowedDomains: readonly string[];
  /** Acciones permitidas (p. ej. `['GET','POST']` o `['click','type']`). Error a evitar "Tools sin policy" -- una herramienta SIEMPRE debe declarar al menos una accion permitida. */
  allowedActions: readonly string[];
}>;

export type ManifestValidationError = Readonly<{ field: string; reason: string }>;
export type ManifestValidationResult =
  | Readonly<{ valid: true; manifest: ToolManifest }>
  | Readonly<{ valid: false; errors: readonly ManifestValidationError[] }>;

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * Heuristica de defensa en profundidad (no una garantia matematica --
 * documentado como tal, mismo espiritu honesto que el resto del proyecto
 * sobre limites de deteccion por patrones): rechaza `credentialRef` que
 * "parece" un secreto real en vez de una referencia/nombre corto. Nunca
 * sustituye la regla real del proyecto ("nunca escribir contraseñas o
 * credenciales... nunca guardar credenciales reales en archivos, memoria
 * o logs") -- es una capa adicional para detectar el error ANTES de que
 * un manifest con una credencial real pegada por accidente llegue a
 * registrarse.
 */
export const looksLikeRawSecret = (value: string): boolean => {
  const patterns = [
    /^bearer\s+/i,
    /^sk-[a-z0-9]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/, // JWT-like: header.payload.signature
  ];
  if (patterns.some((pattern) => pattern.test(value))) return true;
  // Cadena larga, sin espacios, alta densidad de caracteres alfanumericos/simbolos tipicos de un secreto real (base64/hex) -- una referencia real ("vault:tool-x:api-key") es corta y legible, un secreto real suele ser largo y sin estructura de nombre.
  if (value.length > 40 && !/\s/.test(value) && /^[A-Za-z0-9+/_=.-]+$/.test(value) && !/^[a-z0-9]+(?:[:._-][a-z0-9]+)+$/i.test(value)) return true;
  return false;
};

export const validateToolManifest = (raw: unknown): ManifestValidationResult => {
  const errors: ManifestValidationError[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: [{ field: 'root', reason: 'El manifest debe ser un objeto.' }] };
  }
  const input = raw as Record<string, unknown>;

  if (!nonEmptyString(input['id'])) errors.push({ field: 'id', reason: 'id requerido, string no vacio.' });

  const name = input['name'];
  if (!nonEmptyString(name)) {
    errors.push({ field: 'name', reason: 'name requerido, string no vacio.' });
  } else if (looksLikeRawSecret(name)) {
    errors.push({ field: 'name', reason: 'name parece contener una credencial real, no un nombre de herramienta -- error a evitar "Pasar credenciales en prompt". Gap real documentado en docs/security/threat-model.md seccion 7 (PH10-T003): antes, validateToolManifest solo aplicaba esta heuristica a credentialRef.' });
  }

  const ownerRef = input['ownerRef'];
  if (!nonEmptyString(ownerRef)) {
    errors.push({ field: 'ownerRef', reason: 'ownerRef requerido -- criterio "Cada tool tiene owner".' });
  } else if (looksLikeRawSecret(ownerRef)) {
    errors.push({ field: 'ownerRef', reason: 'ownerRef parece contener una credencial real, no un responsable humano/equipo -- error a evitar "Pasar credenciales en prompt". Gap real documentado en docs/security/threat-model.md seccion 7 (PH10-T003): antes, validateToolManifest solo aplicaba esta heuristica a credentialRef, nunca a ownerRef ni a name.' });
  }

  const riskLevel = input['riskLevel'];
  if (typeof riskLevel !== 'string' || !toolRiskLevels.includes(riskLevel as ToolRiskLevel)) {
    errors.push({ field: 'riskLevel', reason: `riskLevel debe ser uno de: ${toolRiskLevels.join(', ')} -- criterio "Cada tool tiene... risk".` });
  }

  const requiredCapability = input['requiredCapability'];
  if (typeof requiredCapability !== 'string' || !capabilityKeys.includes(requiredCapability as CapabilityKey)) {
    errors.push({ field: 'requiredCapability', reason: `requiredCapability debe ser una capability real de @rhia/policy: ${capabilityKeys.join(', ')} -- error a evitar "Tools sin policy".` });
  }

  const credentialRef = input['credentialRef'];
  if (credentialRef !== null && credentialRef !== undefined) {
    if (typeof credentialRef !== 'string' || credentialRef.trim().length === 0) {
      errors.push({ field: 'credentialRef', reason: 'credentialRef debe ser null o un string no vacio.' });
    } else if (looksLikeRawSecret(credentialRef)) {
      errors.push({ field: 'credentialRef', reason: 'credentialRef parece una credencial real, no una referencia -- error a evitar "Pasar credenciales en prompt". Usa un nombre/id de vault, nunca el secreto.' });
    }
  }

  const allowedDomains = input['allowedDomains'];
  if (!Array.isArray(allowedDomains) || !allowedDomains.every((domain) => typeof domain === 'string')) {
    errors.push({ field: 'allowedDomains', reason: 'allowedDomains debe ser un array de strings (puede estar vacio).' });
  }

  const allowedActions = input['allowedActions'];
  if (!Array.isArray(allowedActions) || allowedActions.length === 0 || !allowedActions.every((action) => nonEmptyString(action))) {
    errors.push({ field: 'allowedActions', reason: 'allowedActions debe tener al menos una accion -- error a evitar "Tools sin policy".' });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    manifest: {
      id: input['id'] as string,
      name: input['name'] as string,
      ownerRef: input['ownerRef'] as string,
      riskLevel: riskLevel as ToolRiskLevel,
      requiredCapability: requiredCapability as CapabilityKey,
      credentialRef: (credentialRef as string | null | undefined) ?? null,
      allowedDomains: allowedDomains as readonly string[],
      allowedActions: allowedActions as readonly string[],
    },
  };
};
