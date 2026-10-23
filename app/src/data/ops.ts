/* Sample data for Agents, Security & Compliance and Support. Times are in the orchestrator's zone (IST). */
import { T } from './platform';

export const CURRENT_AGENT = '4.2.0';

export interface Agent {
  id: string;
  machine: string;
  customer: string;
  kind: 'Windows agent' | 'Linux agent' | 'Kubernetes operator' | 'Endpoint agent' | 'Database plug-in';
  os: string;
  site: string;
  version: string;
  ring: 'Canary' | 'Early' | 'Broad';
  products: ('Protection' | 'Resilience' | 'Mobility')[];
  health: 'ok' | 'warn' | 'err' | 'unreach';
  heartbeat: string;
  note?: string;
  installed: string;
}

export const AGENTS: Agent[] = [
  { id: 'ag1', machine: 'SQL01', customer: 'mer', kind: 'Windows agent', os: 'Windows Server 2019', site: 'Chennai vCenter', version: '4.2.0', ring: 'Early', products: ['Resilience', 'Mobility'], health: 'ok', heartbeat: T('21 Oct', '16:04'), installed: T('04 Mar', '09:40') },
  { id: 'ag2', machine: 'SQL01\\CBSREPORT', customer: 'mer', kind: 'Database plug-in', os: 'SQL Server 2019 Enterprise', site: 'Chennai vCenter', version: '4.2.0', ring: 'Early', products: ['Resilience'], health: 'ok', heartbeat: T('21 Oct', '16:04'), installed: T('04 Mar', '09:41') },
  { id: 'ag3', machine: 'mum-oracle-phy-01', customer: 'mer', kind: 'Linux agent', os: 'Red Hat Enterprise Linux 8.9', site: 'Mumbai DC2', version: '4.1.3', ring: 'Broad', products: ['Protection', 'Resilience', 'Mobility'], health: 'warn', heartbeat: T('21 Oct', '16:03'), note: 'Upload throttled to 40 Mbit/s by the source impact governor (09:00–19:00).', installed: T('12 Jun', '11:20') },
  { id: 'ag4', machine: 'MBK-LT-0442', customer: 'mer', kind: 'Endpoint agent', os: 'Windows 11 23H2', site: 'Remote', version: '4.2.0', ring: 'Broad', products: ['Protection'], health: 'unreach', heartbeat: T('19 Oct', '18:22'), note: 'No heartbeat for 2 days; the laptop is probably off or away from the network.', installed: T('02 Aug', '10:05') },
  { id: 'ag5', machine: 'mer-k8s-prod', customer: 'mer', kind: 'Kubernetes operator', os: 'Kubernetes 1.29 (OpenShift 4.15)', site: 'production-openstack', version: '4.2.0', ring: 'Early', products: ['Protection'], health: 'warn', heartbeat: T('21 Oct', '16:04'), note: 'PVC payments-ledger skipped in the last 6 backups: snapshot class missing.', installed: T('20 May', '14:30') },
  { id: 'ag6', machine: 'sql-prod-02', customer: 'h360', kind: 'Windows agent', os: 'Windows Server 2022', site: 'Chennai-proxmox-prod', version: '4.2.1-rc2', ring: 'Canary', products: ['Protection', 'Resilience'], health: 'ok', heartbeat: T('21 Oct', '16:05'), installed: T('18 Jan', '12:00') },
  { id: 'ag7', machine: 'erp-db-01', customer: 'h360', kind: 'Database plug-in', os: 'Oracle Database 19c', site: 'Chennai-proxmox-prod', version: '4.2.0', ring: 'Early', products: ['Protection', 'Resilience'], health: 'warn', heartbeat: T('21 Oct', '16:04'), note: 'Application-consistent snapshot failed at 16:00; a crash-consistent point was taken.', installed: T('18 Jan', '12:10') },
  { id: 'ag8', machine: 'ad-dc-01', customer: 'h360', kind: 'Windows agent', os: 'Windows Server 2022', site: 'Chennai vCenter', version: '4.2.0', ring: 'Early', products: ['Resilience'], health: 'err', heartbeat: T('21 Oct', '16:04'), note: 'VMware Tools quiesce timed out after 600 s during the last sync.', installed: T('18 Jan', '12:20') },
  { id: 'ag9', machine: 'crm-db-01', customer: 'h360', kind: 'Windows agent', os: 'Windows Server 2019', site: 'Chennai vCenter', version: '4.2.0', ring: 'Broad', products: ['Mobility'], health: 'ok', heartbeat: T('21 Oct', '16:05'), installed: T('01 Sep', '10:00') },
  { id: 'ag10', machine: 'legacy-erp', customer: 'h360', kind: 'Linux agent', os: 'CentOS 7.9', site: 'esxi-edge-07', version: '4.0.8', ring: 'Broad', products: ['Mobility'], health: 'warn', heartbeat: T('21 Oct', '16:02'), note: 'Two versions behind. 4.0.8 is the last version that runs on CentOS 7.', installed: T('02 Feb', '09:15') },
  { id: 'ag11', machine: 'kav-wms-db', customer: 'kav', kind: 'Database plug-in', os: 'PostgreSQL 16', site: 'Chennai-proxmox-prod', version: '4.1.3', ring: 'Broad', products: ['Protection', 'Resilience'], health: 'ok', heartbeat: T('21 Oct', '16:04'), installed: T('27 May', '16:00') },
  { id: 'ag12', machine: 'his-db-01', customer: 'sah', kind: 'Linux agent', os: 'Red Hat Enterprise Linux 9.3', site: 'Chennai-proxmox-prod', version: '4.2.0', ring: 'Broad', products: ['Protection'], health: 'ok', heartbeat: T('21 Oct', '16:05'), installed: T('14 Jul', '12:45') },
  { id: 'ag13', machine: 'nil-pos-db', customer: 'nil', kind: 'Windows agent', os: 'Windows Server 2019', site: 'Chennai-proxmox-prod', version: '4.2.0', ring: 'Broad', products: ['Protection'], health: 'ok', heartbeat: T('21 Oct', '16:03'), installed: T('05 Oct', '18:10') }
];

