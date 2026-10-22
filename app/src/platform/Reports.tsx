import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { AEGIS } from '../data/aegis';
import { T } from '../data/platform';
import { Btn, CheckBox, Field, RadioCard, Seg, SelectInput, TextInput } from '../ui/controls';
import { Bar, Facts, MiniTable, Panel, Section, Spacer, Status, TableArea, Tiles, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import { DepGraph } from '../ui/DepGraph';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, showCustomerCol } from './common';
import { audit, useStore } from './store';

type Tab = 'library' | 'schedules' | 'dashboards' | 'archive';
interface Rep { id: string; name: string; product: string; schedule: string; format: string; to: string; last: string; figures: [string, string][]; customer: string; brand: 'Host360' | 'Customer'; custom?: boolean }
const PROD: Record<string, string> = { backup: 'Protection', dr: 'Resilience', mig: 'Mobility' };
const BASE_REPORTS: Rep[] = [
  ...(['backup', 'dr', 'mig'] as const).flatMap(k => (AEGIS.reports[k] as Omit<Rep, 'product' | 'customer' | 'brand'>[]).map(r => ({ ...r, product: PROD[k], customer: 'h360', brand: 'Host360' as const }))),
  { id: 'rp1', name: 'Monthly service review', product: 'Platform', schedule: '1st of each month at 09:00', format: 'PDF', to: 'anitha.k@meridianbank.in', last: T('01 Oct', '09:00'), figures: [['Backup success', '99.2 %'], ['Within RPO', '96 %'], ['Restores', '4'], ['SLA', 'Met']], customer: 'mer', brand: 'Customer' },
  { id: 'rp2', name: 'Monthly service review', product: 'Platform', schedule: '1st of each month at 09:00', format: 'PDF', to: 'v.joshi@sahyadrihospitals.in', last: T('01 Oct', '09:00'), figures: [['Backup success', '98.7 %'], ['Within RPO', '—'], ['Restores', '2'], ['SLA', 'Credit 1']], customer: 'sah', brand: 'Customer' },
  { id: 'rp3', name: 'Usage and charges', product: 'Platform', schedule: 'Last day of the month at 23:00', format: 'CSV', to: 'finance@kaverilogistics.in', last: T('30 Sep', '23:00'), figures: [['VMs', '22'], ['Stored', '4.2 TB'], ['Rated', '₹31,004'], ['Change', '+3 %']], customer: 'kav', brand: 'Customer' }
];
const SLA = [
  { c: 'h360', rpo: 92, rto: 100, ok: 99.0, restores: '13 of 13', sla: 'Met', note: '' },
  { c: 'mer', rpo: 88, rto: 100, ok: 99.2, restores: '4 of 4', sla: 'At risk', note: '2 Tier 1 workloads behind RPO since region-2-os stopped answering at 14:52' },
  { c: 'kav', rpo: 100, rto: 100, ok: 99.6, restores: '1 of 1', sla: 'Met', note: '' },
  { c: 'sah', rpo: 100, rto: 0, ok: 98.7, restores: '1 of 2', sla: 'Breached', note: 'Restore test on his-db-01 9 days overdue; ₹1,400 credit on INV-2026-1006' },
  { c: 'cor', rpo: 100, rto: 0, ok: 97.9, restores: '0 of 1', sla: 'Suspended', note: 'Account suspended for non-payment; restores blocked' }
];
const ARCHIVE = [
  { id: 'a1', name: 'Recovery target compliance, September', customer: 'h360', when: T('01 Oct', '07:00'), sha: '0f3c…a19e', kind: 'Report' },
  { id: 'a2', name: 'RBI quarterly DR evidence, Q2 FY27 (EVP-0311)', customer: 'mer', when: T('01 Oct', '09:10'), sha: '4e1a…9c02', kind: 'Evidence pack' },
  { id: 'a3', name: 'Reconciliation: Web tier returned to primary', customer: 'h360', when: T('21 Jul', '04:42'), sha: '9c1e…4b07', kind: 'Reconciliation' },
  { id: 'a4', name: 'Monthly service review, September', customer: 'mer', when: T('01 Oct', '09:00'), sha: '7a20…e3d1', kind: 'Report' },
  { id: 'a5', name: 'Annual BCP test, NABH (EVP-0302)', customer: 'sah', when: T('05 Oct', '11:00'), sha: '22c8…7a14', kind: 'Evidence pack' },
  { id: 'a6', name: 'Cutover summary, Wave 1 · Branch services', customer: 'mer', when: T('05 Oct', '03:30'), sha: 'c4b9…1f60', kind: 'Report' }
];

