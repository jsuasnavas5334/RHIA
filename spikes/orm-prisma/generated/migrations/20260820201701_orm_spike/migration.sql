-- CreateTable
CREATE TABLE "orm_spike_records" (
    "id" UUID NOT NULL,
    "external_key" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orm_spike_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orm_spike_records_external_key_key" ON "orm_spike_records"("external_key");

-- CreateIndex
CREATE INDEX "orm_spike_records_status_idx" ON "orm_spike_records"("status");