/** Laptops and desktops with the endpoint agent: Meridian's 112 treasury and branch laptops, and Host360 staff machines. */
const endpoint = (i: number, customer: string, prefix: string): Agent => {
  const mac = i % 9 === 4;
  const off = i % 23 === 7;
  const old = i % 17 === 3;
  const hh = String(9 + (i % 7)).padStart(2, '0');
  return {
    id: `ep-${prefix}-${i}`,
    machine: `${prefix}-${mac ? 'MB' : 'LT'}-${String(i).padStart(4, '0')}`,
    customer,
    kind: 'Endpoint agent',
    os: mac ? (i % 2 ? 'macOS 15 Sequoia' : 'macOS 14 Sonoma') : i % 5 === 0 ? 'Windows 10 22H2' : 'Windows 11 23H2',
    site: 'Remote',
    version: old ? '4.1.3' : '4.2.0',
    ring: 'Broad',
    products: ['Protection'],
    health: off ? 'unreach' : old ? 'warn' : 'ok',
    heartbeat: off ? T('19 Oct', `${hh}:14`) : T('21 Oct', `${String(13 + (i % 3)).padStart(2, '0')}:${String(10 + (i % 50)).padStart(2, '0')}`),
    note: off ? 'No heartbeat for more than 24 h; the laptop is probably off or away from the network.' : old ? 'Two versions behind; it updates at the next connection on mains power.' : undefined,
    installed: T('12 Jun', '10:00')
  };
};
AGENTS.push(
  ...Array.from({ length: 112 }, (_, k) => 401 + k).filter(i => i !== 442).map(i => endpoint(i, 'mer', 'MBK')),
  ...Array.from({ length: 6 }, (_, k) => k + 1).map(i => endpoint(i, 'h360', 'H360'))
);

