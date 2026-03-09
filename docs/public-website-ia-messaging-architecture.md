# Myrivo Public Website IA + Messaging Architecture

## Bead
- ID: `myrivo-48`
- Scope: define conversion-focused information architecture, messaging hierarchy, and CTA strategy for the Myrivo public site.

## 1) Business Objectives

### Primary business goals
1. Drive qualified signups for self-serve onboarding.
2. Convert high-intent prospects into demo/contact requests for advanced plans.
3. Reduce friction and uncertainty at pricing decision points.

### Conversion goals by intent
1. First-time evaluator: understand what Myrivo does in under 30 seconds.
2. Comparison shopper: quickly answer "why this over alternatives?"
3. Ready buyer: choose a plan and start account setup.

## 2) Audience Segments (ICP)

### ICP A: Maker-owned brand (primary)
- Profile: solo/family brand shipping handmade products.
- Pain: too many tools, fragile workflows, poor operational visibility.
- Outcome to sell: launch quickly and run reliably without becoming a systems integrator.

### ICP B: Growing small team
- Profile: 2-8 person team with fulfillment + support load.
- Pain: order/inventory/pickup coordination and role clarity.
- Outcome to sell: clear operational control center and accountable team workflows.

### ICP C: Platform operator / multi-store owner
- Profile: operator managing multiple stores with governance concerns.
- Pain: inconsistent controls, approvals/moderation overhead, reporting sprawl.
- Outcome to sell: centralized admin controls and predictable governance.

## 3) Messaging Hierarchy

### Core value proposition (site-wide)
"Myrivo helps commerce brands launch a branded storefront fast, run operations confidently, and scale with platform-grade control."

### Supporting pillars
1. Launch fast with branded storefront + content control.
2. Operate confidently with orders, inventory, pickup/shipping, notifications.
3. Scale safely with governance, moderation, role-based controls, and auditability.

### Message by journey stage
1. Awareness: simple, plain-language promise + visible proof.
2. Consideration: capabilities and workflow depth by persona.
3. Decision: transparent plan economics and clear next action.

## 4) Information Architecture (Page Map)

### Top-level navigation
1. Product
2. Features
3. Pricing
4. Customers
5. Resources
6. Sign in
7. Start free

### Public routes
1. `/` Home (conversion-first)
2. `/features` Capability overview with outcome-based sections
3. `/features/storefront` Branded storefront + content workspace
4. `/features/operations` Orders, inventory, shipping/pickup, notifications
5. `/features/platform` Admin, governance, moderation, approvals
6. `/pricing` Plan matrix and decision support
7. `/compare` Differentiation vs alternatives
8. `/customers` Case studies and example storefront outcomes
9. `/resources` Hub for docs, guides, launch checklists
10. `/contact-sales` Demo/consult flow for advanced prospects
11. `/security` Operational/security trust page

### Footer IA
1. Product links
2. Use cases
3. Resources/docs
4. Legal (Terms, Privacy)
5. Contact/support
6. Social/proof links

## 5) Conversion-Critical Content Blocks

### Home page block order
1. Hero: sharp promise + immediate CTA (`Start free`) + secondary CTA (`Book demo`).
2. Trust strip: social proof, usage signals, or merchant logos.
3. Outcome blocks by persona (maker, team, operator).
4. Product walkthrough (Storefront, Operations, Platform).
5. Why Myrivo vs alternatives.
6. Pricing teaser (with link to full matrix).
7. Objection-handling FAQ.
8. Final CTA band.

### Pricing page block order
1. Plan matrix (features + fees).
2. Who each plan is for.
3. Feature compare details.
4. Risk reducers (migration support, setup speed, support options).
5. Pricing FAQ (taxes, transaction fees, domains, etc.).
6. CTA row (`Start free`, `Contact sales`).

## 6) CTA Strategy

### Primary CTA
- Label: `Start free`
- Destination: `/signup?returnTo=/onboarding`
- Placement: nav, hero, mid-page, footer CTA band.

### Secondary CTA
- Label: `Book demo`
- Destination: `/contact-sales`
- Placement: hero, pricing, compare page, sticky nav on desktop.

### Tertiary CTA
- Label: `View docs`
- Destination: `/docs`
- Placement: resources sections and implementation-heavy pages.

### CTA rules
1. One dominant CTA per section.
2. Keep CTA labels action/outcome oriented.
3. Preserve consistent CTA destinations across pages.

## 7) Objection Handling Framework

### Key objections to address
1. "Will this break my existing workflow?"
2. "Can I trust this for fulfillment and payments?"
3. "Is this too expensive as I grow?"
4. "Will I lose control of my brand?"

### Response pattern
1. Claim (clear answer)
2. Proof (feature/process evidence)
3. Risk reducer (trial/demo/docs/support)

## 8) Measurement Plan

### Core funnel events
1. `marketing.page_view`
2. `marketing.cta_click` (with page + section + label)
3. `marketing.pricing_interaction`
4. `marketing.demo_request_submitted`
5. `marketing.signup_started`
6. `marketing.signup_completed`

### Primary KPIs
1. Visitor-to-signup-start rate
2. Signup-start-to-signup-complete rate
3. Pricing-page conversion rate
4. Demo request rate for enterprise-intent traffic

### Segment cuts
1. Channel/source/UTM
2. New vs returning
3. Device class
4. Landing page cohort

## 9) Implementation Sequencing

1. Finalize messaging and IA (this bead).
2. Home page conversion redesign (`myrivo-49`).
3. Pricing overhaul (`myrivo-51`).
4. Features + compare pages (`myrivo-50`).
5. SEO landing pages (`myrivo-52`).
6. CRO loop and experiments (`myrivo-53`).

## 10) Acceptance Checklist for myrivo-48

1. Page map for home/features/pricing/compare/customers/contact is defined.
2. Messaging matrix covers personas and common objections.
3. CTA hierarchy and destinations are explicitly specified.
4. Event-level conversion measurement plan is documented.

