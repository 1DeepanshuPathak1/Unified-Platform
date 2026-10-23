import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Btn, Field, RadioCard, Seg, SelectInput, Tabs } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Panel, Spacer, Status, TableArea, Tiles, Toolbar } from '../../ui/layout';
import { Dialog, Drawer, StepUp, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import AegisMigServers from '../../screens/AegisMigServers';
import { custName, inScope } from '../../platform/common';
import { audit } from '../../platform/store';
import { INVENTORY, IN_PROGRESS, STAGE_LABEL, type SourceVm } from './data';

type Method = 'Agentless (VMware CBT)' | 'Agent in the guest';
interface Rep { vm: SourceVm; method: Method; mode: 'Continuous' | 'Scheduled passes'; lagS: number; cbt: 'On' | 'Reset, resynced' | 'Reset, resync running'; cbtNote?: string; snapAgeH: number; rate: string }
const SNAP_LIMIT_H = 24;

/** Replication state of every server that is moving. Agent for physical and non-VMware sources, CBT otherwise. */
function reps(ctx: Ctx): Rep[] {
  return INVENTORY.filter(v => IN_PROGRESS.includes(v.stage) && inScope(ctx, v.customer)).map((vm, i) => {
    const agent = vm.cbt === 'Off' || vm.os.includes('2008') || vm.source.toLowerCase().includes('phys');
    const reset = i % 5 === 2;
    return {
      vm,
      method: agent ? 'Agent in the guest' : 'Agentless (VMware CBT)',
      mode: vm.stage === 'synced' || vm.stage === 'ready' || vm.stage === 'testing' ? 'Continuous' : 'Scheduled passes',
      lagS: vm.stage === 'first' ? 0 : [12, 40, 9, 220, 31, 18][i % 6],
      cbt: reset ? (i % 2 ? 'Reset, resync running' : 'Reset, resynced') : 'On',
      cbtNote: reset ? (i % 2 ? 'Storage vMotion on 21 Oct, 11:40 reset CBT; full read 62 % done' : 'Snapshot consolidation on 19 Oct reset CBT; full read finished 19 Oct, 23:10') : undefined,
      snapAgeH: vm.stage === 'first' ? 3 : [0.2, 0.1, 30, 0.3, 0.2, 0.1][i % 6],
      rate: vm.stage === 'first' ? '210 MB/s' : `${[4, 11, 2, 38, 6, 3][i % 6]} MB/s`
    };
  });
}
const ORPHANS = [
  { vm: 'sql01', snap: 'aegis-mig-pass-0412', age: '3 d 4 h', size: '38 GB', by: 'Aegis (pass interrupted by a host reboot)' },
  { vm: 'fin-app-02', snap: 'VeeamTmp_8812', age: '19 d', size: '112 GB', by: 'Another backup product' },
  { vm: 'rpt-app-01', snap: 'before-patch-sep', age: '41 d', size: '64 GB', by: 'administrator@vsphere.local' }
];
const fmtLag = (s: number) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);

/** Mobility › Servers: the original list, live replication and rollback, as tabs. */
export function MigServersPage({ ctx }: { ctx: Ctx }) {
  const tab = ctx.tab === 'replication' || ctx.tab === 'rollback' ? ctx.tab : 'servers';
  const tabs = (
    <Tabs
      label="Servers sections"
      value={tab}
      onChange={t => ctx.go(t === 'servers' ? 'servers' : `servers/${t}`)}
      tabs={[
        { v: 'servers', label: 'Servers' },
        { v: 'replication', label: 'Replication', count: reps(ctx).length, tip: 'Method, lag, change tracking, snapshots and limits' },
        { v: 'rollback', label: 'Rollback', tip: 'Reverse replication for servers inside their rollback window' }
      ]}
      style={{ margin: '0 24px 12px', padding: 0 }}
    />
  );
  if (tab === 'servers') return <AegisMigServers ctx={ctx} tabs={tabs} />;
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
      <div style={{ flex: 'none', padding: '20px 24px 16px' }}>
        <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: 4 }}>Mobility</div>
        <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Servers</h1>
        <p style={{ marginTop: 2, color: 'var(--tx-2)' }}>{tab === 'replication' ? 'How each moving server is copied, how far behind the target is, and what was reset.' : 'Servers that were cut over and can still go back, with changes copied back to the source as they happen.'}</p>
      </div>
      {tabs}
      <div key={tab} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-fade 150ms var(--ease)' }}>{tab === 'replication' ? <ReplicationView ctx={ctx} /> : <RollbackView ctx={ctx} />}</div>
    </div>
  );
}

