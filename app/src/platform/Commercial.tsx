import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { CUSTOMERS } from '../data/platform';
import { INVOICES, QUOTAS, USAGE, money, placeOf, subtotal, taxOf, tdsOf, totalOf, type InvState, type Invoice, type Quota, type Usage } from '../data/commercial';
import { Btn, CheckBox, Field, FilterInput, InfoTip, RadioCard, Seg, SelectInput, TextArea, TextInput } from '../ui/controls';
import { Activity, Bar, DrawerTiles, Facts, MiniTable, Progress, Spacer, TableArea, Tiles, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, inr, showCustomerCol } from './common';
import { audit } from './store';

const partnerOf = (id: string) => CUSTOMERS.find(c => c.id === id)?.partner;
const billing = (u: Usage) => (u.poc ? 'Proof of concept' : u.customer === 'h360' ? 'Showback' : 'Invoiced');
const amountOf = (u: Usage) => Math.round(u.qty * u.rate);

/* ---------------------------------------------------------------- Usage and rating (3.16) */

type Group = 'records' | 'customer' | 'product';

/**
 * Usage and rating: every metered quantity for the open billing period, the rate applied and the
 * amount it adds to the draft invoice. Proof-of-concept and showback usage is rated at zero.
 */
export function MeteringTab({ ctx }: { ctx: Ctx }) {
  const [group, setGroup] = useState<Group>('records');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const customer = !!ctx.actingAs;
  const partner = ctx.actingAs ? partnerOf(ctx.actingAs.customer) : undefined;
  const all = USAGE.filter(u => inScope(ctx, u.customer));
  const ql = q.trim().toLowerCase();
  const rows = all.filter(u => !ql || `${custName(u.customer)} ${u.product} ${u.project} ${u.metric}`.toLowerCase().includes(ql));
  const billable = all.filter(u => billing(u) === 'Invoiced');
  const rated = billable.reduce((a, u) => a + amountOf(u), 0);
  const custCol = showCustomerCol(ctx);
  const d = drawer.value ? USAGE.find(u => u.id === drawer.value) : null;
  const sums = (key: (u: Usage) => string) =>
    Object.entries(rows.reduce<Record<string, Usage[]>>((a, u) => ((a[key(u)] ||= []).push(u), a), {})).map(([k, us]) => ({
      id: k,
      n: { v: group === 'customer' ? custName(k) : k, strong: true },
      lines: { v: plural(us.length, 'metric'), s: us.length },
      amt: { v: inr(us.reduce((a, u) => a + amountOf(u), 0)), s: us.reduce((a, u) => a + amountOf(u), 0) },
      bill: us.every(u => billing(u) !== 'Invoiced') ? { t: 'status', i: 'eye', c: 'tx', l: billing(us[0]) } : { t: 'status', i: 'file-text', c: 'run', l: 'On the draft invoice' }
    }));
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Rated so far', value: partner ? 'Set by partner' : inr(rated), icon: 'file-text', sub: partner ? `${partner} sets your prices` : '1–21 Oct 2026; closes 31 Oct, 23:59 IST' },
            { label: 'Metered items', value: `${all.length}`, icon: 'gauge', sub: `${plural(billable.length, 'item')} billed; the rest rated at zero` },
            { label: 'Not invoiced', value: `${all.length - billable.length}`, icon: 'eye', sub: 'Proof of concept and showback' },
            { label: 'Last metered', value: '15:00', unit: 'IST', icon: 'clock', tone: 'ok', sub: 'Every hour from every site; late readings are added, never lost' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Group by" value={group} onChange={setGroup} options={[{ v: 'records', label: 'Every metric' }, ...(custCol ? [{ v: 'customer' as Group, label: 'By customer' }] : []), { v: 'product', label: 'By product' }]} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter by customer, project or metric" label="Filter usage" />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Period: Oct 2026, open</span>
        <Btn kind="outline" icon="download" onClick={() => ctx.toast(`Exported ${plural(rows.length, 'usage record')} to CSV`, 'ok')}>Export CSV</Btn>
      </Toolbar>
      <TableArea>
        {group === 'records' ? (
          <AegisTable
            label="Usage records"
            cols={[
              ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(160px,1.2fr)' }] : []),
              { k: 'prod', label: 'Product', w: '110px' },
              { k: 'proj', label: 'Project', w: 'minmax(130px,1fr)', dim: true },
              { k: 'm', label: 'Metric', w: 'minmax(180px,1.5fr)' },
              { k: 'qty', label: 'Quantity', w: '170px', r: true },
              { k: 'rate', label: 'Rate', w: '100px', r: true, dim: true },
              { k: 'amt', label: 'Amount', w: '110px', r: true },
              { k: 'bill', label: 'Billing', w: '150px' }
            ]}
            rows={rows.map(u => ({
              id: u.id,
              cust: { v: custName(u.customer), strong: true },
              prod: u.product,
              proj: u.project,
              m: { v: u.metric, tip: u.how },
              qty: { v: `${u.qty.toLocaleString('en-IN')} ${u.unit}`, s: u.qty },
              rate: partner ? { v: 'Partner price', muted: true } : { v: inr(u.rate), s: u.rate },
              amt: partner ? { v: '—', muted: true } : { v: inr(amountOf(u)), s: amountOf(u), strong: amountOf(u) > 0 },
              bill: billing(u) === 'Invoiced' ? { t: 'status', i: 'file-text', c: 'run', l: 'Draft invoice' } : { t: 'status', i: 'eye', c: 'tx', l: billing(u), tip: u.how }
            }))}
            onRow={(id: string) => drawer.open(id)}
            active={drawer.value}
            state={ctx.ui}
            unit={['usage record', 'usage records']}
            filtered={!!ql}
            onClear={() => setQ('')}
            emptyText="Nothing metered yet this month. Usage appears within an hour of the first protected workload."
            footR={partner ? undefined : `Rated ${inr(rows.reduce((a, u) => a + (billing(u) === 'Invoiced' ? amountOf(u) : 0), 0))}`}
            sort="amt"
            dir={-1}
          />
        ) : (
          <AegisTable
            label={group === 'customer' ? 'Usage by customer' : 'Usage by product'}
            cols={[{ k: 'n', label: group === 'customer' ? 'Customer' : 'Product', w: 'minmax(200px,2fr)' }, { k: 'lines', label: 'Metrics', w: '120px', r: true }, { k: 'amt', label: 'Amount', w: '140px', r: true }, { k: 'bill', label: 'Billing', w: '200px' }]}
            rows={sums(group === 'customer' ? u => u.customer : u => u.product)}
            onRow={(id: string) => { setQ(group === 'customer' ? custName(id) : id); setGroup('records'); }}
            state={ctx.ui}
            unit={[group === 'customer' ? 'customer' : 'product', group === 'customer' ? 'customers' : 'products']}
            filtered={!!ql}
            onClear={() => setQ('')}
            emptyText="Nothing metered yet this month."
            sort="amt"
            dir={-1}
          />
        )}
      </TableArea>
      {d ? (
        <Drawer
          label="Usage record"
          kicker={`Usage · ${d.product} · Oct 2026`}
          title={d.metric}
          status={<><span>{custName(d.customer)}</span><span>{d.project === 'All' ? 'All projects' : d.project}</span></>}
          actions={!customer ? <Btn kind="outline" icon="file-text" onClick={() => { drawer.close(); ctx.go('billing/invoices'); }}>Open the draft invoice</Btn> : undefined}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <DrawerTiles items={[{ label: 'Quantity', value: d.qty.toLocaleString('en-IN'), sub: d.unit }, { label: 'Rate', value: partner ? 'Partner' : inr(d.rate), sub: `per ${d.unit.replace(/s$/, '').replace(/-months?$/, '-month').replace(/-days?$/, '-day')}` }, { label: 'Amount', value: partner ? '—' : inr(amountOf(d)), sub: billing(d) }]} />
            <div style={{ padding: '12px 14px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '13px/20px var(--f-ui)', fontVariantNumeric: 'tabular-nums' }}>
              {partner ? `${d.qty.toLocaleString('en-IN')} ${d.unit}; ${partner} applies its own price list.` : `${d.qty.toLocaleString('en-IN')} ${d.unit} × ${inr(d.rate)} = ${inr(amountOf(d))}`}
            </div>
            <Facts
              items={[
                { k: 'How it is counted', v: d.how },
                { k: 'Measured by', v: d.product === 'Services' ? 'Contract, fixed fee' : d.product === 'Mobility' ? 'Cutover commits' : 'Hourly reading from the orchestrator and each site' },
                { k: 'Rate card', v: d.rate === 0 ? 'Not charged' : `${CUSTOMERS.find(c => c.id === d.customer)?.plan || 'Standard'}, version 2026.3` },
                { k: 'Goes on', v: billing(d) === 'Invoiced' ? (partner ? `Host360 invoice to ${partner}` : `Draft invoice for ${custName(d.customer)}, Oct 2026`) : billing(d) === 'Showback' ? 'Monthly showback report to departments' : 'Nothing; free until the trial ends', muted: billing(d) !== 'Invoiced' }
              ]}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- Invoices (3.17) */

const INV_ST: Record<InvState, [string, string, string]> = {
  Draft: ['pencil', 'Draft', 'tx'],
  Issued: ['send', 'Issued', 'run'],
  'Part paid': ['clock', 'Part paid', 'warn'],
  Paid: ['circle-check', 'Paid', 'ok'],
  Overdue: ['triangle-alert', 'Overdue', 'err']
};
type InvView = 'all' | 'draft' | 'unpaid' | 'paid';

/**
 * Invoices with Indian GST (CGST and SGST inside Tamil Nadu, IGST across states, zero-rated
 * exports under LUT), e-invoice registration, TDS, payments by UTR and the dunning ladder.
 */
export function InvoicesTab({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Invoice[]>(INVOICES);
  const [view, setView] = useState<InvView>('all');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const issue = useClosable<string>();
  const pay = useClosable<string>();
  const credit = useClosable<string>();
  const profiles = useClosable<boolean>();
  useEffect(() => {
    if (ctx.openId && INVOICES.some(i => i.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const customer = !!ctx.actingAs;
  const partner = ctx.actingAs ? partnerOf(ctx.actingAs.customer) : undefined;
  const adm = ctx.can('admin', 'Issuing invoices and recording payments');
  // A customer billed through a partner never sees Host360's invoice to that partner.
  const all = list.filter(i => inScope(ctx, i.customer) && !(customer && i.billTo.includes('(partner)')));
  const unpaid = (i: Invoice) => i.state === 'Issued' || i.state === 'Overdue' || i.state === 'Part paid';
  const ql = q.trim().toLowerCase();
  const rows = all.filter(i => (view === 'all' || (view === 'draft' && i.state === 'Draft') || (view === 'unpaid' && unpaid(i)) || (view === 'paid' && i.state === 'Paid')) && (!ql || `${i.id} ${custName(i.customer)} ${i.billTo} ${i.period}`.toLowerCase().includes(ql)));
  const inrTotal = (xs: Invoice[]) => xs.filter(i => i.currency === 'INR').reduce((a, i) => a + totalOf(i), 0);
  const d = drawer.value ? list.find(i => i.id === drawer.value) : null;
  const patch = (id: string, p: Partial<Invoice>) => setList(x => x.map(i => (i.id === id ? { ...i, ...p } : i)));
  const custCol = showCustomerCol(ctx);
  const overdue = all.filter(i => i.state === 'Overdue');
  return (
    <>
      {partner ? (
        <div style={{ padding: '0 24px 12px' }}>
          <Bar tone="info" icon="building-2">{custName(ctx.actingAs!.customer)} is billed by {partner}. Their invoices come from them; usage here is what they are billed on.</Bar>
        </div>
      ) : (
        <div style={{ padding: '0 24px 12px' }}>
          <Tiles
            items={[
              { label: 'Drafts to issue', value: `${all.filter(i => i.state === 'Draft').length}`, icon: 'pencil', sub: 'Issued on 01 Nov, 10:00 IST after review' },
              { label: 'Outstanding', value: inr(inrTotal(all.filter(unpaid))), icon: 'clock', sub: all.some(i => i.currency === 'EUR' && unpaid(i)) ? `Plus ${money(all.filter(i => i.currency === 'EUR' && unpaid(i)).reduce((a, i) => a + totalOf(i), 0), 'EUR')}` : 'Issued and not yet paid' },
              { label: 'Overdue', value: `${overdue.length}`, icon: overdue.length ? 'triangle-alert' : 'circle-check', tone: overdue.length ? 'err' : 'ok', sub: overdue.map(i => `${custName(i.customer)}, ${inr(totalOf(i))}`).join('; ') || 'Nothing overdue' },
              { label: 'Collected in October', value: inr(all.filter(i => i.paid && i.currency === 'INR').reduce((a, i) => a + i.paid!.amount, 0)), icon: 'circle-check', tone: 'ok', sub: 'Net of TDS' }
            ]}
          />
        </div>
      )}
      <Toolbar>
        <Seg label="Show" value={view} onChange={setView} options={[{ v: 'all', label: 'All', count: all.length }, { v: 'draft', label: 'Draft', count: all.filter(i => i.state === 'Draft').length }, { v: 'unpaid', label: 'Unpaid', count: all.filter(unpaid).length }, { v: 'paid', label: 'Paid', count: all.filter(i => i.state === 'Paid').length }]} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter by number, customer or period" label="Filter invoices" />
        <Spacer />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>
          Host360 Managed Services · GSTIN 33AAKCH4021M1Z6
          <InfoTip tip="Billed from Chennai, Tamil Nadu. Customers in Tamil Nadu pay CGST and SGST; other states pay IGST; exports are zero-rated under a Letter of Undertaking." />
        </span>
        {!customer ? <Btn kind="outline" icon="scale" onClick={() => profiles.open(true)}>Billing and tax profiles</Btn> : null}
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Invoices"
          cols={[
            { k: 'n', label: 'Invoice', w: '140px' },
            ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(170px,1.3fr)' }] : []),
            { k: 'per', label: 'Period', w: 'minmax(110px,1fr)', dim: true },
            { k: 'tot', label: 'Total', w: '140px', r: true },
            { k: 'due', label: 'Due', w: '120px', r: true },
            { k: 'einv', label: 'e-Invoice', w: '130px' },
            { k: 'st', label: 'State', w: '130px' }
          ]}
          rows={rows.map(i => ({
            id: i.id,
            n: { v: i.id, strong: true },
            cust: { v: custName(i.customer), tip: i.billTo },
            per: i.period,
            tot: { v: money(totalOf(i), i.currency), s: i.currency === 'EUR' ? totalOf(i) * 90 : totalOf(i) },
            due: i.due,
            einv: i.irn ? { t: 'status', i: 'badge-check', c: 'ok', l: 'IRN issued', tip: i.irn } : { t: 'status', i: 'circle-minus', c: 'tx', l: 'At issue' },
            st: { t: 'status', i: INV_ST[i.state][0], c: INV_ST[i.state][2], l: INV_ST[i.state][1], tip: i.dunning ? i.dunning[i.dunning.length - 1].stage : INV_ST[i.state][1] }
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['invoice', 'invoices']}
          filtered={view !== 'all' || !!ql}
          onClear={() => { setView('all'); setQ(''); }}
          emptyText={partner ? `No invoices from Host360. ${partner} bills you directly.` : 'No invoices yet. The first draft is made on the 1st of the month after usage starts.'}
          footR="Totals include GST"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Invoice details"
          kicker={`Invoice · ${d.terms}`}
          title={`${d.id} · ${custName(d.customer)}`}
          status={
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name={INV_ST[d.state][0]} style={{ color: `var(--${INV_ST[d.state][2] === 'tx' ? 'tx-3' : INV_ST[d.state][2]})` }} />
                <span style={{ color: 'var(--tx)' }}>{INV_ST[d.state][1]}</span>
              </span>
              <span>{money(totalOf(d), d.currency)}</span>
              <span>Due {d.due}</span>
            </>
          }
          actions={
            customer ? (
              <Btn kind="outline" icon="download" onClick={() => ctx.toast(`${d.id}.pdf downloaded`, 'ok')}>Download PDF</Btn>
            ) : (
              <>
                {d.state === 'Draft' ? <Btn kind="primary" icon="send" perm={adm} onClick={() => issue.open(d.id)}>Issue…</Btn> : null}
                {d.state !== 'Draft' && d.state !== 'Paid' ? <Btn kind="primary" icon="check" perm={adm} onClick={() => pay.open(d.id)}>Record payment…</Btn> : null}
                {d.state === 'Issued' || d.state === 'Overdue' ? (
                  <Btn kind="outline" icon="mail" perm={adm} onClick={() => { patch(d.id, { dunning: [...(d.dunning || []), { stage: 'Reminder sent by priya.raman', when: ctx.now().slice(0, 11) }] }); audit({ who: 'priya.raman', customer: d.customer, what: 'Sent a payment reminder', object: d.id, when: ctx.now(), r: 'ok' }); ctx.toast(`Reminder for ${d.id} sent to the billing contact`, 'ok'); }}>
                    Send reminder
                  </Btn>
                ) : null}
                {d.state !== 'Draft' ? <Btn kind="outline" icon="undo-2" perm={adm} onClick={() => credit.open(d.id)}>Credit note…</Btn> : null}
                <Spacer />
                <Btn kind="ghost" icon="download" onClick={() => ctx.toast(`${d.id}.pdf downloaded${d.state === 'Draft' ? ' (marked DRAFT)' : ''}`, 'ok')}>PDF</Btn>
              </>
            )
          }
          tabs={[{ v: 'Overview', label: 'Overview' }, { v: 'Lines', label: 'Lines' }, { v: 'Tax', label: 'Tax' }, { v: 'Payments', label: 'Payments' }, ...(d.dunning ? [{ v: 'Dunning', label: 'Dunning' }] : [])]}
          tab={tab}
          onTab={setTab}
          width={680}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Overview' ? <InvoiceOverview d={d} /> : null}
          {tab === 'Lines' ? (
            <MiniTable
              label="Invoice lines"
              cols={[{ label: 'SAC', w: '64px' }, { label: 'Description' }, { label: 'Qty', w: '72px', r: true }, { label: 'Amount', w: '110px', r: true }]}
              rows={[
                ...d.lines.map(l => [l.sac, <span key="t" data-tip={l.text} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.text}</span>, l.qty, money(l.amount, d.currency)]),
                ...(d.discount ? [['', d.discount.text, '', `− ${money(d.discount.amount, d.currency)}`]] : []),
                ...(d.credit ? [['', d.credit.text, '', `− ${money(d.credit.amount, d.currency)}`]] : []),
                ['', <strong key="s" style={{ fontWeight: 600 }}>Taxable value</strong>, '', <strong key="v" style={{ fontWeight: 600 }}>{money(subtotal(d), d.currency)}</strong>]
              ]}
            />
          ) : null}
          {tab === 'Tax' ? <TaxBreakup d={d} /> : null}
          {tab === 'Payments' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.paid ? (
                <MiniTable label="Payments" cols={[{ label: 'Received', w: '130px' }, { label: 'Mode', w: '64px' }, { label: 'Reference' }, { label: 'Amount', w: '110px', r: true }]} rows={[[d.paid.when, d.paid.mode, d.paid.ref, money(d.paid.amount, d.currency)]]} />
              ) : (
                <p style={{ color: 'var(--tx-2)' }}>{d.state === 'Draft' ? 'Not issued yet, so nothing is due.' : `Nothing received yet. Expected ${money(totalOf(d) - tdsOf(d), d.currency)}${d.tds ? ' after TDS' : ''} by ${d.due}.`}</p>
              )}
              {d.tds ? <Facts items={[{ k: 'TDS deducted', v: `${d.tds} % under section 194J: ${money(tdsOf(d), d.currency)}` }, { k: 'Form 16A', v: d.paid ? 'Due from the customer by 15 Feb 2027 (Q3 TDS return)' : 'After payment', muted: !d.paid }]} /> : null}
              <Facts items={[{ k: 'Pay to', v: 'Host360 Managed Services, HDFC Bank, Anna Salai, Chennai' }, { k: 'Account', v: '50200061234118 · IFSC HDFC0000082' }, ...(d.currency === 'EUR' ? [{ k: 'SEPA', v: 'Deutsche Bank, IBAN DE44 5007 0010 0954 8811 00 · BIC DEUTDEFF' }] : [{ k: 'UPI', v: 'host360@hdfcbank (up to ₹2,00,000)' }])]} />
            </div>
          ) : null}
          {tab === 'Dunning' && d.dunning ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.state === 'Overdue' ? <Bar tone="err" icon="ban" multiline>Suspended for non-payment since {d.dunning.find(x => x.stage.startsWith('Suspended'))?.when || 'the final notice'}. Backups keep running; restores and changes are blocked until this is paid or a credit limit is set.</Bar> : null}
              <Activity items={[...d.dunning].reverse().map(x => ({ icon: x.stage.startsWith('Suspended') ? 'ban' : x.stage.startsWith('Final') ? 'triangle-alert' : 'mail', tone: x.stage.startsWith('Suspended') ? 'err' : x.stage.startsWith('Final') ? 'warn' : undefined, text: x.stage, when: x.when }))} />
              <Facts items={[{ k: 'Ladder', v: '3 days after due: reminder · 14 days: second reminder and call · 24 days: final notice · 31 days: suspend' }, { k: 'Never stops', v: 'Running backups and replication, so no recovery point is lost' }]} />
            </div>
          ) : null}
        </Drawer>
      ) : null}
      {issue.value ? (
        <IssueDialog
          inv={list.find(i => i.id === issue.value)!}
          closing={issue.closing}
          onClose={issue.close}
          onIssue={sent => {
            const i = list.find(x => x.id === issue.value)!;
            const irn = `${Math.random().toString(16).slice(2, 8)}…${Math.random().toString(16).slice(2, 6)} (IRP, ${ctx.now()})`;
            patch(i.id, { state: 'Issued', issued: ctx.now().slice(0, 11), irn });
            audit({ who: 'priya.raman', customer: i.customer, what: 'Issued an invoice', object: i.id, when: ctx.now(), r: 'ok', after: [['Total', money(totalOf(i), i.currency)], ['IRN', irn]] });
            ctx.toast(`${i.id} issued with an IRN${sent ? ' and emailed to the billing contact' : ''}`, 'ok');
            issue.close();
          }}
        />
      ) : null}
      {pay.value ? (
        <PaymentDialog
          inv={list.find(i => i.id === pay.value)!}
          closing={pay.closing}
          onClose={pay.close}
          onSave={p => {
            const i = list.find(x => x.id === pay.value)!;
            const full = p.amount >= totalOf(i) - tdsOf(i);
            patch(i.id, { state: full ? 'Paid' : 'Part paid', paid: { ...p, when: ctx.now() } });
            audit({ who: 'priya.raman', customer: i.customer, what: 'Recorded a payment', object: i.id, when: ctx.now(), r: 'ok', after: [['Amount', money(p.amount, i.currency)], ['Reference', p.ref]] });
            ctx.toast(full ? `${i.id} marked paid${i.state === 'Overdue' ? '; the suspension is lifted' : ''}` : `Part payment recorded on ${i.id}`, 'ok');
            pay.close();
          }}
        />
      ) : null}
      {profiles.value ? <ProfilesDialog ctx={ctx} closing={profiles.closing} onClose={profiles.close} /> : null}
      {credit.value ? (
        <CreditDialog
          inv={list.find(i => i.id === credit.value)!}
          closing={credit.closing}
          onClose={credit.close}
          onSave={(amount, why) => {
            const i = list.find(x => x.id === credit.value)!;
            const n = `CN-2026-${String(41 + Math.floor(Math.random() * 50)).padStart(4, '0')}`;
            audit({ who: 'priya.raman', customer: i.customer, what: 'Issued a credit note', object: `${n} against ${i.id}`, when: ctx.now(), r: 'ok', after: [['Amount', money(amount, i.currency)], ['Reason', why]] });
            ctx.toast(`${n} for ${money(amount, i.currency)} issued against ${i.id}`, 'ok');
            credit.close();
          }}
        />
      ) : null}
    </>
  );
}

function InvoiceOverview({ d }: { d: Invoice }) {
  const tds = tdsOf(d);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {d.state === 'Overdue' ? <Bar tone="err" icon="triangle-alert">Overdue since {d.due}. {d.dunning?.[d.dunning.length - 1].stage}.</Bar> : null}
      {d.state === 'Draft' ? <Bar tone="info" icon="pencil">Draft from metered usage to 21 Oct. Lines update every hour until the period closes on 31 Oct.</Bar> : null}
      <DrawerTiles
        items={[
          { label: 'Total with GST', value: money(totalOf(d), d.currency), sub: `Taxable ${money(subtotal(d), d.currency)}` },
          { label: d.tds ? 'Expected after TDS' : 'Expected', value: money(totalOf(d) - tds, d.currency), sub: d.tds ? `TDS ${d.tds} %: ${money(tds, d.currency)}` : 'No TDS' },
          { label: 'State', value: INV_ST[d.state][1], icon: INV_ST[d.state][0], tone: INV_ST[d.state][2], sub: d.paid ? `Paid ${d.paid.when}` : `Due ${d.due}` }
        ]}
      />
      <Facts
        items={[
          { k: 'Bill to', v: d.billTo },
          { k: 'GSTIN', v: d.gstin || 'Not applicable (outside India)', muted: !d.gstin },
          { k: 'Place of supply', v: placeOf(d) },
          { k: 'Period', v: d.period },
          { k: 'Issued', v: d.issued, muted: d.state === 'Draft' },
          { k: 'Terms', v: `${d.terms}; due ${d.due}` },
          ...(d.commitment ? [{ k: 'Commitment', v: d.commitment }] : []),
          { k: 'e-Invoice', v: d.irn ? `IRN ${d.irn}` : 'Registered with the IRP when issued; the QR code is printed on the PDF', icon: d.irn ? 'badge-check' : undefined, tone: d.irn ? 'ok' : undefined, muted: !d.irn }
        ]}
      />
    </div>
  );
}

function TaxBreakup({ d }: { d: Invoice }) {
  const tax = taxOf(d);
  const export_ = d.currency === 'EUR';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MiniTable
        label="Tax breakup"
        cols={[{ label: 'Tax' }, { label: 'Rate', w: '64px', r: true }, { label: 'On', w: '110px', r: true }, { label: 'Amount', w: '110px', r: true }]}
        rows={[...tax.map(t => [t.kind, `${t.rate} %`, money(subtotal(d), d.currency), money(t.amount, d.currency)]), ['', '', <strong key="l" style={{ fontWeight: 600 }}>Total</strong>, <strong key="t" style={{ fontWeight: 600 }}>{money(totalOf(d), d.currency)}</strong>]]}
      />
      <Facts
        items={[
          { k: 'Why this tax', v: export_ ? 'Export of services, zero-rated under LUT ARN AD330326001234X (FY 2026–27). The customer accounts for VAT in Germany under the reverse charge.' : d.tax[0].kind === 'IGST' ? `Inter-state supply: Tamil Nadu to ${placeOf(d).split(' (')[0]}, so IGST.` : 'Intra-state supply inside Tamil Nadu, so CGST and SGST.' },
          { k: 'SAC codes', v: [...new Set(d.lines.map(l => l.sac))].map(s => (s === '998316' ? '998316 IT infrastructure management' : s === '998315' ? '998315 Hosting and storage' : '997331 Software licences')).join(' · ') },
          ...(d.tds ? [{ k: 'TDS', v: `The customer deducts ${d.tds} % (${money(tdsOf(d), d.currency)}) on the taxable value and deposits it; GST is not reduced.` }] : [])
        ]}
      />
    </div>
  );
}

function IssueDialog({ inv, closing, onClose, onIssue }: { inv: Invoice; closing: boolean; onClose: () => void; onIssue: (sent: boolean) => void }) {
  const [sent, setSent] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={`Issue ${inv.id}`}
      sub={`${custName(inv.customer)} · ${inv.period} · ${money(totalOf(inv), inv.currency)}`}
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon={busy ? 'loader-circle' : 'send'} spin={busy} disabled={busy} why="Registering with the IRP." onClick={() => { setBusy(true); window.setTimeout(() => onIssue(sent), 900); }}>
            {busy ? 'Registering…' : 'Register and issue'}
          </Btn>
        </>
      }
      footNote="An issued invoice cannot be edited. Corrections are made with a credit note."
    >
      <Facts
        items={[
          { k: 'Taxable value', v: money(subtotal(inv), inv.currency) },
          { k: 'Tax', v: taxOf(inv).map(t => `${t.kind} ${money(t.amount, inv.currency)}`).join(' · ') },
          { k: 'Total', v: money(totalOf(inv), inv.currency) },
          { k: 'e-Invoice', v: 'Registered with the Invoice Registration Portal; the IRN and signed QR code go on the PDF' },
          { k: 'Usage closes', v: 'Usage to 21 Oct is on this draft. Usage after issue goes on next month’s invoice.' }
        ]}
      />
      <CheckBox on={sent} onChange={setSent}>Email the PDF to the billing contact ({inv.customer === 'mer' ? 'accounts.payable@meridianbank.in' : inv.customer === 'kav' ? 'finance@kaverilogistics.in' : inv.customer === 'sah' ? 'billing@cloudnest.in' : 'billing contact'})</CheckBox>
    </Dialog>
  );
}

function PaymentDialog({ inv, closing, onClose, onSave }: { inv: Invoice; closing: boolean; onClose: () => void; onSave: (p: { mode: 'NEFT' | 'RTGS' | 'UPI' | 'SEPA'; ref: string; amount: number }) => void }) {
  const expected = totalOf(inv) - tdsOf(inv);
  const [mode, setMode] = useState<'NEFT' | 'RTGS' | 'UPI' | 'SEPA'>(inv.currency === 'EUR' ? 'SEPA' : 'NEFT');
  const [ref, setRef] = useState('');
  const [amt, setAmt] = useState(String(expected));
  const n = +amt;
  const refOk = mode === 'SEPA' ? ref.trim().length >= 6 : /^[A-Z0-9]{12,22}$/.test(ref.trim().replace(/^UTR\s*/i, ''));
  const ok = refOk && n > 0;
  return (
    <Dialog
      title={`Record a payment on ${inv.id}`}
      sub={`Expected ${money(expected, inv.currency)}${inv.tds ? ` (total less ${inv.tds} % TDS)` : ''}`}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!ok} why={!refOk ? (mode === 'SEPA' ? 'Give the SEPA end-to-end reference.' : 'Give the 12 to 22 character UTR from the bank statement.') : 'Give the amount received.'} onClick={() => onSave({ mode, ref: mode === 'SEPA' ? ref.trim() : `UTR ${ref.trim().replace(/^UTR\s*/i, '').toUpperCase()}`, amount: n })}>Record payment</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="pay-m" label="Paid by">
          <SelectInput id="pay-m" value={mode} onChange={v => setMode(v as typeof mode)} options={inv.currency === 'EUR' ? ['SEPA'] : ['NEFT', 'RTGS', 'UPI']} />
        </Field>
        <Field id="pay-a" label={`Amount received (${inv.currency})`} hint={n && n < expected ? `${money(expected - n, inv.currency)} short; recorded as part paid.` : undefined}>
          <TextInput id="pay-a" value={amt} onChange={v => setAmt(v.replace(/[^\d.]/g, ''))} inputMode="numeric" />
        </Field>
        <Field id="pay-r" label={mode === 'SEPA' ? 'End-to-end reference' : 'UTR'} span={2} hint={mode === 'SEPA' ? undefined : 'From the bank statement, e.g. HDFCN52026102112345'}>
          <TextInput id="pay-r" value={ref} onChange={setRef} mono placeholder={mode === 'SEPA' ? 'ATL-2026-1010' : 'HDFCN52026102112345'} />
        </Field>
      </div>
      {inv.state === 'Overdue' ? <p style={{ display: 'flex', gap: 8 }}><Icon name="info" style={{ color: 'var(--tx-2)', marginTop: 2 }} />Paying in full lifts the suspension for {custName(inv.customer)} at once.</p> : null}
    </Dialog>
  );
}

function CreditDialog({ inv, closing, onClose, onSave }: { inv: Invoice; closing: boolean; onClose: () => void; onSave: (amount: number, why: string) => void }) {
  const [amt, setAmt] = useState('');
  const [reason, setReason] = useState('SLA credit');
  const [note, setNote] = useState('');
  const max = subtotal(inv);
  const n = +amt;
  const ok = n > 0 && n <= max && note.trim().length >= 6;
  return (
    <Dialog
      title={`Credit note against ${inv.id}`}
      sub={`Up to ${money(max, inv.currency)} of the taxable value. GST is reversed in proportion.`}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!ok} why={n > max ? `At most ${money(max, inv.currency)}.` : 'Give an amount and a reason the customer will read.'} onClick={() => onSave(n, `${reason}: ${note.trim()}`)}>Issue credit note</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="cn-a" label={`Amount before tax (${inv.currency})`} err={n > max ? `At most ${money(max, inv.currency)}.` : null}>
          <TextInput id="cn-a" value={amt} onChange={v => setAmt(v.replace(/[^\d.]/g, ''))} inputMode="numeric" invalid={n > max} />
        </Field>
        <Field id="cn-r" label="Reason">
          <SelectInput id="cn-r" value={reason} onChange={setReason} options={['SLA credit', 'Billing error', 'Goodwill', 'Cancelled service']} />
        </Field>
        <Field id="cn-n" label="Shown on the credit note" span={2}>
          <TextArea id="cn-n" value={note} onChange={setNote} rows={2} placeholder="RPO missed on cbs-db-01, 14 Oct, 42 minutes" />
        </Field>
      </div>
      {n > 0 && n <= max ? <p style={{ color: 'var(--tx-2)' }}>Credit with tax: {money(Math.round(n * (1 + inv.tax.reduce((a, t) => a + t.rate, 0) / 100)), inv.currency)}.</p> : null}
    </Dialog>
  );
}

const TAX_PROFILES = [
  { n: 'India GST, intra-state', applies: 'Customers in Tamil Nadu', how: 'CGST 9 % + SGST 9 % on SAC 998315, 998316 and 997331; e-invoice IRN at issue', used: 'Kaveri Logistics, Coromandel Insurance' },
  { n: 'India GST, inter-state', applies: 'Customers in other Indian states', how: 'IGST 18 %; place of supply from the customer’s GSTIN', used: 'Meridian Cooperative Bank, CloudNest IT Services' },
  { n: 'Export of services under LUT', applies: 'Customers outside India', how: 'Zero-rated; LUT ARN AD330326001234X for FY 2026–27; paid in foreign currency', used: 'Atlas Freight GmbH' },
  { n: 'EU VAT, reverse charge', applies: 'EU businesses with a valid VAT number (checked in VIES)', how: 'No VAT charged; invoice states “Reverse charge, Article 196 VAT Directive”', used: 'Atlas Freight GmbH' },
  { n: 'US sales tax', applies: 'US customers, by state where Host360 has nexus', how: 'Rate by ship-to address from Avalara AvaTax; SaaS taxable in TX, NY, WA, PA and others; exemption certificates kept per customer; filed monthly', used: 'No US customers yet; ready for the Host360 Inc. entity' },
  { n: 'TDS (section 194J)', applies: 'Indian customers who deduct tax at source', how: '2 % on the taxable value; Form 16A tracked each quarter against 26AS', used: 'Meridian Cooperative Bank' }
];
const BILLING_PROFILES = [
  { c: 'mer', cur: 'INR', freq: 'Monthly', terms: 'Postpaid, net 5', commit: '₹1,20,00,000 a year', pay: 'RTGS' },
  { c: 'kav', cur: 'INR', freq: 'Monthly', terms: 'Postpaid, net 5; 2 % early-payment discount', commit: 'None', pay: 'NEFT' },
  { c: 'sah', cur: 'INR', freq: 'Monthly, to CloudNest', terms: 'Postpaid, net 5', commit: 'Through partner', pay: 'NEFT' },
  { c: 'cor', cur: 'INR', freq: 'Monthly', terms: 'Postpaid, net 5', commit: 'None', pay: 'NEFT' },
  { c: 'atl', cur: 'EUR', freq: 'Annual', terms: 'Prepaid, net 14', commit: '€18,600 a year', pay: 'SEPA' },
  { c: 'nil', cur: 'INR', freq: 'None during the trial', terms: 'Trial ends 04 Nov 2026', commit: 'None', pay: '—' }
];

function ProfilesDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [view, setView] = useState<'billing' | 'tax'>('billing');
  const [freq, setFreq] = useState<Record<string, string>>(Object.fromEntries(BILLING_PROFILES.map(b => [b.c, b.freq])));
  const changed = BILLING_PROFILES.filter(b => freq[b.c] !== b.freq);
  return (
    <Dialog
      title="Billing and tax profiles"
      sub="How often each customer is invoiced, in which currency and on what terms, and the tax rules invoices follow."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Close</Btn>{view === 'billing' ? <Btn kind="primary" icon="check" disabled={!changed.length} why="Nothing has changed." onClick={() => { changed.forEach(b => audit({ who: 'priya.raman', customer: b.c, what: 'Changed invoice frequency', object: custName(b.c), when: ctx.now(), r: 'ok', before: [['Frequency', b.freq]], after: [['Frequency', freq[b.c]]] })); ctx.toast(`Invoice frequency changed for ${plural(changed.length, 'customer')}; it applies from the next period`, 'ok'); onClose(); }}>Save</Btn> : null}</>}
    >
      <Seg label="Show" value={view} onChange={setView} options={[{ v: 'billing', label: 'Billing profiles' }, { v: 'tax', label: 'Tax profiles' }]} />
      {view === 'billing' ? (
        <MiniTable
          label="Billing profiles"
          cols={[{ label: 'Customer' }, { label: 'Currency', w: '72px' }, { label: 'Invoiced', w: '170px' }, { label: 'Terms', w: '190px' }, { label: 'Commitment', w: '140px' }]}
          rows={BILLING_PROFILES.map(b => [<strong key="c" style={{ fontWeight: 600 }}>{custName(b.c)}</strong>, b.cur, b.c === 'nil' || b.c === 'sah' ? b.freq : <SelectInput key="f" value={freq[b.c]} onChange={v => setFreq(x => ({ ...x, [b.c]: v }))} options={['Monthly', 'Quarterly', 'Annual']} width={150} />, <span key="t" data-tip={b.terms} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.terms}</span>, b.commit])}
        />
      ) : (
        <MiniTable
          label="Tax profiles"
          cols={[{ label: 'Profile', w: '190px' }, { label: 'How it is applied' }, { label: 'Used by', w: '170px' }]}
          rows={TAX_PROFILES.map(t => [<strong key="n" style={{ fontWeight: 600 }} data-tip={t.applies}>{t.n}</strong>, <span key="h" data-tip={t.how} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.how}</span>, <span key="u" data-tip={t.used} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: t.used.startsWith('No ') ? 'var(--tx-3)' : undefined }}>{t.used}</span>])}
        />
      )}
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Quotas (3.20) */

