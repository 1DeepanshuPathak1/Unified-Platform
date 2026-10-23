import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Btn, Seg, Tabs } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Spacer, TableArea, Tiles, Toolbar } from '../../ui/layout';
import { Drawer, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import AegisDrServers from '../../screens/AegisDrServers';
import { WORKLOADS } from '../../data/platform';
import { custName, inScope } from '../../platform/common';
import { DR_INFO } from './data';

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

/** Resilience › Protected servers: the original list and the replica checks, as two tabs. */
export function DrServersPage({ ctx }: { ctx: Ctx }) {
  const tab = ctx.tab === 'checks' ? 'checks' : 'servers';
  const tabs = (
    <Tabs
      label="Protected servers sections"
      value={tab}
      onChange={t => ctx.go(t === 'checks' ? 'servers/checks' : 'servers')}
      tabs={[{ v: 'servers', label: 'Replication' }, { v: 'checks', label: 'Replica checks', tip: 'Checksums, test boots, resyncs and encryption at the recovery site' }]}
      style={{ margin: '0 24px 12px', padding: 0 }}
    />
  );
  if (tab === 'servers') return <AegisDrServers ctx={ctx} tabs={tabs} />;
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
      <div style={{ flex: 'none', padding: '20px 24px 16px' }}>
        <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: 4 }}>Resilience</div>
        <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Protected servers</h1>
        <p style={{ marginTop: 2, color: 'var(--tx-2)' }}>Proof that each replica would start and holds the same data as its source.</p>
      </div>
      {tabs}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-fade 150ms var(--ease)' }}>
        <ReplicaChecksView ctx={ctx} />
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
