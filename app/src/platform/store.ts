import { useEffect, useState } from 'react';
import { RUNBOOKS, DRILLS, type Runbook, type Drill } from '../products/resilience/data';
import { PROTECTED_AFTER, type AfterCutover } from '../products/mobility/data';
import type { DrRun } from '../products/resilience/runner';
import { APPROVALS, CUSTOMERS, ENTITLEMENTS, P_ALERTS, POLICIES, ROLES, USERS, APPLICATIONS, type Approval, type Customer, type Entitlement, type PAlert, type Policy, type Role, type User, type Application, type AuditRec, AUDIT } from '../data/platform';

/**
 * The prototype's shared state: what people change on one screen shows on every other
 * (an approval given in the Inbox, a user deactivated in Settings) until the page reloads.
 */
export const store = {
  approvals: APPROVALS.map(a => ({ ...a, given: [...a.given] })) as Approval[],
  users: USERS.map(u => ({ ...u })) as User[],
  customers: CUSTOMERS.map(c => ({ ...c })) as Customer[],
  entitlements: ENTITLEMENTS.map(e => ({ ...e })) as Entitlement[],
  alerts: P_ALERTS.map(a => ({ ...a })) as PAlert[],
  policies: POLICIES.map(p => ({ ...p })) as Policy[],
  roles: ROLES.map(r => ({ ...r })) as Role[],
  apps: APPLICATIONS.map(a => ({ ...a })) as Application[],
  audit: [...AUDIT] as AuditRec[],
  inboxDone: {} as Record<string, boolean>,
  runbooks: RUNBOOKS.map(r => JSON.parse(JSON.stringify(r))) as Runbook[],
  drills: [...DRILLS] as Drill[],
  /** Failover, test and failback runs by recovery plan id; they keep going when the screen closes. */
  drRuns: {} as Record<string, DrRun>,
  /** Backup and DR set up for a server after its migration was committed, by server name. */
  migProtect: { ...PROTECTED_AFTER } as Record<string, AfterCutover>
};

const listeners = new Set<() => void>();

export function update(fn: (s: typeof store) => void) {
  fn(store);
  listeners.forEach(l => l());
}

/** Re-renders the caller whenever the store changes. */
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(x => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return store;
}

let auditSeq = 100;
/** Adds an audit record for an action taken in the prototype. */
export function audit(rec: Omit<AuditRec, 'id' | 'ip' | 'device' | 'browser' | 'corr' | 'side'> & { side?: AuditRec['side'] }) {
  update(s => {
    s.audit.unshift({ side: 'Provider', ip: '10.20.1.44', device: 'Windows 11', browser: 'Edge 130', corr: 'c-' + (0x5e00a0 + ++auditSeq).toString(16), id: 'aun' + auditSeq, ...rec });
  });
}
