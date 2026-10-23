/* Ported from project/AegisMappings.dc.html */
import { DC, arr } from '../lib/dc';
import { pc } from '../lib/pseudo';
import { Icon } from '../lib/Icon';
import { Ind } from '../lib/Ind';
import { AEGIS } from '../data/aegis';

const OPTS = {
  'production-openstack': {
    net: ['prod-net', 'app-net', 'mgmt-net', 'dr-test-isolated'],
    stor: ['ceph-ssd', 'standard'],
    size: ['m1.medium', 'm1.large', 'm1.xlarge', 'm1.2xlarge', 'm1.4xlarge']
  },
  'Chennai-proxmox-prod': {
    net: ['vmbr0 (VLAN 10)', 'vmbr20 (VLAN 20)', 'vmbr1', 'vmbr99 (VLAN 99, isolated)'],
    stor: ['ceph-vm', 'local-lvm'],
    size: ['Cores and memory copied 1:1']
  }
};
const ICON = {
  'Recovery plan': 'list-ordered',
  'Protection plan': 'calendar-clock',
  Migration: 'forward',
  'Migration plan': 'route',
  'Protected server': 'server'
};
const HREF = {
  'Recovery plan': '#/dr/recovery',
  'Protection plan': '#/dr/plans',
  Migration: '#/mig/servers',
  'Migration plan': '#/mig/plans',
  'Protected server': '#/dr/servers'
};
export default class AegisMappings extends DC {
  state: any = { sel: 'm1', ed: {} };
  renderVals() {
    const A = AEGIS;
    const ctx = this.props.ctx;
    if (!A || !ctx) return { pairs: [], m: { groups: [], used: [] } };
    const s = this.state;
    const cfg = ctx.can('configure', 'Editing a mapping');
    const mp = A.mappings.find(x => x.id === s.sel);
    const o = OPTS[mp.to];
    const grp = (key, title, rows, opts) => ({
      title,
      rows: rows.map(([a, b], i) => {
        const k = `${mp.id}.${key}.${i}`;
        const v = s.ed[k] || b;
        return {
          a,
          b: v,
          options: (opts.includes(v) ? opts : [v].concat(opts)).map(x => ({ v: x, sel: x === v })),
          onChange: e => {
            if (!cfg.ok) return;
            const val = e.target.value;
            this.setState(st => ({ ed: { ...st.ed, [k]: val } }));
          }
        };
      })
    });
    return {
      cfgDis: cfg.dis,
      cfgWhy: cfg.why,
      cfgOp: cfg.op,
      addMap: () => {
        if (cfg.ok) ctx.toast('Choose a source and a destination site to start a mapping', 'info');
      },
      pairs: A.mappings.map(x => ({
        from: x.from,
        to: x.to,
        kind: x.kind,
        n: `${x.usedBy.length}`,
        current: x.id === s.sel ? 'page' : undefined,
        bg: x.id === s.sel ? 'var(--acc-soft)' : 'transparent',
        onClick: () => this.setState({ sel: x.id })
      })),
      m: {
        title: `${mp.from} → ${mp.to}`,
        from: mp.from,
        to: mp.to,
        test: mp.test,
        groups: [
          grp('n', 'Networks', mp.nets, o.net),
          grp('s', mp.to.includes('openstack') ? 'Volume types' : 'Storages', mp.stor, o.stor),
          grp('z', mp.to.includes('openstack') ? 'Flavors' : 'Cores and memory', mp.sizes, o.size)
        ],
        used: mp.usedBy.map(([kind, name]) => ({ kind, name, i: ICON[kind], href: HREF[kind] }))
      },
      save: () => {
        if (cfg.ok) ctx.toast(`Mapping ${mp.from} → ${mp.to} saved`, 'ok');
      }
    };
  }

