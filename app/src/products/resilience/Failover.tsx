import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../../lib/Icon';
import { Btn, CheckBox, Field, RadioCard, SelectInput, TextInput } from '../../ui/controls';
import { Bar, H3, LogView, MiniTable, Progress, Status, plural } from '../../ui/layout';
import { Dialog, StepUp, Wizard } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName } from '../../platform/common';
import { audit, store, update } from '../../platform/store';
import { APPLICATIONS } from '../../data/platform';
import { DR_INFO, fmtMin, parseDur, wl, type Runbook } from './data';
import { dryRun } from './Builder';
import { KIND_LABEL, clearRun, confirmManual, startRun, stopRun, type DrRun, type RunKind } from './runner';

const KIND_NOTE: Record<Exclude<RunKind, 'Failback'>, string> = {
  Test: 'Starts copies on the isolated test network. Production keeps running and nothing is changed.',
  Planned: 'The primary site is up. Copies the last changes, shuts the servers down, then starts them at the recovery site. No data is lost.',
  Unplanned: 'The primary site is down. Starts every server from its newest point; changes since then are lost.'
};
const APPROVERS: Record<string, { name: string; email: string }[]> = {
  h360: [{ name: 'Arun Kumar', email: 'arun.kumar@host360.ai' }, { name: 'Meera Iyer', email: 'meera.iyer@host360.ai' }],
  mer: [{ name: 'Anitha Krishnan', email: 'anitha.k@meridianbank.in' }, { name: 'Suresh Iyer', email: 's.iyer@meridianbank.in' }],
  kav: [{ name: 'Rahul Menon', email: 'rahul@kaveri-logistics.in' }]
};

/** The next free APR number in the shared store. */
export const nextApprovalId = () => `APR-${Math.max(...store.approvals.map(a => +a.id.replace(/\D/g, '') || 0)) + 1}`;

type Pre = { id: string; label: string; obj: string; result: string; state: 'pass' | 'warn' | 'block' };

/** Pre-flight: what is checked right before a run, beyond the readiness report. */
function preflight(ctx: Ctx, rb: Runbook, kind: RunKind, stageIds: string[]): Pre[] {
  const out: Pre[] = [];
  const servers = rb.stages.filter(s => stageIds.includes(s.id)).flatMap(s => s.steps.filter(x => x.kind === 'boot').map(x => x.w!));
  if (rb.to === 'region-2-os') return [{ id: 'site', label: 'Recovery site answers', obj: rb.to, result: 'Could not be read: Keystone at 10.40.0.5:5000 did not answer within 30 s', state: 'block' }];
  out.push({ id: 'site', label: 'Recovery site answers', obj: rb.to, result: 'Answered in 84 ms', state: 'pass' });
  out.push({ id: 'cred', label: 'Credentials valid', obj: rb.to, result: 'Signed in as svc-aegis-dr', state: 'pass' });
  if (kind === 'Planned') out.push({ id: 'prim', label: 'Primary site answers', obj: rb.from, result: 'Answered in 12 ms; a final sync is possible', state: 'pass' });
  servers.forEach(id => {
    const w = wl(id);
    if (!w) return;
    if (!DR_INFO[id] || w.dr.s === 'none') out.push({ id: 'rep-' + id, label: 'Replicated', obj: w.name, result: 'Not replicated; it cannot be started', state: 'block' });
    else if (w.dr.s === 'online') out.push({ id: 'rep-' + id, label: 'Not already failed over', obj: w.name, result: w.dr.note || 'Already running at the recovery site', state: 'block' });
    else if (kind === 'Planned') out.push({ id: 'rpo-' + id, label: 'Final sync', obj: w.name, result: `Newest point ${w.dr.age} old; the final sync copies the rest`, state: 'pass' });
    else if (w.dr.s === 'failed' || w.dr.s === 'behind') out.push({ id: 'rpo-' + id, label: 'Newest point', obj: w.name, result: `${w.dr.age} old, target ${w.dr.target}${w.dr.s === 'failed' ? '; last sync failed' : ''}`, state: 'warn' });
    else out.push({ id: 'rpo-' + id, label: 'Newest point', obj: w.name, result: `${w.dr.age} old, target ${w.dr.target}`, state: 'pass' });
  });
  out.push({ id: 'quota', label: 'Capacity at the recovery site', obj: rb.to, result: `Needs ${servers.length * 8} vCPU and ${servers.length * 32} GB; 96 vCPU and 512 GB free`, state: 'pass' });
  if (kind === 'Test') out.push({ id: 'net', label: 'Test network isolated', obj: rb.testNet, result: 'No router and no route to production', state: 'pass' });
  else out.push({ id: 'dns', label: 'DNS TTL short enough', obj: rb.customer === 'mer' ? 'meridianbank.in' : 'host360.ai', result: 'TTL 60 s on every record the plan changes', state: 'pass' });
  const busy = ctx.jobs.filter(j => j.status === 'run' && servers.some(id => wl(id)?.name === j.object));
  busy.forEach(j => out.push({ id: 'job-' + j.id, label: 'No conflicting jobs', obj: j.object, result: `${j.name} is running (${Math.floor(j.pct)} %); it will be paused`, state: 'warn' }));
  if (!busy.length) out.push({ id: 'jobs', label: 'No conflicting jobs', obj: rb.name, result: 'Nothing else is running on these servers', state: 'pass' });
  const dr = dryRun(rb);
  const errs = dr.findings.filter(f => f.level === 'err' && (!f.step || rb.stages.some(s => stageIds.includes(s.id) && s.steps.some(x => x.id === f.step))));
  out.push(errs.length ? { id: 'dry', label: 'Runbook dry run', obj: rb.name, result: errs.map(e => e.text).join(' '), state: 'block' } : { id: 'dry', label: 'Runbook dry run', obj: rb.name, result: `Passed; about ${fmtMin(dr.estimate)} of ${rb.rtoTarget}`, state: 'pass' });
  return out;
}

