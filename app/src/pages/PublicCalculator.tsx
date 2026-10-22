import { useState } from 'react';
import { Icon } from '../lib/Icon';
import { pc } from '../lib/pseudo';
import { Btn, Field, TextInput } from '../ui/controls';
import { Bar, Panel } from '../ui/layout';
import { CalculatorBody } from '../platform/Calculators';

const readTheme = () => {
  try {
    return localStorage.getItem('aegis.theme') || 'dark';
  } catch {
    return 'dark';
  }
};
const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|rediffmail)\./i;

/**
 * The calculators as a public page at aegis.host360.ai/calculator (also embedded on host360.ai).
 * Same engine and assumptions as Support › Calculators; no sign-in, no customer data.
 */
export default function PublicCalculator() {
  const [theme] = useState(readTheme);
  const [msg, setMsg] = useState<string | null>(null);
  const toast = (m: string) => setMsg(m);
  return (
    <div data-ae="" data-theme={theme} style={{ minHeight: '100vh', background: 'var(--app)', color: 'var(--tx)', font: '14px/20px var(--f-body)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: '1px solid var(--ln)', background: 'var(--hdr)' }}>
        <Icon name="mark" size={24} />
        <span style={{ font: '500 17px/24px var(--f-head)' }}>Host360 Aegis</span>
        <span style={{ flex: 1 }} />
        <a href="#/signup" className={pc('hover', 'background:var(--hover)')} style={{ height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 10px', color: 'var(--tx-2)', fontWeight: 600 }}>Start a trial</a>
        <a href="#/backup/home" className={pc('hover', 'background:var(--hover)')} style={{ height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 10px', color: 'var(--tx-2)', fontWeight: 600 }}>Sign in</a>
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: '32px 0 40px', maxWidth: 1240, width: '100%', margin: '0 auto' }}>
        <div style={{ padding: '0 24px' }}>
          <h1 style={{ font: '500 26px/34px var(--f-head)' }}>Size backup, disaster recovery and migration</h1>
          <p style={{ color: 'var(--tx-2)', maxWidth: 760 }}>Three calculators on one set of assumptions, the same ones Host360 engineers use. Change the assumptions to match your data; every answer updates.</p>
        </div>
        {msg ? <div style={{ padding: '0 24px' }}><Bar tone="ok" actions={<Btn kind="ghost" size="sm" onClick={() => setMsg(null)}>Close</Btn>}>{msg}</Bar></div> : null}
        <CalculatorBody toast={toast} lead={(calc, summary) => <LeadForm calc={calc} summary={summary} onSent={toast} />} />
      </main>
    </div>
  );
}

function LeadForm({ calc, summary, onSent }: { calc: string; summary: string; onSent: (m: string) => void }) {
  const [name, setName] = useState('');
  const [mail, setMail] = useState('');
  const [org, setOrg] = useState('');
  const [sent, setSent] = useState(false);
  const work = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(mail) && !FREE_MAIL.test(mail);
  const ok = name.trim().length >= 2 && org.trim().length >= 2 && work;
  if (sent) return <Panel title="Sizing sent"><p style={{ padding: 16, color: 'var(--tx-2)' }}>We sent the sizing to {mail}. A Host360 engineer will check it against your environment within one working day.</p></Panel>;
  return (
    <Panel title="Send me this sizing">
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: 'var(--tx-2)' }}>{summary}. We’ll e-mail it with the assumptions, and an engineer will check it against your environment.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field id="ld-n" label="Name"><TextInput id="ld-n" value={name} onChange={setName} /></Field>
          <Field id="ld-o" label="Organisation"><TextInput id="ld-o" value={org} onChange={setOrg} /></Field>
        </div>
        <Field id="ld-m" label="Work e-mail" err={mail && !work ? (FREE_MAIL.test(mail) ? 'Use your work address.' : 'Not a valid e-mail address.') : null}>
          <TextInput id="ld-m" value={mail} onChange={setMail} invalid={!!mail && !work} placeholder="it.head@yourcompany.in" />
        </Field>
        <div>
          <Btn kind="primary" icon="send" disabled={!ok} why={!work ? 'Give your work e-mail.' : 'Give your name and organisation.'} onClick={() => { setSent(true); onSent(`Sizing for the ${calc === 'backup' ? 'backup storage' : calc === 'dr' ? 'DR site' : 'migration'} calculator sent to ${mail}`); }}>
            Send the sizing
          </Btn>
        </div>
      </div>
    </Panel>
  );
}
