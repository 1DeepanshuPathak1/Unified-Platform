import { useState, type ReactNode } from 'react';
import AegisTable from '../components/AegisTable';
import { Btn, CheckBox, Field, FilterInput, RadioCard, Seg, SelectInput, TextInput } from '../ui/controls';
import { Dialog, useClosable } from '../ui/overlay';
import { audit } from './store';
import { Facts, MiniTable, Panel, Spacer, TableArea, Tiles, Toolbar } from '../ui/layout';
import type { Ctx } from '../ui/ctx';
import { Icon } from '../lib/Icon';
import { CopyCurl } from '../ui/CopyCurl';
import { BackupOutputs, DrOutputs, MigOutputs, QuoteDialog } from './CalcOutputs';

/* ---------------------------------------------------------------- One engine for all three calculators */

/** Assumptions every calculator shares, so the three answers always agree with each other. */
export interface Assume { change: number; dedupe: number; compress: number; mbps: number }
const DEFAULTS: Assume = { change: 3, dedupe: 2.2, compress: 1.5, mbps: 190 };

export const engine = {
  /** TB stored for a backup policy after reduction, and how it builds up. */
  backup(a: Assume, sourceTB: number, daily: number, weekly: number, monthly: number, yearly: number, copy: boolean) {
    const red = a.dedupe * a.compress;
    const inc = sourceTB * (a.change / 100);
    const parts: [string, number][] = [
      ['First full backup', sourceTB / red],
      [`${daily} daily points`, (inc * daily) / red],
      // Blocks that change repeatedly are counted once: a week holds about 2.5 days of unique change, a month about 5.
      [`${weekly} weekly points`, (inc * 2.5 * weekly) / red],
      [`${monthly} monthly points`, (inc * 5 * monthly) / red],
      [`${yearly} yearly points`, (sourceTB * 0.25 * yearly) / red]
    ];
    const one = parts.reduce((s, p) => s + p[1], 0);
    return { parts, one, total: copy ? one * 2 : one, red };
  },
  /** Capacity to reserve at the recovery site for the share of workloads that fail over together. */
  dr(a: Assume, vcpu: number, ramGB: number, storageTB: number, simul: number, overcommit: number, versions: number) {
    const share = simul / 100;
    return {
      vcpu: Math.ceil((vcpu * share) / overcommit),
      ram: Math.ceil(ramGB * share),
      storage: storageTB * (1 + (versions * a.change) / 100),
      test: storageTB * 0.08
    };
  },
  /** First-pass time, waves and downtime for moving servers at the shared copy rate. */
  migration(a: Assume, tb: number, servers: number, perWave: number, syncEveryH: number) {
    const firstH = (tb * 1024 * 1024) / a.mbps / 3600;
    const waves = Math.ceil(servers / perWave);
    const finalGB = (tb * 1024 * (a.change / 100) * syncEveryH) / 24 / servers;
    const downtimeMin = Math.round((finalGB * 1024) / a.mbps / 60 + 12);
    return { firstH, waves, weeks: waves + 2, downtimeMin };
  },
  /** What the backup design needs and costs: volumes, tiers, bandwidth, window, proxies, restore times, TCO and the downside. */
  backupDesign(a: Assume, sourceTB: number, b: { parts: [string, number][]; total: number; red: number }, windowH: number, lockD: number, monthly: number, copy: boolean) {
    const inc = sourceTB * (a.change / 100);
    const needMBs = (inc * 1024 * 1024) / (Math.max(1, windowH) * 3600);
    const workers = Math.max(1, Math.ceil(needMBs / a.mbps));
    const proxies = workers + 1;
    const windowEst = (inc * 1024 * 1024) / (a.mbps * workers) / 3600;
    const archive = b.parts[3][1] * (Math.max(0, monthly - 3) / Math.max(1, monthly)) + b.parts[4][1];
    const immutable = (sourceTB + inc * lockD) / b.red;
    const usable = b.total * 1.25;
    const price = { software: sourceTB * 3800, storage: b.total * 1450, egress: b.total * 0.03 * 900, infra: proxies * 9500 };
    const month = price.software + price.storage + price.egress + price.infra;
    const grow = (n: number) => Array.from({ length: n }, (_, y) => Math.pow(1.2, y)).reduce((x, y) => x + y, 0);
    const licence = sourceTB * 190000;
    const rest = (price.storage + price.egress + price.infra) * 12;
    const stored = (change: number, dedupe: number) => engine.backup({ ...a, change, dedupe }, sourceTB, 14, 4, monthly, 1, copy).total;
    return {
      inc, monthlyIngest: inc * 30, annualIngest: inc * 365, needMbps: needMBs * 8.39, proxies, windowEst, archive, rehydCost: archive * 2000, immutable, usable, raw: usable * 1.25,
      rtoVmMin: Math.round((200 * 1024) / a.mbps / 60), rtoSiteH: (sourceTB * 1024 * 1024) / (a.mbps * workers) / 3600,
      price, month, tco3: month * 12 * grow(3), tco5: month * 12 * grow(5), comp3: licence * (1 + 0.22 * 3) + rest * grow(3), comp5: licence * (1 + 0.22 * 5) + rest * grow(5),
      range: [stored(a.change * 0.8, a.dedupe * 1.2), b.total, stored(a.change * 1.5, a.dedupe * 0.7)] as [number, number, number],
      worseChange: stored(a.change * 1.5, a.dedupe), worseDedupe: stored(a.change, a.dedupe * 0.7)
    };
  },
  /** DR feasibility and cost: achievable RPO on the link, first copy, journal, RTO, DRaaS against building a site, downtime saved. */
  drDesign(a: Assume, d: { vcpu: number }, storageTB: number, linkMbps: number, rpoMin: number, histH: number, revLakh: number) {
    const perMinGB = (storageTB * 1024 * (a.change / 100)) / 1440 / a.compress;
    const needMbps = (perMinGB * 3 * 8192) / 60;
    const usable = Math.max(1, linkMbps) * 0.8;
    const ok = usable >= needMbps;
    const achievable = ok ? rpoMin : Math.ceil((rpoMin * needMbps) / usable);
    const seedDays = (storageTB * 8e6) / usable / 86400;
    const journal = (storageTB * (a.change / 100) * histH) / 24 / a.compress;
    const draas = storageTB * 2600 + journal * 1450 + d.vcpu * 420 + 11700;
    const build = { capex: 24000000, month: 900000 };
    const years = [1, 3, 5].map(y => ({ y, rent: draas * 12 * y, build: build.capex + build.month * 12 * y }));
    const outage = (h: number) => revLakh * 100000 * h;
    const rtoMin = 4 * 7 + 5 + 10;
    // One whole-site outage every four years, recovered from tape in 24 h today.
    const saving = (outage(24) - outage(rtoMin / 60)) * 0.25;
    return { needMbps, ok, achievable, seedDays, journal, rtoMin, draas, years, saving, payback: (draas * 12) / Math.max(1, saving / 12) };
  },
  /** Migration business case: one-off cost, run cost before and after, payback, NPV and TCO. */
  migCost(tb: number, servers: number, waves: number, vmwLakh: number, hosts: number) {
    const oneOff = servers * 18000 + waves * 5 * 45000 + tb * 1500;
    const current = (vmwLakh * 100000) / 12 + hosts * 38000 + hosts * 14000;
    const target = servers * 14500 * 0.78;
    const saving = current - target;
    const npv = [1, 2, 3].reduce((x, y) => x + (saving * 12) / Math.pow(1.1, y), 0) - oneOff;
    return { oneOff, current, target, saving, payback: saving > 0 ? oneOff / saving : Infinity, npv, years: [1, 3, 5].map(y => ({ y, current: current * 12 * y, target: oneOff + target * 12 * y })) };
  }
};
const fmt = (n: number, d = 1) => n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
const num = (v: string) => (Number.isFinite(+v) ? +v : 0);

