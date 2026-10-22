import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { Btn, CheckBox, Field, FilterInput, RadioCard, SelectInput, TextArea, TextInput } from '../ui/controls';
import { Activity, Bar, Facts, MiniTable, Panel, Section, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, StepUp, Wizard, useClosable } from '../ui/overlay';
import { CalculatorsTab, CompatibilityTab } from './Calculators';
import type { Ctx } from '../ui/ctx';
import { KB, NOTICES, STATUS, TICKETS, type Ticket } from '../data/ops';
import { custName, inScope, showCustomerCol } from './common';
import { audit } from './store';

type Tab = 'requests' | 'diagnostics' | 'assist' | 'kb' | 'calculators' | 'compatibility' | 'status';
const short = (t: string) => t.replace(' 2026', '').replace(' IST', '');
const SEV_NOTE = { S1: 'Down: production stopped, no workaround', S2: 'Degraded: a product works partly', S3: 'A question or a fault with a workaround', S4: 'Billing, a request or feedback' };

/** Support: requests, diagnostic bundles with redaction, remote assist with approval, knowledge base and status. */
export default function SupportSection({ ctx }: { ctx: Ctx }) {
  const allowed = ctx.audience === 'self' ? ['requests', 'kb', 'status'] : ['requests', 'diagnostics', 'assist', 'kb', 'calculators', 'compatibility', 'status'];
  const tab = (allowed.includes(ctx.tab) ? ctx.tab : 'requests') as Tab;
  const [tickets, setTickets] = useState<Ticket[]>(TICKETS);
  return (
    <Section
      kicker="Administration"
      title="Support"
      sub={ctx.audience === 'self' ? 'Ask your provider for help and follow your requests.' : 'Requests to Host360 support, the evidence they need, and how the service is running.'}
      tab={tab}
      onTab={t => ctx.go(`support/${t}`)}
      tabs={[
        { v: 'requests' as Tab, label: 'Requests', count: tickets.filter(t => t.state !== 'Resolved' && inScope(ctx, t.customer)).length },
        { v: 'diagnostics' as Tab, label: 'Diagnostic bundles' },
        { v: 'assist' as Tab, label: 'Remote assist' },
        { v: 'kb' as Tab, label: 'Knowledge base' },
        { v: 'calculators' as Tab, label: 'Calculators' },
        { v: 'compatibility' as Tab, label: 'Compatibility' },
        { v: 'status' as Tab, label: 'Service status' }
      ].filter(t => ctx.audience !== 'self' || ['requests', 'kb', 'status'].includes(t.v))}
    >
      {tab === 'requests' ? <Requests ctx={ctx} tickets={tickets} setTickets={setTickets} /> : null}
      {tab === 'diagnostics' ? <Diagnostics ctx={ctx} /> : null}
      {tab === 'assist' ? <Assist ctx={ctx} /> : null}
      {tab === 'kb' ? <Knowledge ctx={ctx} /> : null}
      {tab === 'calculators' ? <CalculatorsTab ctx={ctx} /> : null}
      {tab === 'compatibility' ? <CompatibilityTab ctx={ctx} /> : null}
      {tab === 'status' ? <ServiceStatus /> : null}
    </Section>
  );
}

