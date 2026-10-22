/* Ported from project/AegisProtPlans.dc.html */
import { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';
import AegisTable from '../components/AegisTable';

const TPL = {
  'Business-critical': {
    d: '0',
    h: '0',
    m: '15',
    prio: 'Highest',
    versions: '2',
    every: '4',
    win: false,
    desc: 'Tier-1 databases, directory and mail.'
  },
  Important: { d: '0', h: '1', m: '0', prio: 'High', versions: '3', every: '6', win: false, desc: 'Line-of-business applications.' },
  'Non-critical': { d: '1', h: '0', m: '0', prio: 'Low', versions: '4', every: '1', win: true, desc: 'Web tier and internal tools.' },
  'Start from scratch': { d: '0', h: '4', m: '0', prio: 'Medium', versions: '2', every: '2', win: false, desc: '' }
};
const TPL_DESC = {
  'Business-critical': 'Every 15 min, 2 versions',
  Important: 'Every hour, 3 versions',
  'Non-critical': 'Daily, 4 versions',
  'Start from scratch': 'Set every value yourself'
};
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const STEPS = ['Name', 'Recovery target', 'Versions', 'Servers', 'Review'];
const blank = () => ({
  open: false,
  step: 0,
  tpl: 'Important',
  side: 'Primary',
  sq: '',
  picked: {},
  tried: false,
  f: { name: '', desc: TPL.Important.desc, ...TPL.Important, from: '22:00', to: '06:00', verOn: true }
});

export default class AegisProtPlans extends DC {
  state: any = { w: blank(), extra: [] };
  setF(k, v) {
    this.setState(s => ({ w: { ...s.w, f: { ...s.w.f, [k]: v } } }));
  }
  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    if (!A || !ctx)
      return { cols: [], rows: [], w: { steps: [], templates: [], target: [], prio: [], sides: [], servers: [], review: [] }, hours: [] };
    const s = this.state;
    const w = s.w;
    const f = w.f;
    const cfg = ctx.can('configure', 'Creating a protection plan');
    const plans = A.protPlans.concat(s.extra);
    const rows = plans.map(p => ({
      id: p.id,
      name: p.name,
      target: { v: `Every ${p.target}`, s: p.targetMin },
      versions: { v: `Keep ${p.versions}`, s: p.versions },
      every: { v: `Every ${p.every} ${p.every === 1 ? 'sync' : 'syncs'}`, s: p.every },
      priority: p.priority,
      window: p.window,
      servers: { v: String(p.servers), s: p.servers },
      comp: p.servers
        ? {
            t: 'status',
            i: p.compliance[0] === p.compliance[1] ? 'circle-check' : 'triangle-alert',
            c: p.compliance[0] === p.compliance[1] ? 'ok' : 'warn',
            l: `${p.compliance[0]} of ${p.compliance[1]} within target`,
            s: p.compliance[0] / p.compliance[1]
          }
        : { v: 'No servers yet', muted: true }
    }));
    const cols = [
      { k: 'name', label: 'Plan', w: 'minmax(160px,1.3fr)' },
      { k: 'target', label: 'Recovery target', w: '150px' },
      { k: 'versions', label: 'Versions', w: '100px' },
      { k: 'every', label: 'Version every', w: '130px', dim: true },
      { k: 'priority', label: 'Priority', w: '100px', dim: true },
      { k: 'window', label: 'Sync window', w: '140px', dim: true },
      { k: 'servers', label: 'Servers', w: '88px', r: true },
      { k: 'comp', label: 'Compliance', w: 'minmax(180px,1.3fr)' }
    ];
    const mins = (+f.d || 0) * 1440 + (+f.h || 0) * 60 + (+f.m || 0);
    const tgtLabel = [+f.d ? `${+f.d} d` : '', +f.h ? `${+f.h} h` : '', +f.m ? `${+f.m} min` : ''].filter(Boolean).join(' ') || '0 min';
    const nameErr = !f.name.trim()
      ? 'Enter a plan name.'
      : plans.some(p => p.name.toLowerCase() === f.name.trim().toLowerCase())
        ? `A plan named ${f.name.trim()} already exists.`
        : '';
    const verN = +f.versions;
    const verErr = f.verOn && (!(verN >= 1) || verN > 5) ? 'Keep between 1 and 5 versions.' : '';
    const canNext = [!nameErr, mins >= 5, !verErr, true, true][w.step];
    const why = [nameErr, 'The recovery target must be at least 5 min.', verErr, '', ''][w.step];
    const sw = on => ({
      tbg: on ? 'var(--acc)' : 'transparent',
      tbd: on ? 'var(--acc)' : 'var(--ln-2)',
      knob: on ? 'var(--acc-ink)' : 'var(--tx-3)',
      tx: on ? 'translateX(14px)' : 'none'
    });
    const winS = sw(f.win),
      verS = sw(f.verOn);
    const servers = A.drServers
      .filter(x => (w.side === 'Primary' ? x.pri : x.rec) && x.name.includes(w.sq.trim().toLowerCase()))
      .map(x => {
        const on = !!w.picked[x.id];
        return {
          name: x.name,
          site: w.side === 'Primary' ? x.pri : x.rec,
          plan: `Now in ${x.plan}`,
          on,
          bg: on ? 'var(--acc-soft)' : 'transparent',
          bd: on ? 'var(--acc)' : 'var(--ln-2)',
          cbg: on ? 'var(--acc)' : 'transparent',
          icon: on ? 'check' : '',
          onClick: () => this.setState(st => ({ w: { ...st.w, picked: { ...st.w.picked, [x.id]: !st.w.picked[x.id] } } }))
        };
      });
    const nPick = Object.values(w.picked).filter(Boolean).length;
    const finish = () => {
      const id = 'pp' + Date.now();
      this.setState(st => ({
        extra: st.extra.concat([
          {
            id,
            name: f.name.trim(),
            target: tgtLabel,
            targetMin: mins,
            versions: f.verOn ? verN : 0,
            every: +f.every || 1,
            priority: f.prio,
            window: f.win ? `${f.from} to ${f.to}` : 'Any time',
            servers: nPick,
            compliance: [nPick, nPick]
          }
        ]),
        w: blank()
      }));
      ctx.toast(`Protection plan ${f.name.trim()} created${nPick ? ` with ${nPick} servers` : ''}`, 'ok');
    };
    const wv = {
      sub: [
        'Name the plan and start from a template.',
        'How often a recovery point is taken, and when.',
        'Versions protect you from damage that has already been synced.',
        'Choose the servers this plan protects.',
        'Check the plan before you create it.'
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
      s5: w.step === 4,
      f,
      nameErr: w.tried ? nameErr : nameErr && f.name ? nameErr : '',
      nameBd: (w.tried || f.name) && nameErr ? 'var(--err)' : 'var(--ln)',
      templates: Object.keys(TPL).map(t => {
        const on = w.tpl === t;
        return {
          label: t,
          desc: TPL_DESC[t],
          on,
          bd: on ? 'var(--acc)' : 'var(--ln)',
          bg: on ? 'var(--acc-soft)' : 'var(--panel-2)',
          ring: on ? 'inset 0 0 0 1px var(--acc)' : 'none',
          onClick: () =>
            this.setState(st => ({
              w: {
                ...st.w,
                tpl: t,
                f: {
                  ...st.w.f,
                  ...TPL[t],
                  desc: st.w.f.desc && !Object.values(TPL).some(x => x.desc === st.w.f.desc) ? st.w.f.desc : TPL[t].desc
                }
              }
            }))
        };
      }),
      target: [
        ['d', 'days'],
        ['h', 'hours'],
        ['m', 'minutes']
      ].map(([k, unit]) => ({ unit, value: f[k], onInput: e => this.setF(k, e.target.value.replace(/\D/g, '')) })),
      prio: ['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(p => ({
        label: p,
        on: f.prio === p,
        fg: f.prio === p ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setF('prio', p)
      })),
      winOn: f.win,
      winTbg: winS.tbg,
      winTbd: winS.tbd,
      winKnob: winS.knob,
      winTx: winS.tx,
      explain1: `A recovery target of ${tgtLabel} means you lose at most ${tgtLabel} of changes if the primary site fails.`,
      explain2: f.win
        ? `Syncs run only between ${f.from} and ${f.to} IST. Outside that window the newest point gets older than the target.`
        : 'Without a window, syncs run whenever a server is due.',
      verOn: f.verOn,
      verTbg: verS.tbg,
      verTbd: verS.tbd,
      verKnob: verS.knob,
      verTx: verS.tx,
      verErr,
      verBd: verErr ? 'var(--err)' : 'var(--ln)',
      verLine:
        f.verOn && !verErr
          ? `With a ${tgtLabel} target, ${verN} versions every ${+f.every || 1} syncs reach back about ${Math.round((mins * (+f.every || 1) * verN) / 60)} h.`
          : '',
      sides: ['Primary', 'Recovery'].map(x => ({
        label: x,
        on: w.side === x,
        fg: w.side === x ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState(st => ({ w: { ...st.w, side: x } }))
      })),
      sq: w.sq,
      servers,
      pickLine: nPick ? `${nPick} selected. They move to this plan when it is created.` : 'Select servers, or skip and assign them later.',
      review: [
        ['Plan name', f.name],
        ['Template', w.tpl],
        ['Description', f.desc || '—'],
        ['Recovery target', `Every ${tgtLabel}`],
        ['Priority', f.prio],
        ['Sync window', f.win ? `${f.from} to ${f.to} IST` : 'Any time'],
        ['Versions', f.verOn ? `Keep ${verN}, one every ${+f.every || 1} syncs` : 'Off'],
        ['Servers', nPick ? `${nPick} selected` : 'None yet']
      ].map(([k, v]) => ({ k, v })),
      stepLabel: `Step ${w.step + 1} of 5`,
      canBack: w.step > 0,
      nextLabel: w.step === 4 ? 'Create plan' : 'Next',
      nextIcon: w.step === 4 ? '' : 'chevron-right',
      nextDis: canNext ? undefined : 'true',
      nextWhy: canNext ? undefined : why,
      nextOp: canNext ? 1 : 0.45
    };
    return {
      ui: ctx.ui,
      unit: ['plan', 'plans'],
      cols,
      rows,
      cfgDis: cfg.dis,
      cfgWhy: cfg.why,
      cfgOp: cfg.op,
      hours: HOURS,
      openWiz: () => {
        if (cfg.ok) this.setState({ w: { ...blank(), open: true } });
      },
      wOpen: w.open,
      w: wv,
      closeWiz: () => this.setState({ w: blank() }),
      setName: e => this.setF('name', e.target.value),
      setDesc: e => this.setF('desc', e.target.value),
      toggleWin: () => this.setF('win', !f.win),
      setFrom: e => this.setF('from', e.target.value),
      setTo: e => this.setF('to', e.target.value),
      toggleVer: () => this.setF('verOn', !f.verOn),
      setVersions: e => this.setF('versions', e.target.value.replace(/\D/g, '')),
      setEvery: e => this.setF('every', e.target.value.replace(/\D/g, '')),
      setSq: e => {
        const v = e.target.value;
        this.setState(st => ({ w: { ...st.w, sq: v } }));
      },
      back: () => this.setState(st => ({ w: { ...st.w, step: Math.max(0, st.w.step - 1) } })),
      skip: () => this.setState(st => ({ w: { ...st.w, picked: {}, step: 4 } })),
      next: () => {
        if (!canNext) {
          this.setState(st => ({ w: { ...st.w, tried: true } }));
          return;
        }
        if (w.step === 4) finish();
        else this.setState(st => ({ w: { ...st.w, step: st.w.step + 1 } }));
      }
    };
  }

  render() {
    const v = this.vals();
    return (
      <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
        <div style={{ flex: 'none', padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Disaster Recovery</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Protection plans</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>How often each server is synced and how many versions are kept.</p>
          </div>
          <button
            onClick={v.openWiz}
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
            Create a protection plan
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <AegisTable
              cols={v.cols}
              rows={v.rows}
              state={v.ui}
              label="Protection plans"
              unit={v.unit}
              emptyText="No protection plans yet. A plan sets how often servers are synced and how many versions are kept."
              emptyAction="Create a protection plan"
              onEmpty={v.openWiz}
              sort="name"
            />
          </div>
        </div>
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
              animation: 'ae-fade 120ms var(--ease)'
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="pp-title"
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
                  <h2 id="pp-title" style={{ font: '500 20px/28px var(--f-head)' }}>
                    Create a protection plan
                  </h2>
                  <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>{v.w?.sub}</p>
                </div>
                <button
                  onClick={v.closeWiz}
                  aria-label="Close"
                  style={{ width: '32px', height: '32px', display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}
                  className={pc('hover', 'background:var(--hover)')}
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
                  gridTemplateColumns: 'repeat(5,minmax(0,1fr))',
                  gap: '8px',
                  borderBottom: '1px solid var(--ln)'
                }}
              >
                {arr(v.w?.steps).map((ws: any, i: number) => (
                  <li key={i} aria-current={ws.current} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ height: '2px', background: ws.bar, transition: 'background-color 150ms' }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '12px/16px var(--f-ui)', color: ws.fg }}>
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
                          font: '700 11px var(--f-ui)'
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'ae-step 150ms var(--ease)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '400px' }}>
                      <label htmlFor="pp-name" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        Plan name
                      </label>
                      <input
                        id="pp-name"
                        value={v.w?.f?.name ?? ''}
                        onChange={v.setName}
                        style={{
                          height: '36px',
                          padding: '0 10px',
                          background: 'var(--panel-2)',
                          border: `1px solid ${v.w?.nameBd}`,
                          font: '14px var(--f-body)'
                        }}
                        className={pc('focus', 'border-color:var(--acc)')}
                      />
                      {v.w?.nameErr ? (
                        <span
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '12px/16px var(--f-ui)', color: 'var(--err)' }}
                        >
                          <Icon name="circle-alert" />
                          {v.w?.nameErr}
                        </span>
                      ) : null}
                    </div>
                    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend style={{ padding: 0, marginBottom: '8px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        Template
                      </legend>
                      <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px' }}>
                        {arr(v.w?.templates).map((t: any, i: number) => (
                          <button
                            key={i}
                            role="radio"
                            aria-checked={t.on}
                            onClick={t.onClick}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              minHeight: '96px',
                              padding: '12px',
                              border: `1px solid ${t.bd}`,
                              background: t.bg,
                              boxShadow: t.ring,
                              textAlign: 'left',
                              transition: 'border-color 100ms,background-color 100ms'
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{t.label}</span>
                            <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="pp-desc" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                        Description
                      </label>
                      <textarea
                        id="pp-desc"
                        onChange={v.setDesc}
                        value={v.w?.f?.desc ?? ''}
                        rows={3}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--panel-2)',
                          border: '1px solid var(--ln)',
                          font: '14px/20px var(--f-body)',
                          resize: 'vertical'
                        }}
                        className={pc('focus', 'border-color:var(--acc)')}
                      ></textarea>
                    </div>
                  </div>
                ) : null}
                {v.w?.s2 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) 240px',
                      gap: '20px',
                      animation: 'ae-step 150ms var(--ease)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                        <legend style={{ padding: 0, marginBottom: '8px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                          Recovery target — how often we take a recovery point
                        </legend>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {arr(v.w?.target).map((tg: any, i: number) => (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                value={tg.value ?? ''}
                                onChange={tg.onInput}
                                inputMode="numeric"
                                aria-label={tg.unit}
                                style={{
                                  width: '64px',
                                  height: '36px',
                                  padding: '0 10px',
                                  background: 'var(--panel-2)',
                                  border: '1px solid var(--ln)',
                                  font: '14px var(--f-body)',
                                  textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums'
                                }}
                                className={pc('focus', 'border-color:var(--acc)')}
                              />
                              <span style={{ font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>{tg.unit}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                        <legend style={{ padding: 0, marginBottom: '8px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                          Priority when several servers are due at the same time
                        </legend>
                        <Ind mode="fill" role="radiogroup" style={{ display: 'inline-flex', border: '1px solid var(--ln-2)' }}>
                          {arr(v.w?.prio).map((pr: any, i: number) => (
                            <button
                              key={i}
                              role="radio"
                              aria-checked={pr.on}
                              onClick={pr.onClick}
                              style={{
                                height: '30px',
                                padding: '0 12px',
                                font: '13px var(--f-ui)',
                                color: pr.fg,
                                transition: 'color 100ms'
                              }}
                            >
                              {pr.label}
                            </button>
                          ))}
                        </Ind>
                      </fieldset>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                          role="switch"
                          aria-checked={v.w?.winOn}
                          onClick={v.toggleWin}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <span
                            style={{
                              width: '32px',
                              height: '18px',
                              padding: '2px',
                              display: 'flex',
                              background: v.w?.winTbg,
                              border: `1px solid ${v.w?.winTbd}`,
                              transition: 'background-color 120ms'
                            }}
                          >
                            <span
                              style={{
                                width: '12px',
                                height: '12px',
                                background: v.w?.winKnob,
                                transform: v.w?.winTx,
                                transition: 'transform 120ms var(--ease)'
                              }}
                            />
                          </span>
                          Only sync during a set time window
                        </button>
                        {v.w?.winOn ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              paddingLeft: '42px',
                              font: '13px var(--f-ui)',
                              color: 'var(--tx-2)',
                              animation: 'ae-fade 150ms var(--ease)'
                            }}
                          >
                            From
                            <select
                              value={v.w?.f?.from ?? ''}
                              onChange={v.setFrom}
                              style={{
                                height: '32px',
                                padding: '0 6px',
                                background: 'var(--panel-2)',
                                border: '1px solid var(--ln)',
                                font: '13px var(--f-ui)'
                              }}
                            >
                              {arr(v.hours).map((h: any, i: number) => (
                                <option key={i} value={h ?? ''}>
                                  {h}
                                </option>
                              ))}
                            </select>
                            to
                            <select
                              value={v.w?.f?.to ?? ''}
                              onChange={v.setTo}
                              style={{
                                height: '32px',
                                padding: '0 6px',
                                background: 'var(--panel-2)',
                                border: '1px solid var(--ln)',
                                font: '13px var(--f-ui)'
                              }}
                            >
                              {arr(v.hours).map((h: any, i: number) => (
                                <option key={i} value={h ?? ''}>
                                  {h}
                                </option>
                              ))}
                            </select>
                            IST
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <aside
                      style={{
                        padding: '14px',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--ln)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontSize: '13px',
                        lineHeight: '18px',
                        color: 'var(--tx-2)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--tx)' }}>
                        <Icon name="info" />
                        What these settings mean
                      </span>
                      <span>{v.w?.explain1}</span>
                      <span>Priority decides who goes first when the recovery site is busy. Highest is synced before everything else.</span>
                      <span>{v.w?.explain2}</span>
                    </aside>
                  </div>
                ) : null}
                {v.w?.s3 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      maxWidth: '520px',
                      animation: 'ae-step 150ms var(--ease)'
                    }}
                  >
                    <button
                      role="switch"
                      aria-checked={v.w?.verOn}
                      onClick={v.toggleVer}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}
                    >
                      <span
                        style={{
                          width: '32px',
                          height: '18px',
                          padding: '2px',
                          display: 'flex',
                          background: v.w?.verTbg,
                          border: `1px solid ${v.w?.verTbd}`,
                          transition: 'background-color 120ms'
                        }}
                      >
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            background: v.w?.verKnob,
                            transform: v.w?.verTx,
                            transition: 'transform 120ms var(--ease)'
                          }}
                        />
                      </span>
                      Keep point-in-time versions you can roll back to
                    </button>
                    {v.w?.verOn ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                          gap: '16px',
                          animation: 'ae-fade 150ms var(--ease)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label htmlFor="pp-v" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                            Versions to keep (max 5)
                          </label>
                          <input
                            id="pp-v"
                            value={v.w?.f?.versions ?? ''}
                            onChange={v.setVersions}
                            inputMode="numeric"
                            style={{
                              height: '36px',
                              padding: '0 10px',
                              background: 'var(--panel-2)',
                              border: `1px solid ${v.w?.verBd}`,
                              font: '14px var(--f-body)',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                            className={pc('focus', 'border-color:var(--acc)')}
                          />
                          {v.w?.verErr ? <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--err)' }}>{v.w?.verErr}</span> : null}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label htmlFor="pp-e" style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>
                            Create a version every N syncs
                          </label>
                          <input
                            id="pp-e"
                            value={v.w?.f?.every ?? ''}
                            onChange={v.setEvery}
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
                        </div>
                      </div>
                    ) : null}
                    <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)', textWrap: 'pretty' }}>
                      If a server is corrupted or encrypted by ransomware, the newest recovery point copies the damage within one sync. A
                      version kept from before the damage is what you roll back to.
                    </p>
                    <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>{v.w?.verLine}</p>
                  </div>
                ) : null}
                {v.w?.s4 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'ae-step 150ms var(--ease)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Ind mode="fill" role="radiogroup" aria-label="Side" style={{ display: 'flex', border: '1px solid var(--ln-2)' }}>
                        {arr(v.w?.sides).map((sd: any, i: number) => (
                          <button
                            key={i}
                            role="radio"
                            aria-checked={sd.on}
                            onClick={sd.onClick}
                            style={{ height: '30px', padding: '0 12px', font: '13px var(--f-ui)', color: sd.fg }}
                          >
                            {sd.label}
                          </button>
                        ))}
                      </Ind>
                      <label
                        style={{
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0 4px 0 10px',
                          border: '1px solid var(--ln-2)',
                          font: '13px var(--f-ui)',
                          color: 'var(--tx-2)'
                        }}
                      >
                        Project
                        <select
                          style={{ height: '30px', border: 0, background: 'transparent', color: 'var(--tx)', font: '13px var(--f-ui)' }}
                        >
                          <option>Base-Project</option>
                          <option>Tenant-Kaveri</option>
                        </select>
                      </label>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Icon name="search" style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--tx-3)' }} />
                        <input
                          value={v.w?.sq ?? ''}
                          onChange={v.setSq}
                          placeholder="Search servers"
                          style={{
                            width: '100%',
                            height: '32px',
                            padding: '0 10px 0 34px',
                            background: 'var(--panel-2)',
                            border: '1px solid var(--ln)',
                            font: '13px var(--f-ui)'
                          }}
                          className={pc('focus', 'border-color:var(--acc)')}
                        />
                      </div>
                    </div>
                    <div style={{ border: '1px solid var(--ln)', maxHeight: '300px', overflow: 'auto' }}>
                      {arr(v.w?.servers).map((sv: any, i: number) => (
                        <button
                          key={i}
                          role="checkbox"
                          aria-checked={sv.on}
                          onClick={sv.onClick}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '16px minmax(0,1fr) minmax(0,1fr) auto',
                            gap: '12px',
                            alignItems: 'center',
                            width: '100%',
                            height: '40px',
                            padding: '0 12px',
                            borderBottom: '1px solid var(--ln)',
                            background: sv.bg,
                            transition: 'background-color 100ms'
                          }}
                          className={pc('hover', 'background:var(--hover)')}
                        >
                          <span
                            style={{
                              width: '16px',
                              height: '16px',
                              display: 'grid',
                              placeItems: 'center',
                              border: `1px solid ${sv.bd}`,
                              background: sv.cbg,
                              color: 'var(--acc-ink)'
                            }}
                          >
                            <Icon name={sv.icon} size="12" />
                          </span>
                          <span style={{ fontWeight: 600, textAlign: 'left' }}>{sv.name}</span>
                          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-2)', textAlign: 'left' }}>{sv.site}</span>
                          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{sv.plan}</span>
                        </button>
                      ))}
                    </div>
                    <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{v.w?.pickLine}</span>
                  </div>
                ) : null}
                {v.w?.s5 ? (
                  <dl
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '220px minmax(0,1fr)',
                      font: '13px/18px var(--f-ui)',
                      animation: 'ae-step 150ms var(--ease)'
                    }}
                  >
                    {arr(v.w?.review).map((rv: any, i: number) => (
                      <Fragment key={i}>
                        <dt style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{rv.k}</dt>
                        <dd style={{ padding: '9px 0', borderBottom: '1px solid var(--ln)' }}>{rv.v}</dd>
                      </Fragment>
                    ))}
                  </dl>
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
                  onClick={v.closeWiz}
                  style={{ height: '32px', padding: '0 12px', fontWeight: 600 }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  Cancel
                </button>
                {v.w?.s4 ? (
                  <button
                    onClick={v.skip}
                    style={{ height: '32px', padding: '0 12px', fontWeight: 600 }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    Skip for now
                  </button>
                ) : null}
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
                      fontWeight: 600
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
                    transition: 'background-color 100ms'
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
      </div>
    );
  }
}
