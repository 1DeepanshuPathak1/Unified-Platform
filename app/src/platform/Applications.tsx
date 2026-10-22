import { useEffect, useMemo, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { CUSTOMERS, TIERS, TIER_RULES, TIER_SHORT, W_ICON, WORKLOADS, type Application, type Tier, type Workload } from '../data/platform';
import { Btn, CheckBox, Field, FilterInput, InfoTip, Seg, SelectFilter, SelectInput, TextArea, TextInput } from '../ui/controls';
import { DepGraph } from '../ui/DepGraph';
import { Bar, DrawerTiles, Facts, H3, MiniTable, Page, PageHeader, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { B_ST, D_ST, Go, M_ST, TIER_RANK, TierTag, custName, inScope, showCustomerCol } from './common';
import { audit, update, useStore } from './store';

type Combined = { l: string; i: string; c: string; rank: number; why: string };

/** One recovery state for the whole application, from its weakest member. */
export function combined(a: Application, members: Workload[]): Combined {
  const failing = members.filter(w => w.backup.s === 'failed' || w.dr.s === 'failed');
  const behind = members.filter(w => w.dr.s === 'behind' || w.dr.s === 'unreach' || w.backup.s === 'warn');
  const unprotected = members.filter(w => (w.backup.s === 'none' || w.backup.s === 'na') && (w.dr.s === 'none' || w.dr.s === 'na') && w.type !== 'DNS record');
  if (failing.length) return { l: 'At risk', i: 'circle-x', c: 'err', rank: 0, why: `${failing.map(w => w.name).join(', ')} failed its last backup or sync` };
  if (unprotected.length && (a.tier === 'Mission Critical' || a.tier === 'Business Critical')) return { l: 'Gaps', i: 'triangle-alert', c: 'warn', rank: 1, why: `${unprotected.map(w => w.name).join(', ')} not protected` };
  if (behind.length) return { l: 'Degraded', i: 'clock', c: 'warn', rank: 2, why: `${behind.map(w => w.name).join(', ')} behind target or with warnings` };
  if (!a.drPlan && (a.tier === 'Mission Critical' || a.tier === 'Business Critical')) return { l: 'No DR plan', i: 'circle-minus', c: 'warn', rank: 2, why: `${a.tier} applications need a recovery plan` };
  return { l: 'Recoverable', i: 'circle-check', c: 'ok', rank: 5, why: 'Every member is protected and within target' };
}

export default function Applications({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('All');
  const [view, setView] = useState<'list' | 'map'>(ctx.tab === 'map' ? 'map' : 'list');
  const [overlay, setOverlay] = useState<'groups' | 'boot' | 'waves'>('boot');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const create = useClosable<Application | 'new'>();
  useEffect(() => {
    if (ctx.openId && s.apps.some(a => a.id === ctx.openId)) {
      drawer.open(ctx.openId);
      setTab('Overview');
    }
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = s.apps.filter(a => inScope(ctx, a.customer));
  const mem = (a: Application) => a.members.map(id => WORKLOADS.find(w => w.id === id)).filter(Boolean) as Workload[];
  const ql = q.trim().toLowerCase();
  const rows = all.filter(a => (tier === 'All' || a.tier === tier) && (!ql || `${a.name} ${a.owner} ${a.description}`.toLowerCase().includes(ql)));
  const custCol = showCustomerCol(ctx);
  const cfg = ctx.can('configure', 'Creating applications');
  const d = drawer.value ? s.apps.find(a => a.id === drawer.value) : null;
  return (
    <Page>
      <PageHeader
        kicker="Platform"
        title="Applications"
        sub="Named groups of workloads, databases, DNS records and load balancers that are protected and recovered together."
        actions={
          <Btn kind="primary" icon="plus" perm={cfg} onClick={() => create.open('new')}>
            Create an application
          </Btn>
        }
      />
      <Toolbar>
        <FilterInput value={q} onChange={setQ} placeholder="Filter by name, owner or description" label="Filter applications" />
        <SelectFilter label="Criticality" value={tier} onChange={setTier} options={['All', ...TIERS]} />
        <Spacer />
        {view === 'map' ? <Seg label="Show on the map" value={overlay} onChange={setOverlay} options={[{ v: 'boot', label: 'DR boot order' }, { v: 'groups', label: 'Consistency groups' }, { v: 'waves', label: 'Migration waves' }]} /> : null}
        <Seg label="View" value={view} onChange={v => { setView(v); ctx.go(`applications/${v}`); }} options={[{ v: 'list', label: 'List', icon: 'list' }, { v: 'map', label: 'Map', icon: 'git-branch' }]} />
      </Toolbar>
      {view === 'map' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.length ? (
            <DepGraph
              label="Application dependencies"
              nodes={rows.map(a => {
                const m = mem(a);
                const needsPlan = !a.drPlan && (a.tier === 'Mission Critical' || a.tier === 'Business Critical');
                return overlay === 'groups'
                  ? { id: a.id, label: a.name, sub: `${plural(m.length, 'member')}: ${m.map(w => w.name).join(', ')}`, badge: TIER_SHORT[a.tier], group: a.customer }
                  : overlay === 'boot'
                    ? { id: a.id, label: a.name, sub: a.drPlan || 'No recovery plan', badge: TIER_SHORT[a.tier], tone: needsPlan ? ('warn' as const) : undefined, icon: needsPlan ? 'triangle-alert' : undefined, group: a.customer }
                    : { id: a.id, label: a.name, sub: a.wave || 'Not migrating', badge: a.wave ? a.wave.split(' · ')[0] : undefined, group: a.wave || 'zz' };
              })}
              edges={rows.flatMap(a => a.dependsOn.map(d => [d, a.id] as [string, string]))}
              columnLabel={i => (overlay === 'waves' ? (i ? `Moves after step ${i}` : 'Can move first') : overlay === 'boot' ? (i ? `Boots in step ${i + 1}` : 'Boots first') : i ? `Depends on step ${i}` : 'Depends on nothing')}
              onOpen={id => { drawer.open(id); setTab('Dependencies'); }}
            />
          ) : (
            <p style={{ color: 'var(--tx-2)' }}>No applications match. Clear the filters to see the map.</p>
          )}
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
            {overlay === 'boot' ? 'In a failover each column comes up after the one to its left. Applications without a recovery plan are marked.' : overlay === 'groups' ? 'Each application is one consistency group: its members are snapshotted together so they restore to the same moment.' : 'An application moves no earlier than what it depends on. Waves are set in Mobility › Migration plans.'} Dependencies come from network flows seen during discovery and from what owners add.
          </p>
        </div>
      ) : (
      <TableArea>
        <AegisTable
          label="Applications"
          cols={[
            { k: 'name', label: 'Application', w: 'minmax(180px,1.4fr)' },
            ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(140px,1fr)', dim: true }] : []),
            { k: 'tier', label: 'Criticality', w: '136px' },
            { k: 'n', label: 'Members', w: '80px', r: true },
            { k: 'bk', label: 'Backed up', w: '96px', r: true },
            { k: 'dr', label: 'Recovery plan', w: 'minmax(150px,1fr)' },
            { k: 'drill', label: 'Last drill', w: 'minmax(150px,1fr)' },
            { k: 'state', label: 'Recovery state', w: '140px' }
          ]}
          rows={rows.map(a => {
            const m = mem(a);
            const c = combined(a, m);
            const bk = m.filter(w => w.backup.s === 'protected' || w.backup.s === 'warn' || w.backup.s === 'running').length;
            const need = m.filter(w => w.backup.s !== 'na').length;
            return {
              id: a.id,
              name: { v: a.name, strong: true, tip: a.description },
              cust: custName(a.customer),
              tier: { v: a.tier, s: TIER_RANK[a.tier] },
              n: { v: String(m.length), s: m.length },
              bk: need ? { v: `${bk} of ${need}`, s: bk / need } : { v: '—', muted: true, s: 2 },
              dr: a.drPlan || { v: 'None', muted: true },
              drill: a.lastDrill ? { t: 'status', i: a.lastDrill.r === 'ok' ? 'circle-check' : a.lastDrill.r === 'warn' ? 'triangle-alert' : 'circle-x', l: a.lastDrill.when.replace(' 2026', ''), c: a.lastDrill.r, tip: `RTO ${a.lastDrill.rto}` } : { v: 'Never', muted: true, italic: true },
              mig: a.wave || { v: '—', muted: true },
              state: { t: 'status', i: c.i, l: c.l, c: c.c, s: c.rank, tip: c.why }
            };
          })}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['application', 'applications']}
          filtered={tier !== 'All' || !!ql}
          onClear={() => { setTier('All'); setQ(''); }}
          emptyText="No applications yet. Group the workloads that make up a service so they are recovered together, in order."
          emptyAction="Create an application"
          onEmpty={() => create.open('new')}
          sort="state"
        />
      </TableArea>
      )}
      {d ? <AppDrawer ctx={ctx} a={d} members={mem(d)} tab={tab} setTab={setTab} closing={drawer.closing} onClose={drawer.close} onEdit={() => create.open(d)} /> : null}
      {create.value ? (
        <AppDialog
          ctx={ctx}
          app={create.value === 'new' ? null : create.value}
          closing={create.closing}
          onClose={create.close}
          onSave={a => {
            update(st => {
              const i = st.apps.findIndex(x => x.id === a.id);
              if (i >= 0) st.apps[i] = a;
              else st.apps.unshift(a);
            });
            audit({ who: 'priya.raman', customer: a.customer, what: create.value === 'new' ? 'Created application' : 'Edited application', object: a.name, when: ctx.now(), r: 'ok' });
            ctx.toast(create.value === 'new' ? `Application ${a.name} created` : `Application ${a.name} saved`, 'ok');
            create.close();
            drawer.open(a.id);
          }}
        />
      ) : null}
    </Page>
  );
}

function AppDrawer({ ctx, a, members, tab, setTab, closing, onClose, onEdit }: { ctx: Ctx; a: Application; members: Workload[]; tab: string; setTab: (t: string) => void; closing: boolean; onClose: () => void; onEdit: () => void }) {
  const s = useStore();
  const c = combined(a, members);
  const deps = a.dependsOn.map(id => s.apps.find(x => x.id === id)).filter(Boolean) as Application[];
  const usedBy = s.apps.filter(x => x.dependsOn.includes(a.id));
  const order = [...members].sort((x, y) => (x.type === 'Database' || /db|sql/i.test(x.name) ? 0 : x.type === 'Load balancer' || x.type === 'DNS record' ? 2 : 1) - (y.type === 'Database' || /db|sql/i.test(y.name) ? 0 : y.type === 'Load balancer' || y.type === 'DNS record' ? 2 : 1));
  return (
    <Drawer
      label="Application details"
      width={680}
      kicker={`Application · ${custName(a.customer)}`}
      title={a.name}
      status={
        <>
          <TierTag tier={a.tier} />
          <Status icon={c.i} label={c.l} tone={c.c} tip={c.why} />
          <span>Owner {a.owner}</span>
        </>
      }
      actions={
        <>
          <Btn kind="outline" icon="pencil" perm={ctx.can('configure', 'Editing applications')} onClick={onEdit}>
            Edit…
          </Btn>
          {a.drPlan ? (
            <Btn kind="outline" icon="flask-conical" perm={ctx.can('operate', 'Running drills')} onClick={() => ctx.go('dr/recovery')}>
              Test failover…
            </Btn>
          ) : (
            <Btn kind="outline" icon="list-ordered" perm={ctx.can('configure', 'Creating recovery plans')} onClick={() => ctx.go('dr/recovery')}>
              Create a recovery plan
            </Btn>
          )}
          <Btn kind="outline" icon="play" perm={ctx.can('operate', 'Starting backups')} onClick={() => { ctx.startJob({ name: 'Application backup', object: a.name, product: 'Backup', phases: ['Queued', 'Quiesce databases', 'Snapshot group', 'Write', 'Verify', 'Done'], speed: 6, rate: '210 MB/s', doneToast: `Consistent backup of ${a.name} finished` }); ctx.toast(`Consistent backup of ${a.name} started`, 'info'); }}>
            Back up together
          </Btn>
        </>
      }
      tabs={[
        { v: 'Overview', label: 'Overview' },
        { v: 'Members', label: 'Members', count: members.length },
        { v: 'Dependencies', label: 'Dependencies', count: deps.length + usedBy.length },
        { v: 'Recovery', label: 'Recovery order' }
      ]}
      tab={tab}
      onTab={setTab}
      closing={closing}
      onClose={onClose}
    >
      {tab === 'Overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {c.c !== 'ok' ? <Bar tone={c.c === 'err' ? 'err' : 'warn'} multiline>{c.why}.</Bar> : null}
          <DrawerTiles
            items={[
              { label: 'Members', value: String(members.length), sub: [...new Set(members.map(m => m.type))].join(', ') },
              { label: 'Backed up', value: `${members.filter(w => ['protected', 'warn', 'running'].includes(w.backup.s)).length} of ${members.filter(w => w.backup.s !== 'na').length}`, sub: 'Members that need backup' },
              { label: 'Last drill', value: a.lastDrill ? (a.lastDrill.r === 'ok' ? 'Passed' : 'Close to RTO') : 'Never', icon: a.lastDrill ? (a.lastDrill.r === 'ok' ? 'circle-check' : 'triangle-alert') : 'circle-minus', tone: a.lastDrill ? a.lastDrill.r : 'tx', sub: a.lastDrill ? `${a.lastDrill.when} · RTO ${a.lastDrill.rto}` : 'No drill on record' }
            ]}
          />
          <Facts
            items={[
              { k: 'Description', v: a.description },
              { k: 'Customer', v: custName(a.customer) },
              { k: 'Owner', v: a.owner },
              { k: 'Criticality', v: a.tier },
              { k: 'Backup required', v: TIER_RULES[a.tier].backup },
              { k: 'DR required', v: TIER_RULES[a.tier].dr },
              { k: 'Drills', v: TIER_RULES[a.tier].drill },
              { k: 'Recovery plan', v: a.drPlan || 'None', muted: !a.drPlan },
              { k: 'Migration wave', v: a.wave || 'Not migrating', muted: !a.wave }
            ]}
          />
        </div>
      ) : null}
      {tab === 'Members' ? (
        <MiniTable
          label="Members"
          cols={[{ label: 'Workload', w: 'minmax(0,1.2fr)' }, { label: 'Type', w: '128px' }, { label: 'Backup', w: '128px' }, { label: 'DR', w: '128px' }, { label: 'Migration', w: '120px' }]}
          rows={members.map(w => [
            <Go key="n" ctx={ctx} to="workloads" id={w.id}>{w.name}</Go>,
            <span key="t" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name={W_ICON[w.type]} style={{ color: 'var(--tx-3)' }} />{w.type}</span>,
            <Status key="b" icon={B_ST[w.backup.s].i} label={B_ST[w.backup.s].l} tone={B_ST[w.backup.s].c} />,
            <Status key="d" icon={D_ST[w.dr.s].i} label={D_ST[w.dr.s].l} tone={D_ST[w.dr.s].c} />,
            <Status key="m" icon={M_ST[w.mig.s].i} label={M_ST[w.mig.s].l} tone={M_ST[w.mig.s].c} />
          ])}
        />
      ) : null}
      {tab === 'Dependencies' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <DepDiagram app={a} deps={deps} usedBy={usedBy} />
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>Applications it depends on come back first in a failover and move in an earlier migration wave.</p>
        </div>
      ) : null}
      {tab === 'Recovery' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <H3 right={<InfoTip tip="Derived from member types and dependencies: databases first, then application servers, then the load balancer and DNS. Change it in the recovery plan." />}>Boot order in a failover</H3>
          <ol style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)' }}>
            {order.map((w, i) => (
              <li key={w.id} style={{ display: 'grid', gridTemplateColumns: '28px 20px minmax(0,1fr) auto', gap: 10, alignItems: 'center', minHeight: 40, padding: '0 12px', borderBottom: i < order.length - 1 ? '1px solid var(--ln)' : 'none' }}>
                <span style={{ font: '700 12px var(--f-ui)', color: 'var(--tx-3)' }}>{i + 1}</span>
                <Icon name={W_ICON[w.type]} style={{ color: 'var(--tx-2)' }} />
                <span style={{ fontWeight: 600 }}>{w.name}</span>
                <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{w.type === 'DNS record' ? 'Update record' : w.type === 'Load balancer' ? 'Recreate listeners' : 'Wait until serving'}</span>
              </li>
            ))}
          </ol>
          {a.drPlan ? (
            <Btn kind="outline" icon="list-ordered" onClick={() => ctx.go('dr/recovery')} style={{ alignSelf: 'flex-start' }}>
              Open recovery plan {a.drPlan}
            </Btn>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

/** Upstream applications, this one, downstream ones; drawn with boxes and 1 px connectors. */
function DepDiagram({ app, deps, usedBy }: { app: Application; deps: Application[]; usedBy: Application[] }) {
  const box = (a: Application, on?: boolean) => (
    <div key={a.id} style={{ padding: '8px 12px', border: `1px solid ${on ? 'var(--acc)' : 'var(--ln-2)'}`, background: on ? 'var(--acc-soft)' : 'var(--panel-2)', minWidth: 0 }}>
      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
      <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{a.tier}</div>
    </div>
  );
  const col = (title: string, items: Application[], empty: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{title}</span>
      {items.length ? items.map(x => box(x)) : <span style={{ font: '13px var(--f-ui)', color: 'var(--tx-3)' }}>{empty}</span>}
    </div>
  );
  return (
    <div role="img" aria-label={`${app.name} depends on ${deps.map(d => d.name).join(', ') || 'nothing'}; used by ${usedBy.map(d => d.name).join(', ') || 'nothing'}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 32px minmax(0,1fr) 32px minmax(0,1fr)', alignItems: 'center' }}>
      {col('Depends on', deps, 'Nothing')}
      <span style={{ height: 1, background: 'var(--ln-2)', position: 'relative' }}><Icon name="arrow-right" style={{ position: 'absolute', right: -4, top: -8, color: 'var(--tx-3)' }} /></span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>This application</span>
        {box(app, true)}
      </div>
      <span style={{ height: 1, background: 'var(--ln-2)', position: 'relative' }}><Icon name="arrow-right" style={{ position: 'absolute', right: -4, top: -8, color: 'var(--tx-3)' }} /></span>
      {col('Used by', usedBy, 'Nothing')}
    </div>
  );
}

function AppDialog({ ctx, app, closing, onClose, onSave }: { ctx: Ctx; app: Application | null; closing: boolean; onClose: () => void; onSave: (a: Application) => void }) {
  const s = useStore();
  const custs = CUSTOMERS.filter(c => inScope(ctx, c.id) && c.status !== 'archived');
  const [name, setName] = useState(app?.name || '');
  const [customer, setCustomer] = useState(app?.customer || custs[0].id);
  const [tier, setTier] = useState<Tier>(app?.tier || 'Business Critical');
  const [owner, setOwner] = useState(app?.owner || '');
  const [desc, setDesc] = useState(app?.description || '');
  const [members, setMembers] = useState<Record<string, boolean>>(Object.fromEntries((app?.members || []).map(m => [m, true])));
  const [q, setQ] = useState('');
  const pool = useMemo(() => WORKLOADS.filter(w => w.customer === customer), [customer]);
  const taken = (w: Workload) => s.apps.some(x => x.id !== app?.id && x.members.includes(w.id));
  const n = Object.values(members).filter(Boolean).length;
  const dupe = s.apps.some(x => x.id !== app?.id && x.customer === customer && x.name.toLowerCase() === name.trim().toLowerCase());
  return (
    <Dialog
      size="lg"
      title={app ? `Edit ${app.name}` : 'Create an application'}
      sub="Members are backed up as one consistency group and recovered in dependency order."
      closing={closing}
      onClose={onClose}
      footNote={plural(n, 'member')}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            kind="primary"
            icon="check"
            disabled={!name.trim() || !n || dupe || !owner.trim()}
            why={!name.trim() ? 'Name the application.' : dupe ? 'That name is taken.' : !owner.trim() ? 'Name an owner.' : 'Add at least one member.'}
            onClick={() => onSave({ id: app?.id || 'app' + Date.now(), name: name.trim(), customer, tier, owner: owner.trim(), description: desc.trim() || 'No description.', members: Object.keys(members).filter(k => members[k]), dependsOn: app?.dependsOn || [], drPlan: app?.drPlan, lastDrill: app?.lastDrill, wave: app?.wave })}
          >
            {app ? 'Save' : 'Create application'}
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="ap-name" label="Name" err={dupe ? `${custName(customer)} already has an application with this name.` : null}>
          <TextInput id="ap-name" value={name} onChange={setName} placeholder="Internet banking" invalid={dupe} />
        </Field>
        <Field id="ap-cust" label="Customer">
          <SelectInput id="ap-cust" value={customer} onChange={v => { setCustomer(v); setMembers({}); }} options={custs.map(c => ({ v: c.id, label: c.name }))} />
        </Field>
        <Field id="ap-tier" label="Criticality" hint={TIER_RULES[tier].dr}>
          <SelectInput id="ap-tier" value={tier} onChange={v => setTier(v as Tier)} options={TIERS} />
        </Field>
        <Field id="ap-owner" label="Owner">
          <TextInput id="ap-owner" value={owner} onChange={setOwner} placeholder="Suresh Iyer" />
        </Field>
      </div>
      <Field id="ap-desc" label="Description">
        <TextArea id="ap-desc" value={desc} onChange={setDesc} rows={2} placeholder="What the application does for the business" />
      </Field>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ padding: 0, marginBottom: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Members from {custName(customer)}</legend>
        <FilterInput value={q} onChange={setQ} placeholder="Filter workloads" label="Filter workloads" width={260} />
        <div style={{ border: '1px solid var(--ln)', maxHeight: 220, overflow: 'auto' }}>
          {pool.filter(w => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase())).map(w => (
            <div key={w.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 150px 140px', alignItems: 'center', minHeight: 36, padding: '0 12px', borderBottom: '1px solid var(--ln)', font: '13px var(--f-ui)' }}>
              <CheckBox on={!!members[w.id]} onChange={v => setMembers(m => ({ ...m, [w.id]: v }))} disabled={taken(w)} why="Already in another application.">
                <span style={{ fontWeight: 600 }}>{w.name}</span>
              </CheckBox>
              <span style={{ color: 'var(--tx-2)' }}>{w.type}</span>
              <span style={{ color: 'var(--tx-2)' }}>{w.tier}</span>
            </div>
          ))}
          {!pool.length ? <p style={{ padding: 12, color: 'var(--tx-2)' }}>{custName(customer)} has no discovered workloads yet.</p> : null}
        </div>
      </fieldset>
      {Object.keys(members).some(k => members[k] && TIER_RANK[WORKLOADS.find(w => w.id === k)!.tier] > TIER_RANK[tier]) ? (
        <Bar tone="info" multiline>
          Members with a lower criticality are raised to {tier} while they belong to this application.
        </Bar>
      ) : null}
    </Dialog>
  );
}
