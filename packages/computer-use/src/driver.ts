// Computer Use Adapter (PH09-T003) -- interfaz del driver, provider-neutral
// (accion 1 del packet: "Definir provider-neutral interface"). Reusa
// `BrowserProfile`/`BrowserContextHandle`/`ScreenshotRef` de
// `@rhia/playwright-worker` (accion 2, "Sandbox browser": misma nocion de
// sesion aislada ya establecida por PH09-T002, nunca reimplementada aqui) --
// la diferencia real con `BrowserDriver` es que este driver actua sobre
// COORDENADAS de pantalla/observacion visual, nunca selectors DOM.

import type { BrowserContextHandle, BrowserProfile, ScreenshotRef } from '@rhia/playwright-worker';
import type { ScreenCoordinates } from './contracts.js';

/**
 * Accion "Capture actions": cada observacion trae SIEMPRE un screenshot
 * real, la URL actual (para el chequeo de dominio en runtime) y si se
 * detecto un modal/dialogo inesperado (Prueba requerida "Unexpected
 * modal") -- se captura ANTES y DESPUES de cada accion real, nunca solo al
 * fallar (a diferencia de `@rhia/playwright-worker`, que solo captura en
 * fallo: aqui cada accion es no-determinista, así que el trace completo
 * necesita evidencia de AMBOS lados para ser auditable/replayable).
 */
export type ComputerUseObservation = Readonly<{
  screenshot: ScreenshotRef;
  currentUrl: string;
  modalDetected: boolean;
}>;

export interface ComputerUseDriver {
  createSandboxSession(profile: BrowserProfile, signal: AbortSignal): Promise<BrowserContextHandle>;
  observe(context: BrowserContextHandle, signal: AbortSignal): Promise<ComputerUseObservation>;
  moveAndClick(context: BrowserContextHandle, coordinates: ScreenCoordinates, signal: AbortSignal): Promise<void>;
  /** `value` ya es el valor real (LITERAL o secreto resuelto) -- nunca se logea, ver worker.ts. */
  typeText(context: BrowserContextHandle, value: string, signal: AbortSignal): Promise<void>;
  pressKey(context: BrowserContextHandle, key: string, signal: AbortSignal): Promise<void>;
  wait(ms: number, signal: AbortSignal): Promise<void>;
  closeSession(context: BrowserContextHandle): Promise<void>;
}

/** Resuelve un `TypeInput.SECRET_REF` -- misma interfaz/principio que `SecretResolver` de `@rhia/playwright-worker`, redeclarada aqui para no depender de su implementacion concreta de runtime, solo de su contrato. */
export interface SecretResolver {
  resolve(ref: string, signal: AbortSignal): Promise<string>;
}
