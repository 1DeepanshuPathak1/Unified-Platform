import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { Btn, Field, Seg, SelectInput, TextInput } from '../../ui/controls';
import { Bar, Facts, MiniTable, Panel, Tiles } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName } from '../../platform/common';
import { audit } from '../../platform/store';

type Res = 'vcpu' | 'ram' | 'storage';
const RES: { k: Res; label: string; unit: string }[] = [
  { k: 'vcpu', label: 'vCPU', unit: 'vCPU' },
  { k: 'ram', label: 'Memory', unit: 'GB' },
  { k: 'storage', label: 'Storage', unit: 'TB' }
];
interface Site { id: string; name: string; where: string; physical: Record<Res, number>; overcommit: number; inUse: Record<Res, number>; read: string; unreach?: boolean }
const SITES: Site[] = [
  { id: 'pos', name: 'production-openstack', where: 'Chennai DC1 · 4 compute nodes', physical: { vcpu: 256, ram: 2048, storage: 120 }, overcommit: 1.5, inUse: { vcpu: 24, ram: 96, storage: 18.4 }, read: '16:04 IST' },
  { id: 'r2', name: 'region-2-os', where: 'Mumbai DC2 · 2 compute nodes', physical: { vcpu: 128, ram: 1024, storage: 60 }, overcommit: 1.5, inUse: { vcpu: 0, ram: 0, storage: 22.4 }, read: '14:52 IST', unreach: true }
];
/** Reservations sold, per site and customer. Colours follow the customer, never their rank. */
const RESV: { site: string; customer: string; vcpu: number; ram: number; storage: number }[] = [
  { site: 'pos', customer: 'h360', vcpu: 128, ram: 512, storage: 12 },
  { site: 'pos', customer: 'kav', vcpu: 16, ram: 64, storage: 2 },
  { site: 'r2', customer: 'mer', vcpu: 96, ram: 384, storage: 30 },
  { site: 'r2', customer: 'kav', vcpu: 16, ram: 64, storage: 2 },
  { site: 'r2', customer: 'h360', vcpu: 64, ram: 256, storage: 6 }
];
const SERIES: Record<string, string> = { h360: 'var(--series-1)', mer: 'var(--series-2)', kav: 'var(--series-3)' };
const sellable = (s: Site, r: Res) => (r === 'vcpu' ? Math.round(s.physical.vcpu * s.overcommit) : s.physical[r]);

