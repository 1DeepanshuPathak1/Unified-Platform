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
- Veeam Brand Resource Center: https://www.veeam.com/company/brand-resource-center.html

These pages were found through web search. The build environment could not open them or their screenshots directly (network policy), so the conventions above come from their published descriptions, not from pixel measurements.
