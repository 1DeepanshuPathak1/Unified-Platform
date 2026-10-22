import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { TIER_SHORT, type Tier } from '../../data/platform';
import { Btn, CheckBox, Field, RadioCard, Seg, SelectInput, TextInput } from '../../ui/controls';
import { Bar, Facts, MiniTable, Panel, Spacer, Status } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import { MonthGrid, dayLabel } from '../../ui/MonthGrid';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope, showCustomerCol, TIER_RANK } from '../../platform/common';
import { audit, update, useStore } from '../../platform/store';
import { TIER_TARGET, appsOf, type Runbook, type ScheduledDrill } from './data';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '18 Oct 2026, 22:10 IST' → '2026-10-18' */
const isoOf = (t: string) => {
  const m = t.match(/(\d{2}) (\w{3}) (\d{4})/);
  return m ? `${m[3]}-${String(MON.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1]}` : '';
};
const addMonths = (d: string, n: number) => {
  const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(y, m - 1 + n, dd);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const STEP: Record<ScheduledDrill['repeat'], number> = { Once: 0, Monthly: 1, Quarterly: 3, 'Every six months': 6 };
/** Every date a booked drill falls on, up to the end of the year. */
const occurrences = (d: ScheduledDrill) => {
  const out = [d.day];
  const step = STEP[d.repeat];
  while (step && addMonths(out[out.length - 1], step) <= '2026-12-31') out.push(addMonths(out[out.length - 1], step));
  return out;
};
export const tierOfPlan = (rb: Runbook): Tier => appsOf(rb).map(a => a.tier).sort((a, b) => TIER_RANK[a] - TIER_RANK[b])[0] || 'Important';
const TODAY = '2026-10-21';

/** Resilience › Recovery plans › Drill calendar: booked tests, past drills, and plans due a test. */
export function DrillCalendar({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [month, setMonth] = useState('2026-10');
  const book = useClosable<string | true>();
  const plans = s.runbooks.filter(r => inScope(ctx, r.customer));
  const ids = plans.map(r => r.id);
  const booked = s.drillSchedule.filter(d => ids.includes(d.plan));
  const past = s.drills.filter(d => ids.includes(d.plan));
  const name = (id: string) => plans.find(r => r.id === id)?.name || id;
  const due = plans
    .map(rb => {
      const cadence = TIER_TARGET[tierOfPlan(rb)]?.drillDays;
      if (!cadence) return null;
      const last = rb.lastTest ? isoOf(rb.lastTest.when) : '2026-01-01';
      const [y, m, d] = last.split('-').map(Number);
      const dueDay = new Date(y, m - 1, d + cadence);
      const dueIso = `${dueDay.getFullYear()}-${String(dueDay.getMonth() + 1).padStart(2, '0')}-${String(dueDay.getDate()).padStart(2, '0')}`;
      const next = booked.filter(b => b.plan === rb.id).flatMap(occurrences).filter(x => x >= TODAY).sort()[0];
      return { rb, dueIso, next, ok: !!next && next <= dueIso, never: !rb.lastTest };
    })
    .filter(Boolean) as { rb: Runbook; dueIso: string; next?: string; ok: boolean; never: boolean }[];
  // Only what falls due before the end of the calendar shown is worth a warning.
  const late = due.filter(x => !x.ok && x.dueIso <= '2026-12-31');
  const cfg = ctx.can('operate', 'Booking drills');
  const showCust = showCustomerCol(ctx);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {late.length ? (
        <Bar tone="warn" actions={<Btn kind="ghost" size="sm" icon="calendar" perm={cfg} onClick={() => book.open(late[0].rb.id)}>Book {late.length === 1 ? 'it' : 'the first'}</Btn>}>
          {late.map(x => `${x.rb.name} ${x.never ? 'has never been tested' : x.dueIso < TODAY ? `was due a test on ${dayLabel(x.dueIso).slice(4)}` : `is due a test by ${dayLabel(x.dueIso).slice(4)}`}${x.next ? `; the next booking is ${dayLabel(x.next).slice(4)}` : '; nothing is booked'}`).join(' · ')}.
        </Bar>
      ) : null}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Seg label="Month" value={month} onChange={setMonth} options={[{ v: '2026-10', label: 'October' }, { v: '2026-11', label: 'November' }, { v: '2026-12', label: 'December' }]} />
        <Spacer />
        <span style={{ display: 'inline-flex', gap: 16, font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="flask-conical" style={{ color: 'var(--acc)' }} />Booked test</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="circle-check" style={{ color: 'var(--ok)' }} />Drill passed</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />Passed with warnings</span>
        </span>
        <Btn kind="primary" icon="calendar" perm={cfg} onClick={() => book.open(true)}>Book a drill</Btn>
      </div>
      <MonthGrid
        month={month}
        today={TODAY}
        label="Drill calendar"
        describe={day => {
          const b = booked.filter(d => occurrences(d).includes(day)).map(d => name(d.plan));
          const p = past.filter(d => isoOf(d.when) === day).map(d => name(d.plan));
          return `${b.length ? `; booked: ${b.join(', ')}` : ''}${p.length ? `; ran: ${p.join(', ')}` : ''}`;
        }}
        render={day => (
          <>
            {past.filter(d => isoOf(d.when) === day).map(d => (
              <span key={d.id} data-tip={`${name(d.plan)}: ${d.kind}, ${d.dur}${d.rtoMet ? ', RTO met' : ', RTO missed'} · ${d.evidence}`} style={{ display: 'flex', gap: 4, alignItems: 'center', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', minWidth: 0 }}>
                <Icon name={d.r === 'ok' ? 'circle-check' : d.r === 'warn' ? 'triangle-alert' : 'circle-x'} size={12} style={{ color: `var(--${d.r})`, flex: 'none' }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name(d.plan)}</span>
              </span>
            ))}
            {booked.filter(d => occurrences(d).includes(day)).map(d => (
              <a key={d.id + day} href={`#/dr/recovery?open=${d.plan}`} data-tip={`${name(d.plan)} at ${d.time} IST · ${d.scope} · DNS: ${d.dns} · clean-up ${d.cleanup}`} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 4px', background: 'var(--acc-soft)', border: '1px solid var(--acc)', font: '600 12px/16px var(--f-ui)', color: 'var(--tx)', minWidth: 0 }}>
                <Icon name="flask-conical" size={12} style={{ color: 'var(--acc)', flex: 'none' }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.time} {name(d.plan)}</span>
              </a>
            ))}
          </>
        )}
      />
      <MiniTable
        label="Booked drills"
        cols={[{ label: 'Plan', w: 'minmax(0,1.2fr)' }, ...(showCust ? [{ label: 'Customer', w: 'minmax(0,1fr)' }] : []), { label: 'Scope', w: 'minmax(0,1fr)' }, { label: 'Next', w: '150px' }, { label: 'Repeats', w: '120px' }, { label: 'Bubble DNS', w: '160px' }, { label: 'Clean-up', w: '140px' }, { label: '', w: '76px', r: true }]}
        rows={booked.map(d => {
          const next = occurrences(d).find(x => x >= TODAY) || d.day;
          return [
            <strong key="p" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={name(d.plan)} data-tip-overflow="">{name(d.plan)}</strong>,
            ...(showCust ? [<span key="c" data-tip={custName(plans.find(r => r.id === d.plan)?.customer || '')} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{custName(plans.find(r => r.id === d.plan)?.customer || '')}</span>] : []),
            <span key="s" data-tip={d.scope} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.scope}</span>,
            `${dayLabel(next).replace(' 2026', '')}, ${d.time}`,
            d.repeat,
            <span key="d" data-tip={d.records || d.dns} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.dns}</span>,
            d.cleanup,
            <Btn key="c" kind="ghost" size="sm" perm={cfg} onClick={() => { update(x => { x.drillSchedule = x.drillSchedule.filter(y => y.id !== d.id); }); audit({ who: 'priya.raman', customer: plans.find(r => r.id === d.plan)?.customer || 'h360', what: 'Cancelled a booked drill', object: name(d.plan), when: ctx.now(), r: 'ok' }); ctx.toast(`Drill for ${name(d.plan)} cancelled`, 'ok'); }}>Cancel</Btn>
          ];
        })}
        empty="No drills booked. Book one so each plan is tested within its tier’s cadence."
      />
      {book.value ? <BookDrillDialog ctx={ctx} plans={plans} plan={book.value === true ? undefined : book.value} closing={book.closing} onClose={book.close} /> : null}
    </div>
  );
}

function BookDrillDialog({ ctx, plans, plan, closing, onClose }: { ctx: Ctx; plans: Runbook[]; plan?: string; closing: boolean; onClose: () => void }) {
  const [id, setId] = useState(plan || plans[0]?.id);
  const rb = plans.find(r => r.id === id)!;
  const tier = tierOfPlan(rb);
  const [day, setDay] = useState('2026-11-21');
  const [time, setTime] = useState('22:00');
  const [stages, setStages] = useState<string[]>(rb.stages.map(s => s.id));
  const [dns, setDns] = useState<ScheduledDrill['dns']>('Copy from the directory');
  const [records, setRecords] = useState('');
  const [cleanup, setCleanup] = useState('4 h after the test');
  const [repeat, setRepeat] = useState<ScheduledDrill['repeat']>(tier === 'Mission Critical' ? 'Monthly' : tier === 'Business Critical' ? 'Quarterly' : 'Every six months');
  const [notify, setNotify] = useState(true);
  const [scope, setScope] = useState<'plan' | 'stages' | 'app' | 'site'>('plan');
  const apps = appsOf(rb);
  const [app, setApp] = useState(apps[0]?.id || '');
  const sitePlans = plans.filter(r => r.to === rb.to);
  const appStages = (aid: string) => rb.stages.filter(st => st.steps.some(x => x.kind === 'boot' && apps.find(a => a.id === aid)?.members.includes(x.w || ''))).map(st => st.id);
  const chosen = scope === 'plan' || scope === 'site' ? rb.stages.map(st => st.id) : scope === 'app' ? appStages(app) : stages;
  const past = day < '2026-10-22';
  const recOk = dns !== 'Static records' || /\S+\s*→\s*\d+\.\d+\.\d+\.\d+/.test(records);
  const ok = !!chosen.length && !past && recOk;
  const scopeText = scope === 'plan' ? 'Whole plan' : scope === 'site' ? `Whole site: ${rb.to}` : scope === 'app' ? `Application: ${apps.find(a => a.id === app)?.name}` : rb.stages.filter(st => stages.includes(st.id)).map(st => st.name).join(', ');
  return (
    <Dialog
      title="Book a drill"
      sub={`A test failover on the isolated network ${rb.testNet}. Production keeps running; nothing in the bubble can reach it.`}
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="calendar" disabled={!ok} why={past ? 'The date is in the past.' : !chosen.length ? (scope === 'app' ? 'None of this application’s servers are in the plan.' : 'Pick at least one stage.') : 'Give static records as name → address.'} onClick={() => {
            const targets = scope === 'site' ? sitePlans : [rb];
            update(x => { targets.forEach((r, i) => x.drillSchedule.push({ id: 'sd' + Date.now() + i, plan: r.id, day, time, scope: scopeText, dns, records: dns === 'Static records' ? records : undefined, cleanup, repeat, by: 'priya.raman' })); });
            audit({ who: 'priya.raman', customer: rb.customer, what: scope === 'site' ? 'Booked a whole-site drill' : 'Booked a drill', object: scope === 'site' ? `${rb.to} (${targets.map(r => r.name).join(', ')})` : rb.name, when: ctx.now(), r: 'ok', after: [['When', `${dayLabel(day)}, ${time} IST`], ['Scope', scopeText], ['Repeats', repeat], ['Bubble DNS', dns]] });
            ctx.toast(scope === 'site' ? `Whole-site drill of ${rb.to} booked for ${dayLabel(day)}, ${time} IST: ${targets.length} plans` : `Drill for ${rb.name} booked for ${dayLabel(day)}, ${time} IST`, 'ok');
            onClose();
          }}>Book drill</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 150px 110px 170px', gap: 16 }}>
        <Field id="bd-p" label="Recovery plan"><SelectInput id="bd-p" value={id} onChange={v => { setId(v); setStages(plans.find(r => r.id === v)!.stages.map(s => s.id)); }} options={plans.map(r => ({ v: r.id, label: r.name }))} /></Field>
        <Field id="bd-d" label="Day" err={past ? 'In the past.' : null}><TextInput id="bd-d" type="date" value={day} onChange={setDay} invalid={past} /></Field>
        <Field id="bd-t" label="Starts (IST)"><TextInput id="bd-t" type="time" value={time} onChange={setTime} /></Field>
        <Field id="bd-r" label="Repeats" hint={`${TIER_SHORT[tier]} needs ${TIER_TARGET[tier]?.drill.toLowerCase() || 'no drills'}`}><SelectInput id="bd-r" value={repeat} onChange={v => setRepeat(v as ScheduledDrill['repeat'])} options={['Once', 'Monthly', 'Quarterly', 'Every six months']} /></Field>
      </div>
      <Field label="What to test">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          <RadioCard on={scope === 'plan'} onClick={() => setScope('plan')} title="Whole plan" note={`${rb.stages.length} stages`} />
          <RadioCard on={scope === 'stages'} onClick={() => setScope('stages')} title="Some stages" note="One wave of the boot order" />
          <RadioCard on={scope === 'app'} onClick={() => setScope('app')} disabled={!apps.length} why="No application is linked to this plan." title="One application" note={apps.length ? apps.map(a => a.name).join(', ') : 'No application linked'} />
          <RadioCard on={scope === 'site'} onClick={() => setScope('site')} title="Whole site" note={`${sitePlans.length} plans recover to ${rb.to}`} />
        </div>
      </Field>
      {scope === 'stages' ? (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {rb.stages.map(st => <CheckBox key={st.id} on={stages.includes(st.id)} onChange={v => setStages(x => (v ? [...x, st.id] : x.filter(y => y !== st.id)))}>{st.name}</CheckBox>)}
        </div>
      ) : null}
      {scope === 'app' && apps.length > 1 ? <Field id="bd-a" label="Application"><SelectInput id="bd-a" value={app} onChange={setApp} options={apps.map(a => ({ v: a.id, label: a.name }))} /></Field> : null}
      {scope === 'app' ? <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Starts the stages that hold its servers: {rb.stages.filter(st => appStages(app).includes(st.id)).map(st => st.name).join(', ') || 'none'}.</p> : null}
      {scope === 'site' ? <Bar tone="info" multiline>Tests every plan that recovers to {rb.to}, one after another in criticality order: {sitePlans.map(r => r.name).join(', ')}. Each plan gets its own bubble on {rb.testNet}; the evidence report covers the whole site.</Bar> : null}
      <Field label="Name resolution inside the bubble">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
          <RadioCard on={dns === 'Copy from the directory'} onClick={() => setDns('Copy from the directory')} title="Copy from the directory" note="A copy of the directory server answers DNS in the bubble" />
          <RadioCard on={dns === 'Static records'} onClick={() => setDns('Static records')} title="Static records" note="A small DNS server with the names you list" />
          <RadioCard on={dns === 'None'} onClick={() => setDns('None')} title="None" note="Health checks use addresses only" />
        </div>
      </Field>
      {dns === 'Static records' ? (
        <Field id="bd-rec" label="Records (name → address; separate with ;)" err={!recOk ? 'Give at least one record such as erp.host360.ai → 10.50.0.31.' : null}>
          <TextInput id="bd-rec" value={records} onChange={setRecords} placeholder="erp.host360.ai → 10.50.0.31; mail.host360.ai → 10.50.0.25" invalid={!recOk} />
        </Field>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'end' }}>
        <Field id="bd-c" label="Clean-up"><SelectInput id="bd-c" value={cleanup} onChange={setCleanup} options={['2 h after the test', '4 h after the test', '8 h after the test', 'By hand']} /></Field>
        <CheckBox on={notify} onChange={setNotify}>Tell the plan owner and approvers 24 hours before</CheckBox>
      </div>
      <Facts
        items={[
          { k: 'Bubble network', v: `${rb.testNet}: no route to production or the internet`, icon: 'pin', tone: 'acc' },
          { k: 'Measured', v: `RPO and RTO against ${rb.rtoTarget}, per stage and in total` },
          { k: 'Evidence', v: 'Timings, health checks and screenshots, signed and filed with the plan' },
          { k: 'Replication', v: 'Keeps running during the test. Test copies start from a recovery point and never write to the replicas, so the RPO is not affected' },
          { k: 'Left over', v: 'Anything still running after clean-up is listed as an orphan and alerted' }
        ]}
      />
    </Dialog>
  );
}

/** The signed reconciliation reports from returns to primary for one plan. */
export function Reconciliations({ ctx, rb }: { ctx: Ctx; rb: Runbook }) {
  const s = useStore();
  const list = s.reconciliations.filter(r => r.plan === rb.id);
  if (!list.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map(r => (
        <Panel
          key={r.when}
          title={<>Reconciliation · return to primary <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>{r.when}</span></>}
          right={<Btn kind="ghost" size="sm" icon="download" onClick={() => ctx.toast(`reconciliation-${rb.id}-${r.when.slice(0, 6).replace(' ', '')}.pdf downloaded (signed)`, 'ok')}>Signed PDF</Btn>}
        >
          <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MiniTable
              label="Reconciliation"
              cols={[{ label: 'Server' }, { label: 'Written at the recovery site', w: '200px', r: true }, { label: 'Copied back', w: '170px', r: true }, { label: 'Checksums', w: '110px' }, { label: 'Now', w: '190px' }]}
              rows={r.rows.map(x => [<strong key="s" style={{ fontWeight: 600 }}>{x.server}</strong>, x.written, x.copied, <Status key="c" icon={x.check === 'Matched' ? 'circle-check' : 'triangle-alert'} tone={x.check === 'Matched' ? 'ok' : 'warn'} label={x.check} />, x.state])}
            />
            <Facts items={[{ k: 'Returned to', v: r.target }, ...r.notes.map((n, i) => ({ k: i ? '' : 'Notes', v: n })), { k: 'Signature', v: r.signed, icon: 'badge-check', tone: 'ok' }]} />
          </div>
        </Panel>
      ))}
    </div>
  );
}