/** Resilience › Overview › Site capacity: what each recovery site can hold, what is sold and what is in use. Provider only. */
export function SiteCapacity({ ctx }: { ctx: Ctx }) {
  const [resv, setResv] = useState(RESV);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const edit = useClosable<string>();
  const sold = (site: string, r: Res) => resv.filter(x => x.site === site).reduce((a, x) => a + x[r], 0);
  const worst = SITES.map(s => ({ s, pct: (sold(s.id, 'vcpu') / s.physical.vcpu) * 100 }));
  const cfg = ctx.can('admin', 'Changing DR reservations');
  return (
    <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tiles
        items={SITES.map(s => ({ label: s.name, value: `${Math.round((sold(s.id, 'vcpu') / sellable(s, 'vcpu')) * 100)}`, unit: '% of vCPU sold', icon: s.unreach ? 'triangle-alert' : 'cloud', tone: s.unreach ? 'warn' : undefined, sub: `${sold(s.id, 'vcpu')} reserved of ${sellable(s, 'vcpu')} (${s.physical.vcpu} cores × ${s.overcommit})${s.unreach ? ' · last read 14:52' : ''}` })).concat([{ label: 'In use now', value: `${SITES.reduce((a, s) => a + s.inUse.vcpu, 0)}`, unit: 'vCPU', icon: 'power', tone: undefined, sub: 'Web tier test copies on production-openstack' }])}
      />
      {SITES.some(s => s.unreach) ? <Bar tone="warn">region-2-os has not answered since 14:52 IST. Its figures are from the last good reading; reservations are not changed.</Bar> : null}
      <Panel
        title="Reserved and in use, by site"
        right={<Seg label="Show as" value={view} onChange={setView} panel={false} options={[{ v: 'chart', label: 'Chart', icon: 'layers' }, { v: 'table', label: 'Table', icon: 'list' }]} />}
      >
        <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 16, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', flexWrap: 'wrap' }}>
            {Object.keys(SERIES).map(c => <span key={c} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 10, height: 10, background: SERIES[c] }} />{custName(c)}</span>)}
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 10, height: 10, background: 'var(--ln)' }} />Not sold</span>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 2, height: 12, background: 'var(--tx)' }} />In use now</span>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 10, height: 0, borderTop: '2px dashed var(--tx-3)' }} />Physical (without over-commit)</span>
          </div>
          {view === 'chart'
            ? SITES.map(s => (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontWeight: 600 }}>{s.name} <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>{s.where}</span></span>
                  {RES.map(r => {
                    const cap = sellable(s, r.k);
                    const parts = resv.filter(x => x.site === s.id);
                    const total = sold(s.id, r.k);
                    const scale = Math.max(cap, total);
                    return (
                      <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr) 230px', gap: 12, alignItems: 'center' }}>
                        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>{r.label}</span>
                        <div role="img" aria-label={`${s.name} ${r.label}: ${parts.map(p => `${custName(p.customer)} ${p[r.k]} ${r.unit}`).join(', ')}; ${total} of ${cap} ${r.unit} sold; ${s.inUse[r.k]} in use`} style={{ position: 'relative', height: 16, display: 'flex', gap: 2 }}>
                          {parts.map(p => <span key={p.customer} tabIndex={0} data-tip={`${custName(p.customer)}: ${p[r.k]} ${r.unit} reserved`} style={{ width: `${(p[r.k] / scale) * 100}%`, background: SERIES[p.customer] }} />)}
                          <span style={{ flex: 1, background: 'var(--ln)' }} data-tip={`Not sold: ${Math.max(0, cap - total)} ${r.unit}`} />
                          <span aria-hidden style={{ position: 'absolute', left: `${(s.inUse[r.k] / scale) * 100}%`, top: -3, bottom: -3, width: 2, background: 'var(--tx)' }} />
                          {r.k === 'vcpu' ? <span aria-hidden style={{ position: 'absolute', left: `${(s.physical.vcpu / scale) * 100}%`, top: -5, bottom: -5, borderLeft: '2px dashed var(--tx-3)' }} /> : null}
                        </div>
                        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{total} of {cap} {r.unit} sold · {s.inUse[r.k]} in use</span>
                      </div>
                    );
                  })}
                </div>
              ))
            : (
              <MiniTable
                label="Capacity by site"
                cols={[{ label: 'Site', w: '170px' }, { label: 'Resource', w: '90px' }, { label: 'Can sell', w: '100px', r: true }, { label: 'Reserved', w: '100px', r: true }, { label: 'In use', w: '90px', r: true }, { label: 'By customer' }]}
                rows={SITES.flatMap(s => RES.map(r => [s.name, r.label, `${sellable(s, r.k)} ${r.unit}`, `${sold(s.id, r.k)} ${r.unit}`, `${s.inUse[r.k]} ${r.unit}`, resv.filter(x => x.site === s.id).map(x => `${custName(x.customer).split(' ')[0]} ${x[r.k]}`).join(' · ')]))}
              />
            )}
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Reservations">
          <div style={{ padding: '0 16px 8px' }}>
            <MiniTable
              label="Reservations"
              cols={[{ label: 'Customer' }, { label: 'Site', w: '170px' }, { label: 'vCPU', w: '64px', r: true }, { label: 'Memory', w: '80px', r: true }, { label: 'Storage', w: '76px', r: true }, { label: '', w: '70px', r: true }]}
              rows={resv.map(x => [<span key="c" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 8, height: 8, background: SERIES[x.customer] }} />{custName(x.customer)}</span>, SITES.find(s => s.id === x.site)!.name, String(x.vcpu), `${x.ram} GB`, `${x.storage} TB`, <Btn key="e" kind="ghost" size="sm" perm={cfg} onClick={() => edit.open(`${x.site}|${x.customer}`)}>Edit…</Btn>])}
            />
          </div>
        </Panel>
        <Panel title="If they fail over together">
          <div style={{ padding: '0 16px 8px' }}>
            <MiniTable
              label="Scenarios"
              cols={[{ label: 'Scenario' }, { label: 'vCPU needed', w: '110px', r: true }, { label: 'Fits', w: '110px' }]}
              rows={[
                ['Chennai-proxmox-prod lost', 128, SITES[0]],
                ['Meridian primary lost', 96, SITES[1]],
                ['Chennai DC1 lost (all Host360 and Kaveri)', 80, SITES[1]],
                ['Every reservation at region-2-os at once', sold('r2', 'vcpu'), SITES[1]]
              ].map(([n, v, s]) => {
                const site = s as Site;
                const fits = (v as number) <= site.physical.vcpu;
                const tight = !fits && (v as number) <= sellable(site, 'vcpu');
                return [<span key="n" data-tip={`At ${site.name}`}>{n as string}</span>, `${v} of ${site.physical.vcpu}`, fits ? <span key="f" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="circle-check" style={{ color: 'var(--ok)' }} />Fits</span> : tight ? <span key="f" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} data-tip="Only with CPU over-commit; expect slower response"><Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />Over-committed</span> : <span key="f" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="circle-x" style={{ color: 'var(--err)' }} />Does not fit</span>];
              })}
            />
            <p style={{ padding: '8px 0', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Over-commit is allowed up to {SITES[0].overcommit}× on vCPU only; memory and storage are never over-committed. Worst site today: {worst.sort((a, b) => b.pct - a.pct)[0].s.name} at {Math.round(worst[0].pct)} % of its cores.</p>
          </div>
        </Panel>
      </div>
      {edit.value ? (
        <EditResv
          ctx={ctx}
          r={resv.find(x => `${x.site}|${x.customer}` === edit.value)!}
          site={SITES.find(s => s.id === edit.value!.split('|')[0])!}
          others={sold(edit.value.split('|')[0], 'vcpu') - resv.find(x => `${x.site}|${x.customer}` === edit.value)!.vcpu}
          closing={edit.closing}
          onClose={edit.close}
          onSave={n => { setResv(x => x.map(y => (`${y.site}|${y.customer}` === edit.value ? n : y))); edit.close(); }}
        />
      ) : null}
    </div>
  );
}

