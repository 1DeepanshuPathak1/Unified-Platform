import type { CSSProperties, ReactNode, MouseEvent, ChangeEvent } from 'react';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { pc } from '../lib/pseudo';
import type { Perm } from './ctx';

const HOVER = pc('hover', 'background:var(--hover)');
const HOVER_TX = pc('hover', 'color:var(--tx)');
const PRESS = pc('active', 'transform:translateY(1px)');

export type BtnKind = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerSolid' | 'link';

const BTN: Record<BtnKind, { style: CSSProperties; cls: string }> = {
  primary: {
    style: { padding: '0 14px', background: 'var(--acc)', color: 'var(--acc-ink)' },
    cls: `${pc('hover', 'background:var(--acc-h)')} ${PRESS}`
  },
  secondary: { style: { padding: '0 12px', border: '1px solid var(--ln-2)', background: 'var(--panel)' }, cls: HOVER },
  outline: { style: { padding: '0 12px', border: '1px solid var(--ln-2)' }, cls: HOVER },
  ghost: { style: { padding: '0 10px' }, cls: HOVER },
  danger: { style: { padding: '0 12px', color: 'var(--err)' }, cls: pc('hover', 'background:var(--err-s)') },
  dangerSolid: { style: { padding: '0 14px', background: 'var(--err)', color: 'var(--acc-ink)' }, cls: PRESS },
  link: { style: { padding: 0, color: 'var(--acc-tx)', height: 'auto', font: '600 13px var(--f-body)' }, cls: pc('hover', 'text-decoration:underline') }
};

type BtnProps = {
  kind?: BtnKind;
  icon?: string;
  iconAfter?: string;
  spin?: boolean;
  onClick?: (e: MouseEvent) => void;
  /** Disables the button and explains why in its tooltip. */
  perm?: Perm;
  disabled?: boolean;
  why?: string;
  size?: 'md' | 'sm';
  tip?: string;
  style?: CSSProperties;
  children?: ReactNode;
  ariaLabel?: string;
  type?: 'button' | 'submit';
};

/** Buttons: 32 px (28 px small), Source Sans 3 600 14 px, square. Disabled buttons stay focusable and say why. */
export function Btn({ kind = 'secondary', icon, iconAfter, spin, onClick, perm, disabled, why, size = 'md', tip, style, children, ariaLabel, type = 'button' }: BtnProps) {
  const off = disabled || (perm && !perm.ok);
  const reason = perm && !perm.ok ? perm.why : why;
  const k = BTN[kind];
  return (
    <button
      type={type}
      onClick={e => {
        if (off) return;
        onClick?.(e);
      }}
      aria-disabled={off ? 'true' : undefined}
      aria-label={ariaLabel}
      data-tip={off ? reason : tip}
      className={off ? undefined : k.cls}
      style={{
        height: size === 'sm' ? 28 : 32,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        flex: 'none',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        opacity: off ? 0.45 : 1,
        transition: 'background-color 100ms,opacity 100ms,transform 80ms',
        ...(size === 'sm' && kind !== 'link' ? { padding: '0 10px', fontSize: 13 } : null),
        ...k.style,
        ...(size === 'sm' && kind !== 'link' ? { padding: '0 10px' } : null),
        ...style
      }}
    >
      {icon ? <Icon name={icon} spin={spin} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} /> : null}
    </button>
  );
}

