import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { Btn, CheckBox, Field, RadioCard, SelectInput, TextInput } from '../ui/controls';
import { Activity, Bar, DrawerTiles, Facts, H3, MiniTable, Panel, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, StepUp, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { CUSTOMERS, USERS } from '../data/platform';
import { BREAK_GLASS, DELEGATIONS, IDPS, SCIM_LOG, SERVICE_ACCOUNTS, type Delegation, type Idp, type ServiceAccount } from '../data/admin';
import { custName, inScope, showCustomerCol } from './common';
import { audit } from './store';

const short = (t: string) => t.replace(' 2026', '').replace(' IST', '');
const copy = (ctx: Ctx, text: string, what: string) =>
  navigator.clipboard?.writeText(text).then(
    () => ctx.toast(`${what} copied`, 'ok'),
    () => ctx.toast('Copy is blocked here. Select the text and copy it yourself.', 'warn')
  );

// ============ Single sign-on and SCIM ============
const IDP_STATE: Record<Idp['state'], { i: string; l: string; c: string }> = {
  active: { i: 'circle-check', l: 'Enforced', c: 'ok' },
  testing: { i: 'flask-conical', l: 'Testing, not enforced', c: 'run' },
  error: { i: 'triangle-alert', l: 'Could not be read', c: 'warn' }
};

export function SsoTab({ ctx }: { ctx: Ctx }) {
  const [idps, setIdps] = useState<Idp[]>(IDPS);
  const drawer = useClosable<string>();
  const add = useClosable<boolean>();
  const [tab, setTab] = useState<'overview' | 'scim' | 'log'>('overview');
  const [reveal, setReveal] = useState(false);
  const [mfa, setMfa] = useState(false);
  const rows = idps.filter(i => inScope(ctx, i.customer));
  const showCust = showCustomerCol(ctx);
  const adm = ctx.can('admin', 'Changing single sign-on');
  const d = drawer.value ? idps.find(i => i.id === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>People from a verified domain sign in through their identity provider. SCIM keeps people and roles in step.</span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={adm} onClick={() => add.open(true)}>
          Add an identity provider
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Identity providers"
          cols={[
            { k: 'n', label: 'Identity provider', w: 'minmax(170px,1.4fr)' },
            ...(showCust ? [{ k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true }] : []),
            { k: 'p', label: 'Protocol', w: '120px', dim: true },
            { k: 'dom', label: 'Domains', w: 'minmax(130px,1fr)', dim: true },
            { k: 'u', label: 'People', w: '72px', r: true },
            { k: 'scim', label: 'SCIM', w: '150px' },
            { k: 's', label: 'State', w: '170px' }
          ]}
          rows={rows.map(i => ({
            id: i.id,
            n: { v: i.name, strong: true },
            c: custName(i.customer),
            p: i.protocol,
            dom: i.domains.join(', '),
            u: { v: String(i.users), s: i.users },
            scim: !i.scim ? { v: 'Off', muted: true } : i.scim.errors ? { t: 'status', i: 'triangle-alert', c: 'warn', l: plural(i.scim.errors, 'error'), tip: 'A group is not mapped to a role' } : { t: 'status', i: 'refresh-cw', c: 'ok', l: `Synced ${short(i.scim.lastSync).split(', ')[1]}` },
            s: { t: 'status', ...IDP_STATE[i.state], tip: i.note || IDP_STATE[i.state].l }
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('overview'); setReveal(false); setMfa(false); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['identity provider', 'identity providers']}
          emptyText="No identity provider yet. People sign in with a password and MFA until you add one."
          emptyAction="Add an identity provider"
          onEmpty={() => add.open(true)}
          footR="Local passwords stay only for break-glass accounts once a provider is enforced"
          sort="n"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Identity provider"
          kicker={`${d.vendor} · ${d.protocol} · ${custName(d.customer)}`}
          title={d.name}
          status={<><Status icon={IDP_STATE[d.state].i} tone={IDP_STATE[d.state].c} label={IDP_STATE[d.state].l} /><span>{plural(d.users, 'person', 'people')}</span></>}
          actions={
            <>
              <Btn kind="outline" icon="play" perm={adm} onClick={() => { audit({ who: 'priya.raman', customer: d.customer, what: 'Tested single sign-on', object: d.name, when: ctx.now(), r: d.state === 'error' ? 'failed' : 'ok' }); ctx.toast(d.state === 'error' ? `Test failed: ${d.name} could not be read` : `Test sign-in through ${d.name} worked`, d.state === 'error' ? 'err' : 'ok'); }}>
                Test sign-in
              </Btn>
              {d.state === 'testing' ? (
                <Btn kind="primary" icon="check" perm={adm} onClick={() => { setIdps(x => x.map(i => (i.id === d.id ? { ...i, state: 'active', note: undefined } : i))); audit({ who: 'priya.raman', customer: d.customer, what: 'Enforced single sign-on', object: d.name, when: ctx.now(), r: 'ok' }); ctx.toast(`People at ${d.domains.join(', ')} now sign in through ${d.vendor}`, 'ok'); }}>
                  Enforce for {d.domains[0]}
                </Btn>
              ) : null}
            </>
          }
          tabs={[
            { v: 'overview', label: 'Overview' },
            { v: 'scim', label: 'SCIM' },
            { v: 'log', label: 'Provisioning log', count: SCIM_LOG.filter(l => l.customer === d.customer).length }
          ]}
          tab={tab}
          onTab={t => setTab(t as typeof tab)}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.note ? <Bar tone={d.state === 'error' ? 'warn' : 'info'} multiline>{d.note}</Bar> : null}
              <Facts
                items={[
                  { k: 'Protocol', v: d.protocol },
                  { k: 'Verified domains', v: d.domains.join(', '), icon: 'badge-check', tone: 'ok' },
                  { k: 'MFA from the provider', v: d.mfaClaim ? 'Accepted (amr claim); Aegis still asks for step-up before destructive actions' : 'Not sent; Aegis asks for its own MFA', muted: !d.mfaClaim },
                  ...(d.certExpires ? [{ k: 'Signing certificate', v: `Expires ${d.certExpires}` }] : []),
                  { k: 'Sign-in URL', v: <code key="u" style={{ font: '12px var(--f-ui)' }}>https://aegis.host360.ai/sso/{d.customer}</code> },
                  { k: 'Last sign-in', v: d.lastSignIn }
                ]}
              />
            </div>
          ) : null}
          {tab === 'scim' ? (
            d.scim ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <DrawerTiles items={[{ label: 'Created', value: d.scim.created, sub: 'Today' }, { label: 'Updated', value: d.scim.updated, sub: 'Today' }, { label: 'Deactivated', value: d.scim.deactivated, sub: 'Today' }, { label: 'Errors', value: d.scim.errors, icon: d.scim.errors ? 'triangle-alert' : undefined, tone: 'warn' }]} />
                <Facts items={[{ k: 'SCIM endpoint', v: <code key="e" style={{ font: '12px var(--f-ui)' }}>{d.scim.endpoint}</code> }, { k: 'Last sync', v: d.scim.lastSync }, { k: 'Bearer token', v: reveal ? <code key="t" style={{ font: '12px var(--f-ui)' }}>scim_{d.customer}_9Qw7…E41c (shown once more until 16:20 IST)</code> : '••••••••••••••••', muted: !reveal }]} />
                {!reveal ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <StepUp verified={mfa} onVerified={() => { setMfa(true); setReveal(true); audit({ who: 'priya.raman', customer: d.customer, what: 'Revealed the SCIM token', object: d.name, when: ctx.now(), r: 'ok' }); }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn kind="outline" icon="copy" onClick={() => copy(ctx, `scim_${d.customer}_9Qw7E41c`, 'Token')}>Copy token</Btn>
                    <Btn kind="outline" icon="refresh-cw" perm={adm} onClick={() => { audit({ who: 'priya.raman', customer: d.customer, what: 'Rotated the SCIM token', object: d.name, when: ctx.now(), r: 'ok' }); ctx.toast('New SCIM token made. The old one works for 24 h; paste the new one into the provider.', 'ok'); }}>Rotate token</Btn>
                  </div>
                )}
                <div>
                  <H3>Groups to roles</H3>
                  <MiniTable label="Groups to roles" cols={[{ label: 'Group in the provider' }, { label: 'Role in Aegis', w: '180px' }]} rows={d.scim.groups.map(([g, r]) => [<code key="g" style={{ font: '12px var(--f-ui)' }}>{g}</code>, r])} />
                  {d.scim.errors ? <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>MBK-Treasury-Svc is not mapped. People only in that group are not created until it maps to a role.</p> : null}
                </div>
              </div>
            ) : (
              <Bar tone="info" multiline>SCIM is off. People are created at their first sign-in and keep the default role Read-only until someone changes it.</Bar>
            )
          ) : null}
          {tab === 'log' ? (
            <Activity items={SCIM_LOG.filter(l => l.customer === d.customer).map(l => ({ icon: l.r === 'ok' ? (l.event === 'Deactivated' ? 'user-x' : 'user-check') : 'circle-x', tone: l.r === 'ok' ? 'info' : 'err', text: <><strong style={{ fontWeight: 600 }}>{l.event}</strong> {l.who}: {l.detail}</>, when: l.when }))} />
          ) : null}
        </Drawer>
      ) : null}
      {add.value ? (
        <IdpWizard
          ctx={ctx}
          closing={add.closing}
          onClose={add.close}
          onAdded={i => {
            setIdps(x => [...x, i]);
            add.close();
          }}
        />
      ) : null}
    </>
  );
}

