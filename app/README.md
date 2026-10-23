# Host360 Aegis Unified Platform

React + TypeScript app for the Host360 Aegis Unified Platform. One console holds three products and the platform they share:

- **Protection** (Backup & Recovery), **Resilience** (Disaster Recovery) and **Mobility** (Migration). Switch between them from the header. The product block in the left navigation changes; the platform sections stay where they are.
- **Platform sections**: Home, Inbox, Customers (provider only), Workloads, Applications, Sites, Nodes and proxies, Repositories, Mappings, Agents, Alerts & Activity, Security & Compliance, Reports, Automation, Billing & Licensing, Settings and Support.
- **Audiences**: the provider sees every customer. A provider can log in as a customer's owner, or preview what the customer's self-service users see (Customers › Preview self-service): a reduced navigation and a read-only view of status, usage, invoices, reports and support.
- **Shell**: product switcher, search (Ctrl K) with a full results page, the running-jobs tray, alerts, the tenant and project picker, the clock with its time zone named, the theme toggle and the user menu (profile, sign-in and MFA, API tokens). A provider can log in as a customer's owner. A banner then stays on screen, and every action is audited under the provider user.

- **Internal Admin Portal** (`#/admin`): a separate surface for Host360 staff only: tenants, sign-ups waiting for KYC review, managed accounts, hardware and sites, templates, maintenance windows with customer communication, and on-premises deployments. Its "Log in as owner" hands over to the console with the acting-as banner.
- **Sign up** (`#/signup`): the public self sign-up. Work e-mail with a code, organisation with GSTIN or EU VAT, verification, a 30-day trial and provisioning. A PAN that does not match the legal name sends the sign-up to the KYC queue in the Internal Admin Portal.
- **Public calculator** (`#/calculator`): the backup, DR and migration calculators without sign-in, with a request form. Support › Calculators gives the code to embed it on a website.

The app also has three reference pages, opened from the user menu:

- **Coverage** (`#/coverage`): every item in Parts 2 to 7 of the brief, and (Part 8) every requirement group of the requirements workbook `Backup-migration-DR Requirements v2.1` with the workbook's own priority, with the screens that serve it, its status (Designed, Partly designed, Not designed), its priority (P0 to P4) and the platform object it reads. It is updated at the end of every turn, and "Changed in turn N" lists that turn's rows.
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

Routes are `#/{product}/{page}/{tab}?open={id}`. For example, `#/backup/activity/jobs` shows the Jobs tab, `#/backup/workloads?open=sql01` opens SQL01's drawer and `#/dr/recovery?open=core` opens the Core services failover runbook. The console opens on Home. The old addresses `jobs`, `alerts`, `audit` and `access` redirect to their new tabs.

## How it's built

