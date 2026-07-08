CREATE TYPE "QuoteStatus" AS ENUM (
  'PENDING_HUMAN_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXECUTED'
);

CREATE TYPE "QuoteEventType" AS ENUM (
  'QUOTE_CREATED',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'EXECUTION_REPLAYED'
);

CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_cents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "total_cents" INTEGER NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING_HUMAN_APPROVAL',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "execution_id" UUID,
  "execution_result" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quote_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "quote_id" UUID NOT NULL,
  "event_type" "QuoteEventType" NOT NULL,
  "metadata" JSONB NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE UNIQUE INDEX "quotes_execution_id_key" ON "quotes"("execution_id");
CREATE INDEX "quotes_product_id_idx" ON "quotes"("product_id");
CREATE INDEX "quotes_status_idx" ON "quotes"("status");
CREATE INDEX "quote_events_quote_id_idx" ON "quote_events"("quote_id");

ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quote_events"
  ADD CONSTRAINT "quote_events_quote_id_fkey"
  FOREIGN KEY ("quote_id") REFERENCES "quotes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
