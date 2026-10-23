import { useState } from 'react';
import { Btn, Field, RadioCard, SelectInput, TextInput } from '../ui/controls';
import { Bar, MiniTable, Panel, Status } from '../ui/layout';
import { Dialog, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { WORKLOADS } from '../data/platform';
import { nextApprovalId } from '../products/resilience/Failover';
import { audit, update } from './store';

type What = 'files' | 'server' | 'database';
type Where = 'copy' | 'replace';
type Req = { id: string; what: string; from: string; point: string; where: string; state: 'approval' | 'running' | 'checked' | 'done' | 'declined'; when: string; note?: string };

/** Points a customer can pick, in plain words, with whether a test restore proved them. */
const POINTS: { v: string; label: string; checked: boolean }[] = [
  { v: '21 Oct, 02:00', label: 'Last night, 02:00', checked: true },
  { v: '20 Oct, 02:00', label: 'Yesterday, 02:00', checked: false },
  { v: '19 Oct, 02:00', label: 'Monday, 02:00', checked: false },
  { v: '18 Oct, 02:00', label: 'Last Sunday, 02:00 (weekly)', checked: true },
  { v: '30 Sep, 02:00', label: '30 September (monthly)', checked: true }
];
const STATE: Record<Req['state'], { i: string; c: string; l: string }> = {
  approval: { i: 'clock', c: 'warn', l: 'Waiting for your provider to approve' },
  running: { i: 'loader-circle', c: 'run', l: 'Restoring now' },
  checked: { i: 'circle-check', c: 'ok', l: 'Back, and checked: it opens' },
  done: { i: 'circle-check', c: 'ok', l: 'Back' },
  declined: { i: 'ban', c: 'err', l: 'Declined by your provider' }
};
const INITIAL: Req[] = [
  { id: 'SR-1', what: 'D:\\Tally\\Data\\Company 10042\\', from: 'kav-tally-01', point: 'Monday 19 Oct, 02:00', where: 'A copy next to the original', state: 'checked', when: '20 Oct, 11:20', note: 'Restored to D:\\Tally\\Data\\Company 10042 (restored 20 Oct)\\ and opened in Tally to check it' },
  { id: 'SR-2', what: 'Whole server', from: 'kav-tally-01', point: 'Sunday 18 Oct, 02:00 (weekly)', where: 'In place of the original', state: 'declined', when: '19 Oct, 17:40', note: 'Declined by meera.iyer: “The whole server would lose this week’s entries; we restored the two folders you needed instead.”' }
];

/** Self-service restore: customers get files, servers and databases back themselves; replacing anything needs their provider’s approval. */
export function SelfRestorePanel({ ctx, customer }: { ctx: Ctx; customer: string }) {
  const [reqs, setReqs] = useState<Req[]>(customer === 'kav' ? INITIAL : []);
  const dlg = useClosable<boolean>();
  return (
    <>
      <Panel title="Get something back" right={<Btn kind="primary" size="sm" icon="rotate-ccw" onClick={() => dlg.open(true)}>Restore…</Btn>}>
        <div style={{ padding: '0 16px 4px' }}>
          <MiniTable
            label="Your restores"
            empty="Nothing restored yet. Files and copies come back on their own; replacing a server needs your provider to approve."
            cols={[{ label: 'What' }, { label: 'From', w: '190px' }, { label: 'State', w: '260px' }]}
            rows={reqs.map(r => [
              <span key="w" style={{ whiteSpace: 'normal', padding: '6px 0' }}><strong style={{ fontWeight: 600 }}>{r.what}</strong><br /><span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{r.where} · asked {r.when}</span></span>,
              <span key="f" style={{ whiteSpace: 'normal' }}>{r.from}<br /><span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{r.point}</span></span>,
              <Status key="s" icon={STATE[r.state].i} tone={STATE[r.state].c} spin={r.state === 'running'} label={STATE[r.state].l} tip={r.note} />
            ])}
          />
        </div>
      </Panel>
      {dlg.value ? (
        <SelfRestoreDialog
          ctx={ctx}
          customer={customer}
          closing={dlg.closing}
          onClose={dlg.close}
          onDone={r => {
            setReqs(x => [r, ...x]);
            dlg.close();
            if (r.state === 'running') window.setTimeout(() => setReqs(x => x.map(y => (y.id === r.id ? { ...y, state: 'checked', note: 'Restored and opened to check it' } : y))), 4000);
          }}
        />
      ) : null}
    </>
  );
}

function SelfRestoreDialog({ ctx, customer, closing, onClose, onDone }: { ctx: Ctx; customer: string; closing: boolean; onClose: () => void; onDone: (r: Req) => void }) {
  const ws = WORKLOADS.filter(w => w.customer === customer && w.backup.s === 'protected');
  const [what, setWhat] = useState<What>('files');
  const [from, setFrom] = useState(ws[0]?.id || '');
  const [path, setPath] = useState('');
  const [point, setPoint] = useState(POINTS[0].v);
  const [where, setWhere] = useState<Where>('copy');
  const [why, setWhy] = useState('');
  const w = ws.find(x => x.id === from);
  const isDb = w?.type === 'Database';
  const kind: What = isDb ? 'database' : what;
  const pt = POINTS.find(p => p.v === point)!;
  const needsApproval = where === 'replace' || kind === 'server';
  const err = !w ? 'You have nothing protected to restore from.' : kind === 'files' && !path.trim() ? 'Say which file or folder you need.' : needsApproval && why.trim().length < 4 ? 'Tell your provider why, so they can approve it quickly.' : null;
  const go = () => {
    const id = 'SR-' + Date.now();
    const label = kind === 'files' ? path.trim() : kind === 'database' ? `Database ${w!.name}` : 'Whole server';
    if (needsApproval) {
      update(s => {
        s.approvals.unshift({ id: nextApprovalId(), kind: 'Restore exception', object: `${label} from ${w!.name}`, customer, requester: ctx.actingAs?.owner || 'Customer user', approvers: 'Host360 restore operator', needed: 1, given: [], requested: ctx.now(), expires: '24 Oct 2026, 16:05 IST', state: 'pending', reason: why.trim(), evidence: [`Point ${point}`, where === 'replace' ? 'Replaces the original' : 'As a copy'], rule: 'Customer self-service restores that replace a server or the original need the provider' });
      });
    }
    audit({ who: ctx.actingAs?.owner || 'customer', customer, what: needsApproval ? 'Asked for a restore (needs approval)' : 'Restored by self-service', object: `${label} from ${w!.name}`, when: ctx.now(), r: 'ok' });
    ctx.toast(needsApproval ? 'Sent to your provider to approve. You will get an email when it starts.' : 'Restoring now. It will be next to the original.', 'ok');
    onDone({ id, what: label, from: w!.name, point: pt.label, where: where === 'copy' ? 'A copy next to the original' : 'In place of the original', state: needsApproval ? 'approval' : 'running', when: ctx.now().replace(' 2026', '').replace(' IST', ''), note: needsApproval ? 'Usually approved within an hour during business hours' : undefined });
  };
  return (
    <Dialog
      size="lg"
      title="Get something back"
      sub="Choose what you need and from when. Copies come back straight away; anything that replaces the original goes to your provider first."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={needsApproval ? 'send' : 'rotate-ccw'} disabled={!!err} why={err || undefined} onClick={go}>{needsApproval ? 'Ask my provider' : 'Restore'}</Btn>
        </>
      }
    >
      {!isDb ? (
        <div role="radiogroup" aria-label="What do you need back" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <RadioCard on={what === 'files'} onClick={() => setWhat('files')} icon="folder" title="Files or folders" note="Comes back next to the original. Nothing is overwritten." />
          <RadioCard on={what === 'server'} onClick={() => { setWhat('server'); setWhere('replace'); }} icon="server" title="The whole server" note="Your provider approves first, because everything since that point is lost." />
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="ss-f" label="From">
          <SelectInput id="ss-f" value={from} onChange={setFrom} options={ws.map(x => ({ v: x.id, label: `${x.name} · ${x.type === 'Database' ? 'database' : x.os}` }))} />
        </Field>
        <Field id="ss-p" label="As it was" hint={pt.checked ? 'Checked: a test restore of this point started and its files opened.' : 'Not test-restored yet; it is complete, but nobody has opened it.'}>
          <SelectInput id="ss-p" value={point} onChange={setPoint} options={POINTS.map(p => ({ v: p.v, label: `${p.label}${p.checked ? ' · checked' : ''}` }))} />
        </Field>
        {kind === 'files' ? (
          <Field id="ss-path" label="File or folder" span={2} hint="Type part of a name; the search covers every file in that backup.">
            <TextInput id="ss-path" value={path} onChange={setPath} placeholder="D:\Tally\Data\Company 10042\" />
          </Field>
        ) : null}
      </div>
      {kind !== 'files' ? (
        <div role="radiogroup" aria-label="Where it goes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <RadioCard on={where === 'copy'} onClick={() => setWhere('copy')} icon="copy" title={kind === 'database' ? 'As a new database' : 'As a new server'} note={kind === 'database' ? 'Named with the date, next to the original.' : 'Started next to the original with a new name and no network.'} />
          <RadioCard on={where === 'replace'} onClick={() => setWhere('replace')} icon="rotate-ccw" title="In place of the original" note="Your provider approves first." />
        </div>
      ) : null}
      {needsApproval ? (
        <>
          <Bar tone="info" multiline>Anything written to {w?.name} after {pt.label.toLowerCase()} will be lost. Host360 checks the request and usually approves within an hour in business hours.</Bar>
          <Field id="ss-why" label="Why do you need it?">
            <TextInput id="ss-why" value={why} onChange={setWhy} placeholder="Tally company file corrupted after a power cut this morning" />
          </Field>
        </>
      ) : null}
    </Dialog>
  );
}
