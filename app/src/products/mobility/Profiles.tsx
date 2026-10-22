import { useState } from 'react';
import { Btn, Field, SelectInput, TextInput, Toggle } from '../../ui/controls';
import { Bar, Facts, MiniTable, Panel, Status } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { pc } from '../../lib/pseudo';
import { audit } from '../../platform/store';
import { INVENTORY, type SourceVm } from './data';

export interface TStep { id: string; name: string; detail: string; on: boolean; locked?: boolean }
export interface Profile { id: string; name: string; os: 'Windows' | 'Linux'; dest: string; match: string; version: number; defaultFor?: string; steps: TStep[]; runs: { ok: number; warn: number; err: number }; note?: string }

const OS = 'production-openstack';
const PVE = 'Chennai-proxmox-prod';
const VIRTIO = ['0.1.262 (Aug 2024)', '0.1.248 (Feb 2024)', '0.1.185 (for 2008 R2)'];

export const PROFILES: Profile[] = [
  {
    id: 'win-os', name: 'Windows Server to OpenStack', os: 'Windows', dest: OS, match: 'Windows Server 2012 R2 to 2022', version: 4, defaultFor: `Windows · ${OS}`, runs: { ok: 14, warn: 1, err: 0 },
    steps: [
      { id: 'v', name: 'Add VirtIO drivers before the first boot', detail: 'viostor, vioscsi, netkvm, balloon from VirtIO 0.1.262', on: true, locked: true },
      { id: 'c', name: 'Boot disk on VirtIO SCSI', detail: 'Falls back to SATA for the first boot if the driver does not load', on: true },
      { id: 't', name: 'Remove VMware Tools', detail: 'After the first good boot at the destination', on: true },
      { id: 'q', name: 'Install the QEMU guest agent', detail: 'Needed for consistent backups and graceful shutdown', on: true, locked: true },
      { id: 'n', name: 'Keep the IP address', detail: 'Static settings moved from the VMware NIC to the new one; the old adapter is removed', on: true },
      { id: 'r', name: 'Hardware clock in UTC', detail: 'Sets RealTimeIsUniversal so the clock is not off by 5 h 30 min', on: true },
      { id: 'k', name: 'Re-activate Windows', detail: 'Against kms.host360.local; the hardware change resets activation', on: true },
      { id: 'b', name: 'Install cloudbase-init', detail: 'Only for servers that will be managed as cloud instances', on: false }
    ]
  },
  {
    id: 'win-pve', name: 'Windows Server to Proxmox VE', os: 'Windows', dest: PVE, match: 'Windows Server 2012 R2 to 2022', version: 3, defaultFor: `Windows · ${PVE}`, runs: { ok: 9, warn: 0, err: 0 },
    steps: [
      { id: 'v', name: 'Add VirtIO drivers before the first boot', detail: 'viostor, vioscsi, netkvm from VirtIO 0.1.262', on: true, locked: true },
      { id: 'm', name: 'Machine type q35 with OVMF for UEFI servers', detail: 'BIOS servers keep SeaBIOS', on: true },
      { id: 't', name: 'Remove VMware Tools', detail: 'After the first good boot at the destination', on: true },
      { id: 'q', name: 'Install the QEMU guest agent', detail: 'Enables freeze and thaw for backups', on: true, locked: true },
      { id: 'n', name: 'Keep the IP address', detail: 'Static settings moved to the VirtIO network adapter', on: true },
      { id: 'k', name: 'Re-activate Windows', detail: 'Against the customer KMS, or MAK where set', on: true }
    ]
  },
  {
    id: 'lin-os', name: 'Linux to OpenStack', os: 'Linux', dest: OS, match: 'RHEL, Rocky, Oracle Linux 8 and 9; Ubuntu 20.04 to 24.04; Debian 11 and 12', version: 5, defaultFor: `Linux · ${OS}`, runs: { ok: 6, warn: 1, err: 1 }, note: 'rhel-oracle-01 failed on 17 Oct: the initramfs rebuild missed virtio_scsi on a custom kernel. Version 5 adds it explicitly.',
    steps: [
      { id: 'i', name: 'Rebuild the initramfs with VirtIO modules', detail: 'virtio_blk, virtio_scsi, virtio_net with dracut or update-initramfs', on: true, locked: true },
      { id: 'f', name: 'Mount disks by UUID', detail: 'Rewrites /dev/sdX entries in /etc/fstab', on: true },
      { id: 'n', name: 'Rename network interfaces', detail: 'ens192 becomes ens3; netplan or NetworkManager files updated, IP kept', on: true },
      { id: 't', name: 'Remove open-vm-tools', detail: 'After the first good boot', on: true },
      { id: 'q', name: 'Install the QEMU guest agent', detail: 'From the distribution repository, or the bundled package offline', on: true, locked: true },
      { id: 'c', name: 'Set the cloud-init data source to OpenStack', detail: 'Only if cloud-init is already installed', on: true },
      { id: 's', name: 'Serial console on ttyS0', detail: 'So the console works in Horizon', on: false }
    ]
  },
  {
    id: 'lin-pve', name: 'Linux to Proxmox VE', os: 'Linux', dest: PVE, match: 'Same distributions as Linux to OpenStack', version: 2, defaultFor: `Linux · ${PVE}`, runs: { ok: 11, warn: 0, err: 0 },
    steps: [
      { id: 'i', name: 'Rebuild the initramfs with VirtIO modules', detail: 'virtio_blk, virtio_scsi, virtio_net', on: true, locked: true },
      { id: 'f', name: 'Mount disks by UUID', detail: 'Rewrites /dev/sdX entries in /etc/fstab', on: true },
      { id: 'n', name: 'Rename network interfaces', detail: 'IP kept; MAC addresses are new', on: true },
      { id: 't', name: 'Remove open-vm-tools', detail: 'After the first good boot', on: true },
      { id: 'q', name: 'Install the QEMU guest agent', detail: 'Enables freeze and thaw for backups', on: true, locked: true }
    ]
  },
  {
    id: 'legacy', name: 'Legacy Windows to Proxmox VE', os: 'Windows', dest: PVE, match: 'Windows Server 2008 R2 and 2012', version: 1, runs: { ok: 0, warn: 0, err: 0 }, note: 'Made for old-sql2008. Not a default: choose it on the server.',
    steps: [
      { id: 'v', name: 'Add VirtIO drivers before the first boot', detail: 'VirtIO 0.1.185, the last version signed for 2008 R2', on: true, locked: true },
      { id: 'd', name: 'First boot on IDE, then switch to VirtIO', detail: 'Two boots; adds about 10 minutes to the cutover', on: true },
      { id: 'q', name: 'Install the QEMU guest agent', detail: 'Version 100.0.0 for 2008 R2', on: true },
      { id: 'n', name: 'Keep the IP address', detail: 'Static settings moved to the new adapter', on: true }
    ]
  }
];

