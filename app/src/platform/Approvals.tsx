import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { APPROVAL_RULES, type Approval } from '../data/platform';
import { Btn, Field, FilterInput, InfoTip, RadioCard, Seg, SelectInput, TextArea, Toggle } from '../ui/controls';
import { Activity, Bar, Facts, H3, Spacer, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, StepUp, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope } from './common';
import { audit, store, update, useStore } from './store';

const ME = ['priya.raman', 'Owner', 'Admin'];
/** Kinds whose approval is itself a destructive or irreversible step. */
const STEP_UP_KINDS = ['Delete recovery points', 'Failover', 'Cutover', 'Unlock compliance mode'];
const ST: Record<Approval['state'], [string, string, string]> = {
  pending: ['clock', 'Waiting', 'warn'],
  approved: ['circle-check', 'Approved', 'ok'],
  rejected: ['circle-x', 'Rejected', 'err'],
  expired: ['circle-minus', 'Expired', 'tx'],
  used: ['check', 'Used', 'ok'],
  cancelled: ['circle-minus', 'Cancelled', 'tx']
};
const forMe = (a: Approval) => a.state === 'pending' && ME.some(m => a.approvers.includes(m)) && !a.given.some(g => g.who === 'priya.raman');

export function ApproveDialog({ ctx, approval: a, closing, onClose, onDone }: { ctx: Ctx; approval: Approval; closing: boolean; onClose: () => void; onDone: (v: 'approved' | 'rejected') => void }) {
  const [verdict, setVerdict] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [mfa, setMfa] = useState(!STEP_UP_KINDS.includes(a.kind));
  const already = a.given.some(g => g.who === 'priya.raman');
  const self = a.requester === 'priya.raman';
  const last = a.given.length + 1 >= a.needed;
  const submit = () => {
    update(s => {
      const x = s.approvals.find(y => y.id === a.id)!;
      if (verdict === 'approve') {
        x.given = [...x.given, { who: 'priya.raman', when: ctx.now(), note: note.trim() || undefined }];
        if (x.given.length >= x.needed) x.state = 'approved';
      } else x.state = 'rejected';
    });
    audit({ who: 'priya.raman', customer: a.customer, what: verdict === 'approve' ? `Approved ${a.kind.toLowerCase()} (${a.given.length + 1} of ${a.needed})` : `Rejected ${a.kind.toLowerCase()}`, object: `${a.id} · ${a.object}`, when: ctx.now(), r: 'ok', note: note.trim() || undefined });
    onDone(verdict === 'approve' ? 'approved' : 'rejected');
  };
  const blocked = already || self;
  return (
    <Dialog
      title={`${a.kind}: ${a.object}`}
      sub={`${a.id} · requested by ${a.requester} · ${custName(a.customer)}`}
      closing={closing}
      onClose={onClose}
      footNote={verdict === 'approve' ? (last ? 'Your approval completes the request.' : `${a.needed - a.given.length - 1} more approval needed after yours.`) : 'The requester is told at once.'}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            kind={verdict === 'approve' ? 'primary' : 'dangerSolid'}
            icon={verdict === 'approve' ? 'check' : 'ban'}
            disabled={blocked || !mfa || (verdict === 'reject' && note.trim().length < 3)}
            why={self ? 'You cannot approve your own request.' : already ? 'You have already approved this request.' : !mfa ? 'Confirm it is you first.' : 'Say why you are rejecting it.'}
            onClick={submit}
          >
            {verdict === 'approve' ? 'Approve' : 'Reject'}
          </Btn>
        </>
      }
    >
      {self ? <Bar tone="info">You raised this request. Someone else has to approve it.</Bar> : null}
      <Facts
        items={[
          { k: 'Reason', v: a.reason },
          { k: 'Rule', v: a.rule },
          { k: 'Approvers', v: a.approvers },
          { k: 'So far', v: a.given.length ? a.given.map(g => g.who).join(', ') : 'Nobody yet', muted: !a.given.length },
          { k: 'Expires', v: a.expires },
          { k: 'Evidence', v: a.evidence.length ? a.evidence.join(' · ') : 'None attached', muted: !a.evidence.length }
        ]}
      />
      <div role="radiogroup" aria-label="Decision" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        <RadioCard on={verdict === 'approve'} onClick={() => setVerdict('approve')} title="Approve" note={last ? 'The action can run now.' : 'Counts towards the quorum.'} />
        <RadioCard on={verdict === 'reject'} onClick={() => setVerdict('reject')} title="Reject" note="Ends the request for everyone." />
      </div>
      <Field id="ap-note" label={verdict === 'reject' ? 'Why (required)' : 'Comment (optional)'}>
        <TextArea id="ap-note" value={note} onChange={setNote} rows={2} placeholder={verdict === 'reject' ? 'Run it after the month-end close instead.' : 'Checked the test boot report.'} />
      </Field>
      {STEP_UP_KINDS.includes(a.kind) && !blocked ? <StepUp verified={mfa} onVerified={() => setMfa(true)} /> : null}
    </Dialog>
  );
}