export const RINGS = [
  { ring: 'Canary', share: '5 %', rule: 'Host360 internal machines first; 24 h soak' },
  { ring: 'Early', share: '25 %', rule: 'Customers who opted in; 48 h soak' },
  { ring: 'Broad', share: 'Everyone else', rule: 'Inside each customer’s maintenance window' }
];

// ---- Security & Compliance ----
export type Severity = 'High' | 'Medium' | 'Low';
export interface Finding {
  id: string;
  sev: Severity;
  title: string;
  object: string;
  customer: string;
  cls: 'Critical' | 'Confidential' | 'Standard';
  requirement: string;
  found: string;
  owner: string;
  state: 'Open' | 'Accepted risk' | 'Fixed';
  fix: string;
  due: string;
}
/** Findings in the GOV-00231 format: id, severity, object, requirement broken, owner, due date. */
export const FINDINGS: Finding[] = [
  { id: 'GOV-00231', sev: 'High', title: 'Mission Critical workload is not replicated', object: 'payments-api', customer: 'mer', cls: 'Critical', requirement: 'Critical class: RPO 15 min at a second site (RBI BCP 4.2)', found: T('21 Oct', '06:00'), owner: 'Anitha Krishnan', state: 'Open', fix: 'Add payments-api to Meridian Tier-0 replication or a recovery plan.', due: T('28 Oct', '18:00') },
  { id: 'GOV-00229', sev: 'High', title: 'Backups not immutable for 30 days', object: 'cbs-db-01', customer: 'mer', cls: 'Critical', requirement: 'Critical class: immutable copies for 30 days', found: T('19 Oct', '18:05'), owner: 'Anitha Krishnan', state: 'Open', fix: 'Raise the bucket lock on mer-obj-immutable from 14 d to 30 d.', due: T('26 Oct', '18:00') },
  { id: 'GOV-00226', sev: 'Medium', title: 'File share without an offsite copy', object: '\\\\fs-mum-01\\finance', customer: 'mer', cls: 'Confidential', requirement: 'Confidential class: one copy outside the primary region', found: T('15 Oct', '06:00'), owner: 'Rohit Shenoy', state: 'Open', fix: 'Add a backup copy to copy-check-repo.', due: T('05 Nov', '18:00') },
  { id: 'GOV-00224', sev: 'Medium', title: 'Restore test overdue', object: 'his-db-01', customer: 'sah', cls: 'Critical', requirement: 'Critical class: a restore test every 90 days', found: T('12 Oct', '06:00'), owner: 'Dr Vikram Joshi', state: 'Open', fix: 'Run a test restore to Chennai_Lab_Proxmox and file the report.', due: T('31 Oct', '18:00') },
  { id: 'GOV-00219', sev: 'Low', title: 'User without MFA', object: 'karthik.s@host360.ai', customer: 'h360', cls: 'Standard', requirement: 'Every user signs in with MFA', found: T('02 Oct', '09:00'), owner: 'Priya Raman', state: 'Open', fix: 'Karthik S sets up MFA; sign-in is blocked from 28 Oct.', due: T('28 Oct', '00:00') },
  { id: 'GOV-00214', sev: 'Medium', title: 'Encryption off on a repository', object: 'repo-director-lab', customer: 'h360', cls: 'Standard', requirement: 'Repositories holding customer data are encrypted', found: T('20 Sep', '06:00'), owner: 'Arun Kumar', state: 'Accepted risk', fix: 'Lab data only; risk accepted by Priya Raman until 31 Dec 2026.', due: T('31 Dec', '23:59') },
  { id: 'GOV-00207', sev: 'High', title: 'DR drill overdue', object: 'Billing', customer: 'h360', cls: 'Confidential', requirement: 'Business Critical plans tested every quarter', found: T('01 Oct', '06:00'), owner: 'Arun Kumar', state: 'Open', fix: 'Test the Billing recovery plan once region-2-os answers.', due: T('25 Oct', '18:00') },
  { id: 'GOV-00198', sev: 'Medium', title: 'Backups were not encrypted', object: 'kav-tally-01', customer: 'kav', cls: 'Confidential', requirement: 'Confidential class: encryption at rest', found: T('02 Sep', '06:00'), owner: 'Rahul Menon', state: 'Fixed', fix: 'Encryption turned on in Kaveri daily v3 on 20 Aug.', due: T('15 Sep', '18:00') }
];

