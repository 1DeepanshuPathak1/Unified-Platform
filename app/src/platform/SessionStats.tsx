import { useState, type ReactNode } from 'react';
import { Icon } from '../lib/Icon';
import { AEGIS } from '../data/aegis';
import { Seg } from '../ui/controls';
import { H3, LogView, MiniTable, Status } from '../ui/layout';

/**
 * Session statistics for one job run, after the job statistics window of enterprise backup consoles:
 * three counter boxes (Summary, Data, Status), a throughput graph of data read against data transferred,
 * and the objects the session processed, each with its own action log.
 * Figures are derived deterministically from the session so they stay the same between renders.
 */

export type SessionSrc = {
  id: string;
  name: string;
  object: string;
  product: string;
  proxy: string;
  state: 'run' | 'queued' | 'paused' | 'ok' | 'warn' | 'err' | 'cancelled';
  pct: number;
  started: string;
  duration?: string;
  note?: string;
  rate?: string;
};

type ObjSt = 'ok' | 'warn' | 'err' | 'run' | 'todo';
export type SessionObj = { name: string; st: ObjSt; gb: number; read: number; tx: number; sec: number; note?: string };
export type Session = {
  objs: SessionObj[];
  more: { n: number; ok: number; warn: number; err: number };
  total: number;
  processed: number;
  read: number;
  tx: number;
  reduction: number;
  sec: number;
  rate: number;
  bottleneck: string;
  ok: number;
  warn: number;
  err: number;
  run: number;
  moves: boolean;
  startSec: number;
  samples: { r: number; t: number }[];
};

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const parseDur = (d?: string) => {
  if (!d) return 0;
  const h = /(\d+)\s*h/.exec(d), m = /(\d+)\s*min/.exec(d), s = /(\d+)\s*s\b/.exec(d);
  return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (s ? +s[1] : 0);
};
export const fmtDur = (sec: number) => {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec} s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} s`;
  return `${Math.floor(sec / 3600)} h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')} min`;
};
export const fmtSize = (gb: number) => (gb <= 0 ? '0 B' : gb < 1 ? `${Math.max(1, Math.round(gb * 1024))} MB` : gb < 1024 ? `${gb.toFixed(gb < 10 ? 2 : 1)} GB` : `${(gb / 1024).toFixed(2)} TB`);
const clock = (s: number) => {
  s = ((Math.round(s) % 86400) + 86400) % 86400;
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
};
const noise = (i: number, h: number, k: number) => (Math.sin(i * 1.7 + h + k * 3.1) + Math.sin(i * 0.61 + h * 0.37 + k)) / 4 + 0.5;

const NO_DATA = /Test boot|Readiness check/;
const OBJ_ERR: Record<string, string> = { 'file-srv-03': 'Disk scsi1 read error at offset 412.6 GB; change tracking was reset and the next run reads the whole disk' };
const OBJ_WARN: Record<string, string> = { 'erp-db-01': 'Application-consistent snapshot failed; crash-consistent point taken' };
const SIZES = [40, 60, 80, 120, 200, 420, 640, 820];

