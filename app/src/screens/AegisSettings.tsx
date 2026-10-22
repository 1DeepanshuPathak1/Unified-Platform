/* Ported from project/AegisSettings.dc.html */
import { Fragment } from 'react';
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';

export default class AegisSettings extends DC {
  state: any = { tab: 'Notifications', mail: null, mailTest: null, ch: {}, tun: {}, cfgFile: false, selfJob: null };
  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    if (!A || !ctx) return { tabs: [], tab: {}, mail: [], channels: [], tun: [], sb: { facts: [] }, lic: { use: [] } };
    const s = this.state;
    const S = A.settings;
    const adm = ctx.can('admin', 'Changing settings');
    const op = ctx.can('operate', 'Backing up Aegis');
    const m = s.mail || { ...S.mail, pw: '••••••••' };
    const setM = k => e => {
      const v = e.target.value;
      this.setState(st => ({ mail: { ...(st.mail || { ...S.mail, pw: '••••••••' }), [k]: v } }));
    };
    const MF = (k, label, span, extra?) => ({
      id: 'ml-' + k,
      label,
      span,
      value: m[k],
      isInput: true,
      type: 'text',
      onChange: setM(k),
      ...(extra || {})
    });
    const sw = on => ({
      tbg: on ? 'var(--acc)' : 'transparent',
      tbd: on ? 'var(--acc)' : 'var(--ln-2)',
      knob: on ? 'var(--acc-ink)' : 'var(--tx-3)',
      tx: on ? 'translateX(16px)' : 'none'
    });
    const job = s.selfJob && ctx.jobs.find(j => j.id === s.selfJob);
    const sbRun = job && job.status === 'run';
    return {
      tabs: ['Notifications', 'Aegis backup', 'Tunables', 'Licence'].map(t => ({
        label: t,
        on: s.tab === t,
        fg: s.tab === t ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState({ tab: t })
      })),
      tab: { notif: s.tab === 'Notifications', self: s.tab === 'Aegis backup', tun: s.tab === 'Tunables', lic: s.tab === 'Licence' },
      admDis: adm.dis,
      admWhy: adm.why,
      admOp: adm.op,
      opDis: op.dis,
      opWhy: op.why,
      opOp: op.op,
      mail: [
        MF('host', 'Server', 3),
        MF('port', 'Port', 1),
        {
          id: 'ml-sec',
          label: 'Security',
          span: 2,
          value: m.security,
          isSelect: true,
          options: ['STARTTLS', 'SSL/TLS', 'None'],
          onChange: setM('security')
        },
        MF('from', 'From address', 2),
        MF('user', 'Username', 2),
        MF('pw', 'Password', 2, { type: 'password' })
      ],
      mailI: s.mailTest === 'run' ? 'loader-circle' : 'circle-check',
      mailSpin: s.mailTest === 'run' ? 'true' : 'false',
      mailC: s.mailTest === 'run' ? 'var(--run)' : 'var(--ok)',
      mailState:
        s.mailTest === 'run'
          ? 'Sending a test email…'
          : s.mailTest === 'ok'
            ? `Test email delivered at ${ctx.now()}`
            : 'Last delivery 21 Oct 2026, 15:53 IST',
      testMail: () => {
        this.setState({ mailTest: 'run' });
        setTimeout(() => {
          this.setState({ mailTest: 'ok' });
          ctx.toast('Test email sent to priya.raman@host360.ai', 'ok');
        }, 1200);
      },
      saveMail: () => {
        if (adm.ok) ctx.toast(`Mail server ${m.host} saved`, 'ok');
      },
      addChannel: () => {
        if (adm.ok) ctx.toast('Choose Email recipients, Teams channel or Webhook to add a channel', 'info');
      },
      channels: S.channels.map(c => {
        const o = s.ch[c.id] || {};
        const on = o.on != null ? o.on : c.on;
        return {
          kind: c.kind,
          icon: c.kind.startsWith('Email') ? 'mail' : 'message-square',
          target: c.target,
          events: c.events,
          sev: o.sev || c.sev,
          on,
          ...sw(on),
          onSev: e => {
            const v = e.target.value;
            this.setState(st => ({ ch: { ...st.ch, [c.id]: { ...(st.ch[c.id] || {}), sev: v } } }));
            ctx.toast(`${c.kind}: minimum severity set to ${v}`, 'ok');
          },
          onToggle: () => {
            if (!adm.ok) return;
            this.setState(st => ({ ch: { ...st.ch, [c.id]: { ...(st.ch[c.id] || {}), on: !on } } }));
            ctx.toast(`${c.kind} turned ${on ? 'off' : 'on'}`, 'ok');
          }
        };
      }),
      sb: {
        i: sbRun ? 'loader-circle' : 'circle-check',
        spin: sbRun ? 'true' : 'false',
        c: sbRun ? 'var(--run)' : 'var(--ok)',
        title: sbRun ? `Backing up configuration · ${Math.floor(job.pct)} %` : 'Last configuration backup succeeded',
        sub: sbRun ? job.phases[job.phase] : job ? `Finished ${ctx.now()}` : `${S.selfBackup.last} · ${S.selfBackup.size}`,
        facts: [
          { k: 'Schedule', v: S.selfBackup.schedule, i: '' },
          { k: 'Repository', v: S.selfBackup.repo, i: 'lock' },
          { k: 'Keep', v: `${S.selfBackup.keep} backups`, i: '' },
          { k: 'Encryption', v: 'AES-256, separate passphrase', i: 'shield' },
          { k: 'Includes', v: 'Sites, access, repositories, policies, plans, mappings, people and settings', i: '' }
        ]
      },
      backupSelf: () => {
        if (!op.ok) return;
        const id = ctx.startJob({
          name: 'Aegis configuration',
          object: 'aegis-orchestrator',
          product: 'Backup',
          type: 'Configuration backup',
          phases: ['Export', 'Encrypt', 'Write', 'Done'],
          speed: 30,
          doneToast: 'Aegis configuration backed up to obj-check'
        });
        this.setState({ selfJob: id });
      },
      noCfgFile: !s.cfgFile,
      hasCfgFile: s.cfgFile,
      pickCfg: () => this.setState({ cfgFile: true }),
      removeCfg: () => this.setState({ cfgFile: false }),
      tun: S.tunables.map(([name, val, def, unit]) => {
        const v = s.tun[name] != null ? s.tun[name] : val;
        const changed = v !== def;
        return {
          name,
          value: v,
          def,
          unit,
          changed,
          bg: changed ? 'var(--acc-soft)' : 'transparent',
          onInput: e => {
            const x = e.target.value.replace(/[^\d]/g, '');
            this.setState(st => ({ tun: { ...st.tun, [name]: x } }));
          }
        };
      }),
      resetTun: () => {
        this.setState({ tun: Object.fromEntries(S.tunables.map(t => [t[0], t[2]])) });
        ctx.toast('Tunables reset to defaults. Save to apply.', 'info');
      },
      saveTun: () => {
        if (adm.ok) ctx.toast('Tunables saved. Running jobs keep their old values.', 'ok');
      },
      lic: {
        edition: S.licence.edition,
        holder: S.licence.holder,
        key: S.licence.key,
        exp: `${S.licence.expires} · ${S.licence.days} days left`,
        use: [
          ['Proxmox VE sockets', S.licence.sockets],
          ['OpenStack instances', S.licence.instances],
          ['Migration VMs', S.licence.mig]
        ].map(([label, [a, b]]) => ({
          label,
          v: `${a} of ${b}`,
          pct: `${(a / b) * 100}%`,
          c: a / b > 0.85 ? 'var(--warn)' : 'var(--tx-3)'
        }))
      },
      uploadLic: () => {
        if (adm.ok) ctx.toast('Choose a .lic file from Host360 to update the licence', 'info');
      }
    };
  }

  render() {
    const v = this.vals();
    return (
      <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
        <div style={{ flex: 'none', padding: '20px 24px 0' }}>
          <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Administration</div>
          <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Settings</h1>
          <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>Notifications, Aegis’s own backup, tunables and licence.</p>
        </div>
        <Ind
          mode="underline"
          role="tablist"
          style={{ flex: 'none', display: 'flex', margin: '12px 24px 16px', borderBottom: '1px solid var(--ln)' }}
        >
          {arr(v.tabs).map((t: any, i: number) => (
            <button
              key={i}
              role="tab"
              aria-selected={t.on}
              onClick={t.onClick}
              style={{ height: '40px', padding: '0 12px', fontWeight: 600, color: t.fg, transition: 'color 100ms' }}
              className={pc('hover', 'color:var(--tx)')}
            >
              {t.label}
            </button>
          ))}
        </Ind>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
          {v.tab?.notif ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '960px', animation: 'ae-fade 150ms var(--ease)' }}
            >
              <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '48px',
                    padding: '0 16px',
                    borderBottom: '1px solid var(--ln)'
                  }}
                >
                  <h2 style={{ font: '600 15px/22px var(--f-body)' }}>Mail server</h2>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '12px var(--f-ui)', color: 'var(--tx-2)' }}>
                    <Icon name={v.mailI} spin={v.mailSpin} style={{ color: v.mailC }} />
                    {v.mailState}
                  </span>
                </div>
                <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: '16px' }}>
                  {arr(v.mail).map((f: any, i: number) => (
                    <div key={i} style={{ gridColumn: `span ${f.span}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                          type={f.type}
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
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--ln)' }}>
                  <button
                    onClick={v.testMail}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid var(--ln-2)',
                      fontWeight: 600
                    }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    <Icon name="send" />
                    Send test email
                  </button>
                  <span style={{ flex: 1 }} />
                  <button
                    onClick={v.saveMail}
                    aria-disabled={v.admDis}
                    data-tip={v.admWhy}
                    style={{
                      height: '32px',
                      padding: '0 14px',
                      background: 'var(--acc)',
                      color: 'var(--acc-ink)',
                      fontWeight: 600,
                      opacity: v.admOp
                    }}
                    className={pc('hover', 'background:var(--acc-h)')}
                  >
                    Save mail server
                  </button>
                </div>
              </section>
              <section style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '48px',
                    padding: '0 16px',
                    borderBottom: '1px solid var(--ln)'
                  }}
                >
                  <h2 style={{ font: '600 15px/22px var(--f-body)' }}>Channels</h2>
                  <button
                    onClick={v.addChannel}
                    aria-disabled={v.admDis}
                    data-tip={v.admWhy}
                    style={{
                      height: '30px',
                      padding: '0 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      font: '600 13px var(--f-body)',
                      color: 'var(--acc-tx)',
                      opacity: v.admOp
                    }}
                    className={pc('hover', 'background:var(--hover)')}
                  >
                    <Icon name="plus" />
                    Add channel
                  </button>
                </div>
                {arr(v.channels).map((c: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px minmax(0,1fr) 170px 64px',
                      gap: '12px',
                      alignItems: 'start',
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--ln)'
                    }}
                  >
                    <Icon name={c.icon} style={{ color: 'var(--tx-2)', marginTop: '2px' }} />
                    <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{c.kind}</span>
                      <span style={{ font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>{c.target}</span>
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {arr(c.events).map((ev: any, j: number) => (
                          <span
                            key={j}
                            style={{
                              height: '22px',
                              padding: '0 8px',
                              border: '1px solid var(--ln-2)',
                              font: '12px/20px var(--f-ui)',
                              color: 'var(--tx-2)'
                            }}
                          >
                            {ev}
                          </span>
                        ))}
                      </span>
                    </span>
                    <label
                      style={{ display: 'flex', flexDirection: 'column', gap: '6px', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}
                    >
                      Minimum severity
                      <select
                        value={c.sev ?? ''}
                        onChange={c.onSev}
                        style={{
                          height: '32px',
                          padding: '0 8px',
                          background: 'var(--panel-2)',
                          border: '1px solid var(--ln)',
                          font: '14px var(--f-body)',
                          color: 'var(--tx)'
                        }}
                      >
                        <option>Info</option>
                        <option>Warning</option>
                        <option>Critical</option>
                      </select>
                    </label>
                    <button
                      role="switch"
                      aria-checked={c.on}
                      aria-label="Channel on"
                      onClick={c.onToggle}
                      style={{
                        marginTop: '22px',
                        width: '36px',
                        height: '20px',
                        padding: '2px',
                        display: 'flex',
                        background: c.tbg,
                        border: `1px solid ${c.tbd}`,
                        transition: 'background-color 120ms'
                      }}
                    >
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          background: c.knob,
                          transform: c.tx,
                          transition: 'transform 120ms var(--ease)'
                        }}
                      />
                    </button>
                  </div>
                ))}
              </section>
            </div>
          ) : null}
          {v.tab?.self ? (
            <section
              style={{
                maxWidth: '760px',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                animation: 'ae-fade 150ms var(--ease)'
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--ln)' }}
              >
                <Icon name={v.sb?.i} spin={v.sb?.spin} style={{ color: v.sb?.c }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{v.sb?.title}</span>
                  <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-2)' }}>{v.sb?.sub}</span>
                </span>
                <button
                  onClick={v.backupSelf}
                  aria-disabled={v.opDis}
                  data-tip={v.opWhy}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    background: 'var(--acc)',
                    color: 'var(--acc-ink)',
                    fontWeight: 600,
                    opacity: v.opOp
                  }}
                  className={pc('hover', 'background:var(--acc-h)')}
                >
                  Back up now
                </button>
              </div>
              <dl style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', padding: '0 16px', font: '13px/18px var(--f-ui)' }}>
                {arr(v.sb?.facts).map((f: any, i: number) => (
                  <Fragment key={i}>
                    <dt style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)', color: 'var(--tx-3)' }}>{f.k}</dt>
                    <dd
                      style={{ padding: '10px 0', borderBottom: '1px solid var(--ln)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Icon name={f.i} style={{ color: 'var(--tx-2)' }} />
                      {f.v}
                    </dd>
                  </Fragment>
                ))}
              </dl>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ font: '600 14px/20px var(--f-body)' }}>Restore configuration</h3>
                <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
                  Use this on a new orchestrator after a loss. Sites, repositories, policies, plans and people come back; recovery points
                  stay in their repositories.
                </p>
                {v.noCfgFile ? (
                  <button
                    onClick={v.pickCfg}
                    style={{
                      height: '88px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: '1px dashed var(--ln-2)',
                      color: 'var(--tx-2)'
                    }}
                    className={pc('hover', 'border-color:var(--acc);background:var(--hover)')}
                  >
                    <Icon name="upload" size="20" />
                    <span>
                      <strong style={{ color: 'var(--tx)', fontWeight: 600 }}>Choose a configuration backup</strong> or drop it here
                    </span>
                  </button>
                ) : null}
                {v.hasCfgFile ? (
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
                    <Icon name="file" size="20" style={{ color: 'var(--tx-2)' }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>aegis-config-2026-10-21T0100.aeg</span>
                      <span style={{ display: 'block', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
                        48.20 MB · encrypted · made by aegis-orchestrator 4.2.0
                      </span>
                    </span>
                    <button
                      onClick={v.removeCfg}
                      aria-label="Remove file"
                      style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', color: 'var(--tx-3)' }}
                      className={pc('hover', 'background:var(--hover)')}
                    >
                      <Icon name="x" />
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
          {v.tab?.tun ? (
            <section
              style={{
                maxWidth: '880px',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                animation: 'ae-fade 150ms var(--ease)'
              }}
            >
              <div role="table" style={{ font: '13px/18px var(--f-ui)' }}>
                <div
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1.6fr) 120px 96px minmax(0,1.2fr)',
                    gap: '12px',
                    alignItems: 'center',
                    height: '36px',
                    padding: '0 16px',
                    background: 'var(--panel-2)',
                    borderBottom: '1px solid var(--ln)',
                    fontSize: '12px',
                    color: 'var(--tx-2)'
                  }}
                >
                  <span>Tunable</span>
                  <span style={{ textAlign: 'right' }}>Value</span>
                  <span style={{ textAlign: 'right' }}>Default</span>
                  <span>Unit</span>
                </div>
                {arr(v.tun).map((t: any, i: number) => (
                  <div
                    key={i}
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.6fr) 120px 96px minmax(0,1.2fr)',
                      gap: '12px',
                      alignItems: 'center',
                      minHeight: '44px',
                      padding: '0 16px',
                      borderBottom: '1px solid var(--ln)',
                      background: t.bg,
                      transition: 'background-color 150ms'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {t.name}
                      {t.changed ? <span style={{ fontSize: '11px', color: 'var(--acc-tx)' }}>Changed</span> : null}
                    </span>
                    <input
                      value={t.value ?? ''}
                      onChange={t.onInput}
                      aria-label={t.name}
                      inputMode="numeric"
                      style={{
                        height: '32px',
                        padding: '0 8px',
                        textAlign: 'right',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--ln)',
                        font: '13px var(--f-ui)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                      className={pc('focus', 'border-color:var(--acc)')}
                    />
                    <span style={{ textAlign: 'right', color: 'var(--tx-3)', fontVariantNumeric: 'tabular-nums' }}>{t.def}</span>
                    <span style={{ color: 'var(--tx-2)' }}>{t.unit}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '12px 16px' }}>
                <button
                  onClick={v.resetTun}
                  style={{ height: '32px', padding: '0 12px', border: '1px solid var(--ln-2)', fontWeight: 600 }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  Reset to defaults
                </button>
                <span style={{ flex: 1 }} />
                <button
                  onClick={v.saveTun}
                  aria-disabled={v.admDis}
                  data-tip={v.admWhy}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    background: 'var(--acc)',
                    color: 'var(--acc-ink)',
                    fontWeight: 600,
                    opacity: v.admOp
                  }}
                  className={pc('hover', 'background:var(--acc-h)')}
                >
                  Save tunables
                </button>
              </div>
            </section>
          ) : null}
          {v.tab?.lic ? (
            <section
              style={{
                maxWidth: '760px',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                animation: 'ae-fade 150ms var(--ease)'
              }}
            >
              <div style={{ padding: '16px', borderBottom: '1px solid var(--ln)' }}>
                <h2 style={{ font: '500 18px/24px var(--f-head)' }}>{v.lic?.edition}</h2>
                <p style={{ marginTop: '2px', font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>
                  Licensed to <span>{v.lic?.holder}</span> · key <span>{v.lic?.key}</span>
                </p>
              </div>
              <div style={{ padding: '8px 16px' }}>
                {arr(v.lic?.use).map((u: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '200px minmax(0,1fr) 120px',
                      gap: '16px',
                      alignItems: 'center',
                      minHeight: '44px',
                      borderBottom: '1px solid var(--ln)',
                      font: '13px var(--f-ui)'
                    }}
                  >
                    <span style={{ color: 'var(--tx-2)' }}>{u.label}</span>
                    <span style={{ height: '6px', background: 'var(--ln)' }}>
                      <span style={{ display: 'block', height: '6px', width: u.pct, background: u.c }} />
                    </span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.v}</span>
                  </div>
                ))}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px minmax(0,1fr)',
                    gap: '16px',
                    alignItems: 'center',
                    minHeight: '44px',
                    font: '13px var(--f-ui)'
                  }}
                >
                  <span style={{ color: 'var(--tx-2)' }}>Expires</span>
                  <span>{v.lic?.exp}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--ln)' }}>
                <button
                  onClick={v.uploadLic}
                  aria-disabled={v.admDis}
                  data-tip={v.admWhy}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid var(--ln-2)',
                    fontWeight: 600,
                    opacity: v.admOp
                  }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  <Icon name="upload" />
                  Upload licence file
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    );
  }
}
