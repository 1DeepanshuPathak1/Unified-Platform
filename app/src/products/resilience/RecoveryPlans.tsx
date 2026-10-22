import { useEffect, useState } from 'react';
import { CopyCurl } from '../../ui/CopyCurl';
import AegisTable from '../../components/AegisTable';
import { Icon } from '../../lib/Icon';
import { Btn, Field, FilterInput, RadioCard, SelectFilter, SelectInput, Tabs, TextInput } from '../../ui/controls';
import { Bar, Facts, H3, MiniTable, Page, PageHeader, Spacer, Status, TableArea, Toolbar, plural } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, Go, inScope, scopeCustomers, showCustomerCol } from '../../platform/common';
import { audit, update, useStore } from '../../platform/store';
import { CUSTOMERS } from '../../data/platform';
import { RUNBOOK_TEMPLATES, appsOf, fmtMin, readiness, serversOf, wl, type RStage, type RStep, type Runbook, type StepKind } from './data';
import { Canvas, StepDialog, dryRun, newStep, type Finding } from './Builder';
import { FailbackDialog, FailoverDialog, RunPanel, runCell } from './Failover';
import { Meter, scoreTone } from './Overview';
import { stepText } from './runner';
import { DrillCalendar, Reconciliations } from './Drills';
import { ComplianceTab } from './Compliance';
import { DnsMapping } from './Dns';

const short = (t: string) => t.replace(' 2026', '').replace(' IST', '');

