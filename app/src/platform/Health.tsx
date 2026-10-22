import { Icon } from '../lib/Icon';
import { Btn } from '../ui/controls';
import { Bar, MiniTable, Panel, Status, Tiles } from '../ui/layout';
import type { Ctx } from '../ui/ctx';
import { COMPONENTS, SLOS } from '../data/admin';

const copy = (ctx: Ctx, text: string) =>
  navigator.clipboard?.writeText(text).then(
    () => ctx.toast('Address copied', 'ok'),
    () => ctx.toast('Copy is blocked here. Select the address and copy it yourself.', 'warn')
  );

/** Platform health: the orchestrator's own components and services, SLOs, and where metrics go. */
export function HealthTab({ ctx }: { ctx: Ctx }) {
  const down = COMPONENTS.filter(c => c.state !== 'ok');
  const breached = SLOS.filter(s => !s.ok);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tiles
        items={[
          { label: 'Components', value: `${COMPONENTS.length - down.length}`, unit: `of ${COMPONENTS.length} healthy`, icon: down.length ? 'triangle-alert' : 'circle-check', tone: down.length ? 'warn' : 'ok', sub: down.map(c => c.name).join(', ') || 'Everything answers' },
          { label: 'SLOs met', value: `${SLOS.length - breached.length}`, unit: `of ${SLOS.length}`, icon: breached.length ? 'triangle-alert' : 'circle-check', tone: breached.length ? 'warn' : 'ok', sub: breached.map(s => s.name).join(', ') || 'All within target' },
          { label: 'Orchestrator uptime', value: '41', unit: 'days', icon: 'clock', sub: 'Since the 4.2.0 upgrade on 10 Sep' },
          { label: 'Standby lag', value: '2', unit: 's', icon: 'refresh-cw', tone: 'ok', sub: 'Mumbai warm standby' }
        ]}
      />
      {down.length ? <Bar tone="warn">{down.find(c => c.state === 'unreach')?.name} has no heartbeat since 14:52 IST. Linked to INC-region-2-os.</Bar> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel title="Components">
          <div style={{ padding: '0 16px 4px' }}>
            <MiniTable
              label="Components"
              cols={[{ label: 'Component' }, { label: 'Version', w: '72px' }, { label: 'CPU', w: '56px', r: true }, { label: 'Memory', w: '72px', r: true }, { label: 'State', w: '150px' }]}
              rows={COMPONENTS.map(c => [
                <span key="n" style={{ minWidth: 0 }} data-tip={c.note || c.kind}>
                  <strong style={{ fontWeight: 600 }}>{c.name}</strong> <span style={{ color: 'var(--tx-3)', font: '12px var(--f-ui)' }}>{c.kind}</span>
                </span>,
                c.version,
                c.cpu == null ? <em key="c" style={{ color: 'var(--tx-3)' }}>Not read</em> : `${c.cpu} %`,
                c.mem == null ? <em key="m" style={{ color: 'var(--tx-3)' }}>Not read</em> : `${c.mem} %`,
                c.state === 'ok' ? <Status key="s" icon="circle-check" tone="ok" label="Healthy" /> : c.state === 'warn' ? <Status key="s" icon="triangle-alert" tone="warn" label="Out of date" tip={c.note} /> : <Status key="s" icon="triangle-alert" tone="warn" label="No heartbeat" tip={c.note} />
              ])}
            />
          </div>
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Service level objectives" right={<span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Last 30 days</span>}>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {SLOS.map(s => (
                <li key={s.name} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--ln)' }}>
                  <Icon name={s.ok ? 'circle-check' : 'triangle-alert'} style={{ color: s.ok ? 'var(--ok)' : 'var(--warn)' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block' }}>{s.name}</span>
                    <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
                      Target {s.target} · error budget {s.budget >= 0 ? `${Math.round(s.budget * 100)} % left` : 'used up'}
                    </span>
                  </span>
                  <strong style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.actual}</strong>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Metrics and dashboards">
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', marginBottom: 4 }}>Prometheus endpoint (scrape every 30 s)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{ flex: 1, minWidth: 0, padding: '6px 8px', background: 'var(--panel-2)', border: '1px solid var(--ln)', font: '12px var(--f-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>https://aegis.host360.ai:9464/metrics</code>
                  <Btn kind="outline" size="sm" icon="copy" onClick={() => copy(ctx, 'https://aegis.host360.ai:9464/metrics')}>Copy</Btn>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['Aegis overview', 'Jobs and queues', 'Replication lag', 'Proxies and agents'].map(n => (
                  <a key={n} href={`https://grafana.host360.ai/d/aegis-${n.toLowerCase().replace(/[^a-z]+/g, '-')}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--acc-tx)', fontWeight: 600 }}>
                    Grafana: {n}
                    <Icon name="external-link" />
                  </a>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
