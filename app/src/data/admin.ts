/* Sample data for identity (SSO, SCIM, service accounts, break-glass, delegation), encryption keys,
   the source impact governor and platform health. Times are in the orchestrator's zone (IST). */
import { T } from './platform';

// ---- single sign-on and SCIM ----
export interface Idp {
  id: string;
  customer: string;
  name: string;
  vendor: 'Entra ID' | 'Okta' | 'Google Workspace' | 'Keycloak' | 'Generic SAML' | 'Generic OIDC';
  protocol: 'SAML 2.0' | 'OpenID Connect';
  domains: string[];
  state: 'active' | 'testing' | 'error';
  users: number;
  mfaClaim: boolean;
  certExpires?: string;
  lastSignIn: string;
  scim?: { on: boolean; endpoint: string; lastSync: string; created: number; updated: number; deactivated: number; errors: number; groups: [string, string][] };
  note?: string;
}

export const IDPS: Idp[] = [
  {
    id: 'idp-h360', customer: 'h360', name: 'Host360 Entra ID', vendor: 'Entra ID', protocol: 'OpenID Connect', domains: ['host360.ai'], state: 'active', users: 5, mfaClaim: true, lastSignIn: T('21 Oct', '15:44'),
    scim: { on: true, endpoint: 'https://aegis.host360.ai/scim/v2/h360', lastSync: T('21 Oct', '16:00'), created: 0, updated: 2, deactivated: 0, errors: 0, groups: [['AEGIS-Owners', 'Owner'], ['AEGIS-Backup-Admins', 'Admin'], ['AEGIS-Migration', 'Migration Planner'], ['AEGIS-ReadOnly', 'Read-only']] }
  },
  {
    id: 'idp-mer', customer: 'mer', name: 'Meridian Okta', vendor: 'Okta', protocol: 'SAML 2.0', domains: ['meridianbank.in'], state: 'active', users: 12, mfaClaim: true, certExpires: '14 Jan 2027', lastSignIn: T('21 Oct', '15:31'),
    scim: { on: true, endpoint: 'https://aegis.host360.ai/scim/v2/mer', lastSync: T('21 Oct', '15:45'), created: 1, updated: 4, deactivated: 1, errors: 1, groups: [['MBK-DR-Owners', 'Owner'], ['MBK-Backup-Ops', 'Backup Operator'], ['MBK-Auditors', 'Auditor'], ['MBK-Migration-Approvers', 'Migration Approver']] }
  },
  { id: 'idp-kav', customer: 'kav', name: 'Kaveri Google Workspace', vendor: 'Google Workspace', protocol: 'OpenID Connect', domains: ['kaveri-logistics.in'], state: 'testing', users: 0, mfaClaim: false, lastSignIn: '—', note: 'Test sign-in passed for rahul@kaveri-logistics.in. Not yet enforced; people still sign in with passwords.' },
  { id: 'idp-atl', customer: 'atl', name: 'Atlas Keycloak', vendor: 'Keycloak', protocol: 'OpenID Connect', domains: ['atlas-freight.de'], state: 'error', users: 2, mfaClaim: true, lastSignIn: T('20 Oct', '09:12'), note: 'Could not read the discovery document at https://sso.atlas-freight.de/realms/atlas/.well-known/openid-configuration since 20 Oct, 23:10 IST.' }
];

