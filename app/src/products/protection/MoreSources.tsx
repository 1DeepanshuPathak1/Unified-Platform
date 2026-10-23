import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Btn, CheckBox, Field, Seg, SelectInput, TextInput } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Panel, Spacer, Status, TableArea, Tiles, Toolbar } from '../../ui/layout';
import { Dialog, Drawer, StepUp, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope, showCustomerCol } from '../../platform/common';
import { audit } from '../../platform/store';

/* ------------------------------------------------------------------ Kubernetes */

interface Ns { id: string; cluster: string; customer: string; ns: string; apps: string; pvcs: number; gb: number; policy: string; last: string; hooks: string; ok: 'ok' | 'warn' | 'off'; note?: string }
const CLUSTERS = [
  { name: 'mer-k8s-prod', customer: 'mer', dist: 'Red Hat OpenShift 4.14', csi: 'Ceph RBD CSI, snapshots on', op: 'Aegis operator 4.2.0', nodes: 9 },
  { name: 'h360-k8s', customer: 'h360', dist: 'Kubernetes 1.29 (OpenStack Magnum)', csi: 'Cinder CSI, snapshots on', op: 'Aegis operator 4.2.0', nodes: 6 }
];
const NS: Ns[] = [
  { id: 'n1', cluster: 'mer-k8s-prod', customer: 'mer', ns: 'payments', apps: '6 Deployments, 1 StatefulSet', pvcs: 3, gb: 240, policy: 'Meridian Kubernetes hourly', last: '21 Oct, 16:00', hooks: 'PostgreSQL: pg_backup_start / stop', ok: 'ok' },
  { id: 'n2', cluster: 'mer-k8s-prod', customer: 'mer', ns: 'upi', apps: '9 Deployments', pvcs: 1, gb: 20, policy: 'Meridian Kubernetes hourly', last: '21 Oct, 16:00', hooks: '—', ok: 'ok' },
  { id: 'n3', cluster: 'mer-k8s-prod', customer: 'mer', ns: 'ledger', apps: '2 Deployments, 2 StatefulSets', pvcs: 4, gb: 610, policy: 'Meridian Kubernetes hourly', last: '21 Oct, 16:00', hooks: 'Kafka: flush, then snapshot', ok: 'ok' },
  { id: 'n4', cluster: 'mer-k8s-prod', customer: 'mer', ns: 'notify', apps: '3 Deployments', pvcs: 0, gb: 0, policy: 'Meridian Kubernetes hourly', last: '21 Oct, 16:00', hooks: '—', ok: 'ok' },
  { id: 'n5', cluster: 'mer-k8s-prod', customer: 'mer', ns: 'auth', apps: '2 Deployments, 1 StatefulSet', pvcs: 1, gb: 10, policy: 'Meridian Kubernetes hourly', last: '21 Oct, 16:00', hooks: '—', ok: 'ok' },
  { id: 'n6', cluster: 'mer-k8s-prod', customer: 'mer', ns: 'gateway', apps: '4 Deployments', pvcs: 0, gb: 0, policy: 'Meridian Kubernetes hourly', last: '21 Oct, 15:00', hooks: '—', ok: 'warn', note: 'The 16:00 backup skipped 2 Secrets the operator’s service account cannot read (sealed-secrets controller keys).' },
  { id: 'n7', cluster: 'mer-k8s-prod', customer: 'mer', ns: 'analytics-sandbox', apps: '5 Deployments', pvcs: 2, gb: 300, policy: 'No policy', last: 'Never', hooks: '—', ok: 'off', note: 'Excluded by the label aegis.host360.ai/backup=false.' },
  { id: 'n8', cluster: 'h360-k8s', customer: 'h360', ns: 'gitlab-runners', apps: '1 Deployment', pvcs: 0, gb: 0, policy: 'Host360 Kubernetes daily', last: '21 Oct, 01:00', hooks: '—', ok: 'ok' },
  { id: 'n9', cluster: 'h360-k8s', customer: 'h360', ns: 'monitoring', apps: '3 Deployments, 2 StatefulSets', pvcs: 3, gb: 180, policy: 'Host360 Kubernetes daily', last: '21 Oct, 01:00', hooks: 'Prometheus: TSDB snapshot', ok: 'ok' }
];

