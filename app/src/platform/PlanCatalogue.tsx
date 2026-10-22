import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { Btn, CheckBox, Field, Seg, SelectInput, TextInput } from '../ui/controls';
import { Bar, Facts, MiniTable, Panel, Spacer, Toolbar } from '../ui/layout';
import { Dialog, StepUp, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inr } from './common';
import { audit, useStore } from './store';

type Prod = 'Protection' | 'Resilience' | 'Mobility' | 'Bundle';
interface Edition { id: string; product: Prod; name: string; unit: string; price: number; features: string[]; version: number; note?: string }
const FEATURES = [
  'Scheduled backups', 'Application-consistent databases', 'Immutable copies', 'Offsite copy', 'Kubernetes and endpoints', 'Bring your own key', 'Compliance mode',
  'Scheduled replication', 'Continuous replication (Tier 0)', 'Recovery plans and drills', 'Two-approver failover', 'Assessment and waves', 'Cutover with go/no-go', 'One contract, one renewal date'
];
const EDITIONS: Edition[] = [
  { id: 'p-std', product: 'Protection', name: 'Standard', unit: 'VM-month', price: 520, features: ['Scheduled backups', 'Offsite copy'], version: 3 },
  { id: 'p-bus', product: 'Protection', name: 'Business', unit: 'VM-month', price: 650, features: ['Scheduled backups', 'Application-consistent databases', 'Immutable copies', 'Offsite copy'], version: 4 },
  { id: 'p-ent', product: 'Protection', name: 'Enterprise', unit: 'VM-month', price: 780, features: ['Scheduled backups', 'Application-consistent databases', 'Immutable copies', 'Offsite copy', 'Kubernetes and endpoints', 'Bring your own key', 'Compliance mode'], version: 4 },
  { id: 'r-bus', product: 'Resilience', name: 'Business', unit: 'workload-day', price: 52, features: ['Scheduled replication', 'Recovery plans and drills'], version: 2 },
  { id: 'r-ent', product: 'Resilience', name: 'Enterprise · Tier 0 and 1', unit: 'workload-day', price: 78, features: ['Scheduled replication', 'Continuous replication (Tier 0)', 'Recovery plans and drills', 'Two-approver failover', 'Compliance mode'], version: 2 },
  { id: 'm-prj', product: 'Mobility', name: 'Project', unit: 'server migrated', price: 6000, features: ['Assessment and waves', 'Cutover with go/no-go'], version: 1 },
  { id: 'b-ent', product: 'Bundle', name: 'Enterprise bundle', unit: 'protected socket-month', price: 9400, features: FEATURES, version: 2, note: '12 % below the three Enterprise editions bought apart' },
  { id: 't-30', product: 'Protection', name: 'Trial (30 days)', unit: '10 workloads', price: 0, features: ['Scheduled backups', 'Application-consistent databases', 'Immutable copies'], version: 1, note: 'Converts to Business at the end unless cancelled' }
];

const short = (e: Edition) => (e.product === 'Bundle' ? 'Bundle' : e.name.startsWith('Trial') ? 'Trial' : `${e.product.slice(0, 3)}. ${e.name.split(' ·')[0]}`);

