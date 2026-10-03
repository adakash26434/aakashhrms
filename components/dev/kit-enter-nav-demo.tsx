"use client";

import { useRef, useState } from "react";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { DiscardBar } from "@/components/kit/discard-bar";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SectionIndex } from "@/components/kit/section-index";
import { useUnsavedGuard } from "@/components/kit/use-unsaved-guard";
import { getAllDistricts } from "@/lib/constants/nepal-locations";

// Sample form only (no real records). Shows the 4.2 form kit on its own.
const DISTRICTS = getAllDistricts().map((d) => ({ value: d.name, label: d.name, hint: d.nameNepali }));
const EMPTY = { name: "", joined: "", district: "", pan: "", notes: "", supervisor: false };
type Demo = typeof EMPTY;

function check(field: keyof Demo, data: Demo): string | null {
  if (field === "name" && !data.name.trim()) return "Full name is required";
  if (field === "joined" && !data.joined) return "Joining date is required";
  if (field === "district" && !data.district) return "Pick a district";
  if (field === "pan" && data.pan && !/^\d{9}$/.test(data.pan)) return "PAN is 9 digits";
  return null;
}

export function KitEnterNavDemo() {
  const [data, setData] = useState<Demo>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Demo, string>>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const dirty = JSON.stringify(data) !== JSON.stringify(EMPTY);
  const leave = useUnsavedGuard(dirty);

  const set = <K extends keyof Demo>(field: K, value: Demo[K]) => {
    setData((d) => ({ ...d, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (name: string) => {
    const message = check(name as keyof Demo, data);
    setErrors((e) => ({ ...e, [name]: message ?? undefined }));
    return !message;
  };

  const save = () => {
    const all = (Object.keys(EMPTY) as (keyof Demo)[]).reduce<Partial<Record<keyof Demo, string>>>((acc, f) => {
      const m = check(f, data);
      if (m) acc[f] = m;
      return acc;
    }, {});
    setErrors(all);
    if (Object.keys(all).length === 0) {
      setSaved(`Saved ${data.name} (sample only)`);
      setData(EMPTY);
    }
  };

  const errorCount = (fields: (keyof Demo)[]) => fields.filter((f) => errors[f]).length;
  const sectionState = (fields: (keyof Demo)[], required: (keyof Demo)[]) =>
    errorCount(fields) ? ("error" as const) : required.length === 0 ? ("optional" as const) : required.every((f) => data[f]) ? ("complete" as const) : ("todo" as const);

  return (
    <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
      <SectionIndex
        className="sticky top-4 self-start"
        items={[
          { id: "demo-person", label: "Person", state: sectionState(["name", "joined"], ["name", "joined"]), errors: errorCount(["name", "joined"]) },
          { id: "demo-place", label: "Place & tax", state: sectionState(["district", "pan"], ["district"]), errors: errorCount(["district", "pan"]) },
          { id: "demo-notes", label: "Notes", state: sectionState(["notes", "supervisor"], []), errors: 0 },
        ]}
      />
      <div className="rounded-lg border border-line-card bg-surface">
        <PropertyForm
          className="p-4"
          onSubmit={save}
          enterNavigation={{ validate, end: () => saveRef.current }}
        >
          <div id="demo-person">
            <FieldGroup title="Person">
              <FieldRow label="Full name" required error={errors.name}>
                <input name="name" className={inputClass} value={data.name} onChange={(e) => set("name", e.target.value)} />
              </FieldRow>
              <FieldRow label="Joining date" required error={errors.joined} help="Type 2080/04/01 or press Alt+↓ for the calendar.">
                <DateField name="joined" value={data.joined} onChange={(v) => set("joined", v)} />
              </FieldRow>
            </FieldGroup>
          </div>
          <div id="demo-place">
            <FieldGroup title="Place & tax">
              <FieldRow label="District" required error={errors.district} help="Type “kath”, then Enter picks it and moves on.">
                <Combobox name="district" options={DISTRICTS} value={data.district} onChange={(v) => set("district", v)} placeholder="Search district" />
              </FieldRow>
              <FieldRow label="PAN" error={errors.pan} help="Optional; 9 digits.">
                <input name="pan" inputMode="numeric" className={`${inputClass} font-code`} value={data.pan} onChange={(e) => set("pan", e.target.value.replace(/\D/g, "").slice(0, 9))} />
              </FieldRow>
            </FieldGroup>
          </div>
          <div id="demo-notes">
            <FieldGroup title="Notes">
              <FieldRow label="Supervisor">
                <label className="inline-flex items-center gap-2 pt-1.5 text-sm">
                  <input name="supervisor" type="checkbox" checked={data.supervisor} onChange={(e) => set("supervisor", e.target.checked)} />
                  Can approve for a team
                </label>
              </FieldRow>
              <FieldRow label="Notes" wide help="Enter adds a line here; Ctrl+Enter moves on.">
                <textarea name="notes" rows={3} className={`${inputClass} h-auto max-w-none py-1.5`} value={data.notes} onChange={(e) => set("notes", e.target.value)} />
              </FieldRow>
            </FieldGroup>
          </div>
        </PropertyForm>
        {leave.pending ? (
          <DiscardBar onKeep={leave.keep} onDiscard={leave.discard} className="rounded-b-lg" />
        ) : (
          <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-line bg-surface-sunken px-4 py-2.5">
            {saved && <p className="mr-auto text-xs text-success">{saved}</p>}
            <button type="button" onClick={() => leave.guard(() => setData(EMPTY))} className="h-8 cursor-pointer rounded-md border border-line bg-surface px-3 text-xs font-medium hover:bg-surface-sunken">
              Cancel
            </button>
            <button ref={saveRef} type="button" onClick={save} className="h-8 cursor-pointer rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover">
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
