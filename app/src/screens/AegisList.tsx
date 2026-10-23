/* Ported from project/AegisList.dc.html */
import React, { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';
import AegisTable from '../components/AegisTable';

const SC = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', run: 'var(--run)', tx: 'var(--tx-3)' };
const RES = {
  ok: ['circle-check', 'Succeeded', 'ok'],
  warn: ['triangle-alert', 'Warning', 'warn'],
  err: ['circle-x', 'Failed', 'err'],
  run: ['loader-circle', 'Running', 'run'],
  refused: ['ban', 'Refused', 'warn'],
  failed: ['circle-x', 'Failed', 'err']
};
const NST = {
  ok: ['circle-check', 'Online', 'ok'],
  warn: ['circle-alert', 'Update available', 'warn'],
  unreach: ['triangle-alert', 'Unreachable', 'warn'],
  degraded: ['circle-alert', 'Degraded', 'warn']
};
const SEV = { critical: ['circle-x', 'Critical', 'err'], warning: ['triangle-alert', 'Warning', 'warn'], info: ['info', 'Info', 'tx'] };
const PH_C = [
  'oklch(0.62 0.02 255)',
  'oklch(0.52 0.03 255)',
  'oklch(0.70 0.02 255)',
  'oklch(0.45 0.04 255)',
  'oklch(0.66 0.03 255)',
  'oklch(0.56 0.05 220)',
  'oklch(0.74 0.02 255)',
  'oklch(0.40 0.03 255)'
];
const LINE_ICON = {
  info: ['circle-dot', 'var(--tx-3)'],
  ok: ['circle-check', 'var(--ok)'],
  warn: ['triangle-alert', 'var(--warn)'],
  err: ['circle-x', 'var(--err)']
};
const PRODS = { Backup: 'Protection', DR: 'Resilience', Migration: 'Mobility', All: 'All products' };
const fmtS = n => (n >= 60 ? `${Math.floor(n / 60)} min ${String(n % 60).padStart(2, '0')} s` : `${n} s`);
const short = s => {
  const m = /(\d+) (\w+) \d+, (\d+:\d+)/.exec(s || '');
  return m ? `${m[1]} ${m[2]}, ${m[3]}` : s || '—';
};
const st3 = (i, l, c, extra?) => ({ t: 'status', i, l, c, ...(extra || {}) });

/* Storage targets a repository can live on, and how each one is locked. */
const REPO_TYPES = ['Filesystem', 'NFS', 'SMB', 'SFTP', 'S3-compatible', 'Amazon S3', 'Azure Blob', 'Google Cloud Storage', 'Host360 Object Storage', 'Tape library'];
const REPO_REMOTE = ['SFTP', 'S3-compatible', 'Amazon S3', 'Azure Blob', 'Google Cloud Storage', 'Host360 Object Storage'];
const REPO_HINT: Record<string, string> = {
  Filesystem: 'A local disk on an appliance or proxy. Hardened mode locks points with single-use credentials and no root login.',
  NFS: 'A share mounted by the appliance or proxy.',
  SMB: 'A share mounted by the appliance or proxy.',
  SFTP: 'A remote server reached over SFTP with a key held in the vault.',
  'S3-compatible': 'Object storage such as MinIO, Ceph RGW or Wasabi, with optional Object Lock.',
  'Amazon S3': 'Amazon S3 with Object Lock; Glacier classes for archive copies.',
  'Azure Blob': 'A container protected by a time-based retention policy and, if needed, a legal hold.',
  'Google Cloud Storage': 'A bucket protected by a locked retention policy (bucket lock).',
  'Host360 Object Storage': 'Host360’s own S3 service in Chennai or Mumbai, with Object Lock.',
  'Tape library': 'An LTO library with media pools, WORM tapes and offsite vault tracking.'
};
const REPO_LOCKS: Record<string, string[]> = {
  Filesystem: ['Off', 'Hardened'],
  'S3-compatible': ['Off', 'Governance', 'Compliance'],
  'Amazon S3': ['Off', 'Governance', 'Compliance'],
  'Host360 Object Storage': ['Off', 'Governance', 'Compliance'],
  'Azure Blob': ['Off', 'Time-based retention', 'Retention and legal hold'],
  'Google Cloud Storage': ['Off', 'Bucket lock'],
  'Tape library': ['Off', 'WORM tape']
};
const REPO_LOCK_LABEL: Record<string, string> = { 'S3-compatible': 'Object Lock', 'Amazon S3': 'Object Lock', 'Host360 Object Storage': 'Object Lock', 'Azure Blob': 'Immutability policy', 'Google Cloud Storage': 'Retention policy', Filesystem: 'Hardened repository', 'Tape library': 'WORM' };
const REPO_LOCK_HINT = (t: string, l: string) =>
  l === 'Off' ? 'Points can be deleted at any time.'
  : l === 'Compliance' ? 'Compliance mode: no one can delete a locked point before it expires.'
  : l === 'Governance' ? 'Governance mode: Owners can remove a lock with a separate permission.'
  : l === 'Hardened' ? 'Files carry the immutable attribute and a retention date; the proxy logs in with single-use credentials and root login is disabled.'
  : l === 'Bucket lock' ? 'Once locked, the retention policy cannot be shortened or removed, even by the bucket owner.'
  : l === 'WORM tape' ? 'Written once to WORM media; tapes leave for the vault after the job.'
  : l === 'Retention and legal hold' ? 'Blobs cannot be changed until the retention ends, and not at all while a legal hold is set.'
  : `${t}: blobs cannot be changed or deleted until the retention ends.`;
const REPO_WHERE = (f: any) =>
  f.type === 'Filesystem' ? f.path
  : f.type === 'NFS' || f.type === 'SMB' ? f.share
  : f.type === 'SFTP' ? `sftp://${f.sftpUser}@${f.sftpHost}${f.path}`
  : f.type === 'S3-compatible' ? `${f.endpoint}/${f.bucket}`
  : f.type === 'Amazon S3' ? `s3://${f.bucket} (${f.region}, ${f.cls})`
  : f.type === 'Azure Blob' ? `${f.azAccount}.blob.core.windows.net/${f.azContainer} (${f.azTier})`
  : f.type === 'Google Cloud Storage' ? `gs://${f.bucket} (${f.gcsLoc})`
  : f.type === 'Host360 Object Storage' ? `${f.h360Region} · ${f.bucket}`
  : `${f.tapeLib} · ${f.tapePool}`;

export default class AegisList extends DC {
  state: any = {
    view: null,
    q: '',
    sel: {},
    drawer: null,
    closing: false,
    tab: 0,
    acked: {},
    f: {},
    pd: null,
    extraRepos: [],
    extraCopies: [],
    extraPolicies: [],
    form: {}
  };
  logRef = React.createRef<any>();
  componentDidMount() {
    this.checkOpen();
  }
  componentDidUpdate(pp) {
    if (pp.ctx && this.props.ctx && pp.ctx.nonce !== this.props.ctx.nonce) this.checkOpen();
    if (pp.ctx && this.props.ctx && pp.ctx.key !== this.props.ctx.key)
      this.setState({ view: null, q: '', sel: {}, drawer: null, tab: 0, f: {} });
    const el = this.logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }
  checkOpen() {
    const c = this.props.ctx;
    if (c && c.openId) this.setState({ drawer: c.openId, closing: false, tab: 0 });
  }
  closeDrawer() {
    this.setState({ closing: true });
    setTimeout(() => this.setState({ drawer: null, closing: false }), 150);
  }

  page(A, ctx): any {
    const s = this.state;
    const key = ctx.key;
    const can = ctx.can;
    const cfg = can('configure', 'This change');
    const op = can('operate', 'This action');
    const prim = (label, icon, perm, onClick) => ({ label, icon, primary: true, perm, onClick });
    const sec = (label, icon, onClick) => ({ label, icon, onClick });
    const F = (label, k, options) => ({ label, k, options });
    const nr = { v: 'Not read', muted: true, italic: true, s: null };
    if (key === 'nodes') {
      const rows = A.nodes.map(n => {
        const st = NST[n.status];
        return {
          id: n.id,
          _t: n.name + n.site + n.role,
          name: n.name,
          role: n.role,
          site: n.site,
          status: st3(st[0], n.statusLabel || st[1], st[2], { tip: n.reason || st[1], s: n.status }),
          version: n.version || nr,
          slots: n.slots ? { v: `${n.slots[0]} of ${n.slots[1]}`, s: n.slots[0] } : nr,
          tput: n.tput == null ? nr : { v: `${n.tput} MB/s`, s: n.tput, muted: !n.tput },
          seen: { v: short(n.seen), s: n.seen }
        };
      });
      return {
        views: [
          ['List', 'list'],
          ['Topology', 'workflow']
        ],
        defView: 'List',
        unit: ['node', 'nodes'],
        rows,
        sort: 'name',
        primary: [prim('Add a proxy', 'plus', cfg, () => ctx.toast('Proxy installer link copied. Run it on the new host.', 'info'))],
        cols: [
          { k: 'name', label: 'Name', w: 'minmax(180px,1.6fr)' },
          { k: 'role', label: 'Role', w: '112px', dim: true },
          { k: 'site', label: 'Site', w: 'minmax(150px,1.3fr)', dim: true },
          { k: 'status', label: 'Status', w: '160px' },
          { k: 'version', label: 'Version', w: '88px', dim: true },
          { k: 'slots', label: 'Task slots', w: '100px', r: true },
          { k: 'tput', label: 'Throughput', w: '110px', r: true },
          { k: 'seen', label: 'Last seen (IST)', w: '128px', dim: true }
        ],
        drawer: id => {
          const n = A.nodes.find(x => x.id === id);
          if (!n) return null;
          const st = NST[n.status];
          return {
            kicker: `Node · ${n.role}`,
            name: n.name,
            si: st[0],
            sl: n.statusLabel || st[1],
            sc: SC[st[2]],
            meta: n.site,
            note:
              n.reason ||
              (n.status === 'warn' ? 'Runs 4.1.3; the orchestrator runs 4.2.0. Update it to keep task scheduling consistent.' : ''),
            noteKind: n.status === 'unreach' ? 'warn' : 'warn',
            actions: [
              {
                label: n.status === 'warn' ? 'Update to 4.2.0' : 'Restart service',
                icon: n.status === 'warn' ? 'download' : 'refresh-cw',
                perm: op,
                run: () => ctx.toast(n.status === 'warn' ? `${n.name} is updating to 4.2.0` : `Aegis service on ${n.name} restarted`, 'ok')
              }
            ],
            tabs: [
              [
                'Details',
                'facts',
                [
                  ['Role', n.role],
                  ['Site', n.site],
                  ['Address', n.addr],
                  ['Version', n.version || 'Not read'],
                  ['Task slots', n.slots ? `${n.slots[0]} in use of ${n.slots[1]}` : 'Not read'],
                  ['Throughput', n.tput == null ? 'Not read' : `${n.tput} MB/s`],
                  ['CPU and memory', `${n.cpu}, ${n.mem}`],
                  ['Last seen', n.seen]
                ]
              ],
              [
                'Storage',
                'table',
                {
                  grid: 'minmax(0,1fr) 120px minmax(0,1.4fr)',
                  head: [['Mount'], ['Type'], ['Used and capacity']],
                  rows: [
                    ['/', 'ext4', [`${(parseFloat(n.disk) * 0.31).toFixed(2)} GB of ${n.disk}`, '31%']],
                    ['/var/lib/aegis/cache', 'xfs', [`${(parseFloat(n.disk) * 0.46).toFixed(2)} GB of ${n.disk}`, '46%']]
                  ]
                }
              ],
              [
                'Settings',
                'form',
                [
                  ['slots', 'Task slots', String(n.slots ? n.slots[1] : 4), 'Jobs this node runs at the same time.'],
                  ['throttle', 'Network throttle (MB/s)', '0', '0 means unlimited.']
                ]
              ],
              [
                'Logs',
                'log',
                [
                  ['16:04:58', 'Heartbeat sent to aegis-orchestrator', 'info'],
                  ['16:02:11', 'Task finished: Database hourly · sql-prod-02', 'ok'],
                  ['15:58:02', 'Task started: Production daily · erp-app-01', 'info'],
                  [
                    '14:52:40',
                    n.status === 'unreach' ? 'No heartbeat answer from the orchestrator' : 'Cache cleaned: 4.20 GB freed',
                    n.status === 'unreach' ? 'warn' : 'info'
                  ]
                ]
              ]
            ]
          };
        }
      };
    }
    if (key === 'repos') {
      const repos = A.repos.concat(s.extraRepos);
      const rows = repos.map(r => {
        const pct = Math.round((r.used / r.cap) * 100);
        const st = r.status === 'ok' ? ['circle-check', 'Online', 'ok'] : ['circle-alert', 'Degraded', 'warn'];
        return {
          id: r.id,
          _t: r.name + r.type + r.site,
          name: r.name,
          type: r.type,
          site: r.site,
          node: r.node,
          used: { t: 'bar', pct, c: pct >= 85 ? 'warn' : 'tx', v: `${A.fmtGB(r.used)} of ${A.fmtGB(r.cap)}`, s: pct },
          red: { v: r.red, s: parseFloat(r.red) },
          lock: r.lock
            ? st3('lock', `${r.lock}, ${r.lockDays} d`, 'tx', { tip: `Immutable (WORM): ${r.lock} mode, ${r.lockDays} days` })
            : { v: 'Off', muted: true },
          enc: r.enc ? st3('shield', 'AES-256', 'tx', { tip: 'Encrypted with AES-256' }) : { v: 'Off', muted: true },
          status: st3(st[0], st[1], st[2], { tip: r.reason || st[1] })
        };
      });
      return {
        unit: ['repository', 'repositories'],
        rows,
        sort: 'name',
        primary: [
          prim('Add a repository', 'plus', cfg, () =>
            this.setState({
              pd: {
                kind: 'repo',
                step: 0,
                f: {
                  type: 'S3-compatible',
                  name: 'obj-offsite',
                  endpoint: 's3.mumbai.host360.local',
                  bucket: 'aegis-offsite',
                  region: 'ap-south-1',
                  access: 'AKIA4AEGIS01',
                  secret: '••••••••',
                  path: '/srv/aegis/repo2',
                  share: 'nfs02:/export/aegis',
                  node: 'aegis-prod-220',
                  lock: 'Compliance',
                  days: '14',
                  enc: true,
                  sftpHost: 'backup-sftp.kaveri-logistics.in',
                  sftpUser: 'aegis',
                  role: 'arn:aws:iam::418291736650:role/aegis-repo',
                  cls: 'Standard',
                  azAccount: 'mbkaegisbackup',
                  azContainer: 'aegis-points',
                  azTier: 'Cool',
                  azAuth: 'Managed identity',
                  gcsLoc: 'asia-south1 (Mumbai)',
                  gcsSa: 'aegis-repo@atlas-backup.iam.gserviceaccount.com',
                  h360Region: 'Mumbai DC2',
                  tapeLib: 'IBM TS4300 · chn-tape-01',
                  tapePool: 'Monthly-LTO9-WORM',
                  tapeDrives: '2',
                  tapeVault: 'Iron Mountain, Chennai',
                  ipAllow: '10.20.4.0/24'
                }
              }
            })
          )
        ],
        cols: [
          { k: 'name', label: 'Name', w: 'minmax(150px,1.3fr)' },
          { k: 'type', label: 'Type', w: '120px', dim: true },
          { k: 'site', label: 'Site', w: 'minmax(140px,1.2fr)', dim: true },
          { k: 'node', label: 'Node', w: 'minmax(130px,1.1fr)', dim: true },
          { k: 'used', label: 'Used and capacity', w: 'minmax(220px,1.6fr)' },
          { k: 'red', label: 'Data reduction', w: '120px', r: true },
          { k: 'lock', label: 'Lock', w: '148px' },
          { k: 'enc', label: 'Encryption', w: '112px' },
          { k: 'status', label: 'Status', w: '120px' }
        ],
        drawer: id => {
          const r = repos.find(x => x.id === id);
          if (!r) return null;
          const pts = Array.from({ length: 8 }, (_, i) => [
            `${21 - i} Oct 2026, 02:${String(14 + i).padStart(2, '0')}`,
            ['web-frontend-01', 'sql-prod-02', 'gitlab-01', 'mail-gw-01'][i % 4],
            `${(2.4 + i * 1.3).toFixed(2)} GB`,
            r.lock ? `Until ${String(4 - Math.floor(i / 3)).padStart(2, '0')} Nov · ${14 - Math.floor(i / 3)} d left` : 'Not locked'
          ]);
          return {
            kicker: `Repository · ${r.type}`,
            name: r.name,
            si: r.status === 'ok' ? 'circle-check' : 'circle-alert',
            sl: r.status === 'ok' ? 'Online' : 'Degraded',
            sc: SC[r.status === 'ok' ? 'ok' : 'warn'],
            meta: `${r.site} · ${r.node}`,
            note: r.reason || '',
            noteKind: 'warn',
            tabs: [
              [
                'Overview',
                'facts',
                [
                  ['Used and capacity', `${A.fmtGB(r.used)} of ${A.fmtGB(r.cap)} (${Math.round((r.used / r.cap) * 100)} %)`],
                  ['Data reduction', `${r.red}: ${r.logical} of data in ${r.points} recovery points, stored in ${A.fmtGB(r.used)}`],
                  ['Location', r.endpoint],
                  ['Immutability', r.lock ? `${r.lock} mode, ${r.lockDays} days` : 'Off', r.lock ? 'lock' : ''],
                  ['Encryption', r.enc ? 'AES-256, key held on the orchestrator' : 'Off', r.enc ? 'shield' : ''],
                  ['Node', r.node],
                  ['Site', r.site]
                ].map(x => (x.length === 3 ? x : x))
              ],
              [
                'Recovery points',
                'table',
                {
                  grid: 'minmax(0,1.3fr) minmax(0,1.1fr) 90px 160px',
                  head: [['Point in time (IST)'], ['Guest'], ['Size', 'r'], ['Lock']],
                  rows: pts.map(p => [p[0], p[1], [p[2], null, 'r'], [p[3], null, null, r.lock ? 'lock' : '']])
                }
              ],
              [
                'Recycle bin',
                'table',
                {
                  grid: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) 88px',
                  head: [['Item'], ['Deleted by'], ['Purged on (IST)'], ['']],
                  rows: A.deletedJobs.map(j => [
                    `${j.name} · ${j.points} points`,
                    j.by,
                    short(j.purge),
                    { btn: 'Restore', run: () => ctx.toast(`${j.name} restored from the recycle bin`, 'ok') }
                  ]),
                  empty: 'The recycle bin is empty.'
                }
              ],
              [
                'Settings',
                'form',
                [
                  ['name', 'Name', r.name],
                  ['warn', 'Warn when used above (%)', '85', 'An alert is raised when the repository passes this level.']
                ]
              ]
            ]
          };
        }
      };
    }
    if (key === 'jobs') {
      const live = ctx.jobs.map(j => ({
        id: j.id,
        name: j.name,
        object: j.object,
        product: j.product,
        type: j.type,
        status: j.status,
        phase: j.phases[j.phase],
        pct: j.pct,
        started: j.started,
        duration: j.status === 'run' ? 'Running' : '—',
        live: j
      }));
      const list = live.concat(A.jobs);
      const rows = list.map(j => {
        const r = RES[j.status];
        return {
          id: j.id,
          _f: { Product: j.product, Status: r[1], Type: j.type },
          _t: j.name + j.object,
          name: j.name,
          object: j.object,
          product: PRODS[j.product] || j.product,
          type: j.type,
          status: st3(r[0], r[1], r[2], { spin: j.status === 'run', tip: j.note || r[1], s: j.status }),
          phase: j.phase,
          progress: {
            t: 'bar',
            pct: j.pct,
            c: j.status === 'run' ? 'run' : j.status === 'err' ? 'err' : 'tx',
            v: `${Math.floor(j.pct)} %`,
            s: j.pct
          },
          started: { v: short(j.started), s: j.started },
          duration: j.duration
        };
      });
      return {
        unit: ['job', 'jobs'],
        rows,
        sort: 'started',
        dir: -1,
        filters: [
          F('Product', 'Product', ['All', 'Backup', 'DR', 'Migration']),
          F('Type', 'Type', (['All'] as any[]).concat([...new Set(list.map(j => j.type))])),
          F('Status', 'Status', ['All', 'Running', 'Succeeded', 'Warning', 'Failed'])
        ],
        cols: [
          { k: 'name', label: 'Job', w: 'minmax(150px,1.3fr)' },
          { k: 'object', label: 'Object', w: 'minmax(150px,1.3fr)' },
          { k: 'product', label: 'Product', w: '140px', dim: true },
          { k: 'type', label: 'Type', w: '120px', dim: true },
          { k: 'status', label: 'Status', w: '120px' },
          { k: 'phase', label: 'Phase', w: 'minmax(120px,1fr)', dim: true },
          { k: 'progress', label: 'Progress', w: '150px' },
          { k: 'started', label: 'Started (IST)', w: '120px', dim: true },
          { k: 'duration', label: 'Duration', w: '104px', r: true }
        ],
        drawer: id => {
          const j = list.find(x => x.id === id);
          if (!j) return null;
          const r = RES[j.status];
          const phases = j.live ? j.live.phases : A.jobPhases[j.type] || ['Queued', 'Running', 'Done'];
          const curI = j.live ? j.live.phase : phases.indexOf(j.phase);
          const log = j.live
            ? j.live.log.map(l => [l.t, l.text, l.lv])
            : [['', `${j.name} started for ${j.object}`, 'info']]
                .concat(
                  phases
                    .slice(1, Math.max(1, curI + 1))
                    .map(p => [
                      '',
                      p === 'Done' ? (j.status === 'ok' ? 'Finished' : 'Finished with issues') : `${p}…`,
                      p === 'Done' ? (j.status === 'ok' ? 'ok' : 'warn') : 'info'
                    ]),
                  j.note ? [['', j.note, j.status === 'err' ? 'err' : 'warn']] : []
                )
                .map((l, i) => [short(j.started).split(', ')[1] + `:${String((i * 7) % 60).padStart(2, '0')}`, l[1], l[2]]);
          return {
            kicker: `Job · ${PRODS[j.product] || j.product}`,
            name: `${j.name} · ${j.object}`,
            si: r[0],
            sl: j.status === 'run' ? `Running · ${Math.floor(j.pct)} %` : r[1],
            sc: SC[r[2]],
            spin: j.status === 'run',
            meta: `Started ${j.started}`,
            note: j.note || '',
            noteKind: j.status === 'err' ? 'err' : 'warn',
            actions:
              j.status === 'run'
                ? [
                    {
                      label: 'Stop job',
                      icon: 'circle-stop',
                      perm: op,
                      danger: true,
                      run: () => ctx.toast(`${j.name} for ${j.object} will stop after the current phase`, 'warn')
                    }
                  ]
                : j.status === 'err'
                  ? [
                      {
                        label: 'Retry',
                        icon: 'refresh-cw',
                        perm: op,
                        run: () => {
                          ctx.startJob({
                            name: j.name,
                            object: j.object,
                            product: j.product,
                            type: j.type,
                            phases,
                            speed: 12,
                            doneToast: `${j.name} for ${j.object} finished`
                          });
                          ctx.toast(`${j.name} for ${j.object} restarted`, 'info');
                        }
                      }
                    ]
                  : [],
            steps: phases.map((p, i) => ({ p, done: i < curI || (j.status !== 'run' && i <= curI && j.status === 'ok'), cur: i === curI })),
            stepsErr: j.status === 'err',
            tabs: [
              ['Lifecycle and log', 'log', log],
              [
                'Facts',
                'facts',
                [
                  ['Job', j.name],
                  ['Object', j.object],
                  ['Product', PRODS[j.product] || j.product],
                  ['Type', j.type],
                  ['Started', j.started],
                  ['Duration', j.duration],
                  ['Phase', j.phase],
                  ['Progress', `${Math.floor(j.pct)} %`]
                ]
              ]
            ]
          };
        }
      };
    }
    if (key === 'alerts') {
      const view = s.view || 'Active';
      const active = A.alerts.filter(a => !s.acked[a.id]);
      const list =
        view === 'Active'
          ? active
          : A.pastAlerts.concat(
              A.alerts.filter(a => s.acked[a.id]).map(a => ({ ...a, closed: ctx.now(), how: 'Acknowledged by priya.raman' }))
            );
      const ack = ctx.can('operate', 'Acknowledging alerts');
      const rows = list.map(a => {
        const sv = SEV[a.sev];
        return {
          id: a.id,
          _t: a.title + a.object,
          sev: st3(sv[0], sv[1], sv[2], { s: ['critical', 'warning', 'info'].indexOf(a.sev) }),
          title: { v: a.title, tip: a.detail },
          object: a.object,
          product: PRODS[a.product],
          raised: { v: short(a.raised), s: a.raised },
          last:
            view === 'Active'
              ? {
                  t: 'btn',
                  v: 'Acknowledge',
                  disabled: !ack.ok,
                  why: ack.why,
                  onClick: () => {
                    this.setState(st => ({ acked: { ...st.acked, [a.id]: true } }));
                    ctx.toast(`Alert for ${a.object} acknowledged`, 'ok');
                  }
                }
              : { v: a.how, muted: true }
        };
      });
      return {
        views: [
          ['Active', 'bell', active.length],
          ['Past', 'history', A.pastAlerts.length + Object.keys(s.acked).length]
        ],
        defView: 'Active',
        unit: ['alert', 'alerts'],
        rows,
        sort: 'sev',
        emptyText: view === 'Active' ? 'No active alerts. Everything that was raised has been acknowledged or cleared.' : 'No past alerts.',
        bulk:
          view === 'Active'
            ? [
                {
                  label: 'Acknowledge selected',
                  icon: 'check',
                  perm: ack,
                  needSel: true,
                  run: ids => {
                    this.setState(st => {
                      const acked = { ...st.acked };
                      ids.forEach(i => {
                        acked[i] = true;
                      });
                      return { acked, sel: {} };
                    });
                    ctx.toast(`${ids.length} alerts acknowledged`, 'ok');
                  }
                }
              ]
            : [],
        cols: [
          { k: 'sev', label: 'Severity', w: '120px' },
          { k: 'title', label: 'Alert', w: 'minmax(200px,1.6fr)' },
          { k: 'object', label: 'Object', w: 'minmax(140px,1.2fr)' },
          { k: 'product', label: 'Product', w: '150px', dim: true },
          { k: 'raised', label: 'Raised (IST)', w: '128px', dim: true },
          { k: 'last', label: view === 'Active' ? '' : 'Closed', w: view === 'Active' ? '136px' : 'minmax(180px,1.4fr)', nosort: true }
        ],
        drawer: id => {
          const a = list.find(x => x.id === id);
          if (!a) return null;
          const sv = SEV[a.sev];
          return {
            kicker: `Alert · ${PRODS[a.product]}`,
            name: a.title,
            si: sv[0],
            sl: sv[1],
            sc: SC[sv[2]],
            meta: a.object,
            tabs: [
              [
                'Details',
                'facts',
                [
                  ['Object', a.object],
                  ['Product', PRODS[a.product]],
                  ['Raised', a.raised],
                  ['Detail', a.detail || '—']
                ].concat(
                  a.closed
                    ? [
                        ['Closed', a.closed],
                        ['How', a.how]
                      ]
                    : []
                )
              ]
            ]
          };
        }
      };
    }
    if (key === 'audit') {
      const rows = A.audit.map((e, i) => {
        const r = RES[e.r];
        return {
          id: 'au' + i,
          _f: { Result: r[1] },
          _t: e.who + e.what,
          when: { v: short(e.when), s: e.when },
          who: e.who,
          what: { v: e.what, tip: e.note || e.what },
          from: e.from,
          r: st3(r[0], r[1], r[2], { tip: e.note || r[1] })
        };
      });
      return {
        unit: ['event', 'events'],
        rows,
        sort: 'when',
        dir: -1,
        filters: [F('Result', 'Result', ['All', 'Succeeded', 'Refused', 'Failed'])],
        primary: [sec('Export CSV', 'download', () => ctx.toast('Audit export for the last 30 days is ready', 'ok'))],
        cols: [
          { k: 'when', label: 'When (IST)', w: '128px', dim: true },
          { k: 'who', label: 'Who', w: '140px' },
          { k: 'what', label: 'What', w: 'minmax(320px,3fr)' },
          { k: 'from', label: 'From', w: '140px', dim: true },
          { k: 'r', label: 'Result', w: '120px' }
        ],
        drawer: id => {
          const e = A.audit[+id.slice(2)];
          if (!e) return null;
          const r = RES[e.r];
          return {
            kicker: 'Audit event',
            name: e.what,
            si: r[0],
            sl: r[1],
            sc: SC[r[2]],
            meta: e.when,
            tabs: [
              [
                'Details',
                'facts',
                [
                  ['Who', e.who],
                  ['What', e.what],
                  ['When', e.when],
                  ['From', e.from],
                  ['Result', r[1]],
                  ['Reason', e.note || '—']
                ]
              ]
            ]
          };
        }
      };
    }
    if (key === 'backup/policies') {
      const view = s.view || 'Policies';
      if (view === 'Deleted jobs') {
        const rows = A.deletedJobs.map(j => ({
          id: j.id,
          _t: j.name,
          name: j.name,
          kind: j.kind,
          points: { v: String(j.points), s: j.points },
          deleted: { v: short(j.deleted), s: j.deleted },
          by: j.by,
          purge: { v: short(j.purge), s: j.purge },
          act: {
            t: 'btn',
            v: 'Restore',
            disabled: !cfg.ok,
            why: cfg.why,
            onClick: () => ctx.toast(`${j.name} restored with its ${j.points} recovery points`, 'ok')
          }
        }));
        return {
          views: [
            ['Policies', 'clipboard-list', A.policies.length],
            ['Deleted jobs', 'trash-2', A.deletedJobs.length]
          ],
          defView: 'Policies',
          unit: ['deleted job', 'deleted jobs'],
          rows,
          sort: 'deleted',
          dir: -1,
          footR: 'Deleted jobs are purged after 30 d',
          cols: [
            { k: 'name', label: 'Job', w: 'minmax(180px,1.5fr)' },
            { k: 'kind', label: 'Kind', w: '120px', dim: true },
            { k: 'points', label: 'Recovery points', w: '130px', r: true },
            { k: 'deleted', label: 'Deleted (IST)', w: '130px', dim: true },
            { k: 'by', label: 'Deleted by', w: '130px', dim: true },
            { k: 'purge', label: 'Purged on (IST)', w: '130px', dim: true },
            { k: 'act', label: '', w: '110px', nosort: true }
          ]
        };
      }
      const pols = A.policies.concat(s.extraPolicies);
      const rows = pols.map(p => ({
        id: p.id,
        _t: p.name + p.dest,
        name: p.name,
        schedule: p.schedule,
        retention: p.retention,
        gfs: p.gfs,
        dest: p.copy ? `${p.dest} + ${p.copy}` : p.dest,
        lock: p.lock ? st3('lock', `${p.lock}, ${p.lockDays} d`, 'tx') : { v: 'Off', muted: true },
        enc: p.enc ? st3('shield', 'AES-256', 'tx') : { v: 'Off', muted: true },
        guests: { v: String(p.guests), s: p.guests }
      }));
      return {
        views: [
          ['Policies', 'clipboard-list', pols.length],
          ['Deleted jobs', 'trash-2', A.deletedJobs.length]
        ],
        defView: 'Policies',
        unit: ['policy', 'policies'],
        rows,
        sort: 'name',
        primary: [prim('Create a policy', 'plus', cfg, () => this.openPolicy(null))],
        cols: [
          { k: 'name', label: 'Name', w: 'minmax(150px,1.3fr)' },
          { k: 'schedule', label: 'Schedule', w: 'minmax(130px,1.1fr)', dim: true },
          { k: 'retention', label: 'Retention', w: '110px', dim: true },
          { k: 'gfs', label: 'GFS', w: 'minmax(170px,1.4fr)', dim: true },
          { k: 'dest', label: 'Destinations', w: 'minmax(170px,1.4fr)', dim: true },
          { k: 'lock', label: 'Immutability', w: '150px' },
          { k: 'enc', label: 'Encryption', w: '110px' },
          { k: 'guests', label: 'Guests', w: '80px', r: true }
        ],
        onRow: id => {
          if (cfg.ok) this.openPolicy(pols.find(p => p.id === id));
          else ctx.toast(cfg.why, 'info');
        }
      };
    }
    if (key === 'backup/copies') {
      const list = A.copies.concat(s.extraCopies);
      const rows = list.map(c => {
        const r = RES[c.last.r];
        return {
          id: c.id,
          _t: c.name + c.src + c.dst,
          name: c.name,
          src: c.src,
          dst: c.dst,
          retention: c.retention,
          schedule: c.schedule,
          last: st3(r[0], `${r[1]} · ${short(c.last.t)}`, r[2], { tip: c.note || r[1], s: c.last.t }),
          lag: { v: c.lag ? `${c.lag} ${c.lag === 1 ? 'point' : 'points'}` : 'None', s: c.lag, muted: !c.lag }
        };
      });
      return {
        unit: ['copy job', 'copy jobs'],
        rows,
        sort: 'name',
        primary: [
          prim('Create a backup copy', 'plus', cfg, () => {
            const id = 'cpx' + Date.now();
            this.setState(st => ({
              extraCopies: st.extraCopies.concat([
                {
                  id,
                  name: 'Weekly offsite archive',
                  src: 'obj-check',
                  dst: 'copy-check-repo',
                  retention: '12 weekly · 12 monthly',
                  schedule: 'Sundays at 04:00',
                  last: { r: 'ok', t: '—' },
                  lag: 0
                }
              ])
            }));
            ctx.toast('Backup copy Weekly offsite archive created', 'ok');
          })
        ],
        cols: [
          { k: 'name', label: 'Copy job', w: 'minmax(200px,1.6fr)' },
          { k: 'src', label: 'Source', w: 'minmax(130px,1fr)', dim: true },
          { k: 'dst', label: 'Destination', w: 'minmax(130px,1fr)', dim: true },
          { k: 'retention', label: 'Own retention', w: 'minmax(150px,1.2fr)', dim: true },
          { k: 'schedule', label: 'Schedule', w: '140px', dim: true },
          { k: 'last', label: 'Last run (IST)', w: 'minmax(180px,1.3fr)' },
          { k: 'lag', label: 'Behind source', w: '120px', r: true }
        ],
        drawer: id => {
          const c = list.find(x => x.id === id);
          if (!c) return null;
          const r = RES[c.last.r];
          return {
            kicker: 'Backup copy',
            name: c.name,
            si: r[0],
            sl: r[1],
            sc: SC[r[2]],
            meta: `${c.src} → ${c.dst}`,
            note: c.note || '',
            noteKind: c.last.r === 'err' ? 'err' : 'warn',
            actions: [
              {
                label: 'Run now',
                icon: 'play',
                perm: op,
                run: () => {
                  ctx.startJob({
                    name: c.name,
                    object: `${c.src} → ${c.dst}`,
                    product: 'Backup',
                    type: 'Backup copy',
                    phases: A.jobPhases['Backup copy'],
                    speed: 12,
                    rate: '180 MB/s',
                    doneToast: `${c.name} finished`
                  });
                  ctx.toast(`${c.name} started`, 'info');
                }
              }
            ],
            tabs: [
              [
                'Overview',
                'facts',
                [
                  ['Source repository', c.src],
                  ['Destination repository', c.dst],
                  ['Own retention', c.retention],
                  ['Schedule', c.schedule],
                  ['Last run', `${r[1]} at ${c.last.t}`],
                  ['Behind source', c.lag ? `${c.lag} recovery points` : 'None']
                ]
              ]
            ]
          };
        }
      };
    }
    if (key === 'dr/history') {
      const rows = A.drHistory.map(h => {
        const r = RES[h.r];
        return {
          id: h.id,
          _t: h.server,
          server: h.server,
          started: { v: short(h.started), s: h.started },
          r: st3(r[0], r[1], r[2], { spin: h.r === 'run', tip: h.note || r[1] }),
          dur: { v: h.r === 'run' ? 'Running' : fmtS(h.total), s: h.total },
          changed: { v: h.changed, s: parseFloat(h.changed) || 0 },
          phases: {
            t: 'phases',
            segs: h.secs.map((x, i) => ({ w: `${((x / h.total) * 100).toFixed(2)}%`, c: PH_C[i] })),
            v: '',
            tip: A.phases.map((p, i) => `${p} ${fmtS(h.secs[i])}`).join(' · '),
            s: h.secs[3]
          }
        };
      });
      return {
        unit: ['cycle', 'cycles'],
        rows,
        sort: 'started',
        dir: -1,
        footR: 'Hover a bar for each phase’s time',
        cols: [
          { k: 'server', label: 'Server', w: 'minmax(150px,1.2fr)' },
          { k: 'started', label: 'Started (IST)', w: '128px', dim: true },
          { k: 'r', label: 'Result', w: '120px' },
          { k: 'dur', label: 'Duration', w: '112px', r: true },
          { k: 'changed', label: 'Data changed', w: '112px', r: true },
          { k: 'phases', label: 'Time in each phase', w: 'minmax(260px,2.4fr)', nosort: true }
        ],
        legend: A.phases.map((p, i) => ({ label: p, c: PH_C[i] })),
        drawer: id => {
          const h = A.drHistory.find(x => x.id === id);
          if (!h) return null;
          const r = RES[h.r];
          return {
            kicker: 'Replication cycle',
            name: `${h.server} · ${short(h.started)}`,
            si: r[0],
            sl: r[1],
            sc: SC[r[2]],
            spin: h.r === 'run',
            meta: h.r === 'run' ? 'Running' : `Took ${fmtS(h.total)}`,
            note: h.note || '',
            noteKind: h.r === 'err' ? 'err' : 'warn',
            tabs: [
              [
                'Phases',
                'table',
                {
                  grid: 'minmax(0,1.2fr) 96px minmax(0,1.6fr)',
                  head: [['Phase'], ['Time', 'r'], ['Share of cycle']],
                  rows: A.phases.map((p, i) => [
                    p,
                    [h.secs[i] ? fmtS(h.secs[i]) : '—', null, 'r'],
                    [`${h.total ? Math.round((h.secs[i] / h.total) * 100) : 0} %`, `${h.total ? (h.secs[i] / h.total) * 100 : 0}%`]
                  ])
                }
              ]
            ]
          };
        }
      };
    }
    if (key === 'mig/plans') {
      const rows = A.migPlans.map(p => ({
        id: p.id,
        _t: p.name,
        name: p.name,
        servers: { v: p.servers.join(', '), tip: p.servers.join(', ') },
        window: p.window ? p.window : { v: 'Not set', muted: true, italic: true, s: null },
        mapping: p.mapping,
        ready: st3(
          p.ready[0] === p.servers.length ? 'circle-check' : 'clock',
          `${p.ready[0]} of ${p.servers.length} ready`,
          p.ready[0] === p.servers.length ? 'ok' : 'tx',
          { s: p.ready[0] }
        ),
        owner: p.owner
      }));
      return {
        unit: ['plan', 'plans'],
        rows,
        sort: 'name',
        primary: [prim('Create a migration plan', 'plus', cfg, () => ctx.toast('Migration plan Wave 4 created. Add servers to it.', 'ok'))],
        cols: [
          { k: 'name', label: 'Wave', w: 'minmax(180px,1.3fr)' },
          { k: 'servers', label: 'Servers', w: 'minmax(220px,1.8fr)', dim: true },
          { k: 'window', label: 'Cutover window', w: 'minmax(220px,1.6fr)' },
          { k: 'mapping', label: 'Mappings', w: 'minmax(220px,1.6fr)', dim: true },
          { k: 'ready', label: 'Ready', w: '140px' },
          { k: 'owner', label: 'Owner', w: '120px', dim: true }
        ],
        drawer: id => {
          const p = A.migPlans.find(x => x.id === id);
          if (!p) return null;
          return {
            kicker: 'Migration plan',
            name: p.name,
            si: p.window ? 'calendar' : 'circle-alert',
            sl: p.window ? p.window : 'No cutover window',
            sc: p.window ? 'var(--tx-2)' : 'var(--warn)',
            meta: p.mapping,
            actions: [
              {
                label: 'Cut over the wave',
                icon: 'power',
                perm: op,
                enabled: p.ready[0] === p.servers.length,
                why: `${p.servers.length - p.ready[0]} servers are not ready for cutover.`,
                run: () => ctx.toast(`Cutover of ${p.name} started`, 'warn')
              },
              { label: 'Open servers', icon: 'server', perm: { ok: true }, run: () => ctx.go('mig/servers') }
            ],
            tabs: [
              [
                'Servers',
                'table',
                {
                  grid: 'minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr)',
                  head: [['Server'], ['Stage'], ['Destination']],
                  rows: p.servers.map(n => {
                    const m = A.migServers.find(x => x.name === n);
                    const st = A.migStage[m.stage];
                    return [n, [st[1], null, null, st[0], SC[st[2]]], m.dest || 'No mapping'];
                  })
                }
              ],
              [
                'Window and mappings',
                'facts',
                [
                  ['Cutover window', p.window || 'Not set'],
                  ['Mappings', p.mapping],
                  ['Owner', p.owner],
                  ['Servers', String(p.servers.length)]
                ]
              ]
            ]
          };
        }
      };
    }
    return { rows: [], cols: [], unit: ['item', 'items'] };
  }

  openPolicy(p) {
    const f = p
      ? {
          name: p.name,
          desc: p.desc || '',
          freq: p.schedule.startsWith('Every hour') ? 'Hourly' : p.schedule.startsWith('Sundays') ? 'Weekly' : 'Daily',
          time: (/(\d\d:\d\d)/.exec(p.schedule) || [0, '02:00'])[1],
          keep: (/\d+/.exec(p.retention) || ['14'])[0],
          gw: (/(\d+) weekly/.exec(p.gfs) || [0, '0'])[1],
          gm: (/(\d+) monthly/.exec(p.gfs) || [0, '0'])[1],
          gy: (/(\d+) yearly/.exec(p.gfs) || [0, '0'])[1],
          dest: p.dest,
          copy: p.copy || 'None',
          lock: !!p.lock,
          mode: p.lock || 'Compliance',
          days: String(p.lockDays || 14),
          enc: p.enc,
          cons: p.cons
        }
      : {
          name: 'New policy',
          desc: '',
          freq: 'Daily',
          time: '02:00',
          keep: '14',
          gw: '4',
          gm: '12',
          gy: '1',
          dest: 'obj-check',
          copy: 'None',
          lock: true,
          mode: 'Compliance',
          days: '14',
          enc: true,
          cons: 'Application'
        };
    this.setState({ pd: { kind: 'policy', id: p ? p.id : null, tab: 'General', f } });
  }

  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    const E: any = {
      actions: [],
      views: [],
      filters: [],
      bulk: [],
      cols: [],
      rows: [],
      topo: [],
      d: { tabs: [], actions: [] },
      dt: { facts: [], steps: [], head: [], rows: [], log: [], fields: [] },
      pd: { tabs: [], fields: [] }
    };
    if (!A || !ctx) return E;
    const s = this.state;
    const P = this.page(A, ctx);
    const view = s.view || P.defView;
    const cfgP = ctx.can('configure', 'This change');
    let rows = P.rows || [];
    (P.filters || []).forEach(f => {
      const v = s.f[f.k] || 'All';
      if (v !== 'All') rows = rows.filter(r => r._f && r._f[f.k] === v);
    });
    const q = s.q.trim().toLowerCase();
    if (q) rows = rows.filter(r => (r._t || '').toLowerCase().includes(q));
    const selIds = rows.map(r => r.id).filter(id => s.sel[id]);
    const btn = a => {
      const perm = a.perm || { ok: true };
      const ok = perm.ok !== false;
      return {
        label: a.label,
        icon: a.icon,
        dis: ok ? undefined : 'true',
        why: ok ? undefined : perm.why,
        op: ok ? 1 : 0.45,
        bg: a.primary ? 'var(--acc)' : 'var(--panel)',
        fg: a.primary ? 'var(--acc-ink)' : 'var(--tx)',
        bd: a.primary ? 'var(--acc)' : 'var(--ln-2)',
        onClick: () => {
          if (ok) a.onClick();
        }
      };
    };
    const dr = s.drawer && P.drawer ? P.drawer(s.drawer) : null;
    let d = E.d,
      dt = E.dt;
    if (dr) {
      const tab = Math.min(s.tab, dr.tabs.length - 1);
      const [, kind, data] = dr.tabs[tab];
      const cell = c => {
        if (c && typeof c === 'object' && !Array.isArray(c) && c.btn) return { v: '', i: '', jc: 'flex-end', c: 'var(--tx)', bar: '' };
        const a = Array.isArray(c) ? c : [c];
        return {
          v: a[0],
          bar: a[1] || '',
          bc: 'var(--tx-3)',
          jc: a[2] === 'r' ? 'flex-end' : 'flex-start',
          i: a[3] || '',
          ic: a[4] || 'var(--tx-2)',
          c: 'var(--tx)'
        };
      };
      dt = {
        isFacts: kind === 'facts',
        isTable: kind === 'table',
        isLog: kind === 'log',
        isForm: kind === 'form',
        isSteps: !!dr.steps && tab === 0,
        facts: [],
        head: [],
        rows: [],
        log: [],
        fields: [],
        steps: []
      };
      if (kind === 'facts')
        dt.facts = data.map(([k, v, i]) => ({
          k,
          v,
          i: i || '',
          ic: 'var(--tx-2)',
          fs: v === 'Not read' ? 'italic' : 'normal',
          c: v === 'Not read' ? 'var(--tx-3)' : 'var(--tx)'
        }));
      if (kind === 'table') {
        dt.grid = data.grid;
        dt.head = data.head.map(([v, r]) => ({ v, ta: r === 'r' ? 'right' : 'left' }));
        dt.rows = data.rows.map(r => ({ cells: r.map(cell) }));
        dt.emptyRows = data.rows.length ? '' : data.empty || 'Nothing here yet.';
      }
      if (kind === 'log') dt.log = data.map(([t, text, lv]) => ({ t, text, i: LINE_ICON[lv][0], c: LINE_ICON[lv][1] }));
      if (kind === 'form')
        dt.fields = data.map(([k, label, v, hint]) => ({
          id: 'df-' + k,
          label,
          value: s.form[k] != null ? s.form[k] : v,
          hint: hint || '',
          onInput: e => {
            const val = e.target.value;
            this.setState(st => ({ form: { ...st.form, [k]: val } }));
          }
        }));
      if (dr.steps)
        dt.steps = dr.steps.map(x => ({
          label: x.p,
          current: x.cur ? 'step' : undefined,
          i: x.done ? 'circle-check' : x.cur ? (dr.spin ? 'loader-circle' : dr.stepsErr ? 'circle-x' : 'circle-dot') : 'circle',
          spin: x.cur && dr.spin ? 'true' : 'false',
          ic: x.done ? 'var(--ok)' : x.cur ? (dr.stepsErr ? 'var(--err)' : 'var(--run)') : 'var(--tx-3)',
          fg: x.done || x.cur ? 'var(--tx)' : 'var(--tx-3)',
          fw: x.cur ? 600 : 400,
          bg: x.cur ? 'var(--acc-soft)' : 'transparent',
          note: x.cur ? 'Current' : ''
        }));
      d = {
        kicker: dr.kicker,
        name: dr.name,
        si: dr.si,
        sl: dr.sl,
        sc: dr.sc,
        spin: dr.spin ? 'true' : 'false',
        meta: dr.meta || '',
        hasNote: !!dr.note,
        note: dr.note,
        ni: dr.noteKind === 'err' ? 'circle-x' : 'triangle-alert',
        nc: dr.noteKind === 'err' ? 'var(--err)' : 'var(--warn)',
        nbg: dr.noteKind === 'err' ? 'var(--err-s)' : 'var(--warn-s)',
        hasActions: !!(dr.actions && dr.actions.length),
        actions: (dr.actions || []).map(a => {
          const ok = a.perm.ok !== false && a.enabled !== false;
          return {
            label: a.label,
            icon: a.icon,
            dis: ok ? undefined : 'true',
            why: ok ? undefined : a.perm.ok === false ? a.perm.why : a.why,
            op: ok ? 1 : 0.45,
            bd: a.danger ? 'transparent' : 'var(--ln-2)',
            bg: 'transparent',
            fg: a.danger ? 'var(--err)' : 'var(--tx)',
            onClick: () => {
              if (ok) a.run();
            }
          };
        }),
        tabs: dr.tabs.map((t, i) => ({
          label: t[0],
          n: '',
          on: i === tab,
          fg: i === tab ? 'var(--tx)' : 'var(--tx-2)',
          onClick: () => this.setState({ tab: i })
        }))
      };
    }
    const topo =
      ctx.key === 'nodes' && view === 'Topology'
        ? A.sites.map(site => {
            const nodes = A.nodes.filter(n => n.site === site.name || (site.fam === 'VMware' && n.role === 'orchestrator'));
            const repos = A.repos.filter(r => r.site === site.name);
            const st = site.status === 'ok' ? ['circle-check', 'ok'] : ['triangle-alert', 'warn'];
            return {
              site: site.name,
              platform: `${site.platform} ${site.version}`,
              si: st[0],
              sc: SC[st[1]],
              onSite: () => ctx.go('sites', site.id),
              nodes: nodes.map(n => ({
                name: n.name,
                role: n.role,
                si: NST[n.status][0],
                sc: SC[NST[n.status][2]],
                onClick: () => this.setState({ drawer: n.id, tab: 0, closing: false })
              })),
              repos: repos.map(r => ({
                name: r.name,
                lock: r.lock ? 'lock' : '',
                enc: r.enc ? 'shield' : '',
                onClick: () => ctx.go('repos', r.id)
              })),
              noRepo: !repos.length,
              repoLine: repos.length ? 'var(--ln-2)' : 'transparent'
            };
          })
        : [];

    // policy / repo dialog
    let pd = E.pd;
    const G = s.pd;
    if (G) {
      const f = G.f;
      const set = k => e => {
        const v = e.target.value;
        this.setState(st => ({ pd: { ...st.pd, f: { ...st.pd.f, [k]: v } } }));
      };
      const tog = k => () => this.setState(st => ({ pd: { ...st.pd, f: { ...st.pd.f, [k]: !st.pd.f[k] } } }));
      const seg = (k, opts) =>
        opts.map(o => ({
          label: o,
          on: f[k] === o,
          fg: f[k] === o ? 'var(--tx)' : 'var(--tx-2)',
          onClick: () => this.setState(st => ({ pd: { ...st.pd, f: { ...st.pd.f, [k]: o } } }))
        }));
      const I = (k, label, span?, hint?) => ({
        id: 'pd-' + k,
        label,
        value: f[k],
        isInput: true,
        onChange: set(k),
        span: span || 1,
        hint: hint || ''
      });
      const S = (k, label, options, span, hint?) => ({
        id: 'pd-' + k,
        label,
        value: f[k],
        isSelect: true,
        options,
        onChange: set(k),
        span: span || 1,
        hint: hint || ''
      });
      const SG = (k, label, opts, hint?, span?) => ({
        id: 'pd-' + k,
        label,
        isSeg: true,
        segs: seg(k, opts),
        span: span || 2,
        hint: hint || ''
      });
      const TG = (k, label, onLabel, offLabel, icon, hint?) => ({
        id: 'pd-' + k,
        label,
        isToggle: true,
        on: !!f[k],
        onToggle: tog(k),
        onLabel: f[k] ? onLabel : offLabel,
        icon: f[k] ? icon : '',
        tbg: f[k] ? 'var(--acc)' : 'transparent',
        tbd: f[k] ? 'var(--acc)' : 'var(--ln-2)',
        knob: f[k] ? 'var(--acc-ink)' : 'var(--tx-3)',
        tx: f[k] ? 'translateX(14px)' : 'none',
        span: 2,
        hint: hint || ''
      });
      const repos = A.repos.map(r => r.name);
      if (G.kind === 'policy') {
        const TABS = ['General', 'Schedule', 'Retention', 'Destinations', 'Protection'];
        const fields = {
          General: [
            I('name', 'Policy name', 2),
            I('desc', 'Description', 2),
            SG(
              'cons',
              'Consistency',
              ['Application', 'Crash', 'Offline'],
              'Application uses the guest agent or VSS to freeze applications before the snapshot.'
            )
          ],
          Schedule: [
            SG('freq', 'Run', ['Hourly', 'Daily', 'Weekly']),
            I('time', f.freq === 'Hourly' ? 'Minute past the hour' : 'Start time (IST)', 1),
            S('window', 'Do not start after', ['No limit', '06:00', '08:00'], 1)
          ],
          Retention: [
            I(
              'keep',
              `Keep ${f.freq === 'Hourly' ? 'hourly' : f.freq === 'Weekly' ? 'weekly' : 'daily'} points`,
              1,
              'The newest points, before GFS.'
            ),
            { id: 'sp', label: '', isInput: false, span: 1, hint: '' },
            I('gw', 'GFS weekly', 1),
            I('gm', 'GFS monthly', 1),
            I('gy', 'GFS yearly', 1)
          ],
          Destinations: [S('dest', 'Repository', repos, 2), S('copy', 'Copy to a second repository', ['None'].concat(repos), 2)],
          Protection: [
            TG(
              'lock',
              'Immutability',
              'Recovery points are immutable',
              'Recovery points can be deleted',
              'lock',
              'Uses S3 Object Lock or the repository’s WORM mode.'
            ),
            ...(f.lock
              ? [
                  SG(
                    'mode',
                    'Lock mode',
                    ['Governance', 'Compliance'],
                    f.mode === 'Compliance'
                      ? 'Compliance: nobody, including Owners, can shorten or remove the lock.'
                      : 'Governance: Owners can remove the lock with a separate permission.'
                  ),
                  I('days', 'Lock for (days)', 1)
                ]
              : []),
            TG(
              'enc',
              'Encryption',
              'Encrypted with AES-256',
              'Not encrypted',
              'shield',
              'The key is held on the orchestrator and included in Aegis’s own backup.'
            )
          ]
        }[G.tab];
        pd = {
          title: G.id ? `Edit policy ${f.name}` : 'Create a policy',
          sub: 'Changes apply from the next scheduled run.',
          tabs: TABS.map(t => ({
            label: t,
            on: G.tab === t,
            fg: G.tab === t ? 'var(--tx)' : 'var(--tx-2)',
            onClick: () => this.setState(st => ({ pd: { ...st.pd, tab: t } }))
          })),
          fields: fields.filter(x => x.isInput !== false || x.isSelect || x.isSeg || x.isToggle),
          foot: G.id ? `Used by ${A.policies.find(p => p.id === G.id).guests} guests` : '',
          canBack: false,
          btn: G.id ? 'Save policy' : 'Create policy',
          btnIcon: ''
        };
      } else {
        const STEPS = ['Type', 'Location', 'Protection', 'Review'];
        const t = f.type;
        const objLock = REPO_LOCKS[t] || ['Off'];
        const where = REPO_WHERE(f);
        const fieldsBy = [
          [
            {
              ...S('type', 'Repository type', REPO_TYPES, 2, REPO_HINT[t]),
              onChange: e => {
                const v = e.target.value;
                const l = REPO_LOCKS[v] || ['Off'];
                this.setState(st => ({ pd: { ...st.pd, f: { ...st.pd.f, type: v, lock: l[l.length - 1] } } }));
              }
            },
            S('node', 'Written by', [...A.nodes.filter(n => n.role !== 'proxy').map(n => n.name), 'Deploy a new proxy (VM)', 'Deploy a new proxy (bare metal)'], 2)
          ],
          [
            I('name', 'Name', 2),
            ...(t === 'Filesystem' ? [I('path', 'Path', 2)] : []),
            ...(t === 'NFS' || t === 'SMB' ? [I('share', t === 'NFS' ? 'Export' : 'Share', 2, t === 'SMB' ? 'SMB 3 with encryption; Kerberos or a service account' : '')] : []),
            ...(t === 'SFTP' ? [I('sftpHost', 'Host'), I('sftpUser', 'User (key from the vault)'), I('path', 'Path', 2)] : []),
            ...(t === 'S3-compatible' ? [I('endpoint', 'Endpoint', 2), I('bucket', 'Bucket'), I('region', 'Region'), I('access', 'Access key'), I('secret', 'Secret key')] : []),
            ...(t === 'Amazon S3' ? [I('bucket', 'Bucket'), S('region', 'Region', ['ap-south-1', 'ap-south-2', 'eu-central-1', 'us-east-1'], 1), I('role', 'IAM role ARN', 2), S('cls', 'Storage class', ['Standard', 'Glacier Instant Retrieval', 'Glacier Flexible Retrieval', 'Glacier Deep Archive'], 2, f.cls && f.cls.includes('Flexible') ? 'Points must be restored to S3 before reading: 3 to 5 hours, retrieval charged per GB' : f.cls && f.cls.includes('Deep') ? 'Points must be restored before reading: up to 12 hours, retrieval charged per GB' : '')] : []),
            ...(t === 'Azure Blob' ? [I('azAccount', 'Storage account'), I('azContainer', 'Container'), S('azTier', 'Access tier', ['Hot', 'Cool', 'Cold', 'Archive'], 1), S('azAuth', 'Sign in with', ['Managed identity', 'SAS token', 'Account key'], 1)] : []),
            ...(t === 'Google Cloud Storage' ? [I('bucket', 'Bucket'), S('gcsLoc', 'Location', ['asia-south1 (Mumbai)', 'asia-south2 (Delhi)', 'europe-west3'], 1), I('gcsSa', 'Service account', 2)] : []),
            ...(t === 'Host360 Object Storage' ? [S('h360Region', 'Region', ['Chennai DC1', 'Mumbai DC2'], 1), I('bucket', 'Bucket')] : []),
            ...(t === 'Tape library' ? [I('tapeLib', 'Library'), S('tapePool', 'Media pool', ['Weekly-LTO9', 'Monthly-LTO9-WORM', 'Yearly-vault'], 1), I('tapeDrives', 'Drives to use'), S('tapeVault', 'Offsite vault', ['Iron Mountain, Chennai', 'None'], 1)] : []),
            ...(REPO_REMOTE.includes(t) ? [I('ipAllow', 'Allow access only from', 2, 'Addresses or ranges; the proxy that writes is always allowed')] : [])
          ],
          [
            ...(objLock.length > 1
              ? [
                  SG('lock', REPO_LOCK_LABEL[t] || 'Immutability', objLock, REPO_LOCK_HINT(t, f.lock)),
                  ...(f.lock !== 'Off' ? [I('days', 'Default lock (days)')] : [])
                ]
              : [{ id: 'pd-nolock', label: 'Immutability', isInput: false, span: 2, hint: `${t} cannot be locked. Keep an immutable copy elsewhere with a backup copy policy.` }]),
            TG('enc', 'Encryption', 'Encrypt with AES-256', 'Not encrypted', 'shield')
          ],
          [
            {
              id: 'rv',
              label: 'Summary',
              isInput: false,
              span: 2,
              hint: `${f.name} · ${t} · ${where} · written by ${f.node}${objLock.length > 1 && f.lock !== 'Off' ? ` · ${f.lock}, ${f.days} d` : ' · not immutable'}${f.ipAllow && REPO_REMOTE.includes(t) ? ` · only from ${f.ipAllow}` : ''}${f.enc ? ' · AES-256' : ''}`
            }
          ]
        ];
        pd = {
          title: 'Add a repository',
          sub: `Step ${G.step + 1} of 4 · ${STEPS[G.step]}`,
          tabs: STEPS.map((x, i) => ({
            label: `${i + 1}  ${x}`,
            on: i === G.step,
            fg: i <= G.step ? 'var(--tx)' : 'var(--tx-3)',
            onClick: () => {
              if (i < G.step) this.setState(st => ({ pd: { ...st.pd, step: i } }));
            }
          })),
          fields: fieldsBy[G.step],
          foot: '',
          canBack: G.step > 0,
          btn: G.step === 3 ? 'Add repository' : 'Next',
          btnIcon: G.step === 3 ? '' : 'chevron-right'
        };
      }
    }
    const bulk = (P.bulk || []).map(b => {
      const ok = b.perm.ok !== false && (!b.needSel || selIds.length);
      return {
        label: b.label,
        icon: b.icon,
        dis: ok ? undefined : 'true',
        why: b.perm.ok === false ? b.perm.why : !selIds.length ? 'Select rows first.' : undefined,
        op: ok ? 1 : 0.45,
        onClick: () => {
          if (ok) b.run(selIds);
        }
      };
    });
    return {
      section: ctx.section,
      title: ctx.title,
      sub: ctx.sub,
      ui: ctx.ui,
      unit: P.unit,
      sort: P.sort || '',
      dir: P.dir || 1,
      footR: P.footR || '',
      actions: (P.primary || []).map(btn),
      hasViews: !!P.views,
      views: (P.views || []).map(([label, icon, n]) => ({
        label,
        icon,
        n: n != null ? String(n) : '',
        on: view === label,
        fg: view === label ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState({ view: label, sel: {}, drawer: null })
      })),
      filters: (P.filters || []).map(f => ({
        label: f.label,
        value: s.f[f.k] || 'All',
        options: f.options,
        onChange: e => {
          const v = e.target.value;
          this.setState(st => ({ f: { ...st.f, [f.k]: v } }));
        }
      })),
      q: s.q,
      onQ: e => this.setState({ q: e.target.value }),
      filtered: !!q || Object.values(s.f).some(v => v && v !== 'All'),
      clearFilters: () => this.setState({ q: '', f: {} }),
      selLabel: selIds.length ? `${selIds.length} selected` : '',
      bulk,
      showTable: view !== 'Topology',
      showTopo: view === 'Topology',
      topo,
      cols: P.cols,
      rows,
      sel: P.bulk && P.bulk.length ? s.sel : undefined,
      active: s.drawer || '',
      onSel: P.bulk && P.bulk.length ? id => this.setState(st => ({ sel: { ...st.sel, [id]: !st.sel[id] } })) : undefined,
      onSelAll: (list, on) =>
        this.setState(st => {
          const sel = { ...st.sel };
          list.forEach(id => {
            sel[id] = on;
          });
          return { sel };
        }),
      openRow: P.onRow
        ? P.onRow
        : P.drawer
          ? id => this.setState({ drawer: id, tab: s.drawer === id ? s.tab : 0, closing: false, form: {} })
          : undefined,
      emptyText: P.emptyText || 'Nothing here yet.',
      emptyAction: P.primary && P.primary[0] && P.primary[0].primary ? P.primary[0].label : '',
      onEmpty: P.primary && P.primary[0] ? P.primary[0].onClick : undefined,
      unreachText: 'Could not be read: the orchestrator did not answer within 30 s.',
      dOpen: !!dr,
      dAnim: s.closing ? 'ae-drawer-out 150ms var(--ease) forwards' : 'ae-drawer 150ms var(--ease)',
      d,
      dt,
      logRef: this.logRef,
      closeDrawer: () => this.closeDrawer(),
      cfgDis: cfgP.dis,
      cfgWhy: cfgP.why,
      cfgOp: cfgP.op,
      saveDrawerForm: () => {
        if (cfgP.ok && dr) ctx.toast(`${dr.name} updated`, 'ok');
      },
      pdOpen: !!G,
      pd,
      pdClose: () => this.setState({ pd: null }),
      pdBack: () => this.setState(st => ({ pd: { ...st.pd, step: Math.max(0, st.pd.step - 1) } })),
      pdSave: () => {
        if (!G) return;
        if (G.kind === 'repo') {
          if (G.step < 3) {
            this.setState(st => ({ pd: { ...st.pd, step: st.pd.step + 1 } }));
            return;
          }
          const f = G.f;
          const node = A.nodes.find(n => n.name === f.node);
          this.setState(st => ({
            pd: null,
            extraRepos: st.extraRepos.concat([
              {
                id: 'rx' + Date.now(),
                name: f.name,
                type: f.type,
                site: node ? node.site : '—',
                node: f.node,
                used: 0,
                cap: 2048,
                red: '—',
                lock: (REPO_LOCKS[f.type] || ['Off']).length > 1 && f.lock !== 'Off' ? f.lock : null,
                lockDays: +f.days,
                enc: f.enc,
                status: 'ok',
                endpoint: REPO_WHERE(f),
                points: 0,
                logical: '0.00 GB'
              }
            ])
          }));
          ctx.toast(f.node.startsWith('Deploy') ? `Repository ${f.name} added; the proxy that writes to it is being deployed` : `Repository ${f.name} added`, 'ok');
          return;
        }
        const f = G.f;
        if (!G.id)
          this.setState(st => ({
            extraPolicies: st.extraPolicies.concat([
              {
                id: 'px' + Date.now(),
                name: f.name,
                schedule: f.freq === 'Hourly' ? 'Every hour' : f.freq === 'Weekly' ? `Sundays at ${f.time}` : `Daily at ${f.time}`,
                retention: `${f.keep} ${f.freq === 'Hourly' ? 'hourly' : f.freq === 'Weekly' ? 'weekly' : 'daily'}`,
                gfs: `${f.gw} weekly · ${f.gm} monthly · ${f.gy} yearly`,
                dest: f.dest,
                copy: f.copy === 'None' ? null : f.copy,
                lock: f.lock ? f.mode : null,
                lockDays: +f.days,
                enc: f.enc,
                guests: 0
              }
            ])
          }));
        this.setState({ pd: null });
        ctx.toast(G.id ? `Policy ${f.name} updated` : `Policy ${f.name} created`, 'ok');
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
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>{v.section}</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>{v.title}</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>{v.sub}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {arr(v.actions).map((a: any, i: number) => (
              <button
                key={i}
                onClick={a.onClick}
                aria-disabled={a.dis}
                data-tip={a.why}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: a.bg,
                  color: a.fg,
                  border: `1px solid ${a.bd}`,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: a.op,
                  transition: 'background-color 100ms,transform 80ms'
                }}
                className={pc('active', 'transform:translateY(1px)')}
              >
                <Icon name={a.icon} />
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 'none', padding: '0 24px 12px', display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px' }}>
          {v.hasViews ? (
            <Ind
              mode="fill"
              role="radiogroup"
              aria-label="View"
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
                  <Icon name={v.icon} />
                  {v.label}
                  <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>{v.n}</span>
                </button>
              ))}
            </Ind>
          ) : null}
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
          <div style={{ position: 'relative', width: '220px' }}>
            <Icon name="filter" style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--tx-3)', pointerEvents: 'none' }} />
            <input
              value={v.q ?? ''}
              onChange={v.onQ}
              placeholder="Filter"
              aria-label="Filter rows"
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
          {arr(v.bulk).map((bk: any, i: number) => (
            <button
              key={i}
              onClick={bk.onClick}
              aria-disabled={bk.dis}
              data-tip={bk.why}
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
                opacity: bk.op,
                transition: 'background-color 100ms'
              }}
              className={pc('hover', 'background:var(--hover)')}
            >
              <Icon name={bk.icon} />
              {bk.label}
            </button>
          ))}
        </div>
        {v.showTable ? (
          <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AegisTable
                cols={v.cols}
                rows={v.rows}
                sel={v.sel}
                onSel={v.onSel}
                onSelAll={v.onSelAll}
                onRow={v.openRow}
                active={v.active}
                state={v.ui}
                label={v.title}
                unit={v.unit}
                footR={v.footR}
                filtered={v.filtered}
                onClear={v.clearFilters}
                emptyText={v.emptyText}
                emptyAction={v.emptyAction}
                onEmpty={v.onEmpty}
                unreachText={v.unreachText}
                sort={v.sort}
                dir={v.dir}
              />
            </div>
          </div>
        ) : null}
        {v.showTopo ? (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              margin: '0 24px 24px',
              padding: '24px',
              background: 'var(--panel)',
              border: '1px solid var(--ln)',
              animation: 'ae-fade 150ms var(--ease)'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px,1fr) 48px minmax(220px,1.4fr) 48px minmax(180px,1fr)',
                font: '12px/16px var(--f-ui)',
                color: 'var(--tx-3)',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--ln)',
                marginBottom: '16px'
              }}
            >
              <span>Sites</span>
              <span />
              <span>Orchestrator, appliances and proxies</span>
              <span />
              <span>Repositories</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {arr(v.topo).map((ln: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px,1fr) 48px minmax(220px,1.4fr) 48px minmax(180px,1fr)',
                    alignItems: 'center'
                  }}
                >
                  <button
                    onClick={ln.onSite}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      padding: '10px 12px',
                      border: '1px solid var(--ln-2)',
                      background: 'var(--panel-2)',
                      transition: 'border-color 100ms'
                    }}
                    className={pc('hover', 'border-color:var(--acc)')}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <Icon name="map-pin" style={{ color: 'var(--tx-3)' }} />
                      {ln.site}
                    </span>
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}
                    >
                      <Icon name={ln.si} style={{ color: ln.sc }} />
                      {ln.platform}
                    </span>
                  </button>
                  <span aria-hidden="true" style={{ height: '1px', background: 'var(--ln-2)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', border: '1px dashed var(--ln-2)' }}>
                    {arr(ln.nodes).map((nd: any, j: number) => (
                      <button
                        key={j}
                        onClick={nd.onClick}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          height: '32px',
                          padding: '0 10px',
                          border: '1px solid var(--ln)',
                          background: 'var(--panel)',
                          font: '13px var(--f-ui)',
                          textAlign: 'left',
                          transition: 'border-color 100ms'
                        }}
                        className={pc('hover', 'border-color:var(--acc)')}
                      >
                        <Icon name={nd.si} style={{ color: nd.sc }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nd.name}</span>
                        <span style={{ color: 'var(--tx-3)' }}>{nd.role}</span>
                      </button>
                    ))}
                  </div>
                  <span aria-hidden="true" style={{ height: '1px', background: ln.repoLine }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {arr(ln.repos).map((rp: any, j: number) => (
                      <button
                        key={j}
                        onClick={rp.onClick}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          height: '36px',
                          padding: '0 10px',
                          border: '1px solid var(--ln-2)',
                          background: 'var(--panel-2)',
                          font: '13px var(--f-ui)',
                          transition: 'border-color 100ms'
                        }}
                        className={pc('hover', 'border-color:var(--acc)')}
                      >
                        <Icon name="database" style={{ color: 'var(--tx-3)' }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rp.name}</span>
                        <Icon name={rp.lock} style={{ color: 'var(--tx-2)' }} />
                        <Icon name={rp.enc} style={{ color: 'var(--tx-2)' }} />
                      </button>
                    ))}
                    {ln.noRepo ? <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>No repository on this site</span> : null}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '20px', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
              Lines show which nodes read a site and which repositories they write to. Select any box to open its details.
            </p>
          </div>
        ) : null}
        {v.dOpen ? (
          <aside
            role="dialog"
            aria-label="Details"
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
                <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{v.d?.kicker}</div>
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
                  <span>{v.d?.meta}</span>
                </div>
              </div>
              <button
                onClick={v.closeDrawer}
                aria-label="Close details"
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
            {v.d?.hasActions ? (
              <div style={{ flex: 'none', padding: '16px 24px 0', display: 'flex', gap: '8px' }}>
                {arr(v.d?.actions).map((da: any, i: number) => (
                  <button
                    key={i}
                    onClick={da.onClick}
                    aria-disabled={da.dis}
                    data-tip={da.why}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid ${da.bd}`,
                      background: da.bg,
                      color: da.fg,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      opacity: da.op,
                      transition: 'background-color 100ms'
                    }}
                  >
                    <Icon name={da.icon} />
                    {da.label}
                  </button>
                ))}
              </div>
            ) : null}
            <Ind
              mode="underline"
              role="tablist"
              aria-label="Sections"
              style={{ flex: 'none', display: 'flex', padding: '12px 16px 0', borderBottom: '1px solid var(--ln)' }}
            >
              {arr(v.d?.tabs).map((t: any, i: number) => (
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
                    background: v.d?.nbg,
                    border: '1px solid var(--ln-2)'
                  }}
                >
                  <Icon name={v.d?.ni} style={{ color: v.d?.nc, marginTop: '2px' }} />
                  <span>{v.d?.note}</span>
                </div>
              ) : null}
              {v.dt?.isSteps ? (
                <ol
                  aria-label="Lifecycle"
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  {arr(v.dt?.steps).map((sp: any, i: number) => (
                    <li
                      key={i}
                      aria-current={sp.current}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px minmax(0,1fr) auto',
                        gap: '10px',
                        alignItems: 'center',
                        minHeight: '32px',
                        padding: '0 8px',
                        background: sp.bg,
                        color: sp.fg,
                        transition: 'background-color 150ms,color 150ms'
                      }}
                    >
                      <Icon name={sp.i} spin={sp.spin} style={{ color: sp.ic }} />
                      <span style={{ fontWeight: sp.fw }}>{sp.label}</span>
                      <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{sp.note}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {v.dt?.isFacts ? (
                <dl
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '180px minmax(0,1fr)',
                    font: '13px/18px var(--f-ui)',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  {arr(v.dt?.facts).map((f: any, i: number) => (
                    <Fragment key={i}>
                      <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                      <dd
                        style={{
                          padding: '9px 0',
                          borderBottom: '1px solid var(--ln)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          minWidth: 0,
                          fontStyle: f.fs,
                          color: f.c
                        }}
                      >
                        <Icon name={f.i} style={{ color: f.ic }} />
                        <span style={{ overflowWrap: 'anywhere' }}>{f.v}</span>
                      </dd>
                    </Fragment>
                  ))}
                </dl>
              ) : null}
              {v.dt?.isTable ? (
                <div
                  role="table"
                  style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums', animation: 'ae-fade 150ms var(--ease)' }}
                >
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: v.dt?.grid,
                      gap: '8px',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    {arr(v.dt?.head).map((hc: any, i: number) => (
                      <div key={i} role="columnheader" style={{ textAlign: hc.ta }}>
                        {hc.v}
                      </div>
                    ))}
                  </div>
                  {arr(v.dt?.rows).map((tr: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: v.dt?.grid,
                        gap: '8px',
                        alignItems: 'center',
                        minHeight: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      {arr(tr.cells).map((tc: any, j: number) => (
                        <div
                          key={j}
                          role="cell"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: tc.jc, gap: '6px', minWidth: 0, color: tc.c }}
                        >
                          <Icon name={tc.i} style={{ color: tc.ic }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tc.v}</span>
                          {tc.bar ? (
                            <span style={{ flex: 1, minWidth: '40px', height: '6px', background: 'var(--ln)' }}>
                              <span style={{ display: 'block', height: '6px', width: tc.bar, background: tc.bc }} />
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                  {v.dt?.emptyRows ? (
                    <p style={{ padding: '16px 0', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>{v.dt?.emptyRows}</p>
                  ) : null}
                </div>
              ) : null}
              {v.dt?.isLog ? (
                <div
                  ref={v.logRef}
                  role="log"
                  aria-label="Log"
                  style={{
                    height: '280px',
                    overflow: 'auto',
                    padding: '8px 12px',
                    background: 'var(--panel-2)',
                    border: '1px solid var(--ln)',
                    font: '12px/20px var(--f-ui)',
                    fontVariantNumeric: 'tabular-nums',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  {arr(v.dt?.log).map((lg: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '72px 16px minmax(0,1fr)',
                        gap: '8px',
                        alignItems: 'center',
                        animation: 'ae-line 150ms var(--ease)'
                      }}
                    >
                      <span style={{ color: 'var(--tx-3)' }}>{lg.t}</span>
                      <Icon name={lg.i} style={{ color: lg.c }} />
                      <span>{lg.text}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {v.dt?.isForm ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxWidth: '440px',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  {arr(v.dt?.fields).map((ff: any, i: number) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor={ff.id} style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        {ff.label}
                      </label>
                      <input
                        id={ff.id}
                        value={ff.value ?? ''}
                        onChange={ff.onInput}
                        style={{
                          height: '36px',
                          padding: '0 10px',
                          background: 'var(--panel-2)',
                          border: '1px solid var(--ln)',
                          font: '14px var(--f-body)'
                        }}
                        className={pc('focus', 'border-color:var(--acc)')}
                      />
                      {ff.hint ? <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{ff.hint}</span> : null}
                    </div>
                  ))}
                  <div>
                    <button
                      onClick={v.saveDrawerForm}
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
                      Save changes
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
        {v.pdOpen ? (
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
              aria-labelledby="pd-title"
              style={{
                width: '720px',
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 48px)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--overlay)',
                border: '1px solid var(--ln-2)',
                boxShadow: 'var(--sh-over)',
                animation: 'ae-dialog 150ms var(--ease)'
              }}
            >
              <div style={{ flex: 'none', padding: '20px 16px 0 24px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <h2 id="pd-title" style={{ font: '500 20px/28px var(--f-head)' }}>
                    {v.pd?.title}
                  </h2>
                  <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>{v.pd?.sub}</p>
                </div>
                <button
                  onClick={v.pdClose}
                  aria-label="Close"
                  style={{ width: '32px', height: '32px', display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  <Icon name="x" size="20" />
                </button>
              </div>
              <Ind
                mode="underline"
                role="tablist"
                style={{ flex: 'none', display: 'flex', padding: '12px 16px 0', borderBottom: '1px solid var(--ln)' }}
              >
                {arr(v.pd?.tabs).map((t: any, i: number) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={t.on}
                    onClick={t.onClick}
                    style={{ height: '40px', padding: '0 10px', fontWeight: 600, color: t.fg, transition: 'color 100ms' }}
                    className={pc('hover', 'color:var(--tx)')}
                  >
                    {t.label}
                  </button>
                ))}
              </Ind>
              <div style={{ flex: 1, minHeight: '360px', overflow: 'auto', padding: '20px 24px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                    gap: '16px',
                    animation: 'ae-step 150ms var(--ease)'
                  }}
                >
                  {arr(v.pd?.fields).map((f: any, i: number) => (
                    <div
                      key={i}
                      style={{ gridColumn: `span ${f.span}`, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}
                    >
                      <label htmlFor={f.id} style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        {f.label}
                      </label>
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
                            font: '14px var(--f-body)',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                          className={pc('focus', 'border-color:var(--acc)')}
                        />
                      ) : null}
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
                      {f.isSeg ? (
                        <Ind
                          mode="fill"
                          role="radiogroup"
                          aria-label={f.label}
                          style={{ display: 'flex', alignSelf: 'flex-start', border: '1px solid var(--ln-2)' }}
                        >
                          {arr(f.segs).map((sg: any, j: number) => (
                            <button
                              key={j}
                              role="radio"
                              aria-checked={sg.on}
                              onClick={sg.onClick}
                              style={{
                                height: '30px',
                                padding: '0 14px',
                                font: '13px var(--f-ui)',
                                color: sg.fg,
                                transition: 'color 100ms'
                              }}
                            >
                              {sg.label}
                            </button>
                          ))}
                        </Ind>
                      ) : null}
                      {f.isToggle ? (
                        <button
                          role="switch"
                          aria-checked={f.on}
                          onClick={f.onToggle}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '32px' }}
                        >
                          <span
                            style={{
                              width: '32px',
                              height: '18px',
                              padding: '2px',
                              display: 'flex',
                              background: f.tbg,
                              border: `1px solid ${f.tbd}`,
                              transition: 'background-color 120ms'
                            }}
                          >
                            <span
                              style={{
                                width: '12px',
                                height: '12px',
                                background: f.knob,
                                transform: f.tx,
                                transition: 'transform 120ms var(--ease)'
                              }}
                            />
                          </span>
                          <Icon name={f.icon} style={{ color: 'var(--tx-2)' }} />
                          <span>{f.onLabel}</span>
                        </button>
                      ) : null}
                      {f.hint ? (
                        <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)', textWrap: 'pretty' }}>{f.hint}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <div
                style={{
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px 12px 24px',
                  borderTop: '1px solid var(--ln)'
                }}
              >
                <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.pd?.foot}</span>
                <span style={{ flex: 1 }} />
                <button
                  onClick={v.pdClose}
                  style={{ height: '32px', padding: '0 12px', fontWeight: 600 }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  Cancel
                </button>
                {v.pd?.canBack ? (
                  <button
                    onClick={v.pdBack}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1px solid var(--ln-2)',
                      fontWeight: 600
                    }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    <Icon name="chevron-left" />
                    Back
                  </button>
                ) : null}
                <button
                  onClick={v.pdSave}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--acc)',
                    color: 'var(--acc-ink)',
                    fontWeight: 600,
                    transition: 'background-color 100ms'
                  }}
                  className={pc('hover', 'background:var(--acc-h)')}
                >
                  {v.pd?.btn}
                  <Icon name={v.pd?.btnIcon} />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