| Path | What it holds |
| --- | --- |
| `src/App.tsx` | Switches between the console, the Internal Admin Portal, Sign up, Coverage, Design system and Handoff pages on the URL hash. |
| `src/pages/AdminPortal.tsx`, `src/admin/` | The Internal Admin Portal shell and its sections (`Tenants`, `Signups` for KYC review, `Estate` for managed accounts and hardware, `Templates`, `Maintenance`, `OnPrem`). Its data is in `src/data/internal.ts`. |
| `src/pages/Signup.tsx` | The public sign-up flow, with GSTIN, PAN and VAT checks. |
| `src/pages/PublicCalculator.tsx` | The public calculator page; it reuses `CalculatorBody` from `src/platform/Calculators.tsx`. |
| `src/pages/AegisConsole.tsx` | The console: header, navigation, search, running jobs, alerts, toasts, acting-as-owner and the screen switch. |
| `src/shell/` | Navigation (`Nav`, `routes.ts` with the sections and redirects), the tenant and project picker, and the account menu and dialogs. |
| `src/platform/` | Platform screens (Home, Inbox, Search, Workloads with Discovery and one list of recovery points, Applications, Customers, Agents, Alerts & Activity, Security & Compliance with residency and evidence packs, Reports, Automation with workflows, integrations and the API explorer, Settings with identity, keys, notifications, branding and updates, Billing with plans and editions, usage, chargeback, invoices and quotas, Support with calculators and the compatibility matrix). Turn 6 added, from the requirements workbook: `Gateway.tsx` (API contract, limits per caller, event catalogue, CLI and SDKs), `Isolation.tsx` (tenant isolation), `DataMovement.tsx` (change tracking per platform, transfer defaults, bandwidth schedules), `Host360Portals.tsx` (Host360 cloud and Partner Portal), `Fleet.tsx` (the provider's fleet view and PSA tickets) and the Every meter view in `Commercial.tsx`. Turn 7 added `Threats.tsx` (threat detection and clean recovery) and `GetStarted.tsx` (first run and telemetry). Turn 8 added `Seeding.tsx` (offline seeds, shared by Resilience and Mobility), `errors.ts` (the error catalogue: code, cause, fix, article and troubleshooter checks), `SelfRestore.tsx` (customer self-service restore) and `CalcOutputs.tsx` (calculator design, cost, sensitivity and quotes on the shared engine in `Calculators.tsx`). `store.ts` holds the state these screens share (approvals, policies, runbooks, failover runs…), so an approval made in Automation also clears its Inbox item. Each change writes an audit record. |
| `src/ui/` | Building blocks for the platform screens. `controls.tsx` has buttons, segments, tabs and form fields. `layout.tsx` has page, section, toolbar, bars, panels, facts, status and steps. `overlay.tsx` has the drawer, dialog, wizard, step-up MFA and `DangerDialog`. `ctx.ts` defines the screen context type. `DepGraph.tsx` draws layered dependency graphs; `MonthGrid.tsx` draws month calendars; `CopyCurl.tsx` is the "Copy as cURL" button screens put in their toolbar. |
| `src/products/protection/` | Protection additions to the kept screens: `Endpoints.tsx` (Protected guests tabs; agents and endpoints, recovery media), `MoreSources.tsx` (Kubernetes, Microsoft 365 and Google with AD forest recovery, file shares), `Verification.tsx` (Overview tabs; restore verification), `PlatformObjects.tsx` (LXC containers, cluster configuration, OpenStack projects, import from Proxmox Backup Server) `RestoreExtras.tsx` (restore pre-flight, restore from another account) and `ForeignBackups.tsx` (Veeam, Commvault, Acronis, NetBackup and Rubrik backups read in place). |
| `src/products/resilience/` | Resilience: `data.ts` (replication per workload, recovery plans as runbooks with approval steps and parallel stages, readiness scoring, drills), `runner.ts` (runs plans step by step, interleaving parallel stages; runs live in the store and drive the jobs tray), `ReplicaChecks.tsx` (Protected servers tabs; consistency groups, checksums, test boots, resyncs), `AppDr.tsx` (database and Kubernetes DR, split brain), `NetworkRecovery.tsx` (Mappings tabs; re-IP and names, identity at the recovery site), `Overview.tsx` with `Capacity.tsx` (recovery site capacity), `RecoveryPlans.tsx` with `Compliance.tsx` (regulatory requirements per customer) and `Dns.tsx` (DNS records per plan), `Builder.tsx` (visual runbook and dry run), `Failover.tsx` (failover wizard, run panel, return to primary on the same or another platform) `Drills.tsx` (drill calendar, bubble DNS, reconciliation reports) and `DrillEvidence.tsx` (certification per application, measured RPO, drill reports with findings). |
| `src/products/mobility/` | Mobility: `data.ts` (VMware sources, inventory with migratability checks, waves, blackout periods, network flows, burn-down), `assess.ts` (scores, estimates, sizing and findings), `Overview.tsx`, `Sources.tsx`, `Assessment.tsx`, `Plans.tsx` (waves with change records, dependency map, calendar), `Profiles.tsx` (transformation profiles), `Validation.tsx` (checks after cutover), `Report.tsx` (the assessment written for an engineer, the CIO, the MSP team or sales), `Cutover.tsx` (go/no-go), `Protect.tsx` (backup and DR after commit), `Replication.tsx` (Servers tabs; replication, limits, orphan snapshots, rollback) and `Target.tsx` (the wave's capacity check and provisioning) `Project.tsx` (the migration project and the wave cutover runbook) and `Images.tsx` (disk image import, building a target from a backup, seed disks). |
| `src/screens/` | The product screens kept from the design export (Protection overview, Protected guests, Restore, Sites, Protected servers, Migration servers…). `AegisList` covers the simpler list screens. |
| `src/components/AegisTable.tsx` | The shared table used by every list: sorting, selection, the loading, empty, no-match and unreachable states, and the footer. |
| `src/data/` | Sample data. `platform.ts` holds the platform model (customers, partners, workloads, applications, users, roles, policies, approvals, audit and alerts), `ops.ts` holds agents, security findings, compliance mode, reviews and support, `admin.ts` identity providers, keys and platform health, `commercial.ts` usage, invoices and quotas, `integrations.ts` the integrations catalogue (kept in the store so dependent screens show connection state), and `aegis.ts` the product data. `coverage.ts` holds the Coverage rows, and `screens.ts` the screen catalogue and Part 7 rules. `spec.ts` holds the design-system specification. |
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