/** Support › Calculators: backup storage, DR site capacity and migration duration from one set of assumptions. */
export function CalculatorsTab({ ctx }: { ctx: Ctx }) {
  const embed = useClosable<boolean>();
  return (
    <>
      <CalculatorBody
        ctx={ctx}
        toast={ctx.toast}
        inConsole
        extra={
          <>
            <Btn kind="ghost" icon="external-link" onClick={() => { location.hash = '/calculator'; }}>Public page</Btn>
            <Btn kind="outline" icon="square-terminal" perm={ctx.can('configure', 'Publishing the calculator')} onClick={() => embed.open(true)}>Put on a website…</Btn>
          </>
        }
      />
      {embed.value ? <EmbedDialog ctx={ctx} closing={embed.closing} onClose={embed.close} /> : null}
    </>
  );
}

/** The same three calculators, in the console or on the public page at aegis.host360.ai/calculator. */
export function CalculatorBody({ toast, inConsole, extra, lead, ctx }: { toast: (m: string, tone?: string) => void; inConsole?: boolean; extra?: ReactNode; lead?: (calc: string, summary: string) => ReactNode; ctx?: Ctx }) {
  const [calc, setCalc] = useState<'backup' | 'dr' | 'mig'>('backup');
  const quote = useClosable<string>();
  const [a, setA] = useState<Assume>(DEFAULTS);
  const [f, setF] = useState<Record<string, string>>({ source: '20', daily: '14', weekly: '4', monthly: '12', yearly: '1', copy: 'Yes', vcpu: '320', ram: '1280', storage: '22', simul: '60', over: '1.5', versions: '7', tb: '12.4', servers: '29', perWave: '6', sync: '4', window: '8', lock: '14', link: '1000', rpo: '15', hist: '24', rev: '4', vmw: '64', hosts: '6' });
  const set = (k: string, v: string) => setF(x => ({ ...x, [k]: v.replace(/[^\d.]/g, '') }));
  const mine = () => {
    setF(x => ({ ...x, source: '18.6', vcpu: '268', ram: '1088', storage: '22.4', tb: '12.4', servers: '29' }));
    toast('Filled from the inventory: Meridian Cooperative Bank and Host360 servers still on VMware', 'ok');
  };
  const b = engine.backup(a, num(f.source), num(f.daily), num(f.weekly), num(f.monthly), num(f.yearly), f.copy === 'Yes');
  const d = engine.dr(a, num(f.vcpu), num(f.ram), num(f.storage), num(f.simul), num(f.over) || 1, num(f.versions));
  const m = engine.migration(a, num(f.tb), Math.max(1, num(f.servers)), Math.max(1, num(f.perWave)), num(f.sync) || 4);
  const input = (k: string, label: string, hint?: string) => <Field key={k} id={`cl-${k}`} label={label} hint={hint}><TextInput id={`cl-${k}`} value={f[k]} onChange={v => set(k, v)} inputMode="numeric" /></Field>;
  return (
    <>
      <Toolbar>
        <Seg label="Calculator" value={calc} onChange={setCalc} options={[{ v: 'backup', label: 'Backup storage' }, { v: 'dr', label: 'DR site' }, { v: 'mig', label: 'Migration duration' }]} />
        <Spacer />
        {inConsole ? <Btn kind="outline" icon="radar" onClick={mine}>Use my inventory</Btn> : null}
        {extra}
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Inputs">
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {calc === 'backup' ? [input('source', 'Data to protect (TB)'), input('daily', 'Daily points'), input('weekly', 'Weekly points'), input('monthly', 'Monthly points'), input('yearly', 'Yearly points'), <Field key="copy" id="cl-copy" label="Offsite copy"><SelectInput id="cl-copy" value={f.copy} onChange={v => setF(x => ({ ...x, copy: v }))} options={['Yes', 'No']} /></Field>, input('window', 'Backup window (hours)'), input('lock', 'Immutable lock (days)')] : null}
              {calc === 'dr' ? [input('vcpu', 'vCPU protected'), input('ram', 'Memory protected (GB)'), input('storage', 'Storage protected (TB)'), input('simul', 'Failing over together (%)', 'A whole-site loss is 100 %'), input('over', 'vCPU over-commit', '1.5 means 1.5 vCPU per core'), input('versions', 'Versions kept'), input('link', 'Link to the recovery site (Mbit/s)'), input('rpo', 'Target RPO (minutes)'), input('hist', 'Journal history (hours)'), input('rev', 'Revenue lost per hour down (₹ lakh)')] : null}
              {calc === 'mig' ? [input('tb', 'Data to move (TB)'), input('servers', 'Servers'), input('perWave', 'Servers per weekend wave'), input('sync', 'Hours between sync passes'), input('vmw', 'VMware licences today (₹ lakh a year)'), input('hosts', 'ESXi hosts retired')] : null}
            </div>
          </Panel>
          <Panel title="Shared assumptions" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Used by all three</span>}>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field id="as-c" label="Daily change (%)"><TextInput id="as-c" value={String(a.change)} onChange={v => setA(x => ({ ...x, change: num(v) }))} inputMode="numeric" /></Field>
              <Field id="as-d" label="Deduplication (×)"><TextInput id="as-d" value={String(a.dedupe)} onChange={v => setA(x => ({ ...x, dedupe: num(v) || 1 }))} inputMode="numeric" /></Field>
              <Field id="as-z" label="Compression (×)"><TextInput id="as-z" value={String(a.compress)} onChange={v => setA(x => ({ ...x, compress: num(v) || 1 }))} inputMode="numeric" /></Field>
              <Field id="as-t" label="Copy rate (MB/s)" hint={inConsole ? 'Measured on aegis-proxy-chn-01' : 'Typical over a 10 Gb/s link'}><TextInput id="as-t" value={String(a.mbps)} onChange={v => setA(x => ({ ...x, mbps: num(v) || 1 }))} inputMode="numeric" /></Field>
            </div>
          </Panel>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {calc === 'backup' ? (
            <>
              <Tiles items={[{ label: 'Repository needed', value: fmt(b.one), unit: 'TB', icon: 'database', sub: `${fmt(b.red)}× smaller than the source` }, { label: 'With the offsite copy', value: fmt(b.total), unit: 'TB', icon: 'copy', sub: f.copy === 'Yes' ? 'Second repository of the same size' : 'No copy' }, { label: 'After a year at 20 % growth', value: fmt(b.total * 1.2), unit: 'TB', icon: 'calendar' }]} />
              <Panel title="How it adds up"><div style={{ padding: '0 16px 8px' }}><MiniTable label="Breakdown" cols={[{ label: 'Part' }, { label: 'Stored (TB)', w: '120px', r: true }]} rows={b.parts.map(([k, v]) => [k, fmt(v, 2)])} /></div></Panel>
            </>
          ) : null}
          {calc === 'dr' ? (
            <>
              <Tiles items={[{ label: 'vCPU to reserve', value: String(d.vcpu), icon: 'cpu', sub: `${f.simul} % at ${f.over}× over-commit` }, { label: 'Memory to reserve', value: fmt(d.ram, 0), unit: 'GB', icon: 'layers', sub: 'Memory is never over-committed' }, { label: 'Storage at the site', value: fmt(d.storage), unit: 'TB', icon: 'hard-drive', sub: `${f.versions} versions; plus ${fmt(d.test)} TB for test copies` }]} />
              <Facts items={[...(inConsole ? [{ k: 'Compared with region-2-os', v: `${d.vcpu} of 256 vCPU reserved would leave ${256 - d.vcpu} for other customers; see Resilience › Site capacity` }] : []), { k: 'Formula', v: 'vCPU × share ÷ over-commit; memory × share; storage × (1 + versions × daily change)' }]} />
            </>
          ) : null}
          {calc === 'mig' ? (
            <>
              <Tiles items={[{ label: 'First pass', value: m.firstH < 48 ? fmt(m.firstH) : fmt(m.firstH / 24), unit: m.firstH < 48 ? 'hours' : 'days', icon: 'timer', sub: `${f.tb} TB at ${a.mbps} MB/s` }, { label: 'Waves', value: String(m.waves), icon: 'calendar', sub: `${f.perWave} servers each, one a weekend` }, { label: 'Programme', value: String(m.weeks), unit: 'weeks', icon: 'route', sub: 'Waves plus two weeks of first passes' }, { label: 'Downtime per server', value: String(m.downtimeMin), unit: 'min', icon: 'clock', sub: 'Final sync plus boot' }]} />
              <Facts items={[...(inConsole ? [{ k: 'Same as', v: 'The estimates in Mobility › Assessment use this engine with each server’s own size' }] : []), { k: 'Formula', v: 'Data ÷ copy rate; final sync = change since the last pass ÷ copy rate + 12 min to boot and check' }]} />
            </>
          ) : null}
          {calc === 'backup' ? <BackupOutputs d={engine.backupDesign(a, num(f.source), b, num(f.window), num(f.lock), num(f.monthly), f.copy === 'Yes')} b={b} a={a} f={f} priced={!!inConsole} /> : null}
          {calc === 'dr' ? <DrOutputs x={engine.drDesign(a, d, num(f.storage), num(f.link), Math.max(1, num(f.rpo)), num(f.hist), num(f.rev))} f={f} priced={!!inConsole} /> : null}
          {calc === 'mig' ? <MigOutputs x={engine.migCost(num(f.tb), Math.max(1, num(f.servers)), m.waves, num(f.vmw), num(f.hosts))} f={f} priced={!!inConsole} /> : null}
          {ctx ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn kind="primary" icon="receipt" perm={ctx.can('configure', 'Making quotes')} onClick={() => quote.open(calc)}>Make a quote…</Btn>
              <CopyCurl ctx={ctx} method="POST" path="/sizing/quotes" body={{ calculator: calc, inputs: f, assumptions: a }} />
              <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>The public page, partners and the quoting API use this same engine.</span>
            </div>
          ) : null}
          {lead ? lead(calc, calc === 'backup' ? `${fmt(b.total)} TB of repository for ${f.source} TB protected` : calc === 'dr' ? `${d.vcpu} vCPU, ${fmt(d.ram, 0)} GB and ${fmt(d.storage)} TB at the recovery site` : `${m.waves} waves over ${m.weeks} weeks, ${m.downtimeMin} min downtime per server`) : null}
        </div>
      </div>
      {ctx && quote.value ? (
        <QuoteDialog
          ctx={ctx}
          calc={quote.value as 'backup' | 'dr' | 'mig'}
          lines={
            quote.value === 'backup'
              ? (x => [['Aegis Protection', `${f.source} TB protected × ₹3,800 a month`, x.price.software, 'month'], ['Repository storage', `${fmt(b.total)} TB stored × ₹1,450 a month`, x.price.storage, 'month'], ['Managed proxies', `${x.proxies} × ₹9,500 a month`, x.price.infra, 'month'], ['Restore egress (estimate)', '3 % of stored data a month', x.price.egress, 'month'], ['Onboarding', 'Professional services, 3 days', 135000, 'once']])(engine.backupDesign(a, num(f.source), b, num(f.window), num(f.lock), num(f.monthly), f.copy === 'Yes'))
              : quote.value === 'dr'
                ? (x => [['Aegis Resilience (DRaaS)', `${f.storage} TB replicated, ${fmt(x.journal)} TB journal, ${d.vcpu} vCPU reserved`, x.draas, 'month'], ['Drills', 'Four a year with an evidence pack', 0, 'month'], ['Runbook design', 'Professional services, 5 days', 225000, 'once']])(engine.drDesign(a, d, num(f.storage), num(f.link), Math.max(1, num(f.rpo)), num(f.hist), num(f.rev)))
                : (x => [['Migration', `${f.servers} servers, ${m.waves} waves`, x.oneOff, 'once'], ['Run on Host360 after cutover', `${f.servers} servers, rightsized`, x.target, 'month']])(engine.migCost(num(f.tb), Math.max(1, num(f.servers)), m.waves, num(f.vmw), num(f.hosts)))
          }
          closing={quote.closing}
          onClose={quote.close}
        />
      ) : null}
    </>
  );
}

function EmbedDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [which, setWhich] = useState<string[]>(['backup', 'dr', 'mig']);
  const [brand, setBrand] = useState<'host360' | 'partner'>('host360');
  const [to, setTo] = useState('sales@host360.ai');
  const src = `https://aegis.host360.ai/calculator?embed=1&show=${which.join(',')}${brand === 'partner' ? '&brand=partner-cloudnest' : ''}`;
  const code = `<iframe src="${src}" title="Backup, DR and migration calculator" width="100%" height="760" style="border:0" loading="lazy"></iframe>`;
  const ok = which.length > 0 && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to);
  return (
    <Dialog
      size="lg"
      title="Put the calculator on a website"
      sub="The same engine and assumptions as the console, without sign-in. Visitors can ask for the sizing by e-mail; their request goes to the address below."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Close</Btn>
          <Btn kind="outline" icon="external-link" onClick={() => { onClose(); location.hash = '/calculator'; }}>Preview the public page</Btn>
          <Btn kind="primary" icon="copy" disabled={!ok} why={!which.length ? 'Pick at least one calculator.' : 'Give a valid e-mail address for requests.'} onClick={() => {
            const p = navigator.clipboard?.writeText(code);
            audit({ who: 'priya.raman', customer: 'h360', what: 'Published the website calculator', object: which.join(', '), when: ctx.now(), r: 'ok', after: [['Branding', brand === 'host360' ? 'Host360' : 'CloudNest IT Services'], ['Requests to', to]] });
            if (!p) return ctx.toast('Copy is blocked here; select the code and copy it yourself', 'warn');
            p.then(() => ctx.toast('Embed code copied', 'ok'), () => ctx.toast('Copy is blocked here; select the code and copy it yourself', 'warn'));
          }}>Copy embed code</Btn>
        </>
      }
    >
      <Field label="Calculators">
        <div style={{ display: 'flex', gap: 16 }}>
          {[['backup', 'Backup storage'], ['dr', 'DR site'], ['mig', 'Migration duration']].map(([v, l]) => <CheckBox key={v} on={which.includes(v)} onChange={x => setWhich(s => (x ? [...s, v] : s.filter(y => y !== v)))}>{l}</CheckBox>)}
        </div>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={brand === 'host360'} onClick={() => setBrand('host360')} title="Host360 branding" note="For host360.ai" />
        <RadioCard on={brand === 'partner'} onClick={() => setBrand('partner')} title="Partner branding" note="CloudNest IT Services logo and colours from Branding" />
      </div>
      <Field id="em-to" label="Send requests to"><TextInput id="em-to" value={to} onChange={setTo} /></Field>
      <pre style={{ margin: 0, padding: 12, background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/18px var(--f-ui)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}>{code}</pre>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Compatibility matrix */

type Sup = 'Yes' | 'Limited' | 'No' | '—';
const MATRIX: { cat: string; item: string; p: Sup; r: Sup; m: Sup; note: string }[] = [
  { cat: 'Platforms', item: 'Proxmox VE 8.x, 9.x', p: 'Yes', r: 'Yes', m: 'Yes', note: 'Mobility: as a destination' },
  { cat: 'Platforms', item: 'OpenStack 2023.1 to 2025.1', p: 'Yes', r: 'Yes', m: 'Yes', note: 'Mobility: as a destination' },
  { cat: 'Platforms', item: 'VMware vSphere 7.0 U3, 8.0', p: 'Limited', r: 'Yes', m: 'Yes', note: 'Protection with the guest agent only; Mobility as a source' },
  { cat: 'Platforms', item: 'Microsoft Hyper-V 2019, 2022', p: 'Limited', r: 'No', m: 'Limited', note: 'Agent-based backup; migration from Hyper-V through the agent' },
  { cat: 'Platforms', item: 'Nutanix AHV', p: 'No', r: 'No', m: 'No', note: 'Planned for 2027' },
  { cat: 'Guest OS', item: 'Windows Server 2016 to 2025', p: 'Yes', r: 'Yes', m: 'Yes', note: 'VirtIO 0.1.262 injected for Mobility' },
  { cat: 'Guest OS', item: 'Windows Server 2012 R2', p: 'Yes', r: 'Yes', m: 'Limited', note: 'Out of Microsoft support; drivers inject, no Microsoft support after the move' },
  { cat: 'Guest OS', item: 'Red Hat Enterprise Linux 8, 9', p: 'Yes', r: 'Yes', m: 'Yes', note: 'Re-register subscriptions after the move' },
  { cat: 'Guest OS', item: 'Ubuntu 20.04 to 24.04, Debian 11, 12', p: 'Yes', r: 'Yes', m: 'Yes', note: '' },
  { cat: 'Guest OS', item: 'CentOS 7', p: 'Limited', r: 'Yes', m: 'Limited', note: 'End of life; file-level restore only from 2027' },
  { cat: 'Guest OS', item: 'SUSE Linux Enterprise 15', p: 'Yes', r: 'Yes', m: 'Yes', note: '' },
  { cat: 'Databases', item: 'SQL Server 2016 to 2022', p: 'Yes', r: 'Yes', m: 'Yes', note: 'Application-consistent with log backups' },
  { cat: 'Databases', item: 'Oracle 19c, 21c', p: 'Yes', r: 'Yes', m: 'Limited', note: 'RMAN integration; RAC with shared disks cannot be migrated as-is' },
  { cat: 'Databases', item: 'PostgreSQL 13 to 16, MySQL 8', p: 'Yes', r: 'Yes', m: 'Yes', note: '' },
  { cat: 'Databases', item: 'SAP HANA 2.0', p: 'Limited', r: 'Yes', m: 'No', note: 'Backint certification in progress; use file backups until then' },
  { cat: 'Kubernetes', item: 'Kubernetes 1.27 to 1.31', p: 'Yes', r: 'Limited', m: 'No', note: 'Namespaces and persistent volumes; DR at application level only' },
  { cat: 'Kubernetes', item: 'OpenShift 4.14 and later', p: 'Yes', r: 'Limited', m: 'No', note: '' },
  { cat: 'Storage', item: 'S3-compatible with object lock', p: 'Yes', r: '—', m: '—', note: 'Immutable repositories (compliance or governance mode)' },
  { cat: 'Storage', item: 'NFS, SMB', p: 'Yes', r: '—', m: 'Yes', note: 'Mobility: as staging' },
  { cat: 'Storage', item: 'Ceph RBD', p: 'Yes', r: 'Yes', m: 'Yes', note: '' }
];
const cell = (v: Sup, note: string) => (v === 'Yes' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Yes', tip: note || 'Supported' } : v === 'Limited' ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Limited', tip: note } : v === 'No' ? { t: 'status', i: 'circle-minus', c: 'tx', l: 'No', tip: note || 'Not supported' } : { v: 'Not applicable', muted: true });

