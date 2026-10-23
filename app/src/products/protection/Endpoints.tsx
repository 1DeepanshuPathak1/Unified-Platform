import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Icon } from '../../lib/Icon';
import { Btn, Field, FilterInput, RadioCard, Seg, SelectInput, Tabs, TextArea, Toggle } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Page, PageHeader, Spacer, TableArea, Tiles, Toolbar, plural } from '../../ui/layout';
import { Dialog, Drawer, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { AGENTS, type Agent } from '../../data/ops';
import { custName, inScope, showCustomerCol } from '../../platform/common';
import { audit } from '../../platform/store';
import { DeployDialog } from '../../platform/Agents';
import AegisGuests from '../../screens/AegisGuests';
import { PlatformObjectsView } from './PlatformObjects';
import { KubernetesView, SaasView, SharesView } from './MoreSources';
import { ForeignView } from './ForeignBackups';

/** A machine protected through the Aegis agent: a physical or cloud server, or a laptop or desktop. */
export interface Protected {
  a: Agent;
  type: 'Server' | 'Laptop' | 'Desktop';
  dept: string;
  policy: string;
  last: string;
  sizeGB: number;
  points: number;
  mode: 'Whole machine image' | 'Files and folders';
  apps: [string, string][];
  ok: 'ok' | 'warn' | 'err' | 'off';
}

const DEPTS: Record<string, string[]> = { mer: ['Treasury', 'Branch operations', 'Retail banking', 'Risk'], h360: ['IT', 'Finance', 'Sales'] };
const APPS: Record<string, [string, string][]> = {
  'mum-oracle-phy-01': [['Oracle 19c (RMAN)', 'Archive logs every 15 min; point-in-time restore']],
  'sql-prod-02': [['SQL Server 2022', 'Log backups every 15 min; point-in-time restore'], ['Active Directory', 'Not a domain controller']],
  'his-db-01': [['PostgreSQL 15', 'WAL archived every 5 min; point-in-time restore']],
  'nil-pos-db': [['SQL Server 2019', 'Log backups every 30 min']]
};

/** Every machine whose agent serves Protection, with what the console knows about its backups. */
export function protectedMachines(): Protected[] {
  return AGENTS.filter(a => a.products.includes('Protection') && (a.kind === 'Windows agent' || a.kind === 'Linux agent' || a.kind === 'Endpoint agent')).map((a, i) => {
    const ep = a.kind === 'Endpoint agent';
    const n = parseInt(a.machine.replace(/\D/g, '').slice(-3) || '7', 10);
    const day = a.heartbeat.slice(0, 6);
    return {
      a,
      type: !ep ? 'Server' : a.customer === 'h360' && n % 2 === 0 ? 'Desktop' : 'Laptop',
      dept: ep ? (DEPTS[a.customer] || ['Staff'])[n % (DEPTS[a.customer] || ['Staff']).length] : 'Data centre',
      policy: ep ? (a.customer === 'mer' ? 'Meridian laptops · daily 13:00' : 'Host360 staff · daily 13:00') : a.machine === 'mum-oracle-phy-01' ? 'Meridian database hourly' : a.customer === 'sah' ? 'Clinical systems · hourly' : 'Production daily · immutable 14 d',
      last: a.health === 'unreach' ? `${day}, 13:${String(10 + (n % 40)).padStart(2, '0')}` : ep ? `21 Oct, 13:${String(10 + (n % 40)).padStart(2, '0')}` : '21 Oct, 16:00',
      sizeGB: ep ? 38 + ((n * 37) % 140) : [920, 410, 1450, 230][i % 4],
      points: ep ? 30 : 168,
      mode: ep ? 'Files and folders' : 'Whole machine image',
      apps: APPS[a.machine] || [],
      ok: a.health === 'unreach' ? 'off' : a.health === 'warn' ? 'warn' : a.health === 'err' ? 'err' : 'ok'
    };
  });
}

/** Protection › Protected guests: hypervisor guests (the original screen), containers and platform, agents, Kubernetes, SaaS and file shares. */
const SUBS: Record<string, string> = {
  endpoints: 'Servers, laptops and desktops backed up through the Aegis agent, wherever they are.',
  platform: 'Containers and the platforms’ own configuration, kept so a whole cluster or project can be rebuilt.',
  kubernetes: 'Namespaces with their resources and persistent volumes, restored to the same cluster or another.',
  saas: 'Mail, files, sites, Teams and the directory of Microsoft 365 and Google Workspace tenants.',
  shares: 'NAS and file server shares, with their permissions.',
  foreign: 'Veeam, Commvault, Acronis, NetBackup and Rubrik backups read in place: restore from years of history without keeping the old product.'
};
export function GuestsPage({ ctx }: { ctx: Ctx }) {
  const tab = SUBS[ctx.tab] ? ctx.tab : 'guests';
  const n = protectedMachines().filter(p => inScope(ctx, p.a.customer)).length;
  const tabs = (
    <Tabs
      label="Protected guests sections"
      value={tab}
      onChange={t => ctx.go(t === 'guests' ? 'guests' : `guests/${t}`)}
      tabs={[
        { v: 'guests', label: 'Hypervisor guests', tip: 'Proxmox VE and OpenStack guests, backed up without an agent' },
        { v: 'platform', label: 'Containers and platform', tip: 'LXC containers, cluster configuration, OpenStack projects, Heat stacks and networks' },
        { v: 'endpoints', label: 'Agents and endpoints', count: n, tip: 'Physical and cloud servers, laptops and desktops with the Aegis agent' },
        { v: 'kubernetes', label: 'Kubernetes', tip: 'Namespaces, resources and persistent volumes' },
        { v: 'saas', label: 'Microsoft 365 and Google', tip: 'Mail, OneDrive and Drive, SharePoint, Teams and the directory' },
        { v: 'shares', label: 'File shares', tip: 'NAS shares over NDMP, SMB and NFS' },
        { v: 'foreign', label: 'Other vendors’ backups', tip: 'Veeam, Commvault, Acronis, NetBackup and Rubrik backups, restored from here' }
      ]}
      style={{ margin: '0 24px 12px', padding: 0 }}
    />
  );
  if (tab === 'guests') return <AegisGuests ctx={ctx} tabs={tabs} />;
  return (
    <Page>
      <PageHeader
        kicker="Protection"
        title="Protected guests"
        sub={SUBS[tab]}
        actions={<Btn kind="outline" icon="clipboard-list" onClick={() => ctx.go('policies')}>Policies</Btn>}
      />
      {tabs}
      <div key={tab} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', animation: 'ae-fade 150ms var(--ease)' }}>
        {tab === 'endpoints' ? <EndpointsView ctx={ctx} /> : tab === 'kubernetes' ? <KubernetesView ctx={ctx} /> : tab === 'saas' ? <SaasView ctx={ctx} /> : tab === 'shares' ? <SharesView ctx={ctx} /> : tab === 'foreign' ? <ForeignView ctx={ctx} /> : <PlatformObjectsView ctx={ctx} />}
      </div>
    </Page>
  );
}

const ST = { ok: ['circle-check', 'ok', 'Protected'], warn: ['triangle-alert', 'warn', 'Agent behind'], err: ['circle-x', 'err', 'Failed'], off: ['wifi-off', 'warn', 'Offline'] } as const;

/** Protection › Protected guests › Agents and endpoints: servers and laptops backed up through the agent. */
export function EndpointsView({ ctx }: { ctx: Ctx }) {
  const all = protectedMachines().filter(p => inScope(ctx, p.a.customer));
  const [view, setView] = useState<'all' | 'servers' | 'endpoints' | 'attention'>('all');
  const [q, setQ] = useState('');
  const [os, setOs] = useState('All');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const deploy = useClosable<boolean>();
  const media = useClosable<string | true>();
  const ql = q.trim().toLowerCase();
  const fam = (p: Protected) => (p.a.os.startsWith('Windows') ? 'Windows' : p.a.os.startsWith('macOS') ? 'macOS' : 'Linux');
  const rows = all.filter(p => (view === 'all' || (view === 'servers' ? p.type === 'Server' : view === 'endpoints' ? p.type !== 'Server' : p.ok !== 'ok')) && (os === 'All' || fam(p) === os) && (!ql || `${p.a.machine} ${p.a.os} ${p.dept} ${p.policy}`.toLowerCase().includes(ql)));
  const eps = all.filter(p => p.type !== 'Server');
  const off = all.filter(p => p.ok === 'off');
  const behind = all.filter(p => p.ok === 'warn');
  const d = drawer.value ? all.find(p => p.a.id === drawer.value) : null;
  const custCol = showCustomerCol(ctx);
  const op = ctx.can('operate', 'Starting a backup');
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Machines', value: String(all.length), icon: 'monitor', sub: `${all.length - eps.length} servers · ${eps.length} laptops and desktops` },
            { label: 'Backed up in 24 h', value: String(all.length - off.length), unit: `of ${all.length}`, icon: 'circle-check', tone: off.length ? 'warn' : 'ok', sub: off.length ? `${plural(off.length, 'machine')} offline for more than 24 h` : 'Every machine' },
            { label: 'Agents behind', value: String(behind.length), icon: 'refresh-cw', tone: behind.length ? 'warn' : 'ok', sub: 'Update on the next connection on mains power' },
            { label: 'Endpoints billed', value: String(eps.length), icon: 'receipt', sub: `₹90 a device a month · ${eps.filter(p => p.a.customer === 'mer').length} for Meridian` }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={view} onChange={setView} options={[{ v: 'all', label: 'All', count: all.length }, { v: 'servers', label: 'Servers', count: all.length - eps.length }, { v: 'endpoints', label: 'Endpoints', count: eps.length }, { v: 'attention', label: 'Needs attention', count: off.length + behind.length }]} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter machines" label="Filter machines" width={180} />
        <SelectInput value={os} onChange={setOs} options={['All', 'Windows', 'Linux', 'macOS'].map(v => ({ v, label: v === 'All' ? 'Every OS' : v }))} width={140} />
        <Spacer />
        <Btn kind="ghost" icon="disc" onClick={() => media.open(true)}>Recovery media…</Btn>
        <Btn kind="primary" icon="download" perm={ctx.can('operate', 'Deploying agents')} onClick={() => deploy.open(true)}>Deploy agents…</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Agents and endpoints"
          cols={[
            { k: 'n', label: 'Machine', w: 'minmax(150px,1.2fr)' },
            ...(custCol ? [{ k: 'c', label: 'Customer', w: 'minmax(120px,1fr)', dim: true }] : []),
            { k: 'os', label: 'Operating system', w: 'minmax(150px,1fr)', dim: true },
            { k: 't', label: 'Type', w: '96px' },
            { k: 'p', label: 'Policy', w: 'minmax(170px,1.2fr)', dim: true },
            { k: 'l', label: 'Last backup', w: '120px' },
            { k: 'z', label: 'Protected', w: '96px', r: true },
            { k: 's', label: 'Status', w: '140px' }
          ]}
          rows={rows.map(p => ({
            id: p.a.id,
            n: { v: p.a.machine, strong: true },
            c: custName(p.a.customer),
            os: p.a.os,
            t: { t: 'icon', i: p.type === 'Server' ? 'server' : p.type === 'Desktop' ? 'monitor' : 'laptop', l: p.type, c: 'tx', s: p.type },
            p: { v: p.policy, tip: p.policy },
            l: { v: p.last, s: p.last, tip: p.ok === 'off' ? `Last seen ${p.a.heartbeat}` : undefined },
            z: { v: p.sizeGB >= 1000 ? `${(p.sizeGB / 1024).toFixed(2)} TB` : `${p.sizeGB} GB`, s: p.sizeGB },
            s: { t: 'status', i: ST[p.ok][0], c: ST[p.ok][1], l: ST[p.ok][2], s: p.ok, tip: p.a.note }
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['machine', 'machines']}
          filtered={view !== 'all' || os !== 'All' || !!ql}
          onClear={() => { setView('all'); setOs('All'); setQ(''); }}
          emptyText="No machines have the agent yet. Deploy it to servers, laptops and desktops to back them up."
          emptyAction="Deploy agents…"
          onEmpty={() => deploy.open(true)}
          sort="n"
          footR="Laptops back up over any network except metered ones"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Protected machine"
          kicker={`${d.type} · ${d.a.kind} · ${custName(d.a.customer)}`}
          title={d.a.machine}
          status={<><span>{d.a.os}</span><span>Agent {d.a.version}</span><span>{d.ok === 'off' ? `Last seen ${d.a.heartbeat}` : 'Online'}</span></>}
          actions={
            <>
              <Btn kind="outline" icon="play" perm={op} disabled={d.ok === 'off'} why="The machine is offline; it backs up when it reconnects." onClick={() => { ctx.startJob({ name: 'Backup', object: d.a.machine, product: 'Backup', phases: ['Queued', 'Snapshot', 'Read changes', 'Write', 'Verify', 'Done'], speed: 9, rate: d.type === 'Server' ? '180 MB/s' : '22 MB/s' }); ctx.toast(`Backup started for ${d.a.machine}`, 'info'); }}>Back up now</Btn>
              <Btn kind="outline" icon="rotate-ccw" perm={ctx.can('restore', 'Restoring')} onClick={() => ctx.go('backup/restore')}>Restore files…</Btn>
              <Btn kind="ghost" icon="disc" onClick={() => media.open(d.a.id)}>Bare-metal recovery…</Btn>
            </>
          }
          tabs={[{ v: 'Overview', label: 'Overview' }, { v: 'Set', label: 'What is backed up' }, ...(d.apps.length ? [{ v: 'Apps', label: 'Applications', count: d.apps.length }] : []), { v: 'Settings', label: 'Agent settings' }]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.a.note ? <Bar tone="warn" multiline>{d.a.note}</Bar> : null}
              <DrawerTiles items={[{ label: 'Last backup', value: d.last, icon: ST[d.ok][0], tone: ST[d.ok][1] }, { label: 'Recovery points', value: String(d.points), sub: d.type === 'Server' ? 'Hourly for 7 days' : 'Daily for 30 days' }, { label: 'Protected', value: d.sizeGB >= 1000 ? `${(d.sizeGB / 1024).toFixed(2)} TB` : `${d.sizeGB} GB`, sub: d.mode }]} />
              <Facts
                items={[
                  { k: 'Policy', v: d.policy },
                  { k: d.type === 'Server' ? 'Location' : 'Department', v: d.type === 'Server' ? d.a.site : d.dept },
                  { k: 'Change tracking', v: d.a.os.startsWith('macOS') ? 'APFS snapshots' : d.a.os.startsWith('Windows') ? 'Aegis filter driver (WHQL signed, Secure Boot compatible)' : 'Aegis kernel module (signed for RHEL, DKMS for Debian and Ubuntu)' },
                  { k: 'Consistency', v: d.a.os.startsWith('Windows') ? 'VSS: all writers stable at the last backup' : d.a.os.startsWith('macOS') ? 'APFS snapshot' : 'LVM snapshot with fsfreeze' },
                  { k: 'Encryption', v: 'AES-256 before it leaves the machine', icon: 'shield' },
                  { k: 'Installed', v: d.a.installed },
                  { k: 'Rollout ring', v: d.a.ring }
                ]}
              />
            </div>
          ) : null}
          {tab === 'Set' ? <BackupSet ctx={ctx} p={d} /> : null}
          {tab === 'Apps' ? (
            <MiniTable label="Applications" cols={[{ label: 'Application', w: '200px' }, { label: 'How it is protected' }]} rows={d.apps.map(([n, how]) => [<strong key="n" style={{ fontWeight: 600 }}>{n}</strong>, how])} />
          ) : null}
          {tab === 'Settings' ? <AgentSettings ctx={ctx} p={d} /> : null}
        </Drawer>
      ) : null}
      {deploy.value ? <DeployDialog ctx={ctx} closing={deploy.closing} onClose={deploy.close} customer={ctx.actingAs?.customer || 'mer'} /> : null}
      {media.value ? <RecoveryMediaDialog ctx={ctx} machine={media.value === true ? undefined : all.find(p => p.a.id === media.value)} closing={media.closing} onClose={media.close} /> : null}
    </>
  );
}

