/* Assessment of the VMware inventory: compatibility, readiness and risk scores, downtime and
   duration estimates, right-sizing from seven days of performance data, and security and
   licensing findings. Everything is derived from INVENTORY so the views always agree. */
import { WORKLOADS, type Tier } from '../../data/platform';
import { INVENTORY, type SourceVm } from './data';

const TIER_GUESS: Record<string, Tier> = {
  'mer-swift-gw': 'Mission Critical', 'oracle-rac-01': 'Mission Critical', 'oracle-rac-02': 'Mission Critical', 'sap-app-01': 'Mission Critical',
  'exch-01': 'Business Critical', 'mer-crm-01': 'Business Critical', 'mer-dwh-01': 'Important', 'file-srv-01': 'Important', 'hr-portal': 'Important',
  'win-ts-01': 'Important', 'win-ts-02': 'Important', 'citrix-sf-01': 'Important', 'citrix-ddc-01': 'Important', 'mer-doc-01': 'Important', 'rhel-oracle-01': 'Business Critical',
  'mer-branch-app-01': 'Business Critical', 'mer-branch-app-02': 'Business Critical', 'mer-ivr-01': 'Business Critical', 'mer-hrms-01': 'Important', 'jira-01': 'Important'
};
/** The criticality tier: from the workload record when there is one, else what the owner set at discovery. */
export const tierOf = (v: SourceVm): Tier => WORKLOADS.find(w => w.name === v.name)?.tier || TIER_GUESS[v.name] || 'Standard';

/** Stable pseudo-measurements per server (seven days of vCenter performance data). */
const h = (s: string, salt: number) => {
  let x = salt;
  for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 9973;
  return x / 9973;
};

export const totalGB = (v: SourceVm) => v.disks.reduce((a, b) => a + b, 0);
export const isWindows = (v: SourceVm) => v.os.startsWith('Windows');

export type Risk = 'Low' | 'Medium' | 'High';
export interface Assessed {
  vm: SourceVm;
  tier: Tier;
  compat: number;
  ready: number;
  risk: Risk;
  riskWhy: string[];
  firstPassH: number;
  downtimeMin: number;
  p95cpu: number;
  p95mem: number;
  usedGB: number;
  rec: { cpu: number; mem: number; label: string };
  deductions: { what: string; pts: number; score: 'Compatibility' | 'Readiness' }[];
}

const FLAVORS: [string, number, number][] = [['m1.small', 1, 2], ['m1.medium', 2, 4], ['m1.large', 4, 8], ['m1.xlarge', 8, 16], ['m1.2xlarge', 8, 32], ['m1.4xlarge', 16, 64], ['m1.8xlarge', 16, 128]];
const COMPAT_KEYS = ['Appliance', 'Disks', 'Devices', 'Guest OS'];

export function assess(v: SourceVm): Assessed {
  const deductions: Assessed['deductions'] = [];
  for (const c of v.checks) {
    if (c.level === 'ok') continue;
    const compat = COMPAT_KEYS.includes(c.k);
    deductions.push({ what: c.text, pts: c.level === 'block' ? (compat ? 70 : 40) : compat ? 15 : 12, score: compat ? 'Compatibility' : 'Readiness' });
  }
  if (!v.dest && v.stage !== 'excluded' && v.stage !== 'committed') deductions.push({ what: 'No destination mapping yet', pts: 10, score: 'Readiness' });
  const compat = Math.max(0, 100 - deductions.filter(d => d.score === 'Compatibility').reduce((a, d) => a + d.pts, 0));
  const ready = Math.max(0, Math.min(compat, 100 - deductions.filter(d => d.score === 'Readiness').reduce((a, d) => a + d.pts, 0)));
  const tier = tierOf(v);
  const gb = totalGB(v);
  const riskWhy: string[] = [];
  if (tier === 'Mission Critical') riskWhy.push('Mission Critical: two approvers and a tested rollback');
  if (gb > 2000) riskWhy.push(`${(gb / 1024).toFixed(1)} TB to copy`);
  if (v.checks.some(c => c.k === 'Guest OS' && c.level === 'warn')) riskWhy.push('Out-of-support guest OS');
  if (v.checks.some(c => c.level === 'block')) riskWhy.push('Has a blocker');
  if (v.stage === 'rolledback') riskWhy.push('Rolled back once');
  if (/oracle|sql/i.test(v.name)) riskWhy.push('Database: application-consistent cutover needed');
  const risk: Risk = riskWhy.length >= 3 || (tier === 'Mission Critical' && riskWhy.length >= 2) ? 'High' : riskWhy.length ? 'Medium' : 'Low';
  const p95cpu = Math.round(12 + h(v.name, 7) * 70);
  const p95mem = Math.round(25 + h(v.name, 13) * 65);
  // Databases keep at least 4 cores: SQL Server and Oracle licence a minimum of 4 per VM.
  const needCpu = Math.max(/sql|oracle|db/i.test(v.name) ? 4 : 1, Math.ceil((v.cpu * p95cpu) / 100 / 0.7));
  const needMem = Math.max(2, Math.ceil((v.mem * p95mem) / 100 / 0.8));
  const fl = FLAVORS.find(f => f[1] >= needCpu && f[2] >= needMem) || FLAVORS[FLAVORS.length - 1];
  const pve = v.dest === 'Chennai-proxmox-prod' || (!v.dest && v.customer === 'mer');
  const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(n));
  const rec = pve ? { cpu: Math.min(v.cpu, needCpu), mem: Math.min(v.mem, pow2(needMem)), label: `${Math.min(v.cpu, needCpu)} cores · ${Math.min(v.mem, pow2(needMem))} GB` } : { cpu: fl[1], mem: fl[2], label: `${fl[0]} (${fl[1]} vCPU · ${fl[2]} GB)` };
  return {
    vm: v,
    tier,
    compat,
    ready,
    risk,
    riskWhy,
    firstPassH: Math.max(0.1, gb / 680),
    downtimeMin: Math.round(6 + gb * 0.006 + (isWindows(v) ? 9 : 4) + (/sql|oracle|db/i.test(v.name) ? 15 : 0)),
    p95cpu,
    p95mem,
    usedGB: Math.round(gb * (0.45 + h(v.name, 3) * 0.4)),
    rec,
    deductions
  };
}

