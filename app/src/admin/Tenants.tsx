import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { PARTNERS, type Customer, type CustomerStatus, type ProductName } from '../data/platform';
import { Btn, CheckBox, Field, FilterInput, RadioCard, Seg, SelectInput, TextInput } from '../ui/controls';
import { Activity, Bar, DrawerTiles, Facts, MiniTable, Page, PageHeader, Spacer, Status, TableArea, Tiles, Toolbar, plural } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { LoginAsDialog } from '../shell/Account';
import { inr } from '../platform/common';
import { audit, update, useStore } from '../platform/store';

const ST: Record<CustomerStatus, [string, string, string]> = {
  active: ['circle-check', 'Active', 'ok'],
  trial: ['clock', 'Trial', 'run'],
  onboarding: ['loader-circle', 'Onboarding', 'run'],
  suspended: ['ban', 'Suspended', 'err'],
  archived: ['archive', 'Archived', 'tx']
};
const PLANS = ['Enterprise bundle', 'Business · Protection and Resilience', 'Business · Mobility and Protection', 'Business · Protection', 'Trial · Protection'];
const PRODUCTS: ProductName[] = ['Protection', 'Resilience', 'Mobility'];

/** 6.1 Tenants: every customer tenant, its plan, people, roles and the provider-side audit trail. */
export function TenantsSection({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [view, setView] = useState<'all' | CustomerStatus>('all');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const plan = useClosable<string>();
  const login = useClosable<string>();
  const susp = useClosable<string>();
  const add = useClosable<boolean>();
  useEffect(() => {
    if (ctx.openId && s.customers.some(c => c.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = s.customers;
  const ql = q.trim().toLowerCase();
  const rows = all.filter(c => (view === 'all' || c.status === view) && (!ql || `${c.name} ${c.owner} ${c.plan} ${c.partner || ''} ${c.city}`.toLowerCase().includes(ql)));
  const d = drawer.value ? all.find(c => c.id === drawer.value) : null;
  const ents = (id: string) => s.entitlements.filter(e => e.customer === id);
  const over = all.filter(c => ents(c.id).some(e => e.used > e.limit));
  return (
    <Page>
      <PageHeader
        kicker="Customers"
        title="Tenants"
        sub="Every customer tenant: its plan, people and roles, what it has used, and everything Host360 staff did inside it."
        actions={<Btn kind="primary" icon="plus" onClick={() => add.open(true)}>New tenant</Btn>}
      />
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Tenants', value: `${all.length}`, icon: 'building-2', sub: `${all.filter(c => c.status === 'active').length} active · ${all.filter(c => c.status === 'trial').length} trial · ${all.filter(c => c.status === 'suspended').length} suspended` },
            { label: 'Monthly revenue', value: inr(all.reduce((a, c) => a + c.mrr, 0)), icon: 'file-text', sub: 'Recurring, before GST' },
            { label: 'People', value: `${s.users.filter(u => u.side === 'Customer' && u.status !== 'deleted').length}`, icon: 'users', sub: `Plus ${s.users.filter(u => u.side === 'Provider').length} Host360 staff` },
            { label: 'Over plan', value: `${over.length}`, icon: over.length ? 'triangle-alert' : 'circle-check', tone: over.length ? 'warn' : 'ok', sub: over.map(c => c.name).join(', ') || 'Everyone within their plan' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Status" value={view} onChange={setView} options={[{ v: 'all', label: 'All', count: all.length }, { v: 'active', label: 'Active', count: all.filter(c => c.status === 'active').length }, { v: 'trial', label: 'Trial', count: all.filter(c => c.status === 'trial').length }, { v: 'suspended', label: 'Suspended', count: all.filter(c => c.status === 'suspended').length }]} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter by name, owner, plan or partner" label="Filter tenants" />
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Tenants"
          cols={[
            { k: 'n', label: 'Tenant', w: 'minmax(190px,1.5fr)' },
            { k: 'kind', label: 'Sold', w: 'minmax(130px,1fr)', dim: true },
            { k: 'plan', label: 'Plan', w: 'minmax(170px,1.3fr)' },
            { k: 'res', label: 'Data residency', w: 'minmax(150px,1.1fr)', dim: true },
            { k: 'u', label: 'People', w: '80px', r: true },
            { k: 'w', label: 'Workloads', w: '96px', r: true },
            { k: 'mrr', label: 'Monthly', w: '120px', r: true },
            { k: 'st', label: 'Status', w: '130px' }
          ]}
          rows={rows.map(c => ({
            id: c.id,
            n: { v: c.name, strong: true, tip: `${c.city}, ${c.country}` },
            kind: c.kind === 'Through partner' ? { v: c.partner || 'Partner', tip: 'Sold through a partner' } : c.kind,
            plan: c.plan,
            res: c.residency,
            u: { v: String(c.users), s: c.users },
            w: { v: String(c.workloads), s: c.workloads },
            mrr: c.mrr ? { v: inr(c.mrr), s: c.mrr } : { v: c.kind === 'Internal' ? 'Internal' : 'Free', muted: true, s: 0 },
            st: { t: 'status', i: ST[c.status][0], l: ST[c.status][1], c: ST[c.status][2], tip: c.statusNote || ST[c.status][1] }
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['tenant', 'tenants']}
          filtered={view !== 'all' || !!ql}
          onClear={() => { setView('all'); setQ(''); }}
          emptyText="No tenants yet. Create the first one with New tenant."
          sort="n"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Tenant"
          kicker={`Tenant · ${d.kind === 'Through partner' ? `through ${d.partner}` : d.kind}`}
          title={d.name}
          status={<><Status icon={ST[d.status][0]} tone={ST[d.status][2]} label={ST[d.status][1]} /><span>{d.plan}</span><span>Since {d.since.slice(0, 11)}</span></>}
          actions={
            <>
              {d.kind !== 'Internal' ? <Btn kind="outline" icon="user-check" onClick={() => login.open(d.id)}>Log in as owner…</Btn> : null}
              <Btn kind="outline" icon="pencil" onClick={() => plan.open(d.id)}>Change plan…</Btn>
              <Spacer />
              {d.status === 'suspended' ? (
                <Btn kind="outline" icon="play" onClick={() => { update(x => Object.assign(x.customers.find(c => c.id === d.id)!, { status: 'active', statusNote: undefined })); audit({ who: 'priya.raman', customer: d.id, what: 'Reactivated a tenant', object: d.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.name} reactivated`, 'ok'); }}>Reactivate</Btn>
              ) : d.kind !== 'Internal' ? (
                <Btn kind="danger" icon="ban" onClick={() => susp.open(d.id)}>Suspend…</Btn>
              ) : null}
            </>
          }
          tabs={[{ v: 'Overview', label: 'Overview' }, { v: 'People', label: 'People' }, { v: 'Roles', label: 'Roles' }, { v: 'Audit', label: 'Provider audit' }]}
          tab={tab}
          onTab={setTab}
          width={680}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {d.statusNote ? <Bar tone={d.status === 'suspended' ? 'err' : 'info'} multiline>{d.statusNote}</Bar> : null}
              <DrawerTiles items={[{ label: 'Workloads', value: String(d.workloads), sub: `${d.storedTB} TB stored` }, { label: 'Monthly', value: d.mrr ? inr(d.mrr) : '—', sub: d.kind === 'Through partner' ? `Billed to ${d.partner}` : 'Billed direct' }, { label: 'Readiness', value: String(d.readiness), sub: `${d.openAlerts} open alerts` }]} />
              <Facts
                items={[
                  { k: 'Owner', v: `${d.owner} · ${d.ownerEmail}` },
                  { k: 'Plan', v: d.plan },
                  { k: 'Products', v: d.products.join(', ') },
                  { k: 'Entitlements', v: ents(d.id).map(e => `${e.product === 'Bundle' ? 'Bundle' : e.product}: ${e.used} of ${e.limit} ${e.unit}`).join(' · ') || 'None', muted: !ents(d.id).length },
                  { k: 'Data residency', v: d.residency },
                  { k: 'Frameworks', v: d.frameworks.join(', ') },
                  { k: 'Branding', v: d.whiteLabel ? `${d.whiteLabel} (white-labelled; Host360 is never shown)` : 'Host360 Aegis' },
                  { k: 'Time zone', v: d.tz },
                  { k: 'Structure', v: d.departments.map(x => `${x.name}: ${x.projects.map(p => p.name).join(', ')}`).join(' · ') }
                ]}
              />
            </div>
          ) : null}
          {tab === 'People' ? (
            <MiniTable
              label="People"
              cols={[{ label: 'Name' }, { label: 'Role', w: '170px' }, { label: 'MFA', w: '130px' }, { label: 'Status', w: '100px' }]}
              rows={s.users.filter(u => u.customer === d.id && u.status !== 'deleted').map(u => [
                <span key="n" data-tip={u.email} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}><strong style={{ fontWeight: 600 }}>{u.name}</strong> <span style={{ color: 'var(--tx-3)', font: '12px var(--f-ui)' }}>{u.title}</span></span>,
                u.roles.map(r => r.role).join(', '),
                u.mfa === 'Not set up' ? <Status key="m" icon="triangle-alert" tone="warn" label="Not set up" /> : <Status key="m" icon="fingerprint" tone="ok" label={u.mfa === 'Security key' ? 'Security key' : 'App'} />,
                u.status === 'active' ? 'Active' : u.status === 'locked' ? 'Locked' : u.status === 'invited' ? 'Invited' : 'Deactivated'
              ])}
              empty={`No people recorded. ${d.users} people sign in through ${d.kind === 'Through partner' ? d.partner : 'their own directory'}.`}
            />
          ) : null}
          {tab === 'Roles' ? (
            <MiniTable
              label="Roles in use"
              cols={[{ label: 'Role' }, { label: 'Scope', w: '220px' }, { label: 'People', w: '64px', r: true }]}
              rows={Object.entries(s.users.filter(u => u.customer === d.id).flatMap(u => u.roles.map(r => `${r.role}|${r.scope}`)).reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] || 0) + 1), a), {})).map(([k, n]) => [k.split('|')[0], k.split('|')[1], String(n)])}
              empty="No roles assigned yet."
            />
          ) : null}
          {tab === 'Audit' ? (
            <Activity
              items={s.audit
                .filter(a => a.customer === d.id && a.side === 'Provider')
                .slice(0, 20)
                .map(a => ({ icon: a.as ? 'user-check' : a.r === 'ok' ? 'circle-check' : 'circle-x', tone: a.as ? 'warn' : a.r === 'ok' ? undefined : 'err', text: <>{a.who}{a.as ? <> as <strong style={{ fontWeight: 600 }}>{a.as}</strong></> : null}: {a.what} · {a.object}{a.note ? <span style={{ color: 'var(--tx-3)' }}> · {a.note}</span> : null}</>, when: a.when }))}
            />
          ) : null}
        </Drawer>
      ) : null}
      {login.value ? (
        <LoginAsDialog
          ctx={ctx}
          customerId={login.value}
          closing={login.closing}
          onClose={login.close}
          onStart={reason => {
            // The console is mounted alongside the portal; it opens the session and switches view.
            window.dispatchEvent(new CustomEvent('aegis:act-as', { detail: { id: login.value, reason } }));
            login.close();
          }}
        />
      ) : null}
      {plan.value ? <PlanDialog ctx={ctx} c={all.find(c => c.id === plan.value)!} closing={plan.closing} onClose={plan.close} /> : null}
      {susp.value ? (
        <DangerDialog
          title={`Suspend ${all.find(c => c.id === susp.value)!.name}`}
          intro="For non-payment or a contract breach. Exactly this stops for the whole tenant:"
          removed={['Restores, failovers and cutovers', 'Changes to policies, plans and people', 'Sign-in for everyone except the owner, who sees a notice']}
          kept="Backups and replication keep running for 30 days so no recovery point is lost. Reactivating restores everything at once."
          name={all.find(c => c.id === susp.value)!.name}
          action="Suspend tenant"
          icon="ban"
          closing={susp.closing}
          onClose={susp.close}
          onConfirm={() => {
            const c = all.find(x => x.id === susp.value)!;
            update(x => Object.assign(x.customers.find(y => y.id === c.id)!, { status: 'suspended', statusNote: `Suspended by priya.raman on ${ctx.now().slice(0, 11)}. Backups keep running for 30 days.` }));
            audit({ who: 'priya.raman', customer: c.id, what: 'Suspended a tenant', object: c.name, when: ctx.now(), r: 'ok' });
            ctx.toast(`${c.name} suspended`, 'warn');
            susp.close();
          }}
        />
      ) : null}
      {add.value ? <NewTenantWizard ctx={ctx} closing={add.closing} onClose={add.close} onDone={id => { add.close(); drawer.open(id); setTab('Overview'); }} /> : null}
    </Page>
  );
}

function PlanDialog({ ctx, c, closing, onClose }: { ctx: Ctx; c: Customer; closing: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState(c.plan);
  const [prods, setProds] = useState<ProductName[]>(c.products);
  const [when, setWhen] = useState<'now' | 'renewal'>('now');
  const dropped = c.products.filter(p => !prods.includes(p));
  return (
    <Dialog
      title={`Change the plan for ${c.name}`}
      sub="Entitlements and invoices follow the plan. The customer owner is told by e-mail."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="check" disabled={!prods.length || (plan === c.plan && prods.join() === c.products.join())} why={!prods.length ? 'Keep at least one product.' : 'Nothing has changed.'} onClick={() => {
            update(x => Object.assign(x.customers.find(y => y.id === c.id)!, { plan, products: prods }));
            audit({ who: 'priya.raman', customer: c.id, what: 'Changed the plan', object: c.name, when: ctx.now(), r: 'ok', before: [['Plan', c.plan], ['Products', c.products.join(', ')]], after: [['Plan', plan], ['Products', prods.join(', ')]] });
            ctx.toast(`${c.name} moves to ${plan} ${when === 'now' ? 'today; the change is prorated' : 'at renewal'}`, 'ok');
            onClose();
          }}>Save</Btn>
        </>
      }
    >
      <Field id="pl-p" label="Plan"><SelectInput id="pl-p" value={plan} onChange={setPlan} options={PLANS} /></Field>
      <Field label="Products">
        <div style={{ display: 'flex', gap: 16 }}>
          {PRODUCTS.map(p => <CheckBox key={p} on={prods.includes(p)} onChange={v => setProds(x => (v ? [...x, p] : x.filter(y => y !== p)))}>{p}</CheckBox>)}
        </div>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={when === 'now'} onClick={() => setWhen('now')} title="From today" note="Prorated on the next invoice" />
        <RadioCard on={when === 'renewal'} onClick={() => setWhen('renewal')} title="At renewal" note="Nothing changes until then" />
      </div>
      {dropped.length ? (
        <p style={{ display: 'flex', gap: 8 }}>
          <Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: 2, flex: 'none' }} />
          Dropping {dropped.join(' and ')} stops new jobs for it. Existing recovery points are kept until their retention ends.
        </p>
      ) : null}
    </Dialog>
  );
}

function NewTenantWizard({ ctx, closing, onClose, onDone }: { ctx: Ctx; closing: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sold, setSold] = useState<'Direct' | 'Through partner'>('Direct');
  const [region, setRegion] = useState('India South (Chennai DC1)');
  const [plan, setPlan] = useState(PLANS[3]);
  const [owner, setOwner] = useState('');
  const [email, setEmail] = useState('');
  const [brand, setBrand] = useState<'host360' | 'partner'>('host360');
  const emailOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email);
  const ok = [name.trim().length >= 3, owner.trim().length >= 3 && emailOk, true][step];
  const finish = () => {
    const id = name.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 3) + Math.floor(Math.random() * 90 + 10);
    const c: Customer = {
      id, name: name.trim(), kind: sold, partner: sold === 'Through partner' ? PARTNERS[0].name : undefined, country: region.startsWith('EU') ? 'Germany' : 'India', city: region.startsWith('EU') ? 'Frankfurt' : region.includes('Mumbai') ? 'Mumbai' : 'Chennai', tz: region.startsWith('EU') ? 'Europe/Berlin (CET)' : 'Asia/Kolkata (IST)', plan, products: plan.includes('bundle') ? PRODUCTS : plan.includes('Mobility') ? ['Protection', 'Mobility'] : plan.includes('Resilience') ? ['Protection', 'Resilience'] : ['Protection'],
      status: 'onboarding', statusNote: `Invitation sent to ${email} at ${ctx.now()}. Waiting for the owner to set up MFA.`, owner: owner.trim(), ownerEmail: email, since: ctx.now(), users: 1, workloads: 0, storedTB: 0, residency: region.startsWith('EU') ? 'EU only (GDPR)' : 'India only', frameworks: region.startsWith('EU') ? ['GDPR'] : ['DPDP'], whiteLabel: sold === 'Through partner' && brand === 'partner' ? 'CloudNest Resilience' : undefined, mrr: 0, readiness: 0, openAlerts: 0,
      departments: [{ name: 'Default', kind: 'Department', projects: [{ name: `${name.trim().split(' ')[0]}-Default`, isolation: 'Shared', workloads: 0, repos: [] }] }]
    };
    update(x => x.customers.push(c));
    audit({ who: 'priya.raman', customer: id, what: 'Created a tenant', object: c.name, when: ctx.now(), r: 'ok', after: [['Plan', plan], ['Region', region], ['Owner', email]] });
    ctx.toast(`${c.name} created; the owner has been invited`, 'ok');
    onDone(id);
  };
  return (
    <Wizard
      title="New tenant"
      sub="Creates the tenant, its first project and invites the owner. Resources are provisioned when the owner signs in."
      steps={['Customer', 'Owner', 'Review']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={<Btn kind="primary" icon={step === 2 ? 'check' : undefined} iconAfter={step < 2 ? 'arrow-right' : undefined} disabled={!ok} why={step === 0 ? 'Give the customer’s legal name.' : 'Give the owner’s name and a valid e-mail.'} onClick={() => (step < 2 ? setStep(step + 1) : finish())}>{step < 2 ? 'Next' : 'Create tenant'}</Btn>}
    >
      {step === 0 ? (
        <>
          <Field id="nt-n" label="Legal name"><TextInput id="nt-n" value={name} onChange={setName} placeholder="Palar Textiles Pvt Ltd" autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <RadioCard on={sold === 'Direct'} onClick={() => setSold('Direct')} icon="building-2" title="Direct" note="Host360 bills the customer" />
            <RadioCard on={sold === 'Through partner'} onClick={() => setSold('Through partner')} icon="users" title={`Through ${PARTNERS[0].name}`} note="The partner bills; margin 18 %" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field id="nt-r" label="Data region" hint="Fixes where backups and replicas are kept. Cannot be changed later."><SelectInput id="nt-r" value={region} onChange={setRegion} options={['India South (Chennai DC1)', 'India West (Mumbai DC2)', 'EU Central (Frankfurt FR5)']} /></Field>
            <Field id="nt-p" label="Plan"><SelectInput id="nt-p" value={plan} onChange={setPlan} options={PLANS} /></Field>
          </div>
          {sold === 'Through partner' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <RadioCard on={brand === 'host360'} onClick={() => setBrand('host360')} title="Host360 Aegis branding" />
              <RadioCard on={brand === 'partner'} onClick={() => setBrand('partner')} title="CloudNest Resilience (white-label)" note="Host360 never appears to the customer" />
            </div>
          ) : null}
        </>
      ) : null}
      {step === 1 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field id="nt-o" label="Owner’s name"><TextInput id="nt-o" value={owner} onChange={setOwner} placeholder="R. Senthil" autoFocus /></Field>
          <Field id="nt-e" label="Owner’s e-mail" err={email && !emailOk ? 'Not a valid e-mail address.' : null}><TextInput id="nt-e" value={email} onChange={setEmail} placeholder="senthil@palartextiles.in" invalid={!!email && !emailOk} /></Field>
        </div>
      ) : null}
      {step === 2 ? (
        <Facts items={[{ k: 'Tenant', v: name }, { k: 'Sold', v: sold === 'Direct' ? 'Direct' : `Through ${PARTNERS[0].name}` }, { k: 'Region', v: region }, { k: 'Plan', v: plan }, { k: 'Owner', v: `${owner} · ${email}` }, { k: 'Owner must', v: 'Accept the invitation within 7 days and set up MFA' }, { k: 'Created', v: `First project, default roles, notification templates from the internal library; trial clock not started` }]} />
      ) : null}
    </Wizard>
  );
}

