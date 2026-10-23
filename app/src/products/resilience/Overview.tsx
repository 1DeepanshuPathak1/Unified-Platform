import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { pc } from '../../lib/pseudo';
import { Btn, Seg, Tabs, Tag } from '../../ui/controls';
import { SiteCapacity } from './Capacity';
import { WitnessView } from './AppDr';
import { Bar, MiniTable, Page, PageHeader, Panel, StateBlock, Status, Tiles, plural, type Kpi } from '../../ui/layout';
import type { Ctx } from '../../ui/ctx';
import { custName, D_ST, Go, inScope, showCustomerCol, TierTag } from '../../platform/common';
import { useStore } from '../../platform/store';
import { DR_INFO, MODE_LABEL, TIER_TARGET, drWorkloads, fmtMin, readiness, rpoOf, toMs, type RpoState } from './data';

const NOW = '21 Oct 2026, 16:05 IST';
const RPO_TONE: Record<RpoState, string> = { within: 'ok', behind: 'warn', failed: 'err', unreach: 'warn', online: 'run', none: 'tx' };
const RPO_FILL: Record<RpoState, string> = { within: 'var(--ok)', behind: 'var(--warn)', failed: 'var(--err)', unreach: 'transparent', online: 'transparent', none: 'transparent' };
export const scoreTone = (n: number | null) => (n == null ? 'warn' : n >= 85 ? 'ok' : n >= 60 ? 'warn' : 'err');
const short = (t: string) => t.replace(' 2026', '').replace(' IST', '');

/** Resilience › Overview, with Site capacity as a second view for the provider. */
export default function ResilienceOverview({ ctx }: { ctx: Ctx }) {
  if (ctx.tab === 'witness' && !ctx.actingAs)
    return (
      <Page scroll>
        <PageHeader kicker="Resilience" title="Overview" sub="Witnesses, heartbeat paths and fencing that stop both sites acting as the primary at once." />
        <OverviewTabs ctx={ctx} value="witness" />
        <WitnessView ctx={ctx} />
      </Page>
    );
  if (ctx.tab === 'capacity' && !ctx.actingAs)
    return (
      <Page scroll>
        <PageHeader kicker="Resilience" title="Overview" sub="Recovery site capacity: what each site can hold, what is reserved for each customer and what is in use now." />
        <OverviewTabs ctx={ctx} value="capacity" />
        <SiteCapacity ctx={ctx} />
      </Page>
    );
  return <Readiness ctx={ctx} />;
}

function OverviewTabs({ ctx, value }: { ctx: Ctx; value: 'readiness' | 'capacity' | 'witness' }) {
  if (ctx.actingAs) return null;
  return <Tabs<'readiness' | 'capacity' | 'witness'> label="Overview views" value={value} onChange={v => ctx.go(v === 'readiness' ? 'dr/overview' : `dr/overview/${v}`)} style={{ margin: '0 24px 12px', padding: 0 }} tabs={[{ v: 'readiness', label: 'Readiness' }, { v: 'capacity', label: 'Site capacity' }, { v: 'witness', label: 'Split brain' }]} />;
}

