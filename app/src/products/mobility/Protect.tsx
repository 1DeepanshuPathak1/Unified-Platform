import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { TIERS, TIER_RULES, TIER_SHORT, type Tier } from '../../data/platform';
import { Btn, CheckBox, RadioCard, SelectInput } from '../../ui/controls';
import { Bar, MiniTable, Panel, Status, plural } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { custName, Go, inScope, scopeCustomers, showCustomerCol } from '../../platform/common';
import { audit, update, useStore } from '../../platform/store';
import { tierOf } from './assess';
import { COMMITTED_AT, INVENTORY } from './data';

const DR_SITE = 'region-2-os';
const vmOf = (name: string) => INVENTORY.find(v => v.name === name);

/** Servers whose migration is committed but that have no backup or DR set up yet. */
export function useUnprotected(ctx: Ctx) {
  const s = useStore();
  const scope = scopeCustomers(ctx);
  return INVENTORY.filter(v => v.stage === 'committed' && !s.migProtect[v.name] && scope.includes(v.customer) && inScope(ctx, v.customer));
}

/**
 * Protection follows the workload: once a migration is committed, offer backup and DR at the
 * destination from the server's criticality tier, so nothing lands unprotected.
 */
export function ProtectDialog({ ctx, names, closing, onClose }: { ctx: Ctx; names: string[]; closing: boolean; onClose: () => void }) {
  const [rows, setRows] = useState(() =>
    names.map(n => {
      const v = vmOf(n);
      const tier: Tier = v ? tierOf(v) : 'Standard';
      return { name: n, dest: v?.dest || 'production-openstack', tier, backup: true, dr: tier !== 'Standard' };
    })
  );
  const [when, setWhen] = useState<'now' | 'window'>('now');
  const set = (i: number, p: Partial<(typeof rows)[number]>) => setRows(r => r.map((x, j) => (j === i ? { ...x, ...p, ...(p.tier ? { dr: p.tier !== 'Standard' } : {}) } : x)));
  const chosen = rows.filter(r => r.backup || r.dr);
  const perm = ctx.can('configure', 'Setting up backup and DR');
  const confirm = () => {
    update(s => {
      for (const r of chosen) s.migProtect[r.name] = { tier: r.tier, backup: r.backup ? TIER_RULES[r.tier].backup : undefined, dr: r.dr ? `${TIER_RULES[r.tier].dr.split(' (')[0]} to ${DR_SITE}` : undefined, by: 'priya.raman', when: ctx.now() };
    });
    for (const r of chosen) audit({ who: 'priya.raman', customer: vmOf(r.name)?.customer || 'h360', what: 'Protected a migrated server', object: r.name, when: ctx.now(), r: 'ok', after: [['Tier', r.tier], ['Backup', r.backup ? TIER_RULES[r.tier].backup : 'None'], ['DR', r.dr ? TIER_RULES[r.tier].dr : 'None']] });
    if (when === 'now' && chosen.some(r => r.backup)) {
      const b = chosen.filter(r => r.backup);
      ctx.startJob({ name: 'First backup', object: b.length === 1 ? b[0].name : `${b.length} migrated servers`, product: 'Backup', type: 'Backup', phases: ['Snapshot', 'Read', 'Write to repository', 'Verify'], speed: 2, doneToast: `First backup of ${b.length === 1 ? b[0].name : plural(b.length, 'server')} finished` });
    }
    ctx.toast(`${plural(chosen.length, 'server')} protected${when === 'now' ? '; the first backup has started' : '; the first backup runs in the policy window'}`, 'ok');
    onClose();
  };
  return (
    <Dialog
      title={names.length === 1 ? `Protect ${names[0]} at its new home` : `Protect ${plural(names.length, 'migrated server')}`}
      sub="Backup and DR follow the workload: they come from its criticality tier. Change the tier if it is wrong."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Not now</Btn>
          <Btn kind="primary" icon="archive" perm={perm} disabled={!chosen.length} why="Choose backup or DR for at least one server." onClick={confirm}>
            Protect {chosen.length === names.length ? '' : `${chosen.length} of ${names.length}`}
          </Btn>
        </>
      }
      footNote="Servers left unprotected stay on the Mobility overview until they are protected."
    >
      <MiniTable
        label="Servers to protect"
        cols={[{ label: 'Server' }, { label: 'Tier', w: '150px' }, { label: 'Backup', w: '160px' }, { label: 'DR', w: '150px' }]}
        rows={rows.map((r, i) => [
          <strong key="n" data-tip={`${r.name} at ${r.dest}`} style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</strong>,
          <SelectInput key="t" value={r.tier} onChange={t => set(i, { tier: t as Tier })} options={TIERS.map(t => ({ v: t, label: `${TIER_SHORT[t]} · ${t}` }))} width={146} />,
          <CheckBox key="b" on={r.backup} onChange={x => set(i, { backup: x })}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={TIER_RULES[r.tier].backup}>{TIER_RULES[r.tier].backup.split(' · ')[0]}</span>
          </CheckBox>,
          <CheckBox key="d" on={r.dr} onChange={x => set(i, { dr: x })} disabled={r.tier === 'Standard'} why="Standard tier does not need DR. Raise the tier to replicate.">
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={TIER_RULES[r.tier].dr}>{r.tier === 'Standard' ? 'Not required' : TIER_RULES[r.tier].dr.split(' (')[0]}</span>
          </CheckBox>
        ])}
      />
      {rows.some(r => r.dr) ? (
        <p style={{ display: 'flex', gap: 8 }}>
          <Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: 2, flex: 'none' }} />
          DR replicates to {DR_SITE}, which has not answered since 14:52 IST. Replication is set up now and starts when it answers.
        </p>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={when === 'now'} onClick={() => setWhen('now')} title="First backup now" note="A full backup; later ones are incremental" />
        <RadioCard on={when === 'window'} onClick={() => setWhen('window')} title="In the policy window" note="Tonight, with the policy's other backups" />
      </div>
    </Dialog>
  );
}

