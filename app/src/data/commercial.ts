/* Commercial sample data: usage records, invoices and quotas. Amounts in the invoice currency.
   Host360 Managed Services bills from Chennai, Tamil Nadu (GSTIN 33AAKCH4021M1Z6). */
import { T } from './platform';

export interface Usage {
  id: string;
  customer: string;
  product: 'Protection' | 'Resilience' | 'Mobility' | 'Services';
  project: string;
  metric: string;
  qty: number;
  unit: string;
  rate: number;
  how: string;
  poc?: boolean;
}

/** October 2026 to date (1–21 Oct). */
export const USAGE: Usage[] = [
  { id: 'u1', customer: 'mer', product: 'Protection', project: 'Meridian-CBS', metric: 'Virtual machines', qty: 38, unit: 'VM-months', rate: 650, how: '38 VMs protected on 21 Oct; billed on the highest daily count in the month' },
  { id: 'u2', customer: 'mer', product: 'Protection', project: 'Meridian-CBS', metric: 'Databases (application-consistent)', qty: 4, unit: 'database-months', rate: 1800, how: 'SQL01\\CBSREPORT, cbs-db-01 Finacle, mum-oracle-phy-01, payments ledger' },
  { id: 'u3', customer: 'mer', product: 'Protection', project: 'Meridian-CBS', metric: 'Kubernetes namespaces', qty: 6, unit: 'namespace-months', rate: 1200, how: 'mer-k8s-prod: payments, upi, ledger, notify, auth, gateway' },
  { id: 'u4', customer: 'mer', product: 'Protection', project: 'All', metric: 'Storage', qty: 18.6, unit: 'TB-months', rate: 2400, how: 'Average stored after deduplication, 1–21 Oct' },
  { id: 'u5', customer: 'mer', product: 'Protection', project: 'Meridian-Treasury', metric: 'Endpoints', qty: 112, unit: 'endpoint-months', rate: 90, how: 'Laptops with the endpoint agent' },
  { id: 'u6', customer: 'mer', product: 'Resilience', project: 'All', metric: 'Replication, Tier 0', qty: 105, unit: 'workload-days', rate: 78, how: '5 Tier 0 workloads × 21 days; ₹52 × 1.5 for Tier 0' },
  { id: 'u7', customer: 'mer', product: 'Resilience', project: 'All', metric: 'Replication, Tier 1', qty: 378, unit: 'workload-days', rate: 52, how: '18 Tier 1 workloads × 21 days (3 over the licensed 20)' },
  { id: 'u8', customer: 'mer', product: 'Resilience', project: 'All', metric: 'Reserved DR capacity', qty: 2016, unit: 'vCPU-days', rate: 9, how: '96 vCPU reserved at region-2-os × 21 days' },
  { id: 'u9', customer: 'mer', product: 'Resilience', project: 'All', metric: 'DR tests', qty: 0, unit: 'tests', rate: 25000, how: 'No test this month yet; CBS and Core banking reporting drills are due 28 Oct' },
  { id: 'u10', customer: 'mer', product: 'Mobility', project: 'Meridian-Migration', metric: 'Servers migrated', qty: 0, unit: 'servers', rate: 6000, how: 'Charged at commit. Wave 2 (SQL01, rpt-app-01) is not committed yet' },
  { id: 'u11', customer: 'mer', product: 'Services', project: 'All', metric: 'Managed DR runbook service', qty: 1, unit: 'month', rate: 40000, how: 'Fixed monthly fee in the contract' },
  { id: 'u12', customer: 'kav', product: 'Protection', project: 'Tenant-Kaveri', metric: 'Virtual machines', qty: 22, unit: 'VM-months', rate: 650, how: '22 VMs protected' },
  { id: 'u13', customer: 'kav', product: 'Protection', project: 'Kaveri-WMS', metric: 'Databases (application-consistent)', qty: 2, unit: 'database-months', rate: 1800, how: 'kav-wms-db (PostgreSQL), kav-tally-01 (Tally)' },
  { id: 'u14', customer: 'kav', product: 'Protection', project: 'All', metric: 'Storage', qty: 4.2, unit: 'TB-months', rate: 2400, how: 'Average stored after deduplication' },
  { id: 'u15', customer: 'kav', product: 'Resilience', project: 'All', metric: 'Replication, Tier 1', qty: 42, unit: 'workload-days', rate: 52, how: '2 workloads × 21 days' },
  { id: 'u16', customer: 'kav', product: 'Protection', project: 'All', metric: 'Egress (restores to customer site)', qty: 140, unit: 'GB', rate: 6, how: '140 GB restored to Kaveri’s Bengaluru office on 09 Oct' },
  { id: 'u17', customer: 'sah', product: 'Protection', project: 'Sahyadri-HIS', metric: 'Virtual machines', qty: 18, unit: 'VM-months', rate: 650, how: 'Billed to CloudNest IT Services (partner); Sahyadri sees CloudNest prices' },
  { id: 'u18', customer: 'sah', product: 'Protection', project: 'All', metric: 'Storage', qty: 6.8, unit: 'TB-months', rate: 2400, how: 'Average stored after deduplication' },
  { id: 'u19', customer: 'nil', product: 'Protection', project: 'Nilgiri-POC', metric: 'Virtual machines', qty: 6, unit: 'VM-months', rate: 0, how: 'Proof of concept: free until the trial ends on 04 Nov 2026', poc: true },
  { id: 'u20', customer: 'h360', product: 'Protection', project: 'Base-Project', metric: 'Virtual machines', qty: 58, unit: 'VM-months', rate: 0, how: 'Host360’s own estate: shown back to departments, not invoiced' }
];

