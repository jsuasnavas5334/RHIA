import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryBudgetLedger, type Clock } from "./budget.js";

interface AdvanceableClock extends Clock {
  _advance(nextIso: string): void;
}

function fixedClock(iso: string): AdvanceableClock {
  let current = new Date(iso);
  return {
    now: () => current,
    _advance: (nextIso: string) => {
      current = new Date(nextIso);
    },
  };
}

test("budget: acumula gasto diario y mensual", () => {
  const ledger = new InMemoryBudgetLedger(fixedClock("2026-08-29T10:00:00Z"));
  ledger.record(1.5);
  ledger.record(2.25);

  assert.equal(ledger.getDailyUsage().spentUsd, 3.75);
  assert.equal(ledger.getDailyUsage().taskCount, 2);
  assert.equal(ledger.getMonthlyUsage().spentUsd, 3.75);
});

test("budget: resetea el contador diario al cruzar de dia sin afectar el mensual", () => {
  const clock = fixedClock("2026-08-29T23:50:00Z");
  const ledger = new InMemoryBudgetLedger(clock);
  ledger.record(5);
  assert.equal(ledger.getDailyUsage().spentUsd, 5);

  clock._advance("2026-08-30T00:05:00Z");
  assert.equal(ledger.getDailyUsage().spentUsd, 0, "el dia debe resetear");
  assert.equal(ledger.getMonthlyUsage().spentUsd, 5, "el mes no debe resetear todavia");
});

test("budget: resetea el contador mensual al cruzar de mes", () => {
  const clock = fixedClock("2026-08-31T23:50:00Z");
  const ledger = new InMemoryBudgetLedger(clock);
  ledger.record(9);

  clock._advance("2026-09-01T00:05:00Z");
  assert.equal(ledger.getDailyUsage().spentUsd, 0);
  assert.equal(ledger.getMonthlyUsage().spentUsd, 0);
});
