import { useEffect, useRef, useState, type ReactNode } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { T } from '../data/platform';
import { Btn, Field, RadioCard, SelectInput, TextInput, Toggle } from '../ui/controls';
import { Bar, Facts, LogView, Spacer, TableArea, Toolbar, plural, type LogLine } from '../ui/layout';
import { Dialog, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, showCustomerCol } from './common';
import { audit } from './store';

type Kind = 'trigger' | 'http' | 'backup' | 'condition' | 'approval' | 'webhook' | 'notify' | 'delete' | 'wait';
interface Step { id: string; kind: Kind; title: string; detail: string; branch?: Step[]; branchLabel?: string }
interface Flow { id: string; name: string; customer: string; enabled: boolean; version: number; last?: { when: string; r: 'ok' | 'warn' | 'err'; took: string }; steps: Step[] }

const KIND: Record<Kind, { icon: string; label: string; hint: string }> = {
  trigger: { icon: 'zap', label: 'Trigger', hint: 'A schedule, an event or a request' },
  http: { icon: 'activity', label: 'API check', hint: 'Call a URL and check the answer' },
  backup: { icon: 'archive', label: 'Backup', hint: 'Back up workloads with a policy' },
  condition: { icon: 'git-branch', label: 'Condition', hint: 'Go on only if something is true' },
  approval: { icon: 'user-check', label: 'Approval', hint: 'Wait for people to approve' },
  webhook: { icon: 'send', label: 'Webhook', hint: 'Post the result to another system' },
  notify: { icon: 'bell', label: 'Notify', hint: 'E-mail, Teams, Slack, SMS or PagerDuty' },
  delete: { icon: 'trash-2', label: 'Delete', hint: 'Remove recovery points' },
  wait: { icon: 'timer', label: 'Wait', hint: 'Pause for a time' }
};
let sq = 0;
const S = (kind: Kind, title: string, detail: string, x: Partial<Step> = {}): Step => ({ id: 'ws' + ++sq, kind, title, detail, ...x });

const FLOWS: Flow[] = [
  {
    id: 'wf1', name: 'ERP health check, backup, then tell ServiceNow', customer: 'h360', enabled: true, version: 4, last: { when: T('21 Oct', '01:31'), r: 'ok', took: '14 min 20 s' },
    steps: [
      S('trigger', 'Every day at 01:30 IST', 'Schedule'),
      S('http', 'ERP answers healthy', 'GET https://erp.host360.ai/health · expect 200 within 10 s', { branchLabel: 'If it fails', branch: [S('notify', 'Tell #erp-ops in Teams', '“ERP is not healthy; tonight’s backup was skipped”'), S('webhook', 'Open a ServiceNow incident', 'POST /api/now/table/incident · priority 3')] }),
      S('backup', 'Back up ERP', 'erp-db-01 and erp-app-01 together · application-consistent · Database hourly policy'),
      S('webhook', 'Record the result in ServiceNow', 'POST https://host360.service-now.com/api/now/table/u_backup_log · job id, result, size, duration')
    ]
  },
  {
    id: 'wf2', name: 'Core banking reports: database, then VM', customer: 'mer', enabled: true, version: 2, last: { when: T('20 Oct', '23:42'), r: 'ok', took: '41 min' },
    steps: [
      S('trigger', 'Every day at 23:00 IST', 'Schedule, after end-of-day batch'),
      S('backup', 'Back up the reporting database', 'SQL01\\CBSREPORT · full plus logs · application-consistent'),
      S('condition', 'Database backup succeeded', 'Result is Succeeded and the log chain is unbroken', { branchLabel: 'If not', branch: [S('notify', 'Page the DBA on call', 'PagerDuty · Meridian DBA rota · high urgency')] }),
      S('backup', 'Back up the report server', 'rpt-app-01 · crash-consistent · Production daily'),
      S('notify', 'E-mail the reporting team', 's.iyer@meridianbank.in · summary with sizes and times')
    ]
  },
  {
    id: 'wf3', name: 'Two-level approval to delete recovery points', customer: 'h360', enabled: true, version: 3, last: { when: T('21 Oct', '12:10'), r: 'warn', took: 'Waiting for level 2' },
    steps: [
      S('trigger', 'Someone asks to delete recovery points', 'Event · any repository · any customer'),
      S('approval', 'Level 1: department owner', '1 of Owner, Admin of the department · expires in 24 h', { branchLabel: 'If rejected', branch: [S('notify', 'Tell the requester', 'E-mail with the reviewer’s reason')] }),
      S('approval', 'Level 2: Host360 security officer', 'security@host360.ai · step-up MFA · expires in 24 h', { branchLabel: 'If rejected', branch: [S('notify', 'Tell the requester and level 1', 'E-mail with the reviewer’s reason')] }),
      S('delete', 'Delete the recovery points', 'Only points whose immutability lock has ended; locked points are refused and listed'),
      S('notify', 'Record and tell the customer owner', 'Audit record with both approvals · e-mail to the owner')
    ]
  }
];