/** Support › Compatibility: what each product supports, by platform, guest OS, database, Kubernetes and storage. */
export function CompatibilityTab({ ctx }: { ctx: Ctx }) {
  const [mode, setMode] = useState<'matrix' | 'check'>('check');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const rows = MATRIX.filter(r => (cat === 'All' || r.cat === cat) && (!ql || `${r.item} ${r.note}`.toLowerCase().includes(ql)));
  if (mode === 'check') return <CompatCheck mode={<Seg<'matrix' | 'check'> label="View" value={mode} onChange={setMode} options={[{ v: 'check', label: 'Check a combination' }, { v: 'matrix', label: 'Full matrix' }]} />} />;
  return (
    <>
      <Toolbar>
        <Seg<'matrix' | 'check'> label="View" value={mode} onChange={setMode} options={[{ v: 'check', label: 'Check a combination' }, { v: 'matrix', label: 'Full matrix' }]} />
        <Seg label="Category" value={cat} onChange={setCat} options={['All', 'Platforms', 'Guest OS', 'Databases', 'Kubernetes', 'Storage'].map(v => ({ v, label: v }))} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter, e.g. Oracle" label="Filter the matrix" width={220} />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>For Aegis 4.2.1 · updated 17 Oct 2026</span>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Compatibility matrix"
          cols={[{ k: 'c', label: 'Category', w: '120px', dim: true }, { k: 'i', label: 'Supported item', w: 'minmax(240px,1.6fr)' }, { k: 'p', label: 'Protection', w: '130px' }, { k: 'r', label: 'Resilience', w: '130px' }, { k: 'm', label: 'Mobility', w: '130px' }, { k: 'n', label: 'Notes', w: 'minmax(220px,1.8fr)', dim: true }]}
          rows={rows.map((r, i) => ({ id: String(i), c: r.cat, i: { v: r.item, strong: true }, p: cell(r.p, r.note), r: cell(r.r, r.note), m: cell(r.m, r.note), n: r.note ? { v: r.note, tip: r.note } : { v: '—', muted: true } }))}
          state={ctx.ui}
          unit={['item', 'items']}
          filtered={cat !== 'All' || !!ql}
          onClear={() => { setCat('All'); setQ(''); }}
          emptyText="Nothing matches."
        />
      </TableArea>
    </>
  );
}

