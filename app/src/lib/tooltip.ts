/**
 * Themed tooltips for any element with `data-tip="…"`: shown after 350 ms on hover and
 * 150 ms on keyboard focus. Add `data-tip-overflow` to show it only when the text is truncated.
 */
export function installTooltips() {
  const w = window as unknown as { __aeTip?: number };
  if (w.__aeTip) return;
  w.__aeTip = 1;
  let tip: HTMLDivElement | null = null;
  let timer: number | undefined;
  let cur: Element | null = null;

  const ensure = () => {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.setAttribute('role', 'tooltip');
    tip.style.cssText =
      'position:fixed;z-index:9999;left:0;top:0;max-width:320px;padding:6px 10px;font:12px/16px Tahoma,Verdana,sans-serif;pointer-events:none;opacity:0;transform:translateY(2px);transition:opacity 100ms,transform 100ms;white-space:normal';
    document.body.appendChild(tip);
    return tip;
  };
  const show = (el: HTMLElement) => {
    const t = el.getAttribute('data-tip');
    if (!t) return;
    if (el.hasAttribute('data-tip-overflow') && el.scrollWidth <= el.clientWidth) return;
    const T = ensure();
    const root = el.closest('[data-ae]');
    const cs = root ? getComputedStyle(root) : null;
    T.style.background = cs ? cs.getPropertyValue('--tip-bg') : '#222';
    T.style.color = cs ? cs.getPropertyValue('--tip-tx') : '#fff';
    T.style.boxShadow = '0 4px 16px rgba(0,0,0,.22)';
    T.textContent = t;
    const r = el.getBoundingClientRect();
    const tw = T.offsetWidth;
    const th = T.offsetHeight;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), innerWidth - tw - 8);
    let y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    T.style.left = x + 'px';
    T.style.top = y + 'px';
    requestAnimationFrame(() => {
      T.style.opacity = '1';
      T.style.transform = 'none';
    });
    cur = el;
  };
  const hide = () => {
    clearTimeout(timer);
    if (tip) {
      tip.style.opacity = '0';
      tip.style.transform = 'translateY(2px)';
    }
    cur = null;
  };
  const tipTarget = (e: Event) => (e.target as Element | null)?.closest?.('[data-tip]') as HTMLElement | null;

  document.addEventListener(
    'pointerover',
    e => {
      const el = tipTarget(e);
      if (el === cur) return;
      hide();
      if (el) timer = window.setTimeout(() => show(el), 350);
    },
    true
  );
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('focusin', e => {
    const el = tipTarget(e);
    hide();
    if (el && el.matches(':focus-visible')) timer = window.setTimeout(() => show(el), 150);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hide();
  });
}