/** Automation › Workflows: chains of steps drawn as a flow, with the three examples from the brief. */
export function WorkflowsTab({ ctx }: { ctx: Ctx }) {
  const [flows, setFlows] = useState<Flow[]>(FLOWS);
  const [open, setOpen] = useState<string | null>(ctx.openId && FLOWS.some(f => f.id === ctx.openId) ? ctx.openId : null);
  const create = useClosable<boolean>();
  useEffect(() => {
    if (ctx.openId && flows.some(f => f.id === ctx.openId)) setOpen(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = flows.filter(f => inScope(ctx, f.customer));
  const cfg = ctx.can('configure', 'Editing workflows');
  const f = open ? flows.find(x => x.id === open) : null;
  if (f) return <Builder ctx={ctx} flow={f} onBack={() => setOpen(null)} onSave={n => setFlows(x => x.map(y => (y.id === n.id ? n : y)))} />;
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Chain checks, backups, approvals and calls to other systems. Each run is recorded like a job.</span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={cfg} onClick={() => create.open(true)}>Create a workflow</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Workflows"
          cols={[
            { k: 'n', label: 'Workflow', w: 'minmax(240px,1.8fr)' },
            ...(showCustomerCol(ctx) ? [{ k: 'c', label: 'Customer', w: 'minmax(150px,1fr)', dim: true }] : []),
            { k: 't', label: 'Starts', w: 'minmax(180px,1.2fr)', dim: true },
            { k: 's', label: 'Steps', w: '72px', r: true },
            { k: 'l', label: 'Last run', w: '200px' },
            { k: 'e', label: 'State', w: '100px' }
          ]}
          rows={rows.map(x => ({
            id: x.id,
            n: { v: x.name, strong: true },
            c: custName(x.customer),
            t: x.steps[0]?.title || '—',
            s: { v: String(count(x.steps)), s: count(x.steps) },
            l: x.last ? { t: 'status', i: x.last.r === 'ok' ? 'circle-check' : x.last.r === 'warn' ? 'hand' : 'circle-x', c: x.last.r, l: `${x.last.when.replace(' 2026', '').replace(' IST', '')} · ${x.last.took}` } : { v: 'Never run', muted: true },
            e: x.enabled ? { t: 'status', i: 'circle-check', c: 'ok', l: 'On' } : { t: 'status', i: 'circle-minus', c: 'tx', l: 'Off' }
          }))}
          onRow={(id: string) => { setOpen(id); ctx.go('automation/workflows', id); }}
          state={ctx.ui}
          unit={['workflow', 'workflows']}
          emptyText="No workflows yet. Start from an example: a health check before a backup, a database before its VM, or a two-level approval."
          emptyAction="Create a workflow"
          onEmpty={() => create.open(true)}
        />
      </TableArea>
      {create.value ? (
        <CreateDialog
          ctx={ctx}
          closing={create.closing}
          onClose={create.close}
          onCreate={n => { setFlows(x => [...x, n]); create.close(); setOpen(n.id); }}
        />
      ) : null}
    </>
  );
}

const count = (st: Step[]): number => st.reduce((a, s) => a + 1 + (s.branch ? count(s.branch) : 0), 0);

function Builder({ ctx, flow, onBack, onSave }: { ctx: Ctx; flow: Flow; onBack: () => void; onSave: (f: Flow) => void }) {
  const [steps, setSteps] = useState<Step[]>(flow.steps);
  const [sel, setSel] = useState<string>(flow.steps[0]?.id);
  const [enabled, setEnabled] = useState(flow.enabled);
  const [run, setRun] = useState<{ i: number; state: Record<string, 'run' | 'ok' | 'skip'>; log: LogLine[] } | null>(null);
  const add = useClosable<{ at: number; edit?: Step }>();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const dirty = JSON.stringify(steps) !== JSON.stringify(flow.steps) || enabled !== flow.enabled;
  const cfg = ctx.can('configure', 'Editing workflows');
  const find = (id: string, list = steps): Step | undefined => list.reduce<Step | undefined>((a, s) => a || (s.id === id ? s : s.branch ? find(id, s.branch) : undefined), undefined);
  const cur = find(sel);
  const test = () => {
    const main = steps;
    const st: Record<string, 'run' | 'ok' | 'skip'> = {};
    const log: LogLine[] = [{ t: ctx.hms(), text: `Test run of ${flow.name} started by priya.raman (dry run: nothing is changed)`, lv: 'info' }];
    setRun({ i: 0, state: st, log });
    const next = (i: number) => {
      if (i >= main.length) {
        setRun(r => r && { ...r, log: [...r.log, { t: ctx.hms(), text: 'Test run finished: every step would succeed', lv: 'ok' }] });
        ctx.toast(`Test run of ${flow.name} passed`, 'ok');
        return;
      }
      const s = main[i];
      setRun(r => r && { ...r, i, state: { ...r.state, [s.id]: 'run' }, log: [...r.log, { t: ctx.hms(), text: `${KIND[s.kind].label}: ${s.title}`, lv: 'info' }] });
      timer.current = window.setTimeout(() => {
        setRun(r => r && { ...r, state: { ...r.state, [s.id]: 'ok', ...Object.fromEntries((s.branch || []).map(b => [b.id, 'skip'])) }, log: [...r.log, { t: ctx.hms(), text: s.kind === 'approval' ? 'Would wait for approval (simulated as approved)' : s.kind === 'http' ? '200 OK in 182 ms' : s.kind === 'delete' ? 'Would delete 14 points; 0 still locked' : 'OK', lv: 'ok' }] });
        next(i + 1);
      }, 700);
    };
    next(0);
  };
  const removeStep = (id: string) => {
    const strip = (list: Step[]): Step[] => list.filter(s => s.id !== id).map(s => (s.branch ? { ...s, branch: strip(s.branch) } : s));
    setSteps(strip(steps));
    setSel(steps[0].id);
  };
  const node = (s: Step, i: number, inBranch = false): ReactNode => {
    const on = sel === s.id;
    const rs = run?.state[s.id];
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => setSel(s.id)}
        aria-pressed={on}
        style={{ width: inBranch ? 240 : 300, display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', textAlign: 'left', border: `1px solid ${on ? 'var(--acc)' : 'var(--ln-2)'}`, background: on ? 'var(--acc-soft)' : 'var(--panel-2)', opacity: rs === 'skip' ? 0.5 : 1 }}
      >
        <Icon name={KIND[s.kind].icon} style={{ color: s.kind === 'delete' ? 'var(--err)' : 'var(--tx-2)' }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{inBranch ? KIND[s.kind].label : `${i + 1} · ${KIND[s.kind].label}`}</span>
          <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
        </span>
        {rs === 'run' ? <Icon name="loader-circle" spin style={{ color: "var(--run)" }} /> : rs === 'ok' ? <Icon name="circle-check" style={{ color: 'var(--ok)' }} /> : rs === 'skip' ? <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Skipped</span> : <span />}
      </button>
    );
  };
  const plus = (at: number) => (
    <button type="button" aria-label="Add a step here" data-tip="Add a step here" disabled={!cfg.ok} onClick={() => add.open({ at })} style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', border: '1px solid var(--ln-2)', background: 'var(--panel)', color: 'var(--tx-2)' }}>
      <Icon name="plus" size={14} />
    </button>
  );
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Btn kind="ghost" icon="chevron-left" onClick={() => { onBack(); ctx.go('automation/workflows'); }}>Workflows</Btn>
        <strong style={{ fontWeight: 600 }}>{flow.name}</strong>
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{custName(flow.customer)} · version {flow.version}{dirty ? ' · unsaved changes' : ''}</span>
        <Spacer />
        <Toggle on={enabled} onChange={setEnabled} label="Workflow on" perm={cfg}>{enabled ? 'On' : 'Off'}</Toggle>
        <Btn kind="outline" icon="flask-conical" disabled={!!run && Object.values(run.state).includes('run')} why="A test is running." onClick={test}>Test run</Btn>
        <Btn kind="primary" icon="check" perm={cfg} disabled={!dirty} why="Nothing has changed." onClick={() => { onSave({ ...flow, steps, enabled, version: flow.version + 1 }); audit({ who: 'priya.raman', customer: flow.customer, what: 'Saved a workflow', object: `${flow.name} v${flow.version + 1}`, when: ctx.now(), r: 'ok' }); ctx.toast(`${flow.name} saved as version ${flow.version + 1}`, 'ok'); }}>Save as version {flow.version + 1}</Btn>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16, padding: '0 24px 24px' }}>
        <div style={{ overflow: 'auto', border: '1px solid var(--ln)', background: 'var(--panel)', padding: '24px 24px 32px' }}>
          <div role="list" aria-label="Workflow steps" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {steps.map((s, i) => (
              <div key={s.id} role="listitem" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {node(s, i)}
                  {s.branch?.length ? (
                    <>
                      <span style={{ display: 'flex', alignItems: 'center', width: 110, position: 'relative' }}>
                        <span style={{ flex: 1, borderTop: '1px dashed var(--warn)' }} />
                        <Icon name="chevron-right" size={14} style={{ color: 'var(--warn)', marginLeft: -4 }} />
                        <span style={{ position: 'absolute', top: -18, left: 8, font: '12px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>{s.branchLabel}</span>
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{s.branch.map(b => node(b, 0, true))}</span>
                    </>
                  ) : null}
                </div>
                {i < steps.length - 1 ? (
                  <div style={{ width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ height: 10, borderLeft: '1px solid var(--ln-2)' }} />
                    {plus(i + 1)}
                    <span style={{ height: 10, borderLeft: '1px solid var(--ln-2)' }} />
                  </div>
                ) : (
                  <div style={{ width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ height: 10, borderLeft: '1px solid var(--ln-2)' }} />
                    {plus(i + 1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'auto' }}>
          {cur ? (
            <div style={{ border: '1px solid var(--ln)', background: 'var(--panel)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', font: '12px var(--f-ui)', color: 'var(--tx-3)' }}><Icon name={KIND[cur.kind].icon} />{KIND[cur.kind].label}</span>
              <strong style={{ font: '500 16px/22px var(--f-head)' }}>{cur.title}</strong>
              <Facts labelW={90} items={[{ k: 'Does', v: cur.detail }, ...(cur.branch ? [{ k: cur.branchLabel || 'Otherwise', v: cur.branch.map(b => b.title).join(', then ') }] : [])]} />
              {cur.kind === 'delete' ? <Bar tone="info" icon="lock">Immutability locks are always respected: a locked point is never deleted, whoever approves.</Bar> : null}
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn kind="outline" size="sm" icon="pencil" perm={cfg} onClick={() => add.open({ at: -1, edit: cur })}>Edit…</Btn>
                {cur.kind !== 'trigger' ? <Btn kind="ghost" size="sm" icon="trash-2" perm={cfg} onClick={() => removeStep(cur.id)}>Remove</Btn> : null}
              </div>
            </div>
          ) : null}
          {run ? <LogView lines={run.log} height={260} /> : <p style={{ font: '13px/18px var(--f-ui)', color: 'var(--tx-2)' }}>Test run walks every step without changing anything and shows what would happen.</p>}
        </div>
      </div>
      {add.value ? (
        <StepDialog
          edit={add.value.edit}
          closing={add.closing}
          onClose={add.close}
          onSave={s => {
            if (add.value?.edit) {
              const repl = (list: Step[]): Step[] => list.map(x => (x.id === s.id ? { ...x, ...s } : x.branch ? { ...x, branch: repl(x.branch) } : x));
              setSteps(repl(steps));
            } else {
              const at = add.value!.at;
              setSteps([...steps.slice(0, at), s, ...steps.slice(at)]);
              setSel(s.id);
            }
            add.close();
          }}
        />
      ) : null}
    </div>
  );
}

function StepDialog({ edit, closing, onClose, onSave }: { edit?: Step; closing: boolean; onClose: () => void; onSave: (s: Step) => void }) {
  const [kind, setKind] = useState<Kind>(edit?.kind || 'http');
  const [title, setTitle] = useState(edit?.title || '');
  const [detail, setDetail] = useState(edit?.detail || '');
  const [fail, setFail] = useState(edit?.branch ? 'Notify and stop' : 'Stop the workflow');
  const ok = title.trim().length >= 3 && detail.trim().length >= 3;
  return (
    <Dialog
      title={edit ? `Edit ${edit.title}` : 'Add a step'}
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!ok} why="Give the step a name and say what it does." onClick={() => onSave({ id: edit?.id || 'ws' + Date.now(), kind, title: title.trim(), detail: detail.trim(), ...(fail === 'Notify and stop' && kind !== 'trigger' ? { branchLabel: kind === 'approval' ? 'If rejected' : 'If it fails', branch: edit?.branch || [{ id: 'ws' + Date.now() + 'b', kind: 'notify', title: 'Tell the workflow owner', detail: 'E-mail with the step and its error' }] } : { branch: undefined, branchLabel: undefined }) })}>{edit ? 'Save step' : 'Add step'}</Btn></>}
    >
      {!edit ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          {(Object.keys(KIND) as Kind[]).filter(k => k !== 'trigger').map(k => <RadioCard key={k} on={kind === k} onClick={() => setKind(k)} icon={KIND[k].icon} title={KIND[k].label} />)}
        </div>
      ) : null}
      <p style={{ color: 'var(--tx-2)' }}>{KIND[kind].hint}.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 16 }}>
        <Field id="st-t" label="Name"><TextInput id="st-t" value={title} onChange={setTitle} placeholder={kind === 'http' ? 'Payments API answers' : 'Back up the file server'} autoFocus /></Field>
        <Field id="st-f" label={kind === 'approval' ? 'If rejected' : 'If it fails'}><SelectInput id="st-f" value={fail} onChange={setFail} options={['Stop the workflow', 'Notify and stop']} disabled={kind === 'trigger'} /></Field>
      </div>
      <Field id="st-d" label="What it does" hint={kind === 'http' ? 'Method, URL and what counts as healthy' : kind === 'webhook' ? 'URL; the body carries the job id, result, size and duration' : kind === 'approval' ? 'Who approves, how many, and when it expires' : undefined}>
        <TextInput id="st-d" value={detail} onChange={setDetail} placeholder={kind === 'http' ? 'GET https://payments.meridianbank.in/health · expect 200 within 10 s' : kind === 'webhook' ? 'POST https://hooks.example.com/aegis' : ''} />
      </Field>
    </Dialog>
  );
}

function CreateDialog({ ctx, closing, onClose, onCreate }: { ctx: Ctx; closing: boolean; onClose: () => void; onCreate: (f: Flow) => void }) {
  const [from, setFrom] = useState('wf1');
  const [name, setName] = useState('');
  const base = FLOWS.find(f => f.id === from);
  return (
    <Dialog
      title="Create a workflow"
      sub="Start from an example and change it, or start with just a trigger."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={name.trim().length < 4} why="Name the workflow." onClick={() => { const n: Flow = { id: 'wf' + Date.now(), name: name.trim(), customer: ctx.actingAs?.customer || 'h360', enabled: false, version: 1, steps: base ? base.steps.map(s => ({ ...s, id: s.id + 'c' + Date.now() })) : [S('trigger', 'Every day at 02:00 IST', 'Schedule')] }; audit({ who: 'priya.raman', customer: n.customer, what: 'Created a workflow', object: n.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${n.name} created; it stays off until you turn it on`, 'ok'); onCreate(n); }}>Create</Btn></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FLOWS.map(f => <RadioCard key={f.id} on={from === f.id} onClick={() => setFrom(f.id)} icon="workflow" title={f.name} note={`${plural(count(f.steps), 'step')}: ${f.steps.map(s => KIND[s.kind].label.toLowerCase()).join(', ')}`} />)}
        <RadioCard on={from === 'blank'} onClick={() => setFrom('blank')} icon="plus" title="Just a trigger" note="Add the steps yourself" />
      </div>
      <Field id="cw-n" label="Name"><TextInput id="cw-n" value={name} onChange={setName} placeholder="Payments: health check before backup" /></Field>
    </Dialog>
  );
}
