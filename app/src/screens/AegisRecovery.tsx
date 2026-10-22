/* Ported from project/AegisRecovery.dc.html */
import React from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';

const KINDS = {
  failover: ['zap', 'Fail over a server'],
  start: ['power', 'Start a server'],
  ping: ['wifi', 'Check: ping an address'],
  port: ['plug', 'Check: connect to a port'],
  manual: ['hand', 'Manual step'],
  wait: ['timer', 'Wait']
};
const LI = {
  info: ['circle-dot', 'var(--tx-3)'],
  ok: ['circle-check', 'var(--ok)'],
  warn: ['triangle-alert', 'var(--warn)'],
  err: ['circle-x', 'var(--err)']
};
const desc = (a, testNet) =>
  ({
    failover: [
      `Fail over ${a.target}`,
      `Starts ${a.target} at the recovery site from its newest point${testNet ? `, on ${testNet} when testing` : ''}.`
    ],
    start: [`Start ${a.target}`, 'Powers on a server that already runs at the recovery site.'],
    ping: [`Ping ${a.target}`, 'Waits up to 120 s for an answer.'],
    port: [`Connect to ${a.target} on port ${a.port}`, 'Waits up to 120 s for the port to accept a connection.'],
    manual: ['Manual step', a.text],
    wait: [`Wait ${a.secs} s`, 'Gives services time to settle before the next step.']
  })[a.k];

export default class AegisRecovery extends DC {
  state: any = { sel: 'core', tab: 'Steps', edits: {}, add: null, appr: {}, run: null, checking: false, checked: {} };
  logRef = React.createRef<any>();
  componentDidMount() {
    const c = this.props.ctx;
    if (c && c.openId) this.setState({ sel: c.openId });
  }
  componentDidUpdate() {
    const el = this.logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }
  componentWillUnmount() {
    clearInterval(this.ti);
  }
  steps(id) {
    const A = AEGIS;
    return this.state.edits[id] || JSON.parse(JSON.stringify(A.recPlans.find(p => p.id === id).steps));
  }
  setSteps(id, fn) {
    this.setState(s => ({ edits: { ...s.edits, [id]: fn(this.steps(id)) } }));
  }

