import { useState } from 'react';
import { Btn, Field, Seg, SelectInput, TextInput } from '../ui/controls';
import { Bar, Facts, MiniTable, Panel, Status, Tiles } from '../ui/layout';
import { Dialog } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { CopyCurl } from '../ui/CopyCurl';
import { CUSTOMERS } from '../data/platform';
import { audit } from './store';
import type { Assume, engine } from './Calculators';

const fmt = (n: number, d = 1) => n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
/** Rupees in lakh and crore. Off the console (public page) prices are a ±15 % range, never an exact figure. */
const money = (n: number, priced = true): string => {
  const one = (v: number) => (Math.abs(v) >= 1e7 ? `₹${(v / 1e7).toFixed(2)} crore` : Math.abs(v) >= 1e5 ? `₹${(v / 1e5).toFixed(1)} lakh` : `₹${Math.round(v).toLocaleString('en-IN')}`);
  if (priced) return one(n);
  const lo = one(n * 0.85);
  const hi = one(n * 1.15);
  return `${lo.replace(/ (lakh|crore)$/, '')}–${hi.replace(/^₹/, '')}`;
};
const OutPanel = ({ title, tabs, tab, onTab, children }: { title: string; tabs: { v: string; label: string }[]; tab: string; onTab: (v: string) => void; children: React.ReactNode }) => (
  <Panel title={title} right={<Seg label={title} value={tab} onChange={onTab} options={tabs} panel={false} />}>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
  </Panel>
);

