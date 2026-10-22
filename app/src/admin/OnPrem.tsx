import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { ONPREM, type OnPrem } from '../data/internal';
import { Btn, CheckBox, Field, RadioCard, SelectInput, TextInput } from '../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Page, PageHeader, Spacer, Status, TableArea, Tiles } from '../ui/layout';
import { Dialog, Drawer, StepUp, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName } from '../platform/common';
import { audit } from '../platform/store';

const ST: Record<OnPrem['state'], [string, string, string]> = { ok: ['circle-check', 'Healthy', 'ok'], warn: ['triangle-alert', 'Needs attention', 'warn'], err: ['circle-x', 'Failing', 'err'] };
const RELEASES = [
  { v: '4.2.0-p1', date: '09 Oct 2026', notes: 'Fixes CVE-2026-31877 (medium) in the agent installer; faster catalogue rebuild', size: '1.9 GB', sha: '3f9c 71ab 0e42 9d1c 55e0 b8a2 6c17 f04e 9a3b 2d88 e1c5 7f60 4b19 a2d7 6e03 c8f1' },
  { v: '4.2.0', date: '10 Sep 2026', notes: 'Resilience runbooks, Mobility go/no-go, source impact governor', size: '2.3 GB', sha: 'a0e1 44d2 9b7c 1f38 e6a9 0c52 7d41 b3f8 25c9 e07a 6b14 d2f3 89c0 51ae 7f26 b4d9' },
  { v: '4.1.3-p2', date: '28 Jul 2026', notes: 'Security fixes for the web console (two low)', size: '0.4 GB', sha: '7b22 c9e0 14af 3d81 6e57 a0c4 92d1 f8b3 5c06 e7a9 1d42 b6f0 38c5 a91e 04d7 2bf3' }
];