/**
 * Fail over, plan or test, in one dialog: what and how, pre-flight, blast radius, then
 * step-up MFA and a recorded approval. The run continues on the plan page and in the jobs tray.
 */
/** Newest application-consistent checkpoint per server: VSS on Windows, quiesce hooks on Linux, the database's own on databases. */
function appCheckpoint(w: { id: string; os: string; type: string }): { v: string; tip: string; warn?: boolean } {
  if (w.id === 'ad-dc-01') return { v: '21 Oct 11:00 · VSS (12:25 timed out)', tip: 'The 12:25 checkpoint timed out in VMware Tools quiesce after 600 s; the 11:00 one is the newest good one', warn: true };
  if (w.type === 'Kubernetes workload') return { v: '21 Oct 14:00 · pre-hook (fsfreeze)', tip: 'Velero-style pre and post hooks run in the pods before the volume snapshot' };
  if (w.type === 'Database') return { v: '21 Oct 14:00 · database checkpoint', tip: 'Taken by the database plug-in: the log is flushed and the point is marked in the journal' };
  if (/windows/i.test(w.os)) return { v: '21 Oct 14:00 · VSS', tip: 'Volume Shadow Copy with every registered writer (SQL Server, Exchange, Active Directory)' };
  return { v: '21 Oct 14:00 · pre-freeze and post-thaw hooks', tip: 'Scripts in /etc/aegis/hooks run before fsfreeze and after thaw; 60 s limit' };
}

