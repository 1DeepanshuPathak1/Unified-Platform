import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Btn, Field, RadioCard, Seg, SelectInput, TextInput } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, Progress, Spacer, TableArea, Tiles, Toolbar } from '../../ui/layout';
import { Dialog, Drawer, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope, scopeCustomers } from '../../platform/common';
import { audit } from '../../platform/store';
import { SeedView } from '../../platform/Seeding';
import { CATALOGUES } from '../protection/ForeignBackups';
import { WAVES } from './data';

type Format = 'OVA' | 'OVF' | 'VMDK' | 'VHD' | 'VHDX' | 'qcow2' | 'RAW';
type ImgState = 'Ready' | 'Checking' | 'Failed' | 'Added to a wave';
type Img = { id: string; name: string; format: Format; gb: number; virtGb: number; customer: string; from: string; os: string; boot: string; disks: number; sum: string; state: ImgState; pct?: number; note?: string; wave?: string };

const EXT: Record<string, Format> = { ova: 'OVA', ovf: 'OVF', vmdk: 'VMDK', vhd: 'VHD', vhdx: 'VHDX', qcow2: 'qcow2', img: 'RAW', raw: 'RAW' };
const fmtOf = (n: string): Format | null => EXT[n.trim().toLowerCase().split('.').pop() || ''] || null;
const SUM_NOTE: Record<Format, string> = { OVA: 'Checked against the manifest (.mf) inside the OVA', OVF: 'Checked against the manifest (.mf) next to the OVF', VMDK: 'SHA-256 you give, or none', VHD: 'SHA-256 you give; the VHD footer checksum is always checked', VHDX: 'SHA-256 you give; VHDX metadata checksums are always checked', qcow2: 'SHA-256 you give, or none', RAW: 'SHA-256 you give, or none' };

const IMAGES: Img[] = [
  { id: 'im-1', name: 'legacy-billing.ova', format: 'OVA', gb: 42.6, virtGb: 120, customer: 'h360', from: 'Upload from the browser (resumable)', os: 'CentOS 7.9', boot: 'BIOS', disks: 2, sum: 'Matches the manifest (SHA-256)', state: 'Ready' },
  { id: 'im-2', name: 'kav-scanner-gw.vhdx', format: 'VHDX', gb: 18.2, virtGb: 64, customer: 'kav', from: 's3://kav-exports/hyperv/', os: 'Windows Server 2016', boot: 'UEFI (Hyper-V generation 2)', disks: 1, sum: 'Matches 4f0c…9a21', state: 'Added to a wave', wave: 'Kaveri warehouse systems' },
  { id: 'im-3', name: 'mer-hsm-mgmt.vmdk', format: 'VMDK', gb: 6.1, virtGb: 40, customer: 'mer', from: 'Upload from the browser (resumable)', os: 'Not read yet', boot: '—', disks: 1, sum: 'Does not match', state: 'Failed', note: 'The checksum does not match: the upload stopped at 6.1 of 7.9 GB when the browser was closed. Resume the upload; the 6.1 GB already sent is kept.' },
  { id: 'im-4', name: 'sah-lab-ubuntu.qcow2', format: 'qcow2', gb: 11.4, virtGb: 80, customer: 'sah', from: 'From seed disk SD-0411', os: 'Ubuntu 22.04', boot: 'UEFI', disks: 1, sum: 'Checking', state: 'Checking', pct: 62 },
  { id: 'im-5', name: 'atl-plc-gateway.raw', format: 'RAW', gb: 64, virtGb: 64, customer: 'atl', from: 's3://atl-fra-migration/images/', os: 'Debian 11', boot: 'BIOS', disks: 1, sum: 'Not given', state: 'Ready', note: 'No checksum was given, so the image was only checked for a readable partition table and file system.' }
];
const ST: Record<ImgState, { i: string; c: string }> = { Ready: { i: 'circle-check', c: 'ok' }, Checking: { i: 'loader-circle', c: 'run' }, Failed: { i: 'circle-x', c: 'err' }, 'Added to a wave': { i: 'list-ordered', c: 'tx' } };