export const SCIM_LOG = [
  { when: T('21 Oct', '16:00'), customer: 'h360', event: 'Updated', who: 'meera.iyer@host360.ai', detail: 'Group AEGIS-Migration added; role Migration Planner kept', r: 'ok' },
  { when: T('21 Oct', '15:45'), customer: 'mer', event: 'Deactivated', who: 'v.kulkarni@meridianbank.in', detail: 'Disabled in Okta; sessions ended, approvals they gave stay valid', r: 'ok' },
  { when: T('21 Oct', '15:45'), customer: 'mer', event: 'Failed', who: 'treasury-bot@meridianbank.in', detail: 'Group MBK-Treasury-Svc is not mapped to a role; the user was not created', r: 'err' },
  { when: T('21 Oct', '11:20'), customer: 'mer', event: 'Created', who: 'p.desai@meridianbank.in', detail: 'Joined MBK-Auditors; role Auditor', r: 'ok' },
  { when: T('20 Oct', '18:02'), customer: 'h360', event: 'Updated', who: 'arun.kumar@host360.ai', detail: 'Title changed to Backup engineer', r: 'ok' },
  { when: T('20 Oct', '09:15'), customer: 'mer', event: 'Updated', who: 's.iyer@meridianbank.in', detail: 'Group MBK-Migration-Approvers added; role Migration Approver', r: 'ok' }
];

// ---- service accounts ----
export interface ServiceAccount {
  id: string;
  name: string;
  customer: string;
  purpose: string;
  scope: string;
  role: string;
  ipAllow: string;
  tokens: { id: string; prefix: string; created: string; expires: string; lastUsed: string; from: string }[];
  rotation: string;
  owner: string;
  state: 'active' | 'expiring' | 'unused';
}
export const SERVICE_ACCOUNTS: ServiceAccount[] = [
  { id: 'sa1', name: 'svc-servicenow', customer: 'h360', purpose: 'Opens and updates ServiceNow incidents from alerts', scope: 'Host360 (all customers)', role: 'Read-only + alerts', ipAllow: '10.20.0.0/16', tokens: [{ id: 't1', prefix: 'aeg_sn_7Q2M…', created: T('01 Jul', '10:00'), expires: '01 Jan 2027, 10:00 IST', lastUsed: T('21 Oct', '16:02'), from: '10.20.4.18' }], rotation: 'Every 180 days', owner: 'Arun Kumar', state: 'active' },
  { id: 'sa2', name: 'svc-terraform', customer: 'h360', purpose: 'Creates policies and plans from the platform repository', scope: 'Base-Project', role: 'Admin', ipAllow: '10.20.6.12/32', tokens: [{ id: 't2', prefix: 'aeg_tf_X9D1…', created: T('28 Apr', '09:30'), expires: T('28 Oct', '09:30'), lastUsed: T('19 Oct', '22:40'), from: '10.20.6.12' }], rotation: 'Every 180 days', owner: 'Priya Raman', state: 'expiring' },
  { id: 'sa3', name: 'svc-splunk-siem', customer: 'h360', purpose: 'Reads the audit log for the SIEM', scope: 'Host360 (all customers)', role: 'Auditor', ipAllow: '10.30.2.0/24', tokens: [{ id: 't3', prefix: 'aeg_sp_44KD…', created: T('15 Feb', '12:00'), expires: '15 Feb 2027, 12:00 IST', lastUsed: T('21 Oct', '16:05'), from: '10.30.2.7' }], rotation: 'Every 365 days', owner: 'Priya Raman', state: 'active' },
  { id: 'sa4', name: 'mbk-reporting', customer: 'mer', purpose: 'Pulls RPO compliance for the RBI quarterly return', scope: 'Meridian Cooperative Bank', role: 'Auditor', ipAllow: '172.25.40.0/24', tokens: [{ id: 't4', prefix: 'aeg_mr_0PQ7…', created: T('03 Mar', '15:00'), expires: '03 Mar 2027, 15:00 IST', lastUsed: T('01 Oct', '06:10'), from: '172.25.40.11' }], rotation: 'Every 365 days', owner: 'Anitha Krishnan', state: 'active' },
  { id: 'sa5', name: 'kav-old-script', customer: 'kav', purpose: 'Started backups from a cron job (replaced by policies)', scope: 'Tenant-Kaveri', role: 'Backup Operator', ipAllow: 'Any', tokens: [{ id: 't5', prefix: 'aeg_kv_1AZ3…', created: T('29 May', '11:00'), expires: T('29 Nov', '11:00'), lastUsed: T('02 Jul', '01:00'), from: '49.204.17.6' }], rotation: 'None', owner: 'Rahul Menon', state: 'unused' }
];