function IdpWizard({ ctx, closing, onClose, onAdded }: { ctx: Ctx; closing: boolean; onClose: () => void; onAdded: (i: Idp) => void }) {
  const [step, setStep] = useState(0);
  const [vendor, setVendor] = useState<Idp['vendor']>('Entra ID');
  const [cust, setCust] = useState(ctx.actingAs?.customer || 'nil');
  const [issuer, setIssuer] = useState('');
  const [client, setClient] = useState('');
  const [domain, setDomain] = useState('');
  const [verified, setVerified] = useState(false);
  const [tested, setTested] = useState(false);
  const [enforce, setEnforce] = useState(false);
  const [scim, setScim] = useState(true);
  const saml = vendor === 'Okta' || vendor === 'Generic SAML';
  const valid = [true, !!issuer.trim() && (saml || !!client.trim()), verified, tested][step];
  const why = ['', saml ? 'Paste the metadata URL.' : 'Give the issuer URL and the client ID.', 'Verify the domain first.', 'Run a test sign-in first.'][step];
  const VENDORS: Idp['vendor'][] = ['Entra ID', 'Okta', 'Google Workspace', 'Keycloak', 'Generic SAML', 'Generic OIDC'];
  const finish = () => {
    const c = CUSTOMERS.find(x => x.id === cust)!;
    audit({ who: 'priya.raman', customer: cust, what: `Added identity provider (${vendor})`, object: c.name, when: ctx.now(), r: 'ok', note: enforce ? 'Enforced' : 'Testing' });
    ctx.toast(`${vendor} added for ${c.name}${enforce ? ' and enforced' : '; not enforced yet'}`, 'ok');
    onAdded({ id: 'idp' + Date.now(), customer: cust, name: `${c.name.split(' ')[0]} ${vendor}`, vendor, protocol: saml ? 'SAML 2.0' : 'OpenID Connect', domains: [domain], state: enforce ? 'active' : 'testing', users: 0, mfaClaim: true, lastSignIn: ctx.now(), scim: scim ? { on: true, endpoint: `https://aegis.host360.ai/scim/v2/${cust}`, lastSync: 'Waiting for the first push', created: 0, updated: 0, deactivated: 0, errors: 0, groups: [] } : undefined });
  };
  return (
    <Wizard
      title="Add an identity provider"
      sub="Single sign-on for one customer. Nothing changes for its people until you enforce it."
      steps={['Provider', 'Connect', 'Domain', 'Test and enforce']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={
        step < 3 ? (
          <Btn kind="primary" iconAfter="chevron-right" disabled={!valid} why={why} onClick={() => setStep(step + 1)}>
            Next
          </Btn>
        ) : (
          <Btn kind="primary" icon="check" disabled={!valid} why={why} onClick={finish}>
            {enforce ? 'Add and enforce' : 'Add without enforcing'}
          </Btn>
        )
      }
    >
      {step === 0 ? (
        <>
          <Field id="ip-c" label="Customer">
            <SelectInput id="ip-c" value={cust} onChange={setCust} options={CUSTOMERS.filter(c => inScope(ctx, c.id) && c.status !== 'archived').map(c => ({ v: c.id, label: c.name }))} />
          </Field>
          <div role="radiogroup" aria-label="Provider" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
            {VENDORS.map(v => (
              <RadioCard key={v} on={vendor === v} onClick={() => setVendor(v)} title={v} note={v === 'Okta' || v === 'Generic SAML' ? 'SAML 2.0' : 'OpenID Connect'} />
            ))}
          </div>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Facts labelW={200} items={saml ? [{ k: 'Entity ID to give the provider', v: <code key="e" style={{ font: '12px var(--f-ui)' }}>https://aegis.host360.ai/saml/{cust}</code> }, { k: 'Reply (ACS) URL', v: <code key="a" style={{ font: '12px var(--f-ui)' }}>https://aegis.host360.ai/saml/{cust}/acs</code> }] : [{ k: 'Redirect URI to give the provider', v: <code key="r" style={{ font: '12px var(--f-ui)' }}>https://aegis.host360.ai/oidc/{cust}/callback</code> }]} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
            <Field id="ip-iss" label={saml ? 'Metadata URL' : 'Issuer URL'} span={saml ? 2 : 1}>
              <TextInput id="ip-iss" value={issuer} onChange={setIssuer} placeholder={saml ? 'https://acme.okta.com/app/exk…/sso/saml/metadata' : vendor === 'Entra ID' ? 'https://login.microsoftonline.com/<tenant>/v2.0' : 'https://accounts.google.com'} mono />
            </Field>
            {!saml ? (
              <Field id="ip-cl" label="Client ID">
                <TextInput id="ip-cl" value={client} onChange={setClient} mono />
              </Field>
            ) : null}
          </div>
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Claims used: email, name and groups. Groups map to roles on the SCIM tab after the provider is added.</p>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Field id="ip-dom" label="Domain your people sign in with">
            <TextInput id="ip-dom" value={domain} onChange={v => { setDomain(v); setVerified(false); }} placeholder="nilgiriretail.in" />
          </Field>
          {domain.trim() ? (
            <>
              <p style={{ color: 'var(--tx-2)' }}>Add this TXT record to the domain’s DNS, then check:</p>
              <code style={{ padding: '8px 10px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px/18px var(--f-ui)' }}>
                _aegis-verify.{domain.trim()} TXT "aegis-verify=7f3a91d2c044"
              </code>
              <div>
                <Btn kind="outline" icon={verified ? 'badge-check' : 'radar'} onClick={() => { setVerified(true); ctx.toast(`${domain.trim()} verified`, 'ok'); }}>
                  {verified ? 'Verified' : 'Check DNS'}
                </Btn>
              </div>
            </>
          ) : null}
        </>
      ) : null}
      {step === 3 ? (
        <>
          <div>
            <Btn kind="outline" icon={tested ? 'circle-check' : 'play'} onClick={() => { setTested(true); ctx.toast('Test sign-in worked: name, e-mail and 2 groups came back', 'ok'); }}>
              {tested ? 'Test sign-in worked' : 'Run a test sign-in'}
            </Btn>
          </div>
          <CheckBox on={scim} onChange={setScim}>Turn on SCIM provisioning (creates, updates and deactivates people and their roles)</CheckBox>
          <CheckBox on={enforce} onChange={setEnforce}>Enforce now: people at {domain || 'this domain'} can no longer sign in with a password</CheckBox>
          {enforce ? <Bar tone="warn" multiline>Make sure the break-glass accounts work before you enforce. They are the only way in if the provider goes down.</Bar> : null}
        </>
      ) : null}
    </Wizard>
  );
}

// ============ Service accounts ============
export function ServiceAccountsTab({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<ServiceAccount[]>(SERVICE_ACCOUNTS);
  const drawer = useClosable<string>();
  const create = useClosable<boolean>();
  const token = useClosable<string>();
  const revoke = useClosable<{ sa: string; tok: string }>();
  const rows = list.filter(a => inScope(ctx, a.customer));
  const showCust = showCustomerCol(ctx);
  const adm = ctx.can('admin', 'Managing service accounts');
  const d = drawer.value ? list.find(a => a.id === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Accounts for scripts and integrations. They have no password and cannot sign in to the console.</span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={adm} onClick={() => create.open(true)}>
          Create a service account
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Service accounts"
          cols={[
            { k: 'n', label: 'Account', w: 'minmax(150px,1.2fr)' },
            ...(showCust ? [{ k: 'c', label: 'Customer', w: 'minmax(120px,1fr)', dim: true }] : []),
            { k: 'scope', label: 'Scope and role', w: 'minmax(200px,1.6fr)', dim: true },
            { k: 'lu', label: 'Last used', w: '120px' },
            { k: 'exp', label: 'Token expires', w: '130px' },
            { k: 'rot', label: 'Rotation', w: '130px', dim: true },
            { k: 's', label: 'State', w: '150px' }
          ]}
          rows={rows.map(a => {
            const t = a.tokens[0];
            return {
              id: a.id,
              n: { v: a.name, strong: true, tip: a.purpose },
              c: custName(a.customer),
              scope: `${a.role} · ${a.scope}`,
              lu: t ? short(t.lastUsed).split(',')[0] : { v: 'Never', muted: true },
              exp: t ? (a.state === 'expiring' ? { t: 'status', i: 'clock', c: 'warn', l: short(t.expires).split(',')[0], tip: 'Expires in 7 days' } : short(t.expires).split(',')[0]) : '—',
              rot: a.rotation,
              s: a.state === 'unused' ? { t: 'status', i: 'triangle-alert', c: 'warn', l: 'Unused 111 days', tip: 'Not used since 02 Jul; consider revoking' } : a.state === 'expiring' ? { t: 'status', i: 'clock', c: 'warn', l: 'Token expiring' } : { t: 'status', i: 'circle-check', c: 'ok', l: 'Active' }
            };
          })}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['service account', 'service accounts']}
          emptyText="No service accounts. Create one for each script or integration so its access can be limited and revoked on its own."
          emptyAction="Create a service account"
          onEmpty={() => create.open(true)}
          footR="Tokens are shown once, when they are made"
          sort="n"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Service account"
          kicker={`Service account · ${custName(d.customer)}`}
          title={d.name}
          status={<><span>{d.role}</span><span>{d.scope}</span><span>Owner {d.owner}</span></>}
          actions={
            <>
              <Btn kind="primary" icon="key" perm={adm} onClick={() => token.open(d.id)}>
                New token…
              </Btn>
              <Btn kind="outline" icon="refresh-cw" perm={adm} onClick={() => { audit({ who: 'priya.raman', customer: d.customer, what: 'Rotated a service account token', object: d.name, when: ctx.now(), r: 'ok' }); ctx.toast(`New token made for ${d.name}; the old one stops working in 24 h`, 'ok'); }}>
                Rotate
              </Btn>
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {d.state === 'unused' ? <Bar tone="warn" multiline>Not used since 02 Jul from {d.tokens[0].from}, an address outside India. Revoke the token if the script is gone.</Bar> : null}
            <Facts items={[{ k: 'Purpose', v: d.purpose }, { k: 'Scope', v: d.scope }, { k: 'Role', v: d.role }, { k: 'Allowed from', v: d.ipAllow, muted: d.ipAllow === 'Any' }, { k: 'Rotation', v: d.rotation }]} />
            <div>
              <H3>Tokens</H3>
              <MiniTable
                label="Tokens"
                cols={[{ label: 'Token', w: '130px' }, { label: 'Expires', w: '110px' }, { label: 'Last used' }, { label: '', w: '72px' }]}
                rows={d.tokens.map(t => [<code key="p" style={{ font: '12px var(--f-ui)' }}>{t.prefix}</code>, short(t.expires).split(',')[0], `${short(t.lastUsed)} from ${t.from}`, <Btn key="r" kind="danger" size="sm" perm={adm} onClick={() => revoke.open({ sa: d.id, tok: t.id })}>Revoke</Btn>])}
                empty="No tokens. Make one when the integration is ready."
              />
            </div>
          </div>
        </Drawer>
      ) : null}
      {create.value ? <CreateServiceAccount ctx={ctx} closing={create.closing} onClose={create.close} onCreate={a => { setList(x => [...x, a]); create.close(); }} /> : null}
      {token.value ? <TokenDialog ctx={ctx} sa={list.find(a => a.id === token.value)!} closing={token.closing} onClose={token.close} /> : null}
      {revoke.value
        ? (() => {
            const a = list.find(x => x.id === revoke.value!.sa)!;
            const t = a.tokens.find(x => x.id === revoke.value!.tok)!;
            return (
              <DangerDialog
                title={`Revoke token ${t.prefix}`}
                intro={`${a.name} stops working at once wherever this token is used.`}
                removed={[`Token ${t.prefix}, last used ${short(t.lastUsed)} from ${t.from}`]}
                kept="The service account and its other tokens stay."
                name={a.name}
                action="Revoke token"
                closing={revoke.closing}
                onClose={revoke.close}
                onConfirm={() => {
                  setList(x => x.map(y => (y.id === a.id ? { ...y, tokens: y.tokens.filter(z => z.id !== t.id) } : y)));
                  audit({ who: 'priya.raman', customer: a.customer, what: 'Revoked a service account token', object: `${a.name} · ${t.prefix}`, when: ctx.now(), r: 'ok' });
                  ctx.toast(`Token ${t.prefix} revoked`, 'ok');
                  revoke.close();
                }}
              />
            );
          })()
        : null}
    </>
  );
}

function CreateServiceAccount({ ctx, closing, onClose, onCreate }: { ctx: Ctx; closing: boolean; onClose: () => void; onCreate: (a: ServiceAccount) => void }) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [cust, setCust] = useState('h360');
  const [role, setRole] = useState('Read-only');
  const [ip, setIp] = useState('');
  const [rot, setRot] = useState('Every 90 days');
  const err = !/^[a-z0-9-]{3,40}$/.test(name) ? 'Name it with lower-case letters, digits and hyphens.' : !purpose.trim() ? 'Say what it is for.' : null;
  return (
    <Dialog
      title="Create a service account"
      sub="Give it the narrowest role and scope that does the job."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="check" disabled={!!err} why={err || undefined} onClick={() => { const c = CUSTOMERS.find(x => x.id === cust)!; audit({ who: 'priya.raman', customer: cust, what: 'Created a service account', object: name, when: ctx.now(), r: 'ok', note: `${role} on ${c.name}` }); ctx.toast(`${name} created. Make its first token from the drawer.`, 'ok'); onCreate({ id: 'sa' + Date.now(), name, customer: cust, purpose: purpose.trim(), scope: c.name, role, ipAllow: ip.trim() || 'Any', tokens: [], rotation: rot, owner: 'Priya Raman', state: 'active' }); }}>
            Create
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="sa-n" label="Name"><TextInput id="sa-n" value={name} onChange={setName} placeholder="svc-grafana" mono /></Field>
        <Field id="sa-c" label="Scope"><SelectInput id="sa-c" value={cust} onChange={setCust} options={CUSTOMERS.filter(c => inScope(ctx, c.id)).map(c => ({ v: c.id, label: c.name }))} /></Field>
        <Field id="sa-p" label="What it is for" span={2}><TextInput id="sa-p" value={purpose} onChange={setPurpose} placeholder="Reads job results for the NOC dashboard" /></Field>
        <Field id="sa-r" label="Role"><SelectInput id="sa-r" value={role} onChange={setRole} options={['Read-only', 'Auditor', 'Backup Operator', 'Restore Operator', 'Admin']} /></Field>
        <Field id="sa-i" label="Allowed from (CIDR)" hint="Leave empty to allow any address; not recommended."><TextInput id="sa-i" value={ip} onChange={setIp} placeholder="10.20.0.0/16" mono /></Field>
        <Field id="sa-rot" label="Token rotation"><SelectInput id="sa-rot" value={rot} onChange={setRot} options={['Every 30 days', 'Every 90 days', 'Every 180 days', 'Every 365 days']} /></Field>
      </div>
    </Dialog>
  );
}

function TokenDialog({ ctx, sa, closing, onClose }: { ctx: Ctx; sa: ServiceAccount; closing: boolean; onClose: () => void }) {
  const [exp, setExp] = useState('90 days');
  const [mfa, setMfa] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  return (
    <Dialog
      title={`New token for ${sa.name}`}
      sub="The token is shown once. Store it in the integration's secret store."
      closing={closing}
      onClose={onClose}
      footer={
        made ? (
          <>
            <Btn kind="outline" icon="copy" onClick={() => copy(ctx, made, 'Token')}>Copy</Btn>
            <Btn kind="primary" onClick={onClose}>I have stored it</Btn>
          </>
        ) : (
          <>
            <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
            <Btn kind="primary" icon="key" disabled={!mfa} why="Confirm it is you first." onClick={() => { const t = `aeg_${sa.name.slice(0, 2)}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 14)}`; setMade(t); audit({ who: 'priya.raman', customer: sa.customer, what: 'Created a service account token', object: sa.name, when: ctx.now(), r: 'ok', note: `Expires in ${exp}` }); }}>
              Make token
            </Btn>
          </>
        )
      }
    >
      {made ? (
        <>
          <Bar tone="warn">This is the only time the token is shown.</Bar>
          <code style={{ padding: '10px 12px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '13px var(--f-ui)', wordBreak: 'break-all', userSelect: 'all' }}>{made}</code>
        </>
      ) : (
        <>
          <Field id="tk-exp" label="Expires after">
            <SelectInput id="tk-exp" value={exp} onChange={setExp} options={['30 days', '90 days', '180 days', '365 days']} />
          </Field>
          <StepUp verified={mfa} onVerified={() => setMfa(true)} />
        </>
      )}
    </Dialog>
  );
}

// ============ Break-glass ============
export function BreakGlassTab({ ctx }: { ctx: Ctx }) {
  const emergency = useClosable<boolean>();
  const test = useClosable<string>();
  const [uses, setUses] = useState(BREAK_GLASS.uses);
  const adm = ctx.can('admin', 'Using break-glass access');
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1040 }}>
      <Bar tone="info" icon="key" multiline>
        Break-glass accounts get you in when single sign-on or the identity provider is down. They are sealed: two people each hold half the password, and a hardware key sits in a DC safe.
      </Bar>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Accounts" right={<Btn kind="outline" size="sm" icon="triangle-alert" perm={adm} onClick={() => emergency.open(true)}>Emergency sign-in…</Btn>}>
          <div style={{ padding: '0 16px 4px' }}>
            <MiniTable
              label="Break-glass accounts"
              cols={[{ label: 'Account', w: '120px' }, { label: 'Held by' }, { label: 'Next test', w: '100px' }, { label: '', w: '64px' }]}
              rows={BREAK_GLASS.accounts.map(a => [<strong key="n" style={{ fontWeight: 600 }}>{a.name}</strong>, <span key="h" data-tip={a.key} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.holders.join(' and ')}</span>, short(a.nextTest).split(',')[0], <Btn key="t" kind="ghost" size="sm" perm={adm} onClick={() => test.open(a.name)}>Test</Btn>])}
            />
          </div>
        </Panel>
        <Panel title="Rules">
          <ul style={{ listStyle: 'none', padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {BREAK_GLASS.rules.map(r => (
              <li key={r} style={{ display: 'flex', gap: 8 }}>
                <Icon name="pin" style={{ color: 'var(--tx-3)', marginTop: 2 }} />
                {r}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Every use">
        <div style={{ padding: '0 16px 4px' }}>
          <MiniTable label="Break-glass uses" cols={[{ label: 'When', w: '170px' }, { label: 'Account', w: '110px' }, { label: 'Kind', w: '96px' }, { label: 'Why' }, { label: 'Took', w: '84px' }, { label: 'Review', w: '200px' }]} rows={uses.map(u => [u.when, u.who, u.kind === 'Emergency' ? <Status key="k" icon="triangle-alert" tone="warn" label="Emergency" /> : 'Test', <span key="w" data-tip={u.why} data-tip-overflow="" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.why}</span>, u.dur, u.review])} />
        </div>
      </Panel>
      {emergency.value ? <EmergencyDialog ctx={ctx} closing={emergency.closing} onClose={emergency.close} onUsed={u => { setUses(x => [u, ...x]); emergency.close(); }} /> : null}
      {test.value ? (
        <Dialog title={`Test ${test.value}`} sub="Both holders and the key are needed. The test session lasts 10 minutes and is reviewed like a real one." closing={test.closing} onClose={test.close} footer={<><Btn kind="ghost" onClick={test.close}>Cancel</Btn><Btn kind="primary" icon="play" onClick={() => { setUses(x => [{ when: ctx.now(), who: test.value!, why: 'Test run from Settings', dur: '—', review: 'Waiting for the security officer', kind: 'Test' }, ...x]); audit({ who: 'priya.raman', customer: 'h360', what: 'Started a break-glass test', object: test.value!, when: ctx.now(), r: 'ok' }); ctx.toast(`Test of ${test.value} recorded. Vivek Rao was told.`, 'ok'); test.close(); }}>Record the test</Btn></>}>
          <p style={{ color: 'var(--tx-2)' }}>Sign in at https://aegis.host360.ai/break-glass with both halves and the key, check you land on Home, then sign out. Come back here to record it.</p>
        </Dialog>
      ) : null}
    </div>
  );
}

function EmergencyDialog({ ctx, closing, onClose, onUsed }: { ctx: Ctx; closing: boolean; onClose: () => void; onUsed: (u: (typeof BREAK_GLASS.uses)[number]) => void }) {
  const [acct, setAcct] = useState('bg-host360-1');
  const [h1, setH1] = useState('');
  const [h2, setH2] = useState('');
  const [key, setKey] = useState(false);
  const [why, setWhy] = useState('');
  const ok = h1.length >= 8 && h2.length >= 8 && key && why.trim().length > 10;
  return (
    <Dialog
      alert
      title="Emergency sign-in"
      sub="This is what the break-glass page asks for. Use it only when normal sign-in is down."
      closing={closing}
      onClose={onClose}
      footNote="Session ends after 4 hours."
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="dangerSolid" icon="key" disabled={!ok} why="Both halves, the key and a reason are needed." onClick={() => { audit({ who: acct, customer: 'h360', what: 'Break-glass sign-in', object: acct, when: ctx.now(), r: 'ok', note: why.trim() }); ctx.toast(`Signed in as ${acct} until 20:05 IST. 4 Owners and the security officer were told.`, 'warn'); onUsed({ when: ctx.now(), who: acct, why: why.trim(), dur: 'In progress', review: 'Due within 48 h', kind: 'Emergency' }); }}>
            Break the glass
          </Btn>
        </>
      }
    >
      <Field id="bg-a" label="Account"><SelectInput id="bg-a" value={acct} onChange={setAcct} options={BREAK_GLASS.accounts.map(a => a.name)} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="bg-1" label="First half (holder 1)"><TextInput id="bg-1" type="password" value={h1} onChange={setH1} /></Field>
        <Field id="bg-2" label="Second half (holder 2)"><TextInput id="bg-2" type="password" value={h2} onChange={setH2} /></Field>
      </div>
      <div>
        <Btn kind="outline" icon={key ? 'circle-check' : 'key'} onClick={() => setKey(true)}>{key ? 'Hardware key touched' : 'Touch the hardware key'}</Btn>
      </div>
      <Field id="bg-w" label="Why, with the incident number"><TextInput id="bg-w" value={why} onChange={setWhy} placeholder="INC-20440: Entra ID sign-in failing for every user" /></Field>
    </Dialog>
  );
}

// ============ Delegated administration ============
export function DelegationTab({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Delegation[]>(DELEGATIONS);
  const create = useClosable<boolean>();
  const revoke = useClosable<string>();
  const rows = list.filter(d => inScope(ctx, d.customer));
  const adm = ctx.can('admin', 'Delegating administration');
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Let someone run part of the hierarchy. They can never grant more than they have, and Owners above them keep control.</span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={adm} onClick={() => create.open(true)}>
          Delegate…
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Delegations"
          cols={[{ k: 'w', label: 'Person', w: 'minmax(150px,1fr)' }, { k: 'sub', label: 'Runs', w: 'minmax(220px,1.6fr)' }, { k: 'can', label: 'Can', w: 'minmax(200px,1.6fr)', dim: true }, { k: 'by', label: 'Granted by', w: '150px', dim: true }, { k: 'exp', label: 'Ends', w: '120px' }, { k: 'x', label: '', w: '84px' }]}
          rows={rows.map(d => ({
            id: d.id,
            w: { v: d.who, strong: true, tip: d.email },
            sub: d.subtree,
            can: { v: d.can.join(', '), tip: `Cannot: ${d.cannot.join(', ')}` },
            by: d.by,
            exp: d.expires === 'No end date' ? { v: 'No end date', muted: true } : short(d.expires).split(',')[0],
            x: { t: 'btn', v: 'Revoke', onClick: () => revoke.open(d.id), disabled: !adm.ok, why: adm.why }
          }))}
          state={ctx.ui}
          unit={['delegation', 'delegations']}
          emptyText="Nothing is delegated. Owners and Admins run the whole tenant."
          emptyAction="Delegate"
          onEmpty={() => create.open(true)}
          footR="Every delegated change is recorded under the delegate and shown to the Owner"
          sort="w"
        />
      </TableArea>
      {create.value ? <DelegateDialog ctx={ctx} closing={create.closing} onClose={create.close} onCreate={d => { setList(x => [...x, d]); create.close(); }} /> : null}
      {revoke.value
        ? (() => {
            const d = list.find(x => x.id === revoke.value)!;
            return (
              <Dialog
                alert
                title={`Revoke ${d.who}'s delegation`}
                sub={`${d.who} keeps their own roles but can no longer administer ${d.subtree}.`}
                closing={revoke.closing}
                onClose={revoke.close}
                footer={<><Btn kind="ghost" onClick={revoke.close}>Cancel</Btn><Btn kind="danger" icon="user-x" onClick={() => { setList(x => x.filter(y => y.id !== d.id)); audit({ who: 'priya.raman', customer: d.customer, what: 'Revoked a delegation', object: `${d.who} · ${d.subtree}`, when: ctx.now(), r: 'ok' }); ctx.toast(`Delegation to ${d.who} revoked`, 'ok'); revoke.close(); }}>Revoke</Btn></>}
              >
                <p style={{ color: 'var(--tx-2)' }}>People and roles they created stay. Changes they started but did not finish are cancelled.</p>
              </Dialog>
            );
          })()
        : null}
    </>
  );
}

function DelegateDialog({ ctx, closing, onClose, onCreate }: { ctx: Ctx; closing: boolean; onClose: () => void; onCreate: (d: Delegation) => void }) {
  const custs = CUSTOMERS.filter(c => inScope(ctx, c.id) && c.status !== 'archived' && c.id !== 'h360');
  const subtrees = custs.flatMap(c => [`${c.name} (whole tenant)`, ...c.departments.map(dp => `${c.name} › ${dp.name}`)]);
  const [sub, setSub] = useState(subtrees[0]);
  const cust = custs.find(c => sub.startsWith(c.name))!;
  const people = USERS.filter(u => u.customer === cust.id || u.customer === 'h360').filter(u => u.status === 'active');
  const [who, setWho] = useState(people[0]?.id || '');
  const PERMS = ['Invite and remove people', 'Assign roles up to Admin', 'Create projects', 'Edit policies', 'Approve restores'];
  const [perms, setPerms] = useState<Record<string, boolean>>({ 'Invite and remove people': true });
  const [exp, setExp] = useState('6 months');
  const [mfa, setMfa] = useState(false);
  const u = USERS.find(x => x.id === who);
  return (
    <Dialog
      size="lg"
      title="Delegate administration"
      sub="Choose a part of the hierarchy and what the person may do inside it."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="check" disabled={!u || !Object.values(perms).some(Boolean) || !mfa} why={!mfa ? 'Confirm it is you first.' : 'Choose a person and at least one permission.'} onClick={() => { audit({ who: 'priya.raman', customer: cust.id, what: 'Delegated administration', object: `${u!.name} · ${sub}`, when: ctx.now(), r: 'ok' }); ctx.toast(`${u!.name} now runs ${sub}`, 'ok'); onCreate({ id: 'dl' + Date.now(), who: u!.name, email: u!.email, customer: cust.id, subtree: sub.replace(' (whole tenant)', ''), can: PERMS.filter(p => perms[p]), cannot: ['Grant more than they have', 'Change compliance mode', 'Billing and licences'], granted: ctx.now(), by: 'Priya Raman', expires: exp === 'No end date' ? 'No end date' : exp === '6 months' ? '21 Apr 2027, 16:05 IST' : '21 Oct 2027, 16:05 IST' }); }}>
            Delegate
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="dg-s" label="Part of the hierarchy" span={2}><SelectInput id="dg-s" value={sub} onChange={v => { setSub(v); setWho(''); }} options={subtrees} /></Field>
        <Field id="dg-w" label="Person"><SelectInput id="dg-w" value={who} onChange={setWho} options={[{ v: '', label: 'Choose a person' }, ...people.map(p => ({ v: p.id, label: `${p.name} · ${p.email}` }))]} /></Field>
        <Field id="dg-e" label="Ends"><SelectInput id="dg-e" value={exp} onChange={setExp} options={['6 months', '1 year', 'No end date']} /></Field>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <legend style={{ padding: 0, marginBottom: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>They may</legend>
        {PERMS.map(p => (
          <CheckBox key={p} on={!!perms[p]} onChange={v => setPerms(x => ({ ...x, [p]: v }))}>{p}</CheckBox>
        ))}
      </fieldset>
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Never delegable: compliance mode, approval rules, billing, deleting the tenant.</p>
      <StepUp verified={mfa} onVerified={() => setMfa(true)} />
    </Dialog>
  );
}
