/* Internal Admin Portal sample data: what Host360 staff run behind the product. Managed
   backup accounts, hardware in Host360 data centres and at customer sites, predefined
   templates, maintenance windows with customer communication, and on-premises deployments. */
import { T } from './platform';

export interface ManagedAccount {
  id: string;
  customer: string;
  service: 'Fully managed backup' | 'Managed DR runbook service' | 'Co-managed (customer operates)';
  sla: string;
  manager: string;
  lead: string;
  review: string;
  lastReport: string;
  openRequests: number;
  health: 'ok' | 'warn' | 'err';
  note?: string;
  scope: string[];
}

export const MANAGED: ManagedAccount[] = [
  { id: 'ma-mer', customer: 'mer', service: 'Managed DR runbook service', sla: 'Restore starts within 30 min · failover decision support 24×7', manager: 'Karthik Subramanian', lead: 'arun.kumar', review: 'Monthly, first Tuesday', lastReport: '07 Oct 2026', openRequests: 2, health: 'warn', note: 'Two Tier 1 workloads over the RPO since region-2-os stopped answering at 14:52.', scope: ['Backup of 38 VMs, 4 databases, 6 namespaces', 'Replication of 23 workloads to region-2-os', 'Quarterly DR test with RBI evidence pack'] },
  { id: 'ma-kav', customer: 'kav', service: 'Fully managed backup', sla: 'Restore starts within 2 h, business hours', manager: 'Lakshmi Narayanan', lead: 'deepa.s', review: 'Quarterly', lastReport: '01 Oct 2026', openRequests: 0, health: 'ok', scope: ['Backup of 22 VMs and 2 databases', 'Monthly restore test of kav-wms-db'] },
  { id: 'ma-sah', customer: 'sah', service: 'Co-managed (customer operates)', sla: 'Through CloudNest IT Services; Host360 is second line', manager: 'CloudNest IT Services', lead: 'deepa.s', review: 'Quarterly with CloudNest', lastReport: '30 Sep 2026', openRequests: 1, health: 'warn', note: 'Restore test on his-db-01 is 9 days overdue (GOV-00224); SLA credit raised.', scope: ['Platform and repositories only', 'Escalations from CloudNest'] },
  { id: 'ma-cor', customer: 'cor', service: 'Fully managed backup', sla: 'Restore starts within 2 h, business hours', manager: 'Lakshmi Narayanan', lead: 'arun.kumar', review: 'Quarterly', lastReport: '01 Sep 2026', openRequests: 1, health: 'err', note: 'Suspended for non-payment since 07 Oct. Backups keep running; restores are blocked.', scope: ['Backup of 31 VMs'] }
];

export type HwState = 'In service' | 'Provisioning' | 'Fault' | 'Retiring';
export interface Hardware {
  id: string;
  site: string;
  kind: 'Backup appliance' | 'Storage node' | 'Proxy server' | 'Object storage node' | 'Top-of-rack switch';
  model: string;
  serial: string;
  rack: string;
  tenant: string;
  capacity: string;
  firmware: string;
  warranty: string;
  warrantyDays: number;
  state: HwState;
  note?: string;
}

