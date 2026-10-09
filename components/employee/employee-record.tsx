"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Notice } from "@/components/kit/notice";
import { ArrowLeft, CalendarCheck, FileText, History, KeyRound, Landmark, LayoutDashboard, Pencil, Plane, Printer, UserCheck, UserRound, UserX } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { ErrorState } from "@/components/kit/empty-state";
import { StatusChip } from "@/components/kit/status-chip";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { Window, WindowButton } from "@/components/kit/window";
import { resendEmployeeCredentialsAction } from "@/app/actions/employee.actions";
import { isTypingTarget } from "@/lib/frame/shortcuts";
import type { EmployeeRecordData, EmployeeRecordTab } from "@/lib/types/employee";
import { EmployeeRecordIdentity } from "./employee-record-identity";
import { EmployeeRecordOverview } from "./employee-record-overview";
import { EmployeeRecordProfile } from "./employee-record-profile";
import { EmployeeRecordLeave } from "./employee-record-leave";
import { EmployeeRecordAttendance } from "./employee-record-attendance";
import { EmployeeRecordPayslips } from "./employee-record-payslips";
import { EmployeeRecordLoans } from "./employee-record-loans";
import { EmployeeRecordHistory } from "./employee-record-history";
import { EmployeeStatusWindow } from "./employee-status-window";

const TAB_META: Record<EmployeeRecordTab, Omit<TabItem, "id">> = {
  overview: { label: "Overview", icon: LayoutDashboard },
  profile: { label: "Profile", icon: UserRound },
  leave: { label: "Leave", icon: Plane },
  attendance: { label: "Attendance", icon: CalendarCheck },
  payslips: { label: "Payslips", icon: FileText },
  loans: { label: "Loans", icon: Landmark },
  history: { label: "History", icon: History },
};

type CredentialResult = { email: string; tempPassword: string; deliveredVia: string } | { error: string };

/**
 * Employee record page (4.2), laid out like the profile pages of payroll and
 * HR software: an identity column always on the left (BambooHR / greytHR),
 * and tabs on the right: Overview with the headline figures (Zoho Payroll),
 * Profile as topic cards (Keka), then related history. Tabs live in the URL
 * (?tab=) and load on the server.
 */
