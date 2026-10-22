import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { MAINT, TEMPLATES, type Maint } from '../data/internal';
import { Btn, CheckBox, Field, RadioCard, Seg, SelectInput, TextArea, TextInput, Toggle } from '../ui/controls';
import { Bar, Facts, LogView, MiniTable, Page, PageHeader, Spacer, Status, TableArea, Tiles, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName } from '../platform/common';
import { audit, useStore } from '../platform/store';
import { NotificationPreview } from './Templates';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '25 Oct 2026, 19:30 UTC' → Date */
const parseUtc = (s: string) => {
  const m = s.match(/(\d{2}) (\w{3}) (\d{4}), (\d{2}):(\d{2})/)!;
  return new Date(Date.UTC(+m[3], MON.indexOf(m[2]), +m[1], +m[4], +m[5]));
};
const fmtUtc = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
const iana = (tz: string) => tz.split(' ')[0];
/** A time in a customer's zone, e.g. "Mon 02 Nov 02:00 IST" or "20:30 CET". */
const local = (d: Date, tz: string, withDay = true) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: iana(tz), weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(d).map(x => [x.type, x.value]));
  const zone = iana(tz) === 'Asia/Kolkata' ? 'IST' : p.timeZoneName;
  return `${withDay ? `${p.weekday} ${p.day} ${p.month} ` : ''}${p.hour}:${p.minute} ${zone}`;
};
const ST: Record<Maint['state'], [string, string]> = { Scheduled: ['calendar-clock', 'tx'], 'In progress': ['loader-circle', 'run'], Completed: ['circle-check', 'ok'], Cancelled: ['circle-x', 'tx'] };
const COMPONENTS: { v: string; tenants: string[] | 'all' }[] = [
  { v: 'aegis-orchestrator (Chennai) and warm standby (Mumbai)', tenants: 'all' },
  { v: 'aegis-proxy-cmp4, cmp5, cmp6', tenants: ['h360', 'mer', 'kav'] },
  { v: 'Chennai DC1 object storage (MinIO nodes)', tenants: ['h360', 'kav', 'sah', 'cor'] },
  { v: 'Mumbai DC2 (Mahape): backup appliance and storage', tenants: ['mer'] },
  { v: 'Frankfurt FR5 backup appliance', tenants: ['atl'] }
];

