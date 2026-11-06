import { useEffect, useRef, useState } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { PLATFORM_GROUPS, PLATFORM_TOP, PRODUCT_ENGINE, PRODUCT_LABEL, type NavItem } from './routes';

/* Frame pieces that only some styles use. The navigation data is the same as the side pane's. */

type NavProps = { product: string; page: string; productItems: [string, string, string][]; provider: boolean; counts: Record<string, number>; self?: boolean };

const SELF_ITEMS = ['home', 'workloads', 'reports', 'billing', 'support'];

/** Horizon: the navigation as a bar of links and menus under the top bar. */
export function TopNav({ product, page, productItems, provider, counts, self }: NavProps) {
  const [open, setOpen] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!host.current?.contains(e.target as Node)) setOpen(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    const hash = () => setOpen(null);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('hashchange', hash);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); window.removeEventListener('hashchange', hash); };
  }, [open]);
  const top = PLATFORM_TOP.items.filter(i => (provider || !i.providerOnly) && (!self || SELF_ITEMS.includes(i.id)));
  const prodItems: NavItem[] = productItems.map(([id, label, icon]) => ({ id, label, icon }));
  const groups = self
    ? [{ id: 'more', label: 'More', items: PLATFORM_GROUPS.flatMap(g => g.items).filter(i => SELF_ITEMS.includes(i.id)) }]
    : [{ id: 'product', label: PRODUCT_LABEL[product], items: prodItems }, ...PLATFORM_GROUPS];
  const link = (n: NavItem) => {
    const on = page === n.id;
    const count = counts[n.id];
    return (
      <a
        key={n.id}
        href={`#/${product}/${n.id}`}
        aria-current={on ? 'page' : undefined}
        className={`ae-tnav-link ${pc('hover', 'background:var(--hover);color:var(--tx)')}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', borderRadius: 'var(--r-sm)', font: `${on ? 600 : 500} 14px/20px var(--f-ui)`, color: on ? 'var(--acc-tx)' : 'var(--tx-2)', background: on ? 'var(--acc-soft)' : undefined, whiteSpace: 'nowrap', transition: 'background-color 100ms,color 100ms' }}
      >
        <Icon name={n.icon} style={{ color: on ? 'var(--acc)' : 'var(--tx-3)' }} />
        {n.label}
        {count ? <span style={{ minWidth: 20, height: 18, padding: '0 6px', borderRadius: 9, display: 'inline-grid', placeItems: 'center', background: 'var(--acc)', color: 'var(--acc-ink)', font: '600 11px/18px var(--f-ui)' }}>{count}</span> : null}
      </a>
    );
  };
  return (
    <div ref={host} role="navigation" aria-label="Main" style={{ display: 'flex', alignItems: 'center', gap: 4, height: 48, padding: '0 20px', overflowX: 'auto', overflowY: 'visible' }}>
      {top.map(link)}
      <span aria-hidden style={{ width: 1, height: 20, background: 'var(--ln)', margin: '0 8px', flex: 'none' }} />
      {groups.map(g => {
        const has = g.items.some(i => i.id === page);
        const isOpen = open === g.id;
        return (
          <div key={g.id} style={{ position: 'relative', flex: 'none' }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : g.id)}
              className={`ae-tnav-link ${pc('hover', 'background:var(--hover);color:var(--tx)')}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px 0 12px', borderRadius: 'var(--r-sm)', font: `${has ? 600 : 500} 14px/20px var(--f-ui)`, color: has ? 'var(--acc-tx)' : 'var(--tx-2)', background: has ? 'var(--acc-soft)' : isOpen ? 'var(--hover)' : undefined, whiteSpace: 'nowrap', transition: 'background-color 100ms,color 100ms' }}
            >
              {g.label}
              <Icon name="chevron-down" style={{ color: 'var(--tx-3)', transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms var(--ease)' }} />
            </button>
            {isOpen ? (
              <div role="menu" aria-label={g.label} style={{ position: 'fixed', marginTop: 6, minWidth: 260, padding: 6, zIndex: 60, background: 'var(--overlay)', border: '1px solid var(--ln)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-menu)', animation: 'ae-pop 140ms var(--ease)' }}>
                {g.id === 'product' ? <div style={{ padding: '6px 10px 8px', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{PRODUCT_ENGINE[product]}</div> : null}
                {g.items.map(i => {
                  const on = i.id === page;
                  return (
                    <a key={i.id} role="menuitem" href={`#/${product}/${i.id}`} onClick={() => setOpen(null)} className={pc('hover', 'background:var(--hover)')} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 10px', borderRadius: 'var(--r-sm)', font: `${on ? 600 : 400} 14px var(--f-ui)`, color: on ? 'var(--acc-tx)' : 'var(--tx)' }}>
                      <Icon name={i.icon} style={{ color: on ? 'var(--acc)' : 'var(--tx-3)' }} />
                      <span style={{ flex: 1 }}>{i.label}</span>
                      {counts[i.id] ? <span style={{ font: '600 11px var(--f-ui)', color: 'var(--acc-tx)' }}>{counts[i.id]}</span> : null}
                      {on ? <Icon name="check" style={{ color: 'var(--acc)' }} /> : null}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Atlas: a dark rail of products beside the section list. */
export function ProductRail({ products, onStyles }: { products: { id: string; label: string; icon: string; on: boolean; onClick: () => void }[]; onStyles: () => void }) {
  const item = (key: string, icon: string, label: string, on: boolean, onClick?: () => void, href?: string) => {
    const style = { width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 'var(--r)', color: on ? 'var(--acc-ink)' : 'var(--tx-2)', background: on ? 'var(--acc)' : undefined, transition: 'background-color 100ms,color 100ms' } as const;
    const cls = on ? undefined : pc('hover', 'background:var(--hover);color:var(--tx)');
    return href ? (
      <a key={key} href={href} aria-label={label} data-tip={label} className={cls} style={style}><Icon name={icon} size={20} /></a>
    ) : (
      <button key={key} type="button" aria-label={label} aria-pressed={on} data-tip={label} onClick={onClick} className={cls} style={style}><Icon name={icon} size={20} /></button>
    );
  };
  return (
    <nav aria-label="Products" className="ae-rail" style={{ gridArea: 'rail', width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 0', background: 'var(--rail)', color: 'var(--tx)' }}>
      <a href="#/backup/home" aria-label="Host360 Aegis home" data-tip="Host360 Aegis" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--acc)', marginBottom: 6 }}><Icon name="mark" size={24} /></a>
      {products.map(p => item(p.id, p.icon, p.label, p.on, p.onClick))}
      <span style={{ flex: 1 }} />
      {item('styles', 'palette', 'Switch styles', false, onStyles)}
    </nav>
  );
}

/** Atlas: the product's name at the top of the section list. */
export function SectionTitle({ product }: { product: string }) {
  return (
    <div className="ae-side-title" style={{ height: 52, flex: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 18px', borderBottom: '1px solid var(--ln)' }}>
      <span style={{ font: '600 16px/22px var(--f-head)' }}>{PRODUCT_LABEL[product]}</span>
      <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{PRODUCT_ENGINE[product]}</span>
    </div>
  );
}

/** Command: a status bar along the bottom of the window. */
export function StatusBar({ runLabel, running, onJobs, alerts, onAlerts, project, clock }: { runLabel: string; running: boolean; onJobs: () => void; alerts: string; onAlerts: () => void; project: string; clock: string }) {
  const seg = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', whiteSpace: 'nowrap' } as const;
  const btn = pc('hover', 'background:var(--hover);color:var(--tx)');
  return (
    <footer className="ae-status" role="contentinfo" aria-label="Status" style={{ gridArea: 'stat', height: 28, display: 'flex', alignItems: 'center', background: 'var(--status)', borderTop: '1px solid var(--ln)', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
      <span style={seg}><span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--ok)', boxShadow: '0 0 0 3px var(--ok-s)' }} />Connected · aegis-orchestrator</span>
      <span style={seg}>Version 4.2.0</span>
      <span style={seg}><Icon name="box" style={{ color: 'var(--tx-3)' }} />{project}</span>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={onJobs} className={btn} style={seg} aria-label={`Jobs: ${runLabel}`}><Icon name="loader-circle" spin={running} style={{ color: running ? 'var(--acc)' : 'var(--tx-3)' }} />{runLabel}</button>
      <button type="button" onClick={onAlerts} className={btn} style={seg} aria-label={`Alerts: ${alerts}`}><Icon name="bell" style={{ color: 'var(--warn)' }} />{alerts} alerts</button>
      <span style={{ ...seg, fontVariantNumeric: 'tabular-nums', color: 'var(--tx)' }}>{clock}</span>
    </footer>
  );
}
