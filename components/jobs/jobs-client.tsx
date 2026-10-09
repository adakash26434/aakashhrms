"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { StatusChip } from "@/components/kit/status-chip";
import { Notice } from "@/components/kit/notice";
import { DateCell } from "@/components/kit/date-cell";
import { toggleJobAction, type JobStatusRow } from "@/app/actions/jobs.actions";

// Scheduled jobs (G6): status and run log. The jobs run when cron hits
// /api/jobs/tick with the bearer secret; this screen only watches and
// enables/disables per job.

interface RunRow {
  id: string;
  jobCode: string;
  jobName: string;
  startedAt: string;
  status: string;
  detail: string | null;
  itemsProcessed: number;
}

export function JobsClient({ jobs, runs, secretConfigured, canEdit }: { jobs: JobStatusRow[]; runs: RunRow[]; secretConfigured: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const toggle = async (job: JobStatusRow) => {
    setError(null);
    const result = await toggleJobAction(job.code, !job.enabled);
    if (result.success) startRefresh(() => router.refresh());
    else setError(result.error);
  };

  const jobColumns: GridColumn<JobStatusRow>[] = [
    { id: "name", header: "Job", value: (j) => j.name, sticky: true, cell: (j) => (
        <span title={j.description}>{j.name}</span>
      ) },
    { id: "enabled", header: "Enabled", value: (j) => (j.enabled ? "Yes" : "No"), width: 110, cell: (j) =>
        canEdit ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={j.enabled} onChange={() => toggle(j)} aria-label={`${j.name} enabled`} />
            {j.enabled ? "On" : "Off"}
          </label>
        ) : (
          <StatusChip status={j.enabled ? "active" : "inactive"} />
        ) },
    { id: "lastRun", header: "Last ran", value: (j) => j.lastRunDay ?? "", type: "date", width: 130, cell: (j) => (j.lastRunDay ? <DateCell value={j.lastRunDay} /> : <span className="text-ink-faint">never</span>) },
    { id: "status", header: "Status", value: (j) => j.lastStatus ?? "", width: 100, cell: (j) =>
        j.lastStatus ? <StatusChip status={j.lastStatus === "ok" ? "approved" : j.lastStatus === "error" ? "error" : "pending"} label={j.lastStatus} /> : null },
    { id: "detail", header: "Last detail", value: (j) => j.lastDetail ?? "" },
  ];

  const runColumns: GridColumn<RunRow>[] = [
    { id: "when", header: "Started", value: (r) => r.startedAt.slice(0, 16).replace("T", " "), sticky: true, width: 150 },
    { id: "job", header: "Job", value: (r) => r.jobName, width: 220 },
    { id: "status", header: "Status", value: (r) => r.status, width: 100, cell: (r) => <StatusChip status={r.status === "ok" ? "approved" : r.status === "error" ? "error" : "pending"} label={r.status} /> },
    { id: "items", header: "Items", value: (r) => r.itemsProcessed, type: "number", align: "right", width: 80 },
    { id: "detail", header: "Detail", value: (r) => r.detail ?? "" },
  ];

  return (
    <div>
      <PageBar
        title="Scheduled jobs"
        description="Reminders and automation, run by the server clock — not by who happens to sign in"
        actions={[{ id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) }]}
      />
      {error && (
        <Notice tone="danger" className="mb-3" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
      {!secretConfigured && (
        <Notice tone="warning" className="mb-3">
          JOBS_TICK_SECRET is not set (needs 24+ characters), so the tick endpoint refuses every call. Set it in the server environment and add the cron entry from the deployment guide.
        </Notice>
      )}
      <div className="space-y-6">
        <DataGrid id="scheduled-jobs" label="Scheduled jobs" columns={jobColumns} rows={jobs} getRowId={(j) => j.code} pageSize={10} maxHeight="none" empty={{ title: "No jobs" }} />
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">Recent runs</h2>
          <DataGrid id="job-runs" label="Job runs" columns={runColumns} rows={runs} getRowId={(r) => r.id} pageSize={20} maxHeight="420px" empty={{ title: "No runs yet", description: "Runs appear once cron starts hitting /api/jobs/tick." }} />
        </div>
      </div>
    </div>
  );
}
