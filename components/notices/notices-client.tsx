"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, Plus, RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { DateCell } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { Confirm } from "@/components/kit/confirm";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { DateField } from "@/components/kit/date-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { saveNoticeAction, withdrawNoticeAction } from "@/app/actions/notice.actions";
import type { NoticeRow, NoticesPageData } from "@/lib/types/notice";

// Notice board (G14): the register of notices and a form; Home shows the
// published ones to the people they are addressed to.

const statusChip = (status: NoticeRow["status"]) =>
  status === "withdrawn" ? <StatusChip status="cancelled" label="Withdrawn" /> : status === "draft" ? <StatusChip status="pending" label="Draft" /> : <StatusChip status="approved" label="Published" />;

export function NoticesClient({ data }: { data: NoticesPageData }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [editing, setEditing] = useState<NoticeRow | "new" | null>(null);
  const [withdrawing, setWithdrawing] = useState<NoticeRow | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.notices.filter((n) => {
      if (filters.status && n.status !== filters.status) return false;
      if (filters.branch && (n.branchId ?? "all") !== filters.branch) return false;
      if (q && ![n.title, n.body].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.notices, filters, search]);

  const columns: GridColumn<NoticeRow>[] = [
    { id: "title", header: "Notice", value: (n) => n.title, sticky: true, cell: (n) => (
        <span className="inline-flex items-center gap-1">
          {n.pinned && <Pin className="h-3 w-3 text-brand" aria-label="Pinned" />}
          {n.title}
        </span>
      ) },
    { id: "audience", header: "Audience", value: (n) => n.branch ?? "Whole company", width: 160 },
    { id: "publish", header: "From", value: (n) => n.publishAd, type: "date", width: 120, cell: (n) => <DateCell value={n.publishAd} /> },
    { id: "expires", header: "Until", value: (n) => n.expiresAd ?? "", type: "date", width: 120, cell: (n) => (n.expiresAd ? <DateCell value={n.expiresAd} /> : <span className="text-ink-faint">—</span>) },
    { id: "status", header: "Status", value: (n) => n.status, width: 120, cell: (n) => statusChip(n.status) },
    { id: "author", header: "Posted by", value: (n) => n.authorName, width: 140, defaultHidden: true },
  ];

  const withdraw = () =>
    startTransition(async () => {
      if (!withdrawing) return;
      const result = await withdrawNoticeAction(withdrawing.id);
      setWithdrawing(null);
      setNotice(result.success ? { tone: "success", text: `Withdrawn: ${result.data.title}.` } : { tone: "danger", text: result.error });
      router.refresh();
    });

  return (
    <div>
      <PageBar
        title="Notice board"
        description="Company and branch notices: Home shows each person the ones addressed to them, from the publish date until expiry"
        actions={[
          { id: "new", label: "New notice", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.add, onClick: () => setEditing("new") },
          { id: "refresh", label: pending ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <FilterStrip
        id="notices"
        className="mb-3"
        search={{ value: search, onChange: setSearch, placeholder: "Title or text" }}
        filters={[
          { id: "branch", label: "Audience", options: [{ value: "all", label: "Whole company" }, ...data.branches.map((b) => ({ value: b.id, label: b.name }))], allLabel: "Any audience" },
          {
            id: "status",
            label: "Status",
            options: [
              { value: "published", label: "Published" },
              { value: "withdrawn", label: "Withdrawn" },
            ],
            allLabel: "All statuses",
          },
        ]}
        values={filters}
        onChange={setFilters}
      />
      <DataGrid
        id="notices"
        label="Notices"
        columns={columns}
        rows={rows}
        getRowId={(n) => n.id}
        onOpen={(n) => ((data.permissions.manage || data.permissions.withdraw) && n.status === "published" ? setEditing(n) : undefined)}
        rowTone={(n) => (n.status === "withdrawn" ? "danger" : undefined)}
        defaultSort={{ columnId: "publish", direction: "desc" }}
        empty={{ title: "No notices", description: data.permissions.add ? "Post the first notice." : "Notices appear here." }}
      />

      {editing && (
        <NoticeFormWindow
          key={editing === "new" ? "new" : editing.id}
          notice={editing === "new" ? null : editing}
          branches={data.branches}
          canWithdraw={data.permissions.withdraw}
          onWithdraw={(row) => {
            setEditing(null);
            setWithdrawing(row);
          }}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            setEditing(null);
            setNotice({ tone: "success", text: `Saved: ${row.title}.` });
            router.refresh();
          }}
        />
      )}
      <Confirm
        open={!!withdrawing}
        title="Withdraw this notice?"
        message={withdrawing ? `"${withdrawing.title}" disappears from Home. It stays in the register as withdrawn.` : ""}
        confirmLabel="Withdraw"
        tone="danger"
        onConfirm={withdraw}
        onCancel={() => setWithdrawing(null)}
      />
    </div>
  );
}

function NoticeFormWindow({ notice, branches, canWithdraw, onClose, onSaved, onWithdraw }: { notice: NoticeRow | null; branches: NoticesPageData["branches"]; canWithdraw: boolean; onClose: () => void; onSaved: (row: NoticeRow) => void; onWithdraw: (row: NoticeRow) => void }) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const [branchId, setBranchId] = useState(notice?.branchId ?? "");
  const [publishAd, setPublishAd] = useState(notice?.publishAd ?? "");
  const [expiresAd, setExpiresAd] = useState(notice?.expiresAd ?? "");
  const [pinned, setPinned] = useState(notice?.pinned ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveNoticeAction(notice?.id ?? null, { title, body, branchId, publishAd, expiresAd, pinned });
      if (result.success) onSaved(result.data);
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open
      onClose={onClose}
      title={notice ? "Edit notice" : "New notice"}
      size="md"
      dirty
      footer={
        <>
          {notice && canWithdraw && <WindowButton onClick={() => onWithdraw(notice)}>Withdraw</WindowButton>}
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : notice ? "Save" : "Publish"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Notice">
            <FieldRow label="Title" required error={errors.title}>
              <input className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </FieldRow>
            <FieldRow label="Text" required error={errors.body}>
              <textarea className={`${inputClass} h-auto min-h-32 max-w-none py-2`} value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />
            </FieldRow>
            <FieldRow label="Audience" error={errors.branchId}>
              <SelectField options={branches.map((b) => ({ value: b.id, label: b.name }))} value={branchId} onChange={setBranchId} placeholder="Whole company" />
            </FieldRow>
            <FieldRow label="Publish from" required error={errors.publishAd}>
              <DateField value={publishAd} onChange={setPublishAd} />
            </FieldRow>
            <FieldRow label="Until" error={errors.expiresAd} help="Leave empty to keep it up.">
              <DateField value={expiresAd} onChange={setExpiresAd} />
            </FieldRow>
            <FieldRow label="Pinned">
              <YesNoField value={pinned} onChange={setPinned} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}
