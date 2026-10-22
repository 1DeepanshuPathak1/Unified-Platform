import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { pc } from '../lib/pseudo';
import { PLATFORM_GROUPS, PLATFORM_TOP, PRODUCT_LABEL, type NavItem } from './routes';

/** The product block always reserves five items so the groups below it never move. */
const PRODUCT_SLOTS = 5;

type Props = {
  product: string;
  page: string;
  productItems: [string, string, string][];
  collapsed: boolean;
  provider: boolean;
  counts: Record<string, number>;
};

export function Nav({ product, page, productItems, collapsed, provider, counts }: Props) {
  const item = (n: NavItem, key: number) => {
    const on = page === n.id;
    const count = counts[n.id];
    return (
      <a
        key={key}
        href={`#/${product}/${n.id}`}
        aria-current={on ? 'page' : undefined}
        data-tip={collapsed ? (count ? `${n.label} · ${count}` : n.label) : undefined}
        className={pc('hover', `color:var(--tx);background:${on ? 'transparent' : 'var(--hover)'}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, height: 32, padding: '0 10px', color: on ? 'var(--tx)' : 'var(--tx-2)', fontWeight: on ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative', transition: 'color 100ms,background-color 100ms' }}
      >
        <Icon name={n.icon} style={{ color: on ? 'var(--acc)' : 'var(--tx-3)', transition: 'color 100ms' }} />
        <span style={{ flex: 1, opacity: collapsed ? 0 : 1, transition: 'opacity 100ms' }}>{n.label}</span>
        {count ? (
          <span
            aria-label={`${count} waiting`}
            style={{ position: collapsed ? 'absolute' : 'static', top: 4, left: 24, minWidth: 18, height: 16, padding: '0 4px', display: 'grid', placeItems: 'center', background: 'var(--acc)', color: 'var(--acc-ink)', font: '700 10px/16px var(--f-ui)', fontVariantNumeric: 'tabular-nums' }}
          >
            {count}
          </span>
        ) : null}
      </a>
    );
  };
  const label = (text: string, line: boolean) => (
    <div role="presentation" style={{ height: 36, flex: 'none', display: 'flex', alignItems: 'flex-end', padding: '0 10px 6px', marginTop: 8, borderTop: `1px solid ${line || collapsed ? 'var(--ln)' : 'transparent'}`, transition: 'border-color 150ms' }}>
      <span style={{ font: '600 12px/16px var(--f-body)', color: 'var(--tx-3)', whiteSpace: 'nowrap', opacity: collapsed ? 0 : 1, transition: 'opacity 100ms' }}>{text}</span>
    </div>
  );
  const top = PLATFORM_TOP.items.filter(i => provider || !i.providerOnly);
  return (
    <nav aria-label="Main" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px' }}>
      <Ind mode="fill" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{top.map(item)}</div>
        {label(PRODUCT_LABEL[product], false)}
        <div key={product} style={{ height: PRODUCT_SLOTS * 34 - 2, flex: 'none', display: 'flex', flexDirection: 'column', gap: 2, animation: 'ae-fade 150ms var(--ease)' }}>
          {productItems.map(([id, l, icon], i) => item({ id, label: l, icon }, i))}
        </div>
        {PLATFORM_GROUPS.map(g => (
          <div key={g.id} style={{ display: 'contents' }}>
            {label(g.label, false)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{g.items.map(item)}</div>
          </div>
        ))}
      </Ind>
    </nav>
  );
}