/** Machines that can be built from a backup instead of being read from production. */
type BackupSrc = { id: string; name: string; os: string; customer: string; from: string; vendor: string; newest: string; gb: number; native: boolean };
const AEGIS_BACKUPS: BackupSrc[] = [
  { id: 'bk-web1', name: 'web-frontend-01', os: 'Ubuntu 24.04', customer: 'h360', from: 'Aegis Protection · obj-check', vendor: 'Aegis', newest: '21 Oct, 02:00', gb: 48, native: true },
  { id: 'bk-git', name: 'gitlab-01', os: 'Ubuntu 22.04', customer: 'h360', from: 'Aegis Protection · obj-check', vendor: 'Aegis', newest: '21 Oct, 02:00', gb: 310, native: true },
  { id: 'bk-mon', name: 'monitoring-01', os: 'Rocky Linux 9', customer: 'h360', from: 'Aegis Protection · obj-check', vendor: 'Aegis', newest: '21 Oct, 02:00', gb: 96, native: true }
];
const backupSources = (): BackupSrc[] => [
  ...AEGIS_BACKUPS,
  ...CATALOGUES.filter(c => c.machines.length).flatMap(c => c.machines.map((m, i) => ({ id: `${c.id}-${i}`, name: m.name, os: m.os, customer: c.customer, from: `${c.product} · ${c.location}`, vendor: c.vendor, newest: m.newest, gb: m.gb, native: false })))
];