function ReplicationView({ ctx }: { ctx: Ctx }) {
  const [over, setOver] = useState<Record<string, Method>>({});
  const all = reps(ctx).map(r => ({ ...r, method: over[r.vm.id] || r.method }));
  const [show, setShow] = useState<'all' | 'attention'>('all');
  const drawer = useClosable<string>();
  const method = useClosable<string>();
  const limits = useClosable<boolean>();
  const orphans = useClosable<boolean>();
  const [lim, setLim] = useState({ job: '8 servers', host: '3 servers', target: '6 servers', snap: '24 h, then alert' });
  const attention = (r: Rep) => r.cbt !== 'On' || r.snapAgeH > SNAP_LIMIT_H || r.lagS > 120;
  const rows = all.filter(r => show === 'all' || attention(r));
  const d = drawer.value ? all.find(r => r.vm.id === drawer.value) : null;
  const cfg = ctx.can('configure', 'Changing migration settings');
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Replicating', value: String(all.length), icon: 'refresh-cw', sub: `${all.filter(r => r.mode === 'Continuous').length} continuously · ${all.filter(r => r.method === 'Agent in the guest').length} through the agent` },
            { label: 'Worst lag', value: all.length ? fmtLag(Math.max(...all.map(r => r.lagS))) : '—', icon: 'timer', tone: all.some(r => r.lagS > 120) ? 'warn' : 'ok', sub: 'Age of the newest change at the target' },
            { label: 'Change tracking resets', value: String(all.filter(r => r.cbt !== 'On').length), icon: 'triangle-alert', tone: all.some(r => r.cbt !== 'On') ? 'warn' : 'ok', sub: 'Each one forces a full read; never silent' },
            { label: 'Orphan snapshots', value: String(ORPHANS.length), icon: 'layers', tone: 'warn', sub: `Older than ${SNAP_LIMIT_H} h on the sources` }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={show} onChange={setShow} options={[{ v: 'all', label: 'All', count: all.length }, { v: 'attention', label: 'Needs attention', count: all.filter(attention).length }]} />
        <Spacer />
        <Btn kind="ghost" icon="layers" onClick={() => orphans.open(true)}>Orphan snapshots ({ORPHANS.length})</Btn>
        <Btn kind="outline" icon="gauge" perm={cfg} onClick={() => limits.open(true)}>Limits…</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Migration replication"
          cols={[
            { k: 'n', label: 'Server', w: 'minmax(140px,1.1fr)' },
            { k: 'c', label: 'Customer', w: 'minmax(120px,1fr)', dim: true },
            { k: 'st', label: 'Stage', w: '130px', dim: true },
            { k: 'm', label: 'Method', w: '170px' },
            { k: 'mode', label: 'Mode', w: '130px', dim: true },
            { k: 'lag', label: 'Lag', w: '80px', r: true },
            { k: 'cbt', label: 'Change tracking', w: '180px' },
            { k: 'snap', label: 'Snapshot age', w: '120px', r: true }
          ]}
          rows={rows.map(r => ({
            id: r.vm.id,
            n: { v: r.vm.name, strong: true },
            c: custName(r.vm.customer),
            st: STAGE_LABEL[r.vm.stage],
            m: r.method,
            mode: r.mode,
            lag: r.vm.stage === 'first' ? { v: 'First pass', muted: true, s: -1 } : { v: fmtLag(r.lagS), s: r.lagS, tip: r.lagS > 120 ? 'Behind: the source is writing faster than the link carries' : undefined },
            cbt: r.cbt === 'On' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'On' } : { t: 'status', i: r.cbt === 'Reset, resynced' ? 'circle-check' : 'loader-circle', c: 'warn', l: r.cbt, tip: r.cbtNote },
            snap: r.snapAgeH > SNAP_LIMIT_H ? { v: `${Math.round(r.snapAgeH)} h`, s: r.snapAgeH, tip: `Over the ${SNAP_LIMIT_H} h limit` } : { v: r.snapAgeH < 1 ? `${Math.round(r.snapAgeH * 60)} min` : `${Math.round(r.snapAgeH)} h`, s: r.snapAgeH, muted: true }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['server', 'servers']}
          filtered={show !== 'all'}
          onClear={() => setShow('all')}
          emptyText="Nothing is replicating. Servers start replicating when their wave’s first pass begins."
          footR={`At most ${lim.job} per job, ${lim.host} per source host, ${lim.target} per target`}
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Server replication"
          kicker={`Replication · ${custName(d.vm.customer)} · ${d.vm.source}`}
          title={d.vm.name}
          status={<><span>{STAGE_LABEL[d.vm.stage]}</span><span>{d.method}</span></>}
          actions={
            <>
              <Btn kind="outline" icon="refresh-cw" perm={ctx.can('operate', 'Resyncing')} onClick={() => { ctx.startJob({ name: 'Resync', object: d.vm.name, product: 'Migration', phases: ['Queued', 'Compare blocks', 'Copy differences', 'Done'], speed: 12, rate: '180 MB/s' }); ctx.toast(`Resync of ${d.vm.name} started`, 'info'); }}>Resync</Btn>
              <Btn kind="ghost" icon="split" perm={cfg} onClick={() => method.open(d.vm.id)}>Change method…</Btn>
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.cbtNote ? <Bar tone="warn" multiline>{d.cbtNote}. The full read is part of the next pass; the recovery point says why it was larger.</Bar> : null}
            <DrawerTiles items={[{ label: 'Lag', value: d.vm.stage === 'first' ? '—' : fmtLag(d.lagS), sub: d.mode }, { label: 'Throughput', value: d.rate }, { label: 'Snapshot age', value: d.snapAgeH < 1 ? `${Math.round(d.snapAgeH * 60)} min` : `${Math.round(d.snapAgeH)} h`, sub: `Limit ${SNAP_LIMIT_H} h` }]} />
            <Facts items={[{ k: 'Method', v: d.method === 'Agentless (VMware CBT)' ? 'Agentless: changed blocks from VMware CBT through VDDK; a snapshot is held only during each pass' : 'Agent in the guest: a filter driver sends writes as they happen; no VMware snapshot' }, { k: 'Mode', v: d.mode === 'Continuous' ? 'Continuous: changes sent every few seconds until cutover' : 'Scheduled passes every 4 h until the first full copy finishes' }, { k: 'Firmware', v: d.vm.firmware }, { k: 'Disks', v: d.vm.disks.map(x => `${x} GB`).join(', ') }, { k: 'Target', v: d.vm.dest || 'Set by the wave' }]} />
          </div>
        </Drawer>
      ) : null}
      {method.value ? (
        <MethodDialog
          name={all.find(r => r.vm.id === method.value)?.vm.name || ''}
          cur={all.find(r => r.vm.id === method.value)!.method}
          closing={method.closing}
          onClose={method.close}
          onSave={m => {
            const id = method.value as string;
            setOver(o => ({ ...o, [id]: m }));
            audit({ who: 'priya.raman', customer: 'h360', what: 'Changed the migration method', object: all.find(r => r.vm.id === id)?.vm.name || id, when: ctx.now(), r: 'ok', after: [['Method', m]] });
            ctx.toast(`Method changed to ${m.toLowerCase()}; the next pass reads every block once`, 'ok');
            method.close();
          }}
        />
      ) : null}
      {limits.value ? (
        <Dialog title="Replication limits" sub="Protect the sources and the targets while servers move." closing={limits.closing} onClose={limits.close} footer={<><Btn kind="ghost" onClick={limits.close}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Changed migration limits', object: 'Mobility', when: ctx.now(), r: 'ok', after: [['Per job', lim.job], ['Per source host', lim.host], ['Per target', lim.target], ['Snapshots', lim.snap]] }); ctx.toast('Limits saved; running passes keep their slots', 'ok'); limits.close(); }}>Save</Btn></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field id="ml-j" label="Servers at once, per job"><SelectInput id="ml-j" value={lim.job} onChange={v => setLim(l => ({ ...l, job: v }))} options={['4 servers', '8 servers', '16 servers']} /></Field>
            <Field id="ml-h" label="Per source host" hint="Keeps the ESXi host’s disks responsive."><SelectInput id="ml-h" value={lim.host} onChange={v => setLim(l => ({ ...l, host: v }))} options={['1 server', '2 servers', '3 servers', '5 servers']} /></Field>
            <Field id="ml-t" label="Per target site"><SelectInput id="ml-t" value={lim.target} onChange={v => setLim(l => ({ ...l, target: v }))} options={['4 servers', '6 servers', '10 servers']} /></Field>
            <Field id="ml-s" label="Snapshots on the source"><SelectInput id="ml-s" value={lim.snap} onChange={v => setLim(l => ({ ...l, snap: v }))} options={['24 h, then alert', '24 h, then remove after the pass', '72 h, then alert']} /></Field>
          </div>
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Bandwidth by time of day is set per site link in Settings › Data movement › Bandwidth schedules; it applies to migration as well.</p>
        </Dialog>
      ) : null}
      {orphans.value ? <OrphanDialog ctx={ctx} closing={orphans.closing} onClose={orphans.close} /> : null}
    </>
  );
}

