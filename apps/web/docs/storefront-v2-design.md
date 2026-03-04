# Storefront V2 Design Direction

## Goal
Create a beautiful, classy, professional storefront that feels curated by default and avoids a utility-dashboard look.

## Visual Principles
- Prioritize typography, spacing, and imagery over boxes and borders.
- Keep the top of page minimal: identity, navigation, cart.
- Use restraint with color accents. Most surfaces should stay calm and neutral.
- Remove decorative clutter from the hero.
- Let products carry the visual weight.

## Layout System
- Page flow:
  1. Optional announcement strip
  2. Editorial header/hero
  3. Filter + catalog area
  4. Footer
- About page mirrors the same top system for consistency.
- Structure uses whitespace and dividers first; card shells only where truly needed.

## Hero Content Rules
- Hero should contain:
  - Brand identity (title and optional logo presentation)
  - One headline
  - One short subcopy
  - Optional fulfillment line
- Hero should not contain:
  - Multiple badge chips
  - Redundant identity elements
  - Dense control elements

## Curated Configurability (High-Impact Only)
- Keep configurable:
  - `logo`
  - `heroBrandDisplay`
  - `heroHeadline`
  - `heroSubcopy`
  - `pageWidth`
  - `productGridColumns`
  - `fontPreset`
  - `radiusScale`
  - `showPolicyStrip`
  - `showContentBlocks`
  - Color pairs: primary/on-primary, accent/on-accent, background, surface, text
- Fixed defaults (not user-configurable in UI):
  - `heroLayout = split`
  - `cardStyle = integrated`
  - `buttonStyle = rounded`
  - `spacingScale = comfortable`
  - Hero eyebrow and badges disabled by default

## Future Enhancements
- Add curated theme presets only after this baseline is stable.
- Introduce optional advanced controls in a separate “Advanced” section, not the main branding form.
- Add contrast guardrails and accessibility checks for all configurable color pairs.
