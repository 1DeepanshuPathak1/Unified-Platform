import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Btn, Field, FilterInput, Seg, SelectInput, TextInput } from '../ui/controls';
import { Facts, MiniTable, Panel, Spacer, TableArea, Tiles, Toolbar } from '../ui/layout';
import type { Ctx } from '../ui/ctx';

/* ---------------------------------------------------------------- One engine for all three calculators */

/** Assumptions every calculator shares, so the three answers always agree with each other. */
export interface Assume { change: number; dedupe: number; compress: number; mbps: number }
const DEFAULTS: Assume = { change: 3, dedupe: 2.2, compress: 1.5, mbps: 190 };

export const engine = {
  /** TB stored for a backup policy after reduction, and how it builds up. */
  backup(a: Assume, sourceTB: number, daily: number, weekly: number, monthly: number, yearly: number, copy: boolean) {
    const red = a.dedupe * a.compress;
    const inc = sourceTB * (a.change / 100);
    const parts: [string, number][] = [
      ['First full backup', sourceTB / red],
      [`${daily} daily points`, (inc * daily) / red],
      // Blocks that change repeatedly are counted once: a week holds about 2.5 days of unique change, a month about 5.
      [`${weekly} weekly points`, (inc * 2.5 * weekly) / red],
      [`${monthly} monthly points`, (inc * 5 * monthly) / red],
      [`${yearly} yearly points`, (sourceTB * 0.25 * yearly) / red]
    ];
    const one = parts.reduce((s, p) => s + p[1], 0);
    return { parts, one, total: copy ? one * 2 : one, red };
  },
  /** Capacity to reserve at the recovery site for the share of workloads that fail over together. */
  dr(a: Assume, vcpu: number, ramGB: number, storageTB: number, simul: number, overcommit: number, versions: number) {
    const share = simul / 100;
    return {
      vcpu: Math.ceil((vcpu * share) / overcommit),
      ram: Math.ceil(ramGB * share),
      storage: storageTB * (1 + (versions * a.change) / 100),
      test: storageTB * 0.08
    };
  },
  /** First-pass time, waves and downtime for moving servers at the shared copy rate. */
  migration(a: Assume, tb: number, servers: number, perWave: number, syncEveryH: number) {
    const firstH = (tb * 1024 * 1024) / a.mbps / 3600;
    const waves = Math.ceil(servers / perWave);
    const finalGB = (tb * 1024 * (a.change / 100) * syncEveryH) / 24 / servers;
    const downtimeMin = Math.round((finalGB * 1024) / a.mbps / 60 + 12);
    return { firstH, waves, weeks: waves + 2, downtimeMin };
  }
};
const fmt = (n: number, d = 1) => n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
const num = (v: string) => (Number.isFinite(+v) ? +v : 0);