export const CLASSES = [
  { cls: 'Critical', rules: ['RPO 15 min at a second site', 'Immutable copies for 30 days', 'Encrypted with a customer key', 'Restore test every 90 days', 'Restores need an additional approver'], workloads: 9 },
  { cls: 'Confidential', rules: ['Daily backup with an offsite copy', 'Encrypted at rest', 'Restore test every 180 days'], workloads: 12 },
  { cls: 'Standard', rules: ['Daily backup', 'Encrypted at rest'], workloads: 14 },
  { cls: 'Archive', rules: ['Monthly copy for 7 years', 'Immutable'], workloads: 2 }
];

export interface ComplianceMode {
  customer: string;
  on: boolean;
  since?: string;
  locks: string[];
  unlock: string;
}
export const COMPLIANCE_MODE: ComplianceMode[] = [
  { customer: 'mer', on: true, since: T('03 Mar', '12:00'), locks: ['Recovery points cannot be deleted before their lock date, by anyone', 'Retention and immutability can be raised, never lowered', 'Encryption cannot be turned off', 'Audit log export to SIEM cannot be stopped', 'Compliance mode itself cannot be turned off'], unlock: 'Three people approve within 72 h: the Host360 security officer, the Meridian owner and the Meridian data protection officer.' },
  { customer: 'sah', on: true, since: T('14 Jul', '13:00'), locks: ['Recovery points cannot be deleted before their lock date', 'Retention can be raised, never lowered', 'Encryption cannot be turned off'], unlock: 'Three people approve within 72 h: the Host360 security officer, the Sahyadri owner and the Sahyadri data protection officer.' },
  { customer: 'h360', on: false, locks: [], unlock: '' },
  { customer: 'kav', on: false, locks: [], unlock: '' }
];

export interface Review {
  id: string;
  name: string;
  customer: string;
  every: string;
  due: string;
  state: 'Due' | 'In progress' | 'Done' | 'Overdue';
  by: string;
  items: number;
  done: number;
}
export const REVIEWS: Review[] = [
  { id: 'rv1', name: 'Quarterly access review', customer: 'mer', every: 'Every quarter', due: T('31 Oct', '18:00'), state: 'In progress', by: 'Anitha Krishnan', items: 14, done: 9 },
  { id: 'rv2', name: 'Backup coverage attestation (RBI)', customer: 'mer', every: 'Every quarter', due: T('31 Oct', '18:00'), state: 'Due', by: 'Suresh Iyer', items: 41, done: 0 },
  { id: 'rv3', name: 'DPDP data inventory', customer: 'sah', every: 'Every six months', due: T('15 Nov', '18:00'), state: 'Due', by: 'Dr Vikram Joshi', items: 18, done: 0 },
  { id: 'rv4', name: 'Privileged access review', customer: 'h360', every: 'Every month', due: T('20 Oct', '18:00'), state: 'Overdue', by: 'Priya Raman', items: 6, done: 4 },
  { id: 'rv5', name: 'Retention exceptions', customer: 'h360', every: 'Every quarter', due: T('30 Sep', '18:00'), state: 'Done', by: 'Arun Kumar', items: 3, done: 3 }
];

