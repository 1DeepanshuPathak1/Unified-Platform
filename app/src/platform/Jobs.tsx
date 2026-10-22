import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { AEGIS } from '../data/aegis';
import { T } from '../data/platform';
import { Btn, Field, FilterInput, InfoTip, Seg, SelectFilter, SelectInput, TextInput } from '../ui/controls';
import { BulkBar, Facts, H3, LogView, MiniTable, Progress, Spacer, StepList, TableArea, Toolbar, plural, type Step } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx, LiveJob } from '../ui/ctx';
import { custName } from './common';

type Q = {
  id: string;
  name: string;
  object: string;
  product: string;
  customer: string;
  prio: number;
  proxy: string;
  state: 'run' | 'queued' | 'paused' | 'ok' | 'warn' | 'err' | 'cancelled';
  why?: string;
  phases: string[];
  phase: number;
  pct: number;
  rate: string;
  started: string;
  dependsOn?: string;
  bw: string;
  live?: LiveJob;
  note?: string;
  duration?: string;
};

const PROXY_FOR: Record<string, string> = { Backup: 'aegis-prod-220', DR: 'aegis-appliance-os1', Migration: 'aegis-orchestrator', Platform: 'aegis-orchestrator' };
const QUEUED: Q[] = [
  { id: 'q1', name: 'Meridian database hourly', object: 'cbs-db-01', product: 'Backup', customer: 'mer', prio: 1, proxy: 'aegis-appliance-os1', state: 'queued', why: 'Waiting for a slot on aegis-appliance-os1 (8 of 8 busy)', phases: ['Queued', 'Snapshot', 'Read changes', 'Write', 'Verify', 'Done'], phase: 0, pct: 0, rate: '', started: T('21 Oct', '16:00'), bw: 'Repository mer-obj-immutable: 400 MB/s' },
  { id: 'q2', name: 'Replication', object: 'web-frontend-02', product: 'DR', customer: 'h360', prio: 3, proxy: 'aegis-appliance-os1', state: 'queued', why: 'Starts after web-frontend-01 finishes (consistency group Web tier)', phases: ['Queued', 'Snapshot', 'Hashing source', 'Incremental copy', 'Done'], phase: 0, pct: 0, rate: '', started: T('21 Oct', '16:02'), dependsOn: 'Replication · web-frontend-01', bw: 'Per VM: 100 MB/s' },
  { id: 'q3', name: 'Sync pass 4', object: 'crm-app-01', product: 'Migration', customer: 'h360', prio: 2, proxy: 'aegis-orchestrator', state: 'queued', why: 'Source impact governor: Chennai vCenter is at its 250 MB/s read cap', phases: ['Queued', 'Snapshot', 'Read changes', 'Copy', 'Done'], phase: 0, pct: 0, rate: '', started: T('21 Oct', '16:03'), bw: 'Source cap: 250 MB/s for Chennai vCenter' },
  { id: 'q4', name: 'Kaveri daily', object: 'kav-wms-app-02', product: 'Backup', customer: 'kav', prio: 3, proxy: 'aegis-prod-220', state: 'queued', why: 'Fair share: Kaveri Logistics has used its 15 % of slots this hour', phases: ['Queued', 'Snapshot', 'Read changes', 'Write', 'Done'], phase: 0, pct: 0, rate: '', started: T('21 Oct', '16:04'), bw: 'Per VM: unlimited' },
  { id: 'p1', name: 'Lab to object storage', object: 'repo-director-lab → obj-check', product: 'Backup', customer: 'h360', prio: 4, proxy: 'aegis-lab-200', state: 'paused', why: 'Paused by meera.iyer at 15:10 IST until the lab maintenance ends', phases: ['Queued', 'Read', 'Write', 'Verify', 'Done'], phase: 2, pct: 41, rate: '', started: T('21 Oct', '14:55'), bw: 'Repository obj-check: 200 MB/s' }
];
const PRIO_L = ['', 'P1 · urgent', 'P2 · high', 'P3 · normal', 'P4 · low'];

