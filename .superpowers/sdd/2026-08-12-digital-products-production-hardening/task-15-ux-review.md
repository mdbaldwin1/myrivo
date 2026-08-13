# Task 15 UX and Accessibility Review

## Verdict

**FAIL** — two P1 release blockers remain in the Task 15 acceptance harness. The static implementation generally provides clear buyer/merchant states, responsive layouts, labelled controls, focused error feedback, and live-region status feedback, but the required end-to-end and accessibility evidence is not strong enough to approve rollout.

## Findings

### P1 — The “complete journeys” spec does not perform the journeys or prove their state transitions

**Evidence:** `apps/web/e2e/digital-products.spec.ts:32-39`, `:41-54`, `:56-80`, and `:82-99`.

The merchant case only opens an already-seeded catalog and matches broad text; it never creates/configures a digital product, uploads a file, satisfies readiness, activates the product, or verifies the resulting storefront. The buyer cases open precomputed URLs rather than adding products to a cart, completing checkout, or following an email/access link. The grant, replacement, refund, dispute, retry, and resend cases are not exercised at all: the test merely checks that a free-form evidence file contains ten phrases. Such a file can pass independently of application behavior, provider behavior, or the fixture's current state. Broad expressions such as `/ready|published|active/i` and `/refund|dispute|resend|delivery/i` can also match unrelated text.

This leaves the plan's UX release gate unverified for the highest-risk recovery and financial states. A broken publish button, unusable checkout transition, incorrect buyer version, missing suspension explanation, or nonfunctional resend action could all ship while this suite remains green.

**Required remediation:** Drive each acceptance journey through user-visible actions and verify precise resulting state. Create/configure/upload/publish through the merchant UI; build digital-only and mixed carts and complete Stripe test-mode checkout; obtain delivery through a controlled test mailbox/provider adapter; click download actions and assert five committed grants plus grace reuse; replace the asset and prove the prior buyer still sees the purchased filename/version; trigger refund/dispute webhook fixtures and assert the exact customer and merchant messages/actions; inject delivery failure and operate resend/recovery through the UI. Provider IDs or a structured evidence artifact may supplement these assertions, but must not replace them. Split fixtures by scenario so every required state is deterministic and use exact roles/names/test IDs instead of broad page text.

### P1 — The accessibility spec's assertions do not establish the named accessibility requirements

**Evidence:** `apps/web/e2e/digital-products-accessibility.spec.ts:40-50` and `:53-75`.

At “200% zoom” the only post-zoom assertion is that `body` is visible, which remains true with clipped content, horizontal scrolling, overlapped controls, or unreachable actions. Reduced motion is emulated but no computed animation/transition behavior is asserted. Keyboard coverage presses Tab once on only the recovery page; it does not verify logical order, focus visibility throughout, dialog focus trapping/restoration, file-upload access, or activation of the core merchant/buyer actions. The live-region check only proves that some status/alert node is attached before any operation, not that upload, publish, recovery, checkout polling, download, or resend changes are announced. Finally, the control-name loop reads `name`, text, or `aria-label` attributes directly, so an input with a `name` attribute but no accessible label passes; it does not inspect the accessibility tree. The authenticated loop also logs in only as the merchant before visiting both `customerOrder` and `merchantOrder`, so it cannot reliably validate a distinct customer's authorized order experience.

Consequently the suite can pass while the exact keyboard, announcement, reduced-motion, and zoom failures that Task 15 requires it to prevent are present.

**Required remediation:** Use separate merchant and customer fixture identities/storage states. At both viewports and browser zoom/text scaling, assert no document-level horizontal overflow, no clipped/overlapping primary controls, and successful interaction with the last/main actions. Tab through each critical workflow and assert the expected accessible role/name sequence, visible focus, dialog trap and return focus, and Enter/Space activation. Trigger asynchronous upload/publish/recovery/download/resend/polling outcomes and assert the specific live-region message. Query controls by `getByRole(..., { name })` or inspect Playwright's accessible snapshot rather than DOM `name` attributes. Under `reducedMotion: "reduce"`, assert relevant computed animation durations/names are disabled (and add `motion-reduce:animate-none` to continuous spinners where needed). Run axe after dynamic error/success/dialog states as well as initial page load.

### P2 — Continuous digital-download spinners ignore reduced-motion preference

**Evidence:** `apps/web/components/customer/digital-download-list.tsx:150-152` and `apps/web/components/customer/digital-order-downloads.tsx:92-95`.

Both loading indicators use an unqualified `animate-spin`, while the application's loading skeletons already use `motion-reduce:animate-none`. Users requesting reduced motion still receive continuous rotation on the initial download page and while an authenticated order opens its downloads.

**Remediation:** Add `motion-reduce:animate-none` (or an equivalent centralized reduced-motion rule) to both icons, retain the adjacent textual status, and cover the computed style in the reduced-motion acceptance check.

### P2 — A download link remains labelled “Preparing…” after a download attempt

**Evidence:** `apps/web/components/customer/digital-download-list.tsx:94-97` and `:250-259`.

Clicking a file sets `downloadingId`, but no success, failure, timeout, navigation, or browser-download event clears it. Since a content-disposition download normally leaves the page mounted, that file can display “Preparing…” indefinitely even after the download succeeds or the signing request fails. The link remains actionable, making its visual state misleading rather than protective.

**Remediation:** Use Playwright/browser-download-aware behavior or a bounded pending state that resets after navigation/download initiation and on error; ideally initiate through a small controlled handler that exposes failure feedback and announces the transition. Add an acceptance assertion for success and signing failure.

## Positive observations

- Download expiry, suspension, revocation, remaining grants, immutable-version behavior, and recovery language are presented in user-facing terms rather than internal implementation language.
- Error views and recovery submission move focus to alert/status content, and merchant upload controls have explicit labels and progress semantics.
- Core cards and action groups generally collapse to full-width/mobile layouts, filenames permit wrapping, and physical fulfillment is suppressed on digital-only customer order views.
- Merchant delivery controls explain why resend is unavailable and announce success/error feedback.

## Release disposition

Do not approve the UX gate or enable the feature outside the internal cohort until both P1 findings are resolved and the resulting seeded suite executes with zero skips. The P2 reduced-motion and stale pending-state issues should also be fixed before general availability; if deferred for an internal-only acceptance cohort, record owners and deadlines explicitly.
