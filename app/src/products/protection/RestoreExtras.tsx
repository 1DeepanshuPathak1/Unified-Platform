import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { Btn, CheckBox, Field, RadioCard, SelectInput, TextArea, TextInput } from '../../ui/controls';
import { Bar, Facts, MiniTable } from '../../ui/layout';
import { Dialog } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { CUSTOMERS } from '../../data/platform';
import { audit } from '../../platform/store';

/** Checks run before a restore starts, so a restore never fails half way for a reason known in advance. */
export function RestorePreflight({ guest, kind, target, site, sizeGB, dest, locked }: { guest: string; kind: string; target: string; site: string; sizeGB: number; dest: string; locked: boolean }) {
  const instant = target === 'instant';
  const checks: [string, string, 'ok' | 'warn'][] = [
    ['Recovery point readable', `Chain verified ${locked ? 'and locked ' : ''}on ${dest}`, 'ok'],
    ['Space on the target', kind === 'Files' ? 'Not needed' : instant ? 'Runs from the repository; 120 GB of scratch space for writes' : `${Math.ceil(sizeGB * 1.1)} GB needed · 3.1 TB free on ${target === 'site' ? site : 'local-zfs'}`, 'ok'],
    kind === 'Files'
      ? ['Names in the VM', target === 'orig' ? 'Files with the same name get a .restored suffix' : 'New folder; nothing is overwritten', 'ok']
      : ['Name on the target', target === 'new' ? `${guest}-restored is free` : target === 'orig' || target === 'instant' ? `${guest} will be replaced` : 'No conflict', target === 'orig' || target === 'instant' ? 'warn' : 'ok'],
    ['Network', kind === 'Files' ? 'The agentless file copy uses the guest tools channel' : target === 'site' ? 'Mapped through the site’s network mapping' : 'Same network as the original; IP conflict check passed', 'ok'],
    ['Archive tier', 'Not archived: no rehydration wait or retrieval charge', 'ok'],
    ['Malware scan of the point', 'Clean (signature set of 21 Oct)', 'ok']
  ];
  const mins = kind === 'Files' ? 2 : instant ? 3 : Math.max(4, Math.round((sizeGB * 1024) / 220 / 60) + 3);
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--ln)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ font: '600 13px/18px var(--f-ui)' }}>Pre-flight</h3>
      {checks.map(([k, v, t]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr)', gap: 8, font: '12px/16px var(--f-ui)' }}>
          <Icon name={t === 'ok' ? 'circle-check' : 'triangle-alert'} style={{ color: t === 'ok' ? 'var(--ok)' : 'var(--warn)', marginTop: 1 }} />
          <span>
            <span style={{ display: 'block', color: 'var(--tx)' }}>{k}</span>
            <span style={{ color: 'var(--tx-3)' }}>{v}</span>
          </span>
        </div>
      ))}
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
        {instant ? `Running in about ${mins} min; moved to production storage in about ${Math.max(6, Math.round(sizeGB / 12))} min while it runs.` : `Estimated time ${mins} min. The measured time is kept with the job and counts towards the restore-time SLA in Reports.`}
      </p>
    </div>
  );
}

const FOUND = [
  { name: 'kav-erp-01', type: 'Proxmox VM', pts: 42, newest: '30 Sep 2026, 02:00', size: '412 GB' },
  { name: 'kav-db-01', type: 'Proxmox VM', pts: 42, newest: '30 Sep 2026, 02:00', size: '820 GB' },
  { name: 'kav-file-01', type: 'Proxmox VM', pts: 30, newest: '29 Sep 2026, 22:00', size: '1.32 TB' },
  { name: 'KAV-LT-0007', type: 'Endpoint', pts: 28, newest: '28 Sep 2026, 13:10', size: '61 GB' },
  { name: 'kav-web-01', type: 'OpenStack instance', pts: 14, newest: '30 Sep 2026, 23:00', size: '96 GB' }
];

/**
 * Protection › Restore › Restore from another account: attach a repository written by another Aegis
 * account or installation, unlock it with that account's key, and restore from its points read-only.
 */
