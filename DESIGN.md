# Design System — Dark Bento

## 1. Visual Theme

Dark-first dashboard inspired by fintech apps. Depth through subtle tile contrast, not shadows. Zero shadows. Purple accent for primary actions, teal for positive/success, red for negative/error.

## 2. Color Tokens

### Dark Mode (default)
| Token | Value | Use |
|-------|-------|-----|
| background | `#0A0A0A` | Page ground |
| card | `#1A1A1A` | Tiles, cards, inputs |
| card-hover | `#222222` | Hover state for cards |
| border | `#2A2A2A` | Dividers, table rows, card borders |
| foreground | `#FFFFFF` | Primary text |
| muted-foreground | `#71717A` | Labels, secondary text |
| fg2 | `#A1A1AA` | Tertiary text, descriptions |
| primary | `#A855F7` | Purple accent — CTAs, active states, charts |
| up / teal | `#34D399` | Positive change, success |
| down / red | `#F87171` | Negative change, error |
| destructive | `#F87171` | Same as down |

### Light Mode (preserved for future toggle)
| Token | Value |
|-------|-------|
| background | `#FFFFFF` |
| card | `#FFFFFF` |
| secondary | `#F4F4F4` |
| border | `#C9C9CD` |
| foreground | `#191C1F` |
| muted-foreground | `#505A63` |
| primary | `#191C1F` |
| up | `#00A87E` |
| down | `#E23B4A` |

## 3. Typography

### Font Families
- **Sans**: Geist — all UI text, headings, body
- **Mono**: Geist Mono — data labels, numbers, KPIs, table headers, status text

### Hierarchy
| Role | Font | Size | Weight | Notes |
|------|------|------|--------|-------|
| Page title | Geist | 36-40px | 600 | h1 on each page |
| Section title | Geist | 20px | 600 | "Search Console", "Highest ROI" |
| Card label | Geist Mono | 10-11px | 400 | Lowercase. "avg position", "keywords" |
| Table header | Geist Mono | 9px | 400 | Lowercase. "keyword", "pos", "7d" |
| Body | Geist | 13-14px | 400 | Standard reading |
| Data value | Geist Mono | 28px | 600 | KPI numbers |
| Hero value | Geist Mono | 64px | 600 | Main stat on overview |
| Button | Geist | 12px | 500 | All buttons |

### Rules
- Labels are **lowercase** (not uppercase). "avg position" not "AVG POSITION"
- Numbers always `font-mono tabular-nums`
- Page header labels (above h1): `text-[10px] font-semibold uppercase tracking-[1.2px]` — the only exception to lowercase rule

## 4. Components

### Buttons
- **Primary**: `bg-primary` (#A855F7), white text, pill (rounded-full), px-4.5 py-2.5
- **Outline**: transparent, `border-[1.5px] border-border`, text-foreground, pill
- **Ghost**: transparent, hover `bg-secondary/50`
- All sizes use pill shape (rounded-full / 9999px)

### Cards / Tiles
- Background: `bg-card` (#1A1A1A)
- Radius: `rounded-2xl` (16px)
- Padding: p-5 to p-7 depending on size
- No shadows, no elevation
- Border only when needed: `border border-border`

### Tables
- Wrapper: `bg-card rounded-2xl overflow-hidden`
- Headers: `font-mono text-[9px] text-muted-foreground font-normal` — NO uppercase, NO bold
- Rows: `border-b border-border last:border-0 hover:bg-secondary/50`
- Data: `text-xs` for text, `font-mono text-xs tabular-nums` for numbers

### Badges / Pills
- Pattern: `font-mono text-[10px] px-2.5 py-1 rounded-full bg-[color]/15 text-[color]`
- Success: var(--up) #34D399
- Error: var(--down) #F87171
- Running: foreground/10
- Warning: yellow-500

### Inputs
- Background: `bg-background` (#0A0A0A)
- Border: `border border-border` (#2A2A2A)
- Radius: `rounded-xl`
- Focus: `ring-2 ring-primary/50`

## 5. Layout

### Sidebar
- Mini mode: 64px, icon-only, rounded-xl icon buttons (40x40)
- Expanded mode: 220px, icons + labels (13px), toggle button
- Logo: purple square (rounded-[10px]) with white "S" bold
- Bottom: avatar circle, sign-out (expanded only)

### Top Bar
- Sticky, backdrop-blur, right-aligned
- Contains: ActiveJobsIndicator, UsageMeter, CreditsDisplay
- Height: auto, py-3 px-6

### Content Area
- Padding: py-7 px-9
- Max-width: 1400px on wide screens
- Bento grid: flex rows with gap-3

### Bento Grid (Overview)
- Row 1: Hero KPI (flex-1, h-200) + Mini KPI Stack (w-280, 3 cards stacked)
- Row 2: Chart (flex-1, h-280) + Gap Zone (w-400, h-280)
- Row 3: AI Brief (flex-1, h-180, white bg inverted) + Distribution (w-300, h-180)

## 6. Spacing
- Base: 4px
- Scale: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48
- Bento gap: 12px (gap-3)
- Card padding: 20-28px
- Page padding: 28px top, 36px sides

## 7. Do's and Don'ts

### Do
- Use Geist Mono for all data, labels, numbers
- Use lowercase labels (not UPPERCASE) on cards and tiles
- Use purple (#A855F7) for primary actions only
- Use bg-card for all tile backgrounds
- Use rounded-2xl (16px) for all cards
- Use pill shape for all buttons

### Don't
- Don't use shadows
- Don't use uppercase on card labels (only on page header labels above h1)
- Don't use bg-secondary when bg-card is more appropriate
- Don't mix Inter/Space Grotesk — Geist only
- Don't use border-foreground on outline buttons (use border-border)
