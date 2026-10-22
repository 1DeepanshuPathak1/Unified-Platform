import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Icon } from '../../lib/Icon';
import { Btn, Seg, Tag } from '../../ui/controls';
import { Bar, MiniTable, Page, PageHeader, Panel, StateBlock, Status, Tiles, plural, type Kpi } from '../../ui/layout';
import type { Ctx } from '../../ui/ctx';
import { custName, Go, inScope, scopeCustomers, showCustomerCol } from '../../platform/common';
import { useStore } from '../../platform/store';
/** Downtime reads best in hours and minutes, never in days. */
const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
import { BURN, BURN_WEEKS, INVENTORY, IN_PROGRESS, STAGE_LABEL, WAVES, verdict } from './data';

/** Mobility › Overview: the migration programme at a glance, for the customers in scope. */
export default function MobilityOverview({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const scope = scopeCustomers(ctx);
  const inv = INVENTORY.filter(v => scope.includes(v.customer) && v.stage !== 'excluded' && inScope(ctx, v.customer));
  const migrated = inv.filter(v => v.stage === 'committed');
  const progress = inv.filter(v => IN_PROGRESS.includes(v.stage));
  const failed = inv.filter(v => v.stage === 'rolledback');
  const blocked = inv.filter(v => verdict(v) === 'block' && !IN_PROGRESS.includes(v.stage) && v.stage !== 'committed');
  const risk = inv.filter(v => v.risk && v.stage !== 'committed');
  const notStarted = inv.length - migrated.length - progress.length - failed.length;
  const waves = WAVES.filter(w => scope.includes(w.customer) && inScope(ctx, w.customer));
  const budget = waves.reduce((a, w) => a + w.budgetMin, 0);
  const used = waves.reduce((a, w) => a + w.usedMin, 0);
  const custs = Object.keys(BURN).filter(c => scope.includes(c) && inScope(ctx, c));
  const planned = BURN_WEEKS.map((_, i) => custs.reduce((a, c) => a + BURN[c].planned[i], 0));
  const actual = BURN[custs[0]] ? BURN[custs[0]].actual.map((_, i) => custs.reduce((a, c) => a + BURN[c].actual[i], 0)) : [];
  const remaining = inv.length - migrated.length;
  const behindBy = actual.length ? actual[actual.length - 1] - planned[actual.length - 1] : 0;
  const ui = ctx.ui;
  const showCust = showCustomerCol(ctx);
  const pct = (n: number) => (inv.length ? `${(n / inv.length) * 100}%` : '0%');

  const tiles: Kpi[] = [
    { label: 'In scope', value: `${inv.length}`, unit: 'servers', icon: 'server', sub: `${notStarted} not started · ${custs.length > 1 ? `${custs.length} programmes` : custName(custs[0] || 'h360')}`, loading: ui === 'loading', segs: ui === 'live' ? [{ w: pct(migrated.length), c: 'var(--ok)' }, { w: pct(progress.length), c: 'var(--run)' }, { w: pct(failed.length), c: 'var(--warn)' }] : undefined },
    { label: 'Migrated', value: `${migrated.length}`, icon: 'check', tone: 'ok', sub: `${Math.round((migrated.length / Math.max(1, inv.length)) * 100)} % committed`, loading: ui === 'loading' },
    { label: 'In progress', value: `${progress.length}`, icon: 'loader-circle', tone: 'run', sub: `${progress.filter(v => v.stage === 'ready').length} ready for cutover · ${progress.filter(v => v.stage === 'cutover').length} awaiting commit`, loading: ui === 'loading', href: '#/mig/servers' },
    { label: 'Failed', value: `${failed.length}`, icon: 'undo-2', tone: failed.length ? 'warn' : undefined, sub: failed.length ? `Rolled back: ${failed.map(v => v.name).join(', ')}` : 'Nothing rolled back', loading: ui === 'loading' },
    { label: 'Blocked', value: `${blocked.length}`, icon: 'ban', tone: blocked.length ? 'err' : undefined, sub: blocked.length ? blocked.map(v => v.name).join(', ') : 'Nothing blocked', loading: ui === 'loading', href: '#/mig/sources' },
    { label: 'At risk', value: `${risk.length}`, icon: 'triangle-alert', tone: risk.length ? 'warn' : undefined, sub: risk.length ? 'May miss their wave window' : 'Every wave on track', loading: ui === 'loading' }
  ];
  if (ui === 'unreach') tiles.forEach(t => { t.value = 'Not read'; t.unit = undefined; t.unread = true; t.segs = undefined; });

  return (
    <Page scroll>
      <PageHeader
        kicker="Mobility"
        title="Overview"
        sub={`The move off VMware for ${ctx.actingAs ? custName(ctx.actingAs.customer) : ctx.project === 'All projects' ? 'every customer' : ctx.project}: what is done, what is moving, and what stands in the way.`}
        actions={
          <>
            <Btn kind="outline" icon="radar" onClick={() => ctx.go('mig/sources')}>
              Sources and inventory
            </Btn>
            <Btn kind="primary" icon="server" onClick={() => ctx.go('mig/servers')}>
              Servers
            </Btn>
          </>
        }
      />
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Tiles items={tiles} />
        {ui === 'unreach' ? <Bar tone="warn">Could not be read: Chennai vCenter did not answer within 30 s. Progress is not shown until it can be read.</Bar> : null}
        {ui === 'empty' ? (
          <Panel title="Migration">
            <StateBlock ui="empty" emptyText="Nothing is being migrated yet. Add a VMware source to discover its servers and check which can move." emptyAction="Add a source" onEmpty={() => ctx.go('mig/sources')}>
              {null}
            </StateBlock>
          </Panel>
        ) : null}
        {ui === 'live' || ui === 'loading' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
              <Panel
                title={<>Burn-down <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>servers left to migrate, by week</span></>}
                right={<Seg label="Show as" value={view} onChange={setView} panel={false} options={[{ v: 'chart', label: 'Chart', icon: 'trending-down' }, { v: 'table', label: 'Table', icon: 'list' }]} />}
              >
                <StateBlock ui={ui} emptyText="">
                  <div style={{ padding: '12px 16px 16px' }}>
                    <p style={{ marginBottom: 8, color: 'var(--tx-2)' }}>
                      {remaining} left of {inv.length}.{' '}
                      {behindBy > 0 ? (
                        <span style={{ color: 'var(--tx)' }}>
                          <Icon name="triangle-alert" style={{ color: 'var(--warn)', verticalAlign: '-3px' }} /> {plural(behindBy, 'server')} behind plan.
                        </span>
                      ) : behindBy < 0 ? (
                        `${plural(-behindBy, 'server')} ahead of plan.`
                      ) : (
                        'On plan.'
                      )}{' '}
                      Planned to finish {BURN_WEEKS[planned.findIndex(n => n === 0)]} 2026.
                    </p>
                    {view === 'chart' ? (
                      <BurnDown weeks={BURN_WEEKS} planned={planned} actual={actual} />
                    ) : (
                      <MiniTable label="Burn-down" cols={[{ label: 'Week of' }, { label: 'Planned left', r: true }, { label: 'Actually left', r: true }, { label: 'Difference', r: true }]} rows={BURN_WEEKS.map((w, i) => [`${w} 2026`, String(planned[i]), actual[i] != null ? String(actual[i]) : '—', actual[i] != null ? (actual[i] - planned[i] > 0 ? `${actual[i] - planned[i]} behind` : actual[i] - planned[i] < 0 ? `${planned[i] - actual[i]} ahead` : 'On plan') : '—'])} />
                    )}
                  </div>
                </StateBlock>
              </Panel>
              <Panel title="Downtime budget" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{fmtMin(used)} of {fmtMin(budget)} used</span>}>
                <StateBlock ui={ui} emptyText="">
                  <ul style={{ listStyle: 'none', padding: '4px 16px 12px' }}>
                    {waves.map(w => {
                      const share = w.budgetMin ? w.usedMin / w.budgetMin : 0;
                      const tone = share > 0.9 ? 'err' : share > 0.6 ? 'warn' : 'acc';
                      return (
                        <li key={w.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 132px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--ln)' }}>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
                            <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {showCust ? `${custName(w.customer)} · ` : ''}
                              {w.state === 'done' ? 'Done' : w.state === 'in progress' ? 'In progress' : w.window ? w.window.split(',')[0] : 'No window yet'}
                            </span>
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-tip={`${fmtMin(w.usedMin || 0)} of ${fmtMin(w.budgetMin)} downtime used`}>
                            <span style={{ display: 'block', height: 6, background: 'var(--ln)' }}>
                              <span style={{ display: 'block', height: 6, width: `${Math.min(100, share * 100)}%`, background: `var(--${tone})` }} />
                            </span>
                            <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {w.usedMin ? fmtMin(w.usedMin) : '0 min'} of {fmtMin(w.budgetMin)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </StateBlock>
              </Panel>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
              <Panel title="Waves" right={<Go ctx={ctx} to="mig/plans">Migration plans</Go>}>
                <div style={{ padding: '0 16px 4px' }}>
                  <StateBlock ui={ui} emptyText="">
                    <MiniTable
                      label="Waves"
                      cols={[{ label: 'Wave' }, { label: 'Cutover window', w: '170px' }, { label: 'Servers', w: '64px', r: true }, { label: 'State', w: '190px' }]}
                      rows={waves.map(w => {
                        const vs = inv.filter(v => v.wave === w.name && v.customer === w.customer);
                        const done = vs.filter(v => v.stage === 'committed').length;
                        const ready = vs.filter(v => v.stage === 'ready').length;
                        const appr = w.approval ? s.approvals.find(a => a.id === w.approval) : null;
                        return [
                          <span key="n" style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                            <strong style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</strong>
                            {showCust ? <Tag>{w.customer === 'mer' ? 'Meridian' : 'Host360'}</Tag> : null}
                          </span>,
                          w.window ? <span key="w" data-tip={w.window}>{w.window.replace(' 2026', '').replace(' IST', '').split(' to ')[0]}</span> : <em key="w" style={{ color: 'var(--tx-3)' }}>Not scheduled</em>,
                          String(vs.length),
                          w.state === 'done' ? (
                            <Status key="s" icon="check" tone="ok" label={`Done · ${done} of ${vs.length} committed`} />
                          ) : appr && appr.state === 'pending' ? (
                            <Status key="s" icon="user-check" tone="warn" label={`Go/no-go ${appr.given.length} of ${appr.needed}`} tip={`${appr.id}: ${appr.approvers}`} />
                          ) : w.state === 'in progress' ? (
                            <Status key="s" icon="loader-circle" tone="run" label={`${done} of ${vs.length} committed`} />
                          ) : (
                            <Status key="s" icon="calendar-clock" tone="tx" label={`${ready} of ${vs.length} ready`} />
                          )
                        ];
                      })}
                    />
                  </StateBlock>
                </div>
              </Panel>
              <Panel title={<>At risk and blocked <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>{risk.length + blocked.length}</span></>}>
                <StateBlock ui={ui} emptyText="">
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {[...blocked.map(v => ({ v, why: v.checks.find(c => c.level === 'block')!.text, b: true })), ...risk.map(v => ({ v, why: v.risk!, b: false }))].map(({ v, why, b }) => (
                      <li key={v.id + b} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--ln)' }}>
                        <Icon name={b ? 'ban' : 'triangle-alert'} style={{ color: b ? 'var(--err)' : 'var(--warn)', marginTop: 2 }} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Go ctx={ctx} to={IN_PROGRESS.includes(v.stage) || v.stage === 'rolledback' ? 'mig/servers' : 'mig/sources'} id={IN_PROGRESS.includes(v.stage) || v.stage === 'rolledback' ? v.name : v.id}>{v.name}</Go>
                            <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{b ? 'Blocked' : STAGE_LABEL[v.stage]}{v.wave ? ` · ${v.wave.split(' · ')[0]}` : ''}</span>
                          </span>
                          <span style={{ display: 'block', font: '13px/18px var(--f-body)', color: 'var(--tx-2)' }}>{why}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </StateBlock>
              </Panel>
            </div>
          </>
        ) : null}
      </div>
    </Page>
  );
}

/** Burn-down: actual (accent, solid) against the plan (muted, dashed: a projection). Crosshair and keyboard readout. */
function BurnDown({ weeks, planned, actual }: { weeks: string[]; planned: number[]; actual: number[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const H = 220;
  const pad = { l: 36, r: 76, t: 12, b: 28 };
  const max = Math.max(...planned, ...actual, 1);
  const top = Math.ceil(max / 10) * 10;
  const x = (i: number) => pad.l + (i / (weeks.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, top / 2, top];
  const last = actual.length - 1;
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (weeks.length - 1));
    setHi(Math.max(0, Math.min(weeks.length - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHi(h => Math.min(weeks.length - 1, (h ?? last) + 1));
    if (e.key === 'ArrowLeft') setHi(h => Math.max(0, (h ?? last) - 1));
    if (e.key === 'Escape') setHi(null);
  };
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="4" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="var(--acc)" strokeWidth="2" /></svg>
          Actually left
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="4" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="var(--tx-3)" strokeWidth="2" strokeDasharray="4 3" /></svg>
          Planned
        </span>
      </div>
      <svg width={w} height={H} role="img" aria-label={`Burn-down: ${actual[last]} servers left in the week of ${weeks[last]}, against ${planned[last]} planned.`} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHi(null)} onKeyDown={onKey} onFocus={() => setHi(last)} onBlur={() => setHi(null)} style={{ display: 'block', outline: 'none', touchAction: 'none' }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--ln)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" style={{ font: '11px var(--f-ui)', fill: 'var(--tx-3)', fontVariantNumeric: 'tabular-nums' }}>
              {t}
            </text>
          </g>
        ))}
        {weeks.map((wk, i) =>
          i % 2 === 0 ? (
            <text key={wk} x={x(i)} y={H - 8} textAnchor="middle" style={{ font: '11px var(--f-ui)', fill: 'var(--tx-3)' }}>
              {wk}
            </text>
          ) : null
        )}
        <line x1={x(last)} x2={x(last)} y1={pad.t} y2={H - pad.b} stroke="var(--ln-2)" strokeWidth="1" />
        <text x={x(last) + 4} y={pad.t + 10} style={{ font: '11px var(--f-ui)', fill: 'var(--tx-3)' }}>
          Today
        </text>
        <path d={path(planned)} fill="none" stroke="var(--tx-3)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        <path d={`${path(actual)} L${x(last).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--acc)" opacity="0.1" />
        <path d={path(actual)} fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last)} cy={y(actual[last])} r="4" fill="var(--acc)" stroke="var(--panel)" strokeWidth="2" />
        <text x={x(last) + 8} y={y(actual[last]) + 4} style={{ font: '600 12px var(--f-ui)', fill: 'var(--tx)' }}>
          {actual[last]} left
        </text>
        <text x={w - pad.r + 6} y={y(planned[planned.length - 1]) + 4} style={{ font: '12px var(--f-ui)', fill: 'var(--tx-2)' }}>
          Plan: 0
        </text>
        {hi != null ? (
          <g pointerEvents="none">
            <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={H - pad.b} stroke="var(--tx-2)" strokeWidth="1" />
            <circle cx={x(hi)} cy={y(planned[hi])} r="4" fill="var(--tx-3)" stroke="var(--panel)" strokeWidth="2" />
            {actual[hi] != null ? <circle cx={x(hi)} cy={y(actual[hi])} r="4" fill="var(--acc)" stroke="var(--panel)" strokeWidth="2" /> : null}
          </g>
        ) : null}
      </svg>
      {hi != null ? (
        <div role="status" style={{ position: 'absolute', top: 32, left: Math.min(Math.max(0, x(hi) + 12), w - 180), width: 168, padding: '8px 10px', background: 'var(--overlay)', border: '1px solid var(--ln-2)', boxShadow: 'var(--sh-menu)', font: '12px/18px var(--f-ui)', pointerEvents: 'none' }}>
          <div style={{ color: 'var(--tx-3)' }}>Week of {weeks[hi]} 2026</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 2, background: 'var(--acc)' }} />
            <strong style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{actual[hi] != null ? actual[hi] : '—'}</strong>
            <span style={{ color: 'var(--tx-2)' }}>actually left</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 0, borderTop: '2px dashed var(--tx-3)' }} />
            <strong style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{planned[hi]}</strong>
            <span style={{ color: 'var(--tx-2)' }}>planned</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
