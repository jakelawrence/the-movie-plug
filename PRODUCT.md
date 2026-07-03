# Product

## Register

product

## Users

Film lovers, roughly ages 20–50, with artsy yet refined taste. They are curious and engaged with cinema — not casual scrollers. They arrive with one job: **find a good movie to watch tonight, quickly and confidently, without feeling overwhelmed by choice.** Context is usually an evening decision — alone or with one other person — when the paralysis of too many options is the real enemy. They trust a knowledgeable recommendation more than an infinite grid.

## Product Purpose

You Should Watch helps people decide what to watch through several discovery paths rather than an endless catalog:

- **Find Similar** — recommendations seeded from one or more films they already love.
- **Date Night** — the compromise between two people's tastes.
- **Surprise Me** — curated picks spanning popularity tiers, from mainstream to hidden gems.
- **Mood Match** — filtering by tone, style, pace, intensity, and emotion.
- **Spin** — a random picker for when the user just wants the decision made for them.

It is backed by a Postgres (Neon) movie catalog with pgvector semantic similarity, mood metrics, and streaming-provider availability so picks can be filtered to what the user can actually watch. Success is a user landing on a single film they feel good about and pressing play — the fewer screens and the less second-guessing, the better.

## Brand Personality

Useful, inviting, and quietly confident. The experience should feel like a knowledgeable friend recommending a film — calm, considered, never pushy. Three words: **curious, calm, editorial**. The voice is plain and warm, not clever or salesy; it states a pick and trusts it rather than hyping it.

## Anti-references

- Neon, high-saturation "scenario colors," or pastel rainbow Tailwind card grids.
- Heavy black borders and brutalist/graphic UI chrome (the app's earlier phase — being moved away from deliberately).
- Anything that feels like a generic SaaS web app: hero-metric templates, identical icon-heading-text card grids, tracked-uppercase eyebrows on every section.
- Infinite-scroll catalog energy or choice-overload grids — the opposite of the product's reason to exist.
- Loud UI that competes with poster art for attention.

## Design Principles

1. **Earn every element.** If it doesn't add clarity or beauty, remove it. Whitespace is the design, not waste.
2. **Typography over decoration.** Hierarchy through scale and weight, not borders, backgrounds, or badges. The type system is the design system.
3. **Let posters speak.** Movie art is inherently rich and colorful; UI stays near-neutral so poster imagery is the focal point and carries the color.
4. **Refine, don't bold.** The direction is toward less — thinner borders, quieter colors, more air. When in doubt, reduce rather than add.
5. **Decide, don't display.** The product exists to end choice paralysis. Favor confident single recommendations and guided paths over catalogs and walls of options.
6. **Dual-mode ready.** Warm light (cream / near-black) and warm dark (charcoal / near-white, planned) should read as two expressions of one identity, not separate themes.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**.

- Body text ≥ 4.5:1 contrast; large/bold text ≥ 3:1. Watch muted secondary text on the cream background — the most likely failure given the warm-neutral palette.
- Visible keyboard focus on every interactive element (a `:focus-visible` outline is already established in `globals.css`).
- Honor `prefers-reduced-motion` for all animation (already wired globally); provide a crossfade or instant fallback for any new motion.
- Fully keyboard-navigable flows, including search autocomplete, modals, and the Spin picker.
- Don't rely on color alone to convey state (selection, mood metrics, provider availability) — pair with text, icon, or shape.
