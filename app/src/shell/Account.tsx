import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { Btn, CheckBox, Field, SelectInput, Tabs, TextInput } from '../ui/controls';
import { Bar, Facts, H3, MiniTable } from '../ui/layout';
import { Dialog, StepUp } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { CUSTOMERS, ORCH_TZ, T, customerById } from '../data/platform';

const ITEM = pc('hover', 'background:var(--hover)');

export type AccountTab = 'profile' | 'mfa' | 'tokens';

/** The user menu: who you are, your account, the reference pages and sign out. */
export function UserMenu({ roleLine, side, themeIcon, themeLabel, onTheme, onAccount, links, onSignOut, onClose }: { roleLine: string; side: string; themeIcon: string; themeLabel: string; onTheme: () => void; onAccount: (t: AccountTab) => void; links: { href: string; label: string; icon: string }[]; onSignOut: () => void; onClose: () => void }) {
  const btn = (icon: string, label: string, onClick: () => void) => (
    <button type="button" role="menuitem" onClick={onClick} className={ITEM} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 36, padding: '0 16px', transition: 'background-color 100ms' }}>
      <Icon name={icon} style={{ color: 'var(--tx-3)' }} />
      {label}
    </button>
  );
  return (
    <div role="menu" aria-label="User" style={{ position: 'absolute', top: 44, right: 0, width: 288, background: 'var(--overlay)', border: '1px solid var(--ln-2)', boxShadow: 'var(--sh-menu)', animation: 'ae-pop 140ms var(--ease)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ln)' }}>
        <div style={{ fontWeight: 600 }}>Priya Raman</div>
        <div style={{ font: '12px/18px var(--f-ui)', color: 'var(--tx-3)' }}>priya.raman@host360.ai</div>
        <div style={{ marginTop: 6, font: '12px/18px var(--f-ui)', color: 'var(--tx-2)' }}>{roleLine}</div>
        <div style={{ font: '12px/18px var(--f-ui)', color: 'var(--tx-3)' }}>{side}</div>
      </div>
      <div style={{ padding: '4px 0' }}>
        {btn('user', 'Profile', () => onAccount('profile'))}
        {btn('lock', 'Sign-in and MFA', () => onAccount('mfa'))}
        {btn('key', 'API tokens', () => onAccount('tokens'))}
        {btn(themeIcon, themeLabel, onTheme)}
      </div>
      <div style={{ padding: '4px 0', borderTop: '1px solid var(--ln)' }}>
        {links.map(l => (
          <a key={l.href} role="menuitem" href={l.href} onClick={onClose} className={ITEM} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 16px', transition: 'background-color 100ms' }}>
            <Icon name={l.icon} style={{ color: 'var(--tx-3)' }} />
            {l.label}
          </a>
        ))}
      </div>
      <div style={{ padding: '4px 0', borderTop: '1px solid var(--ln)' }}>{btn('log-out', 'Sign out', onSignOut)}</div>
    </div>
  );
}

type Token = { id: string; name: string; scopes: string; created: string; expires: string; last: string };
const TOKENS: Token[] = [
  { id: 'tk1', name: 'Grafana read-only', scopes: 'Read workloads, jobs, alerts', created: T('02 Sep', '10:12'), expires: '02 Mar 2027', last: T('21 Oct', '16:04') },
  { id: 'tk2', name: 'Runbook automation', scopes: 'Run jobs · Read workloads', created: T('14 Jul', '17:40'), expires: '14 Jan 2027', last: T('20 Oct', '23:00') }
];
const SCOPES = ['Read workloads and applications', 'Read jobs and alerts', 'Run backup and restore jobs', 'Manage policies', 'Read audit log'];

