import { useEffect, useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { SAVED_AUDIT_FILTERS, type AuditRec } from '../data/platform';
import { Btn, Field, FilterInput, Seg, SelectFilter, SelectInput, TextInput, Toggle } from '../ui/controls';
import { Bar, Facts, H3, MiniTable, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope, showCustomerCol } from './common';
import { useStore } from './store';

const R: Record<AuditRec['r'], [string, string, string]> = { ok: ['circle-check', 'Done', 'ok'], refused: ['ban', 'Refused', 'warn'], failed: ['circle-x', 'Failed', 'err'] };

export function AuditTab({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const [side, setSide] = useState<'All' | 'Provider' | 'Customer' | 'System'>('All');
  const [q, setQ] = useState('');
  const [res, setRes] = useState('All');
  const [saved, setSaved] = useState('None');
  const [filters, setFilters] = useState(SAVED_AUDIT_FILTERS);
  const drawer = useClosable<string>();
  const exp = useClosable<boolean>();
  const siem = useClosable<boolean>();
  const save = useClosable<boolean>();
  const [fname, setFname] = useState('');
  useEffect(() => {
    if (ctx.openId && s.audit.some(a => a.id === ctx.openId)) drawer.open(ctx.openId);
  }, [ctx.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = s.audit.filter(a => inScope(ctx, a.customer) && (!ctx.actingAs || a.side !== 'System'));
  const sf = filters.find(f => f.name === saved)?.q;
  const ql = q.trim().toLowerCase();
  const rows = all.filter(
    a =>
      (side === 'All' || a.side === side) &&
      (res === 'All' || R[a.r][1] === res) &&
      (!sf || (sf === 'refused-failed' ? a.r !== 'ok' : sf === 'impersonation' ? !!a.as : /policy/i.test(a.what))) &&
      (!ql || `${a.who} ${a.as || ''} ${a.what} ${a.object} ${a.ip} ${a.corr}`.toLowerCase().includes(ql))
  );
  const d = drawer.value ? s.audit.find(a => a.id === drawer.value) : null;
  const related = d ? s.audit.filter(a => a.corr === d.corr && a.id !== d.id) : [];
  const custCol = showCustomerCol(ctx);
  return (
    <>
      <Toolbar>
        <Seg
          label="Side"
          value={side}
          onChange={setSide}
          options={[
            { v: 'All', label: 'All', count: all.length },
            { v: 'Provider', label: 'Provider', count: all.filter(a => a.side === 'Provider').length, tip: 'Actions by Host360 staff, including while acting as a customer' },
            { v: 'Customer', label: 'Customer', count: all.filter(a => a.side === 'Customer').length },
            { v: 'System', label: 'System', count: all.filter(a => a.side === 'System').length }
          ]}
        />
        <FilterInput value={q} onChange={setQ} placeholder="Who, what, IP or correlation ID" label="Filter audit log" width={240} />
        <SelectFilter label="Result" value={res} onChange={setRes} options={['All', 'Done', 'Refused', 'Failed']} />
        <SelectFilter label="Saved" value={saved} onChange={setSaved} options={['None', ...filters.map(f => f.name)]} />
        <Btn kind="ghost" icon="plus" onClick={() => { setFname(''); save.open(true); }} disabled={!ql && side === 'All' && res === 'All'} why="Set a filter first.">
          Save filter
        </Btn>
        <Spacer />
        <Btn kind="secondary" icon="download" onClick={() => exp.open(true)}>
          Export
        </Btn>
        <Btn kind="secondary" icon="send" onClick={() => siem.open(true)}>
          SIEM and archive
        </Btn>
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Audit log"
          cols={[
            { k: 'when', label: 'When', w: '188px' },
            { k: 'who', label: 'Who', w: 'minmax(170px,1.2fr)' },
            { k: 'side', label: 'Side', w: '88px', dim: true },
            ...(custCol ? [{ k: 'cust', label: 'Customer', w: 'minmax(120px,1fr)', dim: true }] : []),
            { k: 'what', label: 'What', w: 'minmax(220px,2fr)' },
            { k: 'r', label: 'Result', w: '104px' },
            { k: 'ip', label: 'From', w: '132px', dim: true },
            { k: 'corr', label: 'Correlation', w: '112px', dim: true }
          ]}
          rows={rows.map(a => ({
            id: a.id,
            when: a.when,
            who: a.as ? { t: 'icon', i: 'user-check', l: `${a.who} as ${a.as}`, c: 'warn', tip: `${a.who} acting as ${a.as}`, s: a.who } : { v: a.who, strong: a.side !== 'System' },
            side: a.side,
            cust: custName(a.customer),
            what: { v: `${a.what} · ${a.object}`, tip: a.note ? `${a.what} · ${a.object} · ${a.note}` : undefined },
            r: { t: 'status', i: R[a.r][0], l: R[a.r][1], c: R[a.r][2] },
            ip: a.ip,
            corr: a.corr
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['record', 'records']}
          filtered={side !== 'All' || res !== 'All' || saved !== 'None' || !!ql}
          onClear={() => { setSide('All'); setRes('All'); setSaved('None'); setQ(''); }}
          emptyText="Nothing recorded yet. Every sign-in, change and refusal appears here."
          sort="when"
          dir={-1}
          footR="Kept 7 years · read-only · times in IST"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Audit record"
          kicker={`Audit · ${d.side} side · ${custName(d.customer)}`}
          title={d.what}
          status={
            <>
              <Status icon={R[d.r][0]} label={R[d.r][1]} tone={R[d.r][2]} />
              <span>{d.when}</span>
            </>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {d.as ? (
              <Bar tone="warn" icon="user-check" multiline>
                {d.who} did this while acting as {d.as}. It is recorded under {d.who}.
              </Bar>
            ) : null}
            <Facts
              items={[
                { k: 'Actor', v: d.who },
                ...(d.as ? [{ k: 'Acting as', v: d.as }] : []),
                { k: 'Object', v: d.object },
                { k: 'Result', v: R[d.r][1], icon: R[d.r][0], tone: R[d.r][2] },
                ...(d.note ? [{ k: 'Detail', v: d.note }] : []),
                { k: 'IP address', v: d.ip },
                { k: 'Device', v: d.device },
                { k: 'Browser', v: d.browser },
                { k: 'Correlation ID', v: d.corr },
                { k: 'Recorded', v: d.when }
              ]}
            />
            {d.before || d.after ? (
              <section>
                <H3>Before and after</H3>
                <MiniTable
                  label="Before and after"
                  cols={[{ label: 'Field', w: '160px' }, { label: 'Before' }, { label: 'After' }]}
                  rows={(d.after || d.before || []).map(([k], i) => [k, <span key="b" style={{ color: 'var(--err)' }}>{d.before?.[i]?.[1] ?? '—'}</span>, <span key="a" style={{ color: 'var(--ok)' }}>{d.after?.[i]?.[1] ?? '—'}</span>])}
                />
              </section>
            ) : null}
            <section>
              <H3>Same correlation ID</H3>
              <MiniTable label="Related records" cols={[{ label: 'When', w: '176px' }, { label: 'What' }]} rows={related.map(r => [r.when, `${r.what} · ${r.object}`])} empty="No other records share this ID." onRow={i => drawer.open(related[i].id)} />
            </section>
          </div>
        </Drawer>
      ) : null}
      {exp.value ? <ExportDialog n={rows.length} closing={exp.closing} onClose={exp.close} onDone={f => { ctx.toast(`Exported ${plural(rows.length, 'record')} as ${f}`, 'ok'); exp.close(); }} /> : null}
      {siem.value ? <SiemDialog ctx={ctx} closing={siem.closing} onClose={siem.close} /> : null}
      {save.value ? (
        <Dialog size="sm" title="Save this filter" closing={save.closing} onClose={save.close} footer={<><Btn kind="ghost" onClick={save.close}>Cancel</Btn><Btn kind="primary" icon="check" disabled={!fname.trim()} why="Name the filter." onClick={() => { setFilters(f => [...f, { id: 'f' + Date.now(), name: fname.trim(), q: ql || side }]); setSaved(fname.trim()); ctx.toast(`Filter ${fname.trim()} saved`, 'ok'); save.close(); }}>Save</Btn></>}>
          <Field id="sf-name" label="Name" hint="Saved filters are yours; share them from Reports.">
            <TextInput id="sf-name" value={fname} onChange={setFname} placeholder="Refused restores this month" />
          </Field>
        </Dialog>
      ) : null}
    </>
  );
}

function ExportDialog({ n, closing, onClose, onDone }: { n: number; closing: boolean; onClose: () => void; onDone: (f: string) => void }) {
  const [f, setF] = useState('CSV');
  return (
    <Dialog size="sm" title={`Export ${plural(n, 'record')}`} sub="Exactly the records the current filter shows. The export itself is recorded." closing={closing} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="download" onClick={() => onDone(f)}>Export</Btn></>}>
      <Field id="ex-f" label="Format">
        <SelectInput id="ex-f" value={f} onChange={setF} options={['CSV', 'JSON lines', 'Signed PDF (evidence)']} />
      </Field>
    </Dialog>
  );
}

function SiemDialog({ ctx, closing, onClose }: { ctx: Ctx; closing: boolean; onClose: () => void }) {
  const [on, setOn] = useState(true);
  const [kind, setKind] = useState('Splunk HTTP Event Collector');
  const [url, setUrl] = useState('https://splunk.host360.ai:8088/services/collector');
  const [arch, setArch] = useState('365 days');
  const [bucket, setBucket] = useState('s3://h360-audit-archive/aegis/');
  const cfg = ctx.can('admin', 'Changing audit streaming');
  return (
    <Dialog
      title="SIEM streaming and archive"
      sub="Records stream as they happen. Older records move to object storage and stay searchable from here."
      closing={closing}
      onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="check" perm={cfg} onClick={() => { ctx.toast('Audit streaming and archive saved', 'ok'); onClose(); }}>Save</Btn></>}
    >
      <Toggle on={on} onChange={setOn} label="Stream to SIEM">
        Stream every record to a SIEM
      </Toggle>
      {on ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 16 }}>
            <Field id="si-k" label="SIEM">
              <SelectInput id="si-k" value={kind} onChange={setKind} options={['Splunk HTTP Event Collector', 'Microsoft Sentinel', 'Elastic', 'QRadar (syslog over TLS)', 'Generic syslog over TLS']} />
            </Field>
            <Field id="si-u" label="Endpoint">
              <TextInput id="si-u" value={url} onChange={setUrl} mono />
            </Field>
          </div>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, font: '13px var(--f-ui)' }}>
            <Icon name="circle-check" style={{ color: 'var(--ok)' }} /> Healthy · last record delivered 16:05:02 IST · 0 waiting
          </p>
        </>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 16 }}>
        <Field id="si-a" label="Move to archive after">
          <SelectInput id="si-a" value={arch} onChange={setArch} options={['90 days', '180 days', '365 days', '2 years']} />
        </Field>
        <Field id="si-b" label="Archive bucket (immutable)">
          <TextInput id="si-b" value={bucket} onChange={setBucket} mono />
        </Field>
      </div>
      <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--tx-2)' }}>Archived records keep their correlation IDs and are locked in compliance mode for 7 years.</p>
    </Dialog>
  );
}
