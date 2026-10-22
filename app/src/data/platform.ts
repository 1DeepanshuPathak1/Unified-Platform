/* Host360 Aegis Unified Platform — sample data for the platform layer (identity, tenancy, workloads,
   applications, policies, approvals, licensing). Times are in the orchestrator's zone (IST). */

export const T = (d: string, hm: string) => `${d} 2026, ${hm} IST`;
export const ORCH_TZ = 'India Standard Time (UTC+05:30)';

// ---- criticality ----
export type Tier = 'Mission Critical' | 'Business Critical' | 'Important' | 'Standard';
export const TIERS: Tier[] = ['Mission Critical', 'Business Critical', 'Important', 'Standard'];
export const TIER_SHORT: Record<Tier, string> = { 'Mission Critical': 'Tier 0', 'Business Critical': 'Tier 1', Important: 'Tier 2', Standard: 'Tier 3' };
/** What setting a tier drives. Set once on a workload or application. */
export const TIER_RULES: Record<Tier, { backup: string; dr: string; drill: string; escalation: string }> = {
  'Mission Critical': { backup: 'Database hourly · immutable 30 d · offsite copy', dr: 'RPO 15 min · RTO 1 h (Business-critical plan)', drill: 'Monthly', escalation: 'Page on-call at once (PagerDuty), then the customer owner after 15 min' },
  'Business Critical': { backup: 'Production daily · immutable 14 d · offsite copy', dr: 'RPO 1 h · RTO 4 h', drill: 'Quarterly', escalation: 'Teams and e-mail within 15 min' },
  Important: { backup: 'Production daily · 14 daily points', dr: 'RPO 1 d · RTO 24 h (Non-critical plan)', drill: 'Every six months', escalation: 'E-mail to the owner' },
  Standard: { backup: 'Lab weekly · 4 weekly points', dr: 'Not required', drill: 'Not required', escalation: 'Daily digest' }
};

// ---- tenancy ----
export type ProductName = 'Protection' | 'Resilience' | 'Mobility';
export type CustomerStatus = 'active' | 'trial' | 'suspended' | 'archived' | 'onboarding';

export interface Department {
  name: string;
  kind: 'Department' | 'Site';
  tz?: string;
  projects: { name: string; isolation: 'Dedicated' | 'Shared'; workloads: number; repos: string[] }[];
}
export interface Customer {
  id: string;
  name: string;
  kind: 'Internal' | 'Direct' | 'Through partner';
  partner?: string;
  country: string;
  city: string;
  tz: string;
  plan: string;
  products: ProductName[];
  status: CustomerStatus;
  statusNote?: string;
  owner: string;
  ownerEmail: string;
  since: string;
  users: number;
  workloads: number;
  storedTB: number;
  residency: string;
  frameworks: string[];
  whiteLabel?: string;
  mrr: number;
  readiness: number;
  openAlerts: number;
  departments: Department[];
}

export const PARTNERS = [{ id: 'cloudnest', name: 'CloudNest IT Services', since: T('11 Feb', '10:00'), customers: ['sah', 'nil'], api: 'Host360 Partner Portal (API v2)', margin: '18 %' }];

export const CUSTOMERS: Customer[] = [
  {
    id: 'h360', name: 'Host360 Managed Services', kind: 'Internal', country: 'India', city: 'Chennai', tz: 'Asia/Kolkata (IST)', plan: 'Enterprise bundle', products: ['Protection', 'Resilience', 'Mobility'],
    status: 'active', owner: 'Priya Raman', ownerEmail: 'priya.raman@host360.ai', since: T('18 Jan', '09:20'), users: 6, workloads: 58, storedTB: 0.91, residency: 'India only', frameworks: ['DPDP', 'ISO 27001'], mrr: 0, readiness: 82, openAlerts: 7,
    departments: [{ name: 'Shared services', kind: 'Department', projects: [{ name: 'Base-Project', isolation: 'Shared', workloads: 58, repos: ['obj-check', 'repo-director-lab', 'copy-check-repo', 'test-repo'] }] }]
  },
  {
    id: 'mer', name: 'Meridian Cooperative Bank', kind: 'Direct', country: 'India', city: 'Mumbai', tz: 'Asia/Kolkata (IST)', plan: 'Enterprise bundle', products: ['Protection', 'Resilience', 'Mobility'],
    status: 'active', owner: 'Anitha Krishnan', ownerEmail: 'anitha.k@meridianbank.in', since: T('03 Mar', '11:40'), users: 14, workloads: 41, storedTB: 18.6, residency: 'India only (RBI data localisation)', frameworks: ['RBI', 'DPDP', 'ISO 22301'], mrr: 1184000, readiness: 74, openAlerts: 3,
    departments: [
      { name: 'Core Banking', kind: 'Department', projects: [{ name: 'Meridian-CBS', isolation: 'Dedicated', workloads: 17, repos: ['mer-obj-immutable'] }] },
      { name: 'Treasury', kind: 'Department', projects: [{ name: 'Meridian-Treasury', isolation: 'Dedicated', workloads: 9, repos: ['mer-obj-immutable'] }] },
      { name: 'IT Modernisation', kind: 'Department', projects: [{ name: 'Meridian-Migration', isolation: 'Dedicated', workloads: 15, repos: ['mer-staging-nfs'] }] }
    ]
  },
  {
    id: 'kav', name: 'Kaveri Logistics Pvt Ltd', kind: 'Direct', country: 'India', city: 'Chennai', tz: 'Asia/Kolkata (IST)', plan: 'Business · Protection and Resilience', products: ['Protection', 'Resilience'],
    status: 'active', owner: 'Rahul Menon', ownerEmail: 'rahul@kaveri-logistics.in', since: T('27 May', '15:05'), users: 3, workloads: 24, storedTB: 4.2, residency: 'India only', frameworks: ['DPDP'], mrr: 212400, readiness: 91, openAlerts: 0,
    departments: [
      { name: 'Finance', kind: 'Department', projects: [{ name: 'Tenant-Kaveri', isolation: 'Dedicated', workloads: 11, repos: ['kav-repo-01'] }] },
      { name: 'Ennore warehouse', kind: 'Site', tz: 'Asia/Kolkata (IST)', projects: [{ name: 'Kaveri-WMS', isolation: 'Dedicated', workloads: 13, repos: ['kav-repo-01'] }] }
    ]
  },
  {
    id: 'sah', name: 'Sahyadri Hospitals', kind: 'Through partner', partner: 'CloudNest IT Services', country: 'India', city: 'Pune', tz: 'Asia/Kolkata (IST)', plan: 'Business · Protection', products: ['Protection'],
    status: 'active', owner: 'Dr Vikram Joshi', ownerEmail: 'v.joshi@sahyadrihospitals.in', since: T('14 Jul', '12:30'), users: 5, workloads: 18, storedTB: 6.8, residency: 'India only', frameworks: ['DPDP', 'NABH'], whiteLabel: 'CloudNest Resilience', mrr: 168000, readiness: 68, openAlerts: 2,
    departments: [{ name: 'Clinical systems', kind: 'Department', projects: [{ name: 'Sahyadri-HIS', isolation: 'Dedicated', workloads: 18, repos: ['sah-obj-01'] }] }]
  },
  {
    id: 'atl', name: 'Atlas Freight GmbH', kind: 'Direct', country: 'Germany', city: 'Frankfurt', tz: 'Europe/Berlin (CET)', plan: 'Business · Mobility and Protection', products: ['Protection', 'Mobility'],
    status: 'onboarding', statusNote: 'Metering starts 01 Nov 2026', owner: 'Jonas Weber', ownerEmail: 'j.weber@atlas-freight.de', since: T('16 Oct', '13:10'), users: 2, workloads: 0, storedTB: 0, residency: 'European Union only (GDPR)', frameworks: ['GDPR'], mrr: 0, readiness: 0, openAlerts: 0,
    departments: [{ name: 'Frankfurt HQ', kind: 'Site', tz: 'Europe/Berlin (CET)', projects: [{ name: 'Atlas-Migration', isolation: 'Dedicated', workloads: 0, repos: [] }] }]
  },
  {
    id: 'nil', name: 'Nilgiri Retail', kind: 'Through partner', partner: 'CloudNest IT Services', country: 'India', city: 'Coimbatore', tz: 'Asia/Kolkata (IST)', plan: 'Trial · Protection', products: ['Protection'],
    status: 'trial', statusNote: 'Trial ends 04 Nov 2026', owner: 'Sneha Pillai', ownerEmail: 'sneha@nilgiriretail.in', since: T('05 Oct', '17:45'), users: 1, workloads: 6, storedTB: 0.3, residency: 'India only', frameworks: ['DPDP'], mrr: 0, readiness: 50, openAlerts: 0,
    departments: [{ name: 'Head office', kind: 'Site', projects: [{ name: 'Nilgiri-POS', isolation: 'Shared', workloads: 6, repos: ['trial-shared-obj'] }] }]
  },
  {
    id: 'cor', name: 'Coromandel Insurance', kind: 'Direct', country: 'India', city: 'Chennai', tz: 'Asia/Kolkata (IST)', plan: 'Business · Protection', products: ['Protection'],
    status: 'suspended', statusNote: 'Invoice INV-2026-0817 overdue 45 days', owner: 'Lakshmi Narayanan', ownerEmail: 'lakshmi.n@coromandelins.in', since: T('09 Apr', '10:15'), users: 4, workloads: 12, storedTB: 3.1, residency: 'India only', frameworks: ['IRDAI', 'DPDP'], mrr: 96000, readiness: 0, openAlerts: 1,
    departments: [{ name: 'Head office', kind: 'Site', projects: [{ name: 'Coromandel-Prod', isolation: 'Dedicated', workloads: 12, repos: ['cor-repo'] }] }]
  }
];
export const customerById = (id: string) => CUSTOMERS.find(c => c.id === id)!;
export const customerOfProject = (p: string) => CUSTOMERS.find(c => c.departments.some(d => d.projects.some(x => x.name === p)));

// ---- workloads ----
export type WType = 'VM' | 'Physical server' | 'Database' | 'Kubernetes workload' | 'Cloud instance' | 'Endpoint' | 'File share' | 'Load balancer' | 'DNS record';
export const W_TYPES: WType[] = ['VM', 'Physical server', 'Database', 'Kubernetes workload', 'Cloud instance', 'Endpoint', 'File share', 'Load balancer', 'DNS record'];
export const W_ICON: Record<WType, string> = { VM: 'monitor', 'Physical server': 'server', Database: 'database', 'Kubernetes workload': 'box', 'Cloud instance': 'cloud', Endpoint: 'monitor', 'File share': 'folder', 'Load balancer': 'network', 'DNS record': 'route' };

export type BState = 'protected' | 'warn' | 'failed' | 'running' | 'none' | 'na';
export type DState = 'protected' | 'behind' | 'syncing' | 'failed' | 'online' | 'returning' | 'unreach' | 'none' | 'na';
export type MState = 'source' | 'assessed' | 'planned' | 'syncing' | 'testing' | 'ready' | 'cutover' | 'committed' | 'rolledback' | 'blocked' | 'na';
export type Stage = 'Discovered' | 'Assessed' | 'Migrated' | 'Protected' | 'Replicated' | 'Tested' | 'Restored' | 'Retired';

export interface Workload {
  id: string;
  name: string;
  type: WType;
  os: string;
  customer: string;
  project: string;
  site: string;
  env: 'Production' | 'Staging' | 'Test' | 'DR';
  tier: Tier;
  owner: string;
  app?: string;
  tags: string[];
  backup: { s: BState; policy?: string; last?: string; points?: number; note?: string };
  dr: { s: DState; plan?: string; target?: string; age?: string; note?: string };
  mig: { s: MState; wave?: string; next?: string; note?: string };
  alerts: number;
  sizeGB: number;
  cpu?: string;
  mem?: string;
  ip?: string;
  classification: 'Critical' | 'Confidential' | 'Non-critical' | 'Standard' | 'Archive';
  sensitive?: boolean;
  lifecycle: { stage: Stage; when: string; note: string }[];
  deps?: string[];
}

