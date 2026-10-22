/* Host360 Aegis — specification data shared by the design-system and handoff pages. Ported from project/aegis-spec.js. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const AEGIS_SPEC: any = (function () {
  const tokens = [
    ['--app', 'Surface', 'App ground behind panels'], ['--hdr', 'Surface', 'Header bar'], ['--nav', 'Surface', 'Left navigation'], ['--panel', 'Surface', 'Panels and tables'], ['--panel-2', 'Surface', 'Table header, inputs, subtle fills'],
    ['--hover', 'Surface', 'Hover fill'], ['--overlay', 'Surface', 'Drawers, dialogs, menus, toasts'], ['--skel', 'Surface', 'Skeleton bars while reading'], ['--ln', 'Line', 'Hairline borders and row rules'], ['--ln-2', 'Line', 'Stronger borders: controls, overlays'],
    ['--tx', 'Text', 'Primary text'], ['--tx-2', 'Text', 'Secondary text'], ['--tx-3', 'Text', 'Muted text, placeholders, icons'],
    ['--acc', 'Accent', 'Primary action, selection, focus ring'], ['--acc-h', 'Accent', 'Primary action hover'], ['--acc-p', 'Accent', 'Primary action pressed'], ['--acc-ink', 'Accent', 'Text and icons on --acc'], ['--acc-soft', 'Accent', 'Selected row and item fill'], ['--acc-tx', 'Accent', 'Accent-coloured text links'],
    ['--ok', 'Status', 'Succeeded, online, within target'], ['--ok-s', 'Status', 'Success fill'], ['--warn', 'Status', 'Warning, unreachable, degraded'], ['--warn-s', 'Status', 'Warning bar fill'], ['--err', 'Status', 'Failed, critical, destructive'], ['--err-s', 'Status', 'Danger bar fill'], ['--run', 'Status', 'Running, in progress'], ['--run-s', 'Status', 'Running fill'],
    ['--scrim', 'Overlay', 'Behind dialogs'], ['--tip-bg', 'Overlay', 'Tooltip background'], ['--tip-tx', 'Overlay', 'Tooltip text']
  ];
  const type = [
    ['Display (KPI value)', 'ES Build', 28, 500, 36, '0'], ['Page title', 'ES Build', 24, 500, 32, '0'], ['Drawer and dialog title', 'ES Build', 20, 500, 28, '0'], ['Brand wordmark', 'ES Build', 17, 500, 24, '0.005em'],
    ['Section title', 'Source Sans 3', 15, 600, 22, '0'], ['Body', 'Source Sans 3', 14, 400, 20, '0'], ['Body strong and buttons', 'Source Sans 3', 14, 600, 20, '0'], ['Help text', 'Source Sans 3', 13, 400, 18, '0'], ['Emphasis', 'Source Sans 3 italic', 14, 400, 20, '0'],
    ['Table cell', 'Tahoma', 13, 400, 18, '0'], ['Label and column header', 'Tahoma', 12, 400, 16, '0'], ['Caption and meta', 'Tahoma', 11, 400, 16, '0'], ['Log line', 'Tahoma', 12, 400, 20, '0']
  ];
  const space = [['--s-1', 4], ['--s-2', 8], ['--s-3', 12], ['--s-4', 16], ['--s-5', 20], ['--s-6', 24], ['--s-8', 32], ['--s-10', 40], ['--s-12', 48]];
  const layout = [
    ['Grid unit', '8 px; 4 px for tight icon gaps'], ['Header height', '52 px'], ['Navigation width', '240 px; collapsed 56 px; collapses itself below 1200 px'], ['Navigation item', '32 px high, 10 px side padding, 12 px icon gap, 2 px between items'],
    ['Product block in navigation', '168 px fixed height (5 items), so shared groups never move between products'], ['Navigation group label', '36 px high, label sits 6 px above its first item'], ['Page padding', '24 px left and right, 20 px above the title, 16 px below the header block'],
    ['Toolbar row', '44 px minimum, 12 px gap, 12 px below'], ['Table header row', '36 px'], ['Table row', '36 px, one line, 8 px cell padding, checkbox column 44 px'], ['Table footer', '36 px'],
    ['Drawer', '560–680 px wide, full height of the content area, 24 px padding, sub-tabs 40 px'], ['Dialog', 'Small 440 px, medium 600 px, large 720 px; 24 px padding; footer 56 px'], ['Wizard', 'Large dialog, stepper row 2 px bar + 20 px marker, body at least 420 px high'],
    ['Menu and popover', '280–440 px wide, item 36–44 px, 4 px vertical padding'], ['Toast', '320–440 px wide, 24 px from the bottom-right corner, stack gap 8 px, 5.2 s on screen'],
    ['Minimum width', '1024 px usable; designed for 1280–1920 px'], ['Corner radius', '0 everywhere (radio dots are the only circles)'], ['Borders', '1 px hairline: --ln for rules, --ln-2 for controls and overlays'],
    ['Focus ring', '2 px solid --acc, 1 px offset, on :focus-visible only'], ['Elevation', 'Only menus (--sh-menu) and overlays (--sh-over). Panels are flat.'], ['Z-order', 'Content 0 · sticky header 2 · drawer 20 · menu scrim 40 · header 45 · dialog 60 · toasts 80 · tooltip 9999']
  ];
  const motion = [
    ['Hover and colour changes', '100 ms, ease'], ['Menus and popovers open', '140 ms, translateY(-4 px) and fade'], ['Drawer open and close', '150 ms, translateX(40 px) and fade, cubic-bezier(.2,.7,.3,1)'],
    ['Dialog open and close', '150 ms, translateY(8 px) scale(.985) and fade'], ['Toast in and out', '150 ms rise and fade'], ['Page change', '150 ms, translateY(4 px) and fade'], ['Tab and segment indicator', '150 ms slide to the selected item'],
    ['Progress bars', 'width follows live data, 900 ms linear between ticks'], ['Looping', 'Only the running-job spinner (1 s per turn). Everything stops with prefers-reduced-motion.']
  ];
  const components = [
    ['Button, primary', 'Height 32 px (36 px in header and summary), padding 0 14 px, gap 8 px, 16 px icon; --acc fill, --acc-ink text, Source Sans 3 600 14 px. Hover --acc-h, pressed --acc-p and 1 px down. Disabled 45 % opacity with aria-disabled and a tooltip saying why.'],
    ['Button, secondary', 'Height 32 px, padding 0 12 px, 1 px --ln-2 border, --panel fill, --tx text. Hover --hover.'],
    ['Button, ghost', 'Height 32 px, padding 0 10–12 px, no border. Hover --hover.'],
    ['Button, danger', 'Ghost with --err text and --err-s hover; the confirming button in a destructive dialog is --err fill with --acc-ink text, enabled only after the name is typed.'],
    ['Icon button', '32 × 32 px (36 × 36 in header), 16 px icon (20 px for close in drawers and dialogs).'],
    ['Text input', 'Height 36 px, padding 0 10 px, --panel-2 fill, 1 px --ln border; focus border --acc plus ring; error border --err and a 12 px Tahoma message with an icon below.'],
    ['Search input', 'Height 36 px, 36 px left padding for the icon, keyboard hint chip on the right (Ctrl K).'],
    ['Select', 'Native select, height 36 px (32 px in toolbars), padding 0 8 px, same fill and border as inputs.'],
    ['Segmented control', 'Height 30 px inside a 1 px --ln-2 frame, padding 0 12–14 px, Tahoma 13 px; selected item gets an --acc-soft indicator that slides.'],
    ['Checkbox', '16 × 16 px square, 1 px --ln-2 border; checked --acc fill with a 12 px check in --acc-ink; mixed shows a minus.'],
    ['Radio', '16 px circle, 1 px border; checked --acc with a 4 px inner ring in the surface colour. Radio cards: 1 px border, selected --acc border, inner 1 px --acc ring, --acc-soft fill.'],
    ['Toggle', '32 × 18 px track, 12 px knob, 2 px padding; on: --acc track and --acc-ink knob moved 14 px.'],
    ['Tabs and sub-tabs', 'Height 40 px, padding 0 10–12 px, Source Sans 3 600 14 px; selected --tx with a 2 px --acc underline that slides; count in Tahoma 11 px --tx-3.'],
    ['Table', 'Panel with 1 px --ln border. Sticky 36 px header on --panel-2 with Tahoma 12 px --tx-2 sort buttons and an --acc arrow. 36 px rows, 1 px --ln rule, hover --hover, selected --acc-soft, open row adds a 2 px inset --acc line on the left. Numbers right-aligned with units, tabular figures. Text truncates with a tooltip.'],
    ['Status in a table', '16 px icon in the status colour plus the word in --tx. Never colour alone.'],
    ['Badge', '20–24 px high, padding 0 6–8 px, 1 px --ln-2 border, Tahoma 11–12 px --tx-2.'],
    ['Progress bar', '4 px high on --ln; --run while running, --ok when done, --err when failed; phase name and percentage above it.'],
    ['Stepper', 'Even columns; each has a 2 px bar (--acc when reached) and a 20 px square marker with the number or a check.'],
    ['Timeline', 'Five stages in a row; 20 px markers joined by 2 px lines; done stages filled --acc; current outlined with a spinner when a job runs.'],
    ['KPI tile', 'Inside one panel with 1 px dividers; 16 × 18 px padding; label Tahoma 12 px, value ES Build 28/36 px, sub line Tahoma 12 px --tx-3; optional 6 px segmented bar.'],
    ['Panel', '--panel fill, 1 px --ln border, 44–48 px header with a 15 px section title. Panels never nest.'],
    ['Warning bar', 'Min 40 px high, padding 0 12 px, --warn-s fill, 1 px --ln-2 border, triangle icon in --warn; text starts “Could not be read:” when something is unreachable.'],
    ['Danger bar', 'Same shape with --err-s fill and a --err icon.'],
    ['Info tooltip', 'Info icon button; tooltip --tip-bg, --tip-tx, Tahoma 12/16 px, padding 6 × 10 px, max 320 px, 350 ms delay on hover and 150 ms on keyboard focus. At most two per view.'],
    ['Empty state', 'Centred in the panel, 64 px vertical padding; one sentence in --tx-2 and one primary button.'],
    ['Loading state', '“Reading…” in the footer; eight skeleton rows with --skel bars 8 px high. No shimmer.'],
    ['Log viewer', '--panel-2, 1 px --ln border, Tahoma 12/20 px, columns: time 64 px, 16 px level icon, text; follows new lines; new lines fade in.'],
    ['File card', '1 px --ln-2 border, --panel-2 fill, 12 px padding, 20 px file icon, name in 600, meta in Tahoma 12 px, remove button 28 px.'],
    ['Menu', '--overlay, 1 px --ln-2 border, --sh-menu; items 36–44 px with a 16 px icon; selected item shows a check in --acc.'],
    ['Toast', '--overlay, 1 px --ln-2 border, --sh-menu; status icon, text that names the object, optional action in --acc-tx, dismiss button.'],
    ['Drawer', 'From the right over the content, --overlay, 1 px --ln-2 left border, --sh-over; kicker 12 px, title ES Build 20/28 px, status line, actions row, sub-tabs, scrolling body.'],
    ['Dialog', 'Centred on --scrim; --overlay, 1 px --ln-2 border, --sh-over. Confirmations are armed inside the same dialog. Destructive dialogs list exactly what is removed and ask for the name.']
  ];
  const oklchToHex = str => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(str || '');
    if (!m) return (str || '').trim();
    const L = +m[1], C = +m[2], H = +m[3] * Math.PI / 180, al = m[4] != null ? +m[4] : 1;
    const a = C * Math.cos(H), b = C * Math.sin(H);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s];
    const f = x => { x = Math.max(0, Math.min(1, x)); x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; return Math.round(x * 255).toString(16).padStart(2, '0'); };
    return '#' + rgb.map(f).join('') + (al < 1 ? Math.round(al * 255).toString(16).padStart(2, '0') : '');
  };
  const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const contrast = (h1, h2) => { const a = lum(h1), b = lum(h2); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const read = theme => {
    const el = document.createElement('div');
    el.setAttribute('data-ae', ''); el.setAttribute('data-theme', theme); el.style.display = 'none';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const out = {};
    tokens.concat([['--sh-menu'], ['--sh-over']]).forEach(([n]) => { out[n] = cs.getPropertyValue(n).trim(); });
    el.remove();
    return out;
  };
  return { tokens, type, space, layout, motion, components, oklchToHex, contrast, read };
})();
