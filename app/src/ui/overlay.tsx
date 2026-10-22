import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { Btn, IconBtn, Tabs, TextInput, fieldLabel, type Opt } from './controls';
import { Bar, Stepper } from './layout';

/** Open/close state with the 150 ms exit animation. */
export function useClosable<T>() {
  const [value, setValue] = useState<T | null>(null);
  const [closing, setClosing] = useState(false);
  const t = useRef<number | undefined>(undefined);
  const open = useCallback((v: T) => {
    clearTimeout(t.current);
    setClosing(false);
    setValue(v);
  }, []);
  const close = useCallback(() => {
    setClosing(true);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      setValue(null);
      setClosing(false);
    }, 150);
  }, []);
  useEffect(() => () => clearTimeout(t.current), []);
  return { value, closing, open, close, isOpen: value != null };
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
}

type DrawerProps<V extends string> = {
  kicker: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  tabs?: Opt<V>[];
  tab?: V;
  onTab?: (v: V) => void;
  closing: boolean;
  onClose: () => void;
  width?: number;
  label: string;
  children: ReactNode;
};

/** Drawer: kicker, title, status line, action row, sub-tabs, scrolling body. Lists live here; edits open dialogs. */
export function Drawer<V extends string>({ kicker, title, status, actions, tabs, tab, onTab, closing, onClose, width = 600, label, children }: DrawerProps<V>) {
  useEscape(onClose);
  return (
    <aside
      role="dialog"
      aria-label={label}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width, maxWidth: '100%', zIndex: 20, display: 'flex', flexDirection: 'column', background: 'var(--overlay)', borderLeft: '1px solid var(--ln-2)', boxShadow: 'var(--sh-over)', animation: closing ? 'ae-drawer-out 150ms var(--ease) forwards' : 'ae-drawer 150ms var(--ease)' }}
    >
      <div style={{ flex: 'none', padding: '20px 16px 0 24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kicker}</div>
          <h2 style={{ marginTop: 2, font: '500 20px/28px var(--f-head)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
          {status ? <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 16, font: '13px/18px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{status}</div> : null}
        </div>
        <IconBtn icon="x" iconSize={20} label={`Close ${label.toLowerCase()}`} onClick={onClose} />
      </div>
      {actions ? <div style={{ flex: 'none', padding: '16px 24px', display: 'flex', gap: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>{actions}</div> : <div style={{ height: 16 }} />}
      {tabs && tab && onTab ? <Tabs label={`${label} sections`} value={tab} tabs={tabs} onChange={onTab} /> : null}
      <div key={tab} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px 24px 24px', animation: 'ae-fade 150ms var(--ease)' }}>
        {children}
      </div>
    </aside>
  );
}

type DialogProps = {
  title: ReactNode;
  sub?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closing?: boolean;
  onClose: () => void;
  footer?: ReactNode;
  footNote?: ReactNode;
  children: ReactNode;
  alert?: boolean;
  bodyStyle?: CSSProperties;
};

const SIZE = { sm: 440, md: 600, lg: 720 };

/** Dialog: centred on the scrim; small 440, medium 600, large 720 px; footer 56 px. */
export function Dialog({ title, sub, size = 'md', closing, onClose, footer, footNote, children, alert, bodyStyle }: DialogProps) {
  useEscape(onClose);
  const id = useRef('dlg-' + Math.random().toString(36).slice(2, 8)).current;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 24, background: 'var(--scrim)', animation: closing ? 'ae-fade-out 150ms var(--ease) forwards' : 'ae-fade 120ms var(--ease)' }}>
      <div
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={id}
        style={{ width: SIZE[size], maxWidth: '100%', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', background: 'var(--overlay)', border: '1px solid var(--ln-2)', boxShadow: 'var(--sh-over)', animation: closing ? 'ae-dialog-out 150ms var(--ease) forwards' : 'ae-dialog 150ms var(--ease)' }}
      >
        <div style={{ flex: 'none', padding: '20px 16px 0 24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={id} style={{ font: '500 20px/28px var(--f-head)' }}>
              {title}
            </h2>
            {sub ? <p style={{ marginTop: 2, color: 'var(--tx-2)' }}>{sub}</p> : null}
          </div>
          <IconBtn icon="x" iconSize={20} label="Close" onClick={onClose} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16, ...bodyStyle }}>{children}</div>
        {footer ? (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, minHeight: 56, padding: '12px 16px 12px 24px', borderTop: '1px solid var(--ln)' }}>
            <span style={{ flex: 1, font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{footNote}</span>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Large dialog with a stepper row; body at least 420 px high. */
export function Wizard({ title, sub, steps, step, closing, onClose, children, canBack, onBack, next, footNote }: { title: ReactNode; sub?: ReactNode; steps: string[]; step: number; closing?: boolean; onClose: () => void; children: ReactNode; canBack?: boolean; onBack?: () => void; next: ReactNode; footNote?: ReactNode }) {
  useEscape(onClose);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 24, background: 'var(--scrim)', animation: closing ? 'ae-fade-out 150ms var(--ease) forwards' : 'ae-fade 120ms var(--ease)' }}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Wizard'} style={{ width: 720, maxWidth: '100%', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', background: 'var(--overlay)', border: '1px solid var(--ln-2)', boxShadow: 'var(--sh-over)', animation: closing ? 'ae-dialog-out 150ms var(--ease) forwards' : 'ae-dialog 150ms var(--ease)' }}>
        <div style={{ flex: 'none', padding: '20px 16px 0 24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ font: '500 20px/28px var(--f-head)' }}>{title}</h2>
            {sub ? <p style={{ marginTop: 2, color: 'var(--tx-2)' }}>{sub}</p> : null}
          </div>
          <IconBtn icon="x" iconSize={20} label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ln)' }}>
          <Stepper steps={steps} current={step} />
        </div>
        <div key={step} style={{ flex: 1, minHeight: 420, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'ae-step 150ms var(--ease)' }}>
          {children}
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 12px 24px', borderTop: '1px solid var(--ln)' }}>
          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{footNote ?? `Step ${step + 1} of ${steps.length}`}</span>
          <span style={{ flex: 1 }} />
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          {canBack ? (
            <Btn kind="outline" icon="chevron-left" onClick={onBack}>
              Back
            </Btn>
          ) : null}
          {next}
        </div>
      </div>
    </div>
  );
}

/**
 * Step-up challenge, armed inside the dialog that asks for it.
 * Any six digits verify in the prototype.
 */
export function StepUp({ verified, onVerified, who = 'priya.raman@host360.ai' }: { verified: boolean; onVerified: () => void; who?: string }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'bad'>('idle');
  const check = () => {
    if (!/^\d{6}$/.test(code)) {
      setState('bad');
      return;
    }
    setState('checking');
    window.setTimeout(() => {
      setState('idle');
      onVerified();
    }, 650);
  };
  if (verified)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '0 12px', border: '1px solid var(--ln)', background: 'var(--ok-s)', animation: 'ae-fade 150ms var(--ease)' }}>
        <Icon name="user-check" style={{ color: 'var(--ok)' }} />
        <span>Identity confirmed for {who}. Valid for this action only.</span>
      </div>
    );
  return (
    <section style={{ border: '1px solid var(--ln-2)', background: 'var(--panel-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--ln)' }}>
        <Icon name="key" style={{ color: 'var(--acc)' }} />
        <span style={{ flex: 1, fontWeight: 600 }}>Confirm it is you</span>
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Step-up MFA</span>
      </div>
      <div style={{ padding: 12, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 200 }}>
          <label htmlFor="stepup-code" style={fieldLabel}>
            6-digit code from your authenticator app
          </label>
          <TextInput id="stepup-code" value={code} onChange={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setState('idle'); }} placeholder="000 000" mono inputMode="numeric" invalid={state === 'bad'} />
        </div>
        <Btn kind="outline" icon={state === 'checking' ? 'loader-circle' : 'check'} spin={state === 'checking'} onClick={check}>
          Verify
        </Btn>
        <span style={{ flex: 1 }} />
        <Btn kind="link" onClick={() => { setState('checking'); window.setTimeout(() => { setState('idle'); onVerified(); }, 900); }}>
          Use a security key
        </Btn>
      </div>
      {state === 'bad' ? (
        <div style={{ padding: '0 12px 10px', display: 'flex', alignItems: 'center', gap: 6, font: '12px/16px var(--f-ui)', color: 'var(--err)' }}>
          <Icon name="circle-alert" />
          Enter the six digits shown in the app.
        </div>
      ) : null}
    </section>
  );
}

