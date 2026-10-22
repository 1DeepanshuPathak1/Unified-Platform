import { useState, type CSSProperties, type ReactElement } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { COVERAGE, CURRENT_TURN, type CovItem, type CovStatus } from '../data/coverage';
import { FilterInput, Seg, SelectFilter, Toggle } from '../ui/controls';
import { plural } from '../ui/layout';

const ST: Record<CovStatus, [string, string]> = {
  Designed: ['circle-check', 'var(--ok)'],
  'Partly designed': ['circle-dot', 'var(--warn)'],
  'Not designed': ['circle', 'var(--tx-3)']
};
const readTheme = () => {
  try {
    return localStorage.getItem('aegis.theme') || 'dark';
  } catch {
    return 'dark';
  }
};

/** Coverage of the Unified Platform brief: every item, its screens, status, priority and the object it reads. */
export default function Coverage({ hub }: { hub?: boolean }) {
  const [theme, setTheme] = useState(readTheme);
  const [status, setStatus] = useState<'All' | CovStatus>('All');
  const [prio, setPrio] = useState('All');
  const [part, setPart] = useState('All');
  const [changed, setChanged] = useState(false);
  const [q, setQ] = useState('');
  const toggle = () => {
    const t = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('aegis.theme', t);
    } catch {
      /* the theme just will not persist */
    }
    setTheme(t);
  };
  const ql = q.trim().toLowerCase();
  const rows = COVERAGE.filter(c => (status === 'All' || c.now === status) && (prio === 'All' || c.prio === prio) && (part === 'All' || c.part === part) && (!changed || c.turn === CURRENT_TURN) && (!ql || `${c.id} ${c.item} ${c.object} ${c.group}`.toLowerCase().includes(ql)));
  const count = (st: CovStatus, list = COVERAGE) => list.filter(c => c.now === st).length;
  const p0 = COVERAGE.filter(c => c.prio === 'P0');
  const changedRows = COVERAGE.filter(c => c.turn === CURRENT_TURN && (c.prev ?? c.was) !== c.now);
  const tile = (label: string, value: string, sub: string, color?: string): ReactElement => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 18px', borderLeft: '1px solid var(--ln)', minWidth: 0 }}>
      <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{label}</span>
      <span style={{ font: '500 28px/36px var(--f-head)', fontVariantNumeric: 'tabular-nums', color: color || 'var(--tx)' }}>{value}</span>
      <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{sub}</span>
    </div>
  );
  const consoleHref = hub ? '#/backup/inbox' : '#/';
  return (
    <div data-ae="" data-theme={theme} style={{ minHeight: '100vh', background: 'var(--app)', color: 'var(--tx)', font: '14px/20px var(--f-body)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', background: 'var(--hdr)', borderBottom: '1px solid var(--ln)' }}>
        <Icon name="mark" size={24} />
        <span style={{ font: '500 17px/24px var(--f-head)' }}>Host360 Aegis</span>
        <span style={{ width: 1, height: 24, background: 'var(--ln-2)' }} />
        <span style={{ font: '500 16px/24px var(--f-head)', color: 'var(--tx-2)' }}>Coverage</span>
        <span style={{ flex: 1 }} />
        <a href="#/handoff" className={pc('hover', 'background:var(--hover)')} style={btn}>
          Handoff values
          <Icon name="arrow-right" />
        </a>
        <a href={consoleHref} className={pc('hover', 'background:var(--hover)')} style={btn}>
          Open the console
          <Icon name="external-link" />
        </a>
        <button type="button" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} className={pc('hover', 'background:var(--hover)')} style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </header>
      <main style={{ maxWidth: 1360, padding: '32px 40px 80px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 880 }}>
          <h1 style={{ font: '500 28px/36px var(--f-head)' }}>Unified Platform coverage</h1>
          <p style={{ color: 'var(--tx-2)', textWrap: 'pretty' } as CSSProperties}>
            Every item in Parts 2 to 7 of the brief, the screens that serve it, how far it is designed, its priority and the platform object it reads. Items are built in priority order, P0 first. This page is updated at the end of every turn; turn {CURRENT_TURN} is the latest.
          </p>
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', background: 'var(--panel)', border: '1px solid var(--ln)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 18px', minWidth: 0 }}>
            <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Items</span>
            <span style={{ font: '500 28px/36px var(--f-head)' }}>{COVERAGE.length}</span>
            <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Parts 2 to 7</span>
          </div>
          {tile('Designed', String(count('Designed')), `${Math.round((count('Designed') / COVERAGE.length) * 100)} % of the brief`, 'var(--ok)')}
          {tile('Partly designed', String(count('Partly designed')), 'Some screens or states exist', 'var(--warn)')}
          {tile('Not designed', String(count('Not designed')), 'Nothing built yet')}
          {tile('P0 done', `${count('Designed', p0)} of ${p0.length}`, `${p0.length - count('Designed', p0)} P0 items left`)}
        </section>
        {changedRows.length ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Changed in turn {CURRENT_TURN}</h2>
            <ul style={{ listStyle: 'none', padding: 0, background: 'var(--panel)', border: '1px solid var(--ln)' }}>
              {changedRows.map(c => (
                <li key={c.id} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) 300px', gap: 12, alignItems: 'center', minHeight: 40, padding: '6px 16px', borderBottom: '1px solid var(--ln)' }}>
                  <span style={{ font: '700 12px var(--f-ui)', color: 'var(--tx-3)' }}>{c.id}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={c.item} data-tip-overflow="">{c.item}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '13px var(--f-ui)', whiteSpace: 'nowrap' }}>
                    <StatusL s={c.prev ?? c.was} muted />
                    <Icon name="arrow-right" style={{ color: 'var(--tx-3)' }} />
                    <StatusL s={c.now} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Every item</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <Seg label="Status" value={status} onChange={setStatus} options={[{ v: 'All', label: 'All', count: COVERAGE.length }, ...(['Designed', 'Partly designed', 'Not designed'] as CovStatus[]).map(s => ({ v: s, label: s, count: count(s) }))]} />
            <SelectFilter label="Priority" value={prio} onChange={setPrio} options={['All', 'P0', 'P1', 'P2', 'P3', 'P4']} />
            <SelectFilter label="Part" value={part} onChange={setPart} options={[{ v: 'All', label: 'All' }, { v: '2', label: '2 · Navigation and shell' }, { v: '3', label: '3 · Platform' }, { v: '4', label: '4 · Resilience' }, { v: '5', label: '5 · Mobility' }, { v: '6', label: '6 · Internal Admin Portal' }, { v: '7', label: '7 · Rules' }]} />
            <FilterInput value={q} onChange={setQ} placeholder="Filter by text or object" label="Filter items" width={240} />
            <Toggle on={changed} onChange={setChanged} label="Only changed this turn">
              Only changed in turn {CURRENT_TURN}
            </Toggle>
            <span style={{ flex: 1 }} />
            <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{plural(rows.length, 'item')}</span>
          </div>
          <div role="table" aria-label="Coverage" style={{ background: 'var(--panel)', border: '1px solid var(--ln)', font: '13px/18px var(--f-ui)' }}>
            <div role="row" style={{ ...grid, position: 'sticky', top: 52, zIndex: 1, minHeight: 36, background: 'var(--panel-2)', borderBottom: '1px solid var(--ln)', fontSize: 12, color: 'var(--tx-2)' }}>
              {['ID', 'Item', 'Screens', 'Status', 'Priority', 'Reads', 'Level'].map(h => (
                <div key={h} role="columnheader">
                  {h}
                </div>
              ))}
            </div>
            {rows.map(c => (
              <Row key={c.id} c={c} />
            ))}
            {!rows.length ? <p style={{ padding: 24, textAlign: 'center', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>Nothing matches these filters.</p> : null}
          </div>
          <p style={{ font: '12px/18px var(--f-ui)', color: 'var(--tx-3)' }}>
            The brief sets priorities from P0 to P2; nothing is marked P3 or P4, so those filters are empty. Designed means the screens and every state (loading, empty, error, unreachable) exist and work in the console.
          </p>
        </section>
      </main>
    </div>
  );
}

const btn: CSSProperties = { height: 32, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', border: '1px solid var(--ln-2)', fontWeight: 600 };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: '48px minmax(0,2.4fr) minmax(0,1.4fr) 168px 64px minmax(0,1fr) 108px', gap: 12, alignItems: 'start', padding: '8px 16px' };

function StatusL({ s, muted }: { s: CovStatus; muted?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: muted ? 'var(--tx-3)' : 'var(--tx)', whiteSpace: 'nowrap' }}>
      <Icon name={ST[s][0]} style={{ color: muted ? 'var(--tx-3)' : ST[s][1] }} />
      {s}
    </span>
  );
}

function Row({ c }: { c: CovItem }) {
  return (
    <div role="row" style={{ ...grid, borderBottom: '1px solid var(--ln)', background: c.turn === CURRENT_TURN && (c.prev ?? c.was) !== c.now ? 'var(--acc-soft)' : undefined }}>
      <div role="cell" style={{ fontWeight: 700, color: 'var(--tx-2)' }}>{c.id}</div>
      <div role="cell" style={{ fontFamily: 'var(--f-body)', fontSize: 14, lineHeight: '20px' }}>
        <div>{c.item}</div>
        {c.note ? <div style={{ marginTop: 2, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{c.note}</div> : null}
      </div>
      <div role="cell" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {c.screens.length ? (
          c.screens.map((s, i) =>
            s.route ? (
              <a key={i} href={`#/${s.route.startsWith('dr/') || s.route.startsWith('mig/') || s.route.startsWith('backup/') ? s.route : `backup/${s.route}`}`} style={{ color: 'var(--acc-tx)', fontWeight: 600 }}>
                {s.label}
              </a>
            ) : (
              <span key={i}>{s.label}</span>
            )
          )
        ) : (
          <span style={{ color: 'var(--tx-3)' }}>None yet</span>
        )}
      </div>
      <div role="cell">
        <StatusL s={c.now} />
        {c.turn === CURRENT_TURN && (c.prev ?? c.was) !== c.now ? <div style={{ marginTop: 2, fontSize: 12, color: 'var(--tx-3)' }}>was {(c.prev ?? c.was).toLowerCase()}</div> : null}
      </div>
      <div role="cell" style={{ fontWeight: 700, color: c.prio === 'P0' ? 'var(--tx)' : 'var(--tx-2)' }}>{c.prio}</div>
      <div role="cell" style={{ color: 'var(--tx-2)' }}>{c.object}</div>
      <div role="cell" style={{ color: 'var(--tx-2)' }}>{c.level}</div>
    </div>
  );
}
