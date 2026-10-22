import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { pc } from '../lib/pseudo';
import { Tag } from '../ui/controls';
import type { Ctx, JobSpec, ToastKind } from '../ui/ctx';
import { TenantsSection } from '../admin/Tenants';
import { ManagedSection, HardwareSection } from '../admin/Estate';
import { TemplatesSection } from '../admin/Templates';
import { MaintenanceSection } from '../admin/Maintenance';
import { OnPremSection } from '../admin/OnPrem';

type Sec = 'tenants' | 'managed' | 'hardware' | 'templates' | 'maintenance' | 'onprem';
const NAV: { group: string; items: { id: Sec; label: string; icon: string }[] }[] = [
  { group: 'Customers', items: [{ id: 'tenants', label: 'Tenants', icon: 'building-2' }, { id: 'managed', label: 'Managed accounts', icon: 'headset' }] },
  { group: 'Estate', items: [{ id: 'hardware', label: 'Hardware and sites', icon: 'server' }, { id: 'onprem', label: 'On-premises deployments', icon: 'house' }] },
  { group: 'Service', items: [{ id: 'templates', label: 'Templates', icon: 'layers' }, { id: 'maintenance', label: 'Maintenance', icon: 'calendar-clock' }] }
];
const SECS = NAV.flatMap(g => g.items.map(i => i.id));

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const BASE = new Date(2026, 9, 21, 16, 5, 0).getTime();
const T0 = Date.now();
const nowD = () => new Date(BASE + (Date.now() - T0));
const fmtD = (d: Date) => `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} IST`;

