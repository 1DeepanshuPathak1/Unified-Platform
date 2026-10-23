import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Btn, Field, RadioCard, Seg, SelectInput, TextInput } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Spacer, TableArea, Tiles, Toolbar } from '../../ui/layout';
import { Dialog, Drawer, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope, scopeCustomers } from '../../platform/common';
import { audit } from '../../platform/store';

type Vendor = 'Veeam' | 'Commvault' | 'Acronis' | 'NetBackup' | 'Rubrik';
type CatState = 'Indexed' | 'Indexing' | 'Waiting on you' | 'Through the vendor API';
export type ForeignMachine = { name: string; os: string; gb: number; points: number; newest: string; oldest: string };
export type Catalogue = { id: string; vendor: Vendor; product: string; customer: string; location: string; how: string; machines: ForeignMachine[]; more: number; points: number; tb: number; oldest: string; state: CatState; pct?: number; keep: string; enc: string; note?: string };

const VENDOR: Record<Vendor, { title: string; note: string; reads: string; loc: string; re: RegExp; locHint: string }> = {
  Veeam: { title: 'Veeam Backup & Replication', note: 'VBK, VIB and VRB chains on SMB, NFS, a hardened Linux repository or S3.', reads: 'Reads the backup files directly; no Veeam server or licence needed.', loc: '\\\\mer-veeam-repo01\\Backups', re: /^(\\\\[\w.-]+\\[\w$ .-]+|s3:\/\/[\w.-]+(\/[\w.-]+)*|[\w.-]+:\/[\w/.-]+)$/, locHint: 'An SMB share, an NFS export (host:/path) or s3://bucket/prefix' },
  Commvault: { title: 'Commvault', note: 'Disk libraries read through a media agent, and the CommServe catalogue.', reads: 'Needs read access to the CommServe API to map chunks to clients.', loc: 'https://cv-commserve.chennai.local', re: /^https:\/\/[\w.-]+(:\d+)?(\/.*)?$/, locHint: 'The CommServe web address' },
  Acronis: { title: 'Acronis Cyber Protect', note: 'TIBX archives on a share, a NAS or Acronis Cloud Storage.', reads: 'Reads the archives directly; the archive password is asked once.', loc: 'kav-nas-02:/acronis', re: /^(\\\\[\w.-]+\\[\w$ .-]+|[\w.-]+:\/[\w/.-]+)$/, locHint: 'An SMB share or an NFS export (host:/path)' },
  NetBackup: { title: 'Veritas NetBackup', note: 'Images exported from MSDP to a basic disk or tape with bpduplicate.', reads: 'Deduplicated MSDP pools cannot be read directly; NetBackup exports the images first.', loc: '\\\\sah-nbu-export\\images', re: /^(\\\\[\w.-]+\\[\w$ .-]+|[\w.-]+:\/[\w/.-]+)$/, locHint: 'The share the images are exported to' },
  Rubrik: { title: 'Rubrik CDM', note: 'Snapshots read through the Rubrik API while the cluster is still running.', reads: 'Rubrik archives are encrypted with a key only the cluster holds, so they are read through its API.', loc: 'https://rubrik-fra.atlas-freight.de', re: /^https:\/\/[\w.-]+(:\d+)?(\/.*)?$/, locHint: 'The Rubrik cluster address' }
};
const VENDORS = Object.keys(VENDOR) as Vendor[];

