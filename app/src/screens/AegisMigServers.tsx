/* Ported from project/AegisMigServers.dc.html */
import React, { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';
import AegisTable from '../components/AegisTable';
import { CutoverDialog } from '../products/mobility/Cutover';
import { INVENTORY } from '../products/mobility/data';
import { DangerDialog } from '../ui/overlay';
import { ProtectDialog } from '../products/mobility/Protect';

const SC = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', run: 'var(--run)', tx: 'var(--tx-3)' };
const NETS = {
  'production-openstack': ['prod-net', 'app-net', 'mig-test-isolated', 'dr-test-isolated'],
  'Chennai-proxmox-prod': ['vmbr0', 'vmbr20', 'vmbr99']
};
const ISOLATED = ['mig-test-isolated', 'dr-test-isolated', 'vmbr99'];
const VT = { 'production-openstack': ['ceph-ssd', 'standard'], 'Chennai-proxmox-prod': ['ceph-vm', 'local-lvm'] };
const FLAVORS = ['m1.large', 'm1.xlarge', 'm1.2xlarge', 'm1.4xlarge', 'm1.medium'];
const LINE_ICON = {
  info: ['circle-dot', 'var(--tx-3)'],
  ok: ['circle-check', 'var(--ok)'],
  warn: ['triangle-alert', 'var(--warn)'],
  err: ['circle-x', 'var(--err)']
};
const short = s => {
  const m = /(\d+) (\w+) \d+, (\d+:\d+)/.exec(s || '');
  return m ? `${m[1]} ${m[2]}, ${m[3]}` : '—';
};

export default class AegisMigServers extends DC {
  state: any = {
    src: 'All',
    host: 'All',
    ds: 'All',
    q: '',
    sel: {},
    drawer: null,
    closing: false,
    tab: 'Overview',
    dlg: null,
    dlgClosing: false,
    over: {},
    jobs: {},
    armed: null,
    cut: null,
    cutClosing: false,
    danger: null,
    dangerClosing: false,
    protect: null,
    protectClosing: false
  };
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
    this.setState({ closing: true, armed: null });
    setTimeout(() => this.setState({ drawer: null, closing: false }), 150);
  }
  closeDlg() {
    this.setState({ dlgClosing: true });
    setTimeout(() => this.setState({ dlg: null, dlgClosing: false }), 150);
  }
  patch(id, p) {
    this.setState(s => ({ over: { ...s.over, [id]: { ...(s.over[id] || {}), ...p } } }));
    // Keep Mobility › Overview and Sources in step with what happens here.
    const inv = INVENTORY.find(v => v.name === id);
    if (inv && p.stage) inv.stage = p.stage === 'notstarted' ? 'planned' : p.stage;
  }

  applyDone() {
    const ctx = this.props.ctx;
    if (!ctx) return;
    Object.entries(this.state.jobs).forEach(([sid, { id, kind }]: [string, any]) => {
      const j = ctx.jobs.find(x => x.id === id);
      if (j && j.status === 'ok') {
        const srv = this.servers().find(x => x.id === sid);
        const passes = (srv && srv.passes) || 0;
        const p = {
          first: { stage: 'synced', passes: 1, next: 'Test boot', last: ctx.now() },
          sync: {
            stage: srv && srv.stage === 'ready' ? 'ready' : 'synced',
            passes: passes + 1,
            last: ctx.now(),
            next: srv && srv.tested ? 'Cut over' : 'Test boot'
          },
          test: { stage: 'testing', next: 'End test' },
          cut: { stage: 'cutover', next: 'Commit or roll back', cutAt: ctx.now() }
        }[kind];
        this.setState(s => {
          const jobs = { ...s.jobs };
          delete jobs[sid];
          return { jobs, over: { ...s.over, [sid]: { ...(s.over[sid] || {}), ...p } } };
        });
      }
    });
  }

  servers() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    return A.migServers.map(x => {
      const o = this.state.over[x.id] || {};
      const jr = this.state.jobs[x.id];
      const live = jr && ctx.jobs.find(j => j.id === jr.id && j.status === 'run');
      const r = { ...x, ...o, live, jobKind: jr && jr.kind };
      if (x.id === 'win-ts-01' && !o.stage && !jr) r.seeded = ctx.jobs.find(j => j.object === 'win-ts-01' && j.status === 'run');
      return r;
    });
  }

  run(kind, srv) {
    const ctx = this.props.ctx;
    const n = (srv.passes || 0) + 1;
    const spec = {
      first: {
        name: 'First pass',
        phases: ['Queued', 'Snapshot source', 'Copy whole disk', 'Inject drivers', 'Done'],
        speed: 7,
        rate: '96 MB/s',
        lines: {
          'Inject drivers': srv.win
            ? 'Injecting VirtIO storage, network and balloon drivers…'
            : 'No driver injection needed for this guest OS'
        },
        doneToast: `First pass of ${srv.name} finished`
      },
      sync: {
        name: `Sync pass ${n}`,
        phases: ['Queued', 'Snapshot source', 'Read changes', 'Copy changes', 'Done'],
        speed: 16,
        rate: '142 MB/s',
        doneToast: `Sync pass ${n} of ${srv.name} finished`
      },
      test: {
        name: 'Test boot',
        phases: ['Clone copied disk', 'Attach test network', 'Boot clone', 'Check console', 'Done'],
        speed: 14,
        doneToast: `Test clone of ${srv.name} is running on ${srv.test}`
      },
      cut: {
        name: 'Cutover',
        phases: ['Power off source', 'Copy final changes', 'Boot at destination', 'Check console', 'Done'],
        speed: 10,
        rate: '160 MB/s',
        doneToast: `${srv.name} cut over to ${srv.dest}. Commit or roll back.`
      }
    }[kind];
    const id = ctx.startJob({ ...spec, object: srv.name, product: 'Migration', type: spec.name });
    this.setState(s => ({ jobs: { ...s.jobs, [srv.id]: { id, kind } } }));
    if (kind === 'first') this.patch(srv.id, { stage: 'first', next: 'Wait for first pass' });
  }

  act(key, srv) {
    const ctx = this.props.ctx;
    if (key === 'commit' || key === 'rollback') {
      this.setState({ danger: { kind: key, id: srv.id }, dangerClosing: false });
      return;
    }
    if (key === 'end') {
      this.patch(srv.id, { stage: 'ready', tested: true, next: 'Cut over' });
      ctx.toast(`Test of ${srv.name} ended. The clone was deleted.`, 'ok');
      return;
    }
    if (key === 'cut') {
      this.setState({ cut: srv.id, cutClosing: false });
      return;
    }
    this.run(key, srv);
  }

  /** Commit or roll back once the danger dialog is confirmed. */
  finishDanger(key, srv) {
    const ctx = this.props.ctx;
    if (key === 'commit') {
      this.patch(srv.id, { stage: 'committed', next: '—' });
      ctx.toast(`Migration of ${srv.name} committed`, 'ok');
      // Protection follows the workload: offer backup and DR from its tier straight away.
      setTimeout(() => this.setState({ protect: srv.name, protectClosing: false }), 200);
    } else {
      this.patch(srv.id, {
        stage: 'rolledback',
        next: 'Start first pass',
        rbReason: `Rolled back by priya.raman at ${ctx.now()}. The source was powered back on.`
      });
      ctx.toast(`${srv.name} rolled back. The source is running again.`, 'ok');
    }
  }

  closeLayer(key) {
    this.setState({ [key + 'Closing']: true });
    setTimeout(() => this.setState({ [key]: null, [key + 'Closing']: false }), 150);
  }

  openDlg(kind, srv) {
    const dest = srv.dest || 'production-openstack';
    const f = {
      dest,
      vt: srv.vt || VT[dest][0],
      flavor: srv.flavor || 'm1.large',
      cores: String(srv.cores || srv.cpu),
      mem: String(srv.memMb || srv.mem * 1024),
      net: srv.net || NETS[dest][0],
      test: srv.test || NETS[dest].find(n => ISOLATED.includes(n))
    };
    this.setState({ dlg: { kind, id: srv.id, f }, dlgClosing: false });
  }

  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    const empty: any = {
      filters: [],
      cols: [],
      rows: [],
      dtabs: [],
      tab: {},
      bm: {},
      bs: {},
      d: { timeline: [], actions: [], drivers: [], map: [], passes: [], tests: [], log: [] },
      dlg: { fields: [], steps: [] }
    };
    if (!A || !ctx) return empty;
    const s = this.state;
    const op = ctx.can('operate', 'Running migration steps');
    const cfg = ctx.can('configure', 'Editing a mapping');
    const all = this.servers();
    const uniq = k => (['All'] as any[]).concat([...new Set(A.migServers.map(x => x[k]))]);
    const filters = [
      ['Source', 'src', uniq('src')],
      ['Host', 'host', uniq('host')],
      ['Datastore', 'ds', uniq('ds')]
    ].map(([label, k, options]: any[]) => ({ label, value: s[k], options, onChange: e => this.setState({ [k]: e.target.value, sel: {} }) }));
    let rows = all.filter(
      x => (s.src === 'All' || x.src === s.src) && (s.host === 'All' || x.host === s.host) && (s.ds === 'All' || x.ds === s.ds)
    );
    const q = s.q.trim().toLowerCase();
    if (q) rows = rows.filter(x => (x.name + ' ' + x.os).toLowerCase().includes(q));
    const stageCell = x => {
      const live = x.live || x.seeded;
      if (live) return { t: 'status', i: 'loader-circle', spin: true, c: 'run', l: `${live.name} · ${Math.floor(live.pct)} %`, s: 1 };
      const st = A.migStage[x.stage];
      return { t: 'status', i: st[0], c: st[2], l: st[1], s: st[3], tip: x.rbReason || st[1] };
    };
    const tableRows = rows.map(x => ({
      id: x.id,
      name: x.name,
      src: x.src,
      os: x.os,
      spec: { v: `${x.cpu} vCPU · ${x.mem} GB`, s: x.cpu * 1000 + x.mem },
      disks: { v: String(x.disks), s: x.disks },
      size: { v: x.size >= 1000 ? `${(x.size / 1024).toFixed(2)} TB` : `${x.size.toFixed(2)} GB`, s: x.size },
      cbt: {
        t: 'status',
        i: x.cbt === 'On' ? 'circle-check' : 'circle-minus',
        c: x.cbt === 'On' ? 'ok' : 'tx',
        l: x.cbt,
        tip: x.cbt === 'On' ? 'Changed block tracking is on' : 'Off: every sync pass reads the whole disk'
      },
      stage: stageCell(x),
      next: x.next,
      last: { v: short(x.last), s: x.last || '' },
      dest: x.dest ? x.dest : { v: 'No mapping', muted: true, italic: true, s: null }
    }));
    const cols = [
      { k: 'name', label: 'Name', w: 'minmax(130px,1.2fr)' },
      { k: 'src', label: 'Source', w: 'minmax(110px,1fr)', dim: true },
      { k: 'os', label: 'Guest OS', w: 'minmax(140px,1.2fr)', dim: true },
      { k: 'spec', label: 'CPU and memory', w: '128px', dim: true },
      { k: 'disks', label: 'Disks', w: '64px', r: true },
      { k: 'size', label: 'Size', w: '96px', r: true },
      { k: 'cbt', label: 'Change tracking', w: '128px' },
      { k: 'stage', label: 'Stage', w: 'minmax(150px,1.3fr)' },
      { k: 'next', label: 'Next step', w: 'minmax(120px,1fr)', dim: true },
      { k: 'last', label: 'Last pass', w: '112px', dim: true },
      { k: 'dest', label: 'Destination', w: 'minmax(140px,1.2fr)' }
    ];
    const selIds = tableRows.map(r => r.id).filter(id => s.sel[id]);
    const one = selIds.length === 1 ? all.find(x => x.id === selIds[0]) : null;
    const g = (ok, why?) => (ok ? { dis: undefined, why: undefined, op: 1, ok: true } : { dis: 'true', why, op: 0.45, ok: false });
    const bm = !op.ok
      ? g(false, op.why)
      : !one
        ? g(false, 'Select one server.')
        : !['notstarted', 'rolledback'].includes(one.stage)
          ? g(false, `${one.name} is already migrating.`)
          : g(true);
    const syncable = x => ['synced', 'ready'].includes(x.stage) && !x.live;
    const bs = !op.ok
      ? g(false, op.why)
      : !selIds.length
        ? g(false, 'Select one or more servers first.')
        : !all.filter(x => selIds.includes(x.id)).every(syncable)
          ? g(false, 'Sync works after the first pass, before cutover.')
          : g(true);

    const dsrv = s.drawer && all.find(x => x.id === s.drawer);
    let d = empty.d;
    if (dsrv) {
      const st = stageCell(dsrv);
      const live = dsrv.live || dsrv.seeded;
      const idx = { notstarted: -1, first: 0, synced: 1, testing: 2, ready: 2, cutover: 3, committed: 4, rolledback: 4 }[dsrv.stage];
      const doneIdx = { notstarted: -1, first: -1, synced: 1, testing: 1, ready: 2, cutover: 3, committed: 4, rolledback: 4 }[dsrv.stage];
      const labels = [
        ['First pass', dsrv.passes ? 'Whole disk copied' : 'Copies the whole disk'],
        ['Sync passes', dsrv.passes > 1 ? `${dsrv.passes - 1} done` : 'Changes only'],
        [
          'Test boot',
          dsrv.tested || ['ready', 'cutover', 'committed'].includes(dsrv.stage)
            ? 'Tested'
            : dsrv.stage === 'testing'
              ? 'Clone running'
              : 'On an isolated network'
        ],
        ['Cutover', dsrv.cutAt ? short(dsrv.cutAt) : 'Source is powered off'],
        ['Commit or roll back', dsrv.stage === 'committed' ? 'Committed' : dsrv.stage === 'rolledback' ? 'Rolled back' : 'Final decision']
      ];
      const timeline = labels.map(([label, sub], i) => {
        const done = i <= doneIdx;
        const cur = !done && (i === idx || (live && i === Math.max(0, idx)));
        return {
          label,
          sub,
          current: cur ? 'step' : undefined,
          i: done ? 'check' : cur ? (live ? 'loader-circle' : 'circle-dot') : '',
          spin: cur && live ? 'true' : 'false',
          bd: done || cur ? 'var(--acc)' : 'var(--ln-2)',
          bg: done ? 'var(--acc)' : 'transparent',
          fg: done ? 'var(--acc-ink)' : 'var(--acc-tx)',
          line: i < 4 ? (i < doneIdx ? 'var(--acc)' : 'var(--ln)') : 'transparent',
          tc: done || cur ? 'var(--tx)' : 'var(--tx-3)'
        };
      });
      const hasMap = !!dsrv.dest;
      const busy = !!live;
      const A2 = (key, label, icon, consequence, enabled, why, danger?) => {
        const armed = s.armed === key;
        const ok = op.ok && enabled && !busy;
        return {
          key,
          label,
          icon,
          consequence: armed
            ? key === 'commit'
              ? 'Click again to commit. This cannot be undone.'
              : 'Click again to roll back. The migrated server is deleted.'
            : consequence,
          cc: armed ? 'var(--err)' : 'var(--tx-2)',
          btn: armed ? (key === 'commit' ? 'Confirm commit' : 'Confirm roll back') : label,
          dis: ok ? undefined : 'true',
          why: !op.ok ? op.why : busy ? 'A job is running for this server.' : enabled ? undefined : why,
          op: ok ? 1 : 0.45,
          rowOp: ok || armed ? 1 : 0.7,
          bd: armed ? 'var(--err)' : 'var(--ln-2)',
          bg: armed ? 'var(--err)' : 'transparent',
          fg: armed ? 'var(--acc-ink)' : danger ? 'var(--err)' : 'var(--tx)',
          onClick: () => {
            if (ok) this.act(key, dsrv);
          }
        };
      };
      const stg = dsrv.stage;
      const actions = [
        A2(
          'first',
          'Start first pass',
          'play',
          'Copies the whole server while it keeps running. Nothing on the source is changed.',
          ['notstarted', 'rolledback'].includes(stg) && hasMap,
          hasMap ? 'The first pass has already run.' : 'Set a mapping first.'
        ),
        A2(
          'sync',
          'Sync',
          'refresh-cw',
          'Copies only what changed since the last pass. The source keeps running.',
          ['synced', 'ready'].includes(stg),
          'Available after the first pass, before cutover.'
        ),
        A2(
          'test',
          'Test boot',
          'flask-conical',
          `Clones the copied disk and starts it on ${dsrv.test || 'the test network'}. The source keeps running.`,
          ['synced', 'ready'].includes(stg) && hasMap,
          'Available after the first pass.'
        ),
        A2(
          'end',
          'End test',
          'circle-stop',
          'Stops the test clone and deletes it. Copied data is kept.',
          stg === 'testing',
          'No test boot is running.'
        ),
        A2(
          'cut',
          'Cut over',
          'power',
          `Powers off the source, copies the final changes and starts ${dsrv.name} at ${dsrv.dest || 'the destination'}.`,
          ['synced', 'ready'].includes(stg) && hasMap,
          'Available after at least one sync pass.'
        ),
        A2(
          'commit',
          'Commit',
          'git-commit',
          'Keeps the migrated server and releases the source snapshot. Cannot be undone.',
          stg === 'cutover',
          'Available after cutover.'
        ),
        A2(
          'rollback',
          'Roll back',
          'undo-2',
          'Deletes the migrated server and powers the source back on.',
          stg === 'cutover',
          'Available after cutover.',
          true
        )
      ];
      const passN = dsrv.passes || 0;
      const passes = Array.from({ length: passN }, (_, i) => ({
        n: String(i + 1),
        kind: i === 0 ? 'First pass' : 'Sync pass',
        t: `${20 - Math.min(3, passN - 1 - i)} Oct 2026, ${String(9 + i * 2).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`,
        changed: i === 0 ? `${dsrv.size.toFixed(2)} GB` : `${(dsrv.size * (0.04 / i)).toFixed(2)} GB`,
        speed: `${i === 0 ? 96 : 140 + i * 6} MB/s`,
        dur: i === 0 ? `${Math.round(dsrv.size / 5.8)} min` : `${Math.max(2, Math.round((dsrv.size * 0.04) / i / 8.4))} min`
      })).reverse();
      const testsRun = dsrv.stage === 'testing' || dsrv.tested || ['ready', 'cutover', 'committed'].includes(dsrv.stage);
      const logSrc = live ? live.log : null;
      d = {
        name: dsrv.name,
        src: dsrv.src,
        dest: dsrv.dest || 'no mapping',
        os: dsrv.os,
        spec: `${dsrv.cpu} vCPU · ${dsrv.mem} GB · ${dsrv.disks} ${dsrv.disks === 1 ? 'disk' : 'disks'}`,
        si: st.i,
        sl: st.l,
        sc: SC[st.c],
        spin: st.spin ? 'true' : 'false',
        hasNote: !!dsrv.rbReason || dsrv.cbt === 'Off',
        note: dsrv.rbReason || 'Change tracking is off on the source. Every sync pass reads the whole disk.',
        timeline,
        actions,
        running: !!live,
        runLabel: live ? `${live.name}: ${live.phases[live.phase]}` : '',
        runPct: live ? `${Math.floor(live.pct)} %` : '',
        runW: live ? `${live.pct}%` : '0%',
        win: !!dsrv.win,
        drivers: ['VirtIO storage', 'VirtIO network', 'VirtIO balloon'].map(label => ({
          label,
          i: passN ? 'circle-check' : 'circle',
          c: passN ? 'var(--ok)' : 'var(--tx-3)',
          state: passN ? 'Injected in pass 1' : 'Injected during the first pass'
        })),
        hasMap: !!dsrv.dest,
        noMap: !dsrv.dest,
        map: [
          { k: 'Destination site', v: dsrv.dest },
          { k: 'Volume type', v: dsrv.vt },
          dsrv.flavor ? { k: 'Flavor', v: dsrv.flavor } : { k: 'Cores and memory', v: `${dsrv.cores} cores, ${dsrv.memMb} MB` },
          { k: 'Network', v: dsrv.net },
          { k: 'Test network', v: dsrv.test },
          { k: 'Firmware', v: /2019|2022|24\.04|RHEL|Red Hat Enterprise Linux 8/.test(dsrv.os) ? 'UEFI (OVMF), Secure Boot off' : 'BIOS (SeaBIOS)' },
          { k: 'Boot disk', v: 'Disk 1, VirtIO SCSI single' },
          { k: 'Machine type', v: dsrv.dest === 'production-openstack' ? 'q35 (image property hw_machine_type)' : 'q35' }
        ],
        passes,
        noPasses: passN === 0,
        verified: passN ? `Verified after pass ${passN}: byte-for-byte checksums of ${dsrv.disks} ${dsrv.disks === 1 ? 'disk match' : 'disks match'} the source.` : '',
        tests: testsRun
          ? [
              {
                label:
                  dsrv.stage === 'testing' ? `Test clone ${dsrv.name}-test running on ${dsrv.test}` : `Test boot passed on ${dsrv.test}`,
                i: dsrv.stage === 'testing' ? 'loader-circle' : 'circle-check',
                spin: dsrv.stage === 'testing' ? 'true' : 'false',
                c: dsrv.stage === 'testing' ? 'var(--run)' : 'var(--ok)',
                when: dsrv.stage === 'testing' ? 'Started 21 Oct, 14:55' : '20 Oct, 16:20'
              }
            ]
          : [],
        noTests: !testsRun,
        consoleOn: dsrv.stage === 'testing',
        console: dsrv.win
          ? `Windows Server ${dsrv.os.replace(/\D+/g, '')}\n\nApplying computer settings...\n\n${dsrv.name.toUpperCase()}-TEST\nPress Ctrl+Alt+Delete to sign in.`
          : `${dsrv.os}\nKernel 5.15 on x86_64\n\n${dsrv.name}-test login: _`,
        consoleCap: `Console of ${dsrv.name}-test · read only · refreshed every 5 s`,
        log: (
          logSrc ||
          [
            { t: '20 Oct 16:20:04', text: 'Test boot passed: console reached the login prompt', lv: 'ok' },
            { t: '20 Oct 16:12:40', text: `Sync pass ${Math.max(1, passN)} finished`, lv: 'ok' },
            { t: '20 Oct 09:00:12', text: 'First pass finished', lv: 'ok' }
          ].slice(0, passN ? 3 : 0)
        ).map(l => ({ ...l, i: LINE_ICON[l.lv][0], c: LINE_ICON[l.lv][1] }))
      };
    }
    const dtabs = [
      ['Overview', ''],
      ['Mapping', ''],
      ['Passes', dsrv ? String(dsrv.passes || 0) : ''],
      ['Tests', ''],
      ['Log', '']
    ].map(([t, n]) => ({
      label: t,
      n,
      on: s.tab === t,
      fg: s.tab === t ? 'var(--tx)' : 'var(--tx-2)',
      onClick: () => this.setState({ tab: t })
    }));

    const G = s.dlg;
    let dlg = empty.dlg;
    if (G) {
      const srv = all.find(x => x.id === G.id);
      const f = G.f;
      const set = k => e => {
        const v = e.target.value;
        this.setState(st => ({
          dlg: {
            ...st.dlg,
            f: {
              ...st.dlg.f,
              [k]: v,
              ...(k === 'dest' ? { vt: VT[v][0], net: NETS[v][0], test: NETS[v].find(n => ISOLATED.includes(n)) } : {})
            }
          }
        }));
      };
      const F = (k, label, opts?, extra?) => ({
        id: 'mf-' + k,
        label,
        value: f[k],
        options: opts || [],
        isSelect: !!opts,
        isInput: !opts,
        onChange: set(k),
        span: 1,
        hint: '',
        hi: '',
        hc: 'var(--tx-3)',
        bd: 'var(--ln)',
        ...(extra || {})
      });
      const osDest = f.dest === 'production-openstack';
      const testIso = ISOLATED.includes(f.test);
      const fields = [
        F('dest', 'Destination site', ['production-openstack', 'Chennai-proxmox-prod'], { span: 2 }),
        F('vt', 'Volume type', VT[f.dest])
      ].concat(osDest ? [F('flavor', 'Flavor', FLAVORS)] : [F('cores', 'Cores'), F('mem', 'Memory (MB)')], [
        F('net', 'Network', NETS[f.dest]),
        F('test', 'Test network', NETS[f.dest], {
          hint: testIso ? 'Isolated from production' : 'Not isolated: the clone will share the production address',
          hi: testIso ? 'circle-check' : 'triangle-alert',
          hc: testIso ? 'var(--ok)' : 'var(--warn)',
          bd: testIso ? 'var(--ln)' : 'var(--warn)'
        })
      ]);
      if (G.kind === 'migrate')
        dlg = {
          title: `Migrate ${srv.name}`,
          desc: 'The first pass copies the whole server while it keeps running. Nothing on the source is changed or removed.',
          isMap: false,
          isCut: false,
          hasFields: true,
          fields,
          steps: [],
          btn: 'Start first pass',
          icon: 'play',
          dis: undefined,
          op: 1
        };
      else if (G.kind === 'map')
        dlg = {
          title: `Mapping for ${srv.name}`,
          desc: 'Where the migrated server lands. Required before a test boot or cutover.',
          isMap: true,
          isCut: false,
          hasFields: true,
          fields,
          steps: [],
          btn: 'Save mapping',
          icon: 'check',
          dis: undefined,
          op: 1
        };
      else
        dlg = {
          title: `Cut over ${srv.name}`,
          desc: 'This ends the migration window for this server. Exactly this happens:',
          isMap: false,
          isCut: true,
          hasFields: false,
          fields: [],
          steps: [
            { i: 'power', text: `${srv.name} on ${srv.src} is powered off.` },
            { i: 'refresh-cw', text: 'The final changes are copied. This takes about 2 min.' },
            { i: 'play', text: `${srv.name} starts at ${srv.dest} on ${srv.net}.` },
            { i: 'undo-2', text: 'Until you commit, you can roll back: the migrated server is deleted and the source is powered on again.' }
          ],
          btn: 'Cut over',
          icon: 'power',
          dis: undefined,
          op: 1
        };
    }

    return {
      ui: ctx.ui,
      unit: ['server', 'servers'],
      filters,
      q: s.q,
      onQ: e => this.setState({ q: e.target.value }),
      filtered: s.src !== 'All' || s.host !== 'All' || s.ds !== 'All' || !!q,
      clearFilters: () => this.setState({ src: 'All', host: 'All', ds: 'All', q: '' }),
      selLabel: selIds.length ? `${selIds.length} selected` : '',
      bm,
      bs,
      tMigrate: () => {
        if (bm.ok) this.openDlg('migrate', one);
      },
      tSync: () => {
        if (bs.ok) {
          all.filter(x => selIds.includes(x.id)).forEach(x => this.run('sync', x));
          this.setState({ sel: {} });
          ctx.toast(selIds.length === 1 ? `Sync of ${one.name} started` : `Sync of ${selIds.length} servers started`, 'info');
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
      openServer: id => this.setState({ drawer: id, tab: s.drawer === id ? s.tab : 'Overview', closing: false, armed: null }),
      goSites: () => ctx.go('sites'),
      dOpen: !!dsrv,
      dAnim: s.closing ? 'ae-drawer-out 150ms var(--ease) forwards' : 'ae-drawer 150ms var(--ease)',
      d,
      dtabs,
      tab: {
        ov: s.tab === 'Overview',
        map: s.tab === 'Mapping',
        passes: s.tab === 'Passes',
        tests: s.tab === 'Tests',
        log: s.tab === 'Log'
      },
      closeDrawer: () => this.closeDrawer(),
      logRef: this.logRef,
      cfgDis: cfg.dis,
      cfgWhy: cfg.why,
      cfgOp: cfg.op,
      dEditMap: () => {
        if (cfg.ok && dsrv) this.openDlg('map', dsrv);
      },
      dlgOpen: !!G,
      dlg,
      dlgAnim: s.dlgClosing ? 'ae-dialog-out 150ms var(--ease) forwards' : 'ae-dialog 150ms var(--ease)',
      scrimAnim: s.dlgClosing ? 'ae-fade-out 150ms var(--ease) forwards' : 'ae-fade 120ms var(--ease)',
      closeDlg: () => this.closeDlg(),
      confirmDlg: () => {
        if (!G) return;
        const srv = all.find(x => x.id === G.id);
        const f = G.f;
        const map = {
          dest: f.dest,
          vt: f.vt,
          net: f.net,
          test: f.test,
          ...(f.dest === 'production-openstack'
            ? { flavor: f.flavor, cores: null, memMb: null }
            : { flavor: null, cores: +f.cores, memMb: +f.mem })
        };
        if (G.kind === 'map') {
          this.patch(srv.id, { ...map, next: srv.stage === 'notstarted' ? 'Start first pass' : srv.next });
          ctx.toast(`Mapping for ${srv.name} saved`, 'ok');
        } else if (G.kind === 'migrate') {
          this.patch(srv.id, map);
          this.run('first', { ...srv, ...map });
          ctx.toast(`First pass of ${srv.name} started`, 'info', {
            label: 'View',
            run: () => this.setState({ drawer: srv.id, tab: 'Overview' })
          });
          this.setState({ sel: {} });
        } else {
          this.run('cut', srv);
          ctx.toast(`Cutover of ${srv.name} started. The source is powering off.`, 'warn');
        }
        this.closeDlg();
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
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Mobility</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Servers</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>
              Virtual machines on VMware sources, and where each one is in its migration.
            </p>
          </div>
          <a
            href="#/mig/plans"
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
            <Icon name="route" />
            Migration plans
          </a>
        </div>
        {this.props.tabs}
        <div style={{ flex: 'none', padding: '0 24px 12px', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px' }}>
          {arr(v.filters).map((fl: any, i: number) => (
            <label
              key={i}
              style={{
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 4px 0 10px',
                border: '1px solid var(--ln-2)',
                background: 'var(--panel)',
                font: '13px var(--f-ui)',
                color: 'var(--tx-2)'
              }}
            >
              {fl.label}
              <select
                value={fl.value ?? ''}
                onChange={fl.onChange}
                aria-label={fl.label}
                style={{ height: '30px', border: 0, background: 'transparent', color: 'var(--tx)', font: '13px var(--f-ui)' }}
              >
                {arr(fl.options).map((o: any, j: number) => (
                  <option key={j} value={o ?? ''}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div style={{ position: 'relative', width: '200px' }}>
            <Icon name="filter" style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--tx-3)', pointerEvents: 'none' }} />
            <input
              value={v.q ?? ''}
              onChange={v.onQ}
              placeholder="Filter by name or OS"
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
          <button
            onClick={v.tMigrate}
            aria-disabled={v.bm?.dis}
            data-tip={v.bm?.why}
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
              opacity: v.bm?.op,
              transition: 'background-color 100ms,opacity 100ms'
            }}
            className={pc('hover', 'background:var(--acc-h)')}
          >
            <Icon name="forward" />
            Migrate
          </button>
          <button
            onClick={v.tSync}
            aria-disabled={v.bs?.dis}
            data-tip={v.bs?.why}
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
              opacity: v.bs?.op,
              transition: 'background-color 100ms'
            }}
            className={pc('hover', 'background:var(--hover)')}
          >
            <Icon name="refresh-cw" />
            Sync
          </button>
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
              label="Migration servers"
              unit={v.unit}
              footR="Times in IST"
              filtered={v.filtered}
              onClear={v.clearFilters}
              emptyText="No VMware source is connected yet. Add a source platform to list its virtual machines."
              emptyAction="Add source platform"
              onEmpty={v.goSites}
              unreachText="Could not be read: Chennai vCenter did not answer within 30 s."
              sort="name"
            />
          </div>
        </div>
        {v.dOpen ? (
          <aside
            role="dialog"
            aria-label="Migration details"
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
                  Migration · <span>{v.d?.src}</span> → <span>{v.d?.dest}</span>
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
                    gap: '16px',
                    font: '13px/18px var(--f-ui)',
                    color: 'var(--tx-2)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name={v.d?.si} spin={v.d?.spin} style={{ color: v.d?.sc }} />
                    <span style={{ color: 'var(--tx)' }}>{v.d?.sl}</span>
                  </span>
                  <span>{v.d?.os}</span>
                  <span>{v.d?.spec}</span>
                </div>
              </div>
              <button
                onClick={v.closeDrawer}
                aria-label="Close migration details"
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
            <Ind
              mode="underline"
              role="tablist"
              aria-label="Migration sections"
              style={{ flex: 'none', display: 'flex', padding: '12px 16px 0', borderBottom: '1px solid var(--ln)' }}
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
              {v.d?.hasNote ? (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    marginBottom: '16px',
                    background: 'var(--warn-s)',
                    border: '1px solid var(--ln-2)'
                  }}
                >
                  <Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: '2px' }} />
                  <span>{v.d?.note}</span>
                </div>
              ) : null}
              {v.tab?.ov ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'ae-fade 150ms var(--ease)' }}>
                  <ol
                    aria-label="Stages"
                    style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}
                  >
                    {arr(v.d?.timeline).map((st: any, i: number) => (
                      <li key={i} aria-current={st.current} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              flex: 'none',
                              display: 'grid',
                              placeItems: 'center',
                              border: `1px solid ${st.bd}`,
                              background: st.bg,
                              color: st.fg,
                              transition: 'all 150ms'
                            }}
                          >
                            <Icon name={st.i} size="12" spin={st.spin} />
                          </span>
                          <span style={{ flex: 1, height: '2px', background: st.line, transition: 'background-color 150ms' }} />
                        </span>
                        <span style={{ font: '600 13px/18px var(--f-body)', color: st.tc }}>{st.label}</span>
                        <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', paddingRight: '8px' }}>{st.sub}</span>
                      </li>
                    ))}
                  </ol>
                  {v.d?.running ? (
                    <div style={{ padding: '12px 14px', border: '1px solid var(--ln)', background: 'var(--panel-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', font: '13px/18px var(--f-ui)' }}>
                        <span>{v.d?.runLabel}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.d?.runPct}</span>
                      </div>
                      <div style={{ marginTop: '8px', height: '4px', background: 'var(--ln)' }}>
                        <div style={{ height: '4px', width: v.d?.runW, background: 'var(--run)', transition: 'width 900ms linear' }} />
                      </div>
                    </div>
                  ) : null}
                  <section>
                    <h3 style={{ font: '600 15px/22px var(--f-body)', marginBottom: '4px' }}>Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--ln)' }}>
                      {arr(v.d?.actions).map((ac: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '20px minmax(0,1fr) auto',
                            gap: '12px',
                            alignItems: 'center',
                            padding: '10px 0',
                            borderBottom: '1px solid var(--ln)',
                            opacity: ac.rowOp,
                            transition: 'opacity 150ms'
                          }}
                        >
                          <Icon name={ac.icon} style={{ color: 'var(--tx-2)' }} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 600 }}>{ac.label}</span>
                            <span style={{ display: 'block', fontSize: '13px', lineHeight: '18px', color: ac.cc, textWrap: 'pretty' }}>
                              {ac.consequence}
                            </span>
                          </span>
                          <button
                            onClick={ac.onClick}
                            aria-disabled={ac.dis}
                            data-tip={ac.why}
                            style={{
                              height: '30px',
                              padding: '0 12px',
                              whiteSpace: 'nowrap',
                              fontWeight: 600,
                              border: `1px solid ${ac.bd}`,
                              background: ac.bg,
                              color: ac.fg,
                              opacity: ac.op,
                              transition: 'background-color 120ms,color 120ms,border-color 120ms'
                            }}
                          >
                            {ac.btn}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                  {v.d?.win ? (
                    <section>
                      <h3 style={{ font: '600 15px/22px var(--f-body)', marginBottom: '4px' }}>Drivers injected</h3>
                      <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)', marginBottom: '8px' }}>
                        Windows guests get VirtIO drivers during the first pass so they boot on the destination.
                      </p>
                      {arr(v.d?.drivers).map((dv: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            height: '32px',
                            borderBottom: '1px solid var(--ln)',
                            font: '13px var(--f-ui)'
                          }}
                        >
                          <Icon name={dv.i} style={{ color: dv.c }} />
                          <span style={{ flex: 1 }}>{dv.label}</span>
                          <span style={{ color: 'var(--tx-3)' }}>{dv.state}</span>
                        </div>
                      ))}
                    </section>
                  ) : null}
                </div>
              ) : null}
              {v.tab?.map ? (
                <div style={{ animation: 'ae-fade 150ms var(--ease)' }}>
                  {v.d?.hasMap ? (
                    <>
                      <dl style={{ display: 'grid', gridTemplateColumns: '168px minmax(0,1fr)', font: '13px/18px var(--f-ui)' }}>
                        {arr(v.d?.map).map((f: any, i: number) => (
                          <Fragment key={i}>
                            <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                            <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)' }}>{f.v}</dd>
                          </Fragment>
                        ))}
                      </dl>
                      <button
                        onClick={v.dEditMap}
                        aria-disabled={v.cfgDis}
                        data-tip={v.cfgWhy}
                        style={{
                          marginTop: '16px',
                          height: '32px',
                          padding: '0 12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          border: '1px solid var(--ln-2)',
                          fontWeight: 600,
                          opacity: v.cfgOp
                        }}
                        className={pc('hover', 'background:var(--hover)')}
                      >
                        <Icon name="pencil" />
                        Edit mapping
                      </button>
                    </>
                  ) : null}
                  {v.d?.noMap ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', padding: '24px 0' }}>
                      <p style={{ color: 'var(--tx-2)' }}>No mapping yet. A mapping is required before a test boot or cutover.</p>
                      <button
                        onClick={v.dEditMap}
                        aria-disabled={v.cfgDis}
                        data-tip={v.cfgWhy}
                        style={{
                          height: '32px',
                          padding: '0 14px',
                          background: 'var(--acc)',
                          color: 'var(--acc-ink)',
                          fontWeight: 600,
                          opacity: v.cfgOp
                        }}
                        className={pc('hover', 'background:var(--acc-h)')}
                      >
                        Set mapping
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {v.tab?.passes ? (
                <div
                  role="table"
                  aria-label="Passes"
                  style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums', animation: 'ae-fade 150ms var(--ease)' }}
                >
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px minmax(0,1fr) minmax(0,1.3fr) 100px 88px 96px',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <div role="columnheader">Pass</div>
                    <div role="columnheader">Kind</div>
                    <div role="columnheader">Started (IST)</div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Data changed
                    </div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Speed
                    </div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Duration
                    </div>
                  </div>
                  {arr(v.d?.passes).map((p: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '56px minmax(0,1fr) minmax(0,1.3fr) 100px 88px 96px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <div role="cell">{p.n}</div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {p.kind}
                      </div>
                      <div role="cell">{p.t}</div>
                      <div role="cell" style={{ textAlign: 'right' }}>
                        {p.changed}
                      </div>
                      <div role="cell" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>
                        {p.speed}
                      </div>
                      <div role="cell" style={{ textAlign: 'right' }}>
                        {p.dur}
                      </div>
                    </div>
                  ))}
                  {v.d?.verified ? (
                    <p style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 0', fontFamily: 'var(--f-body)' }}>
                      <Icon name="copy-check" style={{ color: 'var(--ok)' }} />
                      {v.d.verified}
                    </p>
                  ) : null}
                  {v.d?.noPasses ? (
                    <p style={{ padding: '16px 0', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>
                      No passes yet. The first pass copies the whole server while it keeps running.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {v.tab?.tests ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'ae-fade 150ms var(--ease)' }}>
                  {arr(v.d?.tests).map((ts: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        border: '1px solid var(--ln)',
                        background: 'var(--panel-2)',
                        font: '13px var(--f-ui)'
                      }}
                    >
                      <Icon name={ts.i} spin={ts.spin} style={{ color: ts.c }} />
                      <span style={{ flex: 1 }}>{ts.label}</span>
                      <span style={{ color: 'var(--tx-3)' }}>{ts.when}</span>
                    </div>
                  ))}
                  {v.d?.consoleOn ? (
                    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div
                        role="img"
                        aria-label="Console of the test clone"
                        style={{
                          height: '220px',
                          padding: '12px 14px',
                          background: 'oklch(0.13 0.01 255)',
                          color: 'oklch(0.88 0.01 255)',
                          font: '12px/18px var(--f-ui)',
                          border: '1px solid var(--ln-2)',
                          overflow: 'hidden',
                          whiteSpace: 'pre'
                        }}
                      >
                        {v.d?.console}
                      </div>
                      <figcaption style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{v.d?.consoleCap}</figcaption>
                    </figure>
                  ) : null}
                  {v.d?.noTests ? (
                    <p style={{ color: 'var(--tx-2)' }}>
                      No test boots yet. A test boot starts a clone on the test network while the source keeps running.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {v.tab?.log ? (
                <div
                  ref={v.logRef}
                  role="log"
                  aria-label="Migration log"
                  style={{
                    height: '100%',
                    minHeight: '320px',
                    overflow: 'auto',
                    padding: '8px 12px',
                    background: 'var(--panel-2)',
                    border: '1px solid var(--ln)',
                    font: '12px/20px var(--f-ui)',
                    fontVariantNumeric: 'tabular-nums',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  {arr(v.d?.log).map((ln: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 16px minmax(0,1fr)',
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
              aria-labelledby="mig-title"
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
                  <h2 id="mig-title" style={{ font: '500 20px/28px var(--f-head)' }}>
                    {v.dlg?.title}
                  </h2>
                  <p style={{ marginTop: '4px', color: 'var(--tx-2)', textWrap: 'pretty' }}>{v.dlg?.desc}</p>
                </div>
                <button
                  onClick={v.closeDlg}
                  aria-label="Close"
                  style={{ width: '32px', height: '32px', display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}
                  className={pc('hover', 'background:var(--hover);color:var(--tx)')}
                >
                  <Icon name="x" size="20" />
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                {v.dlg?.isMap ? (
                  <div
                    role="note"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      background: 'var(--warn-s)',
                      border: '1px solid var(--ln-2)'
                    }}
                  >
                    <Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: '2px' }} />
                    <span style={{ fontSize: '13px', lineHeight: '18px', textWrap: 'pretty' }}>
                      A test boot clones the copied disk and starts it while the original server is still running, so the clone comes up
                      holding the same address as the original. Choose a network that is isolated from production, or the clone will fight
                      the server you are migrating.
                    </span>
                  </div>
                ) : null}
                {v.dlg?.isCut ? (
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)' }}>
                    {arr(v.dlg?.steps).map((x: any, i: number) => (
                      <li
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--ln)'
                        }}
                      >
                        <Icon name={x.i} style={{ color: 'var(--tx-2)', marginTop: '2px' }} />
                        <span>{x.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {v.dlg?.hasFields ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px' }}>
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
                              border: `1px solid ${f.bd}`,
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
                            inputMode="numeric"
                            style={{
                              height: '36px',
                              padding: '0 10px',
                              background: 'var(--panel-2)',
                              border: '1px solid var(--ln)',
                              font: '14px var(--f-body)',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                            className={pc('focus', 'border-color:var(--acc)')}
                          />
                        ) : null}
                        {f.hint ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '12px/16px var(--f-ui)', color: f.hc }}>
                            <Icon name={f.hi} />
                            {f.hint}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  flex: 'none',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  padding: '12px 16px 12px 24px',
                  borderTop: '1px solid var(--ln)'
                }}
              >
                <button
                  onClick={v.closeDlg}
                  style={{ height: '32px', padding: '0 12px', fontWeight: 600 }}
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
                    background: 'var(--acc)',
                    color: 'var(--acc-ink)',
                    fontWeight: 600,
                    opacity: v.dlg?.op,
                    transition: 'background-color 100ms,opacity 100ms'
                  }}
                  className={pc('hover', 'background:var(--acc-h)')}
                >
                  <Icon name={v.dlg?.icon} />
                  {v.dlg?.btn}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {this.state.cut ? (
          <CutoverDialog
            ctx={this.props.ctx}
            srv={this.servers().find(x => x.id === this.state.cut)}
            closing={this.state.cutClosing}
            onClose={() => this.closeLayer('cut')}
            onGo={note => {
              const srv = this.servers().find(x => x.id === this.state.cut);
              this.run('cut', srv);
              this.props.ctx.toast(`Cutover of ${srv.name} started. ${note}`, 'warn');
            }}
          />
        ) : null}
        {this.state.danger
          ? (() => {
              const srv = this.servers().find(x => x.id === this.state.danger.id);
              const commit = this.state.danger.kind === 'commit';
              return (
                <DangerDialog
                  title={commit ? `Commit the migration of ${srv.name}` : `Roll back ${srv.name}`}
                  intro={commit ? `Keeps ${srv.name} at ${srv.dest} for good and releases the source. This cannot be undone.` : `Deletes the copy at ${srv.dest} and starts ${srv.name} again on ${srv.src}.`}
                  removed={
                    commit
                      ? [`The snapshot of ${srv.name} on ${srv.src} that a roll back needs`, `Roll back for ${srv.name}`, 'Change tracking on the source VM']
                      : [`${srv.name} at ${srv.dest}, and everything written to it since the cutover${srv.cutAt ? ` at ${srv.cutAt}` : ''}`, 'The cutover itself; the wave shows this server as rolled back']
                  }
                  kept={commit ? `${srv.name} keeps running at ${srv.dest}. The source stays powered off; delete it in vCenter when you are ready. Backup and DR start from its criticality tier.` : `Copied data is kept, so the next attempt starts with a sync pass instead of a full copy.`}
                  name={srv.name}
                  action={commit ? 'Commit' : 'Roll back'}
                  icon={commit ? 'git-commit' : 'undo-2'}
                  closing={this.state.dangerClosing}
                  onClose={() => this.closeLayer('danger')}
                  onConfirm={() => {
                    this.finishDanger(this.state.danger.kind, srv);
                    this.closeLayer('danger');
                  }}
                />
              );
            })()
          : null}
        {this.state.protect ? <ProtectDialog ctx={this.props.ctx} names={[this.state.protect]} closing={this.state.protectClosing} onClose={() => this.closeLayer('protect')} /> : null}
      </div>
    );
  }
}
