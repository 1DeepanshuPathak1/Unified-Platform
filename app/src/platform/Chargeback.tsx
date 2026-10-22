import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { USAGE } from '../data/commercial';
import { Btn, Field, Seg, SelectInput, TextInput } from '../ui/controls';
import { Bar, Facts, Spacer, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, inr } from './common';
import { audit, useStore } from './store';

type Split = 'Stored data' | 'Workload count' | 'Evenly';
const CC: Record<string, string> = { 'Core Banking': 'CC-CBS-110', Treasury: 'CC-TRS-220', 'IT Modernisation': 'CC-ITM-310', 'Shared services': 'CC-SHS-001' };
const PO: Record<string, string> = { 'Core Banking': 'PO/2026-27/0412', Treasury: 'PO/2026-27/0388' };

/**
 * Billing › Chargeback: usage priced per department or cost centre. Showback reports it;
 * chargeback bills it, as one invoice with a breakdown or one invoice per department.
 */
export function ChargebackTab({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const custs = s.customers.filter(c => inScope(ctx, c.id) && c.departments.length && USAGE.some(u => u.customer === c.id));
  const [cust, setCust] = useState(custs.find(c => c.id === 'mer')?.id || custs[0]?.id || 'h360');
  const [mode, setMode] = useState<'showback' | 'chargeback'>(cust === 'h360' ? 'showback' : 'chargeback');
  const [split, setSplit] = useState<Split>('Workload count');
  const [bill, setBill] = useState<'one' | 'each'>('one');
  const [codes, setCodes] = useState<Record<string, string>>(CC);
  const [pos, setPos] = useState<Record<string, string>>(PO);
  const edit = useClosable<string>();
  const c = s.customers.find(x => x.id === cust)!;
  const usage = USAGE.filter(u => u.customer === cust);
  const projOf = (d: (typeof c.departments)[number]) => d.projects.map(p => p.name);
  const direct = (d: (typeof c.departments)[number]) => usage.filter(u => projOf(d).includes(u.project)).reduce((a, u) => a + Math.round(u.qty * u.rate), 0);
  const shared = usage.filter(u => u.project === 'All').reduce((a, u) => a + Math.round(u.qty * u.rate), 0);
  const weight = (d: (typeof c.departments)[number]) => {
    const all = c.departments.reduce((a, x) => a + x.projects.reduce((b, p) => b + p.workloads, 0), 0) || 1;
    const mine = d.projects.reduce((b, p) => b + p.workloads, 0);
    if (split === 'Evenly') return 1 / c.departments.length;
    if (split === 'Stored data') return d.name === 'Core Banking' ? 0.62 : d.name === 'Treasury' ? 0.21 : d.name === 'IT Modernisation' ? 0.17 : mine / all;
    return mine / all;
  };
  const rows = c.departments.map(d => {
    const dir = direct(d);
    const sh = Math.round(shared * weight(d));
    return { d, dir, sh, total: dir + sh };
  });
  const total = rows.reduce((a, r) => a + r.total, 0);
  const missingPo = mode === 'chargeback' && bill === 'each' ? rows.filter(r => r.total > 0 && !pos[r.d.name]) : [];
  const cfg = ctx.can('admin', 'Changing how usage is billed');
  return (
    <>
      <Toolbar>
        {custs.length > 1 ? <SelectInput value={cust} onChange={v => { setCust(v); setMode(v === 'h360' ? 'showback' : 'chargeback'); }} options={custs.map(x => ({ v: x.id, label: x.name }))} width={260} /> : null}
        <Seg label="Mode" value={mode} onChange={setMode} options={[{ v: 'showback', label: 'Showback' }, { v: 'chargeback', label: 'Chargeback' }]} />
        <SelectInput value={split} onChange={v => setSplit(v as Split)} options={['Workload count', 'Stored data', 'Evenly'].map(v => ({ v, label: `Shared costs by ${v.toLowerCase()}` }))} width={250} />
        {mode === 'chargeback' ? <Seg label="Bill as" value={bill} onChange={setBill} options={[{ v: 'one', label: 'One invoice' }, { v: 'each', label: 'Invoice per department' }]} /> : null}
        <Spacer />
        <Btn kind="outline" icon="download" onClick={() => ctx.toast(`${c.name} chargeback for Oct 2026 exported (CSV with cost centres, for SAP and Tally)`, 'ok')}>Export</Btn>
      </Toolbar>
      <div style={{ padding: '0 24px 12px' }}>
        <Bar tone="info" icon={mode === 'showback' ? 'eye' : 'file-text'}>
          {mode === 'showback'
            ? `Showback: each department sees what it used and what it would cost. Nothing is invoiced to them.`
            : bill === 'one'
              ? `Chargeback on one invoice to ${c.name}, with a section per department and its cost centre.`
              : `Chargeback as ${plural(rows.filter(r => r.total > 0).length, 'invoice')}, one per department, each quoting its purchase order.`}
        </Bar>
      </div>
      {missingPo.length ? <div style={{ padding: '0 24px 12px' }}><Bar tone="warn">{missingPo.map(r => r.d.name).join(', ')} {missingPo.length === 1 ? 'has' : 'have'} no purchase order; {missingPo.length === 1 ? 'its invoice waits' : 'their invoices wait'} until one is added.</Bar></div> : null}
      <TableArea>
        <AegisTable
          label="Usage by department"
          cols={[
            { k: 'd', label: 'Department', w: 'minmax(170px,1.3fr)' },
            { k: 'cc', label: 'Cost centre', w: '130px' },
            { k: 'p', label: 'Projects', w: 'minmax(170px,1.3fr)', dim: true },
            { k: 'dir', label: 'Own usage', w: '120px', r: true },
            { k: 'sh', label: 'Share of shared', w: '140px', r: true },
            { k: 't', label: 'Total', w: '120px', r: true },
            ...(mode === 'chargeback' && bill === 'each' ? [{ k: 'po', label: 'Purchase order', w: '160px' }] : []),
            { k: 'e', label: '', w: '80px', r: true }
          ]}
          rows={rows.map(r => ({
            id: r.d.name,
            d: { v: r.d.name, strong: true },
            cc: codes[r.d.name] || { v: 'Not set', muted: true },
            p: { v: projOf(r.d).join(', '), tip: projOf(r.d).join(', ') },
            dir: { v: inr(r.dir), s: r.dir },
            sh: { v: inr(r.sh), s: r.sh, tip: `${Math.round(weight(r.d) * 100)} % of ${inr(shared)} shared usage` },
            t: { v: inr(r.total), s: r.total, strong: true },
            po: pos[r.d.name] ? pos[r.d.name] : r.total ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Missing' } : { v: 'Not needed', muted: true },
            e: { t: 'btn', v: 'Edit…', onClick: () => edit.open(r.d.name), disabled: !cfg.ok, why: cfg.why }
          }))}
          state={ctx.ui}
          unit={['department', 'departments']}
          emptyText="No departments yet. Add them in Customers; usage is grouped by their projects."
          footR={`Oct 2026 to date · ${inr(total)} before GST`}
          sort="t"
          dir={-1}
        />
      </TableArea>
      {edit.value ? (
        <Dialog
          title={`${edit.value}: billing details`}
          closing={edit.closing}
          onClose={edit.close}
          footer={<><Btn kind="ghost" onClick={edit.close}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => { audit({ who: 'priya.raman', customer: cust, what: 'Changed chargeback details', object: edit.value!, when: ctx.now(), r: 'ok' }); ctx.toast(`Billing details for ${edit.value} saved`, 'ok'); edit.close(); }}>Save</Btn></>}
        >
          <CodeFields name={edit.value} codes={codes} setCodes={setCodes} pos={pos} setPos={setPos} />
          <Facts items={[{ k: 'Own usage', v: 'Everything metered in the department’s projects' }, { k: 'Shared usage', v: `Lines metered for all projects (storage, replication capacity, the runbook service), split by ${split.toLowerCase()}` }]} />
        </Dialog>
      ) : null}
    </>
  );
}

function CodeFields({ name, codes, setCodes, pos, setPos }: { name: string; codes: Record<string, string>; setCodes: (f: (x: Record<string, string>) => Record<string, string>) => void; pos: Record<string, string>; setPos: (f: (x: Record<string, string>) => Record<string, string>) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Field id="cb-cc" label="Cost centre"><TextInput id="cb-cc" value={codes[name] || ''} onChange={v => setCodes(x => ({ ...x, [name]: v.toUpperCase() }))} mono placeholder="CC-XXX-000" /></Field>
      <Field id="cb-po" label="Purchase order"><TextInput id="cb-po" value={pos[name] || ''} onChange={v => setPos(x => ({ ...x, [name]: v }))} mono placeholder="PO/2026-27/0000" /></Field>
    </div>
  );
}