/** Mobility › Sources › Images and backups: disk images, machines built from a backup, and seed disks. */
export function ImagesView({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<'images' | 'backups' | 'seeds'>(ctx.openId === 'backups' || ctx.openId === 'seeds' ? ctx.openId : 'images');
  return (
    <>
      <Toolbar style={{ paddingTop: 0 }}>
        <Seg label="Images and backups" value={view} onChange={v => setView(v as typeof view)} options={[{ v: 'images', label: 'Disk images' }, { v: 'backups', label: 'From a backup' }, { v: 'seeds', label: 'Seed disks' }]} />
      </Toolbar>
      <div key={view} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-fade 150ms var(--ease)' }}>
        {view === 'images' ? <ImageList ctx={ctx} /> : view === 'backups' ? <BackupList ctx={ctx} /> : <SeedView ctx={ctx} product="Mobility" />}
      </div>
    </>
  );
}

function ImageList({ ctx }: { ctx: Ctx }) {
  const [imgs, setImgs] = useState<Img[]>(IMAGES);
  const drawer = useClosable<string>();
  const add = useClosable<boolean>();
  const wave = useClosable<string>();
  const mine = imgs.filter(i => inScope(ctx, i.customer));
  const d = drawer.value ? mine.find(i => i.id === drawer.value) : null;
  const patch = (id: string, p: Partial<Img>) => setImgs(x => x.map(y => (y.id === id ? { ...y, ...p } : y)));
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Images', value: String(mine.length), icon: 'disc', sub: 'OVA, OVF, VMDK, VHD, VHDX, qcow2 and RAW' },
            { label: 'Ready to move', value: String(mine.filter(i => i.state === 'Ready').length), icon: 'circle-check', tone: 'ok', sub: 'Checked and read; can join a wave' },
            { label: 'Failed checks', value: String(mine.filter(i => i.state === 'Failed').length), icon: 'circle-x', tone: mine.some(i => i.state === 'Failed') ? 'err' : undefined, sub: 'Checksum or format problems' }
          ]}
        />
      </div>
      <Toolbar>
        <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>For sources Aegis cannot reach: air-gapped sites, appliances and exports from other tools.</span>
        <Spacer />
        <Btn kind="primary" icon="upload" perm={ctx.can('configure', 'Importing images')} onClick={() => add.open(true)}>Import an image…</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Disk images"
          cols={[
            { k: 'n', label: 'Image', w: 'minmax(180px,1.4fr)' },
            { k: 'f', label: 'Format', w: '80px' },
            { k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true },
            { k: 'os', label: 'Read inside', w: 'minmax(150px,1fr)', dim: true },
            { k: 'gb', label: 'Size', w: '90px', r: true },
            { k: 'sum', label: 'Checksum', w: 'minmax(150px,1fr)', dim: true },
            { k: 's', label: 'State', w: '170px' }
          ]}
          rows={mine.map(i => ({
            id: i.id,
            n: { v: i.name, strong: true, tip: i.from },
            f: i.format,
            c: custName(i.customer),
            os: { v: i.os, muted: i.os === 'Not read yet' },
            gb: { v: `${i.gb.toFixed(1)} GB`, s: i.gb, tip: `${i.virtGb} GB provisioned` },
            sum: i.sum,
            s: { t: 'status', i: ST[i.state].i, c: ST[i.state].c, l: i.state === 'Checking' ? `Checking · ${i.pct}%` : i.state === 'Added to a wave' ? `In ${i.wave}` : i.state, tip: i.note }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['image', 'images']}
          emptyText="No images yet. Import an OVA, VMDK, VHD, VHDX, qcow2 or RAW file when a source cannot be reached directly."
          footR="Images are kept 30 days after their wave finishes"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Disk image"
          kicker={`Disk image · ${custName(d.customer)}`}
          title={d.name}
          status={<><span>{d.format}</span><span>{d.state}</span></>}
          closing={drawer.closing}
          onClose={drawer.close}
          actions={
            d.state === 'Failed' ? (
              <Btn kind="primary" icon="refresh-cw" perm={ctx.can('configure', 'Importing images')} onClick={() => { patch(d.id, { state: 'Checking', pct: 78, sum: 'Checking', note: undefined }); ctx.toast(`${d.name}: upload resumed from 6.1 GB`, 'ok'); }}>Resume the upload</Btn>
            ) : d.state === 'Ready' ? (
              <Btn kind="primary" icon="list-ordered" perm={ctx.can('configure', 'Planning waves')} onClick={() => wave.open(d.id)}>Add to a wave…</Btn>
            ) : null
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.note ? <Bar tone={d.state === 'Failed' ? 'err' : 'info'} multiline>{d.note}</Bar> : null}
            {d.state === 'Checking' ? <Progress pct={d.pct || 0} /> : null}
            <DrawerTiles items={[{ label: 'File', value: `${d.gb.toFixed(1)} GB` }, { label: 'Provisioned', value: `${d.virtGb} GB`, sub: 'Kept thin at the target' }, { label: 'Disks', value: String(d.disks) }]} />
            <Facts
              items={[
                { k: 'Format', v: `${d.format}${d.format === 'VMDK' ? ' (stream-optimised)' : ''}` },
                { k: 'Checksum', v: `${d.sum}. ${SUM_NOTE[d.format]}` },
                { k: 'Read inside', v: `${d.os} · ${d.boot}` },
                { k: 'Came from', v: d.from },
                { k: 'Converted to', v: 'qcow2 for OpenStack (Glance) or a raw volume on Ceph; qcow2 on Proxmox VE' },
                { k: 'Then', v: 'The transformation profile runs on first boot, as for any other source: drivers, agents, network' }
              ]}
            />
          </div>
        </Drawer>
      ) : null}
      {add.value ? (
        <ImportImageDialog
          ctx={ctx}
          closing={add.closing}
          onClose={add.close}
          onDone={i => {
            setImgs(x => [i, ...x]);
            add.close();
            drawer.open(i.id);
          }}
        />
      ) : null}
      {wave.value ? (
        <AddToWaveDialog
          ctx={ctx}
          img={mine.find(i => i.id === wave.value)!}
          closing={wave.closing}
          onClose={wave.close}
          onDone={w => {
            patch(wave.value!, { state: 'Added to a wave', wave: w });
            wave.close();
          }}
        />
      ) : null}
    </>
  );
}

