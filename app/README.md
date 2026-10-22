# Host360 Aegis console

React + TypeScript implementation of the Claude Design handoff in [`../project`](../project), the design published as `Aegis Mockup (standalone).html`. It contains three pages:

- **Console**: Backup & Recovery, Disaster Recovery and Migration, with the shared Infrastructure, Operations and Administration screens. All drawers, dialogs, wizards, menus, search, live jobs, toasts and the theme toggle work.
- **Design system** (`#/design-system`): tokens, type, spacing, icons and components, read from the live tokens.
- **Handoff values** (`#/handoff`): the values and CSS a developer needs, also read live.

Open the second and third from the user menu (initials, top right). Each has "Open the console" to come back.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/, served from any path
npm run typecheck
```

The build uses relative URLs, so `dist/` can be opened from a static host or a subfolder.

### Previewing roles and data states

The design tool's Tweaks panel is replaced by query parameters:

| Parameter | Values | Effect |
| --- | --- | --- |
| `role` | `Owner` (default), `Admin`, `Operator`, `Restore`, `Viewer` | Actions the role can't use are disabled, and hovering one says why. |
| `state` | `live` (default), `reading`, `unreachable`, `empty` | Every table and panel shows that state. |

Example: `http://localhost:5173/?role=Viewer&state=empty#/backup/guests`.

## How it's built

| Path | What it holds |
| --- | --- |
| `src/App.tsx` | Switches between the console, design system and handoff pages on the URL hash. |
| `src/pages/` | The console shell (header, navigation, search, running jobs, alerts, toasts) and the two reference pages. |
| `src/screens/` | One component per screen. `AegisList` covers the list-style screens (Nodes, Repositories, Jobs, Alerts, Audit, Policies, Backup copies, DR history, Migration plans). |
| `src/components/AegisTable.tsx` | The shared table: sorting, selection, the loading, empty and unreachable states, and the footer. |
| `src/lib/` | `Icon` (Lucide geometry, stroke 1.5), `Ind` (the sliding tab and segment indicator), tooltips, the `pc()` pseudo-class helper and the `DC` base class. |
| `src/data/` | Sample data (`aegis.ts`) and the design-system specification (`spec.ts`). |
| `src/styles/tokens.css` | Colour, font and motion tokens for both themes, resets, focus ring and keyframes. |

Screens keep the prototype's structure, so a screen can be compared with its design file line for line. `renderVals()` derives a flat view model from props and state, and `render()` reads it as `v`. Styles are inline and taken from the tokens. Hover, focus and pressed styles use `pc('hover', '…')`, which generates a class whose rule overrides the inline style. Routing is hash-based (`#/backup/sites`, `#/dr/servers?open=sql-prod-02`).

## Updating from a new design export

When the design changes in Claude Design, replace `../project` with the new export and run:

```sh
npm run port
npm run typecheck
```

`scripts/port-design.mjs` regenerates `src/App.tsx`, `src/pages`, `src/screens`, `src/components`, `src/data`, `src/lib/iconPaths.ts` and `src/styles/tokens.css`, then re-applies the hand edits listed in its `FIXUPS` table. If a fixup no longer matches, the script stops and names it. Changes made directly to the generated files are overwritten unless they are added to `FIXUPS`. The hand-written files (`src/main.tsx`, `src/lib/Icon.tsx`, `Ind.tsx`, `dc.ts`, `pseudo.ts`, `tooltip.ts`, `src/styles/global.css`) are never touched.

## Where it differs from the prototype

- **Screens and tables fill their column.** The console gives each screen, and each screen its table, `flex:1`. The prototype's runtime passes only position properties to the element that wraps an import, so it drops that style: tables end after their last row and drawers reach only as far down as the table. Here tables reach the bottom of the page with the footer pinned, and drawers are full height, as the design system page specifies.
- **Dropdowns show the saved value.** The guest picker in Restore and the mapping editors bind the select's value instead of marking an option as selected. This fixes the dropdown issue the design chat left open.
- **The page scrolls inside `#root`.** The console's minimum width is 1024 px. Below that it pans inside the app instead of scrolling the whole page.
- **Fonts are bundled.** Jost and Source Sans 3 come from `@fontsource` instead of Google Fonts, so the app works offline. Headings use Jost as a stand-in for ES Build, as in the design. Add the ES Build files with an `@font-face` rule and they take over, because `--f-head` already lists ES Build first. Tahoma falls back to Verdana where it isn't installed.
- `Aegis Directions.dc.html` (the three early shell options) isn't implemented. Direction 1c was the one chosen.
