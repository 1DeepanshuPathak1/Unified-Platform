import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { Btn, Field, SelectInput, Toggle } from '../ui/controls';
import { Bar, Facts, MiniTable, Page, PageHeader, Panel } from '../ui/layout';
import { Dialog, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { CUSTOMERS } from '../data/platform';
import { custName, inScope } from './common';
import { audit } from './store';

/* ------------------------------------------------------------------ Guided first run */

const STEPS: { id: string; title: string; what: string; mins: number; go: string; done: string }[] = [
  { id: 'connect', title: 'Connect a platform', what: 'Proxmox VE, OpenStack, Hyper-V, Nutanix, KubeVirt, or deploy the agent to physical servers.', mins: 5, go: 'sites', done: 'nil-pve-01 connected with an API token' },
  { id: 'discover', title: 'Discover what is there', what: 'Aegis reads every VM, its disks and its applications, and suggests a tier for each.', mins: 3, go: 'workloads', done: '14 workloads found; 3 databases' },
  { id: 'recommend', title: 'Accept the recommended protection', what: 'One click applies the policy each tier needs: schedule, retention, immutability and a second copy.', mins: 4, go: 'policies', done: '' },
  { id: 'backup', title: 'Run the first backup', what: 'Starts now instead of waiting for tonight’s schedule; the job tray shows its progress.', mins: 8, go: 'guests', done: '' },
  { id: 'verify', title: 'Prove a restore', what: 'Boots one backup in the sandbox, checks it and keeps the screenshot as evidence.', mins: 4, go: 'overview/verification', done: '' },
  { id: 'invite', title: 'Invite your team', what: 'Owner, admins and restore operators, with MFA from the first sign-in.', mins: 2, go: 'settings/users', done: '' }
];

/** Home › Get started: connect, discover, recommend, back up and verify in under 30 minutes. */
export function GetStarted({ ctx }: { ctx: Ctx }) {
  const cust = ctx.actingAs?.customer || 'nil';
  const [done, setDone] = useState<string[]>(cust === 'nil' ? ['connect', 'discover'] : STEPS.map(s => s.id));
  const next = STEPS.find(s => !done.includes(s.id));
  const left = STEPS.filter(s => !done.includes(s.id)).reduce((a, s) => a + s.mins, 0);
  return (
    <Page scroll>
      <PageHeader kicker={custName(cust)} title="Get started" sub="Connect, discover, protect and prove a restore. About 26 minutes from start to a verified backup." actions={<Btn kind="ghost" icon="chevron-left" onClick={() => ctx.go('home')}>Home</Btn>} />
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>
        <Bar tone={next ? 'info' : 'ok'} multiline>{next ? `${done.length} of ${STEPS.length} done · about ${left} minutes left. Next: ${next.title.toLowerCase()}.` : 'Everything is set up: backups run on schedule and a restore has been proven.'}</Bar>
        <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)', background: 'var(--panel)' }}>
          {STEPS.map((s, i) => {
            const isDone = done.includes(s.id);
            const isNext = next?.id === s.id;
            return (
              <li key={s.id} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '14px 16px', borderBottom: i < STEPS.length - 1 ? '1px solid var(--ln)' : 'none', background: isNext ? 'var(--acc-soft)' : undefined }}>
                <span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', border: `1px solid ${isDone ? 'var(--ok)' : isNext ? 'var(--acc)' : 'var(--ln-2)'}`, color: isDone ? 'var(--ok)' : 'var(--tx-2)', font: '700 12px var(--f-ui)' }}>{isDone ? <Icon name="check" size={14} /> : i + 1}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{s.title}</span>
                  <span style={{ display: 'block', font: '13px/18px var(--f-ui)', color: 'var(--tx-2)' }}>{isDone && s.done ? s.done : s.what}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{isDone ? 'Done' : `${s.mins} min`}</span>
                  {!isDone ? (
                    <Btn
                      kind={isNext ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        if (s.id === 'recommend' || s.id === 'backup' || s.id === 'verify') {
                          setDone(d => [...d, s.id]);
                          audit({ who: ctx.actingAs ? ctx.actingAs.ownerEmail : 'priya.raman', customer: cust, what: `Getting started: ${s.title.toLowerCase()}`, object: custName(cust), when: ctx.now(), r: 'ok' });
                          ctx.toast(s.id === 'recommend' ? '14 workloads protected by the policy of their tier' : s.id === 'backup' ? 'First backup started for 14 workloads' : 'Restore of nil-pos-db verified in the sandbox in 4 min 10 s', 'ok');
                        } else ctx.go(s.go);
                      }}
                    >
                      {s.id === 'recommend' ? 'Apply' : s.id === 'backup' ? 'Back up now' : s.id === 'verify' ? 'Prove a restore' : 'Open'}
                    </Btn>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
        {done.includes('discover') && !done.includes('recommend') ? (
          <Panel title="What Aegis recommends">
            <div style={{ padding: '4px 16px 12px' }}>
              <MiniTable label="Recommendations" cols={[{ label: 'Tier', w: '90px' }, { label: 'Workloads', w: 'minmax(0,1fr)' }, { label: 'Protection' }]} rows={[['Tier 0', 'nil-pos-db, nil-erp-db', 'Hourly, 30 days, immutable 14 d, copy to Mumbai'], ['Tier 1', 'nil-erp-app, nil-ad-01, nil-file-01', 'Daily, 30 days, immutable 14 d'], ['Tier 2', '9 others', 'Daily, 14 days']]} />
              <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Tiers come from what discovery found: databases and domain controllers rank higher. Change any of them later in Workloads.</p>
            </div>
          </Panel>
        ) : null}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ Telemetry */

const SENT: [string, string][] = [
  ['Product use', 'Which screens and features are used, how often; no names or values'],
  ['Health', 'Job counts and durations, error codes, component versions'],
  ['Crashes', 'Stack traces of console and agent crashes, with file paths removed'],
  ['Environment', 'Platform types and versions (for example Proxmox VE 9.2), counts of VMs and TB']
];
const NEVER = ['Backup data, file names or file contents', 'Host names, IP addresses or user names (hashed before they leave)', 'Credentials, keys or certificates', 'Anything about a customer that has opted out'];

/** Settings › Telemetry: what leaves the platform for Host360 product teams, and who has opted out. */
export function TelemetryTab({ ctx }: { ctx: Ctx }) {
  const custs = CUSTOMERS.filter(c => c.status !== 'archived' && inScope(ctx, c.id));
  const [off, setOff] = useState<Record<string, boolean>>({ mer: true, cor: true });
  const [level, setLevel] = useState('Health and crashes only');
  const sample = useClosable<boolean>();
  const self = ctx.actingAs?.customer;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Bar tone="info" multiline>Telemetry helps Host360 fix problems before customers notice them. It goes to Host360’s own endpoint in Mumbai, is kept 13 months, and never contains customer data.</Bar>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="What is sent" right={<Btn kind="ghost" size="sm" icon="eye" onClick={() => sample.open(true)}>See a sample</Btn>}>
          <div style={{ padding: '4px 16px 12px' }}>
            <MiniTable label="Sent" cols={[{ label: 'Kind', w: '110px' }, { label: 'Contents' }]} rows={SENT.map(([k, v]) => [<strong key="k" style={{ fontWeight: 600 }}>{k}</strong>, <span key="v" style={{ whiteSpace: 'normal', padding: '6px 0' }}>{v}</span>])} />
          </div>
        </Panel>
        <Panel title="Never sent">
          <ul style={{ padding: '12px 16px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {NEVER.map(n => (
              <li key={n} style={{ display: 'flex', gap: 8, font: '13px/18px var(--f-ui)' }}>
                <Icon name="ban" size={14} style={{ color: 'var(--tx-3)', marginTop: 2 }} />
                {n}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {!self ? (
        <Panel title="Level for the whole platform">
          <div style={{ padding: '12px 16px', maxWidth: 420 }}>
            <Field id="tl-l" label="Send"><SelectInput id="tl-l" value={level} onChange={v => { setLevel(v); audit({ who: 'priya.raman', customer: 'h360', what: 'Changed the telemetry level', object: 'Platform', when: ctx.now(), r: 'ok', after: [['Level', v]] }); ctx.toast(`Telemetry: ${v.toLowerCase()}`, 'ok'); }} options={['Everything above', 'Health and crashes only', 'Nothing (air-gapped installations)']} /></Field>
          </div>
        </Panel>
      ) : null}
      <Panel title={self ? 'Your choice' : 'Telemetry per customer'}>
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Telemetry per customer"
            cols={[{ label: 'Customer', w: 'minmax(0,1fr)' }, { label: 'Telemetry', w: '260px' }]}
            rows={custs.map(c => [
              <strong key="n" style={{ fontWeight: 600 }}>{c.name}</strong>,
              <Toggle
                key="t"
                on={!off[c.id]}
                label={`Telemetry for ${c.name}`}
                onChange={v => {
                  setOff(o => ({ ...o, [c.id]: !v }));
                  audit({ who: self ? ctx.actingAs!.ownerEmail : 'priya.raman', customer: c.id, what: v ? 'Turned telemetry on' : 'Opted out of telemetry', object: c.name, when: ctx.now(), r: 'ok' });
                  ctx.toast(v ? `Telemetry on for ${c.name}` : `${c.name} opted out; nothing about it is sent from now on`, 'ok');
                }}
              >
                {off[c.id] ? 'Opted out' : 'On'}
              </Toggle>
            ])}
          />
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>A customer can opt out from its own Settings at any time; the provider cannot turn it back on.</p>
        </div>
      </Panel>
      {sample.value ? (
        <Dialog title="Sample telemetry record" sub="Sent every hour; this is the last one." closing={sample.closing} onClose={sample.close} footer={<Btn kind="ghost" onClick={sample.close}>Close</Btn>}>
          <pre style={{ margin: 0, padding: 12, background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/18px var(--f-mono)', overflow: 'auto', maxHeight: 320 }}>{`{
  "installation": "h360-prod",
  "version": "4.2.0",
  "hour": "2026-10-21T15:00+05:30",
  "jobs": { "backup": 412, "failed": 6, "p95_minutes": 22 },
  "errors": { "E-BKP-2107": 1, "E-BKP-1204": 1 },
  "platforms": { "Proxmox VE 9.2": 2, "OpenStack 2024.1": 1 },
  "features": { "restore.files": 9, "failover.test": 1 },
  "host": "sha256:4b1e…c09a"
}`}</pre>
          <Facts items={[{ k: 'Endpoint', v: 'telemetry.host360.ai (Mumbai)' }, { k: 'Kept', v: '13 months' }]} />
        </Dialog>
      ) : null}
    </div>
  );
}

