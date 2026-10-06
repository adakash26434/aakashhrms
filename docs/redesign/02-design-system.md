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

### Implemented kit (Phase 3)

`components/kit/`:

| Component | Use for |
|---|---|
| `DataGrid` | Every register. Give it an `id` (prefs are remembered per grid), `columns` with `type` (`text`/`amount`/`number`/`date`/`code`/`status`), `value` for sort, total, copy and export, and `sticky` for pinned leading columns. Optional: `rowTone` (E9), `exportModule` (audited CSV), `selectable`, `onOpen`, `activeRowId`. |
| `FilterStrip` | Search + filters + applied chips + saved views above a grid |
| `SplitView` | Register + detail pane (detail = `FactBox` / record summary) |
| `Window` + `WindowButton` + `WindowCancel` | Every dialog; pass `dirty` on edit forms. The footer Cancel is `WindowCancel` (it asks "Discard changes?" like Esc and ×; a plain `WindowButton onClick={onClose}` would skip that). A window closes itself after a successful save. |
| `Confirm` | Every confirmation; `requireText` for destructive or irreversible actions |
| `PropertyForm` / `FieldGroup` / `FieldRow` / `inputClass` | Every form |
| `Tabs` | Horizontal (pages) or vertical (record editor sections) |
| `StatusChip`, `Amount`, `DateCell` | Statuses, money and dates, everywhere. For a date inside text (titles, messages) use `useDateText()` so it follows the BS/AD switch; formal documents use `bothCalendars()` ("Bhadra 31, 2083 (2026-09-16)") |
| `FactBox`, `Worklist` | Context panels (E2); approval queues (E3) |
| `GridSkeleton`, `FormSkeleton`, `EmptyState`, `ErrorState` | Loading, empty and error states |
| `EditGrid` (4.4) | Spreadsheet-style bulk entry: many rows × many amount columns edited in place with Excel keys, paste from Excel, fill down and undo. Not for registers (use `DataGrid`). See "Implemented salary structure". |

The pure logic lives in `lib/kit/`: `grid.ts`, `amount.ts`, `status.ts`, `focus.ts`, `density.ts`, `popup.ts` and `edit-grid.ts`. Exports use `lib/export/csv.ts` and `authorizeExportAction`.

## 5. Screen templates

| Template | Used by | Layout |
|---|---|---|
| **A. Register** | Employees, Departments, Designations, Branches, Holidays, Pay heads, Tax slabs, Leave types/rules, OT rules, Loans, Users, Roles, Audit log, Leave applications/approvals, Attendance | Toolbar → FilterStrip → DataGrid (+ optional SplitView detail) → totals/pagination footer |
| **B. Record editor** | Employee create/edit, Company setup, Salary structure (Revise window), Role matrix | Window (short records) or full page (long records): section index on the left, one scrolling PropertyForm with Enter-to-next, sticky Save/Cancel footer, dirty-state guard. See "Implemented employees". |
| **C. Process** | Payroll run, Leave salary run, Attendance lock, Fiscal-year close, Onboarding | Step rail (Setup → Pre-flight → Calculate → Review → Approve → Lock) with a blocking-issue panel and an audit trail |
| **D. Report viewer** | All `/reports/*`, payslips | Parameters panel on the left, paged document preview on the right, toolbar with Print / PDF / Excel / CSV |
| **E. Settings** | System control, Payroll rules, Fiscal year, Tax rates, Company profile | Category list on the left, form on the right, change summary before save |
| **F. Dashboard** | `/dashboard` | Analytics dashboard: period/branch filters, KPI cards with change and sparkline, payroll cost and attendance charts, then compact action cards (pay run, deadlines, approvals, records to fix). No hero banner. The only screen that is a dashboard; see “Implemented dashboard”. |

### Implemented dashboard (Phase 4.1, template F — revised)

`/dashboard` is the one screen designed as an **analytics dashboard**; every
other module (registers, editors, processes, reports) keeps the desktop-app
templates A–E. Research behind it: Zoho Payroll (pay runs, to-do, statutory
summary, payroll cost summary with period filter), Keka and Rippling (cost by
department, variance), Dribbble/Behance payroll dashboards (KPI cards, monthly
trend, department breakdown), and dashboard practice (5–7 KPIs with change and
sparkline, insight within ~10 seconds, thresholds, role-based views).

