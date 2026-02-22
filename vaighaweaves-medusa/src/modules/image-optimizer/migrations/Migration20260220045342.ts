import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260220045342 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "image_variant" ("id" text not null, "image_id" text not null, "size" text not null, "url" text not null, "s3_key" text not null, "width" integer not null, "height" integer not null, "format" text not null, "file_size" integer null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "image_variant_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_image_variant_deleted_at" ON "image_variant" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "image_variant" cascade;`);
  }

}
