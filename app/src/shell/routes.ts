/**
 * Navigation model. Platform sections stay in the same place in every product;
 * only the product block changes, and it has a fixed height so nothing below it moves.
 */
export type NavItem = { id: string; label: string; icon: string; providerOnly?: boolean };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const PRODUCT_LABEL: Record<string, string> = { backup: 'Protection', dr: 'Resilience', mig: 'Mobility' };
export const PRODUCT_ENGINE: Record<string, string> = { backup: 'Backup & Recovery', dr: 'Disaster Recovery', mig: 'Migration' };

/** Above the product block. */
export const PLATFORM_TOP: NavGroup = {
  id: 'platform',
  label: 'Platform',
  items: [
    { id: 'home', label: 'Home', icon: 'house' },
    { id: 'inbox', label: 'Inbox', icon: 'mail' },
    { id: 'customers', label: 'Customers', icon: 'users', providerOnly: true },
    { id: 'workloads', label: 'Workloads', icon: 'layers' },
    { id: 'applications', label: 'Applications', icon: 'workflow' }
  ]
};

/** Below the product block. */
export const PLATFORM_GROUPS: NavGroup[] = [
  {
    id: 'infra',
    label: 'Infrastructure',
    items: [
      { id: 'sites', label: 'Sites', icon: 'map-pin' },
      { id: 'nodes', label: 'Nodes and proxies', icon: 'network' },
      { id: 'repos', label: 'Repositories', icon: 'database' },
      { id: 'mappings', label: 'Mappings', icon: 'arrow-left-right' },
      { id: 'agents', label: 'Agents', icon: 'bot' }
    ]
  },
  {
    id: 'ops',
    label: 'Operations',
    items: [
      { id: 'activity', label: 'Alerts & Activity', icon: 'activity' },
      { id: 'security', label: 'Security & Compliance', icon: 'scale' },
      { id: 'reports', label: 'Reports', icon: 'file-text' },
      { id: 'automation', label: 'Automation', icon: 'zap' }
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'billing', label: 'Billing & Licensing', icon: 'key' },
      { id: 'settings', label: 'Settings', icon: 'settings-2' },
      { id: 'support', label: 'Support', icon: 'headset' }
    ]
  }
];

export const COMMON_PAGES = [...PLATFORM_TOP.items, ...PLATFORM_GROUPS.flatMap(g => g.items)].map(i => i.id).concat(['search']);
export const sectionOf = (page: string) => (PLATFORM_TOP.items.some(i => i.id === page) || page === 'search' ? 'Platform' : PLATFORM_GROUPS.find(g => g.items.some(i => i.id === page))?.label || '');

/** Old addresses that now live inside a platform section. */
export const REDIRECTS: Record<string, string> = {
  jobs: 'activity/jobs',
  alerts: 'activity/alerts',
  audit: 'activity/audit',
  access: 'settings/users'
};
