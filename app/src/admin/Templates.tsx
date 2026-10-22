import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { TEMPLATES, type Template, type TplKind } from '../data/internal';
import { Btn, CheckBox, Field, Seg, SelectInput, TextArea, TextInput } from '../ui/controls';
import { Activity, Bar, Facts, Page, PageHeader, Spacer, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit, useStore } from '../platform/store';

const KINDS: TplKind[] = ['Alert rule', 'Notification', 'Backup policy', 'DR plan', 'Migration profile', 'Report'];
const KIND_LABEL: Record<TplKind, string> = { 'Alert rule': 'Alerts', Notification: 'Notifications', 'Backup policy': 'Backup', 'DR plan': 'DR', 'Migration profile': 'Migration', Report: 'Reports' };
const KIND_ICON: Record<TplKind, string> = { 'Alert rule': 'bell', Notification: 'mail', 'Backup policy': 'archive', 'DR plan': 'list-ordered', 'Migration profile': 'forward', Report: 'file-text' };

/** Sample values for previews. The brand decides every name, logo and signature the customer sees. */
export const BRANDS = {
  host360: { 'brand.name': 'Host360', 'brand.signature': 'Host360 Managed Services · support@host360.ai · +91 44 4900 2100', logo: 'Host360 Aegis' },
  cloudnest: { 'brand.name': 'CloudNest Resilience', 'brand.signature': 'CloudNest Resilience · care@cloudnest.in · +91 20 6700 1180', logo: 'CloudNest Resilience' }
};
export const SAMPLE: Record<string, string> = {
  'customer.contact_first_name': 'Prakash',
  'customer.timezone': 'IST',
  'window.components': 'the orchestrator and its warm standby',
  'window.start_local': 'Mon 02 Nov 2026, 02:00',
  'window.end_local': '04:00',
  'window.impact': 'the console shows a maintenance page for up to 20 minutes; running jobs continue.',
  'window.protection_note': 'scheduled backups that fall in the window start when it ends.',
  'window.objection_deadline': 'Thu 29 Oct 2026, 18:00',
  'window.end_actual_local': '03:22',
  'window.result': 'Everything is back to normal.',
  'window.catch_up_local': '03:30',
  'job.object': 'his-db-01',
  'job.target': 'his-db-01-restore',
  'job.end_local': '21 Oct 2026, 14:20 IST',
  'job.verified': 'yes, the database opened cleanly'
};
export const fill = (text: string, brand: keyof typeof BRANDS, extra: Record<string, string> = {}) => text.replace(/\{\{([a-z_.]+)\}\}/g, (_, k) => extra[k] ?? (BRANDS[brand] as Record<string, string>)[k] ?? SAMPLE[k] ?? `{{${k}}}`);