/** Backup calculator outputs: the design, its cost and TCO, and what happens if the assumptions are wrong. */
export function BackupOutputs({ d, b, a, f, priced }: { d: ReturnType<typeof engine.backupDesign>; b: { total: number; red: number }; a: Assume; f: Record<string, string>; priced: boolean }) {
  const [tab, setTab] = useState('design');
  const fits = d.windowEst <= +f.window;
  return (
    <OutPanel title="Design and cost" tab={tab} onTab={setTab} tabs={[{ v: 'design', label: 'Design' }, { v: 'cost', label: 'Cost and TCO' }, { v: 'risk', label: 'If we are wrong' }]}>
      {tab === 'design' ? (
        <>
          <Tiles
            items={[
              { label: 'Daily volume', value: fmt(d.inc, 2), unit: 'TB/day', icon: 'upload', sub: `First full ${f.source} TB · ${fmt(d.monthlyIngest)} TB a month, ${fmt(d.annualIngest, 0)} TB a year` },
              { label: 'Window', value: fmt(d.windowEst), unit: 'h', icon: 'clock', tone: fits ? 'ok' : 'err', sub: fits ? `Fits the ${f.window} h night` : `Does not fit the ${f.window} h night` },
              { label: 'Bandwidth', value: fmt(d.needMbps, 0), unit: 'Mbit/s', icon: 'network', sub: 'To finish inside the window' },
              { label: 'Proxies', value: String(d.proxies), icon: 'server', sub: '16 cores, 64 GB each; one spare' }
            ]}
          />
          <MiniTable
            label="Storage"
            cols={[{ label: 'Storage' }, { label: 'TB', w: '90px', r: true }, { label: 'Note', w: '45%' }]}
            rows={([
              ['Primary repository', fmt(b.total / (f.copy === 'Yes' ? 2 : 1)), `${fmt(b.red)}× reduction`],
              ['Offsite copy', f.copy === 'Yes' ? fmt(b.total / 2) : '—', f.copy === 'Yes' ? 'Second repository; often forgotten in sizing' : 'No copy'],
              ['Immutable, cannot be reclaimed', fmt(d.immutable), `Locked ${f.lock} days`],
              ['Archive tier', fmt(d.archive), `Rehydrating all of it: ${money(d.rehydCost, priced)}, about 12 h`],
              ['Usable to buy', fmt(d.usable), '25 % free-space headroom'],
              ['Raw to buy', fmt(d.raw), 'Erasure coding 8+2']
            ] as string[][]).map(r => [r[0], r[1], <span key="n" style={{ whiteSpace: 'normal', padding: '6px 0' }}>{r[2]}</span>])}
          />
          <MiniTable
            label="Recovery time"
            cols={[{ label: 'Restore' }, { label: 'Estimate', w: '160px', r: true }]}
            rows={[['One VM, instant recovery (runs from the repository)', '4 min'], ['One 200 GB VM, full restore', `${d.rtoVmMin} min`], [`Whole site, ${f.source} TB, ${d.proxies - 1} prox${d.proxies - 1 === 1 ? 'y' : 'ies'} working`, `${fmt(d.rtoSiteH)} h`]]}
          />
          <MiniTable
            label="Bill of materials"
            cols={[{ label: 'Item' }, { label: 'Quantity', w: '90px', r: true }, { label: 'Specification', w: '50%' }]}
            rows={([
              ['Backup proxy', String(d.proxies), '16 cores, 64 GB, 2 × 25 GbE, 480 GB boot'],
              ['Repository node', String(Math.max(4, Math.ceil(d.raw / 96))), `96 TB raw each; ${fmt(d.raw)} TB raw in all, erasure coding 8+2`],
              ...(f.copy === 'Yes' ? [['Offsite repository', 'S3', `${fmt(b.total / 2)} TB, object lock on`]] : []),
              ['Switch ports', String(d.proxies * 2 + Math.max(4, Math.ceil(d.raw / 96)) * 2), '25 GbE']
            ] as string[][]).map(r => [r[0], r[1], <span key="n" style={{ whiteSpace: 'normal', padding: '6px 0' }}>{r[2]}</span>])}
          />
        </>
      ) : null}
      {tab === 'cost' ? (
        <>
          <Tiles
            items={[
              { label: 'Per month', value: money(d.month, priced), icon: 'receipt', sub: priced ? 'Before GST' : 'Indicative; ask for a quote' },
              { label: '3 years', value: money(d.tco3, priced), icon: 'calendar', sub: '20 % growth a year' },
              { label: '5 years', value: money(d.tco5, priced), icon: 'calendar', sub: '20 % growth a year' }
            ]}
          />
          <MiniTable
            label="Monthly cost"
            cols={[{ label: 'Part' }, { label: 'A month', w: '160px', r: true }]}
            rows={[['Software (front-end TB)', money(d.price.software, priced)], ['Storage', money(d.price.storage, priced)], ['Egress for restores', money(d.price.egress, priced)], ['Infrastructure (proxies)', money(d.price.infra, priced)]]}
          />
          <MiniTable
            label="Against a capacity licence"
            cols={[{ label: 'Model' }, { label: '3 years', w: '130px', r: true }, { label: '5 years', w: '130px', r: true }]}
            rows={[
              [<strong key="a" style={{ fontWeight: 600 }}>Aegis subscription</strong>, money(d.tco3, priced), money(d.tco5, priced)],
              ['Capacity licence + 22 % support a year', money(d.comp3, priced), money(d.comp5, priced)],
              ['Difference', money(d.comp3 - d.tco3, priced), money(d.comp5 - d.tco5, priced)]
            ]}
          />
        </>
      ) : null}
      {tab === 'risk' ? (
        <>
          <Bar tone="info" multiline>A range, not one number: storage is {fmt(d.range[0])} to {fmt(d.range[2])} TB depending on how the data really behaves. Sizing to {fmt(d.range[1])} TB leaves the 25 % headroom to absorb most of the bad case.</Bar>
          <MiniTable
            label="Sensitivity"
            cols={[{ label: 'If' }, { label: 'Assumed', w: '100px', r: true }, { label: 'Worse', w: '100px', r: true }, { label: 'Stored TB', w: '110px', r: true }]}
            rows={[
              ['Daily change is higher', `${a.change} %`, `${fmt(a.change * 1.5)} %`, fmt(d.worseChange)],
              ['Deduplication is lower', `${a.dedupe}×`, `${fmt(a.dedupe * 0.7)}×`, fmt(d.worseDedupe)],
              ['Both at once', '—', '—', fmt(d.range[2])],
              ['Both better than assumed', '—', '—', fmt(d.range[0])]
            ]}
          />
        </>
      ) : null}
    </OutPanel>
  );
}

