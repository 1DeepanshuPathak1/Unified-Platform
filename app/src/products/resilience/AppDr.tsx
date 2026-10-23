import { useState } from 'react';
import { Btn, Field, RadioCard, SelectInput } from '../../ui/controls';
import { Bar, Facts, MiniTable, Panel, Status, Tiles } from '../../ui/layout';
import { Dialog, StepUp, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope } from '../../platform/common';
import { audit } from '../../platform/store';

/* ------------------------------------------------------------------ Database-native and Kubernetes DR */

interface Db { id: string; name: string; customer: string; engine: string; primary: string; standby: string; mode: 'Synchronous' | 'Asynchronous'; lag: string; lagOk: boolean; tested: string; licence: string; licOk: boolean }
const DBS: Db[] = [
  { id: 'd1', name: 'ERP-AG', customer: 'h360', engine: 'SQL Server Always On availability group', primary: 'sql-prod-02 (Chennai-proxmox-prod)', standby: 'sql-prod-02-dr (production-openstack)', mode: 'Asynchronous', lag: '3 s', lagOk: true, tested: '18 Oct, switchover and back in 2 min 40 s', licence: 'Passive replica covered by Software Assurance failover rights', licOk: true },
  { id: 'd2', name: 'TREASURY', customer: 'mer', engine: 'Oracle Data Guard, maximum availability', primary: 'mum-oracle-phy-01 (Mumbai DC2)', standby: 'trs-ora-stby (production-openstack)', mode: 'Synchronous', lag: '0 s apply, 0 s transport', lagOk: true, tested: '14 Aug, switchover 6 min', licence: 'Standby needs Enterprise Edition on 8 cores: 8 licensed', licOk: true },
  { id: 'd3', name: 'his_emr', customer: 'sah', engine: 'PostgreSQL 15 streaming replication', primary: 'his-db-01 (Pune)', standby: 'his-db-stby (Host360 Mumbai)', mode: 'Asynchronous', lag: '1.2 s replay', lagOk: true, tested: 'Never', licence: 'No licence needed', licOk: true },
  { id: 'd4', name: 'notify-rs', customer: 'mer', engine: 'MongoDB 7 replica set', primary: '2 members in production-openstack', standby: '1 hidden member in region-2-os', mode: 'Asynchronous', lag: '41 s', lagOk: false, tested: '28 Sep, member promoted in 50 s', licence: 'Community edition', licOk: true },
  { id: 'd5', name: 'cards-db', customer: 'mer', engine: 'MySQL 8 InnoDB ClusterSet', primary: 'cards-db-01..03 (production-openstack)', standby: 'cards-db-dr-01 (region-2-os)', mode: 'Asynchronous', lag: '2 s', lagOk: true, tested: '28 Sep', licence: 'MySQL Enterprise: DR replica counts as one server; 3 of 4 used', licOk: true }
];
const K8S = [
  { ns: 'payments', from: 'mer-k8s-prod', to: 'mer-k8s-dr (region-2-os)', how: 'Resources every 5 min; volumes by Ceph RBD mirroring', lag: '38 s', state: 'ok' },
  { ns: 'upi', from: 'mer-k8s-prod', to: 'mer-k8s-dr (region-2-os)', how: 'Resources every 5 min; no volumes', lag: '2 min', state: 'ok' },
  { ns: 'ledger', from: 'mer-k8s-prod', to: 'mer-k8s-dr (region-2-os)', how: 'Resources every 5 min; Kafka by MirrorMaker 2, offsets kept', lag: '4 s', state: 'ok' },
  { ns: 'auth', from: 'mer-k8s-prod', to: 'mer-k8s-dr (region-2-os)', how: 'Resources every 5 min; volumes by Ceph RBD mirroring', lag: '12 min', state: 'warn' }
];

