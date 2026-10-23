import { useState } from 'react';
import { Btn, SelectInput } from '../../ui/controls';
import { Bar, MiniTable, Status } from '../../ui/layout';
import type { Ctx } from '../../ui/ctx';
import { audit } from '../../platform/store';
import type { SourceVm, Wave } from './data';

/** Free capacity in each customer's target project, from the Host360 cloud portal. */
const FREE: Record<string, { vcpu: number; ramGB: number; tb: number; project: string }> = {
  'production-openstack': { vcpu: 96, ramGB: 384, tb: 6.2, project: 'quota of the customer’s OpenStack project' },
  'Chennai-proxmox-prod': { vcpu: 40, ramGB: 192, tb: 3.1, project: 'free on the cluster after HA reserve' }
};
const PATHS: Record<string, string[]> = {
  'production-openstack': ['Cinder volume, ceph-ssd', 'Cinder volume, ceph-hdd', 'Boot from image, ephemeral'],
  'Chennai-proxmox-prod': ['VM on Ceph RBD', 'VM on local ZFS', 'VM on LVM-thin', 'LXC container on ZFS (Linux only)']
};

/** Mobility › Migration plans › wave › Target: will it fit, and what has to exist before cutover. */
export function TargetTab({ ctx, wave, servers }: { ctx: Ctx; wave: Wave; servers: SourceVm[] }) {
  const dests = [...new Set(servers.map(v => v.dest).filter(Boolean))] as string[];
  const [path, setPath] = useState<Record<string, string>>({});
  const [made, setMade] = useState(false);
  if (!servers.length) return <Bar tone="info">Add servers to the wave to check the target.</Bar>;
  const rows = dests.flatMap(dest => {
    const mine = servers.filter(v => v.dest === dest);
    const need = { vcpu: mine.reduce((a, v) => a + v.cpu, 0), ramGB: mine.reduce((a, v) => a + v.mem, 0), tb: mine.reduce((a, v) => a + v.disks.reduce((x, y) => x + y, 0), 0) / 1024 };
    const f = FREE[dest] || { vcpu: 64, ramGB: 256, tb: 4, project: 'free capacity' };
    return [
      [dest, 'vCPU', String(need.vcpu), `${f.vcpu}`, need.vcpu <= f.vcpu],
      [dest, 'Memory', `${need.ramGB} GB`, `${f.ramGB} GB`, need.ramGB <= f.ramGB],
      [dest, 'Storage', `${need.tb.toFixed(2)} TB`, `${f.tb} TB`, need.tb <= f.tb]
    ] as [string, string, string, string, boolean][];
  });
  const short = rows.filter(r => !r[4]);
  const objs: [string, string][] = [
    ['Networks', dests.includes('production-openstack') ? `${wave.customer}-app-40, ${wave.customer}-db-41 (from Mappings)` : 'vmbr10 with VLAN 10 (from Mappings)'],
    ['Sizes', dests.includes('production-openstack') ? '2 flavors: m1.xlarge-64, m1.2xlarge-128' : 'No new sizes: Proxmox VMs are sized directly'],
    ['Security', dests.includes('production-openstack') ? '3 security groups copied from the NSX rules on the source port groups' : 'Proxmox firewall rules copied from the NSX rules'],
    ['Storage', 'Volume types and pools for the paths chosen below'],
    ['Placement', 'Anti-affinity groups for clustered servers (domain controllers, database pairs)']
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {short.length ? <Bar tone="err" multiline>{wave.name} does not fit: {short.map(r => `${r[1].toLowerCase()} on ${r[0]}`).join(', ')}. Raise the quota in the Host360 cloud portal, or move servers to a later wave.</Bar> : <Bar tone="ok">Fits: every server has room on its target, checked against the live quota.</Bar>}
      <MiniTable label="Capacity check" cols={[{ label: 'Target', w: 'minmax(0,1fr)' }, { label: 'Resource', w: '90px' }, { label: 'Wave needs', w: '100px', r: true }, { label: 'Free', w: '90px', r: true }, { label: '', w: '110px' }]} rows={rows.map(r => [r[0], r[1], r[2], r[3], r[4] ? <Status key="s" icon="circle-check" tone="ok" label="Fits" /> : <Status key="s" icon="circle-x" tone="err" label="Short" />])} />
      <MiniTable
        label="Where each server lands"
        cols={[{ label: 'Server', w: '130px' }, { label: 'Target', w: '160px' }, { label: 'Lands as' }]}
        rows={servers.filter(v => v.dest).map(v => {
          const opts = (PATHS[v.dest!] || ['Default']).filter(o => !o.includes('Linux only') || !/Windows/.test(v.os));
          return [<strong key="n" style={{ fontWeight: 600 }}>{v.name}</strong>, v.dest!, <SelectInput key="p" value={path[v.id] || opts[0]} onChange={x => setPath(p => ({ ...p, [v.id]: x }))} options={opts} />];
        })}
      />
      <div>
        <h3 style={{ font: '600 13px/18px var(--f-ui)', marginBottom: 6 }}>Created on the target before the first pass</h3>
        <MiniTable label="Provisioning" cols={[{ label: 'What', w: '110px' }, { label: 'Detail' }, { label: '', w: '120px' }]} rows={objs.map(([k, v]) => [k, v, made ? <Status key="s" icon="circle-check" tone="ok" label="Created" /> : <Status key="s" icon="circle-minus" tone="tx" label="Not yet" />])} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Btn kind="outline" icon="play" perm={ctx.can('configure', 'Provisioning the target')} disabled={made || !!short.length} why={made ? 'Already created.' : 'The wave does not fit yet.'} onClick={() => { setMade(true); audit({ who: 'priya.raman', customer: wave.customer, what: 'Provisioned the migration target', object: wave.name, when: ctx.now(), r: 'ok', after: objs }); ctx.toast(`Target objects for ${wave.name} created through the Host360 cloud API`, 'ok'); }}>Provision now</Btn>
          <span style={{ alignSelf: 'center', font: '12px/16px var(--f-ui)', color: 'var(--tx-3)' }}>Otherwise they are created automatically 24 h before the first pass.</span>
        </div>
      </div>
    </div>
  );
}
