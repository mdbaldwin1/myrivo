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

---

## Round 4 re-review — commit `14cafc6`

### Verdict

**FAIL** — the browser suite now performs several real UI interactions and the stalled-download state is resolved, but two P1 release-gate defects remain: the primary merchant upload fixture is not a valid PNG, and the buyer checkout test bypasses the actual Stripe checkout/payment experience. Accessibility coverage is improved incrementally but still does not verify the required dynamic workflows and announcements.

### P1 — The merchant upload journey supplies spoofed PNG bytes and cannot pass the production validation path

**Evidence:** `apps/web/e2e/digital-products.spec.ts:9-16`, especially line 13.

The test declares `mimeType: "image/png"` and the filename `acceptance-art.png`, but the uploaded buffer is the UTF-8 bytes for `acceptance-image`, not a PNG file with a valid signature and decodable pixel data. The production asset pipeline explicitly rejects MIME/signature spoofing and performs bounded image decoding. Therefore the release-gate journey will fail before preview readiness and publish when run against the real application, or it will only pass if the configured environment bypasses the protections the release is intended to validate.

**Required remediation:** Check in or generate a small, genuinely valid PNG fixture with known dimensions and safe content, upload it through the file control, await distinct upload-complete and preview-ready states, then activate and verify the product on the public storefront. Use a second valid image for replacement and assert the prior buyer's immutable filename/version after replacement.

### P1 — The buyer test does not complete Stripe checkout or prove delivery/access continuity

**Evidence:** `apps/web/e2e/digital-products.spec.ts:21-31`.

After clicking Checkout and merely asserting that the URL contains `checkout|stripe`, the test manually navigates to the fixture's pre-seeded `checkoutReturn` URL. It does not interact with Stripe test mode, submit payment, wait for the webhook/delivery worker, observe the Resend message, or open the delivered fragment link. It also covers only one cart despite the requirement for both digital-only and mixed checkout. The final `observe` call has no asserted fields, so it does not prove the clicked download committed a grant or remained tied to the just-completed order.

This can pass using an old seeded return URL even when checkout composition, payment completion, email delivery, fragment exchange, or order binding is broken.