/** Billing › Plans: editions with their price and features, and the cross-product bundle on one contract. */
export function PlanCatalogue({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [list, setList] = useState<Edition[]>(EDITIONS);
  const [prod, setProd] = useState<'all' | Prod>('all');
  const edit = useClosable<string>();
  const bundle = useClosable<string>();
  const provider = !ctx.actingAs;
  const rows = list.filter(e => prod === 'all' || e.product === prod);
  const used = (e: Edition) => s.entitlements.filter(x => (x.product === e.product || (e.product === 'Bundle' && x.product === 'Bundle')) && x.edition.startsWith(e.name.split(' ·')[0].replace(' (30 days)', ''))).length;
  // Customers holding two or more products on separate contracts are candidates for the bundle.
  const split = [...new Set(s.entitlements.map(e => e.customer))].filter(c => s.entitlements.filter(e => e.customer === c && e.product !== 'Bundle').length >= 2 && (provider || c === ctx.actingAs?.customer));
  return (
    <>
      <Toolbar>
        <Seg label="Product" value={prod} onChange={setProd} options={[{ v: 'all', label: 'All' }, { v: 'Protection', label: 'Protection' }, { v: 'Resilience', label: 'Resilience' }, { v: 'Mobility', label: 'Mobility' }, { v: 'Bundle', label: 'Bundle' }]} />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>List prices before GST; contracts may carry a discount</span>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ flex: 'none' }}>
        <AegisTable
          label="Editions"
          cols={[{ k: 'n', label: 'Edition', w: 'minmax(200px,1.4fr)' }, { k: 'p', label: 'Product', w: '110px' }, { k: 'u', label: 'Billed per', w: '170px', dim: true }, { k: 'pr', label: 'List price', w: '120px', r: true }, { k: 'f', label: 'Includes', w: 'minmax(220px,1.8fr)', dim: true }, { k: 'c', label: 'Customers', w: '96px', r: true }, ...(provider ? [{ k: 'e', label: '', w: '90px', r: true }] : [])]}
          rows={rows.map(e => ({
            id: e.id,
            n: { v: e.name, strong: true, tip: e.note || `Version ${e.version}` },
            p: e.product,
            u: e.unit,
            pr: e.price ? { v: inr(e.price), s: e.price } : { v: 'Free', muted: true, s: 0 },
            f: { v: `${e.features.length} of ${FEATURES.length}: ${e.features.slice(0, 3).join(', ')}${e.features.length > 3 ? '…' : ''}`, tip: e.features.join(', ') },
            c: { v: String(used(e)), s: used(e) },
            e: { t: 'btn', v: 'Edit…', onClick: () => edit.open(e.id) }
          }))}
          state={ctx.ui}
          unit={['edition', 'editions']}
          filtered={prod !== 'all'}
          onClear={() => setProd('all')}
          emptyText="No editions for this product."
        />
        </div>
        <Panel title="What each edition includes">
          <div style={{ padding: '0 16px 8px', overflowX: 'auto' }}>
            <MiniTable
              label="Feature matrix"
              cols={[{ label: 'Feature', w: '230px' }, ...rows.map(e => ({ label: short(e), w: 'minmax(96px,1fr)' }))]}
              rows={FEATURES.map(f => [f, ...rows.map(e => (e.features.includes(f) ? <Icon key={e.id} name="check" style={{ color: 'var(--ok)' }} aria-label="Included" /> : <Icon key={e.id} name="minus" style={{ color: 'var(--tx-3)' }} aria-label="Not included" />))])}
            />
          </div>
        </Panel>
        <Panel title="The bundle: one contract, one renewal date">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'var(--tx-2)', maxWidth: 760 }}>Protection, Resilience and Mobility on one order form, billed per protected socket, with one renewal date. Moving to it ends the separate contracts on one day and credits what was paid for after it.</p>
            <MiniTable
              label="Customers on separate contracts"
              cols={[{ label: 'Customer' }, { label: 'Contracts', w: 'minmax(0,2fr)' }, { label: 'Renewal dates', w: '230px' }, { label: '', w: '150px', r: true }]}
              rows={split.map(c => {
                const es = s.entitlements.filter(e => e.customer === c && e.product !== 'Bundle');
                const dates = [...new Set(es.map(e => e.expires))];
                return [<strong key="c" style={{ fontWeight: 600 }}>{custName(c)}</strong>, es.map(e => `${e.product} ${e.edition}`).join(' · '), dates.length > 1 ? <span key="d" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />{dates.join(', ')}</span> : dates[0], provider ? <Btn key="b" kind="ghost" size="sm" iconAfter="arrow-right" onClick={() => bundle.open(c)}>Move to bundle…</Btn> : <span key="b" style={{ color: 'var(--tx-3)', font: '12px var(--f-ui)' }}>Ask your account manager</span>];
              })}
              empty="Every customer with more than one product is already on the bundle."
            />
          </div>
        </Panel>
      </div>
      {edit.value ? <EditEdition ctx={ctx} e={list.find(x => x.id === edit.value)!} closing={edit.closing} onClose={edit.close} onSave={n => { setList(x => x.map(y => (y.id === n.id ? n : y))); edit.close(); }} /> : null}
      {bundle.value ? <BundleDialog ctx={ctx} customer={bundle.value} closing={bundle.closing} onClose={bundle.close} /> : null}
    </>
  );
}

