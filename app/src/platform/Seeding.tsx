import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Btn, CheckBox, Field, RadioCard, Seg, SelectInput, TextArea, TextInput } from '../ui/controls';
import { Bar, DrawerTiles, Facts, Progress, Spacer, StepList, TableArea, Tiles, Toolbar, plural, type Step } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { WORKLOADS } from '../data/platform';
import { custName, inScope, scopeCustomers } from './common';
import { audit } from './store';

type Product = 'Resilience' | 'Mobility';
type Seed = { id: string; customer: string; product: Product; servers: string[]; tb: number; link: number; dest: string; disk: string; seal: string; courier?: string; step: number; at: string[]; catchUp?: number; changedGb?: number; note?: string };

const STEPS = ['Kit requested', 'Copied and sealed at the source', 'With the courier', 'Imported at the destination', 'Sending the changes since the copy', 'Replicating normally'];
const LAST: Record<Product, string> = { Resilience: 'Replicating normally', Mobility: 'Ready for its wave' };
const SITES = ['production-openstack', 'Chennai-proxmox-prod', 'region-2-os'];
const LINKS = [20, 50, 100, 200, 500, 1000];
/** Used size of the servers a seed can carry, in TB. */
const SIZE: Record<string, number> = { 'sah-his-db': 2.4, 'sah-pacs': 11.8, 'kav-tally-01': 0.6, 'kav-wms-db': 2.5, 'mum-oracle-phy-01': 6.8, 'legacy-erp': 1.2, 'fs-mum-01': 4.1, 'cbs-db-01': 3.6, sql01: 1.9, 'file-srv-03': 2.2, 'erp-db-01': 1.4 };
const sizeOf = (id: string) => SIZE[id] ?? (WORKLOADS.find(w => w.id === id)?.type === 'Database' ? 0.9 : 0.4);
/** Days to copy over the link at 80 % of its speed. */
export const netDays = (tb: number, mbit: number) => (tb * 8e6) / (mbit * 0.8) / 86400;
const DISK_DAYS = 4;
const fmtDays = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${d < 10 ? d.toFixed(1) : Math.round(d)} days`);
const linkLabel = (m: number) => (m >= 1000 ? `${m / 1000} Gbit/s` : `${m} Mbit/s`);
const nameOf = (id: string) => WORKLOADS.find(w => w.id === id)?.name || id;

const SEEDS: Seed[] = [
  { id: 'SD-0423', customer: 'h360', product: 'Mobility', servers: ['legacy-erp'], tb: 1.2, link: 20, dest: 'Chennai-proxmox-prod', disk: 'Aegis seed kit · 1 × 4 TB NVMe', seal: 'Not sealed yet', step: 0, at: ['23 Oct, 10:15'], note: 'Branch office link: 20 Mbit/s shared with point-of-sale traffic' },
  { id: 'SD-0419', customer: 'sah', product: 'Resilience', servers: ['sah-his-db', 'sah-pacs'], tb: 14.2, link: 100, dest: 'region-2-os', disk: 'Aegis seed kit · 2 × 16 TB NVMe', seal: 'H360-SEAL-88213', courier: 'Blue Dart AWB 7741 0923 551 · left Pune 22 Oct 18:10, due in Hyderabad 24 Oct', step: 2, at: ['17 Oct, 09:40', '22 Oct, 16:55', '22 Oct, 18:10'] },
  { id: 'SD-0417', customer: 'kav', product: 'Mobility', servers: ['kav-tally-01', 'kav-wms-db'], tb: 3.1, link: 50, dest: 'production-openstack', disk: 'Customer disk · Seagate Exos 8 TB, encrypted with the seed key', seal: 'H360-SEAL-88197', courier: 'Hand-delivered by Kaveri IT to the Chennai receiving dock, 19 Oct 11:30', step: 4, at: ['14 Oct, 12:00', '18 Oct, 19:20', '19 Oct, 08:00', '19 Oct, 16:45', '19 Oct, 17:10'], catchUp: 64, changedGb: 212 },
  { id: 'SD-0402', customer: 'mer', product: 'Resilience', servers: ['mum-oracle-phy-01'], tb: 6.8, link: 200, dest: 'production-openstack', disk: 'Aegis seed kit · 1 × 16 TB NVMe', seal: 'H360-SEAL-88140', courier: 'Blue Dart AWB 7741 0902 118 · delivered 08 Oct', step: 5, at: ['02 Oct, 11:00', '06 Oct, 21:30', '06 Oct, 23:00', '08 Oct, 15:20', '08 Oct, 16:05', '12 Oct, 09:40'] }
];

/** Offline seeding: the first full copy goes by encrypted disk, then only changes cross the link. Shared by Resilience and Mobility. */
export function SeedView({ ctx, product }: { ctx: Ctx; product: Product }) {
  const [seeds, setSeeds] = useState<Seed[]>(SEEDS);
  const [show, setShow] = useState<'all' | 'open'>('all');
  const drawer = useClosable<string>();
  const create = useClosable<boolean>();
  const lost = useClosable<string>();
  const mine = seeds.filter(s => s.product === product && inScope(ctx, s.customer));
  const rows = mine.filter(s => show === 'all' || s.step < 5);
  const open = mine.filter(s => s.step < 5);
  const saved = open.reduce((a, s) => a + Math.max(0, netDays(s.tb, s.link) - DISK_DAYS), 0);
  const d = drawer.value ? mine.find(s => s.id === drawer.value) : null;
  const last = LAST[product];
  const advance = (s: Seed, to: number, what: string, toast: string) => {
    setSeeds(x => x.map(y => (y.id === s.id ? { ...y, step: to, at: [...y.at.slice(0, to), ctx.now().replace(' 2026', '').replace(' IST', '')], catchUp: to === 4 ? 0 : y.catchUp, changedGb: to === 4 ? Math.round(s.tb * 40) : y.changedGb } : y)));
    audit({ who: 'priya.raman', customer: s.customer, what, object: s.id, when: ctx.now(), r: 'ok' });
    ctx.toast(toast, 'ok');
  };
  const steps = (s: Seed): Step[] => STEPS.map((l, i) => ({ label: i === 5 ? last : l, note: s.at[i] || (i === s.step + 1 && i === 2 && s.step === 1 ? 'Waiting for the courier' : ''), state: i < s.step || (i === 5 && s.step === 5) ? 'done' : i === s.step ? 'current' : 'todo' }));
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Seeds in progress', value: String(open.length), icon: 'hard-drive', sub: `${open.reduce((a, s) => a + s.servers.length, 0)} servers waiting for their first copy` },
            { label: 'On seed disks', value: open.reduce((a, s) => a + s.tb, 0).toFixed(1), unit: 'TB', icon: 'database', sub: 'Encrypted; the key never travels with the disk' },
            { label: 'Time saved', value: fmtDays(saved), icon: 'timer', tone: 'ok', sub: 'Against copying over each link at 80 % of its speed' },
            { label: 'Waiting on the customer', value: String(open.filter(s => s.step < 2).length), icon: 'hand', tone: open.some(s => s.step < 2) ? 'warn' : undefined, sub: 'Copy to the disk and hand it to the courier' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={show} onChange={v => setShow(v as typeof show)} options={[{ v: 'all', label: 'All' }, { v: 'open', label: 'In progress', count: open.length }]} />
        <Spacer />
        <Btn kind="primary" icon="hard-drive" perm={ctx.can('configure', 'Requesting a seed disk')} onClick={() => create.open(true)}>
          Seed by disk…
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Offline seeds"
          cols={[
            { k: 'id', label: 'Seed', w: '96px' },
            { k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true },
            { k: 'sv', label: 'Servers', w: 'minmax(160px,1.4fr)' },
            { k: 'tb', label: 'Size', w: '84px', r: true },
            { k: 'dest', label: 'Destination', w: 'minmax(140px,1fr)', dim: true },
            { k: 'net', label: 'Over the link instead', w: '180px', r: true, dim: true },
            { k: 's', label: 'Step', w: 'minmax(200px,1.3fr)' }
          ]}
          rows={rows.map(s => ({
            id: s.id,
            c: custName(s.customer),
            sv: { v: s.servers.map(nameOf).join(', '), strong: true },
            tb: { v: `${s.tb.toFixed(1)} TB`, s: s.tb },
            dest: s.dest,
            net: { v: `${fmtDays(netDays(s.tb, s.link))} at ${linkLabel(s.link)}`, s: netDays(s.tb, s.link), tip: 'At 80 % of the link, with nothing else on it' },
            s: s.step === 5 ? { t: 'status', i: 'circle-check', c: 'ok', l: last, s: 5 } : s.step < 2 ? { t: 'status', i: 'hand', c: 'warn', l: STEPS[s.step], s: s.step, tip: 'Waiting on the customer' } : { t: 'status', i: 'loader-circle', c: 'run', l: s.step === 4 ? `Changes since the copy · ${s.catchUp}%` : STEPS[s.step], s: s.step }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['seed', 'seeds']}
          emptyText="No offline seeds. Choose Seed by disk when a first copy would take more than a week over the link."
          footR="A seed disk is useless without the key held in Settings › Keys"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Offline seed"
          kicker={`Offline seed · ${custName(d.customer)}`}
          title={d.id}
          status={<><span>{d.servers.map(nameOf).join(', ')}</span><span>{d.tb.toFixed(1)} TB</span></>}
          closing={drawer.closing}
          onClose={drawer.close}
          actions={
            <>
              {d.step === 0 ? <Btn kind="primary" icon="check" perm={ctx.can('operate', 'Recording seed progress')} onClick={() => advance(d, 1, 'Recorded seed copy complete and sealed', `${d.id}: copy verified (SHA-256 per disk) and sealed`)}>Mark copied and sealed</Btn> : null}
              {d.step === 1 ? <Btn kind="primary" icon="send" perm={ctx.can('operate', 'Recording seed progress')} onClick={() => advance(d, 2, 'Recorded seed handed to courier', `${d.id}: handed to the courier`)}>Mark handed to the courier</Btn> : null}
              {d.step === 2 ? <Btn kind="primary" icon="download" perm={ctx.can('operate', 'Receiving seed disks')} onClick={() => advance(d, 3, 'Received seed disk; seal intact', `${d.id}: received with seal ${d.seal} intact; import started`)}>Mark received, seal intact</Btn> : null}
              {d.step === 3 ? <Btn kind="primary" icon="play" perm={ctx.can('operate', 'Receiving seed disks')} onClick={() => advance(d, 4, 'Seed imported; sending changes since the copy', `${d.id}: imported; sending the changes since the copy`)}>Import finished</Btn> : null}
              {d.step > 0 && d.step < 4 ? <Btn kind="danger" icon="ban" perm={ctx.can('admin', 'Revoking seed keys')} onClick={() => lost.open(d.id)}>Report lost or damaged…</Btn> : null}
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.step === 0 ? <Bar tone="info" multiline>The kit ships from Chennai within one working day. Run the Aegis copy tool at the source: it reads each disk once, encrypts it with the seed key and writes a SHA-256 per disk. Then seal the case with the tamper seal in the kit.</Bar> : null}
            {d.step === 2 ? <Bar tone="info" multiline>{d.courier}. Changes made since the copy are tracked at the source and sent once the seed is imported.</Bar> : null}
            {d.step === 4 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Changes since the copy: {Math.round(((d.changedGb || 0) * (d.catchUp || 0)) / 100)} of {d.changedGb} GB sent</span>
                <Progress pct={d.catchUp || 0} />
              </div>
            ) : null}
            <DrawerTiles items={[{ label: 'By disk', value: `${DISK_DAYS} days`, sub: 'Copy, courier and import' }, { label: 'Over the link', value: fmtDays(netDays(d.tb, d.link)), sub: `${linkLabel(d.link)} at 80 %` }, { label: 'Destination', value: d.dest }]} />
            <StepList label="Seed steps" steps={steps(d)} />
            <Facts
              items={[
                { k: 'Disk', v: d.disk },
                { k: 'Encryption', v: 'AES-256-XTS with a seed key derived from the tenant key; the key stays in Settings › Keys and is never on the disk' },
                { k: 'Tamper seal', v: d.seal },
                { k: 'Courier', v: d.courier || 'Not handed over yet' },
                { k: 'Checks on import', v: 'Seal number, then SHA-256 of every disk image against the values written at the source' },
                { k: 'Until it finishes', v: product === 'Resilience' ? 'These servers count as not protected; their RPO alert is held, not hidden' : 'These servers cannot join a wave' },
                ...(d.note ? [{ k: 'Note', v: d.note }] : [])
              ]}
            />
          </div>
        </Drawer>
      ) : null}
      {lost.value ? (
        <Dialog
          title={`Report ${lost.value} lost or damaged`}
          sub="The seed key is revoked at once, so whoever holds the disk cannot read it."
          closing={lost.closing}
          onClose={lost.close}
          footer={
            <>
              <Btn kind="ghost" onClick={lost.close}>Cancel</Btn>
              <Btn
                kind="dangerSolid"
                icon="ban"
                onClick={() => {
                  const s = mine.find(x => x.id === lost.value)!;
                  setSeeds(x => x.map(y => (y.id === s.id ? { ...y, step: 0, at: [ctx.now().replace(' 2026', '').replace(' IST', '')], seal: 'Not sealed yet', courier: undefined, note: `Replaces the kit reported lost or damaged on ${ctx.now().replace(' 2026', '')}; the old seed key is revoked` } : y)));
                  audit({ who: 'priya.raman', customer: s.customer, what: 'Revoked the seed key: disk reported lost or damaged', object: s.id, when: ctx.now(), r: 'ok' });
                  ctx.toast(`${s.id}: seed key revoked; a new kit has been requested`, 'warn');
                  lost.close();
                }}
              >
                Revoke the key and send a new kit
              </Btn>
            </>
          }
        >
          <Facts items={[{ k: 'Revoked', v: 'The seed key for this disk only; the tenant key and every other seed are untouched' }, { k: 'Then', v: 'A new kit ships with a new key; the copy at the source runs again' }, { k: 'Recorded', v: 'In the audit log and the residency evidence for this customer' }]} />
        </Dialog>
      ) : null}
      {create.value ? (
        <SeedDialog
          ctx={ctx}
          product={product}
          closing={create.closing}
          onClose={create.close}
          onDone={s => {
            setSeeds(x => [s, ...x]);
            create.close();
            drawer.open(s.id);
          }}
        />
      ) : null}
    </>
  );
}

function SeedDialog({ ctx, product, closing, onClose, onDone }: { ctx: Ctx; product: Product; closing: boolean; onClose: () => void; onDone: (s: Seed) => void }) {
  const custs = scopeCustomers(ctx).filter(c => WORKLOADS.some(w => w.customer === c));
  const [cust, setCust] = useState(custs.includes('sah') ? 'sah' : custs[0]);
  const [pick, setPick] = useState<string[]>([]);
  const [dest, setDest] = useState(SITES[0]);
  const [link, setLink] = useState(100);
  const [kit, setKit] = useState<'kit' | 'own'>('kit');
  const [addr, setAddr] = useState('');
  const [who, setWho] = useState('');
  const [phone, setPhone] = useState('');
  const servers = WORKLOADS.filter(w => w.customer === cust && ['VM', 'Physical server', 'Database', 'File share'].includes(w.type));
  const tb = pick.reduce((a, id) => a + sizeOf(id), 0);
  const net = netDays(tb, link);
  const phoneOk = /^\+\d{2} ?\d{5} ?\d{5}$/.test(phone.trim());
  const err = !pick.length ? 'Choose at least one server.' : !addr.trim() ? 'Give the address the kit goes to.' : !who.trim() ? 'Name the person who receives the kit.' : !phoneOk ? 'Write the phone number as +91 98400 12345.' : null;
  const save = () => {
    const s: Seed = { id: `SD-0${424 + Math.floor(Math.random() * 50)}`, customer: cust, product, servers: pick, tb: +tb.toFixed(1), link, dest, disk: kit === 'kit' ? `Aegis seed kit · ${Math.ceil(tb / 16)} × 16 TB NVMe` : 'Customer disk, encrypted with the seed key by the copy tool', seal: 'Not sealed yet', step: 0, at: [ctx.now().replace(' 2026', '').replace(' IST', '')], note: `Kit to ${who.trim()}, ${phone.trim()}` };
    audit({ who: 'priya.raman', customer: cust, what: 'Requested an offline seed', object: s.id, when: ctx.now(), r: 'ok', after: [['Servers', pick.map(nameOf).join(', ')], ['Size', `${s.tb} TB`], ['Destination', dest], ['Disk', kit === 'kit' ? 'Aegis seed kit' : 'Customer disk']] });
    ctx.toast(`${s.id} requested. The kit ships from Chennai within one working day.`, 'ok');
    onDone(s);
  };
  return (
    <Dialog
      size="lg"
      title="Seed by disk"
      sub="The first full copy travels on an encrypted disk; only the changes since the copy cross the link."
      closing={closing}
      onClose={onClose}
      footNote="Servers stay where they are; nothing changes at the source until the copy tool runs."
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="send" disabled={!!err} why={err || undefined} perm={ctx.can('configure', 'Requesting a seed disk')} onClick={save}>Request the kit</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="sd-c" label="Customer">
          <SelectInput id="sd-c" value={cust} onChange={v => { setCust(v); setPick([]); }} options={custs.map(c => ({ v: c, label: custName(c) }))} />
        </Field>
        <Field id="sd-d" label={product === 'Resilience' ? 'Recovery site' : 'Destination'}>
          <SelectInput id="sd-d" value={dest} onChange={setDest} options={SITES} />
        </Field>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Servers on the disk</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '4px 16px', maxHeight: 168, overflow: 'auto', border: '1px solid var(--ln)', padding: 8 }}>
          {servers.map(w => (
            <CheckBox key={w.id} on={pick.includes(w.id)} onChange={() => setPick(p => (p.includes(w.id) ? p.filter(x => x !== w.id) : [...p, w.id]))}>
              <span style={{ whiteSpace: 'normal' }}>{w.name} <span style={{ color: 'var(--tx-3)' }}>· {sizeOf(w.id).toFixed(1)} TB</span></span>
            </CheckBox>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="sd-l" label="Link from the source" hint="The speed the replication can actually use.">
          <SelectInput id="sd-l" value={String(link)} onChange={v => setLink(+v)} options={LINKS.map(m => ({ v: String(m), label: linkLabel(m) }))} />
        </Field>
        <div style={{ alignSelf: 'end', padding: '8px 12px', border: '1px solid var(--ln)', background: 'var(--panel-2)', font: '13px/18px var(--f-ui)' }}>
          <div style={{ fontWeight: 600 }}>{tb ? `${tb.toFixed(1)} TB: ${fmtDays(net)} over the link, ${DISK_DAYS} days by disk` : 'Choose servers to compare'}</div>
          <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>At 80 % of {linkLabel(link)}; by disk includes the courier</div>
        </div>
      </div>
      {tb > 0 && net < DISK_DAYS ? <Bar tone="info" multiline>The link is faster here: {fmtDays(net)} against {DISK_DAYS} days by disk. A seed is still useful if the link is shared with business traffic during the day.</Bar> : null}
      <div role="radiogroup" aria-label="Disk" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={kit === 'kit'} onClick={() => setKit('kit')} icon="hard-drive" title="Aegis seed kit" note={`${Math.max(1, Math.ceil(tb / 16))} × 16 TB NVMe in a sealed case, with the copy tool. ₹6,500 a shipment.`} />
        <RadioCard on={kit === 'own'} onClick={() => setKit('own')} icon="disc" title="Your own disk" note="Any USB or SAS disk large enough. The copy tool encrypts it with the seed key." />
      </div>
      <Field id="sd-a" label="Deliver the kit to">
        <TextArea id="sd-a" value={addr} onChange={setAddr} rows={2} placeholder="Server room, 3rd floor, Sahyadri Hospital, Karve Road, Pune 411004" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="sd-w" label="Received by">
          <TextInput id="sd-w" value={who} onChange={setWho} placeholder="Name of the person on site" />
        </Field>
        <Field id="sd-p" label="Their phone" err={phone && !phoneOk ? 'Write it as +91 98400 12345.' : null}>
          <TextInput id="sd-p" value={phone} onChange={setPhone} placeholder="+91 98400 12345" />
        </Field>
      </div>
      <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{plural(pick.length, 'server')} chosen. Their changes are tracked from the moment the copy tool starts, so nothing written after the copy is lost.</span>
    </Dialog>
  );
}
