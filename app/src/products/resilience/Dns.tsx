import { useState } from 'react';
import { Btn, RadioCard } from '../../ui/controls';
import { Bar, Facts, H3, MiniTable, Spacer, Status, Toolbar } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { audit, update, useStore } from '../../platform/store';
import { serversOf, type Runbook } from './data';

/** What the customer DNS holds for names a recovery plan serves. */
interface Rec { name: string; type: 'A' | 'CNAME'; primary: string; recovery: string; ttl: number; provider: string; server: string }
const RECORDS: Record<string, Rec[]> = {
  core: [
    { name: 'erp.host360.ai', type: 'A', primary: '10.20.0.31', recovery: '10.50.0.31', ttl: 300, provider: 'Route 53 · host360.ai', server: 'erp-app-01' },
    { name: 'mail.host360.ai', type: 'A', primary: '10.20.0.25', recovery: '10.50.0.25', ttl: 3600, provider: 'Route 53 · host360.ai', server: 'mail-gw-01' }
  ],
  cbs: [
    { name: 'cbs.meridianbank.in', type: 'A', primary: '10.40.1.11', recovery: '10.70.1.11', ttl: 60, provider: 'Infoblox · mum-ipam', server: 'cbs-db-01' },
    { name: 'upi.meridianbank.in', type: 'A', primary: '10.40.2.20', recovery: '10.70.2.20', ttl: 300, provider: 'Infoblox · mum-ipam', server: 'payments-api' }
  ],
  web: [{ name: 'shop.host360.ai', type: 'CNAME', primary: 'lb-storefront.host360.ai', recovery: 'lb-storefront.host360.ai', ttl: 300, provider: 'Cloudflare · host360.ai', server: 'web-frontend-01' }],
  trs: [{ name: 'treasury.meridianbank.in', type: 'A', primary: '10.30.4.21', recovery: '10.60.4.21', ttl: 900, provider: 'Infoblox · mum-ipam', server: 'mum-oracle-phy-01' }]
};
const LOW = 60;
const secs = (n: number) => (n >= 3600 ? `${n / 3600} h` : n >= 60 && n % 60 === 0 && n > 60 ? `${n / 60} min` : `${n} s`);