export function KubernetesView({ ctx }: { ctx: Ctx }) {
  const all = NS.filter(n => inScope(ctx, n.customer));
  const [cl, setCl] = useState('All');
  const drawer = useClosable<string>();
  const restore = useClosable<string>();
  const rows = all.filter(n => cl === 'All' || n.cluster === cl);
  const d = drawer.value ? all.find(n => n.id === drawer.value) : null;
  const clusters = CLUSTERS.filter(c => inScope(ctx, c.customer));
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Clusters', value: String(clusters.length), icon: 'container', sub: clusters.map(c => c.dist.split(' ')[0] === 'Red' ? 'OpenShift' : 'Kubernetes').join(', ') || 'None connected' },
            { label: 'Namespaces protected', value: String(all.filter(n => n.ok !== 'off').length), unit: `of ${all.length}`, icon: 'circle-check', tone: 'ok', sub: 'Resources, then persistent volumes through CSI snapshots' },
            { label: 'Persistent volumes', value: `${(all.reduce((a, n) => a + (n.ok !== 'off' ? n.gb : 0), 0) / 1024).toFixed(2)} TB`, icon: 'hard-drive', sub: `${all.reduce((a, n) => a + n.pvcs, 0)} claims` },
            { label: 'Warnings', value: String(all.filter(n => n.ok === 'warn').length), icon: 'triangle-alert', tone: all.some(n => n.ok === 'warn') ? 'warn' : 'ok', sub: 'Resources the operator could not read' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Cluster" value={cl} onChange={setCl} options={[{ v: 'All', label: 'All clusters', count: all.length }, ...clusters.map(c => ({ v: c.name, label: c.name, count: all.filter(n => n.cluster === c.name).length }))]} />
        <Spacer />
        <Btn kind="outline" icon="plus" perm={ctx.can('configure', 'Connecting a cluster')} onClick={() => ctx.go('agents')}>Connect a cluster…</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Kubernetes namespaces"
          cols={[
            { k: 'ns', label: 'Namespace', w: 'minmax(140px,1fr)' },
            { k: 'cl', label: 'Cluster', w: '140px', dim: true },
            { k: 'apps', label: 'Workloads', w: 'minmax(180px,1.3fr)', dim: true },
            { k: 'pv', label: 'Volumes', w: '110px', r: true },
            { k: 'p', label: 'Policy', w: 'minmax(170px,1.2fr)', dim: true },
            { k: 'l', label: 'Last backup', w: '120px' },
            { k: 's', label: 'Status', w: '140px' }
          ]}
          rows={rows.map(n => ({
            id: n.id,
            ns: { v: n.ns, strong: true },
            cl: n.cluster,
            apps: n.apps,
            pv: n.pvcs ? { v: `${n.pvcs} · ${n.gb} GB`, s: n.gb } : { v: 'None', muted: true, s: 0 },
            p: n.policy,
            l: n.last,
            s: n.ok === 'ok' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Protected' } : n.ok === 'warn' ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Partly backed up', tip: n.note } : { t: 'status', i: 'circle-minus', c: 'tx', l: 'Excluded', tip: n.note }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['namespace', 'namespaces']}
          filtered={cl !== 'All'}
          onClear={() => setCl('All')}
          emptyText="No Kubernetes cluster is connected. Install the Aegis operator with Helm from Agents."
          footR="Cluster-scoped resources (CRDs, storage classes, cluster roles) are kept with every backup"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Namespace"
          kicker={`Kubernetes · ${d.cluster} · ${custName(d.customer)}`}
          title={d.ns}
          status={<><span>{d.apps}</span><span>{d.pvcs} volumes</span></>}
          actions={
            <>
              <Btn kind="outline" icon="play" perm={ctx.can('operate', 'Starting a backup')} disabled={d.ok === 'off'} why="Excluded by a label." onClick={() => { ctx.startJob({ name: 'Backup', object: `${d.cluster}/${d.ns}`, product: 'Backup', phases: ['Queued', 'Run hooks', 'Export resources', 'Snapshot volumes', 'Copy', 'Done'], speed: 16, rate: '150 MB/s' }); ctx.toast(`Backup of ${d.ns} started`, 'info'); }}>Back up now</Btn>
              <Btn kind="outline" icon="rotate-ccw" perm={ctx.can('restore', 'Restoring')} disabled={d.ok === 'off'} why="No recovery points." onClick={() => restore.open(d.id)}>Restore…</Btn>
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.note ? <Bar tone={d.ok === 'warn' ? 'warn' : 'info'} multiline>{d.note}</Bar> : null}
            <DrawerTiles items={[{ label: 'Last backup', value: d.last }, { label: 'Recovery points', value: d.ok === 'off' ? '0' : d.policy.includes('hourly') ? '168' : '30' }, { label: 'Volumes', value: `${d.gb} GB`, sub: `${d.pvcs} claims` }]} />
            <Facts items={[{ k: 'Resources', v: 'Deployments, StatefulSets, Services, Ingresses, ConfigMaps, Secrets (encrypted with the tenant key), RBAC, custom resources' }, { k: 'Volumes', v: CLUSTERS.find(c => c.name === d.cluster)?.csi || '—' }, { k: 'Hooks', v: d.hooks }, { k: 'Operator', v: CLUSTERS.find(c => c.name === d.cluster)?.op || '—' }]} />
          </div>
        </Drawer>
      ) : null}
      {restore.value ? <NsRestoreDialog ctx={ctx} n={all.find(n => n.id === restore.value)!} clusters={clusters.map(c => c.name)} closing={restore.closing} onClose={restore.close} /> : null}
    </>
  );
}

