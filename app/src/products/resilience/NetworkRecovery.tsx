import { useState } from 'react';
import { Btn, Field, SelectInput, Tabs, TextInput } from '../../ui/controls';
import { Bar, Facts, MiniTable, Panel, Status, Tiles } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import AegisMappings from '../../screens/AegisMappings';
import { WORKLOADS } from '../../data/platform';
import { audit } from '../../platform/store';

type Rule = [string, string, string, string];
interface Profile { id: string; name: string; used: string; from: string; to: string; rules: Rule[]; dns: string; hostname: string; register: string; domain: string; mac: string; vlan: string; pins: [string, string, string][] }
const PROFILES: Profile[] = [
  {
    id: 'p1', name: 'production-openstack → region-2-os', used: 'Resilience: CBS failover, Billing', from: 'production-openstack', to: 'region-2-os',
    rules: [['10.60.1.0/24', '10.70.1.0/24', '10.70.1.1', 'Keep the last octet'], ['10.60.2.0/24', '10.70.2.0/24', '10.70.2.1', 'Keep the last octet'], ['172.16.20.0/24', '172.18.20.0/24', '172.18.20.1', 'Next free address from Infoblox']],
    dns: '10.70.0.10, 10.70.0.11', hostname: 'Keep', register: 'Update A and PTR records in Infoblox; TTL lowered to 60 s a day before drills', domain: 'Stay joined: the DR domain controllers replicate from production', mac: 'New MAC; servers with MAC-bound licences keep theirs', vlan: 'VLAN 60 → VLAN 70',
    pins: [['cbs-db-01', '10.70.1.11', 'NPCI allow-lists this address'], ['payments-api', '10.70.2.21', 'Partner firewall rule']]
  },
  {
    id: 'p2', name: 'Chennai vCenter → Chennai-proxmox-prod', used: 'Resilience: Core banking reporting failover · Mobility: Wave 2', from: 'Chennai vCenter', to: 'Chennai-proxmox-prod',
    rules: [['172.25.10.0/24', '10.62.10.0/24', '10.62.10.1', 'Keep the last octet']],
    dns: '10.62.0.10', hostname: 'Keep', register: 'Update A and PTR records in Microsoft DNS (MERIDIAN.LOCAL)', domain: 'Rejoin MERIDIAN.LOCAL with the existing machine account; SID kept', mac: 'Keep (rpt-app-01 has a MAC-bound licence)', vlan: 'Port group VM-Net-10 → bridge vmbr10',
    pins: []
  },
  {
    id: 'p3', name: 'Any site → test bubble', used: 'Resilience: every test failover', from: 'Any', to: 'Isolated test networks',
    rules: [['Any', 'Same addresses', 'Bubble router', 'Keep: the bubble has no route out']],
    dns: 'Bubble DNS with a copy of the production zones', hostname: 'Keep', register: 'Bubble DNS only; production DNS is never changed', domain: 'Keep; a copy of a domain controller starts first', mac: 'Keep', vlan: 'Isolated network per drill',
    pins: []
  }
];

const inSubnet = (ip: string, cidr: string) => cidr !== 'Any' && ip.split('.').slice(0, 3).join('.') === cidr.split('/')[0].split('.').slice(0, 3).join('.');
function newIp(p: Profile, ip: string, name: string): [string, string] {
  const pin = p.pins.find(x => x[0] === name);
  if (pin) return [pin[1], 'Pinned'];
  const r = p.rules.find(x => inSubnet(ip, x[0]));
  if (!r) return ['No rule', 'warn'];
  if (r[3].startsWith('Keep the last')) return [`${r[1].split('/')[0].split('.').slice(0, 3).join('.')}.${ip.split('.')[3]}`, 'Rule'];
  return ['From IPAM at failover', 'Rule'];
}

