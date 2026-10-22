/* Mobility (migration) sample data: VMware sources, their inventory with migratability checks,
   waves with downtime budgets, and the weekly burn-down. Times are in the orchestrator's zone (IST). */
import { T } from '../../data/platform';

export interface Source {
  id: string;
  name: string;
  kind: 'vCenter' | 'ESXi';
  version: string;
  addr: string;
  hosts: number;
  datastores: number;
  networks: number;
  cert: { fp: string; issuer: string; valid: string; expiresDays: number; confirmedBy: string; confirmed: string };
  account: string;
  lastScan: string;
  state: 'ok' | 'warn' | 'unreach';
  note?: string;
}

export const SOURCES: Source[] = [
  {
    id: 'vc-chn', name: 'Chennai vCenter', kind: 'vCenter', version: 'vCenter Server 8.0 Update 2', addr: '172.25.10.177:443', hosts: 4, datastores: 3, networks: 2,
    cert: { fp: '4F:9A:21:7C:E0:5B:93:D4:18:6A:C2:7E:0F:44:B1:93:2D:85:EA:61:07:3C:9F:D8:52:B6:11:E4:70:2A:C9:C2', issuer: 'VMware Certificate Authority (Chennai vCenter)', valid: '04 Nov 2024 to 04 Nov 2026', expiresDays: 14, confirmedBy: 'priya.raman', confirmed: T('12 Mar', '10:31') },
    account: 'svc-aegis-mig@vsphere.local (role Aegis Migration, read and snapshot only)', lastScan: T('21 Oct', '15:30'), state: 'warn', note: 'Certificate expires in 14 days (04 Nov 2026). Confirm the new fingerprint after it is renewed.'
  },
  {
    id: 'esx-edge', name: 'esxi-edge-07', kind: 'ESXi', version: 'ESXi 7.0 Update 3 (standalone)', addr: '10.20.12.7:443', hosts: 1, datastores: 1, networks: 1,
    cert: { fp: 'B0:17:6E:3D:92:4C:A8:F1:05:DE:63:9B:24:C0:7A:58:E9:12:3F:B4:81:6D:0A:C7:55:2E:F9:38:D1:46:7B:0E', issuer: 'Self-signed (esxi-edge-07.host360.local)', valid: '18 Jan 2025 to 18 Jan 2027', expiresDays: 454, confirmedBy: 'arun.kumar', confirmed: T('22 May', '14:02') },
    account: 'aegis-mig (local ESXi user, read and snapshot only)', lastScan: T('21 Oct', '15:30'), state: 'warn', note: 'Datastore ds-edge-01 is 93 % full; snapshots for sync passes may fail.'
  }
];

export type Level = 'ok' | 'warn' | 'block';
export type Check = { k: string; level: Level; text: string };
export type InvStage = 'excluded' | 'unplanned' | 'planned' | 'first' | 'synced' | 'testing' | 'ready' | 'cutover' | 'committed' | 'rolledback';
export interface SourceVm {
  id: string;
  name: string;
  customer: string;
  source: string;
  host: string;
  power: 'On' | 'Off';
  os: string;
  cpu: number;
  mem: number;
  disks: number[];
  ds: string;
  cbt: 'On' | 'Off';
  tools: string;
  firmware: 'BIOS' | 'UEFI';
  snapshots: number;
  stage: InvStage;
  wave?: string;
  dest?: string;
  risk?: string;
  checks: Check[];
}

type Flags = { rdm?: boolean; shared?: boolean; usb?: boolean; appliance?: boolean; encrypted?: boolean; dmz?: boolean; pcie?: boolean; big?: boolean };

const OLD_OS: Record<string, Check> = {
  'CentOS 7': { k: 'Guest OS', level: 'warn', text: 'CentOS 7 is end of life; VirtIO drivers are added by hand during the first pass.' },
  'Windows Server 2008 R2': { k: 'Guest OS', level: 'warn', text: 'Out of support; uses VirtIO 0.1.185, the last driver set for 2008 R2.' },
  'Windows Server 2012 R2': { k: 'Guest OS', level: 'warn', text: 'Out of Microsoft support since Oct 2023; drivers still inject.' }
};