export const CATALOGUES: Catalogue[] = [
  {
    id: 'fc-1', vendor: 'Veeam', product: 'Veeam Backup & Replication 12.1', customer: 'mer', location: '\\\\mer-veeam-repo01\\Backups (SMB 3.1)', how: 'Backup files read directly', more: 34, points: 1842, tb: 96.4, oldest: '03 Jan 2023', state: 'Indexed', keep: 'Each point until its original expiry; the last yearly points expire 31 Mar 2033 (RBI 10-year rule)', enc: 'Veeam job password supplied once; kept in Settings › Keys',
    machines: [
      { name: 'MBK-FIN-APP01', os: 'Windows Server 2016', gb: 412, points: 186, newest: '22 Oct, 23:00', oldest: '03 Jan 2023' },
      { name: 'MBK-HR-DB01', os: 'SQL Server 2016 on Windows Server 2016', gb: 1126, points: 214, newest: '22 Oct, 23:00', oldest: '03 Jan 2023' },
      { name: 'MBK-SWIFT-GW', os: 'Red Hat Enterprise Linux 7.9', gb: 96, points: 120, newest: '22 Oct, 23:00', oldest: '11 Jul 2023' },
      { name: 'MBK-LOS-APP02', os: 'Windows Server 2012 R2', gb: 280, points: 186, newest: '22 Oct, 23:00', oldest: '03 Jan 2023' }
    ]
  },
  {
    id: 'fc-2', vendor: 'Commvault', product: 'Commvault 11.32', customer: 'h360', location: 'CV-DL-CHN-01 through media agent cv-ma-02', how: 'Disk library read through the media agent; catalogue from the CommServe API', more: 9, points: 640, tb: 31.8, oldest: '14 Feb 2024', state: 'Indexing', pct: 58, keep: 'Each point until its original expiry', enc: 'Not encrypted at rest by Commvault',
    machines: [
      { name: 'oracle-legacy-01', os: 'Oracle Linux 7.9', gb: 2380, points: 96, newest: '22 Oct, 21:00', oldest: '14 Feb 2024' },
      { name: 'tally-arch-01', os: 'Windows Server 2012 R2', gb: 140, points: 64, newest: '22 Oct, 21:00', oldest: '14 Feb 2024' },
      { name: 'exch-2013-01', os: 'Exchange 2013 on Windows Server 2012 R2', gb: 860, points: 72, newest: '30 Jun 2026, 21:00', oldest: '14 Feb 2024' }
    ]
  },
  {
    id: 'fc-3', vendor: 'Acronis', product: 'Acronis Cyber Protect 16', customer: 'kav', location: 'kav-nas-02:/acronis (NFS 4.1)', how: 'TIBX archives read directly', more: 6, points: 412, tb: 4.6, oldest: '01 Apr 2025', state: 'Indexed', keep: 'Each point until its original expiry', enc: 'Archive password supplied once; kept in Settings › Keys',
    machines: [
      { name: 'kav-scanner-gw', os: 'Windows Server 2016', gb: 64, points: 180, newest: '22 Oct, 22:30', oldest: '01 Apr 2025' },
      { name: 'KAV-DOCK-PC07', os: 'Windows 10 Pro', gb: 210, points: 92, newest: '21 Oct, 19:10', oldest: '01 Apr 2025' },
      { name: 'kav-wms-old', os: 'CentOS 7.9', gb: 340, points: 140, newest: '22 Oct, 22:30', oldest: '01 Apr 2025' }
    ]
  },
  {
    id: 'fc-4', vendor: 'NetBackup', product: 'Veritas NetBackup 10.3', customer: 'sah', location: '\\\\sah-nbu-export\\images', how: 'Images exported from MSDP with bpduplicate', more: 0, points: 0, tb: 0, oldest: '—', state: 'Waiting on you', keep: 'Each point until its original expiry', enc: '—', note: 'The share is empty. NetBackup keeps deduplicated data in its own MSDP pool, so the images must be exported first: run bpduplicate -dstunit sah-nbu-export for the policies to bring over. KB-1188 has the commands.',
    machines: []
  },
  {
    id: 'fc-5', vendor: 'Rubrik', product: 'Rubrik CDM 9.1', customer: 'atl', location: 'https://rubrik-fra.atlas-freight.de', how: 'Read through the Rubrik API while the cluster runs', more: 14, points: 1210, tb: 22.3, oldest: '09 Sep 2024', state: 'Through the vendor API', keep: 'Each point until its original expiry, as long as the Rubrik cluster is running; copy into Aegis to keep them after it is switched off', enc: 'Rubrik holds the key; reads go through its API',
    machines: [
      { name: 'atl-sap-app01', os: 'SUSE Linux Enterprise 15 SP5', gb: 520, points: 168, newest: '22 Oct, 20:00', oldest: '09 Sep 2024' },
      { name: 'atl-tms-db', os: 'PostgreSQL 14 on Debian 11', gb: 380, points: 168, newest: '22 Oct, 20:00', oldest: '09 Sep 2024' }
    ]
  }
];
const ST: Record<CatState, { i: string; c: string }> = { Indexed: { i: 'circle-check', c: 'ok' }, Indexing: { i: 'loader-circle', c: 'run' }, 'Waiting on you': { i: 'hand', c: 'warn' }, 'Through the vendor API': { i: 'link', c: 'tx' } };