/** Resilience › Recovery plans: the list, and each plan as a page with its visual runbook. */
export default function RecoveryPlans({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [open, setOpen] = useState<string | null>(ctx.openId && s.runbooks.some(r => r.id === ctx.openId) ? ctx.openId : null);
  useEffect(() => {
    if (ctx.openId && s.runbooks.some(r => r.id === ctx.openId)) setOpen(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const back = () => {
      if (!location.hash.includes('open=')) setOpen(null);
    };
    window.addEventListener('hashchange', back);
    return () => window.removeEventListener('hashchange', back);
  }, []);
  const rb = open ? s.runbooks.find(r => r.id === open) : null;
  if (rb) return <PlanPage key={rb.id} ctx={ctx} rb={rb} onBack={() => { setOpen(null); location.hash = '/dr/recovery'; }} />;
  return <PlanList ctx={ctx} onOpen={setOpen} />;
}

function PlanList({ ctx, onOpen }: { ctx: Ctx; onOpen: (id: string) => void }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [ready, setReady] = useState('All');
  const [view, setView] = useState<'plans' | 'calendar' | 'compliance'>(ctx.tab === 'calendar' || ctx.tab === 'compliance' ? ctx.tab : 'plans');
  const create = useClosable<boolean>();
  const showCust = showCustomerCol(ctx);
  const ql = q.trim().toLowerCase();
  const all = s.runbooks.filter(r => inScope(ctx, r.customer)).map(r => ({ r, ...readiness(r) }));
  const rows = all.filter(({ r, score }) => (!ql || `${r.name} ${custName(r.customer)} ${r.to}`.toLowerCase().includes(ql)) && (ready === 'All' || (ready === 'Ready' ? score != null && score >= 85 : ready === 'Issues' ? score != null && score < 85 : score == null)));
  return (
    <Page>
      <PageHeader
        kicker="Resilience"
        title="Recovery plans"
        sub="Which servers start at the recovery site, in what order, with which checks. Test them on an isolated network; fail over when you must."
        actions={
          <Btn kind="primary" icon="plus" perm={ctx.can('configure', 'Creating a recovery plan')} onClick={() => create.open(true)}>
            Create a plan
          </Btn>
        }
      />
      <Tabs label="Recovery plans" value={view} onChange={v => { setView(v); ctx.go(`dr/recovery/${v}`); }} style={{ margin: '0 24px 12px', padding: 0 }} tabs={[{ v: 'plans', label: 'Plans', count: all.length }, { v: 'calendar', label: 'Drill calendar', count: s.drillSchedule.filter(d => all.some(x => x.r.id === d.plan)).length }, { v: 'compliance', label: 'Compliance', icon: 'scale' }]} />
      {view === 'calendar' ? <DrillCalendar ctx={ctx} /> : view === 'compliance' ? <ComplianceTab ctx={ctx} /> : (
      <>
      <Toolbar>
        <FilterInput value={q} onChange={setQ} placeholder="Filter by name, customer or site" label="Filter recovery plans" width={260} />
        <SelectFilter label="Readiness" value={ready} onChange={setReady} options={['All', 'Ready', 'Issues', 'Not read']} />
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Recovery plans"
          cols={[
            { k: 'name', label: 'Plan', w: 'minmax(180px,1.4fr)' },
            ...(showCust ? [{ k: 'cust', label: 'Customer', w: 'minmax(130px,1fr)', dim: true }] : []),
            { k: 'route', label: 'Primary → recovery', w: 'minmax(200px,1.4fr)', dim: true },
            { k: 'n', label: 'Servers', w: '72px', r: true },
            { k: 'score', label: 'Readiness', w: '150px' },
            { k: 'test', label: 'Last test', w: '128px', dim: true },
            { k: 'state', label: 'Status', w: 'minmax(150px,1fr)' }
          ]}
          rows={rows.map(({ r, score }) => {
            const run = s.drRuns[r.id];
            return {
              id: r.id,
              name: { v: r.name, strong: true },
              cust: custName(r.customer),
              route: `${r.from} → ${r.to}`,
              n: { v: String(serversOf(r).length), s: serversOf(r).length },
              score: score == null ? { v: 'Not read', muted: true, italic: true, s: -1, tip: `${r.to} could not be read` } : { t: 'bar', pct: score, c: scoreTone(score), v: `${score} %`, s: score },
              test: r.lastTest ? { v: short(r.lastTest.when).split(',')[0], s: r.lastTest.when } : { v: 'Never', muted: true, s: '' },
              state: run ? runCell(run) : serversOf(r).some(id => wl(id)?.dr.s === 'online') ? { t: 'status', i: 'power', l: 'At the recovery site', c: 'run', s: 1 } : score == null ? { t: 'status', i: 'triangle-alert', l: 'Recovery site not read', c: 'warn', s: 2 } : { t: 'status', i: score >= 85 ? 'circle-check' : 'triangle-alert', l: score >= 85 ? 'Ready' : `${plural(readiness(r).checks.filter(c => c.state !== 'pass').length, 'issue')}`, c: scoreTone(score), s: 3 }
            };
          })}
          onRow={(id: string) => { onOpen(id); ctx.go('dr/recovery', id); }}
          state={ctx.ui}
          unit={['plan', 'plans']}
          filtered={!!ql || ready !== 'All'}
          onClear={() => { setQ(''); setReady('All'); }}
          emptyText="No recovery plans yet. Start from a template: it lays out the stages, then you add servers and checks."
          emptyAction="Create a plan"
          onEmpty={() => create.open(true)}
          footR="Readiness is checked every day at 06:00 IST"
          sort="name"
        />
      </TableArea>
      </>
      )}
      {create.value ? <CreatePlanDialog ctx={ctx} closing={create.closing} onClose={create.close} onCreated={id => { create.close(); onOpen(id); }} /> : null}
    </Page>
  );
}

type Tab = 'runbook' | 'ready' | 'dns' | 'versions' | 'doc' | 'runs';

function PlanPage({ ctx, rb, onBack }: { ctx: Ctx; rb: Runbook; onBack: () => void }) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('runbook');
  const [draft, setDraft] = useState<RStage[] | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [diffV, setDiffV] = useState<number | null>(null);
  const editStep = useClosable<{ stage: string; step: RStep }>();
  const failover = useClosable<'Test' | 'Planned' | 'Unplanned'>();
  const failback = useClosable<boolean>();
  const run = s.drRuns[rb.id];
  const live = run && (run.state === 'run' || run.state === 'wait');
  const view: Runbook = draft ? { ...rb, stages: draft } : rb;
  const cfg = ctx.can('configure', 'Editing a recovery plan');
  const op = ctx.can('operate', 'Running a recovery plan');
  const { checks, score } = readiness(view);
  const dr = dryRun(view);
  const editable = cfg.ok && !live;
  const atRecovery = serversOf(rb).some(id => wl(id)?.dr.s === 'online');
  const unread = score == null;
  const busyWhy = live ? 'A run is in progress.' : undefined;

  const change = (stages: RStage[]) => {
    setDraft(stages);
    setFindings(null);
  };
  const save = () => {
    if (!draft) return;
    const before = rb.stages.flatMap(x => x.steps).length;
    const after = draft.flatMap(x => x.steps).length;
    update(st => {
      const r = st.runbooks.find(x => x.id === rb.id)!;
      r.stages = draft;
      r.version += 1;
      r.versions.unshift({ v: r.version, when: ctx.now(), by: 'priya.raman', note: after === before ? 'Reordered or edited steps' : after > before ? `Added ${plural(after - before, 'step')}` : `Removed ${plural(before - after, 'step')}`, diff: [['Steps', String(before), String(after)], ['Stages', String(rb.stages.length), String(draft.length)]] });
      r.validated = null;
    });
    audit({ who: 'priya.raman', customer: rb.customer, what: 'Saved a recovery plan', object: `${rb.name} v${rb.version + 1}`, when: ctx.now(), r: 'ok' });
    ctx.toast(`${rb.name} saved as version ${rb.version + 1}`, 'ok');
    setDraft(null);
  };
  const validate = () => {
    setChecking(true);
    setFindings(null);
    window.setTimeout(() => {
      const r = dryRun(view);
      setFindings(r.findings);
      setChecking(false);
      if (!draft) update(st => { st.runbooks.find(x => x.id === rb.id)!.validated = ctx.now(); });
    }, 700);
  };
  const addStep = (stage: string, kind: StepKind) => editStep.open({ stage, step: newStep(kind, rb) });
  const applyStep = (x: RStep) => {
    const v = editStep.value!;
    const stages = JSON.parse(JSON.stringify(view.stages)) as RStage[];
    const st = stages.find(y => y.id === v.stage)!;
    if (x.id.startsWith('new')) st.steps.push({ ...x, id: 's' + Date.now() });
    else st.steps = st.steps.map(y => (y.id === x.id ? x : y));
    change(stages);
    editStep.close();
  };
  const errs = (findings || []).filter(f => f.level === 'err').length;
  const warns = (findings || []).filter(f => f.level === 'warn').length;

  return (
    <Page>
      <div style={{ flex: 'none', padding: '12px 24px 0' }}>
        <Btn kind="ghost" size="sm" icon="chevron-left" onClick={onBack}>
          Recovery plans
        </Btn>
      </div>
      <PageHeader
        kicker={`Recovery plan · ${custName(rb.customer)} · version ${rb.version}${draft ? ' · unsaved changes' : ''}`}
        title={rb.name}
        sub={
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 16, font: '13px/18px var(--f-ui)' }}>
            <span>{rb.from} → {rb.to}</span>
            <span>{plural(serversOf(view).length, 'server')} in {plural(view.stages.length, 'stage')}</span>
            <span>RTO target {rb.rtoTarget}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Meter score={score} width={48} />
              {unread ? <em style={{ color: 'var(--tx-3)' }}>Readiness not read</em> : `Readiness ${score} %`}
            </span>
          </span>
        }
        actions={
          <>
            {draft ? (
              <>
                <Btn kind="ghost" onClick={() => { setDraft(null); setFindings(null); }}>
                  Discard changes
                </Btn>
                <Btn kind="primary" icon="check" perm={cfg} onClick={save}>
                  Save as version {rb.version + 1}
                </Btn>
              </>
            ) : (
              <>
                <CopyCurl ctx={ctx} method="POST" path={`/recovery-plans/${rb.id}/test`} body={{ network: rb.testNet }} />
                <Btn kind="outline" icon={checking ? 'loader-circle' : 'list'} spin={checking} onClick={validate} disabled={checking}>
                  Dry run
                </Btn>
                <Btn kind="outline" icon="flask-conical" perm={op} disabled={!!run || unread} why={busyWhy || (run ? 'Clean up the last run first.' : unread ? `${rb.to} could not be read.` : undefined)} onClick={() => failover.open('Test')}>
                  Test failover…
                </Btn>
                {atRecovery && !run ? (
                  <Btn kind="primary" icon="undo-2" perm={op} onClick={() => failback.open(true)}>
                    Return to primary…
                  </Btn>
                ) : (
                  <Btn kind="dangerSolid" icon="zap" perm={op} disabled={!!run || unread || atRecovery} why={busyWhy || (run ? 'Clean up the last run first.' : unread ? `${rb.to} could not be read.` : 'Already at the recovery site.')} onClick={() => failover.open('Planned')}>
                    Fail over…
                  </Btn>
                )}
              </>
            )}
          </>
        }
      />
      <Tabs
        label="Plan sections"
        value={tab}
        onChange={setTab}
        style={{ margin: '0 24px 16px', padding: 0 }}
        tabs={[
          { v: 'runbook', label: 'Runbook', icon: 'workflow' },
          { v: 'ready', label: 'Readiness', count: unread ? '' : checks.filter(c => c.state !== 'pass').length },
          { v: 'dns', label: 'DNS', icon: 'network' },
          { v: 'versions', label: 'Versions', count: rb.versions.length },
          { v: 'doc', label: 'Document', icon: 'file-check' },
          { v: 'runs', label: 'Runs and drills', count: s.drills.filter(d => d.plan === rb.id).length }
        ]}
      />
      <div key={tab} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'ae-fade 150ms var(--ease)' }}>
        {tab === 'runbook' ? (
          <>
            {run ? <RunPanel ctx={ctx} rb={rb} run={run} onFailback={() => failback.open(true)} /> : null}
            {checking ? <Bar tone="run">Dry run: checking every step without starting anything…</Bar> : null}
            {findings ? (
              findings.length ? (
                <Bar tone={errs ? 'err' : 'warn'} multiline actions={<Btn kind="ghost" size="sm" onClick={() => setFindings(null)}>Hide</Btn>}>
                  Dry run found {[errs ? plural(errs, 'problem') : '', warns ? plural(warns, 'warning') : ''].filter(Boolean).join(' and ')}. They are marked on the steps below. Estimated time {fmtMin(dr.estimate)} of {rb.rtoTarget}.
                </Bar>
              ) : (
                <Bar tone="ok" actions={<Btn kind="ghost" size="sm" onClick={() => setFindings(null)}>Hide</Btn>}>
                  Dry run passed: {plural(dr.steps, 'step')}, {plural(dr.servers, 'server')}, about {fmtMin(dr.estimate)} of {rb.rtoTarget}. Nothing was started.
                </Bar>
              )
            ) : null}
            {live ? <Bar tone="info" icon="pencil">Editing is paused while the plan runs.</Bar> : null}
            <Canvas rb={view} run={run} findings={findings} editable={editable} onChange={change} onEditStep={(stage, step) => editStep.open({ stage, step })} onAddStep={addStep} />
            <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>
              <section>
                <H3>Boot order</H3>
                <MiniTable
                  label="Boot order"
                  cols={[{ label: '#', w: '28px' }, { label: 'Server' }, { label: 'Stage', w: '150px' }, { label: 'Newest point', w: '112px', r: true }]}
                  rows={view.stages.flatMap((st, si) => st.steps.filter(x => x.kind === 'boot').map(x => ({ x, st, si }))).map(({ x, st, si }, i) => {
                    const w = wl(x.w);
                    return [String(i + 1), <Go key="w" ctx={ctx} to="workloads" id={w?.id}>{w?.name || x.w}</Go>, `${si + 1}. ${st.name}`, w?.dr.s === 'unreach' ? <em key="a" style={{ color: 'var(--tx-3)' }}>Not read</em> : w?.dr.age || '—'];
                  })}
                  empty="No servers yet. Add a Start a server step to a stage."
                />
              </section>
              <section>
                <H3>Plan settings</H3>
                <Facts
                  labelW={150}
                  items={[
                    { k: 'Primary site', v: rb.from },
                    { k: 'Recovery site', v: rb.to },
                    { k: 'Test network', v: rb.testNet, icon: 'circle-check', tone: 'ok' },
                    { k: 'RTO target', v: rb.rtoTarget },
                    { k: 'Applications', v: appsOf(rb).map(a => a.name).join(', ') || 'None linked', muted: !appsOf(rb).length },
                    { k: 'Approval', v: `${rb.approval}; tests never need one` },
                    { k: 'Owner', v: rb.owner },
                    { k: 'Last dry run', v: rb.validated || 'Not since the last change', muted: !rb.validated }
                  ]}
                />
              </section>
            </div>
          </>
        ) : null}
        {tab === 'ready' ? (
          <>
            {unread ? <Bar tone="warn" multiline>Could not be read: {rb.to} did not answer within 30 s. Readiness is not shown as ready or as zero until it can be read.</Bar> : null}
            <MiniTable
              label="Readiness checks"
              cols={[{ label: 'Check', w: '230px' }, { label: 'Object', w: '200px' }, { label: 'Result' }]}
              rows={checks.map(c => [
                <Status key="c" icon={c.state === 'pass' ? 'circle-check' : c.state === 'warn' ? 'triangle-alert' : c.state === 'unread' ? 'triangle-alert' : 'circle-x'} tone={c.state === 'pass' ? 'ok' : c.state === 'block' ? 'err' : 'warn'} label={c.label} />,
                c.obj,
                <span key="r" data-tip={c.result} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: c.state === 'pass' ? 'var(--tx-2)' : 'var(--tx)' }}>{c.result}</span>
              ])}
            />
            <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Checked every day at 06:00 IST and before every run. A failed sync or a server that is not replicated lowers the score the most.</p>
          </>
        ) : null}
        {tab === 'versions' ? (
          diffV != null ? (
            <>
              <Btn kind="ghost" icon="chevron-left" onClick={() => setDiffV(null)} style={{ alignSelf: 'flex-start' }}>
                All versions
              </Btn>
              <H3>Version {diffV - 1} → {diffV}</H3>
              <MiniTable label="Changes" cols={[{ label: 'What', w: '180px' }, { label: 'Before' }, { label: 'After' }]} rows={rb.versions.find(x => x.v === diffV)!.diff.map(([k, a, b]) => [k, <span key="a" style={{ color: 'var(--err)', textDecoration: 'line-through' }}>{a}</span>, <span key="b" style={{ color: 'var(--ok)' }}>{b}</span>])} />
              <div>
                <Btn kind="outline" icon="undo-2" perm={cfg} onClick={() => { update(st => { const r = st.runbooks.find(x => x.id === rb.id)!; r.version += 1; r.versions.unshift({ v: r.version, when: ctx.now(), by: 'priya.raman', note: `Restored version ${diffV - 1}`, diff: [] }); }); audit({ who: 'priya.raman', customer: rb.customer, what: `Restored version ${diffV - 1} of a recovery plan`, object: rb.name, when: ctx.now(), r: 'ok' }); ctx.toast(`Version ${diffV - 1} restored as version ${rb.version + 1}`, 'ok'); setDiffV(null); }}>
                  Restore version {diffV - 1}
                </Btn>
              </div>
            </>
          ) : (
            <MiniTable
              label="Versions"
              cols={[{ label: 'Version', w: '72px' }, { label: 'Change' }, { label: 'By', w: '190px' }, { label: 'When', w: '176px' }]}
              rows={[...(draft ? [[<em key="d">Draft</em>, <em key="n" style={{ color: 'var(--tx-2)' }}>Unsaved changes</em>, 'priya.raman', 'Now']] : []), ...rb.versions.map(x => [`v${x.v}${x.v === rb.version ? ' · current' : ''}`, x.note, x.by, x.when])]}
              onRow={i => {
                const x = rb.versions[i - (draft ? 1 : 0)];
                if (x && x.diff.length) setDiffV(x.v);
              }}
            />
          )
        ) : null}
        {tab === 'dns' ? (
          <DnsMapping
            ctx={ctx}
            rb={view}
            onAddStep={(record, value) => {
              if (!editable) return ctx.toast(live ? 'Editing is paused while the plan runs.' : 'You cannot edit this plan.', 'warn');
              const last = view.stages[view.stages.length - 1];
              setTab('runbook');
              editStep.open({ stage: last.id, step: { ...newStep('dns', rb), record, value } });
            }}
          />
        ) : null}
        {tab === 'doc' ? <RunbookDocument ctx={ctx} rb={view} draft={!!draft} /> : null}
        {tab === 'runs' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Reconciliations ctx={ctx} rb={rb} />
          <MiniTable
            label="Runs and drills"
            cols={[{ label: 'When', w: '176px' }, { label: 'Kind', w: '150px' }, { label: 'Result', w: '150px' }, { label: 'Took', w: '120px' }, { label: 'By', w: '190px' }, { label: 'Evidence' }]}
            rows={s.drills.filter(d => d.plan === rb.id).map(d => [d.when, d.kind, <Status key="r" icon={d.r === 'ok' ? 'circle-check' : d.r === 'warn' ? 'triangle-alert' : 'circle-x'} tone={d.r} label={d.r === 'ok' ? 'Passed' : d.r === 'warn' ? 'Passed, warnings' : 'Failed'} />, <span key="t" data-tip={d.rtoMet ? `Within the RTO target of ${rb.rtoTarget}` : `Over the RTO target of ${rb.rtoTarget}`}>{d.dur}</span>, d.by, <span key="e" data-tip={d.evidence} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.evidence}</span>])}
            empty="Never run. Test the plan on the isolated network to record its first drill."
          />
          </div>
        ) : null}
      </div>
      {editStep.value ? <StepDialog key={editStep.value.step.id} rb={view} step={editStep.value.step} closing={editStep.closing} onClose={editStep.close} onSave={applyStep} /> : null}
      {failover.value ? <FailoverDialog ctx={ctx} rb={rb} initial={failover.value} closing={failover.closing} onClose={failover.close} /> : null}
      {failback.value ? <FailbackDialog ctx={ctx} rb={rb} closing={failback.closing} onClose={failback.close} /> : null}
    </Page>
  );
}

