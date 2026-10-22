import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { Btn, CheckBox, Field, InfoTip, RadioCard, SelectInput, Toggle } from '../ui/controls';
import { Bar, Panel, plural } from '../ui/layout';
import { Dialog, StepUp, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { inScope } from './common';
import { audit, useStore } from './store';

const STEP_UP = [
  { a: 'Delete backups or recovery points', locked: true },
  { a: 'Invoke failover (planned or unplanned)', locked: true },
  { a: 'Approve a cutover', locked: true },
  { a: 'Unlock compliance mode', locked: true },
  { a: 'Log in as a customer owner', locked: true },
  { a: 'Create or rotate API tokens and credentials', locked: false },
  { a: 'Remove a site or repository', locked: false },
  { a: 'Change roles or approval rules', locked: false },
  { a: 'Export the audit log', locked: false }
];

export function SignInTab({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const adm = ctx.can('admin', 'Changing sign-in rules');
  const [mode, setMode] = useState('all');
  const [methods, setMethods] = useState<Record<string, boolean>>({ 'Authenticator app': true, 'Security key (FIDO2)': true, SMS: true });
  const [grace, setGrace] = useState('7 days');
  const [steps, setSteps] = useState<Record<string, boolean>>(Object.fromEntries(STEP_UP.map(x => [x.a, x.locked || x.a.startsWith('Create')])));
  const [freshFor, setFreshFor] = useState('This action only');
  const [minLen, setMinLen] = useState('14');
  const [history, setHistory] = useState('12');
  const [lockAfter, setLockAfter] = useState('5 failures in 10 min');
  const [lockFor, setLockFor] = useState('30 min');
  const [idle, setIdle] = useState('30 min');
  const [absolute, setAbsolute] = useState('12 h');
  const [dirty, setDirty] = useState(false);
  const preview = useClosable<boolean>();
  const [verified, setVerified] = useState(false);
  const users = s.users.filter(u => inScope(ctx, u.customer) && u.status === 'active');
  const withMfa = users.filter(u => u.mfa !== 'Not set up');
  const sms = users.filter(u => u.mfa === 'SMS');
  const ch = <T,>(f: (v: T) => void) => (v: T) => { f(v); setDirty(true); };
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>
        <Bar tone={withMfa.length === users.length ? 'ok' : 'warn'} icon="lock">
          {withMfa.length} of {plural(users.length, 'active user')} use MFA{users.length - withMfa.length ? `; ${users.filter(u => u.mfa === 'Not set up').map(u => u.name).join(', ')} not yet` : ''}{sms.length ? ` · ${sms.length} on SMS` : ''}.
        </Bar>
        <Panel title="Multi-factor authentication" right={<InfoTip tip="Applies to password and single sign-on users. With single sign-on, Aegis accepts the identity provider's MFA claim and still asks for its own step-up before destructive actions." />}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div role="radiogroup" aria-label="Who must use MFA" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
              <RadioCard on={mode === 'all'} onClick={() => { setMode('all'); setDirty(true); }} title="Everyone" note="Recommended" />
              <RadioCard on={mode === 'admins'} onClick={() => { setMode('admins'); setDirty(true); }} title="Owners and Admins" note="Others choose" />
              <RadioCard on={mode === 'off'} onClick={() => { setMode('off'); setDirty(true); }} title="Optional" note="Not allowed for regulated customers" disabled={s.customers.some(c => c.frameworks.includes('RBI'))} why="Meridian Cooperative Bank is under RBI rules, which require MFA." />
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 24 }}>
              <legend style={{ padding: 0, marginBottom: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Allowed methods</legend>
              {Object.keys(methods).map(m => (
                <CheckBox key={m} on={methods[m]} onChange={v => { setMethods(x => ({ ...x, [m]: v })); setDirty(true); }}>
                  {m}
                </CheckBox>
              ))}
            </fieldset>
            {methods.SMS ? <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}><Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />SMS can be intercepted. Prefer an app or a security key.</p> : null}
            <Field id="mfa-grace" label="New users must enrol within">
              <SelectInput id="mfa-grace" value={grace} onChange={ch(setGrace)} options={['First sign-in', '3 days', '7 days', '14 days']} width={220} />
            </Field>
          </div>
        </Panel>
        <Panel
          title="Step-up before destructive actions"
          right={
            <Btn kind="outline" size="sm" icon="eye" onClick={() => { setVerified(false); preview.open(true); }}>
              Preview the challenge
            </Btn>
          }
        >
          <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STEP_UP.map(x => (
              <div key={x.a} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 36, borderBottom: '1px solid var(--ln)' }}>
                <span style={{ flex: 1 }}>{x.a}</span>
                {x.locked ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '12px var(--f-ui)', color: 'var(--tx-3)' }}><Icon name="lock" />Always</span> : null}
                <Toggle on={steps[x.a]} onChange={v => { if (!x.locked) { setSteps(st => ({ ...st, [x.a]: v })); setDirty(true); } }} label={x.a} perm={x.locked ? { ok: false, why: 'Required by Host360 policy.', op: 0.45 } : undefined} />
              </div>
            ))}
            <Field id="su-fresh" label="A step-up check counts for" style={{ marginTop: 12 }}>
              <SelectInput id="su-fresh" value={freshFor} onChange={ch(setFreshFor)} options={['This action only', '5 minutes', '10 minutes']} width={220} />
            </Field>
          </div>
        </Panel>
        <Panel title="Passwords and lock-out" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Local accounts only</span>}>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            <Field id="pw-len" label="Minimum length">
              <SelectInput id="pw-len" value={minLen} onChange={ch(setMinLen)} options={['12', '14', '16', '20']} />
            </Field>
            <Field id="pw-hist" label="Cannot reuse the last">
              <SelectInput id="pw-hist" value={history} onChange={ch(setHistory)} options={['5', '12', '24'].map(x => ({ v: x, label: `${x} passwords` }))} />
            </Field>
            <Field id="pw-rot" label="Forced change" hint="Not recommended; checked against known breached passwords instead.">
              <SelectInput id="pw-rot" value="Never" onChange={() => setDirty(true)} options={['Never', 'Every 90 days', 'Every 180 days']} />
            </Field>
            <Field id="pw-lock" label="Lock the account after">
              <SelectInput id="pw-lock" value={lockAfter} onChange={ch(setLockAfter)} options={['3 failures in 10 min', '5 failures in 10 min', '10 failures in 30 min']} />
            </Field>
            <Field id="pw-lockfor" label="Locked for">
              <SelectInput id="pw-lockfor" value={lockFor} onChange={ch(setLockFor)} options={['15 min', '30 min', '1 h', 'Until an admin unlocks it']} />
            </Field>
          </div>
        </Panel>
        <Panel title="Sessions">
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            <Field id="se-idle" label="Sign out after being idle for">
              <SelectInput id="se-idle" value={idle} onChange={ch(setIdle)} options={['15 min', '30 min', '1 h']} />
            </Field>
            <Field id="se-abs" label="Sign out after, regardless">
              <SelectInput id="se-abs" value={absolute} onChange={ch(setAbsolute)} options={['8 h', '12 h', '24 h']} />
            </Field>
          </div>
        </Panel>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <span style={{ flex: 1, alignSelf: 'center', font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
          <Btn kind="primary" icon="check" perm={adm} disabled={!dirty} why="Nothing has changed." onClick={() => { setDirty(false); audit({ who: 'priya.raman', customer: 'h360', what: 'Changed sign-in and MFA rules', object: 'Settings › Sign-in and MFA', when: ctx.now(), r: 'ok' }); ctx.toast('Sign-in and MFA rules saved', 'ok'); }}>
            Save changes
          </Btn>
        </div>
      </div>
      {preview.value ? (
        <Dialog
          title="Fail over Core services failover"
          sub="This is what people see before a protected action. Nothing runs from this preview."
          closing={preview.closing}
          onClose={preview.close}
          footer={
            <>
              <Btn kind="ghost" onClick={preview.close}>Close preview</Btn>
              <Btn kind="dangerSolid" icon="power" disabled={!verified} why="Confirm it is you first." onClick={() => { ctx.toast('Preview only: nothing was started', 'info'); preview.close(); }}>
                Start failover
              </Btn>
            </>
          }
        >
          <StepUp verified={verified} onVerified={() => setVerified(true)} />
        </Dialog>
      ) : null}
    </div>
  );
}
