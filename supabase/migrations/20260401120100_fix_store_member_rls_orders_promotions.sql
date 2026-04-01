-- Fix: allow store admins/staff (via store_memberships) to access all
-- store-scoped tables. Previously many tables only checked
-- stores.owner_user_id, blocking any user added as a store admin via
-- store_memberships.

-- ── orders ──────────────────────────────────────────────────────────────────

drop policy if exists orders_owner_all on public.orders;

create policy orders_store_member_all on public.orders
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = orders.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = orders.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = orders.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = orders.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── order_items ─────────────────────────────────────────────────────────────

drop policy if exists order_items_owner_all on public.order_items;

create policy order_items_store_member_all on public.order_items
for all
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        exists (
          select 1 from public.store_memberships sm
          where sm.store_id = o.store_id
            and sm.user_id = auth.uid()
            and sm.status = 'active'
            and sm.role in ('owner', 'admin', 'staff')
        )
        or exists (
          select 1 from public.stores s
          where s.id = o.store_id
            and s.owner_user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        exists (
          select 1 from public.store_memberships sm
          where sm.store_id = o.store_id
            and sm.user_id = auth.uid()
            and sm.status = 'active'
            and sm.role in ('owner', 'admin', 'staff')
        )
        or exists (
          select 1 from public.stores s
          where s.id = o.store_id
            and s.owner_user_id = auth.uid()
        )
      )
  )
);

-- ── promotions ──────────────────────────────────────────────────────────────

drop policy if exists promotions_owner_all on public.promotions;

create policy promotions_store_member_all on public.promotions
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = promotions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = promotions.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = promotions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = promotions.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── promotion_redemptions ───────────────────────────────────────────────────

drop policy if exists promotion_redemptions_owner_all on public.promotion_redemptions;

create policy promotion_redemptions_store_member_all on public.promotion_redemptions
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = promotion_redemptions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = promotion_redemptions.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = promotion_redemptions.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = promotion_redemptions.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── products ────────────────────────────────────────────────────────────────

drop policy if exists products_owner_all on public.products;

create policy products_store_member_all on public.products
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = products.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = products.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = products.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = products.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── product_variants ────────────────────────────────────────────────────────

drop policy if exists product_variants_owner_all on public.product_variants;

create policy product_variants_store_member_all on public.product_variants
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = product_variants.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = product_variants.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = product_variants.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = product_variants.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── product_option_axes ─────────────────────────────────────────────────────

drop policy if exists product_option_axes_owner_all on public.product_option_axes;

create policy product_option_axes_store_member_all on public.product_option_axes
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = product_option_axes.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = product_option_axes.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = product_option_axes.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = product_option_axes.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── product_option_values ───────────────────────────────────────────────────

drop policy if exists product_option_values_owner_all on public.product_option_values;

create policy product_option_values_store_member_all on public.product_option_values
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = product_option_values.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = product_option_values.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = product_option_values.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = product_option_values.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── product_variant_option_values ───────────────────────────────────────────

drop policy if exists product_variant_option_values_owner_all on public.product_variant_option_values;

create policy product_variant_option_values_store_member_all on public.product_variant_option_values
for all
using (
  exists (
    select 1
    from public.product_variants pv
    where pv.id = product_variant_option_values.variant_id
      and (
        exists (
          select 1 from public.store_memberships sm
          where sm.store_id = pv.store_id
            and sm.user_id = auth.uid()
            and sm.status = 'active'
            and sm.role in ('owner', 'admin', 'staff')
        )
        or exists (
          select 1 from public.stores s
          where s.id = pv.store_id
            and s.owner_user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.product_variants pv
    where pv.id = product_variant_option_values.variant_id
      and (
        exists (
          select 1 from public.store_memberships sm
          where sm.store_id = pv.store_id
            and sm.user_id = auth.uid()
            and sm.status = 'active'
            and sm.role in ('owner', 'admin', 'staff')
        )
        or exists (
          select 1 from public.stores s
          where s.id = pv.store_id
            and s.owner_user_id = auth.uid()
        )
      )
  )
);

-- ── subscriptions (skipped — table does not exist in production) ────────────

-- ── store_domains (drop legacy policy; store_domains_manage already exists) ─

drop policy if exists domains_owner_all on public.store_domains;

-- ── store_settings ──────────────────────────────────────────────────────────

drop policy if exists store_settings_owner_all on public.store_settings;

create policy store_settings_store_member_all on public.store_settings
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_settings.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_settings.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_settings.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_settings.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── store_integrations ──────────────────────────────────────────────────────

drop policy if exists store_integrations_owner_all on public.store_integrations;

create policy store_integrations_store_member_all on public.store_integrations
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_integrations.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_integrations.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_integrations.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_integrations.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── inventory_movements ─────────────────────────────────────────────────────

drop policy if exists inventory_movements_owner_all on public.inventory_movements;

create policy inventory_movements_store_member_all on public.inventory_movements
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = inventory_movements.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = inventory_movements.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = inventory_movements.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = inventory_movements.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── store_email_subscribers ─────────────────────────────────────────────────

drop policy if exists store_email_subscribers_owner_all on public.store_email_subscribers;

create policy store_email_subscribers_store_member_all on public.store_email_subscribers
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_email_subscribers.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_email_subscribers.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_email_subscribers.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_email_subscribers.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── store_experience_content ────────────────────────────────────────────────

drop policy if exists store_experience_content_owner_all on public.store_experience_content;

create policy store_experience_content_store_member_all on public.store_experience_content
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_experience_content.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_experience_content.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_experience_content.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_experience_content.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── store_content_blocks ────────────────────────────────────────────────────

drop policy if exists content_blocks_owner_all on public.store_content_blocks;

create policy content_blocks_store_member_all on public.store_content_blocks
for all
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_content_blocks.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_content_blocks.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_content_blocks.store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'staff')
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_content_blocks.store_id
      and s.owner_user_id = auth.uid()
  )
);

-- ── store_customers (skipped — table dropped in 20260227120000) ─────────────

-- ── audit_events ────────────────────────────────────────────────────────────

drop policy if exists audit_events_owner_read on public.audit_events;

create policy audit_events_store_member_read on public.audit_events
for select
using (
  store_id is not null
  and (
    exists (
      select 1 from public.store_memberships sm
      where sm.store_id = audit_events.store_id
        and sm.user_id = auth.uid()
        and sm.status = 'active'
        and sm.role in ('owner', 'admin', 'staff')
    )
    or exists (
      select 1 from public.stores s
      where s.id = audit_events.store_id
        and s.owner_user_id = auth.uid()
    )
  )
);
