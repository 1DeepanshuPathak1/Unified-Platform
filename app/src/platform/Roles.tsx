import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { ACTIONS, AREAS, CUSTOMERS, WORKLOADS, type Area, type Role } from '../data/platform';
import { Btn, CheckBox, Field, FilterInput, InfoTip, Seg, SelectInput, TextArea, TextInput, Tag } from '../ui/controls';
import { Bar, Facts, H3, MiniTable, Spacer, TableArea, Toolbar, plural } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit, update, useStore } from './store';

const KIND_ICON: Record<Role['kind'], string> = { 'Built-in': 'pin', Template: 'copy', Custom: 'pencil' };

export function RolesTab({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [kind, setKind] = useState<'All' | Role['kind']>('All');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Permissions');
  const editor = useClosable<Role | 'new'>();
  const sim = useClosable<boolean>();
  const del = useClosable<string>();
  const ql = q.trim().toLowerCase();
  const rows = s.roles.filter(r => (kind === 'All' || r.kind === kind) && (!ql || `${r.name} ${r.desc}`.toLowerCase().includes(ql)));
  const adm = ctx.can('admin', 'Changing roles');
  const holders = (r: Role) => s.users.filter(u => u.roles.some(x => x.role === r.name) && u.status !== 'deleted');
  const d = drawer.value ? s.roles.find(r => r.id === drawer.value) : null;
  return (
    <>
      <Toolbar>
        <Seg label="Kind" value={kind} onChange={setKind} options={[{ v: 'All', label: 'All', count: s.roles.length }, ...(['Built-in', 'Template', 'Custom'] as Role['kind'][]).map(k => ({ v: k, label: k, count: s.roles.filter(r => r.kind === k).length }))]} />
        <FilterInput value={q} onChange={setQ} placeholder="Filter roles" label="Filter roles" width={220} />
        <Spacer />
        <Btn kind="secondary" icon="user-check" onClick={() => sim.open(true)}>
          What can this person do?
        </Btn>
        <Btn kind="primary" icon="plus" perm={adm} onClick={() => editor.open('new')}>
          Create a custom role
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Roles"
          cols={[
            { k: 'name', label: 'Role', w: 'minmax(170px,1fr)' },
            { k: 'kind', label: 'Kind', w: '112px' },
            { k: 'desc', label: 'What it is for', w: 'minmax(240px,2.2fr)', dim: true },
            { k: 'scope', label: 'Usually scoped to', w: 'minmax(150px,1fr)', dim: true },
            { k: 'ip', label: 'Networks', w: '110px', dim: true },
            { k: 'n', label: 'People', w: '72px', r: true }
          ]}
          rows={rows.map(r => ({ id: r.id, name: { v: r.name, strong: true }, kind: { t: 'icon', i: KIND_ICON[r.kind], l: r.kind, c: 'tx', s: r.kind }, desc: r.desc, scope: r.scopeHint, ip: r.ip ? { v: plural(r.ip.length, 'range'), tip: r.ip.join(', ') } : { v: 'Any', muted: true }, n: { v: String(holders(r).length), s: holders(r).length } }))}
          onRow={(id: string) => { drawer.open(id); setTab('Permissions'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['role', 'roles']}
          filtered={kind !== 'All' || !!ql}
          onClear={() => { setKind('All'); setQ(''); }}
          emptyText="No roles."
          footR="Templates are starting points; copy one to make a custom role"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Role details"
          width={680}
          kicker={`Role · ${d.kind}${d.owner ? ` · ${d.owner}` : ''}`}
          title={d.name}
          status={<><span>{plural(holders(d).length, 'person', 'people')}</span><span>Changed {d.updated}</span></>}
          actions={
            <>
              <Btn kind="outline" icon={d.kind === 'Custom' ? 'pencil' : 'copy'} perm={adm} onClick={() => editor.open(d.kind === 'Custom' ? d : { ...d, id: '', name: `${d.name} (copy)`, kind: 'Custom', users: 0 })}>
                {d.kind === 'Custom' ? 'Edit…' : 'Copy as a custom role…'}
              </Btn>
              <Spacer />
              {d.kind === 'Custom' ? (
                <Btn kind="danger" icon="trash-2" perm={adm} onClick={() => del.open(d.id)}>
                  Delete…
                </Btn>
              ) : null}
            </>
          }
          tabs={[{ v: 'Permissions', label: 'Permissions' }, { v: 'People', label: 'People', count: holders(d).length }, { v: 'Limits', label: 'Scope and networks' }]}
          tab={tab}
          onTab={setTab}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Permissions' ? <PermMatrix perms={d.perms} /> : null}
          {tab === 'People' ? (
            <MiniTable label="People with this role" cols={[{ label: 'Person' }, { label: 'Scope' }]} rows={holders(d).flatMap(u => u.roles.filter(r => r.role === d.name).map(r => [<strong key="n" style={{ fontWeight: 700 }}>{u.name}</strong>, r.scope]))} empty="Nobody has this role yet." />
          ) : null}
          {tab === 'Limits' ? (
            <Facts
              items={[
                { k: 'Scope', v: `Set when the role is given to someone. ${d.scopeHint}.` },
                { k: 'Allowed networks', v: d.ip ? d.ip.join(', ') : 'Any network', muted: !d.ip },
                { k: 'Description', v: d.desc }
              ]}
            />
          ) : null}
        </Drawer>
      ) : null}
      {editor.value ? <RoleEditor ctx={ctx} role={editor.value === 'new' ? null : editor.value} closing={editor.closing} onClose={editor.close} onSaved={id => { editor.close(); drawer.open(id); }} /> : null}
      {sim.value ? <Simulator ctx={ctx} closing={sim.closing} onClose={sim.close} /> : null}
      {del.value && s.roles.some(r => r.id === del.value) ? (
        <DangerDialog
          title={`Delete role ${s.roles.find(r => r.id === del.value)!.name}`}
          intro="Exactly this is removed:"
          removed={[`The role ${s.roles.find(r => r.id === del.value)!.name}`, `${plural(holders(s.roles.find(r => r.id === del.value)!).length, 'assignment')} that use it`]}
          kept="People keep any other roles they have. The audit log keeps every action taken under this role."
          name={s.roles.find(r => r.id === del.value)!.name}
          action="Delete role"
          stepUp={false}
          closing={del.closing}
          onClose={del.close}
          onConfirm={() => {
            const r = s.roles.find(x => x.id === del.value)!;
            update(x => { x.roles = x.roles.filter(y => y.id !== r.id); });
            ctx.toast(`Role ${r.name} deleted`, 'ok');
            del.close();
            drawer.close();
          }}
        />
      ) : null}
    </>
  );
}

function PermMatrix({ perms, edit }: { perms: Record<string, string[]>; edit?: (area: Area, action: string, on: boolean) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {AREAS.map(a => (
        <section key={a}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <h3 style={{ flex: 1, font: '600 15px/22px var(--f-body)' }}>{a}</h3>
            <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>
              {(perms[a] || []).length} of {ACTIONS[a].length}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '6px 12px', paddingBottom: 10, borderBottom: '1px solid var(--ln)' }}>
            {ACTIONS[a].map(x => {
              const on = (perms[a] || []).includes(x);
              return edit ? (
                <CheckBox key={x} on={on} onChange={v => edit(a, x, v)}>
                  <span style={{ font: '13px var(--f-ui)' }}>{x}</span>
                </CheckBox>
              ) : (
                <span key={x} style={{ display: 'flex', alignItems: 'center', gap: 8, font: '13px/24px var(--f-ui)', color: on ? 'var(--tx)' : 'var(--tx-3)' }}>
                  <Icon name={on ? 'check' : 'minus'} style={{ color: on ? 'var(--ok)' : 'var(--tx-3)' }} />
                  {x}
                </span>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoleEditor({ ctx, role, closing, onClose, onSaved }: { ctx: Ctx; role: Role | null; closing: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const s = useStore();
  const [name, setName] = useState(role?.name || '');
  const [desc, setDesc] = useState(role?.desc || '');
  const [base, setBase] = useState('Start empty');
  const [perms, setPerms] = useState<Record<string, string[]>>(role ? JSON.parse(JSON.stringify(role.perms)) : { Platform: ['View'] });
  const [owner, setOwner] = useState(role?.owner || 'Meridian Cooperative Bank');
  const [scopeKind, setScopeKind] = useState('Customer');
  const [ip, setIp] = useState((role?.ip || []).join('\n'));
  const ips = ip.split(/[\s,]+/).filter(Boolean);
  const badIp = ips.filter(x => !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(x));
  const dupe = s.roles.some(r => r.id !== role?.id && r.name.toLowerCase() === name.trim().toLowerCase());
  const n = Object.values(perms).reduce((a, x) => a + x.length, 0);
  const risky = (perms.Protection || []).includes('Delete recovery points') || (perms.Resilience || []).includes('Fail over');
  return (
    <Dialog
      size="lg"
      title={role?.id ? `Edit ${role.name}` : 'Create a custom role'}
      sub="Pick what the role may do in each product. Where it applies is chosen when you give it to someone."
      closing={closing}
      onClose={onClose}
      footNote={`${plural(n, 'permission')} selected`}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn
            kind="primary"
            icon="check"
            disabled={!name.trim() || dupe || !!badIp.length || !n}
            why={!name.trim() ? 'Name the role.' : dupe ? 'That name is taken.' : badIp.length ? 'Fix the network ranges.' : 'Choose at least one permission.'}
            onClick={() => {
              const id = role?.id || 'c-' + Date.now();
              const r: Role = { id, name: name.trim(), kind: 'Custom', desc: desc.trim() || 'Custom role.', perms, users: 0, scopeHint: scopeKind === 'Customer' ? 'A whole customer' : scopeKind, ip: ips.length ? ips : undefined, owner, updated: ctx.now() };
              update(x => {
                const i = x.roles.findIndex(y => y.id === id);
                if (i >= 0) x.roles[i] = r;
                else x.roles.push(r);
              });
              audit({ who: 'priya.raman', customer: 'h360', what: role?.id ? 'Edited role' : 'Created custom role', object: r.name, when: ctx.now(), r: 'ok' });
              ctx.toast(`Role ${r.name} saved`, 'ok');
              onSaved(id);
            }}
          >
            Save role
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="re-name" label="Name" err={dupe ? 'A role with this name already exists.' : null}>
          <TextInput id="re-name" value={name} onChange={setName} placeholder="Branch restore desk" invalid={dupe} />
        </Field>
        {!role ? (
          <Field id="re-base" label="Start from">
            <SelectInput id="re-base" value={base} onChange={v => { setBase(v); const r = s.roles.find(x => x.name === v); if (r) setPerms(JSON.parse(JSON.stringify(r.perms))); }} options={['Start empty', ...s.roles.filter(r => r.kind !== 'Custom').map(r => r.name)]} />
          </Field>
        ) : (
          <Field id="re-owner" label="Belongs to">
            <SelectInput id="re-owner" value={owner} onChange={setOwner} options={CUSTOMERS.map(c => c.name)} />
          </Field>
        )}
      </div>
      <Field id="re-desc" label="What it is for">
        <TextArea id="re-desc" value={desc} onChange={setDesc} rows={2} placeholder="Branch staff who restore files for customers at the counter." />
      </Field>
      <PermMatrix perms={perms} edit={(a, x, on) => setPerms(p => ({ ...p, [a]: on ? [...(p[a] || []), x] : (p[a] || []).filter(y => y !== x) }))} />
      {risky ? <Bar tone="warn" multiline>This role can delete recovery points or fail over. Those actions always ask for step-up MFA and follow the approval rules.</Bar> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="re-scope" label="Usually given for" hint="The exact scope is set per person.">
          <SelectInput id="re-scope" value={scopeKind} onChange={setScopeKind} options={['Customer', 'Department or site', 'Project', 'Application', 'Workload tag', 'Product only']} />
        </Field>
        <Field id="re-ip" label="Only from these networks (CIDR, optional)" err={badIp.length ? `Not a range: ${badIp.join(', ')}` : null} hint="Sign-ins from other addresses get no permissions from this role.">
          <TextArea id="re-ip" value={ip} onChange={setIp} rows={2} mono placeholder="115.112.40.0/24" />
        </Field>
      </div>
    </Dialog>
  );
}

/** Answers "can this person do this here?" with the role and scope that decide it. */
function Simulator({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const s = useStore();
  const people = s.users.filter(u => u.status === 'active' || u.status === 'locked');
  const [uid, setUid] = useState(people.find(u => u.id === 'si')!.id);
  const [area, setArea] = useState<Area>('Resilience');
  const [action, setAction] = useState('Fail over');
  const [wid, setWid] = useState('sql01');
  const [from, setFrom] = useState('115.112.40.22');
  const u = s.users.find(x => x.id === uid)!;
  const w = WORKLOADS.find(x => x.id === wid)!;
  const scopeMatch = (scope: string) => scope === 'Host360 (all customers)' || scope === CUSTOMERS.find(c => c.id === w.customer)!.name || scope === w.project;
  const grants = u.roles.map(r => ({ r, role: s.roles.find(x => x.name === r.role) })).filter(g => g.role && scopeMatch(g.r.scope) && (g.role.perms[area] || []).includes(action));
  const ipOk = (g: (typeof grants)[number]) => !g.role!.ip || g.role!.ip.some(c => from.startsWith(c.split('.').slice(0, c.endsWith('/24') ? 3 : 2).join('.')));
  const allowed = grants.filter(ipOk);
  const blockedByIp = grants.length && !allowed.length;
  const inCust = u.customer === 'h360' || u.customer === w.customer;
  return (
    <Dialog
      size="lg"
      title="What can this person do?"
      sub="Checks roles, scope and network rules exactly as Aegis does when the action is tried."
      closing={closing}
      onClose={onClose}
      footer={<Btn kind="primary" onClick={onClose}>Done</Btn>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <Field id="sim-u" label="Person">
          <SelectInput id="sim-u" value={uid} onChange={setUid} options={people.map(p => ({ v: p.id, label: `${p.name} · ${p.email}` }))} />
        </Field>
        <Field id="sim-w" label="On">
          <SelectInput id="sim-w" value={wid} onChange={setWid} options={WORKLOADS.map(x => ({ v: x.id, label: `${x.name} · ${CUSTOMERS.find(c => c.id === x.customer)!.name}` }))} />
        </Field>
        <Field id="sim-a" label="Product">
          <SelectInput id="sim-a" value={area} onChange={v => { setArea(v as Area); setAction(ACTIONS[v as Area][0]); }} options={AREAS} />
        </Field>
        <Field id="sim-x" label="Action">
          <SelectInput id="sim-x" value={action} onChange={setAction} options={ACTIONS[area]} />
        </Field>
        <Field id="sim-ip" label="Signing in from">
          <TextInput id="sim-ip" value={from} onChange={setFrom} mono />
        </Field>
      </div>
      {!inCust ? (
        <Bar tone="err" icon="ban" multiline>
          <strong style={{ fontWeight: 600 }}>Refused.</strong> {u.name} belongs to {CUSTOMERS.find(c => c.id === u.customer)!.name}; {w.name} belongs to {CUSTOMERS.find(c => c.id === w.customer)!.name}. Tenants are isolated.
        </Bar>
      ) : allowed.length ? (
        <Bar tone="ok" icon="circle-check" multiline>
          <strong style={{ fontWeight: 600 }}>Allowed</strong> through {allowed.map(g => `${g.r.role} on ${g.r.scope}`).join(' and ')}.
          {['Fail over', 'Delete recovery points', 'Cut over', 'Approve cutover', 'Approve failover'].includes(action) ? ' Aegis will still ask for step-up MFA and apply the approval rules.' : ''}
          {w.sensitive && area === 'Protection' && action.startsWith('Restore') ? ` ${w.name} is sensitive, so an additional approver is needed.` : ''}
        </Bar>
      ) : blockedByIp ? (
        <Bar tone="err" icon="ban" multiline>
          <strong style={{ fontWeight: 600 }}>Refused from this network.</strong> {grants.map(g => g.r.role).join(', ')} would allow it, but only from {grants.flatMap(g => g.role!.ip || []).join(', ')}.
        </Bar>
      ) : (
        <Bar tone="err" icon="ban" multiline>
          <strong style={{ fontWeight: 600 }}>Refused.</strong> None of {u.name}’s roles ({u.roles.map(r => `${r.role} on ${r.scope}`).join('; ') || 'none'}) allows {area} › {action} on {w.project}.
        </Bar>
      )}
      <section>
        <H3 right={<InfoTip tip="Every role the person holds, and whether its scope covers the chosen workload." />}>How it was decided</H3>
        <MiniTable
          label="Role check"
          cols={[{ label: 'Role', w: '160px' }, { label: 'Scope' }, { label: 'Covers it', w: '96px' }, { label: 'Allows it', w: '96px' }]}
          rows={u.roles.map(r => {
            const role = s.roles.find(x => x.name === r.role);
            const sc = scopeMatch(r.scope);
            const al = !!role && (role.perms[area] || []).includes(action);
            return [<strong key="r" style={{ fontWeight: 700 }}>{r.role}</strong>, r.scope, <Icon key="s" name={sc ? 'check' : 'minus'} style={{ color: sc ? 'var(--ok)' : 'var(--tx-3)' }} />, <Icon key="a" name={al ? 'check' : 'minus'} style={{ color: al ? 'var(--ok)' : 'var(--tx-3)' }} />];
          })}
          empty={`${u.name} has no roles.`}
        />
      </section>
      <p style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(u.roles.reduce((acc, r) => ({ ...acc, ...(s.roles.find(x => x.name === r.role)?.perms || {}) }), {} as Record<string, string[]>)).flatMap(([a, xs]) => xs.map(x => <Tag key={a + x}>{a}: {x}</Tag>))}
      </p>
    </Dialog>
  );
}
