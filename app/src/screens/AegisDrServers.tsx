/* Ported from project/AegisDrServers.dc.html */
import React, { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';
import { DR_INFO, MODE_LABEL, MODE_TIP, parseDur } from '../products/resilience/data';
import AegisTable from '../components/AegisTable';

const SC = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', run: 'var(--run)' };
const NETS = {
  'production-openstack': ['prod-net', 'app-net', 'dr-test-isolated'],
  'Chennai-proxmox-prod': ['vmbr0 (VLAN 10)', 'vmbr20 (VLAN 20)', 'vmbr99 (VLAN 99, isolated)'],
  'region-2-os': ['Not read'],
  'Chennai vCenter': ['VM Network', 'DMZ-120']
};
const SIZES = {
  os: ['m1.large (4 vCPU, 8 GB)', 'm1.medium (2 vCPU, 4 GB)', 'm1.xlarge (8 vCPU, 32 GB)', 'm1.2xlarge (16 vCPU, 64 GB)'],
  pve: ['4 cores, 8192 MB', '2 cores, 4096 MB', '8 cores, 32768 MB', '16 cores, 65536 MB'],
  vmw: ['4 vCPU, 8 GB', '8 vCPU, 32 GB']
};
const isOs = site => /openstack|region-2/.test(site);
const kindOf = site => (isOs(site) ? 'os' : site.includes('vCenter') ? 'vmw' : 'pve');
const ONLINE_PHASES = [
  'Prepare',
  'Create volumes from the recovery point',
  'Attach network',
  'Apply firewall policy',
  'Boot server',
  'Check console',
  'Done'
];
const RETURN_PHASES = [
  'Prepare',
  'Snapshot the recovery copy',
  'Copy changes to the primary site',
  'Create server at primary site',
  'Boot server',
  'Done'
];
const LINE_ICON = {
  info: ['circle-dot', 'var(--tx-3)'],
  ok: ['circle-check', 'var(--ok)'],
  warn: ['triangle-alert', 'var(--warn)'],
  err: ['circle-x', 'var(--err)']
};

export default class AegisDrServers extends DC {
  state: any = { view: 'all', q: '', sel: {}, drawer: null, closing: false, tab: 'Overview', dlg: null, dlgClosing: false, over: {}, jobs: {} };
  logRef = React.createRef<any>();

  componentDidMount() {
    this.checkOpen();
  }
  componentDidUpdate(pp) {
    if (pp.ctx && this.props.ctx && pp.ctx.nonce !== this.props.ctx.nonce) this.checkOpen();
    const el = this.logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    this.applyDone();
  }
  checkOpen() {
    const c = this.props.ctx;
    if (c && c.openId) this.setState({ drawer: c.openId, closing: false, tab: 'Overview' });
  }
  closeDrawer() {
    this.setState({ closing: true });
    setTimeout(() => this.setState({ drawer: null, closing: false }), 150);
  }
  closeDlg() {
    this.setState({ dlgClosing: true });
    setTimeout(() => this.setState({ dlg: null, dlgClosing: false }), 150);
  }

  applyDone() {
    const ctx = this.props.ctx;
    if (!ctx) return;
    Object.entries(this.state.jobs).forEach(([sid, { id, kind }]: [string, any]) => {
      const j = ctx.jobs.find(x => x.id === id);
      if (j && j.status === 'ok') {
        const patch =
          kind === 'online'
            ? { state: 'online', onlineAs: this.state.over[sid] && this.state.over[sid].pendingName, since: ctx.now() }
            : kind === 'return'
              ? { state: 'ok', age: '0 min', ageMin: 0, onlineAs: null }
              : { state: 'ok', age: '0 min', ageMin: 0, reason: null };
        this.setState(s => {
          const jobs = { ...s.jobs };
          delete jobs[sid];
          return { jobs, over: { ...s.over, [sid]: { ...(s.over[sid] || {}), ...patch } } };
        });
      }
    });
  }

  servers() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    return A.drServers
      .map(x => {
        const o = this.state.over[x.id] || {};
        const jr = this.state.jobs[x.id];
        const live = jr && ctx.jobs.find(j => j.id === jr.id);
        let state = o.state || x.state;
        if (live && live.status === 'run') state = jr.kind === 'online' ? 'bringing' : jr.kind === 'return' ? 'returning' : 'sync';
        return { ...x, ...o, state, live, jobKind: jr && jr.kind };
      })
      .filter(x => !o_removed(this.state.over[x.id]));
  }

  startAction(kind, srv, form?) {
    const ctx = this.props.ctx;
    if (kind === 'sync') {
      const id = ctx.startJob({
        name: 'Replication',
        object: srv.name,
        product: 'DR',
        type: 'Replication',
        phases: AEGIS.phases.concat(['Done']),
        speed: 11,
        rate: '212 MB/s',
        doneToast: `${srv.name} synced. Newest recovery point is 0 min old.`
      });
      this.setState(s => ({ jobs: { ...s.jobs, [srv.id]: { id, kind } } }));
      ctx.toast(`Sync of ${srv.name} started`, 'info');
      return;
    }
    const online = kind === 'online';
    const target = online ? srv.rec : srv.pri;
    const name = form.name;
    const id = ctx.startJob({
      name: online ? 'Bring online' : 'Return to primary',
      object: srv.name,
      product: 'DR',
      type: online ? 'Failover' : 'Failback',
      phases: online ? ONLINE_PHASES : RETURN_PHASES,
      speed: online ? 8 : 6,
      rate: online ? '' : '186 MB/s',
      firstLine: online
        ? `Bring online started: ${name} at ${target} from the point ${form.point.split(' · ')[1] || form.point}`
        : `Return to primary started: ${name} at ${target}`,
      lines: online
        ? {
            'Create volumes from the recovery point': `Creating ${srv.name === 'sql-prod-02' ? 3 : 2} volumes from the recovery point on ${form.storage || 'ceph-ssd'}…`,
            'Attach network': `Attaching ${form.network}…`,
            'Apply firewall policy': `Applying firewall policy: ${form.firewall}`,
            'Boot server': `Booting ${name} as ${form.size}…`,
            'Check console': 'Console shows the login prompt. Guest agent answered.'
          }
        : {
            'Copy changes to the primary site': `Copying changes to ${target} on ${form.storage}…`,
            'Create server at primary site': `Creating ${name} on ${target}…`
          },
      doneLog: online ? `${name} is online at ${target}` : `${name} is running at ${target}`,
      doneToast: online ? `${name} is online at ${target}` : `${srv.name} returned to ${target}`
    });
    this.setState(s => ({
      jobs: { ...s.jobs, [srv.id]: { id, kind } },
      over: { ...s.over, [srv.id]: { ...(s.over[srv.id] || {}), pendingName: name } },
      dlg: { ...s.dlg, jobId: id }
    }));
  }

  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    const empty: any = {
      views: [],
      cols: [],
      rows: [],
      dtabs: [],
      tab: {},
      b: { online: {}, ret: {}, sync: {}, destroy: {} },
      d: { b: { online: {}, ret: {}, sync: {}, destroy: {} }, facts: [], points: [], history: [] },
      dlg: { fields: [], ticks: [], phases: [], log: [] }
    };
    if (!A || !ctx) return empty;
    const s = this.state;
    const op = ctx.can('operate', 'Bringing a server online');
    const del = ctx.can('destroy', 'Destroying resources');
    const all = this.servers();
    const attn = x => ['behind', 'failed', 'unreach'].includes(x.state);
    const views = [
      ['all', 'All', all.length],
      ['attn', 'Needs attention', all.filter(attn).length],
      ['online', 'Online at recovery site', all.filter(x => x.state === 'online').length]
    ].map(([id, label, n]) => ({
      label,
      n: String(n),
      on: s.view === id,
      fg: s.view === id ? 'var(--tx)' : 'var(--tx-2)',
      onClick: () => this.setState({ view: id, sel: {} })
    }));
    let rows = all;
    if (s.view === 'attn') rows = rows.filter(attn);
    if (s.view === 'online') rows = rows.filter(x => x.state === 'online');
    const q = s.q.trim().toLowerCase();
    if (q) rows = rows.filter(x => (x.name + ' ' + x.pri + ' ' + x.rec).toLowerCase().includes(q));
    const stateCell = x => {
      if (x.state === 'bringing')
        return { t: 'status', i: 'loader-circle', spin: true, c: 'run', l: `Bringing online · ${Math.floor(x.live.pct)} %`, s: 'bringing' };
      if (x.state === 'sync' && x.live)
        return { t: 'status', i: 'loader-circle', spin: true, c: 'run', l: `Syncing · ${Math.floor(x.live.pct)} %`, s: 'sync' };
      const st = A.drStates[x.state] || A.drStates.ok;
      return {
        t: 'status',
        i: st[0],
        c: st[2],
        spin: x.state === 'sync' || x.state === 'returning',
        l: st[1],
        tip: x.reason || st[1],
        s: x.state
      };
    };
    const targetMin = x => (x.target === '15 min' ? 15 : 1440);
    const tableRows = rows.map(x => ({
      id: x.id,
      name: x.name,
      route: { v: `${x.pri} → ${x.rec}`, tip: `Primary ${x.pri}, recovery site ${x.rec}` },
      plan: x.plan,
      mode: DR_INFO[x.id] ? { v: DR_INFO[x.id].mode, tip: `${MODE_LABEL[DR_INFO[x.id].mode]}${DR_INFO[x.id].every ? `, every ${DR_INFO[x.id].every}` : ''}. ${MODE_TIP[DR_INFO[x.id].mode]}` } : { v: '—', muted: true },
      target: { v: x.target, s: targetMin(x) },
      rto: DR_INFO[x.id] ? { v: DR_INFO[x.id].rto, s: parseDur(DR_INFO[x.id].rto) } : { v: '—', muted: true },
      age:
        x.ageMin == null
          ? { v: 'Not read', muted: true, italic: true, s: null }
          : {
              t: 'status',
              i: x.ageMin <= targetMin(x) ? 'circle-check' : 'clock',
              c: x.ageMin <= targetMin(x) ? 'ok' : 'warn',
              l: x.age,
              tip: x.ageMin <= targetMin(x) ? `Within the ${x.target} target` : `Older than the ${x.target} target`,
              s: x.ageMin
            },
      vers: x.vers ? { v: `${x.vers[0]} of ${x.vers[1]}`, s: x.vers[0] } : { v: 'Not read', muted: true, italic: true, s: null },
      state: stateCell(x)
    }));
    const cols = [
      { k: 'name', label: 'Server', w: 'minmax(130px,1.2fr)' },
      { k: 'route', label: 'Primary → recovery', w: 'minmax(150px,1.4fr)', dim: true },
      { k: 'plan', label: 'Protection plan', w: 'minmax(110px,1fr)', dim: true },
      { k: 'mode', label: 'Mode', w: '96px', dim: true },
      { k: 'target', label: 'RPO', w: '64px', r: true },
      { k: 'rto', label: 'RTO', w: '56px', r: true },
      { k: 'age', label: 'Newest point', w: '128px' },
      { k: 'vers', label: 'Versions', w: '76px', r: true },
      { k: 'state', label: 'State', w: 'minmax(170px,1.3fr)' }
    ];
    const selIds = tableRows.map(r => r.id).filter(id => s.sel[id]);
    const one = selIds.length === 1 ? all.find(x => x.id === selIds[0]) : null;
    const gate = (srv, kind) => {
      const busy = srv && ['bringing', 'returning', 'sync'].includes(srv.state);
      const base = kind === 'destroy' ? del : op;
      if (!base.ok) return { dis: 'true', why: base.why, op: 0.45, ok: false };
      if (!srv)
        return { dis: 'true', why: kind === 'sync' ? 'Select one or more servers first.' : 'Select one server.', op: 0.45, ok: false };
      if (srv.state === 'unreach')
        return { dis: 'true', why: `${srv.rec} could not be read. Try again when it answers.`, op: 0.45, ok: false };
      if (busy && kind !== 'destroy') return { dis: 'true', why: 'A job is already running for this server.', op: 0.45, ok: false };
      if (kind === 'online' && srv.state === 'online')
        return { dis: 'true', why: `${srv.name} is already online at ${srv.rec}.`, op: 0.45, ok: false };
      if (kind === 'ret' && srv.state !== 'online')
        return { dis: 'true', why: 'Return to primary is available after the server is brought online.', op: 0.45, ok: false };
      return { dis: undefined, why: undefined, op: 1, ok: true };
    };
    const syncSel = selIds.length ? all.filter(x => selIds.includes(x.id)) : [];
    const syncGate = !op.ok
      ? gate(null, 'sync') && { dis: 'true', why: op.why, op: 0.45, ok: false }
      : syncSel.length
        ? syncSel.some(x => x.state === 'unreach' || x.live)
          ? { dis: 'true', why: 'One of the selected servers is unreachable or already running a job.', op: 0.45, ok: false }
          : { dis: undefined, op: 1, ok: true }
        : { dis: 'true', why: 'Select one or more servers first.', op: 0.45, ok: false };
    const b = { online: gate(one, 'online'), ret: gate(one, 'ret'), sync: syncGate, destroy: gate(one, 'destroy') };

    const dsrv = s.drawer && all.find(x => x.id === s.drawer);
    let d = empty.d;
    if (dsrv) {
      const st = stateCell(dsrv);
      const unread = dsrv.ageMin == null;
      const hist = A.drHistory.filter(h => h.server === dsrv.name);
      const fmtS = n => `${Math.floor(n / 60)} min ${String(n % 60).padStart(2, '0')} s`;
      d = {
        name: dsrv.name,
        plan: dsrv.plan,
        pri: dsrv.pri,
        rec: dsrv.rec,
        si: st.i,
        sl: st.l,
        sc: SC[st.c],
        spin: st.spin ? 'true' : 'false',
        hasReason: !!dsrv.reason || dsrv.state === 'online',
        reason:
          dsrv.state === 'online'
            ? `Running at ${dsrv.rec} as ${dsrv.onlineAs || dsrv.name + '-dr'} since ${dsrv.since}. Syncs are paused until it returns to the primary site.`
            : dsrv.reason,
        ri: dsrv.state === 'failed' ? 'circle-x' : dsrv.state === 'online' ? 'power' : 'triangle-alert',
        rc: dsrv.state === 'failed' ? 'var(--err)' : dsrv.state === 'online' ? 'var(--run)' : 'var(--warn)',
        rbg: dsrv.state === 'failed' ? 'var(--err-s)' : dsrv.state === 'online' ? 'var(--run-s)' : 'var(--warn-s)',
        syncing: !!(dsrv.live && dsrv.live.status === 'run'),
        syncPhase: dsrv.live ? `${dsrv.live.name}: ${dsrv.live.phases[dsrv.live.phase]}` : '',
        syncPct: dsrv.live ? `${Math.floor(dsrv.live.pct)} %` : '',
        syncW: dsrv.live ? `${dsrv.live.pct}%` : '0%',
        facts: [
          { k: 'Primary site', v: dsrv.pri },
          { k: 'Recovery site', v: dsrv.rec },
          { k: 'Protection plan', v: dsrv.plan },
          { k: 'Replication mode', v: DR_INFO[dsrv.id] ? `${MODE_LABEL[DR_INFO[dsrv.id].mode]}${DR_INFO[dsrv.id].every ? `, every ${DR_INFO[dsrv.id].every}` : ''}` : '—' },
          { k: 'Recovery target (RPO)', v: dsrv.target },
          { k: 'Recovery time target (RTO)', v: DR_INFO[dsrv.id] ? `${DR_INFO[dsrv.id].rto}${DR_INFO[dsrv.id].rtoMeasured ? `; ${DR_INFO[dsrv.id].rtoMeasured} at the last drill` : ''}` : '—' },
          unread
            ? { k: 'Age of newest point', v: 'Not read', fs: 'italic', c: 'var(--tx-3)' }
            : {
                k: 'Age of newest point',
                v: dsrv.age,
                i: dsrv.ageMin <= targetMin(dsrv) ? 'circle-check' : 'clock',
                ic: dsrv.ageMin <= targetMin(dsrv) ? 'var(--ok)' : 'var(--warn)'
              },
          {
            k: 'Versions kept',
            v: dsrv.vers ? `${dsrv.vers[0]} of ${dsrv.vers[1]}` : 'Not read',
            fs: dsrv.vers ? 'normal' : 'italic',
            c: dsrv.vers ? 'var(--tx)' : 'var(--tx-3)'
          },
          {
            k: 'Delta storage at recovery site',
            v: unread ? 'Not read' : `${(dsrv.name.length * 3.7).toFixed(2)} GB`,
            fs: unread ? 'italic' : 'normal',
            c: unread ? 'var(--tx-3)' : 'var(--tx)'
          },
          {
            k: 'Recovery plans',
            v:
              A.recPlans
                .filter(p => p.servers.includes(dsrv.name))
                .map(p => p.name)
                .join(', ') || 'None'
          }
        ].map(f => ({ i: '', ic: '', fs: 'normal', c: 'var(--tx)', ...f })),
        points: unread
          ? []
          : [
              {
                t:
                  '21 Oct 2026, ' +
                  (dsrv.ageMin < 60
                    ? `${15 - Math.min(14, Math.floor(dsrv.ageMin / 5))}:${String(59 - dsrv.ageMin).padStart(2, '0')}`.replace(
                        /^21 Oct 2026, \d+:/,
                        ''
                      )
                    : '06:53'),
                kind: 'Newest sync',
                changed: '1.84 GB'
              }
            ]
              .map(() => null)
              .filter(Boolean)
              .concat(
                Array.from({ length: (dsrv.vers ? dsrv.vers[0] : 0) + 1 }, (_, i) => {
                  const base = new Date(2026, 9, 21, 16, 5 - (dsrv.ageMin || 0));
                  const dt = new Date(base.getTime() - i * (dsrv.target === '15 min' ? 60 : 1440) * 60e3);
                  const p2 = n => String(n).padStart(2, '0');
                  return {
                    t: `${p2(dt.getDate())} Oct 2026, ${p2(dt.getHours())}:${p2(dt.getMinutes())}`,
                    kind: i === 0 ? 'Newest sync' : `Version ${dsrv.vers[0] - i + 1}`,
                    changed: `${(1.2 + i * 0.7).toFixed(2)} GB`
                  };
                })
              ),
        noPoints: unread,
        history: hist.length
          ? hist.map(h => ({
              t: h.started.replace(' IST', ''),
              i: { ok: 'circle-check', warn: 'triangle-alert', err: 'circle-x', run: 'loader-circle' }[h.r],
              c: SC[h.r],
              l: { ok: 'Succeeded', warn: 'Warning', err: 'Failed', run: 'Running' }[h.r],
              dur: fmtS(h.total),
              changed: h.changed
            }))
          : [{ t: '21 Oct 2026, 06:53', i: 'circle-check', c: 'var(--ok)', l: 'Succeeded', dur: '4 min 12 s', changed: '2.40 GB' }],
        b: { online: gate(dsrv, 'online'), ret: gate(dsrv, 'ret'), sync: gate(dsrv, 'sync'), destroy: gate(dsrv, 'destroy') }
      };
    }
    const dtabs = [
      ['Overview', ''],
      ['Recovery points', dsrv && dsrv.vers ? String(dsrv.vers[0] + 1) : ''],
      ['History', '']
    ].map(([t, n]) => ({
      label: t,
      n,
      on: s.tab === t,
      fg: s.tab === t ? 'var(--tx)' : 'var(--tx-2)',
      onClick: () => this.setState({ tab: t })
    }));

    // dialog
    const g = s.dlg;
    let dlg = empty.dlg;
    if (g) {
      const srv = all.find(x => x.id === g.id) || A.drServers.find(x => x.id === g.id);
      const job = g.jobId && ctx.jobs.find(j => j.id === g.jobId);
      const set = k => e => {
        const v = e.target.value;
        this.setState(st => ({ dlg: { ...st.dlg, f: { ...st.dlg.f, [k]: v } } }));
      };
      const F = (k, label, opts, extra?) => ({
        id: 'dlg-' + k,
        label,
        value: g.f[k],
        options: opts || [],
        isSelect: !!opts,
        isInput: !opts,
        onChange: set(k),
        span: 1,
        hint: '',
        ...(extra || {})
      });
      if (g.kind === 'online' || g.kind === 'return') {
        const online = g.kind === 'online';
        const site = online ? srv.rec : srv.pri;
        const k = kindOf(site);
        const pts = srv.vers
          ? Array.from({ length: srv.vers[0] + 1 }, (_, i) =>
              i === 0 ? `Newest · ${srv.age} ago` : `Version ${srv.vers[0] - i + 1} · ${i * (srv.target === '15 min' ? 1 : 24)} h older`
            )
          : ['Newest'];
        const fields = [
          F(
            'point',
            online ? 'Point in time to recover' : 'Point in time to restore',
            online ? pts : ['Now · the running recovery copy', 'Last snapshot · 20 min ago'],
            { span: 2 }
          ),
          F('name', online ? 'Server name at recovery site' : 'Server name at primary site', null, { span: 2 }),
          F('size', 'Size', SIZES[k]),
          F('network', 'Network', NETS[site] || ['default']),
          F('workspace', 'Workspace', ['Default', 'dr-workspace', 'test-workspace']),
          F('firewall', 'Firewall policy', ['Same as primary', 'Block all inbound', 'Allow from 10.50.0.0/16'])
        ];
        if (!online)
          fields.push(F('storage', 'Storage type', k === 'os' ? ['ceph-ssd', 'standard'] : ['ceph-vm', 'local-lvm'], { span: 2 }));
        const run = !!job;
        const n = job ? job.phases.length - 1 : 0;
        dlg = {
          server: srv.name,
          title: online ? 'Bring server online' : 'Return to primary site',
          desc: online
            ? 'This starts a copy of your server at the recovery site. Your primary server is not affected.'
            : 'Copies your server back to the primary site and starts it there.',
          isForm: !run,
          isDestroy: false,
          isRun: run,
          notRun: !run,
          fields,
          btn: online ? 'Bring online' : 'Return to primary',
          btnIcon: online ? 'power' : 'undo-2',
          btnBg: 'var(--acc)',
          dis: g.f.name ? undefined : 'true',
          why: g.f.name ? undefined : 'Enter a server name.',
          op: g.f.name ? 1 : 0.45,
          phases: run
            ? job.phases.slice(0, -1).map((p, i) => {
                const done = job.status === 'ok' || i < job.phase;
                const cur = job.status === 'run' && i === job.phase;
                return {
                  label: p,
                  i: done ? 'circle-check' : cur ? 'loader-circle' : 'circle',
                  spin: cur ? 'true' : 'false',
                  ic: done ? 'var(--ok)' : cur ? 'var(--run)' : 'var(--tx-3)',
                  fg: done || cur ? 'var(--tx)' : 'var(--tx-3)',
                  fw: cur ? 600 : 400,
                  note: cur ? `${Math.floor(job.pct)} %` : ''
                };
              })
            : [],
          pctW: job ? `${job.pct}%` : '0%',
          barC: job && job.status === 'ok' ? 'var(--ok)' : 'var(--run)',
          log: job ? job.log.map(l => ({ ...l, i: LINE_ICON[l.lv][0], c: LINE_ICON[l.lv][1] })) : [],
          runNote:
            job && job.status === 'ok'
              ? online
                ? `${g.f.name} is online. Return it to ${srv.pri} when the primary site is ready.`
                : `${srv.name} runs at ${srv.pri} again. Syncs resume on the plan's schedule.`
              : 'You can close this dialog. The job keeps running and stays in the running jobs list.',
          closeLabel: job && job.status === 'ok' ? 'Done' : 'Close and keep running'
        };
      } else {
        const t = g.ticks;
        const running = srv.state === 'online';
        const items = [
          {
            key: 'copy',
            label: 'Delete the recovery copy running at the recovery site and its boot disk',
            detail: running
              ? `${srv.onlineAs || srv.name + '-dr'} at ${srv.rec} is stopped and deleted, with its boot disk.`
              : 'Nothing is running at the recovery site.',
            dis: !running
          },
          {
            key: 'point',
            label: 'Delete the recovery point (replica volumes)',
            detail: `Permanent. ${srv.vers ? srv.vers[0] + 1 : 'All'} points in time at ${srv.rec} are deleted and cannot be recovered.`
          },
          {
            key: 'prot',
            label: 'Remove from protection and delete its history',
            detail: `${srv.name} leaves ${srv.plan} and its sync history is deleted. The primary server is not touched.`
          }
        ];
        const nOn = items.filter(i => t[i.key] && !i.dis).length;
        const ok = nOn > 0 && g.typed === srv.name;
        dlg = {
          server: srv.name,
          title: 'Destroy resources',
          desc: 'Choose exactly what to remove. Anything left unticked is kept.',
          isForm: false,
          isDestroy: true,
          isRun: false,
          notRun: true,
          fields: [],
          phases: [],
          log: [],
          ticks: items.map(i => {
            const on = !!t[i.key] && !i.dis;
            return {
              ...i,
              on,
              dis: i.dis ? 'true' : undefined,
              why: i.dis ? i.detail : undefined,
              op: i.dis ? 0.45 : 1,
              bg: on ? 'var(--err-s)' : 'transparent',
              bd: on ? 'var(--err)' : 'var(--ln-2)',
              cbg: on ? 'var(--err)' : 'transparent',
              icon: on ? 'check' : '',
              onClick: () => {
                if (!i.dis) this.setState(st => ({ dlg: { ...st.dlg, ticks: { ...st.dlg.ticks, [i.key]: !st.dlg.ticks[i.key] } } }));
              }
            };
          }),
          keptLine: nOn
            ? `${nOn} of 3 selected. The primary server ${srv.name} on ${srv.pri} is never changed.`
            : 'Nothing is selected yet. The primary server is never changed.',
          typed: g.typed,
          btn: 'Destroy selected',
          btnIcon: 'trash-2',
          btnBg: 'var(--err)',
          dis: ok ? undefined : 'true',
          why: ok ? undefined : nOn ? `Type ${srv.name} to confirm.` : 'Tick at least one item.',
          op: ok ? 1 : 0.45
        };
      }
    }

    const openDlg = (kind, srv) => {
      if (!srv) return;
      const site = kind === 'online' ? srv.rec : srv.pri;
      const k = kindOf(site);
      const f = {
        point: '',
        name: kind === 'online' ? `${srv.name}-dr` : srv.name,
        size: SIZES[k][0],
        network: (NETS[site] || ['default'])[0],
        workspace: 'Default',
        firewall: 'Same as primary',
        storage: k === 'os' ? 'ceph-ssd' : 'ceph-vm'
      };
      f.point = kind === 'online' ? (srv.vers ? `Newest · ${srv.age} ago` : 'Newest') : 'Now · the running recovery copy';
      this.setState({ dlg: { kind, id: srv.id, f, ticks: {}, typed: '' }, dlgClosing: false });
    };

    return {
      ui: ctx.ui,
      unit: ['server', 'servers'],
      views,
      q: s.q,
      onQ: e => this.setState({ q: e.target.value }),
      filtered: s.view !== 'all' || !!q,
      clearFilters: () => this.setState({ view: 'all', q: '' }),
      selLabel: selIds.length ? `${selIds.length} selected` : '',
      b,
      aOnline: () => b.online.ok && openDlg('online', one),
      aReturn: () => b.ret.ok && openDlg('return', one),
      aDestroy: () => b.destroy.ok && openDlg('destroy', one),
      aSync: () => {
        if (b.sync.ok) {
          syncSel.forEach(x => this.startAction('sync', x));
          this.setState({ sel: {} });
        }
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
      openServer: id => this.setState({ drawer: id, tab: s.drawer === id ? s.tab : 'Overview', closing: false }),
      goPlans: () => ctx.go('dr/plans'),
      dOpen: !!dsrv,
      dAnim: s.closing ? 'ae-drawer-out 150ms var(--ease) forwards' : 'ae-drawer 150ms var(--ease)',
      d,
      dtabs,
      tab: { ov: s.tab === 'Overview', points: s.tab === 'Recovery points', history: s.tab === 'History' },
      closeDrawer: () => this.closeDrawer(),
      dOnline: () => d.b.online.ok && openDlg('online', dsrv),
      dReturn: () => d.b.ret.ok && openDlg('return', dsrv),
      dSync: () => d.b.sync.ok && this.startAction('sync', dsrv),
      dDestroy: () => d.b.destroy.ok && openDlg('destroy', dsrv),
      dlgOpen: !!g,
      dlg,
      logRef: this.logRef,
      dlgAnim: s.dlgClosing ? 'ae-dialog-out 150ms var(--ease) forwards' : 'ae-dialog 150ms var(--ease)',
      scrimAnim: s.dlgClosing ? 'ae-fade-out 150ms var(--ease) forwards' : 'ae-fade 120ms var(--ease)',
      closeDlg: () => this.closeDlg(),
      dsType: e => {
        const v = e.target.value;
        this.setState(st => ({ dlg: { ...st.dlg, typed: v } }));
      },
      confirmDlg: () => {
        if (!g || dlg.dis) return;
        const srv = all.find(x => x.id === g.id);
        if (g.kind === 'destroy') {
          const t = g.ticks;
          const patch: any = {};
          if (t.copy && srv.state === 'online') {
            patch.state = 'ok';
            patch.onlineAs = null;
          }
          if (t.point) {
            patch.vers = [0, srv.vers ? srv.vers[1] : 2];
            patch.age = '—';
          }
          if (t.prot) patch.removed = true;
          this.setState(st => ({
            over: { ...st.over, [srv.id]: { ...(st.over[srv.id] || {}), ...patch } },
            sel: {},
            drawer: t.prot && st.drawer === srv.id ? null : st.drawer
          }));
          this.closeDlg();
          ctx.toast(t.prot ? `${srv.name} removed from protection` : `Resources of ${srv.name} destroyed`, 'ok');
          return;
        }
        this.startAction(g.kind, srv, g.f);
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
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Resilience</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Protected servers</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>Servers replicated from a primary site to a recovery site.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href="#/dr/plans"
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
              <Icon name="calendar-clock" />
              Protection plans
            </a>
            <a
              href="#/dr/recovery"
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
              <Icon name="list-ordered" />
              Recovery plans
            </a>
          </div>
        </div>
        <div style={{ flex: 'none', padding: '0 24px 12px', display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px' }}>
          <Ind
            mode="fill"
            role="radiogroup"
            aria-label="Show"
            style={{ display: 'flex', border: '1px solid var(--ln-2)', background: 'var(--panel)' }}
          >
            {arr(v.views).map((v: any, i: number) => (
              <button
                key={i}
                role="radio"
                aria-checked={v.on}
                onClick={v.onClick}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  font: '13px var(--f-ui)',
                  whiteSpace: 'nowrap',
                  color: v.fg,
                  transition: 'color 100ms'
                }}
                className={pc('hover', 'color:var(--tx)')}
              >
                {v.label}
                <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>{v.n}</span>
              </button>
            ))}
          </Ind>
          <div style={{ position: 'relative', width: '220px' }}>
            <Icon name="filter" style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--tx-3)', pointerEvents: 'none' }} />
            <input
              value={v.q ?? ''}
              onChange={v.onQ}
              placeholder="Filter by server or site"
              aria-label="Filter servers"
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
          <span style={{ font: '13px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>{v.selLabel}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={v.aOnline}
              aria-disabled={v.b?.online?.dis}
              data-tip={v.b?.online?.why}
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
                opacity: v.b?.online?.op,
                transition: 'background-color 100ms,opacity 100ms'
              }}
              className={pc('hover', 'background:var(--acc-h)')}
            >
              <Icon name="power" />
              Bring online
            </button>
            <button
              onClick={v.aReturn}
              aria-disabled={v.b?.ret?.dis}
              data-tip={v.b?.ret?.why}
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
                opacity: v.b?.ret?.op,
                transition: 'background-color 100ms'
              }}
              className={pc('hover', 'background:var(--hover)')}
            >
              <Icon name="undo-2" />
              Return to primary
            </button>
            <button
              onClick={v.aSync}
              aria-disabled={v.b?.sync?.dis}
              data-tip={v.b?.sync?.why}
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
                opacity: v.b?.sync?.op,
                transition: 'background-color 100ms'
              }}
              className={pc('hover', 'background:var(--hover)')}
            >
              <Icon name="refresh-cw" />
              Sync now
            </button>
            <button
              onClick={v.aDestroy}
              aria-disabled={v.b?.destroy?.dis}
              data-tip={v.b?.destroy?.why}
              aria-label="Destroy resources"
              style={{
                height: '32px',
                width: '32px',
                display: 'inline-grid',
                placeItems: 'center',
                border: '1px solid var(--ln-2)',
                background: 'var(--panel)',
                color: 'var(--err)',
                opacity: v.b?.destroy?.op,
                transition: 'background-color 100ms'
              }}
              className={pc('hover', 'background:var(--err-s)')}
            >
              <Icon name="trash-2" />
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
              onRow={v.openServer}
              active={v.active}
              state={v.ui}
              label="Protected servers"
              unit={v.unit}
              footR="Ages are measured from 21 Oct 2026, 16:05 IST"
              filtered={v.filtered}
              onClear={v.clearFilters}
              emptyText="No servers are protected yet. Create a protection plan and assign servers to it."
              emptyAction="Create a protection plan"
              onEmpty={v.goPlans}
              unreachText="Could not be read: the recovery sites did not answer within 30 s."
              sort="name"
            />
          </div>
        </div>
        {v.dOpen ? (
          <aside
            role="dialog"
            aria-label="Server details"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '640px',
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
                  Protected server · <span>{v.d?.plan}</span>
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
                  {v.d?.name}
                </h2>
                <div
                  style={{
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    font: '13px/18px var(--f-ui)',
                    color: 'var(--tx-2)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name={v.d?.si} spin={v.d?.spin} style={{ color: v.d?.sc }} />
                    <span style={{ color: 'var(--tx)' }}>{v.d?.sl}</span>
                  </span>
                  <span style={{ marginLeft: '8px' }}>{v.d?.pri}</span>
                  <Icon name="arrow-right" style={{ color: 'var(--tx-3)' }} />
                  <span>{v.d?.rec}</span>
                </div>
              </div>
              <button
                onClick={v.closeDrawer}
                aria-label="Close server details"
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
                onClick={v.dOnline}
                aria-disabled={v.d?.b?.online?.dis}
                data-tip={v.d?.b?.online?.why}
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
                  opacity: v.d?.b?.online?.op,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--acc-h)')}
              >
                <Icon name="power" />
                Bring online
              </button>
              <button
                onClick={v.dReturn}
                aria-disabled={v.d?.b?.ret?.dis}
                data-tip={v.d?.b?.ret?.why}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--ln-2)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: v.d?.b?.ret?.op,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="undo-2" />
                Return to primary
              </button>
              <button
                onClick={v.dSync}
                aria-disabled={v.d?.b?.sync?.dis}
                data-tip={v.d?.b?.sync?.why}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--ln-2)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: v.d?.b?.sync?.op,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="refresh-cw" />
                Sync now
              </button>
              <span style={{ flex: 1 }} />
              <button
                onClick={v.dDestroy}
                aria-disabled={v.d?.b?.destroy?.dis}
                data-tip={v.d?.b?.destroy?.why}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--err)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: v.d?.b?.destroy?.op,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--err-s)')}
              >
                <Icon name="trash-2" />
                Destroy resources…
              </button>
            </div>
            <Ind
              mode="underline"
              role="tablist"
              aria-label="Server sections"
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
              {v.d?.hasReason ? (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    marginBottom: '16px',
                    background: v.d?.rbg,
                    border: '1px solid var(--ln-2)'
                  }}
                >
                  <Icon name={v.d?.ri} style={{ color: v.d?.rc, marginTop: '2px' }} />
                  <span>{v.d?.reason}</span>
                </div>
              ) : null}
              {v.d?.syncing ? (
                <div style={{ marginBottom: '16px', padding: '12px 14px', border: '1px solid var(--ln)', background: 'var(--panel-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '13px/18px var(--f-ui)' }}>
                    <span>{v.d?.syncPhase}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.d?.syncPct}</span>
                  </div>
                  <div style={{ marginTop: '8px', height: '4px', background: 'var(--ln)' }}>
                    <div style={{ height: '4px', width: v.d?.syncW, background: 'var(--run)', transition: 'width 900ms linear' }} />
                  </div>
                </div>
              ) : null}
              {v.tab?.ov ? (
                <dl
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px minmax(0,1fr)',
                    font: '13px/18px var(--f-ui)',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  {arr(v.d?.facts).map((f: any, i: number) => (
                    <Fragment key={i}>
                      <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                      <dd
                        style={{
                          padding: '9px 0',
                          borderBottom: '1px solid var(--ln)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontStyle: f.fs,
                          color: f.c
                        }}
                      >
                        <Icon name={f.i} style={{ color: f.ic }} />
                        {f.v}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
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
                      gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) 96px 100px',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <div role="columnheader">Point in time (IST)</div>
                    <div role="columnheader">Kind</div>
                    <div role="columnheader" style={{ textAlign: 'right', paddingRight: '16px' }}>
                      Changed
                    </div>
                    <div role="columnheader">Verified</div>
                  </div>
                  {arr(v.d?.points).map((p: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) 96px 100px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <div role="cell">{p.t}</div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {p.kind}
                      </div>
                      <div role="cell" style={{ textAlign: 'right', paddingRight: '16px' }}>
                        {p.changed}
                      </div>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="circle-check" style={{ color: 'var(--ok)' }} />
                        Verified
                      </div>
                    </div>
                  ))}
                  {v.d?.noPoints ? (
                    <p style={{ padding: '16px 0', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>
                      Recovery points are not shown until the recovery site can be read.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {v.tab?.history ? (
                <div
                  role="table"
                  aria-label="Sync history"
                  style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums', animation: 'ae-fade 150ms var(--ease)' }}
                >
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.4fr) 120px 96px 96px',
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
                      Changed
                    </div>
                  </div>
                  {arr(v.d?.history).map((h: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.4fr) 120px 96px 96px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <div role="cell">{h.t}</div>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name={h.i} style={{ color: h.c }} />
                        {h.l}
                      </div>
                      <div role="cell" style={{ textAlign: 'right' }}>
                        {h.dur}
                      </div>
                      <div role="cell" style={{ textAlign: 'right' }}>
                        {h.changed}
                      </div>
                    </div>
                  ))}
                  <a
                    href="#/dr/history"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '12px',
                      font: '600 14px var(--f-body)',
                      color: 'var(--acc-tx)'
                    }}
                  >
                    Open History with phase times
                    <Icon name="arrow-right" />
                  </a>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
        {v.dlgOpen ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              display: 'grid',
              placeItems: 'center',
              padding: '24px',
              background: 'var(--scrim)',
              animation: v.scrimAnim
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dlg-title"
              style={{
                width: '600px',
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 48px)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--overlay)',
                border: '1px solid var(--ln-2)',
                boxShadow: 'var(--sh-over)',
                animation: v.dlgAnim
              }}
            >
              <div style={{ flex: 'none', padding: '20px 16px 0 24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{v.dlg?.server}</div>
                  <h2 id="dlg-title" style={{ marginTop: '2px', font: '500 20px/28px var(--f-head)' }}>
                    {v.dlg?.title}
                  </h2>
                  <p style={{ marginTop: '4px', color: 'var(--tx-2)', textWrap: 'pretty' }}>{v.dlg?.desc}</p>
                </div>
                <button
                  onClick={v.closeDlg}
                  aria-label="Close"
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
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px 24px' }}>
                {v.dlg?.isForm ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                      gap: '16px',
                      animation: 'ae-fade 150ms var(--ease)'
                    }}
                  >
                    {arr(v.dlg?.fields).map((f: any, i: number) => (
                      <div
                        key={i}
                        style={{ gridColumn: `span ${f.span}`, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}
                      >
                        <label htmlFor={f.id} style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                          {f.label}
                        </label>
                        {f.isSelect ? (
                          <select
                            id={f.id}
                            value={f.value ?? ''}
                            onChange={f.onChange}
                            style={{
                              height: '36px',
                              padding: '0 8px',
                              background: 'var(--panel-2)',
                              border: '1px solid var(--ln)',
                              font: '14px var(--f-body)'
                            }}
                          >
                            {arr(f.options).map((o: any, j: number) => (
                              <option key={j} value={o ?? ''}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {f.isInput ? (
                          <input
                            id={f.id}
                            value={f.value ?? ''}
                            onChange={f.onChange}
                            style={{
                              height: '36px',
                              padding: '0 10px',
                              background: 'var(--panel-2)',
                              border: '1px solid var(--ln)',
                              font: '14px var(--f-body)'
                            }}
                            className={pc('focus', 'border-color:var(--acc)')}
                          />
                        ) : null}
                        {f.hint ? <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{f.hint}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {v.dlg?.isDestroy ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'ae-fade 150ms var(--ease)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)' }}>
                      {arr(v.dlg?.ticks).map((tk: any, i: number) => (
                        <button
                          key={i}
                          role="checkbox"
                          aria-checked={tk.on}
                          aria-disabled={tk.dis}
                          data-tip={tk.why}
                          onClick={tk.onClick}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '16px minmax(0,1fr)',
                            gap: '12px',
                            alignItems: 'start',
                            padding: '12px 14px',
                            borderBottom: '1px solid var(--ln)',
                            background: tk.bg,
                            opacity: tk.op,
                            transition: 'background-color 100ms'
                          }}
                        >
                          <span
                            style={{
                              width: '16px',
                              height: '16px',
                              marginTop: '2px',
                              display: 'grid',
                              placeItems: 'center',
                              border: `1px solid ${tk.bd}`,
                              background: tk.cbg,
                              color: 'var(--acc-ink)',
                              transition: 'background-color 100ms,border-color 100ms'
                            }}
                          >
                            <Icon name={tk.icon} size="12" />
                          </span>
                          <span>
                            <span style={{ display: 'block', fontWeight: 600 }}>{tk.label}</span>
                            <span style={{ display: 'block', fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
                              {tk.detail}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{v.dlg?.keptLine}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="ds-confirm" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        Type <strong style={{ color: 'var(--tx)' }}>{v.dlg?.server}</strong> to confirm
                      </label>
                      <input
                        id="ds-confirm"
                        value={v.dlg?.typed ?? ''}
                        onChange={v.dsType}
                        autoComplete="off"
                        style={{
                          height: '36px',
                          padding: '0 10px',
                          background: 'var(--panel-2)',
                          border: '1px solid var(--ln)',
                          font: '14px var(--f-body)'
                        }}
                        className={pc('focus', 'border-color:var(--err)')}
                      />
                    </div>
                  </div>
                ) : null}
                {v.dlg?.isRun ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'ae-fade 150ms var(--ease)' }}>
                    <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {arr(v.dlg?.phases).map((ph: any, i: number) => (
                        <li
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '20px minmax(0,1fr) auto',
                            gap: '10px',
                            alignItems: 'center',
                            minHeight: '30px',
                            color: ph.fg,
                            transition: 'color 150ms'
                          }}
                        >
                          <Icon name={ph.i} spin={ph.spin} style={{ color: ph.ic }} />
                          <span style={{ fontWeight: ph.fw }}>{ph.label}</span>
                          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{ph.note}</span>
                        </li>
                      ))}
                    </ol>
                    <div style={{ height: '4px', background: 'var(--ln)' }}>
                      <div style={{ height: '4px', width: v.dlg?.pctW, background: v.dlg?.barC, transition: 'width 900ms linear' }} />
                    </div>
                    <div
                      ref={v.logRef}
                      role="log"
                      aria-live="polite"
                      aria-label="Live log"
                      style={{
                        height: '200px',
                        overflow: 'auto',
                        padding: '8px 12px',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--ln)',
                        font: '12px/20px var(--f-ui)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {arr(v.dlg?.log).map((ln: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '64px 16px minmax(0,1fr)',
                            gap: '8px',
                            alignItems: 'center',
                            animation: 'ae-line 150ms var(--ease)'
                          }}
                        >
                          <span style={{ color: 'var(--tx-3)' }}>{ln.t}</span>
                          <Icon name={ln.i} style={{ color: ln.c }} />
                          <span>{ln.text}</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{v.dlg?.runNote}</p>
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  padding: '12px 16px 12px 24px',
                  borderTop: '1px solid var(--ln)'
                }}
              >
                {v.dlg?.notRun ? (
                  <>
                    <button
                      onClick={v.closeDlg}
                      style={{ height: '32px', padding: '0 12px', fontWeight: 600, transition: 'background-color 100ms' }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={v.confirmDlg}
                      aria-disabled={v.dlg?.dis}
                      data-tip={v.dlg?.why}
                      style={{
                        height: '32px',
                        padding: '0 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: v.dlg?.btnBg,
                        color: 'var(--acc-ink)',
                        fontWeight: 600,
                        opacity: v.dlg?.op,
                        transition: 'background-color 100ms,opacity 100ms'
                      }}
                    >
                      <Icon name={v.dlg?.btnIcon} />
                      {v.dlg?.btn}
                    </button>
                  </>
                ) : null}
                {v.dlg?.isRun ? (
                  <button
                    onClick={v.closeDlg}
                    style={{
                      height: '32px',
                      padding: '0 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid var(--ln-2)',
                      fontWeight: 600,
                      transition: 'background-color 100ms'
                    }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    {v.dlg?.closeLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
function o_removed(o) {
  return !!(o && o.removed);
}
