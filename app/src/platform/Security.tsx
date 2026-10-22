import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { Btn, CheckBox, Field, Seg, TextArea } from '../ui/controls';
import { Bar, Facts, H3, MiniTable, Panel, Section, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, StepUp, useClosable } from '../ui/overlay';
import { EvidenceTab } from './Evidence';
import type { Ctx } from '../ui/ctx';
import { CUSTOMERS, USERS, WORKLOADS } from '../data/platform';
import { CLASSES, COMPLIANCE_MODE, FINDINGS, REVIEWS, type Finding } from '../data/ops';
import { custName, inScope, showCustomerCol } from './common';
import { audit, update, useStore } from './store';
import { nextApprovalId } from '../products/resilience/Failover';

type Tab = 'posture' | 'findings' | 'mode' | 'reviews' | 'evidence';
const SEV_TONE: Record<Finding['sev'], string> = { High: 'err', Medium: 'warn', Low: 'tx' };
const short = (t: string) => t.replace(' 2026', '').replace(' IST', '');

/** Posture checks per customer, scored the same way everywhere. */
function posture(cid: string) {
  const ws = WORKLOADS.filter(w => w.customer === cid);
  const need = ws.filter(w => w.backup.s !== 'na');
  const backed = need.filter(w => w.backup.s === 'protected' || w.backup.s === 'warn' || w.backup.s === 'running').length;
  const drNeed = ws.filter(w => w.dr.s !== 'na' && w.tier !== 'Standard');
  const drOk = drNeed.filter(w => w.dr.s === 'protected' || w.dr.s === 'syncing').length;
  const users = USERS.filter(u => u.customer === cid && u.status === 'active');
  const mfa = users.filter(u => u.mfa !== 'Not set up').length;
  const open = FINDINGS.filter(f => f.customer === cid && f.state === 'Open');
  const parts = [
    { k: 'Backup coverage', v: need.length ? backed / need.length : 1, note: `${backed} of ${need.length} workloads` },
    { k: 'Within recovery target', v: drNeed.length ? drOk / drNeed.length : 1, note: `${drOk} of ${drNeed.length} that need DR` },
    { k: 'MFA', v: users.length ? mfa / users.length : 1, note: `${mfa} of ${users.length} active users` },
    { k: 'Open findings', v: Math.max(0, 1 - open.filter(f => f.sev === 'High').length * 0.25 - open.filter(f => f.sev === 'Medium').length * 0.1), note: `${open.length} open, ${open.filter(f => f.sev === 'High').length} high` }
  ];
  return { score: Math.round((parts.reduce((a, p) => a + p.v, 0) / parts.length) * 100), parts };
}

/** Security & Compliance: posture, findings, compliance mode and periodic reviews. */
export default function SecuritySection({ ctx }: { ctx: Ctx }) {
  const tab = (['posture', 'findings', 'mode', 'reviews', 'evidence'].includes(ctx.tab) ? ctx.tab : 'posture') as Tab;
  const custs = CUSTOMERS.filter(c => inScope(ctx, c.id) && c.status !== 'archived');
  return (
    <Section
      kicker="Operations"
      title="Security & Compliance"
      sub="How well each customer is protected, what breaks their rules, and the locks that keep data safe."
      tab={tab}
      onTab={t => ctx.go(`security/${t}`)}
      tabs={[
        { v: 'posture', label: 'Posture' },
        { v: 'findings', label: 'Findings', count: FINDINGS.filter(f => f.state === 'Open' && inScope(ctx, f.customer)).length },
        { v: 'mode', label: 'Compliance mode' },
        { v: 'reviews', label: 'Reviews', count: REVIEWS.filter(r => r.state !== 'Done' && inScope(ctx, r.customer)).length },
        { v: 'evidence', label: 'Evidence packs' }
      ]}
    >
      {tab === 'posture' ? <Posture ctx={ctx} custs={custs} /> : null}
      {tab === 'findings' ? <Findings ctx={ctx} /> : null}
      {tab === 'mode' ? <ComplianceMode ctx={ctx} /> : null}
      {tab === 'reviews' ? <Reviews ctx={ctx} /> : null}
      {tab === 'evidence' ? <EvidenceTab ctx={ctx} /> : null}
    </Section>
  );
}

