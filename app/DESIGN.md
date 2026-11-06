# Visual design: why the console looks the way it does

Feedback on the earlier build was that it "did not feel professional" next to Veeam Backup & Replication.
This note records what was researched, what was taken from Veeam's consoles, what was kept as Host360's own, and where each decision lives in the code.

## What Veeam's consoles do (research)

Sources are listed at the end. Where the published material does not say something, this note does not claim it.

| Veeam convention | Where it is documented | What we took |
|---|---|---|
| A framed window: a navigation pane on the left (with an inventory area and view buttons), a working area that lists items with their properties as columns, commands grouped above | VBR console UI guide: navigation pane, inventory pane, ribbon, working area | Kept our frame and made it read as one: dark top bar, white management pane, light working area with cards |
| The web UI offers light, dark and system modes, two colour themes, and an expanded or collapsed management pane; the choice is stored per user | VBR web UI "Changing Appearance Settings"; Veeam ONE web client appearance (green, blue or grey scheme; light, dark or system; left menu automatic, expanded or collapsed) | Light is now the default; dark stays one click away; the pane still collapses |
| The Overview dashboard is the landing page | VeeamON 2025 coverage of the v13 web UI | Home and each product Overview open on widgets |
| Dashboards are made of widgets, each in its own cell, with the widget's name at the top; widgets can be dragged between cells | Veeam ONE dashboards and layout docs | KPI tiles became separate cards; panels became widgets with the title on top |
| Widgets drill down into a filtered list | Veeam Service Provider Console dashboards | Linked KPI widgets lift on hover and open their list |
| Job and restore wizards list their steps and end with a Summary step | VBR job wizard documentation | Every wizard now lists its steps down a left pane, with the step title heading the page on the right |
| Restraint: one brand colour, status shown with icons | Veeam brand resource centre (a single primary green with black and white) | One accent, used only for the primary action, selection and focus; status always icon plus word |

We did **not** copy Veeam's brand: no Veeam green, logo, wordmark or typeface. The accent stays Host360 teal, and the product name stays Host360 Aegis.

## What changed in the system

| Area | Before | Now | Where |
|---|---|---|---|
| Typeface | Tahoma for UI text, Jost for headings, Source Sans 3 for body: three faces, one of them a 2000s system font | One face, Inter (self-hosted), at a fixed scale: 22 px page title, 18 px drawer and dialog title, 14 px panel title and body, 13 px tables, buttons and labels, 12 px meta | `src/styles/tokens.css` (`--f-*`), `src/main.tsx` |
| Theme | Dark by default with a bright teal | Light by default; the dark theme reworked to neutral charcoal with a quieter accent | `src/styles/tokens.css`, theme key `aegis.theme.v2` |
| Frame | Header in the page colour | Dark top bar in both themes; its menus keep the page colours | `.ae-hdr` and `.ae-pop` in `tokens.css`; `pages/AegisConsole.tsx` |
| Navigation | Mixed-case group labels, flat items | Upper-case 11 px group labels, 32 px items with 4 px corners, current item tinted with the accent | `src/shell/Nav.tsx` |
| Surfaces | Square boxes with hairlines only | Cards: 6 px corners, hairline border, a soft 1–3 px shadow in light (none in dark); 4 px controls; 8 px dialogs | `ui/layout.tsx` (Panel, Tiles), `components/AegisTable.tsx`, `ui/controls.tsx`, `ui/overlay.tsx`, `styles/global.css` for the older screens |
| KPI tiles | One strip divided by hairlines | One card per value, 12–16 px apart | `Tiles` in `ui/layout.tsx` |
| Tables | 36 px rows, tabular figures everywhere | 40 px rows, 38 px header and footer on a tinted band, tabular figures only in numeric columns (Inter widens hyphens in tabular mode, which spaced out names like `erp-app-01`) | `components/AegisTable.tsx`, `MiniTable` |
| Forms | 36 px inputs on a tinted fill, 12 px grey labels | 34 px white inputs with 4 px corners, 13 px dark labels, 12 px muted hints | `ui/controls.tsx` |
| Toggles, checkboxes | Square | Pill toggles, 3 px checkbox corners | `ui/controls.tsx` |
| Wizards | Horizontal stepper on top | Steps down a 208 px left pane, page on the right, buttons in a tinted footer, 920 px wide | `Wizard` in `ui/overlay.tsx` |
| Side panels | Some legacy screens opened their drawer inside the list's box, so it was only as tall as the table | Every drawer is moved to the working area and runs from the top bar to the bottom edge | `ToMain` in `ui/overlay.tsx`; `data-drawer-host` on `<main>` in `pages/AegisConsole.tsx` and `pages/AdminPortal.tsx` |
| Fit at 1440 px | 17 tables and two toolbars scrolled sideways beside the navigation | Fixed text columns may give up 30 % of their width and flexible minimums 15 %, while numeric columns keep theirs so figures are never cut; toolbars wrap with their actions kept on the right | `flexCol` in `components/AegisTable.tsx`; `Toolbar` in `ui/layout.tsx` |
| Job sessions | A progress bar and a log | Each run is a session with statistics, after Veeam's job statistics window: Summary (duration, processing rate, bottleneck), Data (processed, read, transferred) and Status (success, warnings, errors) boxes; a read-against-transferred throughput graph with hover read-outs and a table view; the objects processed, each with its own action log; previous and next session | `platform/SessionStats.tsx`; job drawer in `platform/Jobs.tsx` |
| Column chooser | Fixed columns | A columns button at the right end of every table header, like Veeam ONE's property chooser; the first column stays; the choice is remembered per table in the browser | `ColumnMenu` in `components/AegisTable.tsx` |
| Moving through a list | Close the drawer, open the next row | "10 of 32" with previous and next beside Close, in the table's sort order, on every drawer opened from a table | `lib/activeList.ts`; `Drawer` in `ui/overlay.tsx` |
| Narrow tab rows | Tabs cut off at the drawer edge | Tabs that do not fit move into a More menu, which carries the underline while one of its tabs is open | `Tabs` in `ui/controls.tsx` |
| Bars and toasts | Flat fills | Tinted fill with a 3 px edge in the tone colour | `Bar` in `ui/layout.tsx`, toasts in `pages/AegisConsole.tsx` |

