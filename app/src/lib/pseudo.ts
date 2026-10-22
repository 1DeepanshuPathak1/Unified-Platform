/**
 * Pseudo-class styles for inline-styled elements.
 * `pc('hover', 'background:var(--hover)')` returns a class whose `:hover` rule carries
 * the declarations with `!important`, so it wins over the element's inline style.
 * Rules are generated once per (pseudo, css) pair and cached.
 */
const cache = new Map<string, string>();
let sheet: CSSStyleSheet | null = null;
let n = 0;

function splitDecls(css: string): string[] {
  const out: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ';' && depth === 0) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  out.push(css.slice(start));
  return out.map(d => d.trim()).filter(Boolean);
}

const importantify = (css: string) =>
  splitDecls(css)
    .map(d => (/!\s*important$/i.test(d) ? d : d + ' !important'))
    .join(';');

export function pc(pseudo: string, css: string): string {
  const key = pseudo + '|' + css;
  const hit = cache.get(key);
  if (hit) return hit;
  if (!sheet) {
    const el = document.createElement('style');
    el.setAttribute('data-aegis-pseudo', '');
    document.head.appendChild(el);
    sheet = el.sheet!;
  }
  const cls = 'ae-p' + (n++).toString(36);
  const element = pseudo === 'before' || pseudo === 'after';
  const sel = element ? `.${cls}::${pseudo}` : `.${cls}:${pseudo}`;
  try {
    sheet.insertRule(`${sel}{${element ? css : importantify(css)}}`, sheet.cssRules.length);
  } catch {
    // An unparseable declaration list leaves the class without a rule, like an invalid inline style.
  }
  cache.set(key, cls);
  return cls;
}
