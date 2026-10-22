import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { pc } from '../../lib/pseudo';
import { Btn } from '../../ui/controls';
import { Bar, MiniTable, Panel, Status } from '../../ui/layout';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope } from '../../platform/common';

type St = 'Met' | 'Partly' | 'Gap';
interface Req { id: string; text: string; from: string; status: Record<string, St>; why?: Record<string, string> }
interface Fw { id: string; name: string; short: string; applies: string[]; note?: string; reqs: Req[] }
const FW: Fw[] = [
  {
    id: 'rbi', short: 'RBI', name: 'RBI Master Direction on IT governance, risk, controls and assurance (2023): BCP and DR', applies: ['mer'],
    reqs: [
      { id: 'r1', text: 'Drills of critical systems at least every six months, from the DR site', from: 'Drill calendar and drill records', status: { mer: 'Met' }, why: { mer: 'CBS failover tested 28 Sep; next booked 28 Oct, monthly' } },
      { id: 'r2', text: 'RTO and RPO set, approved and met for critical systems', from: 'Protection plans, measured drills', status: { mer: 'Partly' }, why: { mer: '2 Tier 1 workloads behind RPO since region-2-os stopped answering at 14:52' } },
      { id: 'r3', text: 'DR site away from the primary, on a separate power grid', from: 'Sites', status: { mer: 'Met' }, why: { mer: 'Chennai DC1 to Mumbai DC2, 1,030 km' } },
      { id: 'r4', text: 'Payment system data stored only in India', from: 'Data residency rules', status: { mer: 'Met' } },
      { id: 'r5', text: 'Failover of critical systems approved by two people', from: 'Approval rules', status: { mer: 'Met' } },
      { id: 'r6', text: 'DR results reported to the board every half year', from: 'Evidence pack EVP-0311', status: { mer: 'Met' } }
    ]
  },
  {
    id: 'irdai', short: 'IRDAI', name: 'IRDAI Information and Cyber Security Guidelines (2023)', applies: ['cor'],
    reqs: [
      { id: 'i1', text: 'Business continuity plan for critical systems, tested at least once a year', from: 'Recovery plans and drills', status: { cor: 'Gap' }, why: { cor: 'No recovery plan exists for Coromandel Insurance' } },
      { id: 'i2', text: 'Backups restored and checked at least every quarter', from: 'Restore tests', status: { cor: 'Gap' }, why: { cor: '0 of 1 restore tests this quarter; restores blocked while suspended' } },
      { id: 'i3', text: 'Backups kept in India and protected from change', from: 'Residency, immutable repositories', status: { cor: 'Met' } }
    ]
  },
  {
    id: 'iso', short: 'ISO 22301', name: 'ISO 22301:2019 Business continuity management', applies: ['h360', 'sah'],
    reqs: [
      { id: 's1', text: '8.4 Continuity procedures documented and kept current', from: 'Recovery plan documents and versions', status: { h360: 'Met', sah: 'Partly' }, why: { sah: 'Protection only; no recovery plan for the hospital information system' } },
      { id: 's2', text: '8.5 A programme of exercises and tests', from: 'Drill calendar', status: { h360: 'Met', sah: 'Gap' }, why: { sah: 'Restore test on his-db-01 is 9 days overdue' } },
      { id: 's3', text: '9.1 Results measured against objectives (RTO, RPO)', from: 'Drills with measured RTO', status: { h360: 'Met', sah: 'Partly' } },
      { id: 's4', text: '10.1 Nonconformities recorded and corrected', from: 'Findings, drill warnings', status: { h360: 'Met', sah: 'Met' } }
    ]
  },
  {
    id: 'sebi', short: 'SEBI', name: 'SEBI Cybersecurity and Cyber Resilience Framework (2024)', applies: [], note: 'No customer is a SEBI-regulated entity. When one is onboarded, RTO 2 h and RPO 15 min for critical systems and half-yearly live trading from the DR site are checked here.',
    reqs: [{ id: 'b1', text: 'RTO of 2 hours and RPO of 15 minutes for critical systems', from: 'Protection plans', status: {} }, { id: 'b2', text: 'Half-yearly DR drill with live operations from the DR site', from: 'Drills (planned failover)', status: {} }]
  },
  {
    id: 'dora', short: 'DORA', name: 'EU Digital Operational Resilience Act (Regulation 2022/2554)', applies: [], note: 'Applies to EU financial entities. Atlas Freight GmbH is a logistics company and is not in scope.',
    reqs: [{ id: 'd1', text: 'Art. 11: ICT continuity plans tested at least yearly', from: 'Drills', status: {} }, { id: 'd2', text: 'Art. 12: Backups segregated, restorable, with set RTO and RPO', from: 'Immutable repositories, restore tests', status: {} }]
  }
];
const TONE: Record<St, [string, string]> = { Met: ['circle-check', 'ok'], Partly: ['triangle-alert', 'warn'], Gap: ['circle-x', 'err'] };