function checks(os: string, cbt: 'On' | 'Off', tools: string, snaps: number, f: Flags, disks: number[]): Check[] {
  const out: Check[] = [];
  if (f.appliance) out.push({ k: 'Appliance', level: 'block', text: 'VMware appliance. It is retired with the platform, not migrated.' });
  if (f.rdm) out.push({ k: 'Disks', level: 'block', text: 'Raw device mapping in physical mode cannot be copied. Convert it to a virtual disk first.' });
  if (f.shared) out.push({ k: 'Disks', level: 'block', text: 'A disk is shared with another VM (multi-writer). Migrate the cluster as one, or move to shared storage.' });
  if (f.usb) out.push({ k: 'Devices', level: 'block', text: 'USB passthrough (licence dongle) has no equivalent. Use a USB-over-IP hub first.' });
  if (f.pcie) out.push({ k: 'Devices', level: 'block', text: 'PCIe passthrough of a hardware security module. Needs the HSM at the destination first.' });
  out.push(OLD_OS[os] || { k: 'Guest OS', level: 'ok', text: `${os} is supported; drivers are injected automatically.` });
  out.push(cbt === 'On' ? { k: 'Change tracking', level: 'ok', text: 'On: sync passes copy only changed blocks.' } : { k: 'Change tracking', level: 'warn', text: 'Off: every sync pass reads the whole disk. Turn it on before the first pass.' });
  const major = +(tools.match(/(\d+)\.\d+/)?.[1] || 0);
  out.push(major >= 11 ? { k: 'VMware Tools', level: 'ok', text: `${tools}: quiesced snapshots work.` } : { k: 'VMware Tools', level: 'warn', text: `${tools} is older than 11; snapshots may not be application-consistent.` });
  if (snaps) out.push({ k: 'Snapshots', level: snaps >= 8 ? 'block' : 'warn', text: `${snaps} snapshots on the VM. Consolidate them before the first pass.` });
  if (f.encrypted) out.push({ k: 'Encryption', level: 'warn', text: 'vSphere VM encryption is on. Aegis reads through the vCenter key provider; keep it reachable.' });
  if (f.dmz) out.push({ k: 'Network', level: 'warn', text: 'DMZ-120 has no mapping at the destination yet.' });
  const total = disks.reduce((a, b) => a + b, 0);
  if (f.big || total > 4000) out.push({ k: 'Size', level: 'warn', text: `${(total / 1024).toFixed(1)} TB in total; the first pass takes about ${Math.round(total / 680)} h at 190 MB/s.` });
  return out;
}

const V = (name: string, customer: string, source: string, host: string, power: 'On' | 'Off', os: string, cpu: number, mem: number, disks: number[], ds: string, cbt: 'On' | 'Off', tools: string, firmware: 'BIOS' | 'UEFI', snapshots: number, stage: InvStage, x: { wave?: string; dest?: string; risk?: string; flags?: Flags } = {}): SourceVm => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name, customer, source, host, power, os, cpu, mem, disks, ds, cbt, tools, firmware, snapshots, stage,
  wave: x.wave, dest: x.dest, risk: x.risk,
  checks: checks(os, cbt, tools, snapshots, x.flags || {}, disks)
});

const VC = 'Chennai vCenter';
const EDGE = 'esxi-edge-07';
const OS = 'production-openstack';
const PVE = 'Chennai-proxmox-prod';
const W0 = 'Wave 0 · Pilot';
const W1 = 'Wave 1 · CRM';
const W2 = 'Wave 2 · Terminal servers';
const W3 = 'Wave 3 · Legacy';
const M1 = 'Wave 1 · Branch services';
const M2 = 'Wave 2 · Core banking reporting';