// ---- break-glass ----
export const BREAK_GLASS = {
  accounts: [
    { name: 'bg-host360-1', holders: ['Priya Raman (half 1)', 'Security officer Vivek Rao (half 2)'], key: 'YubiKey 5 · serial 21 584 117, in the Chennai DC safe', lastTest: T('01 Oct', '11:00'), nextTest: '01 Jan 2027, 11:00 IST' },
    { name: 'bg-host360-2', holders: ['Arun Kumar (half 1)', 'Security officer Vivek Rao (half 2)'], key: 'YubiKey 5 · serial 21 584 118, in the Mumbai DC safe', lastTest: T('01 Oct', '11:20'), nextTest: '01 Jan 2027, 11:20 IST' }
  ],
  rules: ['Works when single sign-on or the identity provider is down', 'Needs both halves of the password and the hardware key', 'Session ends after 4 hours and cannot be extended', 'Every Owner and the security officer are told within a minute', 'Every action is recorded and the session is reviewed within 48 hours'],
  uses: [
    { when: T('01 Oct', '11:00'), who: 'bg-host360-1', why: 'Quarterly test', dur: '9 min', review: 'Reviewed by Vivek Rao, 01 Oct', kind: 'Test' },
    { when: T('14 Aug', '02:12'), who: 'bg-host360-2', why: 'Entra ID outage (Microsoft incident MO854112); restored a failed backup of sql-prod-02', dur: '1 h 18 min', review: 'Reviewed by Vivek Rao, 15 Aug', kind: 'Emergency' },
    { when: T('01 Jul', '11:00'), who: 'bg-host360-1', why: 'Quarterly test', dur: '7 min', review: 'Reviewed by Vivek Rao, 01 Jul', kind: 'Test' }
  ]
};

// ---- delegated administration ----
export interface Delegation {
  id: string;
  who: string;
  email: string;
  customer: string;
  subtree: string;
  can: string[];
  cannot: string[];
  granted: string;
  by: string;
  expires: string;
}
export const DELEGATIONS: Delegation[] = [
  { id: 'dl1', who: 'Rohit Shenoy', email: 'rohit.s@meridianbank.in', customer: 'mer', subtree: 'Meridian Cooperative Bank › Treasury', can: ['Invite and remove people', 'Assign roles up to Admin', 'Create projects', 'Approve restores'], cannot: ['Change approval rules', 'Change compliance mode', 'See other departments'], granted: T('15 Aug', '10:00'), by: 'Anitha Krishnan', expires: '15 Aug 2027, 10:00 IST' },
  { id: 'dl2', who: 'Meera Iyer', email: 'meera.iyer@host360.ai', customer: 'kav', subtree: 'Kaveri Logistics Pvt Ltd (whole tenant)', can: ['Invite and remove people', 'Assign roles up to Admin', 'Edit policies'], cannot: ['Billing and licences', 'Delete the tenant'], granted: T('27 May', '15:10'), by: 'Priya Raman', expires: T('30 Nov', '23:59') },
  { id: 'dl3', who: 'Dr Vikram Joshi', email: 'v.joshi@sahyadrihospitals.in', customer: 'sah', subtree: 'Sahyadri Hospitals › Pune campus', can: ['Invite and remove people', 'Assign roles up to Backup Operator'], cannot: ['Assign Admin or Owner', 'Change data residency'], granted: T('20 Jul', '12:00'), by: 'CloudNest IT Services (partner)', expires: 'No end date' }
];

