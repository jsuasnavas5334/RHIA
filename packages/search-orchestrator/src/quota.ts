// PH06-T002, acción 5 ("Per-source quotas/backoff") y error a evitar
// ("Retries simultáneos agresivos"): el orchestrator hace un único intento
// por fuente por llamada (nunca reintenta la misma fuente dentro de una
// misma búsqueda); el backoff entre llamadas separadas en el tiempo lo
// modela este circuit breaker simple. Puro salvo por el reloj inyectado
// (`now`), para poder probarse de forma determinista sin temporizadores
// reales.

export type SourceOutcome = 'SUCCESS' | 'FAILURE';

/** Puerto que el orchestrator consulta antes de invocar cada adapter. */
export interface SourceQuotaGuard {
  /** true si la fuente debe saltarse esta vuelta (circuito abierto). */
  shouldSkip(source: string): boolean;
  /** Registra el resultado de haber invocado (o no) la fuente. */
  recordOutcome(source: string, outcome: SourceOutcome): void;
}

export type QuotaGuardOptions = Readonly<{
  /** Fallos consecutivos antes de abrir el circuito. Default: 3. */
  failureThreshold?: number;
  /** Tiempo que el circuito permanece abierto antes de un intento de sondeo ("half-open"). Default: 60_000 ms. */
  cooldownMs?: number;
  now?: () => Date;
}>;

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 60_000;

/**
 * Circuit breaker en memoria, por fuente: tras `failureThreshold` fallos
 * consecutivos abre el circuito por `cooldownMs`; pasado ese tiempo permite
 * un único intento de sondeo ("half-open") sin cerrar el circuito todavía —
 * solo un `SUCCESS` real lo cierra (resetea el contador). Nunca reintenta
 * dentro de la misma llamada: `shouldSkip`/`recordOutcome` se usan una vez
 * por fuente por búsqueda.
 */
export class InMemorySourceQuotaGuard implements SourceQuotaGuard {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => Date;
  private readonly state = new Map<string, { consecutiveFailures: number; openedAt: number | null; probing: boolean }>();

  constructor(options: QuotaGuardOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.now = options.now ?? (() => new Date());
  }

  shouldSkip(source: string): boolean {
    const entry = this.state.get(source);
    if (!entry || entry.openedAt === null) return false;

    const elapsedMs = this.now().getTime() - entry.openedAt;
    if (elapsedMs < this.cooldownMs) return true;

    // Cooldown cumplido: deja pasar exactamente un intento de sondeo sin cerrar el circuito todavía.
    if (entry.probing) return true;
    entry.probing = true;
    return false;
  }

  recordOutcome(source: string, outcome: SourceOutcome): void {
    const entry = this.state.get(source) ?? { consecutiveFailures: 0, openedAt: null, probing: false };

    if (outcome === 'SUCCESS') {
      this.state.set(source, { consecutiveFailures: 0, openedAt: null, probing: false });
      return;
    }

    const consecutiveFailures = entry.consecutiveFailures + 1;
    const shouldOpen = consecutiveFailures >= this.failureThreshold;
    this.state.set(source, {
      consecutiveFailures,
      openedAt: shouldOpen ? this.now().getTime() : entry.openedAt,
      probing: false,
    });
  }
}

/** Guard que nunca salta ninguna fuente — útil como default explícito o en pruebas. */
export class AlwaysAllowQuotaGuard implements SourceQuotaGuard {
  shouldSkip(_source: string): boolean { return false; }
  recordOutcome(_source: string, _outcome: SourceOutcome): void { /* no-op */ }
}