export function sessionStats(src: SessionSrc, bottleneckNow?: string): Session {
  const h = hash(src.id + src.object);
  const guests: { name: string; policy: string; size?: number; last?: { r: string } }[] = AEGIS.guests;
  const sizeOf = (name: string, i: number) => guests.find(g => g.name === name)?.size ?? SIZES[(h + i) % SIZES.length];
  const done = src.state === 'ok' || src.state === 'warn' || src.state === 'err' || src.state === 'cancelled';
  const moves = !NO_DATA.test(src.name);
  const frac = /Cutover/.test(src.name) ? 0.012 : /Restore/.test(src.name) ? 0.03 : /configuration/i.test(src.name) ? 1 : 0.035 + (h % 6) / 100;
  const reduction = 1.8 + (h % 17) / 10;
  const part = src.state === 'run' || src.state === 'paused' || src.state === 'err' || src.state === 'cancelled' ? Math.max(0.02, src.pct / 100) : 1;
  const sec = parseDur(src.duration) || Math.round(60 + src.pct * 3 + (h % 60));
  const stOne: ObjSt = src.state === 'run' || src.state === 'paused' ? 'run' : src.state === 'err' || src.state === 'cancelled' ? 'err' : src.state === 'warn' ? 'warn' : src.state === 'queued' ? 'todo' : 'ok';

  const many = /^(\d+) guests$/.exec(src.object);
  let objs: SessionObj[];
  let total = 1;
  const more = { n: 0, ok: 0, warn: 0, err: 0 };
  const mk = (name: string, st: ObjSt, gb: number, i: number, note?: string): SessionObj => {
    const read = moves ? (/configuration/i.test(src.name) ? 0.4 : gb * frac * (0.7 + noise(i, h, 1) * 0.6)) * (st === 'run' ? part : st === 'err' ? Math.min(part, 0.15) : 1) : 0;
    return { name, st, gb, read, tx: read / reduction, sec: Math.max(8, Math.round((sec / Math.max(1, total)) * (0.6 + noise(i, h, 2) * 0.8))), note };
  };
  if (many) {
    total = +many[1];
    const members = guests.filter(g => g.policy === src.name);
    objs = members.map((g, i) => mk(g.name, g.last?.r === 'err' ? 'err' : g.last?.r === 'warn' ? 'warn' : 'ok', sizeOf(g.name, i), i, g.last?.r === 'err' ? OBJ_ERR[g.name] || 'Processing failed; see the guest for details' : g.last?.r === 'warn' ? OBJ_WARN[g.name] || 'Finished with a warning' : undefined));
    const c = /(\d+) succeeded, (\d+) warnings?, (\d+) failed/.exec(src.note || '');
    const want = c ? { ok: +c[1], warn: +c[2], err: +c[3] } : { ok: total - objs.filter(o => o.st !== 'ok').length, warn: objs.filter(o => o.st === 'warn').length, err: objs.filter(o => o.st === 'err').length };
    more.n = Math.max(0, total - objs.length);
    more.warn = Math.max(0, want.warn - objs.filter(o => o.st === 'warn').length);
    more.err = Math.max(0, want.err - objs.filter(o => o.st === 'err').length);
    more.ok = Math.max(0, more.n - more.warn - more.err);
  } else {
    objs = [mk(src.object, stOne, src.object === 'aegis-orchestrator' ? 2.4 : sizeOf(src.object, 0), 0, src.state === 'warn' || src.state === 'err' ? src.note : undefined)];
  }
  const avg = objs.reduce((a, o) => a + o.gb, 0) / Math.max(1, objs.length);
  const avgRead = objs.reduce((a, o) => a + o.read, 0) / Math.max(1, objs.length);
  const processed = objs.reduce((a, o) => a + o.gb, 0) * (src.state === 'run' || src.state === 'paused' ? part : 1) + more.n * avg;
  const read = objs.reduce((a, o) => a + o.read, 0) + more.n * avgRead;
  const tx = read / reduction;
  const live = Number.parseFloat(src.rate || '');
  const rate = src.state === 'run' && live ? live : read > 0 ? (read * 1024) / Math.max(1, sec * 0.8) : 0;
  const ok = objs.filter(o => o.st === 'ok').length + more.ok;
  const warn = objs.filter(o => o.st === 'warn').length + more.warn;
  const err = objs.filter(o => o.st === 'err').length + more.err;
  const run = objs.filter(o => o.st === 'run').length;

  const m = /(\d{2}):(\d{2})/.exec(src.started);
  const startSec = m ? +m[1] * 3600 + +m[2] * 60 : 0;
  const N = 48;
  const stop = src.state === 'err' || src.state === 'cancelled' ? Math.max(0.12, Math.min(0.5, src.pct / 100 + 0.1)) : 1;
  const samples = Array.from({ length: N }, (_, i) => {
    const x = i / (N - 1);
    if (!moves || rate <= 0 || x > stop) return { r: 0, t: 0 };
    const ramp = Math.min(1, x / 0.12) * (done && src.state !== 'err' ? Math.min(1, (1 - x) / 0.06 + 0.15) : 1);
    const r = rate * ramp * (0.82 + noise(i, h, 3) * 0.36);
    return { r, t: (r / reduction) * (0.85 + noise(i, h, 4) * 0.3) };
  });
  return {
    objs,
    more,
    total,
    processed,
    read,
    tx,
    reduction,
    sec,
    rate,
    bottleneck: bottleneckNow ? bottleneckNow[0].toUpperCase() + bottleneckNow.slice(1) : ['Source', 'Proxy', 'Network', 'Target'][h % 4],
    ok,
    warn,
    err,
    run,
    moves,
    startSec,
    samples
  };
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--ln)', borderRadius: 'var(--r)', background: 'var(--panel)', minWidth: 0 }}>
      <h4 style={{ margin: 0, padding: '8px 12px', borderBottom: '1px solid var(--ln)', background: 'var(--panel-2)', borderRadius: 'var(--r) var(--r) 0 0', font: '600 11px/16px var(--f-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{title}</h4>
      <dl style={{ margin: 0, padding: '6px 12px 8px' }}>{children}</dl>
    </section>
  );
}
function Row({ k, v, icon, tone }: { k: string; v: ReactNode; icon?: string; tone?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28, font: '13px/18px var(--f-ui)' }}>
      {icon ? <Icon name={icon} style={{ color: tone ? `var(--${tone})` : 'var(--tx-3)' }} /> : null}
      <dt style={{ flex: 1, minWidth: 0, color: 'var(--tx-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</dt>
      <dd style={{ margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</dd>
    </div>
  );
}

/** The three counter boxes. */
export function SessionCounters({ s, state }: { s: Session; state: SessionSrc['state'] }) {
  const running = state === 'run' || state === 'paused';
  return (
    <div role="group" aria-label="Session counters" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
      <Box title="Summary">
        <Row k={running ? 'Running for' : 'Duration'} v={fmtDur(s.sec)} />
        <Row k="Processing rate" v={s.rate > 0 ? `${Math.round(s.rate)} MB/s` : <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>—</span>} />
        <Row k="Bottleneck" v={s.moves && s.rate > 0 ? s.bottleneck : <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>—</span>} />
      </Box>
      <Box title="Data">
        <Row k="Processed" v={fmtSize(s.processed)} />
        <Row k="Read" v={s.moves ? fmtSize(s.read) : <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>No data moved</span>} />
        <Row k="Transferred" v={s.moves ? <>{fmtSize(s.tx)} <span style={{ fontWeight: 400, color: 'var(--tx-3)' }}>({s.reduction.toFixed(1)}×)</span></> : <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>—</span>} />
      </Box>
      <Box title="Status">
        <Row k="Success" v={s.ok} icon="circle-check" tone="ok" />
        <Row k="Warnings" v={s.warn} icon="triangle-alert" tone={s.warn ? 'warn' : undefined} />
        <Row k={running ? 'Errors · in progress' : 'Errors'} v={running ? `${s.err} · ${s.run}` : s.err} icon="circle-x" tone={s.err ? 'err' : undefined} />
      </Box>
    </div>
  );
}

/** Throughput over the session: data read from the source against data transferred to the target. */
export function ThroughputChart({ s, state }: { s: Session; state: SessionSrc['state'] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hov, setHov] = useState<number | null>(null);
  const W = 672, H = 176, L = 44, R = 8, T = 10, B = 24;
  const N = s.samples.length;
  const peak = Math.max(1, ...s.samples.map(p => p.r));
  const step = peak > 400 ? 200 : peak > 200 ? 100 : peak > 80 ? 50 : peak > 20 ? 10 : 5;
  const yMax = Math.ceil(peak / step) * step;
  const x = (i: number) => L + (i / (N - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const line = (k: 'r' | 't') => s.samples.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const area = (k: 'r' | 't') => `${line(k)}L${x(N - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const at = (i: number) => s.startSec + (i / (N - 1)) * s.sec;
  const running = state === 'run' || state === 'paused';
  const avgR = s.samples.filter(p => p.r > 0).reduce((a, p, _i, arr) => a + p.r / arr.length, 0);
  const avgT = s.samples.filter(p => p.t > 0).reduce((a, p, _i, arr) => a + p.t / arr.length, 0);
  const last = s.samples[N - 1];
  const legend = (c: string, label: string, v: number) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
      <span style={{ width: 12, height: 3, borderRadius: 2, background: c }} />
      {label}
      <b style={{ fontWeight: 600, color: 'var(--tx)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)} MB/s</b>
    </span>
  );
  return (
    <section>
      <H3 right={<Seg label="Show throughput as" value={view} onChange={setView} panel={false} options={[{ v: 'chart', label: 'Chart', icon: 'activity' }, { v: 'table', label: 'Table', icon: 'list' }]} />}>Throughput</H3>
      {!s.moves || s.rate <= 0 ? (
        <p style={{ padding: '16px 0', color: 'var(--tx-2)' }}>{s.moves ? 'No data has been read yet.' : 'This session runs checks and boots machines; it does not move data.'}</p>
      ) : view === 'chart' ? (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px', marginBottom: 6 }}>
            {legend('var(--series-1)', running ? 'Read now' : 'Read, average', running ? last.r : avgR)}
            {legend('var(--series-2)', running ? 'Transferred now' : 'Transferred, average', running ? last.t : avgT)}
            <span style={{ marginLeft: 'auto', font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>MB/s over time, IST</span>
          </div>
          <svg
            role="img"
            aria-label={`Throughput: read averaged ${Math.round(avgR)} MB/s and transferred ${Math.round(avgT)} MB/s over ${fmtDur(s.sec)}`}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: 'block', overflow: 'visible' }}
            onMouseMove={e => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              setHov(Math.max(0, Math.min(N - 1, Math.round(((px - L) / (W - L - R)) * (N - 1)))));
            }}
            onMouseLeave={() => setHov(null)}
          >
            {[0, 0.5, 1].map(f => (
              <g key={f}>
                <line x1={L} x2={W - R} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--ln)" strokeWidth={1} />
                <text x={L - 8} y={y(yMax * f) + 4} textAnchor="end" style={{ font: '11px var(--f-ui)', fill: 'var(--tx-3)' }}>{Math.round(yMax * f)}</text>
              </g>
            ))}
            <path d={area('r')} fill="var(--series-1)" fillOpacity={0.12} />
            <path d={area('t')} fill="var(--series-2)" fillOpacity={0.14} />
            <path d={line('r')} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
            <path d={line('t')} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" />
            {[0, Math.round((N - 1) / 2), N - 1].map((i, j) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={j === 0 ? 'start' : j === 2 ? 'end' : 'middle'} style={{ font: '11px var(--f-ui)', fill: 'var(--tx-3)' }}>
                {j === 2 && running ? 'Now' : clock(at(i)).slice(0, 5)}
              </text>
            ))}
            {hov != null ? (
              <g>
                <line x1={x(hov)} x2={x(hov)} y1={T} y2={H - B} stroke="var(--tx-3)" strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={x(hov)} cy={y(s.samples[hov].r)} r={4} fill="var(--series-1)" stroke="var(--panel)" strokeWidth={2} />
                <circle cx={x(hov)} cy={y(s.samples[hov].t)} r={4} fill="var(--series-2)" stroke="var(--panel)" strokeWidth={2} />
              </g>
            ) : null}
          </svg>
          {hov != null ? (
            <div
              role="status"
              style={{ position: 'absolute', top: 24, left: `${(x(hov) / W) * 100}%`, transform: `translateX(${hov > N / 2 ? 'calc(-100% - 12px)' : '12px'})`, pointerEvents: 'none', padding: '8px 10px', background: 'var(--overlay)', border: '1px solid var(--ln-2)', borderRadius: 'var(--r-sm)', boxShadow: 'var(--sh-menu)', font: '12px/18px var(--f-ui)', whiteSpace: 'nowrap', zIndex: 2 }}
            >
              <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{clock(at(hov))} IST</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--series-1)' }} />Read <b style={{ marginLeft: 'auto', paddingLeft: 12, fontVariantNumeric: 'tabular-nums' }}>{Math.round(s.samples[hov].r)} MB/s</b></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--series-2)' }} />Transferred <b style={{ marginLeft: 'auto', paddingLeft: 12, fontVariantNumeric: 'tabular-nums' }}>{Math.round(s.samples[hov].t)} MB/s</b></div>
            </div>
          ) : null}
        </div>
      ) : (
        <MiniTable
          label="Throughput samples"
          cols={[{ label: 'Time (IST)' }, { label: 'Read', r: true, w: '120px' }, { label: 'Transferred', r: true, w: '120px' }]}
          rows={s.samples.filter((_p, i) => i % 6 === 0 || i === N - 1).map((p, j, arr) => {
            const i = j === arr.length - 1 ? N - 1 : j * 6;
            return [clock(at(i)), `${Math.round(p.r)} MB/s`, `${Math.round(p.t)} MB/s`];
          })}
        />
      )}
    </section>
  );
}

const OST: Record<ObjSt, [string, string, string]> = { ok: ['circle-check', 'Success', 'ok'], warn: ['triangle-alert', 'Warning', 'warn'], err: ['circle-x', 'Error', 'err'], run: ['loader-circle', 'Processing', 'run'], todo: ['clock', 'Pending', 'tx'] };

function objLog(o: SessionObj, s: Session, src: SessionSrc, i: number) {
  const base = s.startSec + Math.round((i / Math.max(1, s.objs.length)) * s.sec * 0.6);
  const t = (k: number) => clock(base + k);
  const step = Math.max(2, Math.round(o.sec / 6));
  const lines: { t: string; text: string; lv: 'info' | 'ok' | 'warn' | 'err' }[] = [
    { t: t(0), text: `Queued for processing on ${src.proxy}`, lv: 'info' }
  ];
  if (!s.moves) {
    lines.push({ t: t(step), text: /Test boot/.test(src.name) ? 'Cloned the disk to the isolated network and injected drivers' : 'Checked the recovery site, network mapping and boot order', lv: 'info' });
    if (o.st === 'warn' && o.note) lines.push({ t: t(step * 2), text: o.note, lv: 'warn' });
    lines.push({ t: t(o.sec), text: o.st === 'warn' ? 'Finished with warnings' : 'Finished', lv: o.st === 'warn' ? 'warn' : 'ok' });
    return lines;
  }
  if (o.st === 'err' && /Snapshot|quiesce/i.test(o.note || '')) {
    lines.push({ t: t(step), text: 'Requested an application-consistent snapshot', lv: 'info' }, { t: t(o.sec), text: o.note || 'Snapshot failed', lv: 'err' });
    return lines;
  }
  lines.push({ t: t(step), text: o.st === 'warn' && /crash/.test(o.note || '') ? 'Application-consistent snapshot failed; took a crash-consistent snapshot' : 'Created an application-consistent snapshot', lv: o.st === 'warn' && /crash/.test(o.note || '') ? 'warn' : 'info' });
  lines.push({ t: t(step * 2), text: `Reading changed blocks with change tracking: ${fmtSize(o.read)} of ${fmtSize(o.gb)}`, lv: 'info' });
  if (o.st === 'err') {
    lines.push({ t: t(o.sec), text: o.note || 'Write failed', lv: 'err' });
    return lines;
  }
  if (o.st === 'run') {
    lines.push({ t: t(step * 3), text: `Transferring at ${Math.round(s.rate)} MB/s`, lv: 'info' });
    return lines;
  }
  lines.push({ t: t(step * 4), text: `Transferred ${fmtSize(o.tx)}, ${s.reduction.toFixed(1)}× smaller after compression and deduplication`, lv: 'info' });
  lines.push({ t: t(step * 5), text: 'Removed the snapshot', lv: 'info' });
  if (o.st === 'warn' && o.note && !/crash/.test(o.note)) lines.push({ t: t(o.sec - 1), text: o.note, lv: 'warn' });
  lines.push({ t: t(o.sec), text: o.st === 'warn' ? `Finished with warnings in ${fmtDur(o.sec)}` : `Finished in ${fmtDur(o.sec)}`, lv: o.st === 'warn' ? 'warn' : 'ok' });
  return lines;
}

/** Objects the session processed; selecting one shows its action log underneath. */
export function SessionObjects({ s, src }: { s: Session; src: SessionSrc }) {
  const [sel, setSel] = useState(() => Math.max(0, s.objs.findIndex(o => o.st === 'err' || o.st === 'warn')));
  const o = s.objs[Math.min(sel, s.objs.length - 1)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section>
        <H3 right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{s.total === 1 ? '1 object' : `${s.total} objects`}</span>}>Objects</H3>
        <MiniTable
          label="Objects in this session"
          onRow={setSel}
          cols={[{ label: 'Object' }, { label: 'Status', w: '112px' }, { label: 'Processed', r: true, w: '84px' }, { label: 'Transferred', r: true, w: '88px' }, { label: 'Duration', r: true, w: '96px' }]}
          rows={s.objs.map((x, i) => [
            <span key="n" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, fontWeight: i === sel ? 600 : 400, color: i === sel ? 'var(--acc-tx)' : undefined }}>
              <span aria-hidden style={{ width: 3, height: 16, borderRadius: 2, background: i === sel ? 'var(--acc)' : 'transparent', flex: 'none' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</span>
            </span>,
            <Status key="s" icon={OST[x.st][0]} label={OST[x.st][1]} tone={OST[x.st][2]} spin={x.st === 'run'} />,
            fmtSize(x.gb),
            s.moves ? fmtSize(x.tx) : '—',
            fmtDur(x.sec)
          ])}
        />
        {s.more.n ? (
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
            And {s.more.n} more: {[s.more.ok ? `${s.more.ok} succeeded` : '', s.more.warn ? `${s.more.warn} with warnings` : '', s.more.err ? `${s.more.err} failed` : ''].filter(Boolean).join(', ')}. The list shows the guests on this policy in this project.
          </p>
        ) : null}
      </section>
      {o ? (
        <section>
          <H3>Action log · {o.name}</H3>
          <LogView key={o.name} lines={objLog(o, s, src, sel)} height={220} />
        </section>
      ) : null}
    </div>
  );
}