/** Infrastructure › Mappings: the original site mappings, re-IP rules and identity at the recovery site. */
export function MappingsPage({ ctx }: { ctx: Ctx }) {
  const tab = ctx.tab === 'reip' || ctx.tab === 'identity' ? ctx.tab : 'sites';
  const tabs = (
    <Tabs
      label="Mappings sections"
      value={tab}
      onChange={t => ctx.go(t === 'sites' ? 'mappings' : `mappings/${t}`)}
      tabs={[
        { v: 'sites', label: 'Networks, storage and sizes' },
        { v: 'reip', label: 'Re-IP and names', count: PROFILES.length, tip: 'Addresses, host names, DNS, domain and MAC after a failover or a cutover' },
        { v: 'identity', label: 'Identity at the recovery site' }
      ]}
      style={{ margin: '0 24px 12px', padding: 0 }}
    />
  );
  if (tab === 'sites') return <AegisMappings ctx={ctx} tabs={tabs} />;
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
      <div style={{ flex: 'none', padding: '20px 24px 16px' }}>
        <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: 4 }}>Infrastructure</div>
        <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Mappings</h1>
        <p style={{ marginTop: 2, color: 'var(--tx-2)' }}>{tab === 'reip' ? 'What a server’s address, name and domain become at the other site. Used by failovers and by migration cutovers.' : 'Who can sign in at each recovery site, kept apart from production so a compromise there does not reach the copies.'}</p>
      </div>
      {tabs}
      <div key={tab} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'ae-fade 150ms var(--ease)' }}>
        {tab === 'reip' ? <ReipView ctx={ctx} /> : <IdentityView ctx={ctx} />}
      </div>
    </div>
  );
}

function ReipView({ ctx }: { ctx: Ctx }) {
  const [profiles, setProfiles] = useState(PROFILES);
  const [sel, setSel] = useState('p1');
  const [checked, setChecked] = useState<string | null>(null);
  const add = useClosable<boolean>();
  const p = profiles.find(x => x.id === sel)!;
  const cfg = ctx.can('configure', 'Changing mappings');
  const servers = WORKLOADS.filter(w => w.ip && (p.id === 'p3' ? false : p.rules.some(r => inSubnet(w.ip!, r[0])) || p.pins.some(x => x[0] === w.name)));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <nav aria-label="Re-IP profiles" style={{ border: '1px solid var(--ln)', background: 'var(--panel)' }}>
        {profiles.map(x => (
          <button key={x.id} type="button" aria-current={x.id === sel ? 'page' : undefined} onClick={() => { setSel(x.id); setChecked(null); }} style={{ width: '100%', display: 'block', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--ln)', background: x.id === sel ? 'var(--acc-soft)' : 'transparent' }}>
            <span style={{ display: 'block', fontWeight: 600 }}>{x.name}</span>
            <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{x.used}</span>
          </button>
        ))}
      </nav>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <Panel
          title="Address rules"
          right={
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind="ghost" size="sm" icon="circle-check" onClick={() => { setChecked(p.id); ctx.toast(`${p.name}: no overlaps, gateways answer, no address in use at ${p.to}`, 'ok'); }}>Check rules</Btn>
              <Btn kind="outline" size="sm" icon="plus" perm={cfg} disabled={p.id === 'p3'} why="Test bubbles keep the same addresses." onClick={() => add.open(true)}>Add a rule…</Btn>
            </div>
          }
        >
          <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checked === p.id ? <Bar tone="ok">Checked {ctx.now().split(', ')[1]}: no overlapping subnets, every gateway answers, no new address is in use at {p.to} (Infoblox and ping).</Bar> : null}
            <MiniTable label="Address rules" cols={[{ label: 'From subnet', w: '150px' }, { label: 'To subnet', w: '150px' }, { label: 'Gateway', w: '120px' }, { label: 'Address' }]} rows={p.rules.map(r => [<code key="a" style={{ font: '12px var(--f-mono)' }}>{r[0]}</code>, <code key="b" style={{ font: '12px var(--f-mono)' }}>{r[1]}</code>, r[2], r[3]])} />
          </div>
        </Panel>
        <Panel title="Names, DNS, domain and hardware">
          <div style={{ padding: '4px 16px 12px' }}>
            <Facts labelW={150} items={[{ k: 'DNS servers', v: p.dns }, { k: 'Host name', v: p.hostname }, { k: 'DNS records', v: p.register }, { k: 'Domain', v: p.domain }, { k: 'MAC address', v: p.mac }, { k: 'Network / VLAN', v: p.vlan }]} />
          </div>
        </Panel>
        {p.id !== 'p3' ? (
          <Panel title="What each server becomes" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Preview; applied by the recovery plan or the cutover</span>}>
            <div style={{ padding: '4px 16px 12px' }}>
              <MiniTable
                label="Re-IP preview"
                cols={[{ label: 'Server', w: 'minmax(0,1fr)' }, { label: 'Now', w: '140px' }, { label: 'At ' + p.to, w: '170px' }, { label: 'Why', w: 'minmax(0,1fr)' }]}
                rows={servers.map(w => {
                  const [ip, why] = newIp(p, w.ip!, w.name);
                  const pin = p.pins.find(x => x[0] === w.name);
                  return [<strong key="n" style={{ fontWeight: 600 }}>{w.name}</strong>, <code key="o" style={{ font: '12px var(--f-mono)' }}>{w.ip}</code>, <code key="i" style={{ font: '12px var(--f-mono)' }}>{ip}</code>, why === 'Pinned' ? `Pinned: ${pin?.[2]}` : why === 'warn' ? <Status key="w" icon="triangle-alert" tone="warn" label="No rule matches" /> : 'Subnet rule'];
                })}
                empty="No server in this profile’s subnets has an address on record."
              />
            </div>
          </Panel>
        ) : (
          <Bar tone="info" multiline>Test failovers keep every address because the bubble has no route to production or the internet. Bubble DNS answers with the test copies’ addresses.</Bar>
        )}
      </div>
      {add.value ? (
        <RuleDialog
          closing={add.closing}
          onClose={add.close}
          onSave={r => {
            setProfiles(ps => ps.map(x => (x.id === p.id ? { ...x, rules: [...x.rules, r] } : x)));
            audit({ who: 'priya.raman', customer: 'h360', what: 'Added a re-IP rule', object: p.name, when: ctx.now(), r: 'ok', after: [['From', r[0]], ['To', r[1]], ['Gateway', r[2]]] });
            ctx.toast(`Rule ${r[0]} → ${r[1]} added to ${p.name}`, 'ok');
            add.close();
          }}
        />
      ) : null}
    </div>
  );
}

