import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { ALERT_RULES, MAINT_WINDOWS, ORCH_TZ, USERS, type PAlert } from '../data/platform';
import { Btn, Field, FilterInput, InfoTip, Seg, SelectFilter, SelectInput, TextInput, Toggle } from '../ui/controls';
import { Activity, Bar, BulkBar, Facts, MiniTable, Spacer, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, showCustomerCol } from './common';
import { audit, update, useStore } from './store';

const SEV: Record<PAlert['sev'], [string, string, string, number]> = { critical: ['circle-x', 'Critical', 'err', 0], warning: ['triangle-alert', 'Warning', 'warn', 1], info: ['info', 'Info', 'tx', 2] };
const STATE: Record<PAlert['state'], [string, string]> = { open: ['circle-dot', 'Open'], acknowledged: ['user-check', 'Acknowledged'], suppressed: ['circle-minus', 'Suppressed'], escalated: ['arrow-up', 'Escalated'] };
const PEOPLE = USERS.filter(u => u.side === 'Provider' && u.status === 'active').map(u => u.name);

export function AlertsTab({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [view, setView] = useState<'open' | 'ack' | 'supp' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sev, setSev] = useState('All');
  const [prod, setProd] = useState('All');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Details');
  const assign = useClosable<string[]>();
  const suppress = useClosable<string[]>();
  useEffect(() => {
    if (ctx.openId && s.alerts.some(a => a.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = s.alerts.filter(a => inScope(ctx, a.customer));
  const inView = (a: PAlert) => (view === 'open' ? a.state === 'open' || a.state === 'escalated' : view === 'ack' ? a.state === 'acknowledged' : view === 'supp' ? a.state === 'suppressed' : true);
  const ql = q.trim().toLowerCase();
  const rows = all.filter(a => inView(a) && (sev === 'All' || SEV[a.sev][1] === sev) && (prod === 'All' || a.product === prod) && (!ql || `${a.title} ${a.object} ${a.detail}`.toLowerCase().includes(ql)));
  const incidents = [...new Set(all.filter(a => a.incident && a.state !== 'suppressed').map(a => a.incident!))];
  const op = ctx.can('operate', 'Acknowledging alerts');
  const selIds = Object.keys(sel).filter(k => sel[k] && rows.some(r => r.id === k));
  const setState = (ids: string[], st: PAlert['state'], extra?: Partial<PAlert>) => {
    update(x => ids.forEach(id => Object.assign(x.alerts.find(a => a.id === id)!, { state: st, ...extra })));
    ids.forEach(id => {
      const a = s.alerts.find(x => x.id === id)!;
      audit({ who: 'priya.raman', customer: a.customer, what: `${STATE[st][1]} alert`, object: `${a.title} · ${a.object}`, when: ctx.now(), r: 'ok' });
    });
  };
  const d = drawer.value ? s.alerts.find(a => a.id === drawer.value) : null;
  const custCol = showCustomerCol(ctx);
  return (
    <>
      {incidents.length && view !== 'supp' ? (
        <div style={{ padding: '0 24px 12px' }}>
          <Bar tone="warn" icon="layers" actions={<Btn kind="ghost" size="sm" onClick={() => setQ('region-2-os')}>Show its alerts</Btn>}>
            <strong style={{ fontWeight: 600 }}>Incident INC-region-2-os</strong> · 3 alerts grouped: region-2-os could not be read, so its proxy and the replication to it are reported once.
          </Bar>
        </div>
      ) : null}
      <Toolbar>
        {selIds.length ? (
          <BulkBar label={plural(selIds.length, 'alert') + ' selected'} onClear={() => setSel({})}>
            <Btn kind="ghost" icon="user-check" perm={op} onClick={() => { setState(selIds, 'acknowledged', { assignee: 'Priya Raman' }); ctx.toast(`${plural(selIds.length, 'alert')} acknowledged`, 'ok'); setSel({}); }}>
              Acknowledge
            </Btn>
            <Btn kind="ghost" icon="users" perm={op} onClick={() => assign.open(selIds)}>
              Assign…
            </Btn>
            <Btn kind="ghost" icon="circle-minus" perm={op} onClick={() => suppress.open(selIds)}>
              Suppress…
            </Btn>
          </BulkBar>
        ) : (
          <>
            <Seg
              label="Show"
              value={view}
              onChange={setView}
              options={[
                { v: 'open', label: 'Open', count: all.filter(a => a.state === 'open' || a.state === 'escalated').length },
                { v: 'ack', label: 'Acknowledged', count: all.filter(a => a.state === 'acknowledged').length },
                { v: 'supp', label: 'Suppressed', count: all.filter(a => a.state === 'suppressed').length },
                { v: 'all', label: 'All', count: all.length }
              ]}
            />
            <FilterInput value={q} onChange={setQ} placeholder="Filter by title, object or detail" label="Filter alerts" width={240} />
            <SelectFilter label="Severity" value={sev} onChange={setSev} options={['All', 'Critical', 'Warning', 'Info']} />
            <SelectFilter label="Product" value={prod} onChange={setProd} options={['All', 'Protection', 'Resilience', 'Mobility', 'Platform']} />
            <Spacer />
          </>
        )}
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Alerts"
          cols={[
            { k: 'sev', label: 'Severity', w: '112px' },
            { k: 'title', label: 'Alert', w: 'minmax(180px,1.4fr)' },
            { k: 'object', label: 'Object', w: 'minmax(140px,1fr)' },
            ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(120px,1fr)', dim: true }] : []),
            { k: 'n', label: 'Count', w: '64px', r: true },
            { k: 'raised', label: 'Raised', w: '188px', dim: true },
            { k: 'who', label: 'Assignee', w: '120px', dim: true },
            { k: 'st', label: 'State', w: '136px' }
          ]}
          rows={rows.map(a => ({
            id: a.id,
            sev: { t: 'status', i: SEV[a.sev][0], l: SEV[a.sev][1], c: SEV[a.sev][2], s: SEV[a.sev][3] },
            title: { v: a.title, strong: true, tip: a.detail },
            object: a.incident ? { t: 'icon', i: 'layers', l: a.object, c: 'tx', tip: `Part of ${a.incident}`, s: a.object } : a.object,
            cust: custName(a.customer),
            prod: a.product,
            n: { v: `×${a.count}`, s: a.count, muted: a.count === 1 },
            raised: a.raised,
            who: a.assignee ? a.assignee : { v: 'Nobody', muted: true },
            st: { t: 'status', i: STATE[a.state][0], l: STATE[a.state][1], c: a.state === 'escalated' ? 'err' : 'tx' }
          }))}
          sel={sel}
          onSel={(id: string) => setSel(x => ({ ...x, [id]: !x[id] }))}
          onSelAll={(ids: string[], on: boolean) => setSel(x => ({ ...x, ...Object.fromEntries(ids.map(i => [i, on])) }))}
          onRow={(id: string) => { drawer.open(id); setTab('Details'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['alert', 'alerts']}
          filtered={view !== 'open' || sev !== 'All' || prod !== 'All' || !!ql}
          onClear={() => { setView('all'); setSev('All'); setProd('All'); setQ(''); }}
          emptyText="No open alerts. Rules decide what raises one; see Alert rules."
          sort="sev"
          footR="Repeats within the rule's window are counted, not raised again"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Alert details"
          kicker={`Alert · ${d.product} · ${custName(d.customer)}`}
          title={`${d.title} · ${d.object}`}
          status={
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name={SEV[d.sev][0]} style={{ color: `var(--${SEV[d.sev][2] === 'tx' ? 'tx-2' : SEV[d.sev][2]})` }} />
                <span style={{ color: 'var(--tx)' }}>{SEV[d.sev][1]}</span>
              </span>
              <span>{STATE[d.state][1]}</span>
              <span>Raised {d.raised}</span>
            </>
          }
          actions={
            <>
              <Btn kind="outline" icon="user-check" perm={op} disabled={d.state === 'acknowledged'} why="Already acknowledged." onClick={() => { setState([d.id], 'acknowledged', { assignee: d.assignee || 'Priya Raman' }); ctx.toast(`Alert for ${d.object} acknowledged`, 'ok'); }}>
                Acknowledge
              </Btn>
              <Btn kind="outline" icon="users" perm={op} onClick={() => assign.open([d.id])}>
                Assign…
              </Btn>
              <Btn kind="outline" icon="arrow-up" perm={op} disabled={d.state === 'escalated'} why="Already escalated." onClick={() => { setState([d.id], 'escalated'); ctx.toast(`Escalated: ${d.title} on ${d.object}`, 'warn'); }}>
                Escalate
              </Btn>
              <Btn kind="outline" icon="circle-minus" perm={op} onClick={() => suppress.open([d.id])}>
                Suppress…
              </Btn>
            </>
          }
          tabs={[{ v: 'Details', label: 'Details' }, { v: 'Occurrences', label: 'Occurrences', count: d.count }, ...(d.incident ? [{ v: 'Incident', label: 'Incident' }] : [])]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Details' ? (
            <Facts
              items={[
                { k: 'What happened', v: d.detail },
                { k: 'Object', v: d.object },
                { k: 'Customer', v: custName(d.customer) },
                { k: 'Rule', v: d.rule },
                { k: 'Assignee', v: d.assignee || 'Nobody', muted: !d.assignee },
                { k: 'Escalation', v: d.escalation || 'Not escalated', muted: !d.escalation },
                ...(d.incident ? [{ k: 'Incident', v: `${d.incident} (grouped with related alerts)`, icon: 'layers' }] : [])
              ]}
            />
          ) : null}
          {tab === 'Occurrences' ? (
            <MiniTable label="Occurrences" cols={[{ label: '#', w: '40px' }, { label: 'Seen' }, { label: 'Result', w: '160px' }]} rows={Array.from({ length: d.count }, (_, i) => [String(d.count - i), i === 0 ? d.raised : `${d.raised.replace(/(\d\d):(\d\d)/, (_m, h, m) => `${h}:${String(Math.max(0, +m - i * 15)).padStart(2, '0')}`)}`, i === 0 ? 'Raised' : 'Counted, not raised'])} />
          ) : null}
          {tab === 'Incident' && d.incident ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--tx-2)' }}>One failed connection causes these alerts. They are handled together: acknowledging the incident acknowledges each of them.</p>
              <Activity items={s.alerts.filter(a => a.incident === d.incident).map(a => ({ icon: SEV[a.sev][0], tone: SEV[a.sev][2], text: <><strong style={{ fontWeight: 600 }}>{a.title}</strong> · {a.object}</>, when: a.raised }))} />
            </div>
          ) : null}
        </Drawer>
      ) : null}
      {assign.value ? (
        <AssignDialog
          n={assign.value.length}
          closing={assign.closing}
          onClose={assign.close}
          onSave={who => {
            setState(assign.value!, 'acknowledged', { assignee: who });
            ctx.toast(`${plural(assign.value!.length, 'alert')} assigned to ${who}`, 'ok');
            assign.close();
            setSel({});
          }}
        />
      ) : null}
      {suppress.value ? (
        <SuppressDialog
          n={suppress.value.length}
          closing={suppress.closing}
          onClose={suppress.close}
          onSave={until => {
            setState(suppress.value!, 'suppressed');
            ctx.toast(`${plural(suppress.value!.length, 'alert')} suppressed ${until}`, 'ok');
            suppress.close();
            setSel({});
          }}
        />
      ) : null}
    </>
  );
}

function AssignDialog({ n, closing, onClose, onSave }: { n: number; closing: boolean; onClose: () => void; onSave: (who: string) => void }) {
  const [who, setWho] = useState(PEOPLE[1]);
  return (
    <Dialog size="sm" title={`Assign ${plural(n, 'alert')}`} closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => onSave(who)}>Assign</Btn></>}>
      <Field id="as-who" label="Assign to" hint="They are told by their preferred channel and the alert counts as acknowledged.">
        <SelectInput id="as-who" value={who} onChange={setWho} options={PEOPLE} />
      </Field>
    </Dialog>
  );
}

