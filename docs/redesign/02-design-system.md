# 02 — Target Design System: "Desktop-class finance software, modern web finish"

## 1. Design principles

1. **Software, not a website.** There are no hero banners or marketing cards
   inside the app. Each screen is a work surface: toolbar, data and detail.
2. **Density with calm.** Finance users scan many rows. Use compact rows,
   tabular numbers and quiet chrome, and keep colour for meaning.
3. **Keyboard first, mouse friendly.** Every primary action has a shortcut,
   and every list can be navigated with the arrow keys.
4. **One pattern per job.** Registers, record editors, processes, reports and
   settings each have one template. Users learn it once.
5. **Subtle web touch.** Command palette, smooth 120–160ms transitions, soft
   shadows on floating layers only, skeleton loading, toasts, and a layout
   that still works on tablet and phone.
6. **Accessible by default.** WCAG 2.1 AA contrast, visible focus, ARIA roles
   on grids, menus and dialogs, and no colour-only status.

## 2. Application frame

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▣ AakashHRMS │ Go  Actions  Help │   🔍 Search or run command…  Ctrl K │ BS|AD  Ashwin 2082 ▾  FY 2082/83  🔔3  CT ▾ │  ← Title bar 42px (light, green→red brand strip)
├──┬───────────────┬─────────────────────────────────────────────────────────┤
│🏠│ PAYROLL       │ Payroll › Generate                                       │  ← Page bar 44px: breadcrumb + title
│⚙ │  Generate run │ [+ New run] [▶ Calculate] [✓ Approve] │ [⎙ Print] [⇩ Export] [⟳] │  ← Command toolbar 40px
│👥│  Review       ├─────────────────────────────────────────────────────────┤
│⏱ │  Leave salary │  Filter strip: Period ▾  Branch ▾  Dept ▾  Status ▾  🔍  │
│₨ │  Loans        ├──────────────────────────────────┬──────────────────────┤
│📊│               │  DataGrid (sticky header, 32px    │  Detail pane         │
│🛡│  ─ Recent ─   │  rows, tabular nums, selection)   │  (split view,        │
│  │  Run 2082-06  │                                    │  resizable)          │
│  │               ├──────────────────────────────────┴──────────────────────┤
│  │               │  Totals footer: Gross ₨ 4,52,300 · Deductions … · Net …  │
├──┴───────────────┴─────────────────────────────────────────────────────────┤
│ ● Connected  │ Aakash Pvt Ltd (AAK01) · Head Office │ FY 2082/83 │ 2082-06-16 BS · 2 Oct 2026 │ Admin │ v1.0 │  ← Status bar 26px
└────────────────────────────────────────────────────────────────────────────┘
  ↑ Module rail 56px (pale green-grey)   ↑ Section navigator 224px (light, Ctrl+B to collapse)
```

| Region | Size | Content |
|---|---|---|
| Title bar | 42px, white (light chrome) with a **2px brand strip** at the top: the logo's green→red underline (68% / 32%) | Logo mark + "Aakash**HRMS**" wordmark in logo green/red, app menus (Go / Actions / Help), command palette trigger, BS/AD switch, **working period selector** (e.g. *Ashwin 2082*; the default period for payroll, attendance and reports, as in Tally), FY selector, notifications, user menu |
| Module rail | 56px, `--rail-bg` (pale green-grey) | One icon per module, with tooltip + `Alt+1…7` shortcuts. The active module is a white raised tile with a 3px forest-green bar on the left. |
| Section navigator | 224px, `--nav-bg`, collapsible | Pages of the active module with counts (for example "Approvals 3"), plus a "Recent" list of records |
| Page bar | 44px | Breadcrumb and page title. Right side: page-level status chips (for example "Run: DRAFT") |
| Command toolbar | 40px | Grouped icon+label buttons, separators, overflow menu. The order is always: *Create · Act on selection · Output (Print/Export) · Refresh* |
| Workspace | flex | One of the 6 templates (§5) |
| Status bar | 26px | Connection/save state, tenant + branch, FY, today in BS and AD, role, version, last sync |

**Responsive:** at ≥1280px the full frame shows. Between 1024 and 1279px the
navigator auto-collapses. Below 1024px the rail becomes a top hamburger
drawer and split views stack. Below 640px (self-service and phone) a bottom
tab bar is used.

## 3. Tokens

All colours are CSS variables on `:root`, exposed to Tailwind through
`@theme`. **The `zinc` and `emerald` scales are remapped** onto these
neutrals and the brand ramp, so legacy classes pick up the new look without
any component rewrite.

### Colour (from the logo)

The logo uses a vivid **forest/leaf green** (sampled ≈ `#1A850C`) and a
**red** (≈ `#D3070B`) on white. This replaces the earlier teal-emerald
`#1B6B54`. The UI uses **light chrome**: green is the action and identity
colour, and red is a brand accent kept apart from error states.

