import { useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Btn, Field, Seg, SelectInput, Tabs, Toggle } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Spacer, TableArea, Tiles, Toolbar } from '../../ui/layout';
import { Dialog, Drawer, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import AegisOverview from '../../screens/AegisOverview';
import { custName, inScope, showCustomerCol } from '../../platform/common';
import { audit } from '../../platform/store';

type VState = 'Verified' | 'Booted, app check failed' | 'Did not boot' | 'Scheduled';
interface Run { id: string; workload: string; customer: string; tier: string; point: string; ran: string; boot: string; checks: [string, 'ok' | 'err' | 'skip'][]; state: VState; rto: string; note?: string }
/** Last night's restore tests: each point is booted in an isolated sandbox, checked, timed and deleted. */
const RUNS: Run[] = [
  { id: 'v1', workload: 'sql-prod-02', customer: 'h360', tier: 'Tier 0', point: '21 Oct, 02:00', ran: '21 Oct, 03:10', boot: '1 min 52 s', checks: [['Console at login screen', 'ok'], ['Port 1433 answers', 'ok'], ['SELECT 1 on ERP_LEDGER', 'ok'], ['DBCC CHECKDB (sampled)', 'ok']], state: 'Verified', rto: '6 min 10 s' },
  { id: 'v2', workload: 'erp-db-01', customer: 'h360', tier: 'Tier 0', point: '21 Oct, 02:00', ran: '21 Oct, 03:14', boot: '2 min 05 s', checks: [['Console at login screen', 'ok'], ['PostgreSQL accepts connections', 'ok'], ['ERP_LEDGER row count within 1 %', 'ok']], state: 'Verified', rto: '7 min 40 s' },
  { id: 'v3', workload: 'ad-dc-01', customer: 'h360', tier: 'Tier 0', point: '21 Oct, 02:00', ran: '21 Oct, 03:20', boot: '2 min 30 s', checks: [['Console at login screen', 'ok'], ['LDAP 389 answers', 'ok'], ['dcdiag (sandbox, replication skipped)', 'ok']], state: 'Verified', rto: '5 min 02 s' },
  { id: 'v4', workload: 'web-frontend-01', customer: 'h360', tier: 'Tier 2', point: '21 Oct, 02:14', ran: '21 Oct, 03:31', boot: '1 min 20 s', checks: [['Console at login screen', 'ok'], ['HTTP /health returns 200', 'ok']], state: 'Verified', rto: '3 min 55 s' },
  { id: 'v5', workload: 'file-srv-03', customer: 'h360', tier: 'Tier 1', point: '20 Oct, 02:00', ran: '21 Oct, 03:40', boot: '—', checks: [['Console at login screen', 'skip']], state: 'Scheduled', rto: '—', note: 'The 21 Oct point is suspect (TH-0091), so the 20 Oct point is tested instead at 04:30.' },
  { id: 'v6', workload: 'mail-gw-01', customer: 'h360', tier: 'Tier 1', point: '21 Oct, 02:00', ran: '21 Oct, 03:45', boot: '1 min 40 s', checks: [['Console at login screen', 'ok'], ['SMTP 25 answers', 'err']], state: 'Booted, app check failed', rto: '—', note: 'Postfix did not start: /var/spool/postfix on a second disk that the sandbox did not attach. Fixed in the test profile; retest tonight.' },
  { id: 'v7', workload: 'his-db-01', customer: 'sah', tier: 'Tier 0', point: '21 Oct, 01:00', ran: '21 Oct, 02:10', boot: '3 min 10 s', checks: [['Console at login screen', 'ok'], ['PostgreSQL accepts connections', 'ok'], ['his_emr: last admission today', 'ok']], state: 'Verified', rto: '9 min 25 s' },
  { id: 'v8', workload: 'kav-wms-db', customer: 'kav', tier: 'Tier 1', point: '21 Oct, 01:00', ran: '21 Oct, 02:40', boot: '—', checks: [['Console at login screen', 'err']], state: 'Did not boot', rto: '—', note: 'Stopped at the GRUB prompt: the kernel in the point predates the VirtIO SCSI controller of the sandbox. Retest with SATA queued.' }
];
const ST: Record<VState, [string, string]> = { Verified: ['badge-check', 'ok'], 'Booted, app check failed': ['triangle-alert', 'warn'], 'Did not boot': ['circle-x', 'err'], Scheduled: ['clock', 'tx'] };

/** Protection › Overview: the original overview and restore verification, as tabs. */
export function OverviewPage({ ctx }: { ctx: Ctx }) {
  const tab = ctx.tab === 'verification' ? 'verification' : 'summary';
  const tabs = (
    <Tabs
      label="Overview sections"
      value={tab}
      onChange={t => ctx.go(t === 'summary' ? 'overview' : 'overview/verification')}
      tabs={[{ v: 'summary', label: 'Summary' }, { v: 'verification', label: 'Restore verification', tip: 'Recovery points booted and checked every night, with a proof report' }]}
      style={{ margin: '0 24px 12px', padding: 0 }}
    />
  );
  if (tab === 'summary') return <AegisOverview ctx={ctx} tabs={tabs} />;
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
      <div style={{ flex: 'none', padding: '20px 24px 16px' }}>
        <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: 4 }}>Protection</div>
        <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Overview</h1>
        <p style={{ marginTop: 2, color: 'var(--tx-2)' }}>Proof that backups restore: points booted in a sandbox every night, checked and timed.</p>
      </div>
      {tabs}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-fade 150ms var(--ease)' }}>
        <VerificationView ctx={ctx} />
      </div>
    </div>
  );
}

