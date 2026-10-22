import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { T } from '../data/platform';
import { Btn, CheckBox, Field, SelectInput, Tag } from '../ui/controls';
import { Bar, Facts, MiniTable, Panel, Spacer, Toolbar } from '../ui/layout';
import { Dialog, Drawer, StepUp, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope } from './common';
import { audit } from './store';

const REGIONS = ['India South', 'India West', 'EU Central', 'US East'] as const;
type Region = (typeof REGIONS)[number];
/** Where each destination physically is. */
const PLACES: { name: string; kind: string; region: Region; city: string }[] = [
  { name: 'Chennai-proxmox-prod', kind: 'Site', region: 'India South', city: 'Chennai' },
  { name: 'production-openstack', kind: 'Site', region: 'India South', city: 'Chennai' },
  { name: 'region-2-os', kind: 'Recovery site', region: 'India West', city: 'Mumbai' },
  { name: 'obj-check', kind: 'Repository', region: 'India South', city: 'Chennai' },
  { name: 'copy-check-repo', kind: 'Repository', region: 'India South', city: 'Chennai' },
  { name: 'mer-obj-immutable', kind: 'Repository', region: 'India West', city: 'Mumbai' },
  { name: 'fra-obj-01', kind: 'Repository', region: 'EU Central', city: 'Frankfurt' },
  { name: 'Support bundle store', kind: 'Service', region: 'India South', city: 'Chennai' }
];
interface Rule { customer: string; regions: Region[]; frameworks: string[]; metadata: boolean; why: string }
const RULES: Rule[] = [
  { customer: 'h360', regions: ['India South', 'India West'], frameworks: ['DPDP'], metadata: true, why: 'Host360 keeps its own data in India' },
  { customer: 'mer', regions: ['India South', 'India West'], frameworks: ['RBI data localisation', 'DPDP'], metadata: false, why: 'RBI: payment system data stored only in India; no metadata abroad either' },
  { customer: 'kav', regions: ['India South', 'India West'], frameworks: ['DPDP'], metadata: true, why: 'Contract clause 9.2' },
  { customer: 'sah', regions: ['India South', 'India West'], frameworks: ['DPDP (sensitive personal data)', 'NABH'], metadata: false, why: 'Patient records; DPDP significant data fiduciary' },
  { customer: 'nil', regions: ['India South'], frameworks: ['DPDP'], metadata: true, why: 'Trial; one region only' },
  { customer: 'atl', regions: ['EU Central'], frameworks: ['GDPR'], metadata: true, why: 'GDPR; no transfer outside the EU without SCCs' },
  { customer: 'cor', regions: ['India South', 'India West'], frameworks: ['IRDAI', 'DPDP'], metadata: true, why: 'IRDAI outsourcing guidelines' }
];
const REFUSALS = [
  { when: T('12 Oct', '11:20'), customer: 'mer', who: 'arun.kumar', what: 'Policy Production daily: offsite copy to fra-obj-01', why: 'fra-obj-01 is in EU Central; Meridian allows India only (RBI data localisation)' },
  { when: T('03 Oct', '16:45'), customer: 'atl', who: 'meera.iyer', what: 'Recovery plan: recovery site region-2-os', why: 'region-2-os is in India West; Atlas Freight allows EU Central only (GDPR)' },
  { when: T('29 Sep', '10:02'), customer: 'sah', who: 'deepa.s', what: 'Support bundle upload with logs', why: 'Sahyadri does not allow metadata to leave India; the bundle was redacted and kept in Chennai' }
];
const ACTIONS = ['Backup policy: primary repository', 'Backup policy: offsite copy', 'Recovery plan: recovery site', 'Migration: destination', 'Support bundle upload', 'Report delivery (storage)'];

