import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { CUSTOMERS, type User, type UserStatus } from '../data/platform';
import { Btn, CheckBox, Field, FilterInput, Seg, SelectFilter, SelectInput, TextArea, Tag } from '../ui/controls';
import { Activity, Bar, BulkBar, Facts, H3, MiniTable, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, showCustomerCol } from './common';
import { audit, update, useStore } from './store';

const ST: Record<UserStatus, [string, string, string]> = {
  active: ['circle-check', 'Active', 'ok'],
  invited: ['mail', 'Invited', 'run'],
  deactivated: ['circle-minus', 'Deactivated', 'tx'],
  locked: ['user-x', 'Locked', 'warn'],
  deleted: ['trash-2', 'Deleted', 'tx']
};

export function UsersTab({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [view, setView] = useState<'current' | 'invited' | 'inactive' | 'deleted'>('current');
  const [q, setQ] = useState('');
  const [side, setSide] = useState('All');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Profile');
  const invite = useClosable<boolean>();
  const roleDlg = useClosable<string>();
  const deact = useClosable<string[]>();
  const del = useClosable<string>();
  useEffect(() => {
    if (ctx.openId && s.users.some(u => u.id === ctx.openId)) {
      drawer.open(ctx.openId);
      setTab('Profile');
    }
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = s.users.filter(u => inScope(ctx, u.customer));
  const bucket = (u: User) => (u.status === 'active' || u.status === 'locked' ? 'current' : u.status === 'invited' ? 'invited' : u.status === 'deactivated' ? 'inactive' : 'deleted');
  const ql = q.trim().toLowerCase();
  const rows = all.filter(u => bucket(u) === view && (side === 'All' || u.side === side) && (!ql || `${u.name} ${u.email} ${u.roles.map(r => r.role + ' ' + r.scope).join(' ')}`.toLowerCase().includes(ql)));
  const adm = ctx.can('admin', 'Managing people');
  const selIds = Object.keys(sel).filter(k => sel[k] && rows.some(r => r.id === k));
  const setStatus = (ids: string[], st: UserStatus, note?: string) => update(x => ids.forEach(id => Object.assign(x.users.find(u => u.id === id)!, { status: st, statusNote: note, sessions: st === 'active' ? x.users.find(u => u.id === id)!.sessions : [] })));
  const d = drawer.value ? s.users.find(u => u.id === drawer.value) : null;
  const custCol = showCustomerCol(ctx);
  const mfaMissing = all.filter(u => u.status === 'active' && u.mfa === 'Not set up');
  return (
    <>
      {mfaMissing.length ? (
        <div style={{ padding: '0 24px 12px' }}>
          <Bar tone="warn" icon="fingerprint" actions={<Btn kind="ghost" size="sm" onClick={() => { setQ(mfaMissing[0].name); setView('current'); }}>Show</Btn>}>
            {plural(mfaMissing.length, 'active user')} without MFA: {mfaMissing.map(u => u.name).join(', ')}. They are blocked from 28 Oct 2026 until they set it up.
          </Bar>
        </div>
      ) : null}
      <Toolbar>
        {selIds.length ? (
          <BulkBar label={plural(selIds.length, 'person', 'people') + ' selected'} onClear={() => setSel({})}>
            <Btn kind="ghost" icon="circle-minus" perm={adm} onClick={() => deact.open(selIds)}>
              Deactivate…
            </Btn>
            <Btn kind="ghost" icon="key" perm={adm} onClick={() => { update(x => selIds.forEach(id => (x.users.find(u => u.id === id)!.mfa = 'Not set up'))); ctx.toast(`MFA reset for ${plural(selIds.length, 'person', 'people')}; they enrol again at next sign-in`, 'ok'); setSel({}); }}>
              Reset MFA
            </Btn>
          </BulkBar>
        ) : (
          <>
            <Seg
              label="Show"
              value={view}
              onChange={v => { setView(v); setSel({}); }}
              options={[
                { v: 'current', label: 'Active', count: all.filter(u => bucket(u) === 'current').length },
                { v: 'invited', label: 'Invited', count: all.filter(u => bucket(u) === 'invited').length },
                { v: 'inactive', label: 'Deactivated', count: all.filter(u => bucket(u) === 'inactive').length },
                { v: 'deleted', label: 'Deleted', count: all.filter(u => bucket(u) === 'deleted').length }
              ]}
            />
            <FilterInput value={q} onChange={setQ} placeholder="Filter by name, e-mail or role" label="Filter people" />
            {custCol ? <SelectFilter label="Side" value={side} onChange={setSide} options={['All', 'Provider', 'Customer']} /> : null}
            <Spacer />
            <Btn kind="primary" icon="plus" perm={adm} onClick={() => invite.open(true)}>
              Invite people
            </Btn>
          </>
        )}
      </Toolbar>
      <TableArea>
        <AegisTable
          label="People"
          cols={[
            { k: 'name', label: 'Name', w: 'minmax(140px,1fr)' },
            { k: 'email', label: 'E-mail', w: 'minmax(170px,1.3fr)', dim: true },
            ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(110px,1fr)', dim: true }] : []),
            { k: 'roles', label: 'Roles', w: 'minmax(180px,1.5fr)' },
            { k: 'mfa', label: 'MFA', w: '144px' },
            { k: 'st', label: 'Status', w: '112px' },
            { k: 'last', label: 'Last sign-in', w: '176px', dim: true }
          ]}
          rows={rows.map(u => ({
            id: u.id,
            name: { v: u.name, strong: true },
            email: u.email,
            cust: custName(u.customer),
            roles: u.roles.length ? { v: `${u.roles[0].role} · ${u.roles[0].scope.replace(' (all customers)', '')}${u.roles.length > 1 ? `, +${u.roles.length - 1}` : ''}`, tip: u.roles.map(r => `${r.role} on ${r.scope}`).join(' · '), s: u.roles[0].role } : { v: 'No roles', muted: true },
            mfa: u.mfa === 'Not set up' ? { t: 'status', i: 'triangle-alert', l: 'Not set up', c: u.status === 'active' ? 'warn' : 'tx' } : { t: 'status', i: u.mfa === 'Security key' ? 'key' : u.mfa === 'SMS' ? 'message-square' : 'circle-check', l: u.mfa, c: u.mfa === 'SMS' ? 'warn' : 'ok', tip: u.mfa === 'SMS' ? 'SMS is allowed but weaker than an app or key' : undefined },
            st: { t: 'status', i: ST[u.status][0], l: ST[u.status][1], c: ST[u.status][2], tip: u.statusNote || ST[u.status][1] },
            last: u.last === '—' ? { v: 'Not yet', muted: true, italic: true } : u.last
          }))}
          sel={view === 'current' ? sel : undefined}
          onSel={view === 'current' ? (id: string) => setSel(x => ({ ...x, [id]: !x[id] })) : undefined}
          onSelAll={(ids: string[], on: boolean) => setSel(x => ({ ...x, ...Object.fromEntries(ids.map(i => [i, on])) }))}
          onRow={(id: string) => { drawer.open(id); setTab('Profile'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['person', 'people']}
          filtered={side !== 'All' || !!ql}
          onClear={() => { setSide('All'); setQ(''); }}
          emptyText={view === 'deleted' ? 'Nobody has been deleted. Deleted people keep their audit history for 7 years.' : view === 'invited' ? 'No invitations are waiting.' : 'Nobody here yet. Invite people and give each a role and scope.'}
          emptyAction={view === 'current' || view === 'invited' ? 'Invite people' : undefined}
          onEmpty={() => invite.open(true)}
          sort="name"
          footR="People who sign in through an identity provider are kept in step by SCIM"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Person details"
          width={640}
          kicker={`Person · ${d.side} · ${custName(d.customer)}`}
          title={d.name}
          status={
            <>
              <Status icon={ST[d.status][0]} label={ST[d.status][1]} tone={ST[d.status][2]} />
              <span>{d.title}</span>
            </>
          }
          actions={
            d.status === 'deleted' ? undefined : (
              <>
                <Btn kind="outline" icon="users" perm={adm} disabled={d.status === 'deactivated'} why="Reactivate first." onClick={() => roleDlg.open(d.id)}>
                  Edit roles…
                </Btn>
                {d.status === 'locked' ? (
                  <Btn kind="outline" icon="user-check" perm={adm} onClick={() => { setStatus([d.id], 'active'); audit({ who: 'priya.raman', customer: d.customer, what: 'Unlocked a user', object: d.email, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.name} unlocked`, 'ok'); }}>
                    Unlock
                  </Btn>
                ) : null}
                {d.status === 'invited' ? (
                  <Btn kind="outline" icon="send" perm={adm} onClick={() => ctx.toast(`Invitation sent again to ${d.email}`, 'ok')}>
                    Resend invitation
                  </Btn>
                ) : null}
                {d.status === 'deactivated' ? (
                  <Btn kind="outline" icon="play" perm={adm} disabled={d.signIn !== 'Password'} why={`${d.name} is managed by ${d.signIn}. Reactivate them there; SCIM brings the change here.`} onClick={() => { setStatus([d.id], 'active'); ctx.toast(`${d.name} reactivated`, 'ok'); }}>
                    Reactivate
                  </Btn>
                ) : null}
                <Btn kind="outline" icon="key" perm={adm} disabled={d.mfa === 'Not set up'} why="MFA is not set up." onClick={() => { update(x => (x.users.find(u => u.id === d.id)!.mfa = 'Not set up')); ctx.toast(`MFA reset for ${d.name}`, 'ok'); }}>
                  Reset MFA
                </Btn>
                <Spacer />
                {d.status === 'active' || d.status === 'locked' ? (
                  <Btn kind="danger" icon="circle-minus" perm={adm} disabled={d.id === 'pr'} why="You cannot deactivate yourself." onClick={() => deact.open([d.id])}>
                    Deactivate…
                  </Btn>
                ) : (
                  <Btn kind="danger" icon="trash-2" perm={ctx.can('destroy', 'Deleting people')} onClick={() => del.open(d.id)}>
                    Delete…
                  </Btn>
                )}
              </>
            )
          }
          tabs={[
            { v: 'Profile', label: 'Profile' },
            { v: 'Roles', label: 'Roles', count: d.roles.length },
            { v: 'Sessions', label: 'Sessions', count: d.sessions.length },
            { v: 'Lifecycle', label: 'Lifecycle' }
          ]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Profile' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.statusNote ? <Bar tone={d.status === 'locked' ? 'warn' : 'info'} multiline>{d.statusNote}</Bar> : null}
              <Facts
                items={[
                  { k: 'E-mail', v: d.email },
                  { k: 'Job title', v: d.title },
                  { k: 'Organisation', v: `${custName(d.customer)} · ${d.side.toLowerCase()} side` },
                  { k: 'Signs in with', v: d.signIn === 'Password' ? 'Password (local account)' : `${d.signIn} (single sign-on)` },
                  { k: 'MFA', v: d.mfa, icon: d.mfa === 'Not set up' ? 'triangle-alert' : 'circle-check', tone: d.mfa === 'Not set up' ? 'warn' : 'ok' },
                  { k: 'Last sign-in', v: d.last === '—' ? 'Not yet' : d.last, muted: d.last === '—' },
                  { k: 'Created', v: d.created }
                ]}
              />
            </div>
          ) : null}
          {tab === 'Roles' ? (
            <MiniTable label="Role assignments" cols={[{ label: 'Role', w: '170px' }, { label: 'Scope' }]} rows={d.roles.map(r => [<strong key="r" style={{ fontWeight: 700 }}>{r.role}</strong>, r.scope])} empty="No roles. This person can sign in but sees nothing." />
          ) : null}
          {tab === 'Sessions' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <MiniTable
                label="Sessions"
                cols={[{ label: 'Device and browser' }, { label: 'IP address', w: '120px' }, { label: 'Started', w: '176px' }, { label: 'Last active', w: '176px' }, { label: '', w: '72px', r: true }]}
                rows={d.sessions.map((x, i) => [
                  <span key="d" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: '16px', padding: '4px 0' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.device}</span>
                    <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{x.browser} · {x.place}{x.current ? ' · this session' : ''}</span>
                  </span>,
                  x.ip,
                  x.started,
                  x.last,
                  <Btn key="e" kind="ghost" size="sm" perm={adm} disabled={x.current} why="That is the session you are using." onClick={() => { update(st => { st.users.find(u => u.id === d.id)!.sessions.splice(i, 1); }); ctx.toast(`Signed ${d.name} out of ${x.device}`, 'ok'); }}>
                    Sign out
                  </Btn>
                ])}
                empty="No active sessions."
              />
              {d.sessions.length > 1 ? (
                <Btn kind="outline" icon="log-out" perm={adm} onClick={() => { update(st => { st.users.find(u => u.id === d.id)!.sessions = st.users.find(u => u.id === d.id)!.sessions.filter(x => x.current); }); ctx.toast(`Signed ${d.name} out everywhere else`, 'ok'); }} style={{ alignSelf: 'flex-start' }}>
                  Sign out of every other session
                </Btn>
              ) : null}
            </div>
          ) : null}
          {tab === 'Lifecycle' ? (
            <Activity
              items={[
                { icon: 'send', tone: 'info', text: 'Invited', when: d.created },
                ...(d.status !== 'invited' ? [{ icon: 'user-check', tone: 'ok', text: `Activated and enrolled ${d.mfa === 'Not set up' ? 'without MFA' : d.mfa.toLowerCase()}`, when: d.created }] : []),
                ...(d.status === 'locked' ? [{ icon: 'user-x', tone: 'warn', text: 'Locked after repeated failed sign-ins', when: d.last }] : []),
                ...(d.status === 'deactivated' || d.status === 'deleted' ? [{ icon: 'circle-minus', tone: 'tx', text: 'Deactivated: sessions ended, tokens revoked', when: d.last }] : []),
                ...(d.status === 'deleted' ? [{ icon: 'trash-2', tone: 'tx', text: 'Deleted. Name kept in the audit log; personal data erased.', when: '30 Jun 2026, 10:00 IST' }] : [])
              ]}
            />
          ) : null}
        </Drawer>
      ) : null}
      {invite.value ? <InviteDialog ctx={ctx} closing={invite.closing} onClose={invite.close} /> : null}
      {roleDlg.value ? <RolesDialog ctx={ctx} user={s.users.find(u => u.id === roleDlg.value)!} closing={roleDlg.closing} onClose={roleDlg.close} /> : null}
      {deact.value ? (
        <Dialog
          title={deact.value.length === 1 ? `Deactivate ${s.users.find(u => u.id === deact.value![0])!.name}` : `Deactivate ${plural(deact.value.length, 'person', 'people')}`}
          sub="They can no longer sign in. You can reactivate them later."
          closing={deact.closing}
          onClose={deact.close}
          footer={
            <>
              <Btn kind="ghost" onClick={deact.close}>Cancel</Btn>
              <Btn kind="dangerSolid" icon="circle-minus" onClick={() => {
                setStatus(deact.value!, 'deactivated', `Deactivated by priya.raman on ${ctx.now().slice(0, 11)}`);
                deact.value!.forEach(id => audit({ who: 'priya.raman', customer: s.users.find(u => u.id === id)!.customer, what: 'Deactivated a user', object: s.users.find(u => u.id === id)!.email, when: ctx.now(), r: 'ok' }));
                ctx.toast(deact.value!.length === 1 ? `${s.users.find(u => u.id === deact.value![0])!.name} deactivated` : `${plural(deact.value!.length, 'person', 'people')} deactivated`, 'ok');
                deact.close();
                setSel({});
              }}>
                Deactivate
              </Btn>
            </>
          }
        >
          <ul style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)' }}>
            {['Every session ends now', 'Personal API tokens stop working', 'Approvals they still have to give are passed to the other approvers', 'Their audit history stays'].map(x => (
              <li key={x} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--ln)' }}>
                <Icon name="minus" style={{ color: 'var(--tx-3)' }} />
                {x}
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}
      {del.value ? (
        <DangerDialog
          title={`Delete ${s.users.find(u => u.id === del.value)!.name}`}
          intro="Deleting is a soft delete. Exactly this is removed:"
          removed={['Name, job title and contact details (replaced by a pseudonym)', 'Sign-in methods and recovery codes', 'Role assignments']}
          kept="The audit history stays for 7 years under the person’s former e-mail, as required for evidence. The account cannot be restored."
          name={s.users.find(u => u.id === del.value)!.email}
          nameLabel="Type the e-mail"
          action="Delete person"
          closing={del.closing}
          onClose={del.close}
          onConfirm={() => {
            const u = s.users.find(x => x.id === del.value)!;
            setStatus([u.id], 'deleted', `Deleted ${ctx.now().slice(0, 11)} by priya.raman. Audit history kept for 7 years.`);
            update(x => (x.users.find(y => y.id === u.id)!.roles = []));
            audit({ who: 'priya.raman', customer: u.customer, what: 'Deleted a user', object: u.email, when: ctx.now(), r: 'ok' });
            ctx.toast(`${u.name} deleted; audit history kept`, 'ok');
            del.close();
            drawer.close();
          }}
        />
      ) : null}
    </>
  );
}

function InviteDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const s = useStore();
  const [emails, setEmails] = useState('');
  const custs = CUSTOMERS.filter(c => inScope(ctx, c.id) && c.status !== 'archived' && c.status !== 'suspended');
  const [cust, setCust] = useState(custs[0].id);
  const scopes = [custName(cust), ...custs.find(c => c.id === cust)!.departments.flatMap(d => d.projects.map(p => p.name))];
  const [scope, setScope] = useState(scopes[0]);
  const [role, setRole] = useState('Read-only');
  const [mfa, setMfa] = useState(true);
  const list = emails.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const bad = list.filter(x => !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x));
  const dup = list.filter(x => s.users.some(u => u.email.toLowerCase() === x.toLowerCase() && u.status !== 'deleted'));
  const err = bad.length ? `Not an e-mail address: ${bad.join(', ')}` : dup.length ? `Already have an account: ${dup.join(', ')}` : null;
  return (
    <Dialog
      title="Invite people"
      sub="Each person gets an e-mail with a link that works for 7 days."
      closing={closing}
      onClose={onClose}
      footNote={list.length ? plural(list.length, 'invitation') : undefined}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn
            kind="primary"
            icon="send"
            disabled={!list.length || !!err}
            why={err || 'Enter at least one e-mail address.'}
            onClick={() => {
              update(x => list.forEach((e, i) => x.users.push({ id: 'n' + Date.now() + i, name: e.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), email: e, customer: cust, side: cust === 'h360' ? 'Provider' : 'Customer', roles: [{ scope, role }], status: 'invited', mfa: 'Not set up', signIn: 'Password', last: '—', created: ctx.now(), sessions: [], title: '—', statusNote: `Invitation sent ${ctx.now()} · expires in 7 days` })));
              audit({ who: 'priya.raman', customer: cust, what: `Invited ${plural(list.length, 'person', 'people')}`, object: list.join(', '), when: ctx.now(), r: 'ok', note: `${role} on ${scope}` });
              ctx.toast(`${plural(list.length, 'invitation')} sent`, 'ok');
              onClose();
            }}
          >
            Send {list.length > 1 ? plural(list.length, 'invitation') : 'invitation'}
          </Btn>
        </>
      }
    >
      <Field id="inv-e" label="E-mail addresses" hint="Separate with commas or new lines." err={err}>
        <TextArea id="inv-e" value={emails} onChange={setEmails} rows={3} placeholder="kavya.rao@meridianbank.in, anil.d@meridianbank.in" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
        <Field id="inv-c" label="Customer">
          <SelectInput id="inv-c" value={cust} onChange={v => { setCust(v); setScope(custName(v)); }} options={custs.map(c => ({ v: c.id, label: c.name }))} />
        </Field>
        <Field id="inv-s" label="Scope">
          <SelectInput id="inv-s" value={scope} onChange={setScope} options={scopes} />
        </Field>
        <Field id="inv-r" label="Role">
          <SelectInput id="inv-r" value={role} onChange={setRole} options={s.roles.map(r => r.name)} />
        </Field>
      </div>
      <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>{s.roles.find(r => r.name === role)?.desc}</p>
      <CheckBox on={mfa} onChange={setMfa} disabled why="MFA is required for everyone by the sign-in policy.">
        Require MFA at first sign-in
      </CheckBox>
    </Dialog>
  );
}

function RolesDialog({ ctx, user, closing, onClose }: { ctx: Ctx; user: User; closing: boolean; onClose: () => void }) {
  const s = useStore();
  const [rows, setRows] = useState(user.roles.map(r => ({ ...r })));
  const c = CUSTOMERS.find(x => x.id === user.customer)!;
  const scopes = [user.customer === 'h360' ? 'Host360 (all customers)' : c.name, ...c.departments.flatMap(d => d.projects.map(p => p.name))];
  return (
    <Dialog
      size="lg"
      title={`Roles for ${user.name}`}
      sub="A role applies inside its scope only. The widest role in a scope wins."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="check" onClick={() => {
            update(x => (x.users.find(u => u.id === user.id)!.roles = rows));
            audit({ who: 'priya.raman', customer: user.customer, what: 'Changed role assignments', object: user.email, when: ctx.now(), r: 'ok', before: user.roles.map(r => [r.scope, r.role] as [string, string]), after: rows.map(r => [r.scope, r.role] as [string, string]) });
            ctx.toast(`Roles saved for ${user.name}`, 'ok');
            onClose();
          }}>
            Save roles
          </Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 32px', gap: 12, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--ln)' }}>
            <SelectInput value={r.role} onChange={v => setRows(x => x.map((y, j) => (j === i ? { ...y, role: v } : y)))} options={s.roles.map(x => x.name)} />
            <SelectInput value={r.scope} onChange={v => setRows(x => x.map((y, j) => (j === i ? { ...y, scope: v } : y)))} options={[...new Set([r.scope, ...scopes])]} />
            <button type="button" aria-label="Remove assignment" onClick={() => setRows(x => x.filter((_, j) => j !== i))} style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', color: 'var(--tx-3)' }}>
              <Icon name="x" />
            </button>
          </div>
        ))}
        {!rows.length ? <p style={{ padding: 12, color: 'var(--tx-2)' }}>No roles. {user.name} will see nothing.</p> : null}
      </div>
      <Btn kind="outline" icon="plus" onClick={() => setRows(x => [...x, { role: 'Read-only', scope: scopes[0] }])} style={{ alignSelf: 'flex-start' }}>
        Add an assignment
      </Btn>
      {rows.some(r => r.role === 'Owner') && user.customer !== 'h360' ? <Bar tone="info">Owners can change billing and delete the tenant. Most people need Admin.</Bar> : null}
      <section>
        <H3>What {user.name.split(' ')[0]} can do</H3>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...new Set(rows.flatMap(r => Object.entries(s.roles.find(x => x.name === r.role)?.perms || {}).flatMap(([a, acts]) => acts.map(x => `${a}: ${x}`))))].slice(0, 18).map(x => (
            <Tag key={x}>{x}</Tag>
          ))}
        </p>
      </section>
    </Dialog>
  );
}