export const INVENTORY: SourceVm[] = [
  // Host360 · in flight (the same servers as Mobility › Servers)
  V('crm-app-01', 'h360', VC, 'esx-01', 'On', 'Windows Server 2022', 8, 32, [120, 300], 'ds-ssd-01', 'On', '12.3.0', 'UEFI', 0, 'synced', { wave: W1, dest: OS }),
  V('crm-db-01', 'h360', VC, 'esx-02', 'On', 'Windows Server 2019', 8, 64, [120, 640, 500], 'ds-ssd-01', 'On', '12.3.0', 'UEFI', 0, 'testing', { wave: W1, dest: OS }),
  V('hr-portal', 'h360', VC, 'esx-01', 'On', 'Ubuntu 22.04', 4, 8, [80], 'ds-sas-02', 'On', 'open-vm-tools 12.1', 'BIOS', 0, 'ready', { wave: W1, dest: OS }),
  V('win-ts-01', 'h360', VC, 'esx-03', 'On', 'Windows Server 2022', 4, 16, [150], 'ds-sas-02', 'On', '12.1.5', 'UEFI', 0, 'first', { wave: W2, dest: PVE, risk: 'The first pass runs at 96 MB/s; at this rate it ends 31 Oct, one day before the wave, leaving no time for a test boot.' }),
  V('win-ts-02', 'h360', VC, 'esx-03', 'On', 'Windows Server 2022', 4, 16, [150], 'ds-sas-02', 'On', '12.1.5', 'UEFI', 0, 'planned', { wave: W2, dest: PVE }),
  V('citrix-sf-01', 'h360', VC, 'esx-02', 'Off', 'Windows Server 2019', 2, 8, [60], 'ds-ssd-01', 'Off', '11.3.5', 'BIOS', 0, 'planned', { wave: W2, risk: 'No mapping 11 days before its wave window.' }),
  V('print-srv-02', 'h360', EDGE, 'esxi-edge-07', 'On', 'Windows Server 2016', 2, 4, [60], 'ds-edge-01', 'On', '11.3.5', 'BIOS', 0, 'cutover', { wave: W3, dest: PVE }),
  V('legacy-erp', 'h360', EDGE, 'esxi-edge-07', 'Off', 'CentOS 7', 4, 16, [200, 500], 'ds-edge-01', 'Off', 'open-vm-tools 10.3', 'BIOS', 0, 'synced', { wave: W3, dest: OS, risk: 'Wave 3 has no cutover window yet.' }),
  V('ubuntu-build-03', 'h360', VC, 'esx-01', 'On', 'Ubuntu 24.04', 8, 16, [200], 'ds-nfs-03', 'On', 'open-vm-tools 12.4', 'UEFI', 0, 'committed', { wave: W0, dest: PVE }),
  V('rhel-oracle-01', 'h360', VC, 'esx-02', 'On', 'Red Hat Enterprise Linux 8', 16, 128, [100, 800, 800, 700], 'ds-ssd-01', 'On', 'open-vm-tools 12.1', 'UEFI', 0, 'rolledback', { wave: W3, dest: OS, risk: 'Rolled back on 17 Oct: the Oracle listener did not start on the new network.' }),
  // Host360 · pilot, committed 18 Oct
  V('dev-k8s-01', 'h360', VC, 'esx-01', 'On', 'Ubuntu 24.04', 8, 32, [100, 200], 'ds-nfs-03', 'On', 'open-vm-tools 12.4', 'UEFI', 0, 'committed', { wave: W0, dest: PVE }),
  V('dev-k8s-02', 'h360', VC, 'esx-01', 'On', 'Ubuntu 24.04', 8, 32, [100, 200], 'ds-nfs-03', 'On', 'open-vm-tools 12.4', 'UEFI', 0, 'committed', { wave: W0, dest: PVE }),
  V('dev-k8s-03', 'h360', VC, 'esx-03', 'On', 'Ubuntu 24.04', 8, 32, [100, 200], 'ds-nfs-03', 'On', 'open-vm-tools 12.4', 'UEFI', 0, 'committed', { wave: W0, dest: PVE }),
  V('wiki-01', 'h360', VC, 'esx-03', 'On', 'Debian 12', 2, 4, [60], 'ds-sas-02', 'On', 'open-vm-tools 12.2', 'BIOS', 0, 'committed', { wave: W0, dest: PVE }),
  V('jira-01', 'h360', VC, 'esx-02', 'On', 'Ubuntu 22.04', 4, 16, [120, 200], 'ds-sas-02', 'On', 'open-vm-tools 12.1', 'BIOS', 0, 'committed', { wave: W0, dest: PVE }),
  V('grafana-01', 'h360', VC, 'esx-01', 'On', 'Rocky Linux 9', 2, 8, [80], 'ds-nfs-03', 'On', 'open-vm-tools 12.2', 'UEFI', 0, 'committed', { wave: W0, dest: PVE }),
  V('proxy-squid-01', 'h360', VC, 'esx-01', 'On', 'Debian 12', 2, 4, [40], 'ds-nfs-03', 'On', 'open-vm-tools 12.2', 'BIOS', 0, 'committed', { wave: W0, dest: PVE }),
  V('ntp-01', 'h360', VC, 'esx-03', 'On', 'Debian 12', 1, 2, [20], 'ds-nfs-03', 'On', 'open-vm-tools 12.2', 'BIOS', 0, 'committed', { wave: W0, dest: PVE }),
  // Host360 · not planned yet
  V('exch-01', 'h360', VC, 'esx-02', 'On', 'Windows Server 2019', 8, 48, [120, 900], 'ds-ssd-01', 'On', '10.3.25', 'UEFI', 0, 'unplanned'),
  V('sap-app-01', 'h360', VC, 'esx-02', 'On', 'SUSE Linux Enterprise 15 SP5', 16, 96, [100, 600], 'ds-ssd-01', 'On', 'open-vm-tools 12.1', 'UEFI', 0, 'unplanned', { flags: { encrypted: true } }),
  V('file-srv-01', 'h360', VC, 'esx-03', 'On', 'Windows Server 2019', 4, 16, [120, 2048, 2048], 'ds-sas-02', 'On', '12.1.5', 'UEFI', 7, 'unplanned'),
  V('lic-server-01', 'h360', VC, 'esx-03', 'On', 'Windows Server 2016', 2, 4, [60], 'ds-sas-02', 'On', '11.3.5', 'BIOS', 0, 'unplanned', { flags: { usb: true } }),
  V('oracle-rac-01', 'h360', VC, 'esx-02', 'On', 'Oracle Linux 8', 16, 128, [100, 1200], 'ds-ssd-01', 'On', 'open-vm-tools 12.1', 'UEFI', 0, 'unplanned', { flags: { shared: true } }),
  V('oracle-rac-02', 'h360', VC, 'esx-04', 'On', 'Oracle Linux 8', 16, 128, [100, 1200], 'ds-ssd-01', 'On', 'open-vm-tools 12.1', 'UEFI', 0, 'unplanned', { flags: { shared: true } }),
  V('ftp-dmz-01', 'h360', VC, 'esx-04', 'On', 'Ubuntu 22.04', 2, 4, [80], 'ds-sas-02', 'On', 'open-vm-tools 12.1', 'BIOS', 0, 'unplanned', { flags: { dmz: true } }),
  V('old-sql2008', 'h360', EDGE, 'esxi-edge-07', 'On', 'Windows Server 2008 R2', 4, 16, [80, 300], 'ds-edge-01', 'Off', '10.1.0', 'BIOS', 2, 'unplanned'),
  V('build-win-02', 'h360', VC, 'esx-04', 'On', 'Windows Server 2022', 8, 16, [200], 'ds-nfs-03', 'On', '12.3.0', 'UEFI', 0, 'unplanned'),
  V('print-srv-03', 'h360', EDGE, 'esxi-edge-07', 'On', 'Windows Server 2016', 2, 4, [60], 'ds-edge-01', 'On', '11.3.5', 'BIOS', 0, 'unplanned'),
  V('citrix-ddc-01', 'h360', VC, 'esx-02', 'On', 'Windows Server 2019', 4, 8, [80], 'ds-ssd-01', 'On', '11.3.5', 'BIOS', 0, 'unplanned'),
  V('vcsa-01', 'h360', VC, 'esx-01', 'On', 'VMware Photon OS 3', 4, 19, [48, 10, 25, 50], 'ds-ssd-01', 'On', 'open-vm-tools 12.1', 'BIOS', 0, 'excluded', { flags: { appliance: true } }),
  // Meridian Cooperative Bank
  V('SQL01', 'mer', VC, 'esx-04', 'On', 'Windows Server 2019', 8, 64, [120, 300, 340, 200], 'ds-ssd-01', 'On', '11.3.5', 'UEFI', 0, 'synced', { wave: M2, dest: PVE, risk: 'Sync passes take 48 min against 30 min planned; the final sync may run past the window start.' }),
  V('rpt-app-01', 'mer', VC, 'esx-04', 'On', 'Windows Server 2022', 4, 16, [120], 'ds-sas-02', 'On', '12.3.0', 'UEFI', 0, 'testing', { wave: M2, dest: PVE }),
  V('mer-branch-app-01', 'mer', VC, 'esx-04', 'On', 'Windows Server 2019', 4, 16, [120], 'ds-sas-02', 'On', '12.1.5', 'UEFI', 0, 'committed', { wave: M1, dest: PVE }),
  V('mer-branch-app-02', 'mer', VC, 'esx-04', 'On', 'Windows Server 2019', 4, 16, [120], 'ds-sas-02', 'On', '12.1.5', 'UEFI', 0, 'committed', { wave: M1, dest: PVE }),
  V('mer-ivr-01', 'mer', VC, 'esx-04', 'On', 'Red Hat Enterprise Linux 9', 4, 8, [100], 'ds-sas-02', 'On', 'open-vm-tools 12.2', 'UEFI', 0, 'committed', { wave: M1, dest: PVE }),
  V('mer-hrms-01', 'mer', VC, 'esx-04', 'On', 'Windows Server 2022', 4, 16, [200], 'ds-sas-02', 'On', '12.3.0', 'UEFI', 0, 'committed', { wave: M1, dest: PVE }),
  V('mer-intranet', 'mer', VC, 'esx-04', 'On', 'Ubuntu 22.04', 2, 8, [80], 'ds-nfs-03', 'On', 'open-vm-tools 12.1', 'BIOS', 0, 'committed', { wave: M1, dest: PVE }),
  V('mer-swift-gw', 'mer', VC, 'esx-04', 'On', 'Red Hat Enterprise Linux 8', 8, 32, [200], 'ds-ssd-01', 'On', 'open-vm-tools 12.1', 'UEFI', 0, 'unplanned', { flags: { pcie: true } }),
  V('mer-ats-01', 'mer', VC, 'esx-04', 'On', 'Windows Server 2022', 4, 8, [100], 'ds-sas-02', 'On', '12.3.0', 'UEFI', 0, 'unplanned'),
  V('mer-lms-01', 'mer', VC, 'esx-04', 'On', 'Ubuntu 24.04', 4, 8, [100], 'ds-sas-02', 'On', 'open-vm-tools 12.4', 'UEFI', 0, 'unplanned'),
  V('mer-crm-01', 'mer', VC, 'esx-04', 'On', 'Windows Server 2019', 8, 32, [120, 400], 'ds-ssd-01', 'Off', '11.3.5', 'UEFI', 0, 'unplanned'),
  V('mer-doc-01', 'mer', VC, 'esx-04', 'On', 'Windows Server 2016', 4, 16, [120, 900], 'ds-sas-02', 'On', '11.3.5', 'BIOS', 3, 'unplanned'),
  V('mer-dwh-01', 'mer', VC, 'esx-04', 'On', 'Red Hat Enterprise Linux 8', 16, 128, [200, 3072, 3072], 'ds-ssd-01', 'On', 'open-vm-tools 12.1', 'UEFI', 0, 'unplanned', { flags: { big: true } }),
  V('mer-rpa-01', 'mer', VC, 'esx-04', 'On', 'Windows Server 2022', 4, 16, [120], 'ds-sas-02', 'On', '12.3.0', 'UEFI', 0, 'unplanned')
];

