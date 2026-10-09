"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { Notice } from "@/components/kit/notice";
import { saveLetterDesignAction } from "@/app/actions/letter.actions";
import {
  DEFAULT_DESIGN,
  LOGO_MAX_CHARS,
  MAX_SIGNATURE_BLOCKS,
  SIGNATURE_BLOCKS,
  blockLabel,
  kindLayout,
  normalizeDesign,
  type LetterDesign,
  type SignatureBlock,
} from "@/lib/engines/letter-design.engine";
import type { LetterLanguage } from "@/lib/engines/letter.engine";
import type { LetterDetail, LetterheadData, LetterTemplateRow } from "@/lib/types/letter";
import { LetterSheet } from "./letter-sheet";

// Letter design (G2 follow-up): the sahakari's letterhead and page look, and
// the signature boxes of each kind of letter, with a live preview. Saved as one
// company setting; it changes how letters are drawn, never their words.

const SAMPLE_BODY: Record<LetterLanguage, string> = {
  en: "This is a sample paragraph so you can judge the text size, the line spacing and the margins of your letters.\n\nA second paragraph shows how the signature boxes sit under the text.",
  np: "यो नमूना अनुच्छेद हो, जसबाट तपाईंको पत्रको अक्षरको आकार, हरफ बीचको दूरी र मार्जिन कस्तो देखिन्छ भनेर हेर्न सकिन्छ।\n\nदोस्रो अनुच्छेदले हस्ताक्षर बाकसहरू पाठ मुनि कसरी बस्छन् भन्ने देखाउँछ।",
};

const option = <T extends string>(value: T, label: string) => ({ value, label });

