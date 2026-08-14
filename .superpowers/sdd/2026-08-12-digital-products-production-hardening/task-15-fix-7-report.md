# Task 15 fix round 7

- Added discriminated, scenario-specific provider evidence for Stripe Checkout, refunds, disputes and webhook processing; Resend delivery; grant sessions; replacements; and delivery retry history.
- Pinned the dispute helper to an exact allowlisted HTTPS origin, disabled redirects, bounded requests, and required HMAC request/response authentication.
- Exercised five unique download sessions, same-session grace reuse, corrupt-token non-consumption, and sixth-session denial.
- Hashed the prior buyer download, retained its manifest version/filename, replaced through the UI, and required a fresh checkout to snapshot the new version.
- Replaced direct focus manipulation with real Tab traversal and Enter/Space activation in the accessibility workflows.

No external provider run is claimed. Promotion remains blocked unless all provider credentials, fixture state, helper capability, and exact signed evidence are present.