function VerificationView({ ctx }: { ctx: Ctx }) {
  const [show, setShow] = useState<'all' | 'failed'>('all');
  const drawer = useClosable<string>();
  const sched = useClosable<boolean>();
  const all = RUNS.filter(r => inScope(ctx, r.customer));
  const bad = (r: Run) => r.state === 'Did not boot' || r.state === 'Booted, app check failed';
  const rows = all.filter(r => show === 'all' || bad(r));
  const d = drawer.value ? all.find(r => r.id === drawer.value) : null;
  const custCol = showCustomerCol(ctx);
  const ok = all.filter(r => r.state === 'Verified').length;
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Verified last night', value: String(ok), unit: `of ${all.length}`, icon: 'badge-check', tone: all.some(bad) ? 'warn' : 'ok', sub: 'Booted, checked and deleted in the sandbox' },
            { label: 'Failed', value: String(all.filter(bad).length), icon: 'circle-x', tone: all.some(bad) ? 'err' : 'ok', sub: 'Each one opened a finding and a retest' },
            { label: 'Measured restore time', value: 'Within SLA', icon: 'timer', tone: 'ok', sub: 'Tier 0 worst 9 min 25 s against 1 h' },
            { label: 'Coverage', value: '100 %', icon: 'circle-check', tone: 'ok', sub: 'Tier 0 nightly · Tier 1 weekly · others monthly' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={show} onChange={setShow} options={[{ v: 'all', label: 'Last night', count: all.length }, { v: 'failed', label: 'Failed', count: all.filter(bad).length }]} />
        <Spacer />
        <Btn kind="ghost" icon="download" onClick={() => ctx.toast('verification-proof-2026-10-21.pdf downloaded: every test with screenshots, checks and timings, signed', 'ok')}>Proof report</Btn>
        <Btn kind="outline" icon="calendar-clock" perm={ctx.can('configure', 'Changing the verification schedule')} onClick={() => sched.open(true)}>Schedule…</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Restore verification"
          cols={[
            { k: 'w', label: 'Workload', w: 'minmax(150px,1.2fr)' },
            ...(custCol ? [{ k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true }] : []),
            { k: 't', label: 'Tier', w: '70px', dim: true },
            { k: 'p', label: 'Point tested', w: '120px' },
            { k: 'b', label: 'Boot', w: '100px', r: true },
            { k: 'ch', label: 'Checks', w: '90px', r: true },
            { k: 'rto', label: 'Restore time', w: '110px', r: true },
            { k: 's', label: 'Result', w: 'minmax(170px,1fr)' }
          ]}
          rows={rows.map(r => ({
            id: r.id,
            w: { v: r.workload, strong: true },
            c: custName(r.customer),
            t: r.tier,
            p: r.point,
            b: r.boot,
            ch: { v: `${r.checks.filter(c => c[1] === 'ok').length} of ${r.checks.length}`, s: r.checks.filter(c => c[1] === 'ok').length },
            rto: r.rto,
            s: { t: 'status', i: ST[r.state][0], c: ST[r.state][1], l: r.state, tip: r.note }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['test', 'tests']}
          filtered={show !== 'all'}
          onClear={() => setShow('all')}
          emptyText="Nothing failed last night."
          footR="Sandbox: isolated network, no route to production; each test is deleted after its screenshot"
        />
      </TableArea>
      {d ? (
        <Drawer label="Restore test" kicker={`Restore verification · ${custName(d.customer)} · ${d.tier}`} title={d.workload} status={<><span>Point {d.point}</span><span>Tested {d.ran}</span></>} actions={<Btn kind="outline" icon="play" perm={ctx.can('operate', 'Running a restore test')} onClick={() => { ctx.startJob({ name: 'Restore test', object: d.workload, product: 'Backup', phases: ['Queued', 'Boot in the sandbox', 'Run checks', 'Screenshot', 'Delete', 'Done'], speed: 18, rate: '—' }); ctx.toast(`Restore test of ${d.workload} started`, 'info'); }}>Test again now</Btn>} closing={drawer.closing} onClose={drawer.close}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.note ? <Bar tone={d.state === 'Scheduled' ? 'info' : d.state === 'Did not boot' ? 'err' : 'warn'} multiline>{d.note}</Bar> : null}
            <DrawerTiles items={[{ label: 'Result', value: d.state === 'Booted, app check failed' ? 'App check failed' : d.state, icon: ST[d.state][0], tone: ST[d.state][1] }, { label: 'Boot', value: d.boot }, { label: 'Restore time', value: d.rto, sub: 'From start to the last check' }]} />
            <MiniTable label="Checks" cols={[{ label: 'Check' }, { label: 'Result', w: '120px' }]} rows={d.checks.map(([c, r]) => [c, r === 'ok' ? 'Passed' : r === 'err' ? <span key="r" style={{ color: 'var(--err)' }}>Failed</span> : 'Not run'])} />
            <Facts items={[{ k: 'Sandbox', v: 'verify-bubble on production-openstack: no route out, DNS answers only for the test' }, { k: 'Evidence', v: 'Console screenshot, check output and timings, kept with the point and in Evidence packs' }, { k: 'On the point', v: d.state === 'Verified' ? 'Marked Verified in Recovery points' : 'Not marked Verified' }]} />
          </div>
        </Drawer>
      ) : null}
      {sched.value ? <ScheduleDialog ctx={ctx} closing={sched.closing} onClose={sched.close} /> : null}
    </>
  );
}

function ScheduleDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [t0, setT0] = useState('Every night');
  const [t1, setT1] = useState('Weekly, Sunday');
  const [rest, setRest] = useState('Monthly, a random sample of 10 %');
  const [win, setWin] = useState('02:00 to 05:00 IST');
  const [risk, setRisk] = useState(true);
  return (
    <Dialog title="Verification schedule" sub="How often each tier’s newest point is booted and checked." closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Changed the restore verification schedule', object: 'Every customer', when: ctx.now(), r: 'ok', after: [['Tier 0', t0], ['Tier 1', t1], ['Others', rest], ['Window', win]] }); ctx.toast('Verification schedule saved', 'ok'); onClose(); }}>Save</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="vs-0" label="Tier 0"><SelectInput id="vs-0" value={t0} onChange={setT0} options={['Every night', 'Every 12 h']} /></Field>
        <Field id="vs-1" label="Tier 1"><SelectInput id="vs-1" value={t1} onChange={setT1} options={['Every night', 'Weekly, Sunday', 'Monthly']} /></Field>
        <Field id="vs-r" label="Other tiers"><SelectInput id="vs-r" value={rest} onChange={setRest} options={['Monthly, a random sample of 10 %', 'Monthly, every workload', 'Quarterly']} /></Field>
        <Field id="vs-w" label="Window"><SelectInput id="vs-w" value={win} onChange={setWin} options={['02:00 to 05:00 IST', '22:00 to 02:00 IST', 'Any time, at most 4 at once']} /></Field>
      </div>
      <Toggle on={risk} onChange={setRisk} label="Risk-based testing">Test more often when a workload changed a lot, failed its last test, or has an open threat detection</Toggle>
    </Dialog>
  );
}