/* ---------------------------------------------------------------- Source × version × workload × operation × target */

type Op = 'Back up' | 'Restore' | 'Replicate' | 'Test failover' | 'Fail over' | 'Migrate';
type Lvl = 'Yes' | 'Limited' | 'No';
const SOURCES: Record<string, string[]> = { 'VMware vSphere': ['8.0 U3', '7.0 U3', '6.7'], 'Proxmox VE': ['9.0', '8.2', '7.4'], OpenStack: ['2025.1', '2024.1', 'Zed (2022.2)'], 'Microsoft Hyper-V': ['2022', '2019'], 'Physical server': ['Any'] };
const WORKLOADS = ['Windows Server 2022', 'Windows Server 2012 R2', 'Windows Server 2008 R2', 'Red Hat Enterprise Linux 9', 'CentOS 7', 'Ubuntu 24.04', 'SQL Server 2019', 'Oracle 19c RAC', 'SAP HANA 2.0', 'Kubernetes 1.30'];
const OPS: Op[] = ['Back up', 'Restore', 'Replicate', 'Test failover', 'Fail over', 'Migrate'];
const TARGETS: Record<Op, string[]> = {
  'Back up': ['S3-compatible with object lock', 'NFS', 'SMB', 'Filesystem'],
  Restore: ['The same place', 'Proxmox VE 9.0', 'OpenStack 2025.1'],
  Replicate: ['Proxmox VE 9.0', 'Proxmox VE 8.2', 'OpenStack 2025.1', 'OpenStack 2024.1'],
  'Test failover': ['Proxmox VE 9.0', 'OpenStack 2025.1'],
  'Fail over': ['Proxmox VE 9.0', 'Proxmox VE 8.2', 'OpenStack 2025.1', 'OpenStack 2024.1'],
  Migrate: ['Proxmox VE 9.0', 'Proxmox VE 8.2', 'OpenStack 2025.1', 'OpenStack 2024.1']
};
const RANK: Record<Lvl, number> = { Yes: 0, Limited: 1, No: 2 };

