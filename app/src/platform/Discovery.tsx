import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { T } from '../data/platform';
import { Btn, Field, InfoTip, Seg, SelectInput, Tabs, Toggle } from '../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Page, PageHeader, Spacer, TableArea, Tiles, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit } from './store';

type Product = 'Protection' | 'Resilience' | 'Mobility';
interface Conn { id: string; site: string; kind: string; products: Product[]; schedule: string; events: boolean; last: string; took: string; found: number; changes: number; state: 'ok' | 'warn' | 'unreach'; note?: string }
const CONNS: Conn[] = [
  { id: 'cpp', site: 'Chennai-proxmox-prod', kind: 'Proxmox VE API', products: ['Protection', 'Resilience'], schedule: 'Every 4 hours', events: true, last: T('21 Oct', '16:00'), took: '42 s', found: 109, changes: 3, state: 'ok' },
  { id: 'clp', site: 'Chennai_Lab_Proxmox', kind: 'SSH', products: ['Protection'], schedule: 'Daily at 01:00', events: false, last: T('21 Oct', '01:00'), took: '18 s', found: 9, changes: 1, state: 'ok' },
  { id: 'pos', site: 'production-openstack', kind: 'Keystone v3', products: ['Protection', 'Resilience', 'Mobility'], schedule: 'Every 4 hours', events: true, last: T('21 Oct', '16:00'), took: '1 min 06 s', found: 62, changes: 1, state: 'ok' },
  { id: 'r2', site: 'region-2-os', kind: 'Keystone v3', products: ['Resilience'], schedule: 'Every 4 hours', events: false, last: T('21 Oct', '12:00'), took: '58 s', found: 41, changes: 0, state: 'unreach', note: 'No answer since 14:52 IST (INC-region-2-os). The 16:00 scan was skipped; the last good inventory is kept.' },
  { id: 'vc', site: 'Chennai vCenter', kind: 'vSphere API', products: ['Resilience', 'Mobility'], schedule: 'Every 15 minutes and on vCenter events', events: true, last: T('21 Oct', '16:00'), took: '24 s', found: 41, changes: 3, state: 'ok' },
  { id: 'esx', site: 'esxi-edge-07', kind: 'vSphere API (host)', products: ['Mobility'], schedule: 'Every hour', events: false, last: T('21 Oct', '15:30'), took: '9 s', found: 7, changes: 1, state: 'warn', note: 'Datastore ds-edge-01 is 93 % full.' }
];
interface Change { id: string; when: string; site: string; object: string; kind: 'New' | 'Removed' | 'Changed'; what: string; affects: { p: Product; text: string; act?: boolean }[]; action?: { label: string; route: string; open?: string } }
const CHANGES: Change[] = [
  { id: 'c1', when: T('21 Oct', '16:00'), site: 'Chennai-proxmox-prod', object: 'analytics-02', kind: 'New', what: 'New VM: 8 vCPU, 32 GB, 2 disks (600 GB), Ubuntu 24.04', affects: [{ p: 'Protection', text: 'Not in any backup policy', act: true }, { p: 'Resilience', text: 'No criticality yet, so no DR target', act: true }], action: { label: 'Set criticality…', route: 'workloads' } },
  { id: 'c2', when: T('21 Oct', '16:00'), site: 'Chennai-proxmox-prod', object: 'sql-prod-02', kind: 'Changed', what: 'Disk scsi3 added (500 GB)', affects: [{ p: 'Protection', text: 'Covered: the policy backs up every disk' }, { p: 'Resilience', text: 'Replica disk created at production-openstack on the next sync' }] },
  { id: 'c3', when: T('21 Oct', '12:00'), site: 'Chennai-proxmox-prod', object: 'erp-app-01', kind: 'Changed', what: 'Address changed: 10.20.4.31 → 10.20.4.32', affects: [{ p: 'Resilience', text: 'Core services failover sets erp.host360.ai from a fixed address; review the DNS step', act: true }], action: { label: 'Review the plan', route: 'dr/recovery', open: 'core' } },
  { id: 'c4', when: T('21 Oct', '01:00'), site: 'Chennai_Lab_Proxmox', object: 'test-vm-17', kind: 'Removed', what: 'VM no longer exists on the platform', affects: [{ p: 'Protection', text: 'Recovery points kept for their 30-day retention, then deleted' }] },
  { id: 'c5', when: T('21 Oct', '15:45'), site: 'Chennai vCenter', object: 'mer-ats-02', kind: 'New', what: 'New VM: 4 vCPU, 8 GB, Windows Server 2022, change tracking on', affects: [{ p: 'Mobility', text: 'Assessed: ready to move (readiness 100); not in a wave', act: true }], action: { label: 'Assessment', route: 'mig/assessment/servers' } },
  { id: 'c6', when: T('21 Oct', '14:20'), site: 'Chennai vCenter', object: 'crm-db-01', kind: 'Changed', what: 'Moved from esx-02 to esx-04 (vMotion)', affects: [{ p: 'Mobility', text: 'No action: sync passes read from the new host' }] },
  { id: 'c7', when: T('21 Oct', '11:05'), site: 'Chennai vCenter', object: 'old-sql2008', kind: 'Changed', what: '2 snapshots added by a vCenter user (svc-veeam-legacy)', affects: [{ p: 'Mobility', text: 'Snapshots block a clean first pass; consolidate them', act: true }] },
  { id: 'c8', when: T('21 Oct', '15:30'), site: 'esxi-edge-07', object: 'ds-edge-01', kind: 'Changed', what: 'Datastore 93 % full (was 81 % yesterday)', affects: [{ p: 'Mobility', text: 'Sync-pass snapshots may fail for print-srv-02 and legacy-erp', act: true }] },
  { id: 'c9', when: T('21 Oct', '16:00'), site: 'production-openstack', object: 'web-frontend-03', kind: 'New', what: 'New instance in the web project (m1.large)', affects: [{ p: 'Protection', text: 'Tag “tier:important” matched; added to Production daily automatically' }, { p: 'Resilience', text: 'Not needed: the web tier recovers from its image' }] }
];
const P_ICON: Record<Product, string> = { Protection: 'archive', Resilience: 'life-buoy', Mobility: 'forward' };
const ST: Record<Conn['state'], [string, string, string]> = { ok: ['circle-check', 'Scanned', 'ok'], warn: ['triangle-alert', 'Scanned, warnings', 'warn'], unreach: ['circle-x', 'Could not be read', 'err'] };

