# Database

PostgreSQL is the source of truth. The language model is not.

## Tables

| Group | Tables |
|---|---|
| Identity | `users`, `patient_profiles` |
| Health record | `patient_records`, `medical_documents` |
| Assessment | `assessments` |
| Assistant | `conversations`, `conversation_messages`, `ai_tool_calls` |
| Directory | `doctors`, `hospitals`, `provider_sources` |
| Evidence | `evidence_sources`, `evidence_documents`, `evidence_chunks` |
| Evaluation guidance | `clinical_evaluations`, `clinical_evaluation_links`, `clinical_evaluation_evidence` |
| Governance | `consents`, `audit_events` |

## Provenance is a column, not a convention

Every provider record carries `licensing_authority`, `license_number`,
`license_status`, `source`, `source_url` and `verified_at`. A record is shown as
verified only when the authority, the number, the source URL and the timestamp
are all present. The importer refuses to write anything else as verified, and the
evaluation suite fails the build if a demo record is ever marked verified.

Patient-entered content carries the same distinction: a record is
`patient reported` until a clinician confirms it.

## Where patient content lives

`assessments.state` holds everything a person typed or said during an assessment,
and one DELETE removes it. `audit_events` records what the system did, not what
the person said.

## Fallback

`store.js` exposes one interface over PostgreSQL and an in-memory implementation.
Without `DATABASE_URL`, or when the connection fails, the API logs the reason and
runs in memory so the product still starts. `/api/v1/health` reports which is
active, and the readiness gate stays open until it reports postgres.

## Evaluation guidance

`clinical_evaluations` holds what a clinician may consider, `clinical_evaluation_links`
ties each entry to the candidate explanations it bears on, and
`clinical_evaluation_evidence` ties it to registered sources. An entry with no
evidence row is never shown. `reviewed_by` and `reviewed_at` are empty until a
clinician signs the entry off. There is no price column anywhere, by design.

Migrations `003` and `004` add and seed these tables. They are additive: the API
runs without them, because the knowledge file is the source of truth and the
tables exist so entries can be curated and reviewed in the database later.

## pgvector is optional

The stack ships `pgvector/pgvector:pg16`, but the schema also applies on a plain
PostgreSQL: the extension is created inside a guarded block, and the embedding
column and its index are added only where the extension actually installed. A
missing extension prints a notice instead of failing the first boot.

## Vector search

`evidence_chunks` carries the pgvector column for retrieval over a licensed
guideline corpus. It is provisioned and unused: this build answers from the
curated knowledge base, and the corpus is a licensing question before it is an
engineering one.
