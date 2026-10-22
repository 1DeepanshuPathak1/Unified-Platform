/* Ported from project/AegisSites.dc.html */
import { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';
import AegisTable from '../components/AegisTable';

const W = () => AEGIS;
const STATUS = {
  ok: ['circle-check', 'Online', 'ok'],
  unreach: ['triangle-alert', 'Unreachable', 'warn'],
  degraded: ['circle-alert', 'Degraded', 'warn'],
  reading: ['loader-circle', 'Reading…', 'run']
};
const SC = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', run: 'var(--run)' };
const PLATFORMS = [
  { id: 'pve', label: 'Proxmox VE', icon: 'server', desc: 'A Proxmox VE cluster or single node, version 8 or 9.' },
  { id: 'os', label: 'OpenStack', icon: 'layers', desc: 'Instances in one OpenStack project, read through Keystone.' },
  { id: 'vmw', label: 'VMware vCenter or ESXi', icon: 'monitor', desc: 'A source platform for Disaster Recovery and Migration.' }
];
const METHODS = [
  {
    id: 'apissh',
    label: 'Proxmox API and SSH',
    tag: 'Fastest',
    note: 'An API token reads the inventory; SSH tracks changes and prepares restores.'
  },
  { id: 'api', label: 'Proxmox API only', tag: 'No shell access', note: 'No shell access; every backup reads the whole disk.' },
  { id: 'ssh', label: 'SSH only', tag: 'No Proxmox user', note: 'No Proxmox user; listing guests and preparing restores take longer.' }
];
const STEPS = ['Platform', 'Connection', 'Verify', 'Name and review'];
const blankW = () => ({
  open: false,
  closing: false,
  step: 0,
  platform: 'pve',
  method: 'apissh',
  osMode: 'fields',
  file: false,
  editId: null,
  testing: false,
  tested: false,
  trusted: false,
  check: 0,
  checked: false,
  tried: false,
  nameTried: false,
  usedBy: { Backup: true, DR: true, Migration: false },
  f: {
    host: '10.20.30.11',
    port: '8006',
    tokenId: 'aegis@pve!backup',
    tokenSecret: '3f6c1e0a-9b7d-4c22-a1e5-7d0f2b8c9e41',
    rootPw: '',
    sshPort: '22',
    authUrl: 'https://keystone.dr.host360.local:5000/v3',
    region: 'RegionOne',
    project: 'dr-project',
    user: 'aegis-svc',
    pw: '',
    iface: 'public',
    projDomain: 'Default',
    userDomain: 'Default',
    display: 'Chennai vCenter DR',
    addr: 'vcenter-dr.chennai.host360.local',
    vport: '443',
    vuser: 'svc-aegis@vsphere.local',
    vpw: ''
  },
  name: ''
});

export default class AegisSites extends DC {
  state: any = {
    plat: 'All',
    q: '',
    sel: {},
    drawer: null,
    closing: false,
    tab: 'Overview',
    w: blankW(),
    rm: null,
    extra: [],
    removed: {},
    flash: null,
    refreshing: {}
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

  sites() {
    const A = W();
    return A.sites
      .concat(this.state.extra)
      .filter(s => !this.state.removed[s.id])
      .map(s => (this.state.refreshing[s.id] ? { ...s, status: 'reading' } : s));
  }
  closeDrawer() {
    this.setState({ closing: true });
    setTimeout(() => this.setState({ drawer: null, closing: false }), 150);
  }
  closeWizard() {
    this.setState(s => ({ w: { ...s.w, closing: true } }));
    setTimeout(() => this.setState({ w: blankW() }), 150);
  }
  setF(k, v) {
    this.setState(s => ({
      w: {
        ...s.w,
        f: { ...s.w.f, [k]: v },
        trusted: k === 'host' || k === 'addr' ? false : s.w.trusted,
        checked: k === 'host' || k === 'addr' ? false : s.w.checked
      }
    }));
  }
  refresh(ids) {
    const ctx = this.props.ctx;
    const all = this.sites();
    ids.forEach(id => {
      const site = all.find(s => s.id === id);
      if (!site) return;
      this.setState(s => ({ refreshing: { ...s.refreshing, [id]: true } }));
      ctx.startJob({
        name: 'Refresh inventory',
        object: site.name,
        product: 'Backup',
        type: 'Inventory',
        phases: ['Connect', 'List nodes', 'List guests', 'List storage and networks', 'Done'],
        speed: 34,
        doneToast: site.status === 'unreach' ? `${site.name} still could not be read` : `Inventory of ${site.name} refreshed`
      });
      setTimeout(
        () =>
          this.setState(s => {
            const r = { ...s.refreshing };
            delete r[id];
            return { refreshing: r };
          }),
        3200
      );
    });
  }
  runCheck() {
    this.setState(s => ({ w: { ...s.w, trusted: true, check: 0, checked: false } }));
    let n = 0;
    clearInterval(this.ci);
    this.ci = setInterval(() => {
      n += 20;
      this.setState(s => ({ w: { ...s.w, check: Math.min(100, n) } }));
      if (n >= 100) {
        clearInterval(this.ci);
        this.setState(s => ({ w: { ...s.w, checked: true } }));
      }
    }, 180);
  }

  fields(w) {
    const F = (id, label, span, extra?) => ({ id: 'f-' + id, key: id, label, span, type: 'text', ph: '', ...extra });
    let list = [];
    if (w.platform === 'pve') {
      if (w.method !== 'ssh')
        list = [
          F('host', 'Host', 4, { ph: 'pve01.example.local or 10.0.0.11' }),
          F('port', 'Port', 2),
          F('tokenId', 'Token ID', 3, { ph: 'user@realm!token' }),
          F('tokenSecret', 'Token secret', 3, { type: 'password' })
        ];
      else list = [F('host', 'Host', 4), F('sshPort', 'SSH port', 2)];
      if (w.method !== 'api')
        list.push(
          F('rootPw', 'Root password', 3, {
            type: 'password',
            hint: `Enter the root password of ${w.f.host || '<host>'}. Aegis uses it once, to install its key, and never stores it.`,
            span: 6
          })
        );
    } else if (w.platform === 'os') {
      list = [
        F('authUrl', 'Auth URL', 6),
        F('region', 'Region', 2),
        F('project', 'Project name', 2),
        F('iface', 'Interface', 2, { select: ['public', 'internal', 'admin'] }),
        F('user', 'Username', 3),
        F('pw', 'Password', 3, { type: 'password' }),
        F('projDomain', 'Project domain', 3),
        F('userDomain', 'User domain', 3)
      ];
    } else {
      list = [
        F('display', 'Display name', 6),
        F('addr', 'Address', 4),
        F('vport', 'Port', 2),
        F('vuser', 'Username', 3),
        F('vpw', 'Password', 3, { type: 'password' })
      ];
    }
    return list.map(f => {
      const v = w.f[f.key] || '';
      const err = w.tried && !v ? `Enter the ${f.label.toLowerCase()}.` : '';
      return {
        ...f,
        value: v,
        isInput: !f.select,
        isSelect: !!f.select,
        options: f.select || [],
        err,
        invalid: err ? 'true' : undefined,
        bd: err ? 'var(--err)' : 'var(--ln)',
        hint: f.hint || '',
        onInput: e => this.setF(f.key, e.target.value)
      };
    });
  }

  renderVals() {
    const A = W();
    const ctx = this.props.ctx;
    if (!A || !ctx)
      return {
        cols: [],
        rows: [],
        plats: [],
        dtabs: [],
        tab: {},
        d: {},
        w: { steps: [], platforms: [], methods: [], fields: [], uses: [], review: [], cert: [], caps: [], osModes: [] },
        rm: { removed: [] }
      };
    const s = this.state;
    const cfg = ctx.can('configure', 'Adding and editing sites');
    const op = ctx.can('operate', 'Refreshing inventory');
    const del = ctx.can('destroy', 'Removing a site');
    const backup = ctx.product === 'backup';
    const all = this.sites();
    const base = all.filter(x => !backup || !x.vmw);
    let rows = base;
    if (s.plat !== 'All') rows = rows.filter(r => r.fam === s.plat);
    const q = s.q.trim().toLowerCase();
    if (q) rows = rows.filter(r => (r.name + ' ' + r.addr + ' ' + r.version + ' ' + r.platform).toLowerCase().includes(q));
    const nr = v => (v == null ? { v: 'Not read', muted: true, italic: true, s: null } : { v: String(v), s: v });
    const tableRows = rows.map(r => {
      const st = STATUS[r.status];
      return {
        id: r.id,
        name: { v: r.name, strong: false },
        platform: r.platform,
        version: r.version,
        access: r.access,
        nodes: nr(r.nodes),
        guests: nr(r.guests),
        usedBy: r.usedBy,
        status: {
          t: 'status',
          i: st[0],
          l: st[1],
          c: st[2],
          spin: r.status === 'reading',
          tip: r.reason ? `${st[1]}: ${r.reason}` : st[1],
          s: r.status
        },
        seen: { v: r.seen, s: r.seen }
      };
    });
    const cols = [
      { k: 'name', label: 'Name', w: 'minmax(160px,1.5fr)' },
      { k: 'platform', label: 'Platform', w: 'minmax(110px,1fr)', dim: true },
      { k: 'version', label: 'Version', w: '76px', dim: true },
      { k: 'access', label: 'Access method', w: 'minmax(140px,1.3fr)', dim: true },
      { k: 'nodes', label: 'Nodes', w: '72px', r: true },
      { k: 'guests', label: 'Guests', w: '72px', r: true },
      { k: 'usedBy', label: 'Used by', w: 'minmax(170px,1.5fr)', nosort: true },
      { k: 'status', label: 'Status', w: '128px' },
      { k: 'seen', label: 'Last seen', w: '176px', dim: true }
    ];
    const ids = tableRows.map(r => r.id);
    const selIds = ids.filter(id => s.sel[id]);
    const plats = ['All', 'Proxmox VE', 'OpenStack', 'VMware']
      .filter(p => !backup || p !== 'VMware')
      .map(p => ({
        label: p,
        on: s.plat === p,
        fg: s.plat === p ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState({ plat: p, sel: {} })
      }));
    const hidden = all.length - base.length;

    // drawer
    const dsite = s.drawer && rows.concat(base).find(x => x.id === s.drawer);
    let d: any = { facts: [], nodes: [], storage: [], networks: [], access: [], privs: [], activity: [] };
    if (dsite) {
      const st = STATUS[dsite.status];
      const unread = dsite.nodes == null;
      const fact = (k, v, muted?) => ({ k, v, fs: muted ? 'italic' : 'normal', c: muted ? 'var(--tx-3)' : 'var(--tx)' });
      const nodes = A.siteNodes[dsite.id] || [];
      d = {
        name: dsite.name,
        platform: dsite.platform,
        si: st[0],
        sl: st[1],
        sc: SC[st[2]],
        spin: dsite.status === 'reading' ? 'true' : 'false',
        seen: dsite.seen,
        hasReason: !!dsite.reason,
        reasonText:
          dsite.status === 'unreach'
            ? `Could not be read: ${dsite.reason} Values below are from the last read at ${dsite.seen}.`
            : dsite.reason,
        facts: [
          fact('Platform', `${dsite.platform} ${dsite.version}`),
          fact('Access method', dsite.access),
          fact('Address', dsite.addr),
          fact('Nodes', unread ? 'Not read' : `${dsite.nodes} (${dsite.nodes} online)`, unread),
          fact('Guests', unread ? 'Not read' : String(dsite.guests), unread),
          fact('Used by', dsite.usedBy.join(', ')),
          fact('Proxies', dsite.proxies || '—'),
          fact('Added', dsite.added || '—'),
          fact('Last seen', dsite.seen)
        ],
        nodes,
        noNodes: nodes.length === 0,
        storage: (A.siteStorage[dsite.id] || []).map(([name, type, used, cap, pct]) => ({
          name,
          type,
          label: `${used} of ${cap} · ${pct} %`,
          pctW: pct + '%',
          bc: pct >= 90 ? 'var(--warn)' : 'var(--tx-3)'
        })),
        networks: (A.siteNetworks[dsite.id] || []).map(([name, type, tag, cidr]) => ({ name, type, tag, cidr })),
        access: [
          { k: 'Method', v: dsite.access },
          { k: 'Account', v: dsite.account || '—' },
          { k: 'Address', v: dsite.addr },
          { k: 'Certificate', v: dsite.fp ? `SHA-256 ${dsite.fp}` : '—' },
          { k: 'Last verified', v: dsite.status === 'unreach' ? 'Could not be verified' : dsite.seen }
        ],
        privs: (dsite.fam === 'VMware'
          ? ['Read inventory', 'Create and remove snapshots', 'Power off virtual machines', 'Read changed blocks']
          : dsite.fam === 'OpenStack'
            ? ['List instances and volumes', 'Create volume snapshots', 'Create servers in the project', 'Read networks and flavors']
            : [
                'Read nodes and guests',
                'Back up guests (VM.Backup)',
                'Allocate storage (Datastore.Allocate)',
                'Shell access for change tracking'
              ]
        ).map((label, i) => {
          if (dsite.status === 'unreach') return { label, i: 'circle-minus', c: 'var(--tx-3)', state: 'Not read' };
          if (dsite.access === 'SSH only' && i === 3) return { label, i: 'circle-check', c: 'var(--ok)', state: 'Key installed' };
          return { label, i: 'circle-check', c: 'var(--ok)', state: 'Granted' };
        }),
        activity: [
          {
            i: 'refresh-cw',
            c: 'var(--tx-3)',
            text: dsite.status === 'unreach' ? 'Inventory read failed: Keystone did not answer within 30 s' : 'Inventory read: no changes',
            when: dsite.seen
          },
          {
            i: 'circle-check',
            c: 'var(--ok)',
            text: 'Certificate confirmed and access verified',
            when: (dsite.added || '').split(' by ')[0]
          },
          {
            i: 'plus',
            c: 'var(--tx-3)',
            text: `Site added${dsite.added ? ' by ' + dsite.added.split(' by ')[1] : ''}`,
            when: (dsite.added || '').split(' by ')[0]
          }
        ]
      };
    }
    const TABS = ['Overview', 'Nodes', 'Storage', 'Networks', 'Access', 'Activity'];
    const dtabs = TABS.map(t => ({
      label: t,
      on: s.tab === t,
      fg: s.tab === t ? 'var(--tx)' : 'var(--tx-2)',
      tip: t === 'Activity' ? 'Proposed: reads, access changes and refreshes for this site' : undefined,
      onClick: () => this.setState({ tab: t })
    }));

    // wizard
    const w = s.w;
    const isEdit = !!w.editId;
    const existing = all.find(x => x.addr && w.f.host && x.addr.split(':')[0] === w.f.host.trim());
    const existingV = all.find(x => x.addr && w.f.addr && x.addr.split(':')[0] === w.f.addr.trim());
    const clash = !isEdit && (w.platform === 'pve' ? existing : w.platform === 'vmw' ? existingV : null);
    const fieldsList = this.fields(w);
    const missing = w.platform !== 'os' || w.osMode === 'fields' ? fieldsList.filter(f => !f.value).length : !w.file || !w.f.pw ? 1 : 0;
    const host =
      w.platform === 'pve' ? w.f.host : w.platform === 'vmw' ? w.f.addr : (w.f.authUrl || '').replace(/^https?:\/\//, '').split('/')[0];
    const suggested = w.platform === 'pve' ? 'Chennai-proxmox-dr' : w.platform === 'os' ? 'dr-openstack' : w.f.display;
    const nameVal = w.name || suggested;
    const nameClash = all.some(x => x.name.toLowerCase() === nameVal.trim().toLowerCase() && x.id !== w.editId);
    const nameErr = !nameVal.trim() ? 'Enter a site name.' : nameClash ? `A site named ${nameVal.trim()} already exists.` : '';
    const ssh = w.platform === 'pve' && w.method === 'ssh';
    const caps =
      w.platform === 'pve'
        ? [
            ['circle-check', 'ok', 'Proxmox version', '9.2.2'],
            ['circle-check', 'ok', 'Nodes', '3 (pve-dr1, pve-dr2, pve-dr3)'],
            ['circle-check', 'ok', 'Guests', '41'],
            ['circle-check', 'ok', 'Storages', '3 (ceph-dr, local-lvm, nfs-iso)'],
            ['circle-check', 'ok', 'Bridges', '2 (vmbr0, vmbr99)'],
            w.method === 'api'
              ? ['triangle-alert', 'warn', 'Missing privileges', 'Sys.Audit on /nodes. Node load is not shown; backups still work.']
              : ['circle-check', 'ok', 'Missing privileges', 'None']
          ]
        : w.platform === 'os'
          ? [
              ['circle-check', 'ok', 'Keystone', 'v3.14, region RegionOne'],
              ['circle-check', 'ok', 'Instances', '18'],
              ['circle-check', 'ok', 'Volume types', '2 (ceph-ssd, standard)'],
              ['circle-check', 'ok', 'Networks', '3 (dr-net, dr-app, dr-test-isolated)'],
              ['circle-check', 'ok', 'Flavors', '12'],
              ['circle-check', 'ok', 'Missing roles', 'None']
            ]
          : [
              ['circle-check', 'ok', 'Version', 'VMware vCenter Server 8.0.3'],
              ['circle-check', 'ok', 'Hosts', '3'],
              ['circle-check', 'ok', 'Datastores', '3'],
              ['circle-check', 'ok', 'Virtual machines', '41'],
              ['circle-check', 'ok', 'Missing permissions', 'None']
            ];
    const radio = on => ({
      bd: on ? 'var(--acc)' : 'var(--ln)',
      bg: on ? 'var(--acc-soft)' : 'var(--panel-2)',
      ring: on ? 'inset 0 0 0 1px var(--acc)' : 'none',
      hbd: on ? 'var(--acc)' : 'var(--ln-2)',
      rbd: on ? 'var(--acc)' : 'var(--ln-2)',
      rin: on ? 'var(--overlay)' : 'transparent',
      rbg: on ? 'var(--acc)' : 'transparent'
    });
    const canNext = [true, missing === 0 && (w.platform !== 'vmw' || w.tested), w.checked && !clash, !nameErr][w.step];
    const nextWhy = [
      undefined,
      missing ? 'Fill in every field first.' : w.platform === 'vmw' && !w.tested ? 'Test the connection first.' : undefined,
      clash ? 'This node is already protected.' : !w.checked ? `Trust the ${ssh ? 'host key' : 'certificate'} first.` : undefined,
      nameErr || undefined
    ][w.step];
    const wv = {
      title: isEdit ? `Edit access for ${w.name}` : w.platform === 'vmw' && w.step > 0 ? 'Add source platform' : 'Add a platform',
      sub: [
        'Choose what you are connecting and how Aegis reaches it.',
        'How Aegis signs in. Credentials are stored encrypted on the orchestrator.',
        'Check who you are talking to, then what the account can see.',
        'Name the site and choose which products use it.'
      ][w.step],
      steps: STEPS.map((label, i) => ({
        label,
        current: i === w.step ? 'step' : undefined,
        bar: i <= w.step ? 'var(--acc)' : 'var(--ln)',
        fg: i === w.step ? 'var(--tx)' : i < w.step ? 'var(--tx-2)' : 'var(--tx-3)',
        bd: i <= w.step ? 'var(--acc)' : 'var(--ln-2)',
        bg: i < w.step ? 'var(--acc)' : 'transparent',
        nfg: i < w.step ? 'var(--acc-ink)' : i === w.step ? 'var(--acc-tx)' : 'var(--tx-3)',
        mark: i < w.step ? '✓' : String(i + 1)
      })),
      s1: w.step === 0,
      s2: w.step === 1,
      s3: w.step === 2,
      s4: w.step === 3,
      platforms: PLATFORMS.map(p => {
        const dis = backup && p.id === 'vmw';
        const on = w.platform === p.id;
        return {
          ...p,
          on,
          ...radio(on),
          ic: on ? 'var(--acc)' : 'var(--tx-2)',
          dis: dis ? 'true' : undefined,
          why: dis ? 'VMware is used by Disaster Recovery and Migration. Switch product to add a VMware source.' : undefined,
          op: dis ? 0.45 : 1,
          onClick: () => {
            if (!dis)
              this.setState(st => ({
                w: {
                  ...st.w,
                  platform: p.id,
                  tried: false,
                  tested: false,
                  trusted: false,
                  checked: false,
                  usedBy: p.id === 'vmw' ? { Backup: false, DR: true, Migration: true } : { Backup: true, DR: true, Migration: false }
                }
              }));
          }
        };
      }),
      isPve: w.platform === 'pve',
      isOs: w.platform === 'os',
      isVmw: w.platform === 'vmw',
      methods: METHODS.map(m => {
        const on = w.method === m.id;
        return { ...m, on, ...radio(on), onClick: () => this.setState(st => ({ w: { ...st.w, method: m.id, tried: false } })) };
      }),
      osModes: [
        ['fields', 'Fill in fields'],
        ['openrc', 'Paste openrc']
      ].map(([id, label]) => ({
        label,
        on: w.osMode === id,
        fg: w.osMode === id ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState(st => ({ w: { ...st.w, osMode: id } }))
      })),
      showFields: w.platform !== 'os' || w.osMode === 'fields',
      showOpenrc: w.platform === 'os' && w.osMode === 'openrc',
      noFile: !w.file,
      hasFile: w.file,
      f: w.f,
      setPw: e => this.setF('pw', e.target.value),
      fields: fieldsList,
      testIcon: w.testing ? 'loader-circle' : 'plug',
      testSpin: w.testing ? 'true' : 'false',
      testOk: w.tested,
      refused: !!clash,
      notRefused: !clash,
      refusal: clash
        ? `This node is already protected as site ${clash.name}, because it answers at ${clash.addr.split(':')[0]}. A node can be added only once.`
        : '',
      certIcon: w.trusted ? 'circle-check' : ssh ? 'key' : 'circle-alert',
      certColor: w.trusted ? 'var(--ok)' : 'var(--tx-2)',
      certTitle: ssh ? `Host key of ${host}` : `Certificate of ${host}`,
      certState: w.trusted ? 'Trusted' : 'Not trusted yet',
      trustLabel: ssh ? 'Trust this host key' : 'Trust this certificate',
      cert: ssh
        ? [
            { k: 'Key type', v: 'ED25519', ls: '0' },
            { k: 'Fingerprint', v: 'SHA256:q3Lk9Rw2mXo0bD7vPz1sYc4hT8eN6uJaKf5gVt8', ls: '0.02em' }
          ]
        : [
            { k: 'Issued to', v: host, ls: '0' },
            {
              k: 'Issued by',
              v:
                w.platform === 'pve'
                  ? 'Proxmox Virtual Environment CA'
                  : w.platform === 'os'
                    ? 'Host360 Internal CA'
                    : 'VMware Certificate Authority',
              ls: '0'
            },
            { k: 'Valid until', v: '12 Mar 2028', ls: '0' },
            {
              k: 'SHA-256',
              v: '9C:4E:12:A0:7B:3D:F1:66:08:E2:5A:C9:31:7F:D4:0B:86:2E:A1:5C:F0:39:B7:64:1D:E8:42:9A:C3:05:7E:D2',
              ls: '0.02em'
            }
          ],
      untrusted: !w.trusted,
      checking: w.trusted && !w.checked,
      checked: w.checked,
      checkW: w.check + '%',
      capTitle:
        w.platform === 'pve' ? 'What the token can do' : w.platform === 'os' ? 'What the account can see' : 'What the account can do',
      caps: caps.map(([i, c, k, v]) => ({ i, c: SC[c], k, v })),
      name: nameVal,
      nameErr: w.nameTried || nameClash ? nameErr : '',
      nameInvalid: nameErr ? 'true' : undefined,
      nameBd: (w.nameTried || nameClash) && nameErr ? 'var(--err)' : 'var(--ln)',
      uses: ['Backup', 'DR', 'Migration'].map(u => {
        const dis =
          (w.platform === 'vmw' && u === 'Backup') || (w.platform !== 'vmw' && u === 'Migration' && w.platform === 'pve' && false);
        const on = !!w.usedBy[u] && !dis;
        return {
          label: u === 'DR' ? 'Resilience' : u === 'Backup' ? 'Protection' : 'Mobility',
          on,
          dis: dis ? 'true' : undefined,
          why: dis ? 'Backup & Recovery does not use VMware.' : undefined,
          op: dis ? 0.45 : 1,
          bd: on ? 'var(--acc)' : 'var(--ln-2)',
          bg: on ? 'var(--acc-soft)' : 'transparent',
          cbd: on ? 'var(--acc)' : 'var(--ln-2)',
          cbg: on ? 'var(--acc)' : 'transparent',
          icon: on ? 'check' : '',
          onClick: () => {
            if (!dis) this.setState(st => ({ w: { ...st.w, usedBy: { ...st.w.usedBy, [u]: !st.w.usedBy[u] } } }));
          }
        };
      }),
      review: [
        ['Platform', PLATFORMS.find(p => p.id === w.platform).label],
        [
          'Access method',
          w.platform === 'pve' ? METHODS.find(m => m.id === w.method).label : w.platform === 'os' ? 'Keystone v3, password' : 'vSphere API'
        ],
        ['Address', host],
        [
          'Account',
          w.platform === 'pve'
            ? w.method === 'ssh'
              ? 'root (key will be installed)'
              : w.f.tokenId
            : w.platform === 'os'
              ? `${w.f.user} (domain ${w.f.userDomain})`
              : w.f.vuser
        ],
        ['Certificate', ssh ? 'Host key trusted' : 'Trusted, SHA-256 9C:4E:…:7E:D2'],
        ['Found', w.platform === 'pve' ? '3 nodes, 41 guests' : w.platform === 'os' ? '18 instances' : '3 hosts, 41 VMs']
      ].map(([k, v]) => ({ k, v })),
      stepLabel: `Step ${w.step + 1} of 4`,
      canBack: w.step > 0,
      nextLabel: w.step === 3 ? (isEdit ? 'Save access' : w.platform === 'vmw' ? 'Add source platform' : 'Add site') : 'Next',
      nextIcon: w.step === 3 ? '' : 'chevron-right',
      nextDis: canNext ? undefined : 'true',
      nextWhy: canNext ? undefined : nextWhy,
      nextOp: canNext ? 1 : 0.45
    };

    const rm = s.rm
      ? (() => {
          const site = all.find(x => x.id === s.rm.id);
          if (!site) return { removed: [] };
          const ok = s.rm.typed === site.name;
          return {
            name: site.name,
            typed: s.rm.typed,
            dis: ok ? undefined : 'true',
            op: ok ? 1 : 0.45,
            removed: [
              `The site ${site.name} and its stored access (${site.access === 'SSH only' ? 'SSH key' : 'API token and SSH key'})`,
              site.guests != null
                ? `${site.guests} guests from protection, and their policy assignments`
                : 'Its guests from protection, and their policy assignments',
              `${site.name} from ${site.usedBy.map(u => (u === 'DR' ? 'Resilience' : u === 'Backup' ? 'Protection' : 'Mobility')).join(' and ')}`
            ],
            kept: 'Kept: recovery points already stored in repositories, mappings history and the audit trail. Removing a site does not change anything on the platform itself.'
          };
        })()
      : { removed: [] };

    return {
      project: ctx.project,
      ui: ctx.ui,
      unit: ['site', 'sites'],
      cfgDis: cfg.dis,
      cfgWhy: cfg.why,
      cfgOp: cfg.op,
      cfgDisB: !cfg.ok,
      opDis: op.dis,
      opWhy: op.why,
      opOp: op.op,
      openWizard: () => {
        if (cfg.ok) this.setState({ w: { ...blankW(), open: true, platform: 'pve' } });
      },
      refreshAll: () => {
        if (op.ok) this.refresh(base.map(x => x.id));
      },
      showUnreachBar: ctx.ui === 'live' && base.some(x => x.id === 'r2' && x.status === 'unreach'),
      retryR2: () => this.refresh(['r2']),
      openR2: () => this.setState({ drawer: 'r2', tab: 'Overview', closing: false }),
      plats,
      q: s.q,
      onQ: e => this.setState({ q: e.target.value }),
      filtered: s.plat !== 'All' || !!q,
      clearFilters: () => this.setState({ plat: 'All', q: '' }),
      lastRead: 'Last read 21 Oct 2026, 16:04 IST',
      noSel: selIds.length === 0,
      hasSel: selIds.length > 0,
      selLabel: `${selIds.length} selected`,
      bulkRefresh: () => {
        if (op.ok) {
          this.refresh(selIds);
          this.setState({ sel: {} });
        }
      },
      editDis: selIds.length === 1 && cfg.ok ? undefined : 'true',
      editWhy: !cfg.ok ? cfg.why : selIds.length !== 1 ? 'Edit access for one site at a time.' : undefined,
      editOp: selIds.length === 1 && cfg.ok ? 1 : 0.45,
      bulkEdit: () => {
        if (selIds.length === 1 && cfg.ok) this.editAccess(selIds[0]);
      },
      rmDis: selIds.length === 1 && del.ok ? undefined : 'true',
      rmWhy: !del.ok ? del.why : selIds.length !== 1 ? 'Remove one site at a time.' : undefined,
      rmOp: selIds.length === 1 && del.ok ? 1 : 0.45,
      bulkRemove: () => {
        if (selIds.length === 1 && del.ok) this.setState({ rm: { id: selIds[0], typed: '' } });
      },
      clearSel: () => this.setState({ sel: {} }),
      cols,
      rows: tableRows,
      sel: s.sel,
      active: s.drawer || s.flash || '',
      onSel: id => this.setState(st => ({ sel: { ...st.sel, [id]: !st.sel[id] } })),
      onSelAll: (list, on) =>
        this.setState(st => {
          const sel = { ...st.sel };
          list.forEach(id => {
            sel[id] = on;
          });
          return { sel };
        }),
      openSite: id => this.setState({ drawer: id, tab: s.drawer === id ? s.tab : 'Overview', closing: false }),
      hiddenNote: hidden ? `${hidden} VMware sites are not shown: Backup & Recovery does not use VMware.` : '',
      dOpen: !!dsite,
      dAnim: s.closing ? 'ae-drawer-out 150ms var(--ease) forwards' : 'ae-drawer 150ms var(--ease)',
      d,
      dtabs,
      tab: {
        ov: s.tab === 'Overview',
        nodes: s.tab === 'Nodes',
        storage: s.tab === 'Storage',
        networks: s.tab === 'Networks',
        access: s.tab === 'Access',
        activity: s.tab === 'Activity'
      },
      closeDrawer: () => this.closeDrawer(),
      dRefresh: () => {
        if (op.ok && dsite) this.refresh([dsite.id]);
      },
      dEdit: () => {
        if (cfg.ok && dsite) this.editAccess(dsite.id);
      },
      rmDisD: del.dis,
      rmWhyD: del.why,
      rmOpD: del.op,
      dRemove: () => {
        if (del.ok && dsite) this.setState({ rm: { id: dsite.id, typed: '' } });
      },
      wOpen: w.open,
      w: wv,
      wAnim: w.closing ? 'ae-dialog-out 150ms var(--ease) forwards' : 'ae-dialog 150ms var(--ease)',
      wScrimAnim: w.closing ? 'ae-fade-out 150ms var(--ease) forwards' : 'ae-fade 120ms var(--ease)',
      closeWizard: () => this.closeWizard(),
      back: () => this.setState(st => ({ w: { ...st.w, step: Math.max(0, st.w.step - 1) } })),
      next: () => {
        if (!canNext) {
          if (w.step === 1) this.setState(st => ({ w: { ...st.w, tried: true } }));
          if (w.step === 3) this.setState(st => ({ w: { ...st.w, nameTried: true } }));
          return;
        }
        if (w.step < 3) {
          this.setState(st => ({ w: { ...st.w, step: st.w.step + 1 } }));
          return;
        }
        const id = 'n' + Date.now();
        const usedBy = ['Backup', 'DR', 'Migration'].filter(u => w.usedBy[u] && !(w.platform === 'vmw' && u === 'Backup'));
        if (isEdit) {
          this.closeWizard();
          ctx.toast(`Access for ${w.name} updated`, 'ok');
          return;
        }
        const site = {
          id,
          name: nameVal.trim(),
          platform: w.platform === 'pve' ? 'Proxmox VE' : w.platform === 'os' ? 'OpenStack' : 'VMware vCenter',
          fam: w.platform === 'pve' ? 'Proxmox VE' : w.platform === 'os' ? 'OpenStack' : 'VMware',
          version: w.platform === 'pve' ? '9.2.2' : w.platform === 'os' ? '2025.1' : '8.0.3',
          access:
            w.platform === 'pve'
              ? METHODS.find(m => m.id === w.method).label
              : w.platform === 'os'
                ? 'Keystone v3, password'
                : 'vSphere API',
          nodes: 3,
          guests: w.platform === 'os' ? 18 : 41,
          usedBy,
          status: 'ok',
          seen: ctx.now(),
          addr: host,
          added: `${ctx.now()} by priya.raman`,
          vmw: w.platform === 'vmw'
        };
        this.closeWizard();
        this.setState(st => ({ extra: st.extra.concat([site]), refreshing: { ...st.refreshing, [id]: true }, flash: id }));
        ctx.toast(`Site ${site.name} added. Reading its inventory.`, 'ok', {
          label: 'View',
          run: () => this.setState({ drawer: id, tab: 'Overview', closing: false })
        });
        setTimeout(
          () =>
            this.setState(st => {
              const r = { ...st.refreshing };
              delete r[id];
              return { refreshing: r, flash: null };
            }),
          2600
        );
      },
      testConn: () => {
        this.setState(st => ({ w: { ...st.w, testing: true, tested: false } }));
        setTimeout(() => this.setState(st => ({ w: { ...st.w, testing: false, tested: true } })), 1100);
      },
      attachOpenrc: () => this.setState(st => ({ w: { ...st.w, file: true } })),
      removeOpenrc: () => this.setState(st => ({ w: { ...st.w, file: false } })),
      trust: () => this.runCheck(),
      setName: e => this.setState(st => ({ w: { ...st.w, name: e.target.value, nameTried: true } })),
      rmOpen: !!s.rm,
      rm,
      rmType: e => this.setState(st => ({ rm: { ...st.rm, typed: e.target.value } })),
      rmCancel: () => this.setState({ rm: null }),
      rmConfirm: () => {
        const site = all.find(x => x.id === s.rm.id);
        if (!site || s.rm.typed !== site.name) return;
        this.setState(st => ({
          rm: null,
          removed: { ...st.removed, [site.id]: true },
          sel: {},
          drawer: st.drawer === site.id ? null : st.drawer
        }));
        ctx.toast(`Site ${site.name} removed`, 'ok');
      }
    };
  }

  editAccess(id) {
    const site = this.sites().find(x => x.id === id);
    if (!site) return;
    const platform = site.fam === 'Proxmox VE' ? 'pve' : site.fam === 'OpenStack' ? 'os' : 'vmw';
    const method = site.access === 'SSH only' ? 'ssh' : site.access === 'Proxmox API only' ? 'api' : 'apissh';
    const b = blankW();
    this.setState({
      w: {
        ...b,
        open: true,
        step: 1,
        platform,
        method,
        editId: id,
        name: site.name,
        f: { ...b.f, host: site.addr.split(':')[0], addr: site.addr.split(':')[0], display: site.name }
      }
    });
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
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Infrastructure</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Sites</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>
              Platforms Aegis connects to in <span>{v.project}</span>, and what each one is used for.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={v.refreshAll}
              aria-disabled={v.opDis}
              data-tip={v.opWhy}
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
                opacity: v.opOp,
                transition: 'background-color 100ms'
              }}
              className={pc('hover', 'background:var(--hover)')}
            >
              <Icon name="refresh-cw" />
              Refresh all
            </button>
            <button
              onClick={v.openWizard}
              aria-disabled={v.cfgDis}
              data-tip={v.cfgWhy}
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
                opacity: v.cfgOp,
                transition: 'background-color 100ms,transform 80ms'
              }}
              className={[pc('hover', 'background:var(--acc-h)'), pc('active', 'transform:translateY(1px)')].join(' ')}
            >
              <Icon name="plus" />
              Add a platform
            </button>
          </div>
        </div>
        {v.showUnreachBar ? (
          <div
            role="status"
            style={{
              flex: 'none',
              margin: '0 24px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minHeight: '40px',
              padding: '0 8px 0 12px',
              background: 'var(--warn-s)',
              border: '1px solid var(--ln-2)',
              animation: 'ae-fade 150ms var(--ease)'
            }}
          >
            <Icon name="triangle-alert" style={{ color: 'var(--warn)' }} />
            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <strong style={{ fontWeight: 600 }}>region-2-os</strong> · Could not be read: Keystone at 10.40.0.5:5000 did not answer within
              30 s. Last read 21 Oct 2026, 14:52 IST.
            </span>
            <button
              onClick={v.retryR2}
              style={{ height: '28px', padding: '0 10px', fontWeight: 600, transition: 'background-color 100ms' }}
              className={pc('hover', 'background:var(--hover)')}
            >
              Retry
            </button>
            <button
              onClick={v.openR2}
              style={{ height: '28px', padding: '0 10px', fontWeight: 600, transition: 'background-color 100ms' }}
              className={pc('hover', 'background:var(--hover)')}
            >
              View site
            </button>
          </div>
        ) : null}
        <div style={{ flex: 'none', padding: '0 24px 12px', display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px' }}>
          {v.noSel ? (
            <>
              <Ind
                mode="fill"
                role="radiogroup"
                aria-label="Platform"
                style={{ display: 'flex', border: '1px solid var(--ln-2)', background: 'var(--panel)' }}
              >
                {arr(v.plats).map((pl: any, i: number) => (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={pl.on}
                    onClick={pl.onClick}
                    style={{
                      height: '30px',
                      padding: '0 12px',
                      font: '13px var(--f-ui)',
                      whiteSpace: 'nowrap',
                      color: pl.fg,
                      transition: 'color 100ms'
                    }}
                    className={pc('hover', 'color:var(--tx)')}
                  >
                    {pl.label}
                  </button>
                ))}
              </Ind>
              <div style={{ position: 'relative', width: '260px' }}>
                <Icon
                  name="filter"
                  style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--tx-3)', pointerEvents: 'none' }}
                />
                <input
                  value={v.q ?? ''}
                  onChange={v.onQ}
                  placeholder="Filter by name, address or version"
                  aria-label="Filter sites"
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 10px 0 34px',
                    background: 'var(--panel)',
                    border: '1px solid var(--ln-2)',
                    font: '13px var(--f-ui)',
                    transition: 'border-color 100ms'
                  }}
                  className={pc('focus', 'border-color:var(--acc)')}
                />
              </div>
              <span style={{ flex: 1 }} />
              <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.lastRead}</span>
            </>
          ) : null}
          {v.hasSel ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '44px',
                padding: '0 8px 0 14px',
                background: 'var(--acc-soft)',
                border: '1px solid var(--acc)',
                animation: 'ae-fade 120ms var(--ease)'
              }}
            >
              <span style={{ font: '700 13px var(--f-ui)', marginRight: '12px', fontVariantNumeric: 'tabular-nums' }}>{v.selLabel}</span>
              <button
                onClick={v.bulkRefresh}
                aria-disabled={v.opDis}
                data-tip={v.opWhy}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  opacity: v.opOp,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="refresh-cw" />
                Refresh inventory
              </button>
              <button
                onClick={v.bulkEdit}
                aria-disabled={v.editDis}
                data-tip={v.editWhy}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  opacity: v.editOp,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="key" />
                Edit access
              </button>
              <button
                onClick={v.bulkRemove}
                aria-disabled={v.rmDis}
                data-tip={v.rmWhy}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  color: 'var(--err)',
                  opacity: v.rmOp,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--err-s)')}
              >
                <Icon name="trash-2" />
                Remove…
              </button>
              <span style={{ flex: 1 }} />
              <button
                onClick={v.clearSel}
                style={{ height: '32px', padding: '0 10px', fontWeight: 600, transition: 'background-color 100ms' }}
                className={pc('hover', 'background:var(--hover)')}
              >
                Clear selection
              </button>
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <AegisTable
              cols={v.cols}
              rows={v.rows}
              sel={v.sel}
              onSel={v.onSel}
              onSelAll={v.onSelAll}
              onRow={v.openSite}
              active={v.active}
              state={v.ui}
              label="Sites"
              unit={v.unit}
              filtered={v.filtered}
              onClear={v.clearFilters}
              emptyText="No platforms are connected to this project yet."
              emptyAction="Add a platform"
              onEmpty={v.openWizard}
              emptyDisabled={v.cfgDisB}
              emptyWhy={v.cfgWhy}
              unreachText="Could not be read: the orchestrator did not answer within 30 s."
              footR={v.hiddenNote}
              sort="name"
            />
          </div>
        </div>
        {v.dOpen ? (
          <aside
            role="dialog"
            aria-label="Site details"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '600px',
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
                  Site · <span>{v.d?.platform}</span>
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
                  <span>
                    Last seen <span>{v.d?.seen}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={v.closeDrawer}
                aria-label="Close site details"
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
                onClick={v.dRefresh}
                aria-disabled={v.opDis}
                data-tip={v.opWhy}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--ln-2)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: v.opOp,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="refresh-cw" />
                Refresh inventory
              </button>
              <button
                onClick={v.dEdit}
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
                <Icon name="key" />
                Edit access
              </button>
              <span style={{ flex: 1 }} />
              <button
                onClick={v.dRemove}
                aria-disabled={v.rmDisD}
                data-tip={v.rmWhyD}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--err)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  opacity: v.rmOpD,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--err-s)')}
              >
                <Icon name="trash-2" />
                Remove site…
              </button>
            </div>
            <Ind
              mode="underline"
              role="tablist"
              aria-label="Site sections"
              style={{ flex: 'none', display: 'flex', padding: '0 16px', borderBottom: '1px solid var(--ln)' }}
            >
              {arr(v.dtabs).map((t: any, i: number) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={t.on}
                  onClick={t.onClick}
                  data-tip={t.tip}
                  style={{
                    height: '40px',
                    padding: '0 10px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    color: t.fg,
                    transition: 'color 100ms'
                  }}
                  className={pc('hover', 'color:var(--tx)')}
                >
                  {t.label}
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
                    background: 'var(--warn-s)',
                    border: '1px solid var(--ln-2)'
                  }}
                >
                  <Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: '2px' }} />
                  <span>{v.d?.reasonText}</span>
                </div>
              ) : null}
              {v.tab?.ov ? (
                <div style={{ animation: 'ae-fade 150ms var(--ease)' }}>
                  <dl style={{ display: 'grid', gridTemplateColumns: '168px minmax(0,1fr)', font: '13px/18px var(--f-ui)' }}>
                    {arr(v.d?.facts).map((f: any, i: number) => (
                      <Fragment key={i}>
                        <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                        <dd
                          data-tip={f.v}
                          data-tip-overflow=""
                          style={{
                            padding: '9px 0',
                            borderBottom: '1px solid var(--ln)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontStyle: f.fs,
                            color: f.c
                          }}
                        >
                          {f.v}
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                </div>
              ) : null}
              {v.tab?.nodes ? (
                <div
                  role="table"
                  aria-label="Nodes"
                  style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums', animation: 'ae-fade 150ms var(--ease)' }}
                >
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.4fr) 112px 64px 88px 80px',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <div role="columnheader">Node</div>
                    <div role="columnheader">Status</div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Guests
                    </div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      CPU
                    </div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Memory
                    </div>
                  </div>
                  {arr(v.d?.nodes).map((nd: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.4fr) 112px 64px 88px 80px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <div role="cell">{nd.name}</div>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="circle-check" style={{ color: 'var(--ok)' }} />
                        Online
                      </div>
                      <div role="cell" style={{ textAlign: 'right' }}>
                        {nd.guests}
                      </div>
                      <div role="cell" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>
                        {nd.cpu}
                      </div>
                      <div role="cell" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>
                        {nd.mem}
                      </div>
                    </div>
                  ))}
                  {v.d?.noNodes ? (
                    <p style={{ padding: '16px 0', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>
                      Nodes are not shown until the site can be read.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {v.tab?.storage ? (
                <div
                  role="table"
                  aria-label="Storage"
                  style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums', animation: 'ae-fade 150ms var(--ease)' }}
                >
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) 120px minmax(0,1.6fr)',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <div role="columnheader">Storage</div>
                    <div role="columnheader">Type</div>
                    <div role="columnheader">Used and capacity</div>
                  </div>
                  {arr(v.d?.storage).map((st: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) 120px minmax(0,1.6fr)',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <div role="cell">{st.name}</div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {st.type}
                      </div>
                      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '96px', height: '4px', background: 'var(--ln)' }}>
                          <span style={{ display: 'block', height: '4px', width: st.pctW, background: st.bc }} />
                        </span>
                        <span style={{ color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>{st.label}</span>
                      </div>
                    </div>
                  ))}
                  {v.d?.noStorage ? (
                    <p style={{ padding: '16px 0', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>
                      Storage is not shown until the site can be read.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {v.tab?.networks ? (
                <div role="table" aria-label="Networks" style={{ font: '13px/18px var(--f-ui)', animation: 'ae-fade 150ms var(--ease)' }}>
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 100px minmax(0,1fr)',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <div role="columnheader">Network</div>
                    <div role="columnheader">Type</div>
                    <div role="columnheader">Tag</div>
                    <div role="columnheader">Subnet</div>
                  </div>
                  {arr(v.d?.networks).map((nw: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 100px minmax(0,1fr)',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <div role="cell">{nw.name}</div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {nw.type}
                      </div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {nw.tag}
                      </div>
                      <div role="cell" style={{ color: 'var(--tx-2)' }}>
                        {nw.cidr}
                      </div>
                    </div>
                  ))}
                  {v.d?.noNetworks ? (
                    <p style={{ padding: '16px 0', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>
                      Networks are not shown until the site can be read.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {v.tab?.access ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'ae-fade 150ms var(--ease)' }}>
                  <dl style={{ display: 'grid', gridTemplateColumns: '168px minmax(0,1fr)', font: '13px/18px var(--f-ui)' }}>
                    {arr(v.d?.access).map((f: any, i: number) => (
                      <Fragment key={i}>
                        <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                        <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', overflowWrap: 'anywhere' }}>{f.v}</dd>
                      </Fragment>
                    ))}
                  </dl>
                  <div>
                    <h3 style={{ font: '600 15px/22px var(--f-body)', marginBottom: '8px' }}>What the account can do</h3>
                    {arr(v.d?.privs).map((pv: any, i: number) => (
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
                        <Icon name={pv.i} style={{ color: pv.c }} />
                        <span style={{ flex: 1 }}>{pv.label}</span>
                        <span style={{ color: 'var(--tx-3)' }}>{pv.state}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {v.tab?.activity ? (
                <ol
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  {arr(v.d?.activity).map((ev: any, i: number) => (
                    <li
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px minmax(0,1fr)',
                        gap: '10px',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <Icon name={ev.i} style={{ color: ev.c, marginTop: '2px' }} />
                      <span>
                        <span style={{ display: 'block' }}>{ev.text}</span>
                        <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{ev.when}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </aside>
        ) : null}
        {v.wOpen ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              display: 'grid',
              placeItems: 'center',
              padding: '24px',
              background: 'var(--scrim)',
              animation: v.wScrimAnim
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wiz-title"
              style={{
                width: '720px',
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 48px)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--overlay)',
                border: '1px solid var(--ln-2)',
                boxShadow: 'var(--sh-over)',
                animation: v.wAnim
              }}
            >
              <div style={{ flex: 'none', padding: '20px 16px 0 24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 id="wiz-title" style={{ font: '500 20px/28px var(--f-head)' }}>
                    {v.w?.title}
                  </h2>
                  <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>{v.w?.sub}</p>
                </div>
                <button
                  onClick={v.closeWizard}
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
              <ol
                aria-label="Steps"
                style={{
                  flex: 'none',
                  listStyle: 'none',
                  padding: '20px 24px 16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
                  gap: '8px',
                  borderBottom: '1px solid var(--ln)'
                }}
              >
                {arr(v.w?.steps).map((ws: any, i: number) => (
                  <li key={i} aria-current={ws.current} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ height: '2px', background: ws.bar, transition: 'background-color 150ms var(--ease)' }} />
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        font: '12px/16px var(--f-ui)',
                        color: ws.fg,
                        transition: 'color 150ms'
                      }}
                    >
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          flex: 'none',
                          display: 'grid',
                          placeItems: 'center',
                          border: `1px solid ${ws.bd}`,
                          background: ws.bg,
                          color: ws.nfg,
                          font: '700 11px var(--f-ui)',
                          transition: 'background-color 150ms,border-color 150ms'
                        }}
                      >
                        {ws.mark}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ws.label}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div style={{ flex: 1, minHeight: '420px', overflow: 'auto', padding: '20px 24px' }}>
                {v.w?.s1 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'ae-step 150ms var(--ease)' }}>
                    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <legend style={{ padding: 0, marginBottom: '8px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        Platform
                      </legend>
                      <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '8px' }}>
                        {arr(v.w?.platforms).map((pf: any, i: number) => (
                          <button
                            key={i}
                            role="radio"
                            aria-checked={pf.on}
                            aria-disabled={pf.dis}
                            data-tip={pf.why}
                            onClick={pf.onClick}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              minHeight: '120px',
                              padding: '14px',
                              border: `1px solid ${pf.bd}`,
                              background: pf.bg,
                              boxShadow: pf.ring,
                              opacity: pf.op,
                              transition: 'border-color 100ms,background-color 100ms,box-shadow 100ms'
                            }}
                            className={pc('hover', `border-color:${pf.hbd}`)}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Icon name={pf.icon} size="20" style={{ color: pf.ic }} />
                              <span
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  border: `1px solid ${pf.rbd}`,
                                  boxShadow: `inset 0 0 0 4px ${pf.rin}`,
                                  background: pf.rbg,
                                  transition: 'all 100ms'
                                }}
                              />
                            </span>
                            <span style={{ fontWeight: 600 }}>{pf.label}</span>
                            <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)', textWrap: 'pretty' }}>
                              {pf.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {v.w?.isPve ? (
                      <fieldset style={{ border: 0, padding: 0, margin: 0, animation: 'ae-fade 150ms var(--ease)' }}>
                        <legend style={{ padding: 0, marginBottom: '8px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                          Access method
                        </legend>
                        <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {arr(v.w?.methods).map((m: any, i: number) => (
                            <button
                              key={i}
                              role="radio"
                              aria-checked={m.on}
                              onClick={m.onClick}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '16px minmax(0,1fr) auto',
                                alignItems: 'center',
                                gap: '12px',
                                minHeight: '56px',
                                padding: '10px 14px',
                                border: `1px solid ${m.bd}`,
                                background: m.bg,
                                boxShadow: m.ring,
                                transition: 'border-color 100ms,background-color 100ms,box-shadow 100ms'
                              }}
                              className={pc('hover', `border-color:${m.hbd}`)}
                            >
                              <span
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  border: `1px solid ${m.rbd}`,
                                  boxShadow: `inset 0 0 0 4px ${m.rin}`,
                                  background: m.rbg,
                                  transition: 'all 100ms'
                                }}
                              />
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600 }}>{m.label}</span>
                                <span style={{ display: 'block', fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
                                  {m.note}
                                </span>
                              </span>
                              <span
                                style={{
                                  font: '11px/18px var(--f-ui)',
                                  padding: '0 6px',
                                  border: '1px solid var(--ln-2)',
                                  color: 'var(--tx-2)',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {m.tag}
                              </span>
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    ) : null}
                  </div>
                ) : null}
                {v.w?.s2 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'ae-step 150ms var(--ease)' }}>
                    {v.w?.isOs ? (
                      <Ind
                        mode="fill"
                        role="radiogroup"
                        aria-label="How to connect"
                        style={{ display: 'flex', alignSelf: 'flex-start', border: '1px solid var(--ln-2)' }}
                      >
                        {arr(v.w?.osModes).map((om: any, i: number) => (
                          <button
                            key={i}
                            role="radio"
                            aria-checked={om.on}
                            onClick={om.onClick}
                            style={{ height: '30px', padding: '0 14px', font: '13px var(--f-ui)', color: om.fg, transition: 'color 100ms' }}
                          >
                            {om.label}
                          </button>
                        ))}
                      </Ind>
                    ) : null}
                    {v.w?.showFields ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: '16px 16px' }}>
                        {arr(v.w?.fields).map((f: any, i: number) => (
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
                                type={f.type}
                                value={f.value ?? ''}
                                onChange={f.onInput}
                                placeholder={f.ph}
                                aria-invalid={f.invalid}
                                autoComplete="off"
                                style={{
                                  height: '36px',
                                  padding: '0 10px',
                                  background: 'var(--panel-2)',
                                  border: `1px solid ${f.bd}`,
                                  font: '14px var(--f-body)',
                                  transition: 'border-color 100ms'
                                }}
                                className={pc('focus', 'border-color:var(--acc)')}
                              />
                            ) : null}
                            {f.isSelect ? (
                              <select
                                id={f.id}
                                value={f.value ?? ''}
                                onChange={f.onInput}
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
                            {f.err ? (
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  font: '12px/16px var(--f-ui)',
                                  color: 'var(--err)'
                                }}
                              >
                                <Icon name="circle-alert" />
                                {f.err}
                              </span>
                            ) : null}
                            {f.hint ? (
                              <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)', textWrap: 'pretty' }}>
                                {f.hint}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {v.w?.showOpenrc ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'ae-fade 150ms var(--ease)' }}>
                        {v.w?.noFile ? (
                          <button
                            onClick={v.attachOpenrc}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              height: '120px',
                              border: '1px dashed var(--ln-2)',
                              color: 'var(--tx-2)',
                              transition: 'border-color 100ms,background-color 100ms'
                            }}
                            className={pc('hover', 'border-color:var(--acc);background:var(--hover)')}
                          >
                            <Icon name="upload" size="20" />
                            <span>
                              <strong style={{ color: 'var(--tx)', fontWeight: 600 }}>Choose an openrc file</strong> or drop it here
                            </span>
                            <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>
                              The file is read in your browser; the password is asked for separately.
                            </span>
                          </button>
                        ) : null}
                        {v.w?.hasFile ? (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 8px 12px 14px',
                                border: '1px solid var(--ln-2)',
                                background: 'var(--panel-2)',
                                animation: 'ae-fade 150ms var(--ease)'
                              }}
                            >
                              <Icon name="file-text" size="20" style={{ color: 'var(--tx-2)' }} />
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600 }}>production-openrc.sh</span>
                                <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
                                  1.2 KB · 9 variables read · OS_AUTH_URL https://keystone.dr.host360.local:5000/v3
                                </span>
                              </span>
                              <button
                                onClick={v.removeOpenrc}
                                aria-label="Remove file"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  display: 'grid',
                                  placeItems: 'center',
                                  color: 'var(--tx-3)',
                                  transition: 'background-color 100ms'
                                }}
                                className={pc('hover', 'background:var(--hover);color:var(--tx)')}
                              >
                                <Icon name="x" />
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
                              <label htmlFor="os-pw2" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                                Password for aegis-svc
                              </label>
                              <input
                                id="os-pw2"
                                type="password"
                                value={v.w?.f?.pw ?? ''}
                                onChange={v.w?.setPw}
                                style={{
                                  height: '36px',
                                  padding: '0 10px',
                                  background: 'var(--panel-2)',
                                  border: '1px solid var(--ln)',
                                  font: '14px var(--f-body)'
                                }}
                                className={pc('focus', 'border-color:var(--acc)')}
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {v.w?.isVmw ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '10px 12px',
                            background: 'var(--panel-2)',
                            border: '1px solid var(--ln)'
                          }}
                        >
                          <Icon name="info" style={{ color: 'var(--tx-2)', marginTop: '2px' }} />
                          <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
                            The account needs permission to read inventory, create snapshots and power off virtual machines.
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={v.testConn}
                            style={{
                              height: '32px',
                              padding: '0 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              border: '1px solid var(--ln-2)',
                              fontWeight: 600,
                              transition: 'background-color 100ms'
                            }}
                            className={pc('hover', 'background:var(--hover)')}
                          >
                            <Icon name={v.w?.testIcon} spin={v.w?.testSpin} />
                            Test connection
                          </button>
                          {v.w?.testOk ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                font: '13px var(--f-ui)',
                                animation: 'ae-fade 150ms var(--ease)'
                              }}
                            >
                              <Icon name="circle-check" style={{ color: 'var(--ok)' }} />
                              Connected to VMware vCenter Server 8.0.3 · 3 hosts · 3 datastores
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {v.w?.s3 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'ae-step 150ms var(--ease)' }}>
                    {v.w?.refused ? (
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
                          <strong style={{ display: 'block', fontWeight: 600 }}>This node cannot be added</strong>
                          <span>{v.w?.refusal}</span>
                        </span>
                      </div>
                    ) : null}
                    {v.w?.notRefused ? (
                      <>
                        <section style={{ border: '1px solid var(--ln)', background: 'var(--panel-2)' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '12px 14px',
                              borderBottom: '1px solid var(--ln)'
                            }}
                          >
                            <Icon name={v.w?.certIcon} style={{ color: v.w?.certColor }} />
                            <span style={{ flex: 1, fontWeight: 600 }}>{v.w?.certTitle}</span>
                            <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.w?.certState}</span>
                          </div>
                          <dl
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '140px minmax(0,1fr)',
                              padding: '4px 14px 8px',
                              font: '13px/18px var(--f-ui)'
                            }}
                          >
                            {arr(v.w?.cert).map((cf: any, i: number) => (
                              <Fragment key={i}>
                                <dt style={{ padding: '6px 0', color: 'var(--tx-3)' }}>{cf.k}</dt>
                                <dd style={{ padding: '6px 0', letterSpacing: cf.ls, overflowWrap: 'anywhere' }}>{cf.v}</dd>
                              </Fragment>
                            ))}
                          </dl>
                          {v.w?.untrusted ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 14px',
                                borderTop: '1px solid var(--ln)'
                              }}
                            >
                              <span style={{ flex: 1, fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
                                Compare the fingerprint with the one shown on the server before you trust it.
                              </span>
                              <button
                                onClick={v.trust}
                                style={{
                                  height: '32px',
                                  padding: '0 14px',
                                  background: 'var(--acc)',
                                  color: 'var(--acc-ink)',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  transition: 'background-color 100ms'
                                }}
                                className={pc('hover', 'background:var(--acc-h)')}
                              >
                                {v.w?.trustLabel}
                              </button>
                            </div>
                          ) : null}
                        </section>
                        {v.w?.checking ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'ae-fade 150ms var(--ease)' }}>
                            <span
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '13px var(--f-ui)', color: 'var(--tx-2)' }}
                            >
                              <Icon name="loader-circle" spin="true" style={{ color: 'var(--run)' }} />
                              Reading what the account can see…
                            </span>
                            <span style={{ height: '4px', background: 'var(--ln)' }}>
                              <span
                                style={{
                                  display: 'block',
                                  height: '4px',
                                  width: v.w?.checkW,
                                  background: 'var(--run)',
                                  transition: 'width 150ms linear'
                                }}
                              />
                            </span>
                          </div>
                        ) : null}
                        {v.w?.checked ? (
                          <section style={{ animation: 'ae-fade 150ms var(--ease)' }}>
                            <h3 style={{ font: '600 15px/22px var(--f-body)', marginBottom: '8px' }}>{v.w?.capTitle}</h3>
                            <div role="table" style={{ font: '13px/18px var(--f-ui)', fontVariantNumeric: 'tabular-nums' }}>
                              {arr(v.w?.caps).map((cp: any, i: number) => (
                                <div
                                  key={i}
                                  role="row"
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '20px 200px minmax(0,1fr)',
                                    alignItems: 'center',
                                    gap: '10px',
                                    minHeight: '36px',
                                    padding: '6px 0',
                                    borderBottom: '1px solid var(--ln)'
                                  }}
                                >
                                  <Icon name={cp.i} style={{ color: cp.c }} />
                                  <span style={{ color: 'var(--tx-2)' }}>{cp.k}</span>
                                  <span>{cp.v}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
                {v.w?.s4 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'ae-step 150ms var(--ease)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '400px' }}>
                      <label htmlFor="site-name" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        Site name
                      </label>
                      <input
                        id="site-name"
                        value={v.w?.name ?? ''}
                        onChange={v.setName}
                        aria-invalid={v.w?.nameInvalid}
                        style={{
                          height: '36px',
                          padding: '0 10px',
                          background: 'var(--panel-2)',
                          border: `1px solid ${v.w?.nameBd}`,
                          font: '14px var(--f-body)',
                          transition: 'border-color 100ms'
                        }}
                        className={pc('focus', 'border-color:var(--acc)')}
                      />
                      {v.w?.nameErr ? (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            font: '12px/16px var(--f-ui)',
                            color: 'var(--err)',
                            animation: 'ae-fade 120ms var(--ease)'
                          }}
                        >
                          <Icon name="circle-alert" />
                          {v.w?.nameErr}
                        </span>
                      ) : null}
                    </div>
                    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend style={{ padding: 0, marginBottom: '8px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        Used by
                      </legend>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {arr(v.w?.uses).map((u: any, i: number) => (
                          <button
                            key={i}
                            role="checkbox"
                            aria-checked={u.on}
                            aria-disabled={u.dis}
                            data-tip={u.why}
                            onClick={u.onClick}
                            style={{
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '0 12px',
                              border: `1px solid ${u.bd}`,
                              background: u.bg,
                              opacity: u.op,
                              transition: 'border-color 100ms,background-color 100ms'
                            }}
                          >
                            <span
                              style={{
                                width: '16px',
                                height: '16px',
                                display: 'grid',
                                placeItems: 'center',
                                border: `1px solid ${u.cbd}`,
                                background: u.cbg,
                                color: 'var(--acc-ink)',
                                transition: 'background-color 100ms'
                              }}
                            >
                              <Icon name={u.icon} size="12" />
                            </span>
                            {u.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <dl style={{ display: 'grid', gridTemplateColumns: '168px minmax(0,1fr)', font: '13px/18px var(--f-ui)' }}>
                      {arr(v.w?.review).map((rv: any, i: number) => (
                        <Fragment key={i}>
                          <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{rv.k}</dt>
                          <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)' }}>{rv.v}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </div>
                ) : null}
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
                <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.w?.stepLabel}</span>
                <span style={{ flex: 1 }} />
                <button
                  onClick={v.closeWizard}
                  style={{ height: '32px', padding: '0 12px', fontWeight: 600, transition: 'background-color 100ms' }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  Cancel
                </button>
                {v.w?.canBack ? (
                  <button
                    onClick={v.back}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1px solid var(--ln-2)',
                      fontWeight: 600,
                      transition: 'background-color 100ms'
                    }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    <Icon name="chevron-left" />
                    Back
                  </button>
                ) : null}
                <button
                  onClick={v.next}
                  aria-disabled={v.w?.nextDis}
                  data-tip={v.w?.nextWhy}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--acc)',
                    color: 'var(--acc-ink)',
                    fontWeight: 600,
                    opacity: v.w?.nextOp,
                    transition: 'background-color 100ms,opacity 100ms'
                  }}
                  className={pc('hover', 'background:var(--acc-h)')}
                >
                  {v.w?.nextLabel}
                  <Icon name={v.w?.nextIcon} />
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {v.rmOpen ? (
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
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="rm-title"
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
              <div style={{ padding: '20px 24px 0' }}>
                <h2 id="rm-title" style={{ font: '500 20px/28px var(--f-head)' }}>
                  Remove site <span>{v.rm?.name}</span>
                </h2>
                <p style={{ marginTop: '4px', color: 'var(--tx-2)' }}>Aegis stops reading this site. Exactly this is removed:</p>
              </div>
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--ln)' }}>
                  {arr(v.rm?.removed).map((x: any, i: number) => (
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
                      <Icon name="minus" style={{ color: 'var(--err)', marginTop: '2px' }} />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{v.rm?.kept}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="rm-confirm" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                    Type <strong style={{ color: 'var(--tx)' }}>{v.rm?.name}</strong> to confirm
                  </label>
                  <input
                    id="rm-confirm"
                    value={v.rm?.typed ?? ''}
                    onChange={v.rmType}
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
                  onClick={v.rmCancel}
                  style={{ height: '32px', padding: '0 12px', fontWeight: 600, transition: 'background-color 100ms' }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  Cancel
                </button>
                <button
                  onClick={v.rmConfirm}
                  aria-disabled={v.rm?.dis}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--err)',
                    color: 'var(--acc-ink)',
                    fontWeight: 600,
                    opacity: v.rm?.op,
                    transition: 'opacity 100ms'
                  }}
                >
                  <Icon name="trash-2" />
                  Remove site
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
