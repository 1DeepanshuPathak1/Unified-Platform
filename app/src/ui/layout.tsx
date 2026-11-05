import { Children, Fragment, isValidElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { Tabs, type Opt } from './controls';
import type { UiState } from './ctx';

export const TONE: Record<string, string> = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', run: 'var(--run)', tx: 'var(--tx-3)', acc: 'var(--acc)', info: 'var(--tx-2)' };
export const HOVER = pc('hover', 'background:var(--hover)');

/** A screen: fills <main>, fades in on arrival. `scroll` lets the whole page scroll instead of an inner table. */
export function Page({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: scroll ? 'auto' : undefined, animation: 'ae-page 150ms var(--ease)' }}>
      {children}
    </div>
  );
}

export function PageHeader({ kicker, title, sub, actions, meta, info }: { kicker: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; meta?: ReactNode; info?: ReactNode }) {
  return (
    <div className="ae-ph" style={{ flex: 'none', padding: '24px 24px 20px', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ae-kicker" style={{ font: '500 12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: 6 }}>{kicker}</div>
        <h1 style={{ font: '600 22px/30px var(--f-head)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          {info}
        </h1>
        {sub ? <p style={{ marginTop: 4, maxWidth: 880, font: '14px/20px var(--f-body)', color: 'var(--tx-2)' }}>{sub}</p> : null}
      </div>
      {meta ? <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{meta}</span> : null}
      {actions ? <div style={{ display: 'flex', gap: 8, flex: 'none' }}>{actions}</div> : null}
    </div>
  );
}

/**
 * A platform section: header, then section tabs, then the selected tab's content.
 * The tab is the third segment of the route (#/backup/settings/users).
 */
export function Section<V extends string>({ kicker, title, sub, tabs, tab, onTab, actions, children }: { kicker: string; title: string; sub: ReactNode; tabs: Opt<V>[]; tab: V; onTab: (v: V) => void; actions?: ReactNode; children: ReactNode }) {
  return (
    <Page>
      <div className="ae-ph ae-ph-tabs" style={{ flex: 'none', padding: '24px 24px 0', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ae-kicker" style={{ font: '500 12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: 6 }}>{kicker}</div>
          <h1 style={{ font: '600 22px/30px var(--f-head)' }}>{title}</h1>
          <p style={{ marginTop: 4, maxWidth: 880, font: '14px/20px var(--f-body)', color: 'var(--tx-2)' }}>{sub}</p>
        </div>
        {actions ? <div style={{ display: 'flex', gap: 8, flex: 'none' }}>{actions}</div> : null}
      </div>
      <Tabs className="ae-ptabs" label={`${title} sections`} value={tab} tabs={tabs} onChange={onTab} style={{ margin: '16px 24px 16px', padding: 0 }} />
      <div key={tab} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', animation: 'ae-fade 150ms var(--ease)' }}>
        {children}
      </div>
    </Page>
  );
}

export const Spacer = () => <span style={{ flex: 1 }} />;

/** Children with fragments opened one level, so a Spacer inside a fragment is still found. */
const flatKids = (children: ReactNode): ReactNode[] =>
  Children.toArray(children).flatMap(c => (isValidElement(c) && c.type === Fragment ? Children.toArray((c.props as { children?: ReactNode }).children) : [c]));

/**
 * Toolbar row. Everything after a Spacer is kept together on the right; when the row is too narrow it wraps,
 * and the right-hand group stays at the right edge of the next line.
 */
export function Toolbar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const kids = flatKids(children);
  const at = kids.findIndex(c => isValidElement(c) && c.type === Spacer);
  return (
    <div className="ae-tb" style={{ flex: 'none', padding: '0 24px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', minHeight: 44, ...style }}>
      {at < 0 ? kids : [...kids.slice(0, at), <div key="ae-right" style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: '8px 12px' }}>{kids.slice(at + 1)}</div>]}
    </div>
  );
}

/** Replaces the toolbar while rows are selected. */
export function BulkBar({ label, children, onClear }: { label: string; children: ReactNode; onClear: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, height: 44, padding: '0 8px 0 14px', background: 'var(--acc-soft)', border: '1px solid var(--acc)', borderRadius: 'var(--r)', animation: 'ae-fade 120ms var(--ease)' }}>
      <span style={{ font: '600 13px var(--f-ui)', marginRight: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{label}</span>
      {children}
      <span style={{ flex: 1 }} />
      <button type="button" onClick={onClear} className={HOVER} style={{ height: 32, padding: '0 10px', borderRadius: 'var(--r-sm)', fontWeight: 500, whiteSpace: 'nowrap', transition: 'background-color 100ms' }}>
        Clear selection
      </button>
    </div>
  );
}

const BAR = {
  warn: { bg: 'var(--warn-s)', icon: 'triangle-alert', c: 'var(--warn)' },
  err: { bg: 'var(--err-s)', icon: 'circle-x', c: 'var(--err)' },
  info: { bg: 'var(--panel-2)', icon: 'info', c: 'var(--tx-2)' },
  ok: { bg: 'var(--ok-s)', icon: 'circle-check', c: 'var(--ok)' },
  run: { bg: 'var(--run-s)', icon: 'loader-circle', c: 'var(--run)' }
};

/** Amber warning bar, red danger bar, neutral info bar. One line; actions on the right. */
export function Bar({ tone = 'warn', icon, children, actions, style, multiline }: { tone?: keyof typeof BAR; icon?: string; children: ReactNode; actions?: ReactNode; style?: CSSProperties; multiline?: boolean }) {
  const b = BAR[tone];
  return (
    <div
      role={tone === 'err' ? 'alert' : 'status'}
      style={{ flex: 'none', display: 'flex', alignItems: multiline ? 'flex-start' : 'center', gap: 12, minHeight: 40, padding: multiline ? '10px 8px 10px 12px' : '0 8px 0 12px', background: b.bg, border: `1px solid color-mix(in oklch, ${b.c} 30%, var(--ln))`, borderLeft: `3px solid ${b.c}`, borderRadius: 'var(--r-sm)', animation: 'ae-fade 150ms var(--ease)', ...style }}
    >
      <Icon name={icon || b.icon} spin={tone === 'run'} style={{ color: b.c, marginTop: multiline ? 2 : 0 }} />
      <span style={{ flex: 1, minWidth: 0, ...(multiline ? null : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>{children}</span>
      {actions ? <span style={{ display: 'flex', gap: 4, flex: 'none' }}>{actions}</span> : null}
    </div>
  );
}

export function Panel({ title, right, children, style, bodyStyle, id }: { title: ReactNode; right?: ReactNode; children: ReactNode; style?: CSSProperties; bodyStyle?: CSSProperties; id?: string }) {
  return (
    <section id={id} className="ae-card" style={{ background: 'var(--panel)', border: '1px solid var(--ln)', borderRadius: 'var(--r)', boxShadow: 'var(--sh-card)', minWidth: 0, ...style }}>
      <div className="ae-card-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 48, padding: '0 16px', borderBottom: '1px solid var(--ln)' }}>
        <h2 style={{ font: '600 14px/20px var(--f-body)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>{title}</h2>
        {right ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{right}</div> : null}
      </div>
      <div style={bodyStyle}>{children}</div>
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 13px var(--f-body)', color: 'var(--acc-tx)', whiteSpace: 'nowrap' }}>
      {children}
      <Icon name="arrow-right" />
    </a>
  );
}

export type Kpi = { label: string; value: ReactNode; unit?: string; sub?: string; icon?: string; tone?: string; href?: string; segs?: { w: string; c: string }[]; loading?: boolean; unread?: boolean };

/** KPI widgets: one card each, title on top, value, one line of context. A widget with a link drills into its list. Page level. */
export function Tiles({ items }: { items: Kpi[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))`, gap: items.length > 5 ? 12 : 16 }}>
      {items.map((k, i) => {
        const body = (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px/18px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap', minWidth: 0 }}>
              {k.icon ? <Icon name={k.icon} style={{ color: k.tone ? TONE[k.tone] : 'var(--tx-3)' }} /> : null}
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</span>
            </span>
            {k.loading ? (
              <span style={{ display: 'block', height: 28, margin: '4px 0', width: '60%', background: 'var(--skel)', borderRadius: 'var(--r-sm)' }} />
            ) : (
              <span style={{ font: '600 26px/34px var(--f-head)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontStyle: k.unread ? 'italic' : 'normal', color: k.unread ? 'var(--tx-3)' : 'var(--tx)' }}>
                {k.value}
                {k.unit ? <span style={{ font: '400 14px var(--f-body)', color: 'var(--tx-3)', marginLeft: 6, letterSpacing: 0 }}>{k.unit}</span> : null}
              </span>
            )}
            {k.sub ? <span data-tip={k.sub} data-tip-overflow="" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{k.sub}</span> : null}
            {k.segs ? (
              <span style={{ display: 'flex', height: 6, gap: 2, marginTop: 'auto', borderRadius: 3, overflow: 'hidden', background: 'var(--ln)' }}>
                {k.segs.map((s, j) => <span key={j} style={{ height: 6, width: s.w, background: s.c, transition: 'width 150ms var(--ease)' }} />)}
              </span>
            ) : null}
          </>
        );
        const st: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, padding: items.length > 5 ? '16px 16px 18px' : '16px 20px 18px', background: 'var(--panel)', border: '1px solid var(--ln)', borderRadius: 'var(--r)', boxShadow: 'var(--sh-card)', minWidth: 0, transition: 'border-color 100ms,box-shadow 100ms' };
        return k.href ? (
          <a key={i} href={k.href} className={`ae-kpi ${pc('hover', 'border-color:var(--ln-2);box-shadow:var(--sh-menu)')}`} style={st}>{body}</a>
        ) : (
          <div key={i} className="ae-kpi" style={st}>{body}</div>
        );
      })}
    </div>
  );
}

/** Tiles for a drawer's Overview tab (the only place drawers show tiles). */
export function DrawerTiles({ items }: { items: { label: string; value: ReactNode; sub?: string; icon?: string; tone?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))`, gap: 8 }}>
      {items.map((k, i) => {
        // Figures read large; a phrase such as "Online at recovery site" drops to body size so it fits and keeps its words.
        const words = typeof k.value === 'string' && !/^[\d.,\s%×₹$:/-]+[A-Za-z]{0,3}$/.test(k.value);
        return (
        <div key={i} style={{ padding: '12px 14px', background: 'var(--panel-2)', border: '1px solid var(--ln)', borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 26, fontFamily: 'var(--f-head)', fontWeight: 600, fontSize: words ? 15 : 18, lineHeight: words ? '22px' : '26px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 0 }}>
            {k.icon ? <Icon name={k.icon} style={{ color: k.tone ? TONE[k.tone] : 'var(--tx-2)', flex: 'none' }} /> : null}
            <span data-tip={words ? String(k.value) : undefined} data-tip-overflow="" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</span>
          </span>
          {k.sub ? <span data-tip={k.sub} data-tip-overflow="" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</span> : null}
        </div>
        );
      })}
    </div>
  );
}

export type Fact = { k: string; v: ReactNode; icon?: string; tone?: string; muted?: boolean };

/** Label and value pairs, one line each. */
export function Facts({ items, labelW = 168 }: { items: Fact[]; labelW?: number }) {
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: `${labelW}px minmax(0,1fr)`, font: '13px/18px var(--f-ui)' }}>
      {items.map((f, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt style={{ padding: '10px 12px 10px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-2)' }}>{f.k}</dt>
          <dd style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontStyle: f.muted ? 'italic' : 'normal', color: f.muted ? 'var(--tx-3)' : 'var(--tx)' }}>
            {f.icon ? <Icon name={f.icon} style={{ color: f.tone ? TONE[f.tone] : 'var(--tx-2)' }} /> : null}
            <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{f.v}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type MiniCol = { label: string; w?: string; r?: boolean };

/** A compact one-line-per-row table for drawers and panels. */
export function MiniTable({ cols, rows, empty, label, onRow }: { cols: MiniCol[]; rows: ReactNode[][]; empty?: string; label: string; onRow?: (i: number) => void }) {
  const grid = cols.map(c => c.w || 'minmax(0,1fr)').join(' ');
  return (
    <div role="table" aria-label={label} style={{ font: '13px/18px var(--f-ui)' }}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, alignItems: 'center', height: 36, borderBottom: '1px solid var(--ln)', font: '500 12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
        {cols.map((c, i) => (
          <div key={i} role="columnheader" style={{ textAlign: c.r ? 'right' : 'left', whiteSpace: 'nowrap' }}>{c.label}</div>
        ))}
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          role="row"
          onClick={onRow ? () => onRow(i) : undefined}
          className={onRow ? HOVER : undefined}
          style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, alignItems: 'center', minHeight: 40, borderBottom: '1px solid var(--ln)', cursor: onRow ? 'pointer' : undefined, transition: 'background-color 100ms' }}
        >
          {r.map((c, j) => (
            <div key={j} role="cell" style={{ minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: cols[j]?.r ? 'flex-end' : 'flex-start', fontVariantNumeric: cols[j]?.r ? 'tabular-nums' : undefined, gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c}
            </div>
          ))}
        </div>
      ))}
      {!rows.length && empty ? <p style={{ padding: '16px 0', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>{empty}</p> : null}
    </div>
  );
}

/** Status: 16 px icon in the status colour plus the word. Never colour alone. */
export function Status({ icon, label, tone = 'tx', spin, tip }: { icon: string; label: ReactNode; tone?: string; spin?: boolean; tip?: string }) {
  return (
    <span data-tip={tip} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, whiteSpace: 'nowrap' }}>
      <Icon name={icon} spin={spin} style={{ color: TONE[tone] || tone }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </span>
  );
}

export function Progress({ pct, tone = 'run', width, slow }: { pct: number; tone?: string; width?: number | string; slow?: boolean }) {
  return (
    <span style={{ display: 'block', height: 6, width, background: 'var(--ln)', borderRadius: 3, overflow: 'hidden', flex: width ? 'none' : 1, minWidth: 24 }}>
      <span style={{ display: 'block', height: 6, borderRadius: 3, width: `${Math.max(0, Math.min(100, pct))}%`, background: TONE[tone] || tone, transition: `width ${slow ? 900 : 150}ms linear` }} />
    </span>
  );
}

export type LogLine = { t: string; text: string; lv?: 'info' | 'ok' | 'warn' | 'err' };
const LV = { info: ['circle-dot', 'var(--tx-3)'], ok: ['circle-check', 'var(--ok)'], warn: ['triangle-alert', 'var(--warn)'], err: ['circle-x', 'var(--err)'] };

/** Log viewer: 12/20, time, level icon, text; follows new lines. */
export function LogView({ lines, height = 280 }: { lines: LogLine[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div ref={ref} role="log" aria-label="Log" style={{ height, overflow: 'auto', padding: '8px 12px', background: 'var(--panel-2)', border: '1px solid var(--ln)', borderRadius: 'var(--r)', font: '12px/20px var(--f-ui)' }}>
      {lines.map((l, i) => {
        const [ic, c] = LV[l.lv || 'info'];
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 16px minmax(0,1fr)', gap: 8, alignItems: 'center', animation: 'ae-line 150ms var(--ease)' }}>
            <span style={{ color: 'var(--tx-3)', fontVariantNumeric: 'tabular-nums' }}>{l.t}</span>
            <Icon name={ic} style={{ color: c }} />
            <span>{l.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export type Step = { label: string; note?: string; state: 'done' | 'current' | 'todo' | 'failed' | 'skipped' };
const STEP = {
  done: ['circle-check', 'var(--ok)'],
  current: ['loader-circle', 'var(--run)'],
  todo: ['circle', 'var(--tx-3)'],
  failed: ['circle-x', 'var(--err)'],
  skipped: ['circle-minus', 'var(--tx-3)']
};

/** Lifecycle or phase list: one line per step, the current step highlighted. */
export function StepList({ steps, label = 'Steps' }: { steps: Step[]; label?: string }) {
  return (
    <ol aria-label={label} style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column' }}>
      {steps.map((s, i) => {
        const [ic, c] = STEP[s.state];
        const cur = s.state === 'current';
        return (
          <li key={i} aria-current={cur ? 'step' : undefined} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 10, alignItems: 'center', minHeight: 34, padding: '0 10px', borderRadius: 'var(--r-sm)', background: cur ? 'var(--acc-soft)' : 'transparent', color: s.state === 'todo' || s.state === 'skipped' ? 'var(--tx-2)' : 'var(--tx)', transition: 'background-color 150ms' }}>
            <Icon name={ic} spin={cur} style={{ color: c }} />
            <span style={{ fontWeight: cur ? 600 : 400 }}>{s.label}</span>
            <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{s.note}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal stepper: 2 px bars and 20 px square markers; used by wizards and timelines. */
export function Stepper({ steps, current, done }: { steps: string[]; current: number; done?: (i: number) => boolean }) {
  return (
    <ol aria-label="Steps" style={{ flex: 'none', listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: `repeat(${steps.length},minmax(0,1fr))`, gap: 8 }}>
      {steps.map((label, i) => {
        const isDone = done ? done(i) : i < current;
        const on = i === current;
        const reached = isDone || on;
        return (
          <li key={i} aria-current={on ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ height: 3, borderRadius: 2, background: reached ? 'var(--acc)' : 'var(--ln)', transition: 'background-color 150ms var(--ease)' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '12px/16px var(--f-ui)', color: on ? 'var(--tx)' : isDone ? 'var(--tx-2)' : 'var(--tx-3)' }}>
              <span style={{ width: 20, height: 20, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', border: `1px solid ${reached ? 'var(--acc)' : 'var(--ln-2)'}`, background: isDone ? 'var(--acc)' : 'transparent', color: isDone ? 'var(--acc-ink)' : on ? 'var(--acc)' : 'var(--tx-3)', font: '600 11px var(--f-ui)', transition: 'background-color 150ms,border-color 150ms' }}>
                {isDone ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const SKW = ['72%', '56%', '84%', '40%', '64%', '48%'];

/**
 * Loading, empty and unreachable states for views that are not tables.
 * Unreachable never shows zeros, blanks or "never".
 */
export function StateBlock({ ui, emptyText, emptyAction, onEmpty, unreachText, children, rows = 4 }: { ui: UiState; emptyText: string; emptyAction?: string; onEmpty?: () => void; unreachText?: string; children: ReactNode; rows?: number }) {
  if (ui === 'loading')
    return (
      <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} aria-hidden="true" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--ln)', animation: 'ae-fade 150ms var(--ease)' }}>
            <span style={{ height: 8, width: SKW[i % 6], background: 'var(--skel)', borderRadius: 4 }} />
          </div>
        ))}
        <span style={{ padding: '8px 0', font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Reading…</span>
      </div>
    );
  if (ui === 'unreach')
    return (
      <Bar tone="warn" multiline>
        {unreachText || 'Could not be read: the orchestrator did not answer within 30 s.'} Nothing is shown here until it can be read.
      </Bar>
    );
  if (ui === 'empty')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '64px 24px', textAlign: 'center', animation: 'ae-fade 150ms var(--ease)' }}>
        <span style={{ font: '15px/22px var(--f-body)', color: 'var(--tx-2)', maxWidth: 440 }}>{emptyText}</span>
        {emptyAction ? (
          <button type="button" onClick={onEmpty} className={pc('hover', 'background:var(--acc-h)')} style={{ height: 32, padding: '0 14px', borderRadius: 'var(--r-sm)', background: 'var(--acc)', color: 'var(--acc-ink)', fontWeight: 500 }}>
            {emptyAction}
          </button>
        ) : null}
      </div>
    );
  return <>{children}</>;
}

/** Wraps the shared table so it fills the rest of the screen. */
export function TableArea({ children, above }: { children: ReactNode; above?: ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {above}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

export function H3({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
      <h3 style={{ font: '600 14px/20px var(--f-body)' }}>{children}</h3>
      {right}
    </div>
  );
}

/** Activity list: icon, sentence, time. */
export function Activity({ items }: { items: { icon: string; tone?: string; text: ReactNode; when: string }[] }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column' }}>
      {items.map((ev, i) => (
        <li key={i} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--ln)' }}>
          <Icon name={ev.icon} style={{ color: ev.tone ? TONE[ev.tone] : 'var(--tx-2)', marginTop: 2 }} />
          <span>
            <span style={{ display: 'block' }}>{ev.text}</span>
            <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{ev.when}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : many || one + 's'}`;
