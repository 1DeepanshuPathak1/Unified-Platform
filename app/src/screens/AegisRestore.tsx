/* Ported from project/AegisRestore.dc.html */
import React, { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
const TREE_L = {
  '/': [
    ['etc', 'd'],
    ['home', 'd'],
    ['srv', 'd'],
    ['var', 'd']
  ],
  '/srv': [
    ['www', 'd'],
    ['invoices', 'd'],
    ['backup.sh', 'f', '2.10 KB']
  ],
  '/srv/invoices': [
    ['2026-09', 'd'],
    ['2026-10', 'd'],
    ['index.csv', 'f', '412.00 KB']
  ],
  '/srv/invoices/2026-10': [
    ['INV-10231.pdf', 'f', '182.40 KB'],
    ['INV-10232.pdf', 'f', '176.10 KB'],
    ['INV-10233.pdf', 'f', '201.90 KB']
  ],
  '/etc': [
    ['nginx', 'd'],
    ['hosts', 'f', '0.40 KB']
  ],
  '/home': [['deploy', 'd']],
  '/var': [['log', 'd']]
};
const TREE_W = {
  '/': [
    ['C:', 'd'],
    ['D:', 'd']
  ],
  '/C:': [
    ['Users', 'd'],
    ['inetpub', 'd'],
    ['ProgramData', 'd']
  ],
  '/D:': [
    ['Shares', 'd'],
    ['SQLBackup', 'd']
  ],
  '/D:/Shares': [
    ['Finance', 'd'],
    ['HR', 'd']
  ],
  '/D:/Shares/Finance': [
    ['Q3-close.xlsx', 'f', '2.40 MB'],
    ['Invoices-Oct.zip', 'f', '48.20 MB']
  ]
};
export default class AegisRestore extends DC {
  state: any = {
    guest: 'web-frontend-01',
    point: 0,
    kind: 'Files',
    target: 'orig',
    site: 'Chennai_Lab_Proxmox',
    path: '/',
    picked: {},
    disks: {},
    jobId: null
  };
  logRef = React.createRef<any>();
  componentDidMount() {
    const c = this.props.ctx;
    if (c && c.openId) {
      const [g, t] = c.openId.split('|');
      const G = AEGIS && AEGIS.guests.find(x => x.id === g);
      if (G) this.setState({ guest: G.name, kind: 'Whole VM', point: 0, pointT: t || null });
    }
  }
  componentDidUpdate() {
    const el = this.logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }
  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    if (!A || !ctx)
      return {
        guests: [],
        points: [],
        kinds: [],
        disks: [],
        crumbs: [],
        files: [],
        targets: [],
        siteFields: [],
        summary: [],
        job: { log: [] }
      };
    const s = this.state;
    const rs = ctx.can('restore', 'Restoring');
    const g = A.guests.find(x => x.name === s.guest);
    const pol = A.policies.find(p => p.name === g.policy);
    const base = /(\d+) (\w+) (\d+), (\d+):(\d+)/.exec(g.last.t);
    const lastD = new Date(+base[3], MON.indexOf(base[2]), +base[1], +base[4], +base[5]);
    const step = pol.schedule.startsWith('Every hour') ? 36e5 : pol.schedule.startsWith('Sundays') ? 6048e5 : 864e5;
    const off = g.last.r === 'err' ? 1 : 0;
    const pts = Array.from({ length: Math.min(8, g.points) }, (_, i) => {
      const d = new Date(lastD.getTime() - (i + off) * step);
      return {
        t: `${pad(d.getDate())} ${MON[d.getMonth()]} 2026, ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        type: i === Math.min(8, g.points) - 1 ? 'Full' : 'Incremental',
        size: `${(g.size * (i === 7 ? 0.23 : 0.02 + i * 0.003)).toFixed(2)} GB`
      };
    });
    let pIdx = s.point;
    if (s.pointT) {
      const k = pts.findIndex(p => p.t === s.pointT);
      if (k >= 0) pIdx = k;
    }
    const win = /Windows/.test(g.os);
    const tree = win ? TREE_W : TREE_L;
    const entries = tree[s.path] || [];
    const crumbParts = s.path === '/' ? [] : s.path.slice(1).split('/');
    const crossSite = s.target === 'site';
    const refused = s.kind === 'Files' && crossSite;
    const pickedN = Object.values(s.picked).filter(Boolean).length;
    const diskN = g.disks.filter(([n]) => s.disks[n] !== false).length;
    const job = s.jobId && ctx.jobs.find(j => j.id === s.jobId);
    const canStart =
      rs.ok && !refused && !(s.kind === 'Files' && !pickedN) && !(s.kind === 'Disks' && !diskN) && !(job && job.status === 'run');
    const why = !rs.ok
      ? rs.why
      : refused
        ? 'Files go only into the VM their recovery point came from.'
        : s.kind === 'Files' && !pickedN
          ? 'Select files or folders first.'
          : s.kind === 'Disks' && !diskN
            ? 'Select at least one disk.'
            : job && job.status === 'run'
              ? 'A restore is already running.'
              : undefined;
    const radio = on => ({
      bd: on ? 'var(--acc)' : 'var(--ln)',
      bg: on ? 'var(--acc-soft)' : 'transparent',
      rbd: on ? 'var(--acc)' : 'var(--ln-2)',
      rin: on ? 'var(--panel)' : 'transparent',
      rbg: on ? 'var(--acc)' : 'transparent'
    });
    const targets = [
      {
        id: 'orig',
        label: s.kind === 'Files' ? `Into ${g.name}, original folders` : 'Original location',
        desc:
          s.kind === 'Files'
            ? 'Existing files with the same name are renamed with a .restored suffix.'
            : `Replaces ${g.name} on ${g.site}. The current VM is powered off first.`
      },
      {
        id: 'new',
        label: s.kind === 'Files' ? `Into ${g.name}, a new folder` : `${g.site}, as a new VM`,
        desc:
          s.kind === 'Files'
            ? 'Files land in /aegis-restore-2026-10-21 inside the VM.'
            : `Creates ${g.name}-restored next to the original. Nothing is overwritten.`
      },
      {
        id: 'site',
        label: 'Another site',
        desc: 'Restores across platforms, for example from Proxmox VE to OpenStack. Choose the target site below.'
      }
    ].map(t => ({ ...t, on: s.target === t.id, ...radio(s.target === t.id), onClick: () => this.setState({ target: t.id }) }));
    const siteOpts = A.sites.filter(x => !x.vmw && x.name !== g.site && x.status === 'ok').map(x => x.name);
    const isOs = s.site.includes('openstack');
    const targetLabel =
      s.kind === 'Files'
        ? s.target === 'orig'
          ? `${g.name}, original folders`
          : s.target === 'new'
            ? `${g.name}, /aegis-restore-2026-10-21`
            : `Another site (${s.site})`
        : s.target === 'orig'
          ? `${g.name} on ${g.site} (replaced)`
          : s.target === 'new'
            ? `${g.name}-restored on ${g.site}`
            : `${g.name} on ${s.site}${s.site.includes('openstack') !== g.site.includes('openstack') ? ', converted' : ''}`;
    return {
      guests: A.guests.map(x => ({ v: x.name, sel: x.name === s.guest })),
      guest: s.guest,
      setGuest: e => this.setState({ guest: e.target.value, point: 0, pointT: null, path: '/', picked: {}, disks: {} }),
      points: pts.map((p, i) => ({
        ...p,
        on: i === pIdx,
        ...radio(i === pIdx),
        bg: i === pIdx ? 'var(--acc-soft)' : 'transparent',
        lockI: pol.lock ? 'lock' : '',
        lockTip: pol.lock ? `${pol.lock} mode` : undefined,
        encI: pol.enc ? 'shield' : '',
        repo: pol.dest,
        onClick: () => this.setState({ point: i, pointT: null })
      })),
      kinds: [
        ['Whole VM', 'monitor'],
        ['Disks', 'hard-drive'],
        ['Files', 'folder']
      ].map(([label, icon]) => ({
        label,
        icon,
        on: s.kind === label,
        fg: s.kind === label ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState({ kind: label })
      })),
      isVm: s.kind === 'Whole VM',
      isDisks: s.kind === 'Disks',
      isFiles: s.kind === 'Files',
      vmLine: `All ${g.disks.length} ${g.disks.length === 1 ? 'disk' : 'disks'} (${g.size.toFixed(2)} GB) and the VM’s configuration: ${g.os}, its network cards and its boot order.`,
      disks: g.disks.map(([name, size, storage]) => {
        const on = s.disks[name] !== false;
        return {
          name,
          size: `${size.toFixed(2)} GB`,
          storage,
          on,
          bg: on ? 'var(--acc-soft)' : 'transparent',
          bd: on ? 'var(--acc)' : 'var(--ln-2)',
          cbg: on ? 'var(--acc)' : 'transparent',
          icon: on ? 'check' : '',
          onClick: () => this.setState(st => ({ disks: { ...st.disks, [name]: !on } }))
        };
      }),
      crumbs: [
        {
          label: g.name,
          fg: crumbParts.length ? 'var(--tx-2)' : 'var(--tx)',
          sep: crumbParts.length ? 'chevron-right' : '',
          onClick: () => this.setState({ path: '/' })
        }
      ].concat(
        crumbParts.map((c, i) => ({
          label: c,
          fg: i === crumbParts.length - 1 ? 'var(--tx)' : 'var(--tx-2)',
          sep: i < crumbParts.length - 1 ? 'chevron-right' : '',
          onClick: () => this.setState({ path: '/' + crumbParts.slice(0, i + 1).join('/') })
        }))
      ),
      files: entries.map(([name, t, size]) => {
        const full = (s.path === '/' ? '' : s.path) + '/' + name;
        const on = !!s.picked[full];
        return {
          name,
          icon: t === 'd' ? 'folder' : 'file',
          size: size || '',
          mod: '18 Oct 2026, 22:40',
          on,
          bg: on ? 'var(--acc-soft)' : 'transparent',
          bd: on ? 'var(--acc)' : 'var(--ln-2)',
          cbg: on ? 'var(--acc)' : 'transparent',
          icon2: on ? 'check' : '',
          nc: t === 'd' ? 'var(--tx)' : 'var(--tx-2)',
          onToggle: () => this.setState(st => ({ picked: { ...st.picked, [full]: !on } })),
          onOpen: () => {
            if (t === 'd' && tree[full]) this.setState({ path: full });
          }
        };
      }),
      targets,
      showSite: crossSite && s.kind !== 'Files',
      siteFields: [
        { label: 'Target site', value: s.site, options: siteOpts, onChange: e => this.setState({ site: e.target.value }) },
        {
          label: isOs ? 'Flavor' : 'Cores and memory',
          value: isOs ? 'm1.large' : '4 cores, 8192 MB',
          options: isOs ? ['m1.large', 'm1.xlarge'] : ['4 cores, 8192 MB', '8 cores, 16384 MB'],
          onChange: () => {}
        },
        {
          label: 'Network',
          value: isOs ? 'prod-net' : 'vmbr0',
          options: isOs ? ['prod-net', 'dr-test-isolated'] : ['vmbr0', 'vmbr99'],
          onChange: () => {}
        }
      ],
      refused,
      refusal: ` Files can be restored only into the VM their recovery point came from: ${g.name} on ${g.site}. To get these files onto another site, restore the whole VM there first, then copy the files.`,
      summary: [
        ['Guest', `${g.name} · ${g.os}`],
        ['Point', `${pts[pIdx].t} IST`],
        [
          'Restore',
          s.kind === 'Files'
            ? `${pickedN} ${pickedN === 1 ? 'item' : 'items'}`
            : s.kind === 'Disks'
              ? `${diskN} of ${g.disks.length} disks`
              : 'Whole VM'
        ],
        ['To', targetLabel],
        ['From', `${pol.dest}${pol.lock ? ', immutable' : ''}${pol.enc ? ', encrypted' : ''}`]
      ].map(([k, v]) => ({ k, v })),
      startDis: canStart ? undefined : 'true',
      startWhy: canStart ? undefined : why,
      startOp: canStart ? 1 : 0.45,
      startLabel: `Restore ${s.kind === 'Whole VM' ? 'VM' : s.kind.toLowerCase()}`,
      roleBlocked: !rs.ok,
      start: () => {
        if (!canStart) return;
        const id = ctx.startJob({
          name: `Restore ${s.kind.toLowerCase()}`,
          object: g.name,
          product: 'Backup',
          type: 'Restore',
          phases: [
            'Queued',
            'Mount point',
            s.kind === 'Files' ? 'Copy files' : 'Write disks',
            s.kind === 'Whole VM' ? 'Register VM' : 'Check',
            'Done'
          ],
          speed: 14,
          rate: '220 MB/s',
          firstLine: `Restore of ${g.name} from ${pts[pIdx].t} started`,
          doneToast: `Restore of ${g.name} finished`
        });
        this.setState({ jobId: id });
        ctx.toast(`Restore of ${g.name} started`, 'info');
      },
      job: job
        ? {
            on: true,
            i: job.status === 'run' ? 'loader-circle' : 'circle-check',
            spin: job.status === 'run' ? 'true' : 'false',
            c: job.status === 'run' ? 'var(--run)' : 'var(--ok)',
            phase: job.status === 'run' ? job.phases[job.phase] : 'Finished',
            pct: `${Math.floor(job.pct)} %`,
            w: `${job.pct}%`,
            log: job.log
          }
        : { on: false, log: [] },
      logRef: this.logRef
    };
  }

  render() {
    const v = this.vals();
    return (
      <div style={{ height: '100%', minHeight: 0, overflow: 'auto', animation: 'ae-page 150ms var(--ease)' }}>
        <div style={{ padding: '20px 24px 16px' }}>
          <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>{'Backup & Recovery'}</div>
          <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Restore</h1>
          <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>Bring back a whole VM, single disks or files from a recovery point.</p>
        </div>
        <div
          style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: '16px', alignItems: 'start' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  height: '48px',
                  padding: '0 16px',
                  borderBottom: '1px solid var(--ln)'
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid var(--acc)',
                    color: 'var(--acc-tx)',
                    font: '700 11px var(--f-ui)'
                  }}
                >
                  1
                </span>
                <h2 style={{ flex: 1, font: '600 15px/22px var(--f-body)' }}>Recovery point</h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>
                  Guest
                  <select
                    value={v.guest}
                    onChange={v.setGuest}
                    style={{
                      height: '32px',
                      padding: '0 8px',
                      background: 'var(--panel-2)',
                      border: '1px solid var(--ln)',
                      font: '14px var(--f-body)',
                      color: 'var(--tx)'
                    }}
                  >
                    {arr(v.guests).map((g: any, i: number) => (
                      <option key={i} value={g.v ?? ''}>
                        {g.v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div role="radiogroup" aria-label="Recovery point" style={{ maxHeight: '260px', overflow: 'auto' }}>
                {arr(v.points).map((p: any, i: number) => (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={p.on}
                    onClick={p.onClick}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '16px minmax(0,1.3fr) 110px 90px minmax(0,1fr)',
                      gap: '12px',
                      alignItems: 'center',
                      width: '100%',
                      height: '40px',
                      padding: '0 16px',
                      borderBottom: '1px solid var(--ln)',
                      background: p.bg,
                      font: '13px var(--f-ui)',
                      textAlign: 'left',
                      transition: 'background-color 100ms'
                    }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: `1px solid ${p.rbd}`,
                        boxShadow: `inset 0 0 0 4px ${p.rin}`,
                        background: p.rbg,
                        transition: 'all 100ms'
                      }}
                    />
                    <span>{p.t}</span>
                    <span style={{ color: 'var(--tx-2)' }}>{p.type}</span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.size}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tx-2)' }}>
                      <Icon name={p.lockI} data-tip={p.lockTip} />
                      <Icon name={p.encI} data-tip="Encrypted with AES-256" />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.repo}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  height: '48px',
                  padding: '0 16px',
                  borderBottom: '1px solid var(--ln)'
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid var(--acc)',
                    color: 'var(--acc-tx)',
                    font: '700 11px var(--f-ui)'
                  }}
                >
                  2
                </span>
                <h2 style={{ flex: 1, font: '600 15px/22px var(--f-body)' }}>What to restore</h2>
                <Ind mode="fill" role="radiogroup" aria-label="Restore type" style={{ display: 'flex', border: '1px solid var(--ln-2)' }}>
                  {arr(v.kinds).map((k: any, i: number) => (
                    <button
                      key={i}
                      role="radio"
                      aria-checked={k.on}
                      onClick={k.onClick}
                      style={{
                        height: '30px',
                        padding: '0 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        font: '13px var(--f-ui)',
                        color: k.fg,
                        transition: 'color 100ms'
                      }}
                    >
                      <Icon name={k.icon} />
                      {k.label}
                    </button>
                  ))}
                </Ind>
              </div>
              {v.isVm ? <p style={{ padding: '16px', color: 'var(--tx-2)', animation: 'ae-fade 150ms var(--ease)' }}>{v.vmLine}</p> : null}
              {v.isDisks ? (
                <div style={{ animation: 'ae-fade 150ms var(--ease)' }}>
                  {arr(v.disks).map((d: any, i: number) => (
                    <button
                      key={i}
                      role="checkbox"
                      aria-checked={d.on}
                      onClick={d.onClick}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '16px 96px 96px minmax(0,1fr)',
                        gap: '12px',
                        alignItems: 'center',
                        width: '100%',
                        height: '40px',
                        padding: '0 16px',
                        borderBottom: '1px solid var(--ln)',
                        font: '13px var(--f-ui)',
                        background: d.bg
                      }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      <span
                        style={{
                          width: '16px',
                          height: '16px',
                          display: 'grid',
                          placeItems: 'center',
                          border: `1px solid ${d.bd}`,
                          background: d.cbg,
                          color: 'var(--acc-ink)'
                        }}
                      >
                        <Icon name={d.icon} size="12" />
                      </span>
                      <span style={{ textAlign: 'left' }}>{d.name}</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.size}</span>
                      <span style={{ color: 'var(--tx-2)', textAlign: 'left' }}>{d.storage}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {v.isFiles ? (
                <div style={{ animation: 'ae-fade 150ms var(--ease)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '40px',
                      padding: '0 16px',
                      borderBottom: '1px solid var(--ln)',
                      font: '13px var(--f-ui)',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <Icon name="hard-drive" style={{ color: 'var(--tx-3)' }} />
                    {arr(v.crumbs).map((c: any, i: number) => (
                      <Fragment key={i}>
                        <button onClick={c.onClick} style={{ padding: '0 4px', color: c.fg }} className={pc('hover', 'color:var(--tx)')}>
                          {c.label}
                        </button>
                        <Icon name={c.sep} style={{ color: 'var(--tx-3)' }} />
                      </Fragment>
                    ))}
                  </div>
                  {arr(v.files).map((f: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '16px 20px minmax(0,1fr) 96px 140px',
                        gap: '12px',
                        alignItems: 'center',
                        height: '36px',
                        padding: '0 16px',
                        borderBottom: '1px solid var(--ln)',
                        font: '13px var(--f-ui)',
                        background: f.bg
                      }}
                    >
                      <button
                        role="checkbox"
                        aria-checked={f.on}
                        aria-label={`Select ${f.name ?? ''}`}
                        onClick={f.onToggle}
                        style={{
                          width: '16px',
                          height: '16px',
                          display: 'grid',
                          placeItems: 'center',
                          border: `1px solid ${f.bd}`,
                          background: f.cbg,
                          color: 'var(--acc-ink)'
                        }}
                      >
                        <Icon name={f.icon2} size="12" />
                      </button>
                      <Icon name={f.icon} style={{ color: 'var(--tx-3)' }} />
                      <button
                        onClick={f.onOpen}
                        style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: f.nc }}
                        className={pc('hover', 'color:var(--acc-tx)')}
                      >
                        {f.name}
                      </button>
                      <span style={{ textAlign: 'right', color: 'var(--tx-2)', fontVariantNumeric: 'tabular-nums' }}>{f.size}</span>
                      <span style={{ color: 'var(--tx-3)' }}>{f.mod}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
            <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  height: '48px',
                  padding: '0 16px',
                  borderBottom: '1px solid var(--ln)'
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid var(--acc)',
                    color: 'var(--acc-tx)',
                    font: '700 11px var(--f-ui)'
                  }}
                >
                  3
                </span>
                <h2 style={{ flex: 1, font: '600 15px/22px var(--f-body)' }}>Where to</h2>
              </div>
              <div
                role="radiogroup"
                aria-label="Target"
                style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {arr(v.targets).map((t: any, i: number) => (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={t.on}
                    onClick={t.onClick}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '16px minmax(0,1fr)',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '10px 14px',
                      border: `1px solid ${t.bd}`,
                      background: t.bg,
                      textAlign: 'left',
                      transition: 'border-color 100ms,background-color 100ms'
                    }}
                  >
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: `1px solid ${t.rbd}`,
                        boxShadow: `inset 0 0 0 4px ${t.rin}`,
                        background: t.rbg
                      }}
                    />
                    <span>
                      <span style={{ display: 'block', fontWeight: 600 }}>{t.label}</span>
                      <span style={{ display: 'block', fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{t.desc}</span>
                    </span>
                  </button>
                ))}
                {v.showSite ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                      gap: '12px',
                      padding: '4px 0 0 28px',
                      animation: 'ae-fade 150ms var(--ease)'
                    }}
                  >
                    {arr(v.siteFields).map((f: any, i: number) => (
                      <label
                        key={i}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          font: '12px/16px var(--f-ui)',
                          color: 'var(--tx-2)'
                        }}
                      >
                        {f.label}
                        <select
                          value={f.value ?? ''}
                          onChange={f.onChange}
                          style={{
                            height: '36px',
                            padding: '0 8px',
                            background: 'var(--panel-2)',
                            border: '1px solid var(--ln)',
                            font: '14px var(--f-body)',
                            color: 'var(--tx)'
                          }}
                        >
                          {arr(f.options).map((o: any, j: number) => (
                            <option key={j} value={o ?? ''}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                ) : null}
                {v.refused ? (
                  <div
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px',
                      background: 'var(--err-s)',
                      border: '1px solid var(--ln-2)',
                      animation: 'ae-fade 150ms var(--ease)'
                    }}
                  >
                    <Icon name="ban" style={{ color: 'var(--err)', marginTop: '2px' }} />
                    <span>
                      <strong style={{ display: 'block', fontWeight: 600 }}>File restore is not possible here</strong>
                      {v.refusal}
                    </span>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
          <aside style={{ position: 'sticky', top: 0, background: 'var(--panel)', border: '1px solid var(--ln)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ln)' }}>
              <h2 style={{ font: '600 15px/22px var(--f-body)' }}>Summary</h2>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr)', padding: '0 16px', font: '13px/18px var(--f-ui)' }}>
              {arr(v.summary).map((s: any, i: number) => (
                <Fragment key={i}>
                  <dt style={{ padding: '8px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{s.k}</dt>
                  <dd style={{ padding: '8px 0', borderBottom: '1px solid var(--ln)', overflowWrap: 'anywhere' }}>{s.v}</dd>
                </Fragment>
              ))}
            </dl>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={v.start}
                aria-disabled={v.startDis}
                data-tip={v.startWhy}
                style={{
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'var(--acc)',
                  color: 'var(--acc-ink)',
                  fontWeight: 600,
                  opacity: v.startOp,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--acc-h)')}
              >
                <Icon name="rotate-ccw" />
                {v.startLabel}
              </button>
              {v.roleBlocked ? (
                <a href="#/backup/access" style={{ font: '600 13px var(--f-body)', color: 'var(--acc-tx)' }}>
                  Request a restore exception
                </a>
              ) : null}
              {v.job?.on ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'ae-fade 150ms var(--ease)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '13px var(--f-ui)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name={v.job?.i} spin={v.job?.spin} style={{ color: v.job?.c }} />
                      {v.job?.phase}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.job?.pct}</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--ln)' }}>
                    <div style={{ height: '4px', width: v.job?.w, background: v.job?.c, transition: 'width 900ms linear' }} />
                  </div>
                  <div
                    ref={v.logRef}
                    role="log"
                    aria-label="Restore log"
                    style={{
                      maxHeight: '160px',
                      overflow: 'auto',
                      padding: '6px 10px',
                      background: 'var(--panel-2)',
                      border: '1px solid var(--ln)',
                      font: '12px/20px var(--f-ui)'
                    }}
                  >
                    {arr(v.job?.log).map((l: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '60px minmax(0,1fr)',
                          gap: '8px',
                          animation: 'ae-line 150ms var(--ease)'
                        }}
                      >
                        <span style={{ color: 'var(--tx-3)' }}>{l.t}</span>
                        <span>{l.text}</span>
                      </div>
                    ))}
                  </div>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
                    The restore keeps running if you leave this page. It is listed under running jobs.
                  </span>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    );
  }
}
