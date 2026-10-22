/* Ported from project/Aegis Handoff.dc.html */
import { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon, ICON_NAMES } from '../lib/Icon';
import { AEGIS_SPEC } from '../data/spec';

export default class AegisHandoff extends DC {
  state: any = { theme: 'dark', vals: null, css: 'Reading…' };
  componentDidMount() {
    try {
      const t = localStorage.getItem('aegis.theme');
      if (t) this.setState({ theme: t });
    } catch (e) {}
    let tries = 0;
    const go = () => {
      tries++;
      if (!AEGIS_SPEC) return setTimeout(go, 80);
      const S = AEGIS_SPEC;
      const dark = S.read('dark'),
        light = S.read('light');
      if (!dark['--app'] && tries < 120) return setTimeout(go, 80);
      this.setState({ vals: { dark, light } });
    };
    setTimeout(go, 50);
    const fromDom = () => {
      const out = [];
      for (const sh of Array.from(document.styleSheets)) {
        let rules;
        try {
          rules = sh.cssRules;
        } catch (e) {
          continue;
        }
        for (const r of Array.from((rules || []) as CSSRuleList)) {
          const t = r.cssText;
          if (/\[data-ae|@keyframes ae-|prefers-reduced-motion/.test(t)) out.push(t);
        }
      }
      return out.join('\n\n');
    };
    fetch('aegis-tokens.css')
      .then(r => {
        if (!r.ok) throw new Error('x');
        return r.text();
      })
      .then(t => {
        if (!/data-ae/.test(t)) throw new Error('x');
        this.setState({ css: t });
      })
      .catch(() => {
        const t = fromDom();
        this.setState({ css: t || 'Could not be read: aegis-tokens.css did not load.' });
      });
  }
  renderVals() {
    const S = AEGIS_SPEC;
    const s = this.state;
    const base = {
      dsHref: this.props.hub ? '#/design-system' : 'Aegis Design System.dc.html',
      theme: s.theme,
      themeIcon: s.theme === 'dark' ? 'sun' : 'moon',
      themeLabel: s.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      toggleTheme: () => {
        const t = s.theme === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem('aegis.theme', t);
        } catch (e) {}
        this.setState({ theme: t });
      },
      css: s.css
    };
    if (!S) return { ...base, files: [], colors: [], type: [], space: [], layout: [], motion: [], components: [], rules: [], icons: '' };
    const V = s.vals || { dark: {}, light: {} };
    const kv = a => a.map(([k, v]) => ({ k, v }));
    return {
      ...base,
      files: kv([
        ['aegis-tokens.css', 'Colour, font and motion tokens for both themes, resets, focus ring, keyframes, reduced-motion rule'],
        ['aegis-icons.js', '<ae-icon name size spin> web component; the brand mark is name="mark"'],
        ['aegis-ui.js', '<ae-ind mode> sliding indicator for tabs, segments and navigation; data-tip tooltips'],
        ['Fonts to self-host', 'ES Build 500 and 600 (woff2); Source Sans 3 400, 400 italic, 600, 700 (woff2); Tahoma is a system font'],
        ['Radius', '0 everywhere'],
        ['Shadows', `--sh-menu dark: ${V.dark['--sh-menu'] || ''} · light: ${V.light['--sh-menu'] || ''}`],
        ['Overlay shadow', `--sh-over dark: ${V.dark['--sh-over'] || ''} · light: ${V.light['--sh-over'] || ''}`]
      ]),
      colors: S.tokens.map(([n]) => ({
        name: n,
        dv: V.dark[n] || '',
        lv: V.light[n] || '',
        dh: S.oklchToHex(V.dark[n]),
        lh: S.oklchToHex(V.light[n])
      })),
      type: S.type.map(([role, font, size, weight, lh, ls]) => ({
        role,
        font,
        size: `${size} px`,
        weight: String(weight),
        lh: `${lh} px`,
        ls
      })),
      space: S.space.map(([k, v]) => ({ k, v: `${v} px` })),
      layout: kv(S.layout),
      motion: kv(S.motion),
      components: kv(S.components),
      rules: kv([
        [
          'Drawers and dialogs',
          'Details open in a drawer from the right with sub-tabs. Lists live in drawers, edits in dialogs. One dialog at a time.'
        ],
        [
          'Confirmations',
          'Armed inside the same dialog or row: the button turns into “Confirm …” for 5–6 s. Never a dialog on top of a dialog.'
        ],
        [
          'Destructive actions',
          'List exactly what is removed and what is kept; the confirm button stays disabled until the object’s name is typed.'
        ],
        [
          'Long actions',
          'Show their phases and live log in the drawer or dialog that started them; closing it leaves the job running in the running-jobs tray.'
        ],
        ['Loading', '“Reading…” with skeleton rows; also shown for 380 ms after every page change while the page reads.'],
        [
          'Unreachable',
          'An amber bar that starts “Could not be read:” with the reason. Values show “Not read” in italic --tx-3; never empty, zero, never or online.'
        ],
        ['Empty', 'One sentence and one primary action.'],
        ['Limited by role', 'Actions stay visible with aria-disabled, 45 % opacity and a tooltip naming the role and who can do it.'],
        ['Errors and warnings', 'Errors on a --err-s bar with a circle-x; warnings on a --warn-s bar with a triangle.'],
        ['Success', 'A toast that names the object, for example “Project Base-Project updated”.'],
        [
          'Tables',
          'One line per row; names, badges and buttons never wrap and truncate with a tooltip; numbers right-aligned with units; sortable headers; sticky header; bulk actions appear with the selection count.'
        ],
        [
          'Times',
          'Always the orchestrator’s zone with its name, for example 21 Oct 2026, 16:05 IST; table columns name the zone in the header.'
        ],
        ['Icons with fixed meaning', 'shield = encryption, lock = immutability (WORM). Used for nothing else.'],
        [
          'Navigation',
          'Product block first at a fixed 168 px; then Infrastructure (Sites, Nodes and proxies, Repositories, Mappings), Operations (Jobs, Alerts, Reports, Audit) and Administration (Access, Settings), identical in every product.'
        ]
      ]),
      icons: (ICON_NAMES || []).join(' · ')
    };
  }

