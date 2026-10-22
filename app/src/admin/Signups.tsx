import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { T } from '../data/platform';
import { Btn, Field, Seg, TextInput } from '../ui/controls';
import { Bar, Facts, MiniTable, Page, PageHeader, Spacer, Status, TableArea, Tiles, Toolbar } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { audit } from '../platform/store';

type State = 'Waiting for review' | 'Trial started' | 'Asked for documents' | 'Rejected';
interface Signup { id: string; org: string; email: string; country: string; tax: string; product: string; when: string; checks: [string, 'ok' | 'warn' | 'err', string][]; state: State; note?: string }
const SIGNUPS: Signup[] = [
  { id: 'SU-0219', org: 'Vaigai Agro Foods Pvt Ltd', email: 'it@vaigaiagro.in', country: 'India', tax: '33AAFCV2210Q1ZK', product: 'Protection', when: T('21 Oct', '14:12'), state: 'Waiting for review', checks: [['Work e-mail', 'ok', 'Code confirmed'], ['GST portal', 'warn', 'Legal name on the portal is “Sri Vaigai Agro Products”'], ['Certificate', 'ok', 'CIN U15400TN2016PTC104511'], ['Sanctions and fraud lists', 'ok', 'No match']], note: 'Name differs from the GST portal' },
  { id: 'SU-0218', org: 'Palar Textiles Pvt Ltd', email: 'senthil@palartextiles.in', country: 'India', tax: '33AAACP4521K1Z9', product: 'Protection', when: T('21 Oct', '11:40'), state: 'Trial started', checks: [['Work e-mail', 'ok', 'Code confirmed'], ['GST portal', 'ok', 'Active since 2014; name matches'], ['Certificate', 'ok', 'CIN U17111TN2011PTC081234'], ['Sanctions and fraud lists', 'ok', 'No match']] },
  { id: 'SU-0217', org: 'Rhein Logistik GmbH', email: 'it-betrieb@rhein-logistik.de', country: 'Germany', tax: 'DE281734410', product: 'Mobility', when: T('20 Oct', '17:05'), state: 'Asked for documents', checks: [['Work e-mail', 'ok', 'Code confirmed'], ['VIES', 'ok', 'Valid; name matches'], ['Certificate', 'err', 'Handelsregister extract older than 3 months'], ['Sanctions and fraud lists', 'ok', 'No match']], note: 'New register extract requested 20 Oct, 18:00' },
  { id: 'SU-0216', org: 'Quickcart Deals', email: 'admin@quickcart-deals.shop', country: 'India', tax: '07ABCDE1234F1Z5', product: 'Protection', when: T('19 Oct', '09:30'), state: 'Rejected', checks: [['Work e-mail', 'ok', 'Code confirmed'], ['GST portal', 'err', 'GSTIN cancelled on 12 Mar 2026'], ['Certificate', 'err', 'Document does not match the GSTIN'], ['Sanctions and fraud lists', 'warn', 'Domain registered 3 days ago']], note: 'Cancelled GSTIN and mismatched document' }
];
const ST: Record<State, [string, string]> = { 'Waiting for review': ['hourglass', 'warn'], 'Trial started': ['circle-check', 'ok'], 'Asked for documents': ['mail', 'run'], Rejected: ['ban', 'err'] };

