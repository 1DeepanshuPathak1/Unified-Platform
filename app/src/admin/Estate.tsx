import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { DCS, HARDWARE, MANAGED, type Hardware, type ManagedAccount } from '../data/internal';
import { Btn, Field, FilterInput, RadioCard, SelectFilter, SelectInput, Tabs, TextInput } from '../ui/controls';
import { Activity, Bar, DrawerTiles, Facts, Page, PageHeader, Spacer, Status, TableArea, Tiles, Toolbar } from '../ui/layout';
import { DangerDialog, Dialog, Drawer, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName } from '../platform/common';
import { audit, useStore } from '../platform/store';

const HEALTH: Record<ManagedAccount['health'], [string, string, string]> = { ok: ['circle-check', 'On track', 'ok'], warn: ['triangle-alert', 'Needs attention', 'warn'], err: ['circle-x', 'At risk', 'err'] };
const LEADS = ['arun.kumar', 'deepa.s', 'meera.iyer', 'karthik.s'];

/** 6.2 Managed accounts: customers whose backup and DR Host360 operates for them. */
export function ManagedSection({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [list, setList] = useState<ManagedAccount[]>(MANAGED);
  const drawer = useClosable<string>();
  const report = useClosable<string>();
  const reassign = useClosable<string>();
  const add = useClosable<boolean>();
  useEffect(() => {
    if (ctx.openId && list.some(m => m.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = drawer.value ? list.find(m => m.id === drawer.value) : null;
  const unmanaged = s.customers.filter(c => c.kind !== 'Internal' && !list.some(m => m.customer === c.id));
  return (
    <Page>
      <PageHeader
        kicker="Customers"
        title="Managed accounts"
        sub="Customers whose backup and DR Host360 runs for them: the service, the SLA, who looks after it and when it is next reviewed."
        actions={<Btn kind="primary" icon="plus" disabled={!unmanaged.length} why="Every customer already has a managed service." onClick={() => add.open(true)}>Add a managed account</Btn>}
      />
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Managed accounts', value: `${list.length}`, icon: 'headset', sub: `${list.filter(m => m.service === 'Fully managed backup').length} fully managed · ${list.filter(m => m.service.startsWith('Co-')).length} co-managed` },
            { label: 'Open requests', value: `${list.reduce((a, m) => a + m.openRequests, 0)}`, icon: 'ticket', sub: 'Raised by managed customers' },
            { label: 'Need attention', value: `${list.filter(m => m.health !== 'ok').length}`, icon: 'triangle-alert', tone: list.some(m => m.health !== 'ok') ? 'warn' : 'ok', sub: list.filter(m => m.health !== 'ok').map(m => custName(m.customer)).join(', ') || 'All on track' },
            { label: 'Next review', value: '04 Nov', icon: 'calendar', sub: 'Meridian Cooperative Bank, monthly' }
          ]}
        />
      </div>
      <TableArea>
        <AegisTable
          label="Managed accounts"
          cols={[
            { k: 'c', label: 'Customer', w: 'minmax(180px,1.3fr)' },
            { k: 'svc', label: 'Service', w: 'minmax(190px,1.4fr)' },
            { k: 'sla', label: 'SLA', w: 'minmax(200px,1.6fr)', dim: true },
            { k: 'mgr', label: 'Account manager', w: 'minmax(150px,1fr)' },
            { k: 'lead', label: 'Ops lead', w: '110px' },
            { k: 'rep', label: 'Last report', w: '110px', r: true },
            { k: 'req', label: 'Requests', w: '90px', r: true },
            { k: 'h', label: 'Health', w: '150px' }
          ]}
          rows={list.map(m => ({
            id: m.id,
            c: { v: custName(m.customer), strong: true },
            svc: m.service,
            sla: { v: m.sla, tip: m.sla },
            mgr: m.manager,
            lead: m.lead,
            rep: m.lastReport,
            req: { v: String(m.openRequests), s: m.openRequests },
            h: { t: 'status', i: HEALTH[m.health][0], l: HEALTH[m.health][1], c: HEALTH[m.health][2], tip: m.note || HEALTH[m.health][1], s: ['ok', 'warn', 'err'].indexOf(m.health) }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['managed account', 'managed accounts']}
          emptyText="No managed accounts. Customers who run Aegis themselves are not listed here."
          sort="h"
          dir={-1}
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Managed account"
          kicker={`Managed account · ${d.service}`}
          title={custName(d.customer)}
          status={<><Status icon={HEALTH[d.health][0]} tone={HEALTH[d.health][2]} label={HEALTH[d.health][1]} /><span>Reviewed {d.review.toLowerCase()}</span></>}
          actions={
            <>
              <Btn kind="outline" icon="send" onClick={() => report.open(d.id)}>Send the service report…</Btn>
              <Btn kind="outline" icon="user-check" onClick={() => reassign.open(d.id)}>Reassign…</Btn>
              <Spacer />
              <Btn kind="ghost" icon="external-link" onClick={() => ctx.go('admin/tenants', d.customer)}>Tenant</Btn>
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {d.note ? <Bar tone={d.health === 'err' ? 'err' : 'warn'} multiline>{d.note}</Bar> : null}
            <DrawerTiles items={[{ label: 'Open requests', value: String(d.openRequests), sub: 'From the customer' }, { label: 'Last report', value: d.lastReport.slice(0, 6), sub: d.lastReport }, { label: 'Ops lead', value: d.lead, sub: d.manager }]} />
            <Facts items={[{ k: 'Service', v: d.service }, { k: 'SLA', v: d.sla }, { k: 'Review', v: d.review }, { k: 'Account manager', v: d.manager }, { k: 'Ops lead', v: d.lead }, { k: 'Escalation', v: 'Ops lead, then Head of cloud operations (priya.raman), then the account manager' }]} />
            <div>
              <div style={{ font: '600 13px/18px var(--f-ui)', marginBottom: 8 }}>What Host360 runs</div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {d.scope.map(x => <li key={x} style={{ display: 'flex', gap: 8 }}><Icon name="check" style={{ color: 'var(--ok)', marginTop: 2 }} />{x}</li>)}
              </ul>
            </div>
            <Activity items={[{ icon: 'send', text: `Service report for September sent to ${custName(d.customer)}`, when: `${d.lastReport}, 10:00 IST` }, { icon: 'calendar', text: `Service review held (${d.review.toLowerCase()})`, when: `${d.lastReport}, 15:00 IST` }]} />
          </div>
        </Drawer>
      ) : null}
      {report.value ? (
        <ReportDialog ctx={ctx} m={list.find(m => m.id === report.value)!} closing={report.closing} onClose={report.close} onSent={() => setList(x => x.map(m => (m.id === report.value ? { ...m, lastReport: ctx.now().slice(0, 11) } : m)))} />
      ) : null}
      {reassign.value ? <ReassignDialog ctx={ctx} m={list.find(m => m.id === reassign.value)!} closing={reassign.closing} onClose={reassign.close} onSave={lead => { setList(x => x.map(m => (m.id === reassign.value ? { ...m, lead } : m))); reassign.close(); }} /> : null}
      {add.value ? <AddManagedDialog ctx={ctx} options={unmanaged.map(c => ({ v: c.id, label: c.name }))} closing={add.closing} onClose={add.close} onAdd={m => { setList(x => [...x, m]); add.close(); drawer.open(m.id); }} /> : null}
    </Page>
  );
}

function ReportDialog({ ctx, m, closing, onClose, onSent }: { ctx: Ctx; m: ManagedAccount; closing: boolean; onClose: () => void; onSent: () => void }) {
  const s = useStore();
  const c = s.customers.find(x => x.id === m.customer)!;
  const [period, setPeriod] = useState('October 2026 to date');
  return (
    <Dialog
      title={`Service report for ${c.name}`}
      sub="From the Monthly service review template, in the customer’s brand."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="send" onClick={() => { audit({ who: 'priya.raman', customer: m.customer, what: 'Sent the managed service report', object: period, when: ctx.now(), r: 'ok' }); ctx.toast(`Service report sent to ${c.owner}`, 'ok'); onSent(); onClose(); }}>Send</Btn></>}
    >
      <Field id="rp-p" label="Period"><SelectInput id="rp-p" value={period} onChange={setPeriod} options={['October 2026 to date', 'September 2026', 'Q3 2026 (Jul to Sep)']} /></Field>
      <Facts items={[{ k: 'To', v: `${c.owner} · ${c.ownerEmail}` }, { k: 'Branding', v: c.whiteLabel ? `${c.whiteLabel}; no Host360 name or logo` : 'Host360' }, { k: 'Contains', v: 'Protection success, RPO compliance, restores, DR tests, open requests and next month’s changes' }]} />
    </Dialog>
  );
}

function ReassignDialog({ ctx, m, closing, onClose, onSave }: { ctx: Ctx; m: ManagedAccount; closing: boolean; onClose: () => void; onSave: (lead: string) => void }) {
  const [lead, setLead] = useState(m.lead);
  return (
    <Dialog
      title={`Ops lead for ${custName(m.customer)}`}
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={lead === m.lead} why="Choose someone else." onClick={() => { audit({ who: 'priya.raman', customer: m.customer, what: 'Reassigned the ops lead', object: custName(m.customer), when: ctx.now(), r: 'ok', before: [['Ops lead', m.lead]], after: [['Ops lead', lead]] }); ctx.toast(`${lead} now leads ${custName(m.customer)}; open requests move with them`, 'ok'); onSave(lead); }}>Save</Btn></>}
    >
      <Field id="ra-l" label="Ops lead" hint="Gets the customer’s alerts and requests from now on."><SelectInput id="ra-l" value={lead} onChange={setLead} options={LEADS} /></Field>
    </Dialog>
  );
}

function AddManagedDialog({ ctx, options, closing, onClose, onAdd }: { ctx: Ctx; options: { v: string; label: string }[]; closing: boolean; onClose: () => void; onAdd: (m: ManagedAccount) => void }) {
  const [cust, setCust] = useState(options[0]?.v || '');
  const [svc, setSvc] = useState<ManagedAccount['service']>('Fully managed backup');
  const [lead, setLead] = useState(LEADS[1]);
  return (
    <Dialog
      title="Add a managed account"
      sub="Host360 takes over day-to-day operation. The customer keeps read access and approves restores of sensitive data."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!cust} why="Choose a customer." onClick={() => { const m: ManagedAccount = { id: 'ma-' + cust, customer: cust, service: svc, sla: svc === 'Managed DR runbook service' ? 'Restore starts within 30 min · failover decision support 24×7' : 'Restore starts within 2 h, business hours', manager: 'Lakshmi Narayanan', lead, review: 'Quarterly', lastReport: 'Not yet', openRequests: 0, health: 'ok', scope: ['Backup of every protected workload', 'Monthly restore test'] }; audit({ who: 'priya.raman', customer: cust, what: 'Started a managed service', object: svc, when: ctx.now(), r: 'ok' }); ctx.toast(`${custName(cust)} is now a managed account`, 'ok'); onAdd(m); }}>Add</Btn></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="am-c" label="Customer"><SelectInput id="am-c" value={cust} onChange={setCust} options={options} /></Field>
        <Field id="am-l" label="Ops lead"><SelectInput id="am-l" value={lead} onChange={setLead} options={LEADS} /></Field>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(['Fully managed backup', 'Managed DR runbook service', 'Co-managed (customer operates)'] as ManagedAccount['service'][]).map(x => (
          <RadioCard key={x} on={svc === x} onClick={() => setSvc(x)} title={x} note={x === 'Fully managed backup' ? 'Host360 runs backups, restores and restore tests' : x === 'Managed DR runbook service' ? 'Adds recovery plans, drills and failover support 24×7' : 'The customer operates; Host360 is second line'} />
        ))}
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Hardware and sites */

const HW_ST: Record<Hardware['state'], [string, string]> = { 'In service': ['circle-check', 'ok'], Provisioning: ['loader-circle', 'run'], Fault: ['circle-x', 'err'], Retiring: ['archive', 'tx'] };
const KIND_ICON: Record<Hardware['kind'], string> = { 'Backup appliance': 'archive', 'Storage node': 'hard-drive', 'Proxy server': 'server', 'Object storage node': 'database', 'Top-of-rack switch': 'network' };

/** 6.2 Infrastructure: hardware deployed in Host360 data centres and at customer sites. */
export function HardwareSection({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<'hardware' | 'sites'>(ctx.tab === 'sites' ? 'sites' : 'hardware');
  const [list, setList] = useState<Hardware[]>(HARDWARE);
  const [site, setSite] = useState('All sites');
  const [q, setQ] = useState('');
  const drawer = useClosable<string>();
  const add = useClosable<boolean>();
  const retire = useClosable<string>();
  useEffect(() => {
    if (ctx.openId && list.some(h => h.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const ql = q.trim().toLowerCase();
  const rows = list.filter(h => (site === 'All sites' || h.site === site) && (!ql || `${h.model} ${h.serial} ${h.kind} ${h.tenant} ${h.rack}`.toLowerCase().includes(ql)));
  const d = drawer.value ? list.find(h => h.id === drawer.value) : null;
  const ending = list.filter(h => h.warrantyDays <= 90 && h.state !== 'Retiring');
  return (
    <Page>
      <PageHeader
        kicker="Estate"
        title="Hardware and sites"
        sub="Appliances, storage, proxies and switches Host360 has deployed, where they sit, who they serve and when their warranty ends."
        actions={<Btn kind="primary" icon="plus" onClick={() => add.open(true)}>Add hardware</Btn>}
      />
      <Tabs label="Hardware and sites" value={tab} onChange={t => { setTab(t); ctx.go(`admin/hardware/${t}`); }} style={{ margin: '0 24px 12px', padding: 0 }} tabs={[{ v: 'hardware', label: 'Hardware', count: list.length }, { v: 'sites', label: 'Sites', count: DCS.length }]} />
      {tab === 'hardware' ? (
        <>
          <div style={{ padding: '0 24px 12px' }}>
            <Tiles
              items={[
                { label: 'In service', value: `${list.filter(h => h.state === 'In service').length}`, icon: 'circle-check', tone: 'ok', sub: `${list.filter(h => h.state === 'Provisioning').length} provisioning · ${list.filter(h => h.state === 'Retiring').length} retiring` },
                { label: 'Faults', value: `${list.filter(h => h.state === 'Fault').length}`, icon: 'circle-x', tone: list.some(h => h.state === 'Fault') ? 'err' : undefined, sub: list.filter(h => h.state === 'Fault').map(h => h.serial).join(', ') || 'None' },
                { label: 'Warranty ending', value: `${ending.length}`, icon: 'calendar-clock', tone: ending.length ? 'warn' : undefined, sub: 'Within 90 days' },
                { label: 'Raw capacity', value: '4.4', unit: 'PB', icon: 'database', sub: 'Backup appliances and object storage' }
              ]}
            />
          </div>
          <Toolbar>
            <SelectFilter label="Site" value={site} onChange={setSite} options={['All sites', ...DCS.map(x => x.name)]} />
            <FilterInput value={q} onChange={setQ} placeholder="Filter by model, serial, rack or tenant" label="Filter hardware" />
            <Spacer />
          </Toolbar>
          <TableArea>
            <AegisTable
              label="Hardware"
              cols={[
                { k: 'm', label: 'Device', w: 'minmax(200px,1.5fr)' },
                { k: 'k', label: 'Kind', w: '160px', dim: true },
                { k: 'site', label: 'Site', w: 'minmax(170px,1.3fr)' },
                { k: 'rack', label: 'Rack', w: '160px', dim: true },
                { k: 't', label: 'Serves', w: 'minmax(150px,1.2fr)' },
                { k: 'war', label: 'Warranty', w: '130px', r: true },
                { k: 'st', label: 'State', w: '130px' }
              ]}
              rows={rows.map(h => ({
                id: h.id,
                m: { v: h.model, strong: true, tip: `Serial ${h.serial}` },
                k: h.kind,
                site: h.site,
                rack: h.rack,
                t: h.tenant,
                war: h.warrantyDays < 0 ? { v: 'Ended', muted: true, s: h.warrantyDays } : { v: h.warrantyDays <= 90 ? `${h.warranty} · ${h.warrantyDays} d` : h.warranty, strong: h.warrantyDays <= 90, s: h.warrantyDays },
                st: { t: 'status', i: HW_ST[h.state][0], c: HW_ST[h.state][1], l: h.state, spin: h.state === 'Provisioning', tip: h.note || h.state }
              }))}
              onRow={(id: string) => drawer.open(id)}
              active={drawer.value}
              state={ctx.ui}
              unit={['device', 'devices']}
              filtered={site !== 'All sites' || !!ql}
              onClear={() => { setSite('All sites'); setQ(''); }}
              emptyText="No hardware recorded. Add the first appliance with Add hardware."
              sort="site"
            />
          </TableArea>
        </>
      ) : (
        <TableArea>
          <AegisTable
            label="Sites"
            cols={[{ k: 'n', label: 'Site', w: 'minmax(220px,1.6fr)' }, { k: 'k', label: 'Kind', w: '170px' }, { k: 'tier', label: 'Tier', w: '90px', dim: true }, { k: 'p', label: 'Power', w: 'minmax(150px,1fr)', dim: true }, { k: 'r', label: 'Racks', w: '80px', r: true }, { k: 'dev', label: 'Devices', w: '90px', r: true }, { k: 'c', label: 'Contact', w: 'minmax(170px,1.2fr)' }]}
            rows={DCS.map(x => ({ id: x.id, n: { v: x.name, strong: true, tip: x.region }, k: x.kind, tier: x.tier, p: x.power, r: String(x.racks), dev: { v: String(list.filter(h => h.site === x.name).length), s: list.filter(h => h.site === x.name).length }, c: x.contact }))}
            onRow={(id: string) => { setSite(DCS.find(x => x.id === id)!.name); setTab('hardware'); }}
            state={ctx.ui}
            unit={['site', 'sites']}
            emptyText="No sites yet."
          />
        </TableArea>
      )}
      {d ? (
        <Drawer
          label="Device"
          kicker={`${d.kind} · ${d.site}`}
          title={d.model}
          status={<><Status icon={HW_ST[d.state][0]} tone={HW_ST[d.state][1]} label={d.state} spin={d.state === 'Provisioning'} /><span>Serial {d.serial}</span></>}
          actions={
            <>
              {d.state === 'Fault' ? <Btn kind="outline" icon="check" onClick={() => { setList(x => x.map(h => (h.id === d.id ? { ...h, state: 'In service', note: undefined } : h))); audit({ who: 'priya.raman', customer: 'h360', what: 'Marked hardware repaired', object: `${d.model} ${d.serial}`, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.serial} back in service`, 'ok'); }}>Mark repaired</Btn> : null}
              <Btn kind="outline" icon="ticket" onClick={() => ctx.toast(`Vendor case opened for ${d.serial}; reference sent to the NOC`, 'ok')}>Open a vendor case</Btn>
              <Spacer />
              {d.state !== 'Retiring' ? <Btn kind="danger" icon="archive" onClick={() => retire.open(d.id)}>Retire…</Btn> : null}
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {d.note ? <Bar tone={d.state === 'Fault' ? 'err' : d.warrantyDays <= 90 ? 'warn' : 'info'} multiline>{d.note}</Bar> : null}
            <DrawerTiles items={[{ label: 'Kind', value: d.kind.split(' ')[0], icon: KIND_ICON[d.kind], sub: d.kind }, { label: 'Warranty', value: d.warrantyDays < 0 ? 'Ended' : `${d.warrantyDays} d`, sub: d.warranty }, { label: 'Serves', value: d.tenant.startsWith('Shared') ? 'Shared' : 'Dedicated', sub: d.tenant }]} />
            <Facts items={[{ k: 'Site', v: d.site }, { k: 'Rack', v: d.rack }, { k: 'Capacity', v: d.capacity }, { k: 'Firmware', v: d.firmware }, { k: 'Serial', v: d.serial }, { k: 'Monitored by', v: 'Redfish every 60 s; SNMP traps to the NOC' }]} />
          </div>
        </Drawer>
      ) : null}
      {retire.value ? (
        <DangerDialog
          title={`Retire ${list.find(h => h.id === retire.value)!.serial}`}
          intro="Take this device out of service for good. Exactly this happens:"
          removed={['The device stops taking new data at once', 'It is removed from monitoring after the wipe']}
          kept="Data on it is moved to another device in the same site before the wipe; nothing is deleted until the move is verified. A NIST 800-88 wipe certificate is filed against the serial."
          name={list.find(h => h.id === retire.value)!.serial}
          nameLabel="Type the serial number to confirm"
          action="Retire device"
          icon="archive"
          closing={retire.closing}
          onClose={retire.close}
          onConfirm={() => {
            const h = list.find(x => x.id === retire.value)!;
            setList(x => x.map(y => (y.id === h.id ? { ...y, state: 'Retiring', note: `Retired by priya.raman at ${ctx.now()}. Data move and NIST 800-88 wipe scheduled.` } : y)));
            audit({ who: 'priya.raman', customer: 'h360', what: 'Retired hardware', object: `${h.model} ${h.serial}`, when: ctx.now(), r: 'ok' });
            ctx.toast(`${h.serial} retiring; data move starts tonight`, 'warn');
            retire.close();
          }}
        />
      ) : null}
      {add.value ? <AddHardwareWizard ctx={ctx} taken={list} closing={add.closing} onClose={add.close} onAdd={h => { setList(x => [...x, h]); add.close(); setTab('hardware'); drawer.open(h.id); }} /> : null}
    </Page>
  );
}

const MODELS: Record<Hardware['kind'], string[]> = {
  'Backup appliance': ['Dell PowerEdge R760xd2', 'HPE Apollo 4200 Gen11'],
  'Storage node': ['Dell PowerStore 1200T', 'NetApp AFF C250'],
  'Proxy server': ['HPE ProLiant DL360 Gen11', 'Lenovo ThinkSystem SR630 V3'],
  'Object storage node': ['Supermicro SSG-640SP-E1CR90'],
  'Top-of-rack switch': ['Arista 7050CX3-32S']
};

function AddHardwareWizard({ ctx, taken, closing, onClose, onAdd }: { ctx: Ctx; taken: Hardware[]; closing: boolean; onClose: () => void; onAdd: (h: Hardware) => void }) {
  const [step, setStep] = useState(0);
  const [site, setSite] = useState(DCS[0].name);
  const [kind, setKind] = useState<Hardware['kind']>('Backup appliance');
  const [model, setModel] = useState(MODELS['Backup appliance'][0]);
  const [serial, setSerial] = useState('');
  const [rack, setRack] = useState('R16 · U20–U21');
  const [tenant, setTenant] = useState('Shared');
  const [bmc, setBmc] = useState('10.10.40.');
  const dup = taken.some(h => h.serial.toLowerCase() === serial.trim().toLowerCase());
  const rackTaken = taken.some(h => h.site === site && h.rack === rack);
  const bmcOk = /^10\.10\.40\.(\d{1,3})$/.test(bmc) && +bmc.split('.')[3] > 0 && +bmc.split('.')[3] < 255;
  const ok = [true, serial.trim().length >= 6 && !dup && !rackTaken, bmcOk, true][step];
  return (
    <Wizard
      title="Add hardware"
      sub="Registers the device, checks it against the rack plan and starts a 48-hour burn-in before it takes data."
      steps={['Device', 'Placement', 'Network', 'Review']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={
        <Btn kind="primary" iconAfter={step < 3 ? 'arrow-right' : undefined} icon={step === 3 ? 'check' : undefined} disabled={!ok} why={step === 1 ? (dup ? 'That serial is already registered.' : rackTaken ? 'That rack position is taken.' : 'Give the serial number.') : 'Give a free address in the BMC network 10.10.40.0/24.'} onClick={() => {
          if (step < 3) return setStep(step + 1);
          const h: Hardware = { id: 'hw' + Date.now(), site, kind, model, serial: serial.trim().toUpperCase(), rack, tenant, capacity: 'Read from Redfish after burn-in', firmware: 'Read from Redfish after burn-in', warranty: '21 Oct 2029', warrantyDays: 1096, state: 'Provisioning', note: `Burn-in started ${ctx.now()}; takes data after 48 hours if every test passes.` };
          audit({ who: 'priya.raman', customer: 'h360', what: 'Added hardware', object: `${model} ${h.serial}`, when: ctx.now(), r: 'ok', after: [['Site', site], ['Rack', rack]] });
          ctx.toast(`${h.serial} registered; burn-in started`, 'ok');
          onAdd(h);
        }}>
          {step < 3 ? 'Next' : 'Add and start burn-in'}
        </Btn>
      }
    >
      {step === 0 ? (
        <>
          <Field id="ah-s" label="Site"><SelectInput id="ah-s" value={site} onChange={setSite} options={DCS.map(x => x.name)} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field id="ah-k" label="Kind"><SelectInput id="ah-k" value={kind} onChange={k => { setKind(k as Hardware['kind']); setModel(MODELS[k as Hardware['kind']][0]); }} options={Object.keys(MODELS)} /></Field>
            <Field id="ah-m" label="Model"><SelectInput id="ah-m" value={model} onChange={setModel} options={MODELS[kind]} /></Field>
          </div>
        </>
      ) : null}
      {step === 1 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field id="ah-sn" label="Serial number" err={dup ? 'Already registered.' : null}><TextInput id="ah-sn" value={serial} onChange={setSerial} mono placeholder="CN7R760-4H2K9R1" invalid={dup} autoFocus /></Field>
          <Field id="ah-r" label="Rack position" err={rackTaken ? `Taken at ${site}.` : null}><SelectInput id="ah-r" value={rack} onChange={setRack} options={['R16 · U20–U21', 'R16 · U22–U23', 'R14 · U22–U23', 'R15 · U18–U21']} /></Field>
          <Field id="ah-t" label="Serves" span={2}><SelectInput id="ah-t" value={tenant} onChange={setTenant} options={['Shared', 'Meridian Cooperative Bank (dedicated)', 'Atlas Freight GmbH (dedicated)', 'Kaveri Logistics Pvt Ltd (dedicated)']} /></Field>
        </div>
      ) : null}
      {step === 2 ? (
        <>
          <Field id="ah-b" label="BMC address" hint="Out-of-band management network 10.10.40.0/24" err={bmc.length > 9 && !bmcOk ? 'Not an address in 10.10.40.0/24.' : null}><TextInput id="ah-b" value={bmc} onChange={setBmc} mono invalid={bmc.length > 9 && !bmcOk} /></Field>
          <Facts items={[{ k: 'Data network', v: 'VLAN 210, 2 × 25 GbE bonded (LACP)' }, { k: 'Replication network', v: 'VLAN 220, jumbo frames' }, { k: 'Credentials', v: 'Rotated into the credential vault on first contact' }]} />
        </>
      ) : null}
      {step === 3 ? (
        <Facts items={[{ k: 'Device', v: `${model} · ${serial.trim().toUpperCase()}` }, { k: 'Site', v: `${site} · ${rack}` }, { k: 'Serves', v: tenant }, { k: 'BMC', v: bmc }, { k: 'Burn-in', v: 'Memory, disks and network for 48 hours; it joins the pool only if every test passes' }]} />
      ) : null}
    </Wizard>
  );
}

