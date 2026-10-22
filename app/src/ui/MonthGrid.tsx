import type { ReactNode } from 'react';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** '2026-10-25' → 'Sun 25 Oct 2026' */
export const dayLabel = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return `${DOW[new Date(y, m - 1, dd).getDay()]} ${String(dd).padStart(2, '0')} ${MON[m - 1]} ${y}`;
};

/**
 * A month as a Monday-first grid. Each day shows what `render` returns for it; `shade` greys a
 * day (a blackout, a freeze). Today is outlined in the accent.
 */
export function MonthGrid({ month, today, label, render, shade, describe }: { month: string; today?: string; label: string; render: (day: string) => ReactNode; shade?: (day: string) => boolean; describe?: (day: string) => string }) {
  const [y, m] = month.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => (i >= lead && i < lead + days ? i - lead + 1 : null));
  return (
    <div role="grid" aria-label={`${label}, ${MON[m - 1]} ${y}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', border: '1px solid var(--ln)', background: 'var(--panel)', flex: 'none' }}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
        <div key={d} role="columnheader" style={{ padding: '8px 10px', font: '12px var(--f-ui)', color: 'var(--tx-2)', borderBottom: '1px solid var(--ln)' }}>
          {d}
        </div>
      ))}
      {cells.map((d, i) => {
        const day = d ? `${month}-${String(d).padStart(2, '0')}` : '';
        const isToday = !!d && day === today;
        return (
          <div
            key={i}
            role="gridcell"
            aria-label={d ? `${dayLabel(day)}${describe ? describe(day) : ''}` : undefined}
            style={{ minHeight: 88, padding: 6, borderLeft: i % 7 ? '1px solid var(--ln)' : 'none', borderTop: i >= 7 ? '1px solid var(--ln)' : 'none', background: d ? (shade?.(day) ? 'var(--panel-2)' : undefined) : 'var(--app)', outline: isToday ? '1px solid var(--acc)' : undefined, outlineOffset: -1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}
          >
            {d ? <span style={{ font: `${isToday ? 700 : 400} 12px var(--f-ui)`, color: isToday ? 'var(--acc-tx)' : 'var(--tx-2)' }}>{d}</span> : null}
            {d ? render(day) : null}
          </div>
        );
      })}
    </div>
  );
}
