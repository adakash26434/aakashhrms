import Link from "next/link";
import { notFound } from "next/navigation";
import { myLetter } from "@/lib/services/ess-extras.service";
import { essLang } from "@/lib/i18n/ess-server";
import { t } from "@/lib/i18n/ess";
import { LetterSheet } from "@/components/letters/letter-sheet";

export const dynamic = "force-dynamic";

export const metadata = { title: "Letter | Self-Service Portal" };

/** One of the employee's own letters, printable. Someone else's, or a voided one, reads as not found. */
export default async function MyLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await essLang();
  let data: Awaited<ReturnType<typeof myLetter>> = null;
  try {
    data = await myLetter(id);
  } catch {
    data = null;
  }
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <p className="text-xs print:hidden">
        <Link href="/self-service/my-letters" className="font-semibold text-payroll-primary hover:underline">
          ← {t(lang, "letters.back")}
        </Link>
      </p>
      <LetterSheet letter={data.letter} letterhead={data.letterhead} />
    </div>
  );
}
