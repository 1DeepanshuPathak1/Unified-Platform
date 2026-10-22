/** The screen catalogue shown on the Handoff page: what each screen reads, does, and which states it has. */
export interface ScreenSpec {
  name: string;
  route: string;
  level: 'Platform' | 'Product' | 'Shell';
  reads: string;
  actions: string;
  states: string;
  prio: string;
}

/** Shorthand for the five list states defined in the rules. */
const LIST = 'All list states';

export const SCREENS: ScreenSpec[] = [
  { name: 'Header and navigation', route: '—', level: 'Shell', reads: 'User, Tenant/Customer, Job, Alert/Event', actions: 'Switch product, search (Ctrl K), open running jobs, acknowledge alerts, pick tenant or project, change theme, open account, sign out', states: 'Provider · acting as a customer owner (banner) · signed out', prio: 'P0' },
  { name: 'Inbox', route: 'inbox', level: 'Platform', reads: 'Approval, Job, Alert/Event, Licence/Entitlement, Application, Workload', actions: 'Review an approval, retry a failed job, open the object, dismiss (with undo)', states: 'Live · Reading… · Empty ("Nothing needs you right now") · Could not be read', prio: 'P0' },
  { name: 'Search results', route: 'search/<text>', level: 'Platform', reads: 'Every indexed object', actions: 'Open any result; jump from the best match to restore, Resilience, Mobility or alerts', states: 'Results · best match · no matches · Could not be read', prio: 'P0' },
  { name: 'Workloads', route: 'workloads', level: 'Platform', reads: 'Workload', actions: 'Scan for changes, set criticality (bulk), back up now, restore, open in Resilience, export', states: LIST, prio: 'P0' },
  { name: 'Applications', route: 'applications', level: 'Platform', reads: 'Application, Workload', actions: 'Create, edit, back up together, test failover or create a recovery plan', states: LIST, prio: 'P0' },
  { name: 'Customers', route: 'customers', level: 'Platform', reads: 'Tenant/Customer, Partner, Organisation', actions: 'Onboard (wizard), log in as owner, convert trial, suspend, reactivate, archive (with approval), add department or project', states: `${LIST} · provider only`, prio: 'P0' },
  { name: 'Alerts & Activity › Alerts', route: 'activity/alerts', level: 'Platform', reads: 'Alert/Event', actions: 'Acknowledge, assign, escalate, suppress (bulk and single)', states: `${LIST} · incident bar when alerts are correlated`, prio: 'P0' },
  { name: 'Alerts & Activity › Alert rules', route: 'activity/rules', level: 'Platform', reads: 'Alert/Event rule', actions: 'Add, edit, switch off (predefined conditions are fixed)', states: LIST, prio: 'P0' },
  { name: 'Alerts & Activity › Maintenance windows', route: 'activity/maintenance', level: 'Platform', reads: 'Maintenance window', actions: 'Schedule a window (time zone named)', states: LIST, prio: 'P1' },
  { name: 'Alerts & Activity › Jobs', route: 'activity/jobs', level: 'Platform', reads: 'Job', actions: 'Pause, resume, cancel, retry, change priority, edit slot and bandwidth limits', states: `${LIST} · queue, history and limits views · live log`, prio: 'P0' },
  { name: 'Alerts & Activity › Audit log', route: 'activity/audit', level: 'Platform', reads: 'Audit record', actions: 'Filter, save a filter, export, set SIEM streaming and archive', states: LIST, prio: 'P0' },
  { name: 'Automation › Policies', route: 'automation/policies', level: 'Platform', reads: 'Policy', actions: 'Create (residency checked at save), edit, duplicate, reapply to drifted workloads, compare and restore versions', states: `${LIST} · refusal at save`, prio: 'P0' },
  { name: 'Automation › Approvals', route: 'automation/approvals', level: 'Platform', reads: 'Approval', actions: 'Approve or reject (step-up for destructive kinds), cancel your own request', states: LIST, prio: 'P0' },
  { name: 'Automation › Approval rules', route: 'automation/rules', level: 'Platform', reads: 'Approval rule', actions: 'Add, edit (mandatory rules are read-only)', states: LIST, prio: 'P0' },
  { name: 'Settings › People', route: 'settings/users', level: 'Platform', reads: 'User', actions: 'Invite, edit roles, unlock, resend invitation, reset MFA, sign out sessions, deactivate, reactivate, delete (soft)', states: LIST, prio: 'P0' },
  { name: 'Settings › Roles', route: 'settings/roles', level: 'Platform', reads: 'Role', actions: 'Create a custom role, copy a template, edit, delete, simulate "what can this person do?"', states: LIST, prio: 'P0' },
  { name: 'Settings › Sign-in and MFA', route: 'settings/signin', level: 'Platform', reads: 'Policy (sign-in), User', actions: 'Set MFA enforcement and methods, step-up actions, password and lock-out rules, session limits; preview the challenge', states: 'Saved · unsaved changes', prio: 'P0' },
  { name: 'Settings › Credential vault', route: 'settings/vault', level: 'Platform', reads: 'Infrastructure connection', actions: 'Rotate now (step-up), set rotation, copy least-privilege script', states: `${LIST} · site unreachable`, prio: 'P0' },
  { name: 'Billing & Licensing › Entitlements', route: 'billing/entitlements', level: 'Platform', reads: 'Licence/Entitlement', actions: 'Renew or change, convert or extend a trial, activate offline, suspend, reactivate, check now', states: `${LIST} · fail-open notice`, prio: 'P0' },
  { name: 'Sites', route: 'sites', level: 'Platform', reads: 'Infrastructure connection', actions: 'Add a platform (wizard with three Proxmox access methods and fingerprint), refresh, edit access, remove', states: LIST, prio: 'P0' },
  { name: 'Nodes and proxies', route: 'nodes', level: 'Platform', reads: 'Agent', actions: 'Open, update', states: LIST, prio: 'P0' },
  { name: 'Repositories', route: 'repos', level: 'Platform', reads: 'Repository', actions: 'Add, open, check immutability', states: LIST, prio: 'P0' },
  { name: 'Mappings', route: 'mappings', level: 'Platform', reads: 'Mapping', actions: 'Edit network, storage and size mappings', states: LIST, prio: 'P0' },
  { name: 'Reports', route: 'reports', level: 'Platform', reads: 'Report/Evidence', actions: 'Open, run now, schedule', states: LIST, prio: 'P1' },
  { name: 'Protection › Overview', route: 'backup/overview', level: 'Product', reads: 'Job, Repository, Workload', actions: 'Open jobs, repositories and issues', states: 'Live · Reading… · Empty · Could not be read', prio: 'P0' },
  { name: 'Protection › Protected guests', route: 'backup/guests', level: 'Product', reads: 'Workload, Recovery point', actions: 'Back up now, restore, assign policy, change disks and consistency', states: LIST, prio: 'P0' },
  { name: 'Protection › Policies', route: 'backup/policies', level: 'Product', reads: 'Policy (Backup)', actions: 'As Automation › Policies, filtered to Backup', states: LIST, prio: 'P0' },
  { name: 'Protection › Restore', route: 'backup/restore', level: 'Product', reads: 'Recovery point, Workload', actions: 'Restore a whole VM, disks or files; request an exception', states: 'Steps · running with live log', prio: 'P0' },
  { name: 'Protection › Backup copies', route: 'backup/copies', level: 'Product', reads: 'Policy, Repository', actions: 'Create, run, open', states: LIST, prio: 'P0' },
  { name: 'Resilience › Overview', route: 'dr/overview', level: 'Product', reads: 'Workload, Recovery point', actions: 'Open plans and issues', states: 'Live · Reading… · Empty · Could not be read', prio: 'P0' },
  { name: 'Resilience › Protected servers', route: 'dr/servers', level: 'Product', reads: 'Workload, Recovery point', actions: 'Bring online, return to primary, sync now, remove', states: LIST, prio: 'P0' },
  { name: 'Resilience › Protection plans', route: 'dr/plans', level: 'Product', reads: 'Policy (DR)', actions: 'Create (wizard), edit', states: LIST, prio: 'P0' },
  { name: 'Resilience › Recovery plans', route: 'dr/recovery', level: 'Product', reads: 'Workflow/Runbook', actions: 'Edit steps, test, fail over', states: LIST, prio: 'P0' },
  { name: 'Resilience › History', route: 'dr/history', level: 'Product', reads: 'Job', actions: 'Open a cycle', states: LIST, prio: 'P0' },
  { name: 'Mobility › Overview', route: 'mig/overview', level: 'Product', reads: 'Workload, Job', actions: 'Open servers and waves', states: 'Live · Reading… · Empty · Could not be read', prio: 'P0' },
  { name: 'Mobility › Servers', route: 'mig/servers', level: 'Product', reads: 'Workload, Job', actions: 'Migrate, sync, test boot, cut over, commit, roll back', states: LIST, prio: 'P0' },
  { name: 'Mobility › Migration plans', route: 'mig/plans', level: 'Product', reads: 'Workflow/Runbook', actions: 'Create a wave, open', states: LIST, prio: 'P1' },
  { name: 'Coverage', route: '#/coverage', level: 'Shell', reads: 'Coverage of the brief', actions: 'Filter by status, priority and part', states: 'All items · changed this turn', prio: 'P0' }
];

