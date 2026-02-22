import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Aligns the pre-existing stock_event and stock_reservation tables
 * (created by data-migration script 01) with the Medusa model definitions.
 *
 * Adds columns Medusa expects (updated_at, deleted_at, renamed/new fields)
 * and backfills existing data where possible.
 */
export class Migration20260219174712 extends Migration {

  override async up(): Promise<void> {
    // ── stock_event ──────────────────────────────────────────────────────────

    // Add missing columns that the Medusa model expects
    this.addSql(`
      ALTER TABLE "stock_event"
        ADD COLUMN IF NOT EXISTS "quantity_change" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "new_quantity" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz NULL;
    `);

    // Backfill quantity_change from the existing "quantity" column
    this.addSql(`
      UPDATE "stock_event"
      SET "quantity_change" = "quantity"
      WHERE "quantity_change" = 0 AND "quantity" != 0;
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_event_deleted_at"
        ON "stock_event" ("deleted_at") WHERE deleted_at IS NULL;
    `);

    // ── stock_reservation ────────────────────────────────────────────────────

    // Add missing columns
    this.addSql(`
      ALTER TABLE "stock_reservation"
        ADD COLUMN IF NOT EXISTS "reservation_type" text NOT NULL DEFAULT 'ONLINE',
        ADD COLUMN IF NOT EXISTS "expiry_at" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz NULL;
    `);

    // Backfill expiry_at from the existing "expires_at" column
    this.addSql(`
      UPDATE "stock_reservation"
      SET "expiry_at" = "expires_at"
      WHERE "expiry_at" IS NULL AND "expires_at" IS NOT NULL;
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_reservation_deleted_at"
        ON "stock_reservation" ("deleted_at") WHERE deleted_at IS NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "stock_event" DROP COLUMN IF EXISTS "quantity_change";`);
    this.addSql(`ALTER TABLE "stock_event" DROP COLUMN IF EXISTS "new_quantity";`);
    this.addSql(`ALTER TABLE "stock_event" DROP COLUMN IF EXISTS "updated_at";`);
    this.addSql(`ALTER TABLE "stock_event" DROP COLUMN IF EXISTS "deleted_at";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_stock_event_deleted_at";`);

    this.addSql(`ALTER TABLE "stock_reservation" DROP COLUMN IF EXISTS "reservation_type";`);
    this.addSql(`ALTER TABLE "stock_reservation" DROP COLUMN IF EXISTS "expiry_at";`);
    this.addSql(`ALTER TABLE "stock_reservation" DROP COLUMN IF EXISTS "deleted_at";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_stock_reservation_deleted_at";`);
  }

}
