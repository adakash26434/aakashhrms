import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyPayslipSheet } from "@/lib/services/self-service.service";
import { essLang } from "@/lib/i18n/ess-server";
import { t } from "@/lib/i18n/ess";
import { PayslipSheet } from "@/components/payroll/payslip-sheet";
import { PrintButton } from "@/components/kit/print-button";
import { asPayslipLanguage, type PayslipLanguage } from "@/lib/constants/payslip-labels";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payslip | Self-Service Portal", description: "Your payslip, ready to print." };

const CHOICES: { value: PayslipLanguage; label: string }[] = [
  { value: "np", label: "नेपाली" },
  { value: "en", label: "English" },
  { value: "both", label: "English + नेपाली" },
];

/** One of the employee's own released payslips (F11), in the portal language or both; printable. */
export default async function MyPayslipPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const [{ id }, { lang: wanted }, portal] = await Promise.all([params, searchParams, essLang()]);
  let data: Awaited<ReturnType<typeof getMyPayslipSheet>> = null;
  try {
    data = await getMyPayslipSheet(id);
  } catch {
    data = null;
  }
  if (!data) notFound();
  const lang: PayslipLanguage = wanted ? asPayslipLanguage(wanted) : portal === "np" ? "np" : "en";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/self-service/my-payslips" className="text-xs font-semibold text-payroll-primary hover:underline">
          ← {t(portal, "payslips.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={t(portal, "nav.language")} className="flex gap-1">
            {CHOICES.map((c) => (
              <Link
                key={c.value}
                href={`/self-service/my-payslips/${id}?lang=${c.value}`}
                aria-current={c.value === lang ? "true" : undefined}
                className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", c.value === lang ? "border-payroll-primary bg-payroll-primary text-white" : "border-payroll-border bg-white text-payroll-navy hover:bg-payroll-cream")}
              >
                {c.label}
              </Link>
            ))}
          </nav>
          <PrintButton label={t(portal, "payslips.print")} />
        </div>
      </div>
      <PayslipSheet data={data} lang={lang} />
    </div>
  );
}
