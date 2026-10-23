import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Btn, Field, Seg, SelectInput, TextInput, Toggle } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Panel, Spacer, TableArea, Tiles, Toolbar } from '../../ui/layout';
import { Dialog, Drawer, StepUp, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { audit } from '../../platform/store';

interface Ct { id: string; vmid: number; name: string; node: string; site: string; storage: string; mode: string; policy: string; last: string; ok: 'ok' | 'warn' | 'off'; note?: string }
const CTS: Ct[] = [
  { id: 'ct101', vmid: 101, name: 'dns-01', node: 'pve-chn-01', site: 'Chennai-proxmox-prod', storage: 'local-zfs', mode: 'ZFS snapshot, zfs send -i', policy: 'Production daily', last: '21 Oct, 01:12', ok: 'ok' },
  { id: 'ct102', vmid: 102, name: 'dns-02', node: 'pve-chn-02', site: 'Chennai-proxmox-prod', storage: 'local-zfs', mode: 'ZFS snapshot, zfs send -i', policy: 'Production daily', last: '21 Oct, 01:13', ok: 'ok' },
  { id: 'ct110', vmid: 110, name: 'nginx-edge', node: 'pve-chn-01', site: 'Chennai-proxmox-prod', storage: 'ceph-rbd', mode: 'RBD snapshot, export-diff', policy: 'Production daily', last: '21 Oct, 01:20', ok: 'ok' },
  { id: 'ct111', vmid: 111, name: 'redis-cache', node: 'pve-chn-03', site: 'Chennai-proxmox-prod', storage: 'ceph-rbd', mode: 'RBD snapshot, export-diff', policy: 'Production daily', last: '21 Oct, 01:21', ok: 'ok' },
  { id: 'ct120', vmid: 120, name: 'postfix-relay', node: 'pve-chn-02', site: 'Chennai-proxmox-prod', storage: 'local-lvm', mode: 'Suspend, then copy (LVM-thin has no send)', policy: 'Production daily', last: '21 Oct, 01:35', ok: 'warn', note: 'Suspended for 41 s during the copy. Move it to ZFS or Ceph for a snapshot without a pause.' },
  { id: 'ct130', vmid: 130, name: 'grafana', node: 'pve-chn-03', site: 'Chennai-proxmox-prod', storage: 'ceph-rbd', mode: 'RBD snapshot, export-diff', policy: 'Production daily', last: '21 Oct, 01:24', ok: 'ok' },
  { id: 'ct201', vmid: 201, name: 'lab-pihole', node: 'pve-lab-01', site: 'Chennai_Lab_Proxmox', storage: 'local-zfs', mode: 'ZFS snapshot, zfs send -i', policy: 'Lab weekly', last: '19 Oct, 06:02', ok: 'ok' },
  { id: 'ct202', vmid: 202, name: 'lab-runner', node: 'pve-lab-01', site: 'Chennai_Lab_Proxmox', storage: 'local-zfs', mode: 'ZFS snapshot, zfs send -i', policy: 'Lab weekly', last: '19 Oct, 06:03', ok: 'ok' },
  { id: 'ct203', vmid: 203, name: 'lab-scratch', node: 'pve-lab-01', site: 'Chennai_Lab_Proxmox', storage: 'local-zfs', mode: '—', policy: 'No policy', last: 'Never', ok: 'off', note: 'Excluded by the tag “no-backup”.' }
];
const CONFIGS = [
  {
    site: 'Chennai-proxmox-prod', kind: 'Proxmox VE 8.2 cluster, 3 nodes', last: '21 Oct, 01:00', versions: 30,
    parts: ['VM and container configuration (/etc/pve/qemu-server, lxc)', 'storage.cfg, datacenter.cfg', 'Users, groups, roles, API tokens (secrets excluded)', 'Firewall: cluster, node and guest rules', 'SDN zones, VNets and subnets', 'HA groups and resources', 'corosync.conf and cluster membership', 'Backup jobs and replication jobs'],
    drift: [['storage.cfg', 'Added ceph-ssd (RBD, pool ssd)', '20 Oct, 18:42 · root@pam'], ['firewall/cluster.fw', 'Rule 14 opened 8006/tcp to 10.20.0.0/16', '19 Oct, 11:05 · rohan@pve'], ['qemu-server/104.conf', 'Memory 8192 → 16384 MB on erp-db-01', '18 Oct, 22:10 · root@pam']]
  },
  {
    site: 'Chennai_Lab_Proxmox', kind: 'Proxmox VE 8.2, single node', last: '21 Oct, 01:00', versions: 30,
    parts: ['VM and container configuration', 'storage.cfg, datacenter.cfg', 'Users and API tokens (secrets excluded)', 'Firewall rules', 'Network interfaces (/etc/network/interfaces)'],
    drift: []
  },
  {
    site: 'production-openstack', kind: 'OpenStack 2024.1 (Caracal), Kolla-Ansible', last: '21 Oct, 00:30', versions: 30,
    parts: ['Keystone: projects, users, roles, quotas', 'Nova: flavors, aggregates, server groups', 'Neutron: networks, subnets, routers, security groups, floating IP allocations', 'Cinder: volume types and QoS', 'Glance: image metadata (images in the image backup)', 'Heat: stack templates and parameters', 'Kolla globals.yml and service configuration'],
    drift: [['Neutron', 'Security group web-sg: rule for 443/tcp from 0.0.0.0/0 added', '20 Oct, 15:30 · admin']]
  }
];
const PROJECTS = [
  { name: 'billing', instances: 4, protectedN: 4, volumes: 7, stacks: 2, nets: 3, sgs: 6, horizon: true },
  { name: 'ci', instances: 6, protectedN: 4, volumes: 6, stacks: 1, nets: 2, sgs: 4, horizon: true },
  { name: 'k8s-platform', instances: 9, protectedN: 6, volumes: 12, stacks: 3, nets: 4, sgs: 8, horizon: false },
  { name: 'analytics', instances: 3, protectedN: 0, volumes: 5, stacks: 0, nets: 1, sgs: 2, horizon: false }
];
const STACKS = [
  ['billing-api', 'billing', '4 instances, 7 volumes, 1 load balancer', 'Template and parameters kept with each backup; restore recreates the stack, then restores the volumes into it'],
  ['billing-db', 'billing', '1 instance, 2 volumes', 'Stack recreated from its template, then the volumes restored into it'],
  ['jenkins', 'ci', '2 instances, 3 volumes', 'Stack recreated from its template, then the volumes restored into it'],
  ['k8s-control', 'k8s-platform', '3 instances, 3 volumes, 2 server groups', 'Anti-affinity server group recreated first, then the stack and its volumes'],
  ['k8s-workers-a', 'k8s-platform', '3 instances', 'Workers are stateless; only the template is kept'],
  ['k8s-workers-b', 'k8s-platform', '3 instances', 'Workers are stateless; only the template is kept']
];

/** Protection › Protected guests › Containers and platform: LXC, cluster configuration, OpenStack projects. */
export function PlatformObjectsView({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<'lxc' | 'config' | 'openstack'>(['config', 'openstack'].includes(ctx.openId || '') ? (ctx.openId as 'config' | 'openstack') : 'lxc');
  const drawer = useClosable<string>();
  const pbs = useClosable<boolean>();
  const diff = useClosable<string>();
  const restore = useClosable<string>();
  const [horizon, setHorizon] = useState<Record<string, boolean>>(Object.fromEntries(PROJECTS.map(p => [p.name, p.horizon])));
  const ct = drawer.value ? CTS.find(c => c.id === drawer.value) : null;
  const op = ctx.can('operate', 'Starting a backup');
  const cfgDrift = CONFIGS.reduce((a, c) => a + c.drift.length, 0);
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'LXC containers', value: String(CTS.filter(c => c.ok !== 'off').length), unit: `of ${CTS.length} protected`, icon: 'box', tone: 'ok', sub: 'ZFS send or Ceph export-diff' },
            { label: 'Cluster configuration', value: String(CONFIGS.length), unit: `of ${CONFIGS.length} backed up`, icon: 'settings-2', tone: 'ok', sub: `${cfgDrift} changes since yesterday` },
            { label: 'OpenStack projects', value: String(PROJECTS.length), icon: 'layers', sub: `${STACKS.length} Heat stacks · ${PROJECTS.reduce((a, p) => a + p.nets, 0)} networks kept with backups` },
            { label: 'Self-service in Horizon', value: String(Object.values(horizon).filter(Boolean).length), unit: `of ${PROJECTS.length} projects`, icon: 'users', sub: 'Project members back up and restore their own instances' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={view} onChange={setView} options={[{ v: 'lxc', label: 'LXC containers', count: CTS.length }, { v: 'config', label: 'Cluster configuration', count: CONFIGS.length }, { v: 'openstack', label: 'OpenStack projects', count: PROJECTS.length }]} />
        <Spacer />
        <Btn kind="outline" icon="download" perm={ctx.can('admin', 'Importing backups')} onClick={() => pbs.open(true)}>Import from Proxmox Backup Server…</Btn>
      </Toolbar>
      {view === 'lxc' ? (
        <TableArea>
          <AegisTable
            label="LXC containers"
            cols={[
              { k: 'n', label: 'Container', w: 'minmax(150px,1fr)' },
              { k: 'vm', label: 'CT ID', w: '70px', r: true, dim: true },
              { k: 'node', label: 'Node', w: '120px', dim: true },
              { k: 'st', label: 'Storage', w: '100px', dim: true },
              { k: 'mode', label: 'How it is captured', w: 'minmax(200px,1.4fr)' },
              { k: 'p', label: 'Policy', w: '150px', dim: true },
              { k: 'l', label: 'Last backup', w: '120px' },
              { k: 's', label: 'Status', w: '140px' }
            ]}
            rows={CTS.map(c => ({
              id: c.id,
              n: { v: c.name, strong: true, tip: c.site },
              vm: { v: String(c.vmid), s: c.vmid },
              node: c.node,
              st: c.storage,
              mode: { v: c.mode, tip: c.note || c.mode },
              p: c.policy,
              l: c.last,
              s: c.ok === 'ok' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Protected' } : c.ok === 'warn' ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Paused 41 s', tip: c.note } : { t: 'status', i: 'circle-minus', c: 'tx', l: 'Excluded', tip: c.note }
            }))}
            onRow={(id: string) => drawer.open(id)}
            active={drawer.value}
            state={ctx.ui}
            unit={['container', 'containers']}
            emptyText="No LXC containers on the connected Proxmox VE sites."
            footR="Containers are found on every Proxmox VE site and follow the same policies as VMs"
          />
        </TableArea>
      ) : null}
      {view === 'config' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Bar tone="info" multiline>The platform’s own configuration is backed up with its guests, so a rebuilt cluster gets its storage, network, firewall and permissions back before the first VM is restored. Secrets are left out; they come from the vault.</Bar>
          {CONFIGS.map(c => (
            <Panel
              key={c.site}
              title={c.site}
              right={
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn kind="ghost" size="sm" icon="git-branch" disabled={!c.drift.length} why="No changes since the last backup." onClick={() => diff.open(c.site)}>Changes ({c.drift.length})</Btn>
                  <Btn kind="outline" size="sm" icon="rotate-ccw" perm={ctx.can('admin', 'Restoring platform configuration')} onClick={() => restore.open(c.site)}>Restore configuration…</Btn>
                </div>
              }
            >
              <div style={{ padding: '4px 16px 12px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 16 }}>
                <Facts labelW={110} items={[{ k: 'Platform', v: c.kind }, { k: 'Last backup', v: `${c.last} · daily`, icon: 'circle-check', tone: 'ok' }, { k: 'Versions kept', v: `${c.versions}, immutable on obj-check` }]} />
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, font: '13px/18px var(--f-ui)', color: 'var(--tx-2)', listStyle: 'none' }}>
                  {c.parts.map(p => <li key={p}>· {p}</li>)}
                </ul>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}
      {view === 'openstack' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Projects on production-openstack" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Changed blocks read from Ceph with RBD export-diff</span>}>
            <div style={{ padding: '4px 16px 12px' }}>
              <MiniTable
                label="OpenStack projects"
                cols={[{ label: 'Project', w: 'minmax(0,1fr)' }, { label: 'Instances protected', w: '150px' }, { label: 'Volumes', w: '80px', r: true }, { label: 'Heat stacks', w: '100px', r: true }, { label: 'Networks · security groups', w: '190px' }, { label: 'Self-service in Horizon', w: '190px' }]}
                rows={PROJECTS.map(p => [
                  <strong key="n" style={{ fontWeight: 600 }}>{p.name}</strong>,
                  `${p.protectedN} of ${p.instances}`,
                  String(p.volumes),
                  String(p.stacks),
                  `${p.nets} · ${p.sgs}`,
                  <Toggle
                    key="h"
                    on={horizon[p.name]}
                    perm={ctx.can('admin', 'Changing self-service')}
                    label={`Self-service for ${p.name}`}
                    onChange={v => {
                      setHorizon(h => ({ ...h, [p.name]: v }));
                      audit({ who: 'priya.raman', customer: 'h360', what: `${v ? 'Turned on' : 'Turned off'} Horizon self-service`, object: `production-openstack / ${p.name}`, when: ctx.now(), r: 'ok' });
                      ctx.toast(`Horizon self-service ${v ? 'on' : 'off'} for ${p.name}`, 'ok');
                    }}
                  >
                    {horizon[p.name] ? 'On' : 'Off'}
                  </Toggle>
                ])}
              />
              <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>The Aegis panel for Horizon (4.2, installed 02 Sep) shows “Backups” under each instance. Members with the member role restore into their own project only; restores to other projects need an exception in Security › Tenant isolation.</p>
            </div>
          </Panel>
          <Panel title="Heat stacks">
            <div style={{ padding: '4px 16px 12px' }}>
              <MiniTable
                label="Heat stacks"
                cols={[{ label: 'Stack', w: '150px' }, { label: 'Project', w: '120px' }, { label: 'Resources', w: 'minmax(0,1fr)' }, { label: 'How it comes back', w: 'minmax(0,1.4fr)' }]}
                rows={STACKS.map(([n, p, r, how]) => [<strong key="n" style={{ fontWeight: 600 }}>{n}</strong>, p, r, <span key="h" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={how} data-tip-overflow="">{how}</span>])}
              />
            </div>
          </Panel>
          <Panel title="Network topology kept with every backup">
            <div style={{ padding: '4px 16px 12px' }}>
              <Facts labelW={150} items={[{ k: 'Networks and subnets', v: '10 networks, 14 subnets (CIDR, gateway, DHCP pools, DNS)' }, { k: 'Routers', v: '3 routers with their interfaces and static routes' }, { k: 'Security groups', v: '20 groups, 146 rules; re-created by name, then attached' }, { k: 'Floating IPs', v: 'Allocations recorded; re-attached when the same address is free, otherwise a new one and a DNS update' }, { k: 'Ports', v: 'Fixed IPs and MAC addresses kept, so restored instances keep their addresses' }]} />
            </div>
          </Panel>
        </div>
      ) : null}
      {ct ? (
        <Drawer
          label="Container"
          kicker={`LXC container · CT ${ct.vmid} · ${ct.site}`}
          title={ct.name}
          status={<><span>{ct.node}</span><span>{ct.storage}</span></>}
          actions={
            <>
              <Btn kind="outline" icon="play" perm={op} disabled={ct.ok === 'off'} why="The container is excluded by a tag." onClick={() => { ctx.startJob({ name: 'Backup', object: ct.name, product: 'Backup', phases: ['Queued', 'Snapshot', 'Send changes', 'Verify', 'Done'], speed: 20, rate: '310 MB/s' }); ctx.toast(`Backup started for ${ct.name}`, 'info'); }}>Back up now</Btn>
              <Btn kind="outline" icon="rotate-ccw" perm={ctx.can('restore', 'Restoring')} disabled={ct.ok === 'off'} why="No recovery points." onClick={() => { drawer.close(); ctx.toast(`Restore of ${ct.name} queued as CT ${ct.vmid + 1000} on ${ct.node}; the original is left running`, 'info'); }}>Restore as a new container</Btn>
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ct.note ? <Bar tone={ct.ok === 'warn' ? 'warn' : 'info'} multiline>{ct.note}</Bar> : null}
            <DrawerTiles items={[{ label: 'Last backup', value: ct.last }, { label: 'Recovery points', value: ct.ok === 'off' ? '0' : ct.policy.startsWith('Lab') ? '4' : '31' }, { label: 'Captured by', value: ct.mode.split(',')[0] }]} />
            <Facts items={[{ k: 'Policy', v: ct.policy }, { k: 'Captured', v: ct.mode }, { k: 'Kept with it', v: 'Container configuration, mount points, bind mounts listed (not copied), network interfaces' }, { k: 'Restore options', v: 'New container on any node of the cluster, single files, or replace in place with a 24 h rollback snapshot' }]} />
          </div>
        </Drawer>
      ) : null}
      {pbs.value ? <PbsImportDialog ctx={ctx} closing={pbs.closing} onClose={pbs.close} /> : null}
      {diff.value ? (
        <Dialog title={`Changes on ${diff.value}`} sub="Since the configuration backup of 20 Oct, 01:00" size="lg" closing={diff.closing} onClose={diff.close} footer={<Btn kind="ghost" onClick={diff.close}>Close</Btn>}>
          <MiniTable label="Configuration changes" cols={[{ label: 'File or service', w: '170px' }, { label: 'Change' }, { label: 'When and who', w: '200px' }]} rows={(CONFIGS.find(c => c.site === diff.value)?.drift || []).map(([f, c, w]) => [<code key="f" style={{ font: '12px var(--f-mono)' }}>{f}</code>, c, w])} />
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>A rule that opens a port to the internet also raises a finding in Security & Compliance.</p>
        </Dialog>
      ) : null}
      {restore.value ? <ConfigRestoreDialog ctx={ctx} site={restore.value} closing={restore.closing} onClose={restore.close} /> : null}
    </>
  );
}

function ConfigRestoreDialog({ ctx, site, closing, onClose }: { ctx: Ctx; site: string; closing: boolean; onClose: () => void }) {
  const [ver, setVer] = useState('20 Oct, 01:00');
  const [scope, setScope] = useState('Compare and choose');
  const [ok, setOk] = useState(false);
  return (
    <Dialog
      title="Restore configuration"
      sub={`${site}. Guests are not touched; restore them separately.`}
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="rotate-ccw" disabled={!ok} why="Confirm with your second factor first." onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Restored platform configuration', object: site, when: ctx.now(), r: 'ok', after: [['Version', ver], ['Scope', scope]] }); ctx.toast(`Configuration of ${site} from ${ver} restored; the current one is kept as a version`, 'ok'); onClose(); }}>Restore</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="cr-v" label="Version"><SelectInput id="cr-v" value={ver} onChange={setVer} options={['21 Oct, 01:00', '20 Oct, 01:00', '19 Oct, 01:00', '18 Oct, 01:00', '11 Oct, 01:00']} /></Field>
        <Field id="cr-s" label="What to restore"><SelectInput id="cr-s" value={scope} onChange={setScope} options={['Compare and choose', 'Everything', 'Storage only', 'Firewall only', 'Users and permissions only', 'Network (SDN) only']} /></Field>
      </div>
      <Bar tone="warn" multiline>Restoring cluster configuration on a running cluster can disconnect nodes. For a rebuilt cluster, restore everything before the first guest.</Bar>
      <StepUp verified={ok} onVerified={() => setOk(true)} />
    </Dialog>
  );
}

function PbsImportDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [host, setHost] = useState('pbs-01.chennai.host360.ai:8007');
  const [store, setStore] = useState('datastore1');
  const [fp, setFp] = useState('6E:2A:91:…:C4');
  const [mode, setMode] = useState('Catalogue only: restore straight from PBS');
  const [state, setState] = useState<'idle' | 'scan' | 'found'>('idle');
  return (
    <Dialog
      title="Import from Proxmox Backup Server"
      sub="Bring existing PBS backups into Aegis, so their points can be restored from here and kept under Aegis policies."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          {state === 'found' ? (
            <Btn kind="primary" icon="check" onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Imported backups from Proxmox Backup Server', object: `${host} / ${store}`, when: ctx.now(), r: 'ok', after: [['Groups', '27'], ['Snapshots', '604'], ['Mode', mode]] }); ctx.toast('27 backup groups imported; 604 points can be restored', 'ok'); onClose(); }}>Import 27 groups</Btn>
          ) : (
            <Btn kind="primary" icon={state === 'scan' ? 'loader-circle' : 'search'} spin={state === 'scan'} disabled={state === 'scan'} onClick={() => { setState('scan'); window.setTimeout(() => setState('found'), 1300); }}>{state === 'scan' ? 'Reading the datastore…' : 'Read the datastore'}</Btn>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="pbs-h" label="PBS server"><TextInput id="pbs-h" value={host} onChange={setHost} mono /></Field>
        <Field id="pbs-d" label="Datastore"><TextInput id="pbs-d" value={store} onChange={setStore} mono /></Field>
        <Field id="pbs-f" label="Certificate fingerprint" hint="Shown on the PBS dashboard."><TextInput id="pbs-f" value={fp} onChange={setFp} mono /></Field>
        <Field id="pbs-t" label="API token"><SelectInput id="pbs-t" value="vault: secret/pbs/aegis-import (read-only)" onChange={() => {}} options={['vault: secret/pbs/aegis-import (read-only)']} /></Field>
        <Field id="pbs-m" label="After import" span={2}><SelectInput id="pbs-m" value={mode} onChange={setMode} options={['Catalogue only: restore straight from PBS', 'Copy into an Aegis repository, then keep PBS read-only', 'Copy into an Aegis repository, then let PBS prune']} /></Field>
      </div>
      {state === 'found' ? (
        <>
          <Bar tone="ok" multiline>Read 27 backup groups (21 VMs, 6 containers) and 604 snapshots, oldest 02 Mar 2026. 3 groups are encrypted on the client; Aegis asks for their key at the first restore.</Bar>
          <MiniTable label="Matched to guests" cols={[{ label: 'PBS group' }, { label: 'Matches', w: '220px' }, { label: 'Snapshots', w: '90px', r: true }]} rows={[['vm/104', 'erp-db-01 (same VMID and disks)', '58'], ['vm/101', 'web-frontend-01', '58'], ['ct/120', 'postfix-relay', '31'], ['vm/310', 'No match: VM deleted in May', '12']]} />
        </>
      ) : null}
    </Dialog>
  );
}