function MethodDialog({ name, cur, closing, onClose, onSave }: { name: string; cur: Method; closing: boolean; onClose: () => void; onSave: (m: Method) => void }) {
  const [m, setM] = useState<Method>(cur);
  return (
    <Dialog title={`Method for ${name}`} closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={m === cur} why="Nothing changed." onClick={() => onSave(m)}>Save</Btn></>}>
      <div role="radiogroup" aria-label="Method" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <RadioCard on={m === 'Agentless (VMware CBT)'} onClick={() => setM('Agentless (VMware CBT)')} icon="layers" title="Agentless (VMware CBT)" note="Nothing installed in the guest. Needs CBT; a short snapshot is held during each pass." />
        <RadioCard on={m === 'Agent in the guest'} onClick={() => setM('Agent in the guest')} icon="download" title="Agent in the guest" note="For physical servers, other hypervisors and VMs with RDMs or shared disks. No VMware snapshot; lag of seconds." />
      </div>
    </Dialog>
  );
}

function OrphanDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [ok, setOk] = useState(false);
  const [gone, setGone] = useState<string[]>([]);
  return (
    <Dialog title="Orphan snapshots" sub={`Snapshots older than ${SNAP_LIMIT_H} h on the VMware sources. Old snapshots slow the VM and fill the datastore.`} size="lg" closing={closing} onClose={onClose} footer={<Btn kind="ghost" onClick={onClose}>Close</Btn>}>
      <MiniTable
        label="Orphan snapshots"
        cols={[{ label: 'VM', w: '120px' }, { label: 'Snapshot', w: '170px' }, { label: 'Age', w: '80px' }, { label: 'Size', w: '70px', r: true }, { label: 'Created by' }, { label: '', w: '90px' }]}
        rows={ORPHANS.filter(o => !gone.includes(o.snap)).map(o => [
          <strong key="v" style={{ fontWeight: 600 }}>{o.vm}</strong>,
          <code key="s" style={{ font: '12px var(--f-mono)' }}>{o.snap}</code>,
          o.age,
          o.size,
          o.by,
          o.by.startsWith('Aegis') ? (
            <Btn key="r" kind="ghost" size="sm" icon="trash-2" disabled={!ok} why="Confirm with your second factor first." onClick={() => { setGone(g => [...g, o.snap]); audit({ who: 'priya.raman', customer: 'mer', what: 'Removed an orphan snapshot', object: `${o.vm} / ${o.snap}`, when: ctx.now(), r: 'ok' }); ctx.toast(`${o.snap} removed from ${o.vm}; consolidation running`, 'ok'); }}>Remove</Btn>
          ) : (
            <Status key="r" icon="info" tone="tx" label="Not ours" tip="Aegis only removes its own snapshots; the owner is notified." />
          )
        ])}
        empty="No orphan snapshots."
      />
      <StepUp verified={ok} onVerified={() => setOk(true)} />
    </Dialog>
  );
}

