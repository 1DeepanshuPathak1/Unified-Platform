import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { Btn, CheckBox, Field, RadioCard, SelectInput, TextInput } from '../../ui/controls';
import { Bar, plural } from '../../ui/layout';
import { Dialog, StepUp } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { WORKLOADS } from '../../data/platform';
import { audit, store, update } from '../../platform/store';
import { nextApprovalId } from '../resilience/Failover';
import { INVENTORY, WAVES } from './data';

/** The legacy Mobility › Servers record this dialog acts on. */
export type MigServer = { id: string; name: string; src: string; dest?: string; net?: string; test?: string; os: string; disks: number; size: number; passes?: number; last?: string; stage: string; tested?: boolean; win?: boolean };

type Go = { label: string; obj: string; result: string; state: 'pass' | 'warn' | 'block' };

const APPROVERS: Record<string, { name: string; email: string }[]> = {
  h360: [{ name: 'Arun Kumar', email: 'arun.kumar@host360.ai' }, { name: 'Meera Iyer', email: 'meera.iyer@host360.ai' }],
  mer: [{ name: 'Suresh Iyer', email: 's.iyer@meridianbank.in' }, { name: 'Anitha Krishnan', email: 'anitha.k@meridianbank.in' }]
};

/**
 * Cutover with a go/no-go decision, all in this dialog: the checks, the application owner's
 * sign-off, the approval the policy asks for (two approvers for Mission Critical), and step-up MFA.
 */