/** 6.5 On-premises deployments: Aegis installed in customers' own data centres. */
export function OnPremSection({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<OnPrem[]>(ONPREM);
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const patch = useClosable<string>();
  const lic = useClosable<string>();
  const target = useClosable<string>();
  const [running, setRunning] = useState<string | null>(null);
  useEffect(() => {
    if (ctx.openId && list.some(o => o.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = drawer.value ? list.find(o => o.id === drawer.value) : null;
  const upd = (id: string, p: Partial<OnPrem>) => setList(x => x.map(o => (o.id === id ? { ...o, ...p } : o)));
  const backupNow = (o: OnPrem) => {
    setRunning(o.id);
    window.setTimeout(() => {
      setRunning(null);
      if (o.id === 'op-cor' && o.note?.includes('read-only')) {
        ctx.toast('Backup of the internal database failed again: \\\\cor-nas-01\\aegis-cfg is read-only. Change the target.', 'err');
        return;
      }
      upd(o.id, { dbBackup: ctx.now(), cfgBackup: ctx.now(), dbOk: true });
      audit({ who: 'priya.raman', customer: o.customer, what: 'Backed up an on-premises orchestrator', object: o.site, when: ctx.now(), r: 'ok' });
      ctx.toast(`Internal database and configuration of ${custName(o.customer)} backed up`, 'ok');
    }, 1600);
  };
  return (
    <Page>
      <PageHeader kicker="Estate" title="On-premises deployments" sub="Aegis installed in customers’ own data centres: version and patches, licence, and backup of each install’s internal database and configuration." />
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Deployments', value: `${list.length}`, icon: 'house', sub: `${list.filter(o => o.connect === 'Air-gapped').length} air-gapped` },
            { label: 'Behind the latest', value: `${list.filter(o => o.patch !== RELEASES[0].v).length}`, icon: 'arrow-up', tone: list.some(o => o.patch !== RELEASES[0].v) ? 'warn' : 'ok', sub: `Latest ${RELEASES[0].v}, ${RELEASES[0].date}` },
            { label: 'Licences ending', value: `${list.filter(o => o.licenceDays <= 90).length}`, icon: 'key', tone: list.some(o => o.licenceDays <= 90) ? 'warn' : undefined, sub: 'Within 90 days' },
            { label: 'Internal backups failing', value: `${list.filter(o => !o.dbOk).length}`, icon: 'database', tone: list.some(o => !o.dbOk) ? 'err' : 'ok', sub: list.filter(o => !o.dbOk).map(o => custName(o.customer)).join(', ') || 'All backed up in the last 24 h' }
          ]}
        />
      </div>
      <TableArea>
        <AegisTable
          label="On-premises deployments"
          cols={[
            { k: 'c', label: 'Customer', w: 'minmax(170px,1.2fr)' },
            { k: 'site', label: 'Site', w: 'minmax(200px,1.5fr)', dim: true },
            { k: 'v', label: 'Version', w: '120px' },
            { k: 'con', label: 'Connection', w: '120px' },
            { k: 'lic', label: 'Licence', w: '130px', r: true },
            { k: 'db', label: 'Internal backup', w: '170px' },
            { k: 'st', label: 'State', w: '150px' }
          ]}
          rows={list.map(o => ({
            id: o.id,
            c: { v: custName(o.customer), strong: true },
            site: o.site,
            v: o.patch === RELEASES[0].v ? o.patch : { t: 'status', i: 'arrow-up', c: 'warn', l: o.patch, tip: `${RELEASES[0].v} is available` },
            con: o.connect === 'Air-gapped' ? { t: 'icon', i: 'wifi', c: 'tx', l: 'Air-gapped' } : 'Online',
            lic: { v: `${o.licenceDays} d`, strong: o.licenceDays <= 90, s: o.licenceDays, tip: o.licence },
            db: o.dbOk ? { t: 'status', i: 'circle-check', c: 'ok', l: o.dbBackup.replace(' 2026', '').replace(' IST', '') } : { t: 'status', i: 'circle-x', c: 'err', l: `Failing since ${o.dbBackup.slice(0, 6)}`, tip: o.note },
            st: { t: 'status', i: ST[o.state][0], c: ST[o.state][2], l: ST[o.state][1], tip: o.note || ST[o.state][1], s: ['ok', 'warn', 'err'].indexOf(o.state) }
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['deployment', 'deployments']}
          emptyText="No on-premises deployments. Every customer uses the hosted orchestrator."
          sort="st"
          dir={-1}
        />
      </TableArea>
      {d ? (
        <Drawer
          label="On-premises deployment"
          kicker={`On-premises · ${d.connect}`}
          title={`${custName(d.customer)} · ${d.site.split(', ')[1] || d.site}`}
          status={<><Status icon={ST[d.state][0]} tone={ST[d.state][2]} label={ST[d.state][1]} /><span>Aegis {d.patch}</span><span>{d.nodes} {d.nodes === 1 ? 'node' : 'nodes'}</span></>}
          actions={
            <>
              <Btn kind="primary" icon="arrow-up" disabled={d.patch === RELEASES[0].v} why="Already on the latest release." onClick={() => patch.open(d.id)}>Patch…</Btn>
              <Btn kind="outline" icon={running === d.id ? 'loader-circle' : 'database'} spin={running === d.id} disabled={running === d.id} why="A backup is running." onClick={() => backupNow(d)}>{running === d.id ? 'Backing up…' : 'Back up now'}</Btn>
              <Btn kind="outline" icon="key" onClick={() => lic.open(d.id)}>Licence…</Btn>
            </>
          }
          tabs={[{ v: 'Overview', label: 'Overview' }, { v: 'Patches', label: 'Patches' }, { v: 'Backups', label: 'Internal backups' }]}
          tab={tab}
          onTab={setTab}
          width={660}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {d.note ? <Bar tone={d.state === 'err' ? 'err' : 'warn'} multiline>{d.note}</Bar> : null}
              <DrawerTiles items={[{ label: 'Version', value: d.patch, sub: d.patch === RELEASES[0].v ? 'Latest' : `${RELEASES[0].v} available` }, { label: 'Licence', value: `${d.licenceDays} d`, sub: d.licence }, { label: 'Internal backup', value: d.dbOk ? 'OK' : 'Failing', icon: d.dbOk ? 'circle-check' : 'circle-x', tone: d.dbOk ? 'ok' : 'err', sub: d.dbBackup }]} />
              <Facts items={[{ k: 'Site', v: d.site }, { k: 'Connection', v: d.connect === 'Air-gapped' ? 'Air-gapped: patches and licences go by signed offline bundle' : 'Online: telemetry and licence check every 6 hours' }, { k: 'Nodes', v: d.nodes === 1 ? 'Single orchestrator' : `${d.nodes} orchestrators, active and standby` }, { k: 'Support', v: 'Host360 remote support over the customer’s jump host, on request' }]} />
            </div>
          ) : null}
          {tab === 'Patches' ? (
            <MiniTable
              label="Releases"
              cols={[{ label: 'Release', w: '90px' }, { label: 'Published', w: '100px' }, { label: 'What it changes' }, { label: '', w: '96px' }]}
              rows={RELEASES.map(r => [<strong key="v" style={{ fontWeight: 600 }}>{r.v}</strong>, r.date, <span key="n" data-tip={r.notes} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes}</span>, r.v === d.patch ? <Status key="s" icon="circle-check" tone="ok" label="Installed" /> : RELEASES.findIndex(x => x.v === r.v) < RELEASES.findIndex(x => x.v === d.patch) || !RELEASES.some(x => x.v === d.patch) ? <span key="s" style={{ color: 'var(--tx-2)' }}>Available</span> : <span key="s" style={{ color: 'var(--tx-3)' }}>Older</span>])}
            />
          ) : null}
          {tab === 'Backups' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Facts items={[{ k: 'Internal database', v: 'PostgreSQL 16: jobs, catalogue, policies, audit. Nightly at 02:00 local, 14 copies kept' }, { k: 'Configuration', v: 'Settings, certificates and vault, sealed with the deployment key. Nightly, 30 copies kept' }, { k: 'Target', v: d.id === 'op-cor' ? '\\\\cor-nas-01\\aegis-cfg (read-only since 14 Oct)' : d.id === 'op-sah' ? 'Host360 Chennai DC1, over the site tunnel' : 'Host360 Frankfurt FR5', tone: d.dbOk ? undefined : 'err', icon: d.dbOk ? undefined : 'circle-x' }]} />
              <MiniTable
                label="Recent internal backups"
                cols={[{ label: 'When', w: '170px' }, { label: 'What' }, { label: 'Size', w: '80px', r: true }, { label: 'Result', w: '110px' }]}
                rows={d.dbOk ? [[d.dbBackup.replace(' 2026', ''), 'Internal database', '3.1 GB', <Status key="r" icon="circle-check" tone="ok" label="Done" />], [d.cfgBackup.replace(' 2026', ''), 'Configuration', '42 MB', <Status key="r" icon="circle-check" tone="ok" label="Done" />]] : [['21 Oct, 02:00 IST', 'Internal database', '—', <Status key="r" icon="circle-x" tone="err" label="Failed" tip="Access denied: share is read-only" />], ['20 Oct, 02:00 IST', 'Internal database', '—', <Status key="r" icon="circle-x" tone="err" label="Failed" />], [d.dbBackup.replace(' 2026', ''), 'Internal database (last good)', '2.8 GB', <Status key="r" icon="circle-check" tone="ok" label="Done" />]]}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn kind="outline" icon="pencil" onClick={() => target.open(d.id)}>Change target…</Btn>
                <Btn kind="outline" icon="download" onClick={() => ctx.toast(`aegis-config-${d.customer}-${d.cfgBackup.slice(0, 6).replace(' ', '')}.tar.age downloaded; sealed with the deployment key`, 'ok')}>Download configuration backup</Btn>
              </div>
            </div>
          ) : null}
        </Drawer>
      ) : null}
      {patch.value ? (
        <PatchWizard
          ctx={ctx}
          o={list.find(o => o.id === patch.value)!}
          closing={patch.closing}
          onClose={patch.close}
          onDone={when => {
            const o = list.find(x => x.id === patch.value)!;
            if (when === 'now') upd(o.id, { patch: RELEASES[0].v, version: '4.2.0', state: o.dbOk ? 'ok' : o.state, note: o.dbOk ? undefined : o.note });
            audit({ who: 'priya.raman', customer: o.customer, what: when === 'now' ? 'Patched an on-premises orchestrator' : 'Scheduled an on-premises patch', object: `${o.site} → ${RELEASES[0].v}`, when: ctx.now(), r: 'ok' });
            ctx.toast(when === 'now' ? `${custName(o.customer)} is on ${RELEASES[0].v}; health checks passed` : `${RELEASES[0].v} scheduled for ${custName(o.customer)}’s next maintenance window`, 'ok');
            patch.close();
          }}
        />
      ) : null}
      {lic.value ? <LicenceDialog ctx={ctx} o={list.find(o => o.id === lic.value)!} closing={lic.closing} onClose={lic.close} onRenew={(lic2, days) => { upd(lic.value!, { licence: lic2, licenceDays: days }); lic.close(); }} /> : null}
      {target.value ? (
        <TargetDialog
          ctx={ctx}
          o={list.find(o => o.id === target.value)!}
          closing={target.closing}
          onClose={target.close}
          onSave={() => {
            const o = list.find(x => x.id === target.value)!;
            upd(o.id, { note: o.id === 'op-cor' ? 'Target changed to Host360 Chennai DC1 over the site tunnel. Next backup at 02:00.' : o.note });
            target.close();
          }}
        />
      ) : null}
    </Page>
  );
}

function PatchWizard({ ctx, o, closing, onClose, onDone }: { ctx: Ctx; o: OnPrem; closing: boolean; onClose: () => void; onDone: (when: 'now' | 'window') => void }) {
  const [step, setStep] = useState(0);
  const [when, setWhen] = useState<'now' | 'window'>('window');
  const [pre, setPre] = useState(true);
  const [mfa, setMfa] = useState(false);
  const r = RELEASES[0];
  const checks = [
    { ok: true, text: `Disk space: 41 GB free; ${r.size} needed` },
    { ok: true, text: 'Upgrade path: from ' + o.patch + ' to ' + r.v + ' is supported' },
    { ok: o.dbOk, text: o.dbOk ? 'Internal database backed up in the last 24 hours' : 'Internal database not backed up for 7 days; the wizard takes one first' },
    { ok: true, text: 'No restore or failover running' }
  ];
  return (
    <Wizard
      title={`Patch ${custName(o.customer)} to ${r.v}`}
      sub={o.connect === 'Air-gapped' ? 'Air-gapped: the signed bundle is carried in and verified before install.' : 'Downloaded from updates.host360.ai and verified before install.'}
      steps={['Release', 'Checks', 'When']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={<Btn kind="primary" iconAfter={step < 2 ? 'arrow-right' : undefined} icon={step === 2 ? 'arrow-up' : undefined} disabled={step === 2 && when === 'now' && !mfa} why="Confirm with your security key first." onClick={() => (step < 2 ? setStep(step + 1) : onDone(when))}>{step < 2 ? 'Next' : when === 'now' ? 'Patch now' : 'Schedule'}</Btn>}
    >
      {step === 0 ? (
        <>
          <Facts items={[{ k: 'Release', v: `${r.v}, ${r.date}` }, { k: 'Changes', v: r.notes }, { k: 'Size', v: r.size }, { k: 'SHA-256', v: <code style={{ font: '12px var(--f-ui)' }}>{r.sha}</code> }, { k: 'Signed by', v: 'Host360 release key; verified before install', icon: 'badge-check', tone: 'ok' }]} />
          {o.connect === 'Air-gapped' ? <Btn kind="outline" icon="download" onClick={() => ctx.toast(`aegis-${r.v}-offline.bundle downloaded (${r.size}); check the SHA-256 on site`, 'ok')}>Download offline bundle</Btn> : null}
        </>
      ) : null}
      {step === 1 ? (
        <>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checks.map(c => <li key={c.text} style={{ display: 'flex', gap: 8 }}><Icon name={c.ok ? 'circle-check' : 'triangle-alert'} style={{ color: c.ok ? 'var(--ok)' : 'var(--warn)', marginTop: 2, flex: 'none' }} />{c.text}</li>)}
          </ul>
          <CheckBox on={pre} onChange={setPre}>Back up the internal database and configuration before patching</CheckBox>
          <p style={{ color: 'var(--tx-2)' }}>If health checks fail after the patch, the orchestrator rolls back to {o.patch} by itself; jobs pause for about 12 minutes either way.</p>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <RadioCard on={when === 'window'} onClick={() => setWhen('window')} icon="calendar-clock" title="In their next maintenance window" note="Sun 02 Nov, 02:00 local; the customer is told 7 days ahead" />
            <RadioCard on={when === 'now'} onClick={() => setWhen('now')} icon="arrow-up" title="Now" note="For urgent security fixes; tell the customer first" />
          </div>
          {when === 'now' ? <StepUp verified={mfa} onVerified={() => setMfa(true)} /> : null}
        </>
      ) : null}
    </Wizard>
  );
}

function LicenceDialog({ ctx, o, closing, onClose, onRenew }: { ctx: Ctx; o: OnPrem; closing: boolean; onClose: () => void; onRenew: (lic: string, days: number) => void }) {
  const [term, setTerm] = useState('1 year');
  const [workloads, setWorkloads] = useState('25');
  const days = term === '1 year' ? 365 : term === '3 years' ? 1095 : 180;
  const n = +workloads;
  return (
    <Dialog
      title={`Licence for ${custName(o.customer)}`}
      sub={o.connect === 'Air-gapped' ? 'Air-gapped: a signed licence file is generated for the customer to upload.' : 'Online: the new licence reaches the install within 6 hours, or at once with Check now.'}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="key" disabled={!n || n < 1} why="Give the number of workloads." onClick={() => { const l = o.connect === 'Air-gapped' ? `Offline file · ${n} workloads · ${term}` : `Online · ${n} workloads · ${term}`; audit({ who: 'priya.raman', customer: o.customer, what: 'Renewed an on-premises licence', object: o.site, when: ctx.now(), r: 'ok', after: [['Licence', l]] }); ctx.toast(o.connect === 'Air-gapped' ? `Licence file aegis-${o.customer}-2027.lic generated; send it to the customer` : 'Licence renewed; the install picks it up within 6 hours', 'ok'); onRenew(l, days + o.licenceDays); }}>{o.connect === 'Air-gapped' ? 'Generate licence file' : 'Renew'}</Btn></>}
    >
      <Facts items={[{ k: 'Current', v: o.licence }, { k: 'Ends in', v: `${o.licenceDays} days` }, { k: 'If it lapses', v: 'Running and scheduled jobs continue for 14 days; new protection is blocked after that' }]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="ol-t" label="Extend by"><SelectInput id="ol-t" value={term} onChange={setTerm} options={['6 months', '1 year', '3 years']} /></Field>
        <Field id="ol-w" label="Workloads"><TextInput id="ol-w" value={workloads} onChange={v => setWorkloads(v.replace(/\D/g, ''))} inputMode="numeric" /></Field>
      </div>
    </Dialog>
  );
}

function TargetDialog({ ctx, o, closing, onClose, onSave }: { ctx: Ctx; o: OnPrem; closing: boolean; onClose: () => void; onSave: () => void }) {
  const [t, setT] = useState<'host360' | 'share'>('host360');
  const [path, setPath] = useState('\\\\cor-nas-02\\aegis-cfg');
  return (
    <Dialog
      title="Where internal backups go"
      sub="Keep them off the orchestrator itself, so it can be rebuilt from them."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={t === 'share' && !/^\\\\[\w.-]+\\[\w$.-]+/.test(path)} why="Give a UNC path such as \\server\share." onClick={() => { audit({ who: 'priya.raman', customer: o.customer, what: 'Changed the internal backup target', object: o.site, when: ctx.now(), r: 'ok', after: [['Target', t === 'host360' ? 'Host360 Chennai DC1' : path]] }); ctx.toast('Target saved; a test write succeeded', 'ok'); onSave(); }}>Save</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={t === 'host360'} onClick={() => setT('host360')} title="Host360 Chennai DC1" note={o.connect === 'Air-gapped' ? 'Not possible: the site is air-gapped' : 'Over the site tunnel, encrypted'} disabled={o.connect === 'Air-gapped'} why="The site is air-gapped." />
        <RadioCard on={t === 'share'} onClick={() => setT('share')} title="A share at the customer site" note="SMB or NFS; must be writable by the aegis service account" />
      </div>
      {t === 'share' ? <Field id="tg-p" label="Path"><TextInput id="tg-p" value={path} onChange={setPath} mono /></Field> : null}
      <Spacer />
    </Dialog>
  );
}
