# Acctual — Style Reference
> Architectural blueprint on white marble. Precision, clarity, and transparent flow of information.

**Theme:** light only (no dark mode).

The dashboard is a clean, sharp accounting-software interface defined by abundant whitespace, crisp typography, and an almost entirely achromatic palette punctuated by a single vibrant teal accent. It feels like an impeccably organized digital ledger — strict logical layout, high contrast, every piece of data immediately comprehensible. The signature element is Open Runde for headlines and body, with Caveat reserved for handwritten accents.

## 1. Color Tokens

| Name | Value | Token | Role |
|---|---|---|---|
| Canvas White | `#ffffff` | `--color-canvas-white` | Page + card backgrounds. Default surface. |
| Ink Black | `#000000` | `--color-ink-black` | Primary text, critical headings, brand emphasis. |
| Graphite | `#0f0f0f` | `--color-graphite` | Prominent headings and body text. |
| Deep Slate | `#1e1e1e` | `--color-deep-slate` | Secondary body text and descriptions. |
| Ash Gray | `#8d8d8d` | `--color-ash-gray` | Subtle text, metadata, disabled states. |
| Button Black | `#0d111b` | `--color-button-black` | Primary action button background. |
| Sky Teal | `#0098f2` | `--color-sky-teal` | THE accent — links, checkmarks, focus rings, positive deltas. |
| Hot Pink | `#f200ca` | `--color-hot-pink` | Decorative icon accent + destructive/down indicators. |
| Vivid Violet | `#6d56fc` | `--color-vivid-violet` | Decorative icon accent. |
| Subtle Cream | `#f7fafc` | `--color-subtle-cream` | Alternating section backgrounds, muted surfaces. |
| Hairline | `#ececec` | `--color-hairline` | Subtle borders, dividers. |

### Semantic mappings (existing utility classes keep working)
| Tailwind class | Resolves to |
|---|---|
| `bg-background`, `bg-card`, `bg-popover` | `#ffffff` |
| `text-foreground`, `text-card-foreground` | `#000000` |
| `text-muted-foreground` | `#8d8d8d` (ash-gray) |
| `bg-primary`, `bg-button-black` | `#0d111b` |
| `text-primary-foreground` | `#ffffff` |
| `bg-secondary`, `bg-muted`, `bg-subtle-cream` | `#f7fafc` |
| `text-accent`, `bg-accent`, `text-sky-teal` | `#0098f2` |
| `border-border`, `border-hairline` | `#ececec` |
| `text-up` (custom) | `#0098f2` (positive = teal) |
| `text-down` (custom) | `#f200ca` (negative = hot-pink) |

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

### Card
- `bg-canvas-white` on a `bg-canvas-white` page → distinguished by `shadow-subtle` OR a `bg-subtle-cream` alt section
- `radius-card` = 20px
- Padding: `p-6` (24px)
- No internal shadows beyond `shadow-subtle`

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
| `shadow-subtle` | Cards. `0 2.5px 2.5px 0 rgba(0,0,0,0.06)`. |
| `shadow-button` | Primary buttons. Per Acctual spec. |

No other shadows. For depth, prefer subtle background changes (`bg-subtle-cream`) or a `border-hairline` line.

## 6. Imagery & Icons

- **Icons:** line-based, monochrome Ink Black by default. Sky-teal fills for interactive checkmarks, hot-pink/violet for decorative brand accents.
- **Photography:** top-down product photography on white desk surfaces. Decorative atmosphere, not lifestyle.

## 7. Do's and Don'ts

### Do
- Canvas White (`#ffffff`) is the dominant background. Use Subtle Cream (`#f7fafc`) only for alternating sections.
- Open Runde for all main headings and body. Vary weight (400/500/600) by role.
- Sky Teal (`#0098f2`) **only** for interactive/positive elements — never decorative.
- 100px radius for all buttons and pill elements. 20px for cards.
- Generous padding (24px / 40px). Whitespace is the design.
- Caveat for testimonials and short impactful pull-quotes only.

### Don't
- Don't introduce new chromatic colors beyond Sky Teal, Hot Pink, Vivid Violet.
- Don't use box shadows for elevation beyond `shadow-subtle`. Prefer cream-bg alt sections.
- Don't use system sans-serif for headlines or body — only for tiny UI chrome.
- Don't deviate from the letter-spacing values for Open Runde.
- Don't pack content without whitespace — the design's strength is space.
- Don't mix multiple sizes/weights on a single line unless it's a defined component.

## 8. Migration notes (from previous Dark Bento)

- `font-mono` classes still resolve (aliased to Open Runde + tnum). Text remains visually fine; numbers stay aligned. New code should not use `font-mono` — use `tabular-nums` directly.
- `bg-card` no longer differs visually from `bg-background` (both `#ffffff`). Cards must use `shadow-subtle` or `bg-subtle-cream` for delineation. Audit `rounded-2xl bg-card` blocks.
- The old purple primary `#A855F7` is gone. Anything that read "primary action" → `bg-button-black`. Anything that meant "interactive accent" → `bg-sky-teal` / `text-sky-teal`.
- The `text-[10px] font-mono uppercase tracking-[1.2px]` page-header label pattern is dropped. Use `text-caption text-ash-gray`.
- Dark mode is removed. No `.dark` class, no toggle, no `next-themes`. The `prefers-color-scheme` is no longer respected — the app is light-only.
