import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { AEGIS } from '../data/aegis';
import { CUSTOMERS, WORKLOADS } from '../data/platform';
import { FINDINGS, TICKETS } from '../data/ops';
import { Btn, Tag } from '../ui/controls';
import { Bar, MiniTable, Page, PageHeader, Panel, StateBlock, Status, Tiles, plural, type Kpi } from '../ui/layout';
import type { Ctx } from '../ui/ctx';
import { GetStarted } from './GetStarted';
import { custName, Go, inr, inScope, scopeCustomers } from './common';
import { inboxItems } from './Inbox';
import { useStore } from './store';
import { readiness } from '../products/resilience/data';
import { INVENTORY } from '../products/mobility/data';

const KIND_ICON: Record<string, string> = { approval: 'user-check', failed: 'circle-x', sla: 'clock', licence: 'key', drill: 'flask-conical', cutover: 'power' };
const DAYS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];
/** Worst job result per product per day for the last 14 days: o ok, w warnings, e failed. */
const RESULTS: Record<string, string> = { Protection: 'oooowooooweooe', Resilience: 'ooooooowoooowe', Mobility: 'ooooo-oowooo-o' };
const CELL = { o: ['circle-check', 'ok', 'Every job succeeded'], w: ['triangle-alert', 'warn', 'Finished with warnings'], e: ['circle-x', 'err', 'At least one job failed'], '-': ['minus', 'tx', 'No jobs ran'] } as const;
const LOCATIONS = [
  { city: 'Chennai, India', sites: [['Chennai-proxmox-prod', 'ok'], ['Chennai_Lab_Proxmox', 'ok'], ['production-openstack', 'ok'], ['Chennai vCenter', 'warn']] },
  { city: 'Hyderabad, India', sites: [['region-2-os', 'unreach']] },
  { city: 'Mumbai, India', sites: [['Mumbai DC2', 'ok'], ['mer-obj-immutable', 'ok']] },
  { city: 'Edge sites', sites: [['esxi-edge-07', 'warn']] },
  { city: 'Frankfurt, Germany', sites: [['atl-obj-fra', 'ok']] }
];

