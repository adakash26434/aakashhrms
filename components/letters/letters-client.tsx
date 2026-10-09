"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePen, Palette, PackageOpen, Plus, RefreshCw, ScrollText } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { DateCell } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { IssueLetterWindow } from "./issue-letter-window";
import { LetterTemplatesTab } from "./letter-templates-tab";
import { LetterDesignTab } from "./letter-design-tab";
import { JoiningPackWindow } from "./joining-pack-window";
import type { LetterListRow, LettersPageData } from "@/lib/types/letter";

// HR letters (G2): the register of issued letters (chalani order) and the
// template manager. Open a row for the printable letter; wrong letters are
// voided there, never edited or deleted.

type LettersTab = "register" | "templates" | "design";

export function LettersClient({ data, packEmployeeId }: { data: LettersPageData; packEmployeeId?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<LettersTab>("register");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [issuing, setIssuing] = useState(false);
  const [packing, setPacking] = useState(!!packEmployeeId && data.permissions.issue);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const kindOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of data.templates) seen.set(t.code, t.nameNp ? `${t.name} · ${t.nameNp}` : t.name);
    for (const l of data.letters) if (!seen.has(l.kind)) seen.set(l.kind, l.kindName);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [data.templates, data.letters]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.letters.filter((l) => {
      if (filters.kind && l.kind !== filters.kind) return false;
      if (filters.status && l.status !== filters.status) return false;
      if (q && ![l.employeeName, l.employeeCode, l.letterNumber, l.subject].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.letters, filters, search]);

  const columns: GridColumn<LetterListRow>[] = [
    { id: "number", header: "Ref. no.", value: (l) => l.letterNumber, sticky: true, width: 110 },
    { id: "employee", header: "Employee", value: (l) => l.employeeName, cell: (l) => (
        <span>
          {l.employeeName} <span className="text-ink-faint">· {l.employeeCode}</span>
        </span>
      ) },
    { id: "kind", header: "Letter", value: (l) => l.kindName, width: 160 },
    { id: "language", header: "Language", value: (l) => (l.language === "np" ? "नेपाली" : "English"), width: 90 },
    { id: "subject", header: "Subject", value: (l) => l.subject, defaultHidden: true },
    { id: "issued", header: "Issued", value: (l) => l.issuedDateAd, cell: (l) => <DateCell value={l.issuedDateAd} />, type: "date", width: 130 },
    { id: "by", header: "Issued by", value: (l) => l.issuedByName, width: 140, defaultHidden: true },
    {
      id: "status",
      header: "Status",
      value: (l) => (l.status === "voided" ? "Voided" : "Issued"),
      cell: (l) => <StatusChip status={l.status === "voided" ? "cancelled" : "approved"} label={l.status === "voided" ? "Voided" : "Issued"} />,
      width: 100,
    },
  ];

  const tabs: (TabItem & { id: LettersTab })[] = [
    { id: "register", label: "Register", icon: ScrollText },
    { id: "templates", label: "Templates", icon: FilePen, badge: undefined },
    { id: "design", label: "Letter design", icon: Palette },
  ];

  return (
    <div>
      <PageBar
        title="HR letters"
        description="Joining papers (appointment, KYC, dhanjamani, job description, agreement) and later letters (confirmation, promotion, transfer, experience, NOC) — one chalani sequence per fiscal year; Letter design sets your letterhead"
        actions={[
          { id: "issue", label: "Issue letter", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !data.permissions.issue, onClick: () => setIssuing(true) },
          { id: "pack", label: "Joining pack", icon: PackageOpen, group: "create", hidden: !data.permissions.issue, onClick: () => setPacking(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <Tabs variant="folder" items={tabs} value={tab} onChange={(next) => setTab(next as LettersTab)} label="Letter views">
        {tab === "register" && (
          <div className="p-3">
            <FilterStrip
              id="letters"
              className="mb-3"
              search={{ value: search, onChange: setSearch, placeholder: "Employee, code, ref. no. or subject" }}
              filters={[
                { id: "kind", label: "Letter", options: kindOptions, allLabel: "All letters" },
                {
                  id: "status",
                  label: "Status",
                  options: [
                    { value: "issued", label: "Issued" },
                    { value: "voided", label: "Voided" },
                  ],
                  allLabel: "All statuses",
                },
              ]}
              values={filters}
              onChange={setFilters}
            />
            <DataGrid
              id="hr-letters"
              label="HR letters"
              columns={columns}
              rows={rows}
              getRowId={(l) => l.id}
              onOpen={(l) => router.push(`/workforce/letters/${l.id}`)}
              exportModule="HR_LETTERS"
              exportName="hr-letters"
              defaultSort={{ columnId: "issued", direction: "desc" }}
              empty={{ title: "No letters yet", description: data.permissions.issue ? "Issue the first letter with the toolbar." : "Letters issued to employees in your scope appear here." }}
            />
          </div>
        )}
        {tab === "templates" && <LetterTemplatesTab templates={data.templates} canEdit={data.permissions.templates} onDone={(text) => { setNotice(text); startRefresh(() => router.refresh()); }} />}
        {tab === "design" && <LetterDesignTab saved={data.letterhead.design} letterhead={data.letterhead} templates={data.templates} canEdit={data.permissions.templates} onDone={(text) => { setNotice(text); startRefresh(() => router.refresh()); }} />}
      </Tabs>

      <JoiningPackWindow
        open={packing}
        onClose={() => setPacking(false)}
        employees={data.employees}
        initialEmployeeId={packEmployeeId}
        onIssued={(text) => {
          setPacking(false);
          setNotice(text);
          setTab("register");
          router.replace("/workforce/letters");
          router.refresh();
        }}
      />
      <IssueLetterWindow
        open={issuing}
        onClose={() => setIssuing(false)}
        employees={data.employees}
        templates={data.templates.filter((t) => t.isActive)}
        onIssued={(id, letterNumber) => {
          setIssuing(false);
          setNotice(`Letter ${letterNumber} issued.`);
          router.push(`/workforce/letters/${id}`);
        }}
      />
    </div>
  );
}
