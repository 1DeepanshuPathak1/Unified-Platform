import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../lib/Icon';

export type GraphNode = { id: string; label: string; sub?: string; icon?: string; badge?: ReactNode; group?: string; tone?: 'ok' | 'warn' | 'err' };
/** An edge [a, b] means b depends on a: a comes up first, a moves no later than b. */
export type GraphEdge = [string, string];

const W = 196;
const H = 52;
const GX = 72;
const GY = 14;
const GROUP_GAP = 26;

/**
 * Layered dependency graph: what everything depends on sits in the leftmost column, and each
 * column depends only on columns to its left, so the columns read as the boot order. Hovering
 * or focusing a node highlights what it needs and what needs it.
 */
export function DepGraph({ nodes, edges, label, onOpen, columnLabel }: { nodes: GraphNode[]; edges: GraphEdge[]; label: string; onOpen?: (id: string) => void; columnLabel?: (i: number) => string }) {
  const [hi, setHi] = useState<string | null>(null);
  const layout = useMemo(() => {
    const ids = new Set(nodes.map(n => n.id));
    const es = edges.filter(([a, b]) => ids.has(a) && ids.has(b) && a !== b);
    const depth: Record<string, number> = {};
    const visit = (id: string, stack: string[] = []): number => {
      if (depth[id] != null) return depth[id];
      if (stack.includes(id)) return 0; // a cycle: break it rather than loop
      const parents = es.filter(e => e[1] === id).map(e => e[0]);
      depth[id] = parents.length ? 1 + Math.max(...parents.map(p => visit(p, [...stack, id]))) : 0;
      return depth[id];
    };
    nodes.forEach(n => visit(n.id));
    const cols: GraphNode[][] = [];
    nodes.forEach(n => (cols[depth[n.id]] ||= []).push(n));
    const pos: Record<string, { x: number; y: number }> = {};
    let maxY = 0;
    cols.forEach((col, ci) => {
      // Keep members of the same group together inside a column.
      col.sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.label.localeCompare(b.label));
      let y = 28;
      col.forEach((n, i) => {
        if (i && n.group !== col[i - 1].group) y += GROUP_GAP - GY;
        pos[n.id] = { x: ci * (W + GX), y };
        y += H + GY;
      });
      maxY = Math.max(maxY, y);
    });
    return { es, pos, cols, width: Math.max(0, cols.length * (W + GX) - GX), height: Math.max(0, maxY) };
  }, [nodes, edges]);
  const near = (id: string) => !hi || id === hi || layout.es.some(([a, b]) => (a === hi && b === id) || (b === hi && a === id));
  const desc = nodes.map(n => `${n.label}${layout.es.filter(e => e[1] === n.id).length ? ` needs ${layout.es.filter(e => e[1] === n.id).map(e => nodes.find(x => x.id === e[0])?.label).join(', ')}` : ''}`).join('; ');
  return (
    <div style={{ flex: 'none', overflow: 'auto', border: '1px solid var(--ln)', background: 'var(--panel)', padding: 16 }}>
      <div role="group" aria-label={`${label}. ${desc}`} style={{ position: 'relative', width: layout.width, height: layout.height, minWidth: '100%' }}>
        {layout.cols.map((_, i) => (
          <span key={i} style={{ position: 'absolute', left: i * (W + GX), top: 0, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>
            {columnLabel ? columnLabel(i) : `Step ${i + 1}`}
          </span>
        ))}
        <svg width={layout.width} height={layout.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
          {layout.es.map(([a, b]) => {
            const p = layout.pos[a];
            const q = layout.pos[b];
            const x1 = p.x + W;
            const y1 = p.y + H / 2;
            const x2 = q.x;
            const y2 = q.y + H / 2;
            const on = hi && (a === hi || b === hi);
            const mx = (x1 + x2) / 2;
            return (
              <g key={a + '>' + b} opacity={!hi || on ? 1 : 0.25}>
                <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 6},${y2}`} fill="none" stroke={on ? 'var(--acc)' : 'var(--ln-2)'} strokeWidth={on ? 2 : 1.5} />
                <path d={`M${x2 - 7},${y2 - 4} L${x2},${y2} L${x2 - 7},${y2 + 4}`} fill="none" stroke={on ? 'var(--acc)' : 'var(--ln-2)'} strokeWidth={on ? 2 : 1.5} />
              </g>
            );
          })}
        </svg>
        {nodes.map(n => {
          const p = layout.pos[n.id];
          const on = hi === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onMouseEnter={() => setHi(n.id)}
              onMouseLeave={() => setHi(null)}
              onFocus={() => setHi(n.id)}
              onBlur={() => setHi(null)}
              onClick={onOpen ? () => onOpen(n.id) : undefined}
              aria-label={`${n.label}${n.sub ? `, ${n.sub}` : ''}`}
              style={{ position: 'absolute', left: p.x, top: p.y, width: W, height: H, display: 'grid', gridTemplateColumns: n.icon ? '18px minmax(0,1fr) auto' : 'minmax(0,1fr) auto', gap: 8, alignItems: 'center', padding: '0 10px', textAlign: 'left', border: `1px solid ${on ? 'var(--acc)' : n.tone ? `var(--${n.tone})` : 'var(--ln-2)'}`, background: on ? 'var(--acc-soft)' : 'var(--panel-2)', opacity: near(n.id) ? 1 : 0.4, cursor: onOpen ? 'pointer' : 'default', transition: 'opacity 100ms,border-color 100ms,background-color 100ms' }}
            >
              {n.icon ? <Icon name={n.icon} style={{ color: n.tone ? `var(--${n.tone})` : 'var(--tx-2)' }} /> : null}
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</span>
                {n.sub ? <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.sub}</span> : null}
              </span>
              {n.badge != null ? <span style={{ font: '600 12px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>{n.badge}</span> : <span />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
