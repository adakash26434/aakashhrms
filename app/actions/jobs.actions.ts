'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as repo from '@/lib/repositories/jobs.repository';
import { JOB_DEFINITIONS, jobDefinition } from '@/lib/engines/scheduler.engine';

// Scheduled jobs (G6): the status screen lives under SYSTEM_CONTROL. The
// tick itself is /api/jobs/tick with its own bearer secret — no server
// action runs jobs, so nothing here can be driven from a browser session.

export interface JobStatusRow {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  lastRunDay: string | null;
  lastStatus: string | null;
  lastDetail: string | null;
}

export async function getJobsPageAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'SYSTEM_CONTROL');
    await repo.ensureJobRows(JOB_DEFINITIONS.map((j) => j.code));
    const [states, runs] = await Promise.all([repo.jobStates(), repo.recentRuns()]);
    const stateByCode = new Map(states.map((s) => [s.code, s]));
    const jobs: JobStatusRow[] = JOB_DEFINITIONS.map((def) => {
      const state = stateByCode.get(def.code);
      return {
        code: def.code,
        name: def.name,
        description: def.description,
        enabled: state?.enabled ?? true,
        lastRunDay: state?.lastRunDay ?? null,
        lastStatus: state?.lastStatus ?? null,
        lastDetail: state?.lastDetail ?? null,
      };
    });
    return {
      success: true as const,
      data: {
        jobs,
        runs: runs.map((r) => ({
          id: r.id,
          jobCode: r.jobCode,
          jobName: jobDefinition(r.jobCode)?.name ?? r.jobCode,
          startedAt: r.startedAt.toISOString(),
          status: r.status,
          detail: r.detail,
          itemsProcessed: r.itemsProcessed,
        })),
        secretConfigured: !!process.env.JOBS_TICK_SECRET && process.env.JOBS_TICK_SECRET.length >= 24,
      },
    };
  } catch (error: unknown) {
    return toActionError(error, 'jobs.list');
  }
}

export async function toggleJobAction(code: string, enabled: boolean) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'SYSTEM_CONTROL');
    if (!jobDefinition(typeof code === 'string' ? code : '')) {
      return { success: false as const, error: 'Unknown job.' };
    }
    await repo.setJobEnabled(code, enabled === true);
    await recordAuditLog({ action: 'EDIT', module: 'SYSTEM_CONTROL', recordId: code, result: 'SUCCESS', newValues: { scheduledJob: code, enabled: enabled === true } });
    revalidatePath('/admin/jobs');
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'jobs.toggle');
  }
}
