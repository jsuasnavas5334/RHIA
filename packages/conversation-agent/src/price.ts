// Conversation Agent (PH08-T004), accion 4 ("Comunicar precio oficial").
// Criterio de aceptacion "Precio oficial activo puede comunicarse" y error
// a evitar "Responder con precio stale" se resuelven en la MISMA funcion,
// por construccion: `communicateOfficialPrice` solo devuelve
// `communicated: true` cuando el `PriceBook` esta `ACTIVE` Y la fecha
// actual cae dentro de `[validFrom, validTo)` -- cualquier otro caso
// (status distinto de ACTIVE, todavia no vigente, ya vencido, price book
// ausente, o producto sin item en ese price book) devuelve
// `communicated: false` con el motivo exacto, nunca un precio inventado o
// de un price book viejo. Mismo espiritu que `renderFactMention` de
// @rhia/messaging: un caso no reconocido devuelve un resultado seguro
// (`null`/`communicated: false`), nunca una adivinanza.

import type { PriceBook, PriceBookItem } from './schema.js';

export type OfficialPriceResultReason =
  | 'NO_ACTIVE_PRICE_BOOK'
  | 'PRICE_BOOK_NOT_YET_VALID'
  | 'PRICE_BOOK_EXPIRED'
  | 'PRODUCT_NOT_FOUND';

export type OfficialPriceResult =
  | Readonly<{ communicated: true; priceText: string; item: PriceBookItem; priceBookId: string }>
  | Readonly<{ communicated: false; reason: OfficialPriceResultReason }>;

/** `ACTIVE` + dentro de la ventana de vigencia real -- la UNICA condicion bajo la que un `PriceBook` puede comunicarse (PLAN_MAESTRO.md, "Productos y precios", linea 531). */
export const isPriceBookCurrentlyActive = (priceBook: PriceBook, now: Date): boolean => {
  if (priceBook.status !== 'ACTIVE') return false;
  if (new Date(priceBook.validFrom).getTime() > now.getTime()) return false;
  if (priceBook.validTo && new Date(priceBook.validTo).getTime() <= now.getTime()) return false;
  return true;
};

const defaultFormat = (amount: number, currency: string): string => `${currency} ${amount.toFixed(2)}`;

export const communicateOfficialPrice = (
  priceBook: PriceBook | undefined,
  productSku: string,
  now = new Date(),
  formatPrice: (amount: number, currency: string) => string = defaultFormat,
): OfficialPriceResult => {
  if (!priceBook || priceBook.status !== 'ACTIVE') return { communicated: false, reason: 'NO_ACTIVE_PRICE_BOOK' };
  if (new Date(priceBook.validFrom).getTime() > now.getTime()) return { communicated: false, reason: 'PRICE_BOOK_NOT_YET_VALID' };
  if (priceBook.validTo && new Date(priceBook.validTo).getTime() <= now.getTime()) return { communicated: false, reason: 'PRICE_BOOK_EXPIRED' };

  const item = priceBook.items.find((candidate) => candidate.sku === productSku);
  if (!item) return { communicated: false, reason: 'PRODUCT_NOT_FOUND' };

  return { communicated: true, priceText: formatPrice(item.unitPrice, priceBook.currency), item, priceBookId: priceBook.id };
};
