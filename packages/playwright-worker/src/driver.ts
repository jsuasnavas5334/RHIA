// Playwright Worker (PH09-T002) -- interfaz del driver de navegador,
// inyectable. Mismo principio que `Transport` de `@rhia/channel-gateway`
// (PH08-T001) y `CalendarAdapter` de `@rhia/meeting-scheduler` (PH08-T005):
// este paquete NUNCA llama a Playwright real ni abre un navegador real --
// define el contrato provider-neutral y se prueba con un fake determinista
// (`testing/fake-driver.ts`). Conectar Playwright real a esta interfaz es
// trabajo de un proceso host/worker fuera de este paquete puro (mismo
// patron ya usado por todos los hermanos de PH08/PH09 -- ver
// docs/progress/PH09-T002.md "Fuera de alcance").

import type { RobustSelector } from './contracts.js';

/**
 * Accion "Perfiles aislados": `profileId` es una clave de aislamiento real
 * (nunca reutilizada entre corridas -- `PlaywrightWorker.run` la genera de
 * nuevo en cada invocacion, ver worker.ts) para que el driver real cree un
 * contexto de navegador SIN cookies/storage compartido con ninguna otra
 * corrida. Error a evitar del packet: "Compartir sesion sin aislamiento".
 */
export type BrowserProfile = Readonly<{ profileId: string }>;

export type BrowserContextHandle = Readonly<{ contextId: string }>;

export type ElementHandle = Readonly<{ elementId: string; matchedStrategy: RobustSelector['strategies'][number]['kind'] }>;

export type ScreenshotRef = Readonly<{ screenshotId: string; capturedAt: string }>;

/**
 * Contrato provider-neutral del driver real. Cada metodo recibe una
 * `AbortSignal` real -- `PlaywrightWorker` es quien controla el timeout
 * (via `AbortController`), el driver solo debe respetar la señal, nunca
 * implementar su propio timeout paralelo.
 */
export interface BrowserDriver {
  /** SIEMPRE debe crear un contexto NUEVO y aislado -- nunca reutilizar uno existente por `profileId` repetido. */
  createIsolatedContext(profile: BrowserProfile, signal: AbortSignal): Promise<BrowserContextHandle>;
  navigate(context: BrowserContextHandle, url: string, signal: AbortSignal): Promise<void>;
  /** Lanza `BrowserSelectorNotFoundError` (errors.ts) si NINGUNA estrategia de la cadena encuentra un elemento real. */
  findElement(context: BrowserContextHandle, selector: RobustSelector, signal: AbortSignal): Promise<ElementHandle>;
  click(context: BrowserContextHandle, element: ElementHandle, signal: AbortSignal): Promise<void>;
  /**
   * `value` ya es el secreto REAL resuelto (si aplicaba) -- el driver debe
   * tratarlo como sensible (nunca logearlo); `PlaywrightWorker` tampoco lo
   * logea nunca (ver worker.ts, `redactedInputSummary`).
   */
  type(context: BrowserContextHandle, element: ElementHandle, value: string, signal: AbortSignal): Promise<void>;
  readText(context: BrowserContextHandle, element: ElementHandle, signal: AbortSignal): Promise<string>;
  /** Accion "Screenshots en fallo": `PlaywrightWorker` la invoca SIEMPRE que un step falla (ver worker.ts). */
  captureScreenshot(context: BrowserContextHandle): Promise<ScreenshotRef>;
  closeContext(context: BrowserContextHandle): Promise<void>;
}

/**
 * Resuelve un `TypeInput.SECRET_REF` (contracts.ts) a su valor real EN
 * RUNTIME -- inyectado por el proceso host/worker (p.ej. un vault real),
 * NUNCA implementado por este paquete puro. Mismo principio que
 * `credentialRef` en `@rhia/tool-registry`: el escenario solo guarda una
 * referencia, jamas el secreto.
 */
export interface SecretResolver {
  resolve(ref: string, signal: AbortSignal): Promise<string>;
}