**Forest green ramp** (contrast on white measured):

| Step | Hex | Contrast | Use |
|---|---|---|---|
| 50 | `#F1F8EF` | — | Brand-tinted backgrounds |
| 100 | `#E0F0DB` | — | Selection, active nav |
| 200 | `#C2E2B8` | — | Subtle borders on brand chips |
| 300 | `#96CD86` | 1.9 | Charts, decorative |
| 400 | `#5FB04B` | 2.7 | Charts, focus glow |
| 500 | `#2E9420` | 3.9 | Large text / icons only |
| **600** | **`#1E7F12`** | **5.1 (AA)** | **Primary: buttons, links, active states** (≈ logo green) |
| 700 | `#186A0F` | 6.8 | Hover / pressed |
| 800 | `#15540F` | 9.1 | Text on green tint |
| 900 | `#12440E` | 11.3 | Headings on tint |
| 950 | `#0A2707` | 16.1 | — |

Tailwind's `emerald-*` (and `green-*`) scales are remapped to this ramp, so
the ~1,000 existing `emerald-NNN` usages follow the logo colour.

| Token | Value | Use |
|---|---|---|
| `--brand` / `--brand-hover` / `--brand-strong` | `#1E7F12` / `#186A0F` / `#15540F` | Primary actions, active states, text on tint |
| `--brand-subtle` | `#EEF7EB` | Brand-tinted chips and backgrounds |
| `--brand-red` | `#D3070B` | **Brand moments only**: title-bar strip, "HRMS" wordmark, notification count. Never used for buttons. |
| `--chrome-bg` | `#FFFFFF` | Title bar |
| `--rail-bg` | `#F4F7F3` | Module rail, status bar |
| `--canvas` | `#F1F4F0` | Workspace background behind panels |
| `--nav-bg` | `#FAFBF9` | Section navigator, filter strips |
| `--surface` / `--surface-sunken` | `#FFFFFF` / `#F7F9F6` | Panels, grids / grid header, read-only fields, footers |
| `--border` / `--border-strong` | `#DDE4DA` / `#C6D0C2` | Panel and field borders (green-tinted greys) |
| `--text` / `--text-muted` / `--text-faint` | `#1A2118` (15:1) / `#56604F` (6.6:1) / `#6F7A69` (≥4.5:1) | Neutrals carry a slight green cast to sit with the brand |
| `--selection` | `#E0F0DB` | Selected grid rows, active navigator item |
| `--focus` | `#1E7F12` | 2px focus ring, offset 1px |
| `--success` / `--warning` / `--danger` / `--info` | `#1E7A4C` / `#A86300` / `#B91C1C` / `#1F5FA8` | Each with a `-subtle` background. Success is teal-leaning so it doesn't merge with the brand green. Danger is a deeper crimson than the brand red, always with an icon or label. |
| `--amount-negative` | `#B91C1C` | Negative money values |

Tailwind's `zinc-*` neutrals are remapped to these green-tinted greys.

### Implemented token map (Phase 1)

All of this lives in `app/globals.css`. It has three layers:

1. **Ramps** on `:root`: `--forest-50…950`, `--neutral-50…950` and `--crimson-50…950` (danger).
2. **Semantic variables** (`--brand`, `--surface`, `--text`, …) that point at the ramps.
3. **Tailwind remaps** in `@theme inline`:
   - `zinc`, `gray`, `slate`, `neutral` and `stone` → `--neutral-*`
   - `emerald` and `green` → `--forest-*`
   - `rose` and `red` → `--crimson-*`, so every error uses one crimson that stays distinct from the logo red
   - the old `payroll-*` colours → semantic variables

| Use in new code | Utility | Variable |
|---|---|---|
| Primary action, links | `bg-brand`, `text-brand`, `hover:bg-brand-hover`, `bg-brand-subtle`, `bg-brand-50…950` | `--brand*`, `--forest-*` |
| Logo red (wordmark/strip only) | `text-brand-red`, `bg-brand-red` | `--brand-red` |
| Backgrounds | `bg-canvas` (workspace), `bg-surface` (panels), `bg-surface-sunken` (headers, read-only), `bg-chrome`, `bg-rail`, `bg-nav` | |
| Borders | `border-line`, `border-line-strong` | `--border`, `--border-strong` |
| Text | `text-ink`, `text-ink-muted`, `text-ink-faint` | `--text*` |
| Selection / focus | `bg-selection`, `ring-focus` | |
| Status | `text-success`, `bg-success-subtle` (same for `warning`, `danger`, `info`), `text-amount-negative` | |
| Charts | `bg-chart-primary`, `-primary-soft`, `-estimated`, `-info`, `-warning`, `-danger` (legends). Recharts reads the hex mirror in `lib/constants/colors.ts` (`CHART_COLORS`, `CHART_THEME`, `CHART_TOOLTIP_STYLE`, `CHART_AXIS_TICK`). | `--chart-*` |

Radius is tightened globally: `rounded-md` is now 4px (controls),
`rounded-lg` 6px (panels), `rounded-xl` 8px (windows) and `rounded-2xl` 10px.
Shadows are near-flat up to `shadow-sm`. `shadow-md` and above are soft,
green-black, and meant for floating layers.

A dark theme (`[data-theme="dark"]`) is a stretch goal (Phase 9). The tokens
are designed so it only needs new values.

### Typography

- **UI font: Inter**, self-hosted through `next/font` (no Google CSS `@import`).
  Use `font-feature-settings: "tnum", "cv11"` so numbers line up.
- **Figures and codes:** Inter with tabular figures and a slashed zero.
  - The legacy `font-mono` class (551 uses, often on amounts and dates) is remapped to this.
  - **True monospace (JetBrains Mono)** is `font-code`. Use it only where character alignment matters (PAN or bank-account entry), and in `<code>`, `<kbd>` and `<pre>`.
  - Never use it for amounts.