/** Mobility overview panel: migrated, not yet protected. */
export function UnprotectedPanel({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const list = useUnprotected(ctx);
  const dlg = useClosable<string[]>();
  const scope = scopeCustomers(ctx);
  const done = INVENTORY.filter(v => v.stage === 'committed' && s.migProtect[v.name] && scope.includes(v.customer) && inScope(ctx, v.customer));
  const perm = ctx.can('configure', 'Setting up backup and DR');
  const showCust = showCustomerCol(ctx);
  return (
    <Panel
      title={<>Migrated, not yet protected <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', fontWeight: 400 }}>{list.length}</span></>}
      right={list.length > 1 ? <Btn kind="outline" size="sm" icon="archive" perm={perm} onClick={() => dlg.open(list.map(v => v.name))}>Protect all…</Btn> : undefined}
    >
      <div style={{ padding: '0 16px 4px' }}>
        {list.length ? (
          <Bar tone="warn" style={{ margin: '12px 0 4px' }}>
            {plural(list.length, 'server')} run at the destination with no backup. The VMware copies they came from are no longer kept in sync.
          </Bar>
        ) : null}
        <MiniTable
          label="Migrated, not yet protected"
          cols={[{ label: 'Server' }, { label: 'Tier', w: '64px' }, { label: 'Committed', w: '96px' }, { label: '', w: '96px', r: true }]}
          rows={list.map(v => [
            <span key="n" style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              <Go ctx={ctx} to="mig/servers" id={v.name}>{v.name}</Go>
              <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{showCust ? `${custName(v.customer)} · ` : ''}{v.dest}</span>
            </span>,
            TIER_SHORT[tierOf(v)],
            COMMITTED_AT[v.name] || '18 Oct',
            <Btn key="b" kind="ghost" size="sm" icon="archive" perm={perm} onClick={() => dlg.open([v.name])}>Protect…</Btn>
          ])}
          empty={`Every migrated server is protected${done.length ? ` (${done.length} so far)` : ''}.`}
        />
        {done.length && list.length ? <p style={{ padding: '8px 0', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}><Status icon="circle-check" tone="ok" label={`${done.length} migrated servers already protected`} /></p> : null}
      </div>
      {dlg.value ? <ProtectDialog ctx={ctx} names={dlg.value} closing={dlg.closing} onClose={dlg.close} /> : null}
    </Panel>
  );
}

/** A notice at the top of the Mobility overview while migrated servers have no backup. */
export function UnprotectedBar({ ctx }: { ctx: Ctx }) {
  const list = useUnprotected(ctx);
  const dlg = useClosable<string[]>();
  if (!list.length) return null;
  return (
    <>
      <Bar tone="warn" icon="archive" actions={<Btn kind="ghost" size="sm" icon="archive" perm={ctx.can('configure', 'Setting up backup and DR')} onClick={() => dlg.open(list.map(v => v.name))}>Protect…</Btn>}>
        {plural(list.length, 'migrated server')} {list.length === 1 ? 'has' : 'have'} no backup at the destination: {list.slice(0, 4).map(v => v.name).join(', ')}{list.length > 4 ? ` and ${list.length - 4} more` : ''}.
      </Bar>
      {dlg.value ? <ProtectDialog ctx={ctx} names={dlg.value} closing={dlg.closing} onClose={dlg.close} /> : null}
    </>
  );
}
