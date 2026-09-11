// Tool Registry (PH09-T001), accion 4 ("Health check") y prueba requerida
// "Tool down". `ToolHealthRecord` alinea sus campos con la tabla real
// `system_health_event` (`component, status, detail, occurred_at` --
// packages/db/src/schema.ts lineas 573-580, ya existente) -- `toolId` es
// el `component` real, `detail` es el mismo `jsonb` libre. No se reusa un
// enum de status compartido porque la columna real es `text` libre y
// ningun otro paquete (p. ej. `@rhia/search-health`, que clasifica salud
// de MOTORES DE BUSQUEDA con un score estadistico por decaimiento -- un
// problema distinto) define uno que aplique aqui: la pregunta de Tool
// Registry es mas simple ("esta esta herramienta disponible AHORA para
// autorizar una invocacion"), no un score historico.

export const toolHealthStatuses = ['UP', 'DOWN', 'DEGRADED', 'UNKNOWN'] as const;
export type ToolHealthStatus = (typeof toolHealthStatuses)[number];

export type ToolHealthRecord = Readonly<{
  toolId: string;
  status: ToolHealthStatus;
  checkedAt: string;
  detail: string | null;
}>;

export const recordHealthCheck = (toolId: string, status: ToolHealthStatus, now: () => Date, detail: string | null = null): ToolHealthRecord => ({
  toolId,
  status,
  checkedAt: now().toISOString(),
  detail,
});

/**
 * `UNKNOWN` (nunca chequeada) se trata como NO disponible -- fail-closed,
 * mismo principio que el resto del proyecto ("mejor un falso positivo que
 * autorizar algo sin evidencia real"). `DEGRADED` SI se considera
 * disponible (uso permitido con advertencia), solo `DOWN`/`UNKNOWN`
 * bloquean -- prueba requerida "Tool down".
 */
export const isToolAvailable = (record: ToolHealthRecord | undefined): boolean => record?.status === 'UP' || record?.status === 'DEGRADED';