/** Shrinks a chosen image to a letterhead-sized PNG / JPEG data URL under the size limit. */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file is not an image the browser can read."));
      el.src = url;
    });
    for (const height of [160, 120, 90, 60]) {
      const scale = Math.min(1, height / img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL("image/png");
      if (png.length <= LOGO_MAX_CHARS) return png;
      const jpeg = canvas.toDataURL("image/jpeg", 0.85);
      if (jpeg.length <= LOGO_MAX_CHARS) return jpeg;
    }
    throw new Error("The logo is too large; use a smaller image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LetterDesignTab({ saved, letterhead, templates, canEdit, onDone }: { saved: LetterDesign; letterhead: LetterheadData; templates: LetterTemplateRow[]; canEdit: boolean; onDone: (text: string) => void }) {
  const [design, setDesign] = useState<LetterDesign>(saved);
  const [kind, setKind] = useState("appointment");
  const [language, setLanguage] = useState<LetterLanguage>("en");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof LetterDesign>(key: K, value: LetterDesign[K]) => setDesign((d) => ({ ...d, [key]: value }));
  const layout = kindLayout(design, kind);
  const setLayout = (next: Partial<typeof layout>) => setDesign((d) => ({ ...d, kinds: { ...d.kinds, [kind]: { ...kindLayout(d, kind), ...next } } }));
  const setBlocks = (blocks: SignatureBlock[]) => setLayout({ blocks });
  const move = (i: number, by: -1 | 1) => {
    const blocks = [...layout.blocks];
    const j = i + by;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    setBlocks(blocks);
  };

  const dirty = JSON.stringify(normalizeDesign(design)) !== JSON.stringify(saved);
  const kindOptions = templates.map((t) => option(t.code, t.nameNp ? `${t.name} · ${t.nameNp}` : t.name));

  const sample: LetterDetail = useMemo(
    () => ({
      id: "preview",
      letterNumber: "12/2083-84",
      kind,
      kindName: templates.find((t) => t.code === kind)?.name ?? kind,
      language,
      subject: language === "np" ? "नमूना पत्र" : "Sample letter",
      status: "issued",
      employeeId: "preview",
      employeeName: language === "np" ? "सिता शर्मा" : "Sita Sharma",
      employeeCode: "EMP-001",
      issuedDateBs: "2083-06-23",
      issuedDateAd: "2026-10-09",
      issuedByName: "",
      body: SAMPLE_BODY[language],
      mergeData: { guarantor_name: language === "np" ? "राम थापा" : "Ram Thapa" },
      voidReason: null,
      voidedByName: null,
      voidedAt: null,
    }),
    [kind, language, templates],
  );

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      set("logoDataUrl", await shrinkImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that image.");
    }
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveLetterDesignAction(design);
      if (result.success) {
        setDesign(result.data);
        onDone("Letter design saved. Printouts use it from now on; the words of issued letters are unchanged.");
      } else {
        const first = "validationErrors" in result && result.validationErrors ? Object.values(result.validationErrors)[0] : null;
        setError(first ?? result.error);
      }
    });

  const addable = SIGNATURE_BLOCKS.filter(() => layout.blocks.length < MAX_SIGNATURE_BLOCKS);

  return (
    <div className="grid gap-4 p-3 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div>
        {error && (
          <Notice tone="danger" className="mb-3" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        )}
        <PropertyForm enterNavigation>
          <FieldGroup title="Letterhead">
            <FieldRow label="Logo" help="A PNG or JPEG; it is shrunk to fit. Shown above the company name.">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Choose a logo" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
                <WindowButton onClick={() => fileRef.current?.click()} disabled={!canEdit}>
                  <ImagePlus className="h-3.5 w-3.5" /> {design.logoDataUrl ? "Replace" : "Choose image"}
                </WindowButton>
                {design.logoDataUrl && (
                  <WindowButton onClick={() => set("logoDataUrl", "")} disabled={!canEdit}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </WindowButton>
                )}
              </div>
            </FieldRow>
            <FieldRow label="Logo size">
              <SelectField options={[option("sm", "Small"), option("md", "Medium"), option("lg", "Large")]} value={design.logoSize} onChange={(v) => set("logoSize", v as LetterDesign["logoSize"])} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Alignment">
              <SelectField options={[option("center", "Centred"), option("left", "Left")]} value={design.headerAlign} onChange={(v) => set("headerAlign", v as LetterDesign["headerAlign"])} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Rule under header">
              <SelectField options={[option("brand", "Brand colour bar and rule"), option("line", "Thin line"), option("none", "None")]} value={design.ruleStyle} onChange={(v) => set("ruleStyle", v as LetterDesign["ruleStyle"])} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Registration no.">
              <YesNoField value={design.showRegNo} onChange={(v) => set("showRegNo", v)} yesLabel="Show" noLabel="Hide" disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Phone and email">
              <YesNoField value={design.showContact} onChange={(v) => set("showContact", v)} yesLabel="Show" noLabel="Hide" disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Extra line" help="e.g. a licence or regulator line.">
              <input className={inputClass} value={design.headerNote} maxLength={200} onChange={(e) => set("headerNote", e.target.value)} readOnly={!canEdit} />
            </FieldRow>
            <FieldRow label="Footer">
              <input className={inputClass} value={design.footerText} maxLength={300} onChange={(e) => set("footerText", e.target.value)} readOnly={!canEdit} placeholder="e.g. Computer-generated letter; valid with signature" />
            </FieldRow>
          </FieldGroup>

          <FieldGroup title="Page">
            <FieldRow label="Text size">
              <SelectField options={[option("sm", "Small"), option("md", "Normal"), option("lg", "Large")]} value={design.fontSize} onChange={(v) => set("fontSize", v as LetterDesign["fontSize"])} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Line spacing">
              <SelectField options={[option("normal", "Normal"), option("relaxed", "Roomy")]} value={design.lineSpacing} onChange={(v) => set("lineSpacing", v as LetterDesign["lineSpacing"])} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Margins">
              <SelectField options={[option("compact", "Narrow"), option("normal", "Normal"), option("wide", "Wide")]} value={design.margin} onChange={(v) => set("margin", v as LetterDesign["margin"])} disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Subject line">
              <SelectField options={[option("underline", "Bold, underlined"), option("bold", "Bold"), option("plain", "Plain")]} value={design.subjectStyle} onChange={(v) => set("subjectStyle", v as LetterDesign["subjectStyle"])} disabled={!canEdit} />
            </FieldRow>
          </FieldGroup>

          <FieldGroup title="Signature boxes" description="Chosen per kind of letter.">
            <FieldRow label="Letter">
              <SelectField options={kindOptions} value={kind} onChange={setKind} />
            </FieldRow>
            <FieldRow label="Addressee block" help="The employee's name and code under the reference number.">
              <YesNoField value={layout.showRecipient} onChange={(v) => setLayout({ showRecipient: v })} yesLabel="Show" noLabel="Hide" disabled={!canEdit} />
            </FieldRow>
            <FieldRow label="Boxes" wide>
              <div className="space-y-1.5">
                {layout.blocks.length === 0 && <p className="text-xs text-ink-muted">No signature boxes on this letter.</p>}
                {layout.blocks.map((block, i) => (
                  <div key={`${block}-${i}`} className="flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs">
                    <span className="flex-1">{i + 1}. {blockLabel(block, false)}</span>
                    <button type="button" data-enter-skip aria-label="Move up" disabled={!canEdit || i === 0} onClick={() => move(i, -1)} className="cursor-pointer rounded p-1 text-ink-muted hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp aria-hidden className="h-3.5 w-3.5" /></button>
                    <button type="button" data-enter-skip aria-label="Move down" disabled={!canEdit || i === layout.blocks.length - 1} onClick={() => move(i, 1)} className="cursor-pointer rounded p-1 text-ink-muted hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"><ArrowDown aria-hidden className="h-3.5 w-3.5" /></button>
                    <button type="button" data-enter-skip aria-label={`Remove ${blockLabel(block, false)}`} disabled={!canEdit} onClick={() => setBlocks(layout.blocks.filter((_, j) => j !== i))} className="cursor-pointer rounded p-1 text-ink-muted hover:bg-danger-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"><Trash2 aria-hidden className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {canEdit && addable.length > 0 && (
                  <SelectField
                    options={addable.map((b) => option(b.code, b.en))}
                    value=""
                    onChange={(v) => v && setBlocks([...layout.blocks, v as SignatureBlock])}
                    placeholder="Add a box…"
                  />
                )}
              </div>
            </FieldRow>
          </FieldGroup>
        </PropertyForm>

        {canEdit && (
          <div className="mt-3 flex items-center gap-2">
            <WindowButton variant="primary" onClick={save} disabled={pending || !dirty}>
              {pending ? "Saving…" : "Save design"}
            </WindowButton>
            <WindowButton onClick={() => setDesign(DEFAULT_DESIGN)} disabled={pending}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default
            </WindowButton>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span>Preview — sample text, your letterhead</span>
          <div className="w-32">
            <SelectField options={[option("en", "English"), option("np", "नेपाली")]} value={language} onChange={(v) => setLanguage(v as LetterLanguage)} />
          </div>
        </div>
        <LetterSheet letter={sample} letterhead={{ ...letterhead, design: normalizeDesign(design) }} preview />
      </div>
    </div>
  );
}
