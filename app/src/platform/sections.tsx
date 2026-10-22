import type { Ctx, LiveJob } from '../ui/ctx';
import { Section } from '../ui/layout';
import { AlertRulesTab, AlertsTab, MaintenanceTab } from './Alerts';
import { ApprovalRulesTab, ApprovalsTab } from './Approvals';
import { WorkflowsTab } from './Workflows';
import { IntegrationsTab } from './Integrations';
import { ApiTab } from './Developer';
import { AuditTab } from './Audit';
import { JobsTab } from './Jobs';
import { HealthTab } from './Health';
import Policies from './Policies';
import { useStore } from './store';
import { inScope } from './common';

type ActivityTab = 'alerts' | 'rules' | 'maintenance' | 'jobs' | 'audit' | 'health';

/** Alerts & Activity: alerts, the rules and windows that shape them, every job, and the audit log. */
export function ActivitySection({ ctx, jobCtl }: { ctx: Ctx; jobCtl: (id: string, a: 'pause' | 'resume' | 'cancel') => void }) {
  const s = useStore();
  const tab = (['alerts', 'rules', 'maintenance', 'jobs', 'audit', ...(ctx.actingAs ? [] : ['health'])].includes(ctx.tab) ? ctx.tab : 'alerts') as ActivityTab;
  const open = s.alerts.filter(a => inScope(ctx, a.customer) && (a.state === 'open' || a.state === 'escalated')).length;
  const running = ctx.jobs.filter((j: LiveJob) => j.status === 'run').length;
  return (
    <Section<ActivityTab>
      kicker="Operations"
      title="Alerts & Activity"
      sub="What needs attention, what is running, and who did what, across every product."
      tab={tab}
      onTab={t => ctx.go(`activity/${t}`)}
      tabs={[
        { v: 'alerts', label: 'Alerts', count: open },
        { v: 'rules', label: 'Alert rules' },
        { v: 'maintenance', label: 'Maintenance windows' },
        { v: 'jobs', label: 'Jobs', count: running ? `${running} running` : undefined },
        { v: 'audit', label: 'Audit log' },
        ...(ctx.actingAs ? [] : [{ v: 'health' as ActivityTab, label: 'Platform health' }])
      ]}
    >
      {tab === 'alerts' ? <AlertsTab ctx={ctx} /> : null}
      {tab === 'rules' ? <AlertRulesTab ctx={ctx} /> : null}
      {tab === 'maintenance' ? <MaintenanceTab ctx={ctx} /> : null}
      {tab === 'jobs' ? <JobsTab ctx={ctx} jobCtl={jobCtl} /> : null}
      {tab === 'audit' ? <AuditTab ctx={ctx} /> : null}
      {tab === 'health' ? <HealthTab ctx={ctx} /> : null}
    </Section>
  );
}

type AutoTab = 'policies' | 'workflows' | 'integrations' | 'api' | 'approvals' | 'rules';

/** Automation: policies for every product, and the approvals that guard actions. */
export function AutomationSection({ ctx }: { ctx: Ctx }) {
  const s = useStore();
  const tab = (['policies', 'workflows', 'integrations', 'api', 'approvals', 'rules'].includes(ctx.tab) ? ctx.tab : 'policies') as AutoTab;
  const waiting = s.approvals.filter(a => a.state === 'pending' && inScope(ctx, a.customer)).length;
  return (
    <Section<AutoTab>
      kicker="Operations"
      title="Automation"
      sub="Policies for Protection, Resilience and Mobility, workflows that chain steps together, and the approvals that guard risky actions."
      tab={tab}
      onTab={t => ctx.go(`automation/${t}`)}
      tabs={[
        { v: 'policies', label: 'Policies', count: s.policies.length },
        { v: 'workflows', label: 'Workflows' },
        { v: 'integrations', label: 'Integrations' },
        { v: 'api', label: 'API and events' },
        { v: 'approvals', label: 'Approvals', count: waiting || undefined },
        { v: 'rules', label: 'Approval rules' }
      ]}
    >
      {tab === 'policies' ? <Policies ctx={ctx} /> : null}
      {tab === 'workflows' ? <WorkflowsTab ctx={ctx} /> : null}
      {tab === 'integrations' ? <IntegrationsTab ctx={ctx} /> : null}
      {tab === 'api' ? <ApiTab ctx={ctx} /> : null}
      {tab === 'approvals' ? <ApprovalsTab ctx={ctx} /> : null}
      {tab === 'rules' ? <ApprovalRulesTab ctx={ctx} /> : null}
    </Section>
  );
}
