import type { CSSProperties, HTMLAttributes } from 'react';
import { ICON_PATHS } from './iconPaths';

export const ICON_NAMES = Object.keys(ICON_PATHS);

type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** Icon name from ICON_PATHS, or "mark" for the brand mark. An empty name renders nothing. */
  name?: string;
  size?: number | string;
  /** Spins the glyph (running jobs). Accepts the prototype's "true"/"false" strings. */
  spin?: boolean | string;
  style?: CSSProperties;
  [data: `data-${string}`]: unknown;
};

/** Host360 Aegis icon: Lucide geometry, 24 grid, stroke 1.5, used at 16 and 20 px. */
export function Icon({ name = '', size = 16, spin, style, className, ...rest }: IconProps) {
  const s = +size || 16;
  const spinning = !!spin && spin !== 'false';
  return (
    <span
      {...rest}
      className={className ? `ae-icon ${className}` : 'ae-icon'}
      data-empty={name ? undefined : ''}
      style={{ width: s, height: s, ...style }}
    >
      {name === 'mark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2.25 19.75 5v6.4c0 4.7-3.2 8.55-7.75 10.35C7.45 19.95 4.25 16.1 4.25 11.4V5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="miter"
          />
          <g fill="currentColor">
            <rect x="7.5" y="7.4" width="9" height="1.7" />
            <rect x="8.5" y="10.4" width="7" height="1.7" />
            <rect x="9.5" y="13.4" width="5" height="1.7" />
            <rect x="10.5" y="16.4" width="3" height="1.7" />
          </g>
        </svg>
      ) : name ? (
        <svg
          className={spinning ? 'ae-spin' : undefined}
          xmlns="http://www.w3.org/2000/svg"
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || '<rect x="4" y="4" width="16" height="16"/>' }}
        />
      ) : null}
    </span>
  );
}