function ImportImageDialog({ ctx, closing, onClose, onDone }: { ctx: Ctx; closing: boolean; onClose: () => void; onDone: (i: Img) => void }) {
  const custs = scopeCustomers(ctx);
  const [how, setHow] = useState<'upload' | 's3' | 'disk'>('upload');
  const [file, setFile] = useState('');
  const [url, setUrl] = useState('');
  const [sum, setSum] = useState('');
  const [cust, setCust] = useState(custs[0]);
  const [profile, setProfile] = useState('Detect from the image');
  const fmt = fmtOf(how === 's3' ? url : file);
  const sumOk = !sum.trim() || /^[0-9a-f]{64}$/i.test(sum.trim());
  const urlOk = /^s3:\/\/[\w.-]+\/.+\.\w+$/.test(url.trim());
  const err =
    how === 's3'
      ? !urlOk ? 'Write the object as s3://bucket/path/file.ova.' : !fmt ? 'The file must end in .ova, .ovf, .vmdk, .vhd, .vhdx, .qcow2, .img or .raw.' : !sumOk ? 'A SHA-256 is 64 hexadecimal characters.' : null
      : !file.trim() ? (how === 'disk' ? 'Give the file name on the seed disk.' : 'Choose the file to upload.') : !fmt ? 'The file must end in .ova, .ovf, .vmdk, .vhd, .vhdx, .qcow2, .img or .raw.' : !sumOk ? 'A SHA-256 is 64 hexadecimal characters.' : null;
  const go = () => {
    const name = (how === 's3' ? url.trim().split('/').pop() : file.trim().split(/[\\/]/).pop()) || 'image';
    const i: Img = { id: 'im-' + Date.now(), name, format: fmt!, gb: 24, virtGb: 60, customer: cust, from: how === 'upload' ? 'Upload from the browser (resumable)' : how === 's3' ? url.trim() : 'From seed disk SD-0417', os: 'Reading…', boot: '—', disks: 1, sum: fmt === 'OVA' || fmt === 'OVF' ? 'Checking against the manifest' : sum.trim() ? 'Checking' : 'Not given', state: 'Checking', pct: 3 };
    audit({ who: 'priya.raman', customer: cust, what: 'Imported a disk image', object: name, when: ctx.now(), r: 'ok', after: [['Format', fmt!], ['From', i.from], ['Profile', profile]] });
    ctx.toast(`${name}: import started; the checksum and the contents are checked first`, 'ok');
    onDone(i);
  };
  return (
    <Dialog
      size="lg"
      title="Import a disk image"
      sub="For servers Aegis cannot read directly. The image is checked, read and converted, then moves like any other server."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="upload" disabled={!!err} why={err || undefined} perm={ctx.can('configure', 'Importing images')} onClick={go}>Import</Btn>
        </>
      }
    >
      <div role="radiogroup" aria-label="From" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        <RadioCard on={how === 'upload'} onClick={() => setHow('upload')} icon="upload" title="Upload from this browser" note="Resumable; up to 2 TB a file." />
        <RadioCard on={how === 's3'} onClick={() => setHow('s3')} icon="cloud" title="From object storage" note="An S3-compatible bucket the customer controls." />
        <RadioCard on={how === 'disk'} onClick={() => setHow('disk')} icon="hard-drive" title="From a seed disk" note="Files on a disk already imported in Seed disks." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        {how === 's3' ? (
          <Field id="ii-u" label="Object" span={2} hint="Read with a read-only access key, kept in Settings › Keys." err={url && !urlOk ? 'Write it as s3://bucket/path/file.ova.' : null}>
            <TextInput id="ii-u" value={url} onChange={setUrl} placeholder="s3://kav-exports/hyperv/kav-scanner-gw.vhdx" mono />
          </Field>
        ) : (
          <Field id="ii-f" label={how === 'disk' ? 'File on the seed disk' : 'File'} span={2} hint={fmt ? `Read as ${fmt}` : 'OVA, OVF, VMDK, VHD, VHDX, qcow2 or RAW (.img, .raw)'}>
            <TextInput id="ii-f" value={file} onChange={setFile} placeholder={how === 'disk' ? '/images/legacy-billing.ova' : 'legacy-billing.ova'} mono />
          </Field>
        )}
        <Field id="ii-s" label="SHA-256" hint={fmt ? SUM_NOTE[fmt] : 'Optional; OVA and OVF carry their own manifest'} err={sumOk ? null : 'A SHA-256 is 64 hexadecimal characters.'}>
          <TextInput id="ii-s" value={sum} onChange={setSum} placeholder="Optional" mono />
        </Field>
        <Field id="ii-c" label="Customer">
          <SelectInput id="ii-c" value={cust} onChange={setCust} options={custs.map(c => ({ v: c, label: custName(c) }))} />
        </Field>
        <Field id="ii-p" label="Transformation profile" span={2}>
          <SelectInput id="ii-p" value={profile} onChange={setProfile} options={['Detect from the image', 'Standard Windows', 'Standard Linux', 'Legacy Windows (2008 R2 and 2012)']} />
        </Field>
      </div>
      <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Checked before anything else: the checksum, then the partition table and file systems. A failed check leaves the file in place so the upload can resume.</span>
    </Dialog>
  );
}

