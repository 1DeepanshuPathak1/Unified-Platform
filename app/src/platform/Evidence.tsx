import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { CUSTOMERS } from '../data/platform';
import { Btn, CheckBox, Field, RadioCard, SelectInput, TextInput } from '../ui/controls';
import { Facts, MiniTable, Spacer, TableArea, Toolbar, plural } from '../ui/layout';
import { Drawer, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, showCustomerCol } from './common';
import { audit } from './store';

type Part = { k: string; product: 'Protection' | 'Resilience' | 'Mobility' | 'Platform'; icon: string; label: string; detail: string };
/** What can go into a pack. The icon follows the fixed meanings: padlock is immutability, shield is encryption. */
const PARTS: Part[] = [
  { k: 'bk', product: 'Protection', icon: 'archive', label: 'Backup success by workload', detail: 'Every scheduled backup in the period with its result; 99.2 % succeeded' },
  { k: 'rt', product: 'Protection', icon: 'rotate-ccw', label: 'Restore tests', detail: 'Each test restore with the time it took and how it was verified' },
  { k: 'im', product: 'Protection', icon: 'lock', label: 'Immutability proof', detail: 'Object-lock settings and retention of every copy, read back from the repository' },
  { k: 'dr', product: 'Resilience', icon: 'flask-conical', label: 'Drills with measured RPO and RTO', detail: 'Timeline per stage, health checks and screenshots, against the targets' },
  { k: 'fo', product: 'Resilience', icon: 'power', label: 'Failovers and returns to primary', detail: 'Who approved, how long, data lost, and the reconciliation report' },
  { k: 'rb', product: 'Resilience', icon: 'list-ordered', label: 'Recovery plan versions', detail: 'Every change to each plan with who made it and why' },
  { k: 'co', product: 'Mobility', icon: 'git-commit', label: 'Cutovers with go/no-go', detail: 'Checks, approvals, step-up and validation after each cutover' },
  { k: 'ar', product: 'Platform', icon: 'user-check', label: 'Access reviews', detail: 'Each review, its decisions and the reviewer’s signature' },
  { k: 'ap', product: 'Platform', icon: 'thumbs-up', label: 'Approvals', detail: 'Every approval asked for and given, with quorum' },
  { k: 'ky', product: 'Platform', icon: 'shield', label: 'Encryption keys', detail: 'Tenant keys, where they are held and every rotation' },
  { k: 'au', product: 'Platform', icon: 'scroll-text', label: 'Audit extract', detail: 'Audit records for the tenant in the period, hash-chained' }
];
const FRAMEWORKS: Record<string, string[]> = {
  'RBI IT framework (DR and BCP)': ['bk', 'rt', 'im', 'dr', 'fo', 'rb', 'ap', 'au'],
  'ISO 22301': ['rt', 'dr', 'fo', 'rb', 'au'],
  'ISO 27001 (A.5.29, A.8.13, A.8.14)': ['bk', 'rt', 'im', 'ar', 'ky', 'au'],
  'DPDP Act 2023': ['im', 'ar', 'ky', 'au'],
  'SOC 2 (A1.2, A1.3)': ['bk', 'rt', 'dr', 'ar', 'ap', 'au'],
  'IRDAI Information and Cyber Security Guidelines': ['bk', 'rt', 'im', 'dr', 'fo', 'au'],
  'SEBI CSCRF (BCP and DR)': ['bk', 'rt', 'im', 'dr', 'fo', 'rb', 'ap', 'au'],
  'DORA (Art. 11 and 12)': ['bk', 'rt', 'im', 'dr', 'fo', 'rb', 'au']
};
interface Pack { id: string; name: string; customer: string; framework: string; period: string; parts: string[]; built: string; by: string; state: 'Ready' | 'Building'; sha: string; shared?: string }
const PACKS: Pack[] = [
  { id: 'EVP-0311', name: 'RBI quarterly DR evidence, Q2 FY27', customer: 'mer', framework: 'RBI IT framework (DR and BCP)', period: '01 Jul to 30 Sep 2026', parts: FRAMEWORKS['RBI IT framework (DR and BCP)'], built: '01 Oct 2026, 09:10 IST', by: 'anitha.k@meridianbank.in', state: 'Ready', sha: '4e1a…9c02', shared: 'RBI inspection team, until 15 Oct 2026 (expired)' },
  { id: 'EVP-0309', name: 'ISO 27001 surveillance audit', customer: 'h360', framework: 'ISO 27001 (A.5.29, A.8.13, A.8.14)', period: '01 Oct 2025 to 30 Sep 2026', parts: FRAMEWORKS['ISO 27001 (A.5.29, A.8.13, A.8.14)'], built: '30 Sep 2026, 17:40 IST', by: 'priya.raman', state: 'Ready', sha: 'b7d3…0e51', shared: 'BSI auditor, until 20 Nov 2026' },
  { id: 'EVP-0302', name: 'Annual BCP test, NABH', customer: 'sah', framework: 'ISO 22301', period: '01 Apr to 30 Sep 2026', parts: FRAMEWORKS['ISO 22301'], built: '05 Oct 2026, 11:00 IST', by: 'deepa.s', state: 'Ready', sha: '22c8…7a14' }
];