/** Support › Calculators: backup storage, DR site capacity and migration duration from one set of assumptions. */
export function CalculatorsTab({ ctx }: { ctx: Ctx }) {
  const [calc, setCalc] = useState<'backup' | 'dr' | 'mig'>('backup');
  const [a, setA] = useState<Assume>(DEFAULTS);
  const [f, setF] = useState<Record<string, string>>({ source: '20', daily: '14', weekly: '4', monthly: '12', yearly: '1', copy: 'Yes', vcpu: '320', ram: '1280', storage: '22', simul: '60', over: '1.5', versions: '7', tb: '12.4', servers: '29', perWave: '6', sync: '4' });
  const set = (k: string, v: string) => setF(x => ({ ...x, [k]: v.replace(/[^\d.]/g, '') }));
  const mine = () => {
    setF(x => ({ ...x, source: '18.6', vcpu: '268', ram: '1088', storage: '22.4', tb: '12.4', servers: '29' }));
    ctx.toast('Filled from the inventory: Meridian Cooperative Bank and Host360 servers still on VMware', 'ok');
  };
  const b = engine.backup(a, num(f.source), num(f.daily), num(f.weekly), num(f.monthly), num(f.yearly), f.copy === 'Yes');
  const d = engine.dr(a, num(f.vcpu), num(f.ram), num(f.storage), num(f.simul), num(f.over) || 1, num(f.versions));
  const m = engine.migration(a, num(f.tb), Math.max(1, num(f.servers)), Math.max(1, num(f.perWave)), num(f.sync) || 4);
  const input = (k: string, label: string, hint?: string) => <Field key={k} id={`cl-${k}`} label={label} hint={hint}><TextInput id={`cl-${k}`} value={f[k]} onChange={v => set(k, v)} inputMode="numeric" /></Field>;
  return (
    <>
      <Toolbar>
        <Seg label="Calculator" value={calc} onChange={setCalc} options={[{ v: 'backup', label: 'Backup storage' }, { v: 'dr', label: 'DR site' }, { v: 'mig', label: 'Migration duration' }]} />
        <Spacer />
        <Btn kind="outline" icon="radar" onClick={mine}>Use my inventory</Btn>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Inputs">
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {calc === 'backup' ? [input('source', 'Data to protect (TB)'), input('daily', 'Daily points'), input('weekly', 'Weekly points'), input('monthly', 'Monthly points'), input('yearly', 'Yearly points'), <Field key="copy" id="cl-copy" label="Offsite copy"><SelectInput id="cl-copy" value={f.copy} onChange={v => setF(x => ({ ...x, copy: v }))} options={['Yes', 'No']} /></Field>] : null}
              {calc === 'dr' ? [input('vcpu', 'vCPU protected'), input('ram', 'Memory protected (GB)'), input('storage', 'Storage protected (TB)'), input('simul', 'Failing over together (%)', 'A whole-site loss is 100 %'), input('over', 'vCPU over-commit', '1.5 means 1.5 vCPU per core'), input('versions', 'Versions kept')] : null}
              {calc === 'mig' ? [input('tb', 'Data to move (TB)'), input('servers', 'Servers'), input('perWave', 'Servers per weekend wave'), input('sync', 'Hours between sync passes')] : null}
            </div>
          </Panel>
          <Panel title="Shared assumptions" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Used by all three</span>}>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field id="as-c" label="Daily change (%)"><TextInput id="as-c" value={String(a.change)} onChange={v => setA(x => ({ ...x, change: num(v) }))} inputMode="numeric" /></Field>
              <Field id="as-d" label="Deduplication (×)"><TextInput id="as-d" value={String(a.dedupe)} onChange={v => setA(x => ({ ...x, dedupe: num(v) || 1 }))} inputMode="numeric" /></Field>
              <Field id="as-z" label="Compression (×)"><TextInput id="as-z" value={String(a.compress)} onChange={v => setA(x => ({ ...x, compress: num(v) || 1 }))} inputMode="numeric" /></Field>
              <Field id="as-t" label="Copy rate (MB/s)" hint="Measured on aegis-proxy-chn-01"><TextInput id="as-t" value={String(a.mbps)} onChange={v => setA(x => ({ ...x, mbps: num(v) || 1 }))} inputMode="numeric" /></Field>
            </div>
          </Panel>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {calc === 'backup' ? (
            <>
              <Tiles items={[{ label: 'Repository needed', value: fmt(b.one), unit: 'TB', icon: 'database', sub: `${fmt(b.red)}× smaller than the source` }, { label: 'With the offsite copy', value: fmt(b.total), unit: 'TB', icon: 'copy', sub: f.copy === 'Yes' ? 'Second repository of the same size' : 'No copy' }, { label: 'After a year at 20 % growth', value: fmt(b.total * 1.2), unit: 'TB', icon: 'calendar' }]} />
              <Panel title="How it adds up"><div style={{ padding: '0 16px 8px' }}><MiniTable label="Breakdown" cols={[{ label: 'Part' }, { label: 'Stored (TB)', w: '120px', r: true }]} rows={b.parts.map(([k, v]) => [k, fmt(v, 2)])} /></div></Panel>
            </>
          ) : null}
          {calc === 'dr' ? (
            <>
              <Tiles items={[{ label: 'vCPU to reserve', value: String(d.vcpu), icon: 'cpu', sub: `${f.simul} % at ${f.over}× over-commit` }, { label: 'Memory to reserve', value: fmt(d.ram, 0), unit: 'GB', icon: 'layers', sub: 'Memory is never over-committed' }, { label: 'Storage at the site', value: fmt(d.storage), unit: 'TB', icon: 'hard-drive', sub: `${f.versions} versions; plus ${fmt(d.test)} TB for test copies` }]} />
              <Facts items={[{ k: 'Compared with region-2-os', v: `${d.vcpu} of 256 vCPU reserved would leave ${256 - d.vcpu} for other customers; see Resilience › Site capacity` }, { k: 'Formula', v: 'vCPU × share ÷ over-commit; memory × share; storage × (1 + versions × daily change)' }]} />
            </>
          ) : null}
          {calc === 'mig' ? (
            <>
              <Tiles items={[{ label: 'First pass', value: m.firstH < 48 ? fmt(m.firstH) : fmt(m.firstH / 24), unit: m.firstH < 48 ? 'hours' : 'days', icon: 'timer', sub: `${f.tb} TB at ${a.mbps} MB/s` }, { label: 'Waves', value: String(m.waves), icon: 'calendar', sub: `${f.perWave} servers each, one a weekend` }, { label: 'Programme', value: String(m.weeks), unit: 'weeks', icon: 'route', sub: 'Waves plus two weeks of first passes' }, { label: 'Downtime per server', value: String(m.downtimeMin), unit: 'min', icon: 'clock', sub: 'Final sync plus boot' }]} />
              <Facts items={[{ k: 'Same as', v: 'The estimates in Mobility › Assessment use this engine with each server’s own size' }, { k: 'Formula', v: 'Data ÷ copy rate; final sync = change since the last pass ÷ copy rate + 12 min to boot and check' }]} />
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Compatibility matrix */

type Sup = 'Yes' | 'Limited' | 'No' | '—';
const MATRIX: { cat: string; item: string; p: Sup; r: Sup; m: Sup; note: string }[] = [
  { cat: 'Platforms', item: 'Proxmox VE 8.x, 9.x', p: 'Yes', r: 'Yes', m: 'Yes', note: 'Mobility: as a destination' },
  { cat: 'Platforms', item: 'OpenStack 2023.1 to 2025.1', p: 'Yes', r: 'Yes', m: 'Yes', note: 'Mobility: as a destination' },
  { cat: 'Platforms', item: 'VMware vSphere 7.0 U3, 8.0', p: 'Limited', r: 'Yes', m: 'Yes', note: 'Protection with the guest agent only; Mobility as a source' },
  { cat: 'Platforms', item: 'Microsoft Hyper-V 2019, 2022', p: 'Limited', r: 'No', m: 'Limited', note: 'Agent-based backup; migration from Hyper-V through the agent' },
  { cat: 'Platforms', item: 'Nutanix AHV', p: 'No', r: 'No', m: 'No', note: 'Planned for 2027' },
  { cat: 'Guest OS', item: 'Windows Server 2016 to 2025', p: 'Yes', r: 'Yes', m: 'Yes', note: 'VirtIO 0.1.262 injected for Mobility' },
  { cat: 'Guest OS', item: 'Windows Server 2012 R2', p: 'Yes', r: 'Yes', m: 'Limited', note: 'Out of Microsoft support; drivers inject, no Microsoft support after the move' },
  { cat: 'Guest OS', item: 'Red Hat Enterprise Linux 8, 9', p: 'Yes', r: 'Yes', m: 'Yes', note: 'Re-register subscriptions after the move' },
  { cat: 'Guest OS', item: 'Ubuntu 20.04 to 24.04, Debian 11, 12', p: 'Yes', r: 'Yes', m: 'Yes', note: '' },
  { cat: 'Guest OS', item: 'CentOS 7', p: 'Limited', r: 'Yes', m: 'Limited', note: 'End of life; file-level restore only from 2027' },
  { cat: 'Guest OS', item: 'SUSE Linux Enterprise 15', p: 'Yes', r: 'Yes', m: 'Yes', note: '' },
  { cat: 'Databases', item: 'SQL Server 2016 to 2022', p: 'Yes', r: 'Yes', m: 'Yes', note: 'Application-consistent with log backups' },
  { cat: 'Databases', item: 'Oracle 19c, 21c', p: 'Yes', r: 'Yes', m: 'Limited', note: 'RMAN integration; RAC with shared disks cannot be migrated as-is' },
  { cat: 'Databases', item: 'PostgreSQL 13 to 16, MySQL 8', p: 'Yes', r: 'Yes', m: 'Yes', note: '' },
  { cat: 'Databases', item: 'SAP HANA 2.0', p: 'Limited', r: 'Yes', m: 'No', note: 'Backint certification in progress; use file backups until then' },
  { cat: 'Kubernetes', item: 'Kubernetes 1.27 to 1.31', p: 'Yes', r: 'Limited', m: 'No', note: 'Namespaces and persistent volumes; DR at application level only' },
  { cat: 'Kubernetes', item: 'OpenShift 4.14 and later', p: 'Yes', r: 'Limited', m: 'No', note: '' },
  { cat: 'Storage', item: 'S3-compatible with object lock', p: 'Yes', r: '—', m: '—', note: 'Immutable repositories (compliance or governance mode)' },
  { cat: 'Storage', item: 'NFS, SMB', p: 'Yes', r: '—', m: 'Yes', note: 'Mobility: as staging' },
  { cat: 'Storage', item: 'Ceph RBD', p: 'Yes', r: 'Yes', m: 'Yes', note: '' }
];
const cell = (v: Sup, note: string) => (v === 'Yes' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Yes', tip: note || 'Supported' } : v === 'Limited' ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Limited', tip: note } : v === 'No' ? { t: 'status', i: 'circle-minus', c: 'tx', l: 'No', tip: note || 'Not supported' } : { v: 'Not applicable', muted: true });

/** Support › Compatibility: what each product supports, by platform, guest OS, database, Kubernetes and storage. */
export function CompatibilityTab({ ctx }: { ctx: Ctx }) {
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const rows = MATRIX.filter(r => (cat === 'All' || r.cat === cat) && (!ql || `${r.item} ${r.note}`.toLowerCase().includes(ql)));
  return (
    <>
      <Toolbar>
        <Seg label="Category" value={cat} onChange={setCat} options={['All', 'Platforms', 'Guest OS', 'Databases', 'Kubernetes', 'Storage'].map(v => ({ v, label: v }))} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter, e.g. Oracle" label="Filter the matrix" width={220} />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>For Aegis 4.2.1 · updated 17 Oct 2026</span>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Compatibility matrix"
          cols={[{ k: 'c', label: 'Category', w: '120px', dim: true }, { k: 'i', label: 'Supported item', w: 'minmax(240px,1.6fr)' }, { k: 'p', label: 'Protection', w: '130px' }, { k: 'r', label: 'Resilience', w: '130px' }, { k: 'm', label: 'Mobility', w: '130px' }, { k: 'n', label: 'Notes', w: 'minmax(220px,1.8fr)', dim: true }]}
          rows={rows.map((r, i) => ({ id: String(i), c: r.cat, i: { v: r.item, strong: true }, p: cell(r.p, r.note), r: cell(r.r, r.note), m: cell(r.m, r.note), n: r.note ? { v: r.note, tip: r.note } : { v: '—', muted: true } }))}
          state={ctx.ui}
          unit={['item', 'items']}
          filtered={cat !== 'All' || !!ql}
          onClear={() => { setCat('All'); setQ(''); }}
          emptyText="Nothing matches."
        />
      </TableArea>
    </>
  );
}
