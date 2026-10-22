import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { AEGIS } from '../data/aegis';
import { T } from '../data/platform';
import { Btn, Field, InfoTip, SelectInput, Seg } from '../ui/controls';
import { Activity, Bar, Facts, H3, Spacer, TableArea, Toolbar } from '../ui/layout';
import { Dialog, Drawer, StepUp, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit } from './store';

type Site = { id: string; name: string; platform: string; fam: string; access: string; account: string; fp: string; usedBy: string[]; status: string; addr: string; vmw?: boolean };

const ROTATED: Record<string, [string, string]> = { cpp: [T('01 Oct', '02:00'), 'Every 30 days'], clp: [T('02 Apr', '15:12'), 'Manual'], pos: [T('15 Sep', '02:00'), 'Every 90 days'], r2: [T('30 Jun', '11:05'), 'Every 90 days'], vc: [T('04 Aug', '14:30'), 'Every 90 days'], esx: [T('09 Sep', '17:48'), 'Manual'] };

const SCRIPTS: Record<string, { title: string; lang: string; body: string; grants: string[] }> = {
  'Proxmox VE': {
    title: 'Proxmox VE role and API token (run on one node as root)',
    lang: 'bash',
    grants: ['VM.Audit, VM.Backup, VM.Snapshot, VM.Config.Disk', 'Datastore.Audit, Datastore.AllocateSpace', 'Sys.Audit (read node status)', 'No permission to delete VMs or change users'],
    body: `pveum role add AegisBackup -privs "VM.Audit VM.Backup VM.Snapshot VM.Snapshot.Rollback VM.Config.Disk Datastore.Audit Datastore.AllocateSpace Sys.Audit"
pveum user add aegis@pve --comment "Host360 Aegis service account"
pveum aclmod / -user aegis@pve -role AegisBackup
pveum user token add aegis@pve backup --privsep 0 --expire $(date -d "+90 days" +%s)`
  },
  OpenStack: {
    title: 'OpenStack application credential (run as a project admin)',
    lang: 'bash',
    grants: ['member role in each protected project', 'Snapshots and volume backups through Cinder', 'Image upload to Glance for restores', 'No admin role; cannot change quotas or users'],
    body: `openstack role add --user aegis-svc --project production member
openstack application credential create aegis-backup \\
  --role member --expiration "$(date -u -d '+90 days' +%Y-%m-%dT%H:%M:%S)" \\
  --description "Host360 Aegis, least privilege"`
  },
  'VMware vCenter': {
    title: 'vCenter role for replication and migration (PowerCLI)',
    lang: 'powershell',
    grants: ['Read inventory, datastores and networks', 'Create and remove snapshots; read changed blocks (CBT)', 'Power off a VM only during a cutover', 'No permission to delete VMs or edit hosts'],
    body: `$priv = Get-VIPrivilege -Id System.Anonymous,System.View,System.Read,Datastore.Browse,Datastore.FileManagement,
  VirtualMachine.State.CreateSnapshot,VirtualMachine.State.RemoveSnapshot,VirtualMachine.Provisioning.DiskRandomRead,
  VirtualMachine.Config.ChangeTracking,VirtualMachine.Interact.PowerOff,Global.DisableMethods,Global.EnableMethods
New-VIRole -Name "Aegis Resilience and Mobility" -Privilege $priv
New-VIPermission -Entity (Get-Folder -NoRecursion) -Principal "VSPHERE.LOCAL\\svc-aegis" \`
  -Role "Aegis Resilience and Mobility" -Propagate:$true`
  }
};

