import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { STYLES, STYLE_ORDER, type Frame, type StyleInfo, type UiStyle } from '../lib/uiStyle';
import { Btn } from '../ui/controls';
import { Dialog } from '../ui/overlay';

/** One shape of a layout drawing. Each gets its own key so the drawing's lists render cleanly. */
let shapeKey = 0;
const box = (s: CSSProperties): ReactNode => <span key={shapeKey++} aria-hidden style={{ position: 'absolute', display: 'block', ...s }} />;

/** Lines standing in for text: a column of short bars. */
const lines = (left: string, top: number, n: number, w: number, c: string, gap = 7) =>
  Array.from({ length: n }, (_, i) => box({ left, top: top + i * gap, width: `${w - (i % 3) * 6}%`, height: 3, borderRadius: 2, background: c, opacity: 0.55 }));

/** A drawing of each style's frame, so the choice can be made by eye. */
function Preview({ frame, sw }: { frame: Frame; sw: StyleInfo['sw'] }) {
  const card = (l: string, t: number, w: string, h: number, r = 3, extra: CSSProperties = {}) => box({ left: l, top: t, width: w, height: h, background: sw.card, border: `1px solid ${sw.line}`, borderRadius: r, ...extra });
  const parts: Record<Frame, ReactNode> = {
    topbar: (
      <>
        {box({ inset: '0 0 auto 0', height: 12, background: sw.top })}
        {box({ left: 0, top: 12, bottom: 0, width: '24%', background: sw.side, borderRight: `1px solid ${sw.line}` })}
        {lines('4%', 22, 8, 14, sw.ink)}
        {box({ left: '3%', top: 35, width: '18%', height: 6, borderRadius: 2, background: sw.acc, opacity: 0.25 })}
        {card('28%', 20, '20%', 22)}
        {card('51%', 20, '20%', 22)}
        {card('74%', 20, '22%', 22)}
        {card('28%', 48, '68%', 58)}
      </>
    ),
    column: (
      <>
        {box({ left: 0, top: 0, bottom: 0, width: '22%', background: sw.side })}
        {box({ left: '3%', top: 5, width: '12%', height: 4, background: '#fff', opacity: 0.8 })}
        {lines('3%', 20, 9, 14, '#ffffff')}
        {box({ left: 0, top: 33, width: '22%', height: 7, background: '#ffffff', opacity: 0.12, borderLeft: `2px solid ${sw.acc}` })}
        {box({ left: '22%', right: 0, top: 0, height: 11, background: sw.top, borderBottom: `1px solid ${sw.line}` })}
        {box({ left: '22%', right: 0, top: 11, height: 26, background: '#ffffff', borderBottom: `1px solid ${sw.line}` })}
        {box({ left: '26%', top: 17, width: '28%', height: 6, background: sw.ink, opacity: 0.6 })}
        {card('26%', 44, '22%', 22, 0, { borderTop: `2px solid ${sw.acc}` })}
        {card('50%', 44, '22%', 22, 0, { borderTop: `2px solid ${sw.acc}` })}
        {card('74%', 44, '22%', 22, 0, { borderTop: `2px solid ${sw.acc}` })}
        {card('26%', 72, '70%', 36, 0)}
      </>
    ),
    topnav: (
      <>
        {box({ inset: '0 0 auto 0', height: 12, background: sw.top })}
        {box({ left: 0, right: 0, top: 12, height: 10, background: sw.top, borderBottom: `1px solid ${sw.line}` })}
        {[8, 20, 32, 44, 56].map((l, i) => box({ left: `${l}%`, top: 15, width: '9%', height: 4, borderRadius: 3, background: i === 1 ? sw.acc : sw.ink, opacity: i === 1 ? 0.9 : 0.35 }))}
        {box({ left: '12%', top: 30, width: '30%', height: 6, borderRadius: 3, background: sw.ink, opacity: 0.6 })}
        {card('12%', 42, '24%', 22, 8, { boxShadow: '0 2px 6px rgba(30,27,75,.08)' })}
        {card('38%', 42, '24%', 22, 8, { boxShadow: '0 2px 6px rgba(30,27,75,.08)' })}
        {card('64%', 42, '24%', 22, 8, { boxShadow: '0 2px 6px rgba(30,27,75,.08)' })}
        {card('12%', 70, '76%', 38, 8, { boxShadow: '0 2px 6px rgba(30,27,75,.08)' })}
      </>
    ),
    rail: (
      <>
        {box({ left: 0, top: 0, bottom: 0, width: '7%', background: sw.side })}
        {[14, 26, 38, 50, 62].map((t, i) => box({ left: '2%', top: t, width: '3%', height: 6, borderRadius: 1, background: i === 2 ? sw.acc : '#8a9099', opacity: i === 2 ? 1 : 0.5 }))}
        {box({ left: '7%', right: 0, top: 0, height: 9, background: sw.top, borderBottom: `1px solid ${sw.line}` })}
        {card('10%', 14, '28%', 16, 0)}
        {card('40%', 14, '28%', 16, 0)}
        {card('70%', 14, '27%', 16, 0)}
        {card('10%', 34, '87%', 62, 0)}
        {Array.from({ length: 8 }, (_, i) => box({ left: '12%', right: '5%', top: 40 + i * 7, height: 1, background: sw.line }))}
        {box({ left: '13%', top: 38, width: '5%', height: 3, background: sw.acc })}
        {box({ left: 0, right: 0, bottom: 0, height: 8, background: sw.side, borderTop: `1px solid ${sw.line}` })}
        {box({ left: '9%', bottom: 2, width: '4%', height: 3, borderRadius: 2, background: '#3ecf8e' })}
        {box({ right: '4%', bottom: 2, width: '12%', height: 3, borderRadius: 2, background: sw.acc })}
      </>
    ),
    index: (
      <>
        {box({ left: '4%', right: '4%', top: 10, height: 1, background: sw.ink, opacity: 0.6 })}
        {box({ left: '4%', right: '4%', top: 12, height: 1, background: sw.ink, opacity: 0.6 })}
        {box({ left: '40%', top: 3, width: '20%', height: 4, background: sw.ink, opacity: 0.7 })}
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>
            {box({ left: '5%', top: 22 + i * 9, width: '3%', height: 3, background: sw.acc, opacity: 0.8 })}
            {box({ left: '10%', top: 22 + i * 9, width: `${10 - (i % 3) * 2}%`, height: 3, background: sw.ink, opacity: 0.45 })}
          </span>
        ))}
        {box({ left: '27%', top: 18, bottom: 6, width: 1, background: sw.line })}
        {box({ left: '33%', top: 22, width: '36%', height: 8, background: sw.ink, opacity: 0.75 })}
        {lines('33%', 36, 3, 55, sw.ink, 6)}
        {box({ left: '33%', right: '8%', top: 58, height: 1, background: sw.ink, opacity: 0.5 })}
        {Array.from({ length: 5 }, (_, i) => box({ left: '33%', right: '8%', top: 66 + i * 8, height: 1, background: sw.line }))}
      </>
    ),
    inset: (
      <>
        {box({ left: '3%', top: 6, bottom: 6, width: '20%', background: sw.side, borderRadius: 8, border: '1px solid rgba(255,255,255,.8)', boxShadow: '0 4px 12px rgba(80,60,160,.12)' })}
        {lines('6%', 18, 8, 12, sw.ink)}
        {box({ left: '5%', top: 31, width: '16%', height: 6, borderRadius: 4, background: sw.acc, opacity: 0.85 })}
        {box({ left: '26%', right: '3%', top: 6, height: 12, background: sw.top, borderRadius: 8, border: '1px solid rgba(255,255,255,.8)' })}
        {card('26%', 24, '22%', 24, 8, { border: '1px solid rgba(255,255,255,.85)' })}
        {card('50%', 24, '22%', 24, 8, { border: '1px solid rgba(255,255,255,.85)' })}
        {card('74%', 24, '23%', 24, 8, { border: '1px solid rgba(255,255,255,.85)' })}
        {card('26%', 54, '71%', 54, 8, { border: '1px solid rgba(255,255,255,.85)' })}
      </>
    ),
    twolevel: (
      <>
        {box({ left: 0, top: 0, bottom: 0, width: '7%', background: '#26221d' })}
        {[8, 22, 34, 46].map((t, i) => box({ left: '2%', top: t, width: '3%', height: 6, borderRadius: 2, background: i === 1 ? sw.acc : '#ffffff', opacity: i === 1 ? 1 : 0.45 }))}
        {box({ left: '7%', top: 0, bottom: 0, width: '19%', background: sw.side, borderRight: `1px solid ${sw.line}` })}
        {box({ left: '9%', top: 6, width: '12%', height: 5, background: sw.ink, opacity: 0.7 })}
        {lines('9%', 18, 9, 12, sw.ink)}
        {box({ left: '26%', right: 0, top: 0, height: 11, background: sw.top, borderBottom: `1px solid ${sw.line}` })}
        {card('29%', 18, '68%', 90, 4)}
        {Array.from({ length: 5 }, (_, i) => box({ left: '29.4%', right: '3.4%', top: 30 + i * 14, height: 7, background: i % 2 ? '#f3f2f0' : 'transparent' }))}
        {box({ left: '29.4%', right: '3.4%', top: 18, height: 1.5, background: sw.acc })}
      </>
    )
  };
  return (
    <span aria-hidden style={{ position: 'relative', display: 'block', height: 116, overflow: 'hidden', background: sw.bg, borderBottom: '1px solid var(--ln)' }}>
      {parts[frame]}
    </span>
  );
}

