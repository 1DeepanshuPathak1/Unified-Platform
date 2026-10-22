import { useEffect, useMemo, useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Icon } from '../../lib/Icon';
import { Btn, CheckBox, Field, Seg, SelectFilter, SelectInput, Tabs, TextInput } from '../../ui/controls';
import { Bar, Facts, MiniTable, Page, PageHeader, Panel, Spacer, Status, TableArea, Toolbar, plural } from '../../ui/layout';
import { Dialog, Drawer, useClosable } from '../../ui/overlay';
import { DepGraph } from '../../ui/DepGraph';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope, scopeCustomers, showCustomerCol } from '../../platform/common';
import { audit } from '../../platform/store';
import { BLACKOUTS, FLOWS, INVENTORY, IN_PROGRESS, STAGE_LABEL, SUGGESTED_APPS, WAVES, verdict, type Blackout, type SourceVm, type Wave } from './data';

type Tab = 'waves' | 'map' | 'calendar';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
/** 'Sun 25 Oct 2026, 22:00 to 02:00 IST' → '2026-10-25' */
const waveDay = (w: Wave) => {
  const m = w.window?.match(/(\d{2}) (\w{3}) (\d{4})/);
  return m ? `${m[3]}-${String(MON.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1]}` : null;
};
const isoLabel = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, dd);
  return `${DOW[dt.getDay()]} ${String(dd).padStart(2, '0')} ${MON[m - 1]} ${y}`;
};
const inBlackout = (customer: string, day: string | null, list: Blackout[]) => (day ? list.find(b => b.customer === customer && day >= b.from && day <= b.to) : undefined);
/** What a server needs: the servers it talks to as a client. */
const needs = (name: string) => FLOWS.filter(f => f.to === name).map(f => f.from);

/**
 * Mobility › Migration plans: waves with cutover windows and downtime budgets, the dependency
 * map that decides what moves together and in what order, and the calendar of blackout periods.
 */
