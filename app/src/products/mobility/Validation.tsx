import { useState } from 'react';
import { Icon } from '../../lib/Icon';
import { Btn, Field, Seg, TextInput, Toggle } from '../../ui/controls';
import { Bar, H3, MiniTable } from '../../ui/layout';
import { Dialog, useClosable } from '../../ui/overlay';
import type { Ctx } from '../../ui/ctx';
import { audit } from '../../platform/store';
import type { SourceVm, Wave } from './data';

type R = 'pass' | 'warn' | 'fail' | 'run' | 'wait';
interface Check { id: string; short: string; name: string; what: string; required: boolean }
const BASE: Check[] = [
  { id: 'boot', short: 'Boot', name: 'Boots and answers', what: 'Answers ping and the guest agent reports within 10 minutes', required: true },
  { id: 'ip', short: 'IP', name: 'Same IP address', what: 'The address the source had, on the mapped network', required: true },
  { id: 'disk', short: 'Disks', name: 'Disks match', what: 'Same number of disks and sizes; every file system mounted', required: true },
  { id: 'svc', short: 'Services', name: 'Services running', what: 'Windows: every Automatic service runs. Linux: no failed systemd units', required: true },
  { id: 'time', short: 'Time', name: 'Clock in sync', what: 'Within 1 s of the NTP server', required: false },
  { id: 'app', short: 'App', name: 'Application check', what: 'The check set for the server, below', required: true }
];
const APP: Record<string, string> = {
  'crm-app-01': 'HTTP https://crm.host360.ai/login returns 200',
  'crm-db-01': 'SQL: SELECT 1 on CRMDB returns 1',
  'hr-portal': 'HTTP https://hr.host360.ai/health returns 200',
  'jira-01': 'HTTP https://jira.host360.ai/status returns 200',
  'wiki-01': 'HTTP https://wiki.host360.ai returns 200',
  'grafana-01': 'HTTP https://grafana.host360.ai/api/health returns 200',
  'print-srv-02': 'Port 9100 on print-srv-02 answers',
  'SQL01': 'SQL: SELECT 1 on SQL01\\CBSREPORT returns 1',
  'rpt-app-01': 'HTTP https://reports.meridianbank.in/ping returns 200',
  'mer-ivr-01': 'Port 5060 (SIP) on mer-ivr-01 answers',
  'mer-branch-app-01': 'HTTP https://branch.meridianbank.in/health returns 200',
  'mer-branch-app-02': 'HTTP https://branch.meridianbank.in/health returns 200'
};
const appCheck = (v: SourceVm) => APP[v.name] || 'Port 22 or 3389 answers';
const NOTES: Record<string, Record<string, string>> = {
  'grafana-01': { time: 'Was 4 min ahead after the first boot; chrony corrected it at 23:41. Accepted by priya.raman.' },
  'mer-ivr-01': { app: 'Port 5060 answered on the third try, 40 s after boot. Accepted by s.iyer@meridianbank.in.' }
};
const result = (w: Wave, v: SourceVm, c: Check): R => {
  if (w.state === 'done' || v.stage === 'committed') return NOTES[v.name]?.[c.id] ? 'warn' : 'pass';
  if (v.stage === 'cutover') return ['boot', 'ip', 'disk'].includes(c.id) ? 'pass' : c.id === 'svc' ? 'run' : 'wait';
  return 'wait';
};
const ICON: Record<R, [string, string, string]> = { pass: ['circle-check', 'var(--ok)', 'Passed'], warn: ['triangle-alert', 'var(--warn)', 'Passed with a warning'], fail: ['circle-x', 'var(--err)', 'Failed'], run: ['loader-circle', 'var(--run)', 'Running'], wait: ['circle', 'var(--tx-3)', 'Runs after cutover'] };