/** Choose one of the site's designs. Picking one applies it at once, so the dialog itself changes; Done closes. */
export function StylePicker({ value, onPick, closing, onClose }: { value: UiStyle; onPick: (s: UiStyle) => void; closing: boolean; onClose: () => void }) {
  return (
    <Dialog
      size="xl"
      title="Switch styles"
      sub="Seven complete designs for the same console. Each has its own layout, typeface and look, in light and dark. Your choice is kept in this browser."
      closing={closing}
      onClose={onClose}
      bodyStyle={{ maxWidth: 'none' }}
      footer={<Btn kind="primary" icon="check" onClick={onClose}>Done</Btn>}
      footNote={<span>Now: {STYLES[value].name} · {STYLES[value].frameLabel}</span>}
    >
      <div role="radiogroup" aria-label="Styles" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
        {STYLE_ORDER.map(id => {
          const s = STYLES[id];
          const on = id === value;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${s.name}: ${s.frameLabel}`}
              onClick={() => onPick(id)}
              className={on ? undefined : pc('hover', 'border-color:var(--ln-2)')}
              style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden', background: 'var(--panel)', border: `1px solid ${on ? 'var(--acc)' : 'var(--ln)'}`, boxShadow: on ? '0 0 0 1px var(--acc)' : 'none', borderRadius: 'var(--r)', transition: 'border-color 100ms, box-shadow 100ms' }}
            >
              <Preview frame={s.frame} sw={s.sw} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px 12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: '600 14px/20px var(--f-head)', flex: 1 }}>{s.name}</span>
                  {on ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '500 12px var(--f-ui)', color: 'var(--acc-tx)' }}>
                      <Icon name="check" /> In use
                    </span>
                  ) : null}
                </span>
                <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{s.frameLabel} · {s.font}</span>
                <span style={{ font: '12px/17px var(--f-body)', color: 'var(--tx-3)' }}>{s.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
