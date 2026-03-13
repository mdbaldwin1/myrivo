# Store Legal Documents Runbook

## Purpose

Store-level legal documents give each storefront its own:

- `Privacy Policy`
- `Terms & Conditions`

These are managed in `Store Settings > Legal`, not in Storefront Studio.

## Ownership model

### Store Settings > Legal

Owns:

- formal legal text
- template variables and addenda
- draft vs published state
- effective-date metadata
- publish summaries

### Storefront Studio

Still owns:

- shipping and return summaries
- FAQ content
- support presentation
- policy-page merchandising copy

## Merchant workflow

1. Open `Store Settings > Legal`
2. Choose `Privacy Policy` or `Terms & Conditions`
3. Save changes to the draft
4. Review the draft preview and current published version
5. Enter:
   - publish summary
   - optional effective date
6. Publish the update

Customers keep seeing the published version until step 6 happens.

## Publishing rules

- Draft saves do **not** change the public storefront.
- Publish is blocked when:
  - there are unsaved draft changes
  - there is no meaningful draft change compared with the published version
  - the publish summary is missing
- Publishing increments the store legal document version and records:
  - `published_at`
  - `effective_at`
  - `published_change_summary`
  - `published_by_user_id`

## Support guidance

If a merchant says:

### "I saved my legal changes but customers still see the old text."

Expected behavior. Confirm whether they clicked `Publish`.

### "I cannot publish."

Check:

- draft has been saved first
- publish summary is filled in
- draft actually differs from the published version

### "We need to revert a legal change."

Current recovery path:

1. open the document
2. paste or restore the prior text into the draft
3. save the draft
4. publish a new version with a rollback summary

There is no separate point-in-time version restore UI yet.

## Storefront behavior

Storefront legal pages are available at:

- `/privacy`
- `/terms`

When a store context is present, those routes render the store's published legal documents.

Additional storefront access paths:

- `/s/[slug]/privacy`
- `/s/[slug]/terms`

These redirect into the shared legal routes with store context.

## Validation checklist

Before rollout or after changes:

- store legal editor loads for an admin-capable store user
- draft save works
- publish requires a summary
- public storefront shows the published version, not the unsaved draft
- footer legal links resolve correctly
- policies page links resolve correctly

## Data model notes

Primary table:

- `public.store_legal_documents`

Published snapshot columns:

- `published_source_mode`
- `published_template_version`
- `published_title`
- `published_body_markdown`
- `published_variables_json`
- `published_version`
- `published_change_summary`
- `effective_at`
- `published_at`
- `published_by_user_id`