/** Wave › Validation: the checks every server must pass after cutover before it is committed. */
export function ValidationTab({ ctx, wave, servers }: { ctx: Ctx; wave: Wave; servers: SourceVm[] }) {
  const [extra, setExtra] = useState<Check[]>([]);
  const add = useClosable<boolean>();
  const checks = [...BASE, ...extra];
  const done = wave.state === 'done';
  const live = servers.some(v => v.stage === 'cutover');
  const warns = servers.flatMap(v => checks.filter(c => result(wave, v, c) === 'warn').map(c => ({ v, c })));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {done ? (
        <Bar tone="ok" multiline>
          {servers.length} of {servers.length} servers passed every required check and were committed.{warns.length ? ` ${warns.length === 1 ? 'One warning was' : `${warns.length} warnings were`} accepted by a person.` : ''}
        </Bar>
      ) : live ? (
        <Bar tone="run" multiline>Checking {servers.filter(v => v.stage === 'cutover').map(v => v.name).join(', ')}. A server is committed when every required check passes; if one fails, it waits for a person to retry, accept or roll back.</Bar>
      ) : (
        <Bar tone="info" multiline>These checks run on every server right after cutover. A server is committed only when every required check passes; a warning needs a person to accept it.</Bar>
      )}
      <MiniTable
        label="Validation after cutover"
        cols={[{ label: 'Server', w: 'minmax(120px,1fr)' }, ...checks.map(c => ({ label: c.short, w: '62px' }))]}
        rows={servers.map(v => [
          <strong key="n" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</strong>,
          ...checks.map(c => {
            const r = result(wave, v, c);
            const [i, col, l] = ICON[r];
            const tip = `${c.name}: ${l}${NOTES[v.name]?.[c.id] ? `. ${NOTES[v.name][c.id]}` : ''}${c.id === 'app' ? ` (${appCheck(v)})` : ''}`;
            return <span key={c.id} data-tip={tip} aria-label={tip} style={{ display: 'inline-flex', color: col }}><Icon name={i} spin={r === 'run'} /></span>;
          })
        ])}
        empty="No servers in this wave."
      />
      {warns.length ? (
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {warns.map(({ v, c }) => <li key={v.id + c.id} style={{ display: 'flex', gap: 8 }}><Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: 2 }} /><span><strong style={{ fontWeight: 600 }}>{v.name} · {c.name}.</strong> {NOTES[v.name][c.id]}</span></li>)}
        </ul>
      ) : null}
      <section>
        <H3 right={!done ? <Btn kind="outline" size="sm" icon="plus" perm={ctx.can('configure', 'Planning waves')} onClick={() => add.open(true)}>Add a check…</Btn> : undefined}>Checks</H3>
        <MiniTable
          label="Checks"
          cols={[{ label: 'Check', w: '170px' }, { label: 'What passes' }, { label: '', w: '92px' }]}
          rows={checks.map(c => [c.name, <span key="w" style={{ color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis' }} data-tip={c.id === 'app' ? servers.map(v => `${v.name}: ${appCheck(v)}`).join(' · ') : c.what}>{c.what}</span>, c.required ? <span key="r" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="pin" />Required</span> : <span key="r" style={{ color: 'var(--tx-3)' }}>Warning only</span>])}
        />
      </section>
      {add.value ? (
        <AddCheckDialog
          ctx={ctx}
          closing={add.closing}
          onClose={add.close}
          onAdd={c => {
            setExtra(x => [...x, c]);
            audit({ who: 'priya.raman', customer: wave.customer, what: 'Added a validation check to a wave', object: `${wave.name}: ${c.name}`, when: ctx.now(), r: 'ok' });
            ctx.toast(`${c.name} runs on every server in ${wave.name} after cutover`, 'ok');
            add.close();
          }}
        />
      ) : null}
    </div>
  );
}

function AddCheckDialog({ ctx, closing, onClose, onAdd }: { ctx: Ctx; closing: boolean; onClose: () => void; onAdd: (c: Check) => void }) {
  const [kind, setKind] = useState<'HTTP' | 'Port' | 'Script'>('HTTP');
  const [target, setTarget] = useState('');
  const [req, setReq] = useState(true);
  const err = target.trim().length < 3 ? (kind === 'HTTP' ? 'Give the URL.' : kind === 'Port' ? 'Give the port.' : 'Give the script.') : kind === 'HTTP' && !/^https?:\/\//.test(target.trim()) ? 'The URL starts with https://' : kind === 'Port' && !/^\d{1,5}$/.test(target.trim()) ? 'A port is a number.' : null;
  return (
    <Dialog
      title="Add a check"
      sub="Runs on every server in the wave after cutover, after the standard checks."
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="plus" disabled={!!err} why={err || undefined} perm={ctx.can('configure', 'Planning waves')} onClick={() => onAdd({ id: 'x' + Date.now(), short: kind === 'Script' ? 'Script' : kind, name: kind === 'HTTP' ? 'HTTP check' : kind === 'Port' ? `Port ${target.trim()}` : 'Script check', what: kind === 'HTTP' ? `${target.trim()} returns 200` : kind === 'Port' ? `Port ${target.trim()} answers` : `${target.trim()} exits with 0`, required: req })}>
            Add check
          </Btn>
        </>
      }
    >
      <Seg label="Kind" value={kind} onChange={v => { setKind(v); setTarget(''); }} options={(['HTTP', 'Port', 'Script'] as const).map(v => ({ v, label: v }))} />
      <Field id="ac-t" label={kind === 'HTTP' ? 'URL' : kind === 'Port' ? 'Port' : 'Script on the server'} err={target && err ? err : null}>
        <TextInput id="ac-t" value={target} onChange={setTarget} placeholder={kind === 'HTTP' ? 'https://crm.host360.ai/api/ping' : kind === 'Port' ? '1433' : '/opt/app/bin/selftest.sh'} invalid={!!(target && err)} />
      </Field>
      <Toggle on={req} onChange={setReq} label="Required">Required: the server is not committed until it passes</Toggle>
    </Dialog>
  );
}
