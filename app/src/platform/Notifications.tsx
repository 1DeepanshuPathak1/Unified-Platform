import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { T } from '../data/platform';
import { TEMPLATES } from '../data/internal';
import { Btn, CheckBox, Field, Seg, SelectInput, TextInput, Toggle } from '../ui/controls';
import { Bar, Facts, MiniTable, Panel, Spacer, Status, TableArea, Toolbar } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { NotificationPreview } from '../admin/Templates';
import { custName, inScope, showCustomerCol } from './common';
import { audit, useStore } from './store';

type Kind = 'SMTP' | 'Webhook' | 'Teams' | 'Slack' | 'SMS' | 'PagerDuty';
interface Channel { id: string; kind: Kind; name: string; customer: string; target: string; detail: string; state: 'ok' | 'err'; last: string; note?: string }
const KIND_ICON: Record<Kind, string> = { SMTP: 'mail', Webhook: 'send', Teams: 'message-square', Slack: 'message-square', SMS: 'message-square', PagerDuty: 'bell' };
const CHANNELS: Channel[] = [
  { id: 'n1', kind: 'SMTP', name: 'Host360 mail', customer: 'h360', target: 'smtp.host360.ai:587 (STARTTLS)', detail: 'From aegis@host360.ai · SPF and DKIM pass · default for every customer without their own', state: 'ok', last: T('21 Oct', '16:02') },
  { id: 'n2', kind: 'SMTP', name: 'Meridian’s own mail server', customer: 'mer', target: 'smtp.meridianbank.in:465 (TLS)', detail: 'From aegis-alerts@meridianbank.in · DKIM selector aegis1 verified · relay allowed for 103.21.44.0/24', state: 'ok', last: T('21 Oct', '15:40') },
  { id: 'n3', kind: 'Teams', name: 'Infra › #aegis-alerts', customer: 'h360', target: 'Workflows webhook (Power Automate)', detail: 'Adaptive cards with Acknowledge and Open buttons', state: 'ok', last: T('21 Oct', '15:58') },
  { id: 'n4', kind: 'Slack', name: 'Kaveri #it-alerts', customer: 'kav', target: 'Slack app “Aegis” in kaveri-logistics.slack.com', detail: 'Bot token revoked on 19 Oct by a Kaveri admin; nothing is delivered', state: 'err', last: T('19 Oct', '09:12'), note: 'Ask Kaveri to reinstall the app; messages since 19 Oct went to e-mail instead.' },
  { id: 'n5', kind: 'SMS', name: 'MSG91 (India)', customer: 'h360', target: 'Sender ID HOSTSV · DLT entity 1101583920000012345', detail: 'DLT template “AEGIS-CRIT” approved; only Critical alerts, 160 characters', state: 'ok', last: T('20 Oct', '02:14') },
  { id: 'n6', kind: 'PagerDuty', name: 'Host360 on-call', customer: 'h360', target: 'Events API v2 · routing key ••••3f2a', detail: 'Service “Aegis platform”; resolves itself when the alert clears', state: 'ok', last: T('21 Oct', '14:52') },
  { id: 'n7', kind: 'Webhook', name: 'ServiceNow incidents', customer: 'h360', target: 'https://host360.service-now.com/api/x_aegis/alerts', detail: 'Signed with HMAC SHA-256 in X-Aegis-Signature · retries 5 times over 30 min', state: 'ok', last: T('21 Oct', '14:53') },
  { id: 'n8', kind: 'PagerDuty', name: 'Meridian DBA rota', customer: 'mer', target: 'Events API v2 · routing key ••••91c0', detail: 'Database alerts only', state: 'ok', last: T('17 Oct', '23:41') }
];
const SEVS = ['Critical', 'Serious', 'Warning', 'Info'] as const;
const ROUTE_KINDS: Kind[] = ['SMTP', 'Teams', 'Slack', 'SMS', 'PagerDuty', 'Webhook'];
const ROUTE_LABEL: Record<Kind, string> = { SMTP: 'E-mail', Teams: 'Teams', Slack: 'Slack', SMS: 'SMS', PagerDuty: 'PagerDuty', Webhook: 'Webhook' };
const DEFAULT_ROUTES: Record<string, Kind[]> = { Critical: ['SMTP', 'Teams', 'SMS', 'PagerDuty', 'Webhook'], Serious: ['SMTP', 'Teams', 'Webhook'], Warning: ['SMTP', 'Teams'], Info: [] };

