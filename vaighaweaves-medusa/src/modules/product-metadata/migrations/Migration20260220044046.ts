import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260220044046 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_metadata" ("id" text not null, "brand" text null, "tags" text null, "is_featured" boolean not null default false, "compare_price" integer null, "cost_price" integer null, "low_stock_threshold" integer not null default 10, "minimum_order_quantity" integer not null default 1, "measuring_unit" text null, "measuring_unit_name" text null, "weight_unit" text not null default 'kg', "meta_title" text null, "meta_description" text null, "view_count" integer not null default 0, "fabric" text null, "occasion" text null, "material" text null, "color" text null, "pattern" text null, "care_instructions" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_metadata_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_metadata_deleted_at" ON "product_metadata" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_metadata" cascade;`);
  }

}
