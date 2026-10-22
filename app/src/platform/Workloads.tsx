import { useEffect, useMemo, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { Btn, Field, FilterInput, RadioCard, Seg, SelectFilter, SelectInput, Tabs, Tag, TextArea, TextInput, InfoTip } from '../ui/controls';
import { DiscoveryPage } from './Discovery';
import { RecoveryPointsTab, pointsOf } from './RecoveryPoints';
import { Activity, Bar, BulkBar, DrawerTiles, Facts, H3, MiniTable, Page, PageHeader, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, StepUp, useClosable } from '../ui/overlay';
import { audit, update } from './store';
import { nextApprovalId } from '../products/resilience/Failover';
import type { Ctx } from '../ui/ctx';
import { APPLICATIONS, P_ALERTS, TIERS, TIER_RULES, W_ICON, W_TYPES, WORKLOADS, type Stage, type Tier, type Workload } from '../data/platform';
import { B_ST, D_ST, Go, M_ST, TIER_RANK, TierTag, custName, inScope, showCustomerCol, stCell } from './common';

type View = 'all' | 'gaps' | 'alerts' | 'moving';
const STAGES: Stage[] = ['Discovered', 'Assessed', 'Migrated', 'Protected', 'Replicated', 'Tested', 'Restored', 'Retired'];

/** Gaps against what the workload's tier requires. */
export function gapsOf(w: Workload): string[] {
  const g: string[] = [];
  const needsBackup = w.backup.s !== 'na';
  if (needsBackup && w.backup.s === 'none') g.push('No backup policy');
  if (w.backup.s === 'failed') g.push('Last backup failed');
  if ((w.tier === 'Mission Critical' || w.tier === 'Business Critical') && w.dr.s === 'none') g.push(`No DR plan for ${w.tier}`);
  if (w.dr.s === 'behind') g.push('Behind recovery target');
  if (w.mig.s === 'blocked') g.push('Migration blocked');
  if (w.tier === 'Mission Critical' && w.backup.s !== 'na' && w.backup.policy && !/immutable|hourly|Database|clinical/i.test(w.backup.policy)) g.push('Immutable backup missing');
  return g;
}

function WorkloadList({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [tier, setTier] = useState('All');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [tierOver, setTierOver] = useState<Record<string, Tier>>({});
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const tierDlg = useClosable<string[]>();

  useEffect(() => {
    if (ctx.openId && WORKLOADS.some(w => w.id === ctx.openId)) {
      drawer.open(ctx.openId);
      setTab('Overview');
    }
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(() => WORKLOADS.filter(w => inScope(ctx, w.customer, w.project)).map(w => ({ ...w, tier: tierOver[w.id] || w.tier })), [ctx.project, ctx.actingAs, tierOver]); // eslint-disable-line react-hooks/exhaustive-deps
  const gapsN = all.filter(w => gapsOf(w).length).length;
  const alertN = all.filter(w => w.alerts > 0).length;
  const movingN = all.filter(w => ['syncing', 'testing', 'ready', 'cutover', 'blocked'].includes(w.mig.s)).length;
  const ql = q.trim().toLowerCase();
  const rows = all.filter(
    w =>
      (view === 'all' || (view === 'gaps' && gapsOf(w).length) || (view === 'alerts' && w.alerts > 0) || (view === 'moving' && ['syncing', 'testing', 'ready', 'cutover', 'blocked'].includes(w.mig.s))) &&
      (type === 'All' || w.type === type) &&
      (tier === 'All' || w.tier === tier) &&
      (!ql || `${w.name} ${w.os} ${w.owner} ${w.site} ${w.tags.join(' ')} ${w.app || ''}`.toLowerCase().includes(ql))
  );
  const custCol = showCustomerCol(ctx);
  const cols = [
    { k: 'name', label: 'Workload', w: 'minmax(150px,1.4fr)' },
    { k: 'type', label: 'Type', w: '124px' },
    ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(100px,1fr)' }] : []),
    { k: 'tier', label: 'Criticality', w: '128px' },
    { k: 'backup', label: 'Backup', w: '148px' },
    { k: 'dr', label: 'Disaster recovery', w: '160px' },
    { k: 'mig', label: 'Migration', w: '150px' },
    { k: 'alerts', label: 'Alerts', w: '60px', r: true },
    { k: 'gaps', label: 'Gaps', w: '56px', r: true }
  ];
  const tableRows = rows.map(w => {
    const g = gapsOf(w);
    return {
      id: w.id,
      name: { v: w.name, strong: true, tip: `${w.name} · ${w.os}` },
      type: { t: 'icon', i: W_ICON[w.type], l: w.type, c: 'tx', s: w.type },
      cust: custName(w.customer),
      tier: { v: w.tier, s: TIER_RANK[w.tier], muted: w.tier === 'Standard' },
      backup: stCell(B_ST[w.backup.s], w.backup.note || w.backup.policy),
      dr: stCell(D_ST[w.dr.s], w.dr.note || (w.dr.plan ? `${w.dr.plan}${w.dr.age ? ` · newest point ${w.dr.age} old` : ''}` : undefined)),
      mig: stCell(M_ST[w.mig.s], w.mig.note || w.mig.wave),
      owner: w.owner,
      alerts: w.alerts ? { t: 'status', i: 'bell', l: String(w.alerts), c: 'warn', s: w.alerts } : { v: '0', muted: true, s: 0 },
      gaps: g.length ? { t: 'status', i: 'triangle-alert', l: String(g.length), c: 'warn', s: g.length, tip: g.join(' · ') } : { v: '0', muted: true, s: 0 }
    };
  });
  const selIds = Object.keys(sel).filter(k => sel[k] && rows.some(r => r.id === k));
  const filtered = view !== 'all' || type !== 'All' || tier !== 'All' || !!ql;
  const cfg = ctx.can('configure', 'Changing criticality');
  const op = ctx.can('operate', 'Starting a backup');
  const d = drawer.value ? all.find(w => w.id === drawer.value) : null;

  return (
    <Page>
      <PageHeader
        kicker="Platform"
        title="Workloads"
        sub={`Every machine, database and service in ${ctx.actingAs ? custName(ctx.actingAs.customer) : ctx.project === 'All projects' ? 'every customer' : ctx.project}, with its backup, DR and migration state.`}
        info={<InfoTip tip="Criticality is set once per workload or application. It decides the backup policy, the DR target, how often drills run and who is paged when something fails." />}
        actions={
          <Btn
            kind="secondary"
            icon="refresh-cw"
            perm={op}
            onClick={() => {
              ctx.startJob({ name: 'Discovery scan', object: '6 connections', product: 'Platform', type: 'Discovery', phases: ['Queued', 'Read inventory', 'Compare with last scan', 'Update workloads', 'Done'], speed: 9, doneToast: 'Discovery finished: 2 new workloads, 1 changed', doneLog: 'Found 2 new workloads and 1 changed disk layout' });
              ctx.toast('Discovery started on 6 connections', 'info');
            }}
          >
            Scan for changes
          </Btn>
        }
      />
      <Tabs<'list' | 'discovery'> label="Workloads" value="list" onChange={v => ctx.go(v === 'list' ? 'workloads' : 'workloads/discovery')} style={{ margin: '0 24px 12px', padding: 0 }} tabs={[{ v: 'list', label: 'Workloads' }, { v: 'discovery', label: 'Discovery' }]} />
      <Toolbar>
        {selIds.length ? (
          <BulkBar label={plural(selIds.length, 'workload') + ' selected'} onClear={() => setSel({})}>
            <Btn kind="ghost" icon="gauge" perm={cfg} onClick={() => tierDlg.open(selIds)}>
              Set criticality…
            </Btn>
            <Btn kind="ghost" icon="play" perm={op} onClick={() => { ctx.toast(`Backup queued for ${plural(selIds.length, 'workload')}`, 'ok'); setSel({}); }}>
              Back up now
            </Btn>
            <Btn kind="ghost" icon="download" onClick={() => ctx.toast(`Exported ${plural(selIds.length, 'workload')} to CSV`, 'ok')}>
              Export
            </Btn>
          </BulkBar>
        ) : (
          <>
            <Seg<View>
              label="Show"
              value={view}
              onChange={setView}
              options={[
                { v: 'all', label: 'All', count: all.length },
                { v: 'gaps', label: 'Protection gaps', count: gapsN },
                { v: 'alerts', label: 'Open alerts', count: alertN },
                { v: 'moving', label: 'Migrating', count: movingN }
              ]}
            />
            <FilterInput value={q} onChange={setQ} placeholder="Filter by name, OS, owner, tag" label="Filter workloads" width={240} />
            <SelectFilter label="Type" value={type} onChange={setType} options={['All', ...W_TYPES]} />
            <SelectFilter label="Criticality" value={tier} onChange={setTier} options={['All', ...TIERS]} />
            <Spacer />
          </>
        )}
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Workloads"
          cols={cols}
          rows={tableRows}
          sel={sel}
          onSel={(id: string) => setSel(s => ({ ...s, [id]: !s[id] }))}
          onSelAll={(ids: string[], on: boolean) => setSel(s => ({ ...s, ...Object.fromEntries(ids.map(i => [i, on])) }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['workload', 'workloads']}
          filtered={filtered}
          onClear={() => { setView('all'); setType('All'); setTier('All'); setQ(''); }}
          emptyText="No workloads have been discovered yet. Connect a vCenter, Proxmox VE or OpenStack platform and Aegis lists what it finds."
          emptyAction="Connect a platform"
          onEmpty={() => ctx.go('sites')}
          unreachText="Could not be read: the inventory service did not answer within 30 s."
          footR="Criticality drives backup, DR, drills and escalation"
          sort="name"
        />
      </TableArea>

      {d ? <WorkloadDrawer ctx={ctx} w={d} tab={tab} setTab={setTab} closing={drawer.closing} onClose={drawer.close} onTier={() => tierDlg.open([d.id])} /> : null}
      {tierDlg.value ? (
        <TierDialog
          ctx={ctx}
          ws={all.filter(w => tierDlg.value!.includes(w.id))}
          closing={tierDlg.closing}
          onClose={tierDlg.close}
          onSave={t => {
            setTierOver(o => ({ ...o, ...Object.fromEntries(tierDlg.value!.map(id => [id, t])) }));
            ctx.toast(tierDlg.value!.length === 1 ? `${all.find(w => w.id === tierDlg.value![0])!.name} is now ${t}` : `${plural(tierDlg.value!.length, 'workload')} set to ${t}`, 'ok');
            tierDlg.close();
            setSel({});
          }}
        />
      ) : null}
    </Page>
  );
}

function WorkloadDrawer({ ctx, w, tab, setTab, closing, onClose, onTier }: { ctx: Ctx; w: Workload; tab: string; setTab: (t: string) => void; closing: boolean; onClose: () => void; onTier: () => void }) {
  const b = B_ST[w.backup.s];
  const dr = D_ST[w.dr.s];
  const m = M_ST[w.mig.s];
  const app = APPLICATIONS.find(a => a.name === w.app);
  const alerts = P_ALERTS.filter(a => a.object === w.name);
  const g = gapsOf(w);
  const reached = new Set(w.lifecycle.map(l => l.stage));
  const deps = (w.deps || []).map(id => WORKLOADS.find(x => x.id === id)).filter(Boolean) as Workload[];
  const usedBy = WORKLOADS.filter(x => (x.deps || []).includes(w.id));
  const op = ctx.can('operate', 'Starting a backup');
  const restore = useClosable<boolean>();
  const mark = useClosable<boolean>();
  const tabs = [
    { v: 'Overview', label: 'Overview' },
    { v: 'Protection', label: 'Protection' },
    { v: 'Points', label: 'Recovery points', count: pointsOf(w).length || '' },
    { v: 'Lifecycle', label: 'Lifecycle', count: w.lifecycle.length },
    { v: 'Dependencies', label: 'Dependencies', count: deps.length + usedBy.length },
    { v: 'Alerts', label: 'Alerts', count: alerts.length }
  ];
  return (
    <>
    <Drawer
      label="Workload details"
      width={640}
      kicker={`Workload · ${w.type} · ${custName(w.customer)}`}
      title={w.name}
      status={
        <>
          <TierTag tier={w.tier} />
          <span>{w.os}</span>
          <span>{w.site}</span>
        </>
      }
      actions={
        <>
          <Btn kind="outline" icon="gauge" perm={ctx.can('configure', 'Changing criticality')} onClick={onTier}>
            Set criticality…
          </Btn>
          {w.backup.s !== 'na' ? (
            <Btn kind="outline" icon="play" perm={op} onClick={() => { ctx.startJob({ name: 'Backup', object: w.name, product: 'Backup', phases: ['Queued', 'Snapshot', 'Read changes', 'Write', 'Verify', 'Done'], speed: 7, rate: '164 MB/s' }); ctx.toast(`Backup started for ${w.name}`, 'info'); }}>
              Back up now
            </Btn>
          ) : null}
          {w.backup.s !== 'na' ? (
            <Btn kind="outline" icon="rotate-ccw" perm={ctx.can('restore', 'Restoring')} onClick={() => (w.sensitive ? restore.open(true) : ctx.go('backup/restore'))}>
              {w.sensitive ? 'Request a restore…' : 'Restore…'}
            </Btn>
          ) : null}
          {w.dr.s !== 'na' && w.dr.s !== 'none' ? (
            <Btn kind="outline" icon="life-buoy" onClick={() => ctx.go('dr/servers', w.name)}>
              Open in Resilience
            </Btn>
          ) : null}
        </>
      }
      tabs={tabs}
      tab={tab}
      onTab={setTab}
      closing={closing}
      onClose={onClose}
    >
      {tab === 'Overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {g.length ? (
            <Bar tone="warn" multiline>
              {plural(g.length, 'protection gap')}: {g.join(' · ')}.
            </Bar>
          ) : null}
          <DrawerTiles
            items={[
              { label: 'Backup', value: b.l, icon: b.i, tone: b.c, sub: w.backup.last ? `Last ${w.backup.last}` : w.backup.note || '—' },
              { label: 'Disaster recovery', value: dr.l, icon: dr.i, tone: dr.c, sub: w.dr.age ? `Newest point ${w.dr.age} old · target ${w.dr.target}` : w.dr.note || w.dr.plan || '—' },
              { label: 'Migration', value: m.l, icon: m.i, tone: m.c, sub: w.mig.wave || w.mig.note || '—' }
            ]}
          />
          <Facts
            items={[
              { k: 'Type', v: w.type, icon: W_ICON[w.type] },
              { k: 'Operating system', v: w.os },
              { k: 'Customer', v: custName(w.customer) },
              { k: 'Project', v: w.project },
              { k: 'Site', v: w.site },
              { k: 'Environment', v: w.env },
              { k: 'Application', v: app ? <Go ctx={ctx} to="applications" id={app.id}>{app.name}</Go> : 'Not in an application', muted: !app },
              { k: 'Owner', v: w.owner },
              { k: 'Classification', v: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{w.sensitive ? <Icon name="eye-off" style={{ color: 'var(--tx-2)' }} /> : null}{`${w.classification}${w.sensitive ? ' · sensitive, restores need an additional approver' : ''}`}<Btn kind="ghost" size="sm" perm={ctx.can('admin', 'Changing sensitivity')} onClick={() => mark.open(true)}>{w.sensitive ? 'Clear…' : 'Mark sensitive…'}</Btn></span> },
              { k: 'Size', v: w.sizeGB ? (w.sizeGB >= 1000 ? `${(w.sizeGB / 1024).toFixed(2)} TB` : `${w.sizeGB.toFixed(2)} GB`) : 'No data to store', muted: !w.sizeGB },
              ...(w.cpu ? [{ k: 'CPU and memory', v: `${w.cpu} · ${w.mem}` }] : []),
              ...(w.ip ? [{ k: 'Address', v: w.ip }] : []),
              { k: 'Tags', v: w.tags.length ? <span style={{ display: 'flex', gap: 6 }}>{w.tags.map(t => <Tag key={t}>{t}</Tag>)}</span> : 'None', muted: !w.tags.length }
            ]}
          />
        </div>
      ) : null}
      {tab === 'Protection' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section>
            <H3 right={<Status icon={b.i} label={b.l} tone={b.c} spin={b.spin} />}>Backup · Protection</H3>
            <Facts
              items={
                w.backup.s === 'na'
                  ? [{ k: 'State', v: w.backup.note || 'Not applicable to this workload', muted: true }]
                  : [
                      { k: 'Policy', v: w.backup.policy || 'None assigned', muted: !w.backup.policy },
                      { k: 'Last backup', v: w.backup.last || 'Never', muted: !w.backup.last },
                      { k: 'Recovery points', v: w.backup.points != null ? String(w.backup.points) : '—' },
                      { k: 'Required by tier', v: TIER_RULES[w.tier].backup },
                      ...(w.backup.note ? [{ k: 'Note', v: w.backup.note, icon: 'triangle-alert', tone: 'warn' }] : [])
                    ]
              }
            />
          </section>
          <section>
            <H3 right={<Status icon={dr.i} label={dr.l} tone={dr.c} spin={dr.spin} />}>Disaster recovery · Resilience</H3>
            <Facts
              items={
                w.dr.s === 'na'
                  ? [{ k: 'State', v: w.dr.note || 'Not applicable to this workload', muted: true }]
                  : [
                      { k: 'Protection plan', v: w.dr.plan || 'None', muted: !w.dr.plan },
                      { k: 'Recovery target', v: w.dr.target || '—' },
                      { k: 'Newest point', v: w.dr.age ? `${w.dr.age} old` : w.dr.s === 'unreach' ? 'Could not be read' : '—', muted: !w.dr.age },
                      { k: 'Required by tier', v: TIER_RULES[w.tier].dr },
                      { k: 'Drill cadence', v: TIER_RULES[w.tier].drill },
                      ...(w.dr.note ? [{ k: 'Note', v: w.dr.note, icon: 'triangle-alert', tone: 'warn' }] : [])
                    ]
              }
            />
          </section>
          <section>
            <H3 right={<Status icon={m.i} label={m.l} tone={m.c} spin={m.spin} />}>Migration · Mobility</H3>
            <Facts
              items={
                w.mig.s === 'na'
                  ? [{ k: 'State', v: 'Not part of a migration', muted: true }]
                  : [
                      { k: 'Wave', v: w.mig.wave || 'Not in a wave', muted: !w.mig.wave },
                      { k: 'Next step', v: w.mig.next || '—' },
                      { k: 'After cutover', v: `Backup and DR are offered from ${w.tier}` },
                      ...(w.mig.note ? [{ k: 'Note', v: w.mig.note, icon: w.mig.s === 'blocked' ? 'ban' : 'info', tone: w.mig.s === 'blocked' ? 'err' : 'info' }] : [])
                    ]
              }
            />
          </section>
          <section>
            <H3>Escalation</H3>
            <Facts items={[{ k: 'When something fails', v: TIER_RULES[w.tier].escalation }]} />
          </section>
        </div>
      ) : null}
      {tab === 'Points' ? <RecoveryPointsTab ctx={ctx} w={w} onRestore={() => (w.sensitive ? restore.open(true) : ctx.go('backup/restore'))} /> : null}
      {tab === 'Lifecycle' ? (
        <ol aria-label="Lifecycle" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column' }}>
          {STAGES.map(st => {
            const ev = [...w.lifecycle].reverse().find(l => l.stage === st);
            const on = reached.has(st);
            return (
              <li key={st} style={{ display: 'grid', gridTemplateColumns: '20px 120px minmax(0,1fr)', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--ln)', color: on ? 'var(--tx)' : 'var(--tx-3)' }}>
                <Icon name={on ? 'circle-check' : 'circle'} style={{ color: on ? 'var(--ok)' : 'var(--tx-3)', marginTop: 2 }} />
                <span style={{ fontWeight: on ? 600 : 400 }}>{st}</span>
                <span>
                  {ev ? (
                    <>
                      <span style={{ display: 'block' }}>{ev.note}</span>
                      <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{ev.when}</span>
                    </>
                  ) : (
                    <span style={{ font: '13px var(--f-ui)' }}>Not yet</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {tab === 'Dependencies' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section>
            <H3>Depends on</H3>
            <MiniTable
              label="Depends on"
              cols={[{ label: 'Workload' }, { label: 'Type', w: '140px' }, { label: 'Criticality', w: '140px' }]}
              rows={deps.map(x => [<strong key="n" style={{ fontWeight: 700 }}>{x.name}</strong>, x.type, x.tier])}
              empty="Nothing found. Dependencies come from network flows seen during discovery."
            />
          </section>
          <section>
            <H3>Used by</H3>
            <MiniTable label="Used by" cols={[{ label: 'Workload' }, { label: 'Type', w: '140px' }, { label: 'Criticality', w: '140px' }]} rows={usedBy.map(x => [<strong key="n" style={{ fontWeight: 700 }}>{x.name}</strong>, x.type, x.tier])} empty="No other workload depends on this one." />
          </section>
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>Dependencies set the backup consistency group, the DR boot order and which migration wave this workload joins.</p>
        </div>
      ) : null}
      {tab === 'Alerts' ? (
        alerts.length ? (
          <Activity items={alerts.map(a => ({ icon: a.sev === 'critical' ? 'circle-x' : a.sev === 'warning' ? 'triangle-alert' : 'info', tone: a.sev === 'critical' ? 'err' : a.sev === 'warning' ? 'warn' : 'info', text: <><strong style={{ fontWeight: 600 }}>{a.title}</strong> · {a.detail}</>, when: `${a.raised} · ${a.state}` }))} />
        ) : (
          <p style={{ color: 'var(--tx-2)' }}>No open alerts for {w.name}.</p>
        )
      ) : null}
    </Drawer>
    {restore.value ? <SensitiveRestoreDialog ctx={ctx} w={w} closing={restore.closing} onClose={restore.close} /> : null}
    {mark.value ? <SensitiveDialog ctx={ctx} w={w} closing={mark.closing} onClose={mark.close} /> : null}
    </>
  );
}

/** A restore of a sensitive workload never runs on one person's say-so: it becomes an approval for two. */
function SensitiveRestoreDialog({ ctx, w, closing, onClose }: { ctx: Ctx; w: Workload; closing: boolean; onClose: () => void }) {
  const [what, setWhat] = useState<'vm' | 'files'>('files');
  const [to, setTo] = useState('Alternate location (isolated)');
  const [point, setPoint] = useState(w.backup.last || 'Latest');
  const [why, setWhy] = useState('');
  const [approver, setApprover] = useState(w.customer === 'mer' ? 'Data protection officer (dpo@meridianbank.in)' : w.customer === 'sah' ? 'Medical records officer (mro@sahyadrihospitals.in)' : 'Data owner (priya.raman)');
  const [mfa, setMfa] = useState(false);
  const ok = why.trim().length >= 8 && mfa;
  return (
    <Dialog
      title={`Request a restore of ${w.name}`}
      sub={`${w.name} is sensitive (${w.classification}). The restore runs once the workload owner and a sensitive-data approver have both approved.`}
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="send" disabled={!ok} why={!mfa ? 'Confirm it is you first.' : 'Give the reason or ticket.'} onClick={() => {
            const id = nextApprovalId();
            update(s => {
              s.approvals.unshift({ id, kind: 'Sensitive restore', object: `${what === 'vm' ? 'Whole VM' : 'Files'} from ${w.name}`, customer: w.customer, requester: 'priya.raman', approvers: `Workload owner (${w.owner}) and ${approver}`, needed: 2, given: [], requested: ctx.now(), expires: '22 Oct 2026, 16:05 IST', state: 'pending', reason: why.trim(), evidence: [`Recovery point ${point}`, `Restore to ${to}`], rule: 'Restores of sensitive workloads need an additional approver' });
            });
            audit({ who: 'priya.raman', customer: w.customer, what: 'Requested a sensitive restore', object: w.name, when: ctx.now(), r: 'ok', note: `${id}: ${why.trim()}` });
            ctx.toast(`${id}: the restore of ${w.name} waits for 2 approvals`, 'ok');
            onClose();
          }}>Send for approval</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={what === 'files'} onClick={() => setWhat('files')} icon="file" title="Files and folders" note="Chosen after approval, from the recovery point" />
        <RadioCard on={what === 'vm'} onClick={() => setWhat('vm')} icon="monitor" title="Whole VM" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="sr-p" label="Recovery point"><SelectInput id="sr-p" value={point} onChange={setPoint} options={[point, 'One day earlier', 'One week earlier'].filter((x, i, a) => a.indexOf(x) === i)} /></Field>
        <Field id="sr-t" label="Restore to"><SelectInput id="sr-t" value={to} onChange={setTo} options={['Alternate location (isolated)', 'Original location (overwrite)']} /></Field>
      </div>
      <Field id="sr-a" label="Additional approver" hint="From the approval rule for sensitive workloads"><SelectInput id="sr-a" value={approver} onChange={setApprover} options={[approver, 'Security officer (security@host360.ai)'].filter((x, i, a) => a.indexOf(x) === i)} /></Field>
      <Field id="sr-w" label="Reason or ticket"><TextInput id="sr-w" value={why} onChange={setWhy} placeholder="INC-20431: patient record export corrupted" /></Field>
      <StepUp verified={mfa} onVerified={() => setMfa(true)} />
    </Dialog>
  );
}

function SensitiveDialog({ ctx, w, closing, onClose }: { ctx: Ctx; w: Workload; closing: boolean; onClose: () => void }) {
  const [why, setWhy] = useState('');
  const on = !w.sensitive;
  return (
    <Dialog
      title={on ? `Mark ${w.name} as sensitive` : `Clear sensitive from ${w.name}`}
      sub={on ? 'From now on every restore of it needs an additional approver, and its recovery points are hidden from search.' : 'Restores go back to the normal approval rule. The change is recorded and the data owner is told.'}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind={on ? 'primary' : 'danger'} icon={on ? 'eye-off' : 'eye'} perm={ctx.can('admin', 'Changing sensitivity')} disabled={why.trim().length < 6} why="Say why." onClick={() => { update(() => { w.sensitive = on; }); audit({ who: 'priya.raman', customer: w.customer, what: on ? 'Marked a workload sensitive' : 'Cleared sensitive from a workload', object: w.name, when: ctx.now(), r: 'ok', note: why.trim() }); ctx.toast(on ? `${w.name} is sensitive; restores need an additional approver` : `${w.name} is no longer sensitive`, on ? 'ok' : 'warn'); onClose(); }}>{on ? 'Mark sensitive' : 'Clear sensitive'}</Btn></>}
    >
      <Field id="sd-w" label="Why"><TextArea id="sd-w" value={why} onChange={setWhy} rows={2} placeholder={on ? 'Holds patient records (DPDP sensitive personal data)' : 'Data moved to his-db-02; this server only holds logs now'} /></Field>
    </Dialog>
  );
}

function TierDialog({ ctx, ws, closing, onClose, onSave }: { ctx: Ctx; ws: Workload[]; closing: boolean; onClose: () => void; onSave: (t: Tier) => void }) {
  const [t, setT] = useState<Tier>(ws[0].tier);
  const one = ws.length === 1 ? ws[0] : null;
  const from = one ? one.tier : null;
  const changed = ws.filter(w => w.tier !== t).length;
  return (
    <Dialog
      size="lg"
      title={one ? `Set criticality of ${one.name}` : `Set criticality of ${plural(ws.length, 'workload')}`}
      sub="Set once. Backup, disaster recovery, drills and alert escalation follow from it."
      closing={closing}
      onClose={onClose}
      footNote={changed ? `${plural(changed, 'workload')} will change` : 'Nothing changes'}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="check" disabled={!changed} why="Choose a different tier." perm={ctx.can('configure', 'Changing criticality')} onClick={() => onSave(t)}>
            Apply {t}
          </Btn>
        </>
      }
    >
      <div role="radiogroup" aria-label="Criticality" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        {TIERS.map(x => (
          <RadioCard key={x} on={x === t} onClick={() => setT(x)} title={x} note={TIER_RULES[x].dr} tag={from === x ? 'Current' : undefined} />
        ))}
      </div>
      <MiniTable
        label="What changes"
        cols={[{ label: 'Drives', w: '140px' }, { label: from ? `Now (${from})` : 'Now' }, { label: `After (${t})` }]}
        rows={(['backup', 'dr', 'drill', 'escalation'] as const).map(k => [
          { backup: 'Backup', dr: 'DR target', drill: 'Drills', escalation: 'Escalation' }[k],
          <span key="a" style={{ color: 'var(--tx-2)' }} data-tip={from ? TIER_RULES[from][k] : 'Varies by workload'} data-tip-overflow="">
            {from ? TIER_RULES[from][k] : 'Varies by workload'}
          </span>,
          <span key="b" data-tip={TIER_RULES[t][k]} data-tip-overflow="">{TIER_RULES[t][k]}</span>
        ])}
      />
      {t === 'Standard' && ws.some(w => w.dr.s !== 'na' && w.dr.s !== 'none') ? (
        <Bar tone="warn" multiline>
          Standard does not require DR. Existing replication keeps running until someone removes it from its protection plan.
        </Bar>
      ) : null}
    </Dialog>
  );
}

/** Workloads, with Discovery as its second view. */
export default function Workloads({ ctx }: { ctx: Ctx }) {
  return ctx.tab === 'discovery' ? <DiscoveryPage ctx={ctx} /> : <WorkloadList ctx={ctx} />;
}
