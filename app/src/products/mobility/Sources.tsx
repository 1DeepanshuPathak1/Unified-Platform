import { useEffect, useState } from 'react';
import AegisTable from '../../components/AegisTable';
import { Icon } from '../../lib/Icon';
import { Btn, CheckBox, Field, FilterInput, RadioCard, Seg, SelectFilter, SelectInput, Tabs, TextInput } from '../../ui/controls';
import { Bar, BulkBar, DrawerTiles, Facts, MiniTable, Page, PageHeader, Progress, Spacer, Status, TableArea, Toolbar, plural } from '../../ui/layout';
import { Dialog, Drawer, StepUp, Wizard, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, inScope, scopeCustomers, showCustomerCol } from '../../platform/common';
import { audit } from '../../platform/store';
import { INVENTORY, IN_PROGRESS, SOURCES, STAGE_LABEL, VERDICT, WAVES, verdict, type Source, type SourceVm } from './data';

type Tab = 'inventory' | 'sources';
const gb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(2)} TB` : `${n.toFixed(0)} GB`);
const short = (t: string) => t.replace(' 2026', '').replace(' IST', '');

/** Mobility › Sources: VMware sources with their certificates, and everything found on them. */
export default function Sources({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<Tab>(ctx.tab === 'sources' ? 'sources' : 'inventory');
  const [sources, setSources] = useState<Source[]>(SOURCES);
  const [over, setOver] = useState<Record<string, Partial<SourceVm>>>({});
  const add = useClosable<boolean>();
  const inv = INVENTORY.map(v => ({ ...v, ...(over[v.id] || {}) })).filter(v => scopeCustomers(ctx).includes(v.customer) && inScope(ctx, v.customer));
  return (
    <Page>
      <PageHeader
        kicker="Mobility"
        title="Sources"
        sub="VMware vCenter and ESXi hosts Aegis reads from, and every server found on them with what stands in the way of moving it."
        actions={
          <Btn kind="primary" icon="plus" perm={ctx.can('configure', 'Adding a source')} onClick={() => add.open(true)}>
            Add a source
          </Btn>
        }
      />
      <Tabs
        label="Sources sections"
        value={tab}
        onChange={setTab}
        style={{ margin: '0 24px 12px', padding: 0 }}
        tabs={[
          { v: 'inventory', label: 'Inventory', count: inv.length },
          { v: 'sources', label: 'Sources', count: sources.length }
        ]}
      />
      {tab === 'inventory' ? <Inventory ctx={ctx} inv={inv} setOver={(id, p) => setOver(o => ({ ...o, [id]: { ...(o[id] || {}), ...p } }))} /> : <SourceList ctx={ctx} sources={sources} />}
      {add.value ? (
        <AddSourceWizard
          ctx={ctx}
          closing={add.closing}
          onClose={add.close}
          onAdded={src => {
            setSources(x => [...x, src]);
            setTab('sources');
            add.close();
          }}
        />
      ) : null}
    </Page>
  );
}

function Inventory({ ctx, inv, setOver }: { ctx: Ctx; inv: SourceVm[]; setOver: (id: string, p: Partial<SourceVm>) => void }) {
  const [v, setV] = useState<'All' | 'ok' | 'warn' | 'block'>('All');
  const [q, setQ] = useState('');
  const [src, setSrc] = useState('All');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const drawer = useClosable<string>();
  const wave = useClosable<string[]>();
  const [dtab, setDtab] = useState<'checks' | 'details' | 'disks'>('checks');
  useEffect(() => {
    if (ctx.openId && inv.some(x => x.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const ql = q.trim().toLowerCase();
  const scoped = inv.filter(x => x.stage !== 'excluded' || v === 'All');
  const rows = scoped.filter(x => (v === 'All' || verdict(x) === v) && (src === 'All' || x.source === src) && (!ql || `${x.name} ${x.os} ${x.wave || ''}`.toLowerCase().includes(ql)));
  const showCust = showCustomerCol(ctx);
  const selIds = rows.filter(r => sel[r.id]).map(r => r.id);
  const cfg = ctx.can('configure', 'Planning migrations');
  const d = drawer.value ? inv.find(x => x.id === drawer.value) : null;
  const count = (k: 'ok' | 'warn' | 'block') => inv.filter(x => x.stage !== 'excluded' && verdict(x) === k).length;
  const turnOnCbt = (x: SourceVm) => {
    const id = ctx.startJob({ name: 'Turn on change tracking', object: x.name, product: 'Migration', phases: ['Reconfigure VM', 'Snapshot and remove', 'Done'], speed: 25, doneToast: `Change tracking is on for ${x.name}` });
    setOver(x.id, { cbt: 'On', checks: x.checks.map(c => (c.k === 'Change tracking' ? { k: c.k, level: 'ok', text: 'On: sync passes copy only changed blocks.' } : c)) });
    audit({ who: 'priya.raman', customer: x.customer, what: 'Turned on change tracking', object: x.name, when: ctx.now(), r: 'ok' });
    return id;
  };
  return (
    <>
      <Toolbar>
        {selIds.length ? (
          <BulkBar label={`${selIds.length} selected`} onClear={() => setSel({})}>
            <Btn kind="ghost" icon="route" perm={cfg} onClick={() => wave.open(selIds)}>
              Add to a wave…
            </Btn>
          </BulkBar>
        ) : (
          <>
            <Seg
              label="Migratability"
              value={v}
              onChange={setV}
              options={[
                { v: 'All', label: 'All', count: inv.length },
                { v: 'ok', label: 'Ready', count: count('ok') },
                { v: 'warn', label: 'Warnings', count: count('warn') },
                { v: 'block', label: 'Blocked', count: count('block') }
              ]}
            />
            <FilterInput value={q} onChange={setQ} placeholder="Filter by name, OS or wave" label="Filter servers" width={220} />
            <SelectFilter label="Source" value={src} onChange={setSrc} options={['All', ...SOURCES.map(x => x.name)]} />
            <Spacer />
          </>
        )}
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Inventory"
          cols={[
            { k: 'name', label: 'Server', w: 'minmax(140px,1.2fr)' },
            ...(showCust ? [{ k: 'cust', label: 'Customer', w: 'minmax(110px,1fr)', dim: true }] : []),
            { k: 'src', label: 'Source', w: '128px', dim: true },
            { k: 'os', label: 'Guest OS', w: 'minmax(150px,1.3fr)', dim: true },
            { k: 'spec', label: 'CPU and memory', w: '116px', dim: true },
            { k: 'size', label: 'Size', w: '84px', r: true },
            { k: 'mig', label: 'Can it move?', w: '120px' },
            { k: 'stage', label: 'Wave', w: 'minmax(150px,1.2fr)' }
          ]}
          rows={rows.map(x => {
            const vd = VERDICT[verdict(x)];
            const first = x.checks.find(c => c.level === 'block') || x.checks.find(c => c.level === 'warn');
            const total = x.disks.reduce((a, b) => a + b, 0);
            return {
              id: x.id,
              name: { v: x.name, strong: true },
              cust: custName(x.customer),
              src: x.source,
              os: x.os,
              spec: { v: `${x.cpu} vCPU · ${x.mem} GB`, s: x.cpu * 1000 + x.mem },
              size: { v: gb(total), s: total },
              mig: x.stage === 'excluded' ? { t: 'status', i: 'minus', c: 'tx', l: 'Not migrated', tip: first?.text } : { t: 'status', i: vd.i, c: vd.c, l: vd.l, tip: first ? `${first.k}: ${first.text}` : 'Every check passed', s: verdict(x) },
              stage: x.wave ? { v: `${x.wave.split(' · ')[0]} · ${STAGE_LABEL[x.stage]}`, tip: `${x.wave} · ${STAGE_LABEL[x.stage]}`, muted: x.stage === 'committed' } : { v: STAGE_LABEL[x.stage], muted: true }
            };
          })}
          sel={sel}
          onSel={(id: string) => setSel(s => ({ ...s, [id]: !s[id] }))}
          onSelAll={(list: string[], on: boolean) => setSel(s => ({ ...s, ...Object.fromEntries(list.map(id => [id, on])) }))}
          onRow={(id: string) => { drawer.open(id); setDtab('checks'); }}
          active={drawer.value}
          state={ctx.ui === 'unreach' ? 'unreach' : ctx.ui}
          unreachText="Could not be read: Chennai vCenter did not answer within 30 s."
          unit={['server', 'servers']}
          filtered={v !== 'All' || src !== 'All' || !!ql}
          onClear={() => { setV('All'); setSrc('All'); setQ(''); }}
          emptyText="No servers found yet. Add a vCenter or ESXi source; its servers are listed here after the first scan."
          emptyAction="Add a source"
          footR="Scanned 21 Oct 2026, 15:30 IST · every 6 h"
          sort="name"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Server details"
          width={600}
          kicker={`${d.source} · ${d.host}${showCust ? ` · ${custName(d.customer)}` : ''}`}
          title={d.name}
          status={
            <>
              <Status icon={VERDICT[verdict(d)].i} tone={VERDICT[verdict(d)].c} label={d.stage === 'excluded' ? 'Not migrated' : VERDICT[verdict(d)].l} />
              <span>{d.wave ? `${d.wave} · ${STAGE_LABEL[d.stage]}` : STAGE_LABEL[d.stage]}</span>
              <span>Power {d.power.toLowerCase()}</span>
            </>
          }
          actions={
            <>
              {IN_PROGRESS.includes(d.stage) || d.stage === 'cutover' || d.stage === 'rolledback' ? (
                <Btn kind="primary" icon="server" onClick={() => ctx.go('mig/servers', d.name)}>
                  Open migration
                </Btn>
              ) : (
                <Btn kind="primary" icon="route" perm={cfg} disabled={verdict(d) === 'block' || d.stage === 'committed'} why={d.stage === 'committed' ? 'Already migrated.' : 'Fix what blocks it first.'} onClick={() => wave.open([d.id])}>
                  {d.wave ? 'Change wave…' : 'Add to a wave…'}
                </Btn>
              )}
              {d.cbt === 'Off' ? (
                <Btn kind="outline" icon="refresh-cw" perm={ctx.can('operate', 'Changing a VM at the source')} onClick={() => { turnOnCbt(d); ctx.toast(`Turning on change tracking for ${d.name}`, 'info'); }}>
                  Turn on change tracking
                </Btn>
              ) : null}
              <Btn kind="outline" icon="radar" onClick={() => ctx.toast(`${d.name} checked again: nothing changed since 15:30 IST`, 'info')}>
                Check again
              </Btn>
            </>
          }
          tabs={[
            { v: 'checks', label: 'Checks', count: d.checks.filter(c => c.level !== 'ok').length || '' },
            { v: 'details', label: 'Details' },
            { v: 'disks', label: 'Disks', count: d.disks.length }
          ]}
          tab={dtab}
          onTab={t => setDtab(t as typeof dtab)}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {dtab === 'checks' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.risk ? <Bar tone="warn" multiline>{d.risk}</Bar> : null}
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {d.checks.map((c, i) => (
                  <li key={i} style={{ display: 'grid', gridTemplateColumns: '20px 132px minmax(0,1fr)', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--ln)' }}>
                    <Icon name={c.level === 'ok' ? 'circle-check' : c.level === 'warn' ? 'triangle-alert' : 'ban'} style={{ color: c.level === 'ok' ? 'var(--ok)' : c.level === 'warn' ? 'var(--warn)' : 'var(--err)', marginTop: 2 }} />
                    <span style={{ fontWeight: 600 }}>{c.k}</span>
                    <span style={{ color: c.level === 'ok' ? 'var(--tx-2)' : 'var(--tx)' }}>{c.text}</span>
                  </li>
                ))}
              </ul>
              <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Blocked servers cannot join a wave. Warnings can; they are repeated in the go/no-go check before cutover.</p>
            </div>
          ) : null}
          {dtab === 'details' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <DrawerTiles items={[{ label: 'CPU and memory', value: `${d.cpu} · ${d.mem} GB` }, { label: 'Disks', value: gb(d.disks.reduce((a, b) => a + b, 0)) }, { label: 'Change tracking', value: d.cbt, icon: d.cbt === 'On' ? 'circle-check' : 'triangle-alert', tone: d.cbt === 'On' ? 'ok' : 'warn' }]} />
              <Facts
                items={[
                  { k: 'Source', v: `${d.source} (${SOURCES.find(x => x.name === d.source)?.addr})` },
                  { k: 'Host and datastore', v: `${d.host} · ${d.ds}` },
                  { k: 'Guest OS', v: d.os },
                  { k: 'Firmware', v: `${d.firmware}${d.firmware === 'UEFI' ? ', boots with OVMF at the destination' : ', boots with SeaBIOS at the destination'}` },
                  { k: 'VMware Tools', v: d.tools },
                  { k: 'Snapshots', v: d.snapshots ? plural(d.snapshots, 'snapshot') : 'None' },
                  { k: 'Destination', v: d.dest || 'Not set', muted: !d.dest },
                  { k: 'Customer', v: custName(d.customer) }
                ]}
              />
            </div>
          ) : null}
          {dtab === 'disks' ? (
            <MiniTable label="Disks" cols={[{ label: 'Disk', w: '96px' }, { label: 'Size', w: '96px', r: true }, { label: 'Datastore' }, { label: 'Type', w: '120px' }]} rows={d.disks.map((n, i) => [`Hard disk ${i + 1}`, gb(n), d.ds, d.checks.some(c => c.text.includes('multi-writer')) && i > 0 ? 'Shared' : 'Thin'])} />
          ) : null}
        </Drawer>
      ) : null}
      {wave.value ? (
        <WaveDialog
          ctx={ctx}
          vms={inv.filter(x => wave.value!.includes(x.id))}
          closing={wave.closing}
          onClose={wave.close}
          onDone={(ids, w) => {
            ids.forEach(id => setOver(id, { wave: w, stage: 'planned' }));
            setSel({});
            wave.close();
          }}
        />
      ) : null}
    </>
  );
}

function WaveDialog({ ctx, vms, closing, onClose, onDone }: { ctx: Ctx; vms: SourceVm[]; closing: boolean; onClose: () => void; onDone: (ids: string[], wave: string) => void }) {
  const custs = [...new Set(vms.map(v => v.customer))];
  const options = WAVES.filter(w => custs.includes(w.customer) && w.state !== 'done');
  const [w, setW] = useState(options[0]?.name || '');
  const blocked = vms.filter(v => verdict(v) === 'block');
  const moving = vms.filter(v => IN_PROGRESS.includes(v.stage) || v.stage === 'committed');
  const ok = vms.filter(v => !blocked.includes(v) && !moving.includes(v));
  const multi = custs.length > 1;
  return (
    <Dialog
      title={vms.length === 1 ? `Add ${vms[0].name} to a wave` : `Add ${plural(vms.length, 'server')} to a wave`}
      sub="Servers in a wave share a cutover window, a mapping and a go/no-go decision."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="check" disabled={!ok.length || !w || multi} why={multi ? 'Pick servers of one customer; waves belong to one customer.' : !w ? 'There is no open wave.' : 'None of these servers can join a wave.'} onClick={() => { onDone(ok.map(v => v.id), w); audit({ who: 'priya.raman', customer: custs[0], what: `Added ${plural(ok.length, 'server')} to a wave`, object: w, when: ctx.now(), r: 'ok' }); ctx.toast(`${ok.length === 1 ? ok[0].name : plural(ok.length, 'server')} added to ${w}`, 'ok'); }}>
            Add {ok.length === vms.length ? '' : `${ok.length} of ${vms.length}`}
          </Btn>
        </>
      }
    >
      <Field id="wv" label="Wave">
        <SelectInput id="wv" value={w} onChange={setW} options={options.map(x => ({ v: x.name, label: `${x.name} · ${x.window ? x.window.split(',')[0] : 'no window yet'}` }))} />
      </Field>
      {blocked.length ? <Bar tone="err" multiline>{plural(blocked.length, 'server')} cannot join: {blocked.map(v => `${v.name} (${v.checks.find(c => c.level === 'block')!.k.toLowerCase()})`).join(', ')}.</Bar> : null}
      {moving.length ? <Bar tone="info" multiline>{plural(moving.length, 'server')} already migrating or migrated: {moving.map(v => v.name).join(', ')}.</Bar> : null}
      {ok.some(v => verdict(v) === 'warn') ? <Bar tone="warn" multiline>{plural(ok.filter(v => verdict(v) === 'warn').length, 'server')} have warnings. They can join; the warnings come back in the go/no-go check.</Bar> : null}
    </Dialog>
  );
}

function SourceList({ ctx, sources }: { ctx: Ctx; sources: Source[] }) {
  const drawer = useClosable<string>();
  const [cert, setCert] = useState<string | null>(null);
  const [dtab, setDtab] = useState<'overview' | 'cert'>('overview');
  const [scans, setScans] = useState<Record<string, string>>({});
  const d = drawer.value ? sources.find(x => x.id === drawer.value) : null;
  const vms = (s: Source) => INVENTORY.filter(v => v.source === s.name);
  const scan = (s: Source) => {
    const id = ctx.startJob({ name: 'Inventory scan', object: s.name, product: 'Migration', phases: ['Connect', 'Read hosts and datastores', 'Read VMs', 'Check migratability', 'Done'], speed: 14, doneToast: `${s.name} scanned: ${plural(vms(s).length, 'server')}, nothing new` });
    setScans(x => ({ ...x, [s.id]: id }));
  };
  const live = (s: Source) => ctx.jobs.find(j => j.id === scans[s.id] && j.status === 'run');
  return (
    <>
      <TableArea>
        <AegisTable
          label="Sources"
          cols={[
            { k: 'name', label: 'Source', w: 'minmax(150px,1.2fr)' },
            { k: 'kind', label: 'Version', w: 'minmax(180px,1.4fr)', dim: true },
            { k: 'addr', label: 'Address', w: '150px', dim: true },
            { k: 'n', label: 'Servers', w: '80px', r: true },
            { k: 'cert', label: 'Certificate', w: 'minmax(170px,1.2fr)' },
            { k: 'scan', label: 'Last scan', w: '150px', dim: true },
            { k: 'st', label: 'Status', w: 'minmax(150px,1fr)' }
          ]}
          rows={sources.map(s => {
            const j = live(s);
            return {
              id: s.id,
              name: { v: s.name, strong: true },
              kind: s.version,
              addr: s.addr,
              n: { v: String(vms(s).length || '—'), s: vms(s).length },
              cert: s.cert.expiresDays < 30 ? { t: 'status', i: 'triangle-alert', c: 'warn', l: `Expires in ${s.cert.expiresDays} days`, tip: `Fingerprint confirmed by ${s.cert.confirmedBy}; valid ${s.cert.valid}` } : { t: 'status', i: 'badge-check', c: 'ok', l: 'Confirmed', tip: `Confirmed by ${s.cert.confirmedBy} on ${s.cert.confirmed}` },
              scan: j ? { t: 'bar', pct: j.pct, c: 'run', v: `${Math.floor(j.pct)} %` } : short(s.lastScan),
              st: s.state === 'unreach' ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Could not be read' } : s.note ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Needs attention', tip: s.note } : { t: 'status', i: 'circle-check', c: 'ok', l: 'Connected' }
            };
          })}
          onRow={(id: string) => { drawer.open(id); setDtab('overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['source', 'sources']}
          emptyText="No VMware sources yet. Add a vCenter or a standalone ESXi host to discover what can move."
          emptyAction="Add a source"
          footR="Read-only access; Aegis takes snapshots but never changes VM settings without asking"
          sort="name"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Source details"
          kicker={`VMware ${d.kind} · ${d.addr}`}
          title={d.name}
          status={
            <>
              <Status icon={d.note ? 'triangle-alert' : 'circle-check'} tone={d.note ? 'warn' : 'ok'} label={d.note ? 'Needs attention' : 'Connected'} />
              <span>{plural(vms(d).length, 'server')}</span>
              <span>Scanned {short(d.lastScan)}</span>
            </>
          }
          actions={
            <>
              <Btn kind="outline" icon={live(d) ? 'loader-circle' : 'radar'} spin={!!live(d)} disabled={!!live(d)} why="A scan is running." perm={ctx.can('operate', 'Scanning a source')} onClick={() => scan(d)}>
                Scan now
              </Btn>
              <Btn kind="outline" icon="badge-check" perm={ctx.can('configure', 'Confirming a certificate')} onClick={() => setCert(d.id)}>
                Confirm certificate…
              </Btn>
            </>
          }
          tabs={[
            { v: 'overview', label: 'Overview' },
            { v: 'cert', label: 'Certificate' }
          ]}
          tab={dtab}
          onTab={t => setDtab(t as typeof dtab)}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {dtab === 'overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {live(d) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon name="loader-circle" spin style={{ color: 'var(--run)' }} />
                  <span>{live(d)!.phases[live(d)!.phase]}…</span>
                  <Progress pct={live(d)!.pct} />
                </div>
              ) : null}
              {d.note ? <Bar tone="warn" multiline>{d.note}</Bar> : null}
              <DrawerTiles items={[{ label: 'Hosts', value: d.hosts }, { label: 'Datastores', value: d.datastores }, { label: 'Servers', value: vms(d).length }, { label: 'Blocked', value: vms(d).filter(v => verdict(v) === 'block').length, icon: 'ban', tone: 'err' }]} />
              <Facts items={[{ k: 'Version', v: d.version }, { k: 'Address', v: d.addr }, { k: 'Account', v: d.account }, { k: 'Networks', v: String(d.networks) }, { k: 'Last scan', v: d.lastScan }]} />
            </div>
          ) : null}
          {dtab === 'cert' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Facts labelW={150} items={[{ k: 'SHA-256 fingerprint', v: <code style={{ font: '12px/18px var(--f-ui)', wordBreak: 'break-all' }}>{d.cert.fp}</code> }, { k: 'Issuer', v: d.cert.issuer }, { k: 'Valid', v: d.cert.valid, icon: d.cert.expiresDays < 30 ? 'triangle-alert' : undefined, tone: 'warn' }, { k: 'Confirmed', v: `By ${d.cert.confirmedBy} on ${d.cert.confirmed}`, icon: 'badge-check', tone: 'ok' }]} />
              <p style={{ font: '13px/18px var(--f-body)', color: 'var(--tx-2)' }}>Aegis connects only while the certificate matches this fingerprint. If it changes, connections stop until someone confirms the new one.</p>
            </div>
          ) : null}
        </Drawer>
      ) : null}
      {cert ? <CertDialog ctx={ctx} src={sources.find(x => x.id === cert)!} onClose={() => setCert(null)} /> : null}
    </>
  );
}

/** Re-confirm a source certificate: compare the fingerprint, then step-up. Armed in this dialog. */
function CertDialog({ ctx, src, onClose }: { ctx: Ctx; src: Source; onClose: () => void }) {
  const [same, setSame] = useState(false);
  const [mfa, setMfa] = useState(false);
  return (
    <Dialog
      title={`Confirm the certificate of ${src.name}`}
      sub="Compare this fingerprint with the one shown on the server itself before you trust it."
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="badge-check" disabled={!same || !mfa} why={!same ? 'Confirm the fingerprints match.' : 'Confirm it is you first.'} onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Confirmed a source certificate', object: src.name, when: ctx.now(), r: 'ok', note: src.cert.fp.slice(0, 23) + '…' }); ctx.toast(`Certificate of ${src.name} confirmed`, 'ok'); onClose(); }}>
            Trust this certificate
          </Btn>
        </>
      }
    >
      <div style={{ padding: 12, border: '1px solid var(--ln)', background: 'var(--panel-2)', font: '13px/22px var(--f-ui)', wordBreak: 'break-all' }}>{src.cert.fp}</div>
      <Facts labelW={110} items={[{ k: 'Issuer', v: src.cert.issuer }, { k: 'Valid', v: src.cert.valid }]} />
      <CheckBox on={same} onChange={setSame}>
        It matches the fingerprint shown {src.kind === 'vCenter' ? 'in the vCenter appliance management (port 5480)' : 'on the ESXi host client'}
      </CheckBox>
      {same ? <StepUp verified={mfa} onVerified={() => setMfa(true)} /> : null}
    </Dialog>
  );
}

function AddSourceWizard({ ctx, closing, onClose, onAdded }: { ctx: Ctx; closing: boolean; onClose: () => void; onAdded: (s: Source) => void }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<'vCenter' | 'ESXi'>('vCenter');
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [user, setUser] = useState('svc-aegis-mig@vsphere.local');
  const [pw, setPw] = useState('');
  const [same, setSame] = useState(false);
  const [found, setFound] = useState(0);
  const fp = '7D:2C:A9:14:E3:5F:80:B6:4A:91:0E:C7:3B:D2:68:F5:19:A4:7E:C0:53:8B:2D:F6:E1:04:9C:37:B8:65:DA:42';
  useEffect(() => {
    if (step !== 3) return;
    setFound(0);
    const t = window.setInterval(() => setFound(n => Math.min(4, n + 1)), 600);
    return () => clearInterval(t);
  }, [step]);
  const valid = [true, name.trim() && /^[\w.-]+(:\d+)?$/.test(addr.trim()) && user.trim() && pw, same, found >= 4][step];
  const why = ['', 'Fill in the name, a host name or IP address, the account and its password.', 'Confirm the fingerprint matches.', 'Scanning…'][step];
  const finish = () => {
    const src: Source = { id: 's' + Date.now(), name: name.trim(), kind, version: kind === 'vCenter' ? 'vCenter Server 8.0 Update 3' : 'ESXi 8.0 Update 2 (standalone)', addr: addr.includes(':') ? addr : `${addr}:443`, hosts: kind === 'vCenter' ? 3 : 1, datastores: 2, networks: 2, cert: { fp, issuer: kind === 'vCenter' ? `VMware Certificate Authority (${name.trim()})` : `Self-signed (${addr})`, valid: '21 Oct 2026 to 21 Oct 2028', expiresDays: 730, confirmedBy: 'priya.raman', confirmed: ctx.now() }, account: user, lastScan: ctx.now(), state: 'ok' };
    audit({ who: 'priya.raman', customer: 'h360', what: `Added a VMware ${kind} source`, object: src.name, when: ctx.now(), r: 'ok', note: `Certificate ${fp.slice(0, 23)}… confirmed` });
    ctx.toast(`${src.name} added. 27 servers found; migratability is checked in the background.`, 'ok');
    onAdded(src);
  };
  return (
    <Wizard
      title="Add a VMware source"
      sub="Aegis reads inventory and takes snapshots for sync passes. It never changes VM settings without asking."
      steps={['Platform', 'Address and account', 'Certificate', 'Discover']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0 && step < 3}
      onBack={() => setStep(step - 1)}
      next={
        step < 3 ? (
          <Btn kind="primary" iconAfter="chevron-right" disabled={!valid} why={why} onClick={() => setStep(step + 1)}>
            {step === 1 ? 'Connect' : 'Next'}
          </Btn>
        ) : (
          <Btn kind="primary" icon="check" disabled={!valid} why={why} onClick={finish}>
            Add source
          </Btn>
        )
      }
    >
      {step === 0 ? (
        <div role="radiogroup" aria-label="Platform" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <RadioCard on={kind === 'vCenter'} onClick={() => setKind('vCenter')} icon="layers" title="vCenter Server" note="Reads every host, datastore and network the account can see. Recommended." />
          <RadioCard on={kind === 'ESXi'} onClick={() => setKind('ESXi')} icon="server" title="Standalone ESXi host" note="For hosts that are not managed by a vCenter. Change tracking works the same." />
        </div>
      ) : null}
      {step === 1 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
          <Field id="as-name" label="Name">
            <TextInput id="as-name" value={name} onChange={setName} placeholder={kind === 'vCenter' ? 'Mumbai vCenter' : 'esxi-branch-02'} />
          </Field>
          <Field id="as-addr" label="Host name or IP address">
            <TextInput id="as-addr" value={addr} onChange={setAddr} placeholder="172.25.20.10" mono />
          </Field>
          <Field id="as-user" label="Account" hint="Use an account with the Aegis Migration role: read, snapshot and change tracking only.">
            <TextInput id="as-user" value={user} onChange={setUser} />
          </Field>
          <Field id="as-pw" label="Password" hint="Stored in the credential vault; never shown again.">
            <TextInput id="as-pw" type="password" value={pw} onChange={setPw} />
          </Field>
        </div>
      ) : null}
      {step === 2 ? (
        <>
          <Bar tone="info" icon="badge-check">{addr} presented this certificate. Compare it with the one on the server before you trust it.</Bar>
          <div style={{ padding: 12, border: '1px solid var(--ln)', background: 'var(--panel-2)', font: '13px/22px var(--f-ui)', wordBreak: 'break-all' }}>{fp}</div>
          <Facts labelW={110} items={[{ k: 'Issuer', v: kind === 'vCenter' ? `VMware Certificate Authority (${name})` : `Self-signed (${addr})` }, { k: 'Valid', v: '21 Oct 2026 to 21 Oct 2028' }]} />
          <CheckBox on={same} onChange={setSame}>
            It matches the fingerprint shown {kind === 'vCenter' ? 'in the vCenter appliance management (port 5480)' : 'on the ESXi host client'}
          </CheckBox>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <ul style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)' }}>
            {[
              ['Signed in as ' + user, 'Permissions match the Aegis Migration role'],
              [kind === 'vCenter' ? '3 hosts, 2 datastores, 2 networks' : '1 host, 2 datastores, 2 networks', 'Read'],
              ['27 virtual machines', '25 powered on, 2 off'],
              ['Migratability checked', '19 ready, 6 with warnings, 2 blocked']
            ].map(([a, b], i) => (
              <li key={a} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 10, padding: '10px 12px', borderBottom: i < 3 ? '1px solid var(--ln)' : 'none', opacity: i <= found ? 1 : 0.45 }}>
                <Icon name={i < found ? 'circle-check' : i === found ? 'loader-circle' : 'circle'} spin={i === found} style={{ color: i < found ? 'var(--ok)' : i === found ? 'var(--run)' : 'var(--tx-3)', marginTop: 2 }} />
                <span>
                  <span style={{ display: 'block', fontWeight: 600 }}>{a}</span>
                  <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{i < found ? b : 'Reading…'}</span>
                </span>
              </li>
            ))}
          </ul>
          {found >= 4 ? <Bar tone="ok">Discovery finished. The servers appear in the inventory; nothing has been copied.</Bar> : null}
        </>
      ) : null}
    </Wizard>
  );
}

