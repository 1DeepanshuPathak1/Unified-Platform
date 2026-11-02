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
    ['Display (KPI value)', 'Inter', 26, 600, 34, '-0.012em'], ['Page title', 'Inter', 22, 600, 30, '-0.012em'], ['Drawer and dialog title', 'Inter', 18, 600, 26, '-0.006em'], ['Brand wordmark', 'Inter', 16, 600, 24, '-0.01em'],
    ['Section and panel title', 'Inter', 14, 600, 20, '0'], ['Body', 'Inter', 14, 400, 20, '0'], ['Navigation item', 'Inter', 14, 400, 20, '0'], ['Buttons and tabs', 'Inter', 13, 500, 18, '0'], ['Form label', 'Inter', 13, 500, 18, '0'], ['Emphasis', 'Inter italic', 14, 400, 20, '0'],
    ['Table cell', 'Inter', 13, 400, 18, '0'], ['Column header and kicker', 'Inter', 12, 500, 16, '0'], ['Help text, caption and meta', 'Inter', 12, 400, 16, '0'], ['Navigation group label', 'Inter (upper case)', 11, 600, 16, '0.06em'], ['Log line', 'Inter', 12, 400, 20, '0']
  ];
  const space = [['--s-1', 4], ['--s-2', 8], ['--s-3', 12], ['--s-4', 16], ['--s-5', 20], ['--s-6', 24], ['--s-8', 32], ['--s-10', 40], ['--s-12', 48]];
  const layout = [
    ['Grid unit', '8 px; 4 px for tight icon gaps'], ['Frame', 'Dark top bar, white management pane on the left, light working area with cards: the layout of enterprise backup consoles'], ['Header height', '52 px, dark in both themes; its menus use the page colours'], ['Navigation width', '240 px; collapsed 56 px; collapses itself below 1200 px'], ['Navigation item', '32 px high, 10 px side padding, 4 px corners, 12 px icon gap; current item --acc-soft fill and --acc-tx text'],
    ['Product block in navigation', '168 px fixed height (5 items), so shared groups never move between products'], ['Navigation group label', '30 px high, upper case 11 px, sits 7 px above its first item'], ['Page padding', '24 px on every side; 24 px above the title, 20 px below the header block'],
    ['Toolbar row', '44 px minimum, 12 px gap, 12 px below; wraps onto a second row when narrow, actions stay on the right'], ['Table header row', '38 px on --panel-2'], ['Table row', '40 px, one line, 8 px cell padding, checkbox column 44 px'], ['Table footer', '38 px on --panel-2'],
    ['Drawer', '560–680 px wide, full height of the content area, 24 px padding, sub-tabs 40 px'], ['Dialog', 'Small 440 px, medium 600 px, large 720 px; 24 px padding; footer 60 px on --panel-2'], ['Wizard', '920 px; steps listed down a 208 px left pane, the step’s page on the right, Back and Next in the footer; body at least 440 px high'],
    ['Menu and popover', '280–440 px wide, item 36–44 px, 4 px vertical padding'], ['Toast', '320–440 px wide, 24 px from the bottom-right corner, stack gap 8 px, 5.2 s on screen'],
    ['Minimum width', '1024 px usable; designed for 1280–1920 px'], ['Corner radius', '4 px controls (--r-sm), 6 px cards, tables, menus and toasts (--r), 8 px dialogs (--r-lg); toggles and avatars are round'], ['Borders', '1 px hairline: --ln for cards and rules, --ln-2 for controls'],
    ['Focus ring', '2 px solid --acc, 1 px offset, on :focus-visible only'], ['Elevation', 'Cards and tables --sh-card (a 1–3 px soft shadow, none in dark); menus --sh-menu; drawers and dialogs --sh-over'], ['Z-order', 'Content 0 · sticky header 2 · drawer 20 · menu scrim 40 · header 45 · dialog 60 · toasts 80 · tooltip 9999']
  ];
  const motion = [
    ['Hover and colour changes', '100 ms, ease'], ['Menus and popovers open', '140 ms, translateY(-4 px) and fade'], ['Drawer open and close', '150 ms, translateX(40 px) and fade, cubic-bezier(.2,.7,.3,1)'],
    ['Dialog open and close', '150 ms, translateY(8 px) scale(.985) and fade'], ['Toast in and out', '150 ms rise and fade'], ['Page change', '150 ms, translateY(4 px) and fade'], ['Tab and segment indicator', '150 ms slide to the selected item'],
    ['Progress bars', 'width follows live data, 900 ms linear between ticks'], ['Looping', 'Only the running-job spinner (1 s per turn). Everything stops with prefers-reduced-motion.']
  ];
  const components = [
    ['Button, primary', 'Height 32 px (28 px small), padding 0 14 px, gap 8 px, 16 px icon, 4 px corners; --acc fill, --acc-ink text, Inter 500 13 px. Hover --acc-h, pressed --acc-p and 1 px down. Disabled 45 % opacity with aria-disabled and a tooltip saying why.'],
    ['Button, secondary and outline', 'Height 32 px, padding 0 12 px, 4 px corners, 1 px --ln-2 border, --panel fill, a 1 px soft shadow, --tx text. Hover --hover.'],
    ['Button, ghost', 'Height 32 px, padding 0 10–12 px, no border. Hover --hover.'],
    ['Button, danger', 'Ghost with --err text and --err-s hover; the confirming button in a destructive dialog is --err fill with --acc-ink text, enabled only after the name is typed.'],
    ['Icon button', '32 × 32 px (36 × 36 in header), 4 px corners, 16 px icon (20 px for close in drawers and dialogs).'],
    ['Text input', 'Height 34 px, padding 0 10 px, 4 px corners, --panel fill (--panel-2 when read-only), 1 px --ln-2 border; focus border --acc plus ring; error border --err and a 12 px message with an icon below. Label Inter 500 13 px above, hint 12 px --tx-3 below.'],
    ['Search input', 'Height 36 px in the dark top bar, 36 px left padding for the icon, keyboard hint chip on the right (Ctrl K).'],
    ['Select', 'Native select, height 34 px (32 px in toolbars), padding 0 8 px, same fill, border and corners as inputs.'],
    ['Segmented control', '2 px inset inside a 1 px --ln-2 frame with 4 px corners; 26 px items, padding 0 10 px, Inter 13 px; selected item --acc-tx on an --acc-soft indicator that slides.'],
    ['Checkbox', '16 × 16 px, 3 px corners, 1 px --ln-2 border on --panel; checked --acc fill with a 12 px check in --acc-ink; mixed shows a minus.'],
    ['Radio', '16 px circle, 1 px border; checked --acc with a 4 px inner ring in the surface colour. Radio cards: 6 px corners, 1 px --ln-2 border on --panel; selected --acc border, inner 1 px --acc ring, --acc-soft fill.'],
    ['Toggle', '32 × 18 px pill track, 12 px round knob, 2 px padding; off --ln-2 track, on --acc track with the knob moved 14 px.'],
    ['Tabs and sub-tabs', 'Height 40 px, padding 0 12 px, Inter 500 14 px; selected --acc-tx with a 2 px --acc underline that slides; counts in a pill.'],
    ['Table', 'Card: 6 px corners, 1 px --ln border, --sh-card. Sticky 38 px header on --panel-2 with Inter 500 12 px --tx-2 sort buttons and an --acc arrow. 40 px rows, 1 px --ln rule, hover --hover, selected --acc-soft, open row adds a 2 px inset --acc line on the left. Numbers right-aligned with units in tabular figures. Text truncates with a tooltip. 38 px footer on --panel-2.'],
    ['Status in a table', '16 px icon in the status colour plus the word in --tx. Never colour alone.'],
    ['Badge', '20 px high, padding 0 7 px, 3 px corners, tinted border and fill in the tone colour (neutral: --ln-2 on --panel-2), Inter 500 11 px.'],
    ['Progress bar', '6 px high, round ends, on --ln; --run while running, --ok when done, --err when failed; phase name and percentage above it.'],
    ['Stepper', 'Even columns; each has a 3 px bar (--acc when reached) and a 20 px round marker with the number or a check.'],
    ['Timeline', 'Five stages in a row; 20 px markers joined by 2 px lines; done stages filled --acc; current outlined with a spinner when a job runs.'],
    ['KPI widget', 'One card per value with a 12–16 px gap: 6 px corners, 1 px --ln border, --sh-card, 16 × 20 px padding; title Inter 500 13 px --tx-2 with a status icon, value Inter 600 26/34 px, up to two lines of context 12 px --tx-3; optional 6 px segmented bar at the foot. A widget with a link lifts on hover and opens its filtered list.'],
    ['Panel (widget)', 'Card: --panel fill, 1 px --ln border, 6 px corners, --sh-card; 48 px header with a 14 px 600 title on the left and a link or control on the right. Panels never nest.'],
    ['Warning bar', 'Min 40 px high, padding 0 12 px, 4 px corners, --warn-s fill, a tinted border and a 3 px --warn edge on the left, triangle icon in --warn; text starts “Could not be read:” when something is unreachable.'],
    ['Danger bar', 'Same shape with --err-s fill, an --err edge and an --err icon.'],
    ['Info tooltip', 'Info icon button; tooltip --tip-bg, --tip-tx, Inter 12/16 px, 4 px corners, padding 6 × 10 px, max 320 px, 350 ms delay on hover and 150 ms on keyboard focus. At most two per view.'],
    ['Empty state', 'Centred in the card, 64 px vertical padding; one sentence in --tx-2 and one primary button.'],
    ['Loading state', '“Reading…” in the footer; eight skeleton rows with rounded --skel bars 8 px high. No shimmer.'],
    ['Log viewer', '--panel-2, 1 px --ln border, 6 px corners, Inter 12/20 px, columns: time 64 px in tabular figures, 16 px level icon, text; follows new lines; new lines fade in.'],
    ['File card', '1 px --ln-2 border, --panel-2 fill, 6 px corners, 12 px padding, 20 px file icon, name in 600, meta in 12 px, remove button 28 px.'],
    ['Menu', '--overlay, 1 px --ln border, 6 px corners, --sh-menu; items 36–44 px with a 16 px icon; selected item shows a check in --acc. Menus opened from the top bar use the page colours.'],
    ['Toast', '--overlay, 1 px --ln border, 6 px corners, --sh-menu; status icon, text that names the object, optional action in --acc-tx, dismiss button.'],
    ['Drawer', 'From the right over the content at the full height of the working area (never the height of the list); position in the list with previous and next beside Close; --overlay, 1 px --ln-2 left border, --sh-over; kicker 12 px 500, title Inter 600 18/26 px, status line, actions row, sub-tabs, scrolling body.'],
    ['Dialog', 'Centred on --scrim; --overlay, 1 px --ln border, 8 px corners, --sh-over; footer on --panel-2. Confirmations are armed inside the same dialog. Destructive dialogs list exactly what is removed and ask for the name.'],
    ['Wizard', 'Dialog with the steps listed in a left pane (number in a 22 px circle, done steps checked, current step on --acc-soft); the step’s title heads the page on the right.']
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
    tokens.concat([['--sh-card'], ['--sh-menu'], ['--sh-over']]).forEach(([n]) => { out[n] = cs.getPropertyValue(n).trim(); });
    el.remove();
    return out;
  };
  return { tokens, type, space, layout, motion, components, oklchToHex, contrast, read };
})();