export const HARDWARE: Hardware[] = [
  { id: 'hw1', site: 'Chennai DC1 (Ambattur)', kind: 'Backup appliance', model: 'Dell PowerEdge R760xd2', serial: 'CN7R760-4H2K9Q3', rack: 'R14 · U22–U23', tenant: 'Shared', capacity: '24 × 22 TB NL-SAS, 2 × 3.84 TB NVMe cache', firmware: 'iDRAC 7.10.50 · BIOS 2.3.5', warranty: '14 Mar 2029', warrantyDays: 874, state: 'In service' },
  { id: 'hw2', site: 'Chennai DC1 (Ambattur)', kind: 'Object storage node', model: 'Supermicro SSG-640SP-E1CR90', serial: 'SM640-A9X22018', rack: 'R15 · U10–U13', tenant: 'Shared', capacity: '90 × 20 TB (MinIO, erasure 8+4)', firmware: 'BMC 1.03.10 · BIOS 1.6a', warranty: '02 Jun 2028', warrantyDays: 589, state: 'In service' },
  { id: 'hw3', site: 'Chennai DC1 (Ambattur)', kind: 'Object storage node', model: 'Supermicro SSG-640SP-E1CR90', serial: 'SM640-A9X22019', rack: 'R15 · U14–U17', tenant: 'Shared', capacity: '90 × 20 TB (MinIO, erasure 8+4)', firmware: 'BMC 1.03.10 · BIOS 1.6a', warranty: '02 Jun 2028', warrantyDays: 589, state: 'Fault', note: 'Disk 47 failed at 09:12 IST; rebuild 38 % done. Replacement HDD shipped (Dell case 192884410).' },
  { id: 'hw4', site: 'Chennai DC1 (Ambattur)', kind: 'Proxy server', model: 'HPE ProLiant DL360 Gen11', serial: 'CZJ3420K7M', rack: 'R14 · U30', tenant: 'Shared', capacity: '2 × Xeon Gold 6430, 256 GB, 2 × 25 GbE', firmware: 'iLO 6 1.58 · SPP 2026.03', warranty: '30 Nov 2026', warrantyDays: 40, state: 'In service', note: 'Warranty ends in 40 days; renewal quote HPE-Q-55102 pending.' },
  { id: 'hw5', site: 'Chennai DC1 (Ambattur)', kind: 'Top-of-rack switch', model: 'Arista 7050CX3-32S', serial: 'JPE22451199', rack: 'R14 · U42', tenant: 'Shared', capacity: '32 × 100 GbE', firmware: 'EOS 4.31.2F', warranty: '10 Jan 2028', warrantyDays: 446, state: 'In service' },
  { id: 'hw6', site: 'Mumbai DC2 (Mahape)', kind: 'Backup appliance', model: 'Dell PowerEdge R760xd2', serial: 'CN7R760-4H2K9Q8', rack: 'B07 · U18–U19', tenant: 'Meridian Cooperative Bank (dedicated)', capacity: '24 × 22 TB NL-SAS, immutable object lock', firmware: 'iDRAC 7.10.50 · BIOS 2.3.5', warranty: '20 Apr 2029', warrantyDays: 911, state: 'In service' },
  { id: 'hw7', site: 'Mumbai DC2 (Mahape)', kind: 'Storage node', model: 'Dell PowerStore 1200T', serial: 'PS1200-8QK44Z1', rack: 'B07 · U24–U25', tenant: 'Meridian Cooperative Bank (dedicated)', capacity: '96 TB usable (DR staging for region-2-os)', firmware: 'PowerStoreOS 4.0.0.1', warranty: '20 Apr 2029', warrantyDays: 911, state: 'In service' },
  { id: 'hw8', site: 'Frankfurt (Equinix FR5)', kind: 'Backup appliance', model: 'Dell PowerEdge R760xd2', serial: 'CN7R760-5A1L0R2', rack: 'Cage 3 · R02 · U10–U11', tenant: 'Atlas Freight GmbH (dedicated)', capacity: '12 × 22 TB NL-SAS', firmware: 'iDRAC 7.10.50 · BIOS 2.3.5', warranty: '15 Oct 2029', warrantyDays: 1089, state: 'Provisioning', note: 'Racked 14 Oct. Burn-in passed; waiting for the cross-connect to Atlas (Equinix order 1-229384114).' },
  { id: 'hw9', site: 'Sahyadri Hospitals, Pune (customer site)', kind: 'Proxy server', model: 'Lenovo ThinkSystem SR630 V3', serial: 'J30B7XK2', rack: 'Server room 2 · R03 · U12', tenant: 'Sahyadri Hospitals (on loan)', capacity: '2 × Xeon Silver 4410Y, 128 GB', firmware: 'XCC 3.20 · UEFI 2.10', warranty: '01 Aug 2027', warrantyDays: 284, state: 'In service' },
  { id: 'hw10', site: 'Chennai DC1 (Ambattur)', kind: 'Backup appliance', model: 'Dell PowerEdge R740xd2', serial: 'CN7R740-2B8M1T6', rack: 'R12 · U20–U21', tenant: 'Shared', capacity: '24 × 12 TB NL-SAS', firmware: 'iDRAC 6.10.80 · BIOS 2.19.1', warranty: '30 Sep 2026', warrantyDays: -21, state: 'Retiring', note: 'Out of warranty. Data moved to hw1; wipe to NIST 800-88 and certificate due by 31 Oct.' }
];