/** Security & Compliance › Data residency: where each customer's data may be, checked whenever something is saved. */
export function ResidencyTab({ ctx }: { ctx: Ctx }) {
  const [rules, setRules] = useState<Rule[]>(RULES);
  const drawer = useClosable<string>();
  const edit = useClosable<string>();
  const rows = rules.filter(r => inScope(ctx, r.customer));
  const d = drawer.value ? rules.find(r => r.customer === drawer.value) : null;
  const [sc, setSc] = useState(rows[0]?.customer || 'mer');
  const [sa, setSa] = useState(ACTIONS[1]);
  const [sd, setSd] = useState('fra-obj-01');
  const rule = rules.find(r => r.customer === sc)!;
  const place = PLACES.find(p => p.name === sd)!;
  const allowed = rule && (sa === 'Support bundle upload' && !rule.metadata ? false : rule.regions.includes(place.region));
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Checked when a policy, plan, migration or upload is saved. A refusal says which rule and why, before anything moves.</span>
        <Spacer />
      </Toolbar>
      <div style={{ padding: '0 24px', flex: 'none' }}>
        <AegisTable
          label="Residency rules"
          cols={[{ k: 'c', label: 'Customer', w: 'minmax(180px,1.3fr)' }, { k: 'r', label: 'Data may be in', w: 'minmax(190px,1.4fr)' }, { k: 'f', label: 'Because of', w: 'minmax(190px,1.4fr)', dim: true }, { k: 'm', label: 'Metadata abroad', w: '140px' }, { k: 'x', label: 'Refused (30 d)', w: '120px', r: true }]}
          rows={rows.map(r => ({ id: r.customer, c: { v: custName(r.customer), strong: true }, r: r.regions.join(', '), f: { v: r.frameworks.join(', '), tip: r.why }, m: r.metadata ? 'Allowed' : { t: 'status', i: 'ban', c: 'tx', l: 'Not allowed' }, x: { v: String(REFUSALS.filter(x => x.customer === r.customer).length), s: REFUSALS.filter(x => x.customer === r.customer).length } }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['customer', 'customers']}
          emptyText="No residency rules yet. Each customer gets one when onboarded, from their country and frameworks."
        />
      </div>
      <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Check a destination">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field id="rz-c" label="Customer"><SelectInput id="rz-c" value={sc} onChange={setSc} options={rows.map(r => ({ v: r.customer, label: custName(r.customer) }))} /></Field>
              <Field id="rz-d" label="Destination"><SelectInput id="rz-d" value={sd} onChange={setSd} options={PLACES.map(p => ({ v: p.name, label: `${p.name} (${p.city})` }))} /></Field>
            </div>
            <Field id="rz-a" label="When saving"><SelectInput id="rz-a" value={sa} onChange={setSa} options={ACTIONS} /></Field>
            <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: `1px solid var(--${allowed ? 'ok' : 'err'})`, background: `var(--${allowed ? 'ok' : 'err'}-s)` }}>
              <Icon name={allowed ? 'circle-check' : 'ban'} style={{ color: `var(--${allowed ? 'ok' : 'err'})`, marginTop: 2 }} />
              <span>{allowed ? `Allowed: ${sd} is in ${place.region}, which ${custName(sc)} allows.` : sa === 'Support bundle upload' && !rule.metadata ? `Refused: ${custName(sc)} does not allow metadata to leave the country. The bundle is redacted and kept in Chennai.` : `Refused: ${sd} is in ${place.region}; ${custName(sc)} allows ${rule.regions.join(' and ')} only (${rule.frameworks[0]}).`}</span>
            </div>
          </div>
        </Panel>
        <Panel title="Where each destination is">
          <div style={{ padding: '0 16px 8px' }}>
            <MiniTable label="Destinations" cols={[{ label: 'Destination' }, { label: 'Kind', w: '110px' }, { label: 'Region', w: '180px' }]} rows={PLACES.map(p => [<strong key="n" style={{ fontWeight: 600 }}>{p.name}</strong>, p.kind, `${p.region} · ${p.city}`])} />
          </div>
        </Panel>
      </div>
      {d ? (
        <Drawer
          label="Residency rule"
          kicker="Data residency"
          title={custName(d.customer)}
          status={<span>{d.regions.join(', ')}</span>}
          actions={!ctx.actingAs ? <Btn kind="outline" icon="pencil" perm={ctx.can('admin', 'Changing residency rules')} onClick={() => edit.open(d.customer)}>Edit rule…</Btn> : undefined}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Facts items={[{ k: 'Data may be in', v: d.regions.join(', ') }, { k: 'Frameworks', v: <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{d.frameworks.map(f => <Tag key={f}>{f}</Tag>)}</span> }, { k: 'Why', v: d.why }, { k: 'Metadata abroad', v: d.metadata ? 'Allowed (job names, sizes and timings for support)' : 'Not allowed: support bundles are redacted and stay in the country' }, { k: 'Checked when saving', v: ACTIONS.join(' · ') }]} />
            <MiniTable label="Refusals" cols={[{ label: 'When', w: '120px' }, { label: 'What was refused' }]} rows={REFUSALS.filter(x => x.customer === d.customer).map(x => [x.when.replace(' 2026', '').replace(' IST', ''), <span key="w" data-tip={`${x.why} (${x.who})`} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.what}</span>])} empty="Nothing refused in the last 30 days." />
          </div>
        </Drawer>
      ) : null}
      {edit.value ? (
        <EditRule
          ctx={ctx}
          r={rules.find(r => r.customer === edit.value)!}
          closing={edit.closing}
          onClose={edit.close}
          onSave={n => { setRules(x => x.map(y => (y.customer === n.customer ? n : y))); edit.close(); }}
        />
      ) : null}
    </div>
  );
}

