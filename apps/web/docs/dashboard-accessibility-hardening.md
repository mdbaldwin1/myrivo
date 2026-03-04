# Dashboard Accessibility Hardening (`myrivo-4.9`)

## Changes

1. Mobile navigation sheet is now controlled state:
   - closes on route change
   - closes immediately when a nav item is activated
2. Mobile navigation trigger has explicit accessible name (`aria-label`).
3. Active dashboard navigation links now expose `aria-current="page"`.

## Keyboard and Screen Reader Impact

- Keyboard users do not remain trapped in an open nav sheet after navigation.
- Screen reader users get explicit current-page context in each nav section.
- Mobile nav affordance has a deterministic label for assistive tech.

## Verification

- `npm run lint`
- `npm run typecheck`