export const DCS = [
  { id: 'chn', name: 'Chennai DC1 (Ambattur)', kind: 'Host360 data centre', tier: 'Tier III', power: '2N, 2 × 1,250 kVA DG', racks: 6, region: 'India South', contact: 'NOC +91 44 4900 2100' },
  { id: 'mum', name: 'Mumbai DC2 (Mahape)', kind: 'Host360 data centre', tier: 'Tier III', power: 'N+1', racks: 2, region: 'India West', contact: 'NOC +91 22 6122 4400' },
  { id: 'fra', name: 'Frankfurt (Equinix FR5)', kind: 'Colocation', tier: 'Tier III+', power: '2N', racks: 1, region: 'EU Central', contact: 'Equinix Smart Hands, cage 3' },
  { id: 'pun', name: 'Sahyadri Hospitals, Pune (customer site)', kind: 'Customer site', tier: '—', power: 'UPS only', racks: 0, region: 'India West', contact: 'Prakash Kumar, IT' }
];

export type TplKind = 'Alert rule' | 'Notification' | 'Backup policy' | 'DR plan' | 'Migration profile' | 'Report';
export interface Template {
  id: string;
  kind: TplKind;
  name: string;
  version: number;
  updated: string;
  by: string;
  used: number;
  mandatory?: boolean;
  summary: string;
  channels?: string[];
  subject?: string;
  body?: string;
  vars?: string[];
}

export const TEMPLATES: Template[] = [
  { id: 't1', kind: 'Alert rule', name: 'Backup failed twice in a row', version: 4, updated: T('02 Oct', '11:20'), by: 'priya.raman', used: 7, mandatory: true, summary: 'Critical when the same workload fails two scheduled backups in a row; pages on-call for Mission Critical.' },
  { id: 't2', kind: 'Alert rule', name: 'RPO breached', version: 3, updated: T('18 Sep', '15:02'), by: 'arun.kumar', used: 5, mandatory: true, summary: 'Warning at 100 % of the tier RPO, critical at 200 %. Suppressed during maintenance windows.' },
  { id: 't3', kind: 'Alert rule', name: 'Repository 85 % full', version: 2, updated: T('11 Aug', '09:40'), by: 'priya.raman', used: 7, summary: 'Warning at 85 %, critical at 95 %; includes the forecast date it fills.' },
  { id: 't4', kind: 'Alert rule', name: 'Certificate expires within 30 days', version: 1, updated: T('03 Jul', '10:10'), by: 'deepa.s', used: 7, summary: 'For sources, proxies and the orchestrator itself; repeats weekly.' },
  {
    id: 't5', kind: 'Notification', name: 'Maintenance scheduled', version: 6, updated: T('20 Oct', '17:45'), by: 'priya.raman', used: 7, mandatory: true, channels: ['E-mail', 'In-product banner'],
    summary: 'Sent 7 days and 24 hours before a window, in the customer’s time zone and brand.',
    subject: 'Planned maintenance on {{window.start_local}}',
    body: 'Hello {{customer.contact_first_name}},\n\n{{brand.name}} will carry out planned maintenance on {{window.components}} from {{window.start_local}} to {{window.end_local}} ({{customer.timezone}}).\n\nWhat changes for you: {{window.impact}}\nBackups and replication: {{window.protection_note}}\n\nIf this time does not suit you, reply before {{window.objection_deadline}}.\n\n{{brand.signature}}',
    vars: ['customer.contact_first_name', 'customer.timezone', 'brand.name', 'brand.signature', 'window.components', 'window.start_local', 'window.end_local', 'window.impact', 'window.protection_note', 'window.objection_deadline']
  },
  {
    id: 't6', kind: 'Notification', name: 'Maintenance completed', version: 3, updated: T('20 Oct', '17:50'), by: 'priya.raman', used: 7, channels: ['E-mail', 'In-product banner'],
    summary: 'The success message sent when a window closes, with what changed.',
    subject: 'Maintenance complete: {{window.components}}',
    body: 'Hello {{customer.contact_first_name}},\n\nThe maintenance on {{window.components}} finished at {{window.end_actual_local}}. {{window.result}}\n\nNothing is needed from you. Missed backups were re-run at {{window.catch_up_local}}.\n\n{{brand.signature}}',
    vars: ['customer.contact_first_name', 'brand.signature', 'window.components', 'window.end_actual_local', 'window.result', 'window.catch_up_local']
  },
  { id: 't7', kind: 'Notification', name: 'Restore finished', version: 2, updated: T('14 Aug', '12:00'), by: 'deepa.s', used: 7, channels: ['E-mail', 'Teams', 'Webhook'], summary: 'To the person who asked for the restore and the workload owner.', subject: 'Restore of {{job.object}} finished', body: '{{job.object}} was restored to {{job.target}} at {{job.end_local}}. Verified: {{job.verified}}.', vars: ['job.object', 'job.target', 'job.end_local', 'job.verified'] },
  { id: 't8', kind: 'Backup policy', name: 'Database hourly · immutable 30 d', version: 5, updated: T('01 Oct', '09:00'), by: 'priya.raman', used: 4, mandatory: true, summary: 'Mission Critical tier. Hourly log backups, daily full, 30-day object lock, offsite copy to Mumbai DC2.' },
  { id: 't9', kind: 'Backup policy', name: 'Production daily · immutable 14 d', version: 7, updated: T('24 Sep', '16:30'), by: 'priya.raman', used: 6, summary: 'Business Critical tier. Daily at 02:00 local, 14-day object lock, offsite copy.' },
  { id: 't10', kind: 'DR plan', name: 'Three-tier application', version: 3, updated: T('10 Sep', '11:15'), by: 'arun.kumar', used: 3, summary: 'Database, then application, then web; health check between each; DNS switch last.' },
  { id: 't11', kind: 'DR plan', name: 'Core banking (RBI)', version: 2, updated: T('28 Aug', '14:40'), by: 'arun.kumar', used: 1, mandatory: true, summary: 'Two approvers, step-up MFA, evidence pack for the RBI IT examination.' },
  { id: 't12', kind: 'Migration profile', name: 'Windows to OpenStack', version: 4, updated: T('15 Oct', '10:05'), by: 'deepa.s', used: 2, summary: 'VirtIO 0.1.262 drivers, UEFI to OVMF, QEMU guest agent, remove VMware Tools, static IP kept.' },
  { id: 't13', kind: 'Migration profile', name: 'Linux to Proxmox VE', version: 3, updated: T('15 Oct', '10:08'), by: 'deepa.s', used: 2, summary: 'Rebuild initramfs with virtio modules, cloud-init off, open-vm-tools removed.' },
  { id: 't14', kind: 'Report', name: 'Monthly service review', version: 5, updated: T('30 Sep', '18:00'), by: 'priya.raman', used: 4, summary: 'Protection success, RPO compliance, restores, DR tests, open requests and next month’s changes.' },
  { id: 't15', kind: 'Report', name: 'RBI DR evidence pack', version: 2, updated: T('28 Aug', '14:45'), by: 'arun.kumar', used: 1, mandatory: true, summary: 'Signed PDF: drill timeline, RTO and RPO achieved, approvals, deviations and sign-off.' }
];

