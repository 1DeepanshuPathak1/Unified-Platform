import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { Btn, Field, SelectInput, TextInput } from '../ui/controls';
import { Facts, MiniTable, Spacer, TableArea, Toolbar } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { GOVERNORS, type Governor } from '../data/admin';
import { audit } from './store';

const PC: Record<string, string> = { Protection: 'var(--series-1)', Resilience: 'var(--series-2)', Mobility: 'var(--series-3)' };

/**
 * Source impact governor: one read-rate cap per source system, shared by Protection, Resilience
 * and Mobility, with automatic back-off when the source slows down.
 */
export function GovernorTab({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Governor[]>(GOVERNORS);
  const drawer = useClosable<string>();
  const edit = useClosable<string>();
  const cfg = ctx.can('configure', 'Changing read-rate caps');
  const d = drawer.value ? list.find(g => g.source === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Every product reads from the same sources. One cap per source keeps production fast; jobs share it and back off when the source slows.</span>
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Read-rate caps"
          cols={[
            { k: 's', label: 'Source', w: 'minmax(170px,1.3fr)' },
            { k: 'cap', label: 'Cap', w: '110px', r: true },
            { k: 'now', label: 'Read now', w: '200px' },
            { k: 'who', label: 'Shared by', w: 'minmax(160px,1.3fr)', dim: true },
            { k: 'lat', label: 'Source latency', w: '130px' },
            { k: 'st', label: 'State', w: 'minmax(170px,1.3fr)' }
          ]}
          rows={list.map(g => ({
            id: g.source,
            s: { v: g.source, strong: true, tip: g.kind },
            cap: `${g.cap} ${g.unit}`,
            now: { t: 'bar', pct: (g.now / g.cap) * 100, c: g.now >= g.cap ? 'warn' : 'run', v: `${g.now} ${g.unit}` },
            who: g.users.length ? g.users.map(u => `${u.product} ${u.share}`).join(' · ') : { v: 'Nothing reading', muted: true },
            lat: g.latencyLimit ? { t: 'status', i: g.latency > g.latencyLimit * 0.8 ? 'triangle-alert' : 'circle-check', c: g.latency > g.latencyLimit * 0.8 ? 'warn' : 'ok', l: `${g.latency} ms of ${g.latencyLimit}` } : { v: 'From the agent', muted: true },
            st: g.throttled ? { t: 'status', i: 'gauge', c: 'warn', l: g.throttled.split(';')[0].split(':')[0], tip: g.throttled } : { t: 'status', i: 'circle-check', c: 'ok', l: 'Under the cap' }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['source', 'sources']}
          emptyText="No sources yet. Each connected platform gets a cap when it is added."
          footR="Measured every 10 s"
          sort="s"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Read-rate cap"
          kicker={`Source impact · ${d.kind}`}
          title={d.source}
          status={<><span>Cap {d.cap} {d.unit}</span><span>Reading {d.now} {d.unit}</span></>}
          actions={<Btn kind="outline" icon="pencil" perm={cfg} onClick={() => edit.open(d.source)}>Edit cap…</Btn>}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div role="img" style={{ display: 'flex', height: 12, gap: 2 }} aria-label={`Share of the ${d.cap} ${d.unit} cap: ${d.users.map(u => `${u.product} ${u.share}`).join(', ') || 'nothing reading'}`}>
                {d.users.map(u => (
                  <span key={u.product} tabIndex={0} data-tip={`${u.product}: ${u.share} ${d.unit}`} style={{ width: `${(u.share / d.cap) * 100}%`, background: PC[u.product] }} />
                ))}
                <span style={{ flex: 1, background: 'var(--ln)' }} />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                {d.users.map(u => (
                  <span key={u.product} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: PC[u.product] }} />
                    {u.product} {u.share} {d.unit}
                  </span>
                ))}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: 'var(--ln)' }} />
                  Free {Math.max(0, d.cap - d.now)} {d.unit}
                </span>
              </div>
            </div>
            <Facts items={[{ k: 'Cap', v: `${d.cap} ${d.unit}` }, { k: 'Time-of-day cap', v: d.window || 'None', muted: !d.window }, { k: 'Back-off', v: d.backoff }, { k: 'How jobs share it', v: 'Higher job priority first; equal priority shares evenly; replication is never starved below 20 %' }, ...(d.throttled ? [{ k: 'Right now', v: d.throttled, icon: 'gauge', tone: 'warn' }] : [])]} />
            <MiniTable label="Back-off events" cols={[{ label: 'When', w: '120px' }, { label: 'What' }]} rows={d.source === 'Chennai-proxmox-prod' ? [['21 Oct, 11:42', 'Ceph latency 18 ms; halved to 250 MB/s for 6 min'], ['20 Oct, 15:10', 'Ceph latency 16 ms; halved to 250 MB/s for 2 min']] : d.source === 'esxi-edge-07' ? [['21 Oct, 13:10', 'Datastore 93 % full; new snapshots stopped']] : []} empty="No back-off in the last 7 days." />
          </div>
        </Drawer>
      ) : null}
      {edit.value ? (
        <CapDialog
          ctx={ctx}
          g={list.find(g => g.source === edit.value)!}
          closing={edit.closing}
          onClose={edit.close}
          onSave={(cap, win) => {
            const src = edit.value!;
            setList(x => x.map(g => (g.source === src ? { ...g, cap, window: win || undefined } : g)));
            edit.close();
          }}
        />
      ) : null}
    </>
  );
}

function CapDialog({ ctx, g, closing, onClose, onSave }: { ctx: Ctx; g: Governor; closing: boolean; onClose: () => void; onSave: (cap: number, win: string) => void }) {
  const [cap, setCap] = useState(String(g.cap));
  const [win, setWin] = useState(g.window ? 'Business hours' : 'None');
  const [day, setDay] = useState(String(Math.round(g.cap * 0.6)));
  const n = +cap;
  return (
    <Dialog
      title={`Cap for ${g.source}`}
      sub="Applies to every product reading from this source."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="check" disabled={!n || n < 10} why="Give a cap of at least 10." onClick={() => { const w = win === 'Business hours' ? `09:00–19:00 IST: ${day} ${g.unit}` : ''; audit({ who: 'priya.raman', customer: 'h360', what: 'Changed a read-rate cap', object: g.source, when: ctx.now(), r: 'ok', before: [['Cap', `${g.cap} ${g.unit}`]], after: [['Cap', `${n} ${g.unit}`]] }); ctx.toast(`Cap for ${g.source} is now ${n} ${g.unit}`, 'ok'); onSave(n, w); }}>
            Save
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="gv-c" label={`Cap (${g.unit})`}><TextInput id="gv-c" value={cap} onChange={v => setCap(v.replace(/\D/g, ''))} inputMode="numeric" /></Field>
        <Field id="gv-w" label="Lower cap during"><SelectInput id="gv-w" value={win} onChange={setWin} options={['None', 'Business hours']} /></Field>
        {win === 'Business hours' ? <Field id="gv-d" label={`Business-hours cap (${g.unit})`}><TextInput id="gv-d" value={day} onChange={v => setDay(v.replace(/\D/g, ''))} inputMode="numeric" /></Field> : null}
      </div>
      {n && n < g.now ? (
        <p style={{ display: 'flex', gap: 8, color: 'var(--tx)' }}>
          <Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: 2 }} />
          Lower than what is read now ({g.now} {g.unit}); running jobs slow down within 10 s.
        </p>
      ) : null}
    </Dialog>
  );
}