export const verdict = (v: SourceVm): Level => (v.checks.some(c => c.level === 'block') ? 'block' : v.checks.some(c => c.level === 'warn') ? 'warn' : 'ok');
export const VERDICT: Record<Level, { i: string; l: string; c: string }> = { ok: { i: 'circle-check', l: 'Ready', c: 'ok' }, warn: { i: 'triangle-alert', l: 'Warnings', c: 'warn' }, block: { i: 'ban', l: 'Blocked', c: 'err' } };
export const STAGE_LABEL: Record<InvStage, string> = { excluded: 'Not migrated', unplanned: 'Not in a wave', planned: 'In a wave', first: 'First pass', synced: 'Syncing', testing: 'Test boot running', ready: 'Ready for cutover', cutover: 'Cut over, not committed', committed: 'Committed', rolledback: 'Rolled back' };
export const IN_PROGRESS: InvStage[] = ['first', 'synced', 'testing', 'ready', 'cutover'];

export interface Wave {
  id: string;
  customer: string;
  name: string;
  window: string | null;
  budgetMin: number;
  usedMin: number;
  state: 'done' | 'in progress' | 'scheduled' | 'not scheduled';
  approval?: string;
}
export const WAVES: Wave[] = [
  { id: 'w0', customer: 'h360', name: W0, window: 'Sat 18 Oct 2026, 22:00 to 02:00 IST', budgetMin: 240, usedMin: 95, state: 'done' },
  { id: 'w1', customer: 'h360', name: W1, window: 'Sat 25 Oct 2026, 22:00 to 02:00 IST', budgetMin: 240, usedMin: 0, state: 'scheduled' },
  { id: 'w2', customer: 'h360', name: W2, window: 'Sat 01 Nov 2026, 22:00 to 04:00 IST', budgetMin: 360, usedMin: 0, state: 'scheduled' },
  { id: 'w3', customer: 'h360', name: W3, window: null, budgetMin: 480, usedMin: 145, state: 'in progress' },
  { id: 'm1', customer: 'mer', name: M1, window: 'Sat 04 Oct 2026, 22:00 to 03:00 IST', budgetMin: 300, usedMin: 125, state: 'done' },
  { id: 'm2', customer: 'mer', name: M2, window: 'Sat 25 Oct 2026, 22:00 to 04:00 IST', budgetMin: 360, usedMin: 0, state: 'scheduled', approval: 'APR-1042' }
];

/** Weekly servers-left-to-migrate, per customer. Planned runs to 14 Dec; actual to the last Monday. */
export const BURN_WEEKS = ['07 Sep', '14 Sep', '21 Sep', '28 Sep', '05 Oct', '12 Oct', '19 Oct', '26 Oct', '02 Nov', '09 Nov', '16 Nov', '23 Nov', '30 Nov', '07 Dec', '14 Dec'];
export const BURN: Record<string, { planned: number[]; actual: number[] }> = {
  h360: { planned: [29, 29, 29, 28, 27, 26, 21, 18, 15, 12, 9, 6, 3, 1, 0], actual: [29, 29, 29, 29, 29, 29, 20] },
  mer: { planned: [14, 14, 13, 12, 9, 9, 8, 6, 6, 5, 4, 3, 2, 1, 0], actual: [14, 14, 14, 14, 9, 9, 9] }
};