/** DR calculator outputs: can the link carry the RPO, and what DR costs against building a second site or suffering the outage. */
export function DrOutputs({ x, f, priced }: { x: ReturnType<typeof engine.drDesign>; f: Record<string, string>; priced: boolean }) {
  const [tab, setTab] = useState('feasible');
  const be = x.years.find(y => y.build <= y.rent);
  return (
    <OutPanel title="Feasibility and cost" tab={tab} onTab={setTab} tabs={[{ v: 'feasible', label: 'Feasibility' }, { v: 'cost', label: 'Cost and TCO' }]}>
      {tab === 'feasible' ? (
        <>
          <Tiles
            items={[
              { label: 'Achievable RPO', value: String(x.achievable), unit: 'min', icon: x.ok ? 'circle-check' : 'circle-x', tone: x.ok ? 'ok' : 'err', sub: x.ok ? `Feasible: the ${f.rpo} min target holds at peak` : `Not feasible: ${f.rpo} min needs more bandwidth` },
              { label: 'Bandwidth', value: fmt(x.needMbps, 0), unit: 'Mbit/s', icon: 'network', sub: `For ${f.rpo} min at three times the average change` },
              { label: 'First copy', value: fmt(x.seedDays), unit: 'days', icon: 'hard-drive', tone: x.seedDays > 7 ? 'warn' : undefined, sub: x.seedDays > 7 ? 'Seed by disk instead: about 4 days' : 'At 80 % of the link' },
              { label: 'Journal', value: fmt(x.journal, 2), unit: 'TB', icon: 'history', sub: `${f.hist} h of history to rewind into` }
            ]}
          />
          <Facts items={[{ k: 'RTO estimate', v: `${x.rtoMin} min: 4 boot stages of about 7 min, 5 min for DNS, 10 min of checks. Measured drills replace this once one has run.` }, { k: 'Formula', v: 'Peak change per minute × 3 ÷ 80 % of the link; journal = daily change × hours ÷ 24 ÷ compression' }]} />
        </>
      ) : (
        <>
          <Tiles
            items={[
              { label: 'DRaaS per month', value: money(x.draas, priced), icon: 'receipt', sub: 'Replication, journal, reserved compute, drills' },
              { label: 'Downtime avoided', value: money(x.saving, priced), icon: 'trending-up', tone: 'ok', sub: `A year: one site outage in four, at ₹${f.rev} lakh an hour` },
              { label: 'Payback', value: fmt(x.payback), unit: 'months', icon: 'timer' }
            ]}
          />
          <MiniTable
            label="Build or rent"
            cols={[{ label: 'Years' }, { label: 'Rent (DRaaS)', w: '150px', r: true }, { label: 'Build a second site', w: '170px', r: true }]}
            rows={x.years.map(y => [`${y.y} year${y.y > 1 ? 's' : ''}`, money(y.rent, priced), money(y.build, priced)])}
          />
          <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{be ? `Building becomes cheaper only after about ${be.y} years, and only if nothing else changes.` : 'Renting stays cheaper for all five years. Building assumes ₹2.4 crore of hardware and ₹9 lakh a month for space, power and two people.'}</span>
        </>
      )}
    </OutPanel>
  );
}

/** Migration calculator outputs: the business case a CFO approves. */
export function MigOutputs({ x, f, priced }: { x: ReturnType<typeof engine.migCost>; f: Record<string, string>; priced: boolean }) {
  return (
    <Panel title="Business case">
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Tiles
          items={[
            { label: 'One-off cost', value: money(x.oneOff, priced), icon: 'receipt', sub: 'Migration, services and transfer' },
            { label: 'Saved a month', value: money(x.saving, priced), icon: 'trending-down', tone: x.saving > 0 ? 'ok' : 'err', sub: `${money(x.current, priced)} today → ${money(x.target, priced)}` },
            { label: 'Payback', value: Number.isFinite(x.payback) ? fmt(x.payback) : '—', unit: Number.isFinite(x.payback) ? 'months' : undefined, icon: 'timer' },
            { label: 'NPV, 3 years', value: money(x.npv, priced), icon: 'trending-up', sub: 'At 10 % a year' }
          ]}
        />
        <MiniTable
          label="Total cost of ownership"
          cols={[{ label: 'Years' }, { label: 'Stay on VMware', w: '150px', r: true }, { label: 'Move to Host360', w: '150px', r: true }]}
          rows={x.years.map(y => [`${y.y} year${y.y > 1 ? 's' : ''}`, money(y.current, priced), money(y.target, priced)])}
        />
        <Facts items={[{ k: 'Today', v: `₹${f.vmw} lakh a year of licences, ${f.hosts} hosts amortised at ₹38,000 a month, ₹14,000 a month each for power, cooling and space` }, { k: 'After', v: 'Each server rightsized from its observed use: 22 % smaller on average. Servers with under 14 days of history keep their size.' }]} />
      </div>
    </Panel>
  );
}