const L = (...x: [Stage, string, string][]) => x.map(([stage, when, note]) => ({ stage, when, note }));
const disc = (d = '12 Mar', site = 'Chennai-proxmox-prod') => ['Discovered', T(d, '10:44'), `Found by the agentless scan of ${site}`] as [Stage, string, string];

export const WORKLOADS: Workload[] = [
  {
    id: 'sql01', name: 'SQL01', type: 'VM', os: 'Windows Server 2019', customer: 'mer', project: 'Meridian-Migration', site: 'Chennai vCenter', env: 'Production', tier: 'Mission Critical', owner: 'Suresh Iyer', app: 'Core Banking Reporting', tags: ['sql-server', 'rbi-scope', 'wave-2'],
    backup: { s: 'na', note: 'Backup starts after cutover; VMware sources are not backed up.' }, dr: { s: 'protected', plan: 'Meridian Tier-0 replication', target: '15 min', age: '7 min' },
    mig: { s: 'syncing', wave: 'Wave 2 · Core banking reporting', next: 'Test boot on 23 Oct' }, alerts: 1, sizeGB: 960, cpu: '8 vCPU', mem: '64 GB', ip: '172.25.10.41', classification: 'Critical', sensitive: true,
    lifecycle: L(['Discovered', T('04 Mar', '09:12'), 'Found by the agentless scan of vCenter 172.25.10.177'], ['Assessed', T('11 Mar', '16:30'), 'Readiness 86 of 100 · one warning: VMware Tools 11.3'], ['Replicated', T('02 Apr', '22:05'), 'Replicating to Chennai-proxmox-prod every 15 min']),
    deps: ['sql01-cbsreport', 'rpt-app-01', 'ad-dc-mum-01']
  },
  {
    id: 'sql01-cbsreport', name: 'SQL01\\CBSREPORT', type: 'Database', os: 'SQL Server 2019 Enterprise', customer: 'mer', project: 'Meridian-Migration', site: 'Chennai vCenter', env: 'Production', tier: 'Mission Critical', owner: 'Suresh Iyer', app: 'Core Banking Reporting', tags: ['sql-server', 'rbi-scope'],
    backup: { s: 'na', note: 'Application-consistent backup starts with the VM after cutover.' }, dr: { s: 'protected', plan: 'Meridian Tier-0 replication', target: '15 min', age: '7 min' }, mig: { s: 'syncing', wave: 'Wave 2 · Core banking reporting' },
    alerts: 0, sizeGB: 612, classification: 'Confidential', sensitive: true,
    lifecycle: L(['Discovered', T('04 Mar', '09:12'), 'Found inside SQL01 by the database scan'], ['Assessed', T('11 Mar', '16:30'), 'Log shipping is off; full recovery model'])
  },
  {
    id: 'rpt-app-01', name: 'rpt-app-01', type: 'VM', os: 'Windows Server 2022', customer: 'mer', project: 'Meridian-Migration', site: 'Chennai vCenter', env: 'Production', tier: 'Business Critical', owner: 'Suresh Iyer', app: 'Core Banking Reporting', tags: ['wave-2'],
    backup: { s: 'na' }, dr: { s: 'protected', plan: 'Meridian Tier-1 replication', target: '1 h', age: '22 min' }, mig: { s: 'testing', wave: 'Wave 2 · Core banking reporting', next: 'End test' },
    alerts: 0, sizeGB: 180, cpu: '4 vCPU', mem: '16 GB', ip: '172.25.10.52', classification: 'Critical',
    lifecycle: L(['Discovered', T('04 Mar', '09:12'), 'Found by the agentless scan of vCenter 172.25.10.177'], ['Assessed', T('11 Mar', '16:30'), 'Readiness 94 of 100'], ['Replicated', T('02 Apr', '22:05'), 'Replicating every hour'], ['Tested', T('21 Oct', '14:20'), 'Test boot running on mig-test-isolated'])
  },
  {
    id: 'cbs-db-01', name: 'cbs-db-01', type: 'VM', os: 'Oracle Linux 9', customer: 'mer', project: 'Meridian-CBS', site: 'production-openstack', env: 'Production', tier: 'Mission Critical', owner: 'Anitha Krishnan', app: 'Core Banking', tags: ['oracle', 'rbi-scope'],
    backup: { s: 'protected', policy: 'Meridian database hourly', last: T('21 Oct', '16:00'), points: 168 }, dr: { s: 'protected', plan: 'Meridian Tier-0 replication', target: '15 min', age: '9 s' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 2400, cpu: '32 vCPU', mem: '256 GB', ip: '10.60.1.11', classification: 'Critical', sensitive: true,
    lifecycle: L(['Discovered', T('05 Mar', '11:02'), 'Found by the agentless scan of production-openstack'], ['Protected', T('06 Mar', '02:00'), 'First backup to mer-obj-immutable · compliance lock 30 d'], ['Replicated', T('09 Mar', '20:15'), 'Replicating to region-2-os'], ['Tested', T('28 Sep', '22:00'), 'Quarterly RBI drill passed · RTO 41 min against 60 min'])
  },
  {
    id: 'payments-api', name: 'payments-api', type: 'Kubernetes workload', os: 'Namespace payments · 14 pods', customer: 'mer', project: 'Meridian-CBS', site: 'production-openstack', env: 'Production', tier: 'Mission Critical', owner: 'Anitha Krishnan', app: 'Core Banking', tags: ['k8s', 'upi'],
    backup: { s: 'warn', policy: 'Meridian Kubernetes 4-hourly', last: T('21 Oct', '12:00'), points: 42, note: 'PVC payments-ledger skipped: snapshot class missing' }, dr: { s: 'none', note: 'Not in a recovery plan' }, mig: { s: 'na' },
    alerts: 1, sizeGB: 120, classification: 'Critical',
    lifecycle: L(['Discovered', T('22 Aug', '10:10'), 'Found by the Kubernetes connector on cluster cbs-k8s-prod'], ['Protected', T('23 Aug', '00:00'), 'Namespace backup with 3 PVCs'])
  },
  {
    id: 'lb-cbs-prod', name: 'lb-cbs-prod', type: 'Load balancer', os: 'OpenStack Octavia · 2 listeners', customer: 'mer', project: 'Meridian-CBS', site: 'production-openstack', env: 'Production', tier: 'Mission Critical', owner: 'Anitha Krishnan', app: 'Core Banking', tags: [],
    backup: { s: 'protected', policy: 'Configuration daily', last: T('21 Oct', '01:00'), points: 30 }, dr: { s: 'protected', plan: 'Recreated by recovery plan CBS failover' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 0, classification: 'Standard', lifecycle: L(['Discovered', T('05 Mar', '11:02'), 'Found with production-openstack'], ['Protected', T('06 Mar', '01:00'), 'Configuration exported nightly'])
  },
  {
    id: 'dns-cbs', name: 'cbs.meridianbank.in', type: 'DNS record', os: 'A record · TTL 60 s · Infoblox', customer: 'mer', project: 'Meridian-CBS', site: 'Infoblox mum-ipam', env: 'Production', tier: 'Mission Critical', owner: 'Anitha Krishnan', app: 'Core Banking', tags: ['dns-failover'],
    backup: { s: 'na' }, dr: { s: 'protected', plan: 'Updated to 10.70.1.11 on failover' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 0, classification: 'Standard', lifecycle: L(['Discovered', T('07 Mar', '09:30'), 'Read from Infoblox through the DNS integration'])
  },
  {
    id: 'mum-oracle-phy-01', name: 'mum-oracle-phy-01', type: 'Physical server', os: 'Red Hat Enterprise Linux 8 · Dell R750', customer: 'mer', project: 'Meridian-Treasury', site: 'Mumbai DC2', env: 'Production', tier: 'Business Critical', owner: 'Rohit Shenoy', app: 'Treasury', tags: ['agent'],
    backup: { s: 'protected', policy: 'Meridian physical daily', last: T('21 Oct', '01:42'), points: 31 }, dr: { s: 'behind', plan: 'Meridian Tier-1 replication', target: '1 h', age: '1 h 26 min', note: 'Agent upload throttled by the source impact governor' }, mig: { s: 'assessed', note: 'P2V candidate · readiness 71' },
    alerts: 1, sizeGB: 1800, cpu: '48 cores', mem: '384 GB', ip: '10.12.4.20', classification: 'Confidential', sensitive: true,
    lifecycle: L(['Discovered', T('15 Mar', '12:00'), 'Agent aegis-agent 4.2.0 installed'], ['Protected', T('16 Mar', '01:00'), 'Block-level backup through the agent'], ['Replicated', T('20 Mar', '23:00'), 'Replicating to production-openstack'])
  },
  {
    id: 'fs-mum-01', name: '\\\\fs-mum-01\\finance', type: 'File share', os: 'SMB 3.1 · 2.1 M files', customer: 'mer', project: 'Meridian-Treasury', site: 'Mumbai DC2', env: 'Production', tier: 'Important', owner: 'Rohit Shenoy', tags: ['smb'],
    backup: { s: 'protected', policy: 'Meridian file shares nightly', last: T('20 Oct', '23:30'), points: 45 }, dr: { s: 'none' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 3400, classification: 'Confidential', lifecycle: L(['Discovered', T('15 Mar', '12:20'), 'Share added through the agent on mum-oracle-phy-01'], ['Protected', T('15 Mar', '23:30'), 'File-level backup with indexing'])
  },
  {
    id: 'mbk-lt-0442', name: 'MBK-LT-0442', type: 'Endpoint', os: 'Windows 11 · ThinkPad T14', customer: 'mer', project: 'Meridian-Treasury', site: 'Remote', env: 'Production', tier: 'Standard', owner: 'Kavya Rao', tags: ['laptop'],
    backup: { s: 'failed', policy: 'Endpoint daily', last: T('19 Oct', '13:05'), points: 22, note: 'Device offline for 2 days' }, dr: { s: 'na' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 210, classification: 'Standard', lifecycle: L(['Discovered', T('02 Jun', '09:00'), 'Endpoint agent enrolled'], ['Protected', T('02 Jun', '13:00'), 'First endpoint backup'])
  },
  {
    id: 'sql-prod-02', name: 'sql-prod-02', type: 'VM', os: 'Windows Server 2022', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Mission Critical', owner: 'Arun Kumar', app: 'ERP', tags: ['sql-server'],
    backup: { s: 'protected', policy: 'Database hourly', last: T('21 Oct', '16:00'), points: 59 }, dr: { s: 'protected', plan: 'Business-critical', target: '15 min', age: '6 min' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 640, cpu: '8 cores', mem: '32 GB', ip: '10.20.4.31', classification: 'Critical',
    lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Database hourly · obj-check · compliance lock 14 d'], ['Replicated', T('13 Mar', '22:00'), 'Replicating to production-openstack'], ['Tested', T('18 Oct', '22:10'), 'Core services failover test · 18 min 40 s'], ['Restored', T('21 Oct', '10:02'), 'Whole VM to Chennai_Lab_Proxmox for audit'])
  },
  {
    id: 'erp-db-01', name: 'erp-db-01', type: 'VM', os: 'Oracle Linux 9', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Mission Critical', owner: 'Arun Kumar', app: 'ERP', tags: ['oracle'],
    backup: { s: 'warn', policy: 'Database hourly', last: T('21 Oct', '16:02'), points: 58, note: 'Crash-consistent point taken' }, dr: { s: 'behind', plan: 'Business-critical', target: '15 min', age: '27 min' }, mig: { s: 'na' },
    alerts: 1, sizeGB: 820, cpu: '16 cores', mem: '64 GB', ip: '10.20.4.32', classification: 'Critical',
    lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Database hourly'], ['Replicated', T('13 Mar', '22:00'), 'Replicating to production-openstack'], ['Tested', T('18 Oct', '22:10'), 'Core services failover test'])
  },
  {
    id: 'erp-app-01', name: 'erp-app-01', type: 'VM', os: 'Windows Server 2022', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Business Critical', owner: 'Arun Kumar', app: 'ERP', tags: [],
    backup: { s: 'running', policy: 'Production daily', last: T('21 Oct', '15:58'), points: 30 }, dr: { s: 'syncing', plan: 'Business-critical', target: '15 min', age: '4 min' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 260, cpu: '4 cores', mem: '16 GB', ip: '10.20.4.33', classification: 'Critical', lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Production daily'], ['Replicated', T('13 Mar', '22:00'), 'Replicating'])
  },
  {
    id: 'ad-dc-01', name: 'ad-dc-01', type: 'VM', os: 'Windows Server 2022', customer: 'h360', project: 'Base-Project', site: 'Chennai vCenter', env: 'Production', tier: 'Mission Critical', owner: 'Priya Raman', app: 'Mail and directory', tags: ['directory'],
    backup: { s: 'na', note: 'VMware sources are protected by Resilience, not backed up.' }, dr: { s: 'failed', plan: 'Business-critical', target: '15 min', age: '3 h 40 min', note: 'VMware Tools quiesce timed out after 600 s' }, mig: { s: 'na' },
    alerts: 1, sizeGB: 60, cpu: '2 vCPU', mem: '8 GB', ip: '10.30.0.10', classification: 'Critical', lifecycle: L(disc('12 Mar', 'Chennai vCenter'), ['Replicated', T('14 Mar', '20:00'), 'Replicating to Chennai-proxmox-prod'])
  },
  {
    id: 'mail-gw-01', name: 'mail-gw-01', type: 'VM', os: 'Debian 12', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Business Critical', owner: 'Priya Raman', app: 'Mail and directory', tags: [],
    backup: { s: 'protected', policy: 'Production daily', last: T('21 Oct', '02:31'), points: 31 }, dr: { s: 'protected', plan: 'Business-critical', target: '15 min', age: '11 min' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 90, classification: 'Non-critical', lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Production daily'], ['Replicated', T('14 Mar', '20:00'), 'Replicating'])
  },
  {
    id: 'file-srv-03', name: 'file-srv-03', type: 'VM', os: 'Windows Server 2019', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Important', owner: 'Meera Iyer', tags: ['smb'],
    backup: { s: 'failed', policy: 'Production daily', last: T('21 Oct', '02:48'), points: 29, note: 'Disk scsi1 read error at offset 412.6 GB' }, dr: { s: 'online', plan: 'Non-critical', note: 'Running at the recovery site as file-srv-03-dr' }, mig: { s: 'na' },
    alerts: 1, sizeGB: 1840, classification: 'Confidential', lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Production daily'], ['Replicated', T('14 Mar', '20:00'), 'Replicating daily'])
  },
  {
    id: 'web-frontend-01', name: 'web-frontend-01', type: 'VM', os: 'Ubuntu 24.04', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Important', owner: 'Karthik S', app: 'Web storefront', tags: ['web'],
    backup: { s: 'protected', policy: 'Production daily', last: T('21 Oct', '02:14'), points: 31 }, dr: { s: 'protected', plan: 'Non-critical', target: '1 d', age: '9 h 12 min' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 120, classification: 'Non-critical', lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Production daily'], ['Restored', T('21 Oct', '13:12'), 'Files restored for INC-20418'])
  },
  {
    id: 'web-frontend-02', name: 'web-frontend-02', type: 'VM', os: 'Ubuntu 24.04', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Important', owner: 'Karthik S', app: 'Web storefront', tags: ['web'],
    backup: { s: 'protected', policy: 'Production daily', last: T('21 Oct', '02:16'), points: 31 }, dr: { s: 'protected', plan: 'Non-critical', target: '1 d', age: '9 h 12 min' }, mig: { s: 'na' },
    alerts: 0, sizeGB: 120, classification: 'Non-critical', lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Production daily'])
  },
  {
    id: 'lb-web', name: 'lb-storefront', type: 'Load balancer', os: 'HAProxy 2.8 on Proxmox VE', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Important', owner: 'Karthik S', app: 'Web storefront', tags: [],
    backup: { s: 'none' }, dr: { s: 'none' }, mig: { s: 'na' }, alerts: 0, sizeGB: 0, classification: 'Standard', lifecycle: L(disc())
  },
  {
    id: 'gitlab-01', name: 'gitlab-01', type: 'VM', os: 'Ubuntu 22.04', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Important', owner: 'Meera Iyer', tags: ['devtools'],
    backup: { s: 'protected', policy: 'Production daily', last: T('21 Oct', '02:52'), points: 31 }, dr: { s: 'returning', plan: 'Non-critical' }, mig: { s: 'na' }, alerts: 0, sizeGB: 420, classification: 'Non-critical', lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Production daily'])
  },
  {
    id: 'monitoring-01', name: 'monitoring-01', type: 'VM', os: 'Rocky Linux 9', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Standard', owner: 'Meera Iyer', tags: [],
    backup: { s: 'protected', policy: 'Production daily', last: T('21 Oct', '02:20'), points: 31 }, dr: { s: 'none' }, mig: { s: 'na' }, alerts: 0, sizeGB: 150, classification: 'Standard', lifecycle: L(disc(), ['Protected', T('12 Mar', '17:00'), 'Production daily'])
  },
  {
    id: 'k8s-worker-08', name: 'k8s-worker-08', type: 'Cloud instance', os: 'Ubuntu 24.04 · m1.xlarge', customer: 'h360', project: 'Base-Project', site: 'production-openstack', env: 'Production', tier: 'Important', owner: 'Meera Iyer', tags: ['k8s'],
    backup: { s: 'warn', policy: 'OpenStack nightly', last: T('20 Oct', '23:41'), points: 11, note: 'Change tracking is off' }, dr: { s: 'none' }, mig: { s: 'na' }, alerts: 0, sizeGB: 200, classification: 'Non-critical', lifecycle: L(disc('18 Jan', 'production-openstack'), ['Protected', T('19 Jan', '23:00'), 'OpenStack nightly'])
  },
  {
    id: 'billing-api-02', name: 'billing-api-02', type: 'Cloud instance', os: 'Ubuntu 24.04 · m1.medium', customer: 'h360', project: 'Base-Project', site: 'production-openstack', env: 'Production', tier: 'Business Critical', owner: 'Arun Kumar', app: 'Billing', tags: [],
    backup: { s: 'protected', policy: 'OpenStack nightly', last: T('20 Oct', '23:12'), points: 11 }, dr: { s: 'unreach', plan: 'Business-critical', note: 'Could not be read: region-2-os did not answer within 30 s' }, mig: { s: 'na' }, alerts: 1, sizeGB: 80, classification: 'Critical', lifecycle: L(disc('18 Jan', 'production-openstack'), ['Protected', T('19 Jan', '23:00'), 'OpenStack nightly'], ['Replicated', T('01 Jul', '20:00'), 'Replicating to region-2-os'])
  },
  {
    id: 'crm-db-01', name: 'crm-db-01', type: 'VM', os: 'Windows Server 2019', customer: 'h360', project: 'Base-Project', site: 'Chennai vCenter', env: 'Production', tier: 'Business Critical', owner: 'Priya Raman', app: 'CRM', tags: ['wave-1'],
    backup: { s: 'na' }, dr: { s: 'none' }, mig: { s: 'testing', wave: 'Wave 1 · CRM', next: 'End test' }, alerts: 0, sizeGB: 1260, classification: 'Confidential',
    lifecycle: L(disc('04 Aug', 'Chennai vCenter'), ['Assessed', T('10 Aug', '12:00'), 'Readiness 88 of 100'], ['Tested', T('21 Oct', '14:55'), 'Test boot running'])
  },
  {
    id: 'crm-app-01', name: 'crm-app-01', type: 'VM', os: 'Windows Server 2022', customer: 'h360', project: 'Base-Project', site: 'Chennai vCenter', env: 'Production', tier: 'Business Critical', owner: 'Priya Raman', app: 'CRM', tags: ['wave-1'],
    backup: { s: 'na' }, dr: { s: 'none' }, mig: { s: 'syncing', wave: 'Wave 1 · CRM', next: 'Test boot' }, alerts: 0, sizeGB: 420, classification: 'Non-critical',
    lifecycle: L(disc('04 Aug', 'Chennai vCenter'), ['Assessed', T('10 Aug', '12:00'), 'Readiness 92 of 100'])
  },
  {
    id: 'print-srv-02', name: 'print-srv-02', type: 'VM', os: 'Windows Server 2016', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Standard', owner: 'Meera Iyer', tags: ['wave-3'],
    backup: { s: 'none', note: 'Cut over at 11:20; no backup policy yet' }, dr: { s: 'na' }, mig: { s: 'cutover', wave: 'Wave 3 · Legacy', next: 'Commit or roll back' }, alerts: 0, sizeGB: 60, classification: 'Standard',
    lifecycle: L(disc('09 Sep', 'esxi-edge-07'), ['Assessed', T('12 Sep', '10:00'), 'Readiness 79 of 100'], ['Migrated', T('21 Oct', '11:20'), 'Cut over to Chennai-proxmox-prod · 14 min 30 s downtime'])
  },
  {
    id: 'ubuntu-build-03', name: 'ubuntu-build-03', type: 'VM', os: 'Ubuntu 24.04', customer: 'h360', project: 'Base-Project', site: 'Chennai-proxmox-prod', env: 'Test', tier: 'Standard', owner: 'Meera Iyer', tags: [],
    backup: { s: 'protected', policy: 'Lab weekly', last: T('19 Oct', '06:20'), points: 1 }, dr: { s: 'na' }, mig: { s: 'committed', wave: 'Wave 0 · Pilot' }, alerts: 0, sizeGB: 200, classification: 'Standard',
    lifecycle: L(disc('04 Aug', 'Chennai vCenter'), ['Assessed', T('10 Aug', '12:00'), 'Readiness 97 of 100'], ['Migrated', T('18 Oct', '23:45'), 'Committed'], ['Protected', T('19 Oct', '06:00'), 'Lab weekly assigned from its tier'])
  },
  {
    id: 'legacy-erp', name: 'legacy-erp', type: 'VM', os: 'CentOS 7', customer: 'h360', project: 'Base-Project', site: 'esxi-edge-07', env: 'Production', tier: 'Important', owner: 'Arun Kumar', tags: ['wave-3', 'eol-os'],
    backup: { s: 'na' }, dr: { s: 'none' }, mig: { s: 'blocked', wave: 'Wave 3 · Legacy', note: 'CentOS 7 is end of life; VirtIO drivers must be added by hand' }, alerts: 1, sizeGB: 700, classification: 'Non-critical',
    lifecycle: L(disc('09 Sep', 'esxi-edge-07'), ['Assessed', T('12 Sep', '10:00'), 'Readiness 41 of 100 · 1 blocker'])
  },
  {
    id: 'kav-tally-01', name: 'kav-tally-01', type: 'VM', os: 'Windows Server 2022', customer: 'kav', project: 'Tenant-Kaveri', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Business Critical', owner: 'Rahul Menon', app: 'Kaveri Finance', tags: ['tally'],
    backup: { s: 'protected', policy: 'Kaveri daily (inherits Production daily)', last: T('21 Oct', '01:15'), points: 30 }, dr: { s: 'protected', plan: 'Kaveri finance', target: '1 h', age: '18 min' }, mig: { s: 'na' }, alerts: 0, sizeGB: 140, classification: 'Confidential',
    lifecycle: L(disc('27 May', 'Chennai-proxmox-prod'), ['Protected', T('28 May', '01:00'), 'Kaveri daily'], ['Replicated', T('01 Jun', '20:00'), 'Replicating'], ['Tested', T('30 Sep', '19:00'), 'Quarterly drill passed'])
  },
  {
    id: 'kav-wms-db', name: 'kav-wms-db', type: 'Database', os: 'PostgreSQL 16', customer: 'kav', project: 'Kaveri-WMS', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Business Critical', owner: 'Rahul Menon', app: 'Kaveri WMS', tags: ['postgres'],
    backup: { s: 'protected', policy: 'Kaveri database 4-hourly', last: T('21 Oct', '16:00'), points: 84 }, dr: { s: 'protected', plan: 'Kaveri finance', target: '1 h', age: '31 min' }, mig: { s: 'na' }, alerts: 0, sizeGB: 310, classification: 'Non-critical',
    lifecycle: L(disc('27 May', 'Chennai-proxmox-prod'), ['Protected', T('28 May', '04:00'), 'Kaveri database 4-hourly'])
  },
  {
    id: 'sah-his-db', name: 'his-db-01', type: 'VM', os: 'Red Hat Enterprise Linux 9', customer: 'sah', project: 'Sahyadri-HIS', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Mission Critical', owner: 'Dr Vikram Joshi', app: 'Hospital information system', tags: ['phi'],
    backup: { s: 'protected', policy: 'Sahyadri clinical hourly', last: T('21 Oct', '16:00'), points: 240 }, dr: { s: 'na', note: 'Resilience is not licensed for this customer' }, mig: { s: 'na' }, alerts: 1, sizeGB: 1100, classification: 'Confidential', sensitive: true,
    lifecycle: L(disc('14 Jul', 'Chennai-proxmox-prod'), ['Protected', T('15 Jul', '00:00'), 'Clinical hourly · immutable 30 d'], ['Restored', T('02 Oct', '14:30'), 'Table-level restore approved by two approvers'])
  },
  {
    id: 'sah-pacs', name: 'pacs-store', type: 'File share', os: 'NFS 4.1 · 11.4 M files', customer: 'sah', project: 'Sahyadri-HIS', site: 'Chennai-proxmox-prod', env: 'Production', tier: 'Business Critical', owner: 'Dr Vikram Joshi', app: 'Hospital information system', tags: ['phi', 'dicom'],
    backup: { s: 'protected', policy: 'Sahyadri imaging nightly', last: T('20 Oct', '22:40'), points: 60 }, dr: { s: 'na' }, mig: { s: 'na' }, alerts: 0, sizeGB: 5200, classification: 'Confidential', sensitive: true,
    lifecycle: L(disc('14 Jul', 'Chennai-proxmox-prod'), ['Protected', T('15 Jul', '22:00'), 'Imaging nightly'])
  }
];
export const workloadById = (id: string) => WORKLOADS.find(w => w.id === id);

// ---- applications ----
export interface Application {
  id: string;
  name: string;
  customer: string;
  tier: Tier;
  owner: string;
  members: string[];
  dependsOn: string[];
  description: string;
  drPlan?: string;
  lastDrill?: { r: 'ok' | 'warn' | 'err'; when: string; rto: string };
  wave?: string;
}
export const APPLICATIONS: Application[] = [
  { id: 'cbr', name: 'Core Banking Reporting', customer: 'mer', tier: 'Mission Critical', owner: 'Suresh Iyer', members: ['sql01', 'sql01-cbsreport', 'rpt-app-01'], dependsOn: ['cbs'], description: 'Regulatory and MIS reports for the core banking system.', drPlan: 'Meridian Tier-0 replication', lastDrill: { r: 'ok', when: T('28 Sep', '22:00'), rto: '38 min of 60 min' }, wave: 'Wave 2 · Core banking reporting' },
  { id: 'cbs', name: 'Core Banking', customer: 'mer', tier: 'Mission Critical', owner: 'Anitha Krishnan', members: ['cbs-db-01', 'payments-api', 'lb-cbs-prod', 'dns-cbs'], dependsOn: [], description: 'Finacle core, UPI payments API and its front door.', drPlan: 'CBS failover', lastDrill: { r: 'ok', when: T('28 Sep', '22:00'), rto: '41 min of 60 min' } },
  { id: 'trs', name: 'Treasury', customer: 'mer', tier: 'Business Critical', owner: 'Rohit Shenoy', members: ['mum-oracle-phy-01', 'fs-mum-01'], dependsOn: ['cbs'], description: 'Treasury dealing system and its file store.', drPlan: 'Treasury failover', lastDrill: { r: 'warn', when: T('14 Aug', '21:00'), rto: '3 h 52 min of 4 h' } },
  { id: 'erp', name: 'ERP', customer: 'h360', tier: 'Mission Critical', owner: 'Arun Kumar', members: ['sql-prod-02', 'erp-db-01', 'erp-app-01'], dependsOn: ['mail'], description: 'Finance and supply chain.', drPlan: 'Core services failover', lastDrill: { r: 'ok', when: T('18 Oct', '22:10'), rto: '18 min 40 s of 1 h' } },
  { id: 'mail', name: 'Mail and directory', customer: 'h360', tier: 'Mission Critical', owner: 'Priya Raman', members: ['ad-dc-01', 'mail-gw-01'], dependsOn: [], description: 'Active Directory and the mail gateway.', drPlan: 'Core services failover', lastDrill: { r: 'ok', when: T('18 Oct', '22:10'), rto: '18 min 40 s of 1 h' } },
  { id: 'web', name: 'Web storefront', customer: 'h360', tier: 'Important', owner: 'Karthik S', members: ['web-frontend-01', 'web-frontend-02', 'lb-web'], dependsOn: ['billing'], description: 'Public storefront behind HAProxy.', drPlan: 'Web tier', lastDrill: { r: 'ok', when: T('12 Oct', '21:30'), rto: '7 min 12 s of 24 h' } },
  { id: 'crm', name: 'CRM', customer: 'h360', tier: 'Business Critical', owner: 'Priya Raman', members: ['crm-app-01', 'crm-db-01'], dependsOn: ['mail'], description: 'Moving from VMware to production-openstack in Wave 1.', wave: 'Wave 1 · CRM' },
  { id: 'billing', name: 'Billing', customer: 'h360', tier: 'Business Critical', owner: 'Arun Kumar', members: ['billing-api-02'], dependsOn: ['erp'], description: 'Billing API used by the storefront.', drPlan: 'Billing' },
  { id: 'kfin', name: 'Kaveri Finance', customer: 'kav', tier: 'Business Critical', owner: 'Rahul Menon', members: ['kav-tally-01'], dependsOn: [], description: 'Tally Prime for the finance team.', drPlan: 'Kaveri finance', lastDrill: { r: 'ok', when: T('30 Sep', '19:00'), rto: '22 min of 4 h' } },
  { id: 'kwms', name: 'Kaveri WMS', customer: 'kav', tier: 'Business Critical', owner: 'Rahul Menon', members: ['kav-wms-db'], dependsOn: [], description: 'Warehouse management for Ennore.', drPlan: 'Kaveri WMS' },
  { id: 'his', name: 'Hospital information system', customer: 'sah', tier: 'Mission Critical', owner: 'Dr Vikram Joshi', members: ['sah-his-db', 'sah-pacs'], dependsOn: [], description: 'Patient records and imaging. Restores need two approvers.' }
];

// ---- users and roles ----
export type UserStatus = 'active' | 'invited' | 'deactivated' | 'locked' | 'deleted';
export interface Session { device: string; browser: string; ip: string; place: string; started: string; last: string; current?: boolean }
export interface User {
  id: string;
  name: string;
  email: string;
  customer: string;
  side: 'Provider' | 'Customer';
  roles: { scope: string; role: string }[];
  status: UserStatus;
  mfa: 'Authenticator app' | 'Security key' | 'SMS' | 'Not set up';
  signIn: 'Password' | 'Entra ID' | 'Okta' | 'Google Workspace' | 'Keycloak';
  last: string;
  created: string;
  sessions: Session[];
  title: string;
  statusNote?: string;
}
const S = (device: string, browser: string, ip: string, place: string, started: string, last: string, current?: boolean): Session => ({ device, browser, ip, place, started, last, current });
export const USERS: User[] = [
  { id: 'pr', name: 'Priya Raman', email: 'priya.raman@host360.ai', customer: 'h360', side: 'Provider', title: 'Head of cloud operations', roles: [{ scope: 'Host360 (all customers)', role: 'Owner' }], status: 'active', mfa: 'Security key', signIn: 'Entra ID', last: T('21 Oct', '15:44'), created: T('18 Jan', '09:20'), sessions: [S('Windows 11 · ThinkPad X1', 'Edge 130', '10.20.1.44', 'Chennai, IN', T('21 Oct', '09:02'), T('21 Oct', '16:05'), true), S('iPhone 15', 'Claude for iOS', '49.207.12.8', 'Chennai, IN', T('20 Oct', '21:14'), T('21 Oct', '07:40'))] },
  { id: 'ak', name: 'Arun Kumar', email: 'arun.kumar@host360.ai', customer: 'h360', side: 'Provider', title: 'Backup engineer', roles: [{ scope: 'Base-Project', role: 'Admin' }, { scope: 'Meridian Cooperative Bank', role: 'Backup Operator' }], status: 'active', mfa: 'Authenticator app', signIn: 'Entra ID', last: T('21 Oct', '14:10'), created: T('18 Jan', '09:40'), sessions: [S('Ubuntu 24.04', 'Firefox 131', '10.20.1.33', 'Chennai, IN', T('21 Oct', '09:30'), T('21 Oct', '14:10'))] },
  { id: 'mi', name: 'Meera Iyer', email: 'meera.iyer@host360.ai', customer: 'h360', side: 'Provider', title: 'Migration lead', roles: [{ scope: 'Base-Project', role: 'Migration Planner' }, { scope: 'Tenant-Kaveri', role: 'Admin' }], status: 'active', mfa: 'Authenticator app', signIn: 'Entra ID', last: T('21 Oct', '09:01'), created: T('02 Feb', '10:00'), sessions: [S('macOS 15 · MacBook Pro', 'Chrome 130', '10.20.1.52', 'Chennai, IN', T('21 Oct', '09:01'), T('21 Oct', '13:20'))] },
  { id: 'ks', name: 'Karthik S', email: 'karthik.s@host360.ai', customer: 'h360', side: 'Provider', title: 'Service desk', roles: [{ scope: 'Base-Project', role: 'Restore Operator' }], status: 'active', mfa: 'Not set up', signIn: 'Password', last: T('21 Oct', '15:50'), created: T('10 Apr', '11:00'), statusNote: 'MFA required from 28 Oct 2026', sessions: [S('Windows 10 · Desktop', 'Chrome 129', '10.20.1.71', 'Chennai, IN', T('21 Oct', '10:00'), T('21 Oct', '15:50'))] },
  { id: 'dn', name: 'Divya N', email: 'divya.n@host360.ai', customer: 'h360', side: 'Provider', title: 'Analyst', roles: [{ scope: 'Base-Project', role: 'Read-only' }], status: 'active', mfa: 'Authenticator app', signIn: 'Entra ID', last: T('21 Oct', '15:29'), created: T('03 May', '09:00'), sessions: [] },
  { id: 'vr', name: 'Vivek Rao', email: 'vivek.rao@host360.ai', customer: 'h360', side: 'Provider', title: 'Former DR engineer', roles: [{ scope: 'Base-Project', role: 'DR Architect' }], status: 'deactivated', mfa: 'Authenticator app', signIn: 'Entra ID', last: T('30 Sep', '18:02'), created: T('18 Jan', '09:50'), statusNote: 'Left the company on 30 Sep 2026. Deactivated by SCIM.', sessions: [] },
  { id: 'ank', name: 'Anitha Krishnan', email: 'anitha.k@meridianbank.in', customer: 'mer', side: 'Customer', title: 'Head of IT infrastructure', roles: [{ scope: 'Meridian Cooperative Bank', role: 'Owner' }], status: 'active', mfa: 'Security key', signIn: 'Okta', last: T('21 Oct', '11:12'), created: T('03 Mar', '11:40'), sessions: [S('Windows 11', 'Edge 130', '115.112.40.19', 'Mumbai, IN', T('21 Oct', '11:02'), T('21 Oct', '11:12'))] },
  { id: 'si', name: 'Suresh Iyer', email: 's.iyer@meridianbank.in', customer: 'mer', side: 'Customer', title: 'DBA lead', roles: [{ scope: 'Meridian-Migration', role: 'Migration Approver' }, { scope: 'Meridian-CBS', role: 'Restore Operator' }], status: 'active', mfa: 'Authenticator app', signIn: 'Okta', last: T('21 Oct', '15:31'), created: T('03 Mar', '12:00'), sessions: [S('Windows 11', 'Chrome 130', '115.112.40.22', 'Mumbai, IN', T('21 Oct', '14:00'), T('21 Oct', '15:31'))] },
  { id: 'nb', name: 'Neha Bhatt', email: 'neha.bhatt@meridianbank.in', customer: 'mer', side: 'Customer', title: 'Internal auditor', roles: [{ scope: 'Meridian Cooperative Bank', role: 'Auditor' }], status: 'active', mfa: 'Authenticator app', signIn: 'Okta', last: T('18 Oct', '16:40'), created: T('20 Mar', '10:00'), sessions: [] },
  { id: 'rs', name: 'Rohit Shenoy', email: 'rohit.s@meridianbank.in', customer: 'mer', side: 'Customer', title: 'Treasury systems', roles: [{ scope: 'Meridian-Treasury', role: 'Failover Approver' }], status: 'invited', mfa: 'Not set up', signIn: 'Okta', last: '—', created: T('20 Oct', '17:05'), statusNote: 'Invitation sent 20 Oct 2026, 17:05 IST · expires in 6 days', sessions: [] },
  { id: 'rm', name: 'Rahul Menon', email: 'rahul@kaveri-logistics.in', customer: 'kav', side: 'Customer', title: 'IT manager', roles: [{ scope: 'Kaveri Logistics Pvt Ltd', role: 'Owner' }], status: 'active', mfa: 'Authenticator app', signIn: 'Google Workspace', last: T('19 Oct', '11:42'), created: T('27 May', '15:05'), sessions: [] },
  { id: 'vj', name: 'Dr Vikram Joshi', email: 'v.joshi@sahyadrihospitals.in', customer: 'sah', side: 'Customer', title: 'Chief medical information officer', roles: [{ scope: 'Sahyadri Hospitals', role: 'Owner' }], status: 'active', mfa: 'SMS', signIn: 'Password', last: T('20 Oct', '09:15'), created: T('14 Jul', '12:30'), sessions: [] },
  { id: 'pk', name: 'Prakash Kumar', email: 'prakash@sahyadrihospitals.in', customer: 'sah', side: 'Customer', title: 'IT executive', roles: [{ scope: 'Sahyadri-HIS', role: 'Backup Operator' }], status: 'locked', mfa: 'SMS', signIn: 'Password', last: T('21 Oct', '08:51'), created: T('16 Jul', '10:00'), statusNote: 'Locked after 5 failed sign-ins at 08:51 IST from 203.0.113.24', sessions: [] },
  { id: 'lw', name: 'Lakshmi Narayanan', email: 'lakshmi.n@coromandelins.in', customer: 'cor', side: 'Customer', title: 'CTO', roles: [{ scope: 'Coromandel Insurance', role: 'Owner' }], status: 'active', mfa: 'Authenticator app', signIn: 'Password', last: T('03 Oct', '10:20'), created: T('09 Apr', '10:15'), sessions: [] },
  { id: 'jw', name: 'Jonas Weber', email: 'j.weber@atlas-freight.de', customer: 'atl', side: 'Customer', title: 'Head of IT', roles: [{ scope: 'Atlas Freight GmbH', role: 'Owner' }], status: 'active', mfa: 'Security key', signIn: 'Entra ID', last: T('21 Oct', '12:40'), created: T('16 Oct', '13:10'), sessions: [] },
  { id: 'old', name: 'Ganesh Pillai', email: 'ganesh.p@host360.ai', customer: 'h360', side: 'Provider', title: 'Former engineer', roles: [], status: 'deleted', mfa: 'Not set up', signIn: 'Password', last: T('11 Jun', '17:00'), created: T('18 Jan', '10:00'), statusNote: 'Deleted 30 Jun 2026 by priya.raman. Audit history kept for 7 years.', sessions: [] }
];

export type Area = 'Platform' | 'Protection' | 'Resilience' | 'Mobility' | 'Billing';
export const AREAS: Area[] = ['Platform', 'Protection', 'Resilience', 'Mobility', 'Billing'];
export const ACTIONS: Record<Area, string[]> = {
  Platform: ['View', 'Manage users', 'Manage roles', 'Manage policies', 'Manage connections', 'Approve', 'View audit'],
  Protection: ['View', 'Back up', 'Restore', 'Restore files only', 'Edit policies', 'Delete recovery points'],
  Resilience: ['View', 'Edit plans', 'Run drills', 'Fail over', 'Fail back', 'Approve failover'],
  Mobility: ['View', 'Plan waves', 'Sync and test', 'Cut over', 'Approve cutover', 'Roll back'],
  Billing: ['View invoices', 'Manage plans', 'Manage payments']
};
export interface Role {
  id: string;
  name: string;
  kind: 'Built-in' | 'Template' | 'Custom';
  desc: string;
  perms: Record<string, string[]>;
  users: number;
  scopeHint: string;
  ip?: string[];
  owner?: string;
  updated: string;
}
const all = (a: Area) => ACTIONS[a];
export const ROLES: Role[] = [
  { id: 'owner', name: 'Owner', kind: 'Built-in', desc: 'Everything, including billing and deleting the tenant.', perms: { Platform: all('Platform'), Protection: all('Protection'), Resilience: all('Resilience'), Mobility: all('Mobility'), Billing: all('Billing') }, users: 6, scopeHint: 'A whole customer', updated: T('18 Jan', '09:20') },
  { id: 'admin', name: 'Admin', kind: 'Built-in', desc: 'Everything except billing and deleting the tenant.', perms: { Platform: all('Platform'), Protection: all('Protection'), Resilience: all('Resilience'), Mobility: all('Mobility'), Billing: ['View invoices'] }, users: 3, scopeHint: 'Customer, department or project', updated: T('18 Jan', '09:20') },
  { id: 'operator', name: 'Operator', kind: 'Built-in', desc: 'Runs and restores; cannot change policies, connections or people.', perms: { Platform: ['View', 'View audit'], Protection: ['View', 'Back up', 'Restore', 'Restore files only'], Resilience: ['View', 'Run drills'], Mobility: ['View', 'Sync and test'] }, users: 0, scopeHint: 'Project', updated: T('18 Jan', '09:20') },
  { id: 'restore', name: 'Restore', kind: 'Built-in', desc: 'Restores files and disks with an approved exception.', perms: { Platform: ['View'], Protection: ['View', 'Restore files only'] }, users: 0, scopeHint: 'Project', updated: T('18 Jan', '09:20') },
  { id: 'viewer', name: 'Viewer', kind: 'Built-in', desc: 'Sees everything in scope; changes nothing.', perms: { Platform: ['View'], Protection: ['View'], Resilience: ['View'], Mobility: ['View'] }, users: 0, scopeHint: 'Any', updated: T('18 Jan', '09:20') },
  { id: 'bko', name: 'Backup Operator', kind: 'Template', desc: 'Runs backups and watches jobs.', perms: { Platform: ['View'], Protection: ['View', 'Back up'] }, users: 2, scopeHint: 'Project or site', updated: T('18 Jan', '09:20') },
  { id: 'rso', name: 'Restore Operator', kind: 'Template', desc: 'Restores whole VMs, disks and files.', perms: { Platform: ['View'], Protection: ['View', 'Restore', 'Restore files only'] }, users: 2, scopeHint: 'Project or workload tag', updated: T('18 Jan', '09:20') },
  { id: 'dra', name: 'DR Architect', kind: 'Template', desc: 'Designs protection and recovery plans; cannot fail over.', perms: { Platform: ['View', 'Manage policies'], Resilience: ['View', 'Edit plans', 'Run drills'] }, users: 1, scopeHint: 'Customer or project', updated: T('18 Jan', '09:20') },
  { id: 'dro', name: 'Drill Operator', kind: 'Template', desc: 'Starts and cleans up test failovers in the isolated network.', perms: { Platform: ['View'], Resilience: ['View', 'Run drills'] }, users: 0, scopeHint: 'Application or recovery plan', updated: T('18 Jan', '09:20') },
  { id: 'foa', name: 'Failover Approver', kind: 'Template', desc: 'Approves planned and unplanned failovers.', perms: { Platform: ['View', 'Approve'], Resilience: ['View', 'Approve failover'] }, users: 1, scopeHint: 'Recovery plan', updated: T('18 Jan', '09:20') },
  { id: 'mip', name: 'Migration Planner', kind: 'Template', desc: 'Assesses sources and plans waves.', perms: { Platform: ['View'], Mobility: ['View', 'Plan waves', 'Sync and test'] }, users: 1, scopeHint: 'Project', updated: T('18 Jan', '09:20') },
  { id: 'mia', name: 'Migration Approver', kind: 'Template', desc: 'Gives the go or no-go for cutovers.', perms: { Platform: ['View', 'Approve'], Mobility: ['View', 'Approve cutover'] }, users: 1, scopeHint: 'Wave', updated: T('18 Jan', '09:20') },
  { id: 'aud', name: 'Auditor', kind: 'Template', desc: 'Reads everything, including the audit log and evidence. Changes nothing.', perms: { Platform: ['View', 'View audit'], Protection: ['View'], Resilience: ['View'], Mobility: ['View'], Billing: ['View invoices'] }, users: 1, scopeHint: 'Customer', updated: T('18 Jan', '09:20') },
  { id: 'ro', name: 'Read-only', kind: 'Template', desc: 'Sees status in scope. No audit, no billing.', perms: { Platform: ['View'], Protection: ['View'], Resilience: ['View'], Mobility: ['View'] }, users: 1, scopeHint: 'Any', updated: T('18 Jan', '09:20') },
  { id: 'c-tlr', name: 'Treasury DR lead', kind: 'Custom', desc: 'Runs drills and fails over Treasury only, from the bank network.', perms: { Platform: ['View'], Resilience: ['View', 'Run drills', 'Fail over', 'Fail back'], Protection: ['View', 'Restore files only'] }, users: 0, scopeHint: 'Application: Treasury', ip: ['115.112.40.0/24', '10.12.0.0/16'], owner: 'Meridian Cooperative Bank', updated: T('09 Oct', '12:10') },
  { id: 'c-kfin', name: 'Kaveri finance restore', kind: 'Custom', desc: 'File restores from the finance server, with an exception.', perms: { Platform: ['View'], Protection: ['View', 'Restore files only'] }, users: 0, scopeHint: 'Workload tag: tally', owner: 'Kaveri Logistics Pvt Ltd', updated: T('02 Aug', '16:00'), ip: ['49.204.0.0/16'] }
];

// ---- licensing ----
export interface Entitlement {
  id: string;
  customer: string;
  product: ProductName | 'Bundle';
  edition: string;
  metric: string;
  used: number;
  limit: number;
  unit: string;
  term: string;
  starts: string;
  expires: string;
  days: number;
  state: 'active' | 'trial' | 'grace' | 'overage' | 'suspended' | 'expired';
  activation: 'Online' | 'Offline file';
  support?: string;
  note?: string;
}
export const ENTITLEMENTS: Entitlement[] = [
  { id: 'e1', customer: 'h360', product: 'Bundle', edition: 'Enterprise bundle', metric: 'Protected sockets', used: 24, limit: 32, unit: 'sockets', term: 'Annual', starts: '01 Apr 2026', expires: '31 Mar 2027', days: 161, state: 'active', activation: 'Online', note: 'One contract and one renewal date for all three products' },
  { id: 'e2', customer: 'mer', product: 'Protection', edition: 'Enterprise', metric: 'Protected workloads', used: 38, limit: 50, unit: 'workloads', term: 'Annual', starts: '01 Apr 2026', expires: '31 Mar 2027', days: 161, state: 'active', activation: 'Online' },
  { id: 'e3', customer: 'mer', product: 'Resilience', edition: 'Enterprise · Tier 0 and 1', metric: 'Replicated workloads', used: 23, limit: 20, unit: 'workloads', term: 'Annual', starts: '01 Apr 2026', expires: '31 Mar 2027', days: 161, state: 'overage', activation: 'Online', note: '3 workloads over · billed at ₹2,400 each per month' },
  { id: 'e4', customer: 'mer', product: 'Mobility', edition: 'Project · 60 workloads', metric: 'Migrated workloads', used: 15, limit: 60, unit: 'workloads', term: 'Project, 12 months', starts: '03 Mar 2026', expires: '02 Mar 2027', days: 132, state: 'active', activation: 'Online' },
  { id: 'e5', customer: 'kav', product: 'Protection', edition: 'Business', metric: 'Stored data', used: 4.2, limit: 10, unit: 'TB', term: 'Monthly', starts: '27 May 2026', expires: '26 Nov 2026', days: 36, state: 'active', activation: 'Online' },
  { id: 'e6', customer: 'kav', product: 'Resilience', edition: 'Business', metric: 'Replicated workloads', used: 9, limit: 10, unit: 'workloads', term: 'Monthly', starts: '27 May 2026', expires: '26 Nov 2026', days: 36, state: 'active', activation: 'Online' },
  { id: 'e7', customer: 'sah', product: 'Protection', edition: 'Business (perpetual)', metric: 'Protected workloads', used: 18, limit: 25, unit: 'workloads', term: 'Perpetual with annual support', starts: '14 Jul 2026', expires: 'Never', days: 9999, state: 'active', activation: 'Offline file', support: 'Support renews 13 Jul 2027' },
  { id: 'e8', customer: 'nil', product: 'Protection', edition: 'Trial', metric: 'Protected workloads', used: 6, limit: 10, unit: 'workloads', term: '30-day trial', starts: '05 Oct 2026', expires: '04 Nov 2026', days: 14, state: 'trial', activation: 'Online' },
  { id: 'e9', customer: 'atl', product: 'Mobility', edition: 'Project · 120 workloads', metric: 'Migrated workloads', used: 0, limit: 120, unit: 'workloads', term: 'Project, 9 months', starts: '01 Nov 2026', expires: '31 Jul 2027', days: 283, state: 'active', activation: 'Online', note: 'Starts 01 Nov 2026' },
  { id: 'e10', customer: 'cor', product: 'Protection', edition: 'Business', metric: 'Protected workloads', used: 12, limit: 15, unit: 'workloads', term: 'Monthly', starts: '09 Apr 2026', expires: '08 Nov 2026', days: 18, state: 'suspended', activation: 'Online', note: 'Suspended for non-payment on 18 Oct 2026. Backups keep running for 7 days; restores are blocked.' }
];

// ---- policies ----
export type PolicyType = 'Backup' | 'DR' | 'Migration';
export interface Policy {
  id: string;
  name: string;
  type: PolicyType;
  level: 'Global' | 'Tenant' | 'Workload';
  owner: string;
  inherits?: string;
  version: number;
  updated: string;
  updatedBy: string;
  assigned: number;
  drift: number;
  settings: [string, string][];
  overrides?: string[];
  template?: boolean;
  residency?: string;
  /** Resilience plans only: what the plan promises. */
  dr?: { tier: Tier; rpo: string; rto: string; mode: 'Continuous' | 'Scheduled'; every?: string; dest: string };
}
export const POLICIES: Policy[] = [
  { id: 'g-bk-daily', name: 'Production daily', type: 'Backup', level: 'Global', owner: 'Host360', version: 7, updated: T('14 Oct', '10:20'), updatedBy: 'arun.kumar', assigned: 89, drift: 2, template: true,
    settings: [['Schedule', 'Daily at 02:00'], ['Retention', '14 daily · 4 weekly · 12 monthly · 1 yearly'], ['Repository', 'obj-check'], ['Offsite copy', 'copy-check-repo'], ['Immutability', 'Compliance lock, 14 d'], ['Encryption', 'AES-256, key from the Host360 KMS'], ['Consistency', 'Application'], ['Backup window', '01:00 to 06:00']] },
  { id: 'g-bk-db', name: 'Database hourly', type: 'Backup', level: 'Global', owner: 'Host360', version: 4, updated: T('02 Sep', '12:00'), updatedBy: 'arun.kumar', assigned: 12, drift: 0, template: true,
    settings: [['Schedule', 'Every hour'], ['Retention', '48 hourly · 7 daily · 4 weekly'], ['Repository', 'obj-check'], ['Offsite copy', 'None'], ['Immutability', 'Compliance lock, 14 d'], ['Encryption', 'AES-256'], ['Consistency', 'Application'], ['Backup window', 'Any time']] },
  { id: 'g-bk-lab', name: 'Lab weekly', type: 'Backup', level: 'Global', owner: 'Host360', version: 2, updated: T('11 Apr', '09:10'), updatedBy: 'priya.raman', assigned: 9, drift: 0, template: true,
    settings: [['Schedule', 'Sundays at 06:00'], ['Retention', '4 weekly'], ['Repository', 'repo-director-lab'], ['Immutability', 'None'], ['Encryption', 'None'], ['Consistency', 'Offline']] },
  { id: 't-kav-daily', name: 'Kaveri daily', type: 'Backup', level: 'Tenant', owner: 'Kaveri Logistics Pvt Ltd', inherits: 'Production daily', version: 3, updated: T('20 Aug', '14:40'), updatedBy: 'rahul@kaveri-logistics.in', assigned: 11, drift: 0, overrides: ['Schedule: Daily at 01:00', 'Repository: kav-repo-01'],
    settings: [['Schedule', 'Daily at 01:00 (overrides 02:00)'], ['Retention', 'Inherited: 14 daily · 4 weekly · 12 monthly · 1 yearly'], ['Repository', 'kav-repo-01 (overrides obj-check)'], ['Immutability', 'Inherited: compliance lock, 14 d']] },
  { id: 't-mer-db', name: 'Meridian database hourly', type: 'Backup', level: 'Tenant', owner: 'Meridian Cooperative Bank', inherits: 'Database hourly', version: 9, updated: T('19 Oct', '18:05'), updatedBy: 'anitha.k@meridianbank.in', assigned: 6, drift: 1, residency: 'India only', overrides: ['Immutability: Compliance lock, 30 d', 'Repository: mer-obj-immutable'],
    settings: [['Schedule', 'Inherited: every hour'], ['Retention', '168 hourly · 30 daily · 12 monthly (overrides)'], ['Repository', 'mer-obj-immutable · Mumbai'], ['Immutability', 'Compliance lock, 30 d (overrides 14 d)'], ['Encryption', 'AES-256, key from Meridian Thales HSM (BYOK)']] },
  { id: 'g-dr-bc', name: 'Business-critical', type: 'DR', level: 'Global', owner: 'Host360', version: 5, updated: T('21 Oct', '15:46'), updatedBy: 'priya.raman', assigned: 6, drift: 1, template: true,
    dr: { tier: 'Mission Critical', rpo: '15 min', rto: '1 h', mode: 'Scheduled', every: '15 min', dest: 'production-openstack' },
    settings: [['Criticality tier', 'Mission Critical (Tier 0)'], ['Recovery target (RPO)', '15 min'], ['Recovery time (RTO)', '1 h'], ['Replication mode', 'Scheduled every 15 min: snapshot and changed blocks'], ['Recovery site', 'production-openstack'], ['Versions kept', '2, one every 4 h'], ['Priority', 'Highest'], ['Drill cadence', 'Monthly']] },
  { id: 'g-dr-nc', name: 'Non-critical', type: 'DR', level: 'Global', owner: 'Host360', version: 2, updated: T('02 Jul', '10:00'), updatedBy: 'vivek.rao', assigned: 4, drift: 0, template: true,
    dr: { tier: 'Important', rpo: '1 d', rto: '24 h', mode: 'Scheduled', every: '1 d, 22:00 to 06:00', dest: 'production-openstack' },
    settings: [['Criticality tier', 'Important (Tier 2)'], ['Recovery target (RPO)', '1 d'], ['Recovery time (RTO)', '24 h'], ['Replication mode', 'Scheduled once a day, 22:00 to 06:00'], ['Recovery site', 'production-openstack'], ['Versions kept', '4'], ['Priority', 'Low'], ['Drill cadence', 'Every six months']] },
  { id: 't-mer-t0', name: 'Meridian Tier-0 replication', type: 'DR', level: 'Tenant', owner: 'Meridian Cooperative Bank', inherits: 'Business-critical', version: 6, updated: T('12 Oct', '11:30'), updatedBy: 'anitha.k@meridianbank.in', assigned: 5, drift: 0, residency: 'India only', overrides: ['Replication mode: continuous for cbs-db-01', 'Recovery site: inside India only', 'Drill cadence: quarterly with signed evidence (RBI)'],
    dr: { tier: 'Mission Critical', rpo: '15 min', rto: '1 h', mode: 'Continuous', dest: 'region-2-os, Chennai-proxmox-prod' },
    settings: [['Criticality tier', 'Inherited: Mission Critical (Tier 0)'], ['Recovery target (RPO)', 'Inherited: 15 min'], ['Recovery time (RTO)', 'Inherited: 1 h'], ['Replication mode', 'Continuous write journal for cbs-db-01 (overrides scheduled)'], ['Recovery site', 'region-2-os or Chennai-proxmox-prod, inside India (overrides any)'], ['Drill cadence', 'Quarterly with signed evidence (overrides monthly)']] },
  { id: 't-mer-t1', name: 'Meridian Tier-1 replication', type: 'DR', level: 'Tenant', owner: 'Meridian Cooperative Bank', inherits: 'Business-critical', version: 3, updated: T('20 Aug', '16:10'), updatedBy: 'anitha.k@meridianbank.in', assigned: 2, drift: 0, residency: 'India only', overrides: ['RPO: 1 h', 'RTO: 4 h', 'Physical servers: agent'],
    dr: { tier: 'Business Critical', rpo: '1 h', rto: '4 h', mode: 'Scheduled', every: '1 h', dest: 'Chennai-proxmox-prod, production-openstack' },
    settings: [['Criticality tier', 'Business Critical (Tier 1) (overrides Tier 0)'], ['Recovery target (RPO)', '1 h (overrides 15 min)'], ['Recovery time (RTO)', '4 h (overrides 1 h)'], ['Replication mode', 'Scheduled every hour; physical servers through the agent'], ['Recovery site', 'Inside India'], ['Drill cadence', 'Quarterly']] },
  { id: 't-kav-dr', name: 'Kaveri finance', type: 'DR', level: 'Tenant', owner: 'Kaveri Logistics Pvt Ltd', inherits: 'Business-critical', version: 2, updated: T('05 Sep', '14:30'), updatedBy: 'rahul@kaveri-logistics.in', assigned: 2, drift: 0, overrides: ['RPO: 1 h', 'RTO: 4 h'],
    dr: { tier: 'Business Critical', rpo: '1 h', rto: '4 h', mode: 'Scheduled', every: '1 h', dest: 'production-openstack' },
    settings: [['Criticality tier', 'Business Critical (Tier 1)'], ['Recovery target (RPO)', '1 h (overrides 15 min)'], ['Recovery time (RTO)', '4 h (overrides 1 h)'], ['Replication mode', 'Inherited: scheduled, every hour'], ['Recovery site', 'Inherited: production-openstack'], ['Drill cadence', 'Quarterly']] },
  { id: 'g-mig-std', name: 'Standard migration', type: 'Migration', level: 'Global', owner: 'Host360', version: 3, updated: T('01 Aug', '12:00'), updatedBy: 'meera.iyer', assigned: 10, drift: 0, template: true,
    settings: [['Sync passes', 'First full copy, then change tracking every 4 h'], ['Verification', 'Byte-for-byte before cutover'], ['Test boot', 'Required, isolated network'], ['Cutover approval', 'Migration Approver, go/no-go'], ['Driver injection', 'VirtIO for Windows'], ['After cutover', 'Assign backup and DR from the criticality tier']] },
  { id: 'w-sql01', name: 'SQL01 cutover override', type: 'Migration', level: 'Workload', owner: 'Meridian Cooperative Bank', inherits: 'Standard migration', version: 1, updated: T('17 Oct', '16:20'), updatedBy: 's.iyer@meridianbank.in', assigned: 1, drift: 0, overrides: ['Cutover approval: two approvers', 'Final sync: database quiesced'],
    settings: [['Cutover approval', 'Two approvers (overrides one)'], ['Final sync', 'SQL writer quiesced (overrides crash-consistent)']] }
];
export const POLICY_VERSIONS: Record<string, { v: number; when: string; by: string; note: string; diff: [string, string, string][] }[]> = {
  'g-dr-bc': [
    { v: 5, when: T('21 Oct', '15:46'), by: 'priya.raman', note: 'Tighter target after the Q3 drill', diff: [['Recovery target (RPO)', '30 min', '15 min']] },
    { v: 4, when: T('02 Sep', '11:00'), by: 'vivek.rao', note: 'Monthly drills for tier 0', diff: [['Drill cadence', 'Quarterly', 'Monthly']] },
    { v: 3, when: T('14 Jun', '10:00'), by: 'vivek.rao', note: 'Keep two versions', diff: [['Versions kept', '1', '2, one every 4 h']] }
  ],
  'g-bk-daily': [
    { v: 7, when: T('14 Oct', '10:20'), by: 'arun.kumar', note: 'Offsite copy to the NFS repository', diff: [['Offsite copy', 'None', 'copy-check-repo']] },
    { v: 6, when: T('02 Sep', '09:00'), by: 'arun.kumar', note: 'Compliance lock for ransomware protection', diff: [['Immutability', 'Governance lock, 7 d', 'Compliance lock, 14 d']] }
  ]
};

// ---- approvals ----
export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'expired' | 'used' | 'cancelled';
export interface Approval {
  id: string;
  kind: 'Restore exception' | 'Sensitive restore' | 'Delete recovery points' | 'Failover' | 'Cutover' | 'Policy change' | 'Unlock compliance mode' | 'Login as owner';
  object: string;
  customer: string;
  requester: string;
  approvers: string;
  needed: number;
  given: { who: string; when: string; note?: string }[];
  requested: string;
  expires: string;
  state: ApprovalState;
  reason: string;
  evidence: string[];
  rule: string;
}
export const APPROVALS: Approval[] = [
  { id: 'APR-1042', kind: 'Cutover', object: 'SQL01 · Wave 2', customer: 'mer', requester: 'meera.iyer', approvers: 'Migration Approver (2 of: Suresh Iyer, Anitha Krishnan)', needed: 2, given: [{ who: 's.iyer@meridianbank.in', when: T('21 Oct', '15:40'), note: 'Test boot reports verified.' }], requested: T('21 Oct', '14:30'), expires: T('24 Oct', '22:00'), state: 'pending', reason: 'Cut over SQL01 in the Sun 25 Oct window.', evidence: ['Test boot report TB-0912 (passed)', 'Byte-for-byte verification of 4 disks', 'Change record CHG0031872 (ServiceNow)'], rule: 'Cutovers of Mission Critical workloads need two approvers' },
  { id: 'APR-1041', kind: 'Restore exception', object: 'Files from web-frontend-01', customer: 'h360', requester: 'karthik.s', approvers: 'Owner or Admin of Base-Project', needed: 1, given: [], requested: T('21 Oct', '15:52'), expires: T('22 Oct', '15:52'), state: 'pending', reason: 'INC-20418: restore the deleted invoices folder for Finance.', evidence: ['Ticket INC-20418'], rule: 'Restore role users need an exception for each restore' },
  { id: 'APR-1040', kind: 'Failover', object: 'Treasury failover (planned)', customer: 'mer', requester: 'rohit.s@meridianbank.in', approvers: 'Failover Approver of Meridian-Treasury', needed: 1, given: [], requested: T('21 Oct', '13:05'), expires: T('21 Oct', '23:59'), state: 'pending', reason: 'Planned failover for the Mumbai DC2 power maintenance on 26 Oct.', evidence: ['Pre-flight check PF-221 (passed, 1 warning)', 'Maintenance notice MW-0098'], rule: 'Every failover needs a Failover Approver' },
  { id: 'APR-1039', kind: 'Delete recovery points', object: '14 points of legacy-erp in copy-check-repo', customer: 'h360', requester: 'arun.kumar', approvers: '2 of: Owner, Admin (department level)', needed: 2, given: [{ who: 'priya.raman', when: T('21 Oct', '12:10') }], requested: T('21 Oct', '11:58'), expires: T('22 Oct', '11:58'), state: 'pending', reason: 'Free 412 GB before Wave 3; legacy-erp is being retired.', evidence: ['Retention report RR-77'], rule: 'Two-level approval for deletion at department level' },
  { id: 'APR-1038', kind: 'Restore exception', object: 'Whole VM sql-prod-02 to Chennai_Lab_Proxmox', customer: 'h360', requester: 'divya.n', approvers: 'Owner or Admin of Base-Project', needed: 1, given: [{ who: 'priya.raman', when: T('21 Oct', '10:02') }], requested: T('21 Oct', '09:40'), expires: T('22 Oct', '09:40'), state: 'approved', reason: 'Month-end reconciliation copy for audit.', evidence: [], rule: 'Restore role users need an exception for each restore' },
  { id: 'APR-1036', kind: 'Restore exception', object: 'Table patient_admissions from his-db-01', customer: 'sah', requester: 'prakash@sahyadrihospitals.in', approvers: 'Owner plus sensitive-workload approver', needed: 2, given: [{ who: 'v.joshi@sahyadrihospitals.in', when: T('02 Oct', '13:40') }, { who: 'Data protection officer', when: T('02 Oct', '14:05') }], requested: T('02 Oct', '13:10'), expires: T('03 Oct', '13:10'), state: 'used', reason: 'Accidental update of 212 admission records.', evidence: ['Incident SH-INC-4410'], rule: 'Sensitive workloads need an additional approver' },
  { id: 'APR-1031', kind: 'Policy change', object: 'Business-critical v5 (RPO 30 → 15 min)', customer: 'h360', requester: 'priya.raman', approvers: 'Admin', needed: 1, given: [{ who: 'arun.kumar', when: T('21 Oct', '15:45') }], requested: T('21 Oct', '15:20'), expires: T('22 Oct', '15:20'), state: 'approved', reason: 'Q3 drill showed we can meet 15 min.', evidence: ['Drill report DR-Q3-07'], rule: 'Global DR policy changes need a second admin' },
  { id: 'APR-1027', kind: 'Unlock compliance mode', object: 'Coromandel Insurance', customer: 'cor', requester: 'lakshmi.n@coromandelins.in', approvers: '3 of: provider security officer, customer owner, customer DPO', needed: 3, given: [], requested: T('15 Oct', '10:00'), expires: T('18 Oct', '10:00'), state: 'expired', reason: 'Shorten retention to cut storage cost.', evidence: [], rule: 'Compliance mode unlock needs a quorum of three' },
  { id: 'APR-1022', kind: 'Restore exception', object: 'Files from mail-gw-01', customer: 'h360', requester: 'meera.iyer', approvers: 'Owner or Admin', needed: 1, given: [], requested: T('17 Oct', '08:20'), expires: T('18 Oct', '08:20'), state: 'rejected', reason: 'Lost mail queue configuration.', evidence: [], rule: 'Restore role users need an exception for each restore' }
];
export const APPROVAL_RULES = [
  { id: 'r1', action: 'Delete recovery points', scope: 'Department level and above', approvers: '2 of: Owner, Admin', expiry: '24 h', mandatory: true },
  { id: 'r2', action: 'Fail over (planned or unplanned)', scope: 'Every recovery plan', approvers: '1 Failover Approver', expiry: 'Until the window ends', mandatory: true },
  { id: 'r3', action: 'Cut over', scope: 'Mission Critical workloads', approvers: '2 Migration Approvers', expiry: 'Until the cutover window', mandatory: true },
  { id: 'r4', action: 'Cut over', scope: 'Other workloads', approvers: '1 Migration Approver', expiry: 'Until the cutover window', mandatory: false },
  { id: 'r5', action: 'Restore', scope: 'Users with the Restore role', approvers: '1 Owner or Admin', expiry: '24 h', mandatory: true },
  { id: 'r6', action: 'Restore', scope: 'Sensitive workloads', approvers: 'Owner plus a sensitive-workload approver', expiry: '24 h', mandatory: true },
  { id: 'r7', action: 'Change a global policy', scope: 'Global policies', approvers: '1 second Admin', expiry: '24 h', mandatory: false },
  { id: 'r8', action: 'Unlock compliance mode', scope: 'Customer', approvers: '3: provider security officer, customer owner, customer DPO', expiry: '72 h', mandatory: true },
  { id: 'r9', action: 'Log in as owner', scope: 'Regulated customers (RBI, IRDAI)', approvers: '1 customer owner', expiry: '4 h', mandatory: false }
];

// ---- extended audit ----
export interface AuditRec {
  id: string;
  who: string;
  as?: string;
  side: 'Provider' | 'Customer' | 'System';
  customer: string;
  what: string;
  object: string;
  when: string;
  ip: string;
  device: string;
  browser: string;
  corr: string;
  r: 'ok' | 'refused' | 'failed';
  note?: string;
  before?: [string, string][];
  after?: [string, string][];
}
export const AUDIT: AuditRec[] = [
  { id: 'au1', who: 'priya.raman', side: 'Provider', customer: 'h360', what: 'Changed DR policy Business-critical', object: 'Business-critical v4 → v5', when: T('21 Oct', '15:46'), ip: '10.20.1.44', device: 'Windows 11', browser: 'Edge 130', corr: 'c-7f3a91d2', r: 'ok', before: [['Recovery target (RPO)', '30 min']], after: [['Recovery target (RPO)', '15 min']] },
  { id: 'au2', who: 'karthik.s', side: 'Provider', customer: 'h360', what: 'Requested a restore exception', object: 'web-frontend-01 (files)', when: T('21 Oct', '15:52'), ip: '10.20.1.71', device: 'Windows 10', browser: 'Chrome 129', corr: 'c-91bb0c44', r: 'ok' },
  { id: 'au3', who: 'priya.raman', as: 'anitha.k@meridianbank.in', side: 'Provider', customer: 'mer', what: 'Opened the customer console as owner', object: 'Meridian Cooperative Bank', when: T('21 Oct', '14:02'), ip: '10.20.1.44', device: 'Windows 11', browser: 'Edge 130', corr: 'c-0a41fe10', r: 'ok', note: 'Reason: SR-5521, review Wave 2 plan with the customer.' },
  { id: 'au4', who: 'priya.raman', as: 'anitha.k@meridianbank.in', side: 'Provider', customer: 'mer', what: 'Edited migration wave', object: 'Wave 2 · Core banking reporting', when: T('21 Oct', '14:09'), ip: '10.20.1.44', device: 'Windows 11', browser: 'Edge 130', corr: 'c-0a41fe10', r: 'ok', before: [['Cutover window', 'Sun 25 Oct, 20:00 to 23:00']], after: [['Cutover window', 'Sun 25 Oct, 22:00 to 02:00']] },
  { id: 'au5', who: 'divya.n', side: 'Provider', customer: 'h360', what: 'Tried to start Bring online', object: 'sql-prod-02', when: T('21 Oct', '15:30'), ip: '10.20.1.90', device: 'macOS 15', browser: 'Safari 18', corr: 'c-55e2a7b9', r: 'refused', note: 'Role Read-only cannot bring servers online.' },
  { id: 'au6', who: 's.iyer@meridianbank.in', side: 'Customer', customer: 'mer', what: 'Approved cutover (1 of 2)', object: 'APR-1042 · SQL01', when: T('21 Oct', '15:40'), ip: '115.112.40.22', device: 'Windows 11', browser: 'Chrome 130', corr: 'c-a1c3990e', r: 'ok', note: 'Step-up MFA with an authenticator app.' },
  { id: 'au7', who: 'system', side: 'System', customer: 'h360', what: 'Purged recovery points from the recycle bin', object: '4 points (retention 30 d)', when: T('21 Oct', '03:00'), ip: 'aegis-orchestrator', device: '—', browser: '—', corr: 'c-sys-0300', r: 'ok' },
  { id: 'au8', who: 'arun.kumar', side: 'Provider', customer: 'h360', what: 'Tried to delete a recovery point', object: 'obj-check/sql-prod-02/2026-10-15T02:00', when: T('20 Oct', '18:40'), ip: '10.20.1.33', device: 'Ubuntu 24.04', browser: 'Firefox 131', corr: 'c-3b77d0aa', r: 'refused', note: 'Locked in compliance mode until 29 Oct 2026, 02:00 IST.' },
  { id: 'au9', who: 'unknown', side: 'Customer', customer: 'sah', what: 'Sign-in with a wrong password', object: 'prakash@sahyadrihospitals.in', when: T('21 Oct', '08:51'), ip: '203.0.113.24', device: 'Unknown', browser: 'curl 8.5', corr: 'c-f00d1e55', r: 'failed', note: 'Fifth failure; account locked for 30 min.' },
  { id: 'au10', who: 'scim (Entra ID)', side: 'System', customer: 'h360', what: 'Deactivated a user', object: 'vivek.rao@host360.ai', when: T('30 Sep', '18:05'), ip: 'graph.microsoft.com', device: '—', browser: 'SCIM 2.0', corr: 'c-scim-2209', r: 'ok', before: [['Status', 'Active']], after: [['Status', 'Deactivated']] },
  { id: 'au11', who: 'anitha.k@meridianbank.in', side: 'Customer', customer: 'mer', what: 'Changed backup policy Meridian database hourly', object: 'v8 → v9', when: T('19 Oct', '18:05'), ip: '115.112.40.19', device: 'Windows 11', browser: 'Edge 130', corr: 'c-61aa02f3', r: 'ok', before: [['Immutability', 'Compliance lock, 14 d']], after: [['Immutability', 'Compliance lock, 30 d']] },
  { id: 'au12', who: 'priya.raman', side: 'Provider', customer: 'atl', what: 'Tried to save backup policy', object: 'Atlas daily', when: T('18 Oct', '12:31'), ip: '10.20.1.44', device: 'Windows 11', browser: 'Edge 130', corr: 'c-9902ab1c', r: 'refused', note: 'Data residency rule RES-EU-01: obj-check is in Chennai, India.' },
  { id: 'au13', who: 'meera.iyer', side: 'Provider', customer: 'h360', what: 'Signed in', object: 'meera.iyer@host360.ai', when: T('21 Oct', '09:01'), ip: '10.20.1.52', device: 'macOS 15', browser: 'Chrome 130', corr: 'c-11aa22bb', r: 'ok' },
  { id: 'au14', who: 'priya.raman', side: 'Provider', customer: 'cor', what: 'Suspended a customer', object: 'Coromandel Insurance', when: T('18 Oct', '10:00'), ip: '10.20.1.44', device: 'Windows 11', browser: 'Edge 130', corr: 'c-dun-0817', r: 'ok', note: 'Dunning step 3: invoice INV-2026-0817 overdue 45 days.', before: [['Status', 'Active']], after: [['Status', 'Suspended']] }
];
export const SAVED_AUDIT_FILTERS = [
  { id: 'f1', name: 'Refused and failed actions', q: 'refused-failed' },
  { id: 'f2', name: 'Acting as a customer', q: 'impersonation' },
  { id: 'f3', name: 'Policy changes this week', q: 'policy' }
];

// ---- extended alerts ----
export interface PAlert {
  id: string;
  sev: 'critical' | 'warning' | 'info';
  title: string;
  object: string;
  customer: string;
  product: 'Protection' | 'Resilience' | 'Mobility' | 'Platform';
  raised: string;
  count: number;
  incident?: string;
  assignee?: string;
  state: 'open' | 'acknowledged' | 'suppressed' | 'escalated';
  rule: string;
  detail: string;
  escalation?: string;
}
export const P_ALERTS: PAlert[] = [
  { id: 'a1', sev: 'critical', title: 'Last sync failed', object: 'ad-dc-01', customer: 'h360', product: 'Resilience', raised: T('21 Oct', '12:25'), count: 3, state: 'escalated', rule: 'Replication failed (default)', detail: 'Snapshot failed: VMware Tools quiesce timed out after 600 s.', assignee: 'Arun Kumar', escalation: 'Paged on-call at 12:40 IST' },
  { id: 'a2', sev: 'warning', title: 'Behind recovery target', object: 'erp-db-01', customer: 'h360', product: 'Resilience', raised: T('21 Oct', '15:53'), count: 1, state: 'open', rule: 'RPO breached (default)', detail: 'Newest recovery point is 27 min old; target is 15 min.' },
  { id: 'a3', sev: 'warning', title: 'Site could not be read', object: 'region-2-os', customer: 'h360', product: 'Platform', raised: T('21 Oct', '14:52'), count: 1, incident: 'INC-region-2-os', state: 'acknowledged', rule: 'Connection unreachable (predefined)', detail: 'Keystone at 10.40.0.5:5000 did not answer within 30 s. 2 related alerts are grouped under it.', assignee: 'Priya Raman' },
  { id: 'a3b', sev: 'warning', title: 'Proxy has no heartbeat', object: 'aegis-proxy-nova-248d', customer: 'h360', product: 'Platform', raised: T('21 Oct', '14:53'), count: 1, incident: 'INC-region-2-os', state: 'acknowledged', rule: 'Appliance or proxy offline (predefined)', detail: 'No heartbeat since 14:52 IST.' },
  { id: 'a3c', sev: 'warning', title: 'Replication could not be read', object: 'billing-api-02', customer: 'h360', product: 'Resilience', raised: T('21 Oct', '14:54'), count: 1, incident: 'INC-region-2-os', state: 'acknowledged', rule: 'Replication unreachable (default)', detail: 'Destination region-2-os did not answer.' },
  { id: 'a4', sev: 'critical', title: 'Backup failed', object: 'file-srv-03', customer: 'h360', product: 'Protection', raised: T('21 Oct', '02:48'), count: 1, state: 'open', rule: 'Backup failed (default)', detail: 'Disk scsi1 read error at offset 412.6 GB. Change tracking was reset.' },
  { id: 'a5', sev: 'warning', title: 'Repository is read-only', object: 'test-repo', customer: 'h360', product: 'Protection', raised: T('21 Oct', '12:00'), count: 4, state: 'open', rule: 'Repository not writable (predefined)', detail: 'New recovery points cannot be written. Deduplicated 4 times since 12:00.' },
  { id: 'a6', sev: 'warning', title: 'Datastore almost full', object: 'esxi-edge-07', customer: 'h360', product: 'Mobility', raised: T('21 Oct', '13:10'), count: 1, state: 'open', rule: 'Storage above 90 % (custom)', detail: 'ds-edge-01 is 93 % full.' },
  { id: 'a7', sev: 'info', title: 'Update available', object: 'aegis-proxy-cmp6', customer: 'h360', product: 'Platform', raised: T('21 Oct', '09:02'), count: 1, state: 'suppressed', rule: 'Component out of date (predefined)', detail: 'Runs 4.1.3; the orchestrator runs 4.2.0. Suppressed until the maintenance window on 26 Oct.' },
  { id: 'a8', sev: 'warning', title: 'Behind recovery target', object: 'mum-oracle-phy-01', customer: 'mer', product: 'Resilience', raised: T('21 Oct', '14:40'), count: 2, state: 'open', rule: 'RPO breached (default)', detail: 'Agent upload throttled by the source impact governor; 1 h 26 min behind a 1 h target.' },
  { id: 'a9', sev: 'critical', title: 'Licence over its limit', object: 'Resilience · Meridian Cooperative Bank', customer: 'mer', product: 'Platform', raised: T('15 Oct', '09:00'), count: 1, state: 'acknowledged', rule: 'Entitlement overage (predefined)', detail: '23 of 20 replicated workloads. Overage is billed; nothing is stopped.', assignee: 'Priya Raman' },
  { id: 'a10', sev: 'warning', title: 'Backup finished with warnings', object: 'payments-api', customer: 'mer', product: 'Protection', raised: T('21 Oct', '12:04'), count: 6, state: 'open', rule: 'Backup warning (default)', detail: 'PVC payments-ledger skipped: snapshot class missing.' },
  { id: 'a12', sev: 'warning', title: 'Sync pass took longer than planned', object: 'SQL01', customer: 'mer', product: 'Mobility', raised: T('21 Oct', '13:40'), count: 1, state: 'open', rule: 'Migration pass slow (default)', detail: 'Pass 6 took 48 min against 30 min planned; VMware Tools 11.3 slows the quiesce. Cutover estimate is now 22 min of downtime.' },
  { id: 'a11', sev: 'warning', title: 'Account locked', object: 'prakash@sahyadrihospitals.in', customer: 'sah', product: 'Platform', raised: T('21 Oct', '08:51'), count: 5, state: 'open', rule: 'Repeated sign-in failures (predefined)', detail: '5 failed sign-ins from 203.0.113.24 in 2 min.' }
];
export const ALERT_RULES = [
  { id: 'ar1', name: 'Backup failed', kind: 'Default', product: 'Protection', sev: 'Critical', when: 'A backup job ends failed', route: 'Owner, Teams #aegis-alerts', dedupe: '1 h', on: true },
  { id: 'ar2', name: 'RPO breached', kind: 'Default', product: 'Resilience', sev: 'Warning → Critical after 2 × target', when: 'Newest point older than the target', route: 'DR on-call (PagerDuty)', dedupe: '30 min', on: true },
  { id: 'ar3', name: 'Connection unreachable', kind: 'Predefined', product: 'Platform', sev: 'Warning', when: 'A site does not answer for 30 s', route: 'Platform team', dedupe: 'Groups related alerts into one incident', on: true },
  { id: 'ar4', name: 'Appliance or proxy offline', kind: 'Predefined', product: 'Platform', sev: 'Warning', when: 'No heartbeat for 60 s', route: 'Platform team', dedupe: '1 h', on: true },
  { id: 'ar5', name: 'Storage above 90 %', kind: 'Custom', product: 'All', sev: 'Warning', when: 'Datastore or repository above 90 % for 10 min', route: 'Owner, e-mail', dedupe: '6 h', on: true },
  { id: 'ar6', name: 'Licence expires in 30 days', kind: 'Predefined', product: 'Platform', sev: 'Info', when: '30, 14 and 3 days before expiry', route: 'Customer owner, account manager', dedupe: '1 day', on: true },
  { id: 'ar7', name: 'Drill overdue', kind: 'Default', product: 'Resilience', sev: 'Warning', when: 'No drill within the tier cadence', route: 'DR Architect', dedupe: '1 day', on: true },
  { id: 'ar8', name: 'Cutover window missed', kind: 'Custom', product: 'Mobility', sev: 'Warning', when: 'A cutover did not start in its window', route: 'Migration Planner', dedupe: 'Once', on: false }
];
export const MAINT_WINDOWS = [
  { id: 'mw1', name: 'Proxy upgrades to 4.2.0', scope: 'aegis-proxy-cmp4, cmp5, cmp6', starts: T('26 Oct', '01:00'), ends: T('26 Oct', '03:00'), suppress: 'Component out of date, Proxy offline', state: 'Scheduled' },
  { id: 'mw2', name: 'Mumbai DC2 power maintenance', scope: 'Meridian-Treasury', starts: T('26 Oct', '06:00'), ends: T('26 Oct', '14:00'), suppress: 'All warnings for the scope', state: 'Scheduled' }
];

// ---- global search ----
export interface SearchHit { kind: string; label: string; sub: string; route: string; id?: string; icon: string }
