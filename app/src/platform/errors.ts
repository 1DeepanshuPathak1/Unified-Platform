/**
 * Error catalogue: every failure or warning maps to a stable code with its cause, the fix,
 * a knowledge-base article and the checks the troubleshooter runs. Codes never change meaning.
 */
export type Check = [label: string, state: 'ok' | 'warn' | 'err', detail: string];
export type ErrInfo = { code: string; title: string; cause: string; fix: string[]; kb?: string; retry: 'safe' | 'after-fix'; checks: Check[]; area: 'Source' | 'Network' | 'Target' | 'Policy' | 'Permissions' };

const RULES: [RegExp, ErrInfo][] = [
  [/quiesce timed out/i, {
    code: 'AEG-DR-2041', area: 'Source', title: 'VMware Tools quiesce timed out',
    cause: 'A VSS writer inside the guest did not freeze within 600 s, so VMware Tools gave up and the snapshot failed. On domain controllers it is almost always the NTDS writer.',
    fix: ['On the guest, run vssadmin list writers; every writer should be Stable with no error.', 'If NTDS or another writer shows Failed, restart the Volume Shadow Copy and VMware Tools services.', 'If it keeps happening, let the plan take a crash-consistent point when quiescing fails (Protection plans › If quiescing does not finish in 60 s).'],
    kb: 'KB-1102', retry: 'after-fix',
    checks: [['Reach the vCenter', 'ok', 'Connected in 38 ms'], ['VMware Tools in the guest', 'ok', '12.3.5, running'], ['VSS writer NTDS', 'err', 'Failed: last error “Timed out”'], ['Free space for the shadow copy', 'ok', '41 GB free on C:']]
  }],
  [/application-consistent snapshot failed/i, {
    code: 'AEG-BK-1310', area: 'Source', title: 'Application-consistent snapshot failed; crash-consistent point taken',
    cause: 'The database plug-in could not put Oracle into backup mode (ORA-01123: archive log mode is off), so the point was taken crash-consistent. It restores, but Oracle runs instance recovery on start.',
    fix: ['Turn on archive log mode: ALTER DATABASE ARCHIVELOG with the database mounted.', 'Or set the policy to crash-consistent for this database if archive logs are not wanted.'],
    kb: 'KB-1097', retry: 'after-fix',
    checks: [['Database plug-in', 'ok', '4.2.0, connected'], ['Archive log mode', 'err', 'NOARCHIVELOG'], ['Last good application-consistent point', 'warn', '20 Oct, 16:00 (24 h ago)']]
  }],
  [/read-only/i, {
    code: 'AEG-BK-1404', area: 'Target', title: 'Repository is read-only',
    cause: 'The repository was set to read-only (maintenance or a full disk), so nothing can be written to it.',
    fix: ['Check why it is read-only in Repositories: an admin may have set it, or it passed 98 % full.', 'Make it writable again, or point the copy job at another repository.'],
    retry: 'after-fix',
    checks: [['Repository reachable', 'ok', 'test-repo answered in 4 ms'], ['Mode', 'err', 'Read-only since 21 Oct, 09:12 (set by meera.iyer)'], ['Free space', 'ok', '1.8 TB of 4 TB']]
  }],
  [/compliance mode/i, {
    code: 'AEG-BK-1200', area: 'Policy', title: 'Point locked in compliance mode',
    cause: 'The point is under a compliance lock. Nobody, Host360 included, can delete or shorten it before the date shown.',
    fix: ['Nothing to fix: the lock is working as intended.', 'If storage is the concern, lower the lock for future points in the policy; existing locks stay.'],
    kb: 'KB-1032', retry: 'safe',
    checks: [['Lock', 'ok', 'Compliance mode until 29 Oct 2026, 02:00 IST']]
  }],
  [/cannot bring servers online|role .* cannot/i, {
    code: 'AEG-PF-0403', area: 'Permissions', title: 'Not allowed for this role',
    cause: 'The person who started it has a role without the permission this step needs.',
    fix: ['Ask an Owner to grant the permission in Settings › Roles, or to run it themselves.'],
    retry: 'after-fix',
    checks: [['Role', 'err', 'Viewer: no “Bring servers online”']]
  }],
  [/longer than the .* target/i, {
    code: 'AEG-DR-2210', area: 'Network', title: 'Sync took longer than the RPO target',
    cause: 'More data changed than the link could carry in the window: the changed blocks were 3.4 × the usual size.',
    fix: ['Look at Job bottleneck: if it is the network, raise the bandwidth limit for this window in Data movement.', 'If one server writes far more than usual, check it for a runaway log or an unplanned bulk load.'],
    kb: 'KB-1113', retry: 'safe',
    checks: [['Changed data', 'warn', '18.2 GB against a usual 5.3 GB'], ['Link use', 'warn', '96 % for the whole pass'], ['Target write speed', 'ok', '410 MB/s']]
  }],
  [/locked by a running restore/i, {
    code: 'AEG-BK-1121', area: 'Policy', title: 'Points skipped while a restore reads them',
    cause: 'A copy job does not move a point that a restore is reading; the skipped points are copied on the next run.',
    fix: ['Nothing to fix: the next run copies them.'],
    retry: 'safe',
    checks: [['Restore in progress', 'ok', 'Restore of erp-app-01, 74 %']]
  }],
  [/issues found|failed \(/i, {
    code: 'AEG-GEN-0102', area: 'Source', title: 'Some items in the run failed',
    cause: 'The run finished, but at least one item failed or warned. Each item has its own code in the log.',
    fix: ['Open the log and retry only the failed items.'],
    retry: 'safe',
    checks: [['Items', 'warn', 'See the log for each one']]
  }]
];

const UNKNOWN: ErrInfo = { code: 'AEG-GEN-0001', area: 'Source', title: 'Not classified yet', cause: 'This message has no catalogue entry yet. Support classifies new messages within a working day.', fix: ['Attach a diagnostic bundle to a support request.'], retry: 'after-fix', checks: [] };

export function diagnose(note?: string): ErrInfo | null {
  if (!note) return null;
  return RULES.find(([re]) => re.test(note))?.[1] || UNKNOWN;
}
