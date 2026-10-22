import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { AEGIS } from '../data/aegis';
import { WORKLOADS, customerById } from '../data/platform';
import { store, update, useStore } from './store';
import { Btn, Seg } from '../ui/controls';
import { Page, PageHeader, StateBlock, Toolbar, plural } from '../ui/layout';
import type { Ctx } from '../ui/ctx';
import { custName, inScope } from './common';
import { ApproveDialog } from './Approvals';
import { useClosable } from '../ui/overlay';

export type InboxKind = 'approval' | 'failed' | 'sla' | 'licence' | 'drill' | 'cutover';
export type InboxItem = { id: string; kind: InboxKind; title: string; detail: string; customer: string; when: string; due?: string; urgent?: boolean; action: string; to: string; openId?: string; approvalId?: string };

const KIND: Record<InboxKind, { label: string; icon: string; c: string }> = {
  approval: { label: 'Approvals waiting', icon: 'user-check', c: 'var(--acc)' },
  failed: { label: 'Failed jobs', icon: 'circle-x', c: 'var(--err)' },
  sla: { label: 'Breached targets', icon: 'clock', c: 'var(--warn)' },
  licence: { label: 'Licences', icon: 'key', c: 'var(--warn)' },
  drill: { label: 'Drills due', icon: 'flask-conical', c: 'var(--run)' },
  cutover: { label: 'Cutovers pending', icon: 'power', c: 'var(--warn)' }
};

/** Everything that needs a person, across all products, newest and most urgent first. */
export function inboxItems(ctx: Ctx): InboxItem[] {
  const done = store.inboxDone;
  const items: InboxItem[] = [];
  store.approvals.filter(a => a.state === 'pending' && inScope(ctx, a.customer)).forEach(a =>
    items.push({ id: a.id, kind: 'approval', title: `${a.kind}: ${a.object}`, detail: `Requested by ${a.requester} · ${a.given.length} of ${a.needed} approvals`, customer: a.customer, when: a.requested, due: `Expires ${a.expires}`, urgent: a.kind === 'Failover' || a.kind === 'Cutover', action: 'Review', to: 'automation/approvals', approvalId: a.id })
  );
  AEGIS.jobs.filter((j: { status: string }) => j.status === 'err').forEach((j: { id: string; name: string; object: string; started: string; note: string }) =>
    items.push({ id: 'job-' + j.id, kind: 'failed', title: `${j.name} failed for ${j.object}`, detail: j.note, customer: 'h360', when: j.started, urgent: true, action: 'Retry', to: 'activity/jobs', openId: j.id })
  );
  store.alerts.filter(a => a.state !== 'suppressed' && a.rule.startsWith('RPO breached') && inScope(ctx, a.customer)).forEach(a =>
    items.push({ id: 'sla-' + a.id, kind: 'sla', title: `${a.object} is behind its recovery target`, detail: a.detail, customer: a.customer, when: a.raised, action: 'Open', to: 'workloads', openId: WORKLOADS.find(w => w.name === a.object)?.id })
  );
  store.entitlements.filter(e => inScope(ctx, e.customer) && (e.state === 'trial' || e.state === 'overage' || e.state === 'suspended' || (e.days < 45 && e.state === 'active'))).forEach(e =>
    items.push({
      id: 'lic-' + e.id,
      kind: 'licence',
      title: e.state === 'overage' ? `${e.product} over its limit at ${customerById(e.customer).name}` : e.state === 'suspended' ? `${customerById(e.customer).name} is suspended` : e.state === 'trial' ? `Trial ends ${e.expires} for ${customerById(e.customer).name}` : `${e.product} renews ${e.expires} for ${customerById(e.customer).name}`,
      detail: e.note || `${e.used} of ${e.limit} ${e.unit} used · ${e.edition}`,
      customer: e.customer,
      when: e.state === 'trial' || e.state === 'active' ? `${e.days} days left` : 'Now',
      urgent: e.state === 'suspended',
      action: 'Open',
      to: 'billing/entitlements',
      openId: e.id
    })
  );
  store.apps.filter(a => inScope(ctx, a.customer) && (a.lastDrill?.r === 'warn' || (a.drPlan && !a.lastDrill))).forEach(a =>
    items.push({ id: 'drill-' + a.id, kind: 'drill', title: `Drill due for ${a.name}`, detail: a.lastDrill ? `Last drill ${a.lastDrill.when} came close to its RTO (${a.lastDrill.rto})` : `${a.tier} applications are drilled every quarter; no drill has run yet`, customer: a.customer, when: a.lastDrill ? a.lastDrill.when : 'Never', action: 'Schedule', to: 'dr/recovery' })
  );
  WORKLOADS.filter(w => inScope(ctx, w.customer, w.project) && (w.mig.s === 'cutover' || w.mig.s === 'ready')).forEach(w =>
    items.push({ id: 'cut-' + w.id, kind: 'cutover', title: w.mig.s === 'cutover' ? `${w.name} is cut over but not committed` : `${w.name} is ready for cutover`, detail: w.mig.s === 'cutover' ? 'Commit to release the source snapshot, or roll back.' : `${w.mig.wave || 'No wave'} · waiting for the go/no-go`, customer: w.customer, when: w.lifecycle[w.lifecycle.length - 1]?.when || '', urgent: w.mig.s === 'cutover', action: 'Open', to: 'mig/servers', openId: w.name })
  );
  return items.filter(i => !done[i.id]);
}

