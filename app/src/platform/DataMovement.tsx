import { useState } from 'react';
import { Btn, Field, SelectInput, TextInput, Toggle } from '../ui/controls';
import { Bar, MiniTable, Panel, Status } from '../ui/layout';
import { Dialog, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit } from './store';
import { AGENTS } from '../data/ops';

/** How changed blocks are found on each platform. One layer reads them for backup, replication and migration alike. */
const TRACKING: { platform: string; how: string; fallback: string; used: string; sites: string; resets: string; tone: 'ok' | 'warn' | 'tx' }[] = [
  { platform: 'Proxmox VE (QEMU)', how: 'Persistent dirty bitmaps', fallback: 'Full read when a bitmap is lost (VM stopped or moved)', used: 'Backup, DR, Migration', sites: 'Chennai-proxmox-prod, Chennai_Lab_Proxmox', resets: '3 in 7 days: VMs moved between nodes', tone: 'warn' },
  { platform: 'Proxmox VE on ZFS', how: 'zfs send -i between snapshots', fallback: 'Dirty bitmaps', used: 'Backup', sites: 'Chennai_Lab_Proxmox', resets: 'None', tone: 'ok' },
  { platform: 'OpenStack on Ceph', how: 'RBD export-diff, read from the Ceph cluster', fallback: 'Cinder snapshot and full read', used: 'Backup, DR', sites: 'production-openstack', resets: 'None', tone: 'ok' },
  { platform: 'VMware vSphere', how: 'Changed Block Tracking through VDDK', fallback: 'Full read with a CBT reset alert', used: 'DR, Migration', sites: 'Chennai vCenter, esxi-edge-07', resets: '1: CBT reset on SQL01 after a storage vMotion', tone: 'warn' },
  { platform: 'Microsoft Hyper-V', how: 'Resilient Change Tracking (RCT)', fallback: 'Full read', used: 'Backup, DR, Migration', sites: 'None connected', resets: '—', tone: 'tx' },
  { platform: 'Nutanix AHV', how: 'Changed Region Tracking through Prism v4', fallback: 'Full read when CRT is unavailable', used: 'Backup, DR, Migration', sites: 'None connected', resets: '—', tone: 'tx' },
  { platform: 'Agents (Windows, Linux, macOS)', how: 'Aegis changed-block filter driver', fallback: 'Full read after an unclean shutdown', used: 'Backup, DR, Migration', sites: `${AGENTS.filter(a => a.kind !== 'Kubernetes operator' && a.kind !== 'Database plug-in').length} agents`, resets: '2: unclean shutdowns on laptops', tone: 'ok' }
];
interface Throttle { id: string; scope: string; kind: 'Repository' | 'Workload' | 'Site link' | 'Customer'; busy: string; quiet: string; window: string; applies: string }
const THROTTLES: Throttle[] = [
  { id: 't1', scope: 'Chennai → Mumbai (MPLS, 1 Gbit/s)', kind: 'Site link', busy: '300 Mbit/s', quiet: '900 Mbit/s', window: 'Mon–Fri 09:00–19:00', applies: 'Copies, replication, migration' },
  { id: 't2', scope: 'mer-obj-immutable', kind: 'Repository', busy: '400 Mbit/s', quiet: 'No limit', window: 'Mon–Sat 08:00–20:00', applies: 'Backup and copies' },
  { id: 't3', scope: 'erp-db-01', kind: 'Workload', busy: '80 MB/s read', quiet: 'No limit', window: 'Every day 09:00–21:00', applies: 'Backup' },
  { id: 't4', scope: 'Sahyadri Hospitals (Pune site)', kind: 'Customer', busy: '50 Mbit/s', quiet: '200 Mbit/s', window: 'Every day 07:00–23:00', applies: 'Everything leaving the site' },
  { id: 't5', scope: 'Meridian laptops', kind: 'Workload', busy: '20 Mbit/s per device', quiet: '20 Mbit/s per device', window: 'Always', applies: 'Endpoint backup' }
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Busy hours per day for a window like "Mon–Fri 09:00–19:00". */
function busyAt(win: string, d: number, h: number) {
  if (win === 'Always') return true;
  const m = /(\w+)(?:–(\w+))? (\d+):\d+–(\d+):\d+/.exec(win.replace('Every day', 'Mon–Sun'));
  if (!m) return false;
  const a = DAYS.indexOf(m[1]);
  const b = m[2] ? DAYS.indexOf(m[2]) : a;
  return d >= a && d <= b && h >= +m[3] && h < +m[4];
}

interface Defaults { compression: string; inTransit: string; wan: boolean; checkpoint: string; resume: string; streams: string }

/** Settings › Data movement: the one layer that reads changed blocks and moves them, for all three products. */
export function DataMovementTab({ ctx }: { ctx: Ctx }) {
  const [thr, setThr] = useState(THROTTLES);
  const [sel, setSel] = useState('t1');
  const add = useClosable<boolean>();
  const cur = thr.find(t => t.id === sel) || thr[0];
  const [d, setD] = useState<Defaults>({ compression: 'zstd, level 3', inTransit: 'TLS 1.3 to repositories; SSH tunnel (ChaCha20-Poly1305) between sites', wan: true, checkpoint: '256 MB', resume: '24 h', streams: '4 per disk' });
  const edit = useClosable<boolean>();
  const cfg = ctx.can('admin', 'Changing data movement defaults');
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Bar tone="info" multiline>Backup writes changed blocks to a repository, replication to a replica, migration to a target. Below that line the work is the same, so one layer does it for every product: one change-tracking method per platform, one throttle per source and one set of defaults.</Bar>
      <Panel title="Change tracking by platform">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Change tracking"
            cols={[{ label: 'Platform', w: '190px' }, { label: 'Method', w: 'minmax(0,1fr)' }, { label: 'If it is lost', w: 'minmax(0,1fr)' }, { label: 'Used by', w: '140px' }, { label: 'Last 7 days', w: '180px' }]}
            rows={TRACKING.map(t => [
              <strong key="p" style={{ fontWeight: 600 }} data-tip={t.sites}>{t.platform}</strong>,
              <span key="h" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={t.how} data-tip-overflow="">{t.how}</span>,
              <span key="f" style={{ color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={t.fallback} data-tip-overflow="">{t.fallback}</span>,
              t.used,
              t.tone === 'tx' ? <span key="r" style={{ color: 'var(--tx-3)' }}>Not connected</span> : <Status key="r" icon={t.tone === 'ok' ? 'circle-check' : 'triangle-alert'} tone={t.tone} label={t.resets === 'None' ? 'No resets' : t.resets.split(':')[0]} tip={t.resets} />
            ])}
          />
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>A lost bitmap or a CBT reset never produces a silent gap: the next run reads the whole disk and the recovery point says why.</p>
        </div>
      </Panel>
      <Panel title="Defaults for every transfer" right={<Btn kind="outline" size="sm" icon="pencil" perm={cfg} onClick={() => edit.open(true)}>Edit…</Btn>}>
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Transfer defaults"
            cols={[{ label: 'Setting', w: '220px' }, { label: 'Value' }]}
            rows={[
              ['Compression', d.compression],
              ['Encryption in transit', d.inTransit],
              ['WAN optimisation', d.wan ? 'On for copies, replication and migration between sites: only blocks the destination lacks are sent' : 'Off'],
              ['Checkpoint', `Every ${d.checkpoint}; an interrupted transfer resumes from the last checkpoint`],
              ['Resume window', `${d.resume}; after that the transfer starts again`],
              ['Parallel streams', d.streams],
              ['Throttling', 'Per source in Settings › Source impact; per repository, workload, site link and customer below']
            ]}
          />
        </div>
      </Panel>
      <Panel title="Bandwidth schedules" right={<Btn kind="outline" size="sm" icon="plus" perm={cfg} onClick={() => add.open(true)}>Add a schedule…</Btn>}>
        <div style={{ padding: '4px 16px 12px', display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <MiniTable
            label="Bandwidth schedules"
            cols={[{ label: 'Applies to', w: 'minmax(0,1fr)' }, { label: 'Busy hours', w: '130px' }, { label: 'Other times', w: '130px' }, { label: 'Busy window', w: '160px' }]}
            rows={thr.map(t => [
              <button key="s" type="button" onClick={() => setSel(t.id)} style={{ textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: t.id === cur.id ? 700 : 600, color: t.id === cur.id ? 'var(--acc-tx)' : undefined }} data-tip={`${t.kind} · ${t.applies}`}>
                {t.scope}
              </button>,
              t.busy,
              t.quiet,
              t.window
            ])}
          />
          <div>
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: 8 }}>{cur.kind}: {cur.scope} · {cur.applies}</div>
            <div role="img" aria-label={`Busy window for ${cur.scope}: ${cur.window}`} style={{ display: 'grid', gridTemplateColumns: '32px repeat(24, minmax(0,1fr))', gap: 2, font: '11px var(--f-ui)', color: 'var(--tx-3)' }}>
              <span />
              {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ textAlign: 'center' }}>{h % 6 === 0 ? h : ''}</span>)}
              {DAYS.map((day, di) => [
                <span key={day}>{day}</span>,
                ...Array.from({ length: 24 }, (_, h) => <span key={`${day}${h}`} style={{ height: 14, background: busyAt(cur.window, di, h) ? 'var(--warn)' : 'var(--acc-soft)', opacity: busyAt(cur.window, di, h) ? 0.75 : 1 }} />)
              ])}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: 'var(--warn)', opacity: 0.75 }} />Busy: {cur.busy}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: 'var(--acc-soft)', border: '1px solid var(--ln-2)' }} />Other times: {cur.quiet}</span>
            </div>
          </div>
        </div>
        <p style={{ padding: '0 16px 12px', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>When two schedules apply, the lower limit wins. Times are IST. A restore is never throttled unless you ask for it in the restore.</p>
      </Panel>
      {add.value ? (
        <ThrottleDialog
          closing={add.closing}
          onClose={add.close}
          onSave={t => {
            setThr(x => [...x, t]);
            setSel(t.id);
            audit({ who: 'priya.raman', customer: 'h360', what: 'Added a bandwidth schedule', object: t.scope, when: ctx.now(), r: 'ok', after: [['Busy hours', t.busy], ['Other times', t.quiet], ['Window', t.window]] });
            ctx.toast(`Bandwidth schedule for ${t.scope} saved; running transfers adjust within a minute`, 'ok');
            add.close();
          }}
        />
      ) : null}
      {edit.value ? (
        <DefaultsDialog
          d={d}
          closing={edit.closing}
          onClose={edit.close}
          onSave={n => {
            setD(n);
            audit({ who: 'priya.raman', customer: 'h360', what: 'Changed data movement defaults', object: 'Every product', when: ctx.now(), r: 'ok', after: [['Compression', n.compression], ['WAN optimisation', n.wan ? 'On' : 'Off'], ['Checkpoint', n.checkpoint]] });
            ctx.toast('Defaults saved; transfers already running keep their settings', 'ok');
            edit.close();
          }}
        />
      ) : null}
    </div>
  );
}

