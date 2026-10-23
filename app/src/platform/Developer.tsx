import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { HOVER } from '../ui/layout';
import { T } from '../data/platform';
import { Btn, CheckBox, Field, Seg, SelectInput, TextInput } from '../ui/controls';
import { Bar, Facts, MiniTable, Spacer, Status, TableArea, Toolbar } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit } from './store';
import { EVENT_TYPES, EventCatalogue, GatewayView, ToolsView } from './Gateway';

const BASE = 'https://aegis.host360.ai/api/v2';
interface Param { name: string; in: 'path' | 'query' | 'body'; type: string; required?: boolean; example: string }
interface Endpoint { id: string; group: string; method: 'GET' | 'POST' | 'DELETE'; path: string; summary: string; scope: string; params: Param[]; response: string }
const ENDPOINTS: Endpoint[] = [
  { id: 'e1', group: 'Workloads', method: 'GET', path: '/workloads', summary: 'List workloads with their backup, DR and migration state', scope: 'workloads:read', params: [{ name: 'customer', in: 'query', type: 'string', example: 'mer' }, { name: 'tier', in: 'query', type: 'string', example: 'Mission Critical' }, { name: 'limit', in: 'query', type: 'integer', example: '50' }], response: '{\n  "items": [\n    { "id": "sql01", "name": "SQL01", "tier": "Mission Critical",\n      "backup": { "state": "protected", "last": "2026-10-21T15:00:00+05:30" },\n      "dr": { "state": "behind", "newestPointAge": "PT58M" } }\n  ],\n  "next": null\n}' },
  { id: 'e2', group: 'Workloads', method: 'GET', path: '/workloads/{id}/recovery-points', summary: 'Every recovery point of a workload: backups, replicas and copies', scope: 'workloads:read', params: [{ name: 'id', in: 'path', type: 'string', required: true, example: 'sql01' }], response: '{\n  "items": [\n    { "taken": "2026-10-21T15:00:00+05:30", "source": "backup", "repository": "obj-check", "immutableUntil": "2026-11-04" },\n    { "taken": "2026-10-21T15:07:00+05:30", "source": "replica", "site": "Chennai-proxmox-prod" }\n  ]\n}' },
  { id: 'e3', group: 'Protection', method: 'POST', path: '/jobs/backup', summary: 'Start a backup now', scope: 'jobs:write', params: [{ name: 'workload', in: 'body', type: 'string', required: true, example: 'erp-db-01' }, { name: 'consistency', in: 'body', type: 'string', example: 'application' }], response: '{\n  "job": "JOB-88231",\n  "state": "queued",\n  "links": { "self": "/api/v2/jobs/JOB-88231" }\n}' },
  { id: 'e4', group: 'Protection', method: 'POST', path: '/restores', summary: 'Restore a workload, disks or files (sensitive workloads create an approval)', scope: 'restores:write', params: [{ name: 'workload', in: 'body', type: 'string', required: true, example: 'web-frontend-01' }, { name: 'point', in: 'body', type: 'string', required: true, example: '2026-10-21T02:00:00+05:30' }, { name: 'target', in: 'body', type: 'string', example: 'alternate' }], response: '{\n  "job": "JOB-88232",\n  "state": "queued"\n}' },
  { id: 'e5', group: 'Resilience', method: 'POST', path: '/recovery-plans/{id}/test', summary: 'Test failover on the isolated network', scope: 'recovery:operate', params: [{ name: 'id', in: 'path', type: 'string', required: true, example: 'core' }], response: '{\n  "run": "RUN-0419",\n  "kind": "test",\n  "network": "dr-test-isolated"\n}' },
  { id: 'e5a', group: 'Resilience', method: 'POST', path: '/recovery-plans/{id}/failover', summary: 'Planned or unplanned failover; needs an approval token from a second person', scope: 'recovery:failover', params: [{ name: 'id', in: 'path', type: 'string', required: true, example: 'cbs' }, { name: 'kind', in: 'body', type: 'string', required: true, example: 'planned' }, { name: 'approval', in: 'body', type: 'string', required: true, example: 'APR-1052' }, { name: 'stages', in: 'body', type: 'string[]', example: '["k1","k2"]' }, { name: 'reason', in: 'body', type: 'string', example: 'Hyderabad power maintenance' }], response: '{\n  "run": "RUN-0420",\n  "kind": "planned",\n  "state": "running",\n  "rto_target": "PT1H",\n  "links": { "self": "/api/v2/recovery-plans/cbs/runs/RUN-0420" }\n}' },
  { id: 'e5b', group: 'Resilience', method: 'POST', path: '/recovery-plans/{id}/failback', summary: 'Return to the primary site, or to another platform, with reverse sync and reconciliation', scope: 'recovery:failover', params: [{ name: 'id', in: 'path', type: 'string', required: true, example: 'core' }, { name: 'target', in: 'body', type: 'string', example: 'Chennai-proxmox-prod' }, { name: 'approval', in: 'body', type: 'string', required: true, example: 'APR-1053' }], response: '{\n  "run": "RUN-0421",\n  "kind": "failback",\n  "reverse_sync": "started",\n  "reconciliation": "/api/v2/recovery-plans/core/runs/RUN-0421/reconciliation"\n}' },
  { id: 'e5c', group: 'Resilience', method: 'GET', path: '/recovery-plans/{id}/runs/{run}', summary: 'Live state of a run: current step, log, time used against the RTO', scope: 'recovery:read', params: [{ name: 'id', in: 'path', type: 'string', required: true, example: 'cbs' }, { name: 'run', in: 'path', type: 'string', required: true, example: 'RUN-0420' }], response: '{\n  "state": "waiting",\n  "waiting_for": { "kind": "approval", "who": "Head of IT operations" },\n  "step": 4,\n  "steps": 9,\n  "elapsed": "PT22M",\n  "rto_target": "PT1H"\n}' },
  { id: 'e5d', group: 'Resilience', method: 'POST', path: '/drills', summary: 'Schedule a drill (test failover) with evidence for a recovery plan', scope: 'recovery:operate', params: [{ name: 'plan', in: 'body', type: 'string', required: true, example: 'cbs' }, { name: 'at', in: 'body', type: 'string', required: true, example: '2026-10-28T22:00:00+05:30' }, { name: 'repeat', in: 'body', type: 'string', example: 'monthly' }, { name: 'evidence', in: 'body', type: 'boolean', example: 'true' }], response: '{\n  "drill": "DRL-0611",\n  "plan": "cbs",\n  "next": "2026-10-28T22:00:00+05:30",\n  "repeat": "monthly"\n}' },
  { id: 'e5e', group: 'Resilience', method: 'GET', path: '/replication/servers', summary: 'Replicated servers with mode, newest point age, RPO state and replica checks', scope: 'recovery:read', params: [{ name: 'customer', in: 'query', type: 'string', example: 'mer' }, { name: 'state', in: 'query', type: 'string', example: 'behind' }], response: '{\n  "items": [\n    { "server": "cbs-db-01", "mode": "continuous", "newest_point_age": "PT9S", "rpo": "PT15M", "state": "within", "checksum": "matched", "test_boot": "2026-10-19T04:00:00+05:30" }\n  ]\n}' },
  { id: 'e5f', group: 'Resilience', method: 'POST', path: '/replication/servers/{id}/resync', summary: 'Resync a replica from changed blocks, or in full', scope: 'recovery:operate', params: [{ name: 'id', in: 'path', type: 'string', required: true, example: 'sql01' }, { name: 'full', in: 'body', type: 'boolean', example: 'false' }], response: '{\n  "job": "JOB-88342",\n  "state": "queued",\n  "reason": "requested by API"\n}' },
  { id: 'e6', group: 'Mobility', method: 'GET', path: '/migrations/waves', summary: 'Waves with their windows, servers and readiness', scope: 'migrations:read', params: [{ name: 'customer', in: 'query', type: 'string', example: 'mer' }], response: '{\n  "items": [\n    { "name": "Wave 2 · Core banking reporting", "window": "2026-10-25T22:00:00+05:30", "servers": 2, "ready": 0 }\n  ]\n}' },
  { id: 'e7', group: 'Billing', method: 'GET', path: '/usage', summary: 'Metered usage for a period', scope: 'billing:read', params: [{ name: 'period', in: 'query', type: 'string', required: true, example: '2026-10' }, { name: 'customer', in: 'query', type: 'string', example: 'kav' }], response: '{\n  "period": "2026-10",\n  "lines": [ { "metric": "Virtual machines", "quantity": 22, "unit": "VM-months", "amount": 14300, "currency": "INR" } ]\n}' },
  { id: 'e8', group: 'Events', method: 'GET', path: '/events', summary: 'Events since a cursor, for polling instead of webhooks', scope: 'events:read', params: [{ name: 'after', in: 'query', type: 'string', example: 'evt_01JB2K' }], response: '{\n  "items": [ { "id": "evt_01JB2M", "type": "backup.failed", "object": "file-srv-03", "at": "2026-10-21T02:48:10+05:30" } ]\n}' }
];
const METHOD_TONE: Record<Endpoint['method'], string> = { GET: 'ok', POST: 'run', DELETE: 'err' };
const EVENTS = EVENT_TYPES.filter(e => !e.deprecated).map(e => e.name);
interface Sub { id: string; name: string; events: string[]; url: string; state: 'ok' | 'err'; last: string; log: [string, string, string][] }
const SUBS: Sub[] = [
  { id: 's1', name: 'ServiceNow incidents', events: ['backup.failed', 'failover.started', 'alert.raised'], url: 'https://host360.service-now.com/api/x_aegis/events', state: 'ok', last: T('21 Oct', '14:53'), log: [[T('21 Oct', '14:53'), 'alert.raised · region-2-os', '200 in 312 ms'], [T('21 Oct', '02:48'), 'backup.failed · file-srv-03', '200 in 280 ms']] },
  { id: 's2', name: 'Meridian SOC (Splunk HEC)', events: ['failover.started', 'failover.finished', 'approval.requested'], url: 'https://splunk-hec.meridianbank.in:8088/services/collector', state: 'err', last: T('21 Oct', '13:05'), log: [[T('21 Oct', '13:05'), 'approval.requested · APR-1040', '503, retried 5 times; gave up at 13:35'], [T('20 Oct', '22:14'), 'failover.finished · test', '200 in 190 ms']] },
  { id: 's4', name: 'Host360 NOC (Teams)', events: ['replication.lagging', 'storage.threshold_crossed', 'migration.finished'], url: 'https://prod-12.centralindia.logic.azure.com/workflows/aegis-noc', state: 'ok', last: T('21 Oct', '15:53'), log: [[T('21 Oct', '15:53'), 'replication.lagging · erp-db-01 (past its 15 min target)', '202 in 410 ms'], [T('21 Oct', '09:12'), 'storage.threshold_crossed · obj-check 85 %', '202 in 388 ms'], [T('18 Oct', '23:52'), 'migration.finished · Wave 0 · Pilot', '202 in 402 ms']] },
  { id: 's3', name: 'Kaveri ops bot', events: ['restore.finished', 'licence.expiring'], url: 'https://bots.kaverilogistics.in/aegis', state: 'ok', last: T('09 Oct', '15:20'), log: [[T('09 Oct', '15:20'), 'restore.finished · kav-wms-db', '204 in 95 ms']] }
];
const TEMPLATES = [
  { name: 'Health check, backup, then tell ServiceNow', steps: 'API check → Backup → Webhook', uses: 'ERP nightly at Host360' },
  { name: 'Database first, then its VM', steps: 'Backup DB → Condition → Backup VM → Notify', uses: 'Core banking reports at Meridian' },
  { name: 'Two-level approval before deleting points', steps: 'Trigger → Approval → Approval → Delete → Notify', uses: 'Every customer (mandatory)' },
  { name: 'Snapshot before patching', steps: 'Webhook from Ansible → Backup → Webhook back', uses: 'Patch windows' },
  { name: 'Ticket on a failed backup', steps: 'Event backup.failed → Condition (Tier 0 or 1) → ServiceNow incident', uses: 'Managed accounts' }
];