/** The profile a server gets unless someone picks another: by its operating system and destination. */
export function profileFor(v: SourceVm): Profile | undefined {
  if (!v.dest) return undefined;
  if (/2008|2012(?! R2)/.test(v.os) && v.dest === PVE) return PROFILES.find(p => p.id === 'legacy');
  const os = /Windows/.test(v.os) ? 'Windows' : 'Linux';
  return PROFILES.find(p => p.defaultFor === `${os} · ${v.dest}`);
}

/** Mobility › Migration plans › Transformation profiles: what changes inside a server so it boots on the destination. */
export function ProfilesView({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState(PROFILES);
  const [sel, setSel] = useState(list[0].id);
  const edit = useClosable<Profile>();
  const p = list.find(x => x.id === sel) || list[0];
  const using = INVENTORY.filter(v => profileFor(v)?.id === p.id && v.stage !== 'excluded');
  const cfg = ctx.can('configure', 'Changing transformation profiles');
  const save = (n: Profile) => {
    setList(l => (l.some(x => x.id === n.id) ? l.map(x => (x.id === n.id ? n : x)) : [...l, n]));
    setSel(n.id);
    audit({ who: 'priya.raman', customer: 'h360', what: 'Saved a transformation profile', object: `${n.name} v${n.version}`, when: ctx.now(), r: 'ok' });
    ctx.toast(`${n.name} saved as version ${n.version}. Servers already syncing keep the version they started with.`, 'ok');
    edit.close();
  };
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ul role="listbox" aria-label="Transformation profiles" style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)', background: 'var(--panel)' }}>
          {list.map(x => (
            <li key={x.id} role="option" aria-selected={x.id === p.id}>
              <button type="button" onClick={() => setSel(x.id)} className={pc('hover', 'background:var(--hover)')} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2, borderLeft: `2px solid ${x.id === p.id ? 'var(--acc)' : 'transparent'}`, background: x.id === p.id ? 'var(--acc-soft)' : undefined, borderBottom: '1px solid var(--ln)' }}>
                <span style={{ fontWeight: 600 }}>{x.name}</span>
                <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>v{x.version} · {x.defaultFor ? 'Default' : 'Chosen per server'}</span>
              </button>
            </li>
          ))}
        </ul>
        <Btn kind="outline" icon="copy" perm={cfg} onClick={() => edit.open({ ...JSON.parse(JSON.stringify(p)), id: 'p' + Date.now(), name: `${p.name} (copy)`, version: 1, defaultFor: undefined, runs: { ok: 0, warn: 0, err: 0 }, note: undefined })}>
          Duplicate this profile
        </Btn>
      </div>
      <Panel title={`${p.name} · version ${p.version}`} right={<Btn kind="outline" size="sm" icon="pencil" perm={cfg} onClick={() => edit.open(p)}>Edit…</Btn>}>
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {p.note ? <Bar tone={p.runs.err ? 'warn' : 'info'} multiline>{p.note}</Bar> : null}
          <Facts
            labelW={150}
            items={[
              { k: 'Applies to', v: `${p.match} → ${p.dest}` },
              { k: 'Default for', v: p.defaultFor || 'Not a default; choose it on the server', muted: !p.defaultFor },
              { k: 'Servers using it', v: using.length ? using.map(v => v.name).join(', ') : 'None yet', muted: !using.length },
              { k: 'Last 30 days', v: `${p.runs.ok} converted · ${p.runs.warn} with warnings · ${p.runs.err} failed`, icon: p.runs.err ? 'triangle-alert' : 'circle-check', tone: p.runs.err ? 'warn' : 'ok' }
            ]}
          />
          <MiniTable
            label="Steps"
            cols={[{ label: '#', w: '28px' }, { label: 'Step', w: 'minmax(200px,1fr)' }, { label: 'Detail', w: 'minmax(200px,1.3fr)' }, { label: '', w: '96px' }]}
            rows={p.steps.map((s, i) => [String(i + 1), <span key="n" style={{ color: s.on ? 'var(--tx)' : 'var(--tx-3)' }}>{s.name}</span>, <span key="d" style={{ color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={s.detail}>{s.detail}</span>, s.locked ? <Status key="s" icon="pin" tone="tx" label="Required" tip="The server does not boot on the destination without it" /> : s.on ? <Status key="s" icon="check" tone="ok" label="On" /> : <span key="s" style={{ color: 'var(--tx-3)' }}>Off</span>])}
          />
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Steps run on a copy of the disks during the first sync and again before cutover. The source server is never changed, so a rollback starts the original unchanged.</p>
        </div>
      </Panel>
      {edit.value ? <ProfileDialog ctx={ctx} p={edit.value} isNew={!list.some(x => x.id === edit.value!.id)} closing={edit.closing} onClose={edit.close} onSave={save} /> : null}
    </div>
  );
}