export function IconBtn({ icon, label, onClick, size = 32, iconSize = 16, perm, style }: { icon: string; label: string; onClick?: () => void; size?: number; iconSize?: number; perm?: Perm; style?: CSSProperties }) {
  const off = perm && !perm.ok;
  return (
    <button
      type="button"
      onClick={() => !off && onClick?.()}
      aria-label={label}
      aria-disabled={off ? 'true' : undefined}
      data-tip={off ? perm!.why : label}
      className={off ? undefined : pc('hover', 'background:var(--hover);color:var(--tx)')}
      style={{ width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center', color: 'var(--tx-2)', opacity: off ? 0.45 : 1, transition: 'background-color 100ms,color 100ms', ...style }}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

export type Opt<V extends string = string> = { v: V; label: string; count?: number | string; tip?: string; icon?: string; disabled?: boolean };

/** Segmented control: 30 px items in a 1 px --ln-2 frame; the selection indicator slides. */
export function Seg<V extends string>({ value, options, onChange, label, panel = true }: { value: V; options: Opt<NoInfer<V>>[]; onChange: (v: NoInfer<V>) => void; label: string; panel?: boolean }) {
  return (
    <Ind mode="fill" role="radiogroup" aria-label={label} style={{ display: 'flex', flex: 'none', alignSelf: 'flex-start', border: '1px solid var(--ln-2)', background: panel ? 'var(--panel)' : undefined }}>
      {options.map(o => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={o.disabled ? 'true' : undefined}
            data-tip={o.tip}
            onClick={() => !o.disabled && onChange(o.v)}
            className={HOVER_TX}
            style={{ height: 30, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, font: '13px var(--f-ui)', whiteSpace: 'nowrap', color: on ? 'var(--tx)' : 'var(--tx-2)', opacity: o.disabled ? 0.45 : 1, transition: 'color 100ms' }}
          >
            {o.icon ? <Icon name={o.icon} /> : null}
            {o.label}
            {o.count != null ? <span style={{ font: '11px var(--f-ui)', color: 'var(--tx-3)' }}>{o.count}</span> : null}
          </button>
        );
      })}
    </Ind>
  );
}

/** Tabs and sub-tabs: 40 px, Source Sans 3 600 14 px, 2 px --acc underline that slides. */
export function Tabs<V extends string>({ value, tabs, onChange, label, style }: { value: V; tabs: Opt<NoInfer<V>>[]; onChange: (v: NoInfer<V>) => void; label: string; style?: CSSProperties }) {
  return (
    <Ind mode="underline" role="tablist" aria-label={label} style={{ flex: 'none', display: 'flex', padding: '0 16px', borderBottom: '1px solid var(--ln)', overflowX: 'auto', overflowY: 'hidden', ...style }}>
      {tabs.map(t => {
        const on = t.v === value;
        return (
          <button
            key={t.v}
            type="button"
            role="tab"
            aria-selected={on}
            data-tip={t.tip}
            onClick={() => onChange(t.v)}
            className={HOVER_TX}
            style={{ height: 40, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, whiteSpace: 'nowrap', color: on ? 'var(--tx)' : 'var(--tx-2)', transition: 'color 100ms' }}
          >
            {t.icon ? <Icon name={t.icon} style={{ color: on ? 'var(--acc)' : 'var(--tx-3)' }} /> : null}
            {t.label}
            {t.count != null && t.count !== '' ? <span style={{ font: '11px var(--f-ui)', color: 'var(--tx-3)' }}>{t.count}</span> : null}
          </button>
        );
      })}
    </Ind>
  );
}

export function FilterInput({ value, onChange, placeholder, label, width = 260 }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; width?: number }) {
  return (
    <div style={{ position: 'relative', width, flex: 'none' }}>
      <Icon name="filter" style={{ position: 'absolute', left: 10, top: 8, color: 'var(--tx-3)', pointerEvents: 'none' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={pc('focus', 'border-color:var(--acc)')}
        style={{ width: '100%', height: 32, padding: '0 10px 0 34px', background: 'var(--panel)', border: '1px solid var(--ln-2)', font: '13px var(--f-ui)', transition: 'border-color 100ms' }}
      />
    </div>
  );
}

/** A labelled select for toolbars: "Type  All ▾". */
export function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: (string | Opt)[]; onChange: (v: string) => void }) {
  return (
    <label style={{ height: 32, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 0 10px', border: '1px solid var(--ln-2)', background: 'var(--panel)', font: '13px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={{ height: 30, border: 0, background: 'transparent', color: 'var(--tx)', font: '13px var(--f-ui)' }}>
        {options.map(o => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.label}</option>))}
      </select>
    </label>
  );
}

/** Toggle: 32 × 18 px track, 12 px knob; on = --acc track and --acc-ink knob moved 14 px. */
export function Toggle({ on, onChange, label, children, perm }: { on: boolean; onChange: (v: boolean) => void; label: string; children?: ReactNode; perm?: Perm }) {
  const off = perm && !perm.ok;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={off ? 'true' : undefined}
      data-tip={off ? perm!.why : undefined}
      onClick={() => !off && onChange(!on)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, font: '13px var(--f-ui)', opacity: off ? 0.45 : 1, whiteSpace: 'nowrap' }}
    >
      <span style={{ width: 32, height: 18, padding: 2, flex: 'none', display: 'flex', background: on ? 'var(--acc)' : 'transparent', border: `1px solid ${on ? 'var(--acc)' : 'var(--ln-2)'}`, transition: 'background-color 120ms,border-color 120ms' }}>
        <span style={{ width: 12, height: 12, background: on ? 'var(--acc-ink)' : 'var(--tx-3)', transform: on ? 'translateX(14px)' : 'none', transition: 'transform 120ms var(--ease),background-color 120ms' }} />
      </span>
      {children != null ? <span style={{ whiteSpace: 'normal', textAlign: 'left', minWidth: 0 }}>{children}</span> : null}
    </button>
  );
}

