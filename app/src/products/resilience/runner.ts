/* Runs a recovery plan step by step. Runs live in the shared store and keep going when the
   screen that started them closes; the header's running-jobs tray follows them. */
import type { Ctx } from '../../ui/ctx';
import type { LogLine } from '../../ui/layout';
import { audit, store, update } from '../../platform/store';
import { DR_INFO, fmtMin, parseDur, wl, type RStep, type Runbook } from './data';

export type RunKind = 'Test' | 'Planned' | 'Unplanned' | 'Failback';
export const KIND_LABEL: Record<RunKind, string> = { Test: 'Test failover', Planned: 'Planned failover', Unplanned: 'Unplanned failover', Failback: 'Return to primary' };

type Item = { stage: string; step: string };
export interface DrRun {
  plan: string;
  kind: RunKind;
  stages: string[];
  flat: Item[];
  i: number;
  sub: number;
  state: 'run' | 'wait' | 'done' | 'stopped';
  started: string;
  /** Simulated seconds since the start, used for timings and the RTO comparison. */
  sim: number;
  log: LogLine[];
  by: string;
  approvedBy?: string;
  reason?: string;
  jobId: string;
}

/** Title and one-line description of a step, as the builder and the run log show it. */
export function stepText(x: RStep, rb: Runbook, kind?: RunKind): [string, string] {
  const w = wl(x.w);
  const testing = kind === 'Test';
  switch (x.kind) {
    case 'boot': {
      const info = w && DR_INFO[w.id];
      const where = kind === 'Failback' ? rb.from : rb.to;
      return [`Start ${w ? w.name : x.w}`, info ? `From its newest point at ${where}${testing ? `, on ${rb.testNet}` : ''}. Waits up to ${Math.round((x.timeout || 600) / 60)} min for the console.` : `${w ? w.name : x.w} is not replicated.`];
    }
    case 'delay':
      return [`Wait ${x.secs} s`, 'Gives services time to settle before the next step.'];
    case 'gate':
      return [
        x.check === 'Port' ? `Check port ${x.port} on ${x.target}` : x.check === 'HTTP' ? `Check ${x.target}` : x.check === 'Ping' ? `Ping ${x.target}` : `Run a query on ${x.target}`,
        `${x.expect ? `Expects ${x.expect}. ` : ''}Up to ${x.timeout || 120} s; if it fails: ${(x.onFail || 'Stop the run').toLowerCase()}.`
      ];
    case 'script':
      return [x.name || 'Run a script', `${x.lang} on the ${(x.where || 'Orchestrator').toLowerCase()}; up to ${Math.round((x.timeout || 300) / 60)} min.`];
    case 'manual':
      return ['Manual step', `${x.who ? `${x.who}: ` : ''}${x.text}`];
    case 'dns':
      return [`Point ${x.record} at ${x.value}`, testing ? 'Skipped in a test: production DNS is never changed.' : 'Updates the record in the customer DNS; TTL 60 s.'];
    case 'lb':
      return [`Update load balancer ${x.pool}`, testing ? 'Skipped in a test.' : `Members become ${x.value}.`];
  }
}

const SIM: Record<RStep['kind'], number> = { boot: 150, delay: 0, gate: 20, script: 45, manual: 120, dns: 15, lb: 20 };
const TICKS: Record<RStep['kind'], number> = { boot: 3, delay: 1, gate: 2, script: 2, manual: 1, dns: 1, lb: 1 };
const PRE: Record<string, [string, number]> = {
  'pre-sync': ['Final sync: copying the last changes of every server', 120],
  'pre-stop': ['Shutting down the servers at the primary site', 60],
  'pre-reverse': ['Reverse sync: copying changes made at the recovery site back', 240],
  'post-stop': ['Shutting down the copies at the recovery site; replication restarts toward the recovery site', 60],
  'post-test': ['Test servers keep running on the isolated network until you clean them up', 0]
};

const ctxOf: Record<string, Ctx> = {};
let timer: number | undefined;

const find = (rb: Runbook, it: Item) => rb.stages.find(s => s.id === it.stage)?.steps.find(x => x.id === it.step);