type Line = [string, string, number, 'month' | 'once'];
/** Quote from the sizing: price book, discount with approval, partner margin and GST, as a proposal. */
export function QuoteDialog({ ctx, calc, lines, closing, onClose }: { ctx: Ctx; calc: 'backup' | 'dr' | 'mig'; lines: Line[]; closing: boolean; onClose: () => void }) {
  const custs = CUSTOMERS.filter(c => c.kind !== 'Internal');
  const [cust, setCust] = useState(custs[0].id);
  const [channel, setChannel] = useState('Direct');
  const [disc, setDisc] = useState('10');
  const dn = +disc;
  const discOk = /^\d{1,2}(\.\d)?$/.test(disc.trim()) && dn <= 30;
  const needsApproval = discOk && dn > 15;
  const monthly = lines.filter(l => l[3] === 'month').reduce((x, l) => x + l[2], 0);
  const once = lines.filter(l => l[3] === 'once').reduce((x, l) => x + l[2], 0);
  const after = monthly * (1 - (discOk ? dn : 0) / 100);
  const margin = channel === 'Direct' ? 0 : after * 0.2;
  const gst = (after + once) * 0.18;
  const id = `Q-2026-0${412 + lines.length}`;
  const save = () => {
    audit({ who: 'priya.raman', customer: cust, what: needsApproval ? 'Sent a quote for discount approval' : 'Saved a quote', object: id, when: ctx.now(), r: 'ok', after: [['Calculator', calc], ['Monthly', money(after)], ['One-off', money(once)], ['Discount', `${dn} %`], ['Channel', channel]] });
    ctx.toast(needsApproval ? `${id} sent to Rahul Menon (sales director) to approve the ${dn} % discount` : `${id} saved with its bill of materials; the proposal is on the customer’s record`, 'ok');
    onClose();
  };
  return (
    <Dialog
      size="lg"
      title="Make a quote"
      sub="From the sizing you just did, with the current price book. Nothing is sent to the customer until you send it."
      closing={closing}
      onClose={onClose}
      footNote="Prices from price book PB-2026-10. GST at 18 %."
      footer={
        <>
          <CopyCurl ctx={ctx} method="POST" path="/quotes" body={{ customer: cust, calculator: calc, discountPct: dn, channel }} />
          <span style={{ flex: 1 }} />
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={needsApproval ? 'send' : 'check'} disabled={!discOk} why={discOk ? undefined : 'A discount is 0 to 30 %; above 30 % needs the CFO outside Aegis.'} onClick={save}>{needsApproval ? 'Send for approval' : 'Save the quote'}</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
        <Field id="qt-c" label="Customer">
          <SelectInput id="qt-c" value={cust} onChange={setCust} options={custs.map(c => ({ v: c.id, label: c.name }))} />
        </Field>
        <Field id="qt-ch" label="Sold">
          <SelectInput id="qt-ch" value={channel} onChange={setChannel} options={['Direct', 'Through CloudNest IT Services (partner)']} />
        </Field>
        <Field id="qt-d" label="Discount on monthly (%)" err={discOk ? null : 'Between 0 and 30.'}>
          <TextInput id="qt-d" value={disc} onChange={setDisc} inputMode="numeric" />
        </Field>
      </div>
      <MiniTable
        label="Quote lines"
        cols={[{ label: 'Line' }, { label: 'Basis', w: '38%' }, { label: 'Amount', w: '170px', r: true }]}
        rows={[
          ...lines.map(l => [<strong key="l" style={{ fontWeight: 600 }}>{l[0]}</strong>, <span key="b" style={{ whiteSpace: 'normal' }}>{l[1]}</span>, l[2] ? `${money(l[2])}${l[3] === 'month' ? ' /mo' : ''}` : 'Included']),
          ['Discount', `${discOk ? dn : 0} % of monthly`, `−${money(monthly - after)} /mo`],
          ...(margin ? [['Partner margin (not shown to the customer)', '20 % of monthly after discount', `${money(margin)} /mo`]] : []),
          ['GST', '18 %', money(gst)],
          [<strong key="t" style={{ fontWeight: 600 }}>Total</strong>, 'Monthly after discount, and one-off', <strong key="v" style={{ fontWeight: 600, whiteSpace: 'normal', textAlign: 'right', padding: '6px 0' }}>{money(after)} /mo<br />+ {money(once)} once</strong>]
        ]}
      />
      {needsApproval ? <Bar tone="warn" multiline>Discounts above 15 % need the sales director (Rahul Menon) to approve before the quote can go to the customer.</Bar> : <Status icon="circle-check" tone="ok" label="Within the 15 % you can give without approval" />}
    </Dialog>
  );
}
