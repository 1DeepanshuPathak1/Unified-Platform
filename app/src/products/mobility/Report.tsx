import { useState, type ReactNode } from 'react';
import { Btn, Seg, SelectInput } from '../../ui/controls';
import { Facts, MiniTable, Spacer, Toolbar, plural } from '../../ui/layout';
import type { Ctx } from '../../ui/ctx';
import { custName } from '../../platform/common';
import { audit } from '../../platform/store';
import { band, bandLabel, findings, type Assessed } from './assess';
import { WAVES } from './data';
import { profileFor } from './Profiles';

export type Audience = 'engineer' | 'cio' | 'msp' | 'sales';
export const AUDIENCES: { v: Audience; label: string; note: string }[] = [
  { v: 'engineer', label: 'Engineer', note: 'Every server, its blockers, sizing and the work to do before the first pass' },
  { v: 'cio', label: 'CIO', note: 'Readiness, downtime, timeline, risks and the decisions needed' },
  { v: 'msp', label: 'MSP', note: 'Effort, staging capacity, one-time charges and recurring revenue' },
  { v: 'sales', label: 'Sales', note: 'What the customer saves and the proposal' }
];
const RATE = { migrate: 6000, hour: 2800, vmBackup: 650, db: 1800, tier0: 78 * 30, tier1: 52 * 30, drTest: 25000 };
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const hrs = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`);

/** Mobility › Assessment › Report: the same discovery written for four readers. */
export function AudienceReport({ ctx, list, initial }: { ctx: Ctx; list: Assessed[]; initial?: Audience }) {
  const custs = [...new Set(list.map(a => a.vm.customer))];
  const [cust, setCust] = useState(custs.includes('mer') ? 'mer' : custs[0]);
  const [who, setWho] = useState<Audience>(initial || 'cio');
  const mine = list.filter(a => a.vm.customer === cust && a.vm.stage !== 'committed');
  const done = list.filter(a => a.vm.customer === cust && a.vm.stage === 'committed');
  const f = findings(mine);
  const ready = mine.filter(a => band(a.ready) === 'ok');
  const work = mine.filter(a => band(a.ready) === 'warn');
  const blocked = mine.filter(a => band(a.ready) === 'err');
  const firstPass = mine.reduce((s, a) => s + a.firstPassH, 0);
  const down = mine.reduce((s, a) => s + a.downtimeMin, 0);
  const usedTB = mine.reduce((s, a) => s + a.usedGB, 0) / 1024;
  const cpuNow = mine.reduce((s, a) => s + a.vm.cpu, 0);
  const cpuRec = mine.reduce((s, a) => s + a.rec.cpu, 0);
  const memNow = mine.reduce((s, a) => s + a.vm.mem, 0);
  const memRec = mine.reduce((s, a) => s + a.rec.mem, 0);
  const waves = WAVES.filter(w => w.customer === cust && w.state !== 'done');
  const effortH = ready.length * 2 + work.length * 6 + blocked.length * 12 + waves.length * 4;
  const critical = mine.filter(a => a.tier === 'Mission Critical' || a.tier === 'Business Critical');
  const monthly = mine.length * RATE.vmBackup + mine.filter(a => /sql|oracle|db/i.test(a.vm.name)).length * RATE.db + mine.filter(a => a.tier === 'Mission Critical').length * RATE.tier0 + mine.filter(a => a.tier === 'Business Critical').length * RATE.tier1;
  const vmw = f.find(x => x.id === 'vmw');
  const name = custName(cust);
  const sec = { display: 'flex', flexDirection: 'column' as const, gap: 8 };
  const h = { font: '500 18px/26px var(--f-head)' };
  const title: Record<Audience, string> = { engineer: 'Migration assessment: engineering detail', cio: 'Migration assessment: summary for the CIO', msp: 'Migration assessment: delivery plan and commercials', sales: 'Moving off VMware: what it means for you' };

  const body: Record<Audience, ReactNode> = {
    engineer: (
      <>
        <section style={sec}>
          <h3 style={h}>1. Servers</h3>
          <MiniTable
            label="Servers"
            cols={[{ label: 'Server', w: '140px' }, { label: 'Readiness', w: '96px' }, { label: 'Blockers and warnings' }, { label: 'First pass', w: '84px', r: true }, { label: 'Size', w: '120px' }, { label: 'Profile', w: '150px' }]}
            rows={mine.map(a => [a.vm.name, `${a.ready} · ${bandLabel(a.ready)}`, <span key="d" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={a.deductions.map(d => d.what).join(' · ') || 'None'}>{a.deductions.map(d => d.what).join(' · ') || 'None'}</span>, hrs(a.firstPassH), a.rec.label, profileFor(a.vm)?.name.replace(' Server', '') || 'No destination'])}
            empty="Every server is already migrated."
          />
        </section>
        <section style={sec}>
          <h3 style={h}>2. Before the first pass</h3>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {f.filter(x => x.kind !== 'Licensing').map(x => <li key={x.id}><strong style={{ fontWeight: 600 }}>{x.title}</strong> ({x.servers.join(', ')}): {x.advice}</li>)}
            {!f.some(x => x.kind !== 'Licensing') ? <li>Nothing to fix first.</li> : null}
          </ul>
        </section>
        <section style={sec}>
          <h3 style={h}>3. Copy and cutover</h3>
          <Facts labelW={190} items={[{ k: 'Data to copy', v: `${usedTB.toFixed(1)} TB, ${hrs(firstPass)} of first passes at 190 MB/s` }, { k: 'Downtime at cutover', v: `${down} min in total; final sync, conversion and boot` }, { k: 'Right-sizing', v: `${cpuNow} → ${cpuRec} vCPU, ${memNow} → ${memRec} GB` }]} />
        </section>
      </>
    ),
    cio: (
      <>
        <section style={sec}>
          <h3 style={h}>1. Where things stand</h3>
          <p>{plural(mine.length, 'server')} still to move{done.length ? ` (${done.length} already moved)` : ''}: {ready.length} can move now, {work.length} need work first and {blocked.length} cannot move as they are. Total downtime across every cutover is {down} min, inside the windows agreed with the business.</p>
          <Facts labelW={190} items={[{ k: 'Waves left', v: waves.map(w => `${w.name} (${w.window ? w.window.split(',')[0] : 'no window yet'})`).join(' · ') || 'None' }, { k: 'Planned finish', v: '14 Dec 2026' }, ...(vmw ? [{ k: 'Saving', v: `${vmw.saving}, VMware licences released at renewal on 30 Jun 2027` }] : [])]} />
        </section>
        <section style={sec}>
          <h3 style={h}>2. Risks</h3>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {f.filter(x => x.sev === 'High').map(x => <li key={x.id}><strong style={{ fontWeight: 600 }}>{x.title}.</strong> {x.advice}</li>)}
            {!f.some(x => x.sev === 'High') ? <li>No high risks.</li> : null}
          </ul>
        </section>
        <section style={sec}>
          <h3 style={h}>3. Decisions we need from you</h3>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {blocked.length ? <li>Whether to fix or retire the {plural(blocked.length, 'server')} that cannot move: {blocked.map(a => a.vm.name).join(', ')}.</li> : null}
            {f.some(x => x.id === 'ora') ? <li>How to license Oracle on the new platform: pinned hosts or a licence true-up.</li> : null}
            {f.some(x => x.id === 'eol') ? <li>Approval to upgrade out-of-support operating systems within 90 days of moving.</li> : null}
            <li>Go/no-go approvers for each cutover window.</li>
          </ul>
        </section>
      </>
    ),
    msp: (
      <>
        <section style={sec}>
          <h3 style={h}>1. Effort</h3>
          <MiniTable label="Effort" cols={[{ label: 'Work' }, { label: 'Count', w: '80px', r: true }, { label: 'Hours each', w: '96px', r: true }, { label: 'Hours', w: '80px', r: true }]} rows={[['Servers ready to move', String(ready.length), '2', String(ready.length * 2)], ['Servers needing work first', String(work.length), '6', String(work.length * 6)], ['Blocked servers (fix or rebuild)', String(blocked.length), '12', String(blocked.length * 12)], ['Cutover windows (engineer on call)', String(waves.length), '4', String(waves.length * 4)], [<strong key="t" style={{ fontWeight: 600 }}>Total</strong>, '', '', <strong key="h" style={{ fontWeight: 600 }}>{effortH}</strong>]]} />
        </section>
        <section style={sec}>
          <h3 style={h}>2. Capacity to hold</h3>
          <Facts labelW={190} items={[{ k: 'Staging', v: `${(usedTB * 1.1).toFixed(1)} TB at the destination during sync passes (10 % for change)` }, { k: 'Compute after cutover', v: `${cpuRec} vCPU and ${memRec} GB, right-sized` }, { k: 'Bandwidth', v: `${hrs(firstPass)} of first passes; spread over at least ${Math.max(1, Math.ceil(firstPass / 10))} nights` }]} />
        </section>
        <section style={sec}>
          <h3 style={h}>3. Revenue</h3>
          <MiniTable label="Revenue" cols={[{ label: 'Item' }, { label: 'Basis', w: '220px' }, { label: 'Amount', w: '130px', r: true }]} rows={[['Migration (one time)', `${mine.length} × ${inr(RATE.migrate)} at commit`, inr(mine.length * RATE.migrate)], ['Professional services (one time)', `${effortH} h × ${inr(RATE.hour)}`, inr(effortH * RATE.hour)], ['Backup and DR after cutover', `From each server’s tier; ${critical.length} need DR`, `${inr(monthly)} a month`], ['DR drills', `${critical.length ? 'Quarterly' : 'None'} at ${inr(RATE.drTest)}`, critical.length ? `${inr(RATE.drTest * 4)} a year` : '—']]} />
        </section>
      </>
    ),
    sales: (
      <>
        <section style={sec}>
          <h3 style={h}>1. What you get</h3>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vmw ? <li><strong style={{ fontWeight: 600 }}>{vmw.saving}</strong> in VMware licences you no longer renew from 30 Jun 2027.</li> : null}
            <li><strong style={{ fontWeight: 600 }}>{Math.round((1 - cpuRec / Math.max(1, cpuNow)) * 100)} % fewer vCPU and {Math.round((1 - memRec / Math.max(1, memNow)) * 100)} % less memory</strong> after right-sizing from seven days of real use.</li>
            <li>{ready.length} of {mine.length} servers can move now; the rest have a plan.</li>
            <li>Backup and disaster recovery set up for every server as it moves, matched to how critical it is.</li>
          </ul>
        </section>
        <section style={sec}>
          <h3 style={h}>2. The proposal</h3>
          <MiniTable label="Proposal" cols={[{ label: 'Item' }, { label: 'Price', w: '200px', r: true }]} rows={[['Migration of every server, with test boots and rollback', inr(mine.length * RATE.migrate + effortH * RATE.hour)], ['Backup and DR after the move', `${inr(monthly)} a month`], ['First DR drill with a signed report', 'Included']]} />
        </section>
        <section style={sec}>
          <h3 style={h}>3. Next steps</h3>
          <p>Agree the cutover windows ({waves.map(w => w.window?.split(',')[0]).filter(Boolean).join(', ') || 'to be set'}), name the go/no-go approvers and sign the change record for the first wave.</p>
        </section>
      </>
    )
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toolbar style={{ padding: 0 }}>
        <Seg label="Written for" value={who} onChange={setWho} options={AUDIENCES.map(a => ({ v: a.v, label: a.label, tip: a.note }))} />
        {custs.length > 1 ? <SelectInput value={cust} onChange={setCust} options={custs.map(c => ({ v: c, label: custName(c) }))} width={240} /> : null}
        <Spacer />
        <Btn kind="outline" icon="download" onClick={() => { audit({ who: 'priya.raman', customer: cust, what: 'Exported an assessment report', object: `${name} · ${AUDIENCES.find(a => a.v === who)!.label}`, when: ctx.now(), r: 'ok' }); ctx.toast(`assessment-${cust}-${who}.pdf is ready`, 'ok'); }}>
          Export PDF
        </Btn>
      </Toolbar>
      <article style={{ maxWidth: 900, background: 'var(--panel)', border: '1px solid var(--ln)', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24, userSelect: 'text' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid var(--ln)', paddingBottom: 16 }}>
          <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{name} · for the {AUDIENCES.find(a => a.v === who)!.label === 'MSP' ? 'managed service team' : AUDIENCES.find(a => a.v === who)!.label.toLowerCase() === 'cio' ? 'CIO' : AUDIENCES.find(a => a.v === who)!.label.toLowerCase() + ' team'}</span>
          <h2 style={{ font: '500 24px/32px var(--f-head)' }}>{title[who]}</h2>
          <span style={{ color: 'var(--tx-2)' }}>From the discovery of Chennai vCenter and esxi-edge-07 on 21 Oct 2026, 15:30 IST.</span>
        </header>
        {body[who]}
      </article>
    </div>
  );
}
