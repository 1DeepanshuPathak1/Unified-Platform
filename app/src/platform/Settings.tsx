import AegisSettings from '../screens/AegisSettings';
import type { Ctx } from '../ui/ctx';
import { Seg } from '../ui/controls';
import { Section } from '../ui/layout';
import { RolesTab } from './Roles';
import { SignInTab } from './SignIn';
import { UsersTab } from './Users';
import { VaultTab } from './Vault';
import { BreakGlassTab, DelegationTab, ServiceAccountsTab, SsoTab } from './Identity';
import { KeysTab } from './Keys';
import { GovernorTab } from './Governor';
import { NotificationsTab } from './Notifications';
import { BrandingTab } from './Branding';
import { UpdatesTab } from './Updates';
import { inScope } from './common';
import { useStore } from './store';

type Tab = 'users' | 'roles' | 'delegation' | 'signin' | 'sso' | 'service' | 'breakglass' | 'vault' | 'keys' | 'notifications' | 'branding' | 'governor' | 'updates' | 'backup' | 'tunables';
type Group = 'identity' | 'security' | 'operations';
const LEGACY: Partial<Record<Tab, string>> = { backup: 'Aegis backup', tunables: 'Tunables' };
const GROUPS: Record<Group, { label: string; tabs: { v: Tab; label: string; provider?: boolean }[] }> = {
  identity: {
    label: 'Identity and access',
    tabs: [
      { v: 'users', label: 'People' },
      { v: 'roles', label: 'Roles' },
      { v: 'delegation', label: 'Delegation' },
      { v: 'signin', label: 'Sign-in and MFA' },
      { v: 'sso', label: 'Single sign-on' },
      { v: 'service', label: 'Service accounts' },
      { v: 'breakglass', label: 'Break-glass', provider: true }
    ]
  },
  security: {
    label: 'Security',
    tabs: [
      { v: 'vault', label: 'Credential vault', provider: true },
      { v: 'keys', label: 'Encryption keys' }
    ]
  },
  operations: {
    label: 'Operations',
    tabs: [
      { v: 'notifications', label: 'Notifications' },
      { v: 'branding', label: 'Branding' },
      { v: 'governor', label: 'Source impact', provider: true },
      { v: 'updates', label: 'Updates', provider: true },
      { v: 'backup', label: 'Aegis backup', provider: true },
      { v: 'tunables', label: 'Tunables', provider: true }
    ]
  }
};

/**
 * Settings, in three groups so each tab strip stays short: identity and access, security
 * (credentials and keys) and how the orchestrator runs.
 */
export default function SettingsSection({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const provider = !ctx.actingAs;
  const visible = (g: Group) => GROUPS[g].tabs.filter(t => provider || !t.provider);
  const all = (Object.keys(GROUPS) as Group[]).flatMap(visible);
  const tab = (all.some(t => t.v === ctx.tab) ? ctx.tab : 'users') as Tab;
  const group = (Object.keys(GROUPS) as Group[]).find(g => GROUPS[g].tabs.some(t => t.v === tab))!;
  const groups = (Object.keys(GROUPS) as Group[]).filter(g => visible(g).length);
  return (
    <Section<Tab>
      kicker="Administration"
      title="Settings"
      sub={provider ? 'People and sign-in, credentials and keys, and how the orchestrator runs.' : 'People, sign-in and keys for your organisation.'}
      actions={groups.length > 1 ? <Seg<Group> label="Settings group" value={group} onChange={g => ctx.go(`settings/${visible(g)[0].v}`)} options={groups.map(g => ({ v: g, label: GROUPS[g].label }))} /> : undefined}
      tab={tab}
      onTab={t => ctx.go(`settings/${t}`)}
      tabs={visible(group).map(t => ({ v: t.v, label: t.label, count: t.v === 'users' ? s.users.filter(u => inScope(ctx, u.customer) && u.status !== 'deleted').length : t.v === 'roles' ? s.roles.length : undefined }))}
    >
      {tab === 'users' ? <UsersTab ctx={ctx} /> : null}
      {tab === 'roles' ? <RolesTab ctx={ctx} /> : null}
      {tab === 'delegation' ? <DelegationTab ctx={ctx} /> : null}
      {tab === 'signin' ? <SignInTab ctx={ctx} /> : null}
      {tab === 'sso' ? <SsoTab ctx={ctx} /> : null}
      {tab === 'service' ? <ServiceAccountsTab ctx={ctx} /> : null}
      {tab === 'breakglass' ? <BreakGlassTab ctx={ctx} /> : null}
      {tab === 'vault' ? <VaultTab ctx={ctx} /> : null}
      {tab === 'keys' ? <KeysTab ctx={ctx} /> : null}
      {tab === 'governor' ? <GovernorTab ctx={ctx} /> : null}
      {tab === 'notifications' ? <NotificationsTab ctx={ctx} /> : null}
      {tab === 'branding' ? <BrandingTab ctx={ctx} /> : null}
      {tab === 'updates' ? <UpdatesTab ctx={ctx} /> : null}
      {LEGACY[tab] ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <AegisSettings ctx={ctx} embedTab={LEGACY[tab]} />
        </div>
      ) : null}
    </Section>
  );
}