/** Part 7: rules every screen follows. */
export const RULES: [string, string][] = [
  ['List states', 'Every list has loading ("Reading…" with 8 skeleton rows), empty (one sentence and one primary action), error, and "Could not be read: <reason>" when something is unreachable. Never show an unreachable thing as empty, zero, "never" or "online".'],
  ['Icons with fixed meaning', 'A shield always means encryption. A padlock always means immutability. Neither is used for anything else.'],
  ['Time', 'Times are in the orchestrator’s time zone with the zone named (21 Oct 2026, 16:05 IST). Customer-facing schedules also show the customer’s own zone.'],
  ['Explanations', 'At most two info icons per view. Explanations go in their tooltips, not in paragraphs.'],
  ['Drawers', 'Kicker, title, status line, action row, sub-tabs. Edit in a dialog, list in the drawer. One-line rows. Tiles only on a drawer’s Overview tab.'],
  ['Long-running actions', 'Show the live log in the drawer that started them, and keep running if the drawer closes; the running-jobs tray in the header follows them.'],
  ['Destructive and irreversible actions', 'Confirmation is armed inside the same dialog (never a dialog opened from another dialog), with the exact list of what will be removed, the name typed to confirm, step-up MFA, and approval where policy requires it.'],
  ['Tables', 'Never wrap names, badges or buttons; truncate with a tooltip. Numbers are right-aligned with units. Tables fit 1440 px without a horizontal scroll; secondary columns move into the drawer.'],
  ['Bars, plurals and toasts', 'Amber warning bar, red danger bar. Correct plurals (1 workload, 2 workloads). Short toasts that name the object ("Backup started for SQL01").'],
  ['Sample data', 'Realistic and consistent: sites Chennai-proxmox-prod, Chennai_Lab_Proxmox, production-openstack, region-2-os; a vCenter at 172.25.10.177; repositories obj-check and repo-director-lab. No lorem ipsum.'],
  ['Disabled actions', 'Stay visible at 45 % opacity with aria-disabled, and say in their tooltip what is missing or which role is needed.'],
  ['Platform objects', 'Every screen states the platform object it reads, its actions, its states, its priority and whether it is platform-level or product-level (catalogue below).']
];
