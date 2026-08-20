# Acctual — Style Reference
> Architectural blueprint on white marble. Precision, clarity, and transparent flow of information.

**Theme:** light only (no dark mode).

The dashboard is a clean, sharp accounting-software interface defined by abundant whitespace, crisp typography, and an almost entirely achromatic palette punctuated by a single vibrant teal accent. It feels like an impeccably organized digital ledger — strict logical layout, high contrast, every piece of data immediately comprehensible. The signature element is Open Runde for headlines and body, with Caveat reserved for handwritten accents.

## 1. Color Tokens

| Name | Value | Token | Role |
|---|---|---|---|
| Canvas White | `#fffcf7` | `--color-canvas-white` | Paper sheets, sidebar. |
| Ink Black | `#1c1814` | `--color-ink-black` | Primary text, headings, brand emphasis. |
| Graphite | `#241f1a` | `--color-graphite` | Prominent body. |
| Deep Slate | `#4a433c` | `--color-deep-slate` | Secondary body. |
| Ash Gray | `#6f675f` | `--color-ash-gray` | Captions, metadata, disabled. |
| Button Black | `#1c1814` | `--color-button-black` | Primary action. |
| Sky Teal | `#0d6b7c` | `--color-sky-teal` | Links, checkmarks, handwritten coach notes, positive deltas. |
| Hot Pink | `#9c2f5a` | `--color-hot-pink` | Negative deltas, errors. |
| Vivid Violet | `#5a4a8a` | `--color-vivid-violet` | Rare decorative accent. |
| Subtle Cream | `#f4efe8` | `--color-subtle-cream` | Warm marble canvas, alt bands. |
| Hairline | `#e4d9ce` | `--color-hairline` | Borders, crop marks, dividers. |

### Semantic mappings (existing utility classes keep working)
| Tailwind class | Resolves to |
|---|---|
| `bg-background` | `#f4efe8` (warm marble) |
| `bg-popover` | `#fffcf7` |
| `bg-card` | `#fffcf7` — paper on marble |
| `text-foreground`, `text-card-foreground` | `#1c1814` |
| `text-muted-foreground` | `#6f675f` |
| `bg-primary`, `bg-button-black` | `#1c1814` |
| `text-primary-foreground` | `#fffcf7` |
| `bg-secondary`, `bg-muted`, `bg-subtle-cream` | `#f4efe8` |
| `text-accent`, `bg-accent`, `text-sky-teal` | `#0d6b7c` |
| `border-border`, `border-hairline` | `#e4d9ce` |
| `text-up` (custom) | `#0d6b7c` |
| `text-down` (custom) | `#9c2f5a` |

## 2. Typography

### Faces
- **Open Runde** (`--font-sans`, `font-display`, `font-heading`) — primary face. Self-hosted from `/public/fonts/open-runde/`. Weights 400, 500, 600, 700. Always with OpenType features `blwf cv03 cv04 cv09 cv11` enabled (set on `html`).
- **Caveat** (`--font-caveat`) — handwritten accent for testimonials, decorative pull-quotes. Weight 600. Loaded via `next/font/google`.
- **Inter** (`--font-inter`) — narrow role: specific body contexts where Open Runde is too decorative. Weight 500. Loaded via `next/font/google`.
- **System sans-serif** — UI labels and small functional text (12px). Reserved for utility chrome only, not body.

### Type scale (Tailwind utilities exposed via `@theme`)

| Role | Size | Line | Tracking | Class |
|---|---|---|---|---|
| caption | 12px | 1.20 | — | `text-caption` |
| body-sm | 14px | 1.43 | — | `text-body-sm` |
| body | 16px | 1.50 | — | `text-body` |
| subheading | 20px | 1.25 | -0.24px | `text-subheading` |
| heading | 32px | 1.21 | -0.64px | `text-heading` |
| heading-lg | 40px | 1.20 | -1.2px | `text-heading-lg` |
| display | 64px | 1.13 | -2.368px | `text-display` |

### Rules
- **No mono.** `tabular-nums` is achieved via Open Runde's `tnum cv03 cv04` features (auto-applied to `.font-mono`, `.tabular`, and `tabular-nums` utilities).
- **No lowercase mono labels.** The old "avg position" pattern is replaced by `text-caption text-ash-gray` Open Runde Regular.
- Headings use Open Runde Semibold (600). Body uses Regular (400) or Medium (500).
- **Don't deviate from the letter-spacing values** — they're calibrated.