function DefaultsDialog({ d, closing, onClose, onSave }: { d: Defaults; closing: boolean; onClose: () => void; onSave: (d: Defaults) => void }) {
  const [n, setN] = useState(d);
  return (
    <Dialog title="Transfer defaults" sub="Apply to new backup, replication and migration transfers in every product." closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={JSON.stringify(n) === JSON.stringify(d)} why="Nothing changed." onClick={() => onSave(n)}>Save</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="dm-c" label="Compression"><SelectInput id="dm-c" value={n.compression} onChange={v => setN(x => ({ ...x, compression: v }))} options={['zstd, level 1', 'zstd, level 3', 'zstd, level 9', 'lz4', 'Off']} /></Field>
        <Field id="dm-s" label="Parallel streams"><SelectInput id="dm-s" value={n.streams} onChange={v => setN(x => ({ ...x, streams: v }))} options={['2 per disk', '4 per disk', '8 per disk']} /></Field>
        <Field id="dm-k" label="Checkpoint every"><SelectInput id="dm-k" value={n.checkpoint} onChange={v => setN(x => ({ ...x, checkpoint: v }))} options={['64 MB', '256 MB', '1 GB']} /></Field>
        <Field id="dm-r" label="Resume window"><TextInput id="dm-r" value={n.resume} onChange={v => setN(x => ({ ...x, resume: v }))} /></Field>
      </div>
      <Toggle on={n.wan} onChange={v => setN(x => ({ ...x, wan: v }))} label="WAN optimisation">WAN optimisation between sites</Toggle>
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Encryption in transit cannot be turned off.</p>
    </Dialog>
  );
}