function SuppressDialog({ n, closing, onClose, onSave }: { n: number; closing: boolean; onClose: () => void; onSave: (until: string) => void }) {
  const [until, setUntil] = useState('for 4 hours');
  const [reason, setReason] = useState('');
  return (
    <Dialog size="sm" title={`Suppress ${plural(n, 'alert')}`} sub="New occurrences are counted but nobody is notified." closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="circle-minus" disabled={reason.trim().length < 3} why="Say why." onClick={() => onSave(until)}>Suppress</Btn></>}>
      <Field id="sp-until" label="Suppress">
        <SelectInput id="sp-until" value={until} onChange={setUntil} options={['for 1 hour', 'for 4 hours', 'until tomorrow 09:00 IST', 'until the maintenance window ends']} />
      </Field>
      <Field id="sp-why" label="Reason">
        <TextInput id="sp-why" value={reason} onChange={setReason} placeholder="Known issue, vendor case 0042188" />
      </Field>
    </Dialog>
  );
}

type Rule = (typeof ALERT_RULES)[number];

export function AlertRulesTab({ ctx }: { ctx: Ctx }) {
  const [rules, setRules] = useState<Rule[]>(ALERT_RULES);
  const dlg = useClosable<Rule | 'new'>();
  const cfg = ctx.can('configure', 'Changing alert rules');
  return (
    <>
      <Toolbar>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>
          Predefined rules ship with Aegis, default rules are switched on for every new customer, custom rules are yours.
          <InfoTip tip="Deduplication counts repeats inside the window instead of raising them again. Correlation groups alerts that share a cause, such as one unreachable site, into one incident." />
        </span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={cfg} onClick={() => dlg.open('new')}>
          Add a rule
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Alert rules"
          cols={[
            { k: 'name', label: 'Rule', w: 'minmax(160px,1fr)' },
            { k: 'kind', label: 'Kind', w: '104px' },
            { k: 'prod', label: 'Product', w: '104px', dim: true },
            { k: 'when', label: 'Raised when', w: 'minmax(200px,1.6fr)', dim: true },
            { k: 'sev', label: 'Severity', w: 'minmax(120px,1fr)' },
            { k: 'route', label: 'Sent to', w: 'minmax(140px,1fr)', dim: true },
            { k: 'dd', label: 'Deduplicate', w: '120px', dim: true },
            { k: 'on', label: 'State', w: '96px' }
          ]}
          rows={rules.map(r => ({ id: r.id, name: { v: r.name, strong: true }, kind: r.kind, prod: r.product, when: r.when, sev: r.sev, route: r.route, dd: r.dedupe, on: r.on ? { t: 'status', i: 'circle-check', l: 'On', c: 'ok' } : { t: 'status', i: 'circle-minus', l: 'Off', c: 'tx' } }))}
          onRow={(id: string) => dlg.open(rules.find(r => r.id === id)!)}
          state={ctx.ui}
          unit={['rule', 'rules']}
          emptyText="No alert rules. Nothing raises an alert until a rule exists."
        />
      </TableArea>
      {dlg.value ? (
        <AlertRuleDialog
          rule={dlg.value === 'new' ? null : dlg.value}
          perm={cfg}
          closing={dlg.closing}
          onClose={dlg.close}
          onSave={r => {
            setRules(x => (x.some(y => y.id === r.id) ? x.map(y => (y.id === r.id ? r : y)) : [...x, r]));
            ctx.toast(`Alert rule ${r.name} saved`, 'ok');
            dlg.close();
          }}
        />
      ) : null}
    </>
  );
}

