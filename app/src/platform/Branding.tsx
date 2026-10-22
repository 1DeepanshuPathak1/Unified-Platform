import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Icon } from '../lib/Icon';
import { Btn, Field, Seg, TextInput } from '../ui/controls';
import { Bar, Facts, MiniTable, Spacer, Status, TableArea, Toolbar } from '../ui/layout';
import { Dialog, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { custName, inScope } from './common';
import { audit } from './store';

interface Brand { id: string; name: string; owner: string; applies: string[]; accent: string; domain: string; domainState: 'ok' | 'pending' | 'none'; sender: string; senderState: 'ok' | 'pending'; login: string; footer: string; published: string; draft?: boolean }
const BRANDS: Brand[] = [
  { id: 'b-h360', name: 'Host360 Aegis', owner: 'h360', applies: ['h360', 'mer', 'kav', 'atl', 'cor'], accent: '#14b8a6', domain: 'aegis.host360.ai', domainState: 'ok', sender: 'notify@host360.ai', senderState: 'ok', login: 'Sign in to Host360 Aegis', footer: 'Host360 Managed Services · Chennai · support@host360.ai', published: '10 Sep 2026' },
  { id: 'b-cn', name: 'CloudNest Resilience', owner: 'sah', applies: ['sah', 'nil'], accent: '#6d5bd0', domain: 'resilience.cloudnest.in', domainState: 'ok', sender: 'alerts@cloudnest.in', senderState: 'ok', login: 'CloudNest Resilience: sign in', footer: 'CloudNest IT Services LLP · Pune · care@cloudnest.in', published: '14 Jul 2026' },
  { id: 'b-mer', name: 'Meridian reports', owner: 'mer', applies: ['mer'], accent: '#0f4c81', domain: '', domainState: 'none', sender: 'aegis-alerts@meridianbank.in', senderState: 'pending', login: '', footer: 'Meridian Cooperative Bank Ltd · Internal · IT Operations', published: '02 Oct 2026', draft: true }
];

/** WCAG contrast between two hex colours. */
const lum = (hex: string) => {
  const c = hex.replace('#', '').match(/.{2}/g)!.map(x => parseInt(x, 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const validHex = (h: string) => /^#[0-9a-fA-F]{6}$/.test(h);

/** Settings › Branding: white labelling for partners and customers, previewed before it is published. */
export function BrandingTab({ ctx }: { ctx: Ctx }) {
  const [list, setList] = useState<Brand[]>(BRANDS);
  const [open, setOpen] = useState<string | null>(null);
  const rows = list.filter(b => inScope(ctx, b.owner) || b.applies.some(a => inScope(ctx, a)));
  const b = open ? list.find(x => x.id === open) : null;
  if (b) return <Editor ctx={ctx} brand={b} onBack={() => setOpen(null)} onSave={n => setList(x => x.map(y => (y.id === n.id ? n : y)))} />;
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>A brand sets the logo, colour, domain, sender and the words on sign-in pages, e-mails, reports and evidence. White-labelled customers never see Host360.</span>
        <Spacer />
      </Toolbar>
      <TableArea>
        <AegisTable
          label="Brands"
          cols={[{ k: 'n', label: 'Brand', w: 'minmax(200px,1.4fr)' }, { k: 'a', label: 'Used by', w: 'minmax(220px,1.6fr)', dim: true }, { k: 'd', label: 'Domain', w: 'minmax(190px,1.3fr)' }, { k: 's', label: 'Sender', w: 'minmax(190px,1.3fr)' }, { k: 'p', label: 'Published', w: '170px' }]}
          rows={rows.map(x => ({
            id: x.id,
            n: { v: x.name, strong: true },
            a: x.applies.map(custName).join(', '),
            d: x.domainState === 'none' ? { v: 'Reports only', muted: true } : { t: 'status', i: x.domainState === 'ok' ? 'badge-check' : 'clock', c: x.domainState === 'ok' ? 'ok' : 'warn', l: x.domain },
            s: { t: 'status', i: x.senderState === 'ok' ? 'circle-check' : 'clock', c: x.senderState === 'ok' ? 'ok' : 'warn', l: x.sender, tip: x.senderState === 'ok' ? 'SPF and DKIM pass' : 'Waiting for the DKIM records' },
            p: x.draft ? { t: 'status', i: 'pencil', c: 'warn', l: 'Draft changes' } : x.published
          }))}
          onRow={(id: string) => setOpen(id)}
          state={ctx.ui}
          unit={['brand', 'brands']}
          emptyText="No brands yet. Everyone sees Host360 Aegis."
        />
      </TableArea>
    </>
  );
}

function Editor({ ctx, brand, onBack, onSave }: { ctx: Ctx; brand: Brand; onBack: () => void; onSave: (b: Brand) => void }) {
  const [b, setB] = useState<Brand>(brand);
  const [view, setView] = useState<'login' | 'mail' | 'report'>('login');
  const pub = useClosable<boolean>();
  const set = (p: Partial<Brand>) => setB(x => ({ ...x, ...p }));
  const ok = validHex(b.accent);
  const onDark = ok ? contrast(b.accent, '#0f1416') : 0;
  const onLight = ok ? contrast(b.accent, '#ffffff') : 0;
  const textOn = ok ? contrast(b.accent, '#ffffff') : 0;
  const dirty = JSON.stringify(b) !== JSON.stringify(brand);
  const cfg = ctx.can('configure', 'Changing branding');
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Btn kind="ghost" icon="chevron-left" onClick={onBack}>Brands</Btn>
        <strong style={{ fontWeight: 600 }}>{brand.name}</strong>
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{dirty || b.draft ? 'Draft: customers still see the published version' : `Published ${brand.published}`}</span>
        <Spacer />
        <Btn kind="primary" icon="send" perm={cfg} disabled={(!dirty && !b.draft) || !ok} why={!ok ? 'Fix the colour first.' : 'Nothing to publish.'} onClick={() => pub.open(true)}>Publish…</Btn>
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field id="br-n" label="Product name shown to users"><TextInput id="br-n" value={b.name} onChange={v => set({ name: v })} /></Field>
          <Field label="Logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', background: ok ? b.accent : 'var(--panel-2)', color: '#fff', font: '700 18px var(--f-ui)' }}>{b.name[0]}</span>
              <Btn kind="outline" size="sm" icon="upload" onClick={() => ctx.toast('Logo checked: SVG, 24 KB, square; light and dark versions made', 'ok')}>Upload SVG or PNG…</Btn>
              <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Square, at least 256 px</span>
            </div>
          </Field>
          <Field id="br-a" label="Accent colour" err={!ok ? 'Use a hex colour such as #6d5bd0.' : null} hint={ok ? `Contrast: ${onDark.toFixed(1)}:1 on the dark theme, ${onLight.toFixed(1)}:1 on light, ${textOn.toFixed(1)}:1 for white text on it` : undefined}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 32, height: 32, flex: 'none', background: ok ? b.accent : 'transparent', border: '1px solid var(--ln-2)' }} />
              <TextInput id="br-a" value={b.accent} onChange={v => set({ accent: v })} mono invalid={!ok} />
            </div>
          </Field>
          {ok && (onDark < 3 || onLight < 3 || textOn < 4.5) ? (
            <Bar tone="warn" multiline>{onDark < 3 ? 'Too dark against the dark theme; buttons and focus rings will be hard to see. ' : ''}{onLight < 3 ? 'Too light against the light theme. ' : ''}{textOn < 4.5 ? 'White text on it falls below 4.5:1; button labels will use dark text instead.' : ''}</Bar>
          ) : null}
          <Field id="br-d" label="Custom domain" hint={b.domain ? `CNAME ${b.domain} → brands.aegis.host360.ai · certificate from Let’s Encrypt, renewed automatically` : 'Leave empty to use reports and e-mail only'}>
            <TextInput id="br-d" value={b.domain} onChange={v => set({ domain: v, domainState: v === brand.domain ? brand.domainState : v ? 'pending' : 'none' })} mono placeholder="backup.example.in" />
          </Field>
          <Field id="br-s" label="E-mail sender" hint="Add the SPF include and two DKIM records shown below to the sender’s domain">
            <TextInput id="br-s" value={b.sender} onChange={v => set({ sender: v, senderState: v === brand.sender ? brand.senderState : 'pending' })} mono />
          </Field>
          <MiniTable
            label="DNS records"
            cols={[{ label: 'Record', w: '72px' }, { label: 'Name' }, { label: 'State', w: '110px' }]}
            rows={[
              ...(b.domain ? [['CNAME', b.domain, b.domainState === 'ok' ? <Status key="s" icon="badge-check" tone="ok" label="Verified" /> : <Status key="s" icon="clock" tone="warn" label="Waiting" />]] : []),
              ['TXT', `${b.sender.split('@')[1] || '—'} · v=spf1 include:_spf.aegis.host360.ai`, b.senderState === 'ok' ? <Status key="s" icon="circle-check" tone="ok" label="Passes" /> : <Status key="s" icon="clock" tone="warn" label="Waiting" />],
              ['CNAME', `aegis1._domainkey.${b.sender.split('@')[1] || '—'}`, b.senderState === 'ok' ? <Status key="s" icon="circle-check" tone="ok" label="Passes" /> : <Status key="s" icon="clock" tone="warn" label="Waiting" />]
            ]}
          />
          <Field id="br-l" label="Sign-in page heading"><TextInput id="br-l" value={b.login} onChange={v => set({ login: v })} placeholder="Leave empty if this brand has no domain" /></Field>
          <Field id="br-f" label="Footer on e-mails, reports and evidence"><TextInput id="br-f" value={b.footer} onChange={v => set({ footer: v })} /></Field>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 0 }}>
          <Seg label="Preview" value={view} onChange={setView} options={[{ v: 'login', label: 'Sign-in page' }, { v: 'mail', label: 'E-mail' }, { v: 'report', label: 'Report cover' }]} />
          <Preview b={b} view={view} />
          <p style={{ display: 'flex', gap: 6, font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}><Icon name="eye-off" />{b.id === 'b-h360' ? 'Host360’s own brand.' : 'Nothing in this brand mentions Host360: not the domain, the sender, the footer or the PDF metadata.'}</p>
        </div>
      </div>
      {pub.value ? (
        <Dialog
          title={`Publish ${b.name}`}
          sub="Users see the new brand at their next page load; scheduled reports use it from their next run."
          closing={pub.closing}
          onClose={pub.close}
          footer={<><Btn kind="ghost" onClick={pub.close}>Cancel</Btn><Btn kind="primary" icon="send" onClick={() => { onSave({ ...b, draft: false, published: ctx.now().slice(0, 11) }); audit({ who: 'priya.raman', customer: b.owner, what: 'Published a brand', object: b.name, when: ctx.now(), r: 'ok' }); ctx.toast(`${b.name} published for ${b.applies.map(custName).join(', ')}`, 'ok'); pub.close(); onBack(); }}>Publish</Btn></>}
        >
          <Facts items={[{ k: 'Used by', v: b.applies.map(custName).join(', ') }, { k: 'Domain', v: b.domain ? `${b.domain}${b.domainState !== 'ok' ? ' (not verified yet: the old address keeps working until it is)' : ''}` : 'None' }, { k: 'Sender', v: `${b.sender}${b.senderState !== 'ok' ? ' (until DKIM passes, mail goes from the published sender)' : ''}` }]} />
        </Dialog>
      ) : null}
    </div>
  );
}