/** 6.4 Maintenance: planned work, shown in every customer's time zone and brand, with its log and outcome. */
export function MaintenanceSection({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [list, setList] = useState<Maint[]>(MAINT);
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const add = useClosable<boolean>();
  const close = useClosable<string>();
  const cancel = useClosable<string>();
  useEffect(() => {
    if (ctx.openId && list.some(m => m.id === ctx.openId)) {
      drawer.open(ctx.openId);
      setTab('Overview');
    }
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const up = list.filter(m => m.state === 'Scheduled' || m.state === 'In progress');
  const rows = view === 'upcoming' ? up : list.filter(m => m.state === 'Completed' || m.state === 'Cancelled');
  const d = drawer.value ? list.find(m => m.id === drawer.value) : null;
  const cust = (id: string) => s.customers.find(c => c.id === id)!;
  const brandOf = (id: string) => cust(id)?.whiteLabel || 'Host360';
  const patch = (id: string, p: Partial<Maint>) => setList(x => x.map(m => (m.id === id ? { ...m, ...p } : m)));
  const next = [...up].sort((a, b) => parseUtc(a.startUtc).getTime() - parseUtc(b.startUtc).getTime())[0];
  const start = (m: Maint) => {
    const hms = ctx.hms();
    patch(m.id, { state: 'In progress', log: [{ t: hms, text: 'Window opened by priya.raman; alerts for the scope suppressed', lv: 'info' }, { t: hms, text: m.page ? 'Maintenance page on for the console' : 'Console stays available', lv: 'info' }, { t: hms, text: 'Scheduled jobs for the scope held until the window closes', lv: 'info' }] });
    audit({ who: 'priya.raman', customer: 'h360', what: 'Started maintenance', object: m.name, when: ctx.now(), r: 'ok' });
    ctx.toast(`${m.name} started; alerts for ${m.components} are suppressed`, 'warn');
  };
  return (
    <Page>
      <PageHeader
        kicker="Service"
        title="Maintenance"
        sub="Planned work on the platform: when it happens in each customer’s time zone, what each was told and in whose brand, and how it went."
        actions={<Btn kind="primary" icon="calendar" onClick={() => add.open(true)}>Schedule maintenance</Btn>}
      />
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Next window', value: next ? local(parseUtc(next.startUtc), 'Asia/Kolkata').split(' ').slice(0, 3).join(' ') : 'None', icon: 'calendar-clock', sub: next ? `${next.name} · ${next.ist}` : 'Nothing scheduled' },
            { label: 'Scheduled', value: `${up.length}`, icon: 'calendar', sub: `${list.filter(m => m.state === 'Completed').length} completed this quarter` },
            { label: 'Customers affected', value: `${new Set(up.flatMap(m => m.tenants)).size}`, icon: 'building-2', sub: 'By upcoming windows' },
            { label: 'Notices to send', value: `${up.reduce((a, m) => a + m.tenants.filter(t => t !== 'h360' && !m.sent.some(x => x.customer === t)).length, 0)}`, icon: 'mail', sub: '7-day notices not yet sent' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={view} onChange={setView} options={[{ v: 'upcoming', label: 'Upcoming', count: up.length }, { v: 'past', label: 'Past', count: list.length - up.length }]} />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Stored in UTC; shown to each customer in their own time zone</span>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Maintenance windows"
          cols={[
            { k: 'n', label: 'Window', w: 'minmax(200px,1.4fr)' },
            { k: 'c', label: 'Components', w: 'minmax(200px,1.5fr)', dim: true },
            { k: 'utc', label: 'Starts (UTC)', w: '190px' },
            { k: 'ist', label: 'India (IST)', w: '200px', dim: true },
            { k: 't', label: 'Customers', w: '100px', r: true },
            { k: 'p', label: 'Page', w: '80px' },
            { k: 'st', label: 'State', w: '130px' }
          ]}
          rows={rows.map(m => ({
            id: m.id,
            n: { v: m.name, strong: true },
            c: { v: m.components, tip: m.components },
            utc: { v: m.startUtc, s: parseUtc(m.startUtc).getTime() },
            ist: m.ist,
            t: { v: String(m.tenants.filter(t => t !== 'h360').length), s: m.tenants.length, tip: m.tenants.map(custName).join(', ') },
            p: m.page ? { v: 'On' } : { v: 'Off', muted: true },
            st: { t: 'status', i: ST[m.state][0], c: ST[m.state][1], l: m.state, spin: m.state === 'In progress' }
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['window', 'windows']}
          emptyText={view === 'upcoming' ? 'No maintenance scheduled.' : 'No past windows.'}
          emptyAction={view === 'upcoming' ? 'Schedule maintenance' : undefined}
          onEmpty={() => add.open(true)}
          sort="utc"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Maintenance window"
          kicker={`Maintenance · ${d.components}`}
          title={d.name}
          status={<><Status icon={ST[d.state][0]} tone={ST[d.state][1]} label={d.state} spin={d.state === 'In progress'} /><span>{d.ist}</span></>}
          actions={
            d.state === 'Scheduled' ? (
              <>
                <Btn kind="primary" icon="play" onClick={() => start(d)}>Start now</Btn>
                <Btn kind="outline" icon="mail" disabled={d.tenants.every(t => t === 'h360' || d.sent.some(x => x.customer === t))} why="Every customer has had the 7-day notice." onClick={() => {
                  const add = d.tenants.filter(t => t !== 'h360' && !d.sent.some(x => x.customer === t)).map(t => ({ customer: t, brand: brandOf(t), when: ctx.now(), what: brandOf(t) === 'Host360' ? '7-day notice' : '7-day notice (white-labelled)' }));
                  patch(d.id, { sent: [...d.sent, ...add] });
                  ctx.toast(`Notice sent to ${plural(add.length, 'customer')}, each in their own brand and time zone`, 'ok');
                }}>Send notices</Btn>
                <Spacer />
                <Btn kind="danger" icon="circle-x" onClick={() => cancel.open(d.id)}>Cancel window…</Btn>
              </>
            ) : d.state === 'In progress' ? (
              <Btn kind="primary" icon="check" onClick={() => close.open(d.id)}>Close and tell customers…</Btn>
            ) : undefined
          }
          tabs={[{ v: 'Overview', label: 'Overview' }, { v: 'Times', label: 'Customer times' }, { v: 'Comms', label: 'Communication' }, ...(d.page ? [{ v: 'Page', label: 'Maintenance page' }] : []), ...(d.log ? [{ v: 'Log', label: 'Log' }] : [])]}
          tab={tab}
          onTab={setTab}
          width={680}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {d.result ? <Bar tone="ok" icon="circle-check" multiline>{d.result}</Bar> : null}
              {d.state === 'In progress' ? <Bar tone="info" icon="loader-circle">In progress. Alerts for the scope are suppressed; scheduled jobs wait for the window to close.</Bar> : null}
              <Facts items={[{ k: 'Components', v: d.components }, { k: 'Starts', v: d.startUtc }, { k: 'Ends', v: d.endUtc }, { k: 'In India', v: d.ist }, { k: 'Impact', v: d.impact }, { k: 'Maintenance page', v: d.page ? 'Shown in the console while the orchestrator restarts' : 'Not needed', muted: !d.page }, { k: 'Customers', v: d.tenants.map(custName).join(', ') }]} />
            </div>
          ) : null}
          {tab === 'Times' ? (
            <MiniTable
              label="Customer times"
              cols={[{ label: 'Customer' }, { label: 'Time zone', w: '130px' }, { label: 'Starts', w: '180px' }, { label: 'Ends', w: '100px' }]}
              rows={d.tenants.map(t => { const c = cust(t); return [<strong key="c" style={{ fontWeight: 600 }}>{c.name}</strong>, iana(c.tz), local(parseUtc(d.startUtc), c.tz), local(parseUtc(d.endUtc), c.tz, false)]; })}
            />
          ) : null}
          {tab === 'Comms' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <MiniTable
                label="Notices"
                cols={[{ label: 'Customer' }, { label: 'Brand', w: '170px' }, { label: 'Sent', w: '170px' }, { label: 'Notice', w: '170px' }]}
                rows={[
                  ...d.sent.map(x => [<strong key="c" style={{ fontWeight: 600 }}>{custName(x.customer)}</strong>, x.brand === 'Host360' ? 'Host360' : <span key="b" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="eye-off" style={{ color: 'var(--tx-3)' }} />{x.brand}</span>, x.when.replace(' 2026', ''), x.what]),
                  ...d.tenants.filter(t => t !== 'h360' && !d.sent.some(x => x.customer === t)).map(t => [<strong key="c" style={{ fontWeight: 600 }}>{custName(t)}</strong>, brandOf(t), <em key="w" style={{ color: 'var(--tx-3)' }}>Not sent</em>, '7-day notice due'])
                ]}
                empty="Only Host360’s own estate is affected; no customer notices."
              />
              <NotificationPreview t={TEMPLATES.find(t => t.id === (d.state === 'Completed' ? 't6' : 't5'))!} extra={{ 'window.components': d.components, 'window.start_local': local(parseUtc(d.startUtc), 'Asia/Kolkata'), 'window.end_local': local(parseUtc(d.endUtc), 'Asia/Kolkata', false), 'window.impact': d.impact, 'window.result': d.result || 'Everything is back to normal.' }} />
            </div>
          ) : null}
          {tab === 'Page' ? <MaintenancePage d={d} /> : null}
          {tab === 'Log' && d.log ? <LogView lines={d.log} height={360} /> : null}
        </Drawer>
      ) : null}
      {close.value ? (
        <CloseDialog
          m={list.find(m => m.id === close.value)!}
          closing={close.closing}
          onClose={close.close}
          onDone={result => {
            const m = list.find(x => x.id === close.value)!;
            const hms = ctx.hms();
            patch(m.id, { state: 'Completed', result, log: [...(m.log || []), { t: hms, text: 'Window closed by priya.raman; alerts released', lv: 'ok' }, { t: hms, text: 'Held jobs released', lv: 'ok' }], sent: [...m.sent, ...m.tenants.filter(t => t !== 'h360').map(t => ({ customer: t, brand: brandOf(t), when: ctx.now(), what: brandOf(t) === 'Host360' ? 'Completed' : 'Completed (white-labelled)' }))] });
            audit({ who: 'priya.raman', customer: 'h360', what: 'Closed maintenance', object: m.name, when: ctx.now(), r: 'ok', note: result });
            ctx.toast(`${m.name} closed; success message sent to ${plural(m.tenants.filter(t => t !== 'h360').length, 'customer')}`, 'ok');
            close.close();
          }}
        />
      ) : null}
      {cancel.value ? (
        <CancelDialog
          m={list.find(m => m.id === cancel.value)!}
          closing={cancel.closing}
          onClose={cancel.close}
          onDone={why => {
            const m = list.find(x => x.id === cancel.value)!;
            patch(m.id, { state: 'Cancelled', result: `Cancelled by priya.raman: ${why}` });
            audit({ who: 'priya.raman', customer: 'h360', what: 'Cancelled maintenance', object: m.name, when: ctx.now(), r: 'ok', note: why });
            ctx.toast(`${m.name} cancelled; customers who had a notice are told`, 'ok');
            cancel.close();
          }}
        />
      ) : null}
      {add.value ? <ScheduleWizard ctx={ctx} closing={add.closing} onClose={add.close} onAdd={m => { setList(x => [...x, m]); add.close(); setView('upcoming'); drawer.open(m.id); setTab('Times'); }} /> : null}
    </Page>
  );
}

function MaintenancePage({ d }: { d: Maint }) {
  const [brand, setBrand] = useState<'host360' | 'cloudnest'>('host360');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Seg label="Brand" value={brand} onChange={setBrand} options={[{ v: 'host360', label: 'Host360' }, { v: 'cloudnest', label: 'CloudNest (white-label)' }]} />
      <div style={{ border: '1px solid var(--ln-2)', background: 'var(--app)', padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '500 17px var(--f-head)' }}>
          {brand === 'host360' ? <Icon name="mark" size={22} /> : <span style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', background: 'var(--tx)', color: 'var(--app)', font: '700 12px var(--f-ui)' }}>C</span>}
          {brand === 'host360' ? 'Host360 Aegis' : 'CloudNest Resilience'}
        </span>
        <Icon name="calendar-clock" size={32} style={{ color: 'var(--tx-2)' }} />
        <h3 style={{ font: '500 20px/28px var(--f-head)' }}>Planned maintenance</h3>
        <p style={{ maxWidth: 420, color: 'var(--tx-2)' }}>We are upgrading the service. It is back by {d.endUtc.split(', ')[1].replace(' UTC', '')} UTC ({d.ist.split(' to ')[1]}). Your backups and replication keep running; nothing you scheduled is lost.</p>
        <p style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{brand === 'host360' ? 'status.host360.ai' : 'status.cloudnest.in'} · this page refreshes every minute</p>
      </div>
    </div>
  );
}

function CloseDialog({ m, closing, onClose, onDone }: { m: Maint; closing: boolean; onClose: () => void; onDone: (result: string) => void }) {
  const [outcome, setOutcome] = useState<'ok' | 'partial'>('ok');
  const [result, setResult] = useState('Completed as planned. Everything is back to normal.');
  return (
    <Dialog
      title={`Close ${m.name}`}
      sub="Releases alerts and held jobs, and sends the success message to every affected customer in their brand."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="send" disabled={result.trim().length < 10} why="Say how it went; customers read this." onClick={() => onDone(result.trim())}>Close and send</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={outcome === 'ok'} onClick={() => { setOutcome('ok'); setResult('Completed as planned. Everything is back to normal.'); }} icon="circle-check" title="Completed" />
        <RadioCard on={outcome === 'partial'} onClick={() => { setOutcome('partial'); setResult('Partly completed; the remaining work moves to a new window. Service is back to normal.'); }} icon="triangle-alert" title="Partly completed" />
      </div>
      <Field id="cl-r" label="Message to customers"><TextArea id="cl-r" value={result} onChange={setResult} rows={3} /></Field>
    </Dialog>
  );
}

function CancelDialog({ m, closing, onClose, onDone }: { m: Maint; closing: boolean; onClose: () => void; onDone: (why: string) => void }) {
  const [why, setWhy] = useState('');
  return (
    <Dialog
      title={`Cancel ${m.name}`}
      sub={m.sent.length ? `${plural(m.sent.length, 'customer')} had a notice; each is told it is cancelled.` : 'No customer had a notice yet.'}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Keep it</Btn><Btn kind="danger" icon="circle-x" disabled={why.trim().length < 6} why="Give a reason customers will read." onClick={() => onDone(why.trim())}>Cancel window</Btn></>}
    >
      <Field id="cn-w" label="Reason"><TextInput id="cn-w" value={why} onChange={setWhy} placeholder="Vendor patch withdrawn; rescheduling" autoFocus /></Field>
    </Dialog>
  );
}

function ScheduleWizard({ ctx, closing, onClose, onAdd }: { ctx: Ctx; closing: boolean; onClose: () => void; onAdd: (m: Maint) => void }) {
  const s = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [comp, setComp] = useState(COMPONENTS[0].v);
  const [day, setDay] = useState('2026-11-08');
  const [time, setTime] = useState('02:00');
  const [zone, setZone] = useState<'IST' | 'UTC'>('IST');
  const [hours, setHours] = useState('2');
  const [impact, setImpact] = useState('Scheduled backups that fall in the window start when it ends.');
  const [page, setPage] = useState(false);
  const [n7, setN7] = useState(true);
  const [n24, setN24] = useState(true);
  const preset = COMPONENTS.find(c => c.v === comp)!.tenants;
  const [tenants, setTenants] = useState<string[]>(s.customers.map(c => c.id));
  const chosen = preset === 'all' ? s.customers.map(c => c.id) : tenants.filter(t => (preset as string[]).includes(t));
  const [y, mo, dd] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const start = new Date(Date.UTC(y, mo - 1, dd, hh, mm) - (zone === 'IST' ? 330 * 60000 : 0));
  const end = new Date(start.getTime() + +hours * 3600000);
  const soon = start.getTime() - new Date(2026, 9, 21, 16, 5).getTime() < 7 * 86400000;
  const ok = [name.trim().length >= 4 && !!day && !!time, chosen.length > 0 && impact.trim().length >= 10, true, true][step];
  return (
    <Wizard
      title="Schedule maintenance"
      sub="Stored in UTC. Each customer sees it, and is told about it, in their own time zone and brand."
      steps={['When', 'Who', 'Communication', 'Review']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={
        <Btn kind="primary" iconAfter={step < 3 ? 'arrow-right' : undefined} icon={step === 3 ? 'check' : undefined} disabled={!ok} why={step === 0 ? 'Name the window and set when it starts.' : 'Pick at least one customer and describe the impact.'} onClick={() => {
          if (step < 3) return setStep(step + 1);
          const m: Maint = { id: 'mx' + Date.now(), name: name.trim(), components: comp, startUtc: fmtUtc(start), endUtc: fmtUtc(end), ist: `${local(start, 'Asia/Kolkata').replace(' IST', '').replace(/^\w{3} /, '').replace(/(\d{2} \w{3}) /, '$1, ')} to ${local(end, 'Asia/Kolkata', false)}`, tenants: chosen, impact: impact.trim(), state: 'Scheduled', page, sent: [] };
          audit({ who: 'priya.raman', customer: 'h360', what: 'Scheduled maintenance', object: m.name, when: ctx.now(), r: 'ok', after: [['Starts', m.startUtc], ['Customers', String(chosen.length)]] });
          ctx.toast(`${m.name} scheduled${n7 ? '; 7-day notices go out automatically' : ''}`, 'ok');
          onAdd(m);
        }}>
          {step < 3 ? 'Next' : 'Schedule'}
        </Btn>
      }
    >
      {step === 0 ? (
        <>
          <Field id="sw-n" label="Name"><TextInput id="sw-n" value={name} onChange={setName} placeholder="Orchestrator upgrade to 4.2.2" autoFocus /></Field>
          <Field id="sw-c" label="Components"><SelectInput id="sw-c" value={comp} onChange={setComp} options={COMPONENTS.map(c => c.v)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 110px 110px', gap: 16 }}>
            <Field id="sw-d" label="Day"><TextInput id="sw-d" type="date" value={day} onChange={setDay} /></Field>
            <Field id="sw-t" label="Starts"><TextInput id="sw-t" type="time" value={time} onChange={setTime} /></Field>
            <Field id="sw-z" label="Zone"><SelectInput id="sw-z" value={zone} onChange={z => setZone(z as 'IST' | 'UTC')} options={['IST', 'UTC']} /></Field>
            <Field id="sw-h" label="Hours"><SelectInput id="sw-h" value={hours} onChange={setHours} options={['1', '2', '3', '4', '6', '8']} /></Field>
          </div>
          <Facts items={[{ k: 'UTC', v: `${fmtUtc(start)} to ${fmtUtc(end).split(', ')[1]}` }, { k: 'India', v: `${local(start, 'Asia/Kolkata')} to ${local(end, 'Asia/Kolkata', false)}` }, { k: 'Germany', v: `${local(start, 'Europe/Berlin')} to ${local(end, 'Europe/Berlin', false)}` }]} />
          {soon ? <p style={{ display: 'flex', gap: 8 }}><Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: 2, flex: 'none' }} />Less than 7 days away. Contracts promise 7 days’ notice; customers may object.</p> : null}
        </>
      ) : null}
      {step === 1 ? (
        <>
          {preset === 'all' ? (
            <Bar tone="info">Every customer is affected by work on the orchestrator.</Bar>
          ) : (
            <Field label="Customers affected">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {s.customers.filter(c => (preset as string[]).includes(c.id)).map(c => <CheckBox key={c.id} on={tenants.includes(c.id)} onChange={v => setTenants(x => (v ? [...x, c.id] : x.filter(t => t !== c.id)))}>{c.name}</CheckBox>)}
              </div>
            </Field>
          )}
          <Field id="sw-i" label="What changes for customers"><TextArea id="sw-i" value={impact} onChange={setImpact} rows={2} /></Field>
          <Toggle on={page} onChange={setPage} label="Maintenance page">Show the maintenance page in the console during the window</Toggle>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div style={{ display: 'flex', gap: 24 }}>
            <CheckBox on={n7} onChange={setN7}>Notice 7 days before</CheckBox>
            <CheckBox on={n24} onChange={setN24}>Reminder 24 hours before</CheckBox>
          </div>
          <MiniTable label="Who is told how" cols={[{ label: 'Customer' }, { label: 'Brand', w: '180px' }, { label: 'Their time', w: '200px' }]} rows={chosen.filter(t => t !== 'h360').map(t => { const c = s.customers.find(x => x.id === t)!; return [c.name, c.whiteLabel ? <span key="b" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="eye-off" style={{ color: 'var(--tx-3)' }} />{c.whiteLabel}</span> : 'Host360', local(start, c.tz)]; })} empty="Only Host360’s own estate; no customer notices." />
          <NotificationPreview t={TEMPLATES.find(t => t.id === 't5')!} extra={{ 'window.components': comp, 'window.start_local': local(start, 'Asia/Kolkata'), 'window.end_local': local(end, 'Asia/Kolkata', false), 'window.impact': impact }} />
        </>
      ) : null}
      {step === 3 ? (
        <Facts items={[{ k: 'Window', v: name }, { k: 'Components', v: comp }, { k: 'UTC', v: `${fmtUtc(start)} to ${fmtUtc(end).split(', ')[1]}` }, { k: 'Customers', v: chosen.map(custName).join(', ') }, { k: 'Maintenance page', v: page ? 'On' : 'Off' }, { k: 'Notices', v: [n7 ? '7 days before' : '', n24 ? '24 hours before' : ''].filter(Boolean).join(' and ') || 'None', muted: !n7 && !n24 }, { k: 'When it closes', v: 'The success message goes to every affected customer' }]} />
      ) : null}
    </Wizard>
  );
}
