---
name: You Should Watch
description: Find a good film for tonight, quickly and confidently — an editorial movie-discovery tool.
colors:
  ink: "#1f1b17"
  paper: "#f6f1ea"
  paper-secondary: "#efe7dd"
  ink-secondary: "#5f574f"
  dusk-slate-blue: "#4f6f8a"
  dusk-slate-blue-light: "#6c879c"
  programme-gold: "#d7c7a3"
  pine-success: "#5b7c66"
  clay-danger: "#a04848"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, Times New Roman, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "Big Shoulders Display, Impact, Arial Narrow Bold, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.03em"
  title:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "DM Sans, Avenir Next, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "DM Sans, Avenir Next, sans-serif"
    fontSize: "0.5625rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.22em"
rounded:
  none: "0"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-primary-hover-action:
    backgroundColor: "{colors.dusk-slate-blue}"
    textColor: "{colors.paper}"
  button-disabled:
    backgroundColor: "{colors.paper-secondary}"
    textColor: "{colors.ink-secondary}"
  input-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "16px 24px"
  card-scenario:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "20px"
  card-scenario-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  chip-filter:
    backgroundColor: "{colors.paper-secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
---

# Design System: You Should Watch

## 1. Overview

**Creative North Star: "The Repertory Programme"**

This is the printed programme of a repertory cinema — the folded A24-zine handout you pick up in the lobby. Ink on warm paper. Big serif titles, hand-set micro-captions, generous margins, and not one decorative flourish that isn't carrying information. The interface behaves like an editor who already saw everything and is quietly pressing one film into your hands. It does not shout, does not merchandise, does not present a wall of choice. It presents *a* choice.

Density is low and deliberate. Whitespace is the primary structural material; type scale and weight carry the hierarchy, never borders or fills. Color lives almost entirely in the movie posters — the UI stays a near-neutral ink-and-cream so that poster art is the only thing on screen that's allowed to be loud. The single accent, a muted dusk blue, appears only on the things you can act on. The whole surface is flat at rest; depth is a response to interaction, not a default coat of shadow.

This system explicitly rejects the loud/graphic phase the product is migrating away from: heavy black decorative borders, brutalist chrome, full-saturation "scenario colors," pastel Tailwind rainbow card grids, and anything that reads as a generic SaaS web app. It also rejects infinite-scroll catalog energy — choice overload is the problem this product exists to solve, so the design must never reproduce it.

**Key Characteristics:**
- Ink-on-cream editorial palette; posters supply all the real color.
- Sharp, square corners as the rule; pills and avatars fully round as the one exception.
- Hairline, low-opacity borders (ink at 10–30%), never solid decorative strokes.
- Tiny uppercase tracked micro-labels (DM Sans, ~9px, 0.22em) as the signature caption voice.
- Flat by default; hover inverts ink/paper rather than lifting with shadow.
- One muted accent, reserved strictly for action and active state.

## 2. Colors

A warm, low-saturation ink-and-paper palette: near-black on cream, with a single muted blue accent and a small reserve of editorial support tones.