function EditResv({ ctx, r, site, others, closing, onClose, onSave }: { ctx: Ctx; r: (typeof RESV)[number]; site: Site; others: number; closing: boolean; onClose: () => void; onSave: (r: (typeof RESV)[number]) => void }) {
  const [v, setV] = useState({ vcpu: String(r.vcpu), ram: String(r.ram), storage: String(r.storage) });
  const n = { vcpu: +v.vcpu || 0, ram: +v.ram || 0, storage: +v.storage || 0 };
  const over = others + n.vcpu > sellable(site, 'vcpu');
  const [policy, setPolicy] = useState('Refuse above the over-commit limit');
  return (
    <Dialog
      title={`${custName(r.customer)} at ${site.name}`}
      sub="What is held for this customer at the recovery site, whether or not it is in use."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={over && policy.startsWith('Refuse')} why={`Only ${sellable(site, 'vcpu') - others} vCPU are left to sell at ${site.name}.`} onClick={() => { audit({ who: 'priya.raman', customer: r.customer, what: 'Changed a DR reservation', object: site.name, when: ctx.now(), r: 'ok', before: [['vCPU', String(r.vcpu)]], after: [['vCPU', String(n.vcpu)]] }); ctx.toast(`Reservation for ${custName(r.customer)} at ${site.name} saved; their quota follows`, 'ok'); onSave({ ...r, ...n }); }}>Save</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
        <Field id="rv-c" label="vCPU" err={over ? `Over by ${others + n.vcpu - sellable(site, 'vcpu')}` : null}><TextInput id="rv-c" value={v.vcpu} onChange={x => setV(s => ({ ...s, vcpu: x.replace(/\D/g, '') }))} inputMode="numeric" invalid={over} /></Field>
        <Field id="rv-r" label="Memory (GB)"><TextInput id="rv-r" value={v.ram} onChange={x => setV(s => ({ ...s, ram: x.replace(/\D/g, '') }))} inputMode="numeric" /></Field>
        <Field id="rv-s" label="Storage (TB)"><TextInput id="rv-s" value={v.storage} onChange={x => setV(s => ({ ...s, storage: x.replace(/[^\d.]/g, '') }))} inputMode="numeric" /></Field>
      </div>
      <Field id="rv-p" label="Above the limit"><SelectInput id="rv-p" value={policy} onChange={setPolicy} options={['Refuse above the over-commit limit', 'Allow with sign-off from the Head of cloud operations']} /></Field>
      <Facts items={[{ k: 'Left to sell', v: `${sellable(site, 'vcpu') - others - n.vcpu} vCPU at ${site.name}` }, { k: 'Customer quota', v: 'Billing › Quotas is updated to match' }]} />
    </Dialog>
  );
}
