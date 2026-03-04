create table if not exists public.store_experience_content (
  store_id uuid primary key references public.stores(id) on delete cascade,
  home_json jsonb not null default '{}'::jsonb,
  products_page_json jsonb not null default '{}'::jsonb,
  about_page_json jsonb not null default '{}'::jsonb,
  policies_page_json jsonb not null default '{}'::jsonb,
  cart_page_json jsonb not null default '{}'::jsonb,
  order_summary_page_json jsonb not null default '{}'::jsonb,
  emails_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger store_experience_content_set_updated_at
before update on public.store_experience_content
for each row execute function public.set_updated_at();

alter table public.store_experience_content enable row level security;

create policy store_experience_content_owner_all on public.store_experience_content
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = store_experience_content.store_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = store_experience_content.store_id
      and s.owner_user_id = auth.uid()
  )
);

create policy store_experience_content_public_read on public.store_experience_content
for select
using (
  exists (
    select 1 from public.stores s
    where s.id = store_experience_content.store_id
      and s.status = 'active'
  )
);

insert into public.store_experience_content (
  store_id,
  home_json,
  products_page_json,
  about_page_json,
  policies_page_json,
  cart_page_json,
  order_summary_page_json,
  emails_json
)
select
  s.id as store_id,
  jsonb_strip_nulls(
    jsonb_build_object(
      'hero',
      jsonb_build_object(
        'eyebrow', coalesce(sb.theme_json ->> 'heroEyebrow', ''),
        'headline', coalesce(sb.theme_json ->> 'heroHeadline', ''),
        'subcopy', coalesce(sb.theme_json ->> 'heroSubcopy', ''),
        'badgeOne', coalesce(sb.theme_json ->> 'heroBadgeOne', ''),
        'badgeTwo', coalesce(sb.theme_json ->> 'heroBadgeTwo', ''),
        'badgeThree', coalesce(sb.theme_json ->> 'heroBadgeThree', ''),
        'brandDisplay', coalesce(sb.theme_json ->> 'heroBrandDisplay', 'title')
      ),
      'visibility',
      jsonb_build_object(
        'showHero', coalesce((sb.theme_json ->> 'homeShowHero')::boolean, true),
        'showContentBlocks', coalesce((sb.theme_json ->> 'homeShowContentBlocks')::boolean, true),
        'showFeaturedProducts', coalesce((sb.theme_json ->> 'homeShowFeaturedProducts')::boolean, true),
        'featuredProductsLimit', coalesce((sb.theme_json ->> 'homeFeaturedProductsLimit')::integer, 6)
      ),
      'contentBlocks',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', cb.id,
              'sortOrder', cb.sort_order,
              'eyebrow', cb.eyebrow,
              'title', cb.title,
              'body', cb.body,
              'ctaLabel', cb.cta_label,
              'ctaUrl', cb.cta_url,
              'isActive', cb.is_active
            )
            order by cb.sort_order asc, cb.created_at asc
          )
          from public.store_content_blocks cb
          where cb.store_id = s.id
        ),
        '[]'::jsonb
      ),
      'announcement', coalesce(ss.announcement, ''),
      'fulfillmentMessage', coalesce(ss.fulfillment_message, '')
    )
  ) as home_json,
  jsonb_strip_nulls(
    jsonb_build_object(
      'visibility',
      jsonb_build_object(
        'showSearch', coalesce((sb.theme_json ->> 'productsShowSearch')::boolean, true),
        'showSort', coalesce((sb.theme_json ->> 'productsShowSort')::boolean, true),
        'showAvailability', coalesce((sb.theme_json ->> 'productsShowAvailability')::boolean, true),
        'showOptionFilters', coalesce((sb.theme_json ->> 'productsShowOptionFilters')::boolean, true)
      ),
      'layout',
      jsonb_build_object(
        'filterLayout', coalesce(sb.theme_json ->> 'productsFilterLayout', 'sidebar'),
        'filtersDefaultOpen', coalesce((sb.theme_json ->> 'productsFiltersDefaultOpen')::boolean, false),
        'gridColumns', coalesce((sb.theme_json ->> 'productGridColumns')::integer, 3)
      ),
      'productCard',
      jsonb_build_object(
        'showDescription', coalesce((sb.theme_json ->> 'productCardShowDescription')::boolean, true),
        'descriptionLines', coalesce((sb.theme_json ->> 'productCardDescriptionLines')::integer, 2),
        'showFeaturedBadge', coalesce((sb.theme_json ->> 'productCardShowFeaturedBadge')::boolean, true),
        'showAvailability', coalesce((sb.theme_json ->> 'productCardShowAvailability')::boolean, true),
        'showQuickAdd', coalesce((sb.theme_json ->> 'productCardShowQuickAdd')::boolean, true),
        'imageHoverZoom', coalesce((sb.theme_json ->> 'productCardImageHoverZoom')::boolean, true),
        'showCarouselArrows', coalesce((sb.theme_json ->> 'productCardShowCarouselArrows')::boolean, true),
        'showCarouselDots', coalesce((sb.theme_json ->> 'productCardShowCarouselDots')::boolean, true),
        'imageFit', coalesce(sb.theme_json ->> 'productCardImageFit', 'cover')
      )
    )
  ) as products_page_json,
  jsonb_strip_nulls(
    jsonb_build_object(
      'aboutArticleHtml', coalesce(ss.about_article_html, ''),
      'aboutSections', coalesce(ss.about_sections, '[]'::jsonb)
    )
  ) as about_page_json,
  jsonb_strip_nulls(
    jsonb_build_object(
      'shippingPolicy', coalesce(ss.shipping_policy, ''),
      'returnPolicy', coalesce(ss.return_policy, ''),
      'supportEmail', coalesce(ss.support_email, ''),
      'policyFaqs', coalesce(ss.policy_faqs, '[]'::jsonb)
    )
  ) as policies_page_json,
  jsonb_strip_nulls(
    jsonb_build_object(
      'checkout',
      jsonb_build_object(
        'enableLocalPickup', coalesce(ss.checkout_enable_local_pickup, false),
        'localPickupLabel', coalesce(ss.checkout_local_pickup_label, 'Porch pickup'),
        'localPickupFeeCents', coalesce(ss.checkout_local_pickup_fee_cents, 0),
        'enableFlatRateShipping', coalesce(ss.checkout_enable_flat_rate_shipping, true),
        'flatRateShippingLabel', coalesce(ss.checkout_flat_rate_shipping_label, 'Shipped (flat fee)'),
        'flatRateShippingFeeCents', coalesce(ss.checkout_flat_rate_shipping_fee_cents, 0),
        'allowOrderNote', coalesce(ss.checkout_allow_order_note, false),
        'orderNotePrompt', coalesce(
          ss.checkout_order_note_prompt,
          'If you have any questions, comments, or concerns about your order, leave a note below.'
        )
      )
    )
  ) as cart_page_json,
  jsonb_strip_nulls(
    jsonb_build_object(
      'copy',
      jsonb_build_object(
        'storefrontCopyOverrides', coalesce(ss.storefront_copy_json, '{}'::jsonb)
      )
    )
  ) as order_summary_page_json,
  jsonb_strip_nulls(
    jsonb_build_object(
      'newsletterCapture',
      jsonb_build_object(
        'enabled', coalesce(ss.email_capture_enabled, false),
        'heading', coalesce(ss.email_capture_heading, ''),
        'description', coalesce(ss.email_capture_description, ''),
        'successMessage', coalesce(ss.email_capture_success_message, '')
      )
    )
  ) as emails_json
from public.stores s
left join public.store_settings ss on ss.store_id = s.id
left join public.store_branding sb on sb.store_id = s.id
on conflict (store_id) do update set
  home_json = excluded.home_json,
  products_page_json = excluded.products_page_json,
  about_page_json = excluded.about_page_json,
  policies_page_json = excluded.policies_page_json,
  cart_page_json = excluded.cart_page_json,
  order_summary_page_json = excluded.order_summary_page_json,
  emails_json = excluded.emails_json;
