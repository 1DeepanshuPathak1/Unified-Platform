import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { POLICY_VERSIONS, WORKLOADS, type Policy, type PolicyType } from '../data/platform';
import { Btn, Field, FilterInput, RadioCard, Seg, SelectFilter, SelectInput, TextInput, Toggle } from '../ui/controls';
import { Activity, Bar, Facts, H3, MiniTable, Page, PageHeader, Spacer, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit, update, useStore } from './store';
import { CUSTOMERS } from '../data/platform';

const TYPE_ICON: Record<PolicyType, string> = { Backup: 'archive', DR: 'life-buoy', Migration: 'forward' };
const TYPE_PRODUCT: Record<PolicyType, string> = { Backup: 'Protection', DR: 'Resilience', Migration: 'Mobility' };
const DRIFT = [
  { w: 'file-srv-03', policy: 'g-bk-daily', what: 'Runs crash-consistent; the policy asks for application-consistent', since: '21 Oct 2026, 02:48 IST' },
  { w: 'erp-db-01', policy: 'g-bk-daily', what: 'Backup window 00:00 to 07:00 set on the guest; the policy says 01:00 to 06:00', since: '14 Oct 2026, 10:20 IST' },
  { w: 'ad-dc-01', policy: 'g-dr-bc', what: 'Replicating every 30 min after a manual change in vCenter; the policy says 15 min', since: '21 Oct 2026, 15:46 IST' },
  { w: 'cbs-db-01', policy: 't-mer-db', what: 'Repository lock 14 d on the bucket; the policy requires 30 d', since: '19 Oct 2026, 18:05 IST' }
];
const REPOS = [
  { name: 'obj-check', where: 'Chennai, India' },
  { name: 'copy-check-repo', where: 'Chennai, India' },
  { name: 'mer-obj-immutable', where: 'Mumbai, India' },
  { name: 'atl-obj-fra', where: 'Frankfurt, Germany' }
];

