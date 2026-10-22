import { useState } from 'react';
import { Btn } from '../ui/controls';
import { Bar, Facts, MiniTable, Panel, Status, Tiles } from '../ui/layout';
import type { Ctx } from '../ui/ctx';
import { custName } from './common';
import { audit } from './store';

/** What keeps one tenant's data, keys and jobs away from every other tenant, in every product. */
const BOUNDARIES: [string, string, string][] = [
  ['Data', 'Every recovery point, replica and migration staging copy is written under the tenant’s own repository prefix; bucket policies refuse any other tenant’s credentials', 'Canary reads every 6 h'],
  ['Credentials', 'Vault paths per tenant (secret/tenants/{id}/…); a token is scoped to one tenant unless it belongs to a provider role', 'Canary reads every 6 h'],
  ['Storage', 'Separate buckets or datastores per tenant on shared repositories; quotas counted per tenant', 'Nightly reconciliation'],
  ['Jobs', 'Every job carries its tenant; proxies only accept jobs for the tenants they are assigned to; fair share is per tenant', 'Every job'],
  ['Keys', 'One encryption key per tenant (or the tenant’s own key through KMS); provider administrators cannot export it', 'Key policy check, daily'],
  ['Network', 'Proxies for tenant-dedicated sites sit in the tenant’s VLAN; test bubbles have no route to other tenants or production', 'Bubble probe at each drill'],
  ['Reporting and search', 'Row-level filters on every query, so a report or a search never returns another tenant’s object', 'Canary queries every 6 h'],
  ['Audit', 'Each tenant has its own audit stream; provider actions on a tenant appear in both, marked with who acted as whom', 'Hash chain verified hourly']
];
const CANARIES = [
  { what: 'Meridian token reads a Kaveri recovery point', last: '21 Oct, 12:00', r: 'Refused (403)' },
  { what: 'Kaveri token lists Meridian workloads', last: '21 Oct, 12:00', r: 'Refused (empty result, logged)' },
  { what: 'Sahyadri proxy asked to run a Host360 job', last: '21 Oct, 12:00', r: 'Refused by the proxy' },
  { what: 'Report for Nilgiri run with a Coromandel filter', last: '21 Oct, 12:00', r: 'Refused (403)' },
  { what: 'Restore of an Atlas point into a Kaveri project', last: '21 Oct, 12:00', r: 'Refused before the job started' }
];

/** Security & Compliance › Tenant isolation: one boundary for all three products, tested continuously and by an outside firm. */
export function IsolationTab({ ctx }: { ctx: Ctx }) {
  const [ran, setRan] = useState<string | null>(null);
  const self = ctx.actingAs?.customer;
  const run = () => {
    setRan('run');
    window.setTimeout(() => {
      setRan(ctx.now());
      audit({ who: 'priya.raman', customer: self || 'h360', what: 'Ran the cross-tenant checks', object: '48 checks', when: ctx.now(), r: 'ok' });
      ctx.toast('48 cross-tenant checks run: every one refused', 'ok');
    }, 1200);
  };
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tiles
        items={[
          { label: 'Cross-tenant checks', value: '48', unit: 'of 48 refused', icon: 'circle-check', tone: 'ok', sub: `Every 6 h · last ${ran && ran !== 'run' ? ran.split(', ')[1] : '12:00 IST'}` },
          { label: 'Penetration test', value: '0', unit: 'open critical or high', icon: 'badge-check', tone: 'ok', sub: '12 Aug 2026 · next due Feb 2027' },
          { label: 'Exceptions used', value: '1', unit: 'in 90 days', icon: 'triangle-alert', tone: 'warn', sub: 'Cross-project restore, dual-approved' }
        ]}
      />
      {self ? <Bar tone="info" multiline>These controls apply to {custName(self)} and every other tenant on this platform. The penetration test report is available under NDA from your account manager.</Bar> : null}
      <Panel title="The isolation boundary" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>The same in Protection, Resilience and Mobility</span>}>
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Isolation boundary"
            cols={[{ label: 'Boundary', w: '170px' }, { label: 'How it is enforced' }, { label: 'Checked', w: '170px' }]}
            rows={BOUNDARIES.map(([k, how, chk]) => [<strong key="k" style={{ fontWeight: 600 }}>{k}</strong>, <span key="h" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={how} data-tip-overflow="">{how}</span>, chk])}
          />
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Continuous cross-tenant checks" right={!self ? <Btn kind="outline" size="sm" icon={ran === 'run' ? 'loader-circle' : 'play'} spin={ran === 'run'} disabled={ran === 'run'} onClick={run}>Run now</Btn> : undefined}>
          <div style={{ padding: '4px 16px 12px' }}>
            <MiniTable
              label="Cross-tenant checks"
              cols={[{ label: 'Attempt' }, { label: 'Result', w: '210px' }]}
              rows={CANARIES.map(c => [<span key="w" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={c.what} data-tip-overflow="">{c.what}</span>, <Status key="r" icon="circle-check" tone="ok" label={c.r} />])}
            />
            <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>5 of 48 shown. A check that is allowed raises a Critical alert and pages the security on-call.</p>
          </div>
        </Panel>
        <Panel title="Independent penetration test" right={!self ? <Btn kind="ghost" size="sm" icon="download" onClick={() => ctx.toast('pentest-2026-08-signed.pdf downloaded (restricted)', 'ok')}>Signed report</Btn> : undefined}>
          <div style={{ padding: '4px 16px 12px' }}>
            <Facts
              labelW={130}
              items={[
                { k: 'Firm', v: 'Nilaya Security Labs (CERT-In empanelled)' },
                { k: 'Tested', v: '28 Jul to 12 Aug 2026, grey box' },
                { k: 'Scope', v: 'All three products, the API, the customer portal and tenant boundaries' },
                { k: 'Findings', v: '0 critical · 1 high (fixed 19 Aug) · 4 medium (3 fixed) · 6 low' },
                { k: 'Open', v: 'M-03: session not bound to device; fix in 4.3 (Nov 2026)', icon: 'triangle-alert', tone: 'warn' },
                { k: 'Next test', v: 'February 2027' }
              ]}
            />
          </div>
        </Panel>
      </div>
      <Panel title="Exceptions">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Exceptions"
            cols={[{ label: 'When', w: '150px' }, { label: 'What' }, { label: 'Approved by', w: '230px' }, { label: 'State', w: '120px' }]}
            rows={[['03 Oct, 11:20', 'Restore of a Meridian-CBS point into Meridian-Migration (cross-project, same tenant)', 'anitha.k@meridianbank.in and priya.raman', <Status key="s" icon="check" tone="tx" label="Used, expired" />]]}
            empty="No exceptions."
          />
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>An exception lets one request cross a project boundary inside one tenant, once, within 24 hours, after two people approve. Nothing can cross between tenants.</p>
        </div>
      </Panel>
    </div>
  );
}