/** Protection › Protected guests › Other vendors' backups: Veeam, Commvault, Acronis, NetBackup and Rubrik backups read in place, restored from Aegis and kept until they expire. */
export function ForeignView({ ctx }: { ctx: Ctx }) {
  const [cats, setCats] = useState<Catalogue[]>(CATALOGUES);
  const [vendor, setVendor] = useState<'all' | Vendor>('all');
  const drawer = useClosable<string>();
  const add = useClosable<boolean>();
  const restore = useClosable<string>();
  const keep = useClosable<string>();
  const mine = cats.filter(c => inScope(ctx, c.customer));
  const rows = mine.filter(c => vendor === 'all' || c.vendor === vendor);
  const d = drawer.value ? mine.find(c => c.id === drawer.value) : null;
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Catalogues', value: String(mine.length), icon: 'book-open', sub: `${new Set(mine.map(c => c.vendor)).size} vendors` },
            { label: 'Machines', value: String(mine.reduce((a, c) => a + c.machines.length + c.more, 0)), icon: 'server', sub: 'With points that can be restored from here' },
            { label: 'Points', value: mine.reduce((a, c) => a + c.points, 0).toLocaleString('en-IN'), icon: 'history', sub: `${mine.reduce((a, c) => a + c.tb, 0).toFixed(1)} TB, read in place` },
            { label: 'Waiting on you', value: String(mine.filter(c => c.state === 'Waiting on you').length), icon: 'hand', tone: mine.some(c => c.state === 'Waiting on you') ? 'warn' : undefined, sub: 'An export or a password is missing' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Vendor" value={vendor} onChange={v => setVendor(v as typeof vendor)} options={[{ v: 'all', label: 'All' }, ...VENDORS.filter(v => mine.some(c => c.vendor === v)).map(v => ({ v, label: v, count: mine.filter(c => c.vendor === v).length }))]} />
        <Spacer />
        <Btn kind="primary" icon="plus" perm={ctx.can('admin', 'Reading other vendors’ backups')} onClick={() => add.open(true)}>
          Read another vendor’s backups…
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Other vendors’ backups"
          cols={[
            { k: 'v', label: 'Vendor', w: 'minmax(170px,1.2fr)' },
            { k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true },
            { k: 'l', label: 'Where', w: 'minmax(180px,1.4fr)', dim: true },
            { k: 'm', label: 'Machines', w: '90px', r: true },
            { k: 'p', label: 'Points', w: '84px', r: true },
            { k: 'tb', label: 'Size', w: '84px', r: true },
            { k: 'o', label: 'Oldest point', w: '110px', dim: true },
            { k: 's', label: 'State', w: '180px' }
          ]}
          rows={rows.map(c => ({
            id: c.id,
            v: { v: c.product, strong: true },
            c: custName(c.customer),
            l: { v: c.location, tip: c.how },
            m: { v: String(c.machines.length + c.more), s: c.machines.length + c.more },
            p: { v: c.points.toLocaleString('en-IN'), s: c.points },
            tb: { v: c.tb ? `${c.tb.toFixed(1)} TB` : '—', s: c.tb, muted: !c.tb },
            o: c.oldest,
            s: { t: 'status', i: ST[c.state].i, c: ST[c.state].c, l: c.state === 'Indexing' ? `Indexing · ${c.pct}%` : c.state, tip: c.note }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['catalogue', 'catalogues']}
          emptyText="No other vendors’ backups. Read a Veeam, Commvault, Acronis, NetBackup or Rubrik repository to restore from it here."
          footR="Points keep their original expiry; nothing is copied unless you choose Keep on Aegis"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Other vendor’s backups"
          kicker={`${VENDOR[d.vendor].title} · ${custName(d.customer)}`}
          title={d.product}
          status={<><span>{d.location}</span><span>{d.state}</span></>}
          closing={drawer.closing}
          onClose={drawer.close}
          actions={
            d.machines.length ? (
              <>
                <Btn kind="primary" icon="rotate-ccw" perm={ctx.can('restore', 'Restoring')} onClick={() => restore.open(d.id)}>Restore a point…</Btn>
                <Btn kind="outline" icon="forward" onClick={() => ctx.go('mig/sources/images', 'backups')}>Migrate from a backup</Btn>
                <Btn kind="outline" icon="archive" perm={ctx.can('configure', 'Copying backups into Aegis')} onClick={() => keep.open(d.id)}>Keep on Aegis…</Btn>
              </>
            ) : null
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.note ? <Bar tone="warn" multiline>{d.note}</Bar> : d.state === 'Indexing' ? <Bar tone="info" multiline>Indexing {d.pct}%: points already indexed can be restored now; file search comes when indexing finishes.</Bar> : null}
            <DrawerTiles items={[{ label: 'Machines', value: String(d.machines.length + d.more) }, { label: 'Points', value: d.points.toLocaleString('en-IN') }, { label: 'Size', value: d.tb ? `${d.tb.toFixed(1)} TB` : '—' }, { label: 'Oldest', value: d.oldest }]} />
            {d.machines.length ? (
              <MiniTable
                label="Machines"
                cols={[{ label: 'Machine' }, { label: 'Size', w: '80px', r: true }, { label: 'Points', w: '64px', r: true }, { label: 'Newest', w: '130px' }]}
                rows={d.machines.map(m => [<span key="n" style={{ whiteSpace: 'normal', padding: '6px 0' }}><strong style={{ fontWeight: 600 }}>{m.name}</strong><br /><span style={{ color: 'var(--tx-3)', font: '12px/16px var(--f-ui)' }}>{m.os}</span></span>, m.gb >= 1024 ? `${(m.gb / 1024).toFixed(1)} TB` : `${m.gb} GB`, String(m.points), m.newest])}
              />
            ) : null}
            {d.more ? <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>And {d.more} more machines with the same retention.</span> : null}
            <Facts
              items={[
                { k: 'How it is read', v: d.how },
                { k: 'Kept', v: d.keep },
                { k: 'Encryption', v: d.enc },
                { k: 'Restores to', v: 'Proxmox VE or OpenStack, with drivers converted by the transformation profile; files and folders to any agent' },
                { k: 'Vendor licence', v: d.vendor === 'Rubrik' || d.vendor === 'Commvault' ? 'The vendor’s server must stay up to read; Keep on Aegis removes that need' : 'Not needed: the files are read without the vendor’s software' }
              ]}
            />
          </div>
        </Drawer>
      ) : null}
      {add.value ? (
        <ReadVendorDialog
          ctx={ctx}
          closing={add.closing}
          onClose={add.close}
          onDone={c => {
            setCats(x => [...x, c]);
            add.close();
            drawer.open(c.id);
          }}
        />
      ) : null}
      {restore.value ? <ForeignRestoreDialog ctx={ctx} cat={mine.find(c => c.id === restore.value)!} closing={restore.closing} onClose={restore.close} /> : null}
      {keep.value ? <KeepDialog ctx={ctx} cat={mine.find(c => c.id === keep.value)!} closing={keep.closing} onClose={keep.close} /> : null}
    </>
  );
}

function ReadVendorDialog({ ctx, closing, onClose, onDone }: { ctx: Ctx; closing: boolean; onClose: () => void; onDone: (c: Catalogue) => void }) {
  const custs = scopeCustomers(ctx);
  const [vendor, setVendor] = useState<Vendor>('Veeam');
  const [cust, setCust] = useState(custs.includes('mer') ? 'mer' : custs[0]);
  const [loc, setLoc] = useState('');
  const [acct, setAcct] = useState('');
  const [pw, setPw] = useState('');
  const [keep, setKeep] = useState('Each point until its original expiry');
  const [state, setState] = useState<'idle' | 'scan' | 'found'>('idle');
  const v = VENDOR[vendor];
  const locOk = v.re.test(loc.trim());
  const err = !loc.trim() ? 'Give the location of the backups.' : !locOk ? `Write it as ${v.loc}.` : !acct.trim() ? 'Give the read-only account.' : null;
  const finish = () => {
    const c: Catalogue = { id: 'fc-' + Date.now(), vendor, product: v.title, customer: cust, location: loc.trim(), how: v.reads, machines: [{ name: 'found-01', os: 'Windows Server 2019', gb: 220, points: 30, newest: '22 Oct, 23:00', oldest: '23 Sep 2026' }], more: 11, points: 360, tb: 5.2, oldest: '23 Sep 2026', state: 'Indexing', pct: 4, keep, enc: pw ? 'Password supplied; kept in Settings › Keys' : 'Not encrypted' };
    audit({ who: 'priya.raman', customer: cust, what: `Connected ${v.title} backups`, object: loc.trim(), when: ctx.now(), r: 'ok', after: [['Vendor', v.title], ['Account', acct.trim()], ['Retention', keep]] });
    ctx.toast(`${v.title}: 12 machines and 360 points found; indexing started`, 'ok');
    onDone(c);
  };
  return (
    <Dialog
      size="lg"
      title="Read another vendor’s backups"
      sub="Restore from years of existing backups without running the old product next to Aegis."
      closing={closing}
      onClose={onClose}
      footNote="Read-only: Aegis never writes to, prunes or changes the vendor’s files."
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          {state === 'found' ? (
            <Btn kind="primary" icon="check" onClick={finish}>Add the catalogue</Btn>
          ) : (
            <Btn kind="primary" icon={state === 'scan' ? 'loader-circle' : 'search'} spin={state === 'scan'} disabled={!!err || state === 'scan'} why={err || undefined} perm={ctx.can('admin', 'Reading other vendors’ backups')} onClick={() => { setState('scan'); window.setTimeout(() => setState('found'), 1300); }}>
              {state === 'scan' ? 'Reading…' : 'Read the catalogue'}
            </Btn>
          )}
        </>
      }
    >
      <div role="radiogroup" aria-label="Vendor" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        {VENDORS.map(x => (
          <RadioCard key={x} on={vendor === x} onClick={() => { setVendor(x); setState('idle'); }} title={VENDOR[x].title} note={VENDOR[x].note} />
        ))}
      </div>
      <Bar tone="info" multiline>{v.reads}</Bar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="fv-c" label="Customer">
          <SelectInput id="fv-c" value={cust} onChange={setCust} options={custs.map(c => ({ v: c, label: custName(c) }))} />
        </Field>
        <Field id="fv-l" label="Where the backups are" hint={v.locHint} err={loc && !locOk ? `Write it as ${v.loc}.` : null}>
          <TextInput id="fv-l" value={loc} onChange={x => { setLoc(x); setState('idle'); }} placeholder={v.loc} mono />
        </Field>
        <Field id="fv-a" label="Read-only account">
          <TextInput id="fv-a" value={acct} onChange={setAcct} placeholder={vendor === 'Rubrik' ? 'svc-aegis-read (Rubrik read-only role)' : 'CORP\\svc-aegis-read'} />
        </Field>
        <Field id="fv-p" label={vendor === 'Acronis' ? 'Archive password' : 'Encryption password, if the jobs are encrypted'} hint="Kept in Settings › Keys; asked only once.">
          <TextInput id="fv-p" value={pw} onChange={setPw} placeholder="Leave empty if not encrypted" />
        </Field>
        <Field id="fv-k" label="Retention" span={2}>
          <SelectInput id="fv-k" value={keep} onChange={setKeep} options={['Each point until its original expiry', 'Apply an Aegis policy from today', 'Keep everything under legal hold until released']} />
        </Field>
      </div>
      {state === 'found' ? <Bar tone="ok" multiline>Found 12 machines and 360 points, oldest 23 Sep 2026. Indexing reads each chain’s metadata first, so whole-machine restores are possible within minutes; file search follows.</Bar> : null}
    </Dialog>
  );
}