function BackupSet({ ctx, p }: { ctx: Ctx; p: Protected }) {
  const ep = p.type !== 'Server';
  const [inc, setInc] = useState(ep ? 'C:\\Users\\*\\Documents\nC:\\Users\\*\\Desktop\nC:\\Users\\*\\Pictures' : 'All volumes');
  const [exc, setExc] = useState(ep ? '*.tmp\n*.iso\nC:\\Users\\*\\AppData\\Local\\Temp' : 'D:\\SQLData\\tempdb*');
  const [auto, setAuto] = useState(true);
  const [mode, setMode] = useState<string>(p.mode);
  const cfg = ctx.can('configure', 'Changing what is backed up');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={mode === 'Whole machine image'} onClick={() => setMode('Whole machine image')} icon="hard-drive" title="Whole machine" note="Every volume; restores to bare metal" />
        <RadioCard on={mode === 'Files and folders'} onClick={() => setMode('Files and folders')} icon="folder" title="Files and folders" note="Only what the rules below select" />
      </div>
      {mode === 'Files and folders' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field id="bs-i" label="Include"><TextArea id="bs-i" value={inc} onChange={setInc} rows={4} /></Field>
          <Field id="bs-e" label="Exclude"><TextArea id="bs-e" value={exc} onChange={setExc} rows={4} /></Field>
        </div>
      ) : (
        <Field id="bs-e2" label="Exclude"><TextArea id="bs-e2" value={exc} onChange={setExc} rows={2} /></Field>
      )}
      <Toggle on={auto} onChange={setAuto} label="Automatic exclusions"><span style={{ whiteSpace: 'normal', textAlign: 'left' }}>Leave out OneDrive, Dropbox and Google Drive sync folders, the page file and known temporary paths</span></Toggle>
      <div>
        <Btn kind="primary" icon="check" perm={cfg} onClick={() => { audit({ who: 'priya.raman', customer: p.a.customer, what: 'Changed what is backed up', object: p.a.machine, when: ctx.now(), r: 'ok' }); ctx.toast(`${p.a.machine}: applies from the next backup`, 'ok'); }}>Save</Btn>
      </div>
    </div>
  );
}

