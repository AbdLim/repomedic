CREATE TABLE "repair_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_id" uuid NOT NULL,
	"type" varchar(48) NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_url" text NOT NULL,
	"repository" varchar(300) NOT NULL,
	"issue_number" integer NOT NULL,
	"issue_title" text NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"verification" varchar(20),
	"report" jsonb,
	"error" text,
	"worker_id" text,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "repair_artifacts" ADD CONSTRAINT "repair_artifacts_repair_id_repairs_id_fk" FOREIGN KEY ("repair_id") REFERENCES "public"."repairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_events" ADD CONSTRAINT "repair_events_repair_id_repairs_id_fk" FOREIGN KEY ("repair_id") REFERENCES "public"."repairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_repair_kind_unique" ON "repair_artifacts" USING btree ("repair_id","kind");--> statement-breakpoint
CREATE INDEX "events_repair_created_idx" ON "repair_events" USING btree ("repair_id","created_at");--> statement-breakpoint
CREATE INDEX "repairs_status_created_idx" ON "repairs" USING btree ("status","created_at");