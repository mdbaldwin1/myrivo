-- Customer order read access keyed off the raw JWT email claim, which is only
-- as trustworthy as the project's email-confirmation setting: with signup
-- confirmations disabled, anyone could take an address they do not own and
-- read that buyer's orders across every store. Anchor the policies on the
-- confirmed identity recorded in auth.users instead, so the database enforces
-- verification itself rather than inheriting it from a dashboard toggle.
--
-- The lookup is wrapped in a scalar subselect so it is evaluated once per
-- statement rather than once per row.

create or replace function public.current_verified_customer_email()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(account.email)
  from auth.users account
  where account.id = auth.uid()
    and account.email_confirmed_at is not null
$$;

revoke all on function public.current_verified_customer_email() from public, anon;
grant execute on function public.current_verified_customer_email() to authenticated, service_role;

drop policy if exists orders_customer_read on public.orders;
create policy orders_customer_read on public.orders
  for select to authenticated
  using (
    lower(customer_email) = (select public.current_verified_customer_email())
  );

drop policy if exists order_items_customer_read on public.order_items;
create policy order_items_customer_read on public.order_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.orders placed_order
      where placed_order.id = order_items.order_id
        and lower(placed_order.customer_email) = (select public.current_verified_customer_email())
    )
  );

drop policy if exists order_shipping_delays_customer_read on public.order_shipping_delays;
create policy order_shipping_delays_customer_read on public.order_shipping_delays
  for select to authenticated
  using (
    exists (
      select 1
      from public.orders placed_order
      where placed_order.id = order_shipping_delays.order_id
        and lower(placed_order.customer_email) = (select public.current_verified_customer_email())
    )
  );

create index if not exists idx_orders_customer_email_lower
  on public.orders (lower(customer_email));
