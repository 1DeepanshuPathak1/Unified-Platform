import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { pc } from '../../lib/pseudo';
import { Btn, Field, IconBtn, SelectInput, TextArea, TextInput } from '../../ui/controls';
import { Dialog } from '../../ui/overlay';
import { DR_INFO, fmtMin, wl, type GateCheck, type OnFail, type RStage, type RStep, type Runbook, type StepKind } from './data';
import { stepText, type DrRun } from './runner';
import { WORKLOADS } from '../../data/platform';

export const KIND_ICON: Record<StepKind, string> = { boot: 'power', delay: 'hourglass', gate: 'heart-pulse', script: 'square-terminal', manual: 'hand', dns: 'network', lb: 'split' };
export const KIND_NAME: Record<StepKind, string> = { boot: 'Start a server', delay: 'Wait', gate: 'Health gate', script: 'Run a script', manual: 'Manual step', dns: 'Update DNS', lb: 'Update a load balancer' };
const KIND_NOTE: Record<StepKind, string> = {
  boot: 'Starts a replicated server from its newest point. Servers in one stage start together.',
  delay: 'Pauses before the next step.',
  gate: 'Checks a port, URL, ping or query. The run stops, asks a person or continues if it fails.',
  script: 'PowerShell or Bash on the orchestrator or on a recovered server.',
  manual: 'Waits until a named person confirms they did something.',
  dns: 'Changes a record in the customer DNS. Skipped in tests.',
  lb: 'Changes the members of a load balancer pool. Skipped in tests.'
};

/** Which servers must be running before another one starts. Used by the dry run. */
const DEPENDS: Record<string, string[]> = {
  'erp-app-01': ['erp-db-01', 'sql-prod-02'],
  'mail-gw-01': ['ad-dc-01'],
  'erp-db-01': ['ad-dc-01'],
  'sql-prod-02': ['ad-dc-01'],
  'rpt-app-01': ['sql01'],
  'kav-tally-01': ['kav-wms-db'],
  'payments-api': ['cbs-db-01']
};

export type Finding = { step?: string; stage?: string; level: 'err' | 'warn'; text: string };

/** The dry run: checks the runbook without starting anything. */
export function dryRun(rb: Runbook): { findings: Finding[]; estimate: number; steps: number; servers: number } {
  const findings: Finding[] = [];
  const stageOf: Record<string, number> = {};
  rb.stages.forEach((st, i) => st.steps.forEach(x => x.kind === 'boot' && x.w && (stageOf[x.w] = i)));
  let est = 0;
  rb.stages.forEach((st, i) => {
    if (!st.steps.length) findings.push({ stage: st.id, level: 'warn', text: `Stage ${i + 1} has no steps.` });
    const boots = st.steps.filter(x => x.kind === 'boot');
    if (boots.length) est += 150;
    st.steps.forEach(x => {
      if (x.kind === 'boot') {
        const w = wl(x.w);
        if (!w) findings.push({ step: x.id, level: 'err', text: 'Choose a server.' });
        else if (!DR_INFO[w.id] || w.dr.s === 'none') findings.push({ step: x.id, level: 'err', text: `${w.name} is not replicated, so it cannot start at the recovery site.` });
        else {
          if (w.dr.s === 'failed') findings.push({ step: x.id, level: 'warn', text: `Last sync failed: ${w.name} would start from a point ${w.dr.age} old.` });
          else if (w.dr.s === 'behind') findings.push({ step: x.id, level: 'warn', text: `${w.name} is behind its target: newest point ${w.dr.age} old, target ${w.dr.target}.` });
          (DEPENDS[w.id] || []).forEach(dep => {
            const d = wl(dep);
            if (stageOf[dep] == null) return;
            if (stageOf[dep] >= i) findings.push({ step: x.id, level: 'warn', text: `${w.name} needs ${d?.name} running first, but ${d?.name} starts ${stageOf[dep] === i ? 'in the same stage' : 'later'}.` });
          });
        }
        if (rb.stages.flatMap(s => s.steps).filter(y => y.kind === 'boot' && y.w === x.w).length > 1) findings.push({ step: x.id, level: 'err', text: `${w?.name || 'This server'} is started twice.` });
      }
      if (x.kind === 'gate') {
        est += 20;
        if (!x.target) findings.push({ step: x.id, level: 'err', text: 'Name what to check.' });
        if (x.check === 'Port' && !x.port) findings.push({ step: x.id, level: 'err', text: 'Give the port to check.' });
      }
      if (x.kind === 'script') {
        est += 45;
        if (!x.body?.trim()) findings.push({ step: x.id, level: 'err', text: 'The script is empty.' });
      }
      if (x.kind === 'delay') est += x.secs || 0;
      if (x.kind === 'manual') {
        est += 120;
        if (!x.who) findings.push({ step: x.id, level: 'warn', text: 'Name who does this step, so the run knows whom to wait for.' });
      }
      if (x.kind === 'dns' || x.kind === 'lb') est += 15;
    });
  });
  const servers = rb.stages.flatMap(s => s.steps.filter(x => x.kind === 'boot')).length;
  const steps = rb.stages.reduce((a, s) => a + s.steps.length, 0);
  return { findings, estimate: est / 60, steps, servers };
}