/** 6.3 Templates: what every tenant starts from. Mandatory ones cannot be switched off by a tenant. */
export function TemplatesSection({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Template[]>(TEMPLATES);
  const [kind, setKind] = useState<'all' | TplKind>('all');
  const drawer = useClosable<string>();
  const [tab, setTab] = useState('Overview');
  const edit = useClosable<string>();
  const pub = useClosable<string>();
  const add = useClosable<boolean>();
  useEffect(() => {
    if (ctx.openId && list.some(t => t.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = list.filter(t => kind === 'all' || t.kind === kind);
  const d = drawer.value ? list.find(t => t.id === drawer.value) : null;
  const save = (t: Template) => setList(x => x.map(y => (y.id === t.id ? t : y)));
  return (
    <Page>
      <PageHeader
        kicker="Service"
        title="Templates"
        sub="Predefined alert rules, notifications, policies, recovery plans, migration profiles and reports that every tenant starts from."
        actions={<Btn kind="primary" icon="plus" onClick={() => add.open(true)}>New template</Btn>}
      />
      <Toolbar>
        <Seg label="Kind" value={kind} onChange={setKind} options={[{ v: 'all', label: 'All', count: list.length }, ...KINDS.map(k => ({ v: k, label: KIND_LABEL[k], count: list.filter(t => t.kind === k).length }))]} />
        <Spacer />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '12px var(--f-ui)', color: 'var(--tx-3)' }}><Icon name="pin" /> Mandatory: every tenant gets it and cannot turn it off</span>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Templates"
          cols={[
            { k: 'n', label: 'Template', w: 'minmax(240px,2fr)' },
            { k: 'k', label: 'Kind', w: '150px' },
            { k: 'm', label: 'Mandatory', w: '110px' },
            { k: 'v', label: 'Version', w: '80px', r: true },
            { k: 'u', label: 'Tenants', w: '80px', r: true },
            { k: 'up', label: 'Updated', w: '190px', dim: true }
          ]}
          rows={rows.map(t => ({
            id: t.id,
            n: { v: t.name, strong: true, tip: t.summary },
            k: { t: 'icon', i: KIND_ICON[t.kind], c: 'tx', l: t.kind },
            m: t.mandatory ? { t: 'icon', i: 'pin', c: 'acc', l: 'Mandatory' } : { v: 'Optional', muted: true },
            v: { v: `v${t.version}`, s: t.version },
            u: { v: String(t.used), s: t.used },
            up: `${t.updated.replace(' 2026', '').replace(' IST', '')} · ${t.by}`
          }))}
          onRow={(id: string) => { drawer.open(id); setTab('Overview'); }}
          active={drawer.value}
          state={ctx.ui}
          unit={['template', 'templates']}
          filtered={kind !== 'all'}
          onClear={() => setKind('all')}
          emptyText="No templates of this kind yet."
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Template"
          kicker={`Template · ${d.kind}`}
          title={d.name}
          status={<><span>v{d.version}</span><span>{plural(d.used, 'tenant')}</span>{d.mandatory ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="pin" style={{ color: 'var(--acc)' }} />Mandatory</span> : null}</>}
          actions={
            <>
              <Btn kind="outline" icon="pencil" onClick={() => edit.open(d.id)}>Edit…</Btn>
              <Btn kind="outline" icon="send" onClick={() => pub.open(d.id)}>Publish to tenants…</Btn>
              <Spacer />
              <Btn kind="ghost" icon="copy" onClick={() => { const n = { ...d, id: 't' + Date.now(), name: `${d.name} (copy)`, version: 1, used: 0, mandatory: false, updated: ctx.now(), by: 'priya.raman' }; setList(x => [...x, n]); drawer.open(n.id); ctx.toast(`${n.name} created`, 'ok'); }}>Duplicate</Btn>
            </>
          }
          tabs={[{ v: 'Overview', label: 'Overview' }, ...(d.body ? [{ v: 'Preview', label: 'Preview' }] : []), { v: 'Versions', label: 'Versions' }]}
          tab={tab}
          onTab={setTab}
          width={660}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          {tab === 'Overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p>{d.summary}</p>
              <Facts items={[{ k: 'Kind', v: d.kind }, { k: 'Version', v: `v${d.version}, ${d.updated} by ${d.by}` }, { k: 'Used by', v: plural(d.used, 'tenant') }, { k: 'Tenants can', v: d.mandatory ? 'Not turn it off; they may make it stricter' : 'Turn it off or copy and change it' }, ...(d.channels ? [{ k: 'Channels', v: d.channels.join(', ') }] : []), ...(d.vars ? [{ k: 'Variables', v: d.vars.map(v => `{{${v}}}`).join(' ') }] : [])]} />
            </div>
          ) : null}
          {tab === 'Preview' && d.body ? <NotificationPreview t={d} /> : null}
          {tab === 'Versions' ? (
            <Activity items={Array.from({ length: Math.min(d.version, 4) }, (_, i) => ({ icon: i ? 'git-commit' : 'circle-check', tone: i ? undefined : 'ok', text: `v${d.version - i}${i ? '' : ' (published)'}: ${i ? 'wording and thresholds' : d.summary.split('.')[0]}`, when: i ? `${String(28 - i * 6).padStart(2, '0')} ${['Sep', 'Aug', 'Jul'][i - 1] || 'Jun'} 2026, 11:00 IST` : d.updated }))} />
          ) : null}
        </Drawer>
      ) : null}
      {edit.value ? <EditDialog ctx={ctx} t={list.find(t => t.id === edit.value)!} closing={edit.closing} onClose={edit.close} onSave={t => { save(t); edit.close(); }} /> : null}
      {pub.value ? <PublishDialog ctx={ctx} t={list.find(t => t.id === pub.value)!} closing={pub.closing} onClose={pub.close} /> : null}
      {add.value ? (
        <NewDialog ctx={ctx} closing={add.closing} onClose={add.close} onAdd={t => { setList(x => [...x, t]); add.close(); drawer.open(t.id); setTab('Overview'); }} />
      ) : null}
    </Page>
  );
}