function ThrottleDialog({ closing, onClose, onSave }: { closing: boolean; onClose: () => void; onSave: (t: Throttle) => void }) {
  const [kind, setKind] = useState<Throttle['kind']>('Repository');
  const [scope, setScope] = useState('obj-check');
  const [busy, setBusy] = useState('200 Mbit/s');
  const [quiet, setQuiet] = useState('No limit');
  const [days, setDays] = useState('Mon–Fri');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('19:00');
  const scopes: Record<string, string[]> = { Repository: ['obj-check', 'mer-obj-immutable', 'kav-repo-01', 'sah-s3-mumbai'], Workload: ['erp-db-01', 'file-srv-03', 'SQL01', 'Meridian laptops'], 'Site link': ['Chennai → Mumbai (MPLS, 1 Gbit/s)', 'Chennai → Hyderabad (internet, 500 Mbit/s)'], Customer: ['Sahyadri Hospitals (Pune site)', 'Kaveri Logistics', 'Atlas Freight GmbH'] };
  return (
    <Dialog title="Add a bandwidth schedule" sub="Limit how fast Aegis sends data during busy hours." closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={from >= to} why="The busy window must end after it starts." onClick={() => onSave({ id: 't' + Date.now(), scope, kind, busy, quiet, window: `${days} ${from}–${to}`, applies: kind === 'Workload' ? 'Backup' : kind === 'Repository' ? 'Backup and copies' : 'Copies, replication, migration' })}>Save</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="th-k" label="Limit"><SelectInput id="th-k" value={kind} onChange={v => { setKind(v as Throttle['kind']); setScope(scopes[v][0]); }} options={['Repository', 'Workload', 'Site link', 'Customer']} /></Field>
        <Field id="th-s" label={kind}><SelectInput id="th-s" value={scope} onChange={setScope} options={scopes[kind]} /></Field>
        <Field id="th-b" label="During busy hours"><SelectInput id="th-b" value={busy} onChange={setBusy} options={['20 Mbit/s', '50 Mbit/s', '100 Mbit/s', '200 Mbit/s', '400 Mbit/s', '80 MB/s read']} /></Field>
        <Field id="th-q" label="Other times"><SelectInput id="th-q" value={quiet} onChange={setQuiet} options={['No limit', '200 Mbit/s', '500 Mbit/s', '900 Mbit/s']} /></Field>
        <Field id="th-d" label="Busy days"><SelectInput id="th-d" value={days} onChange={setDays} options={['Mon–Fri', 'Mon–Sat', 'Every day']} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field id="th-f" label="From"><SelectInput id="th-f" value={from} onChange={setFrom} options={['07:00', '08:00', '09:00', '10:00']} /></Field>
          <Field id="th-t" label="To"><SelectInput id="th-t" value={to} onChange={setTo} options={['18:00', '19:00', '20:00', '21:00', '23:00']} /></Field>
        </div>
      </div>
    </Dialog>
  );
}
