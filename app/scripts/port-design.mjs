// Re-ports the Claude Design handoff in ../project into src/.
//
//   npm run port            (writes src/, then run `npm run typecheck`)
//
// Each `.dc.html` file is a template plus a `DCLogic` class. The template becomes JSX
// with inline style objects, the class becomes a React class component (see src/lib/dc.ts),
// and the shared scripts (data, spec, icons, tokens) become ES modules. FIXUPS at the end
// re-applies the hand edits made after the first port, so a re-port reproduces src/ exactly.
// Files it writes are overwritten: make lasting changes in the design, or add them to FIXUPS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFragment } from 'parse5';
import prettier from 'prettier';
import * as acorn from 'acorn';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(APP, '../project');
const OUT = path.join(APP, 'src');

// dc-import name -> [component class, output path under src/]
const MAP = {
  'Aegis Mockup': ['App', 'App.tsx'],
  'Aegis Console': ['AegisConsole', 'pages/AegisConsole.tsx'],
  'Aegis Design System': ['AegisDesignSystem', 'pages/AegisDesignSystem.tsx'],
  'Aegis Handoff': ['AegisHandoff', 'pages/AegisHandoff.tsx'],
  AegisTable: ['AegisTable', 'components/AegisTable.tsx']
};
for (const n of [
  'AegisSites',
  'AegisGuests',
  'AegisDrServers',
  'AegisMigServers',
  'AegisList',
  'AegisOverview',
  'AegisRecovery',
  'AegisProtPlans',
  'AegisMappings',
  'AegisAccess',
  'AegisSettings',
  'AegisReports',
  'AegisRestore'
])
  MAP[n] = [n, `screens/${n}.tsx`];
// Early shell explorations; not part of the console.
const SKIP = new Set(['Aegis Directions']);