/** Resilience › Protected servers › Databases and Kubernetes: DR the database or platform does itself, run from Aegis. */
export function AppDrView({ ctx }: { ctx: Ctx }) {
  const dbs = DBS.filter(d => inScope(ctx, d.customer));
  const k8s = inScope(ctx, 'mer') ? K8S : [];
  const act = useClosable<{ db: Db; kind: 'Switchover' | 'Failover' | 'Switch back' }>();
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tiles
        items={[
          { label: 'Databases', value: String(dbs.length), icon: 'database', sub: 'Replicated by the database itself; Aegis watches and switches' },
          { label: 'Behind', value: String(dbs.filter(d => !d.lagOk).length), icon: 'triangle-alert', tone: dbs.some(d => !d.lagOk) ? 'warn' : 'ok', sub: 'Lag above the plan’s RPO' },
          { label: 'Never switched over', value: String(dbs.filter(d => d.tested === 'Never').length), icon: 'flask-conical', tone: dbs.some(d => d.tested === 'Never') ? 'warn' : 'ok', sub: 'Test a switchover in the next drill' },
          { label: 'Kubernetes namespaces', value: String(k8s.length), icon: 'container', sub: k8s.length ? 'mer-k8s-prod → mer-k8s-dr' : 'None replicated' }
        ]}
      />
      <Panel title="Databases">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Database DR"
            cols={[{ label: 'Database', w: '100px' }, { label: 'Method', w: 'minmax(0,1.1fr)' }, { label: 'Standby at the DR site', w: 'minmax(0,1fr)' }, { label: 'Lag', w: '100px' }, { label: 'Licence at DR', w: 'minmax(0,0.9fr)' }, { label: '', w: '230px' }]}
            rows={dbs.map(d => [
              <strong key="n" style={{ fontWeight: 600 }} data-tip={`${custName(d.customer)} · primary ${d.primary}`}>{d.name}</strong>,
              <span key="m" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={`${d.engine} · ${d.mode}`} data-tip-overflow="">{d.engine}</span>,
              <span key="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={`${d.standby}. Last switchover: ${d.tested}`} data-tip-overflow="">{d.standby}</span>,
              d.lagOk ? <Status key="l" icon="circle-check" tone="ok" label={d.lag} tip={d.mode} /> : <Status key="l" icon="triangle-alert" tone="warn" label={d.lag} tip="Above the 30 s target of Meridian Tier-1 replication" />,
              <span key="c" style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--tx-2)' }} data-tip={d.licence} data-tip-overflow="">{d.licence}</span>,
              <span key="a" style={{ display: 'flex', gap: 4 }}>
                <Btn kind="ghost" size="sm" icon="refresh-cw" perm={ctx.can('operate', 'Switching over')} onClick={() => act.open({ db: d, kind: 'Switchover' })}>Switchover</Btn>
                <Btn kind="ghost" size="sm" icon="zap" perm={ctx.can('operate', 'Failing over')} onClick={() => act.open({ db: d, kind: 'Failover' })}>Fail over</Btn>
              </span>
            ])}
            empty="No database is replicated natively for this customer."
          />
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Recovery plans can include a database switchover as a step; the database’s own tools do the work, Aegis checks the standby, runs them and records the result.</p>
        </div>
      </Panel>
      {k8s.length ? (
        <Panel title="Kubernetes namespaces">
          <div style={{ padding: '4px 16px 12px' }}>
            <MiniTable
              label="Kubernetes DR"
              cols={[{ label: 'Namespace', w: '120px' }, { label: 'To', w: '190px' }, { label: 'How', w: 'minmax(0,1fr)' }, { label: 'Lag', w: '110px' }]}
              rows={k8s.map(n => [<strong key="n" style={{ fontWeight: 600 }}>{n.ns}</strong>, n.to, <span key="h" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={n.how} data-tip-overflow="">{n.how}</span>, n.state === 'ok' ? <Status key="l" icon="circle-check" tone="ok" label={n.lag} /> : <Status key="l" icon="triangle-alert" tone="warn" label={n.lag} tip="Two Secrets fail to apply at the DR cluster: the sealed-secrets key differs" />])}
            />
            <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>At failover, workloads at the DR cluster are scaled up from 0 and ingress DNS moves with the recovery plan.</p>
          </div>
        </Panel>
      ) : null}
      {act.value ? <DbActionDialog ctx={ctx} db={act.value.db} kind={act.value.kind} closing={act.closing} onClose={act.close} /> : null}
    </div>
  );
}