function ForeignRestoreDialog({ ctx, cat, closing, onClose }: { ctx: Ctx; cat: Catalogue; closing: boolean; onClose: () => void }) {
  const [m, setM] = useState(cat.machines[0].name);
  const mm = cat.machines.find(x => x.name === m)!;
  const [pt, setPt] = useState(mm.newest);
  const [what, setWhat] = useState<'machine' | 'files' | 'disks'>('machine');
  const [dest, setDest] = useState('production-openstack');
  const pts = [mm.newest, '21 Oct, 23:00', '20 Oct, 23:00', '30 Sep, 23:00 (monthly)', '31 Mar, 23:00 (yearly)', `${mm.oldest} (oldest)`];
  const go = () => {
    ctx.startJob({ name: 'Restore from another vendor', object: `${m} (${cat.vendor})`, product: 'Backup', phases: ['Read the chain', 'Convert disks', 'Inject drivers', 'Start', 'Done'], speed: 10, doneToast: `${m} restored from ${cat.vendor} point ${pt} to ${dest}` });
    audit({ who: 'priya.raman', customer: cat.customer, what: `Restored from ${cat.product}`, object: m, when: ctx.now(), r: 'ok', after: [['Point', pt], ['What', what], ['To', dest]] });
    onClose();
  };
  return (
    <Dialog
      size="lg"
      title={`Restore from ${cat.vendor}`}
      sub="The point is read in place; the restored machine is converted for its new platform."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="rotate-ccw" perm={ctx.can('restore', 'Restoring')} onClick={go}>Restore</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="fr-m" label="Machine">
          <SelectInput id="fr-m" value={m} onChange={x => { setM(x); setPt(cat.machines.find(y => y.name === x)!.newest); }} options={cat.machines.map(x => ({ v: x.name, label: `${x.name} · ${x.os}` }))} />
        </Field>
        <Field id="fr-p" label="Point" hint={`${mm.points} points from ${mm.oldest}`}>
          <SelectInput id="fr-p" value={pt} onChange={setPt} options={pts} />
        </Field>
      </div>
      <div role="radiogroup" aria-label="What to restore" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        <RadioCard on={what === 'machine'} onClick={() => setWhat('machine')} icon="server" title="Whole machine" note="As a new VM on Proxmox VE or OpenStack, drivers converted." />
        <RadioCard on={what === 'files'} onClick={() => setWhat('files')} icon="folder" title="Files and folders" note="To the original server or any machine with the agent." />
        <RadioCard on={what === 'disks'} onClick={() => setWhat('disks')} icon="hard-drive" title="Disks only" note="Attached to an existing VM, or exported as qcow2." />
      </div>
      <Field id="fr-d" label={what === 'files' ? 'Restore files to' : 'Destination'}>
        <SelectInput id="fr-d" value={dest} onChange={setDest} options={what === 'files' ? ['Original location (agent on the machine)', 'kav-tally-01 (agent) · D:\\Restore', 'erp-app-01 (agent) · D:\\Restore'] : ['production-openstack', 'Chennai-proxmox-prod', 'region-2-os']} />
      </Field>
      <Facts items={[{ k: 'Source', v: `${cat.location} · ${cat.how}` }, { k: 'Conversion', v: mm.os.includes('Windows') ? 'VirtIO drivers injected, VMware Tools or Hyper-V services removed (Standard Windows profile)' : 'initramfs rebuilt with virtio drivers (Standard Linux profile)' }, { k: 'Checked', v: 'Every block’s checksum is verified against the vendor’s metadata while it is read' }]} />
    </Dialog>
  );
}