/** Checkbox: 16 px square; checked --acc with a 12 px check; mixed shows a minus. */
export function CheckBox({ on, mixed, onChange, label, children, disabled, why }: { on: boolean; mixed?: boolean; onChange: (v: boolean) => void; label?: string; children?: ReactNode; disabled?: boolean; why?: string }) {
  const filled = on || mixed;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : on}
      aria-label={label}
      aria-disabled={disabled ? 'true' : undefined}
      data-tip={disabled ? why : undefined}
      onClick={() => !disabled && onChange(!on)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textAlign: 'left', opacity: disabled ? 0.45 : 1 }}
    >
      <span
        className={pc('hover', 'border-color:var(--acc)')}
        style={{ width: 16, height: 16, flex: 'none', display: 'grid', placeItems: 'center', border: `1px solid ${filled ? 'var(--acc)' : 'var(--ln-2)'}`, background: filled ? 'var(--acc)' : 'transparent', color: 'var(--acc-ink)', transition: 'background-color 100ms,border-color 100ms' }}
      >
        <Icon name={mixed ? 'minus' : on ? 'check' : ''} size={12} />
      </span>
      {children}
    </button>
  );
}

const radioDot = (on: boolean) => (
  <span style={{ width: 16, height: 16, flex: 'none', borderRadius: '50%', border: `1px solid ${on ? 'var(--acc)' : 'var(--ln-2)'}`, boxShadow: on ? 'inset 0 0 0 4px var(--overlay)' : 'none', background: on ? 'var(--acc)' : 'transparent', transition: 'all 100ms' }} />
);