export interface Maint {
  id: string;
  name: string;
  components: string;
  startUtc: string;
  endUtc: string;
  ist: string;
  tenants: string[];
  impact: string;
  state: 'Scheduled' | 'In progress' | 'Completed' | 'Cancelled';
  page: boolean;
  sent: { customer: string; brand: string; when: string; what: string }[];
  log?: { t: string; text: string; lv: 'info' | 'ok' | 'warn' | 'err' }[];
  result?: string;
}

export const MAINT: Maint[] = [
  {
    id: 'mx1', name: 'Proxy upgrades to 4.2.0', components: 'aegis-proxy-cmp4, cmp5, cmp6', startUtc: '25 Oct 2026, 19:30 UTC', endUtc: '25 Oct 2026, 21:30 UTC', ist: '26 Oct, 01:00 to 03:00 IST', tenants: ['h360', 'mer', 'kav'], impact: 'Backups that would start in the window start when it ends.', state: 'Scheduled', page: false,
    sent: [{ customer: 'mer', brand: 'Host360', when: '19 Oct 2026, 10:00 IST', what: '7-day notice' }, { customer: 'kav', brand: 'Host360', when: '19 Oct 2026, 10:00 IST', what: '7-day notice' }]
  },
  {
    id: 'mx2', name: 'Mumbai DC2 power maintenance', components: 'Mumbai DC2 (Mahape): backup appliance and storage', startUtc: '26 Oct 2026, 00:30 UTC', endUtc: '26 Oct 2026, 08:30 UTC', ist: '26 Oct, 06:00 to 14:00 IST', tenants: ['mer'], impact: 'Offsite copies to Mumbai pause; restores from Mumbai are unavailable.', state: 'Scheduled', page: false,
    sent: [{ customer: 'mer', brand: 'Host360', when: '19 Oct 2026, 10:00 IST', what: '7-day notice' }]
  },
  {
    id: 'mx3', name: 'Orchestrator upgrade to 4.2.1', components: 'aegis-orchestrator (Chennai) and warm standby (Mumbai)', startUtc: '01 Nov 2026, 20:30 UTC', endUtc: '01 Nov 2026, 22:30 UTC', ist: '02 Nov, 02:00 to 04:00 IST', tenants: ['h360', 'mer', 'kav', 'sah', 'nil', 'atl', 'cor'], impact: 'The console shows a maintenance page for up to 20 minutes. Running jobs continue.', state: 'Scheduled', page: true,
    sent: []
  },
  {
    id: 'mx4', name: 'Object storage firmware', components: 'Chennai DC1 object storage (MinIO nodes)', startUtc: '12 Oct 2026, 20:30 UTC', endUtc: '12 Oct 2026, 22:30 UTC', ist: '13 Oct, 02:00 to 04:00 IST', tenants: ['h360', 'kav', 'sah', 'cor'], impact: 'Backups to obj-check paused and re-run after.', state: 'Completed', page: false, result: 'Completed in 1 h 22 min; 14 backups re-run at 03:30 IST, all succeeded.',
    sent: [
      { customer: 'kav', brand: 'Host360', when: '05 Oct 2026, 10:00 IST', what: '7-day notice' },
      { customer: 'sah', brand: 'CloudNest Resilience', when: '05 Oct 2026, 10:00 IST', what: '7-day notice (white-labelled)' },
      { customer: 'kav', brand: 'Host360', when: '13 Oct 2026, 03:24 IST', what: 'Completed' },
      { customer: 'sah', brand: 'CloudNest Resilience', when: '13 Oct 2026, 03:24 IST', what: 'Completed (white-labelled)' }
    ],
    log: [
      { t: '02:00:04', text: 'Window opened by deepa.s; alerts for the scope suppressed', lv: 'info' },
      { t: '02:01:10', text: 'Backups to obj-check paused (14 queued)', lv: 'info' },
      { t: '02:06:42', text: 'SM640-A9X22018: BMC 1.03.10 applied, node rebooting', lv: 'info' },
      { t: '02:31:15', text: 'SM640-A9X22018 back in the pool; erasure set healthy', lv: 'ok' },
      { t: '02:33:02', text: 'SM640-A9X22019: BMC 1.03.10 applied, node rebooting', lv: 'info' },
      { t: '03:18:40', text: 'SM640-A9X22019 back in the pool; heal finished', lv: 'ok' },
      { t: '03:22:10', text: 'Window closed; alerts released (none raised)', lv: 'ok' },
      { t: '03:30:00', text: '14 backups re-run; all succeeded by 04:41', lv: 'ok' }
    ]
  }
];

