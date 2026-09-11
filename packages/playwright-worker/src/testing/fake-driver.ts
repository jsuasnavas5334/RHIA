// Driver de pruebas: nunca abre un navegador real. Mismo diseño que
// `FakeTransport` de `@rhia/channel-gateway` -- colas de reacciones
// programadas (una por llamada) para simular exito, un fallo real
// (selector inexistente, sesion expirada, error inesperado) o un cuelgue
// (hasta que el caller aborte la señal, para probar timeouts reales).

import type { BrowserContextHandle, BrowserDriver, BrowserProfile, ElementHandle, ScreenshotRef } from '../driver.js';
import type { RobustSelector } from '../contracts.js';

export type FakeReaction<T> = Readonly<{ kind: 'resolve'; value: T }> | Readonly<{ kind: 'throw'; error: Error }> | Readonly<{ kind: 'hang' }>;

export type FakeDriverMethod = 'createIsolatedContext' | 'navigate' | 'findElement' | 'click' | 'type' | 'readText' | 'captureScreenshot' | 'closeContext';

type QueueMap = { [K in FakeDriverMethod]: FakeReaction<unknown>[] };

function hangUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
}

export class FakeBrowserDriver implements BrowserDriver {
  private nextContextId = 1;
  private nextElementId = 1;
  private nextScreenshotId = 1;

  readonly createdProfiles: BrowserProfile[] = [];
  readonly closedContextIds: string[] = [];
  readonly navigateCalls: string[] = [];
  readonly typedValues: string[] = [];
  readonly screenshotCalls: number[] = [];

  private readonly queues: QueueMap = {
    createIsolatedContext: [],
    navigate: [],
    findElement: [],
    click: [],
    type: [],
    readText: [],
    captureScreenshot: [],
    closeContext: [],
  };

  /** Encola una reaccion programada para la PROXIMA llamada a ese metodo. Sin programar, el metodo tiene exito trivial por defecto. */
  program<K extends FakeDriverMethod>(method: K, reaction: FakeReaction<unknown>): void {
    this.queues[method].push(reaction);
  }

  private async consume<T>(method: FakeDriverMethod, signal: AbortSignal, fallback: () => T): Promise<T> {
    const queue = this.queues[method];
    const reaction = (queue.shift() as FakeReaction<T> | undefined) ?? { kind: 'resolve', value: fallback() };
    if (reaction.kind === 'throw') throw reaction.error;
    if (reaction.kind === 'hang') return await hangUntilAborted(signal);
    return reaction.value;
  }

  async createIsolatedContext(profile: BrowserProfile, signal: AbortSignal): Promise<BrowserContextHandle> {
    this.createdProfiles.push(profile);
    return this.consume('createIsolatedContext', signal, () => ({ contextId: `ctx-${this.nextContextId++}` }));
  }

  async navigate(_context: BrowserContextHandle, url: string, signal: AbortSignal): Promise<void> {
    this.navigateCalls.push(url);
    return this.consume('navigate', signal, () => undefined);
  }

  async findElement(_context: BrowserContextHandle, selector: RobustSelector, signal: AbortSignal): Promise<ElementHandle> {
    const firstStrategy = selector.strategies[0];
    return this.consume('findElement', signal, () => ({ elementId: `el-${this.nextElementId++}`, matchedStrategy: firstStrategy ? firstStrategy.kind : 'css' }));
  }

  async click(_context: BrowserContextHandle, _element: ElementHandle, signal: AbortSignal): Promise<void> {
    return this.consume('click', signal, () => undefined);
  }

  async type(_context: BrowserContextHandle, _element: ElementHandle, value: string, signal: AbortSignal): Promise<void> {
    this.typedValues.push(value);
    return this.consume('type', signal, () => undefined);
  }

  async readText(_context: BrowserContextHandle, _element: ElementHandle, signal: AbortSignal): Promise<string> {
    return this.consume('readText', signal, () => '');
  }

  async captureScreenshot(_context: BrowserContextHandle): Promise<ScreenshotRef> {
    const id = this.nextScreenshotId++;
    this.screenshotCalls.push(id);
    return { screenshotId: `shot-${id}`, capturedAt: new Date(0).toISOString() };
  }

  async closeContext(context: BrowserContextHandle): Promise<void> {
    this.closedContextIds.push(context.contextId);
  }
}
