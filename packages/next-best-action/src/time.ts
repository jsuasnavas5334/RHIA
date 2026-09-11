// PH07-T005 -- utilidades de tiempo puras, sin `new Date()` implicito en
// ningun otro archivo del motor (reloj siempre inyectado via NBAInput.now).

export function addHours(iso: string, hours: number): string {
  const date = new Date(iso);
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function addDays(iso: string, days: number): string {
  return addHours(iso, days * 24);
}

/** Dias completos entre dos timestamps ISO (`to` - `from`), nunca negativo. */
export function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