export const ASSESSED: Assessed[] = INVENTORY.filter(v => v.stage !== 'excluded').map(assess);
export const band = (n: number) => (n >= 80 ? 'ok' : n >= 50 ? 'warn' : 'err');
export const bandLabel = (n: number) => (n >= 80 ? 'Ready' : n >= 50 ? 'Needs work' : 'Blocked');

export interface Finding {
  id: string;
  kind: 'Security' | 'Licensing' | 'Operations';
  sev: 'High' | 'Medium' | 'Low';
  title: string;
  servers: string[];
  advice: string;
  saving?: string;
}

/** Security, licensing and operational findings across the servers in scope. */
export function findings(list: Assessed[]): Finding[] {
  const names = (f: (a: Assessed) => boolean) => list.filter(f).map(a => a.vm.name);
  const out: Finding[] = [
    { id: 'eol', kind: 'Security', sev: 'High', title: 'Guest operating systems out of support', servers: names(a => /CentOS 7|2008 R2|2012 R2/.test(a.vm.os)), advice: 'No security patches. Migrate as-is to keep the date, then upgrade in place within 90 days, or rebuild on a supported release at the destination.' },
    { id: 'enc', kind: 'Security', sev: 'Medium', title: 'vSphere VM encryption in use', servers: names(a => a.vm.checks.some(c => c.k === 'Encryption')), advice: 'Keys stay in the vCenter key provider. At the destination, disks are encrypted with the tenant key in Aegis key management; check the key is registered before the first pass.' },
    { id: 'dmz', kind: 'Security', sev: 'Medium', title: 'Servers on DMZ networks with no destination mapping', servers: names(a => a.vm.checks.some(c => c.k === 'Network' && c.level !== 'ok')), advice: 'Create the DMZ network and security group at the destination first; until then the server would land on the production network.' },
    { id: 'tools', kind: 'Security', sev: 'Low', title: 'VMware Tools older than 11', servers: names(a => a.vm.checks.some(c => c.k === 'VMware Tools' && c.level !== 'ok')), advice: 'Removed at cutover and replaced with the QEMU guest agent. Upgrade only if application-consistent snapshots are needed before then.' },
    { id: 'win', kind: 'Licensing', sev: 'Medium', title: 'Windows Server licences move with the hosts, not the VMs', servers: names(a => isWindows(a.vm)), advice: 'Datacenter edition licenses every physical core of the destination host. Count the Proxmox and OpenStack compute nodes that will run Windows, or confine Windows to a host aggregate.' },
    { id: 'sql', kind: 'Licensing', sev: 'Medium', title: 'SQL Server licensed per core', servers: names(a => /sql/i.test(a.vm.name)), advice: 'Per-core licences follow the vCPUs. Right-sizing SQL01 from 8 to the recommended size keeps you inside the current 8-core licence with Software Assurance mobility.' },
    { id: 'ora', kind: 'Licensing', sev: 'High', title: 'Oracle on KVM counts every core in the cluster', servers: names(a => /oracle/i.test(a.vm.name) || a.vm.os.startsWith('Oracle')), advice: 'Oracle treats Proxmox and OpenStack as soft partitioning. Pin these VMs to a dedicated host aggregate, or use Oracle Linux KVM with hard partitioning, before cutover.' },
    { id: 'rhel', kind: 'Licensing', sev: 'Low', title: 'Red Hat subscriptions need moving to the new hosts', servers: names(a => a.vm.os.startsWith('Red Hat')), advice: 'Re-register with Red Hat Subscription Management after cutover; virtual datacenter subscriptions are tied to the hypervisor host.' },
    { id: 'vmw', kind: 'Licensing', sev: 'Low', title: 'VMware licences released after migration', servers: names(a => a.vm.stage !== 'committed'), advice: 'Chennai vCenter runs 4 hosts × 32 cores on VMware vSphere Foundation. When the last wave commits, 128 cores are released at renewal on 30 Jun 2027.', saving: '₹1,02,40,000 a year' },
    { id: 'cbt', kind: 'Operations', sev: 'Medium', title: 'Change tracking off', servers: names(a => a.vm.cbt === 'Off' && a.vm.stage !== 'committed'), advice: 'Every sync pass reads the whole disk. Turn change tracking on (needs a snapshot cycle) before the first pass.' },
    { id: 'snap', kind: 'Operations', sev: 'Medium', title: 'Snapshot chains on the source', servers: names(a => a.vm.snapshots > 0), advice: 'Consolidate before the first pass; long chains slow reads and can fail the quiesced snapshot.' },
    { id: 'big', kind: 'Operations', sev: 'Low', title: 'Large servers: first pass over 6 hours', servers: names(a => a.firstPassH >= 6), advice: 'Start the first pass at least a week before the wave so sync passes have settled.' }
  ];
  return out.filter(f => f.servers.length);
}