function AlertRuleDialog({ rule, perm, closing, onClose, onSave }: { rule: Rule | null; perm: ReturnType<Ctx['can']>; closing: boolean; onClose: () => void; onSave: (r: Rule) => void }) {
  const [name, setName] = useState(rule?.name || '');
  const [when, setWhen] = useState(rule?.when || 'A backup job ends failed');
  const [sev, setSev] = useState(rule?.sev || 'Warning');
  const [route, setRoute] = useState(rule?.route || 'Owner, e-mail');
  const [dedupe, setDedupe] = useState(rule?.dedupe || '1 h');
  const [on, setOn] = useState(rule?.on ?? true);
  const predefined = rule?.kind === 'Predefined';
  return (
    <Dialog
      title={rule ? `Alert rule: ${rule.name}` : 'Add an alert rule'}
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="check" perm={perm} disabled={!name.trim()} why="Name the rule." onClick={() => onSave({ id: rule?.id || 'ar' + Date.now(), name: name.trim(), kind: rule?.kind || 'Custom', product: rule?.product || 'All', sev, when, route, dedupe, on })}>
            Save rule
          </Btn>
        </>
      }
    >
      {predefined ? <Bar tone="info" icon="pin">Predefined rules can be switched off and re-routed, but their condition is fixed.</Bar> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="ar-name" label="Name">
          <TextInput id="ar-name" value={name} onChange={setName} placeholder="Repository above 85 %" />
        </Field>
        <Field id="ar-sev" label="Severity">
          <SelectInput id="ar-sev" value={sev} onChange={setSev} options={[sev, 'Info', 'Warning', 'Critical', 'Warning → Critical after 2 × target'].filter((x, i, a) => a.indexOf(x) === i)} />
        </Field>
      </div>
      <Field id="ar-when" label="Raise when">
        <SelectInput id="ar-when" value={when} onChange={setWhen} disabled={predefined} options={[when, 'A backup job ends failed', 'Newest point older than the target', 'A site does not answer for 30 s', 'No heartbeat for 60 s', 'Datastore or repository above 90 % for 10 min', 'A cutover did not start in its window'].filter((x, i, a) => a.indexOf(x) === i)} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="ar-route" label="Send to">
          <SelectInput id="ar-route" value={route} onChange={setRoute} options={[route, 'Owner, e-mail', 'Owner, Teams #aegis-alerts', 'DR on-call (PagerDuty)', 'Platform team', 'Customer owner, account manager'].filter((x, i, a) => a.indexOf(x) === i)} />
        </Field>
        <Field id="ar-dd" label="Count repeats for">
          <SelectInput id="ar-dd" value={dedupe} onChange={setDedupe} options={[dedupe, '30 min', '1 h', '6 h', '1 day', 'Once'].filter((x, i, a) => a.indexOf(x) === i)} />
        </Field>
      </div>
      <Toggle on={on} onChange={setOn} label="Rule on">
        {on ? 'On' : 'Off'}
      </Toggle>
    </Dialog>
  );
}

