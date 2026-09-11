// Tool Registry (PH09-T001) -- autorizacion de UNA invocacion real de una
// tool. "Validacion final" del packet: "Runtime rechaza tool fuera de
// capability". Reusa `serviceCapabilityCeilings`/`Principal` REALES de
// `@rhia/policy` (misma regla que `authorize()` aplica a cualquier accion
// de servicio) -- nunca reimplementa el chequeo de techo de capability.

import { serviceCapabilityCeilings, type Principal } from '@rhia/policy';
import { isToolAvailable, type ToolHealthRecord } from './health.js';
import type { ToolManifest } from './contracts.js';

/**
 * `'RHIA_TOOL_FORBIDDEN'` coincide LITERALMENTE (mismo string) con el
 * codigo real ya catalogado en `@rhia/domain#errorCodes`
 * ("La capability o política no autoriza la herramienta") -- se reusa el
 * VALOR real por consistencia en logs/errores entre sistemas, aunque este
 * tipo local no importe `ErrorCode` de `@rhia/domain` directamente (los
 * otros 3 codigos -- disponibilidad, accion, dominio -- son especificos de
 * Tool Registry y no tienen contraparte real en el catalogo compartido
 * hoy; mismo patron ya usado por `CalendarErrorCode`/`ChannelErrorCode` en
 * los paquetes hermanos de PH08).
 */
export const toolDenialCodes = ['RHIA_TOOL_FORBIDDEN', 'RHIA_TOOL_UNAVAILABLE', 'RHIA_TOOL_ACTION_FORBIDDEN', 'RHIA_TOOL_DOMAIN_FORBIDDEN'] as const;
export type ToolDenialCode = (typeof toolDenialCodes)[number];

export type ToolAuthorizationDecision =
  | Readonly<{ outcome: 'ALLOW' }>
  | Readonly<{ outcome: 'DENY'; code: ToolDenialCode; reason: string }>;

export type AuthorizeToolInvocationInput = Readonly<{
  principal: Principal;
  manifest: ToolManifest;
  health: ToolHealthRecord | undefined;
  requestedAction: string;
  requestedDomain?: string;
}>;

/**
 * Prueba requerida "Unauthorized tool": `principal` sin la capability
 * requerida (o que excede el techo real del servicio) -> `DENY`
 * `RHIA_TOOL_FORBIDDEN`, SIN evaluar salud/accion/dominio (fail fast en el
 * chequeo mas fundamental). Prueba requerida "Tool down": capability
 * correcta pero `health` no disponible -> `DENY` `RHIA_TOOL_UNAVAILABLE`.
 */
export const authorizeToolInvocation = (input: AuthorizeToolInvocationInput): ToolAuthorizationDecision => {
  const { principal, manifest, health, requestedAction, requestedDomain } = input;

  if (principal.kind !== 'SERVICE') {
    return { outcome: 'DENY', code: 'RHIA_TOOL_FORBIDDEN', reason: 'Las tools solo pueden ser invocadas por identidades de servicio (agentes).' };
  }
  const ceiling = serviceCapabilityCeilings[principal.service] as readonly string[];
  if (!principal.capabilities.includes(manifest.requiredCapability) || !ceiling.includes(manifest.requiredCapability)) {
    return { outcome: 'DENY', code: 'RHIA_TOOL_FORBIDDEN', reason: `La identidad de servicio no tiene la capability requerida ('${manifest.requiredCapability}') o excede el techo real del servicio.` };
  }

  if (!isToolAvailable(health)) {
    return { outcome: 'DENY', code: 'RHIA_TOOL_UNAVAILABLE', reason: `La tool '${manifest.id}' no esta disponible (health check ${health?.status ?? 'UNKNOWN'}).` };
  }

  if (!manifest.allowedActions.includes(requestedAction)) {
    return { outcome: 'DENY', code: 'RHIA_TOOL_ACTION_FORBIDDEN', reason: `La accion '${requestedAction}' no esta en las acciones permitidas de la tool '${manifest.id}'.` };
  }

  if (requestedDomain && manifest.allowedDomains.length > 0 && !manifest.allowedDomains.includes(requestedDomain)) {
    return { outcome: 'DENY', code: 'RHIA_TOOL_DOMAIN_FORBIDDEN', reason: `El dominio '${requestedDomain}' no esta permitido para la tool '${manifest.id}'.` };
  }

  return { outcome: 'ALLOW' };
};
