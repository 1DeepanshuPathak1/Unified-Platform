/* Ported from project/Aegis Design System.dc.html */
import { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon, ICON_NAMES } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS_SPEC } from '../data/spec';

const STATES = ['Default', 'Hover', 'Focus', 'Active', 'Disabled', 'Loading'];
export default class AegisDesignSystem extends DC {
  state: any = { theme: 'dark', vals: null, seg: 'All', tab: 'Overview', open: true };
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
  }
  renderVals() {
    const S = AEGIS_SPEC;
    const s = this.state;
    const E = {
      toc: [],
      colors: [],
      contrast: [],
      type: [],
      space: [],
      layout: [],
      icons: [],
      states: [],
      buttons: [],
      inputs: [],
      seg: [],
      checks: [],
      radios: [],
      toggles: [],
      tabs: [],
      trows: [],
      pills: [],
      badges: [],
      progress: [],
      stepper: [],
      timeline: [],
      kpis: [],
      dialogs: [],
      toasts: [],
      log: [],
      menu: []
    };
    const base = {
      consoleHref: this.props.hub ? '#/backup/overview' : 'Aegis Console.dc.html',
      handoffHref: this.props.hub ? '#/handoff' : 'Aegis Handoff.dc.html',
      theme: s.theme,
      themeIcon: s.theme === 'dark' ? 'sun' : 'moon',
      themeLabel: s.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      toggleTheme: () => {
        const t = s.theme === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem('aegis.theme', t);
        } catch (e) {}
        this.setState({ theme: t });
      }
    };
    if (!S) return { ...E, ...base };
    const V = s.vals || { dark: {}, light: {} };
    const hex = v => S.oklchToHex(v || '');
    const colors = S.tokens.map(([n, role, use]) => ({
      name: n,
      role,
      use,
      dv: V.dark[n] || '',
      lv: V.light[n] || '',
      dh: hex(V.dark[n]),
      lh: hex(V.light[n])
    }));
    const pairs = [
      ['--tx on --panel', '--tx', '--panel', 4.5],
      ['--tx-2 on --panel', '--tx-2', '--panel', 4.5],
      ['--tx-3 on --panel', '--tx-3', '--panel', 4.5],
      ['--tx-3 on --panel-2', '--tx-3', '--panel-2', 4.5],
      ['--tx-2 on --app', '--tx-2', '--app', 4.5],
      ['--acc-ink on --acc (buttons)', '--acc-ink', '--acc', 4.5],
      ['--acc-tx on --panel (links)', '--acc-tx', '--panel', 4.5],
      ['--acc on --panel (focus ring, 3:1)', '--acc', '--panel', 3],
      ['--ok on --panel (icons, 3:1)', '--ok', '--panel', 3],
      ['--warn on --panel (icons, 3:1)', '--warn', '--panel', 3],
      ['--err on --panel (icons, 3:1)', '--err', '--panel', 3],
      ['--run on --panel (icons, 3:1)', '--run', '--panel', 3]
    ];
    const contrast = pairs.map(([pair, a, b, need]) => {
      const f = th => {
        const x = hex(V[th][a]),
          y = hex(V[th][b]);
        if (!/^#[0-9a-f]{6}$/i.test(x) || !/^#[0-9a-f]{6}$/i.test(y)) return [0, false];
        const r = S.contrast(x, y);
        return [r, r >= need];
      };
      const [d, dok] = f('dark'),
        [l, lok] = f('light');
      return {
        pair,
        d: d ? `${d.toFixed(2)} : 1` : '—',
        l: l ? `${l.toFixed(2)} : 1` : '—',
        di: dok ? 'circle-check' : 'circle-x',
        dc: dok ? 'var(--ok)' : 'var(--err)',
        dl: dok ? `Passes ${need} : 1` : `Below ${need} : 1`,
        li: lok ? 'circle-check' : 'circle-x',
        lc: lok ? 'var(--ok)' : 'var(--err)',
        ll: lok ? `Passes ${need} : 1` : `Below ${need} : 1`
      };
    });
    const fam = f => (f.startsWith('ES') ? 'var(--f-head)' : f.startsWith('Tahoma') ? 'var(--f-ui)' : 'var(--f-body)');
    const SAMPLE = {
      'Display (KPI value)': '1187.84 GB',
      'Page title': 'Protected servers',
      'Drawer and dialog title': 'Bring server online',
      'Brand wordmark': 'Host360 Aegis',
      'Table cell': 'Chennai-proxmox-prod · 109 · 4.4×',
      'Label and column header': 'Recovery target',
      'Caption and meta': 'Last read 21 Oct 2026, 16:04 IST',
      'Log line': '16:05:12  Booting sql-prod-02-dr as m1.large…'
    };
    const type = S.type.map(([role, font, size, weight, lh, ls]) => ({
      role,
      font,
      size: `${size} px`,
      weight: String(weight),
      lh: `${lh} px`,
      ls,
      css: `${weight} ${size}px/${lh}px ${fam(font)}`,
      fs: font.includes('italic') ? 'italic' : 'normal',
      sample: SAMPLE[role] || 'This starts a copy of your server at the recovery site.'
    }));
    const btnV = [
      ['Primary', 'var(--acc)', 'var(--acc-ink)', 'var(--acc)', 'var(--acc-h)', 'var(--acc-p)', 'Bring online', 'power'],
      ['Secondary', 'var(--panel)', 'var(--tx)', 'var(--ln-2)', 'var(--hover)', 'var(--hover)', 'Refresh all', 'refresh-cw'],
      ['Ghost', 'transparent', 'var(--tx)', 'transparent', 'var(--hover)', 'var(--hover)', 'Clear', ''],
      ['Danger', 'transparent', 'var(--err)', 'transparent', 'var(--err-s)', 'var(--err-s)', 'Destroy…', 'trash-2']
    ];
    const buttons = btnV.map(([name, bg, fg, bd, hb, ab, label, icon]) => ({
      name,
      cells: STATES.map(st => ({
        label: st === 'Loading' ? (name === 'Primary' ? 'Starting…' : label) : label,
        icon: st === 'Loading' ? 'loader-circle' : icon,
        spin: st === 'Loading' ? 'true' : 'false',
        bg: st === 'Hover' ? hb : st === 'Active' ? ab : bg,
        fg,
        bd: st === 'Hover' && name === 'Secondary' ? 'var(--ln-2)' : bd,
        op: st === 'Disabled' ? 0.45 : 1,
        dis: st === 'Disabled' || st === 'Loading' ? 'true' : undefined,
        outline: st === 'Focus' ? '2px solid var(--acc)' : 'none',
        tf: st === 'Active' ? 'translateY(1px)' : 'none'
      }))
    }));
    const inputs = [
      ['Default', 'Chennai-proxmox-dr', 'var(--ln)', 1, 'none', ''],
      ['Hover', 'Chennai-proxmox-dr', 'var(--ln-2)', 1, 'none', ''],
      ['Focus', 'Chennai-proxmox-dr', 'var(--acc)', 1, '2px solid var(--acc)', ''],
      ['Disabled', 'Chennai-proxmox-dr', 'var(--ln)', 0.45, 'none', ''],
      ['Error', 'Chennai-proxmox-prod', 'var(--err)', 1, 'none', 'A site named Chennai-proxmox-prod already exists.']
    ].map(([state, value, bd, op, outline, err]) => ({ state, value, bd, op, outline, err }));
    const box = (on, mixed) => ({
      bd: on || mixed ? 'var(--acc)' : 'var(--ln-2)',
      bg: on || mixed ? 'var(--acc)' : 'transparent',
      icon: on ? 'check' : mixed ? 'minus' : ''
    });
    return {
      ...base,
      toc: [
        ['#intro', 'Introduction'],
        ['#colour', 'Colour'],
        ['#type', 'Type'],
        ['#space', 'Spacing and layout'],
        ['#icons', 'Icons'],
        ['#buttons', 'Buttons'],
        ['#forms', 'Inputs and choices'],
        ['#nav', 'Tabs'],
        ['#table', 'Table'],
        ['#status', 'Status and progress'],
        ['#overlays', 'Drawer and dialogs'],
        ['#feedback', 'Feedback']
      ].map(([href, label]) => ({ href, label })),
      colors,
      contrast,
      type,
      space: S.space.map(([name, px]) => ({ name, px: `${px} px`, w: `${px * 4}px` })),
      layout: S.layout.concat(S.motion).map(([k, v]) => ({ k, v })),
      icons: (ICON_NAMES || []).map(n => ({ n })),
      states: STATES,
      buttons,
      inputs,
      seg: ['All', 'Proxmox VE', 'OpenStack', 'VMware'].map(x => ({
        label: x,
        on: s.seg === x,
        fg: s.seg === x ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState({ seg: x })
      })),
      checks: [
        ['Unchecked', false, false, 1, 'none'],
        ['Checked', true, false, 1, 'none'],
        ['Mixed', false, true, 1, 'none'],
        ['Focus', true, false, 1, '2px solid var(--acc)'],
        ['Disabled', false, false, 0.45, 'none']
      ].map(([label, on, mixed, op, outline]) => ({ label, op, outline, ...box(on, mixed) })),
      radios: [
        ['Off', false, 1],
        ['On', true, 1],
        ['Disabled', false, 0.45]
      ].map(([label, on, op]) => ({
        label,
        op,
        bd: on ? 'var(--acc)' : 'var(--ln-2)',
        rin: on ? 'var(--panel)' : 'transparent',
        bg: on ? 'var(--acc)' : 'transparent'
      })),
      toggles: [
        ['Off', false, 1],
        ['On', true, 1],
        ['Disabled', true, 0.45]
      ].map(([label, on, op]) => ({
        label,
        op,
        tbg: on ? 'var(--acc)' : 'transparent',
        tbd: on ? 'var(--acc)' : 'var(--ln-2)',
        knob: on ? 'var(--acc-ink)' : 'var(--tx-3)',
        tx: on ? 'translateX(14px)' : 'none'
      })),
      tabs: [
        ['Overview', ''],
        ['Recovery points', '31'],
        ['Jobs', ''],
        ['Disks', '2'],
        ['Settings', '']
      ].map(([label, n]) => ({
        label,
        n,
        on: s.tab === label,
        fg: s.tab === label ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState({ tab: label })
      })),
      trows: [
        {
          name: 'ad-dc-01',
          note: '',
          policy: 'Production daily',
          size: '60.00 GB',
          si: 'circle-check',
          sc: 'var(--ok)',
          sl: 'Succeeded',
          bg: 'transparent',
          ring: 'none'
        },
        {
          name: 'erp-app-01',
          note: 'Hover',
          policy: 'Production daily',
          size: '260.00 GB',
          si: 'loader-circle',
          spin: 'true',
          sc: 'var(--run)',
          sl: 'Running · 62 %',
          bg: 'var(--hover)',
          ring: 'none'
        },
        {
          name: 'erp-db-01',
          note: 'Selected',
          policy: 'Database hourly',
          size: '820.00 GB',
          si: 'triangle-alert',
          sc: 'var(--warn)',
          sl: 'Warning',
          bg: 'var(--acc-soft)',
          ring: 'none',
          sel: true
        },
        {
          name: 'file-srv-03',
          note: 'Open in drawer',
          policy: 'Production daily',
          size: '1.80 TB',
          si: 'circle-x',
          sc: 'var(--err)',
          sl: 'Failed',
          bg: 'var(--acc-soft)',
          ring: 'inset 2px 0 0 var(--acc)'
        },
        {
          name: 'gitlab-01',
          note: 'Expandable',
          policy: 'Production daily',
          size: '420.00 GB',
          si: 'circle-check',
          sc: 'var(--ok)',
          sl: 'Succeeded',
          bg: 'transparent',
          ring: 'none',
          exp: true
        }
      ].map(r => ({
        spin: 'false',
        ...r,
        cbd: r.sel ? 'var(--acc)' : 'var(--ln-2)',
        cbg: r.sel ? 'var(--acc)' : 'transparent',
        ci: r.sel ? 'check' : '',
        exp: r.exp ? 'inline-flex' : 'none',
        chev: s.open ? 'chevron-down' : 'chevron-right',
        open: !!r.exp && s.open,
        onToggle: () => this.setState(st => ({ open: !st.open })),
        detail: [
          { k: 'Node', v: 'cmp4' },
          { k: 'Repository', v: 'obj-check' },
          { k: 'Recovery points', v: '31' },
          { k: 'Next backup', v: '22 Oct, 02:00 IST' }
        ]
      })),
      pills: [
        ['circle-check', 'Online', 'var(--ok)', 'var(--ok-s)'],
        ['triangle-alert', 'Unreachable', 'var(--warn)', 'var(--warn-s)'],
        ['circle-x', 'Failed', 'var(--err)', 'var(--err-s)'],
        ['loader-circle', 'Running', 'var(--run)', 'var(--run-s)'],
        ['circle-minus', 'Not read', 'var(--tx-3)', 'var(--panel-2)']
      ].map(([i, l, c, bg]) => ({ i, l, c, bg, spin: i === 'loader-circle' ? 'true' : 'false' })),
      badges: ['Backup', 'DR', 'Migration', 'Proposed'],
      progress: [
        ['loader-circle', 'Hashing source', 34, 'var(--run)'],
        ['circle-check', 'Seal version · done', 100, 'var(--ok)'],
        ['circle-x', 'Snapshot · failed', 12, 'var(--err)']
      ].map(([i, phase, p, c]) => ({ i, phase, pct: `${p} %`, w: `${p}%`, c, spin: i === 'loader-circle' ? 'true' : 'false' })),
      stepper: ['Platform', 'Connection', 'Verify', 'Name and review'].map((label, i) => ({
        label,
        bar: i <= 1 ? 'var(--acc)' : 'var(--ln)',
        fg: i === 1 ? 'var(--tx)' : i < 1 ? 'var(--tx-2)' : 'var(--tx-3)',
        bd: i <= 1 ? 'var(--acc)' : 'var(--ln-2)',
        bg: i < 1 ? 'var(--acc)' : 'transparent',
        nfg: i < 1 ? 'var(--acc-ink)' : i === 1 ? 'var(--acc-tx)' : 'var(--tx-3)',
        mark: i < 1 ? '✓' : String(i + 1)
      })),
      timeline: ['First pass', 'Sync passes', 'Test boot', 'Cutover', 'Commit or roll back'].map((label, i) => ({
        label,
        bd: i <= 2 ? 'var(--acc)' : 'var(--ln-2)',
        bg: i < 2 ? 'var(--acc)' : 'transparent',
        fg: i < 2 ? 'var(--acc-ink)' : 'var(--acc-tx)',
        i: i < 2 ? 'check' : i === 2 ? 'loader-circle' : '',
        spin: i === 2 ? 'true' : 'false',
        line: i < 4 ? (i < 1 ? 'var(--acc)' : 'var(--ln)') : 'transparent',
        tc: i <= 2 ? 'var(--tx)' : 'var(--tx-3)'
      })),
      kpis: [
        ['monitor', 'Guests protected', '172', 'of 180', '8 guests have no policy', 'normal', 'var(--tx)'],
        ['layers', 'Data protected', '1187.84', 'GB', 'Stored in 272.33 GB · 4.4×', 'normal', 'var(--tx)'],
        ['gauge', 'Within recovery target', '6', 'of 10', '1 behind · 1 failed', 'normal', 'var(--tx)'],
        ['database', 'Unreachable value', 'Not read', '', 'Could not be read', 'italic', 'var(--tx-3)']
      ].map(([i, label, v, u, sub, fs, vc], n) => ({ i, label, v, u, sub, fs, vc, bl: n ? 'var(--ln)' : 'transparent' })),
      dialogs: [
        ['Small · 440 px', 'Assign policy', 'For 3 guests. The new schedule starts with the next run.', 'Assign policy', 'var(--acc)'],
        [
          'Medium · 600 px',
          'Bring server online',
          'This starts a copy of your server at the recovery site. Your primary server is not affected.',
          'Bring online',
          'var(--acc)'
        ],
        [
          'Large · 720 px',
          'Destroy resources',
          'Choose exactly what to remove. Anything left unticked is kept.',
          'Destroy selected',
          'var(--err)'
        ]
      ].map(([size, title, desc, btn, bg]) => ({ size, title, desc, btn, bg })),
      toasts: [
        ['circle-check', 'var(--ok)', 'Project Base-Project updated', ''],
        ['info', 'var(--tx-2)', 'Backup of web-frontend-01 started', 'Open Jobs'],
        ['triangle-alert', 'var(--warn)', 'Cutover of print-srv-02 started. The source is powering off.', '']
      ].map(([i, c, text, action]) => ({ i, c, text, action })),
      log: [
        ['16:05:02', 'Bring online started: sql-prod-02-dr at production-openstack', 'info'],
        ['16:05:04', 'Creating 3 volumes from the recovery point on ceph-ssd…', 'info'],
        ['16:05:09', 'Attaching prod-net…', 'info'],
        ['16:05:12', 'Firewall policy: Same as primary', 'warn'],
        ['16:05:20', 'sql-prod-02-dr is online at production-openstack', 'ok']
      ].map(([t, text, lv]) => ({
        t,
        text,
        i: { info: 'circle-dot', ok: 'circle-check', warn: 'triangle-alert' }[lv],
        c: { info: 'var(--tx-3)', ok: 'var(--ok)', warn: 'var(--warn)' }[lv]
      })),
      menu: [
        ['Base-Project', 'Owner', true],
        ['Tenant-Kaveri', 'Owner', false],
        ['All projects', 'System owner', false]
      ].map(([label, meta, on]) => ({ label, meta, check: on ? 'check' : '', bg: on ? 'var(--hover)' : 'transparent' }))
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
          <span style={{ font: '500 16px/24px var(--f-head)', color: 'var(--tx-2)' }}>Design system</span>
          <span style={{ flex: 1 }} />
          <a
            href={v.handoffHref}
            style={{
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              border: '1px solid var(--ln-2)',
              fontWeight: 600
            }}
            className={pc('hover', 'background:var(--hover)')}
          >
            Handoff values
            <Icon name="arrow-right" />
          </a>
          <a
            href={v.consoleHref}
            style={{
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              border: '1px solid var(--ln-2)',
              fontWeight: 600
            }}
            className={pc('hover', 'background:var(--hover)')}
          >
            Open the console
            <Icon name="external-link" />
          </a>
          <button
            onClick={v.toggleTheme}
            aria-label={v.themeLabel}
            data-tip={v.themeLabel}
            style={{ width: '36px', height: '36px', display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}
            className={pc('hover', 'background:var(--hover)')}
          >
            <Icon name={v.themeIcon} />
          </button>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', maxWidth: '1600px' }}>
          <nav
            aria-label="Sections"
            style={{
              position: 'sticky',
              top: '52px',
              alignSelf: 'start',
              height: 'calc(100vh - 52px)',
              overflow: 'auto',
              padding: '24px 8px 24px 24px',
              borderRight: '1px solid var(--ln)'
            }}
          >
            {arr(v.toc).map((t: any, i: number) => (
              <a
                key={i}
                href={t.href}
                style={{
                  display: 'block',
                  height: '32px',
                  lineHeight: '32px',
                  padding: '0 10px',
                  color: 'var(--tx-2)',
                  whiteSpace: 'nowrap'
                }}
                className={pc('hover', 'background:var(--hover);color:var(--tx)')}
              >
                {t.label}
              </a>
            ))}
          </nav>
          <main style={{ padding: '32px 40px 80px', display: 'flex', flexDirection: 'column', gap: '56px', minWidth: 0 }}>
            <section id="intro" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '820px' }}>
              <h1 style={{ font: '500 28px/36px var(--f-head)' }}>{'One system for Backup & Recovery, Disaster Recovery and Migration'}</h1>
              <p style={{ color: 'var(--tx-2)', textWrap: 'pretty' }}>
                Flat surfaces with hairline borders, square corners, one teal accent for the primary action, selection and focus, and status
                colours only for status. Toggle the theme above; every value on this page is read from the live tokens in aegis-tokens.css.
              </p>
              <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-3)' }}>
                Headings render in Jost until the self-hosted ES Build files are added; the font stack already names ES Build first. Tahoma
                falls back to Verdana where it is not installed. A shield always means encryption and a padlock always means immutability;
                neither icon is used for anything else.
              </p>
            </section>
            <section id="colour" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Colour tokens</h2>
              <div role="table" style={{ background: 'var(--panel)', border: '1px solid var(--ln)', font: '13px/18px var(--f-ui)' }}>
                <div
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 90px minmax(0,1.4fr) minmax(0,1.3fr) minmax(0,1.3fr)',
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
                  <span>Role</span>
                  <span>Used for</span>
                  <span>Dark (default)</span>
                  <span>Light</span>
                </div>
                {arr(v.colors).map((c: any, i: number) => (
                  <div
                    key={i}
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 90px minmax(0,1.4fr) minmax(0,1.3fr) minmax(0,1.3fr)',
                      gap: '12px',
                      alignItems: 'center',
                      minHeight: '44px',
                      padding: '4px 16px',
                      borderBottom: '1px solid var(--ln)'
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{c.name}</span>
                    <span style={{ color: 'var(--tx-2)' }}>{c.role}</span>
                    <span style={{ color: 'var(--tx-2)' }}>{c.use}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span
                        style={{ width: '28px', height: '28px', flex: 'none', background: c.dv, border: '1px solid oklch(0.5 0 0 / 0.3)' }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block' }}>{c.dh}</span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: 'var(--tx-3)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {c.dv}
                        </span>
                      </span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span
                        style={{ width: '28px', height: '28px', flex: 'none', background: c.lv, border: '1px solid oklch(0.5 0 0 / 0.3)' }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block' }}>{c.lh}</span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: 'var(--tx-3)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {c.lv}
                        </span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <h3 style={{ font: '600 15px/22px var(--f-body)', marginTop: '8px' }}>Contrast (WCAG 2.1 AA)</h3>
              <div role="table" style={{ background: 'var(--panel)', border: '1px solid var(--ln)', font: '13px/18px var(--f-ui)' }}>
                {arr(v.contrast).map((k: any, i: number) => (
                  <div
                    key={i}
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.6fr) 90px 160px 90px 160px',
                      gap: '12px',
                      alignItems: 'center',
                      minHeight: '40px',
                      padding: '0 16px',
                      borderBottom: '1px solid var(--ln)'
                    }}
                  >
                    <span>{k.pair}</span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{k.d}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name={k.di} style={{ color: k.dc }} />
                      {k.dl}
                    </span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{k.l}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name={k.li} style={{ color: k.lc }} />
                      {k.ll}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section id="type" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Type scale</h2>
              <div role="table" style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
                <div
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px,1.4fr) minmax(110px,1fr) 56px 56px 72px 80px minmax(0,2fr)',
                    gap: '12px',
                    alignItems: 'center',
                    height: '36px',
                    padding: '0 16px',
                    background: 'var(--panel-2)',
                    borderBottom: '1px solid var(--ln)',
                    font: '12px var(--f-ui)',
                    color: 'var(--tx-2)'
                  }}
                >
                  <span>Role</span>
                  <span>Font</span>
                  <span>Size</span>
                  <span>Weight</span>
                  <span>Line height</span>
                  <span>Letter spacing</span>
                  <span>Sample</span>
                </div>
                {arr(v.type).map((t: any, i: number) => (
                  <div
                    key={i}
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(120px,1.4fr) minmax(110px,1fr) 56px 56px 72px 80px minmax(0,2fr)',
                      gap: '12px',
                      alignItems: 'center',
                      minHeight: '52px',
                      padding: '8px 16px',
                      borderBottom: '1px solid var(--ln)',
                      font: '13px var(--f-ui)'
                    }}
                  >
                    <span>{t.role}</span>
                    <span style={{ color: 'var(--tx-2)' }}>{t.font}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t.size}</span>
                    <span>{t.weight}</span>
                    <span>{t.lh}</span>
                    <span>{t.ls}</span>
                    <span
                      style={{
                        font: t.css,
                        fontStyle: t.fs,
                        letterSpacing: t.ls,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {t.sample}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section id="space" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Spacing, grid, borders, radius and elevation</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: '16px', alignItems: 'start' }}>
                <div
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {arr(v.space).map((s: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '64px 48px minmax(0,1fr)',
                        gap: '12px',
                        alignItems: 'center',
                        font: '13px var(--f-ui)'
                      }}
                    >
                      <span style={{ color: 'var(--tx-2)' }}>{s.name}</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.px}</span>
                      <span style={{ height: '12px', width: s.w, background: 'var(--acc-soft)', border: '1px solid var(--acc)' }} />
                    </div>
                  ))}
                </div>
                <dl
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)',
                    display: 'grid',
                    gridTemplateColumns: '220px minmax(0,1fr)',
                    padding: '0 16px',
                    font: '13px/18px var(--f-ui)'
                  }}
                >
                  {arr(v.layout).map((l: any, i: number) => (
                    <Fragment key={i}>
                      <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{l.k}</dt>
                      <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)' }}>{l.v}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                  gap: '24px',
                  padding: '24px',
                  background: 'var(--app)',
                  border: '1px dashed var(--ln-2)'
                }}
              >
                <div
                  style={{
                    height: '96px',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)',
                    font: '12px var(--f-ui)',
                    color: 'var(--tx-2)'
                  }}
                >
                  Panel · flat · 1 px --ln
                </div>
                <div
                  style={{
                    height: '96px',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--overlay)',
                    border: '1px solid var(--ln-2)',
                    boxShadow: 'var(--sh-menu)',
                    font: '12px var(--f-ui)',
                    color: 'var(--tx-2)'
                  }}
                >
                  Menu · --sh-menu
                </div>
                <div
                  style={{
                    height: '96px',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--overlay)',
                    border: '1px solid var(--ln-2)',
                    boxShadow: 'var(--sh-over)',
                    font: '12px var(--f-ui)',
                    color: 'var(--tx-2)'
                  }}
                >
                  Drawer and dialog · --sh-over
                </div>
              </div>
            </section>
            <section id="icons" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Icons</h2>
              <p style={{ color: 'var(--tx-2)', maxWidth: '760px' }}>
                Lucide geometry on a 24 px grid with a 1.5 stroke, drawn at 16 px in tables, buttons and navigation, and at 20 px for
                product marks, close buttons and empty states. Icons inherit the text colour.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
                  background: 'var(--panel)',
                  border: '1px solid var(--ln)'
                }}
              >
                {arr(v.icons).map((i: any, j: number) => (
                  <div
                    key={j}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      height: '48px',
                      padding: '0 12px',
                      borderRight: '1px solid var(--ln)',
                      borderBottom: '1px solid var(--ln)',
                      font: '12px var(--f-ui)',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <Icon name={i.n} style={{ color: 'var(--tx)' }} />
                    <Icon name={i.n} size="20" style={{ color: 'var(--tx)' }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.n}</span>
                  </div>
                ))}
              </div>
            </section>
            <section id="buttons" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Buttons</h2>
              <div style={{ background: 'var(--panel)', border: '1px solid var(--ln)', overflowX: 'auto' }}>
                <div style={{ minWidth: '1110px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px repeat(6,minmax(160px,1fr))',
                      gap: '12px',
                      alignItems: 'center',
                      height: '36px',
                      padding: '0 16px',
                      background: 'var(--panel-2)',
                      borderBottom: '1px solid var(--ln)',
                      font: '12px var(--f-ui)',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <span>Variant</span>
                    {arr(v.states).map((st: any, i: number) => (
                      <span key={i}>{st}</span>
                    ))}
                  </div>
                  {arr(v.buttons).map((b: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px repeat(6,minmax(160px,1fr))',
                        gap: '12px',
                        alignItems: 'center',
                        minHeight: '64px',
                        padding: '0 16px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <span style={{ font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>{b.name}</span>
                      {arr(b.cells).map((c: any, j: number) => (
                        <span key={j}>
                          <button
                            aria-disabled={c.dis}
                            tabIndex={-1}
                            style={{
                              height: '32px',
                              padding: '0 14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              background: c.bg,
                              color: c.fg,
                              border: `1px solid ${c.bd}`,
                              opacity: c.op,
                              outline: c.outline,
                              outlineOffset: '1px',
                              transform: c.tf
                            }}
                          >
                            <Icon name={c.icon} spin={c.spin} />
                            {c.label}
                          </button>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section id="forms" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Inputs and choices</h2>
              <div
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--ln)',
                  padding: '20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
                  gap: '20px'
                }}
              >
                {arr(v.inputs).map((f: any, i: number) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                    <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                      Site name · <span>{f.state}</span>
                    </span>
                    <input
                      value={f.value ?? ''}
                      readOnly
                      tabIndex={-1}
                      aria-label={f.state}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        height: '36px',
                        padding: '0 10px',
                        background: 'var(--panel-2)',
                        border: `1px solid ${f.bd}`,
                        font: '14px var(--f-body)',
                        opacity: f.op,
                        outline: f.outline,
                        outlineOffset: '1px'
                      }}
                    />
                    {f.err ? (
                      <span
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '12px/16px var(--f-ui)', color: 'var(--err)' }}
                      >
                        <Icon name="circle-alert" />
                        {f.err}
                      </span>
                    ) : null}
                  </div>
                ))}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Select</span>
                  <select
                    style={{
                      width: '100%',
                      minWidth: 0,
                      height: '36px',
                      padding: '0 8px',
                      background: 'var(--panel-2)',
                      border: '1px solid var(--ln)',
                      font: '14px var(--f-body)'
                    }}
                  >
                    <option>production-openstack</option>
                    <option>Chennai-proxmox-prod</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Search</span>
                  <div style={{ position: 'relative' }}>
                    <Icon name="search" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--tx-3)' }} />
                    <input
                      placeholder="Search sites, guests, servers, jobs, repositories, plans"
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 64px 0 36px',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--ln)',
                        font: '14px var(--f-body)'
                      }}
                      className={pc('focus', 'border-color:var(--acc)')}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '9px',
                        height: '18px',
                        padding: '0 6px',
                        border: '1px solid var(--ln-2)',
                        font: '11px/16px var(--f-ui)',
                        color: 'var(--tx-3)'
                      }}
                    >
                      Ctrl K
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Segmented control</span>
                  <Ind
                    mode="fill"
                    role="radiogroup"
                    style={{ display: 'inline-flex', alignSelf: 'flex-start', border: '1px solid var(--ln-2)' }}
                  >
                    {arr(v.seg).map((sg: any, i: number) => (
                      <button
                        key={i}
                        role="radio"
                        aria-checked={sg.on}
                        onClick={sg.onClick}
                        style={{ height: '30px', padding: '0 14px', font: '13px var(--f-ui)', color: sg.fg, transition: 'color 100ms' }}
                      >
                        {sg.label}
                      </button>
                    ))}
                  </Ind>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Checkbox</span>
                  {arr(v.checks).map((c: any, i: number) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', font: '13px var(--f-ui)', opacity: c.op }}>
                      <span
                        style={{
                          width: '16px',
                          height: '16px',
                          display: 'grid',
                          placeItems: 'center',
                          border: `1px solid ${c.bd}`,
                          background: c.bg,
                          color: 'var(--acc-ink)',
                          outline: c.outline,
                          outlineOffset: '1px'
                        }}
                      >
                        <Icon name={c.icon} size="12" />
                      </span>
                      {c.label}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Radio</span>
                  {arr(v.radios).map((r: any, i: number) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', font: '13px var(--f-ui)', opacity: r.op }}>
                      <span
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: `1px solid ${r.bd}`,
                          boxShadow: `inset 0 0 0 4px ${r.rin}`,
                          background: r.bg
                        }}
                      />
                      {r.label}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Toggle</span>
                  {arr(v.toggles).map((t: any, i: number) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', font: '13px var(--f-ui)', opacity: t.op }}>
                      <span
                        style={{
                          width: '32px',
                          height: '18px',
                          padding: '2px',
                          display: 'flex',
                          background: t.tbg,
                          border: `1px solid ${t.tbd}`
                        }}
                      >
                        <span style={{ width: '12px', height: '12px', background: t.knob, transform: t.tx }} />
                      </span>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            </section>
            <section id="nav" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Tabs and sub-tabs</h2>
              <div
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--ln)',
                  padding: '12px 16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}
              >
                <Ind mode="underline" role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--ln)' }}>
                  {arr(v.tabs).map((t: any, i: number) => (
                    <button
                      key={i}
                      role="tab"
                      aria-selected={t.on}
                      onClick={t.onClick}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        color: t.fg,
                        transition: 'color 100ms'
                      }}
                      className={pc('hover', 'color:var(--tx)')}
                    >
                      {t.label}
                      <span style={{ font: '11px var(--f-ui)', color: 'var(--tx-3)' }}>{t.n}</span>
                    </button>
                  ))}
                </Ind>
                <p style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>
                  Click a tab: the 2 px accent line slides in 150 ms. Sub-tabs in drawers use the same component at the drawer’s padding.
                </p>
              </div>
            </section>
            <section id="table" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Table</h2>
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
                    gridTemplateColumns: '44px minmax(0,1.4fr) minmax(0,1fr) 120px 140px 36px',
                    alignItems: 'center',
                    height: '36px',
                    background: 'var(--panel-2)',
                    borderBottom: '1px solid var(--ln)',
                    fontSize: '12px',
                    color: 'var(--tx-2)'
                  }}
                >
                  <span style={{ paddingLeft: '14px' }}>
                    <span
                      style={{
                        display: 'grid',
                        width: '16px',
                        height: '16px',
                        border: '1px solid var(--acc)',
                        background: 'var(--acc)',
                        color: 'var(--acc-ink)',
                        placeItems: 'center'
                      }}
                    >
                      <Icon name="minus" size="12" />
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}>
                    Name
                    <Icon name="arrow-up" style={{ color: 'var(--acc)' }} />
                  </span>
                  <span style={{ padding: '0 8px' }}>Policy</span>
                  <span style={{ padding: '0 8px', textAlign: 'right' }}>Size</span>
                  <span style={{ padding: '0 8px' }}>Status</span>
                  <span />
                </div>
                {arr(v.trows).map((r: any, i: number) => (
                  <Fragment key={i}>
                    <div
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '44px minmax(0,1.4fr) minmax(0,1fr) 120px 140px 36px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)',
                        background: r.bg,
                        boxShadow: r.ring
                      }}
                    >
                      <span style={{ paddingLeft: '14px' }}>
                        <span
                          style={{
                            display: 'grid',
                            placeItems: 'center',
                            width: '16px',
                            height: '16px',
                            border: `1px solid ${r.cbd}`,
                            background: r.cbg,
                            color: 'var(--acc-ink)'
                          }}
                        >
                          <Icon name={r.ci} size="12" />
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
                        <button onClick={r.onToggle} aria-label="Expand row" style={{ display: r.exp, color: 'var(--tx-3)' }}>
                          <Icon name={r.chev} />
                        </button>
                        {r.name}
                        <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>{r.note}</span>
                      </span>
                      <span style={{ padding: '0 8px', color: 'var(--tx-2)' }}>{r.policy}</span>
                      <span style={{ padding: '0 8px', textAlign: 'right' }}>{r.size}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px' }}>
                        <Icon name={r.si} spin={r.spin} style={{ color: r.sc }} />
                        {r.sl}
                      </span>
                      <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--tx-3)' }}>
                        <Icon name="chevron-right" />
                      </span>
                    </div>
                    {r.open ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
                          gap: '12px',
                          padding: '12px 16px 12px 60px',
                          borderBottom: '1px solid var(--ln)',
                          background: 'var(--panel-2)',
                          animation: 'ae-fade 150ms var(--ease)'
                        }}
                      >
                        {arr(r.detail).map((dd: any, j: number) => (
                          <span key={j}>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--tx-3)' }}>{dd.k}</span>
                            <span>{dd.v}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Fragment>
                ))}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '36px',
                    padding: '0 12px',
                    fontSize: '12px',
                    color: 'var(--tx-3)'
                  }}
                >
                  Header · row · hover · selected · open in drawer · row with status · expandable row
                </div>
              </div>
            </section>
            <section id="status" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Badges, status, progress, stepper, timeline, KPI tile</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px' }}>
                <div
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}
                >
                  <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>Status pills and inline status</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {arr(v.pills).map((p: any, i: number) => (
                      <span
                        key={i}
                        style={{
                          height: '24px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0 8px',
                          background: p.bg,
                          font: '12px var(--f-ui)'
                        }}
                      >
                        <Icon name={p.i} spin={p.spin} style={{ color: p.c }} />
                        {p.l}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    {arr(v.pills).map((p: any, i: number) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', font: '13px var(--f-ui)' }}>
                        <Icon name={p.i} spin={p.spin} style={{ color: p.c }} />
                        {p.l}
                      </span>
                    ))}
                  </div>
                  <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>Badges</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {arr(v.badges).map((b: any, i: number) => (
                      <span
                        key={i}
                        style={{
                          height: '20px',
                          padding: '0 6px',
                          border: '1px solid var(--ln-2)',
                          font: '11px/18px var(--f-ui)',
                          color: 'var(--tx-2)'
                        }}
                      >
                        {b}
                      </span>
                    ))}
                    <span
                      style={{
                        height: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0 6px',
                        border: '1px solid var(--ln-2)',
                        font: '11px var(--f-ui)',
                        color: 'var(--tx-2)'
                      }}
                    >
                      <Icon name="lock" />
                      Compliance, 14 d
                    </span>
                    <span
                      style={{
                        height: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0 6px',
                        border: '1px solid var(--ln-2)',
                        font: '11px var(--f-ui)',
                        color: 'var(--tx-2)'
                      }}
                    >
                      <Icon name="shield" />
                      AES-256
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >
                  <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>Progress bar with phase</span>
                  {arr(v.progress).map((p: any, i: number) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', font: '13px var(--f-ui)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon name={p.i} spin={p.spin} style={{ color: p.c }} />
                          {p.phase}
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.pct}</span>
                      </div>
                      <div style={{ marginTop: '6px', height: '4px', background: 'var(--ln)' }}>
                        <div style={{ height: '4px', width: p.w, background: p.c }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>Stepper</span>
                  <ol
                    style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px' }}
                  >
                    {arr(v.stepper).map((s: any, i: number) => (
                      <li key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ height: '2px', background: s.bar }} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '12px var(--f-ui)', color: s.fg }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              display: 'grid',
                              placeItems: 'center',
                              border: `1px solid ${s.bd}`,
                              background: s.bg,
                              color: s.nfg,
                              font: '700 11px var(--f-ui)'
                            }}
                          >
                            {s.mark}
                          </span>
                          {s.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>Timeline</span>
                  <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}>
                    {arr(v.timeline).map((t: any, i: number) => (
                      <li key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              display: 'grid',
                              placeItems: 'center',
                              border: `1px solid ${t.bd}`,
                              background: t.bg,
                              color: t.fg
                            }}
                          >
                            <Icon name={t.i} size="12" spin={t.spin} />
                          </span>
                          <span style={{ flex: 1, height: '2px', background: t.line }} />
                        </span>
                        <span style={{ font: '600 13px var(--f-body)', color: t.tc }}>{t.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div
                  style={{
                    gridColumn: 'span 2',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)'
                  }}
                >
                  {arr(v.kpis).map((k: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        padding: '16px 18px',
                        borderLeft: `1px solid ${k.bl}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>
                        <Icon name={k.i} style={{ color: 'var(--tx-3)' }} />
                        {k.label}
                      </span>
                      <span
                        style={{ font: '500 28px/36px var(--f-head)', fontVariantNumeric: 'tabular-nums', fontStyle: k.fs, color: k.vc }}
                      >
                        {k.v}
                        <span style={{ font: '400 15px var(--f-body)', color: 'var(--tx-2)', marginLeft: '6px' }}>{k.u}</span>
                      </span>
                      <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{k.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section id="overlays" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Drawer, dialogs and wizard</h2>
              <div
                style={{
                  position: 'relative',
                  height: '340px',
                  background: 'var(--app)',
                  border: '1px solid var(--ln)',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '20px 24px', width: '28%', font: '500 20px/28px var(--f-head)', color: 'var(--tx-3)' }}>
                  Page content
                </div>
                <aside
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 'min(560px,72%)',
                    background: 'var(--overlay)',
                    borderLeft: '1px solid var(--ln-2)',
                    boxShadow: 'var(--sh-over)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ padding: '20px 16px 0 24px', display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Site · Proxmox VE</div>
                      <div style={{ font: '500 20px/28px var(--f-head)' }}>Chennai-proxmox-prod</div>
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', font: '13px var(--f-ui)' }}>
                        <Icon name="circle-check" style={{ color: 'var(--ok)' }} />
                        Online
                      </div>
                    </div>
                    <Icon name="x" size="20" style={{ color: 'var(--tx-2)' }} />
                  </div>
                  <div style={{ display: 'flex', padding: '16px 16px 0', borderBottom: '1px solid var(--ln)' }}>
                    <span
                      style={{
                        height: '40px',
                        lineHeight: '40px',
                        padding: '0 10px',
                        fontWeight: 600,
                        boxShadow: 'inset 0 -2px 0 var(--acc)'
                      }}
                    >
                      Overview
                    </span>
                    <span style={{ height: '40px', lineHeight: '40px', padding: '0 10px', fontWeight: 600, color: 'var(--tx-2)' }}>
                      Nodes
                    </span>
                    <span style={{ height: '40px', lineHeight: '40px', padding: '0 10px', fontWeight: 600, color: 'var(--tx-2)' }}>
                      Storage
                    </span>
                  </div>
                  <div style={{ padding: '16px 24px', font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>
                    Drawer · 560–680 px · from the right · sub-tabs · lists live here
                  </div>
                </aside>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '440fr 600fr 720fr', gap: '16px', alignItems: 'start' }}>
                {arr(v.dialogs).map((d: any, i: number) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{d.size}</span>
                    <div style={{ background: 'var(--overlay)', border: '1px solid var(--ln-2)', boxShadow: 'var(--sh-over)' }}>
                      <div style={{ padding: '20px 24px 0' }}>
                        <div style={{ font: '500 20px/28px var(--f-head)' }}>{d.title}</div>
                        <p style={{ marginTop: '4px', fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{d.desc}</p>
                      </div>
                      <div style={{ padding: '16px 24px' }}>
                        <span style={{ display: 'block', height: '36px', background: 'var(--panel-2)', border: '1px solid var(--ln)' }} />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '8px',
                          padding: '12px 16px',
                          borderTop: '1px solid var(--ln)'
                        }}
                      >
                        <span style={{ height: '32px', lineHeight: '32px', padding: '0 12px', fontWeight: 600 }}>Cancel</span>
                        <span
                          style={{
                            height: '32px',
                            lineHeight: '32px',
                            padding: '0 14px',
                            background: d.bg,
                            color: 'var(--acc-ink)',
                            fontWeight: 600
                          }}
                        >
                          {d.btn}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section id="feedback" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ font: '500 24px/32px var(--f-head)' }}>Feedback and content</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {arr(v.toasts).map((t: any, i: number) => (
                    <div
                      key={i}
                      role="status"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 8px 10px 14px',
                        background: 'var(--overlay)',
                        border: '1px solid var(--ln-2)',
                        boxShadow: 'var(--sh-menu)'
                      }}
                    >
                      <Icon name={t.i} style={{ color: t.c }} />
                      <span style={{ flex: 1 }}>{t.text}</span>
                      <span style={{ height: '28px', lineHeight: '28px', padding: '0 10px', fontWeight: 600, color: 'var(--acc-tx)' }}>
                        {t.action}
                      </span>
                      <Icon name="x" style={{ color: 'var(--tx-3)' }} />
                    </div>
                  ))}
                  <div
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      minHeight: '40px',
                      padding: '0 8px 0 12px',
                      background: 'var(--warn-s)',
                      border: '1px solid var(--ln-2)'
                    }}
                  >
                    <Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />
                    <span style={{ flex: 1 }}>
                      <strong style={{ fontWeight: 600 }}>region-2-os</strong> · Could not be read: Keystone did not answer within 30 s.
                    </span>
                    <span style={{ fontWeight: 600, padding: '0 10px' }}>Retry</span>
                  </div>
                  <div
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      minHeight: '40px',
                      padding: '0 12px',
                      background: 'var(--err-s)',
                      border: '1px solid var(--ln-2)'
                    }}
                  >
                    <Icon name="circle-x" style={{ color: 'var(--err)' }} />
                    <span>Backup failed for file-srv-03: disk scsi1 read error at 412.6 GB.</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 8px 12px 14px',
                      border: '1px solid var(--ln-2)',
                      background: 'var(--panel-2)'
                    }}
                  >
                    <Icon name="file-text" size="20" style={{ color: 'var(--tx-2)' }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>production-openrc.sh</span>
                      <span style={{ display: 'block', font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>1.2 KB · 9 variables read</span>
                    </span>
                    <Icon name="x" style={{ color: 'var(--tx-3)' }} />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '12px 14px',
                      background: 'var(--panel)',
                      border: '1px solid var(--ln)'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Recovery target
                      <button
                        data-tip="How often a recovery point is taken. The newest point is never older than this when syncs keep up."
                        aria-label="About recovery target"
                        style={{ color: 'var(--tx-3)' }}
                      >
                        <Icon name="info" />
                      </button>
                    </span>
                    <span
                      style={{
                        padding: '6px 10px',
                        background: 'var(--tip-bg)',
                        color: 'var(--tip-tx)',
                        font: '12px/16px var(--f-ui)',
                        maxWidth: '320px'
                      }}
                    >
                      Tooltip: how often a recovery point is taken.
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '48px 24px',
                      background: 'var(--panel)',
                      border: '1px solid var(--ln)',
                      textAlign: 'center'
                    }}
                  >
                    <span style={{ color: 'var(--tx-2)' }}>No platforms are connected to this project yet.</span>
                    <span
                      style={{
                        height: '32px',
                        lineHeight: '32px',
                        padding: '0 14px',
                        background: 'var(--acc)',
                        color: 'var(--acc-ink)',
                        fontWeight: 600
                      }}
                    >
                      Add a platform
                    </span>
                  </div>
                  <div
                    role="log"
                    style={{
                      height: '150px',
                      overflow: 'auto',
                      padding: '8px 12px',
                      background: 'var(--panel-2)',
                      border: '1px solid var(--ln)',
                      font: '12px/20px var(--f-ui)',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {arr(v.log).map((l: any, i: number) => (
                      <div
                        key={i}
                        style={{ display: 'grid', gridTemplateColumns: '64px 16px minmax(0,1fr)', gap: '8px', alignItems: 'center' }}
                      >
                        <span style={{ color: 'var(--tx-3)' }}>{l.t}</span>
                        <Icon name={l.i} style={{ color: l.c }} />
                        <span>{l.text}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    role="menu"
                    style={{
                      width: '280px',
                      padding: '4px 0',
                      background: 'var(--overlay)',
                      border: '1px solid var(--ln-2)',
                      boxShadow: 'var(--sh-menu)'
                    }}
                  >
                    {arr(v.menu).map((m: any, i: number) => (
                      <span
                        key={i}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '36px', padding: '0 12px', background: m.bg }}
                      >
                        <span style={{ width: '16px', display: 'flex', color: 'var(--acc)' }}>
                          <Icon name={m.check} />
                        </span>
                        <span style={{ flex: 1, fontWeight: 600 }}>{m.label}</span>
                        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{m.meta}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }
}