// ---- parsing, as the design runtime does it ----
const CAMEL = 'sc-camel-';
const RAW_WRAP = {
  select: 'sc-raw-select',
  table: 'sc-raw-table',
  tbody: 'sc-raw-tbody',
  thead: 'sc-raw-thead',
  tfoot: 'sc-raw-tfoot',
  tr: 'sc-raw-tr',
  td: 'sc-raw-td',
  th: 'sc-raw-th',
  caption: 'sc-raw-caption'
};
const RAW_UNWRAP = Object.fromEntries(Object.entries(RAW_WRAP).map(([k, v]) => [v, k]));
function encodeCase(html) {
  html = html.replace(/<(x-import|dc-import)((?:[^>"']|"[^"]*"|'[^']*')*)\/>/gi, (_, t, a) => `<${t}${a}></${t}>`);
  html = html.replace(
    /(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g,
    (_, sp, name, eq) => sp + CAMEL + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + eq
  );
  for (const [real, alias] of Object.entries(RAW_WRAP)) html = html.replace(new RegExp('(</?)' + real + '(?=[\\s>])', 'gi'), '$1' + alias);
  return html;
}
const kebabToCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// ---- {{ bindings }} -> expressions on the view model `v` or a loop variable ----
let scopes = [];
const idxStack = [];
function pathExpr(src) {
  const e = src.trim();
  if (e === 'true' || e === 'false' || e === 'null' || e === 'undefined' || /^-?\d+(\.\d+)?$/.test(e)) return e;
  if (/^(['"]).*\1$/.test(e)) return JSON.stringify(e.slice(1, -1));
  if (e.startsWith('!')) return '!' + pathExpr(e.slice(1));
  if (!/^[A-Za-z_$][\w$]*(\.[\w$]+)*$/.test(e)) throw new Error('Unsupported binding: ' + e);
  const parts = e.split('.');
  const local = scopes.includes(parts[0]);
  const head = local ? parts[0] : 'v.' + parts[0];
  return (
    head +
    parts
      .slice(1)
      .map((p, i) => (/^\d+$/.test(p) ? `?.[${p}]` : (i === 0 && local ? '.' : '?.') + p))
      .join('')
  );
}
const INTERP = /\{\{([\s\S]+?)\}\}/g;
const whole = raw => {
  const m = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
  return m ? m[1] : null;
};
const tplEscape = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
function tplLiteral(raw, fallback) {
  const parts = raw.split(INTERP);
  return '`' + parts.map((p, i) => (i & 1 ? '${' + pathExpr(p) + (fallback ? " ?? ''" : '') + '}' : tplEscape(p))).join('') + '`';
}
function attrValue(raw, opts = {}) {
  const w = whole(raw);
  if (w != null) return '{' + pathExpr(w) + (opts.def ? ` ?? ${opts.def}` : '') + '}';
  if (raw.includes('{{')) return '{' + tplLiteral(raw, true) + '}';
  if (/["\n\\{}]/.test(raw)) return '{' + JSON.stringify(raw) + '}';
  return '"' + raw + '"';
}
const UNITLESS = new Set(['flex', 'flexGrow', 'flexShrink', 'zIndex', 'opacity', 'fontWeight', 'order', 'lineHeight']);
function styleObj(raw) {
  const w = whole(raw);
  if (w != null) return `css(${pathExpr(w)})`;
  const decls = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw.startsWith('{{', i)) {
      const j = raw.indexOf('}}', i);
      cur += raw.slice(i, j + 2);
      i = j + 1;
      continue;
    }
    const c = raw[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === ';' && depth === 0) {
      decls.push(cur);
      cur = '';
    } else cur += c;
  }
  decls.push(cur);
  const props = new Map(); // first position, last value, as the runtime's cssToObj
  for (const d of decls) {
    if (!d.trim()) continue;
    const i = d.indexOf(':');
    if (i < 0 || d.slice(0, i).includes('{{')) return `css(${tplLiteral(raw, true)})`;
    const prop = d.slice(0, i).trim();
    const val = d.slice(i + 1).trim();
    const key = prop.startsWith('--') ? JSON.stringify(prop) : /^-?[a-z][a-z-]*$/.test(prop) ? kebabToCamel(prop) : JSON.stringify(prop);
    const vw = whole(val);
    const num = /^-?\d+(\.\d+)?$/.test(val) && (val === '0' || UNITLESS.has(key));
    props.set(key, vw != null ? pathExpr(vw) : val.includes('{{') ? tplLiteral(val, false) : num ? String(+val) : JSON.stringify(val));
  }
  return '{ ' + [...props].map(([k, v]) => `${k}: ${v}`).join(', ') + ' }';
}

// ---- template -> JSX ----
const EVENT_MAP = {
  onclick: 'onClick',
  onchange: 'onChange',
  oninput: 'onInput',
  onkeydown: 'onKeyDown',
  onmouseenter: 'onMouseEnter',
  onmouseleave: 'onMouseLeave',
  onfocus: 'onFocus',
  onblur: 'onBlur'
};
const DOM_ATTR = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  inputmode: 'inputMode',
  autocomplete: 'autoComplete',
  maxlength: 'maxLength',
  crossorigin: 'crossOrigin',
  spellcheck: 'spellCheck',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  'stroke-width': 'strokeWidth',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-linecap': 'strokeLinecap'
};
const BOOL_ATTR = new Set(['readOnly', 'disabled', 'checked', 'selected', 'hidden', 'autoFocus', 'multiple', 'required']);
const NUM_ATTR = new Set(['rows', 'cols', 'tabIndex', 'maxLength', 'colSpan', 'rowSpan']);
const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'col', 'source']);
const used = new Set();
const imports = new Set();

const attrName = a => (a.name.startsWith(CAMEL) ? kebabToCamel(a.name.slice(CAMEL.length)) : a.name);

function literalText(t) {
  const lead = /^\s/.test(t);
  const trail = /\s$/.test(t);
  const core = t.replace(/\s+/g, ' ').trim();
  if (!core) return '{" "}';
  const body = /[{}<>&"]/.test(core) ? `{${JSON.stringify(core)}}` : core;
  return (lead ? '{" "}' : '') + body + (trail ? '{" "}' : '');
}
function textJsx(txt) {
  if (!txt.includes('{{')) {
    if (!txt.trim()) return txt.includes(' ') ? '{" "}' : '';
    return literalText(txt);
  }
  // The runtime renders each binding in its own <span> when it shares a text node.
  const parts = txt.split(INTERP);
  const lone = parts.filter((p, i) => i & 1 || p !== '').length === 1;
  return parts
    .map((p, i) => (i & 1 ? (lone ? `{${pathExpr(p)}}` : `<span>{${pathExpr(p)}}</span>`) : p === '' ? '' : literalText(p)))
    .join('');
}

const pieces = node => node.childNodes.map(walk).filter(Boolean);
const walkChildren = node => pieces(node).join('');
const singleEl = ps => ps.length === 1 && /^<[A-Za-z]/.test(ps[0]);

function walk(node) {
  if (node.nodeName === '#text') return textJsx(node.value);
  if (node.nodeName === '#comment') return '';
  const tag = node.tagName;
  const attrs = node.attrs || [];
  const get = n => attrs.find(x => attrName(x) === n)?.value ?? null;
  if (['template', 'helmet', 'sc-helmet', 'script', 'link', 'meta'].includes(tag)) return '';
  if (tag === 'sc-if') {
    const cond = pathExpr(whole(get('value')));
    const ps = pieces(node);
    return singleEl(ps) ? `{${cond} ? (${ps[0]}) : null}` : `{${cond} ? (<>${ps.join('')}</>) : null}`;
  }
  if (tag === 'sc-for') {
    const list = pathExpr(whole(get('list')));
    const as = get('as') || 'item';
    const taken = new Set([...scopes, as, ...idxStack]);
    const idx = ['i', 'j', 'k', 'n', 'i2', 'i3', 'i4'].find(x => !taken.has(x));
    scopes.push(as);
    idxStack.push(idx);
    const ps = pieces(node);
    scopes.pop();
    idxStack.pop();
    used.add('arr');
    if (singleEl(ps))
      return `{arr(${list}).map((${as}: any, ${idx}: number) => (${ps[0].replace(/^<([A-Za-z][\w.]*)/, `<$1 key={${idx}}`)}))}`;
    used.add('Fragment');
    return `{arr(${list}).map((${as}: any, ${idx}: number) => (<Fragment key={${idx}}>${ps.join('')}</Fragment>))}`;
  }
  if (tag === 'dc-import') {
    const name = get('name');
    if (!MAP[name]) throw new Error('Unknown import ' + name);
    imports.add(name);
    const props = [];
    let hostStyle = null;
    for (const a of attrs) {
      const n = attrName(a);
      if (n === 'name' || n === 'hint-size') continue;
      // The import's style sizes its host box (flex:1 so the screen or table fills its column).
      if (n === 'style') hostStyle = a.value.trim() ? styleObj(a.value) : null;
      else props.push(`${n.includes('-') ? kebabToCamel(n) : n}=${attrValue(a.value)}`);
    }
    const inner = `<${MAP[name][0]} ${props.join(' ')} />`;
    return hostStyle ? `<div style={${hostStyle}}>${inner}</div>` : `<div>${inner}</div>`;
  }
  let jsxTag = RAW_UNWRAP[tag] || tag;
  if (tag === 'ae-icon') used.add((jsxTag = 'Icon'));
  if (tag === 'ae-ind') used.add((jsxTag = 'Ind'));
  const isComp = jsxTag === 'Icon' || jsxTag === 'Ind';
  const out = [];
  const classes = [];
  const hasValue = attrs.some(a => attrName(a) === 'value');
  for (const a of attrs) {
    let n = attrName(a);
    const raw = a.value;
    if (n === 'style') out.push(`style={${styleObj(raw)}}`);
    else if (n.startsWith('style-')) {
      used.add('pc');
      classes.push(`pc(${JSON.stringify(n.slice(6))}, ${raw.includes('{{') ? tplLiteral(raw, false) : JSON.stringify(raw)})`);
    } else if (n === 'class') classes.unshift(raw.includes('{{') ? tplLiteral(raw, true) : JSON.stringify(raw));
    else if (n.startsWith('on')) {
      n = EVENT_MAP[n.toLowerCase()] || n;
      if (n === 'onInput' && (jsxTag === 'input' || jsxTag === 'textarea') && hasValue) n = 'onChange';
      out.push(`${n}=${attrValue(raw)}`);
    } else {
      if (!isComp && DOM_ATTR[n]) n = DOM_ATTR[n];
      if (BOOL_ATTR.has(n) && raw === '') out.push(n);
      else if (NUM_ATTR.has(n) && /^-?\d+$/.test(raw)) out.push(`${n}={${raw}}`);
      else if (n === 'value' && !isComp) out.push(`value=${attrValue(raw, { def: "''" })}`);
      else if (n === 'checked' && !isComp) out.push(`checked=${attrValue(raw, { def: 'false' })}`);
      else out.push(`${n}=${attrValue(raw)}`);
    }
  }
  if (classes.length === 1) out.push(`className={${classes[0]}}`);
  else if (classes.length > 1) out.push(`className={[${classes.join(', ')}].join(' ')}`);
  const open = `<${jsxTag}${out.length ? ' ' + out.join(' ') : ''}`;
  if (VOID.has(jsxTag)) return open + ' />';
  let kids;
  if (jsxTag === 'pre')
    kids = node.childNodes
      .map(c =>
        c.nodeName !== '#text'
          ? walk(c)
          : c.value
              .split(INTERP)
              .map((p, i) => (i & 1 ? `{${pathExpr(p)}}` : p ? `{${JSON.stringify(p)}}` : ''))
              .join('')
      )
      .join('');
  else if (jsxTag === 'style') kids = `{${JSON.stringify(node.childNodes.map(c => c.value || '').join(''))}}`;
  else kids = walkChildren(node);
  if (!kids && jsxTag !== 'textarea') return open + ' />';
  return `${open}>${kids}</${jsxTag}>`;
}

const fmt = code =>
  prettier.format(code, { parser: 'typescript', singleQuote: true, printWidth: 140, trailingComma: 'none', arrowParens: 'avoid' });

async function portComponent(file) {
  const name = path.basename(file).replace(/\.dc\.html$/, '');
  const [cls, outRel] = MAP[name];
  const src = fs.readFileSync(file, 'utf8');
  const tpl = src.slice(src.indexOf('<x-dc>') + 6, src.lastIndexOf('</x-dc>')).replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  let logic =
    src.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? 'class Component extends DCLogic {\n}\n';
  used.clear();
  imports.clear();
  scopes = [];
  const top = pieces(parseFragment(encodeCase(tpl))).filter(p => p !== '{" "}');
  const jsx = singleEl(top) ? top[0] : `<>${top.join('')}</>`;

  logic = logic
    .replace(/window\.AEGIS_ICON_NAMES\b/g, 'ICON_NAMES')
    .replace(/window\.AEGIS_SPEC\b/g, 'AEGIS_SPEC')
    .replace(/window\.AEGIS\b(?!_)/g, 'AEGIS')
    .replace(/class Component extends DCLogic \{/, `export default class ${cls} extends DC {`);
  const ast = acorn.parse(logic, { ecmaVersion: 'latest', sourceType: 'module' });
  const end = ast.body.find(n => n.type === 'ExportDefaultDeclaration').declaration.body.end - 1;
  logic = logic.slice(0, end) + `\n  render() {\n    const v = this.vals();\n    return (${jsx});\n  }\n` + logic.slice(end);
  logic = logic.replace(/React\.createRef\(\)/g, 'React.createRef<any>()');

  const up = '../'.repeat(outRel.split('/').length - 1) || './';
  const head = [];
  const def = /React\./.test(logic);
  const frag = used.has('Fragment');
  if (def || frag) head.push(`import ${[def ? 'React' : '', frag ? '{ Fragment }' : ''].filter(Boolean).join(', ')} from 'react';`);
  head.push(`import { DC${used.has('arr') ? ', arr' : ''}${/\bcss\(/.test(jsx) ? ', css' : ''} } from '${up}lib/dc';`);
  if (used.has('pc')) head.push(`import { pc } from '${up}lib/pseudo';`);
  const iconNames = [used.has('Icon') && 'Icon', /\bICON_NAMES\b/.test(logic) && 'ICON_NAMES'].filter(Boolean);
  if (iconNames.length) head.push(`import { ${iconNames.join(', ')} } from '${up}lib/Icon';`);
  if (used.has('Ind')) head.push(`import { Ind } from '${up}lib/Ind';`);
  if (/\bAEGIS\b/.test(logic.replace(/AEGIS_SPEC/g, ''))) head.push(`import { AEGIS } from '${up}data/aegis';`);
  if (/AEGIS_SPEC/.test(logic)) head.push(`import { AEGIS_SPEC } from '${up}data/spec';`);
  for (const n of imports) {
    let rel = path.relative(path.dirname(outRel), MAP[n][1].replace(/\.tsx$/, ''));
    if (!rel.startsWith('.')) rel = './' + rel;
    head.push(`import ${MAP[n][0]} from '${rel}';`);
  }
  write(outRel, await fmt(`/* Ported from project/${name}.dc.html */\n${head.join('\n')}\n\n${logic.trim()}\n`));
}

function write(rel, text) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  console.log('wrote src/' + rel);
}

// ---- shared scripts -> modules ----
function portModules() {
  const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
  const lines = s => s.split('\n');
  const data = lines(read('aegis-data.js')).slice(1);
  data[0] = data[0].replace('window.AEGIS = (function () {', 'export const AEGIS: any = (function () {');
  write(
    'data/aegis.ts',
    `/* Host360 Aegis — sample data for the prototype. Times are in the orchestrator's zone (IST). Ported from project/aegis-data.js. */\n/* eslint-disable @typescript-eslint/no-explicit-any */\n\n${data.join('\n')}`
  );
  const spec = lines(read('aegis-spec.js')).slice(1);
  spec[0] = spec[0].replace('window.AEGIS_SPEC = (function () {', 'export const AEGIS_SPEC: any = (function () {');
  write(
    'data/spec.ts',
    `/* Host360 Aegis — specification data shared by the design-system and handoff pages. Ported from project/aegis-spec.js. */\n/* eslint-disable @typescript-eslint/no-explicit-any */\n\n${spec.join('\n')}`
  );
  const icons = read('aegis-icons.js');
  const body = icons.slice(icons.indexOf('const P = {') + 'const P = {'.length + 1, icons.indexOf('\n  };', icons.indexOf('const P = {')));
  write(
    'lib/iconPaths.ts',
    `/* Lucide geometry on a 24 grid, stroke 1.5. Ported from project/aegis-icons.js. */\nexport const ICON_PATHS: Record<string, string> = {\n${body.replace(/^ {4}/gm, '  ')}\n};\n`
  );
  write('styles/tokens.css', read('aegis-tokens.css'));
}

// ---- hand edits after the port: typing for the JS logic, plus a few deliberate changes ----
const FIXUPS = [
  // Trailing parameters that callers omit.
  [
    'data/aegis.ts',
    '  const G = (name, site, policy, r, lastT, next, points, cons, cbt, size, os, disks) =>',
    '  const G = (name: string, site: string, policy: string, r: string, lastT: string, next: string, points: number, cons: string, cbt: string, size: number, os: string, disks: any[][]): any =>'
  ],
  [
    'data/aegis.ts',
    'const S = (name, pri, rec, plan, target, age, ageMin, vers, state, extra) =>',
    'const S = (name, pri, rec, plan, target, age, ageMin, vers, state, extra?) =>'
  ],
  ['data/aegis.ts', 'const H = (server, t, r, changed, secs, note) =>', 'const H = (server, t, r, changed, secs, note?) =>'],
  [
    'data/aegis.ts',
    'const M = (name, src, host, ds, os, cpu, mem, disks, size, cbt, stage, next, last, dest, extra) =>',
    'const M = (name, src, host, ds, os, cpu, mem, disks, size, cbt, stage, next, last, dest, extra?) =>'
  ],
  [
    'data/aegis.ts',
    'const J = (id, name, object, product, type, status, phase, pct, started, duration, extra) =>',
    'const J = (id, name, object, product, type, status, phase, pct, started, duration, extra?) =>'
  ],
  ['pages/AegisConsole.tsx', '  toast(text, kind, action) {', '  toast(text, kind, action?) {'],
  ['screens/AegisDrServers.tsx', '      const F = (k, label, opts, extra) => ({', '      const F = (k, label, opts, extra?) => ({'],
  ['screens/AegisDrServers.tsx', '  startAction(kind, srv, form) {', '  startAction(kind, srv, form?) {'],
  ['screens/AegisList.tsx', 'const st3 = (i, l, c, extra) =>', 'const st3 = (i, l, c, extra?) =>'],
  ['screens/AegisList.tsx', '      const I = (k, label, span, hint) => ({', '      const I = (k, label, span?, hint?) => ({'],
  ['screens/AegisList.tsx', '      const SG = (k, label, opts, hint, span) => ({', '      const SG = (k, label, opts, hint?, span?) => ({'],
  [
    'screens/AegisList.tsx',
    '      const TG = (k, label, onLabel, offLabel, icon, hint) => ({',
    '      const TG = (k, label, onLabel, offLabel, icon, hint?) => ({'
  ],
  ['screens/AegisMigServers.tsx', '    const g = (ok, why) =>', '    const g = (ok, why?) =>'],
  [
    'screens/AegisMigServers.tsx',
    '      const A2 = (key, label, icon, consequence, enabled, why, danger) => {',
    '      const A2 = (key, label, icon, consequence, enabled, why, danger?) => {'
  ],
  ['screens/AegisMigServers.tsx', '      const F = (k, label, opts, extra) => ({', '      const F = (k, label, opts?, extra?) => ({'],
  [
    'screens/AegisOverview.tsx',
    '    const T = (label, value, unit, sub, i, ic, href, segs) => ({',
    '    const T = (label, value, unit, sub, i, ic, href, segs?) => ({'
  ],
  ['screens/AegisRecovery.tsx', '    const g = (ok, why, label) =>', '    const g = (ok, why, label?) =>'],
  ['screens/AegisSettings.tsx', '    const MF = (k, label, span, extra) => ({', '    const MF = (k, label, span, extra?) => ({'],
  ['screens/AegisSites.tsx', '    const F = (id, label, span, extra) =>', '    const F = (id, label, span, extra?) =>'],
  ['screens/AegisSites.tsx', '      const fact = (k, v, muted) =>', '      const fact = (k, v, muted?) =>'],
  // State and view-model objects that gain fields after their defaults are declared.
  ['pages/AegisConsole.tsx', '    const is = {', '    const is: any = {'],
  ['screens/AegisDrServers.tsx', '    const empty = {', '    const empty: any = {'],
  ['screens/AegisMigServers.tsx', '    const empty = {', '    const empty: any = {'],
  ['screens/AegisList.tsx', '    const E = {', '    const E: any = {'],
  ['screens/AegisList.tsx', '  page(A, ctx) {', '  page(A, ctx): any {'],
  ['screens/AegisGuests.tsx', '    let g = { tiles', '    let g: any = { tiles'],
  ['screens/AegisSites.tsx', '    let d = { facts', '    let d: any = { facts'],
  ['screens/AegisList.tsx', "['All'].concat(", "(['All'] as any[]).concat("],
  ['screens/AegisMigServers.tsx', "['All'].concat(", "(['All'] as any[]).concat("],
  ['pages/AegisHandoff.tsx', 'for (const r of Array.from(rules || [])) {', 'for (const r of Array.from((rules || []) as CSSRuleList)) {'],
  [
    'screens/AegisDrServers.tsx',
    'Object.entries(this.state.jobs).forEach(([sid, { id, kind }]) => {',
    'Object.entries(this.state.jobs).forEach(([sid, { id, kind }]: [string, any]) => {'
  ],
  [
    'screens/AegisMigServers.tsx',
    'Object.entries(this.state.jobs).forEach(([sid, { id, kind }]) => {',
    'Object.entries(this.state.jobs).forEach(([sid, { id, kind }]: [string, any]) => {'
  ],
  [
    'screens/AegisDrServers.tsx',
    "          const patch = {};\n          if (t.copy && srv.state === 'online') {",
    "          const patch: any = {};\n          if (t.copy && srv.state === 'online') {"
  ],
  [
    'screens/AegisMigServers.tsx',
    '].map(([label, k, options]) => ({ label, value: s[k], options,',
    '].map(([label, k, options]: any[]) => ({ label, value: s[k], options,'
  ],
  // Selects bind the saved value on <select> rather than `selected` on an <option>.
  ['screens/AegisRestore.tsx', "<option key={i} value={g.v ?? ''} selected={g.sel}>", "<option key={i} value={g.v ?? ''}>"],
  [
    'screens/AegisRestore.tsx',
    '                  <select\n                    onChange={v.setGuest}',
    '                  <select\n                    value={v.guest}\n                    onChange={v.setGuest}'
  ],
  ['screens/AegisMappings.tsx', "<option key={k} value={o.v ?? ''} selected={o.sel}>", "<option key={k} value={o.v ?? ''}>"],
  [
    'screens/AegisMappings.tsx',
    '                      <select\n                        onChange={r.onChange}',
    '                      <select\n                        value={r.b}\n                        onChange={r.onChange}'
  ],
  // The app scrolls inside #root (see styles/global.css), so view changes reset that scroller too.
  ['App.tsx', '      window.scrollTo(0, 0);', "      window.scrollTo(0, 0);\n      document.getElementById('root')?.scrollTo(0, 0);"],
  // Role and data-state previews (the design tool's Tweaks panel): ?role=Viewer&state=Empty
  [
    'App.tsx',
    'export default class App extends DC {',
    "const preview = new URLSearchParams(location.search);\nconst UI_STATES: Record<string, string> = { live: 'Live', reading: 'Reading…', unreachable: 'Unreachable', empty: 'Empty' };\n\nexport default class App extends DC {"
  ],
  [
    'App.tsx',
    '<AegisConsole hub={true} />',
    "<AegisConsole hub={true} role={preview.get('role') || undefined} uiState={UI_STATES[(preview.get('state') || '').toLowerCase()]} />"
  ]
];
const FIXUP_ALL = [[/^ {2}state = \{/gm, '  state: any = {']];

function applyFixups() {
  for (const [rel, a, b] of FIXUPS) {
    const p = path.join(OUT, rel);
    const s = fs.readFileSync(p, 'utf8');
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(`Fixup no longer applies in src/${rel} (${n} matches): ${a.slice(0, 80)}`);
    fs.writeFileSync(p, s.replace(a, b));
  }
  for (const rel of Object.values(MAP).map(m => m[1])) {
    const p = path.join(OUT, rel);
    let s = fs.readFileSync(p, 'utf8');
    for (const [re, b] of FIXUP_ALL) s = s.replace(re, b);
    fs.writeFileSync(p, s);
  }
}

portModules();
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.dc.html') && !SKIP.has(f.replace(/\.dc\.html$/, '')))) {
  await portComponent(path.join(SRC, f));
}
applyFixups();
console.log('Done. Run `npm run typecheck`.');
