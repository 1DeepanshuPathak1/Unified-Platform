import { useEffect, useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Icon } from '../../lib/Icon';
import { TIER_SHORT } from '../../data/platform';
import { Btn, CheckBox, Field, FilterInput, RadioCard, Seg, SelectFilter, Tabs } from '../../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Page, PageHeader, Panel, Spacer, Status, TableArea, Tiles, Toolbar, plural } from '../../ui/layout';
import { Dialog, Drawer, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, Go, inScope, scopeCustomers, showCustomerCol, TierTag } from '../../platform/common';
import { ASSESSED, band, bandLabel, findings, totalGB, type Assessed, type Finding } from './assess';
import { STAGE_LABEL } from './data';

type View = 'summary' | 'servers' | 'sizing' | 'risk';
const VIEWS: { v: View; label: string }[] = [
  { v: 'summary', label: 'Executive summary' },
  { v: 'servers', label: 'Servers' },
  { v: 'sizing', label: 'Sizing and cost' },
  { v: 'risk', label: 'Security and licensing' }
];
const fmtH = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`);
const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
const RISK_TONE = { Low: ['circle-check', 'ok'], Medium: ['triangle-alert', 'warn'], High: ['circle-alert', 'err'] } as const;
const SEV_TONE = { Low: ['info', 'tx'], Medium: ['triangle-alert', 'warn'], High: ['circle-alert', 'err'] } as const;

/**
 * Mobility › Assessment: what the discovery found and what it means: compatibility, readiness
 * and risk for every server, estimates for the copy and the downtime, right-sizing, and the
 * security and licensing questions to answer before the first wave. One report, four views.
 */
export default function Assessment({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<View>(VIEWS.some(v => v.v === ctx.tab) ? (ctx.tab as View) : 'summary');
  const exp = useClosable<boolean>();
  const [running, setRunning] = useState(false);
  const scope = scopeCustomers(ctx);
  const list = ASSESSED.filter(a => scope.includes(a.vm.customer) && inScope(ctx, a.vm.customer));
  const rerun = () => {
    setRunning(true);
    ctx.startJob({ name: 'Assessment', object: 'Chennai vCenter and esxi-edge-07', product: 'Migration', type: 'Assessment', phases: ['Inventory', 'Performance data (7 days)', 'Checks', 'Scores and estimates'], speed: 3, doneToast: 'Assessment updated: no change in readiness', firstLine: 'Reading the inventory from 2 sources' });
    window.setTimeout(() => setRunning(false), 4000);
  };
  return (
    <Page>
      <PageHeader
        kicker="Mobility"
        title="Assessment"
        sub="What the discovery found: which servers can move, how long it takes, what they should become, and what to settle first."
        meta={<span>{plural(list.length, 'server')} · 2 sources · 21 Oct, 15:30 IST</span>}
        actions={
          <>
            <Btn kind="outline" icon={running ? 'loader-circle' : 'refresh-cw'} spin={running} perm={ctx.can('operate', 'Running an assessment')} disabled={running} why="An assessment is running." onClick={rerun}>
              {running ? 'Assessing…' : 'Assess again'}
            </Btn>
            <Btn kind="primary" icon="download" onClick={() => exp.open(true)}>Export report…</Btn>
          </>
        }
      />
      <Tabs label="Report views" value={view} onChange={v => { setView(v); ctx.go(`mig/assessment/${v}`); }} style={{ margin: '0 24px 12px', padding: 0 }} tabs={VIEWS} />
      {view === 'summary' ? <Summary ctx={ctx} list={list} go={setView} /> : null}
      {view === 'servers' ? <Servers ctx={ctx} list={list} /> : null}
      {view === 'sizing' ? <Sizing ctx={ctx} list={list} /> : null}
      {view === 'risk' ? <Risks ctx={ctx} list={list} /> : null}
      {exp.value ? <ExportDialog ctx={ctx} view={view} closing={exp.closing} onClose={exp.close} /> : null}
    </Page>
  );
}

function Summary({ ctx, list, go }: { ctx: Ctx; list: Assessed[]; go: (v: View) => void }) {
  const left = list.filter(a => a.vm.stage !== 'committed');
  const ready = left.filter(a => a.ready >= 80);
  const work = left.filter(a => a.ready >= 50 && a.ready < 80);
  const blocked = left.filter(a => a.ready < 50);
  const down = left.reduce((a, x) => a + x.downtimeMin, 0);
  const weeks = Math.ceil(left.length / 6);
  const custs = [...new Set(list.map(a => a.vm.customer))];
  const blockers = Object.entries(
    left.flatMap(a => a.vm.checks.filter(c => c.level !== 'ok').map(c => ({ k: c.k, b: c.level === 'block', n: a.vm.name }))).reduce<Record<string, { n: string[]; b: number }>>((acc, c) => {
      const e = (acc[c.k] ||= { n: [], b: 0 });
      e.n.push(c.n);
      if (c.b) e.b++;
      return acc;
    }, {})
  ).sort((a, b) => b[1].b - a[1].b || b[1].n.length - a[1].n.length);
  const next = ready.filter(a => a.vm.stage === 'unplanned').sort((a, b) => (a.risk === b.risk ? totalGB(a.vm) - totalGB(b.vm) : a.risk === 'Low' ? -1 : 1));
  const f = findings(list);
  const w = (n: number) => `${(n / Math.max(1, left.length)) * 100}%`;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tiles
        items={[
          { label: 'Still to move', value: `${left.length}`, unit: 'servers', icon: 'server', sub: `${list.length - left.length} already committed` },
          { label: 'Ready to move', value: `${ready.length}`, icon: 'circle-check', tone: 'ok', sub: 'Readiness 80 or more' },
          { label: 'Need work', value: `${work.length}`, icon: 'triangle-alert', tone: work.length ? 'warn' : undefined, sub: 'Readiness 50 to 79' },
          { label: 'Blocked', value: `${blocked.length}`, icon: 'ban', tone: blocked.length ? 'err' : undefined, sub: blocked.map(a => a.vm.name).join(', ') || 'Nothing blocked' },
          { label: 'Downtime, all servers', value: fmtMin(down), icon: 'timer', sub: 'Sum of estimated cutover outages' },
          { label: 'Programme', value: `${weeks}`, unit: 'weeks', icon: 'calendar', sub: 'At 6 servers per weekend window' }
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Readiness" right={<Btn kind="ghost" size="sm" iconAfter="arrow-right" onClick={() => go('servers')}>Every server</Btn>}>
          <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div role="img" aria-label={`${ready.length} ready, ${work.length} need work, ${blocked.length} blocked`} style={{ display: 'flex', height: 12, gap: 2 }}>
              {ready.length ? <span tabIndex={0} data-tip={`Ready: ${ready.length}`} style={{ width: w(ready.length), background: 'var(--ok)' }} /> : null}
              {work.length ? <span tabIndex={0} data-tip={`Need work: ${work.length}`} style={{ width: w(work.length), background: 'var(--warn)' }} /> : null}
              {blocked.length ? <span tabIndex={0} data-tip={`Blocked: ${blocked.length}`} style={{ width: w(blocked.length), background: 'var(--err)' }} /> : null}
            </div>
            <div style={{ display: 'flex', gap: 16, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
              <Status icon="circle-check" tone="ok" label={`Ready ${ready.length}`} />
              <Status icon="triangle-alert" tone="warn" label={`Need work ${work.length}`} />
              <Status icon="ban" tone="err" label={`Blocked ${blocked.length}`} />
            </div>
            <MiniTable
              label="Readiness by customer"
              cols={[{ label: 'Customer' }, { label: 'To move', w: '72px', r: true }, { label: 'Ready', w: '64px', r: true }, { label: 'Need work', w: '84px', r: true }, { label: 'Blocked', w: '72px', r: true }, { label: 'Average', w: '72px', r: true }]}
              rows={custs.map(c => {
                const xs = left.filter(a => a.vm.customer === c);
                return [<strong key="c" style={{ fontWeight: 600 }}>{custName(c)}</strong>, String(xs.length), String(xs.filter(a => a.ready >= 80).length), String(xs.filter(a => a.ready >= 50 && a.ready < 80).length), String(xs.filter(a => a.ready < 50).length), xs.length ? String(Math.round(xs.reduce((s, a) => s + a.ready, 0) / xs.length)) : '—'];
              })}
            />
          </div>
        </Panel>
        <Panel title="What stands in the way" right={<Btn kind="ghost" size="sm" iconAfter="arrow-right" onClick={() => go('risk')}>Findings</Btn>}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {blockers.slice(0, 7).map(([k, e]) => (
              <li key={k} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid var(--ln)' }}>
                <Icon name={e.b ? 'ban' : 'triangle-alert'} style={{ color: e.b ? 'var(--err)' : 'var(--warn)' }} />
                <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={e.n.join(', ')}>
                  <span style={{ fontWeight: 600 }}>{k}</span> <span style={{ color: 'var(--tx-3)', font: '12px var(--f-ui)' }}>{e.n.slice(0, 3).join(', ')}{e.n.length > 3 ? ` and ${e.n.length - 3} more` : ''}</span>
                </span>
                <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)', fontVariantNumeric: 'tabular-nums' }}>{e.b ? `${e.b} blocked · ` : ''}{plural(e.n.length, 'server')}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title={<>Ready and not in a wave <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>lowest risk first</span></>} right={<Go ctx={ctx} to="mig/plans">Migration plans</Go>}>
          <div style={{ padding: '0 16px 4px' }}>
            <MiniTable
              label="Suggested next servers"
              cols={[{ label: 'Server' }, { label: 'Tier', w: '64px' }, { label: 'Size', w: '72px', r: true }, { label: 'First pass', w: '80px', r: true }, { label: 'Downtime', w: '80px', r: true }, { label: 'Risk', w: '90px' }]}
              rows={next.slice(0, 8).map(a => [<Go key="n" ctx={ctx} to="mig/sources" id={a.vm.id}>{a.vm.name}</Go>, TIER_SHORT[a.tier], `${(totalGB(a.vm) / 1024).toFixed(1)} TB`, fmtH(a.firstPassH), fmtMin(a.downtimeMin), <Status key="r" icon={RISK_TONE[a.risk][0]} tone={RISK_TONE[a.risk][1]} label={a.risk} />])}
              empty="Every ready server is already in a wave."
            />
          </div>
        </Panel>
        <Panel title="Licensing and cost">
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {f.filter(x => x.kind === 'Licensing').map(x => (
              <li key={x.id} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--ln)' }}>
                <Icon name={SEV_TONE[x.sev][0]} style={{ color: x.sev === 'Low' ? 'var(--tx-3)' : `var(--${SEV_TONE[x.sev][1]})`, marginTop: 2 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{x.title}</span>
                  <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{x.saving ? `Saves ${x.saving}` : plural(x.servers.length, 'server')}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function ScoreCell(n: number) {
  return { t: 'bar', pct: n, c: band(n), v: String(n) };
}

function Servers({ ctx, list }: { ctx: Ctx; list: Assessed[] }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'left' | 'all'>('left');
  const [risk, setRisk] = useState('Any risk');
  const drawer = useClosable<string>();
  useEffect(() => {
    if (ctx.openId && list.some(a => a.vm.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const ql = q.trim().toLowerCase();
  const rows = list.filter(a => (show === 'all' || a.vm.stage !== 'committed') && (risk === 'Any risk' || a.risk === risk.split(' ')[0]) && (!ql || `${a.vm.name} ${a.vm.os} ${custName(a.vm.customer)}`.toLowerCase().includes(ql)));
  const custCol = showCustomerCol(ctx);
  const d = drawer.value ? list.find(a => a.vm.id === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <Seg label="Show" value={show} onChange={setShow} options={[{ v: 'left', label: 'Still to move', count: list.filter(a => a.vm.stage !== 'committed').length }, { v: 'all', label: 'All', count: list.length }]} />
        <SelectFilter label="Risk" value={risk} onChange={setRisk} options={['Any risk', 'High risk', 'Medium risk', 'Low risk']} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter by server, OS or customer" label="Filter servers" />
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Assessed servers"
          cols={[
            { k: 'n', label: 'Server', w: 'minmax(150px,1.3fr)' },
            ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(130px,1fr)', dim: true }] : []),
            { k: 'os', label: 'Guest OS', w: 'minmax(150px,1.2fr)', dim: true },
            { k: 'tier', label: 'Tier', w: '70px' },
            { k: 'compat', label: 'Compatibility', w: '140px' },
            { k: 'ready', label: 'Readiness', w: '140px' },
            { k: 'risk', label: 'Risk', w: '100px' },
            { k: 'fp', label: 'First pass', w: '96px', r: true },
            { k: 'dt', label: 'Downtime', w: '96px', r: true }
          ]}
          rows={rows.map(a => ({
            id: a.vm.id,
            n: { v: a.vm.name, strong: true, tip: STAGE_LABEL[a.vm.stage] },
            cust: custName(a.vm.customer),
            os: a.vm.os,
            tier: { v: TIER_SHORT[a.tier], tip: a.tier, s: ['Mission Critical', 'Business Critical', 'Important', 'Standard'].indexOf(a.tier) },
            compat: { ...ScoreCell(a.compat), s: a.compat },
            ready: { ...ScoreCell(a.ready), s: a.ready },
            risk: { t: 'status', i: RISK_TONE[a.risk][0], c: RISK_TONE[a.risk][1], l: a.risk, tip: a.riskWhy.join('; ') || 'Nothing raises the risk', s: ['Low', 'Medium', 'High'].indexOf(a.risk) },
            fp: { v: fmtH(a.firstPassH), s: a.firstPassH },
            dt: { v: fmtMin(a.downtimeMin), s: a.downtimeMin }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['server', 'servers']}
          filtered={!!ql || risk !== 'Any risk' || show !== 'left'}
          onClear={() => { setQ(''); setRisk('Any risk'); setShow('left'); }}
          emptyText="Nothing assessed yet. Add a VMware source; its servers are assessed as soon as the inventory is read."
          footR="Copy rate 190 MB/s through aegis-proxy-chn-01"
          sort="ready"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Server assessment"
          kicker={`Assessment · ${d.vm.source}`}
          title={d.vm.name}
          status={<><TierTag tier={d.tier} /><span>{STAGE_LABEL[d.vm.stage]}</span><span>{d.vm.os}</span></>}
          actions={
            <>
              <Btn kind="outline" icon="radar" onClick={() => { drawer.close(); ctx.go('mig/sources', d.vm.id); }}>Open in the inventory</Btn>
              {d.vm.stage !== 'unplanned' && d.vm.stage !== 'excluded' ? <Btn kind="outline" icon="server" onClick={() => { drawer.close(); ctx.go('mig/servers', d.vm.name); }}>Open the migration</Btn> : null}
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <DrawerTiles
              items={[
                { label: 'Compatibility', value: String(d.compat), icon: d.compat >= 80 ? 'circle-check' : d.compat >= 50 ? 'triangle-alert' : 'ban', tone: band(d.compat), sub: bandLabel(d.compat) },
                { label: 'Readiness', value: String(d.ready), icon: d.ready >= 80 ? 'circle-check' : d.ready >= 50 ? 'triangle-alert' : 'ban', tone: band(d.ready), sub: bandLabel(d.ready) },
                { label: 'Risk', value: d.risk, icon: RISK_TONE[d.risk][0], tone: RISK_TONE[d.risk][1], sub: d.riskWhy[0] || 'Nothing raises it' }
              ]}
            />
            <MiniTable
              label="Score breakdown"
              cols={[{ label: 'What lowers the score' }, { label: 'Score', w: '110px' }, { label: 'Points', w: '56px', r: true }]}
              rows={d.deductions.map(x => [<span key="w" data-tip={x.what} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.what}</span>, x.score, `−${x.pts}`])}
              empty="Nothing lowers the score: supported OS, change tracking on, current Tools, no snapshots."
            />
            <Facts
              items={[
                { k: 'First pass', v: `${fmtH(d.firstPassH)} for ${(totalGB(d.vm) / 1024).toFixed(2)} TB at 190 MB/s` },
                { k: 'Cutover downtime', v: `About ${fmtMin(d.downtimeMin)}: final sync, ${d.vm.os.startsWith('Windows') ? 'VirtIO driver injection, ' : ''}first boot${/sql|oracle|db/i.test(d.vm.name) ? ', database consistency check' : ''}` },
                { k: 'Used over 7 days', v: `CPU ${d.p95cpu} % and memory ${d.p95mem} % at the 95th percentile` },
                { k: 'Now', v: `${d.vm.cpu} vCPU · ${d.vm.mem} GB · ${d.vm.disks.length} disks, ${totalGB(d.vm).toLocaleString('en-IN')} GB provisioned, ${d.usedGB.toLocaleString('en-IN')} GB used` },
                { k: 'Recommended', v: `${d.rec.label}${d.vm.dest ? ` on ${d.vm.dest}` : ''}` },
                ...(d.riskWhy.length ? [{ k: 'Risk because', v: d.riskWhy.join('; ') }] : [])
              ]}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

function Sizing({ ctx, list }: { ctx: Ctx; list: Assessed[] }) {
  const [only, setOnly] = useState<'all' | 'over'>('over');
  const left = list.filter(a => a.vm.stage !== 'committed');
  const over = (a: Assessed) => a.rec.cpu < a.vm.cpu || a.rec.mem < a.vm.mem;
  const rows = left.filter(a => only === 'all' || over(a));
  const cpuNow = left.reduce((s, a) => s + a.vm.cpu, 0);
  const cpuRec = left.reduce((s, a) => s + a.rec.cpu, 0);
  const memNow = left.reduce((s, a) => s + a.vm.mem, 0);
  const memRec = left.reduce((s, a) => s + a.rec.mem, 0);
  const prov = left.reduce((s, a) => s + totalGB(a.vm), 0);
  const used = left.reduce((s, a) => s + a.usedGB, 0);
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'vCPU', value: `${cpuNow} → ${cpuRec}`, icon: 'cpu', sub: `${Math.round((1 - cpuRec / cpuNow) * 100)} % fewer after right-sizing` },
            { label: 'Memory', value: `${memNow.toLocaleString('en-IN')} → ${memRec.toLocaleString('en-IN')}`, unit: 'GB', icon: 'layers', sub: `${Math.round((1 - memRec / memNow) * 100)} % less` },
            { label: 'Storage to copy', value: (used / 1024).toFixed(1), unit: 'TB', icon: 'hard-drive', sub: `Of ${(prov / 1024).toFixed(1)} TB provisioned; thin at the destination` },
            { label: 'Destination headroom', value: '41', unit: '%', icon: 'gauge', tone: 'ok', sub: 'Chennai-proxmox-prod 384 cores, production-openstack 256 vCPU' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={only} onChange={setOnly} options={[{ v: 'over', label: 'Oversized', count: left.filter(over).length }, { v: 'all', label: 'All', count: left.length }]} />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Sized for the 95th percentile with 30 % CPU and 20 % memory headroom</span>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Sizing"
          cols={[
            { k: 'n', label: 'Server', w: 'minmax(150px,1.3fr)' },
            { k: 'dest', label: 'Destination', w: 'minmax(150px,1.2fr)', dim: true },
            { k: 'now', label: 'Now', w: '130px', r: true },
            { k: 'cpu', label: 'CPU p95', w: '120px' },
            { k: 'mem', label: 'Memory p95', w: '120px' },
            { k: 'rec', label: 'Recommended', w: 'minmax(180px,1.4fr)' },
            { k: 'disk', label: 'Disk used', w: '110px', r: true }
          ]}
          rows={rows.map(a => ({
            id: a.vm.id,
            n: { v: a.vm.name, strong: true },
            dest: a.vm.dest || { v: 'Not mapped', muted: true },
            now: `${a.vm.cpu} vCPU · ${a.vm.mem} GB`,
            cpu: { t: 'bar', pct: a.p95cpu, c: a.p95cpu > 80 ? 'warn' : 'run', v: `${a.p95cpu} %` },
            mem: { t: 'bar', pct: a.p95mem, c: a.p95mem > 85 ? 'warn' : 'run', v: `${a.p95mem} %` },
            rec: over(a) ? { v: a.rec.label, strong: true, tip: `Down from ${a.vm.cpu} vCPU and ${a.vm.mem} GB` } : { v: `${a.rec.label} (unchanged)`, muted: true },
            disk: { v: `${a.usedGB.toLocaleString('en-IN')} GB`, s: a.usedGB }
          }))}
          state={ctx.ui}
          unit={['server', 'servers']}
          filtered={only !== 'all'}
          onClear={() => setOnly('all')}
          emptyText="Nothing to size: every server is already migrated."
          footR="Applied as the default at cutover; change it per server in Mappings"
        />
      </TableArea>
    </>
  );
}

function Risks({ ctx, list }: { ctx: Ctx; list: Assessed[] }) {
  const [kind, setKind] = useState<'all' | Finding['kind']>('all');
  const drawer = useClosable<string>();
  const all = findings(list);
  const rows = all.filter(f => kind === 'all' || f.kind === kind);
  const d = drawer.value ? all.find(f => f.id === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <Seg label="Kind" value={kind} onChange={setKind} options={[{ v: 'all', label: 'All', count: all.length }, ...(['Security', 'Licensing', 'Operations'] as const).map(k => ({ v: k, label: k, count: all.filter(f => f.kind === k).length }))]} />
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Findings"
          cols={[{ k: 'sev', label: 'Severity', w: '110px' }, { k: 't', label: 'Finding', w: 'minmax(260px,2.5fr)' }, { k: 'k', label: 'Kind', w: '110px', dim: true }, { k: 'n', label: 'Servers', w: '90px', r: true }, { k: 'save', label: 'Saving', w: '160px', r: true }]}
          rows={rows.map(f => ({
            id: f.id,
            sev: { t: 'status', i: SEV_TONE[f.sev][0], c: SEV_TONE[f.sev][1], l: f.sev, s: ['Low', 'Medium', 'High'].indexOf(f.sev) },
            t: { v: f.title, strong: true, tip: f.advice },
            k: f.kind,
            n: { v: String(f.servers.length), s: f.servers.length },
            save: f.saving ? f.saving : { v: '—', muted: true }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['finding', 'findings']}
          filtered={kind !== 'all'}
          onClear={() => setKind('all')}
          emptyText="No findings. Nothing about security or licensing needs settling before the first wave."
          sort="sev"
          dir={-1}
        />
      </TableArea>
      {d ? (
        <Drawer label="Finding" kicker={`${d.kind} · ${d.sev}`} title={d.title} status={<span>{plural(d.servers.length, 'server')}</span>} closing={drawer.closing} onClose={drawer.close}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Bar tone={d.sev === 'High' ? 'err' : d.sev === 'Medium' ? 'warn' : 'info'} multiline>{d.advice}</Bar>
            {d.saving ? <Facts items={[{ k: 'Saving', v: d.saving }, { k: 'Renewal', v: 'VMware vSphere Foundation, 30 Jun 2027' }]} /> : null}
            <MiniTable
              label="Servers affected"
              cols={[{ label: 'Server' }, { label: 'Guest OS', w: '200px' }, { label: 'Stage', w: '140px' }]}
              rows={d.servers.map(n => {
                const a = list.find(x => x.vm.name === n)!;
                return [<Go key="n" ctx={ctx} to="mig/assessment/servers" id={a.vm.id}>{n}</Go>, a.vm.os, STAGE_LABEL[a.vm.stage]];
              })}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

function ExportDialog({ ctx, view, closing, onClose }: { ctx: Ctx; view: View; closing: boolean; onClose: () => void }) {
  const [views, setViews] = useState<Record<View, boolean>>({ summary: true, servers: view === 'servers', sizing: view === 'sizing', risk: view === 'risk' });
  const [fmt, setFmt] = useState<'pdf' | 'xlsx'>('pdf');
  const [brand, setBrand] = useState<'host360' | 'customer'>('host360');
  const n = Object.values(views).filter(Boolean).length;
  return (
    <Dialog
      title="Export the assessment"
      sub="The report as it stands at 21 Oct 2026, 15:30 IST."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="download" disabled={!n} why="Pick at least one view." onClick={() => { ctx.toast(`assessment-2026-10-21.${fmt} is ready (${plural(n, 'view')})`, 'ok'); onClose(); }}>Export</Btn></>}
    >
      <Field label="Views">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {VIEWS.map(v => <CheckBox key={v.v} on={views[v.v]} onChange={x => setViews(s => ({ ...s, [v.v]: x }))}>{v.label}</CheckBox>)}
        </div>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={fmt === 'pdf'} onClick={() => setFmt('pdf')} icon="file-text" title="PDF" note="For the steering committee; charts and findings" />
        <RadioCard on={fmt === 'xlsx'} onClick={() => setFmt('xlsx')} icon="list" title="Excel workbook" note="One sheet per view, every server and score" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={brand === 'host360'} onClick={() => setBrand('host360')} title="Host360 branding" note="Logo, footer and contact" />
        <RadioCard on={brand === 'customer'} onClick={() => setBrand('customer')} title="No provider branding" note="For partners who resell; their logo from Branding" />
      </div>
    </Dialog>
  );
}