  render() {
    const v = this.vals();
    return (
      <div
        data-ae=""
        data-theme={v.theme}
        style={{ minHeight: '100vh', background: 'var(--app)', color: 'var(--tx)', font: '14px/20px var(--f-body)' }}
      >
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '0 24px',
            background: 'var(--hdr)',
            borderBottom: '1px solid var(--ln)'
          }}
        >
          <Icon name="mark" size="24" />
          <span style={{ font: '500 17px/24px var(--f-head)' }}>Host360 Aegis</span>
          <span style={{ width: '1px', height: '24px', background: 'var(--ln-2)' }} />
          <span style={{ font: '500 16px/24px var(--f-head)', color: 'var(--tx-2)' }}>Handoff</span>
          <span style={{ flex: 1 }} />
          <a
            href={v.dsHref}
            style={{
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              border: '1px solid var(--ln-2)',
              fontWeight: 600,
              textDecoration: 'none'
            }}
            className={pc('hover', 'background:var(--hover)')}
          >
            Design system
            <Icon name="arrow-right" />
          </a>
          <button
            onClick={v.toggleTheme}
            aria-label={v.themeLabel}
            style={{ width: '36px', height: '36px', display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}
            className={pc('hover', 'background:var(--hover)')}
          >
            <Icon name={v.themeIcon} />
          </button>
        </header>
        <main style={{ maxWidth: '1280px', padding: '32px 40px 80px', display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '860px' }}>
            <h1 style={{ font: '500 28px/36px var(--f-head)' }}>Every value, as text</h1>
            <p style={{ color: 'var(--tx-2)', textWrap: 'pretty' }}>
              {
                'Rebuild the console in plain HTML and CSS from this page and the screens. Colours are CSS custom properties on an element with the data-ae attribute; add data-theme="light" for the light theme. Dark is the default. All values below are read live from aegis-tokens.css.'
              }
            </p>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '220px minmax(0,1fr)',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                padding: '0 16px',
                font: '13px/18px var(--f-ui)'
              }}
            >
              {arr(v.files).map((f: any, i: number) => (
                <Fragment key={i}>
                  <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                  <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)' }}>{f.v}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Colour tokens</h2>
            <div
              role="table"
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                font: '13px/18px var(--f-ui)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              <div
                role="row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px minmax(0,1.2fr) 110px minmax(0,1.2fr) 110px',
                  gap: '12px',
                  alignItems: 'center',
                  height: '36px',
                  padding: '0 16px',
                  background: 'var(--panel-2)',
                  borderBottom: '1px solid var(--ln)',
                  fontSize: '12px',
                  color: 'var(--tx-2)'
                }}
              >
                <span>Token</span>
                <span>Dark value</span>
                <span>Dark hex</span>
                <span>Light value</span>
                <span>Light hex</span>
              </div>
              {arr(v.colors).map((c: any, i: number) => (
                <div
                  key={i}
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px minmax(0,1.2fr) 110px minmax(0,1.2fr) 110px',
                    gap: '12px',
                    alignItems: 'center',
                    minHeight: '36px',
                    padding: '4px 16px',
                    borderBottom: '1px solid var(--ln)',
                    userSelect: 'all'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{c.name}</span>
                  <span>{c.dv}</span>
                  <span>{c.dh}</span>
                  <span>{c.lv}</span>
                  <span>{c.lh}</span>
                </div>
              ))}
            </div>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Type</h2>
            <div role="table" style={{ background: 'var(--panel)', border: '1px solid var(--ln)', font: '13px/18px var(--f-ui)' }}>
              <div
                role="row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.2fr) 80px 80px 100px 110px',
                  gap: '12px',
                  alignItems: 'center',
                  height: '36px',
                  padding: '0 16px',
                  background: 'var(--panel-2)',
                  borderBottom: '1px solid var(--ln)',
                  fontSize: '12px',
                  color: 'var(--tx-2)'
                }}
              >
                <span>Role</span>
                <span>Font</span>
                <span>Size</span>
                <span>Weight</span>
                <span>Line height</span>
                <span>Letter spacing</span>
              </div>
              {arr(v.type).map((t: any, i: number) => (
                <div
                  key={i}
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.2fr) 80px 80px 100px 110px',
                    gap: '12px',
                    alignItems: 'center',
                    minHeight: '36px',
                    padding: '0 16px',
                    borderBottom: '1px solid var(--ln)'
                  }}
                >
                  <span>{t.role}</span>
                  <span>{t.font}</span>
                  <span>{t.size}</span>
                  <span>{t.weight}</span>
                  <span>{t.lh}</span>
                  <span>{t.ls}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
              {
                'Stacks: --f-head "ES Build", Jost (stand-in until the files are added), "Source Sans 3", sans-serif · --f-body "Source Sans 3", sans-serif · --f-ui Tahoma, Verdana, "DejaVu Sans", sans-serif. Numbers use font-variant-numeric: tabular-nums. Units always follow the number with a space: 148 MB/s, 4.4×, 15 min, 62 %.'
              }
            </p>
          </section>
          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '16px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Spacing</h2>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px minmax(0,1fr)',
                  background: 'var(--panel)',
                  border: '1px solid var(--ln)',
                  padding: '0 16px',
                  font: '13px/18px var(--f-ui)'
                }}
              >
                {arr(v.space).map((s: any, i: number) => (
                  <Fragment key={i}>
                    <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{s.k}</dt>
                    <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)' }}>{s.v}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Layout and sizes</h2>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px minmax(0,1fr)',
                  background: 'var(--panel)',
                  border: '1px solid var(--ln)',
                  padding: '0 16px',
                  font: '13px/18px var(--f-ui)'
                }}
              >
                {arr(v.layout).map((s: any, i: number) => (
                  <Fragment key={i}>
                    <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{s.k}</dt>
                    <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)' }}>{s.v}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Motion</h2>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '260px minmax(0,1fr)',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                padding: '0 16px',
                font: '13px/18px var(--f-ui)'
              }}
            >
              {arr(v.motion).map((s: any, i: number) => (
                <Fragment key={i}>
                  <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{s.k}</dt>
                  <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)' }}>{s.v}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Components</h2>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '200px minmax(0,1fr)',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                padding: '0 16px',
                font: '13px/20px var(--f-ui)'
              }}
            >
              {arr(v.components).map((s: any, i: number) => (
                <Fragment key={i}>
                  <dt style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)', fontWeight: 700 }}>{s.k}</dt>
                  <dd style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)', textWrap: 'pretty' }}>{s.v}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Rules that apply to every screen</h2>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '200px minmax(0,1fr)',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                padding: '0 16px',
                font: '13px/20px var(--f-ui)'
              }}
            >
              {arr(v.rules).map((s: any, i: number) => (
                <Fragment key={i}>
                  <dt style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)', fontWeight: 700 }}>{s.k}</dt>
                  <dd style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)', textWrap: 'pretty' }}>{s.v}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Icon names</h2>
            <p
              style={{
                font: '13px/22px var(--f-ui)',
                color: 'var(--tx-2)',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                padding: '12px 16px',
                userSelect: 'all'
              }}
            >
              {v.icons}
            </p>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ font: '500 24px/32px var(--f-head)' }}>aegis-tokens.css</h2>
            <pre
              style={{
                margin: 0,
                maxHeight: '520px',
                overflow: 'auto',
                padding: '16px',
                background: 'var(--panel-2)',
                border: '1px solid var(--ln)',
                font: '12px/20px var(--f-ui)',
                whiteSpace: 'pre',
                userSelect: 'all'
              }}
            >
              {v.css}
            </pre>
          </section>
        </main>
      </div>
    );
  }
}
