/* Ported from project/AegisTable.dc.html */
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';

const COLORS = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', run: 'var(--run)', tx: 'var(--tx-3)', acc: 'var(--acc)' };
const SKW = ['72%', '56%', '84%', '40%', '64%', '48%', '76%', '60%'];
const sortVal = c => {
  if (c == null) return null;
  if (Array.isArray(c)) return c.join(',');
  if (typeof c === 'object') {
    if ('s' in c) return c.s;
    return c.pct != null ? c.pct : c.v != null ? (Array.isArray(c.v) ? c.v.join(',') : c.v) : c.l;
  }
  return c;
};

export default class AegisTable extends DC {
  state: any = { sk: undefined, sd: 1 };

  cell(raw, col) {
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw);
    const c = obj ? raw : { v: raw };
    const t = c.t || (Array.isArray(raw) ? 'tags' : 'text');
    const v = c.v == null || Array.isArray(c.v) ? (Array.isArray(raw) ? '' : c.v == null ? '' : '') : String(c.v);
    const right = !!col.r;
    return {
      isText: t === 'text',
      isStatus: t === 'status' || t === 'icon',
      isTags: t === 'tags',
      isBar: t === 'bar',
      isBtn: t === 'btn',
      isPhases: t === 'phases',
      segs: c.segs || [],
      v,
      l: c.l != null ? c.l : v,
      tip: c.tip || c.l || v,
      jc: right ? 'flex-end' : 'flex-start',
      ta: right ? 'right' : 'left',
      color: c.muted ? 'var(--tx-3)' : col.dim ? 'var(--tx-2)' : 'var(--tx)',
      fw: c.strong ? 700 : 400,
      fs: c.italic ? 'italic' : 'normal',
      i: c.i || '',
      spin: c.spin ? 'true' : 'false',
      ic: COLORS[c.c] || 'var(--tx-2)',
      tags: Array.isArray(raw) ? raw : Array.isArray(c.v) ? c.v : [],
      pctW: Math.max(0, Math.min(100, c.pct || 0)) + '%',
      barC: COLORS[c.c] || 'var(--tx-3)',
      onClick: c.onClick
        ? e => {
            e.stopPropagation();
            if (!c.disabled) c.onClick();
          }
        : undefined,
      disabled: c.disabled ? 'true' : undefined,
      why: c.disabled ? c.why : undefined,
      op: c.disabled ? 0.45 : 1
    };
  }

  renderVals() {
    const p = this.props;
    const cols = p.cols || [];
    const sk = this.state.sk !== undefined ? this.state.sk : p.sort || null;
    const sd = this.state.sk !== undefined ? this.state.sd : p.dir || 1;
    const selectable = !!p.onSel;
    const sel = p.sel || {};
    const chev = !!p.onRow && p.chev !== false;
    const state = p.state || 'live';
    let rows = (p.rows || []).slice();
    if (sk) {
      rows.sort((a, b) => {
        const va = sortVal(a[sk]),
          vb = sortVal(b[sk]);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (
          (typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' })) * sd
        );
      });
    }
    const grid = (selectable ? '44px ' : '') + cols.map(c => c.w || 'minmax(0,1fr)').join(' ') + (chev ? ' 36px' : '');
    const heads = cols.map(c => {
      const on = sk === c.k;
      return {
        label: c.label,
        jc: c.r ? 'flex-end' : 'flex-start',
        nosort: !!c.nosort,
        cursor: c.nosort ? 'default' : 'pointer',
        arrow: on ? (sd > 0 ? 'arrow-up' : 'arrow-down') : '',
        aria: on ? (sd > 0 ? 'ascending' : 'descending') : 'none',
        onClick: () =>
          this.setState(s => ({
            sk: c.k,
            sd: (s.sk !== undefined ? s.sk : p.sort) === c.k ? -(s.sk !== undefined ? s.sd : p.dir || 1) : 1
          }))
      };
    });
    const ids = rows.map(r => r.id);
    const selN = ids.filter(id => sel[id]).length;
    const all = ids.length > 0 && selN === ids.length;
    const some = selN > 0 && !all;
    const R = rows.map(r => {
      const on = !!sel[r.id];
      const act = p.active === r.id;
      const first = cols[0] ? r[cols[0].k] : '';
      return {
        id: r.id,
        label: typeof first === 'object' && first ? first.v || first.l || '' : first,
        cells: cols.map(c => this.cell(r[c.k], c)),
        sel: on,
        cbBg: on ? 'var(--acc)' : 'transparent',
        cbBd: on ? 'var(--acc)' : 'var(--ln-2)',
        cbOp: on ? 1 : 0,
        bg: on || act ? 'var(--acc-soft)' : 'transparent',
        hbg: on || act ? 'var(--acc-soft)' : 'var(--hover)',
        ring: act ? 'inset 2px 0 0 var(--acc)' : 'none',
        cursor: p.onRow ? 'pointer' : 'default',
        onSel: e => {
          e.stopPropagation();
          p.onSel(r.id);
        },
        onClick: p.onRow ? () => p.onRow(r.id) : undefined
      };
    });
    const isLive = state === 'live' && R.length > 0;
    const isLoading = state === 'loading';
    const isUnreach = state === 'unreach';
    const isEmpty = state === 'empty' || (state === 'live' && R.length === 0 && !p.filtered);
    const noMatch = state === 'live' && R.length === 0 && !!p.filtered;
    const skel = Array.from({ length: 8 }, (_, i) => ({
      cells: [].concat(
        selectable ? [{ w: '16px', jc: 'flex-start' }] : [],
        cols.map((c, j) => ({ w: c.r ? '40%' : SKW[(i + j) % SKW.length], jc: c.r ? 'flex-end' : 'flex-start' })),
        chev ? [{ w: '0', jc: 'center' }] : []
      )
    }));
    const unit = p.unit || ['item', 'items'];
    const blankAction = isEmpty ? p.emptyAction || '' : noMatch ? 'Clear filters' : '';
    const blankDisabled = isEmpty && p.emptyDisabled;
    return {
      grid,
      heads,
      rows: R,
      selectable,
      chev,
      rowH: (p.rowH || 36) + 'px',
      label: p.label || 'Table',
      allAria: all ? 'true' : some ? 'mixed' : 'false',
      allIcon: all ? 'check' : some ? 'minus' : '',
      allBg: all || some ? 'var(--acc)' : 'transparent',
      allBd: all || some ? 'var(--acc)' : 'var(--ln-2)',
      toggleAll: () => p.onSelAll && p.onSelAll(ids, !all),
      isLive,
      isLoading,
      isUnreach,
      skel,
      showBlank: isEmpty || noMatch || isUnreach,
      blankText: isUnreach
        ? 'Nothing is shown here until it can be read. Values are not replaced with zeros or blanks.'
        : noMatch
          ? p.noMatchText || 'Nothing matches these filters.'
          : p.emptyText || 'Nothing here yet.',
      blankAction: isUnreach ? '' : blankAction,
      onBlank: noMatch ? p.onClear : blankDisabled ? undefined : p.onEmpty,
      blankDisabled: blankDisabled ? 'true' : undefined,
      blankWhy: blankDisabled ? p.emptyWhy : undefined,
      blankBg: noMatch ? 'transparent' : 'var(--acc)',
      blankFg: noMatch ? 'var(--tx)' : 'var(--acc-ink)',
      blankBd: noMatch ? 'var(--ln-2)' : 'var(--acc)',
      unreachText: p.unreachText || 'Could not be read.',
      rowCount: R.length,
      footL: isLoading
        ? 'Reading…'
        : isUnreach
          ? 'Not read'
          : p.foot || `${R.length} ${R.length === 1 ? unit[0] : unit[1]}${selN ? ` · ${selN} selected` : ''}`,
      footR: isLoading || isUnreach ? '' : p.footR || ''
    };
  }

  render() {
    const v = this.vals();
    return (
      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--panel)',
          border: '1px solid var(--ln)',
          font: '13px/18px var(--f-ui)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--tx)',
          transition: 'background-color 150ms,border-color 150ms'
        }}
      >
        {v.isUnreach ? (
          <div
            role="status"
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minHeight: '40px',
              padding: '0 12px',
              background: 'var(--warn-s)',
              borderBottom: '1px solid var(--ln)'
            }}
          >
            <Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />
            <span style={{ minWidth: 0 }}>{v.unreachText}</span>
          </div>
        ) : null}
        <div
          role="table"
          aria-label={v.label}
          aria-busy={v.isLoading}
          aria-rowcount={v.rowCount}
          style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          <div
            role="row"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              display: 'grid',
              gridTemplateColumns: v.grid,
              alignItems: 'center',
              height: '36px',
              background: 'var(--panel-2)',
              borderBottom: '1px solid var(--ln)',
              color: 'var(--tx-2)',
              fontSize: '12px'
            }}
          >
            {v.selectable ? (
              <div role="columnheader" style={{ padding: '0 0 0 14px', display: 'flex', alignItems: 'center' }}>
                <button
                  role="checkbox"
                  aria-checked={v.allAria}
                  aria-label="Select all"
                  onClick={v.toggleAll}
                  style={{
                    width: '16px',
                    height: '16px',
                    display: 'grid',
                    placeItems: 'center',
                    border: `1px solid ${v.allBd}`,
                    background: v.allBg,
                    color: 'var(--acc-ink)',
                    transition: 'background-color 100ms,border-color 100ms'
                  }}
                >
                  <Icon name={v.allIcon} size="12" />
                </button>
              </div>
            ) : null}
            {arr(v.heads).map((h: any, i: number) => (
              <div key={i} role="columnheader" aria-sort={h.aria} style={{ minWidth: 0, padding: '0 8px' }}>
                <button
                  onClick={h.onClick}
                  disabled={h.nosort}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: h.jc,
                    gap: '4px',
                    width: '100%',
                    height: '34px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    cursor: h.cursor,
                    transition: 'color 100ms'
                  }}
                  className={pc('hover', 'color:var(--tx)')}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.label}</span>
                  <Icon name={h.arrow} style={{ color: 'var(--acc)' }} />
                </button>
              </div>
            ))}
            {v.chev ? <div role="columnheader" aria-label="Open" /> : null}
          </div>
          {v.isLive ? (
            <>
              {arr(v.rows).map((r: any, i: number) => (
                <div
                  key={i}
                  role="row"
                  onClick={r.onClick}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: v.grid,
                    alignItems: 'center',
                    height: v.rowH,
                    borderBottom: '1px solid var(--ln)',
                    cursor: r.cursor,
                    background: r.bg,
                    boxShadow: r.ring,
                    transition: 'background-color 100ms,box-shadow 100ms'
                  }}
                  className={pc('hover', `background:${r.hbg}`)}
                >
                  {v.selectable ? (
                    <div role="cell" style={{ padding: '0 0 0 14px', display: 'flex', alignItems: 'center' }}>
                      <button
                        role="checkbox"
                        aria-checked={r.sel}
                        aria-label={`Select ${r.label ?? ''}`}
                        onClick={r.onSel}
                        style={{
                          width: '16px',
                          height: '16px',
                          display: 'grid',
                          placeItems: 'center',
                          border: `1px solid ${r.cbBd}`,
                          background: r.cbBg,
                          color: 'var(--acc-ink)',
                          transition: 'background-color 100ms,border-color 100ms'
                        }}
                        className={pc('hover', 'border-color:var(--acc)')}
                      >
                        <Icon name="check" size="12" style={{ opacity: r.cbOp, transition: 'opacity 100ms' }} />
                      </button>
                    </div>
                  ) : null}
                  {arr(r.cells).map((c: any, j: number) => (
                    <div
                      key={j}
                      role="cell"
                      style={{
                        minWidth: 0,
                        padding: '0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: c.jc,
                        gap: '6px',
                        overflow: 'hidden'
                      }}
                    >
                      {c.isText ? (
                        <span
                          data-tip={c.tip}
                          data-tip-overflow=""
                          style={{
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textAlign: c.ta,
                            color: c.color,
                            fontWeight: c.fw,
                            fontStyle: c.fs
                          }}
                        >
                          {c.v}
                        </span>
                      ) : null}
                      {c.isStatus ? (
                        <>
                          <Icon name={c.i} spin={c.spin} style={{ color: c.ic }} />
                          <span
                            data-tip={c.tip}
                            data-tip-overflow=""
                            style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {c.l}
                          </span>
                        </>
                      ) : null}
                      {c.isTags ? (
                        <>
                          {arr(c.tags).map((tg: any, k: number) => (
                            <span
                              key={k}
                              style={{
                                flex: 'none',
                                height: '20px',
                                padding: '0 6px',
                                border: '1px solid var(--ln-2)',
                                fontSize: '11px',
                                lineHeight: '18px',
                                color: 'var(--tx-2)',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {tg}
                            </span>
                          ))}
                        </>
                      ) : null}
                      {c.isBar ? (
                        <>
                          <span style={{ flex: 1, minWidth: '24px', maxWidth: '96px', height: '4px', background: 'var(--ln)' }}>
                            <span
                              style={{
                                display: 'block',
                                height: '4px',
                                width: c.pctW,
                                background: c.barC,
                                transition: 'width 150ms linear'
                              }}
                            />
                          </span>
                          <span style={{ flex: 'none', whiteSpace: 'nowrap', color: 'var(--tx-2)' }}>{c.v}</span>
                        </>
                      ) : null}
                      {c.isPhases ? (
                        <>
                          <span
                            data-tip={c.tip}
                            style={{ flex: 1, display: 'flex', height: '10px', minWidth: '60px', background: 'var(--ln)', gap: '1px' }}
                          >
                            {arr(c.segs).map((sg: any, k: number) => (
                              <span
                                key={k}
                                style={{ height: '10px', width: sg.w, background: sg.c, transition: 'width 150ms var(--ease)' }}
                              />
                            ))}
                          </span>
                          <span style={{ flex: 'none', whiteSpace: 'nowrap', color: 'var(--tx-2)' }}>{c.v}</span>
                        </>
                      ) : null}
                      {c.isBtn ? (
                        <button
                          onClick={c.onClick}
                          aria-disabled={c.disabled}
                          data-tip={c.why}
                          style={{
                            height: '26px',
                            padding: '0 10px',
                            border: '1px solid var(--ln-2)',
                            font: '600 13px var(--f-body)',
                            whiteSpace: 'nowrap',
                            opacity: c.op,
                            transition: 'background-color 100ms'
                          }}
                          className={pc('hover', 'background:var(--hover)')}
                        >
                          {c.v}
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {v.chev ? (
                    <div role="cell" style={{ display: 'flex', justifyContent: 'center', color: 'var(--tx-3)' }}>
                      <Icon name="chevron-right" />
                    </div>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
          {v.isLoading ? (
            <>
              {arr(v.skel).map((sk: any, i: number) => (
                <div
                  key={i}
                  role="row"
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: v.grid,
                    alignItems: 'center',
                    height: v.rowH,
                    borderBottom: '1px solid var(--ln)',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  {arr(sk.cells).map((b: any, j: number) => (
                    <div key={j} style={{ padding: '0 8px', display: 'flex', justifyContent: b.jc }}>
                      <span style={{ display: 'block', height: '8px', width: b.w, background: 'var(--skel)' }} />
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : null}
          {v.showBlank ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '64px 24px',
                textAlign: 'center',
                animation: 'ae-fade 150ms var(--ease)'
              }}
            >
              <span style={{ font: '15px/22px var(--f-body)', color: 'var(--tx-2)', maxWidth: '440px', textWrap: 'pretty' }}>
                {v.blankText}
              </span>
              {v.blankAction ? (
                <button
                  onClick={v.onBlank}
                  aria-disabled={v.blankDisabled}
                  data-tip={v.blankWhy}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: v.blankBg,
                    color: v.blankFg,
                    border: `1px solid ${v.blankBd}`,
                    font: '600 14px var(--f-body)',
                    transition: 'background-color 100ms'
                  }}
                >
                  {v.blankAction}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '36px',
            padding: '0 12px',
            borderTop: '1px solid var(--ln)',
            fontSize: '12px',
            color: 'var(--tx-3)'
          }}
        >
          <span>{v.footL}</span>
          <span style={{ flex: 1 }} />
          <span>{v.footR}</span>
        </div>
      </div>
    );
  }
}