The Design System page (`#/design-system`) and Handoff page (`#/handoff`) read these values live, and their written specification (`src/data/spec.ts`) was rewritten to match.

## Sources

- Veeam Backup & Replication console UI (navigation pane, inventory pane, ribbon, working area): https://helpcenter.veeam.com/docs/vbr/userguide/vbr_ui.html
- Veeam Backup & Replication web UI, Changing Appearance Settings: https://helpcenter.veeam.com/docs/vbr/userguide/change_color_theme_web.html
- Veeam ONE Web Client Appearance: https://helpcenter.veeam.com/docs/one/userguide/view_appearance.html
- Veeam ONE dashboards, adding widgets, managing layout: https://helpcenter.veeam.com/docs/one/userguide/dashboards.html, https://helpcenter.veeam.com/docs/one/userguide/add_widgets.html, https://helpcenter.veeam.com/docs/one/userguide/layout.html
- Veeam Service Provider Console overview dashboard: https://helpcenter.veeam.com/docs/vac/provider_admin/overview.html
- VBR job wizard, finishing step: https://helpcenter.veeam.com/docs/vbr/userguide/sch_backup_job_create_summary.html
- VeeamON 2025, v13 web UI and Overview dashboard: https://jorgedelacruz.uk/2025/05/12/veeamon-2025-v13-veeam-software-appliance-new-webui-ha-universal-cdp-instant-recovery-from-vault-and-more/
- VBR job statistics, Summary, Data and Status boxes and the throughput graph: https://helpcenter.veeam.com/docs/vbr/userguide/realtime_statistics.html, https://helpcenter.veeam.com/docs/vbr/userguide/session_results.html
- VBR web UI session results (Protection Overview, Session Details): https://helpcenter.veeam.com/docs/vbr/userguide/session_results_web.html
- Veeam ONE list property chooser (ellipsis on the list header): https://helpcenter.veeam.com/archive/vac/60/provider_admin/export_one_details.html
- Veeam Brand Resource Center: https://www.veeam.com/company/brand-resource-center.html

These pages were found through web search. The build environment could not open them or their screenshots directly (network policy), so the conventions above come from their published descriptions, not from pixel measurements.

## Seven styles

The console has seven complete designs for the same content. **User menu › Switch styles** (under the theme switch) opens a picker with a drawing of each layout; picking one applies it at once, in light and dark, and the browser remembers it on every page. The internal portal has the same picker behind its palette button.

Each style changes the frame (where the navigation and tools live), the typeface, shapes, density and colour, not just the palette.

