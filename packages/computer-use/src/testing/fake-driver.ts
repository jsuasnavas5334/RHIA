// Driver de pruebas: nunca abre un navegador/sandbox real. Mismo diseño que
// `FakeBrowserDriver` de `@rhia/playwright-worker` -- colas de reacciones
// programadas por metodo.

import type { BrowserContextHandle, BrowserProfile } from '@rhia/playwright-worker';
import type { ComputerUseDriver, ComputerUseObservation } from '../driver.js';
import type { ScreenCoordinates } from '../contracts.js';

export type FakeReaction<T> = Readonly<{ kind: 'resolve'; value: T }> | Readonly<{ kind: 'throw'; error: Error }> | Readonly<{ kind: 'hang' }>;

type Method = 'createSandboxSession' | 'observe' | 'moveAndClick' | 'typeText' | 'pressKey' | 'wait' | 'closeSession';
type QueueMap = { [K in Method]: FakeReaction<unknown>[] };

function hangUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
}

export class FakeComputerUseDriver implements ComputerUseDriver {
  private nextContextId = 1;
  private nextScreenshotId = 1;

  readonly createdProfiles: BrowserProfile[] = [];
  readonly closedContextIds: string[] = [];
  readonly typedValues: string[] = [];
  readonly clickedCoordinates: ScreenCoordinates[] = [];
  observeCallCount = 0;

  /** URL/estado de modal "actuales" que default `observe()` reporta cuando no hay una reaccion programada -- mutable para que un test simule navegacion/estado real. */
  currentUrl = 'https://app.example.com/dashboard';
  currentModalDetected = false;

  private readonly queues: QueueMap = {
    createSandboxSession: [],
    observe: [],
    moveAndClick: [],
    typeText: [],
    pressKey: [],
    wait: [],
    closeSession: [],
  };

  program<K extends Method>(method: K, reaction: FakeReaction<unknown>): void {
    this.queues[method].push(reaction);
  }

  private async consume<T>(method: Method, signal: AbortSignal, fallback: () => T): Promise<T> {
    const queue = this.queues[method];
    const reaction = (queue.shift() as FakeReaction<T> | undefined) ?? { kind: 'resolve', value: fallback() };
    if (reaction.kind === 'throw') throw reaction.error;
    if (reaction.kind === 'hang') return await hangUntilAborted(signal);
    return reaction.value;
  }

  async createSandboxSession(profile: BrowserProfile, signal: AbortSignal): Promise<BrowserContextHandle> {
    this.createdProfiles.push(profile);
    return this.consume('createSandboxSession', signal, () => ({ contextId: `ctx-${this.nextContextId++}` }));
  }

  async observe(_context: BrowserContextHandle, signal: AbortSignal): Promise<ComputerUseObservation> {
    this.observeCallCount += 1;
    return this.consume('observe', signal, () => ({
      screenshot: { screenshotId: `shot-${this.nextScreenshotId++}`, capturedAt: new Date(0).toISOString() },
      currentUrl: this.currentUrl,
      modalDetected: this.currentModalDetected,
    }));
  }

  async moveAndClick(_context: BrowserContextHandle, coordinates: ScreenCoordinates, signal: AbortSignal): Promise<void> {
    this.clickedCoordinates.push(coordinates);
    return this.consume('moveAndClick', signal, () => undefined);
  }

  async typeText(_context: BrowserContextHandle, value: string, signal: AbortSignal): Promise<void> {
    this.typedValues.push(value);
    return this.consume('typeText', signal, () => undefined);
  }

  async pressKey(_context: BrowserContextHandle, _key: string, signal: AbortSignal): Promise<void> {
    return this.consume('pressKey', signal, () => undefined);
  }

  async wait(_ms: number, signal: AbortSignal): Promise<void> {
    return this.consume('wait', signal, () => undefined);
  }

  async closeSession(context: BrowserContextHandle): Promise<void> {
    this.closedContextIds.push(context.contextId);
  }
}
