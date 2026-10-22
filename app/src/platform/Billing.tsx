import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { T, type Entitlement } from '../data/platform';
import { Btn, Field, FilterInput, InfoTip, Seg, SelectInput, TextInput } from '../ui/controls';
import { Activity, Bar, DrawerTiles, Facts, Progress, Section, Spacer, TableArea, Toolbar } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, showCustomerCol } from './common';
import { audit, update, useStore } from './store';

const ST: Record<Entitlement['state'], [string, string, string]> = {
  active: ['circle-check', 'Active', 'ok'],
  trial: ['clock', 'Trial', 'run'],
  grace: ['clock', 'Grace period', 'warn'],
  overage: ['triangle-alert', 'Over limit', 'warn'],
  suspended: ['ban', 'Suspended', 'err'],
  expired: ['circle-x', 'Expired', 'err']
};

type Tab = 'entitlements';

export default function BillingSection({ ctx }: { ctx: Ctx }) {
  return (
    <Section<Tab>
      kicker="Administration"
      title="Billing & Licensing"
      sub="Licences for each product and customer, how much of each is used, and when they renew."
      tab="entitlements"
      onTab={t => ctx.go(`billing/${t}`)}
      tabs={[{ v: 'entitlements', label: 'Entitlements' }]}
    >
      <Entitlements ctx={ctx} />
    </Section>
  );
}