function AddToWaveDialog({ ctx, img, closing, onClose, onDone }: { ctx: Ctx; img: Img; closing: boolean; onClose: () => void; onDone: (wave: string) => void }) {
  const ws = WAVES.filter(w => w.customer === img.customer && w.state !== 'done');
  const [w, setW] = useState(ws[0]?.name || '');
  return (
    <Dialog
      title={`Add ${img.name} to a wave`}
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="check" disabled={!w} why={ws.length ? undefined : 'This customer has no open wave; create one in Plans.'} onClick={() => { audit({ who: 'priya.raman', customer: img.customer, what: 'Added a disk image to a wave', object: img.name, when: ctx.now(), r: 'ok', after: [['Wave', w]] }); ctx.toast(`${img.name} added to ${w}`, 'ok'); onDone(w); }}>Add</Btn>
        </>
      }
    >
      {ws.length ? (
        <Field id="aw-w" label="Wave">
          <SelectInput id="aw-w" value={w} onChange={setW} options={ws.map(x => ({ v: x.name, label: `${x.name}${x.window ? ` · ${x.window}` : ''}` }))} />
        </Field>
      ) : (
        <Bar tone="info" multiline>{custName(img.customer)} has no open wave. Create one in Migration plans first.</Bar>
      )}
      <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>An image has no source to sync from, so its cutover is the image itself: there is no final sync and no rollback to a running source.</span>
    </Dialog>
  );
}

function BackupList({ ctx }: { ctx: Ctx }) {
  const [vendor, setVendor] = useState('all');
  const build = useClosable<string>();
  const all = backupSources().filter(b => inScope(ctx, b.customer));
  const rows = all.filter(b => vendor === 'all' || b.vendor === vendor);
  const vendors = [...new Set(all.map(b => b.vendor))];
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Bar tone="info" multiline>Build the target from a backup instead of reading production: no agent, no snapshot on the source, no load in business hours. At cutover only the changes since the backup are read from the source, or none if the server is being retired.</Bar>
      </div>
      <Toolbar>
        <Seg label="Backup vendor" value={vendor} onChange={setVendor} options={[{ v: 'all', label: 'All' }, ...vendors.map(v => ({ v, label: v, count: all.filter(b => b.vendor === v).length }))]} />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Machines with a backup"
          cols={[
            { k: 'n', label: 'Machine', w: 'minmax(160px,1.2fr)' },
            { k: 'os', label: 'Operating system', w: 'minmax(160px,1.2fr)', dim: true },
            { k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true },
            { k: 'f', label: 'Backup', w: 'minmax(200px,1.6fr)', dim: true },
            { k: 'p', label: 'Newest point', w: '120px' },
            { k: 'gb', label: 'Size', w: '84px', r: true }
          ]}
          rows={rows.map(b => ({ id: b.id, n: { v: b.name, strong: true }, os: b.os, c: custName(b.customer), f: { v: b.from, tip: b.from }, p: b.newest, gb: { v: b.gb >= 1024 ? `${(b.gb / 1024).toFixed(1)} TB` : `${b.gb} GB`, s: b.gb } }))}
          onRow={(id: string) => build.open(id)}
          active={build.value}
          state={ctx.ui}
          unit={['machine', 'machines']}
          emptyText="No backups to build from. Aegis Protection backups appear here, and so do other vendors’ backups read in Protection › Protected guests."
          footR="Click a machine to build its target from the backup"
        />
      </TableArea>
      {build.value ? <BuildFromBackupDialog ctx={ctx} src={all.find(b => b.id === build.value)!} closing={build.closing} onClose={build.close} /> : null}
    </>
  );
}

