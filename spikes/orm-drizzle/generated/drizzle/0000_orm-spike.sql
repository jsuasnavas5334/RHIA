CREATE TABLE "orm_spike_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_key" text NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orm_spike_records_external_key_unique" UNIQUE("external_key")
);
--> statement-breakpoint
CREATE INDEX "orm_spike_records_status_idx" ON "orm_spike_records" USING btree ("status");