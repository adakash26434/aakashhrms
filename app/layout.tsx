import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const dynamic = "force-dynamic";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#1e7e47",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: "Aakash HRMS — Smart People, Strong Organization",
    template: "%s | Aakash HRMS",
  },
  description:
    "Next-generation workforce management and Nepal-compliant statutory payroll system. Seamlessly automate BS/AD dual calendar attendance, progressive IRD tax slabs (FY 2081/82), SSF, CIT, and employee self-service.",
  keywords: [
    "Aakash HRMS",
    "Nepal Payroll System",
    "Nepal HRMS",
    "Bikram Sambat Payroll",
    "SSF Automation Nepal",
    "TDS Tax Slab Nepal",
    "Nepal Labor Act 2074",
    "Salary Management Nepal",
    "Employee Self Service Portal",
  ],
  authors: [{ name: "Aakash Digital", url: "https://aakashdigital.com.np" }],
  creator: "Aakash Digital",
  publisher: "Aakash HRMS",
  applicationName: "Aakash HRMS",
  icons: {
    icon: [
      { url: "/AakashHrmsLogo.png", sizes: "any", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/AakashHrmsLogo.png",
    apple: [
      { url: "/AakashHrmsLogo.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_NP",
    url: "https://aakashhrms.com",
    title: "Aakash HRMS — Smart People, Strong Organization",
    description:
      "Enterprise Nepal-compliant payroll & workforce management system. Automated IRD tax slabs, SSF, CIT, dual BS/AD calendars, and employee self-service.",
    siteName: "Aakash HRMS",
    images: [
      {
        url: "/AakashHrmsLogo.png",
        width: 1200,
        height: 630,
        alt: "Aakash HRMS - Smart People, Strong Organization",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aakash HRMS — Smart People, Strong Organization",
    description:
      "Enterprise Nepal-compliant payroll & workforce management system.",
    images: ["/AakashHrmsLogo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/AakashHrmsLogo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/AakashHrmsLogo.png" />
      </head>
      <body className={`${inter.className} min-h-full flex flex-col font-sans`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
