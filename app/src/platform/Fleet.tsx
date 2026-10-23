import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { CUSTOMERS } from '../data/platform';
import { Btn, Field, SelectInput, Seg, Toggle } from '../ui/controls';
import { Bar, DrawerTiles, Facts, MiniTable, Panel, Spacer, TableArea, Tiles, Toolbar } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope } from './common';
import { audit } from './store';

/** Last 24 h per customer, as the provider's NOC sees it. */
const FLEET: Record<string, { runs: number; failed: number; rpo: number; failingNow: string[]; repo: [string, number]; behind: number; tickets: number; dr: string; mig: string }> = {
  h360: { runs: 412, failed: 6, rpo: 97, failingNow: ['file-srv-03: E-BKP-2107 change tracking reset', 'erp-db-01: E-BKP-1204 slow source, finished late'], repo: ['obj-check', 71], behind: 2, tickets: 2, dr: '—', mig: '—' },
  mer: { runs: 528, failed: 3, rpo: 99, failingNow: ['SQL01: E-BKP-3302 VSS writer timeout'], repo: ['mer-obj-immutable', 88], behind: 6, tickets: 2, dr: '23 of 23 replicating · CBS RPO 4 min', mig: 'Wave 2 test cutover today' },
  kav: { runs: 96, failed: 0, rpo: 100, failingNow: [], repo: ['kav-repo-01', 54], behind: 0, tickets: 0, dr: '2 of 2 replicating', mig: '—' },
  sah: { runs: 132, failed: 4, rpo: 92, failingNow: ['his-pacs-01: E-REP-0410 repository unreachable from Pune proxy', 'his-db-01: missed 02:00 (proxy busy)'], repo: ['sah-s3-mumbai', 63], behind: 0, tickets: 1, dr: '—', mig: '—' },
  atl: { runs: 48, failed: 0, rpo: 100, failingNow: [], repo: ['atl-blob-frankfurt', 41], behind: 1, tickets: 0, dr: '—', mig: '—' },
  nil: { runs: 36, failed: 2, rpo: 83, failingNow: ['nil-pos-db: E-AGT-0102 agent offline 26 h'], repo: ['nil-poc-repo', 22], behind: 0, tickets: 1, dr: '—', mig: '—' },
  cor: { runs: 0, failed: 0, rpo: 100, failingNow: [], repo: ['—', 0], behind: 0, tickets: 0, dr: '—', mig: 'Assessment only' }
};
const REPOS: [string, string, number, string, string, string][] = [
  ['mer-obj-immutable', 'Host360 Mumbai · S3 Object Lock', 88, '+142 GB/day', '19 days', 'Compliance, 30 d'],
  ['obj-check', 'Host360 Chennai · S3-compatible', 71, '+36 GB/day', '74 days', 'Governance, 14 d'],
  ['sah-s3-mumbai', 'Amazon S3 ap-south-1', 63, '+21 GB/day', 'No limit (cloud)', 'Compliance, 90 d'],
  ['kav-repo-01', 'Host360 Chennai · hardened Linux', 54, '+9 GB/day', '142 days', 'Hardened'],
  ['atl-blob-frankfurt', 'Azure Blob, Germany West Central', 41, '+4 GB/day', 'No limit (cloud)', 'Time-based retention, 30 d'],
  ['nil-poc-repo', 'Host360 Chennai · filesystem', 22, '+1 GB/day', '>1 year', 'Off']
];

const health = (id: string) => {
  const f = FLEET[id];
  if (!f || !f.runs) return { i: 'circle-minus', c: 'tx', l: 'Nothing to back up' };
  if (f.rpo < 90 || f.failingNow.length > 1) return { i: 'circle-x', c: 'err', l: 'SLA at risk' };
  if (f.failingNow.length || f.repo[1] >= 85) return { i: 'triangle-alert', c: 'warn', l: 'Needs attention' };
  return { i: 'circle-check', c: 'ok', l: 'Healthy' };
};

