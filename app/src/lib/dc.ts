import { Component, type CSSProperties } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Base class for the ported screens. Each screen keeps the prototype's shape:
 * `renderVals()` derives a flat view model from props and state, and `render()`
 * reads it as `v`, with props merged underneath, as the design runtime did.
 */
export class DC extends Component<any, any> {
  // Screens keep timers, refs and handlers as ad-hoc instance fields.
  [key: string]: any;

  renderVals(): Record<string, any> {
    return {};
  }

  vals(): Record<string, any> {
    return { ...this.props, ...(this.renderVals() || {}) };
  }
}

/** A list binding: anything that is not an array renders as nothing. */
export const arr = (x: unknown): any[] => (Array.isArray(x) ? x : []);

const kebabToCamel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Parses a CSS declaration string into a React style object. */
export function css(text: unknown): CSSProperties | undefined {
  if (typeof text !== 'string') return (text as CSSProperties) ?? undefined;
  const o: Record<string, string> = {};
  for (const decl of text.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    o[prop.startsWith('--') ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
  }
  return o as CSSProperties;
}
