import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { Btn, CheckBox, Field, RadioCard, Seg, SelectInput } from '../ui/controls';
import { Bar, Facts, MiniTable, Spacer, Status, TableArea, Toolbar } from '../ui/layout';
import { StepUp, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit } from './store';

interface Comp { id: string; name: string; kind: 'Orchestrator' | 'Standby' | 'Appliance' | 'Proxy' | 'Agents'; where: string; version: string; latest: string; note?: string; order: number }
const COMPS: Comp[] = [
  { id: 'c1', name: 'aegis-orchestrator', kind: 'Orchestrator', where: 'Chennai DC1', version: '4.2.0', latest: '4.2.1', order: 2 },
  { id: 'c2', name: 'aegis-standby', kind: 'Standby', where: 'Mumbai DC2', version: '4.2.0', latest: '4.2.1', order: 1 },
  { id: 'c3', name: 'aegis-appliance-os1', kind: 'Appliance', where: 'production-openstack', version: '4.2.0', latest: '4.2.1', order: 4 },
  { id: 'c4', name: 'aegis-prod-220', kind: 'Appliance', where: 'Chennai-proxmox-prod', version: '4.2.0', latest: '4.2.1', order: 4 },
  { id: 'c5', name: 'aegis-proxy-cmp1 … cmp3', kind: 'Proxy', where: 'Chennai-proxmox-prod', version: '4.2.0', latest: '4.2.1', order: 3 },
  { id: 'c6', name: 'aegis-proxy-cmp4 … cmp6', kind: 'Proxy', where: 'Chennai-proxmox-prod', version: '4.1.3', latest: '4.2.1', order: 3, note: 'Scheduled for 4.2.0 on 26 Oct (maintenance window); can go straight to 4.2.1' },
  { id: 'c7', name: 'aegis-proxy-chn-01', kind: 'Proxy', where: 'Chennai vCenter', version: '4.2.0', latest: '4.2.1', order: 3 },
  { id: 'c8', name: 'Agents (212)', kind: 'Agents', where: 'Every customer', version: '4.2.0 on 198', latest: '4.2.1', order: 5, note: 'Upgraded in rings from Agents' }
];
const RELEASE = { v: '4.2.1', date: '17 Oct 2026', size: '2.4 GB', notes: ['Fixes CVE-2026-31877 (medium) in the agent installer', 'Faster catalogue rebuild after a repository move (about 4×)', 'Resilience: health gates retry on 503 before failing a stage', 'Mobility: VirtIO 0.1.262 for Windows Server 2025'], sha: 'b91f 2e0a 77c4 03d1 9e58 aa20 61c7 f3b9 0d44 8e12 c57a 1b90 e2f8 46d3 7a01 9c55' };
const PLAN = ['Back up the orchestrator database and configuration', 'Upgrade the standby in Mumbai DC2 and check it', 'Switch over to the standby (console pauses about 2 minutes; jobs keep running)', 'Upgrade the old primary in Chennai DC1; it becomes the standby', 'Upgrade proxies two at a time; each must pass its health check before the next', 'Upgrade appliances one at a time', 'Agents follow in rings from Agents › Upgrade'];

