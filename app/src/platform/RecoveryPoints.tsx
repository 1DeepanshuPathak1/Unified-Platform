import { useState } from 'react';
import { CopyCurl } from '../ui/CopyCurl';
import { Icon } from '../lib/Icon';
import { Btn, Seg } from '../ui/controls';
import { Bar, MiniTable, Spacer, Toolbar, plural } from '../ui/layout';
import type { Ctx } from '../ui/ctx';
import type { Workload } from '../data/platform';
import { toMs } from '../products/resilience/data';

type Kind = 'Backup' | 'Replica' | 'Offsite copy' | 'Cloud copy';
interface Point { at: number; kind: Kind; where: string; note: string; lock?: string; verified?: string }
const NOW = toMs('21 Oct 2026, 16:05 IST');
const H = 36e5;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (ms: number) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ageMs = (a: string) => { const m = a.match(/([\d.]+)\s*(s|min|h)/); return m ? +m[1] * (m[2] === 's' ? 1e3 : m[2] === 'min' ? 6e4 : H) : 0; };

/** Every recovery point of one workload, wherever it lives: backups, DR replicas and the copies made from them. */
export function pointsOf(w: Workload): Point[] {
  const out: Point[] = [];
  if (w.backup.last && w.backup.points) {
    const last = toMs(w.backup.last);
    const p = w.backup.policy || '';
    const step = /hourly/i.test(p) ? (/4-hourly/i.test(p) ? 4 * H : H) : 24 * H;
    const immutable = /immutable|hourly|Database|clinical/i.test(p);
    const days = /hourly/i.test(p) ? 30 : 14;
    const lock = (t: number) => (immutable ? `Locked until ${fmt(t + days * 24 * H).split(',')[0]}` : undefined);
    for (let i = 0; i < 4; i++) out.push({ at: last - i * step, kind: 'Backup', where: 'obj-check', note: i === 0 ? 'Newest' : step === H ? 'Hourly' : step === 4 * H ? 'Every 4 hours' : 'Daily', lock: lock(last - i * step), verified: i === (step === H ? 2 : 1) ? `Restore test passed ${fmt(last - i * step + 40 * 6e4).split(', ')[1]}` : undefined });
    const d = new Date(last);
    let daily = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 2, 0).getTime();
    if (daily > last) daily -= 24 * H;
    out.push({ at: daily, kind: 'Offsite copy', where: 'copy-check-repo (Mumbai DC2)', note: 'Daily', lock: immutable ? `Locked until ${fmt(daily + 28 * 24 * H).split(',')[0]}` : undefined });
    out.push({ at: toMs('18 Oct 2026, 02:00 IST'), kind: 'Backup', where: 'obj-check', note: 'Weekly', lock: lock(toMs('18 Oct 2026, 02:00 IST')), verified: 'Booted in the sandbox 18 Oct, 03:10' });
    out.push({ at: toMs('01 Oct 2026, 02:00 IST'), kind: 'Cloud copy', where: 'S3 ap-south-1', note: 'Monthly', lock: 'Object Lock until 01 Oct 2033' });
    out.push({ at: toMs('01 Sep 2026, 02:00 IST'), kind: 'Cloud copy', where: 'S3 ap-south-1', note: 'Monthly', lock: 'Object Lock until 01 Sep 2033' });
  }
  if (w.dr.age && (w.dr.s === 'protected' || w.dr.s === 'behind')) {
    const newest = NOW - ageMs(w.dr.age);
    const t = ageMs(w.dr.target || '15 min') || 15 * 6e4;
    out.push({ at: newest, kind: 'Replica', where: drSite(w), note: 'Newest' });
    out.push({ at: newest - t, kind: 'Replica', where: drSite(w), note: 'Crash-consistent' });
    out.push({ at: Math.floor(newest / H) * H, kind: 'Replica', where: drSite(w), note: 'App-consistent' });
    out.push({ at: Math.floor(newest / H) * H - 4 * H, kind: 'Replica', where: drSite(w), note: 'App-consistent', verified: 'Started in the last drill' });
  }
  return out.sort((a, b) => b.at - a.at);
}
const drSite = (w: Workload) => (w.customer === 'mer' && /Tier-0|Tier-1/.test(w.dr.plan || '') && w.site === 'production-openstack' ? 'region-2-os' : w.site === 'Chennai-proxmox-prod' ? 'production-openstack' : w.site === 'Chennai vCenter' ? 'Chennai-proxmox-prod' : 'production-openstack');