| Style | Frame | Typeface | Character |
|---|---|---|---|
| Classic | Dark top bar across the window, white navigation pane under it | Inter | The original: rounded cards with soft shadows on a light working area, teal accent |
| Graphite | Dark navigation column the full height of the window carrying the product name; white top bar over the content only | IBM Plex Sans | Enterprise flat: square edges, white page header band with tabs, contained drawer tabs, filled fields with a strong rule, blue accent |
| Horizon | No sidebar: a two-row top bar (tools, then the navigation as links and menus); the page centred in a 1408 px column | Plus Jakarta Sans | Modern SaaS: 8–16 px radii, softly lifted white cards, pill tabs and pill buttons, icon chips on KPI tiles, indigo accent |
| Command | Icon rail (labels in tooltips), a compact 44 px top bar, and a status bar along the bottom with connection, version, project, jobs, alerts and the clock | Space Grotesk with IBM Plex Mono for figures, labels and buttons | Operations centre: dark-first charcoal, 2 px corners, dense 32 px rows, upper-case mono labels, readout KPI tiles, signal-orange accent |
| Ledger | Paper masthead with a serif wordmark over a double rule; the navigation as a numbered text index with small-caps group names; wide margins | Source Serif 4 headings and figures, Source Sans 3 text | Editorial report: warm paper, sections divided by rules instead of boxes, 36–40 px serif titles and figures, underline fields, ink-green accent |
| Lumen | Every part floats: navigation, top bar and working area are separate rounded panels inset on a soft gradient | Manrope | Frosted translucent surfaces, 12–20 px radii, a violet-to-magenta gradient for the current place and the primary action, a gradient rule under the open tab |
| Atlas | A dark product rail (the three products and the style switch), then a section list headed by the product's name, then the top bar over the content | Work Sans | Cloud console: flat white panels with tinted header bands, striped tables with a copper header rule, breadcrumb kickers, copper accent |

How it is built. Screens use only tokens and the shared components, so a style is one stylesheet in `src/styles/` (`graphite.css`, `horizon.css`, `command.css`, `ledger.css`, `lumen.css`, `atlas.css`), scoped to `[data-style]` on the page root. It redefines the tokens and restyles the shared components through the class names they carry (`ae-ph` page header, `ae-kicker`, `ae-ptabs` page tabs, `ae-tb` toolbar, `ae-card`, `ae-kpi`, `ae-grid` table, `ae-drawer`, `ae-dialog`, `ae-side` navigation, `ae-hdr-*` parts of the top bar, `data-kind` on buttons). The frame is a CSS grid on the console root whose areas each style sets (`FRAMES` in `pages/AegisConsole.tsx`); Horizon's top navigation, Atlas's product rail and section title, and Command's status bar are in `shell/Frames.tsx`. The registry of styles is `src/lib/uiStyle.ts`; the picker is `shell/StylePicker.tsx`. Typefaces other than Inter and Plex ship as Latin and Latin Extended subsets (`src/styles/fonts.ts`).

### Graphite in detail

The console has two complete designs. Classic, described above, stays the default and is unchanged. Graphite is a second design for teams that prefer a flatter, denser enterprise look. Switch between them with **user menu › Switch styles**, directly under the theme switch (the internal portal has the same switch as a palette button beside its theme button). The choice is remembered in the browser and applies to every page, in light and dark.

| | Classic | Graphite |
|---|---|---|
| Frame | Dark top bar across the window; white navigation pane under it | Dark navigation column the full height of the window, carrying the product name; white top bar over the content only |
| Typeface | Inter | IBM Plex Sans (and Plex Mono for code) |
| Page header | Title 22 px semibold on the grey working area | White band across the page: upper-case blue kicker, title 30 px light, tabs on the band; grey working area below |
| Shape | 4 px controls, 6 px cards, 8 px dialogs, soft shadows | Square edges everywhere, flat surfaces separated by 1 px rules, no shadows |
| Colour | Teal accent, cool-tinted neutrals | Blue accent, neutral greys with no hue |
| Tabs | Underline everywhere | Underline on the page band; contained tabs (raised, blue top rule) in drawers and sub-sections |
| Fields | White box with a 1 px border | Filled field with a strong rule underneath |
| Buttons | Primary teal; secondary and outline white with a border | Primary blue; secondary solid charcoal; outline in the accent, filling on hover |
| KPI tiles | Card with label, semibold value | Card with a blue top rule and a 34 px light value |
| Tables | Medium headers on a tinted band | Bold headers on a grey band |

How it is built: Graphite is one stylesheet, `src/styles/graphite.css`, scoped to `[data-style="graphite"]` on the page root. It redefines the tokens and restyles the shared components through class names they carry (`ae-ph` page header, `ae-kicker`, `ae-ptabs` page tabs, `ae-tb` toolbar, `ae-card`, `ae-kpi`, `ae-grid` table, `ae-drawer`, `ae-dialog`, `ae-side` navigation column, `data-kind` on buttons). The only structural change is the console frame: its root is a CSS grid whose areas put the navigation column beside the top bar in Graphite and under it in Classic (`pages/AegisConsole.tsx`). The setting lives in `src/lib/uiStyle.ts`.