/** Policies, one engine with three types. Product sections open it filtered to their own type. */
export default function Policies({ ctx, fixedType }: { ctx: Ctx; fixedType?: PolicyType }) {
  const s = useStore();
  const [type, setType] = useState<'All' | PolicyType>(fixedType || 'All');
  const [level, setLevel] = useState('All');
  const [driftOnly, setDriftOnly] = useState(false);
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Settings');
  const create = useClosable<boolean>();
  const [diffV, setDiffV] = useState<number | null>(null);
  useEffect(() => {
    if (ctx.openId && s.policies.some(p => p.id === ctx.openId || p.name === ctx.openId)) drawer.open(s.policies.find(p => p.id === ctx.openId || p.name === ctx.openId)!.id);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const ql = q.trim().toLowerCase();
  const base = s.policies.filter(p => !fixedType || p.type === fixedType);
  const rows = base.filter(p => (type === 'All' || p.type === type) && (level === 'All' || p.level === level) && (!driftOnly || p.drift) && (!ql || `${p.name} ${p.owner}`.toLowerCase().includes(ql)));
  const cfg = ctx.can('configure', 'Changing policies');
  const d = drawer.value ? s.policies.find(p => p.id === drawer.value) : null;
  const body = (
    <>
      <Toolbar>
        {!fixedType ? (
          <Seg
            label="Type"
            value={type}
            onChange={setType}
            options={[{ v: 'All', label: 'All', count: base.length }, ...(['Backup', 'DR', 'Migration'] as PolicyType[]).map(t => ({ v: t, label: t, count: base.filter(p => p.type === t).length }))]}
          />
        ) : null}
        <FilterInput value={q} onChange={setQ} placeholder="Filter by name or owner" label="Filter policies" width={220} />
        <SelectFilter label="Level" value={level} onChange={setLevel} options={['All', 'Global', 'Tenant', 'Workload']} />
        <Toggle on={driftOnly} onChange={setDriftOnly} label="Only policies with drift">
          Only with drift
        </Toggle>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={cfg} onClick={() => create.open(true)}>
          Create a policy
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Policies"
          cols={[
            { k: 'name', label: 'Policy', w: 'minmax(200px,1.5fr)' },
            { k: 'type', label: 'Type', w: '120px' },
            { k: 'level', label: 'Level', w: '96px' },
            { k: 'inh', label: 'Inherits from', w: 'minmax(140px,1fr)', dim: true },
            { k: 'owner', label: 'Owner', w: 'minmax(140px,1fr)', dim: true },
            { k: 'v', label: 'Version', w: '72px', r: true },
            { k: 'n', label: 'Assigned', w: '80px', r: true },
            { k: 'drift', label: 'Drift', w: '72px', r: true },
            { k: 'up', label: 'Changed', w: '188px', dim: true }
          ]}
          rows={rows.map(p => ({
            id: p.id,
            name: { v: p.name, strong: true },
            type: { t: 'icon', i: TYPE_ICON[p.type], l: p.type, c: 'tx', s: p.type },
            level: p.level,
            inh: p.inherits ? p.inherits : { v: p.template ? 'Template' : '—', muted: true },
            owner: p.owner,
            v: { v: `v${p.version}`, s: p.version },
            n: { v: String(p.assigned), s: p.assigned },
            drift: p.drift ? { t: 'status', i: 'triangle-alert', l: String(p.drift), c: 'warn', s: p.drift, tip: `${plural(p.drift, 'workload')} differ from the policy` } : { v: '0', muted: true, s: 0 },
            up: p.updated
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Settings'); setDiffV(null); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['policy', 'policies']}
          filtered={type !== (fixedType || 'All') || level !== 'All' || driftOnly || !!ql}
          onClear={() => { setType(fixedType || 'All'); setLevel('All'); setDriftOnly(false); setQ(''); }}
          emptyText="No policies yet. Start from a template; tenant and workload policies inherit from it."
          emptyAction="Create a policy"
          onEmpty={() => create.open(true)}
          footR="Global → tenant → workload; the most specific setting wins"
          sort="name"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Policy details"
          width={640}
          kicker={`${TYPE_PRODUCT[d.type]} policy · ${d.level}${d.template ? ' · template' : ''}`}
          title={d.name}
          status={
            <>
              <span>Version {d.version}</span>
              <span>{plural(d.assigned, 'workload')}</span>
              {d.drift ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />
                  <span style={{ color: 'var(--tx)' }}>{plural(d.drift, 'drifted workload')}</span>
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Btn kind="outline" icon="pencil" perm={cfg} onClick={() => create.open(true)}>
                Edit…
              </Btn>
              <Btn kind="outline" icon="copy" perm={cfg} onClick={() => ctx.toast(`Copied ${d.name} as a tenant policy`, 'ok')}>
                Duplicate
              </Btn>
              {d.drift ? (
                <Btn kind="outline" icon="refresh-cw" perm={cfg} onClick={() => { update(st => { st.policies.find(p => p.id === d.id)!.drift = 0; }); audit({ who: 'priya.raman', customer: 'h360', what: `Reapplied policy ${d.name}`, object: `${plural(d.drift, 'workload')}`, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.name} reapplied to ${plural(d.drift, 'workload')}`, 'ok'); }}>
                  Reapply to drifted
                </Btn>
              ) : null}
            </>
          }
          tabs={[
            { v: 'Settings', label: 'Settings' },
            { v: 'Inheritance', label: 'Inheritance' },
            { v: 'Versions', label: 'Versions', count: d.version },
            { v: 'Drift', label: 'Drift', count: d.drift },
            { v: 'Assigned', label: 'Assigned', count: d.assigned }
          ]}
          tab={tab}
          onTab={t => { setTab(t); setDiffV(null); }}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Settings' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.residency ? <Bar tone="info" icon="map-pin">Data residency: {d.residency}. Repositories and sites outside it are refused when the policy is saved.</Bar> : null}
              <Facts items={d.settings.map(([k, v]) => ({ k, v: v.replace(/^Inherited: /, ''), icon: v.startsWith('Inherited') ? 'arrow-down' : /overrides/.test(v) ? 'pencil' : undefined, tone: 'info' }))} labelW={180} />
              <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', display: 'flex', gap: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="arrow-down" /> inherited</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="pencil" /> set here, overrides the parent</span>
              </p>
            </div>
          ) : null}
          {tab === 'Inheritance' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {chain(d, s.policies).map((p, i, a) => (
                  <li key={p.id} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
                      <span style={{ width: 20, height: 20, marginTop: 10, display: 'grid', placeItems: 'center', border: `1px solid ${p.id === d.id ? 'var(--acc)' : 'var(--ln-2)'}`, background: p.id === d.id ? 'var(--acc)' : 'transparent', color: p.id === d.id ? 'var(--acc-ink)' : 'var(--tx-3)', font: '700 11px var(--f-ui)' }}>{i + 1}</span>
                      {i < a.length - 1 ? <span style={{ flex: 1, width: 2, background: 'var(--ln-2)' }} /> : null}
                    </span>
                    <div style={{ padding: '8px 0 16px' }}>
                      <div style={{ fontWeight: 600 }}>
                        {p.name} <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>· {p.level} · {p.owner}</span>
                      </div>
                      <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>{p.overrides?.length ? `Overrides: ${p.overrides.join(' · ')}` : 'Sets every value; nothing above it.'}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>A value set lower down wins. A tenant can tighten a global rule but cannot remove immutability or encryption that a parent requires.</p>
            </div>
          ) : null}
          {tab === 'Versions' ? (
            diffV != null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Btn kind="ghost" icon="chevron-left" onClick={() => setDiffV(null)} style={{ alignSelf: 'flex-start' }}>
                  All versions
                </Btn>
                <H3>
                  Version {diffV - 1} → {diffV}
                </H3>
                <MiniTable
                  label="Changes"
                  cols={[{ label: 'Setting', w: '180px' }, { label: 'Before' }, { label: 'After' }]}
                  rows={(POLICY_VERSIONS[d.id] || []).find(x => x.v === diffV)!.diff.map(([k, a, b]) => [k, <span key="a" style={{ color: 'var(--err)', textDecoration: 'line-through' }}>{a}</span>, <span key="b" style={{ color: 'var(--ok)' }}>{b}</span>])}
                />
                <div>
                  <Btn kind="outline" icon="undo-2" perm={cfg} onClick={() => ctx.toast(`Version ${diffV - 1} restored as version ${d.version + 1}`, 'ok')}>
                    Restore version {diffV - 1}
                  </Btn>
                </div>
              </div>
            ) : (
              <MiniTable
                label="Versions"
                cols={[{ label: 'Version', w: '72px' }, { label: 'Change' }, { label: 'By', w: '110px' }, { label: 'When', w: '176px' }]}
                rows={(POLICY_VERSIONS[d.id] || [{ v: d.version, when: d.updated, by: d.updatedBy, note: 'Current version', diff: [] }]).map(x => [`v${x.v}`, x.note, x.by, x.when])}
                onRow={i => {
                  const x = (POLICY_VERSIONS[d.id] || [])[i];
                  if (x && x.diff.length) setDiffV(x.v);
                }}
              />
            )
          ) : null}
          {tab === 'Drift' ? (
            <MiniTable
              label="Drift"
              cols={[{ label: 'Workload', w: '140px' }, { label: 'What differs' }, { label: 'Since', w: '176px' }]}
              rows={DRIFT.filter(x => x.policy === d.id).map(x => [<strong key="w" style={{ fontWeight: 700 }}>{x.w}</strong>, <span key="d" data-tip={x.what} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.what}</span>, x.since])}
              empty="Every assigned workload matches this policy. Drift is checked every hour."
            />
          ) : null}
          {tab === 'Assigned' ? (
            <MiniTable
              label="Assigned workloads"
              cols={[{ label: 'Workload' }, { label: 'Customer', w: '180px' }, { label: 'Criticality', w: '140px' }]}
              rows={WORKLOADS.filter(w => [w.backup.policy, w.dr.plan].some(x => x && (x === d.name || x.startsWith(d.name)))).map(w => [<strong key="n" style={{ fontWeight: 700 }}>{w.name}</strong>, CUSTOMERS.find(c => c.id === w.customer)!.name, w.tier])}
              empty={`${plural(d.assigned, 'workload')} assigned in other projects you cannot see from here.`}
            />
          ) : null}
        </Drawer>
      ) : null}
      {create.value ? <PolicyDialog ctx={ctx} fixedType={fixedType} closing={create.closing} onClose={create.close} /> : null}
    </>
  );
  if (fixedType)
    return (
      <Page>
        <PageHeader kicker="Protection" title="Policies" sub="Schedules, retention and where recovery points are stored. The same policies appear under Automation › Policies." />
        {body}
      </Page>
    );
  return body;
}

function chain(p: Policy, all: Policy[]): Policy[] {
  const out = [p];
  let cur = p;
  while (cur.inherits) {
    const parent = all.find(x => x.name === cur.inherits);
    if (!parent) break;
    out.unshift(parent);
    cur = parent;
  }
  return out;
}

function PolicyDialog({ ctx, fixedType, closing, onClose }: { ctx: Ctx; fixedType?: PolicyType; closing: boolean; onClose: () => void }) {
  const [type, setType] = useState<PolicyType>(fixedType || 'Backup');
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Tenant');
  const [tenant, setTenant] = useState('Atlas Freight GmbH');
  const [tpl, setTpl] = useState('Production daily');
  const [repo, setRepo] = useState('obj-check');
  const [immut, setImmut] = useState('Compliance lock, 14 d');
  const [refused, setRefused] = useState<string | null>(null);
  const cust = CUSTOMERS.find(c => c.name === tenant)!;
  const repoInfo = REPOS.find(r => r.name === repo)!;
  const save = () => {
    const eu = cust.residency.startsWith('European');
    const india = cust.residency.startsWith('India');
    if (type === 'Backup' && ((eu && !repoInfo.where.includes('Germany')) || (india && !repoInfo.where.includes('India')))) {
      setRefused(`${cust.name}'s data must stay in ${eu ? 'the European Union (GDPR rule RES-EU-01)' : 'India (DPDP rule RES-IN-01)'}. ${repo} is in ${repoInfo.where}. Choose a repository inside the region, or ask an Owner to change the residency rule.`);
      audit({ who: 'priya.raman', customer: cust.id, what: 'Tried to save backup policy', object: name || 'New policy', when: ctx.now(), r: 'refused', note: `Data residency: ${repo} is in ${repoInfo.where}.` });
      return;
    }
    ctx.toast(`Policy ${name.trim()} saved as version 1`, 'ok');
    audit({ who: 'priya.raman', customer: cust.id, what: `Created ${type} policy`, object: name.trim(), when: ctx.now(), r: 'ok' });
    onClose();
  };
  return (
    <Dialog
      size="lg"
      title="Create a policy"
      sub="Start from a template; anything you do not change is inherited and follows the template's updates."
      closing={closing}
      onClose={onClose}
      footNote="Saved as version 1. Earlier versions stay available."
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="check" disabled={!name.trim()} why="Name the policy." perm={ctx.can('configure', 'Creating policies')} onClick={save}>
            Save policy
          </Btn>
        </>
      }
    >
      {!fixedType ? (
        <div role="radiogroup" aria-label="Type" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
          {(['Backup', 'DR', 'Migration'] as PolicyType[]).map(t => (
            <RadioCard key={t} on={type === t} onClick={() => { setType(t); setTpl(t === 'Backup' ? 'Production daily' : t === 'DR' ? 'Business-critical' : 'Standard migration'); setRefused(null); }} icon={TYPE_ICON[t]} title={t} note={TYPE_PRODUCT[t]} />
          ))}
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="po-name" label="Name">
          <TextInput id="po-name" value={name} onChange={v => { setName(v); setRefused(null); }} placeholder="Atlas daily" />
        </Field>
        <Field id="po-tpl" label="Start from">
          <SelectInput id="po-tpl" value={tpl} onChange={setTpl} options={type === 'Backup' ? ['Production daily', 'Database hourly', 'Lab weekly'] : type === 'DR' ? ['Business-critical', 'Non-critical'] : ['Standard migration']} />
        </Field>
        <Field id="po-level" label="Level">
          <SelectInput id="po-level" value={level} onChange={setLevel} options={['Global', 'Tenant', 'Workload']} />
        </Field>
        <Field id="po-tenant" label="Tenant">
          <SelectInput id="po-tenant" value={tenant} onChange={v => { setTenant(v); setRefused(null); }} options={CUSTOMERS.map(c => c.name)} />
        </Field>
        {type === 'Backup' ? (
          <>
            <Field id="po-repo" label="Repository" hint={`${repoInfo.where} · tenant data must stay in: ${cust.residency}`}>
              <SelectInput id="po-repo" value={repo} onChange={v => { setRepo(v); setRefused(null); }} options={REPOS.map(r => ({ v: r.name, label: `${r.name} · ${r.where}` }))} />
            </Field>
            <Field id="po-imm" label="Immutability">
              <SelectInput id="po-imm" value={immut} onChange={setImmut} options={['Compliance lock, 14 d', 'Compliance lock, 30 d', 'Governance lock, 7 d', 'None']} />
            </Field>
          </>
        ) : null}
      </div>
      {refused ? (
        <Bar tone="err" icon="ban" multiline>
          <strong style={{ display: 'block', fontWeight: 600 }}>The policy was not saved</strong>
          {refused}
        </Bar>
      ) : null}
      <Activity items={[{ icon: 'arrow-down', tone: 'info', text: `Inherits from ${tpl}: schedule, retention, encryption and consistency.`, when: 'Change any of them after saving; the rest keeps following the template.' }]} />
    </Dialog>
  );
}