/** Settings › Updates: the version of every component, a planned rolling upgrade, and offline bundles. */
export function UpdatesTab({ ctx }: { ctx: Ctx }) {
  const [channel, setChannel] = useState<'stable' | 'early'>('stable');
  const plan = useClosable<boolean>();
  const [run, setRun] = useState(-1);
  const [scheduled, setScheduled] = useState<string | null>(null);
  useEffect(() => {
    if (run < 0 || run >= PLAN.length - 1) return;
    const t = window.setTimeout(() => setRun(r => r + 1), 1400);
    return () => window.clearTimeout(t);
  }, [run]);
  const behind = COMPS.filter(c => !c.version.startsWith(c.latest));
  const cfg = ctx.can('admin', 'Upgrading Aegis');
  return (
    <>
      <Toolbar>
        <Seg label="Channel" value={channel} onChange={v => { setChannel(v); ctx.toast(v === 'early' ? 'Early channel: releases arrive two weeks before Stable' : 'Stable channel', 'info'); }} options={[{ v: 'stable', label: 'Stable' }, { v: 'early', label: 'Early access' }]} />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Checked against updates.host360.ai at 06:00 IST</span>
        <Spacer />
        <Btn kind="outline" icon="download" onClick={() => ctx.toast(`aegis-${RELEASE.v}-offline.bundle (${RELEASE.size}) downloaded; check the SHA-256 before carrying it in`, 'ok')}>Offline bundle</Btn>
        <Btn kind="primary" icon="arrow-up" perm={cfg} disabled={run >= 0 || !!scheduled} why={scheduled ? `Already scheduled for ${scheduled}.` : 'An upgrade is running.'} onClick={() => plan.open(true)}>Plan the upgrade to {RELEASE.v}</Btn>
      </Toolbar>
      {scheduled ? <div style={{ padding: '0 24px 12px' }}><Bar tone="info" icon="calendar-clock">Upgrade to {RELEASE.v} scheduled for {scheduled}. Customers were told through the maintenance window.</Bar></div> : null}
      {run >= 0 ? (
        <div style={{ padding: '0 24px 12px' }}>
          <div style={{ border: '1px solid var(--ln)', background: 'var(--panel)', padding: '12px 16px' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Upgrading to {RELEASE.v}</div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PLAN.map((p, i) => (
                <li key={p} style={{ display: 'flex', gap: 8, alignItems: 'center', color: i <= run ? 'var(--tx)' : 'var(--tx-3)' }}>
                  <Icon name={i < run || run === PLAN.length - 1 ? 'circle-check' : i === run ? 'loader-circle' : 'circle'} spin={i === run && run < PLAN.length - 1} style={{ color: i < run || run === PLAN.length - 1 ? 'var(--ok)' : i === run ? 'var(--run)' : 'var(--tx-3)' }} />
                  {p}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
      <TableArea>
        <AegisTable
          label="Components"
          cols={[{ k: 'n', label: 'Component', w: 'minmax(200px,1.4fr)' }, { k: 'k', label: 'Kind', w: '120px' }, { k: 'w', label: 'Where', w: 'minmax(170px,1.2fr)', dim: true }, { k: 'v', label: 'Version', w: '130px' }, { k: 'o', label: 'Upgrade order', w: '120px', r: true }, { k: 's', label: 'State', w: 'minmax(170px,1.2fr)' }]}
          rows={COMPS.map(c => {
            const done = run >= 0 && (run >= PLAN.length - 1 ? c.kind !== 'Agents' : (c.kind === 'Standby' && run >= 2) || (c.kind === 'Orchestrator' && run >= 4) || (c.kind === 'Proxy' && run >= 5) || (c.kind === 'Appliance' && run >= 6));
            return {
              id: c.id,
              n: { v: c.name, strong: true },
              k: c.kind,
              w: c.where,
              v: done ? RELEASE.v : c.version,
              o: { v: String(c.order), s: c.order },
              s: done ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Up to date' } : c.version.startsWith(c.latest) ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Up to date' } : { t: 'status', i: 'arrow-up', c: c.version.startsWith('4.1') ? 'warn' : 'run', l: `${c.latest} available`, tip: c.note || `${c.latest} available` }
            };
          })}
          state={ctx.ui}
          unit={['component', 'components']}
          emptyText="No components reported."
          sort="o"
          footR={`${behind.length} of ${COMPS.length} behind ${RELEASE.v}`}
        />
      </TableArea>
      {plan.value ? <PlanWizard ctx={ctx} closing={plan.closing} onClose={plan.close} onStart={when => { plan.close(); if (when === 'now') setRun(0); else setScheduled('Mon 02 Nov 2026, 02:00 IST'); audit({ who: 'priya.raman', customer: 'h360', what: when === 'now' ? 'Started a rolling upgrade' : 'Scheduled a rolling upgrade', object: `Aegis ${RELEASE.v}`, when: ctx.now(), r: 'ok' }); ctx.toast(when === 'now' ? `Rolling upgrade to ${RELEASE.v} started` : `Upgrade to ${RELEASE.v} scheduled in the 02 Nov maintenance window`, 'ok'); }} /> : null}
    </>
  );
}

function PlanWizard({ ctx, closing, onClose, onStart }: { ctx: Ctx; closing: boolean; onClose: () => void; onStart: (when: 'now' | 'window') => void }) {
  const [step, setStep] = useState(0);
  const [pairs, setPairs] = useState('2');
  const [gate, setGate] = useState(true);
  const [when, setWhen] = useState<'now' | 'window'>('window');
  const [mfa, setMfa] = useState(false);
  return (
    <Wizard
      title={`Upgrade Aegis to ${RELEASE.v}`}
      sub="A rolling upgrade: the standby goes first, so the console is paused only at the switch and running jobs carry on."
      steps={['Release', 'Order', 'When']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={<Btn kind="primary" iconAfter={step < 2 ? 'arrow-right' : undefined} icon={step === 2 ? 'arrow-up' : undefined} disabled={step === 2 && !mfa} why="Confirm it is you first." onClick={() => (step < 2 ? setStep(step + 1) : onStart(when))}>{step < 2 ? 'Next' : when === 'now' ? 'Start now' : 'Schedule'}</Btn>}
    >
      {step === 0 ? (
        <>
          <Facts items={[{ k: 'Release', v: `${RELEASE.v}, ${RELEASE.date}` }, { k: 'Size', v: RELEASE.size }, { k: 'Signed', v: 'Host360 release key; verified before anything installs', icon: 'badge-check', tone: 'ok' }, { k: 'SHA-256', v: <code style={{ font: '12px var(--f-ui)' }}>{RELEASE.sha}</code> }]} />
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>{RELEASE.notes.map(n => <li key={n} style={{ display: 'flex', gap: 8 }}><Icon name="check" style={{ color: 'var(--ok)', marginTop: 2 }} />{n}</li>)}</ul>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <MiniTable label="Order" cols={[{ label: '#', w: '32px' }, { label: 'Step' }]} rows={PLAN.map((p, i) => [String(i + 1), p])} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
            <Field id="up-p" label="Proxies at a time"><SelectInput id="up-p" value={pairs} onChange={setPairs} options={['1', '2', '3']} /></Field>
            <CheckBox on={gate} onChange={setGate}>Stop if a component fails its health check</CheckBox>
          </div>
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>A failed component rolls back to {COMPS[0].version} by itself. Proxies at 4.1.3 go straight to {RELEASE.v}.</p>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <RadioCard on={when === 'window'} onClick={() => setWhen('window')} icon="calendar-clock" title="In the maintenance window" note="Mon 02 Nov 2026, 02:00 to 04:00 IST; every customer has been told" />
            <RadioCard on={when === 'now'} onClick={() => setWhen('now')} icon="arrow-up" title="Now" note="For an urgent fix; customers see the maintenance page during the switch" />
          </div>
          <StepUp verified={mfa} onVerified={() => setMfa(true)} />
        </>
      ) : null}
    </Wizard>
  );
}
