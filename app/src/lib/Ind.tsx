import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

const EASE = 'cubic-bezier(.2,.7,.3,1)';
const SELECTED = '[aria-selected="true"],[aria-current="page"],[aria-checked="true"],[aria-pressed="true"]';

type IndProps = HTMLAttributes<HTMLDivElement> & {
  /** underline: 2 px bar under the item; rail: 2 px bar on its left; fill: a block behind it. */
  mode?: 'underline' | 'fill' | 'rail' | string;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * Slides one indicator to the child marked aria-selected, aria-current="page",
 * aria-checked or aria-pressed. Used by tabs, segmented controls and the navigation.
 */
export function Ind({ mode = 'underline', style, className, children, ...rest }: IndProps) {
  const host = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const el = host.current!;
    const i = ind.current!;
    let first = true;
    const place = (instant: boolean) => {
      const sel = el.querySelector(SELECTED);
      if (!sel) {
        i.style.opacity = '0';
        return;
      }
      const hr = el.getBoundingClientRect();
      const r = sel.getBoundingClientRect();
      const sc = el.offsetWidth ? hr.width / el.offsetWidth : 1;
      const x = (r.left - hr.left) / sc + el.scrollLeft;
      const y = (r.top - hr.top) / sc + el.scrollTop;
      const w = r.width / sc;
      const h = r.height / sc;
      const m = modeRef.current;
      i.style.transition = instant || first ? 'none' : `transform 150ms ${EASE}, width 150ms ${EASE}, height 150ms ${EASE}, opacity 100ms`;
      if (m === 'underline') {
        i.style.width = w + 'px';
        i.style.height = '2px';
        i.style.transform = `translate(${x}px,${y + h - 2}px)`;
        i.style.background = 'var(--acc)';
      } else if (m === 'rail') {
        i.style.width = '2px';
        i.style.height = h + 'px';
        i.style.transform = `translate(${x}px,${y}px)`;
        i.style.background = 'var(--acc)';
      } else {
        i.style.width = w + 'px';
        i.style.height = h + 'px';
        i.style.transform = `translate(${x}px,${y}px)`;
        i.style.background = 'var(--ind-fill, var(--acc-soft))';
        i.style.boxShadow = 'var(--ind-ring, none)';
      }
      i.style.opacity = '1';
      first = false;
    };
    const mo = new MutationObserver(() => place(false));
    mo.observe(el, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-selected', 'aria-current', 'aria-checked', 'aria-pressed']
    });
    const ro = new ResizeObserver(() => place(true));
    ro.observe(el);
    const raf = requestAnimationFrame(() => place(true));
    return () => {
      mo.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      {...rest}
      ref={host}
      className={className ? `ae-ind ${className}` : 'ae-ind'}
      style={{ position: 'relative', isolation: 'isolate', ...style }}
    >
      {children}
      <div ref={ind} className="ae-ind-i" aria-hidden="true" />
    </div>
  );
}
