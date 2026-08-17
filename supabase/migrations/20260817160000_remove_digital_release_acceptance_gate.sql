-- Retire the digital products release acceptance interlock.
--
-- Enabling digital products for a store required a matching, unexpired
-- approval row produced by a signed acceptance-evidence run. That interlock
-- did its job once - it surfaced a dispute webhook that was being dropped
-- silently - but it is no longer how this product is released, and the
-- approval expiry window blocked enablement on a clock rather than on
-- anything about the store.
--
-- Rollout control stays exactly where it belongs: store_feature_flags plus
-- the billing plan feature flag, checked by is_store_digital_products_enabled.
-- Buyer-facing limits (five download grants per file, 48-hour access links)
-- are untouched.
--
-- The approvals and runtime tables are kept as a historical record of what was
-- verified; they simply no longer gate anything.

drop trigger if exists enforce_digital_products_release_approval on public.store_feature_flags;
drop function if exists public.enforce_digital_products_release_approval();

alter table public.digital_products_release_approvals
  drop constraint if exists digital_products_release_approvals_window;

-- The non-production acceptance control plane exists only to observe state and
-- inject faults for that run; nothing else calls it.
drop function if exists public.acceptance_control_digital_products(integer, text, uuid, uuid, text, uuid);
drop function if exists public.consume_digital_acceptance_signing_fault(uuid, uuid);
drop table if exists public.digital_acceptance_signing_faults;
drop table if exists public.digital_acceptance_actions;
drop table if exists public.digital_acceptance_targets;
drop table if exists public.digital_acceptance_configuration;