const KIND_ICON: Record<Kind, string> = { Backup: 'archive', Replica: 'copy', 'Offsite copy': 'hard-drive', 'Cloud copy': 'cloud' };

/** Workload › Recovery points: one list, newest first, with where each point is and what it can do. */
export function RecoveryPointsTab({ ctx, w, onRestore }: { ctx: Ctx; w: Workload; onRestore: () => void }) {
  const [f, setF] = useState<'All' | 'Backups' | 'Replicas' | 'Copies'>('All');
  const all = pointsOf(w);
  const rows = all.filter(p => f === 'All' || (f === 'Backups' ? p.kind === 'Backup' : f === 'Replicas' ? p.kind === 'Replica' : p.kind.endsWith('copy')));
  const unread = w.dr.s === 'unreach';
  const locked = all.filter(p => p.lock).length;
  const restore = ctx.can('restore', 'Restoring');
  const op = ctx.can('operate', 'Starting a server at the recovery site');
  if (!all.length && !unread) {
    return <p style={{ color: 'var(--tx-2)' }}>{w.name} has no recovery points. {w.backup.note || w.dr.note || 'Add it to a backup policy or a protection plan.'}</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {unread ? <Bar tone="warn" multiline>Replica points at the recovery site could not be read: {drSite(w)} did not answer. They are not shown as missing.</Bar> : null}
      <Toolbar style={{ padding: 0 }}>
        <Seg label="Show" value={f} onChange={setF} options={(['All', 'Backups', 'Replicas', 'Copies'] as const).map(v => ({ v, label: v }))} />
        <Spacer />
        <CopyCurl ctx={ctx} size="sm" path={`/workloads/${w.id}/recovery-points`} query={{ kind: f === 'All' ? undefined : f.toLowerCase() }} />
        <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
          {plural(all.length, 'point')} shown of {(w.backup.points || 0) + (w.dr.age ? 96 : 0)} · {locked} locked
        </span>
      </Toolbar>
      <MiniTable
        label="Recovery points"
        cols={[{ label: 'Point in time', w: '108px' }, { label: 'Kind', w: '118px' }, { label: 'Where' }, { label: '', w: '44px' }, { label: '', w: '88px', r: true }]}
        rows={rows.map(p => [
          <span key="t" data-tip={p.note}>{fmt(p.at)}</span>,
          <span key="k" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name={KIND_ICON[p.kind]} style={{ color: 'var(--tx-3)' }} />{p.kind}</span>,
          <span key="w" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-tip={`${p.where} · ${p.note}`}>{p.where}<span style={{ color: 'var(--tx-3)' }}> · {p.note}</span></span>,
          <span key="i" style={{ display: 'inline-flex', gap: 6, color: 'var(--tx-2)' }}>
            {p.lock ? <span data-tip={p.lock} aria-label={p.lock} style={{ display: 'inline-flex' }}><Icon name="lock" /></span> : null}
            {p.verified ? <span data-tip={p.verified} aria-label={p.verified} style={{ display: 'inline-flex', color: 'var(--ok)' }}><Icon name="badge-check" /></span> : null}
          </span>,
          p.kind === 'Replica' ? (
            <Btn key="b" kind="ghost" size="sm" perm={op} onClick={() => { ctx.go('dr/servers', w.name); ctx.toast(`Choose Test boot or Fail over for ${w.name}; the point at ${fmt(p.at)} is selected`, 'info'); }}>Boot…</Btn>
          ) : (
            <Btn key="b" kind="ghost" size="sm" perm={restore} onClick={onRestore}>Restore…</Btn>
          )
        ])}
        empty="No points of this kind."
      />
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="lock" /> Cannot be changed or deleted until the date shown</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="badge-check" /> Proven by a restore test, sandbox boot or drill</span>
      </p>
    </div>
  );
}