function EditEdition({ ctx, e, closing, onClose, onSave }: { ctx: Ctx; e: Edition; closing: boolean; onClose: () => void; onSave: (e: Edition) => void }) {
  const [price, setPrice] = useState(String(e.price));
  const [feat, setFeat] = useState<string[]>(e.features);
  const [when, setWhen] = useState('At each customer’s next renewal');
  const n = +price;
  const changed = n !== e.price || feat.join() !== e.features.join();
  return (
    <Dialog
      title={`Edit ${e.product} ${e.name}`}
      sub={`Saved as version ${e.version + 1}. Customers on it keep version ${e.version} until the change applies to them.`}
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!changed || Number.isNaN(n)} why="Nothing has changed." onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Changed an edition', object: `${e.product} ${e.name} v${e.version + 1}`, when: ctx.now(), r: 'ok', before: [['Price', inr(e.price)]], after: [['Price', inr(n)], ['Applies', when]] }); ctx.toast(`${e.product} ${e.name} v${e.version + 1} saved; applies ${when.toLowerCase()}`, 'ok'); onSave({ ...e, price: n, features: feat, version: e.version + 1 }); }}>Save version {e.version + 1}</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="ee-p" label={`List price per ${e.unit} (₹)`}><TextInput id="ee-p" value={price} onChange={v => setPrice(v.replace(/[^\d]/g, ''))} inputMode="numeric" /></Field>
        <Field id="ee-w" label="Applies"><SelectInput id="ee-w" value={when} onChange={setWhen} options={['At each customer’s next renewal', 'To new contracts only']} /></Field>
      </div>
      <Field label="Includes">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {FEATURES.map(f => <CheckBox key={f} on={feat.includes(f)} onChange={v => setFeat(x => (v ? FEATURES.filter(y => x.includes(y) || y === f) : x.filter(y => y !== f)))}>{f}</CheckBox>)}
        </div>
      </Field>
      {n > e.price ? <Bar tone="warn">A price rise needs 30 days’ written notice to customers on this edition; the notice goes out when you save.</Bar> : null}
    </Dialog>
  );
}

function BundleDialog({ ctx, customer, closing, onClose }: { ctx: Ctx; customer: string; closing: boolean; onClose: () => void }) {
  const s = useStore();
  const es = s.entitlements.filter(e => e.customer === customer && e.product !== 'Bundle');
  const dates = [...new Set(es.map(e => e.expires))];
  const [coterm, setCoterm] = useState(dates.sort().slice(-1)[0] || '31 Mar 2027');
  const [mfa, setMfa] = useState(false);
  // Mobility ends 02 Mar 2027 for Meridian: 29 more days if the bundle ends 31 Mar 2027.
  const rows = es.map(e => {
    const extra = e.expires === coterm ? 0 : e.expires === '02 Mar 2027' && coterm === '31 Mar 2027' ? 29 : 0;
    const charge = extra ? Math.round((e.limit * 6000 * extra) / 365) : 0;
    return { e, extra, charge };
  });
  const annual = 4320000;
  return (
    <Dialog
      title={`Move ${custName(customer)} to the Enterprise bundle`}
      sub="One order form and one renewal date for all three products. The separate contracts end on the switch date and what was paid beyond it is credited."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!mfa} why="Confirm it is you first." onClick={() => { audit({ who: 'priya.raman', customer, what: 'Moved to the Enterprise bundle', object: custName(customer), when: ctx.now(), r: 'ok', after: [['Renewal date', coterm]] }); ctx.toast(`Order form for ${custName(customer)} sent for signature; the bundle starts when it is signed`, 'ok'); onClose(); }}>Send order form</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="bd-c" label="One renewal date"><SelectInput id="bd-c" value={coterm} onChange={setCoterm} options={[...new Set([...dates, '31 Mar 2027'])]} /></Field>
        <Field label="Bundle price"><span style={{ display: 'block', padding: '7px 0', fontWeight: 600 }}>{inr(annual)} a year · 12 % below the separate contracts</span></Field>
      </div>
      <MiniTable
        label="Contracts that end"
        cols={[{ label: 'Contract' }, { label: 'Ends now', w: '120px' }, { label: 'Moves to', w: '120px' }, { label: 'Charge or credit', w: '150px', r: true }]}
        rows={rows.map(r => [`${r.e.product} ${r.e.edition}`, r.e.expires, coterm, r.charge ? `+ ${inr(r.charge)} (${r.extra} days)` : 'None'])}
      />
      <Facts items={[{ k: 'Usage in between', v: 'Overage on the old contracts (Resilience: 23 of 20) is billed up to the switch date, then counted against the bundle' }, { k: 'Invoices', v: 'One invoice a month from the switch, with a line per product' }]} />
      <StepUp verified={mfa} onVerified={() => setMfa(true)} />
    </Dialog>
  );
}