/** Reports: the library, a builder, schedules, dashboards (RPO and SLA, storage, site map) and the signed archive. */
export default function ReportsSection({ ctx }: { ctx: Ctx }) {
  const tab = ((['library', 'schedules', 'dashboards', 'archive'] as string[]).includes(ctx.tab) ? ctx.tab : 'library') as Tab;
  const [reps, setReps] = useState<Rep[]>(BASE_REPORTS);
  const mine = reps.filter(r => inScope(ctx, r.customer));
  return (
    <Section<Tab>
      kicker="Operations"
      title="Reports"
      sub="Ready-made and your own reports, when they go out and to whom, live dashboards, and every signed report kept for audit."
      tab={tab}
      onTab={t => ctx.go(`reports/${t}`)}
      tabs={[{ v: 'library', label: 'Library', count: mine.length }, { v: 'schedules', label: 'Schedules' }, { v: 'dashboards', label: 'Dashboards' }, { v: 'archive', label: 'Archive' }]}
    >
      {tab === 'library' ? <Library ctx={ctx} reps={mine} onAdd={r => setReps(x => [...x, r])} /> : null}
      {tab === 'schedules' ? <Schedules ctx={ctx} reps={mine} onSave={r => setReps(x => x.map(y => (y.id === r.id ? r : y)))} /> : null}
      {tab === 'dashboards' ? <Dashboards ctx={ctx} /> : null}
      {tab === 'archive' ? <Archive ctx={ctx} /> : null}
    </Section>
  );
}