type Res = 'backup' | 'drVcpu' | 'drRam' | 'drStore' | 'staging';
const RES: { k: Res; label: string; unit: string; icon: string }[] = [
  { k: 'backup', label: 'Backup storage', unit: 'TB', icon: 'database' },
  { k: 'drVcpu', label: 'DR compute', unit: 'vCPU', icon: 'cpu' },
  { k: 'drRam', label: 'DR memory', unit: 'GB', icon: 'layers' },
  { k: 'drStore', label: 'DR storage', unit: 'TB', icon: 'hard-drive' },
  { k: 'staging', label: 'Migration staging', unit: 'TB', icon: 'arrow-left-right' }
];
const lc = (s: string) => (s.startsWith('DR') ? s : s[0].toLowerCase() + s.slice(1));
const tone = (u: number, q: number) => (u > q ? 'err' : u / q >= 0.9 ? 'warn' : 'ok');

/** Resource quotas per tenant: backup storage, reserved DR capacity and migration staging. */
export function QuotaTab({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Quota[]>(QUOTAS);
  const drawer = useClosable<string>();
  const edit = useClosable<string>();
  const customer = !!ctx.actingAs;
  const cfg = ctx.can('admin', 'Changing quotas');
  const all = list.filter(q => inScope(ctx, q.customer));
  const d = drawer.value ? list.find(q => q.customer === drawer.value) : null;
  const near = all.filter(q => RES.some(r => q[r.k][1] && q[r.k][0] / q[r.k][1] >= 0.9));
  const cell = (q: Quota, r: Res) => (q[r][1] ? { t: 'bar', pct: (q[r][0] / q[r][1]) * 100, c: tone(q[r][0], q[r][1]), v: `${q[r][0]} of ${q[r][1]}` } : { v: 'None', muted: true, s: -1 });
  return (
    <>
      {near.length ? (
        <div style={{ padding: '0 24px 12px' }}>
          <Bar tone="warn">{near.map(q => `${custName(q.customer)}: ${RES.filter(r => q[r.k][1] && q[r.k][0] / q[r.k][1] >= 0.9).map(r => lc(r.label)).join(', ')}`).join(' · ')} at 90 % or more.</Bar>
        </div>
      ) : null}
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>{customer ? 'What your organisation may use. Ask Host360 to raise a quota.' : 'What each tenant may use. Reserved DR capacity is held at the recovery site whether or not it is in use.'}</span>
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Quotas"
          cols={[{ k: 'c', label: 'Customer', w: 'minmax(170px,1.3fr)' }, ...RES.map(r => ({ k: r.k, label: `${r.label} (${r.unit})`, w: 'minmax(150px,1fr)' })), { k: 'over', label: 'Over quota', w: 'minmax(150px,1fr)', dim: true }]}
          rows={all.map(q => ({ id: q.customer, c: { v: custName(q.customer), strong: true }, ...Object.fromEntries(RES.map(r => [r.k, cell(q, r.k)])), over: q.over }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['tenant', 'tenants']}
          emptyText="No quotas yet. Each tenant gets its plan's quotas when it is onboarded."
          footR="Usage read every 15 min"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Quotas"
          kicker="Quotas"
          title={custName(d.customer)}
          status={<span>{d.over}</span>}
          actions={customer ? <Btn kind="outline" icon="life-buoy" onClick={() => { drawer.close(); ctx.go('support/requests'); ctx.toast('Raise a request in Support to ask for a higher quota', 'info'); }}>Ask for more…</Btn> : <Btn kind="outline" icon="pencil" perm={cfg} onClick={() => edit.open(d.customer)}>Edit quotas…</Btn>}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {RES.map(r => (
              <div key={r.k}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '13px/18px var(--f-ui)', marginBottom: 6 }}>
                  <Icon name={r.icon} style={{ color: 'var(--tx-2)' }} />
                  <span>{r.label}</span>
                  <Spacer />
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: d[r.k][1] ? 'var(--tx)' : 'var(--tx-3)', fontStyle: d[r.k][1] ? 'normal' : 'italic' }}>{d[r.k][1] ? `${d[r.k][0]} of ${d[r.k][1]} ${r.unit} · ${Math.round((d[r.k][0] / d[r.k][1]) * 100)} %` : 'Not in the plan'}</span>
                </div>
                {d[r.k][1] ? <Progress pct={(d[r.k][0] / d[r.k][1]) * 100} tone={tone(d[r.k][0], d[r.k][1])} /> : null}
              </div>
            ))}
            <Facts items={[{ k: 'Over quota', v: d.over }, { k: 'Alerts at', v: '80 % and 90 %, to the tenant owner and the Host360 account manager' }, { k: 'Never blocked', v: 'Restores, failovers and running replication, whatever the quota' }]} />
          </div>
        </Drawer>
      ) : null}
      {edit.value ? (
        <QuotaDialog
          q={list.find(q => q.customer === edit.value)!}
          closing={edit.closing}
          onClose={edit.close}
          onSave={n => {
            const old = list.find(q => q.customer === n.customer)!;
            setList(x => x.map(q => (q.customer === n.customer ? n : q)));
            audit({ who: 'priya.raman', customer: n.customer, what: 'Changed quotas', object: custName(n.customer), when: ctx.now(), r: 'ok', before: RES.filter(r => old[r.k][1] !== n[r.k][1]).map(r => [r.label, `${old[r.k][1]} ${r.unit}`] as [string, string]), after: RES.filter(r => old[r.k][1] !== n[r.k][1]).map(r => [r.label, `${n[r.k][1]} ${r.unit}`] as [string, string]) });
            ctx.toast(`Quotas for ${custName(n.customer)} saved`, 'ok');
            edit.close();
          }}
        />
      ) : null}
    </>
  );
}