### Primary
- **Dusk Slate Blue** (#4f6f8a): The sole accent. Used only for things the user can act on or has selected — primary-action hover states, active nav, links, and selection indicators. Its restraint is the point; it should never appear as decoration.
- **Dusk Slate Blue Light** (#6c879c): Hover/pressed lift of the accent on small interactive controls (e.g. saved-film chips). Secondary to the base accent.

### Secondary
- **Programme Gold** (#d7c7a3): A warm paper-stock tint used sparingly as a low-opacity atmospheric wash (e.g. `bg-fadedGold/20` over hero imagery). Never as a solid fill or text color.

### Tertiary
- **Pine Success** (#5b7c66): Confirmation and success messaging only.
- **Clay Danger** (#a04848): Errors, destructive actions ("remove", "sign out"), and "no films match" states. Used as text or at low opacity (`/10`, `/30`), never as a loud fill.

### Neutral
- **Ink** (#1f1b17): The near-black workhorse. Body and heading text, hairline borders (always at reduced opacity), and the inverted fill of primary buttons and hovered cards.
- **Ink Secondary** (#5f574f): Muted secondary text. Use at full value for body-sized secondary copy; do not push critical text below it on the cream background.
- **Paper** (#f6f1ea): The body background. The cream "stock" everything is printed on.
- **Paper Secondary** (#efe7dd): A second surface tone for hovered list rows, filter chips, and inset panels — one quiet step off the page.

### Named Rules
**The One Voice Rule.** Dusk Slate Blue is the only accent and appears on ≤10% of any screen. If two things on a screen are blue, one of them is wrong.

**The Posters Are The Palette Rule.** Saturated color belongs to movie art, never to UI. If a UI element needs color to feel finished, it's over-designed — reduce it instead.

**The Ghost Border Rule.** Borders are ink at 10–30% opacity, hairline weight. A solid full-strength `#1f1b17` border (the legacy brutalist stroke) is forbidden on user-facing surfaces.

## 3. Typography

**Display Font:** DM Serif Display (with Georgia, Times New Roman fallback)
**Headline Font:** Big Shoulders Display (with Impact, Arial Narrow Bold fallback)
**Body / Label Font:** DM Sans (with Avenir Next, Helvetica Neue fallback)

**Character:** A high-contrast trio. DM Serif Display carries the editorial, literary voice — film titles and the wordmark. Big Shoulders Display is the condensed, uppercase "programme heading" voice for section and scenario labels. DM Sans handles everything functional: body, controls, and the tiny tracked captions. Contrast comes from family and case, not from piling weight onto body copy.

### Hierarchy
- **Display** (DM Serif Display, 400, 1.5–3rem, line-height 1.1): Film titles in detail/modal views and the "you should watch" wordmark. The literary anchor of a screen.
- **Page Title** (DM Serif Display, 400, ~2.25–3rem / `text-4xl`–`text-5xl`, line-height ≈0.95): The serif header that opens each page ("choose your scenario", "your services") and the serif heading of every empty/error state ("no matches", "the wheel is empty"). Always lowercase — see The Lowercase-Title Rule.
- **Headline** (Big Shoulders Display, 400, ~0.875rem, uppercase, 0.03em tracking): Scenario labels and section headers. Condensed and graphic; earns presence through case and width, not size.
- **Title** (DM Serif Display, 400, ~1.125rem): Smaller serif moments — the wordmark, list titles.
- **Body** (DM Sans, 400, 1rem, line-height 1.6): All prose and descriptions. Cap measure at 65–75ch. Bold (700/900) DM Sans carries data values (year, rating, runtime).
- **Label** (DM Sans, 400, ~0.5625rem / 9px, uppercase, 0.22em tracking, ink/70 — ≥4.5:1 on cream): The signature micro-caption — "About This Film", "Year", "Tone & Mood", "Available On". The connective tissue of the editorial voice.

### Named Rules
**The Micro-Caption Rule.** Field labels are tiny (≈9px), uppercase, widely tracked (0.18–0.25em), and set at ink/70 — the WCAG AA contrast floor on cream (≈4.5:1). They read as quiet through their small size and wide tracking, never by dropping below the contrast floor. The value they introduce still speaks louder, at full-strength ink.

**The No-Bold-Body Rule.** Never add weight to body copy for emphasis. Let the display serif and the condensed headline carry contrast. Weight on body text is reserved for discrete data values, not prose.

**The Lowercase-Title Rule.** Serif page and section titles are set entirely lowercase ("choose your scenario", not "Choose Your Scenario"). The quiet, unshouted casing is core to the editorial voice — the serif already carries the weight; capitals would make it declaim. This applies to every static serif header, including empty- and error-state headings. Two deliberate exceptions keep their natural casing: **film titles** (proper nouns — real names are never re-cased) and the **"you should watch" wordmark** (already lowercase by design). The condensed Big Shoulders "programme" labels remain uppercase — that opposing case is the intended contrast, not an inconsistency.

## 4. Elevation

This system is flat by default. Surfaces sit directly on the paper, separated by whitespace and hairline ink borders rather than shadow. Depth is reserved for two specific jobs: lifting transient overlays above the page, and signaling that something is interactive.

### Shadow Vocabulary
- **Overlay blur** (`backdrop-filter: blur` + `background: rgba(31,27,23, 0.5)`): The dimming scrim behind modals and the translucent sticky navbar (`paper/90` + `backdrop-blur-md`). The only routine use of blur — functional, never decorative.
- **Hover lift** (`box-shadow: 0 4px 6px rgba(0,0,0,0.10)` + `translateY(-2px)`): A subtle, optional response on hoverable cards. Most cards prefer the ink/paper color-invert instead.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If a card needs a shadow to look finished while sitting still, the layout — not the shadow — is the problem.

**The Invert-Don't-Lift Rule.** The primary hover affordance is a full ink↔paper color inversion (paper card → ink fill, ink text → paper text), not a drop shadow. This is the house feedback gesture.

## 5. Components

### Buttons
- **Shape:** Square. Sharp corners (radius 0) are the rule; never round a button.
- **Primary:** Ink fill (#1f1b17), paper text (#f6f1ea), 1px ink border. Label type — uppercase, ~10px, 0.12em tracking, black weight. Padding ~14px 24px.
- **Hover / Focus:** Inverts to paper fill + ink text (the house gesture). Action-forward buttons may instead hover to Dusk Slate Blue fill with paper text. Transition ~200ms on color.
- **Disabled:** Paper-secondary fill, ink-secondary text at reduced opacity, ink/15 border, `cursor: not-allowed`.
- **Tertiary / link:** Text with a hairline ink underline that shifts to Dusk Slate Blue on hover (e.g. "All scenarios →").

### Chips (filter / saved-film)
- **Style:** Paper-secondary background, ink text, hairline ink/20 border, square corners.
- **State:** Exclude/negative variant uses Clay Danger at low opacity (`bg-danger/10`, `border-danger/30`). Saved-film remove buttons use the Dusk Slate Blue → light hover.

### Cards / Containers
- **Corner Style:** Square (radius 0).
- **Background:** Paper; one quiet step to paper-secondary for hovered rows.
- **Border:** Hairline ink at 10% (`border-fadedBlack/10`). Never a solid full-strength stroke.
- **Shadow Strategy:** Flat at rest (see Elevation). Hover prefers full ink↔paper inversion over shadow.
- **Internal Padding:** ~20px (`p-5`); 24px on larger surfaces.

### Inputs / Fields
- **Style:** Paper background, 2px ink/30 border, square corners, bold DM Sans text, ink/65 placeholder (kept above the 4.5:1 floor).
- **Focus:** Border deepens to ink/60 (`focus:border-fadedBlack/60`); no glow. The autocomplete dropdown is a square paper panel with a hairless top border, ink/30 sides, rows divided by ink/10 hairlines, hovered rows tint to paper-secondary.
- **Placeholder contrast:** Keep placeholder legible — do not let it fall below the 4.5:1 body-contrast floor on cream.

### Navigation
- **Style:** Sticky top bar, translucent paper (`paper/90`) with `backdrop-blur-md`, hairline ink/10 bottom border. Wordmark in DM Serif Display.
- **Links:** DM Sans, normal weight, ~14px, tracked. Default ink; hover fades to ~40% opacity (no color change). Active state may carry Dusk Slate Blue.
- **Mobile:** Hamburger (three 1px ink rules) opens a right-side drawer over an ink/30 scrim; drawer links are uppercase, tracked DM Sans.

### Movie Detail Modal (signature component)
A square paper sheet over an ink/50 + blur scrim; slides up from the bottom on mobile, centers on desktop. Structured entirely with micro-captions: a tiny "About This Film" eyebrow, the title in DM Serif Display, then labeled data rows (Year / Runtime / Rating), a "Tone & Mood" section of thin horizontal meter bars (`h-[5px]`, ink/8 track, ink/40 fill), an "Available On" provider grid of square logo tiles, and a full-width primary action button at the foot. The clearest expression of the Repertory Programme voice.

## 6. Do's and Don'ts

### Do:
- **Do** keep the UI near-neutral ink-on-cream so poster art is the only loud color on screen ("Let posters speak").
- **Do** use square corners (radius 0) by default; reserve `rounded-full` for pills, avatars, and the carousel dots.
- **Do** draw borders as hairline ink at 10–30% opacity.
- **Do** use the tiny uppercase tracked micro-caption (≈9px, 0.22em, dimmed) for every field label.
- **Do** make hover a full ink↔paper inversion, not a drop shadow.
- **Do** restrict Dusk Slate Blue (#4f6f8a) to action and active state — ≤10% of any screen.
- **Do** verify body and placeholder text clears 4.5:1 against the #f6f1ea cream (WCAG 2.1 AA); watch ink-secondary copy especially.
- **Do** honor `prefers-reduced-motion` with a crossfade or instant fallback on every transition.

### Don't:
- **Don't** use heavy black decorative borders or brutalist chrome — the legacy `border-4 border-black` admin style is debt, not the system.
- **Don't** introduce neon, full-saturation "scenario colors," or pastel Tailwind rainbow card grids.
- **Don't** add `border-left`/`border-right` colored side-stripes, gradient text, or decorative glassmorphism.
- **Don't** add weight to body copy for emphasis; let the serif and condensed headline carry contrast.
- **Don't** reproduce infinite-scroll catalog or choice-overload grids — that's the exact problem this product solves.
- **Don't** let the UI compete with poster art; if an element needs color to feel finished, reduce it.
- **Don't** ship anything that reads as a generic SaaS web app: hero-metric templates, identical icon-heading-text card grids, or a tracked-uppercase eyebrow above every section.