function Library({ ctx, reps, onAdd }: { ctx: Ctx; reps: Rep[]; onAdd: (r: Rep) => void }) {
  const [prod, setProd] = useState('All');
  const drawer = useClosable<string>();
  const build = useClosable<boolean>();
  const rows = reps.filter(r => prod === 'All' || r.product === prod);
  const d = drawer.value ? reps.find(r => r.id === drawer.value) : null;
  const run = (r: Rep, fmt?: string) => ctx.toast(`${r.name} (${fmt || r.format.split(' ')[0]}) is ready to download`, 'ok');
  return (
    <>
      <Toolbar>
        <Seg label="Product" value={prod} onChange={setProd} options={['All', 'Protection', 'Resilience', 'Mobility', 'Platform'].map(v => ({ v, label: v, count: v === 'All' ? reps.length : reps.filter(r => r.product === v).length }))} />
        <Spacer />
        <Btn kind="primary" icon="plus" perm={ctx.can('configure', 'Building reports')} onClick={() => build.open(true)}>Build a report</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Report library"
          cols={[
            { k: 'n', label: 'Report', w: 'minmax(220px,1.6fr)' },
            { k: 'p', label: 'Product', w: '110px' },
            ...(showCustomerCol(ctx) ? [{ k: 'c', label: 'Customer', w: 'minmax(150px,1fr)', dim: true }] : []),
            { k: 'f', label: 'Format', w: '110px' },
            { k: 'b', label: 'Branding', w: '150px' },
            { k: 'l', label: 'Last run', w: '130px' },
            { k: 'r', label: '', w: '110px', r: true }
          ]}
          rows={rows.map(r => ({
            id: r.id,
            n: { v: r.name, strong: true, tip: r.custom ? 'Built in the report builder' : 'Ready-made' },
            p: r.product,
            c: custName(r.customer),
            f: r.format,
            b: r.brand === 'Customer' ? (r.customer === 'sah' ? 'CloudNest (white-label)' : custName(r.customer).split(' ')[0]) : 'Host360',
            l: r.last.replace(' 2026', '').replace(' IST', ''),
            r: { t: 'btn', v: 'Run now', onClick: () => run(r) }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['report', 'reports']}
          filtered={prod !== 'All'}
          onClear={() => setProd('All')}
          emptyText="No reports yet. Build one, or schedule a ready-made one."
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Report"
          kicker={`Report · ${d.product}`}
          title={d.name}
          status={<><span>{d.schedule}</span><span>{d.format}</span></>}
          actions={<><Btn kind="outline" icon="download" onClick={() => run(d, 'PDF')}>PDF</Btn><Btn kind="outline" icon="download" onClick={() => run(d, 'CSV')}>CSV</Btn></>}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <MiniTable label="Latest figures" cols={[{ label: 'Figure' }, { label: 'Value', w: '160px', r: true }]} rows={d.figures.map(([k, v]) => [k, <strong key="v" style={{ fontWeight: 600 }}>{v}</strong>])} />
            <Facts items={[{ k: 'Customer', v: custName(d.customer) }, { k: 'Goes to', v: d.to }, { k: 'Schedule', v: d.schedule }, { k: 'Last run', v: d.last }, { k: 'Branding', v: d.brand === 'Customer' ? `${d.customer === 'sah' ? 'CloudNest Resilience' : custName(d.customer)}: logo, colours and footer; no Host360 name` : 'Host360' }, { k: 'Kept', v: 'Each run is signed and kept in the archive for 7 years', icon: 'lock' }]} />
          </div>
        </Drawer>
      ) : null}
      {build.value ? <BuilderDialog ctx={ctx} closing={build.closing} onClose={build.close} onSave={r => { onAdd(r); build.close(); drawer.open(r.id); }} /> : null}
    </>
  );
}

const DATASETS: Record<string, { cols: string[]; sample: string[][] }> = {
  Workloads: { cols: ['Workload', 'Customer', 'Tier', 'Backup', 'Last backup', 'DR', 'Newest point age'], sample: [['SQL01', 'Meridian', 'Tier 0', 'Protected', '21 Oct 15:00', 'Behind', '58 min'], ['erp-db-01', 'Host360', 'Tier 0', 'Protected', '21 Oct 15:00', 'Within', '4 min'], ['his-db-01', 'Sahyadri', 'Tier 0', 'Warning', '21 Oct 02:10', '—', '—']] },
  Jobs: { cols: ['Job', 'Object', 'Started', 'Took', 'Result', 'Size'], sample: [['Backup', 'erp-db-01', '21 Oct 15:00', '6 min', 'Succeeded', '14.2 GB'], ['Backup', 'file-srv-03', '21 Oct 02:48', '41 min', 'Failed', '—'], ['Sync', 'crm-db-01', '21 Oct 14:55', '3 min', 'Succeeded', '2.1 GB']] },
  Drills: { cols: ['Plan', 'When', 'Took', 'RTO target', 'Met', 'Evidence'], sample: [['Core services failover', '18 Oct 22:10', '18 min 40 s', '1 h', 'Yes', 'DRL-0918'], ['CBS failover', '28 Sep 22:00', '41 min', '1 h', 'Yes', 'DRL-0928']] },
  Migrations: { cols: ['Server', 'Wave', 'Stage', 'Downtime', 'Committed'], sample: [['mer-branch-app-01', 'Wave 1', 'Committed', '22 min', '05 Oct'], ['SQL01', 'Wave 2', 'Syncing', '—', '—']] },
  Usage: { cols: ['Customer', 'Product', 'Metric', 'Quantity', 'Amount'], sample: [['Meridian', 'Protection', 'Storage', '18.6 TB-months', '₹44,640'], ['Kaveri', 'Protection', 'VMs', '22 VM-months', '₹14,300']] }
};

function BuilderDialog({ ctx, closing, onClose, onSave }: { ctx: Ctx; closing: boolean; onClose: () => void; onSave: (r: Rep) => void }) {
  const s = useStore();
  const custs = s.customers.filter(c => inScope(ctx, c.id));
  const [ds, setDs] = useState('Workloads');
  const [cols, setCols] = useState<string[]>(DATASETS.Workloads.cols.slice(0, 5));
  const [cust, setCust] = useState(custs[0]?.id || 'h360');
  const [period, setPeriod] = useState('Last 30 days');
  const [fmt, setFmt] = useState<'PDF' | 'CSV' | 'Excel'>('PDF');
  const [brand, setBrand] = useState<'Host360' | 'Customer'>('Customer');
  const [name, setName] = useState('');
  const def = DATASETS[ds];
  const idx = def.cols.map((c, i) => (cols.includes(c) ? i : -1)).filter(i => i >= 0);
  return (
    <Dialog
      title="Build a report"
      sub="Pick the data, the columns and the period; the preview shows the first rows."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!cols.length || name.trim().length < 4} why={!cols.length ? 'Pick at least one column.' : 'Name the report.'} onClick={() => { const r: Rep = { id: 'rx' + Date.now(), name: name.trim(), product: ds === 'Drills' ? 'Resilience' : ds === 'Migrations' ? 'Mobility' : ds === 'Jobs' ? 'Protection' : 'Platform', schedule: 'Not scheduled', format: fmt, to: '—', last: 'Never', figures: [['Rows', String(def.sample.length)], ['Columns', String(cols.length)], ['Period', period]], customer: cust, brand, custom: true }; audit({ who: 'priya.raman', customer: cust, what: 'Built a report', object: r.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${r.name} saved to the library`, 'ok'); onSave(r); }}>Save to library</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
        <Field id="rb-d" label="Data"><SelectInput id="rb-d" value={ds} onChange={v => { setDs(v); setCols(DATASETS[v].cols.slice(0, 4)); }} options={Object.keys(DATASETS)} /></Field>
        <Field id="rb-c" label="Customer"><SelectInput id="rb-c" value={cust} onChange={setCust} options={custs.map(c => ({ v: c.id, label: c.name }))} /></Field>
        <Field id="rb-p" label="Period"><SelectInput id="rb-p" value={period} onChange={setPeriod} options={['Last 7 days', 'Last 30 days', 'This month', 'Last quarter']} /></Field>
      </div>
      <Field label="Columns">
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>{def.cols.map(c => <CheckBox key={c} on={cols.includes(c)} onChange={v => setCols(x => (v ? def.cols.filter(y => x.includes(y) || y === c) : x.filter(y => y !== c)))}>{c}</CheckBox>)}</div>
      </Field>
      <div style={{ border: '1px solid var(--ln)', padding: '0 12px', background: 'var(--panel-2)' }}>
        <MiniTable label="Preview" cols={idx.map(i => ({ label: def.cols[i] }))} rows={def.sample.map(r => idx.map(i => r[i]))} empty="Pick at least one column." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: 16 }}>
        <Field id="rb-n" label="Name"><TextInput id="rb-n" value={name} onChange={setName} placeholder="Tier 0 workloads behind RPO" /></Field>
        <Field id="rb-f" label="Format"><SelectInput id="rb-f" value={fmt} onChange={v => setFmt(v as typeof fmt)} options={['PDF', 'CSV', 'Excel']} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={brand === 'Customer'} onClick={() => setBrand('Customer')} title="Customer’s branding" note="Their logo and colours; white-labelled customers never see Host360" />
        <RadioCard on={brand === 'Host360'} onClick={() => setBrand('Host360')} title="Host360 branding" />
      </div>
    </Dialog>
  );
}

function Schedules({ ctx, reps, onSave }: { ctx: Ctx; reps: Rep[]; onSave: (r: Rep) => void }) {
  const edit = useClosable<string>();
  const r = edit.value ? reps.find(x => x.id === edit.value) : null;
  return (
    <>
      <TableArea>
        <AegisTable
          label="Report schedules"
          cols={[{ k: 'n', label: 'Report', w: 'minmax(220px,1.5fr)' }, ...(showCustomerCol(ctx) ? [{ k: 'c', label: 'Customer', w: 'minmax(140px,1fr)', dim: true }] : []), { k: 's', label: 'Runs', w: 'minmax(170px,1.2fr)' }, { k: 't', label: 'Sent to', w: 'minmax(180px,1.3fr)', dim: true }, { k: 'f', label: 'Format', w: '110px' }, { k: 'l', label: 'Last sent', w: '150px' }]}
          rows={reps.map(x => ({ id: x.id, n: { v: x.name, strong: true }, c: custName(x.customer), s: x.schedule === 'Not scheduled' ? { v: 'Not scheduled', muted: true } : x.schedule, t: x.to, f: x.format, l: x.last === 'Never' ? { v: 'Never', muted: true } : { t: 'status', i: 'circle-check', c: 'ok', l: x.last.replace(' 2026', '').replace(' IST', '') } }))}
          onRow={(id: string) => edit.open(id)}
          state={ctx.ui}
          unit={['schedule', 'schedules']}
          emptyText="Nothing scheduled."
          footR="Times are IST; each recipient gets it in their own zone"
        />
      </TableArea>
      {r ? <ScheduleDialog ctx={ctx} r={r} closing={edit.closing} onClose={edit.close} onSave={n => { onSave(n); edit.close(); }} /> : null}
    </>
  );
}

function ScheduleDialog({ ctx, r, closing, onClose, onSave }: { ctx: Ctx; r: Rep; closing: boolean; onClose: () => void; onSave: (r: Rep) => void }) {
  const [sch, setSch] = useState(r.schedule === 'Not scheduled' ? 'Daily at 07:00' : r.schedule);
  const [to, setTo] = useState(r.to === '—' ? '' : r.to);
  const [fmt, setFmt] = useState(r.format);
  const ok = /\S+@\S+\.\S+/.test(to);
  return (
    <Dialog
      title={`Schedule ${r.name}`}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!ok} why="Give at least one e-mail address." onClick={() => { audit({ who: 'priya.raman', customer: r.customer, what: 'Scheduled a report', object: r.name, when: ctx.now(), r: 'ok', after: [['Runs', sch], ['To', to]] }); ctx.toast(`${r.name} goes to ${to.split(',')[0]} ${sch.toLowerCase()}`, 'ok'); onSave({ ...r, schedule: sch, to, format: fmt }); }}>Save</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="sc-s" label="Runs"><SelectInput id="sc-s" value={sch} onChange={setSch} options={[sch, 'Daily at 07:00', 'Mondays at 08:00', '1st of each month at 09:00', 'After each wave'].filter((x, i, a) => a.indexOf(x) === i)} /></Field>
        <Field id="sc-f" label="Format"><SelectInput id="sc-f" value={fmt} onChange={setFmt} options={[fmt, 'PDF', 'CSV', 'PDF and CSV', 'Excel'].filter((x, i, a) => a.indexOf(x) === i)} /></Field>
      </div>
      <Field id="sc-t" label="Send to" hint="Separate addresses with commas"><TextInput id="sc-t" value={to} onChange={setTo} placeholder="noc@host360.ai" /></Field>
    </Dialog>
  );
}

function Dashboards({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<'sla' | 'storage' | 'map'>('sla');
  const sla = SLA.filter(x => inScope(ctx, x.c));
  const repos = (AEGIS.repos as { name: string; site: string; used: number; cap: number; red: string; lock: string | null; enc: boolean }[]);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Seg label="Dashboard" value={view} onChange={setView} options={[{ v: 'sla', label: 'RPO and SLA' }, { v: 'storage', label: 'Storage' }, { v: 'map', label: 'Site map' }]} />
      {view === 'sla' ? (
        <>
          <Tiles
            items={[
              { label: 'Within RPO', value: `${Math.round(sla.reduce((a, x) => a + x.rpo, 0) / Math.max(1, sla.length))}`, unit: '%', icon: 'clock', sub: 'Workloads that need DR, now' },
              { label: 'Backup success', value: `${(sla.reduce((a, x) => a + x.ok, 0) / Math.max(1, sla.length)).toFixed(1)}`, unit: '%', icon: 'archive', sub: 'Scheduled backups, last 30 days' },
              { label: 'SLA met', value: `${sla.filter(x => x.sla === 'Met').length}`, unit: `of ${sla.length}`, icon: 'circle-check', tone: 'ok', sub: 'Customers this month' },
              { label: 'At risk or breached', value: `${sla.filter(x => x.sla === 'At risk' || x.sla === 'Breached').length}`, icon: 'triangle-alert', tone: 'warn', sub: sla.filter(x => x.sla === 'At risk' || x.sla === 'Breached').map(x => custName(x.c)).join(', ') || 'None' }
            ]}
          />
          <Panel title="By customer" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>October 2026 to date</span>}>
            <div style={{ padding: '0 16px 8px' }}>
              <MiniTable
                label="SLA by customer"
                cols={[{ label: 'Customer' }, { label: 'Within RPO', w: '170px' }, { label: 'Backup success', w: '120px', r: true }, { label: 'Restore tests', w: '110px', r: true }, { label: 'SLA', w: '130px' }]}
                rows={sla.map(x => [
                  <span key="c" data-tip={x.note || undefined} style={{ fontWeight: 600 }}>{custName(x.c)}</span>,
                  <span key="r" style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}><span style={{ flex: 1, height: 6, background: 'var(--ln)' }}><span style={{ display: 'block', height: 6, width: `${x.rpo}%`, background: x.rpo >= 95 ? 'var(--ok)' : 'var(--warn)' }} /></span><span style={{ width: 40, textAlign: 'right' }}>{x.rpo} %</span></span>,
                  `${x.ok} %`,
                  x.restores,
                  <Status key="s" icon={x.sla === 'Met' ? 'circle-check' : x.sla === 'At risk' ? 'triangle-alert' : x.sla === 'Breached' ? 'circle-x' : 'ban'} tone={x.sla === 'Met' ? 'ok' : x.sla === 'At risk' ? 'warn' : 'err'} label={x.sla} tip={x.note} />
                ])}
              />
            </div>
          </Panel>
        </>
      ) : null}
      {view === 'storage' ? (
        <>
          <Tiles items={[{ label: 'Stored', value: (repos.reduce((a, r) => a + r.used, 0) / 1024).toFixed(2), unit: 'TB', icon: 'database', sub: 'After deduplication and compression' }, { label: 'Capacity', value: (repos.reduce((a, r) => a + r.cap, 0) / 1024).toFixed(1), unit: 'TB', icon: 'hard-drive', sub: `${repos.length} repositories` }, { label: 'Fills first', value: 'copy-check-repo', icon: 'calendar-clock', tone: 'warn', sub: 'Forecast 14 Feb 2027 at 41 GB a week' }]} />
          <Panel title="Repositories">
            <div style={{ padding: '0 16px 8px' }}>
              <MiniTable
                label="Repositories"
                cols={[{ label: 'Repository' }, { label: 'Site', w: '190px' }, { label: 'Used', w: '220px' }, { label: 'Reduction', w: '90px', r: true }, { label: 'Protection', w: '170px' }]}
                rows={repos.map(r => [
                  <strong key="n" style={{ fontWeight: 600 }}>{r.name}</strong>,
                  r.site,
                  <span key="u" style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}><span style={{ flex: 1, height: 6, background: 'var(--ln)' }}><span style={{ display: 'block', height: 6, width: `${(r.used / r.cap) * 100}%`, background: r.used / r.cap > 0.85 ? 'var(--warn)' : 'var(--run)' }} /></span><span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{Math.round(r.used)} of {r.cap} GB</span></span>,
                  r.red,
                  <span key="p" style={{ display: 'inline-flex', gap: 10 }}>{r.lock ? <span data-tip={`Immutable: ${r.lock} lock`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="lock" />{r.lock}</span> : <span style={{ color: 'var(--tx-3)' }}>No lock</span>}{r.enc ? <span data-tip="Encrypted" style={{ display: 'inline-flex' }}><Icon name="shield" /></span> : null}</span>
                ])}
              />
            </div>
          </Panel>
        </>
      ) : null}
      {view === 'map' ? (
        <>
          <DepGraph
            label="Site map"
            nodes={[
              { id: 'cpp', label: 'Chennai-proxmox-prod', sub: 'Chennai DC1 · 109 guests', icon: 'server' },
              { id: 'clp', label: 'Chennai_Lab_Proxmox', sub: 'Chennai DC1 · 9 guests', icon: 'server' },
              { id: 'vc', label: 'Chennai vCenter', sub: 'Chennai DC1 · migrating', icon: 'server' },
              { id: 'pos', label: 'production-openstack', sub: 'Chennai DC1 · DR and migration target', icon: 'cloud' },
              { id: 'r2', label: 'region-2-os', sub: 'Mumbai DC2 · not answering', icon: 'cloud', tone: 'err' },
              { id: 'obj', label: 'obj-check', sub: 'Backups · immutable 14 d', icon: 'database' },
              { id: 'dir', label: 'repo-director-lab', sub: 'Lab backups', icon: 'database' },
              { id: 'copy', label: 'copy-check-repo', sub: 'Offsite copies', icon: 'database' },
              { id: 'pve', label: 'Chennai-proxmox-prod (new)', sub: 'Migration target', icon: 'server' }
            ]}
            edges={[['cpp', 'obj'], ['cpp', 'pos'], ['cpp', 'r2'], ['clp', 'dir'], ['vc', 'pos'], ['vc', 'pve'], ['obj', 'copy'], ['pos', 'obj']]}
            columnLabel={i => ['Where workloads run', 'Recovery sites and targets', 'Repositories', 'Offsite copies'][i] || `Step ${i + 1}`}
          />
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Arrows show where data goes: backups to repositories, replication to recovery sites, migrations to new platforms, and copies offsite. Hover a site to see its links.</p>
        </>
      ) : null}
    </div>
  );
}

function Archive({ ctx }: { ctx: Ctx }) {
  const rows = ARCHIVE.filter(a => inScope(ctx, a.customer));
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}><Bar tone="info" icon="lock">Kept for 7 years in write-once storage. Nothing here can be changed or deleted, by anyone, before then.</Bar></div>
      <TableArea>
        <AegisTable
          label="Signed archive"
          cols={[{ k: 'n', label: 'Document', w: 'minmax(260px,2fr)' }, { k: 'k', label: 'Kind', w: '140px' }, ...(showCustomerCol(ctx) ? [{ k: 'c', label: 'Customer', w: 'minmax(150px,1fr)', dim: true }] : []), { k: 'w', label: 'Signed', w: '150px' }, { k: 'h', label: 'SHA-256', w: '120px', dim: true }, { k: 'd', label: '', w: '120px', r: true }]}
          rows={rows.map(a => ({ id: a.id, n: { v: a.name, strong: true }, k: a.kind, c: custName(a.customer), w: { t: 'status', i: 'badge-check', c: 'ok', l: a.when.replace(' 2026', '').replace(' IST', '') }, h: a.sha, d: { t: 'btn', v: 'Download', onClick: () => ctx.toast(`${a.name}: signed PDF downloaded`, 'ok') } }))}
          state={ctx.ui}
          unit={['document', 'documents']}
          emptyText="Nothing archived yet. Every scheduled report and evidence pack lands here once signed."
          footR={plural(rows.length, 'signed document')}
        />
      </TableArea>
    </>
  );
}