export function FailoverDialog({ ctx, rb, initial, closing, onClose }: { ctx: Ctx; rb: Runbook; initial: Exclude<RunKind, 'Failback'>; closing: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Exclude<RunKind, 'Failback'>>(initial);
  const [scope, setScope] = useState<'all' | 'some'>('all');
  const [picked, setPicked] = useState<Record<string, boolean>>(Object.fromEntries(rb.stages.map(s => [s.id, true])));
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState(0);
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState('');
  const [mfa, setMfa] = useState(false);
  const [how, setHow] = useState<'present' | 'request'>('present');
  const [approver, setApprover] = useState((APPROVERS[rb.customer] || APPROVERS.h360)[0].email);
  const [approverOk, setApproverOk] = useState(false);
  const [pointMode, setPointMode] = useState<'newest' | 'app' | 'time'>('newest');
  const [pointAt, setPointAt] = useState('21 Oct 2026, 14:52:30');
  const stageIds = rb.stages.filter(s => scope === 'all' || picked[s.id]).map(s => s.id);
  const checks = preflight(ctx, rb, kind, stageIds);
  const test = kind === 'Test';
  useEffect(() => {
    if (step !== 1) return;
    setShown(0);
    const t = window.setInterval(() => setShown(n => (n >= checks.length ? n : n + 1)), 260);
    return () => clearInterval(t);
  }, [step, kind, stageIds.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const doneChecking = shown >= checks.length;
  const blocks = checks.filter(c => c.state === 'block');
  const warns = checks.filter(c => c.state === 'warn');
  const servers = rb.stages.filter(s => stageIds.includes(s.id)).flatMap(s => s.steps.filter(x => x.kind === 'boot').map(x => wl(x.w)!)).filter(Boolean);
  const netSteps = rb.stages.filter(s => stageIds.includes(s.id)).flatMap(s => s.steps.filter(x => x.kind === 'dns' || x.kind === 'lb'));
  const apps = APPLICATIONS.filter(a => a.members.some(m => servers.some(w => w.id === m)));
  const est = dryRun({ ...rb, stages: rb.stages.filter(s => stageIds.includes(s.id)) }).estimate + (kind === 'Planned' ? 3 : 0);
  const approverName = (APPROVERS[rb.customer] || APPROVERS.h360).find(a => a.email === approver)?.name || approver;
  const missing: string[] = [];
  rb.stages.forEach((s, i) => {
    if (!stageIds.includes(s.id)) return;
    rb.stages.slice(0, i).forEach(prev => {
      if (!stageIds.includes(prev.id) && prev.steps.some(x => x.kind === 'boot')) missing.push(prev.id);
    });
  });
  const missingStages = rb.stages.filter(s => missing.includes(s.id));

  const pointOk = pointMode === 'newest' || /^\d{2} \w{3} \d{4}, \d{2}:\d{2}:\d{2}$/.test(pointAt);
  const canNext = [
    stageIds.length > 0 && (test || reason.trim().length > 3) && pointOk,
    doneChecking && !blocks.length && (!warns.length || ack),
    test || typed.trim() === rb.name,
    test || (mfa && (how === 'request' || approverOk))
  ][step];
  const why = [
    !stageIds.length ? 'Choose at least one stage.' : !pointOk ? 'Write the moment as 21 Oct 2026, 14:52:30.' : 'Give a reason or a change or incident number.',
    !doneChecking ? 'Checking…' : blocks.length ? 'Fix what blocks the run first.' : 'Confirm you have read the warnings.',
    `Type ${rb.name} to confirm.`,
    !mfa ? 'Confirm it is you first.' : `${approverName} must confirm with their own code.`
  ][step];

  const start = () => {
    if (!test && how === 'request') {
      const id = nextApprovalId();
      update(s => {
        s.approvals.unshift({ id, kind: 'Failover', object: `${rb.name} (${kind.toLowerCase()})`, customer: rb.customer, requester: 'priya.raman', approvers: `Failover Approver (1 of: ${(APPROVERS[rb.customer] || APPROVERS.h360).map(a => a.name).join(', ')})`, needed: 1, given: [], requested: ctx.now(), expires: kind === 'Unplanned' ? '21 Oct 2026, 18:05 IST' : '21 Oct 2026, 23:59 IST', state: 'pending', reason: reason.trim(), evidence: [`Pre-flight check PF-${300 + Math.floor(Math.random() * 600)} (${blocks.length ? 'blocked' : warns.length ? `passed, ${plural(warns.length, 'warning')}` : 'passed'})`, `Blast radius: ${plural(servers.length, 'server')}, ${plural(apps.length, 'application')}`], rule: rb.approval });
      });
      audit({ who: 'priya.raman', customer: rb.customer, what: `Requested approval for a ${kind.toLowerCase()} failover`, object: rb.name, when: ctx.now(), r: 'ok', note: reason.trim() });
      ctx.toast(`Approval requested for ${rb.name}. ${(APPROVERS[rb.customer] || APPROVERS.h360).map(a => a.name).join(' and ')} were notified.`, 'info');
      onClose();
      return;
    }
    startRun(ctx, rb, kind, stageIds, { approvedBy: test ? undefined : `${approverName} (${approver}), confirmed with their MFA code at ${ctx.hms()} IST`, reason: reason.trim() || undefined, pointAt: pointMode === 'time' ? pointAt : undefined, appConsistent: pointMode === 'app' });
    ctx.toast(test ? `Test of ${rb.name} started on ${rb.testNet}` : `${KIND_LABEL[kind]} of ${rb.name} started`, test ? 'info' : 'warn');
    onClose();
  };

  const nextBtn =
    step < 3 ? (
      <Btn kind="primary" iconAfter="chevron-right" disabled={!canNext} why={why} onClick={() => setStep(step + 1)}>
        Next
      </Btn>
    ) : (
      <Btn kind={test ? 'primary' : 'dangerSolid'} icon={!test && how === 'request' ? 'send' : test ? 'flask-conical' : 'zap'} disabled={!canNext} why={why} onClick={start}>
        {test ? 'Start the test' : how === 'request' ? 'Request approval' : `Start ${kind.toLowerCase()} failover`}
      </Btn>
    );

  return (
    <Wizard
      title={`${test ? 'Test' : 'Fail over'}: ${rb.name}`}
      sub={`${rb.from} → ${test ? `${rb.to}, on ${rb.testNet}` : rb.to} · RTO target ${rb.rtoTarget}`}
      steps={['What and how', 'Pre-flight', 'Blast radius', 'Authorise']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={nextBtn}
    >
      {step === 0 ? (
        <>
          <div role="radiogroup" aria-label="Kind of run" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['Test', 'Planned', 'Unplanned'] as const).map(k => (
              <RadioCard key={k} on={kind === k} onClick={() => { setKind(k); setAck(false); }} icon={k === 'Test' ? 'flask-conical' : k === 'Planned' ? 'calendar-clock' : 'zap'} title={KIND_LABEL[k]} note={KIND_NOTE[k]} tag={k === 'Test' ? 'No approval needed' : undefined} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Scope</span>
            <div role="radiogroup" aria-label="Scope" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <RadioCard on={scope === 'all'} onClick={() => setScope('all')} title="The whole plan" note={`${plural(rb.stages.length, 'stage')} · ${plural(rb.stages.flatMap(s => s.steps).filter(x => x.kind === 'boot').length, 'server')}`} />
              <RadioCard on={scope === 'some'} onClick={() => setScope('some')} title="Some stages" note="A partial failover; the rest stays where it is." />
            </div>
            {scope === 'some' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--ln)' }}>
                {rb.stages.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 40, padding: '0 12px', borderBottom: i < rb.stages.length - 1 ? '1px solid var(--ln)' : 'none' }}>
                    <CheckBox on={!!picked[s.id]} onChange={v => setPicked(p => ({ ...p, [s.id]: v }))} label={s.name}>
                      <span style={{ fontWeight: 600 }}>
                        {i + 1}. {s.name}
                      </span>
                    </CheckBox>
                    <span style={{ flex: 1, minWidth: 0, font: '12px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.steps.filter(x => x.kind === 'boot').map(x => wl(x.w)?.name).join(', ') || 'No servers'}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {scope === 'some' && missingStages.length ? (
              <Bar tone="warn" actions={<Btn kind="ghost" size="sm" onClick={() => setPicked(p => ({ ...p, ...Object.fromEntries(missingStages.map(s => [s.id, true])) }))}>Add {missingStages.length === 1 ? 'it' : 'them'}</Btn>}>
                Later stages may need {missingStages.map(s => s.name).join(', ')}, which you left out.
              </Bar>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Recovery point</span>
            <div role="radiogroup" aria-label="Recovery point" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
              <RadioCard on={pointMode === 'newest'} onClick={() => setPointMode('newest')} icon="clock" title="Newest point" note="Each server from its newest replica point; groups from their newest group point." />
              <RadioCard on={pointMode === 'app'} onClick={() => setPointMode('app')} icon="database" title="Application-consistent" note="The newest VSS or quiesce checkpoint; databases skip crash recovery." />
              <RadioCard on={pointMode === 'time'} onClick={() => setPointMode('time')} icon="history" title="A moment in time" note="Any second in the journal, for example just before ransomware started." />
            </div>
            {pointMode === 'time' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
                <Field id="fo-at" label="Recover to" err={pointOk ? null : 'Write it as 21 Oct 2026, 14:52:30.'}>
                  <TextInput id="fo-at" value={pointAt} onChange={setPointAt} mono />
                </Field>
                <MiniTable
                  label="Point per server"
                  cols={[{ label: 'Server' }, { label: 'Comes back from', w: '230px' }]}
                  rows={servers.map(w => {
                    const cont = DR_INFO[w.id]?.mode === 'Continuous';
                    return [w.name, <span key="p" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={cont ? 'Journal: to the second' : `Snapshot taken every ${DR_INFO[w.id]?.every || w.dr.target || '15 min'}`}>{cont ? `${pointAt.replace(' 2026', '')} · journal` : 'Snapshot just before it'}</span>];
                  })}
                />
              </div>
            ) : null}
            {pointMode === 'app' ? (
              <MiniTable
                label="Checkpoint per server"
                cols={[{ label: 'Server' }, { label: 'Newest checkpoint', w: '260px' }]}
                rows={servers.map(w => {
                  const ck = appCheckpoint(w);
                  return [w.name, <span key="p" style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: ck.warn ? 'var(--warn)' : undefined }} data-tip={ck.tip}>{ck.v}</span>];
                })}
              />
            ) : null}
            {pointMode === 'time' ? <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Journals keep 24 h (20 Oct 16:05:00 to now). Servers replicated on a schedule come back from their nearest earlier snapshot.</span> : null}
          </div>
          {!test ? (
            <Field id="fo-reason" label="Reason, with a change or incident number" hint="Goes into the audit log, the approval request and the evidence pack.">
              <TextInput id="fo-reason" value={reason} onChange={setReason} placeholder={kind === 'Planned' ? 'CHG0032010: Chennai DC power maintenance, 25 Oct 22:00 IST' : 'INC-20431: Chennai-proxmox-prod unreachable since 15:40 IST'} />
            </Field>
          ) : null}
        </>
      ) : null}
      {step === 1 ? (
        <>
          <ul aria-live="polite" style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)' }}>
            {checks.map((c, i) => {
              const done = i < shown;
              const [ic, tone] = !done ? ['loader-circle', 'run'] : c.state === 'pass' ? ['circle-check', 'ok'] : c.state === 'warn' ? ['triangle-alert', 'warn'] : ['circle-x', 'err'];
              return (
                <li key={c.id} style={{ display: 'grid', gridTemplateColumns: '16px 200px minmax(0,1fr)', gap: 10, alignItems: 'start', padding: '9px 12px', borderBottom: i < checks.length - 1 ? '1px solid var(--ln)' : 'none', opacity: done || i === shown ? 1 : 0.5 }}>
                  <Icon name={ic} spin={!done && i === shown} style={{ color: `var(--${tone})`, marginTop: 1 }} />
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block' }}>{c.obj}</span>
                    <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: done && c.state !== 'pass' ? 'var(--tx)' : 'var(--tx-3)' }}>{done ? c.result : 'Checking…'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {doneChecking && blocks.length ? <Bar tone="err" multiline>{plural(blocks.length, 'check')} {blocks.length === 1 ? 'blocks' : 'block'} the run. Nothing was started. {blocks.some(b => b.id === 'site') ? 'Wait until the recovery site answers, or change the plan’s recovery site.' : 'Fix the plan or leave these stages out.'}</Bar> : null}
          {doneChecking && !blocks.length && warns.length ? (
            <CheckBox on={ack} onChange={setAck}>
              I have read the {plural(warns.length, 'warning')} and want to continue
            </CheckBox>
          ) : null}
          {doneChecking && !blocks.length && !warns.length ? <Bar tone="ok">Every pre-flight check passed.</Bar> : null}
        </>
      ) : null}
      {step === 2 ? (
        <>
          {test ? <Bar tone="info" icon="flask-conical">No production impact. Copies start on {rb.testNet}; DNS and load balancer steps are skipped.</Bar> : <Bar tone="warn" multiline>{kind === 'Planned' ? `Users lose access while the servers move, about ${fmtMin(est)}. Nothing is lost.` : `Changes made after each server's newest point are lost. Users regain access in about ${fmtMin(est)}.`}</Bar>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', border: '1px solid var(--ln)', background: 'var(--panel-2)' }}>
            {[
              ['Servers started', String(servers.length), `at ${rb.to}`],
              [test ? 'Production changes' : 'Applications', test ? 'None' : String(apps.length), test ? 'Isolated network' : apps.map(a => a.name).join(', ') || 'None'],
              ['Estimated time', fmtMin(est), `RTO target ${rb.rtoTarget}`],
              [kind === 'Unplanned' ? 'Most data lost' : 'Data lost', kind === 'Unplanned' ? fmtMin(Math.max(...servers.map(w => parseDur(w.dr.age) || 0))) : 'None', kind === 'Unplanned' ? 'Worst newest point' : kind === 'Planned' ? 'Final sync first' : 'Test only']
            ].map(([k, v, sub], i) => (
              <div key={k} style={{ padding: '12px 14px', borderLeft: i ? '1px solid var(--ln)' : 'none', minWidth: 0 }}>
                <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{k}</div>
                <div style={{ font: '500 20px/28px var(--f-head)' }}>{v}</div>
                <div data-tip={sub} data-tip-overflow="" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
              </div>
            ))}
          </div>
          <div>
            <H3>What changes</H3>
            <MiniTable
              label="What changes"
              cols={[{ label: 'Object', w: '180px' }, { label: 'Change' }]}
              rows={[
                ...servers.map(w => [<strong key="n" style={{ fontWeight: 600 }}>{w.name}</strong>, test ? `A copy starts on ${rb.testNet}; the original keeps running` : kind === 'Planned' ? `Shut down at ${rb.from} after a final sync, started at ${rb.to}` : `Started at ${rb.to} from a point ${w.dr.age} old`]),
                ...(test ? [] : netSteps.map(x => [<strong key="n" style={{ fontWeight: 600 }}>{x.kind === 'dns' ? x.record : x.pool}</strong>, x.kind === 'dns' ? `DNS points at ${x.value}` : `Members become ${x.value}`])),
                ...(test ? [[<strong key="r" style={{ fontWeight: 600 }}>Replication</strong>, `Keeps running for ${plural(servers.length, 'server')}; the test copies start from the newest point and never write to the replicas`], [<strong key="d" style={{ fontWeight: 600 }}>DNS and load balancers</strong>, 'Not changed; names resolve inside the bubble only']] : []),
                ...(test ? [] : [[<strong key="r" style={{ fontWeight: 600 }}>Replication</strong>, `Paused for ${plural(servers.length, 'server')} until you return to primary`], [<strong key="b" style={{ fontWeight: 600 }}>Backups</strong>, 'Protection jobs for these servers are paused while they run at the recovery site']])
              ] as ReactNode[][]}
            />
          </div>
          {!test ? (
            <div>
              <H3>Who is told</H3>
              <p style={{ color: 'var(--tx-2)' }}>
                {apps.length ? apps.map(a => `${a.owner} (${a.name})`).join(', ') : rb.owner}, the {custName(rb.customer)} owner and the on-call rota. {rb.customer !== 'h360' ? 'The customer sees the failover in their console and audit log.' : ''}
              </p>
            </div>
          ) : null}
          {!test ? (
            <Field id="fo-name" label={<>Type <strong style={{ color: 'var(--tx)' }}>{rb.name}</strong> to confirm</>}>
              <TextInput id="fo-name" value={typed} onChange={setTyped} />
            </Field>
          ) : null}
        </>
      ) : null}
      {step === 3 ? (
        test ? (
          <>
            <Bar tone="info" icon="flask-conical">Tests on the isolated network never need approval or step-up.</Bar>
            <p style={{ color: 'var(--tx-2)' }}>The test keeps running if you close this page. Follow it on the plan page or in the running jobs at the top. When it passes, clean up the test servers.</p>
          </>
        ) : (
          <>
            <StepUp verified={mfa} onVerified={() => setMfa(true)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{rb.approval}. You cannot approve your own failover.</span>
              <div role="radiogroup" aria-label="Approval" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <RadioCard on={how === 'present'} onClick={() => setHow('present')} icon="user-check" title="An approver is with me" note="They confirm with their own code now; the approval is recorded." />
                <RadioCard on={how === 'request'} onClick={() => setHow('request')} icon="send" title="Request approval" note="The failover waits in the approver's Inbox." />
              </div>
            </div>
            {how === 'present' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field id="fo-appr" label="Approver">
                  <SelectInput id="fo-appr" value={approver} onChange={v => { setApprover(v); setApproverOk(false); }} options={(APPROVERS[rb.customer] || APPROVERS.h360).map(a => ({ v: a.email, label: `${a.name} · ${a.email}` }))} />
                </Field>
                <StepUp key={approver} verified={approverOk} onVerified={() => setApproverOk(true)} who={approver} />
              </div>
            ) : (
              <Bar tone="info" icon="send" multiline>
                Submitting creates an approval request for {(APPROVERS[rb.customer] || APPROVERS.h360).map(a => a.name).join(' or ')}, with the pre-flight result and blast radius attached. {kind === 'Unplanned' ? 'Unplanned requests expire in 2 hours.' : 'It expires at the end of today.'}
              </Bar>
            )}
          </>
        )
      ) : null}
    </Wizard>
  );
}

/** Live progress of a run on the plan page. It keeps going when the page closes. */
export function RunPanel({ ctx, rb, run, onFailback }: { ctx: Ctx; rb: Runbook; run: DrRun; onFailback: () => void }) {
  const total = run.flat.length;
  const pct = run.state === 'done' ? 100 : (run.i / total) * 100;
  const rto = parseDur(rb.rtoTarget) || 60;
  const tone = run.state === 'done' ? 'ok' : run.state === 'wait' ? 'warn' : run.state === 'stopped' ? 'warn' : 'run';
  const op = ctx.can('operate', 'Running a recovery plan');
  const stages = rb.stages.filter(s => run.stages.includes(s.id));
  const cur = run.flat[run.i];
  const curStage = cur ? rb.stages.find(s => s.id === cur.stage) : null;
  const atRecovery = (run.kind === 'Planned' || run.kind === 'Unplanned') && run.state === 'done';
  const [approving, setApproving] = useState<'open' | 'closing' | null>(null);
  const [verified, setVerified] = useState(false);
  const closeApprove = () => { setApproving('closing'); window.setTimeout(() => { setApproving(null); setVerified(false); }, 160); };
  const approvalStep = run.waitKind === 'approval' ? rb.stages.flatMap(s => s.steps).find(x => x.id === run.flat[run.i]?.step) : undefined;
  return (
    <section aria-label="Run in progress" style={{ border: `1px solid var(--${tone === 'run' ? 'acc' : tone})`, background: 'var(--panel)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--ln)' }}>
        <Icon name={run.state === 'done' ? 'circle-check' : run.state === 'wait' ? 'hand' : run.state === 'stopped' ? 'circle-stop' : 'loader-circle'} spin={run.state === 'run'} size={20} style={{ color: `var(--${tone})` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>
            {KIND_LABEL[run.kind]} {run.state === 'done' ? (atRecovery ? `finished: ${rb.name} runs at ${rb.to}` : run.kind === 'Failback' ? `finished: back at ${rb.from}` : 'passed') : run.state === 'wait' ? (run.waitKind === 'approval' ? `is waiting for approval: ${approvalStep?.who || 'an approver'}` : 'is waiting for a person') : run.state === 'stopped' ? 'was stopped' : `in progress · step ${Math.min(run.i + 1, total)} of ${total}${curStage ? ` · ${curStage.name}` : ''}`}
          </div>
          <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
            Started {run.started} by {run.by}
            {run.approvedBy ? ` · approved by ${run.approvedBy.split(' (')[0]}` : ''} · {fmtMin(run.sim / 60)} of {rb.rtoTarget} used{run.sim / 60 > rto ? ' — over the RTO target' : ''}
          </div>
        </div>
        {run.state === 'wait' && run.waitKind === 'approval' ? (
          <Btn kind="primary" icon="user-check" perm={op} onClick={() => setApproving('open')}>
            Approve…
          </Btn>
        ) : run.state === 'wait' ? (
          <Btn kind="primary" icon="check" perm={op} onClick={() => confirmManual(rb.id)}>
            Mark the manual step done
          </Btn>
        ) : null}
        {approving ? (
          <Dialog
            title="Approve the run going on"
            sub={`${KIND_LABEL[run.kind]} of ${rb.name}, started by ${run.by}. You cannot approve a run you started.`}
            closing={approving === 'closing'}
            onClose={closeApprove}
            footer={
              <>
                <Btn kind="ghost" onClick={closeApprove}>Cancel</Btn>
                <Btn kind="primary" icon="check" disabled={!verified} why="Confirm with your second factor first." onClick={() => { confirmManual(rb.id, 'arun.kumar'); audit({ who: 'arun.kumar', customer: rb.customer, what: 'Approved a recovery plan step', object: rb.name, when: ctx.now(), r: 'ok', note: approvalStep?.who }); ctx.toast('Approved; the run goes on', 'ok'); closeApprove(); }}>
                  Approve as arun.kumar
                </Btn>
              </>
            }
          >
            <Bar tone="info" multiline>Next: {rb.stages.find(s => s.id === run.flat[run.i + 1]?.stage)?.name || 'the end of the run'}. {run.kind === 'Test' ? 'Nothing outside the test network changes.' : 'Production DNS and load balancers change after this point.'}</Bar>
            <StepUp who="arun.kumar@host360.ai" verified={verified} onVerified={() => setVerified(true)} />
          </Dialog>
        ) : null}
        {run.state === 'run' || run.state === 'wait' ? (
          <Btn kind="outline" icon="circle-stop" perm={op} onClick={() => stopRun(rb.id)}>
            Stop
          </Btn>
        ) : null}
        {run.state === 'done' && run.kind === 'Test' ? (
          <Btn kind="primary" icon="trash-2" perm={op} onClick={() => { clearRun(rb.id); audit({ who: 'priya.raman', customer: rb.customer, what: 'Cleaned up test servers', object: rb.name, when: ctx.now(), r: 'ok' }); ctx.toast(`Test servers of ${rb.name} deleted from ${rb.to}`, 'ok'); }}>
            Clean up test servers
          </Btn>
        ) : null}
        {atRecovery ? (
          <Btn kind="primary" icon="undo-2" perm={op} onClick={onFailback}>
            Return to primary…
          </Btn>
        ) : null}
        {run.state === 'stopped' || (run.state === 'done' && run.kind === 'Failback') ? (
          <Btn kind="ghost" onClick={() => clearRun(rb.id)}>
            Dismiss
          </Btn>
        ) : null}
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length},minmax(0,1fr))`, gap: 4 }}>
          {(run.kind === 'Failback' ? [...stages].reverse() : stages).map(s => {
            const items = run.flat.map((f, i) => ({ f, i })).filter(x => x.f.stage === s.id);
            const done = items.length && items.every(x => x.i < run.i || run.state === 'done');
            const on = cur?.stage === s.id && run.state !== 'done';
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ height: 4, background: done ? 'var(--ok)' : on ? 'var(--run)' : 'var(--ln)', transition: 'background-color 150ms' }} />
                <span style={{ font: '12px/16px var(--f-ui)', color: on ? 'var(--tx)' : 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Progress pct={pct} tone={tone} slow />
          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)', fontVariantNumeric: 'tabular-nums', width: 40, textAlign: 'right' }}>{Math.floor(pct)} %</span>
        </div>
        <LogView lines={run.log} height={180} />
      </div>
    </section>
  );
}

/** Return to primary after a failover: reverse sync, then move back. Armed in this dialog. */
const PLATFORM_OF: Record<string, string> = { 'Chennai-proxmox-prod': 'Proxmox VE', Chennai_Lab_Proxmox: 'Proxmox VE', 'production-openstack': 'OpenStack', 'region-2-os': 'OpenStack' };

export function FailbackDialog({ ctx, rb, closing, onClose }: { ctx: Ctx; rb: Runbook; closing: boolean; onClose: () => void }) {
  const [mfa, setMfa] = useState(false);
  const [same, setSame] = useState(true);
  const others = Object.keys(PLATFORM_OF).filter(x => x !== rb.to);
  const [target, setTarget] = useState(others.find(x => x !== rb.from) || others[0]);
  const servers = rb.stages.flatMap(s => s.steps.filter(x => x.kind === 'boot').map(x => wl(x.w)!)).filter(w => w && w.dr.s === 'online');
  const convert = !same && PLATFORM_OF[target] !== PLATFORM_OF[rb.to];
  const changed = (gb: number, i: number) => Math.max(0.1, gb * (0.012 + (i % 3) * 0.007));
  const total = servers.reduce((a, w, i) => a + (same ? changed(w.sizeGB, i) : w.sizeGB), 0);
  const hours = total / 680;
  const dest = same ? `${rb.from} (original hosts)` : `${target}${convert ? `, converted to ${PLATFORM_OF[target]}` : ''}`;
  return (
    <Dialog
      alert
      size="lg"
      title={`Return ${rb.name} to primary`}
      sub="Copies what changed at the recovery site back, shuts the copies down, then starts the servers at the primary in reverse stage order. A reconciliation report is signed at the end."
      closing={closing}
      onClose={onClose}
      footNote={`Users lose access for about ${fmtMin(dryRun(rb).estimate + 6)} at the switch; the copy before it runs while they keep working.`}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="undo-2" disabled={!mfa || !servers.length} why={!servers.length ? 'No server of this plan runs at the recovery site.' : 'Confirm it is you first.'} onClick={() => {
            update(x => { x.failbackTarget[rb.id] = { target: dest, same }; });
            const r = store.drRuns[rb.id];
            startRun(ctx, rb, 'Failback', r ? r.stages : rb.stages.map(s => s.id));
            audit({ who: 'priya.raman', customer: rb.customer, what: 'Started a return to primary', object: rb.name, when: ctx.now(), r: 'ok', after: [['Target', dest]] });
            ctx.toast(`Return of ${rb.name} to ${same ? rb.from : target} started`, 'info');
            onClose();
          }}>
            Return to primary
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={same} onClick={() => setSame(true)} icon="undo-2" title={`The original servers at ${rb.from}`} note="Reverse sync of changed blocks only" />
        <RadioCard on={!same} onClick={() => setSame(false)} icon="server" title="New hardware or another platform" note="Full copy; converted if the platform differs" />
      </div>
      {!same ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'end' }}>
          <Field id="fb-t" label="Return to"><SelectInput id="fb-t" value={target} onChange={setTarget} options={others.map(o => ({ v: o, label: `${o} (${PLATFORM_OF[o]})` }))} /></Field>
          <p style={{ font: '13px/18px var(--f-ui)', color: 'var(--tx-2)', paddingBottom: 8 }}>{convert ? `From ${PLATFORM_OF[rb.to]} to ${PLATFORM_OF[target]}: VirtIO drivers, boot firmware and network names are set from Mappings.` : `Same platform as ${rb.to}; disks are copied as they are.`}</p>
        </div>
      ) : null}
      <MiniTable
        label="Servers"
        cols={[{ label: 'Server', w: '160px' }, { label: same ? 'Changed at the recovery site' : 'To copy', w: '190px', r: true }, { label: 'What happens' }]}
        rows={servers.map((w, i) => [<strong key="n" style={{ fontWeight: 600 }}>{w.name}</strong>, same ? `${changed(w.sizeGB, i).toFixed(1)} GB` : `${w.sizeGB} GB`, same ? `Reverse sync, shut down at ${rb.to}, start at ${rb.from}` : `Full copy to ${target}${convert ? ', convert' : ''}, then switch`])}
        empty="No server of this plan runs at the recovery site."
      />
      {servers.length ? <p style={{ color: 'var(--tx-2)' }}>About {hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : `${hours.toFixed(1)} h`} to copy {total.toFixed(1)} GB at 190 MB/s. The servers keep running at {rb.to} until the switch.</p> : null}
      <StepUp verified={mfa} onVerified={() => setMfa(true)} />
    </Dialog>
  );
}

/** The same states as a status cell for the shared table. */
export function runCell(run: DrRun) {
  if (run.state === 'run') return { t: 'status', i: 'loader-circle', spin: true, c: 'run', l: `${KIND_LABEL[run.kind]} running`, s: 0 };
  if (run.state === 'wait') return { t: 'status', i: run.waitKind === 'approval' ? 'user-check' : 'hand', c: 'warn', l: run.waitKind === 'approval' ? 'Waiting for approval' : 'Waiting for a person', s: 0 };
  if (run.state === 'stopped') return { t: 'status', i: 'circle-stop', c: 'warn', l: 'Stopped', s: 0 };
  if (run.kind === 'Test') return { t: 'status', i: 'flask-conical', c: 'ok', l: 'Test passed · clean up', s: 0 };
  if (run.kind === 'Failback') return { t: 'status', i: 'circle-check', c: 'ok', l: 'Back at primary', s: 0 };
  return { t: 'status', i: 'power', c: 'run', l: 'At the recovery site', s: 0 };
}

export function RunStatus({ run }: { run?: DrRun }) {
  if (!run) return null;
  if (run.state === 'run') return <Status icon="loader-circle" spin tone="run" label={`${KIND_LABEL[run.kind]} running`} />;
  if (run.state === 'wait') return <Status icon={run.waitKind === 'approval' ? 'user-check' : 'hand'} tone="warn" label={run.waitKind === 'approval' ? 'Waiting for approval' : 'Waiting for a person'} />;
  if (run.state === 'stopped') return <Status icon="circle-stop" tone="warn" label="Stopped" />;
  if (run.kind === 'Test') return <Status icon="flask-conical" tone="ok" label="Test passed · clean up" />;
  if (run.kind === 'Failback') return <Status icon="circle-check" tone="ok" label="Back at primary" />;
  return <Status icon="power" tone="run" label="At the recovery site" />;
}