type RunState = 'done' | 'current' | 'wait' | 'todo' | 'skipped' | null;

function runStateOf(run: DrRun | undefined, stepId: string): RunState {
  if (!run) return null;
  const idx = run.flat.findIndex(f => f.step === stepId);
  if (idx < 0) return 'skipped';
  if (run.state === 'done' || idx < run.i) return 'done';
  if (idx === run.i) return run.state === 'wait' ? 'wait' : run.state === 'run' ? 'current' : 'todo';
  return 'todo';
}

/** The visual runbook: stages left to right in boot order, steps top to bottom inside a stage. */
export function Canvas({ rb, run, findings, editable, onChange, onEditStep, onAddStep }: { rb: Runbook; run?: DrRun; findings: Finding[] | null; editable: boolean; onChange: (stages: RStage[]) => void; onEditStep: (stage: string, step: RStep) => void; onAddStep: (stage: string, kind: StepKind) => void }) {
  const [adding, setAdding] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const clone = () => JSON.parse(JSON.stringify(rb.stages)) as RStage[];
  const moveStage = (i: number, d: number) => {
    const st = clone();
    [st[i], st[i + d]] = [st[i + d], st[i]];
    onChange(st);
  };
  const moveStep = (si: number, xi: number, d: number) => {
    const st = clone();
    const arr = st[si].steps;
    [arr[xi], arr[xi + d]] = [arr[xi + d], arr[xi]];
    onChange(st);
  };
  const shiftStep = (si: number, xi: number, d: number) => {
    const st = clone();
    const [x] = st[si].steps.splice(xi, 1);
    st[si + d].steps.push(x);
    onChange(st);
  };
  const removeStep = (si: number, xi: number) => {
    const st = clone();
    st[si].steps.splice(xi, 1);
    onChange(st);
  };
  const removeStage = (si: number) => {
    const st = clone();
    st.splice(si, 1);
    onChange(st);
  };
  const addStage = () => onChange([...clone(), { id: 'st' + Date.now(), name: `Stage ${rb.stages.length + 1}`, steps: [] }]);
  const rename = (si: number, name: string) => {
    const st = clone();
    st[si].name = name;
    onChange(st);
  };
  const cur = run && run.state !== 'done' ? run.flat[run.i] : null;
  return (
    <div role="region" aria-label="Runbook" style={{ flex: 'none', overflowX: 'auto', padding: '16px 16px 20px', background: 'var(--panel-2)', backgroundImage: 'radial-gradient(var(--ln) 1px, transparent 1px)', backgroundSize: '16px 16px', border: '1px solid var(--ln)' }}>
      <ol style={{ listStyle: 'none', padding: 0, display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 'min-content' }}>
        {rb.stages.map((st, si) => {
          const stageFindings = (findings || []).filter(f => f.stage === st.id);
          const active = cur?.stage === st.id;
          const inRun = run ? run.stages.includes(st.id) : true;
          return (
            <li key={st.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <section aria-label={`Stage ${si + 1}: ${st.name}`} style={{ width: 248, flex: 'none', background: 'var(--panel)', border: `1px solid ${active ? 'var(--acc)' : 'var(--ln-2)'}`, boxShadow: active ? 'inset 0 0 0 1px var(--acc)' : 'none', opacity: inRun ? 1 : 0.5, transition: 'border-color 150ms, opacity 150ms' }}>
                <header style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 4px 0 10px', borderBottom: '1px solid var(--ln)' }}>
                  <span style={{ width: 20, height: 20, flex: 'none', display: 'grid', placeItems: 'center', background: active ? 'var(--acc)' : 'transparent', border: '1px solid var(--acc)', color: active ? 'var(--acc-ink)' : 'var(--acc-tx)', font: '700 11px var(--f-ui)' }}>{si + 1}</span>
                  {renaming === st.id ? (
                    <input
                      autoFocus
                      aria-label="Stage name"
                      defaultValue={st.name}
                      onBlur={e => { rename(si, e.target.value.trim() || st.name); setRenaming(null); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }}
                      style={{ flex: 1, minWidth: 0, height: 28, padding: '0 6px', background: 'var(--panel-2)', border: '1px solid var(--acc)', font: '600 14px var(--f-body)' }}
                    />
                  ) : (
                    <button type="button" disabled={!editable} onClick={() => setRenaming(st.id)} data-tip={editable ? 'Rename the stage' : undefined} style={{ flex: 1, minWidth: 0, textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {st.name}
                    </button>
                  )}
                  {editable ? (
                    <>
                      <IconBtn icon="chevron-left" size={24} label="Move stage earlier" perm={si === 0 ? { ok: false, why: 'Already first.', op: 0.45 } : undefined} onClick={() => moveStage(si, -1)} />
                      <IconBtn icon="chevron-right" size={24} label="Move stage later" perm={si === rb.stages.length - 1 ? { ok: false, why: 'Already last.', op: 0.45 } : undefined} onClick={() => moveStage(si, 1)} />
                      <IconBtn icon="trash-2" size={24} label={`Remove stage ${st.name}`} onClick={() => removeStage(si)} />
                    </>
                  ) : null}
                </header>
                <ol style={{ listStyle: 'none', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 56 }}>
                  {st.steps.map((x, xi) => {
                    const [title, detail] = stepText(x, rb, run?.kind);
                    const f = (findings || []).filter(y => y.step === x.id);
                    const lvl = f.some(y => y.level === 'err') ? 'err' : f.length ? 'warn' : null;
                    const rs = runStateOf(run, x.id);
                    const rsIcon = rs === 'done' ? 'circle-check' : rs === 'current' ? 'loader-circle' : rs === 'wait' ? 'hand' : null;
                    return (
                      <li key={x.id} className={`ae-step ${pc('hover', 'border-color:var(--ln-2)')}`} style={{ position: 'relative', border: `1px solid ${lvl ? `var(--${lvl})` : rs === 'current' || rs === 'wait' ? 'var(--acc)' : 'var(--ln)'}`, background: rs === 'current' || rs === 'wait' ? 'var(--acc-soft)' : 'var(--panel-2)', transition: 'border-color 100ms, background-color 150ms' }}>
                        <button type="button" disabled={!editable} onClick={() => onEditStep(st.id, x)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '16px minmax(0,1fr)', gap: 8, padding: '8px 10px', textAlign: 'left', cursor: editable ? 'pointer' : 'default' }}>
                          <Icon name={rsIcon || KIND_ICON[x.kind]} spin={rs === 'current'} style={{ color: rs === 'done' ? 'var(--ok)' : rs === 'current' ? 'var(--run)' : rs === 'wait' ? 'var(--warn)' : 'var(--tx-2)', marginTop: 1 }} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: 13, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: editable ? 52 : 0 }}>{title}</span>
                            <span data-tip={detail} data-tip-overflow="" style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.kind === 'boot' ? bootSub(x) : detail}</span>
                            {f.map((y, i) => (
                              <span key={i} style={{ display: 'flex', gap: 6, marginTop: 4, font: '12px/16px var(--f-ui)', color: `var(--${y.level})` }}>
                                <Icon name={y.level === 'err' ? 'circle-x' : 'triangle-alert'} size={12} style={{ marginTop: 2 }} />
                                <span style={{ color: 'var(--tx)' }}>{y.text}</span>
                              </span>
                            ))}
                          </span>
                        </button>
                        {editable ? (
                          <span className="ae-step-tools" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', background: 'var(--panel-2)' }}>
                            {xi > 0 ? <IconBtn icon="chevron-up" size={22} iconSize={14} label="Move up" onClick={() => moveStep(si, xi, -1)} /> : si > 0 ? <IconBtn icon="chevron-left" size={22} iconSize={14} label="Move to the previous stage" onClick={() => shiftStep(si, xi, -1)} /> : null}
                            {xi < st.steps.length - 1 ? <IconBtn icon="chevron-down" size={22} iconSize={14} label="Move down" onClick={() => moveStep(si, xi, 1)} /> : si < rb.stages.length - 1 ? <IconBtn icon="chevron-right" size={22} iconSize={14} label="Move to the next stage" onClick={() => shiftStep(si, xi, 1)} /> : null}
                            <IconBtn icon="x" size={22} iconSize={14} label={`Remove ${title}`} onClick={() => removeStep(si, xi)} />
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                  {!st.steps.length ? <li style={{ padding: '10px 4px', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', fontStyle: 'italic' }}>No steps yet.</li> : null}
                  {stageFindings.map((y, i) => (
                    <li key={'f' + i} style={{ display: 'flex', gap: 6, font: '12px/16px var(--f-ui)' }}>
                      <Icon name="triangle-alert" size={12} style={{ color: 'var(--warn)', marginTop: 2 }} />
                      {y.text}
                    </li>
                  ))}
                  {editable ? (
                    <li style={{ position: 'relative' }}>
                      <Btn kind="ghost" size="sm" icon="plus" onClick={() => setAdding(adding === st.id ? null : st.id)} style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--acc-tx)' }}>
                        Add a step
                      </Btn>
                      {adding === st.id ? (
                        <div role="menu" aria-label="Step kinds" style={{ position: 'absolute', left: 0, right: 0, top: 30, zIndex: 5, background: 'var(--overlay)', border: '1px solid var(--ln-2)', boxShadow: 'var(--sh-menu)', padding: 4, animation: 'ae-fade 120ms var(--ease)' }}>
                          {(Object.keys(KIND_NAME) as StepKind[]).map(k => (
                            <button key={k} type="button" role="menuitem" data-tip={KIND_NOTE[k]} onClick={() => { setAdding(null); onAddStep(st.id, k); }} className={pc('hover', 'background:var(--hover)')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 8px', textAlign: 'left' }}>
                              <Icon name={KIND_ICON[k]} style={{ color: 'var(--tx-2)' }} />
                              {KIND_NAME[k]}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ) : null}
                </ol>
              </section>
              <span aria-hidden="true" style={{ alignSelf: 'stretch', width: 32, flex: 'none', display: 'grid', placeItems: 'start center', paddingTop: 12, color: 'var(--tx-3)' }}>
                {si < rb.stages.length - 1 || editable ? <Icon name="arrow-right" /> : null}
              </span>
            </li>
          );
        })}
        {editable ? (
          <li>
            <button type="button" onClick={addStage} className={pc('hover', 'border-color:var(--acc);color:var(--acc-tx)')} style={{ width: 160, height: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px dashed var(--ln-2)', color: 'var(--tx-2)', fontWeight: 600, transition: 'border-color 100ms, color 100ms' }}>
              <Icon name="plus" />
              Add a stage
            </button>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

function bootSub(x: RStep) {
  const w = wl(x.w);
  if (!w) return 'No server chosen';
  const info = DR_INFO[w.id];
  if (!info || w.dr.s === 'none') return 'Not replicated';
  if (w.dr.s === 'unreach') return 'Newest point could not be read';
  if (w.dr.s === 'online') return 'Running at the recovery site';
  if (w.dr.s === 'returning') return 'Returning to the primary site';
  return w.dr.age ? `${w.type} · newest point ${w.dr.age} old` : `${w.type} · no recovery point yet`;
}

/** Edit one step. Opened from the canvas; changes apply to the draft, saved with the plan. */
export function StepDialog({ rb, step, closing, onClose, onSave }: { rb: Runbook; step: RStep; closing: boolean; onClose: () => void; onSave: (x: RStep) => void }) {
  const [x, setX] = useState<RStep>({ ...step });
  const set = (p: Partial<RStep>) => setX(v => ({ ...v, ...p }));
  const candidates = WORKLOADS.filter(w => w.customer === rb.customer && w.dr.s !== 'na' && w.type !== 'DNS record' && w.type !== 'Load balancer');
  const used = new Set(rb.stages.flatMap(s => s.steps.filter(y => y.kind === 'boot' && y.id !== step.id).map(y => y.w)));
  const err =
    x.kind === 'boot' && !x.w ? 'Choose a server.' : x.kind === 'gate' && !x.target ? 'Name what to check.' : x.kind === 'script' && !x.body?.trim() ? 'Write the script.' : x.kind === 'manual' && !x.text?.trim() ? 'Say what the person does.' : x.kind === 'dns' && (!x.record || !x.value) ? 'Give the record and its new value.' : null;
  const fail = (
    <Field id="sd-fail" label="If it fails">
      <SelectInput id="sd-fail" value={x.onFail || 'Stop the run'} onChange={v => set({ onFail: v as OnFail })} options={['Stop the run', 'Ask a person', 'Continue']} />
    </Field>
  );
  return (
    <Dialog
      title={`${step.id.startsWith('new') ? 'Add' : 'Edit'}: ${KIND_NAME[x.kind]}`}
      sub={KIND_NOTE[x.kind]}
      closing={closing}
      onClose={onClose}
      footNote="Changes go into the draft. Save the plan to make a new version."
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="check" disabled={!!err} why={err || undefined} onClick={() => onSave(x)}>
            {step.id.startsWith('new') ? 'Add step' : 'Apply'}
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        {x.kind === 'boot' ? (
          <>
            <Field id="sd-w" label="Server" span={2} hint={x.w ? bootSub(x) : 'Only servers of this plan’s customer are listed.'}>
              <SelectInput id="sd-w" value={x.w || ''} onChange={v => set({ w: v })} options={[{ v: '', label: 'Choose a server' }, ...candidates.map(w => ({ v: w.id, label: `${w.name}${DR_INFO[w.id] && w.dr.s !== 'none' ? '' : ' · not replicated'}${used.has(w.id) ? ' · already in the plan' : ''}`, disabled: used.has(w.id) }))]} />
            </Field>
            <Field id="sd-to" label="Wait for the console up to (min)">
              <TextInput id="sd-to" value={String(Math.round((x.timeout || 600) / 60))} onChange={v => set({ timeout: (+v.replace(/\D/g, '') || 1) * 60 })} inputMode="numeric" />
            </Field>
            {fail}
          </>
        ) : null}
        {x.kind === 'delay' ? (
          <Field id="sd-s" label="Seconds">
            <TextInput id="sd-s" value={String(x.secs || 60)} onChange={v => set({ secs: +v.replace(/\D/g, '') || 0 })} inputMode="numeric" />
          </Field>
        ) : null}
        {x.kind === 'gate' ? (
          <>
            <Field id="sd-c" label="Check">
              <SelectInput id="sd-c" value={x.check || 'Port'} onChange={v => set({ check: v as GateCheck })} options={['Port', 'HTTP', 'Ping', 'SQL query', 'Service running', 'Database mounted', 'Business transaction']} />
            </Field>
            <Field id="sd-t" label={x.check === 'HTTP' ? 'URL' : x.check === 'SQL query' || x.check === 'Database mounted' ? 'Database server' : x.check === 'Business transaction' ? 'Test script' : x.check === 'Service running' ? 'Server' : 'Server or address'} hint={x.check === 'Business transaction' ? 'From the script library; runs on the orchestrator against the recovered servers' : undefined}>
              <TextInput id="sd-t" value={x.target || ''} onChange={v => set({ target: v })} placeholder={x.check === 'HTTP' ? 'https://erp.host360.ai/health' : x.check === 'Business transaction' ? 'erp-smoke-test.ps1' : 'sql-prod-02'} />
            </Field>
            {x.check === 'Port' ? (
              <Field id="sd-p" label="Port">
                <TextInput id="sd-p" value={x.port ? String(x.port) : ''} onChange={v => set({ port: +v.replace(/\D/g, '') || undefined })} inputMode="numeric" placeholder="443" />
              </Field>
            ) : (
              <Field id="sd-e" label={x.check === 'Service running' ? 'Service name' : x.check === 'Database mounted' ? 'Database' : 'Expect'}>
                <TextInput id="sd-e" value={x.expect || ''} onChange={v => set({ expect: v })} placeholder={x.check === 'HTTP' ? '200 OK' : x.check === 'Service running' ? 'MSSQLSERVER' : x.check === 'Database mounted' ? 'ERP_PROD is ONLINE' : x.check === 'Business transaction' ? 'Posts a test order and reads it back' : 'SELECT 1 returns 1'} />
              </Field>
            )}
            <Field id="sd-to2" label="Give up after (s)">
              <TextInput id="sd-to2" value={String(x.timeout || 120)} onChange={v => set({ timeout: +v.replace(/\D/g, '') || 30 })} inputMode="numeric" />
            </Field>
            {fail}
          </>
        ) : null}
        {x.kind === 'script' ? (
          <>
            <Field id="sd-n" label="Name" span={2}>
              <TextInput id="sd-n" value={x.name || ''} onChange={v => set({ name: v })} placeholder="Point ERP at the recovered databases" />
            </Field>
            <Field id="sd-l" label="Language">
              <SelectInput id="sd-l" value={x.lang || 'PowerShell'} onChange={v => set({ lang: v as RStep['lang'] })} options={['PowerShell', 'Bash']} />
            </Field>
            <Field id="sd-wh" label="Runs on">
              <SelectInput id="sd-wh" value={x.where || 'Orchestrator'} onChange={v => set({ where: v as RStep['where'] })} options={['Orchestrator', 'Recovered server']} />
            </Field>
            <Field id="sd-b" label="Script" span={2} hint="Runs with the plan’s service account. Output goes into the run log.">
              <TextArea id="sd-b" value={x.body || ''} onChange={v => set({ body: v })} rows={6} mono />
            </Field>
            {fail}
          </>
        ) : null}
        {x.kind === 'manual' ? (
          <>
            <Field id="sd-m" label="What the person does" span={2}>
              <TextArea id="sd-m" value={x.text || ''} onChange={v => set({ text: v })} rows={3} />
            </Field>
            <Field id="sd-who" label="Who" span={2} hint="The run waits until this person, or anyone who can run the plan, confirms.">
              <TextInput id="sd-who" value={x.who || ''} onChange={v => set({ who: v })} placeholder="ERP service owner (Arun Kumar)" />
            </Field>
          </>
        ) : null}
        {x.kind === 'dns' ? (
          <>
            <Field id="sd-r" label="Record">
              <TextInput id="sd-r" value={x.record || ''} onChange={v => set({ record: v })} placeholder="erp.host360.ai" />
            </Field>
            <Field id="sd-v" label="New value">
              <TextInput id="sd-v" value={x.value || ''} onChange={v => set({ value: v })} placeholder="10.50.0.31" />
            </Field>
          </>
        ) : null}
        {x.kind === 'lb' ? (
          <>
            <Field id="sd-pool" label="Pool">
              <TextInput id="sd-pool" value={x.pool || ''} onChange={v => set({ pool: v })} placeholder="lb-storefront · pool web" />
            </Field>
            <Field id="sd-mem" label="Members after the switch">
              <TextInput id="sd-mem" value={x.value || ''} onChange={v => set({ value: v })} placeholder="web-frontend-01-dr" />
            </Field>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

/** A new step of a kind, with sensible defaults for the plan. */
export function newStep(kind: StepKind, rb: Runbook): RStep {
  const base: RStep = { id: 'new' + Date.now(), kind };
  if (kind === 'boot') return { ...base, timeout: 600, onFail: 'Stop the run' };
  if (kind === 'delay') return { ...base, secs: 60 };
  if (kind === 'gate') return { ...base, check: 'Port', timeout: 120, onFail: 'Stop the run' };
  if (kind === 'script') return { ...base, lang: 'PowerShell', where: 'Orchestrator', timeout: 300, onFail: 'Ask a person' };
  if (kind === 'manual') return { ...base, who: rb.owner };
  return base;
}

export const estimateText = (min: number, rto: string) => `About ${fmtMin(min)} of ${rto}`;
