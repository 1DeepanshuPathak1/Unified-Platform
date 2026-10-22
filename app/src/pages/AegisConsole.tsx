/* Ported from project/Aegis Console.dc.html */
import React, { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';
import AegisSites from '../screens/AegisSites';
import AegisGuests from '../screens/AegisGuests';
import AegisDrServers from '../screens/AegisDrServers';
import AegisMigServers from '../screens/AegisMigServers';
import AegisList from '../screens/AegisList';
import AegisOverview from '../screens/AegisOverview';
import AegisMappings from '../screens/AegisMappings';
import AegisReports from '../screens/AegisReports';
import AegisRestore from '../screens/AegisRestore';
import { Nav } from '../shell/Nav';
import { TenantMenu } from '../shell/TenantMenu';
import { AccountDialog, ActingBanner, LoginAsDialog, UserMenu, ownerOf, type AccountTab } from '../shell/Account';
import { COMMON_PAGES, PRODUCT_LABEL, REDIRECTS, sectionOf } from '../shell/routes';
import Workloads from '../platform/Workloads';
import Applications from '../platform/Applications';
import Inbox, { inboxItems } from '../platform/Inbox';
import Customers from '../platform/Customers';
import SearchPage, { searchAll } from '../platform/Search';
import SettingsSection from '../platform/Settings';
import BillingSection from '../platform/Billing';
import Policies from '../platform/Policies';
import { ActivitySection, AutomationSection } from '../platform/sections';
import { audit } from '../platform/store';
import { CUSTOMERS } from '../data/platform';
import ResilienceOverview from '../products/resilience/Overview';
import RecoveryPlans from '../products/resilience/RecoveryPlans';
import MobilityOverview from '../products/mobility/Overview';
import Sources from '../products/mobility/Sources';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
const BASE = new Date(2026, 9, 21, 16, 5, 0).getTime();
const T0 = Date.now();
const nowD = () => new Date(BASE + (Date.now() - T0));
const fmtD = d => `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} IST`;
const hms = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const ROLE_CAN = {
  configure: ['Owner', 'Admin'],
  operate: ['Owner', 'Admin', 'Operator'],
  restore: ['Owner', 'Admin', 'Operator', 'Restore'],
  destroy: ['Owner', 'Admin'],
  admin: ['Owner', 'Admin']
};
const SEV = {
  critical: ['circle-x', 'Critical', 'var(--err)'],
  warning: ['triangle-alert', 'Warning', 'var(--warn)'],
  info: ['info', 'Info', 'var(--tx-2)']
};
const SICON = { Site: 'map-pin', Guest: 'monitor', Server: 'server', Job: 'activity', Repository: 'database', Plan: 'list-ordered', Workload: 'layers', Application: 'workflow', Customer: 'users', Person: 'user', Alert: 'bell', Policy: 'clipboard-list' };
const LIST_PAGES = ['nodes', 'repos', 'backup/copies', 'dr/history', 'mig/plans'];
const customerName = id => CUSTOMERS.find(c => c.id === id).name;
const PROD_LABEL = PRODUCT_LABEL;
/** Screens built on the platform layer, by route key. */
const PLATFORM = {
  inbox: 1,
  workloads: 1,
  applications: 1,
  customers: 1,
  search: 1,
  activity: 1,
  automation: 1,
  settings: 1,
  billing: 1,
  'backup/policies': 1,
  'dr/overview': 1,
  'dr/recovery': 1,
  'dr/plans': 1,
  'mig/overview': 1,
  'mig/sources': 1
};

export default class AegisConsole extends DC {
  state: any = {
    ready: !!AEGIS,
    theme: 'dark',
    route: 'backup/overview',
    collapsed: false,
    menu: null,
    q: '',
    si: 0,
    project: 'All projects',
    tab: '',
    actingAs: null,
    actingUntil: '',
    account: null,
    accountClosing: false,
    loginAs: null,
    loginAsClosing: false,
    toasts: [],
    jobs: [],
    acked: {},
    tick: 0,
    openId: null,
    nonce: 0,
    reading: false,
    signedOut: false
  };
  seq = 0;
  searchRef = React.createRef<any>();

  componentDidMount() {
    try {
      const t = localStorage.getItem('aegis.theme');
      if (t) this.setState({ theme: t });
    } catch (e) {}
    this.readHash();
    this.onHash = () => this.readHash();
    window.addEventListener('hashchange', this.onHash);
    this.onKey = e => {
      if (
        (e.key === 'k' && (e.ctrlKey || e.metaKey)) ||
        (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName))
      ) {
        e.preventDefault();
        this.searchRef.current && this.searchRef.current.focus();
      }
      if (e.key === 'Escape' && this.state.menu) this.setState({ menu: null });
    };
    window.addEventListener('keydown', this.onKey);
    this.waitData = setInterval(() => {
      if (AEGIS) {
        clearInterval(this.waitData);
        this.initJobs();
        this.setState({ ready: true });
      }
    }, 50);
    this.timer = setInterval(() => this.tickJobs(), 1000);
    this.onResize = () => {
      const narrow = window.innerWidth < 1200;
      if (narrow !== this.narrow) {
        this.narrow = narrow;
        this.setState({ collapsed: narrow });
      }
    };
    this.onResize();
    window.addEventListener('resize', this.onResize);
  }
  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHash);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    clearInterval(this.timer);
    clearInterval(this.waitData);
  }

  initJobs() {
    if (this.state.jobs.length) return;
    const d = nowD();
    const jobs = AEGIS.runningJobs.map(j => ({
      ...j,
      status: 'run',
      speed: 1.2,
      live: true,
      log: [
        { t: '15:58:02', text: `${j.name} started for ${j.object}`, lv: 'info' },
        { t: '15:58:09', text: `${j.phases[1]}…`, lv: 'info' },
        { t: hms(d), text: `${j.phases[j.phase]}…`, lv: 'info' }
      ]
    }));
    this.setState({ jobs });
  }

  readHash() {
    try {
      const t = localStorage.getItem('aegis.theme');
      if (t && t !== this.state.theme) this.setState({ theme: t });
    } catch (e) {}
    const h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return;
    const [path, q] = h.split('?');
    const parts = path.split('/');
    if (!['backup', 'dr', 'mig'].includes(parts[0])) return;
    if (REDIRECTS[parts[1]]) {
      location.replace(`#/${parts[0]}/${REDIRECTS[parts[1]]}${q ? `?${q}` : ''}`);
      return;
    }
    const route = parts.slice(0, 2).join('/');
    const tab = parts.slice(2).join('/');
    const openId = q && q.startsWith('open=') ? decodeURIComponent(q.slice(5)) : null;
    if (route !== this.state.route) {
      this.setState(s => ({ route, tab, menu: null, reading: true, openId: openId || null, nonce: s.nonce + 1 }));
      clearTimeout(this.readT);
      this.readT = setTimeout(() => this.setState({ reading: false }), 380);
    } else if (tab !== this.state.tab) this.setState(s => ({ tab, openId: openId || null, nonce: s.nonce + 1, menu: null }));
    else if (openId) this.setState(s => ({ openId, nonce: s.nonce + 1 }));
  }

  go(target, openId) {
    const prod = this.state.route.split('/')[0];
    let route = target.includes('/') ? target : `${prod}/${target}`;
    if (target.includes('/') && !['backup', 'dr', 'mig'].includes(target.split('/')[0])) route = `${prod}/${target}`;
    location.hash = `/${route}${openId ? `?open=${encodeURIComponent(openId)}` : ''}`;
    this.setState({ menu: null, q: '' });
  }

  toast(text, kind, action?) {
    const id = 't' + ++this.seq;
    const k = kind || 'ok';
    const icon = { ok: 'circle-check', warn: 'triangle-alert', err: 'circle-x', info: 'info' }[k];
    this.setState(s => ({ toasts: s.toasts.concat([{ id, text, k, icon, action, leaving: false }]).slice(-4) }));
    setTimeout(() => this.dismiss(id), 5200);
  }
  dismiss(id) {
    this.setState(s => ({ toasts: s.toasts.map(t => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(() => this.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 150);
  }

  startJob(spec) {
    const id = 'lj' + ++this.seq;
    const d = nowD();
    const job = {
      id,
      name: spec.name,
      object: spec.object,
      product: spec.product,
      type: spec.type || spec.name,
      phases: spec.phases || ['Queued', 'Running', 'Done'],
      phase: 0,
      pct: 0,
      speed: spec.speed || 6,
      rate: spec.rate || '',
      status: 'run',
      live: true,
      started: fmtD(d),
      doneToast: spec.doneToast,
      doneLog: spec.doneLog,
      lines: spec.lines || {},
      external: !!spec.external,
      log: [{ t: hms(d), text: spec.firstLine || `${spec.name} started for ${spec.object}`, lv: 'info' }]
    };
    this.setState(s => ({ jobs: [job].concat(s.jobs) }));
    return id;
  }

  patchJob(id, p) {
    const j = this.state.jobs.find(x => x.id === id);
    if (!j) return;
    const d = nowD();
    const { line, ...rest } = p;
    const finishing = p.status === 'ok' && j.status !== 'ok';
    this.setState(s => ({
      jobs: s.jobs.map(x => (x.id !== id ? x : { ...x, ...rest, log: line ? x.log.concat([{ t: hms(d), text: line.text, lv: line.lv }]).slice(-60) : x.log }))
    }));
    if (finishing && j.doneToast) this.toast(j.doneToast, 'ok');
  }

  tickJobs() {
    if (!this.state.ready) return;
    const d = nowD();
    const finished = [];
    const jobs = this.state.jobs.map(j => {
      if (j.status !== 'run' || j.external) return j;
      const n = j.phases.length - 1;
      const np = Math.min(100, j.pct + j.speed * (0.6 + Math.random() * 0.8));
      const oi = Math.min(n - 1, Math.floor((j.pct / 100) * n));
      const ni = np >= 100 ? n : Math.min(n - 1, Math.floor((np / 100) * n));
      let log = j.log;
      if (ni !== oi) {
        const custom = (j.lines || {})[j.phases[ni]];
        log = log.concat([
          {
            t: hms(d),
            text: ni === n ? j.doneLog || `${j.name} finished for ${j.object}` : custom || `${j.phases[ni]}…`,
            lv: ni === n ? 'ok' : 'info'
          }
        ]);
      } else if (Math.random() < 0.3 && j.rate) {
        log = log.concat([{ t: hms(d), text: `${j.phases[ni]}: ${Math.round(np)} % at ${j.rate}`, lv: 'info' }]);
      }
      const nj = { ...j, pct: np, phase: ni, log: log.slice(-60), status: np >= 100 ? 'ok' : 'run' };
      if (nj.status === 'ok') finished.push(nj);
      return nj;
    });
    this.setState(s => ({ jobs, tick: s.tick + 1 }));
    finished.forEach(j => this.toast(j.doneToast || `${j.name} finished for ${j.object}`, 'ok'));
  }

  jobCtl(id, a) {
    const d = nowD();
    this.setState(s => ({
      jobs: s.jobs.map(j =>
        j.id !== id
          ? j
          : {
              ...j,
              status: a === 'pause' ? 'paused' : a === 'resume' ? 'run' : 'cancelled',
              log: j.log.concat([{ t: hms(d), text: a === 'pause' ? 'Paused by priya.raman' : a === 'resume' ? 'Resumed by priya.raman' : 'Cancelled by priya.raman', lv: a === 'cancel' ? 'warn' : 'info' }])
            }
      )
    }));
  }

  startActing(customerId, reason) {
    const o = ownerOf(customerId);
    const until = new Date(nowD().getTime() + 60 * 60000);
    this.setState({ actingAs: o, actingUntil: `${pad(until.getHours())}:${pad(until.getMinutes())} IST`, loginAs: null, project: 'All projects', menu: null });
    audit({ who: 'priya.raman', as: o.ownerEmail, customer: customerId, what: 'Opened the customer console as owner', object: o.owner, when: fmtD(nowD()), r: 'ok', note: `Reason: ${reason}` });
    location.hash = `/${this.state.route.split('/')[0]}/workloads`;
    this.toast(`Acting as ${o.owner}. Every action is recorded under priya.raman.`, 'warn');
  }
  stopActing() {
    const o = this.state.actingAs;
    if (o) audit({ who: 'priya.raman', as: o.ownerEmail, customer: o.customer, what: 'Returned to the Host360 console', object: o.owner, when: fmtD(nowD()), r: 'ok' });
    this.setState({ actingAs: null, project: 'All projects' });
    location.hash = `/${this.state.route.split('/')[0]}/customers`;
    this.toast('Back in the Host360 console', 'info');
  }
  closeDlg(key) {
    this.setState({ [key + 'Closing']: true });
    setTimeout(() => this.setState({ [key]: null, [key + 'Closing']: false }), 150);
  }

  can(action, verb) {
    const role = this.props.role || 'Owner';
    const ok = (ROLE_CAN[action] || []).includes(role);
    const need = (ROLE_CAN[action] || []).join(' or ').replace(/, (?=[^,]*$)/, ' or ');
    return ok
      ? { ok: true, dis: undefined, why: undefined, op: 1 }
      : {
          ok: false,
          dis: 'true',
          why: `Your role in ${this.state.project} is ${role}. ${verb || 'This action'} needs ${ROLE_CAN[action].slice(0, -1).join(', ')}${ROLE_CAN[action].length > 1 ? ' or ' : ''}${ROLE_CAN[action].slice(-1)}.`,
          op: 0.45
        };
  }

  renderVals() {
    const A = AEGIS;
    const s = this.state;
    if (!A || !s.ready) return { theme: s.theme, is: {}, ctx: null, products: [], productNav: [], groups: [], toasts: [], navW: '240px' };
    const up = p => this.setState(p);
    const menu = m => () => this.setState(st => ({ menu: st.menu === m ? null : m }));
    const [prod, page] = s.route.split('/');
    const isCommon = COMMON_PAGES.includes(page);
    const key = isCommon ? page : s.route;
    const meta = A.pages[key] || ['', ''];
    const collapsed = s.collapsed;
    const switchTo = id => {
      if (id === prod) {
        this.setState({ menu: null });
        return;
      }
      const keep = isCommon ? page : A.nav[id].some(n => n[0] === page) ? page : 'overview';
      this.setState({ menu: null });
      location.hash = `/${id}/${keep}`;
      this.toast(`Switched to ${PROD_LABEL[id]}`, 'info');
    };
    const products = A.products.map(p => ({
      ...p,
      on: p.id === prod,
      check: p.id === prod ? 'check' : '',
      ic: p.id === prod ? 'var(--acc)' : 'var(--tx-2)',
      onClick: () => switchTo(p.id)
    }));
    const cur = A.products.find(p => p.id === prod);

    const running = s.jobs.filter(j => j.status === 'run');
    const runN = running.length;
    const roleNow = this.props.role || 'Owner';
    const acks = this.can('operate', 'Acknowledging alerts');
    const activeAlerts = A.alerts
      .filter(a => !s.acked[a.id])
      .map(a => {
        const [icon, sevLabel, color] = SEV[a.sev];
        return {
          ...a,
          icon,
          sevLabel,
          color,
          ackDis: acks.dis,
          ackWhy: acks.why,
          ackOp: acks.op,
          onAck: () => {
            if (!acks.ok) return;
            this.setState(st => ({ acked: { ...st.acked, [a.id]: true } }));
            this.toast(`Alert for ${a.object} acknowledged`, 'ok');
          }
        };
      });
    const crit = activeAlerts.some(a => a.sev === 'critical');

    const q = s.q.trim().toLowerCase();
    const res = q ? searchAll(q).slice(0, 7).concat([{ type: 'All', label: `See every result for “${s.q.trim()}”`, sub: 'Workloads, recovery points, plans, alerts, people and customers together', route: `search/${encodeURIComponent(s.q.trim())}`, id: undefined }]) : [];
    const si = Math.min(s.si, Math.max(0, res.length - 1));
    const openResult = x => {
      this.setState({ q: '', menu: null });
      this.searchRef.current && this.searchRef.current.blur();
      this.go(x.route, x.id);
      this.setState({ q: '' });
    };
    const results = res.map((x, i) => ({
      ...x,
      icon: SICON[x.type] || (x.type === 'All' ? 'search' : 'circle-dot'),
      on: i === si,
      bg: i === si ? 'var(--hover)' : 'transparent',
      onClick: () => openResult(x),
      onHover: () => this.setState({ si: i })
    }));

    const ui = s.reading ? 'loading' : { 'Reading…': 'loading', Unreachable: 'unreach', Empty: 'empty' }[this.props.uiState] || 'live';
    const project = s.project;
    const ctx: any = {
      route: s.route,
      product: prod,
      page,
      key,
      title: meta[0],
      sub: meta[1].replace('{p}', project),
      section: isCommon ? sectionOf(page) : cur.label,
      tab: s.tab,
      audience: s.actingAs ? 'customer' : 'provider',
      actingAs: s.actingAs,
      loginAsOwner: id => this.setState({ loginAs: id, loginAsClosing: false }),
      project,
      role: roleNow,
      ui,
      theme: s.theme,
      openId: s.openId,
      nonce: s.nonce,
      jobs: s.jobs,
      tick: s.tick,
      go: (r, id) => this.go(r, id),
      toast: (t, k, a) => this.toast(t, k, a),
      startJob: spec => this.startJob(spec),
      patchJob: (id, p) => this.patchJob(id, p),
      can: (a, v) => this.can(a, v),
      now: () => fmtD(nowD()),
      hms: () => hms(nowD())
    };
    const is: any = {
      sites: key === 'sites',
      guests: key === 'backup/guests',
      drServers: key === 'dr/servers',
      migServers: key === 'mig/servers',
      overview: page === 'overview' && !PLATFORM[key],
      list: LIST_PAGES.includes(key),
      mappings: key === 'mappings',
      platform: !!PLATFORM[key],
      reports: key === 'reports',
      restore: key === 'backup/restore'
    };
    const BUILT = [
      'sites',
      'guests',
      'drServers',
      'migServers',
      'list',
      'overview',
      'mappings',
      'platform',
      'reports',
      'restore'
    ];
    Object.keys(is).forEach(k => {
      if (!BUILT.includes(k)) is[k] = false;
    });
    is.pending = !BUILT.some(k => is[k]);

    return {
      theme: s.theme,
      themeIcon: s.theme === 'dark' ? 'sun' : 'moon',
      themeLabel: s.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      toggleTheme: () => {
        const t = s.theme === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem('aegis.theme', t);
        } catch (e) {}
        this.setState({ theme: t, menu: null });
      },
      anyMenu: !!s.menu && s.menu !== 'search',
      closeMenu: () => up({ menu: null }),
      productOpen: s.menu === 'product',
      trayOpen: s.menu === 'tray',
      alertsOpen: s.menu === 'alerts',
      projectOpen: s.menu === 'project',
      userOpen: s.menu === 'user',
      openProduct: menu('product'),
      openTray: menu('tray'),
      openAlerts: menu('alerts'),
      openProject: menu('project'),
      openUser: menu('user'),
      productBtnBg: s.menu === 'product' ? 'var(--hover)' : 'transparent',
      trayBtnBg: s.menu === 'tray' ? 'var(--hover)' : 'transparent',
      alertsBtnBg: s.menu === 'alerts' ? 'var(--hover)' : 'transparent',
      projectBtnBg: s.menu === 'project' ? 'var(--hover)' : 'transparent',
      userBtnBg: s.menu === 'user' ? 'var(--hover)' : 'transparent',
      productChev: s.menu === 'product' ? 'rotate(180deg)' : 'none',
      products,
      productLabel: cur.label,
      productIcon: cur.icon,
      q: s.q,
      searchRef: this.searchRef,
      onQ: e => this.setState({ q: e.target.value, si: 0, menu: 'search' }),
      onSearchFocus: () => this.setState({ menu: 'search' }),
      onSearchKey: e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.setState({ si: Math.min(si + 1, res.length - 1) });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.setState({ si: Math.max(si - 1, 0) });
        } else if (e.key === 'Enter' && res[si]) openResult(res[si]);
        else if (e.key === 'Escape') {
          this.setState({ menu: null, q: '' });
          e.target.blur();
        }
      },
      searchOpen: s.menu === 'search',
      results,
      hasResults: results.length > 0,
      noResults: !!q && results.length === 0,
      searchHint: !q,
      running: running.map(j => ({
        title: `${j.object} · ${j.name}`,
        sub: `${PROD_LABEL[{ Backup: 'backup', DR: 'dr', Migration: 'mig' }[j.product]] || j.product} · ${j.phases[j.phase]}`,
        rate: j.rate,
        pctL: `${Math.floor(j.pct)} %`,
        pctW: `${j.pct}%`,
        onClick: () => this.go('jobs', j.id)
      })),
      hasRunning: runN > 0,
      noRunning: runN === 0,
      runIcon: runN ? 'loader-circle' : 'circle-check',
      runSpin: runN ? 'true' : 'false',
      runColor: runN ? 'var(--run)' : 'var(--tx-3)',
      runLabel: runN ? `${runN} running` : 'No jobs running',
      jobsHref: `#/${prod}/jobs`,
      alertsHref: `#/${prod}/alerts`,
      activeAlerts,
      noAlerts: activeAlerts.length === 0,
      alertCount: String(activeAlerts.length),
      alertCountLabel: `${activeAlerts.length} active`,
      alertsAria: activeAlerts.length ? `${activeAlerts.length} active alerts` : 'No active alerts',
      bellColor: crit ? 'var(--err)' : activeAlerts.length ? 'var(--warn)' : 'var(--tx-3)',
      project,
      roleLine: s.actingAs ? `Acting as ${s.actingAs.owner}, Owner` : project === 'All projects' ? `${roleNow} of every customer` : `${roleNow} in ${project}`,
      sideLine: s.actingAs ? 'Recorded under priya.raman' : 'Host360 Managed Services · provider',
      pickProject: p => {
        this.setState({ project: p, menu: null });
        if (p !== project) this.toast(p === 'All projects' ? 'Working in all projects' : `Working in ${p}`, 'info');
      },
      projectLabel: s.actingAs && project === 'All projects' ? customerName(s.actingAs.customer) : project,
      navProps: {
        product: prod,
        page,
        productItems: A.nav[prod],
        collapsed,
        provider: !s.actingAs,
        counts: { inbox: inboxItems(ctx).length }
      },
      actingAs: s.actingAs,
      actingUntil: s.actingUntil,
      stopActing: () => this.stopActing(),
      account: s.account,
      accountClosing: s.accountClosing,
      openAccount: t => this.setState({ account: t, accountClosing: false, menu: null }),
      closeAccount: () => this.closeDlg('account'),
      loginAs: s.loginAs,
      loginAsClosing: s.loginAsClosing,
      closeLoginAs: () => this.closeDlg('loginAs'),
      startActing: (id, reason) => this.startActing(id, reason),
      jobCtl: (id, a) => this.jobCtl(id, a),
      key,
      clock: fmtD(nowD()),
      navW: collapsed ? '56px' : '240px',
      labelOp: collapsed ? 0 : 1,
      collapseLabel: collapsed ? 'Expand navigation' : 'Collapse navigation',
      toggleNav: () => this.setState(st => ({ collapsed: !st.collapsed })),
      is,
      ctx,
      toasts: s.toasts.map(t => ({
        ...t,
        color: { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', info: 'var(--tx-2)' }[t.k],
        anim: t.leaving ? 'ae-fade-out 150ms var(--ease) forwards' : 'ae-toast 150ms var(--ease)',
        action: t.action ? t.action.label : '',
        onAction: t.action
          ? () => {
              t.action.run();
              this.dismiss(t.id);
            }
          : undefined,
        onClose: () => this.dismiss(t.id)
      })),
      dsHref: this.props.hub ? '#/design-system' : 'Aegis Design System.dc.html',
      handoffHref: this.props.hub ? '#/handoff' : 'Aegis Handoff.dc.html',
      signedOut: s.signedOut,
      signOut: () => this.setState({ signedOut: true, menu: null }),
      signIn: () => this.setState({ signedOut: false })
    };
  }

  render() {
    const v = this.vals();
    return (
      <div
        data-ae=""
        data-theme={v.theme}
        style={{
          height: '100vh',
          minWidth: '1024px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--app)',
          color: 'var(--tx)',
          font: '14px/20px var(--f-body)',
          overflow: 'hidden',
          position: 'relative',
          transition: 'background-color 150ms'
        }}
      >
        {v.anyMenu ? <div onClick={v.closeMenu} style={{ position: 'absolute', inset: 0, zIndex: 40 }} /> : null}
        {v.actingAs ? <ActingBanner customer={customerName(v.actingAs.customer)} owner={v.actingAs.owner} until={v.actingUntil} onReturn={v.stopActing} /> : null}
        <header
          style={{
            height: '52px',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '0 12px 0 16px',
            background: 'var(--hdr)',
            borderBottom: '1px solid var(--ln)',
            position: 'relative',
            zIndex: 45,
            transition: 'background-color 150ms,border-color 150ms'
          }}
        >
          <a
            href="#/backup/overview"
            aria-label="Host360 Aegis home"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none', height: '36px', paddingRight: '4px' }}
          >
            <Icon name="mark" size="24" />
            <span style={{ font: '500 17px/24px var(--f-head)', whiteSpace: 'nowrap', letterSpacing: '0.005em' }}>Host360 Aegis</span>
          </a>
          <span style={{ width: '1px', height: '24px', background: 'var(--ln-2)', flex: 'none' }} />
          <div style={{ position: 'relative', flex: 'none' }}>
            <button
              onClick={v.openProduct}
              aria-haspopup="menu"
              aria-expanded={v.productOpen}
              data-tip="Switch product"
              style={{
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 10px',
                whiteSpace: 'nowrap',
                background: v.productBtnBg,
                transition: 'background-color 100ms'
              }}
              className={pc('hover', 'background:var(--hover)')}
            >
              <Icon name={v.productIcon} size="20" style={{ color: 'var(--tx-2)' }} />
              <span style={{ font: '500 16px/24px var(--f-head)' }}>{v.productLabel}</span>
              <Icon
                name="chevron-down"
                style={{ color: 'var(--tx-3)', transform: v.productChev, transition: 'transform 150ms var(--ease)' }}
              />
            </button>
            {v.productOpen ? (
              <div
                role="menu"
                aria-label="Products"
                style={{
                  position: 'absolute',
                  top: '44px',
                  left: 0,
                  width: '360px',
                  padding: '4px 0',
                  background: 'var(--overlay)',
                  border: '1px solid var(--ln-2)',
                  boxShadow: 'var(--sh-menu)',
                  animation: 'ae-pop 140ms var(--ease)'
                }}
              >
                {arr(v.products).map((p: any, i: number) => (
                  <button
                    key={i}
                    role="menuitemradio"
                    aria-checked={p.on}
                    onClick={p.onClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      padding: '10px 12px',
                      transition: 'background-color 100ms'
                    }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    <Icon name={p.icon} size="20" style={{ color: p.ic }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{p.label}</span>
                      <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{p.desc}</span>
                    </span>
                    <span style={{ width: '16px', display: 'flex', color: 'var(--acc)' }}>
                      <Icon name={p.check} />
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: '160px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
              <Icon
                name="search"
                style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--tx-3)', pointerEvents: 'none' }}
              />
              <input
                ref={v.searchRef}
                value={v.q ?? ''}
                onChange={v.onQ}
                onFocus={v.onSearchFocus}
                onKeyDown={v.onSearchKey}
                role="combobox"
                aria-expanded={v.searchOpen}
                aria-controls="ae-search-results"
                aria-label="Search workloads, customers, people, plans, jobs and alerts"
                placeholder="Search workloads, customers, people, plans, alerts"
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 64px 0 36px',
                  background: 'var(--panel-2)',
                  border: '1px solid var(--ln)',
                  color: 'var(--tx)',
                  font: '14px var(--f-body)',
                  transition: 'border-color 100ms,background-color 150ms'
                }}
                className={[pc('hover', 'border-color:var(--ln-2)'), pc('focus', 'border-color:var(--acc)')].join(' ')}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '9px',
                  height: '18px',
                  padding: '0 6px',
                  border: '1px solid var(--ln-2)',
                  font: '11px/16px var(--f-ui)',
                  color: 'var(--tx-3)',
                  whiteSpace: 'nowrap'
                }}
              >
                Ctrl K
              </span>
              {v.searchOpen ? (
                <div
                  id="ae-search-results"
                  role="listbox"
                  style={{
                    position: 'absolute',
                    top: '42px',
                    left: 0,
                    right: 0,
                    maxHeight: '420px',
                    overflow: 'auto',
                    background: 'var(--overlay)',
                    border: '1px solid var(--ln-2)',
                    boxShadow: 'var(--sh-menu)',
                    animation: 'ae-pop 140ms var(--ease)',
                    zIndex: 2
                  }}
                >
                  {v.hasResults ? (
                    <>
                      {arr(v.results).map((sr: any, i: number) => (
                        <button
                          key={i}
                          role="option"
                          aria-selected={sr.on}
                          onClick={sr.onClick}
                          onMouseEnter={sr.onHover}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '20px minmax(0,1fr) auto',
                            alignItems: 'center',
                            gap: '10px',
                            width: '100%',
                            height: '44px',
                            padding: '0 12px',
                            background: sr.bg,
                            transition: 'background-color 80ms'
                          }}
                        >
                          <Icon name={sr.icon} style={{ color: 'var(--tx-3)' }} />
                          <span style={{ minWidth: 0 }}>
                            <span
                              style={{
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontWeight: 600
                              }}
                            >
                              {sr.label}
                            </span>
                            <span
                              style={{
                                display: 'block',
                                font: '12px/16px var(--f-ui)',
                                color: 'var(--tx-3)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {sr.sub}
                            </span>
                          </span>
                          <span
                            style={{ font: '11px/16px var(--f-ui)', color: 'var(--tx-3)', padding: '0 6px', border: '1px solid var(--ln)' }}
                          >
                            {sr.type}
                          </span>
                        </button>
                      ))}
                    </>
                  ) : null}
                  {v.noResults ? (
                    <div style={{ padding: '16px 12px', color: 'var(--tx-2)' }}>
                      Nothing matches “<span>{v.q}</span>”. Try a site, guest, server, job, repository or plan name.
                    </div>
                  ) : null}
                  {v.searchHint ? (
                    <div style={{ padding: '12px', font: '12px/18px var(--f-ui)', color: 'var(--tx-3)' }}>
                      Type to search every product. Use ↑ ↓ to move and Enter to open.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 'none' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={v.openTray}
                aria-haspopup="dialog"
                aria-expanded={v.trayOpen}
                data-tip="Running jobs in every product"
                style={{
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 10px',
                  border: '1px solid var(--ln)',
                  font: '13px var(--f-ui)',
                  whiteSpace: 'nowrap',
                  background: v.trayBtnBg,
                  transition: 'background-color 100ms,border-color 100ms'
                }}
                className={pc('hover', 'border-color:var(--ln-2)')}
              >
                <Icon name={v.runIcon} spin={v.runSpin} style={{ color: v.runColor }} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.runLabel}</span>
              </button>
              {v.trayOpen ? (
                <div
                  role="dialog"
                  aria-label="Running jobs"
                  style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    width: '420px',
                    background: 'var(--overlay)',
                    border: '1px solid var(--ln-2)',
                    boxShadow: 'var(--sh-menu)',
                    animation: 'ae-pop 140ms var(--ease)'
                  }}
                >
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
                    <span style={{ fontWeight: 600 }}>Running jobs</span>
                    <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>All products</span>
                  </div>
                  {v.hasRunning ? (
                    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                      {arr(v.running).map((j: any, i: number) => (
                        <button
                          key={i}
                          onClick={j.onClick}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--ln)',
                            transition: 'background-color 100ms'
                          }}
                          className={pc('hover', 'background:var(--hover)')}
                        >
                          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', font: '13px/18px var(--f-ui)' }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.title}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--tx)' }}>{j.pctL}</span>
                          </span>
                          <span
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '12px',
                              margin: '2px 0 8px',
                              font: '12px/16px var(--f-ui)',
                              color: 'var(--tx-3)'
                            }}
                          >
                            <span>{j.sub}</span>
                            <span>{j.rate}</span>
                          </span>
                          <span style={{ display: 'block', height: '4px', background: 'var(--ln)' }}>
                            <span
                              style={{
                                display: 'block',
                                height: '4px',
                                width: j.pctW,
                                background: 'var(--run)',
                                transition: 'width 900ms linear'
                              }}
                            />
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {v.noRunning ? <div style={{ padding: '20px 16px', color: 'var(--tx-2)' }}>No jobs are running.</div> : null}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
                    <a
                      href={v.jobsHref}
                      onClick={v.closeMenu}
                      style={{
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0 10px',
                        fontWeight: 600,
                        transition: 'background-color 100ms'
                      }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      Open Jobs
                      <Icon name="arrow-right" />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={v.openAlerts}
                aria-haspopup="dialog"
                aria-expanded={v.alertsOpen}
                aria-label={v.alertsAria}
                data-tip={v.alertsAria}
                style={{
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 10px',
                  font: '13px var(--f-ui)',
                  color: 'var(--tx-2)',
                  background: v.alertsBtnBg,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="bell" style={{ color: v.bellColor }} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.alertCount}</span>
              </button>
              {v.alertsOpen ? (
                <div
                  role="dialog"
                  aria-label="Active alerts"
                  style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    width: '440px',
                    background: 'var(--overlay)',
                    border: '1px solid var(--ln-2)',
                    boxShadow: 'var(--sh-menu)',
                    animation: 'ae-pop 140ms var(--ease)'
                  }}
                >
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
                    <span style={{ fontWeight: 600 }}>Active alerts</span>
                    <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.alertCountLabel}</span>
                  </div>
                  <div style={{ maxHeight: '420px', overflow: 'auto' }}>
                    {arr(v.activeAlerts).map((al: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '20px minmax(0,1fr) auto',
                          gap: '10px',
                          alignItems: 'start',
                          padding: '12px 12px 12px 16px',
                          borderBottom: '1px solid var(--ln)',
                          animation: 'ae-fade 150ms var(--ease)'
                        }}
                      >
                        <Icon name={al.icon} style={{ color: al.color, marginTop: '2px' }} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 600 }}>{al.title}</span>
                          <span style={{ display: 'block', font: '12px/18px var(--f-ui)', color: 'var(--tx-2)' }}>
                            <span>{al.sevLabel}</span> · <span>{al.object}</span> · <span>{al.raised}</span>
                          </span>
                          <span style={{ display: 'block', marginTop: '2px', font: '13px/18px var(--f-body)', color: 'var(--tx-2)' }}>
                            {al.detail}
                          </span>
                        </span>
                        <button
                          onClick={al.onAck}
                          aria-disabled={al.ackDis}
                          data-tip={al.ackWhy}
                          style={{
                            height: '28px',
                            padding: '0 10px',
                            border: '1px solid var(--ln-2)',
                            font: '600 13px var(--f-body)',
                            whiteSpace: 'nowrap',
                            opacity: al.ackOp,
                            transition: 'background-color 100ms'
                          }}
                          className={pc('hover', 'background:var(--hover)')}
                        >
                          Acknowledge
                        </button>
                      </div>
                    ))}
                    {v.noAlerts ? <div style={{ padding: '20px 16px', color: 'var(--tx-2)' }}>No active alerts.</div> : null}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
                    <a
                      href={v.alertsHref}
                      onClick={v.closeMenu}
                      style={{
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0 10px',
                        fontWeight: 600,
                        transition: 'background-color 100ms'
                      }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      Open Alerts
                      <Icon name="arrow-right" />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
            <span style={{ width: '1px', height: '24px', background: 'var(--ln)', margin: '0 4px' }} />
            <div style={{ position: 'relative' }}>
              <button
                onClick={v.openProject}
                aria-haspopup="menu"
                aria-expanded={v.projectOpen}
                data-tip="Project for this session"
                style={{
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 10px',
                  whiteSpace: 'nowrap',
                  background: v.projectBtnBg,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="box" style={{ color: 'var(--tx-3)' }} />
                <span style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.projectLabel}</span>
                <Icon name="chevron-down" style={{ color: 'var(--tx-3)' }} />
              </button>
              {v.projectOpen ? <TenantMenu project={v.project} onPick={v.pickProject} actingAs={v.actingAs ? v.actingAs.customer : null} role={v.ctx?.role} /> : null}
            </div>
            <span
              data-tip="Orchestrator time zone: India Standard Time (UTC+05:30)"
              style={{
                padding: '0 8px',
                font: '12px/16px var(--f-ui)',
                color: 'var(--tx-2)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap'
              }}
            >
              {v.clock}
            </span>
            <button
              onClick={v.toggleTheme}
              aria-label={v.themeLabel}
              data-tip={v.themeLabel}
              style={{
                width: '36px',
                height: '36px',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--tx-2)',
                transition: 'background-color 100ms,color 100ms'
              }}
              className={pc('hover', 'background:var(--hover);color:var(--tx)')}
            >
              <Icon name={v.themeIcon} />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={v.openUser}
                aria-haspopup="menu"
                aria-expanded={v.userOpen}
                aria-label="User menu for Priya Raman"
                style={{
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0 4px',
                  background: v.userBtnBg,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--panel-2)',
                    border: '1px solid var(--ln-2)',
                    font: '700 11px var(--f-ui)'
                  }}
                >
                  PR
                </span>
                <Icon name="chevron-down" style={{ color: 'var(--tx-3)' }} />
              </button>
              {v.userOpen ? (
                <UserMenu
                  roleLine={v.roleLine}
                  side={v.sideLine}
                  themeIcon={v.themeIcon}
                  themeLabel={v.themeLabel}
                  onTheme={v.toggleTheme}
                  onAccount={(t: AccountTab) => v.openAccount(t)}
                  links={[
                    { href: '#/coverage', label: 'Coverage', icon: 'list' },
                    { href: v.dsHref, label: 'Design system', icon: 'layers' },
                    { href: v.handoffHref, label: 'Handoff values', icon: 'file-text' }
                  ]}
                  onSignOut={v.signOut}
                  onClose={v.closeMenu}
                />
              ) : null}
            </div>
          </div>
        </header>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <aside
            aria-label="Navigation"
            style={{
              width: v.navW,
              flex: 'none',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--nav)',
              borderRight: '1px solid var(--ln)',
              transition: 'width 150ms var(--ease),background-color 150ms',
              overflow: 'hidden'
            }}
          >
            {v.navProps ? <Nav {...v.navProps} /> : <nav style={{ flex: 1 }} />}
            <div
              style={{
                flex: 'none',
                borderTop: '1px solid var(--ln)',
                height: '56px',
                padding: '0 12px 0 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflow: 'hidden'
              }}
            >
              <div style={{ flex: 1, minWidth: 0, opacity: v.labelOp, transition: 'opacity 100ms', whiteSpace: 'nowrap' }}>
                <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>aegis-orchestrator</div>
                <div style={{ font: '11px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Version 4.2.0</div>
              </div>
              <button
                onClick={v.toggleNav}
                aria-label={v.collapseLabel}
                data-tip={v.collapseLabel}
                style={{
                  flex: 'none',
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--tx-3)',
                  transition: 'background-color 100ms,color 100ms'
                }}
                className={pc('hover', 'background:var(--hover);color:var(--tx)')}
              >
                <Icon name="panel-left" />
              </button>
            </div>
          </aside>
          <main
            id="ae-main"
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
          >
            {v.is?.sites ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisSites ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.guests ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisGuests ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.drServers ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisDrServers ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.migServers ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisMigServers ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.list ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisList ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.overview ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisOverview ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.mappings ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisMappings ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.platform ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                {v.key === 'inbox' ? <Inbox ctx={v.ctx} /> : null}
                {v.key === 'workloads' ? <Workloads ctx={v.ctx} /> : null}
                {v.key === 'applications' ? <Applications ctx={v.ctx} /> : null}
                {v.key === 'customers' ? <Customers ctx={v.ctx} /> : null}
                {v.key === 'search' ? <SearchPage key={v.ctx.tab} ctx={v.ctx} /> : null}
                {v.key === 'activity' ? <ActivitySection ctx={v.ctx} jobCtl={v.jobCtl} /> : null}
                {v.key === 'automation' ? <AutomationSection ctx={v.ctx} /> : null}
                {v.key === 'settings' ? <SettingsSection ctx={v.ctx} /> : null}
                {v.key === 'billing' ? <BillingSection ctx={v.ctx} /> : null}
                {v.key === 'backup/policies' ? <Policies ctx={v.ctx} fixedType="Backup" /> : null}
                {v.key === 'dr/overview' ? <ResilienceOverview ctx={v.ctx} /> : null}
                {v.key === 'dr/recovery' ? <RecoveryPlans ctx={v.ctx} /> : null}
                {v.key === 'dr/plans' ? <Policies ctx={v.ctx} fixedType="DR" /> : null}
                {v.key === 'mig/overview' ? <MobilityOverview ctx={v.ctx} /> : null}
                {v.key === 'mig/sources' ? <Sources key={v.ctx.tab} ctx={v.ctx} /> : null}
              </div>
            ) : null}

            {v.is?.reports ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisReports ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.restore ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AegisRestore ctx={v.ctx} />
              </div>
            ) : null}
            {v.is?.pending ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
                <div style={{ padding: '20px 24px 16px' }}>
                  <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>{v.ctx?.section}</div>
                  <h1 style={{ font: '500 24px/32px var(--f-head)' }}>{v.ctx?.title}</h1>
                  <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>{v.ctx?.sub}</p>
                </div>
                <div
                  style={{
                    margin: '0 24px 24px',
                    flex: 1,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--panel)',
                    border: '1px solid var(--ln)'
                  }}
                >
                  <p style={{ maxWidth: '440px', textAlign: 'center', color: 'var(--tx-2)' }}>
                    There is no screen at this address. Choose a section from the navigation.
                  </p>
                </div>
              </div>
            ) : null}
          </main>
        </div>
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            right: '24px',
            bottom: '24px',
            zIndex: 80,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
            pointerEvents: 'none'
          }}
        >
          {arr(v.toasts).map((t: any, i: number) => (
            <div
              key={i}
              role="status"
              style={{
                pointerEvents: 'auto',
                minWidth: '320px',
                maxWidth: '440px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 8px 10px 14px',
                background: 'var(--overlay)',
                border: '1px solid var(--ln-2)',
                boxShadow: 'var(--sh-menu)',
                animation: t.anim
              }}
            >
              <Icon name={t.icon} style={{ color: t.color }} />
              <span style={{ flex: 1, minWidth: 0, textWrap: 'pretty' }}>{t.text}</span>
              {t.action ? (
                <button
                  onClick={t.onAction}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    fontWeight: 600,
                    color: 'var(--acc-tx)',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 100ms'
                  }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  {t.action}
                </button>
              ) : null}
              <button
                onClick={t.onClose}
                aria-label="Dismiss"
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
          ))}
        </div>
        {v.account ? <AccountDialog ctx={v.ctx} tab={v.account} closing={v.accountClosing} onClose={v.closeAccount} /> : null}
        {v.loginAs ? <LoginAsDialog ctx={v.ctx} customerId={v.loginAs} closing={v.loginAsClosing} onClose={v.closeLoginAs} onStart={(reason: string) => v.startActing(v.loginAs, reason)} /> : null}
        {v.signedOut ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 100,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--app)',
              animation: 'ae-fade 150ms var(--ease)'
            }}
          >
            <div
              style={{ width: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}
            >
              <Icon name="mark" size="40" />
              <h1 style={{ font: '500 24px/32px var(--f-head)' }}>You are signed out</h1>
              <p style={{ color: 'var(--tx-2)' }}>Running jobs keep going on aegis-orchestrator. Sign in again to see them.</p>
              <button
                onClick={v.signIn}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  background: 'var(--acc)',
                  color: 'var(--acc-ink)',
                  fontWeight: 600,
                  transition: 'background-color 100ms'
                }}
                className={pc('hover', 'background:var(--acc-h)')}
              >
                Sign in again
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
