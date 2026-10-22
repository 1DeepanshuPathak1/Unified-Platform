/* Host360 Aegis — sample data for the prototype. Times are in the orchestrator's zone (IST). Ported from project/aegis-data.js. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const AEGIS: any = (function () {
  const T = (d, hm) => `${d} 2026, ${hm} IST`;
  const NOW = T('21 Oct', '16:05');

  const products = [
    { id: 'backup', label: 'Backup & Recovery', icon: 'archive', desc: 'Back up and restore Proxmox VE and OpenStack guests' },
    { id: 'dr', label: 'Disaster Recovery', icon: 'life-buoy', desc: 'Replicate servers and bring them online at a recovery site' },
    { id: 'mig', label: 'Migration', icon: 'forward', desc: 'Move VMs from VMware to Proxmox VE or OpenStack' }
  ];
  const nav = {
    backup: [['overview', 'Overview', 'layout-dashboard'], ['guests', 'Protected guests', 'monitor'], ['policies', 'Policies', 'clipboard-list'], ['restore', 'Restore', 'rotate-ccw'], ['copies', 'Backup copies', 'copy']],
    dr: [['overview', 'Overview', 'layout-dashboard'], ['servers', 'Protected servers', 'server'], ['plans', 'Protection plans', 'calendar-clock'], ['recovery', 'Recovery plans', 'list-ordered'], ['history', 'History', 'history']],
    mig: [['overview', 'Overview', 'layout-dashboard'], ['servers', 'Servers', 'server'], ['plans', 'Migration plans', 'route']]
  };
  const shared = [
    { group: 'Infrastructure', items: [['sites', 'Sites', 'map-pin'], ['nodes', 'Nodes and proxies', 'network'], ['repos', 'Repositories', 'database'], ['mappings', 'Mappings', 'arrow-left-right']] },
    { group: 'Operations', items: [['jobs', 'Jobs', 'activity'], ['alerts', 'Alerts', 'bell'], ['reports', 'Reports', 'file-text'], ['audit', 'Audit', 'scroll-text']] },
    { group: 'Administration', items: [['access', 'Access', 'users'], ['settings', 'Settings', 'settings-2']] }
  ];
  const pages = {
    'backup/overview': ['Overview', 'Backup and recovery in {p} over the last 24 hours.'],
    'backup/guests': ['Protected guests', 'Proxmox VE and OpenStack guests, their policies and recovery points.'],
    'backup/policies': ['Policies', 'Schedules, retention and where recovery points are stored.'],
    'backup/restore': ['Restore', 'Bring back a whole VM, single disks or files from a recovery point.'],
    'backup/copies': ['Backup copies', 'Copies of recovery points in a second repository, each with its own retention.'],
    'dr/overview': ['Overview', 'How ready the servers protected at a recovery site are.'],
    'dr/servers': ['Protected servers', 'Servers replicated from a primary site to a recovery site.'],
    'dr/plans': ['Protection plans', 'How often each server is synced and how many versions are kept.'],
    'dr/recovery': ['Recovery plans', 'Ordered, testable runbooks that bring services online at the recovery site.'],
    'dr/history': ['History', 'Every replication cycle and the time spent in each phase.'],
    'mig/overview': ['Overview', 'Progress of the servers moving off VMware.'],
    'mig/servers': ['Servers', 'Virtual machines on VMware sources, and where each one is in its migration.'],
    'mig/plans': ['Migration plans', 'Servers grouped into waves, with a cutover window and the mappings they use.'],
    sites: ['Sites', 'Platforms Aegis connects to in {p}, and what each one is used for.'],
    nodes: ['Nodes and proxies', 'The orchestrator, appliances and proxies that read and move data.'],
    repos: ['Repositories', 'Where recovery points are stored, how much they shrink and how they are protected.'],
    mappings: ['Mappings', 'How networks, storage and sizes translate from one site to another.'],
    jobs: ['Jobs', 'Every job from every product.'],
    alerts: ['Alerts', 'Conditions that need attention, and what was done about them.'],
    reports: ['Reports', 'Scheduled summaries for each product.'],
    audit: ['Audit', 'Who did what, when, from where, and the result.'],
    access: ['Access', 'People, projects and one-time restore exceptions.'],
    settings: ['Settings', 'Notifications, Aegis’s own backup, tunables and licence.']
  };

  const sites = [
    { id: 'cpp', name: 'Chennai-proxmox-prod', platform: 'Proxmox VE', fam: 'Proxmox VE', version: '9.2.2', access: 'Proxmox API and SSH', nodes: 6, guests: 109, usedBy: ['Backup', 'DR'], status: 'ok', seen: T('21 Oct', '16:04'), addr: '10.20.4.11:8006', added: T('12 Mar', '10:41') + ' by priya.raman', proxies: 'aegis-proxy-cmp4, aegis-proxy-cmp5, aegis-proxy-cmp6', account: 'aegis@pve!backup', fp: '4F:9A:21:0C:7E:B3:58:D1:6A:02:9F:44:C7:1E:E0:93' },
    { id: 'clp', name: 'Chennai_Lab_Proxmox', platform: 'Proxmox VE', fam: 'Proxmox VE', version: '9.2.2', access: 'SSH only', nodes: 1, guests: 9, usedBy: ['Backup'], status: 'ok', seen: T('21 Oct', '16:03'), addr: '10.20.9.40:22', added: T('02 Apr', '15:12') + ' by priya.raman', proxies: 'aegis-proxy-director-lab', account: 'root (key installed)', fp: 'SHA256:q3Lk…Vt8 (host key)' },
    { id: 'pos', name: 'production-openstack', platform: 'OpenStack', fam: 'OpenStack', version: '2025.1', access: 'Keystone v3, password', nodes: 4, guests: 62, usedBy: ['Backup', 'DR', 'Migration'], status: 'ok', seen: T('21 Oct', '16:04'), addr: 'keystone.prod.host360.local:5000', added: T('18 Jan', '09:20') + ' by arun.kumar', proxies: 'aegis-appliance-os1', account: 'aegis-svc (domain Default)', fp: 'B1:07:6E:D2:3A:90:CC:15:48:F7:2B:6D:01:AE:53:9C' },
    { id: 'r2', name: 'region-2-os', platform: 'OpenStack', fam: 'OpenStack', version: '2025.1', access: 'Keystone v3, password', nodes: null, guests: null, usedBy: ['DR'], status: 'unreach', seen: T('21 Oct', '14:52'), addr: '10.40.0.5:5000', added: T('30 Jun', '11:05') + ' by arun.kumar', proxies: 'aegis-proxy-nova-248d', account: 'aegis-svc (domain Default)', fp: '77:C0:9E:12:AB:34:F1:08:6D:E2:5B:90:3C:A7:41:D6', reason: 'Keystone at 10.40.0.5:5000 did not answer within 30 s.' },
    { id: 'vc', name: 'Chennai vCenter', platform: 'VMware vCenter', fam: 'VMware', version: '8.0.3', access: 'vSphere API', nodes: 3, guests: 41, usedBy: ['DR', 'Migration'], status: 'ok', seen: T('21 Oct', '16:04'), addr: 'vcenter.chennai.host360.local:443', added: T('04 Aug', '14:30') + ' by priya.raman', proxies: 'aegis-orchestrator', account: 'svc-aegis@vsphere.local', fp: 'E4:51:0A:9B:C3:7D:22:F8:16:6E:A0:3F:B9:54:C2:08', vmw: true },
    { id: 'esx', name: 'esxi-edge-07', platform: 'ESXi', fam: 'VMware', version: '8.0.2', access: 'vSphere API', nodes: 1, guests: 7, usedBy: ['Migration'], status: 'degraded', seen: T('21 Oct', '16:01'), addr: '10.20.12.7:443', added: T('09 Sep', '17:48') + ' by arun.kumar', proxies: 'aegis-orchestrator', account: 'root', fp: '0D:6B:E8:31:5F:A2:94:C7:08:1E:B3:6A:D9:22:F0:45', vmw: true, reason: 'Datastore ds-edge-01 is 93 % full.' }
  ];
  const mkNodes = (names, g, cpu, mem) => names.map((n, i) => ({ name: n, guests: g[i], cpu, mem }));
  const siteNodes = {
    cpp: mkNodes(['cmp1', 'cmp2', 'cmp3', 'cmp4', 'cmp5', 'cmp6'], [22, 19, 18, 17, 16, 17], '64 cores', '512 GB'),
    clp: mkNodes(['director-lab'], [9], '16 cores', '128 GB'),
    pos: mkNodes(['compute-01', 'compute-02', 'compute-03', 'compute-04'], [18, 16, 15, 13], '48 cores', '384 GB'),
    vc: mkNodes(['esx-01', 'esx-02', 'esx-03'], [15, 14, 12], '32 cores', '256 GB'),
    esx: mkNodes(['esxi-edge-07'], [7], '16 cores', '128 GB'),
    r2: []
  };
  const siteStorage = {
    cpp: [['ceph-vm', 'Ceph RBD', '38.42 TB', '61.44 TB', 63], ['local-lvm', 'LVM-thin', '1.12 TB', '3.50 TB', 32], ['nfs-iso', 'NFS', '0.21 TB', '2.00 TB', 11], ['pbs-old', 'Directory', '0.84 TB', '4.00 TB', 21]],
    clp: [['local-lvm', 'LVM-thin', '0.61 TB', '1.80 TB', 34], ['local', 'Directory', '0.09 TB', '0.20 TB', 45]],
    pos: [['ceph-ssd', 'Volume type', '22.10 TB', '40.00 TB', 55], ['standard', 'Volume type', '8.75 TB', '20.00 TB', 44]],
    vc: [['ds-ssd-01', 'VMFS 6', '7.80 TB', '12.00 TB', 65], ['ds-sas-02', 'VMFS 6', '14.20 TB', '24.00 TB', 59], ['ds-nfs-03', 'NFS 4.1', '2.10 TB', '8.00 TB', 26]],
    esx: [['ds-edge-01', 'VMFS 6', '1.86 TB', '2.00 TB', 93]],
    r2: []
  };
  const siteNetworks = {
    cpp: [['vmbr0', 'Linux bridge', 'VLAN 10', '10.20.4.0/24'], ['vmbr1', 'Linux bridge', 'Untagged', '10.20.1.0/24'], ['vmbr20', 'Linux bridge', 'VLAN 20', '10.20.20.0/24'], ['vmbr99', 'Linux bridge', 'VLAN 99', 'Isolated']],
    clp: [['vmbr0', 'Linux bridge', 'Untagged', '10.20.9.0/24']],
    pos: [['prod-net', 'Tenant network', 'VXLAN 1201', '10.50.0.0/22'], ['app-net', 'Tenant network', 'VXLAN 1202', '10.50.8.0/24'], ['mgmt-net', 'Provider network', 'VLAN 5', '10.10.0.0/24'], ['dr-test-isolated', 'Tenant network', 'VXLAN 1299', 'No router']],
    vc: [['VM Network', 'Port group', 'VLAN 10', '10.30.0.0/22'], ['DMZ-120', 'Port group', 'VLAN 120', '10.30.120.0/24']],
    esx: [['VM Network', 'Port group', 'Untagged', '10.20.12.0/24']],
    r2: []
  };

  const nodes = [
    { id: 'orc', name: 'aegis-orchestrator', role: 'orchestrator', site: 'Chennai-proxmox-prod', status: 'ok', version: '4.2.0', slots: [0, 2], tput: 0, seen: T('21 Oct', '16:05'), addr: '10.20.4.5', cpu: '8 cores', mem: '16 GB', disk: '120.00 GB' },
    { id: 'p220', name: 'aegis-prod-220', role: 'appliance', site: 'Chennai-proxmox-prod', status: 'ok', version: '4.2.0', slots: [3, 8], tput: 412, seen: T('21 Oct', '16:05'), addr: '10.20.4.220', cpu: '16 cores', mem: '64 GB', disk: '480.00 GB' },
    { id: 'l200', name: 'aegis-lab-200', role: 'appliance', site: 'Chennai_Lab_Proxmox', status: 'ok', version: '4.2.0', slots: [1, 4], tput: 96, seen: T('21 Oct', '16:05'), addr: '10.20.9.200', cpu: '8 cores', mem: '32 GB', disk: '240.00 GB' },
    { id: 'c4', name: 'aegis-proxy-cmp4', role: 'proxy', site: 'Chennai-proxmox-prod', status: 'ok', version: '4.2.0', slots: [2, 4], tput: 148, seen: T('21 Oct', '16:05'), addr: '10.20.4.24', cpu: '4 cores', mem: '8 GB', disk: '40.00 GB' },
    { id: 'c5', name: 'aegis-proxy-cmp5', role: 'proxy', site: 'Chennai-proxmox-prod', status: 'ok', version: '4.2.0', slots: [0, 4], tput: 0, seen: T('21 Oct', '16:05'), addr: '10.20.4.25', cpu: '4 cores', mem: '8 GB', disk: '40.00 GB' },
    { id: 'c6', name: 'aegis-proxy-cmp6', role: 'proxy', site: 'Chennai-proxmox-prod', status: 'warn', statusLabel: 'Update available', version: '4.1.3', slots: [1, 4], tput: 64, seen: T('21 Oct', '16:04'), addr: '10.20.4.26', cpu: '4 cores', mem: '8 GB', disk: '40.00 GB' },
    { id: 'dl', name: 'aegis-proxy-director-lab', role: 'proxy', site: 'Chennai_Lab_Proxmox', status: 'ok', version: '4.2.0', slots: [0, 2], tput: 0, seen: T('21 Oct', '16:05'), addr: '10.20.9.41', cpu: '2 cores', mem: '4 GB', disk: '40.00 GB' },
    { id: 'os1', name: 'aegis-appliance-os1', role: 'appliance', site: 'production-openstack', status: 'ok', version: '4.2.0', slots: [2, 8], tput: 212, seen: T('21 Oct', '16:05'), addr: '10.50.0.9', cpu: '16 cores', mem: '64 GB', disk: '480.00 GB' },
    { id: 'n248', name: 'aegis-proxy-nova-248d', role: 'proxy', site: 'region-2-os', status: 'unreach', version: null, slots: null, tput: null, seen: T('21 Oct', '14:52'), addr: '10.40.0.48', cpu: '4 cores', mem: '8 GB', disk: '40.00 GB', reason: 'No heartbeat since 14:52 IST. The proxy may be stopped or its network down.' }
  ];

  const repos = [
    { id: 'obj', name: 'obj-check', type: 'S3-compatible', site: 'Chennai-proxmox-prod', node: 'aegis-prod-220', used: 272.33, cap: 2048, red: '4.4×', lock: 'Compliance', lockDays: 14, enc: true, status: 'ok', endpoint: 's3.chennai.host360.local/aegis-obj-check', points: 60, logical: '1187.84 GB' },
    { id: 'dir', name: 'repo-director-lab', type: 'Filesystem', site: 'Chennai_Lab_Proxmox', node: 'aegis-lab-200', used: 186.40, cap: 500, red: '2.24×', lock: null, enc: false, status: 'ok', endpoint: '/srv/aegis/repo', points: 36, logical: '417.54 GB' },
    { id: 'copy', name: 'copy-check-repo', type: 'NFS', site: 'Chennai-proxmox-prod', node: 'aegis-prod-220', used: 412.08, cap: 1024, red: '3.1×', lock: 'Governance', lockDays: 7, enc: true, status: 'ok', endpoint: 'nfs01.chennai.host360.local:/export/aegis', points: 88, logical: '1277.45 GB' },
    { id: 'test', name: 'test-repo', type: 'SMB', site: 'production-openstack', node: 'aegis-appliance-os1', used: 41.70, cap: 250, red: '1.8×', lock: null, enc: true, status: 'degraded', endpoint: '\\\\fs02\\aegis-test', points: 9, logical: '75.06 GB', reason: 'The share is mounted read-only. New recovery points cannot be written.' }
  ];

  const policyNames = ['Production daily', 'Database hourly', 'OpenStack nightly', 'Lab weekly'];
  const policies = [
    { id: 'pd', name: 'Production daily', schedule: 'Daily at 02:00', retention: '14 daily', gfs: '4 weekly · 12 monthly · 1 yearly', dest: 'obj-check', copy: 'copy-check-repo', lock: 'Compliance', lockDays: 14, enc: true, guests: 89, cons: 'Application' },
    { id: 'dh', name: 'Database hourly', schedule: 'Every hour', retention: '48 hourly', gfs: '7 daily · 4 weekly', dest: 'obj-check', copy: null, lock: 'Compliance', lockDays: 14, enc: true, guests: 12, cons: 'Application' },
    { id: 'on', name: 'OpenStack nightly', schedule: 'Daily at 23:00', retention: '7 daily', gfs: '4 weekly', dest: 'copy-check-repo', copy: null, lock: 'Governance', lockDays: 7, enc: true, guests: 62, cons: 'Crash' },
    { id: 'lw', name: 'Lab weekly', schedule: 'Sundays at 06:00', retention: '4 weekly', gfs: 'None', dest: 'repo-director-lab', copy: null, lock: null, enc: false, guests: 9, cons: 'Offline' }
  ];
  const deletedJobs = [
    { id: 'dj1', name: 'Old NFS nightly', kind: 'Backup job', deleted: T('14 Oct', '18:22'), by: 'arun.kumar', purge: T('13 Nov', '18:22'), points: 21 },
    { id: 'dj2', name: 'Test policy 2', kind: 'Backup job', deleted: T('02 Oct', '11:05'), by: 'meera.iyer', purge: T('01 Nov', '11:05'), points: 3 }
  ];
  const copies = [
    { id: 'cp1', name: 'Offsite copy of Production daily', src: 'obj-check', dst: 'copy-check-repo', retention: '30 daily · 6 monthly', schedule: 'After each backup', last: { r: 'ok', t: T('21 Oct', '02:41') }, lag: 0, status: 'ok' },
    { id: 'cp2', name: 'Lab to object storage', src: 'repo-director-lab', dst: 'obj-check', retention: '8 weekly', schedule: 'Daily at 08:00', last: { r: 'warn', t: T('21 Oct', '08:12') }, lag: 2, status: 'warn', note: '2 recovery points skipped: source points locked by a running restore.' },
    { id: 'cp3', name: 'Database copy', src: 'obj-check', dst: 'test-repo', retention: '7 daily', schedule: 'Every 4 hours', last: { r: 'err', t: T('21 Oct', '12:00') }, lag: 3, status: 'err', note: 'test-repo is read-only. The copy could not write.' }
  ];

  const G = (name: string, site: string, policy: string, r: string, lastT: string, next: string, points: number, cons: string, cbt: string, size: number, os: string, disks: any[][]): any => ({ id: name, name, site, policy, last: { r, t: lastT }, next, points, cons, cbt, size, os, disks });
  const guests = [
    G('web-frontend-01', 'Chennai-proxmox-prod', 'Production daily', 'ok', T('21 Oct', '02:14'), T('22 Oct', '02:00'), 31, 'Application', 'On', 120.0, 'Ubuntu 24.04', [['scsi0', 80, 'ceph-vm'], ['scsi1', 40, 'ceph-vm']]),
    G('web-frontend-02', 'Chennai-proxmox-prod', 'Production daily', 'ok', T('21 Oct', '02:16'), T('22 Oct', '02:00'), 31, 'Application', 'On', 120.0, 'Ubuntu 24.04', [['scsi0', 80, 'ceph-vm'], ['scsi1', 40, 'ceph-vm']]),
    G('sql-prod-02', 'Chennai-proxmox-prod', 'Database hourly', 'ok', T('21 Oct', '16:00'), T('21 Oct', '17:00'), 59, 'Application', 'On', 640.0, 'Windows Server 2022', [['scsi0', 120, 'ceph-vm'], ['scsi1', 400, 'ceph-vm'], ['scsi2', 120, 'ceph-vm']]),
    G('erp-db-01', 'Chennai-proxmox-prod', 'Database hourly', 'warn', T('21 Oct', '16:02'), T('21 Oct', '17:00'), 58, 'Crash', 'On', 820.0, 'Oracle Linux 9', [['scsi0', 100, 'ceph-vm'], ['scsi1', 720, 'ceph-vm']]),
    G('erp-app-01', 'Chennai-proxmox-prod', 'Production daily', 'run', T('21 Oct', '15:58'), T('22 Oct', '02:00'), 30, 'Application', 'On', 260.0, 'Windows Server 2022', [['scsi0', 100, 'ceph-vm'], ['scsi1', 160, 'ceph-vm']]),
    G('mail-gw-01', 'Chennai-proxmox-prod', 'Production daily', 'ok', T('21 Oct', '02:31'), T('22 Oct', '02:00'), 31, 'Application', 'On', 90.0, 'Debian 12', [['scsi0', 90, 'ceph-vm']]),
    G('file-srv-03', 'Chennai-proxmox-prod', 'Production daily', 'err', T('21 Oct', '02:48'), T('22 Oct', '02:00'), 29, 'Crash', 'Reset pending', 1840.0, 'Windows Server 2019', [['scsi0', 80, 'ceph-vm'], ['scsi1', 1760, 'ceph-vm']]),
    G('ad-dc-01', 'Chennai-proxmox-prod', 'Production daily', 'ok', T('21 Oct', '02:05'), T('22 Oct', '02:00'), 31, 'Application', 'On', 60.0, 'Windows Server 2022', [['scsi0', 60, 'ceph-vm']]),
    G('gitlab-01', 'Chennai-proxmox-prod', 'Production daily', 'ok', T('21 Oct', '02:52'), T('22 Oct', '02:00'), 31, 'Application', 'On', 420.0, 'Ubuntu 22.04', [['scsi0', 60, 'ceph-vm'], ['scsi1', 360, 'ceph-vm']]),
    G('monitoring-01', 'Chennai-proxmox-prod', 'Production daily', 'ok', T('21 Oct', '02:20'), T('22 Oct', '02:00'), 31, 'Crash', 'On', 150.0, 'Rocky Linux 9', [['scsi0', 150, 'local-lvm']]),
    G('billing-api-02', 'production-openstack', 'OpenStack nightly', 'ok', T('20 Oct', '23:12'), T('21 Oct', '23:00'), 11, 'Crash', 'On', 80.0, 'Ubuntu 24.04', [['vda', 80, 'ceph-ssd']]),
    G('k8s-worker-07', 'production-openstack', 'OpenStack nightly', 'ok', T('20 Oct', '23:20'), T('21 Oct', '23:00'), 11, 'Crash', 'On', 200.0, 'Ubuntu 24.04', [['vda', 100, 'ceph-ssd'], ['vdb', 100, 'standard']]),
    G('k8s-worker-08', 'production-openstack', 'OpenStack nightly', 'warn', T('20 Oct', '23:41'), T('21 Oct', '23:00'), 11, 'Crash', 'Off', 200.0, 'Ubuntu 24.04', [['vda', 100, 'ceph-ssd'], ['vdb', 100, 'standard']]),
    G('jenkins-ci', 'production-openstack', 'OpenStack nightly', 'ok', T('20 Oct', '23:05'), T('21 Oct', '23:00'), 11, 'Crash', 'On', 300.0, 'Debian 12', [['vda', 300, 'standard']]),
    G('lab-win2022', 'Chennai_Lab_Proxmox', 'Lab weekly', 'ok', T('19 Oct', '06:14'), T('26 Oct', '06:00'), 4, 'Offline', 'On', 100.0, 'Windows Server 2022', [['scsi0', 100, 'local-lvm']]),
    G('lab-ubuntu-24', 'Chennai_Lab_Proxmox', 'Lab weekly', 'ok', T('19 Oct', '06:09'), T('26 Oct', '06:00'), 4, 'Offline', 'On', 40.0, 'Ubuntu 24.04', [['scsi0', 40, 'local-lvm']])
  ];
  guests.find(g => g.name === 'file-srv-03').note = 'Change tracking was reset after a host crash. The next backup reads the whole disk.';
  guests.find(g => g.name === 'erp-db-01').note = 'Application-consistent snapshot failed; a crash-consistent point was taken instead.';
  guests.find(g => g.name === 'k8s-worker-08').note = 'Change tracking is off. Every backup reads the whole disk.';

  const drStates = {
    ok: ['circle-check', 'Protected', 'ok'], sync: ['loader-circle', 'Syncing', 'run'], behind: ['clock', 'Behind target', 'warn'],
    online: ['power', 'Online at recovery site', 'run'], returning: ['loader-circle', 'Returning to primary', 'run'], failed: ['circle-x', 'Last sync failed', 'err'], unreach: ['triangle-alert', 'Unreachable', 'warn']
  };
  const S = (name, pri, rec, plan, target, age, ageMin, vers, state, extra?) => ({ id: name, name, pri, rec, plan, target, age, ageMin, vers, state, ...(extra || {}) });
  const drServers = [
    S('sql-prod-02', 'Chennai-proxmox-prod', 'production-openstack', 'Business-critical', '15 min', '6 min', 6, [2, 2], 'ok'),
    S('erp-db-01', 'Chennai-proxmox-prod', 'production-openstack', 'Business-critical', '15 min', '27 min', 27, [2, 2], 'behind', { reason: 'The last two syncs took longer than the target. Hashing source is the slowest phase.' }),
    S('erp-app-01', 'Chennai-proxmox-prod', 'production-openstack', 'Business-critical', '15 min', '4 min', 4, [2, 2], 'sync'),
    S('billing-api-02', 'production-openstack', 'region-2-os', 'Business-critical', '15 min', null, null, null, 'unreach', { reason: 'Could not be read: region-2-os did not answer within 30 s.' }),
    S('ad-dc-01', 'Chennai vCenter', 'Chennai-proxmox-prod', 'Business-critical', '15 min', '3 h 40 min', 220, [1, 2], 'failed', { reason: 'Snapshot failed: the VMware Tools quiesce timed out after 600 s.' }),
    S('mail-gw-01', 'Chennai vCenter', 'Chennai-proxmox-prod', 'Business-critical', '15 min', '11 min', 11, [2, 2], 'ok'),
    S('web-frontend-01', 'Chennai-proxmox-prod', 'production-openstack', 'Non-critical', '1 d', '9 h 12 min', 552, [4, 4], 'ok'),
    S('web-frontend-02', 'Chennai-proxmox-prod', 'production-openstack', 'Non-critical', '1 d', '9 h 12 min', 552, [4, 4], 'ok'),
    S('file-srv-03', 'Chennai-proxmox-prod', 'production-openstack', 'Non-critical', '1 d', '1 d 2 h', 1560, [3, 4], 'online', { onlineAs: 'file-srv-03-dr', since: T('20 Oct', '14:10') }),
    S('gitlab-01', 'Chennai-proxmox-prod', 'production-openstack', 'Non-critical', '1 d', '16 h', 960, [4, 4], 'returning')
  ];
  const protPlans = [
    { id: 'bc', name: 'Business-critical', target: '15 min', targetMin: 15, versions: 2, every: 4, priority: 'Highest', window: 'Any time', servers: 6, compliance: [4, 6], desc: 'Tier-1 databases, directory and mail.' },
    { id: 'nc', name: 'Non-critical', target: '1 d', targetMin: 1440, versions: 4, every: 1, priority: 'Low', window: '22:00 to 06:00', servers: 4, compliance: [4, 4], desc: 'Web tier and internal tools.' }
  ];
  const recPlans = [
    { id: 'core', name: 'Core services failover', servers: ['ad-dc-01', 'sql-prod-02', 'erp-db-01', 'erp-app-01', 'mail-gw-01'], from: 'Chennai-proxmox-prod', to: 'production-openstack', approval: 'Owner or Admin', lastTest: { r: 'ok', t: T('18 Oct', '22:10'), dur: '18 min 40 s' }, ready: 'issues', issues: 2, check: T('21 Oct', '06:00'),
      steps: [
        { name: 'Directory', actions: [{ k: 'failover', target: 'ad-dc-01' }, { k: 'port', target: '10.50.0.10', port: 389 }] },
        { name: 'Databases', actions: [{ k: 'failover', target: 'sql-prod-02' }, { k: 'failover', target: 'erp-db-01' }, { k: 'wait', secs: 60 }] },
        { name: 'Applications', actions: [{ k: 'failover', target: 'erp-app-01' }, { k: 'failover', target: 'mail-gw-01' }, { k: 'port', target: 'sql-prod-02', port: 1433 }, { k: 'ping', target: '10.50.0.31' }] },
        { name: 'Hand-over', actions: [{ k: 'manual', text: 'Confirm with the ERP team that month-end jobs are paused, then tell the service desk the ERP is running at the recovery site.' }] }
      ] },
    { id: 'web', name: 'Web tier', servers: ['web-frontend-01', 'web-frontend-02', 'gitlab-01'], from: 'Chennai-proxmox-prod', to: 'production-openstack', approval: null, lastTest: { r: 'ok', t: T('12 Oct', '21:30'), dur: '7 min 12 s' }, ready: 'ready', issues: 0, check: T('21 Oct', '06:00'),
      steps: [
        { name: 'Front ends', actions: [{ k: 'failover', target: 'web-frontend-01' }, { k: 'failover', target: 'web-frontend-02' }] },
        { name: 'Tools', actions: [{ k: 'failover', target: 'gitlab-01' }, { k: 'port', target: 'gitlab-01', port: 443 }] }
      ] },
    { id: 'bill', name: 'Billing', servers: ['billing-api-02'], from: 'production-openstack', to: 'region-2-os', approval: 'Owner or Admin', lastTest: null, ready: 'unknown', issues: null, check: T('21 Oct', '06:00'),
      steps: [{ name: 'Billing API', actions: [{ k: 'failover', target: 'billing-api-02' }, { k: 'port', target: 'billing-api-02', port: 8443 }] }] }
  ];
  const phases = ['Starting', 'Snapshot', 'Attach source', 'Hashing source', 'Capture delta', 'Incremental copy', 'Verify', 'Seal version'];
  const H = (server, t, r, changed, secs, note?) => ({ id: server + t, server, started: T('21 Oct', t), r, changed, secs, total: secs.reduce((a, b) => a + b, 0), note });
  const drHistory = [
    H('sql-prod-02', '15:59', 'ok', '1.84 GB', [4, 6, 9, 48, 21, 96, 18, 3]),
    H('erp-app-01', '15:58', 'run', '0.92 GB', [3, 5, 8, 41, 14, 0, 0, 0]),
    H('erp-db-01', '15:38', 'warn', '6.12 GB', [5, 8, 11, 412, 63, 388, 44, 3], 'Took 15 min 34 s; target is 15 min.'),
    H('mail-gw-01', '15:54', 'ok', '0.31 GB', [3, 4, 7, 22, 9, 31, 11, 2]),
    H('sql-prod-02', '15:44', 'ok', '1.62 GB', [4, 6, 9, 47, 20, 88, 17, 3]),
    H('ad-dc-01', '12:25', 'err', '—', [4, 600, 0, 0, 0, 0, 0, 0], 'Snapshot failed: VMware Tools quiesce timed out after 600 s.'),
    H('web-frontend-01', '06:53', 'ok', '3.40 GB', [4, 6, 10, 91, 30, 162, 24, 3]),
    H('web-frontend-02', '06:53', 'ok', '3.12 GB', [4, 6, 10, 88, 29, 155, 23, 3]),
    H('gitlab-01', '00:12', 'ok', '12.60 GB', [5, 9, 14, 240, 61, 520, 49, 3])
  ];

  const migStages = ['Not started', 'First pass', 'Sync passes', 'Test boot', 'Cutover', 'Commit or roll back'];
  const M = (name, src, host, ds, os, cpu, mem, disks, size, cbt, stage, next, last, dest, extra?) => ({ id: name, name, src, host, ds, os, cpu, mem, disks, size, cbt, stage, next, last, dest, ...(extra || {}) });
  const migServers = [
    M('crm-app-01', 'Chennai vCenter', 'esx-01', 'ds-ssd-01', 'Windows Server 2022', 8, 32, 2, 420.0, 'On', 'synced', 'Test boot', T('21 Oct', '15:40'), 'production-openstack', { passes: 3, win: true, flavor: 'm1.xlarge', net: 'prod-net', test: 'mig-test-isolated', vt: 'ceph-ssd' }),
    M('crm-db-01', 'Chennai vCenter', 'esx-02', 'ds-ssd-01', 'Windows Server 2019', 8, 64, 3, 1260.0, 'On', 'testing', 'End test', T('21 Oct', '14:55'), 'production-openstack', { passes: 4, win: true, flavor: 'm1.2xlarge', net: 'prod-net', test: 'mig-test-isolated', vt: 'ceph-ssd' }),
    M('hr-portal', 'Chennai vCenter', 'esx-01', 'ds-sas-02', 'Ubuntu 22.04', 4, 8, 1, 80.0, 'On', 'ready', 'Cut over', T('21 Oct', '15:10'), 'production-openstack', { passes: 5, flavor: 'm1.large', net: 'prod-net', test: 'mig-test-isolated', vt: 'standard', tested: true }),
    M('win-ts-01', 'Chennai vCenter', 'esx-03', 'ds-sas-02', 'Windows Server 2022', 4, 16, 1, 150.0, 'On', 'first', 'Wait for first pass', T('21 Oct', '15:52'), 'Chennai-proxmox-prod', { passes: 0, pct: 34, win: true, cores: 4, memMb: 16384, net: 'vmbr0', test: 'vmbr99', vt: 'ceph-vm' }),
    M('win-ts-02', 'Chennai vCenter', 'esx-03', 'ds-sas-02', 'Windows Server 2022', 4, 16, 1, 150.0, 'On', 'notstarted', 'Start first pass', null, 'Chennai-proxmox-prod', { win: true, cores: 4, memMb: 16384, net: 'vmbr0', test: 'vmbr99', vt: 'ceph-vm' }),
    M('citrix-sf-01', 'Chennai vCenter', 'esx-02', 'ds-ssd-01', 'Windows Server 2019', 2, 8, 1, 60.0, 'Off', 'notstarted', 'Set mapping', null, null, { win: true }),
    M('print-srv-02', 'esxi-edge-07', 'esxi-edge-07', 'ds-edge-01', 'Windows Server 2016', 2, 4, 1, 60.0, 'On', 'cutover', 'Commit or roll back', T('21 Oct', '11:20'), 'Chennai-proxmox-prod', { passes: 6, win: true, cores: 2, memMb: 4096, net: 'vmbr0', test: 'vmbr99', vt: 'ceph-vm', cutAt: T('21 Oct', '11:20') }),
    M('legacy-erp', 'esxi-edge-07', 'esxi-edge-07', 'ds-edge-01', 'CentOS 7', 4, 16, 2, 700.0, 'Off', 'synced', 'Test boot', T('20 Oct', '22:05'), 'production-openstack', { passes: 2, flavor: 'm1.large', net: 'prod-net', test: 'mig-test-isolated', vt: 'standard' }),
    M('ubuntu-build-03', 'Chennai vCenter', 'esx-01', 'ds-nfs-03', 'Ubuntu 24.04', 8, 16, 1, 200.0, 'On', 'committed', '—', T('18 Oct', '23:45'), 'Chennai-proxmox-prod', { passes: 4, cores: 8, memMb: 16384, net: 'vmbr0', test: 'vmbr99', vt: 'ceph-vm' }),
    M('rhel-oracle-01', 'Chennai vCenter', 'esx-02', 'ds-ssd-01', 'Red Hat Enterprise Linux 8', 16, 128, 4, 2400.0, 'On', 'rolledback', 'Start first pass', T('17 Oct', '02:10'), 'production-openstack', { passes: 3, flavor: 'm1.4xlarge', net: 'prod-net', test: 'mig-test-isolated', vt: 'ceph-ssd', rbReason: 'Rolled back by priya.raman: listener failed to start on the new network.' })
  ];
  const migStage = {
    notstarted: ['circle', 'Not started', 'tx', 0], first: ['loader-circle', 'First pass', 'run', 1], synced: ['circle-check', 'Synced', 'ok', 2], testing: ['flask-conical', 'Test boot running', 'run', 3],
    ready: ['circle-check', 'Ready for cutover', 'ok', 3], cutover: ['power', 'Cut over', 'warn', 4], committed: ['check', 'Committed', 'ok', 5], rolledback: ['undo-2', 'Rolled back', 'warn', 5]
  };
  const migPlans = [
    { id: 'w1', name: 'Wave 1 · CRM', servers: ['crm-app-01', 'crm-db-01', 'hr-portal'], window: 'Sat 25 Oct 2026, 22:00 to 02:00 IST', mapping: 'Chennai vCenter → production-openstack', ready: [1, 3], owner: 'priya.raman' },
    { id: 'w2', name: 'Wave 2 · Terminal servers', servers: ['win-ts-01', 'win-ts-02', 'citrix-sf-01'], window: 'Sat 01 Nov 2026, 22:00 to 04:00 IST', mapping: 'Chennai vCenter → Chennai-proxmox-prod', ready: [0, 3], owner: 'meera.iyer' },
    { id: 'w3', name: 'Wave 3 · Legacy', servers: ['legacy-erp', 'print-srv-02', 'rhel-oracle-01'], window: null, mapping: 'esxi-edge-07 → production-openstack', ready: [0, 3], owner: 'arun.kumar' }
  ];

  const J = (id, name, object, product, type, status, phase, pct, started, duration, extra?) => ({ id, name, object, product, type, status, phase, pct, started, duration, ...(extra || {}) });
  const jobs = [
    J('j101', 'Database hourly', 'erp-db-01', 'Backup', 'Backup', 'warn', 'Done', 100, T('21 Oct', '16:00'), '2 min 41 s', { note: 'Application-consistent snapshot failed; crash-consistent point taken.' }),
    J('j102', 'Database hourly', 'sql-prod-02', 'Backup', 'Backup', 'ok', 'Done', 100, T('21 Oct', '16:00'), '1 min 58 s'),
    J('j103', 'Replication', 'sql-prod-02', 'DR', 'Replication', 'ok', 'Done', 100, T('21 Oct', '15:59'), '3 min 25 s'),
    J('j104', 'Replication', 'erp-db-01', 'DR', 'Replication', 'warn', 'Done', 100, T('21 Oct', '15:38'), '15 min 34 s', { note: 'Took longer than the 15 min target.' }),
    J('j105', 'Sync pass 3', 'crm-app-01', 'Migration', 'Sync pass', 'ok', 'Done', 100, T('21 Oct', '15:31'), '8 min 50 s'),
    J('j106', 'Test boot', 'crm-db-01', 'Migration', 'Test boot', 'ok', 'Running at destination', 100, T('21 Oct', '14:55'), '6 min 12 s'),
    J('j107', 'Restore files', 'web-frontend-01', 'Backup', 'Restore', 'ok', 'Done', 100, T('21 Oct', '13:12'), '1 min 04 s'),
    J('j108', 'Replication', 'ad-dc-01', 'DR', 'Replication', 'err', 'Snapshot', 12, T('21 Oct', '12:25'), '10 min 04 s', { note: 'Snapshot failed: VMware Tools quiesce timed out after 600 s.' }),
    J('j109', 'Database copy', 'obj-check → test-repo', 'Backup', 'Backup copy', 'err', 'Write', 3, T('21 Oct', '12:00'), '0 min 41 s', { note: 'test-repo is read-only.' }),
    J('j110', 'Cutover', 'print-srv-02', 'Migration', 'Cutover', 'ok', 'Done', 100, T('21 Oct', '11:20'), '14 min 30 s'),
    J('j111', 'Lab to object storage', 'repo-director-lab → obj-check', 'Backup', 'Backup copy', 'warn', 'Done', 100, T('21 Oct', '08:12'), '6 min 20 s'),
    J('j112', 'Readiness check', 'Core services failover', 'DR', 'Readiness check', 'warn', 'Done', 100, T('21 Oct', '06:00'), '2 min 10 s', { note: '2 issues found.' }),
    J('j113', 'Production daily', '89 guests', 'Backup', 'Backup', 'warn', 'Done', 100, T('21 Oct', '02:00'), '58 min 12 s', { note: '86 succeeded, 2 warnings, 1 failed (file-srv-03).' }),
    J('j114', 'Aegis configuration', 'aegis-orchestrator', 'Backup', 'Configuration backup', 'ok', 'Done', 100, T('21 Oct', '01:00'), '0 min 22 s')
  ];
  const jobPhases = {
    Backup: ['Queued', 'Snapshot', 'Read changes', 'Write', 'Verify', 'Done'],
    Replication: phases.concat(['Done']),
    'Sync pass': ['Queued', 'Snapshot', 'Read changes', 'Copy', 'Done'],
    'Test boot': ['Clone disk', 'Inject drivers', 'Boot', 'Running at destination', 'Done'],
    Restore: ['Queued', 'Mount point', 'Copy', 'Done'],
    'Backup copy': ['Queued', 'Read', 'Write', 'Verify', 'Done'],
    Cutover: ['Power off source', 'Final sync', 'Boot at destination', 'Done'],
    'Readiness check': ['Collect', 'Check', 'Report', 'Done'],
    'Configuration backup': ['Export', 'Encrypt', 'Write', 'Done']
  };
  const runningJobs = [
    { id: 'r1', name: 'Production daily', object: 'erp-app-01', product: 'Backup', type: 'Backup', phases: jobPhases.Backup, phase: 3, pct: 62, rate: '148 MB/s', started: T('21 Oct', '15:58') },
    { id: 'r2', name: 'Replication', object: 'erp-app-01', product: 'DR', type: 'Replication', phases: jobPhases.Replication, phase: 3, pct: 34, rate: '212 MB/s', started: T('21 Oct', '15:58') },
    { id: 'r3', name: 'First pass', object: 'win-ts-01', product: 'Migration', type: 'First pass', phases: ['Queued', 'Snapshot', 'Copy whole disk', 'Done'], phase: 2, pct: 34, rate: '96 MB/s', started: T('21 Oct', '15:52') }
  ];

  const alerts = [
    { id: 'a1', sev: 'critical', title: 'Last sync failed', object: 'ad-dc-01', product: 'DR', raised: T('21 Oct', '12:25'), detail: 'Snapshot failed: VMware Tools quiesce timed out after 600 s.' },
    { id: 'a2', sev: 'warning', title: 'Behind recovery target', object: 'erp-db-01', product: 'DR', raised: T('21 Oct', '15:53'), detail: 'Newest recovery point is 27 min old; target is 15 min.' },
    { id: 'a3', sev: 'warning', title: 'Site could not be read', object: 'region-2-os', product: 'All', raised: T('21 Oct', '14:52'), detail: 'Keystone at 10.40.0.5:5000 did not answer within 30 s.' },
    { id: 'a4', sev: 'critical', title: 'Backup failed', object: 'file-srv-03', product: 'Backup', raised: T('21 Oct', '02:48'), detail: 'Disk scsi1 read error at offset 412.6 GB. Change tracking was reset.' },
    { id: 'a5', sev: 'warning', title: 'Repository is read-only', object: 'test-repo', product: 'Backup', raised: T('21 Oct', '12:00'), detail: 'New recovery points cannot be written.' },
    { id: 'a6', sev: 'warning', title: 'Datastore almost full', object: 'esxi-edge-07', product: 'Migration', raised: T('21 Oct', '13:10'), detail: 'ds-edge-01 is 93 % full.' },
    { id: 'a7', sev: 'info', title: 'Update available', object: 'aegis-proxy-cmp6', product: 'All', raised: T('21 Oct', '09:02'), detail: 'Runs 4.1.3; the orchestrator runs 4.2.0.' }
  ];
  const pastAlerts = [
    { id: 'p1', sev: 'warning', title: 'Behind recovery target', object: 'sql-prod-02', product: 'DR', raised: T('21 Oct', '10:14'), closed: T('21 Oct', '10:31'), how: 'Cleared automatically' },
    { id: 'p2', sev: 'critical', title: 'Backup failed', object: 'gitlab-01', product: 'Backup', raised: T('20 Oct', '02:40'), closed: T('20 Oct', '09:12'), how: 'Acknowledged by arun.kumar' },
    { id: 'p3', sev: 'warning', title: 'Certificate expires in 14 days', object: 'Chennai vCenter', product: 'All', raised: T('19 Oct', '08:00'), closed: T('19 Oct', '16:45'), how: 'Acknowledged by priya.raman' },
    { id: 'p4', sev: 'info', title: 'Test boot left running for 24 h', object: 'crm-db-01', product: 'Migration', raised: T('18 Oct', '15:00'), closed: T('18 Oct', '15:20'), how: 'Cleared automatically' },
    { id: 'p5', sev: 'critical', title: 'Site could not be read', object: 'Chennai_Lab_Proxmox', product: 'All', raised: T('17 Oct', '22:02'), closed: T('17 Oct', '22:19'), how: 'Cleared automatically' }
  ];

  const audit = [
    { who: 'priya.raman', what: 'Changed protection plan Business-critical: recovery target 30 min → 15 min', when: T('21 Oct', '15:46'), from: '10.20.1.44', r: 'ok' },
    { who: 'karthik.s', what: 'Requested restore exception for web-frontend-01 (files)', when: T('21 Oct', '15:52'), from: '10.20.1.71', r: 'ok' },
    { who: 'divya.n', what: 'Tried to start Bring online for sql-prod-02', when: T('21 Oct', '15:30'), from: '10.20.1.90', r: 'refused', note: 'Role Viewer cannot bring servers online.' },
    { who: 'meera.iyer', what: 'Started test boot of crm-db-01', when: T('21 Oct', '14:55'), from: '10.20.1.52', r: 'ok' },
    { who: 'arun.kumar', what: 'Added site region-2-os', when: T('30 Jun', '11:05'), from: '10.20.1.33', r: 'ok' },
    { who: 'priya.raman', what: 'Approved restore exception for sql-prod-02 requested by divya.n', when: T('21 Oct', '10:02'), from: '10.20.1.44', r: 'ok' },
    { who: 'system', what: 'Purged 4 recovery points from the recycle bin (retention 30 d)', when: T('21 Oct', '03:00'), from: 'aegis-orchestrator', r: 'ok' },
    { who: 'arun.kumar', what: 'Tried to delete recovery point obj-check/sql-prod-02/2026-10-15T02:00', when: T('20 Oct', '18:40'), from: '10.20.1.33', r: 'refused', note: 'Locked in compliance mode until 29 Oct 2026, 02:00 IST.' },
    { who: 'priya.raman', what: 'Cut over print-srv-02', when: T('21 Oct', '11:20'), from: '10.20.1.44', r: 'ok' },
    { who: 'meera.iyer', what: 'Signed in', when: T('21 Oct', '09:01'), from: '10.20.1.52', r: 'ok' },
    { who: 'unknown', what: 'Sign-in with wrong password for user admin', when: T('21 Oct', '04:12'), from: '203.0.113.24', r: 'failed' },
    { who: 'arun.kumar', what: 'Edited Settings › Notifications: Teams channel minimum severity Warning → Critical', when: T('20 Oct', '17:20'), from: '10.20.1.33', r: 'ok' }
  ];

  const people = [
    { id: 'pr', name: 'Priya Raman', email: 'priya.raman@host360.ai', roles: [['Base-Project', 'Owner'], ['Tenant-Kaveri', 'Owner']], last: T('21 Oct', '15:44'), mfa: true, system: true },
    { id: 'ak', name: 'Arun Kumar', email: 'arun.kumar@host360.ai', roles: [['Base-Project', 'Admin']], last: T('21 Oct', '14:10'), mfa: true },
    { id: 'mi', name: 'Meera Iyer', email: 'meera.iyer@host360.ai', roles: [['Base-Project', 'Operator'], ['Tenant-Kaveri', 'Admin']], last: T('21 Oct', '09:01'), mfa: true },
    { id: 'ks', name: 'Karthik S', email: 'karthik.s@host360.ai', roles: [['Base-Project', 'Restore']], last: T('21 Oct', '15:50'), mfa: false },
    { id: 'dn', name: 'Divya N', email: 'divya.n@host360.ai', roles: [['Base-Project', 'Viewer']], last: T('21 Oct', '15:29'), mfa: true },
    { id: 'rm', name: 'Rahul Menon', email: 'rahul@kaveri-logistics.in', roles: [['Tenant-Kaveri', 'Admin']], last: T('19 Oct', '11:42'), mfa: true }
  ];
  const projects = [
    { id: 'base', name: 'Base-Project', sites: ['Chennai-proxmox-prod', 'Chennai_Lab_Proxmox', 'production-openstack', 'region-2-os', 'Chennai vCenter', 'esxi-edge-07'], repos: ['obj-check', 'repo-director-lab', 'copy-check-repo', 'test-repo'], line: 'Data reduction 4.4×: 1187.84 GB of data in 60 recovery points, stored in 272.33 GB', people: 5 },
    { id: 'kav', name: 'Tenant-Kaveri', sites: [], repos: [], line: null, people: 3 }
  ];
  const exceptions = [
    { id: 'e1', who: 'Karthik S', what: 'Files from web-frontend-01', point: T('19 Oct', '02:14'), reason: 'INC-20418: restore the deleted invoices folder for Finance.', status: 'pending', requested: T('21 Oct', '15:52'), expires: T('22 Oct', '15:52') },
    { id: 'e2', who: 'Divya N', what: 'Whole VM sql-prod-02 to Chennai_Lab_Proxmox', point: T('21 Oct', '02:00'), reason: 'Month-end reconciliation copy for audit.', status: 'approved', by: 'Priya Raman', requested: T('21 Oct', '09:40'), expires: T('22 Oct', '09:40') },
    { id: 'e3', who: 'Karthik S', what: 'Disk scsi1 of erp-app-01', point: T('20 Oct', '02:00'), reason: 'INC-20377: corrupted attachments store.', status: 'used', by: 'Arun Kumar', requested: T('20 Oct', '10:15'), expires: T('21 Oct', '10:15'), used: T('20 Oct', '11:30') },
    { id: 'e4', who: 'Meera Iyer', what: 'Files from mail-gw-01', point: T('16 Oct', '02:31'), reason: 'Lost mail queue configuration.', status: 'expired', by: 'Priya Raman', requested: T('17 Oct', '08:20'), expires: T('18 Oct', '08:20') }
  ];

  const mappings = [
    { id: 'm1', from: 'Chennai-proxmox-prod', to: 'production-openstack', kind: 'Proxmox VE → OpenStack',
      nets: [['vmbr0 (VLAN 10)', 'prod-net'], ['vmbr20 (VLAN 20)', 'app-net'], ['vmbr1', 'mgmt-net']],
      stor: [['ceph-vm', 'ceph-ssd'], ['local-lvm', 'standard']],
      sizes: [['2 cores, 4096 MB', 'm1.medium'], ['4 cores, 8192 MB', 'm1.large'], ['8 cores, 32768 MB', 'm1.xlarge'], ['16 cores, 65536 MB', 'm1.2xlarge']],
      test: 'dr-test-isolated', usedBy: [['Recovery plan', 'Core services failover'], ['Recovery plan', 'Web tier'], ['Protection plan', 'Business-critical'], ['Protection plan', 'Non-critical']] },
    { id: 'm2', from: 'Chennai vCenter', to: 'production-openstack', kind: 'VMware → OpenStack',
      nets: [['VM Network', 'prod-net'], ['DMZ-120', 'app-net']],
      stor: [['ds-ssd-01', 'ceph-ssd'], ['ds-sas-02', 'standard'], ['ds-nfs-03', 'standard']],
      sizes: [['4 vCPU, 8 GB', 'm1.large'], ['8 vCPU, 32 GB', 'm1.xlarge'], ['8 vCPU, 64 GB', 'm1.2xlarge'], ['16 vCPU, 128 GB', 'm1.4xlarge']],
      test: 'mig-test-isolated', usedBy: [['Migration', 'crm-app-01'], ['Migration', 'crm-db-01'], ['Migration', 'hr-portal'], ['Migration plan', 'Wave 1 · CRM']] },
    { id: 'm3', from: 'Chennai vCenter', to: 'Chennai-proxmox-prod', kind: 'VMware → Proxmox VE',
      nets: [['VM Network', 'vmbr0 (VLAN 10)'], ['DMZ-120', 'vmbr20 (VLAN 20)']],
      stor: [['ds-ssd-01', 'ceph-vm'], ['ds-sas-02', 'ceph-vm'], ['ds-nfs-03', 'local-lvm']],
      sizes: [['Same as source', 'Cores and memory copied 1:1']],
      test: 'vmbr99 (VLAN 99, isolated)', usedBy: [['Protected server', 'mail-gw-01'], ['Protected server', 'ad-dc-01'], ['Migration', 'win-ts-01'], ['Migration', 'win-ts-02'], ['Migration plan', 'Wave 2 · Terminal servers']] }
  ];

  const reports = {
    backup: [
      { id: 'rb1', name: 'Daily backup summary', schedule: 'Daily at 07:00', format: 'PDF and CSV', to: 'noc@host360.ai', last: T('21 Oct', '07:00'), figures: [['Jobs', '412'], ['Succeeded', '405'], ['Warnings', '6'], ['Failed', '1']] },
      { id: 'rb2', name: 'Capacity and data reduction', schedule: 'Mondays at 08:00', format: 'PDF', to: 'backup-team@host360.ai', last: T('20 Oct', '08:00'), figures: [['Protected', '2958.89 GB'], ['Stored', '912.51 GB'], ['Reduction', '3.2×'], ['Largest repo', 'copy-check-repo']] },
      { id: 'rb3', name: 'Restore activity', schedule: '1st of each month', format: 'PDF', to: 'audit@host360.ai', last: T('01 Oct', '06:00'), figures: [['Restores', '23'], ['Whole VM', '4'], ['Disks', '6'], ['Files', '13']] }
    ],
    dr: [
      { id: 'rd1', name: 'Recovery target compliance', schedule: 'Daily at 07:00', format: 'PDF', to: 'noc@host360.ai', last: T('21 Oct', '07:00'), figures: [['Servers', '10'], ['Within target', '7'], ['Behind', '1'], ['Not read', '1']] },
      { id: 'rd2', name: 'Recovery plan readiness', schedule: 'After each readiness check', format: 'PDF', to: 'dr-owners@host360.ai', last: T('21 Oct', '06:02'), figures: [['Plans', '3'], ['Ready', '1'], ['Issues', '2'], ['Never tested', '1']] }
    ],
    mig: [
      { id: 'rm1', name: 'Migration progress', schedule: 'Daily at 18:00', format: 'PDF and CSV', to: 'migration@host360.ai', last: T('20 Oct', '18:00'), figures: [['Servers', '10'], ['Committed', '1'], ['Still to copy', '3.33 TB'], ['Next cutover', '25 Oct']] },
      { id: 'rm2', name: 'Cutover summary', schedule: 'After each wave', format: 'PDF', to: 'migration@host360.ai', last: T('21 Oct', '11:40'), figures: [['Servers cut over', '1'], ['Downtime', '14 min 30 s'], ['Rolled back', '0'], ['Open issues', '0']] }
    ]
  };

  const settings = {
    mail: { host: 'smtp.host360.ai', port: '587', security: 'STARTTLS', from: 'aegis@host360.ai', user: 'aegis-notify' },
    channels: [
      { id: 'ch1', kind: 'Email recipients', target: 'noc@host360.ai, backup-team@host360.ai', events: ['Job failed', 'Job finished with warnings', 'Repository above 85 %', 'Site could not be read'], sev: 'Warning', on: true },
      { id: 'ch2', kind: 'Teams channel', target: 'Infra › #aegis-alerts', events: ['Job failed', 'Behind recovery target', 'Cutover started', 'Recovery plan started'], sev: 'Critical', on: true }
    ],
    selfBackup: { schedule: 'Daily at 01:00', repo: 'obj-check', keep: 30, last: T('21 Oct', '01:00'), size: '48.20 MB', enc: true },
    tunables: [
      ['Task slots per proxy', '4', '4', 'slots'], ['Parallel disks per job', '2', '2', 'disks'], ['Network throttle', '0', '0', 'MB/s (0 = unlimited)'],
      ['Snapshot timeout', '600', '600', 's'], ['Reset change tracking after', '3', '3', 'failed backups'], ['Recycle bin retention', '30', '30', 'd'], ['Log retention', '90', '90', 'd'], ['Session timeout', '30', '15', 'min']
    ],
    licence: { edition: 'Host360 Aegis Enterprise', holder: 'Host360 Managed Services', key: 'AEG-7Q2M-XR4D-0091', sockets: [24, 32], instances: [62, 100], mig: [10, 50], expires: '31 Mar 2027', days: 161 }
  };

  const search = [].concat(
    sites.map(s => ({ type: 'Site', label: s.name, sub: s.platform, route: 'sites', id: s.id })),
    guests.map(g => ({ type: 'Guest', label: g.name, sub: g.site, route: 'backup/guests', id: g.id })),
    drServers.map(s => ({ type: 'Server', label: s.name, sub: 'Disaster Recovery · ' + s.plan, route: 'dr/servers', id: s.id })),
    migServers.map(s => ({ type: 'Server', label: s.name, sub: 'Migration · ' + s.src, route: 'mig/servers', id: s.id })),
    jobs.map(j => ({ type: 'Job', label: `${j.name} · ${j.object}`, sub: j.started, route: 'jobs', id: j.id })),
    repos.map(r => ({ type: 'Repository', label: r.name, sub: r.type, route: 'repos', id: r.id })),
    protPlans.map(p => ({ type: 'Plan', label: p.name, sub: 'Protection plan', route: 'dr/plans', id: p.id })),
    recPlans.map(p => ({ type: 'Plan', label: p.name, sub: 'Recovery plan', route: 'dr/recovery', id: p.id })),
    migPlans.map(p => ({ type: 'Plan', label: p.name, sub: 'Migration plan', route: 'mig/plans', id: p.id }))
  );

  const fmtGB = n => n >= 1000 ? `${(n / 1024).toFixed(2)} TB` : `${n.toFixed(2)} GB`;

  return { NOW, T, products, nav, shared, pages, sites, siteNodes, siteStorage, siteNetworks, nodes, repos, policyNames, policies, deletedJobs, copies, guests, drStates, drServers, protPlans, recPlans, phases, drHistory, migStages, migServers, migStage, migPlans, jobs, jobPhases, runningJobs, alerts, pastAlerts, audit, people, projects, exceptions, mappings, reports, settings, search, fmtGB };
})();
