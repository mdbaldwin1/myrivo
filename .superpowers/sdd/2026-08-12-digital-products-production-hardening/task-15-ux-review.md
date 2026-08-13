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

---

## Round 2 re-review — commit `0466edb`

### Verdict

**FAIL** — the two original P1 acceptance-harness blockers remain, and the fragment exchange introduces a new P1 recovery failure. The reduced-motion spinner issue is resolved. The stale “Preparing…” label is bounded now, but the implementation still announces success without observing the download result.

### P1 — Required journeys still are not driven through user actions or verified against application state

**Evidence:** `apps/web/e2e/digital-products.spec.ts:35-42`, `:44-57`, `:59-83`, and `:85-99`.

The rewritten suite is functionally the same as round 1: it logs in and opens an already-prepared catalog, navigates directly to fixture return/cart/download/order URLs, and makes broad text assertions. It never operates create/configure/upload/publish controls, cart/checkout controls, an emailed link, five download grants, replacement, refunds, dispute transitions, delivery retry, or merchant resend. Converting the free-form evidence file to JSON improves evidence hygiene but does not connect `providerEventId` or the arbitrary truthy `applicationState` value to the current environment, order, entitlement, database state, or any observed UI state. A fabricated object such as `{ "schemaVersion": 1, "scenarios": [{ "id": "five-grants", "providerEventId": "job_x", "applicationState": true }, ...] }` satisfies these assertions.

The prior remediation remains required: exercise every named journey through deterministic UI/provider test fixtures and verify exact resulting buyer and merchant states. Structured provider evidence should supplement those behavioral assertions and must be cryptographically/run-bound or independently queried, not merely trusted because its fields are present.

### P1 — Accessibility coverage remains too shallow to establish the requested gate

**Evidence:** `apps/web/e2e/digital-products-accessibility.spec.ts:44-57` and `:72-89`.

Separate customer and merchant identities are now used, and horizontal document overflow is checked after CSS zoom. However, the “primary action” is simply the last button/link and is only scrolled into view, never checked for clipping/overlap or activated. Keyboard validation still presses Tab once on only the recovery page; it does not check order across required surfaces, file input access, dialog trap/restoration, or Enter/Space activation. The live-region assertion still only proves some node exists before an operation and never checks an emitted message. Accessible names are still approximated from DOM attributes/text, including the non-accessibility `name` attribute, rather than queried through roles/accessibility-tree names. Reduced-motion computed style is checked only for `.animate-spin` nodes present on the idle recovery page, where there normally are none, so the loop is vacuous. Dynamic success/error/dialog states do not receive axe or contrast checks.

The prior remediation remains required. In particular, trigger the actual asynchronous states before checking their announcements/reduced-motion styles, and query/activate exact controls through `getByRole(..., { name })` across all critical workflows.

### P1 — A transient session-exchange failure destroys the only credential before retry

**Evidence:** `apps/web/components/customer/digital-download-list.tsx:103-114`, `:116-143`, and `:198-209`.

The client removes `#token=...` with `history.replaceState` before the session POST succeeds. If the POST times out, is aborted, returns 429/5xx, or the response/cookie is lost, the component shows a retryable error. The “Try again” button calls `load()` after the fragment has already been erased, so it skips exchange and requests `/api/digital-downloads` without an established cookie. That fails again, and a legitimate buyer cannot recover without reopening the original email URL or requesting another link. This is especially damaging on mobile or unreliable networks and contradicts the displayed retry affordance.

**Required remediation:** Keep the fragment token in component memory until exchange succeeds, and remove it from browser history immediately without discarding the in-memory retry credential. Clear the in-memory token only after a confirmed session response/cookie path; distinguish unavailable/expired credentials from transient errors. Add a browser test that fails the first exchange, clicks “Try again,” succeeds on the second exchange, confirms the address bar never exposes the fragment afterward, and loads the files.

### P2 — Download feedback is time-based and can falsely announce success

**Evidence:** `apps/web/components/customer/digital-download-list.tsx:146-152` and `:272-280`.

The visible “Preparing…” state now clears after 2.5 seconds and both transitions are announced, resolving the indefinite label from round 1. But the timeout always announces “download started” regardless of whether navigation produced a signed redirect, a 409/429/503 JSON error, or no response. Because the link navigation is not observed, failure feedback is neither presented nor actionable in the download page.

**Remediation:** Initiate the request through an observable flow (or use a download iframe/window plus explicit server/client result contract), announce success only after confirmed initiation, and surface 409/429/503 with retry guidance. Cover both successful download and signing/rate-limit failure.

### Resolved from round 1

- **Reduced motion:** both continuous download spinners now include `motion-reduce:animate-none` in `digital-download-list.tsx:170-172` and `digital-order-downloads.tsx:92-94`.
- **Indefinite preparing label:** bounded at 2.5 seconds in `digital-download-list.tsx:146-152`, though the accuracy concern above remains P2.

### Round 2 release disposition

Do not approve the UX/accessibility release gate. Resolve all three P1 findings and re-run the seeded browser suite with zero skipped tests. The strict fixture interlock prevents an empty CI run, but it does not compensate for assertions that do not exercise or substantiate the required experiences.

---

## Round 3 re-review — commit `a26c7b1`

