import { useState } from 'react';
import { Btn, Field, SelectInput, TextInput, Toggle } from '../ui/controls';
import { Bar, MiniTable, Panel, Status } from '../ui/layout';
import { Dialog, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit } from './store';

/** How changed blocks are found on each platform. One layer reads them for backup, replication and migration alike. */
const TRACKING: { platform: string; how: string; fallback: string; used: string; sites: string; resets: string; tone: 'ok' | 'warn' | 'tx' }[] = [
  { platform: 'Proxmox VE (QEMU)', how: 'Persistent dirty bitmaps', fallback: 'Full read when a bitmap is lost (VM stopped or moved)', used: 'Backup, DR, Migration', sites: 'Chennai-proxmox-prod, Chennai_Lab_Proxmox', resets: '3 in 7 days: VMs moved between nodes', tone: 'warn' },
  { platform: 'Proxmox VE on ZFS', how: 'zfs send -i between snapshots', fallback: 'Dirty bitmaps', used: 'Backup', sites: 'Chennai_Lab_Proxmox', resets: 'None', tone: 'ok' },
  { platform: 'OpenStack on Ceph', how: 'RBD export-diff, read from the Ceph cluster', fallback: 'Cinder snapshot and full read', used: 'Backup, DR', sites: 'production-openstack', resets: 'None', tone: 'ok' },
  { platform: 'VMware vSphere', how: 'Changed Block Tracking through VDDK', fallback: 'Full read with a CBT reset alert', used: 'DR, Migration', sites: 'Chennai vCenter, esxi-edge-07', resets: '1: CBT reset on SQL01 after a storage vMotion', tone: 'warn' },
  { platform: 'Microsoft Hyper-V', how: 'Resilient Change Tracking (RCT)', fallback: 'Full read', used: 'Backup, DR, Migration', sites: 'None connected', resets: '—', tone: 'tx' },
  { platform: 'Nutanix AHV', how: 'Changed Region Tracking through Prism v4', fallback: 'Full read when CRT is unavailable', used: 'Backup, DR, Migration', sites: 'None connected', resets: '—', tone: 'tx' },
  { platform: 'Agents (Windows, Linux, macOS)', how: 'Aegis changed-block filter driver', fallback: 'Full read after an unclean shutdown', used: 'Backup, DR, Migration', sites: '18 agents', resets: '2: unclean shutdowns on laptops', tone: 'ok' }
];
interface Defaults { compression: string; inTransit: string; wan: boolean; checkpoint: string; resume: string; streams: string }

/** Settings › Data movement: the one layer that reads changed blocks and moves them, for all three products. */
export function DataMovementTab({ ctx }: { ctx: Ctx }) {
  const [d, setD] = useState<Defaults>({ compression: 'zstd, level 3', inTransit: 'TLS 1.3 to repositories; SSH tunnel (ChaCha20-Poly1305) between sites', wan: true, checkpoint: '256 MB', resume: '24 h', streams: '4 per disk' });
  const edit = useClosable<boolean>();
  const cfg = ctx.can('admin', 'Changing data movement defaults');
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Bar tone="info" multiline>Backup writes changed blocks to a repository, replication to a replica, migration to a target. Below that line the work is the same, so one layer does it for every product: one change-tracking method per platform, one throttle per source and one set of defaults.</Bar>
      <Panel title="Change tracking by platform">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Change tracking"
            cols={[{ label: 'Platform', w: '190px' }, { label: 'Method', w: 'minmax(0,1fr)' }, { label: 'If it is lost', w: 'minmax(0,1fr)' }, { label: 'Used by', w: '140px' }, { label: 'Last 7 days', w: '180px' }]}
            rows={TRACKING.map(t => [
              <strong key="p" style={{ fontWeight: 600 }} data-tip={t.sites}>{t.platform}</strong>,
              <span key="h" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={t.how} data-tip-overflow="">{t.how}</span>,
              <span key="f" style={{ color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={t.fallback} data-tip-overflow="">{t.fallback}</span>,
              t.used,
              t.tone === 'tx' ? <span key="r" style={{ color: 'var(--tx-3)' }}>Not connected</span> : <Status key="r" icon={t.tone === 'ok' ? 'circle-check' : 'triangle-alert'} tone={t.tone} label={t.resets === 'None' ? 'No resets' : t.resets.split(':')[0]} tip={t.resets} />
            ])}
          />
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>A lost bitmap or a CBT reset never produces a silent gap: the next run reads the whole disk and the recovery point says why.</p>
        </div>
      </Panel>
      <Panel title="Defaults for every transfer" right={<Btn kind="outline" size="sm" icon="pencil" perm={cfg} onClick={() => edit.open(true)}>Edit…</Btn>}>
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Transfer defaults"
            cols={[{ label: 'Setting', w: '220px' }, { label: 'Value' }]}
            rows={[
              ['Compression', d.compression],
              ['Encryption in transit', d.inTransit],
              ['WAN optimisation', d.wan ? 'On for copies, replication and migration between sites: only blocks the destination lacks are sent' : 'Off'],
              ['Checkpoint', `Every ${d.checkpoint}; an interrupted transfer resumes from the last checkpoint`],
              ['Resume window', `${d.resume}; after that the transfer starts again`],
              ['Parallel streams', d.streams],
              ['Throttling', 'Per source in Settings › Source impact; per repository and per workload in their policies']
            ]}
          />
        </div>
      </Panel>
      {edit.value ? (
        <DefaultsDialog
          d={d}
          closing={edit.closing}
          onClose={edit.close}
          onSave={n => {
            setD(n);
            audit({ who: 'priya.raman', customer: 'h360', what: 'Changed data movement defaults', object: 'Every product', when: ctx.now(), r: 'ok', after: [['Compression', n.compression], ['WAN optimisation', n.wan ? 'On' : 'Off'], ['Checkpoint', n.checkpoint]] });
            ctx.toast('Defaults saved; transfers already running keep their settings', 'ok');
            edit.close();
          }}
        />
      ) : null}
    </div>
  );
}

function DefaultsDialog({ d, closing, onClose, onSave }: { d: Defaults; closing: boolean; onClose: () => void; onSave: (d: Defaults) => void }) {
  const [n, setN] = useState(d);
  return (
    <Dialog title="Transfer defaults" sub="Apply to new backup, replication and migration transfers in every product." closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={JSON.stringify(n) === JSON.stringify(d)} why="Nothing changed." onClick={() => onSave(n)}>Save</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="dm-c" label="Compression"><SelectInput id="dm-c" value={n.compression} onChange={v => setN(x => ({ ...x, compression: v }))} options={['zstd, level 1', 'zstd, level 3', 'zstd, level 9', 'lz4', 'Off']} /></Field>
        <Field id="dm-s" label="Parallel streams"><SelectInput id="dm-s" value={n.streams} onChange={v => setN(x => ({ ...x, streams: v }))} options={['2 per disk', '4 per disk', '8 per disk']} /></Field>
        <Field id="dm-k" label="Checkpoint every"><SelectInput id="dm-k" value={n.checkpoint} onChange={v => setN(x => ({ ...x, checkpoint: v }))} options={['64 MB', '256 MB', '1 GB']} /></Field>
        <Field id="dm-r" label="Resume window"><TextInput id="dm-r" value={n.resume} onChange={v => setN(x => ({ ...x, resume: v }))} /></Field>
      </div>
      <Toggle on={n.wan} onChange={v => setN(x => ({ ...x, wan: v }))} label="WAN optimisation">WAN optimisation between sites</Toggle>
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Encryption in transit cannot be turned off.</p>
    </Dialog>
  );
}