function RuleDialog({ closing, onClose, onSave }: { closing: boolean; onClose: () => void; onSave: (r: Rule) => void }) {
  const [from, setFrom] = useState('10.60.3.0/24');
  const [to, setTo] = useState('10.70.3.0/24');
  const [gw, setGw] = useState('10.70.3.1');
  const [how, setHow] = useState('Keep the last octet');
  const cidr = /^\d+\.\d+\.\d+\.\d+\/\d+$/;
  const err = !cidr.test(from) || !cidr.test(to) ? 'Write both subnets as a.b.c.d/nn.' : from.split('/')[1] !== to.split('/')[1] && how === 'Keep the last octet' ? 'Keeping the last octet needs subnets of the same size.' : null;
  return (
    <Dialog title="Add a re-IP rule" closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!!err} why={err || undefined} onClick={() => onSave([from, to, gw, how])}>Add rule</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="ri-f" label="From subnet" err={err && !cidr.test(from) ? err : null}><TextInput id="ri-f" value={from} onChange={setFrom} mono /></Field>
        <Field id="ri-t" label="To subnet"><TextInput id="ri-t" value={to} onChange={setTo} mono /></Field>
        <Field id="ri-g" label="Gateway"><TextInput id="ri-g" value={gw} onChange={setGw} mono /></Field>
        <Field id="ri-h" label="Address"><SelectInput id="ri-h" value={how} onChange={setHow} options={['Keep the last octet', 'Next free address from Infoblox', 'DHCP reservation']} /></Field>
      </div>
      {err && cidr.test(from) ? <Bar tone="warn">{err}</Bar> : null}
    </Dialog>
  );
}