  startRun(test) {
    const ctx = this.props.ctx;
    const A = AEGIS;
    const plan = A.recPlans.find(p => p.id === this.state.sel);
    const steps = this.steps(plan.id);
    const flat = [];
    steps.forEach((st, si) => st.actions.forEach((a, ai) => flat.push({ si, ai, a, st })));
    const net = plan.to === 'production-openstack' ? 'dr-test-isolated' : 'vmbr99';
    this.setState({
      run: {
        plan: plan.id,
        test,
        i: 0,
        flat: flat.length,
        done: false,
        waiting: false,
        failed: false,
        started: ctx.hms(),
        log: [{ t: ctx.hms(), text: `${test ? 'Test' : 'Run'} of ${plan.name} started${test ? ` on ${net}` : ''}`, lv: 'info' }]
      }
    });
    clearInterval(this.ti);
    this.ti = setInterval(() => {
      const r = this.state.run;
      if (!r || r.done || r.waiting) return;
      const it = flat[r.i];
      if (!it) {
        clearInterval(this.ti);
        this.setState(s => ({
          run: {
            ...s.run,
            done: true,
            log: s.run.log.concat([{ t: ctx.hms(), text: `${test ? 'Test' : 'Run'} passed: every step finished`, lv: 'ok' }])
          }
        }));
        ctx.toast(`${test ? 'Test' : 'Run'} of ${plan.name} passed`, 'ok');
        return;
      }
      const [title] = desc(it.a, test ? net : '');
      if (it.a.k === 'manual') {
        this.setState(s => ({
          run: {
            ...s.run,
            waiting: true,
            log: s.run.log.concat([{ t: ctx.hms(), text: `Step ${it.si + 1} waits for a person: ${it.a.text}`, lv: 'warn' }])
          }
        }));
        return;
      }
      this.setState(s => ({
        run: { ...s.run, i: s.run.i + 1, log: s.run.log.concat([{ t: ctx.hms(), text: `Step ${it.si + 1} · ${title}: done`, lv: 'ok' }]) }
      }));
    }, 1100);
  }

  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    const E = {
      plans: [],
      tabs: [],
      steps: [],
      boot: [],
      plan: {},
      run: { log: [] },
      rep: { rows: [] },
      runs: [],
      appr: {},
      testB: {},
      runB: {},
      tab: {}
    };
    if (!A || !ctx) return E;
    const s = this.state;
    const cfg = ctx.can('configure', 'Editing a recovery plan');
    const op = ctx.can('operate', 'Running a recovery plan');
    const plan = A.recPlans.find(p => p.id === s.sel) || A.recPlans[0];
    const steps = this.steps(plan.id);
    const testNet =
      plan.to === 'production-openstack' ? 'dr-test-isolated' : plan.to === 'region-2-os' ? 'test-isolated (region-2-os)' : 'vmbr99';
    const run = s.run && s.run.plan === plan.id ? s.run : null;
    const flat = [];
    steps.forEach((st, si) => st.actions.forEach((a, ai) => flat.push(`${si}.${ai}`)));
    const apprOn = s.appr[plan.id] != null ? s.appr[plan.id] : !!plan.approval;
    const plans = A.recPlans.map(p => {
      const on = p.id === plan.id;
      const running = s.run && s.run.plan === p.id && !s.run.done;
      return {
        name: p.name,
        current: on ? 'page' : undefined,
        bg: on ? 'var(--acc-soft)' : 'transparent',
        onClick: () => this.setState({ sel: p.id, add: null }),
        ri: running ? 'loader-circle' : p.ready === 'ready' ? 'circle-check' : p.ready === 'issues' ? 'triangle-alert' : 'circle-minus',
        spin: running ? 'true' : 'false',
        rc: running ? 'var(--run)' : p.ready === 'ready' ? 'var(--ok)' : p.ready === 'issues' ? 'var(--warn)' : 'var(--tx-3)',
        ready: running
          ? 'Test running'
          : p.ready === 'ready'
            ? 'Ready'
            : p.ready === 'issues'
              ? `${p.issues} readiness issues`
              : 'Not checked: recovery site not read',
        meta: `${p.servers.length} servers · ${p.lastTest ? 'tested ' + p.lastTest.t.replace(' 2026', '').replace(' IST', '') : 'never tested'}`
      };
    });
    const stepsV = steps.map((st, si) => ({
      n: String(si + 1),
      name: st.name,
      bd: run && !run.done && flat[run.i] && flat[run.i].startsWith(si + '.') ? 'var(--acc)' : 'var(--ln)',
      onName: e => {
        const v = e.target.value;
        this.setSteps(plan.id, ss => {
          ss[si].name = v;
          return ss;
        });
      },
      up: () =>
        si > 0 &&
        this.setSteps(plan.id, ss => {
          [ss[si - 1], ss[si]] = [ss[si], ss[si - 1]];
          return ss;
        }),
      down: () =>
        si < steps.length - 1 &&
        this.setSteps(plan.id, ss => {
          [ss[si + 1], ss[si]] = [ss[si], ss[si + 1]];
          return ss;
        }),
      upDis: si === 0 ? 'true' : undefined,
      upOp: si === 0 ? 0.35 : 1,
      downDis: si === steps.length - 1 ? 'true' : undefined,
      downOp: si === steps.length - 1 ? 0.35 : 1,
      remove: () => this.setSteps(plan.id, ss => ss.filter((_, i) => i !== si)),
      actions: st.actions.map((a, ai) => {
        const key = `${si}.${ai}`;
        const idx = flat.indexOf(key);
        const done = run && idx < run.i;
        const cur = run && !run.done && idx === run.i;
        const [title, detail] = desc(a, testNet);
        return {
          title,
          detail,
          icon: done ? 'circle-check' : cur ? (run.waiting ? 'hand' : 'loader-circle') : KINDS[a.k][0],
          spin: cur && !run.waiting ? 'true' : 'false',
          ic: done ? 'var(--ok)' : cur ? (run.waiting ? 'var(--warn)' : 'var(--run)') : 'var(--tx-2)',
          bg: cur ? 'var(--acc-soft)' : 'transparent',
          state: done ? 'Done' : cur ? (run.waiting ? 'Waiting for a person' : 'Running') : run && !run.done ? 'Queued' : '',
          sc: done ? 'var(--ok)' : 'var(--tx-3)',
          remove: () =>
            this.setSteps(plan.id, ss => {
              ss[si].actions = ss[si].actions.filter((_, i) => i !== ai);
              return ss;
            })
        };
      }),
      addOpen: s.add === si,
      openAdd: () => this.setState(st2 => ({ add: st2.add === si ? null : si })),
      kinds: Object.entries(KINDS).map(([k, [icon, label]]) => ({
        icon,
        label,
        onClick: () => {
          const def = {
            failover: { k, target: plan.servers[0] },
            start: { k, target: plan.servers[0] },
            ping: { k, target: '10.50.0.31' },
            port: { k, target: plan.servers[0], port: 443 },
            manual: { k, text: 'Confirm with the service owner before continuing.' },
            wait: { k, secs: 60 }
          }[k];
          this.setSteps(plan.id, ss => {
            ss[si].actions.push(def);
            return ss;
          });
          this.setState({ add: null });
        }
      }))
    }));
    const boot = [];
    steps.forEach((st, si) =>
      st.actions.forEach(a => {
        if (a.k === 'failover' || a.k === 'start') boot.push({ n: String(boot.length + 1), name: a.target, step: String(si + 1) });
      })
    );
    const reportRows =
      plan.ready === 'unknown'
        ? [
            {
              i: 'triangle-alert',
              c: 'var(--warn)',
              check: 'Recovery site',
              obj: plan.to,
              result: 'Could not be read: region-2-os did not answer within 30 s. Nothing else was checked.',
              tc: 'var(--tx)'
            }
          ]
        : [].concat(
            plan.servers.map(n => {
              const x = A.drServers.find(d => d.name === n);
              const ok = x && x.ageMin != null && x.ageMin <= (x.target === '15 min' ? 15 : 1440) && x.state !== 'failed';
              return {
                i: ok ? 'circle-check' : x && x.state === 'failed' ? 'circle-x' : 'triangle-alert',
                c: ok ? 'var(--ok)' : x && x.state === 'failed' ? 'var(--err)' : 'var(--warn)',
                check: 'Newest point within target',
                obj: n,
                result: x
                  ? ok
                    ? `${x.age} old, target ${x.target}`
                    : x.state === 'failed'
                      ? `Last sync failed ${x.age} ago`
                      : `${x.age} old, target ${x.target}`
                  : '—',
                tc: ok ? 'var(--tx-2)' : 'var(--tx)'
              };
            }),
            [
              {
                i: 'circle-check',
                c: 'var(--ok)',
                check: 'Mapping complete',
                obj: `${plan.from} → ${plan.to}`,
                result: 'Networks, storage and sizes are mapped for every server',
                tc: 'var(--tx-2)'
              },
              {
                i: 'circle-check',
                c: 'var(--ok)',
                check: 'Test network isolated',
                obj: testNet,
                result: 'No router and no route to production',
                tc: 'var(--tx-2)'
              },
              {
                i: 'circle-check',
                c: 'var(--ok)',
                check: 'Quota at recovery site',
                obj: plan.to,
                result: `Needs ${plan.servers.length * 8} vCPU and ${plan.servers.length * 24} GB; ${96} vCPU and 512 GB free`,
                tc: 'var(--tx-2)'
              },
              {
                i: 'circle-check',
                c: 'var(--ok)',
                check: 'Credentials valid',
                obj: plan.to,
                result: 'Signed in at 06:00 IST',
                tc: 'var(--tx-2)'
              },
              {
                i: apprOn ? 'circle-check' : 'circle-minus',
                c: apprOn ? 'var(--ok)' : 'var(--tx-3)',
                check: 'Approvers available',
                obj: 'Base-Project',
                result: apprOn ? '2 people can approve: Priya Raman, Arun Kumar' : 'No approval required',
                tc: 'var(--tx-2)'
              }
            ]
          );
    const issues = reportRows.filter(r => r.c === 'var(--warn)' || r.c === 'var(--err)').length;
    const checked = s.checked[plan.id];
    const runs = plan.lastTest
      ? [
          {
            t: plan.lastTest.t.replace(' IST', ''),
            kind: 'Test',
            i: 'circle-check',
            c: 'var(--ok)',
            l: 'Passed',
            dur: plan.lastTest.dur,
            by: 'priya.raman'
          },
          {
            t: '04 Oct 2026, 21:00',
            kind: 'Test',
            i: 'triangle-alert',
            c: 'var(--warn)',
            l: 'Passed with warnings',
            dur: '24 min 02 s',
            by: 'arun.kumar'
          }
        ]
      : [];
    const total = flat.length;
    const busy = !!(run && !run.done);
    const g = (ok, why, label?) => ({ dis: ok ? undefined : 'true', why: ok ? undefined : why, op: ok ? 1 : 0.45, label });
    return {
      cfgDis: cfg.dis,
      cfgWhy: cfg.why,
      cfgOp: cfg.op,
      createPlan: () => {
        if (cfg.ok) ctx.toast('Recovery plan Untitled plan created. Add its first step.', 'ok');
      },
      plans,
      plan: { name: plan.name, route: `${plan.from} → ${plan.to} · ${plan.servers.length} servers`, testNet },
      testB: g(
        op.ok && !busy && plan.ready !== 'unknown',
        !op.ok ? op.why : busy ? 'A run is in progress.' : `${plan.to} could not be read.`
      ),
      runB: g(
        op.ok && !busy && plan.ready !== 'unknown',
        !op.ok ? op.why : busy ? 'A run is in progress.' : `${plan.to} could not be read.`,
        apprOn ? 'Request approval to run' : 'Run plan'
      ),
      testPlan: () => {
        if (op.ok && !busy && plan.ready !== 'unknown') {
          this.setState({ tab: 'Steps' });
          this.startRun(true);
        }
      },
      runPlan: () => {
        if (!(op.ok && !busy && plan.ready !== 'unknown')) return;
        if (apprOn) ctx.toast(`Approval requested for ${plan.name}. Priya Raman and Arun Kumar were notified.`, 'info');
        else {
          this.setState({ tab: 'Steps' });
          this.startRun(false);
        }
      },
      tabs: [
        ['Steps', String(steps.length)],
        ['Readiness', plan.ready === 'unknown' ? '' : String(issues)],
        ['Runs', String(runs.length)]
      ].map(([t, n]) => ({
        label: t === 'Readiness' ? 'Readiness report' : t,
        n,
        on: s.tab === t,
        fg: s.tab === t ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState({ tab: t })
      })),
      tab: { steps: s.tab === 'Steps', ready: s.tab === 'Readiness', runs: s.tab === 'Runs' },
      steps: stepsV,
      boot,
      addStep: () => this.setSteps(plan.id, ss => ss.concat([{ name: 'New step', actions: [] }])),
      appr: {
        on: apprOn,
        label: apprOn ? 'An Owner or Admin approves each run' : 'Runs without approval',
        hint: apprOn
          ? 'The person who requests a run cannot approve it. Tests on the isolated network never need approval.'
          : 'Anyone with the Operator role can run this plan.',
        tbg: apprOn ? 'var(--acc)' : 'transparent',
        tbd: apprOn ? 'var(--acc)' : 'var(--ln-2)',
        knob: apprOn ? 'var(--acc-ink)' : 'var(--tx-3)',
        tx: apprOn ? 'translateX(14px)' : 'none'
      },
      toggleAppr: () => {
        if (cfg.ok) this.setState(st => ({ appr: { ...st.appr, [plan.id]: !apprOn } }));
      },
      savePlan: () => {
        if (cfg.ok) ctx.toast(`Recovery plan ${plan.name} saved`, 'ok');
      },
      run: run
        ? {
            on: true,
            title: run.done
              ? `${run.test ? 'Test' : 'Run'} passed`
              : run.waiting
                ? 'Waiting for a manual step'
                : `${run.test ? 'Test' : 'Run'} in progress · action ${Math.min(run.i + 1, total)} of ${total}`,
            sub: `${run.test ? `On ${testNet}. Primary servers keep running.` : 'At the recovery site.'} Started ${run.started} IST`,
            i: run.done ? 'circle-check' : run.waiting ? 'hand' : 'loader-circle',
            spin: run.done || run.waiting ? 'false' : 'true',
            c: run.done ? 'var(--ok)' : run.waiting ? 'var(--warn)' : 'var(--run)',
            waiting: run.waiting,
            pctW: `${Math.round((run.i / Math.max(1, total)) * 100)}%`,
            stopLabel: run.done ? (run.test ? 'Clean up test servers' : 'Close') : 'Stop',
            log: run.log.map(l => ({ ...l, i: LI[l.lv][0], c: LI[l.lv][1] }))
          }
        : { on: false, log: [] },
      markDone: () =>
        this.setState(st => ({
          run: {
            ...st.run,
            waiting: false,
            i: st.run.i + 1,
            log: st.run.log.concat([{ t: ctx.hms(), text: 'Manual step marked done by priya.raman', lv: 'ok' }])
          }
        })),
      stopRun: () => {
        clearInterval(this.ti);
        const r = s.run;
        if (r && r.done && r.test) ctx.toast(`Test servers of ${plan.name} removed from ${testNet}`, 'ok');
        else if (r && !r.done) ctx.toast(`${r.test ? 'Test' : 'Run'} of ${plan.name} stopped`, 'warn');
        this.setState({ run: null });
      },
      logRef: this.logRef,
      rep: {
        i: plan.ready === 'unknown' ? 'triangle-alert' : issues ? 'triangle-alert' : 'circle-check',
        c: plan.ready === 'unknown' || issues ? 'var(--warn)' : 'var(--ok)',
        title:
          plan.ready === 'unknown'
            ? 'Readiness could not be checked'
            : issues
              ? `Not ready: ${issues} ${issues === 1 ? 'issue' : 'issues'}`
              : 'Ready',
        sub: `Daily check ${checked ? 'run now at ' + checked : 'at 21 Oct 2026, 06:00 IST'} · runs every day at 06:00 IST`,
        rows: reportRows,
        ci: s.checking ? 'loader-circle' : 'refresh-cw',
        cspin: s.checking ? 'true' : 'false'
      },
      checkNow: () => {
        this.setState({ checking: true });
        setTimeout(() => {
          this.setState(st => ({ checking: false, checked: { ...st.checked, [plan.id]: ctx.now() } }));
          ctx.toast(`Readiness check of ${plan.name} finished`, 'ok');
        }, 1400);
      },
      downloadReport: () => ctx.toast(`Readiness report for ${plan.name} downloaded`, 'ok'),
      runs,
      noRuns: !runs.length
    };
  }

  render() {
    const v = this.vals();
    return (
      <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
        <div style={{ flex: 'none', padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Disaster Recovery</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Recovery plans</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>
              Ordered, testable runbooks that bring services online at the recovery site.
            </p>
          </div>
          <button
            onClick={v.createPlan}
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
              transition: 'background-color 100ms'
            }}
            className={pc('hover', 'background:var(--acc-h)')}
          >
            <Icon name="plus" />
            Create a recovery plan
          </button>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: '0 24px 24px',
            display: 'grid',
            gridTemplateColumns: '300px minmax(0,1fr)',
            gap: '16px'
          }}
        >
          <nav
            aria-label="Recovery plans"
            style={{ minHeight: 0, overflow: 'auto', background: 'var(--panel)', border: '1px solid var(--ln)' }}
          >
            <Ind mode="rail" style={{ display: 'flex', flexDirection: 'column' }}>
              {arr(v.plans).map((p: any, i: number) => (
                <button
                  key={i}
                  aria-current={p.current}
                  onClick={p.onClick}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--ln)',
                    background: p.bg,
                    textAlign: 'left',
                    transition: 'background-color 100ms'
                  }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                    <Icon name={p.ri} spin={p.spin} style={{ color: p.rc }} />
                    {p.ready}
                  </span>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{p.meta}</span>
                </button>
              ))}
            </Ind>
          </nav>
          <section
            style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--panel)', border: '1px solid var(--ln)' }}
          >
            <div style={{ flex: 'none', padding: '16px 16px 0 20px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ font: '500 20px/28px var(--f-head)' }}>{v.plan?.name}</h2>
                <p style={{ marginTop: '2px', font: '13px/18px var(--f-ui)', color: 'var(--tx-2)' }}>{v.plan?.route}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={v.testPlan}
                  aria-disabled={v.testB?.dis}
                  data-tip={v.testB?.why}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid var(--ln-2)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    opacity: v.testB?.op,
                    transition: 'background-color 100ms'
                  }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  <Icon name="flask-conical" />
                  Test on isolated network
                </button>
                <button
                  onClick={v.runPlan}
                  aria-disabled={v.runB?.dis}
                  data-tip={v.runB?.why}
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
                    opacity: v.runB?.op,
                    transition: 'background-color 100ms'
                  }}
                  className={pc('hover', 'background:var(--acc-h)')}
                >
                  <Icon name="play" />
                  {v.runB?.label}
                </button>
              </div>
            </div>
            <Ind
              mode="underline"
              role="tablist"
              style={{ flex: 'none', display: 'flex', padding: '12px 12px 0', borderBottom: '1px solid var(--ln)' }}
            >
              {arr(v.tabs).map((t: any, i: number) => (
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
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px' }}>
              {v.run?.on ? (
                <div
                  style={{
                    marginBottom: '20px',
                    border: '1px solid var(--ln-2)',
                    background: 'var(--panel-2)',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--ln)'
                    }}
                  >
                    <Icon name={v.run?.i} spin={v.run?.spin} style={{ color: v.run?.c }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{v.run?.title}</span>
                      <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{v.run?.sub}</span>
                    </span>
                    {v.run?.waiting ? (
                      <button
                        onClick={v.markDone}
                        style={{ height: '30px', padding: '0 12px', background: 'var(--acc)', color: 'var(--acc-ink)', fontWeight: 600 }}
                        className={pc('hover', 'background:var(--acc-h)')}
                      >
                        Mark manual step done
                      </button>
                    ) : null}
                    <button
                      onClick={v.stopRun}
                      style={{ height: '30px', padding: '0 12px', border: '1px solid var(--ln-2)', fontWeight: 600 }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      {v.run?.stopLabel}
                    </button>
                  </div>
                  <div style={{ height: '3px', background: 'var(--ln)' }}>
                    <div style={{ height: '3px', width: v.run?.pctW, background: v.run?.c, transition: 'width 600ms linear' }} />
                  </div>
                  <div
                    ref={v.logRef}
                    role="log"
                    aria-label="Test log"
                    style={{
                      maxHeight: '140px',
                      overflow: 'auto',
                      padding: '8px 14px',
                      font: '12px/20px var(--f-ui)',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {arr(v.run?.log).map((l: any, i: number) => (
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
                        <span style={{ color: 'var(--tx-3)' }}>{l.t}</span>
                        <Icon name={l.i} style={{ color: l.c }} />
                        <span>{l.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {v.tab?.steps ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) 280px',
                    gap: '20px',
                    alignItems: 'start',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {arr(v.steps).map((st: any, i: number) => (
                      <li key={i} style={{ border: `1px solid ${st.bd}`, background: 'var(--panel)', transition: 'border-color 150ms' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            height: '44px',
                            padding: '0 8px 0 10px',
                            borderBottom: '1px solid var(--ln)',
                            background: 'var(--panel-2)'
                          }}
                        >
                          <Icon name="grip-vertical" style={{ color: 'var(--tx-3)', cursor: 'grab' }} />
                          <span style={{ font: '700 12px var(--f-ui)', color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>
                            Step <span>{st.n}</span>
                          </span>
                          <input
                            value={st.name ?? ''}
                            onChange={st.onName}
                            aria-label="Step name"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: '30px',
                              padding: '0 8px',
                              background: 'transparent',
                              border: '1px solid transparent',
                              font: '600 14px var(--f-body)'
                            }}
                            className={[
                              pc('hover', 'border-color:var(--ln)'),
                              pc('focus', 'border-color:var(--acc);background:var(--panel)')
                            ].join(' ')}
                          />
                          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>
                            Actions start together
                          </span>
                          <button
                            onClick={st.up}
                            aria-label="Move step up"
                            aria-disabled={st.upDis}
                            style={{
                              width: '28px',
                              height: '28px',
                              display: 'grid',
                              placeItems: 'center',
                              color: 'var(--tx-2)',
                              opacity: st.upOp
                            }}
                            className={pc('hover', 'background:var(--hover)')}
                          >
                            <Icon name="chevron-up" />
                          </button>
                          <button
                            onClick={st.down}
                            aria-label="Move step down"
                            aria-disabled={st.downDis}
                            style={{
                              width: '28px',
                              height: '28px',
                              display: 'grid',
                              placeItems: 'center',
                              color: 'var(--tx-2)',
                              opacity: st.downOp
                            }}
                            className={pc('hover', 'background:var(--hover)')}
                          >
                            <Icon name="chevron-down" />
                          </button>
                          <button
                            onClick={st.remove}
                            aria-label="Remove step"
                            style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', color: 'var(--tx-3)' }}
                            className={pc('hover', 'background:var(--err-s);color:var(--err)')}
                          >
                            <Icon name="trash-2" />
                          </button>
                        </div>
                        <ul style={{ listStyle: 'none', padding: '4px 0' }}>
                          {arr(st.actions).map((ac: any, j: number) => (
                            <li
                              key={j}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '20px minmax(0,1fr) auto 28px',
                                gap: '10px',
                                alignItems: 'center',
                                minHeight: '40px',
                                padding: '6px 8px 6px 12px',
                                background: ac.bg,
                                transition: 'background-color 150ms'
                              }}
                            >
                              <Icon name={ac.icon} spin={ac.spin} style={{ color: ac.ic }} />
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600 }}>{ac.title}</span>
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    lineHeight: '18px',
                                    color: 'var(--tx-2)',
                                    textWrap: 'pretty'
                                  }}
                                >
                                  {ac.detail}
                                </span>
                              </span>
                              <span style={{ font: '12px var(--f-ui)', color: ac.sc, whiteSpace: 'nowrap' }}>{ac.state}</span>
                              <button
                                onClick={ac.remove}
                                aria-label="Remove action"
                                style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', color: 'var(--tx-3)' }}
                                className={pc('hover', 'background:var(--hover);color:var(--tx)')}
                              >
                                <Icon name="x" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div style={{ position: 'relative', padding: '4px 8px 8px' }}>
                          <button
                            onClick={st.openAdd}
                            aria-expanded={st.addOpen}
                            style={{
                              height: '30px',
                              padding: '0 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              font: '600 13px var(--f-body)',
                              color: 'var(--acc-tx)'
                            }}
                            className={pc('hover', 'background:var(--hover)')}
                          >
                            <Icon name="plus" />
                            Add action
                          </button>
                          {st.addOpen ? (
                            <div
                              role="menu"
                              style={{
                                position: 'absolute',
                                left: '8px',
                                top: '38px',
                                zIndex: 5,
                                width: '300px',
                                padding: '4px 0',
                                background: 'var(--overlay)',
                                border: '1px solid var(--ln-2)',
                                boxShadow: 'var(--sh-menu)',
                                animation: 'ae-pop 140ms var(--ease)'
                              }}
                            >
                              {arr(st.kinds).map((kd: any, j: number) => (
                                <button
                                  key={j}
                                  role="menuitem"
                                  onClick={kd.onClick}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    height: '36px',
                                    padding: '0 12px'
                                  }}
                                  className={pc('hover', 'background:var(--hover)')}
                                >
                                  <Icon name={kd.icon} style={{ color: 'var(--tx-2)' }} />
                                  {kd.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                    <li>
                      <button
                        onClick={v.addStep}
                        style={{
                          width: '100%',
                          height: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          border: '1px dashed var(--ln-2)',
                          color: 'var(--tx-2)',
                          fontWeight: 600,
                          transition: 'border-color 100ms,color 100ms'
                        }}
                        className={pc('hover', 'border-color:var(--acc);color:var(--tx)')}
                      >
                        <Icon name="plus" />
                        Add step
                      </button>
                    </li>
                  </ol>
                  <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <section>
                      <h3 style={{ font: '600 14px/20px var(--f-body)', marginBottom: '6px' }}>Boot order</h3>
                      <ol style={{ listStyle: 'none', padding: 0, border: '1px solid var(--ln)' }}>
                        {arr(v.boot).map((b: any, i: number) => (
                          <li
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              height: '32px',
                              padding: '0 10px',
                              borderBottom: '1px solid var(--ln)',
                              font: '13px var(--f-ui)'
                            }}
                          >
                            <span style={{ width: '18px', color: 'var(--tx-3)', fontVariantNumeric: 'tabular-nums' }}>{b.n}</span>
                            <span style={{ flex: 1 }}>{b.name}</span>
                            <span style={{ color: 'var(--tx-3)' }}>
                              Step <span>{b.step}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </section>
                    <section>
                      <h3 style={{ font: '600 14px/20px var(--f-body)', marginBottom: '6px' }}>Mapping used</h3>
                      <a
                        href="#/dr/mappings"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          border: '1px solid var(--ln)',
                          font: '13px var(--f-ui)',
                          transition: 'border-color 100ms'
                        }}
                        className={pc('hover', 'border-color:var(--acc)')}
                      >
                        <Icon name="arrow-left-right" style={{ color: 'var(--tx-3)' }} />
                        {v.plan?.route}
                      </a>
                    </section>
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h3 style={{ font: '600 14px/20px var(--f-body)' }}>Approval before it runs</h3>
                      <button
                        role="switch"
                        aria-checked={v.appr?.on}
                        onClick={v.toggleAppr}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                      >
                        <span
                          style={{
                            width: '32px',
                            height: '18px',
                            padding: '2px',
                            display: 'flex',
                            background: v.appr?.tbg,
                            border: `1px solid ${v.appr?.tbd}`,
                            transition: 'background-color 120ms'
                          }}
                        >
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              background: v.appr?.knob,
                              transform: v.appr?.tx,
                              transition: 'transform 120ms var(--ease)'
                            }}
                          />
                        </span>
                        {v.appr?.label}
                      </button>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{v.appr?.hint}</span>
                    </section>
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h3 style={{ font: '600 14px/20px var(--f-body)' }}>Test mode</h3>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '13px var(--f-ui)' }}>
                        <Icon name="circle-check" style={{ color: 'var(--ok)' }} />
                        {v.plan?.testNet}
                      </span>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
                        Tests start the servers on this network with no route to production. Primary servers keep running.
                      </span>
                    </section>
                    <button
                      onClick={v.savePlan}
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
                      Save plan
                    </button>
                  </aside>
                </div>
              ) : null}
              {v.tab?.ready ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'ae-fade 150ms var(--ease)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      border: '1px solid var(--ln)',
                      background: 'var(--panel-2)'
                    }}
                  >
                    <Icon name={v.rep?.i} size="20" style={{ color: v.rep?.c }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{v.rep?.title}</span>
                      <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{v.rep?.sub}</span>
                    </span>
                    <button
                      onClick={v.checkNow}
                      style={{
                        height: '30px',
                        padding: '0 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid var(--ln-2)',
                        fontWeight: 600
                      }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      <Icon name={v.rep?.ci} spin={v.rep?.cspin} />
                      Run check now
                    </button>
                    <button
                      onClick={v.downloadReport}
                      style={{
                        height: '30px',
                        padding: '0 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid var(--ln-2)',
                        fontWeight: 600
                      }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      <Icon name="download" />
                      Report (PDF)
                    </button>
                  </div>
                  <div role="table" aria-label="Readiness checks" style={{ font: '13px/18px var(--f-ui)' }}>
                    <div
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.6fr)',
                        gap: '12px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)',
                        fontSize: '12px',
                        color: 'var(--tx-2)'
                      }}
                    >
                      <span />
                      <span>Check</span>
                      <span>Object</span>
                      <span>Result</span>
                    </div>
                    {arr(v.rep?.rows).map((r: any, i: number) => (
                      <div
                        key={i}
                        role="row"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '20px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.6fr)',
                          gap: '12px',
                          alignItems: 'center',
                          minHeight: '40px',
                          padding: '6px 0',
                          borderBottom: '1px solid var(--ln)'
                        }}
                      >
                        <Icon name={r.i} style={{ color: r.c }} />
                        <span>{r.check}</span>
                        <span style={{ color: 'var(--tx-2)' }}>{r.obj}</span>
                        <span style={{ color: r.tc }}>{r.result}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {v.tab?.runs ? (
                <div role="table" aria-label="Runs" style={{ font: '13px/18px var(--f-ui)', animation: 'ae-fade 150ms var(--ease)' }}>
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.2fr) 100px 140px 120px minmax(0,1fr)',
                      gap: '12px',
                      alignItems: 'center',
                      height: '36px',
                      borderBottom: '1px solid var(--ln)',
                      fontSize: '12px',
                      color: 'var(--tx-2)'
                    }}
                  >
                    <span>Started (IST)</span>
                    <span>Kind</span>
                    <span>Result</span>
                    <span style={{ textAlign: 'right' }}>Duration</span>
                    <span>By</span>
                  </div>
                  {arr(v.runs).map((r: any, i: number) => (
                    <div
                      key={i}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.2fr) 100px 140px 120px minmax(0,1fr)',
                        gap: '12px',
                        alignItems: 'center',
                        height: '36px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <span>{r.t}</span>
                      <span style={{ color: 'var(--tx-2)' }}>{r.kind}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name={r.i} style={{ color: r.c }} />
                        {r.l}
                      </span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.dur}</span>
                      <span style={{ color: 'var(--tx-2)' }}>{r.by}</span>
                    </div>
                  ))}
                  {v.noRuns ? (
                    <p style={{ padding: '16px 0', color: 'var(--tx-2)', fontFamily: 'var(--f-body)' }}>
                      This plan has never run. Test it on the isolated network first.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    );
  }
}
