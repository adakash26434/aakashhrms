"use client";

export type AttendanceTab = "all" | "present" | "absent" | "late" | "ot";

interface AttendanceTabsProps {
  active: AttendanceTab;
  allCount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  otCount: number;
  onChange: (tab: AttendanceTab) => void;
}

export function AttendanceTabs({ active, allCount, presentCount, absentCount, lateCount, otCount, onChange }: AttendanceTabsProps) {
  const tabs: { id: AttendanceTab; label: string; count: number }[] = [
    { id: "all", label: "All Records", count: allCount },
    { id: "present", label: "Present", count: presentCount },
    { id: "absent", label: "Absent / LWOP", count: absentCount },
    { id: "late", label: "Late Arrivals", count: lateCount },
    { id: "ot", label: "Overtime Earned", count: otCount },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-[#d7e8d0] pb-2 overflow-x-auto">
      {tabs.map((t) => {
        const isSelected = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              isSelected ? "bg-[#2e7d32] text-white shadow-sm" : "bg-[#f6faf6] text-gray-600 hover:bg-[#d7e8d0]/50"
            }`}
          >
            <span>{t.label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"}`}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}