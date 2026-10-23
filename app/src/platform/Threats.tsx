import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Btn, Field, RadioCard, Seg, SelectInput, TextArea, Toggle } from '../ui/controls';
import { Activity, Bar, DrawerTiles, Facts, MiniTable, Spacer, TableArea, Tiles, Toolbar } from '../ui/layout';
import { Dialog, Drawer, StepUp, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, showCustomerCol } from './common';
import { audit } from './store';

type Sev = 'Critical' | 'High' | 'Medium';
type TState = 'Investigating' | 'Open' | 'False positive' | 'Expected change';
interface Point { t: string; kind: 'Backup' | 'Replica (journal)' | 'Copy'; score: number; why: string; scanned: string }
interface Threat { id: string; customer: string; object: string; signal: string; detail: string; sev: Sev; first: string; products: string; state: TState; owner?: string; timeline?: [string, string, string, 'err' | 'warn' | 'ok' | 'info'][]; points?: Point[] }

/** Detections across products: backup jobs, replication streams and the audit trail feed the same detector. */
const THREATS: Threat[] = [
  {
    id: 'TH-0091', customer: 'h360', object: 'file-srv-03', signal: 'Encryption in progress', detail: 'Entropy of changed blocks rose from 12 % to 71 %; 18,240 files renamed to *.lkb in 40 minutes', sev: 'Critical', first: '21 Oct, 02:29', products: 'Backup, DR', state: 'Investigating', owner: 'arun.kumar',
    timeline: [
      ['02:29:52', 'Resilience', 'Replication stream of file-srv-03 disk 2: entropy rising (12 % → 64 %)', 'warn'],
      ['02:31:10', 'Protection', 'Agent filter driver: 1,200 renames a minute to *.lkb under D:\\Shares', 'err'],
      ['02:33:00', 'Resilience', 'Replication of file-srv-03 frozen at 02:29:40 so the clean replica is not overwritten', 'ok'],
      ['02:41:18', 'Platform', 'Sign-in as svc-backup-ops from 185.220.101.4 refused (IP allow-list)', 'warn'],
      ['02:44:02', 'Platform', 'Request to shorten retention on obj-check refused: compliance mode and quorum', 'ok'],
      ['02:48:30', 'Protection', 'Backup of file-srv-03 finished and marked suspect; kept, locked and hidden from default restores', 'warn'],
      ['02:50:00', 'Platform', 'Sent to Meridian SOC Splunk and the Host360 on-call; incident INC0091440 opened', 'info']
    ],
    points: [
      { t: '21 Oct 2026, 02:48', kind: 'Backup', score: 9, why: '71 % high-entropy blocks; 18,240 renamed files', scanned: 'Ransom note README-LKB.txt found in 412 folders' },
      { t: '21 Oct 2026, 02:29:40', kind: 'Replica (journal)', score: 94, why: '12 s before the first signal; entropy normal', scanned: 'Not scanned yet' },
      { t: '20 Oct 2026, 02:00', kind: 'Backup', score: 98, why: 'Entropy and renames normal', scanned: 'Clean: YARA 2026.10.20 and signatures, 20 Oct 03:10' },
      { t: '19 Oct 2026, 02:00', kind: 'Backup', score: 98, why: 'Entropy and renames normal', scanned: 'Clean: 19 Oct 03:05' },
      { t: '18 Oct 2026, 02:00', kind: 'Copy', score: 97, why: 'Offsite copy on copy-check-repo', scanned: 'Clean: 18 Oct 03:20' }
    ]
  },
  { id: 'TH-0090', customer: 'h360', object: 'svc-backup-ops', signal: 'Unusual administrator activity', detail: 'Sign-in from a Tor exit node, then an attempt to shorten retention on obj-check; both refused', sev: 'High', first: '21 Oct, 02:41', products: 'Platform', state: 'Open', owner: 'priya.raman' },
  { id: 'TH-0088', customer: 'nil', object: 'nil-pos-db', signal: 'Deletion spike', detail: '41 % of files under /var/pos/archive deleted between two backups', sev: 'Medium', first: '18 Oct, 23:10', products: 'Backup', state: 'False positive', owner: 'it@nilgiriretail.in' },
  { id: 'TH-0085', customer: 'sah', object: 'his-db-01', signal: 'Deduplication collapse', detail: 'Reduction fell from 4.1× to 1.2× in one backup', sev: 'Medium', first: '14 Oct, 16:00', products: 'Backup', state: 'Expected change', owner: 'v.joshi@sahyadrihospitals.in' }
];
export const openThreatCount = (ctx: Ctx) => THREATS.filter(t => inScope(ctx, t.customer) && (t.state === 'Open' || t.state === 'Investigating')).length;
const SEV_TONE: Record<Sev, string> = { Critical: 'err', High: 'err', Medium: 'warn' };
const RESOLUTION: Record<string, string> = { 'TH-0088': 'Monthly archive purge by the POS vendor; added to the expected-changes calendar', 'TH-0085': 'Transparent data encryption turned on for the HIS database on 14 Oct; reduction recalculated' };

