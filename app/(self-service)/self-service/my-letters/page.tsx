import Link from "next/link";
import { ScrollText } from "lucide-react";
import { myLetters } from "@/lib/services/ess-extras.service";
import { essLang } from "@/lib/i18n/ess-server";
import { t } from "@/lib/i18n/ess";

export const dynamic = "force-dynamic";

export const metadata = { title: "My letters | Self-Service Portal", description: "Letters HR has issued to you." };

/** My letters (self-service): the signed-in employee's own issued letters; voided ones are not listed. */
export default async function MyLettersPage() {
  const lang = await essLang();
  let letters: Awaited<ReturnType<typeof myLetters>> = [];
  let problem: string | null = null;
  try {
    letters = await myLetters();
  } catch (error: unknown) {
    problem = error instanceof Error ? error.message : "Unavailable.";
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-payroll-navy">{t(lang, "letters.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t(lang, "letters.description")}</p>
      </header>
      {problem ? (
        <p className="text-sm text-rose-600">{problem}</p>
      ) : letters.length === 0 ? (
        <div className="rounded-2xl border border-payroll-border bg-white px-4 py-12 text-center text-sm text-zinc-600">
          <ScrollText className="mx-auto mb-2 h-8 w-8 text-payroll-primary" aria-hidden />
          {t(lang, "letters.none")}
        </div>
      ) : (
        <ul className="divide-y divide-payroll-border overflow-hidden rounded-2xl border border-payroll-border bg-white">
          {letters.map((l) => (
            <li key={l.id}>
              <Link href={`/self-service/my-letters/${l.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-payroll-cream">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-payroll-navy">{l.kindName}</span>
                  <span className="block truncate text-xs text-zinc-600">
                    {t(lang, "letters.number")} {l.letterNumber} · {l.language === "np" ? "नेपाली" : "English"} · {l.issuedDateBs} ({l.issuedDateAd})
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-payroll-primary">{t(lang, "letters.open")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
