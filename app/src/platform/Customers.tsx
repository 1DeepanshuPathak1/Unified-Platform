import { useEffect, useState, type ReactElement } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { PARTNERS, POLICIES, type Customer, type CustomerStatus, type ProductName } from '../data/platform';
import { Btn, CheckBox, Field, FilterInput, InfoTip, RadioCard, Seg, SelectInput, TextInput, Toggle, Tag } from '../ui/controls';
import { Bar, DrawerTiles, Facts, H3, MiniTable, Page, PageHeader, Section, Spacer, TableArea, Toolbar, plural } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { inr } from './common';
import { audit, update, useStore } from './store';

const ST: Record<CustomerStatus, [string, string, string]> = {
  active: ['circle-check', 'Active', 'ok'],
  trial: ['clock', 'Trial', 'run'],
  onboarding: ['loader-circle', 'Onboarding', 'run'],
  suspended: ['ban', 'Suspended', 'err'],
  archived: ['archive', 'Archived', 'tx']
};

type Tab = 'list' | 'tree';

export default function Customers({ ctx }: { ctx: Ctx }) {
  const tab = (ctx.tab === 'tree' ? 'tree' : 'list') as Tab;
  const wizard = useClosable<boolean>();
  if (ctx.actingAs)
    return (
      <Page>
        <PageHeader kicker="Platform" title="Customers" sub="Only Host360 staff manage customers." />
        <div style={{ padding: '0 24px' }}>
          <Bar tone="info">You are acting as a customer owner. Return to the Host360 console to manage customers.</Bar>
        </div>
      </Page>
    );
  return (
    <Section<Tab>
      kicker="Platform"
      title="Customers"
      sub="Every tenant Host360 serves, directly or through a partner, and how each one is organised."
      tab={tab}
      onTab={t => ctx.go(`customers/${t}`)}
      tabs={[
        { v: 'list', label: 'Customers' },
        { v: 'tree', label: 'Hierarchy' }
      ]}
      actions={
        <Btn kind="primary" icon="plus" perm={ctx.can('admin', 'Onboarding customers')} onClick={() => wizard.open(true)}>
          Onboard a customer
        </Btn>
      }
    >
      {tab === 'list' ? <CustomerList ctx={ctx} /> : <Hierarchy ctx={ctx} />}
      {wizard.value ? <OnboardWizard ctx={ctx} closing={wizard.closing} onClose={wizard.close} /> : null}
    </Section>
  );
}

