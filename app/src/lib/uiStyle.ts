import { useEffect, useState } from 'react';

/**
 * The visual style of the whole site, separate from light and dark.
 * Classic is the original design; Graphite is a second, completely different design.
 * The choice is kept per browser and applied as data-style on every page root.
 */
export type UiStyle = 'classic' | 'graphite';
export const STYLES: Record<UiStyle, { name: string; blurb: string }> = {
  classic: { name: 'Classic', blurb: 'Teal, rounded cards, dark top bar' },
  graphite: { name: 'Graphite', blurb: 'Blue, square edges, dark side column' }
};
const KEY = 'aegis.style.v1';
const EVT = 'aegis-style';

export function readStyle(): UiStyle {
  try {
    return localStorage.getItem(KEY) === 'graphite' ? 'graphite' : 'classic';
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
  const local = (e: Event) => cb(((e as CustomEvent).detail as UiStyle) || readStyle());
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

export const nextStyle = (s: UiStyle): UiStyle => (s === 'classic' ? 'graphite' : 'classic');
