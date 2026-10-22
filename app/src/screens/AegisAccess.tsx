/* Ported from project/AegisAccess.dc.html */
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';
import AegisTable from '../components/AegisTable';

const EXS = {
  pending: ['clock', 'Pending approval', 'var(--warn)'],
  approved: ['circle-check', 'Approved · single use', 'var(--ok)'],
  used: ['check', 'Used', 'var(--tx-3)'],
  expired: ['circle-minus', 'Expired', 'var(--tx-3)'],
  rejected: ['ban', 'Rejected', 'var(--tx-3)']
};
const ROLES = ['Owner', 'Admin', 'Operator', 'Restore', 'Viewer'];
export default class AegisAccess extends DC {
  state: any = { tab: 'People', drawer: null, roles: {}, ex: {}, armed: null, dlg: null, extraPeople: [], extraEx: [] };
  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    if (!A || !ctx)
      return {
        tabs: [],
        tab: {},
        pcols: [],
        prows: [],
        projects: [],
        exc: [],
        p: { roles: [] },
        primary: {},
        roleOpts: [],
        dlg: { fields: [] }
      };
    const s = this.state;
    const adm = ctx.can('admin', 'Managing access');
    const rs = ctx.can('restore', 'Requesting a restore exception');
    const people = A.people.concat(s.extraPeople).map(p => ({ ...p, roles: s.roles[p.id] || p.roles }));
    const prows = people.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      roles: p.roles.map(([pj, r]) => `${pj} · ${r}`),
      mfa: {
        t: 'status',
        i: p.mfa ? 'circle-check' : 'triangle-alert',
        c: p.mfa ? 'ok' : 'warn',
        l: p.mfa ? 'On' : 'Off',
        s: p.mfa ? 1 : 0
      },
      last: { v: p.last.replace(' 2026', '').replace(' IST', ''), s: p.last }
    }));
    const pcols = [
      { k: 'name', label: 'Name', w: 'minmax(150px,1.2fr)' },
      { k: 'email', label: 'Email', w: 'minmax(200px,1.6fr)', dim: true },
      { k: 'roles', label: 'Roles', w: 'minmax(260px,2fr)', nosort: true },
      { k: 'mfa', label: 'Two-factor', w: '110px' },
      { k: 'last', label: 'Last sign-in (IST)', w: '150px', dim: true }
    ];
    const exList = A.exceptions
      .concat(s.extraEx)
      .map(e => ({ ...e, status: s.ex[e.id] ? s.ex[e.id].status : e.status, by: s.ex[e.id] ? s.ex[e.id].by : e.by }));
    const exc = exList.map(e => {
      const st = EXS[e.status];
      const own = e.who === 'Priya Raman';
      const ok = adm.ok && !own;
      const armed = s.armed === e.id;
      return {
        who: e.who,
        what: e.what,
        point: e.point.replace(' 2026', '').replace(' IST', ''),
        reason: e.reason,
        i: st[0],
        c: st[2],
        l: st[1],
        exp: e.status === 'pending' || e.status === 'approved' ? e.expires.replace(' 2026', '').replace(' IST', '') : '—',
        pending: e.status === 'pending',
        dis: ok ? undefined : 'true',
        why: !adm.ok ? adm.why : own ? 'You requested this. A different Owner or Admin must approve it.' : undefined,
        op: ok ? 1 : 0.45,
        aLabel: armed ? 'Confirm approval' : 'Approve',
        abg: armed ? 'var(--acc-p)' : 'var(--acc)',
        byLine:
          e.status === 'approved'
            ? `Approved by ${e.by}`
            : e.status === 'used'
              ? `Used ${e.used ? e.used.replace(' 2026', '').replace(' IST', '') : ''}`
              : e.status === 'rejected'
                ? `Rejected by ${e.by}`
                : e.status === 'expired'
                  ? 'Not used in 24 h'
                  : '',
        onApprove: () => {
          if (!ok) return;
          if (!armed) {
            this.setState({ armed: e.id });
            clearTimeout(this.at);
            this.at = setTimeout(() => this.setState({ armed: null }), 5000);
            return;
          }
          this.setState(st => ({ armed: null, ex: { ...st.ex, [e.id]: { status: 'approved', by: 'Priya Raman' } } }));
          ctx.toast(`Restore exception for ${e.who} approved. It can be used once until ${e.expires}.`, 'ok');
        },
        onReject: () => {
          if (!ok) return;
          this.setState(st => ({ ex: { ...st.ex, [e.id]: { status: 'rejected', by: 'Priya Raman' } } }));
          ctx.toast(`Restore exception for ${e.who} rejected`, 'ok');
        }
      };
    });
    const projects = A.projects.map(p => ({
      name: p.name,
      people: `${p.people} people`,
      sites: p.sites,
      repos: p.repos,
      noSites: !p.sites.length,
      noRepos: !p.repos.length,
      line: p.line || 'No recovery points yet',
      lc: p.line ? 'var(--tx)' : 'var(--tx-3)'
    }));
    const dp = s.drawer && people.find(x => x.id === s.drawer);
    const tabsDef = [
      ['People', people.length],
      ['Projects', A.projects.length],
      ['Restore exceptions', exList.filter(e => e.status === 'pending').length]
    ];
    const primary =
      s.tab === 'People'
        ? {
            label: 'Invite a person',
            ok: adm.ok,
            why: adm.why,
            run: () => this.setState({ dlg: { kind: 'invite', f: { email: '', project: 'Base-Project', role: 'Viewer' } } })
          }
        : s.tab === 'Projects'
          ? {
              label: 'Create a project',
              ok: adm.ok,
              why: adm.why,
              run: () => ctx.toast('Project Tenant-New created. Add its sites next.', 'ok')
            }
          : {
              label: 'Request a restore exception',
              ok: true,
              why: undefined,
              run: () => this.setState({ dlg: { kind: 'req', f: { guest: 'web-frontend-01', type: 'Files', reason: '' } } })
            };
    const G = s.dlg;
    const set = k => e => {
      const v = e.target.value;
      this.setState(st => ({ dlg: { ...st.dlg, f: { ...st.dlg.f, [k]: v } } }));
    };
    const dlg = !G
      ? { fields: [] }
      : G.kind === 'invite'
        ? {
            title: 'Invite a person',
            desc: 'They get an email with a sign-in link that works for 72 hours.',
            btn: 'Send invitation',
            fields: [
              { id: 'iv-e', label: 'Email', value: G.f.email, isInput: true, onChange: set('email') },
              {
                id: 'iv-p',
                label: 'Project',
                value: G.f.project,
                isSelect: true,
                options: A.projects.map(p => p.name),
                onChange: set('project')
              },
              { id: 'iv-r', label: 'Role', value: G.f.role, isSelect: true, options: ROLES, onChange: set('role') }
            ]
          }
        : {
            title: 'Request a restore exception',
            desc: 'A different Owner or Admin approves it. It can be used once and expires after 24 hours.',
            btn: 'Send request',
            fields: [
              { id: 'rq-g', label: 'Guest', value: G.f.guest, isSelect: true, options: A.guests.map(g => g.name), onChange: set('guest') },
              {
                id: 'rq-t',
                label: 'Restore',
                value: G.f.type,
                isSelect: true,
                options: ['Files', 'Disks', 'Whole VM'],
                onChange: set('type')
              },
              { id: 'rq-r', label: 'Reason', value: G.f.reason, isInput: true, onChange: set('reason') }
            ]
          };
    return {
      ui: ctx.ui,
      punit: ['person', 'people'],
      tabs: tabsDef.map(([t, n]) => ({
        label: t,
        n: String(n),
        on: s.tab === t,
        fg: s.tab === t ? 'var(--tx)' : 'var(--tx-2)',
        onClick: () => this.setState({ tab: t, drawer: null })
      })),
      tab: { people: s.tab === 'People', projects: s.tab === 'Projects', exc: s.tab === 'Restore exceptions' },
      primary: {
        label: primary.label,
        dis: primary.ok ? undefined : 'true',
        why: primary.why,
        op: primary.ok ? 1 : 0.45,
        onClick: () => {
          if (primary.ok) primary.run();
        }
      },
      pcols,
      prows,
      active: s.drawer || '',
      openPerson: id => this.setState({ drawer: id }),
      projects,
      exc,
      dOpen: !!dp,
      p: dp
        ? {
            name: dp.name,
            email: dp.email,
            last: dp.last,
            roles: dp.roles.map(([pj, r], i) => ({
              project: pj,
              role: r,
              opts: ROLES.map(x => ({ v: x, sel: x === r })),
              onChange: e => {
                if (!adm.ok) return;
                const v = e.target.value;
                this.setState(st => {
                  const cur = (st.roles[dp.id] || dp.roles).map(x => x.slice());
                  cur[i][1] = v;
                  return { roles: { ...st.roles, [dp.id]: cur } };
                });
              }
            }))
          }
        : { roles: [] },
      roleOpts: ROLES,
      admDis: adm.dis,
      admWhy: adm.why,
      admOp: adm.op,
      closeDrawer: () => this.setState({ drawer: null }),
      saveRoles: () => {
        if (adm.ok && dp) {
          this.setState({ drawer: null });
          ctx.toast(`Roles for ${dp.name} updated`, 'ok');
        }
      },
      dlgOpen: !!G,
      dlg,
      closeDlg: () => this.setState({ dlg: null }),
      confirmDlg: () => {
        if (G.kind === 'invite') {
          const email = G.f.email || 'new.person@host360.ai';
          this.setState(st => ({
            dlg: null,
            extraPeople: st.extraPeople.concat([
              {
                id: 'np' + Date.now(),
                name: email.split('@')[0],
                email,
                roles: [[G.f.project, G.f.role]],
                last: 'Invited, not signed in yet',
                mfa: false
              }
            ])
          }));
          ctx.toast(`Invitation sent to ${email}`, 'ok');
        } else {
          this.setState(st => ({
            dlg: null,
            extraEx: st.extraEx.concat([
              {
                id: 'nx' + Date.now(),
                who: 'Priya Raman',
                what: `${G.f.type} from ${G.f.guest}`,
                point: ctx.now(),
                reason: G.f.reason || 'No reason given',
                status: 'pending',
                requested: ctx.now(),
                expires: '22 Oct 2026, 16:05 IST'
              }
            ])
          }));
          ctx.toast(`Restore exception for ${G.f.guest} requested`, 'ok');
        }
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
        <div style={{ flex: 'none', padding: '20px 24px 0', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Administration</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Access</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>People, projects and one-time restore exceptions.</p>
          </div>
          <button
            onClick={v.primary?.onClick}
            aria-disabled={v.primary?.dis}
            data-tip={v.primary?.why}
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
              opacity: v.primary?.op,
              transition: 'background-color 100ms'
            }}
            className={pc('hover', 'background:var(--acc-h)')}
          >
            <Icon name="plus" />
            {v.primary?.label}
          </button>
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
              style={{
                height: '40px',
                padding: '0 12px',
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
        {v.tab?.people ? (
          <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AegisTable
                cols={v.pcols}
                rows={v.prows}
                onRow={v.openPerson}
                active={v.active}
                state={v.ui}
                label="People"
                unit={v.punit}
                sort="name"
              />
            </div>
          </div>
        ) : null}
        {v.tab?.projects ? (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: '0 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'ae-fade 150ms var(--ease)'
            }}
          >
            {arr(v.projects).map((pj: any, i: number) => (
              <section key={i} style={{ background: 'var(--panel)', border: '1px solid var(--ln)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--ln)' }}
                >
                  <Icon name="box" size="20" style={{ color: 'var(--tx-3)' }} />
                  <h2 style={{ flex: 1, font: '500 18px/24px var(--f-head)' }}>{pj.name}</h2>
                  <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{pj.people}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr)', font: '13px/18px var(--f-ui)' }}>
                  <span style={{ padding: '12px 16px', color: 'var(--tx-3)', borderBottom: '1px solid var(--ln)' }}>Sites</span>
                  <span
                    style={{
                      padding: '8px 16px 8px 0',
                      borderBottom: '1px solid var(--ln)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      alignItems: 'center'
                    }}
                  >
                    {arr(pj.sites).map((x: any, j: number) => (
                      <span
                        key={j}
                        style={{
                          height: '24px',
                          padding: '0 8px',
                          border: '1px solid var(--ln-2)',
                          lineHeight: '22px',
                          color: 'var(--tx-2)'
                        }}
                      >
                        {x}
                      </span>
                    ))}
                    {pj.noSites ? <span style={{ color: 'var(--tx-3)' }}>No sites yet</span> : null}
                  </span>
                  <span style={{ padding: '12px 16px', color: 'var(--tx-3)', borderBottom: '1px solid var(--ln)' }}>Repositories</span>
                  <span
                    style={{
                      padding: '8px 16px 8px 0',
                      borderBottom: '1px solid var(--ln)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      alignItems: 'center'
                    }}
                  >
                    {arr(pj.repos).map((x: any, j: number) => (
                      <span
                        key={j}
                        style={{
                          height: '24px',
                          padding: '0 8px',
                          border: '1px solid var(--ln-2)',
                          lineHeight: '22px',
                          color: 'var(--tx-2)'
                        }}
                      >
                        {x}
                      </span>
                    ))}
                    {pj.noRepos ? <span style={{ color: 'var(--tx-3)' }}>No repositories yet</span> : null}
                  </span>
                  <span style={{ padding: '12px 16px', color: 'var(--tx-3)' }}>Data reduction</span>
                  <span style={{ padding: '12px 16px 12px 0', fontVariantNumeric: 'tabular-nums', color: pj.lc }}>{pj.line}</span>
                </div>
              </section>
            ))}
          </div>
        ) : null}
        {v.tab?.exc ? (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: '0 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'ae-fade 150ms var(--ease)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--panel-2)',
                border: '1px solid var(--ln)',
                fontSize: '13px',
                lineHeight: '18px',
                color: 'var(--tx-2)'
              }}
            >
              <Icon name="info" style={{ marginTop: '1px' }} />
              <span>
                A restore exception lets one person restore something their role does not allow. One person requests it, a different Owner
                or Admin approves it, it can be used once, and it expires 24 hours after the request. Every step is written to Audit.
              </span>
            </div>
            <div
              role="table"
              aria-label="Restore exceptions"
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                background: 'var(--panel)',
                border: '1px solid var(--ln)',
                font: '13px/18px var(--f-ui)'
              }}
            >
              <div
                role="row"
                style={{
                  position: 'sticky',
                  top: 0,
                  display: 'grid',
                  gridTemplateColumns: '120px minmax(0,1.6fr) minmax(0,1.6fr) 190px 150px 220px',
                  gap: '12px',
                  alignItems: 'center',
                  height: '36px',
                  padding: '0 12px',
                  background: 'var(--panel-2)',
                  borderBottom: '1px solid var(--ln)',
                  fontSize: '12px',
                  color: 'var(--tx-2)'
                }}
              >
                <span>Requested by</span>
                <span>What</span>
                <span>Reason</span>
                <span>Status</span>
                <span>Expires (IST)</span>
                <span />
              </div>
              {arr(v.exc).map((e: any, i: number) => (
                <div
                  key={i}
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px minmax(0,1.6fr) minmax(0,1.6fr) 190px 150px 220px',
                    gap: '12px',
                    alignItems: 'center',
                    minHeight: '52px',
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--ln)',
                    animation: 'ae-fade 150ms var(--ease)'
                  }}
                >
                  <span>{e.who}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.what}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--tx-3)' }}>
                      Point <span>{e.point}</span>
                    </span>
                  </span>
                  <span
                    data-tip={e.reason}
                    style={{ color: 'var(--tx-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {e.reason}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name={e.i} style={{ color: e.c }} />
                    <span>{e.l}</span>
                  </span>
                  <span style={{ color: 'var(--tx-2)' }}>{e.exp}</span>
                  <span style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    {e.pending ? (
                      <>
                        <button
                          onClick={e.onReject}
                          aria-disabled={e.dis}
                          data-tip={e.why}
                          style={{
                            height: '28px',
                            padding: '0 10px',
                            border: '1px solid var(--ln-2)',
                            font: '600 13px var(--f-body)',
                            opacity: e.op
                          }}
                          className={pc('hover', 'background:var(--hover)')}
                        >
                          Reject
                        </button>
                        <button
                          onClick={e.onApprove}
                          aria-disabled={e.dis}
                          data-tip={e.why}
                          style={{
                            height: '28px',
                            padding: '0 10px',
                            background: e.abg,
                            color: 'var(--acc-ink)',
                            font: '600 13px var(--f-body)',
                            opacity: e.op,
                            transition: 'background-color 120ms'
                          }}
                        >
                          {e.aLabel}
                        </button>
                      </>
                    ) : null}
                    {e.byLine ? <span style={{ fontSize: '12px', color: 'var(--tx-3)' }}>{e.byLine}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {v.dOpen ? (
          <aside
            role="dialog"
            aria-label="Person"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '520px',
              maxWidth: '100%',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--overlay)',
              borderLeft: '1px solid var(--ln-2)',
              boxShadow: 'var(--sh-over)',
              animation: 'ae-drawer 150ms var(--ease)'
            }}
          >
            <div style={{ padding: '20px 16px 16px 24px', display: 'flex', gap: '12px', borderBottom: '1px solid var(--ln)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Person</div>
                <h2 style={{ marginTop: '2px', font: '500 20px/28px var(--f-head)' }}>{v.p?.name}</h2>
                <div style={{ marginTop: '4px', font: '13px var(--f-ui)', color: 'var(--tx-2)' }}>
                  <span>{v.p?.email}</span> · last sign-in <span>{v.p?.last}</span>
                </div>
              </div>
              <button
                onClick={v.closeDrawer}
                aria-label="Close"
                style={{ width: '32px', height: '32px', display: 'grid', placeItems: 'center', color: 'var(--tx-2)' }}
                className={pc('hover', 'background:var(--hover)')}
              >
                <Icon name="x" size="20" />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ font: '600 15px/22px var(--f-body)' }}>Roles in each project</h3>
              {arr(v.p?.roles).map((r: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) 160px',
                    gap: '12px',
                    alignItems: 'center',
                    minHeight: '40px',
                    borderBottom: '1px solid var(--ln)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="box" style={{ color: 'var(--tx-3)' }} />
                    {r.project}
                  </span>
                  <select
                    onChange={r.onChange}
                    aria-label={`Role in ${r.project ?? ''}`}
                    style={{
                      height: '32px',
                      padding: '0 8px',
                      background: 'var(--panel-2)',
                      border: '1px solid var(--ln)',
                      font: '14px var(--f-body)'
                    }}
                  >
                    {arr(r.opts).map((o: any, j: number) => (
                      <option key={j} value={o.v ?? ''} selected={o.sel}>
                        {o.v}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <p style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
                Owner and Admin can change everything. Operator runs jobs. Restore can only restore. Viewer can only look.
              </p>
            </div>
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--ln)' }}
            >
              <button
                onClick={v.closeDrawer}
                style={{ height: '32px', padding: '0 12px', fontWeight: 600 }}
                className={pc('hover', 'background:var(--hover)')}
              >
                Cancel
              </button>
              <button
                onClick={v.saveRoles}
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
                Save roles
              </button>
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
              animation: 'ae-fade 120ms var(--ease)'
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ac-title"
              style={{
                width: '440px',
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
                <h2 id="ac-title" style={{ font: '500 20px/28px var(--f-head)' }}>
                  {v.dlg?.title}
                </h2>
                <p style={{ marginTop: '4px', color: 'var(--tx-2)' }}>{v.dlg?.desc}</p>
              </div>
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {arr(v.dlg?.fields).map((f: any, i: number) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                  </div>
                ))}
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--ln)' }}
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
                  style={{ height: '32px', padding: '0 14px', background: 'var(--acc)', color: 'var(--acc-ink)', fontWeight: 600 }}
                  className={pc('hover', 'background:var(--acc-h)')}
                >
                  {v.dlg?.btn}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
