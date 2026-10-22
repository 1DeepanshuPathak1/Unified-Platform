import { useEffect, useState } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { Btn, CheckBox, Field, RadioCard, SelectInput, TextInput } from '../ui/controls';
import { Facts, Stepper } from '../ui/layout';

const readTheme = () => {
  try {
    return localStorage.getItem('aegis.theme') || 'dark';
  } catch {
    return 'dark';
  }
};
const GSTIN = /^(\d{2})([A-Z]{5}\d{4}[A-Z])[1-9A-Z]Z[0-9A-Z]$/;
const STATES: Record<string, string> = { '27': 'Maharashtra', '29': 'Karnataka', '33': 'Tamil Nadu', '07': 'Delhi', '36': 'Telangana' };
const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|rediffmail)\./i;

/**
 * Public self sign-up: work e-mail with a one-time code, the organisation checked against the
 * GST portal (or VIES in the EU), KYC, then a 30-day trial provisioned while you watch.
 * No console chrome: this is what a prospect sees at aegis.host360.ai/signup.
 */
export default function Signup() {
  const [theme] = useState(readTheme);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [org, setOrg] = useState('');
  const [country, setCountry] = useState('India');
  const [gstin, setGstin] = useState('');
  const [vat, setVat] = useState('');
  const [check, setCheck] = useState<'idle' | 'run' | 'ok' | 'mismatch'>('idle');
  const [signer, setSigner] = useState('');
  const [title, setTitle] = useState('');
  const [doc, setDoc] = useState(false);
  const [terms, setTerms] = useState(false);
  const [product, setProduct] = useState<'Protection' | 'Resilience' | 'Mobility'>('Protection');
  const [prov, setProv] = useState(-1);
  const m = gstin.toUpperCase().match(GSTIN);
  const workMail = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) && !FREE_MAIL.test(email);
  const verifyOrg = () => {
    setCheck('run');
    // The fifth character of a PAN is the first letter of the entity's name; a different letter means the names differ.
    window.setTimeout(() => setCheck(country !== 'India' || (m && m[2][4] === org.trim()[0]?.toUpperCase()) ? 'ok' : 'mismatch'), 1200);
  };
  const STEPS_P = ['Tenant created in India South (Chennai DC1)', 'Default project and roles', 'Repository with 1 TB of trial storage, immutable for 7 days', `30-day ${product} trial licence, 10 workloads`, 'Owner invited; MFA set up at first sign-in'];
  useEffect(() => {
    if (step !== 4 || prov >= STEPS_P.length) return;
    const t = window.setTimeout(() => setProv(p => p + 1), 700);
    return () => window.clearTimeout(t);
  }, [step, prov]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = [
    workMail && sent && /^\d{6}$/.test(code),
    org.trim().length >= 3 && (country === 'India' ? !!m && check !== 'idle' && check !== 'run' : /^[A-Z]{2}\d{8,12}$/.test(vat.toUpperCase()) && check === 'ok'),
    signer.trim().length >= 3 && title.trim().length >= 2 && doc && terms,
    true
  ][step];
  const review = check === 'mismatch';
  return (
    <div data-ae="" data-theme={theme} style={{ minHeight: '100vh', background: 'var(--app)', color: 'var(--tx)', font: '14px/20px var(--f-body)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: '1px solid var(--ln)', background: 'var(--hdr)' }}>
        <Icon name="mark" size={24} />
        <span style={{ font: '500 17px/24px var(--f-head)' }}>Host360 Aegis</span>
        <span style={{ flex: 1 }} />
        <a href="#/backup/home" className={pc('hover', 'background:var(--hover)')} style={{ height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 10px', color: 'var(--tx-2)', fontWeight: 600 }}>Already a customer? Sign in</a>
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ width: 600, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h1 style={{ font: '500 26px/34px var(--f-head)' }}>Start a 30-day trial</h1>
            <p style={{ color: 'var(--tx-2)' }}>Backup, disaster recovery or migration for Proxmox VE, OpenStack and VMware. No card needed; nothing is charged unless you convert.</p>
          </div>
          <Stepper steps={['Work e-mail', 'Organisation', 'Verification', 'Trial', 'Ready']} current={step} />
          <div style={{ border: '1px solid var(--ln)', background: 'var(--panel)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {step === 0 ? (
              <>
                <Field id="su-e" label="Work e-mail" err={email && !workMail ? (FREE_MAIL.test(email) ? 'Use your work address; personal mail can’t own a tenant.' : 'Not a valid e-mail address.') : null}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <TextInput id="su-e" value={email} onChange={v => { setEmail(v); setSent(false); }} placeholder="senthil@palartextiles.in" invalid={!!email && !workMail} autoFocus />
                    <Btn kind="outline" icon="send" disabled={!workMail} why="Give your work e-mail first." onClick={() => setSent(true)}>{sent ? 'Send again' : 'Send code'}</Btn>
                  </div>
                </Field>
                {sent ? (
                  <Field id="su-c" label={`6-digit code sent to ${email}`} hint="It expires in 10 minutes.">
                    <TextInput id="su-c" value={code} onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" mono placeholder="000000" />
                  </Field>
                ) : null}
              </>
            ) : null}
            {step === 1 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 180px', gap: 16 }}>
                  <Field id="su-o" label="Legal name of the organisation"><TextInput id="su-o" value={org} onChange={v => { setOrg(v); setCheck('idle'); }} placeholder="Palar Textiles Pvt Ltd" autoFocus /></Field>
                  <Field id="su-k" label="Country"><SelectInput id="su-k" value={country} onChange={v => { setCountry(v); setCheck('idle'); }} options={['India', 'Germany', 'France', 'Netherlands']} /></Field>
                </div>
                {country === 'India' ? (
                  <Field id="su-g" label="GSTIN" err={gstin && !m ? '15 characters: state code, PAN, entity number, Z and a check character.' : null} hint={m ? `State ${STATES[m[1]] || m[1]} · PAN ${m[2]}` : 'Checked against the GST portal'}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <TextInput id="su-g" value={gstin} onChange={v => { setGstin(v.toUpperCase()); setCheck('idle'); }} mono placeholder="33AAACP4521K1Z9" invalid={!!gstin && !m} />
                      <Btn kind="outline" icon={check === 'run' ? 'loader-circle' : 'badge-check'} spin={check === 'run'} disabled={!m || !org.trim() || check === 'run'} why="Give the name and a valid GSTIN first." onClick={verifyOrg}>Check</Btn>
                    </div>
                  </Field>
                ) : (
                  <Field id="su-v" label="VAT number" hint="Checked in the EU VIES service">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <TextInput id="su-v" value={vat} onChange={v => { setVat(v.toUpperCase()); setCheck('idle'); }} mono placeholder="DE318872045" />
                      <Btn kind="outline" icon={check === 'run' ? 'loader-circle' : 'badge-check'} spin={check === 'run'} disabled={!/^[A-Z]{2}\d{8,12}$/.test(vat.toUpperCase()) || check === 'run'} why="Give a VAT number such as DE318872045." onClick={verifyOrg}>Check</Btn>
                    </div>
                  </Field>
                )}
                {check === 'ok' ? <p style={{ display: 'flex', gap: 8 }}><Icon name="badge-check" style={{ color: 'var(--ok)', marginTop: 2 }} />{country === 'India' ? `Active on the GST portal since 2014; trade name matches; ${STATES[m?.[1] || ''] || 'India'}.` : 'Valid in VIES; the name matches.'} Your data will stay in {country === 'India' ? 'India (DPDP)' : 'the EU (GDPR), in Frankfurt'}.</p> : null}
                {check === 'mismatch' ? <p style={{ display: 'flex', gap: 8 }}><Icon name="triangle-alert" style={{ color: 'var(--warn)', marginTop: 2 }} />The GST portal has a different legal name for this GSTIN. You can go on; a person checks it before the trial starts, usually within 4 business hours.</p> : null}
              </>
            ) : null}
            {step === 2 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field id="su-s" label="Authorised signatory"><TextInput id="su-s" value={signer} onChange={setSigner} placeholder="R. Senthil" autoFocus /></Field>
                  <Field id="su-t" label="Designation"><TextInput id="su-t" value={title} onChange={setTitle} placeholder="Director, IT" /></Field>
                </div>
                {doc ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--ln-2)', background: 'var(--panel-2)' }}>
                    <Icon name="file-check" size={20} style={{ color: 'var(--ok)' }} />
                    <span style={{ flex: 1 }}><strong style={{ fontWeight: 600 }}>certificate-of-incorporation.pdf</strong><span style={{ display: 'block', font: '12px var(--f-ui)', color: 'var(--tx-3)' }}>412 KB · CIN U17111TN2011PTC081234 read from the document</span></span>
                    <button type="button" aria-label="Remove file" onClick={() => setDoc(false)} style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', color: 'var(--tx-3)' }}><Icon name="x" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDoc(true)} className={pc('hover', 'border-color:var(--acc);background:var(--hover)')} style={{ height: 96, border: '1px dashed var(--ln-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--tx-2)' }}>
                    <Icon name="upload" size={20} />
                    <span><strong style={{ color: 'var(--tx)', fontWeight: 600 }}>Certificate of incorporation</strong> (PDF), or the partnership deed</span>
                  </button>
                )}
                <CheckBox on={terms} onChange={setTerms}>I accept the trial terms and the data processing agreement for {org || 'the organisation'}</CheckBox>
              </>
            ) : null}
            {step === 3 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <RadioCard on={product === 'Protection'} onClick={() => setProduct('Protection')} icon="archive" title="Protection" note="Back up and restore Proxmox VE and OpenStack guests" />
                  <RadioCard on={product === 'Resilience'} onClick={() => setProduct('Resilience')} icon="life-buoy" title="Resilience" note="Replicate servers and test failover to a recovery site" />
                  <RadioCard on={product === 'Mobility'} onClick={() => setProduct('Mobility')} icon="forward" title="Mobility" note="Assess VMware and move up to 10 servers" />
                </div>
                <Facts items={[{ k: 'Trial', v: '30 days, up to 10 workloads, 1 TB of storage' }, { k: 'Then', v: 'Convert to a paid plan from Billing, or the tenant is read-only for 14 days and then deleted' }, { k: 'Owner', v: `${email} (MFA required)` }]} />
              </>
            ) : null}
            {step === 4 ? (
              review ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ display: 'flex', gap: 8, fontWeight: 600 }}><Icon name="hourglass" style={{ color: 'var(--warn)', marginTop: 2 }} />Waiting for a person to check your organisation</p>
                  <p style={{ color: 'var(--tx-2)' }}>The name on the GST portal did not match. A Host360 colleague checks the documents, usually within 4 business hours. We e-mail {email} when the trial is ready; nothing else is needed from you.</p>
                </div>
              ) : (
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {STEPS_P.map((t, i) => (
                    <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', color: i <= prov ? 'var(--tx)' : 'var(--tx-3)' }}>
                      <Icon name={i < prov ? 'circle-check' : i === prov ? 'loader-circle' : 'circle'} spin={i === prov} style={{ color: i < prov ? 'var(--ok)' : i === prov ? 'var(--run)' : 'var(--tx-3)' }} />
                      {t}
                    </li>
                  ))}
                  {prov >= STEPS_P.length ? <li style={{ marginTop: 8 }}><Btn kind="primary" icon="arrow-right" onClick={() => { location.hash = '/backup/home'; }}>Open the console</Btn></li> : null}
                </ol>
              )
            ) : null}
            {step < 4 ? (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--ln)', paddingTop: 16 }}>
                {step > 0 ? <Btn kind="ghost" onClick={() => setStep(step - 1)}>Back</Btn> : null}
                <Btn kind="primary" iconAfter="arrow-right" disabled={!ok} why={['Verify your work e-mail with the code.', 'Give the legal name and check the GSTIN or VAT number.', 'Name the signatory, add the certificate and accept the terms.', ''][step]} onClick={() => { if (step === 3) setProv(0); setStep(step + 1); }}>{step === 3 ? 'Start the trial' : 'Next'}</Btn>
              </div>
            ) : null}
          </div>
          <p style={{ font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Host360 Managed Services · GSTIN 33AAKCH4021M1Z6 · Chennai · Your data stays in the region of your country.</p>
        </div>
      </main>
    </div>
  );
}