- Scale (px): **11** caption/labels · **12** secondary/grid meta · **13** body
  and grid cells (base) · **14** emphasis/section titles · **16** page
  title · **20** dashboard figures.
  - Utilities: `text-2xs` (11), `text-xs` (12), `text-sm` (**13**, reduced from Tailwind's 14), `text-base` (16).
  - `text-3xs` (10) is only for count badges and micro-chips.
  - Phase 1 replaced 1,072 arbitrary `text-[Npx]` sizes, and a test now blocks new ones.
- Tabular numerals apply to tables, inputs, selects, `<time>` and `<output>`,
  plus the `tabular` / `tabular-nums` utilities. They are **not** global,
  because Inter's `tnum` also widens hyphens and slashes in running text.
- Amounts: right-aligned, tabular numbers, Nepali grouping (`4,52,300.00`),
  `₨` prefix only in headers and totals.

### Spacing, radius, elevation, motion

- 4px grid. Control heights: **28** (compact), **32** (default), **36**
  (prominent). Grid rows are 32px, or 28 in compact mode.
- Radius: 4px on controls, 6px on panels, 8px on floating windows. Avoid
  pill shapes except status chips.
- Elevation: flat panels with 1px borders. Shadows are reserved for floating
  layers (menus, popovers, dialogs, toasts).
- Motion: 120ms for hover/press, 160ms for panels/dialogs, using `ease-out-quint`.
  Remove the decorative aura/beam/glow loops from the app (the marketing
  homepage may keep them). Honour `prefers-reduced-motion`.

## 4. Component kit (`components/ui` v2)

| Component | Replaces | Key behaviour |
|---|---|---|
| `AppFrame`, `TitleBar`, `ModuleRail`, `SectionNav`, `StatusBar` | `dashboard-shell`, `sidebar`, `top-header` | Config-driven from `lib/constants/navigation.ts`, permission-filtered |
| `PageBar` + `CommandToolbar` | `page-header`, ad-hoc header rows | Declarative `actions[]` with icon, label, shortcut, `requires` (permission), `disabled` reason tooltip |
| `CommandPalette` (Ctrl K) | dead search box | Navigate to any page, search employees, run actions, toggle BS/AD |
| `DataGrid` | 46 hand-written tables, `table-shell`, `table-pagination` | Sticky header, sortable, resizable/hideable columns (persisted per user in `localStorage`), row selection, arrow-key navigation, Enter to open, footer totals, empty/loading/error states, `role="grid"` |
| `FilterStrip` | `filter-bar`, `*-filters.tsx` | Inline dropdown filters, search, saved views, applied-chip row |
| `SplitView` | `side-panel`, `drawer-shell` for detail views | Resizable master/detail, collapses to a drawer on small screens |
| `Window` (dialog) | `dialog`, 10 custom `fixed inset-0` modals | Title bar, Esc to close, focus trap, sticky footer, sizes sm/md/lg/xl/full |
| `PropertyForm` / `FieldRow` / `FieldGroup` | per-modal form markup | Label-left two-column layout ≥768px, inline validation, required marker, help text, read-only variant |
| `Tabs` (vertical and horizontal) | `tabs` | Keyboard roving focus |
| `StatusChip` | `badge` | Fixed vocabulary: Draft · Pending · Approved · Locked · Rejected · Active · Inactive |
| `Amount`, `DateCell` (BS/AD aware) | `npr-text`, `BSDateDisplay` | Uniform money and date rendering |
| `EmptyState`, `Skeleton`, `ErrorBanner`, `Toast` | existing | Restyled |
| `Confirm` | per-module `confirm-delete-dialog` (×4) | One generic confirm with a typed-confirmation option for destructive acts |

## 5. Screen templates

| Template | Used by | Layout |
|---|---|---|
| **A. Register** | Employees, Departments, Designations, Branches, Holidays, Pay heads, Tax slabs, Leave types/rules, OT rules, Loans, Users, Roles, Audit log, Leave applications/approvals, Attendance | Toolbar → FilterStrip → DataGrid (+ optional SplitView detail) → totals/pagination footer |
| **B. Record editor** | Employee create/edit, Company setup, Salary mapping, Role matrix | Window or full page. Vertical section tabs on the left, PropertyForm on the right, sticky Save/Cancel footer, dirty-state guard |
| **C. Process** | Payroll run, Leave salary run, Attendance lock, Fiscal-year close, Onboarding | Step rail (Setup → Pre-flight → Calculate → Review → Approve → Lock) with a blocking-issue panel and an audit trail |
| **D. Report viewer** | All `/reports/*`, payslips | Parameters panel on the left, paged document preview on the right, toolbar with Print / PDF / Excel / CSV |
| **E. Settings** | System control, Payroll rules, Fiscal year, Tax rates, Company profile | Category list on the left, form on the right, change summary before save |
| **F. Home / Work queue** | `/dashboard` | Tiles of *actionable* queues (pending approvals, payroll status, compliance deadlines, attendance exceptions), plus compact charts. No hero banner. |

## 5b. Design enhancements (beyond the base frame)

These came out of the reference research (`05-functional-research.md`).
Each one is scheduled in the roadmap.

| # | Enhancement | Why | Phase |
|---|---|---|---|
| E1 | **Working period selector** in the title bar (BS month + year), shared by payroll, attendance and reports, persisted per user | Tally-style "current period" removes re-picking the month on every screen | 2 |
| E2 | **FactBox pane** (Business Central): a right-hand context panel on registers and cards (e.g. YTD gross/TDS/SSF, leave balance, loans, pending changes) | Answers the next question without navigating | 3 |
| E3 | **Worklist template** (SAP Fiori) for approvals and payroll exceptions: one item at a time, `A`/`R` to approve/reject, `J`/`K` to move | Faster than modal-per-row approval | 3 |
| E4 | **Problems panel**: an IDE-style docked list of blocking issues in the payroll wizard, with click-to-jump | Pre-flight and variance issues become actionable | 4.8 |
| E5 | **Density toggle** (Comfortable 32px / Compact 28px rows) in the user menu | Finance users with big tables want compact; occasional users want comfortable | 3 |
| E6 | **Alt+G alias** for the command palette, plus `F`-key hints in tooltips | Familiar to Tally users in Nepal | 2 |
| E7 | **Lakh number grouping** (`4,52,300.00`) and **BS-first dates** everywhere, with AD in a tooltip | Local expectation | 1 / 3 |
| E8 | **Bilingual UI strings for payslips and self-service** (English / नेपाली), with Noto Sans Devanagari as the fallback font | Competitors offer Nepali payslips | 5 |
| E9 | **Status-edge rows**: a 3px coloured left edge on grid rows with exceptions (warning/danger), alongside the status chip | Scannable without relying on colour alone | 3 |
| E10 | **Print-perfect report preview** with page thumbnails and A4 portrait/landscape toggle | Reports are printed and signed in Nepal offices | 4.11 |
| E11 | **Skeleton loading that matches the template layout** (grid rows, form rows) | Feels instant, no layout jump | 3 |
| E12 | Optional **dark theme** using the same token names | Late-evening payroll work | 9 |

### Implemented frame (Phase 2)

The frame code lives in `components/frame/` (`AppFrame`, `TitleBar`, `ModuleRail`, `SectionNav`, `StatusBar`, `CommandPalette`, `ShortcutHelp`, `PageBar`, `CommandToolbar`). The navigation model is `lib/frame/navigation.ts`, and shortcuts are in `lib/frame/shortcuts.ts`. Sizes as built:

| Region | Size |
|---|---|
| Title bar | 2px brand strip + 44px |
| Rail | 56px |
| Navigator | 224px |
| Status bar | 26px |

Pages render inside a white workspace with 24px padding (16px below 1024px). The working-period selector (E1) arrives with its first consumer in 4.8.

## 6. Keyboard map (initial)

| Keys | Action |
|---|---|
| `Ctrl K` / `Alt G` | Command palette ("Go To") |
| `Alt 1…7` | Switch module |
| `Ctrl B` | Toggle section navigator |
| `Ctrl Shift L` | Lock the session (implemented in Phase 2) |
| `Ctrl N` | New record (current register) |
| `Enter` / `F2` | Open / edit selected row |
| `Del` | Delete selected (with confirm) |
| `Ctrl S` | Save form |
| `Esc` | Close window / clear selection |
| `Ctrl P` | Print current report |
| `Ctrl Shift E` | Export |
| `/` | Focus grid search |
| `?` | Shortcut help overlay |

## 7. Rules for contributors

- Never hard-code hex colours or `zinc-NNN` in **new** code. Use the semantic
  tokens (`bg-surface`, `text-ink-muted`, `border-line`, `bg-brand`…). See the
  token map in §3. Preview everything at `/dev/kit`, the development-only
  gallery.
- No arbitrary font sizes. Use the type scale.
- New lists must use `DataGrid`, new dialogs `Window`, new forms
  `PropertyForm`.
- Every toolbar action declares its permission. Hidden is preferred to
  disabled when the user can never perform it.