| Row | Content | Rules |
|---|---|---|
| Page bar | Title, greeting, BS date, "Updated hh:mm", scope badge; Run payroll · Add employee · Refresh | Actions hidden without permission |
| Pay run banner | Current month, fiscal-year month (Shrawan = 1), progress rail across branch runs, net payable, employees, the one next action | First thing on the page, as in Zoho / Gusto; replaces the old pay run card |
| Filters | Period (latest month · fiscal year to date · last 12 months) and branch (company-wide users) | In the URL (`?period=&branch=`), validated on the server |
| KPI cards | Payroll cost (gross + employer PF), net pay, statutory (TDS + SSF 31% + PF + CIT), active employees, cost per employee | "NPR" label on money; change as a pill vs comparison period; amber only for ±10% or more; never green/red for direction alone; 12-month sparkline with soft area |
| Charts | Payroll cost by month (stacked net / deductions / employer PF, unlocked months lighter, swings flagged, dashed 12-month average); where the money went (donut + table) | Recharts loaded after first paint; legends and tables outside the chart; empty states |
| Charts | Cost by department (bars + paid + %); attendance this month (daily present / leave / absent / off / not recorded) | Not recorded is shown, never counted as present |
| Liabilities | Statutory liabilities for the period: TDS, SSF 11% / 20%, PF both sides, CIT, with total to deposit | Beside cost by department |
| Coming up | Holidays (user's branches), birthdays and work anniversaries in the next 30 days, by BS date | Birthdays show the day only, never age; personal dates need EMPLOYEES permission |
| Actions | Pay run (step rail, next action), statutory deadlines, pending approvals (5 oldest, decided on the Approvals page), records to fix | Compact cards |
| Workforce | Leave taken this FY by type + on leave today, headcount by department, recent activity | Activity needs AUDIT_LOG |

Spacing and separation: cards (`Panel`, KPI cards, pay run banner) have a
`line-card` outline and `shadow-sm`; lines inside a card stay `line`, so the
box edge is always darker than its rows. The page is grouped into labelled sections
(Payroll · Needs attention · People) 32px apart, with 20px between cards and
16px card padding.

Card heights: every row of cards stretches to its tallest card, so cards side
by side always line up. **Dashboard cards never scroll inside**: they show only
the latest items that fit (6 activity entries, 5 oldest approvals, 6 upcoming
events, top 6 departments, 5 leave types) and link to the full list, so the
page scrollbar is the only one and the mouse wheel works everywhere. (`Panel`
still offers `bodyMaxHeight` for registers that need a scrolling list; it does
not trap the wheel.) Empty cards show a centred icon, title and one line.

Card framing: cards use the `line-card` outline (`--border-card`, darker than
`line-strong`), a title bar tinted `bg-canvas/70` with a `line-strong` rule
under it, and a white body; dividers inside stay `line`.

Chart colours: `CHART_COLORS` / `CHART_THEME` in `lib/constants/colors.ts`;
series and legends in `components/dashboard/dashboard-chart-series.ts`.
Figures come from payslips (as the salary sheet does), not from stored run
totals. Sections the user may not see are never loaded; failed sections stay
in place as error panels. `/dev/dashboard` previews every state with sample data.

### Implemented employees (Phase 4.2, templates A + B)

Employees is the first desktop module. The flow is **register → quick view →
record page → full-page editor**:

| Screen | Route | Layout and rules |
|---|---|---|
| Register | `/workforce/employees` | PageBar (counts in the description, no KPI cards) · FilterStrip (department, branch, category, status; ids kept in the URL, never the search text) · DataGrid (Code and Employee pinned, Records column, amber edge for active people missing PAN / bank / basic salary, **Actions column: View · Edit · Active/Inactive switch**). Single click shows the **quick view** beside the grid (built from the row, no request); Enter or double-click opens the record. Ctrl+N new · F2 edit · `/` search. **No delete**: employees are kept for ever; leaving is "Make inactive". |
| Record | `/workforce/employees/[id]` | PageBar (Back, Edit F2, Make inactive / active, Resend sign-in, Print Ctrl+P; no delete) · sticky identity column on the left (avatar, name, designation, status, codes, mobile and email with copy, reports to, joined + service, records to fix, record navigator Alt+PgUp/PgDn) · folder tabs in the URL, loaded on the server one at a time: Overview (default: headline tiles for base pay, last net pay, leave left, loans; Job, Contact, Attendance, Records & login cards), Profile (topic cards with bold values under small labels, bank masked, an Edit link per card opening the editor at that section), Leave, Attendance (BS month to date; missing days are "not recorded", never absent), Payslips (last 12, totals), Loans, History (audit trail by field label). Each related tab needs its own module's VIEW. Missing, malformed and out-of-scope ids show the same in-frame "Employee not found". |
| Editor | `/workforce/employees/new`, `/[id]/edit` | One scrolling `PropertyForm` with a **SectionIndex** on the left (✓ done, red count for errors, click to jump; a "Jump to section" select below 1024px). Each section is a **compact `FormGrid`** (see below). Error summary on top with links to each field; sticky footer whose **status line shows the focused field's hint**; unsaved-changes guard. Status is not edited here. |
| Status | list switch, record page | `EmployeeStatusWindow`: Make inactive asks for last working day, separation type, reason (notice date and retirement benefit optional), switches the self-service login off and is audited; Make active clears the separation and turns the login back on. Not allowed on your own record. |

**Form legibility (4.2 review).** Research behind it: eye-tracking studies of
label placement (Wroblewski, NN/g, UXmatters) favour labels right-aligned
beside the field for dense multi-column forms that people use every day;
WCAG 1.4.11 asks for 3:1 contrast on the outline of every form field; the
classic Windows / SAP dialog puts white edit boxes on a grey control surface.

| Token | Value | Use |
|---|---|---|
| `--border-input` (`border-line-input`) | `#7F8A79` | Outline of editable fields: 3.6:1 on white, 3.3:1 on the panel |
| `--border-input-hover` | neutral-500 | Hover |
| `--text-label` (`text-ink-label`) | neutral-700 | Field labels (medium weight) |
| `--surface-panel` (`bg-surface-panel`) | `#F3F5F1` | Grey dialog surface behind the fields |

- Group box: white header (number, bold title, progress) over a grey panel;
  fields are white with the dark outline; focus = brand outline + ring;
  invalid = danger outline + tint; read-only text boxes = dashed grey (buttons
  are excluded: they also match `:read-only`).
- Rows 30px; labels wrap rather than truncate; the current row gets a brand
  tint and a 3px marker on its left.
- A test computes the outline contrast from the hex values in `globals.css`.

**Date field (original design restored).** The kit `DateField` draws the
original AakashHRMS picker: a box with an attached eraser (clears the date);
under it, on one line, "AD Equivalent: 14 Apr 1995 · B.S. CALENDAR" (or the BS
equivalent in AD mode); the calendar opens on click with a green header,
round ‹ › buttons, Month / Year drop-downs, Su–Sa row, solid-green chosen day
and green-ringed today. It opens to the left near the right edge. All keyboard
behaviour stays (Alt+↓, arrows, PgUp/PgDn, Enter picks and moves on, Esc,
"Finish the date", no accidental "today").

**Phone field (4.2 follow-up).** The kit `PhoneField` brings back the
original country picker as a desktop split field: a country button
(`NP +977 ▾`) joined to the number box. Its popup has a search box (name, ISO
code or dial code: "977", "india", "IN") over every country from
libphonenumber-js, Nepal first (`lib/constants/countries.ts`). Typing
"+91 …" in the number switches the country by itself; digits, spaces and
dashes only. Enter in the number moves on; the country button is reached with
Tab or the mouse (`data-enter-skip`), Alt+↓ / F4 in the number opens the list.
It stores one E.164 string. Mobile must be a real mobile number
(`validateMobileNumber`: Nepal 10 digits starting 96/97/98; other countries by
the library's mobile metadata, kept in `lib/utils/phone-mobile.ts` so pages
that only format numbers don't load it); Home phone accepts landlines.

**Address row (4.2 follow-up).** Province → District (narrowed to the
province) → Local level → Ward → Tole, as the original picker had. Picking a
district first still fills its province; a new province clears a district
outside it (`changeAddress`). One row from 1280px, two rows below. Ward 1–35.

**Pay section (4.2 follow-up).** Basic salary, grade count and "Grade by hand"
need Salary mapping → Edit; without it they are read-only values. Under them a
calculation strip shows the grade policy in words, the value of one grade,
the grades paid (with the cap warning), the grade amount with its formula
(`30,000 ÷ 30 = 1,000 × 3 = 3,000`) and the total monthly base. An automatic
grade always shows the policy's current value; a saved amount that no longer
matches is pointed out ("Saving updates it").

**Record page: payroll-software profile layout.** Research: BambooHR (fixed
left column with photo, contact, time off), greytHR (profile card + topic
cards), Keka (Profile tab of cards: primary details, contact, addresses,
identity), Zoho Payroll (Overview, then salary, payslips, loans), Sage 50
(tabs by subject). Shared pattern: an identity column always visible, topic
cards, and values as bold text under small labels (not input boxes).

- **Identity column** (left, sticky): avatar, name, designation, status and
  codes; mobile and email with copy buttons; reports to, joined + service,
  department · branch, category · level; records to fix; record navigator.
- **Tabs:** Overview (default) · Profile · Leave · Attendance · Payslips ·
  Loans · History.
- **Overview:** headline tiles (monthly base pay, last net pay, leave left,
  loans outstanding; each opens its tab) and cards for Job, Contact,
  this month's Attendance, Records & login.
- **Profile:** topic cards (`InfoCard` + `DescriptionList`): Primary details,
  Job & placement, Pay, Bank (masked), Identity documents, Contact &
  addresses, Family, Self-service access, Separation. Each card's **Edit**
  opens the editor at that section (`/edit#section-…`).
- Kit: `InfoCard`, `DescriptionList` (label above value, copy buttons),
  `StatTile`. KPI-style tiles appear only on the dashboard and on a single
  record's Overview; module registers stay tables.

**Card page layout (record and editor, 4.2 polish).** Patterns taken from
desktop ERP card pages (Business Central, SAP Business One master data):

- (Superseded by the payroll-software profile layout above: the record page
  now shows values as bold text in topic cards; `ViewField` remains in the
  kit for read-only fields inside forms.)
- **Group boxes are numbered** (`FormGroup`): "1 General", "2 Job &
  placement"… with a "4 of 6 required" chip (green "Complete", red "n to
  fix"); the section index repeats the numbers and counts.
- **Record header.** Record page: key facts (designation, department,
  branch, category and level, joined + service, supervisor, mobile, email)
  under the page bar, without repeating the name, and the **record navigator**
  "◀ 2 of 37 ▶" (Alt+PgUp / Alt+PgDn, keeps the current tab). Editor: a live
  card (initials, name as typed, codes, placement) with a "required fields"
  meter.
- **Folder tabs** (`Tabs variant="folder"`): tabs joined to a framed panel,
  the active one marked by a brand line on top.
- (FactBox pane replaced by the identity column and the Overview tiles.)
- **Status bar** in the editor footer (`StatusBar`): focused field's hint ·
  required fields left · save state · key reminders.
- **Current row highlight**: the row being edited is tinted and its caption
  turns brand-coloured, as desktop forms mark the current field.
- **F6 / Shift+F6** move to the next / previous section (the desktop key for
  moving between panes).

**Compact form grid (`FormGrid` + `GridField`).** After SAP Fiori's
responsive form grid (12-column grid, fixed label/field ratio, empty space
after fields so inputs do not stretch) and Business Central FastTabs
(captions left of fields, fields flow into two or more columns on wide
screens):

- 1 column on phones (label above), 2 from 768px, 3 from 1280px; captions
  right-aligned in a 8.5rem column; rows 28px high.
- Fields are sized by their data, not by the column: `xs` (ward, grade
  count), `code` (codes, PAN, mobile), `date`, `amount`, `md` (choices),
  `lg` (names, emails), `full` (addresses, reasons). `span` widens a field
  across columns.
- Help text is not printed under fields (rows would jump); it shows in the
  footer status line for the focused field, like the hint bar of desktop
  accounting software. Errors always show under the field.
- A `suffix` shows a live hint beside a field (age next to date of birth,
  service length next to joining date, "Below scale" next to basic salary).
- Repeating groups use a small table (identity documents: number + issuing
  district per row); an address is one row: district, local level, ward, tole,
  with the province filled in.
- Choices use the kit `SelectField` (not the native `<select>`, whose open
  list swallows Enter on Windows); yes/no answers use `YesNoField` (Y / N /
  Space; Enter moves on) instead of checkboxes.

**Full-page editor vs window.** A record with more than about 15 fields, or
one people type in for long stretches (employees, company setup), gets a full
page with a section index. Short records (a department, a holiday, a leave
type) keep the `Window` editor.

**Enter-to-next (all kit forms with `enterNavigation`):**

| Key / where | Action |
|---|---|
| Enter on an input, select, checkbox or date | Checks that field with the same rules the server uses; if it is wrong the error shows and focus stays, otherwise focus moves to the next editable field, across sections |
| Shift+Enter | Previous field, never blocked |
| Enter in a combobox with its list open | Picks the highlighted option and moves on. Opening the list with the mouse highlights only the current value, so click + Enter never picks an option you did not choose |
| Drop-down (`SelectField`) | Closed: ↑/↓ change the value, letters jump (type-ahead), Alt+↓ / F4 / Space open, Enter moves on. Open: Enter picks and moves on. Picking with the mouse keeps focus on the field |
| Yes / No (`YesNoField`) | Y or N answers, Space or ←/→ switch, Enter moves on; clicking either half chooses it |
| Enter in a date field with the calendar open | Picks the highlighted day and moves on (Alt+↓ opens, arrows move, PgUp/PgDn change month, Esc closes). Without moving in an empty calendar, Enter just closes it (no "today" by accident) |
| Enter on a half-typed date | Stays and says "Finish the date as YYYY/MM/DD" instead of moving on with the old value |
| Textarea | Enter is a new line; Ctrl+Enter moves on |
| Last field | Focus moves to Save; Enter never submits the form by itself |
| Ctrl+S / Ctrl+Shift+S | Save / save and add another |
| Mouse, Tab | Never blocked or redirected |

Read-only, disabled and helper controls (`data-enter-skip`, e.g. "Next free
code", "Enter by hand") are skipped. Optional documents left empty skip their
district. Scrolling to a field uses `scrollIntoContainer` (never
`scrollIntoView`, which also moves the app frame) and keeps the field clear of
the sticky footer.

Form kit added in 4.2: `FormGrid` / `GridField` / `GridValue` / `useFieldHelp`,
`SelectField`, `YesNoField`, `Combobox`, `DateField` (BS/AD typed or picked,
stored as AD, limited to the years the calendar library supports),
`NumberField` (right-aligned amounts and counts, typed, never browser spinners; `max` refuses larger values, `selectOnFocus` for small fields such as a day of the month), `SectionIndex`, `useUnsavedGuard` +
`DiscardBar` (shared with `Window`), `scrollIntoContainer`. Rule: a control
must keep the same element tree while the user types (a wrapper that appears
or disappears remounts the input and drops focus).
Field labels and the section layout live in `lib/constants/employee-form.ts`.

## 5b. Design enhancements (beyond the base frame)

These came out of the reference research (`05-functional-research.md`).
Each one is scheduled in the roadmap.

| # | Enhancement | Why | Phase |
|---|---|---|---|
| E1 | **Working period selector** in the title bar (BS month + year), shared by payroll, attendance and reports, persisted per user | Tally-style "current period" removes re-picking the month on every screen | 2 |
| E2 | **FactBox pane** (Business Central): a right-hand context panel on registers and cards (e.g. YTD gross/TDS/SSF, leave balance, loans, pending changes) | Answers the next question without navigating | 3 |
| E3 | **Worklist template** (SAP Fiori) for approvals and payroll exceptions: one item at a time, `A`/`R` to approve/reject, `J`/`K` to move. Keys act only while the worklist has focus (never page-wide) | Faster than modal-per-row approval | 3 |
| E4 | **Problems panel**: an IDE-style docked list of blocking issues in the payroll wizard, with click-to-jump | Pre-flight and variance issues become actionable | 4.8 |
| E5 | **Density toggle** (Comfortable 32px / Compact 28px rows) in the user menu | Finance users with big tables want compact; occasional users want comfortable | 3 |
| E6 | **Alt+G alias** for the command palette, plus `F`-key hints in tooltips | Familiar to Tally users in Nepal | 2 |
| E7 | **Lakh number grouping** (`4,52,300.00`) and **BS-first dates** everywhere, with AD in a tooltip | Local expectation | 1 / 3 |
| E8 | **Bilingual UI strings for payslips and self-service** (English / नेपाली), with Noto Sans Devanagari as the fallback font | Competitors offer Nepali payslips | 5 |
| E9 | **Status-edge rows**: a 3px coloured left edge on grid rows with exceptions (warning/danger), alongside the status chip | Scannable without relying on colour alone | 3 |
| E10 | **Print-perfect report preview** with page thumbnails and A4 portrait/landscape toggle | Reports are printed and signed in Nepal offices | 4.11 |
| E11 | **Skeleton loading that matches the template layout** (grid rows, form rows) | Feels instant, no layout jump | 3 |
| E12 | Optional **dark theme** using the same token names | Late-evening payroll work | 9 |

### Implemented organization (Phase 4.3, template A + Window editors)

`/workforce/organization` holds every workforce master in one module, as
payroll software keeps its masters together (TallyPrime: employee groups and
categories; Zoho Payroll / Keka: departments, designations, locations). Folder
tabs in the URL (`?tab=`): **Structure · Reporting · Branches · Departments ·
Designations · Levels · Employment types**. Old links
(`/workforce/departments`, Company setup's branches / departments /
designations / shreni / employment types) open the matching tab.

| Tab | Layout and rules |
|---|---|
| Structure | Branch × department matrix of **active headcount** (counts only, no names; a number opens the employee register filtered to that branch and department; cells where the department is not open to the branch are hatched, and people placed there anyway are flagged) beside a department → designation **ARIA tree** (↑/↓, → opens, ← closes, Home/End) with the head and counts. After SAP's Company Structure Overview. |
| Reporting | Who reports to whom, built from each employee's "Reports to" (Sage HR / Keka org tree): initials, name, designation · branch, code, "N below"; find a person, expand / collapse, Print. Lists loops, people reporting to someone who has left, and people with no supervisor and no team. Needs Employees → View and follows that scope. |
| Registers (5) | PageBar (New Ctrl+N, Edit F2, Make inactive / active, Delete, Refresh; counts in the description, no KPI cards) · FilterStrip (search, status defaulting to Active, plus branch or department) · DataGrid (code and name pinned, live headcount with total, status chip, Actions: Edit and Active/Inactive switch) · SplitView **FactBox** detail (facts, "Used by" counts, people with links, whether it can be deleted). Enter / double-click edits. |
| Editors | Kit `Window` with a two-column `FormGrid` on the grey panel, Enter to the next field with the server's rules, Save at the end, unsaved-changes guard. Branch: code, name, head office (moves the flag), remote area, location (kit `AddressField`, shared with the employee form), phone (`PhoneField`), email. Department: code ("DEPT-00n" suggested), name, head (employees, supervisors first), All branches Yes/No or a branch checklist, description. Designation: name, department, description. Level: code, number, name, Nepali label, starting / maximum salary, order, plus "Load an industry scale". Employment type: code, names, SSF / PF / festival / leave / OT eligibility, notice, probation, order. |

- **Never deleted while in use.** Delete is offered only when nothing has
  used the record (employees of any status, designations, user access scopes,
  branch holidays, payroll runs, departments limited to a branch); otherwise
  the answer is **Make inactive**, which keeps it on existing records and
  history and drops it from pickers for new choices. Delete asks for the typed
  name.
- **Renames keep links.** Employees hold a level by code and an employment
  type by name, so a rename moves them in the same transaction.
- **Company-wide departments.** A department is open to all branches or to
  chosen ones; the employee form lists branch first and offers only the
  departments open to it (the save checks it too).

### Implemented salary structure (Phase 4.4, templates A + B + EditGrid)

`/workforce/salary-mapping`, titled **Salary structure**. Each employee's pay
is a list of **dated revisions** (SAP IT0008 / Zoho Payroll "effective
from"): nothing is overwritten, a change is a new revision with an effective
date and a reason, and payroll uses the revision in force for the month.
Folder tabs in the URL (`?tab=`; `?employee=<id>` opens with that person
selected): **Structures · Bulk edit · Changes · Templates**.

| Tab | Layout and rules |
|---|---|
| Structures | PageBar (Revise salary / New structure F2, Bulk edit, Print letter, Refresh; counts and waiting changes in the description) · FilterStrip · DataGrid (code and name pinned; level, basic, grade, allowances, deductions, gross, net, effective from, status: Current / Takes effect later / Change waiting / No structure) · SplitView detail: FactBox breakdown per pay head and a **History** list (effective from, gross with % change, reason, Letter link). Enter / double-click opens the Revise window. |
| Revise window | Kit `Window` xl, `FormGrid`, Enter to the next field: effective from (BS), reason, basic, retirement scheme (SSF / PF / none), grade count, grade amount (policy, or by hand where allowed), one field per fixed-amount head, Yes/No per worked-out head ("10% of basic"); a totals aside (gross, SSF 11% / employer 20% on the company base, deductions, net before tax, employer cost, change versus now). |
| Bulk edit | The **EditGrid** (below). Above it, two numbered strips: **1 Employees** (filters + "Add matching employees", "Add one employee", remove selected) and **2 Change details** (effective from, reason, template, column chooser remembered per browser, CSV download / import). Below it: current versus new monthly gross, the difference, rows changed, errors, and why Review is not yet available ("Give a reason (step 2)"); **Review changes** opens a window listing each change with old → new values ("Basic 22,000.00 → 24,500.00"), gross now / new, and the employer cost change, before Submit. |
| Changes | One row per change batch (bulk save, single revision, CSV import, starting salary, grade-policy sync): made, effective from, kind, reason, employees, monthly change, prepared by, status. Detail: old → new gross per employee; **Approve** (typed `APPROVE`), **Reject** (reason required) for someone other than the preparer; **Withdraw** for the preparer while pending. The approval setting (on by default) sits on top, switchable only with Approve. |
| Templates | Register + Window: code, name, fits (levels and / or designations, none = everyone), basic (amount or the level's starting salary), scheme (keep / SSF / PF / none), pay heads. Applied to selected Bulk edit rows; grade counts are kept and the grade recalculated. |
| Letter | `/workforce/salary-mapping/letter/[revisionId]`: A4 print page (Ctrl+P; frame hidden in print), company header, employee, effective date, reason, previous / revised / change per component, gross and net before tax, signature lines. English only. |

**EditGrid** (`components/kit/edit-grid.tsx`, logic in `lib/kit/edit-grid.ts`).
Columns declare `kind` (`number`, `choice`, `check`, `readonly`), an optional
`group` (shown as a header band: Base pay, Allowances, Deductions, Worked out by
payroll, Monthly), `pinned`, `original` (to mark changes), `error` / `warning`.
Changed cells carry an amber corner mark with the old value in the tooltip;
errors are red with the message; read-only (worked-out) cells are grey. The
status footer names the active column and row, its error or warning, the last
message (e.g. "Copied 3 × 2 cells") and a key reminder.

| Keys / mouse | Action |
|---|---|
| Arrows · Tab / Shift Tab · Home / End | Move (Tab wraps to the next row) |
| Ctrl + arrows · Ctrl Home / Ctrl End | Jump to the edge / first / last cell |
| Shift + arrows · Shift click · drag | Select a range; Ctrl A selects all |
| Type | Replace the cell; Enter saves and moves down, Tab right, Esc cancels |
| F2 · double-click | Edit the cell keeping its value (a choice cell opens its list) |
| Enter / Shift Enter (not editing) | Down / up; Space or Enter toggles a Yes/No cell |
| Ctrl C / Ctrl V | Copy / paste blocks with Excel (tab-separated); one value pasted fills the selection; "1,20,000" and "NPR 25,000.50" are read as numbers |
| Ctrl D | Fill down from the top row of the selection |
| Delete / Backspace | Set the selection to 0 (No for Yes/No cells) |
| Ctrl Z / Ctrl Y (Ctrl Shift Z) | Undo / redo, a paste or fill counts as one step |

- **One owner for pay.** The employee form sets only the **starting**
  structure on hire; for existing employees the Pay section is read-only with
  "Revise in Salary structure".
- **Approvals (Zoho Payroll style, S21).** The tab is **Approvals**
  (`?tab=approvals`; `changes` still opens it). *Approval settings* (company
  administrators): **No approval**, **Simple** (anyone with Approve, never
  the preparer) or **Multi-level** (named approvers in order, Level 2 after
  Level 1; up to 5; move up / down). The flow is copied onto each change when
  it is saved. **Final approve**: company administrators can approve at any
  stage, including their own change (recorded); the Revise and Review windows
  offer them **Save and approve**. **Nobody approves a change to their own
  salary**: Bulk edit marks your row "(you)"; levels whose approver prepared
  the change or is in it are skipped. Views: **Waiting for me** (default when
  there is something; count on the tab and in the title-bar bell) and **All
  changes** (filters: status, approved how). Rows can be selected for bulk
  Approve / Reject (typed `APPROVE`, results per change). The detail shows
  the **approval timeline** (submitted, each level, skipped levels and why,
  final approve, rejection with reason, "on behalf of" for delegates, and
  the levels still to come), what changed (old → new) and the effect on
  gross, net before tax and employer cost, with buttons from the same engine
  the server uses (Approve Level n, Approve for X, Final approve, Reject,
  Withdraw) or the plain reason. The form footers say what saving will do
  ("Goes to Level 1: Gita, then Level 2: Hari"). This pattern is the template
  for pay-run (4.8) and loan (4.10) approvals.
- **Paid months are closed.** A change may not take effect in a month whose
  payroll is approved or locked for that employee (no arrears yet): the date
  field says the first open date, and the server refuses it on save and on
  approval. After saving, the page names any draft payroll month to
  recalculate.
- **Typo guard.** A basic salary that moves by more than half (up or down)
  is flagged ("Basic rises by 300%: check for a typo") in the grid and the
  Revise window; it is a warning, not a block.
- **Label pay heads.** Onboarding's "Basic Salary" / "Grade Amount" heads
  are labels for the base pay. They are never offered for new entry
  (Revise window, Bulk edit, templates); where a structure already holds an
  amount on one it is shown as "(pay head)" with a warning, because payroll
  pays it on top of basic / grade.
- **Revise window:** Save is disabled until something changes; server
  messages show in the footer, beside the buttons.
- **CSV** rather than `.xlsx` (no new dependency): download the template for
  the chosen rows, edit in Excel, save as CSV, import. Rows match by employee
  code and columns by header; unknown codes and columns are listed and the
  values land in the table as changes, so the table is the preview.

### Implemented attendance (Phase 4.5a, templates A + C)

`/timeAndLeave/attendance`. One set of **day rules**
(`lib/engines/attendance-day.engine.ts`) decides every employee-day,
first match wins: not employed → HR override (with reason) → holiday
(branch; Women's Day for women) → weekly off → approved full-day leave
(Pay / Non-Pay / Partial-Pay) → punches (first in / last out minus the
break after 5 hours: full day, half day or absent; a half-day leave covers
half) → one punch = **missing punch** (absent until adjusted) → nothing =
company setting (absent by default). Late = first in after start + grace;
overtime = beyond the planned day from the OT minimum, OT-eligible
employment types only, flagged over 4 h a day / 24 h a week (Labour Act).
The **attendance month** follows the company calendar
(`lib/engines/pay-period.engine.ts`): BS months now, AD months with payroll
runs in AD months (4.8); days are AD dates so both calendars agree. Pay:
(basic + grade in force) ÷ days in the month × (unpaid + not-employed days).

| Tab | Layout and rules |
|---|---|
| Today | Count tiles (In, Missing punch, Not in, On leave, Off / holiday, Late; a tile filters) and a DataGrid: code, employee, department, day code, in, out, worked, late, why. |
| Register | EditGrid: one row per employee, one column per day (BS day, weekday, AD day). Day codes P, ½, A, MP, OD, PL, UL, HO, WO with tones; a dot marks an HR override, an amber ring a late day. Editing a cell (keyboard, Ctrl+D, paste) sets an HR override; one reason per save. Read-only: closed months, future days, outside employment, your own row. The pane below explains the selected day (rule, in / out, worked, late, early, overtime) with Add punch and Adjustment. Month totals: paid days, unpaid, late, OT hours. |
| Adjustments | Regularization requests: Waiting for me / All, bulk approve or reject, timeline. Approved by the employee's supervisor or Attendance → Approve; company administrators Final approve; never the employee. Approval adds punches (or the On duty / Present setting). |
| Month close | One row per branch: status, employees, unpaid days, OT hours, missing punches, waiting adjustments, closed by. Close (typed `CLOSE`) stores and locks every day and summary for payroll; blocked while adjustments wait. Reopen needs a reason and is refused once that month's payroll is approved or locked. |
| Punch log | Every punch with source (HR, adjustment, web, device, import), IP, location and who entered it; Void with a reason (kept, struck through). |
| Roster (4.5b) | EditGrid like the Register: each person's shift code per day in the shift's colour; plain = assigned shift or default, **bold** = roster day, OFF = day off. Type a code, OFF or USUAL; Ctrl+D, Excel paste; one optional note per save. **Assign shift** window (shift, from, until or ongoing; selected rows or everyone shown) and **Rotate** window (steps in order incl. OFF, each N days / weeks, from / to up to 92 days, start step, preview; each step's shift keeps its own weekly offs, which are written as OFF, and the preview warns at 7+ working days in a row, Labour Act §40). Read-only: closed months, your own row. |
| Web clock-in (4.5c) | Company switch (On / Off, off by default), a DataGrid of branches (rule, office network, office location, people; double-click opens the **branch window**: rule, network list with "Add this network (your current IP)", latitude / longitude with "Use my current location", radius), and **Allowed to clock in from anywhere** (person, from, until, reason; never yourself). |
| Shifts (4.5b) | DataGrid: code chip, name (company default badge), type, hours and week summary, hours a week, people today, branch default for, Labour Act reminders, status. New / Edit / Duplicate / Make default / Archive (company-wide roles). Below: **branch default shifts**. |

Windows: **Add punch** (employee, day, check-in, check-out, note; an out
before the in is the next morning), **New adjustment**, **Attendance
rules** (company administrators: nothing-recorded rule, late rule, month
calendar), **Shift** (company-wide roles; groups: Shift (code, name,
colour, fixed / flexible) → Hours and day rules (start, end, break, grace,
full / half day, OT minimum) → Week (7 rows: working / off, own hours) →
Seasons (BS from / to, hours; "Add winter hours" fills Kartik 16 – Magh 15
from Company setup's winter time) → Labour Act checks (live)).

**Clock card** (`components/attendance/clock-card.tsx`, 4.5c): today's date, status (Not in yet / In since 09:02 / Out at 17:05 / Waiting for approval), shift, In / Out / Worked, one big **Clock in / Clock out** button (the server decides which), "Your location is checked" when the branch rule uses it, today's entries (web, HR, device; outside-office ones marked waiting / not approved) and the privacy notice. Outside the allowed place it explains why ("You are 2.3 km from Head Office (allowed 150 m)") and offers **Send for approval** with a reason. On the self-service home, and in the main app's title bar (**Clock** button, shows "In 09:02") for staff who are employees. Waiting remote clock-ins join the title-bar bell. **My attendance** (self-service) lists the month's days with code, shift, in, out, worked and why, month totals, and clock-ins outside the office with their approval.

**Shifts** (`lib/engines/shift.engine.ts`): a day's shift is the roster
day, else the person's dated assignment, else their branch default, else
the company default. The day's hours: own weekday hours, else the season's,
else the shift's; a shorter day needs its own planned hours for a full day
and half of them for a half day. Flexible shifts have no late or early and
OT after a full day's hours. A punch belongs to the nearest shift: the gap
between one day's shift end and the next start is split in the middle
(overlapping shifts: the next start). Company setup → Work schedule is
read-only and shows the default shift.

### Implemented leaves (Phase 4.6a + 4.6b, templates A + C)

`/timeAndLeave/leaves` (the old Applications and Approvals pages redirect
here). Leave types are three layers: the **calendar** (weekly offs from
shifts, public holidays from the Holiday calendar: never leave types),
**statutory types** from the Labour Act (Home, Sick, Maternity, Maternity
care, Mourning, Substitute; set by the platform, locked until 4.6c) and
**company types** (e.g. Unpaid leave). Each type is a *balance* (home, sick,
substitute), an *event* (maternity 98 days of which 60 paid, maternity care
15, mourning 13: calendar days, no balance) or *none* (unpaid). One engine
(`lib/engines/leave.engine.ts`) counts days (working basis skips the
person's weekly offs and holidays, saying why; half days are one date),
splits pay per day, and refuses a request when the type isn't for the
person, the balance is short, it overlaps another request or an HR-set day,
it falls in a closed attendance month, outside employment, or across the
leave year. Sick, mourning and maternity are rights (§51): a rejection must
say which condition is not met; other leave may be refused or moved for a
recorded work reason.

**Layout (same order as Attendance).** PageBar: **New request** (create) ·
**Starting balances** · **Open leave year** (output group, company-wide role
only) · Refresh. Below it one **context strip**: the branch (a SelectField
that filters every tab and is kept in the URL, `?branch=`) and one line of
context ("Leave year FY 2083/84 (dates) · kept in AakashHRMS from Shrawan
2083 · weekly offs and holidays inside a leave are not counted"). Then a
success **Notice** after an action, then the folder tabs. Inside a tab: the
compact Guide, the tab's own view switch and button, a **FilterStrip**
(search "Name or code" plus the tab's filters, saved views), any Notices,
then the DataGrid / SplitView. Branch is never repeated inside a tab.

| Tab | Layout and rules |
|---|---|
| Requests | Waiting for me / All / My leave; FilterStrip: name or code, leave type, status (Waiting / Approved / Rejected / Cancelled); bulk approve or reject. DataGrid: employee (sticky), leave type, **dates** (one column, "from – to", a single day shown once), days (half, unpaid), reason (one line, full text on hover), raised by and department (under Columns), status. Detail pane: dates, days counted (unpaid in red), certificate, SSF claim, balance now, the §51 note, Approve / Final approve / Reject / Withdraw / Cancel leave, approval timeline. |
| Balances | FilterStrip: name or code, department. Notices above the grid: **warning** while home leave is still the old system's up-front days (action **Switch to earned home leave…**), **info** for months that have ended but aren't closed (action **Go to month close**). DataGrid: employee × balance types (balance usable today, taken, waiting; home leave "0.5 · up to 15.8 this year"). Detail pane: the leave ledger per type (date, kind, note, who, signed days; substitute grants show "Expires …", struck through once past) and **Adjust balance** (never your own). |
| Substitute leave | Days worked on a weekly off or holiday in the last 21 days, from attendance. To decide / All, name or code search. DataGrid: employee, worked on, day (weekly off / holiday name), in – out, worked, off-day OT, suggested (full ≥ the full-day hours, half ≥ half-day hours), would expire, decision. Select rows → **Grant as suggested** / Full day / Half day / **Not granted** (reason window). Your own rows can't be decided. Tab badge: days to decide. |
| Calendar | One BS month (full width): rows = people in scope, columns = days (BS day + weekday letter, today highlighted). Approved leave a solid chip with the type's code (unpaid in red, ½ for half days), waiting leave dashed and lighter, weekly offs grey, holidays amber (each person's own shift, roster and branch holidays). A month navigator in one bordered group (◀ month ▶, as in Attendance), "This month", each day's AD date in small grey under the BS day, "Only people on leave", a key, and approved days per person. |

Windows: **New leave request** (employee, type, from / to, part of the day,
reason, certificate, SSF claim) with a **live preview from the server**:
days counted with weekday, days not counted and why, paid / unpaid, balance
now → after, problems that block sending, and notes. **Adjust balance**
(type, add / take days, whole or half, reason; shows now → after).
Self-service **Apply for leave** uses the same preview and service; waiting
requests can be withdrawn there (full My leave redesign: Phase 5).

**Open leave year** (page bar; Leave requests → Edit, company-wide): the
window starts with one sentence on where things stand ("Ready to open
2084/85." / "… can't be opened yet." / "There is no next leave year to open
yet.", with the current year's dates), then two panels: **Before you can
open**, a checklist (✓ done / dashed circle not yet) where each unmet item
says what to do (add the fiscal year in Company setup, wait for its first
day, decide the waiting requests, close the attendance months), and **What
opening does**, four numbered plain rules using the company's own limits.
Below, once there is a year to open: totals (employees, carried, to be paid
out, lapsed, new days given) and a grid per employee and balance type (the
new balance in bold, then what they had, days over the limit, new days).
The years opened before close the window. "Open 2084/85" is enabled only
when every check is met and asks for OPEN to be typed; it happens once per
year. Home leave is earned at each attendance
month close (paid days ÷ 20, taken back on reopen), so the opening gives
it no credit. The employee record's Leave tab shows the balances from the
ledger and **Payable on leaving** (home ≤ 90, sick ≤ 45, at the last basic
salary; leave salary 4.9 pays it).

**Home leave this year** (`components/leave/home-leave-year.tsx`; Balances
pane, employee record Leave tab, self-service My leave): five facts (brought
forward, earned so far, taken, **balance now** highlighted, **up to this
year** = earned + what the remaining days can give if paid) and a month table
(month, paid days, earned, status: **Added** for a closed month, **Waiting
for month close** for one that has ended, **This month · added when closed**
with "so far" figures, **To come**), then one line on what counts as a paid
day. Month statuses use StatusChip (Added = approved, Waiting for month
close = pending, This month = review, To come = draft, In the starting
balance / Not employed = inactive). The Balances grid's Home Leave cell
reads "0.5 · up to 15.8 this year". While a year's home leave is still the
old system's up-front days, a warning Notice on Balances explains it and
offers **Switch to earned home leave…**
(company-wide role): a window lists what happens in four numbered steps,
warns when no month is closed yet or someone goes below 0, previews each
person (given up front struck through, brought forward, earned so far,
taken, balance now → after) and asks for SWITCH to be typed.

**Starting balances** (page bar, company-wide role): for a
company that starts keeping leave in AakashHRMS during a leave year. Four
numbered points explain it; "Leave is kept here from [month]" (this leave
year up to the current month; suggested: the first month already closed;
fixed with a lock once saved); an EditGrid of employees employed on that
day × balance types (not substitute), showing the balance on the month's
first day, typed or pasted from Excel, changed cells marked, warnings over
a type's limit, your own row locked. Saving records only the difference.
The context strip then says "kept in AakashHRMS from …". An info Notice on
Balances lists months that have ended but aren't closed ("Home leave for Bhadra 2083 isn't added yet", with **Go to
month close**). Months before the start show "In the starting balance" in
the home leave table. Month close says what it added ("Home leave added:
1.6 days for 3 employees").

**Guide (kit, `components/kit/guide.tsx`).** Screens whose rules aren't
obvious open with a compact "How … works" panel (light info tint, `px-3
py-2`): a title with a help icon, 3–4 numbered steps (bold step name and
one short sentence, no jargon or module numbers), an optional note, and
**Got it**. Hidden, it leaves a small "How does this work?" link that
brings it back; the choice is remembered per browser (storage blocked: it
stays shown). Steps sit four in a row on wide screens, two on medium, one
on phones (container queries). Used on the leave tabs; write the steps in
the order the user acts and keep each to one line at 1366 px.

**Notice (kit, `components/kit/notice.tsx`).** The one pattern for a
message inside a page: tone `success` (an action worked), `info` (something
to know or do next), `warning` (a condition that needs a decision) or
`danger` (an error; `role="alert"`). Icon + words (never colour alone), an
optional bold title, an optional action on the right (a button or link) and
optional **Dismiss**. `rounded-md`, `text-xs`, the tone's `*-subtle`
background with a `/30` border. Don't hand-build tinted `<p>` boxes; use
Notice. Preview: `/dev/kit`.

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

**Rail (4.3 review).** A rail icon no longer jumps to the module's first page:
it lists the module's pages so you choose (Business Central / VS Code
pattern). With the navigator docked (Ctrl B, from 1280px) the docked
navigator switches to that module while the current page stays; otherwise the
list opens as a flyout over the page that closes on a choice, Esc, a click
elsewhere or the same icon again. A single-page module (Home) opens directly.
The rail marks the module of the current page (brand bar) and, separately, the
module being browsed.

**Content adapts to the space it has.** With the navigator docked the page is
224px narrower, so layouts use **container queries**, not screen breakpoints:
`FormGrid` gives 2 columns from 50rem and 3 from 76rem of its own width (labels
beside fields from 26rem); the editor's section index sits beside the form
only from 66rem (else "Jump to section" above it); the address row and the
editor footer adapt the same way. New layouts inside the workspace follow this
rule.

| Keys | Action |
|---|---|
| `Ctrl K` / `Alt G` | Command palette ("Go To") |
| `Alt 1…7` | Show that module's pages in the navigator (focus on the first; ↓ / Enter to open). Home opens directly |
| `Ctrl B` | Toggle section navigator |
| `Ctrl Shift L` | Lock the session (implemented in Phase 2) |
| `Ctrl N` | New record (current register) |
| `Enter` / `F2` | Open / edit selected row |
| `Del` | Delete selected (with confirm) |
| `Ctrl S` | Save form (`Ctrl Shift S`: save and add another, on new records) |
| `F6` / `Shift F6` | Next / previous section of a long form |
| `Alt PgUp` / `Alt PgDn` | Previous / next record on a record page |
| `Enter` / `Shift Enter` (in a form) | Next / previous field (see "Implemented employees") |
| `Esc` | Close window / clear selection / back from a record page |
| `Ctrl P` | Print current report |
| `Ctrl Shift E` | Export |
| `/` | Focus grid search |
| `?` | Shortcut help overlay |

## 7. Rules for contributors

- **Language: English only for now (decided 2026-10-03).** Screens show no
  Nepali (Devanagari) text: no Nepali labels, hints, column headers, form
  fields or placeholders, in any module. Nepali names already stored (grade
  levels' Nepali label, employment types' Nepali name, provinces and
  districts) stay in the database but are not shown or edited. After the
  whole system is finished in English, a separate translation pass adds
  Nepali across the system. Use Nepali text only where something genuinely
  requires it (for example a statutory form or letter that must be in
  Nepali, or a legal name as written on a document), and **ask before adding
  it** (confirmed by you, 2026-10-03). Typing Nepali digits into date and number
  fields still works (they are converted); BS dates use English month names.
- Never hard-code hex colours or `zinc-NNN` in **new** code. Use the semantic
  tokens (`bg-surface`, `text-ink-muted`, `border-line`, `bg-brand`…). See the
  token map in §3. Preview everything at `/dev/kit`, the development-only
  gallery.
- No arbitrary font sizes. Use the type scale.
- New lists must use `DataGrid`, new dialogs `Window`, new forms
  `PropertyForm`.
- Pop-ups (lists, calendars, pickers) use `usePopupPosition` (screen
  position, flips up, never clipped by a Window or grid). Never place a pop-up
  with `absolute top-full` inside a scrolling area.
- Every toolbar action declares its permission. Hidden is preferred to
  disabled when the user can never perform it.
- **File structure:** use the domain name in every layer: `app/(dashboard)/<route>`,
  `app/actions/<domain>.actions.ts`, `lib/services/<domain>.service.ts`,
  `lib/engines/<domain>.engine.ts` (pure, tested), `lib/repositories/<domain>.repository.ts`,
  `lib/types/<domain>.ts`, `components/<domain>/<domain>-<part>.tsx` (entry
  `<domain>-client.tsx`), `tests/<domain>.test.ts`. Rules tables go in
  `lib/constants/`, generic helpers in `lib/utils/`. No new top-level folders
  for a feature. Full table in `CLAUDE.md`.
- Dashboard vs desktop: only `/dashboard` uses KPI cards and charts; module
  screens use the register / editor / process / report templates.