/** A deterministic bottleneck read for each running job: busy % at source, network and target. */
function bottleneck(id: string, tick: number) {
  const h = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const j = (k: number) => Math.round(((Math.sin(tick / 3 + k + h) + 1) / 2) * 8);
  const src = [88, 46, 39][h % 3] + j(1);
  const net = [41, 91, 36][h % 3] + j(2);
  const tgt = [33, 40, 86][h % 3] + j(3);
  const m = Math.max(src, net, tgt);
  return { src, net, tgt, at: m === src ? 'source' : m === net ? 'network' : 'target' };
}

export function JobsTab({ ctx, jobCtl }: { ctx: Ctx; jobCtl: (id: string, a: 'pause' | 'resume' | 'cancel') => void }) {
  const [view, setView] = useState<'queue' | 'history' | 'limits'>('queue');
  const [q, setQ] = useState('');
  const [prod, setProd] = useState('All');
  const [queued, setQueued] = useState(QUEUED);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Progress');
  const cancel = useClosable<string[]>();
  const prio = useClosable<string[]>();
  useEffect(() => {
    if (ctx.openId) {
      drawer.open(ctx.openId);
      setTab('Progress');
      if (!ctx.jobs.some(j => j.id === ctx.openId) && !QUEUED.some(j => j.id === ctx.openId)) setView('history');
    }
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const live: Q[] = ctx.jobs.map(j => ({
    id: j.id,
    name: j.name,
    object: j.object,
    product: j.product,
    customer: 'h360',
    prio: j.product === 'DR' ? 1 : 2,
    proxy: PROXY_FOR[j.product] || 'aegis-orchestrator',
    state: j.status === 'run' ? 'run' : j.status === 'paused' ? 'paused' : j.status === 'cancelled' ? 'cancelled' : j.status === 'err' ? 'err' : 'ok',
    phases: j.phases,
    phase: j.phase,
    pct: j.pct,
    rate: j.rate,
    started: j.started,
    bw: j.product === 'Backup' ? 'Repository obj-check: 400 MB/s' : 'Per VM: 250 MB/s',
    live: j
  }));
  const hist: Q[] = AEGIS.jobs.map((j: { id: string; name: string; object: string; product: string; type: string; status: string; phase: string; pct: number; started: string; duration: string; note?: string }) => ({
    id: j.id, name: j.name, object: j.object, product: j.product === 'Migration' ? 'Migration' : j.product, customer: 'h360', prio: 3, proxy: PROXY_FOR[j.product] || 'aegis-orchestrator', state: j.status as Q['state'], phases: [j.phase], phase: 0, pct: j.pct, rate: '', started: j.started, bw: '—', note: j.note, duration: j.duration
  }));
  const queue = [...live.filter(j => j.state === 'run' || j.state === 'paused'), ...queued];
  const finished = [...live.filter(j => j.state === 'ok' || j.state === 'cancelled' || j.state === 'err'), ...hist];
  const ql = q.trim().toLowerCase();
  const base = view === 'history' ? finished : queue;
  const rows = base.filter(j => (prod === 'All' || j.product === prod) && (!ql || `${j.name} ${j.object} ${j.proxy}`.toLowerCase().includes(ql)));
  const op = ctx.can('operate', 'Controlling jobs');
  const find = (id: string) => [...queue, ...finished].find(j => j.id === id);
  const d = drawer.value ? find(drawer.value) : null;
  const selIds = Object.keys(sel).filter(k => sel[k] && rows.some(r => r.id === k));

  const act = (ids: string[], a: 'pause' | 'resume' | 'cancel') => {
    ids.forEach(id => {
      if (ctx.jobs.some(j => j.id === id)) jobCtl(id, a);
      else setQueued(x => (a === 'cancel' ? x.filter(j => j.id !== id) : x.map(j => (j.id === id ? { ...j, state: a === 'pause' ? 'paused' : 'queued', why: a === 'pause' ? `Paused by priya.raman at ${ctx.hms().slice(0, 5)} IST` : 'Waiting for a slot' } : j))));
    });
    ctx.toast(`${plural(ids.length, 'job')} ${a === 'pause' ? 'paused' : a === 'resume' ? 'resumed' : 'cancelled'}`, a === 'cancel' ? 'warn' : 'ok');
    setSel({});
  };
  const ST: Record<Q['state'], [string, string, string]> = { run: ['loader-circle', 'Running', 'run'], queued: ['clock', 'Queued', 'tx'], paused: ['pause', 'Paused', 'warn'], ok: ['circle-check', 'Succeeded', 'ok'], warn: ['triangle-alert', 'Warnings', 'warn'], err: ['circle-x', 'Failed', 'err'], cancelled: ['circle-minus', 'Cancelled', 'tx'] };

  return (
    <>
      <Toolbar>
        {selIds.length && view === 'queue' ? (
          <BulkBar label={plural(selIds.length, 'job') + ' selected'} onClear={() => setSel({})}>
            <Btn kind="ghost" icon="pause" perm={op} onClick={() => act(selIds, 'pause')}>Pause</Btn>
            <Btn kind="ghost" icon="play" perm={op} onClick={() => act(selIds, 'resume')}>Resume</Btn>
            <Btn kind="ghost" icon="list-ordered" perm={op} onClick={() => prio.open(selIds)}>Change priority…</Btn>
            <Btn kind="danger" icon="circle-stop" perm={op} onClick={() => cancel.open(selIds)}>Cancel…</Btn>
          </BulkBar>
        ) : (
          <>
            <Seg
              label="Show"
              value={view}
              onChange={v => { setView(v); setSel({}); }}
              options={[
                { v: 'queue', label: 'Queue', count: queue.length },
                { v: 'history', label: 'History', count: finished.length },
                { v: 'limits', label: 'Limits and fair share' }
              ]}
            />
            {view !== 'limits' ? (
              <>
                <FilterInput value={q} onChange={setQ} placeholder="Filter by job, object or proxy" label="Filter jobs" width={240} />
                <SelectFilter label="Product" value={prod} onChange={setProd} options={['All', 'Backup', 'DR', 'Migration', 'Platform']} />
              </>
            ) : null}
            <Spacer />
            {view === 'queue' ? (
              <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>
                {queue.filter(j => j.state === 'run').length} running · {queue.filter(j => j.state === 'queued').length} queued · {queue.filter(j => j.state === 'paused').length} paused
              </span>
            ) : null}
          </>
        )}
      </Toolbar>
      {view === 'limits' ? (
        <Limits ctx={ctx} />
      ) : (
        <TableArea>
          <AegisTable
            label={view === 'queue' ? 'Job queue' : 'Job history'}
            cols={[
              { k: 'prio', label: 'Priority', w: '76px' },
              { k: 'name', label: 'Job', w: 'minmax(140px,1.2fr)' },
              { k: 'object', label: 'Object', w: 'minmax(120px,1fr)' },
              { k: 'product', label: 'Product', w: '88px', dim: true },
              { k: 'proxy', label: 'Runs on', w: 'minmax(120px,1fr)', dim: true },
              { k: 'state', label: 'State', w: 'minmax(150px,1.2fr)' },
              { k: 'pct', label: 'Progress', w: '130px' },
              ...(view === 'queue' ? [{ k: 'rate', label: 'Throughput', w: '92px', r: true }, { k: 'bn', label: 'Bottleneck', w: '100px' }] : [{ k: 'dur', label: 'Duration', w: '104px', r: true }, { k: 'started', label: 'Started', w: '176px', dim: true }])
            ]}
            rows={rows.map(j => {
              const b = j.state === 'run' ? bottleneck(j.id, ctx.tick) : null;
              const st = ST[j.state];
              return {
                id: j.id,
                prio: { v: PRIO_L[j.prio].split(' · ')[0], s: j.prio, tip: PRIO_L[j.prio], strong: j.prio === 1 },
                name: { v: j.name, strong: true },
                object: j.object,
                product: j.product,
                proxy: j.proxy,
                state: { t: 'status', i: st[0], l: j.state === 'run' ? `${st[1]} · ${j.phases[j.phase]}` : st[1], c: st[2], spin: j.state === 'run', tip: j.why || j.note || st[1] },
                pct: j.state === 'queued' ? { v: '—', muted: true, s: 0 } : { t: 'bar', pct: j.pct, v: `${Math.floor(j.pct)} %`, c: j.state === 'run' ? 'run' : j.state === 'err' ? 'err' : j.state === 'paused' ? 'warn' : 'ok' },
                rate: j.state === 'run' ? j.rate || '—' : { v: '—', muted: true },
                bn: b ? { t: 'status', i: b.at === 'source' ? 'hard-drive' : b.at === 'network' ? 'wifi' : 'database', l: b.at[0].toUpperCase() + b.at.slice(1), c: 'warn', tip: `Source ${b.src} % busy · network ${b.net} % · target ${b.tgt} %` } : { v: '—', muted: true },
                dur: j.duration || '—',
                started: j.started
              };
            })}
            sel={view === 'queue' ? sel : undefined}
            onSel={view === 'queue' ? (id: string) => setSel(x => ({ ...x, [id]: !x[id] })) : undefined}
            onSelAll={(ids: string[], on: boolean) => setSel(x => ({ ...x, ...Object.fromEntries(ids.map(i => [i, on])) }))}
            onRow={(id: string) => { drawer.open(id); setTab('Progress'); }}
            active={drawer.value}
            state={ctx.ui}
            unit={['job', 'jobs']}
            filtered={prod !== 'All' || !!ql}
            onClear={() => { setProd('All'); setQ(''); }}
            emptyText={view === 'queue' ? 'Nothing is running or waiting. Scheduled jobs appear here when they start.' : 'No finished jobs yet.'}
            sort={view === 'queue' ? 'prio' : 'started'}
            dir={view === 'queue' ? 1 : -1}
            footR="One queue for Protection, Resilience and Mobility"
          />
        </TableArea>
      )}
      {d ? (
        <Drawer
          label="Job details"
          width={640}
          kicker={`Job · ${d.product} · ${custName(d.customer)}`}
          title={`${d.name} · ${d.object}`}
          status={
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name={ST[d.state][0]} spin={d.state === 'run'} style={{ color: `var(--${ST[d.state][2] === 'tx' ? 'tx-3' : ST[d.state][2]})` }} />
                <span style={{ color: 'var(--tx)' }}>{ST[d.state][1]}</span>
              </span>
              <span>{PRIO_L[d.prio]}</span>
              <span>{d.proxy}</span>
            </>
          }
          actions={
            d.state === 'run' || d.state === 'queued' || d.state === 'paused' ? (
              <>
                {d.state === 'paused' ? (
                  <Btn kind="outline" icon="play" perm={op} onClick={() => act([d.id], 'resume')}>Resume</Btn>
                ) : (
                  <Btn kind="outline" icon="pause" perm={op} onClick={() => act([d.id], 'pause')}>Pause</Btn>
                )}
                <Btn kind="outline" icon="list-ordered" perm={op} onClick={() => prio.open([d.id])}>Change priority…</Btn>
                <Spacer />
                <Btn kind="danger" icon="circle-stop" perm={op} onClick={() => cancel.open([d.id])}>Cancel…</Btn>
              </>
            ) : d.state === 'err' || d.state === 'warn' || d.state === 'cancelled' ? (
              <Btn kind="outline" icon="refresh-cw" perm={op} onClick={() => { ctx.startJob({ name: d.name, object: d.object, product: d.product, phases: ['Queued', 'Snapshot', 'Read changes', 'Write', 'Verify', 'Done'], speed: 8, rate: '120 MB/s' }); ctx.toast(`Retry started: ${d.name} for ${d.object}`, 'info'); drawer.close(); }}>
                Retry
              </Btn>
            ) : undefined
          }
          tabs={[{ v: 'Progress', label: 'Progress' }, { v: 'Log', label: 'Log', count: d.live ? d.live.log.length : undefined }, { v: 'Limits', label: 'Limits' }]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Progress' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {d.why ? <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tx-2)' }}><Icon name="info" />{d.why}</p> : null}
              {d.note ? <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tx-2)' }}><Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />{d.note}</p> : null}
              {d.phases.length > 1 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '13px/18px var(--f-ui)', marginBottom: 6 }}>
                    <span>{d.phases[d.phase]}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.floor(d.pct)} %{d.rate && d.state === 'run' ? ` · ${d.rate}` : ''}</span>
                  </div>
                  <Progress pct={d.pct} tone={d.state === 'paused' ? 'warn' : d.state === 'run' ? 'run' : 'ok'} slow />
                  <div style={{ marginTop: 16 }}>
                    <StepList steps={d.phases.map((p, i): Step => ({ label: p, state: i < d.phase || d.state === 'ok' ? 'done' : i === d.phase ? (d.state === 'run' ? 'current' : d.state === 'paused' ? 'todo' : 'done') : 'todo', note: i === d.phase && d.state === 'paused' ? 'Paused' : undefined }))} />
                  </div>
                </div>
              ) : null}
              {d.state === 'run' ? <BottleneckPanel id={d.id} tick={ctx.tick} /> : null}
              <Facts items={[{ k: 'Started', v: d.started }, ...(d.dependsOn ? [{ k: 'Waits for', v: d.dependsOn, icon: 'workflow' }] : []), { k: 'Runs on', v: d.proxy }, { k: 'Customer', v: custName(d.customer) }]} />
            </div>
          ) : null}
          {tab === 'Log' ? (
            d.live ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <LogView lines={d.live.log} height={420} />
                <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Follows new lines. The job keeps running if you close this drawer.</span>
              </div>
            ) : (
              <LogView lines={[{ t: d.started.slice(-9, -4), text: `${d.name} queued for ${d.object}`, lv: 'info' }, ...(d.note ? [{ t: '', text: d.note, lv: d.state === 'err' ? ('err' as const) : ('warn' as const) }] : []), ...(d.state === 'ok' ? [{ t: '', text: `${d.name} finished for ${d.object}${d.duration ? ` in ${d.duration}` : ''}`, lv: 'ok' as const }] : [])]} height={220} />
            )
          ) : null}
          {tab === 'Limits' ? (
            <Facts
              items={[
                { k: 'Priority', v: PRIO_L[d.prio] },
                { k: 'Concurrency', v: `${d.proxy}: ${d.proxy === 'aegis-appliance-os1' ? '8 of 8' : d.proxy === 'aegis-prod-220' ? '3 of 8' : '2 of 4'} slots busy` },
                { k: 'Bandwidth', v: d.bw },
                { k: 'Fair share', v: `${custName(d.customer)} gets ${d.customer === 'mer' ? '35' : d.customer === 'kav' ? '15' : '40'} % of slots when the queue is full` },
                { k: 'Source impact', v: 'Chennai vCenter read cap 250 MB/s; backs off when guest latency passes 20 ms' }
              ]}
            />
          ) : null}
        </Drawer>
      ) : null}
      {cancel.value ? (
        <Dialog
          size="sm"
          title={cancel.value.length === 1 ? `Cancel ${find(cancel.value[0])?.name} for ${find(cancel.value[0])?.object}` : `Cancel ${plural(cancel.value.length, 'job')}`}
          sub="Data already written stays; the next scheduled run starts from the last good point."
          closing={cancel.closing}
          onClose={cancel.close}
          footer={
            <>
              <Btn kind="ghost" onClick={cancel.close}>Keep running</Btn>
              <Btn kind="dangerSolid" icon="circle-stop" onClick={() => { act(cancel.value!, 'cancel'); cancel.close(); }}>
                Cancel {cancel.value.length === 1 ? 'job' : plural(cancel.value.length, 'job')}
              </Btn>
            </>
          }
        >
          <p style={{ color: 'var(--tx-2)' }}>Jobs that wait for these ones will not start until you retry them.</p>
        </Dialog>
      ) : null}
      {prio.value ? <PrioDialog n={prio.value.length} closing={prio.closing} onClose={prio.close} onSave={p => { setQueued(x => x.map(j => (prio.value!.includes(j.id) ? { ...j, prio: p } : j))); ctx.toast(`${plural(prio.value!.length, 'job')} set to ${PRIO_L[p]}`, 'ok'); prio.close(); setSel({}); }} /> : null}
    </>
  );
}

