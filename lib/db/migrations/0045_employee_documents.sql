-- 4.2b Employee documents and photo. Identity documents become a list (one row per type:
-- citizenship, NID, passport, driving licence, voter ID) with number, issuing district, issuing
-- office, issued date and one scan (front and back in one file; side 'scan') stored in the
-- company's database; employees get a photo (employee_photos). A scan or photo not linked to an
-- employee yet was uploaded in a form not saved yet (kept 24 hours). The old employee_personal
-- columns are copied once and stay as a mirror for older readers until Phase 8. Idempotent;
-- PG10-safe ids (md5).
CREATE TABLE IF NOT EXISTS "employee_documents" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "doc_type" varchar(20) NOT NULL,
  "doc_number" varchar(100) NOT NULL,
  "issued_district" varchar(100) NOT NULL,
  "issued_date" date,
  "issuing_office" varchar(150) DEFAULT '' NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "employee_documents_employee_type_key" UNIQUE ("employee_id", "doc_type")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_documents_employee_id_idx" ON "employee_documents" ("employee_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_document_files" (
  "id" uuid PRIMARY KEY NOT NULL,
  "document_id" uuid REFERENCES "employee_documents"("id") ON DELETE CASCADE,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE CASCADE,
  "side" varchar(10) NOT NULL,
  "file_name" varchar(150) NOT NULL,
  "mime_type" varchar(50) NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "content" bytea NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "employee_document_files_document_side_key" UNIQUE ("document_id", "side")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_document_files_document_id_idx" ON "employee_document_files" ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_document_files_uploaded_by_idx" ON "employee_document_files" ("uploaded_by", "uploaded_at");
--> statement-breakpoint
INSERT INTO "employee_documents" ("id", "employee_id", "doc_type", "doc_number", "issued_district")
SELECT md5(p."employee_id"::text || ':' || d."doc_type")::uuid, p."employee_id", d."doc_type", trim(d."no"), COALESCE(trim(d."district"), '')
FROM "employee_personal" p
CROSS JOIN LATERAL (VALUES
  ('citizenship', p."citizenship_no", p."issuing_district"),
  ('nid', p."nid_no", p."nid_issuing_district"),
  ('passport', p."passport_no", p."passport_issuing_district"),
  ('voter_id', p."voters_id", p."voter_id_issuing_district")
) AS d("doc_type", "no", "district")
WHERE COALESCE(trim(d."no"), '') <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "issuing_office" varchar(150) DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE "employee_document_files" SET "side" = 'scan' WHERE "side" = 'front';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_photos" (
  "id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE CASCADE,
  "mime_type" varchar(50) NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "content" bytea NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "employee_photos_employee_key" UNIQUE ("employee_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_photos_uploaded_by_idx" ON "employee_photos" ("uploaded_by", "uploaded_at");