export function MaintenanceTab({ ctx }: { ctx: Ctx }) {
  const [wins, setWins] = useState(MAINT_WINDOWS);
  const dlg = useClosable<boolean>();
  const [name, setName] = useState('');
  const [scope, setScope] = useState('aegis-appliance-os1');
  const [day, setDay] = useState('2026-11-01');
  const [from, setFrom] = useState('01:00');
  const [to, setTo] = useState('03:00');
  const cfg = ctx.can('configure', 'Scheduling maintenance');
  return (
    <>
      <Toolbar>
        <span style={{ font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>Alerts from the scope are suppressed during the window and released at its end. Times are {ORCH_TZ}.</span>
        <Spacer />
        <Btn kind="primary" icon="calendar" perm={cfg} onClick={() => dlg.open(true)}>
          Schedule a window
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Maintenance windows"
          cols={[
            { k: 'name', label: 'Window', w: 'minmax(180px,1.2fr)' },
            { k: 'scope', label: 'Scope', w: 'minmax(160px,1.2fr)', dim: true },
            { k: 'starts', label: 'Starts', w: '188px' },
            { k: 'ends', label: 'Ends', w: '188px' },
            { k: 'supp', label: 'Suppresses', w: 'minmax(160px,1.2fr)', dim: true },
            { k: 'st', label: 'State', w: '112px' }
          ]}
          rows={wins.map(w => ({ id: w.id, name: { v: w.name, strong: true }, scope: w.scope, starts: w.starts, ends: w.ends, supp: w.suppress, st: { t: 'status', i: 'calendar-clock', l: w.state, c: 'tx' } }))}
          state={ctx.ui}
          unit={['window', 'windows']}
          emptyText="No maintenance windows. Schedule one to stop planned work from raising alerts."
          emptyAction="Schedule a window"
          onEmpty={() => dlg.open(true)}
        />
      </TableArea>
      {dlg.value ? (
        <Dialog
          title="Schedule a maintenance window"
          sub="Times are in the orchestrator's zone. The window shows in every product's calendar."
          closing={dlg.closing}
          onClose={dlg.close}
          footer={
            <>
              <Btn kind="ghost" onClick={dlg.close}>
                Cancel
              </Btn>
              <Btn
                kind="primary"
                icon="check"
                perm={cfg}
                disabled={!name.trim() || to <= from}
                why={!name.trim() ? 'Name the window.' : 'The window must end after it starts.'}
                onClick={() => {
                  const dd = new Date(day + 'T00:00');
                  const label = `${String(dd.getDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dd.getMonth()]} ${dd.getFullYear()}`;
                  setWins(x => [...x, { id: 'mw' + Date.now(), name: name.trim(), scope, starts: `${label}, ${from} IST`, ends: `${label}, ${to} IST`, suppress: 'All warnings for the scope', state: 'Scheduled' }]);
                  ctx.toast(`Maintenance window ${name.trim()} scheduled`, 'ok');
                  dlg.close();
                  setName('');
                }}
              >
                Schedule
              </Btn>
            </>
          }
        >
          <Field id="mw-name" label="Name">
            <TextInput id="mw-name" value={name} onChange={setName} placeholder="Appliance upgrade to 4.2.1" />
          </Field>
          <Field id="mw-scope" label="Scope">
            <SelectInput id="mw-scope" value={scope} onChange={setScope} options={['aegis-appliance-os1', 'aegis-proxy-cmp4, cmp5, cmp6', 'Chennai-proxmox-prod', 'production-openstack', 'Meridian-Treasury', 'Every customer']} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 120px', gap: 16 }}>
            <Field id="mw-day" label="Day">
              <TextInput id="mw-day" type="date" value={day} onChange={setDay} />
            </Field>
            <Field id="mw-from" label="From (IST)">
              <TextInput id="mw-from" type="time" value={from} onChange={setFrom} />
            </Field>
            <Field id="mw-to" label="To (IST)" err={to <= from ? 'Ends before it starts.' : null}>
              <TextInput id="mw-to" type="time" value={to} onChange={setTo} invalid={to <= from} />
            </Field>
          </div>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
            <Icon name="clock" /> Shown to customers in their own time zone; Atlas Freight sees CET.
          </p>
        </Dialog>
      ) : null}
    </>
  );
}
