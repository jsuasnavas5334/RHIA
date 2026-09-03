import type { BudgetPeriodUsage } from "./contracts.js";

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

export interface BudgetLedger {
  getDailyUsage(): BudgetPeriodUsage;
  getMonthlyUsage(): BudgetPeriodUsage;
  record(costUsd: number): void;
}

/**
 * Ledger en memoria: suficiente para PH05-T003 (el router no decide donde
 * persiste el gasto real; eso es responsabilidad del host/Core cuando este
 * paquete se integre). Los periodos se resetean solos al cruzar dia/mes
 * segun el Clock inyectado (permite pruebas deterministas).
 */
export class InMemoryBudgetLedger implements BudgetLedger {
  private readonly clock: Clock;
  private currentDayKey: string;
  private currentMonthKey: string;
  private dailyUsage: BudgetPeriodUsage = { spentUsd: 0, taskCount: 0 };
  private monthlyUsage: BudgetPeriodUsage = { spentUsd: 0, taskCount: 0 };

  constructor(clock: Clock = systemClock) {
    this.clock = clock;
    const now = clock.now();
    this.currentDayKey = dayKey(now);
    this.currentMonthKey = monthKey(now);
  }

  private rollPeriodsIfNeeded(): void {
    const now = this.clock.now();
    const day = dayKey(now);
    const month = monthKey(now);
    if (day !== this.currentDayKey) {
      this.currentDayKey = day;
      this.dailyUsage = { spentUsd: 0, taskCount: 0 };
    }
    if (month !== this.currentMonthKey) {
      this.currentMonthKey = month;
      this.monthlyUsage = { spentUsd: 0, taskCount: 0 };
    }
  }

  getDailyUsage(): BudgetPeriodUsage {
    this.rollPeriodsIfNeeded();
    return this.dailyUsage;
  }

  getMonthlyUsage(): BudgetPeriodUsage {
    this.rollPeriodsIfNeeded();
    return this.monthlyUsage;
  }

  record(costUsd: number): void {
    this.rollPeriodsIfNeeded();
    this.dailyUsage = {
      spentUsd: this.dailyUsage.spentUsd + costUsd,
      taskCount: this.dailyUsage.taskCount + 1,
    };
    this.monthlyUsage = {
      spentUsd: this.monthlyUsage.spentUsd + costUsd,
      taskCount: this.monthlyUsage.taskCount + 1,
    };
  }
}