function BottleneckPanel({ id, tick }: { id: string; tick: number }) {
  const b = bottleneck(id, tick);
  const bar = (label: string, icon: string, v: number, on: boolean) => (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 110px minmax(0,1fr) 48px', gap: 10, alignItems: 'center', height: 32, font: '13px var(--f-ui)' }}>
      <Icon name={icon} style={{ color: on ? 'var(--warn)' : 'var(--tx-3)' }} />
      <span style={{ fontWeight: on ? 700 : 400 }}>{label}</span>
      <Progress pct={Math.min(100, v)} tone={on ? 'warn' : 'tx'} />
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.min(100, v)} %</span>
    </div>
  );
  return (
    <section>
      <H3 right={<InfoTip tip="How busy each leg of the data path is. The busiest leg limits throughput: add proxies for a network bottleneck, faster storage for a target bottleneck, or raise the source read cap." />}>
        Bottleneck: {b.at}
      </H3>
      {bar('Source read', 'hard-drive', b.src, b.at === 'source')}
      {bar('Network', 'wifi', b.net, b.at === 'network')}
      {bar('Target write', 'database', b.tgt, b.at === 'target')}
    </section>
  );
}

function PrioDialog({ n, closing, onClose, onSave }: { n: number; closing: boolean; onClose: () => void; onSave: (p: number) => void }) {
  const [p, setP] = useState('2');
  return (
    <Dialog size="sm" title={`Change priority of ${plural(n, 'job')}`} sub="Higher priority jobs take the next free slot; running jobs are never stopped for them." closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => onSave(+p)}>Apply</Btn></>}>
      <Field id="pr-p" label="Priority">
        <SelectInput id="pr-p" value={p} onChange={setP} options={[1, 2, 3, 4].map(i => ({ v: String(i), label: PRIO_L[i] }))} />
      </Field>
    </Dialog>
  );
}