/** Every rule that applies to one combination; the answer is the worst of them. */
function judge(src: string, ver: string, wl: string, op: Op, tgt: string): [string, Lvl, string][] {
  const out: [string, Lvl, string][] = [];
  const dr = op === 'Replicate' || op === 'Test failover' || op === 'Fail over';
  // Source and operation
  if (src === 'VMware vSphere') out.push(['Source', op === 'Back up' || op === 'Restore' ? 'Limited' : 'Yes', op === 'Back up' || op === 'Restore' ? 'VMware is never a Protection source; back up the guest with the Aegis agent instead' : `${op} from vCenter or ESXi with the read-only role`]);
  else if (src === 'Microsoft Hyper-V') out.push(['Source', dr ? 'No' : op === 'Migrate' ? 'Limited' : 'Limited', dr ? 'No replication from Hyper-V' : 'Through the Aegis agent in the guest']);
  else if (src === 'Physical server') out.push(['Source', op === 'Migrate' || dr ? 'Limited' : 'Yes', op === 'Migrate' ? 'Physical to virtual through the agent; one extra reboot' : dr ? 'Agent-based replication; boot settings checked per server' : 'With the Aegis agent']);
  else out.push(['Source', op === 'Migrate' ? 'No' : 'Yes', op === 'Migrate' ? `${src} is a destination for Mobility, not a source` : `${op} on ${src}`]);
  // Version
  if (ver === '6.7') out.push(['Version', 'No', 'vSphere 6.7 is past VMware’s end of support; 7.0 U3 is the oldest supported']);
  else if (ver === '7.4') out.push(['Version', 'Limited', 'Proxmox VE 7.4 is end of life; upgrade to 8.2 or later']);
  else if (ver.startsWith('Zed')) out.push(['Version', 'Limited', 'OpenStack Zed is unmaintained upstream; 2024.1 or later']);
  else out.push(['Version', 'Yes', `${src} ${ver} is tested with Aegis 4.2.1`]);
  // Workload and operation
  const w = (l: Lvl, t: string) => out.push(['Workload', l, t]);
  if (wl === 'Windows Server 2008 R2') w(op === 'Migrate' ? 'Limited' : op === 'Back up' ? 'Limited' : 'Limited', op === 'Migrate' ? 'Legacy profile: VirtIO 0.1.185 and a first boot on IDE; out of support' : 'Out of support; application-consistent backup is not available');
  else if (wl === 'Windows Server 2012 R2') w(op === 'Migrate' ? 'Limited' : 'Yes', op === 'Migrate' ? 'Drivers inject; no Microsoft support after the move' : 'Supported');
  else if (wl === 'CentOS 7') w(op === 'Back up' || op === 'Restore' ? 'Limited' : 'Yes', op === 'Back up' || op === 'Restore' ? 'End of life; file-level restore only from 2027' : 'Supported; initramfs rebuilt with VirtIO');
  else if (wl === 'Oracle 19c RAC') w(op === 'Migrate' ? 'No' : 'Yes', op === 'Migrate' ? 'Shared disks cannot be migrated as-is; rebuild the cluster at the destination and use Data Guard' : 'RMAN integration; replicated as one consistency group');
  else if (wl === 'SAP HANA 2.0') w(op === 'Migrate' ? 'No' : op === 'Back up' || op === 'Restore' ? 'Limited' : 'Yes', op === 'Migrate' ? 'Use HANA system replication to the destination' : op === 'Back up' || op === 'Restore' ? 'Backint certification in progress; file backups until then' : 'Replicated as one consistency group');
  else if (wl === 'Kubernetes 1.30') w(op === 'Migrate' ? 'No' : dr ? 'Limited' : 'Yes', op === 'Migrate' ? 'Move workloads with a backup and restore to the new cluster' : dr ? 'At application level: namespaces and volumes restored into a standby cluster' : 'Namespaces and persistent volumes');
  else if (wl === 'SQL Server 2019') w('Yes', op === 'Back up' ? 'Application-consistent with log backups' : 'Supported');
  else w('Yes', 'Supported');
  // Target
  if (tgt === 'SMB') out.push(['Target', 'Limited', 'SMB cannot be locked; backups on it are not immutable']);
  else if (tgt === 'S3-compatible with object lock') out.push(['Target', 'Yes', 'Immutable in governance or compliance mode']);
  else if (tgt === 'The same place') out.push(['Target', 'Yes', 'Back to the original location; overwrites need step-up']);
  else out.push(['Target', 'Yes', `${tgt} is a supported destination`]);
  return out;
}