/** Resilience › Overview: replication against target, readiness to fail over, drills and lag. */
function Readiness({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const scoped = drWorkloads().filter(w => inScope(ctx, w.customer, w.project));
  const needDr = scoped.filter(w => TIER_TARGET[w.tier]);
  const replicated = scoped.filter(w => DR_INFO[w.id] && w.dr.s !== 'none');
  const measured = replicated.filter(w => DR_INFO[w.id].mode !== 'Recreated').map(w => ({ w, ...rpoOf(w), info: DR_INFO[w.id] }));
  const order: Record<RpoState, number> = { failed: 0, behind: 1, unreach: 2, online: 3, within: 4, none: 5 };
  measured.sort((a, b) => order[a.state] - order[b.state] || (b.age != null && b.target ? b.age / b.target : 0) - (a.age != null && a.target ? a.age / a.target : 0));
  const within = measured.filter(m => m.state === 'within').length;
  const behind = measured.filter(m => m.state === 'behind').length;
  const failed = measured.filter(m => m.state === 'failed').length;
  const unread = measured.filter(m => m.state === 'unreach').length;
  const online = scoped.filter(w => w.dr.s === 'online' || w.dr.s === 'returning');
  const gaps = scoped.filter(w => w.dr.s === 'none' && TIER_TARGET[w.tier]);
  const plans = s.runbooks.filter(r => inScope(ctx, r.customer));
  const scored = plans.map(rb => ({ rb, ...readiness(rb) }));
  const readable = scored.filter(p => p.score != null);
  const avg = readable.length ? Math.round(readable.reduce((a, p) => a + p.score!, 0) / readable.length) : null;
  const upcoming = [...plans].sort((a, b) => toMs(a.nextDrill) - toMs(b.nextDrill));
  const overdue = plans.filter(p => toMs(p.nextDrill) < toMs(NOW));
  const next = upcoming.find(p => toMs(p.nextDrill) >= toMs(NOW));
  const lagAlerts = s.alerts.filter(a => a.product === 'Resilience' && inScope(ctx, a.customer) && a.state !== 'suppressed');
  const showCust = showCustomerCol(ctx);
  const ui = ctx.ui;

  const tiles: Kpi[] = [
    { label: 'Replicated workloads', value: ui === 'unreach' ? 'Not read' : `${replicated.length}`, unit: ui === 'unreach' ? undefined : `of ${needDr.length + replicated.filter(w => !TIER_TARGET[w.tier]).length}`, icon: 'life-buoy', sub: gaps.length ? `${plural(gaps.length, 'workload')} need DR by criticality and are not replicated` : 'Every workload that needs DR is replicated', loading: ui === 'loading', unread: ui === 'unreach', href: '#/dr/servers' },
    { label: 'Within RPO target', value: ui === 'unreach' ? 'Not read' : `${within}`, unit: ui === 'unreach' ? undefined : `of ${measured.length}`, icon: behind + failed ? 'clock' : 'circle-check', tone: failed ? 'err' : behind ? 'warn' : 'ok', sub: [behind ? `${behind} behind` : '', failed ? `${failed} failed` : '', unread ? `${unread} could not be read` : ''].filter(Boolean).join(' · ') || 'All within target', loading: ui === 'loading', unread: ui === 'unreach', segs: ui === 'live' && measured.length ? [{ w: `${(within / measured.length) * 100}%`, c: 'var(--ok)' }, { w: `${(behind / measured.length) * 100}%`, c: 'var(--warn)' }, { w: `${(failed / measured.length) * 100}%`, c: 'var(--err)' }, { w: `${(unread / measured.length) * 100}%`, c: 'var(--ln-2)' }] : undefined },
    { label: 'Failover readiness', value: ui === 'unreach' || avg == null ? 'Not read' : `${avg}`, unit: ui === 'unreach' || avg == null ? undefined : '%', icon: 'gauge', tone: scoreTone(avg), sub: `Average of ${plural(readable.length, 'plan')}${scored.length - readable.length ? ` · ${scored.length - readable.length} could not be read` : ''}`, loading: ui === 'loading', unread: ui === 'unreach' || avg == null, href: '#/dr/recovery' },
    { label: 'Next drill', value: next ? short(next.nextDrill).split(',')[0] : '—', icon: overdue.length ? 'triangle-alert' : 'calendar-clock', tone: overdue.length ? 'warn' : undefined, sub: overdue.length ? `${plural(overdue.length, 'plan')} overdue: ${overdue.map(p => p.name).join(', ')}` : next ? next.name : 'No drills scheduled', loading: ui === 'loading', unread: ui === 'unreach' },
    { label: 'At the recovery site', value: ui === 'unreach' ? 'Not read' : `${online.length}`, unit: ui === 'unreach' ? undefined : online.length === 1 ? 'workload' : 'workloads', icon: 'power', tone: online.length ? 'run' : undefined, sub: online.length ? online.map(w => w.name).join(', ') : 'Everything runs at its primary site', loading: ui === 'loading', unread: ui === 'unreach' }
  ];

  return (
    <Page scroll>
      <PageHeader
        kicker="Resilience"
        title="Overview"
        sub={`Replication, recovery point age and failover readiness for ${ctx.actingAs ? custName(ctx.actingAs.customer) : ctx.project === 'All projects' ? 'every customer' : ctx.project}.`}
        actions={
          <>
            <Btn kind="outline" icon="list-ordered" onClick={() => ctx.go('dr/recovery')}>
              Recovery plans
            </Btn>
            <Btn kind="primary" icon="flask-conical" perm={ctx.can('operate', 'Testing a recovery plan')} onClick={() => ctx.go('dr/recovery', plans.find(p => readiness(p).score != null)?.id)}>
              Test a plan…
            </Btn>
          </>
        }
      />
      <OverviewTabs ctx={ctx} value="readiness" />
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Tiles items={tiles} />
        {ui === 'unreach' ? <Bar tone="warn">Could not be read: the orchestrator did not answer within 30 s. Replication state is not shown until it can be read.</Bar> : null}
        {ui === 'empty' ? (
          <Panel title="Replication">
            <StateBlock ui="empty" emptyText="Nothing is replicated yet. Create a protection plan and add workloads to start replicating them to a recovery site." emptyAction="Create a protection plan" onEmpty={() => ctx.go('dr/plans')}>
              {null}
            </StateBlock>
          </Panel>
        ) : null}
        {ui === 'live' || ui === 'loading' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <Panel
                title={<>Recovery point age against target</>}
                right={<Seg label="Show as" value={view} onChange={setView} panel={false} options={[{ v: 'chart', label: 'Chart', icon: 'activity' }, { v: 'table', label: 'Table', icon: 'list' }]} />}
              >
                <StateBlock ui={ui} emptyText="">
                  {view === 'chart' ? <RpoChart ctx={ctx} rows={measured} showCust={showCust} /> : <RpoTable ctx={ctx} rows={measured} showCust={showCust} />}
                </StateBlock>
              </Panel>
              <Panel title="Drills" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Cadence follows criticality</span>}>
                <div style={{ padding: '0 16px 4px' }}>
                  <StateBlock ui={ui} emptyText="">
                    <MiniTable
                      label="Drills"
                      cols={[{ label: 'Recovery plan' }, { label: 'Last drill', w: '200px' }, { label: 'Took', w: '128px' }, { label: 'Next due', w: '150px' }]}
                      rows={upcoming.map(rb => {
                        const last = s.drills.find(d => d.plan === rb.id);
                        const late = toMs(rb.nextDrill) < toMs(NOW);
                        return [
                          <Go key="n" ctx={ctx} to="dr/recovery" id={rb.id}>{rb.name}</Go>,
                          last ? <Status key="l" icon={last.r === 'ok' ? 'circle-check' : last.r === 'warn' ? 'triangle-alert' : 'circle-x'} tone={last.r} label={`${short(last.when)}${last.r === 'warn' ? ' · warnings' : ''}`} tip={last.evidence} /> : <span key="l" style={{ color: 'var(--tx-3)', fontStyle: 'italic' }}>Never tested</span>,
                          last ? <span key="t" data-tip={`RTO target ${rb.rtoTarget}`}>{last.dur} of {rb.rtoTarget}</span> : <span key="t" style={{ color: 'var(--tx-3)' }}>—</span>,
                          late ? <Status key="d" icon="triangle-alert" tone="warn" label={`Overdue · ${short(rb.nextDrill).split(',')[0]}`} tip={`Was due ${rb.nextDrill}`} /> : <span key="d">{short(rb.nextDrill)}</span>
                        ];
                      })}
                      empty="No recovery plans in this scope."
                    />
                  </StateBlock>
                </div>
              </Panel>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <Panel title="Failover readiness" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Checked 06:00 IST</span>}>
                <StateBlock ui={ui} emptyText="">
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {scored
                      .sort((a, b) => (a.score ?? -1) - (b.score ?? -1))
                      .map(({ rb, score, checks }) => {
                        const top = checks.find(c => c.state === 'block') || checks.find(c => c.state === 'unread') || checks.find(c => c.state === 'warn');
                        return (
                          <li key={rb.id}>
                            <button type="button" onClick={() => ctx.go('dr/recovery', rb.id)} className={pc('hover', 'background:var(--hover)')} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px 48px', gap: 12, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--ln)', textAlign: 'left', transition: 'background-color 100ms' }}>
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rb.name}</span>
                                <span data-tip={top ? `${top.obj}: ${top.result}` : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                  {showCust ? <span>{custName(rb.customer)} ·</span> : null}
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{top ? (top.state === 'unread' ? 'Recovery site could not be read' : `${top.obj}: ${top.result}`) : 'Every check passed'}</span>
                                </span>
                              </span>
                              <Meter score={score} />
                              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontStyle: score == null ? 'italic' : 'normal', color: score == null ? 'var(--tx-3)' : 'var(--tx)' }}>{score == null ? 'Not read' : `${score} %`}</span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </StateBlock>
              </Panel>
              <Panel title="Lag and replication alerts" right={<Go ctx={ctx} to="activity/alerts">All alerts</Go>}>
                <StateBlock ui={ui} emptyText="">
                  {lagAlerts.length ? (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {lagAlerts.map(a => (
                        <li key={a.id} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--ln)' }}>
                          <Icon name={a.sev === 'critical' ? 'circle-x' : 'triangle-alert'} style={{ color: a.sev === 'critical' ? 'var(--err)' : 'var(--warn)', marginTop: 2 }} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <strong style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{a.object}</strong>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</span>
                              {a.state !== 'open' ? <Tag>{a.state === 'acknowledged' ? 'Acknowledged' : 'Escalated'}</Tag> : null}
                            </span>
                            <span data-tip={a.detail} data-tip-overflow="" style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {short(a.raised)} · {a.detail}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ padding: 16, color: 'var(--tx-2)' }}>No replication alerts. Every replicated workload synced within its target.</p>
                  )}
                </StateBlock>
              </Panel>
              {gaps.length ? (
                <Panel title={<>Not replicated <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>{gaps.length}</span></>} right={<Go ctx={ctx} to="dr/plans">Protection plans</Go>}>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {gaps.map(w => (
                      <li key={w.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, alignItems: 'center', minHeight: 40, padding: '0 16px', borderBottom: '1px solid var(--ln)' }}>
                        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Go ctx={ctx} to="workloads" id={w.id}>{w.name}</Go>
                          <span style={{ color: 'var(--tx-3)', font: '12px var(--f-ui)' }}> · needs RPO {TIER_TARGET[w.tier]!.rpo}</span>
                        </span>
                        <TierTag tier={w.tier} short />
                        <Btn kind="ghost" size="sm" icon="plus" perm={ctx.can('configure', 'Adding workloads to a protection plan')} onClick={() => ctx.go('dr/plans')}>
                          Protect
                        </Btn>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Page>
  );
}

type Row = ReturnType<typeof rpoOf> & { w: ReturnType<typeof drWorkloads>[number]; info: (typeof DR_INFO)[string] };

/** One bar per workload: newest point age as a share of its own target. The target line sits in the middle. */
function RpoChart({ ctx, rows, showCust }: { ctx: Ctx; rows: Row[]; showCust: boolean }) {
  return (
    <div role="figure" aria-label="Recovery point age against target, one bar per workload" style={{ padding: '8px 16px 12px' }}>
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr) 132px', gap: 12, height: 24, alignItems: 'end', font: '11px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
        <span>Workload</span>
        <span style={{ position: 'relative', height: 16 }}>
          <span style={{ position: 'absolute', left: 0 }}>0</span>
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: 'var(--tx-2)' }}>Target</span>
          <span style={{ position: 'absolute', right: 0 }}>2 × target</span>
        </span>
        <span style={{ textAlign: 'right' }}>Newest point</span>
      </div>
      {rows.map(({ w, age, target, state, info }) => {
        const ratio = age != null && target ? age / target : 0;
        const pct = Math.min(1, ratio / 2) * 100;
        const st = D_ST[w.dr.s];
        const value = state === 'unreach' ? 'Could not be read' : state === 'online' ? (w.dr.s === 'returning' ? 'Returning' : 'At recovery site') : `${fmtMin(age!)} of ${w.dr.target}`;
        const tip = `${w.name} · ${state === 'unreach' ? w.dr.note : state === 'online' ? w.dr.note || 'Running at the recovery site' : `newest point ${fmtMin(age!)} old, target ${w.dr.target}`} · ${MODE_LABEL[info.mode]}${info.every ? ` every ${info.every}` : ''}`;
        return (
          <button
            key={w.id}
            type="button"
            data-tip={tip}
            onClick={() => ctx.go('workloads', w.id)}
            className={pc('hover', 'background:var(--hover)')}
            style={{ width: '100%', display: 'grid', gridTemplateColumns: '170px minmax(0,1fr) 132px', gap: 12, alignItems: 'center', height: 32, textAlign: 'left', transition: 'background-color 100ms' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Icon name={st.i} spin={st.spin} style={{ color: `var(--${RPO_TONE[state] === 'tx' ? 'tx-3' : RPO_TONE[state]})` }} />
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
            </span>
            <span style={{ position: 'relative', height: 20, display: 'block' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 1, background: 'var(--ln)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, marginLeft: -1, background: 'var(--tx-3)' }} />
              {state === 'unreach' || state === 'online' ? (
                <span style={{ position: 'absolute', left: 0, top: 3, font: 'italic 12px/14px var(--f-ui)', color: 'var(--tx-3)', background: 'var(--panel)', paddingRight: 6 }}>{state === 'unreach' ? 'Not read — not shown as zero' : w.dr.s === 'returning' ? 'Returning to primary' : 'Failed over; not replicating'}</span>
              ) : (
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 5, height: 10, width: `max(2px, ${pct}%)`, background: RPO_FILL[state], transition: 'width 300ms var(--ease)' }} />
              )}
              {ratio > 2 ? <span aria-hidden="true" style={{ position: 'absolute', right: -2, top: 2, font: '700 11px/16px var(--f-ui)', color: 'var(--tx-2)', background: 'var(--panel)', paddingLeft: 2 }}>›</span> : null}
            </span>
            <span style={{ textAlign: 'right', font: '12px/16px var(--f-ui)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: state === 'within' ? 'var(--tx-2)' : 'var(--tx)', fontStyle: state === 'unreach' ? 'italic' : 'normal' }}>{value}</span>
          </button>
        );
      })}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
        {[['var(--ok)', 'Within target'], ['var(--warn)', 'Behind target'], ['var(--err)', 'Last sync failed']].map(([c, l]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: c }} />
            {l}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 2, height: 12, background: 'var(--tx-3)' }} />
          Each workload’s own target
        </span>
      </div>
    </div>
  );
}

function RpoTable({ ctx, rows, showCust }: { ctx: Ctx; rows: Row[]; showCust: boolean }) {
  return (
    <div style={{ padding: '0 16px 4px' }}>
      <MiniTable
        label="Recovery point age against target"
        cols={[{ label: 'Workload', w: 'minmax(0,1.2fr)' }, ...(showCust ? [{ label: 'Customer', w: 'minmax(0,1fr)' }] : []), { label: 'Mode', w: '96px' }, { label: 'Newest point', w: '104px', r: true }, { label: 'Target', w: '64px', r: true }, { label: 'State', w: '150px' }]}
        rows={rows.map(({ w, age, state, info }) => {
          const st = D_ST[w.dr.s];
          return [
            <Go key="n" ctx={ctx} to="workloads" id={w.id}>{w.name}</Go>,
            ...(showCust ? [custName(w.customer)] : []),
            <span key="m" data-tip={MODE_LABEL[info.mode]}>{info.mode}</span>,
            state === 'unreach' ? <span key="a" style={{ fontStyle: 'italic', color: 'var(--tx-3)' }}>Not read</span> : age != null ? fmtMin(age) : '—',
            w.dr.target || '—',
            <Status key="s" icon={st.i} spin={st.spin} tone={st.c} label={st.l} />
          ];
        })}
      />
    </div>
  );
}

/** Readiness meter: the fill carries severity; the track is a lighter step. */
export function Meter({ score, width = 96 }: { score: number | null; width?: number }) {
  const tone = scoreTone(score);
  return (
    <span aria-hidden="true" style={{ display: 'block', width, height: 6, background: score == null ? 'transparent' : 'var(--ln)' }}>
      {score != null ? <span style={{ display: 'block', height: 6, width: `${score}%`, background: `var(--${tone})`, transition: 'width 300ms var(--ease)' }} /> : null}
    </span>
  );
}