## 3. Components

### Primary Action Button (`bg-button-black`)
- bg `#0d111b`, text `#ffffff`
- Open Runde Regular (400), 14-16px
- `radius-button` = 100px (full pill)
- Padding: `py-1.5 px-3.5` (6px / 14px)
- Shadow: `shadow-button` — `rgb(36,38,40) 0 0 0 1px, rgba(27,28,29,0.48) 0 1px 2px 0`

### Secondary / Header Text Button
- Text-only, no background, no border
- Open Runde Regular, color `text-ash-gray` default, `text-ink-black` on hover/active

### Card (`.sheet`)
- Paper `#fffcf7` floating on marble `#f4efe8`. Soft lift, 28px radius, hairline.
- Padding 24–32px. Big tabular number, caption label, pill controls.
- Data color lives in the chart: growth `#3dbe78`, effort `#5b87d6`, annotation violet. Chrome stays ink/cream.

### Badge / Pill
- `radius-badge` = 1250px (effectively full pill at any size)
- Background: `bg-subtle-cream` for neutral, `bg-sky-teal/10 text-sky-teal` for positive, `bg-hot-pink/10 text-hot-pink` for negative
- Open Runde Regular, 12px

### Input
- `bg-canvas-white`, `border border-hairline`, `radius-md` (12px)
- Focus: `ring-2 ring-sky-teal/40`

## 4. Spacing & Layout

- **Base unit:** 4px
- **Page max-width:** 1200px (centered, generous side margins)
- **Card padding:** 24px
- **Section gap:** 40-80px
- **Element gap:** 4-24px

## 5. Shadows

| Token | Use |
|---|---|
| `shadow-subtle` | Sheets. `0 1px 2px rgba(28,24,20,0.04), 0 12px 40px rgba(28,24,20,0.07)`. |
| `shadow-button` | Primary buttons. Per Acctual spec. |

## 6. Imagery & Icons

- **Icons:** line-based, monochrome Ink Black by default. Sky-teal fills for interactive checkmarks, hot-pink/violet for decorative brand accents.
- **Photography:** top-down product photography on white desk surfaces. Decorative atmosphere, not lifestyle.

## 7. Do's and Don'ts

### Do
- Subtle Cream (`#f4efe8`) is the warm canvas. Canvas White (`#fffcf7`) is paper sitting on it. Cards use paper + hairline + `shadow-subtle`.
- Open Runde for all main headings and body. Vary weight (400/500/600) by role.
- Sky Teal (`#0d6b7c`) for interactive/positive elements and Caveat coach notes. Never as a large fill.
- Growth green and effort blue are for charts only, not chrome.
- 100px radius for all buttons and pill elements. 28px for sheets.
- Generous padding (24px / 40px). Whitespace is the design.
- Caveat for testimonials and short impactful pull-quotes only. Never for UI chrome, nav, or KPIs.

### Don't
- Don't introduce new chromatic colors beyond Sky Teal, Hot Pink, Vivid Violet, and the two chart inks (growth / effort).
- Don't use box shadows beyond `shadow-subtle`. Sheets lift; marble stays flat.
- Don't use system sans-serif for headlines or body — only for tiny UI chrome.
- Don't deviate from the letter-spacing values for Open Runde.
- Don't pack content without whitespace — the design's strength is space.
- Don't mix multiple sizes/weights on a single line unless it's a defined component.

## 8. Migration notes (from previous Dark Bento)

- `font-mono` classes still resolve (aliased to Open Runde + tnum). Text remains visually fine; numbers stay aligned. New code should not use `font-mono` — use `tabular-nums` directly.
- `bg-card` resolves to `#f7fafc` (subtle-cream), so cards already differ from the `#ffffff` page as cream panels. Add `shadow-subtle` for extra crispness — the dashboard tiles use `bg-card rounded-2xl shadow-subtle`.
- The old purple primary `#A855F7` is gone. Anything that read "primary action" → `bg-button-black`. Anything that meant "interactive accent" → `bg-sky-teal` / `text-sky-teal`.
- The `text-[10px] font-mono uppercase tracking-[1.2px]` page-header label pattern is dropped. Use `text-caption text-ash-gray`.
- Dark mode is removed. No `.dark` class, no toggle, no `next-themes`. The `prefers-color-scheme` is no longer respected — the app is light-only.
