import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Btn, Seg, Tabs } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Spacer, TableArea, Tiles, Toolbar } from '../../ui/layout';
import { Drawer, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import AegisDrServers from '../../screens/AegisDrServers';
import { WORKLOADS } from '../../data/platform';
import { custName, inScope } from '../../platform/common';
import { DR_INFO, fmtMin, rpoOf, wl } from './data';
import { AppDrView } from './AppDr';
import { SeedView } from '../../platform/Seeding';

type Check = { sum: 'Matched' | 'Mismatch, resynced' | 'Not run'; sumWhen: string; boot: 'Booted' | 'Booted, no network' | 'Not scheduled'; bootWhen: string; resets: [string, string][]; enc: string };
/** Replica correctness per server: sampled checksums against the source, weekly test boots, and every resync with its reason. */
const CHECKS: Record<string, Check> = {
  'cbs-db-01': { sum: 'Matched', sumWhen: '21 Oct, 03:00', boot: 'Booted', bootWhen: '19 Oct, 04:00', resets: [], enc: 'AES-256 · Meridian KMS key' },
  'payments-api': { sum: 'Not run', sumWhen: '—', boot: 'Not scheduled', bootWhen: '—', resets: [], enc: 'AES-256 · Meridian KMS key' },
  sql01: { sum: 'Mismatch, resynced', sumWhen: '20 Oct, 03:00', boot: 'Booted', bootWhen: '19 Oct, 04:20', resets: [['20 Oct, 03:12', 'Checksum mismatch on 3 blocks of disk 2 after a storage vMotion; those blocks were copied again']], enc: 'AES-256 · Meridian KMS key' },
  'rpt-app-01': { sum: 'Matched', sumWhen: '21 Oct, 03:00', boot: 'Booted, no network', bootWhen: '19 Oct, 04:25', resets: [['14 Oct, 22:40', 'CBT reset by VMware after a snapshot consolidation; full read (180 GB) took 41 min']], enc: 'AES-256 · Meridian KMS key' },
  'erp-db-01': { sum: 'Matched', sumWhen: '21 Oct, 03:00', boot: 'Booted', bootWhen: '20 Oct, 04:00', resets: [['17 Oct, 11:05', 'Dirty bitmap lost: VM moved to pve-chn-03 while stopped']], enc: 'AES-256 · Host360 tenant key' },
  'sql-prod-02': { sum: 'Matched', sumWhen: '21 Oct, 03:00', boot: 'Booted', bootWhen: '20 Oct, 04:00', resets: [], enc: 'AES-256 · Host360 tenant key' },
  'ad-dc-01': { sum: 'Matched', sumWhen: '21 Oct, 03:00', boot: 'Booted', bootWhen: '20 Oct, 04:00', resets: [], enc: 'AES-256 · Host360 tenant key' },
  'erp-app-01': { sum: 'Matched', sumWhen: '21 Oct, 03:00', boot: 'Booted', bootWhen: '20 Oct, 04:00', resets: [], enc: 'AES-256 · Host360 tenant key' },
  'mail-gw-01': { sum: 'Matched', sumWhen: '21 Oct, 03:00', boot: 'Booted', bootWhen: '20 Oct, 04:00', resets: [['09 Oct, 02:00', 'Journal overflow during a 6 h network outage; resynced from changed blocks']], enc: 'AES-256 · Host360 tenant key' }
};
const NOT_BOOTED = new Set(['mum-oracle-phy-01', 'file-srv-03']);
const checkOf = (id: string): Check => CHECKS[id] || { sum: 'Matched', sumWhen: '21 Oct, 03:00', boot: NOT_BOOTED.has(id) ? 'Not scheduled' : 'Booted', bootWhen: NOT_BOOTED.has(id) ? '—' : '20 Oct, 04:00', resets: [], enc: 'AES-256 · tenant key' };

/** Write-order consistency groups: every member shares each recovery point, so the group is only as recent as its slowest member. */
const GROUPS: { id: string; name: string; customer: string; plan: string; members: string[]; target: number; note?: string }[] = [
  { id: 'g-erp', name: 'ERP', customer: 'h360', plan: 'Core services failover', members: ['erp-db-01', 'sql-prod-02', 'erp-app-01'], target: 15 },
  { id: 'g-mail', name: 'Directory and mail', customer: 'h360', plan: 'Core services failover', members: ['ad-dc-01', 'mail-gw-01'], target: 15 },
  { id: 'g-cbs', name: 'Core banking', customer: 'mer', plan: 'CBS failover', members: ['cbs-db-01', 'payments-api'], target: 15, note: 'payments-api has no replica yet, so the group cannot take a point that includes it. cbs-db-01 keeps its own points meanwhile.' },
  { id: 'g-cbr', name: 'Core banking reporting', customer: 'mer', plan: 'Core banking reporting failover', members: ['sql01', 'rpt-app-01'], target: 15 },
  { id: 'g-kav', name: 'Kaveri finance', customer: 'kav', plan: 'Kaveri finance', members: ['kav-wms-db', 'kav-tally-01'], target: 60 }
];

/** Resilience › Protected servers: the original list, consistency groups and replica checks, as tabs. */
export function DrServersPage({ ctx }: { ctx: Ctx }) {
  const tab = ctx.tab === 'checks' || ctx.tab === 'groups' || ctx.tab === 'apps' || ctx.tab === 'seeding' ? ctx.tab : 'servers';
  const tabs = (
    <Tabs
      label="Protected servers sections"
      value={tab}
      onChange={t => ctx.go(t === 'servers' ? 'servers' : `servers/${t}`)}
      tabs={[{ v: 'servers', label: 'Replication' }, { v: 'groups', label: 'Consistency groups', count: GROUPS.filter(g => inScope(ctx, g.customer)).length, tip: 'Servers that share each recovery point, and the group’s RPO' }, { v: 'apps', label: 'Databases and Kubernetes', tip: 'DR done by the database or the cluster itself: Always On, Data Guard, streaming replication, namespaces' }, { v: 'checks', label: 'Replica checks', tip: 'Checksums, test boots, resyncs and encryption at the recovery site' }, { v: 'seeding', label: 'Initial sync', tip: 'First full copies sent by disk instead of over the link' }]}
      style={{ margin: '0 24px 12px', padding: 0 }}
    />
  );
  if (tab === 'servers') return <AegisDrServers ctx={ctx} tabs={tabs} />;
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
      <div style={{ flex: 'none', padding: '20px 24px 16px' }}>
        <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: 4 }}>Resilience</div>
        <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Protected servers</h1>
        <p style={{ marginTop: 2, color: 'var(--tx-2)' }}>{tab === 'groups' ? 'Servers that must come back from the same moment, so a database and its application never disagree.' : tab === 'apps' ? 'Databases and Kubernetes namespaces replicated by their own tools; Aegis watches the lag and runs the switch.' : tab === 'seeding' ? 'First full copies that travel on an encrypted disk, so a slow link only has to carry the changes.' : 'Proof that each replica would start and holds the same data as its source.'}</p>
      </div>
      {tabs}
      <div key={tab} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-fade 150ms var(--ease)' }}>
        {tab === 'groups' ? <GroupsView ctx={ctx} /> : tab === 'apps' ? <AppDrView ctx={ctx} /> : tab === 'seeding' ? <SeedView ctx={ctx} product="Resilience" /> : <ReplicaChecksView ctx={ctx} />}
      </div>
    </div>
  );
}