/** The runbook as a document people can read during an incident, generated from the plan. */
function RunbookDocument({ ctx, rb, draft }: { ctx: Ctx; rb: Runbook; draft: boolean }) {
  const lines: string[] = [];
  let n = 0;
  rb.stages.forEach((st, si) => {
    lines.push(`Stage ${si + 1}: ${st.name}`);
    st.steps.forEach(x => {
      const [t, d] = stepText(x, rb, 'Planned');
      lines.push(`  ${++n}. ${t}. ${d}`);
    });
  });
  const text = [
    `${rb.name} — recovery runbook, version ${rb.version}${draft ? ' (draft)' : ''}`,
    `Customer: ${custName(rb.customer)} · ${rb.from} → ${rb.to} · RTO target ${rb.rtoTarget}`,
    `Owner: ${rb.owner} · Approval: ${rb.approval}`,
    '',
    ...lines
  ].join('\n');
  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => ctx.toast('Runbook copied as text', 'ok'),
      () => ctx.toast('Copy is blocked here. Select the document and copy it yourself.', 'warn')
    );
  };
  const apps = appsOf(rb);
  const sec = { display: 'flex', flexDirection: 'column' as const, gap: 8 };
  const h = { font: '500 18px/26px var(--f-head)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toolbar style={{ padding: 0 }}>
        <span style={{ color: 'var(--tx-2)' }}>Generated from version {rb.version}{draft ? ' with your unsaved changes' : ''}. It changes when the plan changes.</span>
        <Spacer />
        <Btn kind="outline" icon="copy" onClick={copy}>
          Copy as text
        </Btn>
        <Btn kind="outline" icon="download" onClick={() => { audit({ who: 'priya.raman', customer: rb.customer, what: 'Exported a runbook document', object: `${rb.name} v${rb.version}`, when: ctx.now(), r: 'ok' }); ctx.toast(`RB-${rb.id}-v${rb.version}.pdf saved to Reports › Evidence`, 'ok'); }}>
          Export PDF
        </Btn>
      </Toolbar>
      <article style={{ maxWidth: 820, background: 'var(--panel)', border: '1px solid var(--ln)', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24, userSelect: 'text' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid var(--ln)', paddingBottom: 16 }}>
          <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Recovery runbook · {custName(rb.customer)} · version {rb.version}{draft ? ' (draft)' : ''}</span>
          <h2 style={{ font: '500 24px/32px var(--f-head)' }}>{rb.name}</h2>
          <span style={{ color: 'var(--tx-2)' }}>Generated {ctx.now()} by Host360 Aegis. Times are in India Standard Time.</span>
        </header>
        <section style={sec}>
          <h3 style={h}>1. Purpose and scope</h3>
          <p>Brings {apps.length ? apps.map(a => a.name).join(' and ') : 'the servers below'} back at {rb.to} when {rb.from} cannot run them. The target is to be running again within {rb.rtoTarget}.</p>
          <Facts labelW={170} items={[{ k: 'Servers', v: serversOf(rb).map(id => wl(id)?.name).join(', ') }, { k: 'Primary site', v: rb.from }, { k: 'Recovery site', v: rb.to }, { k: 'Test network', v: rb.testNet }]} />
        </section>
        <section style={sec}>
          <h3 style={h}>2. People and approval</h3>
          <p>Plan owner: {rb.owner}. {rb.approval}; the approver confirms with their own MFA code, or approves the request in their Inbox. The person who starts a failover cannot approve it. Tests never need approval.</p>
        </section>
        <section style={sec}>
          <h3 style={h}>3. Before you start</h3>
          <p>Aegis runs these checks for you when you start a failover; they are listed so you can check by hand if the console is not available.</p>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>{rb.to} answers and its credentials are valid.</li>
            <li>The newest recovery point of each server is within its target, or you accept the data loss.</li>
            <li>There is room at {rb.to} for {serversOf(rb).length * 8} vCPU and {serversOf(rb).length * 32} GB.</li>
            <li>DNS records the plan changes have a TTL of 60 s or less.</li>
          </ul>
        </section>
        <section style={sec}>
          <h3 style={h}>4. Steps</h3>
          {rb.stages.map((st, si) => (
            <div key={st.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h4 style={{ fontWeight: 600 }}>Stage {si + 1}: {st.name}</h4>
              <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }} start={rb.stages.slice(0, si).reduce((a, x) => a + x.steps.length, 0) + 1}>
                {st.steps.map(x => {
                  const [t, d] = stepText(x, rb, 'Planned');
                  return (
                    <li key={x.id}>
                      <strong style={{ fontWeight: 600 }}>{t}.</strong> <span style={{ color: 'var(--tx-2)' }}>{d}</span>
                      {x.kind === 'script' && x.body ? <pre style={{ margin: '6px 0 0', padding: '8px 10px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/18px var(--f-ui)', whiteSpace: 'pre-wrap' }}>{x.body}</pre> : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>
        <section style={sec}>
          <h3 style={h}>5. If a step fails</h3>
          <p>Each check says what happens when it fails: stop the run, ask a person, or continue. A stopped run leaves started servers running; fix the cause, then run the remaining stages as a partial failover.</p>
        </section>
        <section style={sec}>
          <h3 style={h}>6. Returning to {rb.from}</h3>
          <p>From the plan page, choose Return to primary. Aegis copies what changed at {rb.to} back to {rb.from}, shuts the copies down and starts the servers at {rb.from} in reverse stage order.</p>
        </section>
        <section style={sec}>
          <h3 style={h}>7. Sign-off</h3>
          <MiniTable label="Sign-off" cols={[{ label: 'Role', w: '200px' }, { label: 'Name' }, { label: 'Signed', w: '176px' }]} rows={[['Plan owner', rb.owner, rb.lastTest ? rb.lastTest.when : '—'], ['Approver', rb.customer === 'mer' ? 'Anitha Krishnan' : rb.customer === 'kav' ? 'Rahul Menon' : 'Arun Kumar', rb.lastTest ? rb.lastTest.when : '—']]} />
        </section>
      </article>
    </div>
  );
}

function CreatePlanDialog({ ctx, closing, onClose, onCreated }: { ctx: Ctx; closing: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const custs = CUSTOMERS.filter(c => scopeCustomers(ctx).includes(c.id) && c.products.includes('Resilience'));
  const [name, setName] = useState('');
  const [cust, setCust] = useState(custs[0]?.id || 'h360');
  const [from, setFrom] = useState('Chennai-proxmox-prod');
  const [to, setTo] = useState('production-openstack');
  const [tpl, setTpl] = useState('three');
  const t = RUNBOOK_TEMPLATES.find(x => x.id === tpl)!;
  const err = !name.trim() ? 'Name the plan.' : from === to ? 'The recovery site must differ from the primary site.' : null;
  const create = () => {
    const id = 'rb' + Date.now();
    update(st => {
      st.runbooks.push({ id, name: name.trim(), customer: cust, apps: [], from, to, testNet: to === 'production-openstack' ? 'dr-test-isolated' : to === 'Chennai-proxmox-prod' ? 'vmbr99 (VLAN 99, isolated)' : 'test-isolated (region-2-os)', rtoTarget: '4 h', approval: 'Every failover needs a Failover Approver', owner: 'Priya Raman', version: 1, versions: [{ v: 1, when: ctx.now(), by: 'priya.raman', note: `Created from the ${t.name} template`, diff: [] }], lastTest: null, nextDrill: '21 Jan 2027, 22:00 IST', validated: null, stages: t.stages.map((n, i) => ({ id: `${id}-${i}`, name: n, steps: [] })) });
    });
    audit({ who: 'priya.raman', customer: cust, what: 'Created a recovery plan', object: name.trim(), when: ctx.now(), r: 'ok', note: `Template: ${t.name}` });
    ctx.toast(`Recovery plan ${name.trim()} created. Add servers to its stages.`, 'ok');
    onCreated(id);
  };
  const sites = ['Chennai-proxmox-prod', 'Chennai vCenter', 'production-openstack', 'region-2-os', 'Mumbai DC2'];
  return (
    <Dialog
      size="lg"
      title="Create a recovery plan"
      sub="Start from a template; it lays out the stages in a sensible boot order."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="check" disabled={!!err} why={err || undefined} perm={ctx.can('configure', 'Creating a recovery plan')} onClick={create}>
            Create plan
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="cp-name" label="Name">
          <TextInput id="cp-name" value={name} onChange={setName} placeholder="CRM failover" />
        </Field>
        <Field id="cp-cust" label="Customer">
          <SelectInput id="cp-cust" value={cust} onChange={setCust} options={custs.map(c => ({ v: c.id, label: c.name }))} />
        </Field>
        <Field id="cp-from" label="Primary site">
          <SelectInput id="cp-from" value={from} onChange={setFrom} options={sites} />
        </Field>
        <Field id="cp-to" label="Recovery site" hint={to === 'region-2-os' ? 'region-2-os could not be read at 14:52 IST; readiness stays unknown until it answers.' : undefined}>
          <SelectInput id="cp-to" value={to} onChange={setTo} options={sites.filter(x => x !== 'Chennai vCenter' && x !== 'Mumbai DC2')} />
        </Field>
      </div>
      <div role="radiogroup" aria-label="Template" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        {RUNBOOK_TEMPLATES.map(x => (
          <RadioCard key={x.id} on={tpl === x.id} onClick={() => setTpl(x.id)} title={x.name} note={x.note} />
        ))}
      </div>
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="workflow" />
        Stages: {t.stages.join(' → ')}
      </p>
    </Dialog>
  );
}