/** Resilience › Recovery plans › Compliance: what each regulator asks for, checked against plans, drills and rules. */
export function ComplianceTab({ ctx }: { ctx: Ctx }) {
  const fws = FW.map(f => ({ ...f, applies: f.applies.filter(c => inScope(ctx, c)) })).filter(f => f.applies.length || !ctx.actingAs);
  const [sel, setSel] = useState(fws[0]?.id || 'rbi');
  const f = fws.find(x => x.id === sel) || fws[0];
  const score = (x: Fw) => {
    const all = x.reqs.flatMap(r => x.applies.map(c => r.status[c]));
    return { met: all.filter(s => s === 'Met').length, total: all.length };
  };
  if (!f) return <p style={{ padding: '0 24px', color: 'var(--tx-2)' }}>No regulatory framework applies to this customer.</p>;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <ul role="listbox" aria-label="Frameworks" style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)', background: 'var(--panel)' }}>
        {fws.map(x => {
          const sc = score(x);
          return (
            <li key={x.id} role="option" aria-selected={x.id === f.id}>
              <button type="button" onClick={() => setSel(x.id)} className={pc('hover', 'background:var(--hover)')} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2, borderLeft: `2px solid ${x.id === f.id ? 'var(--acc)' : 'transparent'}`, background: x.id === f.id ? 'var(--acc-soft)' : undefined, borderBottom: '1px solid var(--ln)' }}>
                <span style={{ fontWeight: 600 }}>{x.short}</span>
                <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{x.applies.length ? `${x.applies.map(c => custName(c).split(' ')[0]).join(', ')} · ${sc.met} of ${sc.total} met` : 'No customer in scope'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Panel title={f.name} right={f.applies.length ? <Btn kind="outline" size="sm" icon="file-check" onClick={() => { ctx.go('security/evidence'); ctx.toast(`Build a pack and choose ${f.short}; drills, plans and approvals are filled in`, 'info'); }}>Build the evidence pack</Btn> : undefined}>
        <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {f.note ? <Bar tone="info" multiline>{f.note}</Bar> : null}
          <MiniTable
            label="Requirements"
            cols={[{ label: 'Requirement' }, { label: 'Checked from', w: '200px' }, ...f.applies.map(c => ({ label: custName(c).split(' ')[0], w: '120px' }))]}
            rows={f.reqs.map(r => [
              <span key="t" data-tip={r.text} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</span>,
              <span key="f" style={{ color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={r.from}>{r.from}</span>,
              ...f.applies.map(c => (r.status[c] ? <Status key={c} icon={TONE[r.status[c]][0]} tone={TONE[r.status[c]][1]} label={r.status[c]} tip={r.why?.[c] || r.status[c]} /> : <span key={c}>—</span>))
            ])}
          />
          {f.reqs.some(r => Object.values(r.status).includes('Gap')) ? (
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {f.reqs.flatMap(r => f.applies.filter(c => r.status[c] === 'Gap').map(c => (
                <li key={r.id + c} style={{ display: 'flex', gap: 8 }}><Icon name="circle-x" style={{ color: 'var(--err)', marginTop: 2 }} /><span><strong style={{ fontWeight: 600 }}>{custName(c)}:</strong> {r.why?.[c] || r.text}</span></li>
              )))}
            </ul>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
