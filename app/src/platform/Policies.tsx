import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { POLICY_VERSIONS, TIER_SHORT, TIERS, WORKLOADS, type Policy, type PolicyType, type Tier } from '../data/platform';
import { MODE_LABEL, MODE_TIP, TIER_TARGET, rpoOf } from '../products/resilience/data';
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

/** Recovery sites with the round trip measured from the protected sites over the last 7 days (p95). */
const DR_SITES = [
  { name: 'production-openstack', where: 'Chennai, India', rtt: 0.6 },
  { name: 'Chennai-proxmox-prod', where: 'Chennai, India', rtt: 0.4 },
  { name: 'region-2-os', where: 'Hyderabad, India', rtt: 11.8 },
  { name: 'fra-openstack', where: 'Frankfurt, Germany', rtt: 142 }
];
type DrMode = 'Scheduled' | 'Continuous' | 'Near-synchronous' | 'Synchronous';
type Topology = 'Pilot light' | 'Warm standby' | 'Hot standby';
/** Round trip each mode tolerates before writes slow down. */
const MODE_RTT: Record<DrMode, number> = { Scheduled: Infinity, Continuous: Infinity, 'Near-synchronous': 10, Synchronous: 5 };
const MODE_NOTE: Record<DrMode, string> = {
  Scheduled: 'A snapshot on a schedule; only changed blocks are copied.',
  Continuous: 'Every write journalled and sent as it happens. RPO of seconds; about 4 × the bandwidth.',
  'Near-synchronous': 'Writes are acknowledged locally and shipped within a second. Needs a round trip under 10 ms.',
  Synchronous: 'A write completes only when both sites have it. RPO zero. Needs a round trip under 5 ms, so a site in the same metro.'
};
const TOPO_NOTE: Record<Topology, string> = {
  'Pilot light': 'Replicas only; machines are created at failover. Cheapest; RTO in hours.',
  'Warm standby': 'Machines registered and powered off at the DR site. RTO in minutes.',
  'Hot standby': 'Machines running on reserved compute. RTO in seconds to minutes; reserved capacity is billed.'
};
const TIER_DEFAULT: Record<string, { mode: DrMode; topo: Topology }> = {
  'Mission Critical': { mode: 'Continuous', topo: 'Hot standby' },
  'Business Critical': { mode: 'Scheduled', topo: 'Warm standby' },
  Important: { mode: 'Scheduled', topo: 'Pilot light' }
};
const MODE_PRICE: Record<DrMode, number> = { Scheduled: 1, Continuous: 1.5, 'Near-synchronous': 2, Synchronous: 2.5 };
const TOPO_PRICE: Record<Topology, string> = { 'Pilot light': 'compute billed only while a failover or test runs', 'Warm standby': 'plus ₹3 a vCPU-day held', 'Hot standby': 'plus ₹9 a vCPU-day reserved' };
const HEAD: Record<PolicyType, { kicker: string; title: string; sub: string }> = {
  Backup: { kicker: 'Protection', title: 'Policies', sub: 'Schedules, retention and where recovery points are stored. The same policies appear under Automation › Policies.' },
  DR: { kicker: 'Resilience', title: 'Protection plans', sub: 'How often each workload is copied to its recovery site, how old its newest point may be (RPO) and how fast it must run again (RTO).' },
  Migration: { kicker: 'Mobility', title: 'Migration policies', sub: 'Sync passes, verification, test boots and cutover approval.' }
};
const covered = (p: Policy) => WORKLOADS.filter(w => w.dr.plan === p.name);

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
          {fixedType === 'DR' ? 'Create a protection plan' : 'Create a policy'}
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Policies"
          cols={fixedType === 'DR' ? DR_COLS : POLICY_COLS}
          rows={rows.map(p => (fixedType === 'DR' ? drRow(p) : policyRow(p)))}
          onRow={(id: string) => { drawer.open(id); setTab('Settings'); setDiffV(null); }}
          active={drawer.value}
          state={ctx.ui}
          unit={fixedType === 'DR' ? ['plan', 'plans'] : ['policy', 'policies']}
          filtered={type !== (fixedType || 'All') || level !== 'All' || driftOnly || !!ql}
          onClear={() => { setType(fixedType || 'All'); setLevel('All'); setDriftOnly(false); setQ(''); }}
          emptyText={fixedType === 'DR' ? 'No protection plans yet. Start from the Business-critical template; tenant plans inherit from it.' : 'No policies yet. Start from a template; tenant and workload policies inherit from it.'}
          emptyAction={fixedType === 'DR' ? 'Create a protection plan' : 'Create a policy'}
          onEmpty={() => create.open(true)}
          footR={fixedType === 'DR' ? 'RPO and RTO come from the criticality tier unless a plan overrides them' : 'Global → tenant → workload; the most specific setting wins'}
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
        <PageHeader kicker={HEAD[fixedType].kicker} title={HEAD[fixedType].title} sub={HEAD[fixedType].sub} />
        {body}
      </Page>
    );
  return body;
}