export type InvState = 'Draft' | 'Issued' | 'Paid' | 'Overdue' | 'Part paid';
export interface Invoice {
  id: string;
  customer: string;
  billTo: string;
  gstin?: string;
  period: string;
  issued: string;
  due: string;
  currency: 'INR' | 'EUR';
  terms: 'Postpaid, monthly' | 'Prepaid, annual' | 'Postpaid, quarterly';
  lines: { sac: string; text: string; qty: string; amount: number }[];
  discount?: { text: string; amount: number };
  credit?: { text: string; amount: number };
  tax: { kind: 'CGST' | 'SGST' | 'IGST' | 'Export under LUT' | 'Reverse charge (EU VAT)'; rate: number }[];
  tds?: number;
  irn?: string;
  state: InvState;
  paid?: { when: string; mode: 'NEFT' | 'RTGS' | 'UPI' | 'SEPA'; ref: string; amount: number };
  dunning?: { stage: string; when: string }[];
  commitment?: string;
}

const SAC_MANAGED = '998316';
const SAC_STORAGE = '998315';
const SAC_LICENCE = '997331';

export const INVOICES: Invoice[] = [
  {
    id: 'INV-2026-1004', customer: 'mer', billTo: 'Meridian Cooperative Bank Ltd, Mumbai, Maharashtra', gstin: '27AACCM5521R1ZQ', period: 'Oct 2026', issued: 'Not issued yet', due: '05 Nov 2026', currency: 'INR', terms: 'Postpaid, monthly', state: 'Draft', commitment: 'Annual commitment ₹1,20,00,000; ₹68,40,000 drawn so far (57 %)',
    lines: [
      { sac: SAC_MANAGED, text: 'Protection: 38 VMs, 4 databases, 6 Kubernetes namespaces, 112 endpoints', qty: 'Oct 2026', amount: 52480 },
      { sac: SAC_STORAGE, text: 'Protection: storage, 18.6 TB-months', qty: '18.6', amount: 44640 },
      { sac: SAC_MANAGED, text: 'Resilience: replication 483 workload-days (Tier 0 and Tier 1)', qty: '483', amount: 27846 },
      { sac: SAC_MANAGED, text: 'Resilience: reserved DR capacity, 2,016 vCPU-days', qty: '2016', amount: 18144 },
      { sac: SAC_MANAGED, text: 'Managed DR runbook service', qty: '1', amount: 40000 },
      { sac: SAC_LICENCE, text: 'Resilience licence overage: 3 workloads over 20', qty: '3', amount: 7500 }
    ],
    tax: [{ kind: 'IGST', rate: 18 }], tds: 2
  },
  {
    id: 'INV-2026-0911', customer: 'mer', billTo: 'Meridian Cooperative Bank Ltd, Mumbai, Maharashtra', gstin: '27AACCM5521R1ZQ', period: 'Sep 2026', issued: '01 Oct 2026', due: '15 Oct 2026', currency: 'INR', terms: 'Postpaid, monthly', state: 'Paid', irn: '7c5e1f…a91b (IRP, 01 Oct 2026, 10:12 IST)',
    lines: [
      { sac: SAC_MANAGED, text: 'Protection: 37 VMs, 4 databases, 6 namespaces, 110 endpoints', qty: 'Sep 2026', amount: 51180 },
      { sac: SAC_STORAGE, text: 'Protection: storage, 17.9 TB-months', qty: '17.9', amount: 42960 },
      { sac: SAC_MANAGED, text: 'Resilience: replication and reserved capacity', qty: 'Sep 2026', amount: 44610 },
      { sac: SAC_MANAGED, text: 'DR tests: CBS failover and Core banking reporting (28 Sep)', qty: '2', amount: 50000 },
      { sac: SAC_MANAGED, text: 'Managed DR runbook service', qty: '1', amount: 40000 }
    ],
    tax: [{ kind: 'IGST', rate: 18 }], tds: 2, paid: { when: T('14 Oct', '11:40'), mode: 'RTGS', ref: 'UTR MBKR52026101400418', amount: 265350 }
  },
  {
    id: 'INV-2026-1002', customer: 'kav', billTo: 'Kaveri Logistics Pvt Ltd, Chennai, Tamil Nadu', gstin: '33AAFCK7710P1Z2', period: 'Oct 2026', issued: 'Not issued yet', due: '05 Nov 2026', currency: 'INR', terms: 'Postpaid, monthly', state: 'Draft',
    lines: [
      { sac: SAC_MANAGED, text: 'Protection: 22 VMs, 2 databases', qty: 'Oct 2026', amount: 17900 },
      { sac: SAC_STORAGE, text: 'Protection: storage, 4.2 TB-months', qty: '4.2', amount: 10080 },
      { sac: SAC_MANAGED, text: 'Resilience: replication 42 workload-days', qty: '42', amount: 2184 },
      { sac: SAC_STORAGE, text: 'Egress: 140 GB restored to customer site', qty: '140', amount: 840 }
    ],
    discount: { text: 'Early-payment discount 2 %', amount: 620 },
    tax: [{ kind: 'CGST', rate: 9 }, { kind: 'SGST', rate: 9 }]
  },
  {
    id: 'INV-2026-0908', customer: 'kav', billTo: 'Kaveri Logistics Pvt Ltd, Chennai, Tamil Nadu', gstin: '33AAFCK7710P1Z2', period: 'Sep 2026', issued: '01 Oct 2026', due: '15 Oct 2026', currency: 'INR', terms: 'Postpaid, monthly', state: 'Paid', irn: '3a0d9c…41e2 (IRP, 01 Oct 2026, 10:12 IST)',
    lines: [{ sac: SAC_MANAGED, text: 'Protection, Resilience and storage, Sep 2026', qty: 'Sep 2026', amount: 30100 }],
    tax: [{ kind: 'CGST', rate: 9 }, { kind: 'SGST', rate: 9 }], paid: { when: T('09 Oct', '15:05'), mode: 'NEFT', ref: 'UTR HDFCN52026100912877', amount: 35518 }
  },
  {
    id: 'INV-2026-0817', customer: 'cor', billTo: 'Coromandel Insurance Ltd, Chennai, Tamil Nadu', gstin: '33AABCC1290K1ZX', period: 'Aug 2026', issued: '01 Sep 2026', due: '06 Sep 2026', currency: 'INR', terms: 'Postpaid, monthly', state: 'Overdue', irn: 'e81f44…07ac (IRP, 01 Sep 2026, 10:10 IST)',
    lines: [{ sac: SAC_MANAGED, text: 'Protection: 31 VMs and storage, Aug 2026', qty: 'Aug 2026', amount: 61400 }],
    tax: [{ kind: 'CGST', rate: 9 }, { kind: 'SGST', rate: 9 }],
    dunning: [{ stage: 'Reminder sent', when: '09 Sep 2026' }, { stage: 'Second reminder and call', when: '20 Sep 2026' }, { stage: 'Final notice: suspension in 7 days', when: '30 Sep 2026' }, { stage: 'Suspended; backups keep running, restores and changes blocked', when: '07 Oct 2026' }]
  },
  {
    id: 'INV-2026-1006', customer: 'sah', billTo: 'CloudNest IT Services LLP, Pune, Maharashtra (partner)', gstin: '27AAKFC3381N1ZB', period: 'Oct 2026', issued: 'Not issued yet', due: '05 Nov 2026', currency: 'INR', terms: 'Postpaid, monthly', state: 'Draft',
    lines: [
      { sac: SAC_MANAGED, text: 'Sahyadri Hospitals: Protection, 18 VMs', qty: 'Oct 2026', amount: 11700 },
      { sac: SAC_STORAGE, text: 'Sahyadri Hospitals: storage, 6.8 TB-months', qty: '6.8', amount: 16320 }
    ],
    credit: { text: 'SLA credit: restore test overdue on his-db-01 (GOV-00224)', amount: 1400 },
    tax: [{ kind: 'IGST', rate: 18 }]
  },
  {
    id: 'INV-2026-1010', customer: 'atl', billTo: 'Atlas Freight GmbH, Hamburg, Germany (VAT DE318872045)', period: 'Oct 2026 (onboarding)', issued: '16 Oct 2026', due: '30 Oct 2026', currency: 'EUR', terms: 'Prepaid, annual', state: 'Issued', irn: '5b2e07…c3d8 (IRP, 16 Oct 2026, 11:02 IST)',
    lines: [{ sac: SAC_MANAGED, text: 'Onboarding and Frankfurt repository set-up (one-off)', qty: '1', amount: 4800 }, { sac: SAC_LICENCE, text: 'Protection, Standard, 1 Nov 2026 to 31 Oct 2027 (prepaid)', qty: '1', amount: 18600 }],
    tax: [{ kind: 'Export under LUT', rate: 0 }, { kind: 'Reverse charge (EU VAT)', rate: 0 }]
  }
];