export function startRun(ctx: Ctx, rb: Runbook, kind: RunKind, stageIds: string[], opts: { approvedBy?: string; reason?: string } = {}) {
  const stages = rb.stages.filter(s => stageIds.includes(s.id));
  const ordered = kind === 'Failback' ? [...stages].reverse() : stages;
  const flat: Item[] = [];
  if (kind === 'Planned') flat.push({ stage: '_pre', step: 'pre-sync' }, { stage: '_pre', step: 'pre-stop' });
  if (kind === 'Failback') flat.push({ stage: '_pre', step: 'pre-reverse' });
  ordered.forEach(s => s.steps.forEach(x => flat.push({ stage: s.id, step: x.id })));
  if (kind === 'Failback') flat.push({ stage: '_post', step: 'post-stop' });
  if (kind === 'Test') flat.push({ stage: '_post', step: 'post-test' });
  const phases = ordered.map(s => s.name).concat(['Done']);
  const jobId = ctx.startJob({
    name: KIND_LABEL[kind],
    object: rb.name,
    product: 'DR',
    type: 'Failover',
    phases,
    external: true,
    firstLine: `${KIND_LABEL[kind]} of ${rb.name} started by priya.raman`,
    doneToast: kind === 'Test' ? `Test of ${rb.name} passed. Clean up the test servers when you are done.` : kind === 'Failback' ? `${rb.name} is back at ${rb.from}` : `${rb.name} is running at ${rb.to}`
  });
  ctxOf[rb.id] = ctx;
  const t = ctx.hms();
  update(s => {
    s.drRuns[rb.id] = {
      plan: rb.id,
      kind,
      stages: stageIds,
      flat,
      i: 0,
      sub: 0,
      state: 'run',
      started: ctx.now(),
      sim: 0,
      by: 'priya.raman',
      approvedBy: opts.approvedBy,
      reason: opts.reason,
      jobId,
      log: [
        { t, text: `${KIND_LABEL[kind]} of ${rb.name} started${kind === 'Test' ? ` on ${rb.testNet}. Production keeps running.` : kind === 'Failback' ? `: ${rb.to} → ${rb.from}` : `: ${rb.from} → ${rb.to}`}`, lv: 'info' },
        ...(opts.approvedBy ? [{ t, text: `Approval recorded: ${opts.approvedBy}`, lv: 'ok' as const }] : [])
      ]
    };
  });
  audit({ who: 'priya.raman', customer: rb.customer, what: `Started ${KIND_LABEL[kind].toLowerCase()}`, object: `${rb.name}${stageIds.length < rb.stages.length ? ` (${stageIds.length} of ${rb.stages.length} stages)` : ''}`, when: ctx.now(), r: 'ok', note: opts.reason });
  ensure();
}

function ensure() {
  if (timer) return;
  timer = window.setInterval(tick, 1100);
}

function line(r: DrRun, text: string, lv: LogLine['lv'] = 'info') {
  const ctx = ctxOf[r.plan];
  r.log = r.log.concat([{ t: ctx.hms(), text, lv }]).slice(-80);
}

function tick() {
  const active = Object.values(store.drRuns).filter(r => r.state === 'run');
  if (!active.length) {
    clearInterval(timer);
    timer = undefined;
    return;
  }
  update(s => {
    active.forEach(r0 => {
      const r = s.drRuns[r0.plan];
      const rb = s.runbooks.find(x => x.id === r.plan)!;
      const ctx = ctxOf[r.plan];
      const it = r.flat[r.i];
      if (!it) return finish(r, rb, ctx);
      if (it.stage === '_pre' || it.stage === '_post') {
        const [text, secs] = PRE[it.step];
        line(r, text, it.step === 'post-test' ? 'info' : 'ok');
        r.sim += secs;
        r.i++;
        r.sub = 0;
      } else {
        const x = find(rb, it)!;
        const [title] = stepText(x, rb, r.kind);
        const w = wl(x.w);
        if (x.kind === 'manual') {
          r.state = 'wait';
          line(r, `Waiting for a person: ${x.text}`, 'warn');
          ctx.patchJob(r.jobId, { line: { text: 'Waiting for a manual step', lv: 'warn' } });
          return;
        }
        if (x.kind === 'boot') {
          const where = r.kind === 'Failback' ? rb.from : rb.to;
          const msg = [`${title}: creating from the newest point${w?.dr.age && r.kind !== 'Failback' ? ` (${w.dr.age} old)` : ''}`, `${w?.name} powered on at ${where}`, `${w?.name} console reached the login screen`][r.sub];
          line(r, msg, r.sub === 2 ? 'ok' : 'info');
        } else if (x.kind === 'gate') line(r, r.sub === 0 && x.check === 'Port' ? `${title}: no answer yet, retrying` : `${title}: passed`, r.sub === 0 && x.check === 'Port' ? 'info' : 'ok');
        else if (x.kind === 'script') line(r, r.sub === 0 ? `${title}: running` : `${title}: finished, exit code 0`, r.sub === 0 ? 'info' : 'ok');
        else if ((x.kind === 'dns' || x.kind === 'lb') && r.kind === 'Test') line(r, `${title}: skipped in a test`, 'info');
        else line(r, `${title}: done`, 'ok');
        r.sub++;
        if (r.sub >= TICKS[x.kind]) {
          r.sim += x.kind === 'delay' ? x.secs || 0 : SIM[x.kind];
          r.i++;
          r.sub = 0;
        }
      }
      const cur = r.flat[Math.min(r.i, r.flat.length - 1)];
      const order = (r.kind === 'Failback' ? [...r.stages].reverse() : r.stages);
      const phase = Math.max(0, order.indexOf(cur.stage));
      ctx.patchJob(r.jobId, { pct: (r.i / r.flat.length) * 100, phase: cur.stage === '_post' ? order.length - 1 : phase });
      if (r.i >= r.flat.length) finish(r, rb, ctx);
    });
  });
}