const curl = (e: Endpoint, vals: Record<string, string>) => {
  const path = e.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vals[k] || `{${k}}`));
  const q = e.params.filter(p => p.in === 'query' && vals[p.name]).map(p => `${p.name}=${encodeURIComponent(vals[p.name])}`).join('&');
  const body = e.params.filter(p => p.in === 'body' && vals[p.name]);
  return [`curl -X ${e.method} '${BASE}${path}${q ? '?' + q : ''}'`, `  -H 'Authorization: Bearer $AEGIS_TOKEN'`, ...(body.length ? [`  -H 'Content-Type: application/json'`, `  -d '${JSON.stringify(Object.fromEntries(body.map(p => [p.name, vals[p.name]])))}'`] : [])].join(' \\\n');
};

/** Automation › API and events: the API explorer with copy as cURL, webhook subscriptions and workflow templates. */
export function ApiTab({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<'explorer' | 'events' | 'catalogue' | 'gateway' | 'tools' | 'templates'>('explorer');
  const [startAdd, setStartAdd] = useState(false);
  return (
    <>
      <Toolbar>
        <Seg label="Show" value={view} onChange={setView} options={[{ v: 'explorer', label: 'Explorer' }, { v: 'events', label: 'Subscriptions' }, { v: 'catalogue', label: 'Event catalogue' }, { v: 'gateway', label: 'Gateway and limits' }, { v: 'tools', label: 'CLI and SDKs' }, { v: 'templates', label: 'Workflow templates' }]} />
        <Spacer />
        <Btn kind="ghost" icon="download" onClick={() => ctx.toast('openapi.yaml (OpenAPI 3.1, 64 endpoints) downloaded', 'ok')}>OpenAPI 3.1</Btn>
        <Btn kind="ghost" iconAfter="arrow-right" onClick={() => ctx.go('settings/service')}>API keys</Btn>
      </Toolbar>
      {view === 'explorer' ? <Explorer ctx={ctx} /> : null}
      {view === 'events' ? <Subscriptions ctx={ctx} startAdd={startAdd} /> : null}
      {view === 'catalogue' ? <EventCatalogue ctx={ctx} onSubscribe={() => { setStartAdd(true); setView('events'); }} /> : null}
      {view === 'gateway' ? <GatewayView ctx={ctx} /> : null}
      {view === 'tools' ? <ToolsView ctx={ctx} /> : null}
      {view === 'templates' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12, alignContent: 'start' }}>
          {TEMPLATES.map(t => (
            <div key={t.name} style={{ border: '1px solid var(--ln)', background: 'var(--panel)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><Icon name="workflow" style={{ color: 'var(--tx-2)' }} />{t.name}</span>
              <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{t.steps}</span>
              <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Used for: {t.uses}</span>
              <Btn kind="outline" size="sm" icon="plus" style={{ alignSelf: 'flex-start' }} onClick={() => ctx.go('automation/workflows')}>Use template</Btn>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Explorer({ ctx }: { ctx: Ctx }) {
  const [sel, setSel] = useState(ENDPOINTS[0].id);
  const e = ENDPOINTS.find(x => x.id === sel)!;
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});
  const v = vals[e.id] || Object.fromEntries(e.params.map(p => [p.name, p.example]));
  const [token, setToken] = useState('svc-reporting (workloads:read, billing:read)');
  const [res, setRes] = useState<{ id: string; status: string; ms: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const scopes = token.match(/\((.*)\)/)?.[1].split(', ') || [];
  const allowed = scopes.includes(e.scope);
  const missing = e.params.filter(p => p.required && !v[p.name]);
  const send = () => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setRes({ id: e.id, status: allowed ? (e.method === 'POST' ? '202 Accepted' : '200 OK') : '403 Forbidden', ms: 120 + Math.round(Math.random() * 200) });
      audit({ who: 'priya.raman', customer: 'h360', what: 'Called the API from the explorer', object: `${e.method} ${e.path}`, when: ctx.now(), r: allowed ? 'ok' : 'refused' });
    }, 600);
  };
  const copy = () => navigator.clipboard?.writeText(curl(e, v)).then(() => ctx.toast('cURL copied', 'ok'), () => ctx.toast('Copy is blocked here; select the command and copy it yourself', 'warn')) ?? ctx.toast('Copy is blocked here; select the command and copy it yourself', 'warn');
  const groups = [...new Set(ENDPOINTS.map(x => x.group))];
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 16, padding: '0 24px 24px' }}>
      <nav aria-label="Endpoints" style={{ overflow: 'auto', border: '1px solid var(--ln)', background: 'var(--panel)' }}>
        {groups.map(g => (
          <div key={g}>
            <div style={{ padding: '10px 12px 4px', font: '600 12px/16px var(--f-body)', color: 'var(--tx-3)' }}>{g}</div>
            {ENDPOINTS.filter(x => x.group === g).map(x => (
              <button key={x.id} type="button" aria-current={sel === x.id ? 'true' : undefined} onClick={() => { setSel(x.id); setRes(null); }} className={HOVER} style={{ width: '100%', display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 8, alignItems: 'center', padding: '7px 12px', textAlign: 'left', background: sel === x.id ? 'var(--acc-soft)' : undefined, borderLeft: `2px solid ${sel === x.id ? 'var(--acc)' : 'transparent'}` }}>
                <span style={{ font: '700 11px var(--f-ui)', color: `var(--${METHOD_TONE[x.method]})` }}>{x.method}</span>
                <span style={{ font: '12px var(--f-ui)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={x.path}>{x.path}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ font: '700 12px var(--f-ui)', padding: '2px 6px', border: `1px solid var(--${METHOD_TONE[e.method]})`, color: `var(--${METHOD_TONE[e.method]})` }}>{e.method}</span>
            <code style={{ font: '14px var(--f-ui)' }}>{BASE}{e.path}</code>
          </div>
          <p style={{ marginTop: 6, color: 'var(--tx-2)' }}>{e.summary}. Needs the scope <code>{e.scope}</code>.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          <Field id="ax-t" label="Call as"><SelectInput id="ax-t" value={token} onChange={setToken} options={['svc-reporting (workloads:read, billing:read)', 'svc-ansible (jobs:write, workloads:read)', 'svc-servicenow (events:read, recovery:operate, migrations:read)', 'Your session (all scopes, step-up for writes)'].map(x => x.startsWith('Your') ? x.replace('(all scopes, step-up for writes)', '(workloads:read, jobs:write, restores:write, recovery:operate, migrations:read, billing:read, events:read)') : x)} /></Field>
          {e.params.map(p => (
            <Field key={p.name} id={`ax-${p.name}`} label={`${p.name}${p.required ? ' *' : ''} · ${p.in}`} hint={p.type}>
              <TextInput id={`ax-${p.name}`} value={v[p.name] || ''} onChange={x => setVals(s => ({ ...s, [e.id]: { ...v, [p.name]: x } }))} mono />
            </Field>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="primary" icon={busy ? 'loader-circle' : 'send'} spin={busy} disabled={busy || missing.length > 0} why={missing.length ? `Fill in ${missing.map(p => p.name).join(', ')}.` : 'Sending.'} onClick={send}>Send request</Btn>
          <Btn kind="outline" icon="copy" onClick={copy}>Copy as cURL</Btn>
          {e.method !== 'GET' ? <span style={{ alignSelf: 'center', font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Writes from the explorer run for real and are audited.</span> : null}
        </div>
        <pre style={{ margin: 0, padding: 12, background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/18px var(--f-ui)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{curl(e, v)}</pre>
        {res && res.id === e.id ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Status icon={res.status.startsWith('4') ? 'circle-x' : 'circle-check'} tone={res.status.startsWith('4') ? 'err' : 'ok'} label={`${res.status} · ${res.ms} ms`} />
            <pre style={{ margin: 0, padding: 12, background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/18px var(--f-ui)', whiteSpace: 'pre-wrap' }}>{res.status.startsWith('4') ? `{\n  "error": "insufficient_scope",\n  "detail": "This token does not have ${e.scope}. Add it to the service account in Settings › Service accounts."\n}` : e.response}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Subscriptions({ ctx, startAdd }: { ctx: Ctx; startAdd?: boolean }) {
  const [list, setList] = useState<Sub[]>(SUBS);
  const drawer = useClosable<string>();
  const add = useClosable<boolean>();
  useEffect(() => {
    if (startAdd) add.open(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = ctx.can('configure', 'Changing event subscriptions');
  const d = drawer.value ? list.find(x => x.id === drawer.value) : null;
  return (
    <>
      {list.some(x => x.state === 'err') ? <div style={{ padding: '0 24px 12px' }}><Bar tone="warn">{list.filter(x => x.state === 'err').map(x => `${x.name}: last delivery failed after 5 retries`).join(' · ')}. Missed events can be read from GET /events.</Bar></div> : null}
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Each delivery is signed with HMAC SHA-256 (X-Aegis-Signature) and retried 5 times over 30 minutes.</span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={cfg} onClick={() => add.open(true)}>Add a subscription</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Event subscriptions"
          cols={[{ k: 'n', label: 'Subscription', w: 'minmax(200px,1.3fr)' }, { k: 'e', label: 'Events', w: 'minmax(220px,1.6fr)', dim: true }, { k: 'u', label: 'Sends to', w: 'minmax(220px,1.6fr)', dim: true }, { k: 'l', label: 'Last delivery', w: '140px' }, { k: 's', label: 'State', w: '130px' }]}
          rows={list.map(x => ({ id: x.id, n: { v: x.name, strong: true }, e: x.events.join(', '), u: { v: x.url, tip: x.url }, l: x.last.replace(' 2026', '').replace(' IST', ''), s: x.state === 'ok' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Delivering' } : { t: 'status', i: 'circle-x', c: 'err', l: 'Failing' } }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['subscription', 'subscriptions']}
          emptyText="No subscriptions. Add one to push events to another system."
        />
      </TableArea>
      {d ? (
        <Drawer label="Subscription" kicker="Event subscription" title={d.name} status={<Status icon={d.state === 'ok' ? 'circle-check' : 'circle-x'} tone={d.state === 'ok' ? 'ok' : 'err'} label={d.state === 'ok' ? 'Delivering' : 'Failing'} />} actions={<><Btn kind="outline" icon="send" onClick={() => ctx.toast(`Test event sent to ${d.name}${d.state === 'err' ? ': 503 Service Unavailable' : ': 200 OK'}`, d.state === 'err' ? 'err' : 'ok')}>Send a test event</Btn><Btn kind="outline" icon="refresh-cw" disabled={d.state === 'ok'} why="Nothing failed." onClick={() => { setList(x => x.map(y => (y.id === d.id ? { ...y, state: 'ok' } : y))); ctx.toast('1 failed delivery sent again: 200 OK', 'ok'); }}>Redeliver failed</Btn></>} closing={drawer.closing} onClose={drawer.close}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Facts items={[{ k: 'Events', v: d.events.join(', ') }, { k: 'Sends to', v: d.url }, { k: 'Signing', v: 'HMAC SHA-256 with the subscription secret; rotate it from here without downtime' }]} />
            <MiniTable label="Deliveries" cols={[{ label: 'When', w: '130px' }, { label: 'Event' }, { label: 'Result', w: '220px' }]} rows={d.log.map(([w, e, r]) => [w.replace(' 2026', '').replace(' IST', ''), e, <Status key="r" icon={r.startsWith('2') ? 'circle-check' : 'circle-x'} tone={r.startsWith('2') ? 'ok' : 'err'} label={r} />])} />
          </div>
        </Drawer>
      ) : null}
      {add.value ? <AddSub ctx={ctx} closing={add.closing} onClose={add.close} onAdd={x => { setList(l => [...l, x]); add.close(); }} /> : null}
    </>
  );
}

function AddSub({ ctx, closing, onClose, onAdd }: { ctx: Ctx; closing: boolean; onClose: () => void; onAdd: (s: Sub) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [ev, setEv] = useState<string[]>(['backup.failed']);
  const ok = name.trim().length >= 3 && /^https:\/\/\S+\.\S+/.test(url) && ev.length > 0;
  const secret = 'whsec_7Kq2…f91D';
  return (
    <Dialog
      title="Add an event subscription"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!ok} why={!/^https:\/\//.test(url) ? 'Use an https:// address.' : 'Name it and pick at least one event.'} onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Added an event subscription', object: name.trim(), when: ctx.now(), r: 'ok' }); ctx.toast(`${name.trim()} added; copy the signing secret now, it is shown once`, 'ok'); onAdd({ id: 's' + Date.now(), name: name.trim(), events: ev, url: url.trim(), state: 'ok', last: 'Never', log: [] }); }}>Add</Btn></>}
    >
      <Field id="as-n" label="Name"><TextInput id="as-n" value={name} onChange={setName} placeholder="Jira change records" autoFocus /></Field>
      <Field id="as-u" label="Sends to (https only)"><TextInput id="as-u" value={url} onChange={setUrl} mono placeholder="https://hooks.example.com/aegis" /></Field>
      <Field label="Events">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>{EVENTS.map(x => <CheckBox key={x} on={ev.includes(x)} onChange={c => setEv(s => (c ? [...s, x] : s.filter(y => y !== x)))}><code style={{ font: '12px var(--f-ui)' }}>{x}</code></CheckBox>)}</div>
      </Field>
      <Facts items={[{ k: 'Signing secret', v: <code>{secret}</code> }, { k: 'Header', v: 'X-Aegis-Signature: t=…, v1=HMAC-SHA256(secret, t + "." + body)' }]} />
    </Dialog>
  );
}
