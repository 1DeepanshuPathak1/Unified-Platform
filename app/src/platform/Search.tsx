import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { AEGIS } from '../data/aegis';
import { APPLICATIONS, CUSTOMERS, P_ALERTS, POLICIES, USERS, WORKLOADS, W_ICON, customerById, type Workload } from '../data/platform';
import { Btn, FilterInput, Seg } from '../ui/controls';
import { Bar, Facts, Page, PageHeader, Panel, Status, Toolbar, plural } from '../ui/layout';
import type { Ctx } from '../ui/ctx';
import { B_ST, D_ST, M_ST, TierTag, custName } from './common';
import { store } from './store';
import { INVENTORY, STAGE_LABEL } from '../products/mobility/data';

export type Hit = { type: string; label: string; sub: string; route: string; id?: string };

/** One index over every product and the platform. */
export function searchAll(q: string): Hit[] {
  const ql = q.trim().toLowerCase();
  if (!ql) return [];
  const m = (s: string) => s.toLowerCase().includes(ql);
  const hits: Hit[] = [];
  WORKLOADS.filter(w => m(w.name) || m(w.os) || w.tags.some(m)).forEach(w => hits.push({ type: 'Workload', label: w.name, sub: `${w.type} · ${custName(w.customer)} · ${w.site}`, route: 'workloads', id: w.id }));
  APPLICATIONS.filter(a => m(a.name) || a.members.some(id => m(WORKLOADS.find(w => w.id === id)?.name || ''))).forEach(a => hits.push({ type: 'Application', label: a.name, sub: `${custName(a.customer)} · ${a.tier}`, route: 'applications', id: a.id }));
  CUSTOMERS.filter(c => m(c.name) || m(c.owner)).forEach(c => hits.push({ type: 'Customer', label: c.name, sub: `${c.plan} · owner ${c.owner}`, route: 'customers', id: c.id }));
  USERS.filter(u => u.status !== 'deleted' && (m(u.name) || m(u.email))).forEach(u => hits.push({ type: 'Person', label: u.name, sub: `${u.email} · ${custName(u.customer)}`, route: 'settings/users', id: u.id }));
  P_ALERTS.filter(a => m(a.object) || m(a.title)).forEach(a => hits.push({ type: 'Alert', label: `${a.title} · ${a.object}`, sub: `${a.product} · ${a.raised}`, route: 'activity/alerts', id: a.id }));
  POLICIES.filter(p => m(p.name)).forEach(p => hits.push({ type: 'Policy', label: p.name, sub: `${p.type} policy · ${p.level}`, route: 'automation/policies', id: p.id }));
  store.runbooks.filter(r => m(r.name) || m(r.to)).forEach(r => hits.push({ type: 'Plan', label: r.name, sub: `Recovery plan · ${custName(r.customer)} · ${r.from} → ${r.to}`, route: 'dr/recovery', id: r.id }));
  INVENTORY.filter(v => (m(v.name) || m(v.os)) && !hits.some(h => h.label === v.name)).forEach(v => hits.push({ type: 'Server', label: v.name, sub: `VMware source ${v.source} · ${STAGE_LABEL[v.stage]}`, route: 'mig/sources', id: v.id }));
  (AEGIS.search as Hit[]).filter(x => m(x.label) || m(x.sub)).forEach(x => {
    if (!hits.some(h => h.label === x.label && (h.type === 'Workload' || h.type === x.type))) hits.push(x);
  });
  return hits;
}

const KIND_ICON: Record<string, string> = { Workload: 'layers', Application: 'workflow', Customer: 'users', Person: 'user', Alert: 'bell', Policy: 'clipboard-list', Site: 'map-pin', Guest: 'monitor', Server: 'server', Job: 'activity', Repository: 'database', Plan: 'list-ordered' };

