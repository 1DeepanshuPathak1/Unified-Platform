import { useState } from 'react';
import { Btn, Field, SelectInput, TextInput, Toggle } from '../../ui/controls';
import { Bar, Facts, MiniTable, Panel, Status, Tiles } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope } from '../../platform/common';
import { audit } from '../../platform/store';
import type { SourceVm, Wave } from './data';

interface Project { customer: string; name: string; owner: string; sponsor: string; start: string; end: string; budget: number; spent: number; milestones: [string, string, 'done' | 'next' | 'later' | 'late'][]; docs: [string, string, string][]; accept: [string, string, 'Signed' | 'Sent' | 'Not yet'][]; decom: [string, string, string, string, 'Waiting' | 'Deleted' | 'Kept'][] }
const PROJECTS: Project[] = [
  {
    customer: 'mer', name: 'Meridian VMware exit', owner: 'Suresh Iyer (Meridian) · Priya Raman (Host360)', sponsor: 'Anitha Krishnan, CIO', start: '01 Sep 2026', end: '14 Dec 2026', budget: 4200000, spent: 1680000,
    milestones: [['Assessment signed off', '18 Sep', 'done'], ['Wave 1 · Branch services', '04 Oct', 'done'], ['Wave 2 · Core banking reporting', '25 Oct', 'next'], ['Wave 3 · Treasury (physical, P2V)', '22 Nov', 'later'], ['VMware licences returned', '14 Dec', 'later']],
    docs: [['Discovery questionnaire', 'Completed by Meridian IT, 05 Sep', 'questionnaire-meridian.pdf'], ['Statement of work', 'Signed 28 Aug; fixed price ₹42,00,000; 3 waves', 'sow-meridian-mig-2026.pdf'], ['Assessment report', 'CIO view, 18 Sep', 'assessment-meridian-cio.pdf']],
    accept: [['Wave 1 · Branch services', '5 servers, validation passed, rollback window closed 25 Oct', 'Sent'], ['Wave 2 · Core banking reporting', 'After cutover on 25 Oct', 'Not yet']],
    decom: [['mer-br-app-01', 'Wave 1', 'Powered off 04 Oct', 'Delete after 25 Oct (rollback window)', 'Waiting'], ['mer-br-app-02', 'Wave 1', 'Powered off 04 Oct', 'Delete after 25 Oct', 'Waiting'], ['mer-br-db', 'Wave 1', 'Powered off 04 Oct', 'Keep 90 days for audit (RBI)', 'Kept']]
  },
  {
    customer: 'h360', name: 'Host360 internal VMware exit', owner: 'Arun Kumar', sponsor: 'Head of IT, Host360', start: '15 Aug 2026', end: '30 Nov 2026', budget: 0, spent: 0,
    milestones: [['Wave 0 · Pilot', '18 Oct', 'done'], ['Wave 1 · CRM', '25 Oct', 'next'], ['Wave 2 · Terminal services', '01 Nov', 'later'], ['Wave 3 · Legacy', '—', 'late']],
    docs: [['Migration plan', 'Internal, approved 10 Aug', 'h360-mig-plan.pdf']],
    accept: [['Wave 0 · Pilot', '9 servers committed', 'Signed']],
    decom: [['ubuntu-build-03', 'Wave 0', 'Powered off 18 Oct', 'Deleted 21 Oct', 'Deleted'], ['dev-k8s-01', 'Wave 0', 'Powered off 18 Oct', 'Delete after 01 Nov', 'Waiting']]
  }
];
const MS: Record<string, [string, string]> = { done: ['circle-check', 'ok'], next: ['circle-dot', 'run'], later: ['circle', 'tx'], late: ['triangle-alert', 'warn'] };
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Mobility › Migration plans › Project: the migration as a project, with its paperwork. */
export function ProjectView({ ctx }: { ctx: Ctx }) {
  const ps = PROJECTS.filter(p => inScope(ctx, p.customer));
  const [sel, setSel] = useState(ps[0]?.customer);
  const [revoke, setRevoke] = useState(true);
  const sign = useClosable<string>();
  const p = ps.find(x => x.customer === sel) || ps[0];
  if (!p) return <div style={{ padding: '0 24px' }}><Bar tone="info">No migration project for this customer.</Bar></div>;
  const done = p.milestones.filter(m => m[2] === 'done').length;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {ps.length > 1 ? (
        <div role="radiogroup" aria-label="Project" style={{ display: 'flex', gap: 8 }}>
          {ps.map(x => (
            <Btn key={x.customer} kind={x.customer === p.customer ? 'primary' : 'outline'} size="sm" onClick={() => setSel(x.customer)}>{x.name}</Btn>
          ))}
        </div>
      ) : null}
      <Tiles
        items={[
          { label: 'Milestones', value: String(done), unit: `of ${p.milestones.length}`, icon: 'target', sub: `${p.start} to ${p.end}` },
          { label: 'Budget used', value: p.budget ? `${Math.round((p.spent / p.budget) * 100)} %` : 'Internal', icon: 'receipt', sub: p.budget ? `${inr(p.spent)} of ${inr(p.budget)}` : 'Shown back, not invoiced' },
          { label: 'Waves accepted', value: String(p.accept.filter(a => a[2] === 'Signed').length), unit: `of ${p.accept.length}`, icon: 'badge-check', tone: p.accept.some(a => a[2] === 'Sent') ? 'warn' : 'ok', sub: p.accept.some(a => a[2] === 'Sent') ? 'Waiting for the customer’s signature' : 'Every certificate signed' },
          { label: 'Source VMs to remove', value: String(p.decom.filter(d => d[4] === 'Waiting').length), icon: 'trash-2', sub: 'After their rollback windows close' }
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title={p.name}>
          <div style={{ padding: '4px 16px 12px' }}>
            <Facts labelW={110} items={[{ k: 'Customer', v: custName(p.customer) }, { k: 'Owners', v: p.owner }, { k: 'Sponsor', v: p.sponsor }, { k: 'Timeline', v: `${p.start} to ${p.end}` }]} />
          </div>
        </Panel>
        <Panel title="Milestones">
          <div style={{ padding: '4px 16px 12px' }}>
            <MiniTable label="Milestones" cols={[{ label: 'Milestone' }, { label: 'Date', w: '80px' }, { label: '', w: '110px' }]} rows={p.milestones.map(([m, d, st]) => [m, d, <Status key="s" icon={MS[st][0]} tone={MS[st][1]} label={st === 'done' ? 'Done' : st === 'next' ? 'Next' : st === 'late' ? 'No date' : 'Planned'} />])} />
          </div>
        </Panel>
      </div>
      <Panel title="Documents">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable label="Project documents" cols={[{ label: 'Document', w: '200px' }, { label: 'State' }, { label: '', w: '120px' }]} rows={p.docs.map(([n, st, f]) => [<strong key="n" style={{ fontWeight: 600 }}>{n}</strong>, st, <Btn key="d" kind="ghost" size="sm" icon="download" onClick={() => ctx.toast(`${f} downloaded`, 'ok')}>Download</Btn>])} />
        </div>
      </Panel>
      <Panel title="Acceptance certificates">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Acceptance certificates"
            cols={[{ label: 'Wave', w: '230px' }, { label: 'Evidence' }, { label: '', w: '200px' }]}
            rows={p.accept.map(([w, e, st]) => [<strong key="w" style={{ fontWeight: 600 }}>{w}</strong>, e, st === 'Signed' ? <Status key="s" icon="badge-check" tone="ok" label="Signed by the customer" /> : st === 'Sent' ? <Btn key="s" kind="ghost" size="sm" icon="send" onClick={() => sign.open(w)}>Sent · remind</Btn> : <span key="s" style={{ color: 'var(--tx-3)' }}>After cutover</span>])}
          />
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Each certificate lists the servers, validation results, downtime used against the budget and the change record, and is signed by the customer’s owner in the portal.</p>
        </div>
      </Panel>
      <Panel title="Decommission tracker">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable label="Decommission" cols={[{ label: 'Source VM', w: '140px' }, { label: 'Wave', w: '80px' }, { label: 'Now', w: '150px' }, { label: 'Then' }, { label: '', w: '110px' }]} rows={p.decom.map(([v, w, now, then, st]) => [<strong key="v" style={{ fontWeight: 600 }}>{v}</strong>, w, now, then, <Status key="s" icon={st === 'Deleted' ? 'circle-check' : st === 'Kept' ? 'pin' : 'clock'} tone={st === 'Deleted' ? 'ok' : 'tx'} label={st} />])} />
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>When the last VM on a host is removed, the host’s vSphere licence is listed as returnable.</p>
        </div>
      </Panel>
      <Panel title="When the project closes">
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle on={revoke} onChange={v => { setRevoke(v); audit({ who: 'priya.raman', customer: p.customer, what: v ? 'Turned on credential revocation at project close' : 'Turned off credential revocation at project close', object: p.name, when: ctx.now(), r: 'ok' }); }} label="Revoke credentials at close">Revoke the vCenter and guest credentials Aegis used, and remove the migration agents, when the project closes</Toggle>
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>The closing report goes to the sponsor with the acceptance certificates, the decommission list and the final cost.</p>
        </div>
      </Panel>
      {sign.value ? (
        <Dialog title="Remind the customer" sub={`Acceptance certificate for ${sign.value}`} closing={sign.closing} onClose={sign.close} footer={<><Btn kind="ghost" onClick={sign.close}>Cancel</Btn><Btn kind="primary" icon="send" onClick={() => { ctx.toast(`Reminder sent to ${p.sponsor.split(',')[0]}`, 'ok'); sign.close(); }}>Send reminder</Btn></>}>
          <Facts items={[{ k: 'To', v: p.sponsor }, { k: 'Sent', v: '19 Oct, 10:00 IST' }, { k: 'Signs in', v: 'The customer portal, with MFA' }]} />
        </Dialog>
      ) : null}
    </div>
  );
}

/** The ordered cutover runbook of a wave: preparation, communication, cutover, checks and rollback triggers. */
export function CutoverRunbook({ ctx, wave, servers }: { ctx: Ctx; wave: Wave; servers: SourceVm[] }) {
  const edit = useClosable<boolean>();
  const [budget, setBudget] = useState('20 min over the downtime budget');
  const steps: [string, string, string][] = [
    ['T − 7 days', 'Notify users', 'E-mail template “Planned maintenance” to the distribution list; banner in the intranet'],
    ['T − 24 h', 'Freeze changes', 'Change freeze on the servers in the wave; final test boot'],
    ['T − 2 h', 'Go/no-go', 'Two approvers in the wave’s approval; business owner confirms'],
    ['T − 0', 'Stop applications', servers.length ? `In reverse dependency order: ${[...servers].reverse().map(v => v.name).join(', ')}` : 'In reverse dependency order'],
    ['T + 5 min', 'Final sync, cutover', 'Last changes copied; servers start at the target in dependency order'],
    ['T + 30 min', 'Validate', 'Checks from the Validation tab; business transaction test'],
    ['T + 45 min', 'Announce', 'E-mail “Service restored”; update the change record']
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MiniTable label="Cutover runbook" cols={[{ label: 'When', w: '90px' }, { label: 'Step', w: '160px' }, { label: 'What' }]} rows={steps.map(([t, s, w]) => [t, <strong key="s" style={{ fontWeight: 600 }}>{s}</strong>, <span key="w" style={{ whiteSpace: 'normal', padding: '6px 0' }}>{w}</span>])} />
      <div>
        <h3 style={{ font: '600 13px/18px var(--f-ui)', marginBottom: 6 }}>Roll back automatically when</h3>
        <MiniTable label="Rollback triggers" cols={[{ label: 'Trigger' }, { label: '', w: '120px' }]} rows={[['More than 2 validation checks fail', 'Ask, then roll back'], [`Downtime goes ${budget}`, 'Ask, then roll back'], ['The business owner answers No at go-live', 'Roll back']].map(([a, b]) => [a, b])} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn kind="outline" size="sm" icon="pencil" perm={ctx.can('configure', 'Planning waves')} onClick={() => edit.open(true)}>Edit triggers…</Btn>
        <Btn kind="ghost" size="sm" icon="download" onClick={() => ctx.toast(`${wave.name}: runbook and communications plan downloaded`, 'ok')}>Download runbook</Btn>
      </div>
      {edit.value ? (
        <Dialog title="Rollback triggers" closing={edit.closing} onClose={edit.close} footer={<><Btn kind="ghost" onClick={edit.close}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => { audit({ who: 'priya.raman', customer: wave.customer, what: 'Changed rollback triggers', object: wave.name, when: ctx.now(), r: 'ok', after: [['Downtime', budget]] }); ctx.toast('Rollback triggers saved', 'ok'); edit.close(); }}>Save</Btn></>}>
          <Field id="rt-b" label="Downtime"><SelectInput id="rt-b" value={budget} onChange={setBudget} options={['10 min over the downtime budget', '20 min over the downtime budget', '50 % over the downtime budget']} /></Field>
          <Field id="rt-n" label="Business owner"><TextInput id="rt-n" value={wave.customer === 'mer' ? 'Suresh Iyer' : 'Arun Kumar'} readOnly /></Field>
        </Dialog>
      ) : null}
    </div>
  );
}