export function ApprovalsTab({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [view, setView] = useState<'mine' | 'pending' | 'decided'>('mine');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const dlg = useClosable<string>();
  const [tab, setTab] = useState('Request');
  useEffect(() => {
    if (ctx.openId && s.approvals.some(a => a.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = s.approvals.filter(a => inScope(ctx, a.customer));
  const ql = q.trim().toLowerCase();
  const rows = all.filter(a => (view === 'mine' ? forMe(a) : view === 'pending' ? a.state === 'pending' : a.state !== 'pending') && (!ql || `${a.id} ${a.kind} ${a.object} ${a.requester}`.toLowerCase().includes(ql)));
  const d = drawer.value ? s.approvals.find(a => a.id === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <Seg
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { v: 'mine', label: 'Waiting for me', count: all.filter(forMe).length },
            { v: 'pending', label: 'All waiting', count: all.filter(a => a.state === 'pending').length },
            { v: 'decided', label: 'Decided', count: all.filter(a => a.state !== 'pending').length }
          ]}
        />
        <FilterInput value={q} onChange={setQ} placeholder="Filter by ID, object or requester" label="Filter approvals" />
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Approvals"
          cols={[
            { k: 'id', label: 'Request', w: '96px' },
            { k: 'what', label: 'What', w: 'minmax(220px,2fr)' },
            { k: 'cust', label: 'Customer', w: 'minmax(120px,1fr)', dim: true },
            { k: 'by', label: 'Requested by', w: 'minmax(120px,1fr)', dim: true },
            { k: 'n', label: 'Approvals', w: '96px', r: true },
            { k: 'exp', label: 'Expires', w: '188px', dim: true },
            { k: 'st', label: 'State', w: '120px' }
          ]}
          rows={rows.map(a => ({
            id: a.id,
            what: { v: `${a.kind} · ${a.object}`, strong: true },
            cust: custName(a.customer),
            by: a.requester,
            n: { v: `${a.given.length} of ${a.needed}`, s: a.given.length / a.needed },
            exp: a.expires,
            st: { t: 'status', i: ST[a.state][0], l: ST[a.state][1], c: ST[a.state][2] },
            idv: a.id
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Request'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['request', 'requests']}
          filtered={!!ql || view !== 'mine'}
          onClear={() => { setQ(''); setView('pending'); }}
          noMatchText={view === 'mine' ? 'Nothing is waiting for you.' : undefined}
          emptyText="No approval requests yet. They appear when someone starts an action that a rule protects."
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Approval request"
          kicker={`Approval · ${d.kind} · ${custName(d.customer)}`}
          title={`${d.id} · ${d.object}`}
          status={
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name={ST[d.state][0]} style={{ color: `var(--${ST[d.state][2] === 'tx' ? 'tx-3' : ST[d.state][2]})` }} />
                <span style={{ color: 'var(--tx)' }}>{ST[d.state][1]}</span>
              </span>
              <span>{d.given.length} of {d.needed} approvals</span>
              <span>Expires {d.expires}</span>
            </>
          }
          actions={
            d.state === 'pending' ? (
              <>
                <Btn kind="primary" icon="check" disabled={!forMe(d)} why={d.requester === 'priya.raman' ? 'You cannot approve your own request.' : 'You are not one of its approvers, or you have already approved it.'} onClick={() => dlg.open(d.id)}>
                  Review and decide…
                </Btn>
                {d.requester === 'priya.raman' ? (
                  <Btn kind="danger" icon="x" onClick={() => { update(st => { st.approvals.find(x => x.id === d.id)!.state = 'cancelled'; }); ctx.toast(`${d.id} cancelled`, 'ok'); }}>
                    Cancel request
                  </Btn>
                ) : null}
              </>
            ) : undefined
          }
          tabs={[{ v: 'Request', label: 'Request' }, { v: 'Decisions', label: 'Decisions', count: d.given.length }]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Request' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Facts
                items={[
                  { k: 'Action', v: d.kind },
                  { k: 'Object', v: d.object },
                  { k: 'Requested by', v: d.requester },
                  { k: 'Requested', v: d.requested },
                  { k: 'Reason', v: d.reason },
                  { k: 'Rule', v: d.rule },
                  { k: 'Approvers', v: d.approvers },
                  { k: 'Step-up MFA', v: STEP_UP_KINDS.includes(d.kind) ? 'Required from each approver' : 'Not required' }
                ]}
              />
              <section>
                <H3>Evidence</H3>
                {d.evidence.length ? (
                  <ul style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)' }}>
                    {d.evidence.map(e => (
                      <li key={e} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--ln)' }}>
                        <Icon name="file-text" style={{ color: 'var(--tx-2)' }} />
                        <span style={{ flex: 1 }}>{e}</span>
                        <Btn kind="ghost" size="sm" icon="eye" onClick={() => ctx.toast(`Opened ${e}`, 'info')}>
                          View
                        </Btn>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--tx-2)' }}>No evidence attached.</p>
                )}
              </section>
            </div>
          ) : (
            <Activity
              items={[
                { icon: 'send', tone: 'info', text: `${d.requester} asked for approval`, when: d.requested },
                ...d.given.map(g => ({ icon: 'circle-check', tone: 'ok', text: `${g.who} approved${g.note ? ` · “${g.note}”` : ''}`, when: g.when })),
                ...(d.state === 'rejected' ? [{ icon: 'circle-x', tone: 'err', text: 'Rejected', when: '' }] : []),
                ...(d.state === 'expired' ? [{ icon: 'circle-minus', tone: 'tx', text: 'Expired before enough approvals', when: d.expires }] : [])
              ]}
            />
          )}
        </Drawer>
      ) : null}
      {dlg.value ? (
        <ApproveDialog
          ctx={ctx}
          approval={s.approvals.find(a => a.id === dlg.value)!}
          closing={dlg.closing}
          onClose={dlg.close}
          onDone={v => {
            dlg.close();
            ctx.toast(v === 'approved' ? `Approved ${dlg.value}` : `Rejected ${dlg.value}`, v === 'approved' ? 'ok' : 'info');
          }}
        />
      ) : null}
    </>
  );
}

type Rule = (typeof APPROVAL_RULES)[number];

export function ApprovalRulesTab({ ctx }: { ctx: Ctx }) {
  const [rules, setRules] = useState<Rule[]>(APPROVAL_RULES);
  const dlg = useClosable<Rule | 'new'>();
  const cfg = ctx.can('admin', 'Changing approval rules');
  return (
    <>
      <Toolbar>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>
          {plural(rules.length, 'rule')} · {rules.filter(r => r.mandatory).length} mandatory
          <InfoTip tip="Mandatory rules come from Host360 policy or a regulator and cannot be switched off by a customer. Optional rules can be turned off per customer." />
        </span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={cfg} onClick={() => dlg.open('new')}>
          Add a rule
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Approval rules"
          cols={[
            { k: 'action', label: 'Action', w: 'minmax(180px,1.2fr)' },
            { k: 'scope', label: 'Applies to', w: 'minmax(160px,1.2fr)', dim: true },
            { k: 'approvers', label: 'Approvers', w: 'minmax(200px,1.6fr)' },
            { k: 'expiry', label: 'Request expires', w: '150px', dim: true },
            { k: 'm', label: 'Type', w: '120px' }
          ]}
          rows={rules.map(r => ({ id: r.id, action: { v: r.action, strong: true }, scope: r.scope, approvers: r.approvers, expiry: r.expiry, m: r.mandatory ? { t: 'status', i: 'lock', l: 'Mandatory', c: 'tx' } : { t: 'status', i: 'circle', l: 'Optional', c: 'tx' } }))}
          onRow={(id: string) => dlg.open(rules.find(r => r.id === id)!)}
          state={ctx.ui}
          unit={['rule', 'rules']}
          emptyText="No approval rules. Without rules, anyone with the permission can act at once."
          emptyAction="Add a rule"
          onEmpty={() => dlg.open('new')}
        />
      </TableArea>
      {dlg.value ? (
        <RuleDialog
          rule={dlg.value === 'new' ? null : dlg.value}
          closing={dlg.closing}
          onClose={dlg.close}
          perm={cfg}
          onSave={r => {
            setRules(x => (x.some(y => y.id === r.id) ? x.map(y => (y.id === r.id ? r : y)) : [...x, r]));
            ctx.toast(`Rule saved: ${r.action}`, 'ok');
            dlg.close();
          }}
        />
      ) : null}
    </>
  );
}

function RuleDialog({ rule, closing, onClose, onSave, perm }: { rule: Rule | null; closing: boolean; onClose: () => void; onSave: (r: Rule) => void; perm: ReturnType<Ctx['can']> }) {
  const [action, setAction] = useState(rule?.action || 'Delete recovery points');
  const [scope, setScope] = useState(rule?.scope || 'Department level and above');
  const [n, setN] = useState(rule ? (rule.approvers.match(/^\d/) ? rule.approvers[0] : '1') : '2');
  const [from, setFrom] = useState(rule ? rule.approvers.replace(/^\d+ (of: )?/, '') : 'Owner, Admin');
  const [expiry, setExpiry] = useState(rule?.expiry || '24 h');
  const [mandatory, setMandatory] = useState(rule?.mandatory ?? false);
  const locked = !!rule?.mandatory;
  return (
    <Dialog
      title={rule ? `Approval rule: ${rule.action}` : 'Add an approval rule'}
      sub="Who must agree before an action runs. The person who asks can never approve."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="check" perm={perm} disabled={locked} why="Mandatory rules are set by Host360 policy and cannot be edited here." onClick={() => onSave({ id: rule?.id || 'r' + Date.now(), action, scope, approvers: `${n} of: ${from}`, expiry, mandatory })}>
            Save rule
          </Btn>
        </>
      }
    >
      {locked ? <Bar tone="info" icon="lock">This rule is mandatory. It can be tightened by adding another rule, not loosened.</Bar> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="ru-act" label="Action">
          <SelectInput id="ru-act" value={action} onChange={setAction} options={['Delete recovery points', 'Fail over (planned or unplanned)', 'Cut over', 'Restore', 'Change a global policy', 'Unlock compliance mode', 'Log in as owner', 'Remove a site', 'Rotate a credential']} />
        </Field>
        <Field id="ru-scope" label="Applies to">
          <SelectInput id="ru-scope" value={scope} onChange={setScope} options={['Every customer', 'Department level and above', 'Mission Critical workloads', 'Other workloads', 'Sensitive workloads', 'Users with the Restore role', 'Regulated customers (RBI, IRDAI)', 'Global policies', 'Customer', 'Every recovery plan']} />
        </Field>
        <Field id="ru-n" label="Approvals needed">
          <SelectInput id="ru-n" value={n} onChange={setN} options={['1', '2', '3']} />
        </Field>
        <Field id="ru-exp" label="Request expires after">
          <SelectInput id="ru-exp" value={expiry} onChange={setExpiry} options={['4 h', '24 h', '72 h', 'Until the window ends']} />
        </Field>
      </div>
      <Field id="ru-from" label="From" hint="Roles or named people. Two approvals from the same person count once.">
        <SelectInput id="ru-from" value={from} onChange={setFrom} options={[from, 'Owner, Admin', 'Owner or Admin', 'Failover Approver', 'Migration Approver', 'Owner plus a sensitive-workload approver', 'provider security officer, customer owner, customer DPO'].filter((x, i, a) => a.indexOf(x) === i)} />
      </Field>
      <Toggle on={mandatory} onChange={setMandatory} label="Mandatory">
        Mandatory: customers cannot switch it off
      </Toggle>
    </Dialog>
  );
}