  render() {
    const v = this.vals();
    return (
      <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'ae-page 150ms var(--ease)' }}>
        <div style={{ flex: 'none', padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)', marginBottom: '4px' }}>Infrastructure</div>
            <h1 style={{ font: '500 24px/32px var(--f-head)' }}>Mappings</h1>
            <p style={{ marginTop: '2px', color: 'var(--tx-2)' }}>How networks, storage and sizes translate from one site to another.</p>
          </div>
          <button
            onClick={v.addMap}
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
              opacity: v.cfgOp
            }}
            className={pc('hover', 'background:var(--acc-h)')}
          >
            <Icon name="plus" />
            Add a mapping
          </button>
        </div>
        {this.props.tabs}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: '0 24px 24px',
            display: 'grid',
            gridTemplateColumns: '320px minmax(0,1fr)',
            gap: '16px'
          }}
        >
          <nav aria-label="Site pairs" style={{ overflow: 'auto', background: 'var(--panel)', border: '1px solid var(--ln)' }}>
            <Ind mode="rail" style={{ display: 'flex', flexDirection: 'column' }}>
              {arr(v.pairs).map((p: any, i: number) => (
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, flexWrap: 'wrap' }}>
                    {p.from}
                    <Icon name="arrow-right" style={{ color: 'var(--tx-3)' }} />
                    {p.to}
                  </span>
                  <span style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>
                    <span>{p.kind}</span> · used by <span>{p.n}</span>
                  </span>
                </button>
              ))}
            </Ind>
          </nav>
          <section
            style={{
              minHeight: 0,
              overflow: 'auto',
              background: 'var(--panel)',
              border: '1px solid var(--ln)',
              animation: 'ae-fade 150ms var(--ease)'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ln)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ flex: 1, font: '500 20px/28px var(--f-head)' }}>{v.m?.title}</h2>
              <button
                onClick={v.save}
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
                Save mapping
              </button>
            </div>
            {arr(v.m?.groups).map((g: any, i: number) => (
              <div key={i} style={{ padding: '16px 20px', borderBottom: '1px solid var(--ln)' }}>
                <h3 style={{ font: '600 15px/22px var(--f-body)', marginBottom: '8px' }}>{g.title}</h3>
                <div role="table" style={{ font: '13px/18px var(--f-ui)' }}>
                  <div
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) 24px minmax(0,1fr)',
                      gap: '12px',
                      alignItems: 'center',
                      height: '32px',
                      fontSize: '12px',
                      color: 'var(--tx-2)',
                      borderBottom: '1px solid var(--ln)'
                    }}
                  >
                    <span>{v.m?.from}</span>
                    <span />
                    <span>{v.m?.to}</span>
                  </div>
                  {arr(g.rows).map((r: any, j: number) => (
                    <div
                      key={j}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) 24px minmax(0,1fr)',
                        gap: '12px',
                        alignItems: 'center',
                        minHeight: '44px',
                        borderBottom: '1px solid var(--ln)'
                      }}
                    >
                      <span>{r.a}</span>
                      <Icon name="arrow-right" style={{ color: 'var(--tx-3)' }} />
                      <select
                        value={r.b}
                        onChange={r.onChange}
                        aria-label="Maps to"
                        style={{
                          height: '32px',
                          padding: '0 8px',
                          background: 'var(--panel-2)',
                          border: '1px solid var(--ln)',
                          font: '14px var(--f-body)'
                        }}
                      >
                        {arr(r.options).map((o: any, k: number) => (
                          <option key={k} value={o.v ?? ''}>
                            {o.v}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div
              style={{ padding: '16px 20px', borderBottom: '1px solid var(--ln)', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <h3 style={{ font: '600 15px/22px var(--f-body)' }}>Test network</h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '13px var(--f-ui)' }}>
                <Icon name="circle-check" style={{ color: 'var(--ok)' }} />
                <span>{v.m?.test}</span> · isolated, no route to production
              </span>
              <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--tx-2)' }}>
                Test boots and recovery plan tests start servers here, so a clone never holds a production address on a production network.
              </span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <h3 style={{ font: '600 15px/22px var(--f-body)', marginBottom: '8px' }}>Used by</h3>
              {arr(v.m?.used).map((u: any, i: number) => (
                <a
                  key={i}
                  href={u.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    minHeight: '36px',
                    borderBottom: '1px solid var(--ln)',
                    font: '13px var(--f-ui)',
                    transition: 'background-color 100ms'
                  }}
                  className={pc('hover', 'background:var(--hover)')}
                >
                  <Icon name={u.i} style={{ color: 'var(--tx-3)' }} />
                  <span style={{ flex: 1 }}>{u.name}</span>
                  <span style={{ color: 'var(--tx-3)' }}>{u.kind}</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }
}