export function CutoverDialog({ ctx, srv, closing, onClose, onGo }: { ctx: Ctx; srv: MigServer; closing: boolean; onClose: () => void; onGo: (note: string) => void }) {
  const inv = INVENTORY.find(v => v.name === srv.name);
  const wl = WORKLOADS.find(w => w.name === srv.name);
  const customer = inv?.customer || wl?.customer || 'h360';
  const wave = WAVES.find(w => w.name === inv?.wave && w.customer === customer);
  const mc = wl?.tier === 'Mission Critical';
  const needed = mc ? 2 : 1;
  const pending = store.approvals.find(a => a.kind === 'Cutover' && a.object.startsWith(srv.name) && a.state === 'pending');
  const given = pending ? pending.given.length : 0;
  const people = (APPROVERS[customer] || APPROVERS.h360).filter(p => !pending?.given.some(g => g.who === p.email));
  const [decision, setDecision] = useState<'go' | 'nogo'>('go');
  const [why, setWhy] = useState('');
  const [owner, setOwner] = useState(false);
  const [ack, setAck] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [how, setHow] = useState<'present' | 'request'>('present');
  const [approver, setApprover] = useState(people[0]?.email || '');
  const [signed, setSigned] = useState<string[]>([]);
  const tested = srv.tested || srv.stage === 'ready';
  const checks: Go[] = [
    { label: 'Last sync', obj: srv.name, result: srv.passes ? `Pass ${srv.passes} finished ${srv.last || 'today'}; the final sync copies what changed since` : 'No pass has finished', state: srv.passes ? 'pass' : 'block' },
    { label: 'Verification', obj: `${plural(srv.disks, 'disk')}`, result: srv.passes ? `Byte-for-byte after pass ${srv.passes}: checksums match` : 'Runs after the first pass', state: srv.passes ? 'pass' : 'block' },
    tested ? { label: 'Test boot', obj: srv.test || 'isolated network', result: 'Passed: the console reached the login screen and the app answered', state: 'pass' } : { label: 'Test boot', obj: srv.test || 'isolated network', result: 'Not tested yet. The Standard migration policy requires a passed test boot before cutover.', state: 'block' },
    srv.dest ? { label: 'Mapping', obj: `${srv.src} → ${srv.dest}`, result: `Network ${srv.net}; drivers ${srv.win ? 'injected (VirtIO storage, network, balloon)' : 'not needed'}`, state: 'pass' } : { label: 'Mapping', obj: srv.name, result: 'No mapping', state: 'block' },
    { label: 'Capacity at the destination', obj: srv.dest || '—', result: 'Room for the server and its disks', state: 'pass' },
    wave?.window ? { label: 'Cutover window', obj: wave.name, result: `Outside the window (${wave.window.replace(' IST', '')}). Cutting over now uses unplanned downtime.`, state: 'warn' } : { label: 'Cutover window', obj: inv?.wave || 'No wave', result: 'The wave has no window; downtime is taken from its budget.', state: 'warn' },
    { label: 'Roll back possible', obj: srv.src, result: 'The source stays powered off with its last snapshot until you commit', state: 'pass' },
    ...(inv?.checks.filter(c => c.level === 'warn').map(c => ({ label: `Inventory: ${c.k.toLowerCase()}`, obj: srv.name, result: c.text, state: 'warn' as const })) || [])
  ];
  const blocks = checks.filter(c => c.state === 'block');
  const warns = checks.filter(c => c.state === 'warn');
  const approvalsOk = how === 'request' || given + signed.length >= needed;
  const ready = decision === 'nogo' ? why.trim().length > 3 : !blocks.length && (!warns.length || ack) && owner && mfa && approvalsOk;
  const reason =
    decision === 'nogo'
      ? 'Give the reason for no-go.'
      : blocks.length
        ? 'Fix what blocks the cutover first.'
        : warns.length && !ack
          ? 'Confirm you have read the warnings.'
          : !owner
            ? 'The application owner must sign off.'
            : !approvalsOk
              ? `${needed - given - signed.length} more ${needed - given - signed.length === 1 ? 'approval is' : 'approvals are'} needed.`
              : 'Confirm it is you first.';
  const submit = () => {
    if (decision === 'nogo') {
      audit({ who: 'priya.raman', customer, what: 'Recorded a no-go for a cutover', object: srv.name, when: ctx.now(), r: 'ok', note: why.trim() });
      ctx.toast(`No-go recorded for ${srv.name}. The cutover is postponed.`, 'info');
      onClose();
      return;
    }
    if (how === 'request') {
      const id = nextApprovalId();
      update(s => {
        s.approvals.unshift({ id, kind: 'Cutover', object: `${srv.name}${wave ? ` · ${wave.name.split(' · ')[0]}` : ''}`, customer, requester: 'priya.raman', approvers: `Migration Approver (${needed} of: ${(APPROVERS[customer] || APPROVERS.h360).map(a => a.name).join(', ')})`, needed, given: [], requested: ctx.now(), expires: wave?.window ? wave.window.split(' to ')[0].replace('Sat ', '') + ' IST' : '22 Oct 2026, 16:05 IST', state: 'pending', reason: `Cut over ${srv.name} to ${srv.dest}.`, evidence: [`Go/no-go: ${checks.filter(c => c.state === 'pass').length} passed, ${plural(warns.length, 'warning')}`, 'Application owner sign-off'], rule: mc ? 'Cutovers of Mission Critical workloads need two approvers' : 'Cutovers need a Migration Approver' });
      });
      audit({ who: 'priya.raman', customer, what: 'Requested cutover approval', object: srv.name, when: ctx.now(), r: 'ok' });
      ctx.toast(`Cutover approval requested for ${srv.name}`, 'info');
      onClose();
      return;
    }
    const names = [...(pending?.given.map(g => g.who) || []), ...signed];
    if (pending)
      update(s => {
        const a = s.approvals.find(x => x.id === pending.id)!;
        signed.forEach(e => a.given.push({ who: e, when: ctx.now(), note: 'Confirmed in person with their MFA code' }));
        a.state = 'used';
      });
    audit({ who: 'priya.raman', customer, what: 'Gave go for a cutover', object: srv.name, when: ctx.now(), r: 'ok', note: `Approved by ${names.join(', ')}; owner signed off` });
    onGo(`Go recorded. Approved by ${names.join(' and ')}.`);
    onClose();
  };
  return (
    <Dialog
      alert
      size="lg"
      title={`Cut over ${srv.name}`}
      sub={`${srv.src} → ${srv.dest || 'no destination'} · ${mc ? 'Mission Critical: two approvers' : 'one Migration Approver'}`}
      closing={closing}
      onClose={onClose}
      footNote={decision === 'go' && how === 'present' ? 'Powers the source off; you can still roll back until you commit.' : undefined}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind={decision === 'nogo' ? 'outline' : how === 'request' ? 'primary' : 'dangerSolid'} icon={decision === 'nogo' ? 'thumbs-down' : how === 'request' ? 'send' : 'power'} disabled={!ready} why={reason} onClick={submit}>
            {decision === 'nogo' ? 'Record no-go' : how === 'request' ? 'Request approval' : 'Cut over now'}
          </Btn>
        </>
      }
    >
      <section>
        <h3 style={{ font: '600 15px/22px var(--f-body)', marginBottom: 8 }}>Go/no-go checks</h3>
        <ul style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)' }}>
          {checks.map((c, i) => (
            <li key={i} style={{ display: 'grid', gridTemplateColumns: '16px 190px minmax(0,1fr)', gap: 10, padding: '8px 12px', borderBottom: i < checks.length - 1 ? '1px solid var(--ln)' : 'none' }}>
              <Icon name={c.state === 'pass' ? 'circle-check' : c.state === 'warn' ? 'triangle-alert' : 'circle-x'} style={{ color: `var(--${c.state === 'pass' ? 'ok' : c.state === 'warn' ? 'warn' : 'err'})`, marginTop: 1 }} />
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <span style={{ minWidth: 0, color: c.state === 'pass' ? 'var(--tx-2)' : 'var(--tx)' }}>{c.result}</span>
            </li>
          ))}
        </ul>
      </section>
      <div role="radiogroup" aria-label="Decision" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={decision === 'go'} onClick={() => setDecision('go')} icon="thumbs-up" title="Go" note="Cut over now with the approvals below." disabled={!!blocks.length} why="A check blocks the cutover." />
        <RadioCard on={decision === 'nogo'} onClick={() => setDecision('nogo')} icon="thumbs-down" title="No-go" note="Postpone. The decision and reason are recorded." />
      </div>
      {blocks.length ? <Bar tone="err" multiline>{plural(blocks.length, 'check')} {blocks.length === 1 ? 'blocks' : 'block'} the cutover: {blocks.map(b => b.label.toLowerCase()).join(', ')}. Record a no-go, or fix it and come back.</Bar> : null}
      {decision === 'nogo' ? (
        <Field id="co-why" label="Reason">
          <TextInput id="co-why" value={why} onChange={setWhy} placeholder="Application team not available on Saturday" />
        </Field>
      ) : !blocks.length ? (
        <>
          {warns.length ? (
            <CheckBox on={ack} onChange={setAck}>
              I have read the {plural(warns.length, 'warning')} and want to go ahead
            </CheckBox>
          ) : null}
          <CheckBox on={owner} onChange={setOwner}>
            The application owner{wl ? ` (${wl.owner})` : ''} has confirmed users can be cut off now
          </CheckBox>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ font: '600 15px/22px var(--f-body)' }}>Approval</h3>
            {pending ? (
              <Bar tone="info" icon="user-check" multiline>
                {pending.id}: {given} of {pending.needed} approvals given ({pending.given.map(g => g.who).join(', ')}). {pending.needed - given > 0 ? `${pending.needed - given} more needed.` : ''}
              </Bar>
            ) : null}
            <div role="radiogroup" aria-label="Approval" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <RadioCard on={how === 'present'} onClick={() => setHow('present')} icon="user-check" title="Approvers are with me" note="Each confirms with their own MFA code; recorded on the cutover." />
              <RadioCard on={how === 'request'} onClick={() => setHow('request')} icon="send" title="Request approval" note="Waits in the approvers' Inbox; cut over after." disabled={!!pending} why={`${pending?.id} is already open.`} />
            </div>
            {how === 'present' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {signed.map(e => (
                  <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, padding: '0 12px', border: '1px solid var(--ln)', background: 'var(--ok-s)' }}>
                    <Icon name="user-check" style={{ color: 'var(--ok)' }} />
                    Approved by {e} at {ctx.hms()} IST
                  </div>
                ))}
                {given + signed.length < needed ? (
                  <>
                    <Field id="co-appr" label={`Approver ${given + signed.length + 1} of ${needed}`}>
                      <SelectInput id="co-appr" value={approver} onChange={setApprover} options={people.filter(p => !signed.includes(p.email)).map(p => ({ v: p.email, label: `${p.name} · ${p.email}` }))} />
                    </Field>
                    <StepUp key={approver + signed.length} verified={false} who={approver} onVerified={() => { setSigned(x => [...x, approver]); setApprover(people.find(p => p.email !== approver && !signed.includes(p.email))?.email || ''); }} />
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
          {how === 'present' ? <StepUp verified={mfa} onVerified={() => setMfa(true)} /> : null}
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>
            {[
              ['power', `${srv.name} on ${srv.src} is powered off.`],
              ['refresh-cw', 'The final changes are copied and verified. About 2 min.'],
              ['play', `${srv.name} starts at ${srv.dest} on ${srv.net}.`],
              ['undo-2', 'Until you commit, you can roll back: the copy is deleted and the source starts again.']
            ].map(([i, t]) => (
              <li key={t} style={{ display: 'flex', gap: 8 }}>
                <Icon name={i} style={{ marginTop: 1 }} />
                {t}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Dialog>
  );
}