function NsRestoreDialog({ ctx, n, clusters, closing, onClose }: { ctx: Ctx; n: Ns; clusters: string[]; closing: boolean; onClose: () => void }) {
  const [to, setTo] = useState(n.cluster);
  const [name, setName] = useState(`${n.ns}-restored`);
  const [sc, setSc] = useState('Keep the storage class');
  const [pv, setPv] = useState(true);
  const [scale, setScale] = useState(true);
  const clash = to === n.cluster && name === n.ns;
  return (
    <Dialog
      title={`Restore ${n.ns}`}
      sub="Restore the namespace’s resources and volumes, to the same cluster or another one."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="rotate-ccw" disabled={!name.trim()} why="Name the target namespace." onClick={() => { ctx.startJob({ name: 'Restore namespace', object: `${to}/${name}`, product: 'Backup', type: 'Restore', phases: ['Queued', 'Create namespace', 'Restore volumes', 'Apply resources', 'Scale up', 'Done'], speed: 14, rate: '200 MB/s' }); audit({ who: 'priya.raman', customer: n.customer, what: 'Restored a Kubernetes namespace', object: `${n.cluster}/${n.ns} → ${to}/${name}`, when: ctx.now(), r: 'ok' }); ctx.toast(`Restore of ${n.ns} into ${to}/${name} started`, 'info'); onClose(); }}>
            Restore
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="kr-c" label="Target cluster"><SelectInput id="kr-c" value={to} onChange={setTo} options={clusters} /></Field>
        <Field id="kr-n" label="Target namespace"><TextInput id="kr-n" value={name} onChange={setName} mono /></Field>
        <Field id="kr-s" label="Storage class" span={2}><SelectInput id="kr-s" value={sc} onChange={setSc} options={['Keep the storage class', 'ceph-rbd → ceph-ssd', 'ceph-rbd → cinder-standard (other cluster)']} /></Field>
      </div>
      <CheckBox on={pv} onChange={setPv}>Restore persistent volumes (otherwise resources only)</CheckBox>
      <CheckBox on={scale} onChange={setScale}>Start workloads at 0 replicas, then scale up once the volumes are bound</CheckBox>
      {clash ? <Bar tone="warn" multiline>The namespace {n.ns} exists on {to}. Existing resources with the same name are replaced; anything else in it is left alone.</Bar> : null}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Microsoft 365 and Google Workspace */

type Svc = 'Mail' | 'OneDrive and Drive' | 'SharePoint' | 'Teams' | 'Directory';
const TENANTS = [
  { name: 'meridianbank.onmicrosoft.com', customer: 'mer', kind: 'Microsoft 365', users: 1240, last: '21 Oct, 15:00', every: 'Every 4 h', counts: { Mail: '1,240 mailboxes · 6.1 TB', 'OneDrive and Drive': '1,180 OneDrives · 9.4 TB', SharePoint: '96 sites · 2.2 TB', Teams: '210 teams · chats and channel files', Directory: '1,240 users · 312 groups · 18 conditional access policies · 46 app registrations' } },
  { name: 'kaveri-logistics.in', customer: 'kav', kind: 'Google Workspace', users: 85, last: '21 Oct, 14:00', every: 'Every 6 h', counts: { Mail: '85 Gmail mailboxes · 310 GB', 'OneDrive and Drive': '85 My Drives, 12 shared drives · 640 GB', SharePoint: '—', Teams: 'Google Chat spaces · 22', Directory: '85 users · 14 groups' } }
];
const MAIL = [
  { from: 'treasury-ops@meridianbank.in', to: 'anitha.k@meridianbank.in', subject: 'RBI CRR return, 18 Oct (final)', when: '18 Oct, 17:42', size: '2.1 MB', folder: 'Inbox' },
  { from: 'treasury-ops@meridianbank.in', to: 'anitha.k@meridianbank.in', subject: 'RBI CRR return, 18 Oct (draft 2)', when: '18 Oct, 15:10', size: '1.9 MB', folder: 'Deleted Items (purged 20 Oct)' },
  { from: 'treasury-ops@meridianbank.in', to: 'rohit.s@meridianbank.in', subject: 'RBI CRR return, 11 Oct (final)', when: '11 Oct, 18:05', size: '2.0 MB', folder: 'Archive/RBI' }
];
const DIR_CHANGES = [
  ['Conditional access', 'Block legacy authentication', 'Deleted', '20 Oct, 18:40 · it-admin@meridianbank.in'],
  ['Group', 'Treasury-Dealers', '3 members removed', '20 Oct, 18:52 · it-admin@meridianbank.in'],
  ['App registration', 'aegis-backup-reader', 'Secret added', '21 Oct, 09:10 · priya.raman (expected)']
];
const FOREST = [
  ['Isolate', 'Disconnect every domain controller from the network; keep them powered off for forensics'],
  ['Pick a clean point', 'One domain controller per domain, from the cleanest backup (Threats scores)'],
  ['Restore the first DC', 'Into the clean room, non-authoritative; mark SYSVOL authoritative'],
  ['Seize FSMO roles', 'Schema, domain naming, RID, PDC and infrastructure masters on the restored DC'],
  ['Raise the RID pool', 'By 100,000 so new objects do not reuse IDs issued after the backup'],
  ['Reset krbtgt twice', 'Ten hours apart, and the DSRM and built-in Administrator passwords'],
  ['Clean up metadata', 'Remove every other DC from the domain; they are rebuilt, not restored'],
  ['Rebuild and reconnect', 'Promote new DCs, check replication, then reconnect sites one at a time']
];

export function SaasView({ ctx }: { ctx: Ctx }) {
  const tenants = TENANTS.filter(t => inScope(ctx, t.customer));
  const [svc, setSvc] = useState<Svc>('Mail');
  const find = useClosable<boolean>();
  const forest = useClosable<boolean>();
  const objRestore = useClosable<string>();
  if (!tenants.length) return <div style={{ padding: '0 24px' }}><Bar tone="info">No Microsoft 365 or Google Workspace tenant is connected for this customer.</Bar></div>;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tiles
        items={[
          { label: 'Tenants', value: String(tenants.length), icon: 'cloud', sub: tenants.map(t => t.kind).join(', ') },
          { label: 'Users protected', value: tenants.reduce((a, t) => a + t.users, 0).toLocaleString('en-IN'), icon: 'users', sub: 'Billed per user a month' },
          { label: 'Last backup', value: tenants[0].last, icon: 'circle-check', tone: 'ok', sub: tenants[0].every },
          { label: 'Directory changes, 24 h', value: String(DIR_CHANGES.length), icon: 'fingerprint', tone: 'warn', sub: '1 conditional access policy deleted' }
        ]}
      />
      <Toolbar style={{ padding: 0 }}>
        <Seg label="Service" value={svc} onChange={setSvc} options={(['Mail', 'OneDrive and Drive', 'SharePoint', 'Teams', 'Directory'] as Svc[]).map(v => ({ v, label: v }))} />
        <Spacer />
        {svc === 'Directory' ? <Btn kind="outline" icon="list-ordered" perm={ctx.can('restore', 'Planning forest recovery')} onClick={() => forest.open(true)}>Active Directory forest recovery…</Btn> : <Btn kind="primary" icon="search" perm={ctx.can('restore', 'Restoring items')} onClick={() => find.open(true)}>Find and restore items…</Btn>}
      </Toolbar>
      <Panel title="Tenants">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="SaaS tenants"
            cols={[{ label: 'Tenant', w: 'minmax(0,1fr)' }, { label: 'Kind', w: '150px' }, { label: svc, w: 'minmax(0,1.4fr)' }, { label: 'Last backup', w: '130px' }]}
            rows={tenants.map(t => [<strong key="n" style={{ fontWeight: 600 }} data-tip={custName(t.customer)}>{t.name}</strong>, t.kind, <span key="c" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={t.counts[svc]} data-tip-overflow="">{t.counts[svc]}</span>, <Status key="l" icon="circle-check" tone="ok" label={t.last} />])}
          />
        </div>
      </Panel>
      {svc === 'Directory' ? (
        <Panel title="Changed since the last backup" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Compared with the backup of 21 Oct, 15:00</span>}>
          <div style={{ padding: '4px 16px 12px' }}>
            <MiniTable
              label="Directory changes"
              cols={[{ label: 'Object type', w: '150px' }, { label: 'Object', w: 'minmax(0,1fr)' }, { label: 'Change', w: '150px' }, { label: 'When and who', w: 'minmax(0,1fr)' }, { label: '', w: '110px' }]}
              rows={DIR_CHANGES.map(([k, o, c, w]) => [k, <strong key="o" style={{ fontWeight: 600 }}>{o}</strong>, c, w, w.includes('expected') ? <span key="r" style={{ color: 'var(--tx-3)' }}>Expected</span> : <Btn key="r" kind="ghost" size="sm" icon="rotate-ccw" perm={ctx.can('restore', 'Restoring directory objects')} onClick={() => objRestore.open(o)}>Restore</Btn>])}
            />
            <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Entra ID objects are restored one by one with their settings and links; deleted users come back from the recycle bin when they are still there, otherwise they are recreated and their group memberships reapplied.</p>
          </div>
        </Panel>
      ) : null}
      {find.value ? <FindItemsDialog ctx={ctx} svc={svc} closing={find.closing} onClose={find.close} /> : null}
      {objRestore.value ? (
        <Dialog title={`Restore ${objRestore.value}`} sub="Put back the object as it was in the backup of 21 Oct, 15:00." closing={objRestore.closing} onClose={objRestore.close} footer={<><Btn kind="ghost" onClick={objRestore.close}>Cancel</Btn><Btn kind="primary" icon="rotate-ccw" onClick={() => { audit({ who: 'priya.raman', customer: 'mer', what: 'Restored an Entra ID object', object: objRestore.value!, when: ctx.now(), r: 'ok' }); ctx.toast(`${objRestore.value} restored in meridianbank.onmicrosoft.com`, 'ok'); objRestore.close(); }}>Restore</Btn></>}>
          <Facts items={[{ k: 'Tenant', v: 'meridianbank.onmicrosoft.com' }, { k: 'From', v: 'Backup of 21 Oct, 15:00' }, { k: 'Then', v: 'Policy assignments and group links are checked; anything that no longer exists is listed, not created' }]} />
        </Dialog>
      ) : null}
      {forest.value ? <ForestDialog ctx={ctx} closing={forest.closing} onClose={forest.close} /> : null}
    </div>
  );
}

