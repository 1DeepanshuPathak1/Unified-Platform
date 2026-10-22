import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { INTEGRATIONS, type Integ, type IntegCat } from '../data/integrations';
import { Btn, Field, FilterInput, Seg, SelectInput, TextInput } from '../ui/controls';
import { Bar, Facts, Spacer, Status, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit, update, useStore } from './store';

const CATS: IntegCat[] = ['Service desk', 'Chat and paging', 'Identity', 'Monitoring', 'CMDB', 'Security (SIEM)', 'DNS and IPAM', 'PSA and RMM', 'Payments', 'Accounting', 'Marketplaces'];
const ST = { connected: ['circle-check', 'ok', 'Connected'], available: ['plus', 'tx', 'Available'], attention: ['triangle-alert', 'warn', 'Needs attention'] } as const;

/** Automation › Integrations: every system Aegis talks to, connected or ready to connect. */
export function IntegrationsTab({ ctx }: { ctx: Ctx }) {
  const list = useStore().integrations;
  const setList = (fn: (x: Integ[]) => Integ[]) => update(s => { s.integrations = fn(s.integrations); });
  const [cat, setCat] = useState('All');
  const [show, setShow] = useState<'all' | 'connected'>('all');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const connect = useClosable<string>();
  const ql = q.trim().toLowerCase();
  const rows = list.filter(i => (cat === 'All' || i.cat === cat) && (show === 'all' || i.state !== 'available') && (!ql || `${i.name} ${i.what} ${i.cat}`.toLowerCase().includes(ql)));
  const d = drawer.value ? list.find(i => i.id === drawer.value) : null;
  const cfg = ctx.can('configure', 'Connecting integrations');
  return (
    <>
      {list.some(i => i.state === 'attention') ? <div style={{ padding: '0 24px 12px' }}><Bar tone="warn" actions={<Btn kind="ghost" size="sm" onClick={() => { setShow('connected'); setCat('All'); setQ(''); }}>Show them</Btn>}>{plural(list.filter(i => i.state === 'attention').length, 'integration')} need attention: {list.filter(i => i.state === 'attention').map(i => i.name).join(', ')}. Each card says why.</Bar></div> : null}
      <Toolbar>
        <Seg label="Show" value={show} onChange={setShow} options={[{ v: 'all', label: 'All', count: list.length }, { v: 'connected', label: 'Connected', count: list.filter(i => i.state !== 'available').length }]} />
        <SelectInput value={cat} onChange={setCat} options={['All', ...CATS].map(c => ({ v: c, label: c === 'All' ? 'Every category' : c }))} width={200} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter integrations" label="Filter integrations" width={220} />
        <Spacer />
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12, alignContent: 'start' }}>
        {rows.map(i => (
          <button key={i.id} type="button" onClick={() => (i.manage ? ctx.go(i.manage) : i.state === 'available' ? connect.open(i.id) : drawer.open(i.id))} className={pc('hover', 'border-color:var(--ln-2);background:var(--hover)')} style={{ textAlign: 'left', border: '1px solid var(--ln)', background: 'var(--panel)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 128 }}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span aria-hidden style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', border: '1px solid var(--ln-2)', font: '700 12px var(--f-ui)', color: 'var(--tx-2)' }}>{i.name.slice(0, 2)}</span>
              <strong style={{ fontWeight: 600, flex: 1 }}>{i.name}</strong>
              <Status icon={ST[i.state][0]} tone={ST[i.state][1]} label={ST[i.state][2]} />
            </span>
            <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{i.cat}</span>
            <span style={{ color: 'var(--tx-2)', font: '13px/18px var(--f-body)' }}>{i.what}</span>
            {i.state === 'attention' && !i.manage ? <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--warn)', marginTop: 'auto' }}>{i.detail}</span> : null}
            {i.manage ? <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--acc-tx)', marginTop: 'auto' }}>{i.detail ? `${i.detail} · ` : ''}Managed in {i.manage.startsWith('settings') ? 'Settings › Single sign-on' : 'Alerts & Activity › Platform health'}</span> : null}
          </button>
        ))}
        {!rows.length ? <p style={{ color: 'var(--tx-2)' }}>No integrations match. <button type="button" onClick={() => { setCat('All'); setQ(''); setShow('all'); }} style={{ color: 'var(--acc-tx)', fontWeight: 600 }}>Clear filters</button></p> : null}
      </div>
      {d ? (
        <Drawer
          label="Integration"
          kicker={`Integration · ${d.cat}`}
          title={d.name}
          status={<Status icon={ST[d.state][0]} tone={ST[d.state][1]} label={ST[d.state][2]} />}
          actions={<><Btn kind="outline" icon="refresh-cw" onClick={() => ctx.toast(d.state === 'attention' ? `${d.name}: still failing (token revoked)` : `${d.name} answered in 240 ms`, d.state === 'attention' ? 'err' : 'ok')}>Test</Btn>{d.state === 'attention' ? <Btn kind="primary" icon="key" perm={cfg} onClick={() => connect.open(d.id)}>Reconnect…</Btn> : null}<Spacer /><Btn kind="ghost" icon="plug" perm={cfg} onClick={() => { setList(x => x.map(y => (y.id === d.id ? { ...y, state: 'available', since: undefined, detail: undefined } : y))); drawer.close(); audit({ who: 'priya.raman', customer: 'h360', what: 'Disconnected an integration', object: d.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.name} disconnected; ${plural(d.uses?.length || 0, 'feature')} that used it fall back to e-mail`, 'warn'); }}>Disconnect</Btn></>}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.state === 'attention' ? <Bar tone="warn" multiline>{d.detail}</Bar> : null}
            <Facts items={[{ k: 'Does', v: d.what }, { k: 'Connected', v: d.since || '—' }, { k: 'Details', v: d.detail || '—' }, ...d.fields.map(([k, v]) => ({ k, v: v || '—' }))]} />
            {d.uses?.length ? (
              <div>
                <div style={{ font: '600 13px/18px var(--f-ui)', marginBottom: 6 }}>Used by</div>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>{d.uses.map(u => <li key={u} style={{ display: 'flex', gap: 8 }}><Icon name="arrow-right" style={{ color: 'var(--tx-3)', marginTop: 2 }} />{u}</li>)}</ul>
              </div>
            ) : null}
          </div>
        </Drawer>
      ) : null}
      {connect.value ? (
        <ConnectDialog
          i={list.find(x => x.id === connect.value)!}
          closing={connect.closing}
          onClose={connect.close}
          onDone={() => {
            const i = list.find(x => x.id === connect.value)!;
            setList(x => x.map(y => (y.id === i.id ? { ...y, state: 'connected', since: ctx.now(), detail: y.detail?.includes('revoked') ? 'Reinstalled; token valid' : 'Connected and tested' } : y)));
            audit({ who: 'priya.raman', customer: 'h360', what: 'Connected an integration', object: i.name, when: ctx.now(), r: 'ok' });
            ctx.toast(`${i.name} connected`, 'ok');
            connect.close();
          }}
        />
      ) : null}
    </>
  );
}

function ConnectDialog({ i, closing, onClose, onDone }: { i: Integ; closing: boolean; onClose: () => void; onDone: () => void }) {
  const [vals, setVals] = useState<string[]>(i.fields.map(f => (f[1].includes('•') || f[1].includes('…') ? '' : f[1])));
  const [tested, setTested] = useState<'no' | 'run' | 'ok'>('no');
  const ok = vals.every(v => v.trim().length >= 2) && tested === 'ok';
  return (
    <Dialog
      title={`Connect ${i.name}`}
      sub={i.what}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="outline" icon={tested === 'run' ? 'loader-circle' : 'refresh-cw'} spin={tested === 'run'} disabled={!vals.every(v => v.trim().length >= 2) || tested === 'run'} why="Fill in every field first." onClick={() => { setTested('run'); window.setTimeout(() => setTested('ok'), 1000); }}>{tested === 'ok' ? 'Test passed' : 'Test'}</Btn><Btn kind="primary" icon="plug" disabled={!ok} why={tested !== 'ok' ? 'Test the connection first.' : 'Fill in every field.'} onClick={onDone}>Connect</Btn></>}
    >
      {i.fields.map(([k], n) => (
        <Field key={k} id={`ic-${n}`} label={k}><TextInput id={`ic-${n}`} value={vals[n]} onChange={v => { setVals(x => x.map((y, j) => (j === n ? v : y))); setTested('no'); }} mono type={/key|token|secret/i.test(k) ? 'password' : 'text'} /></Field>
      ))}
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Secrets go into the credential vault and are never shown again.</p>
    </Dialog>
  );
}
