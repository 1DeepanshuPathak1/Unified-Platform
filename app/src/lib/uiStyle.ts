import { useEffect, useState } from 'react';

/**
 * The visual style of the whole site, separate from light and dark.
 * Each style is a complete design: its own frame (where the navigation lives), typeface, shapes, density and colour.
 * The choice is kept per browser and applied as data-style on every page root.
 */
export type UiStyle = 'classic' | 'graphite' | 'horizon' | 'command' | 'ledger' | 'lumen' | 'atlas';

export type Frame = 'topbar' | 'column' | 'topnav' | 'rail' | 'index' | 'inset' | 'twolevel';

export type StyleInfo = {
  name: string;
  blurb: string;
  frame: Frame;
  frameLabel: string;
  font: string;
  /** Colours for the picker's drawing of the frame (light theme). */
  sw: { bg: string; side: string; top: string; card: string; acc: string; line: string; ink: string };
};

export const STYLE_ORDER: UiStyle[] = ['classic', 'graphite', 'horizon', 'command', 'ledger', 'lumen', 'atlas'];

export const STYLES: Record<UiStyle, StyleInfo> = {
  classic: {
    name: 'Classic',
    blurb: 'The original console: dark top bar, white navigation pane, rounded cards on a light working area.',
    frame: 'topbar',
    frameLabel: 'Top bar and side pane',
    font: 'Inter',
    sw: { bg: '#f2f4f6', side: '#ffffff', top: '#1d2a30', card: '#ffffff', acc: '#13827a', line: '#dfe3e8', ink: '#2b3036' }
  },
  graphite: {
    name: 'Graphite',
    blurb: 'Enterprise flat: a full-height dark column, square edges, white page bands and a blue accent.',
    frame: 'column',
    frameLabel: 'Full-height dark column',
    font: 'IBM Plex Sans',
    sw: { bg: '#f4f4f4', side: '#1c1e22', top: '#ffffff', card: '#ffffff', acc: '#2e5bd8', line: '#e0e0e0', ink: '#161616' }
  },
  horizon: {
    name: 'Horizon',
    blurb: 'Modern SaaS: no sidebar, navigation menus across the top, a centred page, soft elevated cards and pills.',
    frame: 'topnav',
    frameLabel: 'Top navigation, no sidebar',
    font: 'Plus Jakarta Sans',
    sw: { bg: '#f5f6fb', side: '#f5f6fb', top: '#ffffff', card: '#ffffff', acc: '#4f46e5', line: '#e4e6f0', ink: '#1e1b4b' }
  },
  command: {
    name: 'Command',
    blurb: 'Operations centre: an icon rail, a status bar along the bottom, dense rows, monospaced figures, amber on charcoal.',
    frame: 'rail',
    frameLabel: 'Icon rail and status bar',
    font: 'Space Grotesk and Plex Mono',
    sw: { bg: '#121417', side: '#0b0c0e', top: '#16181c', card: '#1b1e23', acc: '#f5a524', line: '#2a2e35', ink: '#e8eaed' }
  },
  ledger: {
    name: 'Ledger',
    blurb: 'Editorial report: serif headings, warm paper, a numbered text index, rules instead of boxes, wide margins.',
    frame: 'index',
    frameLabel: 'Numbered index and wide margins',
    font: 'Source Serif 4 and Source Sans 3',
    sw: { bg: '#f7f4ee', side: '#f7f4ee', top: '#f7f4ee', card: '#fffdf8', acc: '#1f5f4a', line: '#d9d2c3', ink: '#24211c' }
  },
  lumen: {
    name: 'Lumen',
    blurb: 'Floating glass: panels inset on a soft gradient, frosted surfaces, large radii and a violet accent.',
    frame: 'inset',
    frameLabel: 'Floating inset panels',
    font: 'Manrope',
    sw: { bg: 'linear-gradient(135deg,#e9e4ff,#dff3ff 55%,#fdeaf3)', side: 'rgba(255,255,255,.7)', top: 'rgba(255,255,255,.7)', card: 'rgba(255,255,255,.78)', acc: '#7c3aed', line: 'rgba(120,110,160,.18)', ink: '#231942' }
  },
  atlas: {
    name: 'Atlas',
    blurb: 'Cloud console: a dark product rail beside a section list, striped tables and a copper accent.',
    frame: 'twolevel',
    frameLabel: 'Product rail and section list',
    font: 'Work Sans',
    sw: { bg: '#f3f2f0', side: '#ffffff', top: '#ffffff', card: '#ffffff', acc: '#c2410c', line: '#e3e0db', ink: '#26221d' }
  }
};

const KEY = 'aegis.style.v1';
const EVT = 'aegis-style';
const isStyle = (s: unknown): s is UiStyle => typeof s === 'string' && (STYLE_ORDER as string[]).includes(s);

export function readStyle(): UiStyle {
  try {
    const s = localStorage.getItem(KEY);
    return isStyle(s) ? s : 'classic';
  } catch {
    return 'classic';
  }
}

export function writeStyle(s: UiStyle) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* storage can be unavailable; the style then lasts until the page reloads */
  }
  window.dispatchEvent(new CustomEvent(EVT, { detail: s }));
}

/** Calls back whenever the style changes on this page or in another tab. */
export function onStyle(cb: (s: UiStyle) => void) {
  const local = (e: Event) => {
    const d = (e as CustomEvent).detail;
    cb(isStyle(d) ? d : readStyle());
  };
  const other = (e: StorageEvent) => {
    if (e.key === KEY) cb(readStyle());
  };
  window.addEventListener(EVT, local);
  window.addEventListener('storage', other);
  return () => {
    window.removeEventListener(EVT, local);
    window.removeEventListener('storage', other);
  };
}

export function useUiStyle(): [UiStyle, (s: UiStyle) => void] {
  const [s, set] = useState<UiStyle>(readStyle);
  useEffect(() => onStyle(set), []);
  return [s, (v: UiStyle) => { set(v); writeStyle(v); }];
}
