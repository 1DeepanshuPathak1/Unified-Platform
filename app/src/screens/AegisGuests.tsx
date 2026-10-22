/* Ported from project/AegisGuests.dc.html */
import { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';
import AegisTable from '../components/AegisTable';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
const parseT = s => {
  const m = /(\d+) (\w+) (\d+), (\d+):(\d+)/.exec(s || '');
  return m ? new Date(+m[3], MON.indexOf(m[2]), +m[1], +m[4], +m[5]) : null;
};
const fmt = d => `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const short = s => {
  const d = parseT(s);
  return d ? `${pad(d.getDate())} ${MON[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
};
const RES = {
  ok: ['circle-check', 'Succeeded', 'ok'],
  warn: ['triangle-alert', 'Warning', 'warn'],
  err: ['circle-x', 'Failed', 'err'],
  run: ['loader-circle', 'Running', 'run']
};
const SC = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', run: 'var(--run)' };
const CBT = { On: ['circle-check', 'ok'], Off: ['circle-minus', 'tx'], 'Reset pending': ['triangle-alert', 'warn'] };
const CONS_HINT = {
  Application: 'Guest agent freezes applications before the snapshot. Needs the QEMU guest agent or VSS.',
  Crash: 'The disk is captured as if the power was cut. Fastest; applications recover on boot.',
  Offline: 'The guest is shut down for the backup and started again afterwards.'
};

export default class AegisGuests extends DC {
  state: any = {
    site: 'All',
    q: '',
    sel: {},
    drawer: null,
    closing: false,
    tab: 'Overview',
    ap: null,
    apPick: 'Production daily',
    over: {},
    running: {},
    disksOff: {},
    cons: {}
  };

  componentDidMount() {
    this.checkOpen();
  }
  componentDidUpdate(pp) {
    if (pp.ctx && this.props.ctx && pp.ctx.nonce !== this.props.ctx.nonce) this.checkOpen();
  }
  checkOpen() {
    const c = this.props.ctx;
    if (c && c.openId) this.setState({ drawer: c.openId, closing: false, tab: 'Overview' });
  }
  closeDrawer() {
    this.setState({ closing: true });
    setTimeout(() => this.setState({ drawer: null, closing: false }), 150);
  }

  guests() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    return A.guests.map(g => {
      const o = this.state.over[g.id] || {};
      const live = this.state.running[g.id] && ctx.jobs.find(j => j.id === this.state.running[g.id]);
      let last = g.last;
      if (live) last = live.status === 'run' ? { r: 'run', t: live.started.replace(' IST', '') + ' IST' } : { r: 'ok', t: ctx.now() };
      return { ...g, ...o, last, live };
    });
  }

  backup(ids) {
    const ctx = this.props.ctx;
    const map = {};
    this.guests()
      .filter(g => ids.includes(g.id))
      .forEach(g => {
        map[g.id] = ctx.startJob({
          name: 'Back up now',
          object: g.name,
          product: 'Backup',
          type: 'Backup',
          phases: ['Queued', 'Snapshot', 'Read changes', 'Write', 'Verify', 'Done'],
          speed: 9 + Math.random() * 5,
          rate: `${120 + Math.round(Math.random() * 90)} MB/s`,
          doneToast: `Backup of ${g.name} finished`
        });
      });
    this.setState(s => ({ running: { ...s.running, ...map } }));
    ctx.toast(
      ids.length === 1 ? `Backup of ${this.guests().find(g => g.id === ids[0]).name} started` : `Backups of ${ids.length} guests started`,
      'info',
      { label: 'Open Jobs', run: () => ctx.go('jobs') }
    );
  }

  points(g) {
    const A = AEGIS;
    const pol = A.policies.find(p => p.name === g.policy) || A.policies[0];
    const last = parseT(g.last.r === 'run' ? A.guests.find(x => x.id === g.id).last.t : g.last.t) || new Date(2026, 9, 21, 2, 0);
    const step = pol.schedule.startsWith('Every hour') ? 3600e3 : pol.schedule.startsWith('Sundays') ? 7 * 864e5 : 864e5;
    const now = new Date(2026, 9, 21, 16, 5);
    const n = Math.min(12, g.points);
    const off = A.guests.find(x => x.id === g.id).last.r === 'err' ? 1 : 0;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(last.getTime() - (i + off) * step);
      const gfs = step >= 864e5 && d.getDay() === 0 ? 'Weekly' : d.getDate() === 1 ? 'Monthly' : '—';
      const until = new Date(d.getTime() + (pol.lockDays || 0) * 864e5);
      const locked = pol.lock && until > now;
      const full = i === n - 1;
      const sz = full ? g.size / 4.4 : g.size * (0.012 + ((i * 7) % 5) / 400);
      return {
        t: fmt(d),
        type: full ? 'Full' : 'Incremental',
        gfs,
        size: `${sz.toFixed(2)} GB`,
        lockI: locked ? 'lock' : '',
        lock: locked ? `Until ${pad(until.getDate())} ${MON[until.getMonth()]}` : 'Not locked',
        lockTip: locked ? `${pol.lock} mode: cannot be changed or deleted until ${fmt(until)} IST` : 'Not immutable',
        encI: pol.enc ? 'shield' : ''
      };
    });
  }

  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    if (!A || !ctx)
      return {
        siteTabs: [],
        cols: [],
        rows: [],
        dtabs: [],
        tab: {},
        g: { tiles: [], facts: [], points: [], jobs: [], disks: [], consOpts: [] },
        apList: [],
        policyNames: []
      };
    const s = this.state;
    const op = ctx.can('operate', 'Backing up');
    const rs = ctx.can('restore', 'Restoring');
    const cfg = ctx.can('configure', 'Assigning a policy');
    const all = this.guests();
    const sites = ['All', 'Chennai-proxmox-prod', 'Chennai_Lab_Proxmox', 'production-openstack'];
    const siteTabs = sites.map(x => ({
      label: x === 'All' ? 'All sites' : x,
      n: String(x === 'All' ? all.length : all.filter(g => g.site === x).length),
      on: s.site === x,
      fg: s.site === x ? 'var(--tx)' : 'var(--tx-2)',
      onClick: () => this.setState({ site: x, sel: {} })
    }));
    let rows = all;
    if (s.site !== 'All') rows = rows.filter(g => g.site === s.site);
    const q = s.q.trim().toLowerCase();
    if (q) rows = rows.filter(g => (g.name + ' ' + g.policy).toLowerCase().includes(q));
    const tableRows = rows.map(g => {
      const r = RES[g.last.r];
      const cb = CBT[g.cbt];
      return {
        id: g.id,
        name: g.name,
        site: g.site,
        policy: g.policy,
        last: {
          t: 'status',
          i: r[0],
          c: r[2],
          spin: g.last.r === 'run',
          l: g.last.r === 'run' ? `Running · ${Math.floor(g.live ? g.live.pct : 62)} %` : `${r[1]} · ${short(g.last.t)}`,
          tip: g.note || `${r[1]} at ${g.last.t}`,
          s: g.last.t
        },
        next: { v: short(g.next), s: g.next },
        points: { v: String(g.points), s: g.points },
        cons: g.cons,
        cbt: { t: 'status', i: cb[0], c: cb[1], l: g.cbt, s: g.cbt },
        size: { v: `${g.size.toFixed(2)} GB`, s: g.size }
      };
    });
    const cols = [
      { k: 'name', label: 'Guest', w: 'minmax(150px,1.4fr)' },
      { k: 'site', label: 'Site', w: 'minmax(130px,1.2fr)', dim: true },
      { k: 'policy', label: 'Policy', w: 'minmax(120px,1.1fr)', dim: true },
      { k: 'last', label: 'Last backup', w: 'minmax(170px,1.4fr)' },
      { k: 'next', label: 'Next backup', w: '120px', dim: true },
      { k: 'points', label: 'Recovery points', w: '120px', r: true },
      { k: 'cons', label: 'Consistency', w: '104px', dim: true },
      { k: 'cbt', label: 'Change tracking', w: '136px' },
      { k: 'size', label: 'Size', w: '104px', r: true }
    ];
    const ids = tableRows.map(r => r.id);
    const selIds = ids.filter(id => s.sel[id]);
    const n = selIds.length;
    const need = n === 0 ? 'Select one or more guests first.' : null;

    const dg = s.drawer && all.find(x => x.id === s.drawer);
    let g: any = { tiles: [], facts: [], points: [], jobs: [], disks: [], consOpts: [] };
    if (dg) {
      const pol = A.policies.find(p => p.name === dg.policy);
      const r = RES[dg.last.r];
      const pts = this.points(dg);
      const stored = dg.size / (pol && pol.dest === 'obj-check' ? 4.4 : pol && pol.dest === 'copy-check-repo' ? 3.1 : 2.24);
      const cons = s.cons[dg.id] || dg.cons;
      const nodeIdx = (dg.name.length % 6) + 1;
      g = {
        name: dg.name,
        site: dg.site,
        os: dg.os,
        policy: dg.policy,
        polOpts: A.policyNames.map(x => ({ v: x, sel: x === dg.policy })),
        li: r[0],
        lc: SC[r[2]],
        spin: dg.last.r === 'run' ? 'true' : 'false',
        lastWord: dg.last.r === 'run' ? `Backing up · ${Math.floor(dg.live ? dg.live.pct : 62)} %` : `${r[1]} ${short(dg.last.t)} IST`,
        hasNote: !!dg.note,
        note: dg.note,
        noteIcon: dg.last.r === 'err' ? 'circle-x' : 'triangle-alert',
        noteColor: dg.last.r === 'err' ? 'var(--err)' : 'var(--warn)',
        noteBg: dg.last.r === 'err' ? 'var(--err-s)' : 'var(--warn-s)',
        tiles: [
          {
            label: 'Last backup',
            value: dg.last.r === 'run' ? 'Running' : r[1],
            i: r[0],
            c: SC[r[2]],
            sub: `${dg.last.t}`,
            bl: 'transparent'
          },
          {
            label: 'Next backup',
            value: short(dg.next).split(', ')[1],
            i: '',
            c: '',
            sub: `${short(dg.next).split(', ')[0]} · ${pol ? pol.schedule : ''}`,
            bl: 'var(--ln)'
          },
          {
            label: 'Recovery points',
            value: String(dg.points),
            i: '',
            c: '',
            sub: `Newest ${short(pts[0] && pts[0].t + ' IST')}`,
            bl: 'var(--ln)'
          },
          {
            label: 'Stored',
            value: `${stored.toFixed(2)} GB`,
            i: '',
            c: '',
            sub: `of ${dg.size.toFixed(2)} GB · ${(dg.size / stored).toFixed(1)}×`,
            bl: 'var(--ln)'
          }
        ],
        facts: [
          { k: 'Site', v: dg.site },
          {
            k: 'Node',
            v:
              dg.site === 'Chennai-proxmox-prod'
                ? `cmp${nodeIdx}`
                : dg.site === 'Chennai_Lab_Proxmox'
                  ? 'director-lab'
                  : `compute-0${(nodeIdx % 4) + 1}`
          },
          { k: 'Guest OS', v: dg.os },
          { k: 'Policy', v: `${dg.policy} · ${pol ? pol.schedule : ''}` },
          {
            k: 'Repository',
            v: pol ? `${pol.dest}${pol.copy ? ', copied to ' + pol.copy : ''}` : '—',
            lock: pol && pol.lock ? 'lock' : '',
            lockTip: pol && pol.lock ? `Immutable: ${pol.lock} mode, ${pol.lockDays} d` : undefined,
            enc: pol && pol.enc ? 'shield' : '',
            encTip: pol && pol.enc ? 'Encrypted with AES-256' : undefined
          },
          { k: 'Retention', v: pol ? `${pol.retention} · GFS ${pol.gfs}` : '—' },
          { k: 'Consistency', v: cons },
          { k: 'Change tracking', v: dg.cbt },
          { k: 'Size', v: `${dg.size.toFixed(2)} GB on ${dg.disks.length} ${dg.disks.length === 1 ? 'disk' : 'disks'}` }
        ].map(f => ({ lock: '', enc: '', ...f })),
        points: pts.map(p => ({
          ...p,
          onRestore: () => {
            if (rs.ok) ctx.go('backup/restore', `${dg.id}|${p.t}`);
          }
        })),
        pointsFoot:
          dg.points > pts.length ? `Showing the newest ${pts.length} of ${dg.points} recovery points.` : `${pts.length} recovery points.`,
        jobs: [
          dg.live && dg.live.status === 'run'
            ? {
                t: dg.live.started.replace(' IST', ''),
                i: 'loader-circle',
                spin: 'true',
                c: 'var(--run)',
                l: `Running ${Math.floor(dg.live.pct)} %`,
                dur: '—',
                read: '—',
                speed: dg.live.rate
              }
            : null
        ]
          .concat(
            pts.slice(0, 6).map((p, i) => {
              const rr = i === 0 ? A.guests.find(x => x.id === dg.id).last.r : 'ok';
              const r2 = RES[rr === 'run' ? 'ok' : rr];
              return {
                t: p.t,
                i: r2[0],
                spin: 'false',
                c: SC[r2[2]],
                l: r2[1],
                dur: `${2 + ((i * 3) % 7)} min ${pad((i * 17) % 60)} s`,
                read: p.size,
                speed: `${140 + ((i * 23) % 80)} MB/s`
              };
            })
          )
          .filter(Boolean),
        disks: dg.disks.map(([name, size, storage]) => {
          const off = !!s.disksOff[dg.id + name];
          const cb = CBT[dg.cbt];
          return {
            name,
            size: `${size.toFixed(2)} GB`,
            storage,
            cbt: dg.cbt,
            ci: cb[0],
            cc: cb[1] === 'tx' ? 'var(--tx-3)' : SC[cb[1]],
            on: !off,
            onLabel: off ? 'Excluded' : 'Included',
            tbg: off ? 'transparent' : 'var(--acc)',
            tbd: off ? 'var(--ln-2)' : 'var(--acc)',
            knob: off ? 'var(--tx-3)' : 'var(--acc-ink)',
            tx: off ? 'none' : 'translateX(14px)',
            onToggle: () => {
              if (!cfg.ok) return;
              this.setState(st => ({ disksOff: { ...st.disksOff, [dg.id + name]: !off } }));
            }
          };
        }),
        consOpts: ['Application', 'Crash', 'Offline'].map(c => ({
          label: c,
          on: cons === c,
          fg: cons === c ? 'var(--tx)' : 'var(--tx-2)',
          onClick: () => this.setState(st => ({ cons: { ...st.cons, [dg.id]: c } }))
        })),
        consHint: CONS_HINT[cons]
      };
    }
    const TABS = [
      ['Overview', ''],
      ['Recovery points', dg ? String(dg.points) : ''],
      ['Jobs', ''],
      ['Disks', dg ? String(dg.disks.length) : ''],
      ['Settings', '']
    ];
    const dtabs = TABS.map(([t, nn]) => ({
      label: t,
      n: nn,
      on: s.tab === t,
      fg: s.tab === t ? 'var(--tx)' : 'var(--tx-2)',
      onClick: () => this.setState({ tab: t })
    }));

    const apTargets = s.ap || [];
    const apList = A.policies.map(p => {
      const on = s.apPick === p.name;
      return {
        name: p.name,
        line: `${p.schedule} · keep ${p.retention} · ${p.dest}`,
        on,
        bd: on ? 'var(--acc)' : 'var(--ln)',
        bg: on ? 'var(--acc-soft)' : 'transparent',
        ring: on ? 'inset 0 0 0 1px var(--acc)' : 'none',
        rin: on ? 'var(--overlay)' : 'transparent',
        rbg: on ? 'var(--acc)' : 'transparent',
        lockI: p.lock ? 'lock' : '',
        lockTip: p.lock ? `Immutable: ${p.lock} mode, ${p.lockDays} d` : undefined,
        encI: p.enc ? 'shield' : '',
        encTip: p.enc ? 'Encrypted with AES-256' : undefined,
        onClick: () => this.setState({ apPick: p.name })
      };
    });

    return {
      ui: ctx.ui,
      unit: ['guest', 'guests'],
      siteTabs,
      q: s.q,
      onQ: e => this.setState({ q: e.target.value }),
      filtered: s.site !== 'All' || !!q,
      clearFilters: () => this.setState({ site: 'All', q: '' }),
      foot: `${tableRows.length} of 172 protected guests${n ? ` · ${n} selected` : ''}`,
      selLabel: n ? `${n} selected` : '',
      bnDis: n && op.ok ? undefined : 'true',
      bnWhy: !op.ok ? op.why : need,
      bnOp: n && op.ok ? 1 : 0.45,
      rsDis: n === 1 && rs.ok ? undefined : 'true',
      rsWhy: !rs.ok ? rs.why : n !== 1 ? 'Select one guest to restore.' : undefined,
      rsOp: n === 1 && rs.ok ? 1 : 0.45,
      apDis: n && cfg.ok ? undefined : 'true',
      apWhy: !cfg.ok ? cfg.why : need,
      apOp: n && cfg.ok ? 1 : 0.45,
      backupNow: () => {
        if (n && op.ok) {
          this.backup(selIds);
          this.setState({ sel: {} });
        }
      },
      restore: () => {
        if (n === 1 && rs.ok) ctx.go('backup/restore', selIds[0]);
      },
      assign: () => {
        if (n && cfg.ok) this.setState({ ap: selIds, apPick: all.find(x => x.id === selIds[0]).policy });
      },
      cols,
      rows: tableRows,
      sel: s.sel,
      active: s.drawer || '',
      onSel: id => this.setState(st => ({ sel: { ...st.sel, [id]: !st.sel[id] } })),
      onSelAll: (list, on) =>
        this.setState(st => {
          const sel = { ...st.sel };
          list.forEach(id => {
            sel[id] = on;
          });
          return { sel };
        }),
      openGuest: id => this.setState({ drawer: id, tab: s.drawer === id ? s.tab : 'Overview', closing: false }),
      goPolicies: () => ctx.go('backup/policies'),
      dOpen: !!dg,
      dAnim: s.closing ? 'ae-drawer-out 150ms var(--ease) forwards' : 'ae-drawer 150ms var(--ease)',
      g,
      dtabs,
      tab: {
        ov: s.tab === 'Overview',
        points: s.tab === 'Recovery points',
        jobs: s.tab === 'Jobs',
        disks: s.tab === 'Disks',
        settings: s.tab === 'Settings'
      },
      closeDrawer: () => this.closeDrawer(),
      opDis: op.dis,
      opWhy: op.why,
      opOp: op.op,
      cfgDis: cfg.dis,
      cfgWhy: cfg.why,
      cfgOp: cfg.op,
      rsDisD: rs.dis,
      rsWhyD: rs.why,
      rsOpD: rs.op,
      dBackup: () => {
        if (op.ok && dg) this.backup([dg.id]);
      },
      dRestore: () => {
        if (rs.ok && dg) ctx.go('backup/restore', dg.id);
      },
      dAssign: () => {
        if (cfg.ok && dg) this.setState({ ap: [dg.id], apPick: dg.policy });
      },
      policyNames: A.policyNames,
      setPolicy: e => {
        if (!cfg.ok || !dg) return;
        const v = e.target.value;
        this.setState(st => ({ over: { ...st.over, [dg.id]: { ...(st.over[dg.id] || {}), policy: v } } }));
      },
      saveSettings: () => {
        if (cfg.ok && dg) ctx.toast(`Settings for ${dg.name} saved`, 'ok');
      },
      apOpen: !!s.ap,
      apList,
      apSub:
        apTargets.length === 1
          ? `For ${all.find(x => x.id === apTargets[0]).name}. The new schedule starts with the next run.`
          : `For ${apTargets.length} guests. The new schedule starts with the next run.`,
      apBtn: apTargets.length > 1 ? `Assign to ${apTargets.length} guests` : 'Assign policy',
      apClose: () => this.setState({ ap: null }),
      apConfirm: () => {
        const pick = s.apPick;
        this.setState(st => {
          const over = { ...st.over };
          apTargets.forEach(id => {
            over[id] = { ...(over[id] || {}), policy: pick };
          });
          return { over, ap: null, sel: {} };
        });
        ctx.toast(
          apTargets.length === 1
            ? `Policy ${pick} assigned to ${all.find(x => x.id === apTargets[0]).name}`
            : `Policy ${pick} assigned to ${apTargets.length} guests`,
          'ok'
        );
      }
    };
  }

  render() {
    const v = this.vals();
    return (
      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'ae-page 150ms var(--ease)'
        }}
      >
        <div style={{ flex: 'none', padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Protection</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Protected guests</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>Proxmox VE and OpenStack guests, their policies and recovery points.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href="#/backup/policies"
              style={{
                height: '32px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid var(--ln-2)',
                background: 'var(--panel)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                transition: 'background-color 100ms'
              }}
              className={pc('hover', 'background:var(--hover)')}
            >
              <Icon name="clipboard-list" />
              Policies
            </a>
          </div>
        </div>
        <div style={{ flex: 'none', padding: '0 24px 12px', display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px' }}>
          <Ind
            mode="fill"
            role="radiogroup"
            aria-label="Site"
            style={{ display: 'flex', border: '1px solid var(--ln-2)', background: 'var(--panel)' }}
          >
            {arr(v.siteTabs).map((st: any, i: number) => (
              <button
                key={i}
                role="radio"
                aria-checked={st.on}
                onClick={st.onClick}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  font: '13px var(--f-ui)',
                  whiteSpace: 'nowrap',
                  color: st.fg,
                  transition: 'color 100ms'
                }}
                className={pc('hover', 'color:var(--tx)')}
              >
                {st.label}
                <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>{st.n}</span>
              </button>
            ))}
          </Ind>
          <div style={{ position: 'relative', width: '220px' }}>
            <Icon name="filter" style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--tx-3)', pointerEvents: 'none' }} />
            <input
              value={v.q ?? ''}
              onChange={v.onQ}
              placeholder="Filter by guest or policy"
              aria-label="Filter guests"
              style={{
                width: '100%',
                height: '32px',
                padding: '0 10px 0 34px',
                background: 'var(--panel)',
                border: '1px solid var(--ln-2)',
                font: '13px var(--f-ui)'
              }}
              className={pc('focus', 'border-color:var(--acc)')}
            />
          </div>
          <span style={{ flex: 1 }} />
          <span style={{ font: '13px var(--f-ui)', color: 'var(--tx-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {v.selLabel}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={v.backupNow}
              aria-disabled={v.bnDis}
              data-tip={v.bnWhy}
              style={{
                height: '32px',
                padding: '0 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--acc)',
                color: 'var(--acc-ink)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                opacity: v.bnOp,
                transition: 'background-color 100ms,opacity 100ms,transform 80ms'
              }}
              className={[pc('hover', 'background:var(--acc-h)'), pc('active', 'transform:translateY(1px)')].join(' ')}
            >
              <Icon name="play" />
              Back up now
            </button>
            <button
              onClick={v.restore}
              aria-disabled={v.rsDis}
              data-tip={v.rsWhy}
              style={{
                height: '32px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid var(--ln-2)',
                background: 'var(--panel)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                opacity: v.rsOp,
                transition: 'background-color 100ms,opacity 100ms'
              }}
              className={pc('hover', 'background:var(--hover)')}
            >
              <Icon name="rotate-ccw" />
              Restore
            </button>
            <button
              onClick={v.assign}
              aria-disabled={v.apDis}
              data-tip={v.apWhy}
              style={{
                height: '32px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid var(--ln-2)',
                background: 'var(--panel)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                opacity: v.apOp,
                transition: 'background-color 100ms,opacity 100ms'
              }}
              className={pc('hover', 'background:var(--hover)')}
            >
              <Icon name="clipboard-list" />
              Assign policy
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <AegisTable
              cols={v.cols}
              rows={v.rows}
              sel={v.sel}
              onSel={v.onSel}
              onSelAll={v.onSelAll}
              onRow={v.openGuest}
              active={v.active}
              state={v.ui}
              label="Protected guests"
              unit={v.unit}
              foot={v.foot}
              footR="Times in IST"
              filtered={v.filtered}
              onClear={v.clearFilters}
              emptyText="No guests are protected in this project yet. Assign a policy to guests on a site to start backing them up."
              emptyAction="Open Policies"
              onEmpty={v.goPolicies}
              unreachText="Could not be read: Chennai-proxmox-prod did not answer within 30 s."
              sort="name"
            />
          </div>
        </div>
        {v.dOpen ? (
          <aside
            role="dialog"
            aria-label="Guest details"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '680px',
              maxWidth: '100%',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--overlay)',
              borderLeft: '1px solid var(--ln-2)',
              boxShadow: 'var(--sh-over)',
              animation: v.dAnim
            }}
          >
            <div style={{ flex: 'none', padding: '20px 16px 0 24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
                  Guest · <span>{v.g?.site}</span>
                </div>
                <h2
                  style={{
                    marginTop: '2px',
                    font: '500 20px/28px var(--f-head)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {v.g?.name}
                </h2>
                <div
                  style={{
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    font: '13px/18px var(--f-ui)',
                    color: 'var(--tx-2)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name={v.g?.li} spin={v.g?.spin} style={{ color: v.g?.lc }} />
                    <span style={{ color: 'var(--tx)' }}>{v.g?.lastWord}</span>
                  </span>
                  <span>{v.g?.os}</span>
                  <span>{v.g?.policy}</span>
                </div>
              </div>
              <button
                onClick={v.closeDrawer}
                aria-label="Close guest details"
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--tx-2)',
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover);color:var(--tx)')}
              >
                <Icon name="x" size="20" />
              </button>
            </div>
            <div style={{ flex: 'none', padding: '16px 24px', display: 'flex', gap: '8px' }}>
              <button
                onClick={v.dBackup}
                aria-disabled={v.opDis}
                data-tip={v.opWhy}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--acc)',
                  color: 'var(--acc-ink)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: v.opOp,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--acc-h)')}
              >
                <Icon name="play" />
                Back up now
              </button>
              <button
                onClick={v.dRestore}
                aria-disabled={v.rsDisD}
                data-tip={v.rsWhyD}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--ln-2)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: v.rsOpD,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="rotate-ccw" />
                Restore…
              </button>
              <button
                onClick={v.dAssign}
                aria-disabled={v.cfgDis}
                data-tip={v.cfgWhy}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--ln-2)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: v.cfgOp,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="clipboard-list" />
                Change policy
              </button>
            </div>
            <Ind
              mode="underline"
              role="tablist"
              aria-label="Guest sections"
              style={{ flex: 'none', display: 'flex', padding: '0 16px', borderBottom: '1px solid var(--ln)' }}
            >
              {arr(v.dtabs).map((t: any, i: number) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={t.on}
                  onClick={t.onClick}
                  style={{
                    height: '40px',
                    padding: '0 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    color: t.fg,
                    transition: 'color 100ms'
                  }}
                  className={pc('hover', 'color:var(--tx)')}
                >
                  {t.label}
                  <span style={{ font: '11px var(--f-ui)', color: 'var(--tx-3)' }}>{t.n}</span>
                </button>
              ))}
            </Ind>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px 24px 24px' }}>
              {v.g?.hasNote ? (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    marginBottom: '16px',
                    background: v.g?.noteBg,
                    border: '1px solid var(--ln-2)'
                  }}
                >
                  <Icon name={v.g?.noteIcon} style={{ color: v.g?.noteColor, marginTop: '2px' }} />
                  <span>{v.g?.note}</span>
                </div>
              ) : null}
              {v.tab?.ov ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'ae-fade 150ms var(--ease)' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
                      border: '1px solid var(--ln)',
                      background: 'var(--panel-2)'
                    }}
                  >
                    {arr(v.g?.tiles).map((k: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px 14px',
                          borderLeft: `1px solid ${k.bl}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          minWidth: 0
                        }}
                      >
                        <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{k.label}</span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            font: '500 20px/28px var(--f-head)',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Icon name={k.i} style={{ color: k.c }} />
                          {k.value}
                        </span>
                        <span
                          style={{
                            font: '12px/16px var(--f-ui)',
                            color: 'var(--tx-2)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          data-tip={k.sub}
                          data-tip-overflow=""
                        >
                          {k.sub}
                        </span>
                      </div>
                    ))}
                  </div>
                  <dl style={{ display: 'grid', gridTemplateColumns: '168px minmax(0,1fr)', font: '13px/18px var(--f-ui)' }}>
                    {arr(v.g?.facts).map((f: any, i: number) => (
                      <Fragment key={i}>
                        <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                        <dd
                          style={{
                            padding: '9px 0',
                            borderBottom: '1px solid var(--ln)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: 0
                          }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.v}</span>
                          <Icon name={f.lock} data-tip={f.lockTip} style={{ color: 'var(--tx-2)' }} />
                          <Icon name={f.enc} data-tip={f.encTip} style={{ color: 'var(--tx-2)' }} />
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                </div>
              ) : null}
              {v.tab?.points ? (
                <div
                  role="table"
                  aria-label="Recovery points"
                  style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums', animation: 'ae-fade 150ms var(--ease)' }}
                >
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.5fr) 96px 80px 88px minmax(0,1.3fr) 84px',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <div role="columnheader">Point in time (IST)</div>
                    <div role="columnheader">Type</div>
                    <div role="columnheader">GFS</div>
                    <div role="columnheader" style={{ textAlign: 'right', paddingRight: '12px' }}>
                      Size
                    </div>
                    <div role="columnheader">Protection</div>
                    <div role="columnheader" />
                  </div>
                  {arr(v.g?.points).map((p: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.5fr) 96px 80px 88px minmax(0,1.3fr) 84px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)',
                        transition: 'background-color 100ms'
                      }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      <div role="cell">{p.t}</div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {p.type}
                      </div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {p.gfs}
                      </div>
                      <div role="cell" style={{ textAlign: 'right', paddingRight: '12px' }}>
                        {p.size}
                      </div>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--tx-2)', minWidth: 0 }}>
                        <span
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                          data-tip={p.lockTip}
                        >
                          <Icon name={p.lockI} />
                          {p.lock}
                        </span>
                        <Icon name={p.encI} data-tip="Encrypted with AES-256" />
                      </div>
                      <div role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={p.onRestore}
                          aria-disabled={v.rsDisD}
                          data-tip={v.rsWhyD}
                          style={{
                            height: '26px',
                            padding: '0 10px',
                            border: '1px solid var(--ln-2)',
                            font: '600 13px var(--f-body)',
                            opacity: v.rsOpD,
                            transition: 'background-color 100ms'
                          }}
                          className={pc('hover', 'background:var(--hover)')}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                  <p style={{ padding: '12px 0', font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.g?.pointsFoot}</p>
                </div>
              ) : null}
              {v.tab?.jobs ? (
                <div
                  role="table"
                  aria-label="Jobs"
                  style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums', animation: 'ae-fade 150ms var(--ease)' }}
                >
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.4fr) 128px 96px 96px 88px',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <div role="columnheader">Started (IST)</div>
                    <div role="columnheader">Result</div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Duration
                    </div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Read
                    </div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Speed
                    </div>
                  </div>
                  {arr(v.g?.jobs).map((j: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.4fr) 128px 96px 96px 88px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <div role="cell">{j.t}</div>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name={j.i} spin={j.spin} style={{ color: j.c }} />
                        {j.l}
                      </div>
                      <div role="cell" style={{ textAlign: 'right' }}>
                        {j.dur}
                      </div>
                      <div role="cell" style={{ textAlign: 'right' }}>
                        {j.read}
                      </div>
                      <div role="cell" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>
                        {j.speed}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {v.tab?.disks ? (
                <div
                  role="table"
                  aria-label="Disks"
                  style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums', animation: 'ae-fade 150ms var(--ease)' }}
                >
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '96px 96px minmax(0,1fr) minmax(0,1fr) 120px',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <div role="columnheader">Disk</div>
                    <div role="columnheader" style={{ textAlign: 'right', paddingRight: '16px' }}>
                      Size
                    </div>
                    <div role="columnheader">Storage</div>
                    <div role="columnheader">Change tracking</div>
                    <div role="columnheader">Backed up</div>
                  </div>
                  {arr(v.g?.disks).map((dk: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '96px 96px minmax(0,1fr) minmax(0,1fr) 120px',
                        alignItems: 'center',
                        height: '40px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <div role="cell">{dk.name}</div>
                      <div role="cell" style={{ textAlign: 'right', paddingRight: '16px' }}>
                        {dk.size}
                      </div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {dk.storage}
                      </div>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name={dk.ci} style={{ color: dk.cc }} />
                        {dk.cbt}
                      </div>
                      <div role="cell">
                        <button
                          role="switch"
                          aria-checked={dk.on}
                          aria-label={`Back up ${dk.name ?? ''}`}
                          onClick={dk.onToggle}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '13px var(--f-ui)' }}
                        >
                          <span
                            style={{
                              width: '32px',
                              height: '18px',
                              padding: '2px',
                              display: 'flex',
                              background: dk.tbg,
                              border: `1px solid ${dk.tbd}`,
                              transition: 'background-color 120ms,border-color 120ms'
                            }}
                          >
                            <span
                              style={{
                                width: '12px',
                                height: '12px',
                                background: dk.knob,
                                transform: dk.tx,
                                transition: 'transform 120ms var(--ease),background-color 120ms'
                              }}
                            />
                          </span>
                          {dk.onLabel}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {v.tab?.settings ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxWidth: '440px',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="g-pol" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                      Policy
                    </label>
                    <select
                      id="g-pol"
                      onChange={v.setPolicy}
                      style={{
                        height: '36px',
                        padding: '0 8px',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--ln)',
                        font: '14px var(--f-body)'
                      }}
                    >
                      {arr(v.g?.polOpts).map((o: any, i: number) => (
                        <option key={i} value={o.v ?? ''} selected={o.sel}>
                          {o.v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>Consistency</span>
                    <Ind
                      mode="fill"
                      role="radiogroup"
                      aria-label="Consistency"
                      style={{ display: 'flex', alignSelf: 'flex-start', border: '1px solid var(--ln-2)' }}
                    >
                      {arr(v.g?.consOpts).map((co: any, i: number) => (
                        <button
                          key={i}
                          role="radio"
                          aria-checked={co.on}
                          onClick={co.onClick}
                          style={{ height: '30px', padding: '0 14px', font: '13px var(--f-ui)', color: co.fg, transition: 'color 100ms' }}
                        >
                          {co.label}
                        </button>
                      ))}
                    </Ind>
                    <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{v.g?.consHint}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '8px' }}>
                    <button
                      onClick={v.saveSettings}
                      aria-disabled={v.cfgDis}
                      data-tip={v.cfgWhy}
                      style={{
                        height: '32px',
                        padding: '0 14px',
                        background: 'var(--acc)',
                        color: 'var(--acc-ink)',
                        fontWeight: 600,
                        opacity: v.cfgOp,
                        transition: 'background-color 100ms'
                      }}
                      className={pc('hover', 'background:var(--acc-h)')}
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
        {v.apOpen ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              display: 'grid',
              placeItems: 'center',
              padding: '24px',
              background: 'var(--scrim)',
              animation: 'ae-fade 120ms var(--ease)'
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ap-title"
              style={{
                width: '600px',
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--overlay)',
                border: '1px solid var(--ln-2)',
                boxShadow: 'var(--sh-over)',
                animation: 'ae-dialog 150ms var(--ease)'
              }}
            >
              <div style={{ padding: '20px 16px 0 24px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <h2 id="ap-title" style={{ font: '500 20px/28px var(--f-head)' }}>
                    Assign policy
                  </h2>
                  <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>{v.apSub}</p>
                </div>
                <button
                  onClick={v.apClose}
                  aria-label="Close"
                  style={{ width: '32px', height: '32px', display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  <Icon name="x" size="20" />
                </button>
              </div>
              <div role="radiogroup" style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {arr(v.apList).map((pl: any, i: number) => (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={pl.on}
                    onClick={pl.onClick}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '16px minmax(0,1fr) auto',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '10px 14px',
                      border: `1px solid ${pl.bd}`,
                      background: pl.bg,
                      boxShadow: pl.ring,
                      transition: 'border-color 100ms,background-color 100ms'
                    }}
                  >
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: `1px solid ${pl.bd}`,
                        boxShadow: `inset 0 0 0 4px ${pl.rin}`,
                        background: pl.rbg,
                        transition: 'all 100ms'
                      }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{pl.name}</span>
                      <span style={{ display: 'block', font: '12px/18px var(--f-ui)', color: 'var(--tx-2)' }}>{pl.line}</span>
                    </span>
                    <span style={{ display: 'flex', gap: '8px', color: 'var(--tx-2)' }}>
                      <Icon name={pl.lockI} data-tip={pl.lockTip} />
                      <Icon name={pl.encI} data-tip={pl.encTip} />
                    </span>
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  padding: '12px 16px 12px 24px',
                  borderTop: '1px solid var(--ln)'
                }}
              >
                <button
                  onClick={v.apClose}
                  style={{ height: '32px', padding: '0 12px', fontWeight: 600 }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  Cancel
                </button>
                <button
                  onClick={v.apConfirm}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    background: 'var(--acc)',
                    color: 'var(--acc-ink)',
                    fontWeight: 600,
                    transition: 'background-color 100ms'
                  }}
                  className={pc('hover', 'background:var(--acc-h)')}
                >
                  {v.apBtn}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