export function VaultTab({ ctx }: { ctx: Ctx }) {
  const [fam, setFam] = useState('All');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Credential');
  const rotate = useClosable<string>();
  const [rotated, setRotated] = useState<Record<string, string>>({});
  const sites = AEGIS.sites as Site[];
  const rows = sites.filter(x => fam === 'All' || x.fam === fam);
  const cfg = ctx.can('configure', 'Rotating credentials');
  const d = drawer.value ? sites.find(x => x.id === drawer.value) : null;
  const script = d ? SCRIPTS[d.platform === 'ESXi' ? 'VMware vCenter' : d.platform] : null;
  const last = (id: string) => rotated[id] || ROTATED[id][0];
  return (
    <>
      <Toolbar>
        <Seg label="Platform" value={fam} onChange={setFam} options={['All', 'Proxmox VE', 'OpenStack', 'VMware'].map(v => ({ v, label: v, count: v === 'All' ? sites.length : sites.filter(x => x.fam === v).length }))} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>
          One connection and one credential per platform, shared by every product that uses it.
          <InfoTip tip="Secrets are encrypted with the Host360 KMS key and never shown again after they are saved. Rotation writes the new secret first, checks it works, then revokes the old one." />
        </span>
        <Spacer />
        <Btn kind="secondary" icon="map-pin" onClick={() => ctx.go('sites')}>
          Add a platform in Sites
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Credential vault"
          cols={[
            { k: 'name', label: 'Connection', w: 'minmax(170px,1.2fr)' },
            { k: 'plat', label: 'Platform', w: '130px', dim: true },
            { k: 'acc', label: 'Account', w: 'minmax(160px,1.2fr)' },
            { k: 'used', label: 'Used by', w: '210px', nosort: true },
            { k: 'fp', label: 'Certificate', w: '120px' },
            { k: 'rot', label: 'Last rotated', w: '176px', dim: true },
            { k: 'pol', label: 'Rotation', w: '120px', dim: true }
          ]}
          rows={rows.map(x => ({
            id: x.id,
            name: { v: x.name, strong: true },
            plat: x.platform,
            acc: x.account,
            how: x.access,
            used: x.usedBy.map(u => ({ Backup: 'Protection', DR: 'Resilience', Migration: 'Mobility' })[u] || u),
            fp: x.status === 'unreach' ? { t: 'status', i: 'triangle-alert', l: 'Not checked', c: 'warn', tip: 'Could not be read: the site did not answer' } : { t: 'status', i: 'shield', l: 'Confirmed', c: 'ok', tip: x.fp },
            rot: last(x.id),
            pol: ROTATED[x.id][1] === 'Manual' ? { v: 'Manual', muted: true } : ROTATED[x.id][1]
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Credential'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['credential', 'credentials']}
          filtered={fam !== 'All'}
          onClear={() => setFam('All')}
          emptyText="No credentials stored. They are added when you connect a platform in Sites."
          emptyAction="Open Sites"
          onEmpty={() => ctx.go('sites')}
        />
      </TableArea>
      {d && script ? (
        <Drawer
          label="Credential details"
          width={680}
          kicker={`Credential · ${d.platform}`}
          title={d.name}
          status={<><span>{d.account}</span><span>Rotated {last(d.id)}</span></>}
          actions={
            <>
              <Btn kind="outline" icon="refresh-cw" perm={cfg} disabled={d.status === 'unreach'} why="The site cannot be reached, so the new secret could not be checked." onClick={() => rotate.open(d.id)}>
                Rotate now…
              </Btn>
              <Btn kind="outline" icon="map-pin" onClick={() => ctx.go('sites', d.id)}>
                Open site
              </Btn>
            </>
          }
          tabs={[{ v: 'Credential', label: 'Credential' }, { v: 'Least privilege', label: 'Least privilege' }, { v: 'Rotation', label: 'Rotation' }]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Credential' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.status === 'unreach' ? <Bar tone="warn">Could not be read: {d.name} did not answer within 30 s. The credential has not been checked since 30 Jun 2026.</Bar> : null}
              <Facts
                items={[
                  { k: 'Address', v: d.addr },
                  { k: 'Account', v: d.account },
                  { k: 'Access method', v: d.access },
                  { k: 'Secret', v: 'Stored encrypted; never shown', icon: 'shield', tone: 'ok' },
                  { k: 'Certificate', v: d.fp, icon: 'shield', tone: 'ok' },
                  { k: 'Used by', v: d.usedBy.map(u => ({ Backup: 'Protection', DR: 'Resilience', Migration: 'Mobility' })[u] || u).join(', ') },
                  ...(d.vmw ? [{ k: 'Note', v: 'VMware sources serve Resilience and Mobility only; they never appear in Protection.', muted: true }] : [])
                ]}
              />
            </div>
          ) : null}
          {tab === 'Least privilege' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <H3>What the account needs</H3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {script.grants.map(g => (
                  <li key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 32, borderBottom: '1px solid var(--ln)', font: '13px var(--f-ui)' }}>
                    <Icon name={g.startsWith('No ') ? 'ban' : 'check'} style={{ color: g.startsWith('No ') ? 'var(--tx-3)' : 'var(--ok)' }} />
                    {g}
                  </li>
                ))}
              </ul>
              <H3 right={<Btn kind="outline" size="sm" icon="copy" onClick={() => { navigator.clipboard?.writeText(script.body).catch(() => undefined); ctx.toast('Script copied', 'ok'); }}>Copy</Btn>}>{script.title}</H3>
              <pre style={{ margin: 0, padding: 12, background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/20px var(--f-ui)', whiteSpace: 'pre', overflow: 'auto', userSelect: 'all' }}>{script.body}</pre>
              {d.platform === 'Proxmox VE' ? <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>SSH-only sites (like Chennai_Lab_Proxmox) use a key installed for root instead; Aegis never stores the root password.</p> : null}
            </div>
          ) : null}
          {tab === 'Rotation' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field id="rot-p" label="Rotate automatically">
                <SelectInput id="rot-p" value={ROTATED[d.id][1]} onChange={v => ctx.toast(`Rotation set to ${v.toLowerCase()} for ${d.name}`, 'ok')} options={['Manual', 'Every 30 days', 'Every 90 days', 'Every 180 days']} width={220} />
              </Field>
              <Activity
                items={[
                  ...(rotated[d.id] ? [{ icon: 'refresh-cw', tone: 'ok', text: 'Rotated by priya.raman; new secret checked, old one revoked', when: rotated[d.id] }] : []),
                  { icon: 'refresh-cw', tone: 'ok', text: ROTATED[d.id][1] === 'Manual' ? 'Stored when the site was added' : 'Rotated automatically; new secret checked, old one revoked', when: ROTATED[d.id][0] },
                  { icon: 'shield', tone: 'info', text: 'Certificate fingerprint confirmed by priya.raman', when: ROTATED[d.id][0] }
                ]}
              />
            </div>
          ) : null}
        </Drawer>
      ) : null}
      {rotate.value ? (
        <RotateDialog
          name={sites.find(x => x.id === rotate.value)!.name}
          closing={rotate.closing}
          onClose={rotate.close}
          onDone={() => {
            const x = sites.find(y => y.id === rotate.value)!;
            setRotated(r => ({ ...r, [x.id]: ctx.now() }));
            audit({ who: 'priya.raman', customer: 'h360', what: 'Rotated a credential', object: `${x.name} · ${x.account}`, when: ctx.now(), r: 'ok' });
            ctx.toast(`Credential for ${x.name} rotated; the old secret is revoked`, 'ok');
            rotate.close();
          }}
        />
      ) : null}
    </>
  );
}

function RotateDialog({ name, closing, onClose, onDone }: { name: string; closing: boolean; onClose: () => void; onDone: () => void }) {
  const [mfa, setMfa] = useState(false);
  return (
    <Dialog
      title={`Rotate the credential for ${name}`}
      sub="Aegis creates a new secret, checks that Protection, Resilience and Mobility can all use it, then revokes the old one."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="refresh-cw" disabled={!mfa} why="Confirm it is you first." onClick={onDone}>
            Rotate now
          </Btn>
        </>
      }
    >
      <p style={{ color: 'var(--tx-2)' }}>Running jobs keep their sessions. Jobs that start in the next minute wait until the new secret is checked.</p>
      <StepUp verified={mfa} onVerified={() => setMfa(true)} />
    </Dialog>
  );
}