function AgentSettings({ ctx, p }: { ctx: Ctx; p: Protected }) {
  const ep = p.type !== 'Server';
  const [s, setS] = useState({ metered: false, battery: true, vpn: false, cpu: '25 %', bw: ep ? '20 Mbit/s' : 'Source impact policy', tamper: true, self: ep, retire: '90 days' });
  const cfg = ctx.can('configure', 'Changing agent settings');
  const set = (k: keyof typeof s, v: boolean | string) => setS(x => ({ ...x, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ep ? (
        <>
          <Toggle on={s.metered} onChange={v => set('metered', v)} label="Back up on metered connections">Back up on metered connections (mobile hotspots)</Toggle>
          <Toggle on={s.battery} onChange={v => set('battery', v)} label="Pause on battery">Pause when the battery is below 30 % and not charging</Toggle>
          <Toggle on={s.vpn} onChange={v => set('vpn', v)} label="Only on VPN">Back up only on the office network or VPN</Toggle>
          <Toggle on={s.self} onChange={v => set('self', v)} label="Self-service restore">The user can restore their own files at restore.host360.ai/me</Toggle>
        </>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="as-cpu" label="CPU limit"><SelectInput id="as-cpu" value={s.cpu} onChange={v => set('cpu', v)} options={['10 %', '25 %', '50 %', 'No limit']} /></Field>
        <Field id="as-bw" label="Upload limit"><SelectInput id="as-bw" value={s.bw} onChange={v => set('bw', v)} options={ep ? ['5 Mbit/s', '20 Mbit/s', '50 Mbit/s', 'No limit'] : ['Source impact policy', '200 Mbit/s', '1 Gbit/s']} /></Field>
      </div>
      <Toggle on={s.tamper} onChange={v => set('tamper', v)} label="Tamper protection"><span style={{ whiteSpace: 'normal', textAlign: 'left' }}>Tamper protection: the agent cannot be stopped or removed without the password held in the vault</span></Toggle>
      {ep ? <Field id="as-ret" label="When the device is retired" hint="Keep its backups this long, then delete them and release the licence"><SelectInput id="as-ret" value={s.retire} onChange={v => set('retire', v)} options={['30 days', '90 days', '1 year', 'Keep until deleted']} /></Field> : null}
      <div>
        <Btn kind="primary" icon="check" perm={cfg} onClick={() => { audit({ who: 'priya.raman', customer: p.a.customer, what: 'Changed agent settings', object: p.a.machine, when: ctx.now(), r: 'ok' }); ctx.toast(`${p.a.machine}: settings sent; the agent applies them at its next check-in`, 'ok'); }}>Save</Btn>
      </div>
    </div>
  );
}

/** Boot media for bare-metal recovery: restore a whole machine onto new or dissimilar hardware. */
function RecoveryMediaDialog({ ctx, machine, closing, onClose }: { ctx: Ctx; machine?: Protected; closing: boolean; onClose: () => void }) {
  const win = !machine || machine.a.os.startsWith('Windows');
  const [kind, setKind] = useState<'win' | 'linux'>(win ? 'win' : 'linux');
  const [net, setNet] = useState('DHCP');
  const [drivers, setDrivers] = useState(true);
  return (
    <Dialog
      title={machine ? `Recover ${machine.a.machine} to bare metal` : 'Recovery media'}
      sub="Boot the machine from this image, sign in with a one-time code and pick a recovery point. Drivers for new hardware are added during the restore."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Close</Btn><Btn kind="primary" icon="download" onClick={() => { audit({ who: 'priya.raman', customer: machine?.a.customer || 'h360', what: 'Created recovery media', object: machine?.a.machine || (kind === 'win' ? 'Windows PE' : 'Linux'), when: ctx.now(), r: 'ok' }); ctx.toast(`${kind === 'win' ? 'aegis-recovery-winpe-x64.iso (612 MB)' : 'aegis-recovery-linux-x86_64.iso (418 MB)'} is ready`, 'ok'); onClose(); }}>Create image</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={kind === 'win'} onClick={() => setKind('win')} icon="monitor" title="Windows PE" note="For Windows servers, desktops and laptops" />
        <RadioCard on={kind === 'linux'} onClick={() => setKind('linux')} icon="server" title="Linux" note="For RHEL, Rocky, Ubuntu, Debian and SUSE" />
      </div>
      <Field id="rm-n" label="Network at boot"><SelectInput id="rm-n" value={net} onChange={setNet} options={['DHCP', 'Static address (asked at boot)', 'Wi-Fi (asked at boot)']} /></Field>
      <Toggle on={drivers} onChange={setDrivers} label="Add storage and network drivers"><span style={{ whiteSpace: 'normal', textAlign: 'left' }}>Add storage and network drivers for new hardware (dissimilar restore, P2V and V2P)</span></Toggle>
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="info" />The image holds no credentials; it asks for a one-time code from this console.</p>
    </Dialog>
  );
}
