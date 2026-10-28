import type { Metadata } from "next";
import { Suspense } from "react";
import { Fraunces, Geist } from "next/font/google";
import { SiteFooter } from "@/components/site-footer.tsx";
import { SiteHeader, SiteHeaderShell } from "@/components/site-header.tsx";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stone Soup",
  description: "Every gift becomes something real: paid straight to the supplier, checked, and delivered.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Suspense fallback={<SiteHeaderShell />}>
          <SiteHeader />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
