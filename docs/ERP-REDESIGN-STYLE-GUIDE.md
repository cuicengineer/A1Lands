# ERP Redesign Style Guide — Version 1.0

**Goal:** Modern enterprise platform (Linear, Stripe Dashboard, Ramp, Brex, Sequence.io). Data-first, low cognitive load, consistent, executive-friendly. No unnecessary visual complexity.

## Design principles

1. **Data first** — KPIs, charts, workflows over decoration.
2. **Reduce cognitive load** — No heavy gradients, multiple shadow levels, or large icon sets; use whitespace.
3. **Consistency** — Unified cards, modals, tables, forms, graphs.
4. **Enterprise ready** — Clean at thousands of records, large reports, multi-level approvals.

## Brand & semantic colors

| Role | Hex |
|------|-----|
| Primary (Deep Teal) | `#025B64` |
| Secondary / Success (Emerald) | `#00D47E` |
| Warning | `#F5A524` |
| Danger | `#F31260` |
| Info | `#3B82F6` |

## Light theme

| Token | Hex |
|-------|-----|
| Background | `#F6F8FA` |
| Card / Surface | `#FFFFFF` |
| Border | `#E7EAEE` |
| Primary text | `#111827` |
| Secondary text | `#6B7280` |
| Muted text | `#9CA3AF` |
| Table row hover | `#F8FAFC` |
| Nav active bg | `#E7F6F7` |

## Dark theme

| Token | Hex |
|-------|-----|
| Background | `#0F172A` |
| Card | `#111827` |
| Surface | `#1E293B` |
| Border | `#334155` |
| Primary text | `#F9FAFB` |
| Secondary text | `#CBD5E1` |
| Muted text | `#94A3B8` |
| Nav active bg | `rgba(2, 91, 100, 0.25)` |

## Typography

- **Font:** Inter, fallback Helvetica, Arial, sans-serif.
- **Scale:** Display 40/700, Page title 32/700, Section 24/600, Card 18/600, Body 14/400, Caption 12/400, Metric 32/700.

## Spacing (8px base)

Use only: **4, 8, 12, 16, 24, 32, 40, 48** — no arbitrary values.

## Border radius

| Size | px |
|------|-----|
| Small | 8 |
| Medium | 12 |
| Large | 16 |
| Modal | 20 (max) |

## Shadows (cards & modals only)

1. `0 1px 2px rgba(0,0,0,.04)`
2. `0 4px 12px rgba(0,0,0,.06)`
3. `0 12px 24px rgba(0,0,0,.08)`

## Layout

| Element | Spec |
|---------|------|
| Sidebar width | 280px (collapsed 72px) |
| App header | 64px sticky, surface + 1px border |
| Nav item | 44px height, 10px radius |
| KPI card | 140px height, 24px padding, 16px radius |
| Table row | 52px |
| Table header | 56px |
| Form input | 44px height, 10px radius |
| Modal | default 720px, max 1200px, 20px radius, 32px padding |
| Dashboard grid | 12 cols, 24px gap |
| Breakpoints | xs 0, sm 600, md 900, lg 1200, xl 1536 |

## Tables

Sticky headers, sort, filters, pagination, search. Primary ERP component.

## Charts

Executive-grade; max **5** series (prefer 2–3). Bar primary `#025B64`, secondary `#00D47E`. Line stroke 3px, smooth. Area fill ~10% opacity. Pie/donut max 6 segments (prefer 4), center metric required. Container: card surface, 24px padding, 16px radius, min-height 320px.

## Icons & motion

Material Icons **outlined** only. Duration **200ms**, easing **ease-in-out**. Hover/fade/collapse OK; no bounce/elastic/flash.

## Accessibility

Contrast ≥ 4.5:1, keyboard nav, screen reader labels, visible focus.

## Cursor / implementation rules

1. Keep all business logic and API contracts.
2. Do not change workflows.
3. UI/UX only; prefer MUI + Theme Provider.
4. Support light and dark mode.
5. Responsive MUI Grid; reusable dashboard widgets.
6. Consistent spacing; cards as primary containers.
7. Readability over visual effects.
8. CSS tokens: `enterprise-theme.css`, `saas-settings.css`, `--ent-*` / `--layer-*`.