function Entitlements({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [view, setView] = useState<'all' | 'attention'>('all');
  const [q, setQ] = useState('');
  const [check, setCheck] = useState<'failed' | 'checking' | 'ok'>('failed');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const offline = useClosable<string>();
  const renew = useClosable<string>();
  const suspend = useClosable<string>();
  useEffect(() => {
    if (ctx.openId && s.entitlements.some(e => e.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = s.entitlements.filter(e => inScope(ctx, e.customer));
  const needs = (e: Entitlement) => e.state !== 'active' || e.days < 45 || e.used / e.limit >= 0.9;
  const ql = q.trim().toLowerCase();
  const rows = all.filter(e => (view === 'all' || needs(e)) && (!ql || `${custName(e.customer)} ${e.product} ${e.edition}`.toLowerCase().includes(ql)));
  const adm = ctx.can('admin', 'Changing licences');
  const d = drawer.value ? s.entitlements.find(e => e.id === drawer.value) : null;
  const custCol = showCustomerCol(ctx);
  const setState = (id: string, st: Entitlement['state'], extra?: Partial<Entitlement>) => update(x => Object.assign(x.entitlements.find(e => e.id === id)!, { state: st, ...extra }));
  return (
    <>
      {check !== 'ok' && !ctx.actingAs ? (
        <div style={{ padding: '0 24px 12px' }}>
          <Bar
            tone="warn"
            icon="key"
            actions={
              <Btn kind="ghost" size="sm" icon={check === 'checking' ? 'loader-circle' : 'refresh-cw'} spin={check === 'checking'} onClick={() => { setCheck('checking'); window.setTimeout(() => { setCheck('ok'); ctx.toast('Licences checked with license.host360.ai', 'ok'); }, 1100); }}>
                Check now
              </Btn>
            }
          >
            The licence could not be checked: license.host360.ai did not answer at 15:58 IST. Running and scheduled jobs continue for 14 days, until 04 Nov 2026, 15:58 IST.
          </Bar>
        </div>
      ) : null}
      <Toolbar>
        <Seg label="Show" value={view} onChange={setView} options={[{ v: 'all', label: 'All', count: all.length }, { v: 'attention', label: 'Needs attention', count: all.filter(needs).length }]} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter by customer, product or edition" label="Filter entitlements" />
        <Spacer />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>
          Last checked {check === 'ok' ? ctx.now() : T('21 Oct', '12:00')}
          <InfoTip tip="If the licence server cannot be reached, Aegis keeps working for 14 days (fail-open). Nothing is stopped; you are warned daily." />
        </span>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Entitlements"
          cols={[
            ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(170px,1.3fr)' }] : []),
            { k: 'prod', label: 'Product', w: '120px' },
            { k: 'ed', label: 'Edition', w: 'minmax(160px,1.2fr)', dim: true },
            { k: 'use', label: 'Used', w: '220px' },
            { k: 'term', label: 'Term', w: 'minmax(140px,1fr)', dim: true },
            { k: 'exp', label: 'Ends', w: '130px', r: true },
            { k: 'st', label: 'State', w: '136px' }
          ]}
          rows={rows.map(e => ({
            id: e.id,
            cust: { v: custName(e.customer), strong: true },
            prod: e.product === 'Bundle' ? 'All three' : e.product,
            ed: e.edition,
            use: { t: 'bar', pct: (e.used / e.limit) * 100, v: `${e.used} of ${e.limit} ${e.unit}`, c: e.used > e.limit ? 'err' : e.used / e.limit >= 0.9 ? 'warn' : 'ok' },
            term: e.term,
            exp: e.expires === 'Never' ? { v: 'Never', muted: true, s: 99999 } : { v: e.days < 45 ? `${e.expires} · ${e.days} d` : e.expires, s: e.days, strong: e.days < 21 },
            act: e.activation,
            st: { t: 'status', i: ST[e.state][0], l: ST[e.state][1], c: ST[e.state][2], tip: e.note || ST[e.state][1] }
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['entitlement', 'entitlements']}
          filtered={view !== 'all' || !!ql}
          onClear={() => { setView('all'); setQ(''); }}
          emptyText="No licences yet. They are created when a customer is onboarded with a plan."
          sort="exp"
          footR="Overage is billed; it never stops protection"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Entitlement details"
          kicker={`Licence · ${d.product === 'Bundle' ? 'Protection, Resilience and Mobility' : d.product}`}
          title={`${custName(d.customer)} · ${d.edition}`}
          status={
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name={ST[d.state][0]} style={{ color: `var(--${ST[d.state][2]})` }} />
                <span style={{ color: 'var(--tx)' }}>{ST[d.state][1]}</span>
              </span>
              <span>{d.expires === 'Never' ? 'Perpetual' : `Ends ${d.expires}`}</span>
            </>
          }
          actions={
            <>
              {d.state === 'trial' ? (
                <>
                  <Btn kind="outline" icon="arrow-up" perm={adm} onClick={() => { setState(d.id, 'active', { edition: 'Business', term: 'Monthly', note: undefined }); ctx.toast(`${custName(d.customer)} converted to Business; billing starts today`, 'ok'); }}>
                    Convert to paid
                  </Btn>
                  <Btn kind="outline" icon="calendar-clock" perm={adm} onClick={() => { setState(d.id, 'trial', { expires: '18 Nov 2026', days: 28 }); ctx.toast('Trial extended by 14 days', 'ok'); }}>
                    Extend trial
                  </Btn>
                </>
              ) : d.state === 'suspended' ? (
                <Btn kind="outline" icon="play" perm={adm} onClick={() => { setState(d.id, 'active', { note: undefined }); audit({ who: 'priya.raman', customer: d.customer, what: 'Reactivated a licence', object: `${d.product} · ${d.edition}`, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.product} reactivated for ${custName(d.customer)}`, 'ok'); }}>
                  Reactivate
                </Btn>
              ) : (
                <Btn kind="outline" icon="refresh-cw" perm={adm} onClick={() => renew.open(d.id)}>
                  {d.expires === 'Never' ? 'Renew support…' : 'Renew or change…'}
                </Btn>
              )}
              {d.activation === 'Offline file' ? (
                <Btn kind="outline" icon="upload" perm={adm} onClick={() => offline.open(d.id)}>
                  Activate offline…
                </Btn>
              ) : null}
              <Spacer />
              {d.state !== 'suspended' && d.state !== 'trial' ? (
                <Btn kind="danger" icon="ban" perm={adm} onClick={() => suspend.open(d.id)}>
                  Suspend…
                </Btn>
              ) : null}
            </>
          }
          tabs={[{ v: 'Overview', label: 'Overview' }, { v: 'History', label: 'History' }]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {d.note ? <Bar tone={d.state === 'suspended' ? 'err' : d.state === 'overage' ? 'warn' : 'info'} multiline>{d.note}</Bar> : null}
              <DrawerTiles
                items={[
                  { label: d.metric, value: `${d.used} of ${d.limit}`, sub: d.unit },
                  { label: 'Ends', value: d.expires === 'Never' ? 'Never' : `${d.days} days`, sub: d.support || d.expires },
                  { label: 'State', value: ST[d.state][1], icon: ST[d.state][0], tone: ST[d.state][2], sub: d.activation }
                ]}
              />
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', marginBottom: 6 }}>
                  <span>{d.metric}</span>
                  <span>{Math.round((d.used / d.limit) * 100)} %</span>
                </div>
                <Progress pct={(d.used / d.limit) * 100} tone={d.used > d.limit ? 'err' : d.used / d.limit >= 0.9 ? 'warn' : 'ok'} />
              </div>
              <Facts items={[{ k: 'Customer', v: custName(d.customer) }, { k: 'Edition', v: d.edition }, { k: 'Term', v: d.term }, { k: 'Started', v: d.starts }, { k: 'Activation', v: d.activation === 'Online' ? 'Online; checked every 6 hours' : 'Offline licence file; renew by uploading a new file' }, ...(d.support ? [{ k: 'Support', v: d.support }] : [])]} />
            </div>
          ) : (
            <Activity
              items={[
                ...(d.state === 'overage' ? [{ icon: 'triangle-alert', tone: 'warn', text: `Went over its limit (${d.used} of ${d.limit} ${d.unit}); overage billed from this month`, when: T('15 Oct', '09:00') }] : []),
                ...(d.state === 'suspended' ? [{ icon: 'ban', tone: 'err', text: 'Suspended by dunning step 3', when: T('18 Oct', '10:00') }] : []),
                { icon: 'key', tone: 'ok', text: `Activated ${d.activation === 'Online' ? 'online' : 'with an offline file'}`, when: `${d.starts}, 10:00 IST` }
              ]}
            />
          )}
        </Drawer>
      ) : null}
      {offline.value ? <OfflineDialog ctx={ctx} closing={offline.closing} onClose={offline.close} /> : null}
      {renew.value ? <RenewDialog ctx={ctx} e={s.entitlements.find(x => x.id === renew.value)!} closing={renew.closing} onClose={renew.close} onSave={(limit, term) => { update(x => Object.assign(x.entitlements.find(e => e.id === renew.value)!, { limit, term, state: 'active', note: undefined })); ctx.toast('Licence updated; the change shows on the next invoice', 'ok'); renew.close(); }} /> : null}
      {suspend.value ? (
        <DangerDialog
          title={`Suspend ${s.entitlements.find(x => x.id === suspend.value)!.product} for ${custName(s.entitlements.find(x => x.id === suspend.value)!.customer)}`}
          intro="Use for non-payment. Exactly this stops:"
          removed={['New restores, failovers and cutovers for this product', 'Adding workloads, sites or policies for this product']}
          kept="Backups and replication keep running for 7 days so no recovery point is lost. Reactivating restores everything at once."
          name={custName(s.entitlements.find(x => x.id === suspend.value)!.customer)}
          action="Suspend licence"
          icon="ban"
          closing={suspend.closing}
          onClose={suspend.close}
          onConfirm={() => {
            const e = s.entitlements.find(x => x.id === suspend.value)!;
            setState(e.id, 'suspended', { note: `Suspended by priya.raman on ${ctx.now().slice(0, 11)}. Backups keep running for 7 days; restores are blocked.` });
            audit({ who: 'priya.raman', customer: e.customer, what: 'Suspended a licence', object: `${e.product} · ${e.edition}`, when: ctx.now(), r: 'ok' });
            ctx.toast(`${e.product} suspended for ${custName(e.customer)}`, 'warn');
            suspend.close();
          }}
        />
      ) : null}
    </>
  );
}

function OfflineDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [file, setFile] = useState(false);
  const code = 'AEG-REQ-7F2C-91DA-0B44-SAH-2026-10-21';
  return (
    <Dialog
      title="Activate offline"
      sub="For sites without internet access. Send the request code to Host360; upload the licence file you get back."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="key" disabled={!file} why="Upload the licence file first." onClick={() => { ctx.toast('Licence file accepted; support renews 13 Jul 2027', 'ok'); onClose(); }}>Activate</Btn></>}
    >
      <Field id="off-code" label="Request code">
        <div style={{ display: 'flex', gap: 8 }}>
          <TextInput id="off-code" value={code} readOnly mono width="100%" />
          <Btn kind="outline" icon="copy" onClick={() => { navigator.clipboard?.writeText(code).catch(() => undefined); ctx.toast('Request code copied', 'ok'); }}>Copy</Btn>
        </div>
      </Field>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px 12px 14px', border: '1px solid var(--ln-2)', background: 'var(--panel-2)' }}>
          <Icon name="file-text" size={20} style={{ color: 'var(--tx-2)' }} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>sahyadri-2027.lic</span>
            <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>2.1 KB · signed by Host360 · 25 workloads · support to 13 Jul 2027</span>
          </span>
          <button type="button" aria-label="Remove file" onClick={() => setFile(false)} style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', color: 'var(--tx-3)' }}><Icon name="x" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setFile(true)} className={pc('hover', 'border-color:var(--acc);background:var(--hover)')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 120, border: '1px dashed var(--ln-2)', color: 'var(--tx-2)' }}>
          <Icon name="upload" size={20} />
          <span><strong style={{ color: 'var(--tx)', fontWeight: 600 }}>Choose a .lic file</strong> or drop it here</span>
        </button>
      )}
    </Dialog>
  );
}

function RenewDialog({ ctx, e, closing, onClose, onSave }: { ctx: Ctx; e: Entitlement; closing: boolean; onClose: () => void; onSave: (limit: number, term: string) => void }) {
  const [limit, setLimit] = useState(String(Math.max(e.limit, e.used)));
  const [term, setTerm] = useState(e.term);
  const ok = /^\d+(\.\d+)?$/.test(limit) && +limit >= e.used;
  return (
    <Dialog
      title={`Renew or change ${e.product === 'Bundle' ? 'the bundle' : e.product} for ${custName(e.customer)}`}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" perm={ctx.can('admin', 'Changing licences')} disabled={!ok} why={`The limit cannot be below what is used (${e.used} ${e.unit}).`} onClick={() => onSave(+limit, term)}>Save</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="rn-l" label={`Limit (${e.unit})`} err={!ok ? `At least ${e.used}, the amount in use.` : null} hint={e.state === 'overage' ? `Raising it to ${e.used} or more ends the overage.` : undefined}>
          <TextInput id="rn-l" value={limit} onChange={setLimit} inputMode="numeric" invalid={!ok} />
        </Field>
        <Field id="rn-t" label="Term">
          <SelectInput id="rn-t" value={term} onChange={setTerm} options={[term, 'Monthly', 'Annual', 'Three years'].filter((x, i, a) => a.indexOf(x) === i)} />
        </Field>
      </div>
    </Dialog>
  );
}