export const subtotal = (i: Invoice) => i.lines.reduce((a, l) => a + l.amount, 0) - (i.discount?.amount || 0) - (i.credit?.amount || 0);
export const taxOf = (i: Invoice) => i.tax.map(t => ({ ...t, amount: Math.round((subtotal(i) * t.rate) / 100) }));
export const totalOf = (i: Invoice) => subtotal(i) + taxOf(i).reduce((a, t) => a + t.amount, 0);
/** Tax deducted at source by the customer, on the value before GST. */
export const tdsOf = (i: Invoice) => (i.tds ? Math.round((subtotal(i) * i.tds) / 100) : 0);
export const STATE_OF: Record<string, string> = { '27': 'Maharashtra', '33': 'Tamil Nadu' };
export const placeOf = (i: Invoice) => (i.gstin ? `${STATE_OF[i.gstin.slice(0, 2)] || 'India'} (${i.gstin.slice(0, 2)})` : 'Outside India (export)');
export const money = (n: number, cur: 'INR' | 'EUR') => (cur === 'EUR' ? '€' + n.toLocaleString('de-DE') : '₹' + n.toLocaleString('en-IN'));

export interface Quota {
  customer: string;
  backup: [number, number];
  drVcpu: [number, number];
  drRam: [number, number];
  drStore: [number, number];
  staging: [number, number];
  over: 'Allow 10 % burst, then alert' | 'Block new backups at the quota' | 'Alert only';
}
/** Used and quota per tenant: backup TB; DR vCPU, RAM GB and storage TB at the recovery site; migration staging TB. */
export const QUOTAS: Quota[] = [
  { customer: 'h360', backup: [0.91, 4], drVcpu: [64, 128], drRam: [256, 512], drStore: [6.2, 12], staging: [2.1, 6], over: 'Alert only' },
  { customer: 'mer', backup: [18.6, 20], drVcpu: [96, 96], drRam: [384, 384], drStore: [22.4, 30], staging: [1.8, 4], over: 'Allow 10 % burst, then alert' },
  { customer: 'kav', backup: [4.2, 8], drVcpu: [8, 16], drRam: [32, 64], drStore: [0.6, 2], staging: [0, 0], over: 'Block new backups at the quota' },
  { customer: 'sah', backup: [6.8, 10], drVcpu: [0, 0], drRam: [0, 0], drStore: [0, 0], staging: [0, 0], over: 'Allow 10 % burst, then alert' },
  { customer: 'nil', backup: [0.3, 1], drVcpu: [0, 0], drRam: [0, 0], drStore: [0, 0], staging: [0, 0], over: 'Block new backups at the quota' },
  { customer: 'atl', backup: [0, 5], drVcpu: [0, 0], drRam: [0, 0], drStore: [0, 0], staging: [0, 0], over: 'Block new backups at the quota' },
  { customer: 'cor', backup: [3.9, 5], drVcpu: [0, 0], drRam: [0, 0], drStore: [0, 0], staging: [0, 0], over: 'Alert only' }
];