const readTheme = () => {
  try {
    return localStorage.getItem('aegis.theme') || 'dark';
  } catch {
    return 'dark';
  }
};
const parse = () => {
  const h = location.hash.replace(/^#\/admin\/?/, '');
  const [path, qs] = h.split('?');
  const [sec, tab] = path.split('/');
  return { sec: (SECS.includes(sec as Sec) ? sec : 'tenants') as Sec, tab: tab || '', open: new URLSearchParams(qs || '').get('open') };
};

type Toast = { id: number; text: string; kind: ToastKind; leaving?: boolean };
const TOAST_ICON: Record<ToastKind, [string, string]> = { ok: ['circle-check', 'var(--ok)'], warn: ['triangle-alert', 'var(--warn)'], err: ['circle-x', 'var(--err)'], info: ['info', 'var(--tx-2)'] };

/**
 * Internal Admin Portal: where Host360 staff run the service behind the product. Tenants and
 * plans, managed accounts, hardware and sites, templates, maintenance with customer
 * communication, and on-premises deployments. Never shown to customers or partners.
 */
export default function AdminPortal() {
  const [theme, setTheme] = useState(readTheme);
  const [r, setR] = useState(parse);
  const [nonce, setNonce] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clock, setClock] = useState(fmtD(nowD()));
  const seq = useRef(0);
  useEffect(() => {
    const on = () => {
      if (!location.hash.startsWith('#/admin')) return;
      setR(parse());
      setNonce(n => n + 1);
    };
    window.addEventListener('hashchange', on);
    const t = window.setInterval(() => setClock(fmtD(nowD())), 15000);
    return () => {
      window.removeEventListener('hashchange', on);
      window.clearInterval(t);
    };
  }, []);
  const toggle = () => {
    const t = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('aegis.theme', t);
    } catch {
      /* the theme just will not persist */
    }
    setTheme(t);
  };
  const ctx = useMemo<Ctx>(() => {
    const toast = (text: string, kind: ToastKind = 'ok') => {
      const id = ++seq.current;
      setToasts(x => [...x, { id, text, kind }].slice(-4));
      window.setTimeout(() => setToasts(x => x.map(t => (t.id === id ? { ...t, leaving: true } : t))), 5200);
      window.setTimeout(() => setToasts(x => x.filter(t => t.id !== id)), 5350);
    };
    return {
      route: `admin/${r.sec}`,
      product: 'backup',
      page: r.sec,
      tab: r.tab,
      key: r.sec,
      title: '',
      sub: '',
      section: 'Internal',
      project: 'All projects',
      role: 'Owner',
      audience: 'provider',
      actingAs: null,
      ui: 'live',
      theme,
      openId: r.open,
      nonce,
      jobs: [],
      tick: 0,
      go: (route: string, openId?: string) => {
        location.hash = route.startsWith('admin/') || !route.includes('/') ? `/admin/${route.replace(/^admin\//, '')}${openId ? `?open=${encodeURIComponent(openId)}` : ''}` : `/${route}${openId ? `?open=${encodeURIComponent(openId)}` : ''}`;
      },
      toast,
      startJob: (spec: JobSpec) => {
        toast(`${spec.name} started for ${spec.object}`, 'info');
        window.setTimeout(() => toast(spec.doneToast || `${spec.name} finished for ${spec.object}`, 'ok'), 3500);
        return 'adm-' + Date.now();
      },
      patchJob: () => undefined,
      can: () => ({ ok: true, op: 1 }),
      now: () => fmtD(nowD()),
      hms: () => { const d = nowD(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; },
      loginAsOwner: () => undefined,
      previewSelf: () => undefined
    } as Ctx;
  }, [r, nonce, theme]);
  const sec = r.sec;
  return (
    <div data-ae="" data-theme={theme} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app)', color: 'var(--tx)', font: '14px/20px var(--f-body)' }}>
      <header style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 0 20px', background: 'var(--hdr)', borderBottom: '1px solid var(--ln)' }}>
        <Icon name="mark" size={24} />
        <span style={{ font: '500 17px/24px var(--f-head)', whiteSpace: 'nowrap' }}>Host360 Aegis</span>
        <span style={{ width: 1, height: 24, background: 'var(--ln-2)' }} />
        <span style={{ font: '500 16px/24px var(--f-head)', color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>Internal admin</span>
        <Tag tone="warn">Host360 staff only</Tag>
        <span style={{ flex: 1 }} />
        <a href="#/backup/home" className={pc('hover', 'background:var(--hover)')} style={hdrBtn}>
          <Icon name="layout-dashboard" /> Console
        </a>
        <a href="#/coverage" className={pc('hover', 'background:var(--hover)')} style={hdrBtn}>
          <Icon name="list" /> Coverage
        </a>
        <span style={{ width: 1, height: 24, background: 'var(--ln-2)' }} />
        <span style={{ font: '13px var(--f-ui)', color: 'var(--tx-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{clock}</span>
        <button type="button" aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'} data-tip={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={toggle} className={pc('hover', 'background:var(--hover)')} style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <span aria-label="Priya Raman, Host360" data-tip="priya.raman@host360.ai · Head of cloud operations" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'var(--panel-2)', border: '1px solid var(--ln-2)', font: '700 11px var(--f-ui)' }}>PR</span>
      </header>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <aside style={{ width: 232, flex: 'none', borderRight: '1px solid var(--ln)', background: 'var(--nav)', display: 'flex', flexDirection: 'column' }}>
          <nav aria-label="Internal admin" style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
            <Ind mode="fill" style={{ display: 'flex', flexDirection: 'column' }}>
              {NAV.map((g, gi) => (
                <div key={g.group} style={{ display: 'contents' }}>
                  <div role="presentation" style={{ height: 30, display: 'flex', alignItems: 'flex-end', padding: '0 10px 6px', marginTop: gi ? 4 : 0 }}>
                    <span style={{ font: '600 12px/16px var(--f-body)', color: 'var(--tx-3)' }}>{g.group}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {g.items.map(n => {
                      const on = sec === n.id;
                      return (
                        <a key={n.id} href={`#/admin/${n.id}`} aria-current={on ? 'page' : undefined} className={pc('hover', `color:var(--tx);background:${on ? 'transparent' : 'var(--hover)'}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 32, padding: '0 10px', color: on ? 'var(--tx)' : 'var(--tx-2)', fontWeight: on ? 600 : 400, whiteSpace: 'nowrap', position: 'relative', transition: 'color 100ms,background-color 100ms' }}>
                          <Icon name={n.icon} style={{ color: on ? 'var(--acc)' : 'var(--tx-3)' }} />
                          {n.label}
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Ind>
          </nav>
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--ln)', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
            <div style={{ color: 'var(--tx-2)' }}>admin.aegis.host360.internal</div>
            <div>VPN and hardware key required</div>
          </div>
        </aside>
        <main key={sec} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {sec === 'tenants' ? <TenantsSection ctx={ctx} /> : null}
          {sec === 'managed' ? <ManagedSection ctx={ctx} /> : null}
          {sec === 'hardware' ? <HardwareSection ctx={ctx} /> : null}
          {sec === 'templates' ? <TemplatesSection ctx={ctx} /> : null}
          {sec === 'maintenance' ? <MaintenanceSection ctx={ctx} /> : null}
          {sec === 'onprem' ? <OnPremSection ctx={ctx} /> : null}
        </main>
      </div>
      <div aria-live="polite" style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 60, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} role="status" style={{ pointerEvents: 'auto', minWidth: 320, maxWidth: 440, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--overlay)', border: '1px solid var(--ln-2)', boxShadow: 'var(--sh-menu)', opacity: t.leaving ? 0 : 1, transition: 'opacity 150ms' }}>
            <Icon name={TOAST_ICON[t.kind][0]} style={{ color: TOAST_ICON[t.kind][1] }} />
            <span style={{ flex: 1, minWidth: 0 }}>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const hdrBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', color: 'var(--tx-2)', font: '600 13px var(--f-ui)', whiteSpace: 'nowrap' as const };