function EditRule({ ctx, r, closing, onClose, onSave }: { ctx: Ctx; r: Rule; closing: boolean; onClose: () => void; onSave: (r: Rule) => void }) {
  const [regions, setRegions] = useState<Region[]>(r.regions);
  const [meta, setMeta] = useState(r.metadata);
  const [mfa, setMfa] = useState(false);
  const removed = r.regions.filter(x => !regions.includes(x));
  const added = regions.filter(x => !r.regions.includes(x));
  const stuck = removed.length ? PLACES.filter(p => removed.includes(p.region) && p.kind !== 'Service') : [];
  return (
    <Dialog
      title={`Residency for ${custName(r.customer)}`}
      sub="Applies to everything saved from now on. What already sits outside the new rule is listed, not moved."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!regions.length || !mfa} why={!regions.length ? 'Allow at least one region.' : 'Confirm it is you first.'} onClick={() => { audit({ who: 'priya.raman', customer: r.customer, what: 'Changed a residency rule', object: custName(r.customer), when: ctx.now(), r: 'ok', before: [['Regions', r.regions.join(', ')]], after: [['Regions', regions.join(', ')]] }); ctx.toast(`Residency for ${custName(r.customer)} saved`, 'ok'); onSave({ ...r, regions, metadata: meta }); }}>Save</Btn></>}
    >
      <Field label="Data may be in">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{REGIONS.map(x => <CheckBox key={x} on={regions.includes(x)} onChange={v => setRegions(s => (v ? [...s, x] : s.filter(y => y !== x)))}>{x}</CheckBox>)}</div>
      </Field>
      <CheckBox on={meta} onChange={setMeta}>Allow metadata (job names, sizes, timings) to leave the country for support</CheckBox>
      {added.some(x => x !== 'India South' && x !== 'India West') && r.frameworks.some(f => f.startsWith('RBI') || f.startsWith('DPDP (sensitive')) ? <Bar tone="warn" multiline>{r.frameworks[0]} does not allow data outside India. Adding {added.join(', ')} needs the customer’s DPO to sign off.</Bar> : null}
      {stuck.length ? <Bar tone="warn" multiline>Already outside the new rule if used: {stuck.map(p => p.name).join(', ')}. Existing copies stay until you move them; nothing new goes there.</Bar> : null}
      <StepUp verified={mfa} onVerified={() => setMfa(true)} />
    </Dialog>
  );
}

