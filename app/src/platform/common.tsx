import type { ReactNode } from 'react';
import { Icon } from '../lib/Icon';
import { Tag } from '../ui/controls';
import type { Ctx } from '../ui/ctx';
import { CUSTOMERS, customerOfProject, TIER_SHORT, type BState, type DState, type MState, type Tier } from '../data/platform';

/** Which customer ids the current tenant selection covers. */
export function scopeCustomers(ctx: Ctx): string[] {
  if (ctx.actingAs) return [ctx.actingAs.customer];
  if (ctx.project === 'All projects') return CUSTOMERS.map(c => c.id);
  const c = customerOfProject(ctx.project) || CUSTOMERS.find(x => x.name === ctx.project);
  return c ? [c.id] : CUSTOMERS.map(x => x.id);
}
/** True when an object of `customer` (optionally in `project`) is inside the tenant selection. */
export const inScope = (ctx: Ctx, customer: string, project?: string) => {
  if (ctx.actingAs && customer !== ctx.actingAs.customer) return false;
  if (ctx.project === 'All projects') return true;
  if (project) return project === ctx.project;
  if (ctx.actingAs) return true;
  return customerOfProject(ctx.project)?.id === customer;
};
export const scopeLabel = (ctx: Ctx) => (ctx.actingAs ? ctx.actingAs.customer && CUSTOMERS.find(c => c.id === ctx.actingAs!.customer)!.name : ctx.project === 'All projects' ? 'all customers' : ctx.project);
export const showCustomerCol = (ctx: Ctx) => !ctx.actingAs && ctx.audience === 'provider' && scopeCustomers(ctx).length > 1;
export const custName = (id: string) => CUSTOMERS.find(c => c.id === id)?.name || id;

type St = { i: string; l: string; c: string; spin?: boolean; rank: number };
export const B_ST: Record<BState, St> = {
  protected: { i: 'circle-check', l: 'Protected', c: 'ok', rank: 5 },
  warn: { i: 'triangle-alert', l: 'Warnings', c: 'warn', rank: 3 },
  failed: { i: 'circle-x', l: 'Last backup failed', c: 'err', rank: 1 },
  running: { i: 'loader-circle', l: 'Backing up', c: 'run', spin: true, rank: 4 },
  none: { i: 'circle-minus', l: 'Not protected', c: 'warn', rank: 2 },
  na: { i: 'minus', l: 'Not applicable', c: 'tx', rank: 9 }
};
export const D_ST: Record<DState, St> = {
  protected: { i: 'circle-check', l: 'Within target', c: 'ok', rank: 6 },
  behind: { i: 'clock', l: 'Behind target', c: 'warn', rank: 3 },
  syncing: { i: 'loader-circle', l: 'Syncing', c: 'run', spin: true, rank: 5 },
  failed: { i: 'circle-x', l: 'Last sync failed', c: 'err', rank: 1 },
  online: { i: 'power', l: 'Online at recovery site', c: 'run', rank: 4 },
  returning: { i: 'loader-circle', l: 'Returning to primary', c: 'run', spin: true, rank: 4 },
  unreach: { i: 'triangle-alert', l: 'Could not be read', c: 'warn', rank: 2 },
  none: { i: 'circle-minus', l: 'Not replicated', c: 'tx', rank: 7 },
  na: { i: 'minus', l: 'Not applicable', c: 'tx', rank: 9 }
};
export const M_ST: Record<MState, St> = {
  source: { i: 'circle', l: 'Not started', c: 'tx', rank: 6 },
  assessed: { i: 'clipboard-list', l: 'Assessed', c: 'tx', rank: 6 },
  planned: { i: 'calendar-clock', l: 'Planned', c: 'tx', rank: 6 },
  syncing: { i: 'loader-circle', l: 'Syncing', c: 'run', spin: true, rank: 4 },
  testing: { i: 'flask-conical', l: 'Test boot running', c: 'run', rank: 4 },
  ready: { i: 'circle-check', l: 'Ready for cutover', c: 'ok', rank: 5 },
  cutover: { i: 'power', l: 'Cut over, not committed', c: 'warn', rank: 3 },
  committed: { i: 'check', l: 'Committed', c: 'ok', rank: 7 },
  rolledback: { i: 'undo-2', l: 'Rolled back', c: 'warn', rank: 3 },
  blocked: { i: 'ban', l: 'Blocked', c: 'err', rank: 2 },
  na: { i: 'minus', l: 'Not applicable', c: 'tx', rank: 9 }
};
/** A status cell for the shared table. */
export const stCell = (s: St, tip?: string) => ({ t: 'status', i: s.i, l: s.l, c: s.c, spin: s.spin, tip: tip || s.l, s: s.rank });

const TIER_TONE: Record<Tier, 'err' | 'warn' | 'acc' | undefined> = { 'Mission Critical': 'err', 'Business Critical': 'warn', Important: 'acc', Standard: undefined };
export function TierTag({ tier, short }: { tier: Tier; short?: boolean }) {
  return (
    <Tag tone={TIER_TONE[tier]} style={{ gap: 4 }}>
      {short ? TIER_SHORT[tier] : tier}
    </Tag>
  );
}
export const TIER_RANK: Record<Tier, number> = { 'Mission Critical': 0, 'Business Critical': 1, Important: 2, Standard: 3 };

/** Inline link that navigates inside the console. */
export function Go({ ctx, to, id, children }: { ctx: Ctx; to: string; id?: string; children: ReactNode }) {
  return (
    <a
      href={`#/${ctx.product}/${to}${id ? `?open=${encodeURIComponent(id)}` : ''}`}
      onClick={e => {
        e.preventDefault();
        ctx.go(to, id);
      }}
      style={{ color: 'var(--acc-tx)', fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      {children}
    </a>
  );
}

export function Kv({ k, v }: { k: string; v: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, whiteSpace: 'nowrap' }}>
      <span style={{ color: 'var(--tx-3)' }}>{k}</span>
      <span>{v}</span>
    </span>
  );
}

/** Shield always means encryption; padlock always means immutability. */
export function LockMarks({ enc, lock }: { enc?: boolean; lock?: string | null }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, color: 'var(--tx-2)' }}>
      {lock ? <Icon name="lock" data-tip={`Immutable: ${lock}`} /> : null}
      {enc ? <Icon name="shield" data-tip="Encrypted" /> : null}
    </span>
  );
}

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
export const openFrom = (ctx: Ctx, set: (id: string) => void) => {
  if (ctx.openId) set(ctx.openId);
};