// ---- encryption keys ----
export interface KeyProvider {
  id: string;
  name: string;
  kind: 'KMIP' | 'HashiCorp Vault' | 'AWS KMS' | 'Azure Key Vault' | 'Thales CipherTrust' | 'Aegis internal';
  endpoint: string;
  customer: string;
  state: 'ok' | 'warn' | 'unreach';
  hsm: boolean;
  note?: string;
}
export const KEY_PROVIDERS: KeyProvider[] = [
  { id: 'kp0', name: 'Aegis key store', kind: 'Aegis internal', endpoint: 'aegis-orchestrator (sealed with the Chennai HSM)', customer: 'h360', state: 'ok', hsm: true },
  { id: 'kp1', name: 'Meridian CipherTrust', kind: 'Thales CipherTrust', endpoint: 'kmip://ctm.meridianbank.in:5696', customer: 'mer', state: 'ok', hsm: true },
  { id: 'kp2', name: 'Sahyadri Key Vault', kind: 'Azure Key Vault', endpoint: 'https://sah-backup-kv.vault.azure.net', customer: 'sah', state: 'ok', hsm: false },
  { id: 'kp3', name: 'Host360 Vault', kind: 'HashiCorp Vault', endpoint: 'https://vault.host360.ai:8200 (transit engine)', customer: 'h360', state: 'ok', hsm: false },
  { id: 'kp4', name: 'Atlas AWS KMS', kind: 'AWS KMS', endpoint: 'arn:aws:kms:eu-central-1:…:key/atlas-backup', customer: 'atl', state: 'warn', hsm: false, note: 'Onboarding: the key policy does not yet allow the Aegis role to call Decrypt.' }
];
export interface TenantKey {
  id: string;
  customer: string;
  label: string;
  provider: string;
  byok: boolean;
  algo: string;
  version: number;
  rotated: string;
  rotation: string;
  protects: string[];
}
export const TENANT_KEYS: TenantKey[] = [
  { id: 'k1', customer: 'mer', label: 'mbk-backup-kek', provider: 'Meridian CipherTrust', byok: true, algo: 'AES-256-GCM', version: 7, rotated: T('01 Oct', '00:00'), rotation: 'Every 90 days', protects: ['mer-obj-immutable', 'Meridian Tier-0 replication', 'Meridian Tier-1 replication'] },
  { id: 'k2', customer: 'sah', label: 'sah-his-kek', provider: 'Sahyadri Key Vault', byok: true, algo: 'RSA-HSM 3072 wrapping AES-256', version: 3, rotated: T('14 Jul', '13:00'), rotation: 'Every 180 days', protects: ['Sahyadri daily', 'pacs-store copies'] },
  { id: 'k3', customer: 'h360', label: 'h360-default', provider: 'Aegis key store', byok: false, algo: 'AES-256-GCM', version: 12, rotated: T('18 Oct', '00:00'), rotation: 'Every 30 days', protects: ['obj-check', 'copy-check-repo', 'test-repo'] },
  { id: 'k4', customer: 'kav', label: 'kav-default', provider: 'Host360 Vault', byok: false, algo: 'AES-256-GCM', version: 4, rotated: T('20 Aug', '00:00'), rotation: 'Every 90 days', protects: ['Kaveri daily', 'kav-repo-01'] },
  { id: 'k5', customer: 'atl', label: 'atl-backup-kek', provider: 'Atlas AWS KMS', byok: true, algo: 'AES-256-GCM (SYMMETRIC_DEFAULT)', version: 1, rotated: '—', rotation: 'Yearly (AWS managed)', protects: ['atl-obj-fra (not yet used)'] }
];