/** Settings › Notifications: where alerts go, who gets which, escalation, digests and each person's preferences. */
export function NotificationsTab({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<'channels' | 'routing' | 'people'>('channels');
  return (
    <>
      <Toolbar>
        <Seg label="Show" value={view} onChange={setView} options={[{ v: 'channels', label: 'Channels' }, { v: 'routing', label: 'Routing and escalation' }, { v: 'people', label: 'Preferences' }]} />
        <Spacer />
      </Toolbar>
      {view === 'channels' ? <Channels ctx={ctx} /> : null}
      {view === 'routing' ? <Routing ctx={ctx} /> : null}
      {view === 'people' ? <People ctx={ctx} /> : null}
    </>
  );
}

function Channels({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Channel[]>(CHANNELS);
  const drawer = useClosable<string>();
  const add = useClosable<boolean>();
  const [testing, setTesting] = useState<string | null>(null);
  const rows = list.filter(c => inScope(ctx, c.customer) || (!!ctx.actingAs && c.id === 'n1'));
  const cfg = ctx.can('configure', 'Changing notification channels');
  const d = drawer.value ? list.find(c => c.id === drawer.value) : null;
  const test = (c: Channel) => {
    setTesting(c.id);
    window.setTimeout(() => {
      setTesting(null);
      if (c.state === 'err') ctx.toast(`${c.name}: test failed (401 token_revoked)`, 'err');
      else { setList(x => x.map(y => (y.id === c.id ? { ...y, last: ctx.now() } : y))); ctx.toast(`Test sent to ${c.name}`, 'ok'); }
    }, 1200);
  };
  return (
    <>
      {rows.some(c => c.state === 'err') ? <div style={{ padding: '0 24px 12px' }}><Bar tone="warn">{rows.filter(c => c.state === 'err').map(c => `${c.name}: ${c.note}`).join(' ')}</Bar></div> : null}
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Mail goes out from the customer’s own server when they have one, so it arrives from their domain.</span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={cfg} onClick={() => add.open(true)}>Add a channel</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Notification channels"
          cols={[
            { k: 'n', label: 'Channel', w: 'minmax(200px,1.4fr)' },
            { k: 'k', label: 'Kind', w: '120px' },
            ...(showCustomerCol(ctx) ? [{ k: 'c', label: 'Customer', w: 'minmax(150px,1fr)', dim: true }] : []),
            { k: 't', label: 'Sends to', w: 'minmax(220px,1.6fr)', dim: true },
            { k: 'l', label: 'Last sent', w: '120px' },
            { k: 'st', label: 'State', w: '130px' }
          ]}
          rows={rows.map(c => ({
            id: c.id,
            n: { v: c.name, strong: true },
            k: { t: 'icon', i: KIND_ICON[c.kind], c: 'tx', l: c.kind },
            c: custName(c.customer),
            t: { v: c.target, tip: c.detail },
            l: c.last.replace(' 2026', '').replace(' IST', ''),
            st: testing === c.id ? { t: 'status', i: 'loader-circle', spin: true, c: 'run', l: 'Testing' } : c.state === 'ok' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Delivering' } : { t: 'status', i: 'circle-x', c: 'err', l: 'Failing', tip: c.note }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['channel', 'channels']}
          emptyText="No channels yet. Add e-mail first; alerts fall back to it when another channel fails."
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Channel"
          kicker={`Notification channel · ${d.kind}`}
          title={d.name}
          status={<Status icon={d.state === 'ok' ? 'circle-check' : 'circle-x'} tone={d.state === 'ok' ? 'ok' : 'err'} label={d.state === 'ok' ? 'Delivering' : 'Failing'} />}
          actions={<><Btn kind="outline" icon={testing === d.id ? 'loader-circle' : 'send'} spin={testing === d.id} disabled={testing === d.id} why="Sending." onClick={() => test(d)}>Send a test</Btn><Spacer /><Btn kind="ghost" icon="trash-2" perm={cfg} disabled={d.id === 'n1'} why="Host360 mail is the fallback for every channel." onClick={() => { setList(x => x.filter(y => y.id !== d.id)); drawer.close(); audit({ who: 'priya.raman', customer: d.customer, what: 'Removed a notification channel', object: d.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.name} removed; its alerts go to e-mail`, 'ok'); }}>Remove</Btn></>}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.note ? <Bar tone="err" multiline>{d.note}</Bar> : null}
            <Facts items={[{ k: 'Kind', v: d.kind }, { k: 'Customer', v: custName(d.customer) }, { k: 'Sends to', v: d.target }, { k: 'Details', v: d.detail }, { k: 'Last sent', v: d.last }, { k: 'If it fails', v: 'Retried for 30 minutes, then sent by e-mail instead and raised as a warning' }]} />
          </div>
        </Drawer>
      ) : null}
      {add.value ? <AddChannelDialog ctx={ctx} closing={add.closing} onClose={add.close} onAdd={c => { setList(x => [...x, c]); add.close(); }} /> : null}
    </>
  );
}

function AddChannelDialog({ ctx, closing, onClose, onAdd }: { ctx: Ctx; closing: boolean; onClose: () => void; onAdd: (c: Channel) => void }) {
  const [kind, setKind] = useState<Kind>('SMTP');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [extra, setExtra] = useState('');
  const [tested, setTested] = useState<'no' | 'run' | 'ok'>('no');
  const hint: Record<Kind, [string, string, string]> = {
    SMTP: ['Server and port', 'smtp.kaverilogistics.in:587', 'From address (must pass SPF and DKIM)'],
    Webhook: ['URL', 'https://hooks.kaverilogistics.in/aegis', 'Signing secret (HMAC SHA-256)'],
    Teams: ['Teams workflow URL', 'https://prod-12.centralindia.logic.azure.com/workflows/…', 'Channel name'],
    Slack: ['Slack workspace', 'kaveri-logistics.slack.com', 'Channel'],
    SMS: ['Provider', 'MSG91', 'DLT template ID (required in India)'],
    PagerDuty: ['Routing key (Events API v2)', '', 'Service name']
  };
  const ok = name.trim().length >= 3 && target.trim().length >= 3 && extra.trim().length >= 2 && tested === 'ok';
  return (
    <Dialog
      title="Add a notification channel"
      sub="A test message must arrive before the channel is saved."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="outline" icon={tested === 'run' ? 'loader-circle' : 'send'} spin={tested === 'run'} disabled={!target.trim() || tested === 'run'} why="Fill in where to send first." onClick={() => { setTested('run'); window.setTimeout(() => setTested('ok'), 1100); }}>{tested === 'ok' ? 'Test arrived' : 'Send a test'}</Btn>
          <Btn kind="primary" icon="check" disabled={!ok} why={tested !== 'ok' ? 'Send a test first.' : 'Fill in every field.'} onClick={() => { const c: Channel = { id: 'n' + Date.now(), kind, name: name.trim(), customer: ctx.actingAs?.customer || 'h360', target: target.trim(), detail: `${hint[kind][2]}: ${extra.trim()}`, state: 'ok', last: ctx.now() }; audit({ who: 'priya.raman', customer: c.customer, what: 'Added a notification channel', object: c.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${c.name} added`, 'ok'); onAdd(c); }}>Add channel</Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr)', gap: 16 }}>
        <Field id="ac-k" label="Kind"><SelectInput id="ac-k" value={kind} onChange={k => { setKind(k as Kind); setTested('no'); }} options={ROUTE_KINDS.map(k => ({ v: k, label: k === 'SMTP' ? 'E-mail (SMTP)' : k }))} /></Field>
        <Field id="ac-n" label="Name"><TextInput id="ac-n" value={name} onChange={setName} placeholder="Kaveri IT on-call" /></Field>
      </div>
      <Field id="ac-t" label={hint[kind][0]}><TextInput id="ac-t" value={target} onChange={v => { setTarget(v); setTested('no'); }} placeholder={hint[kind][1]} mono={kind !== 'SMS'} /></Field>
      <Field id="ac-x" label={hint[kind][2]}><TextInput id="ac-x" value={extra} onChange={setExtra} /></Field>
    </Dialog>
  );
}

function Routing({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const tenants = s.customers.filter(c => inScope(ctx, c.id));
  const [tenant, setTenant] = useState(tenants[0]?.id || 'h360');
  const [routes, setRoutes] = useState<Record<string, Kind[]>>(DEFAULT_ROUTES);
  const [digest, setDigest] = useState(true);
  const [quiet, setQuiet] = useState(true);
  const [dirty, setDirty] = useState(false);
  const cfg = ctx.can('configure', 'Changing notification routing');
  const c = tenants.find(x => x.id === tenant);
  const toggle = (sev: string, k: Kind, on: boolean) => { setRoutes(r => ({ ...r, [sev]: on ? [...r[sev], k] : r[sev].filter(x => x !== k) })); setDirty(true); };
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {tenants.length > 1 ? <SelectInput value={tenant} onChange={setTenant} options={tenants.map(t => ({ v: t.id, label: t.name }))} width={280} /> : <strong style={{ fontWeight: 600 }}>{c?.name}</strong>}
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{tenant === 'h360' ? 'Host360 defaults; customers inherit them until they change a row' : 'Inherits Host360 defaults; changes here apply to this customer only'}</span>
        <Spacer />
        <Btn kind="primary" icon="check" perm={cfg} disabled={!dirty} why="Nothing has changed." onClick={() => { audit({ who: 'priya.raman', customer: tenant, what: 'Changed notification routing', object: c?.name || tenant, when: ctx.now(), r: 'ok' }); ctx.toast(`Routing for ${c?.name} saved`, 'ok'); setDirty(false); }}>Save</Btn>
      </div>
      <Panel title="Which severity goes where">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Severity routing"
            cols={[{ label: 'Severity', w: '120px' }, ...ROUTE_KINDS.map(k => ({ label: ROUTE_LABEL[k], w: 'minmax(0,1fr)' }))]}
            rows={SEVS.map(sev => [
              <Status key="s" icon={sev === 'Critical' ? 'circle-x' : sev === 'Serious' ? 'circle-alert' : sev === 'Warning' ? 'triangle-alert' : 'info'} tone={sev === 'Critical' ? 'err' : sev === 'Serious' ? 'err' : sev === 'Warning' ? 'warn' : 'tx'} label={sev} />,
              ...ROUTE_KINDS.map(k => <CheckBox key={k} on={routes[sev].includes(k)} disabled={(sev === 'Critical' && k === 'SMTP') || (k === 'SMS' && sev !== 'Critical')} why={k === 'SMS' ? 'SMS is for Critical only (the approved DLT template).' : 'Critical alerts always go by e-mail.'} label={`${sev} by ${ROUTE_LABEL[k]}`} onChange={v => toggle(sev, k, v)} />)
            ])}
          />
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Escalation when nobody acknowledges">
          <ol style={{ listStyle: 'none', padding: '4px 16px 12px', margin: 0 }}>
            {[
              ['0 min', 'Alert raised', 'To the channels above, for the people who own the workload'],
              ['15 min', 'Page on-call', 'PagerDuty: Host360 on-call (and the customer’s rota for their database alerts)'],
              ['30 min', 'SMS the customer owner', `${c?.owner || 'The customer owner'}, Critical only`],
              ['60 min', 'Call the Head of cloud operations', 'priya.raman, by phone through PagerDuty']
            ].map(([t, a, b], i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '64px 20px minmax(0,1fr)', gap: 10, alignItems: 'start', padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--ln)' : 'none' }}>
                <span style={{ font: '600 12px/20px var(--f-ui)', color: 'var(--tx-2)', fontVariantNumeric: 'tabular-nums' }}>{t}</span>
                <Icon name={i ? 'arrow-down' : 'bell'} style={{ color: 'var(--tx-3)', marginTop: 2 }} />
                <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontWeight: 600 }}>{a}</span><span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{b}</span></span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Digest and quiet hours">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle on={digest} onChange={v => { setDigest(v); setDirty(true); }} label="Daily digest" perm={cfg}>Daily digest of Warning and Info, 08:30 local</Toggle>
            <Toggle on={quiet} onChange={v => { setQuiet(v); setDirty(true); }} label="Quiet hours" perm={cfg}>Quiet hours 22:00–07:00; Critical still sent</Toggle>
            <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Repeats of the same alert are grouped for 30 minutes; the digest lists how many were held.</p>
          </div>
        </Panel>
      </div>
      <Panel title="Branded templates" right={!ctx.actingAs ? <Btn kind="ghost" size="sm" iconAfter="arrow-right" onClick={() => { location.hash = '/admin/templates'; }}>Internal admin › Templates</Btn> : undefined}>
        <div style={{ padding: 16 }}>
          <NotificationPreview t={TEMPLATES.find(t => t.id === 't7')!} />
        </div>
      </Panel>
    </div>
  );
}

function People({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const people = s.users.filter(u => inScope(ctx, u.customer) && u.status === 'active');
  const edit = useClosable<string>();
  const [prefs, setPrefs] = useState<Record<string, { ch: string; quiet: string; digest: boolean }>>({ pr: { ch: 'E-mail, Teams, PagerDuty', quiet: 'None (on call)', digest: false }, ak: { ch: 'E-mail, Teams', quiet: '22:00–07:00', digest: true } });
  const pref = (id: string) => prefs[id] || { ch: 'E-mail', quiet: '22:00–07:00', digest: true };
  const u = edit.value ? people.find(p => p.id === edit.value) : null;
  return (
    <>
      <TableArea>
        <AegisTable
          label="Preferences"
          cols={[{ k: 'n', label: 'Person', w: 'minmax(180px,1.4fr)' }, ...(showCustomerCol(ctx) ? [{ k: 'c', label: 'Customer', w: 'minmax(150px,1fr)', dim: true }] : []), { k: 'ch', label: 'Gets alerts by', w: 'minmax(170px,1.2fr)' }, { k: 'q', label: 'Quiet hours', w: '140px' }, { k: 'd', label: 'Digest', w: '90px' }]}
          rows={people.map(p => ({ id: p.id, n: { v: p.name, strong: true, tip: p.email }, c: custName(p.customer), ch: pref(p.id).ch, q: pref(p.id).quiet, d: pref(p.id).digest ? 'Daily' : { v: 'Off', muted: true } }))}
          onRow={(id: string) => edit.open(id)}
          state={ctx.ui}
          unit={['person', 'people']}
          emptyText="No active people."
          footR="Critical alerts ignore quiet hours"
        />
      </TableArea>
      {u ? (
        <PrefDialog
          name={u.name}
          p={pref(u.id)}
          closing={edit.closing}
          onClose={edit.close}
          onSave={p => { setPrefs(x => ({ ...x, [u.id]: p })); audit({ who: 'priya.raman', customer: u.customer, what: 'Changed notification preferences', object: u.name, when: ctx.now(), r: 'ok' }); ctx.toast(`Preferences for ${u.name} saved`, 'ok'); edit.close(); }}
        />
      ) : null}
    </>
  );
}

function PrefDialog({ name, p, closing, onClose, onSave }: { name: string; p: { ch: string; quiet: string; digest: boolean }; closing: boolean; onClose: () => void; onSave: (p: { ch: string; quiet: string; digest: boolean }) => void }) {
  const [ch, setCh] = useState<string[]>(p.ch.split(', '));
  const [quiet, setQuiet] = useState(p.quiet);
  const [digest, setDigest] = useState(p.digest);
  return (
    <Dialog
      title={`Notifications for ${name}`}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!ch.length} why="Keep at least one channel." onClick={() => onSave({ ch: ch.join(', '), quiet, digest })}>Save</Btn></>}
    >
      <Field label="Gets alerts by">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {['E-mail', 'Teams', 'Slack', 'SMS', 'PagerDuty'].map(k => <CheckBox key={k} on={ch.includes(k)} disabled={k === 'E-mail'} why="E-mail is always on: it is the fallback." onChange={v => setCh(x => (v ? [...x, k] : x.filter(y => y !== k)))}>{k}</CheckBox>)}
        </div>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
        <Field id="pf-q" label="Quiet hours"><SelectInput id="pf-q" value={quiet} onChange={setQuiet} options={['22:00–07:00', '20:00–08:00', 'None (on call)']} /></Field>
        <CheckBox on={digest} onChange={setDigest}>Daily digest at 08:30</CheckBox>
      </div>
    </Dialog>
  );
}