export function ForeignRepoDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [type, setType] = useState('S3-compatible');
  const [where, setWhere] = useState('https://s3.mum.host360.ai/kaveri-backups/aegis');
  const [cred, setCred] = useState('vault: secret/imports/kaveri-s3');
  const [keyMode, setKeyMode] = useState<'phrase' | 'kms'>('phrase');
  const [phrase, setPhrase] = useState('');
  const [into, setInto] = useState(ctx.actingAs?.customer || 'kav');
  const [state, setState] = useState<'idle' | 'scan' | 'found' | 'bad'>('idle');
  const words = phrase.trim().split(/\s+/).filter(Boolean).length;
  const keyOk = keyMode === 'kms' || words === 24;
  const scan = () => {
    setState('scan');
    window.setTimeout(() => setState(phrase.includes('wrong') ? 'bad' : 'found'), 1400);
  };
  const attach = () => {
    audit({ who: 'priya.raman', customer: into, what: 'Attached a repository from another account (read-only)', object: where, when: ctx.now(), r: 'ok', after: [['Workloads', String(FOUND.length)], ['Recovery points', String(FOUND.reduce((a, f) => a + f.pts, 0))], ['Mounted for', '30 days']] });
    ctx.toast(`${FOUND.length} workloads from the other account are ready to restore`, 'ok');
    onClose();
  };
  const custs = CUSTOMERS.filter(c => c.status !== 'archived' && (!ctx.actingAs?.customer || c.id === ctx.actingAs.customer));
  return (
    <Dialog
      title="Restore from another account"
      sub="Attach a repository written by another Aegis account or installation, unlock it with that account’s key and restore from it. Nothing is copied until you restore."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          {state === 'found' ? (
            <Btn kind="primary" icon="check" perm={ctx.can('restore', 'Restoring')} onClick={attach}>Attach read-only for 30 days</Btn>
          ) : (
            <Btn kind="primary" icon={state === 'scan' ? 'loader-circle' : 'search'} spin={state === 'scan'} disabled={state === 'scan' || !keyOk || !where.trim()} why={!keyOk ? 'Enter all 24 words of the recovery key, or pick a KMS key.' : 'Enter where the repository is.'} onClick={scan}>
              {state === 'scan' ? 'Scanning…' : 'Scan repository'}
            </Btn>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="fr-t" label="Repository type"><SelectInput id="fr-t" value={type} onChange={setType} options={['S3-compatible', 'Amazon S3', 'Azure Blob', 'Google Cloud Storage', 'Host360 Object Storage', 'Filesystem over SSH', 'Tape (catalogue from the media)']} /></Field>
        <Field id="fr-c" label="Restore into" hint="The points are attached to this customer only."><SelectInput id="fr-c" value={into} onChange={setInto} options={custs.map(c => ({ v: c.id, label: c.name }))} /></Field>
        <Field id="fr-w" label="Location" span={2}><TextInput id="fr-w" value={where} onChange={setWhere} mono /></Field>
        <Field id="fr-k" label="Access credential" hint="Read-only access is enough. Stored in the vault, removed when the mount expires." span={2}><TextInput id="fr-k" value={cred} onChange={setCred} mono /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={keyMode === 'phrase'} onClick={() => setKeyMode('phrase')} icon="key" title="Recovery key" note="The 24 words the other account saved when its key was created" />
        <RadioCard on={keyMode === 'kms'} onClick={() => setKeyMode('kms')} icon="shield" title="Key in a KMS" note="The other account granted you decrypt access in its KMS" />
      </div>
      {keyMode === 'phrase' ? (
        <Field id="fr-p" label="Recovery key" hint={`${words} of 24 words. Used once to unwrap the repository key; never stored.`}>
          <TextArea id="fr-p" value={phrase} onChange={setPhrase} rows={2} mono placeholder="orbit valley ember …" />
        </Field>
      ) : (
        <Field id="fr-m" label="KMS key"><SelectInput id="fr-m" value="arn:aws:kms:ap-south-1:4410:key/kav-aegis" onChange={() => {}} options={['arn:aws:kms:ap-south-1:4410:key/kav-aegis', 'vault: transit/keys/kaveri-aegis']} /></Field>
      )}
      {state === 'bad' ? <Bar tone="err" multiline>The key does not unlock this repository. Check the words, or ask the other account to grant KMS access. Attempts are logged.</Bar> : null}
      {state === 'found' ? (
        <>
          <Bar tone="ok" multiline>Unlocked. Written by Aegis 4.1 for “Kaveri Logistics (old account)”; Object Lock in governance mode until 30 Dec 2026, which stays in force.</Bar>
          <MiniTable
            label="Found in the repository"
            cols={[{ label: 'Workload', w: 'minmax(0,1fr)' }, { label: 'Type', w: '150px' }, { label: 'Points', w: '64px', r: true }, { label: 'Newest', w: '160px' }, { label: 'Size', w: '80px', r: true }]}
            rows={FOUND.map(f => [<strong key="n" style={{ fontWeight: 600 }}>{f.name}</strong>, f.type, String(f.pts), f.newest, f.size])}
          />
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>The points appear in Restore and in Recovery points marked “Other account”. The mount and the stored credential expire after 30 days; both accounts’ audit logs record it.</p>
        </>
      ) : (
        <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Use it when a customer moves to you from another Aegis provider, or to recover data from a closed account.</p>
      )}
    </Dialog>
  );
}

type App = 'SQL Server' | 'Oracle' | 'PostgreSQL' | 'Active Directory';
const APPS: { app: App; server: string; customer: string; what: string; chain: string; from: string; to: string; items: [string, string, string][] }[] = [
  { app: 'SQL Server', server: 'sql-prod-02', customer: 'h360', what: 'SQL Server 2022 · 3 databases', chain: 'Full every night, logs every 15 min', from: '14 Oct 2026, 02:00:00', to: '21 Oct 2026, 15:45:00', items: [['ERP_LEDGER', '412 GB', 'Full recovery model'], ['ERP_HR', '38 GB', 'Full recovery model'], ['ReportServer', '6 GB', 'Simple: no point in time, nightly only']] },
  { app: 'Oracle', server: 'mum-oracle-phy-01', customer: 'mer', what: 'Oracle 19c · TREASURY (CDB) with 2 PDBs', chain: 'RMAN level 0 weekly, level 1 nightly, archive logs every 15 min', from: '07 Oct 2026, 01:00:00', to: '21 Oct 2026, 15:30:00', items: [['TRS_DEAL', '880 GB', 'PDB'], ['TRS_RISK', '140 GB', 'PDB']] },
  { app: 'PostgreSQL', server: 'his-db-01', customer: 'sah', what: 'PostgreSQL 15 · 4 databases', chain: 'Base backup nightly, WAL archived every 5 min', from: '14 Oct 2026, 01:00:00', to: '21 Oct 2026, 16:00:00', items: [['his_emr', '190 GB', ''], ['his_lab', '22 GB', ''], ['his_pacs_index', '14 GB', ''], ['his_billing', '9 GB', '']] },
  { app: 'Active Directory', server: 'ad-dc-01', customer: 'h360', what: 'HOST360.LOCAL · 1,180 users, 240 groups, 66 GPOs', chain: 'System state every night', from: '22 Sep 2026', to: '21 Oct 2026, 02:00', items: [['rakesh.n (user)', 'Deleted 21 Oct, 09:12', 'In the AD recycle bin'], ['Finance-Approvers (group)', '4 members removed 20 Oct', ''], ['Default Domain Policy (GPO)', 'Changed 19 Oct, 17:30', 'Password age 90 → 365 days']] }
];

/** Protection › Restore › Application items: database point in time from logs, and directory objects. */
export function AppRestoreDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const apps = APPS.filter(a => !ctx.actingAs || a.customer === ctx.actingAs.customer);
  const [app, setApp] = useState<App>(apps[0]?.app || 'SQL Server');
  const a = apps.find(x => x.app === app) || apps[0];
  const [pick, setPick] = useState<string[]>([]);
  const [when, setWhen] = useState('21 Oct 2026, 14:52:30');
  const [how, setHow] = useState('As a new database next to the original');
  const isDir = app === 'Active Directory';
  const fmtOk = /^\d{2} \w{3} \d{4}, \d{2}:\d{2}:\d{2}$/.test(when);
  const err = !pick.length ? 'Choose at least one item.' : !isDir && !fmtOk ? 'Write the time as 21 Oct 2026, 14:52:30.' : null;
  if (!a) return null;
  return (
    <Dialog
      title="Restore application items"
      sub="Databases to a point in time from their logs, and single directory objects, without restoring the whole server."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn
            kind="primary"
            icon="rotate-ccw"
            disabled={!!err}
            why={err || undefined}
            perm={ctx.can('restore', 'Restoring')}
            onClick={() => {
              ctx.startJob({ name: isDir ? 'Restore directory objects' : 'Point-in-time restore', object: `${a.server}: ${pick.join(', ')}`, product: 'Backup', type: 'Restore', phases: isDir ? ['Queued', 'Mount system state', 'Restore objects', 'Check replication', 'Done'] : ['Queued', 'Restore full backup', 'Apply logs', 'Recover', 'Check consistency', 'Done'], speed: 12, rate: '260 MB/s', firstLine: isDir ? `Restoring ${pick.length} objects to HOST360.LOCAL` : `Restoring ${pick.join(', ')} to ${when}` });
              audit({ who: 'priya.raman', customer: a.customer, what: isDir ? 'Restored directory objects' : 'Started a point-in-time database restore', object: `${a.server}: ${pick.join(', ')}`, when: ctx.now(), r: 'ok', note: isDir ? undefined : `${when} · ${how}` });
              ctx.toast(isDir ? `${pick.length} directory objects being restored` : `${pick.join(', ')} restoring to ${when}`, 'info');
              onClose();
            }}
          >
            Restore {pick.length || ''}
          </Btn>
        </>
      }
    >
      <div role="radiogroup" aria-label="Application" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {apps.map(x => (
          <RadioCard key={x.app} on={app === x.app} onClick={() => { setApp(x.app); setPick([]); }} icon={x.app === 'Active Directory' ? 'users' : 'database'} title={x.app} note={x.server} />
        ))}
      </div>
      <Facts labelW={120} items={[{ k: 'Server', v: `${a.server} · ${a.what}` }, { k: 'Kept', v: a.chain }, { k: 'Restorable', v: `${a.from} to ${a.to}` }]} />
      <MiniTable
        label={isDir ? 'Directory objects' : 'Databases'}
        cols={[{ label: '', w: '28px' }, { label: isDir ? 'Object' : 'Database', w: 'minmax(0,1fr)' }, { label: isDir ? 'What changed' : 'Size', w: '200px' }, { label: '', w: 'minmax(0,1fr)' }]}
        rows={a.items.map(([n, z, note]) => [<CheckBox key="c" label={`Select ${n}`} on={pick.includes(n)} onChange={v => setPick(p => (v ? [...p, n] : p.filter(x => x !== n)))} />, <strong key="n" style={{ fontWeight: 600 }}>{n}</strong>, z, <span key="o" style={{ color: 'var(--tx-3)' }}>{note}</span>])}
      />
      {isDir ? (
        <Bar tone="info" multiline>Objects are restored with their attributes, group memberships and links; a deleted user still in the recycle bin is reanimated with its SID. GPOs are restored with their links and security filtering.</Bar>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field id="ar-t" label="Point in time" hint="Any second between the oldest full backup and the newest log." err={!fmtOk ? 'Write it as 21 Oct 2026, 14:52:30.' : null}>
            <TextInput id="ar-t" value={when} onChange={setWhen} mono />
          </Field>
          <Field id="ar-h" label="Restore">
            <SelectInput id="ar-h" value={how} onChange={setHow} options={['As a new database next to the original', 'Over the original, after a tail-log backup', 'To another server', 'Export as a native backup file']} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