/** Security & Compliance › Threats: ransomware and anomaly detection, suspect points, clean recovery. */
export function ThreatsTab({ ctx }: { ctx: Ctx }) {
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [states, setStates] = useState<Record<string, TState>>({});
  const drawer = useClosable<string>();
  const clean = useClosable<string>();
  const fp = useClosable<string>();
  const settings = useClosable<boolean>();
  const all = THREATS.filter(t => inScope(ctx, t.customer)).map(t => ({ ...t, state: states[t.id] || t.state }));
  const open = (t: Threat) => t.state === 'Open' || t.state === 'Investigating';
  const rows = all.filter(t => show === 'all' || open(t));
  const d = drawer.value ? all.find(t => t.id === drawer.value) : null;
  const custCol = showCustomerCol(ctx);
  const suspect = all.flatMap(t => (t.points || []).filter(p => p.score < 50)).length;
  return (
    <>
      <div style={{ padding: '0 24px 12px' }}>
        <Tiles
          items={[
            { label: 'Open detections', value: String(all.filter(open).length), icon: 'shield-alert', tone: all.some(t => open(t) && t.sev === 'Critical') ? 'err' : all.some(open) ? 'warn' : 'ok', sub: `${all.filter(t => open(t) && t.sev === 'Critical').length} critical` },
            { label: 'Suspect recovery points', value: String(suspect), icon: 'triangle-alert', tone: suspect ? 'warn' : 'ok', sub: 'Kept and locked; hidden from default restores' },
            { label: 'Points scanned, 24 h', value: '1,284', icon: 'radar', tone: 'ok', sub: 'YARA 2026.10.20 (1,408 rules) and signatures' },
            { label: 'Signals', value: '7', unit: 'of 7 on', icon: 'activity', sub: 'From backups, replication and the audit trail' }
          ]}
        />
      </div>
      <Toolbar>
        <Seg label="Show" value={show} onChange={setShow} options={[{ v: 'open', label: 'Open', count: all.filter(open).length }, { v: 'all', label: 'All', count: all.length }]} />
        <Spacer />
        <Btn kind="outline" icon="settings-2" perm={ctx.can('admin', 'Changing detection settings')} onClick={() => settings.open(true)}>Detection settings…</Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Threat detections"
          cols={[
            { k: 'id', label: 'Detection', w: '100px', dim: true },
            ...(custCol ? [{ k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true }] : []),
            { k: 'o', label: 'Object', w: '140px' },
            { k: 'sig', label: 'Signal', w: 'minmax(200px,1.6fr)' },
            { k: 'sev', label: 'Severity', w: '110px' },
            { k: 'p', label: 'Seen in', w: '110px', dim: true },
            { k: 'f', label: 'First seen', w: '120px' },
            { k: 's', label: 'State', w: '160px' }
          ]}
          rows={rows.map(t => ({
            id: t.id,
            c: custName(t.customer),
            o: { v: t.object, strong: true },
            sig: { v: t.signal, tip: t.detail },
            sev: { t: 'status', i: t.sev === 'Medium' ? 'triangle-alert' : 'shield-alert', c: SEV_TONE[t.sev], l: t.sev, s: t.sev === 'Critical' ? 0 : t.sev === 'High' ? 1 : 2 },
            p: t.products,
            f: t.first,
            s: open(t) ? { t: 'status', i: t.state === 'Investigating' ? 'loader-circle' : 'circle-dot', c: 'warn', l: t.state, tip: t.owner ? `Owner: ${t.owner}` : undefined } : { t: 'status', i: 'circle-check', c: 'tx', l: t.state, tip: RESOLUTION[t.id] }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['detection', 'detections']}
          filtered={show !== 'all'}
          onClear={() => setShow('all')}
          emptyText="No open detections."
          sort="sev"
          footR="Detections also go to the SIEM and to the alert rules in Alerts & Activity"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Threat detection"
          kicker={`${d.id} · ${custName(d.customer)} · ${d.products}`}
          title={`${d.signal} on ${d.object}`}
          status={<><span>{d.sev}</span><span>{d.state}</span><span>First seen {d.first}</span></>}
          actions={
            open(d) ? (
              <>
                {d.points ? <Btn kind="primary" icon="shield" perm={ctx.can('restore', 'Recovering')} onClick={() => clean.open(d.id)}>Recover clean…</Btn> : null}
                <Btn kind="outline" icon="ban" perm={ctx.can('configure', 'Closing detections')} onClick={() => fp.open(d.id)}>Not a threat…</Btn>
              </>
            ) : undefined
          }
          width={680}
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Bar tone={open(d) ? (d.sev === 'Medium' ? 'warn' : 'err') : 'info'} multiline>{open(d) ? d.detail : `${d.detail}. Closed as ${d.state.toLowerCase()}: ${RESOLUTION[d.id] || 'see the audit log'}.`}</Bar>
            {d.points ? (
              <>
                <DrawerTiles items={[{ label: 'Last clean point', value: '02:29:40', sub: '21 Oct · replica journal' }, { label: 'Last scanned clean', value: '20 Oct, 02:00', sub: 'Backup' }, { label: 'Suspect points', value: String(d.points.filter(p => p.score < 50).length) }]} />
                <div>
                  <h3 style={{ font: '600 13px/18px var(--f-ui)', marginBottom: 6 }}>Recovery points, cleanest first</h3>
                  <MiniTable
                    label="Clean-point scores"
                    cols={[{ label: 'Point', w: '170px' }, { label: 'Kind', w: '130px' }, { label: 'Score', w: '70px', r: true }, { label: 'Evidence' }]}
                    rows={[...d.points].sort((a, b) => b.score - a.score || (a.t < b.t ? 1 : -1)).map(p => [p.t.replace(' 2026', ''), p.kind, <span key="s" style={{ color: p.score < 50 ? 'var(--err)' : 'var(--ok)', fontWeight: 600 }}>{p.score}</span>, <span key="e" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={`${p.why}. ${p.scanned}`} data-tip-overflow="">{p.scanned}</span>])}
                  />
                  <p style={{ marginTop: 6, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>The score combines entropy, renames, deletions and the scan result. A point after the first signal is never offered as the default.</p>
                </div>
              </>
            ) : null}
            {d.timeline ? (
              <div>
                <h3 style={{ font: '600 13px/18px var(--f-ui)', marginBottom: 6 }}>Timeline across products</h3>
                <Activity items={d.timeline.map(([t, prod, text, tone]) => ({ icon: tone === 'err' ? 'circle-x' : tone === 'warn' ? 'triangle-alert' : tone === 'ok' ? 'circle-check' : 'info', tone, text, when: `21 Oct, ${t} · ${prod}` }))} />
              </div>
            ) : (
              <Facts items={[{ k: 'Signal', v: d.signal }, { k: 'Owner', v: d.owner || 'Nobody yet' }, { k: 'Seen in', v: d.products }]} />
            )}
          </div>
        </Drawer>
      ) : null}
      {clean.value ? <CleanRecoveryDialog ctx={ctx} t={all.find(t => t.id === clean.value)!} closing={clean.closing} onClose={clean.close} /> : null}
      {fp.value ? (
        <FalsePositiveDialog
          closing={fp.closing}
          onClose={fp.close}
          onSave={(reason, kind) => {
            const t = all.find(x => x.id === fp.value)!;
            setStates(s => ({ ...s, [t.id]: kind }));
            audit({ who: 'priya.raman', customer: t.customer, what: `Closed a threat detection as ${kind.toLowerCase()}`, object: `${t.id} · ${t.object}`, when: ctx.now(), r: 'ok', note: reason });
            ctx.toast(`${t.id} closed as ${kind.toLowerCase()}; suspect points stay locked for 30 days`, 'ok');
            fp.close();
            drawer.close();
          }}
        />
      ) : null}
      {settings.value ? <DetectionSettings ctx={ctx} closing={settings.closing} onClose={settings.close} /> : null}
    </>
  );
}

function CleanRecoveryDialog({ ctx, t, closing, onClose }: { ctx: Ctx; t: Threat; closing: boolean; onClose: () => void }) {
  const pts = (t.points || []).filter(p => p.score >= 50).sort((a, b) => b.score - a.score || (a.t < b.t ? 1 : -1));
  const [pt, setPt] = useState(pts.find(p => p.kind === 'Replica (journal)')?.t || pts[0]?.t);
  const [room, setRoom] = useState('cleanroom-01 on production-openstack (no route out, no domain)');
  const [yara, setYara] = useState(true);
  const [iocs, setIocs] = useState(true);
  const [ok, setOk] = useState(false);
  const chosen = pts.find(p => p.t === pt);
  return (
    <Dialog
      title={`Recover ${t.object} clean`}
      sub="Start a clean point in an isolated clean room, scan it, check the application, then release it. Nothing touches production until release."
      size="lg"
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn
            kind="primary"
            icon="play"
            disabled={!ok || !pt}
            why="Confirm with your second factor first."
            onClick={() => {
              ctx.startJob({ name: 'Clean recovery', object: t.object, product: 'Backup', type: 'Restore', phases: ['Queued', 'Boot in the clean room', 'Scan', 'Check the application', 'Waiting for release'], speed: 10, rate: '240 MB/s', firstLine: `Clean recovery of ${t.object} from ${pt} started in the clean room`, doneToast: `${t.object} is clean and waiting for release in the clean room` });
              audit({ who: 'priya.raman', customer: t.customer, what: 'Started a clean recovery', object: `${t.object} from ${pt}`, when: ctx.now(), r: 'ok', note: t.id, after: [['Clean room', room], ['YARA scan', yara ? 'Yes' : 'No'], ['SOC indicators', iocs ? 'Yes' : 'No']] });
              ctx.toast(`Clean recovery of ${t.object} started; release needs a security approver`, 'info');
              onClose();
            }}
          >
            Start in the clean room
          </Btn>
        </>
      }
    >
      <div role="radiogroup" aria-label="Recovery point" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pts.map(p => (
          <RadioCard key={p.t} on={pt === p.t} onClick={() => setPt(p.t)} icon={p.kind === 'Backup' ? 'archive' : p.kind === 'Copy' ? 'copy' : 'activity'} title={`${p.t.replace(' 2026', '')} · ${p.kind}`} note={`Score ${p.score}. ${p.why}. ${p.scanned}`} tag={p === pts[0] ? 'Cleanest' : undefined} />
        ))}
      </div>
      {chosen?.kind === 'Replica (journal)' ? <Bar tone="info" multiline>The journal point is 12 seconds before the first signal, so it loses the least data, but it has not been scanned. The scan in the clean room decides.</Bar> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <Field id="cr-room" label="Clean room"><SelectInput id="cr-room" value={room} onChange={setRoom} options={['cleanroom-01 on production-openstack (no route out, no domain)', 'cleanroom-02 on region-2-os (no route out, no domain)']} /></Field>
      </div>
      <Toggle on={yara} onChange={setYara} label="YARA and signature scan"><span style={{ whiteSpace: 'normal', textAlign: 'left' }}>Scan every volume with YARA 2026.10.20 and the signature engine before release</span></Toggle>
      <Toggle on={iocs} onChange={setIocs} label="SOC indicators"><span style={{ whiteSpace: 'normal', textAlign: 'left' }}>Also check the 37 indicators of compromise from the Meridian SOC (hashes, file names, registry keys)</span></Toggle>
      <Facts labelW={110} items={[{ k: 'Then', v: 'Check the shares answer and a test user can open files, then wait for release' }, { k: 'Release', v: 'A security approver releases it to production; the suspect server is kept powered off for forensics' }]} />
      <StepUp verified={ok} onVerified={() => setOk(true)} />
    </Dialog>
  );
}

function FalsePositiveDialog({ closing, onClose, onSave }: { closing: boolean; onClose: () => void; onSave: (reason: string, kind: TState) => void }) {
  const [kind, setKind] = useState<TState>('False positive');
  const [reason, setReason] = useState('');
  return (
    <Dialog title="Close the detection" closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" disabled={reason.trim().length < 10} why="Say why, in a sentence." onClick={() => onSave(reason.trim(), kind)}>Close detection</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RadioCard on={kind === 'False positive'} onClick={() => setKind('False positive')} icon="ban" title="False positive" note="Nothing happened; the signal was wrong" />
        <RadioCard on={kind === 'Expected change'} onClick={() => setKind('Expected change')} icon="calendar-clock" title="Expected change" note="A planned job or change caused it; add it to the calendar" />
      </div>
      <Field id="fp-r" label="Why"><TextArea id="fp-r" value={reason} onChange={setReason} rows={3} placeholder="Monthly archive purge run by the POS vendor" /></Field>
    </Dialog>
  );
}

const SIGNALS: [string, string, boolean][] = [
  ['Entropy of changed blocks', 'Above 50 % of changed blocks, or 3 × the 30-day baseline', true],
  ['Mass renames and known ransomware extensions', 'More than 500 renames a minute, or any of 4,200 known extensions', true],
  ['Deletion spike', 'More than 30 % of files gone between two points', true],
  ['Deduplication collapse', 'Reduction falls by more than half in one point', true],
  ['Replication stream anomaly', 'Entropy and write rate on the replication journal; freezes the replica at the last normal second', true],
  ['Unusual administrator activity', 'New country or network, impossible travel, mass deletes, retention changes at night', true],
  ['Ransom notes', 'Known note names and contents in a scanned point', true]
];

function DetectionSettings({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [on, setOn] = useState(SIGNALS.map(s => s[2]));
  const [scan, setScan] = useState('Always, for every restore');
  const [freeze, setFreeze] = useState(true);
  return (
    <Dialog title="Detection settings" sub="Apply to every customer unless a customer’s policy overrides them." size="lg" closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" onClick={() => { audit({ who: 'priya.raman', customer: 'h360', what: 'Changed threat detection settings', object: 'Every customer', when: ctx.now(), r: 'ok', after: [['Signals on', String(on.filter(Boolean).length)], ['Scan before restore', scan], ['Freeze replicas', freeze ? 'Yes' : 'No']] }); ctx.toast('Detection settings saved', 'ok'); onClose(); }}>Save</Btn></>}>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)' }}>
        {SIGNALS.map(([n, d], i) => (
          <div key={n} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--ln)' }}>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span>{n}</span>
              <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{d}</span>
            </span>
            <Toggle on={on[i]} label={n} onChange={v => setOn(x => x.map((y, j) => (j === i ? v : y)))} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field id="ds-s" label="Scan before restore"><SelectInput id="ds-s" value={scan} onChange={setScan} options={['Always, for every restore', 'Only sensitive workloads', 'Only when a detection is open', 'Off']} /></Field>
        <Field id="ds-y" label="Rule sets"><SelectInput id="ds-y" value="Host360 baseline + customer rules" onChange={() => {}} options={['Host360 baseline + customer rules', 'Host360 baseline only']} /></Field>
      </div>
      <Toggle on={freeze} onChange={setFreeze} label="Freeze replicas"><span style={{ whiteSpace: 'normal', textAlign: 'left' }}>Freeze a replica at its last normal second when its stream looks like encryption</span></Toggle>
      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Signals also arrive from CrowdStrike Falcon and Microsoft Defender when they are connected in Integrations.</p>
    </Dialog>
  );
}