/**
 * Workloads › Discovery: one agentless scan per connection serves all three products. Each scan
 * is compared with the last, and every change says what it means for backup, DR and migration.
 */
export function DiscoveryPage({ ctx }: { ctx: Ctx }) {
  const [conns, setConns] = useState<Conn[]>(CONNS);
  const [view, setView] = useState<'all' | 'act'>('act');
  const drawer = useClosable<string>();
  const sched = useClosable<string>();
  const [scanning, setScanning] = useState<string[]>([]);
  const op = ctx.can('operate', 'Starting a scan');
  const d = drawer.value ? conns.find(c => c.id === drawer.value) : null;
  const act = CHANGES.filter(c => c.affects.some(a => a.act));
  const rows = view === 'act' ? act : CHANGES;
  const scan = (ids: string[]) => {
    setScanning(s => [...s, ...ids]);
    ids.forEach(id => {
      const c = conns.find(x => x.id === id)!;
      if (c.state === 'unreach') {
        window.setTimeout(() => { setScanning(s => s.filter(x => x !== id)); ctx.toast(`${c.site} did not answer; the last good inventory is kept`, 'err'); }, 1500);
        return;
      }
      window.setTimeout(() => {
        setScanning(s => s.filter(x => x !== id));
        setConns(x => x.map(y => (y.id === id ? { ...y, last: ctx.now(), changes: 0 } : y)));
      }, 1800);
    });
    ctx.startJob({ name: 'Discovery scan', object: ids.length === 1 ? conns.find(x => x.id === ids[0])!.site : `${ids.length} connections`, product: 'Platform', type: 'Discovery', phases: ['Read inventory', 'Compare with the last scan', 'Tell each product'], speed: 9, doneToast: 'Discovery finished: no new changes' });
  };
  return (
    <Page>
      <PageHeader
        kicker="Platform"
        title="Workloads"
        sub="Discovery: one agentless scan per connection serves Protection, Resilience and Mobility. Every change is checked against what each product needs."
        actions={<Btn kind="secondary" icon="refresh-cw" perm={op} disabled={scanning.length > 0} why="A scan is running." onClick={() => scan(conns.map(c => c.id))}>Scan every connection</Btn>}
      />
      <Tabs<'list' | 'discovery'> label="Workloads" value="discovery" onChange={v => ctx.go(v === 'list' ? 'workloads' : 'workloads/discovery')} style={{ margin: '0 24px 12px', padding: 0 }} tabs={[{ v: 'list', label: 'Workloads' }, { v: 'discovery', label: 'Discovery', count: act.length }]} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '0 24px' }}>
          <Tiles
            items={[
              { label: 'Connections', value: `${conns.length}`, icon: 'plug', sub: `${conns.filter(c => c.state === 'unreach').length} could not be read` },
              { label: 'Workloads found', value: `${conns.reduce((a, c) => a + c.found, 0)}`, icon: 'layers', sub: 'Across every connection' },
              { label: 'Changes in 24 h', value: `${CHANGES.length}`, icon: 'refresh-cw', sub: `${CHANGES.filter(c => c.kind === 'New').length} new · ${CHANGES.filter(c => c.kind === 'Removed').length} removed · ${CHANGES.filter(c => c.kind === 'Changed').length} changed` },
              { label: 'Need a person', value: `${act.length}`, icon: act.length ? 'triangle-alert' : 'circle-check', tone: act.length ? 'warn' : 'ok', sub: 'Changes a product cannot handle by itself' }
            ]}
          />
        </div>
        {conns.some(c => c.state === 'unreach') ? <div style={{ padding: '0 24px' }}><Bar tone="warn">{conns.filter(c => c.state === 'unreach').map(c => `${c.site}: ${c.note}`).join(' ')}</Bar></div> : null}
        <div style={{ padding: '0 24px' }}>
          <AegisTable
            label="Connections"
            cols={[
              { k: 's', label: 'Connection', w: 'minmax(180px,1.3fr)' },
              { k: 'p', label: 'Used by', w: 'minmax(170px,1.2fr)' },
              { k: 'sch', label: 'Schedule', w: 'minmax(170px,1.3fr)', dim: true },
              { k: 'l', label: 'Last scan', w: '150px' },
              { k: 'f', label: 'Found', w: '72px', r: true },
              { k: 'c', label: 'Changes', w: '84px', r: true },
              { k: 'st', label: 'State', w: '170px' }
            ]}
            rows={conns.map(c => ({
              id: c.id,
              s: { v: c.site, strong: true, tip: c.kind },
              p: c.products.join(', '),
              sch: c.schedule,
              l: c.last.replace(' 2026', '').replace(' IST', ''),
              f: { v: String(c.found), s: c.found },
              c: { v: String(c.changes), s: c.changes, strong: c.changes > 0 },
              st: scanning.includes(c.id) ? { t: 'status', i: 'loader-circle', spin: true, c: 'run', l: 'Scanning' } : { t: 'status', i: ST[c.state][0], c: ST[c.state][2], l: ST[c.state][1], tip: c.note || ST[c.state][1] }
            }))}
            onRow={(id: string) => drawer.open(id)}
            active={drawer.value}
            state={ctx.ui}
            unit={['connection', 'connections']}
            emptyText="No connections yet. Add a site; it is scanned as soon as it is added."
          />
        </div>
        <Toolbar style={{ padding: '4px 24px 0' }}>
          <strong style={{ fontWeight: 600 }}>Changes since the last scans</strong>
          <InfoTip tip="Each scan is compared with the previous one. A product handles what it can by itself (a new disk is covered by its policy); the rest waits for a person here and in the Inbox." />
          <Spacer />
          <Seg label="Show" value={view} onChange={setView} options={[{ v: 'act', label: 'Need a person', count: act.length }, { v: 'all', label: 'All changes', count: CHANGES.length }]} />
        </Toolbar>
        <div style={{ padding: '0 24px 24px' }}>
          <MiniTable
            label="Changes"
            cols={[{ label: 'When', w: '96px' }, { label: 'Object', w: '150px' }, { label: 'Change' }, { label: 'What it means', w: 'minmax(0,1.3fr)' }, { label: '', w: '180px', r: true }]}
            rows={rows.map(c => [
              <span key="w" data-tip={c.site}>{c.when.split(', ')[1].replace(' IST', '')}</span>,
              <span key="o" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}><Icon name={c.kind === 'New' ? 'plus' : c.kind === 'Removed' ? 'minus' : 'refresh-cw'} style={{ color: 'var(--tx-3)', flex: 'none' }} /><strong style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.object}</strong></span>,
              <span key="c" data-tip={c.what} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.what}</span>,
              <span key="a" style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                {c.affects.map(a => (
                  <span key={a.p} data-tip={`${a.p}: ${a.text}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', minWidth: 0, color: a.act ? 'var(--tx)' : 'var(--tx-2)' }}>
                    <Icon name={a.act ? 'triangle-alert' : P_ICON[a.p]} style={{ color: a.act ? 'var(--warn)' : 'var(--tx-3)', flex: 'none' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.text}</span>
                  </span>
                ))}
              </span>,
              c.action ? <Btn key="b" kind="ghost" size="sm" iconAfter="arrow-right" onClick={() => ctx.go(c.action!.route, c.action!.open)}>{c.action.label}</Btn> : <span key="b" style={{ color: 'var(--tx-3)', font: '12px var(--f-ui)' }}>Handled</span>
            ])}
            empty="No changes need a person."
          />
        </div>
      </div>
      {d ? (
        <Drawer
          label="Connection"
          kicker={`Discovery · ${d.kind}`}
          title={d.site}
          status={<><span>{d.schedule}</span><span>Last scan {d.last.replace(' 2026', '')}</span></>}
          actions={
            <>
              <Btn kind="outline" icon={scanning.includes(d.id) ? 'loader-circle' : 'refresh-cw'} spin={scanning.includes(d.id)} perm={op} disabled={scanning.includes(d.id)} why="Scanning." onClick={() => scan([d.id])}>Scan now</Btn>
              <Btn kind="outline" icon="calendar-clock" perm={ctx.can('configure', 'Changing the scan schedule')} onClick={() => sched.open(d.id)}>Schedule…</Btn>
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {d.note ? <Bar tone={d.state === 'unreach' ? 'err' : 'warn'} multiline>{d.note}</Bar> : null}
            <DrawerTiles items={[{ label: 'Found', value: String(d.found), sub: 'Workloads on this connection' }, { label: 'Last scan took', value: d.took, sub: d.last }, { label: 'Changes', value: String(d.changes), sub: 'Since the scan before' }]} />
            <Facts items={[{ k: 'Read with', v: d.kind }, { k: 'Serves', v: d.products.map(p => `${p}`).join(', ') + ' from the same scan' }, { k: 'Schedule', v: d.schedule }, { k: 'Events', v: d.events ? 'Also listens for platform events, so new VMs show within a minute' : 'Scheduled scans only', muted: !d.events }, { k: 'Read rate', v: 'Within the source’s cap in Settings › Source impact' }]} />
            <MiniTable label="Recent changes" cols={[{ label: 'When', w: '120px' }, { label: 'Change' }]} rows={CHANGES.filter(c => c.site === d.site).map(c => [c.when.replace(' 2026', '').replace(' IST', ''), `${c.object}: ${c.what}`])} empty="No changes in the last 24 hours." />
          </div>
        </Drawer>
      ) : null}
      {sched.value ? (
        <ScheduleDialog
          c={conns.find(c => c.id === sched.value)!}
          closing={sched.closing}
          onClose={sched.close}
          onSave={(schedule, events) => {
            const c = conns.find(x => x.id === sched.value)!;
            setConns(x => x.map(y => (y.id === c.id ? { ...y, schedule, events } : y)));
            audit({ who: 'priya.raman', customer: 'h360', what: 'Changed a discovery schedule', object: c.site, when: ctx.now(), r: 'ok', before: [['Schedule', c.schedule]], after: [['Schedule', schedule]] });
            ctx.toast(`${c.site} is scanned ${schedule.toLowerCase()}`, 'ok');
            sched.close();
          }}
        />
      ) : null}
    </Page>
  );
}

function ScheduleDialog({ c, closing, onClose, onSave }: { c: Conn; closing: boolean; onClose: () => void; onSave: (s: string, events: boolean) => void }) {
  const [every, setEvery] = useState(c.schedule.split(' and ')[0]);
  const [events, setEvents] = useState(c.events);
  const [quiet, setQuiet] = useState(false);
  const canEvents = c.kind !== 'SSH';
  const s = `${every}${quiet ? ', not 09:00–19:00 IST' : ''}`;
  return (
    <Dialog
      title={`Scan schedule for ${c.site}`}
      sub={`One scan feeds ${plural(c.products.length, 'product')}: ${c.products.join(', ')}.`}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => onSave(events && canEvents ? `${s} and on platform events` : s, events && canEvents)}>Save</Btn></>}
    >
      <Field id="ds-e" label="Scan"><SelectInput id="ds-e" value={every} onChange={setEvery} options={[every, 'Every 15 minutes', 'Every hour', 'Every 4 hours', 'Daily at 01:00'].filter((x, i, a) => a.indexOf(x) === i)} /></Field>
      <Toggle on={events && canEvents} onChange={setEvents} label="Platform events" perm={canEvents ? undefined : { ok: false, dis: 'true', why: 'SSH connections cannot send events.', op: 0.45 }}>Also scan when the platform reports a change</Toggle>
      <Toggle on={quiet} onChange={setQuiet} label="Quiet hours">Skip business hours (09:00–19:00 IST)</Toggle>
    </Dialog>
  );
}