const ROLLBACK = [
  { id: 'rb1', name: 'print-srv-02', customer: 'h360', wave: 'Wave 3', cut: '21 Oct, 02:10', ends: '28 Oct, 02:10', state: 'Reverse replication running', lag: '22 s', changed: '1.4 GB', app: 'Print services', order: 1 },
  { id: 'rb2', name: 'mer-br-db', customer: 'mer', wave: 'Wave 1 · Branch services', cut: '04 Oct, 23:20', ends: '25 Oct, 23:20', state: 'Reverse replication running', lag: '4 s', changed: '61.0 GB', app: 'Branch services', order: 1 },
  { id: 'rb3', name: 'mer-br-app-01', customer: 'mer', wave: 'Wave 1 · Branch services', cut: '04 Oct, 23:40', ends: '25 Oct, 23:40', state: 'Reverse replication running', lag: '22 s', changed: '14.2 GB', app: 'Branch services', order: 2 },
  { id: 'rb4', name: 'mer-br-app-02', customer: 'mer', wave: 'Wave 1 · Branch services', cut: '04 Oct, 23:52', ends: '25 Oct, 23:52', state: 'Paused: source host in maintenance until 22 Oct, 06:00', lag: '3 h', changed: '13.8 GB', app: 'Branch services', order: 2 }
];
const DONE = [{ name: 'rhel-oracle-01', customer: 'h360', when: '17 Oct, 01:40', took: '22 min', why: 'The Oracle listener did not start on the new network', lost: '0 changes lost; 2.3 GB copied back and matched', by: 'arun.kumar, approved by priya.raman' }];
function RollbackView({ ctx }: { ctx: Ctx }) {
  const rows = ROLLBACK.filter(r => inScope(ctx, r.customer));
  const roll = useClosable<string>();
  const apps = [...new Set(rows.map(r => r.app))];
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Bar tone="info" multiline>After cutover the source VM stays powered off and receives every change made on the target, so going back loses nothing. The rollback window is set per wave; when it ends, reverse replication stops and the source VM can be decommissioned.</Bar>
      {apps.map(app => {
        const rs = rows.filter(r => r.app === app).sort((a, b) => a.order - b.order);
        return (
          <Panel key={app} title={`${app} · ${custName(rs[0].customer)}`} right={<Btn kind="outline" size="sm" icon="undo-2" perm={ctx.can('operate', 'Rolling back a migration')} onClick={() => roll.open(app)}>Roll back…</Btn>}>
            <div style={{ padding: '4px 16px 12px' }}>
              <MiniTable
                label={`Rollback for ${app}`}
                cols={[{ label: 'Order', w: '60px', r: true }, { label: 'Server', w: '130px' }, { label: 'Cut over', w: '120px' }, { label: 'Window ends', w: '120px' }, { label: 'Back to the source', w: 'minmax(0,1fr)' }, { label: 'Changed since', w: '110px', r: true }]}
                rows={rs.map(r => [String(r.order), <strong key="n" style={{ fontWeight: 600 }}>{r.name}</strong>, r.cut, r.ends, r.state.startsWith('Paused') ? <Status key="s" icon="pause" tone="warn" label={r.state} /> : <Status key="s" icon="refresh-cw" tone="ok" label={`Running · lag ${r.lag}`} />, r.changed])}
              />
              <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Rollback goes in reverse dependency order: front ends first, the database last.</p>
            </div>
          </Panel>
        );
      })}
      <Panel title="Rolled back in the last 30 days">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Recent rollbacks"
            cols={[{ label: 'Server', w: '130px' }, { label: 'When', w: '120px' }, { label: 'Took', w: '70px' }, { label: 'Why', w: 'minmax(0,1fr)' }, { label: 'Reconciliation', w: 'minmax(0,1fr)' }]}
            rows={DONE.filter(x => inScope(ctx, x.customer)).map(x => [<strong key="n" style={{ fontWeight: 600 }} data-tip={x.by}>{x.name}</strong>, x.when, x.took, x.why, <Status key="r" icon="circle-check" tone="ok" label={x.lost} />])}
            empty="No rollbacks."
          />
        </div>
      </Panel>
      {roll.value ? <RollbackDialog ctx={ctx} app={roll.value} rows={rows.filter(r => r.app === roll.value)} closing={roll.closing} onClose={roll.close} /> : null}
    </div>
  );
}