function Limits({ ctx }: { ctx: Ctx }) {
  const cfg = ctx.can('configure', 'Changing limits');
  const edit = useClosable<string>();
  const [val, setVal] = useState('');
  const proxies = AEGIS.nodes.filter((n: { slots: number[] | null }) => n.slots);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)', padding: '0 16px 8px' }}>
        <H3 right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Concurrent tasks</span>}>
          <span style={{ display: 'block', paddingTop: 12 }}>Slots per proxy and appliance</span>
        </H3>
        <MiniTable
          label="Slots"
          cols={[{ label: 'Node' }, { label: 'Busy', w: '150px' }, { label: 'Limit', w: '56px', r: true }, { label: '', w: '56px', r: true }]}
          rows={proxies.map((n: { name: string; slots: number[] }) => [
            n.name,
            <span key="b" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}><Progress pct={(n.slots[0] / n.slots[1]) * 100} tone={n.slots[0] >= n.slots[1] ? 'warn' : 'run'} />{n.slots[0]}</span>,
            String(n.slots[1]),
            <Btn key="e" kind="ghost" size="sm" perm={cfg} onClick={() => { setVal(String(n.slots[1])); edit.open(n.name); }}>Edit</Btn>
          ])}
        />
      </section>
      <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)', padding: '0 16px 8px' }}>
        <H3 right={<InfoTip tip="When the queue is full, slots are shared by these weights. A tenant that is not using its share lends it to the others." />}>
          <span style={{ display: 'block', paddingTop: 12 }}>Fair share when the queue is full</span>
        </H3>
        <MiniTable
          label="Fair share"
          cols={[{ label: 'Tenant or product' }, { label: 'Weight', w: '64px', r: true }, { label: 'Using now', w: '150px' }]}
          rows={[
            ['Host360 Managed Services', '40 %', <span key="a" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}><Progress pct={52} tone="run" />52 %</span>],
            ['Meridian Cooperative Bank', '35 %', <span key="b" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}><Progress pct={35} tone="run" />35 %</span>],
            ['Kaveri Logistics Pvt Ltd', '15 %', <span key="c" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}><Progress pct={15} tone="warn" />15 %</span>],
            ['Other tenants', '10 %', <span key="d" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}><Progress pct={0} tone="run" />0 %</span>],
            ['Resilience over Protection', '2 : 1', <span key="e" style={{ color: 'var(--tx-2)' }}>Replication first</span>]
          ]}
        />
      </section>
      <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)', padding: '0 16px 8px', gridColumn: 'span 2' }}>
        <H3 right={<Btn kind="outline" size="sm" icon="plus" perm={cfg} onClick={() => { setVal('200'); edit.open('New bandwidth limit'); }}>Add a limit</Btn>}>
          <span style={{ display: 'block', paddingTop: 12 }}>Bandwidth limits</span>
        </H3>
        <MiniTable
          label="Bandwidth limits"
          cols={[{ label: 'Applies to' }, { label: 'Kind', w: '140px' }, { label: 'Limit', w: '120px', r: true }, { label: 'When', w: '200px' }, { label: '', w: '56px', r: true }]}
          rows={[
            ['obj-check', 'Repository', '400 MB/s', 'Always', 'obj'],
            ['mer-obj-immutable', 'Repository', '400 MB/s', 'Always', 'mer'],
            ['repo-director-lab', 'Repository', '200 MB/s', '08:00 to 20:00 IST', 'lab'],
            ['Every VM in Base-Project', 'Per VM', '250 MB/s', 'Always', 'vm'],
            ['web-frontend-02', 'Per VM', '100 MB/s', 'Always', 'wf2']
          ].map(([a, k, l, w, id]) => [<strong key="a" style={{ fontWeight: 700 }}>{a}</strong>, k, l, w, <Btn key="e" kind="ghost" size="sm" perm={cfg} onClick={() => { setVal(l.replace(/\D/g, '')); edit.open(a); }}>Edit</Btn>].map((x, i) => (i === 0 ? x : <span key={id + i}>{x}</span>)))}
        />
      </section>
      {edit.value ? (
        <Dialog size="sm" title={edit.value === 'New bandwidth limit' ? 'Add a bandwidth limit' : `Limit for ${edit.value}`} closing={edit.closing} onClose={edit.close} footer={<><Btn kind="ghost" onClick={edit.close}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!/^\d+$/.test(val)} why="Enter a whole number." onClick={() => { ctx.toast(`${edit.value} limit set to ${val}`, 'ok'); edit.close(); }}>Save</Btn></>}>
          <Field id="lim-v" label={edit.value.startsWith('aegis') ? 'Concurrent tasks' : 'MB/s (0 = unlimited)'}>
            <TextInput id="lim-v" value={val} onChange={setVal} inputMode="numeric" invalid={!/^\d+$/.test(val)} />
          </Field>
        </Dialog>
      ) : null}
    </div>
  );
}
