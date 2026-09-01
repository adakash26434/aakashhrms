import { auth } from "@/lib/auth";
import { HomePageClient } from "@/components/home/home-page-client";

export const metadata = {
  title: "AakashHRMS — Next-Gen Workforce & Statutory Payroll System",
  description:
    "Enterprise HRMS engineered for Nepalese statutory compliance, IRD progressive income tax, SSF automation, dual BS/AD calendars, and employee self-service.",
};

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const userScope = session?.user?.scopeType ?? undefined;
  const userName = session?.user?.name ?? undefined;

  return (
    <HomePageClient
      isLoggedIn={isLoggedIn}
      userScope={userScope}
      userName={userName}
    />
  );
}