function DbActionDialog({ ctx, db, kind, closing, onClose }: { ctx: Ctx; db: Db; kind: 'Switchover' | 'Failover' | 'Switch back'; closing: boolean; onClose: () => void }) {
  const [ok, setOk] = useState(false);
  const fo = kind === 'Failover';
  return (
    <Dialog
      title={`${kind}: ${db.name}`}
      sub={fo ? 'For when the primary is gone. The standby is opened as primary; changes not yet shipped are lost.' : 'The primary and the standby swap roles with no data lost. Applications reconnect through the listener or DNS.'}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind={fo ? 'dangerSolid' : 'primary'} icon={fo ? 'zap' : 'refresh-cw'} disabled={!ok} why="Confirm with your second factor first." onClick={() => { ctx.startJob({ name: `Database ${kind.toLowerCase()}`, object: db.name, product: 'DR', phases: ['Check the standby', fo ? 'Open the standby' : 'Swap roles', 'Move the listener', 'Check applications', 'Done'], speed: 20, rate: '—' }); audit({ who: 'priya.raman', customer: db.customer, what: `Started a database ${kind.toLowerCase()}`, object: db.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${kind} of ${db.name} started`, fo ? 'warn' : 'info'); onClose(); }}>{kind}</Btn></>}
    >
      <Facts labelW={120} items={[{ k: 'Method', v: db.engine }, { k: 'Now primary', v: db.primary }, { k: 'Becomes primary', v: db.standby }, { k: 'Lag', v: db.lag }, { k: 'Licence', v: db.licence }]} />
      {fo && db.mode === 'Asynchronous' ? <Bar tone="warn" multiline>Asynchronous: up to {db.lag} of committed transactions may be lost.</Bar> : null}
      <StepUp verified={ok} onVerified={() => setOk(true)} />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Witness and split-brain */

const PAIRS = [
  { pair: 'Chennai-proxmox-prod ↔ production-openstack', witness: 'witness-blr-01, Bengaluru', paths: 'MPLS 1 Gbit/s · IPsec over internet', hb: '1 s', fence: 'Power off through IPMI, then storage reservation', state: 'ok' },
  { pair: 'production-openstack ↔ region-2-os', witness: 'witness-blr-01, Bengaluru', paths: 'MPLS 1 Gbit/s · IPsec over internet', hb: '1 s', fence: 'Network isolation of the old primary’s VLANs, then Ceph blocklist', state: 'ok' },
  { pair: 'Chennai vCenter ↔ Chennai-proxmox-prod', witness: 'None (same building)', paths: 'Data centre LAN only', hb: '1 s', fence: 'Manual: confirm the old primary is down', state: 'warn' }
];
const EVENTS = [
  ['09 Oct, 02:00', 'production-openstack ↔ region-2-os', 'Both paths down 6 h. The witness saw both sites alive, so neither side promoted; replication resumed from the journal at 08:05.', 'ok'],
  ['28 Sep, 22:40', 'Chennai-proxmox-prod ↔ production-openstack', 'Drill: primary isolated on purpose. The witness agreed, the old primary was fenced by IPMI in 14 s, then the plan ran.', 'ok']
];

export function WitnessView({ ctx }: { ctx: Ctx }) {
  const [mode, setMode] = useState('Witness must agree before a replica becomes writable');
  const [scn, setScn] = useState<'link' | 'down'>('link');
  const test = useClosable<string>();
  return (
    <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Bar tone="info" multiline>Split brain is when both sites think they are the primary and both accept writes. Aegis prevents it with a witness in a third place and fences the old primary before a replica is opened for writing.</Bar>
      <Panel title="Site pairs">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Site pairs and witnesses"
            cols={[{ label: 'Sites', w: 'minmax(0,1.2fr)' }, { label: 'Witness', w: 'minmax(0,1fr)' }, { label: 'Heartbeat paths', w: 'minmax(0,1fr)' }, { label: 'Fencing', w: 'minmax(0,1.2fr)' }, { label: '', w: '200px' }]}
            rows={PAIRS.map(p => [
              <strong key="p" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={p.pair}>{p.pair}</strong>,
              p.witness,
              <span key="h" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={`${p.paths}; heartbeat every ${p.hb}`} data-tip-overflow="">{p.paths}</span>,
              <span key="f" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={p.fence} data-tip-overflow="">{p.fence}</span>,
              <span key="a" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {p.state === 'ok' ? <Status icon="circle-check" tone="ok" label="Protected" /> : <Status icon="triangle-alert" tone="warn" label="No witness" tip="Add a witness outside the building" />}
                <Btn kind="ghost" size="sm" icon="flask-conical" perm={ctx.can('operate', 'Testing fencing')} onClick={() => test.open(p.pair)}>Test</Btn>
              </span>
            ])}
          />
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Rule">
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field id="sb-m" label="Before a replica is opened for writing">
              <SelectInput id="sb-m" value={mode} onChange={v => { setMode(v); audit({ who: 'priya.raman', customer: 'h360', what: 'Changed the split-brain rule', object: 'Every site pair', when: ctx.now(), r: 'ok', after: [['Rule', v]] }); ctx.toast('Split-brain rule saved', 'ok'); }} options={['Witness must agree before a replica becomes writable', 'Witness must agree, or a person confirms the old primary is down', 'A person always confirms']} />
            </Field>
            <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>A site that loses both its peer and the witness stops accepting writes on its replicas until one of them is back.</p>
          </div>
        </Panel>
        <Panel title="Partitions, last 90 days">
          <div style={{ padding: '4px 16px 12px' }}>
            <MiniTable label="Partition events" cols={[{ label: 'When', w: '110px' }, { label: 'What happened' }]} rows={EVENTS.map(([w, p, t]) => [w, <span key="t" style={{ whiteSpace: 'normal' }} data-tip={p}>{t}</span>])} />
          </div>
        </Panel>
      </div>
      {test.value ? (
        <Dialog title={`Test fencing: ${test.value}`} sub="Simulates a partition in the witness’s view only; no server is powered off and no replica is opened." closing={test.closing} onClose={test.close} footer={<><Btn kind="ghost" onClick={test.close}>Cancel</Btn><Btn kind="primary" icon="play" onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Tested split-brain fencing', object: test.value!, when: ctx.now(), r: 'ok' }); ctx.toast(scn === 'link' ? 'Fencing test passed: the witness refused promotion while both sites were alive' : 'Fencing test passed: the old primary would be fenced in 14 s, then the replica promoted (dry run)', 'ok'); test.close(); }}>Run the test</Btn></>}>
          <div role="radiogroup" aria-label="Scenario" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <RadioCard on={scn === 'link'} onClick={() => setScn('link')} icon="split" title="Link down, both sites up" note="Expected: no promotion" />
            <RadioCard on={scn === 'down'} onClick={() => setScn('down')} icon="power" title="Primary site down" note="Expected: fence, then promote" />
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
