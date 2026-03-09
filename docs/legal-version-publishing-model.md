# Legal Version Publishing Model

## Bead
- ID: `myrivo-54`
- Scope: establish versioned legal records and immutable acceptance ledger behavior.

## Data Model

### `legal_documents`
- Canonical document registry (`terms`, `privacy`, etc.).
- Holds stable document identity and audience targeting.

### `legal_document_versions`
- Immutable version records per document.
- Stores:
  - `version_label` (human-readable tag)
  - `content_markdown` (published body snapshot)
  - `content_hash` (integrity and audit reference)
  - lifecycle state: `draft | published | retired`
  - `effective_at`, `published_at`, `published_by_user_id`

### `legal_acceptances`
- Write-once acceptance evidence rows.
- Stores:
  - `user_id`
  - accepted `legal_document_version_id`
  - optional `store_id` context
  - `accepted_at`, `acceptance_surface`
  - forensic metadata (`ip_hash`, `user_agent`, `metadata_json`)

## Publishing Lifecycle

1. Create a `draft` version on an existing legal document.
2. Review and finalize legal text.
3. Mark version `published` and set `effective_at`.
4. Keep previous versions for historical lookup; optionally mark older versions `retired`.
5. New acceptances always point to exact published version IDs.

## Acceptance Immutability Rules

1. `legal_acceptances` rows are immutable after insert.
2. Database triggers block `UPDATE` and `DELETE`.
3. Duplicate acceptance for same user/version/store scope is prevented by unique index.

## Access and Governance

1. Published documents/versions are readable for public/legal screens.
2. Admin/support roles manage document and version records.
3. Users can insert and read their own acceptance records.
4. Admin/support can read all acceptance records for compliance/audit.

## Operational Notes

1. Content hash should be generated from canonical markdown serialization.
2. Re-consent logic (next bead) should compare required published versions against user acceptance rows.
3. Export/reporting should include version label, hash, user, timestamp, and acceptance surface.