// ---- source impact governor ----
export interface Governor {
  source: string;
  kind: string;
  cap: number;
  unit: 'MB/s' | 'Mbit/s';
  window?: string;
  backoff: string;
  now: number;
  users: { product: 'Protection' | 'Resilience' | 'Mobility'; share: number }[];
  throttled?: string;
  latency: number;
  latencyLimit: number;
}
export const GOVERNORS: Governor[] = [
  { source: 'Chennai vCenter', kind: 'vCenter 172.25.10.177', cap: 400, unit: 'MB/s', backoff: 'Halve when datastore latency is above 20 ms for 1 min', now: 312, users: [{ product: 'Mobility', share: 214 }, { product: 'Resilience', share: 98 }], latency: 9, latencyLimit: 20 },
  { source: 'Chennai-proxmox-prod', kind: 'Proxmox VE cluster', cap: 800, unit: 'MB/s', window: '09:00–19:00 IST: 500 MB/s', backoff: 'Halve when Ceph latency is above 15 ms for 1 min', now: 488, users: [{ product: 'Protection', share: 148 }, { product: 'Resilience', share: 340 }], latency: 12, latencyLimit: 15, throttled: 'Business hours cap of 500 MB/s applies' },
  { source: 'production-openstack', kind: 'OpenStack (Cinder on Ceph)', cap: 600, unit: 'MB/s', backoff: 'Halve when volume latency is above 20 ms for 1 min', now: 96, users: [{ product: 'Protection', share: 96 }], latency: 6, latencyLimit: 20 },
  { source: 'esxi-edge-07', kind: 'ESXi 7.0 standalone', cap: 120, unit: 'MB/s', backoff: 'Stop new snapshots when the datastore is above 90 % full', now: 0, users: [], latency: 4, latencyLimit: 20, throttled: 'Paused: ds-edge-01 is 93 % full' },
  { source: 'mum-oracle-phy-01', kind: 'Physical server (agent)', cap: 40, unit: 'Mbit/s', window: '09:00–19:00 IST: 40 Mbit/s; nights 400 Mbit/s', backoff: 'Back off when the agent sees CPU above 70 %', now: 40, users: [{ product: 'Resilience', share: 40 }], latency: 0, latencyLimit: 0, throttled: 'At its business-hours cap; replication is 1 h 26 min behind' }
];

// ---- platform health ----
export const COMPONENTS = [
  { name: 'aegis-orchestrator', kind: 'Orchestrator', version: '4.2.0', state: 'ok', cpu: 38, mem: 61, note: 'Primary, Chennai' },
  { name: 'aegis-orchestrator-standby', kind: 'Orchestrator (standby)', version: '4.2.0', state: 'ok', cpu: 4, mem: 22, note: 'Warm standby, Mumbai; replication lag 2 s' },
  { name: 'Job scheduler', kind: 'Service', version: '4.2.0', state: 'ok', cpu: 12, mem: 34, note: '3 running, 0 queued' },
  { name: 'PostgreSQL (internal)', kind: 'Database', version: '16.4', state: 'ok', cpu: 18, mem: 52, note: 'Backed up daily at 01:00 to obj-check' },
  { name: 'Message bus (NATS)', kind: 'Service', version: '2.10', state: 'ok', cpu: 6, mem: 15, note: '' },
  { name: 'aegis-proxy-nova-248d', kind: 'Proxy', version: '4.2.0', state: 'unreach', cpu: null, mem: null, note: 'No heartbeat since 14:52 IST (region-2-os)' },
  { name: 'aegis-proxy-cmp6', kind: 'Proxy', version: '4.1.3', state: 'warn', cpu: 41, mem: 58, note: 'One version behind' },
  { name: 'Licence service', kind: 'Service', version: '4.2.0', state: 'ok', cpu: 1, mem: 8, note: 'Last check 16:00 IST' }
];
export const SLOS = [
  { name: 'Console availability', target: '99.9 %', actual: '99.97 %', budget: 0.7, window: '30 days', ok: true },
  { name: 'API p95 latency under 400 ms', target: '99 %', actual: '99.4 %', budget: 0.6, window: '30 days', ok: true },
  { name: 'Backup jobs start within 5 min of schedule', target: '99.5 %', actual: '99.6 %', budget: 0.2, window: '30 days', ok: true },
  { name: 'Replication within RPO', target: '99 %', actual: '97.8 %', budget: -0.2, window: '30 days', ok: false }
];