function FindItemsDialog({ ctx, svc, closing, onClose }: { ctx: Ctx; svc: Svc; closing: boolean; onClose: () => void }) {
  const [who, setWho] = useState('anitha.k@meridianbank.in');
  const [q, setQ] = useState('RBI CRR');
  const [picked, setPicked] = useState<string[]>([]);
  const [to, setTo] = useState('The original mailbox, into a folder “Restored 21 Oct”');
  const hits = MAIL.filter(m => (!q.trim() || m.subject.toLowerCase().includes(q.trim().toLowerCase())) && (!who.trim() || m.to === who.trim() || who.trim() === '*'));
  return (
    <Dialog
      title={svc === 'Mail' ? 'Find and restore mail' : `Find and restore: ${svc}`}
      sub="Search every backup of the tenant; items deleted and purged are still found."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="outline" icon="download" disabled={!picked.length} why="Select items first." onClick={() => { ctx.toast(`${picked.length} items exported to PST; the download link is valid for 24 h`, 'ok'); onClose(); }}>Export to PST</Btn>
          <Btn kind="primary" icon="rotate-ccw" disabled={!picked.length} why="Select items first." onClick={() => { audit({ who: 'priya.raman', customer: 'mer', what: 'Restored mail items', object: `${picked.length} items for ${who}`, when: ctx.now(), r: 'ok', note: to }); ctx.toast(`${picked.length} items restored`, 'ok'); onClose(); }}>Restore {picked.length || ''}</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="fi-w" label="Mailbox"><TextInput id="fi-w" value={who} onChange={setWho} /></Field>
        <Field id="fi-q" label="Subject or sender contains"><TextInput id="fi-q" value={q} onChange={setQ} /></Field>
      </div>
      <MiniTable
        label="Found items"
        cols={[{ label: '', w: '28px' }, { label: 'Subject', w: 'minmax(0,1.4fr)' }, { label: 'From', w: 'minmax(0,1fr)' }, { label: 'Received', w: '110px' }, { label: 'Folder', w: 'minmax(0,1fr)' }]}
        rows={hits.map(m => [
          <CheckBox key="c" label={`Select ${m.subject}`} on={picked.includes(m.subject)} onChange={v => setPicked(p => (v ? [...p, m.subject] : p.filter(x => x !== m.subject)))} />,
          <strong key="s" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.subject}</strong>,
          m.from,
          m.when,
          <span key="f" style={{ color: m.folder.includes('purged') ? 'var(--warn)' : undefined }}>{m.folder}</span>
        ])}
        empty="Nothing matches."
      />
      <Field id="fi-t" label="Restore to"><SelectInput id="fi-t" value={to} onChange={setTo} options={['The original mailbox, into a folder “Restored 21 Oct”', 'The original folders', 'Another mailbox']} /></Field>
    </Dialog>
  );
}

function ForestDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <Dialog
      title="Active Directory forest recovery"
      sub="MERIDIAN.LOCAL, 2 domains, 6 domain controllers. The guided runbook follows Microsoft’s forest recovery steps and records each one."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Close</Btn><Btn kind="primary" icon="play" disabled={!ok} why="Confirm with your second factor first." onClick={() => { audit({ who: 'priya.raman', customer: 'mer', what: 'Started an Active Directory forest recovery in the clean room', object: 'MERIDIAN.LOCAL', when: ctx.now(), r: 'ok' }); ctx.toast('Forest recovery started in cleanroom-02; each step waits for a confirmation', 'info'); onClose(); }}>Start in the clean room</Btn></>}
    >
      <Bar tone="warn" multiline>Use this only when the whole forest is lost or untrusted. For a single deleted object, restore it from the directory backup instead.</Bar>
      <MiniTable label="Forest recovery steps" cols={[{ label: '#', w: '28px' }, { label: 'Step', w: '170px' }, { label: 'What happens' }]} rows={FOREST.map(([k, v], i) => [String(i + 1), <strong key="k" style={{ fontWeight: 600 }}>{k}</strong>, v])} />
      <Facts labelW={150} items={[{ k: 'Clean points', v: 'MER-DC-01: 21 Oct, 02:00 (score 98) · MER-BR-DC-01: 21 Oct, 02:00 (score 97)' }, { k: 'Rehearsed', v: '12 Aug 2026 in cleanroom-02: 3 h 10 min' }]} />
      <StepUp verified={ok} onVerified={() => setOk(true)} />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ File shares (NAS) */