function finish(r: DrRun, rb: Runbook, ctx: Ctx) {
  r.state = 'done';
  const dur = fmtMin(r.sim / 60);
  const rto = parseDur(rb.rtoTarget) || 60;
  const met = r.sim / 60 <= rto;
  line(r, `${KIND_LABEL[r.kind]} finished in ${dur} (simulated); RTO target ${rb.rtoTarget}${met ? ', met' : ', missed'}`, met ? 'ok' : 'warn');
  ctx.patchJob(r.jobId, { pct: 100, phase: r.stages.length, status: 'ok', line: { text: `Finished in ${dur}`, lv: 'ok' } });
  const servers = rb.stages.filter(s => r.stages.includes(s.id)).flatMap(s => s.steps.filter(x => x.kind === 'boot').map(x => x.w!));
  if (r.kind === 'Test') rb.lastTest = { when: ctx.now(), r: 'ok', dur, by: r.by };
  if (r.kind === 'Planned' || r.kind === 'Unplanned') {
    rb.lastFailover = { when: ctx.now(), kind: KIND_LABEL[r.kind], dur, by: r.by };
    servers.forEach(id => {
      const w = wl(id);
      if (w) {
        w.dr = { ...w.dr, s: 'online', note: `Running at ${rb.to} since ${ctx.now()}` };
      }
    });
  }
  if (r.kind === 'Failback') {
    servers.forEach(id => {
      const w = wl(id);
      if (w) w.dr = { ...w.dr, s: 'protected', note: undefined };
    });
    // The reconciliation report: what was written at the recovery site and whether it all came back.
    const t = store.failbackTarget[rb.id] || { target: `${rb.from} (original hosts)`, same: true };
    store.reconciliations.unshift({
      plan: rb.id,
      when: ctx.now(),
      target: t.target,
      same: t.same,
      rows: servers.map((id, i) => {
        const w = wl(id);
        const gb = ((w?.sizeGB || 40) * (0.012 + (i % 3) * 0.007)).toFixed(1);
        return { server: w?.name || id, written: `${gb} GB`, copied: t.same ? `${gb} GB` : `${w?.sizeGB || 40} GB (full copy)`, check: 'Matched' as const, state: `Running at ${t.target.split(' (')[0]}` };
      }),
      notes: [t.same ? 'Only blocks changed at the recovery site were copied back' : 'Disks converted for the new platform; drivers and network settings applied from Mappings', `Recovery-site copies kept for 7 days in case ${rb.from} fails again`, 'No data written at the recovery site was lost'],
      signed: `SHA-256 ${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}, signed by aegis-orchestrator, ${ctx.now()}`
    });
    delete store.failbackTarget[rb.id];
  }
  if (r.kind !== 'Failback')
    store.drills.unshift({ id: 'd' + Date.now(), plan: rb.id, when: r.started, kind: KIND_LABEL[r.kind] as 'Test failover', r: met ? 'ok' : 'warn', dur, rtoMet: met, by: r.by, evidence: `DRL-${String(Date.now()).slice(-4)} · timings, log and screenshots` });
  audit({ who: 'system', side: 'System', customer: rb.customer, what: `${KIND_LABEL[r.kind]} finished`, object: rb.name, when: ctx.now(), r: 'ok', note: `${dur}; RTO target ${rb.rtoTarget}` });
}

/** A person confirms the manual step the run is waiting on. */
export function confirmManual(planId: string) {
  update(s => {
    const r = s.drRuns[planId];
    if (!r || r.state !== 'wait') return;
    line(r, 'Manual step confirmed by priya.raman', 'ok');
    r.sim += SIM.manual;
    r.i++;
    r.sub = 0;
    r.state = 'run';
  });
  ensure();
}

export function stopRun(planId: string) {
  const ctx = ctxOf[planId];
  update(s => {
    const r = s.drRuns[planId];
    if (!r) return;
    r.state = 'stopped';
    line(r, 'Stopped by priya.raman. Servers already started keep running.', 'warn');
    ctx.patchJob(r.jobId, { status: 'cancelled', line: { text: 'Stopped by priya.raman', lv: 'warn' } });
  });
  const rb = store.runbooks.find(x => x.id === planId)!;
  audit({ who: 'priya.raman', customer: rb.customer, what: 'Stopped a recovery plan run', object: rb.name, when: ctx.now(), r: 'ok' });
}

/** Removes a finished test (or a stopped run) so the plan can run again. */
export function clearRun(planId: string) {
  update(s => {
    delete s.drRuns[planId];
  });
}