function CustomerList({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [view, setView] = useState<'all' | CustomerStatus>('all');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const suspend = useClosable<string>();
  const archive = useClosable<string>();
  useEffect(() => {
    if (ctx.openId && s.customers.some(c => c.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const ql = q.trim().toLowerCase();
  const rows = s.customers.filter(c => (view === 'all' ? c.status !== 'archived' : c.status === view) && (!ql || `${c.name} ${c.owner} ${c.partner || ''} ${c.city}`.toLowerCase().includes(ql)));
  const d = drawer.value ? s.customers.find(c => c.id === drawer.value) : null;
  const adm = ctx.can('admin', 'Changing a customer');
  const setStatus = (id: string, st: CustomerStatus, note?: string) => update(x => Object.assign(x.customers.find(c => c.id === id)!, { status: st, statusNote: note }));
  return (
    <>
      <Toolbar>
        <Seg
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { v: 'all', label: 'All', count: s.customers.filter(c => c.status !== 'archived').length },
            { v: 'active', label: 'Active', count: s.customers.filter(c => c.status === 'active').length },
            { v: 'trial', label: 'Trial', count: s.customers.filter(c => c.status === 'trial').length },
            { v: 'onboarding', label: 'Onboarding', count: s.customers.filter(c => c.status === 'onboarding').length },
            { v: 'suspended', label: 'Suspended', count: s.customers.filter(c => c.status === 'suspended').length },
            { v: 'archived', label: 'Archived', count: s.customers.filter(c => c.status === 'archived').length }
          ]}
        />
        <FilterInput value={q} onChange={setQ} placeholder="Filter by name, owner, partner or city" label="Filter customers" />
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Customers"
          cols={[
            { k: 'name', label: 'Customer', w: 'minmax(170px,1.4fr)' },
            { k: 'via', label: 'Through', w: 'minmax(100px,1fr)', dim: true },
            { k: 'plan', label: 'Plan', w: 'minmax(140px,1.2fr)' },
            { k: 'prods', label: 'Products', w: '222px', nosort: true },
            { k: 'wl', label: 'Workloads', w: '84px', r: true },
            { k: 'tb', label: 'Stored', w: '84px', r: true },
            { k: 'ready', label: 'Readiness', w: '116px' },
            { k: 'mrr', label: 'Monthly', w: '104px', r: true },
            { k: 'st', label: 'Status', w: '120px' }
          ]}
          rows={rows.map(c => ({
            id: c.id,
            name: { v: c.name, strong: true, tip: `${c.name} · owner ${c.owner}` },
            via: c.partner || (c.kind === 'Internal' ? 'Host360' : 'Direct'),
            where: c.country,
            plan: c.plan,
            prods: c.products,
            wl: { v: String(c.workloads), s: c.workloads },
            tb: { v: c.storedTB ? `${c.storedTB.toFixed(2)} TB` : '—', s: c.storedTB, muted: !c.storedTB },
            ready: c.status === 'suspended' ? { v: 'Not checked', muted: true, s: -1 } : c.status === 'onboarding' ? { v: 'Not started', muted: true, s: -1 } : { t: 'bar', pct: c.readiness, v: `${c.readiness} %`, c: c.readiness >= 80 ? 'ok' : c.readiness >= 65 ? 'warn' : 'err' },
            mrr: c.mrr ? { v: inr(c.mrr), s: c.mrr } : { v: c.kind === 'Internal' ? 'Internal' : '—', muted: true, s: 0 },
            st: { t: 'status', i: ST[c.status][0], l: ST[c.status][1], c: ST[c.status][2], tip: c.statusNote || ST[c.status][1] }
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['customer', 'customers']}
          filtered={view !== 'all' || !!ql}
          onClear={() => { setView('all'); setQ(''); }}
          emptyText="No customers yet. Onboard the first one to start metering."
          sort="name"
          footR={`${inr(s.customers.reduce((a, c) => a + (c.status === 'active' ? c.mrr : 0), 0))} a month from active customers`}
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Customer details"
          width={680}
          kicker={`Customer · ${d.kind}${d.partner ? ` · ${d.partner}` : ''}`}
          title={d.name}
          status={
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name={ST[d.status][0]} style={{ color: `var(--${ST[d.status][2] === 'tx' ? 'tx-3' : ST[d.status][2]})` }} />
                <span style={{ color: 'var(--tx)' }}>{ST[d.status][1]}</span>
              </span>
              {d.statusNote ? <span>{d.statusNote}</span> : <span>{d.city}, {d.country}</span>}
            </>
          }
          actions={
            <>
              <Btn kind="outline" icon="user-check" disabled={d.status === 'suspended' || d.status === 'archived' || d.kind === 'Internal'} why={d.kind === 'Internal' ? 'This is Host360’s own tenant.' : `${d.name} is ${d.status}.`} onClick={() => ctx.loginAsOwner(d.id)}>
                Log in as owner…
              </Btn>
              {d.status === 'suspended' ? (
                <Btn kind="outline" icon="play" perm={adm} onClick={() => { setStatus(d.id, 'active'); audit({ who: 'priya.raman', customer: d.id, what: 'Reactivated a customer', object: d.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.name} reactivated; restores and sign-ins work again`, 'ok'); }}>
                  Reactivate
                </Btn>
              ) : d.status === 'trial' ? (
                <Btn kind="outline" icon="arrow-up" perm={adm} onClick={() => { setStatus(d.id, 'active'); ctx.toast(`${d.name} converted to a paid plan; metering starts today`, 'ok'); }}>
                  Convert to paid
                </Btn>
              ) : null}
              <Spacer />
              {d.status !== 'suspended' && d.status !== 'archived' && d.kind !== 'Internal' ? (
                <Btn kind="danger" icon="ban" perm={adm} onClick={() => suspend.open(d.id)}>
                  Suspend…
                </Btn>
              ) : null}
              {d.status !== 'archived' && d.kind !== 'Internal' ? (
                <Btn kind="danger" icon="archive" perm={adm} onClick={() => archive.open(d.id)}>
                  Archive…
                </Btn>
              ) : null}
            </>
          }
          tabs={[
            { v: 'Overview', label: 'Overview' },
            { v: 'Organisation', label: 'Organisation', count: d.departments.reduce((a, x) => a + x.projects.length, 0) },
            { v: 'Commercial', label: 'Commercial' },
            { v: 'Compliance', label: 'Compliance' }
          ]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {d.status === 'suspended' ? <Bar tone="err" multiline>Suspended: backups keep running for 7 days, restores and sign-ins are blocked except for the owner, who can pay and reactivate.</Bar> : null}
              <DrawerTiles
                items={[
                  { label: 'Workloads', value: String(d.workloads), sub: `${d.users} users` },
                  { label: 'Stored', value: d.storedTB ? `${d.storedTB.toFixed(2)} TB` : '—', sub: d.departments.flatMap(x => x.projects.flatMap(p => p.repos)).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'No repository yet' },
                  { label: 'Readiness', value: d.status === 'onboarding' ? '—' : `${d.readiness} %`, icon: d.readiness >= 80 ? 'circle-check' : 'triangle-alert', tone: d.readiness >= 80 ? 'ok' : 'warn', sub: `${plural(d.openAlerts, 'open alert')}` }
                ]}
              />
              <Facts
                items={[
                  { k: 'Owner', v: `${d.owner} · ${d.ownerEmail}` },
                  { k: 'Products', v: d.products.join(', ') },
                  { k: 'Plan', v: d.plan },
                  { k: 'Time zone', v: d.tz },
                  { k: 'Customer since', v: d.since },
                  { k: 'Branding', v: d.whiteLabel ? `White-labelled as ${d.whiteLabel}` : 'Host360 Aegis', muted: !d.whiteLabel }
                ]}
              />
            </div>
          ) : null}
          {tab === 'Organisation' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.departments.map(dep => (
                <section key={dep.name}>
                  <H3 right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{dep.kind}{dep.tz ? ` · ${dep.tz}` : ''}</span>}>{dep.name}</H3>
                  <MiniTable
                    label={`Projects in ${dep.name}`}
                    cols={[{ label: 'Project' }, { label: 'Isolation', w: '110px' }, { label: 'Repositories', w: '180px' }, { label: 'Workloads', w: '84px', r: true }]}
                    rows={dep.projects.map(p => [<strong key="n" style={{ fontWeight: 700 }}>{p.name}</strong>, p.isolation, p.repos.join(', ') || '—', String(p.workloads)])}
                  />
                </section>
              ))}
            </div>
          ) : null}
          {tab === 'Commercial' ? (
            <Facts
              items={[
                { k: 'Plan', v: d.plan },
                { k: 'Monthly', v: d.mrr ? `${inr(d.mrr)} (GST extra)` : d.kind === 'Internal' ? 'Internal, not billed' : 'Not billed yet', muted: !d.mrr },
                { k: 'Through', v: d.partner ? `${d.partner} · ${PARTNERS[0].api} · margin ${PARTNERS[0].margin}` : 'Direct' },
                { k: 'Billing', v: d.status === 'trial' ? 'Trial, not billed' : 'Monthly, postpaid, NEFT or card' },
                { k: 'Licences', v: <a href={`#/${ctx.product}/billing/entitlements`} style={{ color: 'var(--acc-tx)', fontWeight: 600 }}>See entitlements</a> }
              ]}
            />
          ) : null}
          {tab === 'Compliance' ? (
            <Facts
              items={[
                { k: 'Data residency', v: d.residency, icon: 'map-pin' },
                { k: 'Frameworks', v: d.frameworks.length ? <span style={{ display: 'flex', gap: 6 }}>{d.frameworks.map(f => <Tag key={f}>{f}</Tag>)}</span> : 'None' },
                { k: 'Residency check', v: 'Policies and plans that send data outside it are refused when saved' },
                { k: 'Provider access', v: d.frameworks.some(f => ['RBI', 'IRDAI'].includes(f)) ? 'Log in as owner notifies the customer at once' : 'Recorded in the customer’s audit log' }
              ]}
            />
          ) : null}
        </Drawer>
      ) : null}
      {suspend.value ? (
        <DangerDialog
          title={`Suspend ${s.customers.find(c => c.id === suspend.value)!.name}`}
          intro="Use for unpaid invoices or a contract breach. Data is kept. Exactly this happens:"
          removed={['Restores, failovers and cutovers are blocked', 'Users cannot sign in, except the owner, who can pay and reactivate', 'Backups and replication keep running for 7 days, then pause', 'Metering continues for storage only']}
          kept="Nothing is deleted. Reactivating restores everything at once."
          name={s.customers.find(c => c.id === suspend.value)!.name}
          action="Suspend customer"
          icon="ban"
          closing={suspend.closing}
          onClose={suspend.close}
          onConfirm={() => {
            const c = s.customers.find(x => x.id === suspend.value)!;
            setStatus(c.id, 'suspended', `Suspended by priya.raman on ${ctx.now().slice(0, 11)}`);
            audit({ who: 'priya.raman', customer: c.id, what: 'Suspended a customer', object: c.name, when: ctx.now(), r: 'ok' });
            ctx.toast(`${c.name} suspended`, 'warn');
            suspend.close();
          }}
        />
      ) : null}
      {archive.value ? (
        <DangerDialog
          title={`Archive ${s.customers.find(c => c.id === archive.value)!.name}`}
          intro="For customers who have left. Exactly this is removed:"
          removed={['Every user’s access, API tokens and service accounts', 'Schedules for backup, replication and migration', 'Connections to their sites (credentials are erased from the vault)', 'The customer from the tenant selector and reports']}
          kept="Recovery points stay under their retention and immutability locks, then expire. Audit history is kept for 7 years. Archiving needs approval from a second Owner."
          name={s.customers.find(c => c.id === archive.value)!.name}
          action="Archive customer"
          icon="archive"
          approval={{ rule: 'Archiving a customer needs a second Owner', approvers: 'a second Owner', expires: 'in 24 h' }}
          closing={archive.closing}
          onClose={archive.close}
          onConfirm={() => {
            const c = s.customers.find(x => x.id === archive.value)!;
            update(x => x.approvals.unshift({ id: 'APR-' + (1043 + x.approvals.length), kind: 'Policy change', object: `Archive ${c.name}`, customer: c.id, requester: 'priya.raman', approvers: 'Owner', needed: 1, given: [], requested: ctx.now(), expires: 'in 24 h', state: 'pending', reason: 'Customer has left.', evidence: [], rule: 'Archiving a customer needs a second Owner' }));
            ctx.toast(`Approval requested to archive ${c.name}`, 'info');
            archive.close();
          }}
        />
      ) : null}
    </>
  );
}

/** Organisation → partner → customer → department or site → project, with inheritance. */
function Hierarchy({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [sel, setSel] = useState<string>('org');
  const [add, setAdd] = useState<null | 'dept' | 'proj'>(null);
  const [nm, setNm] = useState('');
  const row = (id: string, depth: number, icon: string, label: string, meta: string) => (
    <button key={id} type="button" aria-current={sel === id ? 'true' : undefined} onClick={() => setSel(id)} className={pc('hover', 'background:var(--hover)')} style={{ display: 'grid', gridTemplateColumns: `${depth * 20}px 20px minmax(0,1fr) auto`, alignItems: 'center', gap: 8, width: '100%', minHeight: 34, padding: '0 12px', background: sel === id ? 'var(--acc-soft)' : 'transparent', boxShadow: sel === id ? 'inset 2px 0 0 var(--acc)' : 'none', textAlign: 'left', transition: 'background-color 100ms' }}>
      <span />
      <Icon name={icon} style={{ color: sel === id ? 'var(--acc)' : 'var(--tx-3)' }} />
      <span style={{ fontWeight: depth < 3 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{meta}</span>
    </button>
  );
  const direct = s.customers.filter(c => !c.partner && c.status !== 'archived');
  const tree: ReactElement[] = [row('org', 0, 'shield', 'Host360 Managed Services', 'Provider · IST')];
  const cust = (c: Customer, depth: number) => {
    tree.push(row('c:' + c.id, depth, 'users', c.name, `${c.tz.split(' ')[0].split('/')[1] || c.tz} · ${ST[c.status][1]}`));
    c.departments.forEach(d => {
      tree.push(row(`d:${c.id}:${d.name}`, depth + 1, d.kind === 'Site' ? 'map-pin' : 'folder', d.name, d.kind));
      d.projects.forEach(p => tree.push(row(`p:${c.id}:${p.name}`, depth + 2, 'box', p.name, `${p.isolation} · ${p.workloads}`)));
    });
  };
  direct.forEach(c => cust(c, 1));
  PARTNERS.forEach(p => {
    tree.push(row('pt:' + p.id, 1, 'network', p.name, 'Partner'));
    s.customers.filter(c => c.partner === p.name && c.status !== 'archived').forEach(c => cust(c, 2));
  });
  const [kind, cid, rest] = sel.split(':');
  const c = cid ? s.customers.find(x => x.id === cid) : null;
  const inherited = POLICIES.filter(p => p.level === 'Global').slice(0, 4);
  const own = c ? POLICIES.filter(p => p.owner === c.name) : [];
  return (
    <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(320px,1fr) minmax(0,1.2fr)', gap: 16 }}>
      <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)', overflow: 'auto', minHeight: 0 }} aria-label="Hierarchy">
        <div style={{ position: 'sticky', top: 0, display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 8px 0 16px', borderBottom: '1px solid var(--ln)', background: 'var(--panel)', zIndex: 1 }}>
          <h2 style={{ flex: 1, font: '600 15px/22px var(--f-body)' }}>Organisation</h2>
          <Btn kind="ghost" size="sm" icon="plus" disabled={kind !== 'c'} why="Choose a customer first." perm={ctx.can('admin', 'Changing the hierarchy')} onClick={() => { setNm(''); setAdd('dept'); }}>
            Department or site
          </Btn>
          <Btn kind="ghost" size="sm" icon="plus" disabled={kind !== 'd'} why="Choose a department or site first." perm={ctx.can('admin', 'Changing the hierarchy')} onClick={() => { setNm(''); setAdd('proj'); }}>
            Project
          </Btn>
        </div>
        {tree}
      </section>
      <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)', padding: '12px 16px 16px', overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {kind === 'org' ? (
          <>
            <H3>Host360 Managed Services</H3>
            <Facts items={[{ k: 'Role', v: 'Provider' }, { k: 'Time zone', v: 'Asia/Kolkata (IST)' }, { k: 'Customers', v: String(s.customers.filter(x => x.status !== 'archived').length) }, { k: 'Partners', v: PARTNERS.map(p => p.name).join(', ') }, { k: 'Sets for everyone', v: 'Global policies, alert rules, approval rules, MFA enforcement' }]} />
          </>
        ) : kind === 'pt' ? (
          <>
            <H3>{PARTNERS[0].name}</H3>
            <Facts items={[{ k: 'Kind', v: 'Reseller' }, { k: 'Connected through', v: PARTNERS[0].api }, { k: 'Customers', v: s.customers.filter(x => x.partner === PARTNERS[0].name).map(x => x.name).join(', ') }, { k: 'Partner since', v: PARTNERS[0].since }, { k: 'Margin', v: PARTNERS[0].margin }]} />
            <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>Partners work in the Host360 Partner Portal; this console shows where their customers sit in the hierarchy.</p>
          </>
        ) : c ? (
          <>
            <H3 right={<InfoTip tip="Isolation: Dedicated keeps the project's recovery points in its own repositories and encryption keys. Shared uses the provider's repositories with per-project keys." />}>
              {kind === 'c' ? c.name : rest}
            </H3>
            <Facts
              items={[
                { k: 'Level', v: kind === 'c' ? 'Customer' : kind === 'd' ? c.departments.find(x => x.name === rest)?.kind || 'Department' : 'Project' },
                { k: 'Customer', v: c.name },
                { k: 'Time zone', v: (kind === 'd' && c.departments.find(x => x.name === rest)?.tz) || c.tz, icon: 'clock' },
                ...(kind === 'p' ? (() => { const p = c.departments.flatMap(x => x.projects).find(x => x.name === rest)!; return [{ k: 'Isolation', v: p.isolation }, { k: 'Repositories', v: p.repos.join(', ') || 'None yet' }, { k: 'Workloads', v: String(p.workloads) }]; })() : []),
                { k: 'Data residency', v: c.residency }
              ]}
            />
            <section>
              <H3>Policies in effect here</H3>
              <MiniTable
                label="Policies"
                cols={[{ label: 'Policy' }, { label: 'Type', w: '90px' }, { label: 'From', w: '160px' }]}
                rows={[...own.map(p => [<strong key="n" style={{ fontWeight: 700 }}>{p.name}</strong>, p.type, `Set on ${c.name}`]), ...inherited.filter(p => !own.some(o => o.inherits === p.name)).map(p => [p.name, p.type, <span key="i" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--tx-2)' }}><Icon name="arrow-down" />Inherited, global</span>])]}
              />
            </section>
          </>
        ) : null}
      </section>
      {add ? (
        <Dialog
          size="sm"
          title={add === 'dept' ? `Add a department or site to ${c?.name}` : `Add a project to ${rest}`}
          onClose={() => setAdd(null)}
          footer={
            <>
              <Btn kind="ghost" onClick={() => setAdd(null)}>Cancel</Btn>
              <Btn kind="primary" icon="plus" disabled={!nm.trim()} why="Name it." onClick={() => {
                update(x => {
                  const cc = x.customers.find(y => y.id === cid)!;
                  cc.departments = add === 'dept' ? [...cc.departments, { name: nm.trim(), kind: 'Department', projects: [] }] : cc.departments.map(dd => (dd.name === rest ? { ...dd, projects: [...dd.projects, { name: nm.trim(), isolation: 'Dedicated', workloads: 0, repos: [] }] } : dd));
                });
                ctx.toast(`${nm.trim()} added`, 'ok');
                setAdd(null);
              }}>
                Add
              </Btn>
            </>
          }
        >
          <Field id="h-nm" label="Name" hint={add === 'proj' ? 'Projects inherit the department’s policies and time zone; change either after adding it.' : undefined}>
            <TextInput id="h-nm" value={nm} onChange={setNm} placeholder={add === 'dept' ? 'Compliance' : 'Meridian-Payments'} />
          </Field>
        </Dialog>
      ) : null}
    </div>
  );
}

const PLANS: { id: string; label: string; products: ProductName[]; note: string }[] = [
  { id: 'bundle', label: 'Enterprise bundle', products: ['Protection', 'Resilience', 'Mobility'], note: 'One contract, one renewal date for all three products' },
  { id: 'pr', label: 'Business · Protection and Resilience', products: ['Protection', 'Resilience'], note: 'Backup with replication to a recovery site' },
  { id: 'p', label: 'Business · Protection', products: ['Protection'], note: 'Backup and restore only' },
  { id: 'm', label: 'Project · Mobility', products: ['Mobility'], note: 'Migration for a fixed number of workloads' }
];

function OnboardWizard({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [legal, setLegal] = useState('');
  const [country, setCountry] = useState('India');
  const [tz, setTz] = useState('Asia/Kolkata (IST)');
  const [gstin, setGstin] = useState('');
  const [via, setVia] = useState('Direct');
  const [plan, setPlan] = useState('pr');
  const [billing, setBilling] = useState('Monthly, postpaid');
  const [wl, setWl] = useState(false);
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('#0f766e');
  const [domain, setDomain] = useState('');
  const [qBk, setQBk] = useState('10');
  const [qDr, setQDr] = useState('64');
  const [qMig, setQMig] = useState('5');
  const [owner, setOwner] = useState('');
  const [email, setEmail] = useState('');
  const [start, setStart] = useState('2026-11-01');
  const steps = ['Customer', 'Plan', 'Branding', 'Quota', 'Owner and start'];
  const gstOk = country !== 'India' || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin.trim().toUpperCase());
  const emailOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim());
  const valid = [name.trim().length > 1 && gstOk, true, !wl || (brand.trim() && /^#[0-9a-f]{6}$/i.test(color)), [qBk, qDr, qMig].every(x => /^\d+$/.test(x)), owner.trim() && emailOk][step];
  const why = ['Enter the customer name and a valid GSTIN (15 characters, e.g. 33AAACK1234F1Z5).', '', 'Give the brand a name and a hex colour.', 'Quotas are whole numbers.', 'Enter the owner’s name and work e-mail.'][step];
  const p = PLANS.find(x => x.id === plan)!;
  const finish = () => {
    const id = 'n' + Date.now();
    update(s =>
      s.customers.unshift({ id, name: name.trim(), kind: via === 'Direct' ? 'Direct' : 'Through partner', partner: via === 'Direct' ? undefined : via, country, city: country === 'India' ? 'Chennai' : 'Frankfurt', tz, plan: p.label, products: p.products, status: 'onboarding', statusNote: `Metering starts ${new Date(start + 'T00:00').toDateString().slice(4)}`, owner: owner.trim(), ownerEmail: email.trim(), since: ctx.now(), users: 1, workloads: 0, storedTB: 0, residency: country === 'India' ? 'India only' : 'European Union only (GDPR)', frameworks: country === 'India' ? ['DPDP'] : ['GDPR'], whiteLabel: wl ? brand.trim() : undefined, mrr: 0, readiness: 0, openAlerts: 0, departments: [{ name: 'Head office', kind: 'Site', projects: [{ name: `${name.trim().split(' ')[0]}-Prod`, isolation: 'Dedicated', workloads: 0, repos: [] }] }] })
    );
    audit({ who: 'priya.raman', customer: id, what: 'Onboarded a customer', object: name.trim(), when: ctx.now(), r: 'ok', note: `${p.label}; owner invited: ${email.trim()}` });
    ctx.toast(`${name.trim()} created; invitation sent to ${email.trim()}`, 'ok');
    onClose();
  };
  return (
    <Wizard
      title="Onboard a customer"
      sub="Creates the tenant, its first project and owner. Metering starts on the date you choose."
      steps={steps}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={
        step < steps.length - 1 ? (
          <Btn kind="primary" iconAfter="chevron-right" disabled={!valid} why={why} onClick={() => setStep(step + 1)}>
            Next
          </Btn>
        ) : (
          <Btn kind="primary" icon="check" disabled={!valid} why={why} onClick={finish}>
            Create customer
          </Btn>
        )
      }
    >
      {step === 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
            <Field id="ob-name" label="Customer name">
              <TextInput id="ob-name" value={name} onChange={setName} placeholder="Konkan Shipping" />
            </Field>
            <Field id="ob-legal" label="Legal name (on invoices)">
              <TextInput id="ob-legal" value={legal} onChange={setLegal} placeholder="Konkan Shipping Pvt Ltd" />
            </Field>
            <Field id="ob-country" label="Country">
              <SelectInput id="ob-country" value={country} onChange={v => { setCountry(v); setTz(v === 'India' ? 'Asia/Kolkata (IST)' : 'Europe/Berlin (CET)'); }} options={['India', 'Germany', 'United States', 'Singapore']} />
            </Field>
            <Field id="ob-tz" label="Time zone">
              <SelectInput id="ob-tz" value={tz} onChange={setTz} options={['Asia/Kolkata (IST)', 'Europe/Berlin (CET)', 'America/New_York (ET)', 'Asia/Singapore (SGT)']} />
            </Field>
            {country === 'India' ? (
              <Field id="ob-gst" label="GSTIN" err={gstin && !gstOk ? 'A GSTIN has 15 characters, e.g. 33AAACK1234F1Z5.' : null}>
                <TextInput id="ob-gst" value={gstin} onChange={v => setGstin(v.toUpperCase())} placeholder="33AAACK1234F1Z5" mono invalid={!!gstin && !gstOk} />
              </Field>
            ) : (
              <Field id="ob-vat" label="VAT number">
                <TextInput id="ob-vat" value={gstin} onChange={setGstin} placeholder="DE123456789" mono />
              </Field>
            )}
            <Field id="ob-via" label="Sold through">
              <SelectInput id="ob-via" value={via} onChange={setVia} options={['Direct', ...PARTNERS.map(x => x.name)]} />
            </Field>
          </div>
          <Bar tone="info" icon="map-pin" multiline>
            Data residency is set from the country: {country === 'India' ? 'India only (DPDP)' : country === 'Germany' ? 'European Union only (GDPR)' : `${country} only`}. It is enforced whenever a policy or plan is saved.
          </Bar>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <div role="radiogroup" aria-label="Plan" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PLANS.map(x => (
              <RadioCard key={x.id} on={plan === x.id} onClick={() => setPlan(x.id)} title={x.label} note={x.note} tag={x.products.join(' · ')} />
            ))}
          </div>
          <Field id="ob-bill" label="Billing">
            <SelectInput id="ob-bill" value={billing} onChange={setBilling} options={['Monthly, postpaid', 'Quarterly, prepaid', 'Annual, prepaid with minimum commitment']} width={360} />
          </Field>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Toggle on={wl} onChange={setWl} label="White-label">
            White-label the console, e-mails and reports for this customer
          </Toggle>
          {wl ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, animation: 'ae-fade 150ms var(--ease)' }}>
              <Field id="ob-brand" label="Brand name">
                <TextInput id="ob-brand" value={brand} onChange={setBrand} placeholder="Konkan CloudGuard" />
              </Field>
              <Field id="ob-color" label="Accent colour" err={!/^#[0-9a-f]{6}$/i.test(color) ? 'Use a hex colour like #0f766e.' : null}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 36, height: 36, flex: 'none', background: /^#[0-9a-f]{6}$/i.test(color) ? color : 'transparent', border: '1px solid var(--ln-2)' }} />
                  <TextInput id="ob-color" value={color} onChange={setColor} mono />
                </div>
              </Field>
              <Field id="ob-domain" label="Custom domain (optional)" hint="Point a CNAME at console.host360.ai; the certificate is issued for you.">
                <TextInput id="ob-domain" value={domain} onChange={setDomain} placeholder="backup.konkanshipping.in" mono />
              </Field>
              <Field id="ob-logo" label="Logo">
                <button type="button" onClick={() => ctx.toast('konkan-logo.svg attached', 'ok')} className={pc('hover', 'border-color:var(--acc);background:var(--hover)')} style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px dashed var(--ln-2)', color: 'var(--tx-2)' }}>
                  <Icon name="upload" />
                  Choose an SVG or PNG
                </button>
              </Field>
            </div>
          ) : (
            <p style={{ color: 'var(--tx-2)' }}>The customer sees Host360 Aegis. You can white-label later from the customer’s settings.</p>
          )}
        </>
      ) : null}
      {step === 3 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            <Field id="ob-qb" label="Backup storage (TB)" hint="Across all repositories">
              <TextInput id="ob-qb" value={qBk} onChange={setQBk} inputMode="numeric" invalid={!/^\d+$/.test(qBk)} />
            </Field>
            <Field id="ob-qd" label="DR site capacity (vCPU)" hint={p.products.includes('Resilience') ? 'Reserved at the recovery site' : 'Resilience is not in the plan'}>
              <TextInput id="ob-qd" value={p.products.includes('Resilience') ? qDr : '0'} onChange={setQDr} inputMode="numeric" readOnly={!p.products.includes('Resilience')} />
            </Field>
            <Field id="ob-qm" label="Migration staging (TB)" hint={p.products.includes('Mobility') ? 'Temporary space for sync passes' : 'Mobility is not in the plan'}>
              <TextInput id="ob-qm" value={p.products.includes('Mobility') ? qMig : '0'} onChange={setQMig} inputMode="numeric" readOnly={!p.products.includes('Mobility')} />
            </Field>
          </div>
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>At 80 % of a quota the customer owner is warned; at 100 % new jobs wait and Host360 is told. Nothing running is stopped.</p>
        </>
      ) : null}
      {step === 4 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
            <Field id="ob-owner" label="Owner’s name">
              <TextInput id="ob-owner" value={owner} onChange={setOwner} placeholder="Farah Sheikh" />
            </Field>
            <Field id="ob-email" label="Owner’s work e-mail" err={email && !emailOk ? 'Enter a valid e-mail address.' : null}>
              <TextInput id="ob-email" value={email} onChange={setEmail} placeholder="farah@konkanshipping.in" invalid={!!email && !emailOk} />
            </Field>
            <Field id="ob-start" label="Start metering on">
              <TextInput id="ob-start" type="date" value={start} onChange={setStart} />
            </Field>
          </div>
          <Facts
            items={[
              { k: 'Customer', v: name || '—' },
              { k: 'Plan', v: `${p.label} · ${billing}` },
              { k: 'Branding', v: wl ? brand || '—' : 'Host360 Aegis' },
              { k: 'Quota', v: `${qBk} TB backup · ${p.products.includes('Resilience') ? qDr : 0} vCPU DR · ${p.products.includes('Mobility') ? qMig : 0} TB staging` },
              { k: 'First project', v: `${(name.trim().split(' ')[0] || 'Customer')}-Prod (dedicated)` },
              { k: 'Owner invitation', v: 'Sent at once; MFA is required on first sign-in' }
            ]}
          />
          <CheckBox on onChange={() => undefined} disabled why="Always on for new customers.">
            Apply Host360 default alert and approval rules
          </CheckBox>
        </>
      ) : null}
    </Wizard>
  );
}
