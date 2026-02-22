import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260221072058 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "webhook_event" ("id" text not null, "provider" text not null, "event_type" text not null, "payload" text not null, "status" text not null default 'pending', "attempts" integer not null default 0, "max_attempts" integer not null default 5, "last_error" text null, "next_retry_at" timestamptz null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "webhook_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_webhook_event_deleted_at" ON "webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "webhook_event" cascade;`);
  }

}