function Posture({ ctx, custs }: { ctx: Ctx; custs: typeof CUSTOMERS }) {
  const drawer = useClosable<string>();
  const open = drawer.value;
  const rows = custs.filter(c => WORKLOADS.some(w => w.customer === c.id)).map(c => ({ c, ...posture(c.id) }));
  const d = open ? rows.find(r => r.c.id === open) : null;
  return (
    <TableArea>
      <AegisTable
        label="Posture by customer"
        cols={[
          { k: 'n', label: 'Customer', w: 'minmax(200px,1.5fr)' },
          { k: 'score', label: 'Posture', w: '170px' },
          { k: 'b', label: 'Backup coverage', w: '130px', r: true },
          { k: 'd', label: 'Within RPO', w: '110px', r: true },
          { k: 'm', label: 'MFA', w: '90px', r: true },
          { k: 'f', label: 'Open findings', w: '120px', r: true },
          { k: 'fw', label: 'Frameworks', w: 'minmax(140px,1fr)' }
        ]}
        rows={rows.map(r => ({
          id: r.c.id,
          n: { v: r.c.name, strong: true },
          score: { t: 'bar', pct: r.score, c: r.score >= 85 ? 'ok' : r.score >= 65 ? 'warn' : 'err', v: `${r.score} %`, s: r.score },
          b: { v: `${Math.round(r.parts[0].v * 100)} %`, s: r.parts[0].v, tip: r.parts[0].note },
          d: { v: `${Math.round(r.parts[1].v * 100)} %`, s: r.parts[1].v, tip: r.parts[1].note },
          m: { v: `${Math.round(r.parts[2].v * 100)} %`, s: r.parts[2].v, tip: r.parts[2].note },
          f: FINDINGS.filter(f => f.customer === r.c.id && f.state === 'Open').length ? { t: 'status', i: 'triangle-alert', c: FINDINGS.some(f => f.customer === r.c.id && f.state === 'Open' && f.sev === 'High') ? 'err' : 'warn', l: String(FINDINGS.filter(f => f.customer === r.c.id && f.state === 'Open').length), s: FINDINGS.filter(f => f.customer === r.c.id && f.state === 'Open').length } : { v: '0', muted: true, s: 0 },
          fw: r.c.frameworks
        }))}
        onRow={(id: string) => drawer.open(id)}
        active={open}
        state={ctx.ui}
        unit={['customer', 'customers']}
        emptyText="No customers in this scope yet."
        footR="Scored every hour from backups, replication, sign-in and findings"
        sort="score"
        dir={1}
      />
      {d ? (
        <Drawer label="Posture" kicker="Posture" title={d.c.name} status={<><span>{d.score} %</span><span>{d.c.frameworks.join(', ')}</span></>} closing={drawer.closing} onClose={drawer.close} actions={<Btn kind="outline" icon="triangle-alert" onClick={() => ctx.go('security/findings')}>Findings</Btn>}>
          <MiniTable label="Score parts" cols={[{ label: 'Check', w: '170px' }, { label: 'Score', w: '72px', r: true }, { label: 'Measured' }]} rows={d.parts.map(p => [p.k, `${Math.round(p.v * 100)} %`, p.note])} />
          <p style={{ marginTop: 16, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Each part counts the same. A high finding takes 25 points off its part, a medium one 10.</p>
        </Drawer>
      ) : null}
    </TableArea>
  );
}

function Findings({ ctx }: { ctx: Ctx }) {
  const [state, setState] = useState<'Open' | 'Accepted risk' | 'Fixed' | 'All'>('Open');
  const [list, setList] = useState(FINDINGS);
  const drawer = useClosable<string>();
  const accept = useClosable<string>();
  const [why, setWhy] = useState('');
  const showCust = showCustomerCol(ctx);
  const scoped = list.filter(f => inScope(ctx, f.customer));
  const rows = scoped.filter(f => state === 'All' || f.state === state);
  const d = drawer.value ? list.find(f => f.id === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <Seg label="State" value={state} onChange={setState} options={(['Open', 'Accepted risk', 'Fixed', 'All'] as const).map(v => ({ v, label: v, count: v === 'All' ? scoped.length : scoped.filter(f => f.state === v).length }))} />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Checked every day at 06:00 IST against each workload's class</span>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }}>
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <AegisTable
            label="Findings"
            cols={[
              { k: 'fid', label: 'Finding', w: '100px' },
              { k: 'sev', label: 'Severity', w: '96px' },
              { k: 't', label: 'What', w: 'minmax(200px,2fr)' },
              { k: 'o', label: 'Object', w: 'minmax(120px,1fr)' },
              ...(showCust ? [{ k: 'c', label: 'Customer', w: 'minmax(110px,1fr)', dim: true }] : []),
              { k: 'due', label: 'Due', w: '96px', dim: true }
            ]}
            rows={rows.map(f => ({
              id: f.id,
              fid: f.id,
              sev: { t: 'status', i: f.sev === 'High' ? 'circle-x' : f.sev === 'Medium' ? 'triangle-alert' : 'info', c: SEV_TONE[f.sev], l: f.sev, s: f.sev === 'High' ? 0 : f.sev === 'Medium' ? 1 : 2 },
              t: { v: f.title, strong: true, tip: f.requirement },
              o: f.object,
              c: custName(f.customer),
              due: f.state === 'Open' ? short(f.due).split(',')[0] : { v: f.state, muted: true }
            }))}
            onRow={(id: string) => drawer.open(id)}
            active={drawer.value}
            state={ctx.ui}
            unit={['finding', 'findings']}
            filtered={state !== 'Open'}
            onClear={() => setState('Open')}
            emptyText="No open findings. Every workload meets the rules of its class."
            sort="sev"
          />
        </div>
        <Panel title="Classes and their rules" style={{ alignSelf: 'start' }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {CLASSES.map(c => (
              <li key={c.cls} style={{ padding: '10px 16px', borderBottom: '1px solid var(--ln)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  {c.cls}
                  <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>{plural(c.workloads, 'workload')}</span>
                </div>
                <ul style={{ paddingLeft: 16, font: '12px/18px var(--f-ui)', color: 'var(--tx-2)' }}>
                  {c.rules.map(r => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {d ? (
        <Drawer
          label="Finding"
          kicker={`${d.id} · ${d.cls} class · ${custName(d.customer)}`}
          title={d.title}
          status={<><Status icon={d.sev === 'High' ? 'circle-x' : 'triangle-alert'} tone={SEV_TONE[d.sev]} label={`${d.sev} severity`} /><span>{d.state}</span><span>Due {short(d.due)}</span></>}
          actions={
            d.state === 'Open' ? (
              <>
                <Btn kind="primary" icon="arrow-right" onClick={() => ctx.go(d.object.startsWith('\\') || d.object.includes('@') ? 'workloads' : d.object === 'Billing' ? 'dr/recovery' : 'workloads', d.object === 'Billing' ? 'bill' : WORKLOADS.find(w => w.name === d.object)?.id)}>
                  Fix it
                </Btn>
                <Btn kind="outline" icon="user-check" perm={ctx.can('admin', 'Accepting a risk')} onClick={() => { setWhy(''); accept.open(d.id); }}>
                  Accept the risk…
                </Btn>
              </>
            ) : undefined
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <Facts items={[{ k: 'Object', v: d.object }, { k: 'Rule broken', v: d.requirement }, { k: 'Found', v: d.found }, { k: 'Owner', v: d.owner }, { k: 'How to fix', v: d.fix }]} />
        </Drawer>
      ) : null}
      {accept.value ? (
        <Dialog
          title={`Accept the risk of ${accept.value}`}
          sub="The finding stays visible as accepted until the date you set, then opens again."
          closing={accept.closing}
          onClose={accept.close}
          footer={
            <>
              <Btn kind="ghost" onClick={accept.close}>
                Cancel
              </Btn>
              <Btn kind="primary" icon="send" disabled={why.trim().length < 10} why="Explain why the risk is acceptable." onClick={() => { const id = accept.value!; setList(l => l.map(f => (f.id === id ? { ...f, state: 'Accepted risk' } : f))); audit({ who: 'priya.raman', customer: list.find(f => f.id === id)!.customer, what: 'Accepted the risk of a finding', object: id, when: ctx.now(), r: 'ok', note: why.trim() }); ctx.toast(`${id} accepted until 31 Dec 2026`, 'ok'); accept.close(); }}>
                Accept until 31 Dec 2026
              </Btn>
            </>
          }
        >
          <Field id="ar-why" label="Why the risk is acceptable">
            <TextArea id="ar-why" value={why} onChange={setWhy} rows={3} />
          </Field>
        </Dialog>
      ) : null}
    </>
  );
}

function ComplianceMode({ ctx }: { ctx: Ctx }) {
  useStore();
  const [modes, setModes] = useState(COMPLIANCE_MODE);
  const turnOn = useClosable<string>();
  const unlock = useClosable<string>();
  const scoped = modes.filter(m => inScope(ctx, m.customer));
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Bar tone="info" icon="lock" multiline>
        Compliance mode makes recovery points immutable even for administrators. Turning it off needs three people to approve within 72 hours.
      </Bar>
      {scoped.map(m => (
        <Panel
          key={m.customer}
          title={<>{custName(m.customer)}</>}
          right={
            m.on ? (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Status icon="lock" tone="ok" label={`On since ${short(m.since!)}`} />
                <Btn kind="ghost" size="sm" perm={ctx.can('admin', 'Requesting an unlock')} onClick={() => unlock.open(m.customer)}>
                  Request unlock…
                </Btn>
              </span>
            ) : (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Status icon="minus" tone="tx" label="Off" />
                <Btn kind="outline" size="sm" icon="lock" perm={ctx.can('admin', 'Turning on compliance mode')} onClick={() => turnOn.open(m.customer)}>
                  Turn on…
                </Btn>
              </span>
            )
          }
        >
          {m.on ? (
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24 }}>
              <div>
                <H3>What it locks</H3>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m.locks.map(l => (
                    <li key={l} style={{ display: 'flex', gap: 8 }}>
                      <Icon name="lock" style={{ color: 'var(--tx-2)', marginTop: 2 }} />
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <H3>How to unlock</H3>
                <p style={{ color: 'var(--tx-2)' }}>{m.unlock}</p>
              </div>
            </div>
          ) : (
            <p style={{ padding: '12px 16px', color: 'var(--tx-2)' }}>Recovery points follow the lock set on each repository and policy. Administrators can change retention.</p>
          )}
        </Panel>
      ))}
      {turnOn.value ? (
        <DangerDialog
          title={`Turn on compliance mode for ${custName(turnOn.value)}`}
          intro="Once on, it can only be turned off with three approvals. Check that retention is right first."
          removed={['Deleting recovery points before their lock date, for everyone including Owners', 'Lowering retention or immutability on any policy or repository', 'Turning encryption off']}
          kept="Raising retention, adding copies and restoring all keep working."
          name={custName(turnOn.value)}
          action="Turn on"
          icon="lock"
          closing={turnOn.closing}
          onClose={turnOn.close}
          onConfirm={() => {
            const cid = turnOn.value!;
            setModes(ms => ms.map(x => (x.customer === cid ? { ...x, on: true, since: ctx.now(), locks: COMPLIANCE_MODE.find(y => y.on)!.locks.slice(0, 4), unlock: `Three people approve within 72 h: the Host360 security officer, the ${custName(cid)} owner and its data protection officer.` } : x)));
            audit({ who: 'priya.raman', customer: cid, what: 'Turned on compliance mode', object: custName(cid), when: ctx.now(), r: 'ok' });
            ctx.toast(`Compliance mode is on for ${custName(cid)}`, 'ok');
            turnOn.close();
          }}
        />
      ) : null}
      {unlock.value ? (
        <DangerDialog
          title={`Request an unlock for ${custName(unlock.value)}`}
          intro="Nothing changes until all three approvers agree. The request expires in 72 hours."
          removed={['Compliance mode for this customer, once approved', 'The guarantee that recovery points cannot be deleted early']}
          kept="Existing locks on each recovery point stay until their own dates."
          name={custName(unlock.value)}
          action="Request unlock"
          approval={{ rule: 'Unlock compliance mode needs 3 approvers', approvers: 'the Host360 security officer, the customer owner and the customer DPO', expires: 'in 72 hours' }}
          closing={unlock.closing}
          onClose={unlock.close}
          onConfirm={() => {
            const cid = unlock.value!;
            update(s => {
              s.approvals.unshift({ id: nextApprovalId(), kind: 'Unlock compliance mode', object: custName(cid), customer: cid, requester: 'priya.raman', approvers: 'Host360 security officer, customer owner, customer DPO', needed: 3, given: [], requested: ctx.now(), expires: '24 Oct 2026, 16:05 IST', state: 'pending', reason: 'Requested from Security & Compliance', evidence: [], rule: 'Unlock compliance mode needs 3 approvers' });
            });
            audit({ who: 'priya.raman', customer: cid, what: 'Requested a compliance mode unlock', object: custName(cid), when: ctx.now(), r: 'ok' });
            ctx.toast('Unlock requested. All three approvers were notified.', 'info');
            unlock.close();
          }}
        />
      ) : null}
    </div>
  );
}

function Reviews({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState(REVIEWS);
  const open = useClosable<string>();
  const scoped = list.filter(r => inScope(ctx, r.customer));
  return (
    <>
      <TableArea>
        <AegisTable
          label="Reviews"
          cols={[
            { k: 'n', label: 'Review', w: 'minmax(220px,2fr)' },
            { k: 'c', label: 'Customer', w: 'minmax(140px,1fr)', dim: true },
            { k: 'e', label: 'Every', w: '140px', dim: true },
            { k: 'p', label: 'Progress', w: '150px' },
            { k: 'due', label: 'Due', w: '120px', dim: true },
            { k: 's', label: 'State', w: '120px' }
          ]}
          rows={scoped.map(r => ({
            id: r.id,
            n: { v: r.name, strong: true },
            c: custName(r.customer),
            e: r.every,
            p: { t: 'bar', pct: (r.done / r.items) * 100, c: r.done === r.items ? 'ok' : 'run', v: `${r.done} of ${r.items}` },
            due: short(r.due).split(',')[0],
            s: { t: 'status', i: r.state === 'Done' ? 'circle-check' : r.state === 'Overdue' ? 'triangle-alert' : r.state === 'In progress' ? 'loader-circle' : 'calendar-clock', c: r.state === 'Done' ? 'ok' : r.state === 'Overdue' ? 'warn' : 'tx', l: r.state }
          }))}
          onRow={(id: string) => open.open(id)}
          state={ctx.ui}
          unit={['review', 'reviews']}
          emptyText="No periodic reviews set up. Start one from a template: access, coverage, data inventory or exceptions."
          footR="Reminders go to the reviewer 7 days and 1 day before the due date"
          sort="due"
        />
      </TableArea>
      {open.value ? (
        <ReviewDialog
          ctx={ctx}
          review={list.find(r => r.id === open.value)!}
          closing={open.closing}
          onClose={open.close}
          onDone={id => {
            setList(l => l.map(r => (r.id === id ? { ...r, done: r.items, state: 'Done' } : r)));
            open.close();
          }}
        />
      ) : null}
    </>
  );
}

function ReviewDialog({ ctx, review, closing, onClose, onDone }: { ctx: Ctx; review: (typeof REVIEWS)[number]; closing: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const people = USERS.filter(u => u.customer === review.customer && u.status !== 'deleted').slice(0, Math.min(6, review.items));
  const [keep, setKeep] = useState<Record<string, boolean>>(Object.fromEntries(people.map(u => [u.id, true])));
  const [ack, setAck] = useState(false);
  const [mfa, setMfa] = useState(false);
  const done = review.state === 'Done';
  return (
    <Dialog
      size="lg"
      title={review.name}
      sub={`${custName(review.customer)} · ${review.every.toLowerCase()} · reviewer ${review.by}`}
      closing={closing}
      onClose={onClose}
      footNote={done ? 'Signed and filed in Reports › Evidence.' : 'Your decision and signature are added to the evidence pack.'}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            {done ? 'Close' : 'Save for later'}
          </Btn>
          {!done ? (
            <Btn kind="primary" icon="file-check" disabled={!ack || !mfa} why={!ack ? 'Confirm the statement first.' : 'Confirm it is you first.'} onClick={() => { const removed = people.filter(u => !keep[u.id]).length; audit({ who: 'priya.raman', customer: review.customer, what: `Signed off ${review.name}`, object: `${review.items} items`, when: ctx.now(), r: 'ok', note: removed ? `${plural(removed, 'person', 'people')} to be removed` : 'No changes' }); ctx.toast(`${review.name} signed off and filed`, 'ok'); onDone(review.id); }}>
              Sign off
            </Btn>
          ) : null}
        </>
      }
    >
      {done ? (
        <Bar tone="ok">Signed off by {review.by}. Every item was reviewed.</Bar>
      ) : (
        <>
          <MiniTable
            label="Items"
            cols={[{ label: 'Person' }, { label: 'Roles', w: '230px' }, { label: 'Last sign-in', w: '150px' }, { label: 'Keep access', w: '96px' }]}
            rows={people.map(u => [<strong key="n" style={{ fontWeight: 600 }}>{u.name}</strong>, u.roles.map(r => r.role).join(', '), u.last ? u.last.replace(' 2026', '').replace(' IST', '') : 'Never', <CheckBox key="k" on={!!keep[u.id]} onChange={v => setKeep(k => ({ ...k, [u.id]: v }))} label={`Keep ${u.name}`} />])}
          />
          <CheckBox on={ack} onChange={setAck}>
            I reviewed every item and the access above is still needed
          </CheckBox>
          {ack ? <StepUp verified={mfa} onVerified={() => setMfa(true)} /> : null}
        </>
      )}
    </Dialog>
  );
}
