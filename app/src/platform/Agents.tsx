import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Btn, CheckBox, Field, FilterInput, RadioCard, Seg, SelectInput } from '../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Page, PageHeader, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { AGENTS, CURRENT_AGENT, RINGS, type Agent } from '../data/ops';
import { custName, inScope, showCustomerCol } from './common';
import { audit } from './store';

const HEALTH: Record<Agent['health'], { i: string; l: string; c: string }> = {
  ok: { i: 'circle-check', l: 'Healthy', c: 'ok' },
  warn: { i: 'triangle-alert', l: 'Warning', c: 'warn' },
  err: { i: 'circle-x', l: 'Failing', c: 'err' },
  unreach: { i: 'triangle-alert', l: 'No heartbeat', c: 'warn' }
};
const short = (t: string) => t.replace(' 2026', '').replace(' IST', '');
const outdated = (a: Agent) => a.version !== CURRENT_AGENT && !a.version.includes('rc');

/** Agents: one per machine for every product, with health, version and staged upgrades. */
export default function Agents({ ctx }: { ctx: Ctx }) {
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [view, setView] = useState<'all' | 'attention' | 'old'>('all');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const deploy = useClosable<boolean>();
  const upgrade = useClosable<boolean>();
  const remove = useClosable<string>();
  const [rollout, setRollout] = useState<string | null>(null);
  useEffect(() => {
    if (ctx.openId && agents.some(a => a.id === ctx.openId || a.machine === ctx.openId)) drawer.open(agents.find(a => a.id === ctx.openId || a.machine === ctx.openId)!.id);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const scoped = agents.filter(a => inScope(ctx, a.customer));
  const ql = q.trim().toLowerCase();
  const rows = scoped.filter(a => (view === 'all' || (view === 'attention' ? a.health !== 'ok' : outdated(a))) && (!ql || `${a.machine} ${a.os} ${a.kind}`.toLowerCase().includes(ql)));
  const showCust = showCustomerCol(ctx);
  const op = ctx.can('operate', 'Managing agents');
  const cfg = ctx.can('configure', 'Upgrading agents');
  const d = drawer.value ? agents.find(a => a.id === drawer.value) : null;
  const live = rollout ? ctx.jobs.find(j => j.id === rollout && j.status === 'run') : null;
  return (
    <Page>
      <PageHeader
        kicker="Infrastructure"
        title="Agents"
        sub="One agent per machine serves every product. Physical servers, endpoints, databases and Kubernetes clusters need one; VMs on a connected platform do not."
        actions={
          <>
            <Btn kind="outline" icon="download" perm={op} onClick={() => deploy.open(true)}>
              Deploy agents…
            </Btn>
            <Btn kind="primary" icon="upload" perm={cfg} disabled={!!live} why="An upgrade is rolling out." onClick={() => upgrade.open(true)}>
              Upgrade…
            </Btn>
          </>
        }
      />
      <Toolbar>
        <Seg
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { v: 'all', label: 'All', count: scoped.length },
            { v: 'attention', label: 'Needs attention', count: scoped.filter(a => a.health !== 'ok').length },
            { v: 'old', label: 'Out of date', count: scoped.filter(outdated).length }
          ]}
        />
        <FilterInput value={q} onChange={setQ} placeholder="Filter by machine, OS or kind" label="Filter agents" width={240} />
        <Spacer />
      </Toolbar>
      <TableArea above={live ? <Bar tone="run">Upgrading to {CURRENT_AGENT}: {live.phases[live.phase]} · {Math.floor(live.pct)} %. The next ring starts only if fewer than 2 % of upgrades fail.</Bar> : undefined}>
        <AegisTable
          label="Agents"
          cols={[
            { k: 'm', label: 'Machine', w: 'minmax(150px,1.3fr)' },
            ...(showCust ? [{ k: 'c', label: 'Customer', w: 'minmax(120px,1fr)', dim: true }] : []),
            { k: 'kind', label: 'Kind', w: '150px', dim: true },
            { k: 'prod', label: 'Serves', w: 'minmax(150px,1.2fr)' },
            { k: 'v', label: 'Version', w: '108px' },
            { k: 'ring', label: 'Ring', w: '72px', dim: true },
            { k: 'h', label: 'Health', w: '132px' },
            { k: 'hb', label: 'Last heartbeat', w: '132px', dim: true }
          ]}
          rows={rows.map(a => ({
            id: a.id,
            m: { v: a.machine, strong: true },
            c: custName(a.customer),
            kind: a.kind,
            prod: { v: a.products.join(', '), tip: `Serves ${a.products.join(', ')}` },
            v: outdated(a) ? { t: 'status', i: 'arrow-up', c: 'warn', l: a.version, tip: `${CURRENT_AGENT} is available` } : a.version.includes('rc') ? { t: 'status', i: 'flask-conical', c: 'run', l: a.version, tip: 'Release candidate on the canary ring' } : { v: a.version },
            ring: a.ring,
            h: { t: 'status', ...HEALTH[a.health], tip: a.note || HEALTH[a.health].l },
            hb: a.health === 'unreach' ? { v: short(a.heartbeat), tip: 'No heartbeat since then' } : short(a.heartbeat).split(', ')[1]
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['agent', 'agents']}
          filtered={view !== 'all' || !!ql}
          onClear={() => { setView('all'); setQ(''); }}
          emptyText="No agents yet. VMs are protected through their platform; deploy an agent for physical servers, endpoints, databases and Kubernetes."
          emptyAction="Deploy agents"
          onEmpty={() => deploy.open(true)}
          footR={`Current version ${CURRENT_AGENT} · heartbeat every 60 s`}
          sort="m"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Agent details"
          kicker={`${d.kind} · ${custName(d.customer)}`}
          title={d.machine}
          status={
            <>
              <Status icon={HEALTH[d.health].i} tone={HEALTH[d.health].c} label={HEALTH[d.health].l} />
              <span>Version {d.version}</span>
              <span>Ring {d.ring}</span>
            </>
          }
          actions={
            <>
              <Btn kind="outline" icon="refresh-cw" perm={op} onClick={() => { audit({ who: 'priya.raman', customer: d.customer, what: 'Restarted an agent', object: d.machine, when: ctx.now(), r: 'ok' }); ctx.toast(`Agent on ${d.machine} restarted`, 'ok'); }}>
                Restart
              </Btn>
              {outdated(d) ? (
                <Btn kind="outline" icon="upload" perm={cfg} disabled={d.version.startsWith('4.0') && d.os.startsWith('CentOS')} why="4.0.8 is the last version for CentOS 7." onClick={() => { ctx.startJob({ name: 'Agent upgrade', object: d.machine, product: 'Platform', phases: ['Download', 'Verify signature', 'Install', 'Restart', 'Done'], speed: 18, doneToast: `Agent on ${d.machine} upgraded to ${CURRENT_AGENT}` }); setAgents(x => x.map(a => (a.id === d.id ? { ...a, version: CURRENT_AGENT } : a))); }}>
                  Upgrade to {CURRENT_AGENT}
                </Btn>
              ) : null}
              <Btn kind="danger" icon="trash-2" perm={ctx.can('destroy', 'Removing an agent')} onClick={() => remove.open(d.id)}>
                Remove
              </Btn>
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {d.note ? <Bar tone={d.health === 'err' ? 'err' : 'warn'} multiline>{d.note}</Bar> : null}
            <DrawerTiles items={[{ label: 'Serves', value: d.products.length, sub: d.products.join(', ') }, { label: 'Version', value: d.version, icon: outdated(d) ? 'arrow-up' : undefined, tone: 'warn' }, { label: 'Heartbeat', value: d.health === 'unreach' ? 'None' : 'Every 60 s', sub: short(d.heartbeat) }]} />
            <Facts items={[{ k: 'Machine', v: d.machine }, { k: 'Operating system', v: d.os }, { k: 'Site', v: d.site }, { k: 'Installed', v: d.installed }, { k: 'Upgrade ring', v: `${d.ring} · ${RINGS.find(r => r.ring === d.ring)!.rule}` }, { k: 'Talks to', v: 'aegis-orchestrator over TLS 1.3 on 443; outbound only' }]} />
          </div>
        </Drawer>
      ) : null}
      {deploy.value ? <DeployDialog ctx={ctx} closing={deploy.closing} onClose={deploy.close} /> : null}
      {upgrade.value ? (
        <UpgradeWizard
          ctx={ctx}
          agents={scoped}
          closing={upgrade.closing}
          onClose={upgrade.close}
          onStart={id => {
            setRollout(id);
            upgrade.close();
          }}
        />
      ) : null}
      {remove.value
        ? (() => {
            const a = agents.find(x => x.id === remove.value)!;
            return (
              <DangerDialog
                title={`Remove the agent from ${a.machine}`}
                intro="Uninstalls the agent at its next heartbeat and stops everything it does for every product."
                removed={a.products.map(p => (p === 'Protection' ? `Backups of ${a.machine}` : p === 'Resilience' ? `Replication of ${a.machine}` : `Migration passes of ${a.machine}`))}
                kept="Recovery points already taken are kept under their retention."
                name={a.machine}
                action="Remove agent"
                closing={remove.closing}
                onClose={remove.close}
                onConfirm={() => {
                  setAgents(x => x.filter(y => y.id !== a.id));
                  audit({ who: 'priya.raman', customer: a.customer, what: 'Removed an agent', object: a.machine, when: ctx.now(), r: 'ok' });
                  ctx.toast(`Agent removed from ${a.machine}`, 'ok');
                  remove.close();
                  drawer.close();
                }}
              />
            );
          })()
        : null}
    </Page>
  );
}

const METHODS = {
  push: { title: 'Push from Aegis', note: 'Aegis installs over WinRM or SSH with a credential from the vault.', cmd: 'Choose machines and a vault credential; Aegis does the rest.' },
  script: { title: 'Run a one-line installer', note: 'Copy a command with a one-time token that expires in 24 h.', cmd: 'curl -fsSL https://aegis.host360.ai/agent/install.sh | sudo bash -s -- --token AGT-7Q2M-91XD --orchestrator aegis.host360.ai' },
  windows: { title: 'Windows installer (MSI)', note: 'For GPO, SCCM or Intune. The token is a property.', cmd: 'msiexec /i AegisAgent-4.2.0-x64.msi /qn TOKEN=AGT-7Q2M-91XD ORCHESTRATOR=aegis.host360.ai' },
  helm: { title: 'Kubernetes operator (Helm)', note: 'One operator per cluster protects every namespace you choose.', cmd: 'helm install aegis-operator oci://registry.host360.ai/charts/aegis-operator --version 4.2.0 --set token=AGT-7Q2M-91XD' }
} as const;

function DeployDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [m, setM] = useState<keyof typeof METHODS>('script');
  const [cust, setCust] = useState('h360');
  const copy = () => {
    navigator.clipboard?.writeText(METHODS[m].cmd).then(
      () => ctx.toast('Command copied. The token expires in 24 h.', 'ok'),
      () => ctx.toast('Copy is blocked here. Select the command and copy it yourself.', 'warn')
    );
  };
  return (
    <Dialog
      size="lg"
      title="Deploy agents"
      sub="New agents appear here after their first heartbeat and start on the Broad ring."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Close
          </Btn>
          {m === 'push' ? (
            <Btn kind="primary" icon="send" onClick={() => { ctx.startJob({ name: 'Agent push', object: '3 machines', product: 'Platform', phases: ['Connect', 'Copy installer', 'Install', 'First heartbeat', 'Done'], speed: 12, doneToast: 'Agents installed on 3 machines' }); onClose(); }}>
              Choose machines…
            </Btn>
          ) : (
            <Btn kind="primary" icon="copy" onClick={copy}>
              Copy command
            </Btn>
          )}
        </>
      }
    >
      <Field id="dp-cust" label="Customer" hint="The token ties new agents to this customer.">
        <SelectInput id="dp-cust" value={cust} onChange={setCust} options={[{ v: 'h360', label: 'Host360 Managed Services' }, { v: 'mer', label: 'Meridian Cooperative Bank' }, { v: 'kav', label: 'Kaveri Logistics Pvt Ltd' }, { v: 'sah', label: 'Sahyadri Hospitals' }]} />
      </Field>
      <div role="radiogroup" aria-label="Method" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(Object.keys(METHODS) as (keyof typeof METHODS)[]).map(k => (
          <RadioCard key={k} on={m === k} onClick={() => setM(k)} title={METHODS[k].title} note={METHODS[k].note} />
        ))}
      </div>
      {m !== 'push' ? <pre style={{ margin: 0, padding: '10px 12px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/20px var(--f-ui)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'all' }}>{METHODS[m].cmd}</pre> : null}
    </Dialog>
  );
}

function UpgradeWizard({ ctx, agents, closing, onClose, onStart }: { ctx: Ctx; agents: Agent[]; closing: boolean; onClose: () => void; onStart: (jobId: string) => void }) {
  const [step, setStep] = useState(0);
  const [when, setWhen] = useState<'window' | 'now'>('window');
  const [gate, setGate] = useState(true);
  const old = agents.filter(outdated);
  const blocked = old.filter(a => a.os.startsWith('CentOS'));
  const go = old.filter(a => !blocked.includes(a));
  const start = () => {
    const id = ctx.startJob({ name: `Agent upgrade to ${CURRENT_AGENT}`, object: plural(go.length, 'agent'), product: 'Platform', phases: ['Canary ring', 'Early ring', 'Broad ring', 'Done'], speed: 9, doneToast: `${plural(go.length, 'agent')} upgraded to ${CURRENT_AGENT}` });
    audit({ who: 'priya.raman', customer: 'h360', what: `Started a staged agent upgrade to ${CURRENT_AGENT}`, object: plural(go.length, 'agent'), when: ctx.now(), r: 'ok', note: when === 'window' ? 'Broad ring inside maintenance windows' : 'All rings now' });
    ctx.toast(`Upgrade to ${CURRENT_AGENT} started on the canary ring`, 'info');
    onStart(id);
  };
  return (
    <Wizard
      title={`Upgrade agents to ${CURRENT_AGENT}`}
      sub="Rings upgrade one after another; a ring starts only when the one before it is healthy."
      steps={['Which agents', 'Rings and timing', 'Review']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={
        step < 2 ? (
          <Btn kind="primary" iconAfter="chevron-right" disabled={!go.length} why="Every agent is up to date." onClick={() => setStep(step + 1)}>
            Next
          </Btn>
        ) : (
          <Btn kind="primary" icon="upload" perm={ctx.can('configure', 'Upgrading agents')} onClick={start}>
            Start upgrade
          </Btn>
        )
      }
    >
      {step === 0 ? (
        <>
          <MiniTable label="Agents to upgrade" cols={[{ label: 'Machine' }, { label: 'From', w: '96px' }, { label: 'Ring', w: '80px' }, { label: 'Customer', w: '200px' }]} rows={go.map(a => [<strong key="m" style={{ fontWeight: 600 }}>{a.machine}</strong>, a.version, a.ring, custName(a.customer)])} empty="Every agent in this scope runs the current version." />
          {blocked.length ? <Bar tone="info" multiline>{plural(blocked.length, 'agent')} stay on 4.0.8, the last version for CentOS 7: {blocked.map(a => a.machine).join(', ')}.</Bar> : null}
        </>
      ) : null}
      {step === 1 ? (
        <>
          <MiniTable label="Rings" cols={[{ label: 'Ring', w: '80px' }, { label: 'Share', w: '120px' }, { label: 'Rule' }]} rows={RINGS.map(r => [r.ring, r.share, r.rule])} />
          <div role="radiogroup" aria-label="Timing" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <RadioCard on={when === 'window'} onClick={() => setWhen('window')} title="Inside maintenance windows" note="Canary and Early now; Broad in each customer's window." />
            <RadioCard on={when === 'now'} onClick={() => setWhen('now')} title="As soon as each ring is healthy" note="Faster; agents restart outside windows." />
          </div>
          <CheckBox on={gate} onChange={setGate}>Pause the rollout if more than 2 % of a ring fails</CheckBox>
        </>
      ) : null}
      {step === 2 ? (
        <Facts items={[{ k: 'Agents', v: plural(go.length, 'agent') }, { k: 'Version', v: `${CURRENT_AGENT}, signed by Host360 (verified before install)` }, { k: 'Timing', v: when === 'window' ? 'Broad ring inside maintenance windows' : 'Each ring as soon as the last one is healthy' }, { k: 'Health gate', v: gate ? 'Pause above 2 % failures' : 'Off', muted: !gate }, { k: 'If it fails', v: 'The agent rolls back to its previous version by itself' }]} />
      ) : null}
    </Wizard>
  );
}