function QuotaDialog({ q, closing, onClose, onSave }: { q: Quota; closing: boolean; onClose: () => void; onSave: (q: Quota) => void }) {
  const [v, setV] = useState<Record<Res, string>>(Object.fromEntries(RES.map(r => [r.k, String(q[r.k][1])])) as Record<Res, string>);
  const [over, setOver] = useState<Quota['over']>(q.over);
  const below = RES.filter(r => v[r.k] !== '' && +v[r.k] < q[r.k][0]);
  const bad = RES.some(r => !/^\d+(\.\d+)?$/.test(v[r.k]));
  return (
    <Dialog
      title={`Quotas for ${custName(q.customer)}`}
      sub="Changes apply within 15 minutes. Billing follows the plan, not the quota."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={bad} why="Give every quota as a number; 0 means not in the plan." onClick={() => onSave({ ...q, over, ...Object.fromEntries(RES.map(r => [r.k, [q[r.k][0], +v[r.k]]])) })}>Save</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
        {RES.map(r => (
          <Field key={r.k} id={`qt-${r.k}`} label={`${r.label} (${r.unit})`} hint={`${q[r.k][0]} in use`}>
            <TextInput id={`qt-${r.k}`} value={v[r.k]} onChange={x => setV(s => ({ ...s, [r.k]: x.replace(/[^\d.]/g, '') }))} inputMode="numeric" />
          </Field>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>When usage reaches the quota</span>
        {(['Allow 10 % burst, then alert', 'Block new backups at the quota', 'Alert only'] as Quota['over'][]).map(o => (
          <RadioCard key={o} on={over === o} onClick={() => setOver(o)} title={o} note={o === 'Block new backups at the quota' ? 'New backups wait; existing backups and restores keep working' : o === 'Alert only' ? 'Usage over the quota is billed as overage' : 'The extra 10 % is billed as overage'} />
        ))}
      </div>
      {below.length ? (
        <p style={{ display: 'flex', gap: 8 }}>
          <Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: 2 }} />
          Below what is in use for {below.map(r => lc(r.label)).join(', ')}. {over === 'Block new backups at the quota' && below.some(r => r.k === 'backup') ? 'New backups stop at once.' : 'The tenant is alerted at once.'}
        </p>
      ) : null}
    </Dialog>
  );
}