// ---- Support ----
export interface Ticket {
  id: string;
  title: string;
  customer: string;
  sev: 'S1' | 'S2' | 'S3' | 'S4';
  state: 'Open' | 'Waiting on you' | 'Waiting on Host360' | 'Resolved';
  opened: string;
  updated: string;
  by: string;
  product: string;
  object?: string;
  bundle?: string;
  assist?: string;
}
export const TICKETS: Ticket[] = [
  { id: 'SR-48213', title: 'Replication of ad-dc-01 fails at the snapshot step', customer: 'h360', sev: 'S2', state: 'Waiting on Host360', opened: T('21 Oct', '12:50'), updated: T('21 Oct', '15:10'), by: 'arun.kumar', product: 'Resilience', object: 'ad-dc-01', bundle: 'DIAG-21OCT-0412 (redacted, 18.4 MB)' },
  { id: 'SR-48207', title: 'region-2-os unreachable from aegis-proxy-nova-248d', customer: 'h360', sev: 'S1', state: 'Open', opened: T('21 Oct', '14:58'), updated: T('21 Oct', '15:55'), by: 'priya.raman', product: 'Platform', object: 'region-2-os', assist: 'Remote assist requested; waiting for approval' },
  { id: 'SR-48190', title: 'PVC payments-ledger skipped in backups', customer: 'mer', sev: 'S3', state: 'Waiting on you', opened: T('20 Oct', '10:15'), updated: T('21 Oct', '09:30'), by: 'anitha.k@meridianbank.in', product: 'Protection', object: 'payments-api' },
  { id: 'SR-48144', title: 'Invoice INV-2026-0817 GST breakup', customer: 'cor', sev: 'S4', state: 'Open', opened: T('17 Oct', '11:00'), updated: T('18 Oct', '16:20'), by: 'lakshmi.n@coromandelins.in', product: 'Billing' },
  { id: 'SR-48101', title: 'Test boot of crm-db-01 left running for 24 h', customer: 'h360', sev: 'S4', state: 'Resolved', opened: T('15 Oct', '09:00'), updated: T('18 Oct', '15:20'), by: 'meera.iyer', product: 'Mobility', object: 'crm-db-01' }
];

export const KB = [
  { id: 'KB-1102', title: 'VMware Tools quiesce times out on domain controllers', code: 'AEG-DR-2041', product: 'Resilience', views: 412 },
  { id: 'KB-1088', title: 'Kubernetes PVC skipped: add a VolumeSnapshotClass', code: 'AEG-BK-3107', product: 'Protection', views: 268 },
  { id: 'KB-1075', title: 'Change tracking reset after a host crash', code: 'AEG-BK-1022', product: 'Protection', views: 731 },
  { id: 'KB-1061', title: 'Windows guest does not boot after migration: inject VirtIO storage', code: 'AEG-MG-4003', product: 'Mobility', views: 955 },
  { id: 'KB-1049', title: 'Certificate fingerprint changed after a vCenter renewal', code: 'AEG-PF-0108', product: 'Platform', views: 389 },
  { id: 'KB-1032', title: 'Recovery point locked in compliance mode cannot be deleted', code: 'AEG-BK-1200', product: 'Protection', views: 204 }
];

export const STATUS = [
  { svc: 'Console and API', state: 'ok', note: 'Operational' },
  { svc: 'Protection jobs', state: 'ok', note: 'Operational' },
  { svc: 'Resilience replication', state: 'warn', note: 'Degraded for region-2-os since 14:52 IST (SR-48207)' },
  { svc: 'Mobility', state: 'ok', note: 'Operational' },
  { svc: 'Licence service', state: 'ok', note: 'Operational' },
  { svc: 'E-mail notifications', state: 'ok', note: 'Operational' }
];

export const NOTICES = [
  { when: T('25 Oct', '23:00'), text: 'Planned maintenance of the Chennai orchestrator, 23:00 to 23:30 IST. Running jobs pause and resume.' },
  { when: T('04 Nov', '00:00'), text: 'Chennai vCenter certificate expires 04 Nov 2026. Confirm the new fingerprint after renewal.' }
];
