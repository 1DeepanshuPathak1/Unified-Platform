import { useState } from 'react';
import { Btn, Toggle } from '../ui/controls';
import { Bar, Facts, MiniTable, Panel, Status } from '../ui/layout';
import { StepUp } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit } from './store';

/** Host360 Cloud accounts and the Aegis tenant each one became. */
const ACCOUNTS = [
  { acct: 'H360-CL-10482', name: 'Kaveri Logistics Pvt Ltd', tenant: 'kav', vdcs: 'Proxmox VDC kav-prod (Chennai), OpenStack project kav-web', products: 'Protection', plan: 'Silver', synced: '21 Oct, 16:00' },
  { acct: 'H360-CL-10533', name: 'Nilgiri Retail', tenant: 'nil', vdcs: 'Proxmox VDC nil-pos (Chennai)', products: 'Protection (trial)', plan: 'Bronze', synced: '21 Oct, 16:00' },
  { acct: 'H360-CL-10611', name: 'Coromandel Insurance', tenant: 'cor', vdcs: 'OpenStack project cor-core (Mumbai)', products: 'Protection', plan: 'Gold', synced: '21 Oct, 16:00' },
  { acct: 'H360-CL-10702', name: 'Vellore Agro Exports', tenant: '', vdcs: 'Proxmox VDC vae-erp (Chennai)', products: '—', plan: '—', synced: '21 Oct, 15:42' }
];
const PLANS = [
  { name: 'Bronze', rpo: 'Daily', keep: '14 days', copy: 'No offsite copy', imm: 'No', price: '₹450 a VM a month' },
  { name: 'Silver', rpo: 'Every 12 h', keep: '30 days, 12 monthly', copy: 'Offsite copy (Mumbai)', imm: '14 days', price: '₹650 a VM a month' },
  { name: 'Gold', rpo: 'Every 4 h', keep: '30 days, 12 monthly, 7 yearly', copy: 'Offsite copy (Mumbai)', imm: '30 days', price: '₹980 a VM a month' }
];
const LICENCES = [
  { order: 'PP-ORD-77310', partner: 'CloudNest IT Services', what: 'Protection Business · 40 VMs · 1 year', tenant: 'Sahyadri Hospitals', applied: '02 Oct 2026' },
  { order: 'PP-ORD-77544', partner: 'CloudNest IT Services', what: 'Protection Standard · 15 VMs · trial to paid', tenant: 'Nilgiri Retail', applied: 'Waiting: trial ends 05 Nov' }
];

