// Conversation Agent (PH08-T004) -- contratos locales de Price Book.
//
// "Contexto necesario" del packet: "Policies comerciales y price book".
// `product`/`price_book`/`price_book_item` YA EXISTEN en
// packages/db/src/schema.ts (PH03-T001, ya cerrada) -- este ciclo NO agrega
// ninguna columna ni tabla nueva (guardrail del proyecto: "no crecer el
// esquema de PostgreSQL sin revisar si ya existe una tabla reutilizable").
// `PriceBook`/`PriceBookItem` aqui son un tipo plano LOCAL (sin zod), mismo
// patron y misma razon que `Inference` en packages/messaging/src/schema.ts:
// no hay red disponible en este ciclo para instalar zod 4.4.3 real (solo
// una v3.25.76 transitiva, incompatible en superficie de tipos), y este
// paquete no necesita validar el payload -- solo leerlo, ya validado por
// quien lo construya (futuro caller real con Postgres, fuera de alcance de
// un paquete puro). `PriceBookItem` aplana el join real
// `price_book_item JOIN product` (packages/db/src/schema.ts lineas 427-463)
// -- no es una tabla nueva, es la forma en memoria que un caller real le
// entregaria a este paquete.
//
// PLAN_MAESTRO.md ("Productos y precios", linea 531): "La IA puede
// comunicar estos precios cuando estén ACTIVE; no puede editar valores."
// Esa es la UNICA regla de negocio real documentada sobre el status. La
// columna real (`price_book.status`) es `text` sin enum en la base de
// datos -- `PriceBookStatus` cierra un enum aqui (mismo principio que
// `JobRecordSchema.status`/`ContactPointValidationStatusSchema` en
// apps/core-api/src/contracts.ts, que tambien convierten una columna text
// en un enum estricto de contrato) con los valores de ciclo de vida mas
// razonables (`DRAFT` es el default real de la columna). El comportamiento
// de este paquete NUNCA depende de reconocer todos los valores posibles:
// comunica el precio si y solo si `status === 'ACTIVE'` Y la fecha vigente
// lo permite (ver price.ts); cualquier otro valor -- enumerado aqui o no --
// se trata exactamente igual: NO se comunica. Ver "Errores que debe
// evitar" del packet: "Responder con precio stale".
export type PriceBookStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'ARCHIVED';

export type PriceBookItem = Readonly<{
  priceBookId: string;
  productId: string;
  /** `product.sku` real -- clave de negocio estable para buscar un item, en vez de un id tecnico. */
  sku: string;
  productName: string;
  /** Refleja `price_book_item.unit_price` (`numeric(14,4)` en la BD) -- aqui como `number`, misma convencion que documento `evidence-pipeline/schema.ts` para `numeric` (responsabilidad del adapter real convertir). */
  unitPrice: number;
  minimumQuantity: number;
}>;

export type PriceBook = Readonly<{
  id: string;
  organizationId: string;
  countryCode: string;
  currency: string;
  validFrom: string;
  validTo: string | null;
  status: PriceBookStatus;
  items: readonly PriceBookItem[];
}>;