/** Your own account: profile, sign-in methods and MFA, personal API tokens. */
export function AccountDialog({ ctx, tab: initial, closing, onClose }: { ctx: Ctx; tab: AccountTab; closing: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<AccountTab>(initial);
  const [tokens, setTokens] = useState(TOKENS);
  const [making, setMaking] = useState(false);
  const [tName, setTName] = useState('');
  const [tScopes, setTScopes] = useState<Record<string, boolean>>({ 'Read workloads and applications': true });
  const [tExp, setTExp] = useState('90 days');
  const [mfa, setMfa] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const create = () => {
    const tok = { id: 'tk' + Date.now(), name: tName.trim(), scopes: Object.keys(tScopes).filter(k => tScopes[k]).join(' · '), created: ctx.now(), expires: tExp === 'Never' ? 'Never' : tExp === '30 days' ? '20 Nov 2026' : tExp === '90 days' ? '19 Jan 2027' : '21 Oct 2027', last: 'Never used' };
    setTokens(t => [tok, ...t]);
    setShown(`aeg_pat_7Qm2${Math.random().toString(36).slice(2, 10)}XrD4c9Lw`);
    setMaking(false);
    setTName('');
    setMfa(false);
    ctx.toast(`Token ${tok.name} created`, 'ok');
  };
  return (
    <Dialog size="lg" title="Your account" sub="Priya Raman · priya.raman@host360.ai" closing={closing} onClose={onClose} bodyStyle={{ paddingTop: 0 }}>
      <Tabs<AccountTab> label="Account sections" value={tab} onChange={setTab} style={{ padding: 0, margin: '0 0 4px' }} tabs={[{ v: 'profile', label: 'Profile' }, { v: 'mfa', label: 'Sign-in and MFA' }, { v: 'tokens', label: 'API tokens', count: tokens.length }]} />
      {tab === 'profile' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'ae-fade 150ms var(--ease)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
            <Field id="acc-name" label="Name">
              <TextInput id="acc-name" value="Priya Raman" readOnly />
            </Field>
            <Field id="acc-title" label="Job title">
              <TextInput id="acc-title" value="Head of cloud operations" readOnly />
            </Field>
          </div>
          <Facts
            items={[
              { k: 'E-mail', v: 'priya.raman@host360.ai' },
              { k: 'Organisation', v: 'Host360 Managed Services · provider' },
              { k: 'Signs in with', v: 'Microsoft Entra ID (host360.ai)' },
              { k: 'Name and title', v: 'Managed by Entra ID. Change them there; they sync on next sign-in.', muted: true },
              { k: 'Times are shown in', v: ORCH_TZ },
              { k: 'Member since', v: T('18 Jan', '09:20') }
            ]}
          />
        </div>
      ) : null}
      {tab === 'mfa' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'ae-fade 150ms var(--ease)' }}>
          <Bar tone="info" icon="lock">
            Your organisation requires MFA for every user and a fresh check before destructive actions.
          </Bar>
          <section>
            <H3 right={<Btn kind="outline" size="sm" icon="plus" onClick={() => ctx.toast('Touch your security key to register it', 'info')}>Add a method</Btn>}>Sign-in methods</H3>
            <MiniTable
              label="Sign-in methods"
              cols={[{ label: 'Method' }, { label: 'Added', w: '190px' }, { label: 'Last used', w: '190px' }, { label: '', w: '84px', r: true }]}
              rows={[
                [<span key="a" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="key" /> YubiKey 5C NFC (default)</span>, T('18 Jan', '09:24'), T('21 Oct', '09:02'), <Btn key="b" kind="danger" size="sm" disabled why="Add another method before removing your only security key.">Remove</Btn>],
                [<span key="a" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="monitor" /> Microsoft Authenticator · iPhone 15</span>, T('18 Jan', '09:30'), T('14 Oct', '18:22'), <Btn key="b" kind="danger" size="sm" onClick={() => ctx.toast('Authenticator removed', 'ok')}>Remove</Btn>]
              ]}
            />
          </section>
          <section>
            <H3 right={<Btn kind="outline" size="sm" icon="refresh-cw" onClick={() => ctx.toast('10 new recovery codes generated; the old ones stopped working', 'ok')}>Generate new codes</Btn>}>Recovery codes</H3>
            <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>8 of 10 codes unused. Generated {T('18 Jan', '09:31')}.</p>
          </section>
          <section>
            <H3>Password</H3>
            <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>Your password is managed by Microsoft Entra ID. Aegis never stores it.</p>
          </section>
        </div>
      ) : null}
      {tab === 'tokens' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'ae-fade 150ms var(--ease)' }}>
          {shown ? (
            <section style={{ border: '1px solid var(--acc)', background: 'var(--acc-soft)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong style={{ fontWeight: 600 }}>Copy the token now. It is not shown again.</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <TextInput value={shown} readOnly mono width="100%" />
                <Btn kind="outline" icon="copy" onClick={() => { navigator.clipboard?.writeText(shown).catch(() => undefined); ctx.toast('Token copied', 'ok'); }}>
                  Copy
                </Btn>
              </div>
            </section>
          ) : null}
          {making ? (
            <section style={{ border: '1px solid var(--ln-2)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, animation: 'ae-fade 150ms var(--ease)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 180px', gap: 16 }}>
                <Field id="tok-name" label="Token name" err={tName && tokens.some(t => t.name === tName.trim()) ? 'You already have a token with this name.' : null}>
                  <TextInput id="tok-name" value={tName} onChange={setTName} placeholder="Terraform pipeline" />
                </Field>
                <Field id="tok-exp" label="Expires after">
                  <SelectInput id="tok-exp" value={tExp} onChange={setTExp} options={['30 days', '90 days', '1 year']} />
                </Field>
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <legend style={{ padding: 0, marginBottom: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>What the token can do (never more than your own role)</legend>
                {SCOPES.map(s => (
                  <CheckBox key={s} on={!!tScopes[s]} onChange={v => setTScopes(x => ({ ...x, [s]: v }))}>
                    {s}
                  </CheckBox>
                ))}
              </fieldset>
              {tName.trim() ? <StepUp verified={mfa} onVerified={() => setMfa(true)} /> : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn kind="ghost" onClick={() => setMaking(false)}>
                  Cancel
                </Btn>
                <Btn kind="primary" icon="key" disabled={!tName.trim() || !mfa || !Object.values(tScopes).some(Boolean) || tokens.some(t => t.name === tName.trim())} why={!tName.trim() ? 'Name the token.' : !mfa ? 'Confirm it is you first.' : 'Choose at least one permission.'} onClick={create}>
                  Create token
                </Btn>
              </div>
            </section>
          ) : (
            <div>
              <Btn kind="outline" icon="plus" onClick={() => { setMaking(true); setShown(null); }}>
                Create a token
              </Btn>
            </div>
          )}
          <MiniTable
            label="Personal API tokens"
            cols={[{ label: 'Name', w: 'minmax(0,1fr)' }, { label: 'Can', w: 'minmax(0,1.2fr)' }, { label: 'Expires', w: '104px' }, { label: 'Last used', w: '176px' }, { label: '', w: '72px', r: true }]}
            rows={tokens.map(t => [
              <strong key="n" style={{ fontWeight: 700 }}>{t.name}</strong>,
              <span key="s" data-tip={t.scopes} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--tx-2)' }}>{t.scopes}</span>,
              t.expires,
              <span key="l" style={{ color: 'var(--tx-2)' }}>{t.last}</span>,
              <Btn key="r" kind="danger" size="sm" onClick={() => { setTokens(x => x.filter(y => y.id !== t.id)); ctx.toast(`Token ${t.name} revoked`, 'ok'); }}>
                Revoke
              </Btn>
            ])}
            empty="You have no personal tokens. Service accounts are better for shared automation."
          />
        </div>
      ) : null}
    </Dialog>
  );
}

/** Persistent while a provider user works inside a customer's console. */
export function ActingBanner({ customer, owner, until, onReturn }: { customer: string; owner: string; until: string; onReturn: () => void }) {
  return (
    <div role="status" style={{ height: 36, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 0 16px', background: 'var(--warn-s)', borderBottom: '1px solid var(--warn)', position: 'relative', zIndex: 46 }}>
      <Icon name="user-check" style={{ color: 'var(--warn)' }} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <strong style={{ fontWeight: 600 }}>Priya Raman (Host360)</strong> is acting as <strong style={{ fontWeight: 600 }}>{owner}</strong>, owner of {customer}. Every action is recorded under priya.raman. Ends {until}.
      </span>
      <Btn kind="ghost" size="sm" icon="log-out" onClick={onReturn}>
        Return to Host360 console
      </Btn>
    </div>
  );
}

/** Provider side: open a customer's console as its owner, with a reason and a fresh MFA check. */
export function LoginAsDialog({ ctx, customerId, closing, onClose, onStart }: { ctx: Ctx; customerId: string; closing: boolean; onClose: () => void; onStart: (reason: string) => void }) {
  const c = customerById(customerId);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('1 hour');
  const [mfa, setMfa] = useState(false);
  const regulated = c.frameworks.some(f => ['RBI', 'IRDAI', 'SEBI'].includes(f));
  const blocked = c.status === 'suspended' || c.status === 'archived';
  return (
    <Dialog
      title={`Log in as the owner of ${c.name}`}
      sub={`You see and do exactly what ${c.owner} can. Every action is recorded under your name.`}
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" icon="user-check" disabled={blocked || reason.trim().length < 4 || !mfa} why={blocked ? `${c.name} is ${c.status}.` : reason.trim().length < 4 ? 'Give a reason or ticket number.' : 'Confirm it is you first.'} onClick={() => onStart(reason.trim())}>
            Open customer console
          </Btn>
        </>
      }
    >
      {blocked ? (
        <Bar tone="err" multiline>
          {c.name} is {c.status}. Reactivate it before acting as its owner.
        </Bar>
      ) : null}
      <Facts
        items={[
          { k: 'Acting as', v: `${c.owner} · ${c.ownerEmail}` },
          { k: 'Recorded as', v: 'priya.raman, acting as the owner' },
          { k: 'Customer is told', v: regulated ? `By e-mail at once (${c.frameworks.join(', ')} rule)` : 'In their audit log' }
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: 16 }}>
        <Field id="la-reason" label="Reason or ticket">
          <TextInput id="la-reason" value={reason} onChange={setReason} placeholder="SR-5521: review Wave 2 plan with the customer" />
        </Field>
        <Field id="la-dur" label="Ends after">
          <SelectInput id="la-dur" value={hours} onChange={setHours} options={['30 minutes', '1 hour', '4 hours']} />
        </Field>
      </div>
      {reason.trim().length >= 4 && !blocked ? <StepUp verified={mfa} onVerified={() => setMfa(true)} /> : null}
    </Dialog>
  );
}

export const ownerOf = (id: string) => {
  const c = CUSTOMERS.find(x => x.id === id)!;
  return { customer: c.id, owner: c.owner, ownerEmail: c.ownerEmail };
};