/** Alerts & Activity › Fleet: every customer's backups, replication, repositories and agents on one screen (provider only). */
export function FleetTab({ ctx }: { ctx: Ctx }) {
  const [show, setShow] = useState<'all' | 'attention' | 'repos'>('all');
  const drawer = useClosable<string>();
  const custs = CUSTOMERS.filter(c => c.status !== 'archived' && FLEET[c.id]);
  const rows = custs.filter(c => show === 'all' || health(c.id).c !== 'ok');
  const runs = custs.reduce((a, c) => a + FLEET[c.id].runs, 0);
  const failed = custs.reduce((a, c) => a + FLEET[c.id].failed, 0);
  const atRisk = custs.filter(c => health(c.id).c === 'err').length;
  const d = drawer.value ? custs.find(c => c.id === drawer.value) : null;
  const f = d ? FLEET[d.id] : null;
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Backup runs, 24 h', value: runs.toLocaleString('en-IN'), icon: 'activity', sub: `${(((runs - failed) / runs) * 100).toFixed(1)} % succeeded · ${failed} failed` },
            { label: 'Customers with SLA at risk', value: String(atRisk), unit: `of ${custs.length}`, icon: 'circle-x', tone: atRisk ? 'err' : 'ok', sub: 'RPO met below 90 % or more than one workload failing' },
            { label: 'Repositories above 85 %', value: String(REPOS.filter(r => r[2] >= 85).length), unit: `of ${REPOS.length}`, icon: 'database', tone: REPOS.some(r => r[2] >= 85) ? 'warn' : 'ok', sub: 'mer-obj-immutable full in 19 days' },
            { label: 'Open tickets', value: String(custs.reduce((a, c) => a + FLEET[c.id].tickets, 0)), icon: 'ticket', sub: 'Raised automatically, one per problem' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={show} onChange={setShow} options={[{ v: 'all', label: 'Every customer', count: custs.length }, { v: 'attention', label: 'Needs attention', count: custs.filter(c => health(c.id).c !== 'ok').length }, { v: 'repos', label: 'Repositories', count: REPOS.length }]} />
        <Spacer />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Refreshed 16:05 IST · every 5 min</span>
      </Toolbar>
      {show === 'repos' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
          <Panel title="Repositories across the fleet" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Fill forecast from the last 30 days</span>}>
            <div style={{ padding: '4px 16px 12px' }}>
              <MiniTable
                label="Fleet repositories"
                cols={[{ label: 'Repository', w: '170px' }, { label: 'Where', w: 'minmax(0,1fr)' }, { label: 'Used', w: '70px', r: true }, { label: 'Growth', w: '110px' }, { label: 'Full in', w: '130px' }, { label: 'Immutability', w: '190px' }]}
                rows={REPOS.map(([n, w, u, g, full, lock]) => [<strong key="n" style={{ fontWeight: 600 }}>{n}</strong>, w, <span key="u" style={{ color: u >= 85 ? 'var(--warn)' : undefined }}>{u} %</span>, g, full, lock])}
              />
            </div>
          </Panel>
        </div>
      ) : (
      <TableArea>
        <AegisTable
          label="Fleet"
          cols={[
            { k: 'n', label: 'Customer', w: 'minmax(180px,1.4fr)' },
            { k: 'r', label: 'Runs, 24 h', w: '110px', r: true },
            { k: 'f', label: 'Failing now', w: '110px', r: true },
            { k: 'rpo', label: 'RPO met', w: '100px', r: true },
            { k: 'repo', label: 'Fullest repository', w: 'minmax(180px,1.2fr)' },
            { k: 'ag', label: 'Agents behind', w: '120px', r: true },
            { k: 't', label: 'Tickets', w: '80px', r: true },
            { k: 's', label: 'Health', w: '160px' }
          ]}
          rows={rows.map(c => {
            const x = FLEET[c.id];
            const h = health(c.id);
            return {
              id: c.id,
              n: { v: c.name, strong: true },
              r: { v: x.runs.toLocaleString('en-IN'), s: x.runs },
              f: { v: String(x.failingNow.length), s: x.failingNow.length, muted: !x.failingNow.length },
              rpo: { v: x.runs ? `${x.rpo} %` : '—', s: x.rpo },
              repo: x.repo[1] ? { v: `${x.repo[0]} · ${x.repo[1]} %`, s: x.repo[1] } : { v: '—', muted: true, s: 0 },
              ag: { v: String(x.behind), s: x.behind, muted: !x.behind },
              t: { v: String(x.tickets), s: x.tickets, muted: !x.tickets },
              s: { t: 'status', i: h.i, c: h.c, l: h.l, s: h.c }
            };
          })}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['customer', 'customers']}
          filtered={show === 'attention'}
          onClear={() => setShow('all')}
          emptyText="Every customer is healthy."
          sort="s"
          footR="Partners see the same view for their own customers"
        />
      </TableArea>
      )}
      {d && f ? (
        <Drawer
          label="Customer health"
          kicker={`Fleet · ${d.kind}`}
          title={d.name}
          status={<><span>{d.plan}</span><span>{d.products.join(', ')}</span></>}
          actions={<><Btn kind="outline" icon="arrow-right" onClick={() => ctx.go('customers', d.id)}>Open customer</Btn><Btn kind="ghost" icon="ticket" onClick={() => ctx.go('activity/tickets')}>Tickets</Btn></>}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DrawerTiles items={[{ label: 'Runs, 24 h', value: f.runs.toLocaleString('en-IN'), sub: `${f.failed} failed` }, { label: 'RPO met', value: f.runs ? `${f.rpo} %` : '—' }, { label: 'Fullest repository', value: f.repo[1] ? `${f.repo[1]} %` : '—', sub: f.repo[0] }]} />
            {f.failingNow.length ? (
              <MiniTable label="Failing now" cols={[{ label: 'Workload and error' }]} rows={f.failingNow.map(x => [<span key="x" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={x} data-tip-overflow="">{x}</span>])} />
            ) : (
              <Bar tone="ok">Nothing failing.</Bar>
            )}
            <Facts items={[{ k: 'Resilience', v: f.dr }, { k: 'Mobility', v: f.mig }, { k: 'Agents behind', v: String(f.behind) }, { k: 'Readiness', v: `${d.readiness} %` }, { k: 'Owner', v: `${d.owner} · ${d.ownerEmail}` }]} />
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

interface Ticket { id: string; psa: string; customer: string; subject: string; code: string; n: number; first: string; last: string; state: 'Open' | 'Closed by Aegis' | 'Waiting on customer' }
const TICKETS: Ticket[] = [
  { id: 'CW-48213', psa: 'ConnectWise Manage', customer: 'mer', subject: 'Backup failing: SQL01 (VSS writer timeout)', code: 'E-BKP-3302', n: 4, first: '20 Oct, 23:00', last: '21 Oct, 15:00', state: 'Open' },
  { id: 'CW-48201', psa: 'ConnectWise Manage', customer: 'mer', subject: 'Repository mer-obj-immutable above 85 %', code: 'E-REP-0901', n: 1, first: '21 Oct, 06:00', last: '21 Oct, 06:00', state: 'Open' },
  { id: 'INC0091432', psa: 'ServiceNow', customer: 'h360', subject: 'Backup failing: file-srv-03 (change tracking reset)', code: 'E-BKP-2107', n: 2, first: '20 Oct, 02:00', last: '21 Oct, 02:00', state: 'Open' },
  { id: 'INC0091417', psa: 'ServiceNow', customer: 'h360', subject: 'Backup late: erp-db-01 (slow source)', code: 'E-BKP-1204', n: 3, first: '19 Oct, 17:00', last: '21 Oct, 17:00', state: 'Open' },
  { id: 'CW-48190', psa: 'ConnectWise Manage', customer: 'sah', subject: 'Repository unreachable from the Pune proxy', code: 'E-REP-0410', n: 7, first: '21 Oct, 02:00', last: '21 Oct, 14:00', state: 'Open' },
  { id: 'CW-48177', psa: 'ConnectWise Manage', customer: 'nil', subject: 'Agent offline: nil-pos-db', code: 'E-AGT-0102', n: 1, first: '20 Oct, 14:10', last: '20 Oct, 14:10', state: 'Waiting on customer' },
  { id: 'CW-48102', psa: 'ConnectWise Manage', customer: 'kav', subject: 'Backup failing: kav-wms-db (credential expired)', code: 'E-BKP-0611', n: 3, first: '17 Oct, 23:00', last: '18 Oct, 23:00', state: 'Closed by Aegis' }
];

/** Alerts & Activity › Tickets: tickets Aegis raises in the PSA, one per problem, closed when the problem goes away. */
export function TicketsTab({ ctx }: { ctx: Ctx }) {
  const [show, setShow] = useState<'open' | 'all'>('open');
  const rules = useClosable<boolean>();
  const [cfg, setCfg] = useState({ sev: 'Error and above', key: 'Customer + workload + error code', close: true, reopen: '7 days', prio: true });
  const all = TICKETS.filter(t => inScope(ctx, t.customer));
  const rows = all.filter(t => show === 'all' || t.state !== 'Closed by Aegis');
  const saved = all.reduce((a, t) => a + t.n - 1, 0);
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Open tickets', value: String(all.filter(t => t.state !== 'Closed by Aegis').length), icon: 'ticket', sub: 'In ConnectWise Manage and ServiceNow' },
            { label: 'Duplicates folded in', value: String(saved), icon: 'layers', tone: 'ok', sub: 'Repeats added to the open ticket, not new tickets' },
            { label: 'Closed by Aegis, 7 days', value: String(all.filter(t => t.state === 'Closed by Aegis').length), icon: 'circle-check', tone: 'ok', sub: 'Closed when the next run succeeded' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={show} onChange={setShow} options={[{ v: 'open', label: 'Open', count: all.filter(t => t.state !== 'Closed by Aegis').length }, { v: 'all', label: 'All', count: all.length }]} />
        <Spacer />
        <Btn kind="outline" icon="settings-2" perm={ctx.can('admin', 'Changing ticket rules')} onClick={() => rules.open(true)}>Ticket rules…</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Tickets"
          cols={[
            { k: 'id', label: 'Ticket', w: '120px' },
            { k: 'c', label: 'Customer', w: 'minmax(140px,1fr)', dim: true },
            { k: 'sub', label: 'Subject', w: 'minmax(240px,2fr)' },
            { k: 'code', label: 'Error', w: '110px', dim: true },
            { k: 'n', label: 'Occurrences', w: '110px', r: true },
            { k: 'last', label: 'Last seen', w: '130px' },
            { k: 's', label: 'State', w: '200px' }
          ]}
          rows={rows.map(t => ({
            id: t.id,
            c: custName(t.customer),
            sub: { v: t.subject, strong: true, tip: `${t.psa} · first seen ${t.first}` },
            code: t.code,
            n: { v: String(t.n), s: t.n, tip: t.n > 1 ? `${t.n - 1} repeats added as notes` : undefined },
            last: t.last,
            s: t.state === 'Open' ? { t: 'status', i: 'circle-dot', c: 'run', l: 'Open' } : t.state === 'Closed by Aegis' ? { t: 'status', i: 'circle-check', c: 'ok', l: 'Closed by Aegis' } : { t: 'status', i: 'hourglass', c: 'warn', l: 'Waiting on customer' }
          }))}
          onRow={(id: string) => ctx.toast(`${id} opens in ${TICKETS.find(t => t.id === id)?.psa}`, 'info')}
          state={ctx.ui}
          unit={['ticket', 'tickets']}
          filtered={show !== 'all'}
          onClear={() => setShow('all')}
          emptyText="No open tickets."
          footR={`${cfg.key} · ${cfg.close ? 'closes itself' : 'closed by hand'}`}
        />
      </TableArea>
      {rules.value ? (
        <Dialog
          title="Ticket rules"
          sub="How Aegis raises, folds and closes tickets in your PSA or ITSM."
          closing={rules.closing}
          onClose={rules.close}
          footer={<><Btn kind="ghost" onClick={rules.close}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Changed ticket rules', object: 'PSA tickets', when: ctx.now(), r: 'ok', after: [['Raise for', cfg.sev], ['One ticket per', cfg.key]] }); ctx.toast('Ticket rules saved', 'ok'); rules.close(); }}>Save</Btn></>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field id="tk-s" label="Raise a ticket for"><SelectInput id="tk-s" value={cfg.sev} onChange={v => setCfg(c => ({ ...c, sev: v }))} options={['Critical only', 'Error and above', 'Warning and above']} /></Field>
            <Field id="tk-k" label="One ticket per"><SelectInput id="tk-k" value={cfg.key} onChange={v => setCfg(c => ({ ...c, key: v }))} options={['Customer + workload + error code', 'Customer + error code', 'Customer']} /></Field>
            <Field id="tk-r" label="Reopen instead of a new ticket within" hint="If the same problem comes back."><SelectInput id="tk-r" value={cfg.reopen} onChange={v => setCfg(c => ({ ...c, reopen: v }))} options={['24 hours', '7 days', '30 days']} /></Field>
            <Field id="tk-b" label="Board or queue"><SelectInput id="tk-b" value="Per customer, from Integrations" onChange={() => {}} options={['Per customer, from Integrations', 'One board for everything']} /></Field>
          </div>
          <Toggle on={cfg.close} onChange={v => setCfg(c => ({ ...c, close: v }))} label="Close automatically">Close the ticket when the next run succeeds</Toggle>
          <Toggle on={cfg.prio} onChange={v => setCfg(c => ({ ...c, prio: v }))} label="Priority from tier">Set ticket priority from the workload’s tier and the customer’s SLA</Toggle>
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Maintenance windows suppress tickets the same way they suppress alerts.</p>
        </Dialog>
      ) : null}
    </>
  );
}
