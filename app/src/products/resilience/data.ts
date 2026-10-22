/* Resilience (DR) sample data on top of the platform model: replication per workload,
   recovery plans as runbooks, drills and readiness. Times are in the orchestrator's zone (IST). */
import { APPLICATIONS, T, WORKLOADS, type Tier, type Workload } from '../../data/platform';

/** Minutes in a duration such as "9 s", "27 min", "1 h 26 min" or "1 d". */
export function parseDur(s?: string | null): number | null {
  if (!s) return null;
  let m = 0;
  let hit = false;
  const add = (re: RegExp, k: number) => {
    const x = s.match(re);
    if (x) {
      m += +x[1] * k;
      hit = true;
    }
  };
  add(/(\d+)\s*d\b/, 1440);
  add(/(\d+)\s*h\b/, 60);
  add(/(\d+)\s*min\b/, 1);
  add(/(\d+)\s*s\b/, 1 / 60);
  return hit ? m : null;
}

export function fmtMin(m: number): string {
  if (m < 1) return `${Math.max(1, Math.round(m * 60))} s`;
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = Math.round(m % 60);
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.round((m % 1440) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export type RepMode = 'Continuous' | 'Scheduled' | 'Agent' | 'Recreated';
export const MODE_LABEL: Record<RepMode, string> = {
  Continuous: 'Continuous (write journal)',
  Scheduled: 'Scheduled (snapshot and changed blocks)',
  Agent: 'Agent (physical server)',
  Recreated: 'Recreated by the recovery plan'
};
export const MODE_TIP: Record<RepMode, string> = {
  Continuous: 'Every write is copied as it happens. RPO is seconds; uses the most bandwidth.',
  Scheduled: 'A snapshot is taken on a schedule and only changed blocks are copied.',
  Agent: 'An agent on the server sends changed blocks. Used for physical servers.',
  Recreated: 'Configuration objects (load balancers, DNS) are rebuilt by the plan, not copied.'
};

/** RPO and RTO a criticality tier asks for (Settings › Criticality). */
export const TIER_TARGET: Record<Tier, { rpo: string; rto: string; drill: string; drillDays: number } | null> = {
  'Mission Critical': { rpo: '15 min', rto: '1 h', drill: 'Monthly', drillDays: 31 },
  'Business Critical': { rpo: '1 h', rto: '4 h', drill: 'Quarterly', drillDays: 92 },
  Important: { rpo: '1 d', rto: '24 h', drill: 'Every six months', drillDays: 183 },
  Standard: null
};

export interface DrInfo {
  mode: RepMode;
  every?: string;
  dest: string;
  rto: string;
  /** Measured at the last drill. */
  rtoMeasured?: string;
  plan?: string;
  bandwidth?: string;
  /** Newest point age over the last 6 hours, one value every 30 min, in minutes. */
  lag?: number[];
}

/** Replication details for every workload Resilience covers, by workload id. */
export const DR_INFO: Record<string, DrInfo> = {
  sql01: { mode: 'Scheduled', every: '15 min', dest: 'Chennai-proxmox-prod', rto: '1 h', rtoMeasured: '38 min', plan: 'cbr', bandwidth: '120 Mbit/s', lag: [6, 9, 7, 12, 8, 7, 10, 6, 8, 11, 9, 7] },
  'sql01-cbsreport': { mode: 'Scheduled', every: '15 min · application-consistent (VSS)', dest: 'Chennai-proxmox-prod', rto: '1 h', rtoMeasured: '38 min', plan: 'cbr', lag: [6, 9, 7, 12, 8, 7, 10, 6, 8, 11, 9, 7] },
  'rpt-app-01': { mode: 'Scheduled', every: '1 h', dest: 'Chennai-proxmox-prod', rto: '4 h', rtoMeasured: '38 min', plan: 'cbr', lag: [31, 40, 12, 22, 35, 50, 14, 27, 41, 9, 18, 22] },
  'cbs-db-01': { mode: 'Continuous', dest: 'region-2-os', rto: '1 h', rtoMeasured: '41 min', plan: 'cbs', bandwidth: '400 Mbit/s reserved', lag: [0.1, 0.2, 0.1, 0.1, 0.3, 0.2, 0.1, 0.1, 0.2, 0.1, 0.2, 0.15] },
  'lb-cbs-prod': { mode: 'Recreated', dest: 'region-2-os', rto: '1 h', plan: 'cbs' },
  'dns-cbs': { mode: 'Recreated', dest: 'Infoblox mum-ipam', rto: '1 h', plan: 'cbs' },
  'mum-oracle-phy-01': { mode: 'Agent', every: '1 h', dest: 'production-openstack', rto: '4 h', rtoMeasured: '3 h 52 min', plan: 'trs', bandwidth: 'Throttled to 40 Mbit/s 09:00–19:00', lag: [44, 52, 61, 58, 66, 70, 74, 79, 81, 84, 85, 86] },
  'sql-prod-02': { mode: 'Scheduled', every: '15 min', dest: 'production-openstack', rto: '1 h', rtoMeasured: '18 min 40 s', plan: 'core', lag: [5, 7, 6, 9, 6, 8, 5, 7, 6, 8, 7, 6] },
  'erp-db-01': { mode: 'Scheduled', every: '15 min', dest: 'production-openstack', rto: '1 h', rtoMeasured: '18 min 40 s', plan: 'core', lag: [8, 11, 9, 14, 12, 16, 18, 21, 19, 24, 26, 27] },
  'erp-app-01': { mode: 'Scheduled', every: '15 min', dest: 'production-openstack', rto: '4 h', rtoMeasured: '18 min 40 s', plan: 'core', lag: [4, 6, 5, 7, 4, 6, 5, 7, 6, 5, 4, 4] },
  'ad-dc-01': { mode: 'Scheduled', every: '15 min', dest: 'production-openstack', rto: '1 h', rtoMeasured: '18 min 40 s', plan: 'core', lag: [8, 10, 9, 12, 40, 70, 100, 130, 160, 190, 205, 220] },
  'mail-gw-01': { mode: 'Scheduled', every: '15 min', dest: 'production-openstack', rto: '4 h', rtoMeasured: '18 min 40 s', plan: 'core', lag: [9, 12, 10, 14, 11, 9, 13, 10, 12, 11, 10, 11] },
  'file-srv-03': { mode: 'Scheduled', every: '1 d', dest: 'production-openstack', rto: '24 h', plan: 'web' },
  'web-frontend-01': { mode: 'Scheduled', every: '1 d', dest: 'production-openstack', rto: '24 h', rtoMeasured: '7 min 12 s', plan: 'web' },
  'web-frontend-02': { mode: 'Scheduled', every: '1 d', dest: 'production-openstack', rto: '24 h', rtoMeasured: '7 min 12 s', plan: 'web' },
  'gitlab-01': { mode: 'Scheduled', every: '1 d', dest: 'production-openstack', rto: '24 h', rtoMeasured: '7 min 12 s', plan: 'web' },
  'billing-api-02': { mode: 'Scheduled', every: '15 min', dest: 'region-2-os', rto: '4 h', plan: 'bill' },
  'kav-tally-01': { mode: 'Scheduled', every: '1 h', dest: 'production-openstack', rto: '4 h', rtoMeasured: '1 h 12 min', plan: 'kav', lag: [12, 25, 38, 51, 9, 22, 35, 48, 6, 19, 31, 18] },
  'kav-wms-db': { mode: 'Scheduled', every: '1 h', dest: 'production-openstack', rto: '4 h', rtoMeasured: '1 h 12 min', plan: 'kav', lag: [14, 27, 40, 53, 11, 24, 37, 50, 8, 21, 34, 31] }
};

/** Workloads Resilience covers in some way: replicated, recreated, or needing it by tier. */
export function drWorkloads(): Workload[] {
  return WORKLOADS.filter(w => w.dr.s !== 'na');
}

export type RpoState = 'within' | 'behind' | 'failed' | 'unreach' | 'online' | 'none';
export function rpoOf(w: Workload): { age: number | null; target: number | null; state: RpoState } {
  const target = parseDur(w.dr.target) ?? (TIER_TARGET[w.tier] ? parseDur(TIER_TARGET[w.tier]!.rpo) : null);
  const age = parseDur(w.dr.age);
  const s = w.dr.s;
  const state: RpoState = s === 'failed' ? 'failed' : s === 'unreach' ? 'unreach' : s === 'online' || s === 'returning' ? 'online' : s === 'none' ? 'none' : age != null && target != null && age > target ? 'behind' : 'within';
  return { age, target, state };
}

// ---- recovery plans as runbooks ----
export type StepKind = 'boot' | 'delay' | 'gate' | 'script' | 'manual' | 'dns' | 'lb';
export type GateCheck = 'Port' | 'HTTP' | 'Ping' | 'SQL query';
export type OnFail = 'Stop the run' | 'Ask a person' | 'Continue';
export interface RStep {
  id: string;
  kind: StepKind;
  w?: string;
  secs?: number;
  check?: GateCheck;
  target?: string;
  port?: number;
  expect?: string;
  timeout?: number;
  onFail?: OnFail;
  name?: string;
  lang?: 'PowerShell' | 'Bash';
  where?: 'Orchestrator' | 'Recovered server';
  body?: string;
  text?: string;
  who?: string;
  record?: string;
  value?: string;
  pool?: string;
}
export interface RStage {
  id: string;
  name: string;
  steps: RStep[];
}
export interface RVersion {
  v: number;
  when: string;
  by: string;
  note: string;
  diff: [string, string, string][];
}
export interface Runbook {
  id: string;
  name: string;
  customer: string;
  apps: string[];
  from: string;
  to: string;
  testNet: string;
  rtoTarget: string;
  approval: string;
  owner: string;
  version: number;
  versions: RVersion[];
  lastTest: { when: string; r: 'ok' | 'warn' | 'err'; dur: string; by: string } | null;
  lastFailover?: { when: string; kind: string; dur: string; by: string };
  nextDrill: string;
  validated: string | null;
  stages: RStage[];
}

let sid = 0;
const S = (kind: StepKind, x: Partial<RStep> = {}): RStep => ({ id: 's' + ++sid, kind, ...x });
const boot = (w: string) => S('boot', { w, timeout: 600, onFail: 'Stop the run' });
const gate = (check: GateCheck, target: string, x: Partial<RStep> = {}) => S('gate', { check, target, timeout: 120, onFail: 'Stop the run', ...x });
const wait = (secs: number) => S('delay', { secs });

export const RUNBOOKS: Runbook[] = [
  {
    id: 'core', name: 'Core services failover', customer: 'h360', apps: ['mail', 'erp'], from: 'Chennai-proxmox-prod', to: 'production-openstack', testNet: 'dr-test-isolated', rtoTarget: '1 h', approval: 'Every failover needs a Failover Approver', owner: 'Arun Kumar', version: 7,
    versions: [
      { v: 7, when: T('19 Oct', '11:20'), by: 'arun.kumar', note: 'Added a health gate on the ERP web front end', diff: [['Applications', '—', 'Gate: HTTP https://erp.host360.ai/health returns 200']] },
      { v: 6, when: T('18 Oct', '23:05'), by: 'priya.raman', note: 'After the 18 Oct drill: wait 60 s after the databases start', diff: [['Databases', 'No wait', 'Wait 60 s']] },
      { v: 5, when: T('02 Oct', '10:15'), by: 'arun.kumar', note: 'Moved mail-gw-01 to the Applications stage', diff: [['mail-gw-01', 'Stage 2 · Databases', 'Stage 3 · Applications']] },
      { v: 4, when: T('11 Sep', '16:40'), by: 'arun.kumar', note: 'Created from the Directory first template', diff: [] }
    ],
    lastTest: { when: T('18 Oct', '22:10'), r: 'ok', dur: '18 min 40 s', by: 'priya.raman' }, nextDrill: T('18 Nov', '22:00'), validated: T('21 Oct', '06:00'),
    stages: [
      { id: 'c1', name: 'Directory', steps: [boot('ad-dc-01'), gate('Port', '10.50.0.10', { port: 389 })] },
      { id: 'c2', name: 'Databases', steps: [boot('sql-prod-02'), boot('erp-db-01'), wait(60), gate('SQL query', 'sql-prod-02', { expect: 'SELECT 1 returns 1' }), S('script', { name: 'Point ERP at the recovered databases', lang: 'PowerShell', where: 'Orchestrator', body: "Set-ErpConnection -Server sql-prod-02.dr.host360.ai -Database ERP_PROD\nSet-ErpConnection -Server erp-db-01.dr.host360.ai -Database ERP_LEDGER", timeout: 300, onFail: 'Ask a person' })] },
      { id: 'c3', name: 'Applications', steps: [boot('erp-app-01'), boot('mail-gw-01'), gate('HTTP', 'https://erp.host360.ai/health', { expect: '200 OK' }), gate('Port', 'mail-gw-01', { port: 25, onFail: 'Ask a person' })] },
      { id: 'c4', name: 'Hand-over', steps: [S('dns', { record: 'erp.host360.ai', value: '10.50.0.31' }), S('manual', { text: 'Confirm with the ERP team that month-end jobs are paused, then tell the service desk the ERP runs at the recovery site.', who: 'ERP service owner (Arun Kumar)' })] }
    ]
  },
  {
    id: 'web', name: 'Web tier', customer: 'h360', apps: [], from: 'Chennai-proxmox-prod', to: 'production-openstack', testNet: 'dr-test-isolated', rtoTarget: '24 h', approval: 'Every failover needs a Failover Approver', owner: 'Meera Iyer', version: 3,
    versions: [
      { v: 3, when: T('12 Oct', '21:55'), by: 'meera.iyer', note: 'Added the load balancer step', diff: [['Front ends', '—', 'Update load balancer lb-storefront']] },
      { v: 2, when: T('20 Aug', '10:00'), by: 'meera.iyer', note: 'Added gitlab-01', diff: [['Tools', '—', 'Start gitlab-01']] },
      { v: 1, when: T('01 Jul', '09:30'), by: 'meera.iyer', note: 'Created from the Web tier behind a load balancer template', diff: [] }
    ],
    lastTest: { when: T('12 Oct', '21:30'), r: 'ok', dur: '7 min 12 s', by: 'meera.iyer' }, nextDrill: '12 Apr 2027, 21:30 IST', validated: T('21 Oct', '06:00'),
    stages: [
      { id: 'w1', name: 'Front ends', steps: [boot('web-frontend-01'), boot('web-frontend-02'), gate('HTTP', 'https://shop.host360.ai/health', { expect: '200 OK' }), S('lb', { pool: 'lb-storefront · pool web', value: 'web-frontend-01-dr, web-frontend-02-dr' })] },
      { id: 'w2', name: 'Tools', steps: [boot('gitlab-01'), gate('Port', 'gitlab-01', { port: 443, onFail: 'Continue' })] }
    ]
  },
  {
    id: 'bill', name: 'Billing', customer: 'h360', apps: [], from: 'production-openstack', to: 'region-2-os', testNet: 'test-isolated (region-2-os)', rtoTarget: '4 h', approval: 'Every failover needs a Failover Approver', owner: 'Arun Kumar', version: 1,
    versions: [{ v: 1, when: T('30 Jun', '11:20'), by: 'arun.kumar', note: 'Created', diff: [] }],
    lastTest: null, nextDrill: T('30 Sep', '22:00'), validated: null,
    stages: [{ id: 'b1', name: 'Billing API', steps: [boot('billing-api-02'), gate('Port', 'billing-api-02', { port: 8443 })] }]
  },
  {
    id: 'cbs', name: 'CBS failover', customer: 'mer', apps: ['cbs'], from: 'production-openstack', to: 'region-2-os', testNet: 'test-isolated (region-2-os)', rtoTarget: '1 h', approval: 'Every failover needs a Failover Approver', owner: 'Anitha Krishnan', version: 12,
    versions: [
      { v: 12, when: T('29 Sep', '09:10'), by: 'anitha.k@meridianbank.in', note: 'After the 28 Sep drill: DNS TTL lowered to 60 s before the switch', diff: [['Front door', 'TTL 300 s', 'TTL 60 s']] },
      { v: 11, when: T('01 Sep', '12:00'), by: 'anitha.k@meridianbank.in', note: 'Added payments-api', diff: [['Services', '—', 'Start payments-api']] }
    ],
    lastTest: { when: T('28 Sep', '22:00'), r: 'ok', dur: '41 min', by: 'anitha.k@meridianbank.in' }, nextDrill: T('28 Oct', '22:00'), validated: T('21 Oct', '06:00'),
    stages: [
      { id: 'k1', name: 'Database', steps: [boot('cbs-db-01'), gate('SQL query', 'cbs-db-01', { expect: 'Finacle health view returns OPEN' })] },
      { id: 'k2', name: 'Services', steps: [boot('payments-api'), gate('HTTP', 'https://upi.meridianbank.in/health', { expect: '200 OK' })] },
      { id: 'k3', name: 'Front door', steps: [S('lb', { pool: 'lb-cbs-prod · pool cbs', value: 'Recreated at region-2-os' }), S('dns', { record: 'cbs.meridianbank.in', value: '10.70.1.11' }), S('manual', { text: 'Tell NPCI and the branch network that core banking runs from the DR site.', who: 'CBS duty manager' })] }
    ]
  },
  {
    id: 'cbr', name: 'Core banking reporting failover', customer: 'mer', apps: ['cbr'], from: 'Chennai vCenter', to: 'Chennai-proxmox-prod', testNet: 'vmbr99 (VLAN 99, isolated)', rtoTarget: '1 h', approval: 'Every failover needs a Failover Approver', owner: 'Suresh Iyer', version: 4,
    versions: [{ v: 4, when: T('29 Sep', '10:00'), by: 's.iyer@meridianbank.in', note: 'Added the report service check', diff: [['Reports', '—', 'Gate: HTTP https://reports.meridianbank.in/ping']] }],
    lastTest: { when: T('28 Sep', '22:00'), r: 'ok', dur: '38 min', by: 's.iyer@meridianbank.in' }, nextDrill: T('28 Oct', '22:00'), validated: T('21 Oct', '06:00'),
    stages: [
      { id: 'r1', name: 'Database', steps: [boot('sql01'), gate('SQL query', 'SQL01\\CBSREPORT', { expect: 'SELECT 1 returns 1' })] },
      { id: 'r2', name: 'Reports', steps: [boot('rpt-app-01'), gate('HTTP', 'https://reports.meridianbank.in/ping', { expect: '200 OK' })] }
    ]
  },
  {
    id: 'trs', name: 'Treasury failover', customer: 'mer', apps: ['trs'], from: 'Mumbai DC2', to: 'production-openstack', testNet: 'dr-test-isolated', rtoTarget: '4 h', approval: 'Every failover needs a Failover Approver', owner: 'Rohit Shenoy', version: 3,
    versions: [{ v: 3, when: T('15 Aug', '10:30'), by: 'rohit.s@meridianbank.in', note: 'After the 14 Aug drill: Oracle listener check added', diff: [['Dealing system', '—', 'Gate: port 1521 on mum-oracle-phy-01']] }],
    lastTest: { when: T('14 Aug', '21:00'), r: 'warn', dur: '3 h 52 min', by: 'rohit.s@meridianbank.in' }, nextDrill: T('14 Nov', '21:00'), validated: T('21 Oct', '06:00'),
    stages: [
      { id: 't1', name: 'Dealing system', steps: [boot('mum-oracle-phy-01'), gate('Port', 'mum-oracle-phy-01', { port: 1521 })] },
      { id: 't2', name: 'File store', steps: [boot('fs-mum-01'), S('manual', { text: 'Check the treasury deal tickets folder opens from a dealer desk.', who: 'Treasury operations' })] }
    ]
  },
  {
    id: 'kav', name: 'Kaveri finance', customer: 'kav', apps: [], from: 'Chennai-proxmox-prod', to: 'production-openstack', testNet: 'dr-test-isolated', rtoTarget: '4 h', approval: 'Every failover needs a Failover Approver', owner: 'Rahul Menon', version: 2,
    versions: [{ v: 2, when: T('05 Sep', '15:00'), by: 'rahul@kaveri-logistics.in', note: 'Created from the Database first template', diff: [] }],
    lastTest: { when: T('06 Sep', '20:00'), r: 'ok', dur: '1 h 12 min', by: 'rahul@kaveri-logistics.in' }, nextDrill: T('06 Dec', '20:00'), validated: T('21 Oct', '06:00'),
    stages: [
      { id: 'v1', name: 'Database', steps: [boot('kav-wms-db'), gate('SQL query', 'kav-wms-db', { expect: 'SELECT 1 returns 1' })] },
      { id: 'v2', name: 'Applications', steps: [boot('kav-tally-01'), gate('Port', 'kav-tally-01', { port: 9000 })] }
    ]
  }
];

export const RUNBOOK_TEMPLATES: { id: string; name: string; note: string; stages: string[] }[] = [
  { id: 'three', name: 'Three-tier application', note: 'Database, then application servers, then the front door and DNS.', stages: ['Database', 'Application', 'Front door'] },
  { id: 'dir', name: 'Directory first', note: 'Domain controllers start and answer before anything else.', stages: ['Directory', 'Databases', 'Applications', 'Hand-over'] },
  { id: 'db', name: 'Database first', note: 'Databases start and pass a query check before the apps.', stages: ['Database', 'Applications'] },
  { id: 'lb', name: 'Web tier behind a load balancer', note: 'Web servers start together, then the pool is switched.', stages: ['Front ends', 'Load balancer'] },
  { id: 'empty', name: 'Empty plan', note: 'One empty stage. Add servers and checks yourself.', stages: ['Stage 1'] }
];

export const wl = (id?: string) => WORKLOADS.find(w => w.id === id);
export const appsOf = (rb: Runbook) => APPLICATIONS.filter(a => rb.apps.includes(a.id));
export const serversOf = (rb: Runbook) => rb.stages.flatMap(s => s.steps.filter(x => x.kind === 'boot').map(x => x.w!));

/** Milliseconds for an orchestrator time such as "21 Oct 2026, 16:05 IST". */
export const toMs = (t: string) => Date.parse(t.replace(' IST', '').replace(/(\d+) (\w+) (\d+),/, '$2 $1 $3'));
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / 864e5);

export type Check = { id: string; label: string; obj: string; result: string; state: 'pass' | 'warn' | 'block' | 'unread'; weight: number; step?: string; credit?: number };

/** The readiness checks a plan is scored on. Unreadable sites stop the check rather than pass it. */
export function readiness(rb: Runbook, now = T('21 Oct', '16:05')): { checks: Check[]; score: number | null } {
  const unreachTo = rb.to === 'region-2-os';
  if (unreachTo)
    return {
      score: null,
      checks: [{ id: 'site', label: 'Recovery site answers', obj: rb.to, result: 'Could not be read: region-2-os did not answer within 30 s. Nothing else was checked.', state: 'unread', weight: 1 }]
    };
  const checks: Check[] = [];
  rb.stages.forEach(st =>
    st.steps.forEach(x => {
      if (x.kind !== 'boot') return;
      const w = wl(x.w);
      if (!w) return;
      const r = rpoOf(w);
      const info = DR_INFO[w.id];
      if (!info) {
        checks.push({ id: 'rep-' + w.id, label: 'Replicated', obj: w.name, result: 'Not replicated. The plan cannot start it at the recovery site.', state: 'block', weight: 3, step: x.id });
        return;
      }
      if (r.state === 'failed') checks.push({ id: 'rpo-' + w.id, label: 'Newest point within target', obj: w.name, result: `Last sync failed; newest point is ${w.dr.age} old (target ${w.dr.target})`, state: 'warn', weight: 2, step: x.id, credit: 0 });
      else if (r.state === 'behind') checks.push({ id: 'rpo-' + w.id, label: 'Newest point within target', obj: w.name, result: `${w.dr.age} old, target ${w.dr.target}`, state: 'warn', weight: 2, step: x.id });
      else checks.push({ id: 'rpo-' + w.id, label: 'Newest point within target', obj: w.name, result: `${w.dr.age} old, target ${w.dr.target}`, state: 'pass', weight: 2, step: x.id });
    })
  );
  const days = rb.lastTest ? daysBetween(rb.lastTest.when, now) : null;
  const tier = appsOf(rb)[0]?.tier || wl(serversOf(rb)[0])?.tier || 'Important';
  const cadence = TIER_TARGET[tier]?.drillDays || 183;
  checks.push(
    rb.lastTest == null
      ? { id: 'drill', label: 'Tested within the drill cadence', obj: rb.name, result: 'Never tested', state: 'warn', weight: 2 }
      : days! > cadence
        ? { id: 'drill', label: 'Tested within the drill cadence', obj: rb.name, result: `Last test ${days} days ago; ${tier} plans are tested ${TIER_TARGET[tier]?.drill.toLowerCase()}`, state: 'warn', weight: 2 }
        : { id: 'drill', label: 'Tested within the drill cadence', obj: rb.name, result: `Last test ${days} days ago, ${rb.lastTest.r === 'ok' ? 'passed' : 'passed with warnings'} in ${rb.lastTest.dur}`, state: rb.lastTest.r === 'ok' ? 'pass' : 'warn', weight: 2 }
  );
  checks.push(
    { id: 'map', label: 'Mapping complete', obj: `${rb.from} → ${rb.to}`, result: 'Networks, storage and sizes are mapped for every server', state: 'pass', weight: 1 },
    { id: 'net', label: 'Test network isolated', obj: rb.testNet, result: 'No router and no route to production', state: 'pass', weight: 1 },
    { id: 'quota', label: 'Capacity at the recovery site', obj: rb.to, result: `Needs ${serversOf(rb).length * 8} vCPU and ${serversOf(rb).length * 32} GB; 96 vCPU and 512 GB free`, state: 'pass', weight: 1 },
    { id: 'cred', label: 'Credentials valid', obj: rb.to, result: 'Signed in at 06:00 IST', state: 'pass', weight: 1 },
    { id: 'appr', label: 'Approvers available', obj: rb.approval, result: rb.customer === 'h360' ? '2 people can approve: Priya Raman, Arun Kumar' : rb.customer === 'mer' ? '2 people can approve: Anitha Krishnan, Suresh Iyer' : '1 person can approve: Rahul Menon', state: 'pass', weight: 1 }
  );
  const total = checks.reduce((a, c) => a + c.weight, 0);
  const got = checks.reduce((a, c) => a + (c.credit ?? (c.state === 'pass' ? c.weight : c.state === 'warn' ? c.weight * 0.4 : 0)), 0);
  const blocked = checks.some(c => c.state === 'block');
  return { checks, score: Math.round((got / total) * 100) - (blocked ? 15 : 0) };
}

export interface Drill {
  id: string;
  plan: string;
  when: string;
  kind: 'Test failover' | 'Planned failover' | 'Unplanned failover';
  r: 'ok' | 'warn' | 'err';
  dur: string;
  rtoMet: boolean;
  by: string;
  evidence: string;
}
export const DRILLS: Drill[] = [
  { id: 'd9', plan: 'core', when: T('18 Oct', '22:10'), kind: 'Test failover', r: 'ok', dur: '18 min 40 s', rtoMet: true, by: 'priya.raman', evidence: 'DRL-0918 · evidence pack with timings and screenshots' },
  { id: 'd8', plan: 'web', when: T('12 Oct', '21:30'), kind: 'Test failover', r: 'ok', dur: '7 min 12 s', rtoMet: true, by: 'meera.iyer', evidence: 'DRL-0912' },
  { id: 'd7', plan: 'cbs', when: T('28 Sep', '22:00'), kind: 'Test failover', r: 'ok', dur: '41 min', rtoMet: true, by: 'anitha.k@meridianbank.in', evidence: 'DRL-0928 · filed with the RBI quarterly return' },
  { id: 'd6', plan: 'cbr', when: T('28 Sep', '22:00'), kind: 'Test failover', r: 'ok', dur: '38 min', rtoMet: true, by: 's.iyer@meridianbank.in', evidence: 'DRL-0929' },
  { id: 'd5', plan: 'kav', when: T('06 Sep', '20:00'), kind: 'Test failover', r: 'ok', dur: '1 h 12 min', rtoMet: true, by: 'rahul@kaveri-logistics.in', evidence: 'DRL-0906' },
  { id: 'd4', plan: 'trs', when: T('14 Aug', '21:00'), kind: 'Test failover', r: 'warn', dur: '3 h 52 min', rtoMet: true, by: 'rohit.s@meridianbank.in', evidence: 'DRL-0814 · listener needed a manual restart' },
  { id: 'd3', plan: 'core', when: T('04 Oct', '21:00'), kind: 'Test failover', r: 'warn', dur: '24 min 02 s', rtoMet: true, by: 'arun.kumar', evidence: 'DRL-0904' },
  { id: 'd2', plan: 'web', when: T('20 Jul', '02:10'), kind: 'Unplanned failover', r: 'ok', dur: '11 min 30 s', rtoMet: true, by: 'meera.iyer', evidence: 'INC-19877 · Chennai rack B power loss' }
];