**Required remediation:** Complete both digital-only and mixed purchases in Stripe test mode (using Stripe's supported test automation), wait for exact checkout/delivery completion, retrieve the matching test-recipient message, open its access link, and download through the UI. Assert the same run/order IDs, digital-only absence of fulfillment, mixed physical fulfillment, immutable filename, and committed grant count from the bound observation. External provider credentials may block execution in this worktree, but the checked-in test must encode the real sequence rather than bypass it.

### P1 — Accessibility coverage still does not establish the dynamic interaction gate

**Evidence:** `apps/web/e2e/digital-products-accessibility.spec.ts:19-40`, `:55-82`, and `:84-90`.

Improvements are real: 200% zoom now checks focused action bounds, recovery validation is keyboard-triggered and focus-checked, merchant file/publish controls are programmatically focusable, and reduced motion is checked while loading is active. However, substantive gaps remain:

- The zoom target remains the last generic button/link rather than each surface's named primary action, and it is focused but never activated at zoom.
- Recovery still uses four merely unique focus strings, not an expected focus order. Catalog controls are focused programmatically rather than reached/operated by keyboard; file upload, publish, replacement confirmation, cart, checkout, access, download, resend, and dialogs are not keyboard-driven.
- Only the recovery validation announcement is asserted. Upload progress/completion/failure, preview readiness, publish result, checkout polling, delivery result, download success/failure/timeout, and resend feedback are not checked as live announcements.
- Axe does not run after upload/preview/publish, replacement dialog, checkout/delivery, suspended/revoked access, download failure/timeout, or resend states.

Because these are precisely the feature-specific dynamic states named in the Task 15 gate, initial-page axe scans plus a recovery error are insufficient for release approval.

**Required remediation:** Extend the executable UI journeys with accessibility assertions at each dynamic state. Use Tab/Shift+Tab and Enter/Space to reach and operate exact controls, verify dialog trap/return focus, assert exact live-region messages, run axe after success/error/financial states, and activate named primary actions at 200% zoom on mobile and desktop.

### P2 — Financial-state UI assertions remain overly broad and do not verify the intended access policy

**Evidence:** `apps/web/e2e/digital-products.spec.ts:50-60`.

Refund validation searches for the transition word anywhere on the customer order. Dispute validation accepts any one of `available|unavailable|suspended|revoked` for every transition, so “opened,” “won,” and “lost” can all show the wrong state and still pass. The test does not verify partial refund preserves access, full refund revokes it, open dispute suspends it, won restores it, or lost revokes it.

**Remediation:** Assert exact state-specific status labels, explanatory copy, download-button availability, and merchant/customer recovery actions after each injected event. Validate exact bound observation fields as a secondary check.

### Resolved from round 3

- **Control endpoint scope:** privileged actions are now limited to reset, observation, and provider-state injection; merchant upload/publish, recovery, replacement, resend, cart initiation, access, and download are attempted through UI controls.
- **Stalled download:** `digital-download-list.tsx:150-184` adds a configurable timeout, clears the pending state, announces retry guidance, removes the iframe, and blocks concurrent attempts. The component test exercises the silent-response path without claiming success.
- **Zoom/reduced-motion basics:** focused bounds and an active-spinner computed-style assertion are now present.

### Round 4 release disposition

Do not approve the UX/accessibility gate. Provider fixture absence is an acceptable external execution blocker, but the repository-side acceptance test itself must first describe a valid upload and an actual Stripe/Resend checkout-to-download journey with exact state assertions.

---

## Round 5 re-review — commit `8e43d02`

### Verdict

**FAIL** — valid image upload, hosted Stripe interaction, mixed-cart construction, exact financial-state assertions, and stalled-download recovery are now encoded. Two P1 gaps remain: the suite still does not verify Resend email delivery/access-link linkage, and the accessibility suite is unchanged from round 4 and remains insufficient for the required dynamic-state gate.

### P1 — Checkout-to-access skips the delivered email and does not prove the access belongs to the completed purchase

**Evidence:** `apps/web/e2e/digital-products.spec.ts:8-17` and `:33-50`.

The test now enters Stripe's test card on hosted Checkout for both digital-only and mixed carts and waits for the application return page. That resolves the prior direct-return bypass. However, it immediately clicks the return page's “view/access downloads” link. It never polls or reads the configured Resend test recipient, verifies recipient/subject/order linkage, opens the URL from the delivered message, or asserts that its fragment was exchanged and removed. The final observation is only asserted to be truthy; it does not prove the observed order/composition/payment/email/token/manifest/grant corresponds to the purchase just completed.

As a result, a stale authenticated download session or pre-seeded return-page link can satisfy the UI steps while delivery email is missing, linked to the wrong order, or contains an unusable access URL. This misses a central customer journey and the Task 15 real-provider acceptance requirement.

**Required remediation:** Capture the just-created order/payment identity after each hosted checkout, poll the designated Resend test inbox/API for the matching message, assert recipient, order/store context, single fragment-token link, and absence of private paths, then open that exact link in a clean browser context. Verify fragment removal, files for the same immutable manifest/version, successful UI download, and exact committed grant count in the run-bound observation. Assert digital-only vs mixed composition and fulfillment copy separately.

### P1 — Accessibility coverage still does not exercise the feature's critical dynamic states

**Evidence:** `apps/web/e2e/digital-products-accessibility.spec.ts:19-40`, `:55-82`, and `:84-90`.

This file has no substantive changes in round 5. The remaining round-4 gaps therefore persist:

- Zoom validates the last generic action rather than named primary actions and never activates them at 200%.
- Recovery focus order is only four unique strings, not an expected sequence.
- Catalog file and publish controls are focused programmatically, not reached and operated with Tab/Enter/Space; replacement dialog focus trap/restoration and file-input keyboard behavior remain untested.
- Cart, checkout return, delivered access, download, customer order, and merchant resend are not keyboard-operated.
- Only recovery validation has an asserted announcement. Upload/preview/publish, checkout/delivery, download success/failure/timeout, and resend announcements remain unverified.
- Axe does not run after upload/preview/publish, replacement dialog, delivery failure, suspended/revoked access, download failure/timeout, or resend success/error.

Initial-page axe scans are valuable, but they cannot approve the explicit dynamic-state accessibility gate.

**Required remediation:** Integrate accessibility assertions into deterministic UI journeys at mobile and desktop: operate named controls from the keyboard, assert exact focus order and dialog trap/return, activate named primary controls at zoom, verify each live-region message, and run axe after the important success/error/financial states.

### P2 — Provider observations are not asserted beyond object truthiness

**Evidence:** `apps/web/e2e/digital-products.spec.ts:29-30`, `:47-48`, `:65`, `:75`, `:83`, and `:93`.

The acceptance evidence schema is stricter, but the browser suite does not assert its relevant fields. It therefore fails to bind UI outcomes to expected product/order IDs, payment livemode/status, checkout composition, email status, manifest versions, access status, grant count, or retry/resend attempts.

**Remediation:** Parse observations with the shared evidence schema and assert exact expected fields after each action. In particular, prove five grants plus grace reuse and sixth rejection, prior-version preservation after replacement, no grant reset on recovery/resend, and retry convergence.

### Resolved from round 4

- **Valid upload fixture:** the base64 buffer at `digital-products.spec.ts:6` has a real PNG signature and decodable 1×1 payload; it is used for initial upload and replacement.
- **Hosted checkout:** `completeStripeCheckout()` fills Stripe test-mode card fields and waits for the application return; both digital-only and mixed carts are constructed through UI controls.
- **Financial UI states:** partial/full refunds and opened/won/lost disputes now use transition-specific copy and download-action visibility assertions (`digital-products.spec.ts:68-84`).
- **Stall timeout:** the configurable timeout, retry announcement, iframe cleanup, and concurrent-attempt guard remain present and unit-covered.

### Round 5 release disposition

Do not approve the UX/accessibility gate. Real provider credentials may remain an external execution blocker, but the checked-in journey must encode email retrieval and access-link continuity, and the dynamic accessibility requirements must be represented by executable assertions before the release gate can be considered complete.

---

## Round 6 re-review — commit `fb5720c`

### Verdict

**FAIL** — Resend message retrieval, clean-context fragment exchange, checkout composition binding, and isolated financial orders are now represented. One P1 remains unchanged: the accessibility suite still does not exercise the feature's critical dynamic states. The grant/version acceptance assertions also remain incomplete and include a likely mismatch with the actual sixth-download error message.

### P1 — Dynamic accessibility coverage remains below the explicit release gate

**Evidence:** `apps/web/e2e/digital-products-accessibility.spec.ts:19-40`, `:55-82`, and `:84-90`.

The accessibility file is substantively unchanged from rounds 4 and 5. It still scans initial pages, validates one recovery error, programmatically focuses two catalog controls, and checks one active spinner. It does not:

- keyboard-operate upload, preview/publish, replacement dialog, cart, checkout return, download, customer-order access, or merchant resend;
- assert an expected focus order, modal focus trap, Escape behavior, or return focus;
- verify live announcements for upload progress/completion/failure, preview readiness, publish, checkout polling/delivery, download success/failure/timeout, refund/dispute access changes, or resend;
- run axe after upload/preview/publish, replacement confirmation, delivery failure, suspended/revoked access, download failure/timeout, or resend states;
- activate each surface's named primary action at 200% zoom (it continues to select the last generic button/link, focus it, and stop).

The new functional browser flow creates deterministic dynamic states that the accessibility suite could reuse, but it currently does not. Since Task 15 explicitly requires keyboard/focus, announcements, labels, contrast, reduced motion, zoom, and dynamic merchant/buyer states, this remains release-blocking rather than optional test depth.

**Required remediation:** Add mobile and desktop accessibility journeys that use Tab/Shift+Tab and Enter/Space on exact named controls; verify replacement/confirmation focus trap and restoration; assert precise live-region messages for every asynchronous critical state; run axe after each success/error/financial state; and operate the named primary action at 200% zoom while asserting it remains unobscured and functional.

### P2 — Five-grant, grace, and sixth-rejection assertions are not exact and may not match the UI response

**Evidence:** `apps/web/e2e/digital-products.spec.ts:50-67`.

The test plausibly initiates five downloads across the clean email context and the return-page context, but the `five-grants` observation is not asserted at all. It does not inspect committed grant count, grace reuse, or remaining grants, and it never deliberately performs a same-session grace reuse. After the sixth click it expects `/limit|contact|unavailable/`; the component's observed JSON-failure feedback is “could not be downloaded. Please try again,” so a correctly rejected 409 can fail this assertion. Conversely, any matching unrelated status text could satisfy it.

**Remediation:** Assert the shared observation schema's exact entitlement/grant fields after each stage: five committed grants, grace reuse without increment, and sixth rejection with zero remaining. Assert the download button/state refresh and the exact accessible error message returned for limit exhaustion.

### P2 — Replacement acceptance does not prove the prior buyer version was preserved

**Evidence:** `apps/web/e2e/digital-products.spec.ts:71-85`.

The merchant replaces the asset and records an observation, but the observation fields are not asserted and the original buyer's clean download view is not reopened. The test therefore does not prove that the existing entitlement retains the original asset-version ID/filename while future purchases receive the replacement.

**Remediation:** Capture the pre-replacement manifest asset-version ID and customer filename, replace through the UI, then reopen the prior buyer access link/session and assert the same version/filename. Create or inspect a subsequent purchase and assert it receives the new version.

### Resolved from round 5

- **Email continuity:** `getResendAccessMessage()` finds a message by exact recipient plus completed order ID, retrieves its body, extracts a fragment-token download URL, rejects private-path content, and the scenario opens that URL in a fresh browser context (`digital-products.spec.ts:46-55`).
- **Fragment cleanup:** the clean context asserts the resulting URL ends at `/downloads`, proving the bearer fragment is removed before use.
- **Order/composition binding:** each hosted checkout extracts the newly completed order ID, observes that subject, and asserts `digital_only` or `mixed` composition (`digital-products.spec.ts:66-67`).
- **Financial isolation:** separate order fixtures are used for partial refund, full refund, dispute won, and dispute lost, avoiding destructive serial-state contamination.
- **Stall timeout:** remains implemented and unit-covered.

### Round 6 release disposition

Do not approve the UX/accessibility gate until the remaining P1 is resolved. The real-provider run may still be externally blocked, but repository-side dynamic accessibility assertions must exist and compile before provider availability can be the only outstanding acceptance dependency.

---

## Round 7 re-review — commit `39eb128`

### Verdict

**FAIL** — accessibility coverage now includes recovery success, merchant resend, populated cart, product-add, and download-result axe scans, but the core keyboard/focus and dynamic-state requirements are still not substantively verified. Exact grant/grace/version assertions also remain unresolved from round 6.

### P1 — The accessibility suite still substitutes programmatic focus for keyboard navigation and omits critical dynamic states

**Evidence:** `apps/web/e2e/digital-products-accessibility.spec.ts:55-96` and `:98-119`.

Round 7 adds useful dynamic axe scans and Enter activation. However, nearly every workflow control is reached with `locator.focus()`, which bypasses the browser's tab order and cannot detect unreachable controls, incorrect ordering, focus loss, or hidden focus targets. The only Tab-based check remains four unique values on recovery; it still does not assert the expected sequence. The suite does not test Shift+Tab, replacement/confirmation dialog trapping, Escape/cancel behavior, or restoration to the invoking control.

Feature-critical state coverage remains incomplete:

- Catalog upload is not performed, so upload progress/failure, preview readiness, publish completion, and their live announcements/axe states are not tested.
- The publish button is focused but never keyboard-activated.
- Checkout is focused but never activated; checkout polling/delivery announcements are absent.
- Download is conditionally skipped when invisible, allowing the test to pass without validating it; only `/started|preparing/` is accepted and failure/timeout announcements are absent.
- Refund/dispute suspended/revoked states and delivery failure are not axe-scanned.
- Resend checks a result but not focus preservation or error behavior.
- Zoom still selects the last generic button/link and focuses it without activating a named primary action.

These gaps mean the suite can remain green when a keyboard user cannot naturally reach or complete the main workflows, or when critical asynchronous/financial states introduce accessibility violations.

**Required remediation:** Navigate exact expected sequences using Tab and Shift+Tab, activate with Enter/Space without calling `.focus()`, and fail—not skip—when required controls are absent. Upload a valid file, publish, replace through the confirmation dialog, checkout, download, and resend while asserting precise live-region messages and running axe after each dynamic success/error state. Verify modal trap/Escape/return focus. Add financial suspended/revoked and delivery-failure scans. At 200% zoom, locate each surface's named primary action, activate it, and verify the resulting state.

### P2 — Five grants, grace reuse, and sixth rejection remain unasserted

**Evidence:** `apps/web/e2e/digital-products.spec.ts:50-67`.

The `five-grants` observation is recorded but its parsed grant fields are never asserted. There is no deliberate within-grace repeat proving reuse without increment, and the sixth-click assertion still expects `/limit|contact|unavailable/`, which does not match the download component's JSON-error message (“could not be downloaded. Please try again”). Thus the suite neither proves the five-grant policy nor reliably verifies the limit UX.

**Remediation:** Assert exact parsed grant rows/counts after each stage, explicitly perform grace reuse in the same session, verify five committed grants with zero remaining, and assert the exact accessible sixth-rejection message/button state.

### P2 — Replacement still does not prove immutable prior-buyer version access

**Evidence:** `apps/web/e2e/digital-products.spec.ts:71-85`.

The replacement observation is parsed by a stronger schema but its manifest/version fields are not compared before and after replacement. The prior buyer session/link is not reopened and no subsequent purchase is checked, so preservation of the purchased version remains assumed.

**Remediation:** Capture and assert the prior entitlement's asset-version ID and filename, replace through UI, reopen the prior buyer access and verify they are unchanged, then verify a later purchase receives the new version.

### Resolved/improved from round 6

- The accessibility suite now axe-scans dynamic recovery success, resend result, product-added, populated-cart, and download-result states.
- Recovery success and merchant resend live-region messages are asserted.
- Acceptance observations are parsed through the shared schema and bound to run/subject IDs.
- Provider financial actions now use Stripe test APIs/helpers rather than the application injection control.
- Email retrieval, clean-context fragment exchange, order/composition binding, valid image upload, exact financial UI states, reduced motion, and stalled-download recovery remain represented.

### Round 7 release disposition

Do not approve the UX/accessibility gate. The new scans are meaningful progress, but the remaining P1 concerns natural keyboard reachability, focus behavior, and required dynamic states—not merely additional test quantity.

---

## Round 8 re-review — commit `5f73e6a`

### Verdict

**FAIL** — real tab-order reachability is now checked for several controls, and provider/grant/replacement evidence is substantially stronger. One P1 remains: the accessibility suite still stops short of keyboard-completing the core merchant and checkout workflows and omits the required dialog, financial, and failure-state accessibility checks.

### P1 — Keyboard reachability improved, but critical workflows and dynamic states still are not accessibility-tested end to end

**Evidence:** `apps/web/e2e/digital-products-accessibility.spec.ts:7-14`, `:88-104`, and `:106-127`.

`tabTo()` is a meaningful improvement: file input, publish, resend, add-to-cart, checkout, download, and zoom targets must now be reachable in the browser's actual Tab order. Add-to-cart, resend, and download are keyboard-activated. However:

- The file input is never supplied a file in the accessibility journey, so upload progress/completion/failure, preview readiness, and their announcements/axe states remain absent.
- Publish and checkout are only reached and focused; neither is activated. Publish-result and checkout polling/delivery announcements remain untested.
- Replacement/confirmation dialogs remain entirely absent: no keyboard opening, focus trap, Shift+Tab wrapping, Escape/cancel, confirmation, or return-focus assertion.
- Download coverage still conditionally skips the entire interaction if the control is not visible, allowing the required assertion to disappear silently.
- No accessibility scan covers delivery failure, partial/full refund, dispute suspension/restoration/revocation, download JSON failure/timeout, or resend error.
- Zoom still targets the last generic button/link rather than a named primary control and does not activate it.
- The recovery four-stop check still asserts uniqueness rather than an expected semantic order; no explicit Shift+Tab path is tested anywhere.

These are explicit Task 15 requirements on the most consequential dynamic states. A release gate that can pass without keyboard-publishing, keyboard-checking out, encountering the replacement dialog, or scanning financial/failure states remains incomplete.

**Required remediation:** In the accessibility suite, upload the valid PNG via the keyboard-reached input; assert upload and preview live messages and axe results; keyboard-activate publish and checkout; exercise the replacement dialog's trap, reverse traversal, Escape, confirm, and return focus; make download presence mandatory; inject/visit each financial and delivery-failure state and run axe; simulate download failure/timeout and assert announcements; and activate named surface-specific actions at 200% zoom.

### P2 — Grant evidence is richer but grace reuse is not actually proven by comparison

**Evidence:** `apps/web/e2e/digital-products.spec.ts:53-82`.

Five isolated sessions are created, a first-session repeat is attempted, signing-failure state is compared, and scenario evidence carries grant/session IDs. However, `graceReusedGrantId` is simply assigned the last observed grant after the repeat; the test never captures the grant ID/count before the repeat and asserts they are unchanged. Likewise `sixthDenied` is supplied as the literal `true` rather than derived from exact post-click observation, and the sixth error still uses the potentially mismatched `/limit|contact|unavailable/` copy assertion.

**Remediation:** Observe before and after the grace click and assert identical committed grant IDs/count; observe after the sixth attempt and derive denial/zero remaining from database state; assert the component's exact accessible rejection message.

### P2 — Replacement evidence proves version selection but not prior buyer access after replacement

**Evidence:** `apps/web/e2e/digital-products.spec.ts:94-133`.

The scenario now captures the prior manifest version, hashes the prior download, verifies a new catalog version, and proves a subsequent checkout snapshots the replacement. That is substantial. It still does not reopen the original buyer's access after replacement and compare its filename/content hash to the pre-replacement value. The evidence therefore proves the database manifest remained and a new checkout changed, but not the final buyer-facing download continuity.

**Remediation:** After replacement, reopen the original buyer's access link/session, assert the original customer filename/version, download it, and compare its hash with `priorContentSha256`.

### Resolved/improved from round 7

- Actual Tab traversal replaces programmatic focus for covered controls, with a bounded failure if a target is unreachable.
- Add-to-cart uses Space; resend and download use Enter.
- Acceptance observations are schema-validated and provider evidence is scenario-validated.
- Five isolated sessions, a grace attempt, signing-failure comparison, and sixth attempt are encoded.
- Replacement captures prior version/content, verifies a distinct catalog version, and proves a new checkout snapshots the replacement.
- Resend, checkout, refund, dispute, and delivery evidence is more tightly correlated with provider and application identifiers.

### Round 8 release disposition

Do not approve the UX/accessibility gate. One P1 remains in the executable accessibility contract; provider unavailability should become the only blocker only after these repository-side assertions are complete.