function RollbackDialog({ ctx, app, rows, closing, onClose }: { ctx: Ctx; app: string; rows: typeof ROLLBACK; closing: boolean; onClose: () => void }) {
  const [ok, setOk] = useState(false);
  const order = [...rows].sort((a, b) => b.order - a.order);
  const paused = rows.some(r => r.state.startsWith('Paused'));
  return (
    <Dialog
      title={`Roll back ${app}`}
      sub="Stops the servers on the target, copies their last changes back, starts the source VMs and points DNS back."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="send" disabled={!ok || paused} why={paused ? 'Reverse replication is paused for a server; resume it first so no change is lost.' : 'Confirm with your second factor first.'} onClick={() => { audit({ who: 'priya.raman', customer: rows[0].customer, what: 'Requested a migration rollback', object: app, when: ctx.now(), r: 'ok', note: 'Waiting for a second approver' }); ctx.toast(`Rollback of ${app} sent for approval (APR-1061); it starts when a second person approves`, 'ok'); onClose(); }}>
            Request rollback
          </Btn>
        </>
      }
    >
      {paused ? <Bar tone="warn" multiline>Reverse replication is paused for {rows.filter(r => r.state.startsWith('Paused')).map(r => r.name).join(', ')}. Rolling back now would lose up to 3 h of changes.</Bar> : null}
      <MiniTable label="Rollback order" cols={[{ label: 'Step', w: '50px', r: true }, { label: 'Server', w: '130px' }, { label: 'What happens' }]} rows={order.map((r, i) => [String(i + 1), <strong key="n" style={{ fontWeight: 600 }}>{r.name}</strong>, `Stop on the target, final sync of ${r.changed} changed since cutover, start on the source`])} />
      <Facts labelW={150} items={[{ k: 'Reconciliation', v: 'Block counts and checksums compared after the final sync; the report is attached to the change record' }, { k: 'Approval', v: 'A second person with the Migration Approver role, then the change ticket is updated' }, { k: 'DNS', v: 'Records go back to the source addresses (TTL 60 s)' }]} />
      <StepUp verified={ok} onVerified={() => setOk(true)} />
    </Dialog>
  );
}