/** Radio card: 1 px border; selected --acc border, inner 1 px ring and --acc-soft fill. */
export function RadioCard({ on, onClick, title, note, tag, icon, disabled, why }: { on: boolean; onClick: () => void; title: ReactNode; note?: ReactNode; tag?: string; icon?: string; disabled?: boolean; why?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-disabled={disabled ? 'true' : undefined}
      data-tip={disabled ? why : undefined}
      onClick={() => !disabled && onClick()}
      className={pc('hover', `border-color:${on ? 'var(--acc)' : 'var(--ln-2)'}`)}
      style={{ display: 'grid', gridTemplateColumns: icon ? '16px 20px minmax(0,1fr) auto' : '16px minmax(0,1fr) auto', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 14px', border: `1px solid ${on ? 'var(--acc)' : 'var(--ln)'}`, background: on ? 'var(--acc-soft)' : 'transparent', boxShadow: on ? 'inset 0 0 0 1px var(--acc)' : 'none', opacity: disabled ? 0.45 : 1, textAlign: 'left', transition: 'border-color 100ms,background-color 100ms,box-shadow 100ms' }}
    >
      {radioDot(on)}
      {icon ? <Icon name={icon} size={20} style={{ color: on ? 'var(--acc)' : 'var(--tx-2)' }} /> : null}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{title}</span>
        {note ? <span style={{ display: 'block', fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>{note}</span> : null}
      </span>
      {tag ? <Tag>{tag}</Tag> : <span />}
    </button>
  );
}

export function Tag({ children, tone, style }: { children: ReactNode; tone?: 'acc' | 'warn' | 'err' | 'ok' | 'run'; style?: CSSProperties }) {
  const c = tone ? `var(--${tone === 'acc' ? 'acc-tx' : tone})` : 'var(--tx-2)';
  return (
    <span style={{ flex: 'none', height: 20, padding: '0 6px', display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${tone ? c : 'var(--ln-2)'}`, font: '11px/18px var(--f-ui)', color: c, whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  );
}

// ---- form fields ----
export const fieldLabel: CSSProperties = { font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' };
const FOCUS = pc('focus', 'border-color:var(--acc)');

export function Field({ id, label, hint, err, children, span, style }: { id?: string; label: ReactNode; hint?: ReactNode; err?: string | null; children: ReactNode; span?: number; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, gridColumn: span ? `span ${span}` : undefined, ...style }}>
      <label htmlFor={id} style={fieldLabel}>
        {label}
      </label>
      {children}
      {err ? (
        <span role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, font: '12px/16px var(--f-ui)', color: 'var(--err)', animation: 'ae-fade 120ms var(--ease)' }}>
          <Icon name="circle-alert" />
          {err}
        </span>
      ) : null}
      {hint && !err ? <span style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)', textWrap: 'pretty' } as CSSProperties}>{hint}</span> : null}
    </div>
  );
}

export function TextInput({ id, value, onChange, placeholder, type = 'text', invalid, mono, readOnly, width, autoFocus, inputMode }: { id?: string; value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; invalid?: boolean; mono?: boolean; readOnly?: boolean; width?: number | string; autoFocus?: boolean; inputMode?: 'numeric' | 'text' }) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      readOnly={readOnly}
      autoFocus={autoFocus}
      inputMode={inputMode}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
      placeholder={placeholder}
      aria-invalid={invalid ? 'true' : undefined}
      autoComplete="off"
      className={FOCUS}
      style={{ width, height: 36, padding: '0 10px', background: 'var(--panel-2)', border: `1px solid ${invalid ? 'var(--err)' : 'var(--ln)'}`, font: mono ? '13px var(--f-ui)' : '14px var(--f-body)', color: readOnly ? 'var(--tx-2)' : 'var(--tx)', transition: 'border-color 100ms' }}
    />
  );
}

export function SelectInput({ id, value, onChange, options, width, disabled }: { id?: string; value: string; onChange: (v: string) => void; options: (string | Opt)[]; width?: number | string; disabled?: boolean }) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className={FOCUS}
      style={{ width, height: 36, padding: '0 8px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '14px var(--f-body)', color: 'var(--tx)' }}
    >
      {options.map(o => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v} disabled={o.disabled}>{o.label}</option>))}
    </select>
  );
}

export function TextArea({ id, value, onChange, rows = 3, placeholder, mono }: { id?: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; mono?: boolean }) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={FOCUS}
      style={{ padding: '8px 10px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: mono ? '12px/20px var(--f-ui)' : '14px/20px var(--f-body)', resize: 'vertical' }}
    />
  );
}

/** Info icon whose tooltip carries the explanation. At most two per view. */
export function InfoTip({ tip, label = 'More information' }: { tip: string; label?: string }) {
  return (
    <button type="button" aria-label={label} data-tip={tip} style={{ width: 20, height: 20, flex: 'none', display: 'inline-grid', placeItems: 'center', color: 'var(--tx-3)', verticalAlign: 'middle' }}>
      <Icon name="info" />
    </button>
  );
}
