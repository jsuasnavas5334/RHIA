import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export const ormSpikeRecords = pgTable(
  'orm_spike_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    externalKey: text('external_key').notNull().unique(),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('orm_spike_records_status_idx').on(table.status)],
);

export const ormSpikeInputSchema = z.strictObject({
  version: z.literal('1'),
  externalKey: z.string().trim().min(1).max(200),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']),
});

export type OrmSpikeInput = z.infer<typeof ormSpikeInputSchema>;
