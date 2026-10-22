import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { Btn, Field, FilterInput, SelectInput, TextInput } from '../ui/controls';
import { Bar, Facts, MiniTable, Panel, Spacer, Status, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import { API_BASE } from '../ui/CopyCurl';
import type { Ctx } from '../ui/ctx';
import { audit } from './store';

const copyText = (ctx: Ctx, text: string, what: string) => {
  const p = navigator.clipboard?.writeText(text);
  if (!p) return ctx.toast('Copy is blocked here; select the text and copy it yourself', 'warn');
  p.then(() => ctx.toast(`${what} copied`, 'ok'), () => ctx.toast('Copy is blocked here; select the text and copy it yourself', 'warn'));
};

/* ---------------------------------------------------------------- Gateway contract */

interface Limit { cls: string; who: string; perMin: number; burst: number }
const LIMITS: Limit[] = [
  { cls: 'Personal token', who: 'A person’s API token', perMin: 600, burst: 100 },
  { cls: 'Service account', who: 'svc-terraform, svc-servicenow, svc-splunk-siem and 4 more', perMin: 3000, burst: 500 },
  { cls: 'Partner provisioning', who: 'Host360 Partner Portal (CloudNest and resellers)', perMin: 1200, burst: 200 },
  { cls: 'Host360 Cloud portal', who: 'svc-h360-cloud (VM create and VDC events)', perMin: 6000, burst: 1000 }
];
const TOP: [string, string, number][] = [['svc-terraform', 'Service account', 74], ['svc-h360-cloud', 'Host360 Cloud portal', 41], ['Host360 Partner Portal', 'Partner provisioning', 22], ['svc-splunk-siem', 'Service account', 9]];

/** Automation › API and events › Gateway: the one contract every product's endpoints share. */
export function GatewayView({ ctx }: { ctx: Ctx }) {
  const [limits, setLimits] = useState(LIMITS);
  const edit = useClosable<Limit>();
  const cfg = ctx.can('admin', 'Changing API limits');
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Bar tone="warn" multiline actions={<Btn kind="ghost" size="sm" icon="send" perm={cfg} onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Sent the v1 sunset notice', object: '3 tokens still calling v1', when: ctx.now(), r: 'ok' }); ctx.toast('Owners of 3 tokens told: v1 stops on 31 Mar 2027', 'ok'); }}>Tell their owners</Btn>}>
        API v1 is deprecated and stops answering on 31 Mar 2027. 1,284 calls in the last 7 days came from 3 tokens: kav-backup-script, mer-ops-ansible and nil-reporting.
      </Bar>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Contract" right={<Btn kind="ghost" size="sm" icon="download" onClick={() => ctx.toast('openapi.yaml (OpenAPI 3.1, 64 endpoints, every product) downloaded', 'ok')}>OpenAPI v2</Btn>}>
          <div style={{ padding: '4px 16px 12px' }}>
            <Facts
              labelW={150}
              items={[
                { k: 'Base address', v: <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><code>{API_BASE}</code><Btn kind="ghost" size="sm" icon="copy" onClick={() => copyText(ctx, API_BASE, 'Base address')}>Copy</Btn></span> },
                { k: 'Versions', v: 'v2 current (since 10 Sep 2026) · v1 deprecated, sunset 31 Mar 2027' },
                { k: 'Authentication', v: 'One model for every product: OAuth 2.0 client credentials for service accounts, bearer tokens for people' },
                { k: 'Covers', v: '/organizations /tenants /users /workloads /applications /policies /jobs /alerts /backup /dr /migration /licenses /billing /reports' },
                { k: 'Long-running calls', v: '202 Accepted with Location: /jobs/{id}; poll the job or subscribe to its event' },
                { k: 'Retries', v: 'Idempotency-Key header on every POST, kept 24 h; 1,906 replays answered from the cache today' },
                { k: 'Pagination', v: 'Cursor based, up to 500 items a page' },
                { k: 'Regions', v: 'ap-south-1 Mumbai (serving) · ap-south-2 Hyderabad (standby, same address)' }
              ]}
            />
          </div>
        </Panel>
        <Panel title="Error model">
          <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ color: 'var(--tx-2)' }}>Every product answers errors in the same shape. The code links to its knowledge base article, and the correlation ID finds the request in the audit log and in a support bundle.</p>
            <pre style={{ margin: 0, padding: 12, background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/18px var(--f-ui)', whiteSpace: 'pre-wrap', userSelect: 'text' }}>{`HTTP/1.1 409 Conflict
{
  "error": {
    "code": "AEG-DR-4091",
    "message": "A run of this recovery plan is in progress.",
    "correlationId": "c-7f3a91e2-0b6d",
    "docs": "https://docs.host360.ai/errors/AEG-DR-4091"
  }
}`}</pre>
          </div>
        </Panel>
      </div>
      <Panel title="Rate limits" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Per token, per minute; X-RateLimit-Remaining and Retry-After on every answer</span>}>
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Rate limits"
            cols={[{ label: 'Caller', w: '190px' }, { label: 'Who', w: 'minmax(0,1fr)' }, { label: 'Per minute', w: '110px', r: true }, { label: 'Burst', w: '90px', r: true }, { label: '', w: '80px', r: true }]}
            rows={limits.map(l => [<strong key="c" style={{ fontWeight: 600 }}>{l.cls}</strong>, <span key="w" style={{ color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={l.who} data-tip-overflow="">{l.who}</span>, l.perMin.toLocaleString('en-IN'), l.burst.toLocaleString('en-IN'), <Btn key="e" kind="ghost" size="sm" perm={cfg} onClick={() => edit.open(l)}>Edit…</Btn>])}
          />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '600 13px/18px var(--f-ui)' }}>Busiest callers in the last hour</span>
            {TOP.map(([n, c, pct]) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr) 60px', gap: 12, alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-tip={c}>{n}</span>
                <div style={{ height: 6, background: 'var(--panel-2)' }}><div style={{ height: '100%', width: `${pct}%`, background: pct > 70 ? 'var(--warn)' : 'var(--acc)' }} /></div>
                <span style={{ textAlign: 'right', font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>{pct} %</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel title="Edge protection">
        <div style={{ padding: '4px 16px 12px' }}>
          <Facts
            labelW={150}
            items={[
              { k: 'In front of the API', v: 'AWS WAF and CloudFront for the hosted platform; FortiWeb for on-premises installs' },
              { k: 'Rules', v: 'AWS managed core rule set, SQL injection, known bad inputs, rate-based rule at 10,000 a minute per address' },
              { k: 'Blocked, last 24 h', v: '312 requests: 280 by the rate rule, 32 by the SQL injection rule', icon: 'circle-check', tone: 'ok' },
              { k: 'Address allow-lists', v: 'Per tenant and per service account, set in Settings › Roles and Service accounts' }
            ]}
          />
        </div>
      </Panel>
      {edit.value ? (
        <LimitDialog
          l={edit.value}
          closing={edit.closing}
          onClose={edit.close}
          onSave={(perMin, burst) => {
            const l = edit.value!;
            setLimits(x => x.map(y => (y.cls === l.cls ? { ...y, perMin, burst } : y)));
            audit({ who: 'priya.raman', customer: 'h360', what: 'Changed an API rate limit', object: l.cls, when: ctx.now(), r: 'ok', after: [['Per minute', String(perMin)], ['Burst', String(burst)]] });
            ctx.toast(`${l.cls}: ${perMin.toLocaleString('en-IN')} a minute, burst ${burst}`, 'ok');
            edit.close();
          }}
        />
      ) : null}
    </div>
  );
}

function LimitDialog({ l, closing, onClose, onSave }: { l: Limit; closing: boolean; onClose: () => void; onSave: (perMin: number, burst: number) => void }) {
  const [per, setPer] = useState(String(l.perMin));
  const [burst, setBurst] = useState(String(l.burst));
  const err = !(+per >= 60 && +per <= 20000) ? 'Between 60 and 20,000 a minute.' : !(+burst >= 0 && +burst <= +per) ? 'Burst cannot be more than the limit.' : null;
  return (
    <Dialog title={`Rate limit: ${l.cls}`} sub="Applies to every token of this kind, in every product. Callers over the limit get 429 with Retry-After." closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!!err} why={err || undefined} onClick={() => onSave(+per, +burst)}>Save</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="rl-p" label="Requests a minute" err={err && err.startsWith('Between') ? err : null}><TextInput id="rl-p" value={per} onChange={v => setPer(v.replace(/\D/g, ''))} inputMode="numeric" /></Field>
        <Field id="rl-b" label="Burst" err={err && err.startsWith('Burst') ? err : null}><TextInput id="rl-b" value={burst} onChange={v => setBurst(v.replace(/\D/g, ''))} inputMode="numeric" /></Field>
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Event catalogue */

export interface EventType { name: string; v: number; from: string; when: string; fields: string[]; deprecated?: string }
export const EVENT_TYPES: EventType[] = [
  { name: 'backup.completed', v: 2, from: 'Protection', when: 'A backup job finished, with or without warnings', fields: ['workloadId', 'policyId', 'recoveryPointId', 'bytesRead', 'durationSec', 'warnings[]'] },
  { name: 'backup.failed', v: 2, from: 'Protection', when: 'A backup job failed after its retries', fields: ['workloadId', 'policyId', 'errorCode', 'attempts'] },
  { name: 'restore.finished', v: 1, from: 'Protection', when: 'A restore ended, successfully or not', fields: ['workloadId', 'recoveryPointId', 'target', 'result'] },
  { name: 'ransomware.suspected', v: 1, from: 'Protection', when: 'A backup shows the change pattern of encryption (entropy and rename rate)', fields: ['workloadId', 'recoveryPointId', 'score', 'lastCleanPointId'] },
  { name: 'storage.threshold_crossed', v: 1, from: 'Platform', when: 'A repository passed 80, 90 or 95 % full', fields: ['repositoryId', 'percent', 'daysToFull'] },
  { name: 'replication.lagging', v: 1, from: 'Resilience', when: 'A replica fell behind its RPO target', fields: ['workloadId', 'lagSec', 'targetSec', 'site'] },
  { name: 'failover.started', v: 1, from: 'Resilience', when: 'A test, planned or unplanned failover began', fields: ['planId', 'kind', 'approvalId'] },
  { name: 'failover.finished', v: 1, from: 'Resilience', when: 'A failover ended', fields: ['planId', 'kind', 'result', 'rtoSec'] },
  { name: 'drill.finished', v: 1, from: 'Resilience', when: 'A booked drill ended and its evidence was signed', fields: ['planId', 'result', 'rpoSec', 'rtoSec', 'evidenceId'] },
  { name: 'migration.finished', v: 1, from: 'Mobility', when: 'Every server in a wave was committed or rolled back', fields: ['waveId', 'committed', 'rolledBack'] },
  { name: 'cutover.committed', v: 1, from: 'Mobility', when: 'One server was committed at its destination', fields: ['workloadId', 'waveId', 'destination'] },
  { name: 'customer.created', v: 1, from: 'Platform', when: 'A tenant was created from the console, the API or a sign-up', fields: ['tenantId', 'parentId', 'plan', 'source'] },
  { name: 'licence.expiring', v: 1, from: 'Platform', when: 'An entitlement ends in 30, 14 or 3 days', fields: ['tenantId', 'product', 'endsOn'] },
  { name: 'payment.failed', v: 1, from: 'Platform', when: 'A card or UPI payment was declined, or an invoice passed its due date', fields: ['tenantId', 'invoiceId', 'amount', 'reason'] },
  { name: 'alert.raised', v: 2, from: 'Platform', when: 'An alert opened, after deduplication and correlation', fields: ['alertId', 'severity', 'workloadId?', 'incidentId?'] },
  { name: 'approval.requested', v: 1, from: 'Platform', when: 'An action is waiting for one or more approvers', fields: ['approvalId', 'kind', 'requester', 'expires'] },
  { name: 'alert.created', v: 1, from: 'Platform', when: 'Replaced by alert.raised v2, which carries the incident', fields: ['alertId', 'severity'], deprecated: 'Stops on 31 Mar 2027' }
];

/** Automation › API and events › Event catalogue: every event, its version and its fields. */
export function EventCatalogue({ ctx, onSubscribe }: { ctx: Ctx; onSubscribe: () => void }) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('All');
  const open = useClosable<EventType>();
  const ql = q.trim().toLowerCase();
  const rows = EVENT_TYPES.filter(e => (from === 'All' || e.from === from) && (!ql || `${e.name} ${e.when}`.toLowerCase().includes(ql)));
  const sample = (e: EventType) => JSON.stringify({ id: 'evt_01JB2K9Q4X', type: e.name, version: e.v, tenantId: 'mer', occurredAt: '2026-10-21T10:35:12Z', correlationId: 'c-7f3a91e2-0b6d', data: Object.fromEntries(e.fields.map(f => [f.replace(/[[\]?]/g, ''), f.endsWith('[]') ? [] : '…'])) }, null, 2);
  return (
    <>
      <Toolbar>
        <FilterInput value={q} onChange={setQ} placeholder="Filter events" label="Filter events" width={220} />
        <SelectInput value={from} onChange={setFrom} options={['All', 'Platform', 'Protection', 'Resilience', 'Mobility'].map(v => ({ v, label: v === 'All' ? 'Every product' : v }))} width={180} />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Schema version 2026-09 · CloudEvents 1.0 envelope</span>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
        <MiniTable
          label="Event catalogue"
          cols={[{ label: 'Event', w: '230px' }, { label: 'Version', w: '72px' }, { label: 'From', w: '110px' }, { label: 'Sent when' }, { label: '', w: '160px' }]}
          rows={rows.map(e => [
            <code key="n" style={{ font: '600 12px var(--f-ui)' }}>{e.name}</code>,
            `v${e.v}`,
            e.from,
            <span key="w" style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: e.deprecated ? 'var(--tx-3)' : undefined }} data-tip={e.when} data-tip-overflow="">{e.when}</span>,
            e.deprecated ? <Status key="d" icon="triangle-alert" tone="warn" label="Deprecated" tip={e.deprecated} /> : <Btn key="o" kind="ghost" size="sm" onClick={() => open.open(e)}>Schema</Btn>
          ])}
          onRow={i => open.open(rows[i])}
          empty="No events match."
        />
      </div>
      {open.value ? (
        <Drawer
          label="Event schema"
          kicker={`Event · ${open.value.from}`}
          title={open.value.name}
          status={<><span>Version {open.value.v}</span>{open.value.deprecated ? <span>{open.value.deprecated}</span> : null}</>}
          actions={<><Btn kind="primary" icon="plus" onClick={() => { open.close(); onSubscribe(); }}>Subscribe…</Btn><Btn kind="outline" icon="copy" onClick={() => copyText(ctx, sample(open.value!), 'Sample event')}>Copy sample</Btn></>}
          closing={open.closing}
          onClose={open.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Facts items={[{ k: 'Sent when', v: open.value.when }, { k: 'Fields', v: open.value.fields.join(', ') }, { k: 'Delivery', v: 'At least once, in order per workload; signed with HMAC-SHA256' }, { k: 'Kept', v: '7 days for replay from /events' }]} />
            <pre style={{ margin: 0, padding: 12, background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/18px var(--f-ui)', whiteSpace: 'pre-wrap', userSelect: 'text' }}>{sample(open.value)}</pre>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- CLI, SDKs and infrastructure as code */

const TOOLS: { name: string; ver: string; what: string; install: string; icon: string }[] = [
  { name: 'Aegis CLI', ver: '4.2.1', what: 'Every product from a terminal; the same commands on Linux, macOS and Windows', install: 'curl -fsSL https://get.host360.ai/aegis-cli | sh', icon: 'square-terminal' },
  { name: 'PowerShell module', ver: '4.2.1', what: 'Host360.Aegis cmdlets: Get-AegisWorkload, Start-AegisBackup, Invoke-AegisFailover…', install: 'Install-Module Host360.Aegis -Scope CurrentUser', icon: 'square-terminal' },
  { name: 'Terraform provider', ver: '1.6.0', what: 'host360/aegis: tenants, policies, recovery plans and waves as code, referencing each other', install: 'terraform { required_providers { aegis = { source = "host360/aegis", version = "~> 1.6" } } }', icon: 'layers' },
  { name: 'Ansible collection', ver: '2.1.0', what: 'host360.aegis: agent deployment, policies and drills in playbooks', install: 'ansible-galaxy collection install host360.aegis', icon: 'layers' },
  { name: 'Python SDK', ver: '4.2.1', what: 'Generated from OpenAPI v2', install: 'pip install host360-aegis', icon: 'copy' },
  { name: 'Go SDK', ver: '4.2.1', what: 'Generated from OpenAPI v2', install: 'go get github.com/host360/aegis-go@v4.2.1', icon: 'copy' },
  { name: 'TypeScript SDK', ver: '4.2.1', what: 'Generated from OpenAPI v2', install: 'npm install @host360/aegis', icon: 'copy' }
];

/** Automation › API and events › CLI and SDKs: one toolset for every product. */
export function ToolsView({ ctx }: { ctx: Ctx }) {
  const tf = `resource "aegis_backup_policy" "erp" {
  tenant      = aegis_tenant.host360.id
  name        = "ERP production daily"
  schedule    = "0 1 * * *"
  retention   = { daily = 14, weekly = 4, monthly = 12 }
  immutable   = "14d"
}

resource "aegis_recovery_plan" "erp" {
  tenant   = aegis_tenant.host360.id
  name     = "Core services failover"
  from     = "Chennai-proxmox-prod"
  to       = "production-openstack"
  stages   = [aegis_stage.directory.id, aegis_stage.databases.id]
}`;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)', background: 'var(--panel)' }}>
        {TOOLS.map(t => (
          <div key={t.name} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 12, alignItems: 'start', padding: '12px 16px', borderBottom: '1px solid var(--ln)' }}>
            <Icon name={t.icon} style={{ color: 'var(--tx-3)', marginTop: 2 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span><strong style={{ fontWeight: 600 }}>{t.name}</strong> <span style={{ color: 'var(--tx-3)', font: '12px var(--f-ui)' }}>{t.ver}</span></span>
              <span style={{ color: 'var(--tx-2)' }}>{t.what}</span>
              <code style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-tip={t.install}>{t.install}</code>
            </span>
            <Btn kind="ghost" size="sm" icon="copy" onClick={() => copyText(ctx, t.install, `${t.name} install command`)}>Copy</Btn>
          </div>
        ))}
      </div>
      <Panel title="Terraform example" right={<Btn kind="ghost" size="sm" icon="copy" onClick={() => copyText(ctx, tf, 'Terraform example')}>Copy</Btn>}>
        <pre style={{ margin: 0, padding: 16, font: '12px/18px var(--f-ui)', whiteSpace: 'pre-wrap', userSelect: 'text' }}>{tf}</pre>
        <p style={{ padding: '0 16px 12px', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>One provider for every product, so a recovery plan can refer to the policy and tenant it depends on. {plural(TOOLS.length, 'tool')} built from the same OpenAPI v2 document on every release.</p>
      </Panel>
    </div>
  );
}

