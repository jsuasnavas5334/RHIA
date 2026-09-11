// Tool Registry (PH09-T001), acciones 1-3 ("Definir tool manifest",
// "Registrar capabilities", "Mapear credentials refs"). Registro en
// memoria (paquete puro, sin persistencia real -- mismo patron que todos
// los hermanos de PH08/PH09; ver docs/progress/PH09-T001.md "Fuera de
// alcance" para la migration real pendiente).

import type { ServiceIdentity } from '@rhia/policy';
import { serviceCapabilityCeilings, type Principal } from '@rhia/policy';
import { validateToolManifest, type ManifestValidationError, type ToolManifest } from './contracts.js';
import { isToolAvailable, type ToolHealthRecord } from './health.js';

export type ToolRegistrationResult =
  | Readonly<{ outcome: 'REGISTERED'; manifest: ToolManifest }>
  | Readonly<{ outcome: 'REJECTED'; errors: readonly ManifestValidationError[] }>
  | Readonly<{ outcome: 'DUPLICATE'; existing: ToolManifest }>;

/**
 * Un `Principal` de servicio (`@rhia/policy`) puede ver una tool cuando:
 *   1. su capability requerida esta dentro del techo real del servicio
 *      (`serviceCapabilityCeilings[principal.service]`) Y dentro de las
 *      capabilities reales otorgadas a esa instancia (`principal.capabilities`) --
 *      MISMA regla real que `authorize()` de `@rhia/policy` aplica a
 *      cualquier accion, reusada aqui, no reimplementada; y
 *   2. la tool esta disponible (`isToolAvailable`, health.ts) -- una tool
 *      `DOWN`/sin chequeo nunca aparece como "permitida" aunque la
 *      capability sea correcta.
 * Alcance deliberado: `Principal` HUMAN no aplica aqui -- el packet
 * describe "permitir a AGENTES operar herramientas externas"; un
 * `Principal` humano siempre ve la lista vacia (las tools son un concepto
 * de capability de servicio, no de permiso humano -- mismo tipo de
 * separacion que ya aplica `READ_APPROVALS`/`DECIDE_APPROVAL` en
 * `@rhia/policy`, marcadas `servicesForbidden: true` en sentido inverso).
 */
const isVisibleToServicePrincipal = (manifest: ToolManifest, principal: Readonly<{ service: ServiceIdentity; capabilities: readonly string[] }>): boolean => {
  const ceiling = serviceCapabilityCeilings[principal.service] as readonly string[];
  return principal.capabilities.includes(manifest.requiredCapability) && ceiling.includes(manifest.requiredCapability);
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolManifest>();

  /** Accion 1-3. Rechaza (no sobreescribe en silencio) un `id` ya registrado -- un manifest existente solo cambia via una decision explicita, no un registro duplicado accidental. */
  register(raw: unknown): ToolRegistrationResult {
    const result = validateToolManifest(raw);
    if (!result.valid) return { outcome: 'REJECTED', errors: result.errors };
    const existing = this.tools.get(result.manifest.id);
    if (existing) return { outcome: 'DUPLICATE', existing };
    this.tools.set(result.manifest.id, result.manifest);
    return { outcome: 'REGISTERED', manifest: result.manifest };
  }

  get(id: string): ToolManifest | undefined {
    return this.tools.get(id);
  }

  list(): readonly ToolManifest[] {
    return [...this.tools.values()];
  }

  /**
   * Criterio de aceptacion "Agent solo ve tools permitidas". `healthByToolId`
   * es el ledger REAL de chequeos de salud que el caller entrega (nunca
   * inventado por este paquete) -- una tool sin chequeo reciente
   * (`undefined`) o `DOWN` nunca aparece en la lista, aunque la capability
   * sea correcta.
   */
  listForPrincipal(principal: Principal, healthByToolId: ReadonlyMap<string, ToolHealthRecord>): readonly ToolManifest[] {
    if (principal.kind !== 'SERVICE') return [];
    return this.list().filter((manifest) => isVisibleToServicePrincipal(manifest, principal) && isToolAvailable(healthByToolId.get(manifest.id)));
  }
}
