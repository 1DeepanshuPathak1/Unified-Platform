import { useState } from 'react';
import AegisTable from '../components/AegisTable';
import { Btn, Field, RadioCard, SelectInput, TextInput } from '../ui/controls';
import { Bar, Facts, H3, MiniTable, Panel, Spacer, Status, TableArea, Toolbar, plural } from '../ui/layout';
import { Dialog, Drawer, StepUp, Wizard, useClosable } from '../ui/overlay';
import type { Ctx } from '../ui/ctx';
import { CUSTOMERS } from '../data/platform';
import { KEY_PROVIDERS, TENANT_KEYS, type KeyProvider, type TenantKey } from '../data/admin';
import { custName, inScope, showCustomerCol } from './common';
import { audit } from './store';

const short = (t: string) => t.replace(' 2026', '').replace(' IST', '');
const KINDS: KeyProvider['kind'][] = ['KMIP', 'Thales CipherTrust', 'HashiCorp Vault', 'AWS KMS', 'Azure Key Vault'];

/** Encryption keys: key providers (KMIP, Vault, cloud KMS) and one key per tenant, with rotation. The shield means encryption. */
export function KeysTab({ ctx }: { ctx: Ctx }) {
  const [keys, setKeys] = useState<TenantKey[]>(TENANT_KEYS);
  const [providers, setProviders] = useState<KeyProvider[]>(KEY_PROVIDERS);
  const drawer = useClosable<string>();
  const rotate = useClosable<string>();
  const add = useClosable<boolean>();
  const rows = keys.filter(k => inScope(ctx, k.customer));
  const showCust = showCustomerCol(ctx);
  const adm = ctx.can('admin', 'Managing encryption keys');
  const d = drawer.value ? keys.find(k => k.id === drawer.value) : null;
  const prov = (name: string) => providers.find(p => p.name === name);
  return (
    <>
      <Toolbar>
        <span style={{ color: 'var(--tx-2)' }}>Each tenant's data is encrypted with its own key. With BYOK the key stays in the customer's KMS; Aegis only asks it to wrap and unwrap.</span>
        <Spacer />
        <Btn kind="primary" icon="plus" perm={adm} onClick={() => add.open(true)}>
          Add a key provider
        </Btn>
      </Toolbar>
      <div style={{ padding: '0 24px 12px' }}>
        <Panel title="Key providers">
          <div style={{ padding: '0 16px 4px' }}>
            <MiniTable
              label="Key providers"
              cols={[{ label: 'Provider', w: 'minmax(0,1fr)' }, { label: 'Kind', w: '150px' }, ...(showCust ? [{ label: 'Customer', w: '170px' }] : []), { label: 'Endpoint', w: 'minmax(0,1.4fr)' }, { label: 'State', w: '150px' }]}
              rows={providers.filter(p => inScope(ctx, p.customer)).map(p => [
                <strong key="n" style={{ fontWeight: 600 }}>{p.name}</strong>,
                `${p.kind}${p.hsm ? ' · HSM' : ''}`,
                ...(showCust ? [custName(p.customer)] : []),
                <code key="e" data-tip={p.endpoint} data-tip-overflow="" style={{ font: '12px var(--f-ui)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.endpoint}</code>,
                p.state === 'ok' ? <Status key="s" icon="circle-check" tone="ok" label="Connected" /> : <Status key="s" icon="triangle-alert" tone="warn" label="Needs attention" tip={p.note} />
              ])}
            />
          </div>
        </Panel>
      </div>
      <TableArea>
        <AegisTable
          label="Tenant keys"
          cols={[
            { k: 'l', label: 'Key', w: 'minmax(150px,1.2fr)' },
            ...(showCust ? [{ k: 'c', label: 'Customer', w: 'minmax(130px,1fr)', dim: true }] : []),
            { k: 'p', label: 'Held in', w: 'minmax(150px,1.2fr)' },
            { k: 'v', label: 'Version', w: '76px', r: true },
            { k: 'r', label: 'Last rotated', w: '120px', dim: true },
            { k: 'rot', label: 'Rotation', w: '130px', dim: true },
            { k: 'n', label: 'Protects', w: '90px', r: true }
          ]}
          rows={rows.map(k => ({
            id: k.id,
            l: { t: 'icon', i: 'shield', c: 'tx', l: k.label, tip: `${k.algo}${k.byok ? ' · customer-held (BYOK)' : ''}` },
            c: custName(k.customer),
            p: k.byok ? { v: `${k.provider} · BYOK`, tip: 'Customer-held key' } : k.provider,
            v: { v: `v${k.version}`, s: k.version },
            r: k.rotated === '—' ? { v: 'Never', muted: true } : short(k.rotated).split(',')[0],
            rot: k.rotation,
            n: { v: String(k.protects.length), s: k.protects.length, tip: k.protects.join(', ') }
          }))}
          onRow={(id: string) => drawer.open(id)}
          active={drawer.value}
          state={ctx.ui}
          unit={['key', 'keys']}
          emptyText="No tenant keys yet. Every tenant gets one from the Aegis key store when it is onboarded."
          footR="Rotation re-wraps data keys; recovery points are not rewritten"
          sort="l"
        />
      </TableArea>
      {d ? (
        <Drawer
          label="Tenant key"
          kicker={`Tenant key · ${custName(d.customer)}${d.byok ? ' · BYOK' : ''}`}
          title={d.label}
          status={<><span>Version {d.version}</span><span>{d.algo}</span><span>{d.rotation}</span></>}
          actions={
            <Btn kind="outline" icon="refresh-cw" perm={adm} disabled={prov(d.provider)?.state !== 'ok'} why={prov(d.provider)?.note} onClick={() => rotate.open(d.id)}>
              Rotate now…
            </Btn>
          }
          closing={drawer.closing}
          onClose={drawer.close}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {prov(d.provider)?.note ? <Bar tone="warn" multiline>{prov(d.provider)!.note}</Bar> : null}
            <Facts items={[{ k: 'Held in', v: `${d.provider} (${prov(d.provider)?.kind})`, icon: 'shield', tone: 'ok' }, { k: 'Algorithm', v: d.algo }, { k: 'Who holds it', v: d.byok ? `${custName(d.customer)}. Revoking it in their KMS makes their recovery points unreadable, including to Host360.` : 'Host360, in the Aegis key store' }, { k: 'Last rotated', v: d.rotated }, { k: 'Rotation', v: d.rotation }]} />
            <div>
              <H3>What it protects</H3>
              <MiniTable label="Protected" cols={[{ label: 'Repository, policy or plan' }]} rows={d.protects.map(p => [p])} />
            </div>
          </div>
        </Drawer>
      ) : null}
      {rotate.value ? (
        <RotateDialog
          ctx={ctx}
          k={keys.find(k => k.id === rotate.value)!}
          closing={rotate.closing}
          onClose={rotate.close}
          onDone={id => {
            setKeys(x => x.map(k => (k.id === id ? { ...k, version: k.version + 1, rotated: ctx.now() } : k)));
            rotate.close();
          }}
        />
      ) : null}
      {add.value ? <AddProvider ctx={ctx} closing={add.closing} onClose={add.close} onAdd={p => { setProviders(x => [...x, p]); add.close(); }} /> : null}
    </>
  );
}

function RotateDialog({ ctx, k, closing, onClose, onDone }: { ctx: Ctx; k: TenantKey; closing: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const [mfa, setMfa] = useState(false);
  return (
    <Dialog
      title={`Rotate ${k.label}`}
      sub={`Makes version ${k.version + 1}. Data keys are re-wrapped in the background; nothing is unreadable while it runs.`}
      closing={closing}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="refresh-cw" disabled={!mfa} why="Confirm it is you first." onClick={() => { ctx.startJob({ name: 'Key rotation', object: k.label, product: 'Platform', phases: ['New version', 'Re-wrap data keys', 'Verify', 'Done'], speed: 16, doneToast: `${k.label} rotated to version ${k.version + 1}` }); audit({ who: 'priya.raman', customer: k.customer, what: 'Rotated a tenant key', object: `${k.label} v${k.version} → v${k.version + 1}`, when: ctx.now(), r: 'ok' }); onDone(k.id); }}>
            Rotate
          </Btn>
        </>
      }
    >
      <Facts labelW={150} items={[{ k: 'Protects', v: plural(k.protects.length, 'item') + `: ${k.protects.join(', ')}` }, { k: 'Old version', v: `v${k.version} stays for reading older recovery points` }]} />
      <StepUp verified={mfa} onVerified={() => setMfa(true)} />
    </Dialog>
  );
}

function AddProvider({ ctx, closing, onClose, onAdd }: { ctx: Ctx; closing: boolean; onClose: () => void; onAdd: (p: KeyProvider) => void }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<KeyProvider['kind']>('KMIP');
  const [cust, setCust] = useState('mer');
  const [endpoint, setEndpoint] = useState('');
  const [tested, setTested] = useState(false);
  const EP: Record<string, string> = { KMIP: 'kmip://kms.example.in:5696', 'Thales CipherTrust': 'kmip://ctm.example.in:5696', 'HashiCorp Vault': 'https://vault.example.in:8200', 'AWS KMS': 'arn:aws:kms:ap-south-1:123456789012:key/…', 'Azure Key Vault': 'https://name.vault.azure.net' };
  return (
    <Wizard
      title="Add a key provider"
      sub="Where a tenant's key lives. Aegis never sees a customer-held key, only wrap and unwrap results."
      steps={['Kind', 'Connect', 'Test']}
      step={step}
      closing={closing}
      onClose={onClose}
      canBack={step > 0}
      onBack={() => setStep(step - 1)}
      next={
        step < 2 ? (
          <Btn kind="primary" iconAfter="chevron-right" disabled={step === 1 && !endpoint.trim()} why="Give the endpoint." onClick={() => setStep(step + 1)}>
            Next
          </Btn>
        ) : (
          <Btn kind="primary" icon="check" disabled={!tested} why="Run the test first." onClick={() => { audit({ who: 'priya.raman', customer: cust, what: `Added a key provider (${kind})`, object: endpoint.trim(), when: ctx.now(), r: 'ok' }); ctx.toast(`${kind} added for ${custName(cust)}`, 'ok'); onAdd({ id: 'kp' + Date.now(), name: `${custName(cust).split(' ')[0]} ${kind}`, kind, endpoint: endpoint.trim(), customer: cust, state: 'ok', hsm: kind === 'KMIP' || kind === 'Thales CipherTrust' }); }}>
            Add provider
          </Btn>
        )
      }
    >
      {step === 0 ? (
        <>
          <Field id="kp-c" label="Customer"><SelectInput id="kp-c" value={cust} onChange={setCust} options={CUSTOMERS.filter(c => inScope(ctx, c.id)).map(c => ({ v: c.id, label: c.name }))} /></Field>
          <div role="radiogroup" aria-label="Kind" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {KINDS.map(k => (
              <RadioCard key={k} on={kind === k} onClick={() => setKind(k)} title={k} note={k === 'KMIP' || k === 'Thales CipherTrust' ? 'Hardware-backed, on premises' : k === 'HashiCorp Vault' ? 'Transit engine' : 'Cloud key service'} />
            ))}
          </div>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Field id="kp-e" label="Endpoint"><TextInput id="kp-e" value={endpoint} onChange={setEndpoint} placeholder={EP[kind]} mono /></Field>
          <p style={{ color: 'var(--tx-2)' }}>{kind === 'AWS KMS' ? 'Allow the role arn:aws:iam::…:role/aegis-kms-access to call Encrypt, Decrypt and GenerateDataKey on the key.' : kind === 'Azure Key Vault' ? 'Grant the Aegis app registration the Key Vault Crypto User role on the vault.' : 'Aegis authenticates with a client certificate issued by the KMS. Upload it on the next step after the test.'}</p>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div>
            <Btn kind="outline" icon={tested ? 'circle-check' : 'play'} onClick={() => { setTested(true); ctx.toast('Wrap and unwrap test passed in 38 ms', 'ok'); }}>
              {tested ? 'Test passed' : 'Test wrap and unwrap'}
            </Btn>
          </div>
          <Bar tone="info" icon="shield">After this, choose the provider when you create or rotate the customer's tenant key.</Bar>
        </>
      ) : null}
    </Wizard>
  );
}