/** Security & Compliance › Evidence: one signed pack across Protection, Resilience, Mobility and the platform. */
export function EvidenceTab({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Pack[]>(PACKS);
  const drawer = useClosable<string>();
  const build = useClosable<boolean>();
  useEffect(() => {
    if (ctx.openId && list.some(p => p.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = list.filter(p => inScope(ctx, p.customer));
  const d = drawer.value ? list.find(p => p.id === drawer.value) : null;
  const custCol = showCustomerCol(ctx);
  const perm = ctx.can('operate', 'Building evidence packs');
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>One pack for an auditor or regulator: records from every product, signed, with a manifest they can verify.</span>
        <Spacer />
        <Btn kind="primary" icon="file-check" perm={perm} onClick={() => build.open(true)}>Build an evidence pack</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Evidence packs"
          cols={[
            { k: 'n', label: 'Pack', w: 'minmax(220px,1.6fr)' },
            ...(custCol ? [{ k: 'c', label: 'Customer', w: 'minmax(150px,1fr)', dim: true }] : []),
            { k: 'f', label: 'Framework', w: 'minmax(170px,1.2fr)' },
            { k: 'p', label: 'Period', w: '190px', dim: true },
            { k: 'i', label: 'Contents', w: '100px', r: true },
            { k: 'sh', label: 'Shared with', w: 'minmax(150px,1fr)', dim: true },
            { k: 'st', label: 'State', w: '120px' }
          ]}
          rows={rows.map(p => ({
            id: p.id,
            n: { v: p.name, strong: true, tip: `${p.id} · built ${p.built} by ${p.by}` },
            c: custName(p.customer),
            f: p.framework,
            p: p.period,
            i: { v: plural(p.parts.length, 'part'), s: p.parts.length },
            sh: p.shared ? { v: p.shared, tip: p.shared } : { v: 'Not shared', muted: true },
            st: p.state === 'Ready' ? { t: 'status', i: 'badge-check', c: 'ok', l: 'Signed' } : { t: 'status', i: 'loader-circle', spin: true, c: 'run', l: 'Building' }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['pack', 'packs']}
          emptyText="No evidence packs yet. Build one for the next audit; it gathers records from every product."
          emptyAction="Build an evidence pack"
          onEmpty={() => build.open(true)}
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Evidence pack"
          kicker={`Evidence pack · ${d.id}`}
          title={d.name}
          status={<><span>{d.framework}</span><span>{d.period}</span></>}
          actions={
            <>
              <Btn kind="outline" icon="download" disabled={d.state !== 'Ready'} why="Still building." onClick={() => ctx.toast(`${d.id}.pdf and ${d.id}-manifest.json downloaded`, 'ok')}>Download</Btn>
              <Btn kind="outline" icon="send" perm={perm} disabled={d.state !== 'Ready'} why="Still building." onClick={() => { const until = '05 Nov 2026'; setList(x => x.map(p => (p.id === d.id ? { ...p, shared: `Auditor link, read-only, until ${until}` } : p))); audit({ who: 'priya.raman', customer: d.customer, what: 'Shared an evidence pack', object: d.id, when: ctx.now(), r: 'ok', note: `Read-only link until ${until}` }); ctx.toast(`Read-only link for ${d.id} copied; it expires ${until}`, 'ok'); }}>Share with an auditor</Btn>
            </>
          }
          width={640}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(['Protection', 'Resilience', 'Mobility', 'Platform'] as const).map(prod => {
              const parts = PARTS.filter(x => x.product === prod && d.parts.includes(x.k));
              return parts.length ? (
                <div key={prod}>
                  <div style={{ font: '600 13px/18px var(--f-ui)', marginBottom: 6 }}>{prod}</div>
                  <MiniTable label={prod} cols={[{ label: 'Part', w: '270px' }, { label: 'What it holds' }]} rows={parts.map(x => [<span key="l" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Icon name={x.icon} style={{ color: 'var(--tx-2)' }} />{x.label}</span>, <span key="d" data-tip={x.detail} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.detail}</span>])} />
                </div>
              ) : null;
            })}
            <Facts items={[{ k: 'Built', v: `${d.built} by ${d.by}` }, { k: 'Signature', v: `SHA-256 ${d.sha}, signed by aegis-orchestrator`, icon: 'badge-check', tone: 'ok' }, { k: 'Manifest', v: 'JSON listing every record with its own hash, so any page can be verified on its own' }, { k: 'Kept', v: '7 years in write-once storage', icon: 'lock' }, { k: 'Shared', v: d.shared || 'Not shared', muted: !d.shared }]} />
          </div>
        </Drawer>
      ) : null}
      {build.value ? (
        <BuildWizard
          ctx={ctx}
          closing={build.closing}
          onClose={build.close}
          onBuild={p => {
            setList(x => [p, ...x]);
            build.close();
            drawer.open(p.id);
            window.setTimeout(() => {
              setList(x => x.map(y => (y.id === p.id ? { ...y, state: 'Ready' } : y)));
              ctx.toast(`${p.name} is signed and ready`, 'ok');
            }, 2600);
          }}
        />
      ) : null}
    </>
  );
}

function BuildWizard({ ctx, closing, onClose, onBuild }: { ctx: Ctx; closing: boolean; onClose: () => void; onBuild: (p: Pack) => void }) {
  const custs = CUSTOMERS.filter(c => inScope(ctx, c.id) && c.status !== 'archived');
  const [step, setStep] = useState(0);
  const [cust, setCust] = useState(custs[0].id);
  const [fw, setFw] = useState(Object.keys(FRAMEWORKS)[0]);
  const [period, setPeriod] = useState('01 Jul to 30 Sep 2026');
  const [parts, setParts] = useState<string[]>(FRAMEWORKS[Object.keys(FRAMEWORKS)[0]]);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState<'customer' | 'host360'>('customer');
  const c = custs.find(x => x.id === cust)!;
  const ok = [true, parts.length > 0, name.trim().length >= 4][step];
  return (
    <Wizard
      title="Build an evidence pack"
      sub="Gathers records from every product for one customer and period, then signs them."
      steps={['Scope', 'Contents', 'Output']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={
        <Btn kind="primary" iconAfter={step < 2 ? 'arrow-right' : undefined} icon={step === 2 ? 'file-check' : undefined} disabled={!ok} why={step === 1 ? 'Pick at least one part.' : 'Name the pack.'} onClick={() => {
          if (step === 0 && !name) setName(`${fw.split(' (')[0]} evidence, ${period}`);
          if (step < 2) return setStep(step + 1);
          const p: Pack = { id: `EVP-0${312 + Math.floor(Math.random() * 80)}`, name: name.trim(), customer: cust, framework: fw, period, parts, built: ctx.now(), by: 'priya.raman', state: 'Building', sha: `${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}` };
          audit({ who: 'priya.raman', customer: cust, what: 'Built an evidence pack', object: p.name, when: ctx.now(), r: 'ok', after: [['Framework', fw], ['Parts', String(parts.length)]] });
          onBuild(p);
        }}>
          {step < 2 ? 'Next' : 'Build and sign'}
        </Btn>
      }
    >
      {step === 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field id="ev-c" label="Customer"><SelectInput id="ev-c" value={cust} onChange={setCust} options={custs.map(x => ({ v: x.id, label: x.name }))} /></Field>
            <Field id="ev-p" label="Period"><SelectInput id="ev-p" value={period} onChange={setPeriod} options={['01 Jul to 30 Sep 2026', '01 Apr to 30 Sep 2026', '01 Oct 2025 to 30 Sep 2026', '01 Oct 2026 to date']} /></Field>
          </div>
          <Field id="ev-f" label="Framework" hint={`${c.name} follows ${c.frameworks.join(', ')}.`}><SelectInput id="ev-f" value={fw} onChange={v => { setFw(v); setParts(FRAMEWORKS[v]); }} options={Object.keys(FRAMEWORKS)} /></Field>
        </>
      ) : null}
      {step === 1 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {(['Protection', 'Resilience', 'Mobility', 'Platform'] as const).map(prod => (
            <div key={prod} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: '600 13px/18px var(--f-ui)' }}>{prod}</span>
              {PARTS.filter(x => x.product === prod).map(x => (
                <CheckBox key={x.k} on={parts.includes(x.k)} onChange={v => setParts(s => (v ? [...s, x.k] : s.filter(y => y !== x.k)))}>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name={x.icon} style={{ color: 'var(--tx-3)' }} />{x.label}</span>
                </CheckBox>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {step === 2 ? (
        <>
          <Field id="ev-n" label="Name"><TextInput id="ev-n" value={name} onChange={setName} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <RadioCard on={brand === 'customer'} onClick={() => setBrand('customer')} title={c.whiteLabel ? `${c.whiteLabel} branding` : `${c.name} cover page`} note={c.whiteLabel ? 'White-labelled; Host360 does not appear' : 'Customer name on every page'} />
            <RadioCard on={brand === 'host360'} onClick={() => setBrand('host360')} title="Host360 branding" note="For packs Host360 submits itself" />
          </div>
          <Facts items={[{ k: 'Output', v: 'Signed PDF and a JSON manifest with a hash per record' }, { k: 'Parts', v: plural(parts.length, 'part') }, { k: 'Kept', v: '7 years in write-once storage', icon: 'lock' }]} />
        </>
      ) : null}
    </Wizard>
  );
}