const SHARES = [
  { id: 'f1', name: '/vol/finance', nas: 'fin-nas-01 (NetApp ONTAP 9.14)', customer: 'mer', proto: 'NDMP with SnapDiff', files: '4.1 million', tb: 3.2, last: '21 Oct, 01:40', ok: 'ok' as const },
  { id: 'f2', name: '/vol/branch_scans', nas: 'fin-nas-01 (NetApp ONTAP 9.14)', customer: 'mer', proto: 'NDMP with SnapDiff', files: '18.7 million', tb: 11.4, last: '21 Oct, 03:55', ok: 'ok' as const },
  { id: 'f3', name: '\\\\h360-isilon\\projects', nas: 'h360-isilon (PowerScale OneFS 9.7)', customer: 'h360', proto: 'SMB with change-file tracking', files: '2.3 million', tb: 1.9, last: '21 Oct, 02:10', ok: 'ok' as const },
  { id: 'f4', name: 'nfs01:/exports/home', nas: 'nfs01 (Linux NFS v4.1)', customer: 'h360', proto: 'NFS, full scan each night', files: '960,000', tb: 0.4, last: '21 Oct, 02:40', ok: 'warn' as const }
];

export function SharesView({ ctx }: { ctx: Ctx }) {
  const all = SHARES.filter(s => inScope(ctx, s.customer));
  const custCol = showCustomerCol(ctx);
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Shares', value: String(all.length), icon: 'folder', sub: `${new Set(all.map(s => s.nas)).size} file servers` },
            { label: 'Protected', value: `${all.reduce((a, s) => a + s.tb, 0).toFixed(1)} TB`, icon: 'hard-drive', sub: 'Front-end size' },
            { label: 'Full scans', value: String(all.filter(s => s.ok === 'warn').length), icon: 'triangle-alert', tone: all.some(s => s.ok === 'warn') ? 'warn' : 'ok', sub: 'Shares without change tracking read every file each night' }
          ]}
        />
      </div>
      <TableArea>
        <AegisTable
          label="File shares"
          cols={[
            { k: 'n', label: 'Share', w: 'minmax(170px,1.2fr)' },
            ...(custCol ? [{ k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true }] : []),
            { k: 'nas', label: 'File server', w: 'minmax(180px,1.2fr)', dim: true },
            { k: 'p', label: 'How changes are found', w: 'minmax(170px,1fr)' },
            { k: 'f', label: 'Files', w: '110px', r: true },
            { k: 'z', label: 'Size', w: '80px', r: true },
            { k: 's', label: 'Last backup', w: '170px' }
          ]}
          rows={all.map(s => ({
            id: s.id,
            n: { v: s.name, strong: true },
            c: custName(s.customer),
            nas: s.nas,
            p: s.proto,
            f: s.files,
            z: { v: `${s.tb} TB`, s: s.tb },
            s: s.ok === 'ok' ? { t: 'status', i: 'circle-check', c: 'ok', l: s.last } : { t: 'status', i: 'triangle-alert', c: 'warn', l: `${s.last} · full scan`, tip: 'Took 2 h 40 min; turn on fanotify-based tracking on nfs01 to read only changes' }
          }))}
          onRow={(id: string) => ctx.toast(`Browse ${all.find(s => s.id === id)?.name} from Restore › Files; ACLs and alternate data streams come back with the files`, 'info')}
          state={ctx.ui}
          unit={['share', 'shares']}
          emptyText="No file shares are protected. Add a NAS from Sites."
          footR="Permissions (NTFS ACLs, NFSv4 ACLs) are kept with every file"
        />
      </TableArea>
    </>
  );
}