function KeepDialog({ ctx, cat, closing, onClose }: { ctx: Ctx; cat: Catalogue; closing: boolean; onClose: () => void }) {
  const [scope, setScope] = useState('Monthly and yearly points only');
  const [repo, setRepo] = useState('obj-check');
  const share = scope === 'Every point' ? 1 : scope === 'Monthly and yearly points only' ? 0.32 : 0.08;
  const tb = cat.tb * share * 0.55;
  return (
    <Dialog
      title="Keep on Aegis"
      sub={`Copy ${cat.product} points into an Aegis repository, so the old product can be switched off.`}
      closing={closing}
      onClose={onClose}
      footNote="The vendor’s files are only read; delete them yourself after the copy is verified."
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn
            kind="primary"
            icon="archive"
            perm={ctx.can('configure', 'Copying backups into Aegis')}
            onClick={() => {
              ctx.startJob({ name: 'Copy into Aegis', object: `${cat.product} · ${custName(cat.customer)}`, product: 'Backup', phases: ['Read chains', 'Deduplicate', 'Write and verify', 'Done'], speed: 6, doneToast: `${cat.product}: points copied into ${repo} and verified` });
              audit({ who: 'priya.raman', customer: cat.customer, what: 'Started copying another vendor’s backups into Aegis', object: cat.product, when: ctx.now(), r: 'ok', after: [['Points', scope], ['Repository', repo]] });
              onClose();
            }}
          >
            Copy {tb.toFixed(1)} TB
          </Btn>
        </>
      }
    >
      <Field id="kp-s" label="Points to copy">
        <SelectInput id="kp-s" value={scope} onChange={setScope} options={['Every point', 'Monthly and yearly points only', 'Only points under legal hold']} />
      </Field>
      <Field id="kp-r" label="Into repository" hint="Each point keeps its original expiry; immutability follows the repository.">
        <SelectInput id="kp-r" value={repo} onChange={setRepo} options={['obj-check', 'copy-check-repo', 'repo-director-lab']} />
      </Field>
      <DrawerTiles items={[{ label: 'Read', value: `${(cat.tb * share).toFixed(1)} TB` }, { label: 'Stored after dedup', value: `${tb.toFixed(1)} TB`, sub: 'About 45 % saved' }, { label: 'Takes', value: `${Math.max(1, Math.round(tb / 3))} days`, sub: 'At night, 3 TB a night' }]} />
    </Dialog>
  );
}