const POLICY_COLS = [
  { k: 'name', label: 'Policy', w: 'minmax(200px,1.5fr)' },
  { k: 'type', label: 'Type', w: '120px' },
  { k: 'level', label: 'Level', w: '96px' },
  { k: 'inh', label: 'Inherits from', w: 'minmax(140px,1fr)', dim: true },
  { k: 'owner', label: 'Owner', w: 'minmax(140px,1fr)', dim: true },
  { k: 'v', label: 'Version', w: '72px', r: true },
  { k: 'n', label: 'Assigned', w: '80px', r: true },
  { k: 'drift', label: 'Drift', w: '72px', r: true },
  { k: 'up', label: 'Changed', w: '188px', dim: true }
];
const driftCell = (p: Policy) => (p.drift ? { t: 'status', i: 'triangle-alert', l: String(p.drift), c: 'warn', s: p.drift, tip: `${plural(p.drift, 'workload')} differ from the policy` } : { v: '0', muted: true, s: 0 });
const policyRow = (p: Policy) => ({
  id: p.id,
  name: { v: p.name, strong: true },
  type: { t: 'icon', i: TYPE_ICON[p.type], l: p.type, c: 'tx', s: p.type },
  level: p.level,
  inh: p.inherits ? p.inherits : { v: p.template ? 'Template' : '—', muted: true },
  owner: p.owner,
  v: { v: `v${p.version}`, s: p.version },
  n: { v: String(p.assigned), s: p.assigned },
  drift: driftCell(p),
  up: p.updated
});
const DR_COLS = [
  { k: 'name', label: 'Plan', w: 'minmax(190px,1.5fr)' },
  { k: 'level', label: 'Level', w: '80px', dim: true },
  { k: 'tier', label: 'Tier', w: '72px' },
  { k: 'rpo', label: 'RPO', w: '72px', r: true },
  { k: 'rto', label: 'RTO', w: '64px', r: true },
  { k: 'mode', label: 'Replication', w: 'minmax(120px,1fr)', dim: true },
  { k: 'n', label: 'Workloads', w: '88px', r: true },
  { k: 'comp', label: 'Within RPO', w: '150px' },
  { k: 'drift', label: 'Drift', w: '64px', r: true }
];
const drRow = (p: Policy) => {
  const ws = covered(p).filter(w => w.dr.s !== 'none' && w.dr.target);
  const ok = ws.filter(w => rpoOf(w).state === 'within').length;
  const unread = ws.filter(w => rpoOf(w).state === 'unreach').length;
  return {
    id: p.id,
    name: { v: p.name, strong: true },
    level: p.level,
    tier: p.dr ? { v: TIER_SHORT[p.dr.tier], tip: p.dr.tier, s: TIERS.indexOf(p.dr.tier) } : { v: '—', muted: true },
    rpo: p.dr ? p.dr.rpo : '—',
    rto: p.dr ? p.dr.rto : '—',
    mode: p.dr ? { v: p.dr.mode === 'Scheduled' ? `Every ${p.dr.every || p.dr.rpo}` : p.dr.mode, tip: p.dr.mode === 'Scheduled' || p.dr.mode === 'Continuous' ? `${MODE_LABEL[p.dr.mode]}. ${MODE_TIP[p.dr.mode]}${p.dr.topology ? ` ${p.dr.topology}.` : ''}` : `${MODE_NOTE[p.dr.mode]}${p.dr.topology ? ` ${p.dr.topology}.` : ''}` } : '—',
    n: { v: String(p.assigned), s: p.assigned },
    comp: ws.length ? { t: 'bar', pct: (ok / ws.length) * 100, c: ok === ws.length ? 'ok' : 'warn', v: `${ok} of ${ws.length}${unread ? ' · 1 not read' : ''}`, s: ok / ws.length } : { v: 'None visible here', muted: true, s: -1 },
    drift: driftCell(p)
  };
};

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
  const [level, setLevel] = useState<Policy['level']>('Tenant');
  const [tenant, setTenant] = useState('Atlas Freight GmbH');
  const [tpl, setTpl] = useState(fixedType === 'DR' ? 'Business-critical' : fixedType === 'Migration' ? 'Standard migration' : 'Production daily');
  const [repo, setRepo] = useState('obj-check');
  const [immut, setImmut] = useState('Compliance lock, 14 d');
  const [tier, setTier] = useState<Tier>('Mission Critical');
  const [rpo, setRpo] = useState('15 min');
  const [rto, setRto] = useState('1 h');
  const [mode, setMode] = useState<DrMode>('Continuous');
  const [topo, setTopo] = useState<Topology>('Hot standby');
  const [group, setGroup] = useState('One group for the whole plan');
  const [atRest, setAtRest] = useState('AES-256, tenant key from Settings › Keys');
  const [dest, setDest] = useState('production-openstack');
  const [versions, setVersions] = useState('2, one every 4 h');
  const [refused, setRefused] = useState<string | null>(null);
  const cust = CUSTOMERS.find(c => c.name === tenant)!;
  const repoInfo = REPOS.find(r => r.name === repo)!;
  const site = DR_SITES.find(x => x.name === dest)!;
  const pickTier = (t: Tier) => {
    setTier(t);
    const x = TIER_TARGET[t];
    if (x) {
      setRpo(x.rpo);
      setRto(x.rto);
    }
    if (TIER_DEFAULT[t]) {
      setMode(TIER_DEFAULT[t].mode);
      setTopo(TIER_DEFAULT[t].topo);
    }
    setRefused(null);
  };
  const modeErr = type === 'DR' && rpo === 'Seconds' && mode === 'Scheduled' ? 'An RPO of seconds needs continuous replication.' : null;
  const rttErr = type === 'DR' && site.rtt > MODE_RTT[mode] ? `${mode} replication to ${dest} would slow every write: the round trip is ${site.rtt} ms and ${mode.toLowerCase()} needs under ${MODE_RTT[mode]} ms. Choose a site in the same metro, or continuous replication.` : null;
  const price = Math.round(52 * MODE_PRICE[mode] * (tier === 'Mission Critical' ? 1.5 : 1));
  const err = !name.trim() ? 'Name the policy.' : modeErr || rttErr;
  const save = () => {
    const eu = cust.residency.startsWith('European');
    const india = cust.residency.startsWith('India');
    if (type === 'Backup' && ((eu && !repoInfo.where.includes('Germany')) || (india && !repoInfo.where.includes('India')))) {
      setRefused(`${cust.name}'s data must stay in ${eu ? 'the European Union (GDPR rule RES-EU-01)' : 'India (DPDP rule RES-IN-01)'}. ${repo} is in ${repoInfo.where}. Choose a repository inside the region, or ask an Owner to change the residency rule.`);
      audit({ who: 'priya.raman', customer: cust.id, what: 'Tried to save backup policy', object: name || 'New policy', when: ctx.now(), r: 'refused', note: `Data residency: ${repo} is in ${repoInfo.where}.` });
      return;
    }
    if (type === 'DR' && ((eu && !site.where.includes('Germany')) || (india && !site.where.includes('India')))) {
      setRefused(`${cust.name}'s data must stay in ${eu ? 'the European Union (GDPR rule RES-EU-01)' : 'India (DPDP rule RES-IN-01)'}. The recovery site ${dest} is in ${site.where}. Choose a recovery site inside the region.`);
      audit({ who: 'priya.raman', customer: cust.id, what: 'Tried to save protection plan', object: name || 'New plan', when: ctx.now(), r: 'refused', note: `Data residency: ${dest} is in ${site.where}.` });
      return;
    }
    const settings: [string, string][] =
      type === 'DR'
        ? [['Criticality tier', `${tier} (${TIER_SHORT[tier]})`], ['Recovery target (RPO)', rpo === 'Seconds' ? 'Seconds' : rpo], ['Recovery time (RTO)', rto], ['Replication mode', mode === 'Continuous' ? MODE_LABEL.Continuous : mode === 'Scheduled' ? `Scheduled every ${rpo}: snapshot and changed blocks` : `${mode} (round trip ${site.rtt} ms)`], ['DR topology', `${topo}: ${TOPO_NOTE[topo]}`], ['Write-order consistency', group], ['Encryption at the DR site', atRest], ['Recovery site', `${dest} (${site.where})`], ['Versions kept', versions], ['Drill cadence', TIER_TARGET[tier]?.drill || 'Not required'], ['Price', `₹${price} a workload a day, ${TOPO_PRICE[topo]}`]]
        : type === 'Backup'
          ? [['Inherits from', tpl], ['Repository', `${repo} (${repoInfo.where})`], ['Immutability', immut]]
          : [['Inherits from', tpl]];
    update(st => {
      st.policies.unshift({ id: 'p' + Date.now(), name: name.trim(), type, level, owner: level === 'Global' ? 'Host360' : cust.name, inherits: tpl, version: 1, updated: ctx.now(), updatedBy: 'priya.raman', assigned: 0, drift: 0, residency: cust.residency.startsWith('India') ? 'India only' : cust.residency.startsWith('European') ? 'EU only' : undefined, overrides: [], settings, dr: type === 'DR' ? { tier, rpo: rpo === 'Seconds' ? 'Seconds' : rpo, rto, mode, every: mode === 'Scheduled' ? rpo : undefined, dest, topology: topo, group } : undefined });
    });
    ctx.toast(`${type === 'DR' ? 'Protection plan' : 'Policy'} ${name.trim()} saved as version 1`, 'ok');
    audit({ who: 'priya.raman', customer: cust.id, what: `Created ${type === 'DR' ? 'protection plan' : `${type} policy`}`, object: name.trim(), when: ctx.now(), r: 'ok' });
    onClose();
  };
  return (
    <Dialog
      size="lg"
      title={type === 'DR' && fixedType ? 'Create a protection plan' : 'Create a policy'}
      sub="Start from a template; anything you do not change is inherited and follows the template's updates."
      closing={closing}
      onClose={onClose}
      footNote="Saved as version 1. Earlier versions stay available."
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="check" disabled={!!err} why={err || undefined} perm={ctx.can('configure', 'Creating policies')} onClick={save}>
            {type === 'DR' && fixedType ? 'Save plan' : 'Save policy'}
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
          <TextInput id="po-name" value={name} onChange={v => { setName(v); setRefused(null); }} placeholder={type === 'DR' ? 'Atlas Tier-1 replication' : 'Atlas daily'} />
        </Field>
        <Field id="po-tpl" label="Start from">
          <SelectInput id="po-tpl" value={tpl} onChange={setTpl} options={type === 'Backup' ? ['Production daily', 'Database hourly', 'Lab weekly'] : type === 'DR' ? ['Business-critical', 'Non-critical'] : ['Standard migration']} />
        </Field>
        <Field id="po-level" label="Level">
          <SelectInput id="po-level" value={level} onChange={v => setLevel(v as Policy['level'])} options={['Global', 'Tenant', 'Workload']} />
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
        {type === 'DR' ? (
          <>
            <Field id="po-tier" label="Criticality tier" hint="Sets the RPO, RTO and drill cadence; change them below if this plan differs.">
              <SelectInput id="po-tier" value={tier} onChange={v => pickTier(v as Tier)} options={TIERS.filter(t => TIER_TARGET[t]).map(t => ({ v: t, label: `${TIER_SHORT[t]} · ${t}` }))} />
            </Field>
            <Field id="po-dest" label="Recovery site" hint={`${site.where} · tenant data must stay in: ${cust.residency}`}>
              <SelectInput id="po-dest" value={dest} onChange={v => { setDest(v); setRefused(null); }} options={DR_SITES.map(x => ({ v: x.name, label: `${x.name} · ${x.where}` }))} />
            </Field>
            <Field id="po-rpo" label="Recovery point objective (RPO)" err={modeErr}>
              <SelectInput id="po-rpo" value={rpo} onChange={v => { setRpo(v); if (v === 'Seconds' && mode === 'Scheduled') setMode('Continuous'); }} options={['Zero', 'Seconds', '15 min', '1 h', '4 h', '1 d'].map(o => ({ v: o, label: o === 'Zero' ? 'Zero (synchronous)' : o }))} />
            </Field>
            <Field id="po-rto" label="Recovery time objective (RTO)">
              <SelectInput id="po-rto" value={rto} onChange={setRto} options={['15 min', '1 h', '4 h', '24 h']} />
            </Field>
            <div role="radiogroup" aria-label="Replication mode" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <RadioCard on={mode === 'Scheduled'} onClick={() => { setMode('Scheduled'); if (rpo === 'Seconds' || rpo === 'Zero') setRpo('15 min'); }} icon="calendar-clock" title="Scheduled" note={rpo === 'Seconds' || rpo === 'Zero' ? MODE_NOTE.Scheduled : `A snapshot every ${rpo}; only changed blocks are copied.`} />
              <RadioCard on={mode === 'Continuous'} onClick={() => { setMode('Continuous'); if (rpo === 'Zero') setRpo('Seconds'); }} icon="activity" title="Continuous (asynchronous)" note={MODE_NOTE.Continuous} />
              <RadioCard on={mode === 'Near-synchronous'} onClick={() => { setMode('Near-synchronous'); if (rpo === 'Zero') setRpo('Seconds'); }} icon="zap" title="Near-synchronous" note={MODE_NOTE['Near-synchronous']} tag={site.rtt > MODE_RTT['Near-synchronous'] ? `${site.rtt} ms` : undefined} />
              <RadioCard on={mode === 'Synchronous'} onClick={() => { setMode('Synchronous'); setRpo('Zero'); }} icon="copy-check" title="Synchronous" note={MODE_NOTE.Synchronous} tag={site.rtt > MODE_RTT.Synchronous ? `${site.rtt} ms` : undefined} />
            </div>
            {rttErr ? (
              <div style={{ gridColumn: 'span 2' }}>
                <Bar tone="warn" multiline>{rttErr}</Bar>
              </div>
            ) : (mode === 'Near-synchronous' || mode === 'Synchronous') ? (
              <div style={{ gridColumn: 'span 2', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Round trip to {dest}: {site.rtt} ms (p95, last 7 days). If it rises above {MODE_RTT[mode]} ms for 5 minutes, replication drops to continuous and an alert is raised; it returns on its own.</div>
            ) : null}
            <div role="radiogroup" aria-label="DR topology" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
              {(['Pilot light', 'Warm standby', 'Hot standby'] as Topology[]).map(t => (
                <RadioCard key={t} on={topo === t} onClick={() => setTopo(t)} icon={t === 'Pilot light' ? 'power' : t === 'Warm standby' ? 'pause' : 'play'} title={t} note={TOPO_NOTE[t]} />
              ))}
            </div>
            <Field id="po-grp" label="Write-order consistency" hint="Workloads in one group share each recovery point, so a database and its application never disagree. The group’s RPO is its slowest member’s.">
              <SelectInput id="po-grp" value={group} onChange={setGroup} options={['One group for the whole plan', 'One group per application', 'None: each workload on its own']} />
            </Field>
            <Field id="po-enc" label="Encryption at the DR site" hint="Replicas, journals and test copies at rest.">
              <SelectInput id="po-enc" value={atRest} onChange={setAtRest} options={['AES-256, tenant key from Settings › Keys', 'AES-256, the customer’s own KMS key', 'AES-256, a key held only at the DR site']} />
            </Field>
            <Field id="po-ver" label="Versions kept at the recovery site">
              <SelectInput id="po-ver" value={versions} onChange={setVersions} options={['1', '2, one every 4 h', '4, one every 6 h', '24, one every hour']} />
            </Field>
            <div style={{ alignSelf: 'end', padding: '8px 12px', border: '1px solid var(--ln)', background: 'var(--panel-2)', font: '13px/18px var(--f-ui)' }}>
              <div style={{ fontWeight: 600 }}>₹{price} a workload a day</div>
              <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{TIER_SHORT[tier]} · {mode} · {TOPO_PRICE[topo]}</div>
            </div>
          </>
        ) : null}
      </div>
      {refused ? (
        <Bar tone="err" icon="ban" multiline>
          <strong style={{ display: 'block', fontWeight: 600 }}>The {type === 'DR' ? 'plan' : 'policy'} was not saved</strong>
          {refused}
        </Bar>
      ) : null}
      <Activity items={[{ icon: 'arrow-down', tone: 'info', text: type === 'DR' ? `Inherits from ${tpl}: priority, sync window and drill evidence.` : `Inherits from ${tpl}: schedule, retention, encryption and consistency.`, when: 'Change any of them after saving; the rest keeps following the template.' }]} />
    </Dialog>
  );
}