/** Internal admin › Sign-ups: self sign-ups whose automatic KYC checks did not all pass wait here for a person. */
export function SignupsSection({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Signup[]>(SIGNUPS);
  const [view, setView] = useState<'open' | 'all'>('open');
  const drawer = useClosable<string>();
  const reject = useClosable<string>();
  const open = list.filter(s => s.state === 'Waiting for review' || s.state === 'Asked for documents');
  const rows = view === 'open' ? open : list;
  const d = drawer.value ? list.find(s => s.id === drawer.value) : null;
  const set = (id: string, state: State, note?: string) => setList(x => x.map(s => (s.id === id ? { ...s, state, note } : s)));
  return (
    <Page>
      <PageHeader kicker="Customers" title="Sign-ups" sub="Self sign-ups from aegis.host360.ai/signup. Most start their trial at once; those whose checks did not all pass wait here." actions={<Btn kind="outline" icon="external-link" onClick={() => { location.hash = '/signup'; }}>Open the sign-up page</Btn>} />
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles items={[{ label: 'Waiting for review', value: `${list.filter(s => s.state === 'Waiting for review').length}`, icon: 'hourglass', tone: 'warn', sub: 'Promised within 4 business hours' }, { label: 'Trials this month', value: '14', icon: 'circle-check', tone: 'ok', sub: '11 started without review' }, { label: 'Converted to paid', value: '4', unit: 'of 9', icon: 'arrow-up', sub: 'Trials that ended in October' }, { label: 'Rejected', value: `${list.filter(s => s.state === 'Rejected').length}`, icon: 'ban', sub: 'Failed KYC' }]} />
      </div>
      <Toolbar>
        <Seg label="Show" value={view} onChange={setView} options={[{ v: 'open', label: 'Need a person', count: open.length }, { v: 'all', label: 'All', count: list.length }]} />
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Sign-ups"
          cols={[{ k: 'o', label: 'Organisation', w: 'minmax(220px,1.5fr)' }, { k: 'c', label: 'Country', w: '100px' }, { k: 't', label: 'GSTIN or VAT', w: '170px', dim: true }, { k: 'p', label: 'Trial', w: '110px' }, { k: 'w', label: 'Signed up', w: '130px' }, { k: 'st', label: 'State', w: '190px' }]}
          rows={rows.map(s => ({ id: s.id, o: { v: s.org, strong: true, tip: s.email }, c: s.country, t: s.tax, p: s.product, w: s.when.replace(' 2026', '').replace(' IST', ''), st: { t: 'status', i: ST[s.state][0], c: ST[s.state][1], l: s.state, tip: s.note || s.state } }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['sign-up', 'sign-ups']}
          filtered={view !== 'all'}
          onClear={() => setView('all')}
          emptyText="Nothing waiting. Every recent sign-up passed its checks."
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Sign-up"
          kicker={`Sign-up · ${d.id}`}
          title={d.org}
          status={<><Status icon={ST[d.state][0]} tone={ST[d.state][1]} label={d.state} /><span>{d.email}</span></>}
          actions={
            d.state === 'Waiting for review' || d.state === 'Asked for documents' ? (
              <>
                <Btn kind="primary" icon="check" onClick={() => { set(d.id, 'Trial started'); audit({ who: 'priya.raman', customer: 'h360', what: 'Approved a sign-up', object: d.org, when: ctx.now(), r: 'ok' }); ctx.toast(`${d.org}: trial provisioned and the owner invited`, 'ok'); }}>Approve and start the trial</Btn>
                <Btn kind="outline" icon="mail" disabled={d.state === 'Asked for documents'} why="Documents already asked for." onClick={() => { set(d.id, 'Asked for documents', `Documents requested ${ctx.now()}`); ctx.toast(`Asked ${d.email} for documents`, 'ok'); }}>Ask for documents</Btn>
                <Spacer />
                <Btn kind="danger" icon="ban" onClick={() => reject.open(d.id)}>Reject…</Btn>
              </>
            ) : undefined
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {d.note ? <Bar tone={d.state === 'Rejected' ? 'err' : 'warn'}>{d.note}</Bar> : null}
            <MiniTable label="Checks" cols={[{ label: 'Check', w: '190px' }, { label: 'Result' }]} rows={d.checks.map(([k, r, t]) => [k, <Status key="r" icon={r === 'ok' ? 'circle-check' : r === 'warn' ? 'triangle-alert' : 'circle-x'} tone={r} label={t} />])} />
            <Facts items={[{ k: 'Owner', v: d.email }, { k: 'Country', v: `${d.country}; data in ${d.country === 'India' ? 'India South' : 'EU Central'}` }, { k: d.country === 'India' ? 'GSTIN' : 'VAT', v: d.tax }, { k: 'Trial', v: `${d.product}, 30 days, 10 workloads` }, { k: 'Signed up', v: d.when }]} />
          </div>
        </Drawer>
      ) : null}
      {reject.value ? <RejectDialog org={list.find(s => s.id === reject.value)!.org} closing={reject.closing} onClose={reject.close} onReject={why => { const s = list.find(x => x.id === reject.value)!; set(s.id, 'Rejected', why); audit({ who: 'priya.raman', customer: 'h360', what: 'Rejected a sign-up', object: s.org, when: ctx.now(), r: 'ok', note: why }); ctx.toast(`${s.org} rejected; they are told why`, 'ok'); reject.close(); }} /> : null}
    </Page>
  );
}

function RejectDialog({ org, closing, onClose, onReject }: { org: string; closing: boolean; onClose: () => void; onReject: (why: string) => void }) {
  const [why, setWhy] = useState('');
  return (
    <Dialog
      title={`Reject ${org}`}
      sub="No tenant is created. They get an e-mail with the reason and can sign up again with corrected documents."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="danger" icon="ban" disabled={why.trim().length < 8} why="Give the reason they will read." onClick={() => onReject(why.trim())}>Reject</Btn></>}
    >
      <Field id="rj-w" label="Reason"><TextInput id="rj-w" value={why} onChange={setWhy} placeholder="The GSTIN is cancelled on the GST portal" autoFocus /></Field>
    </Dialog>
  );
}