/** A notification as the customer receives it, in either brand. */
export function NotificationPreview({ t, extra }: { t: Template; extra?: Record<string, string> }) {
  const [brand, setBrand] = useState<keyof typeof BRANDS>('host360');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Seg label="Brand" value={brand} onChange={setBrand} options={[{ v: 'host360', label: 'Host360' }, { v: 'cloudnest', label: 'CloudNest (white-label)' }]} />
      <div style={{ border: '1px solid var(--ln-2)', background: 'var(--panel-2)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ln)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {brand === 'host360' ? <Icon name="mark" size={20} /> : <span style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', background: 'var(--tx)', color: 'var(--app)', font: '700 11px var(--f-ui)' }}>C</span>}
          <strong style={{ fontWeight: 600 }}>{BRANDS[brand].logo}</strong>
          <span style={{ flex: 1 }} />
          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>From {brand === 'host360' ? 'notify@host360.ai' : 'alerts@cloudnest.in'}</span>
        </div>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--ln)', fontWeight: 600 }}>{fill(t.subject || '', brand, extra)}</div>
        <div style={{ padding: '12px 14px', whiteSpace: 'pre-wrap', font: '14px/22px var(--f-body)' }}>{fill(t.body || '', brand, extra)}</div>
      </div>
      {brand === 'cloudnest' ? <p style={{ display: 'flex', gap: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}><Icon name="eye-off" style={{ marginTop: 1 }} />White-labelled: sent from CloudNest’s domain with their name, logo and signature. Host360 does not appear anywhere.</p> : null}
    </div>
  );
}

function EditDialog({ ctx, t, closing, onClose, onSave }: { ctx: Ctx; t: Template; closing: boolean; onClose: () => void; onSave: (t: Template) => void }) {
  const [summary, setSummary] = useState(t.summary);
  const [subject, setSubject] = useState(t.subject || '');
  const [body, setBody] = useState(t.body || '');
  const [mandatory, setMandatory] = useState(!!t.mandatory);
  const unknown = t.vars ? [...`${subject} ${body}`.matchAll(/\{\{([a-z_.]+)\}\}/g)].map(m => m[1]).filter(v => !t.vars!.includes(v) && !v.startsWith('brand.')) : [];
  const changed = summary !== t.summary || subject !== (t.subject || '') || body !== (t.body || '') || mandatory !== !!t.mandatory;
  return (
    <Dialog
      title={`Edit ${t.name}`}
      sub={`Saved as v${t.version + 1}. Tenants get it when you publish.`}
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!changed || !!unknown.length} why={unknown.length ? `Unknown variable: {{${unknown[0]}}}` : 'Nothing has changed.'} onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Edited a template', object: `${t.name} v${t.version + 1}`, when: ctx.now(), r: 'ok' }); ctx.toast(`${t.name} saved as v${t.version + 1}; publish it to reach tenants`, 'ok'); onSave({ ...t, summary, subject: t.body ? subject : undefined, body: t.body ? body : undefined, mandatory, version: t.version + 1, updated: ctx.now(), by: 'priya.raman' }); }}>Save v{t.version + 1}</Btn></>}
    >
      <Field id="te-s" label="What it does"><TextArea id="te-s" value={summary} onChange={setSummary} rows={2} /></Field>
      {t.body ? (
        <>
          <Field id="te-sub" label="Subject"><TextInput id="te-sub" value={subject} onChange={setSubject} /></Field>
          <Field id="te-b" label="Body" err={unknown.length ? `Unknown variable: {{${unknown[0]}}}` : null} hint={t.vars ? `Variables: ${t.vars.map(v => `{{${v}}}`).join(' ')}` : undefined}><TextArea id="te-b" value={body} onChange={setBody} rows={8} mono /></Field>
        </>
      ) : null}
      <CheckBox on={mandatory} onChange={setMandatory}>Mandatory for every tenant</CheckBox>
    </Dialog>
  );
}

