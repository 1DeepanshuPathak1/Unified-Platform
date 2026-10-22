/* Ported from project/AegisReports.dc.html */
import { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';

export default class AegisReports extends DC {
  state: any = { sel: {}, gen: false };
  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    if (!A || !ctx) return { list: [], r: { figures: [], facts: [] } };
    const p = ctx.product;
    const reps = A.reports[p];
    const sel = this.state.sel[p] || reps[0].id;
    const r = reps.find(x => x.id === sel);
    const cfg = ctx.can('configure', 'Scheduling a report');
    const op = ctx.can('operate', 'Generating a report');
    return {
      productLabel: { backup: 'Backup & Recovery', dr: 'Disaster Recovery', mig: 'Migration' }[p],
      cfgDis: cfg.dis,
      cfgWhy: cfg.why,
      cfgOp: cfg.op,
      opDis: op.dis,
      opWhy: op.why,
      opOp: op.op,
      create: () => {
        if (cfg.ok) ctx.toast('Pick a report type, schedule and recipients to schedule it', 'info');
      },
      list: reps.map(x => ({
        ...x,
        current: x.id === sel ? 'page' : undefined,
        bg: x.id === sel ? 'var(--acc-soft)' : 'transparent',
        onClick: () => this.setState(st => ({ sel: { ...st.sel, [p]: x.id } }))
      })),
      r: {
        name: r.name,
        last: r.last,
        figures: r.figures.map(([k, v], i) => ({ k, v, bl: i ? 'var(--ln)' : 'transparent' })),
        facts: [
          { k: 'Schedule', v: r.schedule },
          { k: 'Format', v: r.format },
          { k: 'Recipients', v: r.to },
          { k: 'Covers', v: ctx.project }
        ]
      },
      genIcon: this.state.gen ? 'loader-circle' : 'refresh-cw',
      genSpin: this.state.gen ? 'true' : 'false',
      generate: () => {
        if (!op.ok || this.state.gen) return;
        this.setState({ gen: true });
        setTimeout(() => {
          this.setState({ gen: false });
          ctx.toast(`${r.name} generated and sent to ${r.to}`, 'ok');
        }, 1300);
      },
      download: () => ctx.toast(`${r.name} (${r.format}) downloaded`, 'ok')
    };
  }

  render() {
    const v = this.vals();
    return (
      <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
        <div style={{ flex: 'none', padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>
              Operations · <span>{v.productLabel}</span>
            </div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Reports</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>
              Scheduled summaries for <span>{v.productLabel}</span>. Switch product in the header for the others.
            </p>
          </div>
          <button
            onClick={v.create}
            aria-disabled={v.cfgDis}
            data-tip={v.cfgWhy}
            style={{
              height: '32px',
              padding: '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--acc)',
              color: 'var(--acc-ink)',
              fontWeight: 600,
              opacity: v.cfgOp
            }}
            className={pc('hover', 'background:var(--acc-h)')}
          >
            <Icon name="plus" />
            Schedule a report
          </button>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: '0 24px 24px',
            display: 'grid',
            gridTemplateColumns: '340px minmax(0,1fr)',
            gap: '16px'
          }}
        >
          <nav aria-label="Reports" style={{ overflow: 'auto', background: 'var(--panel)', border: '1px solid var(--ln)' }}>
            <Ind mode="rail" style={{ display: 'flex', flexDirection: 'column' }}>
              {arr(v.list).map((r: any, i: number) => (
                <button
                  key={i}
                  aria-current={r.current}
                  onClick={r.onClick}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--ln)',
                    background: r.bg,
                    textAlign: 'left',
                    transition: 'background-color 100ms'
                  }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                    <span>{r.schedule}</span> · <span>{r.format}</span>
                  </span>
                </button>
              ))}
            </Ind>
          </nav>
          <section
            style={{
              minHeight: 0,
              overflow: 'auto',
              background: 'var(--panel)',
              border: '1px solid var(--ln)',
              animation: 'ae-fade 150ms var(--ease)'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ln)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ font: '500 20px/28px var(--f-head)' }}>{v.r?.name}</h2>
                <p style={{ marginTop: '2px', font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>
                  Last generated <span>{v.r?.last}</span>
                </p>
              </div>
              <button
                onClick={v.download}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--ln-2)',
                  fontWeight: 600
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="download" />
                Download
              </button>
              <button
                onClick={v.generate}
                aria-disabled={v.opDis}
                data-tip={v.opWhy}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--acc)',
                  color: 'var(--acc-ink)',
                  fontWeight: 600,
                  opacity: v.opOp
                }}
                className={pc('hover', 'background:var(--acc-h)')}
              >
                <Icon name={v.genIcon} spin={v.genSpin} />
                Generate now
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', borderBottom: '1px solid var(--ln)' }}>
              {arr(v.r?.figures).map((f: any, i: number) => (
                <div
                  key={i}
                  style={{ padding: '16px 20px', borderLeft: `1px solid ${f.bl}`, display: 'flex', flexDirection: 'column', gap: '4px' }}
                >
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{f.k}</span>
                  <span style={{ font: '500 22px/30px var(--f-head)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {f.v}
                  </span>
                </div>
              ))}
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', padding: '0 20px', font: '13px/18px var(--f-ui)' }}>
              {arr(v.r?.facts).map((f: any, i: number) => (
                <Fragment key={i}>
                  <dt style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                  <dd style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)' }}>{f.v}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        </div>
      </div>
    );
  }
}