export type ApprovalNeed = { rule: string; approvers: string; expires: string };

type DangerProps = {
  title: ReactNode;
  intro: ReactNode;
  removed: ReactNode[];
  kept?: ReactNode;
  /** The name the user types to confirm. */
  name: string;
  nameLabel?: string;
  action: string;
  icon?: string;
  stepUp?: boolean;
  approval?: ApprovalNeed | null;
  warning?: ReactNode;
  closing?: boolean;
  onClose: () => void;
  /** Called with "done" or, when approval is required, "requested". */
  onConfirm: (result: 'done' | 'requested') => void;
  children?: ReactNode;
};

/**
 * Destructive or irreversible action. Everything is armed in this one dialog:
 * the exact list of what goes, the typed name, step-up MFA, and approval where policy requires it.
 */
export function DangerDialog({ title, intro, removed, kept, name, nameLabel, action, icon = 'trash-2', stepUp = true, approval, warning, closing, onClose, onConfirm, children }: DangerProps) {
  const [typed, setTyped] = useState('');
  const [mfa, setMfa] = useState(!stepUp);
  const named = typed.trim() === name;
  const ready = named && mfa;
  const label = approval ? 'Request approval' : action;
  const why = !named ? `Type ${name} to confirm.` : !mfa ? 'Confirm it is you first.' : undefined;
  return (
    <Dialog
      alert
      title={title}
      sub={intro}
      closing={closing}
      onClose={onClose}
      footNote={approval ? `Nothing happens until ${approval.approvers} approves.` : undefined}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="dangerSolid" icon={approval ? 'send' : icon} disabled={!ready} why={why} onClick={() => onConfirm(approval ? 'requested' : 'done')}>
            {label}
          </Btn>
        </>
      }
    >
      {warning}
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)' }}>
        {removed.map((x, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderBottom: i < removed.length - 1 ? '1px solid var(--ln)' : 'none' }}>
            <Icon name="minus" style={{ color: 'var(--err)', marginTop: 2 }} />
            <span>{x}</span>
          </li>
        ))}
      </ul>
      {kept ? <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>{kept}</p> : null}
      {children}
      {approval ? (
        <Bar tone="info" icon="user-check" multiline>
          <strong style={{ fontWeight: 600 }}>{approval.rule}.</strong> Submitting creates an approval request for {approval.approvers}. It expires {approval.expires}.
        </Bar>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="danger-confirm" style={fieldLabel}>
          {nameLabel || 'Type'} <strong style={{ color: 'var(--tx)' }}>{name}</strong> to confirm
        </label>
        <input
          id="danger-confirm"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          autoComplete="off"
          className={pc('focus', 'border-color:var(--err)')}
          style={{ height: 36, padding: '0 10px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '14px var(--f-body)' }}
        />
      </div>
      {stepUp && named ? <StepUp verified={mfa} onVerified={() => setMfa(true)} /> : null}
    </Dialog>
  );
}