/** Recovery plan › DNS: which names move to the recovery site, when, and whether clients will follow quickly. */
export function DnsMapping({ ctx, rb, onAddStep }: { ctx: Ctx; rb: Runbook; onAddStep: (record: string, value: string) => void }) {
  const s = useStore();
  const edit = useClosable<Rec>();
  const [checking, setChecking] = useState(false);
  const steps = rb.stages.flatMap(st => st.steps.filter(x => x.kind === 'dns').map(x => ({ x, st })));
  const lbOnly = rb.stages.some(st => st.steps.some(x => x.kind === 'lb'));
  const recs = (RECORDS[rb.id] || []).filter(r => serversOf(rb).includes(r.server) || steps.some(y => y.x.record === r.name));
  const drill = s.drillSchedule.find(d => d.plan === rb.id);
  const cfg = ctx.can('configure', 'Changing DNS for a recovery plan');
  const ttlOf = (r: Rec) => s.dnsTtl[r.name]?.ttl ?? r.ttl;
  const autoOf = (r: Rec) => !!s.dnsTtl[r.name]?.auto;
  const stepOf = (r: Rec) => steps.find(y => y.x.record === r.name);
  const state = (r: Rec): [string, string, string, string] => {
    const st = stepOf(r);
    if (r.type === 'CNAME' && lbOnly && !st) return ['circle-check', 'ok', 'Follows the load balancer', 'The name points at the load balancer; its pool step moves traffic, so the record does not change.'];
    if (!st) return ['triangle-alert', 'warn', 'Not changed by the plan', `${r.name} points at ${r.server} at the primary site, but no step changes it. After a failover clients still go to ${r.primary}.`];
    if (ttlOf(r) <= LOW) return ['circle-check', 'ok', 'Ready', `Changed in stage ${rb.stages.indexOf(st.st) + 1}, ${st.st.name}. TTL ${secs(ttlOf(r))}: clients follow within a minute.`];
    if (autoOf(r)) return ['circle-check', 'ok', `Lowered before a failover`, `TTL is ${secs(ttlOf(r))} today. Aegis lowers it to ${LOW} s 24 h before a planned failover and puts it back after the return.`];
    return ['triangle-alert', 'warn', `TTL ${secs(ttlOf(r))}`, `Clients may keep ${r.primary} for up to ${secs(ttlOf(r))} after the switch. Lower it to ${LOW} s at least 24 h before a planned failover.`];
  };
  const issues = recs.filter(r => state(r)[1] !== 'ok').length;
  const check = () => {
    setChecking(true);
    window.setTimeout(() => {
      update(st => recs.forEach(r => { st.dnsTtl[r.name] = { ttl: ttlOf(r), auto: autoOf(r), checked: ctx.now() }; }));
      setChecking(false);
      ctx.toast(`${recs.length} records read from ${[...new Set(recs.map(r => r.provider.split(' · ')[0]))].join(' and ')}; each resolves to its primary value`, 'ok');
    }, 700);
  };
  const checked = recs.map(r => s.dnsTtl[r.name]?.checked).find(Boolean);

  if (!recs.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
        <Bar tone="info" multiline>
          No DNS names point at the servers in this plan, and no step changes a record. If people reach these servers by name, add an Update DNS step to the last stage.
        </Bar>
        <div>
          <Btn kind="outline" icon="network" perm={cfg} onClick={() => onAddStep('', '')}>
            Add an Update DNS step
          </Btn>
        </div>
      </div>
    );
  }
  return (
    <>
      <Toolbar style={{ padding: 0 }}>
        <span style={{ color: 'var(--tx-2)' }}>
          {issues ? `${issues} of ${recs.length} records need attention before a planned failover.` : `All ${recs.length} records are ready.`} {checked ? `Read from the providers ${checked}.` : 'Read from the providers every day at 06:00 IST.'}
        </span>
        <Spacer />
        <Btn kind="outline" icon={checking ? 'loader-circle' : 'refresh-cw'} spin={checking} disabled={checking} onClick={check}>
          Read records now
        </Btn>
      </Toolbar>
      <MiniTable
        label="DNS records"
        cols={[{ label: 'Name', w: 'minmax(170px,1.2fr)' }, { label: 'Type', w: '64px' }, { label: 'Primary', w: 'minmax(120px,1fr)' }, { label: 'At the recovery site', w: 'minmax(120px,1fr)' }, { label: 'TTL', w: '72px', r: true }, { label: 'Provider', w: '170px' }, { label: 'Status', w: '200px' }]}
        rows={recs.map(r => {
          const [i, t, l, tip] = state(r);
          return [
            <strong key="n" style={{ fontWeight: 600 }}>{r.name}</strong>,
            r.type,
            r.primary,
            stepOf(r)?.x.value || r.recovery,
            secs(ttlOf(r)),
            <span key="p" style={{ color: 'var(--tx-2)' }}>{r.provider}</span>,
            <Status key="s" icon={i} tone={t} label={l} tip={tip} />
          ];
        })}
        onRow={i => edit.open(recs[i])}
      />
      <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>
        <section>
          <H3>When records change</H3>
          <Facts
            labelW={150}
            items={[
              { k: 'Failover', v: 'When the stage with the Update DNS step is reached, after its health gates pass' },
              { k: 'Return to primary', v: 'Set back to the primary values after the servers at the primary site pass their checks' },
              { k: 'Test', v: drill ? `Never in the customer DNS. The test network gets its own DNS: ${drill.dns.toLowerCase()}${drill.records ? ` (${drill.records})` : ''}` : 'Never in the customer DNS; the test network gets its own DNS' },
              { k: 'Before a planned failover', v: `Records with a TTL over ${LOW} s are flagged here and in the failover pre-flight` }
            ]}
          />
        </section>
        <section>
          <H3>Providers</H3>
          <Facts
            labelW={150}
            items={[...new Set(recs.map(r => r.provider))].map(p => ({ k: p.split(' · ')[0], v: `Zone ${p.split(' · ')[1]} · connected, can change A and CNAME records`, icon: 'circle-check', tone: 'ok' as const }))}
          />
          <Btn kind="ghost" size="sm" icon="arrow-right" style={{ marginTop: 8 }} onClick={() => ctx.go('automation/integrations')}>
            Integrations
          </Btn>
        </section>
      </div>
      {edit.value ? <RecordDialog ctx={ctx} rb={rb} rec={edit.value} hasStep={!!stepOf(edit.value)} ttl={ttlOf(edit.value)} auto={autoOf(edit.value)} closing={edit.closing} onClose={edit.close} onAddStep={() => { const r = edit.value!; edit.close(); onAddStep(r.name, r.recovery); }} /> : null}
    </>
  );
}