/** Settings › Host360 portals: how Aegis plugs into the Host360 cloud portal and the Partner Portal. */
export function Host360PortalsTab({ ctx }: { ctx: Ctx }) {
  const [atCreate, setAtCreate] = useState(true);
  const [autoTenant, setAutoTenant] = useState(true);
  const [mfa, setMfa] = useState(false);
  const cfg = ctx.can('admin', 'Changing the Host360 portal integration');
  const unlinked = ACCOUNTS.filter(a => !a.tenant);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Host360 Cloud portal" right={<Status icon="circle-check" tone="ok" label="Connected" />}>
          <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Facts
              labelW={150}
              items={[
                { k: 'Portal', v: 'cloud.host360.ai (Proxmox and OpenStack VDCs)' },
                { k: 'Calls Aegis as', v: 'svc-h360-cloud: tenants, policies and restores; no access to recovery point contents' },
                { k: 'Credential', v: 'OAuth client, rotated every 90 days; next rotation 14 Dec 2026' },
                { k: 'Events Aegis sends', v: 'backup.completed, backup.failed, restore.finished, storage.threshold_crossed' },
                { k: 'Last sync', v: '21 Oct, 16:00 IST · every 5 minutes', icon: 'circle-check', tone: 'ok' }
              ]}
            />
            <Toggle on={autoTenant} onChange={v => { setAutoTenant(v); ctx.toast(v ? 'New Host360 Cloud accounts get an Aegis tenant automatically' : 'New accounts wait for a provider to link them', 'ok'); }} label="Create tenants automatically" perm={cfg}>A new Host360 Cloud account gets its own Aegis tenant, isolated like any other</Toggle>
            <Toggle on={atCreate} onChange={v => { setAtCreate(v); ctx.toast(v ? 'Backup plans are offered when a VM is created' : 'Backup plans are no longer offered at VM creation', 'ok'); }} label="Offer backup at VM creation" perm={cfg}>Offer a backup plan in the VM create form and the marketplace</Toggle>
          </div>
        </Panel>
        <Panel title="What customers can do from the cloud portal">
          <div style={{ padding: '4px 16px 12px' }}>
            <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Pick a backup plan when they create a VM, or change it later</li>
              <li>See each VM’s last backup and its recovery points</li>
              <li>Restore a VM, a disk or files to the same or another VDC</li>
              <li>Find backups in a repository and restore them into a new account</li>
              <li>Get alerts for failed backups and nearly full storage</li>
            </ul>
            <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Everything else (policies, keys, compliance) stays in this console, under the same tenant.</p>
          </div>
        </Panel>
      </div>
      {unlinked.length ? <Bar tone="warn" actions={<Btn kind="ghost" size="sm" perm={cfg} onClick={() => ctx.go('customers')}>Create the tenant</Btn>}>{unlinked.map(a => `${a.name} (${a.acct})`).join(', ')} has a Host360 Cloud account but no Aegis tenant yet, so its VMs cannot be backed up.</Bar> : null}
      <Panel title="Accounts and tenants">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Host360 Cloud accounts"
            cols={[{ label: 'Account', w: '130px' }, { label: 'Customer', w: 'minmax(0,1fr)' }, { label: 'VDCs', w: 'minmax(0,1.3fr)' }, { label: 'Products', w: '140px' }, { label: 'Plan', w: '70px' }, { label: 'Synced', w: '110px' }]}
            rows={ACCOUNTS.map(a => [a.acct, a.tenant ? <strong key="n" style={{ fontWeight: 600 }}>{a.name}</strong> : <span key="n" style={{ color: 'var(--warn)' }}>{a.name} · no tenant</span>, <span key="v" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={a.vdcs} data-tip-overflow="">{a.vdcs}</span>, a.products, a.plan, a.synced])}
          />
        </div>
      </Panel>
      <Panel title="Backup plans offered in the cloud portal" right={<Btn kind="ghost" size="sm" iconAfter="arrow-right" onClick={() => ctx.go('billing/plans')}>Plans and editions</Btn>}>
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Cloud backup plans"
            cols={[{ label: 'Plan', w: '80px' }, { label: 'Backups', w: '100px' }, { label: 'Kept', w: 'minmax(0,1fr)' }, { label: 'Copy', w: 'minmax(0,1fr)' }, { label: 'Immutable', w: '90px' }, { label: 'Price', w: '150px', r: true }]}
            rows={PLANS.map(p => [<strong key="n" style={{ fontWeight: 600 }}>{p.name}</strong>, p.rpo, p.keep, p.copy, p.imm, p.price])}
          />
          <p style={{ marginTop: 8, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Each plan is a backup policy template; the customer’s criticality tier can raise it but never lower it.</p>
        </div>
      </Panel>
      <Panel title="Host360 Partner Portal" right={<Status icon="circle-check" tone="ok" label="Connected" />}>
        <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Facts
            labelW={150}
            items={[
              { k: 'Portal', v: 'partners.host360.ai' },
              { k: 'Partners call Aegis for', v: 'Creating customers, entitling products, usage and margin per customer, licence keys' },
              { k: 'Partners linked', v: 'CloudNest IT Services (2 customers)' }
            ]}
          />
          <MiniTable
            label="Licences bought in the Partner Portal"
            cols={[{ label: 'Order', w: '120px' }, { label: 'Partner', w: '170px' }, { label: 'What', w: 'minmax(0,1fr)' }, { label: 'For', w: '160px' }, { label: 'Applied', w: '180px' }]}
            rows={LICENCES.map(l => [l.order, l.partner, l.what, l.tenant, l.applied])}
          />
          {!mfa ? (
            <div style={{ maxWidth: 420 }}>
              <StepUp verified={mfa} onVerified={() => setMfa(true)} />
            </div>
          ) : (
            <div>
              <Btn kind="outline" size="sm" icon="refresh-cw" perm={cfg} onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Rotated the Partner Portal credential', object: 'svc-partner-portal', when: ctx.now(), r: 'ok' }); ctx.toast('Partner Portal credential rotated; the portal picked up the new one', 'ok'); }}>Rotate the Partner Portal credential</Btn>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