function Preview({ b, view }: { b: Brand; view: 'login' | 'mail' | 'report' }) {
  const acc = validHex(b.accent) ? b.accent : '#888888';
  const ink = validHex(b.accent) && contrast(b.accent, '#ffffff') >= 4.5 ? '#ffffff' : '#111111';
  const logo = <span style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', background: acc, color: ink, font: '700 12px var(--f-ui)' }}>{b.name[0]}</span>;
  if (view === 'login')
    return (
      <div style={{ border: '1px solid var(--ln-2)', background: 'var(--app)', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', font: '600 15px var(--f-ui)' }}>{logo}{b.name}</span>
        <span style={{ font: '500 18px/24px var(--f-head)' }}>{b.login || 'Sign in'}</span>
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{b.domain || 'aegis.host360.ai'}</span>
        <span style={{ height: 34, border: '1px solid var(--ln-2)', padding: '0 10px', display: 'flex', alignItems: 'center', color: 'var(--tx-3)' }}>Work e-mail</span>
        <span style={{ height: 34, display: 'grid', placeItems: 'center', background: acc, color: ink, fontWeight: 600 }}>Continue</span>
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{b.footer}</span>
      </div>
    );
  if (view === 'mail')
    return (
      <div style={{ border: '1px solid var(--ln-2)', background: 'var(--panel-2)' }}>
        <div style={{ padding: '10px 14px', borderBottom: `3px solid ${acc}`, display: 'flex', gap: 8, alignItems: 'center' }}>{logo}<strong style={{ fontWeight: 600 }}>{b.name}</strong><span style={{ flex: 1 }} /><span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>From {b.sender}</span></div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <strong style={{ fontWeight: 600 }}>Backup failed twice: his-db-01</strong>
          <span style={{ color: 'var(--tx-2)' }}>The last two scheduled backups of his-db-01 failed (disk read error). The newest good copy is from 20 Oct, 02:10.</span>
          <span style={{ alignSelf: 'flex-start', padding: '6px 12px', background: acc, color: ink, fontWeight: 600 }}>Open the alert</span>
          <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{b.footer}</span>
        </div>
      </div>
    );
  return (
    <div style={{ border: '1px solid var(--ln-2)', background: 'var(--panel-2)', aspectRatio: '1 / 1.2', maxWidth: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 10, background: acc }} />
      <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>{logo}{b.name}</span>
        <span style={{ font: '500 22px/28px var(--f-head)', marginTop: 24 }}>Monthly service review</span>
        <span style={{ color: 'var(--tx-2)' }}>{custName(b.applies[0])} · October 2026</span>
        <span style={{ flex: 1 }} />
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>{b.footer}</span>
        <span style={{ font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>Signed · SHA-256 shown on the last page</span>
      </div>
    </div>
  );
}