function RecordDialog({ ctx, rb, rec, hasStep, ttl, auto, closing, onClose, onAddStep }: { ctx: Ctx; rb: Runbook; rec: Rec; hasStep: boolean; ttl: number; auto: boolean; closing: boolean; onClose: () => void; onAddStep: () => void }) {
  const [mode, setMode] = useState<'keep' | 'now' | 'auto'>(ttl <= LOW ? 'keep' : auto ? 'auto' : 'auto');
  const cfg = ctx.can('configure', 'Changing DNS for a recovery plan');
  const save = () => {
    update(st => { st.dnsTtl[rec.name] = { ttl: mode === 'now' ? LOW : ttl, auto: mode === 'auto', checked: st.dnsTtl[rec.name]?.checked }; });
    audit({ who: 'priya.raman', customer: rb.customer, what: mode === 'now' ? `Lowered the TTL to ${LOW} s` : mode === 'auto' ? 'Set the TTL to be lowered before planned failovers' : 'Kept the TTL', object: `${rec.name} (${rb.name})`, when: ctx.now(), r: 'ok' });
    ctx.toast(mode === 'now' ? `${rec.name}: TTL is now ${LOW} s at ${rec.provider.split(' · ')[0]}` : mode === 'auto' ? `${rec.name}: TTL will be lowered 24 h before each planned failover` : 'No change', 'ok');
    onClose();
  };
  return (
    <Dialog
      title={rec.name}
      sub={`${rec.type} record · ${rec.provider}`}
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          {!hasStep && rec.type === 'A' ? (
            <Btn kind="outline" icon="network" perm={cfg} onClick={onAddStep}>
              Add an Update DNS step
            </Btn>
          ) : null}
          <Btn kind="primary" icon="check" perm={cfg} onClick={save}>
            Save
          </Btn>
        </>
      }
    >
      <Facts labelW={150} items={[{ k: 'Primary value', v: rec.primary }, { k: 'At the recovery site', v: rec.recovery }, { k: 'Points at', v: rec.server }, { k: 'TTL today', v: secs(ttl) }]} />
      {!hasStep && rec.type === 'A' ? <Bar tone="warn" multiline>No step changes this record, so after a failover clients still go to {rec.primary}. Add an Update DNS step; it goes in the last stage, after the health gates.</Bar> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <RadioCard on={mode === 'auto'} onClick={() => setMode('auto')} title={`Lower to ${LOW} s 24 h before a planned failover`} note="Put back after the return to primary. Unplanned failovers use the TTL as it is." />
        <RadioCard on={mode === 'now'} onClick={() => setMode('now')} title={`Lower to ${LOW} s now and keep it`} note="More DNS queries all the time; clients follow any failover within a minute." />
        <RadioCard on={mode === 'keep'} onClick={() => setMode('keep')} title={`Keep ${secs(ttl)}`} note={ttl <= LOW ? 'Already low enough.' : `Clients may keep the old address for up to ${secs(ttl)} after a failover.`} />
      </div>
    </Dialog>
  );
}