export default function Plans({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<Tab>((['waves', 'map', 'calendar'] as Tab[]).includes(ctx.tab as Tab) ? (ctx.tab as Tab) : 'waves');
  useEffect(() => {
    if ((['waves', 'map', 'calendar'] as string[]).includes(ctx.tab)) setTab(ctx.tab as Tab);
  }, [ctx.tab]);
  const [waves, setWaves] = useState<Wave[]>(WAVES);
  const [member, setMember] = useState<Record<string, string | undefined>>({});
  const [blackouts, setBlackouts] = useState<Blackout[]>(BLACKOUTS);
  const [kept, setKept] = useState<string[]>([]);
  const create = useClosable<{ wave?: Wave; preset?: string[]; customer?: string }>();
  const addBo = useClosable<boolean>();
  const scope = scopeCustomers(ctx).filter(c => inScope(ctx, c));
  const inv = INVENTORY.filter(v => scope.includes(v.customer)).map(v => ({ ...v, wave: v.id in member ? member[v.id] : v.wave }));
  const ws = waves.filter(w => scope.includes(w.customer));
  const bos = blackouts.filter(b => scope.includes(b.customer));
  const cfg = ctx.can('configure', 'Planning waves');
  const go = (t: Tab) => { setTab(t); ctx.go(`mig/plans/${t}`); };
  return (
    <Page>
      <PageHeader
        kicker="Mobility"
        title="Migration plans"
        sub="Waves of servers with their cutover windows, the dependencies that decide what moves together and in what order, and the dates nothing may move."
        actions={
          <>
            <Btn kind="outline" icon="ban" perm={cfg} onClick={() => addBo.open(true)}>Add a blackout period</Btn>
            <Btn kind="primary" icon="plus" perm={cfg} onClick={() => create.open({})}>Create a wave</Btn>
          </>
        }
      />
      <Tabs label="Migration plans" value={tab} onChange={go} style={{ margin: '0 24px 12px', padding: 0 }} tabs={[{ v: 'waves', label: 'Waves', count: ws.length }, { v: 'map', label: 'Dependency map' }, { v: 'calendar', label: 'Calendar', count: bos.length }]} />
      {tab === 'waves' ? <WaveList ctx={ctx} waves={ws} inv={inv} blackouts={bos} onEdit={w => create.open({ wave: w })} /> : null}
      {tab === 'map' ? <MapView ctx={ctx} inv={inv} kept={kept} onKeep={id => setKept(k => [...k, id])} onPlan={(customer, preset) => create.open({ customer, preset })} /> : null}
      {tab === 'calendar' ? <CalendarView ctx={ctx} waves={ws} blackouts={bos} /> : null}
      {create.value ? (
        <WaveDialog
          ctx={ctx}
          wave={create.value.wave}
          preset={create.value.preset}
          customer={create.value.customer}
          inv={inv}
          waves={waves}
          blackouts={blackouts}
          kept={SUGGESTED_APPS.filter(s => kept.includes(s.id))}
          closing={create.closing}
          onClose={create.close}
          onSave={(w, servers) => {
            setWaves(x => (x.some(y => y.id === w.id) ? x.map(y => (y.id === w.id ? w : y)) : [...x, w]));
            setMember(m => {
              const n = { ...m };
              inv.filter(v => v.wave === (create.value?.wave?.name ?? w.name) && v.customer === w.customer && !servers.includes(v.id)).forEach(v => (n[v.id] = undefined));
              servers.forEach(id => (n[id] = w.name));
              return n;
            });
            audit({ who: 'priya.raman', customer: w.customer, what: create.value?.wave ? 'Changed a migration wave' : 'Created a migration wave', object: w.name, when: ctx.now(), r: 'ok', after: [['Window', w.window || 'Not set'], ['Servers', String(servers.length)]] });
            ctx.toast(`${w.name} ${create.value?.wave ? 'saved' : 'created'} with ${plural(servers.length, 'server')}`, 'ok');
            create.close();
          }}
        />
      ) : null}
      {addBo.value ? (
        <BlackoutDialog
          ctx={ctx}
          scope={scope}
          waves={waves}
          closing={addBo.closing}
          onClose={addBo.close}
          onSave={b => {
            setBlackouts(x => [...x, b]);
            audit({ who: 'priya.raman', customer: b.customer, what: 'Added a blackout period', object: b.name, when: ctx.now(), r: 'ok', after: [['From', b.from], ['To', b.to]] });
            ctx.toast(`${b.name} added; no cutover window can start inside it`, 'ok');
            addBo.close();
            go('calendar');
          }}
        />
      ) : null}
    </Page>
  );
}

function waveChecks(w: Wave, inv: SourceVm[], waves: Wave[]) {
  const mine = inv.filter(v => v.wave === w.name && v.customer === w.customer);
  const order = (name?: string) => (name ? waves.find(x => x.name === name && x.customer === w.customer) : undefined);
  const out: { server: string; dep: string; ok: boolean; text: string }[] = [];
  for (const v of mine) {
    for (const dep of needs(v.name)) {
      const d = inv.find(x => x.name === dep);
      if (!d) continue;
      if (d.stage === 'committed') out.push({ server: v.name, dep, ok: true, text: `${dep} is already migrated` });
      else if (d.wave === w.name) out.push({ server: v.name, dep, ok: true, text: `${dep} moves in the same wave` });
      else {
        const dw = order(d.wave);
        const before = dw && waveDay(dw) && waveDay(w) && waveDay(dw)! < waveDay(w)!;
        out.push(before ? { server: v.name, dep, ok: true, text: `${dep} moves earlier, in ${dw!.name}` } : { server: v.name, dep, ok: false, text: `${dep} ${d.wave ? `moves later, in ${d.wave}` : 'is in no wave'}; ${v.name} would lose it at cutover` });
      }
    }
  }
  return { mine, out };
}

function WaveList({ ctx, waves, inv, blackouts, onEdit }: { ctx: Ctx; waves: Wave[]; inv: SourceVm[]; blackouts: Blackout[]; onEdit: (w: Wave) => void }) {
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Servers');
  useEffect(() => {
    if (ctx.openId && waves.some(w => w.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const custCol = showCustomerCol(ctx);
  const d = drawer.value ? waves.find(w => w.id === drawer.value) : null;
  const dc = d ? waveChecks(d, inv, waves) : null;
  const bad = (w: Wave) => waveChecks(w, inv, waves).out.filter(c => !c.ok).length;
  return (
    <>
      <TableArea>
        <AegisTable
          label="Waves"
          cols={[
            { k: 'n', label: 'Wave', w: 'minmax(200px,1.4fr)' },
            ...(custCol ? [{ k: 'c', label: 'Customer', w: 'minmax(150px,1fr)', dim: true }] : []),
            { k: 's', label: 'Servers', w: '80px', r: true },
            { k: 'win', label: 'Cutover window', w: 'minmax(220px,1.5fr)' },
            { k: 'b', label: 'Downtime budget', w: '190px' },
            { k: 'dep', label: 'Dependencies', w: '170px' },
            { k: 'st', label: 'State', w: '150px' }
          ]}
          rows={waves.map(w => {
            const { mine } = waveChecks(w, inv, waves);
            const b = bad(w);
            const ready = mine.filter(v => v.stage === 'ready' || v.stage === 'committed').length;
            return {
              id: w.id,
              n: { v: w.name, strong: true },
              c: custName(w.customer),
              s: { v: String(mine.length), s: mine.length },
              win: w.window ? { v: w.window.replace(' 2026', ''), tip: w.window, s: waveDay(w) || '' } : { v: 'Not scheduled', muted: true, italic: true, s: 'zz' },
              b: { t: 'bar', pct: w.budgetMin ? (w.usedMin / w.budgetMin) * 100 : 0, c: w.usedMin / w.budgetMin > 0.9 ? 'err' : w.usedMin / w.budgetMin > 0.6 ? 'warn' : 'run', v: `${fmtMin(w.usedMin)} of ${fmtMin(w.budgetMin)}` },
              dep: b ? { t: 'status', i: 'triangle-alert', c: 'warn', l: `${plural(b, 'problem')}` } : { t: 'status', i: 'circle-check', c: 'ok', l: 'In order' },
              st: w.state === 'done' ? { t: 'status', i: 'check', c: 'ok', l: 'Done' } : w.state === 'in progress' ? { t: 'status', i: 'loader-circle', c: 'run', l: 'In progress' } : w.window ? { t: 'status', i: 'calendar-clock', c: 'tx', l: `${ready} of ${mine.length} ready` } : { t: 'status', i: 'circle-alert', c: 'warn', l: 'No window' }
            };
          })}
          onRow={(id: string) => { drawer.open(id); setTab('Servers'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['wave', 'waves']}
          emptyText="No waves yet. Create one and add servers that are ready to move."
          sort="win"
          footR="Times are IST"
        />
      </TableArea>
      {d && dc ? (
        <Drawer
          label="Migration wave"
          kicker={`Migration wave · ${custName(d.customer)}`}
          title={d.name}
          status={<><span>{d.window || 'No cutover window'}</span><span>{plural(dc.mine.length, 'server')}</span></>}
          actions={
            <>
              <Btn kind="primary" icon="power" perm={ctx.can('operate', 'Cutting over')} disabled={d.state === 'done' || !dc.mine.length || dc.mine.some(v => v.stage !== 'ready' && v.stage !== 'committed')} why={d.state === 'done' ? 'This wave is done.' : `${plural(dc.mine.filter(v => v.stage !== 'ready' && v.stage !== 'committed').length, 'server')} not ready for cutover.`} onClick={() => ctx.go('mig/servers')}>Cut over the wave</Btn>
              <Btn kind="outline" icon="pencil" perm={ctx.can('configure', 'Planning waves')} disabled={d.state === 'done'} why="This wave is done." onClick={() => onEdit(d)}>Edit…</Btn>
              <Spacer />
              <Btn kind="ghost" icon="server" onClick={() => ctx.go('mig/servers')}>Servers</Btn>
            </>
          }
          tabs={[{ v: 'Servers', label: 'Servers', count: dc.mine.length }, { v: 'Order', label: 'Dependencies', count: dc.out.filter(c => !c.ok).length || undefined }, { v: 'Window', label: 'Window' }]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Servers' ? (
            <MiniTable
              label="Servers in the wave"
              cols={[{ label: 'Server' }, { label: 'Stage', w: '170px' }, { label: 'Checks', w: '110px' }]}
              rows={dc.mine.map(v => [<strong key="n" style={{ fontWeight: 600 }}>{v.name}</strong>, STAGE_LABEL[v.stage], verdict(v) === 'ok' ? <Status key="c" icon="circle-check" tone="ok" label="Ready" /> : verdict(v) === 'warn' ? <Status key="c" icon="triangle-alert" tone="warn" label="Warnings" /> : <Status key="c" icon="ban" tone="err" label="Blocked" />])}
              empty="No servers yet. Edit the wave to add some."
            />
          ) : null}
          {tab === 'Order' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dc.out.some(c => !c.ok) ? <Bar tone="warn" multiline>A server would move before something it needs. Add the dependency to this wave, or move it in an earlier one.</Bar> : null}
              <MiniTable label="Dependencies" cols={[{ label: 'Server', w: '140px' }, { label: 'Needs', w: '140px' }, { label: 'Result' }]} rows={dc.out.map(c => [c.server, c.dep, <Status key="r" icon={c.ok ? 'circle-check' : 'triangle-alert'} tone={c.ok ? 'ok' : 'warn'} label={c.text} />])} empty="No dependencies found for these servers." />
            </div>
          ) : null}
          {tab === 'Window' ? (
            <Facts
              items={[
                { k: 'Cutover window', v: d.window || 'Not set', muted: !d.window },
                { k: 'Downtime budget', v: `${fmtMin(d.budgetMin)}; ${fmtMin(d.usedMin)} used` },
                { k: 'Blackout check', v: d.window ? (inBlackout(d.customer, waveDay(d), blackouts) ? `Inside ${inBlackout(d.customer, waveDay(d), blackouts)!.name}` : 'Clear of every blackout period') : 'No window to check', icon: d.window && !inBlackout(d.customer, waveDay(d), blackouts) ? 'circle-check' : undefined, tone: 'ok' },
                ...(d.approval ? [{ k: 'Go/no-go', v: `${d.approval}, two approvers` }] : [])
              ]}
            />
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}

function MapView({ ctx, inv, kept, onKeep, onPlan }: { ctx: Ctx; inv: SourceVm[]; kept: string[]; onKeep: (id: string) => void; onPlan: (customer: string, preset: string[]) => void }) {
  const custs = [...new Set(inv.map(v => v.customer))];
  const [cust, setCust] = useState(custs[0] || 'h360');
  const [hide, setHide] = useState(true);
  const linked = new Set(FLOWS.flatMap(f => [f.from, f.to]));
  const nodes = inv.filter(v => v.customer === cust && v.stage !== 'excluded' && (linked.has(v.name) || v.wave) && (!hide || v.stage !== 'committed'));
  const sugg = SUGGESTED_APPS.filter(s => s.customer === cust);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {custs.length > 1 ? <SelectFilter label="Customer" value={cust} onChange={setCust} options={custs.map(c => ({ v: c, label: custName(c) }))} /> : null}
        <CheckBox on={hide} onChange={setHide}>Hide migrated servers</CheckBox>
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>From 7 days of network flows seen by discovery</span>
      </div>
      <DepGraph
        label="Server dependencies"
        nodes={nodes.map(v => ({ id: v.name, label: v.name, sub: v.wave ? v.wave : IN_PROGRESS.includes(v.stage) ? STAGE_LABEL[v.stage] : 'Not in a wave', badge: v.wave ? v.wave.split(' · ')[0].replace('Wave ', 'W') : undefined, group: v.wave || 'zz', tone: verdict(v) === 'block' ? ('err' as const) : undefined, icon: verdict(v) === 'block' ? 'ban' : undefined }))}
        edges={FLOWS.map(f => [f.from, f.to] as [string, string])}
        columnLabel={i => (i ? `Moves after step ${i}` : 'Can move first')}
        onOpen={name => ctx.go('mig/sources', inv.find(v => v.name === name)?.id)}
      />
      <Panel title={<>Suggested applications <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>grouped automatically from the flows</span></>}>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {sugg.map(s => (
            <li key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--ln)' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong style={{ fontWeight: 600 }}>{s.name}</strong>
                  <Status icon={s.confidence === 'High' ? 'circle-check' : 'circle-dot'} tone={s.confidence === 'High' ? 'ok' : 'warn'} label={`${s.confidence} confidence`} />
                </span>
                <span style={{ display: 'block', font: '13px/18px var(--f-ui)', color: 'var(--tx-2)' }}>{s.members.join(', ')}</span>
                <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{s.evidence}</span>
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                {kept.includes(s.id) ? <Status icon="layers" tone="ok" label="Kept together" /> : <Btn kind="outline" size="sm" icon="layers" perm={ctx.can('configure', 'Grouping servers')} onClick={() => { onKeep(s.id); audit({ who: 'priya.raman', customer: s.customer, what: 'Accepted an application grouping', object: s.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${s.name}: these servers now move in the same wave`, 'ok'); }}>Keep together</Btn>}
                <Btn kind="ghost" size="sm" icon="plus" perm={ctx.can('configure', 'Planning waves')} onClick={() => onPlan(s.customer, inv.filter(v => s.members.includes(v.name) && v.stage !== 'committed').map(v => v.id))}>Plan as a wave…</Btn>
              </span>
            </li>
          ))}
          {!sugg.length ? <li style={{ padding: '12px 16px', color: 'var(--tx-2)' }}>No suggestions: every connected server is already in an application.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}

function CalendarView({ ctx, waves, blackouts }: { ctx: Ctx; waves: Wave[]; blackouts: Blackout[] }) {
  const [month, setMonth] = useState<'2026-10' | '2026-11' | '2026-12'>('2026-10');
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => (i >= lead && i < lead + days ? i - lead + 1 : null));
  const iso = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
  const showCust = showCustomerCol(ctx);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Seg label="Month" value={month} onChange={setMonth} options={[{ v: '2026-10', label: 'October' }, { v: '2026-11', label: 'November' }, { v: '2026-12', label: 'December' }]} />
        <Spacer />
        <span style={{ display: 'inline-flex', gap: 16, font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="calendar-clock" style={{ color: 'var(--acc)' }} />Cutover window</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="ban" style={{ color: 'var(--tx-3)' }} />Blackout period</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 10, height: 10, border: '1px solid var(--acc)' }} />Today</span>
        </span>
      </div>
      <div role="grid" aria-label={`Migration calendar, ${MON[m - 1]} ${y}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', border: '1px solid var(--ln)', background: 'var(--panel)' }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} role="columnheader" style={{ padding: '8px 10px', font: '12px var(--f-ui)', color: 'var(--tx-2)', borderBottom: '1px solid var(--ln)' }}>{d}</div>)}
        {cells.map((d, i) => {
          const day = d ? iso(d) : '';
          const wv = d ? waves.filter(w => waveDay(w) === day) : [];
          const bo = d ? blackouts.filter(b => day >= b.from && day <= b.to) : [];
          const today = day === '2026-10-21';
          return (
            <div key={i} role="gridcell" aria-label={d ? `${isoLabel(day)}${wv.length ? `; cutover: ${wv.map(w => w.name).join(', ')}` : ''}${bo.length ? `; blackout: ${bo.map(b => b.name).join(', ')}` : ''}` : undefined} style={{ minHeight: 92, padding: 6, borderLeft: i % 7 ? '1px solid var(--ln)' : 'none', borderTop: i >= 7 ? '1px solid var(--ln)' : 'none', background: d ? (bo.length ? 'var(--panel-2)' : undefined) : 'var(--app)', outline: today ? '1px solid var(--acc)' : undefined, outlineOffset: -1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              {d ? <span style={{ font: `${today ? 700 : 400} 12px var(--f-ui)`, color: today ? 'var(--acc-tx)' : 'var(--tx-2)' }}>{d}</span> : null}
              {bo.map(b => (
                <span key={b.id} data-tip={`${b.name} (${showCust ? custName(b.customer) + ', ' : ''}${isoLabel(b.from)} to ${isoLabel(b.to)}): ${b.why}`} style={{ display: 'flex', gap: 4, alignItems: 'center', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', minWidth: 0 }}>
                  <Icon name="ban" size={12} style={{ color: 'var(--tx-3)', flex: 'none' }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{day === b.from || d === 1 ? b.name : 'Blackout'}</span>
                </span>
              ))}
              {wv.map(w => (
                <a key={w.id} href={`#/mig/plans/waves?open=${w.id}`} data-tip={`${w.name}${showCust ? ` · ${custName(w.customer)}` : ''}: ${w.window}`} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 4px', background: 'var(--acc-soft)', border: '1px solid var(--acc)', font: '600 12px/16px var(--f-ui)', color: 'var(--tx)', minWidth: 0 }}>
                  <Icon name="calendar-clock" size={12} style={{ color: 'var(--acc)', flex: 'none' }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
                </a>
              ))}
            </div>
          );
        })}
      </div>
      <MiniTable label="Blackout periods" cols={[{ label: 'Blackout period' }, ...(showCust ? [{ label: 'Customer', w: '200px' }] : []), { label: 'From', w: '130px' }, { label: 'To', w: '130px' }, { label: 'Why', w: '320px' }]} rows={blackouts.map(b => [<strong key="n" style={{ fontWeight: 600 }}>{b.name}</strong>, ...(showCust ? [custName(b.customer)] : []), isoLabel(b.from), isoLabel(b.to), <span key="w" data-tip={b.why} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.why}</span>])} empty="No blackout periods." />
    </div>
  );
}

function WaveDialog({ ctx, wave, preset, customer, inv, waves, blackouts, kept, closing, onClose, onSave }: { ctx: Ctx; wave?: Wave; preset?: string[]; customer?: string; inv: SourceVm[]; waves: Wave[]; blackouts: Blackout[]; kept: typeof SUGGESTED_APPS; closing: boolean; onClose: () => void; onSave: (w: Wave, servers: string[]) => void }) {
  const custs = [...new Set(inv.map(v => v.customer))];
  const [cust, setCust] = useState(wave?.customer || customer || custs[0]);
  const [name, setName] = useState(wave?.name || `Wave ${waves.filter(w => w.customer === (wave?.customer || customer || custs[0])).length} · `);
  const [day, setDay] = useState(wave ? waveDay(wave) || '2026-11-08' : '2026-11-08');
  const [start, setStart] = useState(wave?.window?.match(/, (\d{2}:\d{2})/)?.[1] || '22:00');
  const [hours, setHours] = useState(String(wave ? Math.round(wave.budgetMin / 60) : 4));
  const [budget, setBudget] = useState(String(wave?.budgetMin || 240));
  const [sel, setSel] = useState<string[]>(wave ? inv.filter(v => v.wave === wave.name && v.customer === wave.customer).map(v => v.id) : preset || []);
  const pool = inv.filter(v => v.customer === cust && v.stage !== 'excluded' && v.stage !== 'committed' && (!v.wave || v.wave === wave?.name));
  const bo = inBlackout(cust, day, blackouts);
  const past = day < '2026-10-22';
  const dupe = waves.some(w => w.customer === cust && w.name.trim().toLowerCase() === name.trim().toLowerCase() && w.id !== wave?.id);
  const selNames = pool.filter(v => sel.includes(v.id)).map(v => v.name);
  const missing = useMemo(() => [...new Set(selNames.flatMap(n => needs(n)).filter(dep => !selNames.includes(dep) && pool.some(v => v.name === dep && verdict(v) !== 'block')))], [selNames.join(), pool]); // eslint-disable-line react-hooks/exhaustive-deps
  const split = kept.filter(k => k.customer === cust && k.members.some(n => selNames.includes(n)) && k.members.some(n => !selNames.includes(n) && pool.some(v => v.name === n)));
  const [hh, mm] = start.split(':').map(Number);
  const endMin = (hh * 60 + mm + +hours * 60) % 1440;
  const window = `${isoLabel(day)}, ${start} to ${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')} IST`;
  const ok = name.trim().length > 8 && !dupe && !bo && !past && sel.length > 0 && +budget > 0;
  const why = name.trim().length <= 8 ? 'Name the wave.' : dupe ? 'That name is taken.' : bo ? `The window is inside ${bo.name}.` : past ? 'The window is in the past.' : !sel.length ? 'Add at least one server.' : 'Give a downtime budget.';
  return (
    <Dialog
      title={wave ? `Edit ${wave.name}` : 'Create a wave'}
      sub="Servers in a wave cut over together in one window. Blocked servers cannot be added."
      size="lg"
      closing={closing}
      onClose={onClose}
      footNote={plural(sel.length, 'server')}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" perm={ctx.can('configure', 'Planning waves')} disabled={!ok} why={why} onClick={() => onSave({ id: wave?.id || 'w' + Date.now(), customer: cust, name: name.trim(), window, budgetMin: +budget, usedMin: wave?.usedMin || 0, state: wave?.state === 'in progress' ? 'in progress' : 'scheduled', approval: wave?.approval }, sel)}>{wave ? 'Save' : 'Create wave'}</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: custs.length > 1 && !wave ? 'minmax(0,1fr) 220px' : 'minmax(0,1fr)', gap: 16 }}>
        <Field id="wd-n" label="Name" err={dupe ? 'That name is taken.' : null}><TextInput id="wd-n" value={name} onChange={setName} invalid={dupe} autoFocus /></Field>
        {custs.length > 1 && !wave ? <Field id="wd-c" label="Customer"><SelectInput id="wd-c" value={cust} onChange={c => { setCust(c); setSel([]); }} options={custs.map(c => ({ v: c, label: custName(c) }))} /></Field> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 110px 150px', gap: 16 }}>
        <Field id="wd-d" label="Day" err={bo ? `Inside ${bo.name} (${isoLabel(bo.from)} to ${isoLabel(bo.to)}). Pick another day.` : past ? 'In the past.' : null}><TextInput id="wd-d" type="date" value={day} onChange={setDay} invalid={!!bo || past} /></Field>
        <Field id="wd-s" label="Starts (IST)"><TextInput id="wd-s" type="time" value={start} onChange={setStart} /></Field>
        <Field id="wd-h" label="Hours"><SelectInput id="wd-h" value={hours} onChange={setHours} options={['2', '3', '4', '5', '6', '8']} /></Field>
        <Field id="wd-b" label="Downtime budget (min)"><TextInput id="wd-b" value={budget} onChange={v => setBudget(v.replace(/\D/g, ''))} inputMode="numeric" /></Field>
      </div>
      <Field label={`Servers (${custName(cust)})`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 200, overflow: 'auto', padding: 2 }}>
          {pool.map(v => (
            <CheckBox key={v.id} on={sel.includes(v.id)} disabled={verdict(v) === 'block'} why={v.checks.find(c => c.level === 'block')?.text} onChange={x => setSel(s => (x ? [...s, v.id] : s.filter(id => id !== v.id)))}>
              <span style={{ whiteSpace: 'nowrap' }}>{v.name}</span>
              <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{verdict(v) === 'block' ? 'Blocked' : STAGE_LABEL[v.stage]}</span>
            </CheckBox>
          ))}
        </div>
      </Field>
      {missing.length ? (
        <Bar tone="warn" actions={<Btn kind="ghost" size="sm" icon="plus" onClick={() => setSel(s => [...s, ...pool.filter(v => missing.includes(v.name)).map(v => v.id)])}>Add {missing.length === 1 ? 'it' : 'them'}</Btn>}>
          {missing.join(', ')} {missing.length === 1 ? 'is' : 'are'} needed by servers in this wave and would stay behind.
        </Bar>
      ) : null}
      {split.length ? <Bar tone="warn">{split.map(k => k.name).join(', ')} is kept together; add every server in it or none.</Bar> : null}
    </Dialog>
  );
}

function BlackoutDialog({ ctx, scope, waves, closing, onClose, onSave }: { ctx: Ctx; scope: string[]; waves: Wave[]; closing: boolean; onClose: () => void; onSave: (b: Blackout) => void }) {
  const [cust, setCust] = useState(scope[0]);
  const [name, setName] = useState('');
  const [from, setFrom] = useState('2026-12-01');
  const [to, setTo] = useState('2026-12-03');
  const [why, setWhy] = useState('');
  const hit = waves.filter(w => w.customer === cust && w.state !== 'done' && waveDay(w) && waveDay(w)! >= from && waveDay(w)! <= to);
  const ok = name.trim().length >= 4 && to >= from && !hit.length && why.trim().length >= 6;
  return (
    <Dialog
      title="Add a blackout period"
      sub="No cutover window may start inside it. Shown on the calendar and checked whenever a wave is saved."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" perm={ctx.can('configure', 'Planning waves')} disabled={!ok} why={to < from ? 'The period ends before it starts.' : hit.length ? `${hit[0].name} is scheduled inside it. Move the wave first.` : 'Name it and say why.'} onClick={() => onSave({ id: 'b' + Date.now(), customer: cust, name: name.trim(), from, to, why: why.trim() })}>Add</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: scope.length > 1 ? 'minmax(0,1fr) 220px' : 'minmax(0,1fr)', gap: 16 }}>
        <Field id="bo-n" label="Name"><TextInput id="bo-n" value={name} onChange={setName} placeholder="Annual general meeting" autoFocus /></Field>
        {scope.length > 1 ? <Field id="bo-c" label="Customer"><SelectInput id="bo-c" value={cust} onChange={setCust} options={scope.map(c => ({ v: c, label: custName(c) }))} /></Field> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="bo-f" label="From"><TextInput id="bo-f" type="date" value={from} onChange={setFrom} /></Field>
        <Field id="bo-t" label="To (inclusive)" err={to < from ? 'Ends before it starts.' : null}><TextInput id="bo-t" type="date" value={to} onChange={setTo} invalid={to < from} /></Field>
      </div>
      <Field id="bo-w" label="Why"><TextInput id="bo-w" value={why} onChange={setWhy} placeholder="Board meeting; no changes to finance systems" /></Field>
      {hit.length ? <Bar tone="err">{hit.map(w => `${w.name} (${w.window})`).join('; ')} is scheduled inside this period. Move the wave first.</Bar> : null}
    </Dialog>
  );
}
