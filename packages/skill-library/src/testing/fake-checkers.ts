import type { PreconditionChecker, ValidationChecker } from '../checkers.js';

/** Checker de pruebas: cada `id` se resuelve segun un mapa fijo entregado por el test; un `id` no listado por defecto pasa (`true`). */
export class FakeChecker implements PreconditionChecker, ValidationChecker {
  readonly calls: string[] = [];
  constructor(private readonly results: Readonly<Record<string, boolean>> = {}) {}

  async check(id: string, _signal: AbortSignal): Promise<boolean> {
    this.calls.push(id);
    return this.results[id] ?? true;
  }
}