function Requests({ ctx, tickets, setTickets }: { ctx: Ctx; tickets: Ticket[]; setTickets: (f: (t: Ticket[]) => Ticket[]) => void }) {
  const drawer = useClosable<string>();
  const create = useClosable<boolean>();
  const [reply, setReply] = useState('');
  const [q, setQ] = useState('');
  const showCust = showCustomerCol(ctx);
  const ql = q.trim().toLowerCase();
  const rows = tickets.filter(t => inScope(ctx, t.customer) && (!ql || `${t.id} ${t.title} ${t.object || ''}`.toLowerCase().includes(ql)));
  const d = drawer.value ? tickets.find(t => t.id === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <FilterInput value={q} onChange={setQ} placeholder="Filter by number, title or object" label="Filter requests" width={260} />
        <Spacer />
        <Btn kind="primary" icon="plus" onClick={() => create.open(true)}>
          New request
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Requests"
          cols={[
            { k: 'id', label: 'Request', w: '100px' },
            { k: 'sev', label: 'Severity', w: '84px' },
            { k: 't', label: 'Title', w: 'minmax(220px,2fr)' },
            ...(showCust ? [{ k: 'c', label: 'Customer', w: 'minmax(120px,1fr)', dim: true }] : []),
            { k: 'p', label: 'Product', w: '110px', dim: true },
            { k: 's', label: 'State', w: '170px' },
            { k: 'u', label: 'Updated', w: '120px', dim: true }
          ]}
          rows={rows.map(t => ({
            id: t.id,
            sev: { t: 'status', i: t.sev === 'S1' ? 'circle-x' : t.sev === 'S2' ? 'triangle-alert' : 'circle-dot', c: t.sev === 'S1' ? 'err' : t.sev === 'S2' ? 'warn' : 'tx', l: t.sev, tip: SEV_NOTE[t.sev] },
            t: { v: t.title, strong: true },
            c: custName(t.customer),
            p: t.product,
            s: { t: 'status', i: t.state === 'Resolved' ? 'circle-check' : t.state === 'Waiting on you' ? 'hand' : 'loader-circle', c: t.state === 'Resolved' ? 'ok' : t.state === 'Waiting on you' ? 'warn' : 'run', l: t.state, spin: false },
            u: short(t.updated).split(', ')[0] === '21 Oct' ? short(t.updated).split(', ')[1] : short(t.updated).split(',')[0]
          }))}
          onRow={(id: string) => { drawer.open(id); setReply(''); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['request', 'requests']}
          filtered={!!ql}
          onClear={() => setQ('')}
          emptyText="No support requests. Ask for help when something does not work as you expect."
          emptyAction="New request"
          onEmpty={() => create.open(true)}
          footR="S1 answered within 30 min, S2 within 2 h, S3 and S4 within 1 business day"
          sort="u"
          dir={-1}
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Request"
          kicker={`${d.id} · ${d.product}${d.object ? ` · ${d.object}` : ''}`}
          title={d.title}
          status={<><span>{d.sev}: {SEV_NOTE[d.sev].split(':')[0]}</span><span>{d.state}</span><span>Opened {short(d.opened)}</span></>}
          actions={
            d.state !== 'Resolved' ? (
              <>
                {!d.bundle ? <Btn kind="outline" icon="file-check" onClick={() => ctx.go('support/diagnostics')}>Attach a diagnostic bundle</Btn> : null}
                <Btn kind="outline" icon="circle-check" onClick={() => { setTickets(ts => ts.map(t => (t.id === d.id ? { ...t, state: 'Resolved', updated: ctx.now() } : t))); audit({ who: 'priya.raman', customer: d.customer, what: 'Closed a support request', object: d.id, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.id} closed`, 'ok'); }}>
                  Close request
                </Btn>
              </>
            ) : undefined
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {d.assist ? <Bar tone="info" icon="headset">{d.assist}. Approve it under Remote assist.</Bar> : null}
            <Activity
              items={[
                { icon: 'user', text: <><strong style={{ fontWeight: 600 }}>{d.by}</strong> opened the request. {d.object ? `Object: ${d.object}.` : ''}</>, when: d.opened },
                ...(d.bundle ? [{ icon: 'file-check', tone: 'ok', text: <>Diagnostic bundle {d.bundle} attached</>, when: d.opened }] : []),
                { icon: 'headset', tone: 'info', text: <><strong style={{ fontWeight: 600 }}>Host360 support (Ravi P.)</strong>: {d.state === 'Waiting on you' ? 'Please add a VolumeSnapshotClass for the ceph-rbd driver and run the backup again (see KB-1088).' : d.product === 'Resilience' ? 'We see the quiesce timing out on the VSS writer for NTDS. We are testing a fix on a lab DC.' : 'Investigating. We will update you within the response time for this severity.'}</>, when: d.updated }
              ]}
            />
            {d.state !== 'Resolved' ? (
              <>
                <Field id="tk-reply" label="Reply">
                  <TextArea id="tk-reply" value={reply} onChange={setReply} rows={3} />
                </Field>
                <div>
                  <Btn kind="primary" icon="send" disabled={!reply.trim()} why="Write a reply first." onClick={() => { setTickets(ts => ts.map(t => (t.id === d.id ? { ...t, state: 'Waiting on Host360', updated: ctx.now() } : t))); ctx.toast(`Reply added to ${d.id}`, 'ok'); setReply(''); }}>
                    Send reply
                  </Btn>
                </div>
              </>
            ) : null}
          </div>
        </Drawer>
      ) : null}
      {create.value ? (
        <NewRequest
          ctx={ctx}
          closing={create.closing}
          onClose={create.close}
          onCreate={t => {
            setTickets(ts => [t, ...ts]);
            create.close();
          }}
        />
      ) : null}
    </>
  );
}

function NewRequest({ ctx, closing, onClose, onCreate }: { ctx: Ctx; closing: boolean; onClose: () => void; onCreate: (t: Ticket) => void }) {
  const [title, setTitle] = useState('');
  const [sev, setSev] = useState<Ticket['sev']>('S3');
  const [product, setProduct] = useState('Protection');
  const [object, setObject] = useState('');
  const [desc, setDesc] = useState('');
  const [bundle, setBundle] = useState(true);
  return (
    <Dialog
      size="lg"
      title="New support request"
      sub="Host360 support sees your request, the object and, if you attach it, a redacted diagnostic bundle."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="send" disabled={!title.trim() || !desc.trim()} why="Give a title and describe what happens." onClick={() => { const id = `SR-${48214 + Math.floor(Math.random() * 50)}`; onCreate({ id, title: title.trim(), customer: ctx.actingAs?.customer || 'h360', sev, state: 'Open', opened: ctx.now(), updated: ctx.now(), by: 'priya.raman', product, object: object.trim() || undefined, bundle: bundle ? 'Being collected; redacted' : undefined }); audit({ who: 'priya.raman', customer: ctx.actingAs?.customer || 'h360', what: 'Opened a support request', object: id, when: ctx.now(), r: 'ok' }); ctx.toast(`${id} opened. ${sev === 'S1' ? 'Support calls you within 30 min.' : 'You will be told when support replies.'}`, 'ok'); }}>
            Send request
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="nr-t" label="Title" span={2}>
          <TextInput id="nr-t" value={title} onChange={setTitle} placeholder="Replication of ad-dc-01 fails at the snapshot step" />
        </Field>
        <Field id="nr-p" label="Product">
          <SelectInput id="nr-p" value={product} onChange={setProduct} options={['Protection', 'Resilience', 'Mobility', 'Platform', 'Billing']} />
        </Field>
        <Field id="nr-o" label="Object (optional)">
          <TextInput id="nr-o" value={object} onChange={setObject} placeholder="ad-dc-01" />
        </Field>
        <Field id="nr-d" label="What happens, and since when" span={2}>
          <TextArea id="nr-d" value={desc} onChange={setDesc} rows={4} />
        </Field>
      </div>
      <div role="radiogroup" aria-label="Severity" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        {(Object.keys(SEV_NOTE) as Ticket['sev'][]).map(k => (
          <RadioCard key={k} on={sev === k} onClick={() => setSev(k)} title={k} note={SEV_NOTE[k]} />
        ))}
      </div>
      <CheckBox on={bundle} onChange={setBundle}>
        Attach a diagnostic bundle (logs of the last 24 h, redacted)
      </CheckBox>
    </Dialog>
  );
}

const BUNDLES = [
  { id: 'DIAG-21OCT-0412', made: '21 Oct 2026, 12:58 IST', by: 'arun.kumar', scope: 'Resilience · ad-dc-01 · last 24 h', size: '18.4 MB', redact: 'IP addresses, host names, user names', ticket: 'SR-48213', expires: '04 Nov 2026' },
  { id: 'DIAG-15OCT-0377', made: '15 Oct 2026, 09:10 IST', by: 'meera.iyer', scope: 'Mobility · crm-db-01 · last 48 h', size: '42.9 MB', redact: 'User names', ticket: 'SR-48101', expires: '29 Oct 2026' }
];

function Diagnostics({ ctx }: { ctx: Ctx }) {
  const create = useClosable<boolean>();
  const [list, setList] = useState(BUNDLES);
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Secrets, keys and passwords are always removed. Choose what else to hide before anything leaves the orchestrator.</span>
        <Spacer />
        <Btn kind="primary" icon="file-check" onClick={() => create.open(true)}>
          Collect a bundle…
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Diagnostic bundles"
          cols={[{ k: 'id', label: 'Bundle', w: '160px' }, { k: 'scope', label: 'What it holds', w: 'minmax(200px,2fr)' }, { k: 'red', label: 'Also hidden', w: 'minmax(160px,1.4fr)', dim: true }, { k: 'size', label: 'Size', w: '80px', r: true }, { k: 't', label: 'Shared with', w: '100px' }, { k: 'x', label: 'Deleted on', w: '120px', dim: true }]}
          rows={list.map(b => ({ id: b.id, scope: { v: b.scope, strong: true }, red: b.redact, size: b.size, t: b.ticket, x: b.expires }))}
          state={ctx.ui}
          unit={['bundle', 'bundles']}
          emptyText="No bundles yet. Collect one when support asks for logs."
          footR="Bundles are deleted after 14 days"
          sort="id"
        />
      </TableArea>
      {create.value ? (
        <BundleWizard
          ctx={ctx}
          closing={create.closing}
          onClose={create.close}
          onDone={b => {
            setList(l => [b, ...l]);
            create.close();
          }}
        />
      ) : null}
    </>
  );
}

function BundleWizard({ ctx, closing, onClose, onDone }: { ctx: Ctx; closing: boolean; onClose: () => void; onDone: (b: (typeof BUNDLES)[number]) => void }) {
  const [step, setStep] = useState(0);
  const [parts, setParts] = useState({ orch: true, proxy: true, jobs: true, config: false });
  const [hide, setHide] = useState({ ip: true, host: true, user: true });
  const [ticket, setTicket] = useState('SR-48207');
  const sample = `2026-10-21 14:52:07 WARN proxy aegis-proxy-nova-248d (10.40.0.21) lost Keystone at 10.40.0.5:5000 for user svc-aegis-dr token=gAAAAABl…`;
  const seen: Record<string, string> = {};
  let red = sample;
  if (hide.ip) red = red.replace(/\b\d+\.\d+\.\d+\.\d+/g, m => (seen[m] ||= `[ip-${Object.keys(seen).length + 1}]`));
  if (hide.host) red = red.replace(/aegis-proxy-nova-248d/g, '[host-1]');
  if (hide.user) red = red.replace(/svc-aegis-dr/g, '[user-1]');
  red = red.replace(/token=\S+/, 'token=[secret]');
  return (
    <Wizard
      title="Collect a diagnostic bundle"
      sub="Nothing leaves the orchestrator until you share it with a request."
      steps={['What to collect', 'What to hide', 'Share']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={
        step < 2 ? (
          <Btn kind="primary" iconAfter="chevron-right" disabled={!Object.values(parts).some(Boolean)} why="Choose at least one part." onClick={() => setStep(step + 1)}>
            Next
          </Btn>
        ) : (
          <Btn kind="primary" icon="send" onClick={() => { ctx.startJob({ name: 'Diagnostic bundle', object: ticket, product: 'Platform', phases: ['Collect', 'Redact', 'Compress', 'Done'], speed: 20, doneToast: `Bundle collected, redacted and shared with ${ticket}` }); audit({ who: 'priya.raman', customer: 'h360', what: 'Collected a diagnostic bundle', object: ticket, when: ctx.now(), r: 'ok', note: `Hidden: secrets${hide.ip ? ', IP addresses' : ''}${hide.host ? ', host names' : ''}${hide.user ? ', user names' : ''}` }); onDone({ id: 'DIAG-21OCT-0420', made: ctx.now(), by: 'priya.raman', scope: `${[parts.orch && 'Orchestrator', parts.proxy && 'proxies', parts.jobs && 'job logs', parts.config && 'configuration'].filter(Boolean).join(', ')} · last 24 h`, size: 'Collecting…', redact: [hide.ip && 'IP addresses', hide.host && 'host names', hide.user && 'user names'].filter(Boolean).join(', ') || 'Secrets only', ticket, expires: '04 Nov 2026' }); }}>
            Collect and share
          </Btn>
        )
      }
    >
      {step === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CheckBox on={parts.orch} onChange={v => setParts(p => ({ ...p, orch: v }))}>Orchestrator logs, last 24 h</CheckBox>
          <CheckBox on={parts.proxy} onChange={v => setParts(p => ({ ...p, proxy: v }))}>Proxy and appliance logs, last 24 h</CheckBox>
          <CheckBox on={parts.jobs} onChange={v => setParts(p => ({ ...p, jobs: v }))}>Logs of failed and warning jobs</CheckBox>
          <CheckBox on={parts.config} onChange={v => setParts(p => ({ ...p, config: v }))}>Configuration export (policies, mappings; never credentials)</CheckBox>
        </div>
      ) : null}
      {step === 1 ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CheckBox on disabled why="Always removed." onChange={() => undefined}>Secrets, keys, tokens and passwords (always)</CheckBox>
            <CheckBox on={hide.ip} onChange={v => setHide(h => ({ ...h, ip: v }))}>IP addresses</CheckBox>
            <CheckBox on={hide.host} onChange={v => setHide(h => ({ ...h, host: v }))}>Host names</CheckBox>
            <CheckBox on={hide.user} onChange={v => setHide(h => ({ ...h, user: v }))}>User names</CheckBox>
          </div>
          <MiniTable label="Preview" cols={[{ label: 'Before' }]} rows={[[<code key="b" style={{ font: '12px var(--f-ui)', whiteSpace: 'normal' }}>{sample}</code>]]} />
          <MiniTable label="Preview after" cols={[{ label: 'What support sees' }]} rows={[[<code key="a" style={{ font: '12px var(--f-ui)', whiteSpace: 'normal' }}>{red}</code>]]} />
        </>
      ) : null}
      {step === 2 ? (
        <Field id="bw-t" label="Share with request">
          <SelectInput id="bw-t" value={ticket} onChange={setTicket} options={TICKETS.filter(t => t.state !== 'Resolved').map(t => ({ v: t.id, label: `${t.id} · ${t.title}` }))} />
        </Field>
      ) : null}
    </Wizard>
  );
}

function Assist({ ctx }: { ctx: Ctx }) {
  const [state, setState] = useState<'requested' | 'active' | 'ended' | 'denied'>('requested');
  const [mfa, setMfa] = useState(false);
  const [mode, setMode] = useState<'view' | 'control'>('view');
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>
      <Panel title="Request from Host360 support" right={<Status icon={state === 'active' ? 'loader-circle' : state === 'requested' ? 'hand' : state === 'denied' ? 'ban' : 'circle-check'} spin={state === 'active'} tone={state === 'active' ? 'run' : state === 'requested' ? 'warn' : 'tx'} label={state === 'active' ? 'Session running' : state === 'requested' ? 'Waiting for approval' : state === 'denied' ? 'Denied' : 'Ended'} />}>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Facts items={[{ k: 'Engineer', v: 'Ravi P. (Host360 support, L2)' }, { k: 'Request', v: 'SR-48207 · region-2-os unreachable' }, { k: 'Wants', v: 'View the console and run connectivity checks from aegis-proxy-nova-248d' }, { k: 'For', v: '1 hour, recorded; ends by itself' }]} />
          {state === 'requested' ? (
            <>
              <div role="radiogroup" aria-label="Access" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <RadioCard on={mode === 'view'} onClick={() => setMode('view')} icon="eye" title="View only" note="They see your screen and the proxy console; they cannot click or type." />
                <RadioCard on={mode === 'control'} onClick={() => setMode('control')} icon="hand" title="View and control" note="They can run checks on the proxy. Every command is recorded." />
              </div>
              <StepUp verified={mfa} onVerified={() => setMfa(true)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn kind="primary" icon="check" disabled={!mfa} why="Confirm it is you first." perm={ctx.can('admin', 'Approving remote assist')} onClick={() => { setState('active'); audit({ who: 'priya.raman', customer: 'h360', what: `Approved remote assist (${mode === 'view' ? 'view only' : 'view and control'})`, object: 'SR-48207', when: ctx.now(), r: 'ok' }); ctx.toast('Remote assist started. It is recorded and ends in 1 hour.', 'warn'); }}>
                  Approve for 1 hour
                </Btn>
                <Btn kind="ghost" onClick={() => { setState('denied'); audit({ who: 'priya.raman', customer: 'h360', what: 'Denied remote assist', object: 'SR-48207', when: ctx.now(), r: 'ok' }); }}>
                  Deny
                </Btn>
              </div>
            </>
          ) : state === 'active' ? (
            <>
              <Bar tone="run">Ravi P. is connected ({mode === 'view' ? 'view only' : 'view and control'}). Recording RA-0091. Ends at 17:05 IST.</Bar>
              <div>
                <Btn kind="danger" icon="circle-stop" onClick={() => { setState('ended'); audit({ who: 'priya.raman', customer: 'h360', what: 'Ended remote assist', object: 'SR-48207', when: ctx.now(), r: 'ok' }); ctx.toast('Remote assist ended. The recording is attached to SR-48207.', 'ok'); }}>
                  End the session now
                </Btn>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--tx-2)' }}>{state === 'ended' ? 'The recording RA-0091 is attached to SR-48207 and kept for 90 days.' : 'Support was told you denied the session.'}</p>
          )}
        </div>
      </Panel>
      <Panel title="Earlier sessions">
        <div style={{ padding: '0 16px 4px' }}>
          <MiniTable label="Earlier sessions" cols={[{ label: 'When', w: '170px' }, { label: 'Engineer', w: '160px' }, { label: 'Access', w: '130px' }, { label: 'Approved by', w: '140px' }, { label: 'Recording' }]} rows={[['14 Oct 2026, 11:00 IST', 'Ravi P.', 'View only', 'priya.raman', 'RA-0084 · 22 min'], ['02 Sep 2026, 16:30 IST', 'Sana K.', 'View and control', 'arun.kumar', 'RA-0061 · 41 min']]} />
        </div>
      </Panel>
    </div>
  );
}

function Knowledge({ ctx }: { ctx: Ctx }) {
  const [q, setQ] = useState('');
  const [code, setCode] = useState('');
  const ql = q.trim().toLowerCase();
  const rows = KB.filter(k => !ql || `${k.title} ${k.code} ${k.product}`.toLowerCase().includes(ql));
  const hit = code.trim() ? KB.find(k => k.code.toLowerCase() === code.trim().toLowerCase()) : null;
  return (
    <>
      <Toolbar>
        <FilterInput value={q} onChange={setQ} placeholder="Search articles" label="Search the knowledge base" width={260} />
        <Spacer />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>
          Error code
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="AEG-DR-2041" aria-label="Error code" style={{ width: 140, height: 32, padding: '0 10px', background: 'var(--panel)', border: '1px solid var(--ln-2)', font: '13px var(--f-ui)' }} />
        </label>
      </Toolbar>
      {code.trim() ? (
        <div style={{ padding: '0 24px 12px' }}>
          {hit ? <Bar tone="info" icon="book-open">{hit.code}: {hit.title} ({hit.id})</Bar> : <Bar tone="warn">No article for {code.trim()} yet. Open a request and support will look it up.</Bar>}
        </div>
      ) : null}
      <TableArea>
        <AegisTable
          label="Knowledge base"
          cols={[{ k: 'id', label: 'Article', w: '96px' }, { k: 't', label: 'Title', w: 'minmax(260px,3fr)' }, { k: 'code', label: 'Error code', w: '120px' }, { k: 'p', label: 'Product', w: '110px', dim: true }, { k: 'v', label: 'Read', w: '80px', r: true }]}
          rows={rows.map(k => ({ id: k.id, t: { v: k.title, strong: true }, code: k.code, p: k.product, v: { v: String(k.views), s: k.views } }))}
          onRow={(id: string) => ctx.toast(`${id} opened in a new tab`, 'info')}
          state={ctx.ui}
          unit={['article', 'articles']}
          filtered={!!ql}
          onClear={() => setQ('')}
          emptyText="No articles."
          sort="v"
          dir={-1}
        />
      </TableArea>
    </>
  );
}

function ServiceStatus() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <Panel title="Service status" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Updated 16:05 IST</span>}>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {STATUS.map(x => (
            <li key={x.svc} style={{ display: 'grid', gridTemplateColumns: '20px 200px minmax(0,1fr)', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--ln)' }}>
              <Icon name={x.state === 'ok' ? 'circle-check' : 'triangle-alert'} style={{ color: x.state === 'ok' ? 'var(--ok)' : 'var(--warn)', marginTop: 2 }} />
              <span style={{ fontWeight: 600 }}>{x.svc}</span>
              <span style={{ color: x.state === 'ok' ? 'var(--tx-2)' : 'var(--tx)' }}>{x.note}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={<>Notices <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>{plural(NOTICES.length, 'notice')}</span></>}>
        <div style={{ padding: '0 16px' }}>
          <Activity items={NOTICES.map(n => ({ icon: 'calendar-clock', text: n.text, when: n.when }))} />
        </div>
      </Panel>
    </div>
  );
}