/** Home: role-aware. Providers see every customer and the commercial view; customers see their own estate. */
export default function Home({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  if (ctx.tab === 'start') return <GetStarted ctx={ctx} />;
  if (ctx.audience === 'self') return <SelfService ctx={ctx} />;
  const provider = ctx.audience === 'provider';
  const first = ctx.actingAs ? ctx.actingAs.owner.split(' ')[0] : 'Priya';
  const scope = scopeCustomers(ctx);
  const items = inboxItems(ctx);
  const plans = s.runbooks.filter(r => inScope(ctx, r.customer)).map(r => readiness(r).score).filter((x): x is number => x != null);
  const ready = plans.length ? Math.round(plans.reduce((a, b) => a + b, 0) / plans.length) : null;
  const inv = INVENTORY.filter(v => v.stage !== 'excluded' && scope.includes(v.customer) && inScope(ctx, v.customer));
  const migrated = inv.filter(v => v.stage === 'committed').length;
  const high = FINDINGS.filter(f => f.state === 'Open' && f.sev === 'High' && inScope(ctx, f.customer));
  const open = FINDINGS.filter(f => f.state === 'Open' && inScope(ctx, f.customer));
  const repos = AEGIS.repos as { name: string; used: number; cap: number; status: string; lock: string | null; enc: boolean }[];
  const used = repos.reduce((a, r) => a + r.used, 0);
  const cap = repos.reduce((a, r) => a + r.cap, 0);
  const custs = CUSTOMERS.filter(c => scope.includes(c.id) && inScope(ctx, c.id));
  const mrr = custs.reduce((a, c) => a + c.mrr, 0);
  const over = s.entitlements.filter(e => e.state === 'overage' && inScope(ctx, e.customer));
  const ws = WORKLOADS.filter(w => inScope(ctx, w.customer, w.project));
  const bOk = ws.filter(w => w.backup.s === 'protected').length;
  const bNeed = ws.filter(w => w.backup.s !== 'na').length;
  const ui = ctx.ui;
  const tiles: Kpi[] = [
    { label: 'Backups, last 24 h', value: provider && !ctx.actingAs ? '98.3' : `${Math.round((bOk / Math.max(1, bNeed)) * 100)}`, unit: '%', icon: 'archive', tone: 'ok', sub: provider && !ctx.actingAs ? '405 of 412 jobs succeeded · 1 failed' : `${bOk} of ${bNeed} workloads protected`, href: '#/backup/overview', loading: ui === 'loading' },
    { label: 'Failover readiness', value: ready == null ? 'Not read' : `${ready}`, unit: ready == null ? undefined : '%', icon: 'gauge', tone: ready == null ? 'warn' : ready >= 85 ? 'ok' : 'warn', sub: `${plural(plans.length, 'recovery plan')} read`, href: '#/dr/overview', unread: ready == null, loading: ui === 'loading' },
    { label: 'Migration', value: `${migrated}`, unit: `of ${inv.length}`, icon: 'forward', sub: inv.length ? `${inv.length - migrated} servers left; next window Sun 25 Oct` : 'No migration in this scope', href: '#/mig/overview', loading: ui === 'loading' },
    { label: 'Security findings', value: `${open.length}`, icon: high.length ? 'triangle-alert' : 'badge-check', tone: high.length ? 'err' : 'ok', sub: high.length ? `${high.length} high: ${high.map(f => f.object).join(', ')}` : 'No high findings', href: `#/${ctx.product}/security`, loading: ui === 'loading' },
    { label: 'Repository capacity', value: `${Math.round((used / cap) * 100)}`, unit: '%', icon: 'database', sub: `${(used / 1024).toFixed(2)} TB of ${(cap / 1024).toFixed(2)} TB in ${plural(repos.length, 'repository', 'repositories')}`, href: `#/${ctx.product}/repos`, loading: ui === 'loading' },
    provider && !ctx.actingAs
      ? { label: 'Monthly revenue', value: `₹${(mrr / 1e5).toFixed(1)} L`, icon: 'key', sub: over.length ? `${plural(over.length, 'licence')} over limit · ${custs.filter(c => c.status === 'trial').length} trial ends soon` : 'No licence over its limit', href: `#/${ctx.product}/billing`, loading: ui === 'loading' }
      : { label: 'Licence', value: s.entitlements.filter(e => inScope(ctx, e.customer)).length ? `${s.entitlements.find(e => inScope(ctx, e.customer))!.used}` : '—', unit: s.entitlements.find(e => inScope(ctx, e.customer)) ? `of ${s.entitlements.find(e => inScope(ctx, e.customer))!.limit}` : undefined, icon: 'key', sub: over.length ? `${over[0].product} is over its limit` : 'Within every limit', href: `#/${ctx.product}/billing`, loading: ui === 'loading' }
  ];
  if (ui === 'unreach') tiles.forEach(t => { t.value = 'Not read'; t.unit = undefined; t.unread = true; });
  return (
    <Page scroll>
      <PageHeader
        kicker={provider && !ctx.actingAs ? 'Host360 Managed Services · provider' : custName(ctx.actingAs?.customer || scope[0])}
        title={`Good afternoon, ${first}`}
        sub={provider && !ctx.actingAs ? `Protection, resilience and migration for ${plural(custs.length, 'customer')}, and what needs you.` : 'Your workloads across Protection, Resilience and Mobility, and what needs you.'}
        actions={
          <>
            <Btn kind="ghost" icon="list-ordered" onClick={() => ctx.go('home/start')}>Get started</Btn>
            <Btn kind="outline" icon="mail" onClick={() => ctx.go('inbox')}>
              Inbox {items.length ? `(${items.length})` : ''}
            </Btn>
          </>
        }
      />
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Tiles items={tiles} />
        {ui === 'unreach' ? <Bar tone="warn">Could not be read: the orchestrator did not answer within 30 s. Nothing is shown here until it can be read.</Bar> : null}
        {ui === 'live' || ui === 'loading' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
              <Panel title={<>Needs you <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>{items.length}</span></>} right={<Go ctx={ctx} to="inbox">Open the Inbox</Go>}>
                <StateBlock ui={ui} emptyText="">
                  {items.length ? (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {items.slice(0, 6).map(it => (
                        <li key={it.id}>
                          <button type="button" onClick={() => ctx.go(it.to, it.openId || it.approvalId)} className={pc('hover', 'background:var(--hover)')} style={{ width: '100%', display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--ln)', textAlign: 'left', transition: 'background-color 100ms' }}>
                            <Icon name={KIND_ICON[it.kind] || 'circle-dot'} style={{ color: it.urgent ? 'var(--warn)' : 'var(--tx-2)' }} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                              <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{provider && scope.length > 1 ? `${custName(it.customer)} · ` : ''}{it.detail}</span>
                            </span>
                            <span style={{ font: '600 13px var(--f-body)', color: 'var(--acc-tx)', whiteSpace: 'nowrap' }}>{it.action}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ padding: 16, color: 'var(--tx-2)' }}>Nothing needs you right now.</p>
                  )}
                </StateBlock>
              </Panel>
              <Panel title="Results, last 14 days" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Worst result per day</span>}>
                <StateBlock ui={ui} emptyText="">
                  <div role="table" aria-label="Results calendar" style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: `92px repeat(${DAYS.length},minmax(0,1fr))`, gap: 2, font: '11px/16px var(--f-ui)' }}>
                    <span />
                    {DAYS.map(d => (
                      <span key={d} role="columnheader" style={{ textAlign: 'center', color: 'var(--tx-3)' }}>{d}</span>
                    ))}
                    {Object.entries(RESULTS).map(([p, r]) => (
                      <div key={p} role="row" style={{ display: 'contents' }}>
                        <span role="rowheader" style={{ font: '12px/24px var(--f-ui)', color: 'var(--tx-2)' }}>{p}</span>
                        {r.split('').map((c, i) => {
                          const [ic, tone, tip] = CELL[c as keyof typeof CELL];
                          return (
                            <span key={i} role="cell" tabIndex={0} data-tip={`${p}, ${DAYS[i]} Oct: ${tip}`} style={{ height: 24, display: 'grid', placeItems: 'center', background: c === 'o' ? 'var(--ok-s)' : c === 'w' ? 'var(--warn-s)' : c === 'e' ? 'var(--err-s)' : 'transparent', border: '1px solid var(--ln)' }}>
                              <Icon name={ic} size={12} style={{ color: `var(--${tone === 'tx' ? 'tx-3' : tone})` }} />
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <p style={{ padding: '0 16px 12px', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>October 2026. Select a day in Alerts & Activity › Jobs to see each job.</p>
                </StateBlock>
              </Panel>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
              <Panel title="Sites by location" right={<Go ctx={ctx} to="sites">All sites</Go>}>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {LOCATIONS.filter(l => provider || l.city.includes('India')).map(l => (
                    <li key={l.city} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 12, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--ln)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <Icon name="map-pin" style={{ color: 'var(--tx-3)' }} />
                        {l.city}
                      </span>
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {l.sites.map(([n, st]) => (
                          <span key={n} data-tip={st === 'unreach' ? `${n}: could not be read since 14:52 IST` : st === 'warn' ? `${n}: needs attention` : `${n}: connected`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', border: '1px solid var(--ln-2)', font: '12px var(--f-ui)', whiteSpace: 'nowrap' }}>
                            <Icon name={st === 'ok' ? 'circle-check' : 'triangle-alert'} size={12} style={{ color: st === 'ok' ? 'var(--ok)' : 'var(--warn)' }} />
                            {n}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Storage" right={<Go ctx={ctx} to="repos">Repositories</Go>}>
                <div style={{ padding: '4px 16px 12px' }}>
                  <MiniTable
                    label="Repositories"
                    cols={[{ label: 'Repository' }, { label: 'Used', w: '150px' }, { label: '', w: '48px' }]}
                    rows={repos.map(r => [
                      <span key="n" style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                        <strong style={{ fontWeight: 600 }}>{r.name}</strong>
                        {r.status === 'degraded' ? <Tag tone="warn">Read-only</Tag> : null}
                      </span>,
                      <span key="u" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }} data-tip={`${r.used.toFixed(2)} GB of ${r.cap} GB`}>
                        <span style={{ flex: 1, height: 6, background: 'var(--ln)' }}>
                          <span style={{ display: 'block', height: 6, width: `${(r.used / r.cap) * 100}%`, background: r.used / r.cap > 0.85 ? 'var(--warn)' : 'var(--acc)' }} />
                        </span>
                        <span style={{ width: 36, textAlign: 'right', color: 'var(--tx-2)' }}>{Math.round((r.used / r.cap) * 100)} %</span>
                      </span>,
                      <span key="m" style={{ display: 'inline-flex', gap: 6, color: 'var(--tx-2)' }}>
                        {r.lock ? <Icon name="lock" data-tip={`Immutable: ${r.lock}`} /> : null}
                        {r.enc ? <Icon name="shield" data-tip="Encrypted" /> : null}
                      </span>
                    ])}
                  />
                </div>
              </Panel>
            </div>
            {provider && !ctx.actingAs ? (
              <Panel title="Customers" right={<Go ctx={ctx} to="customers">All customers</Go>}>
                <div style={{ padding: '0 16px 4px' }}>
                  <MiniTable
                    label="Customers"
                    cols={[{ label: 'Customer' }, { label: 'Status', w: '130px' }, { label: 'Readiness', w: '96px', r: true }, { label: 'Open alerts', w: '96px', r: true }, { label: 'Monthly', w: '120px', r: true }]}
                    rows={custs.filter(c => c.id !== 'h360').map(c => [
                      <Go key="n" ctx={ctx} to="customers" id={c.id}>{c.name}</Go>,
                      <Status key="s" icon={c.status === 'active' ? 'circle-check' : c.status === 'suspended' ? 'ban' : c.status === 'trial' ? 'timer' : 'loader-circle'} tone={c.status === 'active' ? 'ok' : c.status === 'suspended' ? 'err' : 'tx'} label={c.status === 'active' ? 'Active' : c.status === 'trial' ? 'Trial' : c.status === 'suspended' ? 'Suspended' : c.status === 'onboarding' ? 'Onboarding' : 'Archived'} />,
                      c.readiness ? `${c.readiness} %` : '—',
                      String(c.openAlerts ?? 0),
                      c.mrr ? inr(c.mrr) : '—'
                    ])}
                  />
                </div>
              </Panel>
            ) : null}
          </>
        ) : null}
      </div>
    </Page>
  );
}

/** What a customer's self-service user sees: one combined status, usage, invoices, reports and support. */
function SelfService({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const cid = ctx.actingAs?.customer || 'kav';
  const c = CUSTOMERS.find(x => x.id === cid)!;
  const ws = WORKLOADS.filter(w => w.customer === cid);
  const ent = s.entitlements.filter(e => e.customer === cid);
  const tickets = TICKETS.filter(t => t.customer === cid);
  const lastBackup = ws.map(w => w.backup.last).filter(Boolean)[0];
  return (
    <Page scroll>
      <PageHeader
        kicker={c.whiteLabel || c.name}
        title={`Welcome, ${(ctx.actingAs?.owner || c.owner).split(' ')[0]}`}
        sub="Everything your provider runs for you, in one place."
        actions={
          <Btn kind="primary" icon="headset" onClick={() => ctx.go('support')}>
            Get help
          </Btn>
        }
      />
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Tiles
          items={[
            { label: 'Protected', value: `${ws.filter(w => w.backup.s === 'protected').length}`, unit: `of ${ws.filter(w => w.backup.s !== 'na').length}`, icon: 'archive', tone: 'ok', sub: lastBackup ? `Last backup ${lastBackup.replace(' 2026', '').replace(' IST', '')}` : 'No backups yet' },
            { label: 'Ready to recover', value: `${c.readiness || 0}`, unit: '%', icon: 'life-buoy', tone: (c.readiness || 0) >= 85 ? 'ok' : 'warn', sub: 'Measured at the last drill' },
            { label: 'Usage', value: ent[0] ? `${ent[0].used}` : '—', unit: ent[0] ? `of ${ent[0].limit} ${ent[0].unit}` : undefined, icon: 'gauge', sub: ent[0] ? `${ent[0].edition} · renews ${ent[0].expires}` : 'No licence' },
            { label: 'Stored', value: `${c.storedTB}`, unit: 'TB', icon: 'database', sub: `Data stays in: ${c.residency}` },
            { label: 'Open requests', value: `${tickets.filter(t => t.state !== 'Resolved').length}`, icon: 'ticket', sub: tickets[0] ? tickets[0].title : 'No open requests' }
          ]}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <Panel title="Your workloads" right={<Go ctx={ctx} to="workloads">All workloads</Go>}>
            <div style={{ padding: '0 16px 4px' }}>
              <MiniTable label="Workloads" cols={[{ label: 'Workload' }, { label: 'Backup', w: '150px' }, { label: 'Disaster recovery', w: '150px' }]} rows={ws.map(w => [<strong key="n" style={{ fontWeight: 600 }}>{w.name}</strong>, w.backup.s === 'protected' ? <Status key="b" icon="circle-check" tone="ok" label="Protected" /> : <Status key="b" icon="minus" tone="tx" label="Not included" />, w.dr.s === 'protected' ? <Status key="d" icon="circle-check" tone="ok" label={`Within ${w.dr.target}`} /> : <Status key="d" icon="minus" tone="tx" label="Not included" />])} />
            </div>
          </Panel>
          <Panel title="Invoices" right={<Go ctx={ctx} to="billing/entitlements">Billing</Go>}>
            <div style={{ padding: '0 16px 4px' }}>
              <MiniTable label="Invoices" cols={[{ label: 'Invoice' }, { label: 'Period', w: '110px' }, { label: 'Amount', w: '120px', r: true }, { label: 'State', w: '110px' }]} rows={[['INV-2026-1004', 'Oct 2026', inr(c.mrr || 212400), <Status key="s" icon="clock" tone="warn" label="Due 05 Nov" />], ['INV-2026-0911', 'Sep 2026', inr(c.mrr || 212400), <Status key="s" icon="circle-check" tone="ok" label="Paid" />], ['INV-2026-0809', 'Aug 2026', inr((c.mrr || 212400) - 8400), <Status key="s" icon="circle-check" tone="ok" label="Paid" />]]} />
            </div>
          </Panel>
          <Panel title="Reports" right={<Go ctx={ctx} to="reports">All reports</Go>}>
            <div style={{ padding: '0 16px 4px' }}>
              <MiniTable label="Reports" cols={[{ label: 'Report' }, { label: 'Last sent', w: '140px' }]} rows={[['Monthly protection summary', '01 Oct, 07:00'], ['Recovery drill evidence (DRL-0906)', '06 Sep, 22:30'], ['Restore activity', '01 Oct, 06:00']]} />
            </div>
          </Panel>
          <Panel title="Support" right={<Go ctx={ctx} to="support">Support</Go>}>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tickets.length ? tickets.map(t => <span key={t.id}>{t.id}: {t.title}</span>) : <span style={{ color: 'var(--tx-2)' }}>No requests. Your provider answers within 4 business hours.</span>}
              <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Provider: Host360 Managed Services · support@host360.ai · +91 44 4012 3600</span>
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