export function EmployeeRecord({ record, joiningLetters }: { record: EmployeeRecordData; joiningLetters?: { prompt: boolean } | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const { profile, tabs, active, permissions } = record;
  const [tab, setTab] = useState<EmployeeRecordTab>(active.tab);
  const [changingStatus, setChangingStatus] = useState(false);
  const [sending, setSending] = useState(false);
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);
  const [promptOpen, setPromptOpen] = useState(!!joiningLetters?.prompt);

  // Keep the highlighted tab in step with the server (Back / Forward between tabs).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTab(active.tab), [active.tab]);

  const switchTab = (next: string) => {
    setTab(next as EmployeeRecordTab);
    startTransition(() => router.push(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false }));
  };

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/workforce/employees");
  };

  // Esc goes back to the list, unless a window is open, the user is typing, or a grid has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      if (isTypingTarget(target) || target.closest?.("[role='grid'], [role='tablist']") || document.querySelector('[aria-modal="true"]')) return;
      back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    setSending(true);
    const result = await resendEmployeeCredentialsAction(profile.id);
    setSending(false);
    setCredentials(result.success ? { email: result.email, tempPassword: result.tempPassword, deliveredVia: String(result.deliveredVia) } : { error: result.error });
  };

  const editHref = `/workforce/employees/${profile.id}/edit`;

  return (
    <div>
      <PageBar
        title={profile.fullName}
        description={[profile.designationName, profile.departmentName, profile.branchName].filter(Boolean).join(" · ")}
        status={<StatusChip status={profile.status} />}
        crumbs={[{ label: profile.fullName }]}
        actions={[
          { id: "back", label: "Back", icon: ArrowLeft, group: "create", onClick: back },
          { id: "edit", label: "Edit", icon: Pencil, group: "selection", primary: true, shortcut: "F2", hidden: !permissions.edit, onClick: () => router.push(editHref) },
          {
            id: "resend",
            label: sending ? "Sending…" : "Resend sign-in",
            icon: KeyRound,
            group: "selection",
            hidden: !permissions.edit || profile.access?.state !== "pending",
            disabled: sending,
            onClick: resend,
          },
          {
            // Employees are never deleted; leaving is recorded as Inactive.
            id: "status",
            label: profile.status === "Active" ? "Make inactive" : "Make active",
            icon: profile.status === "Active" ? UserX : UserCheck,
            group: "selection",
            hidden: !permissions.edit,
            onClick: () => setChangingStatus(true),
          },
          {
            id: "joining",
            label: "Joining letters",
            icon: FileText,
            group: "output",
            hidden: !joiningLetters,
            onClick: () => router.push(`/workforce/letters?pack=${profile.id}`),
          },
          { id: "print", label: "Print", icon: Printer, group: "output", shortcut: "Ctrl+P", onClick: () => window.print() },
        ]}
      />

      {joiningLetters && promptOpen && (
        <Notice tone="success" className="mb-3" onDismiss={() => setPromptOpen(false)}>
          {profile.fullName} is saved. Issue the joining papers (appointment, job description, agreement, KYC, dhanjamani) in English and Nepali:{" "}
          <Link href={`/workforce/letters?pack=${profile.id}`} className="font-medium underline underline-offset-2">
            Open the joining pack
          </Link>
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[18.5rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-0 lg:self-start">
          <EmployeeRecordIdentity profile={profile} navigator={record.navigator} canEdit={permissions.edit} />
        </div>
        <Tabs
          variant="folder"
          className="min-w-0"
          label="Employee record"
          items={tabs.map((id) => ({ id, ...TAB_META[id] }))}
          value={tab}
          onChange={switchTab}
        >
          <div aria-busy={pending} className={pending ? "pointer-events-none opacity-60 transition-opacity" : undefined}>
            {record.failed ? (
              <ErrorState message="This tab could not be loaded. Nothing has changed in the employee's data." onRetry={() => router.refresh()} />
            ) : tab !== active.tab ? null : active.tab === "overview" ? (
              <EmployeeRecordOverview profile={profile} facts={record.facts} canEdit={permissions.edit} onOpenTab={switchTab} />
            ) : active.tab === "profile" ? (
              <EmployeeRecordProfile profile={profile} canEdit={permissions.edit} />
            ) : active.tab === "leave" ? (
              <EmployeeRecordLeave data={active.data} />
            ) : active.tab === "attendance" ? (
              <EmployeeRecordAttendance data={active.data} />
            ) : active.tab === "payslips" ? (
              <EmployeeRecordPayslips rows={active.data} />
            ) : active.tab === "loans" ? (
              <EmployeeRecordLoans rows={active.data} />
            ) : (
              <EmployeeRecordHistory rows={active.data} />
            )}
          </div>
        </Tabs>
      </div>

      <EmployeeStatusWindow
        target={changingStatus ? { id: profile.id, fullName: profile.fullName, employeeCode: profile.employeeCode, status: profile.status } : null}
        onClose={() => setChangingStatus(false)}
        onDone={() => {
          setChangingStatus(false);
          router.refresh();
        }}
      />

      <Window
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title={credentials && "error" in credentials ? "Sign-in details not sent" : "Sign-in details sent"}
        size="sm"
        footer={
          <WindowButton variant="primary" onClick={() => setCredentials(null)}>
            Done
          </WindowButton>
        }
      >
        {credentials && "error" in credentials ? (
          <p className="text-sm text-danger">{credentials.error}</p>
        ) : credentials ? (
          <div className="space-y-3 text-sm text-ink-muted">
            <p>
              A new temporary password was {credentials.deliveredVia === "email" ? "emailed" : "issued"} to <span className="font-medium text-ink">{credentials.email}</span>. The
              previous one no longer works.
            </p>
            <p className="rounded-md border border-line bg-surface-sunken px-3 py-2">
              Temporary password (shown once): <span className="font-code text-ink">{credentials.tempPassword}</span>
            </p>
          </div>
        ) : null}
      </Window>
    </div>
  );
}