function ReplicaChecksView({ ctx }: { ctx: Ctx }) {
  const [show, setShow] = useState<'all' | 'issues'>('all');
  const drawer = useClosable<string>();
  const ws = WORKLOADS.filter(w => DR_INFO[w.id] && w.dr.s !== 'none' && w.dr.s !== 'na' && inScope(ctx, w.customer) && w.type !== 'DNS record' && w.type !== 'Load balancer');
  const bad = (id: string) => { const c = checkOf(id); return c.sum !== 'Matched' || c.boot !== 'Booted' || c.resets.length > 0; };
  const rows = ws.filter(w => show === 'all' || bad(w.id));
  const d = drawer.value ? ws.find(w => w.id === drawer.value) : null;
  const c = d ? checkOf(d.id) : null;
  const resets = ws.reduce((a, w) => a + checkOf(w.id).resets.length, 0);
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Checksums matched', value: String(ws.filter(w => checkOf(w.id).sum === 'Matched').length), unit: `of ${ws.length}`, icon: 'copy-check', tone: 'ok', sub: '2 % of blocks sampled nightly; full compare monthly' },
            { label: 'Booted in the last 7 days', value: String(ws.filter(w => checkOf(w.id).boot !== 'Not scheduled').length), unit: `of ${ws.length}`, icon: 'power', tone: ws.some(w => checkOf(w.id).boot === 'Not scheduled') ? 'warn' : 'ok', sub: 'Weekly boot on an isolated network, screenshot kept' },
            { label: 'Resyncs, 30 days', value: String(resets), icon: 'refresh-cw', tone: resets ? 'warn' : 'ok', sub: 'Each with its reason; never silent' },
            { label: 'Encrypted at the recovery site', value: String(ws.length), unit: `of ${ws.length}`, icon: 'shield', tone: 'ok', sub: 'Replicas, journals and test copies' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={show} onChange={setShow} options={[{ v: 'all', label: 'All servers', count: ws.length }, { v: 'issues', label: 'With findings', count: ws.filter(w => bad(w.id)).length }]} />
        <Spacer />
        <Btn kind="outline" icon="play" perm={ctx.can('operate', 'Running replica checks')} onClick={() => ctx.toast(`Checksum sample and test boot queued for ${ws.length} servers; results by 04:30`, 'info')}>Run checks now</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Replica checks"
          cols={[
            { k: 'n', label: 'Server', w: 'minmax(150px,1.2fr)' },
            { k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true },
            { k: 'to', label: 'Recovery site', w: '160px', dim: true },
            { k: 'sum', label: 'Checksum', w: '190px' },
            { k: 'boot', label: 'Test boot', w: '190px' },
            { k: 'rs', label: 'Resyncs', w: '90px', r: true },
            { k: 'enc', label: 'At rest', w: 'minmax(150px,1fr)', dim: true }
          ]}
          rows={rows.map(w => {
            const x = checkOf(w.id);
            return {
              id: w.id,
              n: { v: w.name, strong: true },
              c: custName(w.customer),
              to: DR_INFO[w.id].dest,
              sum: x.sum === 'Matched' ? { t: 'status', i: 'circle-check', c: 'ok', l: `Matched · ${x.sumWhen.split(',')[0]}` } : x.sum === 'Not run' ? { t: 'status', i: 'circle-minus', c: 'tx', l: 'No replica yet' } : { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Mismatch, resynced', tip: x.resets[0]?.[1] },
              boot: x.boot === 'Booted' ? { t: 'status', i: 'circle-check', c: 'ok', l: `Booted · ${x.bootWhen.split(',')[0]}` } : x.boot === 'Not scheduled' ? { t: 'status', i: 'circle-minus', c: 'tx', l: 'Not scheduled' } : { t: 'status', i: 'triangle-alert', c: 'warn', l: 'No network at boot', tip: 'Booted to the login screen; the NIC driver did not load. Fixed in the plan by injecting VirtIO drivers.' },
              rs: { v: String(x.resets.length), s: x.resets.length, muted: !x.resets.length },
              enc: x.enc
            };
          })}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['server', 'servers']}
          filtered={show !== 'all'}
          onClear={() => setShow('all')}
          emptyText="No findings."
          footR="Checks run at 03:00 (checksums) and Sundays 04:00 (test boots) IST"
        />
      </TableArea>
      {d && c ? (
        <Drawer label="Replica checks" kicker={`Replica · ${custName(d.customer)}`} title={d.name} status={<><span>{DR_INFO[d.id].dest}</span><span>{DR_INFO[d.id].mode}</span></>} closing={drawer.closing} onClose={drawer.close}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {c.sum !== 'Matched' && c.sum !== 'Not run' ? <Bar tone="warn" multiline>{c.resets[0]?.[1]}</Bar> : null}
            <DrawerTiles items={[{ label: 'Checksum', value: c.sum === 'Matched' ? 'Matched' : c.sum === 'Not run' ? '—' : 'Resynced', sub: c.sumWhen }, { label: 'Test boot', value: c.boot === 'Booted' ? 'Booted' : c.boot === 'Not scheduled' ? '—' : 'No network', sub: c.bootWhen }, { label: 'Resyncs, 30 d', value: String(c.resets.length) }]} />
            <Facts items={[{ k: 'Encryption at rest', v: `${c.enc}; journals and test copies too`, icon: 'shield' }, { k: 'Checksum method', v: 'SHA-256 of 2 % of blocks each night, chosen at random; every block on the 1st of the month' }, { k: 'Test boot', v: 'Weekly on an isolated network: boots, waits for the console, takes a screenshot, powers off and deletes' }]} />
            <MiniTable label="Resyncs" cols={[{ label: 'When', w: '130px' }, { label: 'Reason' }]} rows={c.resets.map(([w, r]) => [w, r])} empty="No resyncs in 30 days." />
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

function GroupsView({ ctx }: { ctx: Ctx }) {
  const drawer = useClosable<string>();
  const groups = GROUPS.filter(g => inScope(ctx, g.customer)).map(g => {
    const ms = g.members.map(id => {
      const w = wl(id);
      const r = w ? rpoOf(w) : null;
      const replicated = !!w && !!DR_INFO[id] && w.dr.s !== 'none' && r?.age != null;
      return { id, name: w?.name || id, age: replicated ? r!.age! : null, failed: w?.dr.s === 'failed' };
    });
    const missing = ms.filter(m => m.age == null);
    const worst = missing.length ? null : Math.max(...ms.map(m => m.age!));
    const slowest = worst == null ? null : ms.find(m => m.age === worst)!;
    const state: 'ok' | 'warn' | 'err' = missing.length ? 'err' : worst! > g.target ? 'warn' : 'ok';
    return { ...g, ms, missing, worst, slowest, state };
  });
  const d = drawer.value ? groups.find(g => g.id === drawer.value) : null;
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Groups', value: String(groups.length), icon: 'layers', sub: `${groups.reduce((a, g) => a + g.members.length, 0)} servers share their recovery points` },
            { label: 'Within the group RPO', value: String(groups.filter(g => g.state === 'ok').length), unit: `of ${groups.length}`, icon: 'circle-check', tone: groups.every(g => g.state === 'ok') ? 'ok' : 'warn', sub: 'The slowest member sets the group’s age' },
            { label: 'Incomplete', value: String(groups.filter(g => g.state === 'err').length), icon: 'circle-x', tone: groups.some(g => g.state === 'err') ? 'err' : 'ok', sub: 'A member has no replica yet' }
          ]}
        />
      </div>
      <TableArea>
        <AegisTable
          label="Consistency groups"
          cols={[
            { k: 'n', label: 'Group', w: 'minmax(160px,1.2fr)' },
            { k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true },
            { k: 'm', label: 'Members', w: 'minmax(200px,1.6fr)', dim: true },
            { k: 'age', label: 'Group point age', w: '140px', r: true },
            { k: 't', label: 'Target', w: '80px', r: true, dim: true },
            { k: 'slow', label: 'Slowest member', w: '150px' },
            { k: 's', label: 'State', w: '150px' }
          ]}
          rows={groups.map(g => ({
            id: g.id,
            n: { v: g.name, strong: true, tip: g.plan },
            c: custName(g.customer),
            m: { v: g.ms.map(m => m.name).join(', '), tip: g.ms.map(m => m.name).join(', ') },
            age: g.worst == null ? { v: '—', muted: true, s: 1e9 } : { v: fmtMin(g.worst), s: g.worst },
            t: fmtMin(g.target),
            slow: g.slowest ? { v: g.slowest.name, tip: g.slowest.failed ? 'Its last sync failed' : undefined } : { v: g.missing.map(m => m.name).join(', '), tip: 'No replica yet' },
            s: g.state === 'ok' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Within RPO', s: 0 } : g.state === 'warn' ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Behind target', s: 1 } : { t: 'status', i: 'circle-x', c: 'err', l: 'Incomplete', s: 2, tip: g.note }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['group', 'groups']}
          emptyText="No consistency groups. Turn on write-order consistency in a protection plan to create one."
          sort="s"
          dir={-1}
          footR="Groups come from the protection plan’s write-order consistency setting"
        />
      </TableArea>
      {d ? (
        <Drawer label="Consistency group" kicker={`Consistency group · ${custName(d.customer)}`} title={d.name} status={<><span>{d.plan}</span><span>{d.members.length} servers</span></>} closing={drawer.closing} onClose={drawer.close}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.note ? <Bar tone="err" multiline>{d.note}</Bar> : d.state === 'warn' ? <Bar tone="warn" multiline>{d.slowest?.name} is {fmtMin(d.worst! - d.target)} behind the group target, so a failover now would bring every member back to {fmtMin(d.worst!)} ago.{d.slowest?.failed ? ' Its last sync failed.' : ''}</Bar> : null}
            <DrawerTiles items={[{ label: 'Group point age', value: d.worst == null ? '—' : fmtMin(d.worst) }, { label: 'Target', value: fmtMin(d.target) }, { label: 'Members', value: String(d.members.length) }]} />
            <MiniTable
              label="Members"
              cols={[{ label: 'Server' }, { label: 'Own newest point', w: '150px', r: true }, { label: '', w: '150px' }]}
              rows={d.ms.map(m => [<strong key="n" style={{ fontWeight: 600 }}>{m.name}</strong>, m.age == null ? 'No replica' : fmtMin(m.age), m === d.slowest ? 'Sets the group age' : m.age == null ? 'Blocks the group' : ''])}
            />
            <Facts items={[{ k: 'How', v: 'Writes on every member are tagged with one sequence; a group point is cut when every member has reached the same tag' }, { k: 'Failover', v: 'All members start from the same group point; a member cannot be failed over to a newer point on its own' }, { k: 'Set in', v: `${d.plan} · protection plan setting “Write-order consistency”` }]} />
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