function PublishDialog({ ctx, t, closing, onClose }: { ctx: Ctx; t: Template; closing: boolean; onClose: () => void }) {
  const s = useStore();
  const tenants = s.customers.filter(c => c.status !== 'archived');
  const [pick, setPick] = useState<string[]>(tenants.map(c => c.id));
  const n = t.mandatory ? tenants.length : pick.length;
  return (
    <Dialog
      title={`Publish ${t.name} v${t.version}`}
      sub={t.mandatory ? 'Mandatory: every tenant gets it.' : 'Tenants who changed their copy keep their changes; they see that a newer version exists.'}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="send" disabled={!n} why="Choose at least one tenant." onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Published a template', object: `${t.name} v${t.version}`, when: ctx.now(), r: 'ok', after: [['Tenants', String(n)]] }); ctx.toast(`${t.name} v${t.version} published to ${plural(n, 'tenant')}`, 'ok'); onClose(); }}>Publish to {plural(n, 'tenant')}</Btn></>}
    >
      {t.mandatory ? <Bar tone="info" icon="pin">Mandatory templates go to every tenant and cannot be switched off.</Bar> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {tenants.map(c => <CheckBox key={c.id} on={t.mandatory || pick.includes(c.id)} disabled={t.mandatory} why="Mandatory" onChange={v => setPick(x => (v ? [...x, c.id] : x.filter(y => y !== c.id)))}>{c.name}</CheckBox>)}
      </div>
    </Dialog>
  );
}

function NewDialog({ ctx, closing, onClose, onAdd }: { ctx: Ctx; closing: boolean; onClose: () => void; onAdd: (t: Template) => void }) {
  const [kind, setKind] = useState<TplKind>('Alert rule');
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  return (
    <Dialog
      title="New template"
      sub="Starts as v1 and optional. Publish it to make it available to tenants."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={name.trim().length < 4 || summary.trim().length < 10} why="Give a name and say what it does." onClick={() => { const t: Template = { id: 't' + Date.now(), kind, name: name.trim(), version: 1, updated: ctx.now(), by: 'priya.raman', used: 0, summary: summary.trim(), ...(kind === 'Notification' ? { channels: ['E-mail'], subject: name.trim(), body: 'Hello {{customer.contact_first_name}},\n\n\n\n{{brand.signature}}', vars: ['customer.contact_first_name', 'brand.signature'] } : {}) }; ctx.toast(`${t.name} created`, 'ok'); onAdd(t); }}>Create</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0,1fr)', gap: 16 }}>
        <Field id="nt-k" label="Kind"><SelectInput id="nt-k" value={kind} onChange={k => setKind(k as TplKind)} options={KINDS} /></Field>
        <Field id="nt-n" label="Name"><TextInput id="nt-n" value={name} onChange={setName} placeholder="Replication paused over 1 hour" autoFocus /></Field>
      </div>
      <Field id="nt-s" label="What it does"><TextArea id="nt-s" value={summary} onChange={setSummary} rows={3} placeholder="Warning when replication for a workload has been paused for more than an hour." /></Field>
    </Dialog>
  );
}