function BuildFromBackupDialog({ ctx, src, closing, onClose }: { ctx: Ctx; src: BackupSrc; closing: boolean; onClose: () => void }) {
  const [pt, setPt] = useState(src.newest);
  const [final, setFinal] = useState<'delta' | 'none'>('delta');
  const [dest, setDest] = useState('production-openstack');
  const ws = WAVES.filter(w => w.customer === src.customer && w.state !== 'done');
  const [wave, setWave] = useState(ws[0]?.name || 'Not in a wave yet');
  const go = () => {
    ctx.startJob({ name: 'Build target from a backup', object: src.name, product: 'Migration', phases: ['Read the backup', 'Convert disks', 'Inject drivers', 'Test boot', 'Ready for cutover'], speed: 9, doneToast: `${src.name}: target built from the ${src.vendor} backup of ${pt}; ready for its wave` });
    audit({ who: 'priya.raman', customer: src.customer, what: 'Started building a migration target from a backup', object: src.name, when: ctx.now(), r: 'ok', after: [['Backup', `${src.from} · ${pt}`], ['At cutover', final === 'delta' ? 'Changes since the backup from the source' : 'None: the backup is the final copy'], ['Destination', dest], ['Wave', wave]] });
    onClose();
  };
  return (
    <Dialog
      size="lg"
      title={`Build ${src.name} from a backup`}
      sub={src.from}
      closing={closing}
      onClose={onClose}
      footNote="The source server is not touched until cutover, and then only if you choose to send the changes."
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="play" perm={ctx.can('operate', 'Starting migrations')} onClick={go}>Build the target</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="bb-p" label="Backup point">
          <SelectInput id="bb-p" value={pt} onChange={setPt} options={[src.newest, ...(src.native ? ['20 Oct, 02:00', '19 Oct, 02:00'] : ['19 Oct, 23:00', '18 Oct, 23:00'])]} />
        </Field>
        <Field id="bb-d" label="Destination">
          <SelectInput id="bb-d" value={dest} onChange={setDest} options={['production-openstack', 'Chennai-proxmox-prod', 'region-2-os']} />
        </Field>
        <Field id="bb-w" label="Wave" span={2}>
          <SelectInput id="bb-w" value={wave} onChange={setWave} options={[...ws.map(w => w.name), 'Not in a wave yet']} />
        </Field>
      </div>
      <div role="radiogroup" aria-label="At cutover" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={final === 'delta'} onClick={() => setFinal('delta')} icon="refresh-cw" title="Send the changes since the backup" note={src.native ? 'Read from the source with change tracking; usually minutes.' : 'Read from the source with the Aegis agent or the hypervisor API; the backup vendor is not involved.'} />
        <RadioCard on={final === 'none'} onClick={() => setFinal('none')} icon="archive" title="The backup is the final copy" note="For servers being retired or frozen: anything written after the backup is not moved." />
      </div>
      {final === 'none' ? <Bar tone="warn" multiline>Anything written to {src.name} after {pt} will not reach the target. Use this only for servers that are read-only or switched off.</Bar> : null}
      <Facts items={[{ k: 'Load on production', v: final === 'delta' ? 'None until cutover; then one changed-block read' : 'None' }, { k: 'Size', v: src.gb >= 1024 ? `${(src.gb / 1024).toFixed(1)} TB` : `${src.gb} GB` }, { k: 'Conversion', v: /windows/i.test(src.os) ? 'Standard Windows profile: VirtIO drivers, cloudbase-init' : 'Standard Linux profile: virtio initramfs, cloud-init' }]} />
    </Dialog>
  );
}
