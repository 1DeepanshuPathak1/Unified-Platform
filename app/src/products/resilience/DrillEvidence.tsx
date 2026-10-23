import { useState } from 'react';
import { Btn } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Panel, Progress, Status } from '../../ui/layout';
import { Drawer, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { CopyCurl } from '../../ui/CopyCurl';
import { APPLICATIONS, CUSTOMERS } from '../../data/platform';
import { useStore, audit } from '../../platform/store';
import type { Drill, Runbook } from './data';

type Finding = { id: string; sev: 'High' | 'Medium' | 'Low'; text: string; action: string; owner: string; due: string; state: 'Open' | 'Done' };
type Evidence = { rpoMin: number; steps: [number, number]; findings: Finding[] };

/** What each drill measured, beyond pass or fail: the data age at the start, the steps, and what was found. */
const EVIDENCE: Record<string, Evidence> = {
  d9: { rpoMin: 6, steps: [22, 22], findings: [] },
  d3: {
    rpoMin: 9, steps: [21, 22],
    findings: [
      { id: 'F-311', sev: 'Medium', text: 'ad-dc-01 took 9 min 40 s to boot against a 10 min limit', action: 'Raise the boot limit to 15 min and start it 2 min earlier', owner: 'Arun Kumar', due: '11 Oct', state: 'Done' },
      { id: 'F-312', sev: 'High', text: 'The ERP health gate passed only on its second try', action: 'Add a 60 s wait for the ERP cache before the gate', owner: 'Arun Kumar', due: '25 Oct', state: 'Open' }
    ]
  },
  d8: { rpoMin: 3, steps: [9, 9], findings: [] },
  d2: { rpoMin: 4, steps: [9, 9], findings: [{ id: 'F-288', sev: 'Low', text: 'Customers saw the maintenance page for 6 min after the switch', action: 'Lower the DNS TTL to 60 s before planned failovers', owner: 'Meera Iyer', due: '31 Jul', state: 'Done' }] },
  d7: { rpoMin: 11, steps: [31, 31], findings: [] },
  d6: { rpoMin: 7, steps: [14, 14], findings: [] },
  d5: { rpoMin: 14, steps: [12, 12], findings: [] },
  d4: { rpoMin: 22, steps: [17, 18], findings: [{ id: 'F-301', sev: 'High', text: 'The Oracle listener did not start on its own at the recovery site', action: 'Add a script step that starts the listener and checks it with tnsping', owner: 'Rohit Sharma', due: '15 Sep', state: 'Open' }] }
};
const ev = (d: Drill): Evidence => EVIDENCE[d.id] || { rpoMin: 8, steps: [10, 10], findings: [] };
const RPO_TARGET = 15;

/** Recovery plan › Runs and drills: certification per application, the measured RPO trend, and a report for each drill. */
export function DrillHistory({ ctx, rb }: { ctx: Ctx; rb: Runbook }) {
  const s = useStore();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const report = useClosable<string>();
  const drills = s.drills.filter(d => d.plan === rb.id);
  const byDate = [...drills].sort((a, b) => Date.parse(a.when.replace(' IST', '')) - Date.parse(b.when.replace(' IST', '')));
  const state = (f: Finding) => (done[f.id] ? 'Done' : f.state);
  const open = drills.flatMap(d => ev(d).findings).filter(f => state(f) === 'Open');
  const last = drills[0];
  const certified = !!last && last.rtoMet && last.r !== 'err' && !open.some(f => f.sev === 'High');
  const d = report.value ? drills.find(x => x.id === report.value) : null;
  const cust = CUSTOMERS.find(c => c.id === rb.customer);
  return (
    <>
      <Panel title="DR certification">
        <div style={{ padding: '0 16px 4px' }}>
          <MiniTable
            label="Certification per application"
            empty="No applications in this plan."
            cols={[{ label: 'Application' }, { label: 'State', w: '260px' }, { label: 'Why', w: '45%' }]}
            rows={rb.apps.map(id => {
              const a = APPLICATIONS.find(x => x.id === id);
              const high = open.find(f => f.sev === 'High');
              return [
                <strong key="a" style={{ fontWeight: 600 }}>{a?.name || id}</strong>,
                certified ? <Status key="s" icon="badge-check" tone="ok" label={`Certified until ${last!.when.slice(0, 6)} 2027`} /> : <Status key="s" icon="circle-x" tone="err" label="Not certified" />,
                <span key="w" style={{ whiteSpace: 'normal', padding: '6px 0' }}>{!last ? 'Never drilled' : certified ? `Drill ${last.evidence.split(' ')[0]} met the ${rb.rtoTarget} RTO and nothing high is open` : high ? `${high.id} is open: ${high.text}` : `The last drill ${last.rtoMet ? 'failed' : 'missed the RTO'}`}</span>
              ];
            })}
          />
        </div>
      </Panel>
      {byDate.length ? (
        <Panel title="Measured RPO at each drill" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Target {RPO_TARGET} min</span>}>
          <div style={{ padding: '0 16px 4px' }}>
            <MiniTable
              label="Measured RPO"
              cols={[{ label: 'Drill', w: '170px' }, { label: 'Age of the data when it started' }, { label: '', w: '80px', r: true }]}
              rows={byDate.map(x => {
                const r = ev(x).rpoMin;
                return [x.when.replace(' 2026', '').replace(' IST', ''), <Progress key="p" pct={Math.min(100, (r / (RPO_TARGET * 1.5)) * 100)} tone={r > RPO_TARGET ? 'err' : r > RPO_TARGET * 0.7 ? 'warn' : 'ok'} />, `${r} min`];
              })}
            />
          </div>
        </Panel>
      ) : null}
      <MiniTable
        label="Runs and drills"
        onRow={i => report.open(drills[i].id)}
        cols={[{ label: 'When', w: '150px' }, { label: 'Kind', w: '140px' }, { label: 'Result', w: '140px' }, { label: 'Took', w: '110px' }, { label: 'RPO', w: '70px', r: true }, { label: 'Findings', w: '90px', r: true }, { label: 'Evidence' }]}
        rows={drills.map(x => [
          x.when.replace(' 2026', '').replace(' IST', ''),
          x.kind,
          <Status key="r" icon={x.r === 'ok' ? 'circle-check' : x.r === 'warn' ? 'triangle-alert' : 'circle-x'} tone={x.r} label={x.r === 'ok' ? 'Passed' : x.r === 'warn' ? 'Passed, warnings' : 'Failed'} />,
          <span key="t" data-tip={x.rtoMet ? `Within the RTO target of ${rb.rtoTarget}` : `Over the RTO target of ${rb.rtoTarget}`}>{x.dur}</span>,
          `${ev(x).rpoMin} min`,
          String(ev(x).findings.filter(f => state(f) === 'Open').length || '—'),
          <span key="e" data-tip={x.evidence} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.evidence}</span>
        ])}
        empty="Never run. Test the plan on the isolated network to record its first drill."
      />
      {d ? (
        <Drawer
          label="Drill report"
          width={680}
          kicker={rb.customer === 'h360' ? 'Drill report · Host360 Managed Services' : `Drill report · ${cust?.whiteLabel || 'Host360 Managed Services'} for ${cust?.name}`}
          title={`${d.evidence.split(' ')[0]} · ${rb.name}`}
          status={<><span>{d.when}</span><span>{d.kind}</span><span>{d.by}</span></>}
          closing={report.closing}
          onClose={report.close}
          actions={
            <>
              <Btn kind="primary" icon="download" onClick={() => { audit({ who: 'priya.raman', customer: rb.customer, what: 'Downloaded a drill report', object: d.evidence.split(' ')[0], when: ctx.now(), r: 'ok' }); ctx.toast(`${d.evidence.split(' ')[0]}.pdf: signed, with ${cust?.whiteLabel || 'Host360'} branding and the runbook as run`, 'ok'); }}>Download the report</Btn>
              <Btn kind="outline" icon="send" onClick={() => ctx.toast(`Report sent to ${rb.customer === 'mer' ? 'the RBI audit mailbox and Anitha Krishnan' : 'the plan owner and the customer’s auditor'}`, 'ok')}>Send to the auditor</Btn>
              <CopyCurl ctx={ctx} path={`/resilience/drills/${d.id}/report`} query={{ format: 'pdf' }} />
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DrawerTiles
              items={[
                { label: 'Took', value: d.dur, sub: `Target ${rb.rtoTarget} · ${d.rtoMet ? 'met' : 'missed'}`, tone: d.rtoMet ? 'ok' : 'err' },
                { label: 'Data age at start', value: `${ev(d).rpoMin} min`, sub: `Target ${RPO_TARGET} min`, tone: ev(d).rpoMin <= RPO_TARGET ? 'ok' : 'err' },
                { label: 'Steps passed', value: `${ev(d).steps[0]} of ${ev(d).steps[1]}` },
                { label: 'Findings open', value: String(ev(d).findings.filter(f => state(f) === 'Open').length) }
              ]}
            />
            {ev(d).findings.length ? (
              <MiniTable
                label="Findings and corrective actions"
                cols={[{ label: 'Finding' }, { label: 'Corrective action', w: '36%' }, { label: 'Owner, due', w: '120px' }, { label: '', w: '110px', r: true }]}
                rows={ev(d).findings.map(f => [
                  <span key="f" style={{ whiteSpace: 'normal', padding: '6px 0' }}><strong style={{ fontWeight: 600 }}>{f.id} · {f.sev}</strong><br />{f.text}</span>,
                  <span key="a" style={{ whiteSpace: 'normal', padding: '6px 0' }}>{f.action}</span>,
                  <span key="o" style={{ whiteSpace: 'normal' }}>{f.owner}<br /><span style={{ color: 'var(--tx-3)' }}>{f.due}</span></span>,
                  state(f) === 'Done' ? <Status key="s" icon="circle-check" tone="ok" label="Done" /> : <Btn key="b" kind="outline" size="sm" perm={ctx.can('operate', 'Closing findings')} onClick={() => { setDone(x => ({ ...x, [f.id]: true })); audit({ who: 'priya.raman', customer: rb.customer, what: 'Closed a drill finding', object: f.id, when: ctx.now(), r: 'ok' }); ctx.toast(`${f.id} closed; it counts at the next certification`, 'ok'); }}>Mark done</Btn>
                ])}
              />
            ) : (
              <Bar tone="ok" icon="circle-check">Nothing found. Every step passed at the first try.</Bar>
            )}
            <MiniTable
              label="Stages as run"
              cols={[{ label: 'Stage' }, { label: 'Servers', w: '80px', r: true }, { label: 'Result', w: '150px' }]}
              rows={rb.stages.map((st, i) => [st.name, String(st.steps.filter(x => x.kind === 'boot').length), ev(d).steps[0] < ev(d).steps[1] && i === Math.min(2, rb.stages.length - 1) ? <Status key="r" icon="triangle-alert" tone="warn" label={`${ev(d).steps[1] - ev(d).steps[0]} step retried`} /> : <Status key="r" icon="circle-check" tone="ok" label="Passed" />])}
            />
            <Facts
              items={[
                { k: 'Runbook', v: `Version ${rb.version}, as run; the document is attached to the report` },
                { k: 'Network', v: d.kind === 'Test failover' ? `${rb.testNet}, isolated; production kept running` : 'Production network at the recovery site' },
                { k: 'Signed', v: 'SHA-256 of the report and its screenshots, stored with the audit log' },
                { k: 'Counts towards', v: rb.customer === 'mer' ? 'RBI IT Framework: business continuity drill evidence, quarterly' : 'ISO 22301 clause 8.5: exercising and testing' }
              ]}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
