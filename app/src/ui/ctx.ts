/** Result of a permission check: `ok`, or the sentence that explains why not. */
export type Perm = { ok: boolean; dis?: string; why?: string; op: number };

export type Product = 'backup' | 'dr' | 'mig';
export type UiState = 'live' | 'loading' | 'empty' | 'unreach';
export type Audience = 'provider' | 'customer' | 'self';

export type ToastKind = 'ok' | 'warn' | 'err' | 'info';

export interface LiveJob {
  id: string;
  name: string;
  object: string;
  product: string;
  type: string;
  phases: string[];
  phase: number;
  pct: number;
  rate: string;
  status: 'run' | 'ok' | 'err' | 'paused' | 'cancelled';
  started: string;
  log: { t: string; text: string; lv: 'info' | 'ok' | 'warn' | 'err' }[];
}

export interface JobSpec {
  name: string;
  object: string;
  product: string;
  type?: string;
  phases?: string[];
  speed?: number;
  rate?: string;
  firstLine?: string;
  doneToast?: string;
  doneLog?: string;
  lines?: Record<string, string>;
}

/** What the console hands every screen. */
export interface Ctx {
  route: string;
  product: Product;
  page: string;
  /** Third path segment, e.g. the tab in #/backup/settings/users. */
  tab: string;
  key: string;
  title: string;
  sub: string;
  section: string;
  project: string;
  role: string;
  audience: Audience;
  /** Set while a provider user is signed in as a customer's owner. */
  actingAs: null | { customer: string; owner: string; ownerEmail: string };
  ui: UiState;
  theme: string;
  openId: string | null;
  nonce: number;
  jobs: LiveJob[];
  tick: number;
  go: (route: string, openId?: string) => void;
  toast: (text: string, kind?: ToastKind, action?: { label: string; run: () => void }) => void;
  startJob: (spec: JobSpec) => string;
  can: (action: 'configure' | 'operate' | 'restore' | 'destroy' | 'admin', verb?: string) => Perm;
  now: () => string;
  hms: () => string;
  loginAsOwner: (customerId: string) => void;
}