### Verdict

**FAIL** — fragment retry and response-aware download messaging are materially improved, but the two acceptance-quality P1 blockers remain. The new “executable” scenario suite calls a privileged control endpoint instead of driving the claimed user journeys, and accessibility validation still covers only a small fraction of the required interaction semantics.

### P1 — The executable suite mutates scenarios through a control API, not through the product UX

**Evidence:** `apps/web/e2e/digital-products.spec.ts:9-16`, `:18-25`, `:27-43`, and `:45-52`; `apps/web/e2e/digital-products-fixture.ts:27-35`.

The fixture helper POSTs an arbitrary action string to an externally supplied privileged `controlUrl` and trusts the returned state fields. Every high-risk operation is performed this way: `merchant-upload-publish`, Stripe payment, grant issuance, replacement, recovery, refunds, disputes, delivery failure/retry, and resend. The tests do not click upload/publish controls, add items or complete checkout, open the delivered email, activate a download, submit recovery, use merchant resend, or inspect customer/merchant UI after each financial transition. Despite the test title, the merchant scenario performs no catalog action between navigation and reload. The only post-action UI checks are “Ready to sell,” one checkout link, one files heading, and “Delivery sent.”

This structure can verify a separately implemented acceptance controller while the actual merchant and buyer interfaces are broken. It also cannot demonstrate keyboard/mouse usability, state-specific copy/actions, immutable prior-version visibility, or the absence/presence of physical fulfillment throughout the real flow. Run binding and exact returned fields are useful anti-fabrication improvements, but they do not make the control API equivalent to the user experience.

**Required remediation:** Reserve control actions for deterministic setup and provider event injection only. Perform merchant upload/preview/publish, cart construction, checkout navigation, delivered-link opening, five download clicks/grace behavior, recovery form submission, replacement management, and merchant resend through the rendered UI. After provider-side refund/dispute/failure injection, reload both customer and merchant views and assert exact access status, explanation, and available/unavailable actions. Correlate each action with the same run/order/entitlement and assert those identifiers or immutable filenames in the UI.

### P1 — Accessibility validation remains incomplete for the required workflows

**Evidence:** `apps/web/e2e/digital-products-accessibility.spec.ts:19-32`, `:35-45`, `:47-64`, and `:66-72`.

The suite now uses distinct customer and merchant identities, validates a dynamic recovery error with focus, and evaluates reduced-motion style while the loading spinner exists. Those are sound improvements. However:

- 200% zoom still checks only document-level horizontal overflow and scrolls the last generic button/link into view; it does not assert the primary action is unclipped, unobscured, named, focusable, or operable.
- Keyboard order is checked only for four focus stops on the recovery page. Unique strings do not establish the intended order, and the suite still omits catalog/file upload, publish, cart, checkout, download, customer order, merchant order, dialog focus trap/restoration, and file-input keyboard access.
- The only announcement assertion is recovery validation. Upload progress/failure, publish result, checkout polling/delivery, download success/failure, and resend status are not triggered or asserted.
- Axe runs on initial pages and one recovery error only; it does not cover the required dynamic upload, dialog, delivery failure, suspension/revocation, download failure, or resend states. No explicit interaction or visual assertion establishes action usability at 200%.

**Required remediation:** Couple the accessibility suite to the real UI journeys described above. At mobile and desktop zoom, assert each named primary action's bounding box fits the viewport, receives focus, and activates successfully. Assert exact focus sequences and dialog trap/return behavior across the critical merchant and buyer flows. Trigger and verify every important live-region message, and run axe after each dynamic/error/financial state.

### P2 — Download preparation can remain indefinitely pending on network silence

**Evidence:** `apps/web/components/customer/digital-download-list.tsx:149-175`.

The iframe approach now distinguishes same-origin JSON failures from cross-origin signed-download initiation and announces the observed result, resolving round 2's unconditional success message. It has no abort or watchdog path, though. If the POST never completes, the iframe never emits a meaningful load event and the button remains “Preparing…” forever.

**Remediation:** Add a bounded timeout that removes the iframe, clears `downloadingId`, and announces a retryable timeout without claiming the grant/download succeeded. Prevent or deliberately support concurrent clicks while a file is preparing, and cover timeout plus 409/429/503 behavior in browser tests.

### Resolved from round 2

- **Fragment retry:** `digital-download-list.tsx:104-117` retains the fragment credential in memory after removing it from the address bar, and clears it only after a successful exchange. “Try again” can therefore repeat a transiently failed exchange without re-exposing the token.
- **Response-aware download feedback:** `digital-download-list.tsx:149-175` no longer uses a fixed success timer; it reports same-origin JSON failure and treats the cross-origin signed redirect as initiation.
- **Reduced motion:** the test now delays the download API and checks computed animation while the spinner is actually mounted (`digital-products-accessibility.spec.ts:66-72`).
- **Separate identities:** customer and merchant axe passes use distinct fixture accounts (`digital-products-accessibility.spec.ts:35-45`).

### Round 3 release disposition

Do not approve the UX/accessibility gate. The remaining P1s are acceptance-evidence failures rather than cosmetic polish: the current browser suite still cannot detect a broken end-user workflow across the feature's most consequential states.
