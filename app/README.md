# Host360 Aegis Unified Platform

React + TypeScript app for the Host360 Aegis Unified Platform. One console holds three products and the platform they share:

- **Protection** (Backup & Recovery), **Resilience** (Disaster Recovery) and **Mobility** (Migration). Switch between them from the header. The product block in the left navigation changes; the platform sections stay where they are.
- **Platform sections**: Inbox, Customers (provider only), Workloads, Applications, Sites, Nodes and proxies, Repositories, Mappings, Alerts & Activity, Reports, Automation, Billing & Licensing and Settings.
- **Shell**: product switcher, search (Ctrl K) with a full results page, the running-jobs tray, alerts, the tenant and project picker, the clock with its time zone named, the theme toggle and the user menu (profile, sign-in and MFA, API tokens). A provider can log in as a customer's owner. A banner then stays on screen, and every action is audited under the provider user.

The app also has three reference pages, opened from the user menu:

- **Coverage** (`#/coverage`): every item in Parts 2 to 7 of the brief, with the screens that serve it, its status (Designed, Partly designed, Not designed), its priority (P0 to P4) and the platform object it reads. It is updated at the end of every turn, and "Changed in turn N" lists that turn's rows.
- **Design system** (`#/design-system`): tokens, type, spacing, icons and components, read from the live tokens.
- **Handoff** (`#/handoff`): token values and CSS, the rules every screen follows (Part 7) and the screen catalogue. For each screen the catalogue gives its level, the object it reads, its actions, its states and its priority.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/, served from any path
npm run typecheck
```

The build uses relative URLs, so `dist/` can be opened from a static host or a subfolder.

### Previewing roles and data states

| Parameter | Values | Effect |
| --- | --- | --- |
| `role` | `Owner` (default), `Admin`, `Operator`, `Restore`, `Viewer` | Actions the role can't use stay visible but disabled, and their tooltip says why. |
| `state` | `live` (default), `reading`, `unreachable`, `empty` | Every table and panel shows that state. |

Example: `http://localhost:5173/?role=Viewer&state=empty#/backup/workloads`.

Routes are `#/{product}/{page}/{tab}?open={id}`. For example, `#/backup/activity/jobs` shows the Jobs tab and `#/backup/workloads?open=sql01` opens SQL01's drawer. The old addresses `jobs`, `alerts`, `audit` and `access` redirect to their new tabs.

## How it's built

| Path | What it holds |
| --- | --- |
| `src/App.tsx` | Switches between the console, Coverage, Design system and Handoff pages on the URL hash. |
| `src/pages/AegisConsole.tsx` | The console: header, navigation, search, running jobs, alerts, toasts, acting-as-owner and the screen switch. |
| `src/shell/` | Navigation (`Nav`, `routes.ts` with the sections and redirects), the tenant and project picker, and the account menu and dialogs. |
| `src/platform/` | Platform screens (Workloads, Applications, Customers, Inbox, Search, Alerts & Activity, Automation, Settings, Billing). `store.ts` holds the state these screens share, so an approval made in Automation also clears its Inbox item. Each change writes an audit record. |
| `src/ui/` | Building blocks for the platform screens. `controls.tsx` has buttons, segments, tabs and form fields. `layout.tsx` has page, section, toolbar, bars, panels, facts, status and steps. `overlay.tsx` has the drawer, dialog, wizard, step-up MFA and `DangerDialog`. `ctx.ts` defines the screen context type. |
| `src/screens/` | The product screens (Overview, Protected guests, Restore, Sites, DR servers, Recovery plans, Migration servers…). `AegisList` covers the simpler list screens. |
| `src/components/AegisTable.tsx` | The shared table used by every list: sorting, selection, the loading, empty, no-match and unreachable states, and the footer. |
| `src/data/` | Sample data. `platform.ts` holds the platform model (customers, partners, workloads, applications, users, roles, policies, approvals, audit and alerts), and `aegis.ts` holds the product data. `coverage.ts` holds the Coverage rows, and `screens.ts` the screen catalogue and Part 7 rules. `spec.ts` holds the design-system specification. |
| `src/lib/` | `Icon` (Lucide geometry, stroke 1.5), `Ind` (the sliding tab and segment indicator), tooltips (`data-tip`), the `pc()` pseudo-class helper and the `DC` base class used by the product screens. |
| `src/styles/tokens.css` | Colour, font and motion tokens for both themes, resets, focus ring and keyframes. |

The code is the source of truth. The design export in `../project` was the starting point, and the port script that read it has been retired.

Platform screens are function components that take a `ctx: Ctx` prop. Product screens are class components on `DC`: `renderVals()` derives a flat view model and `render()` reads it as `v`. Styles are inline and taken from the tokens. For hover, focus and pressed states, `pc('hover', '…')` generates a class whose rule overrides the inline style.

### Adding a screen

1. Add the route to `src/shell/routes.ts`, and add the key to the `PLATFORM` map in `AegisConsole.tsx` if the screen is platform-level.
2. Build it from `src/ui` and `AegisTable`, and give every list all of the list states.
3. Add it to `SCREENS` in `src/data/screens.ts` and to the screens of its Coverage rows in `src/data/coverage.ts`. Bump `CURRENT_TURN` and set `turn` on the rows that changed.

## Rules every screen follows

These are listed in full on the Handoff page. In short:

- **List states.** Loading shows "Reading…" with 8 skeleton rows. Every list also has an empty state and a "Could not be read: <reason>" state. Never show an unreachable thing as empty or zero.
- **Icons.** A shield always means encryption and a padlock always means immutability.
- **Time zones.** Times always name their zone.
- **Info icons.** At most two per view.
- **Drawers.** They follow one structure: kicker, title, status, actions, tabs.
- **Long-running actions.** They show a live log and keep running when their drawer closes.
- **Destructive actions.** The confirmation is armed in the same dialog. It lists exactly what will be removed, asks for the name to be typed, and requires step-up MFA and, where policy says, an approval.
- **Tables.** They fit 1440 px and never wrap names, badges or buttons.

## Where it differs from the design export

- **Screens and tables fill their column**, with the table footer pinned and drawers at full height.
- **Dropdowns show the saved value.** The guest picker in Restore and the mapping editors bind the select's value.
- **The page scrolls inside `#root`.** The console's minimum width is 1024 px.
- **Fonts are bundled.** Jost and Source Sans 3 come from `@fontsource`. Jost stands in for ES Build; add the ES Build files with an `@font-face` rule and they take over. Tahoma falls back to Verdana.
- **Products are named for what they do.** They are Protection, Resilience and Mobility. The product switcher also shows each engine name (Backup & Recovery, Disaster Recovery, Migration).
- **Some legacy screens moved.** Jobs, Alerts and Audit are tabs of Alerts & Activity. Access is now Settings › People and Settings › Roles.