function ProfileDialog({ ctx, p, isNew, closing, onClose, onSave }: { ctx: Ctx; p: Profile; isNew: boolean; closing: boolean; onClose: () => void; onSave: (p: Profile) => void }) {
  const [name, setName] = useState(p.name);
  const [steps, setSteps] = useState(p.steps);
  const [virtio, setVirtio] = useState(p.id === 'legacy' ? VIRTIO[2] : VIRTIO[0]);
  const changed = isNew || name !== p.name || JSON.stringify(steps) !== JSON.stringify(p.steps) || virtio !== (p.id === 'legacy' ? VIRTIO[2] : VIRTIO[0]);
  const err = name.trim().length < 6 ? 'Name the profile.' : !changed ? 'Nothing changed.' : null;
  return (
    <Dialog
      size="lg"
      title={isNew ? 'New transformation profile' : `Edit ${p.name}`}
      sub="Saving makes a new version. Servers already syncing keep the version they started with; the next sync pass of a server not yet cut over uses the new one."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="check" disabled={!!err} why={err || undefined} perm={ctx.can('configure', 'Changing transformation profiles')} onClick={() => onSave({ ...p, name: name.trim(), steps: steps.map(s => (s.id === 'v' ? { ...s, detail: s.detail.replace(/VirtIO [\d.]+/, `VirtIO ${virtio.split(' ')[0]}`) } : s)), version: isNew ? 1 : p.version + 1 })}>
            {isNew ? 'Create profile' : `Save as version ${p.version + 1}`}
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: p.os === 'Windows' ? 'minmax(0,1fr) 220px' : 'minmax(0,1fr)', gap: 16 }}>
        <Field id="pf-n" label="Name"><TextInput id="pf-n" value={name} onChange={setName} /></Field>
        {p.os === 'Windows' ? <Field id="pf-v" label="VirtIO driver version"><SelectInput id="pf-v" value={virtio} onChange={setVirtio} options={VIRTIO} /></Field> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)' }}>
        {steps.map(s => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--ln)' }}>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span>{s.name}</span>
              <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{s.locked ? 'Required. ' : ''}{s.detail}</span>
            </span>
            {s.locked ? <Status icon="pin" tone="tx" label="Required" /> : <Toggle on={s.on} label={s.name} onChange={v => setSteps(x => x.map(y => (y.id === s.id ? { ...y, on: v } : y)))} />}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
