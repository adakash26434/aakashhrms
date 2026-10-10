import Link from "next/link";
import { Receipt } from "lucide-react";
import { getMyTaxCertificate } from "@/lib/services/self-service.service";
import { essLang } from "@/lib/i18n/ess-server";
import { t } from "@/lib/i18n/ess";
import { TaxCertificatePrint } from "@/components/payroll/tax-certificate-print";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "My tax | Self-Service Portal", description: "Tax withheld from your salary, by fiscal year." };

/** My tax (self-service, F9): the signed-in employee's own tax certificate from released payslips. */
export default async function MyTaxPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const lang = await essLang();
  const { fy } = await searchParams;
  let data: Awaited<ReturnType<typeof getMyTaxCertificate>> | null = null;
  let problem: string | null = null;
  try {
    data = await getMyTaxCertificate(typeof fy === "string" ? fy : undefined);
  } catch (error: unknown) {
    problem = error instanceof Error ? error.message : "Unavailable.";
  }
  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight text-payroll-navy">{t(lang, "tax.title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t(lang, "tax.description")}</p>
      </header>
      {problem ? (
        <p className="text-sm text-danger">{problem}</p>
      ) : !data?.certificate ? (
        <div className="rounded-2xl border border-payroll-border bg-white px-4 py-12 text-center text-sm text-ink-muted">
          <Receipt className="mx-auto mb-2 h-8 w-8 text-payroll-primary" aria-hidden />
          {t(lang, "tax.none")}
        </div>
      ) : (
        <>
          {data.fiscalYears.length > 1 && (
            <nav aria-label={t(lang, "tax.year")} className="flex flex-wrap gap-2 print:hidden">
              {data.fiscalYears.map((y) => (
                <Link
                  key={y.id}
                  href={`/self-service/my-tax?fy=${encodeURIComponent(y.id)}`}
                  aria-current={y.id === data.certificate?.fiscalYearId ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    y.id === data.certificate?.fiscalYearId ? "border-payroll-primary bg-payroll-primary text-white" : "border-payroll-border bg-white text-payroll-navy hover:bg-payroll-cream",
                  )}
                >
                  {y.label}
                </Link>
              ))}
            </nav>
          )}
          <TaxCertificatePrint certificate={data.certificate} letterhead={data.letterhead} />
        </>
      )}
    </div>
  );
}