function CompatCheck({ mode }: { mode: ReactNode }) {
  const [src, setSrc] = useState('VMware vSphere');
  const [ver, setVer] = useState(SOURCES['VMware vSphere'][0]);
  const [wl, setWl] = useState(WORKLOADS[0]);
  const [op, setOp] = useState<Op>('Migrate');
  const [tgt, setTgt] = useState(TARGETS.Migrate[0]);
  const lines = judge(src, ver, wl, op, tgt);
  const worst = lines.reduce<Lvl>((a, l) => (RANK[l[1]] > RANK[a] ? l[1] : a), 'Yes');
  const tone = { Yes: ['circle-check', 'ok', 'Supported'], Limited: ['triangle-alert', 'warn', 'Supported with limits'], No: ['circle-x', 'err', 'Not supported'] }[worst];
  return (
    <>
      <Toolbar>
        {mode}
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>For Aegis 4.2.1 · updated 17 Oct 2026</span>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 12 }}>
          <Field id="cc-s" label="Source"><SelectInput id="cc-s" value={src} onChange={v => { setSrc(v); setVer(SOURCES[v][0]); }} options={Object.keys(SOURCES)} /></Field>
          <Field id="cc-v" label="Version"><SelectInput id="cc-v" value={ver} onChange={setVer} options={SOURCES[src]} /></Field>
          <Field id="cc-w" label="Workload"><SelectInput id="cc-w" value={wl} onChange={setWl} options={WORKLOADS} /></Field>
          <Field id="cc-o" label="Operation"><SelectInput id="cc-o" value={op} onChange={v => { setOp(v as Op); setTgt(TARGETS[v as Op][0]); }} options={OPS} /></Field>
          <Field id="cc-t" label="Target"><SelectInput id="cc-t" value={tgt} onChange={setTgt} options={TARGETS[op]} /></Field>
        </div>
        <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name={tone[0]} style={{ color: `var(--${tone[1]})` }} />{tone[2]}: {op.toLowerCase()} {wl} from {src} {ver} to {tgt}</span>}>
          <div style={{ padding: '4px 16px 12px' }}>
            <MiniTable label="Why" cols={[{ label: 'Rule', w: '100px' }, { label: 'Result', w: '110px' }, { label: 'Detail' }]} rows={lines.map(([k, l, t]) => [k, <span key="r" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: `var(--${l === 'Yes' ? 'ok' : l === 'Limited' ? 'warn' : 'err'})` }}><Icon name={l === 'Yes' ? 'circle-check' : l === 'Limited' ? 'triangle-alert' : 'circle-x'} />{l}</span>, <span key="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={t}>{t}</span>])} />
          </div>
        </Panel>
      </div>
    </>
  );
}
