/* Ported from project/AegisOverview.dc.html */
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { AEGIS } from '../data/aegis';

const SC = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', run: 'var(--run)', tx: 'var(--tx-3)' };
const SEVI = { critical: ['circle-x', 'var(--err)'], warning: ['triangle-alert', 'var(--warn)'], info: ['info', 'var(--tx-2)'] };
const ROUTE = o => (/^(sql|erp|ad-|mail|web|file|gitlab|billing)/.test(o) ? null : null);

export default class AegisOverview extends DC {
  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    const E = { tiles: [], chart: [], plans: [], stages: [], issues: [], bottom: [] };
    if (!A || !ctx) return E;
    const p = ctx.product;
    const ui = ctx.ui;
    const loading = ui === 'loading',
      unreach = ui === 'unreach';
    const T = (label, value, unit, sub, i, ic, href, segs?) => ({
      label,
      value: unreach ? 'Not read' : value,
      unit: unreach ? '' : unit,
      sub: unreach ? 'Could not be read' : sub,
      i,
      ic,
      href,
      loading,
      ready: !loading,
      fs: unreach ? 'italic' : 'normal',
      vc: unreach ? 'var(--tx-3)' : 'var(--tx)',
      hasSegs: !!segs && !loading && !unreach,
      segs: segs || []
    });
    let tiles = [],
      issues = [],
      left = {},
      bottom = {},
      extra = {};
    const alerts = A.alerts.filter(a => a.product === { backup: 'Backup', dr: 'DR', mig: 'Migration' }[p] || a.product === 'All');
    const objHref = a =>
      a.product === 'DR'
        ? `#/dr/servers?open=${a.object}`
        : a.product === 'Backup'
          ? A.repos.some(r => r.name === a.object)
            ? `#/${p}/repos`
            : `#/backup/guests?open=${a.object}`
          : a.product === 'Migration'
            ? `#/${p}/sites`
            : `#/${p}/sites`;
    issues = alerts.map(a => ({
      i: SEVI[a.sev][0],
      c: SEVI[a.sev][1],
      title: `${a.title}: ${a.object}`,
      detail: a.detail,
      href: objHref(a)
    }));
    if (p === 'backup') {
      tiles = [
        T('Guests protected', '172', 'of 180', '8 guests have no policy', 'monitor', 'var(--tx-3)', '#/backup/guests'),
        T('Last 24 hours', '412', 'jobs', '405 succeeded · 6 warnings · 1 failed', 'activity', 'var(--tx-3)', '#/backup/jobs', [
          { w: '98.3%', c: 'var(--ok)' },
          { w: '1.45%', c: 'var(--warn)' },
          { w: '0.25%', c: 'var(--err)' }
        ]),
        T('Data protected', '2958.89', 'GB', 'Stored in 912.51 GB · data reduction 3.2×', 'layers', 'var(--tx-3)', '#/backup/repos'),
        T('Repository capacity', '24.7', '%', '912.51 GB of 3.73 TB used', 'database', 'var(--tx-3)', '#/backup/repos', [
          { w: '24.7%', c: 'var(--tx-3)' }
        ])
      ];
      const chart = Array.from({ length: 24 }, (_, i) => {
        const n = [6, 4, 3, 2, 2, 2, 2, 2, 2, 2, 89, 28, 14, 12, 14, 12, 13, 14, 16, 18, 22, 26, 34, 42][i];
        const w = i === 10 ? 2 : i === 18 || i === 22 ? 1 : i === 0 ? 1 : 0;
        const e = i === 10 ? 1 : 0;
        const max = 92;
        return {
          ok: `${((n - w - e) / max) * 100}%`,
          warn: `${(w / max) * 100}%`,
          err: `${(e / max) * 100}%`,
          tip: `${String((16 + i) % 24).padStart(2, '0')}:00 · ${n} jobs${w ? ` · ${w} warnings` : ''}${e ? ` · ${e} failed` : ''}`
        };
      });
      left = {
        leftTitle: 'Results over the last 24 hours',
        leftLink: 'Open Jobs',
        leftHref: '#/backup/jobs',
        chart,
        chartLabel: 'Backup jobs per hour over the last 24 hours. 405 succeeded, 6 warnings, 1 failed.'
      };
      bottom = {
        bottomTitle: 'Repository capacity',
        bottomLink: 'Open Repositories',
        bottomHref: '#/backup/repos',
        bottom: A.repos.map(r => {
          const pct = Math.round((r.used / r.cap) * 100);
          return {
            a: r.name,
            b: r.type,
            pct: unreach ? '0%' : `${pct}%`,
            pc: pct >= 85 ? 'var(--warn)' : 'var(--tx-3)',
            c: unreach ? 'Not read' : `${A.fmtGB(r.used)} of ${A.fmtGB(r.cap)}`,
            d: unreach ? '' : r.red,
            lock: r.lock ? 'lock' : '',
            enc: r.enc ? 'shield' : ''
          };
        })
      };
    } else if (p === 'dr') {
      const within = A.drServers.filter(x => x.ageMin != null && x.ageMin <= (x.target === '15 min' ? 15 : 1440)).length;
      tiles = [
        T(
          'Within recovery target',
          `${within}`,
          'of 10',
          '1 behind · 1 failed · 1 online at recovery site · 1 not read',
          'gauge',
          'var(--tx-3)',
          '#/dr/servers',
          [
            { w: '60%', c: 'var(--ok)' },
            { w: '10%', c: 'var(--warn)' },
            { w: '10%', c: 'var(--err)' },
            { w: '10%', c: 'var(--run)' },
            { w: '10%', c: 'var(--ln-2)' }
          ]
        ),
        T('Last sync', '15:59', 'IST', 'sql-prod-02 succeeded in 3 min 25 s', 'refresh-cw', 'var(--ok)', '#/dr/history'),
        T('Recovery plans ready', '1', 'of 3', 'Daily check at 06:00 IST found 2 issues', 'list-ordered', 'var(--warn)', '#/dr/recovery'),
        T('Last test', '18 Oct', '', 'Core services failover passed in 18 min 40 s', 'flask-conical', 'var(--ok)', '#/dr/recovery'),
        T(
          'Delta storage used',
          '412.60',
          'GB',
          'At production-openstack and Chennai-proxmox-prod',
          'database',
          'var(--tx-3)',
          '#/dr/servers'
        )
      ];
      left = {
        leftTitle: 'Recovery plan readiness',
        leftLink: 'Open Recovery plans',
        leftHref: '#/dr/recovery',
        plans: A.recPlans.map(rp => ({
          name: rp.name,
          href: `#/dr/recovery?open=${rp.id}`,
          ri: rp.ready === 'ready' ? 'circle-check' : rp.ready === 'issues' ? 'triangle-alert' : 'circle-minus',
          rc: rp.ready === 'ready' ? 'var(--ok)' : rp.ready === 'issues' ? 'var(--warn)' : 'var(--tx-3)',
          ready: rp.ready === 'ready' ? 'Ready' : rp.ready === 'issues' ? `${rp.issues} issues` : 'Not checked: site not read',
          test: rp.lastTest ? `Tested ${rp.lastTest.t.replace(' 2026', '')}` : 'Never tested'
        }))
      };
      bottom = {
        bottomTitle: 'Delta storage by recovery site',
        bottomLink: 'Open Protected servers',
        bottomHref: '#/dr/servers',
        bottom: [
          ['production-openstack', 'OpenStack', 38, '318.40 GB of 840.00 GB', '7 servers'],
          ['Chennai-proxmox-prod', 'Proxmox VE', 21, '94.20 GB of 450.00 GB', '2 servers'],
          ['region-2-os', 'OpenStack', 0, 'Not read', '1 server']
        ].map(([a, b, pc, c, d]) => ({ a, b, pct: `${pc}%`, pc: 'var(--tx-3)', c: unreach ? 'Not read' : c, d, lock: '', enc: '' }))
      };
    } else {
      const by = k => A.migServers.filter(x => x.stage === k).length;
      tiles = [
        T('Servers migrating', '10', '', 'From Chennai vCenter and esxi-edge-07', 'server', 'var(--tx-3)', '#/mig/servers'),
        T('Data still to copy', '3.33', 'TB', 'First passes not yet started or running', 'download', 'var(--tx-3)', '#/mig/servers'),
        T('Next cutover', '25 Oct', '22:00 IST', 'Wave 1 · CRM: 1 of 3 servers ready', 'calendar', 'var(--warn)', '#/mig/plans'),
        T(
          'Committed',
          `${by('committed')}`,
          'of 10',
          `${by('cutover')} waiting to commit or roll back`,
          'git-commit',
          'var(--tx-3)',
          '#/mig/servers'
        )
      ];
      const stages = [
        ['Not started', by('notstarted') + by('rolledback'), 'var(--ln-2)'],
        ['First pass', by('first'), 'var(--run)'],
        ['Synced', by('synced'), 'var(--tx-3)'],
        ['Testing or ready', by('testing') + by('ready'), 'var(--tx-2)'],
        ['Cut over', by('cutover'), 'var(--warn)'],
        ['Committed', by('committed'), 'var(--ok)']
      ].map(([label, n, c], i) => ({ label, n: unreach ? '—' : String(n), c, bl: i ? 'var(--ln)' : 'transparent' }));
      left = { leftTitle: 'Servers by stage', leftLink: 'Open Servers', leftHref: '#/mig/servers', stages };
      bottom = {
        bottomTitle: 'Upcoming cutovers',
        bottomLink: 'Open Migration plans',
        bottomHref: '#/mig/plans',
        bottom: A.migPlans.map(w => ({
          a: w.name,
          b: w.window ? w.window.replace(' 2026', '') : 'No window set',
          pct: `${(w.ready[0] / w.servers.length) * 100}%`,
          pc: 'var(--ok)',
          c: `${w.ready[0]} of ${w.servers.length} ready`,
          d: w.mapping.split(' → ')[1],
          lock: '',
          enc: ''
        }))
      };
      issues = issues.concat([
        {
          i: 'triangle-alert',
          c: 'var(--warn)',
          title: 'No mapping: citrix-sf-01',
          detail: 'Set a mapping before the first pass.',
          href: '#/mig/servers?open=citrix-sf-01'
        },
        {
          i: 'clock',
          c: 'var(--warn)',
          title: 'Commit pending: print-srv-02',
          detail: 'Cut over 21 Oct, 11:20 IST. Commit or roll back.',
          href: '#/mig/servers?open=print-srv-02'
        }
      ]);
    }
    tiles = tiles.map((t, i) => ({ ...t, bl: i ? 'var(--ln)' : 'transparent' }));
    const empty = ui === 'empty';
    return {
      section: ctx.section,
      sub: ctx.sub,
      updated: loading ? 'Reading…' : 'Updated 21 Oct 2026, 16:05 IST',
      isUnreach: unreach,
      isEmpty: empty,
      showData: !empty,
      tileN: String(tiles.length),
      tiles,
      emptyText: {
        backup: 'Nothing is protected yet. Connect a Proxmox VE or OpenStack site, then assign a policy to its guests.',
        dr: 'No servers are protected yet. Create a protection plan and assign servers to it.',
        mig: 'No VMware source is connected yet. Add a source platform to see its virtual machines.'
      }[p],
      emptyAction: { backup: 'Add a platform', dr: 'Create a protection plan', mig: 'Add source platform' }[p],
      onEmpty: () => ctx.go(p === 'dr' ? 'dr/plans' : 'sites'),
      isBackup: p === 'backup',
      isDr: p === 'dr',
      isMig: p === 'mig',
      chart: [],
      plans: [],
      stages: [],
      ...left,
      ...bottom,
      issues: unreach ? [] : issues,
      noIssues: unreach || !issues.length,
      issueCount: unreach ? 'Not read' : `${issues.length} open`
    };
  }

  render() {
    const v = this.vals();
    return (
      <div style={{ height: '100%', minHeight: 0, overflow: 'auto', animation: 'ae-page 150ms var(--ease)' }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>{v.section}</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Overview</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>{v.sub}</p>
          </div>
          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.updated}</span>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {v.isUnreach ? (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minHeight: '40px',
                padding: '0 12px',
                background: 'var(--warn-s)',
                border: '1px solid var(--ln-2)'
              }}
            >
              <Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />
              Could not be read: the orchestrator did not answer within 30 s. Figures are hidden until they can be read.
            </div>
          ) : null}
          {v.isEmpty ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '80px 24px',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                textAlign: 'center'
              }}
            >
              <p style={{ color: 'var(--tx-2)', maxWidth: '460px' }}>{v.emptyText}</p>
              <button
                onClick={v.onEmpty}
                style={{ height: '32px', padding: '0 14px', background: 'var(--acc)', color: 'var(--acc-ink)', fontWeight: 600 }}
                className={pc('hover', 'background:var(--acc-h)')}
              >
                {v.emptyAction}
              </button>
            </div>
          ) : null}
          {v.showData ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${v.tileN},minmax(0,1fr))`,
                  background: 'var(--panel)',
                  border: '1px solid var(--ln)'
                }}
              >
                {arr(v.tiles).map((k: any, i: number) => (
                  <a
                    key={i}
                    href={k.href}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '16px 18px',
                      borderLeft: `1px solid ${k.bl}`,
                      minWidth: 0,
                      transition: 'background-color 100ms'
                    }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}
                    >
                      <Icon name={k.i} style={{ color: k.ic }} />
                      {k.label}
                    </span>
                    {k.loading ? <span style={{ display: 'block', height: '28px', width: '60%', background: 'var(--skel)' }} /> : null}
                    {k.ready ? (
                      <span
                        style={{
                          font: '500 28px/36px var(--f-head)',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                          fontStyle: k.fs,
                          color: k.vc
                        }}
                      >
                        {k.value}
                        <span style={{ font: '400 15px var(--f-body)', color: 'var(--tx-2)', marginLeft: '6px' }}>{k.unit}</span>
                      </span>
                    ) : null}
                    <span
                      style={{
                        font: '12px/16px var(--f-ui)',
                        color: 'var(--tx-3)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {k.sub}
                    </span>
                    {k.hasSegs ? (
                      <span style={{ display: 'flex', height: '6px', gap: '1px', marginTop: '2px' }}>
                        {arr(k.segs).map((sg: any, j: number) => (
                          <span key={j} style={{ height: '6px', width: sg.w, background: sg.c }} />
                        ))}
                      </span>
                    ) : null}
                  </a>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: '16px', alignItems: 'start' }}>
                <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: '44px',
                      padding: '0 16px',
                      borderBottom: '1px solid var(--ln)'
                    }}
                  >
                    <h2 style={{ font: '600 15px/22px var(--f-body)' }}>{v.leftTitle}</h2>
                    <a
                      href={v.leftHref}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', font: '600 13px var(--f-body)', color: 'var(--acc-tx)' }}
                    >
                      {v.leftLink}
                      <Icon name="arrow-right" />
                    </a>
                  </div>
                  {v.isBackup ? (
                    <div style={{ padding: '16px' }}>
                      <div
                        role="img"
                        aria-label={v.chartLabel}
                        style={{
                          height: '140px',
                          display: 'flex',
                          alignItems: 'flex-end',
                          gap: '3px',
                          borderBottom: '1px solid var(--ln)'
                        }}
                      >
                        {arr(v.chart).map((b: any, i: number) => (
                          <span
                            key={i}
                            data-tip={b.tip}
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column-reverse',
                              height: '100%',
                              justifyContent: 'flex-start'
                            }}
                          >
                            <span style={{ height: b.ok, background: 'var(--tx-3)', opacity: 0.55 }} />
                            <span style={{ height: b.warn, background: 'var(--warn)' }} />
                            <span style={{ height: b.err, background: 'var(--err)' }} />
                          </span>
                        ))}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '6px',
                          font: '11px/16px var(--f-ui)',
                          color: 'var(--tx-3)'
                        }}
                      >
                        <span>16:00 yesterday</span>
                        <span>00:00</span>
                        <span>08:00</span>
                        <span>Now (IST)</span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon name="circle-check" style={{ color: 'var(--ok)' }} />
                          405 succeeded
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />6 warnings
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon name="circle-x" style={{ color: 'var(--err)' }} />1 failed
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {v.isDr ? (
                    <div role="table" style={{ font: '13px/18px var(--f-ui)' }}>
                      {arr(v.plans).map((p: any, i: number) => (
                        <a
                          key={i}
                          href={p.href}
                          role="row"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1.3fr)',
                            gap: '12px',
                            alignItems: 'center',
                            minHeight: '44px',
                            padding: '0 16px',
                            borderBottom: '1px solid var(--ln)',
                            transition: 'background-color 100ms'
                          }}
                          className={pc('hover', 'background:var(--hover)')}
                        >
                          <span style={{ fontWeight: 700 }}>{p.name}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Icon name={p.ri} style={{ color: p.rc }} />
                            {p.ready}
                          </span>
                          <span style={{ color: 'var(--tx-2)' }}>{p.test}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {v.isMig ? (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', border: '1px solid var(--ln)' }}>
                        {arr(v.stages).map((st: any, i: number) => (
                          <a
                            key={i}
                            href="#/mig/servers"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              padding: '12px',
                              borderLeft: `1px solid ${st.bl}`,
                              transition: 'background-color 100ms'
                            }}
                            className={pc('hover', 'background:var(--hover)')}
                          >
                            <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>{st.label}</span>
                            <span style={{ font: '500 24px/32px var(--f-head)', fontVariantNumeric: 'tabular-nums' }}>{st.n}</span>
                            <span style={{ height: '3px', background: st.c }} />
                          </a>
                        ))}
                      </div>
                      <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
                        Servers by stage, left to right. Rolled-back servers count under Not started.
                      </p>
                    </div>
                  ) : null}
                </section>
                <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: '44px',
                      padding: '0 16px',
                      borderBottom: '1px solid var(--ln)'
                    }}
                  >
                    <h2 style={{ font: '600 15px/22px var(--f-body)' }}>Current issues</h2>
                    <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.issueCount}</span>
                  </div>
                  {arr(v.issues).map((is: any, i: number) => (
                    <a
                      key={i}
                      href={is.href}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px minmax(0,1fr)',
                        gap: '10px',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--ln)',
                        transition: 'background-color 100ms'
                      }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      <Icon name={is.i} style={{ color: is.c, marginTop: '2px' }} />
                      <span>
                        <span style={{ display: 'block', fontWeight: 600 }}>{is.title}</span>
                        <span style={{ display: 'block', fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{is.detail}</span>
                      </span>
                    </a>
                  ))}
                  {v.noIssues ? <p style={{ padding: '16px', color: 'var(--tx-2)' }}>No issues right now.</p> : null}
                </section>
              </div>
              <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '44px',
                    padding: '0 16px',
                    borderBottom: '1px solid var(--ln)'
                  }}
                >
                  <h2 style={{ font: '600 15px/22px var(--f-body)' }}>{v.bottomTitle}</h2>
                  <a
                    href={v.bottomHref}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', font: '600 13px var(--f-body)', color: 'var(--acc-tx)' }}
                  >
                    {v.bottomLink}
                    <Icon name="arrow-right" />
                  </a>
                </div>
                <div role="table" style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums' }}>
                  {arr(v.bottom).map((r: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(160px,1.6fr) minmax(0,1.1fr) 40px',
                        gap: '12px',
                        alignItems: 'center',
                        minHeight: '40px',
                        padding: '0 16px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                        <Icon name="database" style={{ color: 'var(--tx-3)' }} />
                        {r.a}
                      </span>
                      <span style={{ color: 'var(--tx-2)' }}>{r.b}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ flex: 1, height: '6px', background: 'var(--ln)' }}>
                          <span style={{ display: 'block', height: '6px', width: r.pct, background: r.pc }} />
                        </span>
                        <span style={{ whiteSpace: 'nowrap', color: 'var(--tx-2)' }}>{r.c}</span>
                      </span>
                      <span style={{ textAlign: 'right' }}>{r.d}</span>
                      <span style={{ display: 'flex', gap: '4px', color: 'var(--tx-2)' }}>
                        <Icon name={r.lock} data-tip="Immutable (WORM)" />
                        <Icon name={r.enc} data-tip="Encrypted" />
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    );
  }
}