export default function Inbox({ ctx }: { ctx: Ctx }) {
  const [kind, setKind] = useState<'all' | InboxKind>('all');
  useStore();
  const setDone = (fn: (d: Record<string, boolean>) => Record<string, boolean>) => update(s => { s.inboxDone = fn(s.inboxDone); });
  const approve = useClosable<string>();
  const items = inboxItems(ctx);
  const shown = items.filter(i => kind === 'all' || i.kind === kind).sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
  const count = (k: InboxKind) => items.filter(i => i.kind === k).length;
  const act = (i: InboxItem) => {
    if (i.approvalId) {
      approve.open(i.approvalId);
      return;
    }
    if (i.kind === 'failed') {
      ctx.startJob({ name: i.title.replace(/ failed for.*/, ''), object: i.title.replace(/.* failed for /, ''), product: 'Backup', phases: ['Queued', 'Snapshot', 'Write', 'Verify', 'Done'], speed: 8 });
      ctx.toast(`Retry started: ${i.title.replace(' failed', '')}`, 'info');
      setDone(d => ({ ...d, [i.id]: true }));
      return;
    }
    ctx.go(i.to, i.openId);
  };
  return (
    <Page>
      <PageHeader kicker="Platform" title="Inbox" sub="What needs you across Protection, Resilience and Mobility, most urgent first." meta={`${plural(items.length, 'item')} · ${items.filter(i => i.urgent).length} urgent`} />
      <Toolbar>
        <Seg
          label="Show"
          value={kind}
          onChange={setKind}
          options={[{ v: 'all', label: 'All', count: items.length }, ...(Object.keys(KIND) as InboxKind[]).map(k => ({ v: k, label: KIND[k].label, count: count(k) }))]}
        />
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
          <StateBlock ui={ctx.ui === 'live' && !shown.length ? 'empty' : ctx.ui} emptyText={kind === 'all' ? 'Nothing needs you right now. New approvals, failures and due drills appear here.' : `No ${KIND[kind as InboxKind].label.toLowerCase()} right now.`} emptyAction={kind !== 'all' ? 'Show everything' : undefined} onEmpty={() => setKind('all')} unreachText="Could not be read: the orchestrator did not answer within 30 s.">
            <ol style={{ listStyle: 'none', padding: 0 }}>
              {shown.map(i => {
                const k = KIND[i.kind];
                return (
                  <li key={i.id} className={pc('hover', 'background:var(--hover)')} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) 200px auto', gap: 14, alignItems: 'center', minHeight: 60, padding: '10px 12px 10px 16px', borderBottom: '1px solid var(--ln)', boxShadow: i.urgent ? 'inset 2px 0 0 var(--err)' : 'none', transition: 'background-color 100ms', animation: 'ae-fade 150ms var(--ease)' }}>
                    <Icon name={k.icon} style={{ color: k.c }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.title}</span>
                      <span style={{ display: 'block', font: '12px/18px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={i.detail} data-tip-overflow="">
                        {k.label} · {custName(i.customer)} · {i.detail}
                      </span>
                    </span>
                    <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', textAlign: 'right' }}>
                      <span style={{ display: 'block' }}>{i.when}</span>
                      {i.due ? <span style={{ display: 'block', color: i.urgent ? 'var(--warn)' : 'var(--tx-3)' }}>{i.due}</span> : null}
                    </span>
                    <span style={{ display: 'flex', gap: 4 }}>
                      <Btn kind={i.approvalId || i.kind === 'failed' ? 'primary' : 'outline'} size="sm" onClick={() => act(i)} perm={i.kind === 'failed' ? ctx.can('operate', 'Retrying jobs') : undefined}>
                        {i.action}
                      </Btn>
                      {i.kind !== 'approval' ? (
                        <Btn kind="ghost" size="sm" onClick={() => { setDone(d => ({ ...d, [i.id]: true })); ctx.toast('Dismissed until it changes', 'info', { label: 'Undo', run: () => setDone(d => ({ ...d, [i.id]: false })) }); }}>
                          Dismiss
                        </Btn>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </StateBlock>
        </div>
      </div>
      {approve.value ? (
        <ApproveDialog
          ctx={ctx}
          approval={store.approvals.find(a => a.id === approve.value)!}
          closing={approve.closing}
          onClose={approve.close}
          onDone={verdict => {
            approve.close();
            ctx.toast(verdict === 'approved' ? `Approved ${approve.value}` : `Rejected ${approve.value}`, verdict === 'approved' ? 'ok' : 'info');
          }}
        />
      ) : null}
    </Page>
  );
}
