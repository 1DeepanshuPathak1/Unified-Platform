import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { CUSTOMERS } from '../data/platform';

const ROW = pc('hover', 'background:var(--hover)');

/**
 * "Work in": the tenant and project selector. Providers see every customer and "All projects";
 * a customer sees its own projects only.
 */
export function TenantMenu({ project, onPick, actingAs, role }: { project: string; onPick: (p: string) => void; actingAs: string | null; role: string }) {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const customers = CUSTOMERS.filter(c => (!actingAs || c.id === actingAs) && c.status !== 'archived');
  const row = (name: string, sub: string, value: string, indent: boolean, key: string) => {
    const on = value === project;
    return (
      <button key={key} type="button" role="menuitemradio" aria-checked={on} onClick={() => onPick(value)} className={ROW} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 36, padding: indent ? '0 12px 0 28px' : '0 12px', transition: 'background-color 100ms' }}>
        <span style={{ width: 16, display: 'flex', color: 'var(--acc)' }}>
          <Icon name={on ? 'check' : ''} />
        </span>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{name}</span>
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{sub}</span>
      </button>
    );
  };
  return (
    <div role="menu" aria-label="Projects" style={{ position: 'absolute', top: 44, right: 0, width: 360, background: 'var(--overlay)', border: '1px solid var(--ln-2)', boxShadow: 'var(--sh-menu)', animation: 'ae-pop 140ms var(--ease)' }}>
      <div style={{ padding: 8, borderBottom: '1px solid var(--ln)', position: 'relative' }}>
        <Icon name="search" style={{ position: 'absolute', left: 18, top: 18, color: 'var(--tx-3)', pointerEvents: 'none' }} />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Find a customer or project" aria-label="Find a customer or project" className={pc('focus', 'border-color:var(--acc)')} style={{ width: '100%', height: 32, padding: '0 10px 0 34px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '13px var(--f-ui)' }} />
      </div>
      <div style={{ maxHeight: 420, overflow: 'auto', padding: '4px 0' }}>
        <div style={{ padding: '8px 12px 4px', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Work in</div>
        {!ql ? row(actingAs ? `All of ${customers[0].name}` : 'All projects', actingAs ? 'Owner' : role === 'Owner' ? 'Every customer' : role, 'All projects', false, 'all') : null}
        {customers.map(c => {
          const projects = c.departments.flatMap(d => d.projects.map(p => ({ ...p, dept: d.name })));
          const hits = projects.filter(p => !ql || `${c.name} ${p.name} ${p.dept}`.toLowerCase().includes(ql));
          if (!hits.length) return null;
          return (
            <div key={c.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 4px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                {c.status !== 'active' ? <span style={{ color: c.status === 'suspended' ? 'var(--err)' : 'var(--tx-3)' }}>{{ trial: 'Trial', suspended: 'Suspended', onboarding: 'Onboarding', archived: 'Archived', active: '' }[c.status]}</span> : null}
              </div>
              {hits.map(p => row(p.name, p.dept, p.name, true, p.name))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
