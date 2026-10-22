import AegisSettings from '../screens/AegisSettings';
import type { Ctx } from '../ui/ctx';
import { Section } from '../ui/layout';
import { RolesTab } from './Roles';
import { SignInTab } from './SignIn';
import { UsersTab } from './Users';
import { VaultTab } from './Vault';
import { inScope } from './common';
import { useStore } from './store';

type Tab = 'users' | 'roles' | 'signin' | 'vault' | 'notifications' | 'backup' | 'tunables';
const LEGACY: Partial<Record<Tab, string>> = { notifications: 'Notifications', backup: 'Aegis backup', tunables: 'Tunables' };

/** Settings: people, roles, sign-in rules, credentials, notifications and the orchestrator itself. */
export default function SettingsSection({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const tabs: Tab[] = ['users', 'roles', 'signin', 'vault', 'notifications', 'backup', 'tunables'];
  const tab = (tabs.includes(ctx.tab as Tab) ? ctx.tab : 'users') as Tab;
  const provider = !ctx.actingAs;
  return (
    <Section<Tab>
      kicker="Administration"
      title="Settings"
      sub={provider ? 'People, roles, sign-in rules, credentials, notifications and Aegis’s own backup.' : 'People, roles and sign-in rules for your organisation.'}
      tab={tab}
      onTab={t => ctx.go(`settings/${t}`)}
      tabs={[
        { v: 'users', label: 'People', count: s.users.filter(u => inScope(ctx, u.customer) && u.status !== 'deleted').length },
        { v: 'roles', label: 'Roles', count: s.roles.length },
        { v: 'signin', label: 'Sign-in and MFA' },
        ...(provider
          ? ([
              { v: 'vault', label: 'Credential vault' },
              { v: 'notifications', label: 'Notifications' },
              { v: 'backup', label: 'Aegis backup' },
              { v: 'tunables', label: 'Tunables' }
            ] as { v: Tab; label: string }[])
          : [])
      ]}
    >
      {tab === 'users' ? <UsersTab ctx={ctx} /> : null}
      {tab === 'roles' ? <RolesTab ctx={ctx} /> : null}
      {tab === 'signin' ? <SignInTab ctx={ctx} /> : null}
      {tab === 'vault' ? <VaultTab ctx={ctx} /> : null}
      {LEGACY[tab] ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <AegisSettings ctx={ctx} embedTab={LEGACY[tab]} />
        </div>
      ) : null}
    </Section>
  );
}