/** The full results page: the best match summarised across products, then everything grouped by kind. */
export default function SearchPage({ ctx }: { ctx: Ctx }) {
  const initial = decodeURIComponent(ctx.tab || '');
  const [q, setQ] = useState(initial);
  const [kind, setKind] = useState('All');
  const hits = searchAll(q);
  const kinds = [...new Set(hits.map(h => h.type))];
  const shown = hits.filter(h => kind === 'All' || h.type === kind);
  const exact = WORKLOADS.find(w => w.name.toLowerCase() === q.trim().toLowerCase()) || (hits[0]?.type === 'Workload' ? WORKLOADS.find(w => w.id === hits[0].id) : undefined);
  return (
    <Page scroll>
      <PageHeader kicker="Platform" title={q.trim() ? `Results for “${q.trim()}”` : 'Search'} sub="Workloads, recovery points, plans, migrations, alerts, people and customers in one place." meta={q.trim() ? plural(hits.length, 'result') : undefined} />
      <Toolbar>
        <FilterInput value={q} onChange={v => { setQ(v); setKind('All'); }} placeholder="Search everything" label="Search" width={320} />
        {kinds.length > 1 ? <Seg label="Kind" value={kind} onChange={setKind} options={[{ v: 'All', label: 'All', count: hits.length }, ...kinds.map(k => ({ v: k, label: k, count: hits.filter(h => h.type === k).length }))]} /> : null}
      </Toolbar>
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ctx.ui === 'unreach' ? <Bar tone="warn">Could not be read: the search index did not answer within 30 s. Results are not shown until it can be read.</Bar> : null}
        {ctx.ui !== 'unreach' && exact && (kind === 'All' || kind === 'Workload') ? <BestMatch ctx={ctx} w={exact} /> : null}
        {ctx.ui !== 'unreach' && q.trim() && !hits.length ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', background: 'var(--panel)', border: '1px solid var(--ln)', color: 'var(--tx-2)' }}>Nothing matches “{q.trim()}”. Try a workload, application, customer, person, plan or alert name.</div>
        ) : null}
        {ctx.ui !== 'unreach'
          ? (kind === 'All' ? kinds : [kind]).map(k => (
              <Panel key={k} title={<><Icon name={KIND_ICON[k] || 'circle-dot'} style={{ color: 'var(--tx-3)' }} />{k === 'Person' ? 'People' : k === 'Policy' ? 'Policies' : `${k}s`}</>} right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{shown.filter(h => h.type === k).length}</span>}>
                {shown
                  .filter(h => h.type === k)
                  .map((h, i) => (
                    <button key={i} type="button" onClick={() => ctx.go(h.route, h.id)} className={pc('hover', 'background:var(--hover)')} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', width: '100%', minHeight: 44, padding: '0 16px', borderBottom: '1px solid var(--ln)', textAlign: 'left', transition: 'background-color 100ms' }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.label}</span>
                        <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.sub}</span>
                      </span>
                      <Icon name="chevron-right" style={{ color: 'var(--tx-3)' }} />
                    </button>
                  ))}
              </Panel>
            ))
          : null}
      </div>
    </Page>
  );
}

function BestMatch({ ctx, w }: { ctx: Ctx; w: Workload }) {
  const c = customerById(w.customer);
  const app = APPLICATIONS.find(a => a.members.includes(w.id));
  const alerts = P_ALERTS.filter(a => a.object === w.name);
  const b = B_ST[w.backup.s];
  const d = D_ST[w.dr.s];
  const m = M_ST[w.mig.s];
  const col = (title: string, icon: string, st: { i: string; l: string; c: string; spin?: boolean }, lines: string[], to: string, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px', borderLeft: '1px solid var(--ln)', minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
        <Icon name={icon} style={{ color: 'var(--tx-3)' }} />
        {title}
      </span>
      <Status icon={st.i} label={st.l} tone={st.c} spin={st.spin} />
      {lines.filter(Boolean).map((l, i) => (
        <span key={i} data-tip={l} data-tip-overflow="" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {l}
        </span>
      ))}
      <a href={`#/${ctx.product}/${to}`} onClick={e => { e.preventDefault(); ctx.go(to, to.startsWith('dr') || to.startsWith('mig') ? w.name : w.id); }} style={{ marginTop: 'auto', paddingTop: 4, font: '600 13px var(--f-body)', color: 'var(--acc-tx)' }}>
        {label}
      </a>
    </div>
  );
  return (
    <section aria-label="Best match" style={{ background: 'var(--panel)', border: '1px solid var(--acc)', boxShadow: 'inset 0 0 0 1px var(--acc)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--ln)' }}>
        <Icon name={W_ICON[w.type]} size={20} style={{ color: 'var(--acc)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: '500 20px/28px var(--f-head)' }}>{w.name}</span>
            <TierTag tier={w.tier} />
            {w.sensitive ? <span data-tip="Sensitive: restores need an additional approver" style={{ display: 'inline-flex', color: 'var(--tx-2)' }}><Icon name="eye-off" /></span> : null}
          </div>
          <div style={{ font: '13px/18px var(--f-ui)', color: 'var(--tx-2)' }}>
            {w.type} · {w.os} · {w.site}
          </div>
        </div>
        <Btn kind="outline" icon="layers" onClick={() => ctx.go('workloads', w.id)}>
          Open workload
        </Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) repeat(4,minmax(0,1fr))' }}>
        <div style={{ padding: '14px 16px', minWidth: 0 }}>
          <Facts labelW={84} items={[{ k: 'Customer', v: c.name }, { k: 'Owner', v: w.owner }, { k: 'Application', v: app ? app.name : 'None', muted: !app }]} />
        </div>
        {col('Backups', 'archive', b, [w.backup.policy || w.backup.note || '', w.backup.last ? `Last ${w.backup.last}` : '', w.backup.points != null ? `${w.backup.points} recovery points` : ''], 'backup/restore', 'Restore…')}
        {col('DR plan', 'life-buoy', d, [w.dr.plan || w.dr.note || '', w.dr.age ? `Newest point ${w.dr.age} old, target ${w.dr.target}` : ''], 'dr/servers', 'Open in Resilience')}
        {col('Migration', 'forward', m, [w.mig.wave || w.mig.note || '', w.mig.next ? `Next: ${w.mig.next}` : ''], 'mig/servers', 'Open in Mobility')}
        {col('Alerts', 'bell', alerts.length ? { i: alerts.some(a => a.sev === 'critical') ? 'circle-x' : 'triangle-alert', l: plural(alerts.length, 'open alert'), c: alerts.some(a => a.sev === 'critical') ? 'err' : 'warn' } : { i: 'circle-check', l: 'No open alerts', c: 'ok' }, alerts.map(a => a.title), 'activity/alerts', 'See alerts')}
      </div>
    </section>
  );
}
