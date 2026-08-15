-- Customer order surfaces (/order/{id}, the customer dashboard API) query
-- orders, order items, and shipping delays with the user-scoped client, but
-- no policy granted customers access to their own orders, so every customer
-- order page resolved to not-found. Grant read access to the signed-in
-- customer whose verified email placed the order.

create policy orders_customer_read on public.orders
  for select to authenticated
  using (
    lower(customer_email) = lower(nullif(coalesce(auth.jwt() ->> 'email', ''), ''))
  );

create policy order_items_customer_read on public.order_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.orders placed_order
      where placed_order.id = order_items.order_id
        and lower(placed_order.customer_email) = lower(nullif(coalesce(auth.jwt() ->> 'email', ''), ''))
    )
  );

create policy order_shipping_delays_customer_read on public.order_shipping_delays
  for select to authenticated
  using (
    exists (
      select 1
      from public.orders placed_order
      where placed_order.id = order_shipping_delays.order_id
        and lower(placed_order.customer_email) = lower(nullif(coalesce(auth.jwt() ->> 'email', ''), ''))
    )
  );
