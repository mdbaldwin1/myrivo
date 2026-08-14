# Task 15 fix round 8

- Eliminated raw session/cookie evidence in favor of six unique domain-separated HMAC hashes using an independent redaction key.
- Added recursive signed-evidence rejection for cookies, access tokens, signed URLs, and private storage paths.
- Added a database/run-bound, one-shot post-reservation storage-signing fault and exercised it through the real download action without consuming a grant.
- Recorded successful Stripe signature validation immutably in the webhook ledger and derived acceptance evidence from that column.
- Added isolated dispute-opened evidence and duplicate scenario rejection.
- Fetches and hashes real old buyer bytes before and after replacement, and requires a new checkout to return a different version and content hash.

No external acceptance result is claimed without executing the configured nonproduction provider workflow.