const SITES: { site: string; where: string; idp: string; vault: string; admins: string; state: 'ok' | 'warn' }[] = [
  { site: 'region-2-os', where: 'Hyderabad', idp: 'DR.MERIDIAN.LOCAL and DR.HOST360.LOCAL: own forests, no trust from production', vault: 'Own vault cluster; unsealed by 3 of 5 DR custodians', admins: '4 DR-only admins; MFA from a second Entra tenant', state: 'ok' },
  { site: 'fra-openstack', where: 'Frankfurt', idp: 'Own Entra tenant (atlas-dr); no guest accounts from production', vault: 'Own vault namespace; keys in Azure Key Vault Germany', admins: '2 DR-only admins', state: 'ok' },
  { site: 'production-openstack', where: 'Chennai', idp: 'Shared with production: HOST360.LOCAL', vault: 'Shared production vault', admins: 'Production admins', state: 'warn' }
];
const CANARIES: [string, string][] = [
  ['A production domain admin signs in at region-2-os', 'Refused'],
  ['A production vault token reads a DR secret', 'Refused'],
  ['The DR controller uses a production service account', 'None found'],
  ['A production backup credential deletes a replica', 'Refused (separate credential and Object Lock)']
];

function IdentityView({ ctx }: { ctx: Ctx }) {
  const shared = SITES.filter(s => s.state === 'warn');
  return (
    <>
      <Tiles
        items={[
          { label: 'Recovery sites with their own identity', value: String(SITES.length - shared.length), unit: `of ${SITES.length}`, icon: 'fingerprint', tone: shared.length ? 'warn' : 'ok', sub: shared.length ? `${shared[0].site} shares production’s domain` : 'Every site' },
          { label: 'Cross-domain checks', value: `${CANARIES.length}`, unit: `of ${CANARIES.length} passed`, icon: 'circle-check', tone: 'ok', sub: 'Every 6 h' },
          { label: 'Break-glass at the DR site', value: '2', unit: 'sealed accounts', icon: 'key', sub: 'Last opened 28 Sep (drill), resealed' }
        ]}
      />
      <Bar tone="info" multiline>Ransomware usually arrives with stolen administrator credentials. When the recovery site has its own directory, vault and administrators, those credentials do not work there, so the replicas and the failover stay out of reach.</Bar>
      <Panel title="Identity at each recovery site">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable
            label="Identity by recovery site"
            cols={[{ label: 'Recovery site', w: '170px' }, { label: 'Directory', w: 'minmax(0,1.3fr)' }, { label: 'Secrets', w: 'minmax(0,1fr)' }, { label: 'Administrators', w: 'minmax(0,1fr)' }, { label: 'State', w: '140px' }]}
            rows={SITES.map(s => [
              <strong key="s" style={{ fontWeight: 600 }} data-tip={s.where}>{s.site}</strong>,
              <span key="i" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={s.idp} data-tip-overflow="">{s.idp}</span>,
              <span key="v" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={s.vault} data-tip-overflow="">{s.vault}</span>,
              <span key="a" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={s.admins} data-tip-overflow="">{s.admins}</span>,
              s.state === 'ok' ? <Status key="t" icon="circle-check" tone="ok" label="Separate" /> : <Status key="t" icon="triangle-alert" tone="warn" label="Shared" tip="Same directory and vault as production" />
            ])}
          />
          {shared.length ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span style={{ flex: 1, font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{shared[0].site} is in the same data centre as production and uses its directory. Plans that fail over to it are marked in their readiness score.</span>
              <Btn kind="outline" size="sm" icon="fingerprint" perm={ctx.can('admin', 'Changing identity at a recovery site')} onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Requested a separate identity domain', object: shared[0].site, when: ctx.now(), r: 'ok' }); ctx.toast(`Change request opened to give ${shared[0].site} its own directory and vault`, 'ok'); }}>Request separation…</Btn>
            </div>
          ) : null}
        </div>
      </Panel>
      <Panel title="Checks that production credentials stop at the recovery site">
        <div style={{ padding: '4px 16px 12px' }}>
          <MiniTable label="Cross-domain checks" cols={[{ label: 'Attempt' }, { label: 'Result', w: '320px' }]} rows={CANARIES.map(([a, r]) => [a, <Status key="r" icon="circle-check" tone="ok" label={r} />])} />
        </div>
      </Panel>
    </>
  );
}
