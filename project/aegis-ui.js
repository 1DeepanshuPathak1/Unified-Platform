/* Host360 Aegis — small UI primitives.
   <ae-ind mode="underline|fill|rail">: slides one indicator to the child marked aria-selected / aria-current / aria-checked / aria-pressed.
   [data-tip="…"]: themed tooltip on hover and keyboard focus. Add data-tip-overflow to show it only when the text is truncated. */
(function () {
  if (!customElements.get('ae-ind')) {
    const EASE = 'cubic-bezier(.2,.7,.3,1)';
    class AeInd extends HTMLElement {
      constructor() {
        super();
        const r = this.attachShadow({ mode: 'open' });
        r.innerHTML = '<style>:host{position:relative;isolation:isolate}::slotted(*){position:relative;z-index:1}.i{position:absolute;left:0;top:0;z-index:0;pointer-events:none;opacity:0}</style><slot></slot><div class="i"></div>';
        this.i = r.querySelector('.i');
        this.first = true;
      }
      connectedCallback() {
        this.mo = new MutationObserver(() => this.place(false));
        this.mo.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'aria-current', 'aria-checked', 'aria-pressed'] });
        this.ro = new ResizeObserver(() => this.place(true));
        this.ro.observe(this);
        requestAnimationFrame(() => this.place(true));
      }
      disconnectedCallback() { this.mo && this.mo.disconnect(); this.ro && this.ro.disconnect(); }
      place(instant) {
        const sel = this.querySelector('[aria-selected="true"],[aria-current="page"],[aria-checked="true"],[aria-pressed="true"]');
        const i = this.i;
        if (!sel) { i.style.opacity = '0'; return; }
        const hr = this.getBoundingClientRect(), r = sel.getBoundingClientRect();
        const sc = this.offsetWidth ? hr.width / this.offsetWidth : 1;
        const x = (r.left - hr.left) / sc + this.scrollLeft, y = (r.top - hr.top) / sc + this.scrollTop;
        const w = r.width / sc, h = r.height / sc;
        const m = this.getAttribute('mode') || 'underline';
        i.style.transition = instant || this.first ? 'none' : `transform 150ms ${EASE}, width 150ms ${EASE}, height 150ms ${EASE}, opacity 100ms`;
        if (m === 'underline') { i.style.width = w + 'px'; i.style.height = '2px'; i.style.transform = `translate(${x}px,${y + h - 2}px)`; i.style.background = 'var(--acc)'; }
        else if (m === 'rail') { i.style.width = '2px'; i.style.height = h + 'px'; i.style.transform = `translate(${x}px,${y}px)`; i.style.background = 'var(--acc)'; }
        else { i.style.width = w + 'px'; i.style.height = h + 'px'; i.style.transform = `translate(${x}px,${y}px)`; i.style.background = 'var(--ind-fill, var(--acc-soft))'; i.style.boxShadow = 'var(--ind-ring, none)'; }
        i.style.opacity = '1';
        this.first = false;
      }
    }
    customElements.define('ae-ind', AeInd);
  }

  if (!window.__aeTip) {
    window.__aeTip = 1;
    let tip, timer, cur;
    const ensure = () => {
      if (tip) return tip;
      tip = document.createElement('div');
      tip.setAttribute('role', 'tooltip');
      tip.style.cssText = 'position:fixed;z-index:9999;left:0;top:0;max-width:320px;padding:6px 10px;font:12px/16px Tahoma,Verdana,sans-serif;pointer-events:none;opacity:0;transform:translateY(2px);transition:opacity 100ms,transform 100ms;white-space:normal';
      document.body.appendChild(tip);
      return tip;
    };
    const show = el => {
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
      const r = el.getBoundingClientRect(), w = T.offsetWidth, h = T.offsetHeight;
      const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
      let y = r.top - h - 8; if (y < 8) y = r.bottom + 8;
      T.style.left = x + 'px'; T.style.top = y + 'px';
      requestAnimationFrame(() => { T.style.opacity = '1'; T.style.transform = 'none'; });
      cur = el;
    };
    const hide = () => { clearTimeout(timer); if (tip) { tip.style.opacity = '0'; tip.style.transform = 'translateY(2px)'; } cur = null; };
    document.addEventListener('pointerover', e => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el === cur) return;
      hide();
      if (el) timer = setTimeout(() => show(el), 350);
    }, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('focusin', e => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      hide();
      if (el && el.matches(':focus-visible')) timer = setTimeout(() => show(el), 150);
    });
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  }
})();