export interface OnPrem {
  id: string;
  customer: string;
  site: string;
  version: string;
  patch: string;
  latest: string;
  connect: 'Online' | 'Air-gapped';
  licence: string;
  licenceDays: number;
  dbBackup: string;
  dbOk: boolean;
  cfgBackup: string;
  state: 'ok' | 'warn' | 'err';
  note?: string;
  nodes: number;
}

export const ONPREM: OnPrem[] = [
  { id: 'op-sah', customer: 'sah', site: 'Sahyadri Hospitals, Pune', version: '4.1.3', patch: '4.1.3-p2', latest: '4.2.0', connect: 'Online', licence: 'Online, checked 6-hourly · 25 workloads', licenceDays: 265, dbBackup: T('21 Oct', '02:00'), dbOk: true, cfgBackup: T('21 Oct', '02:05'), state: 'warn', note: 'One minor version behind; 4.2.0 fixes CVE-2026-31877 (medium) in the agent installer.', nodes: 2 },
  { id: 'op-cor', customer: 'cor', site: 'Coromandel Insurance, Chennai (Guindy)', version: '4.2.0', patch: '4.2.0-p1', latest: '4.2.0', connect: 'Air-gapped', licence: 'Offline file · ends 31 Dec 2026', licenceDays: 71, dbBackup: T('14 Oct', '02:00'), dbOk: false, cfgBackup: T('14 Oct', '02:05'), state: 'err', note: 'Internal database backup has failed for 7 days: the target share \\\\cor-nas-01\\aegis-cfg is read-only.', nodes: 1 },
  { id: 'op-atl', customer: 'atl', site: 'Atlas Freight, Hamburg', version: '4.2.0', patch: '4.2.0-p1', latest: '4.2.0', connect: 'Online', licence: 'Online, checked 6-hourly · onboarding', licenceDays: 375, dbBackup: T('21 Oct', '01:00'), dbOk: true, cfgBackup: T('21 Oct', '01:05'), state: 'ok', nodes: 1 }
];
